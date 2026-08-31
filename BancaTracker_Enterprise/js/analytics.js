/* One reusable derived-metrics object, built once per refresh cycle. */
(function (global) {
  const config = global.BancaTrackerConfig; const utils = global.BancaTrackerUtils;
  function increment(map, key, premium) { const name = key || "Blank"; map[name] = (map[name] || 0) + premium; }
  function build(data) {
    const metrics = { data, totalPremium: 0, recordCount: data.length, banks: {}, rms: {}, lobs: {}, months: {}, imds: new Set(), baCodes: new Set(), partnerBanks: new Set(), branchesByKey: {}, branches: [], activeBranches: [], nearActiveBranches: [], branchBands: {}, bankBranchMetrics: {}, zones: {}, states: {} };
    data.forEach((row) => {
      metrics.totalPremium += row.premium; increment(metrics.banks, row.bank, row.premium); increment(metrics.rms, row.rm, row.premium); increment(metrics.lobs, row.lob, row.premium); increment(metrics.months, row.month, row.premium);
      if (row.imd) metrics.imds.add(row.imd); if (row.baCode) metrics.baCodes.add(row.baCode); if (row.bank && row.bank !== "Unknown") metrics.partnerBanks.add(row.bank);
      if (!metrics.bankBranchMetrics[row.bank]) metrics.bankBranchMetrics[row.bank] = { premium: 0, observed: 0, active: 0, nearActive: 0 };
      metrics.bankBranchMetrics[row.bank].premium += row.premium;
      const key = utils.branchIdentityKey(row); if (!key) return; let branch = metrics.branchesByKey[key];
      if (!branch) branch = metrics.branchesByKey[key] = { key, branchId: row.branchId || null, branch: row.branch || "Unknown", bank: row.bank, premium: 0, zone: row.zone || "", state: row.state || "", zones: new Set(), states: new Set(), baCodes: new Set(), rmNames: new Set(), imds: new Set(), lobs: new Set(), productCodes: new Set() };
      branch.premium += row.premium;
      if (row.zone) branch.zones.add(row.zone); if (row.state) branch.states.add(row.state); if (row.baCode) branch.baCodes.add(row.baCode); if (row.rm) branch.rmNames.add(row.rm); if (row.imd) branch.imds.add(row.imd); if (row.lob) branch.lobs.add(row.lob); if (row.productCode) branch.productCodes.add(row.productCode);
    });
    metrics.branches = Object.values(metrics.branchesByKey);
    metrics.branches.forEach((branch) => {
      branch.zone = branch.zones.size > 1 ? "Multiple mappings" : ([...branch.zones][0] || "Unknown");
      branch.state = branch.states.size > 1 ? "Multiple mappings" : ([...branch.states][0] || "Unknown");
      const active = branch.premium >= config.THRESHOLDS.ACTIVE_BRANCH; const near = branch.premium >= config.THRESHOLDS.NEAR_ACTIVE_MIN && branch.premium < config.THRESHOLDS.ACTIVE_BRANCH;
      if (active) metrics.activeBranches.push(branch); if (near) metrics.nearActiveBranches.push(branch);
      const band = utils.getBranchBand(branch.premium); metrics.branchBands[band] = (metrics.branchBands[band] || 0) + 1;
      const bank = metrics.bankBranchMetrics[branch.bank]; bank.observed += 1; if (active) bank.active += 1; if (near) bank.nearActive += 1;
      [[metrics.zones, branch.zone || "Unknown"], [metrics.states, branch.state || "Unknown"]].forEach(([locations, name]) => { if (!locations[name]) locations[name] = { premium: 0, active: 0, total: 0 }; locations[name].premium += branch.premium; locations[name].total += 1; if (active) locations[name].active += 1; });
    });
    return metrics;
  }
  global.BancaTrackerAnalytics = Object.freeze({ build });
})(window);
