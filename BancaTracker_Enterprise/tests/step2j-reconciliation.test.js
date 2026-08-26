/* Step 2J: canonical enrichment reconciliation and compatibility gate. */
"use strict";

const assert = require("assert");
const path = require("path");
const Harness = require("./helpers/reconciliationHarness");

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
].forEach(load);

const geography = BancaTrackerGeographyMaster.prepareDataset(
  [
    {
      "STATE ID": "IN-AS",
      "STATE CODE": "AS",
      "STATE NAME": "Assam",
      "ZONE ID": "EAST",
      "ZONE NAME": "East",
      ACTIVE: "TRUE",
    },
    {
      "STATE ID": "IN-KA",
      "STATE CODE": "KA",
      "STATE NAME": "Karnataka",
      "ZONE ID": "SOUTH",
      "ZONE NAME": "South",
      ACTIVE: "TRUE",
    },
  ],
  "GEOGRAPHY_MASTER:TEST",
);
const geographyMaps = BancaTrackerGeographyResolver.buildLookupMaps(
  geography.records,
);

const branches = BancaTrackerBranchMaster.prepareDataset(
  [
    {
      "BANK ID": "IB",
      "BRANCH CODE": "00123",
      "BRANCH NAME": "Guwahati Main",
      "STATE ID": "IN-AS",
      ACTIVE: "TRUE",
    },
    {
      "BANK ID": "KB",
      "BRANCH CODE": "00456",
      "BRANCH NAME": "Bengaluru Main",
      "STATE ID": "IN-KA",
      ACTIVE: "TRUE",
    },
    {
      "BANK ID": "UNCONFIGURED",
      "BRANCH CODE": "00999",
      "BRANCH NAME": "Unknown Branch",
      "STATE ID": "IN-AS",
      ACTIVE: "TRUE",
    },
  ],
  "BRANCH_MASTER:TEST",
  { geographyRecords: geography.records },
);
const branchMaps = BancaTrackerBranchResolver.buildLookupMaps(branches.records);

const employees = BancaTrackerEmployeeMaster.prepareDataset(
  [
    ["NH001", "National Head", "NATIONAL_HEAD"],
    ["ZSM001", "ZSM One", "ZSM"],
    ["ASM001", "ASM One", "ASM"],
    ["CSM001", "CSM One", "CSM"],
    ["RM001", "RM One", "RM"],
  ].map(([employeeId, employeeName, role]) => ({
    "EMPLOYEE ID": employeeId,
    "EMPLOYEE NAME": employeeName,
    ROLE: role,
    ACTIVE: "TRUE",
  })),
  "EMPLOYEE_MASTER:TEST",
);
const hierarchy = BancaTrackerHierarchyMaster.prepareDataset(
  [
    ["ZSM001", "NH001"],
    ["ASM001", "ZSM001"],
    ["CSM001", "ASM001"],
    ["RM001", "CSM001"],
  ].map(([employeeId, managerId]) => ({
    "EMPLOYEE ID": employeeId,
    "MANAGER ID": managerId,
  })),
  "HIERARCHY:TEST",
  { employeeRecords: employees.records },
);
const hierarchyMaps = BancaTrackerHierarchyResolver.buildLookupMaps(
  employees.records,
  hierarchy.records,
);

const assignments = BancaTrackerBranchAssignmentMaster.prepareDataset(
  [
    {
      "BANK ID": "IB",
      "BRANCH CODE": "00123",
      "RM ID": "RM001",
      ACTIVE: "TRUE",
    },
    {
      "BANK ID": "KB",
      "BRANCH CODE": "00456",
      "RM ID": "RM001",
      ACTIVE: "TRUE",
    },
    {
      "BANK ID": "UNCONFIGURED",
      "BRANCH CODE": "00999",
      "RM ID": "RM001",
      ACTIVE: "TRUE",
    },
  ],
  "BRANCH_ASSIGNMENT:TEST",
  { branchRecords: branches.records, employeeRecords: employees.records },
);
const assignmentMaps = BancaTrackerAssignmentResolver.buildLookupMaps(
  assignments.records,
);

const context = {
  geographyMaps,
  branchMaps,
  hierarchyMaps,
  assignmentMaps,
};
const options = {
  configuredBanks: ["IB", "KB"],
  fiscalMonths: [
    "Apr-26",
    "May-26",
    "Jun-26",
    "Jul-26",
    "Aug-26",
    "Sep-26",
    "Oct-26",
    "Nov-26",
    "Dec-26",
    "Jan-27",
    "Feb-27",
    "Mar-27",
  ],
};

function row(overrides = {}) {
  return {
    policyNumber: "P001",
    policyIssuedDate: "24/08/2026",
    premium: 12500,
    bankId: "IB",
    branchCode: "00123",
    branchName: "Guwahati Main",
    state: "Assam",
    zone: "East",
    rmId: "RM001",
    rmName: "RM One",
    month: "Aug-26",
    day: 24,
    productCode: "H001",
    productName: "Health Product",
    lob: "Health",
    ...overrides,
  };
}

function reconcile(rows, enriched = null) {
  const results =
    enriched || BancaTrackerEnrichmentPipeline.enrichTransactions(rows, context);
  return Harness.reconcile(rows, results, options);
}

const cleanRows = [
  row(),
  row({
    policyNumber: "P002",
    policyIssuedDate: "10/07/2026",
    premium: 0,
    bankId: "KB",
    branchCode: "00456",
    branchName: "Bengaluru Main",
    state: "Karnataka",
    zone: "South",
    month: "Jul-26",
    day: 10,
    productCode: "M001",
    productName: "Motor Product",
    lob: "Motor",
  }),
  row({
    policyNumber: "P003",
    policyIssuedDate: "05/08/2026",
    premium: -2500,
    month: "Aug-26",
    day: 5,
  }),
  row({
    policyNumber: "P004",
    policyIssuedDate: "15/07/2026",
    premium: 4000,
    bankId: "UNCONFIGURED",
    branchCode: "00999",
    branchName: "Unknown Branch",
    state: "Assam",
    zone: "East",
    rmId: "RM999",
    month: "Jul-26",
    day: 15,
  }),
];

const clean = reconcile(cleanRows);
assert.strictEqual(clean.summary.unexplainedDifferences, 0);
assert.strictEqual(clean.summary.passed, true);
assert.ok(
  clean.comparisons.every(
    (comparison) => comparison.classification === "MATCH",
  ),
);
assert.strictEqual(clean.legacy.metrics.totalPremium, 14000);
assert.strictEqual(clean.canonical.metrics.totalPremium, 14000);
assert.strictEqual(clean.legacy.metrics.unknownBankPremium, 4000);
assert.strictEqual(clean.canonical.metrics.unknownBankPremium, 4000);
assert.strictEqual(clean.legacy.metrics.negativePremiumRecords, 1);
assert.strictEqual(clean.canonical.metrics.negativePremiumRecords, 1);
assert.strictEqual(clean.legacy.metrics.zeroPremiumRecords, 1);
assert.strictEqual(clean.canonical.metrics.zeroPremiumRecords, 1);
assert.ok(clean.canonical.metrics.sourceBranchCodePopulation.includes("00123"));

const monthRows = [row({ month: "Jul-26" })];
const monthMismatch = reconcile(monthRows);
assert.strictEqual(monthMismatch.summary.passed, true);
assert.strictEqual(
  monthMismatch.comparisons.find(
    (comparison) => comparison.metric === "monthPopulation",
  ).classification,
  "EXPECTED_DIFFERENCE",
);
assert.strictEqual(
  monthMismatch.comparisons.find(
    (comparison) => comparison.metric === "currentPeriodMonth",
  ).classification,
  "EXPECTED_DIFFERENCE",
);
assert.strictEqual(monthMismatch.legacy.metrics.totalPremium, 12500);
assert.strictEqual(monthMismatch.canonical.metrics.totalPremium, 12500);

const dayMismatch = reconcile([row({ day: 23 })]);
assert.strictEqual(
  dayMismatch.comparisons.find(
    (comparison) => comparison.metric === "dayPopulation",
  ).classification,
  "EXPECTED_DIFFERENCE",
);

const zoneMismatch = reconcile([row({ zone: "North" })]);
assert.strictEqual(
  zoneMismatch.comparisons.find(
    (comparison) => comparison.metric === "zonePopulation",
  ).classification,
  "EXPECTED_DIFFERENCE",
);

const fallbackRows = [
  row({ branchCode: "00998", branchName: "Guwahati Main" }),
];
const fallback = reconcile(fallbackRows);
assert.strictEqual(
  fallback.comparisons.find(
    (comparison) => comparison.metric === "branchPopulation",
  ).classification,
  "EXPECTED_DIFFERENCE",
);
assert.ok(
  fallback.expectedDifferences.some(
    (difference) => difference.reasonCode === "BRANCH_MATCHED_FALLBACK",
  ),
);
assert.strictEqual(fallback.legacy.metrics.totalPremium, 12500);
assert.strictEqual(fallback.canonical.metrics.totalPremium, 12500);

const sourceRmMismatch = reconcile([row({ rmId: "RM999" })]);
assert.deepStrictEqual(
  sourceRmMismatch.legacy.metrics.sourceRmPopulation,
  sourceRmMismatch.canonical.metrics.sourceRmPopulation,
);
assert.strictEqual(sourceRmMismatch.summary.passed, true);

const currentPeriodRows = [
  row({ policyNumber: "P-JUL", policyIssuedDate: "10/07/2026", month: "Jul-26", day: 10, premium: 100 }),
  row({ policyNumber: "P-AUG", premium: 200 }),
];
const currentPeriod = reconcile(currentPeriodRows);
assert.strictEqual(currentPeriod.legacy.metrics.currentPeriodMonth, "Aug-26");
assert.strictEqual(currentPeriod.canonical.metrics.currentPeriodMonth, "Aug-26");
assert.strictEqual(currentPeriod.legacy.metrics.currentPeriodPremium, 200);
assert.strictEqual(currentPeriod.canonical.metrics.currentPeriodPremium, 200);

const contribution = clean.comparisons.find(
  (comparison) => comparison.metric === "bankContributionPercent",
);
assert.strictEqual(contribution.classification, "MATCH");

const forcedRows = [row()];
const forcedEnriched = BancaTrackerEnrichmentPipeline.enrichTransactions(
  forcedRows,
  context,
);
forcedEnriched[0] = {
  ...forcedEnriched[0],
  transaction: {
    ...forcedEnriched[0].transaction,
    premium: forcedEnriched[0].transaction.premium + 1,
  },
};
const forced = reconcile(forcedRows, forcedEnriched);
assert.strictEqual(forced.summary.passed, false);
assert.ok(forced.summary.unexplainedDifferences > 0);
assert.ok(
  forced.unexplainedDifferences.some(
    (comparison) => comparison.metric === "totalPremium",
  ),
);

const representativeRows = [
  ...cleanRows,
  row({ policyNumber: "P-MONTH", month: "Jul-26" }),
  row({ policyNumber: "P-DAY", day: 23 }),
  row({ policyNumber: "P-ZONE", zone: "North" }),
  row({
    policyNumber: "P-FALLBACK",
    branchCode: "00998",
    branchName: "Guwahati Main",
  }),
  row({
    policyNumber: "P-UNMAPPED",
    branchCode: "00888",
    branchName: "Unmapped Branch",
  }),
  row({
    policyNumber: "P-RM",
    rmId: "RM999",
  }),
];
const finalResult = reconcile(representativeRows);
assert.strictEqual(finalResult.summary.passed, true);
assert.strictEqual(finalResult.summary.unexplainedDifferences, 0);

console.log("Step 2J Reconciliation");
console.log(`MATCH: ${finalResult.summary.matches}`);
console.log(
  `EXPECTED_DIFFERENCE: ${finalResult.summary.expectedDifferences}`,
);
console.log(
  `UNEXPLAINED_DIFFERENCE: ${finalResult.summary.unexplainedDifferences}`,
);
console.log("PASS");
