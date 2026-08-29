/* Step 4G: governed Branch Budget & Potential Master and live authority. */
"use strict";

const assert = require("assert");
const path = require("path");
global.window = global;
const elements = new Map();
function element(id) {
  if (!elements.has(id)) elements.set(id, { innerHTML: "", textContent: "", hidden: false, disabled: false, value: "", dataset: {}, addEventListener() {}, focus() {} });
  return elements.get(id);
}
global.document = { getElementById: element };
const load = (file) => require(path.join(__dirname, "..", file));
[
  "js/config.js", "js/csvProcessor.js", "js/data/schema.js", "js/data/datasetRegistry.js",
  "js/masters/geographyMaster.js", "js/masters/branchMaster.js",
  "js/masters/employeeMaster.js", "js/masters/hierarchyMaster.js",
  "js/masters/branchAssignmentMaster.js", "js/enrichment/dateResolver.js",
  "js/masters/branchBudgetPotentialMaster.js", "js/enrichment/liveBranchCommercialAuthority.js",
  "js/enrichment/readinessDiagnostics.js", "js/masterDataImport.js", "js/masterDataAdmin.js",
  "js/canonicalDataQuality.js",
].forEach(load);

const Master = BancaTrackerBranchBudgetPotentialMaster;
const Authority = BancaTrackerLiveBranchCommercialAuthority;
const branchRecords = [
  BancaTrackerBranchMaster.normalizeRow({ "BANK ID": "IB", "BRANCH CODE": "00123", "BRANCH NAME": "Main", "STATE ID": "IN-AS", ACTIVE: "TRUE" }, "BRANCH:4G", 2),
  BancaTrackerBranchMaster.normalizeRow({ "BANK ID": "IB", "BRANCH CODE": "00124", "BRANCH NAME": "Second", "STATE ID": "IN-AS", ACTIVE: "TRUE", "ACTIVATION ELIGIBLE": "FALSE" }, "BRANCH:4G", 3),
  BancaTrackerBranchMaster.normalizeRow({ "BANK ID": "IB", "BRANCH CODE": "00125", "BRANCH NAME": "Inactive", "STATE ID": "IN-AS", ACTIVE: "FALSE" }, "BRANCH:4G", 4),
];
const context = { branchRecords };
function row(code, period, budget, potential, extra = {}) {
  return { "BANK ID": "IB", "BRANCH CODE": code, PERIOD: period, BUDGET: budget, POTENTIAL: potential, ...extra };
}
function prepare(rows, id = "BRANCH_BUDGET_POTENTIAL:4G", dependency = context) {
  return Master.prepareDataset(rows, id, dependency);
}

const basic = prepare([row("00123", "2026-08", "450000", "1200000")]);
assert.strictEqual(basic.valid, true);
assert.deepStrictEqual(
  [basic.records[0].branchId, basic.records[0].branchCode, basic.records[0].periodKey, basic.records[0].financialYear, basic.records[0].budget, basic.records[0].potential],
  ["IB:00123", "00123", "2026-08", "FY2026-27", 450000, 1200000],
);
assert.strictEqual(basic.commercialReadiness.status, "READY");

assert.strictEqual(Master.normalizePeriod("2026-08"), "2026-08");
assert.strictEqual(Master.normalizePeriod("2026-13"), null);
assert.strictEqual(Master.normalizePeriod("Aug-26"), null, "alternate labels remain explicitly unsupported");
assert.strictEqual(Master.normalizePeriod("08/09/26"), null);

const zeros = prepare([row("00123", "2026-08", "0", "0")]);
assert.deepStrictEqual([zeros.records[0].budget, zeros.records[0].potential], [0, 0]);
const partial = prepare([row("00123", "2026-08", "100", "")]);
assert.deepStrictEqual([partial.valid, partial.records[0].potential, partial.commercialReadiness.status], [true, null, "PARTIAL"]);
assert.strictEqual(prepare([row("00123", "2026-08", "", "200")]).records[0].budget, null);
const missing = prepare([row("00123", "2026-08", "", "")]);
assert.strictEqual(missing.valid, false);
assert.ok(missing.findings.some((item) => item.code === "COMMERCIAL_VALUES_MISSING"));
for (const [budget, potential, code] of [["-1", "1", "COMMERCIAL_BUDGET_INVALID"], ["1", "-1", "COMMERCIAL_POTENTIAL_INVALID"], ["ABC", "1", "COMMERCIAL_BUDGET_INVALID"]]) {
  const invalid = prepare([row("00123", "2026-08", budget, potential)]);
  assert.strictEqual(invalid.valid, false);
  assert.ok(invalid.findings.some((item) => item.code === code));
}

const unmapped = prepare([row("99999", "2026-08", "1", "2")]);
assert.strictEqual(unmapped.valid, false);
assert.ok(unmapped.findings.some((item) => item.code === "COMMERCIAL_BRANCH_UNMAPPED"));
const absentDependency = prepare([row("00123", "2026-08", "1", "2")], "COMMERCIAL:ABSENT", null);
assert.strictEqual(absentDependency.valid, false);
assert.ok(absentDependency.findings.some((item) => item.code === "COMMERCIAL_BRANCH_MASTER_ABSENT"));

const duplicate = prepare([row("00123", "2026-08", "100", "200"), row("00123", "2026-08", "300", "400")]);
assert.strictEqual(duplicate.valid, false);
assert.ok(duplicate.findings.some((item) => item.code === "COMMERCIAL_BRANCH_PERIOD_DUPLICATE"));
const periods = prepare([row("00123", "2026-08", "100", "200"), row("00123", "2026-09", "200", "300"), row("00124", "2026-08", "300", "400")]);
assert.strictEqual(periods.valid, true);
assert.deepStrictEqual(periods.commercialSummary, {
  records: 3, validRows: 3, invalidRows: 0, distinctBranches: 2, distinctPeriods: 2,
  budgetPresent: 3, budgetMissing: 0, potentialPresent: 3, potentialMissing: 0,
  totalBudget: 600, totalPotential: 900, duplicateBranchPeriods: 0,
  unmappedBranches: 0, invalidNumericValues: 0, invalidPeriods: 0,
});

const inactive = prepare([row("00125", "2026-08", "50", "80")]);
assert.strictEqual(inactive.valid, true);
assert.ok(inactive.findings.some((item) => item.code === "COMMERCIAL_BRANCH_INACTIVE" && item.severity === "WARNING"));
const excluded = prepare([row("00124", "2026-08", "70", "90")]);
assert.strictEqual(excluded.valid, true, "activation eligibility is independent from commercial authority");

const live = Authority.setFromRecords(periods.records);
assert.deepStrictEqual([live.status, live.summary.records, live.summary.totalBudget], ["READY", 3, 600]);
assert.deepStrictEqual(Authority.resolve("IB:00123", "2026-08"), {
  status: "MATCHED", branchId: "IB:00123", periodKey: "2026-08",
  budget: 100, potential: 200, financialYear: "FY2026-27",
});
assert.deepStrictEqual(Authority.resolve("IB:00123", "2026-10"), {
  status: "PERIOD_UNAVAILABLE", branchId: "IB:00123", periodKey: "2026-10", budget: null, potential: null,
});
assert.strictEqual(Authority.resolve("IB:99999", "2026-08").status, "UNMAPPED");
Authority.setFromRecords([]);
assert.strictEqual(Authority.resolve("IB:00123", "2026-08").status, "MASTER_ABSENT");
assert.strictEqual(Authority.getByPeriod("2026-08", live).length, 2);
assert.strictEqual(Authority.getByBranch("IB:00123", live).length, 2);
assert.strictEqual(Master.summarize(periods.records, []).totalBudget, 600, "fact-row count cannot multiply master totals");
const partialLive = Authority.setFromRecords(partial.records);
assert.strictEqual(partialLive.status, "PARTIAL");
global.BancaTrackerCore = { state: { derived: null } };
const dqModel = BancaTrackerCanonicalDataQuality.buildModel(null);
assert.deepStrictEqual(
  [dqModel.branchCommercial.status, dqModel.branchCommercial.summary.budgetPresent, dqModel.branchCommercial.summary.potentialMissing],
  ["PARTIAL", 1, 1],
);
assert.strictEqual(BancaTrackerReadinessDiagnostics.buildReadiness(null).branchCommercial.status, "PARTIAL");

class MemoryRepository {
  constructor() { this.datasets = new Map(); this.records = new Map(); this.active = new Map(); this.versions = new Map(); this.stageCalls = 0; }
  async getActiveMasterRecords(type) { const id = this.active.get(type); return id ? this.records.get(id) || [] : type === "BRANCH_MASTER" ? branchRecords : []; }
  async stageDataset(metadata) { this.stageCalls += 1; const version = (this.versions.get(metadata.datasetType) || 0) + 1; this.versions.set(metadata.datasetType, version); const dataset = { ...metadata, datasetVersion: version, datasetId: `${metadata.datasetType}:${version}`, status: "STAGED" }; this.datasets.set(dataset.datasetId, dataset); return dataset; }
  async saveStagedMasterRecords(id, records) { this.records.set(id, records); }
  async activateDataset(id) { const dataset = this.datasets.get(id); const old = this.active.get(dataset.datasetType); if (old) this.datasets.get(old).status = "SUPERSEDED"; dataset.status = "ACTIVE"; this.active.set(dataset.datasetType, id); return { success: true, previousDatasetId: old || null }; }
  async markDatasetFailed(id) { this.datasets.get(id).status = "FAILED"; }
}

(async function () {
  const repository = new MemoryRepository();
  const csv1 = BancaTrackerMasterDataImport.parseText("BANK ID,BRANCH CODE,PERIOD,BUDGET,POTENTIAL\nIB,00123,2026-08,100,200");
  const preview1 = await BancaTrackerMasterDataImport.prepareImport("BRANCH_BUDGET_POTENTIAL", csv1, { repository, fileName: "commercial-v1.csv" });
  assert.deepStrictEqual([preview1.valid, preview1.commercialReadiness.status, preview1.commercialSummary.distinctBranches], [true, "READY", 1]);
  BancaTrackerMasterDataAdmin.renderImportPreview(preview1);
  assert.match(element("masterImportSummary").innerHTML, /Commercial Readiness/);
  await BancaTrackerMasterDataImport.commitImport(preview1, { repository });
  assert.strictEqual(repository.active.get("BRANCH_BUDGET_POTENTIAL"), "BRANCH_BUDGET_POTENTIAL:1");
  const csv2 = BancaTrackerMasterDataImport.parseText("BANK ID,BRANCH CODE,PERIOD,BUDGET,POTENTIAL\nIB,00123,2026-09,300,400");
  await BancaTrackerMasterDataImport.commitImport(await BancaTrackerMasterDataImport.prepareImport("BRANCH_BUDGET_POTENTIAL", csv2, { repository }), { repository });
  assert.strictEqual(repository.datasets.get("BRANCH_BUDGET_POTENTIAL:1").status, "SUPERSEDED");
  assert.strictEqual(repository.active.get("BRANCH_BUDGET_POTENTIAL"), "BRANCH_BUDGET_POTENTIAL:2");
  const stages = repository.stageCalls;
  const invalidPreview = await BancaTrackerMasterDataImport.prepareImport("BRANCH_BUDGET_POTENTIAL", BancaTrackerMasterDataImport.parseText("BANK ID,BRANCH CODE,PERIOD,BUDGET,POTENTIAL\nIB,00123,2026-13,100,200"), { repository });
  await assert.rejects(() => BancaTrackerMasterDataImport.commitImport(invalidPreview, { repository }), /valid preview/);
  assert.strictEqual(repository.stageCalls, stages);
  assert.strictEqual(repository.active.get("BRANCH_BUDGET_POTENTIAL"), "BRANCH_BUDGET_POTENTIAL:2");
  const loaded = await Authority.loadContext(repository);
  assert.deepStrictEqual([loaded.status, Authority.resolve("IB:00123", "2026-09").budget], ["READY", 300]);
  console.log("Step 4G tests passed: branch-period commercial schema, validation, lifecycle, cached lookup, summaries, readiness, and semantic independence.");
})().catch((error) => { console.error(error); process.exitCode = 1; });
