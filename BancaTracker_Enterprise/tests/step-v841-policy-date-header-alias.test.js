/* v8.4.1: production POLICY ISSUE DATE alias and governed Commercial integration. */
"use strict";

const assert = require("assert");
const path = require("path");
global.window = global;
global.self = global;
const load = (file) => require(path.join(__dirname, "..", file));

load("js/config.js");
load("js/csvProcessor.js");
load("js/enrichment/dateResolver.js");
load("js/analytics/commercialPerformance.js");
load("js/analytics/commercialRollups.js");
load("js/utilities.js");
load("js/analytics.js");
load("js/dataQuality.js");
load("js/productivity.js");

class Element {
  constructor() { this.value = ""; this.innerHTML = ""; this.textContent = ""; this.classList = { toggle() {} }; }
  addEventListener() {}
  add() {}
}
const elements = {};
global.document = { getElementById(id) { return elements[id] || (elements[id] = new Element()); } };
global.Option = class {};
global.performance = require("perf_hooks").performance;
global.BancaTrackerLiveBranchAuthority = {
  getCachedContext() { return null; },
  applyRecords(records) { return records.map((record) => ({ ...record, branchId: "IB:B1", branchName: record.branch })); },
};
global.BancaTrackerLiveBranchCommercialAuthority = {
  getCachedContext() { return { status: "READY", records: [{ branchId: "IB:B1", periodKey: "2026-10", budget: 500, potential: 1000 }] }; },
};
load("js/core.js");

const mandatory = "USGI NET PREMIUM,Month,INTERMEDIARY,BA NAME,Ba Code,LINE OF BUSINESS,BRANCH NAME";
const row = (premium, month, date, extra = "") => `${premium},${month},IB,RM One,RM1,Motor,Branch One${extra},${date}`;
const process = (header, rows) => BancaTrackerCsvProcessor.process([`${mandatory},${header}`, ...rows].join("\n"), BancaTrackerConfig);

for (const header of ["POLICY ISSUED DATE", "POLICY ISSUE DATE", "policy issue date", " POLICY ISSUE DATE "]) {
  const result = process(header, [row(100, "Apr-26", "01-04-2026")]);
  assert.strictEqual(result.rows[0].policyIssuedDate, "01-04-2026", header);
  assert.strictEqual(result.headerMap["POLICY ISSUED DATE"], 7, header);
}

assert.throws(
  () => BancaTrackerCsvProcessor.process(`${mandatory}\n100,Apr-26,IB,RM One,RM1,Motor,Branch One`, BancaTrackerConfig),
  /required policy date column missing.*POLICY ISSUED DATE or POLICY ISSUE DATE/i,
);
assert.throws(
  () => BancaTrackerCsvProcessor.process(`${mandatory},POLICY ISSUED DATE,POLICY ISSUE DATE\n100,Apr-26,IB,RM One,RM1,Motor,Branch One,01-04-2026,01-04-2026`, BancaTrackerConfig),
  /duplicate semantic column POLICY ISSUED DATE.*POLICY ISSUED DATE, POLICY ISSUE DATE/i,
);

const dates = [
  ["Apr-26", "01-04-2026", "2026-04"],
  ["Jul-26", "01-07-2026", "2026-07"],
  ["Aug-26", "01-08-2026", "2026-08"],
  ["Sep-26", "01-09-2026", "2026-09"],
];
dates.forEach(([month, date, monthKey]) => {
  const fact = BancaTrackerCore.applyDateAuthority(process("POLICY ISSUE DATE", [row(1, month, date)]).rows[0]);
  assert.deepStrictEqual(
    [fact.monthKey, fact.month, fact.day, fact.financialYear, fact.dateAuthority, fact.legacyMonth],
    [monthKey, month, 1, "FY2026-27", "CANONICAL", month],
  );
});

const blank = BancaTrackerCore.applyDateAuthority(process("POLICY ISSUE DATE", [row(1, "Apr-26", "")]).rows[0]);
assert.strictEqual(blank.dateAuthority, "LEGACY_FALLBACK");
assert.strictEqual(blank.monthKey, undefined);
const unsupported = BancaTrackerCore.applyDateAuthority(process("POLICY ISSUE DATE", [row(1, "Apr-26", "01-Jul-2026")]).rows[0]);
assert.deepStrictEqual([unsupported.dateAuthority, unsupported.dateAuthorityError, unsupported.month, unsupported.day], ["INVALID", "DATE_FORMAT_UNSUPPORTED", null, null]);
const invalid = BancaTrackerCore.applyDateAuthority(process("POLICY ISSUE DATE", [row(1, "Apr-26", "31-04-2026")]).rows[0]);
assert.strictEqual(invalid.dateAuthorityError, "DATE_INVALID");

const productionLikeCsv = [`${mandatory},POLICY ISSUE DATE`,
  row(100, "Apr-26", "01-04-2026"),
  row(50, "Jul-26", "01-07-2026"),
  row(-20, "Aug-26", "01-08-2026"),
  row(70, "Sep-26", "01-09-2026"),
].join("\n");
const imported = BancaTrackerCore.loadCsvText(productionLikeCsv);
assert.ok(imported, elements.status.textContent);
const facts = BancaTrackerCore.state.factData;
const performance = BancaTrackerCore.state.commercialPerformance;
const periods = BancaTrackerCommercialRollups.buildPeriodContext(performance);
assert.deepStrictEqual(facts.map((fact) => fact.monthKey), ["2026-04", "2026-07", "2026-08", "2026-09"]);
assert.strictEqual(facts.reduce((sum, fact) => sum + fact.premium, 0), 200);
assert.strictEqual(performance.summary.actualPremium, 200);
assert.strictEqual(performance.summary.invalidDateRowsExcluded, 0);
assert.deepStrictEqual(periods.availablePeriods, ["2026-04", "2026-07", "2026-08", "2026-09", "2026-10"]);
assert.strictEqual(periods.latestActualPeriod, "2026-09");
const referenceOnly = performance.rows.find((item) => item.periodKey === "2026-10");
assert.deepStrictEqual([referenceOnly.actualPremium, referenceOnly.transactionCount, referenceOnly.commercialStatus], [0, 0, "NO_ACTIVITY"]);

console.log("v8.4.1 policy-date alias tests passed: explicit aliases, required/duplicate semantics, canonical months, signed Commercial Actual, and reference-only periods.");
