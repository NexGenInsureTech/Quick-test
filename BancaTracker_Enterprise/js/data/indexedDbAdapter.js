/*==============================================================
BancaTracker Enterprise
Version : 8.2.0
File    : indexedDbAdapter.js
Module  : Data Foundation
Purpose : IndexedDB connection, schema creation and generic storage access
==============================================================*/

(function () {
  "use strict";

  /*==============================================================
  DEPENDENCY CHECK
  ==============================================================*/

  if (!window.BancaTrackerSchema) {
    throw new Error(
      "BancaTrackerSchema must be loaded before indexedDbAdapter.js",
    );
  }

  const { DATABASE, STORE_DEFINITIONS } = window.BancaTrackerSchema;

  let dbPromise = null;

  /*==============================================================
  FEATURE DETECTION
  ==============================================================*/

  function isSupported() {
    return typeof window.indexedDB !== "undefined";
  }

  /*==============================================================
  INDEX CREATION
  ==============================================================*/

  function ensureIndexes(store, indexes) {
    indexes.forEach((indexDefinition) => {
      const { name, keyPath, options } = indexDefinition;

      if (!store.indexNames.contains(name)) {
        store.createIndex(name, keyPath, options || {});
      }
    });
  }

  /*==============================================================
  OBJECT STORE CREATION / UPGRADE
  ==============================================================*/

  function applySchema(db, upgradeTransaction) {
    Object.entries(STORE_DEFINITIONS).forEach(([storeName, definition]) => {
      let store;

      if (!db.objectStoreNames.contains(storeName)) {
        store = db.createObjectStore(storeName, {
          keyPath: definition.keyPath,
        });
      } else {
        store = upgradeTransaction.objectStore(storeName);
      }

      ensureIndexes(store, definition.indexes || []);
    });
  }

  /*==============================================================
  DATABASE OPEN
  ==============================================================*/

  function openDatabase() {
    if (!isSupported()) {
      return Promise.reject(
        new Error("IndexedDB is not supported in this browser."),
      );
    }

    if (dbPromise) {
      return dbPromise;
    }

    dbPromise = new Promise((resolve, reject) => {
      const request = window.indexedDB.open(DATABASE.NAME, DATABASE.VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        const transaction = event.target.transaction;

        applySchema(db, transaction);
      };

      request.onsuccess = (event) => {
        const db = event.target.result;

        db.onversionchange = () => {
          db.close();
          dbPromise = null;
        };

        resolve(db);
      };

      request.onerror = () => {
        dbPromise = null;

        reject(
          request.error ||
            new Error("Unable to open BancaTracker IndexedDB database."),
        );
      };

      request.onblocked = () => {
        console.warn(
          "BancaTracker IndexedDB upgrade is blocked by another open application tab.",
        );
      };
    });

    return dbPromise;
  }

  /*==============================================================
  DATABASE CLOSE
  ==============================================================*/

  async function closeDatabase() {
    if (!dbPromise) {
      return;
    }

    try {
      const db = await dbPromise;
      db.close();
    } finally {
      dbPromise = null;
    }
  }

  /*==============================================================
  TRANSACTION HELPER
  ==============================================================*/

  async function runTransaction(storeNames, mode, operation) {
    const db = await openDatabase();

    const names = Array.isArray(storeNames) ? storeNames : [storeNames];

    return new Promise((resolve, reject) => {
      let operationResult;

      let transaction;

      try {
        transaction = db.transaction(names, mode);

        operationResult = operation(transaction);
      } catch (error) {
        reject(error);
        return;
      }

      transaction.oncomplete = () => {
        resolve(operationResult);
      };

      transaction.onerror = () => {
        reject(transaction.error || new Error("IndexedDB transaction failed."));
      };

      transaction.onabort = () => {
        reject(
          transaction.error || new Error("IndexedDB transaction was aborted."),
        );
      };
    });
  }

  /*==============================================================
  WRITE OPERATIONS
  ==============================================================*/

  async function put(storeName, value) {
    const db = await openDatabase();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, "readwrite");

      const store = transaction.objectStore(storeName);

      const request = store.put(value);

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(
          request.error || new Error(`Unable to write to store: ${storeName}`),
        );
      };
    });
  }

  async function putMany(storeName, values) {
    if (!Array.isArray(values)) {
      throw new TypeError("putMany expects an array of values.");
    }

    if (values.length === 0) {
      return [];
    }

    const db = await openDatabase();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, "readwrite");

      const store = transaction.objectStore(storeName);

      const keys = [];

      values.forEach((value) => {
        const request = store.put(value);

        request.onsuccess = () => {
          keys.push(request.result);
        };
      });

      transaction.oncomplete = () => {
        resolve(keys);
      };

      transaction.onerror = () => {
        reject(
          transaction.error ||
            new Error(`Unable to write records to store: ${storeName}`),
        );
      };

      transaction.onabort = () => {
        reject(
          transaction.error ||
            new Error(`IndexedDB write transaction aborted: ${storeName}`),
        );
      };
    });
  }

  /*==============================================================
  READ OPERATIONS
  ==============================================================*/

  async function get(storeName, key) {
    const db = await openDatabase();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, "readonly");

      const store = transaction.objectStore(storeName);

      const request = store.get(key);

      request.onsuccess = () => {
        resolve(request.result || null);
      };

      request.onerror = () => {
        reject(
          request.error || new Error(`Unable to read from store: ${storeName}`),
        );
      };
    });
  }

  async function getAll(storeName) {
    const db = await openDatabase();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, "readonly");

      const store = transaction.objectStore(storeName);

      const request = store.getAll();

      request.onsuccess = () => {
        resolve(request.result || []);
      };

      request.onerror = () => {
        reject(
          request.error || new Error(`Unable to read store: ${storeName}`),
        );
      };
    });
  }

  async function getAllByIndex(storeName, indexName, query) {
    const db = await openDatabase();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, "readonly");

      const store = transaction.objectStore(storeName);

      if (!store.indexNames.contains(indexName)) {
        reject(
          new Error(
            `Index "${indexName}" does not exist on store "${storeName}".`,
          ),
        );
        return;
      }

      const index = store.index(indexName);

      const request =
        typeof query === "undefined" ? index.getAll() : index.getAll(query);

      request.onsuccess = () => {
        resolve(request.result || []);
      };

      request.onerror = () => {
        reject(
          request.error ||
            new Error(
              `Unable to query index "${indexName}" on store "${storeName}".`,
            ),
        );
      };
    });
  }

  /*==============================================================
  DELETE OPERATIONS
  ==============================================================*/

  async function remove(storeName, key) {
    const db = await openDatabase();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, "readwrite");

      const store = transaction.objectStore(storeName);

      const request = store.delete(key);

      request.onsuccess = () => {
        resolve(true);
      };

      request.onerror = () => {
        reject(
          request.error ||
            new Error(`Unable to delete from store: ${storeName}`),
        );
      };
    });
  }

  async function clearStore(storeName) {
    const db = await openDatabase();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, "readwrite");

      const store = transaction.objectStore(storeName);

      const request = store.clear();

      request.onsuccess = () => {
        resolve(true);
      };

      request.onerror = () => {
        reject(
          request.error || new Error(`Unable to clear store: ${storeName}`),
        );
      };
    });
  }

  /*==============================================================
  PUBLIC API
  ==============================================================*/

  const BancaTrackerIndexedDb = Object.freeze({
    isSupported,

    openDatabase,
    closeDatabase,

    runTransaction,

    put,
    putMany,

    get,
    getAll,
    getAllByIndex,

    remove,
    clearStore,
  });

  window.BancaTrackerIndexedDb = BancaTrackerIndexedDb;
})();
