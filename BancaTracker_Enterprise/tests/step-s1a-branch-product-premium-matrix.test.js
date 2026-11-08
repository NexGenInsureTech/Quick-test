/* S1A: Branch x Product signed net premium authority. */
"use strict";

const assert = require("assert");
const path = require("path");
global.window = global;
const load = (file) => require(path.join(__dirname, "..", file));

global.BancaTrackerCommercialRollups = {
  buildMetadataIndex() { return new Map(); },
  attachMetadata(rows) { return rows.map((row) => ({ ...row, canonicalBank: row.canonicalBank || row.bank })); },
  getDimensionValue(fact, dimension) {
    if (dimension === "OVERALL") return { key: "ALL", label: "Overall" };
    if (dimension === "BRANCH") return { key: fact.branchId || "__UNMAPPED__", label: fact.branchName || fact.branchId || "Unmapped" };
    return { key: null, label: null };
  },
};
global.BancaTrackerCommercialExecution = {
  getDaysInPeriod(period) { return period === "2026-02" ? 28 : 31; },
};
load("js/analytics/managementBank.js");
load("js/analytics/commercialDriverAnalysis.js");
load("js/analytics/branchProductPremiumMatrix.js");

const Authority = BancaTrackerBranchProductPremiumMatrix;
const fact = (overrides = {}) => ({
  monthKey: "2026-08", day: 5, premium: 10,
  bank: "INDIAN BANK", branchId: "IB:001", branchName: "Shared Name",
  productCode: "p1", productName: "Product One", ...overrides,
});

const facts = [
  fact({ premium: 100 }),
  fact({ premium: -20 }),
  fact({ premium: 0, productCode: "P2", productName: "Product Two" }),
  fact({ branchId: "IOB:001", bank: "INDIAN OVERSEAS BANK", premium: 30 }),
  fact({ branchId: "IB:002", bank: "INDIAN BANK (PMSBY)", premium: 40, productCode: null, productName: "Name Only" }),
  fact({ branchId: "IB:002", bank: "INDIAN BANK (PMSBY)", premium: 5, productCode: null, productName: null }),
  fact({ branchId: null, premium: 7, branchResolutionStatus: "UNMAPPED" }),
  // Upstream branch governance excludes inactive master records, so they reach
  // this authority without a governed branchId and must stay outside the matrix.
  fact({ branchId: null, premium: 8, branchResolutionStatus: "UNMAPPED", sourceBranchActive: false }),
  fact({ monthKey: "2026-07", premium: 999 }),
];
const snapshot = JSON.stringify(facts);
let result = Authority.buildBranchProductPremiumMatrix({ facts, periodKey: "2026-08" });
assert.strictEqual(result.status, "READY");
assert.deepStrictEqual(result.rows.map((row) => [row.branchId, row.productKey, row.signedNetPremium, row.transactionRowCount]), [
  ["IB:001", "PRODUCT_CODE:P1", 80, 2],
  ["IB:001", "PRODUCT_CODE:P2", 0, 1],
  ["IB:002", "PRODUCT_NAME:Name Only", 40, 1],
  ["IB:002", "__UNMAPPED__", 5, 1],
  ["IOB:001", "PRODUCT_CODE:P1", 30, 1],
]);
assert.strictEqual(result.rows[0].branchName, "Shared Name");
assert.strictEqual(result.totals.matrixSignedNetPremium, 155);
assert.strictEqual(result.totals.unresolvedBranchSignedNetPremium, 15);
assert.strictEqual(result.totals.selectedSignedNetPremium, 170);
assert.strictEqual(result.totals.governedTransactionRowCount, 6);
assert.strictEqual(result.totals.unresolvedBranchTransactionRowCount, 2);
assert.deepStrictEqual(result.reconciliation, {
  governedSignedNetPremium: 155, matrixSignedNetPremium: 155, matrixDifference: 0,
  selectedSignedNetPremium: 170, disclosedSignedNetPremium: 170, coverageDifference: 0, complete: true,
});
assert.strictEqual(JSON.stringify(facts), snapshot);
assert.ok(Object.isFrozen(result) && Object.isFrozen(result.rows) && Object.isFrozen(result.rows[0]));
assert.ok(result.diagnostics.some((item) => item.code === "PRODUCT_TEXT_FALLBACK"));
assert.ok(result.diagnostics.some((item) => item.code === "DRIVER_UNMAPPED"));
assert.ok(result.diagnostics.some((item) => item.code === "BRANCH_UNRESOLVED"));

result = Authority.buildBranchProductPremiumMatrix({ facts, periodKey: "2026-08", managementBank: "INDIAN BANK" });
assert.strictEqual(result.totals.matrixSignedNetPremium, 125);
assert.strictEqual(result.totals.selectedSignedNetPremium, 140);
assert.strictEqual(result.totals.governedTransactionRowCount, 5);
assert.strictEqual(result.reconciliation.complete, true);
assert.ok(!result.rows.some((row) => row.branchId === "IOB:001"));

result = Authority.buildBranchProductPremiumMatrix({ facts: [
  fact({ productCode: "P1", productName: "One", premium: 9 }),
  fact({ productCode: "P1", productName: "Uno", premium: 1 }),
], periodKey: "2026-08" });
assert.strictEqual(result.status, "PARTIAL");
assert.strictEqual(result.rows[0].productLabel, "P1");
assert.deepStrictEqual(result.diagnostics.find((item) => item.code === "PRODUCT_CODE_NAME_CONFLICT"), { code: "PRODUCT_CODE_NAME_CONFLICT", count: 1 });

result = Authority.buildBranchProductPremiumMatrix({ facts: [
  fact({ premium: "not-a-number" }),
  fact({ day: 32, premium: 3 }),
], periodKey: "2026-08" });
assert.strictEqual(result.status, "PARTIAL");
assert.strictEqual(result.coverage.invalidPremiumTransactionRowCount, 1);
assert.strictEqual(result.coverage.invalidCanonicalDayTransactionRowCount, 1);
assert.strictEqual(result.rows.length, 0);

assert.strictEqual(Authority.buildBranchProductPremiumMatrix({ facts: [], periodKey: "2026-08" }).status, "EMPTY");
assert.strictEqual(Authority.buildBranchProductPremiumMatrix({ facts: [], periodKey: "bad" }).status, "INVALID_SCOPE");
assert.strictEqual(Authority.buildBranchProductPremiumMatrix({ facts: [], periodKey: "2026-08", managementBank: " " }).status, "INVALID_SCOPE");
assert.strictEqual(Authority.buildBranchProductPremiumMatrix({ facts: null, periodKey: "2026-08" }).status, "INVALID_INPUT");
for (const row of Authority.buildBranchProductPremiumMatrix({ facts, periodKey: "2026-08" }).rows) {
  assert.strictEqual(Object.prototype.hasOwnProperty.call(row, "policyCount"), false);
}

console.log("S1A Branch x Product matrix tests passed: signed aggregation, repeated rows, governed branch coverage, product identity reuse, Management Bank exact-once scope, reconciliation, and immutability.");
