/* Step 4H: pure Commercial Performance aggregation authority. */
"use strict";

const assert = require("assert");
const path = require("path");
global.window = global;
const load = (file) => require(path.join(__dirname, "..", file));
load("js/analytics/commercialPerformance.js");
const Commercial = BancaTrackerCommercialPerformance;

function fact(branchId, monthKey, premium, extra = {}) {
  return { branchId, monthKey, premium, bankId: branchId && branchId.split(":")[0], branch: extra.branch || "Branch", ...extra };
}
function reference(branchId, periodKey, budget, potential, extra = {}) {
  return { branchId, periodKey, budget, potential, bankId: branchId.split(":")[0], branchName: extra.branchName || "Branch", ...extra };
}
function context(records, status = "READY") { return { status, records }; }
function build(facts, references, status = "READY") { return Commercial.buildPerformance(facts, context(references, status)); }

const basic = build([fact("IB:00123", "2026-08", 80)], [reference("IB:00123", "2026-08", 100, 200)]).rows[0];
assert.deepStrictEqual(
  [basic.actualPremium, basic.achievementPct, basic.budgetGap, basic.budgetRemaining, basic.potentialPenetrationPct, basic.potentialGap],
  [80, 80, -20, 20, 40, 120],
);
const over = build([fact("IB:00123", "2026-08", 120)], [reference("IB:00123", "2026-08", 100, 200)]).rows[0];
assert.deepStrictEqual([over.achievementPct, over.budgetGap, over.budgetRemaining], [120, 20, -20]);
const zeroBudget = build([fact("IB:00123", "2026-08", 50)], [reference("IB:00123", "2026-08", 0, 0)]).rows[0];
assert.deepStrictEqual([zeroBudget.achievementPct, zeroBudget.budgetGap, zeroBudget.budgetRemaining, zeroBudget.potentialPenetrationPct, zeroBudget.potentialGap], [null, 50, -50, null, -50]);
const nulls = build([fact("IB:00123", "2026-08", 50)], [reference("IB:00123", "2026-08", null, null)]).rows[0];
assert.deepStrictEqual([nulls.achievementPct, nulls.budgetGap, nulls.budgetRemaining, nulls.potentialPenetrationPct, nulls.potentialGap], [null, null, null, null, null]);
const negative = build([fact("IB:00123", "2026-08", -50)], [reference("IB:00123", "2026-08", 100, 200)]).rows[0];
assert.deepStrictEqual([negative.achievementPct, negative.budgetGap, negative.budgetRemaining, negative.potentialPenetrationPct, negative.potentialGap], [-50, -150, 150, -25, 250]);

const signed = Commercial.buildActuals([
  fact("IB:00123", "2026-08", 100), fact("IB:00123", "2026-08", 50),
  fact("IB:00123", "2026-08", -20), fact("IB:00123", "2026-08", 0),
]).rows[0];
assert.deepStrictEqual([signed.actualPremium, signed.transactionCount, signed.positiveCount, signed.zeroCount, signed.negativeCount], [130, 4, 2, 1, 1]);

const hundredFacts = Array.from({ length: 100 }, () => fact("IB:00123", "2026-08", 1));
const noMultiplication = build(hundredFacts, [reference("IB:00123", "2026-08", 500, 1000)]).rows[0];
assert.deepStrictEqual([noMultiplication.actualPremium, noMultiplication.budget, noMultiplication.transactionCount], [100, 500, 100]);

const union = build(
  [fact("IB:00123", "2026-08", 10), fact("IB:00124", "2026-08", 20)],
  [reference("IB:00123", "2026-08", 100, 200), reference("IB:00125", "2026-08", 300, 400)],
);
assert.strictEqual(union.rows.length, 3);
assert.deepStrictEqual(
  [union.summary.actualOnlyBranchPeriods, union.summary.commercialOnlyBranchPeriods],
  [1, 1],
);
const actualOnly = union.rows.find((row) => row.branchId === "IB:00124");
assert.deepStrictEqual([actualOnly.actualPremium, actualOnly.budget, actualOnly.potential, actualOnly.commercialStatus], [20, null, null, "ACTUAL_ONLY"]);
const commercialOnly = union.rows.find((row) => row.branchId === "IB:00125");
assert.deepStrictEqual([commercialOnly.actualPremium, commercialOnly.budget, commercialOnly.potential, commercialOnly.commercialStatus], [0, 300, 400, "NO_ACTIVITY"]);

const partialBudget = build([fact("IB:00123", "2026-08", 50)], [reference("IB:00123", "2026-08", 100, null)]).rows[0];
assert.deepStrictEqual([partialBudget.achievementPct, partialBudget.potentialPenetrationPct, partialBudget.referenceStatus], [50, null, "BUDGET_ONLY"]);
const partialPotential = build([fact("IB:00123", "2026-08", 50)], [reference("IB:00123", "2026-08", null, 200)]).rows[0];
assert.deepStrictEqual([partialPotential.achievementPct, partialPotential.potentialPenetrationPct, partialPotential.referenceStatus], [null, 25, "POTENTIAL_ONLY"]);
const differentMonths = build([fact("IB:00123", "2026-08", 50)], [reference("IB:00123", "2026-09", 100, 200)]);
assert.strictEqual(differentMonths.rows.length, 2);
assert.ok(differentMonths.rows.some((row) => row.periodKey === "2026-08" && row.commercialStatus === "ACTUAL_ONLY"));
assert.ok(differentMonths.rows.some((row) => row.periodKey === "2026-09" && row.commercialStatus === "NO_ACTIVITY"));

const excluded = Commercial.buildPerformance([
  fact(null, "2026-08", 30), fact("IB:00123", null, -10), fact(null, null, 5),
], context([], "ABSENT"));
assert.deepStrictEqual(
  [excluded.summary.unresolvedBranchRowsExcluded, excluded.summary.unresolvedBranchPremiumExcluded, excluded.summary.invalidDateRowsExcluded, excluded.summary.invalidDatePremiumExcluded],
  [2, 35, 2, -5],
);
assert.strictEqual(excluded.rows.length, 0);
const noMaster = Commercial.buildPerformance([fact("IB:00123", "2026-08", 10)], context([], "ABSENT"));
assert.deepStrictEqual([noMaster.status, noMaster.rows[0].commercialStatus], ["NO_COMMERCIAL_MASTER", "ACTUAL_ONLY"]);
const noFacts = Commercial.buildPerformance([], context([reference("IB:00123", "2026-08", 100, 200)]));
assert.deepStrictEqual([noFacts.status, noFacts.rows[0].actualPremium, noFacts.rows[0].commercialStatus], ["NO_FACT_DATA", 0, "NO_ACTIVITY"]);

const aggregate = Commercial.aggregatePerformance([
  build([fact("IB:A", "2026-08", 80)], [reference("IB:A", "2026-08", 100, 100)]).rows[0],
  build([fact("IB:B", "2026-08", 70)], [reference("IB:B", "2026-08", 100, 300)]).rows[0],
])[0];
assert.deepStrictEqual([aggregate.actualPremium, aggregate.budget, aggregate.achievementPct, aggregate.potential, aggregate.potentialPenetrationPct], [150, 200, 75, 400, 37.5]);
const ratioOfSums = Commercial.aggregatePerformance([
  build([fact("IB:A", "2026-08", 100)], [reference("IB:A", "2026-08", 100, 100)]).rows[0],
  build([fact("IB:B", "2026-08", 100)], [reference("IB:B", "2026-08", 900, 900)]).rows[0],
])[0];
assert.deepStrictEqual([ratioOfSums.actualPremium, ratioOfSums.budget, ratioOfSums.achievementPct, ratioOfSums.potentialPenetrationPct], [200, 1000, 20, 20]);

const coverageRows = [
  { actualPremium: 10, budget: 0, potential: 0 },
  { actualPremium: 20, budget: null, potential: null },
];
const partialCoverage = Commercial.aggregatePerformance(coverageRows)[0];
assert.deepStrictEqual(
  [partialCoverage.budget, partialCoverage.budgetPresentCount, partialCoverage.budgetMissingCount, partialCoverage.potentialPresentCount, partialCoverage.potentialMissingCount, partialCoverage.coverageStatus],
  [0, 1, 1, 1, 1, "PARTIAL"],
);
assert.strictEqual(Commercial.aggregatePerformance([{ actualPremium: 0, budget: 0, potential: 0 }])[0].coverageStatus, "COMPLETE");
assert.strictEqual(Commercial.aggregatePerformance([{ actualPremium: 0, budget: null, potential: null }])[0].coverageStatus, "NONE");
const byPeriod = Commercial.aggregatePerformance(union.rows, (row) => row.periodKey);
assert.deepStrictEqual(byPeriod.map((group) => group.key), ["2026-08"]);

const immutableFacts = [fact("IB:00123", "2026-08", 10, { assignedRmId: "RM1", csmId: "CSM1", state: "Assam", zone: "East" })];
const immutableReferences = [reference("IB:00123", "2026-08", 100, 200, { activationEligible: false, active: false })];
const factsBefore = JSON.stringify(immutableFacts);
const referencesBefore = JSON.stringify(immutableReferences);
const independent = build(immutableFacts, immutableReferences);
assert.strictEqual(JSON.stringify(immutableFacts), factsBefore);
assert.strictEqual(JSON.stringify(immutableReferences), referencesBefore);
assert.deepStrictEqual([independent.rows[0].actualPremium, independent.rows[0].budget], [10, 100]);

const duplicate = Commercial.buildPerformance(
  [fact("IB:00123", "2026-08", 10)],
  context([reference("IB:00123", "2026-08", 100, 200), reference("IB:00123", "2026-08", 999, 999)]),
);
assert.strictEqual(duplicate.summary.duplicateCommercialKeys, 1);
assert.strictEqual(duplicate.rows[0].budget, 100, "first unique reference is retained deterministically; duplicates are not summed");
assert.strictEqual(duplicate.status, "PARTIAL");

assert.strictEqual(union.summary.actualBranchPeriods, 2);
assert.strictEqual(union.summary.commercialBranchPeriods, 2);
assert.strictEqual(union.summary.joinedBranchPeriods, 3);
assert.deepStrictEqual([basic.branchId, basic.periodKey], ["IB:00123", "2026-08"]);

console.log("Step 4H tests passed: grain-safe Actual/Commercial union, signed formulas, ratio-of-sums, coverage, exclusions, immutability, and duplicate defense.");
