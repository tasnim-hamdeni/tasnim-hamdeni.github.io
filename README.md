# Tasnim Hamdeni · Resource room

Students: https://tasnim-hamdeni.github.io/

Teacher: https://tasnim-hamdeni.github.io/tasnim/

Website repository: https://github.com/tasnim-hamdeni/tasnim-hamdeni.github.io

Public catalog and documents: https://github.com/tasnim-hamdeni/tasnim-lesson-data

## Student experience

The top menu lists subjects from the public catalog. Selecting a subject shows its chapters and resources, with a chapter index, subject search, file-type filter, View and Download controls. Each subject has a shareable URL. The layout adapts to phones and computers.

AI, Statistics and Algebra include example chapters and blank PDFs explicitly requested by the owner. Example files are labeled. They are layout examples, not teaching material, and can be removed through the teacher page.

The organization takes inspiration from topic collections on 3Blue1Brown and ordered resources on StatQuest; no course content was copied:

- https://www.3blue1brown.com/?topic=linear-algebra
- https://statquest.org/video_index.html

## Tasnim’s tools

Open the teacher URL and enter the privately supplied access code. Add a subject, add chapters inside it, and upload PDF or PPTX documents (maximum 50 MB / 50 MiB). New subjects automatically appear in the student menu. Refresh the student page after publishing; GitHub’s public cache can take a few minutes.

Delete a document after confirmation. Delete a chapter after removing its documents, and delete a subject after removing its chapters. Occupied parents are protected against accidental deletion.

Tasnim does not need a GitHub token or email/password login. Sessions remain only in page memory, expire after 8 hours and are revoked on sign-out. Failed code attempts are rate-limited. The access code is never embedded in source or this ZIP.

All subjects, titles and documents are public. Never upload private student information. Removed content may remain in Git history, caches and downloaded copies.

## Owner connection

Owner setup: https://tasnim-classroom-service.beigepear256.chatgpt.site/

The owner connects storage once. Sign in with the access code and enter an expiring fine-grained GitHub token restricted to tasnim-hamdeni/tasnim-lesson-data, Contents: Read and write. Metadata read access is automatic. Leave other permissions unset. Enter credentials only on the owner form, never in chat or source files. Reconnect there when a credential expires or is replaced.

The service encrypts the repository credential in its server database and never returns it to browsers. Only fixed publishing routes to the lesson-data repository are permitted. ACCESS_CODE and TOKEN_KEY are secret runtime settings in the service hosting platform. Keep its .openai/hosting.json project_id unchanged.

## Source, hosting and checks

GitHub Pages publishes site/ files from the website repository’s main branch, root folder, with no custom domain. /admin.html forwards to /tasnim/. teacher-service/ contains the deployed authentication/publishing service.

catalog.json stores subjects, chapters and document metadata (the document array is named lessons for compatibility). Documents use documents/<subject-id>/<chapter-id>/<unique-id>.pdf or .pptx. Uploads commit documents and catalog together. Concurrent updates are merged without forcing the branch; deleted parents cancel conflicting uploads. Version 1 catalogs migrate safely without changing existing document paths.

The lesson-data folder in the ZIP contains only the requested examples. Never overwrite a live catalog with this starter after Tasnim begins adding her own content.

- npm ci, then npm test: website/catalog/DOM checks.
- npm run preview: local student and teacher layout preview.
- With Node.js 22.13+: node --test teacher-service/service.test.mjs checks server authentication and proxy safety.
- node scripts/verify-public.mjs compares public files and validates the catalog.
- node scripts/verify-public-dom.mjs checks deployed modules in a DOM emulator.
- python scripts/package-source.py rebuilds the source ZIP and scans for credentials.

See TEST-REPORT.md and deployment-status.json for verification evidence.
