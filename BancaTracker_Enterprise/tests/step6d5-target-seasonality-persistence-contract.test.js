/* Step 6D.5B: executable contract for Target Seasonality persistence and import. */
"use strict";

const assert = require("assert");
const path = require("path");

global.window = global;
const load = (file) => require(path.join(__dirname, "..", file));
[
  "js/config.js",
  "js/data/schema.js",
  "js/data/datasetRegistry.js",
  "js/targetSeasonality.js",
  "js/masterDataImport.js",
].forEach(load);

const Importer = global.BancaTrackerMasterDataImport;
const DATASET_TYPE = "TARGET_SEASONALITY";
const FY26 = "FY2026-27";
const FY27 = "FY2027-28";
const TOLERANCE = 1e-9;

function monthsFor(fiscalYear) {
  const match = /^FY(\d{4})-(\d{2})$/.exec(fiscalYear);
  const start = Number(match[1]);
  return [
    `${start}-04`, `${start}-05`, `${start}-06`, `${start}-07`, `${start}-08`, `${start}-09`,
    `${start}-10`, `${start}-11`, `${start}-12`, `${start + 1}-01`, `${start + 1}-02`, `${start + 1}-03`,
  ];
}

function equalWeights() { return monthsFor(FY26).map(() => 1 / 12); }
function unequalWeights() { return [0.05, 0.06, 0.07, 0.08, 0.09, 0.10, 0.11, 0.10, 0.09, 0.08, 0.09, 0.08]; }
function rowsFor(fiscalYear, scope, bank, weights = unequalWeights()) {
  return monthsFor(fiscalYear).map((month, index) => ({
    "FISCAL YEAR": fiscalYear,
    SCOPE: scope,
    BANK: bank || "",
    MONTH: month,
    WEIGHT: String(weights[index]),
  }));
}
function parsed(rows) {
  return {
    headers: ["FISCAL YEAR", "SCOPE", "BANK", "MONTH", "WEIGHT"],
    rows,
  };
}
function clone(value) { return JSON.parse(JSON.stringify(value)); }

/*
 * Future import boundary: existing MasterDataImport lifecycle, augmented only by a
 * TARGET_SEASONALITY preparer that validates one FY and builds a complete successor
 * snapshot before stage/save/activate. There remains one active dataset pointer.
 */
class MemoryRepository {
  constructor() {
    this.datasets = new Map();
    this.records = new Map();
    this.active = new Map();
    this.versions = new Map();
    this.failWrite = false;
    this.failActivation = false;
  }

  async getActiveMasterRecords(type) {
    return clone(this.records.get(this.active.get(type)) || []);
  }

  async stageDataset(metadata) {
    const version = (this.versions.get(metadata.datasetType) || 0) + 1;
    this.versions.set(metadata.datasetType, version);
    const dataset = {
      ...metadata,
      datasetId: `${metadata.datasetType}:${version}`,
      datasetVersion: version,
      status: "STAGED",
      previousDatasetId: null,
    };
    this.datasets.set(dataset.datasetId, dataset);
    return dataset;
  }

  async saveStagedMasterRecords(datasetId, records) {
    if (this.failWrite) throw new Error("synthetic write failure");
    this.records.set(datasetId, clone(records));
  }

  async activateDataset(datasetId) {
    if (this.failActivation) throw new Error("synthetic activation failure");
    const dataset = this.datasets.get(datasetId);
    const previousDatasetId = this.active.get(dataset.datasetType) || null;
    if (previousDatasetId) this.datasets.get(previousDatasetId).status = "SUPERSEDED";
    dataset.status = "ACTIVE";
    dataset.previousDatasetId = previousDatasetId;
    this.active.set(dataset.datasetType, datasetId);
    return { success: true, datasetId, previousDatasetId };
  }

  async markDatasetFailed(datasetId) {
    const dataset = this.datasets.get(datasetId);
    if (dataset) dataset.status = "FAILED";
  }
}

async function preview(repository, rows, fileName = "target-seasonality.csv") {
  return Importer.prepareImport(DATASET_TYPE, parsed(rows), { repository, fileName });
}
async function activate(repository, rows) {
  return Importer.commitImport(await preview(repository, rows), { repository });
}
function weightSum(records) { return records.reduce((total, record) => total + record.weight, 0); }
function assertCurve(records, fiscalYear, scopeType, canonicalBank, expectedWeights) {
  const curve = records.filter((record) => record.fiscalYear === fiscalYear
    && record.scopeType === scopeType && record.canonicalBank === canonicalBank);
  assert.strictEqual(curve.length, 12);
  assert.deepStrictEqual(curve.map((record) => record.monthKey), monthsFor(fiscalYear));
  if (expectedWeights) assert.deepStrictEqual(curve.map((record) => record.weight), expectedWeights);
  assert.ok(Math.abs(weightSum(curve) - 1) <= TOLERANCE);
}
async function assertInvalid(repository, rows) {
  const result = await preview(repository, rows);
  assert.strictEqual(result.valid, false);
  await assert.rejects(() => Importer.commitImport(result, { repository }), /valid preview/i);
}

// Intentional current failure: Step 6D.5C must register this canonical persistent master
// and provide its preparer/successor-snapshot semantics through MasterDataImport.
assert.ok(
  Importer.SCHEMAS[DATASET_TYPE],
  "CONTRACT GAP: Step 6D.5C must register TARGET_SEASONALITY with the Master Data Import persistence/preparer boundary.",
);

async function run() {
// P01 — valid Overall-only first import: no synthetic fallback records are persisted.
{
  const repository = new MemoryRepository();
  const committed = await activate(repository, rowsFor(FY26, "OVERALL", ""));
  assert.strictEqual(committed.dataset.datasetType, DATASET_TYPE);
  const active = await repository.getActiveMasterRecords(DATASET_TYPE);
  assertCurve(active, FY26, "OVERALL", null, unequalWeights());
  assert.ok(active.every((record) => !Object.prototype.hasOwnProperty.call(record, "fallback")));
}

// P02/P03 — Bank-only and Overall-plus-Bank imports are valid without a complete Bank universe.
{
  const bankOnlyRepository = new MemoryRepository();
  await activate(bankOnlyRepository, rowsFor(FY26, "BANK", "INDIAN BANK"));
  assertCurve(await bankOnlyRepository.getActiveMasterRecords(DATASET_TYPE), FY26, "BANK", "INDIAN BANK");

  const repository = new MemoryRepository();
  await activate(repository, rowsFor(FY26, "OVERALL", "").concat(rowsFor(FY26, "BANK", "INDIAN BANK")));
  const active = await repository.getActiveMasterRecords(DATASET_TYPE);
  assertCurve(active, FY26, "OVERALL", null);
  assertCurve(active, FY26, "BANK", "INDIAN BANK");
}

// P04–P17 — schema/import concerns plus complete-curve semantics.
{
  const repository = new MemoryRepository();
  await assertInvalid(repository, rowsFor(FY26, "UNSUPPORTED", "")); // P04
  await assertInvalid(repository, rowsFor(FY26, "OVERALL", "SHOULD BE BLANK")); // P05
  await assertInvalid(repository, rowsFor(FY26, "BANK", "")); // P06
  await assertInvalid(repository, rowsFor("FYbad", "OVERALL", "")); // P07

  const invalidMonth = rowsFor(FY26, "OVERALL", ""); invalidMonth[0].MONTH = "Apr-26";
  await assertInvalid(repository, invalidMonth); // P08
  const outsideFy = rowsFor(FY26, "OVERALL", ""); outsideFy[11].MONTH = "2027-04";
  await assertInvalid(repository, outsideFy); // P09
  const malformedWeight = rowsFor(FY26, "OVERALL", ""); malformedWeight[0].WEIGHT = "five percent";
  await assertInvalid(repository, malformedWeight); // P10
  const negative = rowsFor(FY26, "OVERALL", ""); negative[0].WEIGHT = "-0.01";
  await assertInvalid(repository, negative); // P11
  const aboveOne = rowsFor(FY26, "OVERALL", ""); aboveOne[0].WEIGHT = "1.01";
  await assertInvalid(repository, aboveOne); // P12
  await assertInvalid(repository, rowsFor(FY26, "OVERALL", "").slice(0, 11)); // P13
  const duplicate = rowsFor(FY26, "OVERALL", ""); duplicate.push({ ...duplicate[0] });
  await assertInvalid(repository, duplicate); // P14
  const below = rowsFor(FY26, "OVERALL", "", equalWeights()); below[0].WEIGHT = String((1 / 12) - 0.01);
  await assertInvalid(repository, below); // P15
  const above = rowsFor(FY26, "OVERALL", "", equalWeights()); above[0].WEIGHT = String((1 / 12) + 0.01);
  await assertInvalid(repository, above); // P16
  const tiny = rowsFor(FY26, "OVERALL", "", equalWeights()); tiny[0].WEIGHT = String((1 / 12) + 5e-10);
  assert.strictEqual((await preview(repository, tiny)).valid, true); // P17
}

// P18/P19 — one CSV is one FY; one invalid curve rejects the whole submitted FY.
{
  const repository = new MemoryRepository();
  await assertInvalid(repository, rowsFor(FY26, "OVERALL", "").concat(rowsFor(FY27, "OVERALL", "")));
  const invalidBank = rowsFor(FY26, "BANK", "BANK B").slice(0, 11);
  await assertInvalid(repository, rowsFor(FY26, "OVERALL", "")
    .concat(rowsFor(FY26, "BANK", "BANK A"), invalidBank, rowsFor(FY26, "BANK", "BANK C")));
}

// P20–P24 — submitted FY is a full replacement; other FYs survive successor-snapshot activation.
{
  const repository = new MemoryRepository();
  const versionA = unequalWeights();
  const versionB = [0.08, 0.08, 0.08, 0.08, 0.08, 0.08, 0.08, 0.08, 0.08, 0.08, 0.10, 0.10];
  await activate(repository, rowsFor(FY26, "OVERALL", "", versionA)
    .concat(rowsFor(FY26, "BANK", "BANK A", versionA), rowsFor(FY26, "BANK", "BANK B", versionA)));
  await activate(repository, rowsFor(FY27, "OVERALL", "", versionA));
  await activate(repository, rowsFor(FY26, "OVERALL", "", versionB).concat(rowsFor(FY26, "BANK", "BANK A", versionB)));
  const active = await repository.getActiveMasterRecords(DATASET_TYPE);
  assertCurve(active, FY26, "OVERALL", null, versionB); // P20
  assertCurve(active, FY26, "BANK", "BANK A", versionB);
  assert.strictEqual(active.filter((record) => record.fiscalYear === FY26 && record.canonicalBank === "BANK B").length, 0); // P21
  assertCurve(active, FY27, "OVERALL", null, versionA); // P23/P24

  await activate(repository, rowsFor(FY26, "BANK", "BANK A", versionA));
  const omittedOverall = await repository.getActiveMasterRecords(DATASET_TYPE);
  assert.strictEqual(omittedOverall.filter((record) => record.fiscalYear === FY26 && record.scopeType === "OVERALL").length, 0); // P22
  assertCurve(omittedOverall, FY27, "OVERALL", null, versionA);
}

// P25–P27 — invalid/write/activation failures cannot disturb the existing active snapshot.
{
  const repository = new MemoryRepository();
  await activate(repository, rowsFor(FY26, "OVERALL", ""));
  const beforeInvalid = await repository.getActiveMasterRecords(DATASET_TYPE);
  await assertInvalid(repository, rowsFor(FY26, "OVERALL", "").slice(0, 11));
  assert.deepStrictEqual(await repository.getActiveMasterRecords(DATASET_TYPE), beforeInvalid); // P25

  repository.failWrite = true;
  await assert.rejects(() => activate(repository, rowsFor(FY27, "OVERALL", "")), /synthetic write failure/);
  assert.deepStrictEqual(await repository.getActiveMasterRecords(DATASET_TYPE), beforeInvalid); // P26
  repository.failWrite = false;

  repository.failActivation = true;
  await assert.rejects(() => activate(repository, rowsFor(FY27, "OVERALL", "")), /synthetic activation failure/);
  assert.deepStrictEqual(await repository.getActiveMasterRecords(DATASET_TYPE), beforeInvalid); // P27
}

// P28/P29 — active reads return the full snapshot and retain normal dataset provenance.
{
  const repository = new MemoryRepository();
  const first = await activate(repository, rowsFor(FY26, "OVERALL", ""));
  const second = await activate(repository, rowsFor(FY27, "OVERALL", ""));
  const active = await repository.getActiveMasterRecords(DATASET_TYPE);
  assert.strictEqual(active.length, 24); // P28
  assert.strictEqual(second.dataset.datasetVersion, first.dataset.datasetVersion + 1);
  assert.strictEqual(second.activation.previousDatasetId, first.dataset.datasetId); // P29
  assert.strictEqual(repository.active.get(DATASET_TYPE), second.dataset.datasetId);
}

// P30/P31 — fallback is never data; canonical Bank ownership is exact after one import normalization.
{
  const repository = new MemoryRepository();
  await activate(repository, rowsFor(FY26, "BANK", "indian bank"));
  const active = await repository.getActiveMasterRecords(DATASET_TYPE);
  assert.strictEqual(active.length, 12);
  assert.ok(active.every((record) => !("status" in record) && record.weight !== 1 / 12));
  assertCurve(active, FY26, "BANK", "INDIAN BANK");
}

// P32/P33/P34 — session Target and Commercial boundaries stay untouched; input is not mutated and ordering is deterministic.
{
  global.BancaTrackerTarget = { targetState: { fiscalYearTarget: 120, monthlyTarget: 10, bankTargets: { "INDIAN BANK": 60 } } };
  const targetBefore = clone(global.BancaTrackerTarget.targetState);
  const input = rowsFor(FY26, "OVERALL", "");
  const inputBefore = clone(input);
  const repository = new MemoryRepository();
  const first = await preview(repository, input);
  const second = await preview(repository, input.slice().reverse());
  assert.strictEqual(first.valid, true);
  assert.strictEqual(second.valid, true);
  assert.deepStrictEqual(input, inputBefore);
  assert.deepStrictEqual(global.BancaTrackerTarget.targetState, targetBefore);
  assert.strictEqual(first.datasetType, DATASET_TYPE);
  assert.strictEqual(first.commercialSummary, null);
}

// P35 — header-only input cannot delete an unspecified FY.
{
  await assertInvalid(new MemoryRepository(), []);
}
}

run()
  .then(() => console.log("Step 6D.5B Target Seasonality persistence/import contract tests passed."))
  .catch((error) => { console.error(error); process.exitCode = 1; });
