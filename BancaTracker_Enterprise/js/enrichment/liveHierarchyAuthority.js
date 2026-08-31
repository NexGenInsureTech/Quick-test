/*==============================================================
BancaTracker Enterprise
Version : 8.2.0
File    : liveHierarchyAuthority.js
Module  : Enrichment Foundation
Purpose : Apply governed organisation hierarchy to live fact records
==============================================================*/

(function (global) {
  "use strict";

  let cachedContext = null;

  function setCachedContext(context) {
    cachedContext = context || { hierarchyMaps: null };
    return cachedContext;
  }

  function getCachedContext() {
    return cachedContext;
  }

  async function loadContext(repository = global.BancaTrackerRepository, baseContext = null) {
    if (!repository) return setCachedContext({ ...(baseContext || {}), hierarchyMaps: null });
    const hierarchyRecords = await repository
      .getActiveMasterRecords("HIERARCHY")
      .catch(() => []);
    const employees = baseContext && baseContext.employeeById
      ? [...baseContext.employeeById.values()]
      : [];
    return setCachedContext({
      ...(baseContext || {}),
      hierarchyMaps: hierarchyRecords.length
        ? global.BancaTrackerHierarchyResolver.buildLookupMaps(employees, hierarchyRecords)
        : null,
    });
  }

  function emptyFields() {
    return {
      hierarchyRmId: null, hierarchyRmName: null,
      csmId: null, csmName: null, asmId: null, asmName: null,
      zsmId: null, zsmName: null,
      nationalHeadId: null, nationalHeadName: null,
      hierarchyDepth: 0, hierarchyEmployeeMetadataMissing: 0,
    };
  }

  function nameFor(employeeById, employeeId) {
    const employee = employeeById && employeeById.get(employeeId);
    return employee && employee.employeeName || null;
  }

  function applyRecord(record, context = cachedContext) {
    const maps = context || { hierarchyMaps: null, employeeById: null };
    if (record.assignmentAuthority !== "ASSIGNED" || !record.assignedRmId) {
      return {
        ...record, ...emptyFields(),
        hierarchyAuthority: "ASSIGNMENT_UNRESOLVED",
        hierarchyResolutionStatus: "ASSIGNMENT_UNRESOLVED",
      };
    }
    if (!maps.hierarchyMaps) {
      return {
        ...record, ...emptyFields(),
        hierarchyAuthority: "MASTER_ABSENT",
        hierarchyResolutionStatus: "MASTER_ABSENT",
      };
    }

    const resolution = global.BancaTrackerHierarchyResolver.resolveHierarchy(
      record.assignedRmId,
      maps.hierarchyMaps,
    );
    const hierarchyAuthority = {
      RESOLVED: "RESOLVED", PARTIAL: "PARTIAL",
      EMPLOYEE_UNMAPPED: "HIERARCHY_UNMAPPED",
      CYCLE_DETECTED: "INVALID_CHAIN",
    }[resolution.status] || "INVALID_CHAIN";
    const employeeById = maps.employeeById || maps.hierarchyMaps.employeeById;
    const fields = {
      hierarchyRmId: resolution.rmId || null,
      csmId: resolution.csmId || null,
      asmId: resolution.asmId || null,
      zsmId: resolution.zsmId || null,
      nationalHeadId: resolution.nationalHeadId || null,
    };
    fields.hierarchyRmName = nameFor(employeeById, fields.hierarchyRmId);
    fields.csmName = nameFor(employeeById, fields.csmId);
    fields.asmName = nameFor(employeeById, fields.asmId);
    fields.zsmName = nameFor(employeeById, fields.zsmId);
    fields.nationalHeadName = nameFor(employeeById, fields.nationalHeadId);
    const idNamePairs = [
      [fields.hierarchyRmId, fields.hierarchyRmName], [fields.csmId, fields.csmName],
      [fields.asmId, fields.asmName], [fields.zsmId, fields.zsmName],
      [fields.nationalHeadId, fields.nationalHeadName],
    ];

    return {
      ...record, ...fields,
      hierarchyDepth: Math.max(0, (resolution.chain || []).length - 1),
      hierarchyEmployeeMetadataMissing: idNamePairs.filter(([id, name]) => id && !name).length,
      hierarchyAuthority,
      hierarchyResolutionStatus: resolution.status,
    };
  }

  function applyRecords(records, context = cachedContext) {
    return records.map((record) => applyRecord(record, context));
  }

  global.BancaTrackerLiveHierarchyAuthority = Object.freeze({
    loadContext, setCachedContext, getCachedContext, applyRecord, applyRecords,
  });
})(window);
