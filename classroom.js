import {
  api,
  signIn,
  signOut,
  clearSession,
  command,
  upload,
} from "./classroom-api.js";
import {
  getDocument,
  GlobalWorkerOptions,
} from "./vendor/pdfjs/build/pdf.min.mjs";
GlobalWorkerOptions.workerSrc = new URL(
  "./vendor/pdfjs/build/pdf.worker.min.mjs",
  import.meta.url,
).href;
const teacher = document.body.dataset.role === "teacher",
  app = document.getElementById("app"),
  status = document.getElementById("status"),
  sessionActions = document.getElementById("session-actions");
let authEpoch = 0;
let state,
  tab = teacher ? "courses" : "resources",
  courseId,
  chapterId,
  yearId,
  issuedCodes = [],
  importRows = [];
const el = (tag, attrs = {}, ...children) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
    else if (k === "class") n.className = v;
    else if (v !== undefined && v !== null) {
      if (k in n) n[k] = v;
      else n.setAttribute(k, v);
    }
  }
  for (const child of children.flat(Infinity))
    if (child !== undefined && child !== null)
      n.append(
        child instanceof Node ? child : document.createTextNode(String(child)),
      );
  return n;
};
const msg = (text = "", kind = "") => {
  status.textContent = text;
  status.className = "status " + kind;
};
async function run(fn) {
  try {
    await fn();
  } catch (e) {
    msg(e.message, "error");
    const s = document.querySelector("dialog[open] .dialog-status");
    if (s) s.textContent = e.message;
    if (e.status === 401) {
      clearSession();
      state = null;
      login();
    }
  }
}
const button = (label, fn, kind = "secondary") =>
  el(
    "button",
    {
      type: "button",
      class: "button " + kind,
      onclick: (e) => {
        const target = e.currentTarget;
        return run(async () => {
          target.disabled = true;
          try {
            await fn();
          } finally {
            target.disabled = false;
          }
        });
      },
    },
    label,
  );
const actions = (...items) => el("div", { class: "actions" }, ...items);
const badge = (value) => el("span", { class: "badge " + value }, value);
const empty = (text) => el("div", { class: "empty" }, text);
const panel = (...items) => el("section", { class: "panel" }, ...items);
const heading = (title, ...items) =>
  el("div", { class: "heading" }, el("h2", {}, title), actions(items));
const help = (text) => el("p", { class: "help" }, text);
const size = (value) => {
  if (value < 1048576) return Math.ceil(value / 1024) + " KB";
  const unit = Math.min(4, Math.floor(Math.log(value) / Math.log(1024)));
  return (
    (value / 1024 ** unit).toFixed(1) +
    " " +
    ["B", "KB", "MB", "GB", "TB"][unit]
  );
};
const timezone = () =>
  state?.settings?.timezone || state?.timezone || "Africa/Lagos";
const date = (value) =>
  value
    ? new Intl.DateTimeFormat("en-GB", {
        dateStyle: "medium",
        timeZone: timezone(),
        ...(value.includes("T") ? { timeStyle: "short" } : {}),
      }).format(new Date(value))
    : "—";
function wallParts(value) {
  return Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone(),
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date(value))
      .filter((p) => p.type !== "literal")
      .map((p) => [p.type, p.value]),
  );
}
const localDate = (value) => {
  if (!value) return "";
  const p = wallParts(value);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
};
function iso(value) {
  if (!value) return null;
  const [y, m, d, h, min] = value.split(/[-T:]/).map(Number),
    target = Date.UTC(y, m - 1, d, h, min);
  let guess = target;
  for (let i = 0; i < 3; i++) {
    const p = wallParts(guess),
      actual = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute);
    guess += target - actual;
  }
  if (localDate(guess) !== value)
    throw new Error(
      "This time does not exist in the platform timezone. Choose another time.",
    );
  return new Date(guess).toISOString();
}
const courseName = (id) => state.courses?.find((c) => c.id === id)?.name || "";
const studentName = (id) => {
  const s = state.students?.find((s) => s.id === id);
  return s ? s.first_name + " " + s.last_name : "";
};
const enrollmentName = (id) =>
  studentName(state.enrollments?.find((e) => e.id === id)?.student_id);
function table(headers, rows) {
  return el(
    "div",
    { class: "table-wrap" },
    el(
      "table",
      {},
      el(
        "thead",
        {},
        el(
          "tr",
          {},
          headers.map((h) => el("th", { scope: "col" }, h)),
        ),
      ),
      el(
        "tbody",
        {},
        rows.map((cells) =>
          el(
            "tr",
            {},
            cells.map((c) => el("td", {}, c)),
          ),
        ),
      ),
    ),
  );
}
function download(blob, name) {
  const url = URL.createObjectURL(blob),
    a = el("a", { href: url, download: name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
const jsonDownload = (value, name) =>
  download(
    new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
    name,
  );
async function library(name) {
  if (window[name]) return window[name];
  const script = el("script", {
    src: new URL(
      name === "ExcelJS"
        ? "./vendor/exceljs/exceljs.min.js"
        : "./vendor/jszip/jszip.min.js",
      import.meta.url,
    ).href,
  });
  await new Promise((resolve, reject) => {
    script.onload = resolve;
    script.onerror = () =>
      reject(new Error("The spreadsheet library could not load."));
    document.head.append(script);
  });
  return window[name];
}
async function spreadsheet(headers, rows, name) {
  const ExcelJS = await library("ExcelJS"),
    book = new ExcelJS.Workbook(),
    sheet = book.addWorksheet("Data");
  sheet.addRow(headers);
  for (const row of rows)
    sheet.addRow(
      row.map((v) =>
        v === null || v === undefined
          ? ""
          : typeof v === "number"
            ? v
            : String(v),
      ),
    );
  sheet.getRow(1).font = { bold: true };
  sheet.columns.forEach((c) => {
    c.width = 26;
  });
  download(
    new Blob([await book.xlsx.writeBuffer()], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    name + ".xlsx",
  );
}
function field(name, label, type = "text", value = "", options = []) {
  const id = "field-" + name + "-" + Math.random().toString(36).slice(2, 8);
  let input;
  if (type === "select" || type === "multi")
    input = el(
      "select",
      { name, id, multiple: type === "multi" },
      options.map((o) =>
        el(
          "option",
          {
            value: o.value,
            selected:
              type === "multi"
                ? (value || []).includes(o.value)
                : String(value) === String(o.value),
          },
          o.label,
        ),
      ),
    );
  else if (type === "textarea") input = el("textarea", { name, id, value });
  else
    input = el("input", {
      name,
      id,
      type: type === "check" ? "checkbox" : type,
      ...(type === "check"
        ? { checked: !!value }
        : { value: type === "file" ? "" : value || "" }),
    });
  return el(
    "label",
    { class: "field" + (type === "check" ? " check" : ""), htmlFor: id },
    el("span", {}, label),
    input,
  );
}
const courseOptions = () =>
  state.courses
    .filter((c) => !c.archived)
    .map((c) => ({ value: c.id, label: c.name }));
const yearOptions = () =>
  state.years.map((y) => ({ value: y.id, label: y.label }));
const pubOptions = [
  { value: "hidden", label: "Hidden" },
  { value: "published", label: "Published" },
  { value: "scheduled", label: "Scheduled" },
];
function modal(title, content, wide = false) {
  const dialog = el("dialog", { class: wide ? "wide" : "" }),
    close = button("Close", () => dialog.close(), "secondary small");
  close.classList.add("close");
  dialog.append(
    close,
    el("h2", {}, title),
    el("p", { class: "dialog-status status", role: "status" }),
    content,
  );
  dialog.addEventListener("close", () => dialog.remove());
  document.body.append(dialog);
  dialog.showModal();
  return dialog;
}
function formModal(title, fields, save, submit = "Save", note) {
  const form = el(
    "form",
    {},
    note ? help(note) : null,
    fields,
    el("button", { class: "button", type: "submit" }, submit),
  );
  const dialog = modal(title, form);
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    run(async () => {
      const b = form.querySelector("button[type=submit]");
      b.disabled = true;
      try {
        const data = {};
        for (const input of form.elements) {
          if (!input.name) continue;
          data[input.name] =
            input.type === "checkbox"
              ? input.checked
              : input.type === "select-multiple"
                ? [...input.selectedOptions].map((o) => o.value)
                : input.type === "file"
                  ? input.files
                  : input.value;
        }
        await save(data, form, dialog);
      } finally {
        b.disabled = false;
      }
    });
  });
  return dialog;
}
async function saveRefresh(action, data, dialog) {
  const result = await command(action, data);
  dialog?.close();
  if (result.issuedCodes?.length) issuedCodes = result.issuedCodes;
  await refresh();
  msg("Saved.", "success");
  if (result.issuedCodes?.length) showCodes();
  return result;
}
function confirmAction(title, text, fn) {
  let dialog;
  dialog = modal(
    title,
    el(
      "div",
      {},
      el("p", {}, text),
      actions(
        button("Cancel", () => dialog.close()),
        button(
          "Confirm",
          async () => {
            await fn();
            dialog.close();
          },
          "danger",
        ),
      ),
    ),
  );
}
function login() {
  if (teacher) {
    const brand = document.querySelector(".brand");
    brand.onclick = null;
    brand.href = "./";
  }
  authEpoch++;
  state = null;
  sessionActions.replaceChildren();
  app.replaceChildren();
  msg();
  const form = el(
    "form",
    { autocomplete: "off" },
    field(
      "code",
      teacher ? "Teacher access code" : "Student access code",
      "password",
    ),
    el("button", { class: "button", type: "submit" }, "Sign in"),
  );
  const input = form.querySelector("input");
  input.required = true;
  input.autocomplete = "off";
  input.maxLength = 100;
  app.append(
    el(
      "section",
      { class: "login" },
      el("h1", {}, teacher ? "Teacher dashboard" : "Student access"),
      form,
    ),
  );
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    run(async () => {
      const submit = form.querySelector("button");
      submit.disabled = true;
      try {
        await signIn(teacher ? "teacher" : "student", input.value);
        input.value = "";
        await refresh();
      } finally {
        submit.disabled = false;
      }
    });
  });
}
async function refresh() {
  const epoch = authEpoch;
  msg("Loading…");
  const next = await api(
    teacher
      ? "/state" + (yearId ? "?yearId=" + encodeURIComponent(yearId) : "")
      : "/student",
  );
  if (epoch !== authEpoch) return;
  state = next;
  if (teacher) {
    yearId = state.year.id;
    if (!state.courses.some((c) => c.id === courseId && !c.archived))
      courseId = state.courses.find((c) => !c.archived)?.id;
  }
  render();
  msg();
}
let teacherView = "home";
function teacherGo(view, selectedCourse = courseId, selectedChapter = null) {
  msg();
  teacherView = view;
  courseId = selectedCourse;
  chapterId = selectedChapter;
  const path =
    view === "home"
      ? "courses"
      : view === "settings"
        ? "settings"
        : "courses/" +
          encodeURIComponent(courseId) +
          "/" +
          view +
          (view === "chapter" ? "/" + encodeURIComponent(chapterId) : "");
  history.pushState({ teacherView, courseId, chapterId }, "", "#" + path);
  render();
}
function readTeacherRoute() {
  if (!teacher) return;
  const parts = location.hash.slice(1).split("/");
  try {
    teacherView =
      parts[0] === "settings"
        ? "settings"
        : parts[1]
          ? parts[2] || "course"
          : "home";
    if (parts[1]) courseId = decodeURIComponent(parts[1]);
    chapterId = parts[3] ? decodeURIComponent(parts[3]) : null;
  } catch {
    teacherView = "home";
  }
}
window.addEventListener("popstate", () => {
  readTeacherRoute();
  if (teacher && state) render();
});
readTeacherRoute();
async function leaveClassroom() {
  authEpoch++;
  try {
    await signOut();
  } finally {
    issuedCodes = [];
    importRows = [];
    document.querySelectorAll("dialog").forEach((d) => d.close());
    login();
  }
}
function render() {
  if (teacher) {
    renderTeacher();
    return;
  }
  sessionActions.replaceChildren(
    button("Refresh", refresh, "secondary small"),
    button("Sign out", leaveClassroom, "secondary small"),
  );
  app.replaceChildren(
    el(
      "div",
      { class: "toolbar" },
      el(
        "div",
        {},
        el("h1", {}, state.course.name),
        help(state.student.firstName + " " + state.student.lastName),
      ),
      badge(state.year.label),
    ),
  );
  const tabs = [
    ["resources", "Resources"],
    ["announcements", "Announcements"],
    ["assignments", "Assignments"],
    ["projects", "Projects"],
    ["attendance", "Attendance"],
  ];
  app.append(
    el(
      "nav",
      { class: "tabs", "aria-label": "Classroom" },
      tabs.map(([id, label]) =>
        el(
          "button",
          {
            "aria-current": tab === id ? "page" : undefined,
            onclick: () => {
              tab = id;
              render();
            },
          },
          label +
            (id === "announcements" && state.announcements.some((a) => !a.read)
              ? " •"
              : ""),
        ),
      ),
    ),
  );
  const view = el("div", { id: "view" });
  app.append(view);
  ({
    resources: studentResources,
    announcements: studentAnnouncements,
    assignments: studentAssignments,
    projects: studentProjects,
    attendance: studentAttendance,
  })[tab](view);
}
function moreActions(label, choices) {
  return button(
    label,
    () => {
      const content = el("div", { class: "choice-list" });
      const dialog = modal(label, content);
      for (const choice of choices.filter(Boolean))
        content.append(
          button(
            choice.label,
            async () => {
              dialog.close();
              await choice.run();
            },
            choice.kind || "secondary",
          ),
        );
    },
    "secondary small",
  );
}
function teacherCard(title, description, fn) {
  return el(
    "button",
    { type: "button", class: "teacher-card", onclick: () => run(fn) },
    el("span", { class: "teacher-card-title" }, title),
    description
      ? el("span", { class: "teacher-card-detail" }, description)
      : null,
    el("span", { class: "teacher-card-arrow", "aria-hidden": "true" }, "→"),
  );
}
function teacherCrumbs(course, chapter) {
  const crumbs = el(
    "nav",
    { class: "teacher-crumbs", "aria-label": "Location" },
    button("My courses", () => teacherGo("home"), "text-button"),
  );
  if (course)
    crumbs.append(
      el("span", { "aria-hidden": "true" }, "/"),
      button(course.name, () => teacherGo("course", course.id), "text-button"),
    );
  if (chapter)
    crumbs.append(
      el("span", { "aria-hidden": "true" }, "/"),
      el("span", {}, chapter.name),
    );
  return crumbs;
}
function renderTeacher() {
  document.body.classList.add("guided-teacher");
  sessionActions.replaceChildren(
    button("Sign out", leaveClassroom, "secondary small"),
  );
  const brand = document.querySelector(".brand");
  brand.onclick = (e) => {
    e.preventDefault();
    teacherGo("home");
  };
  app.replaceChildren();
  const course = state.courses.find((c) => c.id === courseId && !c.archived);
  if (!["home", "settings"].includes(teacherView) && !course)
    teacherView = "home";
  const view = el("div", { id: "view" });
  if (teacherView === "home") {
    app.append(
      el(
        "div",
        { class: "toolbar" },
        el(
          "div",
          {},
          el("h1", {}, "My courses"),
          el("span", { class: "meta" }, state.year.label),
        ),
        button("+ Add course", () => courseForm(), "primary"),
      ),
      view,
    );
    const courses = state.courses.filter((c) => !c.archived);
    view.append(
      courses.length
        ? el(
            "div",
            { class: "teacher-card-grid" },
            courses.map((c) => {
              const chapters = state.chapters.filter(
                  (ch) => ch.course_id === c.id,
                ),
                ids = new Set(chapters.map((ch) => ch.id)),
                count = state.documents.filter((d) =>
                  ids.has(d.chapter_id),
                ).length;
              return teacherCard(
                c.name,
                countLabel(chapters.length, "chapter") +
                  " · " +
                  countLabel(count, "document"),
                () => teacherGo("course", c.id),
              );
            }),
          )
        : empty("Add your first course."),
    );
    const archived = state.courses.filter((c) => c.archived);
    if (archived.length)
      view.append(
        el(
          "details",
          { class: "settings-section" },
          el("summary", {}, "Archived courses"),
          archived.map((c) =>
            el(
              "div",
              { class: "resource" },
              c.name,
              button("Restore", () =>
                saveRefresh("courses.archive", { id: c.id, archived: false }),
              ),
            ),
          ),
        ),
      );
    view.append(
      el(
        "div",
        { class: "teacher-home-footer" },
        button("Settings", () => teacherGo("settings"), "text-button"),
      ),
    );
    return;
  }
  if (teacherView === "settings") {
    app.append(
      teacherCrumbs(),
      el("h1", { class: "teacher-page-title" }, "Settings"),
      view,
    );
    teacherSettings(view);
    return;
  }
  const chapter =
    teacherView === "chapter"
      ? state.chapters.find(
          (c) => c.id === chapterId && c.course_id === course.id,
        )
      : null;
  if (teacherView === "chapter" && !chapter) teacherView = "course";
  app.append(teacherCrumbs(course, chapter), view);
  if (teacherView === "course" || teacherView === "chapter") {
    teacherCourses(view);
    return;
  }
  if (teacherView === "tools") {
    view.append(
      el("h1", { class: "teacher-page-title" }, "Students & activities"),
      el(
        "div",
        { class: "teacher-card-grid" },
        [
          ["students", "Students", "Names, access codes and enrollment"],
          ["announcements", "Announcements", "Messages for this course"],
          ["attendance", "Attendance", "Sessions and attendance records"],
          ["assignments", "Assignments", "Homework and submitted files"],
          ["projects", "Project tables", "Shared project registrations"],
        ].map(([id, title, description]) =>
          teacherCard(title, description, () => teacherGo(id, course.id)),
        ),
      ),
    );
    return;
  }
  view.append(
    el(
      "div",
      { class: "teacher-context-return" },
      button(
        "← Students & activities",
        () => teacherGo("tools", course.id),
        "text-button",
      ),
    ),
  );
  const tools = {
    students: teacherStudents,
    announcements: teacherAnnouncements,
    attendance: teacherAttendance,
    assignments: teacherAssignments,
    projects: teacherProjects,
  };
  if (tools[teacherView]) tools[teacherView](view);
  else teacherGo("course", course.id);
}
function countLabel(count, word) {
  return count + " " + word + (count === 1 ? "" : "s");
}
function visibilityBadge(item) {
  return el(
    "span",
    { class: "badge " + item.status },
    item.status === "published"
      ? "Visible"
      : item.status === "scheduled"
        ? "Scheduled"
        : "Hidden",
  );
}
function teacherCourses(view) {
  const course = state.courses.find((c) => c.id === courseId);
  if (teacherView !== "chapter") {
    view.append(
      el(
        "div",
        { class: "toolbar" },
        el("h1", {}, course.name),
        moreActions("Course options", [
          { label: "Rename course", run: () => courseForm(course) },
          {
            label: "Preview as a student",
            run: async () => {
              const preview = await api(
                  "/preview?courseId=" + encodeURIComponent(course.id),
                ),
                body = el("div");
              resourceList(body, preview);
              modal(course.name + " · Student preview", body, true);
            },
          },
          { label: "Copy to another year", run: () => duplicateCourse(course) },
          {
            label: "Archive course",
            kind: "danger",
            run: () =>
              confirmAction(
                "Archive course?",
                "The course will be hidden. Its files, students and history are preserved.",
                async () => {
                  await command("courses.archive", {
                    id: course.id,
                    archived: true,
                  });
                  teacherView = "home";
                  await refresh();
                },
              ),
          },
        ]),
      ),
    );
    view.append(
      el(
        "div",
        { class: "teacher-section-actions" },
        button("Students & activities", () => teacherGo("tools", course.id)),
      ),
    );
    const chapters = state.chapters.filter((c) => c.course_id === course.id);
    view.append(
      panel(
        heading(
          "Chapters",
          button("+ Add chapter", () => chapterForm(), "primary"),
        ),
        chapters.length
          ? el(
              "div",
              { class: "teacher-chapter-list" },
              chapters.map((c) => {
                const count = state.documents.filter(
                  (d) => d.chapter_id === c.id,
                ).length;
                return el(
                  "button",
                  {
                    class: "teacher-chapter-row",
                    onclick: () => teacherGo("chapter", course.id, c.id),
                  },
                  el(
                    "span",
                    {},
                    el("strong", {}, c.name),
                    el(
                      "span",
                      { class: "meta" },
                      countLabel(count, "document"),
                    ),
                  ),
                  visibilityBadge(c),
                  el("span", { "aria-hidden": "true" }, "→"),
                );
              }),
            )
          : empty("No chapters yet."),
      ),
    );
    return;
  }
  const chapter = state.chapters.find((c) => c.id === chapterId),
    docs = state.documents.filter((d) => d.chapter_id === chapter.id);
  view.append(
    el(
      "div",
      { class: "toolbar" },
      el("div", {}, el("h1", {}, chapter.name), visibilityBadge(chapter)),
      button("+ Upload document", () => resourceUpload(chapter.id), "primary"),
    ),
  );
  view.append(
    el(
      "div",
      { class: "teacher-section-actions" },
      chapter.status === "hidden"
        ? button("Publish chapter", () =>
            saveRefresh("chapters.save", {
              id: chapter.id,
              courseId: course.id,
              name: chapter.name,
              status: "published",
            }),
          )
        : null,
      moreActions("Chapter options", [
        { label: "Edit title & visibility", run: () => chapterForm(chapter) },
        { label: "Move chapter up", run: () => moveChapter(-1) },
        { label: "Move chapter down", run: () => moveChapter(1) },
        {
          label: "Remove chapter",
          kind: "danger",
          run: () =>
            confirmAction(
              "Remove chapter?",
              "The chapter and its documents will no longer be shown to students.",
              async () => {
                await command("chapters.delete", { id: chapter.id });
                teacherView = "course";
                chapterId = null;
                await refresh();
              },
            ),
        },
      ]),
    ),
  );
  if (chapter.status === "hidden")
    view.append(
      el(
        "p",
        { class: "help" },
        "Publish the chapter when it is ready for students.",
      ),
    );
  view.append(
    panel(
      heading("Documents"),
      docs.length
        ? docs.map((d) =>
            el(
              "div",
              { class: "resource" },
              el(
                "div",
                { class: "teacher-document-title" },
                d.file
                  ? button(
                      d.title,
                      () => openFile(d.file.id, d.file.name, d.file.mime),
                      "text-button document-link",
                    )
                  : el("strong", {}, d.title),
                el(
                  "div",
                  { class: "meta" },
                  visibilityBadge(d),
                  d.file
                    ? " · " +
                        d.file.name.split(".").pop().toUpperCase() +
                        " · " +
                        date(d.created)
                    : "",
                ),
              ),
              actions(
                d.status === "hidden"
                  ? button(
                      "Publish",
                      () =>
                        saveRefresh("documents.save", {
                          id: d.id,
                          title: d.title,
                          status: "published",
                        }),
                      "secondary small",
                    )
                  : null,
                moreActions("Document options", [
                  {
                    label: "Edit title & visibility",
                    run: () => documentForm(d),
                  },
                  d.file
                    ? {
                        label: "Download",
                        run: () => downloadFile(d.file.id, d.file.name),
                      }
                    : null,
                  {
                    label: "Remove document",
                    kind: "danger",
                    run: () =>
                      confirmAction(
                        "Remove document?",
                        "Students will no longer see this document.",
                        () => saveRefresh("documents.delete", { id: d.id }),
                      ),
                  },
                ]),
              ),
            ),
          )
        : empty("No documents yet. Upload a PDF or PowerPoint file."),
    ),
  );
}

function courseForm(course) {
  formModal(
    course ? "Rename course" : "Add course",
    [field("name", "Course name", "text", course?.name)],
    async (data, form, dialog) => {
      const r = await command("courses.save", {
        ...data,
        id: course?.id,
        yearId,
      });
      courseId = r.id;
      dialog.close();
      await refresh();
      teacherGo("course", r.id);
    },
    "Save",
  );
}
function chapterForm(chapter) {
  const dialog = formModal(
    chapter ? "Edit chapter" : "Add chapter",
    [
      field("name", "Chapter title", "text", chapter?.name),
      ...(chapter
        ? [
            field("status", "Visibility", "select", chapter.status, pubOptions),
            field(
              "publishAt",
              "Publish at",
              "datetime-local",
              localDate(chapter.publish_at),
            ),
          ]
        : []),
    ],
    async (data, form, dialog) => {
      const result = await saveRefresh(
        "chapters.save",
        { ...data, id: chapter?.id, courseId, publishAt: iso(data.publishAt) },
        dialog,
      );
      if (!chapter) teacherGo("chapter", courseId, result.id);
    },
  );
  revealScheduledDate(dialog);
}
function documentForm(d) {
  const dialog = formModal(
    "Edit document",
    [
      field("title", "Document title", "text", d.title),
      field("status", "Visibility", "select", d.status, pubOptions),
      field(
        "publishAt",
        "Publish at",
        "datetime-local",
        localDate(d.publish_at),
      ),
    ],
    (data, form, dialog) =>
      saveRefresh(
        "documents.save",
        { ...data, id: d.id, publishAt: iso(data.publishAt) },
        dialog,
      ),
  );
  revealScheduledDate(dialog);
}
function revealScheduledDate(dialog) {
  const select = dialog.querySelector("select[name=status]"),
    date = dialog.querySelector("input[name=publishAt]");
  if (!select || !date) return;
  const update = () => {
    date.closest("label").hidden = select.value !== "scheduled";
  };
  select.addEventListener("change", update);
  update();
}
async function moveChapter(direction) {
  const chapters = state.chapters.filter((c) => c.course_id === courseId),
    i = chapters.findIndex((c) => c.id === chapterId),
    j = i + direction;
  if (j < 0 || j >= chapters.length) return;
  [chapters[i], chapters[j]] = [chapters[j], chapters[i]];
  await saveRefresh("chapters.reorder", {
    courseId,
    ids: chapters.map((c) => c.id),
  });
}
function duplicateCourse(c) {
  formModal(
    "Copy course",
    [
      field("name", "Course name", "text", c.name),
      field("yearId", "Destination year", "select", yearId, yearOptions()),
    ],
    (data, form, dialog) =>
      saveRefresh("courses.duplicate", { ...data, id: c.id }, dialog),
    "Copy",
    "The copy starts hidden. Original files are preserved.",
  );
}
function resourceUpload(parentId, category = "resource") {
  const f = field("files", "Choose files", "file");
  const input = f.querySelector("input");
  input.multiple = true;
  input.required = true;
  if (category === "resource") input.accept = ".pdf,.pptx";
  formModal(
    "Upload documents",
    [f],
    async (data, form, dialog) => {
      const p = el("progress", { max: 100, value: 0 });
      form.append(p);
      for (const file of data.files) {
        await upload(
          file,
          category,
          parentId,
          file.name.replace(/\.[^.]+$/, "").slice(0, 160),
          (v, t) => {
            p.value = v;
            dialog.querySelector(".dialog-status").textContent = t;
          },
        );
      }
      dialog.close();
      await refresh();
      msg(
        category === "resource" ? "Documents uploaded." : "File uploaded.",
        "success",
      );
    },
    "Upload",
    "Maximum 50 MB per file.",
  );
}
function resourceList(view, data) {
  const search = el("input", {
      type: "search",
      class: "search",
      placeholder: "Search resources",
      "aria-label": "Search resources",
    }),
    list = el("div");
  view.append(search, list);
  const draw = () => {
    list.replaceChildren();
    const q = search.value.toLowerCase();
    for (const chapter of data.chapters) {
      const docs = data.documents.filter(
        (d) =>
          (d.chapterId || d.chapter_id) === chapter.id &&
          (!q || [chapter.name, d.title].join(" ").toLowerCase().includes(q)),
      );
      if (q && !docs.length) continue;
      list.append(
        panel(
          heading(chapter.name),
          docs.length
            ? docs.map((d) =>
                el(
                  "div",
                  { class: "resource" },
                  el(
                    "div",
                    {},
                    el("strong", {}, d.title),
                    d.example ? badge("Example") : null,
                    el(
                      "div",
                      { class: "meta" },
                      d.file
                        ? d.file.name.split(".").pop().toUpperCase() +
                            " · " +
                            size(d.file.size) +
                            " · " +
                            date(d.file.created)
                        : "",
                    ),
                  ),
                  actions(
                    d.file
                      ? button(
                          d.file.mime === "application/pdf"
                            ? "View PDF"
                            : "Download",
                          () =>
                            openFile(
                              d.fileId || d.file_id,
                              d.file.name,
                              d.file.mime,
                            ),
                        )
                      : null,
                    d.file
                      ? button("Download", () =>
                          downloadFile(d.fileId || d.file_id, d.file.name),
                        )
                      : null,
                  ),
                ),
              )
            : empty("No published documents."),
        ),
      );
    }
    if (!list.children.length)
      list.append(
        empty(q ? "No matching resources." : "No published chapters."),
      );
  };
  search.addEventListener("input", draw);
  draw();
}
function studentResources(view) {
  resourceList(view, state);
}
async function downloadFile(id, name) {
  msg("Downloading…");
  const blob = await api(
    "/files/" + encodeURIComponent(id),
    "GET",
    undefined,
    true,
  );
  download(blob, name);
  msg();
}
async function openFile(id, name, mime) {
  if (mime !== "application/pdf") return downloadFile(id, name);
  msg("Opening PDF…");
  const blob = await api(
      "/files/" + encodeURIComponent(id) + "?inline=1",
      "GET",
      undefined,
      true,
    ),
    bytes = new Uint8Array(await blob.arrayBuffer());
  const pdf = await getDocument({
    data: bytes,
    isEvalSupported: false,
    stopAtErrors: true,
    cMapUrl: new URL("./vendor/pdfjs/cmaps/", import.meta.url).href,
    cMapPacked: true,
    standardFontDataUrl: new URL(
      "./vendor/pdfjs/standard_fonts/",
      import.meta.url,
    ).href,
    wasmUrl: new URL("./vendor/pdfjs/wasm/", import.meta.url).href,
  }).promise;
  let page = 1;
  const canvas = el("canvas"),
    count = el("span"),
    surface = el("div", { class: "pdf-surface" }, canvas),
    text = el(
      "details",
      { class: "details" },
      el("summary", {}, "Page text"),
      el("p"),
    );
  const draw = async () => {
    const p = await pdf.getPage(page),
      base = p.getViewport({ scale: 1 }),
      viewport = p.getViewport({
        scale:
          Math.min(1000, Math.max(240, surface.clientWidth - 32)) / base.width,
      }),
      scale = Math.min(devicePixelRatio || 1, 2);
    canvas.width = viewport.width * scale;
    canvas.height = viewport.height * scale;
    canvas.style.width = viewport.width + "px";
    await p.render({
      canvasContext: canvas.getContext("2d"),
      viewport,
      transform: scale === 1 ? null : [scale, 0, 0, scale, 0, 0],
    }).promise;
    count.textContent = "Page " + page + " / " + pdf.numPages;
    text.querySelector("p").textContent =
      (await p.getTextContent()).items.map((i) => i.str || "").join(" ") ||
      "Blank page.";
  };
  const dialog = modal(
    name,
    el(
      "div",
      {},
      actions(
        button("Previous", async () => {
          if (page > 1) {
            page--;
            await draw();
          }
        }),
        count,
        button("Next", async () => {
          if (page < pdf.numPages) {
            page++;
            await draw();
          }
        }),
        button("Download", () => download(blob, name)),
      ),
      surface,
      text,
    ),
    true,
  );
  dialog.addEventListener("close", () => pdf.destroy());
  await draw();
  msg();
}
function teacherStudents(view) {
  const enrollments = state.enrollments.filter((e) => e.course_id === courseId),
    ids = new Set(enrollments.map((e) => e.student_id)),
    students = state.students.filter((s) => ids.has(s.id));
  const search = el("input", {
      type: "search",
      class: "search",
      placeholder: "Search students",
      "aria-label": "Search students by name or email",
    }),
    list = el("div");
  const filtered = () =>
    students.filter((s) =>
      [s.first_name, s.last_name, s.email]
        .join(" ")
        .toLowerCase()
        .includes(search.value.toLowerCase()),
    );
  const draw = () => {
    const matches = filtered();
    list.replaceChildren(
      matches.length
        ? table(
            ["Student", "Email", "Status", ""],
            matches.map((s) => {
              const e = enrollments.find((e) => e.student_id === s.id);
              return [
                button(
                  s.first_name + " " + s.last_name,
                  () => studentForm(s, e),
                  "text-button",
                ),
                s.email,
                badge(
                  s.active && e.status === "active" ? "active" : "inactive",
                ),
                moreActions("Student options", [
                  {
                    label: "Edit student or change course",
                    run: () => studentForm(s, e),
                  },
                  {
                    label: "Create a new access code",
                    run: () =>
                      confirmAction(
                        "Replace student code?",
                        "The old code will stop working. Save the new code after it appears.",
                        () => saveRefresh("students.code", { id: e.id }),
                      ),
                  },
                  {
                    label: s.active ? "Deactivate student" : "Activate student",
                    run: () =>
                      saveRefresh("students.deactivate", {
                        id: s.id,
                        active: !s.active,
                      }),
                  },
                ]),
              ];
            }),
          )
        : empty(
            students.length
              ? "No matching students."
              : "No students in this course.",
          ),
    );
  };
  search.addEventListener("input", draw);
  view.append(
    panel(
      heading(
        "Students",
        button("+ Add student", () => studentForm(), "primary"),
        button("Import list", () => importStudents()),
      ),
      search,
      list,
    ),
  );
  view.append(
    el(
      "details",
      { class: "settings-section" },
      el("summary", {}, "Download student list"),
      el(
        "div",
        { class: "settings-section-body" },
        button("Download Excel file", () =>
          spreadsheet(
            ["First name", "Last name", "Email", "Course", "Active"],
            filtered().map((s) => [
              s.first_name,
              s.last_name,
              s.email,
              courseName(
                enrollments.find((e) => e.student_id === s.id).course_id,
              ),
              s.active ? "Yes" : "No",
            ]),
            "students",
          ),
        ),
      ),
    ),
  );
  draw();
}

function studentForm(s, e) {
  if (!courseId) {
    msg("Add a course first.", "error");
    return;
  }
  formModal(
    s ? "Edit student" : "Add student",
    [
      field("firstName", "First name", "text", s?.first_name),
      field("lastName", "Last name", "text", s?.last_name),
      field("email", "Email", "email", s?.email),
      field(
        "courseId",
        "Course",
        "select",
        e?.course_id || courseId,
        courseOptions(),
      ),
      ...(s ? [field("active", "Active", "check", !!s.active)] : []),
    ],
    (data, form, dialog) =>
      saveRefresh("students.save", { ...data, id: s?.id, yearId }, dialog),
  );
}
function showCodes() {
  if (!issuedCodes.length) return;
  const codes = [...issuedCodes];
  modal(
    "Save the student codes",
    el(
      "div",
      {},
      help(
        "Codes are shown only now. Save this file privately and give each student only their own code.",
      ),
      table(
        ["Name", "Email", "Code"],
        codes.map((s) => [
          s.firstName + " " + s.lastName,
          s.email,
          el("span", { class: "code" }, s.code),
        ]),
      ),
      actions(
        button(
          "Download XLSX",
          () =>
            spreadsheet(
              ["First name", "Last name", "Email", "Student code"],
              codes.map((s) => [s.firstName, s.lastName, s.email, s.code]),
              "student-codes",
            ),
          "primary",
        ),
        button("Download CSV", () =>
          csvDownload(
            ["First name", "Last name", "Email", "Student code"],
            codes.map((s) => [s.firstName, s.lastName, s.email, s.code]),
            "student-codes.csv",
          ),
        ),
      ),
    ),
    true,
  ).addEventListener("close", () => {
    issuedCodes = [];
  });
}
function csvDownload(headers, rows, name) {
  const cell = (v) =>
    '"' +
    String(v ?? "")
      .replace(/^[=+@\-\t\r]/, "'$&")
      .replace(/"/g, '""') +
    '"';
  download(
    new Blob(
      [
        "\ufeff" +
          [headers, ...rows].map((r) => r.map(cell).join(",")).join("\r\n"),
      ],
      { type: "text/csv;charset=utf-8" },
    ),
    name,
  );
}
function parseCSV(text) {
  const rows = [];
  let row = [],
    value = "",
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        value += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === "," && !quoted) {
      row.push(value);
      value = "";
    } else if ((c === "\r" || c === "\n") && !quoted) {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(value);
      if (row.some((v) => v.trim())) rows.push(row);
      row = [];
      value = "";
    } else value += c;
  }
  if (quoted) throw new Error("Unclosed quote in CSV.");
  row.push(value);
  if (row.some((v) => v.trim())) rows.push(row);
  return rows;
}
async function readRows(file) {
  if (file.size > 10 * 1048576) throw new Error("Spreadsheet limit: 10 MB.");
  if (/\.csv$/i.test(file.name))
    return parseCSV((await file.text()).replace(/^\ufeff/, ""));
  if (!/\.xlsx$/i.test(file.name)) throw new Error("Choose CSV or XLSX.");
  const ExcelJS = await library("ExcelJS"),
    book = new ExcelJS.Workbook();
  await book.xlsx.load(await file.arrayBuffer());
  const sheet = book.worksheets[0];
  if (!sheet) throw new Error("The workbook is empty.");
  if (sheet.rowCount > 2001 || sheet.columnCount > 40)
    throw new Error("Use at most 2,000 rows and 40 columns.");
  const rows = [];
  sheet.eachRow((row) =>
    rows.push(
      Array.from(
        { length: sheet.columnCount },
        (_, i) => row.getCell(i + 1).text,
      ),
    ),
  );
  return rows;
}
function importStudents() {
  if (!courseId) {
    msg("Add a course first.", "error");
    return;
  }
  const f = field("file", "Student list", "file");
  f.querySelector("input").accept = ".csv,.xlsx";
  f.querySelector("input").required = true;
  formModal(
    "Import students",
    [f],
    async (data, form, dialog) => {
      const rows = await readRows(data.file[0]),
        headers = rows
          .shift()
          .map((h) => h.toLowerCase().replace(/[\s_-]/g, ""));
      const first = headers.findIndex((h) =>
          ["firstname", "prénom", "prenom"].includes(h),
        ),
        last = headers.findIndex((h) =>
          ["lastname", "surname", "nom"].includes(h),
        ),
        email = headers.findIndex((h) =>
          ["email", "emailaddress", "courriel"].includes(h),
        );
      if ([first, last, email].some((i) => i < 0))
        throw new Error("Headers required: First name, Last name, Email.");
      importRows = rows.map((r) => ({
        firstName: r[first] || "",
        lastName: r[last] || "",
        email: r[email] || "",
      }));
      const preview = await command("students.preview", {
        yearId,
        courseId,
        rows: importRows,
      });
      dialog.close();
      const body = el(
        "div",
        {},
        help(
          "Existing email addresses will be updated and enrolled in this course for " +
            state.year.label +
            ".",
        ),
        table(
          ["Row", "First name", "Last name", "Email", "Result"],
          preview.rows.map((r) => [
            r.row,
            r.firstName || "",
            r.lastName || "",
            r.email || "",
            r.error || r.action,
          ]),
        ),
      );
      const d = modal("Import preview", body, true);
      body.append(
        button(
          "Import " + preview.rows.length + " students",
          async () => {
            if (!preview.valid)
              throw new Error("Correct the rows with errors before importing.");
            await saveRefresh(
              "students.import",
              { yearId, courseId, rows: importRows },
              d,
            );
            importRows = [];
          },
          preview.valid ? "primary" : "secondary",
        ),
      );
    },
    "Preview",
    "CSV / XLSX · First name, Last name, Email · Up to 500 students per import.",
  );
}
function teacherAnnouncements(view) {
  const announcements = state.announcements.filter((a) =>
    JSON.parse(a.course_ids).includes(courseId),
  );
  view.append(
    panel(
      heading(
        "Announcements",
        button("+ New announcement", () => announcementForm(), "primary"),
      ),
      announcements.length
        ? announcements.map((a) =>
            el(
              "div",
              { class: "resource" },
              el(
                "div",
                {},
                button(
                  a.title,
                  () => announcementForm(a),
                  "text-button document-link",
                ),
                badge(a.status),
                help(a.readCount + " read"),
              ),
              moreActions("Announcement options", [
                {
                  label: "Edit message & visibility",
                  run: () => announcementForm(a),
                },
                {
                  label: "Attach a file",
                  run: () => resourceUpload(a.id, "announcement"),
                },
                {
                  label: "Archive announcement",
                  run: () => saveRefresh("announcements.delete", { id: a.id }),
                },
              ]),
            ),
          )
        : empty("No announcements."),
    ),
  );
}

function announcementForm(a) {
  const opts = [
    { value: "draft", label: "Draft" },
    { value: "published", label: "Published" },
    { value: "scheduled", label: "Scheduled" },
    { value: "archived", label: "Archived" },
  ];
  formModal(
    a ? "Edit announcement" : "New announcement",
    [
      field("title", "Title", "text", a?.title),
      field("body", "Message", "textarea", a?.body),
      field(
        "courseIds",
        "Courses (choose one or more)",
        "multi",
        a ? JSON.parse(a.course_ids) : courseId ? [courseId] : [],
        courseOptions(),
      ),
      field("status", "Visibility", "select", a?.status || "draft", opts),
      field(
        "publishAt",
        "Publish at",
        "datetime-local",
        localDate(a?.publish_at),
      ),
    ],
    (data, form, dialog) =>
      saveRefresh(
        "announcements.save",
        { ...data, id: a?.id, yearId, publishAt: iso(data.publishAt) },
        dialog,
      ),
  );
}
function studentAnnouncements(view) {
  if (!state.announcements.length) {
    view.append(empty("No announcements."));
    return;
  }
  for (const a of state.announcements)
    view.append(
      el(
        "section",
        { class: "panel" + (!a.read ? " unread" : "") },
        heading(a.title, !a.read ? badge("Unread") : null),
        help(date(a.date)),
        el("p", {}, a.body),
        actions(
          a.attachments.map((id) =>
            button("Download attachment", () => downloadFile(id, "attachment")),
          ),
          !a.read
            ? button("Mark as read", () =>
                saveRefresh("announcements.read", { id: a.id }),
              )
            : null,
        ),
      ),
    );
}
function teacherAttendance(view) {
  const sessions = state.attendanceSessions.filter(
    (s) => s.course_id === courseId,
  );
  view.append(
    panel(
      heading(
        "Attendance",
        button("+ New session", () =>
          formModal(
            "New attendance session",
            [
              field(
                "date",
                "Date",
                "date",
                new Date().toISOString().slice(0, 10),
              ),
              field("time", "Time", "time"),
              field("title", "Session title", "text"),
            ],
            async (data, form, dialog) => {
              const result = await saveRefresh(
                "attendance.create",
                { ...data, courseId },
                dialog,
              );
              await attendanceEditor(result.id);
            },
          ),
        ),
        button("Reports", attendanceReports),
      ),
      sessions.length
        ? table(
            ["Date", "Session", "Status", ""],
            sessions.map((s) => [
              date(s.date) + " " + s.time,
              s.title,
              badge(s.finalized ? "Finalized" : "Draft"),
              button("Open roster", () => attendanceEditor(s.id)),
            ]),
          )
        : empty("No attendance sessions."),
    ),
  );
}
async function attendanceEditor(id) {
  const data = await api("/attendance/" + id),
    controls = [];
  const body = el("div"),
    rows = data.students.map((s) => {
      const record = data.records.find((r) => r.student_id === s.id);
      const select = field(
          "status-" + s.id,
          "Status for " + s.first_name + " " + s.last_name,
          "select",
          record?.status || "",
          [
            { value: "", label: "Choose" },
            ...["present", "absent", "late", "excused"].map((v) => ({
              value: v,
              label: v[0].toUpperCase() + v.slice(1),
            })),
          ],
        ).querySelector("select"),
        note = el("input", {
          value: record?.note || "",
          maxLength: 500,
          "aria-label": "Note for " + s.first_name + " " + s.last_name,
        });
      controls.push({ studentId: s.id, select, note });
      return [s.first_name + " " + s.last_name, select, note];
    });
  const d = modal("Attendance · " + date(data.session.date), body, true);
  const save = async (finalized) => {
    const records = controls
      .filter((c) => c.select.value)
      .map((c) => ({
        studentId: c.studentId,
        status: c.select.value,
        note: c.note.value,
      }));
    if (finalized && records.length !== controls.length)
      throw new Error("Mark every student before finalizing.");
    await command("attendance.save", {
      id,
      revision: data.session.revision,
      records,
      finalized,
    });
    d.close();
    await refresh();
  };
  body.append(
    actions(
      button("Mark all present", () => {
        controls.forEach((c) => {
          c.select.value = "present";
        });
      }),
      button("Save draft", () => save(false)),
      button("Finalize", () => save(true), "primary"),
    ),
    table(["Student", "Status", "Note"], rows),
    help("Only finalized records appear to students."),
  );
}
async function attendanceReports() {
  const course = field("courseId", "Course", "select", courseId, [
      { value: "", label: "All courses" },
      ...courseOptions(),
    ]),
    from = field("from", "From", "date"),
    to = field("to", "To", "date"),
    result = el("div");
  const controls = el("div", { class: "form-grid" }, course, from, to),
    body = el("div", {}, controls);
  const load = async () => {
    const params = new URLSearchParams({
      yearId,
      courseId: course.querySelector("select").value,
      from: from.querySelector("input").value,
      to: to.querySelector("input").value,
    });
    const report = await api("/attendance-report?" + params);
    const rows = report.summaries.map((s) => [
      s.firstName + " " + s.lastName,
      s.present,
      s.absent,
      s.late,
      s.excused,
      s.percentage === null ? "—" : s.percentage + "%",
    ]);
    result.replaceChildren(
      actions(
        button("Export XLSX", () =>
          spreadsheet(
            ["Student", "Present", "Absent", "Late", "Excused", "Attendance"],
            rows,
            "attendance",
          ),
        ),
        button("Print / Save as PDF", () =>
          printReport(
            "Attendance · " + state.year.label,
            ["Student", "Present", "Absent", "Late", "Excused", "Attendance"],
            rows,
          ),
        ),
      ),
      table(
        ["Student", "Present", "Absent", "Late", "Excused", "Attendance"],
        rows,
      ),
      help("Percentages use finalized sessions and the policy in Settings."),
    );
  };
  body.append(button("Apply filters", load), result);
  modal("Attendance reports", body, true);
  await load();
}
function printReport(title, headers, rows) {
  const area = el(
    "div",
    { id: "print-report" },
    el("h1", {}, title),
    table(headers, rows),
  );
  document.body.append(area);
  document.body.classList.add("printing");
  window.print();
  area.remove();
  document.body.classList.remove("printing");
}
function studentAttendance(view) {
  const report = state.attendance,
    s = report.summaries[0];
  if (s)
    view.append(
      el(
        "div",
        { class: "stats" },
        [
          ["Attendance", s.percentage === null ? "—" : s.percentage + "%"],
          ["Absent", s.absent],
          ["Late", s.late],
          ["Excused", s.excused],
        ].map(([label, value]) =>
          el("div", { class: "stat" }, label, el("strong", {}, value)),
        ),
      ),
    );
  view.append(
    panel(
      heading("My attendance"),
      report.records.length
        ? table(
            ["Date", "Session", "Status", "Note"],
            report.records.map((r) => [
              date(r.date),
              r.title,
              badge(r.status),
              r.note,
            ]),
          )
        : empty("No finalized attendance records."),
    ),
  );
}
function teacherAssignments(view) {
  const assignments = state.assignments.filter((a) => a.course_id === courseId);
  view.append(
    panel(
      heading(
        "Assignments",
        button("+ New assignment", () => assignmentForm(), "primary"),
      ),
      assignments.length
        ? assignments.map((a) =>
            el(
              "div",
              { class: "resource" },
              el(
                "div",
                {},
                el("strong", {}, a.title),
                badge(a.status),
                a.deadline ? help("Deadline: " + date(a.deadline)) : null,
              ),
              actions(
                button("Review work", () => submissionsView(a)),
                moreActions("Assignment options", [
                  { label: "Edit assignment", run: () => assignmentForm(a) },
                  {
                    label: "Give a student an extension",
                    run: () => extensionForm(a, "assignment"),
                  },
                ]),
              ),
            ),
          )
        : empty("No assignments."),
    ),
  );
}

function assignmentForm(a) {
  if (!courseId) {
    msg("Add a course first.", "error");
    return;
  }
  const dialog = formModal(
    a ? "Edit assignment" : "New assignment",
    [
      field("title", "Title", "text", a?.title),
      field("body", "Instructions", "textarea", a?.body),
      field("deadline", "Deadline ", "datetime-local", localDate(a?.deadline)),
      field("status", "Visibility", "select", a?.status || "draft", [
        { value: "draft", label: "Draft" },
        { value: "published", label: "Published" },
        { value: "closed", label: "Closed" },
      ]),
      el(
        "div",
        { class: "form-grid" },
        field(
          "maxFileMB",
          "Maximum MB per file",
          "number",
          a ? a.max_file_bytes / 1048576 : 10,
        ),
        field(
          "maxTotalMB",
          "Maximum MB per submission",
          "number",
          a ? a.max_total_bytes / 1048576 : 50,
        ),
      ),
      field("allowLate", "Allow late work", "check", !!a?.allow_late),
      field(
        "allowReplace",
        "Allow replacing / removing files",
        "check",
        a ? !!a.allow_replace : true,
      ),
      field("groups", "Allow group submissions", "check", !!a?.groups),
    ],
    (data, form, dialog) =>
      saveRefresh(
        "assignments.save",
        {
          ...data,
          id: a?.id,
          courseId,
          deadline: iso(data.deadline),
          maxFileBytes: Number(data.maxFileMB) * 1048576,
          maxTotalBytes: Number(data.maxTotalMB) * 1048576,
        },
        dialog,
      ),
  );
  const options = el(
    "details",
    { class: "settings-section" },
    el("summary", {}, "Submission options"),
    el("div", { class: "settings-section-body" }),
  );
  const body = options.lastElementChild;
  for (const name of ["maxFileMB", "allowLate", "allowReplace", "groups"]) {
    const input = dialog.querySelector("[name=" + name + "]");
    if (input) {
      const container =
        name === "maxFileMB"
          ? input.closest(".form-grid")
          : input.closest("label");
      if (container) body.append(container);
    }
  }
  dialog.querySelector("button[type=submit]").before(options);
}
function submissionsView(a) {
  const list = state.submissions.filter((s) => s.assignment_id === a.id),
    allFiles = state.submissionFiles.filter(
      (f) => list.some((s) => s.id === f.submission_id) && f.file,
    );
  const body = el(
    "div",
    {},
    actions(
      button("Download ZIP", () => bulkZIP(a, allFiles)),
      button("Export grades XLSX", () =>
        spreadsheet(
          ["Student / group owner", "Submitted", "Late", "Grade", "Feedback"],
          list.map((s) => [
            enrollmentName(s.enrollment_id),
            s.submitted_at,
            s.late ? "Yes" : "No",
            s.grade,
            s.feedback,
          ]),
          a.title + "-grades",
        ),
      ),
    ),
    help(
      "ZIP download limit: 100 MB at a time. Larger files can be downloaded individually.",
    ),
  );
  const rows = list
    .filter((s) => allFiles.some((f) => f.submission_id === s.id))
    .map((s) => [
      enrollmentName(s.enrollment_id) + (s.group_id ? " (group)" : ""),
      date(s.submitted_at) + (s.late ? " · Late" : ""),
      el(
        "div",
        { class: "list" },
        allFiles
          .filter((f) => f.submission_id === s.id)
          .map((f) =>
            button(
              f.file.name,
              () => openFile(f.file_id, f.file.name, f.file.mime),
              "secondary small",
            ),
          ),
      ),
      s.grade || "—",
      button("Feedback / grade", () =>
        formModal(
          "Feedback",
          [
            field("grade", "Grade", "text", s.grade),
            field("feedback", "Feedback", "textarea", s.feedback),
            field(
              "retentionExempt",
              "Keep files when this year is cleaned up",
              "check",
              !!s.retention_exempt,
            ),
          ],
          async (data, form, dialog) => {
            await saveRefresh(
              "submissions.feedback",
              { ...data, id: s.id },
              dialog,
            );
            d.close();
            submissionsView(state.assignments.find((x) => x.id === a.id));
          },
        ),
      ),
    ]);
  body.append(
    rows.length
      ? table(["Student", "Submitted", "Files", "Grade", ""], rows)
      : empty("No submitted files."),
  );
  const submittedIds = new Set(
    list
      .filter((s) => allFiles.some((f) => f.submission_id === s.id))
      .flatMap((s) => [s.enrollment_id, ...JSON.parse(s.member_ids || "[]")]),
  );
  const missing = state.enrollments.filter(
    (e) =>
      e.course_id === a.course_id &&
      e.status === "active" &&
      !submittedIds.has(e.id) &&
      state.students.find((s) => s.id === e.student_id)?.active,
  );
  if (missing.length)
    body.append(
      el("h3", {}, "Not submitted"),
      table(
        ["Student"],
        missing.map((e) => [enrollmentName(e.id)]),
      ),
    );
  const d = modal(a.title + " · Submissions", body, true);
}
async function bulkZIP(a, files) {
  const total = files.reduce((s, f) => s + f.file.size, 0);
  if (!files.length) throw new Error("No submitted files.");
  if (total > 100 * 1048576)
    throw new Error("This ZIP exceeds 100 MB. Download files individually.");
  const JSZip = await library("JSZip"),
    zip = new JSZip();
  for (const [i, f] of files.entries()) {
    msg("Downloading " + (i + 1) + " / " + files.length + "…");
    const s = state.submissions.find((s) => s.id === f.submission_id),
      folder =
        enrollmentName(s.enrollment_id).replace(/[^a-zA-Z0-9 _-]/g, "_") +
        "-" +
        s.id.slice(0, 8);
    zip.file(
      folder + "/" + f.file.id.slice(0, 8) + "-" + f.file.name,
      await api("/files/" + f.file_id, "GET", undefined, true),
    );
  }
  download(
    await zip.generateAsync({ type: "blob", compression: "STORE" }),
    a.title.replace(/[\\/]/g, "_") + ".zip",
  );
  msg();
}
function extensionForm(parent, kind) {
  const options = state.enrollments
    .filter((e) => e.course_id === parent.course_id)
    .map((e) => ({ value: e.id, label: enrollmentName(e.id) }));
  formModal(
    "Student deadline extension",
    [
      field("enrollmentId", "Student", "select", "", options),
      field("closesAt", "New deadline ", "datetime-local"),
    ],
    (data, form, dialog) =>
      saveRefresh(
        "exceptions.save",
        { ...data, parentId: parent.id, kind, closesAt: iso(data.closesAt) },
        dialog,
      ),
  );
}
function groupControls(parentId, kind, group, hasEntry = false) {
  if (group) return help("Group connected · " + group.members + " members");
  if (hasEntry) return help("Individual submission");
  return actions(
    button("Create group", async () => {
      const r = await command("groups.create", { parentId, kind });
      modal(
        "Group invitation",
        el(
          "div",
          {},
          help(
            "Give this invitation code only to your group members. It is separate from your student sign-in code.",
          ),
          el("p", { class: "code" }, r.invitationCode),
        ),
      );
      await refresh();
    }),
    button("Join group", () =>
      formModal(
        "Join group",
        [field("code", "Group invitation code", "text")],
        (data, form, dialog) =>
          saveRefresh("groups.join", { ...data, parentId, kind }, dialog),
      ),
    ),
  );
}
function studentAssignments(view) {
  if (!state.assignments.length) {
    view.append(empty("No assignments."));
    return;
  }
  for (const a of state.assignments) {
    const s = state.submissions.find((s) => s.assignmentId === a.id),
      files = s?.files || [];
    view.append(
      panel(
        heading(a.title, badge(a.status)),
        el("p", {}, a.body),
        help(
          "Deadline: " +
            date(a.deadline) +
            " · " +
            size(a.maxFileBytes) +
            " per file · " +
            size(a.maxTotalBytes) +
            " total" +
            (a.allowLate ? " · Late work accepted" : ""),
        ),
        a.groups ? groupControls(a.id, "assignment", a.group, !!s) : null,
        files.length
          ? el(
              "div",
              { class: "list" },
              files.map((f) =>
                el(
                  "div",
                  { class: "resource" },
                  el("div", {}, el("strong", {}, f.name), help(size(f.size))),
                  actions(
                    button("View", () => openFile(f.id, f.name, f.mime)),
                    a.allowReplace && a.status === "published"
                      ? button(
                          "Remove",
                          () =>
                            confirmAction(
                              "Remove submitted file?",
                              "This file will be deleted from storage.",
                              () => saveRefresh("files.remove", { id: f.id }),
                            ),
                          "danger",
                        )
                      : null,
                  ),
                ),
              ),
            )
          : help("No files submitted."),
        a.status === "published"
          ? button("+ Submit files", () => submissionUpload(a), "primary")
          : null,
        s?.feedback || s?.grade
          ? el(
              "div",
              { class: "notice" },
              s.grade ? el("strong", {}, "Grade: " + s.grade) : null,
              el("p", {}, s.feedback),
            )
          : null,
      ),
    );
  }
}
function submissionUpload(a) {
  const f = field("files", "Choose files", "file");
  f.querySelector("input").multiple = true;
  f.querySelector("input").required = true;
  formModal(
    "Submit · " + a.title,
    [f],
    async (data, form, dialog) => {
      const p = el("progress", { max: 100, value: 0 });
      form.append(p);
      for (const file of data.files)
        await upload(file, "submission", a.id, null, (v, t) => {
          p.value = v;
          dialog.querySelector(".dialog-status").textContent = t;
        });
      dialog.close();
      await refresh();
      msg("Files submitted.", "success");
    },
    "Submit",
    "Documents, archives, images, and source code · Maximum " +
      size(a.maxFileBytes) +
      " per file / " +
      size(a.maxTotalBytes) +
      " total. Files are visible only to you, your group if applicable, and your teacher.",
  );
}
function teacherProjects(view) {
  const sheets = state.sheets.filter((s) => s.course_id === courseId);
  const addSheet = () => {
    const body = el("div", { class: "choice-list" }),
      dialog = modal("Add project table", body);
    body.append(
      button("Create a new table", () => {
        dialog.close();
        templateEditor();
      }),
      button("Import a spreadsheet", () => {
        dialog.close();
        templateImport();
      }),
      state.templates.length
        ? button("Use a saved template", () => {
            dialog.close();
            assignTemplate();
          })
        : el("span"),
    );
  };
  view.append(
    panel(
      heading(
        "Project tables",
        button("+ Add project table", addSheet, "primary"),
      ),
      sheets.length
        ? sheets.map((s) =>
            el(
              "div",
              { class: "resource" },
              el(
                "div",
                {},
                el("strong", {}, s.title),
                visibilityBadge(s),
                s.closes_at ? help("Closes: " + date(s.closes_at)) : null,
              ),
              actions(
                button("Open table", () => openSheet(s.id)),
                moreActions("Table options", [
                  { label: "Visibility & deadlines", run: () => sheetForm(s) },
                  {
                    label: "Give a student an extension",
                    run: () => extensionForm(s, "sheet"),
                  },
                ]),
              ),
            ),
          )
        : empty("No project tables yet."),
    ),
  );
  if (state.templates.length)
    view.append(
      el(
        "details",
        { class: "settings-section" },
        el("summary", {}, "Saved templates"),
        el(
          "div",
          { class: "settings-section-body" },
          state.templates.map((t) =>
            el(
              "div",
              { class: "resource" },
              t.title,
              moreActions("Template options", [
                {
                  label: "Edit template columns",
                  run: () => templateEditor(t),
                },
                t.original_file_id
                  ? {
                      label: "Download original file",
                      run: () =>
                        downloadFile(t.original_file_id, t.title + ".xlsx"),
                    }
                  : null,
              ]),
            ),
          ),
        ),
      ),
    );
}

function templateEditor(template, initialColumns, originalFile) {
  const rows = [],
    list = el("div");
  const body = el("form"),
    title = field(
      "title",
      "Template title",
      "text",
      template?.title || originalFile?.name.replace(/\.[^.]+$/, "") || "",
    );
  body.append(title);
  const add = (definition = {}) => {
    const controls = {
      id: definition.id || "col_" + crypto.randomUUID().replaceAll("-", ""),
      label: field("label", "Column name", "text", definition.label || ""),
      type: field(
        "type",
        "Type",
        "select",
        definition.type || "text",
        ["text", "number", "date", "select"].map((v) => ({
          value: v,
          label: v,
        })),
      ),
      protected: field(
        "protected",
        "Teacher edits only",
        "check",
        definition.protected,
      ),
      teacherOnly: field(
        "teacherOnly",
        "Visible only to teacher",
        "check",
        definition.teacherOnly,
      ),
      options: field(
        "options",
        "Choices, separated by commas",
        "text",
        (definition.options || []).join(", "),
      ),
    };
    const card = panel(
      el(
        "div",
        { class: "form-grid" },
        controls.label,
        controls.type,
        controls.protected,
        controls.teacherOnly,
      ),
      controls.options,
    );
    card.append(
      button(
        "Remove column",
        () => {
          rows.splice(rows.indexOf(controls), 1);
          card.remove();
        },
        "danger small",
      ),
    );
    rows.push(controls);
    list.append(card);
  };
  (template
    ? JSON.parse(template.columns_json)
    : initialColumns || [
        { id: "student_name", label: "Student name", protected: true },
        { id: "topic", label: "Project topic" },
        { id: "description", label: "Description" },
      ]
  ).forEach(add);
  body.append(
    list,
    actions(
      button("+ Add column", () => add()),
      el("button", { type: "submit", class: "button" }, "Save template"),
    ),
  );
  const d = modal(template ? "Edit template" : "Create template", body, true);
  body.addEventListener("submit", (e) => {
    e.preventDefault();
    run(async () => {
      const columns = rows.map((r) => ({
        id: r.id,
        label: r.label.querySelector("input").value,
        type: r.type.querySelector("select").value,
        protected: r.protected.querySelector("input").checked,
        teacherOnly: r.teacherOnly.querySelector("input").checked,
        options: r.options
          .querySelector("input")
          .value.split(",")
          .map((v) => v.trim())
          .filter(Boolean),
      }));
      const result = await command("templates.save", {
        id: template?.id,
        title: title.querySelector("input").value,
        columns,
      });
      if (originalFile) {
        await upload(originalFile, "template", result.id, null, (v, t) => {
          d.querySelector(".dialog-status").textContent = t + " " + v + "%";
        });
      }
      if (!template && courseId)
        await command("sheets.assign", {
          templateId: result.id,
          yearId,
          courseIds: [courseId],
        });
      d.close();
      await refresh();
      msg(template ? "Template saved." : "Project table created.", "success");
    });
  });
}
function templateImport() {
  const f = field("file", "Template file", "file");
  f.querySelector("input").accept = ".xlsx,.csv";
  f.querySelector("input").required = true;
  formModal(
    "Import template",
    [f],
    async (data, form, dialog) => {
      const file = data.file[0],
        rows = await readRows(file);
      const headers = rows[0]?.filter(Boolean);
      if (!headers?.length)
        throw new Error("Add column names to the first row.");
      const defs = headers.map((label, i) => ({
        id: "column_" + i,
        label: String(label),
      }));
      dialog.close();
      templateEditor(null, defs, file);
    },
    "Preview columns",
    "The first row supplies column names. Formulas and macros are not imported. The original file is preserved privately.",
  );
}
function assignTemplate() {
  formModal(
    "Assign template",
    [
      field(
        "templateId",
        "Template",
        "select",
        "",
        state.templates.map((t) => ({ value: t.id, label: t.title })),
      ),
      field(
        "courseIds",
        "Courses (choose one or more)",
        "multi",
        courseId ? [courseId] : [],
        courseOptions(),
      ),
    ],
    (data, form, dialog) =>
      saveRefresh("sheets.assign", { ...data, yearId }, dialog),
    "Assign",
    "Each course and year receives an independent copy, initially hidden.",
  );
}
function sheetForm(s) {
  formModal(
    "Project sheet settings",
    [
      field("title", "Title", "text", s.title),
      field("status", "Visibility", "select", s.status, [
        { value: "hidden", label: "Hidden" },
        { value: "published", label: "Published" },
      ]),
      field(
        "opensAt",
        "Editing opens",
        "datetime-local",
        localDate(s.opens_at),
      ),
      field(
        "closesAt",
        "Editing closes",
        "datetime-local",
        localDate(s.closes_at),
      ),
    ],
    (data, form, dialog) =>
      saveRefresh(
        "sheets.save",
        {
          ...data,
          id: s.id,
          opensAt: iso(data.opensAt),
          closesAt: iso(data.closesAt),
        },
        dialog,
      ),
  );
}
async function openSheet(id) {
  const data = await api("/sheets/" + id),
    body = el("div"),
    columns = data.sheet.columns;
  const redraw = async () => {
    dialog.close();
    await openSheet(id);
  };
  const entries = data.entries;
  const controls = teacher
    ? actions(
        button("+ Add row", () => entryForm(null)),
        button("Export XLSX", () =>
          spreadsheet(
            ["Student / group owner", ...columns.map((c) => c.label)],
            entries
              .filter((e) => !e.deleted)
              .map((e) => [
                e.ownerName,
                ...columns.map((c) => e.values[c.id] || ""),
              ]),
            data.sheet.title,
          ),
        ),
      )
    : el(
        "div",
        {},
        groupControls(
          id,
          "sheet",
          data.group,
          entries.some((e) => e.canEdit),
        ),
        data.canEdit && !entries.some((e) => e.canEdit)
          ? button("+ Add my project", () => entryForm(null), "primary")
          : null,
      );
  body.append(
    help("Editing closes: " + date(data.sheet.closes_at)),
    controls,
    entries.length
      ? table(
          ["Student / group owner", ...columns.map((c) => c.label), "Actions"],
          entries.map((e) => [
            e.ownerName + (e.deleted ? " · Removed" : ""),
            ...columns.map((c) =>
              el("div", { class: "sheet-cell" }, e.values[c.id] || ""),
            ),
            actions(
              (teacher || (data.canEdit && e.canEdit)) && !e.deleted
                ? button("Edit", () => entryForm(e), "secondary small")
                : null,
              (teacher || (data.canEdit && e.canEdit)) && !e.deleted
                ? button(
                    "Remove",
                    () =>
                      confirmAction(
                        "Remove project row?",
                        "The revision history is kept for your teacher.",
                        async () => {
                          await command("projects.delete", {
                            id: e.id,
                            sheetId: id,
                            revision: e.revision,
                          });
                          await redraw();
                        },
                      ),
                    "danger small",
                  )
                : null,
              teacher
                ? button(
                    "History / restore",
                    () => historyView(e),
                    "secondary small",
                  )
                : null,
            ),
          ]),
        )
      : empty("No projects entered."),
  );
  const dialog = modal(data.sheet.title, body, true);
  function entryForm(entry) {
    const defs = columns.filter(
        (c) => teacher || (!c.protected && !c.teacherOnly),
      ),
      fields = defs.map((c) =>
        field(
          c.id,
          c.label,
          c.type === "select"
            ? "select"
            : c.type === "number"
              ? "number"
              : c.type === "date"
                ? "date"
                : "textarea",
          entry?.values[c.id] || "",
          c.options.map((v) => ({ value: v, label: v })),
        ),
      );
    if (teacher && !entry)
      fields.unshift(
        field(
          "enrollmentId",
          "Student / group owner",
          "select",
          "",
          state.enrollments
            .filter((e) => e.course_id === data.sheet.course_id)
            .map((e) => ({ value: e.id, label: enrollmentName(e.id) })),
        ),
      );
    formModal("Project row", fields, async (values, form, d) => {
      await command("projects.save", {
        id: entry?.id,
        sheetId: id,
        revision: entry?.revision,
        enrollmentId: values.enrollmentId,
        values,
      });
      d.close();
      await redraw();
    });
  }
  async function historyView(entry) {
    const h = await api("/project-history/" + entry.id);
    const d = modal(
      "Revision history",
      table(
        ["Revision", "Saved", "Changes", ""],
        h.history.map((r) => [
          r.revision,
          date(r.created),
          el(
            "div",
            {},
            Object.entries(JSON.parse(r.after_json).values).map(
              ([key, value]) =>
                el(
                  "p",
                  {},
                  (columns.find((c) => c.id === key)?.label || key) +
                    ": " +
                    value,
                ),
            ),
          ),
          button("Restore", async () => {
            await command("projects.restore", {
              id: entry.id,
              sheetId: id,
              revision: entry.revision,
              historyId: r.id,
            });
            d.close();
            await redraw();
          }),
        ]),
      ),
      true,
    );
  }
}
function studentProjects(view) {
  view.append(
    ...(state.sheets.length
      ? state.sheets.map((s) =>
          panel(
            heading(
              s.title,
              button("Open project table", () => openSheet(s.id), "primary"),
            ),
            help("Closes: " + date(s.closesAt)),
          ),
        )
      : [empty("No project sheets.")]),
  );
}
async function teacherSettings(view) {
  const section = (title, ...content) =>
    el(
      "details",
      { class: "settings-section" },
      el("summary", {}, title),
      el("div", { class: "settings-section-body" }, ...content),
    );
  const browseYear = field(
    "year",
    "View courses for academic year",
    "select",
    yearId,
    yearOptions(),
  );
  browseYear.querySelector("select").addEventListener("change", (e) =>
    run(async () => {
      yearId = e.target.value;
      courseId = null;
      chapterId = null;
      teacherView = "home";
      await refresh();
      history.pushState({}, "", "#courses");
    }),
  );
  view.append(
    section(
      "Academic years",
      browseYear,
      button("+ Add year", () =>
        formModal(
          "Academic year",
          [
            field("label", "Year label", "text"),
            field("starts", "Start date", "date"),
          ],
          (data, form, d) => saveRefresh("years.save", data, d),
        ),
      ),
      table(
        ["Year", "Status", ""],
        state.years.map((y) => [
          y.label,
          badge(y.active ? "active" : "inactive"),
          !y.active
            ? button("Make active", () =>
                confirmAction(
                  "Activate " + y.label + "?",
                  "Students from other years will lose access. Historical records are preserved.",
                  () => saveRefresh("years.activate", { id: y.id }),
                ),
              )
            : null,
        ]),
      ),
    ),
  );
  view.append(
    section(
      "Attendance rules",
      button("Edit rules", () =>
        formModal(
          "Attendance rules",
          [
            field("timezone", "Time zone", "text", state.settings.timezone),
            field(
              "lateWeight",
              "Late arrival counts as",
              "select",
              String(state.settings.lateWeight),
              [
                { value: "1", label: "Present (100%)" },
                { value: "0.5", label: "Half (50%)" },
                { value: "0", label: "Absent (0%)" },
              ],
            ),
            field(
              "excused",
              "Excused absence",
              "select",
              state.settings.excused,
              [
                { value: "exclude", label: "Exclude from calculation" },
                { value: "present", label: "Count as present" },
                { value: "absent", label: "Count as absent" },
              ],
            ),
          ],
          (data, form, d) => saveRefresh("settings.save", data, d),
        ),
      ),
    ),
  );
  const storage = el("div", {}, help("Loading storage status…"));
  view.append(section("File storage", storage));
  view.append(
    section(
      "Export classroom data",
      help("This download contains private student records. Keep it private."),
      button("Download classroom data", async () =>
        jsonDownload(
          await api("/export"),
          "tasnim-classroom-private-export.json",
        ),
      ),
    ),
  );
  view.append(
    section("Other actions", button("Refresh classroom data", refresh)),
  );
  try {
    const connection = await api("/storage");
    if (!storage.isConnected) return;
    const ownerSetup = () =>
      formModal(
        "Google Drive app setup",
        [
          field(
            "clientId",
            "Google OAuth client ID",
            "text",
            connection.clientId,
          ),
          field("clientSecret", "Client secret", "password"),
        ],
        async (data, form, d) => {
          await api("/storage/google-drive/configure", "POST", data);
          form.querySelector("input[type=password]").value = "";
          d.close();
          await refresh();
        },
        "Save securely",
        "Owner setup only. Credentials are encrypted on the server.",
      );
    const owner = section(
      "Owner connection settings",
      button(
        connection.connected
          ? "Reconnect Google Drive"
          : "Connect Google Drive",
        async () => {
          const result = await api("/storage/google-drive/start", "POST", {});
          location.assign(result.url);
        },
      ),
      button("Test connection", async () => {
        const check = await api("/storage/test", "POST", {});
        if (!check.verified) throw new Error("Storage verification failed.");
        msg("Storage connection verified.", "success");
      }),
      button("Owner app setup", ownerSetup),
    );
    storage.replaceChildren(
      badge(connection.connected ? "Connected" : "Not connected"),
      connection.quota
        ? help(
            "Storage used: " +
              size(Number(connection.quota.usage || 0)) +
              (connection.quota.limit
                ? " / " + size(Number(connection.quota.limit))
                : ""),
          )
        : el("span"),
      owner,
    );
  } catch (e) {
    storage.replaceChildren(help(e.message));
  }
}

login();
