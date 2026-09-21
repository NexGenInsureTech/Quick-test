/* Step 6D.5D.2: executable contract for Target Seasonality Admin and live cache. */
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const DATASET_TYPE = "TARGET_SEASONALITY";
const LIVE_MODULE = path.join(root, "js", "enrichment", "liveTargetSeasonalityAuthority.js");
const CACHE_GAP = "CONTRACT GAP: Step 6D.5D.3 must expose BancaTrackerLiveTargetSeasonalityAuthority with the governed live-cache lifecycle.";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function resetLiveAuthority() {
  delete global.BancaTrackerLiveTargetSeasonalityAuthority;
  delete require.cache[require.resolve(LIVE_MODULE)];
  require(LIVE_MODULE);
  return global.BancaTrackerLiveTargetSeasonalityAuthority;
}

function records() {
  return [
    { fiscalYear: "FY2026-27", scopeType: "OVERALL", canonicalBank: null, monthKey: "2026-04", weight: 0.05 },
    { fiscalYear: "FY2026-27", scopeType: "BANK", canonicalBank: "INDIAN BANK", monthKey: "2026-04", weight: 0.06 },
  ];
}

function activeDataset() {
  return {
    datasetId: "TARGET_SEASONALITY:7",
    datasetType: DATASET_TYPE,
    datasetVersion: 7,
    status: "ACTIVE",
    rowCount: 24,
  };
}

class MemoryRepository {
  constructor(dataset = null, activeRecords = []) {
    this.dataset = dataset;
    this.activeRecords = clone(activeRecords);
    this.requests = [];
    this.fail = null;
  }

  async getActiveDataset(type) {
    this.requests.push(["dataset", type]);
    if (this.fail) throw this.fail;
    return type === DATASET_TYPE ? clone(this.dataset) : null;
  }

  async getActiveMasterRecords(type) {
    this.requests.push(["records", type]);
    if (this.fail) throw this.fail;
    return type === DATASET_TYPE ? clone(this.activeRecords) : [];
  }
}

function assertOnlySeasonalityReads(repository) {
  assert.ok(repository.requests.length > 0);
  assert.ok(repository.requests.every(([, type]) => type === DATASET_TYPE));
}

// Intentional current failure: the new cache module is the first missing 6D.5D boundary.
assert.ok(fs.existsSync(LIVE_MODULE), CACHE_GAP);

global.window = global;
global.document = {
  getElementById() {
    return { dataset: {}, addEventListener() {}, innerHTML: "", textContent: "", hidden: false };
  },
};
const load = (file) => require(path.join(root, file));
[
  "js/config.js",
  "js/utilities.js",
  "js/data/schema.js",
  "js/data/datasetRegistry.js",
  "js/targetSeasonality.js",
  "js/masters/targetSeasonalityMaster.js",
  "js/masterDataImport.js",
  "js/masterDataAdmin.js",
].forEach(load);

const Admin = global.BancaTrackerMasterDataAdmin;
const Importer = global.BancaTrackerMasterDataImport;
const Live = resetLiveAuthority();

assert.ok(Live && typeof Live.loadContext === "function"
  && typeof Live.setFromDataset === "function"
  && typeof Live.getCachedContext === "function", CACHE_GAP);

// A/B — Target Seasonality is a normal Admin master with the existing lifecycle and schema.
assert.ok(Importer.SCHEMAS[DATASET_TYPE]);
assert.deepStrictEqual(Importer.SCHEMAS[DATASET_TYPE].required, ["FISCAL YEAR", "SCOPE", "BANK", "MONTH", "WEIGHT"]);
assert.ok(Admin.IMPORT_CHOICES.some((choice) => choice.type === DATASET_TYPE && choice.label === "Target Seasonality"));
const master = Admin.buildViewModel({ masters: {} }, { seasonality: activeDataset() }).masters
  .find((item) => item.type === DATASET_TYPE);
assert.ok(master);
assert.strictEqual(master.label, "Target Seasonality");
assert.strictEqual(master.status, "ACTIVE");
assert.strictEqual(master.datasetId, "TARGET_SEASONALITY:7");
assert.strictEqual(master.recordCount, 24);

const adminSource = fs.readFileSync(path.join(root, "js", "masterDataAdmin.js"), "utf8");
for (const semanticToken of [
  "FISCAL YEAR", "SCOPE", "BANK", "MONTH", "WEIGHT", "one FY", "OVERALL", "decimal fraction",
  "12", "reconcile", "fully replaces", "omitted", "other FY", "invalid import",
]) assert.match(adminSource, new RegExp(semanticToken, "i"), `Admin guidance must communicate ${semanticToken}.`);

// C/E/G — lifecycle states, provenance, synchronous safe reads, and reload hydration.
const beforeHydration = Live.getCachedContext();
assert.strictEqual(beforeHydration.status, "NOT_LOADED");
assert.deepStrictEqual(beforeHydration.records, []);
assert.strictEqual(beforeHydration.dataset, null);

(async function run() {
  const absentRepository = new MemoryRepository();
  const absent = await Live.loadContext(absentRepository);
  assert.strictEqual(absent.status, "ABSENT");
  assert.deepStrictEqual(absent.records, []);
  assert.strictEqual(absent.dataset, null);
  assertOnlySeasonalityReads(absentRepository);

  const readyRepository = new MemoryRepository(activeDataset(), records());
  const ready = await Live.loadContext(readyRepository);
  assert.strictEqual(ready.status, "READY");
  assert.strictEqual(ready.dataset.datasetId, "TARGET_SEASONALITY:7");
  assert.strictEqual(ready.dataset.datasetVersion, 7);
  assert.deepStrictEqual(ready.records, records());
  assertOnlySeasonalityReads(readyRepository);
  const synchronous = Live.getCachedContext();
  assert.ok(!(synchronous && typeof synchronous.then === "function"));
  try { synchronous.records[0].weight = 0.99; synchronous.records.push({}); } catch (_) { /* frozen output is valid */ }
  assert.deepStrictEqual(Live.getCachedContext().records, records());

  const failedRepository = new MemoryRepository(activeDataset(), records());
  failedRepository.fail = new Error("synthetic read failure");
  const failed = await Live.loadContext(failedRepository);
  assert.strictEqual(failed.status, "LOAD_FAILED");
  assert.deepStrictEqual(failed.records, []);
  assert.strictEqual(failed.dataset, null);
  assert.ok((failed.diagnostics || []).length > 0);
  assertOnlySeasonalityReads(failedRepository);

  // Fresh module instance models reload: persisted active records restore READY without an import.
  const Reloaded = resetLiveAuthority();
  const restored = await Reloaded.loadContext(new MemoryRepository(activeDataset(), records()));
  assert.strictEqual(restored.status, "READY");
  assert.deepStrictEqual(restored.records, records());
  assert.strictEqual(restored.dataset.datasetId, "TARGET_SEASONALITY:7");

  // F — successful activation may refresh immediately; staged/failed input must not replace READY.
  const refreshed = Reloaded.setFromDataset({ ...activeDataset(), datasetId: "TARGET_SEASONALITY:8", datasetVersion: 8 }, records());
  assert.strictEqual(refreshed.status, "READY");
  assert.strictEqual(Reloaded.getCachedContext().dataset.datasetId, "TARGET_SEASONALITY:8");
  const readySnapshot = Reloaded.getCachedContext();
  try { Reloaded.setFromDataset({ ...activeDataset(), status: "STAGED" }, [{ fallback: "EQUAL_MONTH_FALLBACK" }]); } catch (_) { /* rejection is valid */ }
  assert.deepStrictEqual(Reloaded.getCachedContext(), readySnapshot);

  // D/E/firewalls — cache is persistence/provenance only, never Target or Commercial calculation authority.
  const liveSource = fs.readFileSync(LIVE_MODULE, "utf8");
  for (const forbidden of [
    "BRANCH_BUDGET_POTENTIAL", "BancaTrackerLiveBranchCommercialAuthority", "BancaTrackerCore",
    "bancaTrackerV8Targets", "BancaTrackerTarget.targetState", "indexedDB", "document.",
    "resolve({", "EQUAL_MONTH_FALLBACK",
  ]) assert.ok(!liveSource.includes(forbidden), `Live cache must not include ${forbidden}.`);
  const indexSource = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const resolverIndex = indexSource.indexOf('src="js/targetSeasonality.js"');
  const masterIndex = indexSource.indexOf('src="js/masters/targetSeasonalityMaster.js"');
  const liveIndex = indexSource.indexOf('src="js/enrichment/liveTargetSeasonalityAuthority.js"');
  const adminIndex = indexSource.indexOf('src="js/masterDataAdmin.js"');
  assert.ok(resolverIndex >= 0 && masterIndex > resolverIndex && liveIndex > masterIndex && adminIndex > liveIndex,
    "Browser must load pure resolver, master preparer, live cache, then Admin in dependency-safe order.");

  console.log("Step 6D.5D.2 Target Seasonality Admin/live-cache contract tests passed.");
})().catch((error) => { console.error(error); process.exitCode = 1; });
