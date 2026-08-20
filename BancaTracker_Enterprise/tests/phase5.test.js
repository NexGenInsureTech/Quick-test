/* Dependency-free Phase 5 calculation and renderer smoke tests. Run: node tests/phase5.test.js */
const assert = require("assert");
const path = require("path");

class FakeElement {
  constructor() { this.value = ""; this.innerHTML = ""; this.textContent = ""; this.style = {}; this.classList = { toggle() {} }; }
  addEventListener() {}
  add() {}
}

const elements = {};
global.window = global;
global.document = { getElementById(id) { if (!elements[id]) elements[id] = new FakeElement(); return elements[id]; } };
global.Option = class Option { constructor(text, value) { this.text = text; this.value = value; } };
global.sessionStorage = { getItem() { return null; }, setItem() {} };

const load = (file) => require(path.join(__dirname, "..", file));
load("js/config.js");
load("js/csvProcessor.js");
load("js/utilities.js");
load("js/analytics.js");
load("js/core.js");
load("js/performance.js");
load("app.js");
load("js/activation.js");
load("js/scorecard.js");
load("js/target.js");

const header = "USGI NET PREMIUM,Month,INTERMEDIARY,BA NAME,Ba Code,LINE OF BUSINESS,BRANCH NAME";
const rows = ["Apr-26", "May-26", "Jun-26", "Jul-26"].flatMap((month, index) => [
  `40000000,${month},INDIAN BANK,RM A,A${index},Motor,IB ${index}`,
  `20000000,${month},KARNATAKA BANK,RM B,B${index},Health,KB ${index}`
]);
BancaTrackerCore.loadCsvText([header, ...rows].join("\n"));

const state = BancaTrackerTarget.targetState;
state.fiscalYearTarget = 120;
state.monthlyTarget = 10;

function result(month, bank) {
  BancaTrackerCore.state.filters.month = month;
  BancaTrackerCore.state.filters.bank = bank;
  BancaTrackerCore.refresh();
  return BancaTrackerTarget.calculateTarget(BancaTrackerCore.getPerformanceContext());
}

assert.strictEqual(result("Apr-26", "ALL").ytdTarget, 10);
assert.strictEqual(result("May-26", "ALL").ytdTarget, 20);
const june = result("Jun-26", "ALL");
assert.strictEqual(june.ytdTarget, 30);
assert.strictEqual(june.actual, 18);
assert.strictEqual(june.achievement, 60);
assert.strictEqual(june.gap, 12);
assert.ok(Math.abs(june.rrr - (102 / 9)) < 1e-10);
assert.strictEqual(result("Jul-26", "ALL").ytdTarget, 40);
assert.strictEqual(result("ALL", "ALL").rrrLabel, "Full-year view");

state.bankTargets["INDIAN BANK"] = 60;
const bank = result("Jun-26", "INDIAN BANK");
assert.strictEqual(bank.ytdTarget, 15);
assert.strictEqual(bank.actual, 12);
assert.strictEqual(bank.achievement, 80);
assert.strictEqual(result("Jun-26", "KARNATAKA BANK").annualTarget, null);

state.fiscalYearTarget = 10;
state.monthlyTarget = 10 / 12;
assert.strictEqual(result("Jun-26", "ALL").rrrLabel, "Target achieved");
state.fiscalYearTarget = 120;
state.monthlyTarget = 10;
assert.strictEqual(result("Mar-27", "ALL").rrrLabel, "FY Complete");
assert.strictEqual(BancaTrackerTarget.elapsedMonths("Unconfigured"), null);
assert.strictEqual(BancaTrackerTarget.isValidTarget(-1), false);
assert.strictEqual(BancaTrackerTarget.isValidTarget("abc"), false);
assert.strictEqual(BancaTrackerTarget.isValidTarget(0), true);

assert.ok(elements.kpis.innerHTML.includes("YTD Premium"));
assert.ok(elements.activationKpis.innerHTML.includes("Observed Branches"));
assert.ok(elements.scorecardSummary.innerHTML.includes("Total Partner Banks"));
assert.ok(elements.targetKpis.innerHTML.includes("FY Target"));
console.log("Phase 5 tests passed: target calculations, filters, edge cases, and renderer regressions.");
