/**
 * Platform applicability helpers for search and routing.
 */
const PlatformMatch = {
  getSessionPlatform() {
    if (typeof Session !== "undefined" && Session.getCaseDetails) {
      return Session.getCaseDetails()?.platform || "Windows";
    }
    return "Windows";
  },

  itemHasApplicableSteps(item, platform) {
    const steps = item?.steps || [];
    if (!steps.length) return true;
    return steps.some((s) => StepUtils.appliesToPlatform(s, platform));
  },

  guideAppliesToPlatform(guide, platform) {
    return this.itemHasApplicableSteps(guide, platform);
  },

  articleAppliesToPlatform(article, platform) {
    return this.itemHasApplicableSteps(article, platform);
  },

  clientBoost(guide, platform) {
    const client = (guide?.client || "both").toLowerCase();
    const p = (platform || "").toLowerCase();
    if (p === "mobile" || p === "web") {
      if (client === "new" || client === "both") return 10;
      if (client === "classic") return -5;
    }
    return 0;
  },

  platformBoost(item, platform, isGuide) {
    if (!platform) return 0;
    if (!this.itemHasApplicableSteps(item, platform)) return -1000;
    let boost = 18;
    if (isGuide) boost += this.clientBoost(item, platform);
    return boost;
  }
};

if (typeof window !== "undefined") {
  window.PlatformMatch = PlatformMatch;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { PlatformMatch };
}
