#!/usr/bin/env node
/**
 * Validates logging separates agent ID from Chat IMS.
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");

function load(file, extras = {}) {
  const code = fs.readFileSync(path.join(root, file), "utf8");
  const sandbox = {
    module: { exports: {} },
    exports: {},
    console,
    window: { SP_CONFIG: { logging: { captureEmployeeId: true, captureChatIms: true, capturePlatform: true, captureEnvironment: true } } },
    Storage: {
      getSessionId: () => "sess_test",
      getEmployeeId: () => "E12345"
    },
    Session: {
      getEmployeeId: () => "E12345",
      getCaseDetails: () => ({
        chatIms: "IMS-99999",
        platform: "Windows",
        environment: "Exchange Online"
      })
    },
    SharePoint: {
      writeLog(entry) {
        sandbox._lastLog = entry;
        return Promise.resolve();
      }
    },
    ...extras
  };
  vm.runInNewContext(code, sandbox, { filename: file });
  return sandbox;
}

const loggingCode = fs.readFileSync(path.join(root, "js/logging.js"), "utf8");
if (loggingCode.includes("caseIms || employeeId")) {
  console.error("FAIL: Logger.init must not prefer Chat IMS as employeeId");
  process.exit(1);
}

const sandbox = load("js/logging.js");
const Logger = sandbox.Logger || sandbox.window.Logger;
if (!Logger) {
  console.error("FAIL: could not load Logger");
  process.exit(1);
}
Logger.init("E12345");
const ctx = Logger.buildContext();

if (ctx.employeeId !== "E12345") {
  console.error("FAIL: expected employeeId E12345, got " + ctx.employeeId);
  process.exit(1);
}
if (ctx.chatIms !== "IMS-99999") {
  console.error("FAIL: expected chatIms IMS-99999, got " + ctx.chatIms);
  process.exit(1);
}
if (ctx.platform !== "Windows" || ctx.environment !== "Exchange Online") {
  console.error("FAIL: expected platform/environment from case details");
  process.exit(1);
}

// Storage fallback when Session is unavailable (e.g. partial legacy session data)
const storageOnly = load("js/logging.js", {
  Session: undefined,
  Storage: {
    getSessionId: () => "sess_test",
    getEmployeeId: () => "E12345",
    getCaseDetails: () => ({
      chatIms: "IMS-55555",
      platform: "Mac",
      environment: "Microsoft 365"
    }),
    getGuideSession: () => null
  }
});
const LoggerStorage = storageOnly.Logger || storageOnly.window.Logger;
LoggerStorage.init("E12345");
const storageCtx = LoggerStorage.buildContext();
if (storageCtx.chatIms !== "IMS-55555" || storageCtx.platform !== "Mac") {
  console.error("FAIL: buildContext must read case details from Storage when Session missing");
  process.exit(1);
}

// Defaults for platform/environment when case has only IMS
const partialCase = load("js/logging.js", {
  Storage: {
    getSessionId: () => "sess_test",
    getCaseDetails: () => ({ chatIms: "IMS-1", caseSetupComplete: true }),
    getGuideSession: () => null
  },
  Session: {
    getCaseDetails: () => ({ chatIms: "IMS-1", caseSetupComplete: true })
  }
});
const LoggerPartial = partialCase.Logger || partialCase.window.Logger;
LoggerPartial.init("agent");
const partialCtx = LoggerPartial.buildContext();
if (partialCtx.platform !== "Windows" || partialCtx.environment !== "Exchange Online") {
  console.error("FAIL: buildContext must default platform/environment");
  process.exit(1);
}

Logger.log("search", { query: "password", details: "Results: 3" });
const entry = sandbox._lastLog;
if (entry.employeeId !== "E12345" || entry.chatIms !== "IMS-99999") {
  console.error("FAIL: log entry mixed agent and case fields");
  process.exit(1);
}

const configCode = fs.readFileSync(path.join(root, "js/config.js"), "utf8");
if (!configCode.includes("logging:") || !configCode.includes("captureChatIms")) {
  console.error("FAIL: config.js missing logging capture settings");
  process.exit(1);
}

const adminHtml = fs.readFileSync(path.join(root, "admin.html"), "utf8");
if (!adminHtml.includes("Chat IMS") || !adminHtml.includes("logFilterChatIms")) {
  console.error("FAIL: admin dashboard missing Chat IMS log column/filter");
  process.exit(1);
}
if (adminHtml.includes("logFilterEmployee") || /<th>Agent<\/th>/.test(adminHtml)) {
  console.error("FAIL: admin dashboard should not show Agent column or filter");
  process.exit(1);
}
if (!adminHtml.includes("Search term") || !adminHtml.includes(">Resolved<") || !adminHtml.includes(">Escalated<")) {
  console.error("FAIL: admin dashboard missing Search term, Resolved, or Escalated columns");
  process.exit(1);
}

const adminJs = fs.readFileSync(path.join(root, "js/admin.js"), "utf8");
if (!adminJs.includes("getLogOutcomeFlags")) {
  console.error("FAIL: admin.js missing log outcome helpers");
  process.exit(1);
}
if (!adminJs.includes("formatLogTimestamp") || !adminJs.includes('timeZone: "Asia/Kolkata"')) {
  console.error("FAIL: admin.js missing IST formatLogTimestamp helper");
  process.exit(1);
}
if (!adminJs.includes("getLogDateInIST") || !adminJs.includes("getFullLogs")) {
  console.error("FAIL: admin.js missing IST date filter or full-log export helpers");
  process.exit(1);
}
if (!adminJs.includes("filterLogs(await this.getFullLogs())")) {
  console.error("FAIL: filtered CSV export must filter full log dataset, not capped allLogs");
  process.exit(1);
}
if (!adminJs.includes("renderLogStats(filtered)")) {
  console.error("FAIL: applyLogFilters must re-render stats from filtered logs");
  process.exit(1);
}

const caseJs = fs.readFileSync(path.join(root, "js/case.js"), "utf8");
const caseSubmitSection = caseJs.slice(caseJs.indexOf("async handleSubmit"));
if (
  !caseSubmitSection.includes("await Logger.log") ||
  caseSubmitSection.indexOf("window.location.href") < caseSubmitSection.indexOf("await Logger.log")
) {
  console.error("FAIL: case.js must await Logger.log before navigation");
  process.exit(1);
}

const adminSandbox = load("js/admin.js", {
  document: {
    addEventListener() {},
    getElementById() { return null; },
    createElement() {
      return { textContent: "", innerHTML: "" };
    }
  },
  ThemePicker: { mount() {} },
  Themes: { init() {} },
  AdminAuth: { requireAuth: () => false }
});
const Admin = adminSandbox.window.Admin;
if (!Admin || typeof Admin.formatLogTimestamp !== "function") {
  console.error("FAIL: Admin.formatLogTimestamp not available");
  process.exit(1);
}
const istFormatted = Admin.formatLogTimestamp("2026-07-09T01:11:25.972Z");
if (istFormatted !== "09/07/2026, 6:41:25 am IST") {
  console.error("FAIL: formatLogTimestamp expected IST display, got " + istFormatted);
  process.exit(1);
}
if (Admin.formatLogTimestamp("") !== "" || Admin.formatLogTimestamp("not-a-date") !== "") {
  console.error("FAIL: formatLogTimestamp should return empty for invalid input");
  process.exit(1);
}

const backfilled = Admin.normalizeLogRow({
  action: "case_setup",
  details: "Chat IMS: IMS-777, Platform: Mac, Environment: Microsoft 365"
});
if (backfilled.chatIms !== "IMS-777" || backfilled.platform !== "Mac") {
  console.error("FAIL: normalizeLogRow must backfill case fields from case_setup details");
  process.exit(1);
}

console.log("OK logging validation: agent ID and Chat IMS captured separately");
process.exit(0);
