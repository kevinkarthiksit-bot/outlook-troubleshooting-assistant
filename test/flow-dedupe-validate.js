#!/usr/bin/env node
/**
 * Ensures guided flows and search never surface duplicate guide cards.
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");
const tsData = JSON.parse(
  fs.readFileSync(path.join(root, "data/troubleshooting-guide.json"), "utf8")
);

function load(file, extras = {}) {
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

const StepUtils = {
  appliesToPlatform() {
    return true;
  },
  filterSteps(steps) {
    return steps || [];
  }
};

const { PlatformMatch } = load("js/platform-match.js", {
  StepUtils,
  Session: { getCaseDetails: () => ({ platform: "Windows" }) }
});

const TroubleshootingSearch = {
  data: tsData,
  getGuideById(id) {
    return tsData.guides.find((g) => g.id === id) || null;
  }
};

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
  SearchEngine: { kbData: { articles: [] }, getArticleById: () => null }
});

const dupTargets = GuideResolver.resolveFlowTargets([
  "GEVKB0020006",
  "GEVKB0020006"
]);
if (dupTargets.length !== 1 || dupTargets[0].item.id !== "GEVKB0020006") {
  console.error("FAIL: resolveFlowTargets should dedupe repeated guide IDs");
  process.exit(1);
}

for (const flow of tsData.flows || []) {
  for (const step of flow.steps || []) {
    for (const opt of step.options || []) {
      const ids = opt.guideIds || opt.kbIds || [];
      const targets = GuideResolver.resolveFlowTargets(ids);
      const unique = new Set(targets.map((t) => t.item.id));
      if (unique.size !== targets.length) {
        console.error(
          "FAIL: duplicate flow targets for flow '" +
            flow.id +
            "' option '" +
            opt.label +
            "'"
        );
        process.exit(1);
      }
    }
  }
}

const resolverCode = fs.readFileSync(path.join(root, "js/guide-resolver.js"), "utf8");
if (!resolverCode.includes("seen.has(id)")) {
  console.error("FAIL: guide-resolver.js should dedupe flow target IDs");
  process.exit(1);
}

console.log("OK flow dedupe validation: no duplicate guided-flow results");
process.exit(0);
