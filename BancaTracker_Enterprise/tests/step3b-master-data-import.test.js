/* Step 3B: safe structural-master CSV import and activation lifecycle. */
"use strict";

const assert = require("assert");
const path = require("path");

global.window = global;
const load = (file) => require(path.join(__dirname, "..", file));
[
  "js/csvProcessor.js",
  "js/data/schema.js",
  "js/data/datasetRegistry.js",
  "js/masters/geographyMaster.js",
  "js/masters/branchMaster.js",
  "js/masters/employeeMaster.js",
  "js/masters/hierarchyMaster.js",
  "js/masters/branchAssignmentMaster.js",
  "js/masterDataImport.js",
].forEach(load);

const Importer = BancaTrackerMasterDataImport;

class MemoryRepository {
  constructor() {
    this.datasets = new Map();
    this.active = new Map();
    this.records = new Map();
    this.versions = new Map();
    this.stageCalls = 0;
    this.saveCalls = 0;
    this.activateCalls = 0;
    this.failSave = false;
    this.failActivate = false;
  }
  async getActiveMasterRecords(type) {
    const id = this.active.get(type);
    return id ? this.records.get(id) || [] : [];
  }
  async getActiveDataset(type) {
    return this.datasets.get(this.active.get(type)) || null;
  }
  async stageDataset(metadata) {
    this.stageCalls += 1;
    const version = (this.versions.get(metadata.datasetType) || 0) + 1;
    this.versions.set(metadata.datasetType, version);
    const dataset = { ...metadata, datasetVersion: version, datasetId: `${metadata.datasetType}:${version}`, status: "STAGED", uploadedAt: "2026-08-27T10:00:00.000Z" };
    this.datasets.set(dataset.datasetId, dataset);
    return dataset;
  }
  async saveStagedMasterRecords(datasetId, records) {
    this.saveCalls += 1;
    if (this.failSave) throw new Error("Forced record write failure");
    assert.ok(records.every((record) => record.datasetId === datasetId));
    assert.ok(records.every((record) => !record.recordId.includes("PREVIEW:")));
    this.records.set(datasetId, records);
  }
  async activateDataset(datasetId) {
    this.activateCalls += 1;
    if (this.failActivate) throw new Error("Forced activation failure");
    const dataset = this.datasets.get(datasetId);
    const previousId = this.active.get(dataset.datasetType);
    if (previousId) this.datasets.get(previousId).status = "SUPERSEDED";
    dataset.status = "ACTIVE";
    this.active.set(dataset.datasetType, datasetId);
    return { success: true, datasetId, previousDatasetId: previousId || null };
  }
  async markDatasetFailed(datasetId, failure) {
    const dataset = this.datasets.get(datasetId);
    dataset.status = "FAILED";
    dataset.failure = failure;
  }
}

const csv = {
  geography: `STATE ID,STATE CODE,STATE NAME,ZONE ID,ZONE NAME,ACTIVE\nIN-AS,AS,Assam,EAST,East,TRUE`,
  geography2: `STATE ID,STATE CODE,STATE NAME,ZONE ID,ZONE NAME,ACTIVE\nIN-WB,WB,West Bengal,EAST,East,TRUE`,
  geographyDuplicate: `STATE ID,STATE CODE,STATE NAME,ZONE ID,ZONE NAME,ACTIVE\nIN-AS,AS,Assam,EAST,East,TRUE\nIN-AS,AX,Assam Two,WEST,West,TRUE`,
  branch: `BANK ID,BRANCH CODE,BRANCH NAME,STATE ID,ACTIVE\nIB,00123,Guwahati Main,IN-AS,TRUE`,
  badBranch: `BANK ID,BRANCH CODE,BRANCH NAME,STATE ID,ACTIVE\nIB,00124,Unknown,IN-XX,TRUE`,
  employees: `EMPLOYEE ID,EMPLOYEE NAME,ROLE,ACTIVE\nNH001,National Head,NATIONAL_HEAD,TRUE\nZSM001,ZSM One,ZSM,TRUE\nASM001,ASM One,ASM,TRUE\nCSM001,CSM One,CSM,TRUE\nRM001,RM One,RM,TRUE`,
  hierarchy: `EMPLOYEE ID,MANAGER ID\nNH001,\nZSM001,NH001\nASM001,ZSM001\nCSM001,ASM001\nRM001,CSM001`,
  cycle: `EMPLOYEE ID,MANAGER ID\nRM001,CSM001\nCSM001,RM001`,
  assignment: `BANK ID,BRANCH CODE,RM ID,ACTIVE\nIB,00123,RM001,TRUE`,
  badAssignment: `BANK ID,BRANCH CODE,RM ID,ACTIVE\nIB,00123,ASM001,TRUE`,
};

async function preview(repository, type, text, fileName = "master.csv") {
  return Importer.prepareImport(type, Importer.parseText(text), { repository, fileName });
}

(async function () {
  const repository = new MemoryRepository();

  const quoted = Importer.parseText(`BANK ID,BRANCH CODE,BRANCH NAME,STATE ID,ACTIVE\nIB,00123,"Guwahati, Main",IN-AS,TRUE`);
  assert.strictEqual(quoted.rows[0]["BRANCH CODE"], "00123");
  assert.strictEqual(quoted.rows[0]["BRANCH NAME"], "Guwahati, Main");

  const geoV1 = await preview(repository, "GEOGRAPHY_MASTER", csv.geography, "geo-v1.csv");
  assert.strictEqual(geoV1.valid, true);
  assert.strictEqual(geoV1.errorCount, 0);
  assert.strictEqual(repository.stageCalls, 0, "preview performs no writes");
  assert.strictEqual(Importer.canCommit(geoV1), true);
  const geoCommit1 = await Importer.commitImport(geoV1, { repository });
  assert.deepStrictEqual([repository.stageCalls, repository.saveCalls, repository.activateCalls], [1, 1, 1]);
  assert.strictEqual((await repository.getActiveDataset("GEOGRAPHY_MASTER")).datasetId, "GEOGRAPHY_MASTER:1");
  assert.strictEqual(repository.records.get("GEOGRAPHY_MASTER:1")[0].stateId, "IN-AS");

  const invalidGeo = await preview(repository, "GEOGRAPHY_MASTER", csv.geographyDuplicate);
  assert.strictEqual(invalidGeo.valid, false);
  assert.ok(invalidGeo.errorCount > 0);
  await assert.rejects(() => Importer.commitImport(invalidGeo, { repository }), /valid preview/);
  assert.strictEqual(repository.stageCalls, 1);
  assert.strictEqual(repository.active.get("GEOGRAPHY_MASTER"), "GEOGRAPHY_MASTER:1");

  const branch = await preview(repository, "BRANCH_MASTER", csv.branch, "branch.csv");
  assert.strictEqual(branch.valid, true);
  assert.strictEqual(branch.dependencyStatus.GEOGRAPHY_MASTER, "ACTIVE");
  const branchCommit = await Importer.commitImport(branch, { repository });
  assert.strictEqual(branchCommit.records[0].branchCode, "00123");
  assert.strictEqual(repository.records.get("BRANCH_MASTER:1")[0].branchCode, "00123");

  const badBranch = await preview(repository, "BRANCH_MASTER", csv.badBranch);
  assert.strictEqual(badBranch.valid, false);
  assert.ok(badBranch.findings.some((finding) => finding.code === "BRANCH_STATE_UNMAPPED"));
  assert.strictEqual(repository.active.get("BRANCH_MASTER"), "BRANCH_MASTER:1");

  const employees = await preview(repository, "EMPLOYEE_MASTER", csv.employees, "employees.csv");
  assert.strictEqual(employees.valid, true);
  await Importer.commitImport(employees, { repository });
  assert.strictEqual(repository.active.get("EMPLOYEE_MASTER"), "EMPLOYEE_MASTER:1");

  const hierarchy = await preview(repository, "HIERARCHY", csv.hierarchy, "hierarchy.csv");
  assert.strictEqual(hierarchy.valid, true);
  assert.strictEqual(hierarchy.dependencyStatus.EMPLOYEE_MASTER, "ACTIVE");
  await Importer.commitImport(hierarchy, { repository });
  const cycle = await preview(repository, "HIERARCHY", csv.cycle);
  assert.strictEqual(cycle.valid, false);
  assert.ok(cycle.findings.some((finding) => finding.code === "HIERARCHY_CYCLE_DETECTED"));

  const assignment = await preview(repository, "BRANCH_ASSIGNMENT", csv.assignment, "assignment.csv");
  assert.strictEqual(assignment.valid, true);
  await Importer.commitImport(assignment, { repository });
  assert.strictEqual(repository.active.get("BRANCH_ASSIGNMENT"), "BRANCH_ASSIGNMENT:1");
  const badAssignment = await preview(repository, "BRANCH_ASSIGNMENT", csv.badAssignment);
  assert.strictEqual(badAssignment.valid, false);
  assert.ok(badAssignment.findings.some((finding) => finding.code === "ASSIGNMENT_EMPLOYEE_NOT_RM"));

  const geoV2 = await preview(repository, "GEOGRAPHY_MASTER", csv.geography2, "geo-v2.csv");
  await Importer.commitImport(geoV2, { repository });
  assert.strictEqual(repository.active.get("GEOGRAPHY_MASTER"), "GEOGRAPHY_MASTER:2");
  assert.strictEqual(repository.datasets.get("GEOGRAPHY_MASTER:1").status, "SUPERSEDED");
  assert.ok(repository.records.has("GEOGRAPHY_MASTER:1"));
  assert.ok(repository.records.has("GEOGRAPHY_MASTER:2"));

  const stageBeforeInvalidReplacement = repository.stageCalls;
  await preview(repository, "BRANCH_MASTER", csv.badBranch);
  assert.strictEqual(repository.active.get("BRANCH_MASTER"), "BRANCH_MASTER:1");
  assert.strictEqual(repository.stageCalls, stageBeforeInvalidReplacement);

  const writeFailureRepository = new MemoryRepository();
  await Importer.commitImport(await preview(writeFailureRepository, "GEOGRAPHY_MASTER", csv.geography), { repository: writeFailureRepository });
  const oldWriteActive = writeFailureRepository.active.get("GEOGRAPHY_MASTER");
  const writeFailurePreview = await preview(writeFailureRepository, "GEOGRAPHY_MASTER", csv.geography2);
  writeFailureRepository.failSave = true;
  await assert.rejects(() => Importer.commitImport(writeFailurePreview, { repository: writeFailureRepository }), /write failure/);
  assert.strictEqual(writeFailureRepository.active.get("GEOGRAPHY_MASTER"), oldWriteActive);
  assert.strictEqual(writeFailureRepository.datasets.get("GEOGRAPHY_MASTER:2").status, "FAILED");

  const activationFailureRepository = new MemoryRepository();
  await Importer.commitImport(await preview(activationFailureRepository, "GEOGRAPHY_MASTER", csv.geography), { repository: activationFailureRepository });
  const oldActivationActive = activationFailureRepository.active.get("GEOGRAPHY_MASTER");
  const activationFailurePreview = await preview(activationFailureRepository, "GEOGRAPHY_MASTER", csv.geography2);
  activationFailureRepository.failActivate = true;
  await assert.rejects(() => Importer.commitImport(activationFailurePreview, { repository: activationFailureRepository }), /activation failure/);
  assert.strictEqual(activationFailureRepository.active.get("GEOGRAPHY_MASTER"), oldActivationActive);
  assert.strictEqual(activationFailureRepository.datasets.get("GEOGRAPHY_MASTER:2").status, "FAILED");

  const missingColumn = await preview(repository, "GEOGRAPHY_MASTER", `STATE ID,STATE NAME\nIN-AS,Assam`);
  assert.strictEqual(missingColumn.valid, false);
  assert.ok(missingColumn.findings.some((finding) => finding.code === "MASTER_REQUIRED_COLUMN_MISSING"));

  Importer.cancelImport();
  assert.strictEqual(Importer.getCurrentPreview(), null);
  assert.strictEqual(geoCommit1.success, true);
  console.log("Step 3B master import tests passed: CSV safety, five master validators, dependencies, confirmation gate, real IDs, version replacement, and write/activation failure protection.");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
