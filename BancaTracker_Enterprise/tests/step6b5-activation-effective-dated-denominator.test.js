/* Step 6B.5: Activation adopts the period-aware eligible Branch Universe only. */
"use strict";

const assert = require("assert");
const path = require("path");

global.window = global;
const elements = new Map();
function element(id) {
  if (!elements.has(id)) elements.set(id, { innerHTML: "", textContent: "", classList: { toggle() {} }, addEventListener() {}, add() {} });
  return elements.get(id);
}
global.document = { getElementById: element };
global.Option = class {};
global.performance = require("perf_hooks").performance;
const load = (file) => require(path.join(__dirname, "..", file));
[
  "js/config.js", "js/utilities.js", "js/analytics.js", "js/dataQuality.js", "js/productivity.js",
  "js/data/schema.js", "js/data/datasetRegistry.js", "js/masters/branchMaster.js",
  "js/enrichment/liveBranchUniverseAuthority.js", "js/enrichment/liveBranchAuthority.js",
  "js/core.js", "js/activation.js",
].forEach(load);

const Authority = BancaTrackerLiveBranchUniverseAuthority;
const Master = BancaTrackerBranchMaster;
const Core = BancaTrackerCore;
const Activation = BancaTrackerActivation;

function branch(code, options = {}) {
  const record = Master.normalizeRow({
    "BANK ID": options.bankId || "IB", "BRANCH CODE": code, "BRANCH NAME": `Synthetic ${code}`,
    "STATE ID": "SYNTHETIC", ACTIVE: String(options.active === undefined ? true : options.active).toUpperCase(),
    "ACTIVATION ELIGIBLE": String(options.activationEligible === undefined ? true : options.activationEligible).toUpperCase(),
    "VALID FROM": options.validFrom || "", "VALID TO": options.validTo || "",
  }, "BRANCH_MASTER:6B5", 2);
  return { ...record, canonicalBank: options.canonicalBank || "INDIAN BANK" };
}

function fact(month, monthKey, premium = 25000) {
  return { month, monthKey, bank: "INDIAN BANK", branchId: "IB:B001", branch: "Observed", premium, baCode: "BA", rm: "RM" };
}

function refresh(month, rows) {
  Core.state.factData = rows;
  Core.state.filters.month = month;
  Core.state.filters.bank = "ALL";
  Core.state.activePage = "misPage";
  Core.refresh();
  return Core.getPerformanceContext();
}

const records = [
  branch("B001", { validFrom: "2026-04-01" }),
  branch("B002", { validFrom: "2026-04-01", validTo: "2026-08-31", active: false }),
  branch("B003", { validFrom: "2026-09-01" }),
  branch("B004", { validFrom: "2026-09-01" }),
  branch("B005", { validFrom: "2026-04-01", activationEligible: false }),
  branch("B006", {}),
];
BancaTrackerLiveBranchAuthority.setCachedContext({ branchRecords: records });

const augContext = refresh("Aug-26", [fact("Aug-26", "2026-08")]);
const augDerived = Core.state.derived;
const augDenominator = Activation.resolveActivationDenominator(augContext);
const augMetric = Activation.buildBankMetrics(augDerived, null, augDenominator).find((item) => item.bank === "INDIAN BANK");
assert.deepStrictEqual([augContext.currentPeriodMonth, augContext.currentPeriodKey], ["Aug-26", "2026-08"]);
assert.deepStrictEqual([augDenominator.status, augMetric.denominator, augMetric.active, augMetric.activationPercent], ["GOVERNED_MIXED_TEMPORAL", 3, 1, (1 / 3) * 100]);

const sepContext = refresh("Sep-26", [fact("Sep-26", "2026-09")]);
const sepDerived = Core.state.derived;
const sepDenominator = Activation.resolveActivationDenominator(sepContext);
const sepMetric = Activation.buildBankMetrics(sepDerived, null, sepDenominator).find((item) => item.bank === "INDIAN BANK");
assert.deepStrictEqual([sepContext.currentPeriodMonth, sepContext.currentPeriodKey], ["Sep-26", "2026-09"]);
assert.deepStrictEqual([sepDenominator.status, sepMetric.denominator, sepMetric.active, sepMetric.activationPercent], ["GOVERNED_MIXED_TEMPORAL", 4, 1, 25]);
assert.strictEqual(augMetric.active, sepMetric.active, "the existing PR numerator must remain unchanged when only the period denominator changes");
assert.ok(augDenominator.resolution.eligibleBranchIds.includes("IB:B002"), "currently inactive but historically valid branch remains in Aug");
assert.ok(!sepDenominator.resolution.eligibleBranchIds.includes("IB:B002"), "expired branch is excluded in Sep");
assert.ok(!augDenominator.resolution.eligibleBranchIds.includes("IB:B003") && sepDenominator.resolution.eligibleBranchIds.includes("IB:B003"), "future branch is not pulled backward");
assert.ok(!sepDenominator.resolution.eligibleBranchIds.includes("IB:B005"), "activationEligible=false remains excluded");
assert.ok(sepDenominator.resolution.eligibleBranchIds.includes("IB:B006"), "legacy-undated membership remains governed and distinguishable");

const allContext = refresh("ALL", [fact("Aug-26", "2026-08"), fact("Sep-26", "2026-09")]);
const allDenominator = Activation.resolveActivationDenominator(allContext);
assert.deepStrictEqual([allContext.currentPeriodMonth, allContext.currentPeriodKey, allDenominator.resolution.diagnostics.requestedPeriod], ["Sep-26", "2026-09", "2026-09"], "ALL uses the one latest current period, not a multi-month universe");

const missingKeyContext = refresh("Aug-26", [fact("Aug-26", null)]);
const missingKey = Activation.resolveActivationDenominator(missingKeyContext);
assert.deepStrictEqual([missingKeyContext.currentPeriodKey, missingKey.source, missingKey.byBank["INDIAN BANK"]], [null, "CONFIGURED_FALLBACK", 6022], "display month labels are never converted into period keys");

BancaTrackerLiveBranchAuthority.setCachedContext({ branchRecords: [{ ...branch("BAD"), activationEligible: null }] });
const unavailable = Activation.resolveActivationDenominator(augContext);
assert.deepStrictEqual([unavailable.source, unavailable.reason, unavailable.byBank["INDIAN BANK"]], ["CONFIGURED_FALLBACK", "UNAVAILABLE", 6022], "unavailable period authority uses configured fallback, not the current snapshot");
const invalid = Activation.resolveActivationDenominator({ currentPeriodKey: "Aug-26" });
assert.deepStrictEqual([invalid.source, invalid.reason, invalid.byBank["INDIAN BANK"]], ["CONFIGURED_FALLBACK", "INVALID_PERIOD", 6022], "an invalid resolver period uses configured fallback");

BancaTrackerLiveBranchAuthority.setCachedContext({ branchRecords: [branch("KB", { bankId: "KB", canonicalBank: "KARNATAKA BANK LTD.", validFrom: "2026-04-01" })] });
const zero = Activation.resolveActivationDenominator(augContext);
const zeroMetric = Activation.buildBankMetrics(augDerived, null, zero).find((item) => item.bank === "INDIAN BANK");
assert.deepStrictEqual([zero.source, zero.status, zeroMetric.denominator, zeroMetric.activationPercent], ["PERIOD_AWARE_GOVERNED", "EFFECTIVE_DATED_GOVERNED", 0, null], "a valid governed zero never falls back to configured totals");

console.log("Step 6B.5 tests passed: Activation keeps its numerator and resolves period-aware governed, legacy, fallback, and zero denominators.");
