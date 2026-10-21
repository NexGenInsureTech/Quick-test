/* v8.6.8 Increment 1: pure Monthly Net Premium Trend authority. */
"use strict";
const assert = require("assert");
const path = require("path");
const root = path.join(__dirname, "..");
global.window = global;
require(path.join(root, "js/analytics/managementBank.js"));
require(path.join(root, "js/analytics/monthlyPremiumTrend.js"));
const Trend = BancaTrackerMonthlyPremiumTrend;
let assertions = 0;
const equal = (actual, expected, message) => { assertions += 1; assert.deepStrictEqual(actual, expected, message); };
const check = (value, message) => { assertions += 1; assert.ok(value, message); };
const fact = (monthKey, premium, bank = "INDIAN BANK", extra = {}) => ({ monthKey, premium, bank, branchId: "B-1", ...extra });

const facts = [
  fact("2025-04", 100), fact("2025-04", -20, "INDIAN BANK (PMSBY)"),
  fact("2025-05", 0), fact("2025-12", 50), fact("2026-01", 75), fact("2026-03", 40),
  fact("2026-04", 150), fact("2026-04", -50, "INDIAN BANK (PMSBY)"),
  fact("2026-05", -10), fact("2026-06", 0),
  fact("2026-04", 30, "INDIAN OVERSEAS BANK"), fact("2026-04", 20, "INDIAN OVERSEAS BANK (PMSBY)"),
  fact("2026-04", 7, "UNKNOWN BANK", { branchId: null }),
  fact(null, 9), fact("invalid", -4),
];
const before = JSON.stringify(facts);
const overall = Trend.buildMonthlyPremiumTrend(facts, { financialYear: "FY2026-27", scope: { type: "OVERALL" } });
equal(overall.months.length, 12, "T01 twelve periods");
equal(overall.months.map((row) => row.periodKey), ["2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10", "2026-11", "2026-12", "2027-01", "2027-02", "2027-03"], "T02 April-March order");
const april = overall.months[0]; const may = overall.months[1]; const june = overall.months[2];
equal(april.actualPremium, 157, "T03/T04 signed rows reconcile without deduplication");
equal(april.transactionRowCount, 5, "row count is transactional, not policy count");
equal(overall.months[3].actualPremium, null, "T05 missing is null");
equal(june.actualPremium, 0, "T06 observed zero remains zero");
equal(june.observedData, true);
equal(may.previousPeriodKey, "2026-04", "T07 exact preceding month");
equal(may.previousActualPremium, 157);
equal(may.momAbsoluteChange, -167);
equal(may.momStatus, "READY");
equal(Trend.shiftPeriod("2026-04", -1), "2026-03", "T08 March-April transition");
equal(Trend.shiftPeriod("2026-01", -1), "2025-12", "T09 December-January transition");
equal(april.priorYearPeriodKey, "2025-04", "T10 exact twelve-month key");
equal(april.priorYearActualPremium, 80);
equal(april.yoyAbsoluteChange, 77);
equal(overall.months[3].momStatus, "CURRENT_MISSING", "T11 missing current/reference status");
check(Math.abs(april.yoyPercentChange - 96.25) < 1e-10, "T12 positive-base percentage");
equal(june.momStatus, "BASE_NON_POSITIVE", "T14 negative comparison base");
equal(june.momPercentChange, null);
equal(may.actualPremium, -10, "T15 negative current retained");
equal(overall.universeDiagnostics.invalidOrMissingDateRows, 2, "T16 invalid date diagnostics");
equal(overall.universeDiagnostics.excludedPremium, 5);
equal(april.temporalCompleteness, "UNKNOWN", "T30 completeness never inferred");
check(overall.months.every((row) => row.temporalCompleteness === "UNKNOWN"));

const zeroBase = Trend.buildMonthlyPremiumTrend([fact("2026-04", 0), fact("2026-05", 10)], { financialYear: "FY2026-27", scope: { type: "OVERALL" } });
equal(zeroBase.months[1].momStatus, "BASE_ZERO", "T13 zero base explicit");
equal(zeroBase.months[1].momAbsoluteChange, 10);
equal(zeroBase.months[1].momPercentChange, null);

const indian = Trend.buildMonthlyPremiumTrend(facts, { financialYear: "FY2026-27", scope: { type: "MANAGEMENT_BANK", managementBank: "INDIAN BANK" } });
equal(indian.months[0].actualPremium, 100, "T17 Indian Bank CORE+PMSBY exact once");
const iob = Trend.buildMonthlyPremiumTrend(facts, { financialYear: "FY2026-27", scope: { type: "MANAGEMENT_BANK", managementBank: "INDIAN OVERSEAS BANK" } });
equal(iob.months[0].actualPremium, 50, "T18 IOB CORE+PMSBY exact once");
equal(overall.diagnostics.unmappedPremium, 7, "T19 unmapped remains explicit");
equal(overall.diagnostics.mappedPremium + overall.diagnostics.unmappedPremium, overall.months.reduce((sum, row) => sum + (row.actualPremium === null ? 0 : row.actualPremium), 0), "T20 selected-FY mapped plus unmapped reconciliation");
equal(overall.reconciliation.commercialIneligiblePremium, 7, "population difference is disclosed");
equal(JSON.stringify(facts), before, "T21 input not mutated");
equal(Trend.buildMonthlyPremiumTrend(facts, { financialYear: "FY2026-27", scope: { type: "OVERALL" } }), overall, "T22 deterministic");
equal(Trend.availableFinancialYears(facts), ["FY2025-26", "FY2026-27"], "T23 FY discovery");
equal(Trend.buildMonthlyPremiumTrend([], { financialYear: "bad", scope: { type: "OVERALL" } }).status, "INVALID_FINANCIAL_YEAR");
equal(Trend.buildMonthlyPremiumTrend([], { financialYear: "FY2026-27", scope: { type: "MANAGEMENT_BANK" } }).status, "INVALID_SCOPE");
check(Object.isFrozen(overall) && Object.isFrozen(overall.months) && Object.isFrozen(overall.months[0]), "result and nested evidence are immutable");

// RC-1 selected-FY reconciliation: historical facts remain references, never selected-FY counters.
const rcFacts = [
  fact("2025-04", 80, "INDIAN BANK"), fact("2025-04", 20, "INDIAN BANK (PMSBY)"),
  fact("2025-04", 5, "UNKNOWN BANK", { branchId: null }),
  fact("2026-04", 100, "INDIAN BANK"), fact("2026-04", -20, "INDIAN BANK (PMSBY)"),
  fact("2026-04", 50, "INDIAN OVERSEAS BANK"), fact("2026-04", 10, "INDIAN OVERSEAS BANK (PMSBY)"),
  fact("2026-04", 7, "UNKNOWN BANK", { branchId: null }), fact("2026-05", 0, "INDIAN BANK"),
];
const rc = Trend.buildMonthlyPremiumTrend(rcFacts, { financialYear: "FY2026-27", scope: { type: "OVERALL" } });
equal(rc.months[0].actualPremium, 147, "RC-1 current April signed actual");
equal(rc.months[0].priorYearActualPremium, 105, "prior-FY facts remain available to YoY");
equal(rc.months[0].yoyAbsoluteChange, 42);
equal(rc.months[0].yoyPercentChange, 40);
equal(rc.diagnostics.selectedScopeRows, 6, "selected-FY rows exclude prior FY");
equal(rc.diagnostics.includedPremium, 147, "selected-FY included premium");
equal(rc.reconciliation.commercialEligiblePremium, 140);
equal(rc.reconciliation.commercialIneligiblePremium, 7);
equal(rc.reconciliation.populationDifferencePremium, 7, "prior-FY unresolved premium does not leak");
equal(rc.universeDiagnostics.populationDifferencePremium, 12, "all-universe difference is explicitly separate");
equal(rc.diagnostics.includedPremium, rc.months.reduce((sum, row) => sum + (row.actualPremium === null ? 0 : row.actualPremium), 0));
equal(rc.diagnostics.includedPremium, rc.reconciliation.commercialEligiblePremium + rc.reconciliation.commercialIneligiblePremium);
equal(rc.reconciliation.populationDifferencePremium, rc.diagnostics.includedPremium - rc.reconciliation.commercialEligiblePremium);
const rcIndian = Trend.buildMonthlyPremiumTrend(rcFacts, { financialYear: "FY2026-27", scope: { type: "MANAGEMENT_BANK", managementBank: "INDIAN BANK" } });
equal(rcIndian.diagnostics.includedPremium, 80, "Management Bank selected-FY reconciliation uses identical scope");
equal(rcIndian.reconciliation.commercialEligiblePremium, 80);
equal(rcIndian.reconciliation.populationDifferencePremium, 0);
const transition = Trend.buildMonthlyPremiumTrend([fact("2026-03", 10), fact("2026-04", 15)], { financialYear: "FY2026-27", scope: { type: "OVERALL" } });
equal(transition.months[0].previousActualPremium, 10, "March-to-April MoM reference remains historical");
equal(transition.months[0].momAbsoluteChange, 5);

// RC-1 premium validation: only finite number primitives are observations.
const invalidPremiumFacts = [
  fact("2026-07", null), { monthKey: "2026-07", bank: "INDIAN BANK", branchId: "B-1" },
  fact("2026-07", ""), fact("2026-07", "   "), fact("2026-07", "123"),
  fact("2026-07", NaN), fact("2026-07", Infinity), fact("2026-07", -Infinity), fact("2026-07", true),
  fact("2026-08", 0), fact("2026-09", -5),
];
const originalPremiums = invalidPremiumFacts.map((row) => row.premium);
const strict = Trend.buildMonthlyPremiumTrend(invalidPremiumFacts, { financialYear: "FY2026-27", scope: { type: "OVERALL" } });
equal(strict.diagnostics.invalidPremiumRows, 9, "all non-finite/non-number premiums are invalid");
equal(strict.universeDiagnostics.invalidPremiumRows, 9);
equal(strict.months[3].actualPremium, null, "invalid-only month is not observed zero");
equal(strict.months[3].observedData, false);
equal(strict.months[3].transactionRowCount, 0);
equal(strict.months[4].actualPremium, 0, "numeric zero remains observed");
equal(strict.months[4].observedData, true);
equal(strict.months[5].actualPremium, -5, "numeric negative remains signed");
check(invalidPremiumFacts.every((row, index) => Object.is(row.premium, originalPremiums[index])), "invalid/valid source premiums are unchanged");
check(Object.isFrozen(strict.universeDiagnostics) && Object.isFrozen(strict.reconciliation), "corrected evidence remains immutable");
console.log(`v8.6.8 Monthly Net Premium Trend authority tests passed (${assertions} assertions).`);
