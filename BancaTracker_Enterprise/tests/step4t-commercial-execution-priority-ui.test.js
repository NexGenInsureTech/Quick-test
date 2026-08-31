/* Step 4T: Commercial Execution prioritisation UI integration. */
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
const baseSummary = { actualPremium: 0, budget: 100, potential: 200, achievementPct: 0, budgetGap: -100, potentialPenetrationPct: 0, budgetPresentCount: 1, budgetMissingCount: 0, potentialPresentCount: 1, potentialMissingCount: 0, coverageStatus: "COMPLETE" };
global.BancaTrackerCommercialRollups = { buildPeriodContext() { return periodContext; }, getFinancialYear() { return "FY2026-27"; }, buildRollup(performance, scope, dimension) { return { status: "READY", summary: baseSummary, diagnostics: {}, rows: [{ key: dimension === "OVERALL" ? "ALL" : "A", label: dimension, ...baseSummary }] }; } };
global.BancaTrackerCore = { state: { factData: [{ monthKey: "2026-08", day: 10 }], commercialPerformance: { status: "READY", rows: [{}] } } };
global.BancaTrackerLiveGeographyAuthority = { getCachedContext() { return { cached: true }; } };

let executionCalls = 0;
function executionRow(key, label, overrides = {}) { return { key, label, actualToDate: 30, budget: 100, budgetAchievementToDatePct: 30, expectedBudgetToDate: 32, paceGap: -2, averageDailyActual: 3, requiredDailyRunRate: 4, projectedMonthEndActual: 90, projectedAchievementPct: 90, projectedBudgetGap: -10, ...overrides }; }
global.BancaTrackerCommercialExecution = {
  getDaysInPeriod() { return 31; },
  resolveAsOfDay() { return { valid: true, asOfDay: 10, asOfSource: "OBSERVED_FACT_MAX_DAY" }; },
  buildExecution(options) {
    executionCalls += 1;
    const rows = options.dimension === "OVERALL" ? [executionRow("ALL", "Overall")] : [
      executionRow("B", "Second governed"),
      executionRow("A", "First governed"),
      executionRow("REF", "Reference row", { budget: null, budgetAchievementToDatePct: null, expectedBudgetToDate: null, paceGap: null, requiredDailyRunRate: null, projectedAchievementPct: null, projectedBudgetGap: null }),
      executionRow("__UNMAPPED__", "Unmapped"), executionRow("__UNASSIGNED__", "Unassigned"),
    ];
    return { status: "PARTIAL", selectedPeriod: options.selectedPeriod, dimension: options.dimension, asOfDay: options.asOfDay, observedDays: options.asOfDay, remainingDays: 31 - options.asOfDay, rows, coverage: { budgetPresentCount: rows.filter((row) => row.budget !== null).length, budgetMissingCount: rows.filter((row) => row.budget === null).length }, diagnostics: {} };
  },
};

let priorityCalls = 0;
global.BancaTrackerCommercialExecutionPriority = {
  buildPriority(executionResult, statusResult) {
    priorityCalls += 1;
    if (executionResult.dimension === "OVERALL") return { status: "READY", rankingApplicable: false, executionPriority: [], referencePriority: [], summary: {}, diagnostics: [] };
    const sourceStatus = { paceStatus: "BEHIND_LINEAR_PACE", projectionStatus: "PROJECTED_SHORTFALL" };
    return {
      status: "READY", rankingApplicable: true,
      executionPriority: [
        { priorityRank: 7, key: "B", label: "Second governed", priorityBasis: { projectedShortfallAmount: 200, paceGapMagnitude: 20, budget: 500 }, sourceStatus },
        { priorityRank: 11, key: "A", label: "First governed", priorityBasis: { projectedShortfallAmount: 100, paceGapMagnitude: 10, budget: 300 }, sourceStatus },
        { priorityRank: 12, key: "__UNMAPPED__", label: "Unmapped", priorityBasis: { projectedShortfallAmount: 50, paceGapMagnitude: 5, budget: 200 }, sourceStatus },
        { priorityRank: 13, key: "__UNASSIGNED__", label: "Unassigned", priorityBasis: { projectedShortfallAmount: 25, paceGapMagnitude: 2, budget: 150 }, sourceStatus },
      ],
      referencePriority: [{ priorityRank: 3, key: "REF", label: "Reference row", referenceReasonCode: "BUDGET_REFERENCE_MISSING" }],
      summary: {}, diagnostics: [],
    };
  },
};

load("js/commercialPerformanceUI.js");
const UI = BancaTrackerCommercialPerformanceUI;
let rendered = UI.renderExecution(periodContext, BancaTrackerCore.state.commercialPerformance, { cached: true });
assert.strictEqual(UI.state.execution.priorityView, "NONE");
assert.strictEqual(elements.executionPriorityView.value, "NONE");
assert.match(elements.executionPriorityTable.innerHTML, /Select an execution or reference priority view/);
assert.ok(rendered.priority);
assert.strictEqual(priorityCalls, 1);

const callsBeforeView = executionCalls;
const priorityBeforeView = priorityCalls;
UI.state.execution.attentionFilter = "REFERENCE_ATTENTION";
UI.handleExecutionPriorityViewChange("EXECUTION_PRIORITY");
assert.strictEqual(executionCalls, callsBeforeView);
assert.strictEqual(priorityCalls, priorityBeforeView);
assert.strictEqual(UI.state.execution.attentionFilter, "REFERENCE_ATTENTION");
assert.match(elements.executionPriorityTable.innerHTML, /Second governed/);
assert.ok(elements.executionPriorityTable.innerHTML.indexOf("Second governed") < elements.executionPriorityTable.innerHTML.indexOf("First governed"));
for (const rank of [7, 11, 12, 13]) assert.match(elements.executionPriorityTable.innerHTML, new RegExp(`>${rank}<`));
for (const label of ["Projected Shortfall", "Pace Gap Magnitude", "Budget", "Behind linear pace", "Projected shortfall", "Execution attention", "Unmapped", "Unassigned"]) assert.ok(elements.executionPriorityTable.innerHTML.includes(label), label);

UI.handleExecutionPriorityViewChange("REFERENCE_PRIORITY");
assert.match(elements.executionPriorityTable.innerHTML, /Reference row/);
assert.match(elements.executionPriorityTable.innerHTML, />3</);
assert.match(elements.executionPriorityTable.innerHTML, /Budget reference missing/);
assert.doesNotMatch(elements.executionPriorityTable.innerHTML, /Second governed/);

const emptyPriority = { rankingApplicable: true, executionPriority: [], referencePriority: [] };
UI.state.execution.priorityView = "EXECUTION_PRIORITY"; UI.renderExecutionPriority(emptyPriority);
assert.match(elements.executionPriorityTable.innerHTML, /No entities currently require execution prioritisation/);
UI.state.execution.priorityView = "REFERENCE_PRIORITY"; UI.renderExecutionPriority(emptyPriority);
assert.match(elements.executionPriorityTable.innerHTML, /No reference-attention entities currently require prioritisation/);
UI.state.execution.priorityView = "EXECUTION_PRIORITY"; UI.renderExecutionPriority({ rankingApplicable: false, executionPriority: [], referencePriority: [] });
assert.match(elements.executionPriorityTable.innerHTML, /not applicable to the Overall view/);

const beforeAsOfExecution = executionCalls; const beforeAsOfPriority = priorityCalls;
UI.handleExecutionAsOfChange("5");
assert.strictEqual(executionCalls, beforeAsOfExecution + 2);
assert.strictEqual(priorityCalls, beforeAsOfPriority + 1);
const beforeDimensionExecution = executionCalls; const beforeDimensionPriority = priorityCalls;
UI.handleExecutionDimensionChange("BRANCH");
assert.strictEqual(executionCalls, beforeDimensionExecution + 2);
assert.strictEqual(priorityCalls, beforeDimensionPriority + 1);
const beforePeriodExecution = executionCalls; const beforePeriodPriority = priorityCalls;
UI.handleExecutionPeriodChange("2026-09");
assert.strictEqual(executionCalls, beforePeriodExecution + 2);
assert.strictEqual(priorityCalls, beforePeriodPriority + 1);

const beforeRefreshPriority = priorityCalls;
UI.render();
assert.strictEqual(priorityCalls, beforeRefreshPriority + 1);
UI.render();
assert.strictEqual(priorityCalls, beforeRefreshPriority + 2);

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const css = fs.readFileSync(path.join(__dirname, "..", "style.css"), "utf8");
const source = fs.readFileSync(path.join(__dirname, "..", "js/commercialPerformanceUI.js"), "utf8");
assert.match(html, /for="executionPriorityView">Priority View/);
for (const label of ["None", "Execution priority", "Reference priority"]) assert.ok(html.includes(`>${label}<`), label);
assert.ok(html.indexOf("commercialExecution.js") < html.indexOf("commercialExecutionStatus.js") && html.indexOf("commercialExecutionStatus.js") < html.indexOf("commercialExecutionPriority.js") && html.indexOf("commercialExecutionPriority.js") < html.indexOf("commercialPerformanceUI.js"));
for (const selector of ["commercial-priority-controls", "commercial-priority-table", "commercial-priority-rank", "commercial-priority-empty"]) assert.ok(css.includes(`.${selector}`), selector);
assert.match(css, /commercial-priority-table[^}]*overflow-x: auto/);
assert.match(css, /commercial-priority-controls[^}]*flex-wrap: wrap/);
assert.match(source, /BancaTrackerCommercialExecutionPriority\.buildPriority\(table, statusTable\)/);
assert.doesNotMatch(source, /projectedBudgetGap\s*<\s*0|paceGap\s*<\s*0|priorityRank\s*=|priorityRank\+\+|executionPriority\.sort|referencePriority\.sort|\.slice\(0\s*,\s*10\)/);
assert.doesNotMatch(source, /priorityScore|riskScore|priorityBand|P1|P2|P3|traffic.?light|workingDay|forecastConfidence/i);
assert.doesNotMatch(source, /Repository|IndexedDB/);
for (const untouched of ["js/analytics/commercialExecutionPriority.js", "js/analytics/commercialExecutionStatus.js", "js/analytics/commercialExecution.js", "js/analytics/commercialComparison.js", "js/analytics/dailyCommercialComparison.js", "js/activation.js", "js/scorecard.js", "js/productivity.js", "js/performance.js", "js/target.js", "js/core.js", "app.js"]) assert.strictEqual(require("child_process").execFileSync("git", ["diff", "--name-only", "--", untouched], { cwd: path.join(__dirname, ".."), encoding: "utf8" }).trim(), "", untouched);
assert.match(fs.readFileSync(path.join(__dirname, "..", "README.md"), "utf8"), /priority UI presents cached Step 4S results only/);
console.log("Step 4T commercial execution priority UI tests passed: cached authority consumption, unchanged ranks/order, independent views/filter, refresh lifecycle, neutral states, accessibility, responsiveness, and preservation.");
