#!/usr/bin/env node
/**
 * Sync data/kb-articles.json from Email and Outlook articles.xlsx.
 * Edit the Excel file, then run: node scripts/sync-kb-from-excel.js
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const { KbSpreadsheet } = require(path.join(ROOT, "js", "kb-spreadsheet.js"));
const { readXlsxSheet } = require("./xlsx-read");

const EXCEL_CANDIDATES = [
  path.join(ROOT, "Email and Outlook articles.xlsx"),
  path.join(ROOT, "data", "Email and Outlook articles.xlsx")
];

const OUT_JSON = path.join(ROOT, "data", "kb-articles.json");
const SAMPLE_JSON = path.join(ROOT, "data", "kb-articles.sample.json");

function findExcelFile() {
  for (const candidate of EXCEL_CANDIDATES) {
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error(
    'Excel file not found. Expected "Email and Outlook articles.xlsx" in the repo root or data/.'
  );
}

function loadExistingKb() {
  if (fs.existsSync(OUT_JSON)) {
    return JSON.parse(fs.readFileSync(OUT_JSON, "utf8"));
  }
  if (fs.existsSync(SAMPLE_JSON)) {
    return JSON.parse(fs.readFileSync(SAMPLE_JSON, "utf8"));
  }
  return { articles: [], flows: [], synonyms: {} };
}

function main() {
  const excelPath = findExcelFile();
  const aoa = readXlsxSheet(excelPath);
  const rows = KbSpreadsheet.rowsFromAoA(aoa);
  const existingKb = loadExistingKb();
  const kb = KbSpreadsheet.buildKbFromRows(rows, existingKb);

  fs.writeFileSync(OUT_JSON, JSON.stringify(kb, null, 2) + "\n", "utf8");

  const preserved = kb.articles.filter((a) =>
    (existingKb.articles || []).some((e) => e.id === a.id && e.steps?.length > 2)
  ).length;

  console.log("Synced KB from Excel:");
  console.log("  Source:", path.relative(ROOT, excelPath));
  console.log("  Output:", path.relative(ROOT, OUT_JSON));
  console.log("  Articles:", kb.articles.length);
  console.log("  Rich guides preserved:", preserved);
  console.log("  lastUpdated:", kb.lastUpdated);
}

main();
