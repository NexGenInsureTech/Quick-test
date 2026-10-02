/* Candidate v8.6.4 Sprint 0: prepared-runtime atomic import guard. */
const assert = require("assert");
const path = require("path");

class Element {
  constructor() {
    this.value = ""; this._innerHTML = ""; this.textContent = ""; this.style = {};
    this.classList = { toggle() {} }; this.failProjection = false;
  }
  set innerHTML(value) { if (this.failProjection) throw new Error("Forced projection failure"); this._innerHTML = value; }
  get innerHTML() { return this._innerHTML; }
  addEventListener() {}
  add() {}
}

const elements = {};
global.window = global;
global.document = { getElementById(id) { return elements[id] || (elements[id] = new Element()); } };
global.Option = class { constructor(text, value) { this.text = text; this.value = value; } };
global.performance = require("perf_hooks").performance;
global.sessionStorage = { getItem() { return null; }, setItem() {} };

const load = (file) => require(path.join(__dirname, "..", file));
[
  "js/config.js", "js/csvProcessor.js", "js/utilities.js", "js/analytics.js",
  "js/dataQuality.js", "js/productivity.js", "js/analytics/commercialPerformance.js",
  "js/analytics/commercialRollups.js",
].forEach(load);

const universes = {
  old: Object.freeze({ authority: "LEGACY_FALLBACK", marker: "OLD" }),
  candidate: Object.freeze({ authority: "GOVERNED", marker: "CANDIDATE" }),
};
let authorityContext = { branchUniverse: universes.old };
const passthrough = () => ({ getCachedContext: () => authorityContext, applyRecords: (records) => records.map((row) => ({ ...row })) });
global.BancaTrackerLiveBranchAuthority = passthrough();
global.BancaTrackerLiveAssignmentAuthority = passthrough();
global.BancaTrackerLiveHierarchyAuthority = passthrough();
global.BancaTrackerLiveGeographyAuthority = passthrough();
global.BancaTrackerLiveBranchUniverseAuthority = { getUniverse: () => authorityContext.branchUniverse };
global.BancaTrackerLiveBranchCommercialAuthority = { getCachedContext: () => null };

global.BancaTrackerDateResolver = {
  resolve(value) {
    const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
    if (!match) return { success: false, error: "DATE_FORMAT_UNSUPPORTED" };
    const day = Number(match[1]); const month = Number(match[2]); const year = Number(match[3]);
    const monthLabel = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][month - 1];
    const startYear = month >= 4 ? year : year - 1;
    return { success: true, day, month, year, monthLabel: `${monthLabel}-${String(year).slice(-2)}`, monthKey: `${year}-${String(month).padStart(2, "0")}`, financialYear: `FY${startYear}-${String(startYear + 1).slice(-2)}` };
  },
};

let shadowCalls = 0;
global.BancaTrackerShadowEnrichment = { run() { shadowCalls += 1; return Promise.resolve({ status: "READY" }); } };
load("js/core.js");

const H = "USGI NET PREMIUM,Month,INTERMEDIARY,BA NAME,Ba Code,LINE OF BUSINESS,BRANCH NAME,Zone,STATE,SUM IMD CODE,Day,POLICY ISSUED DATE";
const csv = (premium, month, date, branch = "Branch One") => `${H}\n${premium},${month},INDIAN BANK,RM One,A1,Motor,${branch},South,Tamil Nadu,I1,1,${date}`;
const runtimeFields = ["factData", "filteredData", "filters", "headerMap", "months", "banks", "importSummary", "dataQuality", "context", "derived", "productivity", "commercialPerformance", "commercialRollup", "branchUniverseAuthority"];
const snapshot = () => Object.fromEntries(runtimeFields.map((field) => [field, BancaTrackerCore.state[field]]));
const assertSnapshot = (before, label) => runtimeFields.forEach((field) => assert.strictEqual(BancaTrackerCore.state[field], before[field], `${label}: ${field}`));
const settle = () => new Promise((resolve) => setImmediate(resolve));

(async () => {
  // T1/T14/T19/T20: successful legacy behavior, analytics, signed premium, and canonical FY.
  const first = BancaTrackerCore.loadCsvText(`${H}\n100,Apr-26,INDIAN BANK,RM One,A1,Motor,Branch One,South,Tamil Nadu,I1,1,01/04/2026\n-25,Apr-26,INDIAN BANK,RM One,A1,Motor,Branch One,South,Tamil Nadu,I1,1,01/04/2026`);
  assert.ok(first);
  assert.strictEqual(BancaTrackerCore.state.factData.length, 2);
  assert.strictEqual(BancaTrackerCore.state.derived.totalPremium, 75);
  assert.deepStrictEqual(BancaTrackerCore.state.filters, { month: "ALL", bank: "ALL" });
  assert.deepStrictEqual(BancaTrackerCore.state.months, ["Apr-26"]);
  assert.strictEqual(BancaTrackerCore.state.importSummary.negativePremiumRows, 1);
  assert.strictEqual(BancaTrackerCore.state.dataQuality.premium.negativeRows, 1);
  assert.strictEqual(BancaTrackerCore.state.factData[0].financialYear, "FY2026-27");
  await settle();
  assert.strictEqual(shadowCalls, 1);

  async function expectPreparationFailure(label, install, restore) {
    const before = snapshot(); const beforeShadow = shadowCalls;
    install();
    const result = BancaTrackerCore.loadCsvText(csv(200, "Apr-26", "01/04/2026", `${label} Branch`));
    restore();
    assert.strictEqual(result, null, label);
    assertSnapshot(before, label);
    await settle();
    assert.strictEqual(shadowCalls, beforeShadow, `${label}: shadow must not run`);
  }

  // T2: date failure.
  const realDateResolver = global.BancaTrackerDateResolver;
  await expectPreparationFailure("date", () => { global.BancaTrackerDateResolver = { resolve() { throw new Error("Forced date failure"); } }; }, () => { global.BancaTrackerDateResolver = realDateResolver; });

  // T3-T6/T8: every enrichment stage sees old facts and preserves the runtime on failure.
  for (const [label, name] of [["branch", "BancaTrackerLiveBranchAuthority"], ["assignment", "BancaTrackerLiveAssignmentAuthority"], ["hierarchy", "BancaTrackerLiveHierarchyAuthority"], ["geography", "BancaTrackerLiveGeographyAuthority"]]) {
    const real = global[name];
    await expectPreparationFailure(label, () => {
      global[name] = { ...real, applyRecords() { assert.strictEqual(BancaTrackerCore.state.factData.length, 2); throw new Error(`Forced ${label} failure`); } };
    }, () => { global[name] = real; });
  }

  // T7: a candidate branch universe remains local when a later preparation stage fails.
  const universeBefore = BancaTrackerCore.state.branchUniverseAuthority;
  const realAssignment = global.BancaTrackerLiveAssignmentAuthority;
  authorityContext = { branchUniverse: universes.candidate };
  await expectPreparationFailure("candidate universe", () => {
    global.BancaTrackerLiveAssignmentAuthority = { ...realAssignment, applyRecords() { throw new Error("Forced later failure"); } };
  }, () => { global.BancaTrackerLiveAssignmentAuthority = realAssignment; authorityContext = { branchUniverse: universes.old }; });
  assert.strictEqual(BancaTrackerCore.state.branchUniverseAuthority, universeBefore);

  // T9: data-quality preparation failure is atomic.
  const realQuality = global.BancaTrackerDataQuality;
  await expectPreparationFailure("data quality", () => { global.BancaTrackerDataQuality = { ...realQuality, build() { throw new Error("Forced quality failure"); } }; }, () => { global.BancaTrackerDataQuality = realQuality; });

  // T10: synchronous analytical calculation failure is atomic.
  const realAnalytics = global.BancaTrackerAnalytics;
  await expectPreparationFailure("analytics", () => { global.BancaTrackerAnalytics = { ...realAnalytics, build() { throw new Error("Forced analytics failure"); } }; }, () => { global.BancaTrackerAnalytics = realAnalytics; });

  // T11/T13: projection failure occurs after activation and shadow still runs once.
  const beforeProjectionShadow = shadowCalls;
  elements.monthFilter.failProjection = true;
  const projected = BancaTrackerCore.loadCsvText(csv(300, "Apr-26", "01/04/2026", "Projected Branch"));
  elements.monthFilter.failProjection = false;
  assert.ok(projected);
  assert.strictEqual(BancaTrackerCore.state.factData.length, 1);
  assert.strictEqual(BancaTrackerCore.state.factData[0].premium, 300);
  assert.match(elements.status.textContent, /activated, but the screen could not fully refresh/i);
  await settle();
  assert.strictEqual(shadowCalls, beforeProjectionShadow + 1);

  // T12/T15/T17: a valid import recovers and replaces rather than appends.
  const replacement = BancaTrackerCore.loadCsvText(csv(450, "May-26", "01/05/2026", "Replacement Branch"));
  assert.ok(replacement);
  assert.strictEqual(BancaTrackerCore.state.factData.length, 1);
  assert.strictEqual(BancaTrackerCore.state.factData[0].premium, 450);
  assert.strictEqual(BancaTrackerCore.state.derived.totalPremium, 450);
  assert.deepStrictEqual(BancaTrackerCore.state.months, ["May-26"]);
  assert.ok(!BancaTrackerCore.state.factData.some((row) => row.premium === 300));
  await settle();

  // T18: Sprint 0 introduced no fact persistence; later ingestion features preserve that boundary.
  assert.strictEqual(global.BancaTrackerRepository, undefined);

  console.log("Candidate v8.6.4 atomic import guard tests passed: prepared-runtime failures preserve active state, projection failures remain recoverable, successful imports replace, and shadow execution remains post-activation.");
})().catch((error) => { console.error(error); process.exit(1); });
