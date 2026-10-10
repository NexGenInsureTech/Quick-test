/* v8.6.6 final acceptance Test 12B: atomic REPLACE through the public import API. */
"use strict";

const assert = require("assert");
const path = require("path");

class Element {
  constructor() { this.value = ""; this.innerHTML = ""; this.textContent = ""; this.style = {}; this.classList = { toggle() {} }; }
  addEventListener() {}
  add() {}
}
const elements = {};
global.window = global;
global.document = { getElementById(id) { return elements[id] || (elements[id] = new Element()); } };
global.Option = class { constructor(text, value) { this.text = text; this.value = value; } };
global.performance = require("perf_hooks").performance;
global.sessionStorage = { getItem() { return null; }, setItem() {} };

const root = path.join(__dirname, "..");
const load = (file) => require(path.join(root, file));
[
  "js/config.js", "js/csvProcessor.js", "js/utilities.js", "js/analytics.js", "js/dataQuality.js", "js/productivity.js",
  "js/data/schema.js", "js/data/datasetRegistry.js", "js/masters/branchMaster.js", "js/enrichment/dateResolver.js",
  "js/enrichment/branchResolver.js", "js/enrichment/liveBranchAuthority.js",
  "js/analytics/commercialPerformance.js", "js/analytics/commercialRollups.js", "js/analytics/branchExecutionWorklist.js",
].forEach(load);

const branchRecords = ["001", "002", "003"].map((code) => BancaTrackerBranchMaster.normalizeRow({
  "BANK ID": "IB", "BRANCH CODE": code, "BRANCH NAME": `Branch ${code}`, "STATE ID": "IN-AS", ACTIVE: "TRUE",
}, "BRANCH:12B", Number(code) + 1));
const authorityContext = { branchMaps: BancaTrackerBranchResolver.buildLookupMaps(branchRecords), branchRecords, branchUniverse: { authority: "GOVERNED" } };
BancaTrackerLiveBranchAuthority.setCachedContext(authorityContext);
const passthrough = { getCachedContext: () => authorityContext, applyRecords: (rows) => rows.map((row) => ({ ...row })) };
global.BancaTrackerLiveAssignmentAuthority = passthrough;
global.BancaTrackerLiveHierarchyAuthority = passthrough;
global.BancaTrackerLiveGeographyAuthority = passthrough;
global.BancaTrackerLiveBranchUniverseAuthority = { getUniverse: () => authorityContext.branchUniverse };
const commercialRecords = branchRecords.map((branch) => ({
  bankId: branch.bankId, canonicalBank: "Indian Bank", branchId: branch.branchId, branchName: branch.branchName,
  periodKey: "2026-09", budget: 100, potential: 200,
}));
global.BancaTrackerLiveBranchCommercialAuthority = { getCachedContext: () => ({ status: "READY", records: commercialRecords }) };
global.BancaTrackerShadowEnrichment = { run() { return Promise.resolve({ status: "READY" }); } };
load("js/core.js");

const H = "USGI NET PREMIUM,Month,INTERMEDIARY,BA NAME,Ba Code,LINE OF BUSINESS,BRANCH NAME,Zone,STATE,SUM IMD CODE,Day,POLICY ISSUED DATE";
const row = (premium, code, day) => `${premium},Sep-26,IB,RM One,A1,Motor,Branch ${code},East,Assam,${code},${day},${String(day).padStart(2, "0")}/09/2026`;
const datasetA = `${H}\n${row(10, "001", 1)}\n${row(-2, "001", 2)}\n${row(20, "002", 3)}`;
const datasetB = `${H}\n${row(-5, "002", 4)}`;
const runtimeFields = ["factData", "filteredData", "filters", "months", "banks", "context", "derived", "productivity", "commercialPerformance", "commercialRollup"];
const snapshot = () => Object.fromEntries(runtimeFields.map((field) => [field, BancaTrackerCore.state[field]]));
const sameSnapshot = (before) => runtimeFields.forEach((field) => assert.strictEqual(BancaTrackerCore.state[field], before[field], field));
const worklist = () => BancaTrackerBranchExecutionWorklist.buildWorklist({
  periodKey: "2026-09", bankKey: "IB", commercialPerformanceResult: BancaTrackerCore.state.commercialPerformance,
});

let assertions = 0;
const equal = (actual, expected, message) => { assertions += 1; assert.deepStrictEqual(actual, expected, message); };
const check = (value, message) => { assertions += 1; assert.ok(value, message); };

const first = BancaTrackerCore.loadCsvText(datasetA);
check(first, "Dataset A imports successfully");
equal(BancaTrackerCore.state.factData.length, 3);
equal(BancaTrackerCore.state.factData.every((fact) => fact.bankId === "IB" && /^IB:00[12]$/.test(fact.branchId)), true, "canonical identities propagate to active facts");
let projected = worklist();
equal([projected.rows.length, projected.reconciliation.scopedActual], [3, 28], "Dataset A includes two active and one commercial-master-only branch");
equal(projected.rows.find((item) => item.branchId === "IB:003").actualPremium, 0, "commercial-master-only row remains");

const second = BancaTrackerCore.loadCsvText(datasetB);
check(second, "Dataset B REPLACE commits successfully");
equal(BancaTrackerCore.state.factData.map((fact) => fact.premium), [-5], "active facts contain Dataset B only");
equal(new Set(BancaTrackerCore.state.factData.map((fact) => `${fact.branchId}\u0000${fact.monthKey}`)).size, 1, "replacement introduces no duplicate facts");
projected = worklist();
equal([projected.rows.length, projected.reconciliation.scopedActual], [3, -5], "worklist recalculates while governed master-only rows remain");
equal(projected.rows.find((item) => item.branchId === "IB:001").actualPremium, 0, "Dataset A transaction contribution does not survive REPLACE");

const stable = snapshot();
const realAnalytics = global.BancaTrackerAnalytics;
global.BancaTrackerAnalytics = { ...realAnalytics, build() { throw new Error("forced replacement failure"); } };
equal(BancaTrackerCore.loadCsvText(datasetA), null, "failed replacement is rejected");
global.BancaTrackerAnalytics = realAnalytics;
sameSnapshot(stable);
assertions += runtimeFields.length;
equal(worklist().reconciliation.scopedActual, -5, "failed replacement leaves the prior worklist basis intact");

check(BancaTrackerCore.loadCsvText(datasetA), "Dataset A can be re-imported");
projected = worklist();
equal([BancaTrackerCore.state.factData.length, projected.rows.length, projected.reconciliation.scopedActual], [3, 3, 28], "re-import restores original facts and worklist figures");
equal(projected.scope, { periodKey: "2026-09", bankKey: "IB" }, "period and canonical bank scope are rebuilt deterministically");

console.log(`v8.6.6 atomic REPLACE worklist acceptance passed: ${assertions} assertions; figures A=3 facts/3 rows/28 Actual, B=1 fact/3 rows/-5 Actual, restored=3 facts/3 rows/28 Actual.`);
