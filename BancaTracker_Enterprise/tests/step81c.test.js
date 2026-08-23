/* v8.1 Step 8.1C productivity, ownership, concentration, scope, and quality-integration regressions. */
const assert = require("assert"); const path = require("path");
class Element { constructor() { this.value = ""; this.innerHTML = ""; this.textContent = ""; this.style = {}; this.classList = { toggle() {} }; } addEventListener() {} add() {} }
const elements = {}; global.window = global; global.document = { getElementById(id) { return elements[id] || (elements[id] = new Element()); } }; global.Option = class {}; global.sessionStorage = { getItem() { return null; }, setItem() {} }; global.performance = require("perf_hooks").performance;
const load = (file) => require(path.join(__dirname, "..", file)); ["js/config.js", "js/csvProcessor.js", "js/utilities.js", "js/analytics.js", "js/dataQuality.js", "js/productivity.js", "js/core.js", "js/performance.js", "app.js", "js/activation.js", "js/scorecard.js", "js/target.js"].forEach(load);
const H = "USGI NET PREMIUM,Month,INTERMEDIARY,BA NAME,Ba Code,LINE OF BUSINESS,BRANCH NAME,Zone,STATE,SUM IMD CODE,Business Type,PRODUCT NAME,PRODUCT CODE,Day";
const rows = [
  "15000,Jun-26,INDIAN BANK,RM One,BA1,Motor,Active A,South,Tamil Nadu,IMD-X,Fresh,Motor One,P1,1",
  "15000,Jun-26,INDIAN BANK,RM One,BA1,Health,Active A,South,Tamil Nadu,IMD-X,Renewal,Health One,P2,1",
  "20000,Jun-26,INDIAN BANK,RM One,BA1,Motor,Near B,South,Tamil Nadu,IMD-X,Fresh,Motor Uno,P1,1",
  "10000,Jun-26,INDIAN BANK,RM One,BA2,Motor,Low C,South,Tamil Nadu,IMD-X,,Motor One,P1,1",
  "8000,Jun-26,INDIAN BANK,RM Three,BA3,Motor,Near D,North,Tamil Nadu,IMD-Y,Fresh,Motor One,P1,1",
  "8000,Jun-26,INDIAN BANK,RM Four,BA3,Motor,Near D,West,Tamil Nadu,IMD-Y,Fresh,Motor One,P1,1",
  "9000,Jun-26,INDIAN BANK,RM Five,BA4,Motor,Near E,South,Tamil Nadu,IMD-Y,Fresh,Motor One,P1,1",
  "9000,Jun-26,INDIAN BANK,RM Six,BA5,Motor,Near E,South,Tamil Nadu,IMD-Z,Fresh,Motor One,P1,1",
  "25000,Jun-26,KARNATAKA BANK,RM Seven,KB1,Motor,KB Active,South,Karnataka,IMD-X,Renewal,Motor One,P1,1",
  "999999,May-26,INDIAN BANK,RM One,BA1,Motor,Historical Only,South,Tamil Nadu,IMD-X,Fresh,Motor One,P1,1"
];
BancaTrackerCore.loadCsvText([H, ...rows].join("\n"));
let p = BancaTrackerCore.state.productivity;
assert.strictEqual(p.scopeMonth, "Jun-26"); assert.strictEqual(p.summary.observedBranches, 6); assert.strictEqual(p.summary.activeBranches, 2); assert.strictEqual(p.summary.nearActiveBranches, 3); assert.strictEqual(p.summary.aggregateActivationGap, 21000);
const ba1 = p.rmMetrics.find((item) => item.bank === "INDIAN BANK" && item.code === "BA1");
assert.strictEqual(ba1.name, "RM One"); assert.strictEqual(ba1.observedBranches, 2); assert.strictEqual(ba1.activeBranches, 1); assert.strictEqual(ba1.nearActiveBranches, 1); assert.strictEqual(ba1.premium, 50000); assert.strictEqual(ba1.premiumPerObservedBranch, 25000); assert.strictEqual(ba1.premiumPerActiveBranch, 50000); assert.strictEqual(ba1.lobBreadth, 2); assert.strictEqual(ba1.productBreadth, 2);
const ba2 = p.rmMetrics.find((item) => item.code === "BA2"); assert.strictEqual(ba2.premiumPerActiveBranch, null); assert.notStrictEqual(String(ba2.premiumPerActiveBranch), "Infinity");
const ba3 = p.rmMetrics.find((item) => item.code === "BA3"); assert.strictEqual(ba3.mappingConflict, true); assert.strictEqual(ba3.name, "Mapping conflict");
assert.strictEqual(p.rmMetrics.filter((item) => item.name === "RM One").length, 2, "duplicate RM names with different BA Codes remain separate entities");
const indianImdX = p.imdMetrics.find((item) => item.bank === "INDIAN BANK" && item.code === "IMD-X"); const karnatakaImdX = p.imdMetrics.find((item) => item.bank === "KARNATAKA BANK" && item.code === "IMD-X");
assert.ok(indianImdX && karnatakaImdX); assert.notStrictEqual(indianImdX.key, karnatakaImdX.key); assert.strictEqual(indianImdX.observedBaCodes, 2);
const activeA = p.branchMetrics.find((item) => item.branch === "Active A"); assert.strictEqual(activeA.active, true); assert.strictEqual(activeA.gap, 0); assert.strictEqual(activeA.lobBreadth, 2); assert.strictEqual(activeA.productBreadth, 2); assert.strictEqual(activeA.baCodeLabel, "BA1");
const nearD = p.opportunities.find((item) => item.branch === "Near D"); assert.strictEqual(nearD.rmLabel, "Multiple mappings"); assert.strictEqual(nearD.hierarchyConflict, true);
const nearE = p.opportunities.find((item) => item.branch === "Near E"); assert.strictEqual(nearE.baCodeLabel, "Multiple mappings"); assert.strictEqual(nearE.imdLabel, "Multiple mappings");
const bankConcentration = p.concentrations.bank.find((item) => item.name === "INDIAN BANK"); assert.strictEqual(bankConcentration.nearActiveBranches, 3); assert.strictEqual(bankConcentration.aggregateGap, 21000);
assert.strictEqual(p.concentrations.zone.find((item) => item.name === "Multiple mappings").nearActiveBranches, 1); assert.ok(p.concentrations.state.some((item) => item.name === "Tamil Nadu")); assert.ok(p.concentrations.rm.some((item) => item.name === "Multiple mappings")); assert.ok(p.concentrations.imd.some((item) => item.name === "Multiple mappings"));
BancaTrackerApp.showPage("productivityPage");
assert.ok(elements.productivityScope.textContent.includes("Jun-26 (CURRENT PERIOD)")); assert.ok(elements.rmProductivity.innerHTML.includes("Mapping conflict")); assert.ok(elements.opportunityOwnership.innerHTML.includes("Multiple mappings"));

BancaTrackerCore.state.filters.month = "May-26"; BancaTrackerCore.refresh(); p = BancaTrackerCore.state.productivity;
assert.strictEqual(p.scopeMonth, "May-26"); assert.strictEqual(p.branchMetrics.length, 1); assert.strictEqual(p.branchMetrics[0].branch, "Historical Only");
BancaTrackerCore.state.filters.month = "ALL"; BancaTrackerCore.state.filters.bank = "KARNATAKA BANK"; BancaTrackerCore.refresh(); p = BancaTrackerCore.state.productivity;
assert.strictEqual(p.scopeMonth, "Jun-26"); assert.strictEqual(p.rmMetrics.length, 1); assert.ok(p.branchMetrics.every((item) => item.bank === "KARNATAKA BANK"));
BancaTrackerApp.showPage("misPage"); assert.ok(elements.kpis.innerHTML.includes("YTD Premium")); BancaTrackerApp.showPage("activationPage"); assert.ok(elements.activationKpis.innerHTML.includes("Active Branches")); BancaTrackerApp.showPage("scorecardPage"); assert.ok(elements.scorecardSummary.innerHTML.includes("Total Partner Banks")); BancaTrackerApp.showPage("targetPage"); assert.ok(elements.targetKpis.innerHTML.includes("FY Target"));
console.log("v8.1 Step 8.1C tests passed: RM/IMD/branch productivity, ownership, concentration, breadth, scopes, filters, quality integration, and page regressions.");
