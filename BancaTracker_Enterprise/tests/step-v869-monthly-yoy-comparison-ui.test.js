/* v8.6.9: Monthly YoY Performance Comparison presentation contract. */
"use strict";
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");

class Element {
  constructor() { this.innerHTML = ""; this.textContent = ""; this.value = ""; this.disabled = false; this.hidden = false; this.listeners = {}; }
  addEventListener(type, handler) { this.listeners[type] = handler; }
  insertAdjacentHTML() {}
}
const elements = {};
global.window = global;
global.document = { getElementById(id) { return elements[id] || (elements[id] = new Element()); } };
global.console = { ...console, error() {} };

require(path.join(root, "js/config.js"));
require(path.join(root, "js/utilities.js"));
require(path.join(root, "js/analytics/managementBank.js"));
require(path.join(root, "js/analytics/monthlyPremiumTrend.js"));

const facts = [
  { monthKey: "2025-04", premium: 60, bank: "INDIAN BANK", branchId: "IB1" },
  { monthKey: "2025-04", premium: 20, bank: "INDIAN BANK (PMSBY)", branchId: "IB2" },
  { monthKey: "2026-04", premium: 120, bank: "INDIAN BANK", branchId: "IB1" },
  { monthKey: "2026-04", premium: -20, bank: "INDIAN BANK (PMSBY)", branchId: "IB2" },
  { monthKey: "2025-05", premium: 0, bank: "INDIAN BANK", branchId: "IB1" },
  { monthKey: "2026-05", premium: 10, bank: "INDIAN BANK", branchId: "IB1" },
  { monthKey: "2025-06", premium: -10, bank: "INDIAN BANK", branchId: "IB1" },
  { monthKey: "2026-06", premium: 5, bank: "INDIAN BANK", branchId: "IB1" },
  { monthKey: "2025-07", premium: 50, bank: "INDIAN BANK", branchId: "IB1" },
  { monthKey: "2026-08", premium: 0, bank: "INDIAN BANK", branchId: "IB1" },
  { monthKey: "2025-09", premium: 10, bank: "INDIAN BANK", branchId: "IB1" },
  { monthKey: "2026-09", premium: -5, bank: "INDIAN BANK", branchId: "IB1" },
  { monthKey: "2025-04", premium: 20, bank: "INDIAN OVERSEAS BANK", branchId: "IOB1" },
  { monthKey: "2026-04", premium: 30, bank: "INDIAN OVERSEAS BANK", branchId: "IOB1" },
  { monthKey: "2026-04", premium: 5, bank: "UNMAPPED SYNTHETIC BANK", branchId: null },
];
global.BancaTrackerCore = { state: { factData: facts, commercialPerformance: { sentinel: "unchanged" } } };
global.BancaTrackerCommercialRollups = { buildPeriodContext() { return { availablePeriods: [], availableFinancialYears: [], latestAvailablePeriod: null, latestActualPeriod: null, defaultSelectedPeriod: null }; } };
require(path.join(root, "js/commercialPerformanceUI.js"));
const UI = global.BancaTrackerCommercialPerformanceUI;
const authority = global.BancaTrackerMonthlyPremiumTrend;
const factSnapshot = JSON.stringify(facts);
const commercialReference = BancaTrackerCore.state.commercialPerformance;

let result = UI.renderMonthlyTrend();
assert.strictEqual(UI.state.monthlyTrend.viewMode, "TREND", "A default view is TREND");
assert.match(elements.monthlyTrendTable.innerHTML, /Transaction Rows/);
assert.match(elements.monthlyTrendTable.innerHTML, /Previous Month Premium/);
assert.match(elements.monthlyTrendTable.innerHTML, /Same Month Previous FY Premium/);

result = UI.handleMonthlyTrendViewChange("YOY");
assert.strictEqual(elements.monthlyTrendView.value, "YOY");
const yoyHtml = elements.monthlyTrendTable.innerHTML;
for (const heading of ["Fiscal Month", "FY2025-26 Signed Net Premium", "FY2026-27 Signed Net Premium", "YoY Absolute Change", "YoY %", "Comparison Status", "Temporal Completeness"]) assert.match(yoyHtml, new RegExp(heading));
assert.doesNotMatch(yoyHtml, /Transaction Rows|Previous Month Premium/);
assert.strictEqual((yoyHtml.match(/<tr><td>/g) || []).length, 12, "B/C compact table renders exactly twelve data rows");
const fiscalLabels = ["Apr-26", "May-26", "Jun-26", "Jul-26", "Aug-26", "Sep-26", "Oct-26", "Nov-26", "Dec-26", "Jan-27", "Feb-27", "Mar-27"];
let preceding = -1;
fiscalLabels.forEach((label) => { const position = yoyHtml.indexOf(label); assert.ok(position > preceding, `C/I ${label} is present in fiscal order`); preceding = position; });

const overallApril = result.months[0];
assert.deepStrictEqual({ prior: overallApril.priorYearActualPremium, current: overallApril.actualPremium, absolute: overallApril.yoyAbsoluteChange, percent: overallApril.yoyPercentChange }, { prior: 100, current: 135, absolute: 35, percent: 35 }, "D authority values are projected without recalculation");
assert.match(yoyHtml, new RegExp(UI.money(100).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
assert.match(yoyHtml, /\+.*35/);
assert.match(yoyHtml, /35\.0%/);

result = UI.handleMonthlyTrendScopeChange("MANAGEMENT_BANK");
result = UI.handleMonthlyTrendBankChange("INDIAN BANK");
const indianApril = result.months[0];
assert.deepStrictEqual({ prior: indianApril.priorYearActualPremium, current: indianApril.actualPremium, absolute: indianApril.yoyAbsoluteChange, percent: indianApril.yoyPercentChange }, { prior: 80, current: 100, absolute: 20, percent: 25 }, "J/K Indian Bank core and PMSBY consolidate exactly once");
assert.strictEqual(result.diagnostics.sourceContributions.length >= 2, true);
assert.strictEqual(result.months[1].yoyStatus, "BASE_ZERO");
assert.strictEqual(result.months[1].yoyPercentChange, null);
assert.strictEqual(result.months[2].yoyStatus, "BASE_NON_POSITIVE");
assert.strictEqual(result.months[2].yoyPercentChange, null);
assert.strictEqual(result.months[3].yoyStatus, "CURRENT_MISSING");
assert.strictEqual(result.months[4].yoyStatus, "REFERENCE_MISSING");
assert.strictEqual(result.months[4].actualPremium, 0, "G observed zero remains distinct from missing");
assert.strictEqual(result.months[5].yoyAbsoluteChange, -15, "E signed negative change is preserved");
assert.match(elements.monthlyTrendTable.innerHTML, new RegExp(UI.money(0).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
assert.match(elements.monthlyTrendTable.innerHTML, /N\/A/);
assert.match(elements.monthlyTrendTable.innerHTML, /BASE ZERO|BASE NON POSITIVE|CURRENT MISSING|REFERENCE MISSING/);
assert.match(elements.monthlyTrendTable.innerHTML, /UNKNOWN/);
assert.match(elements.monthlyTrendTable.innerHTML, /not certified complete or elapsed-day aligned/);
assert.strictEqual(JSON.stringify(facts), factSnapshot, "L changing view/scope does not mutate factData");
assert.strictEqual(BancaTrackerCore.state.commercialPerformance, commercialReference, "P Commercial Performance state remains untouched");

UI.handleMonthlyTrendViewChange("TREND");
assert.match(elements.monthlyTrendTable.innerHTML, /Transaction Rows/);
UI.handleMonthlyTrendViewChange("YOY");
assert.doesNotMatch(elements.monthlyTrendTable.innerHTML, /Transaction Rows/);

const maliciousResult = {
  financialYear: "<img src=x onerror=alert(1)>",
  months: [{ periodKey: "2026-04", priorYearPeriodKey: "2025-04", priorYearActualPremium: 1, actualPremium: 2, yoyAbsoluteChange: 1, yoyPercentChange: 100, yoyStatus: "<script>alert(1)</script>", temporalCompleteness: "<b>UNKNOWN</b>" }],
};
UI.renderMonthlyTrendTable(maliciousResult);
assert.doesNotMatch(elements.monthlyTrendTable.innerHTML, /<img|<script|<b>UNKNOWN<\/b>/, "N authority-supplied display values are escaped");
assert.match(elements.monthlyTrendTable.innerHTML, /&lt;img|&lt;script|&lt;b&gt;UNKNOWN/);

const replacement = [{ monthKey: "2025-04", premium: 10, bank: "INDIAN BANK", branchId: "IB1" }, { monthKey: "2026-04", premium: 40, bank: "INDIAN BANK", branchId: "IB1" }];
BancaTrackerCore.state.factData = replacement;
UI.state.monthlyTrend.scopeType = "OVERALL";
result = UI.renderMonthlyTrend();
assert.deepStrictEqual({ prior: result.months[0].priorYearActualPremium, current: result.months[0].actualPremium, absolute: result.months[0].yoyAbsoluteChange }, { prior: 10, current: 40, absolute: 30 }, "M REPLACE reads the active fact universe without stale values");

BancaTrackerCore.state.factData = [];
result = UI.renderMonthlyTrend();
assert.strictEqual(result, null, "Q no-data state does not manufacture an analytical result");
assert.match(elements.monthlyTrendReadiness.innerHTML, /No valid canonical financial year/);
const originalAuthority = global.BancaTrackerMonthlyPremiumTrend;
global.BancaTrackerMonthlyPremiumTrend = { ...originalAuthority, buildMonthlyPremiumTrend() { throw new Error("synthetic render failure"); } };
BancaTrackerCore.state.factData = replacement;
UI.state.monthlyTrend.financialYear = "FY2026-27";
assert.doesNotThrow(() => UI.safeRenderMonthlyTrend(), "Q render failure is isolated");
assert.match(elements.monthlyTrendReadiness.textContent, /Existing Commercial Performance remains available/);
global.BancaTrackerMonthlyPremiumTrend = originalAuthority;

assert.ok(elements.monthlyTrendView.listeners.change, "view selector change listener is registered");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
assert.match(html, /<label for="monthlyTrendView">View<select id="monthlyTrendView">/);
assert.ok(html.indexOf('value="TREND"') < html.indexOf('value="YOY"'), "Monthly Trend remains the first/default option");
const source = fs.readFileSync(path.join(root, "js/commercialPerformanceUI.js"), "utf8");
const rendererSource = source.slice(source.indexOf("function renderMonthlyTrendTable"), source.indexOf("function renderMonthlyTrend()"));
assert.doesNotMatch(rendererSource, /\b(reduce|aggregate|rollup)\b/i, "presentation renderer does not introduce a second calculation authority");
assert.strictEqual(authority.buildMonthlyPremiumTrend(facts, { financialYear: "FY2026-27", scope: { type: "MANAGEMENT_BANK", managementBank: "INDIAN BANK" } }).months[0].actualPremium, 100);

console.log("v8.6.9 Monthly YoY Comparison UI tests passed: 12-month projection, signed/null/zero semantics, governed scopes, escaping, replacement refresh, and isolation.");
