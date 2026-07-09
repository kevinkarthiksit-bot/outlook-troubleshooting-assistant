/**
 * KB search and relevance scoring.
 */
const SearchEngine = {
  kbData: null,

  setData(data) {
    this.kbData = data;
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
    const synonyms = this.kbData?.synonyms || {};
    for (const [key, values] of Object.entries(synonyms)) {
      const keyNorm = this.normalize(key);
      const all = [keyNorm, ...values.map((v) => this.normalize(v))];
      if (all.some((t) => query.toLowerCase().includes(t) || terms.has(t))) {
        all.forEach((t) => t.split(" ").forEach((w) => terms.add(w)));
      }
    }
    return [...terms];
  },

  scoreArticle(article, terms, rawQuery, platform) {
    let score = 0;
    const q = this.normalize(rawQuery);
    const title = this.normalize(article.title);
    const id = this.normalize(article.id);
    const category = this.normalize(article.category);
    const keywords = (article.keywords || []).map((k) => this.normalize(k)).join(" ");
    const symptoms = (article.symptoms || []).map((s) => this.normalize(s)).join(" ");

    if (title.includes(q)) score += 50;
    if (id.includes(q)) score += 40;
    if (symptoms.includes(q)) score += 35;

    for (const term of terms) {
      if (term.length < 2) continue;
      if (title.includes(term)) score += 12;
      if (keywords.includes(term)) score += 8;
      if (symptoms.includes(term)) score += 10;
      if (category.includes(term)) score += 5;
      if (id.includes(term)) score += 6;
    }

    score += Math.max(0, 4 - (article.priority || 3));
    if (typeof PlatformMatch !== "undefined" && platform) {
      score += PlatformMatch.platformBoost(article, platform, false);
    }
    return score;
  },

  search(query, limit = 10, options = {}) {
    if (!this.kbData?.articles?.length) return [];
    const q = (query || "").trim();
    if (!q) return [];

    const platform = options.platform;
    const terms = this.expandQuery(q);
    const results = this.kbData.articles
      .map((article) => ({
        article,
        score: this.scoreArticle(article, terms, q, platform)
      }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return results.map((r, i) => ({
      ...r.article,
      relevanceScore: r.score,
      matchLabel: i === 0 ? "Best match" : i < 3 ? "Related" : "Try if above fails"
    }));
  },

  getArticleById(id) {
    return (this.kbData?.articles || []).find((a) => a.id === id) || null;
  },

  getArticlesByIds(ids) {
    return (ids || []).map((id) => this.getArticleById(id)).filter(Boolean);
  },

  getCategories() {
    const cats = new Set();
    (this.kbData?.articles || []).forEach((a) => {
      if (a.category) cats.add(a.category);
    });
    return [...cats].sort();
  },

  getFlows() {
    return this.kbData?.flows || [];
  },

  getFlowById(id) {
    return this.getFlows().find((f) => f.id === id) || null;
  }
};

if (typeof window !== "undefined") {
  window.SearchEngine = SearchEngine;
}
