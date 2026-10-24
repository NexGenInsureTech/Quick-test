/* Structural Master Stack-Safety Corrective Increment A. */
"use strict";

const assert = require("assert");
const path = require("path");
const root = path.join(__dirname, "..");

global.window = global;
require(path.join(root, "js/config.js"));
require(path.join(root, "js/data/schema.js"));
require(path.join(root, "js/data/datasetRegistry.js"));
require(path.join(root, "js/csvProcessor.js"));
require(path.join(root, "js/enrichment/dateResolver.js"));
require(path.join(root, "js/masters/branchMaster.js"));
require(path.join(root, "js/masters/branchAssignmentMaster.js"));
require(path.join(root, "js/masters/branchBudgetPotentialMaster.js"));

const Branch = BancaTrackerBranchMaster;
const Assignment = BancaTrackerBranchAssignmentMaster;
const Commercial = BancaTrackerBranchBudgetPotentialMaster;

function branch(code = "MATCH", active = "TRUE") {
  return Branch.normalizeRow({ "BANK ID": "IB", "BRANCH CODE": code, "BRANCH NAME": `Fictional ${code}`, "STATE ID": "S1", ACTIVE: active, "ACTIVATION ELIGIBLE": "TRUE" }, "BM:1", 2);
}
function assignment(code, rowNumber = 2) {
  return { "BANK ID": "IB", "BRANCH CODE": code, "RM ID": "R1", ACTIVE: "TRUE", rowNumber };
}
function commercial(code, rowNumber = 2, period = "2026-04") {
  return { "BANK ID": "IB", "BRANCH CODE": code, PERIOD: period, BUDGET: "100", POTENTIAL: "200", rowNumber };
}
const employee = { employeeId: "R1", role: "RM", active: true };
const activeBranch = branch();
const assignmentContext = { branchRecords: [activeBranch], employeeRecords: [employee] };
const commercialContext = { branchRecords: [activeBranch] };

const matchingAssignment = Assignment.prepareDataset([assignment("MATCH")], "AS:1", assignmentContext);
assert.strictEqual(matchingAssignment.valid, true);
assert.deepStrictEqual(matchingAssignment.findings, []);
const matchingCommercial = Commercial.prepareDataset([commercial("MATCH")], "CP:1", commercialContext);
assert.strictEqual(matchingCommercial.valid, true);
assert.deepStrictEqual(matchingCommercial.findings, []);
assert.strictEqual(matchingCommercial.records[0].budget, 100);
assert.strictEqual(matchingCommercial.records[0].potential, 200);

for (const size of [999, 8000, 20000, 150000, 160000]) {
  const rows = Array.from({ length: size }, (_, index) => commercial(`X${String(index).padStart(6, "0")}`, index + 2));
  let result;
  assert.doesNotThrow(() => { result = Commercial.prepareDataset(rows, `CP:${size}`, commercialContext); }, `${size} commercial findings must not overflow the argument stack`);
  assert.strictEqual(result.records.length, size);
  assert.strictEqual(result.findings.length, size);
  assert.strictEqual(result.errorCount, size);
  assert.strictEqual(result.commercialSummary.unmappedBranches, size);
  result.findings.forEach((finding, index) => {
    assert.strictEqual(finding.code, "COMMERCIAL_BRANCH_UNMAPPED");
    assert.strictEqual(finding.severity, "ERROR");
    assert.strictEqual(finding.sourceRowNumber, index + 2, "commercial finding order follows source order");
  });
}

for (const size of [10996, 20000]) {
  const rows = Array.from({ length: size }, (_, index) => assignment(`A${String(index).padStart(6, "0")}`, index + 2));
  let result;
  assert.doesNotThrow(() => { result = Assignment.prepareDataset(rows, `AS:${size}`, assignmentContext); }, `${size} assignment findings must not overflow the argument stack`);
  assert.strictEqual(result.records.length, size);
  assert.strictEqual(result.findings.length, size);
  assert.strictEqual(result.errorCount, size);
  result.findings.forEach((finding, index) => {
    assert.strictEqual(finding.code, "ASSIGNMENT_BRANCH_UNMAPPED");
    assert.strictEqual(finding.severity, "ERROR");
    assert.strictEqual(finding.value, `IB:A${String(index).padStart(6, "0")}`, "assignment finding order follows source order");
  });
}

const inactiveBranch = branch("INACTIVE", "FALSE");
assert.deepStrictEqual(
  Assignment.prepareDataset([assignment("INACTIVE")], "AS:inactive", { branchRecords: [inactiveBranch], employeeRecords: [employee] }).findings.map((item) => item.code),
  ["ASSIGNMENT_BRANCH_INACTIVE"],
);
assert.deepStrictEqual(
  Commercial.prepareDataset([commercial("INACTIVE")], "CP:inactive", { branchRecords: [inactiveBranch] }).findings.map((item) => item.code),
  ["COMMERCIAL_BRANCH_INACTIVE"],
);
assert.deepStrictEqual(
  Commercial.prepareDataset([commercial("MATCH")], "CP:absent", { branchRecords: [] }).findings.map((item) => item.code),
  ["COMMERCIAL_BRANCH_MASTER_ABSENT"],
);
assert.deepStrictEqual(
  Assignment.prepareDataset([assignment("MATCH")], "AS:absent", { branchRecords: [], employeeRecords: [employee] }).findings.map((item) => item.code),
  ["ASSIGNMENT_BRANCH_UNMAPPED"],
);

const duplicateCommercial = Commercial.prepareDataset([commercial("MATCH", 2), commercial("MATCH", 3)], "CP:duplicate", commercialContext);
assert.deepStrictEqual(duplicateCommercial.findings.map((item) => item.code), ["COMMERCIAL_BRANCH_PERIOD_DUPLICATE"]);
const duplicateAssignment = Assignment.prepareDataset([assignment("MATCH", 2), assignment("MATCH", 3)], "AS:duplicate", assignmentContext);
assert.deepStrictEqual(duplicateAssignment.findings.map((item) => item.code), ["ASSIGNMENT_MULTIPLE_ACTIVE_RMS"]);

const invalidCommercial = Commercial.prepareDataset([{ "BANK ID": "", "BRANCH CODE": "", PERIOD: "2026-13", BUDGET: "-1", POTENTIAL: "bad" }], "CP:invalid", commercialContext);
assert.deepStrictEqual(invalidCommercial.findings.map((item) => item.code), [
  "COMMERCIAL_BANK_ID_MISSING", "COMMERCIAL_BRANCH_CODE_MISSING", "COMMERCIAL_PERIOD_INVALID", "COMMERCIAL_BUDGET_INVALID", "COMMERCIAL_POTENTIAL_INVALID",
]);
const invalidAssignment = Assignment.prepareDataset([{ "BANK ID": "", "BRANCH CODE": "", "RM ID": "", ACTIVE: "bad" }], "AS:invalid", assignmentContext);
assert.deepStrictEqual(invalidAssignment.findings.map((item) => item.code), [
  "ASSIGNMENT_BANK_ID_MISSING", "ASSIGNMENT_BRANCH_CODE_MISSING", "ASSIGNMENT_RM_ID_MISSING", "ASSIGNMENT_ACTIVE_INVALID",
]);

require(path.join(root, "js/masterDataImport.js"));
const activePointer = "BRANCH_BUDGET_POTENTIAL:existing";
const activeRecords = Object.freeze([{ recordId: "existing", datasetId: activePointer, branchId: "IB:MATCH", periodKey: "2026-04", budget: 1, potential: 2 }]);
const calls = { stage: 0, save: 0, activate: 0 };
const repository = {
  async getActiveMasterRecords(type) { return type === "BRANCH_MASTER" ? [activeBranch] : activeRecords; },
  async getActiveDatasetId() { return activePointer; },
  async stageDataset() { calls.stage += 1; throw new Error("stage must not be called"); },
  async saveStagedMasterRecords() { calls.save += 1; },
  async activateDataset() { calls.activate += 1; },
};

(async () => {
  const parsed = { headers: ["BANK ID", "BRANCH CODE", "PERIOD", "BUDGET", "POTENTIAL"], rows: Array.from({ length: 999 }, (_, index) => commercial(`REJECT${index}`, index + 2)) };
  const preview = await BancaTrackerMasterDataImport.prepareImport("BRANCH_BUDGET_POTENTIAL", parsed, { repository, fileName: "fictional-rejected.csv" });
  assert.strictEqual(preview.valid, false);
  assert.strictEqual(preview.findings.length, 999);
  await assert.rejects(() => BancaTrackerMasterDataImport.commitImport(preview, { repository }), /Only a valid preview can be activated/);
  assert.deepStrictEqual(calls, { stage: 0, save: 0, activate: 0 });
  assert.strictEqual(await repository.getActiveDatasetId(), activePointer);
  assert.deepStrictEqual(await repository.getActiveMasterRecords("BRANCH_BUDGET_POTENTIAL"), activeRecords);
  console.log("Structural Master Stack-Safety Increment A tests passed: exact findings through 160,000, preserved validation ordering, and rejected-import atomicity.");
})().catch((error) => { console.error(error); process.exitCode = 1; });
