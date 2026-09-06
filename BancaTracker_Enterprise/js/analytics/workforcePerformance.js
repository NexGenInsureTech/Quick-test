/*==============================================================
BancaTracker Enterprise
Version : 8.3.0
File    : workforcePerformance.js
Module  : Analytics Foundation
Purpose : Compose attributed business, hierarchy roll-up and deployment context
==============================================================*/

(function (global) {
  "use strict";

  function actual(value) { return typeof value === "number" && Number.isFinite(value) ? value : 0; }
  function freeze(items) { return Object.freeze(items); }
  function diagnostics(values) { return freeze([...new Set((values || []).filter(Boolean))].sort()); }
  function sortedRows(rows, field) { return freeze(rows.map((row) => Object.freeze(row)).sort((a, b) => String(a[field]).localeCompare(String(b[field])) || String(a.businessDate || "").localeCompare(String(b.businessDate || "")))); }
  function attributed(item) { return Boolean(item && item.employeeId); }

  function buildEmployeePerformance(attributionResults, reconciliationResult) {
    const source = Array.isArray(attributionResults) ? attributionResults : [];
    const denominator = reconciliationResult && reconciliationResult.coverage ? reconciliationResult.coverage.attributedSignedActual : source.filter(attributed).reduce((total, item) => total + actual(item.signedActual), 0);
    const rows = new Map();
    source.forEach((item) => {
      if (!attributed(item)) return;
      if (!rows.has(item.employeeId)) rows.set(item.employeeId, { employeeId: item.employeeId, directAttributedRecordCount: 0, directSignedActual: 0, diagnostics: [] });
      const row = rows.get(item.employeeId); row.directAttributedRecordCount += 1; row.directSignedActual += actual(item.signedActual); (item.diagnostics || []).forEach((code) => row.diagnostics.push(code));
    });
    return sortedRows([...rows.values()].map((row) => ({ ...row, directContributionPercent: denominator === 0 ? null : row.directSignedActual / denominator * 100, attributionStatus: "ATTRIBUTED", diagnostics: diagnostics(row.diagnostics) })), "employeeId");
  }

  function buildTeamPerformance(rollupRecords) {
    const rows = new Map();
    const ensure = (employeeId) => {
      if (!rows.has(employeeId)) rows.set(employeeId, { managerEmployeeId: employeeId, ownDirectAttributedRecordCount: 0, ownDirectSignedActual: 0, descendantAttributedRecordCount: 0, descendantSignedActual: 0, teamAttributedRecordCount: 0, teamSignedActual: 0, rootEmployeeId: null, hierarchyStatuses: [], diagnostics: [] });
      return rows.get(employeeId);
    };
    (Array.isArray(rollupRecords) ? rollupRecords : []).forEach((item) => {
      if (!item || !item.directOwnerId) return;
      const value = actual(item.signedActual); const nodeIds = [...new Set(item.rollupNodeIds || [])];
      nodeIds.forEach((employeeId) => {
        const row = ensure(employeeId); row.teamAttributedRecordCount += 1; row.teamSignedActual += value; row.hierarchyStatuses.push(item.hierarchyStatus || "UNAVAILABLE"); (item.hierarchyDiagnostics || item.diagnostics || []).forEach((code) => row.diagnostics.push(code));
        if (employeeId === item.directOwnerId) { row.ownDirectAttributedRecordCount += 1; row.ownDirectSignedActual += value; }
        else { row.descendantAttributedRecordCount += 1; row.descendantSignedActual += value; }
        if (item.rootEmployeeId && !row.rootEmployeeId) row.rootEmployeeId = item.rootEmployeeId;
        else if (item.rootEmployeeId && row.rootEmployeeId !== item.rootEmployeeId) { row.rootEmployeeId = null; row.diagnostics.push("WORKFORCE_TEAM_ROOT_AMBIGUOUS"); }
      });
    });
    return sortedRows([...rows.values()].map((row) => {
      const statuses = [...new Set(row.hierarchyStatuses)];
      const teamStatus = statuses.length === 1 && ["RESOLVED", "ROOT"].includes(statuses[0]) ? "READY" : statuses.includes("NO_RELATIONSHIP") ? "NO_RELATIONSHIP" : statuses.some((status) => status !== "RESOLVED" && status !== "ROOT") ? "PARTIAL_HIERARCHY" : "READY";
      return { ...row, hierarchyStatuses: freeze(statuses.sort()), teamStatus, teamMembership: "INCLUSIVE_SELF_AND_DESCENDANTS", diagnostics: diagnostics(row.diagnostics) };
    }), "managerEmployeeId");
  }

  function contextFor(contextsByBusinessDate, businessDate) {
    if (contextsByBusinessDate instanceof Map) return contextsByBusinessDate.get(businessDate) || null;
    return contextsByBusinessDate && contextsByBusinessDate[businessDate] || null;
  }

  function buildDeploymentAlignment(attributionResults, workforceDeploymentContextsByBusinessDate, options = {}) {
    const rows = new Map(); const ensure = (employeeId, businessDate) => {
      const key = `${employeeId}|${businessDate}`;
      if (!rows.has(key)) rows.set(key, { employeeId, businessDate, directAttributedRecordCount: 0, directSignedActual: 0, deploymentCount: 0, deploymentStatus: "NO_DEPLOYMENT", diagnostics: [] });
      return rows.get(key);
    };
    (Array.isArray(attributionResults) ? attributionResults : []).forEach((item) => {
      if (!attributed(item)) return;
      const row = ensure(item.employeeId, item.businessDate || null); row.directAttributedRecordCount += 1; row.directSignedActual += actual(item.signedActual);
    });
    const contexts = workforceDeploymentContextsByBusinessDate instanceof Map ? [...workforceDeploymentContextsByBusinessDate.entries()] : Object.entries(workforceDeploymentContextsByBusinessDate || {});
    contexts.forEach(([businessDate, context]) => {
      if (!context || context.status !== "READY") return;
      (context.deploymentsByEmployee instanceof Map ? context.deploymentsByEmployee : new Map()).forEach((deployments, employeeId) => {
        const row = ensure(employeeId, businessDate); row.deploymentCount = deployments.length; row.deploymentStatus = "RESOLVED";
      });
    });
    (options.employeeIds || []).forEach((employeeId) => ensure(employeeId, options.businessDate || null));
    return sortedRows([...rows.values()].map((row) => {
      const context = contextFor(workforceDeploymentContextsByBusinessDate, row.businessDate);
      const unavailable = row.businessDate && (!context || context.status !== "READY");
      const classification = unavailable ? "DEPLOYMENT_CONTEXT_UNAVAILABLE" : row.deploymentCount && row.directAttributedRecordCount ? "DEPLOYED_WITH_ATTRIBUTED_BUSINESS" : row.deploymentCount ? "DEPLOYED_WITHOUT_ATTRIBUTED_BUSINESS" : row.directAttributedRecordCount ? "ATTRIBUTED_BUSINESS_WITHOUT_DEPLOYMENT" : "NO_DEPLOYMENT_NO_ATTRIBUTED_BUSINESS";
      return { ...row, classification, diagnostics: diagnostics(unavailable ? [...row.diagnostics, ...((context && context.diagnostics) || ["WORKFORCE_DEPLOYMENT_CONTEXT_UNAVAILABLE"])] : row.diagnostics) };
    }), "employeeId");
  }

  function validateReconciliation({ attributionResults, rollupRecords, employeeRows, deploymentRows, reconciliationResult } = {}) {
    const attributedResults = (Array.isArray(attributionResults) ? attributionResults : []).filter(attributed);
    const attributedSignedActual = attributedResults.reduce((total, item) => total + actual(item.signedActual), 0);
    const directRows = Array.isArray(employeeRows) ? employeeRows : buildEmployeePerformance(attributionResults, reconciliationResult);
    const employeeSignedActual = directRows.reduce((total, row) => total + actual(row.directSignedActual), 0);
    const rollupDirect = (Array.isArray(rollupRecords) ? rollupRecords : []).filter((item) => item && item.directOwnerId).reduce((total, item) => total + actual(item.signedActual), 0);
    const alignmentSignedActual = (Array.isArray(deploymentRows) ? deploymentRows : buildDeploymentAlignment(attributionResults, new Map())).reduce((total, row) => total + actual(row.directSignedActual), 0);
    const diagnosticsList = [];
    if (employeeSignedActual !== attributedSignedActual) diagnosticsList.push("WORKFORCE_EMPLOYEE_DIRECT_TOTAL_MISMATCH");
    if (rollupRecords && rollupDirect !== attributedSignedActual) diagnosticsList.push("WORKFORCE_HIERARCHY_DIRECT_TOTAL_MISMATCH");
    if (alignmentSignedActual !== attributedSignedActual) diagnosticsList.push("WORKFORCE_DEPLOYMENT_ALIGNMENT_TOTAL_MISMATCH");
    if (reconciliationResult && reconciliationResult.status !== "RECONCILED") diagnosticsList.push("WORKFORCE_ATTRIBUTION_RECONCILIATION_UNRECONCILED");
    return Object.freeze({ status: diagnosticsList.length ? "UNRECONCILED" : "RECONCILED", attributedSignedActual, employeeSignedActual, hierarchyDirectSignedActual: rollupDirect, deploymentAlignmentSignedActual: alignmentSignedActual, diagnostics: diagnostics(diagnosticsList) });
  }

  function buildCoverage(reconciliationResult, rollupRecords, deploymentRows) {
    const hierarchy = { attributedRecordCount: 0, resolvedRecordCount: 0, partialRecordCount: 0, noRelationshipRecordCount: 0, unavailableRecordCount: 0 };
    (Array.isArray(rollupRecords) ? rollupRecords : []).forEach((item) => {
      if (!item || !item.directOwnerId) return;
      hierarchy.attributedRecordCount += 1;
      if (["RESOLVED", "ROOT"].includes(item.hierarchyStatus)) hierarchy.resolvedRecordCount += 1;
      else if (item.hierarchyStatus === "NO_RELATIONSHIP") hierarchy.noRelationshipRecordCount += 1;
      else if (item.hierarchyStatus === "HIERARCHY_CONTEXT_UNAVAILABLE") hierarchy.unavailableRecordCount += 1;
      else hierarchy.partialRecordCount += 1;
    });
    const deployment = { rowCount: 0, deployedWithAttributedBusinessCount: 0, deployedWithoutAttributedBusinessCount: 0, attributedBusinessWithoutDeploymentCount: 0, noDeploymentNoAttributedBusinessCount: 0, unavailableContextCount: 0 };
    (Array.isArray(deploymentRows) ? deploymentRows : []).forEach((row) => {
      deployment.rowCount += 1;
      if (row.classification === "DEPLOYED_WITH_ATTRIBUTED_BUSINESS") deployment.deployedWithAttributedBusinessCount += 1;
      else if (row.classification === "DEPLOYED_WITHOUT_ATTRIBUTED_BUSINESS") deployment.deployedWithoutAttributedBusinessCount += 1;
      else if (row.classification === "ATTRIBUTED_BUSINESS_WITHOUT_DEPLOYMENT") deployment.attributedBusinessWithoutDeploymentCount += 1;
      else if (row.classification === "NO_DEPLOYMENT_NO_ATTRIBUTED_BUSINESS") deployment.noDeploymentNoAttributedBusinessCount += 1;
      else if (row.classification === "DEPLOYMENT_CONTEXT_UNAVAILABLE") deployment.unavailableContextCount += 1;
    });
    return Object.freeze({ attribution: reconciliationResult && reconciliationResult.coverage || null, hierarchy: Object.freeze(hierarchy), deployment: Object.freeze(deployment) });
  }

  const UNMAPPED = "__UNMAPPED__";
  function reference(record, index) { return record && (record.recordId || record.canonicalRecordReference || record.sourceRecordId) ? String(record.recordId || record.canonicalRecordReference || record.sourceRecordId) : `INPUT_INDEX:${index}`; }
  function key(value) { return value === null || value === undefined || value === "" ? UNMAPPED : String(value); }
  function fieldFor(dimension) { return ({ BANK: "bankId", BRANCH: "branchId", ZONE: "zoneId", STATE: "stateId", MONTH: "monthKey", FY: "fy", LOB: "lob", PRODUCT: "productCode" })[dimension] || null; }
  function dimensionValue(record, result, rollup, dimension) {
    if (dimension === "EMPLOYEE") return key((result && result.employeeId) || (rollup && rollup.directOwnerId));
    if (dimension === "MANAGER") return key(rollup && rollup.directManagerId);
    const field = fieldFor(dimension); return key(field && record && record[field]);
  }
  function parentMatches(pair, parentSelection) {
    if (!parentSelection || !(parentSelection.dimension || parentSelection.parentDimension)) return true;
    const dimension = parentSelection.dimension || parentSelection.parentDimension; const parentKey = key(parentSelection.key !== undefined ? parentSelection.key : parentSelection.parentKey);
    return dimensionValue(pair.record, pair.result, pair.rollup, dimension) === parentKey;
  }
  function pairInputs(canonicalRecords, detachedAttributionResults, hierarchyRollupRecords) {
    const results = new Map((Array.isArray(detachedAttributionResults) ? detachedAttributionResults : []).map((item, index) => [reference(item, index), item]));
    const rollups = new Map((Array.isArray(hierarchyRollupRecords) ? hierarchyRollupRecords : []).map((item, index) => [reference(item, index), item]));
    return (Array.isArray(canonicalRecords) ? canonicalRecords : []).map((record, index) => ({ record, result: results.get(reference(record, index)) || null, rollup: rollups.get(reference(record, index)) || null, reference: reference(record, index) }));
  }
  function reconcileSlice({ canonicalRecords, detachedAttributionResults, hierarchyRollupRecords, parentSelection } = {}) {
    const pairs = pairInputs(canonicalRecords, detachedAttributionResults, hierarchyRollupRecords).filter((pair) => parentMatches(pair, parentSelection)); const issue = [];
    let underlyingSignedActual = 0, attributedSignedActual = 0, unattributedSignedActual = 0, directSignedActual = 0, attributedRecordCount = 0, unattributedRecordCount = 0;
    pairs.forEach((pair) => {
      const sourceActual = actual(pair.record && pair.record.premium); underlyingSignedActual += sourceActual;
      if (!pair.result) { issue.push("WORKFORCE_SLICE_ATTRIBUTION_RESULT_MISSING"); unattributedRecordCount += 1; unattributedSignedActual += sourceActual; return; }
      if (actual(pair.result.signedActual) !== sourceActual) issue.push("WORKFORCE_SLICE_SIGNED_ACTUAL_MISMATCH");
      if (attributed(pair.result)) { attributedRecordCount += 1; attributedSignedActual += actual(pair.result.signedActual); directSignedActual += actual(pair.result.signedActual); }
      else { unattributedRecordCount += 1; unattributedSignedActual += actual(pair.result.signedActual); }
    });
    if (underlyingSignedActual !== attributedSignedActual + unattributedSignedActual) issue.push("WORKFORCE_SLICE_ATTRIBUTION_TOTAL_MISMATCH");
    return Object.freeze({ status: issue.length ? "UNRECONCILED" : "RECONCILED", parentSelection: parentSelection || null, underlyingRecordCount: pairs.length, attributedRecordCount, unattributedRecordCount, underlyingSignedActual, attributedSignedActual, unattributedSignedActual, directSignedActual, diagnostics: diagnostics(issue) });
  }
  function buildDiagnostics(input = {}) {
    const pairs = pairInputs(input.canonicalRecords, input.detachedAttributionResults, input.hierarchyRollupRecords).filter((pair) => parentMatches(pair, input.parentSelection));
    const reconciliation = reconcileSlice(input); const temporalStatusCounts = {}, hierarchyStatusCounts = {};
    pairs.forEach((pair) => { const temporal = pair.result && pair.result.temporalStatus || "UNAVAILABLE"; temporalStatusCounts[temporal] = (temporalStatusCounts[temporal] || 0) + 1; const hierarchy = pair.rollup && pair.rollup.hierarchyStatus || "MISSING"; hierarchyStatusCounts[hierarchy] = (hierarchyStatusCounts[hierarchy] || 0) + 1; });
    const alignment = buildDeploymentAlignment(pairs.map((pair) => pair.result).filter(Boolean), input.workforceDeploymentContextsByBusinessDate, input);
    const coverage = buildCoverage({ coverage: { attributedRecordCoveragePercent: reconciliation.underlyingRecordCount ? reconciliation.attributedRecordCount / reconciliation.underlyingRecordCount * 100 : null, grossAbsoluteAttributedValueCoveragePercent: null, attributedRecordCount: reconciliation.attributedRecordCount, unattributedRecordCount: reconciliation.unattributedRecordCount, attributedSignedActual: reconciliation.attributedSignedActual, unattributedSignedActual: reconciliation.unattributedSignedActual } }, pairs.map((pair) => pair.rollup).filter(Boolean), alignment);
    return Object.freeze({ status: reconciliation.status, reconciliation, attribution: coverage.attribution, hierarchyStatusCounts: Object.freeze(hierarchyStatusCounts), temporalStatusCounts: Object.freeze(temporalStatusCounts), deployment: coverage.deployment, diagnostics: reconciliation.diagnostics });
  }
  function sliceDirectPerformance(input = {}) {
    const dimension = input.dimension || "EMPLOYEE"; const pairs = pairInputs(input.canonicalRecords, input.detachedAttributionResults, input.hierarchyRollupRecords).filter((pair) => parentMatches(pair, input.parentSelection)); const rows = new Map();
    pairs.forEach((pair) => {
      const groupKey = dimensionValue(pair.record, pair.result, pair.rollup, dimension); if (dimension === "EMPLOYEE" && !attributed(pair.result)) return;
      if (!rows.has(groupKey)) rows.set(groupKey, { key: groupKey, acceptedRecordCount: 0, acceptedSignedActual: 0, directAttributedRecordCount: 0, directSignedActual: 0, unattributedRecordCount: 0, unattributedSignedActual: 0 });
      const row = rows.get(groupKey); const value = actual(pair.record && pair.record.premium); row.acceptedRecordCount += 1; row.acceptedSignedActual += value;
      if (attributed(pair.result)) { row.directAttributedRecordCount += 1; row.directSignedActual += actual(pair.result.signedActual); } else { row.unattributedRecordCount += 1; row.unattributedSignedActual += actual(pair.result && pair.result.signedActual); }
    });
    const reconciliation = reconcileSlice(input); const denominator = reconciliation.attributedSignedActual;
    return Object.freeze({ status: reconciliation.status, dimension, parentSelection: input.parentSelection || null, rows: sortedRows([...rows.values()].map((row) => ({ ...row, directContributionPercent: denominator === 0 ? null : row.directSignedActual / denominator * 100 })), "key"), diagnostics: reconciliation.diagnostics, reconciliation });
  }
  function sliceTeamPerformance(input = {}) {
    const pairs = pairInputs(input.canonicalRecords, input.detachedAttributionResults, input.hierarchyRollupRecords).filter((pair) => parentMatches(pair, input.parentSelection)); const rows = new Map();
    pairs.forEach((pair) => { if (!pair.rollup || !pair.rollup.directOwnerId) return; [...new Set(pair.rollup.rollupNodeIds || [])].forEach((managerEmployeeId) => { if (!rows.has(managerEmployeeId)) rows.set(managerEmployeeId, { managerEmployeeId, teamAttributedRecordCount: 0, teamSignedActual: 0, ownDirectSignedActual: 0, hierarchyStatuses: [] }); const row = rows.get(managerEmployeeId); row.teamAttributedRecordCount += 1; row.teamSignedActual += actual(pair.rollup.signedActual); if (managerEmployeeId === pair.rollup.directOwnerId) row.ownDirectSignedActual += actual(pair.rollup.signedActual); row.hierarchyStatuses.push(pair.rollup.hierarchyStatus || "MISSING"); }); });
    const reconciliation = reconcileSlice(input);
    return Object.freeze({ status: reconciliation.status, dimension: "MANAGER", parentSelection: input.parentSelection || null, nonAdditive: true, rows: sortedRows([...rows.values()].map((row) => ({ ...row, hierarchyStatuses: diagnostics(row.hierarchyStatuses), teamMembership: "INCLUSIVE_SELF_AND_DESCENDANTS" })), "managerEmployeeId"), diagnostics: reconciliation.diagnostics, reconciliation });
  }

  function summarize(input = {}) {
    const employeeRows = buildEmployeePerformance(input.detachedAttributionResults, input.reconciliationResult);
    const teamRows = buildTeamPerformance(input.hierarchyRollupRecords);
    const deploymentAlignmentRows = buildDeploymentAlignment(input.detachedAttributionResults, input.workforceDeploymentContextsByBusinessDate, input);
    const reconciliation = validateReconciliation({ attributionResults: input.detachedAttributionResults, rollupRecords: input.hierarchyRollupRecords, employeeRows, deploymentRows: deploymentAlignmentRows, reconciliationResult: input.reconciliationResult });
    return Object.freeze({ status: reconciliation.status, directEmployeeRows: employeeRows, teamRows, deploymentAlignmentRows, coverage: buildCoverage(input.reconciliationResult, input.hierarchyRollupRecords, deploymentAlignmentRows), reconciliation, diagnostics: reconciliation.diagnostics, slice: input.slice || null, metadata: Object.freeze({ teamMembership: "INCLUSIVE_SELF_AND_DESCENDANTS" }) });
  }

  global.BancaTrackerWorkforcePerformance = Object.freeze({ buildEmployeePerformance, buildTeamPerformance, buildDeploymentAlignment, buildCoverage, sliceDirectPerformance, sliceTeamPerformance, buildDiagnostics, reconcileSlice, summarize, validateReconciliation });
})(window);
