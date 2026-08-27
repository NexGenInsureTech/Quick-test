/* Step 3A: read-only Master Data administration UI foundation. */
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

class Element {
  constructor() {
    this.innerHTML = "";
    this.textContent = "";
    this.style = {};
    this.listeners = {};
    this.classes = new Set();
    this.classList = {
      toggle: (name, enabled) => enabled ? this.classes.add(name) : this.classes.delete(name),
    };
  }
  addEventListener(type, listener) { this.listeners[type] = listener; }
}

const elements = {};
global.window = global;
global.document = {
  getElementById(id) {
    return elements[id] || (elements[id] = new Element());
  },
};
const load = (file) => require(path.join(__dirname, "..", file));

[
  "masterReadinessSummary",
  "masterStatusRows",
  "masterCoverageRows",
  "masterBlockers",
  "masterWarnings",
].forEach((id) => document.getElementById(id));

load("js/enrichment/readinessDiagnostics.js");
load("js/masterDataAdmin.js");
const Admin = BancaTrackerMasterDataAdmin;
const Diagnostics = BancaTrackerReadinessDiagnostics;

function readyRow(overrides = {}) {
  const base = {
    status: "READY",
    resolution: {
      date: { success: true },
      branch: { status: "MATCHED_EXACT" },
      geography: { status: "MATCHED_ID" },
      assignment: { status: "RESOLVED" },
      hierarchy: { status: "RESOLVED" },
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

function shadowResult(rows, overrides = {}) {
  return {
    status: "READY",
    sourceRecordCount: rows.length,
    canonicalResults: rows,
    masterStatus: {
      geography: "ACTIVE",
      branch: "ACTIVE",
      employee: "ACTIVE",
      hierarchy: "ACTIVE",
      assignment: "ACTIVE",
    },
    reconciliation: { unexplainedDifferences: 0 },
    ...overrides,
  };
}

(async function () {
  const sourceHtml = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  const sourceCss = fs.readFileSync(path.join(__dirname, "..", "style.css"), "utf8");
  assert.match(sourceHtml, /id="masterDataTab">Master Data/);
  assert.match(sourceHtml, /id="masterDataPage"/);
  assert.match(sourceHtml, /class="panel master-data-table"/);
  assert.match(sourceCss, /\.master-data-table\s*\{\s*overflow-x:\s*auto/);

  const notRun = Diagnostics.buildReadiness(null);
  Admin.renderViewModel(Admin.buildViewModel(notRun));
  assert.match(elements.masterReadinessSummary.innerHTML, /NOT RUN/);
  assert.match(elements.masterWarnings.innerHTML, /Canonical readiness will be available/);
  assert.strictEqual((elements.masterStatusRows.innerHTML.match(/<tr>/g) || []).length, 5);
  assert.strictEqual((elements.masterStatusRows.innerHTML.match(/ABSENT/g) || []).length, 5);
  assert.match(elements.masterStatusRows.innerHTML, />—</);

  let readCalls = 0;
  let writeCalls = 0;
  const activeByType = {
    GEOGRAPHY_MASTER: ["GEOGRAPHY_MASTER:2", 36, "geography.csv"],
    BRANCH_MASTER: ["BRANCH_MASTER:3", 977, "branches.csv"],
    EMPLOYEE_MASTER: ["EMPLOYEE_MASTER:1", 50, "employees.csv"],
    HIERARCHY: ["HIERARCHY:4", 49, "hierarchy.csv"],
    BRANCH_ASSIGNMENT: ["BRANCH_ASSIGNMENT:5", 900, "assignments.csv"],
  };
  const repository = {
    async getActiveDataset(type) {
      readCalls += 1;
      const [datasetId, rowCount, fileName] = activeByType[type];
      return { datasetId, rowCount, fileName, uploadedAt: "2026-08-27T10:20:30.000Z", status: "ACTIVE" };
    },
    stageDataset() { writeCalls += 1; },
    activateDataset() { writeCalls += 1; },
    markDatasetFailed() { writeCalls += 1; },
    discardStagedDataset() { writeCalls += 1; },
    put() { writeCalls += 1; },
    putMany() { writeCalls += 1; },
    remove() { writeCalls += 1; },
    clearStore() { writeCalls += 1; },
  };
  await Admin.render({
    repository,
    shadow: { getLastResult: () => ({ status: "NOT_RUN" }) },
    diagnostics: Diagnostics,
  });
  assert.strictEqual(readCalls, 5);
  assert.strictEqual(writeCalls, 0);
  for (const [datasetId, rowCount, fileName] of Object.values(activeByType)) {
    assert.match(elements.masterStatusRows.innerHTML, new RegExp(datasetId));
    assert.match(elements.masterStatusRows.innerHTML, new RegExp(`>${rowCount}<`));
    assert.match(elements.masterStatusRows.innerHTML, new RegExp(fileName));
  }
  assert.match(elements.masterStatusRows.innerHTML, /2026-08-27 10:20:30 UTC/);

  const ready = Diagnostics.buildReadiness(shadowResult([readyRow()]));
  Admin.renderViewModel(Admin.buildViewModel(ready));
  assert.match(elements.masterReadinessSummary.innerHTML, /READY/);
  assert.strictEqual((elements.masterCoverageRows.innerHTML.match(/100\.0%/g) || []).length, 6);
  assert.strictEqual((elements.masterCoverageRows.innerHTML.match(/1 \/ 1/g) || []).length, 6);

  const partial = Diagnostics.buildReadiness(
    shadowResult([
      readyRow({
        status: "READY_WITH_WARNINGS",
        resolution: { branch: { status: "MATCHED_FALLBACK" } },
      }),
    ]),
  );
  Admin.renderViewModel(Admin.buildViewModel(partial));
  assert.match(elements.masterReadinessSummary.innerHTML, /PARTIAL/);
  assert.match(elements.masterWarnings.innerHTML, /BRANCH_FALLBACK_PRESENT/);
  assert.match(elements.masterWarnings.innerHTML, /resolved using name fallback/);

  const notReady = Diagnostics.buildReadiness(
    shadowResult([readyRow()], { reconciliation: { unexplainedDifferences: 1 } }),
  );
  Admin.renderViewModel(Admin.buildViewModel(notReady));
  assert.match(elements.masterReadinessSummary.innerHTML, /NOT READY/);
  assert.match(elements.masterBlockers.innerHTML, /UNEXPLAINED_RECONCILIATION_DIFFERENCE/);
  assert.match(elements.masterBlockers.innerHTML, /unexplained difference/);

  const exactCoverageModel = Admin.buildViewModel({
    overallStatus: "PARTIAL",
    masters: {},
    records: {},
    readiness: {
      dateReadyPct: { numerator: 1, denominator: 3, percentage: 12.34 },
      branchExactPct: { numerator: 2, denominator: 3, percentage: 23.45 },
      branchResolvedPct: { numerator: 3, denominator: 3, percentage: 34.56 },
      geographyResolvedPct: { numerator: 4, denominator: 5, percentage: 45.67 },
      assignmentResolvedPct: { numerator: 5, denominator: 6, percentage: 56.78 },
      hierarchyResolvedPct: { numerator: 6, denominator: 7, percentage: 67.89 },
    },
    blockers: [],
    warnings: [],
  });
  Admin.renderViewModel(exactCoverageModel);
  for (const displayed of ["12.3%", "23.4%", "34.6%", "45.7%", "56.8%", "67.9%"] ) {
    assert.ok(elements.masterCoverageRows.innerHTML.includes(displayed));
  }
  assert.match(elements.masterCoverageRows.innerHTML, /6 \/ 7/);

  assert.doesNotMatch(sourceHtml, /masterDataPage[\s\S]{0,3000}(upload|replace|delete|activate)/i);
  assert.doesNotMatch(sourceHtml, /id="master[^"\s]*(Upload|Replace|Delete|Activate)/i);

  const pagePairs = [
    ["misTab", "misPage"], ["actTab", "activationPage"], ["scoreTab", "scorecardPage"],
    ["targetTab", "targetPage"], ["productivityTab", "productivityPage"], ["qualityTab", "qualityPage"],
    ["masterDataTab", "masterDataPage"],
  ];
  pagePairs.flat().forEach((id) => document.getElementById(id));
  let activePage = null;
  let adminRenders = 0;
  global.BancaTrackerCore = { state: { activePage: "misPage" }, setActivePage(pageId) { activePage = pageId; } };
  global.BancaTrackerMasterDataAdmin = { render() { adminRenders += 1; return Promise.resolve(); } };
  load("app.js");
  BancaTrackerApp.showPage("masterDataPage");
  assert.strictEqual(activePage, "masterDataPage");
  assert.strictEqual(elements.masterDataPage.style.display, "block");
  assert.strictEqual(elements.misPage.style.display, "none");
  assert.ok(elements.masterDataTab.classes.has("active-tab"));
  assert.strictEqual(adminRenders, 1);
  BancaTrackerApp.showPage("misPage");
  assert.strictEqual(elements.misPage.style.display, "block");

  console.log(
    "Step 3A Master Data UI tests passed: navigation, read-only metadata, NOT RUN/ABSENT/ACTIVE, readiness states, exact coverage, diagnostics, and responsive structure.",
  );
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
