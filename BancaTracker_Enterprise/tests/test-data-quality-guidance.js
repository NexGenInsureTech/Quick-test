/* Post-v8.4.1 Slice 3: deterministic actionable Data Quality guidance. */
"use strict";
const assert = require("assert");
const fs = require("fs");
const path = require("path");

class Element { constructor() { this.innerHTML = ""; this.textContent = ""; } }
const elements = {};
global.window = global;
global.document = { getElementById(id) { return elements[id] || (elements[id] = new Element()); } };
const root = path.join(__dirname, "..");
const load = (file) => require(path.join(root, file));

load("js/utilities.js");
load("js/config.js");
load("js/dataQualityGuidance.js");
const Guidance = BancaTrackerDataQualityGuidance;

const canonicalCodes = [
  "DATE_MISSING", "DATE_FORMAT_UNSUPPORTED", "DATE_INVALID", "PREMIUM_INVALID",
  "BRANCH_FALLBACK_USED", "BRANCH_UNMAPPED", "BRANCH_AMBIGUOUS", "BRANCH_MASTER_ABSENT",
  "GEOGRAPHY_UNMAPPED", "GEOGRAPHY_AMBIGUOUS", "GEOGRAPHY_MASTER_ABSENT",
  "ASSIGNMENT_UNMAPPED", "ASSIGNMENT_AMBIGUOUS", "ASSIGNMENT_MASTER_ABSENT",
  "EMPLOYEE_MASTER_ABSENT", "HIERARCHY_MASTER_ABSENT", "HIERARCHY_PARTIAL", "HIERARCHY_UNRESOLVED",
  "SOURCE_ASSIGNED_RM_MISMATCH", "LEGACY_MONTH_MISMATCH", "LEGACY_DAY_MISMATCH", "LEGACY_ZONE_MISMATCH",
  "OBSERVED_BRANCHES_EXCEED_GOVERNED_UNIVERSE", "ACTIVE_BRANCHES_EXCEED_GOVERNED_UNIVERSE",
  "SHADOW_FAILED", "UNEXPLAINED_RECONCILIATION_DIFFERENCE", "NO_CANONICAL_ROWS",
];
assert.deepStrictEqual([...Guidance.CANONICAL_CODES].sort(), [...canonicalCodes].sort(), "catalogue must cover every rendered canonical and reconciliation code");
assert.strictEqual(Guidance.LEGACY_TYPE_KEYS.length, 12, "all supported legacy presentation types must be covered");
Object.values(Guidance.LEGACY_TYPES).forEach((type) => assert.ok(Guidance.LEGACY_TYPE_KEYS.includes(type), type));

for (const code of ["DATE_MISSING", "DATE_FORMAT_UNSUPPORTED", "DATE_INVALID", "PREMIUM_INVALID"]) {
  assert.strictEqual(Guidance.lookupCanonical(code).mode, "CORRECT", code);
  assert.strictEqual(Guidance.lookupCanonical(code).correctionSource, "PR CSV", code);
}
for (const code of ["BRANCH_UNMAPPED", "BRANCH_AMBIGUOUS", "SOURCE_ASSIGNED_RM_MISMATCH", "LEGACY_MONTH_MISMATCH", "LEGACY_DAY_MISMATCH", "LEGACY_ZONE_MISMATCH", "UNEXPLAINED_RECONCILIATION_DIFFERENCE"]) {
  assert.strictEqual(Guidance.lookupCanonical(code).mode, "VERIFY", code);
}
assert.strictEqual(Guidance.lookupCanonical("BRANCH_FALLBACK_USED").mode, "REVIEW");
assert.match(Guidance.lookupCanonical("BRANCH_UNMAPPED").correctionSource, /PR CSV \/ Branch Master/);
const rmMismatch = Guidance.lookupCanonical("SOURCE_ASSIGNED_RM_MISMATCH");
assert.match(rmMismatch.action, /do not automatically prefer PR or governed assignment/i);

const unknown = Guidance.lookupCanonical("FUTURE_UNKNOWN_CODE");
assert.strictEqual(unknown.mode, "VERIFY");
assert.match(unknown.action, /only after establishing the authoritative value/i);
assert.doesNotMatch(unknown.action, /automatically|delete/i);

const negative = Guidance.lookupLegacy(Guidance.LEGACY_TYPES.NEGATIVE_PREMIUM);
assert.strictEqual(negative.mode, "REVIEW");
assert.match(`${negative.whyItMatters} ${negative.action}`, /cancellation.*refund.*adjustment/i);
assert.match(negative.action, /never delete or change sign solely/i);
const duplicate = Guidance.lookupLegacy(Guidance.LEGACY_TYPES.DUPLICATE_SIGNAL);
assert.strictEqual(duplicate.mode, "REVIEW");
assert.match(duplicate.whyItMatters, /heuristic/i);
assert.match(duplicate.action, /never delete automatically/i);
assert.strictEqual(Guidance.lookupLegacy(Guidance.LEGACY_TYPES.CONFIGURED_MONTH_ABSENT).mode, "INFORMATION");
assert.strictEqual(Guidance.lookupLegacy(Guidance.LEGACY_TYPES.BLANK_MONTH).mode, "CORRECT");

const renderedGuidance = Guidance.render(Guidance.lookupCanonical("DATE_INVALID"), BancaTrackerUtils.escapeHtml);
for (const label of ["CORRECT", "Issue", "Why it matters", "Check", "Action", "Fix in"]) assert.match(renderedGuidance, new RegExp(label));
const escaped = Guidance.render({ mode: "VERIFY", issue: "<script>x</script>", whyItMatters: "&", check: "<b>x</b>", action: "'x'", correctionSource: "\"x\"" }, BancaTrackerUtils.escapeHtml);
assert.doesNotMatch(escaped, /<script>|<b>/);
assert.match(escaped, /&lt;script&gt;|&amp;|&#39;|&quot;/);

load("js/dataQuality.js");
const base = { premium: 100, month: "Apr-26", bank: "INDIAN BANK", rm: "RM One", baCode: "BA1", lob: "Motor", branch: "Branch A", zone: "North", state: "Tamil Nadu", imd: "I1", businessType: "Fresh", productName: "Product One", productCode: "P1", day: "1" };
const rows = [
  { ...base }, { ...base },
  { ...base, premium: -200, zone: "West", state: "Karnataka", imd: "I2", rm: "RM Two", productName: "Product Uno" },
  { ...base, branch: "Branch B", baCode: "BA2" },
  { ...base, branch: "Branch C", month: "Odd-26", bank: "UNCONFIGURED BANK", premium: -50 },
  { ...base, branch: "Branch D", month: "" },
];
const audit = BancaTrackerDataQuality.build(rows, BancaTrackerConfig, { acceptedRows: rows.length });
const auditSnapshot = JSON.stringify(audit);
const findingSnapshot = audit.findings.map(({ severity, category, message }) => ({ severity, category, message }));
BancaTrackerDataQuality.render(audit);
assert.strictEqual(JSON.stringify(audit), auditSnapshot, "legacy guidance rendering must not mutate the audit");
assert.deepStrictEqual(audit.findings.map(({ severity, category, message }) => ({ severity, category, message })), findingSnapshot, "legacy finding messages and severity must remain unchanged");
assert.strictEqual(audit.findings.length, findingSnapshot.length, "legacy finding count must remain unchanged");
assert.match(elements.hierarchyConflicts.innerHTML, /What to do/);
assert.match(elements.identityConflicts.innerHTML, /What to do/);
assert.match(elements.premiumQuality.innerHTML, /REVIEW/);
assert.match(elements.duplicateSignals.innerHTML, /heuristic/i);
assert.doesNotMatch(fs.readFileSync(path.join(root, "js/dataQuality.js"), "utf8"), /finding\.message.*lookupLegacy|lookupLegacy.*finding\.message/, "legacy guidance must not parse finding messages");

load("js/enrichment/readinessDiagnostics.js");
load("js/canonicalDataQuality.js");
const findings = Array.from({ length: 105 }, (_, index) => ({ code: index ? "DATE_INVALID" : "FUTURE_UNKNOWN_CODE", severity: "ERROR", category: "DATE", field: "policyIssuedDate", message: index ? "Existing message" : "<script>unsafe</script>" }));
const canonicalRow = { status: "INVALID", transaction: { policyNumber: "P1" }, findings, resolution: { date: { success: false }, branch: { status: "UNMAPPED" }, geography: { status: "UNMAPPED" }, assignment: { status: "UNMAPPED" }, hierarchy: { status: "UNMAPPED" } }, comparisons: {} };
const shadow = { status: "READY", sourceRecordCount: 1, canonicalResults: [canonicalRow], masterStatus: { geography: "ACTIVE", branch: "ACTIVE", employee: "ACTIVE", hierarchy: "ACTIVE", assignment: "ACTIVE" }, reconciliation: { unexplainedDifferences: 0 } };
const canonicalSnapshot = JSON.stringify(shadow);
let writes = 0;
global.BancaTrackerRepository = new Proxy({}, { get() { return () => { writes += 1; }; } });
BancaTrackerCanonicalDataQuality.render(shadow);
assert.strictEqual(JSON.stringify(shadow), canonicalSnapshot, "canonical guidance rendering must not mutate canonical input");
assert.strictEqual(writes, 0, "guidance rendering must not write to the repository");
assert.match(elements.canonicalFindingDetails.innerHTML, /FUTURE_UNKNOWN_CODE/);
assert.match(elements.canonicalFindingDetails.innerHTML, /VERIFY/);
assert.doesNotMatch(elements.canonicalFindingDetails.innerHTML, /<script>unsafe<\/script>/);
assert.match(elements.canonicalFindingLimit.textContent, /Showing first 100 of 105/);
assert.strictEqual((elements.canonicalFindingDetails.innerHTML.match(/<tr>/g) || []).length, 101, "existing detail limit must remain 100 plus header");
assert.match(fs.readFileSync(path.join(root, "js/canonicalDataQuality.js"), "utf8"), /guidanceFor\(finding\.code\)/, "canonical guidance must use the stable finding code");

console.log("Slice 3 Data Quality guidance tests passed: catalogue coverage, conservative modes, safe rendering, non-mutation, limits, and authority isolation.");
