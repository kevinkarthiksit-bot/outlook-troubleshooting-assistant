/**
 * Routes users through troubleshooting guides first, then org KB when needed.
 */
const GuideResolver = {
  normalize(text) {
    return (text || "")
      .toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  },

  tokens(text) {
    return new Set(
      this.normalize(text)
        .split(" ")
        .filter((w) => w.length > 2)
    );
  },

  overlapScore(source, target) {
    let score = 0;
    const sourceTokens = this.tokens(
      [source.title, ...(source.keywords || []), ...(source.symptoms || [])].join(" ")
    );
    const targetTokens = this.tokens(
      [target.title, ...(target.keywords || []), ...(target.symptoms || [])].join(" ")
    );
    for (const t of sourceTokens) {
      if (targetTokens.has(t)) score += 4;
    }
    const sTitle = this.normalize(source.title);
    const tTitle = this.normalize(target.title);
    if (sTitle && tTitle && (sTitle.includes(tTitle) || tTitle.includes(sTitle))) {
      score += 20;
    }
    for (const symptom of source.symptoms || []) {
      const s = this.normalize(symptom);
      if (s && tTitle.includes(s)) score += 12;
    }
    return score;
  },

  getTsSearch() {
    return typeof TroubleshootingSearch !== "undefined" ? TroubleshootingSearch : null;
  },

  getKbSearch() {
    return typeof SearchEngine !== "undefined" ? SearchEngine : null;
  },

  findRelatedTsGuide(kbArticle) {
    if (!kbArticle) return null;
    const ts = this.getTsSearch();
    if (!ts) return null;
    if (kbArticle.relatedGuideId) {
      return ts.getGuideById(kbArticle.relatedGuideId);
    }
    const guides = ts.data?.guides || [];
    let best = null;
    let bestScore = 0;
    for (const guide of guides) {
      const score = this.overlapScore(kbArticle, guide);
      if (score > bestScore) {
        bestScore = score;
        best = guide;
      }
    }
    return bestScore >= 15 ? best : null;
  },

  findRelatedKb(tsGuide) {
    if (!tsGuide) return null;
    const kb = this.getKbSearch();
    if (!kb) return null;
    if (tsGuide.relatedKbId) {
      return kb.getArticleById(tsGuide.relatedKbId);
    }
    const articles = kb.kbData?.articles || [];
    let best = null;
    let bestScore = 0;
    for (const article of articles) {
      const score = this.overlapScore(tsGuide, article);
      if (score > bestScore) {
        bestScore = score;
        best = article;
      }
    }
    return bestScore >= 15 ? best : null;
  },

  resolveItem(item) {
    if (!item) return null;
    if (item.type === "troubleshooting" || item.guideType === "troubleshooting") {
      return { type: "troubleshooting", item, kbFallback: null };
    }
    if (item.type === "flow") {
      return { type: "flow", item: item.flow || item };
    }
    const tsGuide = this.findRelatedTsGuide(item);
    if (tsGuide) {
      return { type: "troubleshooting", item: tsGuide, kbFallback: item };
    }
    return { type: "kb", item, kbFallback: null };
  },

  async openItem(item) {
    const resolved = this.resolveItem(item);
    if (!resolved) return;

    if (resolved.type === "flow") {
      if (typeof TroubleshootingApp !== "undefined") {
        TroubleshootingApp.startFlow(resolved.item);
      }
      return;
    }

    const platform = PlatformMatch.getSessionPlatform();

    if (resolved.type === "troubleshooting") {
      const guide = resolved.item;
      const steps = StepUtils.filterSteps(guide.steps || [], platform);
      const count = steps.length || (guide.steps || []).length;
      Session.startGuide(guide.id, guide.title, count, "troubleshooting");
      if (resolved.kbFallback?.id) {
        Session.updateGuideSession({ fallbackKbId: resolved.kbFallback.id });
      }
      try {
        await Logger.logArticleView({ id: guide.id, title: guide.title });
      } catch (err) {
        console.warn("Article view logging failed:", err);
      }
      window.location.href =
        "troubleshooting-guide.html?guide=" + encodeURIComponent(guide.id);
      return;
    }

    const article = resolved.item;
    const steps = StepUtils.filterSteps(article.steps || [], platform);
    const count = steps.length || (article.steps || []).length;
    const existing = Session.getGuideSession();
    const isTsKbFallback =
      existing?.guideType === "troubleshooting" &&
      existing.fallbackKbId === article.id;

    if (isTsKbFallback) {
      Session.updateGuideSession({
        guideType: "kb",
        kbId: article.id,
        kbTitle: article.title,
        stepCount: count,
        currentStepIndex: 0
      });
    } else {
      Session.startGuide(article.id, article.title, count, "kb");
    }
    try {
      await Logger.logArticleView(article);
    } catch (err) {
      console.warn("Article view logging failed:", err);
    }
    window.location.href = "guide.html?kb=" + encodeURIComponent(article.id);
  },

  openGuideById(id) {
    const ts = this.getTsSearch();
    const guide = ts?.getGuideById(id);
    if (guide) {
      this.openItem({ ...guide, type: "troubleshooting" });
      return true;
    }
    const kb = this.getKbSearch();
    const article = kb?.getArticleById(id);
    if (article) {
      this.openItem({ ...article, type: "kb" });
      return true;
    }
    return false;
  },

  resolveFlowTargets(ids) {
    const platform = PlatformMatch.getSessionPlatform();
    const ts = this.getTsSearch();
    const kb = this.getKbSearch();
    const targets = [];
    const seen = new Set();

    for (const id of ids || []) {
      if (!id || seen.has(id)) continue;

      const guide = ts?.getGuideById(id);
      if (guide && PlatformMatch.guideAppliesToPlatform(guide, platform)) {
        seen.add(id);
        targets.push({ type: "troubleshooting", item: guide });
        continue;
      }

      const article = kb?.getArticleById(id);
      if (article && PlatformMatch.articleAppliesToPlatform(article, platform)) {
        seen.add(id);
        targets.push({ type: "kb", item: article });
      }
    }

    return targets;
  }
};

if (typeof window !== "undefined") {
  window.GuideResolver = GuideResolver;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { GuideResolver };
}
