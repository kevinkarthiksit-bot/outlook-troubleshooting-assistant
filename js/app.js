/**
 * Main application controller — org KB only.
 */
const App = {
  kbData: null,
  searchDebounce: null,

  async init() {
    if (!Session.requireCaseSetup()) return;

    ThemePicker.mount("#themePickerMount");
    Themes.init();
    this.bindEvents();
    await this.loadKb();
    this.initUser();
    this.renderSessionSummary();
    this.renderCategories();
    this.renderAllIssues();
    Logger.logAppLaunch();
    this.updateStatus("Ready");
  },

  bindEvents() {
    const searchInput = document.getElementById("searchInput");
    searchInput?.addEventListener("input", (e) => {
      clearTimeout(this.searchDebounce);
      this.searchDebounce = setTimeout(() => this.handleSearch(e.target.value), 250);
    });
    searchInput?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") this.handleSearch(e.target.value);
    });

    document.getElementById("clearSearch")?.addEventListener("click", () => {
      searchInput.value = "";
      this.renderAllIssues();
    });

    document.getElementById("escalateBtn")?.addEventListener("click", () => this.escalate());

    document.getElementById("refreshKb")?.addEventListener("click", async () => {
      Storage.clearKbCache();
      await this.loadKb(true);
      this.renderAllIssues();
      this.showToast("Knowledge base refreshed.");
    });

    document.getElementById("startOverBtn")?.addEventListener("click", () => {
      Session.logout();
      window.location.href = "case.html";
    });

    document.getElementById("editCaseBtn")?.addEventListener("click", () => {
      window.location.href = "case.html";
    });
  },

  renderSessionSummary() {
    HubUi.renderSessionBadges(
      document.getElementById("sessionSummary"),
      Session.getCaseDetails()
    );
  },

  async loadKb(forceRefresh = false) {
    this.updateStatus("Loading knowledge base...");
    this.kbData = await KbLoader.load(forceRefresh);
    const count = this.kbData?.articles?.length || 0;
    this.updateStatus(count ? "KB loaded (" + count + " articles)" : "KB load failed - using empty set", !count);
  },

  initUser() {
    Session.ensureAnonymousSession();
    const identity = Session.getLogIdentity();
    Logger.init(identity);
    const display = document.getElementById("userDisplay");
    if (display) display.textContent = "IMS: " + identity;
  },

  handleSearch(query) {
    const q = (query || "").trim();
    if (!q) {
      this.renderAllIssues();
      return;
    }
    const results = SearchEngine.search(q);
    Logger.logSearch(q, results.length);
    this.renderSearchResults(results, { query: q });
  },

  renderAllIssues() {
    const articles = this.kbData?.articles || [];
    this.renderSearchResults(
      articles.map((article) => ({
        ...article,
        matchLabel: "Available"
      })),
      { query: "", total: articles.length }
    );
    document.getElementById("noResults").hidden = articles.length > 0;
  },

  renderSearchResults(results, meta = {}) {
    const container = document.getElementById("searchResults");
    const noResults = document.getElementById("noResults");
    const query = meta.query ?? document.getElementById("searchInput")?.value ?? "";
    const total = meta.total ?? this.kbData?.articles?.length ?? results.length;

    HubUi.updateResultCount(document.getElementById("resultCount"), {
      count: results.length,
      total,
      query: (query || "").trim(),
      noun: "articles",
      singular: "article"
    });

    container.innerHTML = "";

    if (!results.length) {
      noResults.hidden = false;
      return;
    }
    noResults.hidden = true;

    results.forEach((article) => {
      const stepCount = (article.steps || []).length;
      const card = document.createElement("article");
      card.className = "result-card issue-card";
      HubUi.applyCategory(card, article.category);
      card.innerHTML =
        '<div class="result-meta">' +
        '<span class="kb-id">' + this.escape(article.id) + "</span>" +
        (article.matchLabel && article.matchLabel !== "Available"
          ? '<span class="match-badge">' + this.escape(article.matchLabel) + "</span>"
          : "") +
        '<span class="step-count">' + stepCount + " step" + (stepCount !== 1 ? "s" : "") + "</span>" +
        "</div>" +
        "<h3>" + this.escape(article.title) + "</h3>" +
        (article.category
          ? '<p class="category-line"><span class="category-tag">' + this.escape(article.category) + "</span></p>"
          : "") +
        HubUi.buildSymptomTagsHtml(article.symptoms, 3, (s) => this.escape(s));
      card.addEventListener("click", () => this.openArticle(article));
      container.appendChild(card);
    });
  },

  openArticle(article) {
    const platform = Session.getCaseDetails()?.platform || "Windows";
    const steps = StepUtils.filterSteps(article.steps || [], platform);
    const count = steps.length || (article.steps || []).length;
    Session.startGuide(article.id, article.title, count, "kb");
    Logger.logArticleView(article);
    window.location.href = "guide.html?kb=" + encodeURIComponent(article.id);
  },

  escalate() {
    const reason =
      "Case escalated — no matching KB. Last search: " +
      (document.getElementById("searchInput")?.value || "N/A");
    Logger.logEscalation(reason);
    this.showToast("Case escalated. Include this in your session notes when documenting the ticket.");
  },

  renderCategories() {
    const container = document.getElementById("categoryFilters");
    if (!container) return;
    container.innerHTML = "";
    SearchEngine.getCategories().forEach((cat) => {
      const btn = document.createElement("button");
      btn.className = "category-chip";
      btn.textContent = cat;
      HubUi.applyCategory(btn, cat);
      btn.addEventListener("click", () => {
        document.getElementById("searchInput").value = cat;
        this.handleSearch(cat);
      });
      container.appendChild(btn);
    });
  },

  updateStatus(msg, isError = false) {
    const el = document.getElementById("statusBar");
    if (el) {
      el.textContent = msg;
      el.classList.toggle("error", isError);
    }
  },

  showToast(msg) {
    const toast = document.getElementById("toast");
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 3000);
  },

  escape(str) {
    const div = document.createElement("div");
    div.textContent = str || "";
    return div.innerHTML;
  }
};

document.addEventListener("DOMContentLoaded", () => App.init());

if (typeof window !== "undefined") {
  window.App = App;
}
