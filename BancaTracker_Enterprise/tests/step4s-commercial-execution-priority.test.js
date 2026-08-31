/* Step 4S: governed commercial execution prioritisation authority. */
"use strict";
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
global.window = global;

const modulePath = path.join(__dirname, "..", "js/analytics/commercialExecutionPriority.js");
vm.runInThisContext(fs.readFileSync(modulePath, "utf8"), { filename: "commercialExecutionPriority.js" });
const Priority = BancaTrackerCommercialExecutionPriority;
for (const name of ["validateInputs", "buildExecutionPriority", "buildReferencePriority", "buildPriority", "getPriorityExplanation"]) assert.strictEqual(typeof Priority[name], "function", name);

function executionRow(key, overrides = {}) {
  return { key, label: `Label ${key}`, actualToDate: 20, budget: 100, projectedBudgetGap: -20, paceGap: -10, projectedMonthEndActual: 80, projectedAchievementPct: 80, requiredDailyRunRate: 4, potential: 500, ...overrides };
}
function statusRow(key, overrides = {}) {
  return { key, label: `Status ${key}`, executionAttention: true, referenceAttention: false, projectionStatus: "PROJECTED_SHORTFALL", paceStatus: "BEHIND_LINEAR_PACE", budgetReferenceStatus: "BUDGET_POSITIVE", budgetPositionStatus: "BUDGET_NOT_ACHIEVED", attentionReasons: ["BUDGET_NOT_ACHIEVED", "PROJECTED_SHORTFALL", "BEHIND_LINEAR_PACE"], ...overrides };
}
function inputs(executionRows, statusRows, overrides = {}) {
  return {
    execution: { status: "READY", selectedPeriod: "2026-08", asOfDay: 10, dimension: "BRANCH", rows: executionRows, diagnostics: {}, ...overrides.execution },
    status: { status: "READY", sourceExecutionStatus: "READY", periodKey: "2026-08", asOfDay: 10, dimension: "BRANCH", rows: statusRows, diagnostics: {}, ...overrides.status },
  };
}
function build(executionRows, statusRows, overrides) { const pair = inputs(executionRows, statusRows, overrides); return Priority.buildPriority(pair.execution, pair.status); }

let result = build(
  [
    executionRow("SHORT100", { projectedBudgetGap: -100, paceGap: -20, budget: 500 }),
    executionRow("SHORT50", { projectedBudgetGap: -50, paceGap: -100, budget: 1000 }),
    executionRow("NONSHORT", { projectedBudgetGap: 10, paceGap: -200, budget: 2000 }),
    executionRow("NOPROJ", { projectedBudgetGap: null, paceGap: -300, budget: 3000 }),
  ],
  [statusRow("SHORT100"), statusRow("SHORT50"), statusRow("NONSHORT", { projectionStatus: "PROJECTED_TO_EXCEED" }), statusRow("NOPROJ", { projectionStatus: "NOT_AVAILABLE" })],
);
assert.strictEqual(result.status, "READY");
assert.strictEqual(result.rankingApplicable, true);
assert.deepStrictEqual(result.executionPriority.map((row) => row.key), ["SHORT100", "SHORT50", "NONSHORT", "NOPROJ"]);
assert.deepStrictEqual(result.executionPriority.map((row) => row.priorityRank), [1, 2, 3, 4]);
assert.deepStrictEqual(result.executionPriority[0].priorityBasis, {
  projectionAvailable: true, projectionEvidence: "SHORTFALL", projectionGroup: 0,
  hasProjectedShortfall: true, projectedShortfallAmount: 100,
  paceAvailable: true, paceEvidence: "BEHIND", paceGroup: 0,
  behindPace: true, paceGapMagnitude: 20, budget: 500, stableKey: "SHORT100",
});
assert.strictEqual(result.executionPriority[2].priorityBasis.projectedShortfallAmount, 0);
assert.strictEqual(result.executionPriority[3].priorityBasis.projectedShortfallAmount, null);
assert.match(Priority.getPriorityExplanation(result.executionPriority[0]), /supplied projected Budget shortfall/);
assert.match(Priority.getPriorityExplanation(result.executionPriority[2]), /behind linear pace/);

result = build(
  [executionRow("PACE20", { projectedBudgetGap: -10, paceGap: -20, budget: 100 }), executionRow("PACE10", { projectedBudgetGap: -10, paceGap: -10, budget: 100 })],
  [statusRow("PACE10"), statusRow("PACE20")],
);
assert.deepStrictEqual(result.executionPriority.map((row) => row.key), ["PACE20", "PACE10"]);
result = build(
  [executionRow("BUDGET500", { projectedBudgetGap: -10, paceGap: -10, budget: 500 }), executionRow("BUDGET100", { projectedBudgetGap: -10, paceGap: -10, budget: 100 })],
  [statusRow("BUDGET100"), statusRow("BUDGET500")],
);
assert.deepStrictEqual(result.executionPriority.map((row) => row.key), ["BUDGET500", "BUDGET100"]);
result = build([executionRow("B_KEY"), executionRow("A_KEY")], [statusRow("B_KEY"), statusRow("A_KEY")]);
assert.deepStrictEqual(result.executionPriority.map((row) => row.key), ["A_KEY", "B_KEY"]);

result = build(
  [executionRow("BEHIND", { projectedBudgetGap: 1, paceGap: -1 }), executionRow("NONBEHIND", { projectedBudgetGap: 1, paceGap: 0 }), executionRow("NOPACE", { projectedBudgetGap: 1, paceGap: null })],
  [statusRow("BEHIND"), statusRow("NONBEHIND"), statusRow("NOPACE")],
);
assert.deepStrictEqual(result.executionPriority.map((row) => row.key), ["BEHIND", "NONBEHIND", "NOPACE"]);
assert.strictEqual(result.executionPriority[1].priorityBasis.paceGapMagnitude, 0);
assert.strictEqual(result.executionPriority[2].priorityBasis.paceGapMagnitude, null);
assert.strictEqual(result.summary.paceUnavailableCount, 1);
assert.ok(result.diagnostics.some((item) => item.code === "PACE_GAP_UNAVAILABLE" && item.key === "NOPACE"));

result = build(
  [executionRow("NEGATIVE", { actualToDate: -50, projectedMonthEndActual: -150, projectedBudgetGap: -250, paceGap: -80 })],
  [statusRow("NEGATIVE")],
);
assert.strictEqual(result.executionPriority[0].sourceMeasures.actualToDate, -50);
assert.strictEqual(result.executionPriority[0].priorityBasis.projectedShortfallAmount, 250);

const edgeExecution = [
  executionRow("DAY0"), executionRow("ACHIEVED"), executionRow("EXCEEDED"),
  executionRow("MISSING", { budget: null, projectedBudgetGap: null, paceGap: null }),
  executionRow("ZERO", { budget: 0 }), executionRow("COMMERCIAL"),
  executionRow("__UNMAPPED__"), executionRow("__UNASSIGNED__"),
];
const edgeStatus = [
  statusRow("DAY0", { executionAttention: false, projectionStatus: "NOT_AVAILABLE", paceStatus: "NO_OBSERVATIONS", attentionReasons: ["NO_OBSERVATIONS", "BUDGET_NOT_ACHIEVED"] }),
  statusRow("ACHIEVED", { executionAttention: false, budgetPositionStatus: "BUDGET_ACHIEVED", attentionReasons: ["BUDGET_ACHIEVED"] }),
  statusRow("EXCEEDED", { executionAttention: false, budgetPositionStatus: "BUDGET_EXCEEDED", attentionReasons: ["BUDGET_EXCEEDED"] }),
  statusRow("MISSING", { executionAttention: false, referenceAttention: true, budgetReferenceStatus: "BUDGET_MISSING", projectionStatus: "NOT_APPLICABLE", paceStatus: "NOT_APPLICABLE", attentionReasons: ["BUDGET_REFERENCE_MISSING"] }),
  statusRow("ZERO", { executionAttention: false, budgetReferenceStatus: "BUDGET_ZERO", attentionReasons: ["ZERO_BUDGET_REFERENCE"] }),
  statusRow("COMMERCIAL"), statusRow("__UNMAPPED__"), statusRow("__UNASSIGNED__"),
];
result = build(edgeExecution, edgeStatus);
assert.deepStrictEqual(result.executionPriority.map((row) => row.key), ["COMMERCIAL", "__UNASSIGNED__", "__UNMAPPED__"]);
assert.deepStrictEqual(result.referencePriority.map((row) => row.key), ["MISSING"]);
assert.deepStrictEqual(result.referencePriority.map((row) => row.priorityRank), [1]);
for (const key of ["DAY0", "ACHIEVED", "EXCEEDED", "ZERO"]) assert.ok(!result.executionPriority.some((row) => row.key === key), key);

result = build(
  [executionRow("NULL_BUDGET", { budget: null }), executionRow("ZERO_BUDGET", { budget: 0 }), executionRow("VALID")],
  [statusRow("NULL_BUDGET"), statusRow("ZERO_BUDGET"), statusRow("VALID")],
);
assert.strictEqual(result.status, "PARTIAL");
assert.deepStrictEqual(result.executionPriority.map((row) => row.key), ["VALID"]);
assert.strictEqual(result.summary.executionEligibleCount, 3);
assert.strictEqual(result.summary.executionRankedCount, 1);
assert.strictEqual(result.summary.executionMalformedCount, 2);
assert.strictEqual(result.diagnostics.filter((item) => item.code === "EXECUTION_ATTENTION_WITH_INVALID_BUDGET").length, 2);

result = build(
  [executionRow("INVALID"), executionRow("MISSING")],
  [
    statusRow("INVALID", { executionAttention: false, referenceAttention: true, attentionReasons: ["BUDGET_REFERENCE_INVALID"] }),
    statusRow("MISSING", { executionAttention: false, referenceAttention: true, attentionReasons: ["BUDGET_REFERENCE_MISSING"] }),
  ],
);
assert.deepStrictEqual(result.referencePriority.map((row) => [row.priorityRank, row.key, row.referenceReasonCode]), [[1, "INVALID", "BUDGET_REFERENCE_INVALID"], [2, "MISSING", "BUDGET_REFERENCE_MISSING"]]);
assert.match(Priority.getPriorityExplanation(result.referencePriority[0]), /canonical reference reason/);
result = build([executionRow("BROKEN")], [statusRow("BROKEN", { executionAttention: false, referenceAttention: true, attentionReasons: ["OTHER"] })]);
assert.strictEqual(result.status, "PARTIAL");
assert.strictEqual(result.summary.referenceMalformedCount, 1);
assert.ok(result.diagnostics.some((item) => item.code === "REFERENCE_ATTENTION_REASON_MISSING"));

for (const mismatch of [
  { execution: { selectedPeriod: "2026-09" }, expected: "PERIOD_MISMATCH" },
  { execution: { asOfDay: 11 }, expected: "AS_OF_MISMATCH" },
  { execution: { dimension: "BANK" }, expected: "DIMENSION_MISMATCH" },
]) {
  result = build([executionRow("A")], [statusRow("A")], { execution: mismatch.execution });
  assert.strictEqual(result.status, "INVALID_INPUT");
  assert.deepStrictEqual(result.executionPriority, []);
  assert.ok(result.diagnostics.some((item) => item.code === mismatch.expected));
}
result = build([executionRow("A"), executionRow("A")], [statusRow("A")]);
assert.strictEqual(result.status, "INVALID_INPUT");
assert.ok(result.diagnostics.some((item) => item.code === "EXECUTION_KEY_DUPLICATE"));
result = build([executionRow("A")], [statusRow("A"), statusRow("A")]);
assert.strictEqual(result.status, "INVALID_INPUT");
assert.ok(result.diagnostics.some((item) => item.code === "ATTENTION_KEY_DUPLICATE"));
assert.strictEqual(Priority.buildPriority(null, null).status, "INVALID_INPUT");
result = build([executionRow("A")], [statusRow("A")], { execution: { status: "INVALID_AS_OF" } });
assert.strictEqual(result.status, "INVALID_INPUT");
assert.ok(result.diagnostics.some((item) => item.code === "SOURCE_EXECUTION_STATUS_INVALID"));
result = build([executionRow("A")], [statusRow("A")], { status: { status: "INVALID_INPUT" } });
assert.strictEqual(result.status, "INVALID_INPUT");
assert.ok(result.diagnostics.some((item) => item.code === "SOURCE_ATTENTION_STATUS_INVALID"));
result = build([executionRow("A"), executionRow("EXEC_ONLY")], [statusRow("A"), statusRow("STATUS_ONLY")]);
assert.strictEqual(result.status, "PARTIAL");
assert.deepStrictEqual(result.executionPriority.map((row) => row.key), ["A"]);
assert.strictEqual(result.summary.unmatchedExecutionCount, 1);
assert.strictEqual(result.summary.unmatchedStatusCount, 1);

for (const dimension of ["BANK", "BRANCH", "STATE", "ZONE", "BANK_REGION", "BANK_ZONE", "FGM_OFFICE", "ASSIGNED_RM", "CSM", "ASM", "ZSM", "NATIONAL_HEAD"]) {
  result = build([executionRow("A")], [statusRow("A")], { execution: { dimension }, status: { dimension } });
  assert.strictEqual(result.dimension, dimension);
  assert.strictEqual(result.executionPriority[0].priorityRank, 1);
}
result = build([executionRow("ALL")], [statusRow("ALL")], { execution: { dimension: "OVERALL" }, status: { dimension: "OVERALL" } });
assert.strictEqual(result.rankingApplicable, false);
assert.deepStrictEqual(result.executionPriority, []);
assert.deepStrictEqual(result.referencePriority, []);
assert.ok(result.diagnostics.some((item) => item.code === "OVERALL_RANKING_NOT_APPLICABLE"));

const deterministicPair = inputs([executionRow("C"), executionRow("A"), executionRow("B")], [statusRow("B"), statusRow("C"), statusRow("A")]);
const executionSnapshot = JSON.stringify(deterministicPair.execution);
const statusSnapshot = JSON.stringify(deterministicPair.status);
const first = Priority.buildPriority(deterministicPair.execution, deterministicPair.status);
const second = Priority.buildPriority({ ...deterministicPair.execution, rows: [...deterministicPair.execution.rows].reverse() }, { ...deterministicPair.status, rows: [...deterministicPair.status.rows].reverse() });
assert.deepStrictEqual(first.executionPriority.map((row) => row.key), second.executionPriority.map((row) => row.key));
assert.deepStrictEqual(first.diagnostics, Priority.buildPriority(deterministicPair.execution, deterministicPair.status).diagnostics);
assert.strictEqual(JSON.stringify(deterministicPair.execution), executionSnapshot);
assert.strictEqual(JSON.stringify(deterministicPair.status), statusSnapshot);
assert.strictEqual(first.sourceExecutionStatus, "READY");
assert.strictEqual(first.sourceAttentionStatus, "READY");
result = build([executionRow("A")], [statusRow("A")], { execution: { status: "PARTIAL" }, status: { status: "PARTIAL" } });
assert.strictEqual(result.status, "PARTIAL");
assert.strictEqual(result.sourceExecutionStatus, "PARTIAL");
assert.strictEqual(result.sourceAttentionStatus, "PARTIAL");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
assert.ok(html.indexOf("commercialExecutionPriority.js") > html.indexOf("commercialExecutionStatus.js"));
assert.ok(html.indexOf("commercialExecutionPriority.js") < html.indexOf("commercialPerformanceUI.js"));
const source = fs.readFileSync(modulePath, "utf8");
for (const forbidden of ["Repository", "IndexedDB", "projectedAchievementPct)", "requiredDailyRunRate)", "potential)", "contribution", "priorityScore", "riskScore", "priorityBand", "top10", "slice(0, 10)", "Date.now", "new Date()", "workingDay", "recommendation", "notification", "RED", "AMBER", "GREEN", "severity"]) assert.ok(!source.includes(forbidden), forbidden);
for (const formula of [/actualToDate\s*\/\s*observedDays/, /budget\s*\*\s*observedDays/, /budget\s*-\s*actualToDate\)\s*\/\s*remainingDays/, /actualToDate\s*\/\s*observedDays\s*\*\s*daysInMonth/]) assert.doesNotMatch(source, formula);
assert.doesNotMatch(source, /executionAttention\s*=|referenceAttention\s*=/);
assert.match(fs.readFileSync(path.join(__dirname, "..", "README.md"), "utf8"), /Commercial execution prioritisation is a pure, on-demand authority/);
for (const untouched of ["js/analytics/commercialExecutionStatus.js", "js/analytics/commercialExecution.js", "js/analytics/commercialComparison.js", "js/analytics/dailyCommercialComparison.js", "js/activation.js", "js/scorecard.js", "js/productivity.js", "js/performance.js", "js/target.js", "js/core.js", "app.js"]) assert.strictEqual(require("child_process").execFileSync("git", ["diff", "--name-only", "--", untouched], { cwd: path.join(__dirname, ".."), encoding: "utf8" }).trim(), "", untouched);
console.log("Step 4S commercial execution priority tests passed: compatibility, durable joins, independent ordinal ranks, exact lexicographic ordering, null/signed edges, diagnostics, determinism, immutability, purity, and preservation.");
