# Verification: private classroom prototype

Checked 30 October 2026.

- Students: https://tasnim-hamdeni.github.io/
- Teacher: https://tasnim-hamdeni.github.io/tasnim/
- Application source baseline: 8d631547996bf4dacb46b7877e693a620e0dd7dc; the final source ZIP also includes readable GB/TB storage-quota units.
- GitHub Pages build: 41036989944, succeeded.
- Backend source: 0ff85924d5609f5390c65e23e113d000a76debb7
- Backend deployment: appgdep_6ae467913c9881919a5b8ecd2f92d3c6, succeeded.

## Preservation

The connected GitHub identity was verified as tasnim-hamdeni (ID 281890898). Changes use only the classroom website repository and the existing backend Site. Neither the unrelated GitHub account nor the IMST Parents Google project was changed. Immutable pre-upgrade website and lesson-data archives were saved locally before deployment.

The existing 3 courses, 10 chapters and 19 documents were imported idempotently into D1, preserving the owner's added Statistics chapter/document. The public data repository was not overwritten. Historical public copies remain public, including Git history; new uploads use private Google Drive storage. No fake student records or teaching uploads were added to production.

## Automated verification

31 frontend/catalog/DOM/PDF tests pass. Coverage includes the retained public library, file validation, catalog concurrency, publication failures, literal HTML titles, the new teacher/student portal, course creation, project cards, announcements, asynchronous buttons, logout races and PDF rendering.

16 backend/authentication/SQL integration tests pass. They exercise actual SQLite migrations through a D1-compatible test adapter. Coverage includes teacher ownership, cross-course/student download denial, code hashing and revocation, year activation, hidden/scheduled resources, attendance revisions and private reports, project row ownership, teacher-only fields, deadlines, stale-save rejection, history/restore, group membership, confirmed/failed file uploads and credential-free exports.

A 500-student import and a 200-row shared sheet use bounded database calls. These checks are not a load test of hundreds of simultaneous production visitors.

## Browser and live checks

The live student and teacher URLs were opened in the browser. Teacher sign-in loads the preserved courses. PDF View renders inside the classroom with page navigation/download controls rather than opening a GitHub page. Public deployment checks confirm 21 runtime files match delivered source; the historical public catalog remains valid with 3/10/19 records.

In a disposable local SQLite classroom, an independent student browser signed in, opened the assigned project sheet, entered a topic and saved it. The saved row appears, while the teacher-only grade column is absent. Earlier browser checks created a student and displayed its one-time code. These fixtures were local only.

Google's separate Tasnim Classroom project was created under the account selected by the owner. The owner approved the required policy, credential creation, production status and narrow Drive permission. The OAuth secret was transferred in memory directly into the owner form and encrypted on the backend. It is not in source, logs or the ZIP. Google app production status avoids the seven-day testing refresh-token lifetime.

A live backend check uploaded a temporary non-lesson file to Google Drive, downloaded it, compared its exact bytes and confirmed deletion. No catalog records changed. The database rejects unauthenticated access; the verification session was revoked. Private lesson/submission upload flows were additionally tested with a controlled provider adapter; no production student enrollment was created for testing.

## Practical limits

This is a temporary test version. Email, annual scheduling/renewal/template-copy/deletion/reminders and daily backups remain disabled as agreed. Complex Excel formulas/macros/formatting, a dedicated malware scanner, multi-teacher signup and PHP/MySQL hosting are not implemented. Native project sheets have basic values and refresh-based sharing.

Per-file upload limit is 50 MB; assignment totals are configurable up to 200 MB. Browser ZIP export is capped at 100 MB. Drive capacity and hosting/database quotas apply. Course/chapter/resource removal archives/hides content and preserves files; submission-file removal calls Drive's delete API. Provider recovery retention remains outside the app's control.

The source includes a reviewed migration plan, API contract, portable data model and generated MySQL 8 preparation schema. The MySQL schema has not been deployed. Production private records, runtime credentials and dependencies are excluded from the release ZIP.

## Next use

No further owner technical setup is required. Tasnim adds/imports students, privately distributes their codes, uploads documents and publishes the intended chapters/resources.
