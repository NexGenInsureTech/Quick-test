/* Application state, resilient CSV ingestion, central time scopes, filters, and refresh orchestration. */
(function (global) {
  const config = global.BancaTrackerConfig;
  const utils = global.BancaTrackerUtils;
  const emptyImportSummary = { totalRows: 0, acceptedRows: 0, rejectedRows: 0, warningRows: 0, negativePremiumRows: 0, rejectionReasons: {}, warningReasons: {}, unconfiguredMonths: [] };
  const state = { factData: [], filteredData: [], filters: { month: "ALL", bank: "ALL" }, activePage: "misPage", headerMap: {}, months: [], banks: [], importSummary: emptyImportSummary, dataQuality: global.BancaTrackerDataQuality.build([], config, emptyImportSummary), productivity: null, derived: null, context: null };
  function setStatus(message, isError) { const status = document.getElementById("status"); status.textContent = message; status.classList.toggle("status-error", Boolean(isError)); }
  function populateFilters() {
    const monthFilter = document.getElementById("monthFilter"); const bankFilter = document.getElementById("bankFilter");
    monthFilter.innerHTML = '<option value="ALL">All Months</option>'; state.months.forEach((month) => monthFilter.add(new Option(month, month)));
    bankFilter.innerHTML = '<option value="ALL">All Banks</option>'; state.banks.forEach((bank) => bankFilter.add(new Option(bank, bank)));
  }

  function renderImportSummary(summary) {
    const element = document.getElementById("importSummary"); if (!summary) { element.textContent = ""; return; }
    const reasons = [...Object.entries(summary.rejectionReasons), ...Object.entries(summary.warningReasons)].map(([reason, count]) => `${reason}: ${utils.formatInr(count)}`);
    if (summary.unconfiguredMonths && summary.unconfiguredMonths.length) reasons.push(`Unconfigured fiscal month label(s): ${summary.unconfiguredMonths.join(", ")} (excluded from YTD/target progression)`);
    if (summary.negativePremiumRows) reasons.push(`Negative premium rows: ${utils.formatInr(summary.negativePremiumRows)} (preserved; may represent cancellation/refund/adjustment and requires a future business rule)`);
    const qualityWarnings = (summary.warningRows || 0) + (summary.unconfiguredMonths && summary.unconfiguredMonths.length ? 1 : 0) + (summary.negativePremiumRows ? 1 : 0);
    element.textContent = `Import summary — Total: ${utils.formatInr(summary.totalRows)}; Accepted: ${utils.formatInr(summary.acceptedRows)}; Rejected: ${utils.formatInr(summary.rejectedRows)}; Data-quality warnings: ${utils.formatInr(qualityWarnings)}${reasons.length ? `. ${reasons.join("; ")}` : ""}`;
  }

  function buildContext() {
    const selectedMonth = state.filters.month; const selectedBank = state.filters.bank;
    const fullUploadData = selectedBank === "ALL" ? state.factData : [];
    const available = new Set(); const availableFiscal = new Set(); const bankMonthlyPremium = {}; const rowsByMonth = {};
    state.factData.forEach((row) => { if (selectedBank !== "ALL" && row.bank !== selectedBank) return; if (selectedBank !== "ALL") fullUploadData.push(row); available.add(row.month); if (config.FISCAL_MONTHS.includes(row.month)) availableFiscal.add(row.month); bankMonthlyPremium[row.month] = (bankMonthlyPremium[row.month] || 0) + row.premium; if (!rowsByMonth[row.month]) rowsByMonth[row.month] = []; rowsByMonth[row.month].push(row); });
    const availableMonths = utils.orderMonths([...available]);
    const availableFiscalMonths = config.FISCAL_MONTHS.filter((month) => availableFiscal.has(month));
    const latestFiscalMonth = availableFiscalMonths[availableFiscalMonths.length - 1] || "";
    const currentPeriodMonth = selectedMonth === "ALL" ? latestFiscalMonth : selectedMonth;
    const currentPeriodData = currentPeriodMonth ? (rowsByMonth[currentPeriodMonth] || []) : [];
    const progressionMonth = selectedMonth === "ALL" ? latestFiscalMonth : (config.FISCAL_MONTHS.includes(selectedMonth) ? selectedMonth : "");
    const progressionIndex = config.FISCAL_MONTHS.indexOf(progressionMonth);
    const ytdData = []; const ytdPremiumByBank = {}; let ytdPremium = 0;
    if (progressionIndex >= 0) config.FISCAL_MONTHS.slice(0, progressionIndex + 1).forEach((month) => { (rowsByMonth[month] || []).forEach((row) => { ytdData.push(row); ytdPremium += row.premium; ytdPremiumByBank[row.bank] = (ytdPremiumByBank[row.bank] || 0) + row.premium; }); });
    const mtdPremium = utils.premiumTotal(currentPeriodData); state.filteredData = currentPeriodData;
    return Object.freeze({ viewData: currentPeriodData, currentPeriodData, ytdData, fullUploadData, selectedMonth, currentPeriodMonth, currentPeriodIsUnconfigured: Boolean(currentPeriodMonth && !config.FISCAL_MONTHS.includes(currentPeriodMonth)), latestMonth: latestFiscalMonth, latestFiscalMonth, availableMonths, availableFiscalMonths, progressionMonth, elapsedMonths: progressionIndex < 0 ? null : progressionIndex + 1, ytdPremium, ytdPremiumByBank, mtdPremium, bankMonthlyPremium });
  }

  function safeRender(name, renderer, argument) { if (typeof renderer !== "function") return; try { renderer(argument); } catch (error) { console.error(`${name} render failed`, error); setStatus(`${name} could not render. Other pages remain available.`, true); } }
  function renderPage(pageId) { const context = state.context; if (!context) return; const renderers = { misPage: ["Performance MIS", global.renderPerformance, { ...context, derived: state.derived }], activationPage: ["Activation Cockpit", global.refreshActivation, state.derived], scorecardPage: ["Management Scorecard", global.refreshScorecard, state.derived], targetPage: ["Target & Growth", global.refreshTarget, { ...context, derived: state.derived }], productivityPage: ["Productivity & Opportunity", global.renderProductivity, state.productivity], qualityPage: ["Data Quality", global.renderDataQuality, state.dataQuality] }; const entry = renderers[pageId]; if (entry) safeRender(entry[0], entry[1], entry[2]); }
  function setActivePage(pageId) { state.activePage = pageId; renderPage(pageId); }
  function refresh() { const started = performance.now(); const context = buildContext(); const derived = global.BancaTrackerAnalytics.build(context.currentPeriodData); const productivity = global.BancaTrackerProductivity.build(context, derived, state.dataQuality); state.context = context; state.derived = derived; state.productivity = productivity; renderPage(state.activePage); return performance.now() - started; }

  function runShadowEnrichment(records) {
    Promise.resolve().then(() => {
      const shadow = global.BancaTrackerShadowEnrichment;
      if (shadow && typeof shadow.run === "function") return shadow.run(records);
      return null;
    }).catch(() => null);
  }

  function commitImport(result) {
    setStatus("Building analytics...", false); state.factData = result.rows; state.headerMap = result.headerMap; state.filters.month = "ALL"; state.filters.bank = "ALL";
    const months = new Set(); const banks = new Set(); state.factData.forEach((row) => { months.add(row.month); if (row.bank) banks.add(row.bank); });
    state.months = utils.orderMonths([...months]); state.banks = [...banks].sort(); result.summary.unconfiguredMonths = state.months.filter((month) => !config.FISCAL_MONTHS.includes(month)); state.importSummary = result.summary;
    state.dataQuality = global.BancaTrackerDataQuality.build(state.factData, config, result.summary);
    populateFilters(); renderImportSummary(result.summary); refresh(); setStatus(`Loaded ${utils.formatInr(state.factData.length)} records`, false); runShadowEnrichment(state.factData);
  }

  function processSynchronously(text) { return global.BancaTrackerCsvProcessor.process(text, config, (progress) => setStatus(progress.stage, false)); }
  function loadCsvText(text) { try { const result = processSynchronously(text); commitImport(result); return result; } catch (error) { setStatus(error.message || "Unable to process CSV.", true); return null; } }
  function processWithWorker(text) { return new Promise((resolve, reject) => { let worker; try { worker = new Worker("js/csvWorker.js"); } catch (error) { reject(error); return; } worker.onmessage = (event) => { if (event.data.type === "progress") setStatus(event.data.stage, false); else if (event.data.type === "complete") { worker.terminate(); resolve(event.data.result); } else if (event.data.type === "error") { worker.terminate(); reject(new Error(event.data.message)); } }; worker.onerror = () => { worker.terminate(); reject(new Error("CSV worker failed.")); }; worker.postMessage({ text, config }); }); }
  function handleFileChange(event) { const file = event.target.files[0]; if (!file) return; if (!/\.csv$/i.test(file.name || "")) { setStatus("Unsupported file. Select a .csv file.", true); return; } const reader = new FileReader(); setStatus("Reading file...", false); reader.onload = async (loadEvent) => { const text = loadEvent.target.result; try { let result; try { result = await processWithWorker(text); } catch (workerError) { setStatus("Worker unavailable; using safe fallback...", false); result = processSynchronously(text); } commitImport(result); } catch (error) { setStatus(error.message || "Unable to process CSV.", true); } }; reader.onerror = () => setStatus("CSV read failed. The previous dataset is still available.", true); reader.readAsText(file); }
  function init() { document.getElementById("csvFile").addEventListener("change", handleFileChange); document.getElementById("monthFilter").addEventListener("change", function () { state.filters.month = this.value; refresh(); }); document.getElementById("bankFilter").addEventListener("change", function () { state.filters.bank = this.value; refresh(); }); }
  function getPerformanceContext() { return state.context || buildContext(); }
  global.BancaTrackerCore = Object.freeze({ state, init, loadCsvText, refresh, renderPage, setActivePage, getPerformanceContext, processSynchronously, runShadowEnrichment }); Object.defineProperty(global, "factData", { get: () => state.factData }); Object.defineProperty(global, "filteredData", { get: () => state.filteredData }); init();
})(window);
