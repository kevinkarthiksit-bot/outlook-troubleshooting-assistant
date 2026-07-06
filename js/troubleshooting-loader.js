/**
 * Load research-based troubleshooting guide (separate from org KB).
 */
const TroubleshootingLoader = {
  data: null,

  async load(forceRefresh = false) {
    try {
      if (!forceRefresh) {
        const cached = Storage.getTsGuideCache();
        if (cached) {
          this.data = cached;
          TroubleshootingSearch.setData(cached);
          return cached;
        }
      }

      const cfg = window.SP_CONFIG;
      const res = await fetch(cfg.localTroubleshootingPath || "data/troubleshooting-guide.json");
      if (!res.ok) throw new Error("Failed to load troubleshooting guide");
      this.data = await res.json();
      Storage.setTsGuideCache(this.data);
      TroubleshootingSearch.setData(this.data);
      return this.data;
    } catch (err) {
      console.error(err);
      this.data = { guides: [], flows: [], synonyms: {} };
      TroubleshootingSearch.setData(this.data);
      return this.data;
    }
  },

  getGuide(id) {
    return TroubleshootingSearch.getGuideById(id);
  },

  getData() {
    return this.data;
  }
};

if (typeof window !== "undefined") {
  window.TroubleshootingLoader = TroubleshootingLoader;
}
