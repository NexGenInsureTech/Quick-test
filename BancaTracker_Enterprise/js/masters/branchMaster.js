/*==============================================================
BancaTracker Enterprise
Version : 8.2.0
File    : branchMaster.js
Module  : Master Data
Purpose : Normalize, validate and prepare durable Branch Master records
==============================================================*/

(function () {
  "use strict";

  if (!window.BancaTrackerDatasetRegistry) {
    throw new Error(
      "BancaTrackerDatasetRegistry must be loaded before branchMaster.js",
    );
  }

  const Registry = window.BancaTrackerDatasetRegistry;

  const { DATA_QUALITY_SEVERITY, DATA_QUALITY_CATEGORY } = Registry;

  function normalizeText(value) {
    if (value === null || typeof value === "undefined") {
      return null;
    }

    const normalized = String(value)
      .replace(/\u00A0/g, " ")
      .trim();

    return normalized || null;
  }

  function normalizeCode(value) {
    const normalized = normalizeText(value);

    return normalized ? normalized.toUpperCase() : null;
  }

  function normalizeBranchCode(value) {
    return normalizeText(value);
  }

  function normalizeName(value) {
    const normalized = normalizeText(value);

    return normalized ? normalized.replace(/\s+/g, " ").toUpperCase() : null;
  }

  function normalizeBoolean(value) {
    if (typeof value === "boolean") {
      return value;
    }

    const normalized = normalizeCode(value);

    if (["TRUE", "YES", "Y", "1"].includes(normalized)) {
      return true;
    }

    if (["FALSE", "NO", "N", "0"].includes(normalized)) {
      return false;
    }

    return null;
  }

  function buildBranchId(bankId, branchCode) {
    return bankId && branchCode ? `${bankId}:${branchCode}` : null;
  }

  function canonicalBankIdentity(bankId, config = window.BancaTrackerConfig) {
    const normalized = normalizeCode(bankId);
    if (!normalized || !config) return null;
    const mappedId = config.BANK_ID_ALIASES && config.BANK_ID_ALIASES[normalized];
    const candidate = mappedId || config.BANK_ALIASES && config.BANK_ALIASES[normalized] || normalized;
    return Object.prototype.hasOwnProperty.call(config.TOTAL_BRANCHES || {}, candidate)
      ? candidate
      : null;
  }

  function activationEligibilityInput(rawRow) {
    const aliases = ["ACTIVATION ELIGIBLE", "ACTIVATION_ELIGIBLE", "Activation Eligible"];
    const key = aliases.find((name) => Object.prototype.hasOwnProperty.call(rawRow, name));
    const rawValue = key ? normalizeText(rawRow[key]) : null;
    return {
      supplied: Boolean(rawValue),
      value: rawValue ? normalizeBoolean(rawValue) : null,
      field: key || "ACTIVATION ELIGIBLE",
      rawValue,
    };
  }

  function createFinding({
    code,
    severity,
    field = null,
    value = null,
    message,
  }) {
    return {
      code,
      severity,
      category: DATA_QUALITY_CATEGORY.BRANCH,
      field,
      value,
      message,
    };
  }

  function normalizeRow(rawRow, datasetId, rowNumber) {
    const bankId = normalizeCode(rawRow["BANK ID"]);
    const branchCode = normalizeBranchCode(rawRow["BRANCH CODE"]);
    const branchId = buildBranchId(bankId, branchCode);
    const branchName = normalizeText(rawRow["BRANCH NAME"]);
    const eligibility = activationEligibilityInput(rawRow);

    return {
      recordId: branchId
        ? `${datasetId}:${branchId}`
        : `${datasetId}:ROW:${rowNumber}`,
      datasetId,
      bankId,
      canonicalBank: canonicalBankIdentity(bankId),
      branchCode,
      branchId,
      branchName,
      normalizedBranchName: normalizeName(branchName),
      stateId: normalizeCode(rawRow["STATE ID"]),
      bankRegionId: normalizeCode(rawRow["BANK REGION ID"]),
      bankRegionName: normalizeText(rawRow["BANK REGION NAME"]),
      bankZoneId: normalizeCode(rawRow["BANK ZONE ID"]),
      bankZoneName: normalizeText(rawRow["BANK ZONE NAME"]),
      fgmOfficeId: normalizeCode(rawRow["FGM OFFICE ID"]),
      fgmOfficeName: normalizeText(rawRow["FGM OFFICE NAME"]),
      active: normalizeBoolean(rawRow["ACTIVE"]),
      activationEligible: eligibility.value,
      activationEligibilitySupplied: eligibility.supplied,
      activationEligibilityField: eligibility.field,
      activationEligibilityRaw: eligibility.rawValue,
      validFrom: normalizeText(rawRow["VALID FROM"]),
      validTo: normalizeText(rawRow["VALID TO"]),
      sourceRowNumber: rowNumber,
    };
  }

  function validateRow(record) {
    const findings = [];

    const requiredFields = [
      ["bankId", "BRANCH_BANK_ID_MISSING", "BANK ID"],
      ["branchCode", "BRANCH_CODE_MISSING", "BRANCH CODE"],
      ["branchName", "BRANCH_NAME_MISSING", "BRANCH NAME"],
      ["stateId", "BRANCH_STATE_ID_MISSING", "STATE ID"],
    ];

    requiredFields.forEach(([property, code, field]) => {
      if (!record[property]) {
        findings.push(
          createFinding({
            code,
            severity: DATA_QUALITY_SEVERITY.ERROR,
            field,
            message: `${field} is required.`,
          }),
        );
      }
    });

    if (typeof record.active !== "boolean") {
      findings.push(
        createFinding({
          code: "BRANCH_ACTIVE_INVALID",
          severity: DATA_QUALITY_SEVERITY.ERROR,
          field: "ACTIVE",
          message: "ACTIVE must be a valid boolean value.",
        }),
      );
    }

    if (record.activationEligibilitySupplied && typeof record.activationEligible !== "boolean") {
      findings.push(
        createFinding({
          code: "BRANCH_ACTIVATION_ELIGIBILITY_INVALID",
          severity: DATA_QUALITY_SEVERITY.ERROR,
          field: record.activationEligibilityField,
          value: record.activationEligibilityRaw,
          message: "ACTIVATION ELIGIBLE must be TRUE/FALSE, YES/NO, Y/N, or 1/0.",
        }),
      );
    } else if (!record.activationEligibilitySupplied) {
      findings.push(
        createFinding({
          code: "BRANCH_ACTIVATION_ELIGIBILITY_MISSING",
          severity: DATA_QUALITY_SEVERITY.WARNING,
          field: "ACTIVATION ELIGIBLE",
          message: "Activation eligibility is unknown; branch resolution remains available but governed-universe readiness is incomplete.",
        }),
      );
    }

    return findings;
  }

  function getGeographyStateIds(context) {
    if (!context) {
      return null;
    }

    const lookupMaps =
      context.geographyLookupMaps || context.geographyMaps || null;

    if (lookupMaps && lookupMaps.stateById instanceof Map) {
      return new Set(lookupMaps.stateById.keys());
    }

    if (Array.isArray(context.geographyRecords)) {
      return new Set(
        context.geographyRecords
          .filter((record) => record.active !== false && record.stateId)
          .map((record) => normalizeCode(record.stateId)),
      );
    }

    return null;
  }

  function validateDataset(records, context = null) {
    const findings = [];
    const branchIds = new Set();
    const geographyStateIds = getGeographyStateIds(context);

    records.forEach((record) => {
      if (record.branchId) {
        if (branchIds.has(record.branchId)) {
          findings.push(
            createFinding({
              code: "BRANCH_DUPLICATE_IDENTITY",
              severity: DATA_QUALITY_SEVERITY.ERROR,
              field: "BRANCH CODE",
              value: record.branchId,
              message: `Duplicate durable branch identity: ${record.branchId}`,
            }),
          );
        } else {
          branchIds.add(record.branchId);
        }
      }

      if (
        geographyStateIds &&
        record.stateId &&
        !geographyStateIds.has(record.stateId)
      ) {
        findings.push(
          createFinding({
            code: "BRANCH_STATE_UNMAPPED",
            severity: DATA_QUALITY_SEVERITY.ERROR,
            field: "STATE ID",
            value: record.stateId,
            message: `STATE ID is not present in Geography Master: ${record.stateId}`,
          }),
        );
      }
    });

    if (!geographyStateIds) {
      findings.push(
        createFinding({
          code: "BRANCH_GEOGRAPHY_MASTER_ABSENT",
          severity: DATA_QUALITY_SEVERITY.WARNING,
          field: "STATE ID",
          message: "Geography Master is absent; STATE ID references were not validated.",
        }),
      );
    }

    return findings;
  }

  function prepareDataset(rawRows, datasetId, context = null) {
    if (!Array.isArray(rawRows)) {
      throw new TypeError("Branch Master rows must be an array.");
    }

    const records = rawRows.map((row, index) =>
      normalizeRow(row, datasetId, index + 2),
    );

    const findings = [];

    records.forEach((record) => findings.push(...validateRow(record)));
    findings.push(...validateDataset(records, context));

    const errorCount = findings.filter(
      (finding) => finding.severity === DATA_QUALITY_SEVERITY.ERROR,
    ).length;

    const warningCount = findings.filter(
      (finding) => finding.severity === DATA_QUALITY_SEVERITY.WARNING,
    ).length;

    return {
      records,
      findings,
      valid: errorCount === 0,
      errorCount,
      warningCount,
      universeReadiness: assessUniverseReadiness(records),
    };
  }

  function assessUniverseReadiness(records) {
    const result = {
      status: records.length ? "READY" : "NOT_READY", totalRecords: records.length, operationalActiveRecords: 0,
      explicitlyEligibleRecords: 0, explicitlyIneligibleRecords: 0,
      eligibilityUnknownRecords: 0, inactiveRecords: 0,
      bankIdentityUnresolvedRecords: 0, findings: [],
    };
    records.forEach((record) => {
      if (record.active !== true) {
        result.inactiveRecords += 1;
        return;
      }
      result.operationalActiveRecords += 1;
      if (record.activationEligible === true) result.explicitlyEligibleRecords += 1;
      else if (record.activationEligible === false) result.explicitlyIneligibleRecords += 1;
      else result.eligibilityUnknownRecords += 1;
      if (!(record.canonicalBank || canonicalBankIdentity(record.bankId))) {
        result.bankIdentityUnresolvedRecords += 1;
      }
    });
    const invalidEligibilityRecords = records.filter(
      (record) => record.activationEligibilitySupplied && typeof record.activationEligible !== "boolean",
    ).length;
    if (invalidEligibilityRecords || result.bankIdentityUnresolvedRecords) {
      result.status = "NOT_READY";
    } else if (result.eligibilityUnknownRecords) {
      result.status = "INCOMPLETE";
    }
    if (result.eligibilityUnknownRecords) result.findings.push({ code: "BRANCH_UNIVERSE_ELIGIBILITY_INCOMPLETE", severity: "WARNING", count: result.eligibilityUnknownRecords });
    if (!records.length) result.findings.push({ code: "BRANCH_UNIVERSE_EMPTY", severity: "ERROR", count: 0 });
    if (invalidEligibilityRecords) result.findings.push({ code: "BRANCH_UNIVERSE_ELIGIBILITY_INVALID", severity: "ERROR", count: invalidEligibilityRecords });
    if (result.bankIdentityUnresolvedRecords) result.findings.push({ code: "BRANCH_UNIVERSE_BANK_IDENTITY_UNRESOLVED", severity: "ERROR", count: result.bankIdentityUnresolvedRecords });
    return result;
  }

  window.BancaTrackerBranchMaster = Object.freeze({
    normalizeText,
    normalizeCode,
    normalizeBoolean,
    normalizeBranchCode,
    normalizeName,
    canonicalBankIdentity,
    activationEligibilityInput,
    assessUniverseReadiness,
    buildBranchId,
    normalizeRow,
    validateRow,
    validateDataset,
    prepareDataset,
  });
})();
