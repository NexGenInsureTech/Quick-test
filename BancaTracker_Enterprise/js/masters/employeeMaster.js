/*==============================================================
BancaTracker Enterprise
Version : 8.2.0
File    : employeeMaster.js
Module  : Master Data
Purpose : Normalize and validate durable Employee Master v2 records
==============================================================*/

(function () {
  "use strict";
  if (!window.BancaTrackerDatasetRegistry) throw new Error("BancaTrackerDatasetRegistry must be loaded before employeeMaster.js");

  const Registry = window.BancaTrackerDatasetRegistry;
  const { EMPLOYEE_ROLES, DATA_QUALITY_SEVERITY, DATA_QUALITY_CATEGORY } = Registry;
  const ROLE_ALIASES = Object.freeze({
    NATIONAL_HEAD: EMPLOYEE_ROLES.NATIONAL_HEAD, "NATIONAL HEAD": EMPLOYEE_ROLES.NATIONAL_HEAD, NH: EMPLOYEE_ROLES.NATIONAL_HEAD,
    ZSM: EMPLOYEE_ROLES.ZSM, "ZONAL SALES MANAGER": EMPLOYEE_ROLES.ZSM,
    ASM: EMPLOYEE_ROLES.ASM, "AREA SALES MANAGER": EMPLOYEE_ROLES.ASM,
    CSM: EMPLOYEE_ROLES.CSM, "CHANNEL SALES MANAGER": EMPLOYEE_ROLES.CSM,
    RM: EMPLOYEE_ROLES.RM, "RELATIONSHIP MANAGER": EMPLOYEE_ROLES.RM,
  });
  const EMPLOYMENT_STATUSES = Object.freeze(["ACTIVE", "INACTIVE", "EXITED", "SUSPENDED", "LEAVE"]);
  const EMPLOYMENT_TYPES = Object.freeze(["REGULAR", "CONTRACT", "PROBATION", "INTERN", "TEMPORARY", "CONSULTANT", "OTHER"]);

  function normalizeText(value) {
    if (value === null || typeof value === "undefined") return null;
    const normalized = String(value).replace(/\u00A0/g, " ").trim().replace(/\s+/g, " ");
    return normalized || null;
  }
  function normalizeCode(value) { const normalized = normalizeText(value); return normalized ? normalized.toUpperCase() : null; }
  function normalizeBoolean(value) {
    if (typeof value === "boolean") return value;
    const normalized = normalizeCode(value);
    if (["TRUE", "YES", "Y", "1"].includes(normalized)) return true;
    if (["FALSE", "NO", "N", "0"].includes(normalized)) return false;
    return null;
  }
  function normalizeRole(value) { const normalized = normalizeCode(value); return normalized ? ROLE_ALIASES[normalized] || null : null; }
  function normalizeEmploymentStatus(value) { const normalized = normalizeCode(value); return EMPLOYMENT_STATUSES.includes(normalized) ? normalized : null; }
  function normalizeEmploymentType(value) { return normalizeCode(value); }
  function normalizeDate(value) {
    const normalized = normalizeText(value);
    if (!normalized) return { value: null, valid: true };
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(normalized);
    if (!match) return { value: normalized, valid: false };
    const year = Number(match[1]); const month = Number(match[2]); const day = Number(match[3]);
    const date = new Date(Date.UTC(year, month - 1, day));
    return { value: normalized, valid: date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day };
  }
  function activeForStatus(status) {
    if (["ACTIVE", "LEAVE"].includes(status)) return true;
    if (["INACTIVE", "EXITED", "SUSPENDED"].includes(status)) return false;
    return null;
  }
  function createFinding({ code, severity, field = null, value = null, message }) { return { code, severity, category: DATA_QUALITY_CATEGORY.HIERARCHY, field, value, message }; }

  function normalizeRow(rawRow, datasetId, rowNumber) {
    const employeeId = normalizeCode(rawRow["EMPLOYEE ID"]);
    const designationInput = normalizeText(rawRow.DESIGNATION);
    const legacyRole = normalizeText(rawRow.ROLE);
    const statusInput = normalizeText(rawRow["EMPLOYMENT STATUS"]);
    const activeText = normalizeText(rawRow.ACTIVE);
    const activeSupplied = activeText !== null;
    const activeInput = activeSupplied ? normalizeBoolean(activeText) : null;
    const dateOfJoining = normalizeDate(rawRow["DATE OF JOINING"]);
    const channelJoinDate = normalizeDate(rawRow["CHANNEL JOIN DATE"]);
    const designationEffectiveDate = normalizeDate(rawRow["DESIGNATION EFFECTIVE DATE"]);
    const exitDate = normalizeDate(rawRow["EXIT DATE"]);
    const suppliedStatus = normalizeEmploymentStatus(statusInput);
    const employmentStatus = suppliedStatus || (statusInput === null && activeInput !== null ? (activeInput ? "ACTIVE" : "INACTIVE") : null);
    return {
      recordId: employeeId ? `${datasetId}:${employeeId}` : `${datasetId}:ROW:${rowNumber}`,
      datasetId, employeeId, employeeName: normalizeText(rawRow["EMPLOYEE NAME"]),
      designation: designationInput || legacyRole || null,
      grade: normalizeText(rawRow.GRADE), band: normalizeText(rawRow.BAND),
      employmentType: normalizeEmploymentType(rawRow["EMPLOYMENT TYPE"]),
      functionName: normalizeText(rawRow.FUNCTION), channelName: normalizeText(rawRow.CHANNEL), baseLocation: normalizeText(rawRow["BASE LOCATION"]),
      dateOfJoining: dateOfJoining.value, channelJoinDate: channelJoinDate.value, designationEffectiveDate: designationEffectiveDate.value, exitDate: exitDate.value,
      employmentStatus, active: activeForStatus(employmentStatus),
      legacyRole, legacyHierarchyRole: normalizeRole(legacyRole), role: normalizeRole(legacyRole),
      activeInput, activeSupplied, statusInput,
      compatibilityMode: designationInput === null && statusInput === null && legacyRole !== null,
      dateValidity: Object.freeze({ dateOfJoining: dateOfJoining.valid, channelJoinDate: channelJoinDate.valid, designationEffectiveDate: designationEffectiveDate.valid, exitDate: exitDate.valid }),
      validFrom: normalizeText(rawRow["VALID FROM"]), validTo: normalizeText(rawRow["VALID TO"]), sourceRowNumber: rowNumber,
    };
  }

  function validateRow(record, options = {}) {
    const findings = [];
    const error = (code, field, message, value = null) => findings.push(createFinding({ code, severity: DATA_QUALITY_SEVERITY.ERROR, field, value, message }));
    const warning = (code, field, message, value = null) => findings.push(createFinding({ code, severity: DATA_QUALITY_SEVERITY.WARNING, field, value, message }));
    if (!record.employeeId) error("EMPLOYEE_ID_MISSING", "EMPLOYEE ID", "EMPLOYEE ID is required.");
    if (!record.employeeName) error("EMPLOYEE_NAME_MISSING", "EMPLOYEE NAME", "EMPLOYEE NAME is required.");
    if (!record.designation) error("EMPLOYEE_DESIGNATION_MISSING", "DESIGNATION", "DESIGNATION is required for native v2 records or through transitional ROLE.");
    if (record.statusInput !== null && !normalizeEmploymentStatus(record.statusInput)) error("EMPLOYEE_STATUS_INVALID", "EMPLOYMENT STATUS", "EMPLOYMENT STATUS must be supported.", record.statusInput);
    if (!record.employmentStatus) error("EMPLOYEE_STATUS_MISSING", "EMPLOYMENT STATUS", "EMPLOYMENT STATUS is required for native v2 records or through transitional ACTIVE.");
    if (record.activeSupplied && typeof record.activeInput !== "boolean") error("EMPLOYEE_ACTIVE_INVALID", "ACTIVE", "ACTIVE must be a valid boolean value.");
    Object.entries(record.dateValidity).forEach(([key, valid]) => { if (!valid) error("EMPLOYEE_DATE_INVALID", key, "Employee dates must use a real YYYY-MM-DD value.", record[key]); });
    const datesValid = Object.values(record.dateValidity).every(Boolean);
    if (datesValid) {
      const { dateOfJoining: joining, channelJoinDate: channel, designationEffectiveDate: designation, exitDate: exit } = record;
      if ((joining && channel && channel < joining) || (joining && designation && designation < joining) || (joining && exit && exit < joining) || (channel && exit && exit < channel) || (designation && exit && exit < designation)) error("EMPLOYEE_DATE_ORDER_INVALID", null, "Employee dates violate the authoritative date ordering rules.");
    }
    const asOfDate = options.asOfDate || null;
    if (record.employmentStatus === "EXITED" && (!record.exitDate || (asOfDate && record.exitDate > asOfDate))) error("EMPLOYEE_STATUS_DATE_CONFLICT", "EXIT DATE", "EXITED employees require an effective EXIT DATE.");
    if (record.employmentStatus === "ACTIVE" && record.exitDate && (!asOfDate || record.exitDate <= asOfDate)) error("EMPLOYEE_STATUS_DATE_CONFLICT", "EXIT DATE", "ACTIVE employees cannot have an effective EXIT DATE.");
    if (record.employmentStatus && record.activeSupplied && typeof record.activeInput === "boolean" && activeForStatus(record.employmentStatus) !== record.activeInput) error("EMPLOYEE_STATUS_ACTIVE_CONFLICT", "ACTIVE", "ACTIVE contradicts EMPLOYMENT STATUS.");
    if (record.compatibilityMode) warning("EMPLOYEE_LEGACY_ROLE_USED", "ROLE", "DESIGNATION was populated from transitional ROLE.", record.legacyRole);
    if (record.statusInput === null && typeof record.activeInput === "boolean") warning("EMPLOYEE_LEGACY_ACTIVE_USED", "ACTIVE", "EMPLOYMENT STATUS was derived from transitional ACTIVE.");
    if (record.legacyRole && normalizeCode(record.designation) !== normalizeCode(record.legacyRole)) warning("EMPLOYEE_ROLE_DESIGNATION_DIFFER", "ROLE", "ROLE differs from DESIGNATION; DESIGNATION remains descriptive.", record.legacyRole);
    if (record.employmentType && !EMPLOYMENT_TYPES.includes(record.employmentType)) warning("EMPLOYEE_EMPLOYMENT_TYPE_UNKNOWN", "EMPLOYMENT TYPE", "Unknown EMPLOYMENT TYPE was retained.", record.employmentType);
    if (asOfDate && datesValid && [record.dateOfJoining, record.channelJoinDate, record.designationEffectiveDate, record.exitDate].some((date) => date && date > asOfDate)) warning("EMPLOYEE_DATE_FUTURE_EFFECTIVE", null, "One or more employee dates are later than the dataset as-of date.");
    return findings;
  }

  function validateDataset(records) {
    const findings = []; const seen = new Map();
    records.forEach((record) => {
      if (!record.employeeId) return;
      const first = seen.get(record.employeeId);
      if (!first) { seen.set(record.employeeId, record); return; }
      findings.push(createFinding({ code: "EMPLOYEE_DUPLICATE_ID", severity: DATA_QUALITY_SEVERITY.ERROR, field: "EMPLOYEE ID", value: record.employeeId, message: `Duplicate EMPLOYEE ID: ${record.employeeId}` }));
      if (record.active === true && first.active === true) findings.push(createFinding({ code: "EMPLOYEE_DUPLICATE_ACTIVE_RECORD", severity: DATA_QUALITY_SEVERITY.ERROR, field: "EMPLOYEE ID", value: record.employeeId, message: `Duplicate active Employee Master record: ${record.employeeId}` }));
    });
    return findings;
  }

  function prepareDataset(rawRows, datasetId, options = {}) {
    if (!Array.isArray(rawRows)) throw new TypeError("Employee Master rows must be an array.");
    const normalizedAsOf = options.asOfDate ? normalizeDate(options.asOfDate) : { value: null, valid: true };
    if (!normalizedAsOf.valid) throw new TypeError("Employee Master asOfDate must use YYYY-MM-DD.");
    const records = rawRows.map((row, index) => normalizeRow(row, datasetId, index + 2));
    const findings = [];
    records.forEach((record) => findings.push(...validateRow(record, { asOfDate: normalizedAsOf.value })));
    findings.push(...validateDataset(records));
    const errorCount = findings.filter((finding) => finding.severity === DATA_QUALITY_SEVERITY.ERROR).length;
    const warningCount = findings.filter((finding) => finding.severity === DATA_QUALITY_SEVERITY.WARNING).length;
    return { records, findings, valid: errorCount === 0, errorCount, warningCount };
  }

  window.BancaTrackerEmployeeMaster = Object.freeze({
    ROLE_ALIASES, EMPLOYMENT_STATUSES, EMPLOYMENT_TYPES, normalizeText, normalizeCode, normalizeBoolean, normalizeRole,
    normalizeEmploymentStatus, normalizeEmploymentType, normalizeDate, normalizeRow, validateRow, validateDataset, prepareDataset,
  });
})();
