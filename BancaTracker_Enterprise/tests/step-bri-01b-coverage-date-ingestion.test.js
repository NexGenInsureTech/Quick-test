const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { performance } = require("perf_hooks");

class Element {
  constructor() { this.value = ""; this.textContent = ""; this.innerHTML = ""; this.style = {}; this.classList = { isError: false, toggle(name, enabled) { if (name === "status-error") this.isError = Boolean(enabled); } }; }
  addEventListener() {}
  add() {}
}
const elements = {};
global.window = global;
global.document = { getElementById(id) { return elements[id] || (elements[id] = new Element()); } };
global.Option = class { constructor(text, value) { this.text = text; this.value = value; } };
global.performance = performance;
global.sessionStorage = { getItem() { return null; }, setItem() {} };
const root = path.join(__dirname, "..");
const load = (file) => require(path.join(root, file));
[
  "js/config.js", "js/csvProcessor.js", "js/utilities.js", "js/analytics.js", "js/dataQuality.js",
  "js/productivity.js", "js/analytics/commercialPerformance.js", "js/analytics/commercialRollups.js",
  "js/enrichment/dateResolver.js", "js/analytics/policyTenure.js", "js/enrichment/policyCoverage.js",
].forEach(load);

let authorityLoadCount = 0;
const passthrough = { async loadContext(repository, context) { authorityLoadCount += 1; return context || null; }, getCachedContext: () => null, applyRecords: (rows) => rows.map((row) => ({ ...row })) };
global.BancaTrackerLiveBranchAuthority = passthrough;
global.BancaTrackerLiveAssignmentAuthority = passthrough;
global.BancaTrackerLiveHierarchyAuthority = passthrough;
global.BancaTrackerLiveGeographyAuthority = passthrough;
global.BancaTrackerLiveBranchUniverseAuthority = { getUniverse: () => null };
global.BancaTrackerLiveBranchCommercialAuthority = { getCachedContext: () => null, async loadContext() { authorityLoadCount += 1; } };
global.BancaTrackerShadowEnrichment = { run() { return Promise.resolve({ status: "READY" }); } };

let workerConstructionCount = 0;
global.Worker = class {
  constructor() { workerConstructionCount += 1; }
  postMessage(message) {
    try { this.onmessage({ data: { type: "complete", result: BancaTrackerCsvProcessor.process(message.text, message.config) } }); }
    catch (error) { this.onmessage({ data: { type: "error", message: error.message } }); }
  }
  terminate() {}
};
load("js/core.js");

const BASE = ["USGI NET PREMIUM", "Month", "INTERMEDIARY", "BA NAME", "Ba Code", "LINE OF BUSINESS", "BRANCH NAME", "Day", "POLICY ISSUED DATE"];
const csv = (headers, rows) => [headers.join(","), ...rows.map((row) => headers.map((header) => row[header] == null ? "" : row[header]).join(","))].join("\n");
const source = (premium, issued, extra = {}) => ({
  "USGI NET PREMIUM": premium, Month: "Apr-26", INTERMEDIARY: "INDIAN BANK", "BA NAME": "RM Fictional",
  "Ba Code": "F01", "LINE OF BUSINESS": "Motor", "BRANCH NAME": "Fictional Branch", Day: "1",
  "POLICY ISSUED DATE": issued, ...extra,
});
const coverageRecord = (start, end, startHeader = "POLICY START DATE", endHeader = "POLICY END DATE") => ({
  coverageStartDateSourceValue: start, coverageStartDateSourceHeader: startHeader,
  coverageEndDateSourceValue: end, coverageEndDateSourceHeader: endHeader,
});
const applyCoverage = (start, end, governance) => BancaTrackerPolicyCoverage.apply(coverageRecord(start, end), governance);
const expectedAnnual = applyCoverage("01/01/2026", "31/12/2026", { endDateConvention: "INCLUSIVE" });
assert.strictEqual(expectedAnnual.policyTenureClassification, "ANNUAL");
assert.strictEqual(expectedAnnual.policyTenureExactCalendarYears, 1);
assert.strictEqual(applyCoverage("01/01/2026", "31/12/2028", { endDateConvention: "INCLUSIVE" }).policyTenureClassification, "LONG_TERM_3_YEARS");
assert.strictEqual(applyCoverage("01/01/2026", "31/12/2030", { endDateConvention: "INCLUSIVE" }).policyTenureClassification, "LONG_TERM_4_TO_5_YEARS");
assert.strictEqual(applyCoverage("01/01/2026", "30/06/2027", { endDateConvention: "INCLUSIVE" }).policyTenureClassification, "NON_STANDARD_TERM");
assert.strictEqual(applyCoverage("01/03/2019", "29/02/2020", { endDateConvention: "INCLUSIVE" }).policyTenureClassification, "ANNUAL");
const missingGovernance = applyCoverage("01/04/2026", "31/03/2027");
assert.strictEqual(missingGovernance.policyTenureStatus, "UNKNOWN");
assert.deepStrictEqual(missingGovernance.policyTenureDiagnosticCodes, ["END_DATE_CONVENTION_MISSING"]);

// The coverage adapter is an application dependency: direct use fails closed instead of returning an unenriched record.
const coverageAuthority = global.BancaTrackerPolicyCoverage;
delete global.BancaTrackerPolicyCoverage;
assert.throws(() => BancaTrackerCore.applyCoverageAuthority({ premium: 1 }), /POLICY_COVERAGE_AUTHORITY_UNAVAILABLE/);
global.BancaTrackerPolicyCoverage = coverageAuthority;

// Downstream dependency diagnostics remain distinct from malformed source-data diagnostics.
const dateResolver = global.BancaTrackerDateResolver;
delete global.BancaTrackerDateResolver;
let dependencyRow = applyCoverage("01/04/2026", "31/03/2027", { endDateConvention: "INCLUSIVE" });
assert.deepStrictEqual(dependencyRow.coverageDateDiagnosticCodes, ["DATE_RESOLVER_UNAVAILABLE"]);
assert.strictEqual(dependencyRow.policyTenureStatus, "INVALID");
assert.strictEqual(dependencyRow.coverageDateDiagnosticCodes.includes("COVERAGE_START_DATE_INVALID"), false);
global.BancaTrackerDateResolver = dateResolver;
const tenureAuthority = global.BancaTrackerPolicyTenure;
delete global.BancaTrackerPolicyTenure;
dependencyRow = applyCoverage("01/04/2026", "31/03/2027", { endDateConvention: "INCLUSIVE" });
assert.deepStrictEqual(dependencyRow.policyTenureDiagnosticCodes, ["POLICY_TENURE_AUTHORITY_UNAVAILABLE"]);
assert.strictEqual(dependencyRow.policyTenureStatus, "INVALID");
global.BancaTrackerPolicyTenure = tenureAuthority;

// Legacy PR files remain accepted, unchanged in premium, with explicit missing-header coverage state.
let result = BancaTrackerCore.loadCsvText(csv(BASE, [source(100, "01/04/2026")]));
assert.ok(result); assert.strictEqual(result.rows[0].premium, 100);
assert.strictEqual(result.rows[0].policyTenureStatus, "UNKNOWN");
assert.deepStrictEqual(result.rows[0].coverageDateDiagnosticCodes, ["COVERAGE_START_HEADER_MISSING", "COVERAGE_END_HEADER_MISSING"]);

// Every approved alias retains its exact source header/value and normalizes without positional dependence.
for (const startHeader of ["POLICY START DATE", "START DATE"]) {
  for (const endHeader of ["POLICY END DATE", "EXPIRY DATE"]) {
    const headers = [...BASE.slice(0, 2), startHeader, ...BASE.slice(2), endHeader];
    result = BancaTrackerCore.loadCsvText(csv(headers, [source(25, "01/04/2026", { [startHeader]: " 01/04/2026 ", [endHeader]: "31/03/2027" })]));
    const row = result.rows[0];
    assert.strictEqual(row.coverageStartDateSourceHeader, startHeader);
    assert.strictEqual(row.coverageEndDateSourceHeader, endHeader);
    assert.strictEqual(row.coverageStartDateSourceValue, " 01/04/2026 ");
    assert.strictEqual(row.coverageStartDateNormalized, "2026-04-01");
    assert.strictEqual(row.coverageEndDateNormalized, "2027-03-31");
    assert.strictEqual(row.policyTenureStatus, "SUCCESS");
    assert.strictEqual(row.policyTenureClassification, "ANNUAL");
    assert.strictEqual(row.policyTenureEndDateConvention, "INCLUSIVE");
    assert.deepStrictEqual(row.policyTenureDiagnosticCodes, []);
    assert.strictEqual(BancaTrackerCore.state.importSummary.coverage.classificationCounts.ANNUAL, 1);
  }
}

// Competing aliases are rejected deterministically before any row can activate.
assert.throws(() => BancaTrackerCsvProcessor.process(csv([...BASE, "POLICY START DATE", "START DATE"], [source(1, "01/04/2026")] ), BancaTrackerConfig), /duplicate semantic column POLICY COVERAGE START DATE/i);
assert.throws(() => BancaTrackerCsvProcessor.process(csv([...BASE, "POLICY END DATE", "EXPIRY DATE"], [source(1, "01/04/2026")] ), BancaTrackerConfig), /duplicate semantic column POLICY COVERAGE END DATE/i);

const coverageHeaders = [...BASE, "POLICY START DATE", "POLICY END DATE"];
function importCoverage(extra, premium = 10, issued = "01/04/2026") {
  return BancaTrackerCore.loadCsvText(csv(coverageHeaders, [source(premium, issued, extra)])).rows[0];
}
let row = importCoverage({ "POLICY START DATE": "", "POLICY END DATE": "31/03/2027" });
assert.deepStrictEqual(row.coverageDateDiagnosticCodes, ["COVERAGE_START_DATE_MISSING"]); assert.strictEqual(row.policyTenureClassification, "UNKNOWN");
row = importCoverage({ "POLICY START DATE": "01/04/2026", "POLICY END DATE": "" });
assert.deepStrictEqual(row.coverageDateDiagnosticCodes, ["COVERAGE_END_DATE_MISSING"]);
row = importCoverage({ "POLICY START DATE": "31/04/2026", "POLICY END DATE": "31/03/2027" });
assert.deepStrictEqual(row.coverageDateDiagnosticCodes, ["COVERAGE_START_DATE_INVALID"]); assert.strictEqual(row.policyTenureStatus, "INVALID");
assert.strictEqual(BancaTrackerCore.state.dataQuality.importSummary.coverage.diagnosticCounts.COVERAGE_START_DATE_INVALID, 1);
row = importCoverage({ "POLICY START DATE": "April 1 2026", "POLICY END DATE": "31/03/2027" });
assert.deepStrictEqual(row.coverageDateDiagnosticCodes, ["COVERAGE_START_DATE_FORMAT_UNSUPPORTED"]);
row = importCoverage({ "POLICY START DATE": "01/04/2027", "POLICY END DATE": "31/03/2027" });
assert.deepStrictEqual(row.coverageDateDiagnosticCodes, ["COVERAGE_END_BEFORE_START"]); assert.strictEqual(row.policyTenureClassification, "INVALID");

// Positive, zero, and negative premiums survive coverage enrichment exactly.
result = BancaTrackerCore.loadCsvText(csv(coverageHeaders, [
  source(50, "01/04/2026", { "POLICY START DATE": "01/04/2026", "POLICY END DATE": "31/03/2027" }),
  source(0, "02/04/2026", { "POLICY START DATE": "01/04/2026", "POLICY END DATE": "31/03/2027", "BRANCH NAME": "Zero Branch" }),
  source(-20, "03/04/2026", { "POLICY START DATE": "01/04/2026", "POLICY END DATE": "31/03/2027", "BRANCH NAME": "Negative Branch" }),
]));
assert.deepStrictEqual(result.rows.map((item) => item.premium), [50, 0, -20]);
assert.strictEqual(BancaTrackerCore.state.derived.totalPremium, 30);

// Coverage enrichment remains a single iterative pass for a reasonably large synthetic candidate.
const largeRows = Array.from({ length: 750 }, (_, index) => source(1, "01/04/2026", {
  "POLICY START DATE": "01/04/2026", "POLICY END DATE": "31/03/2027", "BRANCH NAME": `Scale Branch ${index}`,
}));
result = BancaTrackerCore.loadCsvText(csv(coverageHeaders, largeRows));
assert.ok(result);
assert.strictEqual(result.rows.length, 750);
assert.strictEqual(result.summary.coverage.rowCount, 750);
assert.strictEqual(result.summary.coverage.rowsWithValidDatePair, 750);
assert.strictEqual(result.rows.every((item) => item.coverageStartDateNormalized === "2026-04-01"), true);
assert.deepStrictEqual(Object.keys(result.rows[0]).filter((key) => key.startsWith("policyTenure") || key.startsWith("coverageDate")).sort(), [
  "coverageDateDiagnosticCodes", "policyTenureClassification", "policyTenureCoverageEndExclusive",
  "policyTenureDiagnosticCodes", "policyTenureDurationDays", "policyTenureEndDateConvention",
  "policyTenureExactCalendarYears", "policyTenureLeapDayAnniversaryConvention", "policyTenureStatus",
].sort());

// Identical coverage can appear against issued dates in different historical FYs; issue-date authority remains decisive.
result = BancaTrackerCore.loadCsvText(csv(coverageHeaders, [
  source(5, "01/04/2025", { "POLICY START DATE": "01/01/2025", "POLICY END DATE": "31/12/2027" }),
  source(6, "01/04/2026", { "POLICY START DATE": "01/01/2025", "POLICY END DATE": "31/12/2027", "BRANCH NAME": "Second FY Branch" }),
]));
assert.deepStrictEqual(result.rows.map((item) => item.financialYear), ["FY2025-26", "FY2026-27"]);
assert.deepStrictEqual(result.rows.map((item) => item.coverageStartDateNormalized), ["2025-01-01", "2025-01-01"]);

// Optional coverage columns do not alter Commercial Performance or base analytics totals.
const withoutCoverage = BancaTrackerCore.loadCsvText(csv(BASE, [source(75, "01/04/2026") ]));
const baselineCommercial = JSON.stringify(BancaTrackerCore.state.commercialPerformance);
const withCoverage = BancaTrackerCore.loadCsvText(csv(coverageHeaders, [source(75, "01/04/2026", { "POLICY START DATE": "01/04/2026", "POLICY END DATE": "31/03/2027" })]));
assert.strictEqual(BancaTrackerCore.state.derived.totalPremium, 75);
assert.strictEqual(JSON.stringify(BancaTrackerCore.state.commercialPerformance), baselineCommercial);
assert.strictEqual(withoutCoverage.rows[0].premium, withCoverage.rows[0].premium);

const textBytes = (text) => new TextEncoder().encode(text);
const fakeFile = (name, text) => { const bytes = textBytes(text); return { name, size: bytes.byteLength, lastModified: 1, async arrayBuffer() { return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength); } }; };
const file = (name, rows) => fakeFile(name, csv(coverageHeaders, rows));

(async () => {
  const dataQualityAuthority = global.BancaTrackerDataQuality;
  const preparationStatuses = [];
  global.BancaTrackerDataQuality = {
    ...dataQualityAuthority,
    build(records, config, summary) {
      if (summary && summary.batch) preparationStatuses.push(summary.batch.status);
      return dataQualityAuthority.build(records, config, summary);
    },
  };
  const batch = await BancaTrackerCore.handleFiles([
    file("fictional-a.csv", [source(11, "01/04/2025", { "POLICY START DATE": "01/04/2025", "POLICY END DATE": "31/03/2026" })]),
    file("fictional-b.csv", [source(-3, "01/04/2026", { "POLICY START DATE": "01/04/2026", "POLICY END DATE": "31/03/2027", "BRANCH NAME": "Batch B" })]),
  ], new Element());
  global.BancaTrackerDataQuality = dataQualityAuthority;
  assert.ok(batch, elements.status.textContent); assert.deepStrictEqual(batch.rows.map((item) => item.premium), [11, -3]);
  assert.deepStrictEqual(batch.rows.map((item) => [item.policyTenureClassification, item.policyTenureEndDateConvention]), [["ANNUAL", "INCLUSIVE"], ["ANNUAL", "INCLUSIVE"]]);
  assert.strictEqual(batch.summary.batch.fileCount, 2); assert.strictEqual(batch.summary.coverage.rowsWithValidDatePair, 2);
  assert.deepStrictEqual(preparationStatuses, ["PREPARED"]);
  assert.strictEqual(batch.summary.batch.status, "COMMITTED");
  assert.strictEqual(BancaTrackerCore.state.importSummary, batch.summary);
  assert.strictEqual(BancaTrackerCore.state.dataQuality.importSummary, batch.summary);

  // Activation validates every target descriptor before publishing any candidate field.
  const committedAFacts = BancaTrackerCore.state.factData;
  const committedASummary = BancaTrackerCore.state.importSummary;
  const committedADataQuality = BancaTrackerCore.state.dataQuality;
  const committedAFactsJson = JSON.stringify(committedAFacts);
  const committedASummaryJson = JSON.stringify(committedASummary);
  const committedADataQualityJson = JSON.stringify(committedADataQuality);
  const committedAPremium = BancaTrackerCore.state.derived.totalPremium;
  const dataQualityDescriptor = Object.getOwnPropertyDescriptor(BancaTrackerCore.state, "dataQuality");
  Object.defineProperty(BancaTrackerCore.state, "dataQuality", { ...dataQualityDescriptor, writable: false });
  const rejectedLateTarget = await BancaTrackerCore.handleFiles([
    file("activation-b.csv", [source(22, "01/04/2026", { "POLICY START DATE": "01/04/2026", "POLICY END DATE": "31/03/2027" })]),
  ], new Element());
  assert.strictEqual(rejectedLateTarget, null);
  assert.strictEqual(elements.status.textContent, "IMPORT_ACTIVATION_TARGET_PROPERTY_UNSAFE:dataQuality");
  assert.strictEqual(BancaTrackerCore.state.factData, committedAFacts);
  assert.strictEqual(BancaTrackerCore.state.importSummary, committedASummary);
  assert.strictEqual(BancaTrackerCore.state.dataQuality, committedADataQuality);
  assert.strictEqual(BancaTrackerCore.state.derived.totalPremium, committedAPremium);
  assert.strictEqual(JSON.stringify(BancaTrackerCore.state.factData), committedAFactsJson);
  assert.strictEqual(JSON.stringify(BancaTrackerCore.state.importSummary), committedASummaryJson);
  assert.strictEqual(JSON.stringify(BancaTrackerCore.state.dataQuality), committedADataQualityJson);
  assert.strictEqual(BancaTrackerCore.state.importSummary.batch.status, "COMMITTED");
  Object.defineProperty(BancaTrackerCore.state, "dataQuality", dataQualityDescriptor);

  const factDataDescriptor = Object.getOwnPropertyDescriptor(BancaTrackerCore.state, "factData");
  Object.defineProperty(BancaTrackerCore.state, "factData", { ...factDataDescriptor, writable: false });
  const rejectedEarlyTarget = BancaTrackerCore.loadCsvText(csv(BASE, [source(23, "02/04/2026")]));
  assert.strictEqual(rejectedEarlyTarget, null);
  assert.strictEqual(elements.status.textContent, "IMPORT_ACTIVATION_TARGET_PROPERTY_UNSAFE:factData");
  assert.strictEqual(BancaTrackerCore.state.factData, committedAFacts);
  assert.strictEqual(BancaTrackerCore.state.importSummary, committedASummary);
  assert.strictEqual(BancaTrackerCore.state.dataQuality, committedADataQuality);
  Object.defineProperty(BancaTrackerCore.state, "factData", factDataDescriptor);

  let factDataSetterCalls = 0; let accessorFacts = committedAFacts;
  Object.defineProperty(BancaTrackerCore.state, "factData", {
    configurable: true, enumerable: factDataDescriptor.enumerable,
    get() { return accessorFacts; },
    set(value) { factDataSetterCalls += 1; accessorFacts = value; throw new Error("MUTATED_THEN_THROW"); },
  });
  const rejectedFactDataSetter = await BancaTrackerCore.handleFiles([
    file("activation-fact-setter.csv", [source(23, "02/04/2026", { "POLICY START DATE": "01/04/2026", "POLICY END DATE": "31/03/2027" })]),
  ], new Element());
  assert.strictEqual(rejectedFactDataSetter, null);
  assert.strictEqual(elements.status.textContent, "IMPORT_ACTIVATION_TARGET_PROPERTY_UNSAFE:factData");
  assert.strictEqual(factDataSetterCalls, 0);
  assert.strictEqual(BancaTrackerCore.state.factData, committedAFacts);
  assert.strictEqual(BancaTrackerCore.state.importSummary, committedASummary);
  assert.strictEqual(BancaTrackerCore.state.dataQuality, committedADataQuality);
  assert.strictEqual(BancaTrackerCore.state.derived.totalPremium, committedAPremium);
  Object.defineProperty(BancaTrackerCore.state, "factData", factDataDescriptor);

  let descriptorInvalidatingSetterCalls = 0;
  Object.defineProperty(BancaTrackerCore.state, "factData", {
    configurable: true, enumerable: factDataDescriptor.enumerable,
    get() { return committedAFacts; },
    set() {
      descriptorInvalidatingSetterCalls += 1;
      Object.defineProperty(BancaTrackerCore.state, "dataQuality", { ...dataQualityDescriptor, writable: false });
    },
  });
  const rejectedDescriptorInvalidator = await BancaTrackerCore.handleFiles([
    file("activation-descriptor-setter.csv", [source(24, "03/04/2026", { "POLICY START DATE": "01/04/2026", "POLICY END DATE": "31/03/2027" })]),
  ], new Element());
  assert.strictEqual(rejectedDescriptorInvalidator, null);
  assert.strictEqual(elements.status.textContent, "IMPORT_ACTIVATION_TARGET_PROPERTY_UNSAFE:factData");
  assert.strictEqual(descriptorInvalidatingSetterCalls, 0);
  assert.deepStrictEqual(Object.getOwnPropertyDescriptor(BancaTrackerCore.state, "dataQuality"), dataQualityDescriptor);
  assert.strictEqual(BancaTrackerCore.state.factData, committedAFacts);
  assert.strictEqual(BancaTrackerCore.state.importSummary, committedASummary);
  assert.strictEqual(BancaTrackerCore.state.dataQuality, committedADataQuality);
  Object.defineProperty(BancaTrackerCore.state, "factData", factDataDescriptor);

  let reentrantSetterCalls = 0;
  Object.defineProperty(BancaTrackerCore.state, "factData", {
    configurable: true, enumerable: factDataDescriptor.enumerable,
    get() { return committedAFacts; },
    set() { reentrantSetterCalls += 1; BancaTrackerCore.loadCsvText(csv(BASE, [source(999, "04/04/2026")])); },
  });
  const rejectedReentrantSetter = await BancaTrackerCore.handleFiles([
    file("activation-reentrant-setter.csv", [source(25, "04/04/2026", { "POLICY START DATE": "01/04/2026", "POLICY END DATE": "31/03/2027" })]),
  ], new Element());
  assert.strictEqual(rejectedReentrantSetter, null);
  assert.strictEqual(elements.status.textContent, "IMPORT_ACTIVATION_TARGET_PROPERTY_UNSAFE:factData");
  assert.strictEqual(reentrantSetterCalls, 0);
  assert.strictEqual(BancaTrackerCore.state.factData, committedAFacts);
  assert.strictEqual(BancaTrackerCore.state.importSummary, committedASummary);
  assert.strictEqual(BancaTrackerCore.state.dataQuality, committedADataQuality);
  Object.defineProperty(BancaTrackerCore.state, "factData", factDataDescriptor);

  let setterCalls = 0;
  Object.defineProperty(BancaTrackerCore.state, "dataQuality", {
    configurable: true, enumerable: dataQualityDescriptor.enumerable,
    get() { return committedADataQuality; },
    set() { setterCalls += 1; throw new Error("UNSAFE_SETTER_INVOKED"); },
  });
  const rejectedAccessor = await BancaTrackerCore.handleFiles([
    file("activation-accessor.csv", [source(24, "03/04/2026", { "POLICY START DATE": "01/04/2026", "POLICY END DATE": "31/03/2027" })]),
  ], new Element());
  assert.strictEqual(rejectedAccessor, null);
  assert.strictEqual(elements.status.textContent, "IMPORT_ACTIVATION_TARGET_PROPERTY_UNSAFE:dataQuality");
  assert.strictEqual(setterCalls, 0);
  assert.strictEqual(BancaTrackerCore.state.factData, committedAFacts);
  assert.strictEqual(BancaTrackerCore.state.importSummary, committedASummary);
  assert.strictEqual(BancaTrackerCore.state.dataQuality, committedADataQuality);
  Object.defineProperty(BancaTrackerCore.state, "dataQuality", dataQualityDescriptor);

  Object.freeze(committedAFacts);
  Object.freeze(committedASummary);
  const recoveredActivation = await BancaTrackerCore.handleFiles([
    file("activation-recovery.csv", [source(25, "04/04/2026", { "POLICY START DATE": "01/04/2026", "POLICY END DATE": "31/03/2027" })]),
  ], new Element());
  assert.ok(recoveredActivation, elements.status.textContent);
  assert.strictEqual(recoveredActivation.summary.batch.status, "COMMITTED");
  assert.strictEqual(BancaTrackerCore.state.importSummary, recoveredActivation.summary);
  assert.strictEqual(BancaTrackerCore.state.dataQuality.importSummary, recoveredActivation.summary);
  assert.deepStrictEqual(BancaTrackerCore.state.factData.map((item) => item.premium), [25]);
  assert.strictEqual(BancaTrackerCore.state.derived.totalPremium, 25);

  const activeRows = BancaTrackerCore.state.factData;
  const activeSummary = BancaTrackerCore.state.importSummary;
  const failedPreparationStatuses = [];
  global.BancaTrackerDataQuality = {
    ...dataQualityAuthority,
    build(records, config, summary) {
      if (summary && summary.batch) failedPreparationStatuses.push(summary.batch.status);
      throw new Error("FORCED_CANDIDATE_PREPARATION_FAILURE");
    },
  };
  const failedPreparation = await BancaTrackerCore.handleFiles([
    file("preparation-failure.csv", [source(98, "01/04/2026", { "POLICY START DATE": "01/04/2026", "POLICY END DATE": "31/03/2027" })]),
  ], new Element());
  global.BancaTrackerDataQuality = dataQualityAuthority;
  assert.strictEqual(failedPreparation, null);
  assert.deepStrictEqual(failedPreparationStatuses, ["PREPARED"]);
  assert.strictEqual(BancaTrackerCore.state.factData, activeRows);
  assert.strictEqual(BancaTrackerCore.state.importSummary, activeSummary);

  const failed = await BancaTrackerCore.handleFiles([
    file("good.csv", [source(99, "01/04/2026", { "POLICY START DATE": "01/04/2026", "POLICY END DATE": "31/03/2027" })]),
    fakeFile("conflict.csv", csv([...BASE, "POLICY START DATE", "START DATE"], [source(1, "01/04/2026")])),
  ], new Element());
  assert.strictEqual(failed, null); assert.strictEqual(BancaTrackerCore.state.factData, activeRows);
  assert.strictEqual(BancaTrackerCore.state.importSummary, activeSummary);

  // A missing or malformed coverage adapter fails before parsing/preparation and preserves the active candidate.
  const acceptedRows = BancaTrackerCore.state.factData;
  const acceptedSummary = BancaTrackerCore.state.importSummary;
  const csvProcess = BancaTrackerCsvProcessor.process;
  let parserCount = 0;
  let candidatePreparationCount = 0;
  global.BancaTrackerDataQuality = {
    ...dataQualityAuthority,
    build(...args) { candidatePreparationCount += 1; return dataQualityAuthority.build(...args); },
  };
  BancaTrackerCsvProcessor.process = (...args) => { parserCount += 1; return csvProcess(...args); };

  delete global.BancaTrackerPolicyCoverage;
  const missingAdapter = BancaTrackerCore.loadCsvText(csv(BASE, [source(101, "01/04/2026")]));
  assert.strictEqual(missingAdapter, null);
  assert.strictEqual(elements.status.textContent, "POLICY_COVERAGE_AUTHORITY_UNAVAILABLE");
  assert.strictEqual(elements.status.classList.isError, true);
  assert.strictEqual(BancaTrackerCore.state.factData, acceptedRows);
  assert.strictEqual(BancaTrackerCore.state.importSummary, acceptedSummary);
  assert.strictEqual(BancaTrackerCore.state.importSummary.batch.status, "COMMITTED");
  assert.strictEqual(parserCount, 0);
  assert.strictEqual(candidatePreparationCount, 0);

  global.BancaTrackerPolicyCoverage = { apply: null, summarize: coverageAuthority.summarize };
  const malformedSynchronousAdapter = BancaTrackerCore.loadCsvText(csv(BASE, [source(102, "01/04/2026")]));
  assert.strictEqual(malformedSynchronousAdapter, null);
  assert.strictEqual(elements.status.textContent, "POLICY_COVERAGE_AUTHORITY_UNAVAILABLE");
  assert.strictEqual(parserCount, 0);
  assert.strictEqual(candidatePreparationCount, 0);
  assert.strictEqual(BancaTrackerCore.state.factData, acceptedRows);
  assert.strictEqual(BancaTrackerCore.state.importSummary, acceptedSummary);

  let fileReadCount = 0;
  let hashCount = 0;
  const cryptoDescriptor = Object.getOwnPropertyDescriptor(global, "crypto");
  const digest = global.crypto.subtle.digest.bind(global.crypto.subtle);
  Object.defineProperty(global, "crypto", { configurable: true, value: { subtle: { digest(...args) { hashCount += 1; return digest(...args); } } } });
  const unreadFile = { name: "dependency-failure.csv", async arrayBuffer() { fileReadCount += 1; throw new Error("file read must not run"); } };
  authorityLoadCount = 0;
  workerConstructionCount = 0;
  delete global.BancaTrackerPolicyCoverage;
  const missingAsyncAdapter = await BancaTrackerCore.handleFiles([unreadFile], new Element());
  assert.strictEqual(missingAsyncAdapter, null);
  assert.strictEqual(elements.status.textContent, "POLICY_COVERAGE_AUTHORITY_UNAVAILABLE");
  assert.deepStrictEqual([fileReadCount, hashCount, parserCount, workerConstructionCount, authorityLoadCount, candidatePreparationCount], [0, 0, 0, 0, 0, 0]);

  global.BancaTrackerPolicyCoverage = { apply: null, summarize: coverageAuthority.summarize };
  const malformedAdapter = await BancaTrackerCore.handleFiles([unreadFile], new Element());
  assert.strictEqual(malformedAdapter, null);
  assert.strictEqual(elements.status.textContent, "POLICY_COVERAGE_AUTHORITY_UNAVAILABLE");
  assert.deepStrictEqual([fileReadCount, hashCount, parserCount, workerConstructionCount, authorityLoadCount, candidatePreparationCount], [0, 0, 0, 0, 0, 0]);
  assert.strictEqual(BancaTrackerCore.state.factData, acceptedRows);
  assert.strictEqual(BancaTrackerCore.state.importSummary, acceptedSummary);

  // The final candidate guard rejects a dependency that disappears after the asynchronous entry preflight.
  global.BancaTrackerPolicyCoverage = coverageAuthority;
  const disappearing = file("dependency-disappears.csv", [source(103, "02/04/2026", { "POLICY START DATE": "01/04/2026", "POLICY END DATE": "31/03/2027" })]);
  const readBytes = disappearing.arrayBuffer;
  disappearing.arrayBuffer = async function () { const bytes = await readBytes.call(this); delete global.BancaTrackerPolicyCoverage; return bytes; };
  const disappearedDuringImport = await BancaTrackerCore.handleFiles([disappearing], new Element());
  assert.strictEqual(disappearedDuringImport, null);
  assert.strictEqual(elements.status.textContent, "POLICY_COVERAGE_AUTHORITY_UNAVAILABLE");
  assert.strictEqual(BancaTrackerCore.state.factData, acceptedRows);
  assert.strictEqual(BancaTrackerCore.state.importSummary, acceptedSummary);

  BancaTrackerCsvProcessor.process = csvProcess;
  global.BancaTrackerDataQuality = dataQualityAuthority;
  Object.defineProperty(global, "crypto", cryptoDescriptor);

  // Dependency restoration permits a clean replacement without stale failure diagnostics.
  global.BancaTrackerPolicyCoverage = coverageAuthority;
  const recovered = BancaTrackerCore.loadCsvText(csv(coverageHeaders, [
    source(104, "03/04/2026", { "POLICY START DATE": "", "POLICY END DATE": "" }),
  ]));
  assert.ok(recovered);
  assert.strictEqual(recovered.rows[0].policyTenureStatus, "UNKNOWN");
  assert.deepStrictEqual(recovered.rows[0].coverageDateDiagnosticCodes, ["COVERAGE_START_DATE_MISSING", "COVERAGE_END_DATE_MISSING"]);
  assert.strictEqual(recovered.summary.coverage.diagnosticCounts.POLICY_COVERAGE_AUTHORITY_UNAVAILABLE, undefined);
  assert.strictEqual(recovered.summary.batch, undefined);

  const original = Object.freeze(coverageRecord("01/01/2026", "31/12/2026"));
  BancaTrackerPolicyCoverage.apply(original, { endDateConvention: "INCLUSIVE" });
  assert.deepStrictEqual(original, coverageRecord("01/01/2026", "31/12/2026"));
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  assert.ok(html.indexOf('js/enrichment/dateResolver.js') < html.indexOf('js/analytics/policyTenure.js'));
  assert.ok(html.indexOf('js/analytics/policyTenure.js') < html.indexOf('js/enrichment/policyCoverage.js'));
  console.log("BRI-01B coverage-date ingestion tests passed: aliases, provenance, validation, tenure, signed premium, FY authority, commercial isolation, and atomic replacement.");
})().catch((error) => { console.error(error); process.exit(1); });
