/* Step 2K: fail-safe shadow canonical enrichment integration. */
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
].forEach(load);

const Shadow = BancaTrackerShadowEnrichment;

function processedRow(overrides = {}) {
  return {
    premium: 12500,
    month: "Aug-26",
    bank: "IB",
    rm: "RM One",
    baCode: "00123",
    lob: "Health",
    branch: "Guwahati Main",
    zone: "East",
    state: "Assam",
    imd: "IMD001",
    productName: "Health Product",
    productCode: "H001",
    day: 24,
    policyNumber: "P001",
    policyIssuedDate: "24/08/2026",
    rmId: "RM001",
    ...overrides,
  };
}

function buildFullContext() {
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
    ],
    "GEOGRAPHY_MASTER:TEST",
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
    ],
    "BRANCH_MASTER:TEST",
    { geographyRecords: geography.records },
  );
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
  const assignments = BancaTrackerBranchAssignmentMaster.prepareDataset(
    [
      {
        "BANK ID": "IB",
        "BRANCH CODE": "00123",
        "RM ID": "RM001",
        ACTIVE: "TRUE",
      },
    ],
    "BRANCH_ASSIGNMENT:TEST",
    { branchRecords: branches.records, employeeRecords: employees.records },
  );

  return {
    context: {
      geographyMaps: BancaTrackerGeographyResolver.buildLookupMaps(
        geography.records,
      ),
      branchMaps: BancaTrackerBranchResolver.buildLookupMaps(branches.records),
      hierarchyMaps: BancaTrackerHierarchyResolver.buildLookupMaps(
        employees.records,
        hierarchy.records,
      ),
      assignmentMaps: BancaTrackerAssignmentResolver.buildLookupMaps(
        assignments.records,
      ),
    },
    masterStatus: {
      geography: "ACTIVE",
      branch: "ACTIVE",
      employee: "ACTIVE",
      hierarchy: "ACTIVE",
      assignment: "ACTIVE",
    },
  };
}

(async function () {
  const full = buildFullContext();
  const repositoryCalls = [];
  const recordsByType = {
    GEOGRAPHY_MASTER: [
      ...full.context.geographyMaps.stateById.values(),
    ],
    BRANCH_MASTER: [...full.context.branchMaps.branchById.values()],
    EMPLOYEE_MASTER: [...full.context.hierarchyMaps.employeeById.values()],
    HIERARCHY: [
      ...full.context.hierarchyMaps.managerByEmployeeId.entries(),
    ].map(([employeeId, managerId], index) => ({
      recordId: `H:${index}`,
      datasetId: "H:1",
      employeeId,
      managerId,
    })),
    BRANCH_ASSIGNMENT: [
      ...full.context.assignmentMaps.assignmentByBranchId.values(),
    ],
  };
  const loadedContext = await Shadow.buildContext({
    repository: {
      async getActiveMasterRecords(datasetType) {
        repositoryCalls.push(datasetType);
        return recordsByType[datasetType] || [];
      },
    },
  });
  assert.strictEqual(repositoryCalls.length, 5);
  assert.strictEqual(new Set(repositoryCalls).size, 5);
  assert.ok(loadedContext.context.branchMaps.branchById.has("IB:00123"));
  assert.ok(
    loadedContext.context.assignmentMaps.assignmentByBranchId.has("IB:00123"),
  );
  assert.ok(loadedContext.context.hierarchyMaps.employeeById.has("RM001"));
  assert.ok(
    Object.values(loadedContext.masterStatus).every(
      (status) => status === "ACTIVE",
    ),
  );

  Shadow.clear();
  assert.strictEqual(Shadow.getLastResult().status, "NOT_RUN");

  const noMasterSource = [processedRow()];
  const noMasterSnapshot = JSON.parse(JSON.stringify(noMasterSource));
  const noMasters = await Shadow.run(noMasterSource, { context: {} });
  assert.strictEqual(noMasters.status, "PARTIAL");
  assert.strictEqual(noMasters.canonicalRecordCount, 1);
  assert.ok(
    noMasters.canonicalResults[0].findings.some((finding) =>
      finding.code.endsWith("MASTER_ABSENT"),
    ),
  );
  assert.deepStrictEqual(noMasterSource, noMasterSnapshot);

  const fullSource = [processedRow({ premium: -2500 })];
  const fullResult = await Shadow.run(fullSource, full);
  const canonical = fullResult.canonicalResults[0].transaction;
  assert.strictEqual(fullResult.status, "READY");
  assert.strictEqual(canonical.branchId, "IB:00123");
  assert.strictEqual(canonical.zoneId, "EAST");
  assert.strictEqual(canonical.assignedRmId, "RM001");
  assert.strictEqual(canonical.nationalHeadId, "NH001");
  assert.strictEqual(canonical.premium, -2500);

  const signedSource = [
    processedRow({ policyNumber: "POS", premium: 100 }),
    processedRow({ policyNumber: "ZERO", premium: 0 }),
    processedRow({ policyNumber: "NEG", premium: -25 }),
  ];
  const signed = await Shadow.run(signedSource, full);
  assert.strictEqual(signed.reconciliation.totalPremium.matches, true);
  assert.strictEqual(signed.reconciliation.positiveCount.matches, true);
  assert.strictEqual(signed.reconciliation.zeroCount.matches, true);
  assert.strictEqual(signed.reconciliation.negativeCount.matches, true);
  assert.strictEqual(signed.reconciliation.unexplainedDifferences, 0);
  assert.deepStrictEqual(
    signed.canonicalResults.map((result) => result.transaction.premium),
    [100, 0, -25],
  );

  const legacyDifference = await Shadow.run(
    [processedRow({ month: "Jul-26", day: 23, zone: "North" })],
    full,
  );
  assert.strictEqual(legacyDifference.status, "PARTIAL");
  assert.strictEqual(
    legacyDifference.canonicalResults[0].transaction.monthLabel,
    "Aug-26",
  );
  assert.strictEqual(legacyDifference.reconciliation.totalPremium.matches, true);
  assert.strictEqual(
    legacyDifference.reconciliation.unexplainedDifferences,
    0,
  );

  const invalidSource = [
    processedRow(),
    processedRow({ policyNumber: "BAD", policyIssuedDate: "31/04/2026" }),
  ];
  const invalidSnapshot = JSON.parse(JSON.stringify(invalidSource));
  const invalid = await Shadow.run(invalidSource, full);
  assert.strictEqual(invalid.status, "PARTIAL");
  assert.strictEqual(invalid.invalidRecordCount, 1);
  assert.strictEqual(invalid.reconciliation.sourceRecordCount.expected, true);
  assert.deepStrictEqual(invalidSource, invalidSnapshot);

  const failed = await Shadow.run([processedRow()], {
    ...full,
    pipeline: {
      enrichTransactions() {
        throw new Error("Forced shadow failure");
      },
    },
  });
  assert.strictEqual(failed.status, "FAILED");
  assert.strictEqual(Shadow.getLastResult().status, "FAILED");
  assert.match(failed.error.message, /Forced shadow failure/);

  let releaseFirst;
  const firstDelay = new Promise((resolve) => {
    releaseFirst = resolve;
  });
  const firstRun = Shadow.run(
    [processedRow({ policyNumber: "OLDER" })],
    { ...full, beforeEnrich: () => firstDelay },
  );
  const secondRun = Shadow.run(
    [processedRow({ policyNumber: "LATEST" })],
    full,
  );
  const secondResult = await secondRun;
  releaseFirst();
  await firstRun;
  assert.strictEqual(
    Shadow.getLastResult().canonicalResults[0].transaction.policyNumber,
    "LATEST",
  );
  assert.strictEqual(Shadow.getLastResult().runId, secondResult.runId);

  const adapted = Shadow.adaptRecord({
    premium: 1,
    bank: "IB",
    baCode: "00123",
    branch: "Guwahati Main",
    rm: "RM One",
  });
  assert.strictEqual(adapted.bankId, "IB");
  assert.strictEqual(adapted.branchCode, "00123");
  assert.strictEqual(adapted.rmName, "RM One");
  assert.strictEqual(adapted.rmId, null);

  class Element {
    constructor() {
      this.value = "";
      this.innerHTML = "";
      this.textContent = "";
      this.style = {};
      this.classList = { toggle() {} };
    }
    addEventListener() {}
    add() {}
  }
  const elements = {};
  global.document = {
    getElementById(id) {
      return elements[id] || (elements[id] = new Element());
    },
  };
  global.Option = class {};
  global.sessionStorage = { getItem() { return null; }, setItem() {} };
  global.performance = require("perf_hooks").performance;

  [
    "js/config.js",
    "js/csvProcessor.js",
    "js/utilities.js",
    "js/analytics.js",
    "js/dataQuality.js",
    "js/productivity.js",
  ].forEach(load);

  let resolveShadowResult;
  function captureRealShadowRun() {
    const resultPromise = new Promise((resolve) => {
      resolveShadowResult = resolve;
    });
    global.BancaTrackerShadowEnrichment = {
      run(records) {
        return Shadow.run(records, full).then((result) => {
          resolveShadowResult(result);
          return result;
        });
      },
    };
    return resultPromise;
  }

  let shadowResultPromise = captureRealShadowRun();
  load("js/core.js");
  const header =
    "USGI NET PREMIUM,Month,INTERMEDIARY,BA NAME,Ba Code,LINE OF BUSINESS,BRANCH NAME,Zone,STATE,SUM IMD CODE,Day,POLICY ISSUED DATE";
  const csv = `${header}\n100,Aug-26,IB,RM One,00123,Health,Guwahati Main,East,Assam,IMD001,24,24/08/2026`;
  const uploadResult = BancaTrackerCore.loadCsvText(csv);
  assert.ok(uploadResult);
  assert.strictEqual(BancaTrackerCore.state.factData.length, 1);
  assert.strictEqual(BancaTrackerCore.state.derived.totalPremium, 100);
  assert.deepStrictEqual(
    {
      premium: BancaTrackerCore.state.factData[0].premium,
      month: BancaTrackerCore.state.factData[0].month,
      day: BancaTrackerCore.state.factData[0].day,
      zone: BancaTrackerCore.state.factData[0].zone,
      bank: BancaTrackerCore.state.factData[0].bank,
      branch: BancaTrackerCore.state.factData[0].branch,
      policyIssuedDate: BancaTrackerCore.state.factData[0].policyIssuedDate,
    },
    {
      premium: 100,
      month: "Aug-26",
      day: "24",
      zone: "East",
      bank: "IB",
      branch: "Guwahati Main",
      policyIssuedDate: "24/08/2026",
    },
  );
  assert.match(elements.status.textContent, /Loaded 1 records/);
  let realShadowResult = await shadowResultPromise;
  let canonicalDate = realShadowResult.canonicalResults[0].transaction;
  assert.strictEqual(canonicalDate.policyIssuedDate, "2026-08-24");
  assert.strictEqual(canonicalDate.year, 2026);
  assert.strictEqual(canonicalDate.month, 8);
  assert.strictEqual(canonicalDate.monthKey, "2026-08");
  assert.strictEqual(canonicalDate.monthLabel, "Aug-26");
  assert.strictEqual(canonicalDate.day, 24);
  assert.strictEqual(canonicalDate.financialYear, "FY2026-27");

  shadowResultPromise = captureRealShadowRun();
  const mismatchCsv = `${header}\n100,Jul-26,IB,RM One,00123,Health,Guwahati Main,North,Assam,IMD001,23,24/08/2026`;
  assert.ok(BancaTrackerCore.loadCsvText(mismatchCsv));
  assert.strictEqual(BancaTrackerCore.state.factData[0].month, "Jul-26");
  assert.strictEqual(BancaTrackerCore.state.factData[0].day, "23");
  assert.strictEqual(BancaTrackerCore.state.factData[0].zone, "North");
  realShadowResult = await shadowResultPromise;
  canonicalDate = realShadowResult.canonicalResults[0].transaction;
  assert.strictEqual(canonicalDate.monthLabel, "Aug-26");
  assert.strictEqual(canonicalDate.day, 24);
  for (const code of [
    "LEGACY_MONTH_MISMATCH",
    "LEGACY_DAY_MISMATCH",
    "LEGACY_ZONE_MISMATCH",
  ]) {
    assert.ok(
      realShadowResult.canonicalResults[0].findings.some(
        (finding) => finding.code === code,
      ),
    );
  }

  shadowResultPromise = captureRealShadowRun();
  const invalidDateCsv = `${header}\n100,Aug-26,IB,RM One,00123,Health,Guwahati Main,East,Assam,IMD001,24,31/04/2026`;
  assert.ok(BancaTrackerCore.loadCsvText(invalidDateCsv));
  assert.strictEqual(BancaTrackerCore.state.factData.length, 1);
  assert.strictEqual(BancaTrackerCore.state.derived.totalPremium, 100);
  realShadowResult = await shadowResultPromise;
  assert.strictEqual(realShadowResult.status, "PARTIAL");
  assert.strictEqual(realShadowResult.invalidRecordCount, 1);

  let hookCalls = 0;
  global.BancaTrackerShadowEnrichment = {
    run() {
      hookCalls += 1;
      return Promise.reject(new Error("Hook failure"));
    },
  };
  assert.ok(BancaTrackerCore.loadCsvText(csv));
  await new Promise((resolve) => setImmediate(resolve));
  assert.strictEqual(hookCalls, 1);
  assert.strictEqual(BancaTrackerCore.state.factData.length, 1);
  assert.strictEqual(BancaTrackerCore.state.derived.totalPremium, 100);

  console.log(
    "Step 2K shadow enrichment tests passed: no/full masters, reconciliation, expected warnings, invalid rows, failure isolation, immutability, latest-run ownership, signed premiums, and live-hook safety.",
  );
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
