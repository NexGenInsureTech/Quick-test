/* BRI-03B.2A-D1: shared governed product identity and expiry cohort evidence. */
"use strict";
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const root = path.join(__dirname, "..");
global.window = global;
const load = (file) => vm.runInThisContext(fs.readFileSync(path.join(root, file), "utf8"), { filename: file });

global.BancaTrackerCommercialRollups = {
  buildMetadataIndex() { return new Map(); }, attachMetadata(rows) { return rows; },
  getDimensionValue() { return { key: "ALL", label: "Overall" }; },
};
global.BancaTrackerCommercialExecution = { getDaysInPeriod() { return 31; } };
load("js/enrichment/dateResolver.js");
load("js/analytics/policyTenure.js");
load("js/analytics/managementBank.js");
load("js/analytics/commercialDriverAnalysis.js");
load("js/analytics/premiumComposition.js");

const Drivers = BancaTrackerCommercialDriverAnalysis;
const coded = Drivers.resolveProductIdentity({ productCode: " p1 ", productName: "Product One" });
assert.deepStrictEqual(coded, { key: "PRODUCT_CODE:P1", label: "Product One", code: "P1", name: "Product One", diagnostics: [] });
assert.deepStrictEqual(Drivers.resolveProductIdentity({ productName: " Name only " }), { key: "PRODUCT_NAME:Name only", label: "Name only", code: null, name: "Name only", diagnostics: [{ code: "PRODUCT_TEXT_FALLBACK", key: "PRODUCT_NAME:Name only", detail: null }] });
assert.strictEqual(Drivers.resolveProductIdentity({}).key, "__UNMAPPED__");
assert.ok(Object.isFrozen(coded) && Object.isFrozen(coded.diagnostics));
const parity = Drivers.buildExecutionDrivers({ facts: [{ monthKey: "2026-04", day: 1, premium: 1, productCode: " p1 ", productName: "Product One" }], parentSelection: { parentDimension: "OVERALL", parentKey: "ALL" }, periodKey: "2026-04", asOfDay: 30, driverDimension: "PRODUCT" });
assert.strictEqual(parity.rows[0].key, coded.key); assert.strictEqual(parity.rows[0].label, coded.label);

const base = {
  premium: 10, financialYear: "FY2025-26", monthKey: "2025-04", bank: "INDIAN BANK",
  productCode: "P1", productName: "One", premiumPortionStatus: "SUCCESS", premiumPortionClassification: "INITIAL_PORTION",
  policyTenureStatus: "SUCCESS", policyTenureClassification: "ANNUAL", coverageDateDiagnosticCodes: [], policyTenureDiagnosticCodes: [],
  coverageEndDateNormalized: "2027-03-31",
};
const facts = [
  base,
  { ...base, premium: -2.5, bank: "INDIAN BANK (PMSBY)", coverageEndDateNormalized: "2026-02-28", productName: "Uno", premiumPortionClassification: "ADVANCE_PORTION", policyTenureStatus: "UNKNOWN", policyTenureClassification: "UNKNOWN" },
  { ...base, premium: 0, coverageEndDateNormalized: "2024-02-29", productCode: "", productName: "Fallback", premiumPortionStatus: "UNKNOWN", premiumPortionClassification: "UNKNOWN", policyTenureStatus: "INVALID", policyTenureClassification: "INVALID", coverageDateDiagnosticCodes: ["COVERAGE_START_DATE_INVALID"] },
  { ...base, premium: 0.1, coverageEndDateNormalized: "2026-12-31", productCode: "", productName: "", premiumPortionStatus: "INVALID", premiumPortionClassification: "INVALID" },
  { ...base, premium: 0.2, coverageEndDateNormalized: "2026-12-31", productName: "Two" },
  { ...base, premium: -0.3, coverageEndDateNormalized: "2026-12-31" },
  { ...base, premium: 5, coverageEndDateNormalized: null, coverageDateDiagnosticCodes: ["COVERAGE_END_DATE_MISSING"] },
  { ...base, premium: 6, coverageEndDateNormalized: "bad", coverageDateDiagnosticCodes: ["COVERAGE_END_DATE_INVALID"] },
  { ...base, premium: 7, coverageEndDateNormalized: "2025-01-01", coverageDateDiagnosticCodes: ["COVERAGE_END_BEFORE_START"] },
  { premium: 8, financialYear: "FY2025-26", monthKey: "2025-04", bank: "INDIAN BANK", productName: "Legacy", premiumPortionStatus: "UNKNOWN", premiumPortionClassification: "UNKNOWN" },
  { ...base, premium: 99, bank: "INDIAN OVERSEAS BANK" },
  { ...base, premium: 1000, financialYear: "FY2026-27" },
];
const snapshot = JSON.stringify(facts);
let result = BancaTrackerPremiumComposition.buildPremiumComposition(facts, { financialYear: "FY2025-26", managementBank: "INDIAN BANK", reportingDate: "2026-12-15" });
assert.strictEqual(result.status, "READY");
assert.strictEqual(result.kpis.totalPremium, 33.5);
assert.deepStrictEqual(result.expiry.evidence, { VALID: { totalPremium: 7.5, rowCount: 6 }, MISSING: { totalPremium: 13, rowCount: 2 }, INVALID: { totalPremium: 13, rowCount: 2 } });
assert.deepStrictEqual(result.expiry.months.map((row) => [row.expiryMonth, row.expiryFinancialYear, row.timingBand, row.rowCount]), [
  ["2024-02", "FY2023-24", "PAST", 1], ["2026-02", "FY2025-26", "PAST", 1], ["2026-12", "FY2026-27", "REPORTING_MONTH", 3], ["2027-03", "FY2026-27", "FUTURE", 1],
]);
assert.ok(Math.abs(result.expiry.months.find((row) => row.expiryMonth === "2026-12").totalPremium) < 0.005);
assert.deepStrictEqual(result.expiry.reconciliation, { evidencePremiumDifference: 0, evidenceRowDifference: 0, validMonthPremiumDifference: 0, validMonthRowDifference: 0 });
assert.ok(result.expiry.months.every((row) => Object.values(row.reconciliation).every((difference) => difference === 0)));
assert.strictEqual(result.expiry.months.find((row) => row.expiryMonth === "2027-03").nextBoundaryValidatedRows, 1);
assert.strictEqual(BancaTrackerPolicyTenure.classifyPolicyTenure({ startDate: "2027-03-31", endDate: "2027-03-31", endDateConvention: "INCLUSIVE", leapDayAnniversaryConvention: "MAR_01" }).coverageEndExclusive, "2027-04-01");
assert.strictEqual(BancaTrackerPolicyTenure.classifyPolicyTenure({ startDate: "2024-02-29", endDate: "2024-02-29", endDateConvention: "INCLUSIVE", leapDayAnniversaryConvention: "MAR_01" }).coverageEndExclusive, "2024-03-01");
assert.strictEqual(result.expiry.months.find((row) => row.expiryMonth === "2024-02").tenureSubtotals[0].tenureClassification, "INVALID");
assert.ok(result.expiry.months.flatMap((row) => row.productSubtotals).some((row) => row.productKey === "PRODUCT_NAME:Fallback"));
assert.strictEqual(result.expiry.diagnosticCounts.PRODUCT_CODE_NAME_CONFLICT, 1);
assert.strictEqual(result.expiry.diagnosticCounts.DRIVER_UNMAPPED, 1);
assert.strictEqual(BancaTrackerPremiumComposition.buildPremiumComposition([{ ...base, coverageDateDiagnosticCodes: ["COVERAGE_END_HEADER_MISSING"] }], { financialYear: "FY2025-26", managementBank: "ALL", reportingDate: "2026-12-15" }).expiry.evidence.INVALID.rowCount, 1);
const derivedContradiction = BancaTrackerPremiumComposition.buildPremiumComposition([{ ...base, coverageStartDateNormalized: "2027-04-01", coverageEndDateNormalized: "2027-03-31", coverageDateDiagnosticCodes: [] }], { financialYear: "FY2025-26", managementBank: "ALL", reportingDate: "2026-12-15" });
assert.strictEqual(derivedContradiction.expiry.evidence.INVALID.rowCount, 1); assert.strictEqual(derivedContradiction.expiry.diagnosticCounts.COVERAGE_END_BEFORE_START_DERIVED, 1);
const incompleteStart = BancaTrackerPremiumComposition.buildPremiumComposition([{ ...base, coverageStartDateNormalized: "invalid", policyTenureStatus: "INVALID", policyTenureClassification: "INVALID", coverageDateDiagnosticCodes: ["COVERAGE_START_DATE_INVALID"] }], { financialYear: "FY2025-26", managementBank: "ALL", reportingDate: "2026-12-15" });
assert.strictEqual(incompleteStart.expiry.evidence.VALID.rowCount, 1); assert.strictEqual(incompleteStart.expiry.months[0].nextBoundaryValidatedRows, 1); assert.strictEqual(incompleteStart.expiry.diagnosticCounts.NEXT_COVERAGE_BOUNDARY_INVALID, undefined);
const malformedDiagnostics = BancaTrackerPremiumComposition.buildPremiumComposition([{ ...base, coverageDateDiagnosticCodes: { malformed: true }, policyTenureDiagnosticCodes: "malformed" }], { financialYear: "FY2025-26", managementBank: "ALL", reportingDate: "2026-12-15" });
assert.strictEqual(malformedDiagnostics.status, "READY"); assert.strictEqual(malformedDiagnostics.kpis.totalPremium, 10); assert.strictEqual(malformedDiagnostics.expiry.evidence.VALID.rowCount, 1); assert.strictEqual(malformedDiagnostics.expiry.diagnosticCounts.COVERAGE_DATE_DIAGNOSTICS_MALFORMED, 1);

const savedProductAuthority = global.BancaTrackerCommercialDriverAnalysis;
delete global.BancaTrackerCommercialDriverAnalysis;
const missingDependency = BancaTrackerPremiumComposition.buildPremiumComposition([base], { financialYear: "FY2025-26", managementBank: "ALL", reportingDate: "2026-12-15" });
assert.strictEqual(missingDependency.expiry.status, "DEPENDENCY_UNAVAILABLE"); assert.strictEqual(missingDependency.expiry.diagnosticCounts.EXPIRY_PRODUCT_IDENTITY_AUTHORITY_UNAVAILABLE, 1); assert.strictEqual(missingDependency.kpis.totalPremium, 10); assert.strictEqual(missingDependency.reconciliation.premiumDifference, 0);
global.BancaTrackerCommercialDriverAnalysis = savedProductAuthority;

const savedTenureAuthority = global.BancaTrackerPolicyTenure;
global.BancaTrackerPolicyTenure = { classifyPolicyTenure() { return { status: "SUCCESS", normalizedStartDate: "2027-03-31", normalizedEndDate: "2027-03-31", coverageEndExclusive: "2099-01-01", durationDays: 1 }; } };
const invalidBoundary = BancaTrackerPremiumComposition.buildPremiumComposition([base], { financialYear: "FY2025-26", managementBank: "ALL", reportingDate: "2026-12-15" });
assert.strictEqual(invalidBoundary.expiry.status, "DEPENDENCY_ERROR"); assert.strictEqual(invalidBoundary.expiry.diagnosticCounts.NEXT_COVERAGE_BOUNDARY_INVALID, 1); assert.strictEqual(invalidBoundary.kpis.totalPremium, 10);
global.BancaTrackerPolicyTenure = savedTenureAuthority;

const savedDateAuthority = global.BancaTrackerDateResolver;
global.BancaTrackerDateResolver = { resolve: savedDateAuthority.resolve, deriveFinancialYear() { throw new Error("synthetic FY failure"); } };
const throwingFinancialYear = BancaTrackerPremiumComposition.buildPremiumComposition([base], { financialYear: "FY2025-26", managementBank: "ALL", reportingDate: "2026-12-15" });
assert.strictEqual(throwingFinancialYear.expiry.status, "DEPENDENCY_ERROR"); assert.strictEqual(throwingFinancialYear.expiry.diagnosticCounts.EXPIRY_FINANCIAL_YEAR_AUTHORITY_ERROR, 1); assert.strictEqual(throwingFinancialYear.expiry.months[0].expiryFinancialYear, null); assert.strictEqual(throwingFinancialYear.kpis.totalPremium, 10); assert.strictEqual(throwingFinancialYear.reconciliation.premiumDifference, 0);
global.BancaTrackerDateResolver = { resolve: savedDateAuthority.resolve, deriveFinancialYear() { return "MALFORMED"; } };
const malformedFinancialYear = BancaTrackerPremiumComposition.buildPremiumComposition([base], { financialYear: "FY2025-26", managementBank: "ALL", reportingDate: "2026-12-15" });
assert.strictEqual(malformedFinancialYear.expiry.status, "DEPENDENCY_ERROR"); assert.strictEqual(malformedFinancialYear.expiry.diagnosticCounts.EXPIRY_FINANCIAL_YEAR_INVALID, 1); assert.strictEqual(malformedFinancialYear.expiry.months[0].expiryFinancialYear, null); assert.strictEqual(malformedFinancialYear.kpis.totalPremium, 10);
global.BancaTrackerDateResolver = { deriveFinancialYear: savedDateAuthority.deriveFinancialYear, resolve(value) { const resolved = savedDateAuthority.resolve(value); return value === "2026-12-15" && resolved.success ? { ...resolved, monthKey: "2026-11" } : resolved; } };
const inconsistentReportingMonth = BancaTrackerPremiumComposition.buildPremiumComposition([base], { financialYear: "FY2025-26", managementBank: "ALL", reportingDate: "2026-12-15" });
assert.strictEqual(inconsistentReportingMonth.expiry.status, "DEPENDENCY_ERROR"); assert.strictEqual(inconsistentReportingMonth.expiry.diagnosticCounts.REPORTING_MONTH_AUTHORITY_INCONSISTENT, 1); assert.strictEqual(inconsistentReportingMonth.kpis.totalPremium, 10);
global.BancaTrackerDateResolver = savedDateAuthority;
assert.strictEqual(JSON.stringify(facts), snapshot);
assert.ok(Object.isFrozen(result) && Object.isFrozen(result.expiry.months[0].productSubtotals));
assert.doesNotMatch(JSON.stringify(result), /policyCount|renewalEligibility|expectedRenewal|PRIVATE|endorsementNumber|coverageEndDateNormalized/);

const changedDate = BancaTrackerPremiumComposition.buildPremiumComposition(facts, { financialYear: "FY2025-26", managementBank: "INDIAN BANK", reportingDate: "2027-04-01" });
assert.strictEqual(changedDate.kpis.totalPremium, result.kpis.totalPremium); assert.deepStrictEqual(changedDate.expiry.evidence, result.expiry.evidence);
assert.ok(changedDate.expiry.months.every((row) => row.timingBand === "PAST"));
for (const reportingDate of [undefined, "2026-02-30", "10/11/2026"]) {
  const scoped = BancaTrackerPremiumComposition.buildPremiumComposition(facts, { financialYear: "FY2025-26", managementBank: "INDIAN BANK", reportingDate });
  assert.notStrictEqual(scoped.expiry.status, "READY"); assert.strictEqual(scoped.kpis.totalPremium, 33.5); assert.strictEqual(scoped.reconciliation.premiumDifference, 0);
}

class Element { constructor() { this.innerHTML = ""; this.value = ""; this.listeners = {}; } addEventListener(type, handler) { this.listeners[type] = handler; } }
const ids = ["premiumCompositionFinancialYear", "premiumCompositionManagementBank", "premiumCompositionReportingDate", "premiumCompositionReadiness", "premiumCompositionKpis", "premiumCompositionTrend", "premiumCompositionProducts", "premiumTenureReadiness", "premiumTenureMatrix", "premiumExpiryReadiness", "premiumExpiryCohorts"];
const elements = Object.fromEntries(ids.map((id) => [id, new Element()])); global.document = { getElementById: (id) => elements[id] };
global.BancaTrackerUtils = { escapeHtml: (value) => String(value == null ? "" : value).replace(/[&<>"']/g, ""), formatRupees: (value) => `Rs ${value}` };
global.BancaTrackerCore = { state: { factData: facts } }; load("js/premiumCompositionUI.js");
BancaTrackerPremiumCompositionUI.state.financialYear = "FY2025-26"; BancaTrackerPremiumCompositionUI.state.managementBank = "INDIAN BANK"; BancaTrackerPremiumCompositionUI.state.reportingDate = "2026-12-15";
result = BancaTrackerPremiumCompositionUI.render(); assert.match(elements.premiumExpiryCohorts.innerHTML, /Historical Signed Premium/); assert.match(elements.premiumExpiryReadiness.innerHTML, /EXPIRY-DATE EVIDENCE/);
global.BancaTrackerCore.state.factData = [{ ...base, premium: -9, coverageEndDateNormalized: "2030-01-31" }];
result = BancaTrackerPremiumCompositionUI.render(); assert.strictEqual(BancaTrackerPremiumCompositionUI.state.reportingDate, "2026-12-15"); assert.deepStrictEqual(result.expiry.months.map((row) => row.expiryMonth), ["2030-01"]); assert.ok(!elements.premiumExpiryCohorts.innerHTML.includes("Mar-27"));
const onePaisaFailure = { ...result, expiry: { ...result.expiry, evidence: { VALID: { totalPremium: -9, rowCount: 1 }, MISSING: { totalPremium: 0, rowCount: 0 }, INVALID: { totalPremium: 0, rowCount: 0 } }, reconciliation: { evidencePremiumDifference: 0, evidenceRowDifference: 0, validMonthPremiumDifference: 0, validMonthRowDifference: 0 }, months: result.expiry.months.map((row, index) => index ? row : { ...row, reconciliation: { ...row.reconciliation, productPremiumDifference: 0.01 } }) } };
BancaTrackerPremiumCompositionUI.renderExpiry(onePaisaFailure); assert.match(elements.premiumExpiryReadiness.innerHTML, /Reconciliation PARTIAL/); assert.match(elements.premiumExpiryReadiness.innerHTML, /commercial-status-partial/);

const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
assert.match(html, /Historical signed premium/); assert.match(html, /does not establish policy status or renewal eligibility/); assert.doesNotMatch(fs.readFileSync(path.join(root, "js/analytics/premiumComposition.js"), "utf8"), /Date\.now|new Date\(\)/);
console.log("BRI-03B.2A expiry cohort tests passed: D1 parity, governed evidence, boundaries, signed reconciliation, deterministic timing, privacy and replacement refresh.");
