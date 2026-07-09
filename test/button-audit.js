#!/usr/bin/env node
/**
 * Static audit: wired button IDs exist in HTML and theme init is not duplicated per page.
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const failures = [];

function read(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

function extractIdsFromHtml(html) {
  const ids = new Set();
  const re = /\bid=["']([^"']+)["']/g;
  let m;
  while ((m = re.exec(html))) ids.add(m[1]);
  return ids;
}

function extractWiredButtonIds(js) {
  const ids = new Set();
  const re = /getElementById\(["']([^"']+)["']\)\?\.addEventListener\(/g;
  let m;
  while ((m = re.exec(js))) ids.add(m[1]);
  const re2 = /getElementById\(["']([^"']+)["']\)\.addEventListener\(/g;
  while ((m = re2.exec(js))) ids.add(m[1]);
  return ids;
}

const pages = [
  {
    name: "admin dashboard",
    html: "admin.html",
    js: "js/admin.js",
    wired: [
      "adminLogoutBtn",
      "uploadKbBtn",
      "downloadKbJsonBtn",
      "downloadSampleBtn",
      "refreshLogsBtn",
      "exportLogsBtn",
      "clearLocalLogsBtn",
      "clearLogFiltersBtn"
    ],
    required: ["themePickerMount", "kbFileInput", "logsTableBody"]
  },
  {
    name: "admin login",
    html: "admin-login.html",
    js: "js/admin-login.js",
    wired: [],
    required: ["themePickerMount", "adminLoginForm", "adminUsername", "adminPassword"]
  },
  {
    name: "troubleshooting hub",
    html: "troubleshooting.html",
    js: "js/troubleshooting.js",
    wired: ["clearSearch", "closeFlow", "escalateBtn", "editCaseBtn", "refreshGuide", "startOverBtn"],
    required: ["themePickerMount", "searchInput", "searchResults"]
  },
  {
    name: "org KB hub",
    html: "index.html",
    js: "js/app.js",
    wired: ["clearSearch", "escalateBtn", "refreshKb", "startOverBtn", "editCaseBtn"],
    required: ["themePickerMount", "searchInput", "searchResults"]
  },
  {
    name: "case setup",
    html: "case.html",
    js: "js/case.js",
    wired: [],
    required: ["themePickerMount", "caseForm", "chatImsInput", "platformSelect", "environmentSelect"]
  }
];

for (const page of pages) {
  const html = read(page.html);
  const ids = extractIdsFromHtml(html);
  const js = read(page.js);

  for (const id of [...page.wired, ...page.required]) {
    if (!ids.has(id)) {
      failures.push(page.name + ": missing #" + id + " in " + page.html);
    }
  }

  for (const id of extractWiredButtonIds(js)) {
    if (!ids.has(id)) {
      failures.push(page.name + ": " + page.js + " wires #" + id + " but " + page.html + " has no such element");
    }
  }
}

const themesJs = read("js/themes.js");
if (!themesJs.includes("_eventsBound") || !themesJs.includes("closest(\".theme-picker-toggle\")")) {
  failures.push("themes.js should use delegated event binding to survive remounts");
}

const adminHtml = read("admin.html");
if (adminHtml.includes("Themes.init()")) {
  failures.push("admin.html should not call Themes.init() inline (handled in admin.js)");
}

const adminLoginHtml = read("admin-login.html");
if (adminLoginHtml.includes("Themes.init()")) {
  failures.push("admin-login.html should not call Themes.init() inline (handled in admin-login.js)");
}

const adminLoginJs = read("js/admin-login.js");
if (!adminLoginJs.includes("ThemePicker.mount") || !adminLoginJs.includes("Themes.init")) {
  failures.push("admin-login.js must mount theme picker on init");
}

const adminJs = read("js/admin.js");
if (!adminJs.includes("ThemePicker.mount") || !adminJs.includes("Themes.init")) {
  failures.push("admin.js must mount theme picker on init");
}

if (failures.length) {
  console.error("BUTTON AUDIT FAILURES:\n");
  failures.forEach((f, i) => console.error((i + 1) + ". " + f));
  process.exit(1);
}

console.log("OK button audit: " + pages.length + " pages, theme picker wiring verified");
process.exit(0);
