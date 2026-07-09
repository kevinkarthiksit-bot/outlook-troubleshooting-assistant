/**
 * Main application controller — org KB hub (secondary browse).
 */
const App = {
  kbData: null,
  searchDebounce: null,
  suggestionState: null,
  browseShowAll: false,

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
    const platform = PlatformMatch.getSessionPlatform();

    this.suggestionState = SearchSuggestions.mount(searchInput, {
      getSuggestions: (q) =>
        Promise.resolve(
          SearchEngine.search(q, 8, { platform }).map((article) => ({
            ...article,
            type: "kb",
            badge: "Org KB"
          }))
        ),
      onSelect: (item) => GuideResolver.openItem(item),
      onSubmit: (q) => this.handleSearch(q)
    });

    searchInput?.addEventListener("input", (e) => {
      clearTimeout(this.searchDebounce);
      this.searchDebounce = setTimeout(() => this.handleSearch(e.target.value), 250);
    });
    document.getElementById("clearSearch")?.addEventListener("click", () => {
      searchInput.value = "";
      this.browseShowAll = false;
      SearchSuggestions.hide(this.suggestionState);
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
      window.location.href = "case.html?edit=1";
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
    Logger.init(Session.getAgentId());
    const display = document.getElementById("userDisplay");
    if (display) display.textContent = "IMS: " + identity;
  },

  handleSearch(query) {
    const q = (query || "").trim();
    const platform = PlatformMatch.getSessionPlatform();
    this.browseShowAll = false;
    if (!q) {
      this.renderAllIssues();
      return;
    }
    const results = SearchEngine.search(q, 12, { platform });
    Logger.logSearch(q, results.length);
    this.renderSearchResults(results, { query: q });
  },

  renderAllIssues() {
    const platform = PlatformMatch.getSessionPlatform();
    const articles = (this.kbData?.articles || []).filter((a) =>
      PlatformMatch.articleAppliesToPlatform(a, platform)
    );
    this.renderSearchResults(
      articles.map((article) => ({
        ...article,
        type: "kb",
        matchLabel: "Available",
        badge: "Org KB"
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
    const showAll = meta.showAll ?? this.browseShowAll;
    const { visible, limited, hiddenCount } = HubUi.getVisibleResults(
      results,
      showAll ? { limit: results.length } : {}
    );
    container.classList.toggle("result-grid-expanded", showAll || !limited);

    HubUi.updateResultCount(document.getElementById("resultCount"), {
      displayed: visible.length,
      total: query ? results.length : total,
      query: (query || "").trim(),
      limited,
      noun: "articles",
      singular: "article"
    });

    container.innerHTML = "";

    if (!results.length) {
      noResults.hidden = false;
      return;
    }
    noResults.hidden = true;

    visible.forEach((article) => {
      const stepCount = (article.steps || []).length;
      const card = document.createElement("article");
      card.className = "result-card issue-card";
      HubUi.applyCategory(card, article.category);
      card.innerHTML =
        '<div class="result-meta">' +
        '<span class="type-badge type-badge-kb">Org KB</span>' +
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
        HubUi.buildSymptomTagsHtml(article.symptoms, 2, (s) => this.escape(s));
      card.addEventListener("click", () => GuideResolver.openItem({ ...article, type: "kb" }));
      container.appendChild(card);
    });

    HubUi.renderShowAllButton(container.parentElement, {
      limited: limited && !showAll,
      hiddenCount,
      onShowAll: () => {
        this.browseShowAll = true;
        this.renderSearchResults(results, { ...meta, showAll: true });
      }
    });
  },

  openArticle(article) {
    GuideResolver.openItem({ ...article, type: "kb" });
  },

  escalate() {
    Session.setEscalated();
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
