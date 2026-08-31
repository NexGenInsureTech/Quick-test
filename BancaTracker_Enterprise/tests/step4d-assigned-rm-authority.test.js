/* Step 4D: assigned RM authority and source-vs-assigned governance. */
"use strict";

const assert = require("assert");
const path = require("path");
global.window = global;
const load = (file) => require(path.join(__dirname, "..", file));
[
  "js/config.js", "js/utilities.js", "js/analytics.js", "js/productivity.js",
  "js/data/schema.js", "js/data/datasetRegistry.js",
  "js/masters/geographyMaster.js", "js/masters/branchMaster.js",
  "js/masters/employeeMaster.js", "js/masters/hierarchyMaster.js",
  "js/masters/branchAssignmentMaster.js", "js/enrichment/dateResolver.js",
  "js/enrichment/geographyResolver.js", "js/enrichment/branchResolver.js",
  "js/enrichment/hierarchyResolver.js", "js/enrichment/assignmentResolver.js",
  "js/enrichment/enrichmentPipeline.js", "js/enrichment/liveBranchAuthority.js",
  "js/enrichment/liveAssignmentAuthority.js", "js/enrichment/liveGeographyAuthority.js",
  "js/enrichment/shadowEnrichment.js",
].forEach(load);

const employees = BancaTrackerEmployeeMaster.prepareDataset([
  { "EMPLOYEE ID": "RM482", "EMPLOYEE NAME": "Source Owner", ROLE: "RM", ACTIVE: "TRUE" },
  { "EMPLOYEE ID": "RM501", "EMPLOYEE NAME": "Anita Sharma", ROLE: "RM", ACTIVE: "TRUE" },
], "EMPLOYEE_MASTER:4D");
const employeeById = new Map(employees.records.map((record) => [record.employeeId, record]));

function assignmentMaps(rows) {
  const records = rows.map((row, index) => BancaTrackerBranchAssignmentMaster.normalizeRow(row, "ASSIGNMENT:4D", index + 2));
  return BancaTrackerAssignmentResolver.buildLookupMaps(records);
}
const assigned501 = assignmentMaps([
  { "BANK ID": "IB", "BRANCH CODE": "00017", "RM ID": "RM501", ACTIVE: "TRUE" },
  { "BANK ID": "IB", "BRANCH CODE": "00018", "RM ID": "RM501", ACTIVE: "TRUE" },
]);
const assigned482 = assignmentMaps([
  { "BANK ID": "IB", "BRANCH CODE": "00017", "RM ID": "RM482", ACTIVE: "TRUE" },
]);
const Authority = BancaTrackerLiveAssignmentAuthority;

function source(overrides = {}) {
  return {
    premium: 100, bank: "IB", branchId: "IB:00017", branchCode: "00017",
    branch: "Dibrugarh", branchAuthority: "GOVERNED_EXACT",
    baCode: "RM482", rm: "Source RM", state: "Assam", zone: "East",
    month: "Aug-26", day: 24, dateAuthority: "CANONICAL", ...overrides,
  };
}

const absent = Authority.applyRecord(source(), { assignmentMaps: null, employeeById });
assert.deepStrictEqual([absent.sourceRmId, absent.assignedRmId, absent.assignmentAuthority, absent.rmComparison], ["RM482", null, "MASTER_ABSENT", "ASSIGNED_MISSING"]);

const match = Authority.applyRecord(source(), { assignmentMaps: assigned482, employeeById });
assert.deepStrictEqual([match.sourceRmId, match.assignedRmId, match.assignmentAuthority, match.rmComparison], ["RM482", "RM482", "ASSIGNED", "MATCH"]);

const mismatch = Authority.applyRecord(source(), { assignmentMaps: assigned501, employeeById });
assert.deepStrictEqual(
  [mismatch.sourceRmId, mismatch.sourceRmName, mismatch.assignedRmId, mismatch.assignedRmName, mismatch.assignedRmRole, mismatch.rmComparison],
  ["RM482", "Source RM", "RM501", "Anita Sharma", "RM", "MISMATCH"],
);
assert.strictEqual(mismatch.baCode, "RM482");

const sourceMissing = Authority.applyRecord(source({ baCode: "", rm: "" }), { assignmentMaps: assigned501, employeeById });
assert.deepStrictEqual([sourceMissing.assignedRmId, sourceMissing.rmComparison], ["RM501", "SOURCE_MISSING"]);

const unmapped = Authority.applyRecord(source({ premium: -25, branchId: "IB:00999", branchCode: "00999" }), { assignmentMaps: assigned501, employeeById });
assert.deepStrictEqual([unmapped.assignmentAuthority, unmapped.assignedRmId, unmapped.premium], ["UNMAPPED", null, -25]);

const ambiguousMaps = assignmentMaps([
  { "BANK ID": "IB", "BRANCH CODE": "00017", "RM ID": "RM482", ACTIVE: "TRUE" },
  { "BANK ID": "IB", "BRANCH CODE": "00017", "RM ID": "RM501", ACTIVE: "TRUE" },
]);
const ambiguous = Authority.applyRecord(source(), { assignmentMaps: ambiguousMaps, employeeById });
assert.deepStrictEqual([ambiguous.assignmentAuthority, ambiguous.assignedRmId], ["AMBIGUOUS", null]);

const branchUnresolved = Authority.applyRecord(source({ branchId: null, branchAuthority: "UNMAPPED" }), { assignmentMaps: assigned501, employeeById });
assert.deepStrictEqual([branchUnresolved.assignmentAuthority, branchUnresolved.assignedRmId], ["BRANCH_UNRESOLVED", null]);

const missingEmployeeAssignment = assignmentMaps([
  { "BANK ID": "IB", "BRANCH CODE": "00017", "RM ID": "RM999", ACTIVE: "TRUE" },
]);
const missingEmployee = Authority.applyRecord(source(), { assignmentMaps: missingEmployeeAssignment, employeeById });
assert.deepStrictEqual(
  [missingEmployee.assignedRmId, missingEmployee.assignedRmName, missingEmployee.assignedEmployeeResolution],
  ["RM999", null, "UNMAPPED"],
);

for (const premium of [50, 0, -20]) {
  assert.strictEqual(Authority.applyRecord(source({ premium }), { assignmentMaps: assigned501, employeeById }).premium, premium);
}
const unknown = Authority.applyRecord(source({ bank: "UNKNOWN", branchId: null }), { assignmentMaps: assigned501, employeeById });
assert.deepStrictEqual([unknown.bank, unknown.assignmentAuthority, unknown.assignedRmId], ["UNKNOWN", "BRANCH_UNRESOLVED", null]);
const invalidDate = Authority.applyRecord(source({ dateAuthority: "INVALID", month: null, day: null }), { assignmentMaps: assigned501, employeeById });
assert.deepStrictEqual([invalidDate.dateAuthority, invalidDate.assignedRmId], ["INVALID", "RM501"]);

const secondBranch = Authority.applyRecord(source({ branchId: "IB:00018", branchCode: "00018", branch: "Second Branch" }), { assignmentMaps: assigned501, employeeById });
assert.strictEqual(secondBranch.assignedRmId, "RM501");
assert.notStrictEqual(secondBranch.branchId, mismatch.branchId);

const varied = [
  mismatch,
  Authority.applyRecord(source({ baCode: "RM483", rm: "Other Source" }), { assignmentMaps: assigned501, employeeById }),
];
assert.deepStrictEqual(varied.map((row) => row.sourceRmId), ["RM482", "RM483"]);
assert.ok(varied.every((row) => row.assignedRmId === "RM501" && row.rmComparison === "MISMATCH"));

const summary = BancaTrackerShadowEnrichment.buildAssignmentAuthoritySummary([
  match, mismatch, sourceMissing, absent, unmapped, ambiguous, branchUnresolved,
]);
assert.deepStrictEqual(summary, {
  assigned: 3, masterAbsent: 1, branchUnresolved: 1, unmapped: 1, ambiguous: 1, unspecified: 0,
  match: 1, mismatch: 1, sourceMissing: 1, assignedMissing: 4, notComparable: 0,
});

for (const live of [match, mismatch]) {
  const shadow = BancaTrackerEnrichmentPipeline.enrichTransaction(
    BancaTrackerShadowEnrichment.adaptRecord(live),
    { assignmentMaps: live === match ? assigned482 : assigned501 },
  );
  assert.strictEqual(shadow.transaction.assignedRmId, live.assignedRmId);
  assert.strictEqual(shadow.comparisons.sourceVsAssignedRm, live.rmComparison);
}

const analyticsRows = [mismatch, { ...mismatch, premium: 200, baCode: "RM483", sourceRmId: "RM483", rm: "Other Source" }];
const derived = BancaTrackerAnalytics.build(analyticsRows);
const productivity = BancaTrackerProductivity.build(
  { currentPeriodData: analyticsRows, currentPeriodMonth: "Aug-26", currentPeriodIsUnconfigured: false, ytdData: analyticsRows },
  derived,
  null,
);
assert.deepStrictEqual(productivity.rmMetrics.map((item) => item.code).sort(), ["RM482", "RM483"]);
assert.ok(analyticsRows.every((row) => row.assignedRmId === "RM501"));
assert.strictEqual(derived.activeBranches.length, 0);
assert.strictEqual(BancaTrackerConfig.TOTAL_BRANCHES["INDIAN BANK"], 6022);
assert.ok(!Object.prototype.hasOwnProperty.call(mismatch, "csmId"));

let assignmentReads = 0; let employeeReads = 0;
const repository = { async getActiveMasterRecords(type) {
  if (type === "BRANCH_ASSIGNMENT") { assignmentReads += 1; return []; }
  if (type === "EMPLOYEE_MASTER") { employeeReads += 1; return []; }
  return [];
} };
Authority.loadContext(repository).then(() => {
  assert.deepStrictEqual([assignmentReads, employeeReads], [1, 1]);
  console.log("Step 4D tests passed: source and assigned RM governance, comparison states, employee lookup, DQ counts, shadow alignment, and legacy RM-productivity semantics.");
}).catch((error) => { console.error(error); process.exitCode = 1; });
