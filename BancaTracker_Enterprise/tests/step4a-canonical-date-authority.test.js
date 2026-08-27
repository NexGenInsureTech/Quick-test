/* Step 4A: canonical POLICY ISSUED DATE authority for live Month and Day. */
"use strict";

const assert = require("assert");
const path = require("path");
global.window = global;
const load = (file) => require(path.join(__dirname, "..", file));

[
  "js/data/schema.js", "js/data/datasetRegistry.js",
  "js/masters/geographyMaster.js", "js/masters/branchMaster.js",
  "js/masters/employeeMaster.js", "js/masters/hierarchyMaster.js",
  "js/masters/branchAssignmentMaster.js", "js/enrichment/dateResolver.js",
  "js/enrichment/geographyResolver.js", "js/enrichment/branchResolver.js",
  "js/enrichment/hierarchyResolver.js", "js/enrichment/assignmentResolver.js",
  "js/enrichment/enrichmentPipeline.js", "js/enrichment/shadowEnrichment.js",
].forEach(load);
const ActualShadow = BancaTrackerShadowEnrichment;

class Element {
  constructor() { this.value = ""; this.innerHTML = ""; this.textContent = ""; this.classList = { toggle() {} }; }
  addEventListener() {}
  add() {}
}
const elements = {};
global.document = { getElementById(id) { return elements[id] || (elements[id] = new Element()); } };
global.Option = class { constructor(label, value) { this.label = label; this.value = value; } };
global.performance = require("perf_hooks").performance;
global.sessionStorage = { getItem() { return null; }, setItem() {} };

[
  "js/config.js", "js/csvProcessor.js", "js/utilities.js", "js/analytics.js",
  "js/dataQuality.js", "js/productivity.js",
].forEach(load);

let shadowRows = null;
global.BancaTrackerShadowEnrichment = {
  run(records) { shadowRows = records; return Promise.resolve({ status: "READY" }); },
};
load("js/core.js");

const H = "USGI NET PREMIUM,Month,INTERMEDIARY,BA NAME,Ba Code,LINE OF BUSINESS,BRANCH NAME,Zone,STATE,SUM IMD CODE,Day,POLICY ISSUED DATE";
const upload = (...rows) => BancaTrackerCore.loadCsvText([H, ...rows].join("\n"));
const base = (premium, month, day, date, bank = "INDIAN BANK", branch = "Branch A") =>
  `${premium},${month},${bank},RM One,BA1,Motor,${branch},North,Assam,IMD1,${day},${date}`;

assert.ok(upload(base(100, "Aug-26", 24, "24/08/2026")));
let fact = BancaTrackerCore.state.factData[0];
assert.deepStrictEqual(
  { month: fact.month, day: fact.day, legacyMonth: fact.legacyMonth, legacyDay: fact.legacyDay, authority: fact.dateAuthority },
  { month: "Aug-26", day: 24, legacyMonth: "Aug-26", legacyDay: "24", authority: "CANONICAL" },
);
assert.strictEqual(BancaTrackerCore.state.derived.totalPremium, 100);

assert.ok(upload(base(200, "Jul-26", 24, "24/08/2026")));
fact = BancaTrackerCore.state.factData[0];
assert.strictEqual(fact.legacyMonth, "Jul-26");
assert.strictEqual(fact.month, "Aug-26");
assert.deepStrictEqual(BancaTrackerCore.state.months, ["Aug-26"]);
assert.strictEqual(BancaTrackerCore.state.context.currentPeriodMonth, "Aug-26");
assert.strictEqual(BancaTrackerCore.state.derived.totalPremium, 200);
BancaTrackerCore.state.filters.month = "Jul-26";
BancaTrackerCore.refresh();
assert.strictEqual(BancaTrackerCore.state.filteredData.length, 0);
BancaTrackerCore.state.filters.month = "Aug-26";
BancaTrackerCore.refresh();
assert.strictEqual(BancaTrackerCore.state.filteredData.length, 1);

assert.ok(upload(base(300, "Aug-26", 23, "24/08/2026")));
fact = BancaTrackerCore.state.factData[0];
assert.strictEqual(fact.legacyDay, "23");
assert.strictEqual(fact.day, 24);

assert.ok(upload(base(400, "Jul-26", 23, "24/08/2026")));
fact = BancaTrackerCore.state.factData[0];
assert.deepStrictEqual([fact.legacyMonth, fact.legacyDay, fact.month, fact.day], ["Jul-26", "23", "Aug-26", 24]);

assert.ok(upload(base(500, "Aug-26", 24, "")));
fact = BancaTrackerCore.state.factData[0];
assert.strictEqual(fact.dateAuthority, "LEGACY_FALLBACK");
assert.strictEqual(fact.month, "Aug-26");
assert.strictEqual(fact.day, "24");

assert.ok(upload(base(600, "Apr-26", 30, "31/04/2026")));
fact = BancaTrackerCore.state.factData[0];
assert.strictEqual(fact.dateAuthority, "INVALID");
assert.strictEqual(fact.dateAuthorityError, "DATE_INVALID");
assert.strictEqual(fact.month, null);
assert.strictEqual(fact.day, null);
assert.strictEqual(fact.legacyMonth, "Apr-26");
assert.strictEqual(BancaTrackerCore.state.factData.reduce((sum, item) => sum + item.premium, 0), 600);
assert.strictEqual(BancaTrackerCore.state.derived.totalPremium, 0, "invalid-date row does not silently enter legacy Month analytics");

const leap = BancaTrackerCore.applyDateAuthority({ month: "Feb-24", day: "29", policyIssuedDate: "29/02/2024" });
assert.deepStrictEqual([leap.month, leap.day, leap.financialYear], ["Feb-24", 29, "FY2023-24"]);
const march = BancaTrackerCore.applyDateAuthority({ month: "Mar-26", day: "31", policyIssuedDate: "31/03/2026" });
const april = BancaTrackerCore.applyDateAuthority({ month: "Apr-26", day: "1", policyIssuedDate: "01/04/2026" });
assert.deepStrictEqual([march.month, march.financialYear, april.month, april.financialYear], ["Mar-26", "FY2025-26", "Apr-26", "FY2026-27"]);

assert.ok(upload(
  base(100, "Jul-26", 23, "24/08/2026", "INDIAN BANK", "Positive"),
  base(0, "Jul-26", 23, "24/08/2026", "INDIAN BANK", "Zero"),
  base(-25, "Jul-26", 23, "24/08/2026", "UNLISTED BANK", "Negative"),
));
assert.strictEqual(BancaTrackerCore.state.derived.totalPremium, 75);
assert.strictEqual(BancaTrackerCore.state.dataQuality.premium.positiveRows, 1);
assert.strictEqual(BancaTrackerCore.state.dataQuality.premium.zeroRows, 1);
assert.strictEqual(BancaTrackerCore.state.dataQuality.premium.negativeRows, 1);
assert.ok(BancaTrackerCore.state.factData.some((item) => item.bank === "UNLISTED BANK"));

fact = BancaTrackerCore.state.factData[0];
const canonicalResult = BancaTrackerEnrichmentPipeline.enrichTransaction(
  ActualShadow.adaptRecord(fact),
  {},
);
assert.strictEqual(canonicalResult.transaction.monthLabel, fact.month);
assert.strictEqual(canonicalResult.transaction.day, fact.day);
assert.ok(canonicalResult.findings.some((item) => item.code === "LEGACY_MONTH_MISMATCH"));
assert.ok(canonicalResult.findings.some((item) => item.code === "LEGACY_DAY_MISMATCH"));
assert.strictEqual(canonicalResult.resolution.date.success, true);

const authoritySummary = ActualShadow.buildDateAuthoritySummary([
  ...BancaTrackerCore.state.factData,
  BancaTrackerCore.applyDateAuthority({ month: "Aug-26", day: "24", policyIssuedDate: "" }),
  BancaTrackerCore.applyDateAuthority({ month: "Apr-26", day: "30", policyIssuedDate: "31/04/2026" }),
]);
assert.deepStrictEqual(authoritySummary, { canonical: 3, legacyFallback: 1, invalid: 1, unspecified: 0 });

console.log("Step 4A canonical date authority tests passed: central Month/Day migration, audit preservation, fallback/invalid states, filters, periods, signed premiums, unknown banks, and shadow agreement.");
