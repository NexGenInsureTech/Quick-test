/* v8.4.1: rendered priority controls dispatch real delegated click interactions. */
"use strict";

const assert = require("assert");
const path = require("path");
global.window = global;

class ClickTarget {
  constructor(owner, kind, attributes = {}) {
    this.owner = owner;
    this.kind = kind;
    this.className = attributes.className || "";
    this.dataset = attributes.dataset || {};
  }
  closest(selector) {
    return selector === ".commercial-drilldown-select" && this.className.split(/\s+/).includes("commercial-drilldown-select") ? this : null;
  }
  dispatchEvent(event) {
    const handler = this.owner.listeners[event.type];
    if (handler) handler({ ...event, target: this });
    return true;
  }
}

class Element {
  constructor() { this.innerHTML = ""; this.textContent = ""; this.value = ""; this.disabled = false; this.hidden = false; this.listeners = {}; }
  addEventListener(type, handler) { this.listeners[type] = handler; }
  querySelector(selector) {
    if (selector === ".commercial-drilldown-select") {
      const match = this.innerHTML.match(/<button[^>]*class="([^"]*commercial-drilldown-select[^"]*)"[^>]*data-parent-key="([^"]*)"[^>]*data-parent-label="([^"]*)"[^>]*>/);
      return match ? new ClickTarget(this, "BUTTON", { className: match[1], dataset: { parentKey: match[2], parentLabel: match[3] } }) : null;
    }
    if (selector === "td") return /<td[ >]/.test(this.innerHTML) ? new ClickTarget(this, "CELL") : null;
    if (selector === "tr") return /<tr[ >]/.test(this.innerHTML) ? new ClickTarget(this, "ROW") : null;
    return null;
  }
}

const elements = {};
global.document = { getElementById(id) { return elements[id] || (elements[id] = new Element()); } };
const load = (file) => require(path.join(__dirname, "..", file));
load("js/config.js");
load("js/utilities.js");

const periodContext = { status: "READY", availablePeriods: ["2026-08"], availableFinancialYears: ["FY2026-27"], latestAvailablePeriod: "2026-08", latestActualPeriod: "2026-08", defaultSelectedPeriod: "2026-08" };
const summary = { actualPremium: 30, budget: 100, potential: 200, achievementPct: 30, budgetGap: -70, potentialPenetrationPct: 15, budgetPresentCount: 1, budgetMissingCount: 0, potentialPresentCount: 1, potentialMissingCount: 0, coverageStatus: "COMPLETE" };
global.BancaTrackerCommercialRollups = {
  buildPeriodContext() { return periodContext; },
  getFinancialYear() { return "FY2026-27"; },
  buildRollup(performance, scope, dimension) { return { status: "READY", summary, diagnostics: {}, rows: [{ key: dimension === "OVERALL" ? "ALL" : "A", label: "Bank A", ...summary }] }; },
};
global.BancaTrackerCore = { state: { factData: [{ monthKey: "2026-08", day: 10, premium: 30 }], commercialPerformance: { status: "READY", rows: [{ periodKey: "2026-08" }] } } };
global.BancaTrackerLiveGeographyAuthority = { getCachedContext() { return {}; } };
const executionRow = (key, label) => ({ key, label, actualToDate: 30, budget: 100, budgetAchievementToDatePct: 30, expectedBudgetToDate: 32, paceGap: -2, averageDailyActual: 3, requiredDailyRunRate: 4, projectedMonthEndActual: 90, projectedAchievementPct: 90, projectedBudgetGap: -10, referenceStatus: "COMPLETE" });
global.BancaTrackerCommercialExecution = {
  getDaysInPeriod() { return 31; },
  resolveAsOfDay() { return { valid: true, asOfDay: 10 }; },
  buildExecution(options) { const rows = [executionRow(options.dimension === "OVERALL" ? "ALL" : "A", options.dimension === "OVERALL" ? "Overall" : "Bank A")]; return { status: "READY", selectedPeriod: options.selectedPeriod, dimension: options.dimension, asOfDay: options.asOfDay, rows, coverage: {} }; },
};
global.BancaTrackerCommercialExecutionStatus = {
  getStatusLabel(code) { return String(code || "").replace(/_/g, " "); },
  buildStatus(execution) { return { status: "READY", periodKey: execution.selectedPeriod, asOfDay: execution.asOfDay, dimension: execution.dimension, rows: execution.rows.map((row) => ({ key: row.key, label: row.label, source: row, executionAttention: true, referenceAttention: true, attentionReasons: ["BUDGET_REFERENCE_MISSING"] })), summary: { executionAttentionCount: 1, referenceAttentionCount: 1, rowsWithObservations: 1, projectedShortfallCount: 1, budgetAchievedCount: 0, budgetExceededCount: 0 } }; },
};
global.BancaTrackerCommercialExecutionPriority = {
  buildPriority(execution) {
    if (execution.dimension === "OVERALL") return { rankingApplicable: false, executionPriority: [], referencePriority: [] };
    return {
      rankingApplicable: true,
      executionPriority: [{ key: "A", label: "Bank A", priorityRank: 1, priorityBasis: { projectedShortfallAmount: 10, paceGapMagnitude: 2, budget: 100 }, sourceStatus: { paceStatus: "BEHIND_LINEAR_PACE", projectionStatus: "PROJECTED_SHORTFALL" } }],
      referencePriority: [{ key: "A", label: "Bank A", priorityRank: 1, referenceReasonCode: "BUDGET_REFERENCE_MISSING" }],
    };
  },
};

let drilldownCalls = 0;
global.BancaTrackerCommercialExecutionDrilldown = {
  getAllowedDrilldowns(dimension) { return dimension === "BANK" ? ["ZONE", "BRANCH"] : dimension === "OVERALL" ? ["BANK"] : []; },
  buildDrilldown(options) {
    drilldownCalls += 1;
    return {
      status: "READY", periodKey: options.periodKey, asOfDay: options.asOfDay,
      parent: { dimension: options.parentSelection.parentDimension, key: options.parentSelection.parentKey, label: options.parentSelection.parentLabel },
      childDimension: options.childDimension, allowedChildDimensions: ["ZONE", "BRANCH"],
      rows: [
        { key: "Z1", label: "Zone One", execution: { actualToDate: 10, budget: 40 }, attention: { executionAttention: true, referenceAttention: false }, priority: { execution: { priorityRank: 1 }, reference: null } },
        { key: "Z2", label: "Zone Two", execution: { actualToDate: 20, budget: 60 }, attention: { executionAttention: false, referenceAttention: true }, priority: { execution: null, reference: { priorityRank: 1 } } },
      ],
      reconciliation: { actual: { parent: 30, children: 30, difference: 0, complete: true }, budget: { parent: 100, children: 100, difference: 0, complete: true } }, diagnostics: [],
    };
  },
};

load("js/commercialPerformanceUI.js");
const UI = BancaTrackerCommercialPerformanceUI;
UI.state.execution.dimension = "BANK";
UI.renderExecution(periodContext, BancaTrackerCore.state.commercialPerformance, {});

function clickPriority(view) {
  UI.clearExecutionDrilldown();
  UI.handleExecutionPriorityViewChange(view);
  const button = elements.executionPriorityTable.querySelector(".commercial-drilldown-select");
  assert.ok(button, `${view} entity button rendered`);
  assert.strictEqual(button.kind, "BUTTON");
  assert.deepStrictEqual(button.className.split(/\s+/).sort(), ["commercial-drilldown-select", "commercial-priority-drilldown-select"]);
  assert.deepStrictEqual(button.dataset, { parentKey: "A", parentLabel: "Bank A" });
  const before = drilldownCalls;
  button.dispatchEvent({ type: "click", bubbles: true });
  assert.strictEqual(drilldownCalls, before + 1, `${view} delegated handler reached drill-down authority`);
  assert.deepStrictEqual(
    [UI.state.execution.drilldown.parentDimension, UI.state.execution.drilldown.parentKey, UI.state.execution.drilldown.childDimension],
    ["BANK", "A", "ZONE"],
  );
  assert.match(elements.executionDrilldownParent.textContent, /Selected Parent: Bank A.*Bank.*Aug-26.*Day 10/);
  assert.match(elements.executionDrilldownStatus.textContent, /READY/);
  assert.match(elements.executionDrilldownTable.innerHTML, /Zone One/);
  assert.match(elements.executionDrilldownTable.innerHTML, /Zone Two/);
  const cue = new ClickTarget(elements.executionPriorityTable, "CUE");
  cue.closest = (selector) => selector === ".commercial-drilldown-select" ? button : null;
  const beforeCue = drilldownCalls;
  cue.dispatchEvent({ type: "click", bubbles: true });
  assert.strictEqual(drilldownCalls, beforeCue + 1, `${view} nested cue reaches the same delegated entity button`);
}

clickPriority("REFERENCE_PRIORITY");
clickPriority("EXECUTION_PRIORITY");

UI.clearExecutionDrilldown();
UI.handleExecutionPriorityViewChange("EXECUTION_PRIORITY");
const beforeNonInteractive = drilldownCalls;
elements.executionPriorityTable.querySelector("td").dispatchEvent({ type: "click", bubbles: true });
elements.executionPriorityTable.querySelector("tr").dispatchEvent({ type: "click", bubbles: true });
assert.strictEqual(drilldownCalls, beforeNonInteractive, "metric cells and rows are display-only");
assert.strictEqual(UI.state.execution.drilldown.parentKey, null);

console.log("v8.4.1 priority interaction tests passed: Reference and Execution entity buttons drill to 2 BANK A children; metric cells and rows remain display-only.");
