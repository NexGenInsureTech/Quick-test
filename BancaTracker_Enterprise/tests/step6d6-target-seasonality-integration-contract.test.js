/* Step 6D.6.2: executable contract for governed Target Seasonality monetary integration. */
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
const FY = "FY2026-27";
const MONTHS = ["2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10", "2026-11", "2026-12", "2027-01", "2027-02", "2027-03"];
const LABELS = ["Apr-26", "May-26", "Jun-26", "Jul-26", "Aug-26", "Sep-26", "Oct-26", "Nov-26", "Dec-26", "Jan-27", "Feb-27", "Mar-27"];
const OVERALL = [0.05, 0.06, 0.09, 0.10, 0.10, 0.10, 0.10, 0.10, 0.08, 0.07, 0.07, 0.08];
const BANK = [0.04, 0.11, 0.20, 0.10, 0.08, 0.08, 0.08, 0.08, 0.07, 0.02, 0.02, 0.12];
const GAP = "CONTRACT GAP: Step 6D.6.3 must integrate governed Target Seasonality into BancaTrackerTarget monetary allocation.";

class Element {
  constructor() { this.value = ""; this.innerHTML = ""; this.textContent = ""; this.dataset = {}; this.classList = { toggle() {} }; }
  addEventListener() {}
  add() {}
}
const elements = {};
global.window = global;
global.document = { getElementById(id) { return elements[id] || (elements[id] = new Element()); } };
global.Option = class Option { constructor(text, value) { this.text = text; this.value = value; } };
global.sessionStorage = { getItem() { return null; }, setItem() {} };
global.BancaTrackerCore = { state: { filters: { bank: "ALL" }, banks: ["INDIAN BANK"] } };
const load = (file) => require(path.join(root, file));
[
  "js/config.js", "js/utilities.js", "js/enrichment/dateResolver.js", "js/targetSeasonality.js",
  "js/enrichment/liveTargetSeasonalityAuthority.js", "js/target.js",
].forEach(load);

const Target = global.BancaTrackerTarget;
const Live = global.BancaTrackerLiveTargetSeasonalityAuthority;
const Resolver = global.BancaTrackerTargetSeasonality;
const dataset = { datasetId: "TARGET_SEASONALITY:6", datasetType: "TARGET_SEASONALITY", datasetVersion: 6, status: "ACTIVE" };

function records(scopeType, weights, canonicalBank = null) {
  return MONTHS.map((monthKey, index) => ({ fiscalYear: FY, scopeType, canonicalBank, monthKey, weight: weights[index] }));
}
function context(overrides = {}) {
  return {
    currentPeriodKey: "2026-06", currentPeriodMonth: "Jun-26", selectedMonth: "Jun-26",
    progressionMonth: "Jun-26", elapsedMonths: 3, latestFiscalMonth: "Jun-26",
    ytdPremium: 30 * 10000000,
    bankMonthlyPremium: Object.fromEntries(LABELS.map((label) => [label, 0])),
    ...overrides,
  };
}
function setAnnual(overall = 120, bank = 60) {
  Target.targetState.fiscalYearTarget = overall;
  Target.targetState.monthlyTarget = overall / 12;
  Target.targetState.bankTargets["INDIAN BANK"] = bank;
}
function seasonality(result) { return result.seasonality || { status: result.seasonalityStatus, diagnostics: result.seasonalityDiagnostics, datasetId: result.seasonalityDatasetId, datasetVersion: result.seasonalityDatasetVersion }; }
function assertUnavailable(result) {
  assert.strictEqual(result.currentMonthTarget, null);
  assert.strictEqual(result.ytdTarget, null);
  assert.strictEqual(result.achievement, null);
  assert.strictEqual(result.gap, null);
}

setAnnual();
const missingIntegration = Target.calculateTargetForBank(context(), "ALL", 30 * 10000000);
assert.ok(seasonality(missingIntegration).status, GAP);

(async function run() {
  // Cache lifecycle: NOT_LOADED and LOAD_FAILED fail closed; ABSENT delegates only to pure equal fallback.
  assert.strictEqual(Live.getCachedContext().status, "NOT_LOADED");
  assertUnavailable(Target.calculateTargetForBank(context(), "ALL", 30 * 10000000));
  await Live.loadContext({ async getActiveDataset() { throw new Error("synthetic failure"); } });
  assert.strictEqual(Live.getCachedContext().status, "LOAD_FAILED");
  assertUnavailable(Target.calculateTargetForBank(context(), "ALL", 30 * 10000000));
  await Live.loadContext({ async getActiveDataset() { return null; } });
  const absent = Target.calculateTargetForBank(context(), "ALL", 30 * 10000000);
  assert.strictEqual(seasonality(absent).status, "EQUAL_MONTH_FALLBACK");
  assert.strictEqual(absent.currentMonthTarget, 10);
  assert.strictEqual(absent.ytdTarget, 30);

  // Overall, Bank, and inherited curves use asymmetric resolved weights, not annual / 12.
  Live.setFromDataset(dataset, records("OVERALL", OVERALL).concat(records("BANK", BANK, "INDIAN BANK")));
  const overall = Target.calculateTargetForBank(context(), "ALL", 30 * 10000000);
  assert.strictEqual(seasonality(overall).status, "GOVERNED_OVERALL");
  assert.strictEqual(overall.currentMonthTarget, 120 * 0.09);
  assert.strictEqual(overall.ytdTarget, 120 * (0.05 + 0.06 + 0.09));
  assert.strictEqual(overall.achievement, 30 / 24 * 100);
  assert.strictEqual(overall.gap, -6);
  assert.strictEqual(overall.rrr, (120 - 30) / 9, "RRR remains annual remaining Target / remaining months.");
  assert.strictEqual(Target.targetState.monthlyTarget, 10, "Compatibility monthlyTarget remains annual / 12.");

  const bank = Target.calculateTargetForBank(context(), "INDIAN BANK", 15 * 10000000);
  assert.strictEqual(seasonality(bank).status, "GOVERNED_BANK");
  assert.strictEqual(bank.currentMonthTarget, 60 * 0.20);
  assert.strictEqual(bank.ytdTarget, 60 * (0.04 + 0.11 + 0.20));
  const inherited = Target.calculateTargetForBank(context(), "OTHER BANK", 0);
  assert.strictEqual(seasonality(inherited).status, "GOVERNED_OVERALL");

  // Invalid explicit curve and missing/invalid canonical period never manufacture zero allocation.
  Live.setFromDataset(dataset, [{ fiscalYear: FY, scopeType: "BANK", canonicalBank: "INDIAN BANK", monthKey: "2026-04", weight: 1 }]);
  assert.strictEqual(seasonality(Target.calculateTargetForBank(context(), "INDIAN BANK", 0)).status, "INVALID");
  assertUnavailable(Target.calculateTargetForBank(context(), "INDIAN BANK", 0));
  Live.setFromDataset(dataset, records("OVERALL", OVERALL));
  assert.strictEqual(seasonality(Target.calculateTargetForBank(context({ currentPeriodKey: null }), "ALL", 0)).status, "UNAVAILABLE");
  assertUnavailable(Target.calculateTargetForBank(context({ currentPeriodKey: null }), "ALL", 0));

  // Missing differs from zero; zero remains a valid allocated Target with undefined achievement.
  Target.targetState.fiscalYearTarget = null;
  const missing = Target.calculateTargetForBank(context(), "ALL", 0);
  assert.strictEqual(missing.annualTarget, null);
  assert.strictEqual(missing.currentMonthTarget, null);
  setAnnual(0, 0);
  const zero = Target.calculateTargetForBank(context(), "ALL", 0);
  assert.strictEqual(zero.currentMonthTarget, 0);
  assert.strictEqual(zero.ytdTarget, 0);
  assert.strictEqual(zero.achievement, null);

  // ALL consumes Core's already-resolved latest canonical period; no separate ALL rule is introduced.
  setAnnual();
  const all = Target.calculateTargetForBank(context({ selectedMonth: "ALL", currentPeriodKey: "2026-06" }), "ALL", 30 * 10000000);
  assert.strictEqual(all.currentMonthTarget, 120 * 0.09);
  assert.strictEqual(all.ytdTarget, 24);

  // Twelve canonical months preserve display order, annual reconciliation, Actual and Achievement semantics.
  assert.deepStrictEqual(Object.keys(overall.monthlyTargetsByMonth), MONTHS);
  assert.ok(Math.abs(Object.values(overall.monthlyTargetsByMonth).reduce((sum, value) => sum + value, 0) - 120) <= 1e-9);
  MONTHS.forEach((month, index) => assert.strictEqual(overall.monthlyTargetsByMonth[month], 120 * OVERALL[index]));

  // Future Target must use the pure resolver, not repository, Commercial, or Scorecard formula duplication.
  const targetSource = fs.readFileSync(path.join(root, "js", "target.js"), "utf8");
  for (const forbidden of ["BancaTrackerRepository", "indexedDB", "BRANCH_BUDGET_POTENTIAL", "CommercialPerformance", "commercialRollup"]) assert.ok(!targetSource.includes(forbidden), forbidden);
  const scorecardSource = fs.readFileSync(path.join(root, "js", "scorecard.js"), "utf8");
  assert.match(scorecardSource, /BancaTrackerTarget\.calculateTargetForBank/);
  assert.ok(!scorecardSource.includes("BancaTrackerTargetSeasonality"));
  assert.ok(!scorecardSource.includes("BancaTrackerLiveTargetSeasonalityAuthority"));
  assert.strictEqual(Resolver.resolve({ records: [], fiscalYear: FY }).status, "EQUAL_MONTH_FALLBACK");
  console.log("Step 6D.6 Target Seasonality integration contract tests passed.");
})().catch((error) => { console.error(error); process.exitCode = 1; });
