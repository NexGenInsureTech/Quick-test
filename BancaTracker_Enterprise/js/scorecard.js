/* Management Scorecard: transparent priorities and local Partner -> RM/IMD -> opportunity drill-down. */
(function (global) {
  const config = global.BancaTrackerConfig; const utils = global.BancaTrackerUtils;
  const PRIORITY_ORDER = { CRITICAL: 0, HIGH: 1, UNCONFIGURED: 2, MEDIUM: 3, LOW: 4, "NO DATA": 5 };
  const uiState = { selectedBank: null, selectedRmKey: null, selectedImdKey: null };
  let lastModel = null;

  function classifyPriority(metrics) {
    if (metrics.premium === 0 && metrics.observedBranches === 0) return "NO DATA";
    if (metrics.dataQualityError) return "CRITICAL";
    if (metrics.branchUniverse === null) return "UNCONFIGURED";
    if (metrics.activationPercent < 10 && metrics.nearActiveBranches > 0) return "CRITICAL";
    if (metrics.activationPercent < 20 && metrics.nearActiveBranches > 0) return "HIGH";
    if (metrics.activationPercent < 40 || metrics.nearActiveBranches > 0) return "MEDIUM";
    if (metrics.activationPercent >= 40 && metrics.nearActiveBranches === 0) return "LOW";
    return "MEDIUM";
  }

  function managementCue(metrics) {
    if (metrics.dataQualityError) return "Resolve data mapping before relying on branch-level decisions.";
    if ((metrics.priority === "CRITICAL" || metrics.priority === "HIGH") && metrics.nearActiveBranches > 0) return `Prioritize near-active conversion; ₹${utils.formatInr(metrics.aggregateActivationGap)} aggregate gap across ${metrics.nearActiveBranches} branch${metrics.nearActiveBranches === 1 ? "" : "es"}.`;
    if (metrics.activationPercent < 20 && metrics.nearActiveBranches === 0 && metrics.premium > 0) return "Build branch activation pipeline.";
    if (metrics.activationPercent >= 40 && metrics.observedBranches > metrics.activeBranches) return "Protect active base and broaden productivity.";
    if (metrics.priority === "LOW") return "Maintain activation and scale productivity.";
    return "Strengthen branch activation and productivity.";
  }

  function qualityForBank(bank, audit, bankIndex) {
    const hierarchy = audit.hierarchyConflicts.filter((item) => item.bank === bank);
    const universe = audit.branchUniverseSanity.filter((item) => item.bank === bank && item.exceeded);
    const baCodes = new Set((bankIndex.rms || []).map((item) => item.code));
    const products = new Set((bankIndex.branches || []).flatMap((branch) => [...branch.productCodes]));
    const identity = audit.baCodeConflicts.filter((item) => baCodes.has(item.key));
    const product = audit.productConflicts.filter((item) => products.has(item.key));
    const unknown = audit.bankQuality.unknownBanks.includes(bank);
    const errors = [...hierarchy.map((item) => `${item.branchKey}: multiple ${item.field} values`), ...universe.map(() => `${bank}: observed/active branches exceed configured universe`)];
    const warnings = [...identity.map((item) => `BA Code ${item.key}: multiple RM names`), ...product.map((item) => `Product Code ${item.key}: multiple names`), ...(unknown ? [`${bank}: no configured branch universe`] : [])];
    return { errors, warnings, hasError: errors.length > 0, flagLabel: errors.length ? `ERROR ${errors.length}` : warnings.length ? `WARNING ${warnings.length}` : "Clear" };
  }

  function buildPartnerMetrics(derived, productivity, audit, selectedBank) {
    const configured = Object.keys(config.TOTAL_BRANCHES);
    const banks = selectedBank && selectedBank !== "ALL" ? [selectedBank] : [...new Set([...configured, ...Object.keys(derived.bankBranchMetrics)])];
    const totalPremium = derived.totalPremium;
    return banks.map((bank) => {
      const source = derived.bankBranchMetrics[bank] || { premium: 0, observed: 0, active: 0, nearActive: 0 };
      const index = productivity.bankIndexes[bank] || { rms: [], imds: [], branches: [], opportunities: [] };
      const branchUniverse = config.TOTAL_BRANCHES[bank] || null;
      const activationPercent = branchUniverse ? (source.active / branchUniverse) * 100 : 0;
      const aggregateActivationGap = index.opportunities.reduce((sum, branch) => sum + branch.gap, 0);
      const quality = qualityForBank(bank, audit, index);
      const metric = { bank, premium: source.premium, contributionPercent: totalPremium > 0 ? (source.premium / totalPremium) * 100 : 0, observedBranches: source.observed, activeBranches: source.active, nearActiveBranches: source.nearActive, branchUniverse, activationPercent, aggregateActivationGap, observedBaCodes: index.rms.length, observedImds: index.imds.length, dataQualityError: quality.hasError, dataQuality: quality };
      metric.priority = classifyPriority(metric); metric.cue = managementCue(metric); return metric;
    }).sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || b.premium - a.premium || a.bank.localeCompare(b.bank));
  }

  function buildExceptions(metrics, productivity) {
    const exceptions = [];
    metrics.forEach((bank) => { if (bank.dataQualityError) exceptions.push({ severity: "ERROR", label: bank.bank, message: "Data Quality ERROR requires resolution." }); if (bank.priority === "CRITICAL" || bank.priority === "HIGH") exceptions.push({ severity: bank.priority === "CRITICAL" ? "ERROR" : "WARNING", label: bank.bank, message: `${bank.priority} commercial priority.` }); });
    productivity.rmMetrics.filter((item) => item.nearActiveBranches > 1).forEach((item) => exceptions.push({ severity: "WARNING", label: `${item.bank} / ${item.code}`, message: `${item.nearActiveBranches} near-active RM branches.` }));
    productivity.imdMetrics.filter((item) => item.nearActiveBranches > 1).forEach((item) => exceptions.push({ severity: "WARNING", label: `${item.bank} / ${item.code}`, message: `${item.nearActiveBranches} near-active IMD branches.` }));
    productivity.opportunities.filter((branch) => branch.gap <= config.MANAGEMENT.SMALL_ACTIVATION_GAP).forEach((branch) => exceptions.push({ severity: "INFO", label: `${branch.bank} / ${branch.branch}`, message: `Immediate opportunity: ₹${utils.formatInr(branch.gap)} gap.` }));
    return exceptions;
  }

  function buildBankDetail(bank, model) {
    const metric = model.metrics.find((item) => item.bank === bank); if (!metric) return null;
    const index = model.productivity.bankIndexes[bank] || { rms: [], imds: [], branches: [], opportunities: [] };
    const zoneConcentration = global.BancaTrackerProductivity.concentration(index.opportunities, (branch) => branch.zoneLabel, "Zone");
    const stateConcentration = global.BancaTrackerProductivity.concentration(index.opportunities, (branch) => branch.stateLabel, "State");
    const ytdPremium = model.productivity.ytdPremiumByBank[bank] || 0;
    const target = global.BancaTrackerTarget.calculateTargetForBank(model.context, bank, ytdPremium);
    return { metric, index, zoneConcentration, stateConcentration, target, quality: metric.dataQuality };
  }

  const html = (value) => utils.escapeHtml(value); const amount = (value) => utils.formatInr(value); const encoded = (value) => encodeURIComponent(value);
  const badge = (value) => `<span class='priority priority-${value.toLowerCase().replace(" ", "-")}'>${value}</span>`;
  function renderSummary(metrics) { const count = (priority) => metrics.filter((bank) => bank.priority === priority).length; const near = metrics.reduce((sum, bank) => sum + bank.nearActiveBranches, 0); const gap = metrics.reduce((sum, bank) => sum + bank.aggregateActivationGap, 0); const cards = [["Total Partner Banks", metrics.length], ["Critical", count("CRITICAL")], ["High", count("HIGH")], ["Medium", count("MEDIUM")], ["Near Active", near], ["Aggregate Activation Gap", amount(gap)]]; document.getElementById("scorecardSummary").innerHTML = cards.map(([label, value]) => `<div class='card'><div>${label}</div><div class='value'>${value}</div></div>`).join(""); }
  function renderScorecard(metrics) { const rows = metrics.map((bank) => `<tr class='management-bank-row'><td><button class='management-link' data-bank='${encoded(bank.bank)}'>${html(bank.bank)}</button></td><td>${amount(bank.premium)}</td><td>${bank.contributionPercent.toFixed(1)}%</td><td>${bank.observedBranches}</td><td>${bank.activeBranches}</td><td>${bank.branchUniverse || "Not configured"}</td><td>${bank.branchUniverse ? `${bank.activationPercent.toFixed(1)}%` : "N/A"}</td><td>${bank.nearActiveBranches}</td><td>${amount(bank.aggregateActivationGap)}</td><td>${bank.observedBaCodes}</td><td>${bank.observedImds}</td><td>${html(bank.dataQuality.flagLabel)}</td><td>${badge(bank.priority)}</td></tr>`).join(""); document.getElementById("partnerScorecard").innerHTML = `<p class='scorecard-note'>All commercial metrics use CURRENT PERIOD. Activation uses Active Branches ÷ configured branch universe. Select a Partner Bank to drill down.</p><table><thead><tr><th>Partner Bank</th><th>Current Period Premium</th><th>Contribution %</th><th>Observed Branches</th><th>Active</th><th>Branch Universe</th><th>Activation %</th><th>Near Active</th><th>Aggregate Activation Gap</th><th>BA Codes</th><th>IMDs</th><th>Data Quality</th><th>Priority</th></tr></thead><tbody>${rows}</tbody></table>`; }
  function renderActions(metrics) { document.getElementById("managementActions").innerHTML = metrics.filter((bank) => bank.priority !== "NO DATA").map((bank) => `<div class='metric'><strong>${html(bank.bank)} — ${bank.priority}</strong><br>${html(bank.cue)}</div>`).join("") || "<p class='empty-state'>No current-period management actions.</p>"; }
  function renderExceptions(exceptions) { const limit = config.RENDER_LIMITS.MANAGEMENT_EXCEPTIONS; const note = exceptions.length > limit ? `<p class='table-limit-note'>Showing ${limit} of ${utils.formatInr(exceptions.length)} exceptions.</p>` : ""; document.getElementById("managementExceptions").innerHTML = exceptions.length ? note + exceptions.slice(0, limit).map((item) => `<div class='metric'>${item.severity === "ERROR" ? "<span class='quality-severity quality-error'>ERROR</span>" : item.severity === "WARNING" ? "<span class='quality-severity quality-warning'>WARNING</span>" : "<span class='quality-severity quality-info'>INFO</span>"} <strong>${html(item.label)}</strong> — ${html(item.message)}</div>`).join("") : "<p class='empty-state'>No high-value management exceptions in the current period.</p>"; }
  function opportunityRows(items) { return items.length ? `<table><thead><tr><th>Branch</th><th>Zone</th><th>State</th><th>BA Code / RM</th><th>IMD</th><th>Premium</th><th>Gap</th><th>LOB</th><th>Products</th><th>Mapping / Cue</th></tr></thead><tbody>${items.slice(0, 100).map((branch) => `<tr><td>${html(branch.branch)}</td><td>${html(branch.zoneLabel)}</td><td>${html(branch.stateLabel)}</td><td>${html(`${branch.baCodeLabel} / ${branch.rmLabel}`)}</td><td>${html(branch.imdLabel)}</td><td>${amount(branch.premium)}</td><td>${amount(branch.gap)}</td><td>${branch.lobBreadth}</td><td>${branch.productBreadth}</td><td>${html([branch.hierarchyConflict ? "Hierarchy conflict" : "", branch.productMappingConflict ? "Product mapping conflict" : "", branch.cue].filter(Boolean).join("; ") || "—")}</td></tr>`).join("")}</tbody></table>` : "<p class='empty-state'>No near-active branches.</p>"; }
  function concentrationTable(items) { return items.length ? `<table><thead><tr><th>Group</th><th>Near Active</th><th>Aggregate Gap</th></tr></thead><tbody>${items.slice(0, 50).map((item) => `<tr><td>${html(item.name)}</td><td>${item.nearActiveBranches}</td><td>${amount(item.aggregateGap)}</td></tr>`).join("")}</tbody></table>` : "<p class='empty-state'>No near-active concentration.</p>"; }
  function targetHtml(target) { if (target.annualTarget === null) return "<p class='empty-state'>No bank-specific target set.</p>"; const value = (number) => number == null ? "Not available" : `₹${number.toFixed(2)} Cr`; return `<div class='management-summary'><div><strong>YTD Actual</strong><br>${value(target.actual)}</div><div><strong>YTD Target</strong><br>${value(target.ytdTarget)}</div><div><strong>Achievement</strong><br>${target.achievement == null ? "Undefined" : `${target.achievement.toFixed(1)}%`}</div><div><strong>Gap</strong><br>${value(target.gap)}</div></div>`; }
  function entityButtons(items, kind) { if (!items.length) return "<p class='empty-state'>No mapped entities.</p>"; return `<table><thead><tr><th>${kind === "rm" ? "BA Code / RM" : "IMD Code"}</th><th>Premium</th><th>Observed</th><th>Active</th><th>Near Active</th><th>Aggregate Gap</th></tr></thead><tbody>${items.slice(0, 20).map((item) => `<tr><td><button class='management-link' data-${kind}='${encoded(item.key)}'>${html(kind === "rm" ? `${item.code} / ${item.name}` : item.code)}</button></td><td>${amount(item.premium)}</td><td>${item.observedBranches}</td><td>${item.activeBranches}</td><td>${item.nearActiveBranches}</td><td>${amount(item.aggregateActivationGap)}</td></tr>`).join("")}</tbody></table>`; }
  function renderEntityDetail(detail, kind) { const key = kind === "rm" ? uiState.selectedRmKey : uiState.selectedImdKey; if (!key) return ""; const items = kind === "rm" ? detail.index.rms : detail.index.imds; const entity = items.find((item) => item.key === key); if (!entity) return ""; const opportunities = detail.index.opportunities.filter((branch) => kind === "rm" ? branch.baCodes.has(entity.code) : branch.imds.has(entity.code)); return `<div class='panel management-subdetail'><h4>${kind === "rm" ? `RM / BA Code: ${html(entity.code)} / ${html(entity.name)}` : `IMD: ${html(entity.code)}`}</h4><div class='management-summary'><div><strong>Premium</strong><br>${amount(entity.premium)}</div><div><strong>Observed Branches</strong><br>${entity.observedBranches}</div><div><strong>Active</strong><br>${entity.activeBranches}</div><div><strong>Near Active</strong><br>${entity.nearActiveBranches}</div><div><strong>Aggregate Gap</strong><br>${amount(entity.aggregateActivationGap)}</div>${kind === "rm" ? `<div><strong>LOB / Product Breadth</strong><br>${entity.lobBreadth} / ${entity.productBreadth}</div>` : ""}</div><h4>Near Active Branches</h4>${opportunityRows(opportunities)}</div>`; }
  function renderDetail() { const container = document.getElementById("managementDetail"); if (!lastModel || !uiState.selectedBank) { container.innerHTML = "<p class='empty-state'>Select a Partner Bank from the scorecard.</p>"; return; } const detail = buildBankDetail(uiState.selectedBank, lastModel); if (!detail) { container.innerHTML = "<p class='empty-state'>No detail available for the selected bank.</p>"; return; } const m = detail.metric; const qualityItems = [...detail.quality.errors.map((message) => `<li><span class='quality-severity quality-error'>ERROR</span> ${html(message)}</li>`), ...detail.quality.warnings.map((message) => `<li><span class='quality-severity quality-warning'>WARNING</span> ${html(message)}</li>`)]; container.innerHTML = `<h3>${html(m.bank)} Management Detail</h3><p class='scorecard-note'>Scorecard → Partner → RM/IMD → Branch Opportunity. Local selections do not change global filters.</p><div class='management-summary'><div><strong>Current Premium</strong><br>${amount(m.premium)}</div><div><strong>Observed / Active</strong><br>${m.observedBranches} / ${m.activeBranches}</div><div><strong>Activation</strong><br>${m.branchUniverse ? `${m.activationPercent.toFixed(1)}%` : "N/A"}</div><div><strong>Near Active</strong><br>${m.nearActiveBranches}</div><div><strong>Aggregate Gap</strong><br>${amount(m.aggregateActivationGap)}</div><div><strong>Priority</strong><br>${badge(m.priority)}</div></div><h4>Target Context</h4>${targetHtml(detail.target)}<div class='grid'><div><h4>Top RM / BA Code</h4>${entityButtons(detail.index.rms, "rm")}</div><div><h4>Top IMD</h4>${entityButtons(detail.index.imds, "imd")}</div></div>${renderEntityDetail(detail, "rm")}${renderEntityDetail(detail, "imd")}<h4>Near Active Branch Opportunities</h4>${opportunityRows(detail.index.opportunities)}<div class='grid'><div><h4>Zone Opportunity Concentration</h4>${concentrationTable(detail.zoneConcentration)}</div><div><h4>State Opportunity Concentration</h4>${concentrationTable(detail.stateConcentration)}</div></div><h4>Relevant Data Quality</h4>${qualityItems.length ? `<ul>${qualityItems.join("")}</ul>` : "<p class='empty-state'>No relevant cached Data Quality conflicts.</p>"}`; }

  function refreshScorecard(derived) { const core = global.BancaTrackerCore.state; const context = global.BancaTrackerCore.getPerformanceContext(); const productivity = core.productivity; const audit = core.dataQuality; const metrics = buildPartnerMetrics(derived, productivity, audit, core.filters.bank); const exceptions = buildExceptions(metrics, productivity); lastModel = { metrics, productivity, audit, context, derived }; if (core.filters.bank !== "ALL") uiState.selectedBank = core.filters.bank; else if (!metrics.some((item) => item.bank === uiState.selectedBank)) uiState.selectedBank = metrics[0] ? metrics[0].bank : null; if (uiState.selectedBank && !metrics.some((item) => item.bank === uiState.selectedBank)) uiState.selectedBank = null; uiState.selectedRmKey = null; uiState.selectedImdKey = null; document.getElementById("scorecardScope").textContent = `Operational scorecard period: ${context.currentPeriodMonth || "No configured fiscal month available"}. Premium, activation, near-active opportunities and aggregate gaps all use CURRENT PERIOD. Priorities are deterministic rules, not predictions.${context.currentPeriodIsUnconfigured ? " The selected month is unconfigured and is excluded from fiscal YTD and target progression." : ""}`; renderSummary(metrics); renderScorecard(metrics); renderActions(metrics); renderExceptions(exceptions); renderDetail(); }
  function selectBank(bank) { uiState.selectedBank = bank; uiState.selectedRmKey = null; uiState.selectedImdKey = null; renderDetail(); }
  function selectRm(key) { uiState.selectedRmKey = key; uiState.selectedImdKey = null; renderDetail(); }
  function selectImd(key) { uiState.selectedImdKey = key; uiState.selectedRmKey = null; renderDetail(); }
  document.getElementById("partnerScorecard").addEventListener("click", (event) => { const button = event.target.closest && event.target.closest("[data-bank]"); if (button) selectBank(decodeURIComponent(button.dataset.bank)); });
  document.getElementById("managementDetail").addEventListener("click", (event) => { const rm = event.target.closest && event.target.closest("[data-rm]"); const imd = event.target.closest && event.target.closest("[data-imd]"); if (rm) selectRm(decodeURIComponent(rm.dataset.rm)); else if (imd) selectImd(decodeURIComponent(imd.dataset.imd)); });
  global.BancaTrackerScorecard = Object.freeze({ buildPartnerMetrics, classifyPriority, managementCue, buildExceptions, buildBankDetail, refreshScorecard, selectBank, selectRm, selectImd, uiState }); global.refreshScorecard = refreshScorecard;
})(window);
