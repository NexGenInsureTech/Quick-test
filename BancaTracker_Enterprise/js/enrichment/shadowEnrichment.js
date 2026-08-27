/*==============================================================
BancaTracker Enterprise
Version : 8.2.0-dev
File    : shadowEnrichment.js
Module  : Enrichment Foundation
Purpose : Run fail-safe canonical enrichment beside authoritative v8.1 data
==============================================================*/

(function () {
  "use strict";

  const dependencies = [
    "BancaTrackerDatasetRegistry",
    "BancaTrackerGeographyResolver",
    "BancaTrackerBranchResolver",
    "BancaTrackerAssignmentResolver",
    "BancaTrackerHierarchyResolver",
    "BancaTrackerEnrichmentPipeline",
  ];

  dependencies.forEach((dependency) => {
    if (!window[dependency]) {
      throw new Error(`${dependency} must be loaded before shadowEnrichment.js`);
    }
  });

  const Registry = window.BancaTrackerDatasetRegistry;
  const { DATASET_TYPES, ROW_STATUS, DATA_QUALITY_SEVERITY } = Registry;

  let runSequence = 0;
  let lastResult = Object.freeze({ status: "NOT_RUN" });

  function nowIso() {
    return new Date().toISOString();
  }

  function adaptRecord(row) {
    return {
      policyNumber: row.policyNumber || null,
      policyIssuedDate: row.policyIssuedDate || null,
      premium: row.premium,
      bankId: row.bankId || row.bank || null,
      bankName: row.bankName || row.bank || null,
      branchCode: row.branchCode || row.baCode || null,
      branchName: row.branchName || row.branch || null,
      state: row.state || null,
      zone: row.zone || null,
      rmId: row.rmId || null,
      rmName: row.rmName || row.rm || null,
      productCode: row.productCode || null,
      productName: row.productName || null,
      lob: row.lob || null,
      month: Object.prototype.hasOwnProperty.call(row, "legacyMonth")
        ? row.legacyMonth
        : row.month || null,
      day: Object.prototype.hasOwnProperty.call(row, "legacyDay")
        ? row.legacyDay
        : row.day || null,
    };
  }

  function adaptRecords(records) {
    return records.map(adaptRecord);
  }

  function premiumMetrics(values) {
    return values.reduce(
      (metrics, value) => {
        metrics.totalPremium += value;

        if (value > 0) metrics.positiveCount += 1;
        else if (value < 0) metrics.negativeCount += 1;
        else metrics.zeroCount += 1;

        return metrics;
      },
      { totalPremium: 0, positiveCount: 0, zeroCount: 0, negativeCount: 0 },
    );
  }

  function bankPremium(records, valueSelector, bankSelector) {
    const totals = {};

    records.forEach((record) => {
      const bank = bankSelector(record) || "Unknown";
      totals[bank] = (totals[bank] || 0) + valueSelector(record);
    });

    return Object.fromEntries(
      Object.entries(totals).sort(([left], [right]) =>
        left.localeCompare(right),
      ),
    );
  }

  function valuesEqual(left, right) {
    return JSON.stringify(left) === JSON.stringify(right);
  }

  function buildReconciliation(sourceRecords, canonicalResults) {
    const validResults = canonicalResults.filter(
      (result) => result.status !== ROW_STATUS.INVALID,
    );
    const sourcePremium = premiumMetrics(
      sourceRecords.map((record) => Number(record.premium)),
    );
    const canonicalPremium = premiumMetrics(
      validResults.map((result) => result.transaction.premium),
    );
    const invalidCount = canonicalResults.length - validResults.length;
    const comparisons = {
      sourceRecordCount: {
        source: sourceRecords.length,
        canonical: validResults.length,
      },
      totalPremium: {
        source: sourcePremium.totalPremium,
        canonical: canonicalPremium.totalPremium,
      },
      positiveCount: {
        source: sourcePremium.positiveCount,
        canonical: canonicalPremium.positiveCount,
      },
      zeroCount: {
        source: sourcePremium.zeroCount,
        canonical: canonicalPremium.zeroCount,
      },
      negativeCount: {
        source: sourcePremium.negativeCount,
        canonical: canonicalPremium.negativeCount,
      },
      bankPremium: {
        source: bankPremium(
          sourceRecords,
          (record) => Number(record.premium),
          (record) => record.bankId || record.bank,
        ),
        canonical: bankPremium(
          validResults,
          (result) => result.transaction.premium,
          (result) => result.transaction.bankId,
        ),
      },
    };
    let unexplainedDifferences = 0;

    Object.values(comparisons).forEach((comparison) => {
      comparison.matches = valuesEqual(comparison.source, comparison.canonical);
      comparison.expected = !comparison.matches && invalidCount > 0;

      if (!comparison.matches && !comparison.expected) {
        unexplainedDifferences += 1;
      }
    });

    return {
      ...comparisons,
      unexplainedDifferences,
    };
  }

  function buildMaps(records) {
    return {
      geographyMaps: records.geography.length
        ? window.BancaTrackerGeographyResolver.buildLookupMaps(
            records.geography,
          )
        : null,
      branchMaps: records.branch.length
        ? window.BancaTrackerBranchResolver.buildLookupMaps(records.branch)
        : null,
      assignmentMaps: records.assignment.length
        ? window.BancaTrackerAssignmentResolver.buildLookupMaps(
            records.assignment,
          )
        : null,
      hierarchyMaps:
        records.employee.length && records.hierarchy.length
          ? window.BancaTrackerHierarchyResolver.buildLookupMaps(
              records.employee,
              records.hierarchy,
            )
          : null,
    };
  }

  async function buildContext(options = {}) {
    if (Object.prototype.hasOwnProperty.call(options, "context")) {
      return {
        context: options.context || {},
        masterStatus: options.masterStatus || {
          geography: "ABSENT",
          branch: "ABSENT",
          employee: "ABSENT",
          hierarchy: "ABSENT",
          assignment: "ABSENT",
        },
      };
    }

    const repository = options.repository || window.BancaTrackerRepository;

    if (!repository) {
      throw new Error("BancaTrackerRepository is unavailable.");
    }

    const [geography, branch, employee, hierarchy, assignment] =
      await Promise.all([
        repository.getActiveMasterRecords(DATASET_TYPES.GEOGRAPHY_MASTER),
        repository.getActiveMasterRecords(DATASET_TYPES.BRANCH_MASTER),
        repository.getActiveMasterRecords(DATASET_TYPES.EMPLOYEE_MASTER),
        repository.getActiveMasterRecords(DATASET_TYPES.HIERARCHY),
        repository.getActiveMasterRecords(DATASET_TYPES.BRANCH_ASSIGNMENT),
      ]);
    const records = { geography, branch, employee, hierarchy, assignment };

    return {
      context: buildMaps(records),
      masterStatus: Object.fromEntries(
        Object.entries(records).map(([name, values]) => [
          name,
          values.length ? "ACTIVE" : "ABSENT",
        ]),
      ),
    };
  }

  function buildSummary(canonicalResults) {
    let warningCount = 0;
    let invalidCount = 0;

    canonicalResults.forEach((result) => {
      if (result.status === ROW_STATUS.INVALID) invalidCount += 1;

      warningCount += result.findings.filter(
        (finding) => finding.severity === DATA_QUALITY_SEVERITY.WARNING,
      ).length;
    });

    return {
      warningCount,
      invalidCount,
    };
  }

  function buildDateAuthoritySummary(records) {
    return records.reduce(
      (summary, record) => {
        if (record.dateAuthority === "CANONICAL") summary.canonical += 1;
        else if (record.dateAuthority === "LEGACY_FALLBACK") summary.legacyFallback += 1;
        else if (record.dateAuthority === "INVALID") summary.invalid += 1;
        else summary.unspecified += 1;
        return summary;
      },
      { canonical: 0, legacyFallback: 0, invalid: 0, unspecified: 0 },
    );
  }

  async function run(records, options = {}) {
    const runId = ++runSequence;
    const startedAt = nowIso();

    try {
      if (!Array.isArray(records)) {
        throw new TypeError("Shadow enrichment records must be an array.");
      }

      if (typeof options.beforeEnrich === "function") {
        await options.beforeEnrich(runId);
      }

      const preparedContext = await buildContext(options);
      const canonicalInputs = adaptRecords(records);
      const pipeline = options.pipeline || window.BancaTrackerEnrichmentPipeline;
      const canonicalResults = pipeline.enrichTransactions(
        canonicalInputs,
        preparedContext.context,
      );
      const summary = buildSummary(canonicalResults);
      const reconciliation = buildReconciliation(records, canonicalResults);
      const status =
        summary.warningCount ||
        summary.invalidCount ||
        reconciliation.unexplainedDifferences
          ? "PARTIAL"
          : "READY";
      const result = Object.freeze({
        runId,
        status,
        startedAt,
        completedAt: nowIso(),
        sourceRecordCount: records.length,
        canonicalRecordCount: canonicalResults.length,
        invalidRecordCount: summary.invalidCount,
        canonicalResults,
        masterStatus: preparedContext.masterStatus,
        reconciliation,
        summary,
        dateAuthoritySummary: buildDateAuthoritySummary(records),
        error: null,
      });

      if (runId === runSequence) {
        lastResult = result;
      }

      return result;
    } catch (error) {
      const result = Object.freeze({
        runId,
        status: "FAILED",
        startedAt,
        completedAt: nowIso(),
        sourceRecordCount: Array.isArray(records) ? records.length : 0,
        canonicalRecordCount: 0,
        invalidRecordCount: 0,
        canonicalResults: [],
        masterStatus: null,
        reconciliation: null,
        summary: { warningCount: 0, invalidCount: 0 },
        dateAuthoritySummary: buildDateAuthoritySummary(
          Array.isArray(records) ? records : [],
        ),
        error: {
          name: error.name || "Error",
          message: error.message || String(error),
        },
      });

      if (runId === runSequence) {
        lastResult = result;
      }

      return result;
    }
  }

  function getLastResult() {
    return lastResult;
  }

  function clear() {
    runSequence += 1;
    lastResult = Object.freeze({ status: "NOT_RUN" });
    return lastResult;
  }

  window.BancaTrackerShadowEnrichment = Object.freeze({
    run,
    getLastResult,
    clear,
    adaptRecord,
    adaptRecords,
    buildContext,
    buildReconciliation,
    buildSummary,
    buildDateAuthoritySummary,
  });
})();
