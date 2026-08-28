/*==============================================================
BancaTracker Enterprise
Version : 8.2.0-dev
File    : liveAssignmentAuthority.js
Module  : Enrichment Foundation
Purpose : Resolve governed branch ownership while preserving source RM identity
==============================================================*/

(function (global) {
  "use strict";

  let cachedContext = null;

  const normalizeCode = (value) => {
    const normalized = String(value == null ? "" : value).trim();
    return normalized ? normalized.toUpperCase() : null;
  };
  const normalizeText = (value) => {
    const normalized = String(value == null ? "" : value).trim();
    return normalized || null;
  };

  function setCachedContext(context) {
    cachedContext = context || { assignmentMaps: null, employeeById: null };
    return cachedContext;
  }

  function getCachedContext() {
    return cachedContext;
  }

  async function loadContext(repository = global.BancaTrackerRepository, baseContext = null) {
    if (!repository) return setCachedContext({ ...(baseContext || {}), assignmentMaps: null, employeeById: null });
    const [assignments, employees] = await Promise.all([
      repository.getActiveMasterRecords("BRANCH_ASSIGNMENT").catch(() => []),
      repository.getActiveMasterRecords("EMPLOYEE_MASTER").catch(() => []),
    ]);
    return setCachedContext({
      ...(baseContext || {}),
      assignmentMaps: assignments.length
        ? global.BancaTrackerAssignmentResolver.buildLookupMaps(assignments)
        : null,
      employeeById: employees.length
        ? new Map(employees.filter((record) => record.active !== false && record.employeeId).map((record) => [record.employeeId, record]))
        : null,
    });
  }

  function compare(sourceRmId, assignedRmId) {
    if (sourceRmId && assignedRmId) return sourceRmId === assignedRmId ? "MATCH" : "MISMATCH";
    if (!sourceRmId && assignedRmId) return "SOURCE_MISSING";
    if (sourceRmId && !assignedRmId) return "ASSIGNED_MISSING";
    return "NOT_COMPARABLE";
  }

  function unresolved(record, sourceRmId, sourceRmName, assignmentAuthority, assignmentStatus) {
    return {
      ...record, sourceRmId, sourceRmName,
      assignedRmId: null, assignedRmName: null, assignedRmRole: null,
      assignedRmStatus: null, assignedEmployeeResolution: null,
      assignmentAuthority, assignmentResolutionStatus: assignmentStatus,
      rmComparison: compare(sourceRmId, null),
    };
  }

  function applyRecord(record, context = cachedContext) {
    const maps = context || { assignmentMaps: null, employeeById: null };
    const sourceRmId = normalizeCode(record.sourceRmId || record.baCode);
    const sourceRmName = normalizeText(record.sourceRmName || record.rm);

    if (!record.branchId) {
      return unresolved(record, sourceRmId, sourceRmName, "BRANCH_UNRESOLVED", "BRANCH_UNRESOLVED");
    }
    if (!maps.assignmentMaps) {
      return unresolved(record, sourceRmId, sourceRmName, "MASTER_ABSENT", "MASTER_ABSENT");
    }

    const resolution = global.BancaTrackerAssignmentResolver.resolveAssignment(
      record.branchId,
      maps.assignmentMaps,
    );
    if (!resolution.success) {
      const authority = resolution.status === "AMBIGUOUS" ? "AMBIGUOUS" : "UNMAPPED";
      return unresolved(record, sourceRmId, sourceRmName, authority, resolution.status);
    }

    const assignedRmId = normalizeCode(resolution.rmId);
    const employee = maps.employeeById && maps.employeeById.get(assignedRmId);
    return {
      ...record, sourceRmId, sourceRmName,
      assignedRmId,
      assignedRmName: employee ? employee.employeeName : null,
      assignedRmRole: employee ? employee.role : null,
      assignedRmStatus: employee ? (employee.active === false ? "INACTIVE" : "ACTIVE") : null,
      assignedEmployeeResolution: !maps.employeeById ? "MASTER_ABSENT" : employee ? "RESOLVED" : "UNMAPPED",
      assignmentAuthority: "ASSIGNED",
      assignmentResolutionStatus: resolution.status,
      rmComparison: compare(sourceRmId, assignedRmId),
    };
  }

  function applyRecords(records, context = cachedContext) {
    return records.map((record) => applyRecord(record, context));
  }

  global.BancaTrackerLiveAssignmentAuthority = Object.freeze({
    loadContext, setCachedContext, getCachedContext, applyRecord, applyRecords, compare,
  });
})(window);
