(function (global) {
  "use strict";
  const state = { financialYear: null, managementBank: "ALL" };
  let initialized = false;
  const element = (id) => document.getElementById(id);
  const escape = (value) => global.BancaTrackerUtils.escapeHtml(value);
  const money = (value) => global.BancaTrackerUtils.formatRupees(value);
  const negative = (value) => value < 0 ? "commercial-negative" : "";
  const option = (value, label, selected) => `<option value="${escape(value)}"${selected ? " selected" : ""}>${escape(label)}</option>`;
  const periodLabel = (value) => {
    if (value === "UNKNOWN") return "Unknown date";
    const match = String(value || "").match(/^(\d{4})-(\d{2})$/); if (!match) return value || "Unknown date";
    return `${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][Number(match[2]) - 1]}-${match[1].slice(-2)}`;
  };
  function renderCards(result) {
    const k = result.kpis || { totalPremium: 0, initialPremium: 0, advancePremium: 0, unclassifiedPremium: 0 };
    element("premiumCompositionKpis").innerHTML = [["Total Signed Net Premium", k.totalPremium], ["Initial Portion Net Premium", k.initialPremium], ["Advance Portion Net Premium", k.advancePremium], ["Unclassified Net Premium", k.unclassifiedPremium]].map(([label, value]) => `<div class="card"><div>${escape(label)}</div><div class="value ${negative(value)}">${escape(money(value))}</div></div>`).join("");
  }
  function renderTrend(result) {
    if (!result.months.length) { element("premiumCompositionTrend").innerHTML = `<p class="empty-state">No transactions are available for this scope.</p>`; return; }
    const rows = result.months.map((row) => `<tr><td>${escape(periodLabel(row.periodKey))}</td><td class="${negative(row.totalPremium)}">${escape(money(row.totalPremium))}</td><td class="${negative(row.premiums.INITIAL)}">${escape(money(row.premiums.INITIAL))}</td><td class="${negative(row.premiums.ADVANCE)}">${escape(money(row.premiums.ADVANCE))}</td><td class="${negative(row.premiums.UNKNOWN)}">${escape(money(row.premiums.UNKNOWN))}</td><td class="${negative(row.premiums.INVALID)}">${escape(money(row.premiums.INVALID))}</td><td>${escape(row.rowCount)}</td></tr>`).join("");
    element("premiumCompositionTrend").innerHTML = `<table><thead><tr><th>Month</th><th>Total</th><th>Initial</th><th>Advance</th><th>Unknown</th><th>Invalid</th><th>Transaction Rows</th></tr></thead><tbody>${rows}</tbody></table>`;
  }
  function renderProducts(result) {
    if (!result.products.length) { element("premiumCompositionProducts").innerHTML = `<p class="empty-state">No product composition is available for this scope.</p>`; return; }
    const rows = result.products.map((row) => `<tr><td>${escape(row.product)}</td><td class="${negative(row.totalPremium)}">${escape(money(row.totalPremium))}</td><td class="${negative(row.premiums.INITIAL)}">${escape(money(row.premiums.INITIAL))}</td><td class="${negative(row.premiums.ADVANCE)}">${escape(money(row.premiums.ADVANCE))}</td><td class="${negative(row.premiums.UNKNOWN)}">${escape(money(row.premiums.UNKNOWN))}</td><td class="${negative(row.premiums.INVALID)}">${escape(money(row.premiums.INVALID))}</td><td>${escape(row.rowCount)}</td></tr>`).join("");
    element("premiumCompositionProducts").innerHTML = `<table><thead><tr><th>Product</th><th>Total</th><th>Initial</th><th>Advance</th><th>Unknown</th><th>Invalid</th><th>Transaction Rows</th></tr></thead><tbody>${rows}</tbody></table>`;
  }
  function tenureLabel(value) { return String(value || "UNKNOWN").replace(/_/g, " "); }
  function renderTenureReadiness(result) {
    const readiness = result.tenureReadiness;
    if (!readiness) { element("premiumTenureReadiness").innerHTML = `<p class="empty-state">Tenure evidence is unavailable.</p>`; return; }
    const diagnostics = Object.entries(readiness.diagnosticCounts).sort(([left], [right]) => left.localeCompare(right));
    const diagnosticText = (diagnostics.length ? diagnostics.map(([code, count]) => `${code}: ${count}`).join(" · ") : "No tenure diagnostics") +
      (readiness.statusCounts.UNKNOWN ? " · Unknown tenure remains unevidenced" : "");
    element("premiumTenureReadiness").innerHTML = `<span class="commercial-status${readiness.statusCounts.UNKNOWN || readiness.statusCounts.INVALID ? " commercial-status-partial" : " commercial-status-ready"}">INFORMATIONAL</span>Successful tenure evidence ${escape(readiness.successfulTenureRowShare.toFixed(1))}% · Success ${escape(readiness.statusCounts.SUCCESS)} · Unknown ${escape(readiness.statusCounts.UNKNOWN)} · Invalid ${escape(readiness.statusCounts.INVALID)}<br><span class="scorecard-note">${escape(diagnosticText)} · Matrix premium difference ${escape(money(readiness.reconciliation.premiumDifference))} · Matrix row difference ${escape(readiness.reconciliation.rowDifference)}.</span>`;
  }
  function renderTenureMatrix(result) {
    if (!result.tenureRows || !result.tenureRows.some((row) => row.rowCount)) { element("premiumTenureMatrix").innerHTML = `<p class="empty-state">No tenure composition is available for this scope.</p>`; return; }
    const rows = result.tenureRows.map((row) => `<tr><td>${escape(tenureLabel(row.tenureClassification))}</td><td class="${negative(row.totalPremium)}">${escape(money(row.totalPremium))}</td><td class="${negative(row.premiums.INITIAL)}">${escape(money(row.premiums.INITIAL))}</td><td class="${negative(row.premiums.ADVANCE)}">${escape(money(row.premiums.ADVANCE))}</td><td class="${negative(row.premiums.UNKNOWN)}">${escape(money(row.premiums.UNKNOWN))}</td><td class="${negative(row.premiums.INVALID)}">${escape(money(row.premiums.INVALID))}</td><td>${escape(row.rowCount)}</td></tr>`).join("");
    element("premiumTenureMatrix").innerHTML = `<table><thead><tr><th>Tenure Evidence</th><th>Total</th><th>Initial Portion</th><th>Advance Portion</th><th>Unknown Portion</th><th>Invalid Portion</th><th>Transaction Rows</th></tr></thead><tbody>${rows}</tbody></table>`;
  }
  function render() {
    const authority = global.BancaTrackerPremiumComposition; const facts = global.BancaTrackerCore && global.BancaTrackerCore.state.factData || [];
    if (!authority) throw new Error("Premium Composition authority is unavailable.");
    const years = authority.availableFinancialYears(facts); const banks = authority.availableManagementBanks(facts);
    if (!years.includes(state.financialYear)) state.financialYear = years.at(-1) || null;
    if (state.managementBank !== "ALL" && !banks.includes(state.managementBank)) state.managementBank = "ALL";
    element("premiumCompositionFinancialYear").innerHTML = years.map((year) => option(year, year, year === state.financialYear)).join("");
    element("premiumCompositionManagementBank").innerHTML = option("ALL", "All Management Banks", state.managementBank === "ALL") + banks.map((bank) => option(bank, bank, bank === state.managementBank)).join("");
    const result = authority.buildPremiumComposition(facts, { financialYear: state.financialYear, managementBank: state.managementBank });
    renderCards(result); renderTrend(result); renderProducts(result); renderTenureReadiness(result); renderTenureMatrix(result);
    const k = result.kpis || { unknownPremium: 0, invalidPremium: 0, classifiedTransactionRowShare: 0, transactionRows: 0 };
    element("premiumCompositionReadiness").innerHTML = `<span class="commercial-status${result.status === "READY" ? " commercial-status-ready" : result.status === "PARTIAL" ? " commercial-status-partial" : ""}">${escape(result.status.replace(/_/g, " "))}</span>${escape(result.financialYear || "No financial year")} · ${escape(result.managementBank === "ALL" ? "All Management Banks" : result.managementBank)} · Classified transaction-row share ${escape(k.classifiedTransactionRowShare.toFixed(1))}%<br><span class="scorecard-note">Unknown premium ${escape(money(k.unknownPremium))} · Invalid premium ${escape(money(k.invalidPremium))} · ${escape(k.transactionRows)} transaction row(s) · Reconciliation difference ${escape(money(result.reconciliation && result.reconciliation.premiumDifference || 0))}.</span>`;
    return result;
  }
  function init() {
    if (initialized) return;
    element("premiumCompositionFinancialYear").addEventListener("change", function () { state.financialYear = this.value; render(); });
    element("premiumCompositionManagementBank").addEventListener("change", function () { state.managementBank = this.value; render(); });
    initialized = true;
  }
  init();
  global.BancaTrackerPremiumCompositionUI = Object.freeze({ state, init, render, renderCards, renderTrend, renderProducts, renderTenureReadiness, renderTenureMatrix });
})(window);
