(function (global) {
  "use strict";

  function sourceResult(value, header, side) {
    const prefix = `COVERAGE_${side}`;
    if (header === null || typeof header === "undefined") {
      return { success: false, normalized: null, diagnosticCodes: [`${prefix}_HEADER_MISSING`] };
    }
    if (value === null || typeof value === "undefined" || (typeof value === "string" && value.trim() === "")) {
      return { success: false, normalized: null, diagnosticCodes: [`${prefix}_DATE_MISSING`] };
    }
    if (typeof value !== "string") {
      return { success: false, normalized: null, diagnosticCodes: [`${prefix}_DATE_TYPE_UNSUPPORTED`] };
    }
    const resolver = global.BancaTrackerDateResolver;
    if (!resolver || typeof resolver.resolve !== "function") {
      return { success: false, normalized: null, diagnosticCodes: ["DATE_RESOLVER_UNAVAILABLE"] };
    }
    const resolved = resolver.resolve(value);
    if (!resolved.success) {
      const code = resolved.error === "DATE_FORMAT_UNSUPPORTED"
        ? `${prefix}_DATE_FORMAT_UNSUPPORTED`
        : `${prefix}_DATE_INVALID`;
      return { success: false, normalized: null, diagnosticCodes: [code] };
    }
    return {
      success: true,
      normalized: resolved.policyIssuedDate,
      year: resolved.year,
      month: resolved.month,
      day: resolved.day,
      diagnosticCodes: [],
    };
  }

  function emptyTenure(status, classification, diagnosticCodes) {
    return {
      status,
      classification,
      coverageEndExclusive: null,
      durationDays: null,
      exactCalendarYears: null,
      diagnosticCodes: diagnosticCodes.slice(),
    };
  }

  function apply(record, governance = {}) {
    const source = record && typeof record === "object" ? record : {};
    const start = sourceResult(source.coverageStartDateSourceValue, source.coverageStartDateSourceHeader, "START");
    const end = sourceResult(source.coverageEndDateSourceValue, source.coverageEndDateSourceHeader, "END");
    const coverageDateDiagnosticCodes = [...new Set([...start.diagnosticCodes, ...end.diagnosticCodes])];
    let tenure;

    if (start.success && end.success && Date.UTC(end.year, end.month - 1, end.day) < Date.UTC(start.year, start.month - 1, start.day)) {
      coverageDateDiagnosticCodes.push("COVERAGE_END_BEFORE_START");
      tenure = emptyTenure("INVALID", "INVALID", ["END_DATE_BEFORE_START_DATE"]);
    } else if (!start.success || !end.success) {
      const invalid = coverageDateDiagnosticCodes.some((code) =>
        code.endsWith("_INVALID") || code.endsWith("_UNSUPPORTED") || code === "DATE_RESOLVER_UNAVAILABLE",
      );
      tenure = emptyTenure(invalid ? "INVALID" : "UNKNOWN", invalid ? "INVALID" : "UNKNOWN", []);
    } else {
      const authority = global.BancaTrackerPolicyTenure;
      tenure = authority && typeof authority.classifyPolicyTenure === "function"
        ? authority.classifyPolicyTenure({
          startDate: source.coverageStartDateSourceValue,
          endDate: source.coverageEndDateSourceValue,
          endDateConvention: governance.endDateConvention,
          leapDayAnniversaryConvention: governance.leapDayAnniversaryConvention,
        })
        : emptyTenure("INVALID", "INVALID", ["POLICY_TENURE_AUTHORITY_UNAVAILABLE"]);
    }

    return {
      ...source,
      coverageStartDateNormalized: start.normalized,
      coverageEndDateNormalized: end.normalized,
      coverageDateDiagnosticCodes,
      policyTenureStatus: tenure.status,
      policyTenureClassification: tenure.classification,
      policyTenureCoverageEndExclusive: tenure.coverageEndExclusive,
      policyTenureDurationDays: tenure.durationDays,
      policyTenureExactCalendarYears: tenure.exactCalendarYears,
      policyTenureDiagnosticCodes: tenure.diagnosticCodes.slice(),
      policyTenureEndDateConvention: governance.endDateConvention || null,
      policyTenureLeapDayAnniversaryConvention: governance.leapDayAnniversaryConvention || null,
    };
  }

  function summarize(records) {
    const summary = {
      rowCount: 0,
      rowsWithAnyCoverageHeader: 0,
      rowsWithBothCoverageHeaders: 0,
      rowsWithValidDatePair: 0,
      statusCounts: { SUCCESS: 0, UNKNOWN: 0, INVALID: 0 },
      classificationCounts: {},
      diagnosticCounts: {},
    };
    (Array.isArray(records) ? records : []).forEach((record) => {
      summary.rowCount += 1;
      const hasStart = record.coverageStartDateSourceHeader != null;
      const hasEnd = record.coverageEndDateSourceHeader != null;
      if (hasStart || hasEnd) summary.rowsWithAnyCoverageHeader += 1;
      if (hasStart && hasEnd) summary.rowsWithBothCoverageHeaders += 1;
      if (record.coverageStartDateNormalized && record.coverageEndDateNormalized) summary.rowsWithValidDatePair += 1;
      const status = record.policyTenureStatus || "UNKNOWN";
      summary.statusCounts[status] = (summary.statusCounts[status] || 0) + 1;
      const classification = record.policyTenureClassification || "UNKNOWN";
      summary.classificationCounts[classification] = (summary.classificationCounts[classification] || 0) + 1;
      [...(record.coverageDateDiagnosticCodes || []), ...(record.policyTenureDiagnosticCodes || [])].forEach((code) => {
        summary.diagnosticCounts[code] = (summary.diagnosticCounts[code] || 0) + 1;
      });
    });
    return summary;
  }

  global.BancaTrackerPolicyCoverage = Object.freeze({ apply, summarize });
})(typeof window !== "undefined" ? window : globalThis);
