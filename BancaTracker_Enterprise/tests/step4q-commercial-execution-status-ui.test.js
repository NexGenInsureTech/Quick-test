/* Step 4Q: Commercial Execution status and attention UI integration. */
"use strict";
const assert = require("assert");
const fs = require("fs");
const path = require("path");

class Element { constructor() { this.innerHTML = ""; this.textContent = ""; this.value = ""; this.disabled = false; this.hidden = false; this.listeners = {}; } addEventListener(type, handler) { this.listeners[type] = handler; } }
const elements = {};
global.window = global;
global.document = { getElementById(id) { return elements[id] || (elements[id] = new Element()); } };
const load = (file) => require(path.join(__dirname, "..", file));
load("js/config.js"); load("js/utilities.js"); load("js/analytics/commercialExecutionStatus.js");

const periodContext = { status: "READY", availablePeriods: ["2026-08", "2026-09"], availableFinancialYears: ["FY2026-27"], latestAvailablePeriod: "2026-09", latestActualPeriod: "2026-08", defaultSelectedPeriod: "2026-09" };
global.BancaTrackerCommercialRollups = { buildPeriodContext() { return periodContext; }, getFinancialYear() { return "FY2026-27"; } };
global.BancaTrackerCore = { state: { factData: [{ monthKey: "2026-08", day: 10 }], commercialPerformance: { status: "READY", rows: [{}] } } };
global.BancaTrackerLiveGeographyAuthority = { getCachedContext() { return { cached: true }; } };

let executionCalls = 0;
function rawRow(key, label, overrides = {}) { return { key, label, actualToDate: 30, budget: 100, budgetAchievementToDatePct: 30, expectedBudgetToDate: 32.25, paceGap: -2.25, averageDailyActual: 3, requiredDailyRunRate: 3.33, projectedMonthEndActual: 93, projectedAchievementPct: 93, projectedBudgetGap: -7, ...overrides }; }
global.BancaTrackerCommercialExecution = {
  getDaysInPeriod() { return 31; },
  resolveAsOfDay() { return { valid: true, asOfDay: 10, asOfSource: "OBSERVED_FACT_MAX_DAY" }; },
  buildExecution(options) {
    executionCalls += 1;
    const all = rawRow("ALL", "Overall");
    const rows = options.dimension === "OVERALL" ? [all] : [
      rawRow("EXEC", "Behind branch"),
      rawRow("REF", "Actual only", { budget: null, budgetAchievementToDatePct: null, expectedBudgetToDate: null, paceGap: null, requiredDailyRunRate: null, projectedAchievementPct: null, projectedBudgetGap: null }),
      rawRow("ZERO", "Zero Budget", { budget: 0, budgetAchievementToDatePct: null, expectedBudgetToDate: 0, paceGap: 30, projectedAchievementPct: null, projectedBudgetGap: 93 }),
      rawRow("DONE", "Budget achieved", { actualToDate: 100, budgetAchievementToDatePct: 100, paceGap: 67.75, projectedMonthEndActual: 310, projectedAchievementPct: 310, projectedBudgetGap: 210 }),
      rawRow("TENSION", "Behind but projected exceed", { paceGap: -1, projectedMonthEndActual: 110, projectedAchievementPct: 110, projectedBudgetGap: 10 }),
      rawRow("__UNMAPPED__", "Unmapped", { actualToDate: 120, paceGap: 87.75, projectedMonthEndActual: 372, projectedAchievementPct: 372, projectedBudgetGap: 272 }),
      rawRow("__UNASSIGNED__", "Unassigned", { actualToDate: 120, paceGap: 87.75, projectedMonthEndActual: 372, projectedAchievementPct: 372, projectedBudgetGap: 272 }),
    ];
    const asOfDay = options.asOfDay;
    if (asOfDay === 0) rows.forEach((row) => { row.paceGap = 0; row.projectedMonthEndActual = null; row.projectedAchievementPct = null; row.projectedBudgetGap = null; });
    return { status: asOfDay === 0 ? "NO_FACT_DATA" : "PARTIAL", selectedPeriod: options.selectedPeriod, dimension: options.dimension, asOfDay, observedDays: asOfDay, remainingDays: 31 - asOfDay, rows, coverage: { budgetPresentCount: rows.filter((row) => row.budget !== null).length, budgetMissingCount: rows.filter((row) => row.budget === null).length }, diagnostics: {} };
  },
};

load("js/commercialPerformanceUI.js");
const UI = BancaTrackerCommercialPerformanceUI;
let rendered = UI.renderExecution(periodContext, BancaTrackerCore.state.commercialPerformance, { cached: true });
assert.strictEqual(UI.state.execution.attentionFilter, "ALL");
assert.strictEqual(elements.executionAttentionFilter.value, "ALL");
assert.ok(rendered.statusOverall && rendered.statusTable);
assert.match(elements.executionAttentionSummary.innerHTML, /Execution Attention: 2/);
assert.match(elements.executionAttentionSummary.innerHTML, /Reference Attention: 1/);
assert.match(elements.executionAttentionSummary.innerHTML, /Observed Rows: 7/);
assert.match(elements.executionAttentionSummary.innerHTML, /Projected Shortfall Rows: 1/);
assert.match(elements.executionAttentionSummary.innerHTML, /Budget Achieved \/ Exceeded: 3/);
for (const label of ["Budget Position", "Pace Status", "Projection Status", "Attention", "Reasons", "Behind linear pace", "Projected shortfall", "Execution attention", "Reference attention", "Budget reference missing", "Zero Budget reference", "Budget achieved", "Projected to exceed Budget"]) assert.ok(elements.executionTable.innerHTML.includes(label), label);
for (const rowLabel of ["Actual only", "Zero Budget", "Unmapped", "Unassigned"]) assert.ok(elements.executionTable.innerHTML.includes(rowLabel), rowLabel);

const callsBeforeFilter = executionCalls;
UI.handleExecutionAttentionFilterChange("EXECUTION_ATTENTION");
assert.strictEqual(executionCalls, callsBeforeFilter);
assert.match(elements.executionTable.innerHTML, /Behind branch/);
assert.match(elements.executionTable.innerHTML, /Behind but projected exceed/);
assert.doesNotMatch(elements.executionTable.innerHTML, /Actual only/);
UI.handleExecutionAttentionFilterChange("REFERENCE_ATTENTION");
assert.strictEqual(executionCalls, callsBeforeFilter);
assert.match(elements.executionTable.innerHTML, /Actual only/);
assert.doesNotMatch(elements.executionTable.innerHTML, /Behind branch/);
UI.handleExecutionAttentionFilterChange("NO_ATTENTION");
assert.match(elements.executionTable.innerHTML, /Zero Budget/);
assert.match(elements.executionTable.innerHTML, /Budget achieved/);
UI.handleExecutionAttentionFilterChange("ALL");
assert.match(elements.executionTable.innerHTML, /Showing 7 of 7 rows/);

const manualBoth = BancaTrackerCommercialExecutionStatus.buildStatus({ status: "READY", selectedPeriod: "2026-08", dimension: "BANK", asOfDay: 10, rows: [rawRow("BOTH", "Both flags")] });
manualBoth.rows[0].executionAttention = true; manualBoth.rows[0].referenceAttention = true;
UI.renderExecutionTable(null, manualBoth);
assert.match(elements.executionTable.innerHTML, /Execution attention/);
assert.match(elements.executionTable.innerHTML, /Reference attention/);
UI.handleExecutionAttentionFilterChange("REFERENCE_ATTENTION");
UI.renderExecutionTable(null, BancaTrackerCommercialExecutionStatus.buildStatus({ status: "READY", selectedPeriod: "2026-08", dimension: "BANK", asOfDay: 10, rows: [rawRow("NONE", "No reference row", { actualToDate: 120, paceGap: 1, projectedMonthEndActual: 120 })] }));
assert.match(elements.executionTable.innerHTML, /No rows match the selected attention filter/);

UI.handleExecutionAttentionFilterChange("ALL");
const beforeAsOf = executionCalls;
rendered = UI.handleExecutionAsOfChange("0");
assert.strictEqual(executionCalls, beforeAsOf + 2);
assert.match(elements.executionTable.innerHTML, /No observations/);
assert.doesNotMatch(elements.executionTable.innerHTML, />Execution attention</);
const beforeDimension = executionCalls;
UI.handleExecutionDimensionChange("ASSIGNED_RM");
assert.strictEqual(executionCalls, beforeDimension + 2);
assert.match(elements.executionSnapshotCue.textContent, /current active hierarchy snapshot/);
const beforePeriod = executionCalls;
UI.handleExecutionPeriodChange("2026-09");
assert.strictEqual(executionCalls, beforePeriod + 2);

const invalid = BancaTrackerCommercialExecutionStatus.buildStatus({ status: "INVALID_AS_OF", selectedPeriod: "2026-08", dimension: "BANK", asOfDay: null, rows: [] });
UI.renderExecutionTable(null, invalid);
assert.match(elements.executionTable.innerHTML, /INVALID INPUT/);

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const css = fs.readFileSync(path.join(__dirname, "..", "style.css"), "utf8");
const source = fs.readFileSync(path.join(__dirname, "..", "js/commercialPerformanceUI.js"), "utf8");
assert.match(html, /for="executionAttentionFilter">Attention Filter/);
for (const label of ["All", "Execution attention", "Reference attention", "No attention"]) assert.ok(html.includes(`>${label}<`), label);
assert.ok(html.indexOf("commercialExecution.js") < html.indexOf("commercialExecutionStatus.js") && html.indexOf("commercialExecutionStatus.js") < html.indexOf("commercialPerformanceUI.js"));
for (const selector of ["commercial-execution-attention-summary", "commercial-status-chip", "commercial-attention-chip", "commercial-reason-list"]) assert.ok(css.includes(`.${selector}`), selector);
assert.match(css, /commercial-table-wrap[^}]*overflow-x: auto/);
assert.match(css, /commercial-execution-attention-summary[^}]*flex-wrap: wrap/);
assert.match(source, /BancaTrackerCommercialExecutionStatus\.buildStatus\(overall\)/);
assert.match(source, /BancaTrackerCommercialExecutionStatus\.buildStatus\(table\)/);
assert.doesNotMatch(source, /paceGap\s*<\s*0|projectedMonthEndActual\s*<\s*[^;]*budget|actualToDate\s*>?=\s*[^;]*budget|budget\s*===\s*(?:null|0)/);
assert.doesNotMatch(source, /ON_TRACK|AT_RISK|traffic.?light|riskScore|priorityScore|workingDay|advancedForecast/i);
for (const untouched of ["js/analytics/commercialExecutionStatus.js", "js/analytics/commercialExecution.js", "js/analytics/commercialComparison.js", "js/analytics/dailyCommercialComparison.js", "js/activation.js", "js/scorecard.js", "js/productivity.js", "js/performance.js", "js/target.js", "js/core.js", "app.js"]) assert.strictEqual(require("child_process").execFileSync("git", ["diff", "--name-only", "--", untouched], { cwd: path.join(__dirname, ".."), encoding: "utf8" }).trim(), "", untouched);
assert.match(fs.readFileSync(path.join(__dirname, "..", "README.md"), "utf8"), /filter only filters cached classified rows/);
console.log("Step 4Q commercial execution status UI tests passed: authority-only labels/counts, distinct attention, cached filtering, edge states, refresh lifecycle, accessibility, responsiveness, and preservation.");
