/*==============================================================
BancaTracker Enterprise
Version : 8.3.0
File    : temporalBusinessAttributionResolver.js
Module  : Enrichment Foundation
Purpose : Produce detached, as-of business attribution results
==============================================================*/

(function (global) {
  "use strict";

  if (!global.BancaTrackerBusinessAttribution) {
    throw new Error("BancaTrackerBusinessAttribution must be loaded before temporalBusinessAttributionResolver.js");
  }

  const Attribution = global.BancaTrackerBusinessAttribution;

  function freezeDiagnostics(values) {
    return Object.freeze([...new Set((values || []).filter(Boolean))].sort());
  }

  function buildRecordReference(record, index) {
    if (record && record.recordId) return String(record.recordId);
    if (record && record.sourceRecordId) return String(record.sourceRecordId);
    if (record && record.sourceRowNumber !== null && record.sourceRowNumber !== undefined) return `SOURCE_ROW:${record.sourceRowNumber}`;
    return `INPUT_INDEX:${index}`;
  }

  function temporalStatus(attribution) {
    const diagnostics = attribution.diagnostics || [];
    if (diagnostics.includes("ATTRIBUTION_BUSINESS_DATE_UNAVAILABLE")) return "BUSINESS_DATE_UNAVAILABLE";
    if (diagnostics.some((code) => code.includes("EFFECTIVITY_UNVERIFIED"))) return "UNVERIFIED";
    if (diagnostics.some((code) => code.includes("NOT_EFFECTIVE"))) return "NOT_EFFECTIVE";
    if (attribution.employeeId) return "EFFECTIVE";
    return "UNRESOLVED";
  }

  function toDetachedResult(record, attribution, index) {
    const status = temporalStatus(attribution);
    return Object.freeze({
      canonicalRecordReference: buildRecordReference(record, index),
      businessDate: attribution.businessDate,
      attributionStatus: attribution.attributionStatus,
      employeeId: attribution.employeeId,
      evidenceType: attribution.evidenceType,
      confidence: attribution.confidence,
      signedActual: attribution.signedActual,
      temporalStatus: status,
      temporalEvidence: attribution.businessDate ? "CANONICAL_POLICY_ISSUED_DATE" : "UNAVAILABLE",
      diagnostics: freezeDiagnostics(attribution.diagnostics),
    });
  }

  function resolveRecord(record, attributionContext) {
    return toDetachedResult(record, Attribution.resolveAttribution(record, attributionContext), 0);
  }

  function resolveBatch(records, attributionContext) {
    const source = Array.isArray(records) ? records : [];
    const resolved = Attribution.resolveBatch(source, attributionContext);
    return Object.freeze({
      results: Object.freeze(resolved.results.map((attribution, index) => toDetachedResult(source[index], attribution, index))),
      summary: resolved.summary,
    });
  }

  global.BancaTrackerTemporalBusinessAttributionResolver = Object.freeze({
    buildRecordReference,
    temporalStatus,
    toDetachedResult,
    resolveRecord,
    resolveBatch,
  });
})(window);
