#!/usr/bin/env node
/**
 * Validates the single-file HTML bundle structure and embedded data.
 */
const fs = require("fs");
const path = require("path");

const htmlPath = path.join(__dirname, "..", "outlook-assistant.html");
let pass = 0;
let fail = 0;

function ok(msg) {
  console.log("✓ " + msg);
  pass++;
}
function bad(msg) {
  console.log("✗ " + msg);
  fail++;
}

if (!fs.existsSync(htmlPath)) {
  console.error("Missing outlook-assistant.html — run: node build.js");
  process.exit(1);
}

const html = fs.readFileSync(htmlPath, "utf8");
const sizeKb = Math.round(fs.statSync(htmlPath).size / 1024);
ok("outlook-assistant.html exists (" + sizeKb + " KB)");

const templates = [
  "tpl-case", "tpl-index", "tpl-guide",
  "tpl-troubleshooting", "tpl-troubleshooting-guide",
  "tpl-admin-login", "tpl-admin"
];
for (const id of templates) {
  html.includes('id="' + id + '"') ? ok("template " + id) : bad("template " + id);
}
if (html.includes("<template id=")) ok("uses HTML template elements");
else bad("missing template elements");

const markers = [
  "window.EMBEDDED_KB",
  "window.EMBEDDED_TS_GUIDE",
  "window.EMBEDDED_IMAGES",
  "const SPA",
  "SPA.register(\"case\"",
  "SPA.register(\"index\"",
  "SPA.register(\"guide\"",
  "SPA.register(\"troubleshooting\"",
  "SPA.register(\"admin\"",
  "SPA.navigate(",
  "EMBEDDED_KB)",
  "EMBEDDED_TS_GUIDE)"
];
for (const m of markers) {
  html.includes(m) ? ok("marker: " + m) : bad("marker: " + m);
}

if (html.includes("/*__EMBEDDED_KB__*/") && html.includes("/*__END_EMBEDDED_KB__*/")) {
  ok("EMBEDDED_KB bake markers present");
} else {
  bad("missing EMBEDDED_KB bake markers");
}

function extractJsonAfter(marker) {
  const idx = html.indexOf(marker);
  if (idx < 0) return null;
  const start = html.indexOf("{", idx);
  if (start < 0) return null;
  let depth = 0;
  for (let i = start; i < html.length; i++) {
    if (html[i] === "{") depth++;
    if (html[i] === "}") {
      depth--;
      if (depth === 0) {
        return JSON.parse(html.slice(start, i + 1));
      }
    }
  }
  return null;
}

try {
  const kb = extractJsonAfter("window.EMBEDDED_KB =");
  const count = kb?.articles?.length || 0;
  if (count >= 90) ok("embedded " + count + " org KB articles");
  else bad("embedded KB article count (" + count + ", expected >= 90)");
  if (!kb?.flows?.length) ok("embedded org KB has no flows");
  else bad("embedded org KB has flows");
} catch (e) {
  bad("parse EMBEDDED_KB: " + e.message);
}

try {
  const ts = extractJsonAfter("window.EMBEDDED_TS_GUIDE =");
  if (ts?.guides?.length === 32) ok("embedded 32 troubleshooting guides");
  else bad("embedded guide count (" + (ts?.guides?.length || 0) + ")");
  if (ts?.flows?.length === 10) ok("embedded 10 flows");
  else bad("embedded flow count");
} catch (e) {
  bad("parse EMBEDDED_TS_GUIDE: " + e.message);
}

try {
  const imgs = extractJsonAfter("window.EMBEDDED_IMAGES =");
  const count = imgs ? Object.keys(imgs).length : 0;
  if (count >= 20) ok(count + " embedded SVG images");
  else bad("embedded images (" + count + ")");
} catch (e) {
  bad("parse EMBEDDED_IMAGES");
}

if (html.includes("} else if (window.EMBEDDED_KB)")) ok("KB loader prefers embedded data");
else bad("KB loader missing embedded branch");

if (html.includes("if (window.EMBEDDED_TS_GUIDE)")) ok("TS loader prefers embedded data");
else bad("TS loader missing embedded branch");

if (html.includes("cdn.sheetjs.com")) ok("admin can load SheetJS on demand for Excel upload");
else bad("admin missing on-demand Excel parser hook");

if (html.includes("const GuideResolver")) ok("guide resolver bundled");
else bad("guide resolver missing");

if (html.includes("const UnifiedSearch")) ok("unified search bundled");
else bad("unified search missing");

if (html.includes("const SearchSuggestions")) ok("search suggestions bundled");
else bad("search suggestions missing");

if (html.includes('SPA.navigate("troubleshooting")')) ok("SPA routes to troubleshooting hub");
else bad("SPA missing troubleshooting route from case");

if (html.includes('location.hash = "#case"')) ok("SPA defaults to case route");
else bad("SPA default route should be case");

console.log("\nResults: " + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
