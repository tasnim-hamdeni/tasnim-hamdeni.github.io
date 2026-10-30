# Later PHP / MySQL migration

This is a temporary single-teacher deployment with multi-teacher ownership already enforced. phpMyAdmin will administer the future MySQL database; it is not the database engine. No PHP server or MySQL deployment is included yet.

## Boundaries to preserve

- Frontend: plain HTML/CSS/JavaScript; only the API base in `site/config.js` needs changing when hosting moves.
- Transport: `/api/lms/*`, JSON commands and authenticated binary file endpoints in `lms-api.mjs`.
- Domain rules: courses/students, academics, projects, and assignments/files are separate modules. Port these rules and their authorization tests, not just the tables.
- Database: `Repository` wraps SQL access. `db/lms-model.mjs` defines portable IDs, columns, ownership, and indexes. D1-specific SQL (`INSERT OR IGNORE`, `ON CONFLICT`, D1 batches) must become MySQL `INSERT IGNORE` / `ON DUPLICATE KEY UPDATE` / transactions. Never translate SQL using untrusted string concatenation.
- Storage: Google Drive reads/writes are in their own adapter. File records contain provider plus a private storage key. The frontend never receives provider credentials or direct private download URLs.
- Authentication: future stronger teacher accounts can replace the code check without changing resource ownership. Existing long student codes are normalized by removing spaces/hyphens and uppercasing, then SHA-256 hashed. Import hashes directly; never try to recover plaintext codes. Revoke all sessions during migration.

Every owned row has `teacher_id`. Every query and file action must continue checking it. A second teacher requires a teacher record, authentication provisioning, its own settings/storage connection, and its own years/enrollments. A public self-registration or super-admin interface is intentionally not enabled in this Tasnim-only test.

## Transfer procedure

1. Choose a maintenance window and stop writes.
2. Teacher → Settings → Export database JSON. Store it privately. It contains student information and access-code hashes, never OAuth secrets or session tokens.
3. Download teacher resources and student submissions separately. Keep immutable file IDs and a manifest of ID, size, MIME, owner/year/course/parent. Verify byte sizes and checksums after transfer.
4. Review `schema-mysql8.sql` (generated with `node scripts/generate-mysql-schema.mjs`), then create MySQL 8 tables using prepared statements and transactions. This preparation schema has not been deployed. Use utf8mb4, stable string IDs, BIGINT timestamps/byte counts where appropriate, unique enrollment `(student_id, year_id)`, and all ownership indexes. Add foreign keys after validating legacy rows.
5. Import rows without changing IDs; check row counts by teacher/year and relationships. Do not import live sessions or OAuth states. Provision fresh server credentials outside source control. Reconnect Drive if still used, or implement private filesystem/object storage.
6. Run the integration tests against the new repository adapter: two teachers, two students, hidden/scheduled resources, cross-course downloads, group ownership, deadlines/extensions, attendance calculation, concurrent edits/history/restore, failed uploads, and code revocation.
7. Change the API base, deploy, and verify on a separate device before ending maintenance. Preserve a rollback copy until records/files are verified.

## Features intentionally deferred

Email delivery awaits a sender/domain/provider decision. Annual renewal, automatic template copies, deletion schedules, reminders, and deletion reports must be implemented as idempotent backend jobs before enabling annual automation. No yearly schedule currently runs. A retention flag alone does not perform deletion.

When scheduled deletion is added, target only eligible previous-year student files, respect retention exceptions, confirm provider deletion before removing references, retry safely, and record actual reclaimed bytes. Never include permanent teacher resources or current-year files. Document provider backup/recovery retention; do not claim immediate erasure from every backup.

Native project tables preserve basic values, ownership, history, and independent class/year copies. Arbitrary Excel formulas, macros, formatting, or real-time cursor collaboration are not implemented. The original XLSX template is retained as a separate private file. Students refresh the table to see classmates’ latest saved values.

## Test-version limits

Google Drive capacity is the selected account’s remaining quota, shared with its other Google services. The Settings page displays the quota returned by Google. Per-file limit is 50 MB; assignments default to 10 MB/file and 50 MB total, configurable up to 50 MB/file and 200 MB total. Browser ZIP export is limited to 100 MB; larger submissions remain individually downloadable. Spreadsheet imports accept 10 MB files and at most 500 students per confirmed import.

D1/Worker free tiers have daily and per-request limits. Standard D1 Free currently documents 5 million rows read/day, 100,000 rows written/day, 500 MB/database, 100 bound parameters/query, and 50 database API calls/invocation. Sites manages the actual runtime; these figures are not a capacity guarantee for its managed service. Indexes and bounded query counts reduce load, but hundreds of students still need real usage monitoring and load testing. Reaching provider limits can temporarily block service without deleting stored records.

New files are private; historical GitHub files remain public through their original URLs and repository history. Uploaded files are never executed by this backend. PDF/PPTX resources receive extension/type/signature checks; there is no dedicated malware scanning service. Treat downloaded submissions as untrusted files. Removing a course/chapter/resource archives/hides it; it does not reclaim Drive storage. Removing a submission file uses Drive’s permanent-delete API; provider recovery copies may outlive that API deletion.

References: [D1 limits](https://developers.cloudflare.com/d1/platform/limits/), [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/), [Drive scopes](https://developers.google.com/workspace/drive/api/guides/api-specific-auth), [Google refresh-token behavior](https://developers.google.com/identity/protocols/oauth2).
