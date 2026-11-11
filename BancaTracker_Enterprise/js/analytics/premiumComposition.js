(function (global) {
  "use strict";

  const BUCKETS = Object.freeze(["INITIAL", "ADVANCE", "UNKNOWN", "INVALID"]);
  const TENURE_ORDER = Object.freeze([
    "ANNUAL", "LONG_TERM_2_YEARS", "LONG_TERM_3_YEARS", "LONG_TERM_4_TO_5_YEARS",
    "LONG_TERM_OVER_5_YEARS", "SHORT_TERM", "NON_STANDARD_TERM", "UNKNOWN", "INVALID",
  ]);
  const emptyBuckets = () => ({ INITIAL: 0, ADVANCE: 0, UNKNOWN: 0, INVALID: 0 });
  const emptyEvidence = () => ({ VALID: { totalPremium: 0, rowCount: 0 }, MISSING: { totalPremium: 0, rowCount: 0 }, INVALID: { totalPremium: 0, rowCount: 0 } });
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

  function reportingDateStatus(value) {
    if (value === null || value === undefined || value === "") return { status: "MISSING_REPORTING_DATE", reportingDate: null, reportingMonth: null };
    if (typeof value !== "string" || !/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(value)) return { status: "INVALID_REPORTING_DATE", reportingDate: null, reportingMonth: null };
    const resolver = global.BancaTrackerDateResolver;
    let resolved = null;
    try { resolved = resolver && typeof resolver.resolve === "function" ? resolver.resolve(value) : null; } catch (error) { return { status: "DEPENDENCY_ERROR", reportingDate: null, reportingMonth: null, diagnosticCode: "REPORTING_DATE_AUTHORITY_ERROR" }; }
    if (!resolved || !resolved.success || resolved.policyIssuedDate !== value) return { status: "INVALID_REPORTING_DATE", reportingDate: null, reportingMonth: null };
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(resolved.monthKey || "") || resolved.monthKey !== value.slice(0, 7)) return { status: "DEPENDENCY_ERROR", reportingDate: value, reportingMonth: null, diagnosticCode: "REPORTING_MONTH_AUTHORITY_INCONSISTENT" };
    return { status: "READY", reportingDate: value, reportingMonth: resolved.monthKey };
  }

  function expiryDependencies() {
    const resolver = global.BancaTrackerDateResolver; const product = global.BancaTrackerCommercialDriverAnalysis; const tenure = global.BancaTrackerPolicyTenure;
    const missing = [];
    if (!resolver || typeof resolver.resolve !== "function" || typeof resolver.deriveFinancialYear !== "function") missing.push("EXPIRY_DATE_AUTHORITY_UNAVAILABLE");
    if (!product || typeof product.resolveProductIdentity !== "function") missing.push("EXPIRY_PRODUCT_IDENTITY_AUTHORITY_UNAVAILABLE");
    if (!tenure || typeof tenure.classifyPolicyTenure !== "function") missing.push("EXPIRY_BOUNDARY_AUTHORITY_UNAVAILABLE");
    return { ready: missing.length === 0, resolver, product, tenure, missing };
  }

  function expiryEvidenceOf(fact, resolver) {
    const diagnostics = Array.isArray(fact.coverageDateDiagnosticCodes) ? fact.coverageDateDiagnosticCodes : [];
    const end = fact.coverageEndDateNormalized;
    const endDiagnostics = diagnostics.filter((code) => code === "COVERAGE_END_BEFORE_START" || /^COVERAGE_END_/.test(code));
    const endInvalid = endDiagnostics.some((code) => code === "COVERAGE_END_BEFORE_START" || (!/_MISSING$/.test(code) && code !== "COVERAGE_END_HEADER_MISSING"));
    if (endInvalid || (end != null && end !== "" && endDiagnostics.length)) return { bucket: "INVALID", diagnosticCodes: [] };
    if (typeof end === "string" && /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(end)) {
      const resolved = resolver.resolve(end);
      if (!resolved || !resolved.success || resolved.policyIssuedDate !== end) return { bucket: "INVALID", diagnosticCodes: ["COVERAGE_END_CANONICAL_INVALID"] };
      const start = fact.coverageStartDateNormalized;
      if (typeof start === "string") {
        const startResolved = resolver.resolve(start);
        if (startResolved && startResolved.success && startResolved.policyIssuedDate === start && end < start) return { bucket: "INVALID", diagnosticCodes: ["COVERAGE_END_BEFORE_START_DERIVED"] };
      }
      return { bucket: "VALID", diagnosticCodes: [] };
    }
    const hasEndMetadata = Object.prototype.hasOwnProperty.call(fact, "coverageEndDateNormalized") ||
      Object.prototype.hasOwnProperty.call(fact, "coverageEndDateSourceHeader") || diagnostics.some((code) => /^COVERAGE_END_/.test(code));
    return { bucket: hasEndMetadata && end != null && end !== "" ? "INVALID" : "MISSING", diagnosticCodes: [] };
  }

  function validateNextBoundary(endDate, dependencies) {
    let boundary; let verification;
    try { boundary = dependencies.tenure.classifyPolicyTenure({ startDate: endDate, endDate, endDateConvention: "INCLUSIVE", leapDayAnniversaryConvention: "MAR_01" }); } catch (error) { return "NEXT_COVERAGE_BOUNDARY_AUTHORITY_ERROR"; }
    const exclusive = boundary && boundary.coverageEndExclusive;
    let resolved = null;
    try { resolved = typeof exclusive === "string" ? dependencies.resolver.resolve(exclusive) : null; } catch (error) { return "NEXT_COVERAGE_BOUNDARY_AUTHORITY_ERROR"; }
    try { verification = typeof exclusive === "string" ? dependencies.tenure.classifyPolicyTenure({ startDate: endDate, endDate: exclusive, endDateConvention: "EXCLUSIVE", leapDayAnniversaryConvention: "MAR_01" }) : null; } catch (error) { return "NEXT_COVERAGE_BOUNDARY_AUTHORITY_ERROR"; }
    if (!boundary || boundary.status !== "SUCCESS" || boundary.normalizedStartDate !== endDate || boundary.normalizedEndDate !== endDate || boundary.durationDays !== 1 ||
        !resolved || !resolved.success || resolved.policyIssuedDate !== exclusive || exclusive <= endDate || !verification || verification.status !== "SUCCESS" ||
        verification.normalizedStartDate !== endDate || verification.normalizedEndDate !== exclusive || verification.coverageEndExclusive !== exclusive || verification.durationDays !== 1) return "NEXT_COVERAGE_BOUNDARY_INVALID";
    return null;
  }

  function expiryFinancialYear(monthKey, resolver) {
    const parts = String(monthKey).split("-").map(Number);
    let financialYear;
    try { financialYear = resolver.deriveFinancialYear(parts[0], parts[1]); } catch (error) { return { financialYear: null, diagnosticCode: "EXPIRY_FINANCIAL_YEAR_AUTHORITY_ERROR" }; }
    if (!/^FY\d{4}-\d{2}$/.test(financialYear || "")) return { financialYear: null, diagnosticCode: "EXPIRY_FINANCIAL_YEAR_INVALID" };
    return { financialYear, diagnosticCode: null };
  }

  function timingBand(monthKey, reportingMonth) {
    if (!reportingMonth) return null;
    return monthKey < reportingMonth ? "PAST" : monthKey === reportingMonth ? "REPORTING_MONTH" : "FUTURE";
  }

  function buildPremiumComposition(facts, options = {}) {
    const source = Array.isArray(facts) ? facts : [];
    const financialYear = options.financialYear || null;
    const managementBank = options.managementBank || "ALL";
    const reporting = reportingDateStatus(options.reportingDate);
    const expiryDependency = expiryDependencies();
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
    const expiryEvidence = emptyEvidence(); const expiryMonthMap = new Map(); const expiryDiagnosticCounts = {};
    if (reporting.diagnosticCode) expiryDiagnosticCounts[reporting.diagnosticCode] = 1;
    let expiryDependencyError = false;
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
      [...(Array.isArray(fact.coverageDateDiagnosticCodes) ? fact.coverageDateDiagnosticCodes : []), ...(Array.isArray(fact.policyTenureDiagnosticCodes) ? fact.policyTenureDiagnosticCodes : [])].forEach((code) => {
        tenureDiagnosticCounts[code] = (tenureDiagnosticCounts[code] || 0) + 1;
      });
      const monthKey = /^\d{4}-\d{2}$/.test(fact.monthKey || "") ? fact.monthKey : "UNKNOWN";
      const month = monthMap.get(monthKey) || { periodKey: monthKey, totalPremium: 0, rowCount: 0, premiums: emptyBuckets(), rowCounts: emptyBuckets() };
      month.totalPremium += fact.premium; month.rowCount += 1; month.premiums[bucket] += fact.premium; month.rowCounts[bucket] += 1; monthMap.set(monthKey, month);
      const product = String(fact.productName || "").trim() || "Unknown Product";
      const productRow = productMap.get(product) || { product, totalPremium: 0, rowCount: 0, premiums: emptyBuckets(), rowCounts: emptyBuckets() };
      productRow.totalPremium += fact.premium; productRow.rowCount += 1; productRow.premiums[bucket] += fact.premium; productRow.rowCounts[bucket] += 1; productMap.set(product, productRow);

      if (!expiryDependency.ready) return;
      if (fact.coverageDateDiagnosticCodes != null && !Array.isArray(fact.coverageDateDiagnosticCodes)) expiryDiagnosticCounts.COVERAGE_DATE_DIAGNOSTICS_MALFORMED = (expiryDiagnosticCounts.COVERAGE_DATE_DIAGNOSTICS_MALFORMED || 0) + 1;
      let evidenceResult;
      try { evidenceResult = expiryEvidenceOf(fact, expiryDependency.resolver); } catch (error) { evidenceResult = { bucket: "INVALID", diagnosticCodes: ["EXPIRY_DATE_AUTHORITY_ERROR"] }; expiryDependencyError = true; }
      const evidence = evidenceResult.bucket;
      expiryEvidence[evidence].totalPremium += fact.premium; expiryEvidence[evidence].rowCount += 1;
      (Array.isArray(fact.coverageDateDiagnosticCodes) ? fact.coverageDateDiagnosticCodes : []).forEach((code) => { expiryDiagnosticCounts[code] = (expiryDiagnosticCounts[code] || 0) + 1; });
      evidenceResult.diagnosticCodes.forEach((code) => { expiryDiagnosticCounts[code] = (expiryDiagnosticCounts[code] || 0) + 1; });
      if (evidence === "VALID") {
        const expiryMonth = fact.coverageEndDateNormalized.slice(0, 7);
        let cohort = expiryMonthMap.get(expiryMonth);
        if (!cohort) {
          const financialYearResult = expiryFinancialYear(expiryMonth, expiryDependency.resolver);
          if (financialYearResult.diagnosticCode) { expiryDiagnosticCounts[financialYearResult.diagnosticCode] = (expiryDiagnosticCounts[financialYearResult.diagnosticCode] || 0) + 1; expiryDependencyError = true; }
          cohort = { expiryMonth, expiryFinancialYear: financialYearResult.financialYear, timingBand: timingBand(expiryMonth, reporting.reportingMonth),
            totalPremium: 0, rowCount: 0, premiums: emptyBuckets(), rowCounts: emptyBuckets(), tenureMap: new Map(), productMap: new Map() };
        }
        cohort.totalPremium += fact.premium; cohort.rowCount += 1; cohort.premiums[bucket] += fact.premium; cohort.rowCounts[bucket] += 1;
        const expiryTenure = cohort.tenureMap.get(tenureBucket) || { tenureClassification: tenureBucket, totalPremium: 0, rowCount: 0 };
        expiryTenure.totalPremium += fact.premium; expiryTenure.rowCount += 1; cohort.tenureMap.set(tenureBucket, expiryTenure);
        try {
          const identity = expiryDependency.product.resolveProductIdentity(fact);
          if (!identity || typeof identity.key !== "string" || typeof identity.label !== "string" || !Array.isArray(identity.diagnostics)) throw new TypeError("PRODUCT_IDENTITY_INVALID");
          identity.diagnostics.forEach((item) => { expiryDiagnosticCounts[item.code] = (expiryDiagnosticCounts[item.code] || 0) + 1; });
          const expiryProduct = cohort.productMap.get(identity.key) || { productKey: identity.key, productLabel: identity.label, totalPremium: 0, rowCount: 0, names: new Set() };
          expiryProduct.totalPremium += fact.premium; expiryProduct.rowCount += 1; if (identity.name) expiryProduct.names.add(identity.name); cohort.productMap.set(identity.key, expiryProduct);
        } catch (error) { expiryDiagnosticCounts.EXPIRY_PRODUCT_IDENTITY_ERROR = (expiryDiagnosticCounts.EXPIRY_PRODUCT_IDENTITY_ERROR || 0) + 1; expiryDependencyError = true; }
        const boundaryDiagnostic = validateNextBoundary(fact.coverageEndDateNormalized, expiryDependency);
        if (boundaryDiagnostic) { expiryDiagnosticCounts[boundaryDiagnostic] = (expiryDiagnosticCounts[boundaryDiagnostic] || 0) + 1; expiryDependencyError = true; }
        else cohort.nextBoundaryValidatedRows = (cohort.nextBoundaryValidatedRows || 0) + 1;
        expiryMonthMap.set(expiryMonth, cohort);
      }
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
    const expiryMonths = [...expiryMonthMap.values()].sort((left, right) => left.expiryMonth.localeCompare(right.expiryMonth)).map((cohort) => {
      const tenureSubtotals = [...cohort.tenureMap.values()].sort((left, right) => TENURE_ORDER.indexOf(left.tenureClassification) - TENURE_ORDER.indexOf(right.tenureClassification));
      const productSubtotals = [...cohort.productMap.values()].map((row) => {
        if (row.productKey.startsWith("PRODUCT_CODE:") && row.names.size > 1) { row.productLabel = row.productKey.slice("PRODUCT_CODE:".length); expiryDiagnosticCounts.PRODUCT_CODE_NAME_CONFLICT = (expiryDiagnosticCounts.PRODUCT_CODE_NAME_CONFLICT || 0) + 1; }
        return { productKey: row.productKey, productLabel: row.productLabel, totalPremium: row.totalPremium, rowCount: row.rowCount };
      }).sort((left, right) => left.productKey.localeCompare(right.productKey));
      const portionPremium = BUCKETS.reduce((sum, bucket) => sum + cohort.premiums[bucket], 0); const portionRows = BUCKETS.reduce((sum, bucket) => sum + cohort.rowCounts[bucket], 0);
      const tenurePremium = tenureSubtotals.reduce((sum, row) => sum + row.totalPremium, 0); const tenureRows = tenureSubtotals.reduce((sum, row) => sum + row.rowCount, 0);
      const productPremium = productSubtotals.reduce((sum, row) => sum + row.totalPremium, 0); const productRows = productSubtotals.reduce((sum, row) => sum + row.rowCount, 0);
      return { expiryMonth: cohort.expiryMonth, expiryFinancialYear: cohort.expiryFinancialYear, timingBand: cohort.timingBand, totalPremium: cohort.totalPremium, rowCount: cohort.rowCount, premiums: cohort.premiums, rowCounts: cohort.rowCounts, tenureSubtotals, productSubtotals, nextBoundaryValidatedRows: cohort.nextBoundaryValidatedRows || 0,
        reconciliation: { portionPremiumDifference: reconciledDifference(cohort.totalPremium, portionPremium), portionRowDifference: cohort.rowCount - portionRows, tenurePremiumDifference: reconciledDifference(cohort.totalPremium, tenurePremium), tenureRowDifference: cohort.rowCount - tenureRows, productPremiumDifference: reconciledDifference(cohort.totalPremium, productPremium), productRowDifference: cohort.rowCount - productRows } };
    });
    const expiryMonthPremium = expiryMonths.reduce((sum, row) => sum + row.totalPremium, 0); const expiryMonthRows = expiryMonths.reduce((sum, row) => sum + row.rowCount, 0);
    const evidencePremium = Object.values(expiryEvidence).reduce((sum, row) => sum + row.totalPremium, 0); const evidenceRows = Object.values(expiryEvidence).reduce((sum, row) => sum + row.rowCount, 0);
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
      expiry: {
        status: !expiryDependency.ready ? "DEPENDENCY_UNAVAILABLE" : expiryDependencyError || reporting.status === "DEPENDENCY_ERROR" ? "DEPENDENCY_ERROR" : reporting.status, reportingDate: reporting.reportingDate, evidence: expiryEvidence, months: expiryMonths,
        diagnosticCounts: expiryDependency.missing.reduce((counts, code) => { counts[code] = 1; return counts; }, expiryDiagnosticCounts),
        reconciliation: {
          evidencePremiumDifference: reconciledDifference(totalPremium, evidencePremium), evidenceRowDifference: selectedRows - evidenceRows,
          validMonthPremiumDifference: reconciledDifference(expiryEvidence.VALID.totalPremium, expiryMonthPremium), validMonthRowDifference: expiryEvidence.VALID.rowCount - expiryMonthRows,
        },
      },
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
