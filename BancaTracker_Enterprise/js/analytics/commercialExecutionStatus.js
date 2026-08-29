/*==============================================================
BancaTracker Enterprise
Version : 8.2.0-dev
File    : commercialExecutionStatus.js
Module  : Analytics
Purpose : Interpret governed commercial execution results without recalculation
==============================================================*/

(function (global) {
  "use strict";

  const VALID_SOURCE_STATUSES = Object.freeze(["READY", "PARTIAL", "NO_FACT_DATA"]);
  const REASON_ORDER = Object.freeze([
    "BUDGET_REFERENCE_MISSING", "BUDGET_REFERENCE_INVALID", "NO_OBSERVATIONS",
    "BUDGET_ACHIEVED", "BUDGET_EXCEEDED", "BUDGET_NOT_ACHIEVED",
    "PROJECTED_SHORTFALL", "BEHIND_LINEAR_PACE", "ZERO_BUDGET_REFERENCE",
  ]);
  const STATUS_LABELS = Object.freeze({
    NO_OBSERVATIONS: "No observations",
    OBSERVATIONS_PRESENT: "Observations present",
    BUDGET_MISSING: "Budget missing",
    BUDGET_ZERO: "Budget zero",
    BUDGET_POSITIVE: "Budget positive",
    BUDGET_INVALID: "Budget invalid",
    NOT_APPLICABLE: "Not applicable",
    NOT_AVAILABLE: "Not available",
    BUDGET_NOT_ACHIEVED: "Budget not achieved",
    BUDGET_ACHIEVED: "Budget achieved",
    BUDGET_EXCEEDED: "Budget exceeded",
    BEHIND_LINEAR_PACE: "Behind linear pace",
    AT_LINEAR_PACE: "At linear pace",
    AHEAD_OF_LINEAR_PACE: "Ahead of linear pace",
    PROJECTED_SHORTFALL: "Projected shortfall",
    PROJECTED_EXACT_BUDGET: "Projected at exact Budget",
    PROJECTED_TO_EXCEED: "Projected to exceed Budget",
    BUDGET_REFERENCE_MISSING: "Budget reference missing",
    BUDGET_REFERENCE_INVALID: "Budget reference invalid",
    ZERO_BUDGET_REFERENCE: "Zero Budget reference",
    NO_INTERPRETATION: "No interpretation",
  });

  function classifyObservation(asOfDay) {
    return asOfDay > 0 ? "OBSERVATIONS_PRESENT" : "NO_OBSERVATIONS";
  }

  function classifyReference(budget) {
    if (budget === null) return "BUDGET_MISSING";
    if (typeof budget !== "number" || !Number.isFinite(budget) || budget < 0) return "BUDGET_INVALID";
    if (budget === 0) return "BUDGET_ZERO";
    return "BUDGET_POSITIVE";
  }

  function classifyBudgetPosition(actualToDate, budget) {
    if (classifyReference(budget) !== "BUDGET_POSITIVE") return "NOT_APPLICABLE";
    if (actualToDate < budget) return "BUDGET_NOT_ACHIEVED";
    if (actualToDate === budget) return "BUDGET_ACHIEVED";
    return "BUDGET_EXCEEDED";
  }

  function classifyPace(paceGap, budget, asOfDay) {
    if (classifyReference(budget) !== "BUDGET_POSITIVE") return "NOT_APPLICABLE";
    if (classifyObservation(asOfDay) === "NO_OBSERVATIONS") return "NO_OBSERVATIONS";
    if (paceGap < 0) return "BEHIND_LINEAR_PACE";
    if (paceGap === 0) return "AT_LINEAR_PACE";
    return paceGap > 0 ? "AHEAD_OF_LINEAR_PACE" : "NOT_AVAILABLE";
  }

  function classifyProjection(projectedMonthEndActual, budget, asOfDay) {
    if (classifyReference(budget) !== "BUDGET_POSITIVE") return "NOT_APPLICABLE";
    if (classifyObservation(asOfDay) === "NO_OBSERVATIONS" || projectedMonthEndActual === null) return "NOT_AVAILABLE";
    if (projectedMonthEndActual < budget) return "PROJECTED_SHORTFALL";
    if (projectedMonthEndActual === budget) return "PROJECTED_EXACT_BUDGET";
    return projectedMonthEndActual > budget ? "PROJECTED_TO_EXCEED" : "NOT_AVAILABLE";
  }

  function buildAttentionReasons(states) {
    const reasons = [];
    if (states.budgetReferenceStatus === "BUDGET_MISSING") reasons.push("BUDGET_REFERENCE_MISSING");
    if (states.budgetReferenceStatus === "BUDGET_INVALID") reasons.push("BUDGET_REFERENCE_INVALID");
    if (states.observationStatus === "NO_OBSERVATIONS") reasons.push("NO_OBSERVATIONS");
    if (states.budgetPositionStatus !== "NOT_APPLICABLE") reasons.push(states.budgetPositionStatus);
    if (states.projectionStatus === "PROJECTED_SHORTFALL") reasons.push("PROJECTED_SHORTFALL");
    if (states.paceStatus === "BEHIND_LINEAR_PACE") reasons.push("BEHIND_LINEAR_PACE");
    if (states.budgetReferenceStatus === "BUDGET_ZERO") reasons.push("ZERO_BUDGET_REFERENCE");
    return REASON_ORDER.filter((code) => reasons.includes(code));
  }

  function choosePrimaryStatus(states) {
    if (states.budgetReferenceStatus === "BUDGET_MISSING") return "BUDGET_REFERENCE_MISSING";
    if (states.budgetReferenceStatus === "BUDGET_INVALID") return "BUDGET_REFERENCE_INVALID";
    if (states.observationStatus === "NO_OBSERVATIONS") return "NO_OBSERVATIONS";
    if (states.budgetPositionStatus === "BUDGET_EXCEEDED") return "BUDGET_EXCEEDED";
    if (states.budgetPositionStatus === "BUDGET_ACHIEVED") return "BUDGET_ACHIEVED";
    if (states.projectionStatus === "PROJECTED_SHORTFALL") return "PROJECTED_SHORTFALL";
    if (states.paceStatus === "BEHIND_LINEAR_PACE") return "BEHIND_LINEAR_PACE";
    if (states.projectionStatus === "PROJECTED_TO_EXCEED") return "PROJECTED_TO_EXCEED";
    if (states.projectionStatus === "PROJECTED_EXACT_BUDGET") return "PROJECTED_EXACT_BUDGET";
    if (states.paceStatus === "AT_LINEAR_PACE") return "AT_LINEAR_PACE";
    if (states.paceStatus === "AHEAD_OF_LINEAR_PACE") return "AHEAD_OF_LINEAR_PACE";
    return "NO_INTERPRETATION";
  }

  function classifyExecutionRow(row, asOfDay) {
    const observationStatus = classifyObservation(asOfDay);
    const budgetReferenceStatus = classifyReference(row.budget);
    const budgetPositionStatus = classifyBudgetPosition(row.actualToDate, row.budget);
    const paceStatus = classifyPace(row.paceGap, row.budget, asOfDay);
    const projectionStatus = classifyProjection(row.projectedMonthEndActual, row.budget, asOfDay);
    const states = { observationStatus, budgetReferenceStatus, budgetPositionStatus, paceStatus, projectionStatus };
    const budgetComplete = budgetPositionStatus === "BUDGET_ACHIEVED" || budgetPositionStatus === "BUDGET_EXCEEDED";
    const executionAttention = budgetReferenceStatus === "BUDGET_POSITIVE"
      && observationStatus === "OBSERVATIONS_PRESENT"
      && !budgetComplete
      && (projectionStatus === "PROJECTED_SHORTFALL" || paceStatus === "BEHIND_LINEAR_PACE");
    const referenceAttention = budgetReferenceStatus === "BUDGET_MISSING" || budgetReferenceStatus === "BUDGET_INVALID";
    const attentionReasons = buildAttentionReasons(states);
    return {
      key: row.key, label: row.label,
      ...states,
      primaryStatus: choosePrimaryStatus(states),
      executionAttention, referenceAttention, attentionReasons,
      explanations: attentionReasons.map((code) => ({ code, label: getStatusLabel(code) })),
      source: { ...row },
    };
  }

  function summarize(rows) {
    const count = (field, value) => rows.filter((row) => row[field] === value).length;
    return {
      totalRows: rows.length,
      rowsWithPositiveBudget: count("budgetReferenceStatus", "BUDGET_POSITIVE"),
      rowsWithMissingBudget: count("budgetReferenceStatus", "BUDGET_MISSING"),
      rowsWithZeroBudget: count("budgetReferenceStatus", "BUDGET_ZERO"),
      rowsWithObservations: count("observationStatus", "OBSERVATIONS_PRESENT"),
      rowsWithoutObservations: count("observationStatus", "NO_OBSERVATIONS"),
      budgetAchievedCount: count("budgetPositionStatus", "BUDGET_ACHIEVED"),
      budgetExceededCount: count("budgetPositionStatus", "BUDGET_EXCEEDED"),
      aheadPaceCount: count("paceStatus", "AHEAD_OF_LINEAR_PACE"),
      atPaceCount: count("paceStatus", "AT_LINEAR_PACE"),
      behindPaceCount: count("paceStatus", "BEHIND_LINEAR_PACE"),
      projectedShortfallCount: count("projectionStatus", "PROJECTED_SHORTFALL"),
      projectedExactCount: count("projectionStatus", "PROJECTED_EXACT_BUDGET"),
      projectedExceedCount: count("projectionStatus", "PROJECTED_TO_EXCEED"),
      executionAttentionCount: rows.filter((row) => row.executionAttention).length,
      referenceAttentionCount: rows.filter((row) => row.referenceAttention).length,
    };
  }

  function buildStatus(executionResult) {
    if (!executionResult || typeof executionResult !== "object" || !Array.isArray(executionResult.rows)) {
      return { status: "INVALID_INPUT", sourceExecutionStatus: executionResult && executionResult.status || null, periodKey: null, asOfDay: null, dimension: null, rows: [], summary: summarize([]), executionAttentionRows: [], referenceAttentionRows: [], diagnostics: { reason: "INVALID_EXECUTION_RESULT" } };
    }
    const sourceExecutionStatus = executionResult.status || null;
    const sourceValid = VALID_SOURCE_STATUSES.includes(sourceExecutionStatus);
    const rows = sourceValid ? executionResult.rows.map((row) => classifyExecutionRow(row, executionResult.asOfDay)) : [];
    const status = !sourceValid ? "INVALID_INPUT" : !rows.length ? "NO_ROWS" : sourceExecutionStatus === "READY" ? "READY" : "PARTIAL";
    return {
      status, sourceExecutionStatus,
      periodKey: executionResult.selectedPeriod || null,
      asOfDay: executionResult.asOfDay,
      dimension: executionResult.dimension || null,
      rows, summary: summarize(rows),
      executionAttentionRows: rows.filter((row) => row.executionAttention),
      referenceAttentionRows: rows.filter((row) => row.referenceAttention),
      diagnostics: { sourceDiagnostics: executionResult.diagnostics || null },
    };
  }

  function getStatusLabel(code) {
    return STATUS_LABELS[code] || code || "";
  }

  global.BancaTrackerCommercialExecutionStatus = Object.freeze({
    classifyObservation, classifyReference, classifyBudgetPosition, classifyPace,
    classifyProjection, buildAttentionReasons, classifyExecutionRow, summarize,
    buildStatus, getStatusLabel,
  });
})(window);
