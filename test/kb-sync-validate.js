#!/usr/bin/env node
/**
 * Validates Excel → KB sync output.
 */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const root = path.join(__dirname, "..");
const excel = path.join(root, "Email and Outlook articles.xlsx");
const kbJson = path.join(root, "data", "kb-articles.json");

if (!fs.existsSync(excel)) {
  console.error("FAIL: Email and Outlook articles.xlsx not found");
  process.exit(1);
}

execSync("node scripts/sync-kb-from-excel.js", { cwd: root, stdio: "pipe" });

const data = JSON.parse(fs.readFileSync(kbJson, "utf8"));
if (!data.articles || data.articles.length < 90) {
  console.error("FAIL: expected ~98 articles from Excel, got " + (data.articles?.length || 0));
  process.exit(1);
}

const ids = new Set();
for (const a of data.articles) {
  if (!a.id || !a.title || !Array.isArray(a.steps) || a.steps.length < 1) {
    console.error("FAIL: invalid article " + (a.id || "(no id)"));
    process.exit(1);
  }
  if (ids.has(a.id)) {
    console.error("FAIL: duplicate id " + a.id);
    process.exit(1);
  }
  ids.add(a.id);
}

console.log("OK Excel sync: " + data.articles.length + " articles");
process.exit(0);
