/* Step 2L: deterministic shadow readiness diagnostics foundation. */
"use strict";

const assert = require("assert");
const path = require("path");

global.window = global;
const load = (file) => require(path.join(__dirname, "..", file));

[
  "js/data/schema.js",
  "js/data/datasetRegistry.js",
  "js/masters/geographyMaster.js",
  "js/masters/branchMaster.js",
  "js/masters/employeeMaster.js",
  "js/masters/hierarchyMaster.js",
  "js/masters/branchAssignmentMaster.js",
  "js/enrichment/dateResolver.js",
  "js/enrichment/geographyResolver.js",
  "js/enrichment/branchResolver.js",
  "js/enrichment/hierarchyResolver.js",
  "js/enrichment/assignmentResolver.js",
  "js/enrichment/enrichmentPipeline.js",
  "js/enrichment/shadowEnrichment.js",
  "js/enrichment/readinessDiagnostics.js",
].forEach(load);

const Diagnostics = BancaTrackerReadinessDiagnostics;

function hasCode(items, code) {
  return items.some((item) => item.code === code);
}

function canonicalResult(overrides = {}) {
  const base = {
    status: "READY",
    transaction: { premium: 100 },
    findings: [],
    resolution: {
      date: { success: true, status: "RESOLVED" },
      branch: { success: true, status: "MATCHED_EXACT" },
      geography: { success: true, status: "MATCHED_ID" },
      assignment: { success: true, status: "RESOLVED" },
      hierarchy: { success: true, status: "RESOLVED" },
    },
    comparisons: {
      legacyMonth: "MATCH",
      legacyDay: "MATCH",
      legacyZone: "MATCH",
      sourceVsAssignedRm: "MATCH",
    },
  };

  return {
    ...base,
    ...overrides,
    resolution: { ...base.resolution, ...(overrides.resolution || {}) },
    comparisons: { ...base.comparisons, ...(overrides.comparisons || {}) },
  };
}

function shadowResult(results, overrides = {}) {
  return {
    status: "READY",
    sourceRecordCount: results.length,
    canonicalRecordCount: results.length,
    invalidRecordCount: results.filter((row) => row.status === "INVALID").length,
    canonicalResults: results,
    masterStatus: {
      geography: { status: "ACTIVE", datasetId: "GEOGRAPHY_MASTER:1", recordCount: 1 },
      branch: { status: "ACTIVE", datasetId: "BRANCH_MASTER:1", recordCount: 1 },
      employee: { status: "ACTIVE", datasetId: "EMPLOYEE_MASTER:1", recordCount: 5 },
      hierarchy: { status: "ACTIVE", datasetId: "HIERARCHY:1", recordCount: 4 },
      assignment: { status: "ACTIVE", datasetId: "BRANCH_ASSIGNMENT:1", recordCount: 1 },
    },
    reconciliation: { unexplainedDifferences: 0 },
    ...overrides,
  };
}

(async function () {
  const notRun = Diagnostics.buildReadiness(null);
  assert.strictEqual(notRun.overallStatus, "NOT_RUN");
  assert.deepStrictEqual(notRun.blockers, []);
  assert.strictEqual(notRun.readiness.branchExactPct.denominator, 0);

  const failed = Diagnostics.buildReadiness({
    status: "FAILED",
    canonicalResults: [],
    sourceRecordCount: 1,
  });
  assert.strictEqual(failed.overallStatus, "NOT_READY");
  assert.ok(hasCode(failed.blockers, "SHADOW_FAILED"));

  const noMasterShadow = await BancaTrackerShadowEnrichment.run(
    [{
      policyNumber: "P-NO-MASTER",
      policyIssuedDate: "24/08/2026",
      premium: 100,
      bankId: "IB",
      branchCode: "00123",
      branchName: "Guwahati Main",
      state: "Assam",
    }],
    { context: {} },
  );
  const noMasters = Diagnostics.buildReadiness(noMasterShadow);
  assert.strictEqual(noMasters.overallStatus, "PARTIAL");
  assert.ok(Object.values(noMasters.masters).every((master) => !master.configured));
  assert.strictEqual(noMasters.readiness.branchResolvedPct.percentage, 0);
  assert.strictEqual(noMasters.readiness.geographyResolvedPct.percentage, 0);
  assert.strictEqual(noMasters.readiness.dateReadyPct.percentage, 100);

  const happy = Diagnostics.buildReadiness(shadowResult([canonicalResult()]));
  assert.strictEqual(happy.overallStatus, "READY");
  assert.strictEqual(happy.blockers.length, 0);
  assert.strictEqual(happy.warnings.length, 0);
  assert.strictEqual(happy.masters.geography.datasetId, "GEOGRAPHY_MASTER:1");
  assert.strictEqual(happy.masters.employee.recordCount, 5);
  Object.values(happy.readiness).forEach((value) => {
    assert.strictEqual(value.numerator, 1);
    assert.strictEqual(value.denominator, 1);
    assert.strictEqual(value.percentage, 100);
  });

  const fallback = Diagnostics.buildReadiness(
    shadowResult([
      canonicalResult(),
      canonicalResult({
        status: "READY_WITH_WARNINGS",
        resolution: { branch: { success: true, status: "MATCHED_FALLBACK" } },
      }),
    ]),
  );
  assert.strictEqual(fallback.overallStatus, "PARTIAL");
  assert.ok(hasCode(fallback.warnings, "BRANCH_FALLBACK_PRESENT"));
  assert.strictEqual(fallback.readiness.branchExactPct.percentage, 50);
  assert.strictEqual(fallback.readiness.branchResolvedPct.percentage, 100);

  const branchUnmapped = Diagnostics.buildReadiness(
    shadowResult([
      canonicalResult({
        status: "READY_WITH_WARNINGS",
        resolution: { branch: { success: false, status: "UNMAPPED" } },
      }),
    ]),
  );
  assert.strictEqual(branchUnmapped.overallStatus, "PARTIAL");
  assert.ok(hasCode(branchUnmapped.warnings, "BRANCH_UNMAPPED_PRESENT"));

  const geographyUnmapped = Diagnostics.buildReadiness(
    shadowResult([
      canonicalResult({
        status: "READY_WITH_WARNINGS",
        resolution: { geography: { success: false, status: "UNMAPPED" } },
      }),
    ]),
  );
  assert.ok(hasCode(geographyUnmapped.warnings, "GEOGRAPHY_UNMAPPED_PRESENT"));
  assert.strictEqual(geographyUnmapped.readiness.geographyResolvedPct.percentage, 0);

  const assignmentUnmapped = Diagnostics.buildReadiness(
    shadowResult([
      canonicalResult({
        status: "READY_WITH_WARNINGS",
        resolution: { assignment: { success: false, status: "UNMAPPED" } },
      }),
    ]),
  );
  assert.ok(hasCode(assignmentUnmapped.warnings, "ASSIGNMENT_UNMAPPED_PRESENT"));
  assert.strictEqual(assignmentUnmapped.readiness.assignmentResolvedPct.denominator, 1);
  assert.strictEqual(assignmentUnmapped.readiness.assignmentResolvedPct.percentage, 0);

  const partialHierarchy = Diagnostics.buildReadiness(
    shadowResult([
      canonicalResult({
        status: "READY_WITH_WARNINGS",
        resolution: { hierarchy: { success: false, status: "PARTIAL" } },
      }),
    ]),
  );
  assert.ok(hasCode(partialHierarchy.warnings, "HIERARCHY_PARTIAL_PRESENT"));
  assert.strictEqual(partialHierarchy.readiness.hierarchyResolvedPct.denominator, 1);
  assert.strictEqual(partialHierarchy.readiness.hierarchyResolvedPct.percentage, 0);

  const invalid = Diagnostics.buildReadiness(
    shadowResult([
      canonicalResult(),
      canonicalResult({
        status: "INVALID",
        resolution: { date: { success: false, status: "INVALID_DATE" } },
      }),
    ]),
  );
  assert.strictEqual(invalid.overallStatus, "PARTIAL");
  assert.ok(hasCode(invalid.warnings, "INVALID_ROWS_PRESENT"));
  assert.strictEqual(invalid.records.invalid, 1);
  assert.strictEqual(invalid.readiness.dateReadyPct.denominator, 2);
  assert.strictEqual(invalid.readiness.dateReadyPct.percentage, 50);
  assert.strictEqual(invalid.readiness.branchExactPct.denominator, 1);

  const reconciliationBlocked = Diagnostics.buildReadiness(
    shadowResult([canonicalResult()], {
      reconciliation: { unexplainedDifferences: 2 },
    }),
  );
  assert.strictEqual(reconciliationBlocked.overallStatus, "NOT_READY");
  assert.ok(
    hasCode(
      reconciliationBlocked.blockers,
      "UNEXPLAINED_RECONCILIATION_DIFFERENCE",
    ),
  );

  const rmMismatch = Diagnostics.buildReadiness(
    shadowResult([
      canonicalResult({
        status: "READY_WITH_WARNINGS",
        comparisons: { sourceVsAssignedRm: "MISMATCH" },
      }),
    ]),
  );
  assert.strictEqual(rmMismatch.overallStatus, "PARTIAL");
  assert.strictEqual(rmMismatch.blockers.length, 0);
  assert.ok(hasCode(rmMismatch.warnings, "SOURCE_ASSIGNED_RM_MISMATCH_PRESENT"));
  assert.strictEqual(rmMismatch.comparisons.sourceAssignedRmMismatch, 1);

  assert.strictEqual(Diagnostics.getStatusLabel("NOT_READY"), "Not ready");

  console.log(
    "Step 2L readiness diagnostics tests passed: NOT_RUN/FAILED, masters, strict readiness, explicit denominators, fallback/unmapped/invalid/mismatch warnings, and reconciliation blockers.",
  );
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
