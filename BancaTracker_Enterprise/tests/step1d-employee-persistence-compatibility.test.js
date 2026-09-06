/* Sprint 1D: Employee Master v1/v2 persistence compatibility. */
"use strict";
const assert = require("assert");
const path = require("path");
global.window = global;
const load = (file) => require(path.join(__dirname, "..", file));
[
  "js/csvProcessor.js", "js/data/schema.js", "js/data/datasetRegistry.js",
  "js/masters/employeeMaster.js", "js/masterDataImport.js",
].forEach(load);
const Importer = BancaTrackerMasterDataImport;
const Master = BancaTrackerEmployeeMaster;
const Contract = BancaTrackerDatasetRegistry.EMPLOYEE_DATA_CONTRACT;
assert.strictEqual(BancaTrackerSchema.DATABASE.VERSION, 2, "Employee v2 compatibility must not change IndexedDB version.");

class MemoryRepository {
  constructor() { this.datasets = new Map(); this.records = new Map(); this.active = new Map(); this.versions = new Map(); this.stageCalls = 0; }
  async getActiveMasterRecords(type) { return this.records.get(this.active.get(type)) || []; }
  async stageDataset(metadata) { this.stageCalls += 1; const datasetVersion = (this.versions.get(metadata.datasetType) || 0) + 1; this.versions.set(metadata.datasetType, datasetVersion); const dataset = { ...metadata, datasetVersion, datasetId: `${metadata.datasetType}:${datasetVersion}`, status: "STAGED" }; this.datasets.set(dataset.datasetId, dataset); return dataset; }
  async saveStagedMasterRecords(datasetId, records) { this.records.set(datasetId, records); }
  async activateDataset(datasetId) { const dataset = this.datasets.get(datasetId); const previousDatasetId = this.active.get(dataset.datasetType) || null; if (previousDatasetId) this.datasets.get(previousDatasetId).status = "SUPERSEDED"; dataset.status = "ACTIVE"; this.active.set(dataset.datasetType, datasetId); return { success: true, datasetId, previousDatasetId }; }
  async markDatasetFailed(datasetId) { this.datasets.get(datasetId).status = "FAILED"; }
}

const legacyRows = [{ recordId: "EMPLOYEE_MASTER:1:RM1", datasetId: "EMPLOYEE_MASTER:1", employeeId: "RM1", employeeName: "RM One", role: "RM", active: true, sourceRowNumber: 2 }];
const legacyDataset = { datasetId: "EMPLOYEE_MASTER:1", datasetType: "EMPLOYEE_MASTER", datasetVersion: 1, status: "ACTIVE", metadata: null };
const repositoryState = { datasets: new Map([[legacyDataset.datasetId, legacyDataset]]), records: legacyRows };
global.BancaTrackerIndexedDb = {
  async get(store, key) {
    if (store === BancaTrackerSchema.STORES.APP_METADATA) return key === "activeDataset:EMPLOYEE_MASTER" ? { key, value: "EMPLOYEE_MASTER:1" } : null;
    if (store === BancaTrackerSchema.STORES.DATASETS) return repositoryState.datasets.get(key) || null;
    return null;
  },
  async getAllByIndex(store, index, value) {
    return store === BancaTrackerSchema.STORES.EMPLOYEE_MASTER && index === "datasetId" && value === "EMPLOYEE_MASTER:1" ? repositoryState.records : [];
  },
};
load("js/data/repository.js");
const beforeLegacyRead = JSON.parse(JSON.stringify(legacyRows));
const legacyContext = Master.adaptPersistedDataset(legacyDataset, legacyRows);
assert.strictEqual(legacyContext.status, "LEGACY_COMPATIBILITY");
assert.strictEqual(legacyContext.contract.sourceProfile, Contract.PROFILES.LEGACY_V1_ASSUMED);
assert.deepStrictEqual(legacyContext.diagnostics, ["EMPLOYEE_DATASET_CONTRACT_UNDECLARED"]);
assert.strictEqual(legacyContext.records[0].designation, "RM");
assert.strictEqual(legacyContext.records[0].employmentStatus, "ACTIVE");
assert.deepStrictEqual(legacyRows, beforeLegacyRead, "Legacy records must not be rewritten during adaptation.");

const nativeDataset = { datasetId: "EMPLOYEE_MASTER:2", metadata: { dataContract: { name: "EMPLOYEE_MASTER", version: 2, sourceProfile: "NATIVE_V2", normalizerVersion: 2 } } };
const nativeContext = Master.adaptPersistedDataset(nativeDataset, [{ recordId: "EMPLOYEE_MASTER:2:USM1", datasetId: "EMPLOYEE_MASTER:2", employeeId: "USM1", employeeName: "USM One", designation: "USM", employmentStatus: "ACTIVE", active: true }]);
assert.strictEqual(nativeContext.status, "READY");
assert.strictEqual(nativeContext.records[0].role, null, "Native designation must not create a legacy hierarchy role.");

const unsupported = Master.adaptPersistedDataset({ datasetId: "EMPLOYEE_MASTER:9", metadata: { dataContract: { name: "EMPLOYEE_MASTER", version: 9, sourceProfile: "NATIVE_V9" } } }, legacyRows);
assert.strictEqual(unsupported.status, "UNSUPPORTED_CONTRACT");
assert.deepStrictEqual(unsupported.records, []);
assert.ok(unsupported.diagnostics.includes("EMPLOYEE_DATASET_CONTRACT_UNSUPPORTED"));

const csv = {
  legacy: `EMPLOYEE ID,EMPLOYEE NAME,ROLE,ACTIVE\nRM1,RM One,RM,TRUE`,
  native: `EMPLOYEE ID,EMPLOYEE NAME,DESIGNATION,EMPLOYMENT STATUS\nUSM1,USM One,USM,ACTIVE`,
  invalidNative: `EMPLOYEE ID,EMPLOYEE NAME,DESIGNATION,EMPLOYMENT STATUS\nUSM2,USM Two,USM,UNKNOWN`,
};
const preview = (repository, text) => Importer.prepareImport("EMPLOYEE_MASTER", Importer.parseText(text), { repository, fileName: "employees.csv" });

(async function () {
  const repositoryContext = await BancaTrackerRepository.getActiveEmployeeMasterContext();
  assert.strictEqual(repositoryContext.status, "LEGACY_COMPATIBILITY");
  assert.strictEqual(repositoryContext.records[0].employeeId, "RM1");
  const repository = new MemoryRepository();
  const legacyPreview = await preview(repository, csv.legacy);
  assert.strictEqual(legacyPreview.contractMetadata.dataContract.version, 1);
  assert.strictEqual(legacyPreview.contractMetadata.dataContract.sourceProfile, Contract.PROFILES.LEGACY_V1);
  const legacyCommit = await Importer.commitImport(legacyPreview, { repository });
  assert.strictEqual(legacyCommit.dataset.datasetVersion, 1, "datasetVersion remains lifecycle sequencing.");
  assert.strictEqual(legacyCommit.dataset.metadata.dataContract.version, 1);

  const nativePreview = await preview(repository, csv.native);
  assert.strictEqual(nativePreview.valid, true);
  assert.strictEqual(nativePreview.contractMetadata.dataContract.version, 2);
  assert.strictEqual(nativePreview.contractMetadata.dataContract.sourceProfile, Contract.PROFILES.NATIVE_V2);
  const nativeCommit = await Importer.commitImport(nativePreview, { repository });
  assert.strictEqual(nativeCommit.dataset.datasetVersion, 2, "datasetVersion must not be used as contract version.");
  assert.strictEqual(nativeCommit.dataset.metadata.dataContract.version, 2);
  assert.ok(nativeCommit.dataset.metadata.dataContract.declaredAt);
  assert.strictEqual("dateValidity" in nativeCommit.records[0], false, "Transient date validation state must not be persisted.");
  assert.strictEqual("activeSupplied" in nativeCommit.records[0], false, "Transient compatibility flags must not be persisted.");
  assert.strictEqual("statusInput" in nativeCommit.records[0], false, "Transient source status must not be persisted.");
  assert.strictEqual("compatibilityMode" in nativeCommit.records[0], false, "Transient compatibility mode must not be persisted.");
  assert.strictEqual(repository.active.get("EMPLOYEE_MASTER"), "EMPLOYEE_MASTER:2");
  assert.strictEqual(repository.datasets.get("EMPLOYEE_MASTER:1").status, "SUPERSEDED");
  assert.deepStrictEqual(repository.records.get("EMPLOYEE_MASTER:1")[0].role, "RM", "Legacy records remain stored after replacement.");

  const stagesBeforeInvalid = repository.stageCalls;
  const invalidPreview = await preview(repository, csv.invalidNative);
  assert.strictEqual(invalidPreview.valid, false);
  await assert.rejects(() => Importer.commitImport(invalidPreview, { repository }), /valid preview/);
  assert.strictEqual(repository.stageCalls, stagesBeforeInvalid);
  assert.strictEqual(repository.active.get("EMPLOYEE_MASTER"), "EMPLOYEE_MASTER:2");
  console.log("Sprint 1D Employee persistence tests passed: metadata, dual-read adaptation, unsupported contracts, replacement safety, and non-destructive legacy handling.");
})().catch((error) => { console.error(error); process.exit(1); });
