const assert = require("assert");
const path = require("path");
const { spawnSync } = require("child_process");
global.window = global;
const root = path.join(__dirname, "..");
require(path.join(root, "js/enrichment/dateResolver.js"));
require(path.join(root, "js/analytics/policyTenure.js"));

const classify = (overrides) => BancaTrackerPolicyTenure.classifyPolicyTenure({
  startDate: "01/01/2026", endDate: "31/12/2026", endDateConvention: "INCLUSIVE", ...overrides,
});
const emptyResult = (status, classification, diagnosticCodes) => ({
  status, classification, normalizedStartDate: null, normalizedEndDate: null,
  coverageEndExclusive: null, durationDays: null, exactCalendarYears: null, diagnosticCodes,
});
const invalidStartTypeResult = () => ({
  status: "INVALID", classification: "INVALID", normalizedStartDate: null,
  normalizedEndDate: "2026-12-31", coverageEndExclusive: null, durationDays: null,
  exactCalendarYears: null, diagnosticCodes: ["START_DATE_TYPE_UNSUPPORTED"],
});
function expectClass(overrides, expected, years) {
  const actual = classify(overrides);
  assert.strictEqual(actual.status, "SUCCESS");
  assert.strictEqual(actual.classification, expected);
  assert.strictEqual(actual.exactCalendarYears, years == null ? null : years);
  assert.deepStrictEqual(actual.diagnosticCodes, []);
  return actual;
}

expectClass({ endDate: "30/06/2026" }, "SHORT_TERM");
let actual = expectClass({}, "ANNUAL", 1);
assert.deepStrictEqual(actual, {
  status: "SUCCESS", classification: "ANNUAL", normalizedStartDate: "2026-01-01",
  normalizedEndDate: "2026-12-31", coverageEndExclusive: "2027-01-01",
  durationDays: 365, exactCalendarYears: 1, diagnosticCodes: [],
});
actual = expectClass({ endDate: "01/01/2027", endDateConvention: "EXCLUSIVE" }, "ANNUAL", 1);
assert.strictEqual(actual.coverageEndExclusive, "2027-01-01");
assert.strictEqual(actual.durationDays, 365);
expectClass({ endDate: "31/12/2027" }, "LONG_TERM_2_YEARS", 2);
expectClass({ endDate: "31/12/2028" }, "LONG_TERM_3_YEARS", 3);
expectClass({ endDate: "31/12/2029" }, "LONG_TERM_4_TO_5_YEARS", 4);
expectClass({ endDate: "31/12/2030" }, "LONG_TERM_4_TO_5_YEARS", 5);
expectClass({ endDate: "31/12/2031" }, "LONG_TERM_OVER_5_YEARS", 6);
actual = expectClass({ endDate: "02/01/2031", endDateConvention: "EXCLUSIVE" }, "LONG_TERM_OVER_5_YEARS");
assert.strictEqual(actual.exactCalendarYears, null);
expectClass({ endDate: "30/06/2027" }, "NON_STANDARD_TERM");
actual = expectClass({ startDate: "01/03/2019", endDate: "29/02/2020" }, "ANNUAL", 1);
assert.strictEqual(actual.durationDays, 366);

expectClass({ startDate: "29/02/2024", endDate: "27/02/2025", leapDayAnniversaryConvention: "FEB_28" }, "ANNUAL", 1);
expectClass({ startDate: "29/02/2024", endDate: "28/02/2025", leapDayAnniversaryConvention: "MAR_01" }, "ANNUAL", 1);
expectClass({ startDate: "29/02/2024", endDate: "28/02/2025", endDateConvention: "EXCLUSIVE", leapDayAnniversaryConvention: "FEB_28" }, "ANNUAL", 1);
expectClass({ startDate: "29/02/2024", endDate: "28/02/2025", endDateConvention: "EXCLUSIVE", leapDayAnniversaryConvention: "MAR_01" }, "SHORT_TERM");
expectClass({ startDate: "29/02/2024", endDate: "01/03/2025", endDateConvention: "EXCLUSIVE", leapDayAnniversaryConvention: "FEB_28" }, "NON_STANDARD_TERM");
expectClass({ startDate: "29/02/2024", endDate: "01/03/2025", endDateConvention: "EXCLUSIVE", leapDayAnniversaryConvention: "MAR_01" }, "ANNUAL", 1);
actual = classify({ startDate: "29/02/2024", endDate: "28/02/2025", endDateConvention: "EXCLUSIVE" });
assert.strictEqual(actual.status, "UNKNOWN"); assert.strictEqual(actual.classification, "UNKNOWN");
assert.deepStrictEqual(actual.diagnosticCodes, ["LEAP_DAY_ANNIVERSARY_CONVENTION_REQUIRED"]);
actual = classify({ startDate: "29/02/2024", endDate: "01/03/2025", endDateConvention: "EXCLUSIVE" });
assert.strictEqual(actual.status, "UNKNOWN"); assert.strictEqual(actual.classification, "UNKNOWN");
assert.deepStrictEqual(actual.diagnosticCodes, ["LEAP_DAY_ANNIVERSARY_CONVENTION_REQUIRED"]);
expectClass({ startDate: "29/02/2024", endDate: "01/06/2024", endDateConvention: "EXCLUSIVE" }, "SHORT_TERM");

actual = classify({ startDate: "" });
assert.strictEqual(actual.status, "UNKNOWN"); assert.strictEqual(actual.classification, "UNKNOWN");
assert.deepStrictEqual(actual.diagnosticCodes, ["START_DATE_MISSING"]);
actual = classify({ startDate: null, endDate: undefined });
assert.deepStrictEqual(actual, emptyResult("UNKNOWN", "UNKNOWN", ["START_DATE_MISSING", "END_DATE_MISSING"]));
actual = classify({ endDate: "31/04/2026" });
assert.strictEqual(actual.status, "INVALID"); assert.strictEqual(actual.classification, "INVALID");
assert.deepStrictEqual(actual.diagnosticCodes, ["END_DATE_INVALID"]);
actual = classify({ endDate: "31/12/2025" });
assert.strictEqual(actual.status, "INVALID"); assert.strictEqual(actual.classification, "INVALID");
assert.deepStrictEqual(actual.diagnosticCodes, ["END_DATE_BEFORE_START_DATE"]);
actual = classify({ endDate: "01/01/2026", endDateConvention: "EXCLUSIVE" });
assert.strictEqual(actual.status, "INVALID"); assert.strictEqual(actual.classification, "INVALID");
assert.deepStrictEqual(actual.diagnosticCodes, ["NON_POSITIVE_COVERAGE_DURATION"]);
actual = classify({ endDateConvention: undefined });
assert.strictEqual(actual.status, "UNKNOWN"); assert.strictEqual(actual.classification, "UNKNOWN");
assert.deepStrictEqual(actual.diagnosticCodes, ["END_DATE_CONVENTION_MISSING"]);
actual = classify({ endDateConvention: "OTHER" });
assert.strictEqual(actual.status, "INVALID"); assert.strictEqual(actual.classification, "INVALID");
assert.deepStrictEqual(actual.diagnosticCodes, ["END_DATE_CONVENTION_INVALID"]);
actual = classify({ startDate: "29/02/2024", endDate: "28/02/2025", leapDayAnniversaryConvention: "OTHER" });
assert.strictEqual(actual.status, "INVALID"); assert.strictEqual(actual.classification, "INVALID");
assert.deepStrictEqual(actual.diagnosticCodes, ["LEAP_DAY_ANNIVERSARY_CONVENTION_INVALID"]);

for (const value of [new Date("2026-01-01T00:30:00Z"), 1767225600000, {}, []]) {
  actual = classify({ startDate: value });
  assert.deepStrictEqual(actual, invalidStartTypeResult());
}
actual = classify({ endDate: new Date("2026-12-31T23:30:00Z") });
assert.deepStrictEqual(actual, {
  status: "INVALID", classification: "INVALID", normalizedStartDate: "2026-01-01",
  normalizedEndDate: null, coverageEndExclusive: null, durationDays: null,
  exactCalendarYears: null, diagnosticCodes: ["END_DATE_TYPE_UNSUPPORTED"],
});

const resolver = global.BancaTrackerDateResolver;
delete global.BancaTrackerDateResolver;
actual = classify({});
global.BancaTrackerDateResolver = resolver;
assert.deepStrictEqual(actual, emptyResult("INVALID", "INVALID", ["DATE_RESOLVER_UNAVAILABLE"]));

const iso = classify({ startDate: "2026-01-01", endDate: "2026-12-31" });
const indianSlash = classify({ startDate: "01/01/2026", endDate: "31/12/2026" });
const indianDash = classify({ startDate: "01-01-2026", endDate: "31-12-2026" });
assert.deepStrictEqual(iso, indianSlash); assert.deepStrictEqual(iso, indianDash);
const input = Object.freeze({ startDate: "01/01/2026", endDate: "31/12/2026", endDateConvention: "INCLUSIVE" });
const before = JSON.stringify(input);
const first = BancaTrackerPolicyTenure.classifyPolicyTenure(input);
const second = BancaTrackerPolicyTenure.classifyPolicyTenure(input);
assert.strictEqual(JSON.stringify(input), before); assert.deepStrictEqual(first, second);
assert.strictEqual(JSON.stringify(first), JSON.stringify(second));

const subprocessScript = [
  "global.window=global;", "require('./js/enrichment/dateResolver.js');", "require('./js/analytics/policyTenure.js');",
  "const accepted=BancaTrackerPolicyTenure.classifyPolicyTenure({startDate:'2026-01-01',endDate:'2027-01-01',endDateConvention:'EXCLUSIVE'});",
  "const rejected=BancaTrackerPolicyTenure.classifyPolicyTenure({startDate:new Date('2026-01-01T00:30:00Z'),endDate:'2027-01-01',endDateConvention:'EXCLUSIVE'});",
  "process.stdout.write(JSON.stringify({accepted,rejected}));",
].join("");
const timezoneOutputs = ["UTC", "America/New_York", "Asia/Kolkata"].map((TZ) => {
  const child = spawnSync(process.execPath, ["-e", subprocessScript], {
    cwd: root, env: { ...process.env, TZ }, encoding: "utf8",
  });
  assert.strictEqual(child.status, 0, child.stderr);
  const parsed = JSON.parse(child.stdout);
  assert.strictEqual(parsed.accepted.classification, "ANNUAL");
  assert.deepStrictEqual(parsed.rejected, {
    ...invalidStartTypeResult(), normalizedEndDate: "2027-01-01",
  });
  return child.stdout;
});
assert.strictEqual(timezoneOutputs[0], timezoneOutputs[1]);
assert.strictEqual(timezoneOutputs[1], timezoneOutputs[2]);

console.log("BRI-01A/R1 policy tenure authority tests passed: governed strings, diagnostics, leap boundaries, immutability, and cross-timezone determinism.");
