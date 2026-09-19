/* v8.4 Step 4B: Equivalent Day Pace UI consumes authority output only. */
"use strict";
const assert = require("assert");
const fs = require("fs");
const path = require("path");

class Element {
  constructor() { this.innerHTML = ""; this.textContent = ""; this.value = ""; this.disabled = false; this.hidden = false; this.listeners = {}; }
  addEventListener(type, handler) { this.listeners[type] = handler; }
}
const elements = {};
global.window = global;
global.document = { getElementById(id) { return elements[id] || (elements[id] = new Element()); } };
require(path.join(__dirname, "..", "js/config.js"));
require(path.join(__dirname, "..", "js/utilities.js"));

const periodContext = { availablePeriods: ["2026-07", "2026-08"], availableFinancialYears: ["FY2026-27"], latestAvailablePeriod: "2026-08", latestActualPeriod: "2026-08", defaultSelectedPeriod: "2026-08" };
global.BancaTrackerCommercialRollups = {
  buildPeriodContext() { return periodContext; },
  getFinancialYear() { return "FY2026-27"; },
  buildRollup() { return { status: "READY", diagnostics: {}, summary: { actualPremium: 0, budget: 0, achievementPct: null, budgetGap: 0, potential: 0, potentialPenetrationPct: null, budgetPresentCount: 0, budgetMissingCount: 0, potentialPresentCount: 0, potentialMissingCount: 0 }, rows: [] }; },
};
global.BancaTrackerCore = { state: { commercialPerformance: { status: "READY", rows: [{}] }, factData: [{ marker: "authority-owned" }] } };
global.BancaTrackerLiveGeographyAuthority = { getCachedContext() { return { marker: "context" }; } };
const calls = [];
let forcedStatus = null;
function entity(key, label) {
  return { key, label, summary: { throughDay: 3, baseThroughDayActual: -777, comparisonThroughDayActual: 333, absoluteGap: 1110, growthPct: null }, days: [
    { day: 1, baseDailyActual: -700, comparisonDailyActual: 100, dailyAbsoluteChange: 800, baseCumulativeActual: -700, comparisonCumulativeActual: 100, cumulativeAbsoluteChange: 800, cumulativeGrowthPct: null },
    { day: 2, baseDailyActual: 0, comparisonDailyActual: 200, dailyAbsoluteChange: 200, baseCumulativeActual: -700, comparisonCumulativeActual: 300, cumulativeAbsoluteChange: 1000, cumulativeGrowthPct: null },
    { day: 3, baseDailyActual: -77, comparisonDailyActual: 33, dailyAbsoluteChange: 110, baseCumulativeActual: -777, comparisonCumulativeActual: 333, cumulativeAbsoluteChange: 1110, cumulativeGrowthPct: null },
  ] };
}
global.BancaTrackerEquivalentElapsedDayComparison = { buildComparison(options) {
  calls.push(options);
  if (forcedStatus) return { status: forcedStatus, basePeriod: options.basePeriod, comparisonPeriod: options.comparisonPeriod, entities: [], effectiveThroughDay: null };
  if (options.throughDay === 9) return { status: "INVALID_THROUGH_DAY", entities: [], effectiveThroughDay: null };
  return { status: "PARTIAL", basePeriod: options.basePeriod, comparisonPeriod: options.comparisonPeriod, dimension: options.dimension, effectiveThroughDay: 3, entities: options.dimension === "OVERALL" ? [entity("ALL", "Overall")] : [entity("BANK-A", "Bank A"), entity("BANK-B", "Bank B")] };
} };
require(path.join(__dirname, "..", "js/commercialPerformanceUI.js"));
const UI = BancaTrackerCommercialPerformanceUI;

UI.state.comparison.basePeriod = "2026-07";
UI.state.comparison.comparisonPeriod = "2026-08";
UI.state.comparison.dimension = "OVERALL";
UI.render();
assert.strictEqual(calls.at(-1).throughDay, null);
assert.strictEqual(UI.state.comparison.paceThroughDay, 3);
assert.strictEqual(elements.paceEntityControl.hidden, true);
assert.match(elements.paceReadiness.innerHTML, /Partial data/);
assert.match(elements.paceReadiness.innerHTML, /Compared through observed Day 3/);
assert.match(elements.paceObservationNote.textContent, /does not confirm complete source availability/);
assert.match(elements.paceKpis.innerHTML, /-₹777/);
assert.match(elements.paceKpis.innerHTML, /₹333/);
assert.match(elements.paceKpis.innerHTML, /N\/A/);
assert.match(elements.paceTable.innerHTML, /-₹700/);
assert.match(elements.paceTable.innerHTML, /Base Month Daily Premium/);
assert.match(elements.paceTable.innerHTML, /Comparison Month Daily Premium/);
assert.match(elements.paceTable.innerHTML, /Base Month Cumulative Premium/);
assert.match(elements.paceTable.innerHTML, /Comparison Month Cumulative Premium/);
assert.match(elements.paceChart.innerHTML, /<svg/);
assert.doesNotMatch(elements.paceChart.innerHTML, /NaN|Infinity/);

for (const [status, wording] of [["READY", "Ready"], ["SAME_PERIOD", "Same month selected"], ["NO_VALID_DATED_FACTS", "No valid dated transactions"], ["INVALID_THROUGH_DAY", "Choose a day within the shared observed horizon"], ["NO_PERIODS", "No comparison months are available"]]) {
  forcedStatus = status;
  UI.renderPace(periodContext, BancaTrackerCore.state.commercialPerformance, {});
  assert.match(elements.paceReadiness.innerHTML, new RegExp(wording));
}
forcedStatus = null;

UI.handlePaceThroughDayChange(2);
assert.strictEqual(calls.at(-1).throughDay, 2);
UI.state.comparison.paceThroughDay = 9;
UI.render();
assert.strictEqual(UI.state.comparison.paceThroughDay, 3);
assert.strictEqual(calls.at(-1).throughDay, null);

UI.handleComparisonDimensionChange("BANK");
assert.strictEqual(elements.paceEntityControl.hidden, false);
assert.match(elements.paceEntity.innerHTML, /value="BANK-A"/);
UI.handlePaceEntityChange("BANK-B");
assert.strictEqual(UI.state.comparison.paceEntityKey, "BANK-B");
assert.match(elements.paceChart.innerHTML, /Bank B/);

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
assert.ok(html.indexOf('id="dailyMovementTable"') < html.indexOf('id="paceComparisonHeading"'));
assert.ok(html.indexOf('id="paceComparisonHeading"') < html.indexOf('id="commercialExecutionHeading"'));
for (const id of ["comparisonBasePeriod", "comparisonPeriod", "comparisonDimension", "paceThroughDay", "paceEntity", "paceReadiness", "paceKpis", "paceChart", "paceTable"]) assert.match(html, new RegExp(`id="${id}"`));
assert.ok(html.indexOf("js/analytics/dailyCommercialComparison.js") < html.indexOf("js/analytics/equivalentElapsedDayComparison.js"));
assert.ok(html.indexOf("js/analytics/equivalentElapsedDayComparison.js") < html.indexOf("js/analytics/branchMaturityComparison.js"));
assert.match(html, /Equivalent Elapsed-Day Comparison/);
assert.match(html, /Equivalent Elapsed-Day Detail/);
assert.match(html, /Compares the Base Month and Comparison Month through the same valid transaction-day horizon/);
assert.ok(html.indexOf("js/analytics/branchMaturityComparison.js") < html.indexOf("js/export/csvExport.js"));
assert.ok(html.indexOf("js/export/csvExport.js") < html.indexOf("js/analytics/commercialExecution.js"));
assert.doesNotMatch(html, /paceExport|maturityComparisonHeading/);
console.log("v8.4 equivalent day pace UI tests passed: registered runtime, authority-only controls/results, horizon messaging, SVG/table rendering, and deferred export/maturity UI.");
