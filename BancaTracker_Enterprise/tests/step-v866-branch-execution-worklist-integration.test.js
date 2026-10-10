/* v8.6.6 Increment 1B: governed Branch Execution Worklist UI and full CSV. */
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

class Element {
  constructor() { this.innerHTML = ""; this.textContent = ""; this.value = ""; this.disabled = false; this.hidden = false; this.listeners = {}; }
  addEventListener(type, handler) { this.listeners[type] = handler; }
  click() { return this.listeners.click ? this.listeners.click.call(this) : null; }
}
const elements = {};
global.window = global;
global.document = { getElementById(id) { return elements[id] || (elements[id] = new Element()); } };
const root = path.join(__dirname, "..");
require(path.join(root, "js/config.js"));
require(path.join(root, "js/utilities.js"));
require(path.join(root, "js/analytics/branchExecutionWorklist.js"));
const WorklistProjection = BancaTrackerBranchExecutionWorklist;
require(path.join(root, "js/export/csvExport.js"));
const CsvExport = BancaTrackerCsvExport;

const commercialRows = Array.from({ length: 126 }, (_, index) => ({
  key: `B${String(index).padStart(3, "0")}\u00002026-04`, branchId: `B${String(index).padStart(3, "0")}`, periodKey: "2026-04",
  bankId: "BANK-1", canonicalBank: "Bank One", branchName: index === 4 ? "Branch, \"Quoted\"\nLine" : `Branch ${index}`,
  stateId: "S1", stateName: "State", zoneId: "Z1", zoneName: "Zone",
  assignedRmId: index === 1 ? null : "RM1", assignedRmName: index === 1 ? null : "Owner",
  asmId: "A1", asmName: "Area", zsmId: "Z1", zsmName: "Zonal", ownershipBasis: "CURRENT_ACTIVE_MASTER",
  actualPremium: index === 0 ? -25 : index === 1 ? 0 : index, budget: index === 1 ? null : 200,
  potential: index === 1 ? null : 400, achievementPct: index === 1 ? null : 50,
  budgetGap: index === 1 ? null : -100, budgetRemaining: index === 1 ? null : 100,
  potentialPenetrationPct: index === 1 ? null : 25, potentialGap: index === 1 ? null : 300,
  commercialStatus: index === 1 ? "REFERENCE_MISSING" : "COMPLETE", referenceStatus: index === 1 ? "REFERENCE_MISSING" : "COMPLETE",
  maturityBand: index === 2 ? "15K - 24.9K" : null, active: index === 2 ? false : null, nearActive: index === 2 ? true : null,
  activationGap: index === 2 ? 5000 : null, nextMaturityThreshold: index === 2 ? 25000 : null, maturityGap: index === 2 ? 5000 : null,
  strategyObjective: index === 2 ? "Convert" : null, executionCue: index === 2 ? "Close the gap." : null,
  priorityRank: index === 3 ? 1 : null, priorityReasons: index === 3 ? ["PROJECTED_SHORTFALL", "BEHIND_LINEAR_PACE"] : [],
}));

function result(status = "PARTIAL", rows = commercialRows, diagnostics = []) {
  return {
    status, scope: { periodKey: "2026-04", bankKey: null }, rows, diagnostics,
    reconciliation: { scopedPopulationCount: rows.length, identifiedRankedCount: rows.filter((row) => row.priorityRank !== null).length, identifiedUnrankedCount: rows.filter((row) => row.priorityRank === null).length, excludedCount: 0, scopedActual: rows.reduce((sum, row) => sum + row.actualPremium, 0) },
  };
}

let provenance = { status: "INVALID", periodKey: "2026-04", bankKey: null, identities: [], diagnostics: [{ code: "PROVENANCE_BANK_SCOPE_MIXED" }] };
let nextResult = result();
const worklistCalls = [];
global.BancaTrackerBranchExecutionWorklist = {
  buildProductivityProvenance(context) { assert.strictEqual(context, BancaTrackerCore.state.context); return provenance; },
  buildWorklist(input) { worklistCalls.push(input); return { ...nextResult, scope: { periodKey: input.periodKey, bankKey: input.bankKey } }; },
};

const exportCalls = {};
global.BancaTrackerCsvExport = {
  serializeCsv(options) { exportCalls.rows = options.rows; exportCalls.columns = options.columns; exportCalls.csv = CsvExport.serializeCsv({ ...options, includeBom: false }); return exportCalls.csv; },
  buildFilename(meta) { exportCalls.meta = meta; return CsvExport.buildFilename(meta); },
  downloadCsv(options) { exportCalls.download = options; return options; },
};

const performance = { status: "READY", rows: commercialRows };
global.BancaTrackerCore = { state: { filters: { month: "ALL", bank: "ALL" }, context: { currentPeriodKey: "2026-04", currentPeriodData: [], fullUploadData: [] }, productivity: { branchStrategies: [] }, commercialPerformance: performance, factData: [] } };
global.BancaTrackerCommercialExecutionStatus = { getStatusLabel(value) { return value; } };
require(path.join(root, "js/commercialPerformanceUI.js"));
const UI = BancaTrackerCommercialPerformanceUI;

let assertions = 0;
const equal = (actual, expected, message) => { assertions += 1; assert.deepStrictEqual(actual, expected, message); };
const check = (value, message) => { assertions += 1; assert.ok(value, message); };
function parseCsv(csv) {
  const records = []; let row = []; let cell = ""; let quoted = false;
  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index];
    if (quoted && character === '"' && csv[index + 1] === '"') { cell += '"'; index += 1; }
    else if (character === '"') quoted = !quoted;
    else if (!quoted && character === ",") { row.push(cell); cell = ""; }
    else if (!quoted && (character === "\r" || character === "\n")) {
      if (character === "\r" && csv[index + 1] === "\n") index += 1;
      row.push(cell); if (row.length > 1 || row[0] !== "") records.push(row); row = []; cell = "";
    } else cell += character;
  }
  return records;
}

const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const priorityPosition = html.indexOf('id="executionPriorityTable"');
const worklistPosition = html.indexOf('id="branchExecutionWorklistHeading"');
const drilldownPosition = html.indexOf('id="executionDrilldownHeading"');
check(priorityPosition >= 0 && priorityPosition < worklistPosition && worklistPosition < drilldownPosition, "panel follows governed priority and precedes drilldown");
check(html.indexOf("commercialExecutionPriority.js") < html.indexOf("branchExecutionWorklist.js") && html.indexOf("branchExecutionWorklist.js") < html.indexOf("commercialPerformanceUI.js"), "script dependency order is correct");

UI.state.execution.selectedPeriod = "2026-04";
UI.state.execution.dimension = "BANK";
const priority = { status: "READY", periodKey: "2026-04", dimension: "BANK", rankingApplicable: true, executionPriority: [] };
const authoritySnapshot = JSON.stringify({ performance, productivity: BancaTrackerCore.state.productivity, context: BancaTrackerCore.state.context, priority });
let built = UI.buildBranchExecutionWorklist(performance, priority);
equal(built.rows.length, 126);
equal(worklistCalls.at(-1).periodKey, "2026-04", "canonical execution period is passed unchanged");
equal(worklistCalls.at(-1).bankKey, null, "all-bank commercial population uses null canonical scope");
equal(worklistCalls.at(-1).executionPriorityResult, null, "BANK dimension priority is not passed as branch priority");
check(elements.branchExecutionWorklistDiagnostics.textContent.includes("Select Branch execution dimension"));
check(elements.branchExecutionWorklistDiagnostics.textContent.includes("All-bank strategy is unavailable"));
equal((elements.branchExecutionWorklistTable.innerHTML.match(/data-branch-id=/g) || []).length, 100, "display is bounded to 100 rows");
check(elements.branchExecutionWorklistCount.textContent.includes("126"));
check(elements.branchExecutionWorklistTable.innerHTML.includes("-₹25"), "negative Actual is visible");
check(elements.branchExecutionWorklistTable.innerHTML.includes("₹0"), "zero Actual is visible");
check(elements.branchExecutionWorklistTable.innerHTML.includes("<td></td>"), "missing values render blank");
check(elements.branchExecutionWorklistReadiness.innerHTML.includes("PARTIAL"));

const download = UI.exportBranchExecutionWorklist();
equal(exportCalls.rows, built.rows, "CSV consumes the complete cached result array");
equal(exportCalls.rows.length, 126, "CSV includes all 126 rows beyond visible Top 100");
equal(exportCalls.meta, { datasetId: "branch-execution-worklist", periods: ["2026-04"], scopeLabel: "all-banks" });
check(exportCalls.columns.some((column) => column.label === "Priority Reasons" && column.value(commercialRows[3]) === "PROJECTED_SHORTFALL; BEHIND_LINEAR_PACE"));
equal(download.filename, "branch-execution-worklist_2026-04_all-banks.csv");
const exported = parseCsv(exportCalls.csv);
equal(exported.length, 127, "CSV contains one header and exactly 126 data records despite embedded newlines");
equal(exported[0], exportCalls.columns.map((column) => column.label), "CSV header order matches the worklist column contract");
equal(new Set(exported.slice(1).map((row) => row[3])).size, 126, "canonical branch IDs are complete and unique");
equal(exported.slice(1).reduce((sum, row) => sum + Number(row[16]), 0), commercialRows.reduce((sum, row) => sum + row.actualPremium, 0), "exported signed Actual reconciles to the fixture aggregate");
equal(exported[2][17], "", "missing Budget remains empty");
equal(exported[2][18], "", "missing Potential remains empty");
equal(exported[2][10], "", "missing owner remains empty");
equal(exported[4][35], "PROJECTED_SHORTFALL; BEHIND_LINEAR_PACE", "multiple priority reasons share one deterministic CSV cell");
equal(exported[5][4], "Branch, \"Quoted\"\nLine", "CSV escaping round-trips commas, quotes, and newlines");

UI.state.execution.dimension = "BRANCH";
const branchPriority = { status: "READY", periodKey: "2026-04", dimension: "BRANCH", rankingApplicable: true, executionPriority: [] };
UI.buildBranchExecutionWorklist(performance, branchPriority);
equal(worklistCalls.at(-1).executionPriorityResult, branchPriority, "compatible all-bank BRANCH priority is passed unchanged");

BancaTrackerCore.state.filters.bank = "TESTBANK";
BancaTrackerCore.state.context.fullUploadData = [{ bank: "TESTBANK", bankId: "BANK-1" }];
provenance = { status: "READY", periodKey: "2026-04", bankKey: "BANK-1", identities: [], diagnostics: [] };
UI.buildBranchExecutionWorklist(performance, branchPriority);
equal(worklistCalls.at(-1).bankKey, "BANK-1", "TESTBANK display scope resolves from the unique fact bankId");
check(worklistCalls.at(-1).bankKey !== BancaTrackerCore.state.filters.bank, "display-bank value never substitutes for canonical bankId");
equal(worklistCalls.at(-1).executionPriorityResult, null, "bank-scoped priority without scope provenance is suppressed");
check(elements.branchExecutionWorklistDiagnostics.textContent.includes("Bank-scoped priority is unavailable"));

provenance = { status: "INVALID", periodKey: "2026-04", bankKey: "BANK-1", identities: [], diagnostics: [{ code: "PROVENANCE_IDENTITY_REJECTED" }] };
nextResult = result("PARTIAL", [{ ...commercialRows[0], strategyObjective: null, executionCue: null }]);
const invalidStrategyResult = UI.buildBranchExecutionWorklist(performance, branchPriority);
equal(worklistCalls.at(-1).bankKey, "BANK-1", "invalid strategy provenance does not discard independently proven bank scope");
equal(worklistCalls.at(-1).productivityProvenance, provenance, "invalid provenance is passed through for strategy fail-closed handling");
equal(invalidStrategyResult.status, "PARTIAL", "commercial population remains available with unavailable strategy enrichment");
equal(invalidStrategyResult.rows[0].strategyObjective, null);
equal(worklistCalls.at(-1).executionPriorityResult, null, "bank-scoped priority remains suppressed when strategy is invalid");
check(elements.branchExecutionWorklistDiagnostics.textContent.includes("Strategy enrichment is unavailable"));

for (const [facts, reason] of [
  [[{ bank: "TESTBANK", bankId: null }], "missing canonical bankId"],
  [[{ bank: "TESTBANK", bankId: "BANK-1" }, { bank: "TESTBANK", bankId: "BANK-2" }], "conflicting canonical bankIds"],
  [[], "empty selected-bank fact scope"],
  [[{ bank: "OTHERBANK", bankId: "BANK-1" }], "inconsistent selected-bank fact scope"],
]) {
  BancaTrackerCore.state.context.fullUploadData = facts;
  const callsBeforeUnprovenBank = worklistCalls.length;
  equal(UI.buildBranchExecutionWorklist(performance, branchPriority), null, `${reason} fails closed before projection`);
  equal(worklistCalls.length, callsBeforeUnprovenBank);
  equal(elements.branchExecutionWorklistExport.disabled, true);
  check(elements.branchExecutionWorklistDiagnostics.textContent.includes("no proven canonical bank ID"));
}

const scopedProjection = WorklistProjection.buildWorklist({
  periodKey: "2026-04", bankKey: "BANK-1",
  commercialPerformanceResult: { status: "READY", rows: [commercialRows[0], { ...commercialRows[1], branchId: "OTHER", key: "OTHER\u00002026-04", bankId: "BANK-2", canonicalBank: "Other Bank" }] },
});
equal(scopedProjection.rows.map((row) => row.branchId), [commercialRows[0].branchId], "other-bank commercial rows are excluded by exact canonical bankId");
check(scopedProjection.diagnostics.some((item) => item.code === "COMMERCIAL_ROW_BANK_EXCLUDED"));

BancaTrackerCore.state.filters.bank = "ALL";
provenance = { status: "READY", periodKey: "2026-03", bankKey: "BANK-1", identities: [], diagnostics: [] };
UI.buildBranchExecutionWorklist(performance, branchPriority);
check(elements.branchExecutionWorklistDiagnostics.textContent.includes("historical execution month"));

BancaTrackerCore.state.filters.bank = "TESTBANK";
BancaTrackerCore.state.context.fullUploadData = [{ bank: "TESTBANK", bankId: "BANK-1" }];
provenance = { status: "READY", periodKey: "2026-03", bankKey: "BANK-1", identities: [], diagnostics: [] };
UI.buildBranchExecutionWorklist(performance, branchPriority);
equal(worklistCalls.at(-1).bankKey, "BANK-1", "historical strategy mismatch does not block independently proven bank scope");
check(elements.branchExecutionWorklistDiagnostics.textContent.includes("historical execution month"));

BancaTrackerCore.state.context.fullUploadData = [{ bank: "TESTBANK", bankId: "BANK-2" }];
UI.buildBranchExecutionWorklist(performance, branchPriority);
equal(worklistCalls.at(-1).bankKey, "BANK-2", "repeated rendering resolves current facts instead of reusing stale scope");

for (const [status, disabled, text] of [
  ["READY", false, "READY"], ["PARTIAL", false, "PARTIAL"], ["INVALID_INPUT", true, "unavailable"], ["NO_ROWS", true, "No governed commercial"],
]) {
  const rows = status === "INVALID_INPUT" || status === "NO_ROWS" ? [] : [commercialRows[0]];
  UI.renderBranchExecutionWorklist(result(status, rows, [{ code: "UNKNOWN_SAFE_CODE" }]));
  equal(elements.branchExecutionWorklistExport.disabled, disabled, status);
  check((elements.branchExecutionWorklistReadiness.innerHTML + elements.branchExecutionWorklistTable.innerHTML).includes(text), status);
  check(elements.branchExecutionWorklistDiagnostics.textContent.includes("Unknown safe code"), "unknown diagnostics remain safely visible");
}

nextResult = result("READY", [commercialRows[0]]);
provenance = { status: "READY", periodKey: "2026-04", bankKey: "BANK-1", identities: [], diagnostics: [] };
UI.state.execution.dimension = "BANK";
BancaTrackerCore.state.filters.bank = "ALL";
BancaTrackerCore.state.context.fullUploadData = [];
const replacement = UI.buildBranchExecutionWorklist(performance, priority);
UI.exportBranchExecutionWorklist();
equal(exportCalls.rows, replacement.rows, "rerender replaces the transient export result");
UI.renderBranchExecutionWorklist(null);
equal(elements.branchExecutionWorklistExport.disabled, true, "invalidation clears export availability");
equal(JSON.stringify({ performance, productivity: BancaTrackerCore.state.productivity, context: BancaTrackerCore.state.context, priority }), authoritySnapshot, "integration does not mutate authority inputs");

const source = fs.readFileSync(path.join(root, "js/commercialPerformanceUI.js"), "utf8");
check(!/branchExecutionWorklist[^\n]*\.slice\(0\s*,\s*100\)[^\n]*serializeCsv/.test(source), "export does not serialize the display slice");
check(source.includes("downloadExport(result.rows, BRANCH_WORKLIST_COLUMNS"), "export reads the cached complete projection");

console.log(`v8.6.6 Branch Execution Worklist integration tests passed: ${assertions} assertions.`);
