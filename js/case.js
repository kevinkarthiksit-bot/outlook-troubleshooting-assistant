/**
 * Case setup page — Chat IMS, OS, Environment before troubleshooting.
 */
const CaseSetup = {
  init() {
    Session.ensureAnonymousSession();
    Logger.init(Session.getLogIdentity());

    const existing = Session.getCaseDetails();
    const display = document.getElementById("userDisplay");
    if (display && existing.chatIms) {
      display.textContent = "IMS: " + existing.chatIms;
    } else if (display) {
      display.hidden = true;
    }
    if (existing.chatIms) {
      document.getElementById("chatImsInput").value = existing.chatIms;
    }
    if (existing.platform) {
      document.getElementById("platformSelect").value = existing.platform;
    }
    if (existing.environment) {
      document.getElementById("environmentSelect").value = existing.environment;
    }

    document.getElementById("caseForm").addEventListener("submit", (e) => {
      e.preventDefault();
      this.handleSubmit();
    });
  },

  validate(chatIms) {
    const trimmed = (chatIms || "").trim();
    if (!trimmed) return "Chat IMS Number is required.";
    if (trimmed.length > 80) return "Chat IMS Number is too long.";
    return null;
  },

  showError(msg) {
    const el = document.getElementById("caseError");
    el.textContent = msg;
    el.hidden = !msg;
  },

  async handleSubmit() {
    const chatIms = document.getElementById("chatImsInput").value.trim();
    const platform = document.getElementById("platformSelect").value;
    const environment = document.getElementById("environmentSelect").value;

    const error = this.validate(chatIms);
    if (error) {
      this.showError(error);
      return;
    }

    this.showError("");
    Session.saveCaseDetails(chatIms, platform, environment);

    try {
      await Logger.log("case_setup", {
        details: "Chat IMS: " + chatIms + ", Platform: " + platform + ", Environment: " + environment
      });
    } catch (err) {
      console.warn("Case setup logging failed:", err);
    }

    window.location.href = "index.html";
  }
};

document.addEventListener("DOMContentLoaded", () => CaseSetup.init());
