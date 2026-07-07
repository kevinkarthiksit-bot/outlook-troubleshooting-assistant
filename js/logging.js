/**
 * Usage logging service.
 */
const Logger = {
  employeeId: "",
  userEmail: "",
  sessionId: "",

  init(employeeId, userEmail) {
    const caseIms = Session?.getCaseDetails?.()?.chatIms;
    this.employeeId = caseIms || employeeId || Storage.getEmployeeId() || "agent";
    this.userEmail = userEmail || "";
    this.sessionId = Storage.getSessionId();
  },

  async log(action, details = {}) {
    const entry = {
      employeeId: this.employeeId,
      userEmail: this.userEmail,
      sessionId: this.sessionId,
      action,
      query: details.query || "",
      kbId: details.kbId || "",
      kbTitle: details.kbTitle || "",
      flowId: details.flowId || "",
      details: details.details || "",
      feedback: details.feedback || ""
    };
    await SharePoint.writeLog(entry);
  },

  logLogin(employeeId) {
    return this.log("login", { details: "Employee ID: " + employeeId });
  },

  logSearch(query, resultCount) {
    return this.log("search", {
      query,
      details: "Results: " + resultCount
    });
  },

  logArticleView(article) {
    return this.log("article_view", {
      kbId: article.id,
      kbTitle: article.title
    });
  },

  logFlowStart(flow) {
    return this.log("flow_start", { flowId: flow.id, details: flow.title });
  },

  logFlowStep(flowId, stepQuestion, choice) {
    return this.log("flow_step", {
      flowId,
      details: stepQuestion + " -> " + choice
    });
  },

  logStepProgress(kbId, kbTitle, stepNum, stepText) {
    return this.log("step_progress", {
      kbId,
      kbTitle,
      details: "Step " + stepNum + ": " + stepText
    });
  },

  logResolution(kbId, kbTitle) {
    return this.log("resolution", {
      kbId,
      kbTitle,
      details: "Issue resolved"
    });
  },

  logFeedback(article, helpful) {
    return this.log("feedback", {
      kbId: article.id,
      kbTitle: article.title,
      feedback: helpful ? "helpful" : "not_helpful"
    });
  },

  logEscalation(reason, kbId, kbTitle) {
    return this.log("escalation", {
      kbId: kbId || "",
      kbTitle: kbTitle || "",
      details: reason
    });
  },

  logCopyNotes(kbId, kbTitle) {
    return this.log("copy_notes", {
      kbId: kbId || "",
      kbTitle: kbTitle || "",
      details: "Session notes copied to clipboard"
    });
  },

  logAppLaunch() {
    return this.log("app_launch", { details: "User opened Outlook Assistant" });
  }
};

if (typeof window !== "undefined") {
  window.Logger = Logger;
}
