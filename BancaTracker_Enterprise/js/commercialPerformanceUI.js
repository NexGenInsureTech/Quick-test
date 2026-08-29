/*==============================================================
BancaTracker Enterprise
Version : 8.2.0-dev
File    : commercialPerformanceUI.js
Module  : Commercial Performance UI
Purpose : Render cached governed commercial roll-ups without owning formulas
==============================================================*/

(function (global) {
  "use strict";

  const state = { scopeType: "MONTH", selectedPeriod: null, selectedFinancialYear: null, dimension: "BANK", comparison: { basePeriod: null, comparisonPeriod: null, dimension: "BANK", selectedEntityKey: null, dailyViewMode: "CUMULATIVE" } };
  const dimensionLabels = Object.freeze({ OVERALL: "Overall", BANK: "Bank", BRANCH: "Branch", STATE: "State", ZONE: "Zone", BANK_REGION: "Bank Region", BANK_ZONE: "Bank Zone", FGM_OFFICE: "FGM Office", ASSIGNED_RM: "Assigned RM", CSM: "CSM", ASM: "ASM", ZSM: "ZSM", NATIONAL_HEAD: "National Head" });
  let initialized = false;
  let lastDailyResult = null;

  const element = (id) => document.getElementById(id);
  const escape = (value) => global.BancaTrackerUtils.escapeHtml(value);
  function money(value) { return value === null || value === undefined ? "N/A" : `${value < 0 ? "-" : ""}₹${global.BancaTrackerUtils.formatInr(Math.abs(value))}`; }
  function percent(value) { return value === null || value === undefined ? "N/A" : `${Number(value).toFixed(1)}%`; }
  function signedMoney(value) { return value === null || value === undefined ? "N/A" : `${value > 0 ? "+" : ""}${money(value)}`; }
  function points(value) { return value === null || value === undefined ? "N/A" : `${value > 0 ? "+" : ""}${Number(value).toFixed(1)} pp`; }
  function growth(value) { return value === null || value === undefined ? "N/A" : `${value > 0 ? "Growth +" : value < 0 ? "Degrowth " : "Flat "}${Number(value).toFixed(1)}%`; }
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
    element("commercialDimension").innerHTML = Object.entries(dimensionLabels).filter(([value]) => value !== "OVERALL").map(([value, label]) => option(value, label, value === state.dimension)).join("");
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

  function syncComparisonState(periodContext) {
    const available = periodContext.availablePeriods;
    const currentValid = available.includes(state.comparison.comparisonPeriod);
    if (!currentValid) {
      const defaults = global.BancaTrackerCommercialComparison.resolveDefaultPeriods(periodContext);
      state.comparison.basePeriod = defaults.basePeriod;
      state.comparison.comparisonPeriod = defaults.comparisonPeriod;
    } else if (state.comparison.basePeriod && !available.includes(state.comparison.basePeriod)) state.comparison.basePeriod = null;
  }
  function renderComparisonControls(periodContext) {
    const emptyOption = option("", "Select month", !state.comparison.basePeriod);
    element("comparisonBasePeriod").innerHTML = emptyOption + periodContext.availablePeriods.map((value) => option(value, periodLabel(value), value === state.comparison.basePeriod)).join("");
    element("comparisonPeriod").innerHTML = periodContext.availablePeriods.map((value) => option(value, periodLabel(value), value === state.comparison.comparisonPeriod)).join("");
    element("comparisonDimension").innerHTML = Object.entries(dimensionLabels).map(([value, label]) => option(value, label, value === state.comparison.dimension)).join("");
  }
  function coverageName(value) { return String(value || "NONE").replace(/_/g, " "); }
  function renderComparisonReadiness(result) {
    if (!result) { element("comparisonReadiness").innerHTML = `<p class="empty-state">Select a base month to compare.</p>`; return; }
    const same = result.samePeriod ? " · Same month selected." : "";
    element("comparisonReadiness").innerHTML = `<span class="commercial-status${result.status === "READY" ? " commercial-status-ready" : result.status === "PARTIAL" ? " commercial-status-partial" : ""}">${escape(String(result.status).replace(/_/g, " "))}</span>Base ${escape(periodLabel(result.basePeriod))} vs Comparison ${escape(periodLabel(result.comparisonPeriod))}${escape(same)}<br><span class="scorecard-note">${escape(coverageText("Base Budget Coverage", result.coverage && result.coverage.base, "budget"))} · ${escape(coverageText("Comparison Budget Coverage", result.coverage && result.coverage.comparison, "budget"))} · ${escape(coverageText("Base Potential Coverage", result.coverage && result.coverage.base, "potential"))} · ${escape(coverageText("Comparison Potential Coverage", result.coverage && result.coverage.comparison, "potential"))}</span>`;
  }
  function renderComparisonKpis(result) {
    const row = result && result.rows && result.rows[0];
    const values = row ? [["Base Actual", money(row.base.actualPremium), row.base.actualPremium], ["Comparison Actual", money(row.comparison.actualPremium), row.comparison.actualPremium], ["Actual Change", signedMoney(row.changes.actualChange), row.changes.actualChange], ["Actual Growth / Degrowth", growth(row.changes.actualChangePct), row.changes.actualChangePct], ["Base Budget", money(row.base.budget), row.base.budget], ["Comparison Budget", money(row.comparison.budget), row.comparison.budget], ["Achievement Movement", points(row.changes.achievementPointChange), row.changes.achievementPointChange], ["Penetration Movement", points(row.changes.penetrationPointChange), row.changes.penetrationPointChange]] : [];
    element("comparisonKpis").innerHTML = values.map(([label, value, raw]) => `<div class="card"><div>${escape(label)}</div><div class="value ${semanticClass(raw)}">${escape(value)}</div></div>`).join("");
  }
  function presenceLabel(value) { return String(value || "").replace(/_/g, " "); }
  function renderComparisonTable(result) {
    if (!result || !result.rows.length) { element("comparisonTable").innerHTML = `<p class="empty-state">No comparison rows are available.</p>`; return; }
    const rows = result.rows.map((row) => `<tr data-dimension-key="${escape(row.key)}"><td>${escape(row.label)}${row.labelChanged ? `<span class="scorecard-note"> · Name changed</span>` : ""}</td><td>${escape(money(row.base.actualPremium))}</td><td>${escape(money(row.comparison.actualPremium))}</td><td class="${semanticClass(row.changes.actualChange)}">${escape(signedMoney(row.changes.actualChange))}</td><td>${escape(growth(row.changes.actualChangePct))}</td><td>${escape(money(row.base.budget))}</td><td>${escape(money(row.comparison.budget))}</td><td>${escape(points(row.changes.achievementPointChange))}</td><td>${escape(points(row.changes.penetrationPointChange))}</td><td class="commercial-presence">${escape(presenceLabel(row.presenceStatus))}</td></tr>`).join("");
    element("comparisonTable").innerHTML = `<table><thead><tr><th>${escape(dimensionLabels[state.comparison.dimension])}</th><th>Base Actual</th><th>Comparison Actual</th><th>Change</th><th>Growth / Degrowth</th><th>Base Budget</th><th>Comparison Budget</th><th>Achievement Δ</th><th>Penetration Δ</th><th>Presence</th></tr></thead><tbody>${rows}</tbody></table>`;
  }
  function syncDailyEntity(result) {
    const entities = result && result.entities || [];
    if (!entities.some((item) => item.key === state.comparison.selectedEntityKey)) {
      const preferred = entities.find((item) => item.presenceStatus === "BOTH") || entities[0] || null;
      state.comparison.selectedEntityKey = preferred && preferred.key || null;
    }
  }
  function renderDaily(result) {
    lastDailyResult = result || lastDailyResult;
    const active = lastDailyResult;
    const entities = active && active.entities || [];
    syncDailyEntity(active);
    const isOverall = state.comparison.dimension === "OVERALL";
    element("dailyEntityControl").hidden = isOverall;
    element("dailyEntity").innerHTML = entities.map((item) => option(item.key, `${item.label} (${presenceLabel(item.presenceStatus)})`, item.key === state.comparison.selectedEntityKey)).join("");
    element("dailyViewMode").value = state.comparison.dailyViewMode;
    const organisationDimensions = ["ASSIGNED_RM", "CSM", "ASM", "ZSM", "NATIONAL_HEAD"];
    element("dailyStatus").textContent = `Daily status: ${String(active && active.status || "NO DATA").replace(/_/g, " ")}`;
    element("dailySnapshotCue").textContent = organisationDimensions.includes(state.comparison.dimension) ? "Organisation comparison uses the current active assignment and hierarchy snapshot." : "";
    const entity = entities.find((item) => item.key === state.comparison.selectedEntityKey) || entities[0];
    if (!entity) { element("dailyMovementTable").innerHTML = `<p class="empty-state">No daily movement entities are available.</p>`; return; }
    const cumulative = state.comparison.dailyViewMode === "CUMULATIVE";
    const rows = entity.days.map((item) => {
      const movement = cumulative ? item.cumulative : item.daily;
      const baseValue = cumulative ? item.base.cumulativeActual : item.base.dailyActual;
      const comparisonValue = cumulative ? item.comparison.cumulativeActual : item.comparison.dailyActual;
      const direction = movement.direction === "NOT_COMPARABLE" ? "Not comparable" : movement.direction;
      return `<tr><td>${item.day}</td><td class="${semanticClass(baseValue)}">${escape(money(baseValue))}</td><td class="${semanticClass(comparisonValue)}">${escape(money(comparisonValue))}</td><td class="${semanticClass(movement.change)}">${escape(signedMoney(movement.change))}</td><td>${escape(growth(movement.changePct))}</td><td>${escape(direction)}</td></tr>`;
    }).join("");
    const measure = cumulative ? "Cumulative" : "Daily";
    element("dailyMovementTable").innerHTML = `<table><thead><tr><th>Day</th><th>Base ${measure} Actual</th><th>Comparison ${measure} Actual</th><th>Change</th><th>Growth / Degrowth</th><th>Direction</th></tr></thead><tbody>${rows}</tbody></table>`;
  }
  function renderComparison(periodContext, performance, authorityContext) {
    if (!global.BancaTrackerCommercialComparison || !global.BancaTrackerDailyCommercialComparison) return null;
    syncComparisonState(periodContext); renderComparisonControls(periodContext);
    if (!state.comparison.basePeriod || !state.comparison.comparisonPeriod) { renderComparisonReadiness(null); element("comparisonKpis").innerHTML = ""; element("comparisonTable").innerHTML = `<p class="empty-state">Select a base month to compare.</p>`; lastDailyResult = null; renderDaily({ entities: [] }); return null; }
    const common = { performanceResult: performance, periodContext, basePeriod: state.comparison.basePeriod, comparisonPeriod: state.comparison.comparisonPeriod, authorityContext };
    const overall = global.BancaTrackerCommercialComparison.buildComparison({ ...common, dimension: "OVERALL" });
    const table = global.BancaTrackerCommercialComparison.buildComparison({ ...common, dimension: state.comparison.dimension });
    const daily = global.BancaTrackerDailyCommercialComparison.buildComparison({ ...common, facts: global.BancaTrackerCore.state.factData || [], dimension: state.comparison.dimension });
    renderComparisonReadiness(table); renderComparisonKpis(overall); renderComparisonTable(table); renderDaily(daily);
    return { overall, table, daily };
  }

  function render() {
    const performance = global.BancaTrackerCore && global.BancaTrackerCore.state.commercialPerformance;
    const rollups = global.BancaTrackerCommercialRollups;
    const periodContext = rollups.buildPeriodContext(performance);
    syncState(periodContext);
    if (!periodContext.availablePeriods.length) {
      empty(performance && performance.status === "NO_COMMERCIAL_MASTER" ? "Branch Budget & Potential data has not been activated." : "No commercial periods are available.", periodContext);
      if (global.BancaTrackerCommercialComparison && global.BancaTrackerDailyCommercialComparison) {
        syncComparisonState(periodContext); renderComparisonControls(periodContext); renderComparisonReadiness(null);
        element("comparisonKpis").innerHTML = ""; element("comparisonTable").innerHTML = `<p class="empty-state">No commercial periods are available.</p>`; renderDaily({ entities: [] });
      }
      return null;
    }
    renderControls(periodContext);
    const authorityContext = global.BancaTrackerLiveGeographyAuthority && global.BancaTrackerLiveGeographyAuthority.getCachedContext();
    const scope = scopeRequest();
    const overall = rollups.buildRollup(performance, scope, "OVERALL", authorityContext);
    const table = rollups.buildRollup(performance, scope, state.dimension, authorityContext);
    renderReadiness(overall, periodContext); renderKpis(overall.summary); renderTable(table);
    const comparison = renderComparison(periodContext, performance, authorityContext);
    return { periodContext, overall, table, comparison };
  }
  function handleScopeChange(value) { state.scopeType = value || element("commercialScope").value; return render(); }
  function handlePeriodChange(value) { state.selectedPeriod = value || element("commercialPeriod").value; state.selectedFinancialYear = global.BancaTrackerCommercialRollups.getFinancialYear(state.selectedPeriod); return render(); }
  function handleFinancialYearChange(value) { state.selectedFinancialYear = value || element("commercialFinancialYear").value; return render(); }
  function handleDimensionChange(value) { state.dimension = value || element("commercialDimension").value; return render(); }
  function handleComparisonPeriodChange(role, value) { state.comparison[role] = value || null; return render(); }
  function handleComparisonDimensionChange(value) { state.comparison.dimension = value || element("comparisonDimension").value; state.comparison.selectedEntityKey = null; return render(); }
  function handleDailyEntityChange(value) { state.comparison.selectedEntityKey = value || element("dailyEntity").value; renderDaily(lastDailyResult); return lastDailyResult; }
  function handleDailyViewChange(value) { state.comparison.dailyViewMode = value || element("dailyViewMode").value; renderDaily(lastDailyResult); return lastDailyResult; }
  function init() {
    if (initialized) return;
    element("commercialScope").addEventListener("change", function () { handleScopeChange(this.value); });
    element("commercialPeriod").addEventListener("change", function () { handlePeriodChange(this.value); });
    element("commercialFinancialYear").addEventListener("change", function () { handleFinancialYearChange(this.value); });
    element("commercialDimension").addEventListener("change", function () { handleDimensionChange(this.value); });
    element("comparisonBasePeriod").addEventListener("change", function () { handleComparisonPeriodChange("basePeriod", this.value); });
    element("comparisonPeriod").addEventListener("change", function () { handleComparisonPeriodChange("comparisonPeriod", this.value); });
    element("comparisonDimension").addEventListener("change", function () { handleComparisonDimensionChange(this.value); });
    element("dailyEntity").addEventListener("change", function () { handleDailyEntityChange(this.value); });
    element("dailyViewMode").addEventListener("change", function () { handleDailyViewChange(this.value); });
    initialized = true;
  }
  init();
  global.BancaTrackerCommercialPerformanceUI = Object.freeze({ state, init, render, renderControls, renderKpis, renderTable, renderReadiness, renderComparison, renderComparisonKpis, renderComparisonTable, renderDaily, handleScopeChange, handlePeriodChange, handleFinancialYearChange, handleDimensionChange, handleComparisonPeriodChange, handleComparisonDimensionChange, handleDailyEntityChange, handleDailyViewChange, money, percent, signedMoney, points, growth });
})(window);
