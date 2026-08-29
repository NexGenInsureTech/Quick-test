/*==============================================================
BancaTracker Enterprise
Version : 8.2.0-dev
File    : dailyCommercialComparison.js
Module  : Analytics
Purpose : Compare signed daily and cumulative Actual Premium by calendar day
==============================================================*/

(function (global) {
  "use strict";

  const PERIOD_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

  function getDaysInPeriod(periodKey) {
    if (!PERIOD_PATTERN.test(periodKey || "")) return null;
    const [year, month] = periodKey.split("-").map(Number);
    return new Date(Date.UTC(year, month, 0)).getUTCDate();
  }

  function validatePeriods(periodContext, basePeriod, comparisonPeriod) {
    return global.BancaTrackerCommercialComparison.validateComparisonPeriods(periodContext, basePeriod, comparisonPeriod);
  }

  function factForDimension(fact) {
    return {
      ...fact,
      canonicalBank: fact.canonicalBank || fact.bank || null,
      branchName: fact.branchName || fact.branch || null,
      stateName: fact.stateName || fact.state || null,
      zoneName: fact.zoneName || fact.zone || null,
    };
  }

  function buildDailyActuals(facts, periods, dimension, authorityContext = null) {
    const requested = new Set(periods || []);
    const rollups = global.BancaTrackerCommercialRollups;
    const metadataIndex = dimension === "OVERALL" ? null : rollups.buildMetadataIndex(authorityContext || {});
    const byPeriod = new Map();
    const entities = new Map();
    const diagnostics = {
      sourceRows: Array.isArray(facts) ? facts.length : 0, includedRows: 0,
      missingPeriodCount: 0, missingDayCount: 0, invalidDayCount: 0,
      uniqueExcludedFactCount: 0, uniqueExcludedPremium: 0,
    };
    (facts || []).forEach((source) => {
      const premium = Number(source.premium) || 0;
      const missingPeriod = !PERIOD_PATTERN.test(source.monthKey || "");
      const missingDay = source.day === null || source.day === undefined || source.day === "";
      const numericDay = Number(source.day);
      const invalidDay = !missingPeriod && !missingDay && (!Number.isInteger(numericDay) || numericDay < 1 || numericDay > getDaysInPeriod(source.monthKey));
      if (missingPeriod) diagnostics.missingPeriodCount += 1;
      if (missingDay) diagnostics.missingDayCount += 1;
      if (invalidDay) diagnostics.invalidDayCount += 1;
      if (missingPeriod || missingDay || invalidDay) {
        diagnostics.uniqueExcludedFactCount += 1;
        diagnostics.uniqueExcludedPremium += premium;
        return;
      }
      if (!requested.has(source.monthKey)) return;
      let key = "ALL";
      let label = "Overall";
      if (dimension !== "OVERALL") {
        const enriched = rollups.attachMetadata([factForDimension(source)], metadataIndex)[0];
        const value = rollups.getDimensionValue(enriched, dimension);
        key = value.key; label = value.label;
      }
      diagnostics.includedRows += 1;
      const periodKey = source.monthKey;
      if (!byPeriod.has(periodKey)) byPeriod.set(periodKey, new Map());
      const period = byPeriod.get(periodKey);
      if (!period.has(key)) period.set(key, new Map());
      const daily = period.get(key);
      daily.set(numericDay, (daily.get(numericDay) || 0) + premium);
      if (!entities.has(key)) entities.set(key, { baseLabel: null, comparisonLabel: null });
      const role = periodKey === periods[1] ? "comparisonLabel" : "baseLabel";
      if (!entities.get(key)[role]) entities.get(key)[role] = label;
    });
    return { byPeriod, entities, diagnostics };
  }

  function monthlyEntities(performanceResult, periodKey, dimension, authorityContext) {
    const result = global.BancaTrackerCommercialRollups.buildRollup(performanceResult, { type: "MONTH", periodKey }, dimension, authorityContext || null);
    return { result, rows: result.rows || [] };
  }

  function movement(baseValue, comparisonValue) {
    if (baseValue === null || comparisonValue === null) return { change: null, changePct: null, direction: "NOT_COMPARABLE" };
    const change = comparisonValue - baseValue;
    return { change, changePct: baseValue > 0 ? (change / baseValue) * 100 : null, direction: change > 0 ? "UP" : change < 0 ? "DOWN" : "FLAT" };
  }

  function buildEntitySeries(key, labels, baseDaily, comparisonDaily, basePeriod, comparisonPeriod, basePresent, comparisonPresent) {
    const baseDays = getDaysInPeriod(basePeriod);
    const comparisonDays = getDaysInPeriod(comparisonPeriod);
    const domain = Math.max(baseDays, comparisonDays);
    let baseCumulative = 0;
    let comparisonCumulative = 0;
    const days = [];
    for (let day = 1; day <= domain; day += 1) {
      const baseAvailable = day <= baseDays;
      const comparisonAvailable = day <= comparisonDays;
      const baseActual = baseAvailable ? baseDaily && baseDaily.get(day) || 0 : null;
      const comparisonActual = comparisonAvailable ? comparisonDaily && comparisonDaily.get(day) || 0 : null;
      if (baseAvailable) baseCumulative += baseActual;
      if (comparisonAvailable) comparisonCumulative += comparisonActual;
      const daily = movement(baseActual, comparisonActual);
      const cumulative = movement(baseAvailable ? baseCumulative : null, comparisonAvailable ? comparisonCumulative : null);
      days.push({
        day,
        base: { available: baseAvailable, dailyActual: baseActual, cumulativeActual: baseAvailable ? baseCumulative : null },
        comparison: { available: comparisonAvailable, dailyActual: comparisonActual, cumulativeActual: comparisonAvailable ? comparisonCumulative : null },
        daily, cumulative,
      });
    }
    const baseLabel = labels.baseLabel || null;
    const comparisonLabel = labels.comparisonLabel || null;
    return {
      key, label: comparisonLabel || baseLabel || key, baseLabel, comparisonLabel,
      labelChanged: Boolean(baseLabel && comparisonLabel && baseLabel !== comparisonLabel),
      basePresent, comparisonPresent,
      presenceStatus: basePresent && comparisonPresent ? "BOTH" : basePresent ? "BASE_ONLY" : "COMPARISON_ONLY",
      days,
    };
  }

  function buildComparison(options = {}) {
    const rollups = global.BancaTrackerCommercialRollups;
    const performanceResult = options.performanceResult || null;
    const periodContext = options.periodContext || rollups.buildPeriodContext(performanceResult);
    const dimension = options.dimension || "OVERALL";
    if (!rollups.DIMENSIONS.includes(dimension)) return { status: "INVALID_DIMENSION", dimension, entities: [], diagnostics: { reason: "INVALID_DIMENSION" } };
    const validation = validatePeriods(periodContext, options.basePeriod, options.comparisonPeriod);
    if (!validation.valid) return { status: validation.status, dimension, basePeriod: options.basePeriod || null, comparisonPeriod: options.comparisonPeriod || null, entities: [], diagnostics: validation };
    const baseMonthly = monthlyEntities(performanceResult, options.basePeriod, dimension, options.authorityContext);
    const comparisonMonthly = monthlyEntities(performanceResult, options.comparisonPeriod, dimension, options.authorityContext);
    const actuals = buildDailyActuals(options.facts || [], [options.basePeriod, options.comparisonPeriod], dimension, options.authorityContext);
    const baseDaily = actuals.byPeriod.get(options.basePeriod) || new Map();
    const comparisonDaily = actuals.byPeriod.get(options.comparisonPeriod) || new Map();
    const baseRows = new Map(baseMonthly.rows.map((row) => [row.key, row]));
    const comparisonRows = new Map(comparisonMonthly.rows.map((row) => [row.key, row]));
    const keys = new Set([...baseDaily.keys(), ...comparisonDaily.keys(), ...baseRows.keys(), ...comparisonRows.keys()]);
    if (dimension === "OVERALL" && !keys.size) keys.add("ALL");
    const entities = [...keys].map((key) => {
      const factLabels = actuals.entities.get(key) || {};
      const labels = {
        baseLabel: baseRows.get(key) && baseRows.get(key).label || factLabels.baseLabel || null,
        comparisonLabel: comparisonRows.get(key) && comparisonRows.get(key).label || factLabels.comparisonLabel || null,
      };
      return buildEntitySeries(
        key, labels, baseDaily.get(key), comparisonDaily.get(key), options.basePeriod, options.comparisonPeriod,
        dimension === "OVERALL" || baseRows.has(key) || baseDaily.has(key),
        dimension === "OVERALL" || comparisonRows.has(key) || comparisonDaily.has(key),
      );
    }).sort((left, right) => String(left.label).localeCompare(String(right.label)) || String(left.key).localeCompare(String(right.key)));
    const partial = actuals.diagnostics.uniqueExcludedFactCount > 0 || [baseMonthly.result.status, comparisonMonthly.result.status].some((status) => !["READY", "NO_FACT_DATA"].includes(status));
    return {
      status: validation.samePeriod ? "SAME_PERIOD" : partial ? "PARTIAL" : "READY",
      samePeriod: validation.samePeriod, dimension,
      basePeriod: options.basePeriod, comparisonPeriod: options.comparisonPeriod,
      dayDomain: Math.max(getDaysInPeriod(options.basePeriod), getDaysInPeriod(options.comparisonPeriod)),
      entities,
      monthlyPresence: { base: baseMonthly.result, comparison: comparisonMonthly.result },
      diagnostics: { ...actuals.diagnostics, validation },
    };
  }

  global.BancaTrackerDailyCommercialComparison = Object.freeze({
    getDaysInPeriod, validatePeriods, buildDailyActuals, movement,
    buildEntitySeries, buildComparison,
    resolveDefaultPeriods: global.BancaTrackerCommercialComparison.resolveDefaultPeriods,
  });
})(window);
