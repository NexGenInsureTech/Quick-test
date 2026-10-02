/* Candidate v8.6.5 Sprint A: atomic multi-file PR batch REPLACE. */
const assert = require("assert");
const cryptoModule = require("crypto");
const fs = require("fs");
const path = require("path");

class Element {
  constructor() { this.value = "selected"; this.innerHTML = ""; this.textContent = ""; this.style = {}; this.classList = { toggle() {} }; }
  addEventListener(type, handler) { this[`on${type}`] = handler; }
  add() {}
}
const elements = {};
global.window = global;
global.document = { getElementById(id) { return elements[id] || (elements[id] = new Element()); } };
global.Option = class { constructor(text, value) { this.text = text; this.value = value; } };
global.performance = require("perf_hooks").performance;
global.sessionStorage = { getItem() { return null; }, setItem() {} };
Object.defineProperty(global, "crypto", { configurable: true, value: { subtle: { async digest(name, bytes) { assert.strictEqual(name, "SHA-256"); const digest = cryptoModule.createHash("sha256").update(Buffer.from(bytes)).digest(); return digest.buffer.slice(digest.byteOffset, digest.byteOffset + digest.byteLength); } } } });

const load = (file) => require(path.join(__dirname, "..", file));
[
  "js/config.js", "js/csvProcessor.js", "js/utilities.js", "js/analytics.js", "js/dataQuality.js",
  "js/productivity.js", "js/analytics/commercialPerformance.js", "js/analytics/commercialRollups.js",
  "js/enrichment/dateResolver.js",
].forEach(load);

const events = []; let activeWork = 0; let maxActiveWork = 0; let workerRuns = 0;
global.Worker = class {
  postMessage(message) {
    workerRuns += 1; activeWork += 1; maxActiveWork = Math.max(maxActiveWork, activeWork); events.push("parse:start");
    setImmediate(() => {
      try { this.onmessage({ data: { type: "progress", stage: "Parsing CSV..." } }); const result = BancaTrackerCsvProcessor.process(message.text, message.config); activeWork -= 1; events.push("parse:end"); this.onmessage({ data: { type: "complete", result } }); }
      catch (error) { activeWork -= 1; events.push("parse:error"); this.onmessage({ data: { type: "error", message: error.message } }); }
    });
  }
  terminate() {}
};

const authorityCounts = { branchLoad: 0, assignmentLoad: 0, hierarchyLoad: 0, geographyLoad: 0, commercialLoad: 0, branchApply: 0 };
const context = { branchUniverse: { authority: "LEGACY_FALLBACK" } };
global.BancaTrackerLiveBranchAuthority = { async loadContext() { authorityCounts.branchLoad += 1; return context; }, getCachedContext: () => context, applyRecords(rows) { authorityCounts.branchApply += 1; return rows.map((row) => ({ ...row })); } };
global.BancaTrackerLiveAssignmentAuthority = { async loadContext(repository, base) { authorityCounts.assignmentLoad += 1; return base; }, getCachedContext: () => context, applyRecords: (rows) => rows.map((row) => ({ ...row })) };
global.BancaTrackerLiveHierarchyAuthority = { async loadContext(repository, base) { authorityCounts.hierarchyLoad += 1; return base; }, getCachedContext: () => context, applyRecords: (rows) => rows.map((row) => ({ ...row })) };
global.BancaTrackerLiveGeographyAuthority = { async loadContext(repository, base) { authorityCounts.geographyLoad += 1; return base; }, getCachedContext: () => context, applyRecords: (rows) => rows.map((row) => ({ ...row })) };
global.BancaTrackerLiveBranchCommercialAuthority = { async loadContext() { authorityCounts.commercialLoad += 1; }, getCachedContext: () => null };
global.BancaTrackerLiveBranchUniverseAuthority = { getUniverse: () => context.branchUniverse };
let shadowCalls = 0;
global.BancaTrackerShadowEnrichment = { run() { shadowCalls += 1; return Promise.resolve({ status: "READY" }); } };
load("js/core.js");

const H = "USGI NET PREMIUM,Month,INTERMEDIARY,BA NAME,Ba Code,LINE OF BUSINESS,BRANCH NAME,Zone,STATE,SUM IMD CODE,Day,POLICY ISSUED DATE";
const textBytes = (text) => new TextEncoder().encode(text);
function fakeFile(name, text, options = {}) {
  const bytes = textBytes(text); return {
    name, size: bytes.byteLength, lastModified: options.lastModified || 1,
    async arrayBuffer() { events.push(`read:start:${name}`); activeWork += 1; maxActiveWork = Math.max(maxActiveWork, activeWork); await new Promise((resolve) => setImmediate(resolve)); activeWork -= 1; events.push(`read:end:${name}`); if (options.readFailure) throw new Error("forced read failure"); return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength); },
  };
}
const row = (premium, month, branch, date = "01/04/2026", rm = "RM One") => `${premium},${month},INDIAN BANK,${rm},A1,Motor,${branch},South,Tamil Nadu,I1,1,${date}`;
const file = (name, rows, header = H, options) => fakeFile(name, [header, ...rows].join("\n"), options);
const settle = () => new Promise((resolve) => setImmediate(resolve));
const runtimeFields = ["factData", "filteredData", "filters", "headerMap", "months", "banks", "importSummary", "dataQuality", "context", "derived", "productivity", "commercialPerformance", "commercialRollup", "branchUniverseAuthority"];
const snapshot = () => Object.fromEntries(runtimeFields.map((field) => [field, BancaTrackerCore.state[field]]));
const assertSnapshot = (before) => runtimeFields.forEach((field) => assert.strictEqual(BancaTrackerCore.state[field], before[field], field));
const resetCounters = () => { events.length = 0; activeWork = 0; maxActiveWork = 0; workerRuns = 0; Object.keys(authorityCounts).forEach((key) => { authorityCounts[key] = 0; }); };

(async () => {
  // T33: programmatic compatibility remains available and establishes prior active state.
  assert.ok(BancaTrackerCore.loadCsvText(`${H}\n${row(99, "Apr-26", "Prior")}`));
  await settle(); const prior = snapshot(); const priorShadow = shadowCalls;

  // T1/T31: one browser-selected file follows the batch path and resets its input.
  resetCounters(); const input = new Element();
  const single = await BancaTrackerCore.handleFiles([file("single.csv", [row(100, "Apr-26", "Single")])], input);
  assert.ok(single); assert.strictEqual(BancaTrackerCore.state.factData.length, 1); assert.strictEqual(BancaTrackerCore.state.derived.totalPremium, 100);
  assert.strictEqual(BancaTrackerCore.state.importSummary.batch.fileCount, 1); assert.strictEqual(input.value, ""); await settle();

  // T2/T3/T13-T22/T26-T28: combined totals, order, one preparation/activation/projection/shadow, provenance, signed and mixed-FY facts.
  resetCounters(); const shadowBefore = shadowCalls;
  let activeFacts = BancaTrackerCore.state.factData; let activationCount = 0;
  Object.defineProperty(BancaTrackerCore.state, "factData", { configurable: true, get() { return activeFacts; }, set(value) { activationCount += 1; activeFacts = value; } });
  let summaryText = elements.importSummary.textContent; let projectionCount = 0;
  Object.defineProperty(elements.importSummary, "textContent", { configurable: true, get() { return summaryText; }, set(value) { projectionCount += 1; summaryText = value; } });
  const a = file("a.csv", [row(10, "Apr-25", "A1", "01/04/2025"), row(-2, "Apr-25", "A2", "02/04/2025")]);
  const b = file("b.csv", ["bad,Apr-26,INDIAN BANK,RM,A1,Motor,Bad,South,Tamil Nadu,I1,1,01/04/2026", row(20, "Apr-26", "B1")]);
  const c = file("c.csv", [row(30, "May-26", "C1", "01/05/2026", "")]);
  const combined = await BancaTrackerCore.handleFiles([a, b, c], new Element());
  assert.ok(combined); assert.deepStrictEqual(BancaTrackerCore.state.factData.map((item) => item.branch), ["A1", "A2", "B1", "C1"]);
  assert.deepStrictEqual(BancaTrackerCore.state.factData.map((item) => item.financialYear), ["FY2025-26", "FY2025-26", "FY2026-27", "FY2026-27"]);
  const summary = BancaTrackerCore.state.importSummary; assert.deepStrictEqual([summary.totalRows, summary.acceptedRows, summary.rejectedRows, summary.warningRows, summary.negativePremiumRows], [5, 4, 1, 1, 1]);
  assert.strictEqual(summary.rejectionReasons["Invalid premium"], 1); assert.strictEqual(summary.warningReasons["Missing BA NAME"], 1); assert.strictEqual(summary.acceptedRows, BancaTrackerCore.state.factData.length);
  assert.deepStrictEqual(summary.batch.files.map((item) => item.filename), ["a.csv", "b.csv", "c.csv"]); assert.deepStrictEqual(summary.batch.files.map((item) => item.selectionIndex), [0, 1, 2]);
  assert.deepStrictEqual(summary.batch.observedMonths, ["Apr-25", "Apr-26", "May-26"]); assert.strictEqual(summary.batch.importMode, "REPLACE"); assert.strictEqual(summary.batch.status, "COMMITTED");
  assert.strictEqual(authorityCounts.branchLoad, 1); assert.strictEqual(authorityCounts.assignmentLoad, 1); assert.strictEqual(authorityCounts.hierarchyLoad, 1); assert.strictEqual(authorityCounts.geographyLoad, 1); assert.strictEqual(authorityCounts.commercialLoad, 1); assert.strictEqual(authorityCounts.branchApply, 1);
  assert.strictEqual(activationCount, 1); assert.strictEqual(projectionCount, 1);
  Object.defineProperty(BancaTrackerCore.state, "factData", { configurable: true, writable: true, value: activeFacts });
  Object.defineProperty(elements.importSummary, "textContent", { configurable: true, writable: true, value: summaryText });
  assert.strictEqual(workerRuns, 3); assert.strictEqual(maxActiveWork, 1); await settle(); assert.strictEqual(shadowCalls, shadowBefore + 1);

  // T4/T18/T34: next file starts only after the prior parser completes.
  const parseEnds = events.map((item, index) => item === "parse:end" ? index : -1).filter((index) => index >= 0);
  assert.ok(parseEnds[0] < events.indexOf("read:start:b.csv"));
  assert.ok(parseEnds[1] < events.indexOf("read:start:c.csv"));

  // T25: identical business rows in different non-identical files remain present.
  const duplicateRow = row(7, "Apr-26", "Repeated");
  await BancaTrackerCore.handleFiles([file("r1.csv", [duplicateRow]), file("r2.csv", [duplicateRow, ""] )], new Element());
  assert.strictEqual(BancaTrackerCore.state.factData.length, 2); assert.strictEqual(BancaTrackerCore.state.dataQuality.duplicateSignals, 1);

  async function expectBatchFailure(files, pattern) {
    const before = snapshot(); const beforeShadow = shadowCalls; const failedInput = new Element(); resetCounters();
    const result = await BancaTrackerCore.handleFiles(files, failedInput); assert.strictEqual(result, null); assert.match(elements.status.textContent, pattern); assertSnapshot(before); assert.strictEqual(failedInput.value, ""); await settle(); assert.strictEqual(shadowCalls, beforeShadow); assert.strictEqual(authorityCounts.branchLoad, 0);
  }

  // T5-T8/T12/T23/T29/T32: later failures and duplicate content preserve runtime/provenance and do not load authorities.
  const stableProvenance = BancaTrackerCore.state.importSummary.batch;
  await expectBatchFailure([file("valid.csv", [row(1, "Apr-26", "Valid")]), fakeFile("invalid.csv", "bad,headers\n1,2")], /invalid\.csv/i);
  assert.strictEqual(BancaTrackerCore.state.importSummary.batch, stableProvenance);
  const same = file("same.csv", [row(1, "Apr-26", "Same")]); await expectBatchFailure([same, same], /same\.csv and same\.csv/i);
  await expectBatchFailure([file("left.csv", [row(2, "Apr-26", "Same bytes")]), file("renamed.csv", [row(2, "Apr-26", "Same bytes")])], /left\.csv and renamed\.csv/i);

  // T9: equal names with different bytes are allowed.
  assert.ok(await BancaTrackerCore.handleFiles([file("same-name.csv", [row(1, "Apr-26", "One")]), file("same-name.csv", [row(2, "Apr-26", "Two")])], new Element()));

  // T10/T11: reordered/case/whitespace headers and the approved date alias remain compatible.
  const reordered = " Month ,usgi net premium,INTERMEDIARY,BA NAME,Ba Code,LINE OF BUSINESS,BRANCH NAME,POLICY ISSUE DATE";
  const reorderedRow = "Apr-26,5,INDIAN BANK,RM,A1,Motor,Reordered,01/04/2026";
  assert.ok(await BancaTrackerCore.handleFiles([file("normal.csv", [row(4, "Apr-26", "Normal")]), fakeFile("reordered.csv", `${reordered}\n${reorderedRow}`)], new Element()));
  assert.deepStrictEqual(BancaTrackerCore.state.factData.map((item) => item.premium), [4, 5]);

  // T24: a later batch replaces rather than appends.
  assert.ok(await BancaTrackerCore.handleFiles([file("replacement.csv", [row(777, "Jun-26", "Replacement")])], new Element()));
  assert.deepStrictEqual(BancaTrackerCore.state.factData.map((item) => item.premium), [777]);

  // T30: no repository/persistence dependency is introduced in this focused runtime.
  assert.strictEqual(global.BancaTrackerRepository, undefined);
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8"); assert.match(html, /id="csvFile" accept="\.csv" multiple/);
  assert.notStrictEqual(BancaTrackerCore.state.factData, prior.factData); assert.ok(shadowCalls > priorShadow);

  console.log("Candidate v8.6.5 multi-file PR batch tests passed: sequential hashing/parsing, duplicate blocking, semantic compatibility, reconciled provenance, atomic failure, REPLACE, mixed FY, and single-file compatibility.");
})().catch((error) => { console.error(error); process.exit(1); });
