/*==============================================================
BancaTracker Enterprise
Version : 8.2.0-dev
File    : liveBranchUniverseAuthority.js
Module  : Enrichment Foundation
Purpose : Provide one live activation-denominator authority
==============================================================*/

(function (global) {
  "use strict";

  const GOVERNED = "GOVERNED";
  const LEGACY_FALLBACK = "LEGACY_FALLBACK";

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
    GOVERNED, LEGACY_FALLBACK, buildFromBranchMaster, loadContext, setUniverse,
    setFromBranchMaster, getUniverse, getBankUniverse, getDenominator,
    getAuthorityStatus, assessObserved,
  });
})(window);
