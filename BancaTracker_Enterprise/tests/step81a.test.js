/* v8.1 Step 8.1A time-scope, target, activation, bank-scope, and data-quality regressions. */
const assert = require("assert"); const path = require("path");
class Element { constructor() { this.value = ""; this.innerHTML = ""; this.textContent = ""; this.style = {}; this.classList = { toggle() {} }; } addEventListener() {} add() {} }
const elements = {}; global.window = global; global.document = { getElementById(id) { return elements[id] || (elements[id] = new Element()); } }; global.Option = class {}; global.sessionStorage = { getItem() { return null; }, setItem() {} }; global.performance = require("perf_hooks").performance;
const load = (file) => require(path.join(__dirname, "..", file)); ["js/config.js", "js/csvProcessor.js", "js/utilities.js", "js/analytics.js", "js/dataQuality.js", "js/productivity.js", "js/core.js", "js/performance.js", "app.js", "js/activation.js", "js/scorecard.js", "js/target.js"].forEach(load);

const H = "USGI NET PREMIUM,Month,INTERMEDIARY,BA NAME,Ba Code,LINE OF BUSINESS,BRANCH NAME,Zone,STATE,SUM IMD CODE";
const rows = ["Apr-26", "May-26", "Jun-26", "Jul-26", "Aug-26"].flatMap((month) => [
  `8000,${month},INDIAN BANK,RM A,A1,Motor,Repeat Branch,South,Tamil Nadu,I1`,
  `10000000,${month},KARNATAKA BANK,RM B,B1,Health,KB ${month},South,Karnataka,I2`
]);
rows.push("-500,Aug-26,INDIAN BANK,RM A,A1,Motor,Adjustment Branch,South,Tamil Nadu,I1");
rows.push("1000,Bad-Month,INDIAN BANK,RM A,A1,Motor,Odd Month Branch,South,Tamil Nadu,I1");
const imported = BancaTrackerCore.loadCsvText([H, ...rows].join("\n"));
const cachedAudit = BancaTrackerCore.state.dataQuality;
assert.strictEqual(imported.summary.negativePremiumRows, 1);
assert.deepStrictEqual(imported.summary.unconfiguredMonths, ["Bad-Month"]);
assert.ok(elements.importSummary.textContent.includes("Negative premium rows: 1"));
assert.ok(elements.importSummary.textContent.includes("Unconfigured fiscal month label(s): Bad-Month"));

function select(month, bank = "ALL") { BancaTrackerCore.state.filters.month = month; BancaTrackerCore.state.filters.bank = bank; BancaTrackerCore.refresh(); return BancaTrackerCore.getPerformanceContext(); }
let context = select("Apr-26");
assert.strictEqual(context.currentPeriodMonth, "Apr-26"); assert.strictEqual(context.elapsedMonths, 1); assert.strictEqual(context.currentPeriodData.length, 2); assert.strictEqual(context.ytdData.length, 2);
context = select("Jun-26");
assert.strictEqual(BancaTrackerCore.state.dataQuality, cachedAudit, "Month changes must reuse the cached full-upload quality audit");
assert.strictEqual(context.currentPeriodMonth, "Jun-26"); assert.strictEqual(context.elapsedMonths, 3); assert.strictEqual(context.ytdData.length, 6);

context = select("ALL");
assert.strictEqual(context.currentPeriodMonth, "Aug-26"); assert.strictEqual(context.elapsedMonths, 5); assert.strictEqual(context.currentPeriodData.length, 3); assert.strictEqual(context.ytdData.length, 11); assert.strictEqual(context.fullUploadData.length, 12);
assert.strictEqual(BancaTrackerCore.state.derived.nearActiveBranches.length, 0, "ALL activation must not sum Repeat Branch across months");
BancaTrackerApp.showPage("activationPage");
assert.ok(elements.activationScope.textContent.includes("Activation scope: Aug-26"));
assert.ok(!elements.opportunityBranches.innerHTML.includes("Repeat Branch"));
assert.ok(elements.zoneActivation.innerHTML.includes("Current Period Premium")); assert.ok(elements.stateActivation.innerHTML.includes("Activation % (Observed)"));
BancaTrackerApp.showPage("scorecardPage"); assert.ok(elements.scorecardScope.textContent.includes("Operational scorecard period: Aug-26")); BancaTrackerApp.showPage("misPage"); assert.ok(elements.performanceScope.textContent.includes("Current period: Aug-26"));

const target = BancaTrackerTarget.targetState; target.fiscalYearTarget = 120; target.monthlyTarget = 10;
const result = BancaTrackerTarget.calculateTarget(context);
assert.strictEqual(result.elapsed, 5); assert.strictEqual(result.ytdTarget, 50); assert.strictEqual(result.remainingMonths, 7);
assert.ok(Math.abs(result.rrr - ((120 - context.ytdPremium / 10000000) / 7)) < 1e-12);
assert.notStrictEqual(result.rrrLabel, "FY Complete");

context = select("ALL", "INDIAN BANK");
assert.strictEqual(context.currentPeriodMonth, "Aug-26"); assert.ok(context.fullUploadData.every((row) => row.bank === "INDIAN BANK"));
assert.strictEqual(context.currentPeriodData.length, 2); assert.strictEqual(context.ytdData.length, 6);
context = select("Bad-Month", "INDIAN BANK");
assert.strictEqual(context.currentPeriodMonth, "Bad-Month"); assert.strictEqual(context.elapsedMonths, null); assert.strictEqual(context.ytdData.length, 0);

const activationAllFixture = [
  "8000,Apr-26,INDIAN BANK,RM A,A1,Motor,Three Month Branch,South,Tamil Nadu,I1",
  "8000,May-26,INDIAN BANK,RM A,A1,Motor,Three Month Branch,South,Tamil Nadu,I1",
  "8000,Jun-26,INDIAN BANK,RM A,A1,Motor,Three Month Branch,South,Tamil Nadu,I1"
];
BancaTrackerCore.loadCsvText([H, ...activationAllFixture].join("\n"));
context = select("ALL");
assert.strictEqual(context.currentPeriodMonth, "Jun-26");
assert.strictEqual(BancaTrackerCore.state.derived.branches[0].premium, 8000);
assert.strictEqual(BancaTrackerCore.state.derived.nearActiveBranches.length, 0, "Apr+May+Jun must not aggregate to a near-active ₹24K branch under ALL");

console.log("v8.1 Step 8.1A tests passed: central scopes, partial-FY target, current-period activation, bank scope, and data-quality warnings.");
