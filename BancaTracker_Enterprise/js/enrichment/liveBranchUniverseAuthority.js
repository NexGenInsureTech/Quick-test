/*==============================================================
BancaTracker Enterprise
Version : 8.2.0
File    : liveBranchUniverseAuthority.js
Module  : Enrichment Foundation
Purpose : Provide one live activation-denominator authority
==============================================================*/

(function (global) {
  "use strict";

  const GOVERNED = "GOVERNED";
  const LEGACY_FALLBACK = "LEGACY_FALLBACK";
  const EFFECTIVE_DATED_GOVERNED = "EFFECTIVE_DATED_GOVERNED";
  const GOVERNED_LEGACY_UNDATED = "GOVERNED_LEGACY_UNDATED";
  const GOVERNED_MIXED_TEMPORAL = "GOVERNED_MIXED_TEMPORAL";
  const INVALID_PERIOD = "INVALID_PERIOD";
  const UNAVAILABLE = "UNAVAILABLE";

  function parseMonth(periodKey) {
    const match = typeof periodKey === "string" && /^(\d{4})-(\d{2})$/.exec(periodKey);
    if (!match) return null;
    const year = Number(match[1]);
    const month = Number(match[2]);
    if (month < 1 || month > 12) return null;
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    return {
      key: periodKey,
      start: `${match[1]}-${match[2]}-01`,
      end: `${match[1]}-${match[2]}-${String(lastDay).padStart(2, "0")}`,
    };
  }

  function parseDate(value) {
    if (value === null || value === undefined || value === "") return { absent: true, value: null };
    const text = String(value).trim();
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
    if (!match) return { absent: false, value: null };
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (month < 1 || month > 12 || day < 1 || date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
      return { absent: false, value: null };
    }
    return { absent: false, value: text };
  }

  function emptyEligibilityDiagnostics(periodKey, period) {
    return {
      requestedPeriod: periodKey === undefined ? null : periodKey,
      periodStart: period ? period.start : null,
      periodEnd: period ? period.end : null,
      requestedBankId: null,
      recordsConsidered: 0,
      distinctBranchIdentityCount: 0,
      eligibleCount: 0,
      explicitEffectiveEligibleCount: 0,
      legacyUndatedAdmittedCount: 0,
      excludedBeforeValidFromCount: 0,
      excludedAfterValidToCount: 0,
      excludedActivationEligibleFalseCount: 0,
      missingActivationEligibleCount: 0,
      invalidDateRangeCount: 0,
      invalidDateCount: 0,
      unknownBankCount: 0,
      duplicateBranchIdentityCount: 0,
      inactiveLegacyUndatedCount: 0,
      minimumExplicitValidFrom: null,
      maximumExplicitValidTo: null,
      periodOutsideKnownEffectiveCoverage: false,
      historicalMembershipTemporallyProven: false,
      authorityStatus: null,
    };
  }

  function freezeEligibilityResult(status, eligibleBranchIds, eligibleByBank, diagnostics) {
    const resultDiagnostics = Object.freeze({ ...diagnostics, authorityStatus: status });
    return Object.freeze({
      status,
      eligibleBranchIds: Object.freeze([...eligibleBranchIds].sort()),
      eligibleByBank: Object.freeze({ ...eligibleByBank }),
      diagnostics: resultDiagnostics,
    });
  }

  function resolveCanonicalBank(record) {
    return record && record.canonicalBank || null;
  }

  function resolveRequestedBank(bankId, records) {
    if (bankId === null || bankId === undefined || bankId === "") return null;
    const text = String(bankId).trim();
    if (!text) return null;
    const matched = (records || []).find((record) => record &&
      (record.bankId === text || record.canonicalBank === text) && resolveCanonicalBank(record));
    return matched ? resolveCanonicalBank(matched) : text;
  }

  function resolveEligibleUniverse(options = {}) {
    const rows = Array.isArray(options.records) ? options.records : [];
    const period = parseMonth(options.periodKey);
    const diagnostics = emptyEligibilityDiagnostics(options.periodKey, period);
    const requestedBank = resolveRequestedBank(options.bankId, rows);
    diagnostics.requestedBankId = requestedBank;
    if (!period) return freezeEligibilityResult(INVALID_PERIOD, [], {}, diagnostics);

    const seen = new Set();
    const eligible = new Map();
    let blocked = false;
    let hasExplicitRecords = false;
    let hasOpenStart = false;
    let hasOpenEnd = false;
    rows.forEach((record) => {
      diagnostics.recordsConsidered += 1;
      if (!record || !record.branchId) {
        blocked = true;
        return;
      }
      const branchId = String(record.branchId);
      if (seen.has(branchId)) {
        diagnostics.duplicateBranchIdentityCount += 1;
        blocked = true;
        return;
      }
      seen.add(branchId);
      diagnostics.distinctBranchIdentityCount += 1;

      const canonicalBank = resolveCanonicalBank(record);
      if (!canonicalBank) {
        diagnostics.unknownBankCount += 1;
        blocked = true;
        return;
      }
      if (requestedBank && canonicalBank !== requestedBank) return;

      const from = parseDate(record.validFrom);
      const to = parseDate(record.validTo);
      if ((!from.absent && !from.value) || (!to.absent && !to.value)) {
        diagnostics.invalidDateCount += 1;
        blocked = true;
        return;
      }
      if (from.value && to.value && to.value < from.value) {
        diagnostics.invalidDateRangeCount += 1;
        blocked = true;
        return;
      }
      if (record.activationEligible !== true) {
        if (record.activationEligible === false) diagnostics.excludedActivationEligibleFalseCount += 1;
        else {
          diagnostics.missingActivationEligibleCount += 1;
          blocked = true;
        }
        return;
      }

      const legacyUndated = from.absent && to.absent;
      if (legacyUndated) {
        if (record.active !== true) {
          diagnostics.inactiveLegacyUndatedCount += 1;
          return;
        }
        eligible.set(branchId, { bank: canonicalBank, provenance: "LEGACY_UNDATED" });
        diagnostics.legacyUndatedAdmittedCount += 1;
        return;
      }
      hasExplicitRecords = true;
      if (from.absent) hasOpenStart = true;
      else if (diagnostics.minimumExplicitValidFrom === null || from.value < diagnostics.minimumExplicitValidFrom) diagnostics.minimumExplicitValidFrom = from.value;
      if (to.absent) hasOpenEnd = true;
      else if (diagnostics.maximumExplicitValidTo === null || to.value > diagnostics.maximumExplicitValidTo) diagnostics.maximumExplicitValidTo = to.value;
      if (from.value && from.value > period.end) {
        diagnostics.excludedBeforeValidFromCount += 1;
        return;
      }
      if (to.value && to.value < period.start) {
        diagnostics.excludedAfterValidToCount += 1;
        return;
      }
      eligible.set(branchId, { bank: canonicalBank, provenance: "EXPLICIT" });
      diagnostics.explicitEffectiveEligibleCount += 1;
    });

    if (requestedBank && !rows.some((record) => resolveCanonicalBank(record) === requestedBank)) {
      diagnostics.unknownBankCount += 1;
      blocked = true;
    }
    diagnostics.periodOutsideKnownEffectiveCoverage = hasExplicitRecords &&
      !hasOpenStart && !hasOpenEnd &&
      ((diagnostics.minimumExplicitValidFrom && period.end < diagnostics.minimumExplicitValidFrom) ||
        (diagnostics.maximumExplicitValidTo && period.start > diagnostics.maximumExplicitValidTo));
    if (diagnostics.periodOutsideKnownEffectiveCoverage && diagnostics.legacyUndatedAdmittedCount === 0) blocked = true;
    if (blocked) return freezeEligibilityResult(UNAVAILABLE, [], {}, diagnostics);

    const eligibleByBank = {};
    eligible.forEach((item) => { eligibleByBank[item.bank] = (eligibleByBank[item.bank] || 0) + 1; });
    diagnostics.eligibleCount = eligible.size;
    diagnostics.historicalMembershipTemporallyProven = eligible.size > 0 && diagnostics.legacyUndatedAdmittedCount === 0;
    const status = diagnostics.legacyUndatedAdmittedCount && diagnostics.explicitEffectiveEligibleCount
      ? GOVERNED_MIXED_TEMPORAL
      : diagnostics.legacyUndatedAdmittedCount
        ? GOVERNED_LEGACY_UNDATED
        : EFFECTIVE_DATED_GOVERNED;
    return freezeEligibilityResult(status, [...eligible.keys()], eligibleByBank, diagnostics);
  }

  function legacyUniverse(config = global.BancaTrackerConfig) {
    const byBank = { ...config.TOTAL_BRANCHES };
    return { total: Object.values(byBank).reduce((sum, value) => sum + value, 0), byBank };
  }

  function buildFromBranchMaster(records, options = {}) {
    const config = options.config || global.BancaTrackerConfig;
    const rows = Array.isArray(records) ? records : [];
    const readiness = global.BancaTrackerBranchMaster.assessUniverseReadiness(rows);
    const byBankSets = new Map();

    rows.forEach((record) => {
      if (record.active !== true) return;
      const canonicalBank = record.canonicalBank ||
        global.BancaTrackerBranchMaster.canonicalBankIdentity(record.bankId, config);
      if (!canonicalBank) return;
      if (!byBankSets.has(canonicalBank)) byBankSets.set(canonicalBank, new Set());
      if (record.activationEligible === true && record.branchId) {
        byBankSets.get(canonicalBank).add(record.branchId);
      }
    });

    const governedByBank = Object.fromEntries(
      [...byBankSets].map(([bank, branchIds]) => [bank, branchIds.size]),
    );
    const governedTotal = Object.values(governedByBank).reduce((sum, count) => sum + count, 0);
    const legacy = legacyUniverse(config);
    const varianceByBank = {};
    Object.keys(governedByBank).forEach((bank) => {
      if (Object.prototype.hasOwnProperty.call(legacy.byBank, bank)) {
        varianceByBank[bank] = {
          legacyConfigured: legacy.byBank[bank],
          governedEligible: governedByBank[bank],
          variance: governedByBank[bank] - legacy.byBank[bank],
        };
      }
    });
    const comparable = Object.values(varianceByBank);
    const variance = {
      total: {
        legacyConfigured: comparable.reduce((sum, item) => sum + item.legacyConfigured, 0),
        governedEligible: comparable.reduce((sum, item) => sum + item.governedEligible, 0),
        variance: comparable.reduce((sum, item) => sum + item.variance, 0),
      },
      byBank: varianceByBank,
    };
    const authority = readiness.status === "READY" ? GOVERNED : LEGACY_FALLBACK;
    const reason = !rows.length
      ? "BRANCH_MASTER_ABSENT"
      : readiness.status === "INCOMPLETE"
        ? "UNIVERSE_INCOMPLETE"
        : readiness.status === "NOT_READY"
          ? "UNIVERSE_NOT_READY"
          : "UNIVERSE_READY";

    return Object.freeze({
      authority,
      reason,
      universeStatus: readiness.status,
      readiness,
      governed: Object.freeze({ total: governedTotal, byBank: Object.freeze(governedByBank) }),
      legacy: Object.freeze({ total: legacy.total, byBank: Object.freeze(legacy.byBank) }),
      variance: Object.freeze({ total: Object.freeze(variance.total), byBank: Object.freeze(variance.byBank) }),
    });
  }

  let cachedUniverse = buildFromBranchMaster([]);

  function setUniverse(result) {
    cachedUniverse = result || buildFromBranchMaster([]);
    return cachedUniverse;
  }

  function setFromBranchMaster(records, options) {
    return setUniverse(buildFromBranchMaster(records, options));
  }

  async function loadContext(repository = global.BancaTrackerRepository) {
    if (!repository) return setFromBranchMaster([]);
    const records = await repository.getActiveMasterRecords("BRANCH_MASTER").catch(() => []);
    return setFromBranchMaster(records);
  }

  function getUniverse() {
    return cachedUniverse;
  }

  function getBankUniverse(bank, universe = cachedUniverse) {
    const byBank = universe.authority === GOVERNED ? universe.governed.byBank : universe.legacy.byBank;
    return Object.prototype.hasOwnProperty.call(byBank, bank) ? byBank[bank] : null;
  }

  function getDenominator(bank, universe = cachedUniverse) {
    return bank ? getBankUniverse(bank, universe) :
      universe.authority === GOVERNED ? universe.governed.total : universe.legacy.total;
  }

  function getAuthorityStatus() {
    return cachedUniverse.authority;
  }

  function assessObserved(derived, universe = cachedUniverse) {
    const findings = [];
    let observed = 0;
    let active = 0;
    let nearActive = 0;
    Object.entries((derived && derived.bankBranchMetrics) || {}).forEach(([bank, metrics]) => {
      if (universe.authority !== GOVERNED) return;
      const eligible = getBankUniverse(bank, universe);
      if (eligible === null) return;
      observed += metrics.observed || 0;
      active += metrics.active || 0;
      nearActive += metrics.nearActive || 0;
      if ((metrics.observed || 0) > eligible) findings.push({
        code: "OBSERVED_BRANCHES_EXCEED_GOVERNED_UNIVERSE", severity: "WARNING", bank,
        observed: metrics.observed || 0, governedEligible: eligible,
      });
      if ((metrics.active || 0) > eligible) findings.push({
        code: "ACTIVE_BRANCHES_EXCEED_GOVERNED_UNIVERSE", severity: "ERROR", bank,
        active: metrics.active || 0, governedEligible: eligible,
      });
    });
    return { observedGovernedBranches: observed, activeGovernedBranches: active, nearActiveGovernedBranches: nearActive, findings };
  }

  global.BancaTrackerLiveBranchUniverseAuthority = Object.freeze({
    GOVERNED, LEGACY_FALLBACK, EFFECTIVE_DATED_GOVERNED, GOVERNED_LEGACY_UNDATED,
    GOVERNED_MIXED_TEMPORAL, INVALID_PERIOD, UNAVAILABLE,
    buildFromBranchMaster, resolveEligibleUniverse, loadContext, setUniverse,
    setFromBranchMaster, getUniverse, getBankUniverse, getDenominator,
    getAuthorityStatus, assessObserved,
  });
})(window);
