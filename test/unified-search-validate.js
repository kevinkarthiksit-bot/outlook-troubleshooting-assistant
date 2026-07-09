#!/usr/bin/env node
/**
 * Validates unified search, platform filtering, and guide resolver.
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");

function loadModule(file, extras = {}) {
  const code = fs.readFileSync(path.join(root, file), "utf8");
  const sandbox = {
    module: { exports: {} },
    exports: {},
    console,
    ...extras
  };
  vm.runInNewContext(code, sandbox, { filename: file });
  return sandbox.module.exports;
}

const { PlatformMatch } = loadModule("js/platform-match.js", {
  StepUtils: {
    appliesToPlatform(step, platform) {
      if (!step || typeof step === "string") return true;
      if (!step.platforms?.length) return true;
      return step.platforms.some((p) => p.toLowerCase() === platform.toLowerCase());
    }
  },
  Session: { getCaseDetails: () => ({ platform: "Windows" }) }
});

const articleWindows = {
  id: "A1",
  title: "Test",
  steps: [{ text: "Win only", platforms: ["Windows"] }]
};
const articleMac = {
  id: "A2",
  title: "Mac",
  steps: [{ text: "Mac only", platforms: ["Mac"] }]
};

if (!PlatformMatch.articleAppliesToPlatform(articleWindows, "Windows")) {
  console.error("FAIL: Windows article should apply on Windows");
  process.exit(1);
}
if (PlatformMatch.articleAppliesToPlatform(articleMac, "Windows")) {
  console.error("FAIL: Mac-only article should not apply on Windows");
  process.exit(1);
}

const { GuideResolver } = loadModule("js/guide-resolver.js", {
  StepUtils: {
    filterSteps(steps) {
      return steps;
    },
    appliesToPlatform() {
      return true;
    }
  },
  PlatformMatch,
  Session: {
    getCaseDetails: () => ({ platform: "Windows" }),
    startGuide() {},
    updateGuideSession() {}
  },
  Logger: { logArticleView() {} },
  TroubleshootingSearch: {
    data: {
      guides: [
        {
          id: "G1",
          title: "Password prompts in Outlook",
          keywords: ["password", "credential"],
          symptoms: ["Password keeps asking"],
          steps: ["Step 1"]
        }
      ]
    },
    getGuideById(id) {
      return this.data.guides.find((g) => g.id === id) || null;
    }
  },
  SearchEngine: {
    kbData: {
      articles: [
        {
          id: "K1",
          title: "[Outlook] Troubleshoot credential or password issues",
          keywords: ["password", "credential"],
          symptoms: ["Password keeps asking"],
          steps: ["KB step"]
        }
      ]
    },
    getArticleById(id) {
      return this.kbData.articles.find((a) => a.id === id) || null;
    }
  }
});

const related = GuideResolver.findRelatedTsGuide({
  id: "K1",
  title: "[Outlook] Troubleshoot credential or password issues",
  keywords: ["password", "credential"],
  symptoms: ["Password keeps asking"],
  steps: ["KB step"]
});
if (!related || related.id !== "G1") {
  console.error("FAIL: expected TS guide match for password KB article");
  process.exit(1);
}

const tsGuide = { id: "G1", relatedKbId: "K1", title: "Password prompts", steps: ["s"] };
const relatedKb = GuideResolver.findRelatedKb(tsGuide);
if (!relatedKb || relatedKb.id !== "K1") {
  console.error("FAIL: expected explicit relatedKbId lookup");
  process.exit(1);
}

const unifiedCode = fs.readFileSync(path.join(root, "js/unified-search.js"), "utf8");
if (!unifiedCode.includes("mergeTiered") || !unifiedCode.includes("type: \"troubleshooting\"")) {
  console.error("FAIL: unified search should tier troubleshooting before org KB");
  process.exit(1);
}

const caseCode = fs.readFileSync(path.join(root, "js/case.js"), "utf8");
if (!caseCode.includes("troubleshooting.html")) {
  console.error("FAIL: case setup should land on troubleshooting hub");
  process.exit(1);
}

const loginCode = fs.readFileSync(path.join(root, "js/login.js"), "utf8");
if (loginCode.includes('window.location.href = "index.html"')) {
  console.error("FAIL: login should not redirect completed cases to org KB");
  process.exit(1);
}

console.log("OK unified search + resolver validation");
process.exit(0);
