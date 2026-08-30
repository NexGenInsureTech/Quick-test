/*==============================================================
BancaTracker Enterprise
Version : 8.2.0
File    : geographyResolver.js
Module  : Enrichment Foundation
Purpose : Resolve State and Zone from active Geography Master
==============================================================*/

(function () {
  "use strict";

  /*==============================================================
  DEPENDENCY CHECK
  ==============================================================*/

  if (!window.BancaTrackerDatasetRegistry) {
    throw new Error(
      "BancaTrackerDatasetRegistry must be loaded before geographyResolver.js",
    );
  }

  if (!window.BancaTrackerGeographyMaster) {
    throw new Error(
      "BancaTrackerGeographyMaster must be loaded before geographyResolver.js",
    );
  }

  const Registry = window.BancaTrackerDatasetRegistry;

  const GeographyMaster = window.BancaTrackerGeographyMaster;

  const { RESOLUTION_STATUS, RESOLUTION_CONFIDENCE, SPECIAL_VALUES } = Registry;

  /*==============================================================
  CACHE BUILDER
  ==============================================================*/

  function buildLookupMaps(records) {
    const stateById = new Map();

    const stateByCode = new Map();

    const stateByName = new Map();

    const ambiguousCodes = new Set();

    const ambiguousNames = new Set();

    records
      .filter((record) => record.active !== false)
      .forEach((record) => {
        if (record.stateId) {
          stateById.set(record.stateId, record);
        }

        if (record.stateCode) {
          if (stateByCode.has(record.stateCode)) {
            ambiguousCodes.add(record.stateCode);
          } else {
            stateByCode.set(record.stateCode, record);
          }
        }

        if (record.normalizedStateName) {
          if (stateByName.has(record.normalizedStateName)) {
            ambiguousNames.add(record.normalizedStateName);
          } else {
            stateByName.set(record.normalizedStateName, record);
          }
        }
      });

    return {
      stateById,
      stateByCode,
      stateByName,
      ambiguousCodes,
      ambiguousNames,
    };
  }

  /*==============================================================
  RESULT BUILDERS
  ==============================================================*/

  function buildResolvedResult(record, status, confidence) {
    return {
      success: true,

      status,
      confidence,

      source: "GEOGRAPHY_MASTER",

      stateId: record.stateId,

      stateCode: record.stateCode,

      stateName: record.stateName,

      zoneId: record.zoneId,

      zoneName: record.zoneName,
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

      source: "GEOGRAPHY_MASTER",

      input,

      stateId: SPECIAL_VALUES.UNMAPPED,

      stateCode: null,
      stateName: null,

      zoneId: SPECIAL_VALUES.UNMAPPED,

      zoneName: null,
    };
  }

  /*==============================================================
  STATE RESOLUTION
  ==============================================================*/

  function resolveState(value, lookupMaps) {
    if (!lookupMaps) {
      return {
        success: false,
        status: RESOLUTION_STATUS.MASTER_ABSENT,
        confidence: RESOLUTION_CONFIDENCE.UNRESOLVED,
        source: null,
        input: value,
        stateId: null,
        stateCode: null,
        stateName: null,
        zoneId: null,
        zoneName: null,
      };
    }

    const normalizedCode = GeographyMaster.normalizeCode(value);

    const normalizedName = GeographyMaster.normalizeStateName(value);

    if (!normalizedCode) {
      return buildUnresolvedResult(RESOLUTION_STATUS.UNMAPPED, value);
    }

    if (lookupMaps.stateById.has(normalizedCode)) {
      return buildResolvedResult(
        lookupMaps.stateById.get(normalizedCode),
        RESOLUTION_STATUS.MATCHED_ID,
        RESOLUTION_CONFIDENCE.EXACT,
      );
    }

    if (lookupMaps.ambiguousCodes.has(normalizedCode)) {
      return buildUnresolvedResult(RESOLUTION_STATUS.AMBIGUOUS, value);
    }

    if (lookupMaps.stateByCode.has(normalizedCode)) {
      return buildResolvedResult(
        lookupMaps.stateByCode.get(normalizedCode),
        RESOLUTION_STATUS.MATCHED_CODE,
        RESOLUTION_CONFIDENCE.EXACT,
      );
    }

    if (lookupMaps.ambiguousNames.has(normalizedName)) {
      return buildUnresolvedResult(RESOLUTION_STATUS.AMBIGUOUS, value);
    }

    if (lookupMaps.stateByName.has(normalizedName)) {
      return buildResolvedResult(
        lookupMaps.stateByName.get(normalizedName),
        RESOLUTION_STATUS.MATCHED_NAME,
        RESOLUTION_CONFIDENCE.DERIVED,
      );
    }

    return buildUnresolvedResult(RESOLUTION_STATUS.UNMAPPED, value);
  }

  /*==============================================================
  LEGACY ZONE COMPARISON
  ==============================================================*/

  function compareLegacyZone(legacyZone, resolvedZoneName) {
    if (
      legacyZone === null ||
      typeof legacyZone === "undefined" ||
      String(legacyZone).trim() === ""
    ) {
      return RESOLUTION_STATUS.NOT_SUPPLIED;
    }

    const legacy = GeographyMaster.normalizeStateName(legacyZone);

    const resolved = GeographyMaster.normalizeStateName(resolvedZoneName);

    return legacy === resolved
      ? RESOLUTION_STATUS.MATCH
      : RESOLUTION_STATUS.MISMATCH;
  }

  /*==============================================================
  PUBLIC API
  ==============================================================*/

  const BancaTrackerGeographyResolver = Object.freeze({
    buildLookupMaps,
    resolveState,
    compareLegacyZone,
  });

  window.BancaTrackerGeographyResolver = BancaTrackerGeographyResolver;
})();
