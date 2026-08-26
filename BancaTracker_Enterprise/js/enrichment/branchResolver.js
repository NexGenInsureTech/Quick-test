/*==============================================================
BancaTracker Enterprise
Version : 8.2.0-dev
File    : branchResolver.js
Module  : Enrichment Foundation
Purpose : Resolve durable branches from the active Branch Master
==============================================================*/

(function () {
  "use strict";

  if (!window.BancaTrackerDatasetRegistry) {
    throw new Error(
      "BancaTrackerDatasetRegistry must be loaded before branchResolver.js",
    );
  }

  if (!window.BancaTrackerBranchMaster) {
    throw new Error(
      "BancaTrackerBranchMaster must be loaded before branchResolver.js",
    );
  }

  const Registry = window.BancaTrackerDatasetRegistry;
  const BranchMaster = window.BancaTrackerBranchMaster;

  const { RESOLUTION_STATUS, RESOLUTION_CONFIDENCE, SPECIAL_VALUES } = Registry;

  function buildBranchKey(bankId, branchCode) {
    return BranchMaster.buildBranchId(
      BranchMaster.normalizeCode(bankId),
      BranchMaster.normalizeBranchCode(branchCode),
    );
  }

  function buildNameKey(bankId, branchName) {
    const normalizedBankId = BranchMaster.normalizeCode(bankId);
    const normalizedName = BranchMaster.normalizeName(branchName);

    return normalizedBankId && normalizedName
      ? `${normalizedBankId}:${normalizedName}`
      : null;
  }

  function buildLookupMaps(records) {
    const branchById = new Map();
    const branchByBankAndCode = new Map();
    const branchByBankAndName = new Map();
    const ambiguousNames = new Set();

    records
      .filter((record) => record.active !== false)
      .forEach((record) => {
        const exactKey = buildBranchKey(record.bankId, record.branchCode);
        const nameKey = buildNameKey(record.bankId, record.branchName);

        if (record.branchId) {
          branchById.set(record.branchId, record);
        }

        if (exactKey) {
          branchByBankAndCode.set(exactKey, record);
        }

        if (nameKey) {
          if (branchByBankAndName.has(nameKey)) {
            ambiguousNames.add(nameKey);
          } else {
            branchByBankAndName.set(nameKey, record);
          }
        }
      });

    return {
      branchById,
      branchByBankAndCode,
      branchByBankAndName,
      ambiguousNames,
    };
  }

  function buildResolvedResult(record, status, confidence) {
    return {
      success: true,
      status,
      confidence,
      source: "BRANCH_MASTER",
      branchId: record.branchId,
      bankId: record.bankId,
      branchCode: record.branchCode,
      branchName: record.branchName,
      stateId: record.stateId,
      bankRegionId: record.bankRegionId,
      bankRegionName: record.bankRegionName,
      bankZoneId: record.bankZoneId,
      bankZoneName: record.bankZoneName,
      fgmOfficeId: record.fgmOfficeId,
      fgmOfficeName: record.fgmOfficeName,
    };
  }

  function buildUnresolvedResult(status, input) {
    return {
      success: false,
      status,
      confidence:
        status === RESOLUTION_STATUS.AMBIGUOUS
          ? RESOLUTION_CONFIDENCE.AMBIGUOUS
          : RESOLUTION_CONFIDENCE.UNRESOLVED,
      source: status === RESOLUTION_STATUS.MASTER_ABSENT ? null : "BRANCH_MASTER",
      input,
      branchId: SPECIAL_VALUES.UNMAPPED,
      bankId: BranchMaster.normalizeCode(input && input.bankId),
      branchCode: BranchMaster.normalizeBranchCode(input && input.branchCode),
      branchName: BranchMaster.normalizeText(input && input.branchName),
      stateId: null,
    };
  }

  function resolveBranch(input, lookupMaps) {
    const request = input || {};

    if (!lookupMaps) {
      return buildUnresolvedResult(RESOLUTION_STATUS.MASTER_ABSENT, request);
    }

    const exactKey = buildBranchKey(request.bankId, request.branchCode);

    if (exactKey && lookupMaps.branchByBankAndCode.has(exactKey)) {
      return buildResolvedResult(
        lookupMaps.branchByBankAndCode.get(exactKey),
        RESOLUTION_STATUS.MATCHED_EXACT,
        RESOLUTION_CONFIDENCE.EXACT,
      );
    }

    const nameKey = buildNameKey(request.bankId, request.branchName);

    if (nameKey && lookupMaps.ambiguousNames.has(nameKey)) {
      return buildUnresolvedResult(RESOLUTION_STATUS.AMBIGUOUS, request);
    }

    if (nameKey && lookupMaps.branchByBankAndName.has(nameKey)) {
      return buildResolvedResult(
        lookupMaps.branchByBankAndName.get(nameKey),
        RESOLUTION_STATUS.MATCHED_FALLBACK,
        RESOLUTION_CONFIDENCE.FALLBACK,
      );
    }

    return buildUnresolvedResult(RESOLUTION_STATUS.UNMAPPED, request);
  }

  window.BancaTrackerBranchResolver = Object.freeze({
    buildBranchKey,
    buildLookupMaps,
    resolveBranch,
  });
})();
