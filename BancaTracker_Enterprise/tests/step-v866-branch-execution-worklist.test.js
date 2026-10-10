/* v8.6.6 MEI-S1-P1: pure Branch Execution Worklist projection. */
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
const check = (condition, message) => { assertions += 1; assert.ok(condition, message); };
const equal = (actual, expected, message) => { assertions += 1; assert.deepStrictEqual(actual, expected, message); };

function commercialRow(branchId, overrides = {}) {
  return {
    key: `${branchId}\u00002026-04`, branchId, periodKey: "2026-04",
    bankId: "BANK-1", canonicalBank: "Bank One", branchName: "Duplicate Name",
    stateId: "S1", stateName: "State", zoneId: "Z1", zoneName: "Zone",
    assignedRmId: "RM1", assignedRmName: "Owner", asmId: "A1", asmName: "Area",
    zsmId: "Z1", zsmName: "Zonal", actualPremium: 100, budget: 200, potential: 400,
    achievementPct: 50, budgetGap: -100, budgetRemaining: 100,
    potentialPenetrationPct: 25, potentialGap: 300,
    commercialStatus: "COMPLETE", referenceStatus: "COMPLETE",
    transactionCount: 1, positiveCount: 1, zeroCount: 0, negativeCount: 0,
    ...overrides,
  };
}

function strategyRow(key, overrides = {}) {
  return {
    key, branch: "Duplicate Name", premium: 100, maturityBand: "1 - 14.9K",
    active: false, nearActive: false, activationGap: 24900,
    nextMaturityThreshold: 15000, maturityGap: 14900,
    strategyObjective: "Build", executionCue: "Build production toward the next maturity level.",
    ...overrides,
  };
}

function context(facts, overrides = {}) {
  return { currentPeriodKey: "2026-04", currentPeriodData: facts, ...overrides };
}

function governedFact(branchId, overrides = {}) {
  return { branchId, branchAuthority: "GOVERNED_EXACT", monthKey: "2026-04", bankId: "BANK-1", bank: "Bank One", branch: "Duplicate Name", ...overrides };
}

function performance(rows, status = "READY") { return { status, rows, summary: {} }; }

function priority(rows, overrides = {}) {
  return {
    status: "READY", periodKey: "2026-04", dimension: "BRANCH",
    rankingApplicable: true, executionPriority: rows,
    summary: { executionEligibleCount: rows.length, executionRankedCount: rows.length, unmatchedExecutionCount: 0, unmatchedStatusCount: 0 },
    diagnostics: [], ...overrides,
  };
}

const facts = [governedFact("B2"), governedFact("B1")];
const provenance = Worklist.buildProductivityProvenance(context(facts));
equal(provenance.status, "READY", "governed provenance is ready");
equal(provenance.periodKey, "2026-04");
equal(provenance.bankKey, "BANK-1");
equal(provenance.identities.map((item) => item.branchId), ["B1", "B2"]);

const legacy = Worklist.buildProductivityProvenance(context([governedFact(null, { branchAuthority: "LEGACY_FALLBACK" })]));
equal(legacy.status, "PARTIAL", "legacy fallback is rejected, not admitted");
equal(legacy.identities, []);
check(legacy.diagnostics.some((item) => item.code === "PROVENANCE_IDENTITY_REJECTED"));

const unresolved = Worklist.buildProductivityProvenance(context([governedFact(null, { branchAuthority: "UNMAPPED" })]));
equal(unresolved.identities.length, 0, "unresolved identity is excluded");
const mixedFy = Worklist.buildProductivityProvenance(context([governedFact("B1"), governedFact("B2", { monthKey: "2025-04" })]));
equal(mixedFy.status, "INVALID", "display-month collision fails canonical period proof");
const nullPeriod = Worklist.buildProductivityProvenance(context([governedFact("B1")], { currentPeriodKey: null }));
equal(nullPeriod.status, "INVALID");

const commercial = [
  commercialRow("B1", { actualPremium: -25, budget: null, potential: null, achievementPct: null, budgetGap: null, budgetRemaining: null, potentialPenetrationPct: null, potentialGap: null, referenceStatus: "REFERENCE_MISSING", assignedRmId: null, assignedRmName: null }),
  commercialRow("B2", { actualPremium: 0, transactionCount: 0, positiveCount: 0, zeroCount: 0, commercialStatus: "NO_ACTIVITY" }),
];
const productivity = { scopeMonth: "Apr-26", branchStrategies: [strategyRow("B1", { active: true, nearActive: true, activationGap: 7 }), strategyRow("B2", { strategyObjective: "Grow" })] };
const input = { periodKey: "2026-04", bankKey: "BANK-1", commercialPerformanceResult: performance(commercial, "PARTIAL"), productivityResult: productivity, productivityProvenance: provenance };
const snapshot = JSON.stringify(input);
const result = Worklist.buildWorklist(input);
equal(result.status, "PARTIAL", "partial reference coverage propagates");
equal(result.rows.map((row) => row.branchId), ["B1", "B2"], "unranked rows use stable branch identity ordering");
equal(result.rows[0].priorityRank, null);
equal(result.rows[0].actualPremium, -25, "signed Actual is preserved");
equal(result.rows[0].budget, null);
equal(result.rows[0].potential, null);
equal(result.rows[0].active, true, "strategy value is copied unchanged");
equal(result.rows[0].nearActive, true);
equal(result.rows[0].activationGap, 7);
equal(result.rows[0].strategyObjective, "Build");
equal(result.rows[0].ownershipBasis, "CURRENT_ACTIVE_MASTER");
equal(result.rows[0].assignedRmId, null, "missing owner remains missing");
equal(result.rows[0].branchName, result.rows[1].branchName, "duplicate names do not merge identities");
equal(result.reconciliation.scopedPopulationCount, 2);
equal(result.reconciliation.identifiedRankedCount, 0);
equal(result.reconciliation.identifiedUnrankedCount, 2);
equal(result.reconciliation.excludedCount, 0);
equal(result.reconciliation.populationMatches, true);
equal(result.reconciliation.scopedActual, -25);
equal(result.reconciliation.admittedActual, -25);
equal(result.reconciliation.actualMatches, true);
equal(result.reconciliation.budgetMissingCount, 1);
equal(result.reconciliation.potentialMissingCount, 1);
equal(JSON.stringify(input), snapshot, "inputs remain immutable");
check(Object.isFrozen(result) && Object.isFrozen(result.rows) && Object.isFrozen(result.rows[0]), "result contract is frozen");
equal(Worklist.buildWorklist(input).rows, result.rows, "output is deterministic");

const commercialOnly = Worklist.buildWorklist({ periodKey: "2026-04", bankKey: "BANK-1", commercialPerformanceResult: performance(commercial), productivityResult: productivity });
equal(commercialOnly.status, "PARTIAL");
check(commercialOnly.diagnostics.some((item) => item.code === "STRATEGY_PROVENANCE_UNAVAILABLE"));
equal(commercialOnly.rows.every((row) => row.strategyObjective === null), true);

const wrongPeriod = Worklist.buildWorklist({ ...input, productivityProvenance: { ...provenance, periodKey: "2025-04" } });
check(wrongPeriod.diagnostics.some((item) => item.code === "STRATEGY_PERIOD_MISMATCH"));
equal(wrongPeriod.rows.every((row) => row.strategyObjective === null), true);
const wrongBank = Worklist.buildWorklist({ ...input, productivityProvenance: { ...provenance, bankKey: "BANK-2" } });
check(wrongBank.diagnostics.some((item) => item.code === "STRATEGY_BANK_SCOPE_MISMATCH"));
const wrongPriority = Worklist.buildWorklist({ ...input, executionPriorityResult: priority([], { periodKey: "2025-04" }) });
check(wrongPriority.diagnostics.some((item) => item.code === "PRIORITY_INCOMPATIBLE"));
equal(wrongPriority.rows.every((row) => row.priorityRank === null), true);

const ranked = priority([{ key: "B2", priorityRank: 1, attentionReasons: ["PROJECTED_SHORTFALL"] }]);
const priorityResult = Worklist.buildWorklist({ periodKey: "2026-04", commercialPerformanceResult: performance(commercial, "PARTIAL"), executionPriorityResult: ranked });
equal(priorityResult.rows.map((row) => row.branchId), ["B2", "B1"], "existing rank precedes stable unranked ordering");
equal(priorityResult.rows[0].priorityRank, 1);
equal(priorityResult.rows[0].priorityReasons, ["PROJECTED_SHORTFALL"]);
equal(priorityResult.rows[1].priorityRank, null);
const scopedPriority = Worklist.buildWorklist({ periodKey: "2026-04", bankKey: "BANK-1", commercialPerformanceResult: performance(commercial), executionPriorityResult: ranked });
check(scopedPriority.diagnostics.some((item) => item.code === "PRIORITY_INCOMPATIBLE"), "priority without bank provenance fails closed for bank scope");

const partialPriority = Worklist.buildWorklist({ periodKey: "2026-04", commercialPerformanceResult: performance([commercialRow("B1")]), executionPriorityResult: priority([{ key: "B1", priorityRank: 1, attentionReasons: ["PROJECTED_SHORTFALL"] }], { status: "PARTIAL" }) });
equal(partialPriority.status, "PARTIAL", "proven ranks from a partial priority authority are retained with partial status");
equal(partialPriority.rows[0].priorityRank, 1);
const unknownPriority = Worklist.buildWorklist({ periodKey: "2026-04", commercialPerformanceResult: performance([commercialRow("B1")]), executionPriorityResult: priority([{ key: "B1", priorityRank: 1 }], { status: "UNKNOWN" }) });
equal(unknownPriority.rows[0].priorityRank, null, "unknown priority status suppresses all ranks");
check(unknownPriority.diagnostics.some((item) => item.code === "PRIORITY_INCOMPATIBLE"));
const unmatchedPriority = Worklist.buildWorklist({ periodKey: "2026-04", commercialPerformanceResult: performance([commercialRow("B1")]), executionPriorityResult: priority([{ key: "OTHER", priorityRank: 1, attentionReasons: [] }]) });
equal(unmatchedPriority.status, "PARTIAL", "unmatched requested priority prevents READY");
check(unmatchedPriority.diagnostics.some((item) => item.code === "PRIORITY_ROW_UNMATCHED"));

const partialProvenance = Worklist.buildProductivityProvenance(context([governedFact("B1"), governedFact(null, { branchAuthority: "LEGACY_FALLBACK" })]));
equal(partialProvenance.status, "PARTIAL");
const partialStrategy = Worklist.buildWorklist({ periodKey: "2026-04", bankKey: "BANK-1", commercialPerformanceResult: performance([commercialRow("B1"), commercialRow("B2")]), productivityResult: productivity, productivityProvenance: partialProvenance });
equal(partialStrategy.status, "PARTIAL", "partial provenance admits only individually proven identities");
equal(partialStrategy.rows.find((row) => row.branchId === "B1").strategyObjective, "Build");
equal(partialStrategy.rows.find((row) => row.branchId === "B2").strategyObjective, null);
check(partialStrategy.diagnostics.some((item) => item.code === "STRATEGY_PROVENANCE_EXCLUSION"));
const unknownProvenance = Worklist.buildWorklist({ ...input, productivityProvenance: { ...provenance, status: "UNKNOWN" } });
equal(unknownProvenance.rows.every((row) => row.strategyObjective === null), true, "unknown provenance status suppresses strategy");
check(unknownProvenance.diagnostics.some((item) => item.code === "STRATEGY_PROVENANCE_STATUS_INVALID"));
const malformedProvenance = Worklist.buildWorklist({ ...input, productivityProvenance: { ...provenance, identities: [{ strategyKey: "B1", branchId: "OTHER" }] } });
equal(malformedProvenance.rows.every((row) => row.strategyObjective === null), true, "malformed provenance suppresses all strategy enrichment");

const periodIsolation = Worklist.buildWorklist({ periodKey: "2026-04", commercialPerformanceResult: performance([commercialRow("B1"), commercialRow("OLD", { periodKey: "2025-04" })]) });
equal(periodIsolation.rows.map((row) => row.branchId), ["B1"]);
check(periodIsolation.diagnostics.some((item) => item.code === "COMMERCIAL_ROW_PERIOD_EXCLUDED"));
const missingIdentity = Worklist.buildWorklist({ periodKey: "2026-04", commercialPerformanceResult: performance([commercialRow(null, { actualPremium: -5 })]) });
equal(missingIdentity.rows.length, 0);
equal(missingIdentity.reconciliation.excludedCount, 1);
equal(missingIdentity.reconciliation.excludedActual, -5);
equal(missingIdentity.reconciliation.actualMatches, true);

const missingCanonicalBank = Worklist.buildWorklist({ periodKey: "2026-04", bankKey: "BANK-1", commercialPerformanceResult: performance([commercialRow("B1", { bankId: null, canonicalBank: "BANK-1" })]) });
equal(missingCanonicalBank.status, "INVALID_INPUT", "display bank text cannot substitute for canonical bank identity");
check(missingCanonicalBank.diagnostics.some((item) => item.code === "COMMERCIAL_BANK_IDENTITY_MISSING"));
const differentBank = Worklist.buildWorklist({ periodKey: "2026-04", bankKey: "BANK-1", commercialPerformanceResult: performance([commercialRow("B2", { bankId: "BANK-2" })]) });
equal(differentBank.status, "NO_ROWS", "an explicit different bank is a valid exclusion");
check(differentBank.diagnostics.some((item) => item.code === "COMMERCIAL_ROW_BANK_EXCLUDED"));

for (const badActual of [null, undefined, NaN, Infinity, "100"]) {
  const unverifiable = Worklist.buildWorklist({ periodKey: "2026-04", commercialPerformanceResult: performance([commercialRow("B1", { actualPremium: badActual })]) });
  equal(unverifiable.status, "INVALID_INPUT", "missing or nonfinite Actual fails closed");
  check(unverifiable.diagnostics.some((item) => item.code === "COMMERCIAL_ACTUAL_UNVERIFIABLE"));
}
const signedZero = Worklist.buildWorklist({ periodKey: "2026-04", commercialPerformanceResult: performance([commercialRow("B1", { actualPremium: 0 })]) });
equal(signedZero.reconciliation.scopedActual, 0, "numeric zero Actual remains verifiable");

const frozenReasons = priorityResult.rows[0].priorityReasons;
check(Object.isFrozen(frozenReasons), "nested priority reasons are frozen");
assertions += 1;
assert.throws(() => frozenReasons.push("MUTATION"), TypeError);
equal(ranked.executionPriority[0].attentionReasons, ["PROJECTED_SHORTFALL"], "freezing output does not freeze or mutate input reasons");

const ready = Worklist.buildWorklist({ periodKey: "2026-04", commercialPerformanceResult: performance([commercialRow("B1")]) });
equal(ready.status, "READY", "complete commercial-only worklist is READY");
equal(ready.reconciliation.ownershipMissingCount, 0);
const ownerMissing = Worklist.buildWorklist({ periodKey: "2026-04", commercialPerformanceResult: performance([commercialRow("B1", { assignedRmId: null, assignedRmName: null })]) });
equal(ownerMissing.status, "PARTIAL", "explicit missing governed ownership coverage is partial");
equal(ownerMissing.reconciliation.ownershipMissingCount, 1);

const duplicate = Worklist.buildWorklist({ periodKey: "2026-04", commercialPerformanceResult: performance([commercialRow("B1"), commercialRow("B1")]) });
equal(duplicate.status, "INVALID_INPUT", "duplicate canonical identity fails closed");
const noRows = Worklist.buildWorklist({ periodKey: "2026-04", commercialPerformanceResult: performance([commercialRow("B1", { periodKey: "2025-04" })]) });
equal(noRows.status, "NO_ROWS");
equal(Worklist.buildWorklist({ periodKey: "Apr-26", commercialPerformanceResult: performance([]) }).status, "INVALID_INPUT");
equal(Worklist.buildWorklist({ periodKey: "2026-04", commercialPerformanceResult: performance([], "UNKNOWN") }).status, "INVALID_INPUT");

console.log(`v8.6.6 Branch Execution Worklist tests passed: ${assertions} assertions.`);
