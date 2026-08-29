/* Step 4N: governed commercial execution pacing and run-rate authority. */
"use strict";
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
global.window = global;

const dimensions = ["OVERALL", "BANK", "BRANCH", "STATE", "ZONE", "BANK_REGION", "BANK_ZONE", "FGM_OFFICE", "ASSIGNED_RM", "CSM", "ASM", "ZSM", "NATIONAL_HEAD"];
const dimensionFields = { BANK: "bank", BRANCH: "branchId", STATE: "stateId", ZONE: "zoneId", BANK_REGION: "bankRegionId", BANK_ZONE: "bankZoneId", FGM_OFFICE: "fgmOfficeId", ASSIGNED_RM: "assignedRmId", CSM: "csmId", ASM: "asmId", ZSM: "zsmId", NATIONAL_HEAD: "nationalHeadId" };
let monthlyRows = [];
let monthlyStatus = "READY";
global.BancaTrackerCommercialRollups = {
  DIMENSIONS: dimensions,
  buildPeriodContext() { return { availablePeriods: ["2026-04", "2026-07", "2026-08", "2026-09"] }; },
  buildRollup(performance, scope, dimension) { return { status: monthlyStatus, rows: monthlyRows.map((row) => ({ ...row })), summary: {} }; },
};
global.BancaTrackerCommercialComparison = {
  validateComparisonPeriods(context, base, comparison) {
    if (!context.availablePeriods.length) return { valid: false, status: "NO_PERIODS" };
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(base || "") || !context.availablePeriods.includes(base) || base !== comparison) return { valid: false, status: "INVALID_PERIOD" };
    return { valid: true, samePeriod: true };
  },
};
function daysInPeriod(period) { const [year, month] = period.split("-").map(Number); return new Date(Date.UTC(year, month, 0)).getUTCDate(); }
global.BancaTrackerDailyCommercialComparison = {
  getDaysInPeriod: daysInPeriod,
  buildDailyActuals(facts, periods, dimension) {
    const periodKey = periods[0]; const period = new Map(); const entities = new Map();
    const diagnostics = { missingPeriodCount: 0, missingDayCount: 0, invalidDayCount: 0, uniqueExcludedFactCount: 0, uniqueExcludedPremium: 0 };
    for (const fact of facts) {
      const missingPeriod = !fact.monthKey; const missingDay = fact.day === null || fact.day === undefined; const day = Number(fact.day);
      const invalidDay = !missingPeriod && !missingDay && (!Number.isInteger(day) || day < 1 || day > daysInPeriod(fact.monthKey));
      if (missingPeriod) diagnostics.missingPeriodCount += 1;
      if (missingDay) diagnostics.missingDayCount += 1;
      if (invalidDay) diagnostics.invalidDayCount += 1;
      if (missingPeriod || missingDay || invalidDay) { diagnostics.uniqueExcludedFactCount += 1; diagnostics.uniqueExcludedPremium += Number(fact.premium) || 0; continue; }
      if (fact.monthKey !== periodKey) continue;
      const field = dimensionFields[dimension];
      const key = dimension === "OVERALL" ? "ALL" : fact[field] || (["ASSIGNED_RM", "CSM", "ASM", "ZSM", "NATIONAL_HEAD"].includes(dimension) ? "__UNASSIGNED__" : "__UNMAPPED__");
      if (!period.has(key)) period.set(key, new Map());
      period.get(key).set(day, (period.get(key).get(day) || 0) + (Number(fact.premium) || 0));
      entities.set(key, { baseLabel: key });
    }
    return { byPeriod: new Map([[periodKey, period]]), entities, diagnostics };
  },
};
const modulePath = path.join(__dirname, "..", "js/analytics/commercialExecution.js");
vm.runInThisContext(fs.readFileSync(modulePath, "utf8"), { filename: "commercialExecution.js" });
const Execution = BancaTrackerCommercialExecution;

assert.strictEqual(Execution.getDaysInPeriod("2026-04"), 30);
assert.strictEqual(Execution.getDaysInPeriod("2026-07"), 31);
assert.deepStrictEqual(Execution.resolveAsOfDay([], "2026-04", 0), { valid: true, asOfDay: 0, asOfSource: "EXPLICIT" });
assert.strictEqual(Execution.resolveAsOfDay([], "2026-04", -1).valid, false);
assert.strictEqual(Execution.resolveAsOfDay([], "2026-04", 31).valid, false);
assert.strictEqual(Execution.resolveAsOfDay([], "2026-04", 2.5).valid, false);
assert.deepStrictEqual(Execution.resolveAsOfDay([{ monthKey: "2026-04", day: 2 }, { monthKey: "2026-04", day: 13 }], "2026-04"), { valid: true, asOfDay: 13, asOfSource: "OBSERVED_FACT_MAX_DAY" });
assert.deepStrictEqual(Execution.resolveAsOfDay([], "2026-04"), { valid: true, asOfDay: 0, asOfSource: "NO_OBSERVATIONS" });

let measures = Execution.calculateExecutionMeasures(100, 350, 310, 500, 10, 31);
assert.strictEqual(measures.observedDays, 10);
assert.strictEqual(measures.remainingDays, 21);
assert.strictEqual(measures.expectedBudgetToDate, 100);
assert.strictEqual(measures.paceGap, 0);
assert.strictEqual(measures.paceAchievementPct, 100);
assert.strictEqual(measures.budgetAchievementToDatePct, 100 / 310 * 100);
assert.strictEqual(measures.budgetRemaining, 210);
assert.strictEqual(measures.averageDailyActual, 10);
assert.strictEqual(measures.requiredDailyRunRate, 10);
assert.strictEqual(measures.projectedMonthEndActual, 310);
assert.strictEqual(measures.projectedAchievementPct, 100);
assert.strictEqual(measures.projectedBudgetGap, 0);
assert.strictEqual(measures.runRateGap, 0);
assert.strictEqual(Execution.calculateExecutionMeasures(120, 120, 100, null, 20, 30).budgetRemaining, -20);
assert.strictEqual(Execution.calculateExecutionMeasures(120, 120, 100, null, 20, 30).requiredDailyRunRate, -2);
assert.strictEqual(Execution.calculateExecutionMeasures(300, 300, 200, null, 10, 10).projectedAchievementPct, 150);
assert.strictEqual(Execution.calculateExecutionMeasures(300, 300, 200, null, 10, 10).projectedBudgetGap, 100);
assert.strictEqual(Execution.calculateExecutionMeasures(100, 100, 200, null, 30, 30).requiredDailyRunRate, null);

measures = Execution.calculateExecutionMeasures(20, 20, 0, null, 10, 30);
assert.strictEqual(measures.expectedBudgetToDate, 0);
assert.strictEqual(measures.paceGap, 20);
assert.strictEqual(measures.paceAchievementPct, null);
assert.strictEqual(measures.budgetAchievementToDatePct, null);
assert.strictEqual(measures.budgetRemaining, -20);
assert.strictEqual(measures.requiredDailyRunRate, -1);
assert.strictEqual(measures.projectedAchievementPct, null);
measures = Execution.calculateExecutionMeasures(100, 100, null, 500, 10, 31);
for (const field of ["expectedBudgetToDate", "paceGap", "paceAchievementPct", "budgetAchievementToDatePct", "budgetRemaining", "requiredDailyRunRate", "projectedAchievementPct", "projectedBudgetGap"]) assert.strictEqual(measures[field], null, field);
assert.strictEqual(measures.averageDailyActual, 10);
assert.strictEqual(measures.projectedMonthEndActual, 310);
measures = Execution.calculateExecutionMeasures(0, 0, 310, null, 0, 31);
assert.strictEqual(measures.averageDailyActual, null);
assert.strictEqual(measures.projectedMonthEndActual, null);
assert.strictEqual(measures.expectedBudgetToDate, 0);
assert.strictEqual(measures.requiredDailyRunRate, 10);

const facts = [
  { monthKey: "2026-07", day: 1, premium: 100, bank: "BANK A", branchId: "B1", stateId: "S1", zoneId: "Z1", assignedRmId: "RM1", csmId: "C1", asmId: "A1", zsmId: "ZSM1", nationalHeadId: "NH1" },
  { monthKey: "2026-07", day: 5, premium: 50, bank: "BANK A", branchId: "B1", stateId: "S1", zoneId: "Z1", assignedRmId: "RM1", csmId: "C1", asmId: "A1", zsmId: "ZSM1", nationalHeadId: "NH1" },
  { monthKey: "2026-07", day: 8, premium: -20, bank: "BANK A", branchId: "B2" },
  { monthKey: "2026-07", day: 12, premium: 200, bank: "BANK B", branchId: "B2" },
  { monthKey: "2026-07", day: 31, premium: 300, bank: "BANK B", branchId: "B2" },
  { monthKey: "2026-07", day: 32, premium: 9 },
  { monthKey: "2026-07", premium: 7 },
  { day: null, premium: 5 },
];
const snapshot = JSON.stringify(facts);
const periodContext = { availablePeriods: ["2026-04", "2026-07", "2026-08", "2026-09"] };
monthlyRows = [{ key: "ALL", label: "Overall", budget: 310, potential: 500, coverageStatus: "COMPLETE" }];
let result = Execution.buildExecution({ facts, performanceResult: {}, periodContext, selectedPeriod: "2026-07", dimension: "OVERALL", asOfDay: 10 });
assert.strictEqual(result.status, "PARTIAL");
assert.strictEqual(result.asOfDay, 10);
assert.strictEqual(result.observedDays, 10);
assert.strictEqual(result.remainingDays, 21);
assert.strictEqual(result.rows[0].actualToDate, 130);
assert.strictEqual(result.rows[0].fullMonthActual, 630);
assert.strictEqual(result.rows[0].averageDailyActual, 13);
assert.strictEqual(result.rows[0].projectedMonthEndActual, 403);
assert.strictEqual(result.diagnostics.invalidDayCount, 1);
assert.strictEqual(result.diagnostics.missingDayCount, 2);
assert.strictEqual(result.diagnostics.uniqueExcludedFactCount, 3);
assert.strictEqual(result.diagnostics.uniqueExcludedPremium, 21);
assert.strictEqual(JSON.stringify(facts), snapshot);
result = Execution.buildExecution({ facts, performanceResult: {}, periodContext, selectedPeriod: "2026-07", dimension: "OVERALL" });
assert.strictEqual(result.asOfDay, 31);
assert.strictEqual(result.asOfSource, "OBSERVED_FACT_MAX_DAY");
assert.strictEqual(result.rows[0].requiredDailyRunRate, null);

monthlyRows = [{ key: "COMMERCIAL", label: "Commercial only", budget: 300, potential: 500, coverageStatus: "COMPLETE" }];
result = Execution.buildExecution({ facts: [], performanceResult: {}, periodContext, selectedPeriod: "2026-09", dimension: "BRANCH" });
assert.strictEqual(result.status, "NO_FACT_DATA");
assert.strictEqual(result.asOfDay, 0);
assert.strictEqual(result.rows[0].actualToDate, 0);
assert.strictEqual(result.rows[0].requiredDailyRunRate, 10);
assert.strictEqual(result.rows[0].projectedMonthEndActual, null);

monthlyRows = [{ key: "B1", label: "Branch 1", budget: null, potential: null, coverageStatus: "NONE" }];
result = Execution.buildExecution({ facts, performanceResult: {}, periodContext, selectedPeriod: "2026-07", dimension: "BRANCH", asOfDay: 10 });
assert.ok(result.rows.some((row) => row.key === "B1" && row.actualToDate === 150 && row.budget === null));
assert.ok(result.rows.some((row) => row.key === "B2"));
for (const dimension of dimensions) {
  monthlyRows = [{ key: dimension === "OVERALL" ? "ALL" : dimension === "BANK" ? "BANK A" : dimension === "BRANCH" ? "B1" : dimension === "STATE" ? "S1" : dimension === "ZONE" ? "Z1" : dimension === "ASSIGNED_RM" ? "RM1" : dimension === "CSM" ? "C1" : dimension === "ASM" ? "A1" : dimension === "ZSM" ? "ZSM1" : dimension === "NATIONAL_HEAD" ? "NH1" : "__UNMAPPED__", label: dimension, budget: 100, potential: null, coverageStatus: "COMPLETE" }];
  result = Execution.buildExecution({ facts, performanceResult: {}, periodContext, selectedPeriod: "2026-07", dimension, asOfDay: 10 });
  assert.ok(result.rows.length > 0, dimension);
}
const assigned = Execution.buildExecution({ facts, performanceResult: {}, periodContext, selectedPeriod: "2026-07", dimension: "ASSIGNED_RM", asOfDay: 10 });
assert.ok(assigned.rows.some((row) => row.key === "__UNASSIGNED__"));
assert.ok(!assigned.rows.some((row) => row.key === "SOURCE"));
assert.strictEqual(Execution.buildExecution({ facts, performanceResult: {}, periodContext, selectedPeriod: "bad", dimension: "OVERALL" }).status, "INVALID_PERIOD");
assert.strictEqual(Execution.buildExecution({ facts, performanceResult: {}, periodContext, selectedPeriod: "2026-04", dimension: "OVERALL", asOfDay: 31 }).status, "INVALID_AS_OF");

const source = fs.readFileSync(modulePath, "utf8");
for (const forbidden of ["Date.now", "new Date()", "Repository", "IndexedDB", "workingDay", "alertStatus", "ON_TRACK", "AT_RISK"]) assert.ok(!source.includes(forbidden), forbidden);
assert.doesNotMatch(source, /dailyBudget|budgetByDay/i);
assert.match(fs.readFileSync(path.join(__dirname, "..", "README.md"), "utf8"), /observation-derived `asOfDay`/);
for (const untouched of ["js/commercialPerformanceUI.js", "style.css", "app.js", "js/analytics/dailyCommercialComparison.js", "js/analytics/commercialComparison.js", "js/core.js", "js/activation.js", "js/scorecard.js", "js/productivity.js", "js/performance.js", "js/target.js"]) {
  assert.strictEqual(require("child_process").execFileSync("git", ["diff", "--name-only", "--", untouched], { cwd: path.join(__dirname, ".."), encoding: "utf8" }).trim(), "", untouched);
}
assert.doesNotMatch(fs.readFileSync(path.join(__dirname, "..", "js/core.js"), "utf8"), /CommercialExecution/);
console.log("Step 4N commercial execution tests passed: explicit/observed cutoffs, signed backtesting, Budget pace, run-rate/projection null/zero edges, governed entity universe, all dimensions, diagnostics, immutability, on-demand behavior, and preservation.");
