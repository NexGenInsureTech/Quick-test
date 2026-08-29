/*==============================================================
BancaTracker Enterprise
Version : 8.2.0-dev
File    : branchBudgetPotentialMaster.js
Module  : Master Data
Purpose : Govern period-specific branch Budget and Potential reference data
==============================================================*/

(function (global) {
  "use strict";

  const Registry = global.BancaTrackerDatasetRegistry;
  const severity = Registry.DATA_QUALITY_SEVERITY;

  function normalizeText(value) {
    const normalized = String(value == null ? "" : value).trim();
    return normalized || null;
  }

  function normalizeCode(value) {
    const normalized = normalizeText(value);
    return normalized ? normalized.toUpperCase() : null;
  }

  function normalizePeriod(value) {
    const normalized = normalizeText(value);
    const match = normalized && normalized.match(/^(\d{4})-(\d{2})$/);
    if (!match) return null;
    const month = Number(match[2]);
    return month >= 1 && month <= 12 ? `${match[1]}-${match[2]}` : null;
  }

  function financialYearForPeriod(periodKey) {
    if (!periodKey) return null;
    const [year, month] = periodKey.split("-").map(Number);
    return global.BancaTrackerDateResolver.deriveFinancialYear(year, month);
  }

  function normalizeMoney(value) {
    const normalized = normalizeText(value);
    if (normalized === null) return { value: null, supplied: false, valid: true };
    if (!/^(?:\d+(?:\.\d+)?|\.\d+)$/.test(normalized)) {
      return { value: null, supplied: true, valid: false };
    }
    const number = Number(normalized);
    return { value: number, supplied: true, valid: Number.isFinite(number) && number >= 0 };
  }

  function buildBranchId(bankId, branchCode) {
    return bankId && branchCode ? `${bankId}:${branchCode}` : null;
  }

  function normalizeRow(rawRow, datasetId, rowNumber) {
    const bankId = normalizeCode(rawRow["BANK ID"]);
    const branchCode = normalizeText(rawRow["BRANCH CODE"]);
    const branchId = buildBranchId(bankId, branchCode);
    const periodRaw = normalizeText(rawRow.PERIOD);
    const periodKey = normalizePeriod(periodRaw);
    const budgetInput = normalizeMoney(rawRow.BUDGET);
    const potentialInput = normalizeMoney(rawRow.POTENTIAL);
    return {
      recordId: branchId && periodKey ? `${datasetId}:${branchId}:${periodKey}` : `${datasetId}:ROW:${rowNumber}`,
      datasetId, bankId, branchCode, branchId,
      branchName: normalizeText(rawRow["BRANCH NAME"]),
      periodKey, periodRaw,
      financialYear: financialYearForPeriod(periodKey),
      budget: budgetInput.value, potential: potentialInput.value,
      budgetSupplied: budgetInput.supplied, potentialSupplied: potentialInput.supplied,
      budgetValid: budgetInput.valid, potentialValid: potentialInput.valid,
      sourceRowNumber: rowNumber,
    };
  }

  function finding(code, level, record, field, message) {
    return { code, severity: level, category: "REFERENCE", field, message, sourceRowNumber: record.sourceRowNumber };
  }

  function branchMap(context) {
    if (!context || !Array.isArray(context.branchRecords) || !context.branchRecords.length) return null;
    return new Map(context.branchRecords.filter((row) => row.branchId).map((row) => [row.branchId, row]));
  }

  function validateRow(record) {
    const findings = [];
    if (!record.bankId) findings.push(finding("COMMERCIAL_BANK_ID_MISSING", severity.ERROR, record, "BANK ID", "BANK ID is required."));
    if (!record.branchCode) findings.push(finding("COMMERCIAL_BRANCH_CODE_MISSING", severity.ERROR, record, "BRANCH CODE", "BRANCH CODE is required."));
    if (!record.periodKey) findings.push(finding("COMMERCIAL_PERIOD_INVALID", severity.ERROR, record, "PERIOD", "PERIOD must use canonical YYYY-MM format."));
    if (!record.budgetValid) findings.push(finding("COMMERCIAL_BUDGET_INVALID", severity.ERROR, record, "BUDGET", "BUDGET must be a non-negative number or blank."));
    if (!record.potentialValid) findings.push(finding("COMMERCIAL_POTENTIAL_INVALID", severity.ERROR, record, "POTENTIAL", "POTENTIAL must be a non-negative number or blank."));
    if (!record.budgetSupplied && !record.potentialSupplied) findings.push(finding("COMMERCIAL_VALUES_MISSING", severity.ERROR, record, "BUDGET/POTENTIAL", "At least one commercial reference value is required."));
    return findings;
  }

  function validateDataset(records, context) {
    const findings = [];
    const branches = branchMap(context);
    const keys = new Set();
    records.forEach((record) => {
      const key = record.branchId && record.periodKey ? `${record.branchId}\u0000${record.periodKey}` : null;
      if (key && keys.has(key)) findings.push(finding("COMMERCIAL_BRANCH_PERIOD_DUPLICATE", severity.ERROR, record, "PERIOD", `Duplicate branch-period reference: ${record.branchId} | ${record.periodKey}.`));
      if (key) keys.add(key);
      if (branches && record.branchId) {
        const branch = branches.get(record.branchId);
        if (!branch) findings.push(finding("COMMERCIAL_BRANCH_UNMAPPED", severity.ERROR, record, "BRANCH CODE", `Branch is not present in Branch Master: ${record.branchId}.`));
        else if (branch.active === false) findings.push(finding("COMMERCIAL_BRANCH_INACTIVE", severity.WARNING, record, "BRANCH CODE", `Commercial reference retained for inactive branch: ${record.branchId}.`));
      }
    });
    if (!branches) findings.push({ code: "COMMERCIAL_BRANCH_MASTER_ABSENT", severity: severity.ERROR, category: "REFERENCE", field: "BRANCH CODE", message: "An active Branch Master is required before this dataset can be activated." });
    return findings;
  }

  function summarize(records, findings = []) {
    const distinctBranches = new Set(records.map((row) => row.branchId).filter(Boolean)).size;
    const distinctPeriods = new Set(records.map((row) => row.periodKey).filter(Boolean)).size;
    const budgetPresent = records.filter((row) => row.budget !== null).length;
    const potentialPresent = records.filter((row) => row.potential !== null).length;
    const blockingFindings = findings.filter((item) => item.severity === severity.ERROR);
    const invalidRowNumbers = new Set(blockingFindings.map((item) => item.sourceRowNumber).filter(Number.isFinite));
    const invalidRows = blockingFindings.some((item) => !Number.isFinite(item.sourceRowNumber))
      ? records.length
      : invalidRowNumbers.size;
    return {
      records: records.length, validRows: records.length - invalidRows, invalidRows, distinctBranches, distinctPeriods,
      budgetPresent, budgetMissing: records.length - budgetPresent,
      potentialPresent, potentialMissing: records.length - potentialPresent,
      totalBudget: records.reduce((sum, row) => sum + (row.budget === null ? 0 : row.budget), 0),
      totalPotential: records.reduce((sum, row) => sum + (row.potential === null ? 0 : row.potential), 0),
      duplicateBranchPeriods: findings.filter((item) => item.code === "COMMERCIAL_BRANCH_PERIOD_DUPLICATE").length,
      unmappedBranches: findings.filter((item) => item.code === "COMMERCIAL_BRANCH_UNMAPPED").length,
      invalidNumericValues: findings.filter((item) => ["COMMERCIAL_BUDGET_INVALID", "COMMERCIAL_POTENTIAL_INVALID"].includes(item.code)).length,
      invalidPeriods: findings.filter((item) => item.code === "COMMERCIAL_PERIOD_INVALID").length,
    };
  }

  function assessReadiness(records, findings = []) {
    if (!records.length) return { status: "ABSENT", summary: summarize(records, findings), findings };
    if (findings.some((item) => item.severity === severity.ERROR)) return { status: "NOT_READY", summary: summarize(records, findings), findings };
    const partial = records.some((row) => row.budget === null || row.potential === null);
    return { status: partial ? "PARTIAL" : "READY", summary: summarize(records, findings), findings };
  }

  function prepareDataset(rawRows, datasetId, context = null) {
    if (!Array.isArray(rawRows)) throw new TypeError("Branch Budget & Potential rows must be an array.");
    const records = rawRows.map((row, index) => normalizeRow(row, datasetId, index + 2));
    const findings = records.flatMap(validateRow);
    findings.push(...validateDataset(records, context));
    const errorCount = findings.filter((item) => item.severity === severity.ERROR).length;
    const warningCount = findings.filter((item) => item.severity === severity.WARNING).length;
    return { records, findings, valid: errorCount === 0, errorCount, warningCount, commercialSummary: summarize(records, findings), commercialReadiness: assessReadiness(records, findings) };
  }

  global.BancaTrackerBranchBudgetPotentialMaster = Object.freeze({
    normalizeText, normalizeCode, normalizePeriod, normalizeMoney,
    financialYearForPeriod, buildBranchId, normalizeRow, validateRow,
    validateDataset, summarize, assessReadiness, prepareDataset,
  });
})(window);
