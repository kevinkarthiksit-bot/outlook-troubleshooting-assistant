/**
 * SharePoint REST API integration (no custom backend).
 */
const SharePoint = {
  getSiteUrl() {
    const cfg = window.SP_CONFIG || {};
    if (cfg.siteUrl) return cfg.siteUrl.replace(/\/$/, "");
    if (cfg.useSharePoint && window.location.href.includes(".sharepoint.com")) {
      const parts = window.location.pathname.split("/");
      const sitesIdx = parts.indexOf("sites");
      if (sitesIdx >= 0 && parts[sitesIdx + 1]) {
        return window.location.origin + "/sites/" + parts[sitesIdx + 1];
      }
      return window.location.origin;
    }
    return "";
  },

  async request(endpoint, options = {}) {
    const siteUrl = this.getSiteUrl();
    const url = endpoint.startsWith("http") ? endpoint : siteUrl + endpoint;
    const headers = {
      Accept: "application/json;odata=verbose",
      ...(options.headers || {})
    };
    const res = await fetch(url, {
      credentials: "include",
      ...options,
      headers
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error("SharePoint request failed: " + res.status + " " + text.slice(0, 200));
    }
    if (options.raw) return res;
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("json")) return res.json();
    return res.text();
  },

  async getFormDigest() {
    const data = await this.request("/_api/contextinfo", { method: "POST" });
    return data.d.GetContextWebInformation.FormDigestValue;
  },

  async getCurrentUser() {
    const data = await this.request("/_api/web/currentuser");
    return data.d;
  },

  async isUserInGroup(groupName) {
    try {
      const enc = encodeURIComponent(groupName);
      await this.request("/_api/web/sitegroups/getbyname('" + enc + "')/users");
      const users = await this.request("/_api/web/sitegroups/getbyname('" + enc + "')/users");
      const current = await this.getCurrentUser();
      const list = users.d.results || [];
      return list.some((u) => u.Id === current.Id);
    } catch {
      return false;
    }
  },

  async loadKbFromSharePoint() {
    const cfg = window.SP_CONFIG;
    const escapedPath = cfg.kbFilePath.replace(/'/g, "''");
    const text = await this.request(
      "/_api/web/GetFileByServerRelativeUrl('" + escapedPath + "')/$value"
    );
    return JSON.parse(text);
  },

  async uploadKbFile(fileName, jsonContent) {
    const cfg = window.SP_CONFIG;
    const digest = await this.getFormDigest();
    const folder = cfg.kbUploadFolder.replace(/'/g, "''");
    const safeName = fileName.replace(/'/g, "''");
    const url =
      this.getSiteUrl() +
      "/_api/web/GetFolderByServerRelativeUrl('" +
      folder +
      "')/Files/add(url='" +
      safeName +
      "',overwrite=true)";

    const res = await fetch(url, {
      method: "POST",
      credentials: "include",
      headers: {
        Accept: "application/json;odata=verbose",
        "X-RequestDigest": digest,
        "Content-Type": "application/json;odata=verbose"
      },
      body: jsonContent
    });
    if (!res.ok) throw new Error("KB upload failed: " + res.status);
    return res.json();
  },

  async ensureLogList() {
    const cfg = window.SP_CONFIG;
    try {
      await this.request("/_api/web/lists/getbytitle('" + cfg.logListTitle + "')");
      return true;
    } catch {
      return false;
    }
  },

  async writeLog(entry) {
    const cfg = window.SP_CONFIG;
    if (!cfg.useSharePoint) {
      this.writeLocalLog(entry);
      return;
    }
    try {
      const digest = await this.getFormDigest();
      const body = {
        __metadata: { type: "SP.Data." + cfg.logListTitle.replace(/\s/g, "_x0020_") + "ListItem" },
        Title: entry.employeeId || entry.chatIms || "unknown",
        EmployeeId: entry.employeeId || "",
        ChatIms: entry.chatIms || "",
        Platform: entry.platform || "",
        Environment: entry.environment || "",
        UserEmail: entry.userEmail || "",
        SessionId: entry.sessionId || "",
        Action: entry.action || "",
        Query: entry.query || "",
        KbId: entry.kbId || "",
        KbTitle: entry.kbTitle || "",
        FlowId: entry.flowId || "",
        Details: entry.details || "",
        Feedback: entry.feedback || ""
      };
      await fetch(
        this.getSiteUrl() + "/_api/web/lists/getbytitle('" + cfg.logListTitle + "')/items",
        {
          method: "POST",
          credentials: "include",
          headers: {
            Accept: "application/json;odata=verbose",
            "Content-Type": "application/json;odata=verbose",
            "X-RequestDigest": digest
          },
          body: JSON.stringify(body)
        }
      );
    } catch (err) {
      console.warn("SharePoint log write failed, using local fallback:", err);
      this.writeLocalLog(entry);
    }
  },

  writeLocalLog(entry) {
    const key = "outlookAssistant_logs";
    const logs = JSON.parse(localStorage.getItem(key) || "[]");
    logs.push({ ...entry, timestamp: new Date().toISOString() });
    if (logs.length > 5000) logs.splice(0, logs.length - 5000);
    localStorage.setItem(key, JSON.stringify(logs));
  },

  getLocalLogs() {
    return JSON.parse(localStorage.getItem("outlookAssistant_logs") || "[]");
  },

  async getLogsFromSharePoint(top = 500) {
    const cfg = window.SP_CONFIG;
    const data = await this.request(
      "/_api/web/lists/getbytitle('" +
        cfg.logListTitle +
        "')/items?$orderby=Created desc&$top=" +
        top
    );
    return (data.d.results || []).map((item) => ({
      timestamp: item.Created,
      employeeId: item.EmployeeId || "",
      chatIms: item.ChatIms || "",
      platform: item.Platform || "",
      environment: item.Environment || "",
      userEmail: item.UserEmail,
      sessionId: item.SessionId,
      action: item.Action,
      query: item.Query,
      kbId: item.KbId,
      kbTitle: item.KbTitle,
      flowId: item.FlowId,
      details: item.Details,
      feedback: item.Feedback
    }));
  },

  resolveEmployeeId(user) {
    const cfg = window.SP_CONFIG;
    if (!user) return Storage.getEmployeeId();
    switch (cfg.employeeIdSource) {
      case "email":
        return user.Email || user.LoginName || "";
      case "title":
        return user.Title || "";
      case "loginName":
      default: {
        const login = user.LoginName || "";
        const match = login.match(/\\([^|]+)/) || login.match(/\|(.+)$/);
        return match ? match[1] : login.split("@")[0] || login;
      }
    }
  }
};

if (typeof window !== "undefined") {
  window.SharePoint = SharePoint;
}
