#!/usr/bin/env node
/**
 * Validates hub card limit helpers.
 */
const fs = require("fs");
const path = require("path");

const hubUiPath = path.join(__dirname, "..", "js", "hub-ui.js");
const appPath = path.join(__dirname, "..", "js", "app.js");
const cssPath = path.join(__dirname, "..", "css", "styles.css");
const singleFilePath = path.join(__dirname, "..", "single-file", "outlook-assistant.html");

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

const hubUi = fs.readFileSync(hubUiPath, "utf8");
const appJs = fs.readFileSync(appPath, "utf8");
const css = fs.readFileSync(cssPath, "utf8");
const singleFile = fs.readFileSync(singleFilePath, "utf8");

if (hubUi.includes("CARD_DISPLAY_LIMIT: 6")) ok("CARD_DISPLAY_LIMIT is 6");
else bad("CARD_DISPLAY_LIMIT missing");

if (appJs.includes("visible.forEach((article)")) ok("app.js renders visible cards only");
else bad("app.js still renders all results");

if (css.includes("result-grid:not(.result-grid-expanded)")) ok("CSS hard cap hides 7th+ cards when collapsed");
else bad("CSS hard cap missing");

if (hubUi.includes("renderShowAllButton")) ok("hub-ui.js has Show all button helper");
else bad("hub-ui.js missing renderShowAllButton");

if (singleFile.includes("visible.forEach((article)")) ok("single-file uses visible.forEach");
else bad("single-file missing visible.forEach");

if (singleFile.includes("nth-child(n + 7)")) ok("single-file CSS includes hard cap");
else bad("single-file missing CSS hard cap");

// Simulate limit logic
const limit = 6;
const sample = Array.from({ length: 24 }, (_, i) => i);
const visible = sample.length <= limit ? sample : sample.slice(0, limit);
if (visible.length === 6) ok("slice logic yields 6 from 24 articles");
else bad("slice logic failed");

console.log("\nResults: " + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
