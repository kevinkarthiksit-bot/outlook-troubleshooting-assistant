/**
 * Read .xlsx without npm dependencies (Office Open XML zip + sheet XML).
 */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const os = require("os");

function readXlsxSheet(xlsxPath) {
  if (!fs.existsSync(xlsxPath)) {
    throw new Error("Excel file not found: " + xlsxPath);
  }

  const tmp = path.join(os.tmpdir(), "oa-xlsx-" + Date.now());
  fs.mkdirSync(tmp, { recursive: true });

  try {
    const zipPath = path.join(tmp, "book.zip");
    fs.copyFileSync(xlsxPath, zipPath);
    execSync(
      `powershell -NoProfile -Command "Expand-Archive -LiteralPath '${zipPath.replace(/'/g, "''")}' -DestinationPath '${tmp.replace(/'/g, "''")}' -Force"`,
      { stdio: "pipe" }
    );

    const sharedStringsPath = path.join(tmp, "xl", "sharedStrings.xml");
    const sheetPath = path.join(tmp, "xl", "worksheets", "sheet1.xml");
    if (!fs.existsSync(sheetPath)) {
      throw new Error("Could not read first worksheet from Excel file");
    }

    const sharedStrings = [];
    if (fs.existsSync(sharedStringsPath)) {
      const xml = fs.readFileSync(sharedStringsPath, "utf8");
      const re = /<si>(?:<t[^>]*>([^<]*)<\/t>|<r><t[^>]*>([^<]*)<\/t>)/g;
      let m;
      while ((m = re.exec(xml))) {
        sharedStrings.push(m[1] || m[2] || "");
      }
    }

    function cellValue(cellXml) {
      const tMatch = cellXml.match(/t="([^"]+)"/);
      const vMatch = cellXml.match(/<v>([^<]*)<\/v>/);
      if (!vMatch) return "";
      const v = vMatch[1];
      if (tMatch && tMatch[1] === "s") return sharedStrings[parseInt(v, 10)] || "";
      return v;
    }

    function colIndex(ref) {
      const letters = (ref.match(/^([A-Z]+)/) || [])[1] || "A";
      let n = 0;
      for (let i = 0; i < letters.length; i++) {
        n = n * 26 + (letters.charCodeAt(i) - 64);
      }
      return n - 1;
    }

    const sheetXml = fs.readFileSync(sheetPath, "utf8");
    const rowRe = /<row[^>]*>([\s\S]*?)<\/row>/g;
    const rows = [];
    let rowMatch;

    while ((rowMatch = rowRe.exec(sheetXml))) {
      const cells = [];
      const cellRe = /<c[^>]*>[\s\S]*?<\/c>/g;
      let cellMatch;
      while ((cellMatch = cellRe.exec(rowMatch[1]))) {
        const ref = (cellMatch[0].match(/r="([A-Z]+\d+)"/) || [])[1] || "";
        const idx = colIndex(ref);
        cells[idx] = cellValue(cellMatch[0]);
      }
      rows.push(cells.map((c) => c ?? ""));
    }

    return rows;
  } finally {
    try {
      fs.rmSync(tmp, { recursive: true, force: true });
    } catch (_) {}
  }
}

module.exports = { readXlsxSheet };
