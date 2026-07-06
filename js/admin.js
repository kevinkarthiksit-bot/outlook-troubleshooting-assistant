/**
 * Admin page: KB upload, validation, log dashboard.
 */
const Admin = {
  parsedKb: null,
  allLogs: [],
  logFilterDebounce: null,

  async init() {
    if (!AdminAuth.requireAuth()) return;

    ThemePicker.mount("#themePickerMount");
    Themes.init();
    await this.checkAccess();
    this.bindEvents();
    await this.loadLogStats();
  },


  async checkAccess() {
    const cfg = window.SP_CONFIG;
    const banner = document.getElementById("accessBanner");
    const adminLabel = "Signed in as admin: " + AdminAuth.getUsername();
    if (!cfg.useSharePoint) {
      if (banner) {
        banner.textContent = adminLabel + " | Demo mode: admin features enabled locally.";
        banner.className = "banner info";
      }
      return;
    }
    try {
      let allowed = false;
      for (const group of cfg.adminGroups || []) {
        if (await SharePoint.isUserInGroup(group)) {
          allowed = true;
          break;
        }
      }
      if (banner) {
        banner.textContent = allowed
          ? adminLabel
          : adminLabel + " | Warning: SharePoint admin group membership could not be verified.";
        banner.className = allowed ? "banner info" : "banner warn";
      }
    } catch {
      if (banner) {
        banner.textContent = adminLabel + " | Could not verify SharePoint admin group membership.";
        banner.className = "banner warn";
      }
    }
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
    document.getElementById("downloadSampleBtn")?.addEventListener("click", () => this.downloadSample());
    document.getElementById("refreshLogsBtn")?.addEventListener("click", () => this.loadLogStats());
    document.getElementById("exportLogsBtn")?.addEventListener("click", () => this.exportLogsCsv());
    document.getElementById("clearLocalLogsBtn")?.addEventListener("click", () => this.clearLocalLogs());
    document.getElementById("logFilterAction")?.addEventListener("change", () => this.applyLogFilters());
    document.getElementById("logFilterDateFrom")?.addEventListener("change", () => this.applyLogFilters());
    document.getElementById("logFilterDateTo")?.addEventListener("change", () => this.applyLogFilters());
    document.getElementById("logFilterEmployee")?.addEventListener("input", () => {
      clearTimeout(this.logFilterDebounce);
      this.logFilterDebounce = setTimeout(() => this.applyLogFilters(), 250);
    });
    document.getElementById("logFilterText")?.addEventListener("input", () => {
      clearTimeout(this.logFilterDebounce);
      this.logFilterDebounce = setTimeout(() => this.applyLogFilters(), 250);
    });
    document.getElementById("clearLogFiltersBtn")?.addEventListener("click", () => this.clearLogFilters());
  },

  async handleFileSelect(file) {
    if (!file) return;
    const preview = document.getElementById("uploadPreview");
    preview.textContent = "Parsing " + file.name + "...";

    try {
      const ext = file.name.split(".").pop().toLowerCase();
      if (ext === "json") {
        const text = await file.text();
        this.parsedKb = JSON.parse(text);
      } else if (ext === "csv") {
        this.parsedKb = this.parseCsv(await file.text());
      } else if (ext === "xlsx" || ext === "xls") {
        this.parsedKb = await this.parseExcel(file);
      } else {
        throw new Error("Unsupported format. Use JSON, CSV, or Excel.");
      }
      this.validateKb(this.parsedKb);
      preview.textContent =
        "Valid KB: " +
        (this.parsedKb.articles?.length || 0) +
        " articles ready to upload.";
      preview.className = "preview success";
      document.getElementById("uploadKbBtn").disabled = false;
    } catch (err) {
      preview.textContent = "Error: " + err.message;
      preview.className = "preview error";
      this.parsedKb = null;
      document.getElementById("uploadKbBtn").disabled = true;
    }
  },

  parseCsv(text) {
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) throw new Error("CSV must have header and data rows");

    const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
    const numIdx = headers.findIndex((h) => /number|id|kb/i.test(h));
    const descIdx = headers.findIndex((h) => /description|title|short/i.test(h));

    if (numIdx < 0 || descIdx < 0) {
      throw new Error('CSV must have "Number" and "Short description" columns');
    }

    const articles = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = this.parseCsvLine(lines[i]);
      const id = (cols[numIdx] || "").trim();
      const title = (cols[descIdx] || "").trim();
      if (!id || !title) continue;

      const categoryMatch = title.match(/\[([^\]]+)\]/);
      articles.push({
        id,
        title,
        category: categoryMatch ? categoryMatch[1] : "General",
        keywords: title.toLowerCase().replace(/[^\w\s]/g, " ").split(/\s+/).filter((w) => w.length > 2),
        symptoms: [],
        priority: 3,
        steps: ["Refer to the full KB article for detailed steps.", "Contact IT if you need assistance."],
        url: ""
      });
    }

    return {
      version: "1.0.0",
      lastUpdated: new Date().toISOString().slice(0, 10),
      articles,
      flows: [],
      synonyms: {}
    };
  },

  parseCsvLine(line) {
    const result = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === "," && !inQuotes) {
        result.push(current);
        current = "";
      } else {
        current += ch;
      }
    }
    result.push(current);
    return result.map((s) => s.replace(/^"|"$/g, "").trim());
  },

  async parseExcel(file) {
    if (typeof XLSX === "undefined") {
      throw new Error("Excel support requires SheetJS (loaded via CDN on this page).");
    }
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

    const articles = rows
      .map((row) => {
        const id =
          row.Number || row.number || row.ID || row.Id || row["KB Number"] || "";
        const title =
          row["Short description"] ||
          row.Description ||
          row.Title ||
          row.title ||
          "";
        if (!id || !title) return null;
        const categoryMatch = String(title).match(/\[([^\]]+)\]/);
        return {
          id: String(id).trim(),
          title: String(title).trim(),
          category: categoryMatch ? categoryMatch[1] : "General",
          keywords: String(title)
            .toLowerCase()
            .replace(/[^\w\s]/g, " ")
            .split(/\s+/)
            .filter((w) => w.length > 2),
          symptoms: [],
          priority: 3,
          steps: ["Refer to the full KB article for detailed steps."],
          url: ""
        };
      })
      .filter(Boolean);

    return {
      version: "1.0.0",
      lastUpdated: new Date().toISOString().slice(0, 10),
      articles,
      flows: [],
      synonyms: {}
    };
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
    btn.textContent = "Uploading...";

    try {
      this.parsedKb.lastUpdated = new Date().toISOString().slice(0, 10);
      const json = JSON.stringify(this.parsedKb, null, 2);
      const cfg = window.SP_CONFIG;

      if (cfg.useSharePoint) {
        await SharePoint.uploadKbFile("kb-articles.json", json);
      } else {
        localStorage.setItem("outlookAssistant_adminKb", json);
        Storage.setKbCache(this.parsedKb);
      }

      document.getElementById("uploadPreview").textContent =
        "Upload successful! Users will get the updated KB on next refresh (cached up to " +
        cfg.kbCacheHours +
        "h).";
      document.getElementById("uploadPreview").className = "preview success";
    } catch (err) {
      document.getElementById("uploadPreview").textContent = "Upload failed: " + err.message;
      document.getElementById("uploadPreview").className = "preview error";
    } finally {
      btn.disabled = false;
      btn.textContent = "Upload to SharePoint";
    }
  },

  async loadLogStats() {
    const tbody = document.getElementById("logsTableBody");
    tbody.innerHTML = "<tr><td colspan='7'>Loading...</td></tr>";

    let logs = [];
    try {
      if (window.SP_CONFIG.useSharePoint) {
        logs = await SharePoint.getLogsFromSharePoint(200);
      } else {
        logs = SharePoint.getLocalLogs().reverse().slice(0, 200);
      }
    } catch (err) {
      logs = SharePoint.getLocalLogs().reverse().slice(0, 200);
      console.warn(err);
    }

    this.allLogs = logs;
    this.populateActionFilterOptions();
    this.renderLogStats(logs);
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
        (document.getElementById("logFilterEmployee")?.value || "").trim() ||
        document.getElementById("logFilterDateFrom")?.value ||
        document.getElementById("logFilterDateTo")?.value ||
        (document.getElementById("logFilterText")?.value || "").trim()
    );
  },

  filterLogs(logs) {
    const action = document.getElementById("logFilterAction")?.value || "";
    const employee = (document.getElementById("logFilterEmployee")?.value || "").trim().toLowerCase();
    const dateFrom = document.getElementById("logFilterDateFrom")?.value || "";
    const dateTo = document.getElementById("logFilterDateTo")?.value || "";
    const text = (document.getElementById("logFilterText")?.value || "").trim().toLowerCase();

    return (logs || []).filter((l) => {
      if (action && l.action !== action) return false;
      if (employee && !(l.employeeId || "").toLowerCase().includes(employee)) return false;

      if (dateFrom || dateTo) {
        const ts = l.timestamp ? new Date(l.timestamp) : null;
        if (!ts || Number.isNaN(ts.getTime())) return false;
        if (dateFrom && ts < new Date(dateFrom + "T00:00:00")) return false;
        if (dateTo && ts > new Date(dateTo + "T23:59:59.999")) return false;
      }

      if (text) {
        const haystack = [l.query, l.kbId, l.kbTitle, l.details, l.flowId, l.feedback, l.action, l.employeeId]
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
        "Showing " + shown + " of " + total + " log" + (total === 1 ? "" : "s") + " (filters active)";
    } else {
      el.textContent = total + " log" + (total === 1 ? "" : "s") + " loaded";
    }
  },

  clearLogFilters() {
    const action = document.getElementById("logFilterAction");
    const employee = document.getElementById("logFilterEmployee");
    const dateFrom = document.getElementById("logFilterDateFrom");
    const dateTo = document.getElementById("logFilterDateTo");
    const text = document.getElementById("logFilterText");

    if (action) action.value = "";
    if (employee) employee.value = "";
    if (dateFrom) dateFrom.value = "";
    if (dateTo) dateTo.value = "";
    if (text) text.value = "";

    this.applyLogFilters();
  },

  renderLogStats(logs) {
    const searches = logs.filter((l) => l.action === "search").length;
    const views = logs.filter((l) => l.action === "article_view").length;
    const escalations = logs.filter((l) => l.action === "escalation").length;
    const uniqueUsers = new Set(logs.map((l) => l.employeeId).filter(Boolean)).size;

    document.getElementById("statSearches").textContent = searches;
    document.getElementById("statViews").textContent = views;
    document.getElementById("statEscalations").textContent = escalations;
    document.getElementById("statUsers").textContent = uniqueUsers;

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
      tbody.innerHTML = "<tr><td colspan='7'>" + msg + "</td></tr>";
      return;
    }
    tbody.innerHTML = logs
      .map(
        (l) =>
          "<tr>" +
          "<td>" + this.escape(l.timestamp || "") + "</td>" +
          "<td>" + this.escape(l.employeeId || "") + "</td>" +
          "<td>" + this.escape(l.action || "") + "</td>" +
          "<td>" + this.escape(l.query || "") + "</td>" +
          "<td>" + this.escape(l.kbId || "") + "</td>" +
          "<td>" + this.escape(l.kbTitle || l.details || "") + "</td>" +
          "<td>" + this.escape(l.feedback || "") + "</td>" +
          "</tr>"
      )
      .join("");
  },

  async exportLogsCsv() {
    let logs = [];

    if (this.hasActiveLogFilters()) {
      logs = this.filterLogs(this.allLogs);
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

    const headers = ["timestamp", "employeeId", "userEmail", "action", "query", "kbId", "kbTitle", "flowId", "details", "feedback"];
    const rows = logs.map((l) =>
      headers.map((h) => '"' + String(l[h] || "").replace(/"/g, '""') + '"').join(",")
    );
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
