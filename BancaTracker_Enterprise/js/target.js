/* Phase 5 Target Management. Core owns data and filters; this module owns targets and target calculations. */
(function (global) {
  const config = global.BancaTrackerConfig;
  const utils = global.BancaTrackerUtils;
  const CRORE = 10000000;
  const STORAGE_KEY = "bancaTrackerV8Targets";
  const targetState = { fiscalYearTarget: null, monthlyTarget: null, bankTargets: {} };

  function loadTargets() {
    try {
      const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "null");
      if (saved && isValidTarget(saved.fiscalYearTarget)) setOverallTarget(Number(saved.fiscalYearTarget));
      if (saved && saved.bankTargets) Object.entries(saved.bankTargets).forEach(([bank, value]) => {
        if (isValidTarget(value)) targetState.bankTargets[bank] = Number(value);
      });
    } catch (error) { /* Session storage is optional. */ }
  }

  function persistTargets() {
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(targetState)); } catch (error) { /* Keep in memory. */ }
  }

  function isValidTarget(value) {
    return value !== "" && value !== null && Number.isFinite(Number(value)) && Number(value) >= 0;
  }

  function setOverallTarget(value) {
    targetState.fiscalYearTarget = Number(value);
    targetState.monthlyTarget = Number(value) / 12;
  }

  function elapsedMonths(selectedMonth, latestFiscalMonth) {
    if (selectedMonth === "ALL") {
      const latestIndex = config.FISCAL_MONTHS.indexOf(latestFiscalMonth);
      return latestIndex >= 0 ? latestIndex + 1 : null;
    }
    const index = config.FISCAL_MONTHS.indexOf(selectedMonth);
    return index >= 0 ? index + 1 : null;
  }

  function calculateTarget(context) {
    const bank = global.BancaTrackerCore.state.filters.bank;
    return calculateTargetForBank(context, bank, context.ytdPremium);
  }

  function unavailableSeasonality(status, diagnostics) {
    return {
      status,
      diagnostics: diagnostics || [],
      datasetId: null,
      datasetVersion: null,
      weightsByMonth: null,
      fiscalMonths: [],
    };
  }

  function resolveSeasonality(context, bank) {
    const match = /^([0-9]{4})-(0[1-9]|1[0-2])$/.exec(context && context.currentPeriodKey);
    const dateResolver = global.BancaTrackerDateResolver;
    if (!match || !dateResolver || typeof dateResolver.deriveFinancialYear !== "function") {
      return unavailableSeasonality("UNAVAILABLE", ["TARGET_SEASONALITY_PERIOD_UNAVAILABLE"]);
    }

    const fiscalYear = dateResolver.deriveFinancialYear(Number(match[1]), Number(match[2]));
    if (!fiscalYear) return unavailableSeasonality("UNAVAILABLE", ["TARGET_SEASONALITY_FY_UNAVAILABLE"]);

    const liveAuthority = global.BancaTrackerLiveTargetSeasonalityAuthority;
    const resolver = global.BancaTrackerTargetSeasonality;
    if (!liveAuthority || typeof liveAuthority.getCachedContext !== "function" || !resolver || typeof resolver.resolve !== "function") {
      return unavailableSeasonality("UNAVAILABLE", ["TARGET_SEASONALITY_AUTHORITY_UNAVAILABLE"]);
    }

    const cached = liveAuthority.getCachedContext();
    if (!cached || cached.status === "NOT_LOADED" || cached.status === "LOAD_FAILED") {
      return unavailableSeasonality(cached ? cached.status : "UNAVAILABLE", cached && cached.diagnostics);
    }
    if (cached.status !== "ABSENT" && cached.status !== "READY") {
      return unavailableSeasonality("UNAVAILABLE", cached.diagnostics);
    }

    const resolvedBank = bank === "ALL" ? null : utils.normalizeBank(bank);
    const resolved = resolver.resolve({
      records: cached.status === "ABSENT" ? [] : cached.records,
      fiscalYear,
      ...(resolvedBank ? { bank: resolvedBank } : {}),
    });
    const dataset = cached.dataset || null;
    return {
      status: resolved.status,
      diagnostics: resolved.diagnostics,
      datasetId: dataset && dataset.datasetId || null,
      datasetVersion: dataset && dataset.datasetVersion || null,
      weightsByMonth: resolved.weightsByMonth,
      fiscalMonths: resolved.diagnostics.expectedFiscalMonths,
    };
  }

  function resolvedTargets(annualTarget, seasonality, currentPeriodKey) {
    const validStatus = ["GOVERNED_BANK", "GOVERNED_OVERALL", "EQUAL_MONTH_FALLBACK"].includes(seasonality.status);
    const fiscalMonths = seasonality.fiscalMonths || [];
    const currentIndex = fiscalMonths.indexOf(currentPeriodKey);
    if (annualTarget === null || !validStatus || currentIndex < 0 || !seasonality.weightsByMonth) {
      return { currentMonthTarget: null, ytdTarget: null, monthlyTargetsByMonth: null };
    }

    const monthlyTargetsByMonth = {};
    let cumulativeWeight = 0;
    for (let index = 0; index < fiscalMonths.length; index += 1) {
      const month = fiscalMonths[index];
      const weight = seasonality.weightsByMonth[month];
      if (!Number.isFinite(weight)) return { currentMonthTarget: null, ytdTarget: null, monthlyTargetsByMonth: null };
      monthlyTargetsByMonth[month] = annualTarget * weight;
      if (index <= currentIndex) cumulativeWeight += weight;
    }
    return {
      currentMonthTarget: monthlyTargetsByMonth[currentPeriodKey],
      ytdTarget: annualTarget * cumulativeWeight,
      monthlyTargetsByMonth,
    };
  }

  function calculateTargetForBank(context, bank, ytdPremium) {
    const annualTarget = bank === "ALL" ? targetState.fiscalYearTarget : (Object.prototype.hasOwnProperty.call(targetState.bankTargets, bank) ? targetState.bankTargets[bank] : null);
    const elapsed = context.elapsedMonths == null ? elapsedMonths(context.selectedMonth, context.latestFiscalMonth) : context.elapsedMonths;
    const actual = Number(ytdPremium || 0) / CRORE;
    const seasonality = resolveSeasonality(context, bank);
    const allocation = resolvedTargets(annualTarget, seasonality, context.currentPeriodKey);
    const ytdTarget = allocation.ytdTarget;
    const achievement = ytdTarget > 0 ? (actual / ytdTarget) * 100 : null;
    const gap = ytdTarget === null ? null : ytdTarget - actual;
    const remainingMonths = elapsed === null ? null : 12 - elapsed;
    let rrr = null;
    let rrrLabel = "Target not set";
    if (annualTarget !== null && elapsed !== null) {
      const remainingTarget = annualTarget - actual;
      if (remainingTarget <= 0) rrrLabel = "Target achieved";
      else if (remainingMonths === 0 && context.progressionMonth === config.FISCAL_MONTHS[11]) rrrLabel = "FY Complete";
      else { rrr = remainingTarget / remainingMonths; rrrLabel = `${formatCrore(rrr)}/month`; }
    }
    return {
      bank, annualTarget, elapsed, actual, ytdTarget, achievement, gap, remainingMonths, rrr, rrrLabel,
      currentMonthTarget: allocation.currentMonthTarget,
      monthlyTargetsByMonth: allocation.monthlyTargetsByMonth,
      seasonality,
    };
  }

  function formatCrore(value) {
    return `₹${Number(value).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Cr`;
  }

  function achievementLabel(value) {
    return value === null ? "Undefined" : `${value.toFixed(1)}%`;
  }

  function interpretation(value) {
    if (value === null) return "Set a positive target to calculate achievement.";
    if (value >= 100) return "Target achieved";
    if (value >= 90) return "On track";
    if (value >= 75) return "Monitor closely";
    return "Recovery required";
  }

  function populateTargetBanks() {
    const select = document.getElementById("targetBank");
    const current = select.value;
    const banks = [...new Set([...Object.keys(config.TOTAL_BRANCHES), ...global.BancaTrackerCore.state.banks].filter((bank) => bank && bank !== "Unknown"))].sort();
    select.innerHTML = banks.map((bank) => `<option value="${utils.escapeHtml(bank)}">${utils.escapeHtml(bank)}</option>`).join("");
    if (banks.includes(current)) select.value = current;
    syncBankInput();
  }

  function monthlyRows(context, result) {
    const totals = context.bankMonthlyPremium;
    const fiscalMonths = result.seasonality.fiscalMonths || [];
    return config.FISCAL_MONTHS.map((month, index) => {
      const actual = (totals[month] || 0) / CRORE;
      const monthTarget = result.monthlyTargetsByMonth === null ? null : result.monthlyTargetsByMonth[fiscalMonths[index]];
      const achieved = monthTarget > 0 ? (actual / monthTarget) * 100 : null;
      const selected = context.selectedMonth === month ? " class='target-selected-month'" : "";
      return `<tr${selected}><td>${utils.escapeHtml(month)}</td><td>${monthTarget === null ? "Not set" : formatCrore(monthTarget)}</td><td>${formatCrore(actual)}</td><td>${monthTarget === null ? "Not set" : achievementLabel(achieved)}</td></tr>`;
    }).join("");
  }

  function refreshTarget(context) {
    populateTargetBanks();
    const result = calculateTarget(context);
    const noTarget = result.annualTarget === null;
    const targetText = noTarget ? (result.bank === "ALL" ? "Not set" : "No bank-specific target set") : formatCrore(result.annualTarget);
    const gapText = result.gap === null ? "Not available" : result.gap < 0 ? `Ahead by ${formatCrore(Math.abs(result.gap))}` : formatCrore(result.gap);
    const cards = [
      ["FY Target", targetText],
      ["YTD Target", result.ytdTarget === null ? "Not available" : formatCrore(result.ytdTarget)],
      ["YTD Actual", formatCrore(result.actual)],
      ["Achievement %", noTarget ? "Not available" : achievementLabel(result.achievement)],
      ["Gap", gapText],
      ["RRR", result.rrrLabel]
    ];
    document.getElementById("targetKpis").innerHTML = cards.map(([label, value]) => `<div class='card'><div>${label}</div><div class='value'>${value}</div></div>`).join("");
    document.getElementById("targetProgress").innerHTML = `<table><thead><tr><th>Month</th><th>Target</th><th>Actual</th><th>Achievement %</th></tr></thead><tbody>${monthlyRows(context, result)}</tbody></table>`;
    document.getElementById("targetProgressNote").textContent = result.elapsed === null ? `${context.selectedMonth} is not a configured fiscal progression point and is excluded from YTD target progression.` : (result.annualTarget === 0 ? "A zero target is valid, but achievement is undefined." : `YTD uses ${result.elapsed} configured fiscal month${result.elapsed === 1 ? "" : "s"} through ${context.progressionMonth}; ${result.remainingMonths} month${result.remainingMonths === 1 ? "" : "s"} remain. Monthly targets use an equal 1/12 allocation.`);
    document.getElementById("targetInterpretation").innerHTML = `<div class='target-interpretation'>${utils.escapeHtml(interpretation(result.achievement))}</div><p class='target-note'>Descriptive indicator based on YTD achievement; it is not predictive.</p>`;
  }

  function showConfigStatus(message, isError) {
    const element = document.getElementById("targetConfigStatus");
    element.textContent = message;
    element.classList.toggle("target-note-error", Boolean(isError));
  }

  function syncBankInput() {
    const bank = document.getElementById("targetBank").value;
    document.getElementById("bankTarget").value = Object.prototype.hasOwnProperty.call(targetState.bankTargets, bank) ? targetState.bankTargets[bank] : "";
  }

  function saveOverall() {
    const value = document.getElementById("overallTarget").value;
    if (!isValidTarget(value)) return showConfigStatus("Enter a non-negative numeric overall target.", true);
    setOverallTarget(value);
    persistTargets();
    showConfigStatus("Overall FY target saved for this session.", false);
    global.BancaTrackerCore.refresh();
  }

  function saveBank() {
    const bank = document.getElementById("targetBank").value;
    const value = document.getElementById("bankTarget").value;
    if (!bank || !isValidTarget(value)) return showConfigStatus("Select a bank and enter a non-negative numeric target.", true);
    targetState.bankTargets[bank] = Number(value);
    persistTargets();
    showConfigStatus(`${bank} target saved for this session.`, false);
    global.BancaTrackerCore.refresh();
  }

  loadTargets();
  document.getElementById("overallTarget").value = targetState.fiscalYearTarget === null ? "" : targetState.fiscalYearTarget;
  document.getElementById("saveOverallTarget").addEventListener("click", saveOverall);
  document.getElementById("saveBankTarget").addEventListener("click", saveBank);
  document.getElementById("targetBank").addEventListener("change", syncBankInput);
  global.BancaTrackerTarget = Object.freeze({ targetState, elapsedMonths, calculateTarget, calculateTargetForBank, interpretation, isValidTarget });
  global.refreshTarget = refreshTarget;
})(window);
