/**
 * Case setup page — Chat IMS, OS, Environment before troubleshooting.
 */
const CaseSetup = {
  isEditMode() {
    const params = new URLSearchParams(window.location.search);
    return params.get("edit") === "1";
  },

  init() {
    Session.ensureAnonymousSession();
    Logger.init(Session.getAgentId());

    const existing = Session.getCaseDetails();
    const editing = this.isEditMode();
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

    if (existing.chatIms && Storage.isCaseSetupComplete() && !editing) {
      window.location.href = "troubleshooting.html";
      return;
    }

    if (editing) {
      const title = document.querySelector(".case-setup-card h2");
      const submitBtn = document.querySelector("#caseForm button[type='submit']");
      const subtitle = document.querySelector(".login-hint");
      if (title) title.textContent = "Edit Case Details";
      if (submitBtn) submitBtn.textContent = "Save & return to troubleshooting";
      if (subtitle) {
        subtitle.textContent = "Update chat IMS, platform, or environment for this session.";
      }
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
    window.location.href = "troubleshooting.html";
  }
};

document.addEventListener("DOMContentLoaded", () => CaseSetup.init());
