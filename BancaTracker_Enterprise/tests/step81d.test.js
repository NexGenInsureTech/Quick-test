/* v8.1 Step 8.1D priority, exception, target, and drill-down regressions. */
const assert = require("assert"); const path = require("path");
class Element { constructor() { this.value = ""; this.innerHTML = ""; this.textContent = ""; this.style = {}; this.classList = { toggle() {} }; } addEventListener() {} add() {} }
const elements = {}; global.window = global; global.document = { getElementById(id) { return elements[id] || (elements[id] = new Element()); } }; global.Option = class {}; global.sessionStorage = { getItem() { return null; }, setItem() {} }; global.performance = require("perf_hooks").performance;
const load = (file) => require(path.join(__dirname, "..", file)); ["js/config.js", "js/csvProcessor.js", "js/utilities.js", "js/analytics.js", "js/dataQuality.js", "js/productivity.js", "js/core.js", "js/performance.js", "app.js", "js/activation.js", "js/scorecard.js", "js/target.js"].forEach(load);
const priority = BancaTrackerScorecard.classifyPriority;
assert.strictEqual(priority({ premium: 0, observedBranches: 0, dataQualityError: false, activationPercent: 0, nearActiveBranches: 0 }), "NO DATA");
assert.strictEqual(priority({ premium: 1, observedBranches: 1, dataQualityError: true, activationPercent: 80, nearActiveBranches: 0 }), "CRITICAL");
assert.strictEqual(priority({ premium: 1, observedBranches: 1, dataQualityError: false, activationPercent: 9, nearActiveBranches: 1 }), "CRITICAL");
assert.strictEqual(priority({ premium: 1, observedBranches: 1, dataQualityError: false, activationPercent: 15, nearActiveBranches: 1 }), "HIGH");
assert.strictEqual(priority({ premium: 1, observedBranches: 1, dataQualityError: false, activationPercent: 30, nearActiveBranches: 0 }), "MEDIUM");
assert.strictEqual(priority({ premium: 1, observedBranches: 1, dataQualityError: false, activationPercent: 50, nearActiveBranches: 0 }), "LOW");

const H = "USGI NET PREMIUM,Month,INTERMEDIARY,BA NAME,Ba Code,LINE OF BUSINESS,BRANCH NAME,Zone,STATE,SUM IMD CODE,Business Type,PRODUCT NAME,PRODUCT CODE,Day";
const rows = [
  "20000,Jun-26,INDIAN BANK,RM One,BA1,Motor,Near One,South,Tamil Nadu,IMD1,Fresh,Motor,P1,1",
  "24000,Jun-26,INDIAN BANK,RM One,BA1,Health,Near Two,South,Tamil Nadu,IMD1,Fresh,Health,P2,1",
  "1000,Jun-26,INDIAN BANK,RM One,BA1,Motor,Near One,West,Tamil Nadu,IMD1,Fresh,Motor,P1,1",
  "25000,Jun-26,INDIAN BANK,RM Two,BA2,Motor,Active One,South,Tamil Nadu,IMD2,Renewal,Motor,P1,1",
  "50000,May-26,INDIAN BANK,RM One,BA1,Motor,Historical,South,Tamil Nadu,IMD1,Fresh,Motor,P1,1"
];
for (let index = 0; index < 31; index += 1) rows.push(`25000,Jun-26,OTHER,Other RM ${index},O${index},Motor,Other ${index},Other Zone,Other State,OI${index},Fresh,Motor,P1,1`);
BancaTrackerCore.loadCsvText([H, ...rows].join("\n"));
BancaTrackerApp.showPage("scorecardPage");
let context = BancaTrackerCore.getPerformanceContext(); let productivity = BancaTrackerCore.state.productivity; let audit = BancaTrackerCore.state.dataQuality;
let metrics = BancaTrackerScorecard.buildPartnerMetrics(BancaTrackerCore.state.derived, productivity, audit, "ALL");
const indian = metrics.find((item) => item.bank === "INDIAN BANK"); const other = metrics.find((item) => item.bank === "OTHER");
assert.strictEqual(indian.dataQualityError, true); assert.strictEqual(indian.priority, "CRITICAL"); assert.strictEqual(indian.nearActiveBranches, 2); assert.strictEqual(indian.aggregateActivationGap, 5000);
assert.strictEqual(other.priority, "LOW"); assert.ok(metrics.indexOf(indian) < metrics.indexOf(other)); assert.strictEqual(metrics[metrics.length - 1].priority, "NO DATA");
assert.strictEqual(indian.aggregateActivationGap, productivity.concentrations.bank.find((item) => item.name === "INDIAN BANK").aggregateGap, "scorecard must reuse the same opportunity population");

let model = { metrics, productivity, audit, context, derived: BancaTrackerCore.state.derived };
let detail = BancaTrackerScorecard.buildBankDetail("INDIAN BANK", model);
assert.strictEqual(detail.index.opportunities, productivity.bankIndexes["INDIAN BANK"].opportunities); assert.strictEqual(detail.index.opportunities[0].branch, "Near Two"); assert.strictEqual(detail.index.opportunities[0].gap, 1000); assert.strictEqual(detail.target.annualTarget, null);
assert.ok(detail.quality.errors.some((message) => message.includes("multiple Zone")));
const rm = detail.index.rms.find((item) => item.code === "BA1"); const imd = detail.index.imds.find((item) => item.code === "IMD1");
assert.strictEqual(rm.nearActiveBranches, 2); assert.strictEqual(rm.aggregateActivationGap, 5000); assert.strictEqual(imd.nearActiveBranches, 2); assert.strictEqual(imd.aggregateActivationGap, 5000);
BancaTrackerScorecard.selectBank("INDIAN BANK"); BancaTrackerScorecard.selectRm(rm.key); assert.ok(elements.managementDetail.innerHTML.includes("RM / BA Code: BA1")); assert.ok(elements.managementDetail.innerHTML.includes("Near Two"));
BancaTrackerScorecard.selectImd(imd.key); assert.ok(elements.managementDetail.innerHTML.includes("IMD: IMD1"));

const exceptions = BancaTrackerScorecard.buildExceptions(metrics, productivity);
assert.ok(exceptions.some((item) => item.label === "INDIAN BANK" && item.message.includes("Data Quality ERROR")));
assert.ok(exceptions.some((item) => item.label.includes("BA1") && item.message.includes("2 near-active")));
assert.ok(exceptions.some((item) => item.label.includes("IMD1") && item.message.includes("2 near-active")));
assert.strictEqual(BancaTrackerConfig.MANAGEMENT.SMALL_ACTIVATION_GAP, 5000); assert.ok(exceptions.some((item) => item.label.includes("Near Two") && item.message.includes("1,000 gap")));

BancaTrackerTarget.targetState.bankTargets["INDIAN BANK"] = 60;
detail = BancaTrackerScorecard.buildBankDetail("INDIAN BANK", model); assert.strictEqual(detail.target.annualTarget, 60); assert.ok(detail.target.ytdTarget > 0); assert.ok(Number.isFinite(detail.target.achievement));
BancaTrackerCore.state.filters.bank = "INDIAN BANK"; BancaTrackerCore.refresh(); productivity = BancaTrackerCore.state.productivity; metrics = BancaTrackerScorecard.buildPartnerMetrics(BancaTrackerCore.state.derived, productivity, audit, "INDIAN BANK"); assert.strictEqual(metrics.length, 1); assert.strictEqual(metrics[0].bank, "INDIAN BANK"); assert.ok(elements.managementDetail.innerHTML.includes("INDIAN BANK Management Detail"));
BancaTrackerCore.state.filters.month = "May-26"; BancaTrackerCore.refresh(); assert.strictEqual(BancaTrackerCore.state.productivity.scopeMonth, "May-26"); assert.ok(!elements.managementDetail.innerHTML.includes("Near Two"));
BancaTrackerApp.showPage("misPage"); assert.ok(elements.kpis.innerHTML.includes("YTD Premium")); BancaTrackerApp.showPage("activationPage"); assert.ok(elements.activationKpis.innerHTML.includes("Active Branches")); BancaTrackerApp.showPage("targetPage"); assert.ok(elements.targetKpis.innerHTML.includes("FY Target")); BancaTrackerApp.showPage("qualityPage"); assert.ok(elements.qualitySummary.innerHTML.includes("Accepted Rows"));
console.log("v8.1 Step 8.1D tests passed: priorities, shared gaps, ordering, bank/RM/IMD drill-down, targets, quality, exceptions, filters, and current-period semantics.");
