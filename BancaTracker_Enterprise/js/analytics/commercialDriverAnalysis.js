/*==============================================================
BancaTracker Enterprise
Version : 8.2.0-dev
File    : commercialDriverAnalysis.js
Module  : Analytics
Purpose : Govern parent-scoped LOB and Product commercial driver analysis
==============================================================*/

(function (global) {
  "use strict";

  const PERIOD_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
  const DRIVERS = Object.freeze(["LOB", "PRODUCT"]);
  const PARENTS = Object.freeze(["OVERALL", "BANK", "ZONE", "STATE", "BANK_REGION", "BANK_ZONE", "FGM_OFFICE", "NATIONAL_HEAD", "ZSM", "ASM", "CSM", "ASSIGNED_RM", "BRANCH"]);
  const ORGANISATIONAL = Object.freeze(["NATIONAL_HEAD", "ZSM", "ASM", "CSM", "ASSIGNED_RM"]);
  const VALID_PARENT_STATUSES = Object.freeze(["READY", "PARTIAL", "NO_FACT_DATA"]);

  function stableCompare(left, right) { const a = String(left); const b = String(right); return a < b ? -1 : a > b ? 1 : 0; }
  function diagnostic(code, key = null, detail = null) { return { code, key, detail }; }
  function sortDiagnostics(items) { return items.sort((left, right) => stableCompare(left.code, right.code) || stableCompare(left.key || "", right.key || "") || stableCompare(left.detail || "", right.detail || "")); }
  function getSupportedDriverDimensions() { return [...DRIVERS]; }
  function normalizedText(value) { const text = value === null || value === undefined ? "" : String(value).replace(/\u00A0/g, " ").trim(); return text || null; }
  function normalizedCode(value) { const text = normalizedText(value); return text ? text.toUpperCase() : null; }
  function factForDimension(fact) { return { ...fact, canonicalBank: fact.canonicalBank || fact.bank || null, branchName: fact.branchName || fact.branch || null, stateName: fact.stateName || fact.state || null, zoneName: fact.zoneName || fact.zone || null }; }

  function emptyResult(status, mode, options, diagnostics) {
    const parent = options.parentSelection || { parentDimension: options.parentDimension, parentKey: options.parentKey, parentLabel: options.parentLabel };
    return {
      status, mode, periodKey: options.periodKey || null, asOfDay: options.asOfDay === undefined ? null : options.asOfDay,
      basePeriod: options.basePeriod || null, comparisonPeriod: options.comparisonPeriod || null,
      parent: parent && parent.parentDimension ? { dimension: parent.parentDimension, key: parent.parentKey || null, label: parent.parentLabel || null, actual: null } : null,
      driverDimension: options.driverDimension || null, rows: [], reconciliation: null, diagnostics: sortDiagnostics(diagnostics),
    };
  }

  function selection(options, mode) {
    const candidate = options.parentSelection || { parentDimension: options.parentDimension, parentKey: options.parentKey, parentLabel: options.parentLabel };
    if (!candidate || typeof candidate.parentKey !== "string" || !candidate.parentKey) return { valid: false, result: emptyResult("INVALID_PARENT", mode, options, [diagnostic("PARENT_IDENTITY_INVALID")]) };
    if (!PARENTS.includes(candidate.parentDimension)) return { valid: false, result: emptyResult("INVALID_PARENT", mode, { ...options, parentSelection: candidate }, [diagnostic("PARENT_DIMENSION_INVALID", null, candidate.parentDimension)]) };
    if (!DRIVERS.includes(options.driverDimension)) return { valid: false, result: emptyResult("UNSUPPORTED_DRIVER", mode, { ...options, parentSelection: candidate }, [diagnostic("DRIVER_DIMENSION_UNSUPPORTED", null, options.driverDimension)]) };
    return { valid: true, parentSelection: candidate };
  }

  function enrichAndScope(facts, parentSelection, authorityContext) {
    const rollups = global.BancaTrackerCommercialRollups;
    const metadata = rollups.buildMetadataIndex(authorityContext || {});
    return (facts || []).map((fact) => rollups.attachMetadata([factForDimension(fact)], metadata)[0]).filter((fact) => parentSelection.parentDimension === "OVERALL" || rollups.getDimensionValue(fact, parentSelection.parentDimension).key === parentSelection.parentKey);
  }

  function validDay(fact, periodKey) {
    if (fact.monthKey !== periodKey) return false;
    const day = Number(fact.day);
    const days = global.BancaTrackerCommercialExecution.getDaysInPeriod(periodKey);
    return Number.isInteger(day) && day >= 1 && day <= days;
  }

  function driverIdentity(fact, driverDimension, diagnostics) {
    if (driverDimension === "LOB") {
      const lob = normalizedText(fact.lob);
      if (!lob) { diagnostics.push(diagnostic("DRIVER_UNMAPPED", "__UNMAPPED__")); return { key: "__UNMAPPED__", label: "Unmapped" }; }
      return { key: `LOB:${lob}`, label: lob };
    }
    const code = normalizedCode(fact.productCode);
    const name = normalizedText(fact.productName);
    if (code) return { key: `PRODUCT_CODE:${code}`, label: name || code, code, name };
    if (name) { diagnostics.push(diagnostic("PRODUCT_TEXT_FALLBACK", `PRODUCT_NAME:${name}`)); return { key: `PRODUCT_NAME:${name}`, label: name, name }; }
    diagnostics.push(diagnostic("DRIVER_UNMAPPED", "__UNMAPPED__"));
    return { key: "__UNMAPPED__", label: "Unmapped" };
  }

  function aggregate(facts, driverDimension, diagnostics) {
    const byKey = new Map();
    facts.forEach((fact) => {
      const premium = Number(fact.premium);
      if (!Number.isFinite(premium)) { diagnostics.push(diagnostic("PREMIUM_INVALID")); return; }
      const identity = driverIdentity(fact, driverDimension, diagnostics);
      if (!byKey.has(identity.key)) byKey.set(identity.key, { key: identity.key, label: identity.label, actual: 0, transactionCount: 0, productNames: new Set(), hasTextFallback: identity.key.startsWith("PRODUCT_NAME:") });
      const row = byKey.get(identity.key);
      row.actual += premium; row.transactionCount += 1;
      if (identity.name) row.productNames.add(identity.name);
    });
    byKey.forEach((row) => {
      if (row.key.startsWith("PRODUCT_CODE:") && row.productNames.size > 1) { row.label = row.key.slice("PRODUCT_CODE:".length); diagnostics.push(diagnostic("PRODUCT_CODE_NAME_CONFLICT", row.key)); }
    });
    return byKey;
  }

  function parentRow(result, parentSelection, mode) {
    if (!result || !Array.isArray(result.rows) || !VALID_PARENT_STATUSES.includes(result.status)) return { invalid: true };
    const dimension = result.dimension;
    if (dimension !== parentSelection.parentDimension) return { invalid: true };
    const matches = result.rows.filter((row) => row && row.key === parentSelection.parentKey);
    if (matches.length > 1) return { duplicate: true };
    if (!matches.length) return { missing: true };
    const row = matches[0];
    if (mode === "EXECUTION_SNAPSHOT") return { row, actual: row.actualToDate };
    const baseActual = row.baseActual !== undefined ? row.baseActual : row.base && row.base.actualPremium;
    const comparisonActual = row.comparisonActual !== undefined ? row.comparisonActual : row.comparison && row.comparison.actualPremium;
    return { row, baseActual, comparisonActual, change: row.change !== undefined ? row.change : row.changes && row.changes.actualChange };
  }

  function resolveParent(options, mode, scopedFacts, diagnostics) {
    const supplied = mode === "EXECUTION_SNAPSHOT" ? options.parentExecutionResult : options.parentComparisonResult;
    if (supplied) {
      const found = parentRow(supplied, options.parentSelection, mode);
      if (found.invalid) return { status: "INVALID_INPUT" };
      if (found.duplicate) { diagnostics.push(diagnostic("PARENT_KEY_DUPLICATE", options.parentSelection.parentKey)); return { status: "INVALID_INPUT" }; }
      if (found.missing) return { status: "PARENT_NOT_FOUND" };
      return { status: null, ...found };
    }
    if (options.parentSelection.parentDimension !== "OVERALL" && !scopedFacts.length) return { status: "PARENT_NOT_FOUND" };
    return { status: null, actual: null, baseActual: null, comparisonActual: null, change: null, row: null };
  }

  function executionReconciliation(parentActual, rows, diagnostics) {
    const drivers = rows.reduce((sum, row) => sum + row.actual, 0);
    const complete = typeof parentActual === "number" && Number.isFinite(parentActual);
    const difference = complete ? drivers - parentActual : null;
    if (complete && difference !== 0) diagnostics.push(diagnostic("ACTUAL_RECONCILIATION_DIFFERENCE", null, difference));
    return { parentActual: complete ? parentActual : drivers, driverActual: drivers, difference, complete };
  }

  function comparisonReconciliation(parent, rows, diagnostics) {
    const totals = {
      base: rows.reduce((sum, row) => sum + row.baseActual, 0),
      comparison: rows.reduce((sum, row) => sum + row.comparisonActual, 0),
      change: rows.reduce((sum, row) => sum + row.change, 0),
    };
    const values = { base: parent.baseActual, comparison: parent.comparisonActual, change: parent.change };
    return Object.fromEntries(Object.keys(totals).map((key) => {
      const complete = typeof values[key] === "number" && Number.isFinite(values[key]);
      const difference = complete ? totals[key] - values[key] : null;
      if (complete && difference !== 0) diagnostics.push(diagnostic(`${key.toUpperCase()}_RECONCILIATION_DIFFERENCE`, null, difference));
      return [key, { parent: complete ? values[key] : totals[key], drivers: totals[key], difference, complete }];
    }));
  }

  function buildExecutionDrivers(options = {}) {
    const mode = "EXECUTION_SNAPSHOT";
    const selected = selection(options, mode);
    if (!selected.valid) return selected.result;
    options = { ...options, parentSelection: selected.parentSelection };
    if (!PERIOD_PATTERN.test(options.periodKey || "")) return emptyResult("INVALID_PERIOD", mode, options, [diagnostic("PERIOD_INVALID")]);
    const days = global.BancaTrackerCommercialExecution.getDaysInPeriod(options.periodKey);
    if (!Number.isInteger(options.asOfDay) || options.asOfDay < 0 || options.asOfDay > days) return emptyResult("INVALID_AS_OF", mode, options, [diagnostic("AS_OF_INVALID")]);
    if (!Array.isArray(options.facts)) return emptyResult("INVALID_INPUT", mode, options, [diagnostic("FACTS_INVALID")]);
    const diagnostics = [];
    const scoped = enrichAndScope(options.facts, options.parentSelection, options.authorityContext);
    const parent = resolveParent(options, mode, scoped, diagnostics);
    if (parent.status) return emptyResult(parent.status, mode, options, diagnostics.concat(diagnostic(parent.status, options.parentSelection.parentKey)));
    if (ORGANISATIONAL.includes(options.parentSelection.parentDimension)) diagnostics.push(diagnostic("CURRENT_HIERARCHY_SNAPSHOT"));
    const eligible = scoped.filter((fact) => validDay(fact, options.periodKey) && Number(fact.day) <= options.asOfDay);
    scoped.filter((fact) => fact.monthKey === options.periodKey && !validDay(fact, options.periodKey)).forEach(() => diagnostics.push(diagnostic("CANONICAL_DAY_INVALID")));
    const aggregates = aggregate(eligible, options.driverDimension, diagnostics);
    const parentActual = typeof parent.actual === "number" ? parent.actual : eligible.reduce((sum, fact) => sum + (Number(fact.premium) || 0), 0);
    const rows = [...aggregates.values()].map((row) => ({ key: row.key, label: row.label, actual: row.actual, contributionPercent: parentActual > 0 ? row.actual / parentActual * 100 : null, transactionCount: row.transactionCount }))
      .sort((left, right) => right.actual - left.actual || stableCompare(left.key, right.key));
    const reconciliation = executionReconciliation(parentActual, rows, diagnostics);
    if (parentActual <= 0 && rows.length) diagnostics.push(diagnostic("CONTRIBUTION_UNAVAILABLE_NONPOSITIVE_PARENT"));
    if (!rows.length) diagnostics.push(diagnostic("DRIVER_POPULATION_EMPTY"));
    const status = !rows.length ? "EMPTY" : diagnostics.some((item) => item.code.includes("DIFFERENCE") || item.code === "CANONICAL_DAY_INVALID" || item.code === "PRODUCT_CODE_NAME_CONFLICT") ? "PARTIAL" : "READY";
    return { status, mode, periodKey: options.periodKey, asOfDay: options.asOfDay, parent: { dimension: options.parentSelection.parentDimension, key: options.parentSelection.parentKey, label: options.parentSelection.parentLabel || parent.row && parent.row.label || options.parentSelection.parentKey, actual: parentActual }, driverDimension: options.driverDimension, rows, reconciliation, diagnostics: sortDiagnostics(diagnostics) };
  }

  function buildComparisonDrivers(options = {}) {
    const mode = "MONTH_COMPARISON";
    const selected = selection(options, mode);
    if (!selected.valid) return selected.result;
    options = { ...options, parentSelection: selected.parentSelection };
    if (!PERIOD_PATTERN.test(options.basePeriod || "") || !PERIOD_PATTERN.test(options.comparisonPeriod || "")) return emptyResult("INVALID_PERIOD", mode, options, [diagnostic("PERIOD_INVALID")]);
    if (!Array.isArray(options.facts)) return emptyResult("INVALID_INPUT", mode, options, [diagnostic("FACTS_INVALID")]);
    const diagnostics = [];
    const scoped = enrichAndScope(options.facts, options.parentSelection, options.authorityContext);
    const parent = resolveParent(options, mode, scoped, diagnostics);
    if (parent.status) return emptyResult(parent.status, mode, options, diagnostics.concat(diagnostic(parent.status, options.parentSelection.parentKey)));
    if (ORGANISATIONAL.includes(options.parentSelection.parentDimension)) diagnostics.push(diagnostic("CURRENT_HIERARCHY_SNAPSHOT"));
    const baseFacts = scoped.filter((fact) => validDay(fact, options.basePeriod));
    const comparisonFacts = scoped.filter((fact) => validDay(fact, options.comparisonPeriod));
    const base = aggregate(baseFacts, options.driverDimension, diagnostics);
    const comparison = aggregate(comparisonFacts, options.driverDimension, diagnostics);
    const keys = new Set([...base.keys(), ...comparison.keys()]);
    const rows = [...keys].map((key) => {
      const left = base.get(key); const right = comparison.get(key); const baseActual = left ? left.actual : 0; const comparisonActual = right ? right.actual : 0; const change = comparisonActual - baseActual;
      return { key, label: right && right.label || left && left.label || key, baseActual, comparisonActual, change, growthPercent: baseActual > 0 ? change / baseActual * 100 : null, direction: change > 0 ? "UP" : change < 0 ? "DOWN" : "FLAT", presenceStatus: left && right ? "BOTH" : left ? "BASE_ONLY" : "COMPARISON_ONLY" };
    }).sort((left, right) => Math.abs(right.change) - Math.abs(left.change) || stableCompare(left.key, right.key));
    const fallback = { baseActual: baseFacts.reduce((sum, fact) => sum + (Number(fact.premium) || 0), 0), comparisonActual: comparisonFacts.reduce((sum, fact) => sum + (Number(fact.premium) || 0), 0) };
    const parentValues = { baseActual: typeof parent.baseActual === "number" ? parent.baseActual : fallback.baseActual, comparisonActual: typeof parent.comparisonActual === "number" ? parent.comparisonActual : fallback.comparisonActual };
    parentValues.change = typeof parent.change === "number" ? parent.change : parentValues.comparisonActual - parentValues.baseActual;
    const reconciliation = comparisonReconciliation(parentValues, rows, diagnostics);
    if (!rows.length) diagnostics.push(diagnostic("DRIVER_POPULATION_EMPTY"));
    const status = !rows.length ? "EMPTY" : diagnostics.some((item) => item.code.includes("DIFFERENCE") || item.code === "PRODUCT_CODE_NAME_CONFLICT") ? "PARTIAL" : "READY";
    return { status, mode, basePeriod: options.basePeriod, comparisonPeriod: options.comparisonPeriod, parent: { dimension: options.parentSelection.parentDimension, key: options.parentSelection.parentKey, label: options.parentSelection.parentLabel || parent.row && parent.row.label || options.parentSelection.parentKey, baseActual: parentValues.baseActual, comparisonActual: parentValues.comparisonActual, change: parentValues.change }, driverDimension: options.driverDimension, rows, reconciliation, diagnostics: sortDiagnostics(diagnostics) };
  }

  global.BancaTrackerCommercialDriverAnalysis = Object.freeze({ getSupportedDriverDimensions, buildExecutionDrivers, buildComparisonDrivers });
})(window);
