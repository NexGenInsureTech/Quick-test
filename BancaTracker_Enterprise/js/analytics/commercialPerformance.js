/*==============================================================
BancaTracker Enterprise
Version : 8.2.0
File    : commercialPerformance.js
Module  : Analytics
Purpose : Aggregate and join branch-period Actual, Budget and Potential safely
==============================================================*/

(function (global) {
  "use strict";

  const separator = "\u0000";
  const keyOf = (branchId, periodKey) => `${branchId}${separator}${periodKey}`;
  const metadataFields = Object.freeze([
    "bankId", "canonicalBank", "branchName", "stateId", "stateName", "zoneId", "zoneName",
    "bankRegionId", "bankRegionName", "bankZoneId", "bankZoneName",
    "fgmOfficeId", "fgmOfficeName", "assignedRmId", "assignedRmName",
    "csmId", "csmName", "asmId", "asmName", "zsmId", "zsmName",
    "nationalHeadId", "nationalHeadName",
  ]);

  function metadataFromFact(fact) {
    return {
      bankId: fact.bankId || null, canonicalBank: fact.bank || null,
      branchName: fact.branch || fact.branchName || null,
      stateId: fact.stateId || null, stateName: fact.state || null,
      zoneId: fact.zoneId || null, zoneName: fact.zone || null,
      bankRegionId: fact.bankRegionId || null, bankRegionName: fact.bankRegionName || null,
      bankZoneId: fact.bankZoneId || null, bankZoneName: fact.bankZoneName || null,
      fgmOfficeId: fact.fgmOfficeId || null, fgmOfficeName: fact.fgmOfficeName || null,
      assignedRmId: fact.assignedRmId || null, assignedRmName: fact.assignedRmName || null,
      csmId: fact.csmId || null, csmName: fact.csmName || null,
      asmId: fact.asmId || null, asmName: fact.asmName || null,
      zsmId: fact.zsmId || null, zsmName: fact.zsmName || null,
      nationalHeadId: fact.nationalHeadId || null, nationalHeadName: fact.nationalHeadName || null,
    };
  }

  function buildActuals(factData) {
    const byKey = new Map();
    const diagnostics = {
      sourceRows: factData.length, includedRows: 0,
      unresolvedBranchRowsExcluded: 0, unresolvedBranchPremiumExcluded: 0,
      invalidDateRowsExcluded: 0, invalidDatePremiumExcluded: 0,
      uniqueExcludedFactCount: 0, uniqueExcludedPremium: 0,
      metadataConflictCount: 0, metadataConflicts: [],
    };
    factData.forEach((fact) => {
      const premium = Number(fact.premium) || 0;
      if (!fact.branchId) {
        diagnostics.unresolvedBranchRowsExcluded += 1;
        diagnostics.unresolvedBranchPremiumExcluded += premium;
      }
      if (!fact.monthKey) {
        diagnostics.invalidDateRowsExcluded += 1;
        diagnostics.invalidDatePremiumExcluded += premium;
      }
      if (!fact.branchId || !fact.monthKey) {
        diagnostics.uniqueExcludedFactCount += 1;
        diagnostics.uniqueExcludedPremium += premium;
        return;
      }
      diagnostics.includedRows += 1;
      const key = keyOf(fact.branchId, fact.monthKey);
      if (!byKey.has(key)) byKey.set(key, {
        key, branchId: fact.branchId, periodKey: fact.monthKey,
        actualPremium: 0, transactionCount: 0, positiveCount: 0,
        zeroCount: 0, negativeCount: 0,
        ...metadataFromFact(fact),
      });
      const row = byKey.get(key);
      const incomingMetadata = metadataFromFact(fact);
      metadataFields.forEach((field) => {
        if (row[field] === null && incomingMetadata[field] !== null) row[field] = incomingMetadata[field];
        else if (row[field] !== null && incomingMetadata[field] !== null && row[field] !== incomingMetadata[field]) {
          const conflictKey = `${key}${separator}${field}`;
          if (!diagnostics.metadataConflicts.includes(conflictKey)) {
            diagnostics.metadataConflicts.push(conflictKey);
            diagnostics.metadataConflictCount += 1;
          }
        }
      });
      row.actualPremium += premium;
      row.transactionCount += 1;
      if (premium > 0) row.positiveCount += 1;
      else if (premium < 0) row.negativeCount += 1;
      else row.zeroCount += 1;
    });
    return { byKey, rows: [...byKey.values()], diagnostics };
  }

  function buildCommercialRows(commercialContext) {
    const records = commercialContext && Array.isArray(commercialContext.records)
      ? commercialContext.records
      : [];
    const byKey = new Map();
    const duplicateKeys = [];
    records.forEach((record) => {
      if (!record.branchId || !record.periodKey) return;
      const key = keyOf(record.branchId, record.periodKey);
      if (byKey.has(key)) {
        duplicateKeys.push(key);
        return;
      }
      byKey.set(key, { ...record, key });
    });
    return { byKey, rows: [...byKey.values()], duplicateKeys };
  }

  function calculateMeasures(actualPremium, budget, potential) {
    return {
      achievementPct: budget !== null && budget > 0 ? (actualPremium / budget) * 100 : null,
      budgetGap: budget === null ? null : actualPremium - budget,
      budgetRemaining: budget === null ? null : budget - actualPremium,
      potentialPenetrationPct: potential !== null && potential > 0 ? (actualPremium / potential) * 100 : null,
      potentialGap: potential === null ? null : potential - actualPremium,
    };
  }

  function referenceStatus(budget, potential) {
    if (budget !== null && potential !== null) return "COMPLETE";
    if (budget !== null) return "BUDGET_ONLY";
    if (potential !== null) return "POTENTIAL_ONLY";
    return "REFERENCE_MISSING";
  }

  function joinPerformance(actuals, commercialRows) {
    const keys = new Set([...actuals.byKey.keys(), ...commercialRows.byKey.keys()]);
    return [...keys].map((key) => {
      const actual = actuals.byKey.get(key) || null;
      const commercial = commercialRows.byKey.get(key) || null;
      const actualPremium = actual ? actual.actualPremium : 0;
      const budget = commercial ? commercial.budget : null;
      const potential = commercial ? commercial.potential : null;
      const status = !commercial
        ? "ACTUAL_ONLY"
        : !actual
          ? "NO_ACTIVITY"
          : referenceStatus(budget, potential);
      return {
        key,
        branchId: actual ? actual.branchId : commercial.branchId,
        periodKey: actual ? actual.periodKey : commercial.periodKey,
        ...Object.fromEntries(metadataFields.map((field) => [field,
          actual && actual[field] !== null && actual[field] !== undefined
            ? actual[field]
            : commercial && commercial[field] !== undefined ? commercial[field] : null,
        ])),
        actualPremium, budget, potential,
        ...calculateMeasures(actualPremium, budget, potential),
        commercialStatus: status,
        referenceStatus: referenceStatus(budget, potential),
        transactionCount: actual ? actual.transactionCount : 0,
        positiveCount: actual ? actual.positiveCount : 0,
        zeroCount: actual ? actual.zeroCount : 0,
        negativeCount: actual ? actual.negativeCount : 0,
      };
    }).sort((left, right) => left.periodKey.localeCompare(right.periodKey) || left.branchId.localeCompare(right.branchId));
  }

  function aggregateRows(rows) {
    const budgetPresentCount = rows.filter((row) => row.budget !== null).length;
    const potentialPresentCount = rows.filter((row) => row.potential !== null).length;
    const budget = budgetPresentCount ? rows.reduce((sum, row) => sum + (row.budget === null ? 0 : row.budget), 0) : null;
    const potential = potentialPresentCount ? rows.reduce((sum, row) => sum + (row.potential === null ? 0 : row.potential), 0) : null;
    const actualPremium = rows.reduce((sum, row) => sum + row.actualPremium, 0);
    const budgetMissingCount = rows.length - budgetPresentCount;
    const potentialMissingCount = rows.length - potentialPresentCount;
    const coverageStatus = !budgetPresentCount && !potentialPresentCount
      ? "NONE"
      : !budgetMissingCount && !potentialMissingCount
        ? "COMPLETE"
        : "PARTIAL";
    return {
      branchPeriods: rows.length, actualPremium, budget, potential,
      budgetPresentCount, budgetMissingCount,
      potentialPresentCount, potentialMissingCount,
      coverageStatus,
      ...calculateMeasures(actualPremium, budget, potential),
    };
  }

  function aggregatePerformance(rows, dimensionFn = () => "ALL") {
    const grouped = new Map();
    rows.forEach((row) => {
      const key = dimensionFn(row);
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(row);
    });
    return [...grouped].map(([key, items]) => ({ key, ...aggregateRows(items) }));
  }

  function summarize(rows, actuals, commercialRows) {
    return {
      ...aggregateRows(rows),
      actualBranchPeriods: actuals.rows.length,
      commercialBranchPeriods: commercialRows.rows.length,
      joinedBranchPeriods: rows.length,
      actualOnlyBranchPeriods: rows.filter((row) => row.commercialStatus === "ACTUAL_ONLY").length,
      commercialOnlyBranchPeriods: rows.filter((row) => row.commercialStatus === "NO_ACTIVITY").length,
      duplicateCommercialKeys: commercialRows.duplicateKeys.length,
      ...actuals.diagnostics,
    };
  }

  function buildPerformance(factData, commercialContext) {
    const facts = Array.isArray(factData) ? factData : [];
    const actuals = buildActuals(facts);
    const commercialRows = buildCommercialRows(commercialContext);
    const rows = joinPerformance(actuals, commercialRows);
    const summary = summarize(rows, actuals, commercialRows);
    const masterAbsent = !commercialContext || commercialContext.status === "ABSENT";
    const status = !facts.length
      ? "NO_FACT_DATA"
      : masterAbsent
        ? "NO_COMMERCIAL_MASTER"
        : commercialContext.status === "PARTIAL" || summary.actualOnlyBranchPeriods || summary.duplicateCommercialKeys || summary.unresolvedBranchRowsExcluded || summary.invalidDateRowsExcluded || summary.metadataConflictCount
          ? "PARTIAL"
          : "READY";
    return Object.freeze({ status, rows, summary, diagnostics: actuals.diagnostics, duplicateCommercialKeys: commercialRows.duplicateKeys });
  }

  global.BancaTrackerCommercialPerformance = Object.freeze({
    buildActuals, buildCommercialRows, calculateMeasures, joinPerformance,
    aggregatePerformance, summarize, buildPerformance,
  });
})(window);
