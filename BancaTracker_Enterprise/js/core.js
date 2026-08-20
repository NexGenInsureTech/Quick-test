/* Application state, CSV ingestion, filters, and the central refresh pipeline. */
(function (global) {
  const config = global.BancaTrackerConfig;
  const utils = global.BancaTrackerUtils;
  const state = {
    factData: [],
    filteredData: [],
    filters: { month: "ALL", bank: "ALL" },
    headerMap: {}
  };

  const valueAt = (row, headerMap, header) => {
    const index = headerMap[header];
    return index >= 0 ? String(row[index] || "").trim() : "";
  };

  function setStatus(message, isError) {
    const status = document.getElementById("status");
    status.textContent = message;
    status.classList.toggle("status-error", Boolean(isError));
  }

  function validateHeaders(headers) {
    const missing = config.CSV_COLUMNS.MANDATORY.filter((header) => utils.headerIndex(headers, header) < 0);
    return { valid: missing.length === 0, missing };
  }

  function normalizeRow(row, headerMap) {
    return {
      premium: utils.parseNumber(valueAt(row, headerMap, "USGI NET PREMIUM")),
      month: valueAt(row, headerMap, "Month"),
      bank: utils.normalizeBank(valueAt(row, headerMap, "INTERMEDIARY")),
      rm: valueAt(row, headerMap, "BA NAME"),
      baCode: valueAt(row, headerMap, "Ba Code"),
      lob: valueAt(row, headerMap, "LINE OF BUSINESS"),
      branch: valueAt(row, headerMap, "BRANCH NAME"),
      zone: valueAt(row, headerMap, "Zone"),
      state: valueAt(row, headerMap, "STATE"),
      imd: valueAt(row, headerMap, "SUM IMD CODE"),
      businessType: valueAt(row, headerMap, "Business Type"),
      productName: valueAt(row, headerMap, "PRODUCT NAME"),
      productCode: valueAt(row, headerMap, "PRODUCT CODE"),
      day: valueAt(row, headerMap, "Day")
    };
  }

  function populateFilters() {
    const monthFilter = document.getElementById("monthFilter");
    const bankFilter = document.getElementById("bankFilter");
    const months = utils.orderMonths(state.factData.map((row) => row.month));
    const banks = [...new Set(state.factData.map((row) => row.bank).filter(Boolean))].sort();
    monthFilter.innerHTML = '<option value="ALL">All Months</option>';
    months.forEach((month) => {
      monthFilter.add(new Option(month, month));
    });
    bankFilter.innerHTML = '<option value="ALL">All Banks</option>';
    banks.forEach((bank) => bankFilter.add(new Option(bank, bank)));
  }

  function applyFilters() {
    state.filteredData = state.factData.filter((row) => (
      (state.filters.month === "ALL" || row.month === state.filters.month) &&
      (state.filters.bank === "ALL" || row.bank === state.filters.bank)
    ));
  }

  function getPerformanceContext() {
    const bankScopedData = state.factData.filter((row) => state.filters.bank === "ALL" || row.bank === state.filters.bank);
    const selectedMonth = state.filters.month;
    const availableMonths = utils.orderMonths(bankScopedData.map((row) => row.month));
    const latestMonth = availableMonths[availableMonths.length - 1] || "";
    let ytdData;
    let mtdData;

    if (selectedMonth === "ALL") {
      ytdData = bankScopedData;
      mtdData = latestMonth ? bankScopedData.filter((row) => row.month === latestMonth) : [];
    } else {
      const selectedIndex = config.FISCAL_MONTHS.indexOf(selectedMonth);
      ytdData = selectedIndex >= 0
        ? bankScopedData.filter((row) => {
          const rowIndex = config.FISCAL_MONTHS.indexOf(row.month);
          return rowIndex >= 0 && rowIndex <= selectedIndex;
        })
        : state.filteredData;
      mtdData = state.filteredData;
    }

    return Object.freeze({
      viewData: state.filteredData,
      bankScopedData,
      ytdData,
      mtdData,
      selectedMonth,
      latestMonth,
      availableMonths
    });
  }

  function refresh() {
    applyFilters();
    if (typeof global.renderPerformance === "function") global.renderPerformance(getPerformanceContext());
    if (typeof global.refreshActivation === "function") global.refreshActivation(state.filteredData);
    if (typeof global.refreshScorecard === "function") global.refreshScorecard(state.filteredData);
  }

  function loadCsvText(text) {
    const rows = utils.parseCSV(text);
    if (!rows.length) {
      state.factData = [];
      state.filteredData = [];
      setStatus("Unable to load CSV: the file is empty.", true);
      refresh();
      return;
    }
    const headers = rows[0];
    const validation = validateHeaders(headers);
    if (!validation.valid) {
      setStatus(`Unable to load CSV: missing mandatory column(s): ${validation.missing.join(", ")}.`, true);
      return;
    }
    state.headerMap = utils.buildHeaderMap(headers, [...config.CSV_COLUMNS.MANDATORY, ...config.CSV_COLUMNS.OPTIONAL]);
    state.factData = rows.slice(1).map((row) => normalizeRow(row, state.headerMap));
    state.filters = { month: "ALL", bank: "ALL" };
    populateFilters();
    refresh();
    setStatus(`Loaded ${utils.formatInr(state.factData.length)} records`, false);
  }

  function handleFileChange(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (loadEvent) => loadCsvText(loadEvent.target.result);
    reader.onerror = () => setStatus("Unable to read the selected CSV file.", true);
    reader.readAsText(file);
  }

  function init() {
    document.getElementById("csvFile").addEventListener("change", handleFileChange);
    document.getElementById("monthFilter").addEventListener("change", function () {
      state.filters.month = this.value;
      refresh();
    });
    document.getElementById("bankFilter").addEventListener("change", function () {
      state.filters.bank = this.value;
      refresh();
    });
  }

  global.BancaTrackerCore = Object.freeze({ state, init, loadCsvText, refresh, validateHeaders, normalizeRow, getPerformanceContext });
  Object.defineProperty(global, "factData", { get: () => state.factData });
  Object.defineProperty(global, "filteredData", { get: () => state.filteredData });
  init();
})(window);
