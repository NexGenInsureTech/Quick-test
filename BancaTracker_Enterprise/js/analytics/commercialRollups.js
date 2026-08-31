/*==============================================================
BancaTracker Enterprise
Version : 8.2.0
File    : commercialRollups.js
Module  : Analytics
Purpose : Govern commercial period scopes and dimension roll-ups
==============================================================*/

(function (global) {
  "use strict";

  const UNMAPPED_KEY = "__UNMAPPED__";
  const UNASSIGNED_KEY = "__UNASSIGNED__";
  const PERIOD_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
  const DIMENSIONS = Object.freeze([
    "OVERALL", "BANK", "BRANCH", "STATE", "ZONE", "BANK_REGION", "BANK_ZONE",
    "FGM_OFFICE", "ASSIGNED_RM", "CSM", "ASM", "ZSM", "NATIONAL_HEAD",
  ]);

  function periodSequence(startPeriod, endPeriod) {
    if (!PERIOD_PATTERN.test(startPeriod || "") || !PERIOD_PATTERN.test(endPeriod || "") || startPeriod > endPeriod) return [];
    const result = [];
    let [year, month] = startPeriod.split("-").map(Number);
    const [endYear, endMonth] = endPeriod.split("-").map(Number);
    while (year < endYear || year === endYear && month <= endMonth) {
      result.push(`${year}-${String(month).padStart(2, "0")}`);
      month += 1;
      if (month === 13) { month = 1; year += 1; }
    }
    return result;
  }

  function getFinancialYear(periodKey) {
    if (!PERIOD_PATTERN.test(periodKey || "")) return null;
    const [year, month] = periodKey.split("-").map(Number);
    return global.BancaTrackerDateResolver.deriveFinancialYear(year, month);
  }

  function financialYearBounds(financialYear) {
    const match = String(financialYear || "").match(/^FY(\d{4})-(\d{2})$/);
    if (!match) return null;
    const year = Number(match[1]);
    if (String(year + 1).slice(-2) !== match[2]) return null;
    return { startPeriod: `${year}-04`, endPeriod: `${year + 1}-03` };
  }

  function getAvailablePeriods(rows) {
    return [...new Set((rows || []).map((row) => row.periodKey).filter((value) => PERIOD_PATTERN.test(value)))].sort();
  }

  function getAvailableFinancialYears(rows) {
    return [...new Set(getAvailablePeriods(rows).map(getFinancialYear).filter(Boolean))]
      .sort((left, right) => financialYearBounds(left).startPeriod.localeCompare(financialYearBounds(right).startPeriod));
  }

  function buildPeriodContext(performanceResult) {
    const rows = performanceResult && Array.isArray(performanceResult.rows) ? performanceResult.rows : [];
    const availablePeriods = getAvailablePeriods(rows);
    const actualPeriods = getAvailablePeriods(rows.filter((row) => row.transactionCount > 0));
    return {
      status: availablePeriods.length ? "READY" : "NO_PERIODS",
      availablePeriods,
      availableFinancialYears: getAvailableFinancialYears(rows),
      latestAvailablePeriod: availablePeriods[availablePeriods.length - 1] || null,
      latestActualPeriod: actualPeriods[actualPeriods.length - 1] || null,
      defaultSelectedPeriod: availablePeriods[availablePeriods.length - 1] || null,
    };
  }

  function getPeriodRange(scope) {
    const type = scope && scope.type;
    if (type === "MONTH" && PERIOD_PATTERN.test(scope.periodKey || "")) {
      return { type, periodKey: scope.periodKey, financialYear: getFinancialYear(scope.periodKey), startPeriod: scope.periodKey, endPeriod: scope.periodKey, periods: [scope.periodKey] };
    }
    if (type === "YTD" && PERIOD_PATTERN.test(scope.periodKey || "")) {
      const financialYear = getFinancialYear(scope.periodKey);
      const bounds = financialYearBounds(financialYear);
      return { type, periodKey: scope.periodKey, financialYear, startPeriod: bounds.startPeriod, endPeriod: scope.periodKey, periods: periodSequence(bounds.startPeriod, scope.periodKey) };
    }
    if (type === "FY") {
      const bounds = financialYearBounds(scope.financialYear);
      if (bounds) return { type, periodKey: null, financialYear: scope.financialYear, ...bounds, periods: periodSequence(bounds.startPeriod, bounds.endPeriod) };
    }
    return null;
  }

  function resolveScope(rows, scope) {
    const resolved = getPeriodRange(scope);
    if (!resolved) return { scope: null, rows: [] };
    const periods = new Set(resolved.periods);
    return { scope: resolved, rows: (rows || []).filter((row) => periods.has(row.periodKey)) };
  }

  function employeeName(context, employeeId) {
    const employee = context && context.employeeById && context.employeeById.get(employeeId);
    return employee && employee.employeeName || null;
  }

  function buildMetadataIndex(context = {}) {
    const index = new Map();
    const branches = context.branchMaps && context.branchMaps.branchById
      ? [...context.branchMaps.branchById.values()]
      : Array.isArray(context.branchRecords) ? context.branchRecords : [];
    branches.forEach((branch) => {
      const geography = context.geographyMaps && context.geographyMaps.stateById
        ? context.geographyMaps.stateById.get(branch.stateId)
        : null;
      const assignment = context.assignmentMaps && context.assignmentMaps.assignmentByBranchId
        ? context.assignmentMaps.assignmentByBranchId.get(branch.branchId)
        : null;
      const assignedRmId = assignment && assignment.rmId || null;
      const hierarchy = assignedRmId && context.hierarchyMaps && global.BancaTrackerHierarchyResolver
        ? global.BancaTrackerHierarchyResolver.resolveHierarchy(assignedRmId, context.hierarchyMaps)
        : null;
      index.set(branch.branchId, {
        bankId: branch.bankId || null,
        canonicalBank: branch.canonicalBank || global.BancaTrackerBranchMaster.canonicalBankIdentity(branch.bankId),
        branchName: branch.branchName || null,
        stateId: geography && geography.stateId || branch.stateId || null,
        stateName: geography && geography.stateName || null,
        zoneId: geography && geography.zoneId || null,
        zoneName: geography && geography.zoneName || null,
        bankRegionId: branch.bankRegionId || null, bankRegionName: branch.bankRegionName || null,
        bankZoneId: branch.bankZoneId || null, bankZoneName: branch.bankZoneName || null,
        fgmOfficeId: branch.fgmOfficeId || null, fgmOfficeName: branch.fgmOfficeName || null,
        assignedRmId, assignedRmName: employeeName(context, assignedRmId),
        csmId: hierarchy && hierarchy.csmId || null, csmName: employeeName(context, hierarchy && hierarchy.csmId),
        asmId: hierarchy && hierarchy.asmId || null, asmName: employeeName(context, hierarchy && hierarchy.asmId),
        zsmId: hierarchy && hierarchy.zsmId || null, zsmName: employeeName(context, hierarchy && hierarchy.zsmId),
        nationalHeadId: hierarchy && hierarchy.nationalHeadId || null,
        nationalHeadName: employeeName(context, hierarchy && hierarchy.nationalHeadId),
      });
    });
    return index;
  }

  function attachMetadata(rows, metadataIndex) {
    return (rows || []).map((row) => {
      const result = { ...row };
      const governed = metadataIndex && metadataIndex.get(row.branchId);
      Object.entries(governed || {}).forEach(([field, value]) => {
        if (value !== null && value !== undefined) result[field] = value;
      });
      return result;
    });
  }

  const dimensionFields = Object.freeze({
    BANK: ["canonicalBank", "canonicalBank", "Unmapped"],
    BRANCH: ["branchId", "branchName", "Unmapped"],
    STATE: ["stateId", "stateName", "Unmapped"],
    ZONE: ["zoneId", "zoneName", "Unmapped"],
    BANK_REGION: ["bankRegionId", "bankRegionName", "Unmapped"],
    BANK_ZONE: ["bankZoneId", "bankZoneName", "Unmapped"],
    FGM_OFFICE: ["fgmOfficeId", "fgmOfficeName", "Unmapped"],
    ASSIGNED_RM: ["assignedRmId", "assignedRmName", "Unassigned"],
    CSM: ["csmId", "csmName", "Unassigned"],
    ASM: ["asmId", "asmName", "Unassigned"],
    ZSM: ["zsmId", "zsmName", "Unassigned"],
    NATIONAL_HEAD: ["nationalHeadId", "nationalHeadName", "Unassigned"],
  });

  function getDimensionValue(row, dimension) {
    if (dimension === "OVERALL") return { key: "ALL", label: "Overall" };
    const fields = dimensionFields[dimension];
    if (!fields) throw new Error(`Unsupported commercial roll-up dimension: ${dimension}`);
    const [keyField, labelField, missingLabel] = fields;
    const key = row[keyField];
    return key
      ? { key, label: row[labelField] || key }
      : { key: dimension === "ASSIGNED_RM" || ["CSM", "ASM", "ZSM", "NATIONAL_HEAD"].includes(dimension) ? UNASSIGNED_KEY : UNMAPPED_KEY, label: missingLabel };
  }

  function monthCoverage(scopedRows, resolvedScope) {
    const representedMonths = getAvailablePeriods(scopedRows);
    const represented = new Set(representedMonths);
    return {
      expectedMonths: resolvedScope.periods.length,
      monthsRepresented: representedMonths.length,
      representedMonths,
      missingMonths: resolvedScope.periods.filter((period) => !represented.has(period)),
    };
  }

  function buildRollup(performanceResult, scope, dimension = "OVERALL", authorityContext = null) {
    if (!DIMENSIONS.includes(dimension)) throw new Error(`Unsupported commercial roll-up dimension: ${dimension}`);
    const sourceRows = performanceResult && Array.isArray(performanceResult.rows) ? performanceResult.rows : [];
    const enrichedRows = attachMetadata(sourceRows, buildMetadataIndex(authorityContext || {}));
    const scoped = resolveScope(enrichedRows, scope);
    const periodContext = buildPeriodContext({ rows: enrichedRows });
    if (!scoped.scope) return { status: "NO_PERIODS", scope: null, dimension, rows: [], summary: null, diagnostics: { ...periodContext } };
    const labels = new Map();
    const aggregates = global.BancaTrackerCommercialPerformance.aggregatePerformance(scoped.rows, (row) => {
      const value = getDimensionValue(row, dimension);
      if (!labels.has(value.key)) labels.set(value.key, value.label);
      return value.key;
    }).map((row) => ({ ...row, label: labels.get(row.key), monthsRepresented: getAvailablePeriods(scoped.rows.filter((source) => getDimensionValue(source, dimension).key === row.key)).length }))
      .sort((left, right) => left.label.localeCompare(right.label) || String(left.key).localeCompare(String(right.key)));
    const summary = global.BancaTrackerCommercialPerformance.aggregatePerformance(scoped.rows)[0] || global.BancaTrackerCommercialPerformance.aggregatePerformance([])[0] || null;
    const coverage = monthCoverage(scoped.rows, scoped.scope);
    const unmappedRows = aggregates.filter((row) => [UNMAPPED_KEY, UNASSIGNED_KEY].includes(row.key)).reduce((sum, row) => sum + row.branchPeriods, 0);
    const unmappedDimensionCounts = Object.fromEntries(DIMENSIONS.filter((item) => item !== "OVERALL").map((item) => [
      item,
      scoped.rows.filter((row) => [UNMAPPED_KEY, UNASSIGNED_KEY].includes(getDimensionValue(row, item).key)).length,
    ]));
    const status = !periodContext.availablePeriods.length
      ? "NO_PERIODS"
      : performanceResult.status === "NO_COMMERCIAL_MASTER"
        ? "NO_COMMERCIAL_MASTER"
        : performanceResult.status === "NO_FACT_DATA"
          ? "NO_FACT_DATA"
          : performanceResult.status === "PARTIAL" || summary && summary.coverageStatus !== "COMPLETE"
            ? "PARTIAL"
            : "READY";
    return {
      status, scope: scoped.scope, dimension, rows: aggregates,
      summary: summary ? { ...summary, ...coverage } : { ...coverage },
      diagnostics: {
        ...periodContext,
        uniqueExcludedFactCount: performanceResult && performanceResult.summary.uniqueExcludedFactCount || 0,
        uniqueExcludedPremium: performanceResult && performanceResult.summary.uniqueExcludedPremium || 0,
        missingBranchCount: performanceResult && performanceResult.summary.unresolvedBranchRowsExcluded || 0,
        missingPeriodCount: performanceResult && performanceResult.summary.invalidDateRowsExcluded || 0,
        metadataConflictCount: performanceResult && performanceResult.summary.metadataConflictCount || 0,
        unmappedDimensionRows: unmappedRows,
        unmappedDimensionCounts,
      },
    };
  }

  global.BancaTrackerCommercialRollups = Object.freeze({
    DIMENSIONS, UNMAPPED_KEY, UNASSIGNED_KEY, periodSequence, getFinancialYear,
    financialYearBounds, getAvailablePeriods, getAvailableFinancialYears,
    buildPeriodContext, getPeriodRange, resolveScope, buildMetadataIndex,
    attachMetadata, getDimensionValue, buildRollup,
  });
})(window);
