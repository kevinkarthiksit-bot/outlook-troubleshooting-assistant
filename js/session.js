/**
 * Shared session state for login, case details, and guide walkthrough.
 */
const Session = {
  getEmployeeId() {
    return Storage.getEmployeeId();
  },

  isLoggedIn() {
    const id = this.getEmployeeId();
    return !!id && /^[a-zA-Z0-9._-]+$/.test(id);
  },

  requireAuth(redirectUrl = "login.html") {
    if (!this.isLoggedIn()) {
      window.location.href = redirectUrl;
      return false;
    }
    return true;
  },

  getLogIdentity() {
    const caseDetails = this.getCaseDetails();
    if (caseDetails.chatIms) return caseDetails.chatIms;
    return this.getEmployeeId() || "agent";
  },

  ensureAnonymousSession() {
    if (!this.getEmployeeId()) {
      Storage.setEmployeeId("agent", false);
    }
    return this.getEmployeeId();
  },

  requireCaseSetup(redirectUrl = "case.html") {
    if (!Storage.isCaseSetupComplete()) {
      window.location.href = redirectUrl;
      return false;
    }
    return true;
  },

  login(employeeId, remember = false) {
    Storage.setEmployeeId(employeeId.trim(), remember);
  },

  logout() {
    Storage.clearSession();
    Storage.clearGuideSession();
    const details = Storage.getCaseDetails();
    Storage.setCaseDetails({
      chatIms: "",
      platform: details.platform || "Windows",
      environment: details.environment || "Exchange Online",
      caseSetupComplete: false
    });
  },

  getCaseDetails() {
    return Storage.getCaseDetails();
  },

  saveCaseDetails(chatIms, platform, environment) {
    Storage.setCaseDetails({
      chatIms: (chatIms || "").trim(),
      platform: platform || "Windows",
      environment: environment || "Exchange Online",
      caseSetupComplete: !!(chatIms || "").trim()
    });
  },

  startGuide(kbId, kbTitle, stepCount, guideType = "kb") {
    const caseDetails = this.getCaseDetails();
    const session = {
      employeeId: this.getLogIdentity(),
      chatIms: caseDetails.chatIms,
      platform: caseDetails.platform,
      environment: caseDetails.environment,
      guideType,
      kbId,
      kbTitle,
      stepCount,
      startedAt: new Date().toISOString(),
      currentStepIndex: 0,
      resolution: "In Progress",
      caseEscalated: false,
      agentComments: "",
      stepsTaken: []
    };
    Storage.setGuideSession(session);
    return session;
  },

  getGuideSession() {
    return Storage.getGuideSession();
  },

  updateGuideSession(updates) {
    const session = this.getGuideSession();
    if (!session) return null;
    const updated = { ...session, ...updates };
    Storage.setGuideSession(updated);
    return updated;
  },

  recordStepTaken(stepIndex, stepText) {
    const session = this.getGuideSession();
    if (!session) return null;

    const existing = session.stepsTaken.filter((s) => s.step !== stepIndex + 1);
    existing.push({
      step: stepIndex + 1,
      text: stepText,
      completedAt: new Date().toISOString()
    });
    existing.sort((a, b) => a.step - b.step);

    return this.updateGuideSession({
      currentStepIndex: stepIndex,
      stepsTaken: existing
    });
  },

  setResolution(resolution) {
    return this.updateGuideSession({ resolution });
  },

  setEscalated() {
    return this.updateGuideSession({
      resolution: "Escalated",
      caseEscalated: true
    });
  },

  formatNotesDateTime(date = new Date()) {
    const pad = (n) => String(n).padStart(2, "0");
    const hours = date.getHours();
    const ampm = hours >= 12 ? "PM" : "AM";
    const h12 = hours % 12 || 12;
    return (
      pad(date.getMonth() + 1) + "/" +
      pad(date.getDate()) + "/" +
      date.getFullYear() + " " +
      pad(h12) + ":" +
      pad(date.getMinutes()) + " " +
      ampm
    );
  },

  noteLine(label, value) {
    return label.padEnd(16) + (value || "N/A");
  },

  formatOutcomeStatus(session) {
    const resolution = session.resolution || "In Progress";
    if (session.caseEscalated || resolution.toLowerCase() === "escalated") {
      return "ESCALATED";
    }
    if (resolution.toLowerCase() === "resolved") {
      return "RESOLVED";
    }
    return "IN PROGRESS";
  },

  buildNotesText() {
    const session = this.getGuideSession();
    if (!session) return "";

    const totalSteps = session.stepCount || session.stepsTaken.length || 0;
    const stepsCompleted = session.stepsTaken.length;
    const status = this.formatOutcomeStatus(session);

    let text = "=== OUTLOOK TROUBLESHOOTING NOTES ===\n\n";

    text += "CASE INFORMATION\n";
    text += "----------------\n";
    text += this.noteLine("Date/Time:", this.formatNotesDateTime()) + "\n";
    text += this.noteLine("Chat IMS:", session.chatIms) + "\n";
    text += this.noteLine("Platform:", session.platform) + "\n";
    text += this.noteLine("Environment:", session.environment) + "\n\n";

    text += "ISSUE\n";
    text += "-----\n";
    const idLabel = session.guideType === "troubleshooting" ? "Guide ID:" : "KB ID:";
    text += this.noteLine(idLabel, session.kbId) + "\n";
    text += this.noteLine("Summary:", session.kbTitle) + "\n\n";

    text += "TROUBLESHOOTING PERFORMED\n";
    text += "-------------------------\n";
    if (session.stepsTaken.length) {
      session.stepsTaken.forEach((s) => {
        text += s.step + ". " + s.text + "\n";
      });
    } else {
      text += "No troubleshooting steps recorded.\n";
    }
    text += "\n";

    text += "OUTCOME\n";
    text += "-------\n";
    text += this.noteLine("Status:", status) + "\n";
    text += this.noteLine("Steps Completed:", stepsCompleted + " of " + totalSteps) + "\n";

    if (session.agentComments && session.agentComments.trim()) {
      text += "\nAGENT COMMENTS\n";
      text += "--------------\n";
      text += session.agentComments.trim() + "\n";
    }

    text += "\n=== END NOTES ===";
    return text;
  },

  async copyNotes() {
    const text = this.buildNotesText();
    if (!text) return false;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {
      /* fallback below */
    }

    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(textarea);
    return ok;
  }
};

if (typeof window !== "undefined") {
  window.Session = Session;
}
