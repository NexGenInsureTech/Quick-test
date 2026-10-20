/* v8.6.7 Increment 2: explainable Branch Execution actionability. */
"use strict";

const assert = require("assert");
const path = require("path");

global.window = global;
global.BancaTrackerConfig = { BANK_ALIASES: {} };
const root = path.join(__dirname, "..");
require(path.join(root, "js/utilities.js"));
require(path.join(root, "js/analytics/branchExecutionWorklist.js"));

const Worklist = BancaTrackerBranchExecutionWorklist;
let assertions = 0;
const equal = (actual, expected, message) => { assertions += 1; assert.deepStrictEqual(actual, expected, message); };
const check = (condition, message) => { assertions += 1; assert.ok(condition, message); };

function commercial(branchId, overrides = {}) {
  return {
    key: `${branchId}\u00002026-04`, branchId, periodKey: "2026-04",
    bankId: "BANK-1", canonicalBank: "Bank One", branchName: branchId,
    assignedRmId: "RM-1", assignedRmName: "Current RM",
    csmId: "CSM-1", csmName: "Channel Manager", asmId: "ASM-1", asmName: "Area Manager",
    zsmId: "ZSM-1", zsmName: "Zonal Manager", nationalHeadId: "NH-1", nationalHeadName: "National Head",
    actualPremium: 100, budget: 500, potential: 800, budgetGap: -400, budgetRemaining: 400,
    achievementPct: 20, potentialPenetrationPct: 12.5, potentialGap: 700,
    commercialStatus: "COMPLETE", referenceStatus: "COMPLETE", ...overrides,
  };
}

function priorityRow(key, rank, overrides = {}) {
  return {
    key, priorityRank: rank, attentionReasons: ["BUDGET_NOT_ACHIEVED", "PROJECTED_SHORTFALL", "BEHIND_LINEAR_PACE"],
    priorityBasis: { hasProjectedShortfall: true, projectedShortfallAmount: 300, behindPace: true, paceGapMagnitude: 150, budget: 500 },
    sourceMeasures: { projectedBudgetGap: -300, paceGap: -150, projectedMonthEndActual: 200, projectedAchievementPct: 40, requiredDailyRunRate: 20 },
    ...overrides,
  };
}

function build(rows, rankedRows, overrides = {}) {
  return Worklist.buildWorklist({
    periodKey: "2026-04", commercialPerformanceResult: { status: "READY", rows },
    executionPriorityResult: {
      status: "READY", periodKey: "2026-04", dimension: "BRANCH", rankingApplicable: true,
      executionPriority: rankedRows,
      summary: { executionEligibleCount: rankedRows.length, executionRankedCount: rankedRows.length, unmatchedExecutionCount: 0, unmatchedStatusCount: 0 },
    }, ...overrides,
  });
}

const result = build([commercial("B1"), commercial("B2")], [priorityRow("B2", 2), priorityRow("B1", 1)]);
equal(result.rows.map((row) => [row.branchId, row.priorityRank]), [["B1", 1], ["B2", 2]], "supplied rank order is retained");
const row = result.rows[0];
equal(row.projectedShortfallAmount, 300, "projected shortfall is copied without recalculation");
equal(row.paceGapMagnitude, 150, "pace magnitude is copied without recalculation");
equal(row.projectedMonthEndActual, 200);
equal(row.requiredDailyRunRate, 20);
equal(row.impactBasis, "PROJECTED_BUDGET_SHORTFALL");
equal(row.impactAmount, 300);
check(row.priorityExplanation.includes("not guaranteed uplift"));
check(row.suggestedAction.includes("projected Budget shortfall"));
equal(row.ownershipStatus, "MAPPED");
equal([row.responsibleOwnerId, row.responsibleOwnerName, row.responsibleOwnerRole], ["RM-1", "Current RM", "ASSIGNED_RM"]);
equal([row.escalationOwnerId, row.escalationOwnerName, row.escalationOwnerRole], ["CSM-1", "Channel Manager", "CSM"]);
check(Object.isFrozen(row.priorityEvidence), "nested evidence is frozen");
equal(row.priorityEvidence.projectedBudgetGap, -300, "signed source evidence is retained");

const strategyResult = Worklist.buildWorklist({
  periodKey: "2026-04", bankKey: "BANK-1", commercialPerformanceResult: { status: "READY", rows: [commercial("B1")] },
  productivityResult: { branchStrategies: [{ key: "B1", maturityBand: "15K - 24.9K", active: false, nearActive: true, activationGap: 100,
    nextMaturityThreshold: 25000, maturityGap: 100, strategyObjective: "Convert", executionCue: "Close the verified activation gap." }] },
  productivityProvenance: { status: "READY", periodKey: "2026-04", bankKey: "BANK-1", identities: [{ strategyKey: "B1", branchId: "B1" }], diagnostics: [] },
  executionPriorityResult: { status: "READY", periodKey: "2026-04", bankKey: "BANK-1", dimension: "BRANCH", rankingApplicable: true,
    executionPriority: [priorityRow("B1", 1)], summary: { executionEligibleCount: 1, executionRankedCount: 1, unmatchedExecutionCount: 0, unmatchedStatusCount: 0 } },
});
check(strategyResult.rows[0].suggestedAction.endsWith("Close the verified activation gap."), "only compatible strategy cue enriches the bounded priority action");

const pace = build([commercial("PACE")], [priorityRow("PACE", 1, {
  attentionReasons: ["BUDGET_NOT_ACHIEVED", "BEHIND_LINEAR_PACE"],
  priorityBasis: { hasProjectedShortfall: false, projectedShortfallAmount: 0, behindPace: true, paceGapMagnitude: 75, budget: 500 },
})]).rows[0];
equal(pace.impactBasis, "PACE_GAP_MAGNITUDE");
equal(pace.impactAmount, 75);
check(pace.priorityExplanation.includes("linear pace gap"));

const missing = build([commercial("NONE", {
  assignedRmId: null, assignedRmName: "Stale name", csmId: null, csmName: null,
  asmId: null, asmName: null, zsmId: null, zsmName: null, nationalHeadId: null, nationalHeadName: null,
})], []).rows[0];
equal(missing.ownershipStatus, "UNMAPPED");
equal([missing.responsibleOwnerId, missing.responsibleOwnerName, missing.responsibleOwnerRole], [null, null, null], "an unverified name cannot fabricate an RM");
equal([missing.escalationOwnerId, missing.escalationOwnerName, missing.escalationOwnerRole], [null, null, null]);
equal(missing.priorityExplanation, null, "unranked rows receive no priority actionability");
equal(missing.impactAmount, null, "missing impact remains null");

const zero = build([commercial("ZERO")], [priorityRow("ZERO", 1, {
  priorityBasis: { hasProjectedShortfall: false, projectedShortfallAmount: 0, behindPace: true, paceGapMagnitude: 0, budget: 500 },
  sourceMeasures: { projectedBudgetGap: 0, paceGap: 0, projectedMonthEndActual: 0, projectedAchievementPct: 0, requiredDailyRunRate: 0 },
})]).rows[0];
equal(zero.impactAmount, 0, "zero impact is preserved instead of becoming missing");
equal(zero.priorityEvidence.projectedBudgetGap, 0);
equal(zero.projectedMonthEndActual, 0);

const invalid = Worklist.buildWorklist({ periodKey: "bad", commercialPerformanceResult: { status: "READY", rows: [commercial("B1")] } });
equal(invalid.status, "INVALID_INPUT");
equal(invalid.rows, [], "fail-closed results expose no actionability rows");

console.log(`v8.6.7 Branch Execution actionability tests passed: ${assertions} assertions.`);
