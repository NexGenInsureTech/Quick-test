/*==============================================================
BancaTracker Enterprise
Version : 8.2.0
File    : directReportingHierarchy.js
Module  : Master Data
Purpose : Validate and resolve effective-dated direct reporting graphs
==============================================================*/

(function (global) {
  "use strict";

  const CONTRACT = Object.freeze({
    NAME: "HIERARCHY_MASTER",
    VERSION: 2,
    SOURCE_PROFILE: "DIRECT_REPORTING_V2",
    DATE_BOUNDARY: "INCLUSIVE",
  });
  const INFINITY = "9999-12-31";

  function normalizeText(value) {
    if (value === null || value === undefined) return null;
    const normalized = String(value).replace(/\u00A0/g, " ").trim().replace(/\s+/g, " ");
    return normalized || null;
  }
  function normalizeCode(value) {
    const normalized = normalizeText(value);
    return normalized ? normalized.toUpperCase() : null;
  }
  function parseDate(value) {
    const normalized = normalizeText(value);
    if (!normalized) return Object.freeze({ value: null, valid: true });
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(normalized);
    if (!match) return Object.freeze({ value: normalized, valid: false });
    const year = Number(match[1]); const month = Number(match[2]); const day = Number(match[3]);
    const date = new Date(Date.UTC(year, month - 1, day));
    return Object.freeze({ value: normalized, valid: date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day });
  }
  function normalizeRecord(rawRecord, datasetId, rowNumber) {
    const employeeId = normalizeCode(rawRecord && (rawRecord["EMPLOYEE ID"] !== undefined ? rawRecord["EMPLOYEE ID"] : rawRecord.employeeId));
    const managerEmployeeId = normalizeCode(rawRecord && (rawRecord["MANAGER EMPLOYEE ID"] !== undefined ? rawRecord["MANAGER EMPLOYEE ID"] : rawRecord.managerEmployeeId));
    const validFrom = parseDate(rawRecord && (rawRecord["VALID FROM"] !== undefined ? rawRecord["VALID FROM"] : rawRecord.validFrom));
    const validTo = parseDate(rawRecord && (rawRecord["VALID TO"] !== undefined ? rawRecord["VALID TO"] : rawRecord.validTo));
    const identity = employeeId && validFrom.value ? `${employeeId}:${validFrom.value}` : `ROW:${rowNumber}`;
    return Object.freeze({
      recordId: `${datasetId}:${identity}`,
      datasetId,
      employeeId,
      managerEmployeeId,
      validFrom: validFrom.value,
      validTo: validTo.value,
      dateValidity: Object.freeze({ validFrom: validFrom.valid, validTo: validTo.valid }),
      sourceRowNumber: rowNumber,
    });
  }
  function finding(code, severity, record, message, details = {}) {
    return Object.freeze({ code, severity, employeeId: record && record.employeeId || null, sourceRowNumber: record && record.sourceRowNumber || null, message, ...details });
  }
  function employeeMap(employeeRecords) {
    return new Map((Array.isArray(employeeRecords) ? employeeRecords : []).filter((employee) => employee && employee.employeeId).map((employee) => [normalizeCode(employee.employeeId), employee]));
  }
  function intervalsOverlap(left, right) {
    return left.validFrom <= (right.validTo || INFINITY) && right.validFrom <= (left.validTo || INFINITY);
  }
  function isEffective(record, asOfDate) {
    return Boolean(record && record.dateValidity.validFrom && record.dateValidity.validTo && record.validFrom && record.validFrom <= asOfDate && (!record.validTo || asOfDate <= record.validTo));
  }
  function validateEmploymentBounds(record, employee, label, findings) {
    if (!employee) return;
    const joining = parseDate(employee.dateOfJoining);
    const exit = parseDate(employee.exitDate);
    if (!joining.value || !joining.valid) findings.push(finding("HIERARCHY_V2_EMPLOYMENT_BOUNDARY_UNVERIFIED", "WARNING", record, `${label} DATE OF JOINING is unavailable; the lower employment boundary was not verified.`));
    else if (record.validFrom && record.validFrom < joining.value) findings.push(finding("HIERARCHY_V2_EMPLOYMENT_RANGE_CONFLICT", "ERROR", record, `${label} relationship begins before employment.`, { referencedEmployeeId: normalizeCode(employee.employeeId) }));
    if (employee.employmentStatus === "EXITED" && (!exit.value || !exit.valid)) findings.push(finding("HIERARCHY_V2_EMPLOYMENT_BOUNDARY_UNVERIFIED", "WARNING", record, `${label} EXIT DATE is unavailable; the upper employment boundary was not verified.`));
    else if (exit.value && (!record.validTo || record.validTo > exit.value)) findings.push(finding("HIERARCHY_V2_EMPLOYMENT_RANGE_CONFLICT", "ERROR", record, `${label} relationship extends beyond employment.`, { referencedEmployeeId: normalizeCode(employee.employeeId) }));
  }
  function findCycles(records, candidateDates) {
    const cycles = [];
    const signatures = new Set();
    candidateDates.forEach((asOfDate) => {
      const edges = new Map(records.filter((record) => isEffective(record, asOfDate) && record.managerEmployeeId).map((record) => [record.employeeId, record.managerEmployeeId]));
      const done = new Set();
      edges.forEach((unused, start) => {
        if (done.has(start)) return;
        const path = []; const position = new Map(); let current = start;
        while (current && edges.has(current) && !done.has(current)) {
          if (position.has(current)) {
            const members = path.slice(position.get(current));
            const signature = [...members].sort().join("|");
            if (!signatures.has(signature)) { signatures.add(signature); cycles.push(Object.freeze({ asOfDate, employeeIds: Object.freeze(members) })); }
            break;
          }
          position.set(current, path.length); path.push(current); current = edges.get(current);
        }
        path.forEach((employeeId) => done.add(employeeId));
      });
    });
    return cycles;
  }
  function validateDataset(records, employeeRecords) {
    const source = Array.isArray(records) ? records : [];
    const employees = employeeMap(employeeRecords);
    const findings = [];
    const byEmployee = new Map();
    const identities = new Set();
    source.forEach((record) => {
      if (!record.employeeId) findings.push(finding("HIERARCHY_V2_EMPLOYEE_ID_MISSING", "ERROR", record, "EMPLOYEE ID is required."));
      if (!record.validFrom) findings.push(finding("HIERARCHY_V2_VALID_FROM_MISSING", "ERROR", record, "VALID FROM is required."));
      if (!record.dateValidity || !record.dateValidity.validFrom || !record.dateValidity.validTo) findings.push(finding("HIERARCHY_V2_DATE_INVALID", "ERROR", record, "Relationship dates must be real YYYY-MM-DD values."));
      if (record.validFrom && record.validTo && record.validTo < record.validFrom) findings.push(finding("HIERARCHY_V2_DATE_ORDER_INVALID", "ERROR", record, "VALID TO cannot precede VALID FROM."));
      if (record.employeeId && record.managerEmployeeId === record.employeeId) findings.push(finding("HIERARCHY_V2_SELF_REFERENCE", "ERROR", record, "An employee cannot report to themselves."));
      const identity = record.employeeId && record.validFrom ? `${record.employeeId}:${record.validFrom}` : null;
      if (identity && identities.has(identity)) findings.push(finding("HIERARCHY_V2_RELATIONSHIP_DUPLICATE", "ERROR", record, "Duplicate EMPLOYEE ID + VALID FROM relationship identity."));
      if (identity) identities.add(identity);
      const employee = employees.get(record.employeeId);
      const manager = record.managerEmployeeId ? employees.get(record.managerEmployeeId) : null;
      if (record.employeeId && !employee) findings.push(finding("HIERARCHY_V2_EMPLOYEE_UNMAPPED", "ERROR", record, "EMPLOYEE ID is not present in Employee Master."));
      if (record.managerEmployeeId && !manager) findings.push(finding("HIERARCHY_V2_MANAGER_UNMAPPED", "ERROR", record, "MANAGER EMPLOYEE ID is not present in Employee Master.", { referencedEmployeeId: record.managerEmployeeId }));
      if (record.dateValidity && record.dateValidity.validFrom && record.dateValidity.validTo && record.validFrom && (!record.validTo || record.validTo >= record.validFrom)) {
        validateEmploymentBounds(record, employee, "Employee", findings);
        if (record.managerEmployeeId) validateEmploymentBounds(record, manager, "Manager", findings);
      }
      if (record.employeeId) { if (!byEmployee.has(record.employeeId)) byEmployee.set(record.employeeId, []); byEmployee.get(record.employeeId).push(record); }
    });
    byEmployee.forEach((employeeRelationships) => {
      const sorted = [...employeeRelationships].filter((record) => record.validFrom && record.dateValidity && record.dateValidity.validFrom && record.dateValidity.validTo).sort((a, b) => a.validFrom.localeCompare(b.validFrom));
      for (let index = 1; index < sorted.length; index += 1) if (intervalsOverlap(sorted[index - 1], sorted[index])) findings.push(finding("HIERARCHY_V2_RELATIONSHIP_OVERLAP", "ERROR", sorted[index], "Effective relationship intervals overlap for this employee.", { conflictingRecordId: sorted[index - 1].recordId }));
    });
    const validRecords = source.filter((record) => record.employeeId && record.validFrom && record.dateValidity && record.dateValidity.validFrom && record.dateValidity.validTo && (!record.validTo || record.validTo >= record.validFrom));
    const cycles = findCycles(validRecords, [...new Set(validRecords.map((record) => record.validFrom))].sort());
    cycles.forEach((cycle) => findings.push(finding("HIERARCHY_V2_CYCLE_DETECTED", "ERROR", null, `Temporal reporting cycle detected at ${cycle.asOfDate}.`, { asOfDate: cycle.asOfDate, employeeIds: cycle.employeeIds })));
    const rootRecords = validRecords.filter((record) => !record.managerEmployeeId);
    if (rootRecords.some((root, index) => rootRecords.slice(index + 1).some((other) => intervalsOverlap(root, other)))) findings.push(finding("HIERARCHY_V2_MULTIPLE_ROOTS", "WARNING", null, "Multiple explicit roots are effective during at least one temporal slice."));
    const errorCount = findings.filter((item) => item.severity === "ERROR").length;
    return Object.freeze({ valid: errorCount === 0, errorCount, warningCount: findings.length - errorCount, findings: Object.freeze(findings), cycles: Object.freeze(cycles) });
  }
  function componentCount(relationships) {
    const neighbors = new Map();
    const ensure = (id) => { if (!neighbors.has(id)) neighbors.set(id, new Set()); return neighbors.get(id); };
    relationships.forEach((record) => { ensure(record.employeeId); if (record.managerEmployeeId) { ensure(record.employeeId).add(record.managerEmployeeId); ensure(record.managerEmployeeId).add(record.employeeId); } });
    let count = 0; const visited = new Set();
    neighbors.forEach((unused, start) => { if (visited.has(start)) return; count += 1; const pending = [start]; while (pending.length) { const id = pending.pop(); if (visited.has(id)) continue; visited.add(id); (neighbors.get(id) || []).forEach((next) => pending.push(next)); } });
    return count;
  }
  function buildGraph(records, employeeRecords, asOfDate) {
    const parsedAsOf = parseDate(asOfDate);
    if (!parsedAsOf.value || !parsedAsOf.valid) return Object.freeze({ status: "INVALID_AS_OF_DATE", asOfDate: asOfDate || null, employeeById: employeeMap(employeeRecords), relationshipByEmployeeId: new Map(), roots: Object.freeze([]), validation: null, componentCount: 0, diagnostics: Object.freeze(["HIERARCHY_V2_AS_OF_INVALID"]) });
    const validation = validateDataset(records, employeeRecords);
    const active = (Array.isArray(records) ? records : []).filter((record) => isEffective(record, parsedAsOf.value));
    const relationshipByEmployeeId = new Map(); const ambiguous = new Set();
    active.forEach((record) => { if (relationshipByEmployeeId.has(record.employeeId)) ambiguous.add(record.employeeId); else relationshipByEmployeeId.set(record.employeeId, record); });
    const roots = active.filter((record) => !record.managerEmployeeId).map((record) => record.employeeId);
    const employees = employeeMap(employeeRecords);
    const missingCount = [...employees.keys()].filter((employeeId) => !relationshipByEmployeeId.has(employeeId)).length;
    const activeComponentCount = componentCount(active);
    const diagnostics = [];
    if (ambiguous.size) diagnostics.push("HIERARCHY_V2_MULTIPLE_ACTIVE_MANAGERS");
    if (roots.length > 1) diagnostics.push("HIERARCHY_V2_MULTIPLE_ROOTS");
    if (activeComponentCount > 1) diagnostics.push("HIERARCHY_V2_DISCONNECTED_COMPONENTS");
    if (missingCount) diagnostics.push("HIERARCHY_V2_EMPLOYEE_RELATIONSHIP_MISSING");
    const status = !validation.valid || ambiguous.size ? "INVALID_GRAPH" : missingCount ? "PARTIAL" : "READY";
    return Object.freeze({ status, asOfDate: parsedAsOf.value, employeeById: employees, relationshipByEmployeeId, roots: Object.freeze(roots), activeRelationships: Object.freeze(active), validation, componentCount: activeComponentCount, diagnostics: Object.freeze(diagnostics) });
  }
  function resolution(status, employeeId, graph, extra = {}) {
    return Object.freeze({ status, employeeId, asOfDate: graph && graph.asOfDate || null, directManagerId: null, reportingChain: Object.freeze([]), reportingDepth: 0, rootEmployeeId: null, isRoot: false, diagnostics: Object.freeze([]), ...extra });
  }
  function resolveEmployee(employeeId, graph) {
    const normalizedId = normalizeCode(employeeId);
    if (!graph || graph.status === "INVALID_AS_OF_DATE") return resolution("INVALID_AS_OF_DATE", normalizedId, graph);
    if (graph.status === "INVALID_GRAPH") return resolution("INVALID_GRAPH", normalizedId, graph, { diagnostics: Object.freeze(graph.diagnostics) });
    if (!graph.employeeById.has(normalizedId)) return resolution("EMPLOYEE_NOT_FOUND", normalizedId, graph);
    const first = graph.relationshipByEmployeeId.get(normalizedId);
    if (!first) return resolution("NO_RELATIONSHIP", normalizedId, graph, { diagnostics: Object.freeze(["HIERARCHY_V2_EMPLOYEE_RELATIONSHIP_MISSING"]) });
    if (!first.managerEmployeeId) return resolution("ROOT", normalizedId, graph, { rootEmployeeId: normalizedId, isRoot: true });
    const chain = []; const visited = new Set([normalizedId]); let current = first; const directManagerId = first.managerEmployeeId;
    while (current.managerEmployeeId) {
      const managerId = current.managerEmployeeId;
      if (visited.has(managerId)) return resolution("INVALID_GRAPH", normalizedId, graph, { directManagerId, reportingChain: Object.freeze(chain), reportingDepth: chain.length, diagnostics: Object.freeze(["HIERARCHY_V2_CYCLE_DETECTED"]) });
      visited.add(managerId); chain.push(managerId);
      const managerRelationship = graph.relationshipByEmployeeId.get(managerId);
      if (!managerRelationship) return resolution("CHAIN_INCOMPLETE", normalizedId, graph, { directManagerId, reportingChain: Object.freeze(chain), reportingDepth: chain.length, diagnostics: Object.freeze(["HIERARCHY_V2_CHAIN_INCOMPLETE"]) });
      if (!managerRelationship.managerEmployeeId) return resolution("RESOLVED_TO_ROOT", normalizedId, graph, { directManagerId, reportingChain: Object.freeze(chain), reportingDepth: chain.length, rootEmployeeId: managerId });
      current = managerRelationship;
    }
    return resolution("CHAIN_INCOMPLETE", normalizedId, graph, { directManagerId, reportingChain: Object.freeze(chain), reportingDepth: chain.length });
  }
  function resolveEmployees(employeeRecords, graph) {
    const results = (Array.isArray(employeeRecords) ? employeeRecords : []).map((employee) => resolveEmployee(employee.employeeId, graph));
    const count = (status) => results.filter((result) => result.status === status).length;
    const cycleEmployees = graph && graph.validation ? new Set(graph.validation.cycles.flatMap((cycle) => cycle.employeeIds)) : new Set();
    return Object.freeze({
      status: graph ? graph.status : "HIERARCHY_UNAVAILABLE",
      asOfDate: graph && graph.asOfDate || null,
      results: Object.freeze(results),
      diagnostics: Object.freeze({ evaluatedEmployeeCount: results.length, resolvedEmployeeCount: count("RESOLVED_TO_ROOT") + count("ROOT"), explicitRootCount: count("ROOT"), noRelationshipCount: count("NO_RELATIONSHIP"), incompleteChainCount: count("CHAIN_INCOMPLETE"), invalidRelationshipCount: graph && graph.validation ? graph.validation.errorCount : 0, cycleAffectedEmployeeCount: cycleEmployees.size, disconnectedComponentCount: graph ? graph.componentCount : 0 }),
    });
  }

  global.BancaTrackerDirectReportingHierarchy = Object.freeze({ CONTRACT, normalizeText, normalizeCode, parseDate, normalizeRecord, validateDataset, buildGraph, resolveEmployee, resolveEmployees });
})(window);
