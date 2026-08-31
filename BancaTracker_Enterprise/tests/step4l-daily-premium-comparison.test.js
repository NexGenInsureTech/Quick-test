/* Step 4L: day-wise signed premium movement and cumulative comparison. */
"use strict";
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
global.window = global;

const dimensions = ["OVERALL", "BANK", "BRANCH", "STATE", "ZONE", "BANK_REGION", "BANK_ZONE", "FGM_OFFICE", "ASSIGNED_RM", "CSM", "ASM", "ZSM", "NATIONAL_HEAD"];
const fields = { BANK: ["canonicalBank", "canonicalBank", "__UNMAPPED__", "Unmapped"], BRANCH: ["branchId", "branchName", "__UNMAPPED__", "Unmapped"], STATE: ["stateId", "stateName", "__UNMAPPED__", "Unmapped"], ZONE: ["zoneId", "zoneName", "__UNMAPPED__", "Unmapped"], BANK_REGION: ["bankRegionId", "bankRegionName", "__UNMAPPED__", "Unmapped"], BANK_ZONE: ["bankZoneId", "bankZoneName", "__UNMAPPED__", "Unmapped"], FGM_OFFICE: ["fgmOfficeId", "fgmOfficeName", "__UNMAPPED__", "Unmapped"], ASSIGNED_RM: ["assignedRmId", "assignedRmName", "__UNASSIGNED__", "Unassigned"], CSM: ["csmId", "csmName", "__UNASSIGNED__", "Unassigned"], ASM: ["asmId", "asmName", "__UNASSIGNED__", "Unassigned"], ZSM: ["zsmId", "zsmName", "__UNASSIGNED__", "Unassigned"], NATIONAL_HEAD: ["nationalHeadId", "nationalHeadName", "__UNASSIGNED__", "Unassigned"] };
let monthly = {};
global.BancaTrackerCommercialRollups = {
  DIMENSIONS: dimensions,
  buildPeriodContext() { return { availablePeriods: ["2026-04", "2026-05", "2026-07", "2026-08", "2027-02", "2028-02"], latestAvailablePeriod: "2028-02", latestActualPeriod: "2026-08" }; },
  buildMetadataIndex() { return new Map(); },
  attachMetadata(rows) { return rows.map((row) => ({ ...row })); },
  getDimensionValue(row, dimension) { const [keyField, labelField, missingKey, missingLabel] = fields[dimension]; return row[keyField] ? { key: row[keyField], label: row[labelField] || row[keyField] } : { key: missingKey, label: missingLabel }; },
  buildRollup(performance, scope, dimension) { const item = monthly[`${scope.periodKey}:${dimension}`] || monthly[scope.periodKey] || { rows: [], status: "READY" }; return { rows: item.rows || [], status: item.status || "READY", summary: item.summary || {} }; },
};
global.BancaTrackerCommercialComparison = {
  validateComparisonPeriods(context, base, comparison) { if (!context.availablePeriods.length) return { valid: false, status: "NO_PERIODS" }; if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(base || "") || !/^\d{4}-(0[1-9]|1[0-2])$/.test(comparison || "")) return { valid: false, status: "INVALID_PERIOD" }; if (!context.availablePeriods.includes(base) || !context.availablePeriods.includes(comparison)) return { valid: false, status: "INVALID_PERIOD", reason: "UNAVAILABLE" }; return { valid: true, samePeriod: base === comparison }; },
  resolveDefaultPeriods(context) { const comparisonPeriod = context.latestActualPeriod || context.latestAvailablePeriod || null; const index = context.availablePeriods.indexOf(comparisonPeriod); return { basePeriod: index > 0 ? context.availablePeriods[index - 1] : null, comparisonPeriod }; },
};
const modulePath = path.join(__dirname, "..", "js/analytics/dailyCommercialComparison.js");
vm.runInThisContext(fs.readFileSync(modulePath, "utf8"), { filename: "dailyCommercialComparison.js" });
const Daily = BancaTrackerDailyCommercialComparison;

assert.strictEqual(Daily.getDaysInPeriod("2026-01"), 31);
assert.strictEqual(Daily.getDaysInPeriod("2026-04"), 30);
assert.strictEqual(Daily.getDaysInPeriod("2027-02"), 28);
assert.strictEqual(Daily.getDaysInPeriod("2028-02"), 29);
assert.strictEqual(Daily.getDaysInPeriod("bad"), null);
assert.deepStrictEqual(Daily.movement(100, 120), { change: 20, changePct: 20, direction: "UP" });
assert.deepStrictEqual(Daily.movement(100, 80), { change: -20, changePct: -20, direction: "DOWN" });
assert.deepStrictEqual(Daily.movement(0, 100), { change: 100, changePct: null, direction: "UP" });
assert.deepStrictEqual(Daily.movement(-100, -50), { change: 50, changePct: null, direction: "UP" });
assert.deepStrictEqual(Daily.movement(100, 100), { change: 0, changePct: 0, direction: "FLAT" });
assert.deepStrictEqual(Daily.movement(null, 0), { change: null, changePct: null, direction: "NOT_COMPARABLE" });

const facts = [
  { monthKey: "2026-04", day: 1, premium: 100, branchId: "B1", branch: "Same", bank: "BANK A", assignedRmId: "RM1", assignedRmName: "Assigned" },
  { monthKey: "2026-04", day: 1, premium: 50, branchId: "B1", branch: "Same", bank: "BANK A", assignedRmId: "RM1", assignedRmName: "Assigned" },
  { monthKey: "2026-04", day: 1, premium: -20, branchId: "B1", branch: "Same", bank: "BANK A", assignedRmId: "RM1", assignedRmName: "Assigned" },
  { monthKey: "2026-04", day: 2, premium: 0, branchId: "B1", branch: "Same", bank: "BANK A", assignedRmId: "RM1", assignedRmName: "Assigned" },
  { monthKey: "2026-04", day: 3, premium: -30, branchId: "B2", branch: "Same", bank: "BANK A", assignedRmId: null, rm: "SOURCE" },
  { monthKey: "2026-05", day: 1, premium: 120, branchId: "B1", branch: "Same", bank: "BANK A", assignedRmId: "RM1", assignedRmName: "Assigned" },
  { monthKey: "2026-05", day: 2, premium: 60, branchId: null, bank: "BANK A" },
  { monthKey: "2026-04", day: 31, premium: 9, branchId: "BAD" },
  { monthKey: "2026-04", premium: 7, branchId: "BAD" },
  { day: null, premium: 5, branchId: "BAD" },
];
const snapshot = JSON.stringify(facts);
let aggregate = Daily.buildDailyActuals(facts, ["2026-04", "2026-05"], "OVERALL");
assert.strictEqual(aggregate.byPeriod.get("2026-04").get("ALL").get(1), 130);
assert.strictEqual(aggregate.byPeriod.get("2026-04").get("ALL").get(2), 0);
assert.strictEqual(aggregate.byPeriod.get("2026-04").get("ALL").get(3), -30);
assert.strictEqual(aggregate.byPeriod.get("2026-05").get("ALL").get(2), 60);
assert.strictEqual(aggregate.diagnostics.invalidDayCount, 1);
assert.strictEqual(aggregate.diagnostics.missingDayCount, 2);
assert.strictEqual(aggregate.diagnostics.missingPeriodCount, 1);
assert.strictEqual(aggregate.diagnostics.uniqueExcludedFactCount, 3);
assert.strictEqual(aggregate.diagnostics.uniqueExcludedPremium, 21);

const periodContext = BancaTrackerCommercialRollups.buildPeriodContext();
let result = Daily.buildComparison({ facts, performanceResult: { rows: [] }, periodContext, basePeriod: "2026-04", comparisonPeriod: "2026-05", dimension: "OVERALL" });
assert.strictEqual(result.status, "PARTIAL");
assert.strictEqual(result.dayDomain, 31);
assert.strictEqual(result.entities.length, 1);
const overall = result.entities[0];
assert.strictEqual(overall.days.length, 31);
assert.deepStrictEqual(overall.days[0].base, { available: true, dailyActual: 130, cumulativeActual: 130 });
assert.deepStrictEqual(overall.days[0].comparison, { available: true, dailyActual: 120, cumulativeActual: 120 });
assert.strictEqual(overall.days[0].daily.change, -10);
assert.strictEqual(overall.days[1].comparison.cumulativeActual, 180);
assert.strictEqual(overall.days[2].base.cumulativeActual, 100);
assert.strictEqual(overall.days[4].base.dailyActual, 0);
const day31 = overall.days[30];
assert.deepStrictEqual(day31.base, { available: false, dailyActual: null, cumulativeActual: null });
assert.strictEqual(day31.comparison.available, true);
assert.deepStrictEqual(day31.daily, { change: null, changePct: null, direction: "NOT_COMPARABLE" });
assert.deepStrictEqual(day31.cumulative, { change: null, changePct: null, direction: "NOT_COMPARABLE" });

result = Daily.buildComparison({ facts, performanceResult: { rows: [] }, periodContext, basePeriod: "2027-02", comparisonPeriod: "2028-02", dimension: "OVERALL" });
assert.strictEqual(result.entities[0].presenceStatus, "BOTH");
assert.strictEqual(result.entities[0].days[28].base.available, false);
assert.strictEqual(result.entities[0].days[28].comparison.available, true);
result = Daily.buildComparison({ facts, performanceResult: { rows: [] }, periodContext, basePeriod: "2026-04", comparisonPeriod: "2026-04", dimension: "OVERALL" });
assert.strictEqual(result.status, "SAME_PERIOD");
assert.ok(result.entities[0].days.every((item) => item.daily.change === 0 && item.daily.direction === "FLAT"));
result = Daily.buildComparison({ facts, performanceResult: { rows: [] }, periodContext, basePeriod: "2026-04", comparisonPeriod: "2026-08", dimension: "OVERALL" });
assert.strictEqual(result.dayDomain, 31);
result = Daily.buildComparison({ facts, performanceResult: { rows: [] }, periodContext, basePeriod: "2026-08", comparisonPeriod: "2026-07", dimension: "OVERALL" });
assert.strictEqual(result.basePeriod, "2026-08");
assert.strictEqual(Daily.buildComparison({ facts, performanceResult: {}, periodContext, basePeriod: "bad", comparisonPeriod: "2026-08" }).status, "INVALID_PERIOD");
assert.strictEqual(Daily.buildComparison({ facts, performanceResult: {}, periodContext, basePeriod: "2026-04", comparisonPeriod: "2026-06" }).status, "INVALID_PERIOD");

monthly = { "2026-04:BRANCH": { rows: [{ key: "B1", label: "Same" }, { key: "COMMERCIAL", label: "Commercial only" }] }, "2026-05:BRANCH": { rows: [{ key: "B1", label: "Renamed" }, { key: "NEW", label: "New" }] } };
result = Daily.buildComparison({ facts, performanceResult: {}, periodContext, basePeriod: "2026-04", comparisonPeriod: "2026-05", dimension: "BRANCH" });
assert.strictEqual(result.entities.length, 5);
const commercial = result.entities.find((item) => item.key === "COMMERCIAL");
assert.strictEqual(commercial.presenceStatus, "BASE_ONLY");
assert.ok(commercial.days.slice(0, 30).every((item) => item.base.dailyActual === 0));
assert.strictEqual(commercial.days[30].base.dailyActual, null);
const renamed = result.entities.find((item) => item.key === "B1");
assert.strictEqual(renamed.label, "Renamed");
assert.strictEqual(renamed.labelChanged, true);
assert.ok(result.entities.some((item) => item.key === "__UNMAPPED__"));

monthly = {};
for (const dimension of dimensions.filter((item) => item !== "OVERALL")) {
  result = Daily.buildComparison({ facts, performanceResult: {}, periodContext, basePeriod: "2026-04", comparisonPeriod: "2026-05", dimension });
  assert.ok(result.entities.length > 0, dimension);
}
const assigned = Daily.buildComparison({ facts, performanceResult: {}, periodContext, basePeriod: "2026-04", comparisonPeriod: "2026-05", dimension: "ASSIGNED_RM" });
assert.ok(assigned.entities.some((item) => item.key === "RM1"));
assert.ok(assigned.entities.some((item) => item.key === "__UNASSIGNED__"));
assert.ok(!assigned.entities.some((item) => item.key === "SOURCE"));
assert.strictEqual(JSON.stringify(facts), snapshot);
assert.deepStrictEqual(Daily.resolveDefaultPeriods({ availablePeriods: ["2026-07", "2026-08", "2026-09"], latestAvailablePeriod: "2026-09", latestActualPeriod: "2026-08" }), { basePeriod: "2026-07", comparisonPeriod: "2026-08" });

const outputSource = fs.readFileSync(modulePath, "utf8");
for (const forbidden of ["budget", "potential", "runRate", "forecast", "Date.now", "new Date()", "Repository"]) assert.ok(!outputSource.includes(forbidden), forbidden);
const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
assert.match(html, /dailyCommercialComparison\.js/);
for (const untouched of ["js/analytics/commercialComparison.js", "js/core.js", "app.js", "js/target.js", "js/activation.js", "js/scorecard.js", "js/productivity.js", "js/performance.js"]) {
  const changed = require("child_process").execFileSync("git", ["diff", "--name-only", "--", untouched], { cwd: path.join(__dirname, ".."), encoding: "utf8" }).trim();
  assert.strictEqual(changed, "", untouched);
}

console.log("Step 4L daily premium comparison tests passed: calendar/leap semantics, signed daily/cumulative movement, zero vs unavailable days, canonical exclusions, direct Overall, governed dimensions/buckets, commercial-only entities, defaults, immutability, and preservation.");
