# Classroom API contract (version 1)

Base: `https://tasnim-classroom-service.chamseddine.chatgpt.site/api/lms`.
All private requests use `Authorization: Bearer <session>` in headers, never URLs. JSON bodies require `Content-Type: application/json`. Errors return `{ "error": "message" }` with 400/401/403/404/409/413/415/429/500/502/503 as appropriate. Responses are not cached. Allowed browser origin is the published GitHub Pages site (plus the service itself).

| Route | Role / behavior |
| --- | --- |
| POST `/session` | `{role:"teacher",teacher:"tasnim",code}` or `{role:"student",code}`. Returns a memory-only session. |
| DELETE `/session` | Revoke current session. |
| GET `/state?yearId=` | Teacher dashboard; no plaintext student codes. |
| GET `/student` | Student’s own enrollment/course/year, published resources, announcements, own attendance/submissions, assigned sheets. |
| GET `/preview?courseId=` | Teacher’s published-course preview. |
| POST `/command` | `{action,...fields}`; domain validation and role/ownership checks on server. |
| GET `/attendance/:id` | Teacher roster. |
| GET `/attendance-report?yearId=&courseId=&from=&to=` | Teacher report; students always receive only their own finalized records. |
| GET `/sheets/:id` | Authorized class table; teacher-only columns omitted for students. |
| GET `/project-history/:entryId` | Teacher only. |
| POST `/uploads` | Reserve upload metadata `{category,parentId,name,mime,size}` after permission/deadline/quota validation. |
| PUT `/uploads/:id?title=` | Raw streamed bytes. Only confirmed storage writes become ready; failed uploads never publish documents. Title is non-secret text. |
| GET `/files/:id` | Authorized binary response. `?inline=1` is permitted for PDF; the website uses its own PDF reader. |
| GET `/storage` | Teacher-only connection/quota status, never credentials. |
| POST `/storage/test` | Teacher-only real upload/read/delete round trip using a temporary non-lesson file. Does not alter the course catalog. |
| POST `/storage/google-drive/configure` | Owner-only OAuth client setup; AES-GCM encrypted at rest. |
| POST `/storage/google-drive/start` | Teacher-only OAuth authorization URL with PKCE and short-lived one-use state. |
| GET `/storage/google-drive/callback` | Consumes OAuth state, exchanges code server-side, creates private app folder. |
| POST `/import-legacy` | Teacher-only idempotent import from existing public catalog. Existing records are never overwritten. |
| GET `/export` | Teacher-only private portable JSON; excludes OAuth settings, OAuth states, and sessions. |

Commands: `courses.save/archive/duplicate`, `chapters.save/delete/reorder`, `documents.save/delete`, `students.preview/import/save/deactivate/code/renew-codes`, `years.save/activate`, `settings.save`, `announcements.save/delete/read`, `attendance.create/save`, `assignments.save`, `submissions.feedback`, `templates.save`, `sheets.assign/save`, `projects.save/delete/restore`, `exceptions.save`, `groups.create/join`, `files.remove`.

Attendance/project writes require the last read `revision`; a stale save receives 409 rather than overwriting another writer. Group invitations are separate random codes, hashed at rest, scoped to one activity/course/year. A student can join only one group per activity. Student code regeneration increments the enrollment’s code version, invalidating earlier sessions immediately.
