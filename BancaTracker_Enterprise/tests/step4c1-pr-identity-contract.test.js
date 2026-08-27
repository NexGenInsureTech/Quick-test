/* Step 4C.1: PR source-RM and durable-branch identity contract. */
"use strict";

const assert = require("assert");
const path = require("path");

global.window = global;
const load = (file) => require(path.join(__dirname, "..", file));

[
  "js/config.js",
  "js/csvProcessor.js",
  "js/data/schema.js",
  "js/data/datasetRegistry.js",
  "js/masters/geographyMaster.js",
  "js/masters/branchMaster.js",
  "js/masters/employeeMaster.js",
  "js/masters/hierarchyMaster.js",
  "js/masters/branchAssignmentMaster.js",
  "js/enrichment/dateResolver.js",
  "js/enrichment/geographyResolver.js",
  "js/enrichment/branchResolver.js",
  "js/enrichment/hierarchyResolver.js",
  "js/enrichment/assignmentResolver.js",
  "js/enrichment/enrichmentPipeline.js",
  "js/enrichment/liveGeographyAuthority.js",
  "js/enrichment/shadowEnrichment.js",
].forEach(load);

const header = "USGI NET PREMIUM,Month,INTERMEDIARY,BA NAME,Ba Code,LINE OF BUSINESS,BRANCH NAME,Zone,STATE,SUM IMD CODE,POLICY ISSUED DATE";
const csv = `${header}\n100,Aug-26,IB,RM One,RM001,Health,Guwahati Main,North,Assam,00123,24/08/2026`;
const fact = BancaTrackerCsvProcessor.process(csv, BancaTrackerConfig).rows[0];

assert.strictEqual(fact.baCode, "RM001");
assert.strictEqual(fact.branchCode, "00123");
assert.strictEqual(fact.imd, "00123");
assert.notStrictEqual(fact.baCode, fact.branchCode);

const adapted = BancaTrackerShadowEnrichment.adaptRecord(fact);
assert.strictEqual(adapted.rmId, "RM001");
assert.strictEqual(adapted.rmName, "RM One");
assert.strictEqual(adapted.branchCode, "00123");
assert.strictEqual(adapted.branchName, "Guwahati Main");

const withoutBranchCode = BancaTrackerShadowEnrichment.adaptRecord({
  premium: 100,
  bank: "IB",
  baCode: "RM001",
  rm: "RM One",
  branch: "Unknown Branch",
});
assert.strictEqual(withoutBranchCode.rmId, "RM001");
assert.strictEqual(withoutBranchCode.branchCode, null);

const geography = BancaTrackerGeographyMaster.prepareDataset([
  { "STATE ID": "IN-AS", "STATE CODE": "AS", "STATE NAME": "Assam", "ZONE ID": "EAST", "ZONE NAME": "East", ACTIVE: "TRUE" },
], "GEOGRAPHY_MASTER:IDENTITY");
const branches = BancaTrackerBranchMaster.prepareDataset([
  { "BANK ID": "IB", "BRANCH CODE": "00123", "BRANCH NAME": "Guwahati Main", "STATE ID": "IN-AS", ACTIVE: "TRUE" },
  { "BANK ID": "IB", "BRANCH CODE": "00017", "BRANCH NAME": "Dibrugarh Main", "STATE ID": "IN-AS", ACTIVE: "TRUE" },
  { "BANK ID": "IB", "BRANCH CODE": "RM001", "BRANCH NAME": "Must Not Match", "STATE ID": "IN-AS", ACTIVE: "TRUE" },
], "BRANCH_MASTER:IDENTITY", { geographyRecords: geography.records });
const context = {
  geographyMaps: BancaTrackerGeographyResolver.buildLookupMaps(geography.records),
  branchMaps: BancaTrackerBranchResolver.buildLookupMaps(branches.records),
};

const exact = BancaTrackerLiveGeographyAuthority.applyRecord(fact, context);
assert.strictEqual(exact.branchResolutionStatus, "MATCHED_EXACT");
assert.strictEqual(exact.geographyAuthority, "GOVERNED_BRANCH");

const stateGoverned = BancaTrackerLiveGeographyAuthority.applyRecord({
  ...fact,
  branchCode: "",
  branch: "Unknown Branch",
  state: "Assam",
}, context);
assert.strictEqual(stateGoverned.branchResolutionStatus, "UNMAPPED");
assert.strictEqual(stateGoverned.geographyAuthority, "GOVERNED_SOURCE_STATE");
assert.strictEqual(stateGoverned.zone, "East");

const distinct = BancaTrackerShadowEnrichment.adaptRecord({
  ...fact,
  baCode: "RM482",
  branchCode: "00017",
  branch: "Dibrugarh Main",
});
const enriched = BancaTrackerEnrichmentPipeline.enrichTransaction(distinct, context);
assert.strictEqual(enriched.transaction.sourceRmId, "RM482");
assert.strictEqual(enriched.transaction.branchCode, "00017");
assert.strictEqual(enriched.transaction.branchId, "IB:00017");

const assignments = BancaTrackerBranchAssignmentMaster.prepareDataset([
  { "BANK ID": "IB", "BRANCH CODE": "00017", "RM ID": "RM501", ACTIVE: "TRUE" },
], "BRANCH_ASSIGNMENT:IDENTITY", { branchRecords: branches.records });
const assignment = BancaTrackerAssignmentResolver.resolveAssignment(
  { bankId: "IB", branchCode: "00017" },
  BancaTrackerAssignmentResolver.buildLookupMaps(assignments.records),
);
assert.strictEqual(assignment.branchId, "IB:00017");
assert.strictEqual(assignment.rmId, "RM501");
assert.strictEqual(enriched.transaction.sourceRmId, "RM482");

console.log("Step 4C.1 tests passed: PR RM and Branch identities remain distinct, leading zeros survive, missing Branch Code never falls back to BA Code, and geography/assignment resolution use Branch Code.");
