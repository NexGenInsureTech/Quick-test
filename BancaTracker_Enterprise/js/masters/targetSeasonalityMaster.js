/* v8.6 Step 6D.5C: normalize, validate, and snapshot Target Seasonality imports. */
(function (global) {
  "use strict";

  const TOLERANCE = 1e-9;

  function normalizeText(value) {
    const normalized = String(value == null ? "" : value).trim();
    return normalized || null;
  }

  function normalizeFiscalYear(value) {
    const normalized = normalizeText(value);
    const match = normalized && /^FY(\d{4})-(\d{2})$/.exec(normalized.toUpperCase());
    if (!match) return null;
    const startYear = Number(match[1]);
    return Number(match[2]) === (startYear + 1) % 100 ? `FY${match[1]}-${match[2]}` : null;
  }

  function fiscalMonthsFor(fiscalYear) {
    const match = /^FY(\d{4})-(\d{2})$/.exec(fiscalYear || "");
    if (!match) return [];
    const startYear = Number(match[1]);
    return [
      `${startYear}-04`, `${startYear}-05`, `${startYear}-06`, `${startYear}-07`, `${startYear}-08`, `${startYear}-09`,
      `${startYear}-10`, `${startYear}-11`, `${startYear}-12`, `${startYear + 1}-01`, `${startYear + 1}-02`, `${startYear + 1}-03`,
    ];
  }

  function normalizeScope(value) {
    const normalized = normalizeText(value);
    return normalized ? normalized.toUpperCase() : null;
  }

  function normalizeMonth(value) {
    const normalized = normalizeText(value);
    const match = normalized && /^(\d{4})-(\d{2})$/.exec(normalized);
    if (!match) return null;
    const month = Number(match[2]);
    return month >= 1 && month <= 12 ? normalized : null;
  }

  function parseWeight(value) {
    const normalized = normalizeText(value);
    if (!normalized || !/^(?:0|1|0\.\d+|1\.0+)$/.test(normalized)) return null;
    const weight = Number(normalized);
    return Number.isFinite(weight) && weight >= 0 && weight <= 1 ? weight : null;
  }

  function normalizeBank(value) {
    const raw = normalizeText(value);
    return raw ? global.BancaTrackerUtils.normalizeBank(raw) : null;
  }

  function curveKey(record) {
    return `${record.fiscalYear || ""}\u0000${record.scopeType || ""}\u0000${record.canonicalBank || ""}`;
  }

  function recordIdFor(datasetId, record) {
    return `${datasetId}:${record.fiscalYear}:${record.scopeType}:${record.canonicalBank || "OVERALL"}:${record.monthKey}`;
  }

  function finding(code, record, field, message) {
    return {
      severity: "ERROR", code, category: "REFERENCE", field, message,
      sourceRowNumber: record.sourceRowNumber,
    };
  }

  function normalizeRow(rawRow, datasetId, rowNumber) {
    const fiscalYear = normalizeFiscalYear(rawRow["FISCAL YEAR"]);
    const scopeType = normalizeScope(rawRow.SCOPE);
    const bankInput = normalizeText(rawRow.BANK);
    const canonicalBank = scopeType === "BANK" ? normalizeBank(bankInput) : null;
    const monthKey = normalizeMonth(rawRow.MONTH);
    const weight = parseWeight(rawRow.WEIGHT);
    const identity = `${fiscalYear || "INVALID"}:${scopeType || "INVALID"}:${canonicalBank || "OVERALL"}:${monthKey || `ROW:${rowNumber}`}`;
    return {
      recordId: `${datasetId}:${identity}`,
      datasetId,
      fiscalYear,
      scopeType,
      canonicalBank,
      monthKey,
      weight,
      bankInput,
      sourceRowNumber: rowNumber,
    };
  }

  function validateRow(record) {
    const findings = [];
    if (!record.fiscalYear) findings.push(finding("TARGET_SEASONALITY_FISCAL_YEAR_INVALID", record, "FISCAL YEAR", "FISCAL YEAR must use contiguous FYyyyy-yy form."));
    if (!["OVERALL", "BANK"].includes(record.scopeType)) findings.push(finding("TARGET_SEASONALITY_SCOPE_INVALID", record, "SCOPE", "SCOPE must be OVERALL or BANK."));
    if (record.scopeType === "OVERALL" && record.bankInput !== null) findings.push(finding("TARGET_SEASONALITY_OVERALL_BANK_PRESENT", record, "BANK", "BANK must be blank for OVERALL scope."));
    if (record.scopeType === "BANK" && !record.canonicalBank) findings.push(finding("TARGET_SEASONALITY_BANK_REQUIRED", record, "BANK", "BANK is required for BANK scope."));
    if (!record.monthKey) findings.push(finding("TARGET_SEASONALITY_MONTH_INVALID", record, "MONTH", "MONTH must use canonical YYYY-MM form."));
    if (record.weight === null) findings.push(finding("TARGET_SEASONALITY_WEIGHT_INVALID", record, "WEIGHT", "WEIGHT must be a decimal fraction between 0 and 1."));
    if (record.fiscalYear && record.monthKey && !fiscalMonthsFor(record.fiscalYear).includes(record.monthKey)) findings.push(finding("TARGET_SEASONALITY_MONTH_OUTSIDE_FY", record, "MONTH", "MONTH must belong to the submitted fiscal year."));
    return findings;
  }

  function validateCurves(records, fiscalYear) {
    const findings = [];
    const groups = new Map();
    records.filter((record) => record.fiscalYear === fiscalYear && ["OVERALL", "BANK"].includes(record.scopeType))
      .forEach((record) => {
        const key = curveKey(record);
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(record);
      });
    groups.forEach((curve) => {
      const first = curve[0];
      const result = global.BancaTrackerTargetSeasonality.resolve({
        records: curve,
        fiscalYear,
        ...(first.scopeType === "BANK" ? { bank: first.canonicalBank } : {}),
        fiscalMonths: fiscalMonthsFor(fiscalYear),
      });
      if (result.status !== (first.scopeType === "BANK" ? "GOVERNED_BANK" : "GOVERNED_OVERALL")) {
        findings.push(finding("TARGET_SEASONALITY_CURVE_INVALID", first, "MONTH/WEIGHT", "Each submitted curve must contain one valid reconciled weight for every fiscal month."));
      }
    });
    return findings;
  }

  function compareRecords(left, right) {
    const scopeRank = (record) => record.scopeType === "OVERALL" ? 0 : 1;
    return String(left.fiscalYear || "").localeCompare(String(right.fiscalYear || ""))
      || scopeRank(left) - scopeRank(right)
      || String(left.canonicalBank || "").localeCompare(String(right.canonicalBank || ""))
      || String(left.monthKey || "").localeCompare(String(right.monthKey || ""));
  }

  function buildSuccessorSnapshot(activeRecords, submittedRecords, fiscalYear, datasetId = null) {
    const own = (record) => {
      const copy = { ...record };
      if (datasetId) {
        copy.datasetId = datasetId;
        copy.recordId = recordIdFor(datasetId, copy);
      }
      return copy;
    };
    return [...(Array.isArray(activeRecords) ? activeRecords : [])
      .filter((record) => record && record.fiscalYear !== fiscalYear)
      .map(own),
    ...submittedRecords.map(own)]
      .sort(compareRecords);
  }

  function prepareDataset(rawRows, datasetId) {
    if (!Array.isArray(rawRows)) throw new TypeError("Target Seasonality rows must be an array.");
    const records = rawRows.map((row, index) => normalizeRow(row, datasetId, index + 2));
    const findings = records.flatMap(validateRow);
    const fiscalYears = [...new Set(records.map((record) => record.fiscalYear).filter(Boolean))];
    if (!records.length) findings.push({ severity: "ERROR", code: "TARGET_SEASONALITY_ROWS_REQUIRED", category: "REFERENCE", field: null, message: "At least one Target Seasonality row is required." });
    if (fiscalYears.length !== 1) findings.push({ severity: "ERROR", code: "TARGET_SEASONALITY_ONE_FY_REQUIRED", category: "REFERENCE", field: "FISCAL YEAR", message: "One import must contain exactly one valid fiscal year." });
    const fiscalYear = fiscalYears.length === 1 ? fiscalYears[0] : null;
    if (fiscalYear) findings.push(...validateCurves(records, fiscalYear));
    const errorCount = findings.filter((item) => item.severity === "ERROR").length;
    return {
      records: records.slice().sort(compareRecords), findings, valid: errorCount === 0,
      errorCount, warningCount: 0, submittedFiscalYear: fiscalYear,
    };
  }

  global.BancaTrackerTargetSeasonalityMaster = Object.freeze({
    TOLERANCE, normalizeText, normalizeFiscalYear, fiscalMonthsFor, normalizeScope,
    normalizeMonth, parseWeight, normalizeBank, normalizeRow, validateRow, recordIdFor,
    validateCurves, buildSuccessorSnapshot, prepareDataset,
  });
})(window);
