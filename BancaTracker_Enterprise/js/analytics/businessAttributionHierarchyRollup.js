/*==============================================================
BancaTracker Enterprise
Version : 8.3.0
File    : businessAttributionHierarchyRollup.js
Module  : Analytics Foundation
Purpose : Dynamic hierarchy analytical roll-ups over detached attribution
==============================================================*/

(function (global) {
  "use strict";

  function freezeDiagnostics(values) {
    return Object.freeze([...new Set((values || []).filter(Boolean))].sort());
  }

  function contextForDate(contextsByBusinessDate, businessDate) {
    if (!contextsByBusinessDate || !businessDate) return null;
    if (contextsByBusinessDate instanceof Map) return contextsByBusinessDate.get(businessDate) || null;
    if (typeof contextsByBusinessDate === "function") return contextsByBusinessDate(businessDate) || null;
    return contextsByBusinessDate[businessDate] || null;
  }

  function hierarchyFor(attribution, contextsByBusinessDate) {
    if (!attribution.employeeId) return Object.freeze({ status: "NOT_APPLICABLE", directManagerId: null, reportingChain: Object.freeze([]), reportingDepth: 0, rootEmployeeId: null, isRoot: false, diagnostics: Object.freeze([]) });
    const context = contextForDate(contextsByBusinessDate, attribution.businessDate);
    if (!context) return Object.freeze({ status: "HIERARCHY_CONTEXT_UNAVAILABLE", directManagerId: null, reportingChain: Object.freeze([]), reportingDepth: 0, rootEmployeeId: null, isRoot: false, diagnostics: Object.freeze(["ATTRIBUTION_HIERARCHY_CONTEXT_UNAVAILABLE"]) });
    if (context.asOfDate !== attribution.businessDate) return Object.freeze({ status: "HIERARCHY_CONTEXT_DATE_MISMATCH", directManagerId: null, reportingChain: Object.freeze([]), reportingDepth: 0, rootEmployeeId: null, isRoot: false, diagnostics: Object.freeze(["ATTRIBUTION_HIERARCHY_AS_OF_MISMATCH"]) });
    const resolution = context.resolutionsByEmployee && context.resolutionsByEmployee.get(attribution.employeeId);
    if (!resolution) return Object.freeze({ status: "EMPLOYEE_NOT_FOUND", directManagerId: null, reportingChain: Object.freeze([]), reportingDepth: 0, rootEmployeeId: null, isRoot: false, diagnostics: Object.freeze(["ATTRIBUTION_HIERARCHY_EMPLOYEE_NOT_FOUND"]) });
    return Object.freeze({ status: resolution.status, directManagerId: resolution.directManagerId || null, reportingChain: Object.freeze([...(resolution.reportingChain || [])]), reportingDepth: resolution.reportingDepth || 0, rootEmployeeId: resolution.rootEmployeeId || null, isRoot: Boolean(resolution.isRoot), diagnostics: freezeDiagnostics(resolution.diagnostics) });
  }

  function buildRollupRecords(attributionResults, contextsByBusinessDate) {
    return Object.freeze((Array.isArray(attributionResults) ? attributionResults : []).map((attribution) => {
      const hierarchy = hierarchyFor(attribution, contextsByBusinessDate);
      const rollupNodeIds = attribution.employeeId ? Object.freeze([...new Set([attribution.employeeId, ...hierarchy.reportingChain])]) : Object.freeze([]);
      return Object.freeze({
        canonicalRecordReference: attribution.canonicalRecordReference,
        businessDate: attribution.businessDate,
        attributionStatus: attribution.attributionStatus,
        employeeId: attribution.employeeId,
        evidenceType: attribution.evidenceType,
        confidence: attribution.confidence,
        signedActual: attribution.signedActual,
        temporalStatus: attribution.temporalStatus,
        directOwnerId: attribution.employeeId || null,
        hierarchyStatus: hierarchy.status,
        directManagerId: hierarchy.directManagerId,
        reportingChain: hierarchy.reportingChain,
        reportingDepth: hierarchy.reportingDepth,
        rootEmployeeId: hierarchy.rootEmployeeId,
        isRoot: hierarchy.isRoot,
        rollupNodeIds,
        hierarchyDiagnostics: hierarchy.diagnostics,
        diagnostics: freezeDiagnostics([...(attribution.diagnostics || []), ...hierarchy.diagnostics]),
      });
    }));
  }

  function createSummaryRow(employeeId) {
    return { employeeId, directAttributedRecordCount: 0, directSignedActual: 0, rollupRecordCount: 0, rollupSignedActual: 0 };
  }

  function summarizeByEmployee(rollupRecords) {
    const rows = new Map(); const ensure = (employeeId) => { if (!rows.has(employeeId)) rows.set(employeeId, createSummaryRow(employeeId)); return rows.get(employeeId); };
    (Array.isArray(rollupRecords) ? rollupRecords : []).forEach((record) => {
      const actual = typeof record.signedActual === "number" && Number.isFinite(record.signedActual) ? record.signedActual : 0;
      if (record.directOwnerId) { const direct = ensure(record.directOwnerId); direct.directAttributedRecordCount += 1; direct.directSignedActual += actual; }
      [...new Set(record.rollupNodeIds || [])].forEach((employeeId) => { const row = ensure(employeeId); row.rollupRecordCount += 1; row.rollupSignedActual += actual; });
    });
    return Object.freeze([...rows.values()].map((row) => Object.freeze(row)).sort((left, right) => left.employeeId.localeCompare(right.employeeId)));
  }

  function summarizeTeam(rollupRecords, employeeId) {
    const row = summarizeByEmployee(rollupRecords).find((item) => item.employeeId === employeeId);
    return Object.freeze(row || createSummaryRow(employeeId));
  }

  function summarizeByRoot(rollupRecords) {
    const rows = new Map();
    (Array.isArray(rollupRecords) ? rollupRecords : []).forEach((record) => {
      if (!record.rootEmployeeId || !record.directOwnerId) return;
      if (!rows.has(record.rootEmployeeId)) rows.set(record.rootEmployeeId, { rootEmployeeId: record.rootEmployeeId, rollupRecordCount: 0, rollupSignedActual: 0 });
      const row = rows.get(record.rootEmployeeId); row.rollupRecordCount += 1; row.rollupSignedActual += typeof record.signedActual === "number" && Number.isFinite(record.signedActual) ? record.signedActual : 0;
    });
    return Object.freeze([...rows.values()].map((row) => Object.freeze(row)).sort((left, right) => left.rootEmployeeId.localeCompare(right.rootEmployeeId)));
  }

  function validateDirectReconciliation(rollupRecords) {
    const source = Array.isArray(rollupRecords) ? rollupRecords : [];
    const directSignedActual = source.filter((record) => record.directOwnerId).reduce((total, record) => total + (typeof record.signedActual === "number" && Number.isFinite(record.signedActual) ? record.signedActual : 0), 0);
    const directRecordCount = source.filter((record) => record.directOwnerId).length;
    const summaries = summarizeByEmployee(source);
    const summarizedSignedActual = summaries.reduce((total, row) => total + row.directSignedActual, 0);
    const summarizedRecordCount = summaries.reduce((total, row) => total + row.directAttributedRecordCount, 0);
    return Object.freeze({ directRecordCount, directSignedActual, summarizedDirectRecordCount: summarizedRecordCount, summarizedDirectSignedActual: summarizedSignedActual, complete: directRecordCount === summarizedRecordCount && directSignedActual === summarizedSignedActual, note: "Manager and root roll-up totals overlap by design and must not be summed against direct attribution." });
  }

  global.BancaTrackerBusinessAttributionHierarchyRollup = Object.freeze({
    contextForDate,
    hierarchyFor,
    buildRollupRecords,
    summarizeByEmployee,
    summarizeTeam,
    summarizeByRoot,
    validateDirectReconciliation,
  });
})(window);
