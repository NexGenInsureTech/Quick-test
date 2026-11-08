/* S1A: pure Branch x Product signed net premium authority. */
(function (global) {
  "use strict";

  const PERIOD_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

  function deepFreeze(value) {
    if (value && typeof value === "object" && !Object.isFrozen(value)) {
      Object.values(value).forEach(deepFreeze);
      Object.freeze(value);
    }
    return value;
  }

  function stableCompare(left, right) {
    const a = String(left); const b = String(right);
    return a < b ? -1 : a > b ? 1 : 0;
  }

  function diagnosticCounts(items) {
    const counts = new Map();
    items.forEach((item) => {
      const code = item && item.code || "UNKNOWN_DIAGNOSTIC";
      counts.set(code, (counts.get(code) || 0) + 1);
    });
    return [...counts].map(([code, count]) => ({ code, count }))
      .sort((left, right) => stableCompare(left.code, right.code));
  }

  function emptyResult(status, options, diagnostics = []) {
    return deepFreeze({
      status,
      periodKey: options && options.periodKey || null,
      managementBank: options && options.managementBank || null,
      rows: [],
      totals: {
        sourceTransactionRowCount: 0,
        selectedTransactionRowCount: 0,
        governedTransactionRowCount: 0,
        unresolvedBranchTransactionRowCount: 0,
        matrixSignedNetPremium: 0,
        unresolvedBranchSignedNetPremium: 0,
        selectedSignedNetPremium: 0,
      },
      coverage: {
        invalidPremiumTransactionRowCount: 0,
        invalidCanonicalDayTransactionRowCount: 0,
        managementBankUnmappedTransactionRowCount: 0,
      },
      reconciliation: {
        governedSignedNetPremium: 0,
        matrixSignedNetPremium: 0,
        matrixDifference: 0,
        selectedSignedNetPremium: 0,
        disclosedSignedNetPremium: 0,
        coverageDifference: 0,
        complete: true,
      },
      diagnostics: diagnosticCounts(diagnostics),
    });
  }

  function buildBranchProductPremiumMatrix(options = {}) {
    if (!Array.isArray(options.facts)) {
      return emptyResult("INVALID_INPUT", options, [{ code: "FACTS_INVALID" }]);
    }
    if (!PERIOD_PATTERN.test(options.periodKey || "")) {
      return emptyResult("INVALID_SCOPE", options, [{ code: "PERIOD_INVALID" }]);
    }
    if (options.managementBank !== undefined && options.managementBank !== null
      && (typeof options.managementBank !== "string" || !options.managementBank.trim())) {
      return emptyResult("INVALID_SCOPE", options, [{ code: "MANAGEMENT_BANK_INVALID" }]);
    }

    const driver = global.BancaTrackerCommercialDriverAnalysis;
    const management = global.BancaTrackerManagementBank;
    const execution = global.BancaTrackerCommercialExecution;
    if (!driver || typeof driver.buildExecutionDrivers !== "function"
      || !management || typeof management.resolve !== "function"
      || !execution || typeof execution.getDaysInPeriod !== "function") {
      return emptyResult("AUTHORITY_UNAVAILABLE", options, [{ code: "DEPENDENCY_UNAVAILABLE" }]);
    }

    const scopeBank = options.managementBank == null ? null : options.managementBank.trim();
    const daysInPeriod = execution.getDaysInPeriod(options.periodKey);
    const diagnostics = [];
    const governedByBranch = new Map();
    const branchLabels = new Map();
    let selectedTransactionRowCount = 0;
    let governedTransactionRowCount = 0;
    let unresolvedBranchTransactionRowCount = 0;
    let invalidPremiumTransactionRowCount = 0;
    let invalidCanonicalDayTransactionRowCount = 0;
    let managementBankUnmappedTransactionRowCount = 0;
    let selectedSignedNetPremium = 0;
    let governedSignedNetPremium = 0;
    let unresolvedBranchSignedNetPremium = 0;

    options.facts.forEach((fact) => {
      const source = fact && typeof fact === "object" ? fact : {};
      if (source.monthKey !== options.periodKey) return;
      const bankResolution = management.resolve(source.bank);
      if (!bankResolution.managementBank) managementBankUnmappedTransactionRowCount += 1;
      if (scopeBank && bankResolution.managementBank !== scopeBank) return;
      selectedTransactionRowCount += 1;

      const premium = Number(source.premium);
      if (!Number.isFinite(premium)) {
        invalidPremiumTransactionRowCount += 1;
        diagnostics.push({ code: "PREMIUM_INVALID" });
        return;
      }
      const day = Number(source.day);
      if (!Number.isInteger(day) || day < 1 || day > daysInPeriod) {
        invalidCanonicalDayTransactionRowCount += 1;
        diagnostics.push({ code: "CANONICAL_DAY_INVALID" });
        return;
      }
      selectedSignedNetPremium += premium;
      if (!source.branchId) {
        unresolvedBranchTransactionRowCount += 1;
        unresolvedBranchSignedNetPremium += premium;
        diagnostics.push({ code: "BRANCH_UNRESOLVED" });
        return;
      }
      governedTransactionRowCount += 1;
      governedSignedNetPremium += premium;
      if (!governedByBranch.has(source.branchId)) governedByBranch.set(source.branchId, []);
      governedByBranch.get(source.branchId).push(source);
      if (!branchLabels.has(source.branchId)) branchLabels.set(source.branchId, source.branchName || source.branch || source.branchId);
    });

    const rows = [];
    governedByBranch.forEach((facts, branchId) => {
      const result = driver.buildExecutionDrivers({
        facts,
        authorityContext: options.authorityContext || null,
        parentSelection: { parentDimension: "BRANCH", parentKey: branchId, parentLabel: branchLabels.get(branchId) },
        periodKey: options.periodKey,
        asOfDay: daysInPeriod,
        driverDimension: "PRODUCT",
      });
      (result.diagnostics || []).forEach((item) => diagnostics.push(item));
      (result.rows || []).forEach((row) => rows.push({
        branchId,
        branchName: branchLabels.get(branchId),
        productKey: row.key,
        productLabel: row.label,
        signedNetPremium: row.actual,
        transactionRowCount: row.transactionCount,
      }));
    });
    rows.sort((left, right) => stableCompare(left.branchId, right.branchId)
      || stableCompare(left.productKey, right.productKey));

    const matrixSignedNetPremium = rows.reduce((sum, row) => sum + row.signedNetPremium, 0);
    const disclosedSignedNetPremium = matrixSignedNetPremium + unresolvedBranchSignedNetPremium;
    const matrixDifference = matrixSignedNetPremium - governedSignedNetPremium;
    const coverageDifference = disclosedSignedNetPremium - selectedSignedNetPremium;
    const status = diagnostics.some((item) => ["PREMIUM_INVALID", "CANONICAL_DAY_INVALID", "PRODUCT_CODE_NAME_CONFLICT"].includes(item.code))
      ? "PARTIAL" : rows.length ? "READY" : "EMPTY";

    return deepFreeze({
      status,
      periodKey: options.periodKey,
      managementBank: scopeBank,
      rows,
      totals: {
        sourceTransactionRowCount: options.facts.length,
        selectedTransactionRowCount,
        governedTransactionRowCount,
        unresolvedBranchTransactionRowCount,
        matrixSignedNetPremium,
        unresolvedBranchSignedNetPremium,
        selectedSignedNetPremium,
      },
      coverage: {
        invalidPremiumTransactionRowCount,
        invalidCanonicalDayTransactionRowCount,
        managementBankUnmappedTransactionRowCount,
      },
      reconciliation: {
        governedSignedNetPremium,
        matrixSignedNetPremium,
        matrixDifference,
        selectedSignedNetPremium,
        disclosedSignedNetPremium,
        coverageDifference,
        complete: matrixDifference === 0 && coverageDifference === 0,
      },
      diagnostics: diagnosticCounts(diagnostics),
    });
  }

  global.BancaTrackerBranchProductPremiumMatrix = Object.freeze({ buildBranchProductPremiumMatrix });
})(typeof globalThis !== "undefined" ? globalThis : window);
