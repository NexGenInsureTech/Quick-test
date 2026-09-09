/*==============================================================
BancaTracker Enterprise
Version : 8.4.0
File    : branchMaturityComparison.js
Module  : Analytics
Purpose : Governed branch maturity distributions and adjacent movement
==============================================================*/

(function (global) {
  "use strict";

  const BAND_ORDER = Object.freeze(["Zero", "1 - 14.9K", "15K - 24.9K", "25K - 49.9K", "50K - 99.9K", "1L - 1.99L", "2L+"]);
  const bandIndex = Object.freeze(Object.fromEntries(BAND_ORDER.map((band, index) => [band, index])));

  function stableCompare(left, right) { return String(left).localeCompare(String(right)); }
  function emptyDiagnostics() { return { missingBranchIdentityCount: 0, sourceBranchPeriodCount: 0, eligibleBranchPeriodCount: 0 }; }

  function validateSelection(periodContext, selectedPeriods, dimension) {
    const periods = Array.isArray(selectedPeriods) ? selectedPeriods : [];
    const available = periodContext && Array.isArray(periodContext.availablePeriods) ? periodContext.availablePeriods : [];
    if (!available.length) return { valid: false, status: "NO_PERIODS", periods: [] };
    if (!periods.length || (periods.length !== 2 && periods.length !== 3)) return { valid: false, status: "INVALID_PERIOD_SELECTION", periods: [] };
    if (!global.BancaTrackerCommercialRollups.DIMENSIONS.includes(dimension)) return { valid: false, status: "INVALID_DIMENSION", periods: [] };
    if (new Set(periods).size !== periods.length || periods.some((period) => !available.includes(period)) || periods.some((period, index) => index && period <= periods[index - 1])) return { valid: false, status: "INVALID_PERIOD_SELECTION", periods: [] };
    return { valid: true, status: "READY", periods: [...periods] };
  }

  function normalizeBranchPeriods(rows, diagnostics) {
    const byBranch = new Map();
    (rows || []).forEach((row) => {
      diagnostics.sourceBranchPeriodCount += 1;
      if (!row || !row.branchId) { diagnostics.missingBranchIdentityCount += 1; return; }
      const key = String(row.branchId);
      if (!byBranch.has(key)) byBranch.set(key, {
        branchId: key, branchName: row.branchName || null, canonicalBank: row.canonicalBank || null,
        stateName: row.stateName || null, zoneName: row.zoneName || null, premium: 0,
      });
      const item = byBranch.get(key);
      item.premium += Number(row.actualPremium) || 0;
      ["branchName", "canonicalBank", "stateName", "zoneName"].forEach((field) => { if (item[field] === null && row[field] !== null && row[field] !== undefined) item[field] = row[field]; });
    });
    diagnostics.eligibleBranchPeriodCount += byBranch.size;
    return byBranch;
  }

  function buildMonthlyDistribution(rows, periodKey) {
    const diagnostics = emptyDiagnostics();
    const branches = normalizeBranchPeriods(rows, diagnostics);
    const populationCount = branches.size;
    const bands = BAND_ORDER.map((band, orderedBandIndex) => ({ band, orderedBandIndex, branchCount: 0, percentageOfPopulation: 0, signedPremium: 0 }));
    branches.forEach((branch) => {
      const band = global.BancaTrackerUtils.getBranchBand(branch.premium);
      const item = bands[bandIndex[band]];
      item.branchCount += 1;
      item.signedPremium += branch.premium;
    });
    bands.forEach((item) => { item.percentageOfPopulation = populationCount ? item.branchCount / populationCount * 100 : 0; });
    return {
      periodKey, populationCount, bands,
      branchRows: [...branches.values()].map((branch) => ({ ...branch, band: global.BancaTrackerUtils.getBranchBand(branch.premium), bandIndex: bandIndex[global.BancaTrackerUtils.getBranchBand(branch.premium)] })).sort((left, right) => stableCompare(left.branchName || left.branchId, right.branchName || right.branchId) || stableCompare(left.branchId, right.branchId)),
      reconciliation: { bandBranchCount: bands.reduce((sum, item) => sum + item.branchCount, 0), populationCount, matches: bands.reduce((sum, item) => sum + item.branchCount, 0) === populationCount },
      diagnostics,
    };
  }

  function presence(base, comparison) { return base && comparison ? "BOTH" : base ? "BASE_ONLY" : "COMPARISON_ONLY"; }
  function movementFor(base, comparison) {
    if (!base || !comparison) return { movement: "NOT_COMPARABLE", specialMovement: null };
    const movement = comparison.bandIndex > base.bandIndex ? "UPGRADED" : comparison.bandIndex < base.bandIndex ? "DOWNGRADED" : "UNCHANGED";
    const specialMovement = base.band === "Zero" && comparison.bandIndex >= 3 ? "ZERO_TO_ACTIVE" : base.bandIndex >= 3 && comparison.band === "Zero" ? "ACTIVE_TO_ZERO" : null;
    return { movement, specialMovement };
  }

  function buildTransition(baseDistribution, comparisonDistribution) {
    const baseById = new Map((baseDistribution && baseDistribution.branchRows || []).map((row) => [row.branchId, row]));
    const comparisonById = new Map((comparisonDistribution && comparisonDistribution.branchRows || []).map((row) => [row.branchId, row]));
    const rows = [...new Set([...baseById.keys(), ...comparisonById.keys()])].map((branchId) => {
      const base = baseById.get(branchId) || null;
      const comparison = comparisonById.get(branchId) || null;
      const classification = movementFor(base, comparison);
      const source = comparison || base;
      return {
        branchId, branchName: source.branchName, canonicalBank: source.canonicalBank, stateName: source.stateName, zoneName: source.zoneName,
        baseMonth: baseDistribution.periodKey, comparisonMonth: comparisonDistribution.periodKey,
        basePremium: base ? base.premium : null, comparisonPremium: comparison ? comparison.premium : null,
        baseBand: base ? base.band : null, comparisonBand: comparison ? comparison.band : null,
        baseBandIndex: base ? base.bandIndex : null, comparisonBandIndex: comparison ? comparison.bandIndex : null,
        ...classification, presenceStatus: presence(base, comparison),
      };
    }).sort((left, right) => stableCompare(left.branchName || left.branchId, right.branchName || right.branchId) || stableCompare(left.branchId, right.branchId));
    const count = (name) => rows.filter((row) => row.movement === name).length;
    const eligibleTransitionPopulation = rows.length - count("NOT_COMPARABLE");
    const upgradedCount = count("UPGRADED"); const downgradedCount = count("DOWNGRADED"); const unchangedCount = count("UNCHANGED");
    return {
      baseMonth: baseDistribution.periodKey, comparisonMonth: comparisonDistribution.periodKey, rows,
      summary: {
        upgradedCount, downgradedCount, unchangedCount,
        zeroToActiveCount: rows.filter((row) => row.specialMovement === "ZERO_TO_ACTIVE").length,
        activeToZeroCount: rows.filter((row) => row.specialMovement === "ACTIVE_TO_ZERO").length,
        eligibleTransitionPopulation, nonComparableCount: count("NOT_COMPARABLE"),
        reconciliation: { classifiedCount: upgradedCount + downgradedCount + unchangedCount, eligibleTransitionPopulation, matches: upgradedCount + downgradedCount + unchangedCount === eligibleTransitionPopulation },
        diagnostics: {},
      },
    };
  }

  function entityRows(performanceRows, periods, dimension, authorityContext, diagnostics) {
    const rollups = global.BancaTrackerCommercialRollups;
    const metadata = rollups.buildMetadataIndex(authorityContext || {});
    const byEntity = new Map();
    performanceRows.filter((row) => periods.includes(row.periodKey)).forEach((row) => {
      const enriched = rollups.attachMetadata([row], metadata)[0];
      const value = rollups.getDimensionValue(enriched, dimension);
      if (!byEntity.has(value.key)) byEntity.set(value.key, { key: value.key, label: value.label, rowsByPeriod: new Map() });
      const entity = byEntity.get(value.key);
      if (!entity.rowsByPeriod.has(enriched.periodKey)) entity.rowsByPeriod.set(enriched.periodKey, []);
      entity.rowsByPeriod.get(enriched.periodKey).push(enriched);
    });
    return [...byEntity.values()].map((entity) => {
      const monthlyDistributions = periods.map((period) => buildMonthlyDistribution(entity.rowsByPeriod.get(period) || [], period));
      monthlyDistributions.forEach((distribution) => { diagnostics.missingBranchIdentityCount += distribution.diagnostics.missingBranchIdentityCount; diagnostics.sourceBranchPeriodCount += distribution.diagnostics.sourceBranchPeriodCount; diagnostics.eligibleBranchPeriodCount += distribution.diagnostics.eligibleBranchPeriodCount; });
      const transitions = monthlyDistributions.slice(1).map((distribution, index) => buildTransition(monthlyDistributions[index], distribution));
      return { key: entity.key, label: entity.label, monthlyDistributions, transitions };
    }).sort((left, right) => stableCompare(left.label, right.label) || stableCompare(left.key, right.key));
  }

  function buildComparison(options = {}) {
    const dimension = options.dimension || "OVERALL";
    const rollups = global.BancaTrackerCommercialRollups;
    const periodContext = options.periodContext || rollups.buildPeriodContext(options.performanceResult);
    const selected = validateSelection(periodContext, options.selectedPeriods, dimension);
    if (!selected.valid) return { status: selected.status, dimension, selectedPeriods: [], entities: [], diagnostics: { validation: selected } };
    const diagnostics = emptyDiagnostics();
    const rows = options.performanceResult && Array.isArray(options.performanceResult.rows) ? options.performanceResult.rows : [];
    const entities = entityRows(rows, selected.periods, dimension, options.authorityContext, diagnostics);
    const partial = options.performanceResult && options.performanceResult.status === "PARTIAL" || diagnostics.missingBranchIdentityCount > 0;
    const overall = dimension === "OVERALL" ? entities[0] || { monthlyDistributions: selected.periods.map((period) => buildMonthlyDistribution([], period)), transitions: [] } : null;
    return {
      status: partial ? "PARTIAL" : "READY", dimension, selectedPeriods: [...selected.periods], entities,
      monthlyDistributions: overall && overall.monthlyDistributions, transitions: overall && overall.transitions,
      diagnostics: { validation: selected, ...diagnostics },
    };
  }

  global.BancaTrackerBranchMaturityComparison = Object.freeze({ BAND_ORDER, buildComparison, buildMonthlyDistribution, buildTransition });
})(window);
