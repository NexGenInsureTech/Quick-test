/* Post-v8.4.1 Slice 2: absolute-rupee presentation and overflow isolation. */
"use strict";
const assert = require("assert");
const fs = require("fs");
const path = require("path");

class Element {
  constructor() { this.innerHTML = ""; this.textContent = ""; this.value = ""; this.hidden = false; this.disabled = false; }
  addEventListener() {}
}
const elements = {};
global.window = global;
global.document = { getElementById(id) { return elements[id] || (elements[id] = new Element()); } };

const root = path.join(__dirname, "..");
require(path.join(root, "js/utilities.js"));
const utils = BancaTrackerUtils;

const sourceValue = 1234567.89;
assert.strictEqual(utils.formatRupees(sourceValue), "₹12,34,568");
assert.strictEqual(utils.formatRupees(-1234567.89), "-₹12,34,568");
assert.strictEqual(utils.formatRupees(0), "₹0");
assert.strictEqual(sourceValue, 1234567.89, "presentation formatting must not mutate source precision");
assert.strictEqual(utils.formatInr(1234), "1,234", "generic count formatting remains currency-free");
assert.strictEqual(utils.formatPercent(1, 3), "33.3%", "percentage decimals remain governed independently");

require(path.join(root, "js/config.js"));
require(path.join(root, "js/dataQuality.js"));
const negativeRows = [
  { premium: -1200000, month: "Apr-26", bank: "INDIAN BANK", rm: "RM 1", baCode: "BA1", lob: "Motor", branch: "Branch 1", zone: "North", state: "State", imd: "I1", businessType: "Fresh", productName: "Product", productCode: "P1", day: "1" },
  { premium: -34567.89, month: "Apr-26", bank: "INDIAN BANK", rm: "RM 2", baCode: "BA2", lob: "Motor", branch: "Branch 2", zone: "North", state: "State", imd: "I2", businessType: "Fresh", productName: "Product", productCode: "P2", day: "2" },
];
const negativeAudit = BancaTrackerDataQuality.build(negativeRows, BancaTrackerConfig, { acceptedRows: 2 });
const negativeFinding = negativeAudit.findings.find((finding) => finding.category === "Premium");
assert.strictEqual(negativeAudit.premium.negativeRows, 2, "negative row count remains a plain count");
assert.strictEqual(negativeAudit.premium.negativeTotal, -1234567.89, "finding formatting must preserve the underlying total");
assert.strictEqual(negativeFinding.message, "2 negative premium row(s) total -₹12,34,568.");

require(path.join(root, "js/commercialPerformanceUI.js"));
assert.strictEqual(BancaTrackerCommercialPerformanceUI.money(null), "N/A");
assert.strictEqual(BancaTrackerCommercialPerformanceUI.signedMoney(1234567.89), "+₹12,34,568");
assert.strictEqual(BancaTrackerCommercialPerformanceUI.signedMoney(-1234567.89), "-₹12,34,568");

require(path.join(root, "js/export/csvExport.js"));
const csv = BancaTrackerCsvExport.serializeCsv({ rows: [{ premium: sourceValue }], columns: [{ key: "premium", label: "Premium" }], includeBom: false, lineEnding: "\n" });
assert.strictEqual(csv, "Premium\n1234567.89\n", "CSV export must retain raw numeric precision");

const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const performanceSource = read("js/performance.js");
const targetSource = read("js/target.js");
assert.match(performanceSource, /toFixed\(2\)\} Cr/, "monthly MIS crore presentation remains unchanged");
assert.match(targetSource, /minimumFractionDigits: 2, maximumFractionDigits: 2/, "target crore presentation remains at two decimals");

for (const file of ["js/performance.js", "js/activation.js", "js/productivity.js", "js/scorecard.js", "js/dataQuality.js", "js/commercialPerformanceUI.js"]) {
  assert.match(read(file), /formatRupees/, `${file} must use the absolute-rupee presentation authority`);
}

const css = read("style.css");
const cardRule = css.match(/\.card\s*\{[^}]*\}/)[0];
const valueRule = css.match(/\.value\s*\{[^}]*\}/)[0];
assert.match(cardRule, /min-width:\s*0/);
assert.match(valueRule, /overflow-wrap:\s*anywhere/);
assert.doesNotMatch(valueRule, /ellipsis|overflow:\s*hidden|clip/);

console.log("Slice 2 absolute-rupee presentation tests passed: zero-decimal grouping, signs, precision, exclusions, exports, migrations, and overflow containment.");
