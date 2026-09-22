/* Step 6D.7.2: executable contract for governed Target Seasonality interpretation. */
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
const FY = "FY2026-27";
const MONTHS = ["2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10", "2026-11", "2026-12", "2027-01", "2027-02", "2027-03"];
const LABELS = ["Apr-26", "May-26", "Jun-26", "Jul-26", "Aug-26", "Sep-26", "Oct-26", "Nov-26", "Dec-26", "Jan-27", "Feb-27", "Mar-27"];
const GAP = "CONTRACT GAP: Step 6D.7.3 must align Target UI interpretation with governed seasonality.";

class Element {
  constructor() { this.value = ""; this.innerHTML = ""; this.textContent = ""; this.dataset = {}; this.classList = { toggle() {} }; }
  addEventListener() {}
  add() {}
}
const elements = {};
global.window = global;
global.document = { getElementById(id) { return elements[id] || (elements[id] = new Element()); } };
global.Option = class Option { constructor(text, value) { this.text = text; this.value = value; } };
global.sessionStorage = { getItem() { return null; }, setItem() {} };
global.BancaTrackerCore = { state: { filters: { bank: "ALL" }, banks: ["INDIAN BANK"] } };
const load = (file) => require(path.join(root, file));
[
  "js/config.js", "js/utilities.js", "js/enrichment/dateResolver.js", "js/targetSeasonality.js",
  "js/enrichment/liveTargetSeasonalityAuthority.js", "js/target.js",
].forEach(load);

const Target = global.BancaTrackerTarget;
const Live = global.BancaTrackerLiveTargetSeasonalityAuthority;
const dataset = { datasetId: "TARGET_SEASONALITY:7", datasetType: "TARGET_SEASONALITY", datasetVersion: 7, status: "ACTIVE" };
const weights = [0.05, 0.06, 0.09, 0.10, 0.10, 0.10, 0.10, 0.10, 0.08, 0.07, 0.07, 0.08];
const records = (scopeType, curve, canonicalBank = null) => MONTHS.map((monthKey, index) => ({ fiscalYear: FY, scopeType, canonicalBank, monthKey, weight: curve[index] }));
const context = (overrides = {}) => ({
  currentPeriodKey: "2026-06", currentPeriodMonth: "Jun-26", selectedMonth: "Jun-26", progressionMonth: "Jun-26",
  elapsedMonths: 3, latestFiscalMonth: "Jun-26", ytdPremium: 0,
  bankMonthlyPremium: Object.fromEntries(LABELS.map((label) => [label, 0])),
  ...overrides,
});

function setAnnual(overall = 120, bank = 60) {
  Target.targetState.fiscalYearTarget = overall;
  Target.targetState.monthlyTarget = overall / 12;
  Target.targetState.bankTargets["INDIAN BANK"] = bank;
}

function render(bank, suppliedContext = context()) {
  global.BancaTrackerCore.state.filters.bank = bank;
  global.refreshTarget(suppliedContext);
  return {
    note: elements.targetProgressNote.textContent,
    kpis: elements.targetKpis.innerHTML,
    rows: elements.targetProgress.innerHTML,
    interpretation: elements.targetInterpretation.innerHTML,
  };
}

// The first assertion is the intentional current Step 6D.7 boundary.
setAnnual();
Live.setFromDataset(dataset, records("BANK", weights, "INDIAN BANK"));
const governedBank = render("INDIAN BANK");
assert.match(governedBank.note, /this Bank(?:'s)? governed seasonality/i, GAP);

// Governed Overall and inherited Overall must use supplied Target-result provenance, not UI-side resolution.
Live.setFromDataset(dataset, records("OVERALL", weights));
const governedOverall = render("ALL");
assert.match(governedOverall.note, /governed Overall seasonality/i);
const inheritedOverall = render("INDIAN BANK");
assert.match(inheritedOverall.note, /This Bank(?:'s)? Target uses the governed Overall seasonality/i);

// Equal fallback remains valid and is the only situation that explains equal twelve-month allocation.
const savedLive = global.BancaTrackerLiveTargetSeasonalityAuthority;
global.BancaTrackerLiveTargetSeasonalityAuthority = Object.freeze({ getCachedContext() { return { status: "ABSENT", records: [], dataset: null, diagnostics: [] }; } });
const fallback = render("ALL");
assert.match(fallback.note, /no applicable governed seasonality is configured/i);
assert.match(fallback.note, /equally across 12 months/i);

// Invalid, resolver-unavailable, and cache lifecycle states remain unavailable rather than zero or equal fallback.
global.BancaTrackerLiveTargetSeasonalityAuthority = Object.freeze({ getCachedContext() { return { status: "READY", records: [{ fiscalYear: FY, scopeType: "OVERALL", canonicalBank: null, monthKey: "2026-04", weight: 1 }], dataset, diagnostics: [] }; } });
const invalid = render("ALL");
assert.match(invalid.note, /allocation is unavailable.*configuration is invalid/i);
assert.doesNotMatch(invalid.kpis, /YTD Target<\/div><div class='value'>â‚¹0/i);
assert.doesNotMatch(invalid.kpis, /Gap<\/div><div class='value'>â‚¹0/i);
assert.doesNotMatch(invalid.kpis, /0\.0%|NaN/);
assert.doesNotMatch(invalid.rows, /Not set|â‚¹0\.00 Cr|NaN/);
assert.doesNotMatch(invalid.interpretation, /Set a positive target/i);

const unavailable = render("ALL", context({ currentPeriodKey: null }));
assert.match(unavailable.note, /allocation is unavailable for the selected period/i);
global.BancaTrackerLiveTargetSeasonalityAuthority = Object.freeze({ getCachedContext() { return { status: "NOT_LOADED", records: [], dataset: null, diagnostics: [] }; } });
const cacheUnavailable = render("ALL");
assert.match(cacheUnavailable.note, /allocation is currently unavailable/i);
global.BancaTrackerLiveTargetSeasonalityAuthority = savedLive;

// Existing KPI labels and non-seasonal RRR meaning remain intact.
assert.match(governedBank.kpis, /FY Target|YTD Target|YTD Actual|Achievement %|Gap|RRR/);
const targetSource = fs.readFileSync(path.join(root, "js", "target.js"), "utf8");
assert.doesNotMatch(targetSource, /Monthly targets use an equal 1\/12 allocation\./);
assert.match(targetSource, /annualTarget\s*-\s*actual/);
assert.match(targetSource, /remainingTarget\s*\/\s*remainingMonths/);
const refreshSource = targetSource.slice(targetSource.indexOf("function refreshTarget"), targetSource.indexOf("function showConfigStatus"));
for (const forbidden of ["BancaTrackerLiveTargetSeasonalityAuthority", "BancaTrackerTargetSeasonality", "BancaTrackerRepository", "indexedDB"]) assert.ok(!refreshSource.includes(forbidden), forbidden);

// Documentation must describe governed phasing while preserving equal fallback and contextual Achievement.
const glossarySource = fs.readFileSync(path.join(root, "js", "helpGlossary.js"), "utf8");
assert.doesNotMatch(glossarySource, /Monthly phasing = Annual Target Ã· 12/);
assert.match(glossarySource, /governed seasonality/i);
assert.match(glossarySource, /equal.*12.*month/i);
assert.match(glossarySource, /applicable Target or Budget/i);
const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");
assert.doesNotMatch(readme, /Monthly phasing is equal 1\/12\./);
assert.match(readme, /governed seasonality/i);
assert.match(readme, /equal 1\/12.*fallback/i);

console.log("Step 6D.7 Target Seasonality UI interpretation contract tests passed.");
