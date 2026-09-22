/* v8.6 Step 6E.2: executable contract for shared CSV formula-prefix hardening. */
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");
global.window = global;
vm.runInThisContext(fs.readFileSync(path.join(root, "js/export/csvExport.js"), "utf8"), { filename: "csvExport.js" });
const Export = global.BancaTrackerCsvExport;
const GAP = "CONTRACT GAP: Step 6E.3 must harden formula-like CSV text at the shared serialization boundary.";

function csv(rows, columns, options = {}) {
  return Export.serializeCsv({ rows, columns, includeBom: false, ...options });
}

function oneColumn(values, label = "Value") {
  return csv(values.map((value) => ({ value })), [{ key: "value", label }]);
}

// The deliberate first boundary: current CSV quoting is structural only and does
// not yet protect a formula-like string. Future scenarios below define the full
// shared-authority contract once this assertion passes.
assert.strictEqual(oneColumn(["=1+1"]), "Value\r\n'=1+1\r\n", GAP);

// Formula prefixes, including whitespace-prefixed values, are export-only text
// representation changes. The original whitespace is retained after the prefix.
assert.strictEqual(oneColumn(["=1+1", "=SUM(A1:A2)", "+CMD", "-CMD", "@SUM(A1:A2)", "  =1+1", "\t=1+1", "\r=1+1", "\n=1+1"]), "Value\r\n'=1+1\r\n'=SUM(A1:A2)\r\n'+CMD\r\n'-CMD\r\n'@SUM(A1:A2)\r\n'  =1+1\r\n'\t=1+1\r\n\"'\r=1+1\"\r\n\"'\n=1+1\"\r\n");

// Formula protection precedes existing CSV quoting and quote-doubling.
assert.strictEqual(oneColumn(["=SUM(A1,A2)", '=He said "yes"', "=first\nsecond"]), "Value\r\n\"'=SUM(A1,A2)\"\r\n\"'=He said \"\"yes\"\"\"\r\n\"'=first\nsecond\"\r\n");

// Numeric primitives retain current raw JavaScript serialization semantics.
assert.strictEqual(oneColumn([-12500, -12500.5, 250, 0, -0.25, 1e6, -1e6]), "Value\r\n-12500\r\n-12500.5\r\n250\r\n0\r\n-0.25\r\n1000000\r\n-1000000\r\n");

// Numeric-looking strings remain strings, retain their exact text, and are safe
// only when they satisfy the approved complete scalar grammar.
assert.strictEqual(oneColumn(["+250", "-12500", "-12500.50", "-0.25", "+.5", "1e6", "-1e6", "+1.25E-3"]), "Value\r\n+250\r\n-12500\r\n-12500.50\r\n-0.25\r\n+.5\r\n1e6\r\n-1e6\r\n+1.25E-3\r\n");
assert.strictEqual(oneColumn(["+CMD", "-CMD", "+12abc", "-12abc", "+1+2", "-1+2", "  -125", "\t+250"]), "Value\r\n'+CMD\r\n'-CMD\r\n'+12abc\r\n'-12abc\r\n'+1+2\r\n'-1+2\r\n'  -125\r\n'\t+250\r\n");

// Ordinary strings, nullish values, booleans, and dates preserve existing rules.
assert.strictEqual(oneColumn(["INDIAN BANK", "Branch 001", "Motor", "Health", "ABC-123", "12345", null, undefined, true, false, new Date("2026-09-01T00:00:00.000Z")]), "Value\r\nINDIAN BANK\r\nBranch 001\r\nMotor\r\nHealth\r\nABC-123\r\n12345\r\n\r\n\r\nTRUE\r\nFALSE\r\n2026-09-01T00:00:00.000Z\r\n");

// Headers use the same shared cell rule and CSV framing remains BOM + CRLF by default.
assert.strictEqual(Export.serializeCsv({ rows: [{ value: "safe" }], columns: [{ key: "value", label: "=Formula Header" }] }), "\uFEFF'=Formula Header\r\nsafe\r\n");

const sourceRows = [{ value: "  =1+1", nested: { retained: true } }];
const sourceColumns = [{ key: "value", label: "=Header" }];
const rowsBefore = JSON.parse(JSON.stringify(sourceRows));
const columnsBefore = JSON.parse(JSON.stringify(sourceColumns));
csv(sourceRows, sourceColumns);
assert.deepStrictEqual(sourceRows, rowsBefore, "serialization must not mutate source row values");
assert.deepStrictEqual(sourceColumns, columnsBefore, "serialization must not mutate source headers");

// Opportunity Ownership remains a full-result raw-value export through the shared serializer.
const opportunityRows = [{ branch: "=Formula Branch", bank: "INDIAN BANK", zoneLabel: "Zone", stateLabel: "State", baCodeLabel: "BA001", rmLabel: "RM", imdLabel: "IMD", premium: 15000.125, gap: 9999.875, cue: "Prioritize" }];
const opportunityColumns = [{ key: "branch", label: "Branch" }, { key: "bank", label: "Bank" }, { key: "zoneLabel", label: "Zone" }, { key: "stateLabel", label: "State" }, { key: "baCodeLabel", label: "BA Code" }, { key: "rmLabel", label: "RM Name" }, { key: "imdLabel", label: "IMD" }, { key: "premium", label: "Current Premium" }, { key: "gap", label: "Gap" }, { key: "cue", label: "Cue" }];
const opportunityBefore = JSON.parse(JSON.stringify(opportunityRows));
const opportunityCsv = csv(opportunityRows, opportunityColumns);
assert.ok(opportunityCsv.includes("'=Formula Branch"));
assert.ok(opportunityCsv.includes("15000.125"));
assert.ok(opportunityCsv.includes("9999.875"));
assert.deepStrictEqual(opportunityRows, opportunityBefore, "Opportunity export must not mutate governed rows");

// Branch Movement text is hardened by the same serializer while numeric, zero,
// fractional, and null premium semantics remain raw and unchanged.
const movementRows = [{ branchId: "ID-1", branchName: "=Formula Branch", canonicalBank: "Bank A", stateName: "@State", zoneName: "Zone", basePremium: -123.456, comparisonPremium: 1.875, zeroPremium: 0, unavailablePremium: null }];
const movementColumns = [{ key: "branchId", label: "Branch ID" }, { key: "branchName", label: "Branch Name" }, { key: "canonicalBank", label: "Bank" }, { key: "stateName", label: "State" }, { key: "zoneName", label: "Zone" }, { key: "basePremium", label: "Base Premium" }, { key: "comparisonPremium", label: "Comparison Premium" }, { key: "zeroPremium", label: "Zero Premium" }, { key: "unavailablePremium", label: "Unavailable Premium" }];
const movementBefore = JSON.parse(JSON.stringify(movementRows));
const movementCsv = csv(movementRows, movementColumns);
assert.ok(movementCsv.includes("'=Formula Branch"));
assert.ok(movementCsv.includes("'@State"));
assert.ok(movementCsv.includes("-123.456"));
assert.ok(movementCsv.includes("1.875"));
assert.ok(movementCsv.includes(",0,"));
assert.ok(movementCsv.endsWith(",\r\n"));
assert.deepStrictEqual(movementRows, movementBefore, "Movement export must not mutate authority rows");

// Structural firewall: both operational exports already route to this serializer;
// future remediation belongs here, not in CSV ingestion or business authorities.
assert.match(fs.readFileSync(path.join(root, "js/productivity.js"), "utf8"), /serializeCsv\(\{ rows, columns \}\)/);
assert.match(fs.readFileSync(path.join(root, "js/commercialPerformanceUI.js"), "utf8"), /BancaTrackerCsvExport\.serializeCsv/);
assert.match(fs.readFileSync(path.join(root, "js/export/csvExport.js"), "utf8"), /function escapeCell/);

console.log("Step 6E.2 CSV formula-prefix hardening contract passed.");
