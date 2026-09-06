/*==============================================================
BancaTracker Enterprise
Version : 8.2.0
File    : directHierarchyResolver.js
Module  : Enrichment Foundation
Purpose : Build runtime direct-reporting hierarchy resolution contexts
==============================================================*/

(function (global) {
  "use strict";

  if (!global.BancaTrackerDirectReportingHierarchy) throw new Error("BancaTrackerDirectReportingHierarchy must be loaded before directHierarchyResolver.js");
  const Authority = global.BancaTrackerDirectReportingHierarchy;

  function emptyContext(status, asOfDate, employeeContext, hierarchyContext, diagnostics) {
    return Object.freeze({ status, asOfDate: asOfDate || null, employeeContext: employeeContext || null, hierarchyContext: hierarchyContext || null, employeeCount: 0, relationshipCount: 0, roots: Object.freeze([]), coverage: Object.freeze({ totalEmployees: 0, resolvedEmployees: 0, explicitRoots: 0, noRelationship: 0, incompleteChains: 0, invalidEmployees: 0, notEffectiveEmployees: 0, coveragePercent: 0 }), employeeById: new Map(), directManagerByEmployee: new Map(), directReportsByManager: new Map(), rootByEmployee: new Map(), depthByEmployee: new Map(), resolutionsByEmployee: new Map(), graph: null, diagnostics: Object.freeze(diagnostics || []) });
  }
  function employeeEffectiveAt(employee, asOfDate) {
    const joining = Authority.parseDate(employee && employee.dateOfJoining);
    const exit = Authority.parseDate(employee && employee.exitDate);
    if (!joining.valid || !exit.valid) return Object.freeze({ effective: false, status: "INVALID", diagnostics: Object.freeze(["EMPLOYEE_DATE_INVALID"]) });
    if (joining.value && joining.value > asOfDate) return Object.freeze({ effective: false, status: "NOT_EFFECTIVE", diagnostics: Object.freeze(["EMPLOYEE_NOT_YET_JOINED"]) });
    if (exit.value && exit.value < asOfDate) return Object.freeze({ effective: false, status: "NOT_EFFECTIVE", diagnostics: Object.freeze(["EMPLOYEE_EXITED_BEFORE_AS_OF"]) });
    const diagnostics = [];
    if (!joining.value) diagnostics.push("EMPLOYEE_JOIN_DATE_UNVERIFIED");
    if (employee && employee.employmentStatus === "EXITED" && !exit.value) diagnostics.push("EMPLOYEE_EXIT_DATE_UNVERIFIED");
    return Object.freeze({ effective: true, status: "EFFECTIVE", diagnostics: Object.freeze(diagnostics) });
  }
  function freezeReportMap(map) {
    const frozen = new Map();
    [...map.keys()].sort().forEach((managerId) => frozen.set(managerId, Object.freeze([...map.get(managerId)].sort())));
    return frozen;
  }
  function createContext(employeeContext, hierarchyContext, asOfDate) {
    const parsedAsOf = Authority.parseDate(asOfDate);
    if (!parsedAsOf.value || !parsedAsOf.valid) return emptyContext("INVALID_AS_OF_DATE", asOfDate, employeeContext, hierarchyContext, ["DIRECT_HIERARCHY_AS_OF_INVALID"]);
    if (!employeeContext || !["READY", "LEGACY_COMPATIBILITY"].includes(employeeContext.status)) return emptyContext("EMPLOYEE_UNAVAILABLE", parsedAsOf.value, employeeContext, hierarchyContext, ["DIRECT_HIERARCHY_EMPLOYEE_CONTEXT_UNAVAILABLE"]);
    if (!hierarchyContext || hierarchyContext.status === "ABSENT") return emptyContext("HIERARCHY_ABSENT", parsedAsOf.value, employeeContext, hierarchyContext, ["DIRECT_HIERARCHY_ABSENT"]);
    if (hierarchyContext.status === "LEGACY_COMPATIBILITY") return emptyContext("LEGACY_COMPATIBILITY", parsedAsOf.value, employeeContext, hierarchyContext, ["DIRECT_HIERARCHY_LEGACY_NOT_ADAPTED"]);
    if (hierarchyContext.status === "UNSUPPORTED_CONTRACT") return emptyContext("UNSUPPORTED_CONTRACT", parsedAsOf.value, employeeContext, hierarchyContext, ["DIRECT_HIERARCHY_CONTRACT_UNSUPPORTED"]);
    if (hierarchyContext.status !== "READY") return emptyContext("HIERARCHY_UNAVAILABLE", parsedAsOf.value, employeeContext, hierarchyContext, ["DIRECT_HIERARCHY_CONTEXT_UNAVAILABLE"]);
    const employees = Array.isArray(employeeContext.records) ? employeeContext.records : [];
    const graph = Authority.buildGraph(hierarchyContext.records, employees, parsedAsOf.value);
    if (graph.status === "INVALID_GRAPH") return Object.freeze({ ...emptyContext("INVALID", parsedAsOf.value, employeeContext, hierarchyContext, graph.diagnostics), graph, employeeCount: employees.length, relationshipCount: graph.activeRelationships.length, roots: graph.roots });
    const directReports = new Map();
    graph.activeRelationships.forEach((relationship) => { if (relationship.managerEmployeeId) { if (!directReports.has(relationship.managerEmployeeId)) directReports.set(relationship.managerEmployeeId, []); directReports.get(relationship.managerEmployeeId).push(relationship.employeeId); } });
    const resolutionsByEmployee = new Map(); const directManagerByEmployee = new Map(); const rootByEmployee = new Map(); const depthByEmployee = new Map();
    const diagnostics = [...graph.diagnostics]; let resolvedEmployees = 0; let explicitRoots = 0; let noRelationship = 0; let incompleteChains = 0; let invalidEmployees = 0; let notEffectiveEmployees = 0;
    [...graph.employeeById.keys()].sort().forEach((employeeId) => {
      const effective = employeeEffectiveAt(graph.employeeById.get(employeeId), parsedAsOf.value);
      let result;
      if (!effective.effective) {
        result = Object.freeze({ status: effective.status === "INVALID" ? "INVALID" : "NOT_EFFECTIVE", employeeId, asOfDate: parsedAsOf.value, directManagerId: null, reportingChain: Object.freeze([]), reportingDepth: 0, rootEmployeeId: null, isRoot: false, diagnostics: effective.diagnostics });
        if (result.status === "INVALID") invalidEmployees += 1; else notEffectiveEmployees += 1;
      } else {
        const resolved = Authority.resolveEmployee(employeeId, graph);
        const status = resolved.status === "RESOLVED_TO_ROOT" ? "RESOLVED" : resolved.status === "ROOT" ? "EXPLICIT_ROOT" : resolved.status;
        result = Object.freeze({ ...resolved, status, diagnostics: Object.freeze([...resolved.diagnostics, ...effective.diagnostics]) });
        if (status === "RESOLVED") resolvedEmployees += 1;
        if (status === "EXPLICIT_ROOT") { resolvedEmployees += 1; explicitRoots += 1; }
        if (status === "NO_RELATIONSHIP") noRelationship += 1;
        if (status === "CHAIN_INCOMPLETE") incompleteChains += 1;
        if (status === "INVALID_GRAPH" || status === "INVALID") invalidEmployees += 1;
      }
      resolutionsByEmployee.set(employeeId, result); directManagerByEmployee.set(employeeId, result.directManagerId); rootByEmployee.set(employeeId, result.rootEmployeeId); depthByEmployee.set(employeeId, result.reportingDepth);
    });
    if (graph.componentCount > 1 && !diagnostics.includes("HIERARCHY_V2_DISCONNECTED_COMPONENTS")) diagnostics.push("HIERARCHY_V2_DISCONNECTED_COMPONENTS");
    if (noRelationship) diagnostics.push("DIRECT_HIERARCHY_PARTIAL_COVERAGE");
    if (incompleteChains) diagnostics.push("DIRECT_HIERARCHY_INCOMPLETE_CHAIN");
    const totalEmployees = employees.length;
    const coverage = Object.freeze({ totalEmployees, resolvedEmployees, explicitRoots, noRelationship, incompleteChains, invalidEmployees, notEffectiveEmployees, coveragePercent: totalEmployees ? (resolvedEmployees / totalEmployees) * 100 : 0 });
    const status = invalidEmployees ? "INVALID" : (noRelationship || incompleteChains || notEffectiveEmployees) ? "READY_PARTIAL" : "READY";
    return Object.freeze({ status, asOfDate: parsedAsOf.value, employeeContext, hierarchyContext, employeeCount: totalEmployees, relationshipCount: graph.activeRelationships.length, roots: Object.freeze([...graph.roots].sort()), coverage, employeeById: graph.employeeById, directManagerByEmployee, directReportsByManager: freezeReportMap(directReports), rootByEmployee, depthByEmployee, resolutionsByEmployee, graph, diagnostics: Object.freeze([...new Set(diagnostics)].sort()) });
  }
  function resolveEmployee(employeeId, context) { return context && context.resolutionsByEmployee.get(Authority.normalizeCode(employeeId)) || Object.freeze({ status: "EMPLOYEE_NOT_FOUND", employeeId: Authority.normalizeCode(employeeId), asOfDate: context && context.asOfDate || null, directManagerId: null, reportingChain: Object.freeze([]), reportingDepth: 0, rootEmployeeId: null, isRoot: false, diagnostics: Object.freeze([]) }); }
  function getManager(employeeId, context) { return resolveEmployee(employeeId, context).directManagerId; }
  function getAncestors(employeeId, context) { return resolveEmployee(employeeId, context).reportingChain; }
  function getDirectReports(managerId, context) { return context && context.directReportsByManager.get(Authority.normalizeCode(managerId)) || Object.freeze([]); }
  function getDescendants(managerId, context) {
    const result = []; const pending = [...getDirectReports(managerId, context)];
    while (pending.length) { const employeeId = pending.shift(); result.push(employeeId); pending.push(...getDirectReports(employeeId, context)); }
    return Object.freeze(result);
  }
  function getRollupMembers(managerId, context, options = {}) {
    const descendants = getDescendants(managerId, context);
    return Object.freeze(options.includeSelf ? [Authority.normalizeCode(managerId), ...descendants] : [...descendants]);
  }
  function summarize(context) {
    if (!context) return Object.freeze({ status: "HIERARCHY_UNAVAILABLE", asOfDate: null, roots: Object.freeze([]), coverage: Object.freeze({ totalEmployees: 0, resolvedEmployees: 0, explicitRoots: 0, noRelationship: 0, incompleteChains: 0, invalidEmployees: 0, notEffectiveEmployees: 0, coveragePercent: 0 }), relationshipCount: 0, diagnostics: Object.freeze([]) });
    return Object.freeze({ status: context.status, asOfDate: context.asOfDate, roots: context.roots, coverage: context.coverage, relationshipCount: context.relationshipCount, diagnostics: context.diagnostics });
  }

  global.BancaTrackerDirectHierarchyResolver = Object.freeze({ createContext, resolveEmployee, getManager, getAncestors, getDirectReports, getDescendants, getRollupMembers, summarize });
})(window);
