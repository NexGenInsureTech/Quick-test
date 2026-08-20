/* Activation Intelligence renderer. Core owns filter state and supplies the current view. */
(function (global) {
  const config = global.BancaTrackerConfig;
  const utils = global.BancaTrackerUtils;
  const BAND_ORDER = ["Zero", "1 - 14.9K", "15K - 24.9K", "25K - 49.9K", "50K - 99.9K", "1L - 1.99L", "2L+"];
  const active = (branch) => branch.premium >= config.THRESHOLDS.ACTIVE_BRANCH;
  const nearActive = (branch) => branch.premium >= config.THRESHOLDS.NEAR_ACTIVE_MIN && branch.premium < config.THRESHOLDS.ACTIVE_BRANCH;

  function renderKpis(branches) {
    const premium = branches.reduce((sum, branch) => sum + branch.premium, 0);
    const cards = [["Observed Branches", branches.length], ["Active Branches", branches.filter(active).length], ["Near Active Branches", branches.filter(nearActive).length], ["Observed Premium", utils.formatInr(premium)]];
    document.getElementById("activationKpis").innerHTML = cards.map(([label, value]) => `<div class='card'><div>${label}</div><div class='value'>${value}</div></div>`).join("");
  }

  function renderMaturityPyramid(branches) {
    const bands = BAND_ORDER.reduce((counts, band) => ({ ...counts, [band]: 0 }), {});
    branches.forEach((branch) => { bands[utils.getBranchBand(branch.premium)] += 1; });
    document.getElementById("branchPyramid").innerHTML = BAND_ORDER.map((band) => `<div class='metric'><strong>${band}</strong>: ${bands[band]}</div>`).join("");
  }

  function renderOpportunities(branches) {
    const opportunities = branches.filter(nearActive).map((branch) => ({ ...branch, gap: config.THRESHOLDS.ACTIVE_BRANCH - branch.premium })).sort((a, b) => a.gap - b.gap);
    const container = document.getElementById("opportunityBranches");
    document.getElementById("opportunityCount").textContent = `${opportunities.length} near-active branch${opportunities.length === 1 ? "" : "es"} in the selected view`;
    if (!opportunities.length) { container.innerHTML = "<p class='empty-state'>No near-active branches in the selected view.</p>"; return; }
    container.innerHTML = `<table><thead><tr><th>Branch</th><th>Bank</th><th>Zone</th><th>State</th><th>Current Premium</th><th>Gap To ₹25K</th></tr></thead><tbody>${opportunities.map((branch) => `<tr><td>${utils.escapeHtml(branch.branch)}</td><td>${utils.escapeHtml(branch.bank)}</td><td>${utils.escapeHtml(branch.zone || "Unknown")}</td><td>${utils.escapeHtml(branch.state || "Unknown")}</td><td>${utils.formatInr(branch.premium)}</td><td>${utils.formatInr(branch.gap)}</td></tr>`).join("")}</tbody></table>`;
  }

  function renderBankActivation(branches) {
    const observedByBank = branches.reduce((metrics, branch) => {
      if (!metrics[branch.bank]) metrics[branch.bank] = { active: 0 };
      if (active(branch)) metrics[branch.bank].active += 1;
      return metrics;
    }, {});
    const banks = [...new Set([...Object.keys(config.TOTAL_BRANCHES), ...Object.keys(observedByBank)])];
    document.getElementById("bankActivation").innerHTML = `<p class='activation-note'>Configured universe is the denominator; branch counts are observed in the selected view.</p><table><thead><tr><th>Bank</th><th>Active Branches</th><th>Branch Universe</th><th>Activation %</th></tr></thead><tbody>${banks.map((bank) => { const universe = config.TOTAL_BRANCHES[bank]; const activeBranches = (observedByBank[bank] || {}).active || 0; return `<tr><td>${utils.escapeHtml(bank)}</td><td>${activeBranches}</td><td>${universe || "Not configured"}</td><td>${universe ? utils.formatPercent(activeBranches, universe) : "N/A"}</td></tr>`; }).join("")}</tbody></table>`;
  }

  function renderLocationActivation(branches, field, containerId, emptyMessage) {
    const container = document.getElementById(containerId);
    if (!branches.length) { container.innerHTML = `<p class='empty-state'>${emptyMessage}</p>`; return; }
    const locations = branches.reduce((metrics, branch) => {
      const location = branch[field] || "Unknown";
      if (!metrics[location]) metrics[location] = { premium: 0, active: 0, total: 0 };
      metrics[location].premium += branch.premium;
      metrics[location].total += 1;
      if (active(branch)) metrics[location].active += 1;
      return metrics;
    }, {});
    container.innerHTML = `<table><thead><tr><th>${field === "zone" ? "Zone" : "State"}</th><th>Premium</th><th>Active Branches</th><th>Observed Branches</th><th>Activation %</th></tr></thead><tbody>${Object.entries(locations).sort((a, b) => b[1].premium - a[1].premium).map(([location, metrics]) => `<tr><td>${utils.escapeHtml(location)}</td><td>${utils.formatInr(metrics.premium)}</td><td>${metrics.active}</td><td>${metrics.total}</td><td>${utils.formatPercent(metrics.active, metrics.total)}</td></tr>`).join("")}</tbody></table>`;
  }

  function renderScope() {
    const filters = global.BancaTrackerCore.state.filters;
    document.getElementById("activationScope").textContent = `Current scope — Month: ${filters.month}; Bank: ${filters.bank}. Branch counts are based only on uploaded records in this scope.`;
  }

  function refreshActivation(data) {
    const branches = Object.values(utils.buildBranchMetrics(data));
    renderScope(); renderKpis(branches); renderMaturityPyramid(branches); renderBankActivation(branches); renderOpportunities(branches);
    renderLocationActivation(branches, "zone", "zoneActivation", "No zone data supplied in the selected view.");
    renderLocationActivation(branches, "state", "stateActivation", "No state data supplied in the selected view.");
  }

  global.BancaTrackerActivation = Object.freeze({ refreshActivation });
  global.refreshActivation = refreshActivation;
})(window);
