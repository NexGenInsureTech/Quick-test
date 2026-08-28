/*==============================================================
BancaTracker Enterprise
Version : 8.2.0-dev
File    : liveGeographyAuthority.js
Module  : Enrichment Foundation
Purpose : Apply governed State and Zone authority to live fact records
==============================================================*/

(function (global) {
  "use strict";

  let cachedContext = null;

  async function loadContext(repository = global.BancaTrackerRepository, branchContext = null) {
    if (!repository) return setCachedContext({ ...(branchContext || {}), geographyMaps: null, branchMaps: branchContext && branchContext.branchMaps || null });
    const geographyRecords = await repository
      .getActiveMasterRecords("GEOGRAPHY_MASTER")
      .catch(() => []);
    let branchMaps = branchContext && branchContext.branchMaps;
    if (!branchContext) {
      const branchRecords = await repository
        .getActiveMasterRecords("BRANCH_MASTER")
        .catch(() => []);
      branchMaps = branchRecords.length
        ? global.BancaTrackerBranchResolver.buildLookupMaps(branchRecords)
        : null;
    }
    return setCachedContext({
      geographyMaps: geographyRecords.length
        ? global.BancaTrackerGeographyResolver.buildLookupMaps(geographyRecords)
        : null,
      branchMaps: branchMaps || null,
    });
  }

  function setCachedContext(context) {
    cachedContext = context || { geographyMaps: null, branchMaps: null };
    return cachedContext;
  }

  function getCachedContext() {
    return cachedContext;
  }

  function normalize(value) {
    return String(value == null ? "" : value).trim().replace(/\s+/g, " ").toUpperCase();
  }

  function applyRecord(record, context = cachedContext) {
    const legacyState = record.state;
    const legacyZone = record.zone;
    const maps = context || { geographyMaps: null, branchMaps: null };

    if (!maps.geographyMaps) {
      return {
        ...record, legacyState, legacyZone,
        geographyAuthority: "LEGACY_FALLBACK",
        geographyAuthorityReason: "GEOGRAPHY_MASTER_ABSENT",
        legacyZoneComparison: null,
      };
    }

    const hasBranchAuthority = Boolean(record.branchAuthority);
    const branchResolution = hasBranchAuthority
      ? { success: /^GOVERNED_/.test(record.branchAuthority), stateId: record.stateId, status: record.branchResolutionStatus }
      : global.BancaTrackerBranchResolver.resolveBranch(
          { bankId: record.bankId || record.bank, branchCode: record.branchCode, branchName: record.branchName || record.branch },
          maps.branchMaps,
        );
    const governedByBranch = Boolean(branchResolution.success && branchResolution.stateId);
    const geographyInput = governedByBranch ? branchResolution.stateId : legacyState;
    const geographyResolution = global.BancaTrackerGeographyResolver.resolveState(
      geographyInput,
      maps.geographyMaps,
    );

    if (!geographyResolution.success) {
      return {
        ...record, legacyState, legacyZone,
        state: legacyState || null,
        zone: null,
        stateId: null,
        zoneId: null,
        geographyAuthority: "UNMAPPED",
        geographyAuthorityReason: geographyResolution.status,
        branchResolutionStatus: branchResolution.status,
        legacyZoneComparison: null,
      };
    }

    return {
      ...record, legacyState, legacyZone,
      state: geographyResolution.stateName,
      zone: geographyResolution.zoneName,
      stateId: geographyResolution.stateId,
      zoneId: geographyResolution.zoneId,
      geographyAuthority: governedByBranch
        ? "GOVERNED_BRANCH"
        : "GOVERNED_SOURCE_STATE",
      geographyAuthorityReason: null,
      branchResolutionStatus: branchResolution.status,
      branchSourceStateMismatch: governedByBranch && legacyState
        ? normalize(legacyState) !== normalize(geographyResolution.stateName)
        : false,
      legacyZoneComparison: global.BancaTrackerGeographyResolver.compareLegacyZone(
        legacyZone,
        geographyResolution.zoneName,
      ),
    };
  }

  function applyRecords(records, context = cachedContext) {
    return records.map((record) => applyRecord(record, context));
  }

  global.BancaTrackerLiveGeographyAuthority = Object.freeze({
    loadContext,
    setCachedContext,
    getCachedContext,
    applyRecord,
    applyRecords,
  });
})(window);
