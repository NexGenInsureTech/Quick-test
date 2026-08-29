/*==============================================================
BancaTracker Enterprise
Version : 8.2.0-dev
File    : commercialComparison.js
Module  : Analytics
Purpose : Compare two governed commercial MONTH roll-ups by durable key
==============================================================*/

(function (global) {
  "use strict";

  const PERIOD_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
  const comparableFields = Object.freeze([
    "actualPremium", "budget", "potential", "achievementPct", "budgetGap",
    "budgetRemaining", "potentialPenetrationPct", "potentialGap",
    "branchPeriods", "budgetPresentCount", "budgetMissingCount",
    "potentialPresentCount", "potentialMissingCount", "coverageStatus",
  ]);

  function validateComparisonPeriods(periodContext, basePeriod, comparisonPeriod) {
    const availablePeriods = periodContext && Array.isArray(periodContext.availablePeriods) ? periodContext.availablePeriods : [];
    if (!availablePeriods.length) return { valid: false, status: "NO_PERIODS", reason: "NO_PERIODS" };
    if (!PERIOD_PATTERN.test(basePeriod || "")) return { valid: false, status: "INVALID_PERIOD", reason: "INVALID_BASE_PERIOD" };
    if (!PERIOD_PATTERN.test(comparisonPeriod || "")) return { valid: false, status: "INVALID_PERIOD", reason: "INVALID_COMPARISON_PERIOD" };
    if (!availablePeriods.includes(basePeriod)) return { valid: false, status: "INVALID_PERIOD", reason: "BASE_PERIOD_UNAVAILABLE" };
    if (!availablePeriods.includes(comparisonPeriod)) return { valid: false, status: "INVALID_PERIOD", reason: "COMPARISON_PERIOD_UNAVAILABLE" };
    return { valid: true, status: "READY", reason: null, samePeriod: basePeriod === comparisonPeriod };
  }

  function resolveDefaultPeriods(periodContext) {
    const availablePeriods = periodContext && Array.isArray(periodContext.availablePeriods) ? periodContext.availablePeriods : [];
    const comparisonPeriod = periodContext && periodContext.latestActualPeriod || periodContext && periodContext.latestAvailablePeriod || null;
    const index = availablePeriods.indexOf(comparisonPeriod);
    return { basePeriod: index > 0 ? availablePeriods[index - 1] : null, comparisonPeriod };
  }

  function compareMeasure(baseValue, comparisonValue) {
    return baseValue === null || baseValue === undefined || comparisonValue === null || comparisonValue === undefined
      ? null
      : comparisonValue - baseValue;
  }

  function compareActual(baseActual, comparisonActual) {
    const actualChange = comparisonActual - baseActual;
    return {
      actualChange,
      actualChangePct: baseActual > 0 ? (actualChange / baseActual) * 100 : null,
      actualDirection: actualChange > 0 ? "UP" : actualChange < 0 ? "DOWN" : "FLAT",
    };
  }

  function compareRatio(baseValue, comparisonValue) { return compareMeasure(baseValue, comparisonValue); }

  function absentSide() {
    return {
      actualPremium: 0, budget: null, potential: null, achievementPct: null,
      budgetGap: null, budgetRemaining: null, potentialPenetrationPct: null,
      potentialGap: null, branchPeriods: 0, budgetPresentCount: 0,
      budgetMissingCount: 0, potentialPresentCount: 0, potentialMissingCount: 0,
      coverageStatus: "NONE",
    };
  }

  function comparisonSide(row) {
    const result = {};
    comparableFields.forEach((field) => { result[field] = row && row[field] !== undefined ? row[field] : absentSide()[field]; });
    return result;
  }

  function joinComparisonRows(baseRows, comparisonRows, dimension, basePeriod, comparisonPeriod) {
    const baseByKey = new Map((baseRows || []).map((row) => [row.key, row]));
    const comparisonByKey = new Map((comparisonRows || []).map((row) => [row.key, row]));
    const keys = new Set([...baseByKey.keys(), ...comparisonByKey.keys()]);
    return [...keys].map((key) => {
      const baseRow = baseByKey.get(key) || null;
      const comparisonRow = comparisonByKey.get(key) || null;
      const base = comparisonSide(baseRow);
      const comparison = comparisonSide(comparisonRow);
      const actual = compareActual(base.actualPremium, comparison.actualPremium);
      const baseLabel = baseRow && baseRow.label || null;
      const comparisonLabel = comparisonRow && comparisonRow.label || null;
      return {
        dimension, key, label: comparisonLabel || baseLabel || key,
        baseLabel, comparisonLabel, labelChanged: Boolean(baseLabel && comparisonLabel && baseLabel !== comparisonLabel),
        basePeriod, comparisonPeriod,
        basePresent: Boolean(baseRow), comparisonPresent: Boolean(comparisonRow),
        presenceStatus: baseRow && comparisonRow ? "BOTH" : baseRow ? "BASE_ONLY" : "COMPARISON_ONLY",
        base, comparison,
        changes: {
          ...actual,
          budgetChange: compareMeasure(base.budget, comparison.budget),
          potentialChange: compareMeasure(base.potential, comparison.potential),
          achievementPointChange: compareRatio(base.achievementPct, comparison.achievementPct),
          penetrationPointChange: compareRatio(base.potentialPenetrationPct, comparison.potentialPenetrationPct),
          budgetGapChange: compareMeasure(base.budgetGap, comparison.budgetGap),
          potentialGapChange: compareMeasure(base.potentialGap, comparison.potentialGap),
        },
        coverageStatus: { base: base.coverageStatus, comparison: comparison.coverageStatus },
      };
    }).sort((left, right) => String(left.label).localeCompare(String(right.label)) || String(left.key).localeCompare(String(right.key)));
  }

  function buildComparison(options = {}) {
    const rollups = global.BancaTrackerCommercialRollups;
    const performanceResult = options.performanceResult || null;
    const periodContext = options.periodContext || rollups.buildPeriodContext(performanceResult);
    const dimension = options.dimension || "OVERALL";
    if (!rollups.DIMENSIONS.includes(dimension)) return { status: "INVALID_DIMENSION", dimension, rows: [], diagnostics: { reason: "INVALID_DIMENSION" } };
    const validation = validateComparisonPeriods(periodContext, options.basePeriod, options.comparisonPeriod);
    if (!validation.valid) return { status: validation.status, dimension, basePeriod: options.basePeriod || null, comparisonPeriod: options.comparisonPeriod || null, rows: [], diagnostics: validation };
    const baseRollup = rollups.buildRollup(performanceResult, { type: "MONTH", periodKey: options.basePeriod }, dimension, options.authorityContext || null);
    const comparisonRollup = rollups.buildRollup(performanceResult, { type: "MONTH", periodKey: options.comparisonPeriod }, dimension, options.authorityContext || null);
    const rows = joinComparisonRows(baseRollup.rows, comparisonRollup.rows, dimension, options.basePeriod, options.comparisonPeriod);
    const partial = [baseRollup.status, comparisonRollup.status].some((status) => status !== "READY") || rows.some((row) => row.base.coverageStatus !== "COMPLETE" || row.comparison.coverageStatus !== "COMPLETE");
    return {
      status: validation.samePeriod ? "SAME_PERIOD" : partial ? "PARTIAL" : "READY",
      samePeriod: validation.samePeriod,
      dimension, basePeriod: options.basePeriod, comparisonPeriod: options.comparisonPeriod,
      rows, baseRollup, comparisonRollup,
      coverage: { base: baseRollup.summary || null, comparison: comparisonRollup.summary || null },
      diagnostics: { validation, baseStatus: baseRollup.status, comparisonStatus: comparisonRollup.status },
    };
  }

  global.BancaTrackerCommercialComparison = Object.freeze({
    validateComparisonPeriods, resolveDefaultPeriods, compareMeasure, compareActual,
    compareRatio, joinComparisonRows, buildComparison,
  });
})(window);
