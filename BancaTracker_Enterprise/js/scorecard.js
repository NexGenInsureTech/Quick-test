/* Management Scorecard. Core supplies the current filtered view. */
(function (global) {
  const config = global.BancaTrackerConfig;
  const utils = global.BancaTrackerUtils;
  const PRIORITY_ORDER = { HIGH: 0, MEDIUM: 1, LOW: 2, "NO DATA": 3 };

  function classifyPriority(metrics) {
    if (metrics.premium === 0 && metrics.activeBranches === 0 && metrics.nearActiveBranches === 0) return "NO DATA";
    if (metrics.activationPercent < 20 && metrics.nearActiveBranches > 0) return "HIGH";
    if ((metrics.activationPercent >= 20 && metrics.activationPercent < 40) || (metrics.activationPercent < 20 && metrics.nearActiveBranches === 0 && metrics.premium > 0)) return "MEDIUM";
    if (metrics.activationPercent >= 40) return "LOW";
    return "NO DATA";
  }

  function managementCue(metrics) {
    if (metrics.priority === "HIGH") return "Prioritize near-active branches for conversion.";
    if (metrics.priority === "MEDIUM" && metrics.activationPercent < 20) return "Build branch activation pipeline.";
    return "Strengthen branch activation and convert near-active opportunities.";
  }

  function buildPartnerMetrics(input) {
    const derived = input && input.bankBranchMetrics ? input : global.BancaTrackerAnalytics.build(input);
    const totalPremium = derived.totalPremium;
    const metrics = Object.keys(config.TOTAL_BRANCHES).reduce((banks, bank) => {
      banks[bank] = { bank, premium: 0, observedBranches: 0, activeBranches: 0, nearActiveBranches: 0, branchUniverse: config.TOTAL_BRANCHES[bank] };
      return banks;
    }, {});

    Object.entries(derived.bankBranchMetrics).forEach(([name, source]) => { if (!metrics[name]) return; const bank = metrics[name]; bank.premium = source.premium; bank.observedBranches = source.observed; bank.activeBranches = source.active; bank.nearActiveBranches = source.nearActive; });

    return Object.values(metrics).map((bank) => {
      const activationPercent = bank.branchUniverse > 0 ? (bank.activeBranches / bank.branchUniverse) * 100 : 0;
      const result = {
        ...bank,
        contributionPercent: totalPremium > 0 ? (bank.premium / totalPremium) * 100 : 0,
        activationPercent,
        opportunityBranches: bank.nearActiveBranches
      };
      result.priority = classifyPriority(result);
      return result;
    }).sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || b.premium - a.premium || a.bank.localeCompare(b.bank));
  }

  function renderSummary(metrics) {
    const count = (priority) => metrics.filter((bank) => bank.priority === priority).length;
    const nearActive = metrics.reduce((sum, bank) => sum + bank.nearActiveBranches, 0);
    const cards = [["Total Partner Banks", metrics.length], ["High Priority Banks", count("HIGH")], ["Medium Priority Banks", count("MEDIUM")], ["Low Priority Banks", count("LOW")], ["Total Near Active", nearActive], ["Total Opportunities", nearActive]];
    document.getElementById("scorecardSummary").innerHTML = cards.map(([label, value]) => `<div class='card'><div>${label}</div><div class='value'>${value}</div></div>`).join("");
  }

  function renderScorecard(metrics) {
    const rows = metrics.map((bank) => `<tr><td>${utils.escapeHtml(bank.bank)}</td><td>${utils.formatInr(bank.premium)}</td><td>${bank.contributionPercent.toFixed(1)}%</td><td>${bank.observedBranches}</td><td>${bank.activeBranches}</td><td>${bank.branchUniverse}</td><td>${bank.activationPercent.toFixed(1)}%</td><td>${bank.nearActiveBranches}</td><td>${bank.opportunityBranches}</td><td><span class='priority priority-${bank.priority.toLowerCase().replace(" ", "-")}'>${bank.priority}</span></td></tr>`).join("");
    document.getElementById("partnerScorecard").innerHTML = `<p class='scorecard-note'>Branch Universe is configured; Observed Branches are only branches present in the uploaded data. Activation uses Active Branches ÷ Branch Universe.</p><table><thead><tr><th>Bank</th><th>Premium</th><th>Contribution %</th><th>Observed Branches</th><th>Active Branches</th><th>Branch Universe</th><th>Activation %</th><th>Near Active</th><th>Opportunities</th><th>Priority</th></tr></thead><tbody>${rows}</tbody></table>`;
  }

  function renderActions(metrics) {
    const actionable = metrics.filter((bank) => bank.priority === "HIGH" || bank.priority === "MEDIUM");
    document.getElementById("managementActions").innerHTML = actionable.length
      ? actionable.map((bank) => `<div class='metric'><strong>${utils.escapeHtml(bank.bank)} — ${bank.priority}</strong><br>${managementCue(bank)}</div>`).join("")
      : "<p class='empty-state'>No HIGH or MEDIUM priority banks in the selected view.</p>";
  }

  function refreshScorecard(derived) {
    const metrics = buildPartnerMetrics(derived);
    renderSummary(metrics);
    renderScorecard(metrics);
    renderActions(metrics);
  }

  global.BancaTrackerScorecard = Object.freeze({ buildPartnerMetrics, classifyPriority, refreshScorecard });
  global.refreshScorecard = refreshScorecard;
})(window);
