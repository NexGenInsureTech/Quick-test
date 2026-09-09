/* v8.4 Step 3B: Equivalent elapsed-day comparison authority. */
"use strict";
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

global.window = global;
const dimensions = ["OVERALL", "BANK", "BRANCH", "STATE", "ZONE", "BANK_REGION", "BANK_ZONE", "FGM_OFFICE", "ASSIGNED_RM", "CSM", "ASM", "ZSM", "NATIONAL_HEAD"];
const context = { availablePeriods: ["2026-07", "2026-09", "2026-10"] };
global.BancaTrackerCommercialComparison = {
  validateComparisonPeriods(periodContext, base, comparison) {
    if (!periodContext || !periodContext.availablePeriods.length) return { valid: false, status: "NO_PERIODS" };
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(base || "") || !/^\d{4}-(0[1-9]|1[0-2])$/.test(comparison || "") || !periodContext.availablePeriods.includes(base) || !periodContext.availablePeriods.includes(comparison)) return { valid: false, status: "INVALID_PERIOD" };
    return { valid: true, samePeriod: base === comparison };
  },
  compareActual(base, comparison) { const actualChange = comparison - base; return { actualChange, actualChangePct: base > 0 ? actualChange / base * 100 : null, actualDirection: actualChange > 0 ? "UP" : actualChange < 0 ? "DOWN" : "FLAT" }; },
};
global.BancaTrackerDailyCommercialComparison = { getDaysInPeriod(period) { if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period || "")) return null; const [year, month] = period.split("-").map(Number); return new Date(Date.UTC(year, month, 0)).getUTCDate(); } };
global.BancaTrackerCommercialRollups = {
  DIMENSIONS: dimensions, buildPeriodContext() { return context; }, buildMetadataIndex() { return new Map(); }, attachMetadata(rows) { return rows.map((row) => ({ ...row })); },
  getDimensionValue(row, dimension) { if (dimension === "BANK") return { key: row.bank || "__UNMAPPED__", label: row.bank || "Unmapped" }; if (dimension === "BRANCH") return { key: row.branchId || "__UNMAPPED__", label: row.branch || row.branchId || "Unmapped" }; return { key: "ALL", label: "Overall" }; },
};
vm.runInThisContext(fs.readFileSync(path.join(__dirname, "..", "js/analytics/equivalentElapsedDayComparison.js"), "utf8"), { filename: "equivalentElapsedDayComparison.js" });
const Authority = BancaTrackerEquivalentElapsedDayComparison;
const base = "2026-07"; const comparison = "2026-09";
const facts = [
  { monthKey: base, day: 1, premium: 100, bank: "BANK A", branchId: "B1", branch: "One" },
  { monthKey: base, day: 3, premium: 20, bank: "BANK A", branchId: "B1", branch: "One" },
  { monthKey: base, day: 8, premium: 0, bank: "BANK A", branchId: "B1", branch: "One" },
  { monthKey: comparison, day: 1, premium: 120, bank: "BANK A", branchId: "B1", branch: "One" },
  { monthKey: comparison, day: 7, premium: -30, bank: "BANK A", branchId: "B1", branch: "One" },
  { monthKey: comparison, day: 10, premium: 10, bank: "BANK A", branchId: "B1", branch: "One" },
  { monthKey: base, day: 1, premium: 0, bank: "BANK B", branchId: "B2", branch: "Two" },
  { monthKey: comparison, day: 1, premium: 10, bank: "BANK B", branchId: "B2", branch: "Two" },
  { monthKey: base, day: 32, premium: 8, bank: "BANK A", branchId: "BAD" },
  { monthKey: comparison, premium: 7, bank: "BANK A", branchId: "BAD" },
];
const snapshot = JSON.stringify(facts);
assert.strictEqual(Authority.resolveObservedHorizon(facts, base).horizon, 8);
assert.deepStrictEqual(Authority.validateThroughDay(6, base, comparison, 8), { valid: true, effectiveThroughDay: 6, explicit: true });
assert.strictEqual(Authority.validateThroughDay(9, base, comparison, 8).valid, false);

let result = Authority.buildComparison({ facts, periodContext: context, basePeriod: base, comparisonPeriod: comparison, dimension: "OVERALL" });
assert.strictEqual(result.status, "PARTIAL");
assert.deepStrictEqual([result.horizonAuthority, result.baseObservedHorizon, result.comparisonObservedHorizon, result.effectiveThroughDay], ["OBSERVED_VALID_TRANSACTION_DAY", 8, 10, 8]);
const overall = result.entities[0];
assert.strictEqual(overall.days.length, 8);
assert.strictEqual(overall.days[3].baseDailyActual, 0, "in-horizon missing transaction is zero");
assert.strictEqual(overall.days[6].comparisonDailyActual, -30, "negative Actual is preserved");
assert.strictEqual(overall.days[6].comparisonCumulativeActual, 100, "negative Actual reduces cumulative value");
assert.deepStrictEqual([overall.summary.baseThroughDayActual, overall.summary.comparisonThroughDayActual, overall.summary.absoluteGap, overall.summary.growthPct], [120, 100, -20, -16.666666666666664]);
assert.strictEqual(overall.reconciliation.baseDailyTotal, overall.reconciliation.baseFinalCumulative);
assert.strictEqual(overall.reconciliation.comparisonDailyTotal, overall.reconciliation.comparisonFinalCumulative);
assert.deepStrictEqual([result.diagnostics.invalidDayCount, result.diagnostics.missingDayCount], [1, 1]);

result = Authority.buildComparison({ facts, periodContext: context, basePeriod: base, comparisonPeriod: comparison, throughDay: 6 });
assert.deepStrictEqual([result.status, result.effectiveThroughDay, result.entities[0].days.length, result.entities[0].summary.comparisonThroughDayActual], ["PARTIAL", 6, 6, 130]);
assert.strictEqual(Authority.buildComparison({ facts, periodContext: context, basePeriod: base, comparisonPeriod: comparison, throughDay: 9 }).status, "INVALID_THROUGH_DAY");
assert.strictEqual(Authority.buildComparison({ facts, periodContext: context, basePeriod: base, comparisonPeriod: base }).status, "SAME_PERIOD");
assert.strictEqual(Authority.buildComparison({ facts, periodContext: context, basePeriod: "2026-08", comparisonPeriod: comparison }).status, "INVALID_PERIOD");
assert.strictEqual(Authority.buildComparison({ facts: [{ monthKey: base, premium: 1 }, { monthKey: comparison, day: 0, premium: 1 }], periodContext: context, basePeriod: base, comparisonPeriod: comparison }).status, "NO_VALID_DATED_FACTS");

result = Authority.buildComparison({ facts, periodContext: context, basePeriod: base, comparisonPeriod: comparison, dimension: "BANK" });
const bankA = result.entities.find((item) => item.key === "BANK A"); const bankB = result.entities.find((item) => item.key === "BANK B");
assert.deepStrictEqual([bankA.summary.baseThroughDayActual, bankA.summary.comparisonThroughDayActual], [120, 90]);
assert.deepStrictEqual([bankB.summary.baseThroughDayActual, bankB.summary.comparisonThroughDayActual, bankB.summary.growthPct], [0, 10, null]);
result = Authority.buildComparison({ facts, periodContext: context, basePeriod: base, comparisonPeriod: comparison, dimension: "BRANCH" });
assert.strictEqual(result.entities.find((item) => item.key === "B1").summary.absoluteGap, -30);
assert.strictEqual(JSON.stringify(facts), snapshot);

console.log("v8.4 equivalent elapsed-day comparison tests passed: horizon, signed movement, through-day, invalid states, diagnostics, scope, and reconciliation.");
