/* Step 4I: commercial period scope and governed roll-up authority. */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

global.window = global;
function load(file) { vm.runInThisContext(fs.readFileSync(path.join(__dirname, "..", file), "utf8"), { filename: file }); }
load("js/config.js");
load("js/data/schema.js");
load("js/data/datasetRegistry.js");
load("js/enrichment/dateResolver.js");
load("js/masters/branchMaster.js");
load("js/masters/employeeMaster.js");
load("js/masters/hierarchyMaster.js");
load("js/enrichment/hierarchyResolver.js");
load("js/analytics/commercialPerformance.js");
load("js/analytics/commercialRollups.js");

const rollups = BancaTrackerCommercialRollups;
const performance = {
  status: "PARTIAL",
  rows: [
    { branchId: "B1", periodKey: "2026-03", canonicalBank: "BANK A", branchName: "One", stateId: "S1", stateName: "State 1", zoneId: "Z1", zoneName: "Zone 1", bankRegionId: "R1", bankRegionName: "Region 1", bankZoneId: "BZ1", bankZoneName: "Bank Zone 1", fgmOfficeId: "F1", fgmOfficeName: "FGM 1", assignedRmId: "RM1", assignedRmName: "RM One", csmId: "C1", csmName: "CSM One", asmId: "A1", asmName: "ASM One", zsmId: "ZSM1", zsmName: "ZSM One", nationalHeadId: "NH1", nationalHeadName: "NH One", actualPremium: 20, budget: 40, potential: 80, transactionCount: 1 },
    { branchId: "B1", periodKey: "2026-04", canonicalBank: "BANK A", branchName: "One", stateId: "S1", stateName: "State 1", zoneId: "Z1", zoneName: "Zone 1", bankRegionId: "R1", bankRegionName: "Region 1", bankZoneId: "BZ1", bankZoneName: "Bank Zone 1", fgmOfficeId: "F1", fgmOfficeName: "FGM 1", assignedRmId: "RM1", assignedRmName: "RM One", csmId: "C1", csmName: "CSM One", asmId: "A1", asmName: "ASM One", zsmId: "ZSM1", zsmName: "ZSM One", nationalHeadId: "NH1", nationalHeadName: "NH One", actualPremium: 50, budget: 100, potential: 200, transactionCount: 2 },
    { branchId: "B1", periodKey: "2026-05", canonicalBank: "BANK A", branchName: "One", stateId: "S1", stateName: "State 1", zoneId: "Z1", zoneName: "Zone 1", bankRegionId: "R1", bankRegionName: "Region 1", bankZoneId: "BZ1", bankZoneName: "Bank Zone 1", fgmOfficeId: "F1", fgmOfficeName: "FGM 1", assignedRmId: "RM1", assignedRmName: "RM One", csmId: "C1", csmName: "CSM One", asmId: "A1", asmName: "ASM One", zsmId: "ZSM1", zsmName: "ZSM One", nationalHeadId: "NH1", nationalHeadName: "NH One", actualPremium: -10, budget: 100, potential: 200, transactionCount: 1 },
    { branchId: "B2", periodKey: "2026-05", canonicalBank: "BANK A", branchName: "Two", actualPremium: 25, budget: null, potential: null, transactionCount: 1 },
    { branchId: "B3", periodKey: "2026-09", canonicalBank: "BANK B", branchName: "Three", actualPremium: 0, budget: 120, potential: 300, transactionCount: 0 },
  ],
  summary: { uniqueExcludedFactCount: 1, uniqueExcludedPremium: 7, unresolvedBranchRowsExcluded: 1, invalidDateRowsExcluded: 1, metadataConflictCount: 2 },
};

const original = JSON.stringify(performance.rows);
const periods = rollups.buildPeriodContext(performance);
assert.deepStrictEqual(periods.availablePeriods, ["2026-03", "2026-04", "2026-05", "2026-09"]);
assert.deepStrictEqual(periods.availableFinancialYears, ["FY2025-26", "FY2026-27"]);
assert.strictEqual(periods.latestAvailablePeriod, "2026-09");
assert.strictEqual(periods.latestActualPeriod, "2026-05");
assert.strictEqual(periods.defaultSelectedPeriod, "2026-09");
assert.strictEqual(rollups.getFinancialYear("2027-02"), "FY2026-27");
assert.deepStrictEqual(rollups.getPeriodRange({ type: "MONTH", periodKey: "2026-05" }).periods, ["2026-05"]);
assert.deepStrictEqual(rollups.getPeriodRange({ type: "YTD", periodKey: "2026-05" }).periods, ["2026-04", "2026-05"]);
assert.strictEqual(rollups.getPeriodRange({ type: "FY", financialYear: "FY2026-27" }).periods.length, 12);

const ytd = rollups.buildRollup(performance, { type: "YTD", periodKey: "2026-05" }, "BANK");
assert.strictEqual(ytd.rows.length, 1);
assert.strictEqual(ytd.rows[0].actualPremium, 65);
assert.strictEqual(ytd.rows[0].budget, 200);
assert.strictEqual(ytd.rows[0].potential, 400);
assert.strictEqual(ytd.rows[0].achievementPct, 32.5);
assert.strictEqual(ytd.rows[0].potentialPenetrationPct, 16.25);
assert.strictEqual(ytd.summary.expectedMonths, 2);
assert.deepStrictEqual(ytd.summary.missingMonths, []);
assert.strictEqual(ytd.summary.budgetMissingCount, 1);
assert.strictEqual(ytd.diagnostics.uniqueExcludedFactCount, 1);
assert.strictEqual(ytd.diagnostics.uniqueExcludedPremium, 7);
assert.strictEqual(ytd.diagnostics.unmappedDimensionCounts.ZONE, 1);

const future = rollups.buildRollup(performance, { type: "MONTH", periodKey: "2026-09" }, "BRANCH");
assert.strictEqual(future.rows[0].actualPremium, 0);
assert.strictEqual(future.rows[0].budget, 120);
const actualOnly = rollups.buildRollup(performance, { type: "MONTH", periodKey: "2026-05" }, "BRANCH").rows.find((row) => row.key === "B2");
assert.strictEqual(actualOnly.actualPremium, 25);
assert.strictEqual(actualOnly.budget, null);

for (const dimension of rollups.DIMENSIONS) {
  const result = rollups.buildRollup(performance, { type: "MONTH", periodKey: "2026-05" }, dimension);
  assert.ok(Array.isArray(result.rows), dimension);
}
assert.ok(rollups.buildRollup(performance, { type: "MONTH", periodKey: "2026-05" }, "ZONE").rows.some((row) => row.key === rollups.UNMAPPED_KEY));
assert.ok(rollups.buildRollup(performance, { type: "MONTH", periodKey: "2026-05" }, "ASSIGNED_RM").rows.some((row) => row.key === rollups.UNASSIGNED_KEY));

const governed = rollups.attachMetadata([{ branchId: "B4", canonicalBank: "LEGACY", actualPremium: 0 }], new Map([["B4", { canonicalBank: "GOVERNED", zoneId: "ZG", zoneName: "Governed Zone", assignedRmId: null }]]));
assert.strictEqual(governed[0].canonicalBank, "GOVERNED");
assert.strictEqual(governed[0].zoneId, "ZG");
assert.strictEqual(JSON.stringify(performance.rows), original);

const exclusions = BancaTrackerCommercialPerformance.buildActuals([
  { premium: 10 },
  { branchId: "B1", premium: 5 },
]);
assert.strictEqual(exclusions.diagnostics.unresolvedBranchRowsExcluded, 1);
assert.strictEqual(exclusions.diagnostics.invalidDateRowsExcluded, 2);
assert.strictEqual(exclusions.diagnostics.uniqueExcludedFactCount, 2);
assert.strictEqual(exclusions.diagnostics.uniqueExcludedPremium, 15);

const conflicts = BancaTrackerCommercialPerformance.buildActuals([
  { branchId: "B1", monthKey: "2026-05", premium: 1, zoneId: "Z1" },
  { branchId: "B1", monthKey: "2026-05", premium: 2, zoneId: "Z2" },
]);
assert.strictEqual(conflicts.rows[0].zoneId, "Z1");
assert.strictEqual(conflicts.diagnostics.metadataConflictCount, 1);

const qualitySource = fs.readFileSync(path.join(__dirname, "..", "js/canonicalDataQuality.js"), "utf8");
for (const label of ["Commercial Available Periods", "Commercial Latest Available", "Commercial Latest Actual", "Commercial Financial Years", "Commercial Unique Excluded Facts", "Commercial Missing Branch", "Commercial Missing Period", "Commercial Metadata Conflicts", "Commercial Unmapped Dimensions"]) {
  assert.ok(qualitySource.includes(label), label);
}

console.log("Step 4I commercial period and roll-up tests passed: period/FY scopes, all governed dimensions, ratio-of-sums, coverage, zero/actual-only rows, cached metadata precedence, exclusions, conflicts, and immutability.");
