/*==============================================================
BancaTracker Enterprise
Version : 8.2.0
File    : schema.js
Module  : Data Foundation
Purpose : IndexedDB schema and persistent data structure constants
==============================================================*/

(function () {
  "use strict";

  /*==============================================================
  DATABASE
  ==============================================================*/

  const DATABASE = Object.freeze({
    NAME: "bancatracker-enterprise",
    VERSION: 2,
  });

  /*==============================================================
  OBJECT STORES
  ==============================================================*/

  const STORES = Object.freeze({
    DATASETS: "datasets",
    BRANCH_MASTER: "branchMaster",
    GEOGRAPHY_MASTER: "geographyMaster",
    EMPLOYEE_MASTER: "employeeMaster",
    HIERARCHY_RELATIONSHIPS: "hierarchyRelationships",
    BRANCH_ASSIGNMENTS: "branchAssignments",
    BRANCH_BUDGET_POTENTIAL: "branchBudgetPotential",
    BUDGETS: "budgets",
    POTENTIALS: "potentials",
    PRODUCT_MASTER: "productMaster",
    APP_METADATA: "appMetadata",
  });

  /*==============================================================
  STORE DEFINITIONS
  ==============================================================*/

  const STORE_DEFINITIONS = Object.freeze({
    [STORES.DATASETS]: Object.freeze({
      keyPath: "datasetId",
      indexes: Object.freeze([
        Object.freeze({
          name: "datasetType",
          keyPath: "datasetType",
          options: Object.freeze({ unique: false }),
        }),
        Object.freeze({
          name: "status",
          keyPath: "status",
          options: Object.freeze({ unique: false }),
        }),
      ]),
    }),

    [STORES.BRANCH_MASTER]: Object.freeze({
      keyPath: "recordId",
      indexes: Object.freeze([
        Object.freeze({
          name: "datasetId",
          keyPath: "datasetId",
          options: Object.freeze({ unique: false }),
        }),
        Object.freeze({
          name: "branchId",
          keyPath: "branchId",
          options: Object.freeze({ unique: false }),
        }),
        Object.freeze({
          name: "bankId",
          keyPath: "bankId",
          options: Object.freeze({ unique: false }),
        }),
        Object.freeze({
          name: "stateId",
          keyPath: "stateId",
          options: Object.freeze({ unique: false }),
        }),
        Object.freeze({
          name: "branchCode",
          keyPath: "branchCode",
          options: Object.freeze({ unique: false }),
        }),
        Object.freeze({
          name: "bankBranchKey",
          keyPath: ["bankId", "branchCode"],
          options: Object.freeze({ unique: false }),
        }),
      ]),
    }),

    [STORES.GEOGRAPHY_MASTER]: Object.freeze({
      keyPath: "recordId",
      indexes: Object.freeze([
        Object.freeze({
          name: "datasetId",
          keyPath: "datasetId",
          options: Object.freeze({ unique: false }),
        }),
        Object.freeze({
          name: "stateId",
          keyPath: "stateId",
          options: Object.freeze({ unique: false }),
        }),
        Object.freeze({
          name: "stateCode",
          keyPath: "stateCode",
          options: Object.freeze({ unique: false }),
        }),
        Object.freeze({
          name: "normalizedStateName",
          keyPath: "normalizedStateName",
          options: Object.freeze({ unique: false }),
        }),
        Object.freeze({
          name: "zoneId",
          keyPath: "zoneId",
          options: Object.freeze({ unique: false }),
        }),
      ]),
    }),

    [STORES.EMPLOYEE_MASTER]: Object.freeze({
      keyPath: "recordId",
      indexes: Object.freeze([
        Object.freeze({
          name: "datasetId",
          keyPath: "datasetId",
          options: Object.freeze({ unique: false }),
        }),
        Object.freeze({
          name: "employeeId",
          keyPath: "employeeId",
          options: Object.freeze({ unique: false }),
        }),
        Object.freeze({
          name: "role",
          keyPath: "role",
          options: Object.freeze({ unique: false }),
        }),
        Object.freeze({
          name: "active",
          keyPath: "active",
          options: Object.freeze({ unique: false }),
        }),
      ]),
    }),

    [STORES.HIERARCHY_RELATIONSHIPS]: Object.freeze({
      keyPath: "recordId",
      indexes: Object.freeze([
        Object.freeze({
          name: "datasetId",
          keyPath: "datasetId",
          options: Object.freeze({ unique: false }),
        }),
        Object.freeze({
          name: "employeeId",
          keyPath: "employeeId",
          options: Object.freeze({ unique: false }),
        }),
        Object.freeze({
          name: "managerId",
          keyPath: "managerId",
          options: Object.freeze({ unique: false }),
        }),
      ]),
    }),

    [STORES.BRANCH_ASSIGNMENTS]: Object.freeze({
      keyPath: "recordId",
      indexes: Object.freeze([
        Object.freeze({
          name: "datasetId",
          keyPath: "datasetId",
          options: Object.freeze({ unique: false }),
        }),
        Object.freeze({
          name: "branchId",
          keyPath: "branchId",
          options: Object.freeze({ unique: false }),
        }),
        Object.freeze({
          name: "rmId",
          keyPath: "rmId",
          options: Object.freeze({ unique: false }),
        }),
        Object.freeze({
          name: "active",
          keyPath: "active",
          options: Object.freeze({ unique: false }),
        }),
      ]),
    }),

    [STORES.BRANCH_BUDGET_POTENTIAL]: Object.freeze({
      keyPath: "recordId",
      indexes: Object.freeze([
        Object.freeze({ name: "datasetId", keyPath: "datasetId", options: Object.freeze({ unique: false }) }),
        Object.freeze({ name: "branchId", keyPath: "branchId", options: Object.freeze({ unique: false }) }),
        Object.freeze({ name: "periodKey", keyPath: "periodKey", options: Object.freeze({ unique: false }) }),
        Object.freeze({ name: "branchPeriodKey", keyPath: ["branchId", "periodKey"], options: Object.freeze({ unique: false }) }),
      ]),
    }),

    [STORES.BUDGETS]: Object.freeze({
      keyPath: "recordId",
      indexes: Object.freeze([
        Object.freeze({
          name: "datasetId",
          keyPath: "datasetId",
          options: Object.freeze({ unique: false }),
        }),
        Object.freeze({
          name: "branchId",
          keyPath: "branchId",
          options: Object.freeze({ unique: false }),
        }),
        Object.freeze({
          name: "financialYear",
          keyPath: "financialYear",
          options: Object.freeze({ unique: false }),
        }),
        Object.freeze({
          name: "monthKey",
          keyPath: "monthKey",
          options: Object.freeze({ unique: false }),
        }),
      ]),
    }),

    [STORES.POTENTIALS]: Object.freeze({
      keyPath: "recordId",
      indexes: Object.freeze([
        Object.freeze({
          name: "datasetId",
          keyPath: "datasetId",
          options: Object.freeze({ unique: false }),
        }),
        Object.freeze({
          name: "branchId",
          keyPath: "branchId",
          options: Object.freeze({ unique: false }),
        }),
        Object.freeze({
          name: "financialYear",
          keyPath: "financialYear",
          options: Object.freeze({ unique: false }),
        }),
        Object.freeze({
          name: "monthKey",
          keyPath: "monthKey",
          options: Object.freeze({ unique: false }),
        }),
      ]),
    }),

    [STORES.PRODUCT_MASTER]: Object.freeze({
      keyPath: "recordId",
      indexes: Object.freeze([
        Object.freeze({
          name: "datasetId",
          keyPath: "datasetId",
          options: Object.freeze({ unique: false }),
        }),
        Object.freeze({
          name: "productId",
          keyPath: "productId",
          options: Object.freeze({ unique: false }),
        }),
        Object.freeze({
          name: "productCode",
          keyPath: "productCode",
          options: Object.freeze({ unique: false }),
        }),
        Object.freeze({
          name: "lobId",
          keyPath: "lobId",
          options: Object.freeze({ unique: false }),
        }),
      ]),
    }),

    [STORES.APP_METADATA]: Object.freeze({
      keyPath: "key",
      indexes: Object.freeze([]),
    }),
  });

  /*==============================================================
  PUBLIC API
  ==============================================================*/

  const BancaTrackerSchema = Object.freeze({
    DATABASE,
    STORES,
    STORE_DEFINITIONS,
  });

  window.BancaTrackerSchema = BancaTrackerSchema;
})();
