/*==============================================================
Banca360 Enterprise Platform
Version : 0.1.0
File    : storage.js
Module  : Core Storage
Purpose : Centralized browser persistence management
Author  : OpenAI

DESCRIPTION
-----------
The Storage Manager provides a controlled abstraction over
browser localStorage.

Responsibilities:

    • Application preference persistence
    • Safe value serialization
    • Safe value deserialization
    • Namespaced storage keys
    • Storage availability detection
    • Get / set / remove operations
    • Storage clearing
    • Storage diagnostics

The Storage Manager deliberately contains no business logic.

Application state belongs to:

    Banc360.State

Application events belong to:

    Banc360.EventBus

==============================================================*/

"use strict";

/*==============================================================
NAMESPACE
==============================================================*/

window.Banc360 = window.Banc360 || {};

/*==============================================================
STORAGE MANAGER
==============================================================*/

Banc360.Storage = (function () {
  /*============================================================
      PRIVATE STATE
    ============================================================*/

  let initialized = false;

  let available = false;

  let namespace = "banc360";

  /*============================================================
      SAFE LOGGING
    ============================================================*/

  function log(message, ...args) {
    if (typeof Banc360.log === "function") {
      Banc360.log(message, ...args);
    }
  }

  function warn(message, ...args) {
    if (typeof Banc360.warn === "function") {
      Banc360.warn(message, ...args);
      return;
    }

    if (typeof console !== "undefined" && typeof console.warn === "function") {
      console.warn(message, ...args);
    }
  }

  function reportError(message, ...args) {
    if (typeof Banc360.error === "function") {
      Banc360.error(message, ...args);
      return;
    }

    if (typeof console !== "undefined" && typeof console.error === "function") {
      console.error(message, ...args);
    }
  }

  /*============================================================
      CONFIGURATION
    ============================================================*/

  function resolveNamespace() {
    /*
        Prefer the configured storage namespace when one exists.
    */

    if (
      Banc360.Config &&
      Banc360.Config.storage &&
      typeof Banc360.Config.storage.namespace === "string" &&
      Banc360.Config.storage.namespace.trim()
    ) {
      return Banc360.Config.storage.namespace.trim().replace(/\.+$/, "");
    }

    /*
        Fallback keeps the storage layer usable even if Config
        evolves or is unavailable during early initialization.
    */

    return "banc360";
  }

  /*============================================================
      KEY NORMALIZATION
    ============================================================*/

  function normalizeKey(key) {
    if (typeof key !== "string") {
      return "";
    }

    return key.trim();
  }

  /*============================================================
      NAMESPACED KEY
    ============================================================*/

  function buildKey(key) {
    const normalizedKey = normalizeKey(key);

    if (!normalizedKey) {
      return "";
    }

    /*
        Avoid double-prefixing when a caller already supplies
        the complete namespace.
    */

    if (normalizedKey.startsWith(`${namespace}.`)) {
      return normalizedKey;
    }

    return `${namespace}.${normalizedKey}`;
  }

  /*============================================================
      STORAGE AVAILABILITY
    ============================================================*/

  function checkAvailability() {
    if (typeof window === "undefined") {
      return false;
    }

    try {
      if (!window.localStorage) {
        return false;
      }

      const testKey = `__${namespace}__storage_test__`;

      window.localStorage.setItem(testKey, "1");

      window.localStorage.removeItem(testKey);

      return true;
    } catch (error) {
      reportError("Banc360 localStorage is unavailable:", error);

      return false;
    }
  }

  /*============================================================
      SERIALIZE
    ============================================================*/

  function serialize(value) {
    /*
        Strings are stored directly.

        This preserves compatibility with simple existing
        storage values while objects, arrays, numbers and
        booleans are encoded safely.
    */

    if (typeof value === "string") {
      return value;
    }

    try {
      return JSON.stringify(value);
    } catch (error) {
      reportError("Banc360 Storage serialization failed:", error);

      return null;
    }
  }

  /*============================================================
      DESERIALIZE
    ============================================================*/

  function deserialize(value) {
    if (value === null || typeof value === "undefined") {
      return null;
    }

    /*
        Attempt JSON decoding first.

        If the stored value is a plain string that was not
        JSON encoded, return it unchanged.
    */

    try {
      return JSON.parse(value);
    } catch (error) {
      return value;
    }
  }

  /*============================================================
      INITIALIZE
    ============================================================*/

  function initialize() {
    if (initialized) {
      return available;
    }

    namespace = resolveNamespace();

    available = checkAvailability();

    initialized = true;

    if (available) {
      log("Storage Manager Initialized");
    } else {
      warn("Storage Manager Initialized in unavailable mode.");
    }

    return available;
  }

  /*============================================================
      IS AVAILABLE
    ============================================================*/

  function isAvailable() {
    if (!initialized) {
      initialize();
    }

    return available;
  }

  /*============================================================
      SET
    ============================================================*/

  function set(key, value) {
    if (!initialized) {
      initialize();
    }

    if (!available) {
      return false;
    }

    const storageKey = buildKey(key);

    if (!storageKey) {
      warn("Storage.set requires a valid key.");

      return false;
    }

    const serialized = serialize(value);

    if (serialized === null) {
      return false;
    }

    try {
      window.localStorage.setItem(storageKey, serialized);

      return true;
    } catch (error) {
      /*
          QuotaExceededError and browser privacy restrictions
          are handled here rather than propagated into the
          application.
      */

      reportError(`Banc360 Storage.set failed for "${key}":`, error);

      return false;
    }
  }

  /*============================================================
      GET
    ============================================================*/

  function get(key, defaultValue = null) {
    if (!initialized) {
      initialize();
    }

    if (!available) {
      return defaultValue;
    }

    const storageKey = buildKey(key);

    if (!storageKey) {
      warn("Storage.get requires a valid key.");

      return defaultValue;
    }

    try {
      const storedValue = window.localStorage.getItem(storageKey);

      if (storedValue === null) {
        return defaultValue;
      }

      return deserialize(storedValue);
    } catch (error) {
      reportError(`Banc360 Storage.get failed for "${key}":`, error);

      return defaultValue;
    }
  }

  /*============================================================
      HAS
    ============================================================*/

  function has(key) {
    if (!initialized) {
      initialize();
    }

    if (!available) {
      return false;
    }

    const storageKey = buildKey(key);

    if (!storageKey) {
      return false;
    }

    try {
      return window.localStorage.getItem(storageKey) !== null;
    } catch (error) {
      reportError(`Banc360 Storage.has failed for "${key}":`, error);

      return false;
    }
  }

  /*============================================================
      REMOVE
    ============================================================*/

  function remove(key) {
    if (!initialized) {
      initialize();
    }

    if (!available) {
      return false;
    }

    const storageKey = buildKey(key);

    if (!storageKey) {
      warn("Storage.remove requires a valid key.");

      return false;
    }

    try {
      window.localStorage.removeItem(storageKey);

      return true;
    } catch (error) {
      reportError(`Banc360 Storage.remove failed for "${key}":`, error);

      return false;
    }
  }

  /*============================================================
      CLEAR NAMESPACE
    ============================================================*/

  function clear() {
    if (!initialized) {
      initialize();
    }

    if (!available) {
      return false;
    }

    try {
      const keysToRemove = [];

      for (let index = 0; index < window.localStorage.length; index++) {
        const key = window.localStorage.key(index);

        if (key && (key === namespace || key.startsWith(`${namespace}.`))) {
          keysToRemove.push(key);
        }
      }

      keysToRemove.forEach(function (key) {
        window.localStorage.removeItem(key);
      });

      return true;
    } catch (error) {
      reportError("Banc360 Storage.clear failed:", error);

      return false;
    }
  }

  /*============================================================
      GET ALL NAMESPACE VALUES
    ============================================================*/

  function getAll() {
    if (!initialized) {
      initialize();
    }

    if (!available) {
      return {};
    }

    const result = {};

    try {
      for (let index = 0; index < window.localStorage.length; index++) {
        const storageKey = window.localStorage.key(index);

        if (!storageKey) {
          continue;
        }

        if (
          storageKey !== namespace &&
          !storageKey.startsWith(`${namespace}.`)
        ) {
          continue;
        }

        const key =
          storageKey === namespace
            ? ""
            : storageKey.substring(`${namespace}.`.length);

        result[key] = deserialize(window.localStorage.getItem(storageKey));
      }
    } catch (error) {
      reportError("Banc360 Storage.getAll failed:", error);
    }

    return result;
  }

  /*============================================================
      GET NAMESPACE
    ============================================================*/

  function getNamespace() {
    return namespace;
  }

  /*============================================================
      GET STORAGE SIZE
    ============================================================*/

  function getSize() {
    if (!initialized) {
      initialize();
    }

    if (!available) {
      return 0;
    }

    let count = 0;

    try {
      for (let index = 0; index < window.localStorage.length; index++) {
        const storageKey = window.localStorage.key(index);

        if (
          storageKey &&
          (storageKey === namespace || storageKey.startsWith(`${namespace}.`))
        ) {
          count++;
        }
      }
    } catch (error) {
      reportError("Banc360 Storage.getSize failed:", error);
    }

    return count;
  }

  /*============================================================
      PUBLIC API
    ============================================================*/

  return Object.freeze({
    initialize,

    isAvailable,

    set,

    get,

    has,

    remove,

    clear,

    getAll,

    getNamespace,

    getSize,
  });
})();

/*==============================================================
INITIALIZE STORAGE MANAGER
==============================================================*/

Banc360.Storage.initialize();
