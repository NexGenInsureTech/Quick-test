/*==============================================================
BancaTracker Enterprise
Version : 8.2.0
File    : datasetRegistry.js
Module  : Data Foundation
Purpose : Canonical dataset, status, role and resolution constants
==============================================================*/

(function () {
  "use strict";

  /*==============================================================
  DATASET TYPES
  ==============================================================*/

  const DATASET_TYPES = Object.freeze({
    BRANCH_MASTER: "BRANCH_MASTER",
    GEOGRAPHY_MASTER: "GEOGRAPHY_MASTER",
    EMPLOYEE_MASTER: "EMPLOYEE_MASTER",
    HIERARCHY: "HIERARCHY",
    BRANCH_ASSIGNMENT: "BRANCH_ASSIGNMENT",
    BRANCH_BUDGET_POTENTIAL: "BRANCH_BUDGET_POTENTIAL",
    BUDGET: "BUDGET",
    POTENTIAL: "POTENTIAL",
    PRODUCT_MASTER: "PRODUCT_MASTER",
    TRANSACTION: "TRANSACTION",
  });

  /*==============================================================
  DATASET STATUS
  ==============================================================*/

  const DATASET_STATUS = Object.freeze({
    STAGED: "STAGED",
    ACTIVE: "ACTIVE",
    SUPERSEDED: "SUPERSEDED",
    FAILED: "FAILED",
  });

  /*==============================================================
  EMPLOYEE ROLES
  ==============================================================*/

  const EMPLOYEE_ROLES = Object.freeze({
    NATIONAL_HEAD: "NATIONAL_HEAD",
    ZSM: "ZSM",
    ASM: "ASM",
    CSM: "CSM",
    RM: "RM",
  });

  /*==============================================================
  RESOLUTION STATUS
  ==============================================================*/

  const RESOLUTION_STATUS = Object.freeze({
    MATCHED_EXACT: "MATCHED_EXACT",
    MATCHED_ID: "MATCHED_ID",
    MATCHED_CODE: "MATCHED_CODE",
    MATCHED_NAME: "MATCHED_NAME",
    MATCHED_ALIAS: "MATCHED_ALIAS",
    MATCHED_BRANCH: "MATCHED_BRANCH",
    MATCHED_FALLBACK: "MATCHED_FALLBACK",

    RESOLVED: "RESOLVED",
    PARTIAL: "PARTIAL",

    MASTER_ABSENT: "MASTER_ABSENT",
    UNCONFIGURED: "UNCONFIGURED",
    UNMAPPED: "UNMAPPED",
    AMBIGUOUS: "AMBIGUOUS",

    EMPLOYEE_UNMAPPED: "EMPLOYEE_UNMAPPED",
    MANAGER_MISSING: "MANAGER_MISSING",
    ROLE_MISMATCH: "ROLE_MISMATCH",
    CYCLE_DETECTED: "CYCLE_DETECTED",

    NOT_SUPPLIED: "NOT_SUPPLIED",
    MATCH: "MATCH",
    MISMATCH: "MISMATCH",
  });

  /*==============================================================
  RESOLUTION CONFIDENCE
  ==============================================================*/

  const RESOLUTION_CONFIDENCE = Object.freeze({
    EXACT: "EXACT",
    DERIVED: "DERIVED",
    FALLBACK: "FALLBACK",
    AMBIGUOUS: "AMBIGUOUS",
    UNRESOLVED: "UNRESOLVED",
  });

  /*==============================================================
  DATA QUALITY
  ==============================================================*/

  const DATA_QUALITY_SEVERITY = Object.freeze({
    ERROR: "ERROR",
    WARNING: "WARNING",
    INFO: "INFO",
  });

  const DATA_QUALITY_CATEGORY = Object.freeze({
    SCHEMA: "SCHEMA",
    DATE: "DATE",
    BANK: "BANK",
    BRANCH: "BRANCH",
    GEOGRAPHY: "GEOGRAPHY",
    RM: "RM",
    HIERARCHY: "HIERARCHY",
    PRODUCT: "PRODUCT",
    PREMIUM: "PREMIUM",
    DUPLICATE: "DUPLICATE",
    REFERENCE: "REFERENCE",
    LEGACY_DERIVATION: "LEGACY_DERIVATION",
  });

  /*==============================================================
  ROW PROCESSING STATUS
  ==============================================================*/

  const ROW_STATUS = Object.freeze({
    READY: "READY",
    READY_WITH_WARNINGS: "READY_WITH_WARNINGS",
    INVALID: "INVALID",
  });

  /*==============================================================
  SPECIAL VALUES
  ==============================================================*/

  const SPECIAL_VALUES = Object.freeze({
    UNMAPPED: "UNMAPPED",
    UNCONFIGURED: "UNCONFIGURED",
  });

  /*==============================================================
  DATASET → STORE MAPPING
  ==============================================================*/

  const DATASET_STORE_MAP = Object.freeze({
    [DATASET_TYPES.BRANCH_MASTER]:
      window.BancaTrackerSchema.STORES.BRANCH_MASTER,

    [DATASET_TYPES.GEOGRAPHY_MASTER]:
      window.BancaTrackerSchema.STORES.GEOGRAPHY_MASTER,

    [DATASET_TYPES.EMPLOYEE_MASTER]:
      window.BancaTrackerSchema.STORES.EMPLOYEE_MASTER,

    [DATASET_TYPES.HIERARCHY]:
      window.BancaTrackerSchema.STORES.HIERARCHY_RELATIONSHIPS,

    [DATASET_TYPES.BRANCH_ASSIGNMENT]:
      window.BancaTrackerSchema.STORES.BRANCH_ASSIGNMENTS,

    [DATASET_TYPES.BRANCH_BUDGET_POTENTIAL]:
      window.BancaTrackerSchema.STORES.BRANCH_BUDGET_POTENTIAL,

    [DATASET_TYPES.BUDGET]: window.BancaTrackerSchema.STORES.BUDGETS,

    [DATASET_TYPES.POTENTIAL]: window.BancaTrackerSchema.STORES.POTENTIALS,

    [DATASET_TYPES.PRODUCT_MASTER]:
      window.BancaTrackerSchema.STORES.PRODUCT_MASTER,
  });

  /*==============================================================
  HELPERS
  ==============================================================*/

  function isValidDatasetType(value) {
    return Object.values(DATASET_TYPES).includes(value);
  }

  function isPersistentMasterDataset(value) {
    return Object.prototype.hasOwnProperty.call(DATASET_STORE_MAP, value);
  }

  function getStoreForDatasetType(datasetType) {
    return DATASET_STORE_MAP[datasetType] || null;
  }

  /*==============================================================
  PUBLIC API
  ==============================================================*/

  const BancaTrackerDatasetRegistry = Object.freeze({
    DATASET_TYPES,
    DATASET_STATUS,
    EMPLOYEE_ROLES,
    RESOLUTION_STATUS,
    RESOLUTION_CONFIDENCE,
    DATA_QUALITY_SEVERITY,
    DATA_QUALITY_CATEGORY,
    ROW_STATUS,
    SPECIAL_VALUES,
    DATASET_STORE_MAP,

    isValidDatasetType,
    isPersistentMasterDataset,
    getStoreForDatasetType,
  });

  window.BancaTrackerDatasetRegistry = BancaTrackerDatasetRegistry;
})();
