/*==============================================================
BancaTracker Enterprise
Version : 8.2.0
File    : directHierarchyLegacyProjection.js
Module  : Enrichment Foundation
Purpose : Project resolved Direct Reporting v2 chains to legacy role slots
==============================================================*/

(function (global) {
  "use strict";

  if (!global.BancaTrackerDirectHierarchyResolver) throw new Error("BancaTrackerDirectHierarchyResolver must be loaded before directHierarchyLegacyProjection.js");
  if (!global.BancaTrackerEmployeeMaster) throw new Error("BancaTrackerEmployeeMaster must be loaded before directHierarchyLegacyProjection.js");

  const Resolver = global.BancaTrackerDirectHierarchyResolver;
  const EmployeeMaster = global.BancaTrackerEmployeeMaster;
  const ROLE_FIELDS = Object.freeze({ RM: "rmId", CSM: "csmId", ASM: "asmId", ZSM: "zsmId", NATIONAL_HEAD: "nationalHeadId" });
  const ROLE_ORDER = Object.freeze(["RM", "CSM", "ASM", "ZSM", "NATIONAL_HEAD"]);
  const EMPTY_SLOTS = Object.freeze({ rmId: null, csmId: null, asmId: null, zsmId: null, nationalHeadId: null });
  const USABLE_STATUSES = Object.freeze(["RESOLVED", "EXPLICIT_ROOT"]);

  function emptyProjection(employeeId, asOfDate, sourceResolutionStatus, diagnostics) {
    return Object.freeze({ employeeId: EmployeeMaster.normalizeCode(employeeId), asOfDate: asOfDate || null, status: sourceResolutionStatus || "UNAVAILABLE", projectionCompleteness: "NONE", sourceResolutionStatus: sourceResolutionStatus || "UNAVAILABLE", ...EMPTY_SLOTS, diagnostics: Object.freeze(diagnostics || []) });
  }
  function legacyRoleFor(employee) {
    if (!employee) return null;
    return EmployeeMaster.normalizeRole(employee.legacyHierarchyRole) || EmployeeMaster.normalizeRole(employee.role) || null;
  }
  function projectionStatus(slots, ambiguous) {
    if (ambiguous) return "AMBIGUOUS";
    const count = Object.values(slots).filter(Boolean).length;
    return count === 5 ? "COMPLETE" : count ? "PARTIAL" : "NONE";
  }
  function projectResolution(resolution, context) {
    const employeeId = EmployeeMaster.normalizeCode(resolution && resolution.employeeId);
    const sourceStatus = resolution && resolution.status || "UNAVAILABLE";
    if (!resolution || !context) return emptyProjection(employeeId, context && context.asOfDate, sourceStatus, ["LEGACY_PROJECTION_CONTEXT_UNAVAILABLE"]);
    if (![...USABLE_STATUSES, "CHAIN_INCOMPLETE"].includes(sourceStatus)) return emptyProjection(employeeId, context.asOfDate, sourceStatus, [`LEGACY_PROJECTION_${sourceStatus}`]);
    const slots = { ...EMPTY_SLOTS }; const diagnostics = []; let ambiguous = false; let previousRoleIndex = -1;
    const chain = [employeeId, ...(Array.isArray(resolution.reportingChain) ? resolution.reportingChain : [])].filter(Boolean);
    chain.forEach((chainEmployeeId) => {
      const role = legacyRoleFor(context.employeeById && context.employeeById.get(chainEmployeeId));
      if (!role) return;
      const field = ROLE_FIELDS[role];
      const roleIndex = ROLE_ORDER.indexOf(role);
      if (roleIndex < previousRoleIndex) diagnostics.push("LEGACY_ROLE_ORDER_MISMATCH");
      previousRoleIndex = Math.max(previousRoleIndex, roleIndex);
      if (slots[field]) { ambiguous = true; diagnostics.push("LEGACY_ROLE_DUPLICATE_IN_CHAIN"); return; }
      slots[field] = chainEmployeeId;
    });
    const status = projectionStatus(slots, ambiguous);
    if (sourceStatus === "CHAIN_INCOMPLETE") diagnostics.push("LEGACY_PROJECTION_SOURCE_CHAIN_INCOMPLETE");
    return Object.freeze({ employeeId, asOfDate: context.asOfDate, status, projectionCompleteness: status === "AMBIGUOUS" ? "PARTIAL" : status, sourceResolutionStatus: sourceStatus, ...slots, diagnostics: Object.freeze([...new Set(diagnostics)].sort()) });
  }
  function projectEmployee(employeeId, context) { return projectResolution(Resolver.resolveEmployee(employeeId, context), context); }
  function projectEmployees(context, employeeIds) {
    const ids = Array.isArray(employeeIds) ? employeeIds : context && context.employeeById ? [...context.employeeById.keys()].sort() : [];
    const projections = Object.freeze(ids.map((employeeId) => projectEmployee(employeeId, context)));
    const count = (status) => projections.filter((projection) => projection.status === status).length;
    const diagnostics = Object.freeze({ projectedEmployeeCount: projections.length, completeProjectionCount: count("COMPLETE"), partialProjectionCount: count("PARTIAL"), noLegacyRoleEvidenceCount: count("NONE"), ambiguousProjectionCount: count("AMBIGUOUS"), roleOrderWarningCount: projections.filter((projection) => projection.diagnostics.includes("LEGACY_ROLE_ORDER_MISMATCH")).length });
    return Object.freeze({ asOfDate: context && context.asOfDate || null, projections, diagnostics });
  }
  function summarize(context, employeeIds) { return projectEmployees(context, employeeIds).diagnostics; }

  global.BancaTrackerDirectHierarchyLegacyProjection = Object.freeze({ projectEmployee, projectEmployees, projectResolution, summarize });
})(window);
