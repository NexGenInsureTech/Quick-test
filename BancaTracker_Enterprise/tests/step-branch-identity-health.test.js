/* Increment B: pure, aggregate Branch Identity Health authority. */
"use strict";

const assert = require("assert");
const path = require("path");
global.window = global;
const load = (file) => require(path.join(__dirname, "..", file));
[
  "js/config.js",
  "js/data/schema.js",
  "js/data/datasetRegistry.js",
  "js/enrichment/dateResolver.js",
  "js/masters/branchMaster.js",
  "js/masters/branchAssignmentMaster.js",
  "js/masters/branchBudgetPotentialMaster.js",
  "js/diagnostics/branchIdentityHealth.js",
].forEach(load);

const Authority = BancaTrackerBranchIdentityHealth;
const BranchMaster = BancaTrackerBranchMaster;
const pointer = "BRANCH_MASTER:HEALTH";
const activeDataset = { datasetId: pointer, rowCount: 12 };
const master = (bankId, branchCode, active = true) => ({
  datasetId: pointer,
  bankId,
  branchCode,
  branchId: BranchMaster.buildBranchId(bankId, branchCode),
  active,
});
const imported = (bankId, branchCode, periodKey = "2026-04") => ({
  bankId,
  branchCode,
  branchId: bankId && branchCode ? BranchMaster.buildBranchId(bankId, branchCode) : null,
  periodKey,
});

const masterRecords = [
  master("IB", "001"),
  master("IB", "002", false),
  master("INDIAN BANK", "003"),
  master("OTHER", "0004"),
  master("OTHER", "AbC"),
  master("OTHER", "A B"),
  master("OTHER", "A-7"),
  master("OTHER", "m-8"),
  master("OTHER", "X-9"),
  master("OTHER", "x9"),
  master("OTHER", "DUP"),
  master("OTHER", "DUP"),
];
const importedRecords = [
  imported("IB", "001"),
  imported("IB", "002"),
  imported("IB", "003"),
  imported("OTHER", "4"),
  imported("OTHER", "ABC"),
  imported("OTHER", "AB"),
  imported("OTHER", "A7"),
  imported("OTHER", "M8"),
  imported("OTHER", "X9"),
  imported("OTHER", "NONE"),
  imported("", ""),
  imported("OTHER", "DUP"),
];
const beforeMaster = JSON.stringify(masterRecords);
const beforeImported = JSON.stringify(importedRecords);
const result = Authority.build({
  datasetType: "BRANCH_BUDGET_POTENTIAL",
  activePointer: pointer,
  activeDataset,
  masterRecords,
  importedRecords,
  findings: [{ code: "COMMERCIAL_BRANCH_PERIOD_DUPLICATE" }],
});

assert.deepStrictEqual(result.primaryIdentityCounts, {
  INVALID_IDENTITY: 1,
  MASTER_UNAVAILABLE: 0,
  AMBIGUOUS_CANDIDATE: 2,
  EXACT_ACTIVE: 1,
  EXACT_INACTIVE: 1,
  BANK_REPRESENTATION_DIFFERENCE: 1,
  LEADING_ZERO_DIFFERENCE: 1,
  CASE_DIFFERENCE: 1,
  WHITESPACE_DIFFERENCE: 1,
  PUNCTUATION_DIFFERENCE: 1,
  MULTIPLE_REPRESENTATION_DIFFERENCES: 1,
  TRULY_UNMATCHED: 1,
});
assert.strictEqual(Object.values(result.primaryIdentityCounts).reduce((sum, value) => sum + value, 0), result.imported.distinctBranchIdentityCount);
assert.strictEqual(Object.values(result.primaryRowCounts).reduce((sum, value) => sum + value, 0), result.imported.sourceRowCount);
assert.strictEqual(result.master.duplicateIdentityCount, 1);
assert.strictEqual(result.master.declaredStoredDiscrepancy, 0);
assert.strictEqual(result.imported.governedDuplicateFindingCount, 1);
assert.ok(result.secondaryCandidateSignals.identityCounts.CASE_DIFFERENCE >= 2);
assert.ok(Object.isFrozen(result) && Object.isFrozen(result.master) && Object.isFrozen(result.primaryIdentityCounts));
assert.strictEqual(JSON.stringify(masterRecords), beforeMaster);
assert.strictEqual(JSON.stringify(importedRecords), beforeImported);
const serialized = JSON.stringify(result);
for (const secret of ["IB:001", "OTHER:DUP", "M8", "NONE"]) assert.ok(!serialized.includes(secret));

const twelveRaw = Array.from({ length: 12 }, (_, index) => ({
  "BANK ID": "IB", "BRANCH CODE": "001", PERIOD: `2026-${String(index + 1).padStart(2, "0")}`,
  BUDGET: "0", POTENTIAL: "100",
}));
const governedMonthly = BancaTrackerBranchBudgetPotentialMaster.prepareDataset(twelveRaw, "COMMERCIAL:MONTHLY", { branchRecords: masterRecords });
assert.strictEqual(governedMonthly.findings.filter((finding) => finding.code === "COMMERCIAL_BRANCH_PERIOD_DUPLICATE").length, 0);
const twelveMonths = governedMonthly.records;
const monthly = Authority.build({
  datasetType: "BRANCH_BUDGET_POTENTIAL", activePointer: pointer, activeDataset,
  masterRecords, importedRecords: twelveMonths, findings: governedMonthly.findings,
});
assert.strictEqual(monthly.imported.sourceRowCount, 12);
assert.strictEqual(monthly.imported.distinctBranchIdentityCount, 1);
assert.strictEqual(monthly.imported.distinctBranchPeriodCount, 12);
assert.strictEqual(monthly.imported.governedDuplicateFindingCount, 0);
assert.strictEqual(monthly.primaryRowCounts.EXACT_ACTIVE, 12);

const governedCommercialDuplicate = BancaTrackerBranchBudgetPotentialMaster.prepareDataset(
  [twelveRaw[0], twelveRaw[0]], "COMMERCIAL:DUPLICATE", { branchRecords: masterRecords },
);
assert.strictEqual(governedCommercialDuplicate.findings.filter((finding) => finding.code === "COMMERCIAL_BRANCH_PERIOD_DUPLICATE").length, 1);
const commercialDuplicateDiagnostic = Authority.build({
  datasetType: "BRANCH_BUDGET_POTENTIAL", activePointer: pointer, activeDataset,
  masterRecords, importedRecords: governedCommercialDuplicate.records, findings: governedCommercialDuplicate.findings,
});
assert.strictEqual(commercialDuplicateDiagnostic.imported.distinctBranchIdentityCount, 1);
assert.strictEqual(commercialDuplicateDiagnostic.imported.distinctBranchPeriodCount, 1);
assert.strictEqual(commercialDuplicateDiagnostic.imported.governedDuplicateFindingCount, 1);
assert.strictEqual(commercialDuplicateDiagnostic.primaryRowCounts.EXACT_ACTIVE, 2);

const governedAssignmentDuplicate = BancaTrackerBranchAssignmentMaster.prepareDataset([
  { "BANK ID": "IB", "BRANCH CODE": "001", "RM ID": "R1", ACTIVE: "TRUE" },
  { "BANK ID": "IB", "BRANCH CODE": "001", "RM ID": "R2", ACTIVE: "TRUE" },
], "ASSIGNMENT:DUPLICATE", { branchRecords: masterRecords });
assert.strictEqual(governedAssignmentDuplicate.findings.filter((finding) => finding.code === "ASSIGNMENT_MULTIPLE_ACTIVE_RMS").length, 1);
const assignmentDuplicateDiagnostic = Authority.build({
  datasetType: "BRANCH_ASSIGNMENT", activePointer: pointer, activeDataset,
  masterRecords, importedRecords: governedAssignmentDuplicate.records, findings: governedAssignmentDuplicate.findings,
});
assert.strictEqual(assignmentDuplicateDiagnostic.imported.governedDuplicateFindingCount, 1);
assert.strictEqual(assignmentDuplicateDiagnostic.primaryRowCounts.EXACT_ACTIVE, 2);

const noPointer = Authority.build({
  datasetType: "BRANCH_ASSIGNMENT", activePointer: null, activeDataset: null,
  masterRecords: [], importedRecords: [imported("OTHER", "1"), imported("OTHER", "1")], findings: [],
});
assert.strictEqual(noPointer.primaryIdentityCounts.MASTER_UNAVAILABLE, 1);
assert.strictEqual(noPointer.primaryRowCounts.MASTER_UNAVAILABLE, 2);
assert.strictEqual(noPointer.master.available, false);
assert.strictEqual(noPointer.master.declaredRecordCount, null);
assert.strictEqual(noPointer.master.declaredStoredDiscrepancy, null);

const missingDataset = Authority.build({
  datasetType: "BRANCH_ASSIGNMENT", activePointer: pointer, activeDataset: null,
  masterRecords: [], importedRecords: [imported("OTHER", "1")], findings: [],
});
assert.strictEqual(missingDataset.primaryIdentityCounts.MASTER_UNAVAILABLE, 1);
assert.strictEqual(missingDataset.master.declaredRecordCount, null);
assert.strictEqual(missingDataset.master.declaredStoredDiscrepancy, null);

const unavailableDeclaredCounts = [
  {},
  { rowCount: null },
  { rowCount: undefined },
  { rowCount: "" },
  { rowCount: "   " },
  { rowCount: "not-a-number" },
];
unavailableDeclaredCounts.forEach((metadata) => {
  const diagnostic = Authority.build({
    datasetType: "BRANCH_ASSIGNMENT", activePointer: pointer,
    activeDataset: { datasetId: pointer, ...metadata }, masterRecords: [masterRecords[0]],
    importedRecords: [imported("IB", "001")], findings: [],
  });
  assert.strictEqual(diagnostic.master.declaredRecordCount, null);
  assert.strictEqual(diagnostic.master.declaredStoredDiscrepancy, null);
  assert.strictEqual(diagnostic.primaryIdentityCounts.EXACT_ACTIVE, 1);
});

[
  [0, 0, -1],
  ["0", 0, -1],
  [1, 1, 0],
  ["1", 1, 0],
].forEach(([metadata, expectedCount, expectedDiscrepancy]) => {
  const diagnostic = Authority.build({
    datasetType: "BRANCH_ASSIGNMENT", activePointer: pointer,
    activeDataset: { datasetId: pointer, rowCount: metadata }, masterRecords: [masterRecords[0]],
    importedRecords: [imported("IB", "001")], findings: [],
  });
  assert.strictEqual(diagnostic.master.declaredRecordCount, expectedCount);
  assert.strictEqual(diagnostic.master.declaredStoredDiscrepancy, expectedDiscrepancy);
  assert.strictEqual(diagnostic.primaryIdentityCounts.EXACT_ACTIVE, 1);
});

const wrongSnapshot = Authority.build({
  datasetType: "BRANCH_ASSIGNMENT", activePointer: pointer, activeDataset,
  masterRecords: [{ ...master("IB", "001"), datasetId: "BRANCH_MASTER:OLD" }],
  importedRecords: [imported("IB", "001")], findings: [],
});
assert.strictEqual(wrongSnapshot.master.snapshotConsistent, false);
assert.strictEqual(wrongSnapshot.primaryIdentityCounts.MASTER_UNAVAILABLE, 1);

function scaleCase(rowCount, datasetType) {
  const identities = 20000;
  const largeMaster = Array.from({ length: identities }, (_, index) => master("OTHER", `S${String(index).padStart(5, "0")}`));
  const largeImported = Array.from({ length: rowCount }, (_, index) => imported("OTHER", `S${String(index % identities).padStart(5, "0")}`, `2026-${String(index % 12 + 1).padStart(2, "0")}`));
  const started = Date.now();
  const value = Authority.build({ datasetType, activePointer: pointer, activeDataset: { datasetId: pointer, rowCount: identities }, masterRecords: largeMaster, importedRecords: largeImported, findings: [] });
  assert.strictEqual(value.imported.sourceRowCount, rowCount);
  assert.strictEqual(value.primaryRowCounts.EXACT_ACTIVE, rowCount);
  assert.strictEqual(Object.values(value.primaryIdentityCounts).reduce((sum, count) => sum + count, 0), value.imported.distinctBranchIdentityCount);
  return Date.now() - started;
}

for (const count of [999, 8000, 10996, 20000, 160000]) {
  const elapsed = scaleCase(count, count === 10996 ? "BRANCH_ASSIGNMENT" : "BRANCH_BUDGET_POTENTIAL");
  assert.ok(elapsed < 15000, `${count} rows exceeded bounded diagnostic time: ${elapsed} ms`);
}

console.log("Branch Identity Health authority tests passed: exclusive classifications, overlapping signals, governed grain, snapshot consistency, immutability, privacy, and 160,000-row stack-safe scale.");
