/*==============================================================
BancaTracker Enterprise
Version : 8.2.0-dev
File    : readinessDiagnostics.js
Module  : Enrichment Foundation
Purpose : Build in-memory readiness diagnostics from shadow enrichment
==============================================================*/

(function () {
  "use strict";

  const MASTER_NAMES = Object.freeze([
    "geography",
    "branch",
    "employee",
    "hierarchy",
    "assignment",
  ]);

  const MASTER_WARNING_CODES = Object.freeze({
    geography: "GEOGRAPHY_MASTER_ABSENT",
    branch: "BRANCH_MASTER_ABSENT",
    employee: "EMPLOYEE_MASTER_ABSENT",
    hierarchy: "HIERARCHY_MASTER_ABSENT",
    assignment: "ASSIGNMENT_MASTER_ABSENT",
  });

  function metric(numerator, denominator) {
    return {
      numerator,
      denominator,
      percentage: denominator ? (numerator / denominator) * 100 : 0,
    };
  }

  function diagnostic(code, count = null) {
    return count === null ? { code } : { code, count };
  }

  function normalizeMaster(value) {
    const metadata = value && typeof value === "object" ? value : {};
    const status = typeof value === "string" ? value : metadata.status || "ABSENT";

    return {
      configured: status === "ACTIVE",
      status,
      datasetId: metadata.datasetId || null,
      recordCount: Number.isFinite(metadata.recordCount)
        ? metadata.recordCount
        : null,
    };
  }

  function emptyResolution() {
    return {
      branch: { exact: 0, fallback: 0, unmapped: 0, ambiguous: 0, masterAbsent: 0 },
      geography: { resolved: 0, unmapped: 0, ambiguous: 0, masterAbsent: 0 },
      assignment: { resolved: 0, unmapped: 0, ambiguous: 0, masterAbsent: 0 },
      hierarchy: { resolved: 0, partial: 0, unresolved: 0, masterAbsent: 0 },
    };
  }

  function buildReadiness(shadowResult) {
    if (!shadowResult || shadowResult.status === "NOT_RUN") {
      return {
        overallStatus: "NOT_RUN",
        branchUniverse: null,
        branchUniverseAuthority: global.BancaTrackerLiveBranchUniverseAuthority
          ? global.BancaTrackerLiveBranchUniverseAuthority.getUniverse()
          : null,
        branchCommercial: global.BancaTrackerLiveBranchCommercialAuthority
          ? global.BancaTrackerLiveBranchCommercialAuthority.getCachedContext()
          : null,
        masters: {},
        records: { source: 0, canonical: 0, ready: 0, readyWithWarnings: 0, invalid: 0 },
        resolution: emptyResolution(),
        comparisons: {
          legacyMonthMismatch: 0,
          legacyDayMismatch: 0,
          legacyZoneMismatch: 0,
          sourceAssignedRmMismatch: 0,
        },
        reconciliation: { unexplainedDifferences: 0 },
        readiness: {
          dateReadyPct: metric(0, 0),
          branchExactPct: metric(0, 0),
          branchResolvedPct: metric(0, 0),
          geographyResolvedPct: metric(0, 0),
          assignmentResolvedPct: metric(0, 0),
          hierarchyResolvedPct: metric(0, 0),
        },
        blockers: [],
        warnings: [],
      };
    }

    const masterStatus = shadowResult.masterStatus || {};
    const masters = Object.fromEntries(
      MASTER_NAMES.map((name) => [name, normalizeMaster(masterStatus[name])]),
    );
    const canonicalResults = Array.isArray(shadowResult.canonicalResults)
      ? shadowResult.canonicalResults
      : [];
    const resolution = emptyResolution();
    const comparisons = {
      legacyMonthMismatch: 0,
      legacyDayMismatch: 0,
      legacyZoneMismatch: 0,
      sourceAssignedRmMismatch: 0,
    };
    const records = {
      source: Number(shadowResult.sourceRecordCount) || 0,
      canonical: canonicalResults.length,
      ready: 0,
      readyWithWarnings: 0,
      invalid: 0,
    };
    let dateReady = 0;
    let eligibleRows = 0;
    let branchResolvedEligible = 0;
    let assignmentResolvedEligible = 0;

    canonicalResults.forEach((result) => {
      const rowStatus = result.status;
      if (rowStatus === "READY") records.ready += 1;
      else if (rowStatus === "READY_WITH_WARNINGS") records.readyWithWarnings += 1;
      else if (rowStatus === "INVALID") records.invalid += 1;

      if (result.resolution && result.resolution.date && result.resolution.date.success) {
        dateReady += 1;
      }

      const rowComparisons = result.comparisons || {};
      if (rowComparisons.legacyMonth === "MISMATCH") comparisons.legacyMonthMismatch += 1;
      if (rowComparisons.legacyDay === "MISMATCH") comparisons.legacyDayMismatch += 1;
      if (rowComparisons.legacyZone === "MISMATCH") comparisons.legacyZoneMismatch += 1;
      if (rowComparisons.sourceVsAssignedRm === "MISMATCH") comparisons.sourceAssignedRmMismatch += 1;

      if (rowStatus === "INVALID") return;
      eligibleRows += 1;

      const rowResolution = result.resolution || {};
      const branchStatus = rowResolution.branch && rowResolution.branch.status;
      if (branchStatus === "MATCHED_EXACT") resolution.branch.exact += 1;
      else if (branchStatus === "MATCHED_FALLBACK") resolution.branch.fallback += 1;
      else if (branchStatus === "AMBIGUOUS") resolution.branch.ambiguous += 1;
      else if (branchStatus === "MASTER_ABSENT") resolution.branch.masterAbsent += 1;
      else resolution.branch.unmapped += 1;

      const branchResolved = branchStatus === "MATCHED_EXACT" || branchStatus === "MATCHED_FALLBACK";
      if (branchResolved) branchResolvedEligible += 1;

      const geographyStatus = rowResolution.geography && rowResolution.geography.status;
      if (["MATCHED_ID", "MATCHED_CODE", "MATCHED_NAME", "MATCHED_ALIAS"].includes(geographyStatus)) {
        resolution.geography.resolved += 1;
      } else if (geographyStatus === "AMBIGUOUS") resolution.geography.ambiguous += 1;
      else if (geographyStatus === "MASTER_ABSENT") resolution.geography.masterAbsent += 1;
      else resolution.geography.unmapped += 1;

      if (branchResolved) {
        const assignmentStatus = rowResolution.assignment && rowResolution.assignment.status;
        if (assignmentStatus === "RESOLVED") {
          resolution.assignment.resolved += 1;
          assignmentResolvedEligible += 1;
        } else if (assignmentStatus === "AMBIGUOUS") resolution.assignment.ambiguous += 1;
        else if (assignmentStatus === "MASTER_ABSENT") resolution.assignment.masterAbsent += 1;
        else resolution.assignment.unmapped += 1;
      }

      if (rowResolution.assignment && rowResolution.assignment.status === "RESOLVED") {
        const hierarchyStatus = rowResolution.hierarchy && rowResolution.hierarchy.status;
        if (hierarchyStatus === "RESOLVED") resolution.hierarchy.resolved += 1;
        else if (hierarchyStatus === "PARTIAL") resolution.hierarchy.partial += 1;
        else if (hierarchyStatus === "MASTER_ABSENT") resolution.hierarchy.masterAbsent += 1;
        else resolution.hierarchy.unresolved += 1;
      }
    });

    const unexplainedDifferences = Number(
      shadowResult.reconciliation && shadowResult.reconciliation.unexplainedDifferences,
    ) || 0;
    const blockers = [];
    const warnings = [];

    if (shadowResult.status === "FAILED") blockers.push(diagnostic("SHADOW_FAILED"));
    if (unexplainedDifferences > 0) {
      blockers.push(diagnostic("UNEXPLAINED_RECONCILIATION_DIFFERENCE", unexplainedDifferences));
    }
    if (shadowResult.status !== "FAILED" && !records.ready && !records.readyWithWarnings) {
      blockers.push(diagnostic("NO_CANONICAL_ROWS"));
    }

    MASTER_NAMES.forEach((name) => {
      if (!masters[name].configured) warnings.push(diagnostic(MASTER_WARNING_CODES[name]));
    });

    const warningCounts = [
      ["BRANCH_UNMAPPED_PRESENT", resolution.branch.unmapped + resolution.branch.ambiguous],
      ["BRANCH_FALLBACK_PRESENT", resolution.branch.fallback],
      ["GEOGRAPHY_UNMAPPED_PRESENT", resolution.geography.unmapped + resolution.geography.ambiguous],
      ["ASSIGNMENT_UNMAPPED_PRESENT", resolution.assignment.unmapped + resolution.assignment.ambiguous],
      ["HIERARCHY_PARTIAL_PRESENT", resolution.hierarchy.partial + resolution.hierarchy.unresolved],
      ["INVALID_ROWS_PRESENT", records.invalid],
      ["LEGACY_MONTH_MISMATCH_PRESENT", comparisons.legacyMonthMismatch],
      ["LEGACY_DAY_MISMATCH_PRESENT", comparisons.legacyDayMismatch],
      ["LEGACY_ZONE_MISMATCH_PRESENT", comparisons.legacyZoneMismatch],
      ["SOURCE_ASSIGNED_RM_MISMATCH_PRESENT", comparisons.sourceAssignedRmMismatch],
    ];
    warningCounts.forEach(([code, count]) => {
      if (count) warnings.push(diagnostic(code, count));
    });

    const allMastersConfigured = MASTER_NAMES.every((name) => masters[name].configured);
    const allResolutionStrict =
      resolution.branch.exact === eligibleRows &&
      resolution.geography.resolved === eligibleRows &&
      resolution.assignment.resolved === branchResolvedEligible &&
      resolution.hierarchy.resolved === assignmentResolvedEligible;
    const overallStatus = blockers.length
      ? "NOT_READY"
      : records.invalid === 0 && allMastersConfigured && allResolutionStrict && warnings.length === 0
        ? "READY"
        : "PARTIAL";

    return {
      overallStatus,
      branchUniverse: shadowResult && shadowResult.branchUniverseReadiness || null,
      branchUniverseAuthority: global.BancaTrackerLiveBranchUniverseAuthority
        ? global.BancaTrackerLiveBranchUniverseAuthority.getUniverse()
        : null,
      branchCommercial: global.BancaTrackerLiveBranchCommercialAuthority
        ? global.BancaTrackerLiveBranchCommercialAuthority.getCachedContext()
        : null,
      masters,
      records,
      resolution,
      comparisons,
      reconciliation: { unexplainedDifferences },
      readiness: {
        dateReadyPct: metric(dateReady, records.canonical),
        branchExactPct: metric(resolution.branch.exact, eligibleRows),
        branchResolvedPct: metric(resolution.branch.exact + resolution.branch.fallback, eligibleRows),
        geographyResolvedPct: metric(resolution.geography.resolved, eligibleRows),
        assignmentResolvedPct: metric(resolution.assignment.resolved, branchResolvedEligible),
        hierarchyResolvedPct: metric(resolution.hierarchy.resolved, assignmentResolvedEligible),
      },
      blockers,
      warnings,
    };
  }

  function getStatusLabel(status) {
    return ({ NOT_RUN: "Not run", NOT_READY: "Not ready", PARTIAL: "Partial", READY: "Ready" })[status] || "Unknown";
  }

  window.BancaTrackerReadinessDiagnostics = Object.freeze({
    buildReadiness,
    getStatusLabel,
  });
})();
