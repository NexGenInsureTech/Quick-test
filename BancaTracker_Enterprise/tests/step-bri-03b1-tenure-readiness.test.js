const assert = require("assert");
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");

global.window = global;
const load = (file) => require(path.join(root, file));
load("js/config.js");
load("js/enrichment/dateResolver.js");
load("js/analytics/policyTenure.js");
load("js/enrichment/policyCoverage.js");
load("js/analytics/managementBank.js");
load("js/analytics/premiumComposition.js");

assert.deepStrictEqual(BancaTrackerConfig.POLICY_TENURE_GOVERNANCE, { endDateConvention: "INCLUSIVE", leapDayAnniversaryConvention: "MAR_01" });
const coverage = (startDate, endDate) => BancaTrackerPolicyCoverage.apply({
  coverageStartDateSourceValue: startDate, coverageStartDateSourceHeader: "POLICY START DATE",
  coverageEndDateSourceValue: endDate, coverageEndDateSourceHeader: "POLICY END DATE",
}, BancaTrackerConfig.POLICY_TENURE_GOVERNANCE);
let governed = coverage("01/04/2026", "31/03/2027");
assert.deepStrictEqual([governed.policyTenureStatus, governed.policyTenureClassification, governed.policyTenureExactCalendarYears, governed.policyTenureEndDateConvention], ["SUCCESS", "ANNUAL", 1, "INCLUSIVE"]);
governed = coverage("01/04/2026", "31/03/2029");
assert.deepStrictEqual([governed.policyTenureClassification, governed.policyTenureExactCalendarYears, governed.policyTenureCoverageEndExclusive], ["LONG_TERM_3_YEARS", 3, "2029-04-01"]);
[
  ["28/02/2025", "ANNUAL", 1], ["28/02/2026", "LONG_TERM_2_YEARS", 2],
  ["28/02/2027", "LONG_TERM_3_YEARS", 3], ["28/02/2028", "LONG_TERM_4_TO_5_YEARS", 4],
].forEach(([endDate, classification, years]) => {
  governed = coverage("29/02/2024", endDate);
  assert.deepStrictEqual([governed.policyTenureStatus, governed.policyTenureClassification, governed.policyTenureExactCalendarYears, governed.policyTenureLeapDayAnniversaryConvention], ["SUCCESS", classification, years, "MAR_01"]);
  assert.deepStrictEqual(governed.policyTenureDiagnosticCodes, []);
});
assert.deepStrictEqual([coverage("", "31/03/2027").policyTenureStatus, coverage("", "31/03/2027").policyTenureClassification], ["UNKNOWN", "UNKNOWN"]);
assert.deepStrictEqual([coverage("31/04/2026", "31/03/2027").policyTenureStatus, coverage("31/04/2026", "31/03/2027").policyTenureClassification], ["INVALID", "INVALID"]);

const tenureOrder = ["ANNUAL", "LONG_TERM_2_YEARS", "LONG_TERM_3_YEARS", "LONG_TERM_4_TO_5_YEARS", "LONG_TERM_OVER_5_YEARS", "SHORT_TERM", "NON_STANDARD_TERM", "UNKNOWN", "INVALID"];
const portions = [
  ["SUCCESS", "INITIAL_PORTION"], ["SUCCESS", "ADVANCE_PORTION"], ["UNKNOWN", "UNKNOWN"], ["INVALID", "INVALID"],
  ["SUCCESS", "INITIAL_PORTION"], ["SUCCESS", "ADVANCE_PORTION"], ["UNKNOWN", "UNKNOWN"], ["INVALID", "INVALID"], ["SUCCESS", "INITIAL_PORTION"],
];
const premiums = [100, -20, 0, 30, 5, 7, -2, 11, -1];
const facts = tenureOrder.map((classification, index) => ({
  premium: premiums[index], financialYear: "FY2026-27", monthKey: `2026-${String(4 + index % 3).padStart(2, "0")}`,
  bank: index === 1 ? "INDIAN BANK (PMSBY)" : "INDIAN BANK", productName: `Product ${index}`,
  premiumPortionStatus: portions[index][0], premiumPortionClassification: portions[index][1],
  policyTenureStatus: classification === "UNKNOWN" ? "UNKNOWN" : classification === "INVALID" ? "INVALID" : "SUCCESS",
  policyTenureClassification: classification,
  coverageDateDiagnosticCodes: classification === "INVALID" ? ["COVERAGE_START_DATE_INVALID"] : [],
  policyTenureDiagnosticCodes: classification === "UNKNOWN" ? ["COVERAGE_END_DATE_MISSING"] : [],
  endorsementNumberSourceValue: `PRIVATE-${index}-A01`, coverageStartDateSourceValue: "PRIVATE-DATE",
}));
facts.push({ ...facts[0], premium: 1000, financialYear: "FY2025-26", monthKey: "2025-04" });
facts.push({ ...facts[0], premium: 200, bank: "INDIAN OVERSEAS BANK" });
const snapshot = JSON.stringify(facts);
const result = BancaTrackerPremiumComposition.buildPremiumComposition(facts, { financialYear: "FY2026-27", managementBank: "INDIAN BANK" });
assert.deepStrictEqual(result.tenureRows.map((row) => row.tenureClassification), tenureOrder);
assert.deepStrictEqual(result.tenureRows.map((row) => row.rowCount), Array(9).fill(1));
assert.deepStrictEqual(result.tenureRows.map((row) => row.totalPremium), premiums);
assert.deepStrictEqual(result.premiumByBucket, { INITIAL: 104, ADVANCE: -13, UNKNOWN: -2, INVALID: 41 });
assert.strictEqual(result.kpis.totalPremium, 130); assert.strictEqual(result.kpis.transactionRows, 9);
assert.deepStrictEqual(result.tenureReadiness.statusCounts, { SUCCESS: 7, UNKNOWN: 1, INVALID: 1 });
assert.strictEqual(result.tenureReadiness.successfulTenureRows, 7);
assert.strictEqual(result.tenureReadiness.successfulTenureRowShare, 7 / 9 * 100);
assert.deepStrictEqual(result.tenureReadiness.reconciliation, { matrixPremiumTotal: 130, premiumDifference: 0, matrixRowTotal: 9, rowDifference: 0 });
assert.strictEqual(result.tenureReadiness.diagnosticCounts.COVERAGE_END_DATE_MISSING, 1);
assert.strictEqual(result.tenureReadiness.diagnosticCounts.COVERAGE_START_DATE_INVALID, 1);
assert.strictEqual(JSON.stringify(facts), snapshot);
assert.strictEqual(JSON.stringify(result).includes("PRIVATE"), false);
assert.strictEqual(JSON.stringify(BancaTrackerPremiumComposition.buildPremiumComposition(facts, { financialYear: "FY2026-27", managementBank: "INDIAN BANK" })), JSON.stringify(result));
assert.ok(Object.isFrozen(result.tenureRows) && Object.isFrozen(result.tenureRows[0].premiums));

// Decimal signed premiums retain their source values while independent matrix summation reconciles floating-point residue.
const decimalFacts = [
  { ...facts[0], premium: 0.1, policyTenureClassification: "ANNUAL" },
  { ...facts[0], premium: 0.2, policyTenureClassification: "LONG_TERM_2_YEARS" },
  { ...facts[0], premium: -0.3, policyTenureClassification: "ANNUAL" },
];
const decimalResult = BancaTrackerPremiumComposition.buildPremiumComposition(decimalFacts, { financialYear: "FY2026-27", managementBank: "ALL" });
assert.deepStrictEqual(decimalFacts.map((fact) => fact.premium), [0.1, 0.2, -0.3]);
assert.strictEqual(decimalResult.kpis.totalPremium, 5.551115123125783e-17);
assert.strictEqual(decimalResult.tenureReadiness.reconciliation.premiumDifference, 0);
assert.strictEqual(decimalResult.reconciliation.premiumDifference, 0);

// The tolerance is bounded below one paisa even when large values magnify the relative IEEE-754 tolerance.
const largePremiumFacts = [
  { ...facts[0], premium: 1e15, policyTenureClassification: "ANNUAL" },
  { ...facts[0], premium: 0.01, policyTenureClassification: "LONG_TERM_2_YEARS" },
  { ...facts[0], premium: -1e15, policyTenureClassification: "ANNUAL" },
];
const largePremiumResult = BancaTrackerPremiumComposition.buildPremiumComposition(largePremiumFacts, { financialYear: "FY2026-27", managementBank: "ALL" });
assert.ok(Math.abs(largePremiumResult.tenureReadiness.reconciliation.premiumDifference) >= 0.01);
assert.strictEqual(largePremiumResult.tenureReadiness.reconciliation.premiumDifference, -0.01);
assert.strictEqual(largePremiumResult.reconciliation.premiumDifference,
  largePremiumResult.kpis.totalPremium - Object.values(largePremiumResult.premiumByBucket).reduce((sum, value) => sum + value, 0));

// Readiness follows the effective conservative buckets, not contradictory raw status metadata.
const inconsistentFacts = [
  { ...facts[0], premium: 1, policyTenureStatus: "SUCCESS", policyTenureClassification: "UNKNOWN", policyTenureDiagnosticCodes: ["SOURCE_UNKNOWN"] },
  { ...facts[0], premium: -0.25, policyTenureStatus: "INVALID", policyTenureClassification: "ANNUAL", policyTenureDiagnosticCodes: ["SOURCE_INVALID"] },
  { ...facts[0], premium: 0.25, policyTenureStatus: "UNKNOWN", policyTenureClassification: "ANNUAL", policyTenureDiagnosticCodes: [] },
];
const inconsistentResult = BancaTrackerPremiumComposition.buildPremiumComposition(inconsistentFacts, { financialYear: "FY2026-27", managementBank: "ALL" });
assert.deepStrictEqual(inconsistentResult.tenureRows.filter((row) => row.rowCount).map((row) => [row.tenureClassification, row.rowCount]), [["UNKNOWN", 2], ["INVALID", 1]]);
assert.deepStrictEqual(inconsistentResult.tenureReadiness.statusCounts, { SUCCESS: 0, UNKNOWN: 2, INVALID: 1 });
assert.strictEqual(inconsistentResult.tenureReadiness.successfulTenureRows, 0);
assert.strictEqual(inconsistentResult.tenureReadiness.diagnosticCounts.TENURE_STATUS_CLASSIFICATION_INCONSISTENT, 3);
assert.strictEqual(inconsistentResult.tenureReadiness.diagnosticCounts.SOURCE_UNKNOWN, 1);
assert.strictEqual(inconsistentResult.tenureReadiness.diagnosticCounts.SOURCE_INVALID, 1);
assert.strictEqual(inconsistentResult.diagnostics.unexpectedTenureMetadataRows, 3);

// Old facts are not mutated or reclassified; absent tenure evidence is projected as UNKNOWN only at read time.
const priorFact = Object.freeze({ premium: 4, financialYear: "FY2026-27", monthKey: "2026-04", bank: "INDIAN BANK", premiumPortionStatus: "UNKNOWN", premiumPortionClassification: "UNKNOWN" });
const priorResult = BancaTrackerPremiumComposition.buildPremiumComposition([priorFact], { financialYear: "FY2026-27", managementBank: "ALL" });
assert.strictEqual(priorResult.tenureRows.find((row) => row.tenureClassification === "UNKNOWN").totalPremium, 4);
assert.deepStrictEqual(priorResult.tenureReadiness.statusCounts, { SUCCESS: 0, UNKNOWN: 1, INVALID: 0 });
assert.strictEqual(priorResult.tenureReadiness.diagnosticCounts.TENURE_STATUS_CLASSIFICATION_INCONSISTENT, undefined);
assert.strictEqual(priorResult.diagnostics.unexpectedTenureMetadataRows, 0);
assert.strictEqual(Object.prototype.hasOwnProperty.call(priorFact, "policyTenureClassification"), false);

class Element { constructor() { this.innerHTML = ""; this.value = ""; this.listeners = {}; } addEventListener(type, handler) { this.listeners[type] = handler; } }
const elementIds = ["premiumCompositionFinancialYear", "premiumCompositionManagementBank", "premiumCompositionReadiness", "premiumCompositionKpis", "premiumCompositionTrend", "premiumCompositionProducts", "premiumTenureReadiness", "premiumTenureMatrix"];
const elements = Object.fromEntries(elementIds.map((id) => [id, new Element()]));
global.document = { getElementById: (id) => elements[id] || null };
global.BancaTrackerUtils = { escapeHtml: (value) => String(value == null ? "" : value).replace(/[&<>'\"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]), formatRupees: (value) => `${Number(value) < 0 ? "-" : ""}₹${Math.abs(Number(value || 0))}` };
global.BancaTrackerCore = { state: { factData: facts } };
load("js/premiumCompositionUI.js");
BancaTrackerPremiumCompositionUI.state.managementBank = "INDIAN BANK";
let rendered = BancaTrackerPremiumCompositionUI.render();
assert.strictEqual(rendered.kpis.totalPremium, 130);
assert.match(elements.premiumTenureReadiness.innerHTML, /INFORMATIONAL/);
assert.match(elements.premiumTenureMatrix.innerHTML, /LONG TERM 3 YEARS/);
assert.match(elements.premiumTenureMatrix.innerHTML, /commercial-negative/);
global.BancaTrackerCore.state.factData = [priorFact];
BancaTrackerPremiumCompositionUI.render();
assert.match(elements.premiumTenureReadiness.innerHTML, /Unknown tenure remains unevidenced/);
// A successful REPLACE publishes a new fact array; the renderer rereads it and does not retain prior analytics.
global.BancaTrackerCore.state.factData = [{ ...facts[0], premium: -9, premiumPortionClassification: "ADVANCE_PORTION" }];
rendered = BancaTrackerPremiumCompositionUI.render();
assert.strictEqual(rendered.kpis.totalPremium, -9);
assert.strictEqual(rendered.tenureRows.find((row) => row.tenureClassification === "ANNUAL").premiums.ADVANCE, -9);
assert.strictEqual(elements.premiumTenureMatrix.innerHTML.includes("PRIVATE"), false);

const coreSource = fs.readFileSync(path.join(root, "js/core.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
assert.match(coreSource, /coverageAuthority\.apply\(record, config\.POLICY_TENURE_GOVERNANCE\)/);
assert.match(html, /informational and never gates signed financial results/i);
assert.strictEqual(/policy count|renewal eligibility|forecast/i.test(JSON.stringify(result)), false);
console.log("BRI-03B.1 tenure readiness tests passed: inclusive and MAR_01 governance, exhaustive tenure/portion reconciliation, FY/Management Bank scope, privacy, immutability, and replacement refresh.");
