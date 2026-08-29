/* Step 4J: governed Commercial Performance UI integration foundation. */
"use strict";
const assert = require("assert");
const fs = require("fs");
const path = require("path");

class Element {
  constructor() { this.innerHTML = ""; this.textContent = ""; this.value = ""; this.disabled = false; this.listeners = {}; }
  addEventListener(type, handler) { this.listeners[type] = handler; }
}
const elements = {};
global.window = global;
global.document = { getElementById(id) { return elements[id] || (elements[id] = new Element()); } };
["commercialScope", "commercialPeriod", "commercialFinancialYear", "commercialDimension", "commercialReadiness", "commercialKpis", "commercialTable"].forEach((id) => document.getElementById(id));
const load = (file) => require(path.join(__dirname, "..", file));
load("js/config.js");
load("js/utilities.js");

const calls = [];
const periodContext = { status: "READY", availablePeriods: ["2026-07", "2026-08", "2026-09"], availableFinancialYears: ["FY2026-27"], latestAvailablePeriod: "2026-09", latestActualPeriod: "2026-08", defaultSelectedPeriod: "2026-09" };
function summary(overrides = {}) { return { branchPeriods: 2, actualPremium: 0, budget: 100, achievementPct: 0, budgetGap: -100, potential: 200, potentialPenetrationPct: 0, budgetPresentCount: 2, budgetMissingCount: 0, potentialPresentCount: 2, potentialMissingCount: 0, ...overrides }; }
global.BancaTrackerCommercialRollups = {
  buildPeriodContext(performance) { return performance ? periodContext : { status: "NO_PERIODS", availablePeriods: [], availableFinancialYears: [], latestAvailablePeriod: null, latestActualPeriod: null, defaultSelectedPeriod: null }; },
  getFinancialYear() { return "FY2026-27"; },
  buildRollup(performance, scope, dimension) {
    calls.push({ performance, scope, dimension });
    const common = { status: performance.status || "READY", summary: summary(), diagnostics: { ...periodContext, uniqueExcludedFactCount: 3 } };
    if (dimension === "OVERALL") return { ...common, rows: [{ key: "ALL", label: "Overall", ...common.summary }] };
    return { ...common, rows: [
      { key: "BANK-A", label: "Bank A", ...summary() },
      { key: "__UNMAPPED__", label: "Unmapped", ...summary({ actualPremium: -50000, budget: null, achievementPct: null, budgetGap: null, potential: null, potentialPenetrationPct: null, budgetPresentCount: 0, budgetMissingCount: 1, potentialPresentCount: 0, potentialMissingCount: 1 }) },
      { key: "ZERO", label: "Zero Activity", ...summary() },
    ] };
  },
};
global.BancaTrackerCore = { state: { commercialPerformance: null } };
global.BancaTrackerLiveGeographyAuthority = { getCachedContext() { return {}; } };
load("js/commercialPerformanceUI.js");
const UI = BancaTrackerCommercialPerformanceUI;

assert.strictEqual(UI.state.scopeType, "MONTH");
assert.strictEqual(UI.state.dimension, "BANK");
assert.doesNotThrow(() => UI.render());
assert.match(elements.commercialTable.innerHTML, /No commercial periods are available/);

BancaTrackerCore.state.commercialPerformance = { status: "PARTIAL", rows: [{}] };
let result = UI.render();
assert.strictEqual(UI.state.selectedPeriod, "2026-09");
assert.match(elements.commercialPeriod.innerHTML, /2026-09/);
assert.match(elements.commercialReadiness.innerHTML, /PARTIAL/);
assert.match(elements.commercialReadiness.innerHTML, /Sep-26/);
assert.match(elements.commercialReadiness.innerHTML, /Aug-26/);
assert.match(elements.commercialReadiness.innerHTML, /Commercial exclusions: 3 rows/);
assert.strictEqual(calls.at(-2).dimension, "OVERALL");
assert.strictEqual(calls.at(-1).dimension, "BANK");
assert.match(elements.commercialKpis.innerHTML, /₹0/);
assert.match(elements.commercialKpis.innerHTML, /₹100/);
assert.match(elements.commercialKpis.innerHTML, /0\.0%/);
assert.match(elements.commercialKpis.innerHTML, /-₹100/);
assert.match(elements.commercialTable.innerHTML, /Unmapped/);
assert.match(elements.commercialTable.innerHTML, /Zero Activity/);
assert.match(elements.commercialTable.innerHTML, /-₹50,000/);
assert.match(elements.commercialTable.innerHTML, /N\/A/);
assert.match(elements.commercialTable.innerHTML, /data-dimension-key="__UNMAPPED__"/);
assert.ok(result.overall !== result.table);

UI.handlePeriodChange("2026-08");
assert.deepStrictEqual(calls.at(-1).scope, { type: "MONTH", periodKey: "2026-08" });
UI.handleScopeChange("YTD");
assert.deepStrictEqual(calls.at(-1).scope, { type: "YTD", periodKey: "2026-08" });
UI.handleScopeChange("FY");
assert.deepStrictEqual(calls.at(-1).scope, { type: "FY", financialYear: "FY2026-27" });
assert.strictEqual(elements.commercialFinancialYear.disabled, false);
UI.handleDimensionChange("ZONE");
assert.strictEqual(calls.at(-1).dimension, "ZONE");
assert.strictEqual(calls.at(-2).dimension, "OVERALL");

UI.renderKpis(summary({ budget: 0, achievementPct: null, potential: 0, potentialPenetrationPct: null }));
assert.match(elements.commercialKpis.innerHTML, /₹0/);
assert.match(elements.commercialKpis.innerHTML, /N\/A/);
UI.renderKpis(summary({ actualPremium: -50000, achievementPct: -25, budgetGap: -250000, potentialPenetrationPct: 125 }));
assert.match(elements.commercialKpis.innerHTML, /-₹50,000/);
assert.match(elements.commercialKpis.innerHTML, /-25\.0%/);
assert.match(elements.commercialKpis.innerHTML, /125\.0%/);

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const app = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
const css = fs.readFileSync(path.join(__dirname, "..", "style.css"), "utf8");
const source = fs.readFileSync(path.join(__dirname, "..", "js/commercialPerformanceUI.js"), "utf8");
assert.match(html, /id="commercialPage"/);
assert.match(html, /id="commercialTab">Commercial Performance/);
assert.match(app, /commercialTab", "commercialPage/);
for (const id of ["commercialScope", "commercialPeriod", "commercialFinancialYear", "commercialDimension"]) assert.match(html, new RegExp(`for="${id}"`));
assert.match(css, /commercial-table-wrap[^}]*overflow-x: auto/);
assert.match(css, /@media\(max-width:900px\)/);
for (const forbidden of [/actualPremium\s*\/\s*\w+budget/i, /actualPremium\s*\/\s*\w*potential/i, /actualPremium\s*-\s*\w*budget/i, /budget\s*-\s*\w*actualPremium/i, /potential\s*-\s*\w*actualPremium/i]) assert.doesNotMatch(source, forbidden);
for (const untouched of ["js/target.js", "js/activation.js", "js/scorecard.js", "js/productivity.js", "js/performance.js"]) assert.ok(!require("child_process").execFileSync("git", ["diff", "--name-only", "--", untouched], { cwd: path.join(__dirname, ".."), encoding: "utf8" }).trim());

console.log("Step 4J Commercial Performance UI tests passed: page/navigation, empty states, governed controls and dual roll-ups, KPI/table rendering, edge values, coverage/readiness, accessibility, responsive structure, no formulas/reads, and legacy-page preservation.");
