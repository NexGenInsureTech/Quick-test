/*==============================================================
BancaTracker Enterprise
Version : 8.2.0-dev
File    : hierarchyMaster.js
Module  : Master Data
Purpose : Normalize and validate organisation reporting relationships
==============================================================*/

(function () {
  "use strict";

  if (!window.BancaTrackerDatasetRegistry) {
    throw new Error(
      "BancaTrackerDatasetRegistry must be loaded before hierarchyMaster.js",
    );
  }

  const Registry = window.BancaTrackerDatasetRegistry;
  const {
    EMPLOYEE_ROLES,
    DATA_QUALITY_SEVERITY,
    DATA_QUALITY_CATEGORY,
  } = Registry;

  const EXPECTED_MANAGER_ROLE = Object.freeze({
    [EMPLOYEE_ROLES.RM]: EMPLOYEE_ROLES.CSM,
    [EMPLOYEE_ROLES.CSM]: EMPLOYEE_ROLES.ASM,
    [EMPLOYEE_ROLES.ASM]: EMPLOYEE_ROLES.ZSM,
    [EMPLOYEE_ROLES.ZSM]: EMPLOYEE_ROLES.NATIONAL_HEAD,
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
    const managerId = normalizeCode(rawRow["MANAGER ID"]);
    const relationshipKey = employeeId
      ? `${employeeId}:${managerId || "ROOT"}`
      : `ROW:${rowNumber}`;

    return {
      recordId: `${datasetId}:${relationshipKey}`,
      datasetId,
      employeeId,
      managerId,
      validFrom: normalizeText(rawRow["VALID FROM"]),
      validTo: normalizeText(rawRow["VALID TO"]),
      sourceRowNumber: rowNumber,
    };
  }

  function validateRow(record) {
    if (record.employeeId) {
      return [];
    }

    return [
      createFinding({
        code: "HIERARCHY_EMPLOYEE_ID_MISSING",
        severity: DATA_QUALITY_SEVERITY.ERROR,
        field: "EMPLOYEE ID",
        message: "EMPLOYEE ID is required.",
      }),
    ];
  }

  function buildEmployeeMap(context) {
    if (!context) {
      return null;
    }

    if (context.employeeById instanceof Map) {
      return context.employeeById;
    }

    if (
      context.employeeLookupMaps &&
      context.employeeLookupMaps.employeeById instanceof Map
    ) {
      return context.employeeLookupMaps.employeeById;
    }

    if (Array.isArray(context.employeeRecords)) {
      return new Map(
        context.employeeRecords
          .filter((record) => record.active !== false && record.employeeId)
          .map((record) => [record.employeeId, record]),
      );
    }

    return null;
  }

  function detectCycle(records) {
    const managerByEmployeeId = new Map();

    records.forEach((record) => {
      if (
        record.employeeId &&
        record.managerId &&
        !managerByEmployeeId.has(record.employeeId)
      ) {
        managerByEmployeeId.set(record.employeeId, record.managerId);
      }
    });

    const visitState = new Map();

    function visit(employeeId) {
      const state = visitState.get(employeeId);

      if (state === "VISITING") {
        return true;
      }

      if (state === "VISITED") {
        return false;
      }

      visitState.set(employeeId, "VISITING");

      const managerId = managerByEmployeeId.get(employeeId);

      if (managerId && visit(managerId)) {
        return true;
      }

      visitState.set(employeeId, "VISITED");
      return false;
    }

    return Array.from(managerByEmployeeId.keys()).some(visit);
  }

  function validateDataset(records, context = null) {
    const findings = [];
    const employeeMap = buildEmployeeMap(context);
    const relationshipEmployees = new Set();

    records.forEach((record) => {
      if (record.employeeId) {
        if (relationshipEmployees.has(record.employeeId)) {
          findings.push(
            createFinding({
              code: "HIERARCHY_MULTIPLE_MANAGERS",
              severity: DATA_QUALITY_SEVERITY.ERROR,
              field: "EMPLOYEE ID",
              value: record.employeeId,
              message: `Multiple hierarchy relationships exist for ${record.employeeId}.`,
            }),
          );
        } else {
          relationshipEmployees.add(record.employeeId);
        }
      }

      if (
        record.employeeId &&
        record.managerId &&
        record.employeeId === record.managerId
      ) {
        findings.push(
          createFinding({
            code: "HIERARCHY_SELF_REFERENCE",
            severity: DATA_QUALITY_SEVERITY.ERROR,
            field: "MANAGER ID",
            value: record.employeeId,
            message: "An employee cannot report to themselves.",
          }),
        );
      }

      if (!employeeMap || !record.employeeId) {
        return;
      }

      const employee = employeeMap.get(record.employeeId);
      const manager = record.managerId
        ? employeeMap.get(record.managerId)
        : null;

      if (!employee) {
        findings.push(
          createFinding({
            code: "HIERARCHY_EMPLOYEE_UNMAPPED",
            severity: DATA_QUALITY_SEVERITY.ERROR,
            field: "EMPLOYEE ID",
            value: record.employeeId,
            message: `EMPLOYEE ID is not present in Employee Master: ${record.employeeId}`,
          }),
        );
        return;
      }

      if (employee.role === EMPLOYEE_ROLES.NATIONAL_HEAD) {
        if (record.managerId) {
          findings.push(
            createFinding({
              code: "HIERARCHY_MANAGER_NOT_ALLOWED",
              severity: DATA_QUALITY_SEVERITY.ERROR,
              field: "MANAGER ID",
              value: record.managerId,
              message: "A NATIONAL_HEAD cannot have a manager.",
            }),
          );
        }
        return;
      }

      if (!record.managerId) {
        findings.push(
          createFinding({
            code: "HIERARCHY_MANAGER_REQUIRED",
            severity: DATA_QUALITY_SEVERITY.ERROR,
            field: "MANAGER ID",
            value: record.employeeId,
            message: `A manager is required for ${record.employeeId}.`,
          }),
        );
        return;
      }

      if (!manager) {
        findings.push(
          createFinding({
            code: "HIERARCHY_MANAGER_UNMAPPED",
            severity: DATA_QUALITY_SEVERITY.ERROR,
            field: "MANAGER ID",
            value: record.managerId,
            message: `MANAGER ID is not present in Employee Master: ${record.managerId}`,
          }),
        );
        return;
      }

      if (EXPECTED_MANAGER_ROLE[employee.role] !== manager.role) {
        findings.push(
          createFinding({
            code: "HIERARCHY_ROLE_MISMATCH",
            severity: DATA_QUALITY_SEVERITY.ERROR,
            field: "MANAGER ID",
            value: record.managerId,
            message: `${employee.role} must report to ${EXPECTED_MANAGER_ROLE[employee.role]}.`,
          }),
        );
      }
    });

    if (!employeeMap) {
      findings.push(
        createFinding({
          code: "HIERARCHY_EMPLOYEE_MASTER_ABSENT",
          severity: DATA_QUALITY_SEVERITY.WARNING,
          message: "Employee Master is absent; hierarchy references were not validated.",
        }),
      );
    }

    if (detectCycle(records)) {
      findings.push(
        createFinding({
          code: "HIERARCHY_CYCLE_DETECTED",
          severity: DATA_QUALITY_SEVERITY.ERROR,
          message: "A cycle exists in the hierarchy relationship graph.",
        }),
      );
    }

    return findings;
  }

  function prepareDataset(rawRows, datasetId, context = null) {
    if (!Array.isArray(rawRows)) {
      throw new TypeError("Hierarchy rows must be an array.");
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

  window.BancaTrackerHierarchyMaster = Object.freeze({
    EXPECTED_MANAGER_ROLE,
    normalizeText,
    normalizeCode,
    normalizeRow,
    validateRow,
    validateDataset,
    detectCycle,
    prepareDataset,
  });
})();
