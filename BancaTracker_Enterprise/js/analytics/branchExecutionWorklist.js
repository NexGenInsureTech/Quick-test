/*==============================================================
BancaTracker Enterprise
Version : 8.6.6
File    : branchExecutionWorklist.js
Module  : Analytics
Purpose : Project a governed branch execution worklist
==============================================================*/

(function (global) {
  "use strict";

  const PERIOD_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
  const GOVERNED_BRANCH_AUTHORITIES = Object.freeze(["GOVERNED_EXACT", "GOVERNED_FALLBACK"]);
  const INTERVENTION_LABELS = Object.freeze([
    "Diagnose", "Build", "Convert", "Grow", "Deepen",
    "Deepen / Maintain", "Maintain / Learn",
  ]);
  const STRATEGY_FIELDS = Object.freeze([
    "maturityBand", "active", "nearActive", "activationGap",
    "nextMaturityThreshold", "maturityGap", "strategyObjective", "executionCue",
  ]);

  const stableCompare = (left, right) => String(left).localeCompare(String(right));
  const validPeriod = (value) => PERIOD_PATTERN.test(value || "");
  const validText = (value) => typeof value === "string" && value.trim() !== "";
  const finite = (value) => typeof value === "number" && Number.isFinite(value);
  const diagnostic = (code, key = null, detail = null) => Object.freeze({ code, key, detail: Array.isArray(detail) ? Object.freeze([...detail]) : detail });
  const freezeArray = (items) => Object.freeze(items.map((item) => Object.freeze(item)));
  const rowBankKey = (row) => row && validText(row.bankId) ? row.bankId : null;

  function freezeRow(row) {
    const copy = { ...row };
    if (Array.isArray(copy.priorityReasons)) copy.priorityReasons = Object.freeze([...copy.priorityReasons]);
    return Object.freeze(copy);
  }

  function freezeResult(result) {
    return Object.freeze({
      ...result,
      scope: Object.freeze({ ...result.scope }),
      rows: Object.freeze(result.rows.map(freezeRow)),
      reconciliation: Object.freeze({ ...result.reconciliation }),
      diagnostics: freezeArray(result.diagnostics),
    });
  }

  function buildProductivityProvenance(context) {
    const diagnostics = [];
    const periodKey = context && context.currentPeriodKey;
    const facts = context && Array.isArray(context.currentPeriodData) ? context.currentPeriodData : [];
    if (!validPeriod(periodKey)) diagnostics.push(diagnostic("PROVENANCE_PERIOD_INVALID", null, periodKey || null));
    if (!facts.length) diagnostics.push(diagnostic("PROVENANCE_FACTS_EMPTY"));

    const factPeriods = new Set(facts.map((fact) => fact && fact.monthKey));
    if (validPeriod(periodKey) && (factPeriods.size !== 1 || !factPeriods.has(periodKey))) {
      diagnostics.push(diagnostic("PROVENANCE_PERIOD_MIXED", null, [...factPeriods].sort()));
    }

    const bankKeys = new Set();
    const identities = new Map();
    facts.forEach((fact, index) => {
      const authority = fact && fact.branchAuthority;
      const branchId = fact && fact.branchId;
      const bankKey = fact && (fact.bankId || fact.canonicalBank);
      if (validText(bankKey)) bankKeys.add(bankKey);
      else diagnostics.push(diagnostic("PROVENANCE_BANK_IDENTITY_MISSING", null, index));

      if (!GOVERNED_BRANCH_AUTHORITIES.includes(authority) || !validText(branchId)) {
        diagnostics.push(diagnostic("PROVENANCE_IDENTITY_REJECTED", validText(branchId) ? branchId : null, authority || null));
        return;
      }
      const strategyKey = global.BancaTrackerUtils.branchIdentityKey(fact);
      if (strategyKey !== branchId) {
        diagnostics.push(diagnostic("PROVENANCE_STRATEGY_KEY_MISMATCH", branchId, strategyKey || null));
        return;
      }
      const existing = identities.get(strategyKey);
      if (existing && existing.branchId !== branchId) {
        diagnostics.push(diagnostic("PROVENANCE_IDENTITY_AMBIGUOUS", strategyKey));
        return;
      }
      identities.set(strategyKey, { strategyKey, branchId, identityBasis: "GOVERNED_BRANCH_AUTHORITY" });
    });

    if (bankKeys.size > 1) diagnostics.push(diagnostic("PROVENANCE_BANK_SCOPE_MIXED", null, [...bankKeys].sort()));
    const fatalCodes = new Set([
      "PROVENANCE_PERIOD_INVALID", "PROVENANCE_FACTS_EMPTY", "PROVENANCE_PERIOD_MIXED",
      "PROVENANCE_BANK_IDENTITY_MISSING", "PROVENANCE_BANK_SCOPE_MIXED",
      "PROVENANCE_IDENTITY_AMBIGUOUS", "PROVENANCE_STRATEGY_KEY_MISMATCH",
    ]);
    const status = diagnostics.some((item) => fatalCodes.has(item.code)) ? "INVALID" : diagnostics.length ? "PARTIAL" : "READY";
    return Object.freeze({
      status,
      periodKey: validPeriod(periodKey) ? periodKey : null,
      bankKey: bankKeys.size === 1 ? [...bankKeys][0] : null,
      identities: freezeArray([...identities.values()].sort((left, right) => stableCompare(left.strategyKey, right.strategyKey))),
      diagnostics: freezeArray(diagnostics),
    });
  }

  function emptyStrategy() {
    return Object.fromEntries(STRATEGY_FIELDS.map((field) => [field, null]));
  }

  function invalidResult(periodKey, bankKey, diagnostics, reconciliation = {}) {
    return freezeResult({
      scope: { periodKey: validPeriod(periodKey) ? periodKey : null, bankKey: bankKey || null },
      rows: [],
      reconciliation: {
        scopedPopulationCount: 0, identifiedActionableCount: 0, identifiedRankedCount: 0,
        identifiedUnrankedCount: 0, excludedCount: 0, populationMatches: false,
        scopedActual: null, admittedActual: null, excludedActual: null, actualMatches: false,
        budgetPresentCount: 0, budgetMissingCount: 0,
        potentialPresentCount: 0, potentialMissingCount: 0,
        ...reconciliation,
      },
      diagnostics,
      status: "INVALID_INPUT",
    });
  }

  function strategyIndex(productivityResult, provenance, periodKey, bankKey, diagnostics) {
    const index = new Map();
    if (!productivityResult) return { index, requested: false, applicable: true, complete: true };
    if (!provenance || provenance.status === "INVALID") {
      diagnostics.push(diagnostic("STRATEGY_PROVENANCE_UNAVAILABLE"));
      return { index, requested: true, applicable: false, complete: false };
    }
    if (provenance.status !== "READY" && provenance.status !== "PARTIAL") {
      diagnostics.push(diagnostic("STRATEGY_PROVENANCE_STATUS_INVALID", null, provenance.status || null));
      return { index, requested: true, applicable: false, complete: false };
    }
    if (provenance.periodKey !== periodKey) {
      diagnostics.push(diagnostic("STRATEGY_PERIOD_MISMATCH", null, provenance.periodKey || null));
      return { index, requested: true, applicable: false, complete: false };
    }
    if ((provenance.bankKey || null) !== (bankKey || null)) {
      diagnostics.push(diagnostic("STRATEGY_BANK_SCOPE_MISMATCH", null, provenance.bankKey || null));
      return { index, requested: true, applicable: false, complete: false };
    }
    const identityByKey = new Map();
    let incompatible = false;
    (provenance.identities || []).forEach((item) => {
      if (!item || !validText(item.strategyKey) || item.strategyKey !== item.branchId || identityByKey.has(item.strategyKey)) {
        diagnostics.push(diagnostic("STRATEGY_IDENTITY_UNPROVEN", item && item.strategyKey || null));
        incompatible = true;
      } else identityByKey.set(item.strategyKey, item.branchId);
    });
    const seen = new Set();
    (productivityResult.branchStrategies || []).forEach((row) => {
      if (!row || !validText(row.key) || !identityByKey.has(row.key)) return;
      if (seen.has(row.key)) {
        diagnostics.push(diagnostic("STRATEGY_IDENTITY_DUPLICATE", row.key));
        incompatible = true;
        return;
      }
      if (!INTERVENTION_LABELS.includes(row.strategyObjective)) {
        diagnostics.push(diagnostic("STRATEGY_LABEL_INVALID", row.key, row.strategyObjective || null));
        incompatible = true;
        return;
      }
      seen.add(row.key);
      index.set(identityByKey.get(row.key), row);
    });
    if (provenance.status === "PARTIAL") {
      diagnostics.push(diagnostic("STRATEGY_PROVENANCE_PARTIAL"));
      (provenance.diagnostics || []).forEach((item) => diagnostics.push(diagnostic("STRATEGY_PROVENANCE_EXCLUSION", item.key || null, item.code || null)));
    }
    return { index: incompatible ? new Map() : index, requested: true, applicable: !incompatible, complete: !incompatible && provenance.status === "READY" };
  }

  function priorityIndex(priorityResult, periodKey, bankKey, diagnostics) {
    const index = new Map();
    if (!priorityResult) return { index, requested: false, applicable: true, complete: true };
    const statusValid = priorityResult.status === "READY" || priorityResult.status === "PARTIAL";
    const periodMatches = priorityResult.periodKey === periodKey;
    const bankMatches = bankKey === null
      ? priorityResult.bankKey === null || priorityResult.bankKey === undefined
      : priorityResult.bankKey === bankKey;
    if (!statusValid || priorityResult.dimension !== "BRANCH" || priorityResult.rankingApplicable !== true || !periodMatches || !bankMatches || !Array.isArray(priorityResult.executionPriority)) {
      diagnostics.push(diagnostic("PRIORITY_INCOMPATIBLE"));
      return { index, requested: true, applicable: false, complete: false };
    }
    const ranks = new Set();
    let compatible = true;
    priorityResult.executionPriority.forEach((row) => {
      if (!row || !validText(row.key) || !Number.isInteger(row.priorityRank) || row.priorityRank < 1 || ranks.has(row.priorityRank) || index.has(row.key)) {
        diagnostics.push(diagnostic("PRIORITY_IDENTITY_OR_RANK_INVALID", row && row.key || null));
        compatible = false;
        return;
      }
      ranks.add(row.priorityRank);
      index.set(row.key, row);
    });
    if (priorityResult.status === "PARTIAL") diagnostics.push(diagnostic("PRIORITY_AUTHORITY_PARTIAL"));
    return { index: compatible ? index : new Map(), requested: true, applicable: compatible, complete: compatible && priorityResult.status === "READY" };
  }

  function buildWorklist(input = {}) {
    const periodKey = input.periodKey;
    const bankKey = input.bankKey === undefined || input.bankKey === null ? null : input.bankKey;
    const diagnostics = [];
    if (!validPeriod(periodKey)) return invalidResult(periodKey, bankKey, [diagnostic("PERIOD_INVALID", null, periodKey || null)]);
    if (bankKey !== null && !validText(bankKey)) return invalidResult(periodKey, bankKey, [diagnostic("BANK_SCOPE_INVALID")]);
    const performance = input.commercialPerformanceResult;
    if (!performance || !Array.isArray(performance.rows)) return invalidResult(periodKey, bankKey, [diagnostic("COMMERCIAL_INPUT_INVALID")]);
    if (!["READY", "PARTIAL", "NO_FACT_DATA", "NO_COMMERCIAL_MASTER"].includes(performance.status)) {
      return invalidResult(periodKey, bankKey, [diagnostic("COMMERCIAL_STATUS_INVALID", null, performance.status || null)]);
    }

    const scoped = [];
    let bankScopeUnverifiable = false;
    performance.rows.forEach((row) => {
      if (!row || row.periodKey !== periodKey) {
        diagnostics.push(diagnostic("COMMERCIAL_ROW_PERIOD_EXCLUDED", row && row.branchId || null, row && row.periodKey || null));
        return;
      }
      if (bankKey !== null) {
        const canonicalBankKey = rowBankKey(row);
        if (canonicalBankKey === null) {
          bankScopeUnverifiable = true;
          diagnostics.push(diagnostic("COMMERCIAL_BANK_IDENTITY_MISSING", row && row.branchId || null));
          return;
        }
        if (canonicalBankKey !== bankKey) {
          diagnostics.push(diagnostic("COMMERCIAL_ROW_BANK_EXCLUDED", row && row.branchId || null, canonicalBankKey));
          return;
        }
      }
      scoped.push(row);
    });
    if (bankScopeUnverifiable) return invalidResult(periodKey, bankKey, diagnostics);
    if (!scoped.length) return freezeResult({
      scope: { periodKey, bankKey }, rows: [],
      reconciliation: {
        scopedPopulationCount: 0, identifiedActionableCount: 0, identifiedRankedCount: 0,
        identifiedUnrankedCount: 0, excludedCount: 0, populationMatches: true,
        scopedActual: 0, admittedActual: 0, excludedActual: 0, actualMatches: true,
        budgetPresentCount: 0, budgetMissingCount: 0, potentialPresentCount: 0, potentialMissingCount: 0,
      }, diagnostics, status: "NO_ROWS",
    });

    const seen = new Set();
    const admitted = [];
    const excluded = [];
    let duplicate = false;
    let actualUnverifiable = false;
    scoped.forEach((row) => {
      if (!finite(row.actualPremium)) {
        actualUnverifiable = true;
        diagnostics.push(diagnostic("COMMERCIAL_ACTUAL_UNVERIFIABLE", row && row.branchId || null));
      }
      if (!validText(row.branchId)) {
        excluded.push(row);
        diagnostics.push(diagnostic("COMMERCIAL_BRANCH_ID_MISSING"));
        return;
      }
      const identity = `${row.branchId}\u0000${row.periodKey}`;
      if (seen.has(identity)) {
        duplicate = true;
        diagnostics.push(diagnostic("COMMERCIAL_BRANCH_ID_DUPLICATE", row.branchId));
        return;
      }
      seen.add(identity);
      admitted.push(row);
    });
    if (actualUnverifiable) return invalidResult(periodKey, bankKey, diagnostics, { scopedPopulationCount: scoped.length, excludedCount: excluded.length });
    const scopedActual = scoped.reduce((sum, row) => sum + row.actualPremium, 0);
    const excludedActual = excluded.reduce((sum, row) => sum + row.actualPremium, 0);
    if (duplicate) return invalidResult(periodKey, bankKey, diagnostics, { scopedPopulationCount: scoped.length, excludedCount: excluded.length, scopedActual, excludedActual });

    const strategy = strategyIndex(input.productivityResult, input.productivityProvenance, periodKey, bankKey, diagnostics);
    const priority = priorityIndex(input.executionPriorityResult, periodKey, bankKey, diagnostics);
    if (priority.applicable) priority.index.forEach((value, key) => {
      if (!admitted.some((row) => row.branchId === key)) diagnostics.push(diagnostic("PRIORITY_ROW_UNMATCHED", key));
    });
    const rows = admitted.map((commercial) => {
      const strategyRow = strategy.index.get(commercial.branchId) || null;
      if (strategy.requested && strategy.applicable && !strategyRow) diagnostics.push(diagnostic("STRATEGY_ROW_UNMATCHED", commercial.branchId));
      const priorityRow = priority.index.get(commercial.branchId) || null;
      const strategyValues = strategyRow
        ? Object.fromEntries(STRATEGY_FIELDS.map((field) => [field, strategyRow[field] === undefined ? null : strategyRow[field]]))
        : emptyStrategy();
      return {
        ...commercial,
        ...strategyValues,
        priorityRank: priorityRow ? priorityRow.priorityRank : null,
        priorityReasons: priorityRow && Array.isArray(priorityRow.attentionReasons) ? [...priorityRow.attentionReasons] : [],
        ownershipBasis: "CURRENT_ACTIVE_MASTER",
      };
    }).sort((left, right) => {
      const leftRanked = Number.isInteger(left.priorityRank);
      const rightRanked = Number.isInteger(right.priorityRank);
      if (leftRanked && rightRanked) return left.priorityRank - right.priorityRank;
      if (leftRanked) return -1;
      if (rightRanked) return 1;
      return stableCompare(left.branchId, right.branchId);
    });

    const identifiedRankedCount = rows.filter((row) => Number.isInteger(row.priorityRank)).length;
    const identifiedUnrankedCount = rows.length - identifiedRankedCount;
    const admittedActual = rows.reduce((sum, row) => sum + row.actualPremium, 0);
    const populationMatches = scoped.length === identifiedRankedCount + identifiedUnrankedCount + excluded.length;
    const actualMatches = scopedActual === admittedActual + excludedActual;
    const reconciliation = {
      scopedPopulationCount: scoped.length,
      identifiedActionableCount: rows.length,
      identifiedRankedCount,
      identifiedUnrankedCount,
      excludedCount: excluded.length,
      populationMatches,
      scopedActual,
      admittedActual,
      excludedActual,
      actualMatches,
      budgetPresentCount: scoped.filter((row) => row.budget !== null).length,
      budgetMissingCount: scoped.filter((row) => row.budget === null).length,
      potentialPresentCount: scoped.filter((row) => row.potential !== null).length,
      potentialMissingCount: scoped.filter((row) => row.potential === null).length,
      ownershipPresentCount: scoped.filter((row) => validText(row.assignedRmId)).length,
      ownershipMissingCount: scoped.filter((row) => !validText(row.assignedRmId)).length,
      priorityEligibleCount: input.executionPriorityResult && input.executionPriorityResult.summary && input.executionPriorityResult.summary.executionEligibleCount || 0,
      priorityRankedCount: input.executionPriorityResult && input.executionPriorityResult.summary && input.executionPriorityResult.summary.executionRankedCount || identifiedRankedCount,
      priorityUnmatchedExecutionCount: input.executionPriorityResult && input.executionPriorityResult.summary && input.executionPriorityResult.summary.unmatchedExecutionCount || 0,
      priorityUnmatchedStatusCount: input.executionPriorityResult && input.executionPriorityResult.summary && input.executionPriorityResult.summary.unmatchedStatusCount || 0,
    };
    if (!populationMatches || !actualMatches) {
      diagnostics.push(diagnostic("RECONCILIATION_FAILED"));
      return invalidResult(periodKey, bankKey, diagnostics, reconciliation);
    }

    const coveragePartial = reconciliation.budgetMissingCount > 0 || reconciliation.potentialMissingCount > 0 || reconciliation.ownershipMissingCount > 0 || excluded.length > 0 || performance.status !== "READY";
    const optionalPartial = strategy.requested && !strategy.complete || priority.requested && !priority.complete || diagnostics.some((item) => item.code === "STRATEGY_ROW_UNMATCHED" || item.code === "PRIORITY_ROW_UNMATCHED");
    return freezeResult({
      scope: { periodKey, bankKey }, rows, reconciliation, diagnostics,
      status: coveragePartial || optionalPartial ? "PARTIAL" : "READY",
    });
  }

  global.BancaTrackerBranchExecutionWorklist = Object.freeze({ buildWorklist, buildProductivityProvenance });
})(window);
