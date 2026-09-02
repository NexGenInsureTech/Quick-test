/* Sprint 1F: fixture-driven Employee Master browser acceptance coverage. */
"use strict";
const assert = require("assert"); const fs = require("fs"); const path = require("path");
global.window = global;
const load = (file) => require(path.join(__dirname, "..", file));
["js/csvProcessor.js", "js/data/schema.js", "js/data/datasetRegistry.js", "js/masters/employeeMaster.js", "js/masterDataImport.js", "js/analytics/employeeVintage.js"].forEach(load);
const Importer = BancaTrackerMasterDataImport; const Master = BancaTrackerEmployeeMaster; const Vintage = BancaTrackerEmployeeVintage;
const fixture = (name) => fs.readFileSync(path.join(__dirname, "fixtures", "employee-master-v2", name), "utf8");
class MemoryRepository {
  constructor() { this.datasets = new Map(); this.records = new Map(); this.active = new Map(); this.versions = new Map(); }
  async getActiveMasterRecords(type) { return this.records.get(this.active.get(type)) || []; }
  async stageDataset(metadata) { const datasetVersion = (this.versions.get(metadata.datasetType) || 0) + 1; this.versions.set(metadata.datasetType, datasetVersion); const dataset = { ...metadata, datasetId: `${metadata.datasetType}:${datasetVersion}`, datasetVersion, status: "STAGED" }; this.datasets.set(dataset.datasetId, dataset); return dataset; }
  async saveStagedMasterRecords(datasetId, records) { this.records.set(datasetId, records); }
  async activateDataset(datasetId) { const dataset = this.datasets.get(datasetId); const previousDatasetId = this.active.get(dataset.datasetType) || null; if (previousDatasetId) this.datasets.get(previousDatasetId).status = "SUPERSEDED"; dataset.status = "ACTIVE"; this.active.set(dataset.datasetType, datasetId); return { datasetId, previousDatasetId }; }
  async markDatasetFailed(datasetId) { this.datasets.get(datasetId).status = "FAILED"; }
}
const prepare = (repository, fileName) => Importer.prepareImport("EMPLOYEE_MASTER", Importer.parseText(fixture(fileName)), { repository, fileName });
(async function () {
  assert.strictEqual(BancaTrackerSchema.DATABASE.VERSION, 2, "Employee acceptance requires no IndexedDB migration.");
  const repository = new MemoryRepository();
  const nativePreview = await prepare(repository, "valid-native-v2.csv");
  assert.strictEqual(nativePreview.valid, true); assert.strictEqual(nativePreview.rowCount, 10); assert.strictEqual(nativePreview.errorCount, 0); assert.strictEqual(nativePreview.warningCount, 0);
  ["USM", "MT", "Executive", "Coordinator"].forEach((designation) => { const record = nativePreview.records.find((row) => row.designation === designation); assert.ok(record); assert.strictEqual(record.role, null, `${designation} must not infer a legacy hierarchy role.`); });
  const nativeCommit = await Importer.commitImport(nativePreview, { repository });
  assert.strictEqual(nativeCommit.dataset.status, "ACTIVE"); assert.strictEqual(nativeCommit.dataset.metadata.dataContract.version, 2); assert.strictEqual(nativeCommit.dataset.metadata.dataContract.sourceProfile, "NATIVE_V2");
  assert.strictEqual("companyVintage" in repository.records.get(nativeCommit.dataset.datasetId)[0], false, "Vintage remains runtime-derived only.");
  const vintage = Vintage.evaluateEmployee(nativeCommit.records.find((row) => row.employeeId === "E010"), "2025-08-31");
  assert.strictEqual(vintage.companyVintage.effectiveEndDate, "2024-12-31");
  const invalidPreview = await prepare(repository, "invalid-native-v2.csv");
  assert.strictEqual(invalidPreview.valid, false); assert.strictEqual(invalidPreview.errorCount, 5);
  await assert.rejects(() => Importer.commitImport(invalidPreview, { repository }), /valid preview/);
  assert.strictEqual(repository.active.get("EMPLOYEE_MASTER"), nativeCommit.dataset.datasetId, "Invalid replacement must not displace the active native dataset.");
  const legacyDataset = { datasetId: "EMPLOYEE_MASTER:LEGACY", metadata: null };
  const legacyPrepared = Master.prepareDataset(Importer.parseText(fixture("legacy-v8.2.csv")).rows, legacyDataset.datasetId);
  const legacyContext = Master.adaptPersistedDataset(legacyDataset, legacyPrepared.records);
  assert.strictEqual(legacyContext.contract.sourceProfile, "LEGACY_V1_ASSUMED"); assert.strictEqual(legacyContext.status, "LEGACY_COMPATIBILITY");
  const replacementPreview = await prepare(repository, "valid-native-v2.csv");
  const replacement = await Importer.commitImport(replacementPreview, { repository });
  assert.strictEqual(replacement.dataset.status, "ACTIVE"); assert.strictEqual(nativeCommit.dataset.status, "SUPERSEDED");
  console.log("Sprint 1F fixture acceptance tests passed: native import, lifecycle safety, legacy dual-read, runtime vintage, and designation independence.");
})().catch((error) => { console.error(error); process.exit(1); });
