/*==============================================================
BancaTracker Enterprise
Version : 8.2.0-dev
File    : branchAssignmentMaster.js
Module  : Master Data
Purpose : Normalize and validate durable Branch to RM assignments
==============================================================*/

(function () {
  "use strict";

  if (!window.BancaTrackerDatasetRegistry) {
    throw new Error(
      "BancaTrackerDatasetRegistry must be loaded before branchAssignmentMaster.js",
    );
  }

  const Registry = window.BancaTrackerDatasetRegistry;
  const {
    EMPLOYEE_ROLES,
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

  function normalizeBranchCode(value) {
    return normalizeText(value);
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

  function buildBranchId(bankId, branchCode) {
    const normalizedBankId = normalizeCode(bankId);
    const normalizedBranchCode = normalizeBranchCode(branchCode);

    return normalizedBankId && normalizedBranchCode
      ? `${normalizedBankId}:${normalizedBranchCode}`
      : null;
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
      category: DATA_QUALITY_CATEGORY.RM,
      field,
      value,
      message,
    };
  }

  function normalizeRow(rawRow, datasetId, rowNumber) {
    const bankId = normalizeCode(rawRow["BANK ID"]);
    const branchCode = normalizeBranchCode(rawRow["BRANCH CODE"]);
    const branchId = buildBranchId(bankId, branchCode);
    const rmId = normalizeCode(rawRow["RM ID"]);
    const relationshipKey =
      branchId && rmId ? `${branchId}:${rmId}` : `ROW:${rowNumber}`;

    return {
      datasetId,
      recordId: `${datasetId}:${relationshipKey}`,
      branchId,
      bankId,
      branchCode,
      rmId,
      active: normalizeBoolean(rawRow["ACTIVE"]),
      validFrom: normalizeText(rawRow["VALID FROM"]),
      validTo: normalizeText(rawRow["VALID TO"]),
      sourceRowNumber: rowNumber,
    };
  }

  function validateRow(record) {
    const findings = [];
    const requiredFields = [
      ["bankId", "ASSIGNMENT_BANK_ID_MISSING", "BANK ID"],
      ["branchCode", "ASSIGNMENT_BRANCH_CODE_MISSING", "BRANCH CODE"],
      ["rmId", "ASSIGNMENT_RM_ID_MISSING", "RM ID"],
    ];

    requiredFields.forEach(([property, code, field]) => {
      if (!record[property]) {
        findings.push(
          createFinding({
            code,
            severity: DATA_QUALITY_SEVERITY.ERROR,
            field,
            message: `${field} is required.`,
          }),
        );
      }
    });

    if (typeof record.active !== "boolean") {
      findings.push(
        createFinding({
          code: "ASSIGNMENT_ACTIVE_INVALID",
          severity: DATA_QUALITY_SEVERITY.ERROR,
          field: "ACTIVE",
          message: "ACTIVE must be a valid boolean value.",
        }),
      );
    }

    return findings;
  }

  function buildContextMap(context, directName, lookupName, recordsName, idName) {
    if (!context) {
      return null;
    }

    if (context[directName] instanceof Map) {
      return context[directName];
    }

    if (
      context[lookupName] &&
      context[lookupName][directName] instanceof Map
    ) {
      return context[lookupName][directName];
    }

    if (Array.isArray(context[recordsName])) {
      return new Map(
        context[recordsName]
          .filter((record) => record[idName])
          .map((record) => [record[idName], record]),
      );
    }

    return null;
  }

  function validateDataset(records, context = null) {
    const findings = [];
    const assignedBranches = new Set();
    const branchById = buildContextMap(
      context,
      "branchById",
      "branchLookupMaps",
      "branchRecords",
      "branchId",
    );
    const employeeById = buildContextMap(
      context,
      "employeeById",
      "employeeLookupMaps",
      "employeeRecords",
      "employeeId",
    );

    records.forEach((record) => {
      if (record.branchId) {
        if (assignedBranches.has(record.branchId)) {
          findings.push(
            createFinding({
              code: "ASSIGNMENT_MULTIPLE_ACTIVE_RMS",
              severity: DATA_QUALITY_SEVERITY.ERROR,
              field: "BRANCH CODE",
              value: record.branchId,
              message: `Multiple assignment rows exist for ${record.branchId}.`,
            }),
          );
        } else {
          assignedBranches.add(record.branchId);
        }
      }

      if (branchById && record.branchId) {
        const branch = branchById.get(record.branchId);

        if (!branch) {
          findings.push(
            createFinding({
              code: "ASSIGNMENT_BRANCH_UNMAPPED",
              severity: DATA_QUALITY_SEVERITY.ERROR,
              field: "BRANCH CODE",
              value: record.branchId,
              message: `Branch is not present in Branch Master: ${record.branchId}`,
            }),
          );
        } else if (branch.active === false) {
          findings.push(
            createFinding({
              code: "ASSIGNMENT_BRANCH_INACTIVE",
              severity: DATA_QUALITY_SEVERITY.WARNING,
              field: "BRANCH CODE",
              value: record.branchId,
              message: `Branch is inactive in Branch Master: ${record.branchId}`,
            }),
          );
        }
      }

      if (employeeById && record.rmId) {
        const employee = employeeById.get(record.rmId);

        if (!employee) {
          findings.push(
            createFinding({
              code: "ASSIGNMENT_RM_UNMAPPED",
              severity: DATA_QUALITY_SEVERITY.ERROR,
              field: "RM ID",
              value: record.rmId,
              message: `RM ID is not present in Employee Master: ${record.rmId}`,
            }),
          );
        } else {
          if (employee.role !== EMPLOYEE_ROLES.RM) {
            findings.push(
              createFinding({
                code: "ASSIGNMENT_EMPLOYEE_NOT_RM",
                severity: DATA_QUALITY_SEVERITY.ERROR,
                field: "RM ID",
                value: record.rmId,
                message: `Assigned employee does not have role RM: ${record.rmId}`,
              }),
            );
          }

          if (employee.active === false) {
            findings.push(
              createFinding({
                code: "ASSIGNMENT_RM_INACTIVE",
                severity: DATA_QUALITY_SEVERITY.WARNING,
                field: "RM ID",
                value: record.rmId,
                message: `Assigned RM is inactive: ${record.rmId}`,
              }),
            );
          }
        }
      }
    });

    if (!branchById) {
      findings.push(
        createFinding({
          code: "ASSIGNMENT_BRANCH_MASTER_ABSENT",
          severity: DATA_QUALITY_SEVERITY.WARNING,
          message: "Branch Master is absent; branch references were not validated.",
        }),
      );
    }

    if (!employeeById) {
      findings.push(
        createFinding({
          code: "ASSIGNMENT_EMPLOYEE_MASTER_ABSENT",
          severity: DATA_QUALITY_SEVERITY.WARNING,
          message: "Employee Master is absent; RM references were not validated.",
        }),
      );
    }

    return findings;
  }

  function prepareDataset(rawRows, datasetId, context = null) {
    if (!Array.isArray(rawRows)) {
      throw new TypeError("Branch Assignment rows must be an array.");
    }

    const records = rawRows.map((row, index) =>
      normalizeRow(row, datasetId, index + 2),
    );
    const findings = [];

    records.forEach((record) => findings.push(...validateRow(record)));
    findings.push(...validateDataset(records, context));

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

  window.BancaTrackerBranchAssignmentMaster = Object.freeze({
    normalizeText,
    normalizeCode,
    normalizeBoolean,
    normalizeBranchCode,
    buildBranchId,
    normalizeRow,
    validateRow,
    validateDataset,
    prepareDataset,
  });
})();
