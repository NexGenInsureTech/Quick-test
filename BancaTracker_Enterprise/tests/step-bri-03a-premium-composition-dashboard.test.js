const assert = require("assert");
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");

global.window = global;
require(path.join(root, "js/analytics/managementBank.js"));
require(path.join(root, "js/analytics/premiumComposition.js"));
const authority = global.BancaTrackerPremiumComposition;

const fact = (premium, financialYear, monthKey, bank, productName, status, classification) => ({ premium, financialYear, monthKey, bank, productName, premiumPortionStatus: status, premiumPortionClassification: classification });
const facts = [
  fact(100, "FY2026-27", "2026-04", "INDIAN BANK", "Motor", "SUCCESS", "INITIAL_PORTION"),
  fact(-20, "FY2026-27", "2026-04", "INDIAN BANK", "Motor", "SUCCESS", "ADVANCE_PORTION"),
  fact(0, "FY2026-27", "2026-05", "INDIAN BANK", "Health", "UNKNOWN", "UNKNOWN"),
  fact(30, "FY2026-27", "2026-05", "INDIAN BANK", "Health", "INVALID", "INVALID"),
  fact(5, "FY2026-27", "2026-05", "INDIAN BANK", "Loan", "SUCCESS", "UNEXPECTED"),
  fact(10, "FY2026-27", "2026-06", "INDIAN BANK (PMSBY)", "Motor", "SUCCESS", "ADVANCE_PORTION"),
  fact(50, "FY2026-27", "2026-06", "INDIAN OVERSEAS BANK", "Loan", "SUCCESS", "INITIAL_PORTION"),
  fact(40, "FY2025-26", "2025-04", "INDIAN BANK", "Motor", "SUCCESS", "INITIAL_PORTION"),
];
const before = JSON.stringify(facts);
const result = authority.buildPremiumComposition(facts, { financialYear: "FY2026-27", managementBank: "ALL" });
assert.strictEqual(result.status, "READY");
assert.deepStrictEqual(result.premiumByBucket, { INITIAL: 150, ADVANCE: -10, UNKNOWN: 5, INVALID: 30 });
assert.deepStrictEqual(result.rowsByBucket, { INITIAL: 2, ADVANCE: 2, UNKNOWN: 2, INVALID: 1 });
assert.deepStrictEqual(result.kpis, { totalPremium: 175, initialPremium: 150, advancePremium: -10, unknownPremium: 5, invalidPremium: 30, unclassifiedPremium: 35, transactionRows: 7, classifiedRows: 4, classifiedTransactionRowShare: 4 / 7 * 100 });
assert.deepStrictEqual(result.reconciliation, { bucketPremiumTotal: 175, premiumDifference: 0, bucketRowTotal: 7, rowDifference: 0 });
assert.strictEqual(result.diagnostics.unexpectedMetadataRows, 1);
assert.deepStrictEqual(result.months.map((row) => [row.periodKey, row.totalPremium]), [["2026-04", 80], ["2026-05", 35], ["2026-06", 60]]);
assert.deepStrictEqual(result.products.map((row) => [row.product, row.totalPremium, row.premiums.INITIAL, row.premiums.ADVANCE, row.premiums.UNKNOWN, row.premiums.INVALID]), [["Health", 30, 0, 0, 0, 30], ["Loan", 55, 50, 0, 5, 0], ["Motor", 90, 100, -10, 0, 0]]);
assert.strictEqual(JSON.stringify(facts), before, "authority must not mutate canonical facts");
assert.ok(Object.isFrozen(result)); assert.ok(Object.isFrozen(result.months[0].premiums));

// Governed Management Bank consolidates CORE and PMSBY once, while FY scope stays isolated.
const indianBank = authority.buildPremiumComposition(facts, { financialYear: "FY2026-27", managementBank: "INDIAN BANK" });
assert.strictEqual(indianBank.kpis.totalPremium, 125);
assert.deepStrictEqual(indianBank.premiumByBucket, { INITIAL: 100, ADVANCE: -10, UNKNOWN: 5, INVALID: 30 });
assert.strictEqual(indianBank.kpis.transactionRows, 6);
assert.strictEqual(authority.buildPremiumComposition(facts, { financialYear: "FY2025-26", managementBank: "ALL" }).kpis.totalPremium, 40);
assert.deepStrictEqual(authority.availableFinancialYears(facts), ["FY2025-26", "FY2026-27"]);
assert.deepStrictEqual(authority.availableManagementBanks(facts), ["INDIAN BANK", "INDIAN OVERSEAS BANK"]);

// Zero-net and empty scopes remain valid without dropping signed rows.
const zeroNet = authority.buildPremiumComposition([
  fact(10, "FY2026-27", "2026-04", "INDIAN BANK", "Motor", "SUCCESS", "INITIAL_PORTION"),
  fact(-10, "FY2026-27", "2026-04", "INDIAN BANK", "Motor", "SUCCESS", "ADVANCE_PORTION"),
], { financialYear: "FY2026-27", managementBank: "ALL" });
assert.strictEqual(zeroNet.kpis.totalPremium, 0); assert.strictEqual(zeroNet.kpis.transactionRows, 2); assert.strictEqual(zeroNet.reconciliation.premiumDifference, 0);
const empty = authority.buildPremiumComposition([], { financialYear: "FY2026-27", managementBank: "ALL" });
assert.strictEqual(empty.status, "NO_DATA"); assert.strictEqual(empty.kpis.totalPremium, 0); assert.strictEqual(empty.kpis.classifiedTransactionRowShare, 0);

// Output is aggregate-only: no source identity or policy-count surface exists.
const serialized = JSON.stringify(result);
assert.strictEqual(serialized.includes("endorsement"), false);
assert.strictEqual(serialized.includes("policyCount"), false);
assert.strictEqual(Object.prototype.hasOwnProperty.call(result.kpis, "policyCount"), false);

// Browser renderer uses the pure result and leaves Commercial Performance state untouched.
class Element { constructor() { this.innerHTML = ""; this.value = ""; this.listeners = {}; } addEventListener(type, handler) { this.listeners[type] = handler; } }
const elements = Object.fromEntries(["premiumCompositionFinancialYear", "premiumCompositionManagementBank", "premiumCompositionReadiness", "premiumCompositionKpis", "premiumCompositionTrend", "premiumCompositionProducts", "premiumTenureReadiness", "premiumTenureMatrix"].map((id) => [id, new Element()]));
global.document = { getElementById: (id) => elements[id] || null };
global.BancaTrackerUtils = { escapeHtml: (value) => String(value == null ? "" : value).replace(/[&<>'\"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]), formatRupees: (value) => `${Number(value) < 0 ? "-" : ""}₹${Math.abs(Number(value || 0))}` };
const commercialSentinel = Object.freeze({ unchanged: true });
global.BancaTrackerCore = { state: { factData: facts, commercialPerformance: commercialSentinel } };
require(path.join(root, "js/premiumCompositionUI.js"));
const rendered = global.BancaTrackerPremiumCompositionUI.render();
assert.strictEqual(rendered.kpis.totalPremium, 175);
assert.strictEqual(global.BancaTrackerCore.state.commercialPerformance, commercialSentinel);
assert.match(elements.premiumCompositionKpis.innerHTML, /Total Signed Net Premium/);
assert.match(elements.premiumCompositionTrend.innerHTML, /commercial-negative/);
assert.match(elements.premiumCompositionProducts.innerHTML, /Unknown/);
assert.match(elements.premiumCompositionReadiness.innerHTML, /Classified transaction-row share 57\.1%/);

const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const core = fs.readFileSync(path.join(root, "js/core.js"), "utf8");
assert.strictEqual((html.match(/id="premiumCompositionPage"/g) || []).length, 1);
assert.ok(html.indexOf("js/analytics/managementBank.js") < html.indexOf("js/analytics/premiumComposition.js"));
assert.ok(html.indexOf("js/analytics/premiumComposition.js") < html.indexOf("js/premiumCompositionUI.js"));
assert.match(app, /premiumCompositionTab.*premiumCompositionPage/);
assert.match(core, /premiumCompositionPage.*BancaTrackerPremiumCompositionUI/);
assert.match(html, /not policy counts, renewals or cash-collection timing/i);
console.log("BRI-03A premium composition dashboard tests passed: exhaustive signed reconciliation, FY/product/Management Bank scope, historical trends, conservative metadata, privacy, UI and Commercial Performance isolation.");
