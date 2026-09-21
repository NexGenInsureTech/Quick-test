/*==============================================================
BancaTracker Enterprise
Version : 8.6.0
File    : liveTargetSeasonalityAuthority.js
Module  : Enrichment Foundation
Purpose : Cache active Target Seasonality records for synchronous consumers
==============================================================*/

(function (global) {
  "use strict";

  const DATASET_TYPE = "TARGET_SEASONALITY";
  const STATUS = Object.freeze({
    NOT_LOADED: "NOT_LOADED",
    ABSENT: "ABSENT",
    READY: "READY",
    LOAD_FAILED: "LOAD_FAILED",
  });

  function detachDataset(dataset) {
    return dataset ? Object.freeze({ ...dataset }) : null;
  }

  function detachRecords(records) {
    return Object.freeze((Array.isArray(records) ? records : []).map((record) => Object.freeze({ ...record })));
  }

  function createContext(status, dataset = null, records = [], diagnostics = []) {
    return Object.freeze({
      status,
      dataset: detachDataset(dataset),
      records: detachRecords(records),
      diagnostics: Object.freeze([...(diagnostics || [])]),
    });
  }

  let cachedContext = createContext(STATUS.NOT_LOADED, null, [], ["TARGET_SEASONALITY_NOT_LOADED"]);

  function getCachedContext() {
    return createContext(
      cachedContext.status,
      cachedContext.dataset,
      cachedContext.records,
      cachedContext.diagnostics,
    );
  }

  function setFromDataset(dataset, records) {
    if (!dataset || dataset.datasetType !== DATASET_TYPE || dataset.status !== "ACTIVE") {
      throw new Error("Target Seasonality cache requires an ACTIVE TARGET_SEASONALITY dataset.");
    }
    cachedContext = createContext(STATUS.READY, dataset, records, []);
    return getCachedContext();
  }

  async function loadContext(repository = global.BancaTrackerRepository) {
    if (!repository || typeof repository.getActiveDataset !== "function") {
      cachedContext = createContext(STATUS.LOAD_FAILED, null, [], ["TARGET_SEASONALITY_REPOSITORY_UNAVAILABLE"]);
      return getCachedContext();
    }
    try {
      const dataset = await repository.getActiveDataset(DATASET_TYPE);
      if (!dataset) {
        cachedContext = createContext(STATUS.ABSENT, null, [], ["TARGET_SEASONALITY_ABSENT"]);
        return getCachedContext();
      }
      const records = await repository.getActiveMasterRecords(DATASET_TYPE);
      return setFromDataset(dataset, records);
    } catch (error) {
      cachedContext = createContext(STATUS.LOAD_FAILED, null, [], ["TARGET_SEASONALITY_LOAD_FAILED"]);
      return getCachedContext();
    }
  }

  global.BancaTrackerLiveTargetSeasonalityAuthority = Object.freeze({
    loadContext,
    setFromDataset,
    getCachedContext,
  });
})(window);
