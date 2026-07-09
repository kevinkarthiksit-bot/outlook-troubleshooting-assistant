/**
 * Step-by-step research troubleshooting guide page (separate from org KB).
 */
const TroubleshootingGuide = {
  guide: null,
  currentStepIndex: 0,
  rawSteps: [],
  steps: [],
  imageBasePath: "assets/images/",

  async init() {
    if (!Session.requireCaseSetup()) return;

    ThemePicker.mount("#themePickerMount");
    Themes.init();
    Logger.init(Session.getAgentId());

    const params = new URLSearchParams(window.location.search);
    const guideId = params.get("guide");
    if (!guideId) {
      this.showError("No troubleshooting guide specified.");
      return;
    }

    this.bindEvents();
    await TroubleshootingLoader.load();
    await KbLoader.load();
    const data = TroubleshootingLoader.getData();
    this.imageBasePath = data?.imageBasePath || "assets/images/";
    this.guide = TroubleshootingLoader.getGuide(guideId);

    if (!this.guide) {
      this.showError("Troubleshooting guide not found: " + guideId);
      return;
    }

    this.rawSteps = this.guide.steps || [];
    if (!this.rawSteps.length) {
      this.rawSteps = ["Follow standard troubleshooting procedures.", "Contact IT if you need assistance."];
    }

    const platform = Session.getCaseDetails()?.platform || "Windows";
    this.steps = StepUtils.filterSteps(this.rawSteps, platform);
    if (!this.steps.length) {
      this.showError(
        "No steps available for platform \"" + platform + "\". Use Edit Case to change platform."
      );
      return;
    }

    const existing = Session.getGuideSession();
    if (!existing || existing.kbId !== guideId || existing.guideType !== "troubleshooting") {
      Session.startGuide(this.guide.id, this.guide.title, this.steps.length, "troubleshooting");
    } else {
      Session.updateGuideSession({ stepCount: this.steps.length, guideType: "troubleshooting" });
      this.currentStepIndex = Math.min(
        existing.currentStepIndex || 0,
        Math.max(0, this.steps.length - 1)
      );
    }

    document.getElementById("guideLoading").hidden = true;
    document.getElementById("guideContent").hidden = false;
    document.getElementById("guideSubtitle").textContent = this.guide.title;

    const link = document.getElementById("kbDocLink");
    if (link) {
      const url = (this.guide.url || "").trim();
      if (/^https?:\/\//i.test(url)) {
        link.href = url;
        link.hidden = false;
      } else {
        link.removeAttribute("href");
        link.hidden = true;
      }
    }

    Logger.logArticleView({ id: this.guide.id, title: this.guide.title });
    this.renderKbFallback();
    this.render();
  },

  renderKbFallback() {
    const panel = document.getElementById("kbFallbackPanel");
    const btn = document.getElementById("kbFallbackBtn");
    const text = document.getElementById("kbFallbackText");
    if (!panel || !btn) return;

    const session = Session.getGuideSession();
    let kbArticle =
      (session?.fallbackKbId && SearchEngine.getArticleById(session.fallbackKbId)) ||
      GuideResolver.findRelatedKb(this.guide);

    if (!kbArticle) {
      panel.hidden = true;
      return;
    }

    panel.hidden = false;
    if (text) {
      text.textContent =
        "Still stuck? Org KB article: " + kbArticle.title + " (" + kbArticle.id + ")";
    }
    btn.onclick = () => GuideResolver.openItem({ ...kbArticle, type: "kb" });
  },

  bindEvents() {
    document.getElementById("backBtn")?.addEventListener("click", () => this.goBack());
    document.getElementById("continueBtn")?.addEventListener("click", () => this.goNext());
    document.getElementById("resolvedBtn")?.addEventListener("click", () => this.markResolved());
    document.getElementById("escalateBtn")?.addEventListener("click", () => this.escalate());
    document.getElementById("copyNotesBtn")?.addEventListener("click", () => this.copyNotes());
    document.getElementById("agentComments")?.addEventListener("input", () => this.saveAgentComments());
    document.getElementById("startOverBtn")?.addEventListener("click", () => {
      Session.logout();
      window.location.href = "case.html";
    });
    document.getElementById("stepImage")?.addEventListener("error", (e) => {
      const fig = document.getElementById("stepFigure");
      if (fig) fig.hidden = true;
      e.target.removeAttribute("src");
    });
  },

  render() {
    this.renderStepPills();
    this.renderInstruction();
    this.renderSessionNotes();
    this.loadAgentComments();
    this.updateNavButtons();
  },

  saveAgentComments() {
    const el = document.getElementById("agentComments");
    if (!el) return;
    Session.updateGuideSession({ agentComments: el.value });
  },

  loadAgentComments() {
    const session = Session.getGuideSession();
    const el = document.getElementById("agentComments");
    if (el && session && document.activeElement !== el) {
      el.value = session.agentComments || "";
    }
  },

  renderStepPills() {
    const container = document.getElementById("stepPills");
    container.innerHTML = "";
    this.steps.forEach((step, i) => {
      const pill = document.createElement("div");
      pill.className = "step-pill";
      if (i < this.currentStepIndex) pill.classList.add("completed");
      else if (i === this.currentStepIndex) pill.classList.add("active");
      else pill.classList.add("pending");
      const label = StepUtils.getLabel(step, i);
      const hasImg = StepUtils.getImage(step, this.imageBasePath);
      pill.innerHTML =
        '<span class="pill-number">' + (i + 1) + "</span>" +
        '<span class="pill-label">' + this.escape(label) + "</span>" +
        (hasImg ? '<span class="pill-visual" title="Has screenshot">&#128247;</span>' : "");
      container.appendChild(pill);
    });
  },

  renderInstruction() {
    const step = this.steps[this.currentStepIndex];
    const text = StepUtils.getText(step);
    document.getElementById("instructionText").textContent = text;

    const fig = document.getElementById("stepFigure");
    const img = document.getElementById("stepImage");
    const caption = document.getElementById("stepImageCaption");
    const tipEl = document.getElementById("stepTip");
    const platformNote = document.getElementById("stepPlatformNote");

    const src = StepUtils.getImage(step, this.imageBasePath);
    if (src && img && fig) {
      img.src = src;
      img.alt = StepUtils.getAlt(step) || text;
      if (caption) caption.textContent = StepUtils.getAlt(step) || "";
      fig.hidden = false;
    } else if (fig) {
      fig.hidden = true;
      if (img) img.removeAttribute("src");
    }

    const tip = StepUtils.getTip(step);
    if (tipEl) {
      if (tip) {
        tipEl.textContent = tip;
        tipEl.hidden = false;
      } else {
        tipEl.hidden = true;
        tipEl.textContent = "";
      }
    }

    const platforms = StepUtils.getPlatforms(step);
    if (platformNote) {
      if (platforms?.length) {
        platformNote.textContent = "Applies to: " + platforms.join(", ");
        platformNote.hidden = false;
      } else {
        platformNote.hidden = true;
      }
    }
  },

  renderSessionNotes() {
    const session = Session.getGuideSession();
    if (!session) return;

    document.getElementById("noteDateTime").textContent = new Date().toLocaleString();
    document.getElementById("noteChatIms").textContent = session.chatIms || "N/A";
    document.getElementById("notePlatform").textContent = session.platform || "N/A";
    document.getElementById("noteEnvironment").textContent = session.environment || "N/A";
    document.getElementById("noteIssue").textContent =
      (session.kbTitle || "") + " (" + (session.kbId || "") + ")";

    const step = this.steps[this.currentStepIndex];
    const stepNum = this.currentStepIndex + 1;
    document.getElementById("noteCurrentStep").textContent =
      stepNum + "/" + this.steps.length + " - " + StepUtils.getLabel(step, this.currentStepIndex);

    const resolutionEl = document.getElementById("noteResolution");
    resolutionEl.textContent = session.resolution || "In Progress";
    resolutionEl.className = "resolution-" + (session.resolution || "in-progress")
      .toLowerCase()
      .replace(/\s+/g, "-");

    const escalatedEl = document.getElementById("noteCaseEscalated");
    if (escalatedEl) {
      escalatedEl.textContent = session.caseEscalated ? "Yes" : "No";
      escalatedEl.className = session.caseEscalated ? "resolution-escalated" : "";
    }

    const stepsList = document.getElementById("noteStepsTaken");
    stepsList.innerHTML = "";
    if (session.stepsTaken?.length) {
      session.stepsTaken.forEach((s) => {
        const li = document.createElement("li");
        li.textContent = s.text;
        stepsList.appendChild(li);
      });
    } else {
      const li = document.createElement("li");
      li.textContent = "No steps recorded yet.";
      li.className = "muted";
      stepsList.appendChild(li);
    }
  },

  updateNavButtons() {
    document.getElementById("backBtn").disabled = this.currentStepIndex === 0;
    document.getElementById("continueBtn").hidden = this.currentStepIndex >= this.steps.length - 1;
  },

  recordCurrentStep() {
    const stepText = StepUtils.getText(this.steps[this.currentStepIndex]);
    Session.recordStepTaken(this.currentStepIndex, stepText);
    Logger.logStepProgress(
      this.guide.id,
      this.guide.title,
      this.currentStepIndex + 1,
      stepText
    );
  },

  goBack() {
    if (this.currentStepIndex > 0) {
      this.currentStepIndex--;
      Session.updateGuideSession({ currentStepIndex: this.currentStepIndex });
      this.render();
    }
  },

  goNext() {
    this.recordCurrentStep();
    if (this.currentStepIndex < this.steps.length - 1) {
      this.currentStepIndex++;
      Session.updateGuideSession({ currentStepIndex: this.currentStepIndex });
      this.render();
    } else {
      this.showToast("Last step reached. Mark as resolved or escalate.");
      this.renderSessionNotes();
    }
  },

  markResolved() {
    this.recordCurrentStep();
    Session.setResolution("Resolved");
    Logger.logResolution(this.guide.id, this.guide.title);
    this.renderSessionNotes();
    this.showToast("Issue marked as resolved.");
  },

  escalate() {
    this.recordCurrentStep();
    Session.setEscalated();
    Logger.logEscalation(
      "Case escalated at step " + (this.currentStepIndex + 1),
      this.guide.id,
      this.guide.title
    );
    this.renderSessionNotes();
    this.showToast("Case escalated. Use Copy Notes to paste into your ticket.");
  },

  async copyNotes() {
    this.saveAgentComments();
    const ok = await Session.copyNotes();
    if (ok) {
      const session = Session.getGuideSession();
      Logger.logCopyNotes(session?.kbId, session?.kbTitle);
      this.showToast("Notes copied to clipboard.");
    } else {
      this.showToast("Could not copy notes. Please try again.");
    }
  },

  showError(msg) {
    document.getElementById("guideLoading").hidden = true;
    const el = document.getElementById("guideError");
    el.textContent = msg;
    el.hidden = false;
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

document.addEventListener("DOMContentLoaded", () => TroubleshootingGuide.init());

if (typeof window !== "undefined") {
  window.TroubleshootingGuide = TroubleshootingGuide;
}
