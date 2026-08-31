/* Shared, dependency-free utility functions. */
(function (global) {
  const getConfig = () => global.BancaTrackerConfig;

  function formatInr(value) {
    return Number(value || 0).toLocaleString("en-IN");
  }

  function formatPercent(numerator, denominator) {
    const value = denominator > 0 ? (numerator / denominator) * 100 : 0;
    return `${value.toFixed(1)}%`;
  }

  function orderMonths(months) {
    const uniqueMonths = [...new Set(months.filter(Boolean))];
    const fiscalMonths = getConfig().FISCAL_MONTHS;
    const configured = fiscalMonths.filter((month) => uniqueMonths.includes(month));
    const otherMonths = uniqueMonths.filter((month) => !fiscalMonths.includes(month));
    return [...configured, ...otherMonths];
  }

  function premiumTotal(data) {
    return data.reduce((sum, row) => sum + row.premium, 0);
  }

  function normalizeBank(bank) {
    const normalized = String(bank || "").trim().replace(/\s+/g, " ").toUpperCase();
    if (!normalized) return "Unknown";
    return getConfig().BANK_ALIASES[normalized] || normalized;
  }

  function branchKey(bank, branch) {
    return `${normalizeBank(bank)}::${String(branch || "Unknown").trim() || "Unknown"}`;
  }

  function branchIdentityKey(row) {
    if (row && (row.branchAuthority === "UNMAPPED" || row.branchAuthority === "AMBIGUOUS")) return null;
    if (row && /^GOVERNED_/.test(row.branchAuthority || "") && row.branchId) return row.branchId;
    return branchKey(row && row.bank, row && row.branch);
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
    formatInr, formatPercent, orderMonths, premiumTotal, normalizeBank, branchKey, branchIdentityKey, getBranchBand, escapeHtml
  });
})(window);
