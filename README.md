# Tasnim Hamdeni


Students: https://tasnim-hamdeni.github.io/

Tasnim: https://tasnim-hamdeni.github.io/tasnim/

Source: https://github.com/tasnim-hamdeni/tasnim-hamdeni.github.io

Public catalog and files: https://github.com/tasnim-hamdeni/tasnim-lesson-data

## Publish lessons

1. Open Tasnim’s URL and connect with a fine-grained GitHub token (instructions below).
2. Add a subject, then a chapter inside it.
3. Select that chapter, enter a document title, and upload a PDF or PPTX (up to 50 MB / 50 MiB).
4. Students can refresh the main website to see it. GitHub’s public cache may take a few minutes.

A chapter can contain multiple documents. Remove its documents before removing a chapter; remove chapters before removing their subject. Removal asks for confirmation.

## Create the teacher token

Sign in to **tasnim-hamdeni**. Open https://github.com/settings/personal-access-tokens/new and set a name and expiration. Choose:

- Resource owner: **tasnim-hamdeni**.
- Repository access: **Only select repositories → tasnim-lesson-data**.
- Repository permissions: **Contents: Read and write**. Metadata read access is automatic. Leave other permissions unset.

Generate the token and enter it directly on Tasnim’s page. Do not send it in chat or put it in source files. The page keeps it only in memory and clears it when disconnected or closed. The website never saves it in localStorage or sessionStorage. The separate URL is a teacher workspace; editing still requires the token. Students need no account or token.

**Everything uploaded is public. Never upload private student information.** Git history, downloads and caches can retain removed content.

## Data and hosting

Plain HTML, CSS and JavaScript in `site/`. GitHub Pages publishes the website repository’s `main` branch, root folder, with no custom domain. `/admin.html` forwards to `/tasnim/`. Student pages contain no admin links.

The public `catalog.json` stores subjects, chapters and document metadata (the document array is named `lessons` for compatibility). New documents use `documents/<subject-id>/<chapter-id>/<unique-id>.pdf` or `.pptx`. An upload commits its file and catalog together. Concurrent changes are retried against the latest catalog without forcing the branch. A removed chapter or subject cancels a conflicting upload.

Original version 1 catalogs are read safely: existing documents appear in a **General** chapter and retain their original file URLs. The next successful teacher edit saves version 2. Never replace an existing live catalog with the empty ZIP starter.

## Source and checks

- `npm ci`, then `npm test`: catalog, publishing and DOM interaction tests.
- `npm run preview`: local student/admin preview.
- `node scripts/verify-public.mjs`: compares deployed files with the local source and checks the public catalog.
- `python scripts/package-source.py`: rebuilds the complete source ZIP and checks for credentials.
- Optional: authenticate GitHub CLI as **tasnim-hamdeni**, then `npm run deploy`. The script refuses unrelated repositories and preserves an existing catalog.

No production dependency is required. jsdom is used only for automated tests. See `TEST-REPORT.md` for verification limits.
