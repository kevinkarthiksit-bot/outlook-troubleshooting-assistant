#!/usr/bin/env node
/**
 * Validates troubleshooting guide JSON (parent project).
 */
const fs = require("fs");
const path = require("path");

const file = path.join(__dirname, "..", "data", "troubleshooting-guide.json");
const data = JSON.parse(fs.readFileSync(file, "utf8"));

if (!data.guides || !Array.isArray(data.guides)) {
  console.error("FAIL: missing guides array");
  process.exit(1);
}
if (!data.flows || !Array.isArray(data.flows)) {
  console.error("FAIL: missing flows array");
  process.exit(1);
}

const ids = new Set();
for (const g of data.guides) {
  if (!g.id || !g.title) {
    console.error("FAIL: guide missing id/title");
    process.exit(1);
  }
  if (ids.has(g.id)) {
    console.error("FAIL: duplicate guide id " + g.id);
    process.exit(1);
  }
  ids.add(g.id);
}

console.log(
  "OK troubleshooting: " + data.guides.length + " guides, " + data.flows.length + " flows"
);
process.exit(0);
