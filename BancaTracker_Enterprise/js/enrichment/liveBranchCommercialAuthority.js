/*==============================================================
BancaTracker Enterprise
Version : 8.2.0
File    : liveBranchCommercialAuthority.js
Module  : Enrichment Foundation
Purpose : Cache and resolve governed branch-period commercial references
==============================================================*/

(function (global) {
  "use strict";

  function buildContext(records) {
    const rows = Array.isArray(records) ? records : [];
    const byKey = new Map();
    const byBranch = new Map();
    const byPeriod = new Map();
    rows.forEach((record) => {
      if (!record.branchId || !record.periodKey) return;
      byKey.set(`${record.branchId}\u0000${record.periodKey}`, record);
      if (!byBranch.has(record.branchId)) byBranch.set(record.branchId, []);
      if (!byPeriod.has(record.periodKey)) byPeriod.set(record.periodKey, []);
      byBranch.get(record.branchId).push(record);
      byPeriod.get(record.periodKey).push(record);
    });
    const readiness = global.BancaTrackerBranchBudgetPotentialMaster.assessReadiness(rows);
    return Object.freeze({
      status: readiness.status, records: rows, byKey, byBranch, byPeriod,
      summary: global.BancaTrackerBranchBudgetPotentialMaster.summarize(rows),
    });
  }

  let cachedContext = buildContext([]);

  function setCachedContext(context) {
    cachedContext = context || buildContext([]);
    return cachedContext;
  }

  function setFromRecords(records) {
    return setCachedContext(buildContext(records));
  }

  async function loadContext(repository = global.BancaTrackerRepository) {
    if (!repository) return setFromRecords([]);
    const records = await repository.getActiveMasterRecords("BRANCH_BUDGET_POTENTIAL").catch(() => []);
    return setFromRecords(records);
  }

  function getCachedContext() {
    return cachedContext;
  }

  function resolve(branchId, periodKey, context = cachedContext) {
    if (!context || context.status === "ABSENT") return { status: "MASTER_ABSENT", branchId, periodKey, budget: null, potential: null };
    const record = context.byKey.get(`${branchId}\u0000${periodKey}`);
    if (record) return { status: "MATCHED", branchId: record.branchId, periodKey: record.periodKey, budget: record.budget, potential: record.potential, financialYear: record.financialYear };
    return {
      status: context.byBranch.has(branchId) ? "PERIOD_UNAVAILABLE" : "UNMAPPED",
      branchId, periodKey, budget: null, potential: null,
    };
  }

  function getByBranch(branchId, context = cachedContext) {
    return (context && context.byBranch.get(branchId) || []).slice();
  }

  function getByPeriod(periodKey, context = cachedContext) {
    return (context && context.byPeriod.get(periodKey) || []).slice();
  }

  function getSummary(context = cachedContext) {
    return context ? context.summary : global.BancaTrackerBranchBudgetPotentialMaster.summarize([]);
  }

  global.BancaTrackerLiveBranchCommercialAuthority = Object.freeze({
    buildContext, loadContext, setCachedContext, setFromRecords, getCachedContext,
    resolve, getByBranch, getByPeriod, getSummary,
  });
})(window);
