/*==============================================================
BancaTracker Enterprise
Version : 8.2.0
File    : commercialExecution.js
Module  : Analytics
Purpose : Govern calendar-day Budget pacing and simple observed-average projection
==============================================================*/

(function (global) {
  "use strict";

  function validatePeriod(periodContext, selectedPeriod) {
    return global.BancaTrackerCommercialComparison.validateComparisonPeriods(periodContext, selectedPeriod, selectedPeriod);
  }

  function validFactDay(fact, selectedPeriod) {
    if (!fact || fact.monthKey !== selectedPeriod) return null;
    const day = Number(fact.day);
    const daysInMonth = global.BancaTrackerDailyCommercialComparison.getDaysInPeriod(selectedPeriod);
    return Number.isInteger(day) && day >= 1 && day <= daysInMonth ? day : null;
  }

  function resolveAsOfDay(facts, selectedPeriod, explicitAsOfDay) {
    const daysInMonth = global.BancaTrackerDailyCommercialComparison.getDaysInPeriod(selectedPeriod);
    if (explicitAsOfDay !== undefined && explicitAsOfDay !== null) {
      return Number.isInteger(explicitAsOfDay) && explicitAsOfDay >= 0 && explicitAsOfDay <= daysInMonth
        ? { valid: true, asOfDay: explicitAsOfDay, asOfSource: "EXPLICIT" }
        : { valid: false, asOfDay: null, asOfSource: "EXPLICIT", reason: "INVALID_AS_OF" };
    }
    const observed = (facts || []).map((fact) => validFactDay(fact, selectedPeriod)).filter((day) => day !== null);
    return { valid: true, asOfDay: observed.length ? Math.max(...observed) : 0, asOfSource: observed.length ? "OBSERVED_FACT_MAX_DAY" : "NO_OBSERVATIONS" };
  }

  function calculateExecutionMeasures(actualToDate, fullMonthActual, budget, potential, asOfDay, daysInMonth) {
    const observedDays = asOfDay;
    const remainingDays = daysInMonth - asOfDay;
    const averageDailyActual = observedDays > 0 ? actualToDate / observedDays : null;
    const expectedBudgetToDate = budget === null ? null : budget * observedDays / daysInMonth;
    const paceGap = expectedBudgetToDate === null ? null : actualToDate - expectedBudgetToDate;
    const paceAchievementPct = expectedBudgetToDate !== null && expectedBudgetToDate > 0 ? actualToDate / expectedBudgetToDate * 100 : null;
    const budgetAchievementToDatePct = budget !== null && budget > 0 ? actualToDate / budget * 100 : null;
    const budgetRemaining = budget === null ? null : budget - actualToDate;
    const requiredDailyRunRate = budget !== null && remainingDays > 0 ? (budget - actualToDate) / remainingDays : null;
    const projectedMonthEndActual = averageDailyActual === null ? null : averageDailyActual * daysInMonth;
    const projectedAchievementPct = projectedMonthEndActual !== null && budget !== null && budget > 0 ? projectedMonthEndActual / budget * 100 : null;
    const projectedBudgetGap = projectedMonthEndActual === null || budget === null ? null : projectedMonthEndActual - budget;
    const runRateGap = averageDailyActual === null || requiredDailyRunRate === null ? null : averageDailyActual - requiredDailyRunRate;
    return {
      observedDays, remainingDays, actualToDate, fullMonthActual, budget, potential,
      expectedBudgetToDate, paceGap, paceAchievementPct, budgetAchievementToDatePct,
      budgetRemaining, averageDailyActual, requiredDailyRunRate,
      projectedMonthEndActual, projectedAchievementPct, projectedBudgetGap, runRateGap,
    };
  }

  function buildActualMaps(facts, selectedPeriod, dimension, authorityContext, asOfDay) {
    const daily = global.BancaTrackerDailyCommercialComparison.buildDailyActuals(facts || [], [selectedPeriod], dimension, authorityContext || null);
    const period = daily.byPeriod.get(selectedPeriod) || new Map();
    const actualByKey = new Map();
    period.forEach((days, key) => {
      let actualToDate = 0;
      let fullMonthActual = 0;
      days.forEach((premium, day) => { fullMonthActual += premium; if (day <= asOfDay) actualToDate += premium; });
      actualByKey.set(key, { actualToDate, fullMonthActual, labels: daily.entities.get(key) || {} });
    });
    return { actualByKey, diagnostics: daily.diagnostics };
  }

  function buildExecution(options = {}) {
    const rollups = global.BancaTrackerCommercialRollups;
    const performanceResult = options.performanceResult || null;
    const periodContext = options.periodContext || rollups.buildPeriodContext(performanceResult);
    const selectedPeriod = options.selectedPeriod || null;
    const dimension = options.dimension || "OVERALL";
    if (!rollups.DIMENSIONS.includes(dimension)) return { status: "INVALID_DIMENSION", selectedPeriod, dimension, rows: [], diagnostics: { reason: "INVALID_DIMENSION" } };
    const periodValidation = validatePeriod(periodContext, selectedPeriod);
    if (!periodValidation.valid) return { status: periodValidation.status, selectedPeriod, dimension, rows: [], diagnostics: periodValidation };
    const asOf = resolveAsOfDay(options.facts || [], selectedPeriod, options.asOfDay);
    if (!asOf.valid) return { status: "INVALID_AS_OF", selectedPeriod, dimension, rows: [], diagnostics: asOf };
    const daysInMonth = global.BancaTrackerDailyCommercialComparison.getDaysInPeriod(selectedPeriod);
    const monthly = rollups.buildRollup(performanceResult, { type: "MONTH", periodKey: selectedPeriod }, dimension, options.authorityContext || null);
    const actuals = buildActualMaps(options.facts || [], selectedPeriod, dimension, options.authorityContext, asOf.asOfDay);
    const monthlyByKey = new Map((monthly.rows || []).map((row) => [row.key, row]));
    const keys = new Set([...monthlyByKey.keys(), ...actuals.actualByKey.keys()]);
    if (dimension === "OVERALL" && !keys.size) keys.add("ALL");
    const rows = [...keys].map((key) => {
      const reference = monthlyByKey.get(key) || null;
      const actual = actuals.actualByKey.get(key) || { actualToDate: 0, fullMonthActual: 0, labels: {} };
      const label = reference && reference.label || actual.labels.comparisonLabel || actual.labels.baseLabel || key;
      return {
        key, label,
        commercialPresent: Boolean(reference), actualPresent: actuals.actualByKey.has(key),
        referenceStatus: reference ? reference.coverageStatus : "NONE",
        ...calculateExecutionMeasures(actual.actualToDate, actual.fullMonthActual, reference ? reference.budget : null, reference ? reference.potential : null, asOf.asOfDay, daysInMonth),
      };
    }).sort((left, right) => String(left.label).localeCompare(String(right.label)) || String(left.key).localeCompare(String(right.key)));
    const validObservedFacts = (options.facts || []).some((fact) => validFactDay(fact, selectedPeriod) !== null);
    const budgetMissing = rows.some((row) => row.budget === null);
    const status = !validObservedFacts
      ? "NO_FACT_DATA"
      : monthly.status !== "READY" || budgetMissing || actuals.diagnostics.uniqueExcludedFactCount
        ? "PARTIAL"
        : "READY";
    return {
      status, selectedPeriod, dimension, daysInMonth,
      asOfDay: asOf.asOfDay, asOfSource: asOf.asOfSource,
      observedDays: asOf.asOfDay, remainingDays: daysInMonth - asOf.asOfDay,
      rows,
      coverage: { monthlyStatus: monthly.status, budgetPresentCount: rows.filter((row) => row.budget !== null).length, budgetMissingCount: rows.filter((row) => row.budget === null).length },
      diagnostics: { ...actuals.diagnostics, periodValidation },
    };
  }

  global.BancaTrackerCommercialExecution = Object.freeze({
    getDaysInPeriod: global.BancaTrackerDailyCommercialComparison.getDaysInPeriod,
    validatePeriod, resolveAsOfDay, calculateExecutionMeasures,
    buildActualMaps, buildExecution,
  });
})(window);
