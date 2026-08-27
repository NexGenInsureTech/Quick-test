/* Step 4B: governed State to Zone authority for live analytics. */
"use strict";

const assert = require("assert");
const path = require("path");
global.window = global;
const load = (file) => require(path.join(__dirname, "..", file));

[
  "js/data/schema.js", "js/data/datasetRegistry.js",
  "js/masters/geographyMaster.js", "js/masters/branchMaster.js",
  "js/masters/employeeMaster.js", "js/masters/hierarchyMaster.js",
  "js/masters/branchAssignmentMaster.js", "js/enrichment/dateResolver.js",
  "js/enrichment/geographyResolver.js", "js/enrichment/branchResolver.js",
  "js/enrichment/hierarchyResolver.js", "js/enrichment/assignmentResolver.js",
  "js/enrichment/enrichmentPipeline.js", "js/enrichment/liveGeographyAuthority.js",
  "js/enrichment/shadowEnrichment.js",
].forEach(load);

const Authority = BancaTrackerLiveGeographyAuthority;
const Shadow = BancaTrackerShadowEnrichment;
const geography = BancaTrackerGeographyMaster.prepareDataset([
  { "STATE ID": "IN-AS", "STATE CODE": "AS", "STATE NAME": "Assam", "ZONE ID": "EAST", "ZONE NAME": "East", ACTIVE: "TRUE" },
  { "STATE ID": "IN-ML", "STATE CODE": "ML", "STATE NAME": "Meghalaya", "ZONE ID": "NORTH_EAST", "ZONE NAME": "North East", ACTIVE: "TRUE" },
], "GEOGRAPHY_MASTER:TEST");
const branches = BancaTrackerBranchMaster.prepareDataset([
  { "BANK ID": "IB", "BRANCH CODE": "00123", "BRANCH NAME": "Guwahati Main", "STATE ID": "IN-AS", ACTIVE: "TRUE" },
], "BRANCH_MASTER:TEST", { geographyRecords: geography.records });
const geographyMaps = BancaTrackerGeographyResolver.buildLookupMaps(geography.records);
const branchMaps = BancaTrackerBranchResolver.buildLookupMaps(branches.records);
const fullContext = { geographyMaps, branchMaps };
const geographyOnly = { geographyMaps, branchMaps: null };

function source(overrides = {}) {
  return {
    premium: 100, month: "Aug-26", day: 24, policyIssuedDate: "24/08/2026",
    dateAuthority: "CANONICAL", bank: "IB", baCode: "RM001", branchCode: "00123",
    branch: "Guwahati Main", state: "Assam", zone: "North", ...overrides,
  };
}

let live = Authority.applyRecord(source({ zone: "East" }), { geographyMaps: null, branchMaps: null });
assert.strictEqual(live.state, "Assam");
assert.strictEqual(live.zone, "East");
assert.strictEqual(live.geographyAuthority, "LEGACY_FALLBACK");
assert.strictEqual(live.geographyAuthorityReason, "GEOGRAPHY_MASTER_ABSENT");

live = Authority.applyRecord(source(), geographyOnly);
assert.deepStrictEqual(
  [live.legacyState, live.legacyZone, live.state, live.stateId, live.zone, live.zoneId, live.geographyAuthority],
  ["Assam", "North", "Assam", "IN-AS", "East", "EAST", "GOVERNED_SOURCE_STATE"],
);
assert.strictEqual(live.legacyZoneComparison, "MISMATCH");

const exact = Authority.applyRecord(source(), fullContext);
assert.strictEqual(exact.geographyAuthority, "GOVERNED_BRANCH");
assert.strictEqual(exact.branchResolutionStatus, "MATCHED_EXACT");
assert.deepStrictEqual([exact.stateId, exact.zone], ["IN-AS", "East"]);

const conflict = Authority.applyRecord(source({ state: "Meghalaya" }), fullContext);
assert.strictEqual(conflict.legacyState, "Meghalaya");
assert.strictEqual(conflict.state, "Assam");
assert.strictEqual(conflict.zone, "East");
assert.strictEqual(conflict.branchSourceStateMismatch, true);

const branchUnmapped = Authority.applyRecord(source({ branchCode: "00999", branch: "Unknown", zone: "West" }), fullContext);
assert.strictEqual(branchUnmapped.branchResolutionStatus, "UNMAPPED");
assert.strictEqual(branchUnmapped.geographyAuthority, "GOVERNED_SOURCE_STATE");
assert.strictEqual(branchUnmapped.zone, "East");

const unmapped = Authority.applyRecord(source({ branchCode: "00999", branch: "Unknown", state: "Atlantis", zone: "East" }), fullContext);
assert.strictEqual(unmapped.geographyAuthority, "UNMAPPED");
assert.strictEqual(unmapped.state, "Atlantis");
assert.strictEqual(unmapped.zone, null);
assert.strictEqual(unmapped.legacyZone, "East");

const missing = Authority.applyRecord(source({ branchCode: "00999", branch: "Unknown", state: "", zone: "East" }), fullContext);
assert.strictEqual(missing.geographyAuthority, "UNMAPPED");
assert.strictEqual(missing.zone, null);

const matchingZone = Authority.applyRecord(source({ zone: "East" }), geographyOnly);
assert.strictEqual(matchingZone.legacyZoneComparison, "MATCH");
assert.strictEqual(exact.legacyZoneComparison, "MISMATCH");

const unknownBank = Authority.applyRecord(source({ bank: "UNLISTED BANK", baCode: "X1", branch: "Unknown" }), fullContext);
assert.strictEqual(unknownBank.bank, "UNLISTED BANK");
assert.strictEqual(unknownBank.geographyAuthority, "GOVERNED_SOURCE_STATE");
assert.strictEqual(unknownBank.zone, "East");

const invalidDate = Authority.applyRecord(source({ month: null, day: null, dateAuthority: "INVALID" }), geographyOnly);
assert.strictEqual(invalidDate.dateAuthority, "INVALID");
assert.strictEqual(invalidDate.month, null);
assert.strictEqual(invalidDate.geographyAuthority, "GOVERNED_SOURCE_STATE");
assert.strictEqual(invalidDate.zone, "East");

const shadowGoverned = BancaTrackerEnrichmentPipeline.enrichTransaction(
  Shadow.adaptRecord(exact),
  { geographyMaps, branchMaps },
);
assert.strictEqual(shadowGoverned.transaction.stateName, exact.state);
assert.strictEqual(shadowGoverned.transaction.zoneName, exact.zone);
assert.ok(shadowGoverned.findings.some((finding) => finding.code === "LEGACY_ZONE_MISMATCH"));
const shadowUnmapped = BancaTrackerEnrichmentPipeline.enrichTransaction(
  Shadow.adaptRecord(unmapped),
  { geographyMaps, branchMaps },
);
assert.strictEqual(shadowUnmapped.resolution.geography.status, "UNMAPPED");
assert.strictEqual(shadowUnmapped.transaction.zoneName, null);

const summary = Shadow.buildGeographyAuthoritySummary([
  exact, conflict, live, branchUnmapped, unmapped,
  Authority.applyRecord(source(), { geographyMaps: null, branchMaps: null }),
]);
assert.deepStrictEqual(summary, {
  governedBranch: 2, governedSourceState: 2, legacyFallback: 1,
  unmapped: 1, unspecified: 0, branchSourceStateMismatch: 1,
});

class Element {
  constructor() { this.value = ""; this.innerHTML = ""; this.textContent = ""; this.classList = { toggle() {} }; }
  addEventListener() {}
  add() {}
}
const elements = {};
global.document = { getElementById(id) { return elements[id] || (elements[id] = new Element()); } };
global.Option = class {};
global.performance = require("perf_hooks").performance;
global.sessionStorage = { getItem() { return null; }, setItem() {} };
[
  "js/config.js", "js/csvProcessor.js", "js/utilities.js", "js/analytics.js",
  "js/dataQuality.js", "js/productivity.js",
].forEach(load);
global.BancaTrackerShadowEnrichment = { run() { return Promise.resolve({}); } };
Authority.setCachedContext(geographyOnly);
load("js/core.js");
const header = "USGI NET PREMIUM,Month,INTERMEDIARY,BA NAME,Ba Code,LINE OF BUSINESS,BRANCH NAME,Zone,STATE,Day,POLICY ISSUED DATE";
const csv = `${header}\n100,Jul-26,UNLISTED BANK,RM One,X1,Motor,Unknown,North,Assam,23,24/08/2026\n-25,Jul-26,IB,RM Two,X2,Motor,Unknown Two,North,Assam,23,24/08/2026`;
assert.ok(BancaTrackerCore.loadCsvText(csv));
assert.strictEqual(BancaTrackerCore.state.factData.length, 2);
assert.ok(BancaTrackerCore.state.factData.every((record) => record.zone === "East"));
assert.ok(BancaTrackerCore.state.factData.every((record) => record.legacyZone === "North"));
assert.strictEqual(BancaTrackerCore.state.derived.zones.East.premium, 75);
assert.strictEqual(BancaTrackerCore.state.derived.zones.North, undefined);
assert.strictEqual(BancaTrackerCore.state.derived.totalPremium, 75);
assert.ok(BancaTrackerCore.state.factData.some((record) => record.bank === "UNLISTED BANK"));
assert.ok(BancaTrackerCore.state.factData.every((record) => record.month === "Aug-26"));

console.log("Step 4B governed geography authority tests passed: master fallback, branch/source governance, conflicts, unmapped safety, live Zone analytics, signed premium, unknown banks, date independence, and shadow alignment.");
