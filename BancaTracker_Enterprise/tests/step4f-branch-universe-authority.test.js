/* Step 4F: governed Branch Universe activation-denominator authority. */
"use strict";

const assert = require("assert");
const path = require("path");
global.window = global;
const elements = new Map();
function element(id) {
  if (!elements.has(id)) elements.set(id, { innerHTML: "", textContent: "", dataset: {}, addEventListener() {} });
  return elements.get(id);
}
global.document = { getElementById: element };
const load = (file) => require(path.join(__dirname, "..", file));
[
  "js/config.js", "js/utilities.js", "js/analytics.js", "js/data/schema.js",
  "js/data/datasetRegistry.js", "js/masters/geographyMaster.js",
  "js/masters/branchMaster.js", "js/enrichment/branchResolver.js",
  "js/enrichment/liveBranchUniverseAuthority.js", "js/enrichment/liveBranchAuthority.js",
  "js/activation.js", "js/scorecard.js",
  "js/enrichment/readinessDiagnostics.js",
].forEach(load);

const Authority = BancaTrackerLiveBranchUniverseAuthority;
function record(bankId, branchCode, eligible, active = true, branchName = `Branch ${branchCode}`) {
  return BancaTrackerBranchMaster.normalizeRow({
    "BANK ID": bankId, "BRANCH CODE": branchCode, "BRANCH NAME": branchName,
    "STATE ID": "IN-AS", ACTIVE: String(active).toUpperCase(),
    "ACTIVATION ELIGIBLE": String(eligible).toUpperCase(),
  }, "BRANCH_MASTER:4F", 2);
}

const noMaster = Authority.buildFromBranchMaster([]);
assert.deepStrictEqual(
  [noMaster.authority, noMaster.reason, noMaster.universeStatus, Authority.getBankUniverse("INDIAN BANK", noMaster)],
  ["LEGACY_FALLBACK", "BRANCH_MASTER_ABSENT", "NOT_READY", 6022],
);

const incomplete = Authority.buildFromBranchMaster([{
  ...record("IB", "00001", true), activationEligible: null, activationEligibilitySupplied: false,
}]);
assert.deepStrictEqual([incomplete.authority, incomplete.reason, incomplete.universeStatus], ["LEGACY_FALLBACK", "UNIVERSE_INCOMPLETE", "INCOMPLETE"]);
assert.strictEqual(Authority.getBankUniverse("INDIAN BANK", incomplete), 6022);

const notReady = Authority.buildFromBranchMaster([record("UNKNOWN", "00001", true)]);
assert.deepStrictEqual([notReady.authority, notReady.reason, notReady.universeStatus], ["LEGACY_FALLBACK", "UNIVERSE_NOT_READY", "NOT_READY"]);
assert.strictEqual(Authority.getBankUniverse("INDIAN BANK", notReady), 6022, "NOT_READY cannot partially govern");

const eligibilityRule = Authority.buildFromBranchMaster([
  record("IB", "01001", true), record("IB", "01002", true),
  record("IB", "01003", false), record("IB", "01004", true, false),
]);
assert.strictEqual(eligibilityRule.governed.total, 2);

const readyRecords = [
  record("IB", "00123", true, true, "Shared Name"),
  record("IB", "00124", true, true, "Shared Name"),
  record("IB", "00125", true),
  record("IB", "00126", false),
  record("IB", "00127", true, false),
  record("IOB", "00001", true), record("IOB", "00002", true),
  record("KB", "00001", true),
];
const ready = Authority.buildFromBranchMaster(readyRecords);
assert.deepStrictEqual([ready.authority, ready.reason, ready.universeStatus], ["GOVERNED", "UNIVERSE_READY", "READY"]);
assert.strictEqual(ready.governed.total, 6);
assert.deepStrictEqual(ready.governed.byBank, {
  "INDIAN BANK": 3, "INDIAN OVERSEAS BANK": 2, "KARNATAKA BANK LTD.": 1,
});
assert.strictEqual(ready.governed.byBank["INDIAN BANK"], 3, "zero-transaction eligible branches remain counted");
assert.ok(readyRecords.some((item) => item.branchId === "IB:00123"));
assert.strictEqual(ready.governed.byBank["INDIAN BANK"], 3, "same display name does not collapse durable IDs");
assert.deepStrictEqual(ready.variance.byBank["INDIAN BANK"], {
  legacyConfigured: 6022, governedEligible: 3, variance: -6019,
});

const custom = Authority.buildFromBranchMaster(
  Array.from({ length: 8 }, (_, index) => record("IB", String(index + 1).padStart(5, "0"), true)),
  { config: { TOTAL_BRANCHES: { "INDIAN BANK": 10 }, BANK_ID_ALIASES: { IB: "INDIAN BANK" }, BANK_ALIASES: {} } },
);
assert.deepStrictEqual(custom.variance.byBank["INDIAN BANK"], {
  legacyConfigured: 10, governedEligible: 8, variance: -2,
});

// Activation page and Scorecard share the same governed or fallback denominator.
Authority.setUniverse(Authority.buildFromBranchMaster([
  record("IB", "00001", true), record("IB", "00002", true),
  record("IB", "00003", true), record("IB", "00004", true),
]));
const derived = {
  totalPremium: 100, branches: [], activeBranches: [], nearActiveBranches: [], branchBands: {}, zones: {}, states: {},
  bankBranchMetrics: { "INDIAN BANK": { premium: 100, observed: 2, active: 2, nearActive: 0 } },
};
const activationMetric = BancaTrackerActivation.buildBankMetrics(derived).find((item) => item.bank === "INDIAN BANK");
assert.deepStrictEqual([activationMetric.denominator, activationMetric.activationPercent], [4, 50]);
const audit = { hierarchyConflicts: [], branchUniverseSanity: [], baCodeConflicts: [], productConflicts: [], bankQuality: { unknownBanks: [] } };
const productivity = { bankIndexes: { "INDIAN BANK": { rms: [], imds: [], branches: [], opportunities: [] } } };
const governedScore = BancaTrackerScorecard.buildPartnerMetrics(derived, productivity, audit, "INDIAN BANK")[0];
assert.deepStrictEqual([governedScore.branchUniverse, governedScore.activationPercent, governedScore.priority], [4, 50, "LOW"]);

Authority.setUniverse(incomplete);
const legacyActivation = BancaTrackerActivation.buildBankMetrics(derived).find((item) => item.bank === "INDIAN BANK");
const legacyScore = BancaTrackerScorecard.buildPartnerMetrics(derived, productivity, audit, "INDIAN BANK")[0];
assert.deepStrictEqual([legacyActivation.denominator, legacyScore.branchUniverse, legacyScore.activationPercent, legacyScore.priority], [6022, 6022, 200 / 6022, "MEDIUM"]);
assert.strictEqual(Authority.getBankUniverse("INDIAN OVERSEAS BANK"), 3561, "fallback is global, not hybrid");

// Unknown and unresolved facts retain premium without creating numerator or denominator members.
Authority.setUniverse(ready);
const factDerived = BancaTrackerAnalytics.build([
  { bank: "UNLISTED BANK", premium: 75, branch: "Unknown", branchAuthority: "UNMAPPED", baCode: "SRC", rm: "Source RM" },
  { bank: "INDIAN BANK", premium: -25, branch: "Ambiguous", branchAuthority: "AMBIGUOUS", baCode: "SRC", rm: "Source RM", dateAuthority: "INVALID" },
]);
assert.strictEqual(factDerived.totalPremium, 50);
assert.strictEqual(factDerived.branches.length, 0);
assert.strictEqual(Authority.getBankUniverse("UNLISTED BANK"), null);
const unknownScore = BancaTrackerScorecard.buildPartnerMetrics(
  { ...factDerived, bankBranchMetrics: { ...factDerived.bankBranchMetrics } },
  { bankIndexes: { "UNLISTED BANK": { rms: [], imds: [], branches: [], opportunities: [] }, "INDIAN BANK": { rms: [], imds: [], branches: [], opportunities: [] } } },
  { ...audit, bankQuality: { unknownBanks: ["UNLISTED BANK"] } }, "UNLISTED BANK",
)[0];
assert.deepStrictEqual([unknownScore.premium, unknownScore.branchUniverse, unknownScore.priority], [75, null, "UNCONFIGURED"]);
assert.strictEqual(factDerived.rms["Source RM"], 50, "source RM and signed premium semantics remain unchanged");

// Governed observed/active overruns produce explicit, uncapped DQ findings.
const overrun = Authority.assessObserved({
  bankBranchMetrics: { "INDIAN BANK": { observed: 5, active: 4, nearActive: 1 } },
}, Authority.buildFromBranchMaster([record("IB", "00001", true), record("IB", "00002", true)]));
assert.ok(overrun.findings.some((item) => item.code === "OBSERVED_BRANCHES_EXCEED_GOVERNED_UNIVERSE" && item.severity === "WARNING"));
assert.ok(overrun.findings.some((item) => item.code === "ACTIVE_BRANCHES_EXCEED_GOVERNED_UNIVERSE" && item.severity === "ERROR"));
assert.deepStrictEqual([overrun.observedGovernedBranches, overrun.activeGovernedBranches, overrun.nearActiveGovernedBranches], [5, 4, 1]);
global.BancaTrackerCore = { state: { derived: {
  bankBranchMetrics: { "INDIAN BANK": { observed: 5, active: 4, nearActive: 1 } },
} } };
Authority.setUniverse(Authority.buildFromBranchMaster([record("IB", "00001", true), record("IB", "00002", true)]));
load("js/canonicalDataQuality.js");
const dqModel = BancaTrackerCanonicalDataQuality.buildModel(null);
assert.deepStrictEqual(
  [dqModel.branchUniverseAuthority.authority, dqModel.branchUniverseAuthority.variance.byBank["INDIAN BANK"].governedEligible],
  ["GOVERNED", 2],
);
assert.ok(dqModel.findings.groups.some((item) => item.code === "OBSERVED_BRANCHES_EXCEED_GOVERNED_UNIVERSE"));
assert.ok(dqModel.findings.groups.some((item) => item.code === "ACTIVE_BRANCHES_EXCEED_GOVERNED_UNIVERSE"));

// Excluded active branches still resolve; inactive eligible branches are not denominator members.
const excludedRecord = record("IB", "00999", false);
const resolution = BancaTrackerBranchResolver.resolveBranch(
  { bankId: "IB", branchCode: "00999", branchName: excludedRecord.branchName },
  BancaTrackerBranchResolver.buildLookupMaps([excludedRecord]),
);
assert.deepStrictEqual([resolution.success, resolution.branchId], [true, "IB:00999"]);
assert.strictEqual(Authority.buildFromBranchMaster([record("IB", "00888", true, false)]).governed.total, 0);

// Readiness exposes the same live authority without changing branch-resolution status.
Authority.setUniverse(ready);
const readiness = BancaTrackerReadinessDiagnostics.buildReadiness(null);
assert.deepStrictEqual([readiness.branchUniverseAuthority.authority, readiness.branchUniverseAuthority.universeStatus], ["GOVERNED", "READY"]);

(async function () {
  let reads = 0;
  const context = await BancaTrackerLiveBranchAuthority.loadContext({
    async getActiveMasterRecords(type) {
      reads += 1;
      assert.strictEqual(type, "BRANCH_MASTER");
      return readyRecords;
    },
  });
  assert.strictEqual(reads, 1, "branch resolution and universe authority reuse one master read");
  assert.deepStrictEqual([context.branchUniverse.authority, context.branchMaps.branchById.size], ["GOVERNED", 7]);
  console.log("Step 4F tests passed: all-or-nothing universe authority, governed/fallback denominators, variance, shared Activation/Scorecard semantics, and DQ overruns.");
})().catch((error) => { console.error(error); process.exitCode = 1; });
