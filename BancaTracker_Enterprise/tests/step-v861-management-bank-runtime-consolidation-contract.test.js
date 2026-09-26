/* v8.6.1 permanent foundational regression contract for the Management Bank runtime authority. */
"use strict";

const assert = require("assert");
const path = require("path");

global.window = global;
const load = (file) => require(path.join(__dirname, "..", file));
[
  "js/config.js",
  "js/utilities.js",
  "js/targetSeasonality.js",
  "js/analytics/managementBank.js",
].forEach(load);

/*
 * Future pure/additive boundary (no DOM, storage, mutation, fuzzy matching, or
 * Commercial Budget/Potential input):
 *
 * BancaTrackerManagementBank.resolve(sourceBank)
 *   => { status, sourceBank, managementBank, subChannel }
 * BancaTrackerManagementBank.enrichFacts(facts)
 * BancaTrackerManagementBank.consolidateActuals(facts)
 * BancaTrackerManagementBank.filterFacts(facts, managementBank)
 * BancaTrackerManagementBank.resolveBudget(managementBank, flatTargets)
 * BancaTrackerManagementBank.buildMetrics(facts, flatTargets)
 *
 * This foundational contract test is a permanent regression test for the
 * implemented runtime authority.
 */
const Authority = global.BancaTrackerManagementBank || {};

assert.strictEqual(
  typeof Authority.resolve,
  "function",
  "CONTRACT GAP: v8.6.1 Step 2 must expose BancaTrackerManagementBank.resolve as a pure exact-mapping authority.",
);
[
  "enrichFacts", "consolidateActuals", "filterFacts", "resolveBudget", "buildMetrics",
].forEach((name) => assert.strictEqual(typeof Authority[name], "function", `CONTRACT GAP: Management Bank authority must expose ${name}().`));

function fact(bank, premium, suffix, overrides = {}) {
  return {
    bank, premium, canonicalBank: overrides.canonicalBank || bank,
    branch: `Branch ${suffix}`, branchId: `BANK:${suffix}`, branchCode: suffix,
    imd: `IMD-${suffix}`, baCode: `BA-${suffix}`, rm: `RM ${suffix}`,
    assignedRmId: `ARM-${suffix}`, lob: "Motor", businessType: "New",
    productCode: `P-${suffix}`, productName: `Product ${suffix}`,
    ...overrides,
  };
}

const expectedMappings = [
  ["INDIAN BANK", "INDIAN BANK", "CORE"],
  ["INDIAN BANK (PMSBY)", "INDIAN BANK", "PMSBY"],
  ["INDIAN OVERSEAS BANK", "INDIAN OVERSEAS BANK", "CORE"],
  ["INDIAN OVERSEAS BANK (PMSBY)", "INDIAN OVERSEAS BANK", "PMSBY"],
];

// A/B — exact governed source mapping and explicit CORE/PMSBY classification.
expectedMappings.forEach(([sourceBank, managementBank, subChannel]) => {
  assert.deepStrictEqual(Authority.resolve(sourceBank), {
    status: "GOVERNED", sourceBank, managementBank, subChannel,
  });
});

// C — labels that merely look like scheme children never map by string inference.
[
  "KARNATAKA BANK LTD. (PMSBY)",
  "INDIAN BANK (PMSBY EXTRA)",
  "PMSBY - INDIAN BANK",
  "ODISHA GRAMIN BANK (PMSBY)",
  "TAMIL NADU BANK (PMSBY)",
].forEach((sourceBank) => assert.deepStrictEqual(Authority.resolve(sourceBank), {
  status: "UNMAPPED", sourceBank, managementBank: null, subChannel: null,
}));

// D/E — exact configured identities may self-map; unknown identities may not.
["KARNATAKA BANK LTD.", "ODISHA GRAMEEN BANK", "TAMIL NADU GRAMA BANK", "OTHER"].forEach((sourceBank) => {
  assert.deepStrictEqual(Authority.resolve(sourceBank), {
    status: "LEGACY_SELF_MAPPED", sourceBank, managementBank: sourceBank, subChannel: "CORE",
  });
});
assert.strictEqual(Authority.resolve("UNLISTED BANK").status, "UNMAPPED");
assert.strictEqual(Authority.resolve("").status, "INVALID");
assert.strictEqual(Authority.resolve(null).status, "INVALID");

const facts = [
  fact("INDIAN BANK", 80, "IB-CORE"),
  fact("INDIAN BANK (PMSBY)", 20, "IB-PMSBY", { canonicalBank: "INDIAN BANK (PMSBY)" }),
  fact("INDIAN OVERSEAS BANK", 50, "IOB-CORE"),
  fact("INDIAN OVERSEAS BANK (PMSBY)", 10, "IOB-PMSBY"),
  fact("OTHER", 40, "OTHER"),
];

// F/G — atomic facts roll up once; All Banks remains the accepted atomic total.
const consolidated = Authority.consolidateActuals(facts);
assert.strictEqual(consolidated.atomicActual, 200);
assert.strictEqual(consolidated.mappedActual, 200);
assert.strictEqual(consolidated.unmappedActual, 0);
assert.deepStrictEqual(consolidated.rows.map((row) => [row.managementBank, row.actual]), [
  ["INDIAN BANK", 100],
  ["INDIAN OVERSEAS BANK", 60],
  ["OTHER", 40],
]);
assert.strictEqual(consolidated.rows.reduce((sum, row) => sum + row.actual, 0) + consolidated.unmappedActual, consolidated.atomicActual);

const withUnmapped = Authority.consolidateActuals(facts.concat(fact("UNLISTED BANK", 7, "UNKNOWN")));
assert.strictEqual(withUnmapped.atomicActual, 207);
assert.strictEqual(withUnmapped.mappedActual, 200);
assert.strictEqual(withUnmapped.unmappedActual, 7);

// H — the exact parent owns Management Budget; a PMSBY flat Target is not additive.
const flatTargets = { "INDIAN BANK": 120, "INDIAN BANK (PMSBY)": 25, "INDIAN OVERSEAS BANK": 75 };
assert.deepStrictEqual(Authority.resolveBudget("INDIAN BANK", flatTargets), {
  status: "PARENT_AUTHORITATIVE", managementBank: "INDIAN BANK", budget: 120,
});
assert.notStrictEqual(Authority.resolveBudget("INDIAN BANK", flatTargets).budget, 145);

// I/J — calculate percentages from consolidated amounts and the atomic denominator.
const metrics = Authority.buildMetrics(facts, flatTargets);
assert.deepStrictEqual(metrics.rows.map((row) => [row.managementBank, row.actual, row.budget, row.contributionPercent]), [
  ["INDIAN BANK", 100, 120, 50],
  ["INDIAN OVERSEAS BANK", 60, 75, 30],
  ["OTHER", 40, null, 20],
]);
assert.strictEqual(metrics.rows.find((row) => row.managementBank === "INDIAN BANK").achievementPercent, 100 / 120 * 100);
assert.ok(Math.abs(metrics.rows.reduce((sum, row) => sum + row.contributionPercent, 0) - 100) < 1e-10);

// K/L — parent filtering includes governed children while preserving child identity.
const indian = Authority.filterFacts(facts, "INDIAN BANK");
assert.deepStrictEqual(indian.map((row) => row.bank), ["INDIAN BANK", "INDIAN BANK (PMSBY)"]);
assert.deepStrictEqual(indian.map((row) => row.subChannel), ["CORE", "PMSBY"]);

// M/N — operational attribution survives and canonicalBank is never mutated.
const enriched = Authority.enrichFacts(facts);
const pmsby = enriched.find((row) => row.bank === "INDIAN BANK (PMSBY)");
[
  "bank", "branch", "branchId", "branchCode", "imd", "baCode", "rm",
  "assignedRmId", "lob", "businessType", "productCode", "productName",
].forEach((field) => assert.strictEqual(pmsby[field], facts[1][field], `${field} must survive enrichment`));
assert.strictEqual(pmsby.canonicalBank, "INDIAN BANK (PMSBY)");
assert.strictEqual(pmsby.managementBank, "INDIAN BANK");

// O — existing seasonality remains exact-flat-Bank authority; Management consumers
// request the parent Bank rather than combining parent and child curves.
const seasonality = BancaTrackerTargetSeasonality.resolve({ records: [], fiscalYear: "FY2026-27", bank: "INDIAN BANK" });
assert.strictEqual(seasonality.status, "EQUAL_MONTH_FALLBACK");
assert.strictEqual(seasonality.scope, "INDIAN BANK");

// P — this contract imports neither Productivity nor Activation and requires no
// mutation to their APIs or source/branch identity semantics.
assert.strictEqual(global.BancaTrackerProductivity, undefined);
assert.strictEqual(global.BancaTrackerActivation, undefined);

console.log("v8.6.1 Management Bank runtime consolidation contract tests passed.");
