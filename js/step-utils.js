/**
 * Rich KB step parsing (string or object). Backward compatible with v1 KB.
 */
const StepUtils = {
  getText(step) {
    if (typeof step === "string") return step;
    if (step && typeof step.text === "string") return step.text;
    return "";
  },

  getImage(step, imageBasePath) {
    if (!step || typeof step === "string") return null;
    const img = step.image || "";
    if (!img) return null;
    if (img.startsWith("http") || img.startsWith("data:") || img.startsWith("/")) return img;
    const base = (imageBasePath || "").replace(/\/?$/, "/");
    return img.includes("/") ? img : base + img;
  },

  getAlt(step) {
    if (!step || typeof step === "string") return "";
    return step.alt || "";
  },

  getTip(step) {
    if (!step || typeof step === "string") return "";
    return step.tip || "";
  },

  getPlatforms(step) {
    if (!step || typeof step === "string") return null;
    return Array.isArray(step.platforms) && step.platforms.length ? step.platforms : null;
  },

  appliesToPlatform(step, platform) {
    const platforms = this.getPlatforms(step);
    if (!platforms) return true;
    return platforms.some((p) => p.toLowerCase() === (platform || "").toLowerCase());
  },

  filterSteps(steps, platform) {
    return (steps || []).filter((s) => this.appliesToPlatform(s, platform));
  },

  getLabel(step, index) {
    const text = this.getText(step);
    const short = text.length > 40 ? text.slice(0, 40) + "..." : text;
    return short || "Step " + (index + 1);
  },

  articleHasImages(article) {
    return (article.steps || []).some((s) => typeof s === "object" && s.image);
  },

  validateStep(step, articleId, index) {
    if (typeof step === "string") {
      if (!step.trim()) throw new Error(articleId + " step " + index + ": empty string step");
      return;
    }
    if (!step || typeof step !== "object") {
      throw new Error(articleId + " step " + index + ": must be string or object");
    }
    if (!step.text || typeof step.text !== "string") {
      throw new Error(articleId + " step " + index + ": object step requires text");
    }
    if (step.image != null && typeof step.image !== "string") {
      throw new Error(articleId + " step " + index + ": image must be a string path");
    }
    if (step.platforms != null && !Array.isArray(step.platforms)) {
      throw new Error(articleId + " step " + index + ": platforms must be an array");
    }
  }
};

if (typeof window !== "undefined") {
  window.StepUtils = StepUtils;
}
