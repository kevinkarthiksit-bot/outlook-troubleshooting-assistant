#!/usr/bin/env node
/**
 * Validates org KB JSON (parent project).
 */
const fs = require("fs");
const path = require("path");

const dataDir = path.join(__dirname, "..", "data");
const generated = path.join(dataDir, "kb-articles.json");
const file = fs.existsSync(generated)
  ? generated
  : path.join(dataDir, "kb-articles.sample.json");
const data = JSON.parse(fs.readFileSync(file, "utf8"));

if (!data.articles || !Array.isArray(data.articles)) {
  console.error("FAIL: missing articles array");
  process.exit(1);
}
if (data.articles.length < 1) {
  console.error("FAIL: no articles");
  process.exit(1);
}
if (data.flows && data.flows.length > 0) {
  console.error("FAIL: org KB should not contain flows");
  process.exit(1);
}

const ids = new Set();
for (const a of data.articles) {
  if (!a.id || !a.title) {
    console.error("FAIL: article missing id/title");
    process.exit(1);
  }
  if (ids.has(a.id)) {
    console.error("FAIL: duplicate id " + a.id);
    process.exit(1);
  }
  ids.add(a.id);
  if (!Array.isArray(a.steps)) {
    console.error("FAIL: " + a.id + " missing steps");
    process.exit(1);
  }
}

console.log("OK org KB: " + data.articles.length + " articles, no flows");
process.exit(0);
