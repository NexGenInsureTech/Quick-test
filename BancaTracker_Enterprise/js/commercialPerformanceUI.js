/*==============================================================
BancaTracker Enterprise
Version : 8.2.0-dev
File    : commercialPerformanceUI.js
Module  : Commercial Performance UI
Purpose : Render cached governed commercial roll-ups without owning formulas
==============================================================*/

(function (global) {
  "use strict";

  const state = { scopeType: "MONTH", selectedPeriod: null, selectedFinancialYear: null, dimension: "BANK" };
  const dimensionLabels = Object.freeze({ BANK: "Bank", BRANCH: "Branch", STATE: "State", ZONE: "Zone", BANK_REGION: "Bank Region", BANK_ZONE: "Bank Zone", FGM_OFFICE: "FGM Office", ASSIGNED_RM: "Assigned RM", CSM: "CSM", ASM: "ASM", ZSM: "ZSM", NATIONAL_HEAD: "National Head" });
  let initialized = false;

  const element = (id) => document.getElementById(id);
  const escape = (value) => global.BancaTrackerUtils.escapeHtml(value);
  function money(value) { return value === null || value === undefined ? "N/A" : `${value < 0 ? "-" : ""}₹${global.BancaTrackerUtils.formatInr(Math.abs(value))}`; }
  function percent(value) { return value === null || value === undefined ? "N/A" : `${Number(value).toFixed(1)}%`; }
  function periodLabel(value) { if (!value) return "None"; const [year, month] = value.split("-"); const labels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]; return `${labels[Number(month) - 1]}-${year.slice(-2)}`; }
  function semanticClass(value) { return typeof value === "number" && value < 0 ? "commercial-negative" : ""; }

  function option(value, label, selected) { return `<option value="${escape(value)}"${selected ? " selected" : ""}>${escape(label)}</option>`; }
  function syncState(periodContext) {
    if (!periodContext.availablePeriods.includes(state.selectedPeriod)) state.selectedPeriod = periodContext.defaultSelectedPeriod;
    if (!periodContext.availableFinancialYears.includes(state.selectedFinancialYear)) state.selectedFinancialYear = state.selectedPeriod ? global.BancaTrackerCommercialRollups.getFinancialYear(state.selectedPeriod) : periodContext.availableFinancialYears.at(-1) || null;
  }

  function renderControls(periodContext) {
    element("commercialScope").value = state.scopeType;
    element("commercialPeriod").innerHTML = periodContext.availablePeriods.map((value) => option(value, periodLabel(value), value === state.selectedPeriod)).join("");
    element("commercialFinancialYear").innerHTML = periodContext.availableFinancialYears.map((value) => option(value, value, value === state.selectedFinancialYear)).join("");
    element("commercialFinancialYear").disabled = state.scopeType !== "FY";
    element("commercialPeriod").disabled = state.scopeType === "FY";
    element("commercialDimension").innerHTML = Object.entries(dimensionLabels).map(([value, label]) => option(value, label, value === state.dimension)).join("");
  }

  function scopeRequest() { return state.scopeType === "FY" ? { type: "FY", financialYear: state.selectedFinancialYear } : { type: state.scopeType, periodKey: state.selectedPeriod }; }
  function coverageText(label, summary, prefix) {
    const present = summary && summary[`${prefix}PresentCount`] || 0;
    const missing = summary && summary[`${prefix}MissingCount`] || 0;
    return `${label}: ${missing ? "Partial" : present ? "Complete" : "Unavailable"} (${present}/${present + missing} branch-periods)`;
  }
  function renderReadiness(result, periodContext) {
    const status = result ? result.status : periodContext.status;
    const statusClass = status === "READY" ? " commercial-status-ready" : status === "PARTIAL" ? " commercial-status-partial" : "";
    const selected = state.scopeType === "FY" ? state.selectedFinancialYear : periodLabel(state.selectedPeriod);
    const exclusions = result && result.diagnostics.uniqueExcludedFactCount ? ` · Commercial exclusions: ${result.diagnostics.uniqueExcludedFactCount} rows` : "";
    element("commercialReadiness").innerHTML = `<span class="commercial-status${statusClass}">${escape(String(status).replace(/_/g, " "))}</span><strong>${escape(state.scopeType)}</strong>: ${escape(selected || "None")} · Latest available: ${escape(periodLabel(periodContext.latestAvailablePeriod))} · Latest actual: ${escape(periodLabel(periodContext.latestActualPeriod))}<br><span class="scorecard-note">${escape(coverageText("Budget coverage", result && result.summary, "budget"))} · ${escape(coverageText("Potential coverage", result && result.summary, "potential"))}${escape(exclusions)}</span>`;
  }
  function renderKpis(summary) {
    const values = summary ? [["Actual Premium", money(summary.actualPremium), summary.actualPremium], ["Budget", money(summary.budget), summary.budget], ["Achievement %", percent(summary.achievementPct), summary.achievementPct], ["Budget Gap", money(summary.budgetGap), summary.budgetGap], ["Potential", money(summary.potential), summary.potential], ["Potential Penetration %", percent(summary.potentialPenetrationPct), summary.potentialPenetrationPct]] : [];
    element("commercialKpis").innerHTML = values.map(([label, value, raw]) => `<div class="card"><div>${escape(label)}</div><div class="value ${semanticClass(raw)}">${escape(value)}</div></div>`).join("");
  }
  function renderTable(result) {
    if (!result || !result.rows.length) { element("commercialTable").innerHTML = `<p class="empty-state">No commercial performance rows are available for this scope.</p>`; return; }
    const rows = result.rows.map((row) => `<tr data-dimension-key="${escape(row.key)}"><td>${escape(row.label)}</td><td class="${semanticClass(row.actualPremium)}">${escape(money(row.actualPremium))}</td><td>${escape(money(row.budget))}</td><td class="${semanticClass(row.achievementPct)}">${escape(percent(row.achievementPct))}</td><td class="${semanticClass(row.budgetGap)}">${escape(money(row.budgetGap))}</td><td>${escape(money(row.potential))}</td><td class="${semanticClass(row.potentialPenetrationPct)}">${escape(percent(row.potentialPenetrationPct))}</td><td>${escape(coverageText("Budget", row, "budget"))}</td><td>${escape(coverageText("Potential", row, "potential"))}</td></tr>`).join("");
    element("commercialTable").innerHTML = `<table><thead><tr><th>${escape(dimensionLabels[state.dimension])}</th><th>Actual Premium</th><th>Budget</th><th>Achievement %</th><th>Budget Gap</th><th>Potential</th><th>Potential Penetration %</th><th>Budget Coverage</th><th>Potential Coverage</th></tr></thead><tbody>${rows}</tbody></table>`;
  }
  function empty(message, periodContext) { renderControls(periodContext); renderReadiness(null, periodContext); element("commercialKpis").innerHTML = ""; element("commercialTable").innerHTML = `<p class="empty-state">${escape(message)}</p>`; }

  function render() {
    const performance = global.BancaTrackerCore && global.BancaTrackerCore.state.commercialPerformance;
    const rollups = global.BancaTrackerCommercialRollups;
    const periodContext = rollups.buildPeriodContext(performance);
    syncState(periodContext);
    if (!periodContext.availablePeriods.length) { empty(performance && performance.status === "NO_COMMERCIAL_MASTER" ? "Branch Budget & Potential data has not been activated." : "No commercial periods are available.", periodContext); return null; }
    renderControls(periodContext);
    const authorityContext = global.BancaTrackerLiveGeographyAuthority && global.BancaTrackerLiveGeographyAuthority.getCachedContext();
    const scope = scopeRequest();
    const overall = rollups.buildRollup(performance, scope, "OVERALL", authorityContext);
    const table = rollups.buildRollup(performance, scope, state.dimension, authorityContext);
    renderReadiness(overall, periodContext); renderKpis(overall.summary); renderTable(table);
    return { periodContext, overall, table };
  }
  function handleScopeChange(value) { state.scopeType = value || element("commercialScope").value; return render(); }
  function handlePeriodChange(value) { state.selectedPeriod = value || element("commercialPeriod").value; state.selectedFinancialYear = global.BancaTrackerCommercialRollups.getFinancialYear(state.selectedPeriod); return render(); }
  function handleFinancialYearChange(value) { state.selectedFinancialYear = value || element("commercialFinancialYear").value; return render(); }
  function handleDimensionChange(value) { state.dimension = value || element("commercialDimension").value; return render(); }
  function init() {
    if (initialized) return;
    element("commercialScope").addEventListener("change", function () { handleScopeChange(this.value); });
    element("commercialPeriod").addEventListener("change", function () { handlePeriodChange(this.value); });
    element("commercialFinancialYear").addEventListener("change", function () { handleFinancialYearChange(this.value); });
    element("commercialDimension").addEventListener("change", function () { handleDimensionChange(this.value); });
    initialized = true;
  }
  init();
  global.BancaTrackerCommercialPerformanceUI = Object.freeze({ state, init, render, renderControls, renderKpis, renderTable, renderReadiness, handleScopeChange, handlePeriodChange, handleFinancialYearChange, handleDimensionChange, money, percent });
})(window);
