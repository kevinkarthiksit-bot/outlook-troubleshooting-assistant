#!/usr/bin/env node
/**
 * Smoke tests for multi-file parent project.
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
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

const pages = [
  "case.html", "index.html", "guide.html",
  "troubleshooting.html", "troubleshooting-guide.html",
  "admin-login.html", "admin.html", "login.html"
];
const scripts = [
  "js/config.js", "js/storage.js", "js/session.js", "js/app.js", "js/guide.js",
  "js/troubleshooting.js", "js/troubleshooting-guide.js", "js/troubleshooting-loader.js",
  "js/troubleshooting-search.js", "js/step-utils.js", "js/platform-match.js",
  "js/guide-resolver.js", "js/unified-search.js", "js/search-suggestions.js",
  "js/kb-loader.js", "js/search.js", "js/hub-ui.js",
  "js/admin-auth.js", "js/admin-login.js", "js/admin.js", "js/kb-spreadsheet.js"
];

for (const p of pages) {
  fs.existsSync(path.join(root, p)) ? ok("page " + p) : bad("page " + p);
}
for (const s of scripts) {
  fs.existsSync(path.join(root, s)) ? ok("js " + s) : bad("js " + s);
}

try {
  const kbPath = fs.existsSync(path.join(root, "data/kb-articles.json"))
    ? path.join(root, "data/kb-articles.json")
    : path.join(root, "data/kb-articles.sample.json");
  const kb = JSON.parse(fs.readFileSync(kbPath, "utf8"));
  kb.articles?.length ? ok(kb.articles.length + " org KB articles") : bad("org KB empty");
  (!kb.flows || kb.flows.length === 0) ? ok("org KB has no flows") : bad("org KB has flows");
} catch (e) {
  bad("org KB JSON");
}

try {
  const ts = JSON.parse(fs.readFileSync(path.join(root, "data/troubleshooting-guide.json"), "utf8"));
  ts.guides?.length ? ok(ts.guides.length + " troubleshooting guides") : bad("no guides");
  ts.flows?.length ? ok(ts.flows.length + " troubleshooting flows") : bad("no flows");
} catch (e) {
  bad("troubleshooting JSON");
}

console.log("\nResults: " + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
