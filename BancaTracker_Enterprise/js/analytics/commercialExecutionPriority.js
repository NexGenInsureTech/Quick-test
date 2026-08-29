/*==============================================================
BancaTracker Enterprise
Version : 8.2.0-dev
File    : commercialExecutionPriority.js
Module  : Analytics
Purpose : Rank supplied execution and reference attention deterministically
==============================================================*/

(function (global) {
  "use strict";

  const VALID_EXECUTION_STATUSES = Object.freeze(["READY", "PARTIAL", "NO_FACT_DATA"]);
  const VALID_ATTENTION_STATUSES = Object.freeze(["READY", "PARTIAL", "NO_ROWS"]);
  const REFERENCE_REASONS = Object.freeze(["BUDGET_REFERENCE_INVALID", "BUDGET_REFERENCE_MISSING"]);

  function stableCompare(left, right) {
    const a = String(left);
    const b = String(right);
    return a < b ? -1 : a > b ? 1 : 0;
  }

  function diagnostic(code, key = null, detail = null) {
    return { code, key, detail };
  }

  function sortDiagnostics(items) {
    return items.sort((left, right) => stableCompare(left.code, right.code) || stableCompare(left.key || "", right.key || ""));
  }

  function indexRows(rows, kind) {
    const byKey = new Map();
    const diagnostics = [];
    let fatal = false;
    rows.forEach((row) => {
      const key = row && row.key;
      if (typeof key !== "string" || !key) {
        diagnostics.push(diagnostic(`${kind}_KEY_MISSING`));
        fatal = true;
      } else if (byKey.has(key)) {
        diagnostics.push(diagnostic(`${kind}_KEY_DUPLICATE`, key));
        fatal = true;
      } else byKey.set(key, row);
    });
    return { byKey, diagnostics, fatal };
  }

  function invalidValidation(executionResult, statusResult, diagnostics) {
    return {
      valid: false,
      executionRows: new Map(), statusRows: new Map(), joined: [],
      sourceExecutionStatus: executionResult && executionResult.status || null,
      sourceAttentionStatus: statusResult && statusResult.status || null,
      diagnostics: sortDiagnostics(diagnostics),
    };
  }

  function validateInputs(executionResult, statusResult) {
    const diagnostics = [];
    if (!executionResult || typeof executionResult !== "object" || !Array.isArray(executionResult.rows)) diagnostics.push(diagnostic("EXECUTION_INPUT_INVALID"));
    if (!statusResult || typeof statusResult !== "object" || !Array.isArray(statusResult.rows)) diagnostics.push(diagnostic("ATTENTION_INPUT_INVALID"));
    if (diagnostics.length) return invalidValidation(executionResult, statusResult, diagnostics);
    if (!VALID_EXECUTION_STATUSES.includes(executionResult.status)) diagnostics.push(diagnostic("SOURCE_EXECUTION_STATUS_INVALID", null, executionResult.status || null));
    if (!VALID_ATTENTION_STATUSES.includes(statusResult.status)) diagnostics.push(diagnostic("SOURCE_ATTENTION_STATUS_INVALID", null, statusResult.status || null));
    if (executionResult.selectedPeriod !== statusResult.periodKey) diagnostics.push(diagnostic("PERIOD_MISMATCH"));
    if (executionResult.asOfDay !== statusResult.asOfDay) diagnostics.push(diagnostic("AS_OF_MISMATCH"));
    if (executionResult.dimension !== statusResult.dimension) diagnostics.push(diagnostic("DIMENSION_MISMATCH"));
    const executionIndex = indexRows(executionResult.rows, "EXECUTION");
    const statusIndex = indexRows(statusResult.rows, "ATTENTION");
    diagnostics.push(...executionIndex.diagnostics, ...statusIndex.diagnostics);
    if (diagnostics.length || executionIndex.fatal || statusIndex.fatal) return invalidValidation(executionResult, statusResult, diagnostics);
    const joined = [];
    executionIndex.byKey.forEach((executionRow, key) => {
      const statusRow = statusIndex.byKey.get(key);
      if (!statusRow) diagnostics.push(diagnostic("EXECUTION_ROW_UNMATCHED", key));
      else joined.push({ key, executionRow, statusRow });
    });
    statusIndex.byKey.forEach((statusRow, key) => {
      if (!executionIndex.byKey.has(key)) diagnostics.push(diagnostic("ATTENTION_ROW_UNMATCHED", key));
    });
    joined.sort((left, right) => stableCompare(left.key, right.key));
    return {
      valid: true,
      executionRows: executionIndex.byKey, statusRows: statusIndex.byKey, joined,
      sourceExecutionStatus: executionResult.status,
      sourceAttentionStatus: statusResult.status,
      diagnostics: sortDiagnostics(diagnostics),
    };
  }

  function projectionBasis(row) {
    const gap = row.projectedBudgetGap;
    const projectionAvailable = typeof gap === "number" && Number.isFinite(gap);
    const hasProjectedShortfall = projectionAvailable && gap < 0;
    return {
      projectionAvailable,
      projectionEvidence: !projectionAvailable ? "UNAVAILABLE" : hasProjectedShortfall ? "SHORTFALL" : "NON_SHORTFALL",
      projectionGroup: !projectionAvailable ? 2 : hasProjectedShortfall ? 0 : 1,
      hasProjectedShortfall,
      projectedShortfallAmount: hasProjectedShortfall ? -gap : projectionAvailable ? 0 : null,
    };
  }

  function paceBasis(row) {
    const gap = row.paceGap;
    const paceAvailable = typeof gap === "number" && Number.isFinite(gap);
    const behindPace = paceAvailable && gap < 0;
    return {
      paceAvailable,
      paceEvidence: !paceAvailable ? "UNAVAILABLE" : behindPace ? "BEHIND" : "NOT_BEHIND",
      paceGroup: !paceAvailable ? 2 : behindPace ? 0 : 1,
      behindPace,
      paceGapMagnitude: behindPace ? -gap : paceAvailable ? 0 : null,
    };
  }

  function executionComparator(left, right) {
    return left.priorityBasis.projectionGroup - right.priorityBasis.projectionGroup
      || (right.priorityBasis.projectedShortfallAmount || 0) - (left.priorityBasis.projectedShortfallAmount || 0)
      || left.priorityBasis.paceGroup - right.priorityBasis.paceGroup
      || (right.priorityBasis.paceGapMagnitude || 0) - (left.priorityBasis.paceGapMagnitude || 0)
      || right.priorityBasis.budget - left.priorityBasis.budget
      || stableCompare(left.key, right.key);
  }

  function copyExecutionSource(row) {
    return {
      key: row.key, label: row.label, actualToDate: row.actualToDate,
      budget: row.budget, projectedBudgetGap: row.projectedBudgetGap,
      paceGap: row.paceGap, projectedMonthEndActual: row.projectedMonthEndActual,
      projectedAchievementPct: row.projectedAchievementPct,
      requiredDailyRunRate: row.requiredDailyRunRate,
    };
  }

  function copyStatusSource(row) {
    return {
      key: row.key, label: row.label,
      executionAttention: row.executionAttention,
      referenceAttention: row.referenceAttention,
      projectionStatus: row.projectionStatus,
      paceStatus: row.paceStatus,
      budgetReferenceStatus: row.budgetReferenceStatus,
      budgetPositionStatus: row.budgetPositionStatus,
      attentionReasons: Array.isArray(row.attentionReasons) ? [...row.attentionReasons] : [],
    };
  }

  function buildExecutionPriority(joinedRows, diagnostics = []) {
    const eligible = [];
    let executionEligibleCount = 0;
    let executionMalformedCount = 0;
    let projectionUnavailableCount = 0;
    let paceUnavailableCount = 0;
    joinedRows.forEach(({ key, executionRow, statusRow }) => {
      if (statusRow.executionAttention !== true) return;
      executionEligibleCount += 1;
      const budget = executionRow.budget;
      if (typeof budget !== "number" || !Number.isFinite(budget) || budget <= 0) {
        executionMalformedCount += 1;
        diagnostics.push(diagnostic("EXECUTION_ATTENTION_WITH_INVALID_BUDGET", key));
        return;
      }
      const projection = projectionBasis(executionRow);
      const pace = paceBasis(executionRow);
      if (!projection.projectionAvailable) { projectionUnavailableCount += 1; diagnostics.push(diagnostic("PROJECTED_GAP_UNAVAILABLE", key)); }
      if (!pace.paceAvailable) { paceUnavailableCount += 1; diagnostics.push(diagnostic("PACE_GAP_UNAVAILABLE", key)); }
      eligible.push({
        priorityRank: null, key, label: statusRow.label || executionRow.label || key,
        priorityBasis: { ...projection, ...pace, budget, stableKey: key },
        attentionReasons: Array.isArray(statusRow.attentionReasons) ? [...statusRow.attentionReasons] : [],
        sourceMeasures: copyExecutionSource(executionRow),
        sourceStatus: copyStatusSource(statusRow),
      });
    });
    eligible.sort(executionComparator).forEach((row, index) => { row.priorityRank = index + 1; });
    return { rows: eligible, executionEligibleCount, executionMalformedCount, projectionUnavailableCount, paceUnavailableCount };
  }

  function canonicalReferenceReason(statusRow) {
    const reasons = Array.isArray(statusRow.attentionReasons) ? statusRow.attentionReasons : [];
    return reasons.filter((code) => REFERENCE_REASONS.includes(code)).sort(stableCompare)[0] || null;
  }

  function buildReferencePriority(joinedRows, diagnostics = []) {
    const eligible = [];
    let referenceEligibleCount = 0;
    let referenceMalformedCount = 0;
    joinedRows.forEach(({ key, statusRow }) => {
      if (statusRow.referenceAttention !== true) return;
      referenceEligibleCount += 1;
      const referenceReasonCode = canonicalReferenceReason(statusRow);
      if (!referenceReasonCode) {
        referenceMalformedCount += 1;
        diagnostics.push(diagnostic("REFERENCE_ATTENTION_REASON_MISSING", key));
        return;
      }
      eligible.push({
        priorityRank: null, key, label: statusRow.label || key, referenceReasonCode,
        attentionReasons: Array.isArray(statusRow.attentionReasons) ? [...statusRow.attentionReasons] : [],
        sourceStatus: copyStatusSource(statusRow),
      });
    });
    eligible.sort((left, right) => stableCompare(left.referenceReasonCode, right.referenceReasonCode) || stableCompare(left.key, right.key))
      .forEach((row, index) => { row.priorityRank = index + 1; });
    return { rows: eligible, referenceEligibleCount, referenceMalformedCount };
  }

  function emptySummary() {
    return {
      joinedRowCount: 0, executionEligibleCount: 0, executionRankedCount: 0,
      executionMalformedCount: 0, referenceEligibleCount: 0, referenceRankedCount: 0,
      referenceMalformedCount: 0, unmatchedExecutionCount: 0, unmatchedStatusCount: 0,
      projectionUnavailableCount: 0, paceUnavailableCount: 0,
    };
  }

  function buildPriority(executionResult, statusResult) {
    const validation = validateInputs(executionResult, statusResult);
    const context = {
      periodKey: executionResult && executionResult.selectedPeriod || null,
      asOfDay: executionResult && executionResult.asOfDay,
      dimension: executionResult && executionResult.dimension || null,
      sourceExecutionStatus: validation.sourceExecutionStatus,
      sourceAttentionStatus: validation.sourceAttentionStatus,
    };
    if (!validation.valid) return {
      status: "INVALID_INPUT", ...context, rankingApplicable: false,
      executionPriority: [], referencePriority: [], nonEligible: [],
      summary: emptySummary(), diagnostics: validation.diagnostics,
    };
    const unmatchedExecutionCount = validation.diagnostics.filter((item) => item.code === "EXECUTION_ROW_UNMATCHED").length;
    const unmatchedStatusCount = validation.diagnostics.filter((item) => item.code === "ATTENTION_ROW_UNMATCHED").length;
    const sourcePartial = context.sourceExecutionStatus === "PARTIAL" || context.sourceExecutionStatus === "NO_FACT_DATA" || context.sourceAttentionStatus === "PARTIAL";
    if (context.dimension === "OVERALL") return {
      status: validation.diagnostics.length || sourcePartial ? "PARTIAL" : "READY", ...context, rankingApplicable: false,
      executionPriority: [], referencePriority: [],
      nonEligible: validation.joined.map(({ key }) => ({ key, executionPriorityRank: null, referencePriorityRank: null })),
      summary: { ...emptySummary(), joinedRowCount: validation.joined.length, unmatchedExecutionCount, unmatchedStatusCount },
      diagnostics: sortDiagnostics([...validation.diagnostics, diagnostic("OVERALL_RANKING_NOT_APPLICABLE")]),
    };
    const diagnostics = [...validation.diagnostics];
    const execution = buildExecutionPriority(validation.joined, diagnostics);
    const reference = buildReferencePriority(validation.joined, diagnostics);
    const rankedExecutionKeys = new Set(execution.rows.map((row) => row.key));
    const rankedReferenceKeys = new Set(reference.rows.map((row) => row.key));
    const nonEligible = validation.joined.filter(({ key }) => !rankedExecutionKeys.has(key) && !rankedReferenceKeys.has(key))
      .map(({ key }) => ({ key, executionPriorityRank: null, referencePriorityRank: null }));
    const hasPartialCondition = sourcePartial || unmatchedExecutionCount || unmatchedStatusCount || execution.executionMalformedCount || reference.referenceMalformedCount;
    return {
      status: hasPartialCondition ? "PARTIAL" : "READY", ...context, rankingApplicable: true,
      executionPriority: execution.rows, referencePriority: reference.rows, nonEligible,
      summary: {
        joinedRowCount: validation.joined.length,
        executionEligibleCount: execution.executionEligibleCount,
        executionRankedCount: execution.rows.length,
        executionMalformedCount: execution.executionMalformedCount,
        referenceEligibleCount: reference.referenceEligibleCount,
        referenceRankedCount: reference.rows.length,
        referenceMalformedCount: reference.referenceMalformedCount,
        unmatchedExecutionCount, unmatchedStatusCount,
        projectionUnavailableCount: execution.projectionUnavailableCount,
        paceUnavailableCount: execution.paceUnavailableCount,
      },
      diagnostics: sortDiagnostics(diagnostics),
    };
  }

  function getPriorityExplanation(row) {
    if (!row || !row.priorityBasis) return "Reference attention is ordered by canonical reference reason and stable entity key.";
    if (row.priorityBasis.hasProjectedShortfall) return "Ranked by supplied projected Budget shortfall, then pace-gap magnitude, monthly Budget, and stable entity key.";
    if (row.priorityBasis.behindPace) return "Execution attention is driven by behind linear pace; the supplied linear projection does not show a measurable Budget shortfall.";
    return "Ranked using available supplied projection and pace evidence, monthly Budget, and stable entity key.";
  }

  global.BancaTrackerCommercialExecutionPriority = Object.freeze({
    validateInputs, buildExecutionPriority, buildReferencePriority,
    buildPriority, getPriorityExplanation,
  });
})(window);
