/* Step 6B.2: executable contract for future effective-dated branch eligibility. */
"use strict";

const assert = require("assert");
const path = require("path");

global.window = global;
const load = (file) => require(path.join(__dirname, "..", file));
[
  "js/config.js",
  "js/data/schema.js",
  "js/data/datasetRegistry.js",
  "js/masters/branchMaster.js",
  "js/enrichment/liveBranchUniverseAuthority.js",
].forEach(load);

const Master = BancaTrackerBranchMaster;
const Authority = BancaTrackerLiveBranchUniverseAuthority;
const AUGUST = "2026-08";
const SEPTEMBER = "2026-09";

/*
 * Future boundary: a pure resolver over supplied normalized Branch Master rows.
 *
 * resolveEligibleUniverse({ records, periodKey, bankId? }) must return:
 *   { status, eligibleBranchIds, eligibleByBank, diagnostics }
 *
 * `eligibleBranchIds` is distinct durable BANK_ID:BRANCH_CODE membership.
 * `eligibleByBank` is a count by resolved Bank identity. Diagnostics expose
 * semantic counts, including explicit-effective and legacy-undated admission.
 * This test intentionally remains outside run-all until that authority exists.
 */
function resolveEligibleUniverse(records, periodKey, bankId) {
  return Authority.resolveEligibleUniverse({ records, periodKey, bankId });
}

function branch(bankId, branchCode, options = {}) {
  const raw = {
    "BANK ID": bankId,
    "BRANCH CODE": branchCode,
    "BRANCH NAME": options.branchName || `Synthetic ${bankId} ${branchCode}`,
    "STATE ID": "SYNTHETIC-STATE",
    ACTIVE: String(options.active === undefined ? true : options.active).toUpperCase(),
  };
  if (options.activationEligible !== undefined) raw["ACTIVATION ELIGIBLE"] = String(options.activationEligible).toUpperCase();
  if (options.validFrom !== undefined) raw["VALID FROM"] = options.validFrom;
  if (options.validTo !== undefined) raw["VALID TO"] = options.validTo;
  const record = Master.normalizeRow(raw, "BRANCH_MASTER:6B2", options.rowNumber || 2);
  return { ...record, canonicalBank: options.canonicalBank === undefined ? bankId : options.canonicalBank };
}

function ids(result) { return [...result.eligibleBranchIds].sort(); }
function assertMembership(result, expectedStatus, expectedIds) {
  assert.strictEqual(result.status, expectedStatus);
  assert.deepStrictEqual(ids(result), expectedIds.slice().sort());
  assert.strictEqual(result.diagnostics.eligibleCount, expectedIds.length);
}

const records = [
  branch("TESTBANK", "B001", { validFrom: "2026-04-01", activationEligible: true }),
  branch("TESTBANK", "B002", { validFrom: "2026-04-01", activationEligible: true }),
  branch("TESTBANK", "B003", { validFrom: "2026-04-01", activationEligible: true }),
  branch("TESTBANK", "B004", { validFrom: "2026-04-01", validTo: "2026-08-31", active: false, activationEligible: true }),
  branch("TESTBANK", "B005", { validFrom: "2026-09-01", activationEligible: true }),
  branch("TESTBANK", "B006", { validFrom: "2026-10-01", activationEligible: true }),
  branch("TESTBANK", "B007", { validFrom: "2026-04-01", activationEligible: false }),
  branch("TESTBANK", "B008", { activationEligible: true }),
  branch("TESTBANK", "B010", { validFrom: "2026-04-01", activationEligible: true }),
  branch("OTHERBANK", "B010", { validFrom: "2026-04-01", activationEligible: true }),
];

const invalidRange = branch("TESTBANK", "B009", {
  validFrom: "2026-09-01", validTo: "2026-08-31", activationEligible: true,
});
const edgeRecords = [
  branch("TESTBANK", "START", { validFrom: "2026-08-01", activationEligible: true }),
  branch("TESTBANK", "END", { validTo: "2026-08-31", activationEligible: true }),
  branch("TESTBANK", "MIDSTART", { validFrom: "2026-08-16", activationEligible: true }),
  branch("TESTBANK", "MIDEND", { validTo: "2026-08-16", activationEligible: true }),
  branch("TESTBANK", "OPENSTART", { validTo: "2026-08-31", activationEligible: true }),
  branch("TESTBANK", "OPENEND", { validFrom: "2026-08-01", activationEligible: true }),
];
const missingEligibility = branch("TESTBANK", "MISSING_ELIGIBILITY", { validFrom: "2026-04-01" });
const unknownBank = branch("UNKNOWNBANK", "UNKNOWN", {
  validFrom: "2026-04-01", activationEligible: true, canonicalBank: null,
});

// Existing normalization supplies durable identities and preserves raw date values.
assert.deepStrictEqual(
  [records[8].branchId, records[9].branchId, records[3].active, records[7].validFrom, records[7].validTo],
  ["TESTBANK:B010", "OTHERBANK:B010", false, null, null],
);
assert.strictEqual(typeof Authority.buildFromBranchMaster, "function");

// Intentional current failure: Step 6B.3 must add this period-aware authority.
assert.strictEqual(
  typeof Authority.resolveEligibleUniverse,
  "function",
  "CONTRACT GAP: Step 6B.3 must expose a pure period-aware effective-dated eligible-universe resolver; current snapshot APIs cannot resolve historical membership.",
);

const august = resolveEligibleUniverse(records, AUGUST);
assertMembership(august, "GOVERNED_MIXED_TEMPORAL", [
  "TESTBANK:B001", "TESTBANK:B002", "TESTBANK:B003", "TESTBANK:B004",
  "TESTBANK:B008", "TESTBANK:B010", "OTHERBANK:B010",
]);
assert.strictEqual(august.diagnostics.explicitEffectiveEligibleCount, 6);
assert.strictEqual(august.diagnostics.legacyUndatedAdmittedCount, 1);
assert.strictEqual(august.diagnostics.excludedBeforeValidFromCount, 2);
assert.strictEqual(august.diagnostics.excludedActivationEligibleFalseCount, 1);
assert.strictEqual(august.diagnostics.unknownBankCount, 0);
assert.deepStrictEqual(august.eligibleByBank, { OTHERBANK: 1, TESTBANK: 6 });

const september = resolveEligibleUniverse(records, SEPTEMBER);
assertMembership(september, "GOVERNED_MIXED_TEMPORAL", [
  "TESTBANK:B001", "TESTBANK:B002", "TESTBANK:B003", "TESTBANK:B005",
  "TESTBANK:B008", "TESTBANK:B010", "OTHERBANK:B010",
]);
assert.strictEqual(september.diagnostics.excludedAfterValidToCount, 1);

// B002 and B003 deliberately have no PR fixture: eligibility is independent of production.
assert.ok(ids(september).includes("TESTBANK:B002"));
assert.ok(ids(september).includes("TESTBANK:B003"));

const explicitOnly = resolveEligibleUniverse(records.filter((record) => record.branchCode !== "B008"), AUGUST);
assertMembership(explicitOnly, "EFFECTIVE_DATED_GOVERNED", [
  "TESTBANK:B001", "TESTBANK:B002", "TESTBANK:B003", "TESTBANK:B004",
  "TESTBANK:B010", "OTHERBANK:B010",
]);
assert.strictEqual(explicitOnly.diagnostics.legacyUndatedAdmittedCount, 0);

const legacyOnly = resolveEligibleUniverse([records[7]], AUGUST);
assertMembership(legacyOnly, "GOVERNED_LEGACY_UNDATED", ["TESTBANK:B008"]);
assert.strictEqual(legacyOnly.diagnostics.explicitEffectiveEligibleCount, 0);
assert.strictEqual(legacyOnly.diagnostics.legacyUndatedAdmittedCount, 1);
assert.strictEqual(legacyOnly.diagnostics.historicalMembershipTemporallyProven, false);

const edges = resolveEligibleUniverse(edgeRecords, AUGUST);
assertMembership(edges, "EFFECTIVE_DATED_GOVERNED", [
  "TESTBANK:START", "TESTBANK:END", "TESTBANK:MIDSTART", "TESTBANK:MIDEND",
  "TESTBANK:OPENSTART", "TESTBANK:OPENEND",
]);

const invalidRangeResult = resolveEligibleUniverse([invalidRange], AUGUST);
assert.strictEqual(invalidRangeResult.status, "UNAVAILABLE");
assert.deepStrictEqual(ids(invalidRangeResult), []);
assert.strictEqual(invalidRangeResult.diagnostics.invalidDateRangeCount, 1);

const incompleteEligibility = resolveEligibleUniverse([missingEligibility], AUGUST);
assert.strictEqual(incompleteEligibility.status, "UNAVAILABLE");
assert.deepStrictEqual(ids(incompleteEligibility), []);
assert.strictEqual(incompleteEligibility.diagnostics.missingActivationEligibleCount, 1);

const unknownBankResult = resolveEligibleUniverse([unknownBank], AUGUST);
assert.strictEqual(unknownBankResult.status, "UNAVAILABLE");
assert.deepStrictEqual(ids(unknownBankResult), []);
assert.strictEqual(unknownBankResult.diagnostics.unknownBankCount, 1);

for (const invalidPeriod of ["Aug-26", "2026-13", "", null]) {
  const invalid = resolveEligibleUniverse(records, invalidPeriod);
  assert.strictEqual(invalid.status, "INVALID_PERIOD");
  assert.deepStrictEqual(ids(invalid), []);
}

const duplicate = resolveEligibleUniverse([records[0], { ...records[0], sourceRowNumber: 99 }], AUGUST);
assert.ok(
  duplicate.status === "EFFECTIVE_DATED_GOVERNED" || duplicate.status === "LEGACY_CONFIGURED_FALLBACK" || duplicate.status === "UNAVAILABLE",
  "duplicate durable identity must be deduplicated or explicitly rejected; it must never be counted twice",
);
assert.ok(ids(duplicate).length <= 1);

console.log("Step 6B.2 contract tests passed: effective-dated eligibility, provenance, boundaries, diagnostics, and identity invariants.");
