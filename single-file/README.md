# Single-file Outlook Assistant

One self-contained HTML file — double-click to run (no Python server required).

## Quick start

**Recommended:** double-click **`Launch Outlook Assistant.bat`** — starts a tiny local server and opens the app.

Or open **`outlook-assistant.html`** directly in Chrome/Edge (add `#login` to the address bar if the page looks blank).

> **Why use the .bat?** Some browsers show a blank page on first open because the app waited for a URL hash change that never fired. The launcher fixes that and avoids `file://` quirks.

Hash routes (for bookmarks):

| Route | URL hash |
|-------|----------|
| Login | `#login` |
| Case setup | `#case` |
| Org KB | `#index` |
| KB guide | `#guide?kb=GEVKB0012506` |
| Troubleshooting | `#troubleshooting` |
| TS guide | `#troubleshooting-guide?guide=...` |
| Admin | `#admin-login` then `#admin` |

## Rebuild from parent project

```bash
cd single-file
node build.js
```

## Tests

```bash
# Single-file only
node test/run-all.js

# Parent multi-file project (from repo root)
node test/run-all.js

# Everything
node test/run-all-tests.js
```

## What's embedded

- All CSS, JavaScript, org KB JSON, troubleshooting JSON, and SVG images
- SheetJS loaded from CDN (admin Excel upload only — needs internet)

## Admin login

Username: `Hannah` / Password: `Hannah@95` (from parent `js/config.js`)
