#!/usr/bin/env node
/**
 * Run all single-file checks: rebuild + validate.
 */
const { execSync } = require("child_process");
const path = require("path");

const dir = path.join(__dirname, "..");

console.log("=== Building single-file bundle ===\n");
execSync("node build.js", { cwd: dir, stdio: "inherit" });

console.log("\n=== Single-file validation ===\n");
execSync("node test/single-file-validate.js", { cwd: dir, stdio: "inherit" });

console.log("\nAll single-file tests passed.");
