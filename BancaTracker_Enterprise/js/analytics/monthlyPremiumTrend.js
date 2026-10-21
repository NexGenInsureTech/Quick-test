/* v8.6.8: pure Monthly Net Premium Trend authority. */
(function (global) {
  "use strict";

  const PERIOD_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
  const FY_PATTERN = /^FY(\d{4})-(\d{2})$/;

  function shiftPeriod(periodKey, offset) {
    if (!PERIOD_PATTERN.test(periodKey || "") || !Number.isInteger(offset)) return null;
    const parts = periodKey.split("-").map(Number);
    const date = new Date(Date.UTC(parts[0], parts[1] - 1 + offset, 1));
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
  }

  function fiscalPeriods(financialYear) {
    const match = String(financialYear || "").match(FY_PATTERN);
    if (!match) return null;
    const startYear = Number(match[1]);
    if (String(startYear + 1).slice(-2) !== match[2]) return null;
    return Array.from({ length: 12 }, (_, index) => shiftPeriod(`${startYear}-04`, index));
  }

  function financialYearOf(periodKey) {
    if (!PERIOD_PATTERN.test(periodKey || "")) return null;
    const [year, month] = periodKey.split("-").map(Number);
    const startYear = month >= 4 ? year : year - 1;
    return `FY${startYear}-${String(startYear + 1).slice(-2)}`;
  }

  function availableFinancialYears(facts) {
    return [...new Set((Array.isArray(facts) ? facts : [])
      .map((fact) => financialYearOf(fact && fact.monthKey)).filter(Boolean))].sort();
  }

  function freeze(value) {
    if (value && typeof value === "object" && !Object.isFrozen(value)) {
      Object.values(value).forEach(freeze);
      Object.freeze(value);
    }
    return value;
  }

  function compare(current, reference) {
    if (!current.observedData) return { absoluteChange: null, percentChange: null, status: "CURRENT_MISSING" };
    if (!reference || !reference.observedData) return { absoluteChange: null, percentChange: null, status: "REFERENCE_MISSING" };
    const absoluteChange = current.actualPremium - reference.actualPremium;
    if (reference.actualPremium === 0) return { absoluteChange, percentChange: null, status: "BASE_ZERO" };
    if (reference.actualPremium < 0) return { absoluteChange, percentChange: null, status: "BASE_NON_POSITIVE" };
    return { absoluteChange, percentChange: absoluteChange / reference.actualPremium * 100, status: "READY" };
  }

  function buildMonthlyPremiumTrend(facts, options = {}) {
    if (!Array.isArray(facts)) return freeze({ status: "INVALID_FACTS", financialYear: null, scope: null, months: [], diagnostics: {}, reconciliation: {} });
    const periods = fiscalPeriods(options.financialYear);
    if (!periods) return freeze({ status: "INVALID_FINANCIAL_YEAR", financialYear: options.financialYear || null, scope: options.scope || null, months: [], diagnostics: {}, reconciliation: {} });
    const scope = options.scope || { type: "OVERALL" };
    if (!scope || !["OVERALL", "MANAGEMENT_BANK"].includes(scope.type)) return freeze({ status: "INVALID_SCOPE", financialYear: options.financialYear, scope, months: [], diagnostics: {}, reconciliation: {} });
    if (scope.type === "MANAGEMENT_BANK" && (typeof scope.managementBank !== "string" || !scope.managementBank)) return freeze({ status: "INVALID_SCOPE", financialYear: options.financialYear, scope, months: [], diagnostics: {}, reconciliation: {} });
    const management = global.BancaTrackerManagementBank;
    if (!management || typeof management.resolve !== "function") return freeze({ status: "AUTHORITY_UNAVAILABLE", financialYear: options.financialYear, scope, months: [], diagnostics: {}, reconciliation: {} });

    const selectedPeriods = new Set(periods);
    const aggregates = new Map();
    let eligibleCanonicalDateRows = 0; let invalidPremiumRows = 0; let selectedFYFactRows = 0;
    let includedPremium = 0; let mappedPremium = 0; let unmappedPremium = 0;
    let selectedScopeRows = 0; let commercialEligibleRows = 0; let commercialEligiblePremium = 0; let commercialIneligiblePremium = 0;
    const sourceContributions = new Map(); const managementContributions = new Map();
    let universeEligibleCanonicalDateRows = 0; let universeInvalidOrMissingDateRows = 0; let universeInvalidPremiumRows = 0;
    let universeIncludedPremium = 0; let universeExcludedPremium = 0; let universeMappedPremium = 0; let universeUnmappedPremium = 0;
    let universeSelectedScopeRows = 0; let universeCommercialEligibleRows = 0; let universeCommercialEligiblePremium = 0; let universeCommercialIneligiblePremium = 0;

    facts.forEach((source) => {
      const fact = source && typeof source === "object" ? source : {};
      const premiumValid = typeof fact.premium === "number" && Number.isFinite(fact.premium);
      const premium = premiumValid ? fact.premium : null;
      const resolved = management.resolve(fact.bank);
      const selected = scope.type === "OVERALL" || resolved.managementBank === scope.managementBank;
      if (!PERIOD_PATTERN.test(fact.monthKey || "")) {
        universeInvalidOrMissingDateRows += 1;
        if (selected && premiumValid) universeExcludedPremium += premium;
        return;
      }
      universeEligibleCanonicalDateRows += 1;
      if (!selected) return;
      const inSelectedFY = selectedPeriods.has(fact.monthKey);
      if (inSelectedFY) { selectedFYFactRows += 1; eligibleCanonicalDateRows += 1; }
      if (!premiumValid) {
        universeInvalidPremiumRows += 1;
        if (inSelectedFY) invalidPremiumRows += 1;
        return;
      }
      universeSelectedScopeRows += 1; universeIncludedPremium += premium;
      if (resolved.managementBank) universeMappedPremium += premium; else universeUnmappedPremium += premium;
      if (fact.branchId) { universeCommercialEligibleRows += 1; universeCommercialEligiblePremium += premium; } else universeCommercialIneligiblePremium += premium;
      const current = aggregates.get(fact.monthKey) || { actualPremium: 0, transactionRowCount: 0, observedData: false };
      current.actualPremium += premium; current.transactionRowCount += 1; current.observedData = true;
      aggregates.set(fact.monthKey, current);
      if (!inSelectedFY) return;
      selectedScopeRows += 1; includedPremium += premium;
      if (resolved.managementBank) mappedPremium += premium; else unmappedPremium += premium;
      sourceContributions.set(String(resolved.sourceBank || "__UNMAPPED__"), (sourceContributions.get(String(resolved.sourceBank || "__UNMAPPED__")) || 0) + premium);
      if (resolved.managementBank) managementContributions.set(resolved.managementBank, (managementContributions.get(resolved.managementBank) || 0) + premium);
      if (fact.branchId) { commercialEligibleRows += 1; commercialEligiblePremium += premium; } else commercialIneligiblePremium += premium;
    });

    const allRequired = new Set(periods.flatMap((period) => [period, shiftPeriod(period, -1), shiftPeriod(period, -12)]));
    const observed = new Map([...allRequired].map((period) => [period, aggregates.get(period) || { actualPremium: null, transactionRowCount: 0, observedData: false }]));
    const months = periods.map((periodKey) => {
      const current = observed.get(periodKey);
      const previousPeriodKey = shiftPeriod(periodKey, -1); const priorYearPeriodKey = shiftPeriod(periodKey, -12);
      const previous = observed.get(previousPeriodKey); const priorYear = observed.get(priorYearPeriodKey);
      const mom = compare(current, previous); const yoy = compare(current, priorYear);
      return {
        periodKey, actualPremium: current.actualPremium, transactionRowCount: current.transactionRowCount, observedData: current.observedData,
        previousPeriodKey, previousActualPremium: previous.observedData ? previous.actualPremium : null,
        momAbsoluteChange: mom.absoluteChange, momPercentChange: mom.percentChange, momStatus: mom.status,
        priorYearPeriodKey, priorYearActualPremium: priorYear.observedData ? priorYear.actualPremium : null,
        yoyAbsoluteChange: yoy.absoluteChange, yoyPercentChange: yoy.percentChange, yoyStatus: yoy.status,
        temporalCompleteness: "UNKNOWN",
      };
    });
    const observedMonths = months.filter((month) => month.observedData).length;
    return freeze({
      status: observedMonths ? "READY" : "NO_OBSERVED_DATA", financialYear: options.financialYear, scope: { ...scope }, months,
      diagnostics: {
        selectedFYFactRows, eligibleCanonicalDateRows, invalidPremiumRows,
        selectedScopeRows, includedPremium, mappedPremium, unmappedPremium,
        sourceContributions: [...sourceContributions].map(([sourceBank, premium]) => ({ sourceBank, premium })),
        managementContributions: [...managementContributions].map(([managementBank, premium]) => ({ managementBank, premium })),
      },
      universeDiagnostics: {
        acceptedFactRows: facts.length, eligibleCanonicalDateRows: universeEligibleCanonicalDateRows,
        invalidOrMissingDateRows: universeInvalidOrMissingDateRows, invalidPremiumRows: universeInvalidPremiumRows,
        selectedScopeRows: universeSelectedScopeRows, includedPremium: universeIncludedPremium,
        excludedPremium: universeExcludedPremium, mappedPremium: universeMappedPremium, unmappedPremium: universeUnmappedPremium,
        commercialEligibleRows: universeCommercialEligibleRows, commercialEligiblePremium: universeCommercialEligiblePremium,
        commercialIneligibleRows: universeSelectedScopeRows - universeCommercialEligibleRows,
        commercialIneligiblePremium: universeCommercialIneligiblePremium,
        populationDifferencePremium: universeCommercialIneligiblePremium,
      },
      reconciliation: {
        observedMonths, fiscalMonthCount: 12, trendPopulation: "VALID_CANONICAL_DATE_AND_NUMERIC_PREMIUM",
        commercialPopulation: "VALID_CANONICAL_DATE_NUMERIC_PREMIUM_AND_GOVERNED_BRANCH_ID",
        commercialEligibleRows, commercialEligiblePremium, commercialIneligibleRows: selectedScopeRows - commercialEligibleRows,
        commercialIneligiblePremium, populationDifferencePremium: commercialIneligiblePremium,
      },
    });
  }

  global.BancaTrackerMonthlyPremiumTrend = Object.freeze({ buildMonthlyPremiumTrend, availableFinancialYears, fiscalPeriods, financialYearOf, shiftPeriod });
})(typeof globalThis !== "undefined" ? globalThis : window);
