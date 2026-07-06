/**
 * Browser storage helpers for KB cache and session state.
 */
const Storage = {
  KB_CACHE_KEY: "outlookAssistant_kbCache",
  TS_GUIDE_CACHE_KEY: "outlookAssistant_tsGuideCache",
  THEME_KEY: "outlookAssistant_theme",
  EMPLOYEE_ID_KEY: "outlookAssistant_employeeId",
  EMPLOYEE_SESSION_KEY: "outlookAssistant_employeeIdSession",
  CASE_DETAILS_KEY: "outlookAssistant_caseDetails",
  GUIDE_SESSION_KEY: "outlookAssistant_guideSession",
  SESSION_KEY: "outlookAssistant_sessionId",

  getSessionId() {
    let id = sessionStorage.getItem(this.SESSION_KEY);
    if (!id) {
      id = "sess_" + Date.now() + "_" + Math.random().toString(36).slice(2, 9);
      sessionStorage.setItem(this.SESSION_KEY, id);
    }
    return id;
  },

  getTheme() {
    return localStorage.getItem(this.THEME_KEY) || "light";
  },

  setTheme(theme) {
    localStorage.setItem(this.THEME_KEY, theme);
  },

  getEmployeeId() {
    return (
      sessionStorage.getItem(this.EMPLOYEE_SESSION_KEY) ||
      localStorage.getItem(this.EMPLOYEE_ID_KEY) ||
      ""
    );
  },

  setEmployeeId(id, remember = false) {
    if (!id) return;
    sessionStorage.setItem(this.EMPLOYEE_SESSION_KEY, id);
    if (remember) {
      localStorage.setItem(this.EMPLOYEE_ID_KEY, id);
    }
  },

  clearEmployeeId() {
    sessionStorage.removeItem(this.EMPLOYEE_SESSION_KEY);
    localStorage.removeItem(this.EMPLOYEE_ID_KEY);
  },

  getRememberedEmployeeId() {
    return localStorage.getItem(this.EMPLOYEE_ID_KEY) || "";
  },

  getCaseDetails() {
    try {
      const raw = sessionStorage.getItem(this.CASE_DETAILS_KEY);
      return raw
        ? JSON.parse(raw)
        : { chatIms: "", platform: "Windows", environment: "Exchange Online", caseSetupComplete: false };
    } catch {
      return { chatIms: "", platform: "Windows", environment: "Exchange Online", caseSetupComplete: false };
    }
  },

  setCaseDetails(details) {
    sessionStorage.setItem(this.CASE_DETAILS_KEY, JSON.stringify(details));
  },

  isCaseSetupComplete() {
    const details = this.getCaseDetails();
    return !!(details.caseSetupComplete && details.chatIms);
  },

  getGuideSession() {
    try {
      const raw = sessionStorage.getItem(this.GUIDE_SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },

  setGuideSession(session) {
    sessionStorage.setItem(this.GUIDE_SESSION_KEY, JSON.stringify(session));
  },

  clearGuideSession() {
    sessionStorage.removeItem(this.GUIDE_SESSION_KEY);
  },

  clearSession() {
    sessionStorage.removeItem(this.EMPLOYEE_SESSION_KEY);
    sessionStorage.removeItem(this.CASE_DETAILS_KEY);
    sessionStorage.removeItem(this.GUIDE_SESSION_KEY);
    sessionStorage.removeItem(this.SESSION_KEY);
  },

  getKbCache() {
    try {
      const raw = localStorage.getItem(this.KB_CACHE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      const maxAge = (window.SP_CONFIG?.kbCacheHours || 24) * 3600000;
      if (Date.now() - parsed.cachedAt > maxAge) return null;
      return parsed.data;
    } catch {
      return null;
    }
  },

  setKbCache(data) {
    localStorage.setItem(
      this.KB_CACHE_KEY,
      JSON.stringify({ cachedAt: Date.now(), data })
    );
  },

  clearKbCache() {
    localStorage.removeItem(this.KB_CACHE_KEY);
  },

  getTsGuideCache() {
    try {
      const raw = localStorage.getItem(this.TS_GUIDE_CACHE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      const maxAge = (window.SP_CONFIG?.kbCacheHours || 24) * 3600000;
      if (Date.now() - parsed.cachedAt > maxAge) return null;
      return parsed.data;
    } catch {
      return null;
    }
  },

  setTsGuideCache(data) {
    localStorage.setItem(
      this.TS_GUIDE_CACHE_KEY,
      JSON.stringify({ cachedAt: Date.now(), data })
    );
  },

  clearTsGuideCache() {
    localStorage.removeItem(this.TS_GUIDE_CACHE_KEY);
  }
};

if (typeof window !== "undefined") {
  window.Storage = Storage;
}
