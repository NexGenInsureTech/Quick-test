/* Shared CSV parser/validator for both the browser main thread and csvWorker.js. */
(function (scope) {
  function parseCSV(text) {
    const rows = []; let row = []; let cell = ""; let inQuotes = false;
    const source = String(text || "").replace(/^\uFEFF/, "");
    for (let i = 0; i < source.length; i += 1) {
      const char = source[i];
      if (char === '"') {
        if (inQuotes && source[i + 1] === '"') { cell += '"'; i += 1; } else inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) { row.push(cell); cell = ""; }
      else if ((char === "\n" || char === "\r") && !inQuotes) {
        if (cell.length || row.length) { row.push(cell); rows.push(row); row = []; cell = ""; }
        if (char === "\r" && source[i + 1] === "\n") i += 1;
      } else cell += char;
    }
    if (inQuotes) throw new Error("Malformed CSV: a quoted field is not closed.");
    if (cell.length || row.length) { row.push(cell); rows.push(row); }
    return rows;
  }

  const clean = (value) => String(value == null ? "" : value).trim();
  const headerIndex = (headers, name) => headers.findIndex((header) => clean(header).toUpperCase() === name.toUpperCase());
  function normalizeBank(value, aliases) {
    const bank = clean(value).replace(/\s+/g, " ").toUpperCase();
    return bank ? (aliases[bank] || bank) : "Unknown";
  }
  function addReason(target, reason) { target[reason] = (target[reason] || 0) + 1; }

  function process(text, config, onProgress) {
    if (!String(text || "").trim()) throw new Error("Unable to load CSV: the file is empty.");
    onProgress && onProgress({ stage: "Parsing CSV..." });
    const parsed = parseCSV(text);
    if (!parsed.length || !parsed[0].some((value) => clean(value))) throw new Error("Unable to load CSV: the file is empty.");
    const headers = parsed[0];
    const missing = config.CSV_COLUMNS.MANDATORY.filter((name) => headerIndex(headers, name) < 0);
    if (missing.length) throw new Error(`Unable to load CSV: missing mandatory column(s): ${missing.join(", ")}.`);
    const names = [...config.CSV_COLUMNS.MANDATORY, ...config.CSV_COLUMNS.OPTIONAL];
    const map = names.reduce((result, name) => { result[name] = headerIndex(headers, name); return result; }, {});
    const valueAt = (row, name) => map[name] >= 0 ? clean(row[map[name]]) : "";
    const rows = []; const rejectionReasons = {}; const warningReasons = {}; let warningRows = 0; let negativePremiumRows = 0;
    const totalRows = Math.max(0, parsed.length - 1);
    for (let i = 1; i < parsed.length; i += 1) {
      const source = parsed[i];
      if (!source.some((value) => clean(value))) { addReason(rejectionReasons, "Blank row"); continue; }
      if (source.length !== headers.length) { addReason(rejectionReasons, "Unusable column count"); continue; }
      const premiumText = valueAt(source, "USGI NET PREMIUM").replace(/,/g, "");
      const premium = Number(premiumText);
      if (!premiumText || !Number.isFinite(premium)) { addReason(rejectionReasons, "Invalid premium"); continue; }
      const month = valueAt(source, "Month"); const bankText = valueAt(source, "INTERMEDIARY"); const branch = valueAt(source, "BRANCH NAME");
      if (!month || !bankText || !branch) { addReason(rejectionReasons, "Missing Month, Bank, or Branch"); continue; }
      if (premium < 0) negativePremiumRows += 1;
      const missingDescriptors = ["BA NAME", "Ba Code", "LINE OF BUSINESS"].filter((name) => !valueAt(source, name));
      if (missingDescriptors.length) { warningRows += 1; addReason(warningReasons, `Missing ${missingDescriptors.join("/")}`); }
      rows.push({ premium, month, bank: normalizeBank(bankText, config.BANK_ALIASES), rm: valueAt(source, "BA NAME"), baCode: valueAt(source, "Ba Code"), lob: valueAt(source, "LINE OF BUSINESS"), branch, zone: valueAt(source, "Zone"), state: valueAt(source, "STATE"), imd: valueAt(source, "SUM IMD CODE"), businessType: valueAt(source, "Business Type"), productName: valueAt(source, "PRODUCT NAME"), productCode: valueAt(source, "PRODUCT CODE"), day: valueAt(source, "Day"), policyIssuedDate: valueAt(source, "POLICY ISSUED DATE") });
      if (onProgress && (i % 25000 === 0 || i === totalRows)) onProgress({ stage: `Processing ${Math.min(i, totalRows).toLocaleString("en-IN")} / ${totalRows.toLocaleString("en-IN")} rows...` });
    }
    if (totalRows > 0 && rows.length === 0) throw new Error(`Unable to load CSV: no usable data rows. Rejected ${totalRows.toLocaleString("en-IN")} row(s).`);
    return { rows, headerMap: map, summary: { totalRows, acceptedRows: rows.length, rejectedRows: totalRows - rows.length, warningRows, negativePremiumRows, rejectionReasons, warningReasons } };
  }
  scope.BancaTrackerCsvProcessor = Object.freeze({ parseCSV, process });
})(typeof self !== "undefined" ? self : window);
