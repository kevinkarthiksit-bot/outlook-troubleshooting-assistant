/**

 * Step-by-step KB guide page controller.

 */

const Guide = {

  article: null,

  currentStepIndex: 0,

  rawSteps: [],

  steps: [],

  imageBasePath: "assets/images/",



  async init() {

    if (!Session.requireCaseSetup()) return;



    ThemePicker.mount("#themePickerMount");

    Themes.init();

    Logger.init(Session.getEmployeeId());



    const params = new URLSearchParams(window.location.search);

    const kbId = params.get("kb");

    if (!kbId) {

      this.showError("No KB article specified.");

      return;

    }



    this.bindEvents();

    await KbLoader.load();

    const kb = KbLoader.getData();

    this.imageBasePath = kb?.imageBasePath || "assets/images/";

    this.article = KbLoader.getArticle(kbId);



    if (!this.article) {

      this.showError("KB article not found: " + kbId);

      return;

    }



    this.rawSteps = this.article.steps || [];

    if (!this.rawSteps.length) {

      this.rawSteps = [

        "Refer to the full KB article for detailed steps.",

        "Contact IT if you need assistance."

      ];

    }



    const platform = Session.getCaseDetails()?.platform || "Windows";

    this.steps = StepUtils.filterSteps(this.rawSteps, platform);

    if (!this.steps.length) {

      this.steps = this.rawSteps;

    }



    const existing = Session.getGuideSession();

    if (!existing || existing.kbId !== kbId) {

      Session.startGuide(this.article.id, this.article.title, this.steps.length, "kb");

    } else {

      Session.updateGuideSession({ stepCount: this.steps.length });

      this.currentStepIndex = Math.min(

        existing.currentStepIndex || 0,

        Math.max(0, this.steps.length - 1)

      );

    }



    document.getElementById("guideLoading").hidden = true;

    document.getElementById("guideContent").hidden = false;

    document.getElementById("guideSubtitle").textContent = this.article.title;



    if (this.article.url) {

      const link = document.getElementById("kbDocLink");

      if (link) {

        link.href = this.article.url;

        link.hidden = false;

      }

    }



    Logger.logArticleView(this.article);

    this.render();

  },



  bindEvents() {

    document.getElementById("backBtn")?.addEventListener("click", () => this.goBack());

    document.getElementById("continueBtn")?.addEventListener("click", () => this.goNext());

    document.getElementById("resolvedBtn")?.addEventListener("click", () => this.markResolved());

    document.getElementById("escalateBtn")?.addEventListener("click", () => this.escalate());

    document.getElementById("copyNotesBtn")?.addEventListener("click", () => this.copyNotes());



    document.getElementById("agentComments")?.addEventListener("input", () => {

      this.saveAgentComments();

    });



    document.getElementById("startOverBtn")?.addEventListener("click", () => {

      Session.logout();

      window.location.href = "login.html";

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

      if (platforms && platforms.length) {

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

    document.getElementById("noteEmployeeId").textContent = session.employeeId || "N/A";

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

    const isLast = this.currentStepIndex >= this.steps.length - 1;

    document.getElementById("continueBtn").hidden = isLast;

  },



  recordCurrentStep() {

    const step = this.steps[this.currentStepIndex];

    const stepText = StepUtils.getText(step);

    Session.recordStepTaken(this.currentStepIndex, stepText);

    Logger.logStepProgress(

      this.article.id,

      this.article.title,

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

    Logger.logResolution(this.article.id, this.article.title);

    this.renderSessionNotes();

    this.showToast("Issue marked as resolved.");

  },



  escalate() {

    this.recordCurrentStep();

    Session.setEscalated();

    Logger.logEscalation(

      "Case escalated at step " + (this.currentStepIndex + 1),

      this.article.id,

      this.article.title

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



document.addEventListener("DOMContentLoaded", () => Guide.init());



if (typeof window !== "undefined") {

  window.Guide = Guide;

}

