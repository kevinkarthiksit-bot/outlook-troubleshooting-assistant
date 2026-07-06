#!/usr/bin/env node
/**
 * Run all tests: parent multi-file + single-file bundle.
 */
const { execSync } = require("child_process");
const path = require("path");

const root = path.join(__dirname, "..");

console.log("########## PARENT PROJECT ##########\n");
execSync("node test/run-all.js", { cwd: root, stdio: "inherit" });

console.log("\n########## SINGLE-FILE BUILD ##########\n");
execSync("node test/run-all.js", { cwd: path.join(root, "single-file"), stdio: "inherit" });

console.log("\n========================================");
console.log("ALL TESTS PASSED");
console.log("========================================");
