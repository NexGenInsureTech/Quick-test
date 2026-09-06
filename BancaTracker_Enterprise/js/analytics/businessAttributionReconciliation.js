/*==============================================================
BancaTracker Enterprise
Version : 8.3.0
File    : businessAttributionReconciliation.js
Module  : Analytics Foundation
Purpose : Reconcile detached Business Attribution results with canonical Actual
==============================================================*/

(function (global) {
  "use strict";

  function freezeDiagnostics(items) {
    return Object.freeze([...items].sort((left, right) => left.code.localeCompare(right.code) || String(left.canonicalRecordReference || "").localeCompare(String(right.canonicalRecordReference || ""))));
  }

  function recordReference(record, index) {
    if (record && record.recordId) return String(record.recordId);
    if (record && record.sourceRecordId) return String(record.sourceRecordId);
    if (record && record.sourceRowNumber !== null && record.sourceRowNumber !== undefined) return `SOURCE_ROW:${record.sourceRowNumber}`;
    return `INPUT_INDEX:${index}`;
  }

  function numericActual(value) {
    return typeof value === "number" && Number.isFinite(value) ? value : 0;
  }

  function emptyEvidence() {
    return { recordCount: 0, signedActual: 0, grossAbsoluteSignedActual: 0 };
  }

  function buildCoverage(records, matched) {
    const coverage = {
      totalRecords: records.length, attributedRecords: 0, unattributedRecords: 0,
      attributedRecordCoveragePercent: records.length ? 0 : null,
      directSourceAttributedCount: 0, legacyFallbackAttributedCount: 0,
      unmappedSourceIdentityCount: 0, temporallyNotEffectiveCount: 0, temporallyUnverifiedCount: 0,
      attributionStatusCounts: {}, temporalStatusCounts: {}, diagnosticCounts: {},
      evidence: { SOURCE_RM_ID: emptyEvidence(), LEGACY_BRANCH_ASSIGNMENT: emptyEvidence(), NONE: emptyEvidence() },
      underlyingSignedActual: 0, attributedSignedActual: 0, unattributedSignedActual: 0,
      underlyingGrossAbsoluteSignedActual: 0, attributedGrossAbsoluteSignedActual: 0,
      grossAbsoluteAttributedValueCoveragePercent: null,
      positiveSignedActual: 0, negativeSignedActual: 0, zeroActualRecordCount: 0,
    };
    records.forEach((record) => {
      const actual = numericActual(record.premium); coverage.underlyingSignedActual += actual; coverage.underlyingGrossAbsoluteSignedActual += Math.abs(actual);
      if (actual > 0) coverage.positiveSignedActual += actual;
      else if (actual < 0) coverage.negativeSignedActual += actual;
      else coverage.zeroActualRecordCount += 1;
    });
    matched.forEach(({ result }) => {
      const actual = numericActual(result.signedActual); const attributed = Boolean(result.employeeId);
      const evidenceType = attributed && (result.evidenceType === "SOURCE_RM_ID" || result.evidenceType === "LEGACY_BRANCH_ASSIGNMENT") ? result.evidenceType : "NONE";
      coverage.attributionStatusCounts[result.attributionStatus] = (coverage.attributionStatusCounts[result.attributionStatus] || 0) + 1;
      coverage.temporalStatusCounts[result.temporalStatus] = (coverage.temporalStatusCounts[result.temporalStatus] || 0) + 1;
      (result.diagnostics || []).forEach((code) => { coverage.diagnosticCounts[code] = (coverage.diagnosticCounts[code] || 0) + 1; });
      coverage.evidence[evidenceType].recordCount += 1; coverage.evidence[evidenceType].signedActual += actual; coverage.evidence[evidenceType].grossAbsoluteSignedActual += Math.abs(actual);
      if (attributed) {
        coverage.attributedRecords += 1; coverage.attributedSignedActual += actual; coverage.attributedGrossAbsoluteSignedActual += Math.abs(actual);
        if (evidenceType === "SOURCE_RM_ID") coverage.directSourceAttributedCount += 1;
        if (evidenceType === "LEGACY_BRANCH_ASSIGNMENT") coverage.legacyFallbackAttributedCount += 1;
      } else coverage.unattributedRecords += 1, coverage.unattributedSignedActual += actual;
      if ((result.diagnostics || []).includes("ATTRIBUTION_SOURCE_RM_ID_UNMAPPED")) coverage.unmappedSourceIdentityCount += 1;
      if (result.temporalStatus === "NOT_EFFECTIVE") coverage.temporallyNotEffectiveCount += 1;
      if (result.temporalStatus === "UNVERIFIED") coverage.temporallyUnverifiedCount += 1;
    });
    coverage.attributedRecordCoveragePercent = records.length ? coverage.attributedRecords / records.length * 100 : null;
    coverage.grossAbsoluteAttributedValueCoveragePercent = coverage.underlyingGrossAbsoluteSignedActual ? coverage.attributedGrossAbsoluteSignedActual / coverage.underlyingGrossAbsoluteSignedActual * 100 : null;
    Object.keys(coverage.evidence).forEach((key) => Object.freeze(coverage.evidence[key]));
    return Object.freeze(coverage);
  }

  function reconcile(records, attributionResults) {
    const source = Array.isArray(records) ? records : [];
    const results = Array.isArray(attributionResults) ? attributionResults : [];
    const sourceByReference = new Map(); const resultByReference = new Map(); const diagnostics = [];
    source.forEach((record, index) => { const reference = recordReference(record, index); if (!sourceByReference.has(reference)) sourceByReference.set(reference, []); sourceByReference.get(reference).push({ record, index }); });
    results.forEach((result, index) => { const reference = result && result.canonicalRecordReference; if (!resultByReference.has(reference)) resultByReference.set(reference, []); resultByReference.get(reference).push({ result, index }); });
    sourceByReference.forEach((items, reference) => { if (items.length > 1) diagnostics.push({ code: "ATTRIBUTION_CANONICAL_REFERENCE_DUPLICATE", canonicalRecordReference: reference }); });
    resultByReference.forEach((items, reference) => {
      if (!sourceByReference.has(reference)) diagnostics.push({ code: "ATTRIBUTION_RESULT_UNEXPECTED", canonicalRecordReference: reference || null });
      if (items.length > 1) diagnostics.push({ code: "ATTRIBUTION_RESULT_DUPLICATE", canonicalRecordReference: reference || null });
    });
    const matched = [];
    sourceByReference.forEach((items, reference) => {
      if (items.length !== 1) return;
      const resultItems = resultByReference.get(reference) || [];
      if (!resultItems.length) { diagnostics.push({ code: "ATTRIBUTION_RESULT_MISSING", canonicalRecordReference: reference }); return; }
      if (resultItems.length !== 1) return;
      const pair = { record: items[0].record, result: resultItems[0].result, canonicalRecordReference: reference };
      if (pair.record.premium !== pair.result.signedActual) diagnostics.push({ code: "ATTRIBUTION_SIGNED_ACTUAL_MISMATCH", canonicalRecordReference: reference, underlyingSignedActual: pair.record.premium, attributedSignedActual: pair.result.signedActual });
      matched.push(pair);
    });
    const coverage = buildCoverage(source, matched);
    const reconciliation = Object.freeze({
      underlyingRecordCount: source.length,
      attributedRecordCount: coverage.attributedRecords,
      unattributedRecordCount: coverage.unattributedRecords,
      recordDifference: source.length - coverage.attributedRecords - coverage.unattributedRecords,
      underlyingSignedActual: coverage.underlyingSignedActual,
      attributedSignedActual: coverage.attributedSignedActual,
      unattributedSignedActual: coverage.unattributedSignedActual,
      signedActualDifference: coverage.underlyingSignedActual - coverage.attributedSignedActual - coverage.unattributedSignedActual,
      complete: false,
    });
    const complete = reconciliation.recordDifference === 0 && reconciliation.signedActualDifference === 0 && diagnostics.length === 0;
    return Object.freeze({ status: complete ? "RECONCILED" : "UNRECONCILED", reconciliation: Object.freeze({ ...reconciliation, complete }), coverage, diagnostics: freezeDiagnostics(diagnostics) });
  }

  function summarizeCoverage(records, attributionResults) {
    return reconcile(records, attributionResults).coverage;
  }

  function reconcileBy(records, attributionResults, keySelector) {
    if (typeof keySelector !== "function") throw new TypeError("A slice keySelector function is required.");
    const source = Array.isArray(records) ? records : []; const results = Array.isArray(attributionResults) ? attributionResults : [];
    const groups = new Map();
    source.forEach((record, index) => { const key = keySelector(record, index); const normalizedKey = key === null || key === undefined || key === "" ? "__UNMAPPED__" : String(key); if (!groups.has(normalizedKey)) groups.set(normalizedKey, []); groups.get(normalizedKey).push({ record, index }); });
    const rows = [...groups.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([key, items]) => {
      const references = new Set(items.map(({ record, index }) => recordReference(record, index)));
      const groupedRecords = items.map(({ record }) => record);
      const groupedResults = results.filter((result) => references.has(result && result.canonicalRecordReference));
      const value = reconcile(groupedRecords, groupedResults);
      return Object.freeze({ key, reconciliation: value.reconciliation, coverage: value.coverage, diagnostics: value.diagnostics, status: value.status });
    });
    return Object.freeze({ rows: Object.freeze(rows), diagnostics: Object.freeze([]) });
  }

  global.BancaTrackerBusinessAttributionReconciliation = Object.freeze({
    recordReference,
    reconcile,
    summarizeCoverage,
    reconcileBy,
  });
})(window);
