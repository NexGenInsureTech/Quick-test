/*==============================================================
BancaTracker Enterprise
Version : 8.2.0-dev
File    : commercialExecutionDrilldown.js
Module  : Analytics
Purpose : Compose parent-scoped commercial execution drill-down context
==============================================================*/

(function (global) {
  "use strict";

  const PATHS = Object.freeze({
    OVERALL: Object.freeze(["BANK"]),
    BANK: Object.freeze(["ZONE", "STATE", "BANK_REGION", "BANK_ZONE", "FGM_OFFICE", "BRANCH"]),
    ZONE: Object.freeze(["STATE", "BRANCH"]),
    STATE: Object.freeze(["BRANCH"]),
    BANK_REGION: Object.freeze(["BRANCH"]),
    BANK_ZONE: Object.freeze(["BRANCH"]),
    FGM_OFFICE: Object.freeze(["BRANCH"]),
    NATIONAL_HEAD: Object.freeze(["ZSM"]),
    ZSM: Object.freeze(["ASM"]),
    ASM: Object.freeze(["CSM"]),
    CSM: Object.freeze(["ASSIGNED_RM"]),
    ASSIGNED_RM: Object.freeze(["BRANCH"]),
    BRANCH: Object.freeze([]),
  });

  const DOMAINS = Object.freeze({
    "OVERALL:BANK": "OVERALL",
    "NATIONAL_HEAD:ZSM": "ORGANISATIONAL",
    "ZSM:ASM": "ORGANISATIONAL",
    "ASM:CSM": "ORGANISATIONAL",
    "CSM:ASSIGNED_RM": "ORGANISATIONAL",
    "ASSIGNED_RM:BRANCH": "OPERATIONAL_BRANCH",
    "BANK:ZONE": "GEOGRAPHIC",
    "BANK:STATE": "GEOGRAPHIC",
    "BANK:BRANCH": "GEOGRAPHIC",
    "ZONE:STATE": "GEOGRAPHIC",
    "ZONE:BRANCH": "GEOGRAPHIC",
    "STATE:BRANCH": "GEOGRAPHIC",
    "BANK:BANK_REGION": "BANK_ORGANISATION",
    "BANK:BANK_ZONE": "BANK_ORGANISATION",
    "BANK:FGM_OFFICE": "BANK_ORGANISATION",
    "BANK_REGION:BRANCH": "BANK_ORGANISATION",
    "BANK_ZONE:BRANCH": "BANK_ORGANISATION",
    "FGM_OFFICE:BRANCH": "BANK_ORGANISATION",
  });

  const VALID_EXECUTION_STATUSES = Object.freeze(["READY", "PARTIAL", "NO_FACT_DATA"]);
  const ORGANISATIONAL_DOMAINS = Object.freeze(["ORGANISATIONAL", "OPERATIONAL_BRANCH"]);

  function stableCompare(left, right) {
    const a = String(left);
    const b = String(right);
    return a < b ? -1 : a > b ? 1 : 0;
  }

  function clone(value) {
    if (Array.isArray(value)) return value.map(clone);
    if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, clone(item)]));
    return value;
  }

  function diagnostic(code, key = null, detail = null) {
    return { code, key, detail };
  }

  function sortDiagnostics(items) {
    return items.sort((left, right) => stableCompare(left.code, right.code)
      || stableCompare(left.key || "", right.key || "")
      || stableCompare(left.detail || "", right.detail || ""));
  }

  function getAllowedDrilldowns(parentDimension) {
    return PATHS[parentDimension] ? [...PATHS[parentDimension]] : [];
  }

  function validateDrilldown(selection = {}) {
    const parentDimension = selection.parentDimension;
    const childDimension = selection.childDimension;
    const dimensions = global.BancaTrackerCommercialRollups && global.BancaTrackerCommercialRollups.DIMENSIONS || [];
    if (!dimensions.includes(parentDimension) || !dimensions.includes(childDimension)) {
      return { valid: false, status: "INVALID_INPUT", diagnostics: [diagnostic("DIMENSION_INVALID")] };
    }
    if (!getAllowedDrilldowns(parentDimension).includes(childDimension)) {
      return { valid: false, status: "INVALID_DRILLDOWN", diagnostics: [diagnostic("DRILLDOWN_PATH_INVALID", null, `${parentDimension}:${childDimension}`)] };
    }
    return { valid: true, status: "READY", domain: DOMAINS[`${parentDimension}:${childDimension}`], diagnostics: [] };
  }

  function factForDimension(fact) {
    return {
      ...fact,
      canonicalBank: fact.canonicalBank || fact.bank || null,
      branchName: fact.branchName || fact.branch || null,
      stateName: fact.stateName || fact.state || null,
      zoneName: fact.zoneName || fact.zone || null,
    };
  }

  function scopeRows(rows, parentDimension, parentKey, authorityContext, facts) {
    if (parentDimension === "OVERALL") return [...(rows || [])];
    const rollups = global.BancaTrackerCommercialRollups;
    const metadataIndex = rollups.buildMetadataIndex(authorityContext || {});
    return (rows || []).filter((source) => {
      const row = facts ? factForDimension(source) : source;
      const enriched = rollups.attachMetadata([row], metadataIndex)[0];
      return rollups.getDimensionValue(enriched, parentDimension).key === parentKey;
    });
  }

  function indexRows(rows, kind, diagnostics) {
    const result = new Map();
    let valid = true;
    (rows || []).forEach((row) => {
      const key = row && row.key;
      if (typeof key !== "string" || !key) {
        diagnostics.push(diagnostic(`${kind}_KEY_MISSING`));
        valid = false;
      } else if (result.has(key)) {
        diagnostics.push(diagnostic(`${kind}_KEY_DUPLICATE`, key));
        valid = false;
      } else result.set(key, row);
    });
    return { result, valid };
  }

  function emptyReconciliation() {
    return {
      actual: { parent: null, children: null, difference: null, complete: false, status: "NOT_COMPARABLE" },
      budget: { parent: null, children: null, difference: null, complete: false, status: "NOT_AVAILABLE", missingChildCount: 0 },
    };
  }

  function invalidResult(status, parentSelection, childDimension, diagnostics) {
    const parentDimension = parentSelection && parentSelection.parentDimension || null;
    return {
      status, periodKey: null, asOfDay: null,
      parent: parentSelection ? { dimension: parentDimension, key: parentSelection.parentKey || null, label: parentSelection.parentLabel || null } : null,
      domain: parentDimension && childDimension ? DOMAINS[`${parentDimension}:${childDimension}`] || null : null,
      childDimension: childDimension || null,
      allowedChildDimensions: getAllowedDrilldowns(parentDimension),
      scope: parentDimension ? { parentDimension, parentKey: parentSelection.parentKey || null } : null,
      rows: [], reconciliation: emptyReconciliation(), diagnostics: sortDiagnostics(diagnostics),
    };
  }

  function validateSnapshot(parentExecution, childExecution, childStatus, childPriority, childDimension, diagnostics) {
    const periodKey = parentExecution.selectedPeriod;
    const asOfDay = parentExecution.asOfDay;
    if (childExecution.selectedPeriod !== periodKey || childStatus.periodKey !== periodKey || childPriority.periodKey !== periodKey) diagnostics.push(diagnostic("PERIOD_MISMATCH"));
    if (childExecution.asOfDay !== asOfDay || childStatus.asOfDay !== asOfDay || childPriority.asOfDay !== asOfDay) diagnostics.push(diagnostic("AS_OF_MISMATCH"));
    if (childExecution.dimension !== childDimension || childStatus.dimension !== childDimension || childPriority.dimension !== childDimension) diagnostics.push(diagnostic("DIMENSION_MISMATCH"));
    return !diagnostics.some((item) => ["PERIOD_MISMATCH", "AS_OF_MISMATCH", "DIMENSION_MISMATCH"].includes(item.code));
  }

  function composeRows(executionResult, statusResult, priorityResult, diagnostics) {
    const execution = indexRows(executionResult.rows, "EXECUTION", diagnostics);
    const status = indexRows(statusResult.rows, "ATTENTION", diagnostics);
    if (!execution.valid || !status.valid) return { valid: false, rows: [] };
    const executionPriority = new Map((priorityResult.executionPriority || []).map((row) => [row.key, row]));
    const referencePriority = new Map((priorityResult.referencePriority || []).map((row) => [row.key, row]));
    const rows = [];
    execution.result.forEach((executionRow, key) => {
      const attentionRow = status.result.get(key);
      if (!attentionRow) diagnostics.push(diagnostic("ATTENTION_ROW_UNMATCHED", key));
      rows.push({
        key, label: executionRow.label,
        execution: clone(executionRow),
        attention: attentionRow ? clone(attentionRow) : null,
        priority: {
          execution: executionPriority.has(key) ? clone(executionPriority.get(key)) : null,
          reference: referencePriority.has(key) ? clone(referencePriority.get(key)) : null,
        },
      });
    });
    status.result.forEach((row, key) => { if (!execution.result.has(key)) diagnostics.push(diagnostic("EXECUTION_ROW_UNMATCHED", key)); });
    rows.sort((left, right) => stableCompare(left.label, right.label) || stableCompare(left.key, right.key));
    return { valid: true, rows };
  }

  function reconcile(parentRow, rows, diagnostics) {
    const childExecution = rows.map((row) => row.execution);
    const parentActual = parentRow.actualToDate;
    const childActual = childExecution.reduce((sum, row) => sum + row.actualToDate, 0);
    const actualDifference = childActual - parentActual;
    const actualStatus = actualDifference === 0 ? "RECONCILED" : "DIFFERENCE";
    if (actualDifference !== 0) diagnostics.push(diagnostic("ACTUAL_RECONCILIATION_DIFFERENCE", null, actualDifference));

    const parentBudgetComplete = parentRow.budget !== null && parentRow.referenceStatus === "COMPLETE";
    const missingChildCount = childExecution.filter((row) => row.budget === null || row.referenceStatus !== "COMPLETE").length;
    const budgetComplete = parentBudgetComplete && childExecution.length > 0 && missingChildCount === 0;
    let childBudget = null;
    let budgetDifference = null;
    let budgetStatus = parentRow.budget === null ? "NOT_AVAILABLE" : "PARTIAL";
    if (budgetComplete) {
      childBudget = childExecution.reduce((sum, row) => sum + row.budget, 0);
      budgetDifference = childBudget - parentRow.budget;
      budgetStatus = budgetDifference === 0 ? "RECONCILED" : "DIFFERENCE";
      if (budgetDifference !== 0) diagnostics.push(diagnostic("BUDGET_RECONCILIATION_DIFFERENCE", null, budgetDifference));
    } else diagnostics.push(diagnostic("BUDGET_RECONCILIATION_INCOMPLETE", null, missingChildCount));

    return {
      actual: { parent: parentActual, children: childActual, difference: actualDifference, complete: true, status: actualStatus },
      budget: { parent: parentRow.budget, children: childBudget, difference: budgetDifference, complete: budgetComplete, status: budgetStatus, missingChildCount },
    };
  }

  function buildDrilldown(options = {}) {
    const parentSelection = options.parentSelection;
    const childDimension = options.childDimension;
    if (!parentSelection || typeof parentSelection !== "object" || typeof parentSelection.parentKey !== "string" || !parentSelection.parentKey) {
      return invalidResult("INVALID_INPUT", parentSelection, childDimension, [diagnostic("PARENT_SELECTION_INVALID")]);
    }
    const validation = validateDrilldown({ parentDimension: parentSelection.parentDimension, childDimension });
    if (!validation.valid) return invalidResult(validation.status, parentSelection, childDimension, validation.diagnostics);

    const parentExecution = options.parentExecutionResult;
    if (!parentExecution || !Array.isArray(parentExecution.rows) || !VALID_EXECUTION_STATUSES.includes(parentExecution.status)
      || parentExecution.dimension !== parentSelection.parentDimension) {
      return invalidResult("INVALID_INPUT", parentSelection, childDimension, [diagnostic("PARENT_EXECUTION_INVALID")]);
    }
    if (options.periodKey !== undefined && options.periodKey !== parentExecution.selectedPeriod) return invalidResult("INVALID_INPUT", parentSelection, childDimension, [diagnostic("PERIOD_MISMATCH")]);
    if (options.asOfDay !== undefined && options.asOfDay !== parentExecution.asOfDay) return invalidResult("INVALID_INPUT", parentSelection, childDimension, [diagnostic("AS_OF_MISMATCH")]);

    const parentDiagnostics = [];
    const parentIndex = indexRows(parentExecution.rows, "PARENT", parentDiagnostics);
    if (!parentIndex.valid) return invalidResult("INVALID_INPUT", parentSelection, childDimension, parentDiagnostics);
    const parentRow = parentIndex.result.get(parentSelection.parentKey);
    if (!parentRow) return invalidResult("PARENT_NOT_FOUND", parentSelection, childDimension, [diagnostic("PARENT_NOT_FOUND", parentSelection.parentKey)]);

    const performanceResult = options.performanceResult;
    const facts = options.facts;
    if (!performanceResult || !Array.isArray(performanceResult.rows) || !Array.isArray(facts)) {
      return invalidResult("INVALID_INPUT", parentSelection, childDimension, [diagnostic("SCOPING_INPUT_INVALID")]);
    }
    const parentDimension = parentSelection.parentDimension;
    const scopedPerformanceRows = scopeRows(performanceResult.rows, parentDimension, parentSelection.parentKey, options.authorityContext, false);
    const scopedFacts = scopeRows(facts, parentDimension, parentSelection.parentKey, options.authorityContext, true);
    const scopedPerformanceResult = { ...performanceResult, rows: scopedPerformanceRows };
    const periodContext = options.periodContext || global.BancaTrackerCommercialRollups.buildPeriodContext(performanceResult);
    const childExecution = global.BancaTrackerCommercialExecution.buildExecution({
      performanceResult: scopedPerformanceResult,
      periodContext,
      selectedPeriod: parentExecution.selectedPeriod,
      dimension: childDimension,
      facts: scopedFacts,
      authorityContext: options.authorityContext || null,
      asOfDay: parentExecution.asOfDay,
    });
    const childStatus = global.BancaTrackerCommercialExecutionStatus.buildStatus(childExecution);
    const childPriority = global.BancaTrackerCommercialExecutionPriority.buildPriority(childExecution, childStatus);
    const diagnostics = [];
    if (!validateSnapshot(parentExecution, childExecution, childStatus, childPriority, childDimension, diagnostics)
      || childPriority.status === "INVALID_INPUT" || childStatus.status === "INVALID_INPUT") {
      return invalidResult("INVALID_INPUT", parentSelection, childDimension, diagnostics.concat(diagnostic("CHILD_AUTHORITY_INVALID")));
    }

    const composed = composeRows(childExecution, childStatus, childPriority, diagnostics);
    if (!composed.valid) return invalidResult("INVALID_INPUT", parentSelection, childDimension, diagnostics);
    if ([global.BancaTrackerCommercialRollups.UNMAPPED_KEY, global.BancaTrackerCommercialRollups.UNASSIGNED_KEY].some((key) => composed.rows.some((row) => row.key === key))) diagnostics.push(diagnostic("SENTINEL_CHILD_RETAINED"));
    if (ORGANISATIONAL_DOMAINS.includes(validation.domain)) diagnostics.push(diagnostic("CURRENT_HIERARCHY_SNAPSHOT"));

    const reconciliation = reconcile(parentRow, composed.rows, diagnostics);
    if (!composed.rows.length) diagnostics.push(diagnostic("CHILDREN_EMPTY"));
    const authorityPartial = [childExecution.status, childStatus.status, childPriority.status].some((status) => status !== "READY");
    const reconciliationPartial = reconciliation.actual.status === "DIFFERENCE" || !reconciliation.budget.complete;
    const status = !composed.rows.length ? "EMPTY" : authorityPartial || reconciliationPartial || diagnostics.some((item) => item.code.includes("UNMATCHED")) ? "PARTIAL" : "READY";
    return {
      status,
      periodKey: parentExecution.selectedPeriod,
      asOfDay: parentExecution.asOfDay,
      parent: { dimension: parentDimension, key: parentSelection.parentKey, label: parentSelection.parentLabel || parentRow.label || parentSelection.parentKey },
      domain: validation.domain,
      childDimension,
      allowedChildDimensions: getAllowedDrilldowns(parentDimension),
      scope: { parentDimension, parentKey: parentSelection.parentKey },
      rows: composed.rows,
      reconciliation,
      diagnostics: sortDiagnostics(diagnostics),
    };
  }

  global.BancaTrackerCommercialExecutionDrilldown = Object.freeze({
    PATHS, getAllowedDrilldowns, validateDrilldown, buildDrilldown,
  });
})(window);
