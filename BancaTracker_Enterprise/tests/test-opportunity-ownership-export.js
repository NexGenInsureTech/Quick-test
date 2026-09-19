/* Post-v8.4.1 Slice 5: Opportunity Ownership full-result CSV export. */
"use strict";
const assert = require("assert");
const fs = require("fs");
const path = require("path");

class Element {
  constructor() { this.value = ""; this.innerHTML = ""; this.textContent = ""; this.style = {}; this.hidden = false; this.disabled = false; this.listeners = {}; this.classList = { toggle() {} }; }
  addEventListener(type, listener) { this.listeners[type] = listener; }
  add() {}
  click() { if (this.listeners.click) return this.listeners.click(); return null; }
}
const elements = {};
global.window = global;
global.document = { getElementById(id) { return elements[id] || (elements[id] = new Element()); } };
global.Option = class {};
global.sessionStorage = { getItem() { return null; }, setItem() {} };
global.performance = require("perf_hooks").performance;

const root = path.join(__dirname, "..");
const load = (file) => require(path.join(root, file));
["js/config.js", "js/csvProcessor.js", "js/utilities.js", "js/analytics.js", "js/dataQuality.js", "js/export/csvExport.js", "js/productivity.js", "js/core.js", "js/performance.js", "app.js", "js/activation.js", "js/scorecard.js", "js/target.js"].forEach(load);

const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const ownershipPanel = html.match(/<div class="panel productivity-table">\s*<div class="opportunity-ownership-header">[\s\S]*?<div id="opportunityOwnership"><\/div>/);
assert.ok(ownershipPanel, "Export CSV control belongs to the Opportunity Ownership panel");
assert.match(ownershipPanel[0], /<h2>Opportunity Ownership<\/h2>[\s\S]*?<button id="opportunityOwnershipExport" type="button" disabled>Export CSV<\/button>/);
assert.strictEqual(BancaTrackerProductivity.LIMITS.opportunity, 100);

const csvCell = (value) => /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
const header = "USGI NET PREMIUM,Month,INTERMEDIARY,BA NAME,Ba Code,LINE OF BUSINESS,BRANCH NAME,Zone,STATE,SUM IMD CODE,Business Type,PRODUCT NAME,PRODUCT CODE,Day,POLICY ISSUED DATE";
const row = (premium, month, bank, branch, index) => [premium, month, bank, `RM ${index}`, `BA${index}`, "Motor", branch, "Zone", "State", `IMD${index}`, "Fresh", "Product", "P1", "1", ""].map((value) => csvCell(String(value))).join(",");
const records = [];
for (let index = 0; index < 102; index += 1) {
  const branch = index === 0 ? 'Branch, "Quoted"' : index === 1 ? "Branch\nLine" : `Branch ${String(index).padStart(3, "0")}`;
  records.push(row(15000.125 + index, "Jun-26", "INDIAN BANK", branch, index));
}
records.push(row(20000.75, "May-26", "INDIAN BANK", "May Only", 200));
records.push(row(21000.5, "Jun-26", "KARNATAKA BANK", "Other Bank Only", 201));
records.push(row(14999.99, "Jun-26", "INDIAN BANK", "Below Threshold", 202));
records.push(row(25000, "Jun-26", "INDIAN BANK", "Already Active", 203));
BancaTrackerCore.loadCsvText([header, ...records].join("\n"));
BancaTrackerCore.state.filters.month = "Jun-26";
BancaTrackerCore.state.filters.bank = "INDIAN BANK";
BancaTrackerCore.refresh();
BancaTrackerApp.showPage("productivityPage");

const result = BancaTrackerCore.state.productivity;
assert.strictEqual(result.opportunities.length, 102, "authority retains every eligible current-scope row");
assert.ok(result.opportunities.every((item) => item.bank === "INDIAN BANK"));
assert.ok(!result.opportunities.some((item) => ["May Only", "Other Bank Only", "Below Threshold", "Already Active"].includes(item.branch)));
assert.strictEqual(elements.opportunityOwnershipExport.disabled, false);
assert.match(elements.opportunityOwnership.innerHTML, /Showing top 100 of 102 results\./);
const tbody = elements.opportunityOwnership.innerHTML.match(/<tbody>([\s\S]*?)<\/tbody>/)[1];
assert.strictEqual((tbody.match(/<tr>/g) || []).length, 100, "visible table remains Top-100");
assert.match(elements.opportunityOwnership.innerHTML, /₹[\d,]+/u, "Slice 2 rupee presentation remains in the UI");

const realExport = BancaTrackerCsvExport;
const calls = { downloads: 0 };
global.BancaTrackerCsvExport = {
  serializeCsv(options) { calls.rows = options.rows; calls.columns = options.columns; calls.csv = realExport.serializeCsv({ ...options, includeBom: false }); return calls.csv; },
  buildFilename(meta) { calls.meta = meta; return realExport.buildFilename(meta); },
  downloadCsv(value) { calls.downloads += 1; calls.download = value; return value; }
};
const arrayBefore = result.opportunities.slice();
const rowBefore = result.opportunities.map((item) => ({ branch: item.branch, premium: item.premium, gap: item.gap }));
const download = elements.opportunityOwnershipExport.click();
assert.strictEqual(calls.rows, result.opportunities, "export consumes the complete governed array directly");
assert.strictEqual(calls.rows.length, 102);
assert.ok(calls.rows.length > 100);
assert.strictEqual(calls.rows[100], result.opportunities[100], "an eligible row hidden by the display limit is exported");
assert.deepStrictEqual(calls.rows.map((item) => item.key), result.opportunities.map((item) => item.key), "export preserves governed ordering");
assert.deepStrictEqual(calls.columns.map((column) => [column.label, column.key]), [["Branch", "branch"], ["Bank", "bank"], ["Zone", "zoneLabel"], ["State", "stateLabel"], ["BA Code", "baCodeLabel"], ["RM Name", "rmLabel"], ["IMD", "imdLabel"], ["Current Premium", "premium"], ["Gap to ₹25K", "gap"], ["Cue", "cue"]]);
assert.ok(calls.csv.includes("15000.125"), "raw fractional premium is preserved");
assert.ok(calls.csv.includes("9999.875"), "raw fractional gap is preserved");
assert.strictEqual((calls.csv.match(/₹/gu) || []).length, 1, "rupee symbol appears only in the governed gap header, not numeric values");
assert.ok(calls.csv.includes('"Branch, ""Quoted"""'), "commas and quotes are escaped");
assert.ok(calls.csv.includes('"Branch\nLine"'), "newlines are escaped");
assert.deepStrictEqual(calls.meta, { datasetId: "opportunity-ownership", periods: ["Jun-26"], scopeLabel: "bank-INDIAN BANK" });
assert.strictEqual(download.filename, "opportunity-ownership_jun-26_bank-indian-bank.csv");
assert.deepStrictEqual(result.opportunities, arrayBefore, "export does not mutate the result array");
assert.deepStrictEqual(result.opportunities.map((item) => ({ branch: item.branch, premium: item.premium, gap: item.gap })), rowBefore, "export does not mutate row values");

BancaTrackerCore.state.filters.month = "May-26";
BancaTrackerCore.refresh();
const mayResult = BancaTrackerCore.state.productivity;
assert.strictEqual(mayResult.opportunities.length, 1);
elements.opportunityOwnershipExport.click();
assert.strictEqual(calls.rows, mayResult.opportunities, "scope refresh replaces the retained export result");
assert.strictEqual(calls.rows[0].branch, "May Only");
assert.deepStrictEqual(calls.meta.periods, ["May-26"]);

BancaTrackerCore.state.filters.month = "Jun-26";
BancaTrackerCore.state.filters.bank = "KARNATAKA BANK LTD.";
BancaTrackerCore.refresh();
const bankResult = BancaTrackerCore.state.productivity;
assert.strictEqual(bankResult.opportunities.length, 1);
elements.opportunityOwnershipExport.click();
assert.strictEqual(calls.rows, bankResult.opportunities);
assert.strictEqual(calls.rows[0].branch, "Other Bank Only");
assert.strictEqual(calls.meta.scopeLabel, "bank-KARNATAKA BANK LTD.");

BancaTrackerCore.state.filters.bank = "ALL";
BancaTrackerCore.refresh();
const allBanksResult = BancaTrackerCore.state.productivity;
assert.strictEqual(allBanksResult.opportunities.length, 103);
elements.opportunityOwnershipExport.click();
assert.strictEqual(calls.rows, allBanksResult.opportunities);
assert.strictEqual(calls.meta.scopeLabel, "all-banks");
assert.strictEqual(calls.download.filename, "opportunity-ownership_jun-26_all-banks.csv");

BancaTrackerCore.state.filters.month = "May-26";
BancaTrackerCore.state.filters.bank = "KARNATAKA BANK LTD.";
BancaTrackerCore.refresh();
assert.strictEqual(BancaTrackerCore.state.productivity.opportunities.length, 0);
assert.strictEqual(elements.opportunityOwnershipExport.disabled, true);
const downloadsBefore = calls.downloads;
assert.strictEqual(elements.opportunityOwnershipExport.click(), null);
assert.strictEqual(calls.downloads, downloadsBefore, "empty export does not initiate a download");
assert.match(elements.opportunityOwnership.innerHTML, /No near-active opportunities in the current period\./);

console.log("Slice 5 Opportunity Ownership export tests passed: Top-100 display, full governed export, scopes, order, raw precision, escaping, refresh, empty state, and non-mutation.");
