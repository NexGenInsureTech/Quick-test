/* Step 4P: governed commercial execution status and attention authority. */
"use strict";
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
global.window = global;

const modulePath = path.join(__dirname, "..", "js/analytics/commercialExecutionStatus.js");
vm.runInThisContext(fs.readFileSync(modulePath, "utf8"), { filename: "commercialExecutionStatus.js" });
const Status = BancaTrackerCommercialExecutionStatus;
for (const name of ["classifyObservation", "classifyReference", "classifyBudgetPosition", "classifyPace", "classifyProjection", "buildAttentionReasons", "classifyExecutionRow", "summarize", "buildStatus", "getStatusLabel"]) assert.strictEqual(typeof Status[name], "function", name);

const row = (overrides = {}) => ({
  key: "B1", label: "Branch 1", actualToDate: 30, budget: 100,
  paceGap: -10, projectedMonthEndActual: 90,
  projectedAchievementPct: 90, projectedBudgetGap: -10,
  ...overrides,
});
const result = (rows, overrides = {}) => ({
  status: "READY", selectedPeriod: "2026-08", dimension: "BRANCH", asOfDay: 10,
  rows, diagnostics: { supplied: true }, ...overrides,
});

assert.strictEqual(Status.classifyObservation(10), "OBSERVATIONS_PRESENT");
assert.strictEqual(Status.classifyObservation(0), "NO_OBSERVATIONS");
assert.strictEqual(Status.classifyReference(null), "BUDGET_MISSING");
assert.strictEqual(Status.classifyReference(0), "BUDGET_ZERO");
assert.strictEqual(Status.classifyReference(100), "BUDGET_POSITIVE");
assert.strictEqual(Status.classifyReference(-1), "BUDGET_INVALID");
assert.strictEqual(Status.classifyReference("100"), "BUDGET_INVALID");
assert.strictEqual(Status.classifyBudgetPosition(99, 100), "BUDGET_NOT_ACHIEVED");
assert.strictEqual(Status.classifyBudgetPosition(100, 100), "BUDGET_ACHIEVED");
assert.strictEqual(Status.classifyBudgetPosition(101, 100), "BUDGET_EXCEEDED");
assert.strictEqual(Status.classifyBudgetPosition(1, 0), "NOT_APPLICABLE");
assert.strictEqual(Status.classifyPace(-1, 100, 10), "BEHIND_LINEAR_PACE");
assert.strictEqual(Status.classifyPace(0, 100, 10), "AT_LINEAR_PACE");
assert.strictEqual(Status.classifyPace(1, 100, 10), "AHEAD_OF_LINEAR_PACE");
assert.strictEqual(Status.classifyPace(0, 100, 0), "NO_OBSERVATIONS");
assert.strictEqual(Status.classifyPace(1, 0, 10), "NOT_APPLICABLE");
assert.strictEqual(Status.classifyProjection(99, 100, 10), "PROJECTED_SHORTFALL");
assert.strictEqual(Status.classifyProjection(100, 100, 10), "PROJECTED_EXACT_BUDGET");
assert.strictEqual(Status.classifyProjection(101, 100, 10), "PROJECTED_TO_EXCEED");
assert.strictEqual(Status.classifyProjection(null, 100, 10), "NOT_AVAILABLE");
assert.strictEqual(Status.classifyProjection(100, 100, 0), "NOT_AVAILABLE");
assert.strictEqual(Status.classifyProjection(100, null, 10), "NOT_APPLICABLE");

let built = Status.buildStatus(result([row()]));
let classified = built.rows[0];
assert.deepStrictEqual(
  [classified.observationStatus, classified.budgetReferenceStatus, classified.budgetPositionStatus, classified.paceStatus, classified.projectionStatus],
  ["OBSERVATIONS_PRESENT", "BUDGET_POSITIVE", "BUDGET_NOT_ACHIEVED", "BEHIND_LINEAR_PACE", "PROJECTED_SHORTFALL"],
);
assert.strictEqual(classified.executionAttention, true);
assert.strictEqual(classified.referenceAttention, false);
assert.strictEqual(classified.primaryStatus, "PROJECTED_SHORTFALL");
assert.deepStrictEqual(classified.attentionReasons, ["BUDGET_NOT_ACHIEVED", "PROJECTED_SHORTFALL", "BEHIND_LINEAR_PACE"]);
assert.strictEqual(Status.getStatusLabel("BEHIND_LINEAR_PACE"), "Behind linear pace");

classified = Status.buildStatus(result([row({ actualToDate: 0 })])).rows[0];
assert.strictEqual(classified.observationStatus, "OBSERVATIONS_PRESENT");
assert.strictEqual(classified.executionAttention, true);
classified = Status.buildStatus(result([row({ actualToDate: 0, paceGap: 0, projectedMonthEndActual: null })], { status: "NO_FACT_DATA", asOfDay: 0 })).rows[0];
assert.strictEqual(classified.observationStatus, "NO_OBSERVATIONS");
assert.strictEqual(classified.paceStatus, "NO_OBSERVATIONS");
assert.strictEqual(classified.projectionStatus, "NOT_AVAILABLE");
assert.strictEqual(classified.executionAttention, false);

classified = Status.buildStatus(result([row({ actualToDate: 100, paceGap: -1, projectedMonthEndActual: 90 })])).rows[0];
assert.strictEqual(classified.budgetPositionStatus, "BUDGET_ACHIEVED");
assert.strictEqual(classified.executionAttention, false);
classified = Status.buildStatus(result([row({ actualToDate: 110, paceGap: -1, projectedMonthEndActual: 90 })])).rows[0];
assert.strictEqual(classified.budgetPositionStatus, "BUDGET_EXCEEDED");
assert.strictEqual(classified.executionAttention, false);

classified = Status.buildStatus(result([row({ paceGap: -1, projectedMonthEndActual: 110 })])).rows[0];
assert.deepStrictEqual([classified.paceStatus, classified.projectionStatus, classified.executionAttention], ["BEHIND_LINEAR_PACE", "PROJECTED_TO_EXCEED", true]);
classified = Status.buildStatus(result([row({ paceGap: 1, projectedMonthEndActual: 90 })])).rows[0];
assert.deepStrictEqual([classified.paceStatus, classified.projectionStatus, classified.executionAttention], ["AHEAD_OF_LINEAR_PACE", "PROJECTED_SHORTFALL", true]);

classified = Status.buildStatus(result([row({ budget: null, actualToDate: 50, paceGap: null, projectedMonthEndActual: 150 })])).rows[0];
assert.deepStrictEqual([classified.budgetReferenceStatus, classified.referenceAttention, classified.executionAttention, classified.paceStatus, classified.projectionStatus], ["BUDGET_MISSING", true, false, "NOT_APPLICABLE", "NOT_APPLICABLE"]);
classified = Status.buildStatus(result([row({ budget: 0 })])).rows[0];
assert.deepStrictEqual([classified.budgetReferenceStatus, classified.referenceAttention, classified.executionAttention], ["BUDGET_ZERO", false, false]);
assert.ok(classified.attentionReasons.includes("ZERO_BUDGET_REFERENCE"));
classified = Status.buildStatus(result([row({ budget: -1 })])).rows[0];
assert.deepStrictEqual([classified.budgetReferenceStatus, classified.referenceAttention, classified.executionAttention], ["BUDGET_INVALID", true, false]);
classified = Status.buildStatus(result([row({ actualToDate: -10, paceGap: -20, projectedMonthEndActual: -30 })])).rows[0];
assert.deepStrictEqual([classified.budgetPositionStatus, classified.paceStatus, classified.projectionStatus, classified.executionAttention], ["BUDGET_NOT_ACHIEVED", "BEHIND_LINEAR_PACE", "PROJECTED_SHORTFALL", true]);

const entityRows = [
  row({ key: "__UNMAPPED__", label: "Unmapped" }),
  row({ key: "__UNASSIGNED__", label: "Unassigned", budget: null }),
  row({ key: "ALL", label: "Overall", actualToDate: 100, paceGap: 0, projectedMonthEndActual: 100 }),
  row({ key: "C0", label: "Commercial only", actualToDate: 0 }),
];
const snapshot = JSON.stringify(result(entityRows));
built = Status.buildStatus(result(entityRows));
assert.deepStrictEqual(built.rows.map((item) => item.key), ["__UNMAPPED__", "__UNASSIGNED__", "ALL", "C0"]);
assert.deepStrictEqual(built.executionAttentionRows.map((item) => item.key), ["__UNMAPPED__", "C0"]);
assert.deepStrictEqual(built.referenceAttentionRows.map((item) => item.key), ["__UNASSIGNED__"]);
assert.deepStrictEqual(built.summary, {
  totalRows: 4, rowsWithPositiveBudget: 3, rowsWithMissingBudget: 1, rowsWithZeroBudget: 0,
  rowsWithObservations: 4, rowsWithoutObservations: 0, budgetAchievedCount: 1, budgetExceededCount: 0,
  aheadPaceCount: 0, atPaceCount: 1, behindPaceCount: 2, projectedShortfallCount: 2,
  projectedExactCount: 1, projectedExceedCount: 0, executionAttentionCount: 2, referenceAttentionCount: 1,
});
assert.strictEqual(JSON.stringify(result(entityRows)), snapshot);

for (const dimension of ["OVERALL", "BANK", "BRANCH", "STATE", "ZONE", "BANK_REGION", "BANK_ZONE", "FGM_OFFICE", "ASSIGNED_RM", "CSM", "ASM", "ZSM", "NATIONAL_HEAD"]) {
  assert.strictEqual(Status.buildStatus(result([row()], { dimension })).dimension, dimension);
}
assert.strictEqual(Status.buildStatus(result([])).status, "NO_ROWS");
assert.strictEqual(Status.buildStatus(null).status, "INVALID_INPUT");
for (const sourceStatus of ["INVALID_PERIOD", "INVALID_AS_OF", "NO_PERIODS"]) {
  built = Status.buildStatus(result([row()], { status: sourceStatus }));
  assert.strictEqual(built.status, "INVALID_INPUT");
  assert.strictEqual(built.sourceExecutionStatus, sourceStatus);
  assert.deepStrictEqual(built.rows, []);
}
built = Status.buildStatus(result([row()], { status: "PARTIAL" }));
assert.strictEqual(built.status, "PARTIAL");
assert.strictEqual(built.sourceExecutionStatus, "PARTIAL");
assert.deepStrictEqual(built.diagnostics.sourceDiagnostics, { supplied: true });

const source = fs.readFileSync(modulePath, "utf8");
for (const forbidden of ["Repository", "IndexedDB", "Date.now", "workingDay", "severity", "riskScore", "attentionScore", "priorityScore", "recommendation", "notification", "RED", "AMBER", "GREEN", "GOOD", "BAD"]) assert.ok(!source.includes(forbidden), forbidden);
for (const formula of [/actualToDate\s*\/\s*observedDays/, /budget\s*\*\s*observedDays/, /budget\s*-\s*actualToDate\)\s*\/\s*remainingDays/, /actualToDate\s*\/\s*observedDays\s*\*\s*daysInMonth/]) assert.doesNotMatch(source, formula);
const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
assert.ok(html.indexOf("commercialExecutionStatus.js") > html.indexOf("commercialExecution.js"));
const readme = fs.readFileSync(path.join(__dirname, "..", "README.md"), "utf8");
assert.match(readme, /pure, on-demand interpretation authority/);
for (const untouched of ["js/analytics/commercialExecution.js", "js/commercialPerformanceUI.js", "style.css", "app.js", "js/core.js", "js/analytics/commercialComparison.js", "js/analytics/dailyCommercialComparison.js", "js/activation.js", "js/scorecard.js", "js/productivity.js", "js/performance.js", "js/target.js"]) {
  assert.strictEqual(require("child_process").execFileSync("git", ["diff", "--name-only", "--", untouched], { cwd: path.join(__dirname, ".."), encoding: "utf8" }).trim(), "", untouched);
}
console.log("Step 4P commercial execution status tests passed: supplied-result facets, deterministic attention/reasons, null/zero/signed edges, summaries, ordering, source propagation, purity, immutability, and preservation.");
