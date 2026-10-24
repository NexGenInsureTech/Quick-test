/*==============================================================
BancaTracker Enterprise
File    : branchIdentityHealth.js
Module  : Local Diagnostics
Purpose : Aggregate, privacy-preserving branch identity reconciliation
==============================================================*/

(function (global) {
  "use strict";

  const CATEGORIES = Object.freeze([
    "INVALID_IDENTITY",
    "MASTER_UNAVAILABLE",
    "AMBIGUOUS_CANDIDATE",
    "EXACT_ACTIVE",
    "EXACT_INACTIVE",
    "BANK_REPRESENTATION_DIFFERENCE",
    "LEADING_ZERO_DIFFERENCE",
    "CASE_DIFFERENCE",
    "WHITESPACE_DIFFERENCE",
    "PUNCTUATION_DIFFERENCE",
    "MULTIPLE_REPRESENTATION_DIFFERENCES",
    "TRULY_UNMATCHED",
  ]);

  const DIFFERENCE_CATEGORIES = new Set([
    "BANK_REPRESENTATION_DIFFERENCE",
    "LEADING_ZERO_DIFFERENCE",
    "CASE_DIFFERENCE",
    "WHITESPACE_DIFFERENCE",
    "PUNCTUATION_DIFFERENCE",
    "MULTIPLE_REPRESENTATION_DIFFERENCES",
  ]);

  function deepFreeze(value) {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
    Object.values(value).forEach(deepFreeze);
    return Object.freeze(value);
  }

  function emptyCounts() {
    return Object.fromEntries(CATEGORIES.map((category) => [category, 0]));
  }

  function normalizeText(value) {
    return value === null || value === undefined ? "" : String(value).replace(/\u00A0/g, " ").trim();
  }

  function normalizeBank(value, branchMaster) {
    if (branchMaster && typeof branchMaster.normalizeCode === "function") {
      return branchMaster.normalizeCode(value) || "";
    }
    return normalizeText(value).toUpperCase();
  }

  function normalizeBranch(value, branchMaster) {
    if (branchMaster && typeof branchMaster.normalizeBranchCode === "function") {
      return branchMaster.normalizeBranchCode(value) || "";
    }
    return normalizeText(value);
  }

  function canonicalBank(bankId, branchMaster) {
    const governed = branchMaster && typeof branchMaster.canonicalBankIdentity === "function"
      ? branchMaster.canonicalBankIdentity(bankId)
      : null;
    return governed || `RAW:${bankId}`;
  }

  function removeLeadingZeros(value) {
    const stripped = value.replace(/^0+(?=.)/, "");
    return stripped || value;
  }

  function removeWhitespace(value) {
    return value.replace(/\s+/g, "");
  }

  function removePunctuation(value) {
    return value.replace(/[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/g, "");
  }

  function combinedCode(value) {
    return removeLeadingZeros(removePunctuation(removeWhitespace(value.toUpperCase())));
  }

  function addIndex(index, key, recordIndex) {
    let values = index.get(key);
    if (!values) {
      values = [];
      index.set(key, values);
    }
    values.push(recordIndex);
  }

  function indexKey(bank, code) {
    return `${bank}\u0000${code}`;
  }

  function differenceReasons(imported, master) {
    const reasons = [];
    if (imported.bankId !== master.bankId && imported.canonicalBank === master.canonicalBank) {
      reasons.push("BANK_REPRESENTATION_DIFFERENCE");
    }
    if (imported.branchCode !== master.branchCode && combinedCode(imported.branchCode) === combinedCode(master.branchCode)) {
      const compactImported = removePunctuation(removeWhitespace(imported.branchCode));
      const compactMaster = removePunctuation(removeWhitespace(master.branchCode));
      const importedLeadingZeros = (compactImported.match(/^0+/) || [""])[0].length;
      const masterLeadingZeros = (compactMaster.match(/^0+/) || [""])[0].length;
      if (importedLeadingZeros !== masterLeadingZeros) reasons.push("LEADING_ZERO_DIFFERENCE");
      if (removeLeadingZeros(compactImported) !== removeLeadingZeros(compactMaster)
          && removeLeadingZeros(compactImported).toUpperCase() === removeLeadingZeros(compactMaster).toUpperCase()) {
        reasons.push("CASE_DIFFERENCE");
      }
      const importedWhitespace = (imported.branchCode.match(/\s/g) || []).join("");
      const masterWhitespace = (master.branchCode.match(/\s/g) || []).join("");
      if (importedWhitespace !== masterWhitespace) reasons.push("WHITESPACE_DIFFERENCE");
      const importedPunctuation = imported.branchCode.replace(/[A-Za-z0-9\s]/g, "");
      const masterPunctuation = master.branchCode.replace(/[A-Za-z0-9\s]/g, "");
      if (importedPunctuation !== masterPunctuation) reasons.push("PUNCTUATION_DIFFERENCE");
    }
    return reasons;
  }

  function buildMasterIndexes(records, branchMaster) {
    const indexes = {
      exact: new Map(), code: new Map(), zero: new Map(), case: new Map(),
      whitespace: new Map(), punctuation: new Map(), combined: new Map(),
    };
    const normalized = [];
    const identityFrequency = new Map();
    let invalidIdentityCount = 0;

    records.forEach((record) => {
      const bankId = normalizeBank(record && record.bankId, branchMaster);
      const branchCode = normalizeBranch(record && record.branchCode, branchMaster);
      if (!bankId || !branchCode) {
        invalidIdentityCount += 1;
        return;
      }
      const branchId = branchMaster.buildBranchId(bankId, branchCode);
      const item = { bankId, branchCode, branchId, canonicalBank: canonicalBank(bankId, branchMaster), active: record.active };
      const recordIndex = normalized.length;
      normalized.push(item);
      identityFrequency.set(branchId, (identityFrequency.get(branchId) || 0) + 1);
      addIndex(indexes.exact, branchId, recordIndex);
      addIndex(indexes.code, indexKey(item.canonicalBank, branchCode), recordIndex);
      addIndex(indexes.zero, indexKey(item.canonicalBank, removeLeadingZeros(branchCode)), recordIndex);
      addIndex(indexes.case, indexKey(item.canonicalBank, branchCode.toUpperCase()), recordIndex);
      addIndex(indexes.whitespace, indexKey(item.canonicalBank, removeWhitespace(branchCode)), recordIndex);
      addIndex(indexes.punctuation, indexKey(item.canonicalBank, removePunctuation(branchCode)), recordIndex);
      addIndex(indexes.combined, indexKey(item.canonicalBank, combinedCode(branchCode)), recordIndex);
    });

    return {
      indexes,
      records: normalized,
      distinctIdentityCount: identityFrequency.size,
      invalidIdentityCount,
      duplicateIdentityCount: Array.from(identityFrequency.values()).filter((count) => count > 1).length,
    };
  }

  function candidateIndexes(imported, masterIndex) {
    const found = new Set();
    const lookups = [
      [masterIndex.indexes.code, imported.branchCode],
      [masterIndex.indexes.zero, removeLeadingZeros(imported.branchCode)],
      [masterIndex.indexes.case, imported.branchCode.toUpperCase()],
      [masterIndex.indexes.whitespace, removeWhitespace(imported.branchCode)],
      [masterIndex.indexes.punctuation, removePunctuation(imported.branchCode)],
      [masterIndex.indexes.combined, combinedCode(imported.branchCode)],
    ];
    lookups.forEach(([index, code]) => {
      const values = index.get(indexKey(imported.canonicalBank, code)) || [];
      values.forEach((value) => found.add(value));
    });
    return Array.from(found);
  }

  function classify(identity, masterAvailable, masterIndex) {
    if (!identity.valid) return { category: "INVALID_IDENTITY", secondary: [] };
    if (!masterAvailable) return { category: "MASTER_UNAVAILABLE", secondary: [] };

    const exact = masterIndex.indexes.exact.get(identity.branchId) || [];
    if (exact.length > 1) return { category: "AMBIGUOUS_CANDIDATE", secondary: [] };
    if (exact.length === 1) {
      return { category: masterIndex.records[exact[0]].active === false ? "EXACT_INACTIVE" : "EXACT_ACTIVE", secondary: [] };
    }

    const candidates = [];
    const secondary = new Set();
    candidateIndexes(identity, masterIndex).forEach((recordIndex) => {
      const reasons = differenceReasons(identity, masterIndex.records[recordIndex]);
      if (reasons.length) {
        reasons.forEach((reason) => secondary.add(reason));
        candidates.push({ recordIndex, reasons });
      }
    });
    if (candidates.length > 1) return { category: "AMBIGUOUS_CANDIDATE", secondary: Array.from(secondary) };
    if (!candidates.length) return { category: "TRULY_UNMATCHED", secondary: [] };
    return {
      category: candidates[0].reasons.length === 1 ? candidates[0].reasons[0] : "MULTIPLE_REPRESENTATION_DIFFERENCES",
      secondary: Array.from(secondary),
    };
  }

  function build(options = {}) {
    const branchMaster = options.branchMaster || global.BancaTrackerBranchMaster;
    if (!branchMaster || typeof branchMaster.buildBranchId !== "function") {
      throw new Error("Branch Master identity authority is unavailable.");
    }
    const importedRecords = Array.isArray(options.importedRecords) ? options.importedRecords : [];
    const masterRecords = Array.isArray(options.masterRecords) ? options.masterRecords : [];
    const findings = Array.isArray(options.findings) ? options.findings : [];
    const masterIndex = buildMasterIndexes(masterRecords, branchMaster);
    const activePointerAvailable = Boolean(options.activePointer);
    const activeDatasetAvailable = Boolean(options.activeDataset);
    const recordDatasetIds = new Set(masterRecords.map((record) => record && record.datasetId).filter(Boolean));
    const datasetMatchesPointer = !activePointerAvailable || !activeDatasetAvailable
      ? false
      : !options.activeDataset.datasetId || options.activeDataset.datasetId === options.activePointer;
    const recordsMatchPointer = !recordDatasetIds.size
      || (recordDatasetIds.size === 1 && recordDatasetIds.has(options.activePointer));
    const snapshotConsistent = datasetMatchesPointer && recordsMatchPointer;
    const masterAvailable = activePointerAvailable && activeDatasetAvailable && masterRecords.length > 0 && snapshotConsistent;
    const identities = new Map();
    const branchPeriods = new Set();

    importedRecords.forEach((record) => {
      const bankId = normalizeBank(record && record.bankId, branchMaster);
      const branchCode = normalizeBranch(record && record.branchCode, branchMaster);
      const valid = Boolean(bankId && branchCode);
      const branchId = valid ? branchMaster.buildBranchId(bankId, branchCode) : null;
      const identityKey = valid ? branchId : `INVALID\u0000${bankId}\u0000${branchCode}`;
      let identity = identities.get(identityKey);
      if (!identity) {
        identity = { bankId, branchCode, branchId, canonicalBank: canonicalBank(bankId, branchMaster), valid, rows: 0 };
        identities.set(identityKey, identity);
      }
      identity.rows += 1;
      if (branchId && record && record.periodKey) branchPeriods.add(`${branchId}\u0000${record.periodKey}`);
    });

    const primaryIdentityCounts = emptyCounts();
    const primaryRowCounts = emptyCounts();
    const secondaryIdentityCounts = Object.fromEntries(Array.from(DIFFERENCE_CATEGORIES).map((category) => [category, 0]));
    const secondaryRowCounts = Object.fromEntries(Array.from(DIFFERENCE_CATEGORIES).map((category) => [category, 0]));
    identities.forEach((identity) => {
      const result = classify(identity, masterAvailable, masterIndex);
      primaryIdentityCounts[result.category] += 1;
      primaryRowCounts[result.category] += identity.rows;
      result.secondary.forEach((category) => {
        secondaryIdentityCounts[category] += 1;
        secondaryRowCounts[category] += identity.rows;
      });
    });

    const declaredCountValue = options.activeDataset && (options.activeDataset.rowCount ?? options.activeDataset.recordCount);
    const declaredRecordCount = typeof declaredCountValue === "number" && Number.isFinite(declaredCountValue)
      ? declaredCountValue
      : typeof declaredCountValue === "string" && declaredCountValue.trim() !== "" && Number.isFinite(Number(declaredCountValue))
        ? Number(declaredCountValue)
        : null;
    const exactRows = primaryRowCounts.EXACT_ACTIVE + primaryRowCounts.EXACT_INACTIVE;
    const possibleDifferenceRows = Array.from(DIFFERENCE_CATEGORIES).reduce((sum, category) => sum + primaryRowCounts[category], 0);
    const duplicateCode = options.datasetType === "BRANCH_BUDGET_POTENTIAL"
      ? "COMMERCIAL_BRANCH_PERIOD_DUPLICATE"
      : "ASSIGNMENT_MULTIPLE_ACTIVE_RMS";

    return deepFreeze({
      status: "COMPLETE",
      datasetType: options.datasetType || null,
      processing: { stage: options.stage || "IDENTITY_DIAGNOSTIC", status: "COMPLETE", errorLocation: null },
      master: {
        activePointerAvailable,
        activeDatasetAvailable,
        available: masterAvailable,
        snapshotConsistent,
        declaredRecordCount,
        storedRecordCount: masterRecords.length,
        distinctIdentityCount: masterIndex.distinctIdentityCount,
        invalidIdentityCount: masterIndex.invalidIdentityCount,
        duplicateIdentityCount: masterIndex.duplicateIdentityCount,
        declaredStoredDiscrepancy: declaredRecordCount === null ? null : declaredRecordCount - masterRecords.length,
      },
      imported: {
        sourceRowCount: importedRecords.length,
        distinctBranchIdentityCount: identities.size,
        distinctBranchPeriodCount: options.datasetType === "BRANCH_BUDGET_POTENTIAL" ? branchPeriods.size : null,
        governedDuplicateFindingCount: findings.filter((finding) => finding && finding.code === duplicateCode).length,
      },
      primaryIdentityCounts,
      primaryRowCounts,
      secondaryCandidateSignals: { identityCounts: secondaryIdentityCounts, rowCounts: secondaryRowCounts },
      rowCoverage: {
        totalRows: importedRecords.length,
        exactRows,
        unmatchedRows: importedRecords.length - exactRows,
        exactActiveRows: primaryRowCounts.EXACT_ACTIVE,
        exactInactiveRows: primaryRowCounts.EXACT_INACTIVE,
        possibleDifferenceRows,
        ambiguousRows: primaryRowCounts.AMBIGUOUS_CANDIDATE,
        trulyUnmatchedRows: primaryRowCounts.TRULY_UNMATCHED,
        invalidRows: primaryRowCounts.INVALID_IDENTITY,
        masterUnavailableRows: primaryRowCounts.MASTER_UNAVAILABLE,
      },
    });
  }

  global.BancaTrackerBranchIdentityHealth = Object.freeze({ CATEGORIES, build });
})(window);
