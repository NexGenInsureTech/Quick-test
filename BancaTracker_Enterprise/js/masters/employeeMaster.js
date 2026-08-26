/*==============================================================
BancaTracker Enterprise
Version : 8.2.0-dev
File    : employeeMaster.js
Module  : Master Data
Purpose : Normalize and validate durable Employee Master records
==============================================================*/

(function () {
  "use strict";

  if (!window.BancaTrackerDatasetRegistry) {
    throw new Error(
      "BancaTrackerDatasetRegistry must be loaded before employeeMaster.js",
    );
  }

  const Registry = window.BancaTrackerDatasetRegistry;
  const {
    EMPLOYEE_ROLES,
    DATA_QUALITY_SEVERITY,
    DATA_QUALITY_CATEGORY,
  } = Registry;

  const ROLE_ALIASES = Object.freeze({
    NATIONAL_HEAD: EMPLOYEE_ROLES.NATIONAL_HEAD,
    "NATIONAL HEAD": EMPLOYEE_ROLES.NATIONAL_HEAD,
    NH: EMPLOYEE_ROLES.NATIONAL_HEAD,
    ZSM: EMPLOYEE_ROLES.ZSM,
    "ZONAL SALES MANAGER": EMPLOYEE_ROLES.ZSM,
    ASM: EMPLOYEE_ROLES.ASM,
    "AREA SALES MANAGER": EMPLOYEE_ROLES.ASM,
    CSM: EMPLOYEE_ROLES.CSM,
    "CHANNEL SALES MANAGER": EMPLOYEE_ROLES.CSM,
    RM: EMPLOYEE_ROLES.RM,
    "RELATIONSHIP MANAGER": EMPLOYEE_ROLES.RM,
  });

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

  function normalizeBoolean(value) {
    if (typeof value === "boolean") {
      return value;
    }

    const normalized = normalizeCode(value);

    if (["TRUE", "YES", "Y", "1"].includes(normalized)) {
      return true;
    }

    if (["FALSE", "NO", "N", "0"].includes(normalized)) {
      return false;
    }

    return null;
  }

  function normalizeRole(value) {
    const normalized = normalizeText(value);

    if (!normalized) {
      return null;
    }

    const aliasKey = normalized.replace(/\s+/g, " ").toUpperCase();

    return ROLE_ALIASES[aliasKey] || null;
  }

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
      category: DATA_QUALITY_CATEGORY.HIERARCHY,
      field,
      value,
      message,
    };
  }

  function normalizeRow(rawRow, datasetId, rowNumber) {
    const employeeId = normalizeCode(rawRow["EMPLOYEE ID"]);

    return {
      recordId: employeeId
        ? `${datasetId}:${employeeId}`
        : `${datasetId}:ROW:${rowNumber}`,
      datasetId,
      employeeId,
      employeeName: normalizeText(rawRow["EMPLOYEE NAME"]),
      role: normalizeRole(rawRow["ROLE"]),
      active: normalizeBoolean(rawRow["ACTIVE"]),
      validFrom: normalizeText(rawRow["VALID FROM"]),
      validTo: normalizeText(rawRow["VALID TO"]),
      sourceRowNumber: rowNumber,
    };
  }

  function validateRow(record) {
    const findings = [];

    if (!record.employeeId) {
      findings.push(
        createFinding({
          code: "EMPLOYEE_ID_MISSING",
          severity: DATA_QUALITY_SEVERITY.ERROR,
          field: "EMPLOYEE ID",
          message: "EMPLOYEE ID is required.",
        }),
      );
    }

    if (!record.employeeName) {
      findings.push(
        createFinding({
          code: "EMPLOYEE_NAME_MISSING",
          severity: DATA_QUALITY_SEVERITY.ERROR,
          field: "EMPLOYEE NAME",
          message: "EMPLOYEE NAME is required.",
        }),
      );
    }

    if (!record.role) {
      findings.push(
        createFinding({
          code: "EMPLOYEE_ROLE_INVALID",
          severity: DATA_QUALITY_SEVERITY.ERROR,
          field: "ROLE",
          message: "ROLE must resolve to a supported hierarchy role.",
        }),
      );
    }

    if (typeof record.active !== "boolean") {
      findings.push(
        createFinding({
          code: "EMPLOYEE_ACTIVE_INVALID",
          severity: DATA_QUALITY_SEVERITY.ERROR,
          field: "ACTIVE",
          message: "ACTIVE must be a valid boolean value.",
        }),
      );
    }

    return findings;
  }

  function validateDataset(records) {
    const findings = [];
    const employeeIds = new Set();

    records.forEach((record) => {
      if (!record.employeeId) {
        return;
      }

      if (employeeIds.has(record.employeeId)) {
        findings.push(
          createFinding({
            code: "EMPLOYEE_DUPLICATE_ID",
            severity: DATA_QUALITY_SEVERITY.ERROR,
            field: "EMPLOYEE ID",
            value: record.employeeId,
            message: `Duplicate EMPLOYEE ID: ${record.employeeId}`,
          }),
        );
      } else {
        employeeIds.add(record.employeeId);
      }
    });

    return findings;
  }

  function prepareDataset(rawRows, datasetId) {
    if (!Array.isArray(rawRows)) {
      throw new TypeError("Employee Master rows must be an array.");
    }

    const records = rawRows.map((row, index) =>
      normalizeRow(row, datasetId, index + 2),
    );
    const findings = [];

    records.forEach((record) => findings.push(...validateRow(record)));
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

  window.BancaTrackerEmployeeMaster = Object.freeze({
    ROLE_ALIASES,
    normalizeText,
    normalizeCode,
    normalizeBoolean,
    normalizeRole,
    normalizeRow,
    validateRow,
    validateDataset,
    prepareDataset,
  });
})();
