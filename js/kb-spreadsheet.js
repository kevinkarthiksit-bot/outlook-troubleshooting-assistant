/**
 * Build org KB articles from spreadsheet rows (Excel export / CSV).
 * Shared by admin upload and scripts/sync-kb-from-excel.js.
 */
const KbSpreadsheet = {
  STUB_STEPS: [
    "Refer to the full KB article for detailed steps.",
    "Contact IT if you need assistance."
  ],

  extractCategory(title) {
    const match = (title || "").match(/\[([^\]]+)\]/);
    return match ? match[1] : "General";
  },

  titleKeywords(title) {
    return (title || "")
      .toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2);
  },

  deriveSymptoms(title) {
    const symptoms = [];
    const stripped = (title || "").replace(/^\[[^\]]+\]\s*/, "").trim();
    if (!stripped) return symptoms;
    if (stripped.length >= 8 && stripped.length <= 100) {
      symptoms.push(stripped);
    }
    const afterDash = stripped.split(/\s[-—]\s/)[0]?.trim();
    if (afterDash && afterDash !== stripped && afterDash.length >= 8) {
      symptoms.push(afterDash);
    }
    return [...new Set(symptoms)].slice(0, 2);
  },

  articleFromRow(id, title, existing) {
    const cleanId = (id || "").trim();
    const cleanTitle = (title || "").trim();
    if (!cleanId || !cleanTitle) return null;

    const derivedSymptoms = this.deriveSymptoms(cleanTitle);

    if (existing) {
      return {
        ...existing,
        id: cleanId,
        title: cleanTitle,
        category: existing.category || this.extractCategory(cleanTitle),
        symptoms: existing.symptoms?.length ? existing.symptoms : derivedSymptoms
      };
    }

    return {
      id: cleanId,
      title: cleanTitle,
      category: this.extractCategory(cleanTitle),
      keywords: this.titleKeywords(cleanTitle),
      symptoms: derivedSymptoms,
      priority: 3,
      steps: [...this.STUB_STEPS],
      url: ""
    };
  },

  buildKbFromRows(rows, existingKb) {
    const existingById = new Map((existingKb?.articles || []).map((a) => [a.id, a]));
    const articles = [];

    for (const row of rows) {
      const article = this.articleFromRow(row.id, row.title, existingById.get(row.id));
      if (article) articles.push(article);
    }

    if (articles.length === 0) {
      throw new Error("Spreadsheet must contain at least one article row");
    }

    return {
      version: existingKb?.version || "1.0.0",
      lastUpdated: new Date().toISOString().slice(0, 10),
      articles,
      flows: [],
      synonyms: existingKb?.synonyms || {}
    };
  },

  normalizeHeader(header) {
    return (header || "").trim().replace(/^"|"$/g, "").toLowerCase();
  },

  findColumnIndexes(headers) {
    const normalized = headers.map((h) => this.normalizeHeader(h));
    const idIdx = normalized.findIndex((h) => /^(number|id|kb number|kb id)$/.test(h) || /^number$/.test(h));
    const titleIdx = normalized.findIndex((h) =>
      /^(short description|description|title|short desc)$/.test(h)
    );
    if (idIdx < 0 || titleIdx < 0) {
      throw new Error('Spreadsheet must have "Number" and "Short description" columns');
    }
    return { idIdx, titleIdx };
  },

  rowsFromAoA(aoa) {
    if (!aoa || aoa.length < 2) {
      throw new Error("Spreadsheet must have a header row and at least one data row");
    }
    const { idIdx, titleIdx } = this.findColumnIndexes(aoa[0].map((c) => String(c ?? "")));
    const rows = [];
    for (let i = 1; i < aoa.length; i++) {
      const line = aoa[i] || [];
      rows.push({
        id: String(line[idIdx] ?? "").trim(),
        title: String(line[titleIdx] ?? "").trim()
      });
    }
    return rows;
  },

  parseCsvLine(line) {
    const result = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === "," && !inQuotes) {
        result.push(current);
        current = "";
      } else {
        current += ch;
      }
    }
    result.push(current);
    return result.map((s) => s.replace(/^"|"$/g, "").trim());
  },

  parseCsv(text, existingKb) {
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) throw new Error("CSV must have header and data rows");

    const headers = this.parseCsvLine(lines[0]);
    const { idIdx, titleIdx } = this.findColumnIndexes(headers);
    const rows = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = this.parseCsvLine(lines[i]);
      rows.push({
        id: (cols[idIdx] || "").trim(),
        title: (cols[titleIdx] || "").trim()
      });
    }

    return this.buildKbFromRows(rows, existingKb);
  }
};

if (typeof window !== "undefined") {
  window.KbSpreadsheet = KbSpreadsheet;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { KbSpreadsheet };
}
