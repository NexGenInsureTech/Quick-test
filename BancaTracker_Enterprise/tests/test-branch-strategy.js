/* v8.6.3 Branch Strategy presentation contract. */
"use strict";
const assert = require("assert");
const fs = require("fs");
const path = require("path");

class Element {
  constructor() { this.value = ""; this.innerHTML = ""; this.textContent = ""; this.style = {}; this.disabled = false; this.listeners = {}; this.classList = { toggle() {} }; }
  addEventListener(type, listener) { this.listeners[type] = listener; }
  add() {}
  click() { return this.listeners.click ? this.listeners.click.call(this) : null; }
  change(value) { this.value = value; if (this.listeners.change) this.listeners.change.call(this); }
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

const header = "USGI NET PREMIUM,Month,INTERMEDIARY,BA NAME,Ba Code,LINE OF BUSINESS,BRANCH NAME,Zone,STATE,SUM IMD CODE,Business Type,PRODUCT NAME,PRODUCT CODE,Day,POLICY ISSUED DATE";
const csvRow = (premium, branch, index, month = "Jun-26", bank = "INDIAN BANK", rm = `RM ${index}`, ba = `BA${index}`, imd = `IMD${index}`) => [premium, month, bank, rm, ba, "Motor", branch, "Zone", "State", imd, "Fresh", "Product", "P1", "1", ""].join(",");
const boundaries = [-1, 0, 14999, 15000, 24999, 25000, 49999, 50000, 99999, 100000, 199999, 200000];
const rows = boundaries.map((premium, index) => csvRow(premium, `Boundary ${index}`, index));
for (let index = 0; index < 95; index += 1) rows.push(csvRow(1000 + index, `Build ${String(index).padStart(3, "0")}`, 100 + index));
rows.push(csvRow(16000, "Other Month", 300, "May-26"));
rows.push(csvRow(17000, "Other Bank", 301, "Jun-26", "KARNATAKA BANK"));
BancaTrackerCore.loadCsvText([header, ...rows].join("\n"));
BancaTrackerCore.state.filters.month = "Jun-26";
BancaTrackerCore.state.filters.bank = "INDIAN BANK";
BancaTrackerCore.refresh();
BancaTrackerApp.showPage("productivityPage");

const result = BancaTrackerCore.state.productivity;
assert.strictEqual(result.branchStrategies.length, result.branchMetrics.length, "strategy derives from the complete branchMetrics population");
assert(result.branchStrategies.length > result.opportunities.length, "strategy must not derive from Near Active opportunities");
assert.deepStrictEqual([...new Set(result.branchStrategies.map((row) => row.maturityBand))], BancaTrackerProductivity.BAND_ORDER);
assert.deepStrictEqual(result.branchStrategies.filter((row) => boundaries.includes(row.premium)).map((row) => row.strategyObjective), ["Diagnose", "Diagnose", "Build", "Convert", "Convert", "Grow", "Grow", "Deepen", "Deepen", "Deepen / Maintain", "Deepen / Maintain", "Maintain / Learn"]);

const byPremium = new Map(result.branchStrategies.map((row) => [row.premium, row]));
assert.deepStrictEqual([byPremium.get(-1).maturityBand, byPremium.get(-1).strategyObjective, byPremium.get(-1).nextMaturityThreshold, byPremium.get(-1).maturityGap, byPremium.get(-1).activationGap], ["Zero", "Diagnose", 15000, 15001, 25001]);
assert.deepStrictEqual([byPremium.get(15000).nearActive, byPremium.get(15000).strategyObjective, byPremium.get(15000).nextMaturityThreshold, byPremium.get(15000).maturityGap, byPremium.get(15000).activationGap], [true, "Convert", 25000, 10000, 10000]);
assert.deepStrictEqual([byPremium.get(25000).active, byPremium.get(25000).strategyObjective, byPremium.get(25000).nextMaturityThreshold, byPremium.get(25000).maturityGap, byPremium.get(25000).activationGap], [true, "Grow", 50000, 25000, null]);
assert.deepStrictEqual([byPremium.get(200000).nextMaturityThreshold, byPremium.get(200000).maturityGap, byPremium.get(200000).activationGap], [null, null, null]);
const conflict = BancaTrackerProductivity.buildStrategyRows([{ branch: "Conflict", premium: 15000, maturityBand: "15K - 24.9K", active: false, hierarchyConflict: true, productMappingConflict: true }])[0];
assert(conflict.executionCue.includes("Hierarchy conflict") && conflict.executionCue.includes("Product mapping conflict") && conflict.executionCue.includes("activation gap"));
assert(!elements.branchStrategy.innerHTML.includes("Dormant"));
assert.match(elements.branchStrategy.innerHTML, /Showing top 100 of 107 results\./);
const strategyBody = elements.branchStrategy.innerHTML.match(/<tbody>([\s\S]*?)<\/tbody>/)[1];
assert.strictEqual((strategyBody.match(/<tr>/g) || []).length, 100, "display limit is rendering-only");

elements.branchStrategyFilter.change("Convert");
assert(elements.branchStrategy.innerHTML.includes("Convert"));
assert(!elements.branchStrategy.innerHTML.includes(">Build<"));
assert.strictEqual(BancaTrackerCore.state.productivity.branchStrategies.length, 107, "local filter does not mutate the analytical result");

const realExport = BancaTrackerCsvExport;
const calls = {};
global.BancaTrackerCsvExport = {
  serializeCsv(options) { calls.rows = options.rows; calls.columns = options.columns; return realExport.serializeCsv({ ...options, includeBom: false }); },
  buildFilename(meta) { calls.meta = meta; return realExport.buildFilename(meta); },
  downloadCsv(value) { calls.download = value; return value; }
};
elements.branchStrategyExport.click();
assert.strictEqual(calls.rows, result.branchStrategies, "export consumes the complete scoped result, not the display/filter slice");
assert.strictEqual(calls.rows.length, 107);
assert.deepStrictEqual(calls.meta, { datasetId: "branch-strategy", periods: ["Jun-26"], scopeLabel: "bank-INDIAN BANK" });
assert.strictEqual(calls.download.filename, "branch-strategy_jun-26_bank-indian-bank.csv");
assert.deepStrictEqual(calls.columns.map((column) => column.label), ["Branch", "Bank", "Zone", "State", "BA Code", "RM", "IMD", "Current Premium", "Maturity Band", "Strategy Objective", "Next Maturity Threshold", "Gap to Next Maturity Threshold", "Activation Gap", "Execution Cue"]);

const source = fs.readFileSync(path.join(root, "js/productivity.js"), "utf8");
assert(!source.includes("BancaTrackerManagementBank"));
assert(!source.includes("Dormant"));
assert.strictEqual(BancaTrackerCore.state.productivity.opportunities.length, 2, "existing Near Active population remains specialized and unchanged");
console.log("v8.6.3 Branch Strategy tests passed: complete population, seven bands, semantics, scope, Top-100/filter isolation, and full export.");
