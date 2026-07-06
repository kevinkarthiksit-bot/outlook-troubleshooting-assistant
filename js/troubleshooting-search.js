/**
 * Search and flows for research troubleshooting guide (separate from org KB).
 */
const TroubleshootingSearch = {
  data: null,

  setData(data) {
    this.data = data;
  },

  normalize(text) {
    return (text || "")
      .toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  },

  expandQuery(query) {
    const terms = new Set(this.normalize(query).split(" ").filter(Boolean));
    const synonyms = this.data?.synonyms || {};
    for (const [key, values] of Object.entries(synonyms)) {
      const all = [this.normalize(key), ...values.map((v) => this.normalize(v))];
      if (all.some((t) => query.toLowerCase().includes(t) || terms.has(t))) {
        all.forEach((t) => t.split(" ").forEach((w) => terms.add(w)));
      }
    }
    return [...terms];
  },

  scoreGuide(guide, terms, rawQuery) {
    let score = 0;
    const q = this.normalize(rawQuery);
    const title = this.normalize(guide.title);
    const id = this.normalize(guide.id);
    const category = this.normalize(guide.category);
    const keywords = (guide.keywords || []).map((k) => this.normalize(k)).join(" ");
    const symptoms = (guide.symptoms || []).map((s) => this.normalize(s)).join(" ");

    if (title.includes(q)) score += 50;
    if (id.includes(q)) score += 40;
    if (symptoms.includes(q)) score += 35;

    for (const term of terms) {
      if (term.length < 2) continue;
      if (title.includes(term)) score += 12;
      if (keywords.includes(term)) score += 8;
      if (symptoms.includes(term)) score += 10;
      if (category.includes(term)) score += 5;
    }
    score += Math.max(0, 4 - (guide.priority || 3));
    return score;
  },

  search(query, limit = 12) {
    const guides = this.data?.guides || [];
    const q = (query || "").trim();
    if (!q) return guides.map((g) => ({ ...g, matchLabel: "Available" }));

    const terms = this.expandQuery(q);
    return guides
      .map((guide) => ({ guide, score: this.scoreGuide(guide, terms, q) }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((r, i) => ({
        ...r.guide,
        matchLabel: i === 0 ? "Best match" : i < 3 ? "Related" : "Try if above fails"
      }));
  },

  getGuideById(id) {
    return (this.data?.guides || []).find((g) => g.id === id) || null;
  },

  getGuidesByIds(ids) {
    return (ids || []).map((id) => this.getGuideById(id)).filter(Boolean);
  },

  getCategories() {
    const cats = new Set();
    (this.data?.guides || []).forEach((g) => {
      if (g.category) cats.add(g.category);
    });
    return [...cats].sort();
  },

  getFlows() {
    return this.data?.flows || [];
  }
};

if (typeof window !== "undefined") {
  window.TroubleshootingSearch = TroubleshootingSearch;
}
