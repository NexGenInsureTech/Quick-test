/* Step 4Y: governed commercial LOB/Product driver analysis authority. */
"use strict";
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const childProcess = require("child_process");
global.window = global;

const dimensions = ["OVERALL", "BANK", "ZONE", "STATE", "BANK_REGION", "BANK_ZONE", "FGM_OFFICE", "NATIONAL_HEAD", "ZSM", "ASM", "CSM", "ASSIGNED_RM", "BRANCH"];
const fields = { BANK: "canonicalBank", ZONE: "zoneId", STATE: "stateId", BANK_REGION: "bankRegionId", BANK_ZONE: "bankZoneId", FGM_OFFICE: "fgmOfficeId", NATIONAL_HEAD: "nationalHeadId", ZSM: "zsmId", ASM: "asmId", CSM: "csmId", ASSIGNED_RM: "assignedRmId", BRANCH: "branchId" };
global.BancaTrackerCommercialRollups = {
  buildMetadataIndex() { return new Map(); }, attachMetadata(rows) { return rows.map((row) => ({ ...row })); },
  getDimensionValue(row, dimension) { return dimension === "OVERALL" ? { key: "ALL", label: "Overall" } : { key: row[fields[dimension]] || "__UNMAPPED__", label: row[fields[dimension]] || "Unmapped" }; },
};
global.BancaTrackerCommercialExecution = { getDaysInPeriod(period) { return period === "2026-02" ? 28 : 31; } };
const modulePath = path.join(__dirname, "..", "js/analytics/commercialDriverAnalysis.js");
vm.runInThisContext(fs.readFileSync(modulePath, "utf8"), { filename: "commercialDriverAnalysis.js" });
const Drivers = BancaTrackerCommercialDriverAnalysis;
assert.deepStrictEqual(Drivers.getSupportedDriverDimensions(), ["LOB", "PRODUCT"]);

function fact(overrides = {}) { return { monthKey: "2026-08", day: 5, premium: 10, canonicalBank: "B1", zoneId: "Z1", stateId: "S1", bankRegionId: "R1", bankZoneId: "BZ1", fgmOfficeId: "F1", nationalHeadId: "N1", zsmId: "ZSM1", asmId: "A1", csmId: "C1", assignedRmId: "RM1", branchId: "BR1", lob: " Motor ", productCode: " p1 ", productName: "Product One", ...overrides }; }
function executionParent(dimension, key, actual, overrides = {}) { return { status: "READY", selectedPeriod: "2026-08", asOfDay: 10, dimension, rows: [{ key, label: "Same display label", actualToDate: actual, ...overrides }] }; }
function comparisonParent(dimension, key, baseActual, comparisonActual) { return { status: "READY", dimension, rows: [{ key, label: "Same display label", baseActual, comparisonActual, change: comparisonActual - baseActual }] }; }
function execution(options = {}) { return Drivers.buildExecutionDrivers({ parentSelection: { parentDimension: "BANK", parentKey: "B1", parentLabel: "Same display label" }, periodKey: "2026-08", asOfDay: 10, driverDimension: "LOB", facts: [fact()], parentExecutionResult: executionParent("BANK", "B1", 10), ...options }); }
function comparison(options = {}) { return Drivers.buildComparisonDrivers({ parentSelection: { parentDimension: "BANK", parentKey: "B1", parentLabel: "Same display label" }, basePeriod: "2026-07", comparisonPeriod: "2026-08", driverDimension: "LOB", facts: [fact({ monthKey: "2026-07", premium: 10 }), fact({ monthKey: "2026-08", premium: 25 })], parentComparisonResult: comparisonParent("BANK", "B1", 10, 25), ...options }); }

let result = execution();
assert.strictEqual(result.status, "READY");
assert.strictEqual(result.mode, "EXECUTION_SNAPSHOT");
assert.deepStrictEqual(result.rows.map((row) => [row.key, row.label, row.actual, row.contributionPercent]), [["LOB:Motor", "Motor", 10, 100]]);
assert.deepStrictEqual(result.reconciliation, { parentActual: 10, driverActual: 10, difference: 0, complete: true });
result = execution({ driverDimension: "PRODUCT" });
assert.strictEqual(result.rows[0].key, "PRODUCT_CODE:P1");
assert.strictEqual(result.rows[0].label, "Product One");
assert.strictEqual(execution({ driverDimension: "PRODUCT", facts: [fact({ productCode: null, productName: " Name only " })] }).rows[0].key, "PRODUCT_NAME:Name only");
assert.strictEqual(execution({ driverDimension: "OTHER" }).status, "UNSUPPORTED_DRIVER");
assert.strictEqual(execution({ parentSelection: { parentDimension: "PRODUCT", parentKey: "X" } }).status, "INVALID_PARENT");

for (const dimension of dimensions) {
  const key = dimension === "OVERALL" ? "ALL" : fact()[fields[dimension]];
  result = execution({ parentSelection: { parentDimension: dimension, parentKey: key }, parentExecutionResult: executionParent(dimension, key, 10) });
  assert.ok(["READY", "PARTIAL"].includes(result.status), dimension);
}

const leaked = [fact({ premium: 10, canonicalBank: "B1", lob: "Motor" }), fact({ premium: 999, canonicalBank: "B2", lob: "Motor" })];
result = execution({ facts: leaked, parentExecutionResult: executionParent("BANK", "B1", 10) });
assert.strictEqual(result.rows[0].actual, 10);
assert.strictEqual(result.parent.actual, 10);
result = execution({ parentSelection: { parentDimension: "OVERALL", parentKey: "ALL" }, facts: leaked, parentExecutionResult: executionParent("OVERALL", "ALL", 1009) });
assert.strictEqual(result.rows[0].actual, 1009);
result = execution({ facts: [fact({ canonicalBank: "B1", lob: null }), fact({ canonicalBank: "B2", lob: "Motor" })], parentExecutionResult: executionParent("BANK", "B1", 10) });
assert.strictEqual(result.rows[0].key, "__UNMAPPED__");
assert.ok(result.diagnostics.some((item) => item.code === "DRIVER_UNMAPPED"));

assert.strictEqual(execution({ asOfDay: 0, parentExecutionResult: executionParent("BANK", "B1", 0) }).status, "EMPTY");
assert.strictEqual(execution({ asOfDay: 32 }).status, "INVALID_AS_OF");
assert.strictEqual(execution({ periodKey: "bad" }).status, "INVALID_PERIOD");
assert.strictEqual(execution({ parentExecutionResult: executionParent("BANK", "NOPE", 10) }).status, "PARENT_NOT_FOUND");
assert.strictEqual(execution({ facts: [], parentExecutionResult: executionParent("BANK", "B1", 0) }).status, "EMPTY");

result = execution({ facts: [fact({ premium: 20, lob: "Positive" }), fact({ premium: -5, lob: "Negative" })], parentExecutionResult: executionParent("BANK", "B1", 15) });
assert.deepStrictEqual(result.rows.map((row) => [row.key, row.actual, row.contributionPercent]), [["LOB:Positive", 20, 133.33333333333331], ["LOB:Negative", -5, -33.33333333333333]]);
assert.ok(execution({ facts: [fact({ premium: 0 })], parentExecutionResult: executionParent("BANK", "B1", 0) }).rows.every((row) => row.contributionPercent === null));
assert.ok(execution({ facts: [fact({ premium: -5 })], parentExecutionResult: executionParent("BANK", "B1", -5) }).rows.every((row) => row.contributionPercent === null));

result = comparison();
assert.strictEqual(result.status, "READY");
assert.strictEqual(result.mode, "MONTH_COMPARISON");
assert.deepStrictEqual(result.rows.map((row) => [row.key, row.baseActual, row.comparisonActual, row.change, row.growthPercent, row.direction, row.presenceStatus]), [["LOB:Motor", 10, 25, 15, 150, "UP", "BOTH"]]);
assert.deepStrictEqual(result.reconciliation, {
  base: { parent: 10, drivers: 10, difference: 0, complete: true },
  comparison: { parent: 25, drivers: 25, difference: 0, complete: true },
  change: { parent: 15, drivers: 15, difference: 0, complete: true },
});
result = comparison({ facts: [fact({ monthKey: "2026-07", lob: "Base", premium: 10 }), fact({ monthKey: "2026-08", lob: "Comparison", premium: -5 })], parentComparisonResult: comparisonParent("BANK", "B1", 10, -5) });
assert.deepStrictEqual(result.rows.map((row) => [row.key, row.presenceStatus, row.growthPercent, row.direction]), [["LOB:Base", "BASE_ONLY", -100, "DOWN"], ["LOB:Comparison", "COMPARISON_ONLY", null, "DOWN"]]);
result = comparison({ facts: [fact({ monthKey: "2026-07", lob: "Zero", premium: 0 }), fact({ monthKey: "2026-08", lob: "Zero", premium: 2 })], parentComparisonResult: comparisonParent("BANK", "B1", 0, 2) });
assert.strictEqual(result.rows[0].growthPercent, null);
assert.strictEqual(result.rows[0].direction, "UP");
result = comparison({ facts: [fact({ monthKey: "2026-07", lob: "Negative", premium: -2 }), fact({ monthKey: "2026-08", lob: "Negative", premium: -2 })], parentComparisonResult: comparisonParent("BANK", "B1", -2, -2) });
assert.strictEqual(result.rows[0].growthPercent, null);
assert.strictEqual(result.rows[0].direction, "FLAT");
assert.strictEqual(comparison({ basePeriod: "bad" }).status, "INVALID_PERIOD");
assert.strictEqual(comparison({ parentComparisonResult: comparisonParent("BANK", "NOPE", 0, 0) }).status, "PARENT_NOT_FOUND");

for (const row of execution().rows) for (const forbidden of ["budget", "potential", "achievement", "requiredDailyRunRate", "executionAttention", "referenceAttention", "priorityRank"]) assert.strictEqual(Object.prototype.hasOwnProperty.call(row, forbidden), false, forbidden);
for (const row of comparison().rows) assert.strictEqual(Object.prototype.hasOwnProperty.call(row, "priorityRank"), false);
assert.strictEqual(Object.prototype.hasOwnProperty.call(comparison().rows[0], "changeContributionPercent"), false);
const sourceFacts = [fact({ lob: "Z", premium: 4 }), fact({ lob: "A", premium: 10 })];
const factSnapshot = JSON.stringify(sourceFacts);
const first = execution({ facts: sourceFacts, parentExecutionResult: executionParent("BANK", "B1", 14) });
const second = execution({ facts: [...sourceFacts].reverse(), parentExecutionResult: executionParent("BANK", "B1", 14) });
assert.deepStrictEqual(first, second);
assert.strictEqual(JSON.stringify(sourceFacts), factSnapshot);

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
assert.ok(html.indexOf("commercialDriverAnalysis.js") > html.indexOf("commercialExecutionDrilldown.js"));
const source = fs.readFileSync(modulePath, "utf8");
for (const forbidden of ["Repository", "IndexedDB", "commercialPerformanceUI", "style.css", "priorityRank", "executionAttention", "referenceAttention", "Top-N", "workingDay", "forecastConfidence", "recommendation", "alert("]) assert.ok(!source.includes(forbidden), forbidden);
assert.doesNotMatch(source, /getDimensionValue\([^\n]+\)\.label/);
assert.match(source, /getDimensionValue\(fact, parentSelection\.parentDimension\)\.key === parentSelection\.parentKey/);
assert.ok(source.indexOf("enrichAndScope") < source.indexOf("aggregate(eligible"));
for (const untouched of ["js/analytics/commercialExecutionDrilldown.js", "js/analytics/commercialExecutionPriority.js", "js/analytics/commercialExecutionStatus.js", "js/analytics/commercialExecution.js", "js/analytics/commercialComparison.js", "js/commercialPerformanceUI.js", "style.css", "js/activation.js", "js/scorecard.js", "js/productivity.js", "js/performance.js", "js/target.js", "js/core.js", "app.js"]) assert.strictEqual(childProcess.execFileSync("git", ["diff", "--name-only", "--", untouched], { cwd: path.join(__dirname, ".."), encoding: "utf8" }).trim(), "", untouched);
assert.match(fs.readFileSync(path.join(__dirname, "..", "README.md"), "utf8"), /Commercial driver analysis is a pure, parent-scoped authority/);
console.log("Step 4Y commercial driver analysis tests passed: independent drivers, durable parent scoping, signed execution/comparison decomposition, reconciliation, purity, immutability, and preservation.");
