/* Post-v8.4.1 Slice 6: Branch Movement export discoverability and state hardening. */
"use strict";
const assert = require("assert");
const fs = require("fs");
const path = require("path");

class Element {
  constructor() { this.innerHTML = ""; this.textContent = ""; this.value = ""; this.disabled = false; this.hidden = false; this.listeners = {}; }
  addEventListener(type, listener) { this.listeners[type] = listener; }
  insertAdjacentHTML(_position, markup) { this.inserted = (this.inserted || "") + markup; maturityMarkupInserted = true; }
  click() { return this.listeners.click ? this.listeners.click() : null; }
}
const elements = {};
let maturityMarkupInserted = false;
global.window = global;
global.document = { getElementById(id) { if (id === "maturityHeading" && !maturityMarkupInserted) return null; return elements[id] || (elements[id] = new Element()); } };
const root = path.join(__dirname, "..");
require(path.join(root, "js/config.js"));
require(path.join(root, "js/utilities.js"));
require(path.join(root, "js/export/csvExport.js"));

const periods = ["2026-07", "2026-08", "2026-09"];
let periodContext = { availablePeriods: periods, availableFinancialYears: ["FY2026-27"], latestAvailablePeriod: periods[2], latestActualPeriod: periods[2], defaultSelectedPeriod: periods[2] };
global.BancaTrackerCommercialRollups = {
  buildPeriodContext() { return periodContext; },
  getFinancialYear() { return "FY2026-27"; },
  buildRollup() { return { status: "READY", diagnostics: {}, summary: { actualPremium: 0, budget: 0, achievementPct: null, budgetGap: 0, potential: 0, potentialPenetrationPct: null, budgetPresentCount: 0, budgetMissingCount: 0, potentialPresentCount: 0, potentialMissingCount: 0 }, rows: [] }; }
};
global.BancaTrackerCore = { state: { commercialPerformance: { status: "READY", rows: [{}] }, factData: [] } };
global.BancaTrackerLiveGeographyAuthority = { getCachedContext() { return {}; } };

const summary = (rows) => ({ upgradedCount: rows.filter((row) => row.movement === "UPGRADED").length, unchangedCount: rows.filter((row) => row.movement === "UNCHANGED").length, downgradedCount: rows.filter((row) => row.movement === "DOWNGRADED").length, zeroToActiveCount: rows.filter((row) => row.specialMovement === "ZERO_TO_ACTIVE").length, activeToZeroCount: rows.filter((row) => row.specialMovement === "ACTIVE_TO_ZERO").length, nonComparableCount: rows.filter((row) => row.movement === "NOT_COMPARABLE").length });
const movementRows = Array.from({ length: 137 }, (_, index) => ({
  branchId: `ID-${index}`,
  branchName: index === 0 ? 'Branch, "Quoted"' : index === 1 ? "Branch\nLine" : `Branch ${String(index).padStart(3, "0")}`,
  canonicalBank: "Bank A", stateName: "State", zoneName: "Zone",
  baseMonth: periods[0], basePremium: index === 0 ? 0 : index === 1 ? -123.456 : index + 0.125,
  baseBand: index === 0 ? "Zero" : "25K - 49.9K", baseBandIndex: index === 0 ? 0 : 3,
  comparisonMonth: periods[1], comparisonPremium: index === 2 ? null : index + 1.875,
  comparisonBand: index === 2 ? null : "50K - 99.9K", comparisonBandIndex: index === 2 ? null : 4,
  movement: index === 2 ? "NOT_COMPARABLE" : index % 3 === 0 ? "UNCHANGED" : index % 3 === 1 ? "UPGRADED" : "DOWNGRADED",
  specialMovement: index === 0 ? "ZERO_TO_ACTIVE" : index === 5 ? "ACTIVE_TO_ZERO" : null,
  presenceStatus: index === 2 ? "BASE_ONLY" : index === 3 ? "COMPARISON_ONLY" : "BOTH"
}));
const currentRows = [{ ...movementRows[10], branchId: "CURRENT-1", branchName: "Current Transition", baseMonth: periods[1], comparisonMonth: periods[2], basePremium: 123.4567, comparisonPremium: 234.5678 }];
const transition = (baseMonth, comparisonMonth, rows) => ({ baseMonth, comparisonMonth, rows, summary: summary(rows) });
let authorityResult = { status: "READY", dimension: "OVERALL", selectedPeriods: periods, diagnostics: {}, entities: [{ key: "ALL", label: "Overall", monthlyDistributions: periods.map((periodKey) => ({ periodKey, populationCount: 1, bands: Array.from({ length: 7 }, (_, index) => ({ band: `Band ${index}`, orderedBandIndex: index, branchCount: index, percentageOfPopulation: index, signedPremium: index })) })), transitions: [transition(periods[0], periods[1], movementRows), transition(periods[1], periods[2], currentRows)] }] };
global.BancaTrackerBranchMaturityComparison = { buildComparison() { return authorityResult; } };

require(path.join(root, "js/commercialPerformanceUI.js"));
const UI = BancaTrackerCommercialPerformanceUI;
const source = fs.readFileSync(path.join(root, "js/commercialPerformanceUI.js"), "utf8");
const markup = elements.commercialPage.inserted;
assert.match(markup, /commercial-movement-header[^]*maturityMovementHeading[^]*maturityMovementExport/);
assert.strictEqual((markup.match(/<button id="maturityMovementExport"/g) || []).length, 1, "one logical movement export action exists");
assert.match(source, /const MATURITY_LIMIT = 100/);
assert.match(source, /exportMaturityMovement/);

UI.state.maturity.periods = periods;
UI.state.maturity.transitionIndex = 0;
UI.state.maturity.movementFilter = "ALL";
const rendered = UI.renderMaturity(periodContext, BancaTrackerCore.state.commercialPerformance, {});
assert.strictEqual(rendered.entities[0].transitions[0].rows.length, 137);
assert.strictEqual(elements.maturityMovementExport.disabled, false);
const tbody = elements.maturityMovementTable.innerHTML.match(/<tbody>([^]*)<\/tbody>/)[1];
assert.strictEqual((tbody.match(/<tr /g) || []).length, 100, "movement display remains capped at 100");
assert.match(elements.maturityRowCount.textContent, /Showing 100 of 137 branches/);

const realExport = BancaTrackerCsvExport;
const calls = { downloads: 0 };
global.BancaTrackerCsvExport = {
  serializeCsv(options) { calls.rows = options.rows; calls.columns = options.columns; calls.csv = realExport.serializeCsv({ ...options, includeBom: false }); return calls.csv; },
  buildFilename(meta) { calls.meta = meta; return realExport.buildFilename(meta); },
  downloadCsv(value) { calls.downloads += 1; calls.download = value; return value; }
};
const originalRows = movementRows.slice();
const originalValues = movementRows.map((row) => ({ ...row }));
elements.maturityMovementExport.click();
assert.strictEqual(calls.rows, movementRows);
assert.strictEqual(calls.rows.length, 137);
assert.strictEqual(calls.rows[100], movementRows[100], "hidden authority row is exported");
assert.deepStrictEqual(calls.rows.map((row) => row.branchId), movementRows.map((row) => row.branchId));
assert.deepStrictEqual(calls.columns.map((column) => [column.label, column.key]), [["Branch ID", "branchId"], ["Branch Name", "branchName"], ["Bank", "canonicalBank"], ["State", "stateName"], ["Zone", "zoneName"], ["Base Month", "baseMonth"], ["Base Premium", "basePremium"], ["Base Band", "baseBand"], ["Base Band Index", "baseBandIndex"], ["Comparison Month", "comparisonMonth"], ["Comparison Premium", "comparisonPremium"], ["Comparison Band", "comparisonBand"], ["Comparison Band Index", "comparisonBandIndex"], ["Movement", "movement"], ["Special Movement", "specialMovement"], ["Presence Status", "presenceStatus"]]);
assert.ok(calls.csv.includes("-123.456"));
assert.ok(calls.csv.includes("1.875"));
assert.ok(calls.csv.includes(",0,Zero,0,"));
assert.ok(calls.csv.includes(",,NOT_COMPARABLE,"), "null comparison values serialize as empty fields");
assert.ok(calls.csv.includes('"Branch, ""Quoted"""'));
assert.ok(calls.csv.includes('"Branch\nLine"'));
assert.ok(calls.csv.includes("BASE_ONLY") && calls.csv.includes("COMPARISON_ONLY"));
assert.strictEqual(calls.meta.datasetId, "branch-maturity-movement");
assert.deepStrictEqual(calls.meta.periods, [periods[0], periods[1]]);
assert.strictEqual(calls.download.filename, "branch-maturity-movement_2026-07-vs-2026-08_overall.csv");

UI.handleMaturityFilterChange("UPGRADED");
assert.ok(!elements.maturityRowCount.textContent.includes("137 branches"));
elements.maturityMovementExport.click();
assert.strictEqual(calls.rows, movementRows, "Movement Filter remains presentation-only");

UI.handleMaturityTransitionChange(1);
assert.match(elements.maturityMovementHeading.textContent, /Aug-26.*Sep-26/);
elements.maturityMovementExport.click();
assert.strictEqual(calls.rows, currentRows, "selected transition replaces the export population");
assert.deepStrictEqual(calls.meta.periods, [periods[1], periods[2]]);
assert.ok(calls.csv.includes("123.4567") && calls.csv.includes("234.5678"));

const emptyResult = { ...authorityResult, entities: [{ ...authorityResult.entities[0], transitions: [transition(periods[0], periods[1], [])] }] };
authorityResult = emptyResult; UI.state.maturity.periods = periods.slice(0, 2); UI.state.maturity.transitionIndex = 0;
UI.renderMaturity(periodContext, BancaTrackerCore.state.commercialPerformance, {});
assert.strictEqual(elements.maturityMovementExport.disabled, true);
const downloadsBeforeEmpty = calls.downloads;
assert.strictEqual(elements.maturityMovementExport.click(), null);
assert.strictEqual(calls.downloads, downloadsBeforeEmpty);

authorityResult = { status: "INVALID_PERIOD_SELECTION", dimension: "OVERALL", selectedPeriods: [], diagnostics: {}, entities: [] };
UI.renderMaturity(periodContext, BancaTrackerCore.state.commercialPerformance, {});
assert.strictEqual(elements.maturityMovementExport.disabled, true);

authorityResult = rendered; UI.state.maturity.periods = periods; UI.state.maturity.transitionIndex = 0;
UI.renderMaturity(periodContext, BancaTrackerCore.state.commercialPerformance, {});
assert.strictEqual(elements.maturityMovementExport.disabled, false);
periodContext = { availablePeriods: [], availableFinancialYears: [], latestAvailablePeriod: null, latestActualPeriod: null, defaultSelectedPeriod: null };
UI.render();
assert.strictEqual(elements.maturityMovementExport.disabled, true, "no-period refresh disables the old export");
const downloadsBeforeNoPeriods = calls.downloads;
assert.strictEqual(UI.exportMaturityMovement(), null, "no-period refresh clears retained movement data");
assert.strictEqual(calls.downloads, downloadsBeforeNoPeriods);

assert.deepStrictEqual(movementRows, originalRows, "export does not mutate the result array");
assert.deepStrictEqual(movementRows.map((row) => ({ ...row })), originalValues, "export does not mutate movement rows");
assert.match(source, /downloadExport\(transition\.rows/);
assert.doesNotMatch(source, /downloadExport\([^\n]*slice\(0, MATURITY_LIMIT\)/);

console.log("Slice 6 Branch Movement export UX tests passed: discoverability, Top-100/full export separation, filters, transition freshness, raw values, empty state, stale-state clearing, and non-mutation.");
