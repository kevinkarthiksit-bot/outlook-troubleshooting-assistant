# Single-file Outlook Assistant

One self-contained HTML file — double-click to run (no Python server required).

## Quick start

**Recommended:** double-click **`Launch Outlook Assistant.bat`** — starts a tiny local server and opens the app.

Or open **`outlook-assistant.html#case`** directly in Chrome or Edge.

Hash routes (for bookmarks):

| Route | URL hash |
|-------|----------|
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

## Admin KB upload

JSON or CSV only (export Excel as CSV). Button: **Apply KB update** — no SharePoint or CDN required.

## Admin login

Username: `Hannah` / Password: `Hannah@95` (from parent `js/config.js`)
