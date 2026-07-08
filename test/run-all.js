#!/usr/bin/env node
/**
 * Run all parent project tests.
 */
const { execSync } = require("child_process");
const path = require("path");

const root = path.join(__dirname, "..");
const tests = ["kb-validate.js", "ts-validate.js", "hub-ui-validate.js", "e2e-smoke.js"];

for (const t of tests) {
  console.log("\n=== " + t + " ===\n");
  execSync("node test/" + t, { cwd: root, stdio: "inherit" });
}

console.log("\nAll parent project tests passed.");
