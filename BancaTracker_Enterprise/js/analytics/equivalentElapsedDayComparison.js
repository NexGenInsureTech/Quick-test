/*==============================================================
BancaTracker Enterprise
Version : 8.4.0
File    : equivalentElapsedDayComparison.js
Module  : Analytics
Purpose : Compare signed Actual through an equivalent observed day horizon
==============================================================*/

(function (global) {
  "use strict";

  const HORIZON_AUTHORITY = "OBSERVED_VALID_TRANSACTION_DAY";

  function emptyDiagnostics() {
    return {
      sourceRows: 0, includedRows: 0, invalidPremiumCount: 0,
      missingPeriodCount: 0, missingDayCount: 0, invalidDayCount: 0,
      excludedDatedFactCount: 0,
    };
  }

  function validPremium(value) {
    return typeof value === "number" && Number.isFinite(value);
  }

  function validDay(fact, periodKey) {
    const day = Number(fact && fact.day);
    const daysInPeriod = global.BancaTrackerDailyCommercialComparison.getDaysInPeriod(periodKey);
    return Number.isInteger(day) && day >= 1 && day <= daysInPeriod ? day : null;
  }

  function resolveObservedHorizon(facts, periodKey) {
    const diagnostics = emptyDiagnostics();
    let horizon = null;
    (facts || []).forEach((fact) => {
      if (!fact || fact.monthKey !== periodKey) return;
      diagnostics.sourceRows += 1;
      if (!validPremium(fact.premium)) { diagnostics.invalidPremiumCount += 1; diagnostics.excludedDatedFactCount += 1; return; }
      if (fact.day === null || fact.day === undefined || fact.day === "") { diagnostics.missingDayCount += 1; diagnostics.excludedDatedFactCount += 1; return; }
      const day = validDay(fact, periodKey);
      if (day === null) { diagnostics.invalidDayCount += 1; diagnostics.excludedDatedFactCount += 1; return; }
      diagnostics.includedRows += 1;
      horizon = horizon === null ? day : Math.max(horizon, day);
    });
    return { periodKey, horizon, validFactCount: diagnostics.includedRows, diagnostics };
  }

  function validateThroughDay(throughDay, basePeriod, comparisonPeriod, defaultThroughDay) {
    if (throughDay === null || throughDay === undefined || throughDay === "") return { valid: true, effectiveThroughDay: defaultThroughDay, explicit: false };
    const value = Number(throughDay);
    const baseDays = global.BancaTrackerDailyCommercialComparison.getDaysInPeriod(basePeriod);
    const comparisonDays = global.BancaTrackerDailyCommercialComparison.getDaysInPeriod(comparisonPeriod);
    const valid = Number.isInteger(value) && value >= 1 && value <= baseDays && value <= comparisonDays && value <= defaultThroughDay;
    return valid
      ? { valid: true, effectiveThroughDay: value, explicit: true }
      : { valid: false, effectiveThroughDay: null, explicit: true };
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

  function scopedDailyActuals(facts, periods, dimension, authorityContext) {
    const requested = new Set(periods);
    const rollups = global.BancaTrackerCommercialRollups;
    const metadataIndex = dimension === "OVERALL" ? null : rollups.buildMetadataIndex(authorityContext || {});
    const byPeriod = new Map();
    const labels = new Map();
    (facts || []).forEach((fact) => {
      if (!requested.has(fact.monthKey) || !validPremium(fact.premium) || validDay(fact, fact.monthKey) === null) return;
      let key = "ALL";
      let label = "Overall";
      if (dimension !== "OVERALL") {
        const governed = rollups.attachMetadata([factForDimension(fact)], metadataIndex)[0];
        const identity = rollups.getDimensionValue(governed, dimension);
        key = identity.key;
        label = identity.label;
      }
      if (!byPeriod.has(fact.monthKey)) byPeriod.set(fact.monthKey, new Map());
      const period = byPeriod.get(fact.monthKey);
      if (!period.has(key)) period.set(key, new Map());
      const days = period.get(key);
      const day = validDay(fact, fact.monthKey);
      days.set(day, (days.get(day) || 0) + fact.premium);
      if (!labels.has(key)) labels.set(key, label);
    });
    return { byPeriod, labels };
  }

  function movement(baseActual, comparisonActual) {
    return global.BancaTrackerCommercialComparison.compareActual(baseActual, comparisonActual);
  }

  function entitySeries(key, label, baseDaily, comparisonDaily, throughDay) {
    let baseCumulative = 0;
    let comparisonCumulative = 0;
    const days = [];
    for (let day = 1; day <= throughDay; day += 1) {
      const baseDailyActual = baseDaily && baseDaily.get(day) || 0;
      const comparisonDailyActual = comparisonDaily && comparisonDaily.get(day) || 0;
      baseCumulative += baseDailyActual;
      comparisonCumulative += comparisonDailyActual;
      const daily = movement(baseDailyActual, comparisonDailyActual);
      const cumulative = movement(baseCumulative, comparisonCumulative);
      days.push({
        day, baseDailyActual, comparisonDailyActual,
        dailyAbsoluteChange: daily.actualChange, dailyGrowthPct: daily.actualChangePct, dailyDirection: daily.actualDirection,
        baseCumulativeActual: baseCumulative, comparisonCumulativeActual: comparisonCumulative,
        cumulativeAbsoluteChange: cumulative.actualChange, cumulativeGrowthPct: cumulative.actualChangePct, cumulativeDirection: cumulative.actualDirection,
      });
    }
    const finalMovement = movement(baseCumulative, comparisonCumulative);
    return {
      key, label, days,
      summary: {
        throughDay, baseThroughDayActual: baseCumulative, comparisonThroughDayActual: comparisonCumulative,
        absoluteGap: finalMovement.actualChange, growthPct: finalMovement.actualChangePct, direction: finalMovement.actualDirection,
      },
      reconciliation: {
        baseDailyTotal: days.reduce((sum, row) => sum + row.baseDailyActual, 0),
        comparisonDailyTotal: days.reduce((sum, row) => sum + row.comparisonDailyActual, 0),
        baseFinalCumulative: baseCumulative, comparisonFinalCumulative: comparisonCumulative,
      },
    };
  }

  function combinedDiagnostics(base, comparison) {
    const result = emptyDiagnostics();
    [base, comparison].forEach((item) => Object.keys(result).forEach((key) => { result[key] += item.diagnostics[key] || 0; }));
    return result;
  }

  function invalidResult(status, basePeriod, comparisonPeriod, dimension, diagnostics, extra) {
    return { status, basePeriod: basePeriod || null, comparisonPeriod: comparisonPeriod || null, dimension, entities: [], summary: null, reconciliation: null, diagnostics, ...extra };
  }

  function buildComparison(options = {}) {
    const rollups = global.BancaTrackerCommercialRollups;
    const dimension = options.dimension || "OVERALL";
    const periodContext = options.periodContext || rollups.buildPeriodContext(options.performanceResult);
    if (!rollups.DIMENSIONS.includes(dimension)) return invalidResult("INVALID_PERIOD", options.basePeriod, options.comparisonPeriod, dimension, { reason: "INVALID_DIMENSION" });
    const validation = global.BancaTrackerCommercialComparison.validateComparisonPeriods(periodContext, options.basePeriod, options.comparisonPeriod);
    if (!validation.valid) return invalidResult(validation.status, options.basePeriod, options.comparisonPeriod, dimension, { validation });

    const baseHorizon = resolveObservedHorizon(options.facts, options.basePeriod);
    const comparisonHorizon = resolveObservedHorizon(options.facts, options.comparisonPeriod);
    const diagnostics = combinedDiagnostics(baseHorizon, comparisonHorizon);
    const defaultThroughDay = baseHorizon.horizon === null || comparisonHorizon.horizon === null
      ? null
      : Math.min(baseHorizon.horizon, comparisonHorizon.horizon);
    const horizonMetadata = {
      horizonAuthority: HORIZON_AUTHORITY,
      baseObservedHorizon: baseHorizon.horizon,
      comparisonObservedHorizon: comparisonHorizon.horizon,
      effectiveThroughDay: null,
    };
    if (defaultThroughDay === null) return invalidResult("NO_VALID_DATED_FACTS", options.basePeriod, options.comparisonPeriod, dimension, diagnostics, horizonMetadata);
    const throughDay = validateThroughDay(options.throughDay, options.basePeriod, options.comparisonPeriod, defaultThroughDay);
    if (!throughDay.valid) return invalidResult("INVALID_THROUGH_DAY", options.basePeriod, options.comparisonPeriod, dimension, diagnostics, horizonMetadata);
    horizonMetadata.effectiveThroughDay = throughDay.effectiveThroughDay;

    const daily = scopedDailyActuals(options.facts, [options.basePeriod, options.comparisonPeriod], dimension, options.authorityContext);
    const base = daily.byPeriod.get(options.basePeriod) || new Map();
    const comparison = daily.byPeriod.get(options.comparisonPeriod) || new Map();
    const keys = new Set([...base.keys(), ...comparison.keys()]);
    if (dimension === "OVERALL") keys.add("ALL");
    const entities = [...keys].map((key) => entitySeries(key, daily.labels.get(key) || key, base.get(key), comparison.get(key), throughDay.effectiveThroughDay))
      .sort((left, right) => String(left.label).localeCompare(String(right.label)) || String(left.key).localeCompare(String(right.key)));
    const overall = entities.find((item) => item.key === "ALL") || null;
    const reconciliation = {
      baseDailyTotal: entities.reduce((sum, item) => sum + item.reconciliation.baseDailyTotal, 0),
      comparisonDailyTotal: entities.reduce((sum, item) => sum + item.reconciliation.comparisonDailyTotal, 0),
      baseFinalCumulative: entities.reduce((sum, item) => sum + item.reconciliation.baseFinalCumulative, 0),
      comparisonFinalCumulative: entities.reduce((sum, item) => sum + item.reconciliation.comparisonFinalCumulative, 0),
    };
    return {
      status: validation.samePeriod ? "SAME_PERIOD" : diagnostics.excludedDatedFactCount ? "PARTIAL" : "READY",
      samePeriod: validation.samePeriod, basePeriod: options.basePeriod, comparisonPeriod: options.comparisonPeriod, dimension,
      ...horizonMetadata, explicitThroughDay: throughDay.explicit, entities,
      summary: dimension === "OVERALL" && overall ? { ...overall.summary, ...horizonMetadata } : null,
      reconciliation, diagnostics: { validation, ...diagnostics },
    };
  }

  global.BancaTrackerEquivalentElapsedDayComparison = Object.freeze({ buildComparison, validateThroughDay, resolveObservedHorizon });
})(window);
