#!/usr/bin/env node
/**
 * Builds single-file/outlook-assistant.html from the multi-file parent project.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const OUT_DIR = __dirname;
const OUT_FILE = path.join(OUT_DIR, "outlook-assistant.html");

const PAGES = [
  { route: "case", file: "case.html", tpl: "tpl-case", bodyClass: "login-page" },
  { route: "index", file: "index.html", tpl: "tpl-index", bodyClass: "" },
  { route: "guide", file: "guide.html", tpl: "tpl-guide", bodyClass: "" },
  { route: "troubleshooting", file: "troubleshooting.html", tpl: "tpl-troubleshooting", bodyClass: "" },
  {
    route: "troubleshooting-guide",
    file: "troubleshooting-guide.html",
    tpl: "tpl-troubleshooting-guide",
    bodyClass: ""
  },
  { route: "admin-login", file: "admin-login.html", tpl: "tpl-admin-login", bodyClass: "login-page" },
  { route: "admin", file: "admin.html", tpl: "tpl-admin", bodyClass: "" }
];

const JS_ORDER = [
  "js/config.js",
  "js/storage.js",
  "js/sharepoint.js",
  "js/session.js",
  "js/logging.js",
  "js/search.js",
  "js/kb-loader.js",
  "js/troubleshooting-search.js",
  "js/troubleshooting-loader.js",
  "js/step-utils.js",
  "js/hub-ui.js",
  "js/theme-picker.js",
  "js/themes.js",
  "js/admin-auth.js",
  "js/login.js",
  "js/case.js",
  "js/app.js",
  "js/guide.js",
  "js/troubleshooting.js",
  "js/troubleshooting-guide.js",
  "js/admin-login.js",
  "js/admin.js"
];

function read(file) {
  const p = path.isAbsolute(file) ? file : path.join(ROOT, file);
  return fs.readFileSync(p, "utf8");
}

function extractBody(html) {
  const m = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  if (!m) throw new Error("No body in HTML");
  return m[1].replace(/<script[\s\S]*?<\/script>/gi, "").trim();
}

function svgToDataUri(content) {
  return "data:image/svg+xml," + encodeURIComponent(content.trim());
}

function loadEmbeddedImages() {
  const dir = path.join(ROOT, "assets", "images");
  const map = {};
  if (!fs.existsSync(dir)) return map;
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith(".svg")) continue;
    map[file] = svgToDataUri(fs.readFileSync(path.join(dir, file), "utf8"));
  }
  return map;
}

function patchJs(code) {
  code = code.replace(
    /document\.addEventListener\("DOMContentLoaded",\s*\(\)\s*=>\s*\w+\.init\(\)\s*\);\s*/g,
    ""
  );

  code = code.replace(/new URLSearchParams\(window\.location\.search\)/g, "SPA.getQuery()");

  const replacements = [
    [/window\.location\.href\s*=\s*redirectUrl;/g, 'SPA.navigate(SPA.routeFromPage(redirectUrl));'],
    [/window\.location\.href\s*=\s*"login\.html"/g, 'SPA.navigate("login")'],
    [/window\.location\.href\s*=\s*"case\.html"/g, 'SPA.navigate("case")'],
    [/window\.location\.href\s*=\s*"index\.html"/g, 'SPA.navigate("index")'],
    [/window\.location\.href\s*=\s*"admin\.html"/g, 'SPA.navigate("admin")'],
    [/window\.location\.href\s*=\s*"admin-login\.html"/g, 'SPA.navigate("admin-login")'],
    [
      /window\.location\.href\s*=\s*"guide\.html\?kb="\s*\+\s*encodeURIComponent\(([^)]+)\)/g,
      'SPA.navigate("guide", { kb: $1 })'
    ],
    [
      /window\.location\.href\s*=\s*"troubleshooting-guide\.html\?guide="\s*\+\s*encodeURIComponent\(([^)]+)\)/g,
      'SPA.navigate("troubleshooting-guide", { guide: $1 })'
    ]
  ];
  for (const [re, rep] of replacements) {
    code = code.replace(re, rep);
  }

  if (code.includes("const KbLoader")) {
    code = code.replace(
      /} else {\s*const res = await fetch\(cfg\.localKbPath\);/,
      `} else if (window.EMBEDDED_KB) {
          this.kbData = window.EMBEDDED_KB;
        } else {
          const res = await fetch(cfg.localKbPath);`
    );
  }

  if (code.includes("const TroubleshootingLoader")) {
    code = code.replace(
      /const cfg = window\.SP_CONFIG;\s*const res = await fetch\(cfg\.localTroubleshootingPath \|\| "data\/troubleshooting-guide\.json"\);\s*if \(!res\.ok\) throw new Error\("Failed to load troubleshooting guide"\);\s*this\.data = await res\.json\(\);/,
      `const cfg = window.SP_CONFIG;
      if (window.EMBEDDED_TS_GUIDE) {
        this.data = window.EMBEDDED_TS_GUIDE;
      } else {
        const res = await fetch(cfg.localTroubleshootingPath || "data/troubleshooting-guide.json");
        if (!res.ok) throw new Error("Failed to load troubleshooting guide");
        this.data = await res.json();
      }`
    );
  }

  if (code.includes("const StepUtils")) {
    code = code.replace(
      /if \(img\.startsWith\("http"\)/,
      `if (window.EMBEDDED_IMAGES && window.EMBEDDED_IMAGES[img]) return window.EMBEDDED_IMAGES[img];
    if (img.startsWith("http")`
    );
  }

  if (code.includes("downloadSample")) {
    code = code.replace(
      /async downloadSample\(\) \{\s*try \{\s*const res = await fetch\(window\.SP_CONFIG\.localKbPath\);\s*const json = await res\.text\(\);/,
      `async downloadSample() {
    try {
      const json = JSON.stringify(window.EMBEDDED_KB || {}, null, 2);`
    );
    code = code.replace(
      /\} catch \{\s*alert\("Could not download sample KB\."\);\s*\}/,
      `} catch {
      alert("Could not download sample KB.");
    }`
    );
  }

  return code;
}

function patchSessionRedirects(code) {
  return code
    .replace(
      /requireAuth\(redirectUrl = "login\.html"\)/,
      'requireAuth(redirectUrl = "login")'
    )
    .replace(
      /requireCaseSetup\(redirectUrl = "case\.html"\)/,
      'requireCaseSetup(redirectUrl = "case")'
    )
    .replace(
      /requireAuth\(redirectUrl = "admin-login\.html"\)/,
      'requireAuth(redirectUrl = "admin-login")'
    );
}

function buildTemplates() {
  return PAGES.map((p) => {
    const body = extractBody(read(p.file));
    return `<template id="${p.tpl}">${body}</template>`;
  }).join("\n");
}

function buildJsBundle() {
  const spaRuntime = read(path.join(__dirname, "src", "spa-runtime.js"));
  const spaBootstrap = read(path.join(__dirname, "src", "spa-bootstrap.js"));

  const embeddedKb = read("data/kb-articles.sample.json");
  const embeddedTs = read("data/troubleshooting-guide.json");
  const embeddedImages = JSON.stringify(loadEmbeddedImages());

  let config = read("js/config.js");
  config = config.replace(
    "useSharePoint: false,",
    "useSharePoint: false,\n  singleFile: true,"
  );

  const chunks = [
    config,
    `window.EMBEDDED_KB = /*__EMBEDDED_KB__*/${embeddedKb}/*__END_EMBEDDED_KB__*/;`,
    `window.EMBEDDED_TS_GUIDE = ${embeddedTs};`,
    `window.EMBEDDED_IMAGES = ${embeddedImages};`,
    spaRuntime
  ];

  for (const file of JS_ORDER.slice(1)) {
    let code = read(file);
    if (file === "js/session.js" || file === "js/admin-auth.js") {
      code = patchSessionRedirects(code);
    }
    code = patchJs(code);
    chunks.push(code);
  }

  chunks.push(spaBootstrap);
  return chunks.join("\n\n");
}

function build() {
  const css = read("css/styles.css");
  const cssExtra = `
#spa-mount { min-height: 60vh; }
.spa-hidden-templates { display: none !important; }
`;

  const html = `<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Outlook Troubleshooting Assistant</title>
  <style>
${css}
${cssExtra}
  </style>
</head>
<body>
  <div id="spa-mount" aria-live="polite"></div>
  <div class="spa-hidden-templates" hidden aria-hidden="true">
${buildTemplates()}
  </div>
  <script>
${buildJsBundle()}
  </script>
</body>
</html>
`;

  fs.writeFileSync(OUT_FILE, html, "utf8");
  const kb = Math.round(fs.statSync(OUT_FILE).size / 1024);
  console.log("Built " + OUT_FILE + " (" + kb + " KB)");
}

build();
