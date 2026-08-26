/*==============================================================
BancaTracker Enterprise
Version : 8.2.0-dev
File    : enrichmentPipeline.js
Module  : Enrichment Foundation
Purpose : Compose canonical transaction enrichment with provenance
==============================================================*/

(function () {
  "use strict";

  const dependencies = [
    "BancaTrackerDatasetRegistry",
    "BancaTrackerDateResolver",
    "BancaTrackerGeographyResolver",
    "BancaTrackerBranchResolver",
    "BancaTrackerAssignmentResolver",
    "BancaTrackerHierarchyResolver",
  ];

  dependencies.forEach((dependency) => {
    if (!window[dependency]) {
      throw new Error(`${dependency} must be loaded before enrichmentPipeline.js`);
    }
  });

  const Registry = window.BancaTrackerDatasetRegistry;
  const DateResolver = window.BancaTrackerDateResolver;
  const GeographyResolver = window.BancaTrackerGeographyResolver;
  const BranchResolver = window.BancaTrackerBranchResolver;
  const AssignmentResolver = window.BancaTrackerAssignmentResolver;
  const HierarchyResolver = window.BancaTrackerHierarchyResolver;

  const {
    ROW_STATUS,
    RESOLUTION_STATUS,
    DATA_QUALITY_SEVERITY,
    DATA_QUALITY_CATEGORY,
  } = Registry;

  function normalizeText(value) {
    if (value === null || typeof value === "undefined") {
      return null;
    }

    const normalized = String(value)
      .replace(/\u00A0/g, " ")
      .trim();

    return normalized || null;
  }

  function normalizeCode(value) {
    const normalized = normalizeText(value);

    return normalized ? normalized.toUpperCase() : null;
  }

  function createFinding({
    code,
    severity,
    category,
    field = null,
    value = null,
    message,
  }) {
    return {
      code,
      severity,
      category,
      field,
      value,
      message,
    };
  }

  function addFinding(findings, code, severity, category, message, options = {}) {
    findings.push(
      createFinding({
        code,
        severity,
        category,
        message,
        field: options.field || null,
        value:
          Object.prototype.hasOwnProperty.call(options, "value")
            ? options.value
            : null,
      }),
    );
  }

  function normalizePremium(value) {
    if (
      value === null ||
      typeof value === "undefined" ||
      (typeof value === "string" && value.trim() === "")
    ) {
      return { success: false, value: null };
    }

    const numericValue = typeof value === "number" ? value : Number(value);

    return Number.isFinite(numericValue)
      ? { success: true, value: numericValue }
      : { success: false, value: null };
  }

  function addDateFindings(dateResolution, findings) {
    if (dateResolution.success) {
      return;
    }

    addFinding(
      findings,
      dateResolution.error,
      DATA_QUALITY_SEVERITY.ERROR,
      DATA_QUALITY_CATEGORY.DATE,
      "POLICY ISSUED DATE could not be resolved.",
      { field: "policyIssuedDate", value: dateResolution.input },
    );
  }

  function addBranchFindings(branchResolution, findings) {
    const status = branchResolution.status;

    if (status === RESOLUTION_STATUS.MATCHED_FALLBACK) {
      addFinding(
        findings,
        "BRANCH_FALLBACK_USED",
        DATA_QUALITY_SEVERITY.WARNING,
        DATA_QUALITY_CATEGORY.BRANCH,
        "Branch was resolved using the controlled name fallback.",
      );
    } else if (status === RESOLUTION_STATUS.UNMAPPED) {
      addFinding(
        findings,
        "BRANCH_UNMAPPED",
        DATA_QUALITY_SEVERITY.WARNING,
        DATA_QUALITY_CATEGORY.BRANCH,
        "Branch could not be resolved from Branch Master.",
      );
    } else if (status === RESOLUTION_STATUS.AMBIGUOUS) {
      addFinding(
        findings,
        "BRANCH_AMBIGUOUS",
        DATA_QUALITY_SEVERITY.WARNING,
        DATA_QUALITY_CATEGORY.BRANCH,
        "Branch fallback matched more than one Branch Master record.",
      );
    } else if (status === RESOLUTION_STATUS.MASTER_ABSENT) {
      addFinding(
        findings,
        "BRANCH_MASTER_ABSENT",
        DATA_QUALITY_SEVERITY.WARNING,
        DATA_QUALITY_CATEGORY.BRANCH,
        "Branch Master lookup maps are absent.",
      );
    }
  }

  function addGeographyFindings(geographyResolution, findings) {
    if (geographyResolution.status === RESOLUTION_STATUS.UNMAPPED) {
      addFinding(
        findings,
        "GEOGRAPHY_UNMAPPED",
        DATA_QUALITY_SEVERITY.WARNING,
        DATA_QUALITY_CATEGORY.GEOGRAPHY,
        "State and Zone could not be resolved from Geography Master.",
      );
    } else if (geographyResolution.status === RESOLUTION_STATUS.AMBIGUOUS) {
      addFinding(
        findings,
        "GEOGRAPHY_AMBIGUOUS",
        DATA_QUALITY_SEVERITY.WARNING,
        DATA_QUALITY_CATEGORY.GEOGRAPHY,
        "State matched more than one Geography Master record.",
      );
    } else if (geographyResolution.status === RESOLUTION_STATUS.MASTER_ABSENT) {
      addFinding(
        findings,
        "GEOGRAPHY_MASTER_ABSENT",
        DATA_QUALITY_SEVERITY.WARNING,
        DATA_QUALITY_CATEGORY.GEOGRAPHY,
        "Geography Master lookup maps are absent.",
      );
    }
  }

  function addAssignmentFindings(assignmentResolution, findings) {
    if (assignmentResolution.status === RESOLUTION_STATUS.UNMAPPED) {
      addFinding(
        findings,
        "ASSIGNMENT_UNMAPPED",
        DATA_QUALITY_SEVERITY.WARNING,
        DATA_QUALITY_CATEGORY.RM,
        "No governed RM assignment exists for the branch.",
      );
    } else if (assignmentResolution.status === RESOLUTION_STATUS.AMBIGUOUS) {
      addFinding(
        findings,
        "ASSIGNMENT_AMBIGUOUS",
        DATA_QUALITY_SEVERITY.WARNING,
        DATA_QUALITY_CATEGORY.RM,
        "More than one active RM assignment exists for the branch.",
      );
    } else if (assignmentResolution.status === RESOLUTION_STATUS.MASTER_ABSENT) {
      addFinding(
        findings,
        "ASSIGNMENT_MASTER_ABSENT",
        DATA_QUALITY_SEVERITY.WARNING,
        DATA_QUALITY_CATEGORY.RM,
        "Branch Assignment lookup maps are absent.",
      );
    }
  }

  function addHierarchyFindings(hierarchyResolution, findings) {
    if (hierarchyResolution.status === RESOLUTION_STATUS.RESOLVED) {
      return;
    }

    if (hierarchyResolution.status === RESOLUTION_STATUS.MASTER_ABSENT) {
      addFinding(
        findings,
        "HIERARCHY_MASTER_ABSENT",
        DATA_QUALITY_SEVERITY.WARNING,
        DATA_QUALITY_CATEGORY.HIERARCHY,
        "Hierarchy lookup maps are absent.",
      );
    } else if (hierarchyResolution.status === RESOLUTION_STATUS.PARTIAL) {
      addFinding(
        findings,
        "HIERARCHY_PARTIAL",
        DATA_QUALITY_SEVERITY.WARNING,
        DATA_QUALITY_CATEGORY.HIERARCHY,
        "Only part of the assigned RM hierarchy could be resolved.",
      );
    } else {
      addFinding(
        findings,
        "HIERARCHY_UNRESOLVED",
        DATA_QUALITY_SEVERITY.WARNING,
        DATA_QUALITY_CATEGORY.HIERARCHY,
        "Assigned RM hierarchy could not be resolved.",
      );
    }
  }

  function compareSourceAndAssignedRm(sourceRmId, assignmentResolution) {
    if (!sourceRmId) {
      return "SOURCE_RM_NOT_SUPPLIED";
    }

    if (!assignmentResolution.success || !assignmentResolution.rmId) {
      return "ASSIGNMENT_NOT_RESOLVED";
    }

    return sourceRmId === assignmentResolution.rmId
      ? RESOLUTION_STATUS.MATCH
      : RESOLUTION_STATUS.MISMATCH;
  }

  function determineRowStatus(findings) {
    if (
      findings.some(
        (finding) => finding.severity === DATA_QUALITY_SEVERITY.ERROR,
      )
    ) {
      return ROW_STATUS.INVALID;
    }

    return findings.some(
      (finding) => finding.severity === DATA_QUALITY_SEVERITY.WARNING,
    )
      ? ROW_STATUS.READY_WITH_WARNINGS
      : ROW_STATUS.READY;
  }

  function enrichTransaction(rawRow, context = {}) {
    const row = rawRow || {};
    const findings = [];

    const dateResolution = DateResolver.resolve(row.policyIssuedDate);
    addDateFindings(dateResolution, findings);

    const premiumResolution = normalizePremium(row.premium);

    if (!premiumResolution.success) {
      addFinding(
        findings,
        "PREMIUM_INVALID",
        DATA_QUALITY_SEVERITY.ERROR,
        DATA_QUALITY_CATEGORY.PREMIUM,
        "Premium must be a finite numeric value.",
        { field: "premium", value: row.premium },
      );
    }

    const branchResolution = BranchResolver.resolveBranch(
      {
        bankId: row.bankId,
        branchCode: row.branchCode,
        branchName: row.branchName,
      },
      context.branchMaps || null,
    );
    addBranchFindings(branchResolution, findings);

    const geographyInput =
      branchResolution.success && branchResolution.stateId
        ? branchResolution.stateId
        : row.state;
    const geographyInputSource =
      branchResolution.success && branchResolution.stateId
        ? "BRANCH_MASTER_STATE_ID"
        : "SOURCE_STATE";
    const geographyResolution = GeographyResolver.resolveState(
      geographyInput,
      context.geographyMaps || null,
    );
    geographyResolution.inputSource = geographyInputSource;
    addGeographyFindings(geographyResolution, findings);

    const assignmentResolution = AssignmentResolver.resolveAssignment(
      {
        bankId: row.bankId,
        branchCode: row.branchCode,
      },
      context.assignmentMaps || null,
    );
    addAssignmentFindings(assignmentResolution, findings);

    const sourceRmId = normalizeCode(row.rmId);
    const sourceVsAssignedRm = compareSourceAndAssignedRm(
      sourceRmId,
      assignmentResolution,
    );

    if (sourceVsAssignedRm === RESOLUTION_STATUS.MISMATCH) {
      addFinding(
        findings,
        "SOURCE_ASSIGNED_RM_MISMATCH",
        DATA_QUALITY_SEVERITY.WARNING,
        DATA_QUALITY_CATEGORY.RM,
        "Source RM differs from the governed assigned RM.",
        { field: "rmId", value: sourceRmId },
      );
    }

    const hierarchyResolution = assignmentResolution.success
      ? HierarchyResolver.resolveHierarchy(
          assignmentResolution.rmId,
          context.hierarchyMaps || null,
        )
      : {
          success: false,
          status: RESOLUTION_STATUS.UNCONFIGURED,
          source: null,
          reason: "ASSIGNMENT_NOT_RESOLVED",
          rmId: null,
          csmId: null,
          asmId: null,
          zsmId: null,
          nationalHeadId: null,
          chain: [],
        };
    addHierarchyFindings(hierarchyResolution, findings);

    const legacyMonthStatus = dateResolution.success
      ? DateResolver.compareLegacyMonth(row.month, dateResolution.monthLabel)
      : null;
    const legacyDayStatus = dateResolution.success
      ? DateResolver.compareLegacyDay(row.day, dateResolution.day)
      : null;
    const legacyZoneStatus = geographyResolution.success
      ? GeographyResolver.compareLegacyZone(row.zone, geographyResolution.zoneName)
      : null;

    if (legacyMonthStatus === RESOLUTION_STATUS.MISMATCH) {
      addFinding(
        findings,
        "LEGACY_MONTH_MISMATCH",
        DATA_QUALITY_SEVERITY.WARNING,
        DATA_QUALITY_CATEGORY.DATE,
        "Uploaded Month differs from the policy-issued date.",
      );
    }

    if (legacyDayStatus === RESOLUTION_STATUS.MISMATCH) {
      addFinding(
        findings,
        "LEGACY_DAY_MISMATCH",
        DATA_QUALITY_SEVERITY.WARNING,
        DATA_QUALITY_CATEGORY.DATE,
        "Uploaded Day differs from the policy-issued date.",
      );
    }

    if (legacyZoneStatus === RESOLUTION_STATUS.MISMATCH) {
      addFinding(
        findings,
        "LEGACY_ZONE_MISMATCH",
        DATA_QUALITY_SEVERITY.WARNING,
        DATA_QUALITY_CATEGORY.GEOGRAPHY,
        "Uploaded Zone differs from the Geography Master Zone.",
      );
    }

    const canonicalBranchId = branchResolution.success
      ? branchResolution.branchId
      : null;
    const canonicalStateId = geographyResolution.success
      ? geographyResolution.stateId
      : branchResolution.success
        ? branchResolution.stateId
        : null;

    const transaction = {
      policyNumber: normalizeText(row.policyNumber),
      policyIssuedDate: dateResolution.success
        ? dateResolution.policyIssuedDate
        : null,
      year: dateResolution.success ? dateResolution.year : null,
      month: dateResolution.success ? dateResolution.month : null,
      monthKey: dateResolution.success ? dateResolution.monthKey : null,
      monthLabel: dateResolution.success ? dateResolution.monthLabel : null,
      day: dateResolution.success ? dateResolution.day : null,
      financialYear: dateResolution.success
        ? dateResolution.financialYear
        : null,
      premium: premiumResolution.success ? premiumResolution.value : null,
      bankId: normalizeCode(row.bankId),
      bankName: normalizeText(row.bankName),
      branchId: canonicalBranchId,
      branchCode: branchResolution.success
        ? branchResolution.branchCode
        : normalizeText(row.branchCode),
      branchName: branchResolution.success
        ? branchResolution.branchName
        : normalizeText(row.branchName),
      stateId: canonicalStateId,
      stateName: geographyResolution.success
        ? geographyResolution.stateName
        : null,
      zoneId: geographyResolution.success ? geographyResolution.zoneId : null,
      zoneName: geographyResolution.success
        ? geographyResolution.zoneName
        : null,
      sourceState: normalizeText(row.state),
      sourceZone: normalizeText(row.zone),
      bankRegionId: branchResolution.success
        ? branchResolution.bankRegionId
        : null,
      bankRegionName: branchResolution.success
        ? branchResolution.bankRegionName
        : null,
      bankZoneId: branchResolution.success ? branchResolution.bankZoneId : null,
      bankZoneName: branchResolution.success
        ? branchResolution.bankZoneName
        : null,
      fgmOfficeId: branchResolution.success
        ? branchResolution.fgmOfficeId
        : null,
      fgmOfficeName: branchResolution.success
        ? branchResolution.fgmOfficeName
        : null,
      sourceRmId,
      sourceRmName: normalizeText(row.rmName),
      assignedRmId: assignmentResolution.success
        ? assignmentResolution.rmId
        : null,
      rmId: hierarchyResolution.rmId || null,
      csmId: hierarchyResolution.csmId || null,
      asmId: hierarchyResolution.asmId || null,
      zsmId: hierarchyResolution.zsmId || null,
      nationalHeadId: hierarchyResolution.nationalHeadId || null,
      productCode: normalizeCode(row.productCode),
      productName: normalizeText(row.productName),
      lob: normalizeText(row.lob),
    };

    return {
      status: determineRowStatus(findings),
      transaction,
      resolution: {
        date: {
          ...dateResolution,
          source: "POLICY_ISSUED_DATE",
        },
        branch: branchResolution,
        geography: geographyResolution,
        assignment: assignmentResolution,
        hierarchy: hierarchyResolution,
      },
      comparisons: {
        legacyMonth: legacyMonthStatus,
        legacyDay: legacyDayStatus,
        legacyZone: legacyZoneStatus,
        sourceVsAssignedRm,
      },
      findings,
    };
  }

  function enrichTransactions(rows, context = {}) {
    if (!Array.isArray(rows)) {
      throw new TypeError("Transactions must be an array.");
    }

    return rows.map((row) => enrichTransaction(row, context));
  }

  window.BancaTrackerEnrichmentPipeline = Object.freeze({
    enrichTransaction,
    enrichTransactions,
  });
})();
