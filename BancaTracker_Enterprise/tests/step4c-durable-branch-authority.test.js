/* Step 4C: durable Branch Master identity authority. */
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
  "js/enrichment/liveGeographyAuthority.js", "js/enrichment/shadowEnrichment.js",
].forEach(load);

const geography = BancaTrackerGeographyMaster.prepareDataset([
  { "STATE ID": "IN-AS", "STATE CODE": "AS", "STATE NAME": "Assam", "ZONE ID": "EAST", "ZONE NAME": "East", ACTIVE: "TRUE" },
], "GEOGRAPHY_MASTER:4C");
const branches = BancaTrackerBranchMaster.prepareDataset([
  { "BANK ID": "IB", "BRANCH CODE": "00123", "BRANCH NAME": "Guwahati Main", "STATE ID": "IN-AS", "BANK REGION ID": "NER", "BANK ZONE ID": "BZ1", "FGM OFFICE ID": "FGM1", ACTIVE: "TRUE" },
  { "BANK ID": "IB", "BRANCH CODE": "00456", "BRANCH NAME": "Main", "STATE ID": "IN-AS", ACTIVE: "TRUE" },
  { "BANK ID": "IB", "BRANCH CODE": "00789", "BRANCH NAME": "Main", "STATE ID": "IN-AS", ACTIVE: "TRUE" },
  { "BANK ID": "IB", "BRANCH CODE": "00017", "BRANCH NAME": "Dibrugarh", "STATE ID": "IN-AS", ACTIVE: "TRUE" },
], "BRANCH_MASTER:4C", { geographyRecords: geography.records });
const context = {
  geographyMaps: BancaTrackerGeographyResolver.buildLookupMaps(geography.records),
  branchMaps: BancaTrackerBranchResolver.buildLookupMaps(branches.records),
};
const BranchAuthority = BancaTrackerLiveBranchAuthority;
const GeographyAuthority = BancaTrackerLiveGeographyAuthority;
const Shadow = BancaTrackerShadowEnrichment;

function source(overrides = {}) {
  return {
    premium: 15000, month: "Aug-26", day: 24, policyIssuedDate: "24/08/2026",
    dateAuthority: "CANONICAL", bank: "IB", baCode: "RM482", rm: "RM Name",
    branchCode: "00123", branch: "Guwahati Main Old", state: "Assam", zone: "North",
    imd: "00123", ...overrides,
  };
}

const legacy = BranchAuthority.applyRecord(source(), { branchMaps: null });
assert.strictEqual(legacy.branchAuthority, "LEGACY_FALLBACK");
assert.strictEqual(legacy.branchId, null);
assert.strictEqual(legacy.branch, "Guwahati Main Old");

const exact = BranchAuthority.applyRecord(source(), context);
assert.deepStrictEqual(
  [exact.branchAuthority, exact.branchId, exact.branchCode, exact.branch, exact.legacyBranchName],
  ["GOVERNED_EXACT", "IB:00123", "00123", "Guwahati Main", "Guwahati Main Old"],
);
assert.strictEqual(exact.baCode, "RM482");
assert.deepStrictEqual([exact.bankRegionId, exact.bankZoneId, exact.fgmOfficeId], ["NER", "BZ1", "FGM1"]);

const fallback = BranchAuthority.applyRecord(source({ branchCode: "99999", branch: "Dibrugarh" }), context);
assert.deepStrictEqual([fallback.branchAuthority, fallback.branchId], ["GOVERNED_FALLBACK", "IB:00017"]);

const ambiguous = BranchAuthority.applyRecord(source({ branchCode: "", branch: "Main" }), context);
assert.deepStrictEqual([ambiguous.branchAuthority, ambiguous.branchId], ["AMBIGUOUS", null]);

const unmapped = BranchAuthority.applyRecord(source({ premium: -25, branchCode: "99999", branch: "Unknown" }), context);
assert.deepStrictEqual([unmapped.branchAuthority, unmapped.branchId, unmapped.premium], ["UNMAPPED", null, -25]);

const rows = [
  exact,
  BranchAuthority.applyRecord(source({ premium: 12000, branch: "Guwahati Main" }), context),
  BranchAuthority.applyRecord(source({ premium: 100, branchCode: "00456", branch: "Main" }), context),
  BranchAuthority.applyRecord(source({ premium: 200, branchCode: "00789", branch: "Main" }), context),
  ambiguous,
  unmapped,
];
const total = rows.reduce((sum, row) => sum + row.premium, 0);
const derived = BancaTrackerAnalytics.build(rows);
assert.strictEqual(derived.totalPremium, total);
assert.strictEqual(derived.branches.length, 3);
assert.strictEqual(derived.branchesByKey["IB:00123"].premium, 27000);
assert.strictEqual(derived.activeBranches.length, 1);
assert.strictEqual(derived.bankBranchMetrics.IB.premium, total);
assert.strictEqual(derived.bankBranchMetrics.IB.observed, 3);

const productContext = { currentPeriodData: rows, currentPeriodMonth: "Aug-26", currentPeriodIsUnconfigured: false, ytdData: rows };
const productivity = BancaTrackerProductivity.build(productContext, derived, null);
assert.strictEqual(productivity.branchMetrics.length, 3);
assert.ok(productivity.branchMetrics.some((branch) => branch.key === "IB:00123"));

const governedGeography = GeographyAuthority.applyRecord(exact, context);
assert.deepStrictEqual([governedGeography.geographyAuthority, governedGeography.stateId, governedGeography.zone], ["GOVERNED_BRANCH", "IN-AS", "East"]);
const invalidDate = GeographyAuthority.applyRecord(BranchAuthority.applyRecord(source({ dateAuthority: "INVALID", month: null, day: null }), context), context);
assert.deepStrictEqual([invalidDate.dateAuthority, invalidDate.branchId, invalidDate.branchAuthority], ["INVALID", "IB:00123", "GOVERNED_EXACT"]);

const unknownBank = BranchAuthority.applyRecord(source({ bank: "UNKNOWN BANK" }), context);
assert.deepStrictEqual([unknownBank.bank, unknownBank.branchId, unknownBank.branchAuthority], ["UNKNOWN BANK", null, "UNMAPPED"]);

for (const live of [exact, fallback, ambiguous, unmapped]) {
  const shadow = BancaTrackerEnrichmentPipeline.enrichTransaction(Shadow.adaptRecord(live), context);
  assert.strictEqual(shadow.transaction.branchId, live.branchId);
  assert.strictEqual(shadow.resolution.branch.status, live.branchResolutionStatus);
  assert.strictEqual(shadow.transaction.sourceRmId, "RM482");
}

assert.deepStrictEqual(Shadow.buildBranchAuthoritySummary(rows), {
  governedExact: 4, governedFallback: 0, legacyFallback: 0,
  unmapped: 1, ambiguous: 1, unspecified: 0,
});
assert.deepStrictEqual(Shadow.buildBranchAuthoritySummary([exact, fallback, legacy, unmapped, ambiguous]), {
  governedExact: 1, governedFallback: 1, legacyFallback: 1,
  unmapped: 1, ambiguous: 1, unspecified: 0,
});
assert.strictEqual(BancaTrackerConfig.TOTAL_BRANCHES["INDIAN BANK"], 6022);

console.log("Step 4C tests passed: durable branch authority, governed grouping, activation numerator, legacy/unmapped safety, geography, shadow alignment, and configured denominator preservation.");
