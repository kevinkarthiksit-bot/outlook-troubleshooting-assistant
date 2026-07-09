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

for (const flow of data.flows) {
  for (const step of flow.steps || []) {
    for (const opt of step.options || []) {
      const guideIds = opt.guideIds || opt.kbIds || [];
      const seen = new Set();
      for (const id of guideIds) {
        if (seen.has(id)) {
          console.error(
            "FAIL: duplicate guideId " + id + " in flow '" + flow.id + "' option '" + opt.label + "'"
          );
          process.exit(1);
        }
        seen.add(id);
      }
    }
  }
}

console.log(
  "OK troubleshooting: " + data.guides.length + " guides, " + data.flows.length + " flows"
);
process.exit(0);
