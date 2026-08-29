/* Step 4V: governed commercial execution drill-down authority. */
"use strict";
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const childProcess = require("child_process");
global.window = global;

const dimensions = ["OVERALL", "BANK", "BRANCH", "STATE", "ZONE", "BANK_REGION", "BANK_ZONE", "FGM_OFFICE", "ASSIGNED_RM", "CSM", "ASM", "ZSM", "NATIONAL_HEAD"];
const fields = {
  BANK: ["canonicalBank", "canonicalBank", "__UNMAPPED__"], BRANCH: ["branchId", "branchName", "__UNMAPPED__"],
  STATE: ["stateId", "stateName", "__UNMAPPED__"], ZONE: ["zoneId", "zoneName", "__UNMAPPED__"],
  BANK_REGION: ["bankRegionId", "bankRegionName", "__UNMAPPED__"], BANK_ZONE: ["bankZoneId", "bankZoneName", "__UNMAPPED__"],
  FGM_OFFICE: ["fgmOfficeId", "fgmOfficeName", "__UNMAPPED__"], ASSIGNED_RM: ["assignedRmId", "assignedRmName", "__UNASSIGNED__"],
  CSM: ["csmId", "csmName", "__UNASSIGNED__"], ASM: ["asmId", "asmName", "__UNASSIGNED__"],
  ZSM: ["zsmId", "zsmName", "__UNASSIGNED__"], NATIONAL_HEAD: ["nationalHeadId", "nationalHeadName", "__UNASSIGNED__"],
};

let lastExecutionOptions = null;
global.BancaTrackerCommercialRollups = {
  DIMENSIONS: dimensions, UNMAPPED_KEY: "__UNMAPPED__", UNASSIGNED_KEY: "__UNASSIGNED__",
  buildMetadataIndex: () => new Map(), attachMetadata: (rows) => rows.map((row) => ({ ...row })),
  getDimensionValue(row, dimension) {
    if (dimension === "OVERALL") return { key: "ALL", label: "Overall" };
    const [keyField, labelField, missing] = fields[dimension];
    const key = row[keyField];
    return key ? { key, label: row[labelField] || key } : { key: missing, label: missing };
  },
  buildPeriodContext: () => ({ status: "READY", availablePeriods: ["2026-08"] }),
};

global.BancaTrackerCommercialExecution = {
  buildExecution(options) {
    lastExecutionOptions = options;
    const grouped = new Map();
    const ensure = (source) => {
      const value = BancaTrackerCommercialRollups.getDimensionValue(source, options.dimension);
      if (!grouped.has(value.key)) grouped.set(value.key, { key: value.key, label: value.label, actualToDate: 0, budget: null, budgetParts: [], referenceStatus: "NONE", paceGap: -1, projectedBudgetGap: -1, projectedMonthEndActual: 1, projectedAchievementPct: 1, requiredDailyRunRate: 1 });
      return grouped.get(value.key);
    };
    options.facts.forEach((fact) => { if (fact.monthKey === options.selectedPeriod && Number(fact.day) <= options.asOfDay) ensure(fact).actualToDate += Number(fact.premium) || 0; });
    options.performanceResult.rows.filter((row) => row.periodKey === options.selectedPeriod).forEach((row) => {
      const target = ensure(row); target.budgetParts.push(row.budget);
    });
    grouped.forEach((row) => {
      const present = row.budgetParts.filter((value) => value !== null);
      row.budget = present.length ? present.reduce((sum, value) => sum + value, 0) : null;
      row.referenceStatus = row.budgetParts.length && present.length === row.budgetParts.length ? "COMPLETE" : present.length ? "PARTIAL" : "NONE";
      delete row.budgetParts;
    });
    const rows = [...grouped.values()].sort((a, b) => a.key.localeCompare(b.key));
    return { status: rows.some((row) => row.budget === null || row.referenceStatus !== "COMPLETE") ? "PARTIAL" : rows.length ? "READY" : "NO_FACT_DATA", selectedPeriod: options.selectedPeriod, asOfDay: options.asOfDay, dimension: options.dimension, rows, diagnostics: {} };
  },
};
global.BancaTrackerCommercialExecutionStatus = {
  buildStatus(execution) {
    const rows = execution.rows.map((row) => ({ key: row.key, label: row.label, executionAttention: row.budget !== null && row.actualToDate < row.budget, referenceAttention: row.budget === null, attentionReasons: row.budget === null ? ["BUDGET_REFERENCE_MISSING"] : ["BEHIND_LINEAR_PACE"] }));
    return { status: rows.length ? execution.status === "READY" ? "READY" : "PARTIAL" : "NO_ROWS", periodKey: execution.selectedPeriod, asOfDay: execution.asOfDay, dimension: execution.dimension, rows };
  },
};
global.BancaTrackerCommercialExecutionPriority = {
  buildPriority(execution, status) {
    const attention = status.rows.filter((row) => row.executionAttention).sort((a, b) => a.key.localeCompare(b.key));
    const reference = status.rows.filter((row) => row.referenceAttention).sort((a, b) => a.key.localeCompare(b.key));
    return {
      status: execution.rows.length ? execution.status === "READY" ? "READY" : "PARTIAL" : "READY",
      periodKey: execution.selectedPeriod, asOfDay: execution.asOfDay, dimension: execution.dimension,
      executionPriority: attention.map((row, index) => ({ key: row.key, priorityRank: index + 1 })),
      referencePriority: reference.map((row, index) => ({ key: row.key, priorityRank: index + 1 })),
    };
  },
};

const modulePath = path.join(__dirname, "..", "js/analytics/commercialExecutionDrilldown.js");
vm.runInThisContext(fs.readFileSync(modulePath, "utf8"), { filename: "commercialExecutionDrilldown.js" });
const Drilldown = BancaTrackerCommercialExecutionDrilldown;
for (const name of ["getAllowedDrilldowns", "validateDrilldown", "buildDrilldown"]) assert.strictEqual(typeof Drilldown[name], "function", name);

const pathMap = {
  OVERALL: ["BANK"], BANK: ["ZONE", "STATE", "BANK_REGION", "BANK_ZONE", "FGM_OFFICE", "BRANCH"],
  ZONE: ["STATE", "BRANCH"], STATE: ["BRANCH"], BANK_REGION: ["BRANCH"], BANK_ZONE: ["BRANCH"], FGM_OFFICE: ["BRANCH"],
  NATIONAL_HEAD: ["ZSM"], ZSM: ["ASM"], ASM: ["CSM"], CSM: ["ASSIGNED_RM"], ASSIGNED_RM: ["BRANCH"], BRANCH: [],
};
Object.entries(pathMap).forEach(([parent, children]) => assert.deepStrictEqual(Drilldown.getAllowedDrilldowns(parent), children));
for (const [parent, children] of Object.entries(pathMap)) children.forEach((child) => assert.strictEqual(Drilldown.validateDrilldown({ parentDimension: parent, childDimension: child }).valid, true, `${parent}:${child}`));
for (const [parent, child] of [["BRANCH", "ZSM"], ["ASSIGNED_RM", "NATIONAL_HEAD"], ["STATE", "NATIONAL_HEAD"], ["OVERALL", "STATE"], ["ZSM", "CSM"]]) assert.strictEqual(Drilldown.validateDrilldown({ parentDimension: parent, childDimension: child }).status, "INVALID_DRILLDOWN");

function identityRow(parentDimension, parentKey, childDimension, childKey, overrides = {}) {
  const row = { periodKey: "2026-08", budget: 100, ...overrides };
  if (parentDimension !== "OVERALL") {
    row[fields[parentDimension][0]] = parentKey;
    if (fields[parentDimension][1] !== fields[parentDimension][0]) row[fields[parentDimension][1]] = overrides.parentLabel || `Parent ${parentKey}`;
  }
  if (childDimension !== "OVERALL") {
    row[fields[childDimension][0]] = childKey;
    if (fields[childDimension][1] !== fields[childDimension][0]) row[fields[childDimension][1]] = overrides.childLabel || `Child ${childKey}`;
  }
  return row;
}
function build(parentDimension, parentKey, childDimension, performanceRows, facts, parentOverrides = {}, optionOverrides = {}) {
  const parentActual = facts.filter((row) => parentDimension === "OVERALL" || BancaTrackerCommercialRollups.getDimensionValue(row, parentDimension).key === parentKey).reduce((sum, row) => sum + (Number(row.day) <= 10 ? Number(row.premium) || 0 : 0), 0);
  const parentBudgetRows = performanceRows.filter((row) => parentDimension === "OVERALL" || BancaTrackerCommercialRollups.getDimensionValue(row, parentDimension).key === parentKey);
  const parentBudget = parentBudgetRows.some((row) => row.budget === null) ? parentOverrides.budget === undefined ? null : parentOverrides.budget : parentBudgetRows.reduce((sum, row) => sum + row.budget, 0);
  return Drilldown.buildDrilldown({
    parentSelection: { parentDimension, parentKey, parentLabel: parentOverrides.label || "Selected Parent" }, childDimension,
    parentExecutionResult: { status: "READY", selectedPeriod: "2026-08", asOfDay: 10, dimension: parentDimension, rows: [{ key: parentKey, label: "Authority Parent", actualToDate: parentOverrides.actualToDate === undefined ? parentActual : parentOverrides.actualToDate, budget: parentOverrides.budget === undefined ? parentBudget : parentOverrides.budget, referenceStatus: parentOverrides.referenceStatus || "COMPLETE", executionAttention: true, priorityRank: 99 }] },
    performanceResult: { status: "READY", rows: performanceRows, summary: {} }, facts, authorityContext: {}, ...optionOverrides,
  });
}

for (const [parent, children] of Object.entries(pathMap)) children.forEach((child) => {
  const parentKey = parent === "OVERALL" ? "ALL" : "P";
  const perf = [identityRow(parent, parentKey, child, "C")];
  const facts = [{ ...identityRow(parent, parentKey, child, "C"), monthKey: "2026-08", day: 5, premium: 10 }];
  const result = build(parent, parentKey, child, perf, facts);
  assert.ok(["READY", "PARTIAL"].includes(result.status), `${parent}:${child}:${result.status}`);
  assert.deepStrictEqual(result.rows.map((row) => row.key), ["C"]);
  assert.strictEqual(result.scope.parentKey, parentKey);
});

let perf = [identityRow("ZSM", "Z1", "ASM", "A1"), identityRow("ZSM", "Z2", "ASM", "A1", { childLabel: "Duplicate ASM label" })];
let facts = [
  { ...perf[0], monthKey: "2026-08", day: 2, premium: 10 },
  { ...perf[1], monthKey: "2026-08", day: 2, premium: 999 },
];
let result = build("ZSM", "Z1", "ASM", perf, facts);
assert.strictEqual(result.rows.length, 1);
assert.strictEqual(result.rows[0].execution.actualToDate, 10);
assert.strictEqual(lastExecutionOptions.facts.length, 1);
assert.strictEqual(lastExecutionOptions.performanceResult.rows.length, 1);
assert.strictEqual(result.reconciliation.actual.difference, 0);
assert.ok(result.diagnostics.some((item) => item.code === "CURRENT_HIERARCHY_SNAPSHOT"));

perf = [identityRow("BANK", "BANK1", "BRANCH", "B1", { childLabel: "Same Branch" }), identityRow("BANK", "BANK2", "BRANCH", "B2", { childLabel: "Same Branch" })];
facts = perf.map((row, index) => ({ ...row, monthKey: "2026-08", day: 2, premium: index + 1 }));
result = build("BANK", "BANK1", "BRANCH", perf, facts);
assert.deepStrictEqual(result.rows.map((row) => row.key), ["B1"]);
assert.strictEqual(result.parent.label, "Selected Parent");

perf = [identityRow("BANK", "BANK1", "BRANCH", "B1"), identityRow("BANK", "BANK1", "BRANCH", "B2")];
facts = [{ ...perf[0], monthKey: "2026-08", day: 2, premium: -25 }, { ...perf[1], monthKey: "2026-08", day: 2, premium: 5 }];
result = build("BANK", "BANK1", "BRANCH", perf, facts);
assert.deepStrictEqual(result.reconciliation.actual, { parent: -20, children: -20, difference: 0, complete: true, status: "RECONCILED" });
assert.deepStrictEqual(result.reconciliation.budget, { parent: 200, children: 200, difference: 0, complete: true, status: "RECONCILED", missingChildCount: 0 });
assert.strictEqual(result.rows[0].attention.executionAttention, true);
assert.strictEqual(result.rows[0].priority.execution.priorityRank, 1);
assert.strictEqual(result.rows[0].priority.execution.priorityRank === 99, false);
assert.strictEqual(result.rows[0].attention.executionAttention === result.parent.executionAttention, false);
assert.strictEqual(Object.prototype.hasOwnProperty.call(result.reconciliation, "paceAchievementPct"), false);

perf = [identityRow("BANK", "BANK1", "BRANCH", "B1", { budget: null })];
facts = [{ ...perf[0], monthKey: "2026-08", day: 2, premium: 0 }];
result = build("BANK", "BANK1", "BRANCH", perf, facts, { budget: null, referenceStatus: "NONE" });
assert.strictEqual(result.reconciliation.budget.children, null);
assert.strictEqual(result.reconciliation.budget.difference, null);
assert.strictEqual(result.rows[0].execution.budget, null);
assert.strictEqual(result.rows[0].attention.referenceAttention, true);

perf = [identityRow("BANK", "BANK1", "STATE", null)];
facts = [{ ...perf[0], monthKey: "2026-08", day: 2, premium: 1 }];
result = build("BANK", "BANK1", "STATE", perf, facts);
assert.strictEqual(result.rows[0].key, "__UNMAPPED__");
assert.ok(result.diagnostics.some((item) => item.code === "SENTINEL_CHILD_RETAINED"));
perf = [identityRow("CSM", "C1", "ASSIGNED_RM", null)];
facts = [{ ...perf[0], monthKey: "2026-08", day: 2, premium: 1 }];
result = build("CSM", "C1", "ASSIGNED_RM", perf, facts);
assert.strictEqual(result.rows[0].key, "__UNASSIGNED__");

result = build("BANK", "MISSING", "BRANCH", [], [], { actualToDate: 0, budget: null });
assert.strictEqual(result.status, "EMPTY");
assert.deepStrictEqual(result.rows, []);
assert.ok(result.diagnostics.some((item) => item.code === "CHILDREN_EMPTY"));
result = Drilldown.buildDrilldown({ parentSelection: { parentDimension: "BANK", parentKey: "NOPE" }, childDimension: "BRANCH", parentExecutionResult: { status: "READY", selectedPeriod: "2026-08", asOfDay: 10, dimension: "BANK", rows: [] } });
assert.strictEqual(result.status, "PARENT_NOT_FOUND");
assert.strictEqual(Drilldown.buildDrilldown({ parentSelection: { parentDimension: "BRANCH", parentKey: "B1" }, childDimension: "ZSM" }).status, "INVALID_DRILLDOWN");
assert.strictEqual(Drilldown.buildDrilldown({ parentSelection: { parentDimension: "BANK", parentLabel: "Label only" }, childDimension: "BRANCH" }).status, "INVALID_INPUT");

perf = [identityRow("BANK", "BANK1", "BRANCH", "B1")];
facts = [{ ...perf[0], monthKey: "2026-08", day: 2, premium: 10 }];
assert.strictEqual(build("BANK", "BANK1", "BRANCH", perf, facts, {}, { periodKey: "2026-09" }).status, "INVALID_INPUT");
assert.strictEqual(build("BANK", "BANK1", "BRANCH", perf, facts, {}, { asOfDay: 9 }).status, "INVALID_INPUT");
const perfSnapshot = JSON.stringify(perf); const factSnapshot = JSON.stringify(facts);
const first = build("BANK", "BANK1", "BRANCH", perf, facts);
const second = build("BANK", "BANK1", "BRANCH", [...perf].reverse(), [...facts].reverse());
assert.deepStrictEqual(first, second);
assert.strictEqual(JSON.stringify(perf), perfSnapshot);
assert.strictEqual(JSON.stringify(facts), factSnapshot);

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
assert.ok(html.indexOf("commercialExecutionDrilldown.js") > html.indexOf("commercialExecutionPriority.js"));
assert.ok(html.indexOf("commercialExecutionDrilldown.js") < html.indexOf("commercialPerformanceUI.js"));
const source = fs.readFileSync(modulePath, "utf8");
for (const forbidden of ["Repository", "IndexedDB", "commercialPerformanceUI", "style.css", "priorityScore", "riskScore", "RAG", "recommendation", "alert(", "Top-N", "workingDay", "forecastConfidence", "product", "lineOfBusiness"]) assert.ok(!source.includes(forbidden), forbidden);
assert.doesNotMatch(source, /getDimensionValue\([^\n]+\)\.label/);
assert.match(source, /getDimensionValue\(enriched, parentDimension\)\.key === parentKey/);
assert.ok(source.indexOf("scopeRows(facts") < source.indexOf("buildExecution({"));
for (const untouched of ["js/analytics/commercialExecution.js", "js/analytics/commercialExecutionStatus.js", "js/analytics/commercialExecutionPriority.js", "js/commercialPerformanceUI.js", "style.css"]) assert.strictEqual(childProcess.execFileSync("git", ["diff", "--name-only", "--", untouched], { cwd: path.join(__dirname, ".."), encoding: "utf8" }).trim(), "", untouched);
assert.match(fs.readFileSync(path.join(__dirname, "..", "README.md"), "utf8"), /Commercial execution drill-down is a pure parent-scoped orchestration authority/);
console.log("Step 4V commercial execution drill-down tests passed: approved paths, durable parent scoping, leakage prevention, authority composition, reconciliation, diagnostics, purity, immutability, and preservation.");
