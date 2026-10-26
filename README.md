# Tasnim Hamdeni

Students: https://tasnim-hamdeni.github.io/

Tasnim: https://tasnim-hamdeni.github.io/tasnim/

Website source: https://github.com/tasnim-hamdeni/tasnim-hamdeni.github.io

Public lessons: https://github.com/tasnim-hamdeni/tasnim-lesson-data

## Tasnim’s everyday use

Open the teacher URL and enter the access code supplied privately by the site owner. Add a subject, add a chapter, then upload PDF or PPTX documents (up to 50 MB / 50 MiB). Students refresh their website to see new content. GitHub caching may take a few minutes.

Tasnim does not need a GitHub token or email/password login. Sign out when finished. Sessions stay only in page memory and expire after 8 hours. Failed code attempts are rate-limited. The code is never embedded in the website or this ZIP.

A chapter can contain multiple documents. Remove documents before removing their chapter; remove chapters before removing their subject. Removal asks for confirmation.

## One-time owner setup

Service and owner setup: https://tasnim-classroom-service.beigepear256.chatgpt.site/

The site owner connects storage once on that page; this is separate from Tasnim’s everyday screen:

1. Enter the access code on the owner setup page.
2. Sign in to GitHub as tasnim-hamdeni and create an expiring fine-grained token at https://github.com/settings/personal-access-tokens/new.
3. Resource owner: tasnim-hamdeni. Select only tasnim-lesson-data. Grant Contents: Read and write; leave other permissions unset. Metadata read access is automatic.
4. Enter the token directly in the owner setup form and choose Connect storage. Never send it in chat or put it in source files.

The credential is encrypted on the server with a secret runtime key. It is never sent to Tasnim’s browser or included in the ZIP. If it expires, the owner reconnects storage on the same page. The owner changes the access code using the service’s ACCESS_CODE runtime secret and redeploys.

**All catalog information and uploaded documents are public. Never upload private student information.** Git history, downloads and caches may retain removed files.

## Hosting and data

The student and teacher pages are plain HTML/CSS/JavaScript on GitHub Pages, published from the website repository’s main branch, root folder, without a custom domain. /admin.html forwards to /tasnim/.

The separate service authenticates access codes, issues temporary sessions and forwards only the permitted GitHub publishing operations to the single lesson-data repository. It cannot publish to other repositories. The service’s D1 database holds session digests, rate-limit counters and the encrypted repository connection; lesson content stays in GitHub.

catalog.json stores subjects, chapters and documents (the document array is named lessons for compatibility). New files use documents/<subject-id>/<chapter-id>/<unique-id>.pdf or .pptx. Uploads commit file and catalog changes together, and retry concurrent updates without forcing the branch. Removed parents cancel conflicting uploads.

Version 1 catalogs upgrade safely: existing documents appear in a General chapter and retain their file paths. Never replace an existing live catalog with the empty ZIP starter.

## Source and checks

site/ contains the GitHub Pages website. teacher-service/ contains the authentication service and its hosting manifest. Keep its project_id unchanged. Runtime secrets ACCESS_CODE and TOKEN_KEY are configured in hosting, never in source.

- npm ci, then npm test: website and catalog checks.
- With Node.js 22.13 or newer: node --test teacher-service/service.test.mjs checks authentication and proxy security.
- node scripts/verify-public.mjs compares public website files and validates the catalog.
- node scripts/verify-public-dom.mjs checks the deployed modules in a DOM emulator.
- python scripts/package-source.py rebuilds the complete source ZIP.

See TEST-REPORT.md and deployment-status.json for the current deployment and verification status. No test documents are published.
