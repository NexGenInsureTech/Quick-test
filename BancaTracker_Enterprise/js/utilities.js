/* Shared, dependency-free utility functions. */
(function (global) {
  const getConfig = () => global.BancaTrackerConfig;

  function parseNumber(value) {
    return Number(String(value || 0).replace(/,/g, "").trim()) || 0;
  }

  function formatInr(value) {
    return Number(value || 0).toLocaleString("en-IN");
  }

  function formatPercent(numerator, denominator) {
    const value = denominator > 0 ? (numerator / denominator) * 100 : 0;
    return `${value.toFixed(1)}%`;
  }

  function parseCSV(text) {
    const rows = [];
    let row = [];
    let cell = "";
    let inQuotes = false;
    const source = String(text || "").replace(/^\uFEFF/, "");

    for (let i = 0; i < source.length; i += 1) {
      const char = source[i];
      if (char === '"') {
        if (inQuotes && source[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === "," && !inQuotes) {
        row.push(cell);
        cell = "";
      } else if ((char === "\n" || char === "\r") && !inQuotes) {
        if (cell.length || row.length) {
          row.push(cell);
          rows.push(row);
          row = [];
          cell = "";
        }
        if (char === "\r" && source[i + 1] === "\n") i += 1;
      } else {
        cell += char;
      }
    }

    if (cell.length || row.length) {
      row.push(cell);
      rows.push(row);
    }
    return rows;
  }

  function headerIndex(headers, name) {
    return headers.findIndex((header) => String(header).trim().toUpperCase() === name.toUpperCase());
  }

  function buildHeaderMap(headers, names) {
    return names.reduce((map, name) => {
      map[name] = headerIndex(headers, name);
      return map;
    }, {});
  }

  function orderMonths(months) {
    const uniqueMonths = [...new Set(months.filter(Boolean))];
    const fiscalMonths = getConfig().FISCAL_MONTHS;
    const configured = fiscalMonths.filter((month) => uniqueMonths.includes(month));
    const otherMonths = uniqueMonths.filter((month) => !fiscalMonths.includes(month));
    return [...configured, ...otherMonths];
  }

  function aggregatePremium(data, key) {
    return data.reduce((totals, row) => {
      const group = row[key] || "Blank";
      totals[group] = (totals[group] || 0) + row.premium;
      return totals;
    }, {});
  }

  function normalizeBank(bank) {
    const normalized = String(bank || "").trim().replace(/\s+/g, " ").toUpperCase();
    if (!normalized) return "Unknown";
    return getConfig().BANK_ALIASES[normalized] || normalized;
  }

  function branchKey(bank, branch) {
    return `${normalizeBank(bank)}::${String(branch || "Unknown").trim() || "Unknown"}`;
  }

  function buildBranchMetrics(data) {
    return data.reduce((branches, row) => {
      const bank = normalizeBank(row.bank);
      const branch = String(row.branch || "Unknown").trim() || "Unknown";
      const key = branchKey(bank, branch);
      if (!branches[key]) {
        branches[key] = {
          key,
          branch,
          bank,
          premium: 0,
          zone: row.zone || "",
          state: row.state || ""
        };
      }
      branches[key].premium += row.premium;
      return branches;
    }, {});
  }

  function getBranchBand(premium) {
    if (premium <= 0) return "Zero";
    if (premium < 15000) return "1 - 14.9K";
    if (premium < 25000) return "15K - 24.9K";
    if (premium < 50000) return "25K - 49.9K";
    if (premium < 100000) return "50K - 99.9K";
    if (premium < 200000) return "1L - 1.99L";
    return "2L+";
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);
  }

  global.BancaTrackerUtils = Object.freeze({
    parseNumber, formatInr, formatPercent, parseCSV, headerIndex, buildHeaderMap, orderMonths,
    aggregatePremium, normalizeBank, branchKey, buildBranchMetrics, getBranchBand, escapeHtml
  });
})(window);
