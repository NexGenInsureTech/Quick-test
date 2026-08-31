/* Step 3C: additive canonical and master-data quality integration. */
"use strict";

const assert = require("assert");
const path = require("path");

class Element { constructor() { this.innerHTML = ""; this.textContent = ""; } }
const elements = {};
global.window = global;
global.document = { getElementById(id) { return elements[id] || (elements[id] = new Element()); } };
const load = (file) => require(path.join(__dirname, "..", file));

[
  "qualitySummary", "qualityScope", "hierarchyConflicts", "identityConflicts",
  "monthBankCoverage", "premiumQuality", "fieldCompleteness", "duplicateSignals",
  "branchUniverseSanity", "canonicalQualityScope", "canonicalQualitySummary",
  "canonicalMasterCoverage", "canonicalResolutionQuality", "canonicalComparisons",
  "canonicalFindingSummary", "canonicalFindingDetails", "canonicalFindingLimit",
  "canonicalReconciliation",
].forEach((id) => document.getElementById(id));

load("js/config.js");
load("js/utilities.js");
load("js/enrichment/readinessDiagnostics.js");
load("js/canonicalDataQuality.js");
const Canonical = BancaTrackerCanonicalDataQuality;

function row(overrides = {}) {
  const base = {
    status: "READY",
    transaction: { policyNumber: "P1" },
    findings: [],
    resolution: {
      date: { success: true }, branch: { status: "MATCHED_EXACT" },
      geography: { status: "MATCHED_ID" }, assignment: { status: "RESOLVED" },
      hierarchy: { status: "RESOLVED" },
    },
    comparisons: { legacyMonth: "MATCH", legacyDay: "MATCH", legacyZone: "MATCH", sourceVsAssignedRm: "MATCH" },
  };
  return {
    ...base, ...overrides,
    transaction: { ...base.transaction, ...(overrides.transaction || {}) },
    resolution: { ...base.resolution, ...(overrides.resolution || {}) },
    comparisons: { ...base.comparisons, ...(overrides.comparisons || {}) },
  };
}

function shadow(rows, overrides = {}) {
  return {
    status: "READY", sourceRecordCount: rows.length, canonicalResults: rows,
    masterStatus: { geography: "ACTIVE", branch: "ACTIVE", employee: "ACTIVE", hierarchy: "ACTIVE", assignment: "ACTIVE" },
    reconciliation: { unexplainedDifferences: 0 }, ...overrides,
  };
}

function finding(code, severity = "WARNING", category = "REFERENCE") {
  return { code, severity, category, field: "sample", message: `${code} message` };
}

const notRun = Canonical.render(null);
assert.strictEqual(notRun.readiness.overallStatus, "NOT_RUN");
assert.match(elements.canonicalQualitySummary.innerHTML, /NOT RUN/);
assert.match(elements.canonicalQualityScope.textContent, /available after PR data is processed/);

const ready = Canonical.render(shadow([row()]));
assert.strictEqual(ready.readiness.overallStatus, "READY");
assert.match(elements.canonicalQualitySummary.innerHTML, /READY/);
assert.strictEqual((elements.canonicalMasterCoverage.innerHTML.match(/ACTIVE/g) || []).length, 5);
assert.strictEqual((elements.canonicalResolutionQuality.innerHTML.match(/100\.0%/g) || []).length, 6);
assert.match(elements.canonicalQualitySummary.innerHTML, /Invalid<\/div><div class="value">0/);
assert.match(elements.canonicalReconciliation.innerHTML, /PASS \/ Reconciled/);
assert.match(elements.canonicalReconciliation.innerHTML, /Unexplained Differences: 0/);

const absentFindings = [
  finding("GEOGRAPHY_MASTER_ABSENT"), finding("BRANCH_MASTER_ABSENT"),
  finding("EMPLOYEE_MASTER_ABSENT"), finding("HIERARCHY_MASTER_ABSENT"),
  finding("ASSIGNMENT_MASTER_ABSENT"),
];
const absent = Canonical.render(shadow([
  row({ status: "READY_WITH_WARNINGS", findings: absentFindings,
    resolution: { branch: { status: "MASTER_ABSENT" }, geography: { status: "MASTER_ABSENT" }, assignment: { status: "MASTER_ABSENT" }, hierarchy: { status: "MASTER_ABSENT" } } }),
], { status: "PARTIAL", masterStatus: { geography: "ABSENT", branch: "ABSENT", employee: "ABSENT", hierarchy: "ABSENT", assignment: "ABSENT" } }));
assert.strictEqual(absent.readiness.overallStatus, "PARTIAL");
assert.strictEqual((elements.canonicalMasterCoverage.innerHTML.match(/ABSENT/g) || []).length, 5);
for (const item of absentFindings) assert.ok(elements.canonicalFindingSummary.innerHTML.includes(item.code));

const branchQuality = Canonical.render(shadow([
  row(),
  row({ status: "READY_WITH_WARNINGS", resolution: { branch: { status: "MATCHED_FALLBACK" } }, findings: [finding("BRANCH_FALLBACK_USED")] }),
  row({ status: "READY_WITH_WARNINGS", resolution: { branch: { status: "UNMAPPED" }, assignment: { status: "UNCONFIGURED" }, hierarchy: { status: "UNCONFIGURED" } }, findings: [finding("BRANCH_UNMAPPED")] }),
  row({ status: "READY_WITH_WARNINGS", resolution: { branch: { status: "AMBIGUOUS" }, assignment: { status: "UNCONFIGURED" }, hierarchy: { status: "UNCONFIGURED" } }, findings: [finding("BRANCH_AMBIGUOUS")] }),
]));
assert.strictEqual(branchQuality.readiness.resolution.branch.exact, 1);
assert.strictEqual(branchQuality.readiness.resolution.branch.fallback, 1);
assert.strictEqual(branchQuality.readiness.resolution.branch.unmapped, 1);
assert.strictEqual(branchQuality.readiness.resolution.branch.ambiguous, 1);
for (const text of ["Branch fallback", "Branch unmapped", "Branch ambiguous"]) assert.ok(elements.canonicalResolutionQuality.innerHTML.includes(text));

const geoQuality = Canonical.render(shadow([
  row(), row({ status: "READY_WITH_WARNINGS", resolution: { geography: { status: "UNMAPPED" } }, findings: [finding("GEOGRAPHY_UNMAPPED")] }),
]));
assert.strictEqual(geoQuality.readiness.readiness.geographyResolvedPct.percentage, 50);
assert.match(elements.canonicalResolutionQuality.innerHTML, /50\.0%/);
assert.match(elements.canonicalFindingSummary.innerHTML, /GEOGRAPHY_UNMAPPED/);

const ownershipQuality = Canonical.render(shadow([
  row(),
  row({ status: "READY_WITH_WARNINGS", resolution: { assignment: { status: "UNMAPPED" }, hierarchy: { status: "UNCONFIGURED" } }, findings: [finding("ASSIGNMENT_UNMAPPED")] }),
  row({ status: "READY_WITH_WARNINGS", resolution: { hierarchy: { status: "PARTIAL" } }, findings: [finding("HIERARCHY_PARTIAL")] }),
]));
assert.strictEqual(ownershipQuality.readiness.resolution.assignment.unmapped, 1);
assert.strictEqual(ownershipQuality.readiness.resolution.hierarchy.partial, 1);
assert.match(elements.canonicalResolutionQuality.innerHTML, /Assignment unmapped/);
assert.match(elements.canonicalResolutionQuality.innerHTML, /Hierarchy partial/);

const mismatches = Canonical.render(shadow([
  row({ status: "READY_WITH_WARNINGS",
    comparisons: { legacyMonth: "MISMATCH", legacyDay: "MISMATCH", legacyZone: "MISMATCH", sourceVsAssignedRm: "MISMATCH" },
    findings: [finding("LEGACY_MONTH_MISMATCH"), finding("LEGACY_DAY_MISMATCH"), finding("LEGACY_ZONE_MISMATCH"), finding("SOURCE_ASSIGNED_RM_MISMATCH")],
  }),
]));
assert.strictEqual(mismatches.readiness.overallStatus, "PARTIAL");
assert.strictEqual(mismatches.readiness.blockers.length, 0);
for (const label of ["Legacy Month mismatch", "Legacy Day mismatch", "Legacy Zone mismatch", "Source / assigned RM mismatch"]) {
  assert.ok(elements.canonicalComparisons.innerHTML.includes(label));
}
assert.match(elements.canonicalComparisons.innerHTML, /Warning \/ review; not automatically an error/);

const invalid = Canonical.render(shadow([
  row(), row({ status: "INVALID", resolution: { date: { success: false } }, findings: [finding("DATE_INVALID", "ERROR", "DATE"), finding("PREMIUM_INVALID", "ERROR", "PREMIUM")] }),
]));
assert.strictEqual(invalid.readiness.records.invalid, 1);
assert.strictEqual(invalid.readiness.overallStatus, "PARTIAL");
assert.match(elements.canonicalFindingSummary.innerHTML, /DATE_INVALID/);
assert.match(elements.canonicalFindingSummary.innerHTML, /PREMIUM_INVALID/);
assert.match(elements.canonicalFindingSummary.innerHTML, /quality-error/);

const blocked = Canonical.render(shadow([row()], { reconciliation: { unexplainedDifferences: 2 } }));
assert.strictEqual(blocked.readiness.overallStatus, "NOT_READY");
assert.match(elements.canonicalQualitySummary.innerHTML, /NOT READY/);
assert.match(elements.canonicalReconciliation.innerHTML, /Investigation required/);
assert.match(elements.canonicalReconciliation.innerHTML, /Unexplained Differences: 2/);
assert.match(elements.canonicalReconciliation.innerHTML, /UNEXPLAINED_RECONCILIATION_DIFFERENCE/);

const manyFindings = Array.from({ length: 105 }, (_, index) => finding(`FINDING_${index}`, "INFO", "TEST"));
const bounded = Canonical.render(shadow([row({ status: "READY_WITH_WARNINGS", findings: manyFindings })]));
assert.strictEqual(bounded.findings.totalCount, 105);
assert.strictEqual((elements.canonicalFindingDetails.innerHTML.match(/<tr>/g) || []).length, 101);
assert.match(elements.canonicalFindingLimit.textContent, /Showing first 100 of 105/);

let writes = 0;
global.BancaTrackerRepository = new Proxy({}, { get() { return () => { writes += 1; }; } });
Canonical.render(shadow([row()]));
assert.strictEqual(writes, 0);

global.BancaTrackerShadowEnrichment = { getLastResult: () => null };
load("js/dataQuality.js");
const audit = BancaTrackerDataQuality.build([], BancaTrackerConfig, { acceptedRows: 0, rejectedRows: 0, warningRows: 0 });
BancaTrackerDataQuality.render(audit);
assert.match(elements.qualityScope.textContent, /full accepted upload/);
assert.match(elements.branchUniverseSanity.innerHTML, /Within configured bound/);
assert.match(elements.canonicalQualitySummary.innerHTML, /NOT RUN/);

console.log("Step 3C canonical Data Quality tests passed: additive rendering, readiness states, masters, resolution, mismatches, aggregation, bounded detail, reconciliation, and no writes.");
