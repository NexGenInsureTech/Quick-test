/*==============================================================
BancaTracker Enterprise
Version : 8.2.0-dev
File    : commercialPerformanceUI.js
Module  : Commercial Performance UI
Purpose : Render cached governed commercial roll-ups without owning formulas
==============================================================*/

(function (global) {
  "use strict";

  const state = { scopeType: "MONTH", selectedPeriod: null, selectedFinancialYear: null, dimension: "BANK", comparison: { basePeriod: null, comparisonPeriod: null, dimension: "BANK", selectedEntityKey: null, dailyViewMode: "CUMULATIVE" }, execution: { selectedPeriod: null, asOfDay: null, asOfExplicit: false, dimension: "BANK", attentionFilter: "ALL", priorityView: "NONE", drilldown: { parentDimension: null, parentKey: null, parentLabel: null, childDimension: null } } };
  const dimensionLabels = Object.freeze({ OVERALL: "Overall", BANK: "Bank", BRANCH: "Branch", STATE: "State", ZONE: "Zone", BANK_REGION: "Bank Region", BANK_ZONE: "Bank Zone", FGM_OFFICE: "FGM Office", ASSIGNED_RM: "Assigned RM", CSM: "CSM", ASM: "ASM", ZSM: "ZSM", NATIONAL_HEAD: "National Head" });
  let initialized = false;
  let lastDailyResult = null;
  let lastExecutionResult = null;
  let lastExecutionStatus = null;
  let lastExecutionPriority = null;
  let lastExecutionContext = null;
  let lastExecutionDrilldown = null;

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
    renderExecutionTable(lastExecutionResult, lastExecutionStatus); renderExecutionPriority(lastExecutionPriority);
    if (!allowed.length) { lastExecutionDrilldown = null; renderExecutionDrilldown(null); return null; }
    return buildExecutionDrilldown();
  }
  function handleExecutionDrilldownChildChange(value) {
    state.execution.drilldown.childDimension = value || element("executionDrilldownChild").value || null;
    return buildExecutionDrilldown();
  }
  function renderExecution(periodContext, performance, authorityContext, forceDefaultAsOf = false) {
    if (!global.BancaTrackerCommercialExecution) return null;
    resolveExecutionState(periodContext, forceDefaultAsOf); renderExecutionControls(periodContext);
    if (!state.execution.selectedPeriod) { lastExecutionResult = null; lastExecutionStatus = null; lastExecutionPriority = null; lastExecutionContext = null; renderExecutionReadiness(null); element("executionKpis").innerHTML = ""; element("executionAttentionSummary").innerHTML = ""; element("executionTable").innerHTML = `<p class="empty-state">No commercial periods are available.</p>`; renderExecutionPriority(null); clearExecutionDrilldown("No commercial periods are available."); return null; }
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
      }
      if (global.BancaTrackerCommercialExecution) {
        resolveExecutionState(periodContext, true); renderExecutionControls(periodContext); renderExecutionReadiness(null);
        lastExecutionResult = null; lastExecutionStatus = null; lastExecutionPriority = null; lastExecutionContext = null; element("executionKpis").innerHTML = ""; element("executionAttentionSummary").innerHTML = ""; element("executionTable").innerHTML = `<p class="empty-state">No commercial periods are available.</p>`; renderExecutionPriority(null); clearExecutionDrilldown("No commercial periods are available.");
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
    const execution = renderExecution(periodContext, performance, authorityContext);
    return { periodContext, overall, table, comparison, execution };
  }
  function handleScopeChange(value) { state.scopeType = value || element("commercialScope").value; return render(); }
  function handlePeriodChange(value) { state.selectedPeriod = value || element("commercialPeriod").value; state.selectedFinancialYear = global.BancaTrackerCommercialRollups.getFinancialYear(state.selectedPeriod); return render(); }
  function handleFinancialYearChange(value) { state.selectedFinancialYear = value || element("commercialFinancialYear").value; return render(); }
  function handleDimensionChange(value) { state.dimension = value || element("commercialDimension").value; return render(); }
  function handleComparisonPeriodChange(role, value) { state.comparison[role] = value || null; return render(); }
  function handleComparisonDimensionChange(value) { state.comparison.dimension = value || element("comparisonDimension").value; state.comparison.selectedEntityKey = null; return render(); }
  function handleDailyEntityChange(value) { state.comparison.selectedEntityKey = value || element("dailyEntity").value; renderDaily(lastDailyResult); return lastDailyResult; }
  function handleDailyViewChange(value) { state.comparison.dailyViewMode = value || element("dailyViewMode").value; renderDaily(lastDailyResult); return lastDailyResult; }
  function currentExecutionContext() { const performance = global.BancaTrackerCore.state.commercialPerformance; return { periodContext: global.BancaTrackerCommercialRollups.buildPeriodContext(performance), performance, authorityContext: global.BancaTrackerLiveGeographyAuthority && global.BancaTrackerLiveGeographyAuthority.getCachedContext() }; }
  function handleExecutionPeriodChange(value) { state.execution.selectedPeriod = value || element("executionPeriod").value; state.execution.asOfExplicit = false; clearExecutionDrilldown("Select an execution entity for the new month."); const context = currentExecutionContext(); return renderExecution(context.periodContext, context.performance, context.authorityContext, true); }
  function handleExecutionAsOfChange(value) { state.execution.asOfDay = Number(value === undefined ? element("executionAsOfDay").value : value); state.execution.asOfExplicit = true; const context = currentExecutionContext(); return renderExecution(context.periodContext, context.performance, context.authorityContext); }
  function handleExecutionDimensionChange(value) { state.execution.dimension = value || element("executionDimension").value; clearExecutionDrilldown("Select an execution entity for the new dimension."); const context = currentExecutionContext(); return renderExecution(context.periodContext, context.performance, context.authorityContext); }
  function handleExecutionAttentionFilterChange(value) { state.execution.attentionFilter = value || element("executionAttentionFilter").value || "ALL"; element("executionAttentionFilter").value = state.execution.attentionFilter; renderExecutionTable(lastExecutionResult, lastExecutionStatus); return lastExecutionStatus; }
  function handleExecutionPriorityViewChange(value) { state.execution.priorityView = value || element("executionPriorityView").value || "NONE"; element("executionPriorityView").value = state.execution.priorityView; renderExecutionPriority(lastExecutionPriority); return lastExecutionPriority; }
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
    element("executionPeriod").addEventListener("change", function () { handleExecutionPeriodChange(this.value); });
    element("executionAsOfDay").addEventListener("change", function () { handleExecutionAsOfChange(this.value); });
    element("executionDimension").addEventListener("change", function () { handleExecutionDimensionChange(this.value); });
    element("executionAttentionFilter").addEventListener("change", function () { handleExecutionAttentionFilterChange(this.value); });
    element("executionPriorityView").addEventListener("change", function () { handleExecutionPriorityViewChange(this.value); });
    element("executionDrilldownChild").addEventListener("change", function () { handleExecutionDrilldownChildChange(this.value); });
    [element("executionTable"), element("executionPriorityTable")].forEach((container) => container.addEventListener("click", function (event) { const control = event.target.closest && event.target.closest(".commercial-drilldown-select"); if (control) handleExecutionParentSelect(control.dataset.parentKey, control.dataset.parentLabel); }));
    initialized = true;
  }
  init();
  global.BancaTrackerCommercialPerformanceUI = Object.freeze({ state, init, render, renderControls, renderKpis, renderTable, renderReadiness, renderComparison, renderComparisonKpis, renderComparisonTable, renderDaily, renderExecution, renderExecutionKpis, renderExecutionStatusSummary, renderExecutionTable, renderExecutionPriority, renderExecutionDrilldown, buildExecutionDrilldown, clearExecutionDrilldown, filterExecutionRows, handleScopeChange, handlePeriodChange, handleFinancialYearChange, handleDimensionChange, handleComparisonPeriodChange, handleComparisonDimensionChange, handleDailyEntityChange, handleDailyViewChange, handleExecutionPeriodChange, handleExecutionAsOfChange, handleExecutionDimensionChange, handleExecutionAttentionFilterChange, handleExecutionPriorityViewChange, handleExecutionParentSelect, handleExecutionDrilldownChildChange, money, percent, signedMoney, points, growth });
})(window);
