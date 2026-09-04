/*==============================================================
BancaTracker Enterprise
Version : 8.3.0
File    : workforceDeployment.js
Module  : Master Data
Purpose : Normalize and validate native effective-dated workforce deployments
==============================================================*/

(function (global) {
  "use strict";
  if (!global.BancaTrackerEmployeeMaster) throw new Error("BancaTrackerEmployeeMaster must be loaded before workforceDeployment.js");
  if (!global.BancaTrackerBranchMaster) throw new Error("BancaTrackerBranchMaster must be loaded before workforceDeployment.js");

  const EmployeeMaster = global.BancaTrackerEmployeeMaster;
  const BranchMaster = global.BancaTrackerBranchMaster;
  const DEPLOYMENT_TYPES = Object.freeze(["PRIMARY", "SUPPORT"]); const INFINITY = "9999-12-31";
  function normalizeText(value) { return EmployeeMaster.normalizeText(value); }
  function normalizeCode(value) { return EmployeeMaster.normalizeCode(value); }
  function parseDate(value) {
    const normalized = normalizeText(value); if (!normalized) return Object.freeze({ value: null, valid: true });
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(normalized); if (!match) return Object.freeze({ value: normalized, valid: false });
    const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
    return Object.freeze({ value: normalized, valid: date.getUTCFullYear() === Number(match[1]) && date.getUTCMonth() === Number(match[2]) - 1 && date.getUTCDate() === Number(match[3]) });
  }
  function sourceValue(row, header, property) { return row && (row[header] !== undefined ? row[header] : row[property]); }
  function normalizeDeploymentType(value) { const normalized = normalizeCode(value); return DEPLOYMENT_TYPES.includes(normalized) ? normalized : null; }
  function normalizeRecord(rawRecord, datasetId, rowNumber) {
    const employeeId = normalizeCode(sourceValue(rawRecord, "EMPLOYEE ID", "employeeId"));
    const bankId = normalizeCode(sourceValue(rawRecord, "BANK ID", "bankId"));
    const branchCode = BranchMaster.normalizeBranchCode(sourceValue(rawRecord, "BRANCH CODE", "branchCode"));
    const branchId = BranchMaster.buildBranchId(bankId, branchCode);
    const typeInput = sourceValue(rawRecord, "DEPLOYMENT TYPE", "deploymentType"); const deploymentType = normalizeDeploymentType(typeInput);
    const validFrom = parseDate(sourceValue(rawRecord, "VALID FROM", "validFrom")); const validTo = parseDate(sourceValue(rawRecord, "VALID TO", "validTo"));
    const identity = employeeId && branchId && deploymentType && validFrom.value ? `${employeeId}:${branchId}:${deploymentType}:${validFrom.value}` : `ROW:${rowNumber}`;
    return Object.freeze({ recordId: `${datasetId}:${identity}`, datasetId, employeeId, bankId, branchCode, branchId, deploymentType, validFrom: validFrom.value, validTo: validTo.value, deploymentTypeInput: normalizeText(typeInput), dateValidity: Object.freeze({ validFrom: validFrom.valid, validTo: validTo.valid }), sourceRowNumber: rowNumber });
  }
  function intervalsOverlap(left, right) { return left.validFrom <= (right.validTo || INFINITY) && right.validFrom <= (left.validTo || INFINITY); }
  function finding(code, severity, record, message, extra = {}) { return Object.freeze({ code, severity, category: "WORKFORCE_DEPLOYMENT", field: extra.field || null, value: extra.value || null, recordId: record && record.recordId || null, sourceRowNumber: record && record.sourceRowNumber || null, message, ...extra }); }
  function mapById(records, property) { return new Map((Array.isArray(records) ? records : []).filter((record) => record && record[property]).map((record) => [normalizeCode(record[property]) || record[property], record])); }
  function validInterval(record) { return record && record.validFrom && record.dateValidity && record.dateValidity.validFrom && record.dateValidity.validTo && (!record.validTo || record.validTo >= record.validFrom); }
  function validateEmployment(record, employee, findings) {
    if (!employee) return; const joining = parseDate(employee.dateOfJoining); const exit = parseDate(employee.exitDate);
    if (!joining.value || !joining.valid) findings.push(finding("DEPLOYMENT_V2_EMPLOYMENT_BOUNDARY_UNVERIFIED", "WARNING", record, "Employee DATE OF JOINING is unavailable; lower boundary was not verified."));
    else if (record.validFrom < joining.value) findings.push(finding("DEPLOYMENT_V2_EMPLOYMENT_RANGE_CONFLICT", "ERROR", record, "Deployment begins before employee employment.", { referencedEmployeeId: record.employeeId }));
    if (employee.employmentStatus === "EXITED" && (!exit.value || !exit.valid)) findings.push(finding("DEPLOYMENT_V2_EMPLOYMENT_BOUNDARY_UNVERIFIED", "WARNING", record, "Exited employee has no verifiable EXIT DATE."));
    else if (exit.value && (!record.validTo || record.validTo > exit.value)) findings.push(finding("DEPLOYMENT_V2_EMPLOYMENT_RANGE_CONFLICT", "ERROR", record, "Deployment extends beyond employee employment.", { referencedEmployeeId: record.employeeId }));
    if (["INACTIVE", "SUSPENDED", "LEAVE"].includes(employee.employmentStatus)) findings.push(finding("DEPLOYMENT_V2_EMPLOYEE_STATE_CAUTION", "WARNING", record, "Employee current state requires interpretation; deployment history was retained.", { referencedEmployeeId: record.employeeId }));
  }
  function validateBranch(record, branch, findings) {
    if (!branch) return; const from = parseDate(branch.validFrom); const to = parseDate(branch.validTo);
    if ((branch.validFrom && !from.valid) || (branch.validTo && !to.valid) || !from.value) findings.push(finding("DEPLOYMENT_V2_BRANCH_BOUNDARY_UNVERIFIED", "WARNING", record, "Branch Master temporal boundary is incomplete or unverified."));
    else if (record.validFrom < from.value || (to.value && (!record.validTo || record.validTo > to.value))) findings.push(finding("DEPLOYMENT_V2_BRANCH_RANGE_CONFLICT", "ERROR", record, "Deployment lies outside known Branch Master dates.", { referencedBranchId: record.branchId }));
    if (branch.active === false) findings.push(finding("DEPLOYMENT_V2_BRANCH_INACTIVE_CAUTION", "WARNING", record, "Branch is inactive in the current Branch Master snapshot.", { referencedBranchId: record.branchId }));
  }
  function validateDataset(records, employeeRecords, branchRecords) {
    const source = Array.isArray(records) ? records : []; const findings = []; const employees = mapById(employeeRecords, "employeeId"); const branches = mapById(branchRecords, "branchId"); const identities = new Set(); const byEmployeeBranch = new Map(); const primariesByBranch = new Map();
    source.forEach((record) => {
      if (!record.employeeId) findings.push(finding("DEPLOYMENT_V2_EMPLOYEE_ID_MISSING", "ERROR", record, "EMPLOYEE ID is required.", { field: "EMPLOYEE ID" }));
      if (!record.branchId) findings.push(finding("DEPLOYMENT_V2_BRANCH_ID_MISSING", "ERROR", record, "BANK ID and BRANCH CODE are required.", { field: "BRANCH CODE" }));
      if (!record.deploymentTypeInput) findings.push(finding("DEPLOYMENT_V2_TYPE_MISSING", "ERROR", record, "DEPLOYMENT TYPE is required.", { field: "DEPLOYMENT TYPE" })); else if (!record.deploymentType) findings.push(finding("DEPLOYMENT_V2_TYPE_INVALID", "ERROR", record, "DEPLOYMENT TYPE must be PRIMARY or SUPPORT.", { field: "DEPLOYMENT TYPE", value: record.deploymentTypeInput }));
      if (!record.validFrom) findings.push(finding("DEPLOYMENT_V2_VALID_FROM_MISSING", "ERROR", record, "VALID FROM is required.", { field: "VALID FROM" }));
      if (!record.dateValidity || !record.dateValidity.validFrom || !record.dateValidity.validTo) findings.push(finding("DEPLOYMENT_V2_DATE_INVALID", "ERROR", record, "Deployment dates must be real YYYY-MM-DD values."));
      if (record.validFrom && record.validTo && record.validTo < record.validFrom) findings.push(finding("DEPLOYMENT_V2_DATE_ORDER_INVALID", "ERROR", record, "VALID TO cannot precede VALID FROM."));
      const identity = record.employeeId && record.branchId && record.deploymentType && record.validFrom ? `${record.employeeId}:${record.branchId}:${record.deploymentType}:${record.validFrom}` : null;
      if (identity && identities.has(identity)) findings.push(finding("DEPLOYMENT_V2_RELATIONSHIP_DUPLICATE", "ERROR", record, "Duplicate deployment relationship identity.")); if (identity) identities.add(identity);
      const employee = employees.get(record.employeeId); const branch = branches.get(record.branchId);
      if (record.employeeId && !employee) findings.push(finding("DEPLOYMENT_V2_EMPLOYEE_UNMAPPED", "ERROR", record, "EMPLOYEE ID is not present in Employee Master.", { referencedEmployeeId: record.employeeId }));
      if (record.branchId && !branch) findings.push(finding("DEPLOYMENT_V2_BRANCH_UNMAPPED", "ERROR", record, "Branch is not present in Branch Master.", { referencedBranchId: record.branchId }));
      if (validInterval(record)) { validateEmployment(record, employee, findings); validateBranch(record, branch, findings); const employeeBranch = `${record.employeeId}:${record.branchId}`; if (!byEmployeeBranch.has(employeeBranch)) byEmployeeBranch.set(employeeBranch, []); byEmployeeBranch.get(employeeBranch).push(record); if (record.deploymentType === "PRIMARY") { if (!primariesByBranch.has(record.branchId)) primariesByBranch.set(record.branchId, []); primariesByBranch.get(record.branchId).push(record); } }
    });
    byEmployeeBranch.forEach((items) => { const sorted = [...items].sort((a, b) => a.validFrom.localeCompare(b.validFrom)); for (let i = 1; i < sorted.length; i += 1) if (intervalsOverlap(sorted[i - 1], sorted[i])) findings.push(finding("DEPLOYMENT_V2_EMPLOYEE_BRANCH_OVERLAP", "ERROR", sorted[i], "Deployment intervals overlap for the same employee and branch.", { conflictingRecordId: sorted[i - 1].recordId })); });
    primariesByBranch.forEach((items) => { const sorted = [...items].sort((a, b) => a.validFrom.localeCompare(b.validFrom)); for (let i = 1; i < sorted.length; i += 1) if (intervalsOverlap(sorted[i - 1], sorted[i])) findings.push(finding("DEPLOYMENT_V2_BRANCH_PRIMARY_OVERLAP", "ERROR", sorted[i], "More than one PRIMARY deployment is effective for this branch.", { conflictingRecordId: sorted[i - 1].recordId })); });
    const errorCount = findings.filter((item) => item.severity === "ERROR").length; return Object.freeze({ valid: errorCount === 0, status: errorCount ? "INVALID" : "VALID", errorCount, warningCount: findings.length - errorCount, findings: Object.freeze(findings) });
  }
  function prepareDataset(rawRows, datasetId, employeeRecords, branchRecords) { const records = Object.freeze((Array.isArray(rawRows) ? rawRows : []).map((row, index) => normalizeRecord(row, datasetId, index + 2))); const validation = validateDataset(records, employeeRecords, branchRecords); return Object.freeze({ records, ...validation }); }
  global.BancaTrackerWorkforceDeployment = Object.freeze({ DEPLOYMENT_TYPES, normalizeText, normalizeCode, normalizeDeploymentType, parseDate, normalizeRecord, intervalsOverlap, validateDataset, prepareDataset });
})(window);
