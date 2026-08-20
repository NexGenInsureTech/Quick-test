/* Performance MIS renderer. Core supplies the selected data scopes and owns state. */
(function (global) {
  const config = global.BancaTrackerConfig;
  const utils = global.BancaTrackerUtils;
  const premiumTotal = (data) => data.reduce((sum, row) => sum + row.premium, 0);

  function renderTable(id, totals, totalPremium, skipBlank) {
    document.getElementById(id).innerHTML = Object.entries(totals)
      .filter(([name]) => !skipBlank || (Boolean(String(name).trim()) && name !== "Blank" && name !== "Unknown"))
      .sort((a, b) => b[1] - a[1]).slice(0, 25)
      .map(([name, premium]) => `<tr><td>${utils.escapeHtml(name)}</td><td>${utils.formatInr(premium)}</td><td>${utils.formatPercent(premium, totalPremium)}</td></tr>`).join("");
  }

  function calculateKpis(context) {
    const viewData = context.viewData;
    const branches = utils.buildBranchMetrics(viewData);
    return {
      ytdPremium: premiumTotal(context.ytdData),
      mtdPremium: premiumTotal(context.mtdData),
      records: viewData.length,
      partnerInstitutions: new Set(viewData.map((row) => row.bank).filter((bank) => bank && bank !== "Unknown")).size,
      activeRms: new Set(viewData.map((row) => row.baCode).filter(Boolean)).size,
      activeBranches: Object.values(branches).filter((branch) => branch.premium >= config.THRESHOLDS.ACTIVE_BRANCH).length,
      activeImds: new Set(viewData.map((row) => row.imd).filter(Boolean)).size
    };
  }

  function renderKpis(kpis) {
    const cards = [["YTD Premium", utils.formatInr(kpis.ytdPremium)], ["MTD Premium", utils.formatInr(kpis.mtdPremium)], ["Records", utils.formatInr(kpis.records)], ["Partner Institutions", utils.formatInr(kpis.partnerInstitutions)], ["Active RMs", utils.formatInr(kpis.activeRms)], ["Active Branches", utils.formatInr(kpis.activeBranches)], ["Active IMDs", utils.formatInr(kpis.activeImds)]];
    document.getElementById("kpis").innerHTML = cards.map(([label, value]) => `<div class='card'><div>${label}</div><div class='value'>${value}</div></div>`).join("");
  }

  function renderMonthlyBusiness(data) {
    const totals = utils.aggregatePremium(data, "month");
    const months = utils.orderMonths(data.map((row) => row.month));
    document.getElementById("monthlyCards").innerHTML = months.map((month) => `<div class='month-card'><div>${utils.escapeHtml(month)}</div><div class='value'>${(totals[month] / 10000000).toFixed(2)} Cr</div></div>`).join("");
  }

  function renderPerformance(context) {
    const viewPremium = premiumTotal(context.viewData);
    renderKpis(calculateKpis(context));
    renderMonthlyBusiness(context.viewData);
    renderTable("bankTable", utils.aggregatePremium(context.viewData, "bank"), viewPremium, true);
    renderTable("rmTable", utils.aggregatePremium(context.viewData, "rm"), viewPremium, true);
    renderTable("lobTable", utils.aggregatePremium(context.viewData, "lob"), viewPremium, true);
  }

  global.BancaTrackerPerformance = Object.freeze({ calculateKpis, renderPerformance });
  global.renderPerformance = renderPerformance;
})(window);
