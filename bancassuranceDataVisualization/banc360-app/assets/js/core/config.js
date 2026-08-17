/*==============================================================
Banc360 Enterprise Platform
Version : 0.1.0
File    : config.js
Module  : Core Configuration
Purpose : Global application configuration and constants
Author  : OpenAI

IMPORTANT
---------
This file contains application configuration only.

Event implementation belongs to events.js.
Application state belongs to state.js.
Browser storage belongs to storage.js.

Do not freeze the Banc360 namespace itself. Other core
modules must be able to register themselves on it.
==============================================================*/

"use strict";

/*==============================================================
GLOBAL NAMESPACE
==============================================================*/

window.Banc360 = window.Banc360 || {};

/*==============================================================
APPLICATION CONFIGURATION
==============================================================*/

Banc360.Config = Object.freeze({
  /*==========================================================
      APPLICATION
    ==========================================================*/

  app: {
    id: "banc360",

    name: "Banc360",

    fullName: "Banc360 Enterprise Bancassurance Platform",

    version: "0.1.0",

    codename: "Foundation",

    environment: "development",

    build: "2026.08",

    company: "Universal Sompo General Insurance",

    copyright: "© 2026 Banc360. All Rights Reserved.",
  },

  /*==========================================================
      ROUTES
    ==========================================================*/

  routes: {
    default: "#/dashboard",

    dashboard: "#/dashboard",

    partners: "#/partners",

    reports: "#/reports",

    analytics: "#/analytics",

    settings: "#/settings",
  },

  /*==========================================================
      LAYOUT
    ==========================================================*/

  layout: {
    sidebarCollapsed: false,

    sidebarWidth: 270,

    sidebarCollapsedWidth: 78,

    mobileBreakpoint: 768,

    tabletBreakpoint: 1024,
  },

  /*==========================================================
      THEME
    ==========================================================*/

  theme: {
    default: "light",

    supported: ["light", "dark", "auto"],

    storageKey: "banc360.theme",
  },

  /*==========================================================
      STORAGE
    ==========================================================*/

  storage: {
    prefix: "banc360",

    keys: {
      theme: "theme",

      user: "user",

      settings: "settings",

      filters: "filters",

      sidebar: "sidebar",

      dashboard: "dashboard",

      session: "session",
    },
  },

  /*==========================================================
      DATE & NUMBER FORMATS
    ==========================================================*/

  format: {
    locale: "en-IN",

    currency: "INR",

    date: "dd-MMM-yyyy",

    decimalPlaces: 2,
  },

  /*==========================================================
      DASHBOARD
    ==========================================================*/

  dashboard: {
    refreshInterval: 300000,

    animationDuration: 300,

    maxNotifications: 20,
  },

  /*==========================================================
      TABLES
    ==========================================================*/

  tables: {
    defaultPageSize: 25,

    pageSizes: [10, 25, 50, 100],
  },

  /*==========================================================
      API
    ==========================================================*/

  api: {
    enabled: false,

    timeout: 30000,

    retryCount: 2,

    retryDelay: 1000,

    baseUrl: "",

    endpoints: {
      dashboard: "/dashboard",

      partners: "/partners",

      reports: "/reports",

      analytics: "/analytics",
    },
  },

  /*==========================================================
      FEATURE FLAGS
    ==========================================================*/

  features: {
    authentication: false,

    notifications: true,

    exportExcel: true,

    exportPDF: true,

    darkMode: true,

    analytics: true,

    auditTrail: false,

    offlineMode: true,

    debugMode: true,
  },

  /*==========================================================
      LOGGING
    ==========================================================*/

  logging: {
    enabled: true,

    level: "info",
  },
});

/*==============================================================
APPLICATION MODULES
==============================================================*/

Banc360.Modules = Object.freeze({
  DASHBOARD: "dashboard",

  PARTNERS: "partners",

  REPORTS: "reports",

  ANALYTICS: "analytics",

  SETTINGS: "settings",
});

/*==============================================================
APPLICATION STATUS
==============================================================*/

Banc360.Status = Object.freeze({
  SUCCESS: "success",

  INFO: "info",

  WARNING: "warning",

  ERROR: "error",
});

/*==============================================================
UTILITY METHODS
==============================================================*/

Banc360.getVersion = function () {
  return Banc360.Config.app.version;
};

Banc360.getEnvironment = function () {
  return Banc360.Config.app.environment;
};

Banc360.isDevelopment = function () {
  return Banc360.Config.app.environment === "development";
};

Banc360.isProduction = function () {
  return Banc360.Config.app.environment === "production";
};

Banc360.log = function (...args) {
  if (Banc360.Config.logging.enabled && Banc360.Config.features.debugMode) {
    console.log("[Banc360]", ...args);
  }
};

Banc360.warn = function (...args) {
  if (Banc360.Config.logging.enabled) {
    console.warn("[Banc360]", ...args);
  }
};

Banc360.error = function (...args) {
  console.error("[Banc360]", ...args);
};

/*==============================================================
INITIALIZATION
==============================================================*/

Banc360.log(
  `${Banc360.Config.app.fullName} ` + `${Banc360.Config.app.version} loaded`,
);

/*
IMPORTANT:
Do NOT use Object.freeze(Banc360) here.

The Banc360 namespace is intentionally extensible because
future modules will register:

Banc360.Storage
Banc360.State
Banc360.EventBus
Banc360.Router
Banc360.UI
etc.
*/
