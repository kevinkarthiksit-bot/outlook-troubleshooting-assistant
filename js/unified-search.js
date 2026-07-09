/**
 * Unified search across troubleshooting guides (first) and org KB.
 */
const UnifiedSearch = {
  getPlatform(options) {
    return options?.platform ?? PlatformMatch.getSessionPlatform();
  },

  matchFlows(query, platform) {
    const q = (query || "").trim().toLowerCase();
    if (!q) return [];
    const flows = TroubleshootingSearch.getFlows() || [];
    return flows
      .filter((flow) => {
        const title = (flow.title || "").toLowerCase();
        const id = (flow.id || "").toLowerCase();
        return title.includes(q) || id.includes(q.replace(/\s+/g, "-"));
      })
      .map((flow) => ({
        id: flow.id,
        title: flow.title,
        type: "flow",
        flow,
        score: 45,
        matchLabel: "Guided flow",
        subtitle: "Symptom wizard"
      }));
  },

  sortByScore(items) {
    return [...items].sort((a, b) => (b.score || 0) - (a.score || 0));
  },

  /** Guides and flows first, then org KB — each group sorted by relevance. */
  mergeTiered(tsItems, kbItems, limit, kbReserve = 3) {
    const tsPool = this.sortByScore(tsItems);
    const kbPool = this.sortByScore(kbItems);
    if (!tsPool.length) {
      return kbPool.slice(0, limit);
    }
    if (!kbPool.length) {
      return tsPool.slice(0, limit);
    }

    const reservedKb = Math.min(kbReserve, kbPool.length, Math.max(1, limit - 1));
    const tsTake = Math.min(tsPool.length, limit - reservedKb);
    const kbTake = Math.min(kbPool.length, limit - tsTake);
    return [...tsPool.slice(0, tsTake), ...kbPool.slice(0, kbTake)];
  },

  suggest(query, options = {}) {
    const q = (query || "").trim();
    if (q.length < 2) return [];

    const platform = this.getPlatform(options);
    const limit = options.limit ?? 10;
    const kbOnly = options.kbOnly ?? false;
    const kbReserve = options.kbReserve ?? 3;
    const tsItems = [];
    const kbItems = [];

    if (!kbOnly) {
      tsItems.push(...this.matchFlows(q, platform));
      TroubleshootingSearch.search(q, limit * 2, { platform }).forEach((guide) => {
        tsItems.push({
          ...guide,
          type: "troubleshooting",
          score: guide.relevanceScore || 0,
          badge: "Guide"
        });
      });
    }

    SearchEngine.search(q, limit * 2, { platform }).forEach((article) => {
      kbItems.push({
        ...article,
        type: "kb",
        score: article.relevanceScore || 0,
        badge: "Org KB"
      });
    });

    return this.mergeTiered(tsItems, kbItems, limit, kbReserve);
  },

  search(query, options = {}) {
    const q = (query || "").trim();
    const platform = this.getPlatform(options);
    const limit = options.limit ?? 12;
    const kbOnly = options.kbOnly ?? false;

    if (!q) {
      if (kbOnly) {
        return (SearchEngine.kbData?.articles || []).map((a) => ({
          ...a,
          type: "kb",
          matchLabel: "Available",
          badge: "Org KB"
        }));
      }
      const guides = (TroubleshootingSearch.data?.guides || []).map((g) => ({
        ...g,
        type: "troubleshooting",
        matchLabel: "Available",
        badge: "Guide"
      }));
      const articles = (SearchEngine.kbData?.articles || []).map((a) => ({
        ...a,
        type: "kb",
        matchLabel: "Available",
        badge: "Org KB"
      }));
      return [...guides, ...articles];
    }

    const merged = this.suggest(q, { ...options, limit: limit * 2, kbOnly });
    return merged.map((item, i) => ({
      ...item,
      matchLabel:
        item.matchLabel ||
        (i === 0 ? "Best match" : i < 3 ? "Related" : "Try if above fails")
    }));
  }
};

if (typeof window !== "undefined") {
  window.UnifiedSearch = UnifiedSearch;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { UnifiedSearch };
}
