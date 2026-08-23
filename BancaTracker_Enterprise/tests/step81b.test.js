/* v8.1 Step 8.1B data-quality diagnostics and non-mutation regressions. */
const assert = require("assert"); const path = require("path");
global.window = global;
require(path.join(__dirname, "..", "js/config.js")); require(path.join(__dirname, "..", "js/csvProcessor.js")); require(path.join(__dirname, "..", "js/utilities.js")); require(path.join(__dirname, "..", "js/analytics.js")); require(path.join(__dirname, "..", "js/dataQuality.js"));
const base = { premium: 100, month: "Apr-26", bank: "INDIAN BANK", rm: "RM One", baCode: "BA1", lob: "Motor", branch: "Branch A", zone: "North", state: "Tamil Nadu", imd: "I1", businessType: "Fresh", productName: "Product One", productCode: "P1", day: "1" };
const rows = [
  { ...base },
  { ...base },
  { ...base, zone: "West", state: "Karnataka", imd: "I2", rm: "RM Two", productName: "Product Uno" },
  { ...base, branch: "Branch B", baCode: "BA2" },
  { ...base, branch: "Branch C", month: "Odd-26", bank: "UNCONFIGURED BANK", premium: -50, zone: "", state: "", baCode: "", rm: "", imd: "", businessType: "", productCode: "", productName: "", day: "" }
];
const before = JSON.stringify(rows); const audit = BancaTrackerDataQuality.build(rows, BancaTrackerConfig, { acceptedRows: rows.length, rejectedRows: 0, warningRows: 0 });
assert.strictEqual(JSON.stringify(rows), before, "data-quality build must not modify fact rows");
assert.ok(audit.hierarchyConflicts.some((item) => item.field === "Zone"));
assert.ok(audit.hierarchyConflicts.some((item) => item.field === "State"));
assert.ok(audit.hierarchyConflicts.some((item) => item.field === "IMD"));
assert.ok(audit.baCodeConflicts.some((item) => item.key === "BA1" && item.values.length === 2));
assert.ok(audit.rmNameConflicts.some((item) => item.key === "RM One" && item.values.includes("BA2")));
assert.ok(audit.productConflicts.some((item) => item.key === "P1" && item.values.length === 2));
assert.deepStrictEqual(audit.monthQuality.unconfiguredMonths, ["Odd-26"]);
assert.deepStrictEqual(audit.bankQuality.unknownBanks, ["UNCONFIGURED BANK"]);
assert.strictEqual(audit.premium.negativeRows, 1); assert.strictEqual(audit.premium.negativeTotal, -50);
assert.strictEqual(audit.completeness.find((item) => item.field === "zone").blankRows, 1);
assert.strictEqual(audit.completeness.find((item) => item.field === "businessType").populatedRows, 4);
assert.strictEqual(audit.duplicateSignals, 1); assert.strictEqual(audit.duplicateSamples[0].occurrences, 2);

const excessive = Array.from({ length: 76 }, (_, index) => ({ ...base, bank: "OTHER", branch: `Other Branch ${index}`, premium: 25000 }));
const excessiveAudit = BancaTrackerDataQuality.build(excessive, BancaTrackerConfig, {});
const otherSanity = excessiveAudit.branchUniverseSanity.find((item) => item.bank === "OTHER");
assert.strictEqual(otherSanity.observedBranches, 76); assert.strictEqual(otherSanity.activeBranches, 76); assert.strictEqual(otherSanity.configuredUniverse, 75); assert.strictEqual(otherSanity.severity, "ERROR");

const cleanRows = [{ ...base }, { ...base, branch: "Branch B", baCode: "BA2", rm: "RM Two", productCode: "P2", productName: "Product Two" }];
const cleanAudit = BancaTrackerDataQuality.build(cleanRows, BancaTrackerConfig, {});
assert.strictEqual(cleanAudit.hierarchyConflicts.length, 0); assert.strictEqual(cleanAudit.identityConflicts.length, 0); assert.strictEqual(cleanAudit.duplicateSignals, 0); assert.strictEqual(cleanAudit.bankQuality.unknownBanks.length, 0);

const rendered = {}; global.document = { getElementById(id) { return rendered[id] || (rendered[id] = { innerHTML: "", textContent: "" }); } };
const unsafeAudit = BancaTrackerDataQuality.build([{ ...base, zone: "<script>alert(1)</script>" }, { ...base, zone: "West" }], BancaTrackerConfig, { acceptedRows: 2 });
BancaTrackerDataQuality.render(unsafeAudit);
assert.ok(!rendered.hierarchyConflicts.innerHTML.includes("<script>alert(1)</script>")); assert.ok(rendered.hierarchyConflicts.innerHTML.includes("&lt;script&gt;"));

const performanceBefore = JSON.stringify(BancaTrackerAnalytics.build(rows));
BancaTrackerDataQuality.build(rows, BancaTrackerConfig, {});
assert.strictEqual(JSON.stringify(BancaTrackerAnalytics.build(rows)), performanceBefore, "quality diagnostics must not change business analytics inputs/results");
console.log("v8.1 Step 8.1B tests passed: conflicts, coverage, premium, completeness, duplicates, universe sanity, clean data, and non-mutation.");
