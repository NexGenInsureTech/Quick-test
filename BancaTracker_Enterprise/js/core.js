/* Application state, resilient CSV ingestion, central time scopes, filters, and refresh orchestration. */
(function (global) {
  const config = global.BancaTrackerConfig;
  const utils = global.BancaTrackerUtils;
  const emptyImportSummary = { totalRows: 0, acceptedRows: 0, rejectedRows: 0, warningRows: 0, negativePremiumRows: 0, rejectionReasons: {}, warningReasons: {}, unconfiguredMonths: [] };
  const state = { factData: [], filteredData: [], filters: { month: "ALL", bank: "ALL" }, activePage: "misPage", headerMap: {}, months: [], banks: [], importSummary: emptyImportSummary, dataQuality: global.BancaTrackerDataQuality.build([], config, emptyImportSummary), productivity: null, derived: null, context: null, branchUniverseAuthority: null, commercialPerformance: null, commercialRollup: null };
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

  function buildContext(factData = state.factData, filters = state.filters) {
    const selectedMonth = filters.month; const selectedBank = filters.bank;
    const fullUploadData = selectedBank === "ALL" ? factData : [];
    const available = new Set(); const availableFiscal = new Set(); const bankMonthlyPremium = {}; const rowsByMonth = {};
    factData.forEach((row) => { if (selectedBank !== "ALL" && row.bank !== selectedBank) return; if (selectedBank !== "ALL") fullUploadData.push(row); available.add(row.month); if (config.FISCAL_MONTHS.includes(row.month)) availableFiscal.add(row.month); bankMonthlyPremium[row.month] = (bankMonthlyPremium[row.month] || 0) + row.premium; if (!rowsByMonth[row.month]) rowsByMonth[row.month] = []; rowsByMonth[row.month].push(row); });
    const availableMonths = utils.orderMonths([...available]);
    const availableFiscalMonths = config.FISCAL_MONTHS.filter((month) => availableFiscal.has(month));
    const latestFiscalMonth = availableFiscalMonths[availableFiscalMonths.length - 1] || "";
    const currentPeriodMonth = selectedMonth === "ALL" ? latestFiscalMonth : selectedMonth;
    const currentPeriodData = currentPeriodMonth ? (rowsByMonth[currentPeriodMonth] || []) : [];
    const currentPeriodKeys = new Set(currentPeriodData.map((row) => row.monthKey).filter((key) => typeof key === "string" && /^\d{4}-\d{2}$/.test(key)));
    const currentPeriodKey = currentPeriodData.length && currentPeriodKeys.size === 1 && currentPeriodData.every((row) => currentPeriodKeys.has(row.monthKey))
      ? [...currentPeriodKeys][0]
      : null;
    const progressionMonth = selectedMonth === "ALL" ? latestFiscalMonth : (config.FISCAL_MONTHS.includes(selectedMonth) ? selectedMonth : "");
    const progressionIndex = config.FISCAL_MONTHS.indexOf(progressionMonth);
    const ytdData = []; const ytdPremiumByBank = {}; let ytdPremium = 0;
    if (progressionIndex >= 0) config.FISCAL_MONTHS.slice(0, progressionIndex + 1).forEach((month) => { (rowsByMonth[month] || []).forEach((row) => { ytdData.push(row); ytdPremium += row.premium; ytdPremiumByBank[row.bank] = (ytdPremiumByBank[row.bank] || 0) + row.premium; }); });
    const mtdPremium = utils.premiumTotal(currentPeriodData);
    return Object.freeze({ viewData: currentPeriodData, currentPeriodData, ytdData, fullUploadData, selectedMonth, currentPeriodMonth, currentPeriodKey, currentPeriodIsUnconfigured: Boolean(currentPeriodMonth && !config.FISCAL_MONTHS.includes(currentPeriodMonth)), latestMonth: latestFiscalMonth, latestFiscalMonth, availableMonths, availableFiscalMonths, progressionMonth, elapsedMonths: progressionIndex < 0 ? null : progressionIndex + 1, ytdPremium, ytdPremiumByBank, mtdPremium, bankMonthlyPremium });
  }

  function safeRender(name, renderer, argument) { if (typeof renderer !== "function") return true; try { renderer(argument); return true; } catch (error) { console.error(`${name} render failed`, error); setStatus(`${name} could not render. Other pages remain available.`, true); return false; } }
  function renderPage(pageId) { const context = state.context; if (pageId === "commercialPage") return safeRender("Commercial Performance", global.BancaTrackerCommercialPerformanceUI && global.BancaTrackerCommercialPerformanceUI.render); if (!context) return true; const renderers = { misPage: ["Performance MIS", global.renderPerformance, { ...context, derived: state.derived }], activationPage: ["Activation Cockpit", global.refreshActivation, state.derived], scorecardPage: ["Management Scorecard", global.refreshScorecard, state.derived], targetPage: ["Target & Growth", global.refreshTarget, { ...context, derived: state.derived }], productivityPage: ["Productivity & Opportunity", global.renderProductivity, state.productivity], qualityPage: ["Data Quality", global.renderDataQuality, state.dataQuality] }; const entry = renderers[pageId]; return entry ? safeRender(entry[0], entry[1], entry[2]) : true; }
  function setActivePage(pageId) { state.activePage = pageId; renderPage(pageId); }
  function calculateRuntime(factData, filters, dataQuality) {
    const context = buildContext(factData, filters);
    const derived = global.BancaTrackerAnalytics.build(context.currentPeriodData);
    const productivity = global.BancaTrackerProductivity.build(context, derived, dataQuality);
    const commercialAuthority = global.BancaTrackerLiveBranchCommercialAuthority;
    const governedContext = global.BancaTrackerLiveGeographyAuthority && global.BancaTrackerLiveGeographyAuthority.getCachedContext();
    const commercialPerformance = global.BancaTrackerCommercialPerformance ? global.BancaTrackerCommercialPerformance.buildPerformance(factData, commercialAuthority && commercialAuthority.getCachedContext()) : null;
    const periodContext = global.BancaTrackerCommercialRollups && commercialPerformance ? global.BancaTrackerCommercialRollups.buildPeriodContext(commercialPerformance) : null;
    const commercialRollup = periodContext && periodContext.defaultSelectedPeriod ? global.BancaTrackerCommercialRollups.buildRollup(commercialPerformance, { type: "MONTH", periodKey: periodContext.defaultSelectedPeriod }, "OVERALL", governedContext) : null;
    return { filteredData: context.currentPeriodData, context, derived, productivity, commercialPerformance, commercialRollup };
  }

  function activateRuntime(runtime) {
    Object.assign(state, runtime);
  }

  function refresh() {
    const started = performance.now();
    const runtime = calculateRuntime(state.factData, state.filters, state.dataQuality);
    activateRuntime(runtime);
    renderPage(state.activePage);
    return performance.now() - started;
  }

  function runShadowEnrichment(records) {
    Promise.resolve().then(() => {
      const shadow = global.BancaTrackerShadowEnrichment;
      if (shadow && typeof shadow.run === "function") return shadow.run(records);
      return null;
    }).catch(() => null);
  }

  function applyDateAuthority(record) {
    const legacyMonth = record.month;
    const legacyDay = record.day;
    const policyIssuedDate = String(record.policyIssuedDate || "").trim();
    if (!policyIssuedDate) {
      return { ...record, legacyMonth, legacyDay, dateAuthority: "LEGACY_FALLBACK" };
    }
    const resolver = global.BancaTrackerDateResolver;
    const resolution = resolver && typeof resolver.resolve === "function"
      ? resolver.resolve(policyIssuedDate)
      : { success: false, error: "DATE_RESOLVER_UNAVAILABLE" };
    if (!resolution.success) {
      return { ...record, legacyMonth, legacyDay, month: null, day: null, dateAuthority: "INVALID", dateAuthorityError: resolution.error };
    }
    return {
      ...record, legacyMonth, legacyDay,
      month: resolution.monthLabel, day: resolution.day,
      dateAuthority: "CANONICAL", year: resolution.year,
      monthKey: resolution.monthKey, financialYear: resolution.financialYear,
    };
  }

  function prepareImport(result, authorityContext) {
    const dateRows = result.rows.map(applyDateAuthority);
    const branchAuthority = global.BancaTrackerLiveBranchAuthority;
    const assignmentAuthority = global.BancaTrackerLiveAssignmentAuthority;
    const hierarchyAuthority = global.BancaTrackerLiveHierarchyAuthority;
    const geographyAuthority = global.BancaTrackerLiveGeographyAuthority;
    const context = authorityContext || (geographyAuthority && geographyAuthority.getCachedContext()) || (hierarchyAuthority && hierarchyAuthority.getCachedContext()) || (assignmentAuthority && assignmentAuthority.getCachedContext()) || (branchAuthority && branchAuthority.getCachedContext());
    const universeAuthority = global.BancaTrackerLiveBranchUniverseAuthority;
    const branchUniverseAuthority = context && context.branchUniverse ||
      (universeAuthority && universeAuthority.getUniverse()) || null;
    const branchRows = branchAuthority ? branchAuthority.applyRecords(dateRows, context) : dateRows;
    const assignmentRows = assignmentAuthority ? assignmentAuthority.applyRecords(branchRows, context) : branchRows;
    const hierarchyRows = hierarchyAuthority ? hierarchyAuthority.applyRecords(assignmentRows, context) : assignmentRows;
    const factData = geographyAuthority
      ? geographyAuthority.applyRecords(hierarchyRows, context)
      : hierarchyRows;
    const monthSet = new Set(); const bankSet = new Set(); factData.forEach((row) => { monthSet.add(row.month); if (row.bank) bankSet.add(row.bank); });
    const months = utils.orderMonths([...monthSet]); const banks = [...bankSet].sort();
    const importSummary = { ...result.summary, rejectionReasons: { ...(result.summary.rejectionReasons || {}) }, warningReasons: { ...(result.summary.warningReasons || {}) }, unconfiguredMonths: months.filter((month) => !config.FISCAL_MONTHS.includes(month)) };
    const dataQuality = global.BancaTrackerDataQuality.build(factData, config, importSummary);
    const filters = { month: "ALL", bank: "ALL" };
    const runtime = calculateRuntime(factData, filters, dataQuality);
    return { factData, branchUniverseAuthority, headerMap: { ...(result.headerMap || {}) }, filters, months, banks, importSummary, dataQuality, ...runtime };
  }

  function activateImport(candidate) {
    activateRuntime(candidate);
  }

  function projectImport(candidate) {
    let projectionError = null;
    try {
      const fileCount = candidate.importSummary.batch && candidate.importSummary.batch.fileCount;
      populateFilters(); renderImportSummary(candidate.importSummary); if (!renderPage(state.activePage)) throw new Error("The active page could not render."); setStatus(`Loaded ${utils.formatInr(candidate.factData.length)} records${fileCount ? ` from ${utils.formatInr(fileCount)} file${fileCount === 1 ? "" : "s"}` : ""}`, false);
    } catch (error) {
      projectionError = error;
      console.error("Import projection failed", error);
      try { setStatus("Import activated, but the screen could not fully refresh. Change a filter or reload the page to retry the view.", true); } catch (statusError) { console.error("Import projection status failed", statusError); }
    }
    runShadowEnrichment(candidate.factData);
    return { projectionError };
  }

  function commitImport(result, authorityContext) {
    setStatus("Building analytics...", false);
    const candidate = prepareImport(result, authorityContext);
    activateImport(candidate);
    projectImport(candidate);
    return { ...result, rows: candidate.factData, headerMap: candidate.headerMap, summary: candidate.importSummary };
  }

  function processSynchronously(text) { return global.BancaTrackerCsvProcessor.process(text, config, (progress) => setStatus(progress.stage, false)); }
  function loadCsvText(text) { try { const result = processSynchronously(text); return commitImport(result); } catch (error) { setStatus(error.message || "Unable to process CSV.", true); return null; } }
  function processWithWorker(text, progressPrefix = "") { return new Promise((resolve, reject) => { let worker; try { worker = new Worker("js/csvWorker.js"); } catch (error) { reject(error); return; } worker.onmessage = (event) => { if (event.data.type === "progress") setStatus(`${progressPrefix}${event.data.stage}`, false); else if (event.data.type === "complete") { worker.terminate(); resolve(event.data.result); } else if (event.data.type === "error") { worker.terminate(); reject(new Error(event.data.message)); } }; worker.onerror = () => { worker.terminate(); reject(new Error("CSV worker failed.")); }; worker.postMessage({ text, config }); }); }

  const sumReasons = (target, source) => Object.entries(source || {}).forEach(([reason, count]) => { target[reason] = (target[reason] || 0) + count; });
  const digestHex = (bytes) => [...new Uint8Array(bytes)].map((value) => value.toString(16).padStart(2, "0")).join("");
  function schemaSignature(headerMap) { return Object.entries(headerMap || {}).filter(([, index]) => index >= 0).map(([name]) => name.toUpperCase()).sort().join("|"); }
  function emptyBatchSummary() { return { totalRows: 0, acceptedRows: 0, rejectedRows: 0, warningRows: 0, negativePremiumRows: 0, rejectionReasons: {}, warningReasons: {} }; }

  async function loadAuthorityContext() {
    const branchAuthority = global.BancaTrackerLiveBranchAuthority;
    const assignmentAuthority = global.BancaTrackerLiveAssignmentAuthority;
    const hierarchyAuthority = global.BancaTrackerLiveHierarchyAuthority;
    const geographyAuthority = global.BancaTrackerLiveGeographyAuthority;
    const commercialAuthority = global.BancaTrackerLiveBranchCommercialAuthority;
    const branchContext = branchAuthority ? await branchAuthority.loadContext() : null;
    const assignmentContext = assignmentAuthority ? await assignmentAuthority.loadContext(undefined, branchContext) : branchContext;
    const hierarchyContext = hierarchyAuthority ? await hierarchyAuthority.loadContext(undefined, assignmentContext) : assignmentContext;
    const authorityContext = geographyAuthority ? await geographyAuthority.loadContext(undefined, hierarchyContext) : hierarchyContext;
    if (commercialAuthority) await commercialAuthority.loadContext();
    return authorityContext;
  }

  async function processBatchFile(file, selectionIndex, fileCount, hashes) {
    const label = `file ${selectionIndex + 1} of ${fileCount}: ${file.name}`;
    setStatus(`Processing ${label}`, false);
    let bytes;
    try { bytes = await file.arrayBuffer(); } catch (error) { throw new Error(`Unable to read ${label}. ${error.message || error}`); }
    let hash;
    try { hash = digestHex(await global.crypto.subtle.digest("SHA-256", bytes)); } catch (error) { throw new Error(`Unable to calculate SHA-256 for ${label}. ${error.message || error}`); }
    const duplicate = hashes.get(hash);
    if (duplicate) throw new Error(`Duplicate physical file content detected: ${duplicate.filename} and ${file.name}. The batch was not imported.`);
    hashes.set(hash, { filename: file.name, selectionIndex });
    let text;
    try { text = new TextDecoder("utf-8").decode(bytes); } catch (error) { throw new Error(`Unable to decode ${label} as UTF-8. ${error.message || error}`); }
    let result;
    try { result = await processWithWorker(text, `Processing ${label} — `); }
    catch (workerError) {
      setStatus(`Processing ${label} — Worker unavailable; using safe fallback...`, false);
      try { result = processSynchronously(text); } catch (error) { throw new Error(`Unable to process ${label}. ${error.message || error}`); }
    }
    const summary = result.summary;
    return {
      result,
      provenance: {
        filename: file.name, size: Number(file.size || bytes.byteLength), lastModified: Number(file.lastModified || 0), sha256: hash,
        selectionIndex, processingIndex: selectionIndex, totalRows: summary.totalRows, acceptedRows: summary.acceptedRows,
        rejectedRows: summary.rejectedRows, warningRows: summary.warningRows, negativePremiumRows: summary.negativePremiumRows,
        rejectionReasons: { ...(summary.rejectionReasons || {}) }, warningReasons: { ...(summary.warningReasons || {}) },
        headerMap: { ...(result.headerMap || {}) }, semanticSchemaSignature: schemaSignature(result.headerMap),
        observedMonths: [...new Set(result.rows.map((row) => row.month).filter(Boolean))].sort(),
      },
    };
  }

  async function handleFiles(fileList, input = document.getElementById("csvFile")) {
    const files = Array.from(fileList || []).map((file, selectionIndex) => ({ file, selectionIndex }));
    try {
      if (!files.length) return null;
      const invalid = files.find(({ file }) => !/\.csv$/i.test(file.name || ""));
      if (invalid) throw new Error(`Unsupported file: ${invalid.file.name || `selection ${invalid.selectionIndex + 1}`}. Select CSV files only.`);
      if (!global.crypto || !global.crypto.subtle || typeof global.crypto.subtle.digest !== "function") throw new Error("SHA-256 duplicate-file protection is unavailable in this browser. The batch was not imported.");
      if (typeof TextDecoder !== "function") throw new Error("UTF-8 file decoding is unavailable in this browser. The batch was not imported.");
      const hashes = new Map(); const rows = []; const fileProvenance = []; const summary = emptyBatchSummary(); let headerMap = null;
      for (const item of files) {
        const processed = await processBatchFile(item.file, item.selectionIndex, files.length, hashes);
        const result = processed.result; if (!headerMap) headerMap = { ...(result.headerMap || {}) };
        result.rows.forEach((row) => rows.push(row)); fileProvenance.push(processed.provenance);
        ["totalRows", "acceptedRows", "rejectedRows", "warningRows", "negativePremiumRows"].forEach((field) => { summary[field] += Number(result.summary[field] || 0); });
        sumReasons(summary.rejectionReasons, result.summary.rejectionReasons); sumReasons(summary.warningReasons, result.summary.warningReasons);
      }
      summary.acceptedRows = rows.length;
      summary.batch = {
        fileCount: files.length, importMode: "REPLACE", status: "COMMITTED", importedAt: new Date().toISOString(),
        totalRows: summary.totalRows, acceptedRows: summary.acceptedRows, rejectedRows: summary.rejectedRows,
        warningRows: summary.warningRows, negativePremiumRows: summary.negativePremiumRows,
        observedMonths: [...new Set(fileProvenance.flatMap((file) => file.observedMonths))].sort(), files: fileProvenance,
      };
      const authorityContext = await loadAuthorityContext();
      return commitImport({ rows, headerMap: headerMap || {}, summary }, authorityContext);
    } catch (error) {
      setStatus(error.message || "Unable to process the selected CSV batch. The previous dataset is still available.", true);
      return null;
    } finally {
      if (input) input.value = "";
    }
  }

  function handleFileChange(event) { handleFiles(event.target.files, event.target); }
  function init() { document.getElementById("csvFile").addEventListener("change", handleFileChange); document.getElementById("monthFilter").addEventListener("change", function () { state.filters.month = this.value; refresh(); }); document.getElementById("bankFilter").addEventListener("change", function () { state.filters.bank = this.value; refresh(); }); }
  function getPerformanceContext() { return state.context || buildContext(); }
  global.BancaTrackerCore = Object.freeze({ state, init, loadCsvText, handleFiles, refresh, renderPage, setActivePage, getPerformanceContext, processSynchronously, runShadowEnrichment, applyDateAuthority }); Object.defineProperty(global, "factData", { get: () => state.factData }); Object.defineProperty(global, "filteredData", { get: () => state.filteredData }); init();
})(window);
