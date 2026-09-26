/* v8.6.1 Step 4: isolated Management Bank filter and blast-radius contract. */
"use strict";

const assert = require("assert");
const path = require("path");
class Element { constructor() { this.innerHTML = ""; this.textContent = ""; this.value = ""; } addEventListener() {} }
const elements = {};
global.window = global;
global.document = { getElementById(id) { return elements[id] || (elements[id] = new Element()); } };
const load = (file) => require(path.join(__dirname, "..", file));
["js/config.js", "js/utilities.js", "js/analytics.js", "js/analytics/managementBank.js", "js/productivity.js"].forEach(load);

const targets = { "INDIAN BANK": 120, "INDIAN BANK (PMSBY)": 25, "INDIAN OVERSEAS BANK": 75 };
global.BancaTrackerTarget = { calculateTargetForBank(context, bank, ytdPremium) { const annualTarget = targets[bank] ?? null; return { bank, annualTarget, actual: ytdPremium, ytdTarget: annualTarget, achievement: annualTarget > 0 ? ytdPremium / annualTarget * 100 : null, gap: annualTarget === null ? null : annualTarget - ytdPremium }; } };
load("js/scorecard.js");

function fact(bank, premium, id) { return { bank, canonicalBank: bank, premium, month: "Apr-26", monthKey: "2026-04", branch: `Branch ${id}`, branchId: `B:${id}`, branchCode: id, imd: `I-${id}`, baCode: `BA-${id}`, rm: `RM ${id}`, lob: "Motor", productCode: `P-${id}` }; }
const facts = [fact("INDIAN BANK", 80, "IC"), fact("INDIAN BANK (PMSBY)", 20, "IP"), fact("INDIAN OVERSEAS BANK", 50, "OC"), fact("INDIAN OVERSEAS BANK (PMSBY)", 10, "OP"), fact("KARNATAKA BANK LTD.", 40, "KB"), fact("UNLISTED BANK", 7, "U")];
const audit = { hierarchyConflicts: [], branchUniverseSanity: [], baCodeConflicts: [], productConflicts: [], bankQuality: { unknownBanks: ["UNLISTED BANK"] }, productCodeCompleteness: null };
const operationalCurrent = facts.filter((row) => row.bank === "INDIAN BANK");
const operationalDerived = BancaTrackerAnalytics.build(operationalCurrent);
const operationalContext = { selectedMonth: "ALL", currentPeriodMonth: "Apr-26", progressionMonth: "Apr-26", currentPeriodData: operationalCurrent, ytdData: operationalCurrent, ytdPremiumByBank: { "INDIAN BANK": 80 }, currentPeriodKey: "2026-04", elapsedMonths: 1 };
const operationalProductivity = BancaTrackerProductivity.build(operationalContext, operationalDerived, audit);
global.BancaTrackerCore = { state: { factData: facts, derived: operationalDerived, productivity: operationalProductivity, dataQuality: audit, filters: { month: "ALL", bank: "INDIAN BANK" } }, getPerformanceContext() { return operationalContext; } };

const options = BancaTrackerScorecard.buildManagementBankOptions(facts);
assert.strictEqual(options.filter((bank) => bank === "INDIAN BANK").length, 1);
assert.ok(!options.includes("INDIAN BANK (PMSBY)"));
assert.strictEqual(options.filter((bank) => bank === "INDIAN OVERSEAS BANK").length, 1);
assert.ok(!options.includes("INDIAN OVERSEAS BANK (PMSBY)"));
assert.ok(!options.includes("UNLISTED BANK"), "unmapped sources are explicit in ALL but are not selectable as Management Banks");

const allScope = BancaTrackerScorecard.managementContext(BancaTrackerCore.state, operationalContext);
assert.strictEqual(allScope.context.currentPeriodData.reduce((sum, row) => sum + row.premium, 0), 207);

BancaTrackerScorecard.uiState.managementBankFilter = "INDIAN BANK";
const indianScope = BancaTrackerScorecard.managementContext(BancaTrackerCore.state, operationalContext);
assert.deepStrictEqual(indianScope.context.currentPeriodData.map((row) => row.bank), ["INDIAN BANK", "INDIAN BANK (PMSBY)"]);
assert.strictEqual(new Set(indianScope.context.currentPeriodData.map((row) => row.branchId)).size, 2);
assert.deepStrictEqual(indianScope.context.currentPeriodData.map((row) => row.subChannel), ["CORE", "PMSBY"]);
assert.strictEqual(indianScope.context.currentPeriodData.reduce((sum, row) => sum + row.premium, 0), 100);

const indianMetrics = BancaTrackerScorecard.buildPartnerMetrics(indianScope.derived, indianScope.productivity, audit, "INDIAN BANK", indianScope.context);
assert.strictEqual(indianMetrics.length, 1);
assert.deepStrictEqual([indianMetrics[0].premium, indianMetrics[0].budget, indianMetrics[0].achievementPercent, indianMetrics[0].contributionPercent], [100, 120, 100 / 120 * 100, 100]);

BancaTrackerScorecard.uiState.managementBankFilter = "INDIAN OVERSEAS BANK";
const iobScope = BancaTrackerScorecard.managementContext(BancaTrackerCore.state, operationalContext);
assert.deepStrictEqual(iobScope.context.currentPeriodData.map((row) => row.bank), ["INDIAN OVERSEAS BANK", "INDIAN OVERSEAS BANK (PMSBY)"]);
assert.strictEqual(iobScope.context.currentPeriodData.reduce((sum, row) => sum + row.premium, 0), 60);

assert.deepStrictEqual(BancaTrackerCore.state.filters, { month: "ALL", bank: "INDIAN BANK" });
assert.strictEqual(BancaTrackerCore.state.derived.totalPremium, 80);
assert.strictEqual(BancaTrackerCore.state.productivity.summary.observedBranches, 1);
assert.deepStrictEqual(facts.map((row) => row.bank), ["INDIAN BANK", "INDIAN BANK (PMSBY)", "INDIAN OVERSEAS BANK", "INDIAN OVERSEAS BANK (PMSBY)", "KARNATAKA BANK LTD.", "UNLISTED BANK"]);

BancaTrackerScorecard.uiState.managementBankFilter = "ALL";
BancaTrackerScorecard.refreshScorecard(operationalDerived);
assert.ok(elements.managementBankFilter.innerHTML.includes("INDIAN BANK"));
assert.ok(!elements.managementBankFilter.innerHTML.includes("INDIAN BANK (PMSBY)"));
assert.ok(elements.partnerScorecard.innerHTML.includes("UNLISTED BANK"));
assert.ok(elements.scorecardScope.textContent.includes("Management Bank: ALL"));

console.log("v8.6.1 isolated Management Bank filter integration tests passed.");
