/*==============================================================
BancaTracker Enterprise
Version : 8.3.0
File    : businessAttribution.js
Module  : Enrichment Foundation
Purpose : Resolve one-or-zero direct employee attribution for canonical PR Actual
==============================================================*/

(function (global) {
  "use strict";

  if (!global.BancaTrackerEmployeeMaster) {
    throw new Error("BancaTrackerEmployeeMaster must be loaded before businessAttribution.js");
  }

  const EmployeeMaster = global.BancaTrackerEmployeeMaster;
  const ATTRIBUTION_STATUSES = Object.freeze({
    SOURCE: "ATTRIBUTED_SOURCE_RM_ID",
    LEGACY_ASSIGNMENT: "ATTRIBUTED_LEGACY_BRANCH_ASSIGNMENT",
    UNATTRIBUTED: "UNATTRIBUTED",
    EXCLUDED: "EXCLUDED",
  });
  const EVIDENCE_TYPES = Object.freeze({
    SOURCE_RM_ID: "SOURCE_RM_ID",
    LEGACY_BRANCH_ASSIGNMENT: "LEGACY_BRANCH_ASSIGNMENT",
    NONE: "NONE",
  });
  const ACTIVE_STATUSES = new Set(["ACTIVE", "LEAVE"]);

  function parseDate(value) {
    return EmployeeMaster.normalizeDate(value);
  }

  function freezeDiagnostics(values) {
    return Object.freeze([...new Set(values.filter(Boolean))].sort());
  }

  function emptyResult(record, businessDate, diagnostics, extra) {
    return Object.freeze({
      attributionStatus: ATTRIBUTION_STATUSES.UNATTRIBUTED,
      employeeId: null,
      evidenceType: EVIDENCE_TYPES.NONE,
      confidence: "UNRESOLVED",
      businessDate,
      signedActual: record && record.premium,
      diagnostics: freezeDiagnostics(diagnostics),
      ...extra,
    });
  }

  function buildEmployeeLookup(records) {
    const employeeById = new Map();
    const ambiguousEmployeeIds = new Set();
    (Array.isArray(records) ? records : []).forEach((record) => {
      const employeeId = EmployeeMaster.normalizeCode(record && record.employeeId);
      if (!employeeId) return;
      if (employeeById.has(employeeId)) ambiguousEmployeeIds.add(employeeId);
      else employeeById.set(employeeId, record);
    });
    return Object.freeze({ employeeById, ambiguousEmployeeIds });
  }

  function isLegacyAssignmentRecord(record) {
    return Boolean(record && record.branchId && record.rmId && !record.deploymentType && !record.employeeId);
  }

  function buildLegacyAssignmentLookup(records) {
    const assignmentByBranchId = new Map();
    const ambiguousBranchIds = new Set();
    (Array.isArray(records) ? records : []).filter(isLegacyAssignmentRecord).forEach((record) => {
      if (record.active === false) return;
      const branchId = EmployeeMaster.normalizeText(record.branchId);
      if (!branchId) return;
      if (assignmentByBranchId.has(branchId)) ambiguousBranchIds.add(branchId);
      else assignmentByBranchId.set(branchId, record);
    });
    return Object.freeze({ assignmentByBranchId, ambiguousBranchIds });
  }

  function employeeResolution(employeeId, employeeLookup, businessDate) {
    if (!employeeLookup) return Object.freeze({ status: "UNAVAILABLE", employee: null, diagnostics: freezeDiagnostics(["ATTRIBUTION_EMPLOYEE_MASTER_UNAVAILABLE"]) });
    if (employeeLookup.ambiguousEmployeeIds.has(employeeId)) return Object.freeze({ status: "AMBIGUOUS", employee: null, diagnostics: freezeDiagnostics(["ATTRIBUTION_SOURCE_RM_ID_AMBIGUOUS"]) });
    const employee = employeeLookup.employeeById.get(employeeId);
    if (!employee) return Object.freeze({ status: "UNMAPPED", employee: null, diagnostics: freezeDiagnostics(["ATTRIBUTION_SOURCE_RM_ID_UNMAPPED"]) });
    const joining = parseDate(employee.dateOfJoining);
    const exit = parseDate(employee.exitDate);
    if (!joining.valid || !exit.valid) return Object.freeze({ status: "UNAVAILABLE", employee: null, diagnostics: freezeDiagnostics(["ATTRIBUTION_EMPLOYEE_EFFECTIVITY_UNVERIFIED"]) });
    if (joining.value && joining.value > businessDate) return Object.freeze({ status: "NOT_EFFECTIVE", employee: null, diagnostics: freezeDiagnostics(["ATTRIBUTION_EMPLOYEE_NOT_EFFECTIVE"]) });
    if (exit.value && exit.value < businessDate) return Object.freeze({ status: "NOT_EFFECTIVE", employee: null, diagnostics: freezeDiagnostics(["ATTRIBUTION_EMPLOYEE_NOT_EFFECTIVE"]) });
    if (employee.employmentStatus === "EXITED" && !exit.value) return Object.freeze({ status: "UNAVAILABLE", employee: null, diagnostics: freezeDiagnostics(["ATTRIBUTION_EMPLOYEE_EFFECTIVITY_UNVERIFIED"]) });
    if (employee.employmentStatus && !ACTIVE_STATUSES.has(employee.employmentStatus) && !(employee.employmentStatus === "EXITED" && exit.value >= businessDate)) return Object.freeze({ status: "NOT_EFFECTIVE", employee: null, diagnostics: freezeDiagnostics(["ATTRIBUTION_EMPLOYEE_NOT_EFFECTIVE"]) });
    if (employee.active === false && employee.employmentStatus !== "EXITED") return Object.freeze({ status: "NOT_EFFECTIVE", employee: null, diagnostics: freezeDiagnostics(["ATTRIBUTION_EMPLOYEE_NOT_EFFECTIVE"]) });
    return Object.freeze({ status: "RESOLVED", employee, diagnostics: freezeDiagnostics([]) });
  }

  function assignmentEffectiveAt(record, businessDate) {
    const validFrom = parseDate(record.validFrom);
    const validTo = parseDate(record.validTo);
    if (!validFrom.valid || !validTo.valid) return Object.freeze({ status: "UNAVAILABLE", diagnostics: freezeDiagnostics(["ATTRIBUTION_ASSIGNMENT_EFFECTIVITY_UNVERIFIED"]) });
    if (validFrom.value && validFrom.value > businessDate) return Object.freeze({ status: "NOT_EFFECTIVE", diagnostics: freezeDiagnostics(["ATTRIBUTION_ASSIGNMENT_NOT_EFFECTIVE"]) });
    if (validTo.value && validTo.value < businessDate) return Object.freeze({ status: "NOT_EFFECTIVE", diagnostics: freezeDiagnostics(["ATTRIBUTION_ASSIGNMENT_NOT_EFFECTIVE"]) });
    return Object.freeze({ status: "RESOLVED", diagnostics: freezeDiagnostics([]) });
  }

  function legacyAssignmentCandidate(branchId, assignmentLookup, businessDate) {
    if (!assignmentLookup) return Object.freeze({ status: "UNAVAILABLE", rmId: null, diagnostics: freezeDiagnostics(["ATTRIBUTION_ASSIGNMENT_UNAVAILABLE"]) });
    if (!branchId) return Object.freeze({ status: "UNMAPPED", rmId: null, diagnostics: freezeDiagnostics(["ATTRIBUTION_BRANCH_UNRESOLVED"]) });
    if (assignmentLookup.ambiguousBranchIds.has(branchId)) return Object.freeze({ status: "AMBIGUOUS", rmId: null, diagnostics: freezeDiagnostics(["ATTRIBUTION_ASSIGNMENT_AMBIGUOUS"]) });
    const assignment = assignmentLookup.assignmentByBranchId.get(branchId);
    if (!assignment) return Object.freeze({ status: "UNMAPPED", rmId: null, diagnostics: freezeDiagnostics(["ATTRIBUTION_ASSIGNMENT_UNAVAILABLE"]) });
    const effective = assignmentEffectiveAt(assignment, businessDate);
    if (effective.status !== "RESOLVED") return Object.freeze({ status: effective.status, rmId: null, diagnostics: effective.diagnostics });
    return Object.freeze({ status: "RESOLVED", rmId: EmployeeMaster.normalizeCode(assignment.rmId), diagnostics: freezeDiagnostics([]) });
  }

  function resolveAttribution(record, context = {}) {
    const source = record || {};
    if (source.status === "INVALID" || source.rowStatus === "INVALID") {
      return Object.freeze({ attributionStatus: ATTRIBUTION_STATUSES.EXCLUDED, employeeId: null, evidenceType: EVIDENCE_TYPES.NONE, confidence: "EXCLUDED", businessDate: source.policyIssuedDate || null, signedActual: source.premium, diagnostics: freezeDiagnostics(["ATTRIBUTION_CANONICAL_RECORD_EXCLUDED"]) });
    }
    const date = parseDate(source.policyIssuedDate);
    if (!date.value || !date.valid) return emptyResult(source, null, ["ATTRIBUTION_BUSINESS_DATE_UNAVAILABLE"]);
    const employeeLookup = context.employeeLookup || (Array.isArray(context.employeeRecords) ? buildEmployeeLookup(context.employeeRecords) : null);
    const assignmentLookup = context.legacyAssignmentLookup || (Array.isArray(context.legacyAssignmentRecords) ? buildLegacyAssignmentLookup(context.legacyAssignmentRecords) : null);
    const sourceRmId = EmployeeMaster.normalizeCode(source.sourceRmId);
    const branchId = EmployeeMaster.normalizeText(source.branchId);

    if (sourceRmId) {
      const direct = employeeResolution(sourceRmId, employeeLookup, date.value);
      if (direct.status !== "RESOLVED") return emptyResult(source, date.value, direct.diagnostics, { sourceRmId });
      const assignment = legacyAssignmentCandidate(branchId, assignmentLookup, date.value);
      if (assignment.status === "RESOLVED" && assignment.rmId !== sourceRmId) return emptyResult(source, date.value, ["ATTRIBUTION_SOURCE_ASSIGNED_RM_CONFLICT"], { sourceRmId, assignedRmId: assignment.rmId });
      return Object.freeze({ attributionStatus: ATTRIBUTION_STATUSES.SOURCE, employeeId: sourceRmId, evidenceType: EVIDENCE_TYPES.SOURCE_RM_ID, confidence: "EXACT", businessDate: date.value, signedActual: source.premium, diagnostics: freezeDiagnostics(["SOURCE_RM_ID_MATCHED"]), sourceRmId });
    }

    const assignment = legacyAssignmentCandidate(branchId, assignmentLookup, date.value);
    if (assignment.status !== "RESOLVED") return emptyResult(source, date.value, ["ATTRIBUTION_SOURCE_RM_ID_MISSING", ...assignment.diagnostics]);
    const fallback = employeeResolution(assignment.rmId, employeeLookup, date.value);
    if (fallback.status !== "RESOLVED") return emptyResult(source, date.value, ["ATTRIBUTION_SOURCE_RM_ID_MISSING", ...fallback.diagnostics], { assignedRmId: assignment.rmId });
    return Object.freeze({ attributionStatus: ATTRIBUTION_STATUSES.LEGACY_ASSIGNMENT, employeeId: assignment.rmId, evidenceType: EVIDENCE_TYPES.LEGACY_BRANCH_ASSIGNMENT, confidence: "COMPATIBILITY", businessDate: date.value, signedActual: source.premium, diagnostics: freezeDiagnostics(["COMPATIBILITY_ATTRIBUTION", "LEGACY_BRANCH_ASSIGNMENT_MATCHED", "ATTRIBUTION_SOURCE_RM_ID_MISSING"]), assignedRmId: assignment.rmId });
  }

  function resolveBatch(records, context = {}) {
    const results = Object.freeze((Array.isArray(records) ? records : []).map((record) => resolveAttribution(record, context)));
    return Object.freeze({ results, summary: summarize(results) });
  }

  function summarize(results) {
    const summary = { totalRecords: 0, attributedRecords: 0, unattributedRecords: 0, excludedRecords: 0, directSourceAttributed: 0, legacyFallbackAttributed: 0, unmappedSourceIdentities: 0, statusCounts: {}, diagnosticCounts: {}, totalSignedActual: 0, attributedSignedActual: 0, unattributedSignedActual: 0, excludedSignedActual: 0 };
    (Array.isArray(results) ? results : []).forEach((result) => {
      summary.totalRecords += 1;
      summary.statusCounts[result.attributionStatus] = (summary.statusCounts[result.attributionStatus] || 0) + 1;
      (result.diagnostics || []).forEach((code) => { summary.diagnosticCounts[code] = (summary.diagnosticCounts[code] || 0) + 1; });
      const premium = Number(result.signedActual); const signedActual = Number.isFinite(premium) ? premium : 0;
      if (result.attributionStatus === ATTRIBUTION_STATUSES.EXCLUDED) { summary.excludedRecords += 1; summary.excludedSignedActual += signedActual; return; }
      summary.totalSignedActual += signedActual;
      if (result.employeeId) { summary.attributedRecords += 1; summary.attributedSignedActual += signedActual; if (result.attributionStatus === ATTRIBUTION_STATUSES.SOURCE) summary.directSourceAttributed += 1; if (result.attributionStatus === ATTRIBUTION_STATUSES.LEGACY_ASSIGNMENT) summary.legacyFallbackAttributed += 1; }
      else { summary.unattributedRecords += 1; summary.unattributedSignedActual += signedActual; }
      if ((result.diagnostics || []).includes("ATTRIBUTION_SOURCE_RM_ID_UNMAPPED")) summary.unmappedSourceIdentities += 1;
    });
    summary.reconciliation = Object.freeze({ underlyingSignedActual: summary.totalSignedActual, attributedSignedActual: summary.attributedSignedActual, unattributedSignedActual: summary.unattributedSignedActual, difference: summary.totalSignedActual - summary.attributedSignedActual - summary.unattributedSignedActual, complete: summary.totalSignedActual === summary.attributedSignedActual + summary.unattributedSignedActual });
    return Object.freeze(summary);
  }

  global.BancaTrackerBusinessAttribution = Object.freeze({ ATTRIBUTION_STATUSES, EVIDENCE_TYPES, parseDate, buildEmployeeLookup, buildLegacyAssignmentLookup, resolveAttribution, resolveBatch, summarize });
})(window);
