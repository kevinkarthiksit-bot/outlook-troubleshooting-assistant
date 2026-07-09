/**
 * Admin authentication for the dashboard (static client-side gate).
 *
 * Known limitation: credentials live in client config (SP_CONFIG). Real protection
 * requires SharePoint group / page permissions — not fixable in static HTML alone.
 */
const AdminAuth = {
  AUTH_KEY: "outlookAssistant_adminAuth",
  USER_KEY: "outlookAssistant_adminUser",

  isAuthenticated() {
    return sessionStorage.getItem(this.AUTH_KEY) === "true";
  },

  getUsername() {
    return sessionStorage.getItem(this.USER_KEY) || "";
  },

  login(username, password) {
    const cfg = window.SP_CONFIG || {};
    const expectedUser = cfg.adminUsername || "Hannah";
    const expectedPass = cfg.adminPassword || "Hannah@95";

    if (username === expectedUser && password === expectedPass) {
      sessionStorage.setItem(this.AUTH_KEY, "true");
      sessionStorage.setItem(this.USER_KEY, username);
      return true;
    }
    return false;
  },

  logout() {
    sessionStorage.removeItem(this.AUTH_KEY);
    sessionStorage.removeItem(this.USER_KEY);
  },

  requireAuth(redirectUrl = "admin-login.html") {
    if (!this.isAuthenticated()) {
      window.location.href = redirectUrl;
      return false;
    }
    return true;
  }
};

if (typeof window !== "undefined") {
  window.AdminAuth = AdminAuth;
}
