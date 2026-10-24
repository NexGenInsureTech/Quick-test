/* Increment B: aggregate-only Branch Identity Health UI integration. */
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

class Element {
  constructor() {
    this.innerHTML = ""; this.textContent = ""; this.hidden = false; this.disabled = false;
    this.value = ""; this.className = ""; this.dataset = {}; this.listeners = {};
  }
  addEventListener(type, listener) { this.listeners[type] = listener; }
  focus() {}
}
const elements = {};
global.window = global;
global.document = { getElementById(id) { return elements[id] || (elements[id] = new Element()); } };
const load = (file) => require(path.join(__dirname, "..", file));

[
  "masterImportType", "masterImportFile", "cancelMasterImport", "masterSchemaHelp", "masterImportStatus",
  "masterImportPreview", "masterImportSummary", "masterImportFindings", "masterFindingLimit",
  "reviewMasterActivation", "masterActivationConfirmation", "masterActivationPrompt", "confirmMasterActivation",
  "closeMasterActivation", "masterStatusRows", "branchIdentityHealthPanel", "branchIdentityHealthProcessing",
  "branchIdentityHealthSummary", "branchIdentityHealthRows", "branchIdentityHealthNote",
].forEach((id) => document.getElementById(id));

global.BancaTrackerMasterDataImport = {
  SCHEMAS: {
    GEOGRAPHY_MASTER: { label: "Geography", required: [], optional: [] },
    BRANCH_MASTER: { label: "Branch", required: [], optional: [] },
    EMPLOYEE_MASTER: { label: "Employee", required: [], optional: [] },
    HIERARCHY: { label: "Hierarchy", required: [], optional: [] },
    BRANCH_BUDGET_POTENTIAL: { label: "Commercial", required: [], optional: [] },
    TARGET_SEASONALITY: { label: "Seasonality", required: [], optional: [] },
    WORKFORCE_DEPLOYMENT_V2: { label: "Deployment", required: [], optional: [] },
    BRANCH_ASSIGNMENT: { label: "Assignment", required: [], optional: [] },
  },
  cancelImport() {}, canCommit() { return false; }, getCurrentPreview() { return null; },
};
global.BancaTrackerRepository = { async getActiveDataset() { return null; } };
load("js/config.js");
load("js/data/schema.js");
load("js/data/datasetRegistry.js");
load("js/masters/branchMaster.js");
load("js/diagnostics/branchIdentityHealth.js");
load("js/masterDataAdmin.js");

const Admin = BancaTrackerMasterDataAdmin;
const pointer = "BRANCH_MASTER:UI";
const branch = { datasetId: pointer, bankId: "IB", branchCode: "001", branchId: "IB:001", active: true };
let reads = 0;
let writes = 0;
const repository = {
  async getActiveDatasetId(type) { reads += 1; assert.strictEqual(type, "BRANCH_MASTER"); return pointer; },
  async getActiveDataset(type) { reads += 1; assert.strictEqual(type, "BRANCH_MASTER"); return { datasetId: pointer, rowCount: 1 }; },
  stageDataset() { writes += 1; }, activateDataset() { writes += 1; }, put() { writes += 1; },
};
const preview = {
  datasetType: "BRANCH_BUDGET_POTENTIAL", importChoice: "BRANCH_BUDGET_POTENTIAL",
  records: [{ bankId: "IB", branchCode: "001", branchId: "IB:001", periodKey: "2026-04" }],
  findings: [], dependencyContext: { branchRecords: [branch] },
};

(async function () {
  const result = await Admin.buildBranchIdentityHealth(preview, repository);
  assert.strictEqual(reads, 2);
  assert.strictEqual(writes, 0);
  Admin.renderBranchIdentityHealth(result);
  assert.strictEqual(elements.branchIdentityHealthPanel.hidden, false);
  assert.match(elements.branchIdentityHealthSummary.innerHTML, /Distinct branch-periods/);
  assert.match(elements.branchIdentityHealthSummary.innerHTML, /Exact rows/);
  assert.strictEqual((elements.branchIdentityHealthRows.innerHTML.match(/<tr>/g) || []).length, 12);
  assert.match(elements.branchIdentityHealthRows.innerHTML, /EXACT ACTIVE/);
  assert.ok(!elements.branchIdentityHealthSummary.innerHTML.includes("IB:001"));
  assert.ok(!elements.branchIdentityHealthRows.innerHTML.includes("IB:001"));
  assert.match(elements.branchIdentityHealthNote.textContent, /No identities or source values/);

  const unavailableCount = BancaTrackerBranchIdentityHealth.build({
    datasetType: "BRANCH_BUDGET_POTENTIAL", activePointer: pointer,
    activeDataset: { datasetId: pointer }, masterRecords: [branch],
    importedRecords: preview.records, findings: [],
  });
  Admin.renderBranchIdentityHealth(unavailableCount);
  assert.match(elements.branchIdentityHealthSummary.innerHTML, /Declared master rows<\/div><div class="value">N\/A/);
  assert.match(elements.branchIdentityHealthSummary.innerHTML, /Declared\/stored difference<\/div><div class="value">N\/A/);

  const explicitZero = BancaTrackerBranchIdentityHealth.build({
    datasetType: "BRANCH_BUDGET_POTENTIAL", activePointer: pointer,
    activeDataset: { datasetId: pointer, rowCount: 0 }, masterRecords: [branch],
    importedRecords: preview.records, findings: [],
  });
  Admin.renderBranchIdentityHealth(explicitZero);
  assert.match(elements.branchIdentityHealthSummary.innerHTML, /Declared master rows<\/div><div class="value">0/);

  const legacy = { ...preview, datasetType: "BRANCH_ASSIGNMENT", importChoice: "BRANCH_ASSIGNMENT" };
  assert.ok(await Admin.buildBranchIdentityHealth(legacy, repository));
  const native = { ...legacy, importChoice: "WORKFORCE_DEPLOYMENT_V2" };
  assert.strictEqual(await Admin.buildBranchIdentityHealth(native, repository), null);

  const injected = new Error("secret bank IB:001 and filename confidential.csv");
  injected.stack = "Error: secret\n at privateThing (C:\\private\\secret-folder\\diagnostic.js:44:9)";
  assert.strictEqual(Admin.sanitizeErrorLocation(injected), "diagnostic.js:44:9");
  await Admin.renderBranchIdentityHealthForPreview(preview, {
    async getActiveDatasetId() { throw injected; }, async getActiveDataset() { return null; },
  });
  assert.match(elements.branchIdentityHealthProcessing.textContent, /FAILED/);
  assert.match(elements.branchIdentityHealthProcessing.textContent, /diagnostic\.js:44:9/);
  assert.ok(!elements.branchIdentityHealthProcessing.textContent.includes("secret"));
  assert.ok(!elements.branchIdentityHealthProcessing.textContent.includes("confidential"));

  Admin.clearBranchIdentityHealth();
  assert.strictEqual(elements.branchIdentityHealthPanel.hidden, true);
  assert.strictEqual(elements.branchIdentityHealthSummary.innerHTML, "");

  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  const adminSource = fs.readFileSync(path.join(__dirname, "..", "js/masterDataAdmin.js"), "utf8");
  assert.match(html, /id="branchIdentityHealthPanel"/);
  assert.match(html, /js\/diagnostics\/branchIdentityHealth\.js/);
  assert.ok(html.indexOf("js/diagnostics/branchIdentityHealth.js") < html.indexOf("js/masterDataAdmin.js"));
  assert.match(adminSource, /clearBranchIdentityHealth\(\);/);
  assert.match(adminSource, /renderBranchIdentityHealthForPreview\(preview\)/);
  assert.ok(!/fetch\s*\(|XMLHttpRequest|sendBeacon|clipboard|localStorage/.test(fs.readFileSync(path.join(__dirname, "..", "js/diagnostics/branchIdentityHealth.js"), "utf8")));

  console.log("Branch Identity Health UI tests passed: aggregate rendering, legacy-only assignment scope, read-only integration, sanitization, reset disposal, and offline script wiring.");
})().catch((error) => { console.error(error); process.exit(1); });
