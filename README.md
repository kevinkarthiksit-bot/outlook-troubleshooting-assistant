# Outlook Troubleshooting Assistant

Static HTML/CSS/JS tool for SharePoint hosting. No custom backend required.

---

## Live demo (GitHub Pages)

**Repo:** https://github.com/kevinkarthiksit-bot/outlook-troubleshooting-assistant

| App | URL |
|-----|-----|
| **Full app (start here)** | https://kevinkarthiksit-bot.github.io/outlook-troubleshooting-assistant/case.html |
| **Single-file version** | https://kevinkarthiksit-bot.github.io/outlook-troubleshooting-assistant/single-file/outlook-assistant.html#case |

No install required — works in any modern browser.

---

## Quick start (local)

**If you received this folder by email, read `START_HERE.txt` first.**

1. **Double-click** `Launch Outlook Assistant.bat` — server starts and browser opens automatically.
2. Enter **Case details** (Chat IMS, Platform, Environment), then search the KB.

> Do not open HTML files by double-clicking in File Explorer. Use the launcher or GitHub Pages.

### Troubleshooting

Double-click **`Health-Check.bat`** if the app does not start (usually Python is missing).

### Manual start (if you prefer the command line)

```bash
cd "OutLook Assistant"
python -m http.server 8080
```

Then open **http://localhost:8080/case.html**

### Packaging for email

Double-click **`Create-Email-Zip.bat`** to build **`OutLook-Assistant.zip`** (~0.2 MB).  
See **`PACKAGE_FOR_EMAIL.txt`** for full sending instructions.

---

## User flow

```
case.html → index.html (org KB) → guide.html
         ↘ troubleshooting.html → troubleshooting-guide.html
```

1. **Case setup** — Chat IMS, Platform, Environment
2. **Org KB** — Search GEV articles on `index.html` → step guide on `guide.html`
3. **Troubleshooting Guides** — Research-based library on `troubleshooting.html` → steps on `troubleshooting-guide.html`

## Two content libraries

| Library | Data file | Hub page | Step page |
|---------|-----------|----------|-----------|
| **Org KB** | `data/kb-articles.sample.json` (24 articles) | `index.html` | `guide.html?kb=` |
| **Troubleshooting Guides** | `data/troubleshooting-guide.json` (32 guides, 10 flows) | `troubleshooting.html` | `troubleshooting-guide.html?guide=` |

Guided flow options route to **`troubleshooting-guide.html`** (single match opens immediately).

## Project structure

```
OutLook Assistant/
├── index.html, guide.html           # Org KB
├── troubleshooting.html             # Research guides hub + flows
├── troubleshooting-guide.html       # Research step-by-step page
├── data/
│   ├── kb-articles.sample.json
│   └── troubleshooting-guide.json
├── assets/images/                   # Screenshots for troubleshooting guides
├── js/
│   ├── app.js, guide.js             # Org KB
│   ├── troubleshooting.js           # Guides hub
│   ├── troubleshooting-guide.js     # Guide steps page
│   └── troubleshooting-loader.js, troubleshooting-search.js
├── Launch Outlook Assistant.bat     # ONE CLICK — start here
├── Health-Check.bat                 # Verify folder + Python
├── Start-Outlook-Assistant.bat      # Same as Launch (alias)
├── START_HERE.txt                   # Quick start for recipients
└── Create-Email-Zip.bat             # Build OutLook-Assistant.zip to attach
```

## Local demo

Use **`Launch Outlook Assistant.bat`** (one click — starts server and opens browser) or:

```bash
python -m http.server 8080
```

Open **http://localhost:8080/case.html**

Clear stale cache: **Refresh KB** / **Refresh** on each hub, or delete `outlookAssistant_kbCache` and `outlookAssistant_tsGuideCache` in localStorage.

## Single-file build (no server)

A self-contained SPA lives in **`single-file/`**:

```bash
cd single-file
node build.js          # creates outlook-assistant.html (253 KB)
node test/run-all.js   # validate bundle
```

Double-click **`single-file/outlook-assistant.html`** or **`single-file/Launch Outlook Assistant.bat`** — no Python required.

Run **all** tests (parent + single-file):

```bash
node test/run-all-tests.js
```

## GitHub

Clone and run locally:

```bash
git clone https://github.com/kevinkarthiksit-bot/outlook-troubleshooting-assistant.git
cd outlook-troubleshooting-assistant
# Windows: double-click Launch Outlook Assistant.bat
# Or: python -m http.server 8080  →  http://localhost:8080/case.html
```

Pages deploys automatically on push to `main` (see `.github/workflows/pages.yml`).

### Admin login

- `admin-login.html` — Username: `Hannah` / Password: `Hannah@95` (change in `js/config.js`)

## SharePoint deployment

Upload the full folder including `assets/` and both JSON data files. Configure paths in `js/config.js`.

## Features

- Separate org KB and research troubleshooting guides
- Guided flows on troubleshooting hub with navigation to step pages
- Rich steps with images and tips (troubleshooting guides only)
- Platform-filtered steps from case setup
- Copy session notes for tickets
- Admin KB upload (JSON/CSV — export Excel as CSV) → **Apply & download single-file app** bakes KB into `outlook-assistant.html`
