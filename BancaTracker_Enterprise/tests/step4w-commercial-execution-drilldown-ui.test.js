/* Step 4W: Commercial Execution governed drill-down UI integration. */
"use strict";
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const childProcess = require("child_process");

class Element {
  constructor() { this.innerHTML = ""; this.textContent = ""; this.value = ""; this.disabled = false; this.hidden = false; this.listeners = {}; }
  addEventListener(type, handler) { this.listeners[type] = handler; }
}
const elements = {};
global.window = global;
global.document = { getElementById(id) { return elements[id] || (elements[id] = new Element()); } };
const load = (file) => require(path.join(__dirname, "..", file));
load("js/config.js"); load("js/utilities.js"); load("js/analytics/commercialExecutionStatus.js");

const periodContext = { status: "READY", availablePeriods: ["2026-08", "2026-09"], availableFinancialYears: ["FY2026-27"], latestAvailablePeriod: "2026-09", latestActualPeriod: "2026-08", defaultSelectedPeriod: "2026-09" };
const summary = { actualPremium: 30, budget: 100, potential: 200, achievementPct: 30, budgetGap: -70, potentialPenetrationPct: 15, budgetPresentCount: 1, budgetMissingCount: 0, potentialPresentCount: 1, potentialMissingCount: 0, coverageStatus: "COMPLETE" };
global.BancaTrackerCommercialRollups = { buildPeriodContext() { return periodContext; }, getFinancialYear() { return "FY2026-27"; }, buildRollup(performance, scope, dimension) { return { status: "READY", summary, diagnostics: {}, rows: [{ key: dimension === "OVERALL" ? "ALL" : "A", label: "Same label", ...summary }] }; } };
global.BancaTrackerCore = { state: { factData: [{ monthKey: "2026-08", day: 10, premium: 30 }], commercialPerformance: { status: "READY", rows: [{ periodKey: "2026-08" }] } } };
global.BancaTrackerLiveGeographyAuthority = { getCachedContext() { return { cached: true }; } };

let includeSelectedParent = true;
function executionRow(key, label, overrides = {}) { return { key, label, actualToDate: 30, budget: 100, budgetAchievementToDatePct: 30, expectedBudgetToDate: 32, paceGap: -2, averageDailyActual: 3, requiredDailyRunRate: 4, projectedMonthEndActual: 90, projectedAchievementPct: 90, projectedBudgetGap: -10, referenceStatus: "COMPLETE", ...overrides }; }
global.BancaTrackerCommercialExecution = {
  getDaysInPeriod() { return 31; }, resolveAsOfDay() { return { valid: true, asOfDay: 10 }; },
  buildExecution(options) {
    const rows = options.dimension === "OVERALL" ? [executionRow("ALL", "Overall")] : includeSelectedParent ? [executionRow("A", "Same label"), executionRow("B", "Same label")] : [executionRow("B", "Same label")];
    return { status: "READY", selectedPeriod: options.selectedPeriod, dimension: options.dimension, asOfDay: options.asOfDay, observedDays: options.asOfDay, remainingDays: 31 - options.asOfDay, rows, coverage: { budgetPresentCount: rows.length, budgetMissingCount: 0 }, diagnostics: {} };
  },
};
global.BancaTrackerCommercialExecutionPriority = { buildPriority(execution) { return { status: "READY", periodKey: execution.selectedPeriod, asOfDay: execution.asOfDay, dimension: execution.dimension, rankingApplicable: execution.dimension !== "OVERALL", executionPriority: execution.dimension === "OVERALL" ? [] : execution.rows.map((row, index) => ({ key: row.key, label: row.label, priorityRank: index + 7, priorityBasis: { projectedShortfallAmount: 10, paceGapMagnitude: 2, budget: 100 }, sourceStatus: { paceStatus: "BEHIND_LINEAR_PACE", projectionStatus: "PROJECTED_SHORTFALL" } })), referencePriority: [] }; } };

let drilldownCalls = 0;
let lastDrilldownOptions = null;
const allowed = { OVERALL: ["BANK"], BANK: ["ZONE", "BRANCH"], BRANCH: [] };
function governedResult(overrides = {}) {
  return {
    status: "READY", periodKey: "2026-08", asOfDay: 10, parent: { dimension: "BANK", key: "A", label: "Same label" }, childDimension: "ZONE", allowedChildDimensions: ["ZONE", "BRANCH"],
    rows: [
      { key: "__UNMAPPED__", label: "Unmapped", execution: { actualToDate: -5, budget: null, budgetAchievementToDatePct: null, expectedBudgetToDate: null, paceGap: null, requiredDailyRunRate: null, projectedMonthEndActual: -10, projectedBudgetGap: null }, attention: { executionAttention: false, referenceAttention: true }, priority: { execution: null, reference: { priorityRank: 4 } } },
      { key: "__UNASSIGNED__", label: "Unassigned", execution: { actualToDate: 35, budget: 100, budgetAchievementToDatePct: 35, expectedBudgetToDate: 32, paceGap: 3, requiredDailyRunRate: 4, projectedMonthEndActual: 105, projectedBudgetGap: 5 }, attention: { executionAttention: true, referenceAttention: false }, priority: { execution: { priorityRank: 9 }, reference: null } },
    ],
    reconciliation: { actual: { parent: 30, children: 30, difference: 0, complete: true }, budget: { parent: 100, children: null, difference: null, complete: false } }, diagnostics: [], ...overrides,
  };
}
global.BancaTrackerCommercialExecutionDrilldown = {
  getAllowedDrilldowns(dimension) { return [...(allowed[dimension] || [])]; },
  buildDrilldown(options) { drilldownCalls += 1; lastDrilldownOptions = options; return governedResult({ periodKey: options.periodKey, asOfDay: options.asOfDay, parent: { dimension: options.parentSelection.parentDimension, key: options.parentSelection.parentKey, label: options.parentSelection.parentLabel }, childDimension: options.childDimension }); },
};

load("js/commercialPerformanceUI.js");
const UI = BancaTrackerCommercialPerformanceUI;
UI.renderExecution(periodContext, BancaTrackerCore.state.commercialPerformance, { cached: true });
assert.match(elements.executionTable.innerHTML, /type="button"/);
assert.match(elements.executionTable.innerHTML, /data-parent-key="A"/);
assert.match(elements.executionTable.innerHTML, /data-parent-key="B"/);
assert.strictEqual(UI.state.execution.drilldown.parentKey, null);

let result = UI.handleExecutionParentSelect("A", "Same label");
assert.strictEqual(drilldownCalls, 1);
assert.strictEqual(UI.state.execution.drilldown.parentDimension, "BANK");
assert.strictEqual(UI.state.execution.drilldown.parentKey, "A");
assert.strictEqual(UI.state.execution.drilldown.childDimension, "ZONE");
assert.strictEqual(lastDrilldownOptions.parentSelection.parentKey, "A");
assert.strictEqual(lastDrilldownOptions.parentExecutionResult.dimension, "BANK");
assert.strictEqual(lastDrilldownOptions.periodKey, "2026-08");
assert.strictEqual(lastDrilldownOptions.asOfDay, 10);
assert.match(elements.executionDrilldownChild.innerHTML, />Zone</);
assert.match(elements.executionDrilldownChild.innerHTML, />Branch</);
assert.match(elements.executionDrilldownParent.textContent, /Selected Parent: Same label.*Bank.*Aug-26.*Day 10/);
for (const supplied of ["Unmapped", "Unassigned", "-₹5", "₹100", "35.0%", "Yes", ">4<", ">9<"]) assert.ok(elements.executionDrilldownTable.innerHTML.includes(supplied), supplied);
assert.match(elements.executionDrilldownReconciliation.innerHTML, /Parent: ₹30/);
assert.match(elements.executionDrilldownReconciliation.innerHTML, /Children: ₹30/);
assert.match(elements.executionDrilldownReconciliation.innerHTML, /Difference: ₹0/);
assert.match(elements.executionDrilldownReconciliation.innerHTML, /Children: N\/A/);
assert.match(elements.executionDrilldownReconciliation.innerHTML, /Complete: No/);
assert.strictEqual(result.rows[0].attention.referenceAttention, true);

UI.handleExecutionDrilldownChildChange("BRANCH");
assert.strictEqual(drilldownCalls, 2);
assert.strictEqual(lastDrilldownOptions.childDimension, "BRANCH");
UI.handleExecutionParentSelect("B", "Same label");
assert.strictEqual(lastDrilldownOptions.parentSelection.parentKey, "B");
assert.strictEqual(UI.state.execution.drilldown.parentKey, "B");

UI.handleExecutionDimensionChange("BRANCH");
assert.strictEqual(UI.state.execution.drilldown.parentKey, null);
UI.handleExecutionParentSelect("A", "Branch A");
assert.strictEqual(elements.executionDrilldownControls.hidden, true);
assert.match(elements.executionDrilldownStatus.textContent, /terminal commercial execution level/);
const callsAtTerminal = drilldownCalls;

UI.handleExecutionDimensionChange("OVERALL");
UI.handleExecutionParentSelect("ALL", "Overall");
assert.match(elements.executionDrilldownChild.innerHTML, />Bank</);
assert.doesNotMatch(elements.executionDrilldownChild.innerHTML, />State</);
assert.strictEqual(drilldownCalls, callsAtTerminal + 1);

UI.handleExecutionDimensionChange("BANK");
UI.handleExecutionParentSelect("A", "Same label");
const beforeAsOf = drilldownCalls;
UI.handleExecutionAsOfChange("5");
assert.strictEqual(UI.state.execution.drilldown.parentKey, "A");
assert.strictEqual(drilldownCalls, beforeAsOf + 1);
assert.strictEqual(lastDrilldownOptions.asOfDay, 5);
UI.handleExecutionPeriodChange("2026-09");
assert.strictEqual(UI.state.execution.drilldown.parentKey, null);
assert.match(elements.executionDrilldownParent.textContent, /Select an execution entity/);

UI.handleExecutionParentSelect("A", "Same label");
const beforeRefresh = drilldownCalls;
UI.renderExecution(periodContext, BancaTrackerCore.state.commercialPerformance, { cached: true });
assert.strictEqual(drilldownCalls, beforeRefresh + 1);
includeSelectedParent = false;
UI.renderExecution(periodContext, BancaTrackerCore.state.commercialPerformance, { cached: true });
assert.strictEqual(UI.state.execution.drilldown.parentKey, null);
assert.match(elements.executionDrilldownParent.textContent, /no longer available/);
includeSelectedParent = true;

UI.state.execution.drilldown = { parentDimension: "BANK", parentKey: "A", parentLabel: "Same label", childDimension: "ZONE" };
UI.renderExecutionDrilldown(governedResult({ status: "EMPTY", rows: [] }));
assert.match(elements.executionDrilldownStatus.textContent, /No governed child entities/);
UI.renderExecutionDrilldown(governedResult({ status: "PARENT_NOT_FOUND", rows: [] }));
assert.match(elements.executionDrilldownStatus.textContent, /no longer available/);
UI.renderExecutionDrilldown(governedResult({ status: "INVALID_DRILLDOWN", rows: [] }));
assert.match(elements.executionDrilldownStatus.textContent, /not governed/);
UI.renderExecutionDrilldown(governedResult({ status: "INVALID_INPUT", rows: [] }));
assert.match(elements.executionDrilldownStatus.textContent, /not compatible/);

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "style.css"), "utf8");
const source = fs.readFileSync(path.join(root, "js/commercialPerformanceUI.js"), "utf8");
assert.match(html, /for="executionDrilldownChild">Child Breakdown/);
assert.match(html, /executionDrilldownStatus[^>]*aria-live="polite"/);
assert.ok(html.indexOf("commercialExecution.js") < html.indexOf("commercialExecutionStatus.js") && html.indexOf("commercialExecutionStatus.js") < html.indexOf("commercialExecutionPriority.js") && html.indexOf("commercialExecutionPriority.js") < html.indexOf("commercialExecutionDrilldown.js") && html.indexOf("commercialExecutionDrilldown.js") < html.indexOf("commercialPerformanceUI.js"));
for (const selector of ["commercial-drilldown-panel", "commercial-drilldown-header", "commercial-drilldown-controls", "commercial-drilldown-parent", "commercial-drilldown-reconciliation", "commercial-drilldown-table", "commercial-drilldown-empty", "commercial-drilldown-select"]) assert.ok(css.includes(`.${selector}`), selector);
assert.match(css, /commercial-drilldown-table[^}]*overflow-x: auto/);
assert.match(css, /commercial-drilldown-controls[^}]*flex-direction: column/);
assert.match(source, /BancaTrackerCommercialExecutionDrilldown\.getAllowedDrilldowns\(parentDimension\)/);
assert.match(source, /BancaTrackerCommercialExecutionDrilldown\.buildDrilldown\(\{/);
assert.match(source, /data-parent-key/);
assert.doesNotMatch(source, /performanceResult\.rows\.filter|facts\.filter|getDimensionValue|scopeRows|aggregatePerformance|reduce\(\(sum/);
assert.doesNotMatch(source, /executionAttention\s*=|referenceAttention\s*=|priorityRank\s*=|priorityRank\+\+|\.sort\([^)]*priority/);
assert.doesNotMatch(source, /reconciliation\.(actual|budget)\.[a-zA-Z]+\s*=|childActual|childBudget/);
assert.doesNotMatch(source, /Repository|IndexedDB|"PRODUCT"|"LOB"|LINE_OF_BUSINESS/i);
assert.doesNotMatch(elements.executionDrilldownChild.innerHTML, /Product|LOB|Daily|Comparison/i);
for (const untouched of ["js/analytics/commercialExecutionDrilldown.js", "js/analytics/commercialExecutionPriority.js", "js/analytics/commercialExecutionStatus.js", "js/analytics/commercialExecution.js", "js/activation.js", "js/scorecard.js", "js/productivity.js", "js/performance.js", "js/target.js", "js/core.js", "app.js"]) assert.strictEqual(childProcess.execFileSync("git", ["diff", "--name-only", "--", untouched], { cwd: root, encoding: "utf8" }).trim(), "", untouched);
assert.match(fs.readFileSync(path.join(root, "README.md"), "utf8"), /Commercial execution drill-down UI presents supplied Step 4V context only/);
console.log("Step 4W Commercial Execution drill-down UI tests passed: durable selection, governed paths, authority-only context, lifecycle safety, accessibility, responsiveness, and preservation.");
