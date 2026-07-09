/**
 * Troubleshooting hub — primary symptom-first entry point.
 */
const TroubleshootingApp = {
  data: null,
  currentFlow: null,
  flowStepIndex: 0,
  searchDebounce: null,
  suggestionState: null,
  browseShowAll: false,

  async init() {
    if (!Session.requireCaseSetup()) return;

    ThemePicker.mount("#themePickerMount");
    Themes.init();
    this.bindEvents();
    await this.loadData();
    await KbLoader.load();
    this.initUser();
    this.renderSessionSummary();
    this.renderQuickFlows();
    this.renderCategories();
    this.renderAllGuides();
    Logger.logAppLaunch();
    this.updateStatus("Ready");
    this.maybeStartFlowFromUrl();
  },

  bindEvents() {
    const searchInput = document.getElementById("searchInput");

    this.suggestionState = SearchSuggestions.mount(searchInput, {
      getSuggestions: (q) => Promise.resolve(UnifiedSearch.suggest(q, { limit: 10, kbReserve: 3 })),
      onSelect: (item) => {
        if (item.type === "flow" && item.flow) {
          this.startFlow(item.flow);
          return;
        }
        GuideResolver.openItem(item);
      },
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
      this.renderAllGuides();
    });

    document.getElementById("closeFlow")?.addEventListener("click", () => this.closeFlow());
    document.getElementById("escalateBtn")?.addEventListener("click", () => this.escalate());

    document.getElementById("editCaseBtn")?.addEventListener("click", () => {
      window.location.href = "case.html?edit=1";
    });

    document.getElementById("refreshGuide")?.addEventListener("click", async () => {
      Storage.clearTsGuideCache();
      await this.loadData(true);
      await KbLoader.load(true);
      this.renderAllGuides();
      this.showToast("Troubleshooting guide refreshed.");
    });

    document.getElementById("startOverBtn")?.addEventListener("click", () => {
      Session.logout();
      window.location.href = "case.html";
    });

    document.querySelectorAll(".ts-flow-chip[data-flow]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const flowId = btn.getAttribute("data-flow");
        const flow = TroubleshootingSearch.getFlows().find((f) => f.id === flowId);
        if (flow) this.startFlow(flow);
      });
    });
  },

  renderSessionSummary() {
    HubUi.renderSessionBadges(
      document.getElementById("sessionSummary"),
      Session.getCaseDetails()
    );
  },

  async loadData(forceRefresh = false) {
    this.updateStatus("Loading troubleshooting guide...");
    this.data = await TroubleshootingLoader.load(forceRefresh);
    const count = this.data?.guides?.length || 0;
    this.updateStatus(
      count ? "Guide loaded (" + count + " topics)" : "Guide load failed",
      !count
    );
  },

  maybeStartFlowFromUrl() {
    const flowId = new URLSearchParams(window.location.search).get("flow");
    if (!flowId) return;
    const flow = TroubleshootingSearch.getFlows().find((f) => f.id === flowId);
    if (flow) this.startFlow(flow);
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
    this.browseShowAll = false;
    if (!q) {
      this.renderAllGuides();
      return;
    }
    const results = UnifiedSearch.search(q);
    Logger.logSearch(q, results.length);
    this.renderGuideResults(results, { query: q });
  },

  renderAllGuides() {
    const platform = PlatformMatch.getSessionPlatform();
    const guides = (this.data?.guides || []).filter((g) =>
      PlatformMatch.guideAppliesToPlatform(g, platform)
    );
    this.renderGuideResults(
      guides.map((g) => ({
        ...g,
        type: "troubleshooting",
        matchLabel: "Available",
        badge: "Guide"
      })),
      { query: "", total: guides.length }
    );
    document.getElementById("noResults").hidden = guides.length > 0;
  },

  renderGuideResults(results, meta = {}) {
    const container = document.getElementById("searchResults");
    const noResults = document.getElementById("noResults");
    const query = meta.query ?? document.getElementById("searchInput")?.value ?? "";
    const total = meta.total ?? this.data?.guides?.length ?? results.length;
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
      noun: "results",
      singular: "result"
    });

    container.innerHTML = "";

    if (!results.length) {
      noResults.hidden = false;
      return;
    }
    noResults.hidden = true;

    visible.forEach((item) => {
      const isKb = item.type === "kb";
      const stepCount = (item.steps || []).length;
      const hasVisuals = !isKb && StepUtils.articleHasImages(item);
      const card = document.createElement("article");
      card.className = "result-card issue-card";
      HubUi.applyCategory(card, item.category);
      card.innerHTML =
        '<div class="result-meta">' +
        '<span class="type-badge type-badge-' +
        (isKb ? "kb" : "guide") +
        '">' +
        this.escape(item.badge || (isKb ? "Org KB" : "Guide")) +
        "</span>" +
        '<span class="kb-id">' + this.escape(item.id) + "</span>" +
        (item.matchLabel && item.matchLabel !== "Available"
          ? '<span class="match-badge">' + this.escape(item.matchLabel) + "</span>"
          : "") +
        (hasVisuals ? '<span class="visual-badge">Has visuals</span>' : "") +
        '<span class="step-count">' + stepCount + " step" + (stepCount !== 1 ? "s" : "") + "</span>" +
        "</div>" +
        "<h3>" + this.escape(item.title) + "</h3>" +
        (item.category
          ? '<p class="category-line"><span class="category-tag">' + this.escape(item.category) + "</span></p>"
          : "") +
        HubUi.buildSymptomTagsHtml(item.symptoms, 2, (s) => this.escape(s));
      card.addEventListener("click", () => GuideResolver.openItem(item));
      container.appendChild(card);
    });

    HubUi.renderShowAllButton(container.parentElement, {
      limited: limited && !showAll,
      hiddenCount,
      onShowAll: () => {
        this.browseShowAll = true;
        this.renderGuideResults(results, { ...meta, showAll: true });
      }
    });
  },

  openGuide(guide) {
    GuideResolver.openItem({ ...guide, type: "troubleshooting" });
  },

  escalate() {
    Session.setEscalated();
    const reason =
      "Case escalated — no matching guide. Last search: " +
      (document.getElementById("searchInput")?.value || "N/A");
    Logger.logEscalation(reason);
    this.showToast("Case escalated. Include this in your session notes.");
  },

  renderQuickFlows() {
    const container = document.getElementById("quickFlows");
    if (!container) return;
    container.innerHTML = "";
    TroubleshootingSearch.getFlows().forEach((flow) => {
      const btn = document.createElement("button");
      btn.className = "flow-chip flow-tile";
      btn.textContent = flow.title;
      btn.addEventListener("click", () => this.startFlow(flow));
      container.appendChild(btn);
    });
  },

  renderCategories() {
    const container = document.getElementById("categoryFilters");
    if (!container) return;
    container.innerHTML = "";
    TroubleshootingSearch.getCategories().forEach((cat) => {
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

  startFlow(flow) {
    this.currentFlow = flow;
    this.flowStepIndex = 0;
    Logger.logFlowStart(flow);
    const panel = document.getElementById("flowPanel");
    panel.hidden = false;
    panel.scrollIntoView({ behavior: "smooth", block: "start" });
    this.renderFlowStep();
  },

  renderFlowStep() {
    const flow = this.currentFlow;
    if (!flow) return;

    let step = flow.steps[this.flowStepIndex];
    if (step.id) {
      step = flow.steps.find((s) => s.id === step.id) || step;
    }

    document.getElementById("flowTitle").textContent = flow.title;
    document.getElementById("flowQuestion").textContent = step.question;

    const optionsEl = document.getElementById("flowOptions");
    optionsEl.innerHTML = "";

    (step.options || []).forEach((opt) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "flow-option";
      btn.textContent = opt.label;
      btn.addEventListener("click", () => this.handleFlowChoice(step, opt));
      optionsEl.appendChild(btn);
    });

    document.getElementById("flowGuideResults").innerHTML = "";
  },

  getOptionGuideIds(option) {
    return option.guideIds || option.kbIds || [];
  },

  handleFlowChoice(step, option) {
    Logger.logFlowStep(this.currentFlow.id, step.question, option.label);

    const guideIds = this.getOptionGuideIds(option);
    const targets = GuideResolver.resolveFlowTargets(guideIds);

    if (option.action === "escalate") {
      this.escalate();
      if (targets.length === 1) {
        GuideResolver.openItem({ ...targets[0].item, type: targets[0].type });
      } else if (targets.length > 1) {
        this.renderFlowGuideResults(targets);
      }
      return;
    }

    if (option.action === "resolved") {
      Session.setResolution("Resolved");
      Logger.logResolution(this.currentFlow?.id || "", this.currentFlow?.title || "");
      this.showToast("Glad that resolved your issue!");
      this.closeFlow();
      return;
    }

    if (option.next) {
      const nextIdx = this.currentFlow.steps.findIndex((s) => s.id === option.next);
      if (nextIdx >= 0) {
        this.flowStepIndex = nextIdx;
        this.renderFlowStep();
        return;
      }
    }

    if (targets.length === 1) {
      GuideResolver.openItem({ ...targets[0].item, type: targets[0].type });
      return;
    }

    if (targets.length > 1) {
      this.renderFlowGuideResults(targets);
      this.showToast("Select a guide below to start step-by-step troubleshooting.");
      return;
    }

    this.showToast("Continue with the next question or mark case as escalated.");
  },

  renderFlowGuideResults(targets) {
    const container = document.getElementById("flowGuideResults");
    container.innerHTML = "<h4>Start troubleshooting</h4>";
    targets.forEach((target) => {
      const item = target.item;
      const card = document.createElement("button");
      card.type = "button";
      card.className = "flow-kb-card";
      const steps = (item.steps || []).length;
      const badge = target.type === "kb" ? "Org KB" : "Guide";
      card.innerHTML =
        "<span class='type-badge type-badge-" +
        (target.type === "kb" ? "kb" : "guide") +
        "'>" +
        this.escape(badge) +
        "</span> " +
        "<strong>" +
        this.escape(item.id) +
        "</strong>: " +
        this.escape(item.title) +
        " <span class='step-count-inline'>(" +
        steps +
        " steps)</span>";
      card.addEventListener("click", () => GuideResolver.openItem({ ...item, type: target.type }));
      container.appendChild(card);
    });
    container.scrollIntoView({ behavior: "smooth", block: "nearest" });
  },

  closeFlow() {
    document.getElementById("flowPanel").hidden = true;
    this.currentFlow = null;
    this.flowStepIndex = 0;
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

document.addEventListener("DOMContentLoaded", () => TroubleshootingApp.init());

if (typeof window !== "undefined") {
  window.TroubleshootingApp = TroubleshootingApp;
}
