/* v8.6.6 final acceptance Test 6: governed multi-bank worklist scope. */
"use strict";

const assert = require("assert");
const path = require("path");

global.window = global;
const root = path.join(__dirname, "..");
require(path.join(root, "js/config.js"));
require(path.join(root, "js/utilities.js"));
require(path.join(root, "js/analytics/branchExecutionWorklist.js"));

const Worklist = BancaTrackerBranchExecutionWorklist;
let assertions = 0;
const equal = (actual, expected, message) => { assertions += 1; assert.deepStrictEqual(actual, expected, message); };
const check = (value, message) => { assertions += 1; assert.ok(value, message); };

function fact(bankId, branchId) {
  return { bank: `${bankId} Display`, bankId, branchId, branchAuthority: "GOVERNED_EXACT", monthKey: "2026-09" };
}
function commercial(bankId, branchId, actualPremium) {
  return {
    key: `${branchId}\u00002026-09`, branchId, periodKey: "2026-09", bankId,
    canonicalBank: `${bankId} Display`, branchName: branchId,
    stateId: "STATE", stateName: "State", zoneId: "ZONE", zoneName: "Zone",
    assignedRmId: "RM", assignedRmName: "Owner", asmId: "ASM", asmName: "Area", zsmId: "ZSM", zsmName: "Zonal",
    actualPremium, budget: 200, potential: 400, achievementPct: 50,
    budgetGap: -100, budgetRemaining: 100, potentialPenetrationPct: 25, potentialGap: 300,
    commercialStatus: "COMPLETE", referenceStatus: "COMPLETE",
    transactionCount: 1, positiveCount: actualPremium > 0 ? 1 : 0, zeroCount: actualPremium === 0 ? 1 : 0, negativeCount: actualPremium < 0 ? 1 : 0,
  };
}
function strategy(key, objective) {
  return { key, maturityBand: "1 - 14.9K", active: false, nearActive: true, activationGap: 100, nextMaturityThreshold: 15000, maturityGap: 50, strategyObjective: objective, executionCue: `${objective} cue` };
}

const bankOneFacts = [fact("BANK-1", "BANK-1:001")];
const bankTwoFacts = [fact("BANK-2", "BANK-2:001")];
const rows = [commercial("BANK-1", "BANK-1:001", 100), commercial("BANK-2", "BANK-2:001", -25)];
const performance = { status: "READY", rows, summary: {} };
const productivity = { scopeMonth: "Sep-26", branchStrategies: [strategy("BANK-1:001", "Build"), strategy("BANK-2:001", "Grow")] };

const multiBankProvenance = Worklist.buildProductivityProvenance({ currentPeriodKey: "2026-09", currentPeriodData: [...bankOneFacts, ...bankTwoFacts] });
equal(multiBankProvenance.status, "INVALID", "current helper does not claim multi-bank strategy provenance");
check(multiBankProvenance.diagnostics.some((item) => item.code === "PROVENANCE_BANK_SCOPE_MIXED"));

const priority = {
  status: "PARTIAL", periodKey: "2026-09", dimension: "BRANCH", rankingApplicable: true,
  executionPriority: [{ key: "BANK-2:001", priorityRank: 1, attentionReasons: ["PROJECTED_SHORTFALL"] }],
  referencePriority: [{ key: "BANK-1:001", priorityRank: 1, attentionReasons: ["BUDGET_REFERENCE_MISSING"] }],
  summary: { executionEligibleCount: 1, executionRankedCount: 1, unmatchedExecutionCount: 0, unmatchedStatusCount: 0 }, diagnostics: [],
};
const allBanks = Worklist.buildWorklist({ periodKey: "2026-09", commercialPerformanceResult: performance, productivityResult: productivity, productivityProvenance: multiBankProvenance, executionPriorityResult: priority });
equal(allBanks.rows.map((row) => row.branchId).sort(), ["BANK-1:001", "BANK-2:001"]);
equal(allBanks.status, "PARTIAL");
equal(allBanks.rows.every((row) => row.strategyObjective === null), true, "unproven multi-bank strategy remains unavailable");
equal(allBanks.rows.find((row) => row.branchId === "BANK-2:001").priorityRank, 1, "executionPriority is consumed");
equal(allBanks.rows.find((row) => row.branchId === "BANK-1:001").priorityRank, null, "referencePriority is never substituted");

const bankOneProvenance = Worklist.buildProductivityProvenance({ currentPeriodKey: "2026-09", currentPeriodData: bankOneFacts });
equal(bankOneProvenance.status, "READY");
equal(bankOneProvenance.bankKey, "BANK-1");
const bankOne = Worklist.buildWorklist({ periodKey: "2026-09", bankKey: "BANK-1", commercialPerformanceResult: performance, productivityResult: { scopeMonth: "Sep-26", branchStrategies: [productivity.branchStrategies[0]] }, productivityProvenance: bankOneProvenance });
equal(bankOne.rows.map((row) => row.branchId), ["BANK-1:001"], "selected bank excludes the other canonical bank");
equal(bankOne.rows[0].strategyObjective, "Build", "selected-bank strategy enriches only its proven identity");
check(bankOne.diagnostics.some((item) => item.code === "COMMERCIAL_ROW_BANK_EXCLUDED"));

const missingBank = Worklist.buildWorklist({ periodKey: "2026-09", bankKey: "BANK-1", commercialPerformanceResult: { status: "READY", rows: [{ ...rows[0], bankId: null }], summary: {} } });
equal(missingBank.status, "INVALID_INPUT", "missing canonical commercial bank identity fails closed");
check(missingBank.diagnostics.some((item) => item.code === "COMMERCIAL_BANK_IDENTITY_MISSING"));

console.log(`v8.6.6 multi-bank worklist acceptance passed: ${assertions} assertions.`);
