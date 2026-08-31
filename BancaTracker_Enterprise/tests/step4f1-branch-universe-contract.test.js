/* Step 4F.1: Branch Universe business contract and schema readiness. */
"use strict";

const assert = require("assert");
const path = require("path");

global.window = global;
const elements = new Map();
function element(id) {
  if (!elements.has(id)) elements.set(id, {
    id, innerHTML: "", textContent: "", hidden: false, disabled: false, value: "",
    dataset: {}, className: "", files: [],
    addEventListener() {}, focus() {},
  });
  return elements.get(id);
}
global.document = { getElementById: element };
const load = (file) => require(path.join(__dirname, "..", file));
[
  "js/config.js", "js/utilities.js", "js/csvProcessor.js", "js/analytics.js",
  "js/data/schema.js", "js/data/datasetRegistry.js",
  "js/masters/geographyMaster.js", "js/masters/branchMaster.js",
  "js/masters/employeeMaster.js", "js/masters/hierarchyMaster.js",
  "js/masters/branchAssignmentMaster.js", "js/enrichment/branchResolver.js",
  "js/enrichment/assignmentResolver.js", "js/enrichment/hierarchyResolver.js",
  "js/enrichment/readinessDiagnostics.js", "js/masterDataImport.js",
  "js/masterDataAdmin.js", "js/canonicalDataQuality.js", "js/scorecard.js",
].forEach(load);

const Master = BancaTrackerBranchMaster;
function raw(code, eligible, overrides = {}) {
  const row = {
    "BANK ID": "IB", "BRANCH CODE": code, "BRANCH NAME": `Branch ${code}`,
    "STATE ID": "IN-AS", ACTIVE: "TRUE", ...overrides,
  };
  if (eligible !== undefined) row["ACTIVATION ELIGIBLE"] = eligible;
  return row;
}
function prepared(rows, id = "BRANCH_MASTER:4F1") {
  return Master.prepareDataset(rows, id, { geographyRecords: [{ stateId: "IN-AS", active: true }] });
}

// active and activationEligible are independent, including old-master compatibility.
const old = prepared([raw("00123")]);
assert.strictEqual(old.valid, true);
assert.deepStrictEqual([old.records[0].active, old.records[0].activationEligible], [true, null]);
assert.strictEqual(old.universeReadiness.status, "INCOMPLETE");
assert.ok(old.findings.some((item) => item.code === "BRANCH_ACTIVATION_ELIGIBILITY_MISSING"));
assert.strictEqual(
  Master.assessUniverseReadiness([{ bankId: "IB", branchId: "IB:00999", active: true }]).status,
  "INCOMPLETE",
  "persisted pre-4F.1 records are re-evaluated from their governed bankId",
);
assert.strictEqual(Master.assessUniverseReadiness([]).status, "NOT_READY");

const eligible = prepared([raw("00124", "TRUE")]);
assert.deepStrictEqual([eligible.records[0].active, eligible.records[0].activationEligible], [true, true]);
assert.deepStrictEqual([eligible.universeReadiness.status, eligible.universeReadiness.explicitlyEligibleRecords], ["READY", 1]);

const excluded = prepared([raw("00125", "FALSE")]);
assert.deepStrictEqual([excluded.records[0].active, excluded.records[0].activationEligible], [true, false]);
assert.strictEqual(excluded.universeReadiness.explicitlyIneligibleRecords, 1);
const excludedResolution = BancaTrackerBranchResolver.resolveBranch(
  { bankId: "IB", branchCode: "00125", branchName: "Branch 00125" },
  BancaTrackerBranchResolver.buildLookupMaps(excluded.records),
);
assert.deepStrictEqual([excludedResolution.success, excludedResolution.branchId], [true, "IB:00125"]);

const inactive = prepared([raw("00126", "TRUE", { ACTIVE: "FALSE" })]);
assert.strictEqual(inactive.records[0].activationEligible, true);
assert.deepStrictEqual(
  [inactive.universeReadiness.inactiveRecords, inactive.universeReadiness.explicitlyEligibleRecords],
  [1, 0],
);

const invalid = prepared([raw("00127", "MAYBE")]);
assert.strictEqual(invalid.valid, false);
assert.strictEqual(invalid.universeReadiness.status, "NOT_READY");
assert.ok(invalid.findings.some((item) => item.code === "BRANCH_ACTIVATION_ELIGIBILITY_INVALID" && item.severity === "ERROR"));

// Supported booleans are deterministic; vague values stay invalid/null.
for (const value of [true, "TRUE", "YES", "Y", "1"]) assert.strictEqual(Master.normalizeBoolean(value), true);
for (const value of [false, "FALSE", "NO", "N", "0"]) assert.strictEqual(Master.normalizeBoolean(value), false);
for (const value of ["ACTIVE", "ELIGIBLE", "YEAH", "IN", "OUT", "MAYBE", ""]) assert.strictEqual(Master.normalizeBoolean(value), null);
assert.strictEqual(prepared([{ ...raw("00128"), ACTIVATION_ELIGIBLE: "YES" }]).records[0].activationEligible, true);
assert.strictEqual(prepared([{ ...raw("00129"), "Activation Eligible": "NO" }]).records[0].activationEligible, false);

// Exact contract counts, readiness states, zero-transaction semantics, and bank governance.
const controlled = prepared([raw("00001", "TRUE"), raw("00002", "1"), raw("00003", "FALSE"), raw("00004")]);
assert.deepStrictEqual(
  [controlled.universeReadiness.explicitlyEligibleRecords, controlled.universeReadiness.explicitlyIneligibleRecords, controlled.universeReadiness.eligibilityUnknownRecords],
  [2, 1, 1],
);
assert.strictEqual(controlled.universeReadiness.status, "INCOMPLETE");
assert.strictEqual(eligible.universeReadiness.explicitlyEligibleRecords, 1, "eligible master branches count without factData");
assert.deepStrictEqual(
  [Master.canonicalBankIdentity("IB"), Master.canonicalBankIdentity("IOB"), Master.canonicalBankIdentity("KB")],
  ["INDIAN BANK", "INDIAN OVERSEAS BANK", "KARNATAKA BANK LTD."],
);
assert.strictEqual(Master.canonicalBankIdentity("INDIAN BANK"), "INDIAN BANK");
const unknown = prepared([raw("00005", "TRUE", { "BANK ID": "UNKNOWN" })]);
assert.strictEqual(unknown.records[0].canonicalBank, null);
assert.deepStrictEqual([unknown.universeReadiness.status, unknown.universeReadiness.bankIdentityUnresolvedRecords], ["NOT_READY", 1]);

// Eligibility does not affect assignment or hierarchy resolution.
const assignment = BancaTrackerBranchAssignmentMaster.prepareDataset([
  { "BANK ID": "IB", "BRANCH CODE": "00125", "RM ID": "RM1", ACTIVE: "TRUE" },
], "BRANCH_ASSIGNMENT:4F1").records;
const assigned = BancaTrackerAssignmentResolver.resolveAssignment(
  excludedResolution.branchId,
  BancaTrackerAssignmentResolver.buildLookupMaps(assignment),
);
assert.deepStrictEqual([assigned.success, assigned.rmId], [true, "RM1"]);
const employees = BancaTrackerEmployeeMaster.prepareDataset([
  { "EMPLOYEE ID": "RM1", "EMPLOYEE NAME": "RM One", ROLE: "RM", ACTIVE: "TRUE" },
  { "EMPLOYEE ID": "CSM1", "EMPLOYEE NAME": "CSM One", ROLE: "CSM", ACTIVE: "TRUE" },
], "EMPLOYEE_MASTER:4F1").records;
const hierarchy = BancaTrackerHierarchyMaster.prepareDataset([
  { "EMPLOYEE ID": "RM1", "MANAGER ID": "CSM1" }, { "EMPLOYEE ID": "CSM1", "MANAGER ID": "" },
], "HIERARCHY:4F1", { employeeRecords: employees }).records;
const chain = BancaTrackerHierarchyResolver.resolveHierarchy(
  assigned.rmId,
  BancaTrackerHierarchyResolver.buildLookupMaps(employees, hierarchy),
);
assert.deepStrictEqual([chain.rmId, chain.csmId], ["RM1", "CSM1"]);
assert.strictEqual(old.records[0].branchId, "IB:00123", "leading zero identity is preserved");

// Existing activation and scorecard remain on config.TOTAL_BRANCHES.
assert.strictEqual(BancaTrackerConfig.TOTAL_BRANCHES["INDIAN BANK"], 6022);
const audit = { hierarchyConflicts: [], branchUniverseSanity: [], baCodeConflicts: [], productConflicts: [], bankQuality: { unknownBanks: [] } };
const metric = BancaTrackerScorecard.buildPartnerMetrics(
  { totalPremium: 100, bankBranchMetrics: { "INDIAN BANK": { premium: 100, observed: 2, active: 1, nearActive: 0 } } },
  { bankIndexes: { "INDIAN BANK": { rms: [], imds: [], branches: [], opportunities: [] } } },
  audit, "INDIAN BANK",
)[0];
assert.deepStrictEqual([metric.branchUniverse, metric.activationPercent], [6022, 100 / 6022]);
assert.strictEqual(metric.priority, "MEDIUM");

// Contract metadata is available independently in readiness, Canonical DQ, and Admin UI.
const shadow = {
  status: "READY", sourceRecordCount: 0, canonicalRecordCount: 0, invalidRecordCount: 0,
  canonicalResults: [], masterStatus: {}, summary: { warningCount: 0, invalidCount: 0 },
  reconciliation: { unexplainedDifferences: 0 }, branchUniverseReadiness: controlled.universeReadiness,
};
assert.strictEqual(BancaTrackerReadinessDiagnostics.buildReadiness(shadow).branchUniverse.status, "INCOMPLETE");
const dqModel = BancaTrackerCanonicalDataQuality.buildModel(shadow);
assert.strictEqual(dqModel.branchUniverse.explicitlyEligibleRecords, 2);
const adminModel = BancaTrackerMasterDataAdmin.buildViewModel(BancaTrackerReadinessDiagnostics.buildReadiness(shadow));
BancaTrackerMasterDataAdmin.renderViewModel(adminModel);
assert.match(element("masterReadinessSummary").innerHTML, /Branch Universe Contract/);
assert.match(element("masterReadinessSummary").innerHTML, /Eligibility Unknown/);

// Signed premium and source identity are unrelated to the master eligibility field.
const signed = BancaTrackerAnalytics.build([
  { bank: "INDIAN BANK", branchId: "IB:00125", branch: "Branch", premium: 50, baCode: "SRC1", rm: "Source RM", imd: "I1", lob: "L", productCode: "P" },
  { bank: "INDIAN BANK", branchId: "IB:00125", branch: "Branch", premium: -20, baCode: "SRC1", rm: "Source RM", imd: "I1", lob: "L", productCode: "P" },
]);
assert.strictEqual(signed.totalPremium, 30);
assert.strictEqual(signed.rms["Source RM"], 30);

// Invalid replacement cannot be committed and performs no repository writes.
(async function () {
  let writes = 0;
  const repository = {
    async getActiveMasterRecords(type) {
      return type === "GEOGRAPHY_MASTER" ? [{ stateId: "IN-AS", active: true }] : [];
    },
    async stageDataset() { writes += 1; throw new Error("must not stage"); },
  };
  const parsed = BancaTrackerMasterDataImport.parseText(
    "BANK ID,BRANCH CODE,BRANCH NAME,STATE ID,ACTIVE,ACTIVATION ELIGIBLE\nIB,00130,Invalid,IN-AS,TRUE,MAYBE",
  );
  const preview = await BancaTrackerMasterDataImport.prepareImport("BRANCH_MASTER", parsed, { repository });
  assert.strictEqual(preview.valid, false);
  assert.strictEqual(preview.universeReadiness.status, "NOT_READY");
  BancaTrackerMasterDataAdmin.renderImportPreview(preview);
  assert.match(element("masterImportSummary").innerHTML, /Universe Readiness/);
  assert.match(element("masterImportSummary").innerHTML, /Bank Identity Unresolved/);
  assert.strictEqual(BancaTrackerMasterDataImport.canCommit(preview), false);
  await assert.rejects(() => BancaTrackerMasterDataImport.commitImport(preview, { repository }), /valid preview/);
  assert.strictEqual(writes, 0);
  console.log("Step 4F.1 tests passed: branch-universe contract, readiness, identity, operational independence, legacy activation, DQ/Admin visibility, and replacement safety.");
})().catch((error) => { console.error(error); process.exitCode = 1; });
