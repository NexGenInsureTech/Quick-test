/* v8.4 Step 3D: reusable CSV export utility. */
"use strict";
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

global.window = global;
vm.runInThisContext(fs.readFileSync(path.join(__dirname, "..", "js/export/csvExport.js"), "utf8"), { filename: "csvExport.js" });
const Export = BancaTrackerCsvExport;
const columns = [{ key: "id", label: "ID" }, { key: "name", label: "Display, Name" }, { key: "value", label: "Value" }, { key: "active", label: "Active" }];
const rows = [
  { value: 12.5, name: 'He said "yes"', id: "first", active: true },
  { value: -3, name: "hello,world\r\nnext", id: "second", active: false },
  { value: 0, name: null, id: undefined, active: null },
];
const expected = "\uFEFFID,\"Display, Name\",Value,Active\r\nfirst,\"He said \"\"yes\"\"\",12.5,TRUE\r\nsecond,\"hello,world\r\nnext\",-3,FALSE\r\n,,0,\r\n";
assert.strictEqual(Export.serializeCsv({ rows, columns }), expected);
assert.strictEqual(Export.serializeCsv({ rows: [], columns, includeBom: false }), "ID,\"Display, Name\",Value,Active\r\n");
assert.strictEqual(Export.serializeCsv({ rows: [{ first: "kept", second: "ordered" }], columns: [{ key: "second", label: "Second" }, { key: "first", label: "First" }], includeBom: false, lineEnding: "\n" }), "Second,First\nordered,kept\n");
assert.strictEqual(Export.serializeCsv({ rows: [{ raw: "x", when: new Date("2026-09-01T00:00:00.000Z") }], columns: [{ label: "Computed", value: (row) => `${row.raw},ok` }, { key: "when", label: "When" }], includeBom: false }), "Computed,When\r\n\"x,ok\",2026-09-01T00:00:00.000Z\r\n");
assert.throws(() => Export.serializeCsv({ rows: {}, columns }), /rows must be an array/);
assert.throws(() => Export.serializeCsv({ rows: [], columns: [] }), /columns must be a non-empty array/);
assert.throws(() => Export.serializeCsv({ rows: [], columns: [{ key: "x" }] }), /requires a label/);

const completeRows = Array.from({ length: 5 }, (_, index) => ({ id: index + 1 }));
const full = Export.serializeCsv({ rows: completeRows, columns: [{ key: "id", label: "ID" }], includeBom: false });
assert.strictEqual((full.match(/\r\n/g) || []).length, 6, "all authority rows are serialized; utility does not apply Top-N slicing");

assert.strictEqual(Export.buildFilename({ datasetId: "Branch Maturity Movement", periods: ["2026-07", "2026-09"], scopeLabel: "Bank: Indian Bank" }), "branch-maturity-movement_2026-07-vs-2026-09_bank-indian-bank.csv");
assert.strictEqual(Export.buildFilename({ datasetId: "  A///B  ", periods: [" 2026-09 "], scopeLabel: ' Overall <All>? " ' }), "ab_2026-09_overall-all.csv");
assert.strictEqual(Export.buildFilename({ datasetId: "Report.csv", periods: "2026-09", scopeLabel: "ALL" }), "report_2026-09_all.csv");
assert.strictEqual(Export.buildFilename({ fallback: "Custom Export.CSV" }), "custom-export.csv");
assert.strictEqual(Export.buildFilename({}), "bancatracker-export.csv");
assert.ok(!/[<>:"/\\|?*]/.test(Export.buildFilename({ datasetId: 'A<>:"/\\|?*', periods: [], scopeLabel: "" })));

const calls = { blobs: [], create: [], revoke: [], append: 0, remove: 0, click: 0 };
global.Blob = class { constructor(parts, options) { this.parts = parts; this.options = options; calls.blobs.push(this); } };
global.URL = { createObjectURL(blob) { calls.create.push(blob); return "blob:test"; }, revokeObjectURL(url) { calls.revoke.push(url); } };
const anchor = { click() { calls.click += 1; }, remove() { calls.remove += 1; } };
global.document = { createElement(tag) { assert.strictEqual(tag, "a"); return anchor; }, body: { appendChild(node) { assert.strictEqual(node, anchor); calls.append += 1; } } };
const download = Export.downloadCsv({ csv: "ID\r\n1\r\n", filename: "My Export.csv" });
assert.deepStrictEqual(download, { filename: "my-export.csv", mimeType: "text/csv;charset=utf-8" });
assert.strictEqual(calls.blobs[0].options.type, "text/csv;charset=utf-8");
assert.deepStrictEqual(calls.blobs[0].parts, ["ID\r\n1\r\n"]);
assert.deepStrictEqual([anchor.href, anchor.download, calls.append, calls.click, calls.remove, calls.revoke[0]], ["blob:test", "my-export.csv", 1, 1, 1, "blob:test"]);
anchor.click = function () { throw new Error("simulated click failure"); };
assert.throws(() => Export.downloadCsv({ csv: "x", filename: "retry.csv" }), /simulated click failure/);
assert.deepStrictEqual([calls.remove, calls.revoke.at(-1)], [2, "blob:test"]);

console.log("v8.4 CSV export tests passed: deterministic serialization, escaping, BOM, filenames, full-result preservation, and browser download cleanup.");
