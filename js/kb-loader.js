/**
 * Shared KB loading for index and guide pages.
 */
const KbLoader = {
  kbData: null,

  async load(forceRefresh = false) {
    try {
      if (!forceRefresh) {
        const cached = Storage.getKbCache();
        if (cached) {
          this.kbData = cached;
          SearchEngine.setData(cached);
          return cached;
        }
      }

      const cfg = window.SP_CONFIG;
      if (cfg.useSharePoint) {
        this.kbData = await SharePoint.loadKbFromSharePoint();
      } else {
        const adminKb = localStorage.getItem("outlookAssistant_adminKb");
        if (adminKb) {
          this.kbData = JSON.parse(adminKb);
        } else {
          const res = await fetch(cfg.localKbPath);
          if (!res.ok) throw new Error("Failed to load local KB");
          this.kbData = await res.json();
        }
      }
      Storage.setKbCache(this.kbData);
      SearchEngine.setData(this.kbData);
      return this.kbData;
    } catch (err) {
      console.error(err);
      this.kbData = { articles: [], flows: [], synonyms: {} };
      SearchEngine.setData(this.kbData);
      return this.kbData;
    }
  },

  getArticle(kbId) {
    return SearchEngine.getArticleById(kbId);
  },

  getData() {
    return this.kbData;
  }
};

if (typeof window !== "undefined") {
  window.KbLoader = KbLoader;
}
