# Tasnim Classroom

- Students: https://tasnim-hamdeni.github.io/
- Tasnim: https://tasnim-hamdeni.github.io/tasnim/
- Website repository: https://github.com/tasnim-hamdeni/tasnim-hamdeni.github.io
- Historical public lessons: https://github.com/tasnim-hamdeni/tasnim-lesson-data
- Backend: https://tasnim-classroom-service.chamseddine.chatgpt.site/

## Everyday use

Tasnim opens her teacher URL and enters her existing private teacher code. Normal teaching requires no GitHub token or Google sign-in.

Start at **My courses**. Open a course, open a chapter, then choose **Upload document**. Open **Students & activities** inside a course for its student and teaching tools. Secondary actions are inside **Course options**, **Chapter options**, and the relevant item options. Settings stays separate.

1. **Courses:** add chapters, upload PDF/PPTX documents, then publish the intended chapter and documents. New chapters/documents start hidden. Scheduled publishing is available. Course removal archives it; archived courses can be restored. Chapter/document removal hides content and preserves stored files for history/export.
2. **Students:** add individually or import CSV/XLSX with First name, Last name, Email headers. Preview before saving. Save newly issued codes privately and give each student only their own code. Search, transfer, deactivate, export and regenerate codes here. Each student has one course per academic year.
3. **Announcements:** draft, target courses, publish/schedule, attach files and see read counts. Email delivery is off.
4. **Attendance:** create a session, mark the roster, save a draft or finalize. Students see only their own finalized records. Export XLSX or Print / Save as PDF. Settings controls calculation and timezone.
5. **Assignments:** set deadlines, file limits, group/individual rules, replacement and late-work options. Review submitted/missing work, private files, feedback/grades and ZIP downloads.
6. **Projects:** choose Add project table, create/import a table or reuse a saved template, then publish and set deadlines/extensions. New tables are assigned to the selected course automatically; master templates remain reusable. Protected/teacher-only fields, revision checks, history and teacher restore are supported. Refresh to see classmates' saved changes.
7. **Settings:** academic years, attendance policy, storage status and private database export. Technical owner connection controls are collapsed separately.

Students enter their personal code at the student URL. The assigned course opens directly. Sessions remain in page memory and expire after eight hours. Refreshing requires sign-in again. The backend checks enrollment, active year, deactivation and code version on every request.

## Current setup

GitHub Pages serves the frontend. Private D1 records store student information and code/session hashes. Google Drive is connected with permission limited to app-created/selected files. OAuth credentials are encrypted on the backend. No further technical setup is required for Tasnim to add students and resources.

The existing **3 courses, 10 chapters and 19 documents** were imported without deleting GitHub content. Historical GitHub files remain public through original URLs/history. New private uploads do not enter GitHub. The historical public library remains at /public-resources.html. The ZIP's legacy starter PDFs are labeled examples; never replace the live catalog with that starter catalog.

The short teacher code is a test-version choice; stronger teacher authentication is needed before wider production use. Student codes have 100 bits of randomness and are stored only as normalized SHA-256 hashes. Never commit private codes, credentials, exports or student submissions.

## Limits and deferred work

- 50 MB maximum per file. Assignments default to 10 MB/file and 50 MB total; configurable up to 50 MB/file and 200 MB total. Browser ZIP export: 100 MB.
- Spreadsheet import: 10 MB, up to 500 students per import. Native project tables support basic values; arbitrary Excel formulas, macros and formatting are not reproduced. Original templates are retained privately.
- Drive capacity is the selected account's remaining quota, shown in Settings. Hosting/database quotas may temporarily limit service. Hundreds of simultaneous students have not been load-tested.
- No dedicated malware scanner. The backend does not execute uploaded files; treat downloaded submissions as untrusted.
- Email delivery, yearly renewal/template-copy/deletion schedules/reminders and daily backups are disabled, as agreed for this test. Years and code changes are manual. Retention flags do not perform deletion.
- Removing a submission file uses Drive's delete API; provider recovery copies may persist. Course/chapter/resource removal archives or hides content and does not reclaim storage.

## Source and maintenance

The complete ZIP includes site/, teacher-service/, tests, scripts, documentation and labeled legacy examples. It excludes credentials, production private records, Git metadata, dependencies and local artifacts. PDF.js, ExcelJS and JSZip licenses are included.

Use Node 24 for backend tests and local SQLite preview. Run npm ci in the source root, npm test, then node --test teacher-service/service.test.mjs teacher-service/tests/lms.test.mjs. Start a disposable local classroom with node scripts/preview-classroom.mjs; printed codes are local fixtures only.

The frontend deployment script uses GitHub CLI and refuses the wrong owner or unrelated repositories. It preserves existing lesson data and uploads binary assets correctly. Backend publishing uses the existing Sites project appgprj_6adfc4042d208191a3dc6e62b114910c and additive migrations. Runtime ACCESS_CODE and TOKEN_KEY values are configured privately, never in files. Google owner setup is complete; its app is in production status to avoid seven-day testing refresh-token expiry. Revocation may require reconnection.

For the optional historical GitHub owner connection only: create a fine-grained token in GitHub Settings > Developer settings > Fine-grained tokens. Select only tasnim-lesson-data and Contents read/write. Enter it directly in the legacy private owner setup form, never in chat or source. Tasnim's current daily workflow does not use it.

See docs/API.md and docs/MIGRATION.md for the API, ownership model, storage/auth boundaries, free-tier constraints and later PHP/MySQL migration. PHP/MySQL hosting and multi-teacher signup remain future work; current backend records and authorization already carry teacher ownership.
