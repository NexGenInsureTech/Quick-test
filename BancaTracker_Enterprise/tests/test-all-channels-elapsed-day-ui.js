/* Post-v8.4.1 Slice 4: All Channels equivalent elapsed-day UI adapter. */
"use strict";
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

class Element {
  constructor() { this.innerHTML = ""; this.textContent = ""; this.value = ""; this.disabled = false; this.hidden = false; this.listeners = {}; }
  addEventListener(type, handler) { this.listeners[type] = handler; }
}
const elements = {};
global.window = global;
global.document = { getElementById(id) { return elements[id] || (elements[id] = new Element()); } };
const root = path.join(__dirname, "..");
require(path.join(root, "js/utilities.js"));

const basePeriod = "2026-07";
const comparisonPeriod = "2026-08";
const periodContext = { availablePeriods: [basePeriod, comparisonPeriod], availableFinancialYears: ["FY2026-27"], latestAvailablePeriod: comparisonPeriod, latestActualPeriod: comparisonPeriod, defaultSelectedPeriod: comparisonPeriod };
const dimensions = ["OVERALL", "BANK", "BRANCH", "STATE", "ZONE", "BANK_REGION", "BANK_ZONE", "FGM_OFFICE", "ASSIGNED_RM", "CSM", "ASM", "ZSM", "NATIONAL_HEAD"];
function compareActual(base, comparison) { const actualChange = comparison - base; return { actualChange, actualChangePct: base > 0 ? actualChange / base * 100 : null, actualDirection: actualChange > 0 ? "UP" : actualChange < 0 ? "DOWN" : "FLAT" }; }
global.BancaTrackerCommercialComparison = {
  validateComparisonPeriods(context, base, comparison) { return { valid: context.availablePeriods.includes(base) && context.availablePeriods.includes(comparison), status: "INVALID_PERIOD", samePeriod: base === comparison }; },
  compareActual,
};
global.BancaTrackerDailyCommercialComparison = {
  getDaysInPeriod(period) { const [year, month] = period.split("-").map(Number); return new Date(Date.UTC(year, month, 0)).getUTCDate(); },
};
global.BancaTrackerCommercialRollups = {
  DIMENSIONS: dimensions,
  buildPeriodContext() { return periodContext; },
  getFinancialYear() { return "FY2026-27"; },
  buildMetadataIndex() { return new Map(); },
  attachMetadata(rows) { return rows.map((row) => ({ ...row })); },
  getDimensionValue(row, dimension) {
    if (dimension === "OVERALL") return { key: "ALL", label: "Overall" };
    if (dimension === "BANK") return row.bank ? { key: row.bank, label: row.bank } : { key: "__UNMAPPED__", label: "Unmapped" };
    if (dimension === "BRANCH") return { key: row.branchId || "__UNMAPPED__", label: row.branch || "Unmapped" };
    return { key: "__UNMAPPED__", label: "Unmapped" };
  },
};
vm.runInThisContext(fs.readFileSync(path.join(root, "js/analytics/equivalentElapsedDayComparison.js"), "utf8"), { filename: "equivalentElapsedDayComparison.js" });
const realAuthority = BancaTrackerEquivalentElapsedDayComparison;
const calls = [];
global.BancaTrackerEquivalentElapsedDayComparison = { buildComparison(options) { calls.push(options); return realAuthority.buildComparison(options); } };

const facts = [
  { monthKey: basePeriod, day: 1, premium: 100.25, bank: "BANK A", branchId: "A" },
  { monthKey: basePeriod, day: 3, premium: -25.5, bank: "BANK A", branchId: "A" },
  { monthKey: comparisonPeriod, day: 1, premium: 120.75, bank: "BANK A", branchId: "A" },
  { monthKey: comparisonPeriod, day: 4, premium: -20.25, bank: "BANK A", branchId: "A" },
  { monthKey: basePeriod, day: 2, premium: 40, bank: "BANK B", branchId: "B" },
  { monthKey: comparisonPeriod, day: 2, premium: 10, bank: "BANK B", branchId: "B" },
  { monthKey: basePeriod, day: 1, premium: 5, bank: "ALL", branchId: "LITERAL-ALL" },
  { monthKey: comparisonPeriod, day: 1, premium: 7, bank: "ALL", branchId: "LITERAL-ALL" },
  { monthKey: basePeriod, day: 1, premium: 3, bank: "UNKNOWN BANK", branchId: "UNKNOWN" },
  { monthKey: comparisonPeriod, day: 1, premium: 4, bank: "UNKNOWN BANK", branchId: "UNKNOWN" },
  { monthKey: basePeriod, day: 1, premium: 2, bank: "", branchId: "DEFENSIVE" },
  { monthKey: comparisonPeriod, day: 1, premium: 1, bank: null, branchId: "DEFENSIVE" },
];
const sourceSnapshot = JSON.stringify(facts);
let scopedFacts = facts;
global.BancaTrackerCore = {
  state: { factData: facts, filters: { month: "ALL", bank: "ALL" }, commercialPerformance: { status: "READY", rows: [{}] } },
  getPerformanceContext() { return { fullUploadData: scopedFacts }; },
};
global.BancaTrackerLiveGeographyAuthority = { getCachedContext() { return {}; } };
let exportedRows = null;
global.BancaTrackerCsvExport = {
  serializeCsv({ rows }) { exportedRows = rows; return "csv"; },
  buildFilename() { return "pace.csv"; },
  downloadCsv(value) { return value; },
};
require(path.join(root, "js/commercialPerformanceUI.js"));
const UI = BancaTrackerCommercialPerformanceUI;
UI.state.comparison.basePeriod = basePeriod;
UI.state.comparison.comparisonPeriod = comparisonPeriod;
UI.state.comparison.dimension = "BANK";
UI.state.comparison.paceThroughDay = null;
UI.state.comparison.paceSelectionMode = "ALL_CHANNELS";
UI.state.comparison.paceEntityKey = null;

let selected = UI.renderPace(periodContext, BancaTrackerCore.state.commercialPerformance, {});
const options = elements.paceEntity.innerHTML;
assert.ok(options.indexOf("All Channels") < options.indexOf("BANK A"), "All Channels must precede specific channels");
for (const label of ["BANK A", "BANK B", "UNKNOWN BANK", "Unmapped"]) assert.match(options, new RegExp(label));
assert.strictEqual(UI.state.comparison.paceSelectionMode, "ALL_CHANNELS");
assert.strictEqual(selected.dimension, "OVERALL");
assert.match(elements.paceKpis.innerHTML, /Base Month Premium Through Day/);
assert.match(elements.paceKpis.innerHTML, /₹/);
assert.strictEqual(calls.at(-2).dimension, "BANK");
assert.strictEqual(calls.at(-1).dimension, "OVERALL");
assert.strictEqual(calls.at(-2).facts, calls.at(-1).facts, "BANK and OVERALL must receive the identical scoped fact array");
assert.strictEqual(calls.at(-1).facts, facts);
assert.strictEqual(selected.effectiveThroughDay, calls.length && realAuthority.buildComparison({ ...calls.at(-2) }).effectiveThroughDay);

UI.handlePaceEntityChange("BANK B");
assert.strictEqual(UI.state.comparison.paceSelectionMode, "ENTITY");
assert.strictEqual(UI.state.comparison.paceEntityKey, "BANK B");
assert.match(elements.paceChart.innerHTML, /BANK B/);
UI.renderPace(periodContext, BancaTrackerCore.state.commercialPerformance, {});
assert.strictEqual(UI.state.comparison.paceEntityKey, "BANK B", "valid specific selection must survive rerender");

UI.handlePaceEntityChange("__PACE_ALL_CHANNELS__");
UI.renderPace(periodContext, BancaTrackerCore.state.commercialPerformance, {});
assert.strictEqual(UI.state.comparison.paceSelectionMode, "ALL_CHANNELS", "aggregate selection must survive month rerender");

UI.handlePaceEntityChange("ALL");
assert.strictEqual(UI.state.comparison.paceSelectionMode, "ENTITY", "literal BANK key ALL must remain distinct from aggregate selection");
assert.strictEqual(UI.state.comparison.paceEntityKey, "ALL");
assert.match(elements.paceChart.innerHTML, /for ALL/);

UI.handlePaceEntityChange("BANK B");
scopedFacts = facts.filter((row) => row.bank === "BANK A");
BancaTrackerCore.state.filters.bank = "BANK A";
BancaTrackerCore.state.filters.month = comparisonPeriod;
UI.renderPace(periodContext, BancaTrackerCore.state.commercialPerformance, {});
assert.strictEqual(UI.state.comparison.paceSelectionMode, "ALL_CHANNELS", "disappearing selection must fall back to All Channels");
assert.doesNotMatch(elements.paceEntity.innerHTML, /BANK B/);
assert.ok(calls.at(-1).facts.every((row) => row.bank === "BANK A"), "selected global Bank scope must be respected");
assert.deepStrictEqual([...new Set(calls.at(-1).facts.map((row) => row.monthKey))].sort(), [basePeriod, comparisonPeriod], "global Month must not collapse independent comparison months");

scopedFacts = facts;
UI.state.comparison.dimension = "BRANCH";
UI.state.comparison.paceSelectionMode = "ENTITY";
UI.state.comparison.paceEntityKey = null;
UI.renderPace(periodContext, BancaTrackerCore.state.commercialPerformance, {});
assert.doesNotMatch(elements.paceEntity.innerHTML, /All Channels/, "non-BANK dimensions must retain existing entity behavior");
assert.strictEqual(UI.state.comparison.paceSelectionMode, "ENTITY");

const common = { facts, periodContext, basePeriod, comparisonPeriod };
const overall = realAuthority.buildComparison({ ...common, dimension: "OVERALL" });
const banks = realAuthority.buildComparison({ ...common, dimension: "BANK" });
assert.strictEqual(overall.effectiveThroughDay, banks.effectiveThroughDay, "overall and BANK horizons must match");
const overallEntity = overall.entities[0];
for (let index = 0; index < overallEntity.days.length; index += 1) {
  const allDay = overallEntity.days[index];
  const bankDay = banks.entities.reduce((sum, entity) => ({
    baseDailyActual: sum.baseDailyActual + entity.days[index].baseDailyActual,
    comparisonDailyActual: sum.comparisonDailyActual + entity.days[index].comparisonDailyActual,
    baseCumulativeActual: sum.baseCumulativeActual + entity.days[index].baseCumulativeActual,
    comparisonCumulativeActual: sum.comparisonCumulativeActual + entity.days[index].comparisonCumulativeActual,
  }), { baseDailyActual: 0, comparisonDailyActual: 0, baseCumulativeActual: 0, comparisonCumulativeActual: 0 });
  assert.deepStrictEqual([allDay.baseDailyActual, allDay.comparisonDailyActual], [bankDay.baseDailyActual, bankDay.comparisonDailyActual], `daily reconciliation day ${allDay.day}`);
  assert.deepStrictEqual([allDay.baseCumulativeActual, allDay.comparisonCumulativeActual], [bankDay.baseCumulativeActual, bankDay.comparisonCumulativeActual], `cumulative reconciliation day ${allDay.day}`);
}
assert.strictEqual(overallEntity.summary.baseThroughDayActual, banks.entities.reduce((sum, entity) => sum + entity.summary.baseThroughDayActual, 0));
assert.strictEqual(overallEntity.summary.comparisonThroughDayActual, banks.entities.reduce((sum, entity) => sum + entity.summary.comparisonThroughDayActual, 0));
assert.strictEqual(overallEntity.summary.growthPct, compareActual(overallEntity.summary.baseThroughDayActual, overallEntity.summary.comparisonThroughDayActual).actualChangePct, "aggregate growth must be recomputed from aggregate totals");
assert.ok(banks.entities.some((entity) => entity.key === "UNKNOWN BANK"));
assert.ok(banks.entities.some((entity) => entity.key === "__UNMAPPED__"));
assert.ok(overallEntity.days.some((day) => day.baseDailyActual < 0 || day.comparisonDailyActual < 0), "signed premiums must remain signed in aggregate daily values");

UI.state.comparison.dimension = "BANK";
UI.state.comparison.paceSelectionMode = "ALL_CHANNELS";
UI.state.comparison.paceEntityKey = null;
const aggregateExportResult = UI.renderPace(periodContext, BancaTrackerCore.state.commercialPerformance, {});
UI.exportPace();
assert.strictEqual(exportedRows, aggregateExportResult.entities[0].days, "All Channels export must use the selected aggregate day rows");
assert.ok(exportedRows.some((row) => !Number.isInteger(row.baseDailyActual)), "export selection must retain raw fractional precision");

scopedFacts = [];
UI.renderPace(periodContext, BancaTrackerCore.state.commercialPerformance, {});
assert.match(elements.paceTable.innerHTML, /No equivalent elapsed-day detail is available/);
assert.strictEqual(JSON.stringify(facts), sourceSnapshot, "source facts must not be mutated");

const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
assert.match(html, /Equivalent Elapsed-Day Comparison/);
assert.match(html, /Compares the Base Month and Comparison Month through the same valid transaction-day horizon/);
assert.match(fs.readFileSync(path.join(root, "js/commercialPerformanceUI.js"), "utf8"), /formatRupees/);
assert.ok(fs.existsSync(path.join(root, "js/dataQualityGuidance.js")), "Slice 3 guidance must remain present");

console.log("Slice 4 All Channels UI tests passed: scoped aggregate selection, collision safety, persistence, horizon, signed reconciliation, export precision, and authority isolation.");
