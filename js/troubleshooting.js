/**
 * Troubleshooting hub — guided flows and research guide browser.
 */
const TroubleshootingApp = {
  data: null,
  currentFlow: null,
  flowStepIndex: 0,
  searchDebounce: null,

  async init() {
    if (!Session.requireCaseSetup()) return;

    ThemePicker.mount("#themePickerMount");
    Themes.init();
    this.bindEvents();
    await this.loadData();
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
    searchInput?.addEventListener("input", (e) => {
      clearTimeout(this.searchDebounce);
      this.searchDebounce = setTimeout(() => this.handleSearch(e.target.value), 250);
    });
    searchInput?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") this.handleSearch(e.target.value);
    });

    document.getElementById("clearSearch")?.addEventListener("click", () => {
      searchInput.value = "";
      this.renderAllGuides();
    });

    document.getElementById("closeFlow")?.addEventListener("click", () => this.closeFlow());
    document.getElementById("escalateBtn")?.addEventListener("click", () => this.escalate());

    document.getElementById("refreshGuide")?.addEventListener("click", async () => {
      Storage.clearTsGuideCache();
      await this.loadData(true);
      this.renderAllGuides();
      this.showToast("Troubleshooting guide refreshed.");
    });

    document.getElementById("startOverBtn")?.addEventListener("click", () => {
      Session.logout();
      window.location.href = "login.html";
    });
  },

  renderSessionSummary() {
    const details = Session.getCaseDetails();
    const el = document.getElementById("sessionSummary");
    if (!el) return;
    el.textContent =
      "IMS: " + (details.chatIms || "N/A") +
      " | " + (details.platform || "N/A") +
      " | " + (details.environment || "N/A");
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
    const employeeId = Session.getEmployeeId();
    Logger.init(employeeId);
    const display = document.getElementById("userDisplay");
    if (display) display.textContent = "Employee: " + employeeId;
  },

  handleSearch(query) {
    const q = (query || "").trim();
    if (!q) {
      this.renderAllGuides();
      return;
    }
    const results = TroubleshootingSearch.search(q);
    Logger.logSearch(q, results.length);
    this.renderGuideResults(results);
  },

  renderAllGuides() {
    const guides = this.data?.guides || [];
    this.renderGuideResults(
      guides.map((g) => ({ ...g, matchLabel: "Available" }))
    );
    document.getElementById("noResults").hidden = guides.length > 0;
  },

  renderGuideResults(results) {
    const container = document.getElementById("searchResults");
    const noResults = document.getElementById("noResults");
    container.innerHTML = "";

    if (!results.length) {
      noResults.hidden = false;
      return;
    }
    noResults.hidden = true;

    results.forEach((guide) => {
      const stepCount = (guide.steps || []).length;
      const hasVisuals = StepUtils.articleHasImages(guide);
      const card = document.createElement("article");
      card.className = "result-card issue-card";
      card.innerHTML =
        '<div class="result-meta">' +
        '<span class="kb-id">' + this.escape(guide.id) + "</span>" +
        (guide.matchLabel && guide.matchLabel !== "Available"
          ? '<span class="match-badge">' + this.escape(guide.matchLabel) + "</span>"
          : "") +
        (hasVisuals ? '<span class="visual-badge">Has visuals</span>' : "") +
        '<span class="step-count">' + stepCount + " step" + (stepCount !== 1 ? "s" : "") + "</span>" +
        "</div>" +
        "<h3>" + this.escape(guide.title) + "</h3>" +
        (guide.category ? '<p class="symptoms">' + this.escape(guide.category) + "</p>" : "");
      card.addEventListener("click", () => this.openGuide(guide));
      container.appendChild(card);
    });
  },

  openGuide(guide) {
    const platform = Session.getCaseDetails()?.platform || "Windows";
    const steps = StepUtils.filterSteps(guide.steps || [], platform);
    const count = steps.length || (guide.steps || []).length;
    Session.startGuide(guide.id, guide.title, count, "troubleshooting");
    Logger.logArticleView({ id: guide.id, title: guide.title });
    window.location.href = "troubleshooting-guide.html?guide=" + encodeURIComponent(guide.id);
  },

  escalate() {
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
      btn.className = "flow-chip";
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

    if (option.action === "escalate") {
      this.escalate();
      if (guideIds.length === 1) {
        this.openGuide(TroubleshootingSearch.getGuideById(guideIds[0]));
      } else if (guideIds.length > 1) {
        this.renderFlowGuideResults(guideIds);
      }
      return;
    }

    if (option.action === "resolved") {
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

    if (guideIds.length === 1) {
      const guide = TroubleshootingSearch.getGuideById(guideIds[0]);
      if (guide) {
        this.openGuide(guide);
        return;
      }
    }

    if (guideIds.length > 1) {
      this.renderFlowGuideResults(guideIds);
      this.showToast("Select a guide below to start step-by-step troubleshooting.");
      return;
    }

    this.showToast("Continue with the next question or mark case as escalated.");
  },

  renderFlowGuideResults(ids) {
    const guides = TroubleshootingSearch.getGuidesByIds(ids);
    const container = document.getElementById("flowGuideResults");
    container.innerHTML = "<h4>Start a troubleshooting guide</h4>";
    guides.forEach((guide) => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "flow-kb-card";
      const steps = (guide.steps || []).length;
      card.innerHTML =
        "<strong>" + this.escape(guide.id) + "</strong>: " +
        this.escape(guide.title) +
        " <span class='step-count-inline'>(" + steps + " steps)</span>";
      card.addEventListener("click", () => this.openGuide(guide));
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
