/* Step 4M: Commercial Comparison and Daily Movement UI integration. */
"use strict";
const assert = require("assert");
const fs = require("fs");
const path = require("path");

class Element { constructor() { this.innerHTML = ""; this.textContent = ""; this.value = ""; this.disabled = false; this.hidden = false; this.listeners = {}; } addEventListener(type, handler) { this.listeners[type] = handler; } }
const elements = {};
global.window = global;
global.document = { getElementById(id) { return elements[id] || (elements[id] = new Element()); } };
[
  "commercialScope", "commercialPeriod", "commercialFinancialYear", "commercialDimension", "commercialReadiness", "commercialKpis", "commercialTable",
  "comparisonBasePeriod", "comparisonPeriod", "comparisonDimension", "comparisonReadiness", "comparisonKpis", "comparisonTable",
  "dailyEntityControl", "dailyEntity", "dailyViewMode", "dailyStatus", "dailySnapshotCue", "dailyMovementTable",
].forEach((id) => document.getElementById(id));
const load = (file) => require(path.join(__dirname, "..", file));
load("js/config.js"); load("js/utilities.js");

const periodContext = { status: "READY", availablePeriods: ["2026-07", "2026-08", "2026-09"], availableFinancialYears: ["FY2026-27"], latestAvailablePeriod: "2026-09", latestActualPeriod: "2026-08", defaultSelectedPeriod: "2026-09" };
const rollupSummary = { actualPremium: 0, budget: 100, potential: 200, achievementPct: 0, budgetGap: -100, potentialPenetrationPct: 0, budgetPresentCount: 1, budgetMissingCount: 0, potentialPresentCount: 1, potentialMissingCount: 0, coverageStatus: "COMPLETE" };
global.BancaTrackerCommercialRollups = { buildPeriodContext() { return periodContext; }, getFinancialYear() { return "FY2026-27"; }, buildRollup(performance, scope, dimension) { return { status: "READY", summary: rollupSummary, diagnostics: periodContext, rows: [{ key: dimension === "OVERALL" ? "ALL" : "BANK-A", label: dimension === "OVERALL" ? "Overall" : "Bank A", ...rollupSummary }] }; } };

const comparisonCalls = [];
function comparisonRow(key, label, presenceStatus, overrides = {}) { return { key, label, labelChanged: false, presenceStatus, base: { actualPremium: 100, budget: 80 }, comparison: { actualPremium: 120, budget: 100 }, changes: { actualChange: 20, actualChangePct: 20, achievementPointChange: 15, penetrationPointChange: 12 }, ...overrides }; }
global.BancaTrackerCommercialComparison = {
  resolveDefaultPeriods() { return { basePeriod: "2026-07", comparisonPeriod: "2026-08" }; },
  buildComparison(options) {
    comparisonCalls.push(options);
    const rows = options.dimension === "OVERALL" ? [comparisonRow("ALL", "Overall", "BOTH")] : [
      comparisonRow("A", "Bank Alpha", "BOTH", { labelChanged: true }),
      comparisonRow("BASE", "Base only", "BASE_ONLY", { comparison: { actualPremium: 0, budget: null }, changes: { actualChange: -50, actualChangePct: -100, achievementPointChange: null, penetrationPointChange: null } }),
      comparisonRow("NEW", "Comparison only", "COMPARISON_ONLY"),
      comparisonRow("__UNMAPPED__", "Unmapped", "BOTH"),
      comparisonRow("__UNASSIGNED__", "Unassigned", "BOTH"),
    ];
    return { status: options.basePeriod === options.comparisonPeriod ? "SAME_PERIOD" : "PARTIAL", samePeriod: options.basePeriod === options.comparisonPeriod, basePeriod: options.basePeriod, comparisonPeriod: options.comparisonPeriod, rows, coverage: { base: { budgetPresentCount: 2, budgetMissingCount: 0, potentialPresentCount: 1, potentialMissingCount: 1 }, comparison: { budgetPresentCount: 1, budgetMissingCount: 1, potentialPresentCount: 2, potentialMissingCount: 0 } } };
  },
};
const dailyCalls = [];
function dailyEntity(key, label, presenceStatus, baseValue) { return { key, label, presenceStatus, days: Array.from({ length: 31 }, (_, index) => { const day = index + 1; const unavailable = day === 31; return { day, base: { available: !unavailable, dailyActual: unavailable ? null : baseValue, cumulativeActual: unavailable ? null : baseValue * day }, comparison: { available: true, dailyActual: day === 2 ? -20 : 0, cumulativeActual: day === 2 ? -20 : 0 }, daily: { change: unavailable ? null : -baseValue, changePct: baseValue > 0 ? -100 : null, direction: unavailable ? "NOT_COMPARABLE" : baseValue ? "DOWN" : "FLAT" }, cumulative: { change: unavailable ? null : -baseValue * day, changePct: baseValue > 0 ? -100 : null, direction: unavailable ? "NOT_COMPARABLE" : baseValue ? "DOWN" : "FLAT" } }; }) }; }
global.BancaTrackerDailyCommercialComparison = { buildComparison(options) { dailyCalls.push(options); return { status: "READY", entities: [dailyEntity("BASE", "Base only", "BASE_ONLY", 0), dailyEntity("A", "Bank A", "BOTH", 100), dailyEntity("__UNASSIGNED__", "Unassigned", "COMPARISON_ONLY", 0)] }; } };
global.BancaTrackerCore = { state: { factData: [{ premium: 1 }], commercialPerformance: { status: "READY", rows: [{}] } } };
global.BancaTrackerLiveGeographyAuthority = { getCachedContext() { return { cached: true }; } };
load("js/commercialPerformanceUI.js");
const UI = BancaTrackerCommercialPerformanceUI;
const result = UI.render();

assert.strictEqual(UI.state.scopeType, "MONTH");
assert.strictEqual(UI.state.selectedPeriod, "2026-09");
assert.strictEqual(UI.state.comparison.basePeriod, "2026-07");
assert.strictEqual(UI.state.comparison.comparisonPeriod, "2026-08");
assert.strictEqual(UI.state.comparison.dimension, "BANK");
assert.strictEqual(UI.state.comparison.dailyViewMode, "CUMULATIVE");
assert.match(elements.comparisonBasePeriod.innerHTML, /2026-09/);
assert.strictEqual(comparisonCalls.at(-2).dimension, "OVERALL");
assert.strictEqual(comparisonCalls.at(-1).dimension, "BANK");
assert.strictEqual(dailyCalls.at(-1).dimension, "BANK");
assert.strictEqual(dailyCalls.at(-1).basePeriod, "2026-07");
assert.strictEqual(dailyCalls.at(-1).comparisonPeriod, "2026-08");
assert.deepStrictEqual(dailyCalls.at(-1).facts, BancaTrackerCore.state.factData);
assert.match(elements.comparisonKpis.innerHTML, /Base Actual/);
assert.match(elements.comparisonKpis.innerHTML, /Actual Change/);
assert.match(elements.comparisonKpis.innerHTML, /Growth \+20\.0%/);
assert.match(elements.comparisonKpis.innerHTML, /15\.0 pp/);
assert.match(elements.comparisonKpis.innerHTML, /12\.0 pp/);
for (const text of ["BOTH", "BASE ONLY", "COMPARISON ONLY", "Unmapped", "Unassigned", "Name changed"]) assert.ok(elements.comparisonTable.innerHTML.includes(text), text);
assert.match(elements.comparisonTable.innerHTML, /N\/A/);
assert.match(elements.comparisonReadiness.innerHTML, /PARTIAL/);
assert.match(elements.comparisonReadiness.innerHTML, /Base Budget Coverage: Complete/);
assert.match(elements.comparisonReadiness.innerHTML, /Comparison Budget Coverage: Partial/);
assert.strictEqual(UI.state.comparison.selectedEntityKey, "A");
assert.match(elements.dailyMovementTable.innerHTML, /Base Cumulative Actual/);
assert.match(elements.dailyMovementTable.innerHTML, /Not comparable/);
assert.match(elements.dailyStatus.textContent, /READY/);
assert.match(elements.dailyMovementTable.innerHTML, /N\/A/);
assert.strictEqual((elements.dailyMovementTable.innerHTML.match(/<tr>/g) || []).length, 32);

const callsBeforeLocalRender = comparisonCalls.length + dailyCalls.length;
UI.handleDailyViewChange("DAILY");
assert.match(elements.dailyMovementTable.innerHTML, /Base Daily Actual/);
assert.strictEqual(comparisonCalls.length + dailyCalls.length, callsBeforeLocalRender);
UI.handleDailyEntityChange("__UNASSIGNED__");
assert.strictEqual(UI.state.comparison.selectedEntityKey, "__UNASSIGNED__");
assert.strictEqual(comparisonCalls.length + dailyCalls.length, callsBeforeLocalRender);
UI.handleComparisonPeriodChange("basePeriod", "2026-08");
UI.handleComparisonPeriodChange("comparisonPeriod", "2026-07");
assert.strictEqual(comparisonCalls.at(-1).basePeriod, "2026-08");
assert.strictEqual(comparisonCalls.at(-1).comparisonPeriod, "2026-07");
UI.handleComparisonPeriodChange("comparisonPeriod", "2026-08");
assert.match(elements.comparisonReadiness.innerHTML, /Same month selected/);
UI.handleComparisonDimensionChange("ASSIGNED_RM");
assert.strictEqual(dailyCalls.at(-1).dimension, "ASSIGNED_RM");
assert.match(elements.dailySnapshotCue.textContent, /current active assignment/);
UI.handleComparisonDimensionChange("OVERALL");
assert.strictEqual(elements.dailyEntityControl.hidden, true);

UI.renderComparisonKpis({ rows: [comparisonRow("ALL", "Overall", "BOTH", { changes: { actualChange: -50, actualChangePct: -20, achievementPointChange: 130, penetrationPointChange: null } })] });
assert.match(elements.comparisonKpis.innerHTML, /Degrowth -20\.0%/);
assert.match(elements.comparisonKpis.innerHTML, /130\.0 pp/);
assert.match(elements.comparisonKpis.innerHTML, /N\/A/);

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const css = fs.readFileSync(path.join(__dirname, "..", "style.css"), "utf8");
const source = fs.readFileSync(path.join(__dirname, "..", "js/commercialPerformanceUI.js"), "utf8");
for (const id of ["comparisonBasePeriod", "comparisonPeriod", "comparisonDimension", "dailyEntity", "dailyViewMode"]) assert.match(html, new RegExp(`for="${id}"`));
assert.match(html, /Day-wise Premium Movement/);
assert.doesNotMatch(html, /Daily Budget|Run-rate|Forecast|Pacing/i);
assert.match(css, /commercial-comparison-section/);
assert.match(css, /commercial-table-wrap[^}]*overflow-x: auto/);
for (const forbidden of [/actualChange\s*=|actualChangePct\s*=|achievementPointChange\s*=|penetrationPointChange\s*=|dailyActual\s*-|cumulativeActual\s*-/]) assert.doesNotMatch(source, forbidden);
assert.doesNotMatch(source, /Repository|IndexedDB|runRate|forecast|pacing/i);
for (const untouched of ["js/analytics/commercialComparison.js", "js/analytics/dailyCommercialComparison.js", "js/activation.js", "js/scorecard.js", "js/productivity.js", "js/performance.js", "js/target.js", "js/core.js", "app.js"]) {
  assert.strictEqual(require("child_process").execFileSync("git", ["diff", "--name-only", "--", untouched], { cwd: path.join(__dirname, ".."), encoding: "utf8" }).trim(), "", untouched);
}
assert.ok(result.comparison.overall !== result.comparison.table);
console.log("Step 4M commercial comparison UI tests passed: additive structure, defaults, authority-only summaries/table/daily views, presence and coverage, zero/null/negative semantics, on-demand controls, accessibility, responsiveness, and preservation.");
