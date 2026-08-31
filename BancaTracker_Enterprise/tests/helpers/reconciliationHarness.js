"use strict";

const CLASSIFICATION = Object.freeze({
  MATCH: "MATCH",
  EXPECTED_DIFFERENCE: "EXPECTED_DIFFERENCE",
  UNEXPLAINED_DIFFERENCE: "UNEXPLAINED_DIFFERENCE",
});

const PERCENT_TOLERANCE = 1e-9;

function increment(target, key, value) {
  const normalizedKey = key || "Unknown";
  target[normalizedKey] = (target[normalizedKey] || 0) + value;
}

function sortedUnique(values) {
  return [...new Set(values.filter(Boolean))].sort();
}

function sortedObject(value) {
  return Object.fromEntries(
    Object.entries(value).sort(([left], [right]) => left.localeCompare(right)),
  );
}

function buildMetrics(records, options) {
  const configuredBanks = new Set(options.configuredBanks || []);
  const fiscalMonths = options.fiscalMonths || [];
  const metrics = {
    totalPremium: 0,
    positivePremiumRecords: 0,
    zeroPremiumRecords: 0,
    negativePremiumRecords: 0,
    analyticalRecordCount: records.length,
    bankPopulation: sortedUnique(records.map((record) => record.bank)),
    knownBankPremium: 0,
    unknownBankPremium: 0,
    monthPopulation: sortedUnique(records.map((record) => record.month)),
    dayPopulation: sortedUnique(records.map((record) => String(record.day))),
    zonePopulation: sortedUnique(records.map((record) => record.zone)),
    branchPopulation: sortedUnique(records.map((record) => record.branchKey)),
    bankPremium: {},
    bankContributionPercent: {},
    lobPremium: {},
    productPremium: {},
    sourceRmPopulation: sortedUnique(records.map((record) => record.sourceRmId)),
    sourceBranchCodePopulation: sortedUnique(
      records.map((record) => record.sourceBranchCode),
    ),
  };

  records.forEach((record) => {
    metrics.totalPremium += record.premium;

    if (record.premium > 0) metrics.positivePremiumRecords += 1;
    else if (record.premium < 0) metrics.negativePremiumRecords += 1;
    else metrics.zeroPremiumRecords += 1;

    if (configuredBanks.has(record.bank)) {
      metrics.knownBankPremium += record.premium;
    } else {
      metrics.unknownBankPremium += record.premium;
    }

    increment(metrics.bankPremium, record.bank, record.premium);
    increment(metrics.lobPremium, record.lob, record.premium);
    increment(metrics.productPremium, record.productCode, record.premium);
  });

  const availableFiscalMonths = fiscalMonths.filter((month) =>
    metrics.monthPopulation.includes(month),
  );
  metrics.currentPeriodMonth =
    availableFiscalMonths[availableFiscalMonths.length - 1] || null;
  metrics.currentPeriodPremium = records
    .filter((record) => record.month === metrics.currentPeriodMonth)
    .reduce((sum, record) => sum + record.premium, 0);

  Object.entries(metrics.bankPremium).forEach(([bank, premium]) => {
    metrics.bankContributionPercent[bank] =
      metrics.totalPremium > 0 ? (premium / metrics.totalPremium) * 100 : 0;
  });

  metrics.bankPremium = sortedObject(metrics.bankPremium);
  metrics.bankContributionPercent = sortedObject(
    metrics.bankContributionPercent,
  );
  metrics.lobPremium = sortedObject(metrics.lobPremium);
  metrics.productPremium = sortedObject(metrics.productPremium);

  return metrics;
}

function buildLegacyView(rows, options) {
  const records = rows.map((row) => ({
    premium: Number(row.premium),
    bank: row.bankId || "Unknown",
    month: row.month,
    day: row.day,
    zone: row.zone,
    branchKey: `${row.bankId || "Unknown"}:${row.branchCode || "Unknown"}`,
    sourceBranchCode: row.branchCode,
    sourceRmId: row.rmId,
    lob: row.lob,
    productCode: row.productCode,
  }));

  return {
    records,
    metrics: buildMetrics(records, options),
  };
}

function buildCanonicalView(rows, enrichedResults, options) {
  const records = [];

  enrichedResults.forEach((result, index) => {
    if (result.status === "INVALID") {
      return;
    }

    const transaction = result.transaction;
    const sourceRow = rows[index];
    records.push({
      premium: transaction.premium,
      bank: transaction.bankId || "Unknown",
      month: transaction.monthLabel,
      day: transaction.day,
      zone: transaction.zoneName,
      branchKey:
        transaction.branchId ||
        `UNMAPPED:${transaction.bankId || "Unknown"}:${transaction.branchCode || "Unknown"}`,
      sourceBranchCode: sourceRow.branchCode,
      sourceRmId: transaction.sourceRmId,
      lob: transaction.lob,
      productCode: transaction.productCode,
    });
  });

  return {
    records,
    metrics: buildMetrics(records, options),
  };
}

function buildExpectedDifferenceRegistry(rows, enrichedResults) {
  const registry = [];

  function add(index, reasonCode, affectedMetrics, legacyValue, canonicalValue) {
    registry.push({
      sourceRow: index + 1,
      policyNumber: rows[index].policyNumber || null,
      reasonCode,
      affectedMetrics,
      legacyValue,
      canonicalValue,
    });
  }

  enrichedResults.forEach((result, index) => {
    const row = rows[index];
    const transaction = result.transaction;
    const findingCodes = new Set(result.findings.map((finding) => finding.code));

    if (findingCodes.has("LEGACY_MONTH_MISMATCH")) {
      add(
        index,
        "LEGACY_MONTH_MISMATCH",
        ["monthPopulation", "currentPeriodMonth", "currentPeriodPremium"],
        row.month,
        transaction.monthLabel,
      );
    }

    if (findingCodes.has("LEGACY_DAY_MISMATCH")) {
      add(
        index,
        "LEGACY_DAY_MISMATCH",
        ["dayPopulation"],
        row.day,
        transaction.day,
      );
    }

    if (findingCodes.has("LEGACY_ZONE_MISMATCH")) {
      add(
        index,
        "LEGACY_ZONE_MISMATCH",
        ["zonePopulation"],
        row.zone,
        transaction.zoneName,
      );
    }

    if (result.resolution.branch.status === "MATCHED_FALLBACK") {
      add(
        index,
        "BRANCH_MATCHED_FALLBACK",
        ["branchPopulation"],
        `${row.bankId || "Unknown"}:${row.branchCode || "Unknown"}`,
        transaction.branchId,
      );
    }

    if (result.resolution.branch.status === "UNMAPPED") {
      add(
        index,
        "BRANCH_UNMAPPED",
        ["branchPopulation"],
        `${row.bankId || "Unknown"}:${row.branchCode || "Unknown"}`,
        transaction.branchId,
      );
    }
  });

  return registry;
}

function numbersEqual(left, right, tolerance) {
  return Math.abs(left - right) <= tolerance;
}

function valuesEqual(metric, legacyValue, canonicalValue) {
  if (metric === "bankContributionPercent") {
    const keys = sortedUnique([
      ...Object.keys(legacyValue),
      ...Object.keys(canonicalValue),
    ]);

    return keys.every((key) =>
      numbersEqual(
        legacyValue[key] || 0,
        canonicalValue[key] || 0,
        PERCENT_TOLERANCE,
      ),
    );
  }

  if (typeof legacyValue === "number" && typeof canonicalValue === "number") {
    return legacyValue === canonicalValue;
  }

  return JSON.stringify(legacyValue) === JSON.stringify(canonicalValue);
}

function reconcile(rows, enrichedResults, options) {
  const legacy = buildLegacyView(rows, options);
  const canonical = buildCanonicalView(rows, enrichedResults, options);
  const expectedDifferences = buildExpectedDifferenceRegistry(
    rows,
    enrichedResults,
  );
  const comparisons = [];

  Object.keys(legacy.metrics).forEach((metric) => {
    const legacyValue = legacy.metrics[metric];
    const canonicalValue = canonical.metrics[metric];
    const reasons = expectedDifferences.filter((difference) =>
      difference.affectedMetrics.includes(metric),
    );
    const classification = valuesEqual(metric, legacyValue, canonicalValue)
      ? CLASSIFICATION.MATCH
      : reasons.length
        ? CLASSIFICATION.EXPECTED_DIFFERENCE
        : CLASSIFICATION.UNEXPLAINED_DIFFERENCE;

    comparisons.push({
      metric,
      legacyValue,
      canonicalValue,
      classification,
      reasons: reasons.map((reason) => reason.reasonCode),
    });
  });

  const unexplainedDifferences = comparisons.filter(
    (comparison) =>
      comparison.classification === CLASSIFICATION.UNEXPLAINED_DIFFERENCE,
  );
  const summary = {
    matches: comparisons.filter(
      (comparison) => comparison.classification === CLASSIFICATION.MATCH,
    ).length,
    expectedDifferences: comparisons.filter(
      (comparison) =>
        comparison.classification === CLASSIFICATION.EXPECTED_DIFFERENCE,
    ).length,
    unexplainedDifferences: unexplainedDifferences.length,
    passed: unexplainedDifferences.length === 0,
  };

  return {
    summary,
    comparisons,
    expectedDifferences,
    unexplainedDifferences,
    legacy,
    canonical,
  };
}

module.exports = Object.freeze({
  CLASSIFICATION,
  PERCENT_TOLERANCE,
  buildLegacyView,
  buildCanonicalView,
  buildExpectedDifferenceRegistry,
  reconcile,
});
