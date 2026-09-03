/*==============================================================
BancaTracker Enterprise
Version : 8.2.0
File    : repository.js
Module  : Data Foundation
Purpose : Dataset lifecycle, versioning and active dataset registry
==============================================================*/

(function () {
  "use strict";

  /*==============================================================
  DEPENDENCY CHECK
  ==============================================================*/

  if (!window.BancaTrackerSchema) {
    throw new Error("BancaTrackerSchema must be loaded before repository.js");
  }

  if (!window.BancaTrackerDatasetRegistry) {
    throw new Error(
      "BancaTrackerDatasetRegistry must be loaded before repository.js",
    );
  }

  if (!window.BancaTrackerIndexedDb) {
    throw new Error(
      "BancaTrackerIndexedDb must be loaded before repository.js",
    );
  }

  const Schema = window.BancaTrackerSchema;

  const Registry = window.BancaTrackerDatasetRegistry;

  const Db = window.BancaTrackerIndexedDb;

  const { DATASET_TYPES, DATASET_STATUS } = Registry;

  const { STORES } = Schema;

  /*==============================================================
  CONSTANTS
  ==============================================================*/

  const ACTIVE_DATASET_KEY_PREFIX = "activeDataset:";

  /*==============================================================
  INTERNAL HELPERS
  ==============================================================*/

  function assertValidDatasetType(datasetType) {
    if (!Registry.isValidDatasetType(datasetType)) {
      throw new Error(`Invalid dataset type: ${datasetType}`);
    }
  }

  function assertPersistentMasterDataset(datasetType) {
    assertValidDatasetType(datasetType);

    if (!Registry.isPersistentMasterDataset(datasetType)) {
      throw new Error(
        `Dataset type is not a persistent master dataset: ${datasetType}`,
      );
    }
  }

  function getActiveDatasetPointerKey(datasetType) {
    return `${ACTIVE_DATASET_KEY_PREFIX}${datasetType}`;
  }

  function buildDatasetId(datasetType, datasetVersion) {
    return `${datasetType}:${datasetVersion}`;
  }

  function nowIso() {
    return new Date().toISOString();
  }

  /*==============================================================
  DATASET LOOKUPS
  ==============================================================*/

  async function getDatasetsByType(datasetType) {
    assertValidDatasetType(datasetType);

    return Db.getAllByIndex(STORES.DATASETS, "datasetType", datasetType);
  }

  async function getDataset(datasetId) {
    if (!datasetId) {
      return null;
    }

    return Db.get(STORES.DATASETS, datasetId);
  }

  async function getDatasetHistory(datasetType) {
    const datasets = await getDatasetsByType(datasetType);

    return datasets
      .slice()
      .sort(
        (a, b) => Number(b.datasetVersion || 0) - Number(a.datasetVersion || 0),
      );
  }

  /*==============================================================
  VERSIONING
  ==============================================================*/

  async function getNextDatasetVersion(datasetType) {
    const datasets = await getDatasetsByType(datasetType);

    let maxVersion = 0;

    datasets.forEach((dataset) => {
      const version = Number(dataset.datasetVersion);

      if (Number.isFinite(version) && version > maxVersion) {
        maxVersion = version;
      }
    });

    return maxVersion + 1;
  }

  /*==============================================================
  ACTIVE DATASET REGISTRY
  ==============================================================*/

  async function getActiveDatasetId(datasetType) {
    assertValidDatasetType(datasetType);

    const pointer = await Db.get(
      STORES.APP_METADATA,
      getActiveDatasetPointerKey(datasetType),
    );

    if (!pointer || !pointer.value) {
      return null;
    }

    return pointer.value;
  }

  async function getActiveDataset(datasetType) {
    const datasetId = await getActiveDatasetId(datasetType);

    if (!datasetId) {
      return null;
    }

    return getDataset(datasetId);
  }

  async function hasActiveDataset(datasetType) {
    return Boolean(await getActiveDatasetId(datasetType));
  }

  /*==============================================================
  STAGING
  ==============================================================*/

  async function stageDataset({
    datasetType,
    fileName = null,
    rowCount = 0,
    validRows = 0,
    warningCount = 0,
    errorCount = 0,
    metadata = null,
  }) {
    assertPersistentMasterDataset(datasetType);

    const datasetVersion = await getNextDatasetVersion(datasetType);

    const datasetId = buildDatasetId(datasetType, datasetVersion);

    const timestamp = nowIso();

    const dataset = {
      datasetId,
      datasetType,
      datasetVersion,

      fileName,

      uploadedAt: timestamp,

      rowCount,
      validRows,
      warningCount,
      errorCount,

      status: DATASET_STATUS.STAGED,

      previousDatasetId: null,

      activatedAt: null,
      supersededAt: null,
      failedAt: null,

      metadata,
    };

    await Db.put(STORES.DATASETS, dataset);

    return dataset;
  }

  /*==============================================================
  ACTIVATE DATASET
  ==============================================================*/

  async function activateDataset(datasetId) {
    const stagedDataset = await getDataset(datasetId);

    if (!stagedDataset) {
      throw new Error(`Dataset not found: ${datasetId}`);
    }

    assertPersistentMasterDataset(stagedDataset.datasetType);

    if (stagedDataset.status !== DATASET_STATUS.STAGED) {
      throw new Error(
        `Only STAGED datasets can be activated. Current status: ${stagedDataset.status}`,
      );
    }

    const datasetType = stagedDataset.datasetType;

    const pointerKey = getActiveDatasetPointerKey(datasetType);

    const activationTime = nowIso();

    const result = {
      success: false,

      datasetType,
      datasetId,

      previousDatasetId: null,

      activatedAt: activationTime,
    };

    await Db.runTransaction(
      [STORES.DATASETS, STORES.APP_METADATA],
      "readwrite",
      (transaction) => {
        const datasetStore = transaction.objectStore(STORES.DATASETS);

        const metadataStore = transaction.objectStore(STORES.APP_METADATA);

        const pointerRequest = metadataStore.get(pointerKey);

        pointerRequest.onsuccess = () => {
          const pointer = pointerRequest.result;

          const previousDatasetId = pointer ? pointer.value : null;

          result.previousDatasetId = previousDatasetId;

          if (previousDatasetId && previousDatasetId !== datasetId) {
            const previousRequest = datasetStore.get(previousDatasetId);

            previousRequest.onsuccess = () => {
              const previousDataset = previousRequest.result;

              if (previousDataset) {
                datasetStore.put({
                  ...previousDataset,

                  status: DATASET_STATUS.SUPERSEDED,

                  supersededAt: activationTime,
                });
              }
            };
          }

          datasetStore.put({
            ...stagedDataset,

            status: DATASET_STATUS.ACTIVE,

            previousDatasetId,

            activatedAt: activationTime,

            supersededAt: null,
          });

          metadataStore.put({
            key: pointerKey,
            value: datasetId,
            updatedAt: activationTime,
          });

          result.success = true;
        };
      },
    );

    return result;
  }

  /*==============================================================
  MARK DATASET FAILED
  ==============================================================*/

  async function markDatasetFailed(datasetId, failure = null) {
    const dataset = await getDataset(datasetId);

    if (!dataset) {
      throw new Error(`Dataset not found: ${datasetId}`);
    }

    if (dataset.status === DATASET_STATUS.ACTIVE) {
      throw new Error("An ACTIVE dataset cannot be marked FAILED.");
    }

    const updated = {
      ...dataset,

      status: DATASET_STATUS.FAILED,

      failedAt: nowIso(),

      failure,
    };

    await Db.put(STORES.DATASETS, updated);

    return updated;
  }

  /*==============================================================
  DISCARD STAGED DATASET
  ==============================================================*/

  async function discardStagedDataset(datasetId) {
    const dataset = await getDataset(datasetId);

    if (!dataset) {
      return false;
    }

    if (dataset.status !== DATASET_STATUS.STAGED) {
      throw new Error(
        `Only STAGED datasets may be discarded. Current status: ${dataset.status}`,
      );
    }

    const dataStoreName = Registry.getStoreForDatasetType(dataset.datasetType);

    await Db.runTransaction(
      [STORES.DATASETS, dataStoreName],
      "readwrite",
      (transaction) => {
        const datasetStore = transaction.objectStore(STORES.DATASETS);

        const dataStore = transaction.objectStore(dataStoreName);

        const datasetIndex = dataStore.index("datasetId");

        const cursorRequest = datasetIndex.openCursor(
          IDBKeyRange.only(datasetId),
        );

        cursorRequest.onsuccess = () => {
          const cursor = cursorRequest.result;

          if (!cursor) {
            datasetStore.delete(datasetId);

            return;
          }

          cursor.delete();
          cursor.continue();
        };
      },
    );

    return true;
  }

  /*==============================================================
  MASTER RECORD LOOKUP
  ==============================================================*/

  async function getActiveMasterRecords(datasetType) {
    assertPersistentMasterDataset(datasetType);

    const datasetId = await getActiveDatasetId(datasetType);

    if (!datasetId) {
      return [];
    }

    const storeName = Registry.getStoreForDatasetType(datasetType);

    return Db.getAllByIndex(storeName, "datasetId", datasetId);
  }

  async function getActiveEmployeeMasterContext() {
    const dataset = await getActiveDataset(DATASET_TYPES.EMPLOYEE_MASTER);
    if (!dataset) {
      return Object.freeze({ status: "ABSENT", dataset: null, contract: null, records: Object.freeze([]), diagnostics: Object.freeze([]) });
    }
    const employeeMaster = window.BancaTrackerEmployeeMaster;
    if (!employeeMaster || typeof employeeMaster.adaptPersistedDataset !== "function") {
      throw new Error("BancaTrackerEmployeeMaster persistence adapter is unavailable.");
    }
    const contract = employeeMaster.classifyDatasetContract(dataset);
    if (!contract.supported) {
      return Object.freeze({ status: contract.status, dataset, contract, records: Object.freeze([]), diagnostics: contract.diagnostics });
    }
    const records = await getActiveMasterRecords(DATASET_TYPES.EMPLOYEE_MASTER);
    return employeeMaster.adaptPersistedDataset(dataset, records);
  }

  async function getActiveHierarchyContext() {
    const dataset = await getActiveDataset(DATASET_TYPES.HIERARCHY);
    if (!dataset) return Object.freeze({ status: "ABSENT", dataset: null, contract: null, records: Object.freeze([]), diagnostics: Object.freeze([]) });
    const authority = window.BancaTrackerDirectReportingHierarchy;
    if (!authority || typeof authority.adaptPersistedDataset !== "function") throw new Error("BancaTrackerDirectReportingHierarchy persistence adapter is unavailable.");
    const contract = authority.classifyDatasetContract(dataset);
    if (!contract.supported) return Object.freeze({ status: contract.status, dataset, contract, records: Object.freeze([]), diagnostics: contract.diagnostics });
    const records = await getActiveMasterRecords(DATASET_TYPES.HIERARCHY);
    return authority.adaptPersistedDataset(dataset, records);
  }

  async function saveStagedMasterRecords(datasetId, records) {
    const dataset = await getDataset(datasetId);

    if (!dataset) {
      throw new Error(`Dataset not found: ${datasetId}`);
    }

    assertPersistentMasterDataset(dataset.datasetType);

    if (dataset.status !== DATASET_STATUS.STAGED) {
      throw new Error(
        `Records may only be saved for a STAGED dataset. Current status: ${dataset.status}`,
      );
    }

    if (!Array.isArray(records)) {
      throw new TypeError("Master records must be an array.");
    }

    if (records.some((record) => !record || record.datasetId !== datasetId)) {
      throw new Error("Every master record must reference the staged datasetId.");
    }

    const storeName = Registry.getStoreForDatasetType(dataset.datasetType);
    return Db.putMany(storeName, records);
  }

  /*==============================================================
  PUBLIC API
  ==============================================================*/

  const BancaTrackerRepository = Object.freeze({
    getDataset,
    getDatasetsByType,
    getDatasetHistory,

    getNextDatasetVersion,

    getActiveDatasetId,
    getActiveDataset,
    hasActiveDataset,

    stageDataset,
    activateDataset,
    markDatasetFailed,
    discardStagedDataset,
    saveStagedMasterRecords,

    getActiveMasterRecords,
    getActiveEmployeeMasterContext,
    getActiveHierarchyContext,
  });

  window.BancaTrackerRepository = BancaTrackerRepository;
})();
