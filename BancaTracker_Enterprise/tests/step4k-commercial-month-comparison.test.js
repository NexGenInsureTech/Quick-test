/* Step 4K: governed commercial MONTH comparison authority. */
"use strict";
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
global.window = global;
const modulePath = path.join(__dirname, "..", "js/analytics/commercialComparison.js");

const dimensions = ["OVERALL", "BANK", "BRANCH", "STATE", "ZONE", "BANK_REGION", "BANK_ZONE", "FGM_OFFICE", "ASSIGNED_RM", "CSM", "ASM", "ZSM", "NATIONAL_HEAD"];
const periodContext = { availablePeriods: ["2026-04", "2026-07", "2026-08", "2026-09"], latestAvailablePeriod: "2026-09", latestActualPeriod: "2026-08" };
let fixtures = {};
const calls = [];
global.BancaTrackerCommercialRollups = {
  DIMENSIONS: dimensions,
  buildPeriodContext() { return periodContext; },
  buildRollup(performance, scope, dimension) {
    calls.push({ performance, scope, dimension });
    const item = fixtures[scope.periodKey] || { rows: [], status: "READY", summary: {} };
    return { status: item.status || "READY", rows: item.rows || [], summary: item.summary || {} };
  },
};
vm.runInThisContext(fs.readFileSync(modulePath, "utf8"), { filename: "commercialComparison.js" });
const Comparison = BancaTrackerCommercialComparison;

function row(key, label, overrides = {}) {
  return { key, label, actualPremium: 100, budget: 100, potential: 200, achievementPct: 80, budgetGap: -20, budgetRemaining: 20, potentialPenetrationPct: 40, potentialGap: 120, branchPeriods: 1, budgetPresentCount: 1, budgetMissingCount: 0, potentialPresentCount: 1, potentialMissingCount: 0, coverageStatus: "COMPLETE", ...overrides };
}
function actual(base, comparison) { return Comparison.compareActual(base, comparison); }
assert.deepStrictEqual(actual(100, 120), { actualChange: 20, actualChangePct: 20, actualDirection: "UP" });
assert.deepStrictEqual(actual(100, 80), { actualChange: -20, actualChangePct: -20, actualDirection: "DOWN" });
assert.deepStrictEqual(actual(100, 100), { actualChange: 0, actualChangePct: 0, actualDirection: "FLAT" });
assert.deepStrictEqual(actual(0, 100), { actualChange: 100, actualChangePct: null, actualDirection: "UP" });
assert.deepStrictEqual(actual(0, 0), { actualChange: 0, actualChangePct: null, actualDirection: "FLAT" });
assert.deepStrictEqual(actual(-100, -50), { actualChange: 50, actualChangePct: null, actualDirection: "UP" });
assert.deepStrictEqual(actual(100, -50), { actualChange: -150, actualChangePct: -150, actualDirection: "DOWN" });
assert.deepStrictEqual(actual(-100, -150), { actualChange: -50, actualChangePct: null, actualDirection: "DOWN" });
assert.strictEqual(Comparison.compareMeasure(100, 130), 30);
assert.strictEqual(Comparison.compareMeasure(100, null), null);
assert.strictEqual(Comparison.compareMeasure(0, 100), 100);

const joined = Comparison.joinComparisonRows(
  [row("A", "Branch A"), row("BASE", "Base only", { actualPremium: 100 })],
  [row("A", "Branch Alpha", { actualPremium: 120, budget: 130, potential: 250, achievementPct: 95, budgetGap: 10, potentialPenetrationPct: 55, potentialGap: 80 }), row("NEW", "New", { actualPremium: 0 })],
  "BRANCH", "2026-07", "2026-08",
);
assert.strictEqual(joined.length, 3);
const both = joined.find((item) => item.key === "A");
assert.strictEqual(both.presenceStatus, "BOTH");
assert.strictEqual(both.label, "Branch Alpha");
assert.strictEqual(both.labelChanged, true);
assert.deepStrictEqual(both.changes, { actualChange: 20, actualChangePct: 20, actualDirection: "UP", budgetChange: 30, potentialChange: 50, achievementPointChange: 15, penetrationPointChange: 15, budgetGapChange: 30, potentialGapChange: -40 });
const baseOnly = joined.find((item) => item.key === "BASE");
assert.strictEqual(baseOnly.presenceStatus, "BASE_ONLY");
assert.strictEqual(baseOnly.basePresent, true);
assert.strictEqual(baseOnly.comparisonPresent, false);
assert.strictEqual(baseOnly.comparison.actualPremium, 0);
assert.strictEqual(baseOnly.comparison.budget, null);
assert.strictEqual(baseOnly.comparison.potential, null);
assert.strictEqual(baseOnly.changes.actualChange, -100);
const comparisonOnly = joined.find((item) => item.key === "NEW");
assert.strictEqual(comparisonOnly.presenceStatus, "COMPARISON_ONLY");
assert.strictEqual(comparisonOnly.base.actualPremium, 0);
assert.strictEqual(comparisonOnly.comparisonPresent, true);

assert.deepStrictEqual(Comparison.resolveDefaultPeriods(periodContext), { basePeriod: "2026-07", comparisonPeriod: "2026-08" });
assert.deepStrictEqual(Comparison.resolveDefaultPeriods({ availablePeriods: ["2026-08"], latestActualPeriod: "2026-08", latestAvailablePeriod: "2026-08" }), { basePeriod: null, comparisonPeriod: "2026-08" });
assert.deepStrictEqual(Comparison.resolveDefaultPeriods({ availablePeriods: ["2026-09"], latestActualPeriod: null, latestAvailablePeriod: "2026-09" }), { basePeriod: null, comparisonPeriod: "2026-09" });
assert.strictEqual(Comparison.validateComparisonPeriods({ availablePeriods: [] }, "2026-07", "2026-08").status, "NO_PERIODS");
assert.strictEqual(Comparison.validateComparisonPeriods(periodContext, "bad", "2026-08").reason, "INVALID_BASE_PERIOD");
assert.strictEqual(Comparison.validateComparisonPeriods(periodContext, "2026-07", "bad").reason, "INVALID_COMPARISON_PERIOD");
assert.strictEqual(Comparison.validateComparisonPeriods(periodContext, "2026-06", "2026-08").reason, "BASE_PERIOD_UNAVAILABLE");
assert.strictEqual(Comparison.validateComparisonPeriods(periodContext, "2026-07", "2026-06").reason, "COMPARISON_PERIOD_UNAVAILABLE");

fixtures = {
  "2026-07": { rows: [row("A", "A", { actualPremium: 100 })], summary: { coverageStatus: "COMPLETE" } },
  "2026-08": { rows: [row("A", "A", { actualPremium: 120, achievementPct: 150 })], summary: { coverageStatus: "COMPLETE" } },
  "2026-09": { rows: [row("A", "A", { actualPremium: 0, budget: 200, potential: 300 })], summary: { coverageStatus: "COMPLETE" } },
  "2026-04": { rows: [row("A", "A", { actualPremium: -100 })], summary: { coverageStatus: "COMPLETE" } },
};
const source = { status: "READY", rows: [{ marker: true }] };
const snapshot = JSON.stringify(source);
let built = Comparison.buildComparison({ performanceResult: source, periodContext, basePeriod: "2026-07", comparisonPeriod: "2026-08", dimension: "BANK" });
assert.strictEqual(built.status, "READY");
assert.strictEqual(built.rows[0].changes.actualChange, 20);
assert.strictEqual(built.rows[0].comparison.achievementPct, 150);
assert.strictEqual(built.rows[0].changes.achievementPointChange, 70);
assert.deepStrictEqual(calls.slice(-2).map((call) => call.scope), [{ type: "MONTH", periodKey: "2026-07" }, { type: "MONTH", periodKey: "2026-08" }]);
assert.strictEqual(JSON.stringify(source), snapshot);

const samePeriod = Comparison.buildComparison({ performanceResult: source, periodContext, basePeriod: "2026-08", comparisonPeriod: "2026-08", dimension: "OVERALL" });
assert.strictEqual(samePeriod.status, "SAME_PERIOD");
assert.strictEqual(samePeriod.rows[0].changes.actualChange, 0);
assert.strictEqual(samePeriod.rows[0].changes.actualChangePct, 0);
assert.strictEqual(samePeriod.rows[0].changes.achievementPointChange, 0);
assert.strictEqual(Comparison.buildComparison({ performanceResult: source, periodContext, basePeriod: "2026-04", comparisonPeriod: "2026-08", dimension: "BANK" }).rows[0].changes.actualChange, 220);
assert.strictEqual(Comparison.buildComparison({ performanceResult: source, periodContext, basePeriod: "2026-08", comparisonPeriod: "2026-07", dimension: "BANK" }).rows[0].changes.actualChange, -20);
assert.strictEqual(Comparison.buildComparison({ performanceResult: source, periodContext, basePeriod: "2026-08", comparisonPeriod: "2026-09", dimension: "BANK" }).rows[0].changes.actualChange, -120);

fixtures["2026-08"].rows[0].coverageStatus = "PARTIAL";
assert.strictEqual(Comparison.buildComparison({ performanceResult: source, periodContext, basePeriod: "2026-07", comparisonPeriod: "2026-08", dimension: "BANK" }).status, "PARTIAL");
fixtures["2026-08"].rows[0].coverageStatus = "COMPLETE";
for (const dimension of dimensions) {
  const result = Comparison.buildComparison({ performanceResult: source, periodContext, basePeriod: "2026-07", comparisonPeriod: "2026-08", dimension });
  assert.strictEqual(result.dimension, dimension);
  assert.strictEqual(result.rows[0].key, "A");
}

const bucketRows = Comparison.joinComparisonRows([row("__UNMAPPED__", "Unmapped"), row("__UNASSIGNED__", "Unassigned")], [row("__UNMAPPED__", "Unmapped"), row("__UNASSIGNED__", "Unassigned")], "ZONE", "2026-07", "2026-08");
assert.deepStrictEqual(bucketRows.map((item) => item.key), ["__UNASSIGNED__", "__UNMAPPED__"]);

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
assert.match(html, /js\/analytics\/commercialComparison\.js/);
for (const untouched of ["js/commercialPerformanceUI.js", "style.css", "app.js", "js/target.js", "js/activation.js", "js/scorecard.js", "js/productivity.js", "js/performance.js", "js/core.js"]) {
  const changed = require("child_process").execFileSync("git", ["diff", "--name-only", "--", untouched], { cwd: path.join(__dirname, ".."), encoding: "utf8" }).trim();
  assert.strictEqual(changed, "", untouched);
}
assert.doesNotMatch(fs.readFileSync(path.join(__dirname, "..", "js/core.js"), "utf8"), /CommercialComparison/);

console.log("Step 4K commercial month comparison tests passed: validation/defaults, signed Actual movement, safe growth, point changes, durable union joins, presence/null semantics, all dimensions, coverage, immutability, on-demand execution, and UI/legacy preservation.");
