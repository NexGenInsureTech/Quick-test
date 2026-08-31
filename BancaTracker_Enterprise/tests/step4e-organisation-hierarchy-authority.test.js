/* Step 4E: governed organisation hierarchy authority. */
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
  "js/enrichment/enrichmentPipeline.js", "js/enrichment/liveHierarchyAuthority.js",
  "js/enrichment/shadowEnrichment.js",
].forEach(load);

function prepareEmployees(rows) {
  return BancaTrackerEmployeeMaster.prepareDataset(rows, "EMPLOYEE_MASTER:4E").records;
}
function relationship(employeeId, managerId) {
  return BancaTrackerHierarchyMaster.normalizeRow(
    { "EMPLOYEE ID": employeeId, "MANAGER ID": managerId || "" },
    "HIERARCHY:4E", 2,
  );
}
const employees = prepareEmployees([
  { "EMPLOYEE ID": "RM482", "EMPLOYEE NAME": "Source RM", ROLE: "RM", ACTIVE: "TRUE" },
  { "EMPLOYEE ID": "RM483", "EMPLOYEE NAME": "Other Source RM", ROLE: "RM", ACTIVE: "TRUE" },
  { "EMPLOYEE ID": "RM501", "EMPLOYEE NAME": "Anita Sharma", ROLE: "RM", ACTIVE: "TRUE" },
  { "EMPLOYEE ID": "CSM101", "EMPLOYEE NAME": "CSM One", ROLE: "CSM", ACTIVE: "TRUE" },
  { "EMPLOYEE ID": "ASM201", "EMPLOYEE NAME": "ASM One", ROLE: "ASM", ACTIVE: "TRUE" },
  { "EMPLOYEE ID": "ZSM301", "EMPLOYEE NAME": "ZSM One", ROLE: "ZSM", ACTIVE: "TRUE" },
  { "EMPLOYEE ID": "NH401", "EMPLOYEE NAME": "National Head One", ROLE: "NATIONAL_HEAD", ACTIVE: "TRUE" },
  { "EMPLOYEE ID": "CSM482", "EMPLOYEE NAME": "Source CSM", ROLE: "CSM", ACTIVE: "TRUE" },
]);
const employeeById = new Map(employees.map((record) => [record.employeeId, record]));
const completeRelationships = [
  relationship("RM501", "CSM101"), relationship("CSM101", "ASM201"),
  relationship("ASM201", "ZSM301"), relationship("ZSM301", "NH401"),
  relationship("RM482", "CSM482"),
];
const completeMaps = BancaTrackerHierarchyResolver.buildLookupMaps(employees, completeRelationships);
const partialMaps = BancaTrackerHierarchyResolver.buildLookupMaps(
  employees,
  [relationship("RM501", "CSM101"), relationship("CSM101", "ASM201")],
);
const Authority = BancaTrackerLiveHierarchyAuthority;

function assigned(overrides = {}) {
  return {
    premium: 100, bank: "IB", branchId: "IB:00017", branchAuthority: "GOVERNED_EXACT",
    assignmentAuthority: "ASSIGNED", assignedRmId: "RM501", assignedRmName: "Anita Sharma",
    sourceRmId: "RM482", sourceRmName: "Source RM", baCode: "RM482", rm: "Source RM",
    rmComparison: "MISMATCH", state: "Assam", zone: "East", dateAuthority: "CANONICAL",
    ...overrides,
  };
}

const absent = Authority.applyRecord(assigned(), { hierarchyMaps: null, employeeById });
assert.deepStrictEqual([absent.hierarchyAuthority, absent.assignedRmId, absent.csmId], ["MASTER_ABSENT", "RM501", null]);

const assignmentUnresolved = Authority.applyRecord(assigned({ assignmentAuthority: "UNMAPPED", assignedRmId: null }), { hierarchyMaps: completeMaps, employeeById });
assert.deepStrictEqual([assignmentUnresolved.hierarchyAuthority, assignmentUnresolved.hierarchyRmId], ["ASSIGNMENT_UNRESOLVED", null]);

const complete = Authority.applyRecord(assigned(), { hierarchyMaps: completeMaps, employeeById });
assert.deepStrictEqual(
  [complete.hierarchyAuthority, complete.hierarchyRmId, complete.csmId, complete.asmId, complete.zsmId, complete.nationalHeadId, complete.hierarchyDepth],
  ["RESOLVED", "RM501", "CSM101", "ASM201", "ZSM301", "NH401", 4],
);
assert.deepStrictEqual(
  [complete.hierarchyRmName, complete.csmName, complete.asmName, complete.zsmName, complete.nationalHeadName],
  ["Anita Sharma", "CSM One", "ASM One", "ZSM One", "National Head One"],
);
assert.deepStrictEqual([complete.sourceRmId, complete.assignedRmId, complete.rmComparison], ["RM482", "RM501", "MISMATCH"]);
assert.strictEqual(complete.baCode, "RM482");

const partial = Authority.applyRecord(assigned(), { hierarchyMaps: partialMaps, employeeById });
assert.deepStrictEqual(
  [partial.hierarchyAuthority, partial.hierarchyRmId, partial.csmId, partial.asmId, partial.zsmId, partial.nationalHeadId, partial.hierarchyDepth],
  ["PARTIAL", "RM501", "CSM101", "ASM201", null, null, 2],
);

const hierarchyUnmapped = Authority.applyRecord(assigned({ assignedRmId: "RM999" }), { hierarchyMaps: completeMaps, employeeById });
assert.deepStrictEqual([hierarchyUnmapped.hierarchyAuthority, hierarchyUnmapped.hierarchyRmId], ["HIERARCHY_UNMAPPED", null]);

const sameOwner = [
  complete,
  Authority.applyRecord(assigned({ sourceRmId: "RM483", baCode: "RM483", branchId: "IB:00018" }), { hierarchyMaps: completeMaps, employeeById }),
];
assert.deepStrictEqual(sameOwner.map((row) => row.sourceRmId), ["RM482", "RM483"]);
assert.ok(sameOwner.every((row) => row.hierarchyRmId === "RM501" && row.csmId === "CSM101"));
assert.notStrictEqual(sameOwner[0].branchId, sameOwner[1].branchId);

const missingNameEmployees = employees.map((record) => record.employeeId === "CSM101" ? { ...record, employeeName: null } : record);
const missingNameById = new Map(missingNameEmployees.map((record) => [record.employeeId, record]));
const missingNameMaps = BancaTrackerHierarchyResolver.buildLookupMaps(missingNameEmployees, completeRelationships);
const missingName = Authority.applyRecord(assigned(), { hierarchyMaps: missingNameMaps, employeeById: missingNameById });
assert.deepStrictEqual([missingName.csmId, missingName.csmName, missingName.hierarchyEmployeeMetadataMissing], ["CSM101", null, 1]);

const cycleMaps = BancaTrackerHierarchyResolver.buildLookupMaps(
  employees,
  [relationship("RM501", "CSM101"), relationship("CSM101", "RM501")],
);
const invalid = Authority.applyRecord(assigned(), { hierarchyMaps: cycleMaps, employeeById });
assert.deepStrictEqual([invalid.hierarchyAuthority, invalid.hierarchyResolutionStatus], ["INVALID_CHAIN", "CYCLE_DETECTED"]);

for (const premium of [50, 0, -20]) {
  assert.strictEqual(Authority.applyRecord(assigned({ premium }), { hierarchyMaps: completeMaps, employeeById }).premium, premium);
}
const invalidDate = Authority.applyRecord(assigned({ dateAuthority: "INVALID" }), { hierarchyMaps: completeMaps, employeeById });
assert.deepStrictEqual([invalidDate.dateAuthority, invalidDate.hierarchyAuthority], ["INVALID", "RESOLVED"]);
const unknown = Authority.applyRecord(assigned({ bank: "UNKNOWN", assignedRmId: null, assignmentAuthority: "BRANCH_UNRESOLVED" }), { hierarchyMaps: completeMaps, employeeById });
assert.deepStrictEqual([unknown.bank, unknown.hierarchyAuthority], ["UNKNOWN", "ASSIGNMENT_UNRESOLVED"]);
assert.deepStrictEqual([complete.state, complete.zone, complete.branchId, complete.branchAuthority, complete.assignedRmId, complete.assignmentAuthority], ["Assam", "East", "IB:00017", "GOVERNED_EXACT", "RM501", "ASSIGNED"]);

const geography = BancaTrackerGeographyMaster.prepareDataset([
  { "STATE ID": "IN-AS", "STATE CODE": "AS", "STATE NAME": "Assam", "ZONE ID": "EAST", "ZONE NAME": "East", ACTIVE: "TRUE" },
], "GEOGRAPHY:4E");
const branches = BancaTrackerBranchMaster.prepareDataset([
  { "BANK ID": "IB", "BRANCH CODE": "00017", "BRANCH NAME": "Dibrugarh", "STATE ID": "IN-AS", ACTIVE: "TRUE" },
], "BRANCH:4E", { geographyRecords: geography.records });
const assignments = BancaTrackerBranchAssignmentMaster.prepareDataset([
  { "BANK ID": "IB", "BRANCH CODE": "00017", "RM ID": "RM501", ACTIVE: "TRUE" },
], "ASSIGNMENT:4E", { branchRecords: branches.records, employeeRecords: employees });
function shadowFor(live, hierarchyMaps) {
  return BancaTrackerEnrichmentPipeline.enrichTransaction(
    BancaTrackerShadowEnrichment.adaptRecord({
      ...live, policyIssuedDate: "24/08/2026", branchCode: "00017", branch: "Dibrugarh",
    }),
    {
      branchMaps: BancaTrackerBranchResolver.buildLookupMaps(branches.records),
      geographyMaps: BancaTrackerGeographyResolver.buildLookupMaps(geography.records),
      assignmentMaps: BancaTrackerAssignmentResolver.buildLookupMaps(assignments.records),
      hierarchyMaps,
    },
  );
}
const shadowComplete = shadowFor(complete, completeMaps);
assert.deepStrictEqual(
  [shadowComplete.resolution.hierarchy.status, shadowComplete.transaction.csmId, shadowComplete.transaction.asmId, shadowComplete.transaction.zsmId, shadowComplete.transaction.nationalHeadId],
  [complete.hierarchyResolutionStatus, complete.csmId, complete.asmId, complete.zsmId, complete.nationalHeadId],
);
const shadowPartial = shadowFor(partial, partialMaps);
assert.deepStrictEqual(
  [shadowPartial.resolution.hierarchy.status, shadowPartial.transaction.csmId, shadowPartial.transaction.asmId, shadowPartial.transaction.zsmId],
  [partial.hierarchyResolutionStatus, partial.csmId, partial.asmId, partial.zsmId],
);

const summary = BancaTrackerShadowEnrichment.buildHierarchyAuthoritySummary([
  complete, partial, absent, assignmentUnresolved, hierarchyUnmapped, invalid, missingName,
]);
assert.deepStrictEqual(summary, {
  resolved: 2, partial: 1, masterAbsent: 1, assignmentUnresolved: 1,
  hierarchyUnmapped: 1, invalidChain: 1, unspecified: 0, missingEmployeeMetadata: 1,
});

const analyticsRows = [complete, { ...complete, premium: 200, sourceRmId: "RM483", baCode: "RM483", rm: "Other Source RM" }];
const derived = BancaTrackerAnalytics.build(analyticsRows);
const productivity = BancaTrackerProductivity.build(
  { currentPeriodData: analyticsRows, currentPeriodMonth: "Aug-26", currentPeriodIsUnconfigured: false, ytdData: analyticsRows },
  derived,
  null,
);
assert.deepStrictEqual(productivity.rmMetrics.map((item) => item.code).sort(), ["RM482", "RM483"]);
assert.strictEqual(derived.activeBranches.length, 0);
assert.strictEqual(BancaTrackerConfig.TOTAL_BRANCHES["INDIAN BANK"], 6022);

let hierarchyReads = 0; let employeeReads = 0;
const repository = { async getActiveMasterRecords(type) {
  if (type === "HIERARCHY") { hierarchyReads += 1; return completeRelationships; }
  if (type === "EMPLOYEE_MASTER") employeeReads += 1;
  return [];
} };
BancaTrackerLiveHierarchyAuthority.loadContext(repository, { employeeById }).then(() => {
  assert.deepStrictEqual([hierarchyReads, employeeReads], [1, 0]);
  console.log("Step 4E tests passed: complete/partial hierarchy authority, defensive states, identity independence, DQ counts, and shadow alignment.");
}).catch((error) => { console.error(error); process.exitCode = 1; });
