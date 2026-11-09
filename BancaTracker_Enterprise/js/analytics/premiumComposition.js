(function (global) {
  "use strict";

  const BUCKETS = Object.freeze(["INITIAL", "ADVANCE", "UNKNOWN", "INVALID"]);
  const TENURE_ORDER = Object.freeze([
    "ANNUAL", "LONG_TERM_2_YEARS", "LONG_TERM_3_YEARS", "LONG_TERM_4_TO_5_YEARS",
    "LONG_TERM_OVER_5_YEARS", "SHORT_TERM", "NON_STANDARD_TERM", "UNKNOWN", "INVALID",
  ]);
  const emptyBuckets = () => ({ INITIAL: 0, ADVANCE: 0, UNKNOWN: 0, INVALID: 0 });
  const reconciledDifference = (expected, actual) => {
    const difference = expected - actual;
    const tolerance = Math.min(0.005, Number.EPSILON * Math.max(1, Math.abs(expected), Math.abs(actual)) * 16);
    return Math.abs(difference) <= tolerance ? 0 : difference;
  };
  const freeze = (value) => {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
    Object.values(value).forEach(freeze);
    return Object.freeze(value);
  };

  function bucketOf(fact) {
    const status = fact && fact.premiumPortionStatus;
    const classification = fact && fact.premiumPortionClassification;
    if (status === "SUCCESS" && classification === "INITIAL_PORTION") return "INITIAL";
    if (status === "SUCCESS" && classification === "ADVANCE_PORTION") return "ADVANCE";
    if (status === "INVALID") return "INVALID";
    return "UNKNOWN";
  }

  function tenureBucketOf(fact) {
    const status = fact && fact.policyTenureStatus;
    const classification = fact && fact.policyTenureClassification;
    if (status === "SUCCESS" && TENURE_ORDER.slice(0, -2).includes(classification)) return classification;
    if (status === "INVALID") return "INVALID";
    return "UNKNOWN";
  }

  function availableFinancialYears(facts) {
    return [...new Set((Array.isArray(facts) ? facts : [])
      .map((fact) => fact && fact.financialYear)
      .filter((value) => /^FY\d{4}-\d{2}$/.test(value || "")))].sort();
  }

  function availableManagementBanks(facts) {
    const authority = global.BancaTrackerManagementBank;
    if (!authority || typeof authority.resolve !== "function") return [];
    return [...new Set((Array.isArray(facts) ? facts : [])
      .map((fact) => authority.resolve(fact && fact.bank).managementBank)
      .filter(Boolean))].sort();
  }

  function buildPremiumComposition(facts, options = {}) {
    const source = Array.isArray(facts) ? facts : [];
    const financialYear = options.financialYear || null;
    const managementBank = options.managementBank || "ALL";
    const authority = global.BancaTrackerManagementBank;
    if (!Array.isArray(facts)) return freeze({ status: "INVALID_FACTS", financialYear, managementBank, kpis: null, months: [], products: [], diagnostics: {} });
    if (!/^FY\d{4}-\d{2}$/.test(financialYear || "")) return freeze({ status: "INVALID_FINANCIAL_YEAR", financialYear, managementBank, kpis: null, months: [], products: [], diagnostics: {} });
    if (!authority || typeof authority.resolve !== "function") return freeze({ status: "AUTHORITY_UNAVAILABLE", financialYear, managementBank, kpis: null, months: [], products: [], diagnostics: {} });
    if (managementBank !== "ALL" && (typeof managementBank !== "string" || !managementBank)) return freeze({ status: "INVALID_MANAGEMENT_BANK", financialYear, managementBank, kpis: null, months: [], products: [], diagnostics: {} });

    const premiumByBucket = emptyBuckets(); const rowsByBucket = emptyBuckets();
    const tenureMatrix = new Map(TENURE_ORDER.map((tenureClassification) => [tenureClassification, {
      tenureClassification, totalPremium: 0, rowCount: 0, premiums: emptyBuckets(), rowCounts: emptyBuckets(),
    }]));
    const tenureStatusCounts = { SUCCESS: 0, UNKNOWN: 0, INVALID: 0 };
    const tenureDiagnosticCounts = {};
    const monthMap = new Map(); const productMap = new Map();
    let invalidPremiumRows = 0; let selectedRows = 0; let totalPremium = 0; let unexpectedMetadataRows = 0; let unexpectedTenureMetadataRows = 0;
    source.forEach((fact) => {
      if (!fact || fact.financialYear !== financialYear) return;
      const resolved = authority.resolve(fact.bank);
      if (managementBank !== "ALL" && resolved.managementBank !== managementBank) return;
      if (typeof fact.premium !== "number" || !Number.isFinite(fact.premium)) { invalidPremiumRows += 1; return; }
      const bucket = bucketOf(fact);
      const tenureBucket = tenureBucketOf(fact);
      if (!["SUCCESS", "UNKNOWN", "INVALID"].includes(fact.premiumPortionStatus) ||
          (fact.premiumPortionStatus === "SUCCESS" && !["INITIAL_PORTION", "ADVANCE_PORTION"].includes(fact.premiumPortionClassification))) unexpectedMetadataRows += 1;
      selectedRows += 1; totalPremium += fact.premium; rowsByBucket[bucket] += 1; premiumByBucket[bucket] += fact.premium;
      const tenureRow = tenureMatrix.get(tenureBucket);
      tenureRow.totalPremium += fact.premium; tenureRow.rowCount += 1; tenureRow.premiums[bucket] += fact.premium; tenureRow.rowCounts[bucket] += 1;
      const effectiveTenureStatus = tenureBucket === "INVALID" ? "INVALID" : tenureBucket === "UNKNOWN" ? "UNKNOWN" : "SUCCESS";
      tenureStatusCounts[effectiveTenureStatus] += 1;
      const tenureMetadataAbsent = !Object.prototype.hasOwnProperty.call(fact, "policyTenureStatus") &&
        !Object.prototype.hasOwnProperty.call(fact, "policyTenureClassification");
      const tenureMetadataConsistent = tenureMetadataAbsent ||
        (effectiveTenureStatus === "SUCCESS" && fact.policyTenureStatus === "SUCCESS" && fact.policyTenureClassification === tenureBucket) ||
        (effectiveTenureStatus === "UNKNOWN" && fact.policyTenureStatus === "UNKNOWN" && fact.policyTenureClassification === "UNKNOWN") ||
        (effectiveTenureStatus === "INVALID" && fact.policyTenureStatus === "INVALID" && fact.policyTenureClassification === "INVALID");
      if (!tenureMetadataConsistent) {
        unexpectedTenureMetadataRows += 1;
        tenureDiagnosticCounts.TENURE_STATUS_CLASSIFICATION_INCONSISTENT = (tenureDiagnosticCounts.TENURE_STATUS_CLASSIFICATION_INCONSISTENT || 0) + 1;
      }
      [...(fact.coverageDateDiagnosticCodes || []), ...(fact.policyTenureDiagnosticCodes || [])].forEach((code) => {
        tenureDiagnosticCounts[code] = (tenureDiagnosticCounts[code] || 0) + 1;
      });
      const monthKey = /^\d{4}-\d{2}$/.test(fact.monthKey || "") ? fact.monthKey : "UNKNOWN";
      const month = monthMap.get(monthKey) || { periodKey: monthKey, totalPremium: 0, rowCount: 0, premiums: emptyBuckets(), rowCounts: emptyBuckets() };
      month.totalPremium += fact.premium; month.rowCount += 1; month.premiums[bucket] += fact.premium; month.rowCounts[bucket] += 1; monthMap.set(monthKey, month);
      const product = String(fact.productName || "").trim() || "Unknown Product";
      const productRow = productMap.get(product) || { product, totalPremium: 0, rowCount: 0, premiums: emptyBuckets(), rowCounts: emptyBuckets() };
      productRow.totalPremium += fact.premium; productRow.rowCount += 1; productRow.premiums[bucket] += fact.premium; productRow.rowCounts[bucket] += 1; productMap.set(product, productRow);
    });
    const bucketTotal = BUCKETS.reduce((sum, bucket) => sum + premiumByBucket[bucket], 0);
    const bucketRows = BUCKETS.reduce((sum, bucket) => sum + rowsByBucket[bucket], 0);
    const classifiedRows = rowsByBucket.INITIAL + rowsByBucket.ADVANCE;
    const tenureRows = [...tenureMatrix.values()];
    const tenurePremiumTotal = tenureRows.reduce((sum, row) => sum + row.totalPremium, 0);
    const tenureRowTotal = tenureRows.reduce((sum, row) => sum + row.rowCount, 0);
    const successfulTenureRows = TENURE_ORDER.slice(0, -2).reduce((sum, classification) => sum + tenureMatrix.get(classification).rowCount, 0);
    const months = [...monthMap.values()].sort((left, right) => left.periodKey === "UNKNOWN" ? 1 : right.periodKey === "UNKNOWN" ? -1 : left.periodKey.localeCompare(right.periodKey));
    const products = [...productMap.values()].sort((left, right) => left.product.localeCompare(right.product));
    return freeze({
      status: selectedRows ? (invalidPremiumRows ? "PARTIAL" : "READY") : "NO_DATA",
      financialYear, managementBank,
      kpis: {
        totalPremium, initialPremium: premiumByBucket.INITIAL, advancePremium: premiumByBucket.ADVANCE,
        unknownPremium: premiumByBucket.UNKNOWN, invalidPremium: premiumByBucket.INVALID,
        unclassifiedPremium: premiumByBucket.UNKNOWN + premiumByBucket.INVALID,
        transactionRows: selectedRows, classifiedRows,
        classifiedTransactionRowShare: selectedRows ? classifiedRows / selectedRows * 100 : 0,
      },
      premiumByBucket, rowsByBucket, months, products, tenureRows,
      reconciliation: { bucketPremiumTotal: bucketTotal, premiumDifference: totalPremium - bucketTotal, bucketRowTotal: bucketRows, rowDifference: selectedRows - bucketRows },
      tenureReadiness: {
        statusCounts: tenureStatusCounts, successfulTenureRows,
        successfulTenureRowShare: selectedRows ? successfulTenureRows / selectedRows * 100 : 0,
        diagnosticCounts: tenureDiagnosticCounts,
        reconciliation: { matrixPremiumTotal: tenurePremiumTotal, premiumDifference: reconciledDifference(totalPremium, tenurePremiumTotal), matrixRowTotal: tenureRowTotal, rowDifference: selectedRows - tenureRowTotal },
      },
      diagnostics: { acceptedFactRows: source.length, selectedRows, invalidPremiumRows, unexpectedMetadataRows, unexpectedTenureMetadataRows },
    });
  }

  global.BancaTrackerPremiumComposition = Object.freeze({ BUCKETS, TENURE_ORDER, bucketOf, tenureBucketOf, availableFinancialYears, availableManagementBanks, buildPremiumComposition });
})(typeof window !== "undefined" ? window : globalThis);
