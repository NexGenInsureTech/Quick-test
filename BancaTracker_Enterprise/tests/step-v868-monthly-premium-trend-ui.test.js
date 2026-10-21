/* v8.6.8 Increment 1: Monthly Net Premium Trend UI contract. */
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
global.BancaTrackerCore = { state: { factData: [
  { monthKey: "2025-04", premium: 50, bank: "INDIAN BANK", branchId: "B1" },
  { monthKey: "2026-04", premium: 100, bank: "INDIAN BANK", branchId: "B1" },
  { monthKey: "2026-04", premium: -100, bank: "INDIAN BANK (PMSBY)", branchId: "B2" },
  { monthKey: "2026-05", premium: -5, bank: "INDIAN OVERSEAS BANK", branchId: "B3" },
] } };
global.BancaTrackerCommercialRollups = { buildPeriodContext() { return { availablePeriods: [], availableFinancialYears: [], latestAvailablePeriod: null, latestActualPeriod: null, defaultSelectedPeriod: null }; } };
require(path.join(root, "js/commercialPerformanceUI.js"));
const UI = BancaTrackerCommercialPerformanceUI;
let result = UI.renderMonthlyTrend();
assert.strictEqual(result.months.length, 12);
assert.match(elements.monthlyTrendFinancialYear.innerHTML, /FY2025-26/);
assert.match(elements.monthlyTrendFinancialYear.innerHTML, /FY2026-27/);
assert.match(elements.monthlyTrendTable.innerHTML, /Signed Net Premium \(USGI NET PREMIUM\)/);
assert.match(elements.monthlyTrendTable.innerHTML, /No observed data/);
assert.match(elements.monthlyTrendTable.innerHTML, /₹0/);
assert.match(elements.monthlyTrendTable.innerHTML, /-₹5/);
assert.match(elements.monthlyTrendTable.innerHTML, /N\/A/);
assert.match(elements.monthlyTrendTable.innerHTML, /UNKNOWN/);
assert.doesNotMatch(elements.monthlyTrendTable.innerHTML, /Policy Count|GWP/);
result = UI.handleMonthlyTrendScopeChange("MANAGEMENT_BANK");
assert.strictEqual(result.scope.type, "MANAGEMENT_BANK");
assert.strictEqual(elements.monthlyTrendBankControl.hidden, false);
UI.handleMonthlyTrendBankChange("INDIAN OVERSEAS BANK");
assert.strictEqual(UI.state.monthlyTrend.managementBank, "INDIAN OVERSEAS BANK");
assert.match(elements.monthlyTrendTable.innerHTML, /-₹5/);

const original = BancaTrackerMonthlyPremiumTrend;
global.BancaTrackerMonthlyPremiumTrend = { ...original, buildMonthlyPremiumTrend() { throw new Error("synthetic renderer failure"); } };
assert.doesNotThrow(() => UI.safeRenderMonthlyTrend(), "T29 renderer failure is isolated");
assert.match(elements.monthlyTrendReadiness.textContent, /Existing Commercial Performance remains available/);
global.BancaTrackerMonthlyPremiumTrend = original;
const replacement = [{ monthKey: "2026-04", premium: 12, bank: "INDIAN BANK", branchId: "B1" }];
BancaTrackerCore.state.factData = replacement;
UI.state.monthlyTrend.scopeType = "OVERALL";
result = UI.renderMonthlyTrend();
assert.strictEqual(result.months[0].actualPremium, 12, "T27 reads the replaced active universe");
assert.doesNotMatch(elements.monthlyTrendTable.innerHTML, /-₹5/, "stale prior result removed");

const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const source = fs.readFileSync(path.join(root, "js/commercialPerformanceUI.js"), "utf8");
assert.match(html, /Monthly Net Premium Trend/);
assert.match(html, /Signed Net Premium \(USGI NET PREMIUM\)/);
assert.ok(html.indexOf("monthlyPremiumTrend.js") < html.indexOf("commercialPerformanceUI.js"));
for (const id of ["monthlyTrendFinancialYear", "monthlyTrendScope", "monthlyTrendBank", "monthlyTrendReadiness", "monthlyTrendTable"]) assert.match(html, new RegExp(`id="${id}"`));
assert.match(source, /escape\(trendStatus/);
assert.match(source, /safeRenderMonthlyTrend/);
assert.doesNotMatch(source, /Policy Count|Premium per Policy|\bGWP\b/);
console.log("v8.6.8 Monthly Net Premium Trend UI tests passed: dynamic FY, scope switching, missing/zero/signed rendering, escaping boundary, replacement refresh, and isolated failure.");
