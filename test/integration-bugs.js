#!/usr/bin/env node
/**
 * Runtime integration checks beyond smoke tests.
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");
const bugs = [];
const fixed = [];

function load(file, extras = {}) {
  const code = fs.readFileSync(path.join(root, file), "utf8");
  const sandbox = {
    module: { exports: {} },
    exports: {},
    console,
    window: {},
    ...extras
  };
  vm.runInNewContext(code, sandbox, { filename: file });
  return sandbox.module.exports;
}

const StepUtils = {
  appliesToPlatform(step, platform) {
    if (!step || typeof step === "string") return true;
    if (!step.platforms?.length) return true;
    return step.platforms.some((p) => p.toLowerCase() === platform.toLowerCase());
  },
  filterSteps(steps) {
    return steps || [];
  }
};

const kbData = JSON.parse(fs.readFileSync(path.join(root, "data/kb-articles.json"), "utf8"));
const tsData = JSON.parse(fs.readFileSync(path.join(root, "data/troubleshooting-guide.json"), "utf8"));

const SearchEngine = {
  kbData,
  getArticleById(id) {
    return kbData.articles.find((a) => a.id === id) || null;
  },
  normalize(text) {
    return (text || "").toLowerCase().replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();
  },
  expandQuery(query) {
    return this.normalize(query).split(" ").filter(Boolean);
  },
  scoreArticle(article, terms, rawQuery, platform) {
    let score = 0;
    const q = this.normalize(rawQuery);
    if (this.normalize(article.title).includes(q)) score += 50;
    if (typeof PlatformMatch !== "undefined" && platform) {
      score += PlatformMatch.platformBoost(article, platform, false);
    }
    return score;
  },
  search(query, limit = 10, options = {}) {
    const platform = options.platform;
    const q = (query || "").trim();
    if (!q) return [];
    const terms = this.expandQuery(q);
    return kbData.articles
      .map((article) => ({
        article,
        score: this.scoreArticle(article, terms, q, platform)
      }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((r, i) => ({
        ...r.article,
        relevanceScore: r.score,
        matchLabel: i === 0 ? "Best match" : "Related"
      }));
  }
};

const TroubleshootingSearch = {
  data: tsData,
  getGuideById(id) {
    return tsData.guides.find((g) => g.id === id) || null;
  },
  getFlows() {
    return tsData.flows || [];
  },
  normalize(text) {
    return (text || "").toLowerCase().replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();
  },
  expandQuery(query) {
    return this.normalize(query).split(" ").filter(Boolean);
  },
  scoreGuide(guide, terms, rawQuery, platform) {
    let score = 0;
    const q = this.normalize(rawQuery);
    if (this.normalize(guide.title).includes(q)) score += 50;
    if (typeof PlatformMatch !== "undefined" && platform) {
      score += PlatformMatch.platformBoost(guide, platform, true);
    }
    return score;
  },
  search(query, limit = 12, options = {}) {
    const platform = options.platform;
    const q = (query || "").trim();
    if (!q) {
      return tsData.guides
        .filter((g) => !platform || PlatformMatch.guideAppliesToPlatform(g, platform))
        .map((g) => ({ ...g, matchLabel: "Available" }));
    }
    const terms = this.expandQuery(q);
    return tsData.guides
      .map((guide) => ({ guide, score: this.scoreGuide(guide, terms, q, platform) }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((r, i) => ({
        ...r.guide,
        relevanceScore: r.score,
        matchLabel: i === 0 ? "Best match" : "Related"
      }));
  }
};

const { PlatformMatch } = load("js/platform-match.js", { StepUtils, Session: { getCaseDetails: () => ({ platform: "Windows" }) } });
const { GuideResolver } = load("js/guide-resolver.js", {
  StepUtils,
  PlatformMatch,
  Session: {
    getCaseDetails: () => ({ platform: "Windows" }),
    startGuide() {},
    updateGuideSession() {}
  },
  Logger: { logArticleView() {} },
  TroubleshootingSearch,
  SearchEngine
});
const { UnifiedSearch } = load("js/unified-search.js", {
  PlatformMatch,
  Session: { getCaseDetails: () => ({ platform: "Windows" }) },
  TroubleshootingSearch,
  SearchEngine
});

// Bug check 1: KB-only page resolver without TS module
const { GuideResolver: IsolatedResolver } = load("js/guide-resolver.js", {
  StepUtils,
  PlatformMatch,
  Session: { getCaseDetails: () => ({ platform: "Windows" }), startGuide() {}, updateGuideSession() {} },
  Logger: { logArticleView() {} },
  SearchEngine
});
const article = kbData.articles[0];
try {
  const resolved = IsolatedResolver.resolveItem({ ...article, type: "kb" });
  if (!resolved || resolved.type !== "kb") {
    bugs.push("GuideResolver crashes or misroutes on org KB page without TroubleshootingSearch loaded");
  }
} catch (e) {
  bugs.push("GuideResolver throws on org KB page without TS: " + e.message);
}

// Bug check 2: Unified search TS-first ordering with KB following
const merged = UnifiedSearch.suggest("password", { platform: "Windows", limit: 10 });
const firstTsIdx = merged.findIndex((r) => r.type === "troubleshooting" || r.type === "flow");
const firstKbIdx = merged.findIndex((r) => r.type === "kb");
if (merged.length >= 2 && firstKbIdx >= 0 && firstTsIdx >= 0 && firstKbIdx < firstTsIdx) {
  bugs.push("Unified search does not rank troubleshooting guides before org KB for 'password'");
}
if (firstTsIdx >= 0 && firstKbIdx >= 0) {
  const kbAfterTs = merged.slice(firstTsIdx).some((r) => r.type === "kb");
  if (!kbAfterTs) {
    bugs.push("Unified search should include org KB suggestions after troubleshooting guides");
  }
}

// Bug check 3: relatedKbId seeds
const seeded = tsData.guides.filter((g) => g.relatedKbId);
for (const g of seeded) {
  if (!SearchEngine.getArticleById(g.relatedKbId)) {
    bugs.push("Broken relatedKbId on guide " + g.id + " -> " + g.relatedKbId);
  }
}

// Bug check 4: flow guideIds all resolve
for (const flow of tsData.flows || []) {
  for (const step of flow.steps || []) {
    for (const opt of step.options || []) {
      const ids = opt.guideIds || opt.kbIds || [];
      for (const id of ids) {
        const targets = GuideResolver.resolveFlowTargets([id]);
        if (!targets.length) {
          bugs.push("Flow '" + flow.id + "' option references unresolved id: " + id);
        }
      }
    }
  }
}

// Bug check 5: case/login redirects
const caseJs = fs.readFileSync(path.join(root, "js/case.js"), "utf8");
const loginJs = fs.readFileSync(path.join(root, "js/login.js"), "utf8");
if (!caseJs.includes("troubleshooting.html")) {
  bugs.push("case.js does not redirect to troubleshooting hub");
}
if (!caseJs.includes("isEditMode") || !caseJs.includes('params.get("edit")')) {
  bugs.push("case.js missing edit mode for Edit Case flow");
}
if (loginJs.includes('href = "index.html"') && loginJs.includes("isCaseSetupComplete")) {
  bugs.push("login.js still sends completed sessions to org KB");
}

// Bug check 6: index.html loads TS modules for GuideResolver routing
const indexHtml = fs.readFileSync(path.join(root, "index.html"), "utf8");
if (!indexHtml.includes("guide-resolver.js")) {
  bugs.push("index.html missing guide-resolver.js script");
}
if (!indexHtml.includes("troubleshooting-search.js") || !indexHtml.includes("troubleshooting-loader.js")) {
  bugs.push("index.html missing troubleshooting-search.js or troubleshooting-loader.js (KB hub cannot route to TS guides)");
}

// Bug check 7: symptoms populated in KB
const emptySymptoms = kbData.articles.filter((a) => !a.symptoms?.length).length;
if (emptySymptoms > 0) {
  bugs.push(emptySymptoms + " KB articles still have empty symptoms arrays (weak matching)");
}

// Bug check 8: Mac-only guide filtered on Windows browse
const macOnly = tsData.guides.find((g) =>
  (g.steps || []).length > 0 &&
  (g.steps || []).every((s) => typeof s === "object" && s.platforms?.length === 1 && s.platforms[0] === "Mac")
);
if (macOnly) {
  const all = TroubleshootingSearch.search("", 50, { platform: "Windows" });
  if (all.some((g) => g.id === macOnly.id)) {
    bugs.push("Mac-only guide appears in Windows browse-all results: " + macOnly.id);
  }
}

// Bug check 9: SPA login redirect in built file
const spa = fs.readFileSync(path.join(root, "single-file/outlook-assistant.html"), "utf8");
if (spa.includes('isCaseSetupComplete()) {\n        SPA.navigate("index")')) {
  bugs.push("Single-file SPA still routes completed login to index instead of troubleshooting");
}

// Bug check 10: guide.html home link
const guideHtml = fs.readFileSync(path.join(root, "guide.html"), "utf8");
if (guideHtml.includes('href="index.html"') && guideHtml.includes("Home")) {
  bugs.push("guide.html Home link still points to org KB instead of troubleshooting hub");
}

// Bug check 11: flow single-target must preserve guide type (not re-resolve as KB)
const flowGuide = tsData.guides.find((g) => g.id && TroubleshootingSearch.getGuideById(g.id));
if (flowGuide) {
  const targets = GuideResolver.resolveFlowTargets([flowGuide.id]);
  if (targets.length === 1) {
    const misrouted = GuideResolver.resolveItem(targets[0].item);
    const correct = GuideResolver.resolveItem({ ...targets[0].item, type: targets[0].type });
    if (misrouted.type !== correct.type && correct.type === "troubleshooting") {
      bugs.push(
        "Flow single-guide openItem without type can misroute " + flowGuide.id + " as " + misrouted.type
      );
    }
  }
}

// Bug check 13: primary hub exposes admin entry point
const tsHtml = fs.readFileSync(path.join(root, "troubleshooting.html"), "utf8");
if (!tsHtml.includes('href="admin.html"')) {
  bugs.push("troubleshooting hub missing Admin link");
}
const adminLoginHtml = fs.readFileSync(path.join(root, "admin-login.html"), "utf8");
const adminPageHtml = fs.readFileSync(path.join(root, "admin.html"), "utf8");
if (!adminLoginHtml.includes("adminLoginForm") || !adminPageHtml.includes("uploadKbBtn")) {
  bugs.push("admin login or dashboard pages missing core controls");
}

const caseHtml = fs.readFileSync(path.join(root, "case.html"), "utf8");
if (!caseHtml.includes('href="admin-login.html"')) {
  bugs.push("case setup page missing administrator sign-in link");
}
const tsJs = fs.readFileSync(path.join(root, "js/troubleshooting.js"), "utf8");
if (!tsJs.includes("case.html?edit=1")) {
  bugs.push("troubleshooting.js Edit Case should open case.html?edit=1");
}
if (tsJs.includes("GuideResolver.openItem(targets[0].item)")) {
  bugs.push("troubleshooting.js flow handler opens single target without type");
}

// Bug check 12: case_setup log must complete before navigation
const submitSection = caseJs.slice(caseJs.indexOf("async handleSubmit"));
if (
  !submitSection.includes("await Logger.log") ||
  submitSection.indexOf("window.location.href") < submitSection.indexOf("await Logger.log")
) {
  bugs.push("case.js must await Logger.log before navigating away on case setup");
}

// Bug check 13: hub escalate must persist session flag
if (!fs.readFileSync(path.join(root, "js/app.js"), "utf8").includes("Session.setEscalated()")) {
  bugs.push("app.js escalate() missing Session.setEscalated()");
}
if (!tsJs.includes("Session.setEscalated()")) {
  bugs.push("troubleshooting.js escalate() missing Session.setEscalated()");
}

// Bug check 14: guide-resolver must await article view log before navigation
const resolverJs = fs.readFileSync(path.join(root, "js/guide-resolver.js"), "utf8");
if (!resolverJs.includes("await Logger.logArticleView")) {
  bugs.push("guide-resolver.js must await Logger.logArticleView before navigation");
}
if (!resolverJs.includes("isTsKbFallback")) {
  bugs.push("guide-resolver.js must preserve guide session when opening KB fallback from TS guide");
}

if (bugs.length) {
  console.error("BUGS FOUND:\n");
  bugs.forEach((b, i) => console.error((i + 1) + ". " + b));
  process.exit(1);
}

console.log("OK integration checks: no bugs found");
process.exit(0);
