# Tasnim Hamdeni lesson library

- Website repository: https://github.com/tasnim-hamdeni/tasnim-hamdeni.github.io
- Public lesson-data repository: https://github.com/tasnim-hamdeni/tasnim-lesson-data
- Deployment target: https://tasnim-hamdeni.github.io/
- Teacher administration: https://tasnim-hamdeni.github.io/admin.html

Plain HTML, CSS, and JavaScript. Publish from `main`, root (`/`), through GitHub Pages. No custom domain is needed. The catalog starts empty; students require no sign-in.

## Teacher token

In GitHub Settings → Developer settings → Personal access tokens → Fine-grained tokens, generate an expiring token with resource owner **tasnim-hamdeni**. Choose **Only select repositories → tasnim-lesson-data** and grant **Contents: Read and write**. Metadata: Read-only is automatic; leave other permissions unset.

Enter the token directly on `admin.html` and select Connect. It stays in page memory only and clears on disconnect, reload, navigation, or closing the page. Never place it in source, files, URLs, logs, commits, or the source ZIP. Students never need it.

Add subjects, then publish PDF/PPTX lessons up to 50 MiB each. Documents and catalog changes are committed together. Students on other devices see published lessons after refreshing; GitHub's public cache may take a few minutes to update.

**Every lesson and catalog entry is public. Never upload private student information.** Removal deletes current content, but Git history, caches, and downloaded copies may retain it. Upload only material you have permission to publish.
