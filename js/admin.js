/**
 * Admin page: KB upload, validation, log dashboard.
 */
const Admin = {
  parsedKb: null,
  allLogs: [],
  fullLogCount: 0,
  logsCapped: false,
  logFilterDebounce: null,

  async init() {
    ThemePicker.mount("#themePickerMount");
    Themes.init();

    if (!AdminAuth.requireAuth()) return;

    if (window.SP_CONFIG?.useSharePoint) {
      document.getElementById("clearLocalLogsBtn")?.setAttribute("hidden", "");
    }

    this.updateUploadButtonLabel();
    this.bindEvents();
    await this.loadLogStats();
  },

  parseCaseFieldsFromDetails(details) {
    if (!details || typeof details !== "string") return {};
    const match = details.match(
      /Chat IMS:\s*([^,]+),\s*Platform:\s*([^,]+),\s*Environment:\s*(.+)/i
    );
    if (!match) return {};
    return {
      chatIms: match[1].trim(),
      platform: match[2].trim(),
      environment: match[3].trim()
    };
  },

  normalizeLogRow(log) {
    const row = { ...log };
    if (!row.chatIms && row.employeeId && /^IMS[-\s]/i.test(String(row.employeeId))) {
      row.chatIms = row.employeeId;
      row.employeeId = "";
    }
    const fromDetails = this.parseCaseFieldsFromDetails(row.details);
    if (!row.chatIms && fromDetails.chatIms) row.chatIms = fromDetails.chatIms;
    if (!row.platform && fromDetails.platform) row.platform = fromDetails.platform;
    if (!row.environment && fromDetails.environment) row.environment = fromDetails.environment;
    const outcome = this.getLogOutcomeFlags(row);
    row.resolved = outcome.resolved;
    row.escalated = outcome.escalated;
    return row;
  },

  getLogOutcomeFlags(log) {
    const action = (log.action || "").toLowerCase();
    const details = (log.details || "").toLowerCase();
    const resolved =
      action === "resolution" || details.includes("issue resolved") || details.includes("glad that resolved");
    const escalated =
      action === "escalation" ||
      details.includes("escalat") ||
      details.includes("case escalated");
    return {
      resolved: resolved ? "Yes" : "",
      escalated: escalated ? "Yes" : ""
    };
  },

  formatLogTimestamp(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return (
      new Intl.DateTimeFormat("en-IN", {
        timeZone: "Asia/Kolkata",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
        hour12: true
      }).format(d) + " IST"
    );
  },

  bindEvents() {
    document.getElementById("adminLogoutBtn")?.addEventListener("click", () => {
      AdminAuth.logout();
      window.location.href = "admin-login.html";
    });
    document.getElementById("kbFileInput")?.addEventListener("change", (e) =>
      this.handleFileSelect(e.target.files[0])
    );
    document.getElementById("uploadKbBtn")?.addEventListener("click", () => this.uploadKb());
    document.getElementById("downloadKbJsonBtn")?.addEventListener("click", () => this.downloadParsedKbJson());
    document.getElementById("downloadSampleBtn")?.addEventListener("click", () => this.downloadSample());
    document.getElementById("refreshLogsBtn")?.addEventListener("click", () => this.loadLogStats());
    document.getElementById("exportLogsBtn")?.addEventListener("click", () => this.exportLogsCsv());
    document.getElementById("clearLocalLogsBtn")?.addEventListener("click", () => this.clearLocalLogs());
    document.getElementById("logFilterAction")?.addEventListener("change", () => this.applyLogFilters());
    document.getElementById("logFilterDateFrom")?.addEventListener("change", () => this.applyLogFilters());
    document.getElementById("logFilterDateTo")?.addEventListener("change", () => this.applyLogFilters());
    document.getElementById("logFilterChatIms")?.addEventListener("input", () => {
      clearTimeout(this.logFilterDebounce);
      this.logFilterDebounce = setTimeout(() => this.applyLogFilters(), 250);
    });
    document.getElementById("logFilterText")?.addEventListener("input", () => {
      clearTimeout(this.logFilterDebounce);
      this.logFilterDebounce = setTimeout(() => this.applyLogFilters(), 250);
    });
    document.getElementById("clearLogFiltersBtn")?.addEventListener("click", () => this.clearLogFilters());
  },

  updateUploadButtonLabel() {
    const btn = document.getElementById("uploadKbBtn");
    if (!btn) return;
    if (window.SP_CONFIG?.useSharePoint) {
      btn.textContent = "Upload to SharePoint & download single-file";
    } else {
      btn.textContent = "Apply & download single-file app";
    }
  },

  setParsedKbReady(ready) {
    document.getElementById("uploadKbBtn").disabled = !ready;
    const jsonBtn = document.getElementById("downloadKbJsonBtn");
    if (jsonBtn) jsonBtn.disabled = !ready;
  },

  async getExistingKbForMerge() {
    try {
      const adminKb = localStorage.getItem("outlookAssistant_adminKb");
      if (adminKb) return JSON.parse(adminKb);
      const res = await fetch(window.SP_CONFIG.localKbPath);
      if (res.ok) return await res.json();
    } catch (_) {}
    return { articles: [], flows: [], synonyms: {} };
  },

  async loadXlsxLib() {
    if (window.XLSX) return;
    await new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js";
      script.onload = resolve;
      script.onerror = () => reject(new Error("Could not load Excel parser"));
      document.head.appendChild(script);
    });
  },

  async parseXlsx(buffer, existingKb) {
    await this.loadXlsxLib();
    const workbook = window.XLSX.read(buffer, { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = window.XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
    return KbSpreadsheet.buildKbFromRows(KbSpreadsheet.rowsFromAoA(rows), existingKb);
  },

  async handleFileSelect(file) {
    if (!file) return;
    const preview = document.getElementById("uploadPreview");
    preview.textContent = "Parsing " + file.name + "...";

    try {
      const ext = file.name.split(".").pop().toLowerCase();
      const existingKb = await this.getExistingKbForMerge();
      if (ext === "json") {
        const text = await file.text();
        this.parsedKb = JSON.parse(text);
      } else if (ext === "csv") {
        this.parsedKb = KbSpreadsheet.parseCsv(await file.text(), existingKb);
      } else if (ext === "xlsx" || ext === "xls") {
        this.parsedKb = await this.parseXlsx(await file.arrayBuffer(), existingKb);
      } else {
        throw new Error("Unsupported format. Use Excel (.xlsx), JSON, or CSV.");
      }
      this.validateKb(this.parsedKb);
      preview.textContent =
        "Valid KB: " +
        (this.parsedKb.articles?.length || 0) +
        " articles ready to apply.";
      preview.className = "preview success";
      this.setParsedKbReady(true);
    } catch (err) {
      preview.textContent = "Error: " + err.message;
      preview.className = "preview error";
      this.parsedKb = null;
      this.setParsedKbReady(false);
    }
  },

  validateKb(data) {
    if (!data || !Array.isArray(data.articles)) {
      throw new Error("KB must contain an articles array");
    }
    if (data.articles.length === 0) {
      throw new Error("KB must contain at least one article");
    }
    const ids = new Set();
    data.articles.forEach((a, i) => {
      if (!a.id) throw new Error("Article at index " + i + " missing id");
      if (!a.title) throw new Error("Article " + a.id + " missing title");
      if (ids.has(a.id)) throw new Error("Duplicate article id: " + a.id);
      ids.add(a.id);
      if (!Array.isArray(a.steps)) {
        throw new Error("Article " + a.id + " must have a steps array");
      }
      a.steps.forEach((step, si) => {
        if (typeof StepUtils !== "undefined") {
          StepUtils.validateStep(step, a.id, si);
        } else if (typeof step === "string") {
          if (!step.trim()) throw new Error(a.id + " step " + si + ": empty step");
        } else if (!step?.text) {
          throw new Error(a.id + " step " + si + ": invalid step object");
        }
      });
    });
  },

  async uploadKb() {
    if (!this.parsedKb) return;
    const btn = document.getElementById("uploadKbBtn");
    btn.disabled = true;
    const savingLabel = window.SP_CONFIG?.useSharePoint ? "Uploading..." : "Applying...";
    btn.textContent = savingLabel;

    const preview = document.getElementById("uploadPreview");

    try {
      this.parsedKb.lastUpdated = new Date().toISOString().slice(0, 10);
      const json = JSON.stringify(this.parsedKb, null, 2);
      const cfg = window.SP_CONFIG;
      const messages = [];

      if (cfg.useSharePoint) {
        await SharePoint.uploadKbFile("kb-articles.json", json);
        messages.push(
          "SharePoint upload successful (cache up to " + cfg.kbCacheHours + "h)."
        );
      } else {
        localStorage.setItem("outlookAssistant_adminKb", json);
        Storage.setKbCache(this.parsedKb);
        messages.push("KB applied in this browser.");
      }

      btn.textContent = "Baking single-file...";
      await this.downloadBakedSingleFile(json);
      messages.push(
        "Downloaded outlook-assistant.html with this KB baked in — redistribute that file."
      );

      preview.textContent = messages.join(" ");
      preview.className = "preview success";
    } catch (err) {
      preview.textContent = "Save / bake failed: " + err.message;
      preview.className = "preview error";
    } finally {
      btn.disabled = !this.parsedKb;
      this.updateUploadButtonLabel();
      const jsonBtn = document.getElementById("downloadKbJsonBtn");
      if (jsonBtn) jsonBtn.disabled = !this.parsedKb;
    }
  },

  getSingleFileSourceUrl() {
    if (window.SP_CONFIG?.singleFile) {
      return location.href.split("#")[0].split("?")[0];
    }
    return "single-file/outlook-assistant.html";
  },

  async fetchSingleFileHtml() {
    const url = this.getSingleFileSourceUrl();
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      throw new Error(
        "Could not load single-file app from " +
          url +
          " (" +
          res.status +
          "). Serve the project over http and ensure single-file/outlook-assistant.html exists."
      );
    }
    return res.text();
  },

  bakeEmbeddedKb(html, kbJson) {
    const start = "/*__EMBEDDED_KB__*/";
    const end = "/*__END_EMBEDDED_KB__*/";
    const startIdx = html.indexOf(start);
    const endIdx = html.indexOf(end);
    if (startIdx < 0 || endIdx < 0 || endIdx <= startIdx) {
      throw new Error(
        "Single-file HTML is missing EMBEDDED_KB bake markers. Rebuild with: node single-file/build.js"
      );
    }
    return (
      html.slice(0, startIdx + start.length) +
      kbJson +
      html.slice(endIdx)
    );
  },

  async downloadBakedSingleFile(kbJson) {
    const html = await this.fetchSingleFileHtml();
    const baked = this.bakeEmbeddedKb(html, kbJson);
    this.downloadBlob(baked, "outlook-assistant.html", "text/html;charset=utf-8");
  },

  downloadParsedKbJson() {
    if (!this.parsedKb) return;
    const json = JSON.stringify(this.parsedKb, null, 2);
    this.downloadBlob(json, "kb-articles.json", "application/json");
  },

  getLogDateInIST(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(d);
  },

  async getFullLogs() {
    if (window.SP_CONFIG.useSharePoint) {
      try {
        return await SharePoint.getLogsFromSharePoint(5000);
      } catch {
        return SharePoint.getLocalLogs();
      }
    }
    return SharePoint.getLocalLogs();
  },

  async loadLogStats() {
    const tbody = document.getElementById("logsTableBody");
    tbody.innerHTML = "<tr><td colspan='11'>Loading...</td></tr>";

    let logs = [];
    try {
      if (window.SP_CONFIG.useSharePoint) {
        logs = await SharePoint.getLogsFromSharePoint(200);
        this.fullLogCount = logs.length;
        this.logsCapped = logs.length >= 200;
      } else {
        const allLocal = SharePoint.getLocalLogs();
        this.fullLogCount = allLocal.length;
        logs = allLocal.slice().reverse().slice(0, 200);
        this.logsCapped = this.fullLogCount > logs.length;
      }
    } catch (err) {
      const allLocal = SharePoint.getLocalLogs();
      this.fullLogCount = allLocal.length;
      logs = allLocal.slice().reverse().slice(0, 200);
      this.logsCapped = this.fullLogCount > logs.length;
      console.warn(err);
    }

    this.allLogs = logs.map((l) => this.normalizeLogRow(l));
    this.populateActionFilterOptions();
    this.applyLogFilters();
  },

  populateActionFilterOptions() {
    const select = document.getElementById("logFilterAction");
    if (!select) return;

    const current = select.value;
    const known = [
      "login",
      "case_setup",
      "app_launch",
      "search",
      "article_view",
      "flow_start",
      "flow_step",
      "step_progress",
      "resolution",
      "feedback",
      "escalation",
      "copy_notes"
    ];
    const fromLogs = [...new Set((this.allLogs || []).map((l) => l.action).filter(Boolean))];
    const actions = [...new Set([...known, ...fromLogs])].sort();

    select.innerHTML =
      '<option value="">All actions</option>' +
      actions.map((a) => '<option value="' + this.escape(a) + '">' + this.escape(a) + "</option>").join("");

    if (current && actions.includes(current)) {
      select.value = current;
    }
  },

  hasActiveLogFilters() {
    return Boolean(
      document.getElementById("logFilterAction")?.value ||
        (document.getElementById("logFilterChatIms")?.value || "").trim() ||
        document.getElementById("logFilterDateFrom")?.value ||
        document.getElementById("logFilterDateTo")?.value ||
        (document.getElementById("logFilterText")?.value || "").trim()
    );
  },

  filterLogs(logs) {
    const action = document.getElementById("logFilterAction")?.value || "";
    const chatIms = (document.getElementById("logFilterChatIms")?.value || "").trim().toLowerCase();
    const dateFrom = document.getElementById("logFilterDateFrom")?.value || "";
    const dateTo = document.getElementById("logFilterDateTo")?.value || "";
    const text = (document.getElementById("logFilterText")?.value || "").trim().toLowerCase();

    return (logs || []).map((l) => this.normalizeLogRow(l)).filter((l) => {
      if (action && l.action !== action) return false;
      if (chatIms && !(l.chatIms || "").toLowerCase().includes(chatIms)) return false;

      if (dateFrom || dateTo) {
        const logDate = this.getLogDateInIST(l.timestamp);
        if (!logDate) return false;
        if (dateFrom && logDate < dateFrom) return false;
        if (dateTo && logDate > dateTo) return false;
      }

      if (text) {
        const haystack = [
          l.query,
          l.kbId,
          l.kbTitle,
          l.details,
          l.flowId,
          l.feedback,
          l.action,
          l.chatIms,
          l.platform,
          l.environment,
          l.resolved,
          l.escalated
        ]
          .map((v) => (v || "").toLowerCase())
          .join(" ");
        if (!haystack.includes(text)) return false;
      }

      return true;
    });
  },

  applyLogFilters() {
    const filtered = this.filterLogs(this.allLogs);
    this.renderLogsTable(filtered);
    this.renderLogStats(filtered);
    this.updateLogFilterSummary(filtered);
  },

  updateLogFilterSummary(filtered) {
    const el = document.getElementById("logFilterSummary");
    if (!el) return;

    const total = (this.allLogs || []).length;
    const shown = filtered.length;

    if (!total) {
      el.textContent = "";
      return;
    }

    if (this.hasActiveLogFilters()) {
      el.textContent =
        "Showing " +
        shown +
        " of " +
        total +
        " loaded log" +
        (total === 1 ? "" : "s") +
        " (filters active; export uses full dataset)";
    } else if (this.logsCapped) {
      const full = this.fullLogCount || total;
      el.textContent =
        "Showing latest " +
        total +
        " of " +
        full +
        " log" +
        (full === 1 ? "" : "s");
    } else {
      el.textContent = total + " log" + (total === 1 ? "" : "s") + " loaded";
    }
  },

  clearLogFilters() {
    const action = document.getElementById("logFilterAction");
    const chatIms = document.getElementById("logFilterChatIms");
    const dateFrom = document.getElementById("logFilterDateFrom");
    const dateTo = document.getElementById("logFilterDateTo");
    const text = document.getElementById("logFilterText");

    if (action) action.value = "";
    if (chatIms) chatIms.value = "";
    if (dateFrom) dateFrom.value = "";
    if (dateTo) dateTo.value = "";
    if (text) text.value = "";

    this.applyLogFilters();
  },

  renderLogStats(logs) {
    const searches = logs.filter((l) => l.action === "search").length;
    const views = logs.filter((l) => l.action === "article_view").length;
    const escalations = logs.filter((l) => l.action === "escalation").length;
    const uniqueCases = new Set(
      logs.map((l) => this.normalizeLogRow(l).chatIms).filter(Boolean)
    ).size;

    document.getElementById("statSearches").textContent = searches;
    document.getElementById("statViews").textContent = views;
    document.getElementById("statEscalations").textContent = escalations;
    document.getElementById("statUsers").textContent = uniqueCases;

    const queryCounts = {};
    logs
      .filter((l) => l.action === "search" && l.query)
      .forEach((l) => {
        const q = l.query.toLowerCase();
        queryCounts[q] = (queryCounts[q] || 0) + 1;
      });
    const topQueries = Object.entries(queryCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    const topEl = document.getElementById("topQueries");
    topEl.innerHTML = topQueries.length
      ? topQueries.map(([q, c]) => "<li>" + this.escape(q) + " (" + c + ")</li>").join("")
      : "<li>No searches yet</li>";
  },

  renderLogsTable(logs) {
    const tbody = document.getElementById("logsTableBody");
    if (!logs.length) {
      const msg = this.hasActiveLogFilters()
        ? "No logs match the current filters."
        : "No logs recorded yet.";
      tbody.innerHTML = "<tr><td colspan='11'>" + msg + "</td></tr>";
      return;
    }
    tbody.innerHTML = logs
      .map((raw) => {
        const l = this.normalizeLogRow(raw);
        return (
          "<tr>" +
          "<td>" + this.escape(this.formatLogTimestamp(l.timestamp)) + "</td>" +
          "<td>" + this.escape(l.chatIms || "") + "</td>" +
          "<td>" + this.escape(l.platform || "") + "</td>" +
          "<td>" + this.escape(l.environment || "") + "</td>" +
          "<td>" + this.escape(l.action || "") + "</td>" +
          "<td>" + this.escape(l.action === "search" ? l.query || "" : "") + "</td>" +
          "<td>" + this.escape(l.kbId || "") + "</td>" +
          "<td>" + this.escape(l.kbTitle || l.details || "") + "</td>" +
          "<td>" + this.escape(l.resolved || "") + "</td>" +
          "<td>" + this.escape(l.escalated || "") + "</td>" +
          "<td>" + this.escape(l.feedback || "") + "</td>" +
          "</tr>"
        );
      })
      .join("");
  },

  async exportLogsCsv() {
    let logs = [];

    if (this.hasActiveLogFilters()) {
      logs = this.filterLogs(await this.getFullLogs());
    } else if (window.SP_CONFIG.useSharePoint) {
      try {
        logs = await SharePoint.getLogsFromSharePoint(5000);
      } catch {
        logs = SharePoint.getLocalLogs();
      }
    } else {
      logs = SharePoint.getLocalLogs();
    }

    if (!logs.length) {
      alert(this.hasActiveLogFilters() ? "No logs match the current filters to export." : "No logs to export.");
      return;
    }

    const headers = [
      "timestamp",
      "employeeId",
      "chatIms",
      "platform",
      "environment",
      "userEmail",
      "action",
      "query",
      "kbId",
      "kbTitle",
      "flowId",
      "details",
      "resolved",
      "escalated",
      "feedback"
    ];
    const rows = logs.map((raw) => {
      const l = this.normalizeLogRow(raw);
      return headers
        .map((h) => {
          let val = l[h] || "";
          if (h === "timestamp" && val) {
            val = this.formatLogTimestamp(val);
          }
          return '"' + String(val).replace(/"/g, '""') + '"';
        })
        .join(",");
    });
    const csv = headers.join(",") + "\n" + rows.join("\n");
    const suffix = this.hasActiveLogFilters() ? "-filtered" : "";
    this.downloadBlob(csv, "outlook-assistant-logs" + suffix + ".csv", "text/csv");
  },

  clearLocalLogs() {
    if (confirm("Clear all locally stored logs?")) {
      localStorage.removeItem("outlookAssistant_logs");
      this.loadLogStats();
    }
  },

  async downloadSample() {
    try {
      const res = await fetch(window.SP_CONFIG.localKbPath);
      const json = await res.text();
      this.downloadBlob(json, "kb-articles.sample.json", "application/json");
    } catch {
      alert("Could not download sample KB.");
    }
  },

  downloadBlob(content, filename, type) {
    const blob = new Blob([content], { type });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  },

  escape(str) {
    const div = document.createElement("div");
    div.textContent = str || "";
    return div.innerHTML;
  }
};

document.addEventListener("DOMContentLoaded", () => Admin.init());

if (typeof window !== "undefined") {
  window.Admin = Admin;
}
