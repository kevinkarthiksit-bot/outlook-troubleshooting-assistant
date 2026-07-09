/**
 * Usage logging service.
 */
const Logger = {
  employeeId: "",
  userEmail: "",
  sessionId: "",

  getConfig() {
    return window.SP_CONFIG?.logging || {};
  },

  init(employeeId, userEmail) {
    this.employeeId = employeeId || Session?.getEmployeeId?.() || Storage.getEmployeeId() || "agent";
    this.userEmail = userEmail || "";
    this.sessionId = Storage.getSessionId();
  },

  getCaseDetailsForLogging() {
    let details = {};
    if (typeof Storage !== "undefined" && Storage.getCaseDetails) {
      details = Storage.getCaseDetails() || {};
    }
    if (typeof Session !== "undefined" && Session.getCaseDetails) {
      details = { ...details, ...Session.getCaseDetails() };
    }
    const guide =
      (typeof Session !== "undefined" && Session.getGuideSession?.()) ||
      (typeof Storage !== "undefined" && Storage.getGuideSession?.()) ||
      null;
    if (guide) {
      details = {
        chatIms: details.chatIms || guide.chatIms || "",
        platform: details.platform || guide.platform || "",
        environment: details.environment || guide.environment || ""
      };
    }
    return {
      chatIms: (details.chatIms || "").trim(),
      platform: details.platform || "Windows",
      environment: details.environment || "Exchange Online"
    };
  },

  buildContext() {
    const cfg = this.getConfig();
    const caseDetails = this.getCaseDetailsForLogging();
    const ctx = {};

    if (cfg.captureEmployeeId !== false) {
      ctx.employeeId = this.employeeId || "agent";
    }
    if (cfg.captureChatIms !== false) {
      ctx.chatIms = caseDetails.chatIms;
    }
    if (cfg.capturePlatform !== false) {
      ctx.platform = caseDetails.platform;
    }
    if (cfg.captureEnvironment !== false) {
      ctx.environment = caseDetails.environment;
    }

    return ctx;
  },

  async log(action, details = {}) {
    const entry = {
      ...this.buildContext(),
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
    return this.log("login", { details: "Agent signed in: " + employeeId });
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
