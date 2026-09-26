/* v8.6.1: pure additive Management Bank identity and metric authority. */
(function (global) {
  "use strict";

  const GOVERNED = Object.freeze({
    "INDIAN BANK": Object.freeze({ managementBank: "INDIAN BANK", subChannel: "CORE" }),
    "INDIAN BANK (PMSBY)": Object.freeze({ managementBank: "INDIAN BANK", subChannel: "PMSBY" }),
    "INDIAN OVERSEAS BANK": Object.freeze({ managementBank: "INDIAN OVERSEAS BANK", subChannel: "CORE" }),
    "INDIAN OVERSEAS BANK (PMSBY)": Object.freeze({ managementBank: "INDIAN OVERSEAS BANK", subChannel: "PMSBY" }),
  });

  const LEGACY_SELF_MAPPED = new Set([
    "KARNATAKA BANK LTD.",
    "ODISHA GRAMEEN BANK",
    "TAMIL NADU GRAMA BANK",
    "OTHER",
  ]);

  function resolution(status, sourceBank, managementBank, subChannel) {
    return Object.freeze({ status, sourceBank, managementBank, subChannel });
  }

  function resolve(sourceBank) {
    if (typeof sourceBank !== "string" || !sourceBank) {
      return resolution("INVALID", sourceBank, null, null);
    }
    const governed = GOVERNED[sourceBank];
    if (governed) {
      return resolution("GOVERNED", sourceBank, governed.managementBank, governed.subChannel);
    }
    if (LEGACY_SELF_MAPPED.has(sourceBank)) {
      return resolution("LEGACY_SELF_MAPPED", sourceBank, sourceBank, "CORE");
    }
    return resolution("UNMAPPED", sourceBank, null, null);
  }

  function enrichFacts(facts) {
    return (Array.isArray(facts) ? facts : []).map((fact) => {
      const source = fact && typeof fact === "object" ? fact : {};
      const resolved = resolve(source.bank);
      return {
        ...source,
        sourceBank: resolved.sourceBank,
        managementBank: resolved.managementBank,
        subChannel: resolved.subChannel,
        managementBankStatus: resolved.status,
      };
    });
  }

  function premiumOf(fact) {
    const premium = Number(fact && fact.premium);
    return Number.isFinite(premium) ? premium : 0;
  }

  function consolidateActuals(facts) {
    const enrichedFacts = enrichFacts(facts);
    const byManagementBank = new Map();
    let atomicActual = 0;
    let mappedActual = 0;
    let unmappedActual = 0;

    enrichedFacts.forEach((fact) => {
      const premium = premiumOf(fact);
      atomicActual += premium;
      if (!fact.managementBank) {
        unmappedActual += premium;
        return;
      }
      mappedActual += premium;
      byManagementBank.set(fact.managementBank, (byManagementBank.get(fact.managementBank) || 0) + premium);
    });

    const rows = [...byManagementBank].map(([managementBank, actual]) => Object.freeze({ managementBank, actual }));
    return Object.freeze({
      rows: Object.freeze(rows),
      atomicActual,
      mappedActual,
      unmappedActual,
      facts: Object.freeze(enrichedFacts),
    });
  }

  function filterFacts(facts, managementBank) {
    if (typeof managementBank !== "string" || !managementBank) return [];
    return enrichFacts(facts).filter((fact) => fact.managementBank === managementBank);
  }

  function resolveBudget(managementBank, flatTargets) {
    const targets = flatTargets && typeof flatTargets === "object" ? flatTargets : {};
    const ownsTarget = typeof managementBank === "string" && managementBank
      && Object.prototype.hasOwnProperty.call(targets, managementBank);
    const value = ownsTarget ? targets[managementBank] : null;
    const budget = typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
    return Object.freeze({
      status: budget === null ? "UNAVAILABLE" : "PARENT_AUTHORITATIVE",
      managementBank: typeof managementBank === "string" && managementBank ? managementBank : null,
      budget,
    });
  }

  function buildMetrics(facts, flatTargets) {
    const consolidated = consolidateActuals(facts);
    const rows = consolidated.rows.map((source) => {
      const budgetResult = resolveBudget(source.managementBank, flatTargets);
      const budget = budgetResult.budget;
      return Object.freeze({
        managementBank: source.managementBank,
        actual: source.actual,
        budget,
        achievementPercent: budget !== null && budget > 0 ? source.actual / budget * 100 : null,
        contributionPercent: consolidated.atomicActual > 0 ? source.actual / consolidated.atomicActual * 100 : null,
      });
    });
    return Object.freeze({
      rows: Object.freeze(rows),
      atomicActual: consolidated.atomicActual,
      mappedActual: consolidated.mappedActual,
      unmappedActual: consolidated.unmappedActual,
    });
  }

  global.BancaTrackerManagementBank = Object.freeze({
    resolve,
    enrichFacts,
    consolidateActuals,
    filterFacts,
    resolveBudget,
    buildMetrics,
  });
})(typeof globalThis !== "undefined" ? globalThis : window);
