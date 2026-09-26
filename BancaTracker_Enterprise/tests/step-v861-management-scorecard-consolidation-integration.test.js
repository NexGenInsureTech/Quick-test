/* v8.6.1 Step 3: focused Management Scorecard consolidation integration. */
"use strict";

const assert = require("assert");
const path = require("path");

class Element { constructor() { this.innerHTML = ""; this.textContent = ""; } addEventListener() {} }
const elements = {};
global.window = global;
global.document = { getElementById(id) { return elements[id] || (elements[id] = new Element()); } };
const load = (file) => require(path.join(__dirname, "..", file));
["js/config.js", "js/utilities.js", "js/analytics.js", "js/analytics/managementBank.js"].forEach(load);

const targets = {
  "INDIAN BANK": 120,
  "INDIAN BANK (PMSBY)": 25,
  "INDIAN OVERSEAS BANK": 75,
  "INDIAN OVERSEAS BANK (PMSBY)": 15,
  "KARNATAKA BANK LTD.": 50,
};
const targetCalls = [];
global.BancaTrackerTarget = {
  calculateTargetForBank(context, bank, ytdPremium) {
    targetCalls.push({ bank, ytdPremium });
    const annualTarget = Object.prototype.hasOwnProperty.call(targets, bank) ? targets[bank] : null;
    const actual = ytdPremium;
    return { bank, annualTarget, actual, ytdTarget: annualTarget, achievement: annualTarget > 0 ? actual / annualTarget * 100 : null, gap: annualTarget === null ? null : annualTarget - actual };
  },
};
global.BancaTrackerProductivity = { concentration() { return []; } };

load("js/scorecard.js");

function fact(bank, premium, id, canonicalBank = bank) {
  return { bank, premium, canonicalBank, branch: `Branch ${id}`, branchId: `B:${id}`, branchCode: id, imd: `IMD-${id}`, baCode: `BA-${id}`, rm: `RM ${id}`, assignedRmId: `ARM-${id}`, lob: "Motor", productCode: `P-${id}`, productName: `Product ${id}` };
}
const facts = [
  fact("INDIAN BANK", 80, "IB-C"),
  fact("INDIAN BANK (PMSBY)", 20, "IB-P", "INDIAN BANK (PMSBY)"),
  fact("INDIAN OVERSEAS BANK", 50, "IOB-C"),
  fact("INDIAN OVERSEAS BANK (PMSBY)", 10, "IOB-P"),
  fact("KARNATAKA BANK LTD.", 40, "KB"),
];
const originalFacts = facts.map((row) => ({ ...row }));
const derived = BancaTrackerAnalytics.build(facts);
function item(bank, id, premium) { return { key: `${bank}:${id}`, bank, code: id, name: `RM ${id}`, premium, observedBranches: 1, activeBranches: 0, nearActiveBranches: 0, aggregateActivationGap: 0, branches: [], productCodes: new Set(), baCodes: new Set(), imds: new Set() }; }
const bankIndexes = Object.fromEntries(facts.map((row) => [row.bank, { rms: [item(row.bank, row.baCode, row.premium)], imds: [item(row.bank, row.imd, row.premium)], branches: [], opportunities: [] }]));
const productivity = { bankIndexes, ytdPremiumByBank: Object.fromEntries(facts.map((row) => [row.bank, row.premium])), rmMetrics: [], imdMetrics: [], opportunities: [] };
const audit = { hierarchyConflicts: [], branchUniverseSanity: [], baCodeConflicts: [], productConflicts: [], bankQuality: { unknownBanks: [] } };
const context = { currentPeriodMonth: "Apr-26" };

const metrics = BancaTrackerScorecard.buildPartnerMetrics(derived, productivity, audit, "ALL", context);
const indianRows = metrics.filter((row) => row.bank === "INDIAN BANK");
assert.strictEqual(indianRows.length, 1);
assert.strictEqual(metrics.some((row) => row.bank === "INDIAN BANK (PMSBY)"), false);
const indian = indianRows[0];
assert.strictEqual(indian.premium, 100);
assert.strictEqual(indian.budget, 120);
assert.notStrictEqual(indian.budget, 145);
assert.strictEqual(indian.achievementPercent, 100 / 120 * 100);
assert.strictEqual(indian.contributionPercent, 50);
assert.deepStrictEqual(indian.sourceBanks, ["INDIAN BANK", "INDIAN BANK (PMSBY)"]);

const iob = metrics.find((row) => row.bank === "INDIAN OVERSEAS BANK");
const karnataka = metrics.find((row) => row.bank === "KARNATAKA BANK LTD.");
assert.deepStrictEqual([iob.premium, iob.contributionPercent], [60, 30]);
assert.deepStrictEqual([karnataka.premium, karnataka.contributionPercent], [40, 20]);
assert.ok(Math.abs(metrics.reduce((sum, row) => sum + row.contributionPercent, 0) - 100) < 1e-10);
assert.deepStrictEqual(metrics.filter((row) => row.premium > 0).map((row) => row.bank), ["INDIAN BANK", "INDIAN OVERSEAS BANK", "KARNATAKA BANK LTD."]);

assert.strictEqual(indian.priority, BancaTrackerScorecard.classifyPriority(indian));
assert.strictEqual(indian.cue, BancaTrackerScorecard.managementCue(indian));
assert.ok(targetCalls.some((call) => call.bank === "INDIAN BANK" && call.ytdPremium === 100));
assert.ok(!targetCalls.some((call) => call.bank === "INDIAN BANK (PMSBY)"));

global.BancaTrackerCore = { state: { productivity, dataQuality: audit, filters: { bank: "ALL" } }, getPerformanceContext() { return context; } };
BancaTrackerScorecard.refreshScorecard(derived);
assert.strictEqual((elements.partnerScorecard.innerHTML.match(/data-bank='INDIAN%20BANK'/g) || []).length, 1);
assert.ok(!elements.partnerScorecard.innerHTML.includes("INDIAN BANK (PMSBY)"));
assert.ok(elements.managementActions.innerHTML.includes("INDIAN BANK"));
assert.ok(!elements.managementActions.innerHTML.includes("INDIAN BANK (PMSBY)"));

const childFacts = BancaTrackerManagementBank.filterFacts(facts, "INDIAN BANK");
assert.deepStrictEqual(childFacts.map((row) => [row.bank, row.subChannel, row.branch, row.imd, row.baCode, row.rm]), [
  ["INDIAN BANK", "CORE", "Branch IB-C", "IMD-IB-C", "BA-IB-C", "RM IB-C"],
  ["INDIAN BANK (PMSBY)", "PMSBY", "Branch IB-P", "IMD-IB-P", "BA-IB-P", "RM IB-P"],
]);
assert.deepStrictEqual(facts, originalFacts);

BancaTrackerScorecard.buildPartnerMetrics(derived, productivity, audit, "ALL", context);
assert.deepStrictEqual(facts, originalFacts);

console.log("v8.6.1 Management Scorecard consolidation integration tests passed.");
