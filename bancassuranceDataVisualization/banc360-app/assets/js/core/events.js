/*==============================================================
Banca360 Enterprise Platform
Version : 0.1.0
File    : events.js
Module  : Core Application Events
Purpose : Centralized application event bus and event registry
Author  : OpenAI

DESCRIPTION
-----------
The Events Manager provides the application's centralized
publish / subscribe mechanism.

Public APIs:

    Banc360.EventBus
    Banc360.EventNames

Responsibilities:

    • Application event registration
    • Event publishing
    • Event subscription
    • Event unsubscription
    • One-time event listeners
    • Standardized event names
    • Event listener cleanup
    • Event diagnostics

The Event Bus does not own application state.

Application state belongs to:

    Banc360.State

==============================================================*/

"use strict";

/*==============================================================
NAMESPACE
==============================================================*/

window.Banc360 = window.Banc360 || {};

/*==============================================================
EVENT NAMES
==============================================================*/

/*
    IMPORTANT
    ---------
    These names are part of the existing Banca360 application
    contract.

    They are intentionally aligned with the EventNames already
    referenced by app.js, router.js and bootstrap.js.

    Do not rename existing constants without first updating
    every consuming module.
*/

Banc360.EventNames = Object.freeze({
  /*------------------------------------------------------------
      Application
    ------------------------------------------------------------*/

  APP_INIT: "app:init",

  APP_INITIALIZED: "app:initialized",

  APP_READY: "app:ready",

  APP_ERROR: "app:error",

  APP_LOADING_START: "app:loading:start",

  APP_LOADING_STOP: "app:loading:stop",

  /*------------------------------------------------------------
      Navigation
    ------------------------------------------------------------*/

  ROUTE_CHANGED: "route:changed",

  PAGE_CHANGED: "page:changed",

  /*------------------------------------------------------------
      UI
    ------------------------------------------------------------*/

  SIDEBAR_TOGGLED: "ui:sidebar:toggled",

  MOBILE_MENU_TOGGLED: "ui:mobile-menu:toggled",

  PAGE_TITLE_CHANGED: "ui:page-title:changed",

  /*------------------------------------------------------------
      Theme
    ------------------------------------------------------------*/

  THEME_CHANGED: "theme:changed",

  /*------------------------------------------------------------
      Dashboard
    ------------------------------------------------------------*/

  DASHBOARD_REFRESH_STARTED: "dashboard:refresh:started",

  DASHBOARD_REFRESH_COMPLETED: "dashboard:refresh:completed",

  /*------------------------------------------------------------
      Partners
    ------------------------------------------------------------*/

  PARTNER_SELECTED: "partner:selected",

  PARTNER_CLEARED: "partner:cleared",

  /*------------------------------------------------------------
      Settings
    ------------------------------------------------------------*/

  SETTINGS_INITIALIZED: "settings:initialized",

  SETTINGS_CHANGED: "settings:changed",

  /*------------------------------------------------------------
      Storage
    ------------------------------------------------------------*/

  STORAGE_SET: "storage:set",

  STORAGE_REMOVED: "storage:removed",

  STORAGE_CLEARED: "storage:cleared",
});

/*==============================================================
EVENT BUS
==============================================================*/

Banc360.EventBus = (function () {
  /*============================================================
      PRIVATE REGISTRY
    ============================================================*/

  const registry = new Map();

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
      NORMALIZE EVENT NAME
    ============================================================*/

  function normalizeEventName(eventName) {
    if (typeof eventName !== "string") {
      return "";
    }

    return eventName.trim();
  }

  /*============================================================
      GET LISTENERS
    ============================================================*/

  function getListeners(eventName, createIfMissing = false) {
    const normalizedName = normalizeEventName(eventName);

    if (!normalizedName) {
      return null;
    }

    if (!registry.has(normalizedName)) {
      if (!createIfMissing) {
        return null;
      }

      registry.set(normalizedName, new Set());
    }

    return registry.get(normalizedName);
  }

  /*============================================================
      ON
    ============================================================*/

  function on(eventName, callback) {
    const normalizedName = normalizeEventName(eventName);

    if (!normalizedName) {
      warn("EventBus.on requires a valid event name.");

      return function () {};
    }

    if (typeof callback !== "function") {
      warn(`EventBus.on requires a function for "${normalizedName}".`);

      return function () {};
    }

    const listeners = getListeners(normalizedName, true);

    listeners.add(callback);

    /*
        Return unsubscribe function.
    */

    return function unsubscribe() {
      off(normalizedName, callback);
    };
  }

  /*============================================================
      ONCE
    ============================================================*/

  function once(eventName, callback) {
    const normalizedName = normalizeEventName(eventName);

    if (!normalizedName) {
      warn("EventBus.once requires a valid event name.");

      return function () {};
    }

    if (typeof callback !== "function") {
      warn(`EventBus.once requires a function for "${normalizedName}".`);

      return function () {};
    }

    function onceHandler(payload, event) {
      off(normalizedName, onceHandler);

      try {
        callback(payload, event);
      } catch (error) {
        reportError(`EventBus listener error for "${normalizedName}":`, error);
      }
    }

    return on(normalizedName, onceHandler);
  }

  /*============================================================
      OFF
    ============================================================*/

  function off(eventName, callback) {
    const normalizedName = normalizeEventName(eventName);

    if (!normalizedName || typeof callback !== "function") {
      return false;
    }

    const listeners = getListeners(normalizedName, false);

    if (!listeners) {
      return false;
    }

    const removed = listeners.delete(callback);

    /*
        Remove empty event collections.
    */

    if (listeners.size === 0) {
      registry.delete(normalizedName);
    }

    return removed;
  }

  /*============================================================
      EMIT
    ============================================================*/

  function emit(eventName, payload) {
    const normalizedName = normalizeEventName(eventName);

    if (!normalizedName) {
      warn("EventBus.emit requires a valid event name.");

      return false;
    }

    const listeners = getListeners(normalizedName, false);

    /*
        An event without listeners is valid.

        It simply means no module is currently subscribed.
    */

    if (!listeners || listeners.size === 0) {
      return false;
    }

    const event = Object.freeze({
      name: normalizedName,

      payload,

      timestamp: new Date().toISOString(),
    });

    /*
        Work against a snapshot so listeners can safely
        subscribe/unsubscribe during dispatch.
    */

    const listenerSnapshot = Array.from(listeners);

    listenerSnapshot.forEach(function (callback) {
      try {
        callback(payload, event);
      } catch (error) {
        reportError(`EventBus listener error for "${normalizedName}":`, error);
      }
    });

    return true;
  }

  /*============================================================
      HAS
    ============================================================*/

  function has(eventName) {
    const normalizedName = normalizeEventName(eventName);

    if (!normalizedName) {
      return false;
    }

    const listeners = getListeners(normalizedName, false);

    return Boolean(listeners && listeners.size > 0);
  }

  /*============================================================
      GET EVENT NAMES
    ============================================================*/

  function getEventNames() {
    return Array.from(registry.keys());
  }

  /*============================================================
      GET LISTENER COUNT
    ============================================================*/

  function getListenerCount(eventName) {
    const normalizedName = normalizeEventName(eventName);

    if (!normalizedName) {
      return 0;
    }

    const listeners = getListeners(normalizedName, false);

    return listeners ? listeners.size : 0;
  }

  /*============================================================
      CLEAR EVENT
    ============================================================*/

  function clear(eventName) {
    const normalizedName = normalizeEventName(eventName);

    if (!normalizedName) {
      return false;
    }

    return registry.delete(normalizedName);
  }

  /*============================================================
      CLEAR ALL
    ============================================================*/

  function clearAll() {
    registry.clear();

    log("EventBus listener registry cleared.");

    return true;
  }

  /*============================================================
      DEBUG INFORMATION
    ============================================================*/

  function getDebugInfo() {
    const debugInfo = {};

    registry.forEach(function (listeners, eventName) {
      debugInfo[eventName] = listeners.size;
    });

    return Object.freeze(debugInfo);
  }

  /*============================================================
      PUBLIC API
    ============================================================*/

  return Object.freeze({
    on,

    once,

    off,

    emit,

    has,

    getEventNames,

    getListenerCount,

    clear,

    clearAll,

    getDebugInfo,
  });
})();

/*==============================================================
BACKWARD COMPATIBILITY
==============================================================*/

/*
    Banc360.Events was used during an earlier iteration.

    Keep it as an alias to the canonical EventBus so that
    existing code does not accidentally create a second event
    system.

    Canonical API:

        Banc360.EventBus

        Banc360.EventNames
*/

Banc360.Events = Banc360.EventBus;

/*==============================================================
INITIALIZATION MESSAGE
==============================================================*/

if (typeof Banc360.log === "function") {
  Banc360.log("Events Manager Loaded");
}
