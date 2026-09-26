/* Management Scorecard: transparent priorities and local Partner -> RM/IMD -> opportunity drill-down. */
(function (global) {
  const config = global.BancaTrackerConfig; const utils = global.BancaTrackerUtils;
  const PRIORITY_ORDER = { CRITICAL: 0, HIGH: 1, UNCONFIGURED: 2, MEDIUM: 3, LOW: 4, "NO DATA": 5 };
  const uiState = { selectedBank: null, selectedRmKey: null, selectedImdKey: null, managementBankFilter: "ALL" };
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
    if ((metrics.priority === "CRITICAL" || metrics.priority === "HIGH") && metrics.nearActiveBranches > 0) return `Prioritize near-active conversion; ${utils.formatRupees(metrics.aggregateActivationGap)} aggregate gap across ${metrics.nearActiveBranches} branch${metrics.nearActiveBranches === 1 ? "" : "es"}.`;
    if (metrics.activationPercent < 20 && metrics.nearActiveBranches === 0 && metrics.premium > 0) return "Build branch activation pipeline.";
    if (metrics.activationPercent >= 40 && metrics.observedBranches > metrics.activeBranches) return "Protect active base and broaden productivity.";
    if (metrics.priority === "LOW") return "Maintain activation and scale productivity.";
    return "Strengthen branch activation and productivity.";
  }

  function qualityForBank(bank, audit, bankIndex, sourceBanks = [bank]) {
    const sourceSet = new Set(sourceBanks);
    const hierarchy = audit.hierarchyConflicts.filter((item) => sourceSet.has(item.bank));
    const universe = audit.branchUniverseSanity.filter((item) => sourceSet.has(item.bank) && item.exceeded);
    const baCodes = new Set((bankIndex.rms || []).map((item) => item.code));
    const products = new Set((bankIndex.branches || []).flatMap((branch) => [...branch.productCodes]));
    const identity = audit.baCodeConflicts.filter((item) => baCodes.has(item.key));
    const product = audit.productConflicts.filter((item) => products.has(item.key));
    const unknown = sourceBanks.some((sourceBank) => audit.bankQuality.unknownBanks.includes(sourceBank));
    const errors = [...hierarchy.map((item) => `${item.branchKey}: multiple ${item.field} values`), ...universe.map(() => `${bank}: observed/active branches exceed configured universe`)];
    const warnings = [...identity.map((item) => `BA Code ${item.key}: multiple RM names`), ...product.map((item) => `Product Code ${item.key}: multiple names`), ...(unknown ? [`${bank}: no configured branch universe`] : [])];
    return { errors, warnings, hasError: errors.length > 0, flagLabel: errors.length ? `ERROR ${errors.length}` : warnings.length ? `WARNING ${warnings.length}` : "Clear" };
  }

  function legacyPartnerMetrics(derived, productivity, audit, selectedBank) {
    const configured = Object.keys(config.TOTAL_BRANCHES);
    const banks = selectedBank && selectedBank !== "ALL" ? [selectedBank] : [...new Set([...configured, ...Object.keys(derived.bankBranchMetrics)])];
    const totalPremium = derived.totalPremium;
    return banks.map((bank) => {
      const source = derived.bankBranchMetrics[bank] || { premium: 0, observed: 0, active: 0, nearActive: 0 };
      const index = productivity.bankIndexes[bank] || { rms: [], imds: [], branches: [], opportunities: [] };
      const universeAuthority = global.BancaTrackerLiveBranchUniverseAuthority;
      const branchUniverse = universeAuthority
        ? universeAuthority.getBankUniverse(bank)
        : config.TOTAL_BRANCHES[bank] || null;
      const activationPercent = branchUniverse ? (source.active / branchUniverse) * 100 : 0;
      const aggregateActivationGap = index.opportunities.reduce((sum, branch) => sum + branch.gap, 0);
      const quality = qualityForBank(bank, audit, index);
      const metric = { bank, premium: source.premium, contributionPercent: totalPremium > 0 ? (source.premium / totalPremium) * 100 : 0, observedBranches: source.observed, activeBranches: source.active, nearActiveBranches: source.nearActive, branchUniverse, activationPercent, aggregateActivationGap, observedBaCodes: index.rms.length, observedImds: index.imds.length, dataQualityError: quality.hasError, dataQuality: quality };
      metric.priority = classifyPriority(metric); metric.cue = managementCue(metric); return metric;
    }).sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || b.premium - a.premium || a.bank.localeCompare(b.bank));
  }

  function managementGroups(derived, selectedBank) {
    const authority = global.BancaTrackerManagementBank;
    const groups = new Map();
    function ensure(key, bank, status) {
      if (!groups.has(key)) groups.set(key, { key, bank, status, sourceBanks: new Set() });
      return groups.get(key);
    }
    Object.keys(config.TOTAL_BRANCHES).forEach((sourceBank) => {
      const resolved = authority.resolve(sourceBank);
      if (resolved.managementBank) ensure(resolved.managementBank, resolved.managementBank, resolved.status).sourceBanks.add(sourceBank);
    });
    (derived.data || []).forEach((fact) => {
      const resolved = authority.resolve(fact.bank);
      const key = resolved.managementBank || `UNMAPPED:${String(fact.bank)}`;
      const group = ensure(key, resolved.managementBank || fact.bank || "Unknown", resolved.status);
      group.sourceBanks.add(fact.bank);
    });
    if (selectedBank && selectedBank !== "ALL") {
      const selected = authority.resolve(selectedBank);
      const selectedKey = selected.managementBank || `UNMAPPED:${selectedBank}`;
      const existing = groups.get(selectedKey) || ensure(selectedKey, selected.managementBank || selectedBank, selected.status);
      existing.sourceBanks.add(selectedBank);
      return [existing];
    }
    return [...groups.values()];
  }

  function buildManagementBankOptions(facts) {
    const authority = global.BancaTrackerManagementBank;
    if (!authority || typeof authority.resolve !== "function") return [];
    const banks = new Set();
    [...Object.keys(config.TOTAL_BRANCHES), ...(facts || []).map((fact) => fact.bank)].forEach((sourceBank) => {
      const resolved = authority.resolve(sourceBank);
      if (resolved.managementBank) banks.add(resolved.managementBank);
    });
    return [...banks].sort((left, right) => left.localeCompare(right));
  }

  function populateManagementBankFilter(facts) {
    const control = document.getElementById("managementBankFilter");
    if (!control) return;
    const options = buildManagementBankOptions(facts);
    if (uiState.managementBankFilter !== "ALL" && !options.includes(uiState.managementBankFilter)) uiState.managementBankFilter = "ALL";
    control.innerHTML = `<option value="ALL">All Management Banks</option>${options.map((bank) => `<option value="${html(bank)}">${html(bank)}</option>`).join("")}`;
    control.value = uiState.managementBankFilter;
  }

  function managementContext(core, fallbackContext) {
    const allFacts = Array.isArray(core.factData) ? core.factData : null;
    const authority = global.BancaTrackerManagementBank;
    if (!allFacts || !authority || !global.BancaTrackerAnalytics || !global.BancaTrackerProductivity) return null;
    const selectedMonth = core.filters && core.filters.month || fallbackContext.selectedMonth || "ALL";
    const availableFiscalMonths = config.FISCAL_MONTHS.filter((month) => allFacts.some((fact) => fact.month === month));
    const latestFiscalMonth = availableFiscalMonths[availableFiscalMonths.length - 1] || "";
    const currentPeriodMonth = selectedMonth === "ALL" ? latestFiscalMonth : selectedMonth;
    const progressionMonth = selectedMonth === "ALL" ? latestFiscalMonth : config.FISCAL_MONTHS.includes(selectedMonth) ? selectedMonth : "";
    const progressionIndex = config.FISCAL_MONTHS.indexOf(progressionMonth);
    const currentAtomic = allFacts.filter((fact) => fact.month === currentPeriodMonth);
    const ytdAtomic = progressionIndex < 0 ? [] : allFacts.filter((fact) => config.FISCAL_MONTHS.slice(0, progressionIndex + 1).includes(fact.month));
    const selected = uiState.managementBankFilter;
    const currentPeriodData = selected === "ALL" ? currentAtomic.slice() : authority.filterFacts(currentAtomic, selected);
    const ytdData = selected === "ALL" ? ytdAtomic.slice() : authority.filterFacts(ytdAtomic, selected);
    const ytdPremiumByBank = {};
    ytdData.forEach((fact) => { ytdPremiumByBank[fact.bank] = (ytdPremiumByBank[fact.bank] || 0) + (Number(fact.premium) || 0); });
    const currentPeriodKeys = new Set(currentPeriodData.map((fact) => fact.monthKey).filter((key) => typeof key === "string" && /^\d{4}-\d{2}$/.test(key)));
    const context = {
      ...fallbackContext, selectedMonth, currentPeriodMonth, latestFiscalMonth, progressionMonth,
      elapsedMonths: progressionIndex < 0 ? null : progressionIndex + 1,
      currentPeriodData, viewData: currentPeriodData, ytdData, ytdPremiumByBank,
      ytdPremium: ytdData.reduce((sum, fact) => sum + (Number(fact.premium) || 0), 0),
      mtdPremium: currentPeriodData.reduce((sum, fact) => sum + (Number(fact.premium) || 0), 0),
      currentPeriodKey: currentPeriodKeys.size === 1 ? [...currentPeriodKeys][0] : null,
      currentPeriodIsUnconfigured: Boolean(currentPeriodMonth && !config.FISCAL_MONTHS.includes(currentPeriodMonth)),
    };
    const derived = global.BancaTrackerAnalytics.build(currentPeriodData);
    const productivity = global.BancaTrackerProductivity.build(context, derived, core.dataQuality);
    return { context, derived, productivity };
  }

  function mergeBankIndex(productivity, sourceBanks) {
    const merged = { rms: [], imds: [], branches: [], opportunities: [] };
    sourceBanks.forEach((sourceBank) => {
      const index = productivity.bankIndexes[sourceBank];
      if (!index) return;
      Object.keys(merged).forEach((field) => { merged[field].push(...(index[field] || [])); });
    });
    return merged;
  }

  function buildPartnerMetrics(derived, productivity, audit, selectedBank, context = null) {
    const authority = global.BancaTrackerManagementBank;
    if (!authority || typeof authority.resolve !== "function" || !Array.isArray(derived.data)) {
      return legacyPartnerMetrics(derived, productivity, audit, selectedBank);
    }
    const totalPremium = derived.totalPremium;
    return managementGroups(derived, selectedBank).map((group) => {
      const sourceBanks = [...group.sourceBanks];
      const source = sourceBanks.reduce((result, sourceBank) => {
        const metric = derived.bankBranchMetrics[sourceBank] || {};
        result.premium += Number(metric.premium) || 0;
        result.observed += Number(metric.observed) || 0;
        result.active += Number(metric.active) || 0;
        result.nearActive += Number(metric.nearActive) || 0;
        return result;
      }, { premium: 0, observed: 0, active: 0, nearActive: 0 });
      const index = mergeBankIndex(productivity, sourceBanks);
      const universeAuthority = global.BancaTrackerLiveBranchUniverseAuthority;
      const branchUniverse = group.status === "UNMAPPED"
        ? null
        : universeAuthority ? universeAuthority.getBankUniverse(group.bank) : config.TOTAL_BRANCHES[group.bank] || null;
      const activationPercent = branchUniverse ? source.active / branchUniverse * 100 : 0;
      const aggregateActivationGap = index.opportunities.reduce((sum, branch) => sum + branch.gap, 0);
      const quality = qualityForBank(group.bank, audit, index, sourceBanks);
      const ytdPremium = sourceBanks.reduce((sum, sourceBank) => sum + (Number(productivity.ytdPremiumByBank && productivity.ytdPremiumByBank[sourceBank]) || 0), 0);
      const target = context && global.BancaTrackerTarget && typeof global.BancaTrackerTarget.calculateTargetForBank === "function"
        ? global.BancaTrackerTarget.calculateTargetForBank(context, group.bank, ytdPremium)
        : null;
      const metric = {
        bank: group.bank, sourceBanks, managementBankStatus: group.status,
        premium: source.premium, contributionPercent: totalPremium > 0 ? source.premium / totalPremium * 100 : 0,
        observedBranches: source.observed, activeBranches: source.active, nearActiveBranches: source.nearActive,
        branchUniverse, activationPercent, aggregateActivationGap,
        observedBaCodes: index.rms.length, observedImds: index.imds.length,
        dataQualityError: quality.hasError, dataQuality: quality,
        managementIndex: index, target,
        budget: target ? target.annualTarget : null,
        achievementPercent: target ? target.achievement : null,
      };
      metric.priority = classifyPriority(metric); metric.cue = managementCue(metric); return metric;
    }).sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || b.premium - a.premium || a.bank.localeCompare(b.bank));
  }

  function buildExceptions(metrics, productivity) {
    const exceptions = [];
    metrics.forEach((bank) => { if (bank.dataQualityError) exceptions.push({ severity: "ERROR", label: bank.bank, message: "Data Quality ERROR requires resolution." }); if (bank.priority === "CRITICAL" || bank.priority === "HIGH") exceptions.push({ severity: bank.priority === "CRITICAL" ? "ERROR" : "WARNING", label: bank.bank, message: `${bank.priority} commercial priority.` }); });
    productivity.rmMetrics.filter((item) => item.nearActiveBranches > 1).forEach((item) => exceptions.push({ severity: "WARNING", label: `${item.bank} / ${item.code}`, message: `${item.nearActiveBranches} near-active RM branches.` }));
    productivity.imdMetrics.filter((item) => item.nearActiveBranches > 1).forEach((item) => exceptions.push({ severity: "WARNING", label: `${item.bank} / ${item.code}`, message: `${item.nearActiveBranches} near-active IMD branches.` }));
    productivity.opportunities.filter((branch) => branch.gap <= config.MANAGEMENT.SMALL_ACTIVATION_GAP).forEach((branch) => exceptions.push({ severity: "INFO", label: `${branch.bank} / ${branch.branch}`, message: `Immediate opportunity: ${utils.formatRupees(branch.gap)} gap.` }));
    return exceptions;
  }

  function buildBankDetail(bank, model) {
    const metric = model.metrics.find((item) => item.bank === bank); if (!metric) return null;
    const index = metric.managementIndex || model.productivity.bankIndexes[bank] || { rms: [], imds: [], branches: [], opportunities: [] };
    const zoneConcentration = global.BancaTrackerProductivity.concentration(index.opportunities, (branch) => branch.zoneLabel, "Zone");
    const stateConcentration = global.BancaTrackerProductivity.concentration(index.opportunities, (branch) => branch.stateLabel, "State");
    const ytdPremium = (metric.sourceBanks || [bank]).reduce((sum, sourceBank) => sum + (Number(model.productivity.ytdPremiumByBank[sourceBank]) || 0), 0);
    const target = metric.target || global.BancaTrackerTarget.calculateTargetForBank(model.context, bank, ytdPremium);
    return { metric, index, zoneConcentration, stateConcentration, target, quality: metric.dataQuality };
  }

  const html = (value) => utils.escapeHtml(value); const amount = (value) => utils.formatRupees(value); const encoded = (value) => encodeURIComponent(value);
  const badge = (value) => `<span class='priority priority-${value.toLowerCase().replace(" ", "-")}'>${value}</span>`;
  function renderSummary(metrics) { const count = (priority) => metrics.filter((bank) => bank.priority === priority).length; const near = metrics.reduce((sum, bank) => sum + bank.nearActiveBranches, 0); const gap = metrics.reduce((sum, bank) => sum + bank.aggregateActivationGap, 0); const cards = [["Total Partner Banks", metrics.length], ["Critical", count("CRITICAL")], ["High", count("HIGH")], ["Medium", count("MEDIUM")], ["Near Active", near], ["Aggregate Activation Gap", amount(gap)]]; document.getElementById("scorecardSummary").innerHTML = cards.map(([label, value]) => `<div class='card'><div>${label}</div><div class='value'>${value}</div></div>`).join(""); }
  function renderScorecard(metrics) { const authority = global.BancaTrackerLiveBranchUniverseAuthority; const authorityLabel = authority && authority.getAuthorityStatus() === "GOVERNED" ? "governed eligible Branch Master universe" : "legacy configured branch universe"; const rows = metrics.map((bank) => `<tr class='management-bank-row'><td><button class='management-link' data-bank='${encoded(bank.bank)}'>${html(bank.bank)}</button></td><td>${amount(bank.premium)}</td><td>${bank.contributionPercent.toFixed(1)}%</td><td>${bank.observedBranches}</td><td>${bank.activeBranches}</td><td>${bank.branchUniverse === null ? "Not configured" : bank.branchUniverse}</td><td>${bank.branchUniverse ? `${bank.activationPercent.toFixed(1)}%` : "N/A"}</td><td>${bank.nearActiveBranches}</td><td>${amount(bank.aggregateActivationGap)}</td><td>${bank.observedBaCodes}</td><td>${bank.observedImds}</td><td>${html(bank.dataQuality.flagLabel)}</td><td>${badge(bank.priority)}</td></tr>`).join(""); document.getElementById("partnerScorecard").innerHTML = `<p class='scorecard-note'>All commercial metrics use CURRENT PERIOD. Activation uses Active Branches ÷ ${authorityLabel}. Select a Partner Bank to drill down.</p><table><thead><tr><th>Partner Bank</th><th>Current Period Premium</th><th>Contribution %</th><th>Observed Branches</th><th>Active</th><th>Branch Universe</th><th>Activation %</th><th>Near Active</th><th>Aggregate Activation Gap</th><th>BA Codes</th><th>IMDs</th><th>Data Quality</th><th>Priority</th></tr></thead><tbody>${rows}</tbody></table>`; }
  function renderActions(metrics) { document.getElementById("managementActions").innerHTML = metrics.filter((bank) => bank.priority !== "NO DATA").map((bank) => `<div class='metric'><strong>${html(bank.bank)} — ${bank.priority}</strong><br>${html(bank.cue)}</div>`).join("") || "<p class='empty-state'>No current-period management actions.</p>"; }
  function renderExceptions(exceptions) { const limit = config.RENDER_LIMITS.MANAGEMENT_EXCEPTIONS; const note = exceptions.length > limit ? `<p class='table-limit-note'>Showing ${limit} of ${utils.formatInr(exceptions.length)} exceptions.</p>` : ""; document.getElementById("managementExceptions").innerHTML = exceptions.length ? note + exceptions.slice(0, limit).map((item) => `<div class='metric'>${item.severity === "ERROR" ? "<span class='quality-severity quality-error'>ERROR</span>" : item.severity === "WARNING" ? "<span class='quality-severity quality-warning'>WARNING</span>" : "<span class='quality-severity quality-info'>INFO</span>"} <strong>${html(item.label)}</strong> — ${html(item.message)}</div>`).join("") : "<p class='empty-state'>No high-value management exceptions in the current period.</p>"; }
  function opportunityRows(items) { return items.length ? `<table><thead><tr><th>Branch</th><th>Zone</th><th>State</th><th>BA Code / RM</th><th>IMD</th><th>Premium</th><th>Gap</th><th>LOB</th><th>Products</th><th>Mapping / Cue</th></tr></thead><tbody>${items.slice(0, 100).map((branch) => `<tr><td>${html(branch.branch)}</td><td>${html(branch.zoneLabel)}</td><td>${html(branch.stateLabel)}</td><td>${html(`${branch.baCodeLabel} / ${branch.rmLabel}`)}</td><td>${html(branch.imdLabel)}</td><td>${amount(branch.premium)}</td><td>${amount(branch.gap)}</td><td>${branch.lobBreadth}</td><td>${branch.productBreadth}</td><td>${html([branch.hierarchyConflict ? "Hierarchy conflict" : "", branch.productMappingConflict ? "Product mapping conflict" : "", branch.cue].filter(Boolean).join("; ") || "—")}</td></tr>`).join("")}</tbody></table>` : "<p class='empty-state'>No near-active branches.</p>"; }
  function concentrationTable(items) { return items.length ? `<table><thead><tr><th>Group</th><th>Near Active</th><th>Aggregate Gap</th></tr></thead><tbody>${items.slice(0, 50).map((item) => `<tr><td>${html(item.name)}</td><td>${item.nearActiveBranches}</td><td>${amount(item.aggregateGap)}</td></tr>`).join("")}</tbody></table>` : "<p class='empty-state'>No near-active concentration.</p>"; }
  function targetHtml(target) { if (target.annualTarget === null) return "<p class='empty-state'>No bank-specific target set.</p>"; const value = (number) => number == null ? "Not available" : `₹${number.toFixed(2)} Cr`; return `<div class='management-summary'><div><strong>YTD Actual</strong><br>${value(target.actual)}</div><div><strong>YTD Target</strong><br>${value(target.ytdTarget)}</div><div><strong>Achievement</strong><br>${target.achievement == null ? "Undefined" : `${target.achievement.toFixed(1)}%`}</div><div><strong>Gap</strong><br>${value(target.gap)}</div></div>`; }
  function entityButtons(items, kind) { if (!items.length) return "<p class='empty-state'>No mapped entities.</p>"; return `<table><thead><tr><th>${kind === "rm" ? "BA Code / RM" : "IMD Code"}</th><th>Premium</th><th>Observed</th><th>Active</th><th>Near Active</th><th>Aggregate Gap</th></tr></thead><tbody>${items.slice(0, 20).map((item) => `<tr><td><button class='management-link' data-${kind}='${encoded(item.key)}'>${html(kind === "rm" ? `${item.code} / ${item.name}` : item.code)}</button></td><td>${amount(item.premium)}</td><td>${item.observedBranches}</td><td>${item.activeBranches}</td><td>${item.nearActiveBranches}</td><td>${amount(item.aggregateActivationGap)}</td></tr>`).join("")}</tbody></table>`; }
  function renderEntityDetail(detail, kind) { const key = kind === "rm" ? uiState.selectedRmKey : uiState.selectedImdKey; if (!key) return ""; const items = kind === "rm" ? detail.index.rms : detail.index.imds; const entity = items.find((item) => item.key === key); if (!entity) return ""; const opportunities = detail.index.opportunities.filter((branch) => kind === "rm" ? branch.baCodes.has(entity.code) : branch.imds.has(entity.code)); return `<div class='panel management-subdetail'><h4>${kind === "rm" ? `RM / BA Code: ${html(entity.code)} / ${html(entity.name)}` : `IMD: ${html(entity.code)}`}</h4><div class='management-summary'><div><strong>Premium</strong><br>${amount(entity.premium)}</div><div><strong>Observed Branches</strong><br>${entity.observedBranches}</div><div><strong>Active</strong><br>${entity.activeBranches}</div><div><strong>Near Active</strong><br>${entity.nearActiveBranches}</div><div><strong>Aggregate Gap</strong><br>${amount(entity.aggregateActivationGap)}</div>${kind === "rm" ? `<div><strong>LOB / Product Breadth</strong><br>${entity.lobBreadth} / ${entity.productBreadth}</div>` : ""}</div><h4>Near Active Branches</h4>${opportunityRows(opportunities)}</div>`; }
  function renderDetail() { const container = document.getElementById("managementDetail"); if (!lastModel || !uiState.selectedBank) { container.innerHTML = "<p class='empty-state'>Select a Partner Bank from the scorecard.</p>"; return; } const detail = buildBankDetail(uiState.selectedBank, lastModel); if (!detail) { container.innerHTML = "<p class='empty-state'>No detail available for the selected bank.</p>"; return; } const m = detail.metric; const qualityItems = [...detail.quality.errors.map((message) => `<li><span class='quality-severity quality-error'>ERROR</span> ${html(message)}</li>`), ...detail.quality.warnings.map((message) => `<li><span class='quality-severity quality-warning'>WARNING</span> ${html(message)}</li>`)]; container.innerHTML = `<h3>${html(m.bank)} Management Detail</h3><p class='scorecard-note'>Scorecard → Partner → RM/IMD → Branch Opportunity. Local selections do not change global filters.</p><div class='management-summary'><div><strong>Current Premium</strong><br>${amount(m.premium)}</div><div><strong>Observed / Active</strong><br>${m.observedBranches} / ${m.activeBranches}</div><div><strong>Activation</strong><br>${m.branchUniverse ? `${m.activationPercent.toFixed(1)}%` : "N/A"}</div><div><strong>Near Active</strong><br>${m.nearActiveBranches}</div><div><strong>Aggregate Gap</strong><br>${amount(m.aggregateActivationGap)}</div><div><strong>Priority</strong><br>${badge(m.priority)}</div></div><h4>Target Context</h4>${targetHtml(detail.target)}<div class='grid'><div><h4>Top RM / BA Code</h4>${entityButtons(detail.index.rms, "rm")}</div><div><h4>Top IMD</h4>${entityButtons(detail.index.imds, "imd")}</div></div>${renderEntityDetail(detail, "rm")}${renderEntityDetail(detail, "imd")}<h4>Near Active Branch Opportunities</h4>${opportunityRows(detail.index.opportunities)}<div class='grid'><div><h4>Zone Opportunity Concentration</h4>${concentrationTable(detail.zoneConcentration)}</div><div><h4>State Opportunity Concentration</h4>${concentrationTable(detail.stateConcentration)}</div></div><h4>Relevant Data Quality</h4>${qualityItems.length ? `<ul>${qualityItems.join("")}</ul>` : "<p class='empty-state'>No relevant cached Data Quality conflicts.</p>"}`; }

  function refreshScorecard(suppliedDerived) { const core = global.BancaTrackerCore.state; const fallbackContext = global.BancaTrackerCore.getPerformanceContext(); populateManagementBankFilter(core.factData || suppliedDerived.data || []); const scoped = managementContext(core, fallbackContext); const context = scoped ? scoped.context : fallbackContext; const derived = scoped ? scoped.derived : suppliedDerived; const productivity = scoped ? scoped.productivity : core.productivity; const audit = core.dataQuality; const selected = scoped ? uiState.managementBankFilter : core.filters.bank; const metrics = buildPartnerMetrics(derived, productivity, audit, selected, context); const exceptions = buildExceptions(metrics, productivity); lastModel = { metrics, productivity, audit, context, derived }; if (selected !== "ALL") uiState.selectedBank = selected; else if (!metrics.some((item) => item.bank === uiState.selectedBank)) uiState.selectedBank = metrics[0] ? metrics[0].bank : null; if (uiState.selectedBank && !metrics.some((item) => item.bank === uiState.selectedBank)) uiState.selectedBank = null; uiState.selectedRmKey = null; uiState.selectedImdKey = null; document.getElementById("scorecardScope").textContent = `Operational scorecard period: ${context.currentPeriodMonth || "No configured fiscal month available"}; Management Bank: ${selected}. Premium, activation, near-active opportunities and aggregate gaps use the isolated Management scope. Priorities are deterministic rules, not predictions.${context.currentPeriodIsUnconfigured ? " The selected month is unconfigured and is excluded from fiscal YTD and target progression." : ""}`; renderSummary(metrics); renderScorecard(metrics); renderActions(metrics); renderExceptions(exceptions); renderDetail(); }
  function selectManagementBank(bank) { uiState.managementBankFilter = bank || "ALL"; const core = global.BancaTrackerCore && global.BancaTrackerCore.state; if (core) refreshScorecard(core.derived); }
  function selectBank(bank) { uiState.selectedBank = bank; uiState.selectedRmKey = null; uiState.selectedImdKey = null; renderDetail(); }
  function selectRm(key) { uiState.selectedRmKey = key; uiState.selectedImdKey = null; renderDetail(); }
  function selectImd(key) { uiState.selectedImdKey = key; uiState.selectedRmKey = null; renderDetail(); }
  document.getElementById("partnerScorecard").addEventListener("click", (event) => { const button = event.target.closest && event.target.closest("[data-bank]"); if (button) selectBank(decodeURIComponent(button.dataset.bank)); });
  document.getElementById("managementDetail").addEventListener("click", (event) => { const rm = event.target.closest && event.target.closest("[data-rm]"); const imd = event.target.closest && event.target.closest("[data-imd]"); if (rm) selectRm(decodeURIComponent(rm.dataset.rm)); else if (imd) selectImd(decodeURIComponent(imd.dataset.imd)); });
  const managementFilter = document.getElementById("managementBankFilter"); if (managementFilter) managementFilter.addEventListener("change", function () { selectManagementBank(this.value); });
  global.BancaTrackerScorecard = Object.freeze({ buildPartnerMetrics, buildManagementBankOptions, managementContext, classifyPriority, managementCue, buildExceptions, buildBankDetail, refreshScorecard, selectManagementBank, selectBank, selectRm, selectImd, uiState }); global.refreshScorecard = refreshScorecard;
})(window);
