/* Performance MIS renderer. Core supplies the selected data scopes and owns state. */
(function (global) {
  const config = global.BancaTrackerConfig;
  const utils = global.BancaTrackerUtils;

  const TABLE_LIMIT = 50;
  function renderTable(id, totals, totalPremium, skipBlank) {
    const entries = Object.entries(totals)
      .filter(([name]) => !skipBlank || (Boolean(String(name).trim()) && name !== "Blank" && name !== "Unknown"))
      .sort((a, b) => b[1] - a[1]);
    const note = entries.length > TABLE_LIMIT ? `<tr><td colspan='3' class='table-limit-note'>Showing top ${TABLE_LIMIT} of ${utils.formatInr(entries.length)} results.</td></tr>` : "";
    document.getElementById(id).innerHTML = entries.slice(0, TABLE_LIMIT).map(([name, premium]) => `<tr><td>${utils.escapeHtml(name)}</td><td>${utils.formatInr(premium)}</td><td>${utils.formatPercent(premium, totalPremium)}</td></tr>`).join("") + note;
  }

  function calculateKpis(context) {
    const derived = context.derived;
    return {
      ytdPremium: context.ytdPremium, mtdPremium: context.mtdPremium, records: derived.recordCount,
      partnerInstitutions: derived.partnerBanks.size, activeRms: derived.baCodes.size,
      activeBranches: derived.activeBranches.length, activeImds: derived.imds.size
    };
  }

  function renderKpis(kpis) {
    const cards = [["YTD Premium", utils.formatInr(kpis.ytdPremium)], ["MTD Premium", utils.formatInr(kpis.mtdPremium)], ["Records", utils.formatInr(kpis.records)], ["Partner Institutions", utils.formatInr(kpis.partnerInstitutions)], ["Active RMs", utils.formatInr(kpis.activeRms)], ["Active Branches", utils.formatInr(kpis.activeBranches)], ["Active IMDs", utils.formatInr(kpis.activeImds)]];
    document.getElementById("kpis").innerHTML = cards.map(([label, value]) => `<div class='card'><div>${label}</div><div class='value'>${value}</div></div>`).join("");
  }

  function renderMonthlyBusiness(derived) {
    const totals = derived.months; const months = utils.orderMonths(Object.keys(totals));
    document.getElementById("monthlyCards").innerHTML = months.map((month) => `<div class='month-card'><div>${utils.escapeHtml(month)}</div><div class='value'>${(totals[month] / 10000000).toFixed(2)} Cr</div></div>`).join("");
  }

  function renderPerformance(context) {
    const viewPremium = context.derived.totalPremium;
    renderKpis(calculateKpis(context));
    renderMonthlyBusiness(context.derived);
    renderTable("bankTable", context.derived.banks, viewPremium, true);
    renderTable("rmTable", context.derived.rms, viewPremium, true);
    renderTable("lobTable", context.derived.lobs, viewPremium, true);
  }

  global.BancaTrackerPerformance = Object.freeze({ calculateKpis, renderPerformance });
  global.renderPerformance = renderPerformance;
})(window);
