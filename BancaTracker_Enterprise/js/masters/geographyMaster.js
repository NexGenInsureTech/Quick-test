/*==============================================================
BancaTracker Enterprise
Version : 8.2.0
File    : geographyMaster.js
Module  : Master Data
Purpose : Normalize, validate and prepare Geography Master records
==============================================================*/

(function () {
  "use strict";

  /*==============================================================
  DEPENDENCY CHECK
  ==============================================================*/

  if (!window.BancaTrackerDatasetRegistry) {
    throw new Error(
      "BancaTrackerDatasetRegistry must be loaded before geographyMaster.js",
    );
  }

  const Registry = window.BancaTrackerDatasetRegistry;

  const { DATA_QUALITY_SEVERITY, DATA_QUALITY_CATEGORY } = Registry;

  /*==============================================================
  HELPERS
  ==============================================================*/

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

  function normalizeStateName(value) {
    const normalized = normalizeText(value);

    return normalized ? normalized.replace(/\s+/g, " ").toUpperCase() : null;
  }

  function normalizeBoolean(value) {
    if (typeof value === "boolean") {
      return value;
    }

    const normalized = normalizeText(value);

    if (!normalized) {
      return null;
    }

    const upper = normalized.toUpperCase();

    if (upper === "TRUE" || upper === "YES" || upper === "Y" || upper === "1") {
      return true;
    }

    if (upper === "FALSE" || upper === "NO" || upper === "N" || upper === "0") {
      return false;
    }

    return null;
  }

  /*==============================================================
  FINDING FACTORY
  ==============================================================*/

  function createFinding({
    code,
    severity,
    field = null,
    value = null,
    message,
  }) {
    return {
      code,
      severity,
      category: DATA_QUALITY_CATEGORY.GEOGRAPHY,
      field,
      value,
      message,
    };
  }

  /*==============================================================
  ROW NORMALIZATION
  ==============================================================*/

  function normalizeRow(rawRow, datasetId, rowNumber) {
    const stateId = normalizeCode(rawRow["STATE ID"]);

    const stateCode = normalizeCode(rawRow["STATE CODE"]);

    const stateName = normalizeText(rawRow["STATE NAME"]);

    const zoneId = normalizeCode(rawRow["ZONE ID"]);

    const zoneName = normalizeText(rawRow["ZONE NAME"]);

    const active = normalizeBoolean(rawRow["ACTIVE"]);

    return {
      recordId: stateId
        ? `${datasetId}:${stateId}`
        : `${datasetId}:ROW:${rowNumber}`,

      datasetId,

      stateId,
      stateCode,
      stateName,
      normalizedStateName: normalizeStateName(stateName),

      zoneId,
      zoneName,

      active,

      sourceRowNumber: rowNumber,
    };
  }

  /*==============================================================
  ROW VALIDATION
  ==============================================================*/

  function validateRow(record) {
    const findings = [];

    if (!record.stateId) {
      findings.push(
        createFinding({
          code: "GEOGRAPHY_STATE_ID_MISSING",
          severity: DATA_QUALITY_SEVERITY.ERROR,
          field: "STATE ID",
          message: "STATE ID is required.",
        }),
      );
    }

    if (!record.stateName) {
      findings.push(
        createFinding({
          code: "GEOGRAPHY_STATE_NAME_MISSING",
          severity: DATA_QUALITY_SEVERITY.ERROR,
          field: "STATE NAME",
          message: "STATE NAME is required.",
        }),
      );
    }

    if (!record.zoneId) {
      findings.push(
        createFinding({
          code: "GEOGRAPHY_ZONE_ID_MISSING",
          severity: DATA_QUALITY_SEVERITY.ERROR,
          field: "ZONE ID",
          message: "ZONE ID is required.",
        }),
      );
    }

    if (!record.zoneName) {
      findings.push(
        createFinding({
          code: "GEOGRAPHY_ZONE_NAME_MISSING",
          severity: DATA_QUALITY_SEVERITY.ERROR,
          field: "ZONE NAME",
          message: "ZONE NAME is required.",
        }),
      );
    }

    if (typeof record.active !== "boolean") {
      findings.push(
        createFinding({
          code: "GEOGRAPHY_ACTIVE_INVALID",
          severity: DATA_QUALITY_SEVERITY.ERROR,
          field: "ACTIVE",
          message: "ACTIVE must be a valid boolean value.",
        }),
      );
    }

    return findings;
  }

  /*==============================================================
  DATASET VALIDATION
  ==============================================================*/

  function validateDataset(records) {
    const findings = [];

    const stateIdMap = new Map();

    const stateCodeMap = new Map();

    const stateNameMap = new Map();

    const zoneConsistency = new Map();

    records.forEach((record) => {
      if (record.stateId) {
        if (stateIdMap.has(record.stateId)) {
          findings.push(
            createFinding({
              code: "GEOGRAPHY_DUPLICATE_STATE_ID",
              severity: DATA_QUALITY_SEVERITY.ERROR,
              field: "STATE ID",
              value: record.stateId,
              message: `Duplicate STATE ID: ${record.stateId}`,
            }),
          );
        } else {
          stateIdMap.set(record.stateId, record);
        }
      }

      if (record.stateCode) {
        if (stateCodeMap.has(record.stateCode)) {
          findings.push(
            createFinding({
              code: "GEOGRAPHY_DUPLICATE_STATE_CODE",
              severity: DATA_QUALITY_SEVERITY.WARNING,
              field: "STATE CODE",
              value: record.stateCode,
              message: `Duplicate STATE CODE: ${record.stateCode}`,
            }),
          );
        } else {
          stateCodeMap.set(record.stateCode, record);
        }
      }

      if (record.normalizedStateName) {
        if (stateNameMap.has(record.normalizedStateName)) {
          findings.push(
            createFinding({
              code: "GEOGRAPHY_DUPLICATE_STATE_NAME",
              severity: DATA_QUALITY_SEVERITY.WARNING,
              field: "STATE NAME",
              value: record.stateName,
              message: `Duplicate STATE NAME: ${record.stateName}`,
            }),
          );
        } else {
          stateNameMap.set(record.normalizedStateName, record);
        }
      }

      if (record.zoneId && record.zoneName) {
        const normalizedZoneName = normalizeStateName(record.zoneName);

        if (zoneConsistency.has(record.zoneId)) {
          const existing = zoneConsistency.get(record.zoneId);

          if (existing !== normalizedZoneName) {
            findings.push(
              createFinding({
                code: "GEOGRAPHY_ZONE_NAME_CONFLICT",
                severity: DATA_QUALITY_SEVERITY.ERROR,
                field: "ZONE NAME",
                value: record.zoneId,
                message: `ZONE ID ${record.zoneId} maps to multiple zone names.`,
              }),
            );
          }
        } else {
          zoneConsistency.set(record.zoneId, normalizedZoneName);
        }
      }
    });

    return findings;
  }

  /*==============================================================
  PREPARE DATASET
  ==============================================================*/

  function prepareDataset(rawRows, datasetId) {
    if (!Array.isArray(rawRows)) {
      throw new TypeError("Geography Master rows must be an array.");
    }

    const records = rawRows.map((row, index) =>
      normalizeRow(row, datasetId, index + 2),
    );

    const findings = [];

    records.forEach((record) => {
      findings.push(...validateRow(record));
    });

    findings.push(...validateDataset(records));

    const errorCount = findings.filter(
      (finding) => finding.severity === DATA_QUALITY_SEVERITY.ERROR,
    ).length;

    const warningCount = findings.filter(
      (finding) => finding.severity === DATA_QUALITY_SEVERITY.WARNING,
    ).length;

    return {
      records,
      findings,
      valid: errorCount === 0,
      errorCount,
      warningCount,
    };
  }

  /*==============================================================
  PUBLIC API
  ==============================================================*/

  const BancaTrackerGeographyMaster = Object.freeze({
    normalizeText,
    normalizeCode,
    normalizeStateName,
    normalizeBoolean,

    normalizeRow,
    validateRow,
    validateDataset,
    prepareDataset,
  });

  window.BancaTrackerGeographyMaster = BancaTrackerGeographyMaster;
})();
