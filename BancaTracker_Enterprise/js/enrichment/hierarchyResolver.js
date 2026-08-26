/*==============================================================
BancaTracker Enterprise
Version : 8.2.0-dev
File    : hierarchyResolver.js
Module  : Enrichment Foundation
Purpose : Resolve reporting chains from active hierarchy masters
==============================================================*/

(function () {
  "use strict";

  if (!window.BancaTrackerDatasetRegistry) {
    throw new Error(
      "BancaTrackerDatasetRegistry must be loaded before hierarchyResolver.js",
    );
  }

  if (!window.BancaTrackerEmployeeMaster) {
    throw new Error(
      "BancaTrackerEmployeeMaster must be loaded before hierarchyResolver.js",
    );
  }

  const Registry = window.BancaTrackerDatasetRegistry;
  const EmployeeMaster = window.BancaTrackerEmployeeMaster;
  const { EMPLOYEE_ROLES, RESOLUTION_STATUS } = Registry;

  const ROLE_RESULT_FIELDS = Object.freeze({
    [EMPLOYEE_ROLES.RM]: "rmId",
    [EMPLOYEE_ROLES.CSM]: "csmId",
    [EMPLOYEE_ROLES.ASM]: "asmId",
    [EMPLOYEE_ROLES.ZSM]: "zsmId",
    [EMPLOYEE_ROLES.NATIONAL_HEAD]: "nationalHeadId",
  });

  function buildEmployeeMap(records) {
    return new Map(
      records
        .filter((record) => record.active !== false && record.employeeId)
        .map((record) => [record.employeeId, record]),
    );
  }

  function buildLookupMaps(employeeRecords, hierarchyRecords) {
    const employeeById = buildEmployeeMap(employeeRecords || []);
    const managerByEmployeeId = new Map();

    (hierarchyRecords || []).forEach((record) => {
      if (record.employeeId) {
        managerByEmployeeId.set(record.employeeId, record.managerId || null);
      }
    });

    return {
      employeeById,
      managerByEmployeeId,
    };
  }

  function getManager(employeeId, lookupMaps) {
    if (!lookupMaps || !lookupMaps.managerByEmployeeId.has(employeeId)) {
      return null;
    }

    const managerId = lookupMaps.managerByEmployeeId.get(employeeId);

    return managerId ? lookupMaps.employeeById.get(managerId) || null : null;
  }

  function buildResult(status, chain, extra = {}) {
    const result = {
      success: status === RESOLUTION_STATUS.RESOLVED,
      status,
      source: status === RESOLUTION_STATUS.MASTER_ABSENT ? null : "HIERARCHY",
      rmId: null,
      csmId: null,
      asmId: null,
      zsmId: null,
      nationalHeadId: null,
      chain,
      ...extra,
    };

    chain.forEach((employee) => {
      const field = ROLE_RESULT_FIELDS[employee.role];

      if (field) {
        result[field] = employee.employeeId;
      }
    });

    return result;
  }

  function resolveHierarchy(employeeId, lookupMaps) {
    const normalizedEmployeeId = EmployeeMaster.normalizeCode(employeeId);

    if (!lookupMaps) {
      return buildResult(RESOLUTION_STATUS.MASTER_ABSENT, [], {
        employeeId: normalizedEmployeeId,
      });
    }

    const startingEmployee = lookupMaps.employeeById.get(normalizedEmployeeId);

    if (!startingEmployee) {
      return buildResult(RESOLUTION_STATUS.EMPLOYEE_UNMAPPED, [], {
        employeeId: normalizedEmployeeId,
      });
    }

    const chain = [];
    const visited = new Set();
    let current = startingEmployee;

    while (current) {
      if (visited.has(current.employeeId)) {
        return buildResult(RESOLUTION_STATUS.CYCLE_DETECTED, chain, {
          employeeId: normalizedEmployeeId,
        });
      }

      visited.add(current.employeeId);
      chain.push(current);

      if (current.role === EMPLOYEE_ROLES.NATIONAL_HEAD) {
        return buildResult(RESOLUTION_STATUS.RESOLVED, chain, {
          employeeId: normalizedEmployeeId,
        });
      }

      if (!lookupMaps.managerByEmployeeId.has(current.employeeId)) {
        return buildResult(RESOLUTION_STATUS.PARTIAL, chain, {
          employeeId: normalizedEmployeeId,
          stoppedAtEmployeeId: current.employeeId,
          reason: RESOLUTION_STATUS.MANAGER_MISSING,
        });
      }

      const managerId = lookupMaps.managerByEmployeeId.get(current.employeeId);
      const manager = managerId
        ? lookupMaps.employeeById.get(managerId)
        : null;

      if (!manager) {
        return buildResult(RESOLUTION_STATUS.PARTIAL, chain, {
          employeeId: normalizedEmployeeId,
          stoppedAtEmployeeId: current.employeeId,
          missingManagerId: managerId,
          reason: RESOLUTION_STATUS.MANAGER_MISSING,
        });
      }

      current = manager;
    }

    return buildResult(RESOLUTION_STATUS.PARTIAL, chain, {
      employeeId: normalizedEmployeeId,
    });
  }

  window.BancaTrackerHierarchyResolver = Object.freeze({
    buildEmployeeMap,
    buildLookupMaps,
    getManager,
    resolveHierarchy,
  });
})();
