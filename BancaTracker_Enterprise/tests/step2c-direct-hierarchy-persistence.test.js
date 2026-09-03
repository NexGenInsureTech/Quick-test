/* Sprint 2C: Direct Reporting Hierarchy persistence and import compatibility. */
"use strict";
const assert = require("assert"); const path = require("path"); global.window = global;
const load = (file) => require(path.join(__dirname, "..", file));
["js/csvProcessor.js", "js/data/schema.js", "js/data/datasetRegistry.js", "js/masters/employeeMaster.js", "js/masters/directReportingHierarchy.js", "js/masters/hierarchyMaster.js"].forEach(load);
const legacyDataset = { datasetId: "HIERARCHY:1", datasetType: "HIERARCHY", datasetVersion: 1, status: "ACTIVE", metadata: null };
const legacyRows = [{ recordId: "HIERARCHY:1:E1:M1", datasetId: "HIERARCHY:1", employeeId: "E1", managerId: "M1", validFrom: null, validTo: null, sourceRowNumber: 2 }];
const dbState = { activeId: legacyDataset.datasetId, datasets: new Map([[legacyDataset.datasetId, legacyDataset]]), records: legacyRows };
global.BancaTrackerIndexedDb = {
  async get(store, key) {
    if (store === BancaTrackerSchema.STORES.APP_METADATA) return key === "activeDataset:HIERARCHY" ? { key, value: dbState.activeId } : null;
    if (store === BancaTrackerSchema.STORES.DATASETS) return dbState.datasets.get(key) || null;
    return null;
  },
  async getAllByIndex(store, index, value) { return store === BancaTrackerSchema.STORES.HIERARCHY_RELATIONSHIPS && index === "datasetId" && value === dbState.activeId ? dbState.records : []; },
};
load("js/data/repository.js"); load("js/masterDataImport.js");
const Importer = BancaTrackerMasterDataImport; const Authority = BancaTrackerDirectReportingHierarchy; const Contract = BancaTrackerDatasetRegistry.HIERARCHY_DATA_CONTRACT;
assert.strictEqual(BancaTrackerSchema.DATABASE.VERSION, 2, "Hierarchy v2 must not change IndexedDB version.");

const employees = [
  { employeeId: "E1", employeeName: "Employee One", designation: "Coordinator", employmentStatus: "ACTIVE", dateOfJoining: "2020-01-01", exitDate: null, active: true },
  { employeeId: "M1", employeeName: "Manager One", designation: "Executive", employmentStatus: "ACTIVE", dateOfJoining: "2018-01-01", exitDate: null, active: true },
];
const legacyEmployees = [{ employeeId: "E1", role: "ZSM", active: true }, { employeeId: "M1", role: "NATIONAL_HEAD", active: true }];
class MemoryRepository {
  constructor() { this.datasets = new Map([[legacyDataset.datasetId, { ...legacyDataset }]]); this.records = new Map([[legacyDataset.datasetId, legacyRows]]); this.active = new Map([["HIERARCHY", legacyDataset.datasetId]]); this.versions = new Map([["HIERARCHY", 1]]); this.stageCalls = 0; this.canonicalEmployeeReads = 0; this.rawEmployeeReads = 0; }
  async getActiveEmployeeMasterContext() { this.canonicalEmployeeReads += 1; return { status: "READY", records: employees, diagnostics: [] }; }
  async getActiveMasterRecords(type) { if (type === "EMPLOYEE_MASTER") { this.rawEmployeeReads += 1; return legacyEmployees; } return this.records.get(this.active.get(type)) || []; }
  async stageDataset(metadata) { this.stageCalls += 1; const datasetVersion = (this.versions.get(metadata.datasetType) || 0) + 1; this.versions.set(metadata.datasetType, datasetVersion); const dataset = { ...metadata, datasetVersion, datasetId: `${metadata.datasetType}:${datasetVersion}`, status: "STAGED" }; this.datasets.set(dataset.datasetId, dataset); return dataset; }
  async saveStagedMasterRecords(datasetId, records) { this.records.set(datasetId, records); }
  async activateDataset(datasetId) { const dataset = this.datasets.get(datasetId); const previousDatasetId = this.active.get(dataset.datasetType) || null; if (previousDatasetId) this.datasets.get(previousDatasetId).status = "SUPERSEDED"; dataset.status = "ACTIVE"; this.active.set(dataset.datasetType, datasetId); return { success: true, datasetId, previousDatasetId }; }
  async markDatasetFailed(datasetId) { this.datasets.get(datasetId).status = "FAILED"; }
}
const csv = {
  native: `EMPLOYEE ID,MANAGER EMPLOYEE ID,VALID FROM,VALID TO\nE1,M1,2025-01-01,\nM1,,2025-01-01,`,
  invalid: `EMPLOYEE ID,MANAGER EMPLOYEE ID,VALID FROM,VALID TO\nE1,E1,2025-01-01,`,
  legacy: `EMPLOYEE ID,MANAGER ID\nM1,\nE1,M1`,
  mixed: `EMPLOYEE ID,MANAGER ID,MANAGER EMPLOYEE ID,VALID FROM\nE1,M1,M1,2025-01-01`,
};
const preview = (repository, text) => Importer.prepareImport("HIERARCHY", Importer.parseText(text), { repository, fileName: "hierarchy.csv" });

(async function () {
  const originalLegacy = JSON.parse(JSON.stringify(legacyRows));
  const legacyContext = await BancaTrackerRepository.getActiveHierarchyContext();
  assert.strictEqual(legacyContext.status, "LEGACY_COMPATIBILITY"); assert.strictEqual(legacyContext.contract.sourceProfile, Contract.PROFILES.LEGACY_V1_ASSUMED);
  assert.deepStrictEqual(legacyContext.records, legacyRows); assert.deepStrictEqual(legacyRows, originalLegacy, "Legacy reads must not rewrite stored records.");

  const repository = new MemoryRepository();
  const nativePreview = await preview(repository, csv.native);
  assert.strictEqual(nativePreview.valid, true); assert.strictEqual(nativePreview.hierarchyProfile.sourceProfile, Contract.PROFILES.DIRECT_REPORTING_V2);
  assert.strictEqual(nativePreview.contractMetadata.dataContract.version, 2); assert.strictEqual(repository.canonicalEmployeeReads, 1); assert.strictEqual(repository.rawEmployeeReads, 0, "Native validation must use canonical Employee context.");
  const commit = await Importer.commitImport(nativePreview, { repository });
  assert.strictEqual(commit.dataset.datasetVersion, 2, "datasetVersion remains lifecycle sequencing, not contract version.");
  assert.strictEqual(commit.dataset.metadata.dataContract.name, Contract.NAME); assert.strictEqual(commit.dataset.metadata.dataContract.sourceProfile, Contract.PROFILES.DIRECT_REPORTING_V2); assert.ok(commit.dataset.metadata.dataContract.declaredAt);
  assert.strictEqual(commit.dataset.status, "ACTIVE"); assert.strictEqual(repository.datasets.get("HIERARCHY:1").status, "SUPERSEDED");
  assert.deepStrictEqual(Object.keys(commit.records[0]).sort(), ["datasetId", "employeeId", "managerEmployeeId", "recordId", "sourceRowNumber", "validFrom", "validTo"].sort());
  ["dateValidity", "reportingChain", "reportingDepth", "rootEmployeeId", "asOfDate"].forEach((field) => assert.strictEqual(field in commit.records[0], false, `${field} must not be persisted.`));

  const stagesBeforeInvalid = repository.stageCalls;
  const invalid = await preview(repository, csv.invalid); assert.strictEqual(invalid.valid, false); assert.ok(invalid.findings.some((finding) => finding.code === "HIERARCHY_V2_SELF_REFERENCE"));
  await assert.rejects(() => Importer.commitImport(invalid, { repository }), /valid preview/); assert.strictEqual(repository.stageCalls, stagesBeforeInvalid); assert.strictEqual(repository.active.get("HIERARCHY"), commit.dataset.datasetId);

  const mixed = await preview(repository, csv.mixed); assert.strictEqual(mixed.valid, false); assert.ok(mixed.findings.some((finding) => finding.code === "HIERARCHY_MIXED_CONTRACT_PROHIBITED"));
  const legacyPreview = await preview(repository, csv.legacy); assert.strictEqual(legacyPreview.valid, true); assert.strictEqual(legacyPreview.contractMetadata.dataContract.sourceProfile, Contract.PROFILES.LEGACY_V1);

  const absentEmployees = new MemoryRepository(); absentEmployees.getActiveEmployeeMasterContext = async () => ({ status: "ABSENT", records: [], diagnostics: [] });
  const unavailable = await preview(absentEmployees, csv.native); assert.strictEqual(unavailable.valid, false); assert.ok(unavailable.findings.some((finding) => finding.code === "HIERARCHY_V2_EMPLOYEE_MASTER_UNAVAILABLE"));

  const unsupported = Authority.adaptPersistedDataset({ datasetId: "HIERARCHY:9", metadata: { dataContract: { name: Contract.NAME, version: 9, sourceProfile: "DIRECT_REPORTING_V9" } } }, legacyRows);
  assert.strictEqual(unsupported.status, "UNSUPPORTED_CONTRACT"); assert.deepStrictEqual(unsupported.records, []);
  dbState.activeId = "HIERARCHY:9"; dbState.datasets.set(dbState.activeId, { datasetId: dbState.activeId, metadata: { dataContract: { name: Contract.NAME, version: 9, sourceProfile: "DIRECT_REPORTING_V9" } } });
  const unsupportedContext = await BancaTrackerRepository.getActiveHierarchyContext(); assert.strictEqual(unsupportedContext.status, "UNSUPPORTED_CONTRACT"); assert.deepStrictEqual(unsupportedContext.records, []);
  console.log("Sprint 2C hierarchy persistence tests passed: routed imports, metadata, canonical persistence, legacy reads, dependency safety, and lifecycle isolation.");
})().catch((error) => { console.error(error); process.exit(1); });
