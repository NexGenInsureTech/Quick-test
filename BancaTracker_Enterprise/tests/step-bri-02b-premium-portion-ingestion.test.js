const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { performance } = require("perf_hooks");

class Element {
  constructor() { this.value = ""; this.textContent = ""; this.innerHTML = ""; this.style = {}; this.classList = { isError: false, toggle(name, enabled) { if (name === "status-error") this.isError = Boolean(enabled); } }; }
  addEventListener() {}
  add() {}
}
const elements = {};
global.window = global;
global.document = { getElementById(id) { return elements[id] || (elements[id] = new Element()); } };
global.Option = class { constructor(text, value) { this.text = text; this.value = value; } };
global.performance = performance;
global.sessionStorage = { getItem() { return null; }, setItem() {} };
const root = path.join(__dirname, "..");
const load = (file) => require(path.join(root, file));
[
  "js/config.js", "js/csvProcessor.js", "js/utilities.js", "js/analytics.js", "js/dataQuality.js",
  "js/productivity.js", "js/analytics/commercialPerformance.js", "js/analytics/commercialRollups.js",
  "js/enrichment/dateResolver.js", "js/analytics/policyTenure.js", "js/analytics/premiumPortion.js",
  "js/enrichment/premiumPortionEnrichment.js", "js/enrichment/policyCoverage.js",
].forEach(load);

let authorityLoadCount = 0;
const passthrough = { async loadContext(repository, context) { authorityLoadCount += 1; return context || null; }, getCachedContext: () => null, applyRecords: (rows) => rows.map((row) => ({ ...row })) };
global.BancaTrackerLiveBranchAuthority = passthrough;
global.BancaTrackerLiveAssignmentAuthority = passthrough;
global.BancaTrackerLiveHierarchyAuthority = passthrough;
global.BancaTrackerLiveGeographyAuthority = passthrough;
global.BancaTrackerLiveBranchUniverseAuthority = { getUniverse: () => null };
global.BancaTrackerLiveBranchCommercialAuthority = { getCachedContext: () => null, async loadContext() { authorityLoadCount += 1; } };
global.BancaTrackerShadowEnrichment = { run() { return Promise.resolve({ status: "READY" }); } };

let workerConstructionCount = 0;
global.Worker = class {
  constructor() { workerConstructionCount += 1; }
  postMessage(message) {
    try { this.onmessage({ data: { type: "complete", result: BancaTrackerCsvProcessor.process(message.text, message.config) } }); }
    catch (error) { this.onmessage({ data: { type: "error", message: error.message } }); }
  }
  terminate() {}
};
load("js/core.js");

const BASE = ["USGI NET PREMIUM", "Month", "INTERMEDIARY", "BA NAME", "Ba Code", "LINE OF BUSINESS", "BRANCH NAME", "Day", "POLICY ISSUED DATE"];
const normalizedHeader = (header) => header.trim().toUpperCase();
function rowFor(headers, premium, issued, endorsement, overrides = {}) {
  const values = {
    "USGI NET PREMIUM": premium, MONTH: issued.startsWith("01/04/2025") ? "Apr-25" : "Apr-26",
    INTERMEDIARY: "INDIAN BANK", "BA NAME": "RM Fictional", "BA CODE": "F01", "LINE OF BUSINESS": "Motor",
    "BRANCH NAME": "Fictional Branch", DAY: "1", "POLICY ISSUED DATE": issued, "ENDORSEMENT NO": endorsement,
    ...overrides,
  };
  return headers.map((header) => values[normalizedHeader(header)] == null ? "" : values[normalizedHeader(header)]);
}
const csv = (headers, rows) => [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");
const ENDORSEMENT = [...BASE.slice(0, 2), "ENDORSEMENT NO", ...BASE.slice(2)];
const textBytes = (text) => new TextEncoder().encode(text);
function fakeFile(name, text, onRead) {
  const bytes = textBytes(text);
  return { name, size: bytes.byteLength, lastModified: 1, async arrayBuffer() { if (onRead) onRead(); return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength); } };
}
const file = (name, headers, rows, onRead) => fakeFile(name, csv(headers, rows), onRead);

// Historical files remain valid and retain no full endorsement identifier.
let result = BancaTrackerCore.loadCsvText(csv(BASE, [rowFor(BASE, 10, "01/04/2026")]));
assert.ok(result); assert.strictEqual(result.rows[0].premiumPortionStatus, "UNKNOWN");
assert.deepStrictEqual(result.rows[0].premiumPortionDiagnosticCodes, ["ENDORSEMENT_HEADER_MISSING"]);
assert.strictEqual(result.rows[0].endorsementNumberSourceHeader, null);
assert.strictEqual(Object.prototype.hasOwnProperty.call(result.rows[0], "endorsementNumberSourceValue"), false);

// Header resolution is semantic, case/whitespace tolerant, reorderable, and preserves exact header provenance.
for (const header of ["ENDORSEMENT NO", " endorsement no "]) {
  const headers = [header, ...BASE];
  result = BancaTrackerCore.loadCsvText(csv(headers, [rowFor(headers, 12, "01/04/2026", "PRIVATE-FICTION-A01")]));
  const fact = result.rows[0];
  assert.strictEqual(fact.endorsementNumberSourceHeader, header);
  assert.deepStrictEqual([fact.premiumPortionStatus, fact.premiumPortionClassification, fact.premiumPortionExtractedSuffix, fact.premiumPortionAdvanceSequence, fact.premiumPortionOrdinal], ["SUCCESS", "ADVANCE_PORTION", "A01", 1, 2]);
  assert.strictEqual(fact.premiumPortionSuffixContractVersion, "BRI-02A-1");
  assert.strictEqual(JSON.stringify(fact).includes("PRIVATE-FICTION"), false);
}
const priorFacts = BancaTrackerCore.state.factData; const priorSummary = BancaTrackerCore.state.importSummary;
result = BancaTrackerCore.loadCsvText(csv([...BASE, "ENDORSEMENT NO", " endorsement no "], [rowFor([...BASE, "ENDORSEMENT NO", " endorsement no "], 1, "01/04/2026", "X-A01")]));
assert.strictEqual(result, null); assert.match(elements.status.textContent, /duplicate semantic column ENDORSEMENT NO/i);
assert.strictEqual(BancaTrackerCore.state.factData, priorFacts); assert.strictEqual(BancaTrackerCore.state.importSummary, priorSummary);

// Every governed/unknown/invalid case preserves the financial row and signed premium.
const identifiers = ["F-000", "F-A01", "F-A02", "F-A03", "F-A09", "F-A10", "", "A1"];
const premiums = [10, -2, 0, 3, 4, 5, 6, 7];
result = BancaTrackerCore.loadCsvText(csv(ENDORSEMENT, identifiers.map((id, index) => rowFor(ENDORSEMENT, premiums[index], "01/04/2026", id, { "BRANCH NAME": `Branch ${index}` }))));
assert.ok(result); assert.deepStrictEqual(result.rows.map((item) => item.premium), premiums);
assert.strictEqual(BancaTrackerCore.state.derived.totalPremium, premiums.reduce((sum, value) => sum + value, 0));
assert.deepStrictEqual(result.rows.map((item) => item.premiumPortionClassification), ["INITIAL_PORTION", "ADVANCE_PORTION", "ADVANCE_PORTION", "ADVANCE_PORTION", "UNKNOWN", "UNKNOWN", "UNKNOWN", "INVALID"]);
assert.deepStrictEqual(result.rows.map((item) => item.premiumPortionExtractedSuffix), ["000", "A01", "A02", "A03", "A09", "A10", null, null]);
assert.strictEqual(result.summary.premiumPortion.rowCount, identifiers.length);
assert.deepStrictEqual(result.summary.premiumPortion.statusCounts, { SUCCESS: 4, UNKNOWN: 3, INVALID: 1 });
assert.strictEqual(result.summary.premiumPortion.diagnosticCounts.ADVANCE_SUFFIX_NOT_GOVERNED, 2);
assert.strictEqual(result.summary.premiumPortion.diagnosticCounts.ENDORSEMENT_NUMBER_MISSING, 1);
assert.strictEqual(result.summary.premiumPortion.diagnosticCounts.ENDORSEMENT_NUMBER_TOO_SHORT, 1);
assert.strictEqual(BancaTrackerCore.state.dataQuality.importSummary, result.summary);
assert.strictEqual(BancaTrackerCore.state.dataQuality.importSummary.premiumPortion, result.summary.premiumPortion);
assert.strictEqual(JSON.stringify(result).includes("F-A01"), false);
assert.strictEqual(JSON.stringify(BancaTrackerCore.state.dataQuality).includes("F-A01"), false);
assert.strictEqual(elements.status.textContent.includes("F-A01"), false);

// Identifier metadata cannot change commercial output for the same financial row.
const withoutIdentifier = BancaTrackerCore.loadCsvText(csv(BASE, [rowFor(BASE, 75, "01/04/2026")]));
const commercialBaseline = JSON.stringify(BancaTrackerCore.state.commercialPerformance);
const withIdentifier = BancaTrackerCore.loadCsvText(csv(ENDORSEMENT, [rowFor(ENDORSEMENT, 75, "01/04/2026", "PRIVATE-COMMERCIAL-A02")]));
assert.strictEqual(JSON.stringify(BancaTrackerCore.state.commercialPerformance), commercialBaseline);
assert.strictEqual(withIdentifier.rows.length, withoutIdentifier.rows.length);
assert.strictEqual(withIdentifier.rows[0].premium, withoutIdentifier.rows[0].premium);

(async () => {
  const dataQualityAuthority = global.BancaTrackerDataQuality;
  const preparedStatuses = [];
  global.BancaTrackerDataQuality = { ...dataQualityAuthority, build(records, config, summary) { if (summary && summary.batch) preparedStatuses.push(summary.batch.status); return dataQualityAuthority.build(records, config, summary); } };
  const oldHeaders = BASE;
  const newHeaders = [...BASE, "ENDORSEMENT NO"];
  const batch = await BancaTrackerCore.handleFiles([
    file("historical.csv", oldHeaders, [rowFor(oldHeaders, 11, "01/04/2025")]),
    file("current.csv", newHeaders, [rowFor(newHeaders, -3, "01/04/2026", "PRIVATE-BATCH-A02"), rowFor(newHeaders, 0, "01/04/2026", "PRIVATE-BATCH-A03", { "BRANCH NAME": "Zero Branch" })]),
  ], new Element());
  global.BancaTrackerDataQuality = dataQualityAuthority;
  assert.ok(batch, elements.status.textContent);
  assert.deepStrictEqual(batch.rows.map((item) => item.premium), [11, -3, 0]);
  assert.deepStrictEqual(batch.rows.map((item) => item.financialYear), ["FY2025-26", "FY2026-27", "FY2026-27"]);
  assert.deepStrictEqual(batch.rows.map((item) => item.premiumPortionClassification), ["UNKNOWN", "ADVANCE_PORTION", "ADVANCE_PORTION"]);
  assert.deepStrictEqual(preparedStatuses, ["PREPARED"]);
  assert.strictEqual(batch.summary.batch.status, "COMMITTED");
  assert.strictEqual(batch.summary.premiumPortion.rowCount, 3);
  assert.strictEqual(BancaTrackerCore.state.importSummary, batch.summary);
  assert.strictEqual(BancaTrackerCore.state.dataQuality.importSummary, batch.summary);
  assert.strictEqual(batch.rows.reduce((sum, item) => sum + item.premium, 0), 8);
  assert.strictEqual(BancaTrackerCore.state.derived.totalPremium, -3);
  assert.strictEqual(JSON.stringify(batch).includes("PRIVATE-BATCH"), false);

  const activeFacts = BancaTrackerCore.state.factData;
  const activeSummary = BancaTrackerCore.state.importSummary;
  const activeDataQuality = BancaTrackerCore.state.dataQuality;
  const activePremium = BancaTrackerCore.state.derived.totalPremium;
  const csvProcess = BancaTrackerCsvProcessor.process;
  let parserCount = 0; let candidateCount = 0; let readCount = 0; let hashCount = 0;
  BancaTrackerCsvProcessor.process = (...args) => { parserCount += 1; return csvProcess(...args); };
  global.BancaTrackerDataQuality = { ...dataQualityAuthority, build(...args) { candidateCount += 1; return dataQualityAuthority.build(...args); } };
  const cryptoDescriptor = Object.getOwnPropertyDescriptor(global, "crypto");
  const digest = global.crypto.subtle.digest.bind(global.crypto.subtle);
  Object.defineProperty(global, "crypto", { configurable: true, value: { subtle: { digest(...args) { hashCount += 1; return digest(...args); } } } });
  const unread = { name: "must-not-read.csv", async arrayBuffer() { readCount += 1; throw new Error("must not read"); } };
  const adapter = global.BancaTrackerPremiumPortionEnrichment;
  const authority = global.BancaTrackerPremiumPortion;

  delete global.BancaTrackerPremiumPortionEnrichment;
  assert.strictEqual(BancaTrackerCore.loadCsvText(csv(BASE, [rowFor(BASE, 1, "01/04/2026")])), null);
  assert.strictEqual(elements.status.textContent, "PREMIUM_PORTION_ENRICHMENT_UNAVAILABLE");
  assert.strictEqual(parserCount, 0); assert.strictEqual(candidateCount, 0);
  global.BancaTrackerPremiumPortionEnrichment = { ...adapter, apply: null };
  assert.strictEqual(BancaTrackerCore.loadCsvText(csv(BASE, [rowFor(BASE, 1, "01/04/2026")])), null);
  assert.strictEqual(elements.status.textContent, "PREMIUM_PORTION_ENRICHMENT_UNAVAILABLE");

  global.BancaTrackerPremiumPortionEnrichment = adapter;
  delete global.BancaTrackerPremiumPortion;
  assert.strictEqual(BancaTrackerCore.loadCsvText(csv(BASE, [rowFor(BASE, 1, "01/04/2026")])), null);
  assert.strictEqual(elements.status.textContent, "PREMIUM_PORTION_AUTHORITY_UNAVAILABLE");
  assert.strictEqual(parserCount, 0); assert.strictEqual(candidateCount, 0);

  global.BancaTrackerPremiumPortion = { ...authority, INITIAL_SUFFIX_CONTRACT: { version: "INVALID", mappings: { A01: { classification: "ADVANCE_PORTION", advanceSequence: 9, portionOrdinal: 2 } } } };
  assert.strictEqual(BancaTrackerCore.loadCsvText(csv(BASE, [rowFor(BASE, 1, "01/04/2026")])), null);
  assert.strictEqual(elements.status.textContent, "PREMIUM_PORTION_GOVERNANCE_INVALID");
  assert.strictEqual(parserCount, 0); assert.strictEqual(candidateCount, 0);

  global.BancaTrackerPremiumPortion = authority;
  delete global.BancaTrackerPremiumPortionEnrichment;
  authorityLoadCount = 0; workerConstructionCount = 0;
  assert.strictEqual(await BancaTrackerCore.handleFiles([unread], new Element()), null);
  assert.strictEqual(elements.status.textContent, "PREMIUM_PORTION_ENRICHMENT_UNAVAILABLE");
  assert.deepStrictEqual([readCount, hashCount, parserCount, workerConstructionCount, authorityLoadCount, candidateCount], [0, 0, 0, 0, 0, 0]);
  global.BancaTrackerPremiumPortionEnrichment = { ...adapter, apply: null };
  assert.strictEqual(await BancaTrackerCore.handleFiles([unread], new Element()), null);
  assert.strictEqual(elements.status.textContent, "PREMIUM_PORTION_ENRICHMENT_UNAVAILABLE");
  global.BancaTrackerPremiumPortionEnrichment = adapter;
  delete global.BancaTrackerPremiumPortion;
  assert.strictEqual(await BancaTrackerCore.handleFiles([unread], new Element()), null);
  assert.strictEqual(elements.status.textContent, "PREMIUM_PORTION_AUTHORITY_UNAVAILABLE");
  global.BancaTrackerPremiumPortion = { ...authority, INITIAL_SUFFIX_CONTRACT: { version: "INVALID", mappings: {} } };
  assert.strictEqual(await BancaTrackerCore.handleFiles([unread], new Element()), null);
  assert.strictEqual(elements.status.textContent, "PREMIUM_PORTION_GOVERNANCE_INVALID");
  assert.deepStrictEqual([readCount, hashCount, parserCount, workerConstructionCount, authorityLoadCount, candidateCount], [0, 0, 0, 0, 0, 0]);
  assert.strictEqual(BancaTrackerCore.state.factData, activeFacts); assert.strictEqual(BancaTrackerCore.state.importSummary, activeSummary); assert.strictEqual(BancaTrackerCore.state.dataQuality, activeDataQuality);

  global.BancaTrackerPremiumPortion = authority;
  global.BancaTrackerPremiumPortionEnrichment = adapter;
  const disappearing = file("disappearing.csv", newHeaders, [rowFor(newHeaders, 9, "01/04/2026", "PRIVATE-DISAPPEAR-A01")], () => { delete global.BancaTrackerPremiumPortion; });
  const disappeared = await BancaTrackerCore.handleFiles([disappearing], new Element());
  assert.strictEqual(disappeared, null); assert.strictEqual(elements.status.textContent, "PREMIUM_PORTION_AUTHORITY_UNAVAILABLE");
  assert.strictEqual(BancaTrackerCore.state.factData, activeFacts); assert.strictEqual(BancaTrackerCore.state.importSummary, activeSummary); assert.strictEqual(BancaTrackerCore.state.derived.totalPremium, activePremium);

  global.BancaTrackerPremiumPortion = authority;
  BancaTrackerCsvProcessor.process = csvProcess;
  global.BancaTrackerDataQuality = dataQualityAuthority;
  Object.defineProperty(global, "crypto", cryptoDescriptor);

  const dataQualityDescriptor = Object.getOwnPropertyDescriptor(BancaTrackerCore.state, "dataQuality");
  Object.defineProperty(BancaTrackerCore.state, "dataQuality", { ...dataQualityDescriptor, writable: false });
  const activationFailed = await BancaTrackerCore.handleFiles([file("activation-failure.csv", newHeaders, [rowFor(newHeaders, 20, "01/04/2026", "PRIVATE-ACTIVATE-A01")])], new Element());
  assert.strictEqual(activationFailed, null); assert.strictEqual(elements.status.textContent, "IMPORT_ACTIVATION_TARGET_PROPERTY_UNSAFE:dataQuality");
  assert.strictEqual(BancaTrackerCore.state.factData, activeFacts); assert.strictEqual(BancaTrackerCore.state.importSummary, activeSummary); assert.strictEqual(BancaTrackerCore.state.dataQuality, activeDataQuality); assert.strictEqual(BancaTrackerCore.state.derived.totalPremium, activePremium);
  Object.defineProperty(BancaTrackerCore.state, "dataQuality", dataQualityDescriptor);

  const recovered = await BancaTrackerCore.handleFiles([file("recovery.csv", newHeaders, [rowFor(newHeaders, 25, "01/04/2026", "PRIVATE-RECOVERY-A03")])], new Element());
  assert.ok(recovered, elements.status.textContent); assert.strictEqual(recovered.summary.batch.status, "COMMITTED");
  assert.strictEqual(BancaTrackerCore.state.importSummary, recovered.summary); assert.strictEqual(BancaTrackerCore.state.dataQuality.importSummary, recovered.summary);
  assert.deepStrictEqual(BancaTrackerCore.state.factData.map((item) => item.premium), [25]); assert.strictEqual(BancaTrackerCore.state.derived.totalPremium, 25);
  assert.strictEqual(JSON.stringify(recovered).includes("PRIVATE-RECOVERY"), false);

  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  assert.ok(html.indexOf('js/analytics/premiumPortion.js') < html.indexOf('js/enrichment/premiumPortionEnrichment.js'));
  assert.ok(html.indexOf('js/enrichment/premiumPortionEnrichment.js') < html.indexOf('js/enrichment/policyCoverage.js'));
  assert.strictEqual((html.match(/js\/analytics\/premiumPortion\.js/g) || []).length, 1);
  assert.strictEqual((html.match(/js\/enrichment\/premiumPortionEnrichment\.js/g) || []).length, 1);
  console.log("BRI-02B premium-portion ingestion tests passed: semantic headers, transient privacy, governed classification, signed/multi-FY facts, atomic dependencies, activation recovery, and summary consistency.");
})().catch((error) => { console.error(error); process.exit(1); });
