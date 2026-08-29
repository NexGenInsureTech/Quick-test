/* Step 4O: Commercial Execution UI integration. */
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
  "comparisonBasePeriod", "comparisonPeriod", "comparisonDimension", "comparisonReadiness", "comparisonKpis", "comparisonTable", "dailyEntityControl", "dailyEntity", "dailyViewMode", "dailyStatus", "dailySnapshotCue", "dailyMovementTable",
  "executionPeriod", "executionAsOfDay", "executionDimension", "executionReadiness", "executionObservationNote", "executionSnapshotCue", "executionKpis", "executionTable",
].forEach((id) => document.getElementById(id));
const load = (file) => require(path.join(__dirname, "..", file));
load("js/config.js"); load("js/utilities.js");

const periodContext = { status: "READY", availablePeriods: ["2026-04", "2026-08", "2026-09"], availableFinancialYears: ["FY2026-27"], latestAvailablePeriod: "2026-09", latestActualPeriod: "2026-08", defaultSelectedPeriod: "2026-09" };
const baseSummary = { actualPremium: 0, budget: 100, potential: 200, achievementPct: 0, budgetGap: -100, potentialPenetrationPct: 0, budgetPresentCount: 1, budgetMissingCount: 0, potentialPresentCount: 1, potentialMissingCount: 0, coverageStatus: "COMPLETE" };
global.BancaTrackerCommercialRollups = { buildPeriodContext() { return periodContext; }, getFinancialYear() { return "FY2026-27"; }, buildRollup(performance, scope, dimension) { return { status: "READY", summary: baseSummary, diagnostics: periodContext, rows: [{ key: dimension === "OVERALL" ? "ALL" : "A", label: dimension, ...baseSummary }] }; } };
global.BancaTrackerCommercialComparison = { resolveDefaultPeriods() { return { basePeriod: "2026-04", comparisonPeriod: "2026-08" }; }, buildComparison(options) { return { status: "READY", samePeriod: false, basePeriod: options.basePeriod, comparisonPeriod: options.comparisonPeriod, coverage: { base: baseSummary, comparison: baseSummary }, rows: [{ key: "A", label: "A", presenceStatus: "BOTH", base: { actualPremium: 1, budget: 1 }, comparison: { actualPremium: 2, budget: 2 }, changes: { actualChange: 1, actualChangePct: 100, achievementPointChange: 1, penetrationPointChange: 1 } }] }; } };
global.BancaTrackerDailyCommercialComparison = { buildComparison() { return { status: "READY", entities: [{ key: "A", label: "A", presenceStatus: "BOTH", days: [{ day: 1, base: { dailyActual: 1, cumulativeActual: 1 }, comparison: { dailyActual: 2, cumulativeActual: 2 }, daily: { change: 1, changePct: 100, direction: "UP" }, cumulative: { change: 1, changePct: 100, direction: "UP" } }] }] }; } };

const executionCalls = [];
function executionRow(key, label, overrides = {}) { return { key, label, actualToDate: 120, budget: 100, budgetAchievementToDatePct: 120, expectedBudgetToDate: 50, paceGap: 70, averageDailyActual: 6, requiredDailyRunRate: -2, projectedMonthEndActual: 186, projectedAchievementPct: 186, projectedBudgetGap: 86, ...overrides }; }
global.BancaTrackerCommercialExecution = {
  getDaysInPeriod(period) { return period === "2026-04" ? 30 : 31; },
  resolveAsOfDay(facts, period) { const days = facts.filter((fact) => fact.monthKey === period).map((fact) => fact.day); return { valid: true, asOfDay: days.length ? Math.max(...days) : 0, asOfSource: days.length ? "OBSERVED_FACT_MAX_DAY" : "NO_OBSERVATIONS" }; },
  buildExecution(options) {
    executionCalls.push(options);
    const rows = options.dimension === "OVERALL" ? [executionRow("ALL", "Overall")] : [
      executionRow("BANK", "Bank A"), executionRow("COMMERCIAL", "Commercial only", { actualToDate: 0, averageDailyActual: null, projectedMonthEndActual: null }),
      executionRow("ACTUAL", "Actual only", { budget: null, budgetAchievementToDatePct: null, expectedBudgetToDate: null, paceGap: null, requiredDailyRunRate: null, projectedAchievementPct: null, projectedBudgetGap: null }),
      executionRow("__UNMAPPED__", "Unmapped", { actualToDate: -20, requiredDailyRunRate: -4 }), executionRow("__UNASSIGNED__", "Unassigned"),
    ];
    return { status: options.selectedPeriod === "2026-09" ? "NO_FACT_DATA" : "PARTIAL", selectedPeriod: options.selectedPeriod, asOfDay: options.asOfDay, asOfSource: "EXPLICIT", observedDays: options.asOfDay, remainingDays: (options.selectedPeriod === "2026-04" ? 30 : 31) - options.asOfDay, rows, coverage: { budgetPresentCount: rows.filter((row) => row.budget !== null).length, budgetMissingCount: rows.filter((row) => row.budget === null).length } };
  },
};
global.BancaTrackerCore = { state: { factData: [{ monthKey: "2026-04", day: 10 }, { monthKey: "2026-08", day: 20 }], commercialPerformance: { status: "READY", rows: [{}] } } };
global.BancaTrackerLiveGeographyAuthority = { getCachedContext() { return { cached: true }; } };
load("js/commercialPerformanceUI.js");
const UI = BancaTrackerCommercialPerformanceUI;
let result = UI.render();

assert.strictEqual(UI.state.execution.selectedPeriod, "2026-08");
assert.strictEqual(UI.state.execution.asOfDay, 20);
assert.strictEqual(UI.state.execution.dimension, "BANK");
assert.match(elements.executionPeriod.innerHTML, /2026-09/);
assert.strictEqual((elements.executionAsOfDay.innerHTML.match(/<option/g) || []).length, 32);
assert.match(elements.executionAsOfDay.innerHTML, /No observations/);
assert.strictEqual(executionCalls.at(-2).dimension, "OVERALL");
assert.strictEqual(executionCalls.at(-1).dimension, "BANK");
assert.match(elements.executionReadiness.innerHTML, /PARTIAL/);
assert.match(elements.executionReadiness.innerHTML, /20 observed days/);
assert.match(elements.executionReadiness.innerHTML, /11 remaining calendar days/);
for (const label of ["Actual to Date", "Monthly Budget", "Budget Achievement to Date", "Expected Budget to Date", "Pace Gap", "Average Daily Actual", "Required Daily Run-rate", "Projected Month-end Actual", "Projected Achievement", "Projected Budget Gap"]) assert.ok(elements.executionKpis.innerHTML.includes(label), label);
assert.match(elements.executionKpis.innerHTML, /120\.0%/);
assert.match(elements.executionKpis.innerHTML, /186\.0%/);
for (const label of ["Commercial only", "Actual only", "Unmapped", "Unassigned"]) assert.ok(elements.executionTable.innerHTML.includes(label), label);
assert.match(elements.executionTable.innerHTML, /N\/A/);
assert.match(elements.executionTable.innerHTML, /-₹20|-â‚¹20/);
assert.match(elements.executionReadiness.innerHTML, /Budget Coverage/);
assert.match(elements.executionObservationNote.textContent, /Transactions after that day/);
assert.ok(result.execution.overall !== result.execution.table);

const callsBefore = executionCalls.length;
UI.handleExecutionAsOfChange("10");
assert.strictEqual(UI.state.execution.asOfDay, 10);
assert.strictEqual(executionCalls.length, callsBefore + 2);
assert.strictEqual(executionCalls.at(-1).asOfDay, 10);
UI.handleExecutionPeriodChange("2026-09");
assert.strictEqual(UI.state.execution.asOfDay, 0);
assert.match(elements.executionReadiness.innerHTML, /NO FACT DATA/);
assert.match(elements.executionObservationNote.textContent, /No Actual observations/);
UI.handleExecutionAsOfChange("31");
UI.handleExecutionPeriodChange("2026-04");
assert.strictEqual(UI.state.execution.asOfDay, 10);
assert.strictEqual((elements.executionAsOfDay.innerHTML.match(/<option/g) || []).length, 31);
const callsBeforeDimension = executionCalls.length;
UI.handleExecutionDimensionChange("ASSIGNED_RM");
assert.strictEqual(executionCalls.length, callsBeforeDimension + 2);
assert.match(elements.executionSnapshotCue.textContent, /current active hierarchy snapshot/);
UI.handleExecutionDimensionChange("OVERALL");
assert.strictEqual(executionCalls.length, callsBeforeDimension + 3);

UI.renderExecutionKpis({ rows: [executionRow("ALL", "Overall", { budget: 0, budgetAchievementToDatePct: null, averageDailyActual: null, requiredDailyRunRate: null, projectedMonthEndActual: null, projectedAchievementPct: null })] });
assert.match(elements.executionKpis.innerHTML, /N\/A/);
assert.match(elements.executionKpis.innerHTML, /₹0|â‚¹0/);
UI.renderExecutionKpis({ rows: [executionRow("ALL", "Overall", { actualToDate: -50, requiredDailyRunRate: -10, projectedAchievementPct: 150 })] });
assert.match(elements.executionKpis.innerHTML, /150\.0%/);

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const css = fs.readFileSync(path.join(__dirname, "..", "style.css"), "utf8");
const source = fs.readFileSync(path.join(__dirname, "..", "js/commercialPerformanceUI.js"), "utf8");
for (const id of ["executionPeriod", "executionAsOfDay", "executionDimension"]) assert.match(html, new RegExp(`for="${id}"`));
assert.match(html, /Commercial Execution/);
assert.match(html, /simple linear projection based on observed average daily Actual/);
assert.match(css, /commercial-execution-section/);
assert.match(css, /commercial-table-wrap[^}]*overflow-x: auto/);
assert.doesNotMatch(source, /expectedBudgetToDate\s*=|paceGap\s*=|averageDailyActual\s*=|requiredDailyRunRate\s*=|projectedMonthEndActual\s*=|projectedAchievementPct\s*=/);
assert.doesNotMatch(source, /Repository|IndexedDB|ON_TRACK|AT_RISK|traffic-light|workingDay|advancedForecast/i);
assert.doesNotMatch(html, />Today<|Current day|Days elapsed today/i);
for (const untouched of ["js/analytics/commercialExecution.js", "js/analytics/commercialComparison.js", "js/analytics/dailyCommercialComparison.js", "js/activation.js", "js/scorecard.js", "js/productivity.js", "js/performance.js", "js/target.js", "app.js", "js/core.js"]) assert.strictEqual(require("child_process").execFileSync("git", ["diff", "--name-only", "--", untouched], { cwd: path.join(__dirname, ".."), encoding: "utf8" }).trim(), "", untouched);
console.log("Step 4O commercial execution UI tests passed: additive placement, independent defaults/controls, authority-only cards/table, cutoff backtesting/reset, null/zero/negative edges, planning rows, coverage/status/cues, responsiveness, accessibility, and preservation.");
