/*==============================================================
BancaTracker Enterprise
Version : 8.2.0-dev
File    : assignmentResolver.js
Module  : Enrichment Foundation
Purpose : Resolve the governed RM assignment for a durable branch
==============================================================*/

(function () {
  "use strict";

  if (!window.BancaTrackerDatasetRegistry) {
    throw new Error(
      "BancaTrackerDatasetRegistry must be loaded before assignmentResolver.js",
    );
  }

  if (!window.BancaTrackerBranchAssignmentMaster) {
    throw new Error(
      "BancaTrackerBranchAssignmentMaster must be loaded before assignmentResolver.js",
    );
  }

  const Registry = window.BancaTrackerDatasetRegistry;
  const AssignmentMaster = window.BancaTrackerBranchAssignmentMaster;
  const { RESOLUTION_STATUS, RESOLUTION_CONFIDENCE, SPECIAL_VALUES } = Registry;

  function buildBranchKey(input) {
    if (typeof input === "string") {
      const separatorIndex = input.indexOf(":");

      if (separatorIndex < 1) {
        return null;
      }

      return AssignmentMaster.buildBranchId(
        input.slice(0, separatorIndex),
        input.slice(separatorIndex + 1),
      );
    }

    return AssignmentMaster.buildBranchId(
      input && input.bankId,
      input && input.branchCode,
    );
  }

  function buildLookupMaps(records) {
    const assignmentByBranchId = new Map();
    const ambiguousBranchIds = new Set();

    records
      .filter((record) => record.active !== false)
      .forEach((record) => {
        if (!record.branchId) {
          return;
        }

        if (assignmentByBranchId.has(record.branchId)) {
          ambiguousBranchIds.add(record.branchId);
        } else {
          assignmentByBranchId.set(record.branchId, record);
        }
      });

    return {
      assignmentByBranchId,
      ambiguousBranchIds,
    };
  }

  function buildUnresolvedResult(status, branchId, input) {
    return {
      success: false,
      status,
      confidence:
        status === RESOLUTION_STATUS.AMBIGUOUS
          ? RESOLUTION_CONFIDENCE.AMBIGUOUS
          : RESOLUTION_CONFIDENCE.UNRESOLVED,
      source:
        status === RESOLUTION_STATUS.MASTER_ABSENT
          ? null
          : "BRANCH_ASSIGNMENT",
      input,
      branchId: branchId || SPECIAL_VALUES.UNMAPPED,
      rmId: null,
    };
  }

  function resolveAssignment(input, lookupMaps) {
    const branchId = buildBranchKey(input);

    if (!lookupMaps) {
      return buildUnresolvedResult(
        RESOLUTION_STATUS.MASTER_ABSENT,
        branchId,
        input,
      );
    }

    if (
      branchId &&
      lookupMaps.ambiguousBranchIds &&
      lookupMaps.ambiguousBranchIds.has(branchId)
    ) {
      return buildUnresolvedResult(
        RESOLUTION_STATUS.AMBIGUOUS,
        branchId,
        input,
      );
    }

    if (branchId && lookupMaps.assignmentByBranchId.has(branchId)) {
      const assignment = lookupMaps.assignmentByBranchId.get(branchId);

      return {
        success: true,
        status: RESOLUTION_STATUS.RESOLVED,
        confidence: RESOLUTION_CONFIDENCE.EXACT,
        source: "BRANCH_ASSIGNMENT",
        branchId: assignment.branchId,
        rmId: assignment.rmId,
      };
    }

    return buildUnresolvedResult(RESOLUTION_STATUS.UNMAPPED, branchId, input);
  }

  window.BancaTrackerAssignmentResolver = Object.freeze({
    buildBranchKey,
    buildLookupMaps,
    resolveAssignment,
  });
})();
