/* v8.6 Step 6D.4: pure FY-scoped Target Seasonality weight resolution. */
(function (global) {
  "use strict";

  const TOLERANCE = 1e-9;

  function expectedFiscalMonths(fiscalYear) {
    const match = /^FY(\d{4})-(\d{2})$/.exec(fiscalYear || "");
    if (!match) return null;
    const startYear = Number(match[1]);
    if (Number(match[2]) !== (startYear + 1) % 100) return null;
    return [
      `${startYear}-04`, `${startYear}-05`, `${startYear}-06`, `${startYear}-07`, `${startYear}-08`, `${startYear}-09`,
      `${startYear}-10`, `${startYear}-11`, `${startYear}-12`, `${startYear + 1}-01`, `${startYear + 1}-02`, `${startYear + 1}-03`,
    ];
  }

  function validFiscalMonths(supplied, expected) {
    return !supplied || (Array.isArray(supplied) && supplied.length === expected.length && supplied.every((month, index) => month === expected[index]));
  }

  function diagnostics(input, fiscalMonths, requestedScope, recordsConsidered) {
    return {
      requestedFiscalYear: input.fiscalYear,
      requestedScope,
      requestedBank: input.bank || null,
      recordsConsidered,
      applicableRecords: 0,
      missingMonths: [],
      duplicateMonths: [],
      invalidWeights: [],
      unexpectedMonths: [],
      weightSum: null,
      reconciliationTolerance: TOLERANCE,
      resolutionPath: "UNAVAILABLE",
      expectedFiscalMonths: fiscalMonths ? fiscalMonths.slice() : [],
    };
  }

  function freezeResult(status, fiscalYear, scope, weightsByMonth, resultDiagnostics) {
    const weights = weightsByMonth && Object.freeze({ ...weightsByMonth });
    const frozenDiagnostics = Object.freeze({
      ...resultDiagnostics,
      missingMonths: Object.freeze(resultDiagnostics.missingMonths.slice()),
      duplicateMonths: Object.freeze(resultDiagnostics.duplicateMonths.slice()),
      invalidWeights: Object.freeze(resultDiagnostics.invalidWeights.map((item) => Object.freeze({ ...item }))),
      unexpectedMonths: Object.freeze(resultDiagnostics.unexpectedMonths.slice()),
      expectedFiscalMonths: Object.freeze(resultDiagnostics.expectedFiscalMonths.slice()),
    });
    return Object.freeze({ status, fiscalYear, scope, weightsByMonth: weights || null, diagnostics: frozenDiagnostics });
  }

  function inspectCurve(records, fiscalMonths, resultDiagnostics) {
    const expected = new Set(fiscalMonths);
    const byMonth = new Map();
    records.forEach((record) => {
      const month = record && record.monthKey;
      if (!expected.has(month)) {
        resultDiagnostics.unexpectedMonths.push(month == null ? null : month);
        return;
      }
      if (byMonth.has(month)) {
        resultDiagnostics.duplicateMonths.push(month);
        return;
      }
      byMonth.set(month, record);
    });

    fiscalMonths.forEach((month) => {
      if (!byMonth.has(month)) resultDiagnostics.missingMonths.push(month);
    });

    let weightSum = 0;
    const weightsByMonth = {};
    fiscalMonths.forEach((month) => {
      const record = byMonth.get(month);
      if (!record) return;
      const weight = record.weight;
      if (typeof weight !== "number" || !Number.isFinite(weight) || weight < 0 || weight > 1) {
        resultDiagnostics.invalidWeights.push({ monthKey: month, value: weight });
        return;
      }
      weightsByMonth[month] = weight;
      weightSum += weight;
    });
    resultDiagnostics.weightSum = weightSum;

    const valid = resultDiagnostics.missingMonths.length === 0
      && resultDiagnostics.duplicateMonths.length === 0
      && resultDiagnostics.unexpectedMonths.length === 0
      && resultDiagnostics.invalidWeights.length === 0
      && Math.abs(weightSum - 1) <= TOLERANCE;
    return { valid, weightsByMonth };
  }

  function equalFallback(fiscalMonths) {
    const weightsByMonth = {};
    fiscalMonths.forEach((month) => { weightsByMonth[month] = 1 / 12; });
    return weightsByMonth;
  }

  function resolve(input) {
    const request = input && typeof input === "object" ? input : {};
    const records = Array.isArray(request.records) ? request.records : [];
    const fiscalMonths = expectedFiscalMonths(request.fiscalYear);
    const requestedScope = request.bank ? "BANK" : "OVERALL";
    const scope = request.bank || "OVERALL";
    const resultDiagnostics = diagnostics(request, fiscalMonths, requestedScope, records.length);

    if (!fiscalMonths || !validFiscalMonths(request.fiscalMonths, fiscalMonths)) {
      return freezeResult("UNAVAILABLE", request.fiscalYear, scope, null, resultDiagnostics);
    }

    const forFiscalYear = records.filter((record) => record && record.fiscalYear === request.fiscalYear);
    const overallRecords = forFiscalYear.filter((record) => record.scopeType === "OVERALL");
    const bankRecords = request.bank
      ? forFiscalYear.filter((record) => record.scopeType === "BANK" && record.canonicalBank === request.bank)
      : [];

    function resolvedCurve(curveRecords, status, path) {
      resultDiagnostics.applicableRecords = curveRecords.length;
      resultDiagnostics.resolutionPath = path;
      if (!curveRecords.length) return null;
      const inspected = inspectCurve(curveRecords, fiscalMonths, resultDiagnostics);
      return inspected.valid ? freezeResult(status, request.fiscalYear, scope, inspected.weightsByMonth, resultDiagnostics) : freezeResult("INVALID", request.fiscalYear, scope, null, resultDiagnostics);
    }

    if (request.bank) {
      const bankResult = resolvedCurve(bankRecords, "GOVERNED_BANK", "BANK");
      if (bankResult) return bankResult;

      const overallResult = resolvedCurve(overallRecords, "GOVERNED_OVERALL", "OVERALL_INHERITED");
      if (overallResult) return overallResult;
    } else {
      const overallResult = resolvedCurve(overallRecords, "GOVERNED_OVERALL", "OVERALL");
      if (overallResult) return overallResult;
    }

    resultDiagnostics.weightSum = 1;
    resultDiagnostics.resolutionPath = "EQUAL_MONTH_FALLBACK";
    return freezeResult("EQUAL_MONTH_FALLBACK", request.fiscalYear, scope, equalFallback(fiscalMonths), resultDiagnostics);
  }

  global.BancaTrackerTargetSeasonality = Object.freeze({ resolve });
})(typeof globalThis !== "undefined" ? globalThis : window);
