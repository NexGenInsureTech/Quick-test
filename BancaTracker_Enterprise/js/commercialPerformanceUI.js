/*==============================================================
BancaTracker Enterprise
Version : 8.2.0
File    : commercialPerformanceUI.js
Module  : Commercial Performance UI
Purpose : Render cached governed commercial roll-ups without owning formulas
==============================================================*/

(function (global) {
  "use strict";

  const state = { scopeType: "MONTH", selectedPeriod: null, selectedFinancialYear: null, dimension: "BANK", comparison: { basePeriod: null, comparisonPeriod: null, dimension: "BANK", selectedEntityKey: null, dailyViewMode: "CUMULATIVE", paceThroughDay: null, paceEntityKey: null }, maturity: { periods: [], dimension: "OVERALL", entityKey: null, transitionIndex: 0, movementFilter: "ALL" }, execution: { selectedPeriod: null, asOfDay: null, asOfExplicit: false, dimension: "BANK", attentionFilter: "ALL", priorityView: "NONE", drilldown: { parentDimension: null, parentKey: null, parentLabel: null, childDimension: null }, driverAnalysis: { parentDimension: null, parentKey: null, parentLabel: null, mode: "EXECUTION_SNAPSHOT", driverDimension: "LOB" } } };
  const dimensionLabels = Object.freeze({ OVERALL: "Overall", BANK: "Bank", BRANCH: "Branch", STATE: "State", ZONE: "Zone", BANK_REGION: "Bank Region", BANK_ZONE: "Bank Zone", FGM_OFFICE: "FGM Office", ASSIGNED_RM: "Assigned RM", CSM: "CSM", ASM: "ASM", ZSM: "ZSM", NATIONAL_HEAD: "National Head" });
  let initialized = false;
  let lastDailyResult = null;
  let lastPaceResult = null;
  let lastMaturityResult = null;
  let lastExecutionResult = null;
  let lastExecutionStatus = null;
  let lastExecutionPriority = null;
  let lastExecutionContext = null;
  let lastExecutionDrilldown = null;
  let lastDriverAnalysis = null;

  const element = (id) => document.getElementById(id);
  const escape = (value) => global.BancaTrackerUtils.escapeHtml(value);
  function ensureMaturityMarkup() {
    const page = element("commercialPage");
    if (!page || element("maturityHeading") || typeof page.insertAdjacentHTML !== "function") return;
    page.insertAdjacentHTML("beforeend", `<section class="commercial-maturity-section" aria-labelledby="maturityHeading"><div class="panel"><h2 id="maturityHeading">Branch Maturity Comparison</h2><div class="commercial-controls" aria-label="Branch maturity comparison controls"><label for="maturityPeriodOne">Month 1<select id="maturityPeriodOne"></select></label><label for="maturityPeriodTwo">Month 2<select id="maturityPeriodTwo"></select></label><label id="maturityPeriodThreeControl" for="maturityPeriodThree" hidden>Month 3<select id="maturityPeriodThree"></select></label><button id="maturityAddMonth" type="button">Add Month</button><button id="maturityRemoveMonth" type="button" hidden>Remove Month</button><label for="maturityDimension">Dimension<select id="maturityDimension"></select></label><label id="maturityEntityControl" for="maturityEntity" hidden>Entity<select id="maturityEntity"></select></label><label id="maturityTransitionControl" for="maturityTransition" hidden>Transition<select id="maturityTransition"></select></label><label for="maturityMovementFilter">Movement Filter<select id="maturityMovementFilter"><option value="ALL">All</option><option value="UPGRADED">Upgraded</option><option value="DOWNGRADED">Downgraded</option><option value="UNCHANGED">Unchanged</option><option value="NOT_COMPARABLE">Not Comparable</option></select></label></div><div id="maturityReadiness" class="commercial-comparison-readiness" aria-live="polite"></div><p id="maturityDiagnostic" class="scorecard-note"></p></div><div class="panel commercial-table-wrap"><h3>Maturity Distribution</h3><div id="maturityDistribution"></div></div><section id="maturityPrimaryKpis" class="cards" aria-label="Primary branch maturity movements"></section><div id="maturitySecondaryKpis" class="commercial-maturity-supporting" aria-live="polite"></div><div class="panel commercial-table-wrap"><h3 id="maturityMovementHeading">Branch Movement</h3><p id="maturityRowCount" class="table-limit-note"></p><div id="maturityMovementTable"></div></div></section>`);
  }
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
  function paceStatusLabel(status) {
    return ({ READY: "Ready", PARTIAL: "Partial data — some dated records were excluded", INVALID_PERIOD: "Choose two available months", SAME_PERIOD: "Same month selected", NO_VALID_DATED_FACTS: "No valid dated transactions are available for both months", INVALID_THROUGH_DAY: "Choose a day within the shared observed horizon", NO_PERIODS: "No comparison months are available" })[status] || "Comparison unavailable";
  }
  function syncPaceEntity(result) {
    const entities = result && result.entities || [];
    if (!entities.some((item) => item.key === state.comparison.paceEntityKey)) state.comparison.paceEntityKey = (entities[0] && entities[0].key) || null;
  }
  function paceEntity(result) {
    const entities = result && result.entities || [];
    return entities.find((item) => item.key === state.comparison.paceEntityKey) || entities[0] || null;
  }
  function renderPaceControls(result) {
    const overall = state.comparison.dimension === "OVERALL";
    element("paceEntityControl").hidden = overall;
    const entities = result && result.entities || [];
    element("paceEntity").innerHTML = entities.map((item) => option(item.key, item.label, item.key === state.comparison.paceEntityKey)).join("");
    const maximum = result && result.effectiveThroughDay;
    element("paceThroughDay").innerHTML = maximum ? Array.from({ length: maximum }, (_, index) => option(String(index + 1), `Day ${index + 1}`, index + 1 === state.comparison.paceThroughDay)).join("") : "";
    element("paceThroughDay").disabled = !maximum;
  }
  function renderPaceReadiness(result) {
    const status = result && result.status;
    const ready = status === "READY" || status === "PARTIAL" || status === "SAME_PERIOD";
    const statusClass = status === "READY" ? " commercial-status-ready" : status === "PARTIAL" ? " commercial-status-partial" : "";
    element("paceReadiness").innerHTML = `<span class="commercial-status${statusClass}">${escape(paceStatusLabel(status))}</span>${ready && result.effectiveThroughDay ? `Compared through observed Day ${escape(result.effectiveThroughDay)}` : ""}`;
    element("paceObservationNote").textContent = ready && result.effectiveThroughDay ? `Day ${result.effectiveThroughDay} is the shared valid transaction horizon; it does not confirm complete source availability.` : "";
  }
  function renderPaceKpis(entity) {
    const summary = entity && entity.summary;
    const values = summary ? [["Base Through-Day Actual", money(summary.baseThroughDayActual), summary.baseThroughDayActual], ["Comparison Through-Day Actual", money(summary.comparisonThroughDayActual), summary.comparisonThroughDayActual], ["Absolute Gap", signedMoney(summary.absoluteGap), summary.absoluteGap], ["Growth / Degrowth", summary.growthPct === null ? "N/A" : growth(summary.growthPct), summary.growthPct], ["Compared Through Day", `Day ${summary.throughDay}`, summary.throughDay]] : [];
    element("paceKpis").innerHTML = values.map(([label, value, raw]) => `<div class="card"><div>${escape(label)}</div><div class="value ${semanticClass(raw)}">${escape(value)}</div></div>`).join("");
  }
  function renderPaceChart(entity, result) {
    if (!entity || !entity.days || !entity.days.length) { element("paceChart").innerHTML = `<p class="empty-state">No cumulative pace series is available.</p>`; return; }
    const values = entity.days.flatMap((item) => [item.baseCumulativeActual, item.comparisonCumulativeActual]).filter(Number.isFinite);
    if (!values.length) { element("paceChart").innerHTML = `<p class="empty-state">No cumulative pace series is available.</p>`; return; }
    const min = Math.min(0, ...values); const max = Math.max(0, ...values); const range = max - min || 1;
    const width = 640; const height = 240; const left = 52; const right = 18; const top = 24; const bottom = 34;
    const x = (index) => entity.days.length === 1 ? (left + width - right) / 2 : left + index * (width - left - right) / (entity.days.length - 1);
    const y = (value) => top + (max - value) * (height - top - bottom) / range;
    const pathFor = (field) => entity.days.map((item, index) => `${index ? "L" : "M"}${x(index).toFixed(2)},${y(item[field]).toFixed(2)}`).join(" ");
    const zeroY = y(0).toFixed(2);
    element("paceChart").innerHTML = `<div class="commercial-pace-legend"><span class="commercial-pace-base">Base ${escape(periodLabel(result.basePeriod))}</span><span class="commercial-pace-comparison">Comparison ${escape(periodLabel(result.comparisonPeriod))}</span></div><svg viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="paceChartTitle"><title id="paceChartTitle">Cumulative Actual through Day ${escape(result.effectiveThroughDay)} for ${escape(entity.label)}</title><line x1="${left}" y1="${zeroY}" x2="${width - right}" y2="${zeroY}" stroke="#94a3b8"/><path d="${pathFor("baseCumulativeActual")}" fill="none" stroke="#17375e" stroke-width="3"/><path d="${pathFor("comparisonCumulativeActual")}" fill="none" stroke="#795600" stroke-width="3"/><text x="${left}" y="${height - 10}" fill="#334155">Day 1</text><text x="${width - right - 40}" y="${height - 10}" fill="#334155">Day ${escape(result.effectiveThroughDay)}</text></svg>`;
  }
  function renderPaceTable(entity) {
    if (!entity || !entity.days || !entity.days.length) { element("paceTable").innerHTML = `<p class="empty-state">No equivalent day detail is available.</p>`; return; }
    const rows = entity.days.map((item) => `<tr><td>${escape(item.day)}</td><td class="${semanticClass(item.baseDailyActual)}">${escape(money(item.baseDailyActual))}</td><td class="${semanticClass(item.comparisonDailyActual)}">${escape(money(item.comparisonDailyActual))}</td><td class="${semanticClass(item.dailyAbsoluteChange)}">${escape(signedMoney(item.dailyAbsoluteChange))}</td><td class="${semanticClass(item.baseCumulativeActual)}">${escape(money(item.baseCumulativeActual))}</td><td class="${semanticClass(item.comparisonCumulativeActual)}">${escape(money(item.comparisonCumulativeActual))}</td><td class="${semanticClass(item.cumulativeAbsoluteChange)}">${escape(signedMoney(item.cumulativeAbsoluteChange))}</td><td>${escape(item.cumulativeGrowthPct === null ? "N/A" : growth(item.cumulativeGrowthPct))}</td></tr>`).join("");
    element("paceTable").innerHTML = `<table><thead><tr><th>Day</th><th>Base Daily</th><th>Comparison Daily</th><th>Daily Change</th><th>Base Cumulative</th><th>Comparison Cumulative</th><th>Cumulative Gap</th><th>Cumulative Growth</th></tr></thead><tbody>${rows}</tbody></table>`;
  }
  function renderPace(periodContext, performance, authorityContext) {
    if (!global.BancaTrackerEquivalentElapsedDayComparison || !state.comparison.basePeriod || !state.comparison.comparisonPeriod) return null;
    const common = { facts: global.BancaTrackerCore.state.factData || [], performanceResult: performance, periodContext, basePeriod: state.comparison.basePeriod, comparisonPeriod: state.comparison.comparisonPeriod, dimension: state.comparison.dimension, authorityContext, throughDay: state.comparison.paceThroughDay };
    let result = global.BancaTrackerEquivalentElapsedDayComparison.buildComparison(common);
    if (result.status === "INVALID_THROUGH_DAY" && state.comparison.paceThroughDay !== null) { state.comparison.paceThroughDay = null; result = global.BancaTrackerEquivalentElapsedDayComparison.buildComparison({ ...common, throughDay: null }); }
    if (result.effectiveThroughDay && state.comparison.paceThroughDay === null) state.comparison.paceThroughDay = result.effectiveThroughDay;
    syncPaceEntity(result); renderPaceControls(result); renderPaceReadiness(result);
    const entity = paceEntity(result); renderPaceKpis(entity); renderPaceChart(entity, result); renderPaceTable(entity);
    lastPaceResult = result;
    return result;
  }
  const MATURITY_LIMIT = 100;
  function maturityStatusLabel(status) { return ({ READY: "Ready", PARTIAL: "Partial data", NO_PERIODS: "No comparison months are available", INVALID_PERIOD_SELECTION: "Choose two or three unique months in chronological order", INVALID_DIMENSION: "Choose a supported governed dimension" })[status] || "Comparison unavailable"; }
  function syncMaturityPeriods(periodContext) { const available = periodContext.availablePeriods; if (state.maturity.periods.length < 2 || state.maturity.periods.some((period) => !available.includes(period))) state.maturity.periods = available.slice(-2); }
  function renderMaturityControls(periodContext, result) {
    const periods = state.maturity.periods; const available = periodContext.availablePeriods;
    ["maturityPeriodOne", "maturityPeriodTwo", "maturityPeriodThree"].forEach((id, index) => { element(id).innerHTML = available.map((value) => option(value, periodLabel(value), value === periods[index])).join(""); });
    const third = periods.length === 3; element("maturityPeriodThreeControl").hidden = !third; element("maturityAddMonth").hidden = third; element("maturityRemoveMonth").hidden = !third;
    element("maturityDimension").innerHTML = Object.entries(dimensionLabels).map(([value, label]) => option(value, label, value === state.maturity.dimension)).join("");
    const entities = result && result.entities || []; if (!entities.some((item) => item.key === state.maturity.entityKey)) state.maturity.entityKey = entities[0] && entities[0].key || null;
    element("maturityEntityControl").hidden = state.maturity.dimension === "OVERALL"; element("maturityEntity").innerHTML = entities.map((item) => option(item.key, item.label, item.key === state.maturity.entityKey)).join("");
    const transitions = selectedMaturityEntity(result) && selectedMaturityEntity(result).transitions || []; if (state.maturity.transitionIndex >= transitions.length) state.maturity.transitionIndex = 0;
    element("maturityTransitionControl").hidden = transitions.length < 2; element("maturityTransition").innerHTML = transitions.map((item, index) => option(String(index), `${periodLabel(item.baseMonth)} → ${periodLabel(item.comparisonMonth)}`, index === state.maturity.transitionIndex)).join("");
    element("maturityMovementFilter").value = state.maturity.movementFilter;
  }
  function selectedMaturityEntity(result) { const entities = result && result.entities || []; return entities.find((item) => item.key === state.maturity.entityKey) || entities[0] || null; }
  function renderMaturityReadiness(result) { element("maturityReadiness").innerHTML = `<span class="commercial-status${result && result.status === "READY" ? " commercial-status-ready" : result && result.status === "PARTIAL" ? " commercial-status-partial" : ""}">${escape(maturityStatusLabel(result && result.status))}</span>`; const missing = result && result.diagnostics && result.diagnostics.missingBranchIdentityCount; element("maturityDiagnostic").textContent = missing ? "Some branch records could not be included in movement because a durable branch identity was unavailable." : ""; }
  function renderMaturityDistribution(entity) { const distributions = entity && entity.monthlyDistributions || []; if (!distributions.length) { element("maturityDistribution").innerHTML = `<p class="empty-state">No maturity distribution is available.</p>`; return; } const rows = distributions[0].bands.map((band, index) => `<tr><td>${escape(band.band)}</td>${distributions.map((distribution) => `<td>${escape(distribution.bands[index].branchCount)}</td><td>${escape(percent(distribution.bands[index].percentageOfPopulation))}</td>`).join("")}</tr>`).join(""); const headers = distributions.map((distribution) => `<th>${escape(periodLabel(distribution.periodKey))} Branches</th><th>${escape(periodLabel(distribution.periodKey))} %</th>`).join(""); element("maturityDistribution").innerHTML = `<table><thead><tr><th>Band</th>${headers}</tr></thead><tbody>${rows}</tbody></table>`; }
  function renderMaturityMovement(entity) { const transition = entity && entity.transitions && entity.transitions[state.maturity.transitionIndex]; if (!transition) { element("maturityPrimaryKpis").innerHTML = ""; element("maturitySecondaryKpis").innerHTML = ""; element("maturityMovementTable").innerHTML = `<p class="empty-state">No adjacent movement is available.</p>`; return; } const summary = transition.summary; element("maturityMovementHeading").textContent = `Branch Movement: ${periodLabel(transition.baseMonth)} → ${periodLabel(transition.comparisonMonth)}`; element("maturityPrimaryKpis").innerHTML = [["Upgraded", summary.upgradedCount], ["Unchanged", summary.unchangedCount], ["Downgraded", summary.downgradedCount]].map(([label, value]) => `<div class="card"><div>${label}</div><div class="value">${escape(value)}</div></div>`).join(""); element("maturitySecondaryKpis").innerHTML = `<span class="commercial-status-chip">Zero → Active: ${escape(summary.zeroToActiveCount)} (subset of Upgraded)</span><span class="commercial-status-chip">Active → Zero: ${escape(summary.activeToZeroCount)} (subset of Downgraded)</span><span class="commercial-status-chip">Not Comparable: ${escape(summary.nonComparableCount)}</span>`;
    const complete = transition.rows; const filtered = state.maturity.movementFilter === "ALL" ? complete : complete.filter((row) => row.movement === state.maturity.movementFilter); const visible = filtered.slice(0, MATURITY_LIMIT); element("maturityRowCount").textContent = filtered.length > MATURITY_LIMIT ? `Showing ${MATURITY_LIMIT} of ${filtered.length} branches` : `${filtered.length} branches`;
    const rows = visible.map((row) => `<tr data-branch-id="${escape(row.branchId)}"><td>${escape(row.branchName || row.branchId)}</td><td>${escape(row.canonicalBank || "—")}</td><td>${escape(row.stateName || "—")}</td><td>${escape(row.zoneName || "—")}</td><td>${escape(row.basePremium === null ? "N/A" : money(row.basePremium))}</td><td>${escape(row.baseBand || "—")}</td><td>${escape(row.comparisonPremium === null ? "N/A" : money(row.comparisonPremium))}</td><td>${escape(row.comparisonBand || "—")}</td><td>${escape(String(row.movement).replace(/_/g, " "))}</td><td>${escape(row.specialMovement ? row.specialMovement.replace(/_/g, " → ") : "—")}</td><td>${escape(String(row.presenceStatus).replace(/_/g, " "))}</td></tr>`).join(""); element("maturityMovementTable").innerHTML = `<table><thead><tr><th>Branch</th><th>Bank</th><th>State</th><th>Zone</th><th>${escape(periodLabel(transition.baseMonth))} Premium</th><th>${escape(periodLabel(transition.baseMonth))} Band</th><th>${escape(periodLabel(transition.comparisonMonth))} Premium</th><th>${escape(periodLabel(transition.comparisonMonth))} Band</th><th>Movement</th><th>Special Movement</th><th>Presence</th></tr></thead><tbody>${rows}</tbody></table>`;
  }
  function renderMaturity(periodContext, performance, authorityContext) { if (!global.BancaTrackerBranchMaturityComparison) return null; syncMaturityPeriods(periodContext); const result = global.BancaTrackerBranchMaturityComparison.buildComparison({ performanceResult: performance, periodContext, selectedPeriods: state.maturity.periods, dimension: state.maturity.dimension, authorityContext }); renderMaturityControls(periodContext, result); renderMaturityReadiness(result); const entity = selectedMaturityEntity(result); renderMaturityDistribution(entity); renderMaturityMovement(entity); lastMaturityResult = result; return result; }
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

  function defaultExecutionPeriod(periodContext) { return periodContext.latestActualPeriod || periodContext.latestAvailablePeriod || null; }
  function resolveExecutionState(periodContext, forceDefaultAsOf = false) {
    const execution = state.execution;
    if (!periodContext.availablePeriods.includes(execution.selectedPeriod)) {
      execution.selectedPeriod = defaultExecutionPeriod(periodContext);
      execution.asOfExplicit = false;
      forceDefaultAsOf = true;
    }
    if (!execution.selectedPeriod) { execution.asOfDay = null; return; }
    const daysInMonth = global.BancaTrackerCommercialExecution.getDaysInPeriod(execution.selectedPeriod);
    const invalid = !Number.isInteger(execution.asOfDay) || execution.asOfDay < 0 || execution.asOfDay > daysInMonth;
    if (forceDefaultAsOf || !execution.asOfExplicit || invalid) {
      const resolved = global.BancaTrackerCommercialExecution.resolveAsOfDay(global.BancaTrackerCore.state.factData || [], execution.selectedPeriod);
      execution.asOfDay = resolved.valid ? resolved.asOfDay : 0;
      execution.asOfExplicit = false;
    }
  }
  function renderExecutionControls(periodContext) {
    const execution = state.execution;
    element("executionPeriod").innerHTML = periodContext.availablePeriods.map((value) => option(value, periodLabel(value), value === execution.selectedPeriod)).join("");
    const daysInMonth = execution.selectedPeriod ? global.BancaTrackerCommercialExecution.getDaysInPeriod(execution.selectedPeriod) : 0;
    element("executionAsOfDay").innerHTML = Array.from({ length: daysInMonth + 1 }, (_, day) => option(String(day), day === 0 ? "No observations" : `Day ${day}`, day === execution.asOfDay)).join("");
    element("executionDimension").innerHTML = Object.entries(dimensionLabels).map(([value, label]) => option(value, label, value === execution.dimension)).join("");
    element("executionAttentionFilter").value = execution.attentionFilter;
    element("executionPriorityView").value = execution.priorityView;
  }
  function renderExecutionReadiness(result) {
    if (!result) { element("executionReadiness").innerHTML = `<p class="empty-state">No commercial periods are available.</p>`; return; }
    const statusClass = result.status === "READY" ? " commercial-status-ready" : result.status === "PARTIAL" ? " commercial-status-partial" : "";
    const coverage = result.coverage || {};
    element("executionReadiness").innerHTML = `<span class="commercial-status${statusClass}">${escape(String(result.status).replace(/_/g, " "))}</span>${escape(periodLabel(result.selectedPeriod))} · As of Day ${result.asOfDay} · ${result.observedDays} observed days · ${result.remainingDays} remaining calendar days<br><span class="scorecard-note">Budget Coverage: ${coverage.budgetPresentCount || 0} present / ${coverage.budgetMissingCount || 0} missing</span>`;
    element("executionObservationNote").textContent = result.asOfDay === 0 ? "No Actual observations in this period yet. As-of Day controls the execution cutoff; transactions after that day are excluded from pacing calculations." : "As-of Day controls the execution cutoff. Transactions after that day are excluded from pacing calculations.";
    const organisationDimensions = ["ASSIGNED_RM", "CSM", "ASM", "ZSM", "NATIONAL_HEAD"];
    element("executionSnapshotCue").textContent = organisationDimensions.includes(state.execution.dimension) ? "Historical execution attribution uses the current active hierarchy snapshot." : "";
  }
  function renderExecutionKpis(result) {
    const row = result && result.rows && result.rows[0];
    const values = row ? [["Actual to Date", money(row.actualToDate), row.actualToDate], ["Monthly Budget", money(row.budget), row.budget], ["Budget Achievement to Date", percent(row.budgetAchievementToDatePct), row.budgetAchievementToDatePct], ["Expected Budget to Date (Calendar-linear)", money(row.expectedBudgetToDate), row.expectedBudgetToDate], ["Pace Gap", signedMoney(row.paceGap), row.paceGap], ["Average Daily Actual", money(row.averageDailyActual), row.averageDailyActual], ["Required Daily Run-rate", money(row.requiredDailyRunRate), row.requiredDailyRunRate], ["Projected Month-end Actual", money(row.projectedMonthEndActual), row.projectedMonthEndActual], ["Projected Achievement", percent(row.projectedAchievementPct), row.projectedAchievementPct], ["Projected Budget Gap", signedMoney(row.projectedBudgetGap), row.projectedBudgetGap]] : [];
    element("executionKpis").innerHTML = values.map(([label, value, raw]) => `<div class="card"><div>${escape(label)}</div><div class="value ${semanticClass(raw)}">${escape(value)}</div></div>`).join("");
  }
  function statusLabel(code) { return global.BancaTrackerCommercialExecutionStatus.getStatusLabel(code); }
  function statusChip(code) { return `<span class="commercial-status-chip">${escape(statusLabel(code))}</span>`; }
  function attentionCell(row) {
    const labels = [];
    if (row.executionAttention) labels.push(`<span class="commercial-attention-chip">Execution attention</span>`);
    if (row.referenceAttention) labels.push(`<span class="commercial-attention-chip">Reference attention</span>`);
    return labels.length ? `<div class="commercial-execution-status">${labels.join("")}</div>` : "â€”";
  }
  function reasonCell(row) {
    return row.attentionReasons.length ? `<div class="commercial-reason-list">${row.attentionReasons.map(statusChip).join("")}</div>` : "â€”";
  }
  function filterExecutionRows(rows) {
    if (state.execution.attentionFilter === "EXECUTION_ATTENTION") return rows.filter((row) => row.executionAttention);
    if (state.execution.attentionFilter === "REFERENCE_ATTENTION") return rows.filter((row) => row.referenceAttention);
    if (state.execution.attentionFilter === "NO_ATTENTION") return rows.filter((row) => !row.executionAttention && !row.referenceAttention);
    return rows;
  }
  function renderExecutionStatusSummary(overallStatus, tableStatus) {
    if (!overallStatus || !tableStatus) { element("executionAttentionSummary").innerHTML = ""; return; }
    if (!overallStatus.rows.length) { element("executionAttentionSummary").innerHTML = `<span class="commercial-status-chip">${escape(String(overallStatus.status).replace(/_/g, " "))}</span>`; return; }
    const overall = overallStatus.rows[0];
    const summary = tableStatus.summary;
    element("executionAttentionSummary").innerHTML = `${statusChip(overall.budgetPositionStatus)}${statusChip(overall.paceStatus)}${statusChip(overall.projectionStatus)}<span class="commercial-attention-chip">Execution Attention: ${summary.executionAttentionCount}</span><span class="commercial-attention-chip">Reference Attention: ${summary.referenceAttentionCount}</span><span class="commercial-status-chip">Observed Rows: ${summary.rowsWithObservations}</span><span class="commercial-status-chip">Projected Shortfall Rows: ${summary.projectedShortfallCount}</span><span class="commercial-status-chip">Budget Achieved / Exceeded: ${summary.budgetAchievedCount + summary.budgetExceededCount}</span>`;
  }
  function renderExecutionTable(result, statusResult = lastExecutionStatus) {
    if (statusResult) {
      if (!statusResult.rows.length) { element("executionTable").innerHTML = `<p class="empty-state">No execution status rows are available (${escape(String(statusResult.status).replace(/_/g, " "))}).</p>`; return; }
      const visible = filterExecutionRows(statusResult.rows);
      if (!visible.length) { element("executionTable").innerHTML = `<p class="empty-state">No rows match the selected attention filter.</p>`; return; }
      const rows = visible.map((classified) => { const row = classified.source; const selected = state.execution.drilldown.parentDimension === state.execution.dimension && state.execution.drilldown.parentKey === classified.key; return `<tr data-dimension-key="${escape(classified.key)}"><td><button type="button" class="commercial-drilldown-select${selected ? " is-selected" : ""}" aria-pressed="${selected}" data-parent-key="${escape(classified.key)}" data-parent-label="${escape(classified.label)}">${escape(classified.label)}</button></td><td class="${semanticClass(row.actualToDate)}">${escape(money(row.actualToDate))}</td><td>${escape(money(row.budget))}</td><td>${escape(percent(row.budgetAchievementToDatePct))}</td><td class="${semanticClass(row.paceGap)}">${escape(signedMoney(row.paceGap))}</td><td class="${semanticClass(row.requiredDailyRunRate)}">${escape(money(row.requiredDailyRunRate))}</td><td class="${semanticClass(row.projectedMonthEndActual)}">${escape(money(row.projectedMonthEndActual))}</td><td>${escape(percent(row.projectedAchievementPct))}</td><td>${statusChip(classified.budgetPositionStatus)}</td><td>${statusChip(classified.paceStatus)}</td><td>${statusChip(classified.projectionStatus)}</td><td>${attentionCell(classified)}</td><td>${reasonCell(classified)}</td></tr>`; }).join("");
      element("executionTable").innerHTML = `<p class="scorecard-note commercial-execution-filter-count">Showing ${visible.length} of ${statusResult.rows.length} rows</p><table><thead><tr><th>${escape(dimensionLabels[state.execution.dimension])}</th><th>Actual to Date</th><th>Budget</th><th>Budget Achievement</th><th>Pace Gap</th><th>Required Daily Run-rate</th><th>Projected Month-end</th><th>Projected Achievement</th><th>Budget Position</th><th>Pace Status</th><th>Projection Status</th><th>Attention</th><th>Reasons</th></tr></thead><tbody>${rows}</tbody></table>`;
      return;
    }
    if (!result || !result.rows.length) { element("executionTable").innerHTML = `<p class="empty-state">No execution rows are available.</p>`; return; }
    const rows = result.rows.map((row) => { const selected = state.execution.drilldown.parentDimension === state.execution.dimension && state.execution.drilldown.parentKey === row.key; return `<tr data-dimension-key="${escape(row.key)}"><td><button type="button" class="commercial-drilldown-select${selected ? " is-selected" : ""}" aria-pressed="${selected}" data-parent-key="${escape(row.key)}" data-parent-label="${escape(row.label)}">${escape(row.label)}</button></td><td class="${semanticClass(row.actualToDate)}">${escape(money(row.actualToDate))}</td><td>${escape(money(row.budget))}</td><td>${escape(percent(row.budgetAchievementToDatePct))}</td><td>${escape(money(row.expectedBudgetToDate))}</td><td class="${semanticClass(row.paceGap)}">${escape(signedMoney(row.paceGap))}</td><td class="${semanticClass(row.averageDailyActual)}">${escape(money(row.averageDailyActual))}</td><td class="${semanticClass(row.requiredDailyRunRate)}">${escape(money(row.requiredDailyRunRate))}</td><td class="${semanticClass(row.projectedMonthEndActual)}">${escape(money(row.projectedMonthEndActual))}</td><td>${escape(percent(row.projectedAchievementPct))}</td><td class="${semanticClass(row.projectedBudgetGap)}">${escape(signedMoney(row.projectedBudgetGap))}</td></tr>`; }).join("");
    element("executionTable").innerHTML = `<table><thead><tr><th>${escape(dimensionLabels[state.execution.dimension])}</th><th>Actual to Date</th><th>Budget</th><th>Budget Achievement</th><th>Expected Budget to Date</th><th>Pace Gap</th><th>Average Daily Actual</th><th>Required Daily Run-rate</th><th>Projected Month-end</th><th>Projected Achievement</th><th>Projected Gap</th></tr></thead><tbody>${rows}</tbody></table>`;
  }
  function renderExecutionPriority(priorityResult = lastExecutionPriority) {
    const container = element("executionPriorityTable");
    if (state.execution.priorityView === "NONE") { container.innerHTML = `<p class="commercial-priority-empty">Select an execution or reference priority view.</p>`; return; }
    if (!priorityResult) { container.innerHTML = `<p class="commercial-priority-empty">Prioritisation is not available for the current execution result.</p>`; return; }
    if (!priorityResult.rankingApplicable) { container.innerHTML = `<p class="commercial-priority-empty">Prioritisation is not applicable to the Overall view.</p>`; return; }
    if (state.execution.priorityView === "REFERENCE_PRIORITY") {
      if (!priorityResult.referencePriority.length) { container.innerHTML = `<p class="commercial-priority-empty">No reference-attention entities currently require prioritisation.</p>`; return; }
      const rows = priorityResult.referencePriority.map((row) => `<tr data-priority-key="${escape(row.key)}"><td><span class="commercial-priority-rank">${row.priorityRank}</span></td><td><button type="button" class="commercial-drilldown-select" data-parent-key="${escape(row.key)}" data-parent-label="${escape(row.label)}">${escape(row.label)}</button></td><td>${escape(statusLabel(row.referenceReasonCode))}</td></tr>`).join("");
      container.innerHTML = `<table><thead><tr><th>Rank</th><th>${escape(dimensionLabels[state.execution.dimension])}</th><th>Reference Reason</th></tr></thead><tbody>${rows}</tbody></table>`;
      return;
    }
    if (!priorityResult.executionPriority.length) { container.innerHTML = `<p class="commercial-priority-empty">No entities currently require execution prioritisation.</p>`; return; }
    const rows = priorityResult.executionPriority.map((row) => `<tr data-priority-key="${escape(row.key)}"><td><span class="commercial-priority-rank">${row.priorityRank}</span></td><td><button type="button" class="commercial-drilldown-select" data-parent-key="${escape(row.key)}" data-parent-label="${escape(row.label)}">${escape(row.label)}</button></td><td>${escape(money(row.priorityBasis.projectedShortfallAmount))}</td><td>${escape(money(row.priorityBasis.paceGapMagnitude))}</td><td>${escape(money(row.priorityBasis.budget))}</td><td>${escape(statusLabel(row.sourceStatus.paceStatus))}</td><td>${escape(statusLabel(row.sourceStatus.projectionStatus))}</td><td>Execution attention</td></tr>`).join("");
    container.innerHTML = `<table><thead><tr><th>Rank</th><th>${escape(dimensionLabels[state.execution.dimension])}</th><th>Projected Shortfall</th><th>Pace Gap Magnitude</th><th>Budget</th><th>Pace</th><th>Projection</th><th>Attention</th></tr></thead><tbody>${rows}</tbody></table>`;
  }
  function clearExecutionDrilldown(message = "Select an execution entity to view governed child context.") {
    state.execution.drilldown = { parentDimension: null, parentKey: null, parentLabel: null, childDimension: null };
    lastExecutionDrilldown = null;
    element("executionDrilldownParent").textContent = message;
    element("executionDrilldownControls").hidden = true;
    element("executionDrilldownStatus").textContent = "";
    element("executionDrilldownReconciliation").innerHTML = "";
    element("executionDrilldownTable").innerHTML = "";
  }
  function drilldownStatusMessage(status) {
    const messages = {
      EMPTY: "No governed child entities are available for this breakdown.",
      PARENT_NOT_FOUND: "The selected entity is no longer available in the current execution snapshot.",
      INVALID_DRILLDOWN: "The selected child breakdown is not governed for this parent.",
      INVALID_INPUT: "The drill-down inputs are not compatible with the current execution snapshot.",
    };
    return messages[status] || `Drill-down status: ${String(status || "NOT AVAILABLE").replace(/_/g, " ")}`;
  }
  function renderExecutionDrilldown(result = lastExecutionDrilldown) {
    const selection = state.execution.drilldown;
    if (!selection.parentKey) { clearExecutionDrilldown(); return; }
    const allowed = global.BancaTrackerCommercialExecutionDrilldown.getAllowedDrilldowns(selection.parentDimension);
    element("executionDrilldownParent").textContent = `Selected Parent: ${selection.parentLabel} · ${dimensionLabels[selection.parentDimension] || selection.parentDimension} · ${periodLabel(state.execution.selectedPeriod)} · As of Day ${state.execution.asOfDay}`;
    if (!allowed.length) {
      element("executionDrilldownControls").hidden = true;
      element("executionDrilldownStatus").textContent = selection.parentDimension === "BRANCH" ? "Branch is the terminal commercial execution level." : "No governed child breakdown is available.";
      element("executionDrilldownReconciliation").innerHTML = ""; element("executionDrilldownTable").innerHTML = "";
      return;
    }
    element("executionDrilldownControls").hidden = false;
    element("executionDrilldownChild").innerHTML = allowed.map((value) => option(value, dimensionLabels[value] || value, value === selection.childDimension)).join("");
    if (!result) { element("executionDrilldownStatus").textContent = "Choose a governed child breakdown."; element("executionDrilldownReconciliation").innerHTML = ""; element("executionDrilldownTable").innerHTML = ""; return; }
    element("executionDrilldownStatus").textContent = drilldownStatusMessage(result.status);
    if (["INVALID_INPUT", "INVALID_DRILLDOWN", "PARENT_NOT_FOUND"].includes(result.status)) { element("executionDrilldownReconciliation").innerHTML = ""; element("executionDrilldownTable").innerHTML = ""; return; }
    const actual = result.reconciliation.actual; const budget = result.reconciliation.budget;
    element("executionDrilldownReconciliation").innerHTML = `<div><strong>Actual</strong><span>Parent: ${escape(money(actual.parent))}</span><span>Children: ${escape(money(actual.children))}</span><span>Difference: ${escape(signedMoney(actual.difference))}</span><span>Complete: ${actual.complete ? "Yes" : "No"}</span></div><div><strong>Budget</strong><span>Parent: ${escape(money(budget.parent))}</span><span>Children: ${escape(money(budget.children))}</span><span>Difference: ${escape(signedMoney(budget.difference))}</span><span>Complete: ${budget.complete ? "Yes" : "No"}</span></div>`;
    if (!result.rows.length) { element("executionDrilldownTable").innerHTML = `<p class="commercial-drilldown-empty">${escape(drilldownStatusMessage(result.status))}</p>`; return; }
    const rows = result.rows.map((item) => {
      const execution = item.execution || {}; const attention = item.attention || {}; const priority = item.priority || {};
      const rank = priority.execution && priority.execution.priorityRank !== null && priority.execution.priorityRank !== undefined ? priority.execution.priorityRank : priority.reference && priority.reference.priorityRank !== null && priority.reference.priorityRank !== undefined ? priority.reference.priorityRank : null;
      return `<tr data-child-key="${escape(item.key)}"><td>${escape(item.label)}</td><td>${escape(money(execution.actualToDate))}</td><td>${escape(money(execution.budget))}</td><td>${escape(percent(execution.budgetAchievementToDatePct))}</td><td>${escape(money(execution.expectedBudgetToDate))}</td><td>${escape(signedMoney(execution.paceGap))}</td><td>${escape(money(execution.requiredDailyRunRate))}</td><td>${escape(money(execution.projectedMonthEndActual))}</td><td>${escape(signedMoney(execution.projectedBudgetGap))}</td><td>${attention.executionAttention ? "Yes" : "No"}</td><td>${attention.referenceAttention ? "Yes" : "No"}</td><td>${rank === null ? "N/A" : escape(rank)}</td></tr>`;
    }).join("");
    element("executionDrilldownTable").innerHTML = `<table><thead><tr><th>${escape(dimensionLabels[result.childDimension] || result.childDimension)}</th><th>Actual to Date</th><th>Budget</th><th>Budget Achievement</th><th>Expected Budget to Date</th><th>Pace Gap</th><th>Required Daily Run-rate</th><th>Projected Month-end</th><th>Projected Gap</th><th>Execution Attention</th><th>Reference Attention</th><th>Priority Rank</th></tr></thead><tbody>${rows}</tbody></table>`;
  }
  function clearDriverAnalysis(message = "Select an execution entity to analyse its LOB or Product drivers.") {
    state.execution.driverAnalysis.parentDimension = null; state.execution.driverAnalysis.parentKey = null; state.execution.driverAnalysis.parentLabel = null;
    lastDriverAnalysis = null;
    element("executionDriverParent").textContent = message;
    element("executionDriverStatus").textContent = "";
    element("executionDriverReconciliation").innerHTML = "";
    element("executionDriverTable").innerHTML = "";
  }
  function driverStatusMessage(result) {
    const messages = {
      EMPTY: result && result.mode === "EXECUTION_SNAPSHOT" ? "No driver production is available at this execution cutoff." : "No driver production is available for these comparison months.",
      PARENT_NOT_FOUND: "The selected entity is no longer available in the current governed data.",
      INVALID_INPUT: "Compatible governed parent authority is not available for this analysis.",
      INVALID_PARENT: "The selected entity is not compatible with driver analysis.",
      INVALID_PERIOD: "The selected periods are not compatible with driver analysis.",
    };
    return messages[result && result.status] || `Driver analysis status: ${String(result && result.status || "NOT AVAILABLE").replace(/_/g, " ")}`;
  }
  function renderDriverAnalysisControls() {
    const analysis = state.execution.driverAnalysis;
    const drivers = global.BancaTrackerCommercialDriverAnalysis ? global.BancaTrackerCommercialDriverAnalysis.getSupportedDriverDimensions() : [];
    if (!drivers.includes(analysis.driverDimension)) analysis.driverDimension = drivers[0] || "LOB";
    element("executionDriverMode").value = analysis.mode;
    element("executionDriverDimension").innerHTML = drivers.map((value) => option(value, value === "PRODUCT" ? "Product" : value, value === analysis.driverDimension)).join("");
  }
  function renderDriverAnalysis(result = lastDriverAnalysis) {
    const analysis = state.execution.driverAnalysis;
    renderDriverAnalysisControls();
    if (!analysis.parentKey) { clearDriverAnalysis(); return; }
    const selectionText = `${analysis.parentLabel} · ${dimensionLabels[analysis.parentDimension] || analysis.parentDimension}`;
    element("executionDriverParent").textContent = `Selected Parent: ${selectionText}`;
    if (!result) { element("executionDriverStatus").textContent = "Driver analysis is not available for the current governed context."; element("executionDriverReconciliation").innerHTML = ""; element("executionDriverTable").innerHTML = ""; return; }
    element("executionDriverStatus").textContent = driverStatusMessage(result);
    if (["INVALID_INPUT", "INVALID_PARENT", "INVALID_PERIOD", "PARENT_NOT_FOUND"].includes(result.status)) { element("executionDriverReconciliation").innerHTML = ""; element("executionDriverTable").innerHTML = ""; return; }
    if (result.mode === "EXECUTION_SNAPSHOT") {
      const reconciliation = result.reconciliation;
      element("executionDriverReconciliation").innerHTML = reconciliation ? `<div><strong>Actual</strong><span>Parent: ${escape(money(reconciliation.parentActual))}</span><span>Drivers: ${escape(money(reconciliation.driverActual))}</span><span>Difference: ${escape(signedMoney(reconciliation.difference))}</span></div>` : "";
      if (!result.rows.length) { element("executionDriverTable").innerHTML = `<p class="commercial-driver-empty">${escape(driverStatusMessage(result))}</p>`; return; }
      const rows = result.rows.map((row) => `<tr data-driver-key="${escape(row.key)}"><td>${escape(row.key === "__UNMAPPED__" ? `Unmapped ${result.driverDimension === "PRODUCT" ? "Product" : "LOB"}` : row.label)}</td><td class="${semanticClass(row.actual)}">${escape(money(row.actual))}</td><td>${escape(percent(row.contributionPercent))}</td></tr>`).join("");
      element("executionDriverTable").innerHTML = `<table><thead><tr><th>Driver</th><th>Actual to Date</th><th>Contribution %</th></tr></thead><tbody>${rows}</tbody></table>`;
      return;
    }
    const reconciliation = result.reconciliation || {};
    element("executionDriverReconciliation").innerHTML = ["base", "comparison", "change"].map((key) => reconciliation[key] ? `<div><strong>${escape(key === "base" ? "Base" : key === "comparison" ? "Comparison" : "Change")}</strong><span>Parent: ${escape(money(reconciliation[key].parent))}</span><span>Drivers: ${escape(money(reconciliation[key].drivers))}</span><span>Difference: ${escape(signedMoney(reconciliation[key].difference))}</span></div>` : "").join("");
    if (!result.rows.length) { element("executionDriverTable").innerHTML = `<p class="commercial-driver-empty">${escape(driverStatusMessage(result))}</p>`; return; }
    const direction = (value) => value === "UP" ? "Growth" : value === "DOWN" ? "Degrowth" : "Flat";
    const rows = result.rows.map((row) => `<tr data-driver-key="${escape(row.key)}"><td>${escape(row.key === "__UNMAPPED__" ? `Unmapped ${result.driverDimension === "PRODUCT" ? "Product" : "LOB"}` : row.label)}</td><td class="${semanticClass(row.baseActual)}">${escape(money(row.baseActual))}</td><td class="${semanticClass(row.comparisonActual)}">${escape(money(row.comparisonActual))}</td><td class="${semanticClass(row.change)}">${escape(signedMoney(row.change))}</td><td>${escape(percent(row.growthPercent))}</td><td>${escape(direction(row.direction))}</td></tr>`).join("");
    element("executionDriverTable").innerHTML = `<table><thead><tr><th>Driver</th><th>Base Actual</th><th>Comparison Actual</th><th>Change</th><th>Growth / Degrowth</th><th>Direction</th></tr></thead><tbody>${rows}</tbody></table>`;
  }
  function buildDriverAnalysis() {
    const selection = state.execution.driverAnalysis;
    if (!selection.parentKey || !lastExecutionContext || !global.BancaTrackerCommercialDriverAnalysis) { renderDriverAnalysis(null); return null; }
    const common = { parentSelection: selection, driverDimension: selection.driverDimension, facts: lastExecutionContext.facts, authorityContext: lastExecutionContext.authorityContext };
    if (selection.mode === "MONTH_COMPARISON") {
      const comparison = state.comparison;
      if (!comparison.basePeriod || !comparison.comparisonPeriod || !global.BancaTrackerCommercialComparison) { lastDriverAnalysis = null; renderDriverAnalysis(null); return null; }
      const parentComparisonResult = global.BancaTrackerCommercialComparison.buildComparison({ performanceResult: lastExecutionContext.performanceResult, periodContext: lastExecutionContext.periodContext, authorityContext: lastExecutionContext.authorityContext, basePeriod: comparison.basePeriod, comparisonPeriod: comparison.comparisonPeriod, dimension: selection.parentDimension });
      lastDriverAnalysis = global.BancaTrackerCommercialDriverAnalysis.buildComparisonDrivers({ ...common, basePeriod: comparison.basePeriod, comparisonPeriod: comparison.comparisonPeriod, parentComparisonResult });
    } else {
      lastDriverAnalysis = global.BancaTrackerCommercialDriverAnalysis.buildExecutionDrivers({ ...common, periodKey: state.execution.selectedPeriod, asOfDay: state.execution.asOfDay, parentExecutionResult: lastExecutionResult });
    }
    renderDriverAnalysis(lastDriverAnalysis);
    return lastDriverAnalysis;
  }
  function buildExecutionDrilldown() {
    const selection = state.execution.drilldown;
    if (!selection.parentKey || !selection.childDimension || !lastExecutionResult || !lastExecutionContext || !global.BancaTrackerCommercialExecutionDrilldown) { renderExecutionDrilldown(null); return null; }
    lastExecutionDrilldown = global.BancaTrackerCommercialExecutionDrilldown.buildDrilldown({
      parentSelection: selection, childDimension: selection.childDimension,
      parentExecutionResult: lastExecutionResult,
      performanceResult: lastExecutionContext.performanceResult,
      periodContext: lastExecutionContext.periodContext,
      facts: lastExecutionContext.facts,
      authorityContext: lastExecutionContext.authorityContext,
      periodKey: state.execution.selectedPeriod, asOfDay: state.execution.asOfDay,
    });
    renderExecutionDrilldown(lastExecutionDrilldown);
    return lastExecutionDrilldown;
  }
  function handleExecutionParentSelect(parentKey, parentLabel) {
    const parentDimension = state.execution.dimension;
    const allowed = global.BancaTrackerCommercialExecutionDrilldown.getAllowedDrilldowns(parentDimension);
    state.execution.drilldown = { parentDimension, parentKey, parentLabel, childDimension: allowed[0] || null };
    state.execution.driverAnalysis.parentDimension = parentDimension; state.execution.driverAnalysis.parentKey = parentKey; state.execution.driverAnalysis.parentLabel = parentLabel;
    renderExecutionTable(lastExecutionResult, lastExecutionStatus); renderExecutionPriority(lastExecutionPriority);
    if (!allowed.length) { lastExecutionDrilldown = null; renderExecutionDrilldown(null); buildDriverAnalysis(); return null; }
    const drilldown = buildExecutionDrilldown(); buildDriverAnalysis(); return drilldown;
  }
  function handleExecutionDrilldownChildChange(value) {
    state.execution.drilldown.childDimension = value || element("executionDrilldownChild").value || null;
    return buildExecutionDrilldown();
  }
  function renderExecution(periodContext, performance, authorityContext, forceDefaultAsOf = false) {
    if (!global.BancaTrackerCommercialExecution) return null;
    resolveExecutionState(periodContext, forceDefaultAsOf); renderExecutionControls(periodContext);
    if (!state.execution.selectedPeriod) { lastExecutionResult = null; lastExecutionStatus = null; lastExecutionPriority = null; lastExecutionContext = null; renderExecutionReadiness(null); element("executionKpis").innerHTML = ""; element("executionAttentionSummary").innerHTML = ""; element("executionTable").innerHTML = `<p class="empty-state">No commercial periods are available.</p>`; renderExecutionPriority(null); clearExecutionDrilldown("No commercial periods are available."); clearDriverAnalysis("No commercial periods are available."); return null; }
    const common = { facts: global.BancaTrackerCore.state.factData || [], performanceResult: performance, periodContext, selectedPeriod: state.execution.selectedPeriod, asOfDay: state.execution.asOfDay, authorityContext };
    const overall = global.BancaTrackerCommercialExecution.buildExecution({ ...common, dimension: "OVERALL" });
    const table = state.execution.dimension === "OVERALL" ? overall : global.BancaTrackerCommercialExecution.buildExecution({ ...common, dimension: state.execution.dimension });
    const statusOverall = global.BancaTrackerCommercialExecutionStatus && global.BancaTrackerCommercialExecutionStatus.buildStatus(overall);
    const statusTable = global.BancaTrackerCommercialExecutionStatus && global.BancaTrackerCommercialExecutionStatus.buildStatus(table);
    const priority = global.BancaTrackerCommercialExecutionPriority && statusTable && global.BancaTrackerCommercialExecutionPriority.buildPriority(table, statusTable);
    lastExecutionResult = table; lastExecutionStatus = statusTable || null; lastExecutionPriority = priority || null; lastExecutionContext = common;
    renderExecutionReadiness(table); renderExecutionKpis(overall); renderExecutionStatusSummary(statusOverall, statusTable); renderExecutionTable(table, statusTable); renderExecutionPriority(priority);
    const selected = state.execution.drilldown;
    if (selected.parentKey) {
      if (selected.parentDimension !== state.execution.dimension || !table.rows.some((row) => row.key === selected.parentKey)) clearExecutionDrilldown("The selected entity is no longer available in the current execution snapshot.");
      else buildExecutionDrilldown();
    } else renderExecutionDrilldown(null);
    const driver = state.execution.driverAnalysis;
    if (driver.parentKey) {
      if (driver.parentDimension !== state.execution.dimension || !table.rows.some((row) => row.key === driver.parentKey)) clearDriverAnalysis("The selected entity is no longer available in the current governed data.");
      else buildDriverAnalysis();
    } else renderDriverAnalysis(null);
    return { overall, table, statusOverall, statusTable, priority };
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
        if (global.BancaTrackerEquivalentElapsedDayComparison) { lastPaceResult = null; renderPaceControls(null); renderPaceReadiness({ status: "NO_PERIODS" }); element("paceKpis").innerHTML = ""; renderPaceChart(null, {}); renderPaceTable(null); }
      }
      if (global.BancaTrackerCommercialExecution) {
        resolveExecutionState(periodContext, true); renderExecutionControls(periodContext); renderExecutionReadiness(null);
        lastExecutionResult = null; lastExecutionStatus = null; lastExecutionPriority = null; lastExecutionContext = null; element("executionKpis").innerHTML = ""; element("executionAttentionSummary").innerHTML = ""; element("executionTable").innerHTML = `<p class="empty-state">No commercial periods are available.</p>`; renderExecutionPriority(null); clearExecutionDrilldown("No commercial periods are available."); clearDriverAnalysis("No commercial periods are available.");
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
    const pace = renderPace(periodContext, performance, authorityContext);
    const execution = renderExecution(periodContext, performance, authorityContext);
    const maturity = renderMaturity(periodContext, performance, authorityContext);
    return { periodContext, overall, table, comparison, pace, execution, maturity };
  }
  function handleScopeChange(value) { state.scopeType = value || element("commercialScope").value; return render(); }
  function handlePeriodChange(value) { state.selectedPeriod = value || element("commercialPeriod").value; state.selectedFinancialYear = global.BancaTrackerCommercialRollups.getFinancialYear(state.selectedPeriod); return render(); }
  function handleFinancialYearChange(value) { state.selectedFinancialYear = value || element("commercialFinancialYear").value; return render(); }
  function handleDimensionChange(value) { state.dimension = value || element("commercialDimension").value; return render(); }
  function handleComparisonPeriodChange(role, value) { state.comparison[role] = value || null; return render(); }
  function handleComparisonDimensionChange(value) { state.comparison.dimension = value || element("comparisonDimension").value; state.comparison.selectedEntityKey = null; return render(); }
  function handleDailyEntityChange(value) { state.comparison.selectedEntityKey = value || element("dailyEntity").value; renderDaily(lastDailyResult); return lastDailyResult; }
  function handleDailyViewChange(value) { state.comparison.dailyViewMode = value || element("dailyViewMode").value; renderDaily(lastDailyResult); return lastDailyResult; }
  function handlePaceThroughDayChange(value) { state.comparison.paceThroughDay = Number(value === undefined ? element("paceThroughDay").value : value); const context = currentExecutionContext(); return renderPace(context.periodContext, context.performance, context.authorityContext); }
  function handlePaceEntityChange(value) { state.comparison.paceEntityKey = value || element("paceEntity").value || null; const entity = paceEntity(lastPaceResult); renderPaceKpis(entity); renderPaceChart(entity, lastPaceResult || {}); renderPaceTable(entity); return entity; }
  function handleMaturityChange() { const context = currentExecutionContext(); return renderMaturity(context.periodContext, context.performance, context.authorityContext); }
  function handleMaturityPeriodChange(index, value) { state.maturity.periods[index] = value; return handleMaturityChange(); }
  function handleMaturityAddMonth() { const available = currentExecutionContext().periodContext.availablePeriods; const next = available.find((period) => period > state.maturity.periods[1]); state.maturity.periods = next ? [...state.maturity.periods.slice(0, 2), next] : available.slice(-3); return handleMaturityChange(); }
  function handleMaturityRemoveMonth() { state.maturity.periods = state.maturity.periods.slice(0, 2); state.maturity.transitionIndex = 0; return handleMaturityChange(); }
  function handleMaturityDimensionChange(value) { state.maturity.dimension = value || element("maturityDimension").value; state.maturity.entityKey = null; return handleMaturityChange(); }
  function handleMaturityEntityChange(value) { state.maturity.entityKey = value || element("maturityEntity").value || null; const entity = selectedMaturityEntity(lastMaturityResult); renderMaturityDistribution(entity); renderMaturityMovement(entity); return entity; }
  function handleMaturityTransitionChange(value) { state.maturity.transitionIndex = Number(value === undefined ? element("maturityTransition").value : value); renderMaturityMovement(selectedMaturityEntity(lastMaturityResult)); }
  function handleMaturityFilterChange(value) { state.maturity.movementFilter = value || element("maturityMovementFilter").value; renderMaturityMovement(selectedMaturityEntity(lastMaturityResult)); }
  function currentExecutionContext() { const performance = global.BancaTrackerCore.state.commercialPerformance; return { periodContext: global.BancaTrackerCommercialRollups.buildPeriodContext(performance), performance, authorityContext: global.BancaTrackerLiveGeographyAuthority && global.BancaTrackerLiveGeographyAuthority.getCachedContext() }; }
  function handleExecutionPeriodChange(value) { state.execution.selectedPeriod = value || element("executionPeriod").value; state.execution.asOfExplicit = false; clearExecutionDrilldown("Select an execution entity for the new month."); const context = currentExecutionContext(); return renderExecution(context.periodContext, context.performance, context.authorityContext, true); }
  function handleExecutionAsOfChange(value) { state.execution.asOfDay = Number(value === undefined ? element("executionAsOfDay").value : value); state.execution.asOfExplicit = true; const context = currentExecutionContext(); return renderExecution(context.periodContext, context.performance, context.authorityContext); }
  function handleExecutionDimensionChange(value) { state.execution.dimension = value || element("executionDimension").value; clearExecutionDrilldown("Select an execution entity for the new dimension."); clearDriverAnalysis("Select an execution entity for the new dimension."); const context = currentExecutionContext(); return renderExecution(context.periodContext, context.performance, context.authorityContext); }
  function handleDriverAnalysisModeChange(value) { state.execution.driverAnalysis.mode = value || element("executionDriverMode").value || "EXECUTION_SNAPSHOT"; return buildDriverAnalysis(); }
  function handleDriverAnalysisDimensionChange(value) { state.execution.driverAnalysis.driverDimension = value || element("executionDriverDimension").value || "LOB"; return buildDriverAnalysis(); }
  function handleExecutionAttentionFilterChange(value) { state.execution.attentionFilter = value || element("executionAttentionFilter").value || "ALL"; element("executionAttentionFilter").value = state.execution.attentionFilter; renderExecutionTable(lastExecutionResult, lastExecutionStatus); return lastExecutionStatus; }
  function handleExecutionPriorityViewChange(value) { state.execution.priorityView = value || element("executionPriorityView").value || "NONE"; element("executionPriorityView").value = state.execution.priorityView; renderExecutionPriority(lastExecutionPriority); return lastExecutionPriority; }
  function init() {
    if (initialized) return;
    ensureMaturityMarkup();
    element("commercialScope").addEventListener("change", function () { handleScopeChange(this.value); });
    element("commercialPeriod").addEventListener("change", function () { handlePeriodChange(this.value); });
    element("commercialFinancialYear").addEventListener("change", function () { handleFinancialYearChange(this.value); });
    element("commercialDimension").addEventListener("change", function () { handleDimensionChange(this.value); });
    element("comparisonBasePeriod").addEventListener("change", function () { handleComparisonPeriodChange("basePeriod", this.value); });
    element("comparisonPeriod").addEventListener("change", function () { handleComparisonPeriodChange("comparisonPeriod", this.value); });
    element("comparisonDimension").addEventListener("change", function () { handleComparisonDimensionChange(this.value); });
    element("dailyEntity").addEventListener("change", function () { handleDailyEntityChange(this.value); });
    element("dailyViewMode").addEventListener("change", function () { handleDailyViewChange(this.value); });
    element("paceThroughDay").addEventListener("change", function () { handlePaceThroughDayChange(this.value); });
    element("paceEntity").addEventListener("change", function () { handlePaceEntityChange(this.value); });
    element("maturityPeriodOne").addEventListener("change", function () { handleMaturityPeriodChange(0, this.value); }); element("maturityPeriodTwo").addEventListener("change", function () { handleMaturityPeriodChange(1, this.value); }); element("maturityPeriodThree").addEventListener("change", function () { handleMaturityPeriodChange(2, this.value); }); element("maturityAddMonth").addEventListener("click", handleMaturityAddMonth); element("maturityRemoveMonth").addEventListener("click", handleMaturityRemoveMonth); element("maturityDimension").addEventListener("change", function () { handleMaturityDimensionChange(this.value); }); element("maturityEntity").addEventListener("change", function () { handleMaturityEntityChange(this.value); }); element("maturityTransition").addEventListener("change", function () { handleMaturityTransitionChange(this.value); }); element("maturityMovementFilter").addEventListener("change", function () { handleMaturityFilterChange(this.value); });
    element("executionPeriod").addEventListener("change", function () { handleExecutionPeriodChange(this.value); });
    element("executionAsOfDay").addEventListener("change", function () { handleExecutionAsOfChange(this.value); });
    element("executionDimension").addEventListener("change", function () { handleExecutionDimensionChange(this.value); });
    element("executionAttentionFilter").addEventListener("change", function () { handleExecutionAttentionFilterChange(this.value); });
    element("executionPriorityView").addEventListener("change", function () { handleExecutionPriorityViewChange(this.value); });
    element("executionDrilldownChild").addEventListener("change", function () { handleExecutionDrilldownChildChange(this.value); });
    element("executionDriverMode").addEventListener("change", function () { handleDriverAnalysisModeChange(this.value); });
    element("executionDriverDimension").addEventListener("change", function () { handleDriverAnalysisDimensionChange(this.value); });
    [element("executionTable"), element("executionPriorityTable")].forEach((container) => container.addEventListener("click", function (event) { const control = event.target.closest && event.target.closest(".commercial-drilldown-select"); if (control) handleExecutionParentSelect(control.dataset.parentKey, control.dataset.parentLabel); }));
    initialized = true;
  }
  init();
  global.BancaTrackerCommercialPerformanceUI = Object.freeze({ state, init, render, renderControls, renderKpis, renderTable, renderReadiness, renderComparison, renderComparisonKpis, renderComparisonTable, renderDaily, renderPace, renderPaceKpis, renderPaceChart, renderPaceTable, renderMaturity, renderMaturityDistribution, renderMaturityMovement, renderExecution, renderExecutionKpis, renderExecutionStatusSummary, renderExecutionTable, renderExecutionPriority, renderExecutionDrilldown, buildExecutionDrilldown, clearExecutionDrilldown, renderDriverAnalysis, buildDriverAnalysis, clearDriverAnalysis, filterExecutionRows, handleScopeChange, handlePeriodChange, handleFinancialYearChange, handleDimensionChange, handleComparisonPeriodChange, handleComparisonDimensionChange, handleDailyEntityChange, handleDailyViewChange, handlePaceThroughDayChange, handlePaceEntityChange, handleMaturityPeriodChange, handleMaturityAddMonth, handleMaturityRemoveMonth, handleMaturityDimensionChange, handleMaturityEntityChange, handleMaturityTransitionChange, handleMaturityFilterChange, handleExecutionPeriodChange, handleExecutionAsOfChange, handleExecutionDimensionChange, handleExecutionAttentionFilterChange, handleExecutionPriorityViewChange, handleExecutionParentSelect, handleExecutionDrilldownChildChange, handleDriverAnalysisModeChange, handleDriverAnalysisDimensionChange, money, percent, signedMoney, points, growth });
})(window);
