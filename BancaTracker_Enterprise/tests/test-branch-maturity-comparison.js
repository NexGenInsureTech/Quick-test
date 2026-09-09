/* v8.4 Step 3C: Branch maturity comparison and movement authority. */
"use strict";
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

global.window = global;
vm.runInThisContext(fs.readFileSync(path.join(__dirname, "..", "js/utilities.js"), "utf8"), { filename: "utilities.js" });
const dimensions = ["OVERALL", "BANK", "BRANCH", "STATE", "ZONE", "BANK_REGION", "BANK_ZONE", "FGM_OFFICE", "ASSIGNED_RM", "CSM", "ASM", "ZSM", "NATIONAL_HEAD"];
global.BancaTrackerCommercialRollups = {
  DIMENSIONS: dimensions,
  buildPeriodContext(performance) { return { availablePeriods: [...new Set((performance.rows || []).map((row) => row.periodKey))].sort() }; },
  buildMetadataIndex() { return new Map(); }, attachMetadata(rows) { return rows.map((row) => ({ ...row })); },
  getDimensionValue(row, dimension) { if (dimension === "OVERALL") return { key: "ALL", label: "Overall" }; if (dimension === "BANK") return { key: row.canonicalBank || "__UNMAPPED__", label: row.canonicalBank || "Unmapped" }; if (dimension === "BRANCH") return { key: row.branchId || "__UNMAPPED__", label: row.branchName || row.branchId || "Unmapped" }; return { key: "ALL", label: "Overall" }; },
};
vm.runInThisContext(fs.readFileSync(path.join(__dirname, "..", "js/analytics/branchMaturityComparison.js"), "utf8"), { filename: "branchMaturityComparison.js" });
const Authority = BancaTrackerBranchMaturityComparison;

const boundaries = [-1, 0, 14999, 15000, 24999, 25000, 49999, 50000, 99999, 100000, 199999, 200000];
const expected = ["Zero", "Zero", "1 - 14.9K", "15K - 24.9K", "15K - 24.9K", "25K - 49.9K", "25K - 49.9K", "50K - 99.9K", "50K - 99.9K", "1L - 1.99L", "1L - 1.99L", "2L+"];
const boundaryDistribution = Authority.buildMonthlyDistribution(boundaries.map((actualPremium, index) => ({ branchId: `T${index}`, branchName: `Threshold ${index}`, actualPremium })), "2026-07");
assert.strictEqual(boundaryDistribution.populationCount, 12);
assert.deepStrictEqual(boundaries.map((_, index) => boundaryDistribution.branchRows.find((row) => row.branchId === `T${index}`).band), expected);
assert.strictEqual(boundaryDistribution.reconciliation.matches, true);
assert.strictEqual(boundaryDistribution.bands.length, Authority.BAND_ORDER.length);
const signedAggregation = Authority.buildMonthlyDistribution([{ branchId: "ADJUST", branchName: "Adjustment", actualPremium: 25000 }, { branchId: "ADJUST", branchName: "Adjustment", actualPremium: -30000 }], "2026-07");
assert.deepStrictEqual([signedAggregation.branchRows[0].premium, signedAggregation.branchRows[0].band], [-5000, "Zero"]);

const p1 = "2026-07"; const p2 = "2026-08"; const p3 = "2026-09";
function row(branchId, periodKey, actualPremium, bank = "BANK A", branchName = branchId) { return { branchId, periodKey, actualPremium, canonicalBank: bank, branchName, stateName: "State", zoneName: "Zone" }; }
const performance = { status: "READY", rows: [
  row("UP", p1, 25000), row("UP", p2, 50000), row("UP", p3, 50000),
  row("DOWN", p1, 100000), row("DOWN", p2, 50000), row("DOWN", p3, 0),
  row("SAME", p1, 30000), row("SAME", p2, 49000), row("SAME", p3, 26000),
  row("ZEROACTIVE", p1, -5000), row("ZEROACTIVE", p2, 25000), row("ZEROACTIVE", p3, 15000),
  row("ACTIVEZERO", p1, 25000), row("ACTIVEZERO", p2, 0), row("ACTIVEZERO", p3, 0),
  row("NEAR", p1, 0), row("NEAR", p2, 15000), row("NEAR", p3, 15000),
  row("ONESIDE", p1, 100), row("REFERENCE_ZERO", p2, 0),
  row("DUP1", p1, 100, "BANK A", "Duplicate"), row("DUP1", p2, 200, "BANK A", "Duplicate"),
  row("DUP2", p1, 50000, "BANK A", "Duplicate"), row("DUP2", p2, 25000, "BANK A", "Duplicate"),
  row(null, p1, 1000), row("BANKB", p1, 50000, "BANK B"), row("BANKB", p2, 100000, "BANK B"),
] };
const original = JSON.stringify(performance);
let result = Authority.buildComparison({ performanceResult: performance, selectedPeriods: [p1, p2, p3], dimension: "OVERALL" });
assert.strictEqual(result.status, "PARTIAL", "missing durable identity is diagnosed");
assert.strictEqual(result.transitions.length, 2);
assert.deepStrictEqual(result.transitions.map((item) => [item.baseMonth, item.comparisonMonth]), [[p1, p2], [p2, p3]]);
const first = result.transitions[0];
const byId = new Map(first.rows.map((item) => [item.branchId, item]));
assert.deepStrictEqual([byId.get("UP").movement, byId.get("DOWN").movement, byId.get("SAME").movement], ["UPGRADED", "DOWNGRADED", "UNCHANGED"]);
assert.deepStrictEqual([byId.get("ZEROACTIVE").movement, byId.get("ZEROACTIVE").specialMovement], ["UPGRADED", "ZERO_TO_ACTIVE"]);
assert.deepStrictEqual([byId.get("ACTIVEZERO").movement, byId.get("ACTIVEZERO").specialMovement], ["DOWNGRADED", "ACTIVE_TO_ZERO"]);
assert.deepStrictEqual([byId.get("NEAR").movement, byId.get("NEAR").specialMovement], ["UPGRADED", null]);
assert.deepStrictEqual([byId.get("ONESIDE").movement, byId.get("ONESIDE").presenceStatus], ["NOT_COMPARABLE", "BASE_ONLY"]);
assert.deepStrictEqual([byId.get("REFERENCE_ZERO").comparisonPremium, byId.get("REFERENCE_ZERO").presenceStatus], [0, "COMPARISON_ONLY"]);
assert.ok(byId.has("DUP1") && byId.has("DUP2"), "duplicate display names retain independent durable identities");
assert.strictEqual(first.summary.reconciliation.matches, true);
assert.strictEqual(first.summary.eligibleTransitionPopulation + first.summary.nonComparableCount, first.rows.length);
assert.strictEqual(result.monthlyDistributions[0].reconciliation.matches, true);
assert.ok(result.diagnostics.missingBranchIdentityCount > 0);
assert.strictEqual(JSON.stringify(performance), original);

result = Authority.buildComparison({ performanceResult: performance, selectedPeriods: [p1, p2], dimension: "BANK" });
const bankA = result.entities.find((item) => item.key === "BANK A"); const bankB = result.entities.find((item) => item.key === "BANK B");
assert.ok(!bankA.transitions[0].rows.some((item) => item.branchId === "BANKB"));
assert.strictEqual(bankB.transitions[0].rows.length, 1);
result = Authority.buildComparison({ performanceResult: performance, selectedPeriods: [p1, p2], dimension: "BRANCH" });
assert.strictEqual(result.entities.find((item) => item.key === "DUP1").transitions[0].rows.length, 1);
assert.strictEqual(Authority.buildComparison({ performanceResult: performance, selectedPeriods: [p2, p1], dimension: "OVERALL" }).status, "INVALID_PERIOD_SELECTION");
assert.strictEqual(Authority.buildComparison({ performanceResult: performance, selectedPeriods: [p1, p1], dimension: "OVERALL" }).status, "INVALID_PERIOD_SELECTION");
const empty = Authority.buildMonthlyDistribution([], p1);
assert.deepStrictEqual([empty.populationCount, empty.bands.every((item) => item.percentageOfPopulation === 0), empty.reconciliation.matches], [0, true, true]);

console.log("v8.4 branch maturity comparison tests passed: thresholds, signed bands, governed population, transitions, special movements, scope, diagnostics, reconciliation, and immutability.");
