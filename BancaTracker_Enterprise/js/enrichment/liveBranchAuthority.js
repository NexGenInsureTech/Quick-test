/*==============================================================
BancaTracker Enterprise
Version : 8.2.0-dev
File    : liveBranchAuthority.js
Module  : Enrichment Foundation
Purpose : Apply durable Branch Master identity to live fact records
==============================================================*/

(function (global) {
  "use strict";

  let cachedContext = null;

  function setCachedContext(context) {
    cachedContext = context || { branchMaps: null };
    return cachedContext;
  }

  function getCachedContext() {
    return cachedContext;
  }

  async function loadContext(repository = global.BancaTrackerRepository) {
    if (!repository) {
      const universeAuthority = global.BancaTrackerLiveBranchUniverseAuthority;
      const branchUniverse = universeAuthority ? universeAuthority.setFromBranchMaster([]) : null;
      return setCachedContext({ branchMaps: null, branchRecords: [], branchUniverse });
    }
    const records = await repository
      .getActiveMasterRecords("BRANCH_MASTER")
      .catch(() => []);
    const universeAuthority = global.BancaTrackerLiveBranchUniverseAuthority;
    const branchUniverse = universeAuthority
      ? universeAuthority.setFromBranchMaster(records)
      : null;
    return setCachedContext({
      branchRecords: records,
      branchUniverse,
      branchMaps: records.length
        ? global.BancaTrackerBranchResolver.buildLookupMaps(records)
        : null,
    });
  }

  function authorityStatus(resolution) {
    if (resolution.status === "MATCHED_EXACT") return "GOVERNED_EXACT";
    if (resolution.status === "MATCHED_FALLBACK") return "GOVERNED_FALLBACK";
    if (resolution.status === "MASTER_ABSENT") return "LEGACY_FALLBACK";
    if (resolution.status === "AMBIGUOUS") return "AMBIGUOUS";
    return "UNMAPPED";
  }

  function applyRecord(record, context = cachedContext) {
    const maps = context || { branchMaps: null };
    const legacyBranchCode = Object.prototype.hasOwnProperty.call(record, "legacyBranchCode")
      ? record.legacyBranchCode
      : record.branchCode || null;
    const legacyBranchName = Object.prototype.hasOwnProperty.call(record, "legacyBranchName")
      ? record.legacyBranchName
      : record.branchName || record.branch || null;
    const resolution = global.BancaTrackerBranchResolver.resolveBranch(
      {
        bankId: record.bankId || record.bank,
        branchCode: legacyBranchCode,
        branchName: legacyBranchName,
      },
      maps.branchMaps,
    );
    const branchAuthority = authorityStatus(resolution);

    if (!resolution.success) {
      return {
        ...record,
        legacyBranchCode,
        legacyBranchName,
        branchId: null,
        branchAuthority,
        branchResolutionStatus: resolution.status,
      };
    }

    return {
      ...record,
      legacyBranchCode,
      legacyBranchName,
      branchId: resolution.branchId,
      branchCode: resolution.branchCode,
      branch: resolution.branchName,
      branchName: resolution.branchName,
      stateId: resolution.stateId,
      bankRegionId: resolution.bankRegionId || null,
      bankRegionName: resolution.bankRegionName || null,
      bankZoneId: resolution.bankZoneId || null,
      bankZoneName: resolution.bankZoneName || null,
      fgmOfficeId: resolution.fgmOfficeId || null,
      fgmOfficeName: resolution.fgmOfficeName || null,
      branchAuthority,
      branchResolutionStatus: resolution.status,
    };
  }

  function applyRecords(records, context = cachedContext) {
    return records.map((record) => applyRecord(record, context));
  }

  global.BancaTrackerLiveBranchAuthority = Object.freeze({
    loadContext,
    setCachedContext,
    getCachedContext,
    applyRecord,
    applyRecords,
  });
})(window);
