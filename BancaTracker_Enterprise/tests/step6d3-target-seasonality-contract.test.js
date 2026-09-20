/* Step 6D.3: executable contract for the future pure Target Seasonality authority. */
"use strict";

const assert = require("assert");
const path = require("path");

/*
 * Future pure boundary (no DOM, storage, Core, Target state, PR, or Commercial input):
 *
 * BancaTrackerTargetSeasonality.resolve({ records, fiscalYear, bank?, fiscalMonths? })
 *   => { status, fiscalYear, scope, weightsByMonth, diagnostics }
 *
 * Each synthetic record is:
 * { fiscalYear, scopeType: "OVERALL" | "BANK", canonicalBank?, monthKey, weight }
 *
 * This test deliberately remains unregistered until Step 6D.4 supplies the authority.
 */
require(path.join(__dirname, "..", "js", "targetSeasonality.js"));
const Authority = global.BancaTrackerTargetSeasonality || {};
const FY = "FY2026-27";
const NEXT_FY = "FY2027-28";
const MONTHS = [
  "2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09",
  "2026-10", "2026-11", "2026-12", "2027-01", "2027-02", "2027-03",
];
const TOLERANCE = 1e-9;

function record(fiscalYear, scopeType, monthKey, weight, canonicalBank) {
  return { fiscalYear, scopeType, monthKey, weight, ...(canonicalBank ? { canonicalBank } : {}) };
}

function curve(fiscalYear, scopeType, weights, canonicalBank) {
  return MONTHS.map((monthKey, index) => record(fiscalYear, scopeType, monthKey, weights[index], canonicalBank));
}

function equalWeights() { return MONTHS.map(() => 1 / 12); }
function fiscalMonthsFor(fiscalYear) {
  const match = /^FY(\d{4})-(\d{2})$/.exec(fiscalYear);
  if (!match) return MONTHS;
  const startYear = Number(match[1]);
  return [
    `${startYear}-04`, `${startYear}-05`, `${startYear}-06`, `${startYear}-07`, `${startYear}-08`, `${startYear}-09`,
    `${startYear}-10`, `${startYear}-11`, `${startYear}-12`, `${startYear + 1}-01`, `${startYear + 1}-02`, `${startYear + 1}-03`,
  ];
}
function resolve(records, fiscalYear = FY, bank) {
  return Authority.resolve({ records, fiscalYear, ...(bank ? { bank } : {}), fiscalMonths: fiscalMonthsFor(fiscalYear) });
}
function sum(weightsByMonth, months) { return months.reduce((total, month) => total + weightsByMonth[month], 0); }
function assertApprox(actual, expected, message) {
  assert.ok(Math.abs(actual - expected) <= TOLERANCE, `${message || "values differ"}: expected ${expected}, received ${actual}`);
}
function assertDiagnostics(result, fiscalYear, scope, bank) {
  assert.ok(result.diagnostics && typeof result.diagnostics === "object", "resolution must include diagnostics");
  assert.strictEqual(result.diagnostics.requestedFiscalYear, fiscalYear);
  assert.strictEqual(result.diagnostics.requestedScope, scope);
  assert.strictEqual(result.diagnostics.requestedBank || null, bank || null);
  ["recordsConsidered", "applicableRecords", "missingMonths", "duplicateMonths", "invalidWeights", "weightSum", "resolutionPath"].forEach((key) => {
    assert.ok(Object.prototype.hasOwnProperty.call(result.diagnostics, key), `diagnostics must include ${key}`);
  });
}
function assertValid(result, status, fiscalYear = FY, bank) {
  const fiscalMonths = fiscalMonthsFor(fiscalYear);
  assert.strictEqual(result.status, status);
  assert.strictEqual(result.fiscalYear, fiscalYear);
  assert.strictEqual(result.scope, bank || "OVERALL");
  assert.deepStrictEqual(Object.keys(result.weightsByMonth), fiscalMonths);
  assertApprox(sum(result.weightsByMonth, fiscalMonths), 1, "resolved weights must reconcile to one");
  assertDiagnostics(result, fiscalYear, bank ? "BANK" : "OVERALL", bank);
}
function assertInvalid(result, fiscalYear = FY, bank) {
  assert.strictEqual(result.status, "INVALID");
  assert.strictEqual(result.weightsByMonth, null, "invalid governed input must not present valid or fallback weights");
  assertDiagnostics(result, fiscalYear, bank ? "BANK" : "OVERALL", bank);
}

// Intentional current failure: Step 6D.4 must expose this pure, dependency-free resolver.
assert.strictEqual(
  typeof Authority.resolve,
  "function",
  "CONTRACT GAP: Step 6D.4 must expose BancaTrackerTargetSeasonality.resolve as a pure FY/month weight resolver.",
);

// S01 — no configuration: exact 1/12 compatibility fallback, not display-rounded 0.0833.
{
  const result = resolve([]);
  assertValid(result, "EQUAL_MONTH_FALLBACK");
  MONTHS.forEach((month) => assertApprox(result.weightsByMonth[month], 1 / 12, `${month} fallback weight`));
}

const overallWeights = [0.05, 0.06, 0.07, 0.08, 0.09, 0.10, 0.11, 0.10, 0.09, 0.08, 0.09, 0.08];
const overall = curve(FY, "OVERALL", overallWeights);

// S02 — governed Overall values are retained at calculation precision.
{
  const result = resolve(overall);
  assertValid(result, "GOVERNED_OVERALL");
  MONTHS.forEach((month, index) => assert.strictEqual(result.weightsByMonth[month], overallWeights[index]));
}

// S03/S04 — Bank curve overrides; without it a Bank inherits governed Overall.
{
  const bankWeights = [0.10, 0.09, 0.08, 0.07, 0.06, 0.05, 0.04, 0.05, 0.06, 0.10, 0.14, 0.16];
  const records = overall.concat(curve(FY, "BANK", bankWeights, "INDIAN BANK"));
  const override = resolve(records, FY, "INDIAN BANK");
  assertValid(override, "GOVERNED_BANK", FY, "INDIAN BANK");
  MONTHS.forEach((month, index) => assert.strictEqual(override.weightsByMonth[month], bankWeights[index]));
  assert.strictEqual(override.diagnostics.resolutionPath, "BANK");

  const inherited = resolve(overall, FY, "OTHER BANK");
  assertValid(inherited, "GOVERNED_OVERALL", FY, "OTHER BANK");
  assert.strictEqual(inherited.diagnostics.resolutionPath, "OVERALL_INHERITED");
}

// S05 — a Bank receives equal fallback only when both applicable curves are absent.
{
  const result = resolve([], FY, "INDIAN BANK");
  assertValid(result, "EQUAL_MONTH_FALLBACK", FY, "INDIAN BANK");
  MONTHS.forEach((month) => assertApprox(result.weightsByMonth[month], 1 / 12));
}

// S06 — an explicit zero is governed, not replaced with a positive minimum.
{
  const zeroMonth = [0, 0.10, 0.10, 0.10, 0.10, 0.10, 0.10, 0.10, 0.10, 0.10, 0.05, 0.05];
  const result = resolve(curve(FY, "OVERALL", zeroMonth));
  assertValid(result, "GOVERNED_OVERALL");
  assert.strictEqual(result.weightsByMonth["2026-04"], 0);
}

// S07/S13/S14 — invalid numeric-domain values never produce a valid allocation.
[
  ["negative", -0.01],
  ["above one", 1.01],
  ["NaN", Number.NaN],
  ["infinity", Number.POSITIVE_INFINITY],
  ["non-numeric", "0.05"],
].forEach(([label, value]) => {
  const weights = equalWeights();
  weights[0] = value;
  const result = resolve(curve(FY, "OVERALL", weights));
  assertInvalid(result);
  assert.ok(result.diagnostics.invalidWeights.length > 0, `${label} must be diagnosed as invalid`);
});

// S08/S09/S15 — incomplete, duplicate, and out-of-FY month identities invalidate the whole curve.
{
  assertInvalid(resolve(overall.slice(0, 11)));

  const duplicate = overall.concat(record(FY, "OVERALL", "2026-04", 0));
  assertInvalid(resolve(duplicate));

  const unknownMonth = overall.map((item, index) => index === 11 ? { ...item, monthKey: "2027-04" } : item);
  assertInvalid(resolve(unknownMonth));
}

// S10/S11/S12 — only a tiny machine-precision variance is permitted.
{
  const below = equalWeights(); below[0] -= 0.01;
  assertInvalid(resolve(curve(FY, "OVERALL", below)));

  const above = equalWeights(); above[0] += 0.01;
  assertInvalid(resolve(curve(FY, "OVERALL", above)));

  const tinyVariance = equalWeights(); tinyVariance[0] += 5e-10;
  const result = resolve(curve(FY, "OVERALL", tinyVariance));
  assertValid(result, "GOVERNED_OVERALL");
}

// S16/S17 — fiscal-year isolation and unsupported FY are not silently remapped.
{
  const isolated = resolve(overall, NEXT_FY);
  assertValid(isolated, "EQUAL_MONTH_FALLBACK", NEXT_FY);

  const unsupported = resolve(overall, "FY-not-a-year");
  assert.strictEqual(unsupported.status, "UNAVAILABLE");
  assert.strictEqual(unsupported.weightsByMonth, null);
  assertDiagnostics(unsupported, "FY-not-a-year", "OVERALL");
}

// S18/S23 — canonical Bank is exact: no alias, parent, scheme, or cross-Bank inference.
{
  const bankOnly = curve(FY, "BANK", [0.10, 0.09, 0.08, 0.07, 0.06, 0.05, 0.04, 0.05, 0.06, 0.10, 0.14, 0.16], "INDIAN BANK");
  const other = resolve(bankOnly, FY, "INDIAN BANK (PMSBY)");
  assertValid(other, "EQUAL_MONTH_FALLBACK", FY, "INDIAN BANK (PMSBY)");
}

// S19/S20/S21 — an explicitly applicable invalid curve fails closed, ahead of inheritance/fallback.
{
  const invalidBank = curve(FY, "BANK", equalWeights().map((value, index) => index === 0 ? -0.01 : value), "INDIAN BANK");
  assertInvalid(resolve(overall.concat(invalidBank), FY, "INDIAN BANK"), FY, "INDIAN BANK");

  const invalidOverall = curve(FY, "OVERALL", equalWeights().map((value, index) => index === 0 ? -0.01 : value));
  assertInvalid(resolve(invalidOverall));
  assertInvalid(resolve(invalidOverall, FY, "INDIAN BANK"), FY, "INDIAN BANK");
}

// S22 — conflicting ownership (two complete curves for the same FY/scope) is invalid, never last-write-wins.
{
  const alternate = curve(FY, "OVERALL", [0.08, 0.08, 0.08, 0.08, 0.08, 0.08, 0.08, 0.08, 0.08, 0.08, 0.10, 0.10]);
  assertInvalid(resolve(overall.concat(alternate)));
}

// S24 — record ordering cannot affect resolution, provenance, or order-independent diagnostics.
{
  const forward = resolve(overall, FY, "OTHER BANK");
  const reverse = resolve(overall.slice().reverse(), FY, "OTHER BANK");
  assert.deepStrictEqual(
    { status: reverse.status, weightsByMonth: reverse.weightsByMonth, diagnostics: reverse.diagnostics },
    { status: forward.status, weightsByMonth: forward.weightsByMonth, diagnostics: forward.diagnostics },
  );
}

// S25 — this contract calls only the pure resolver with synthetic records. It imports no
// DOM, storage, Core/Target state, PR facts, Commercial Performance, or Budget/Potential.
// Monetary Target, YTD Target, Actual, Achievement, Gap, RRR, persistence, Scorecard, and UI
// are intentionally excluded from Step 6D.3.

console.log("Step 6D.3 Target Seasonality pure-authority contract tests passed.");
