/*==============================================================
Banca360 Enterprise Platform
Version : 0.1.0
File    : state.js
Module  : Core Application State
Purpose : Centralized reactive application state management
Author  : OpenAI

DESCRIPTION
-----------
The State Manager provides a single source of truth for
application-level state.

Responsibilities:

    • Application state
    • UI state
    • Navigation state
    • Theme state
    • Dashboard refresh state
    • Partner selection state
    • State subscriptions
    • State change notifications

The State Manager deliberately contains no business logic
and does not directly own persistence.

Persistence is delegated to Banc360.Storage.

==============================================================*/

"use strict";

/*==============================================================
NAMESPACE
==============================================================*/

window.Banc360 = window.Banc360 || {};

/*==============================================================
STATE MANAGER
==============================================================*/

Banc360.State = (function () {
  /*============================================================
      PRIVATE STATE
    ============================================================*/

  const subscribers = new Set();

  const DEFAULT_PAGE_TITLE = "Executive Dashboard";
  const DEFAULT_ROUTE = "/dashboard";

  let state = createInitialState();

  /*============================================================
      INITIAL STATE
    ============================================================*/

  function createInitialState() {
    const defaultTheme =
      Banc360.Config &&
      Banc360.Config.theme &&
      typeof Banc360.Config.theme.default === "string"
        ? Banc360.Config.theme.default
        : "light";

    return {
      /*--------------------------------------------------------
          Application
        --------------------------------------------------------*/

      app: {
        initialized: false,

        loading: false,

        error: null,
      },

      /*--------------------------------------------------------
          UI
        --------------------------------------------------------*/

      ui: {
        sidebarCollapsed: false,

        mobileMenu: false,

        pageTitle: DEFAULT_PAGE_TITLE,
      },

      /*--------------------------------------------------------
          Navigation
        --------------------------------------------------------*/

      navigation: {
        currentRoute: DEFAULT_ROUTE,

        previousRoute: null,
      },

      /*--------------------------------------------------------
          Theme
        --------------------------------------------------------*/

      theme: {
        current: defaultTheme,
      },

      /*--------------------------------------------------------
          Dashboard
        --------------------------------------------------------*/

      dashboard: {
        lastRefresh: null,

        refreshing: false,
      },

      /*--------------------------------------------------------
          Partners
        --------------------------------------------------------*/

      partners: {
        selectedPartner: null,
      },

      /*--------------------------------------------------------
          Settings
        --------------------------------------------------------*/

      settings: {
        initialized: false,
      },
    };
  }

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
    } else if (console && typeof console.warn === "function") {
      console.warn(message, ...args);
    }
  }

  function error(message, ...args) {
    if (typeof Banc360.error === "function") {
      Banc360.error(message, ...args);
    } else if (console && typeof console.error === "function") {
      console.error(message, ...args);
    }
  }

  /*============================================================
      PATH RESOLUTION
    ============================================================*/

  function getByPath(path) {
    if (!path) {
      return state;
    }

    const segments = String(path).split(".").filter(Boolean);

    let current = state;

    for (const segment of segments) {
      if (
        current === null ||
        typeof current !== "object" ||
        !(segment in current)
      ) {
        return undefined;
      }

      current = current[segment];
    }

    return current;
  }

  /*============================================================
      PATH VALIDATION
    ============================================================*/

  function normalizePath(path) {
    return String(path || "")
      .trim()
      .split(".")
      .filter(Boolean)
      .join(".");
  }

  /*============================================================
      SET BY PATH
    ============================================================*/

  function setByPath(path, value) {
    const normalizedPath = normalizePath(path);

    if (!normalizedPath) {
      warn("State.set requires a valid state path.");

      return false;
    }

    const segments = normalizedPath.split(".");

    let current = state;

    for (let index = 0; index < segments.length - 1; index++) {
      const segment = segments[index];

      if (
        !current[segment] ||
        typeof current[segment] !== "object" ||
        Array.isArray(current[segment])
      ) {
        current[segment] = {};
      }

      current = current[segment];
    }

    const finalSegment = segments[segments.length - 1];

    const previousValue = current[finalSegment];

    /*
        Avoid unnecessary notifications when the value has
        not actually changed.
    */

    if (Object.is(previousValue, value)) {
      return true;
    }

    current[finalSegment] = value;

    notify(normalizedPath, value, previousValue);

    return true;
  }

  /*============================================================
      SET MULTIPLE VALUES
    ============================================================*/

  function setMany(updates) {
    if (!updates || typeof updates !== "object") {
      warn("State.setMany requires an object.");

      return false;
    }

    Object.entries(updates).forEach(function ([path, value]) {
      setByPath(path, value);
    });

    return true;
  }

  /*============================================================
      SUBSCRIBE
    ============================================================*/

  function subscribe(callback) {
    if (typeof callback !== "function") {
      warn("State subscription requires a function.");

      return function () {};
    }

    subscribers.add(callback);

    /*
        Return an unsubscribe function.
    */

    return function unsubscribe() {
      subscribers.delete(callback);
    };
  }

  /*============================================================
      NOTIFY
    ============================================================*/

  function notify(path, value, previousValue) {
    const change = {
      path,

      value,

      previousValue,

      timestamp: new Date().toISOString(),
    };

    subscribers.forEach(function (callback) {
      try {
        callback(path, value, previousValue, change);
      } catch (subscriberError) {
        error("State subscriber error:", subscriberError);
      }
    });
  }

  /*============================================================
      CONFIG HELPERS
    ============================================================*/

  function getConfigTheme() {
    if (
      Banc360.Config &&
      Banc360.Config.theme &&
      Array.isArray(Banc360.Config.theme.supported)
    ) {
      return Banc360.Config.theme.supported;
    }

    return ["light", "dark", "auto"];
  }

  function getStorageKey(keyName, fallback) {
    if (
      Banc360.Config &&
      Banc360.Config.storage &&
      Banc360.Config.storage.keys &&
      Banc360.Config.storage.keys[keyName]
    ) {
      return Banc360.Config.storage.keys[keyName];
    }

    return fallback;
  }

  /*============================================================
      INITIALIZE
    ============================================================*/

  function initialize() {
    /*
        Restore persisted theme.
    */

    if (Banc360.Storage && typeof Banc360.Storage.get === "function") {
      const themeKey = getStorageKey("theme", "theme");

      const storedTheme = Banc360.Storage.get(themeKey);

      if (storedTheme && getConfigTheme().includes(storedTheme)) {
        state.theme.current = storedTheme;
      }

      /*
          Restore persisted sidebar state.
      */

      const sidebarKey = getStorageKey("sidebar", "sidebar");

      const storedSidebar = Banc360.Storage.get(sidebarKey);

      if (typeof storedSidebar === "boolean") {
        state.ui.sidebarCollapsed = storedSidebar;
      }
    }

    state.app.initialized = false;

    state.app.loading = false;

    state.settings.initialized = true;

    log("State Manager Initialized");
  }

  /*============================================================
      GET
    ============================================================*/

  function get(path) {
    return getByPath(path);
  }

  /*============================================================
      SET
    ============================================================*/

  function set(path, value) {
    return setByPath(path, value);
  }

  /*============================================================
      GET ENTIRE STATE
    ============================================================*/

  function getAll() {
    /*
        Return a detached snapshot rather than exposing the
        internal state object for unrestricted mutation.
    */

    try {
      return structuredClone(state);
    } catch (cloneError) {
      /*
          Compatibility fallback for older browsers.
      */

      try {
        return JSON.parse(JSON.stringify(state));
      } catch (fallbackError) {
        error("Unable to create state snapshot:", cloneError, fallbackError);

        return state;
      }
    }
  }

  /*============================================================
      SET ROUTE
    ============================================================*/

  function setRoute(route) {
    const normalizedRoute = String(route || "").trim();

    if (!normalizedRoute) {
      warn("State.setRoute requires a valid route.");

      return false;
    }

    const previousRoute = state.navigation.currentRoute;

    if (previousRoute === normalizedRoute) {
      return true;
    }

    state.navigation.previousRoute = previousRoute;

    notify(
      "navigation.previousRoute",
      previousRoute,
      state.navigation.previousRoute,
    );

    state.navigation.currentRoute = normalizedRoute;

    notify("navigation.currentRoute", normalizedRoute, previousRoute);

    return true;
  }

  /*============================================================
      GET CURRENT ROUTE
    ============================================================*/

  function getRoute() {
    return state.navigation.currentRoute;
  }

  /*============================================================
      SET PAGE TITLE
    ============================================================*/

  function setPageTitle(title) {
    const nextTitle =
      typeof title === "string" && title.trim()
        ? title.trim()
        : DEFAULT_PAGE_TITLE;

    const previousTitle = state.ui.pageTitle;

    if (previousTitle === nextTitle) {
      return true;
    }

    state.ui.pageTitle = nextTitle;

    if (typeof document !== "undefined") {
      document.title = `${nextTitle} | Banc360`;
    }

    notify("ui.pageTitle", nextTitle, previousTitle);

    return true;
  }

  /*============================================================
      SIDEBAR
    ============================================================*/

  function toggleSidebar() {
    const nextValue = !state.ui.sidebarCollapsed;

    setByPath("ui.sidebarCollapsed", nextValue);

    if (Banc360.Storage && typeof Banc360.Storage.set === "function") {
      const sidebarKey = getStorageKey("sidebar", "sidebar");

      Banc360.Storage.set(sidebarKey, nextValue);
    }

    return nextValue;
  }

  /*============================================================
      GET SIDEBAR STATE
    ============================================================*/

  function isSidebarCollapsed() {
    return state.ui.sidebarCollapsed;
  }

  /*============================================================
      MOBILE MENU
    ============================================================*/

  function setMobileMenu(isOpen) {
    return setByPath("ui.mobileMenu", Boolean(isOpen));
  }

  function toggleMobileMenu() {
    return setMobileMenu(!state.ui.mobileMenu);
  }

  function isMobileMenuOpen() {
    return state.ui.mobileMenu;
  }

  /*============================================================
      THEME
    ============================================================*/

  function getTheme() {
    return state.theme.current;
  }

  function setTheme(theme) {
    const supportedThemes = getConfigTheme();

    if (!supportedThemes.includes(theme)) {
      warn("Unsupported theme:", theme);

      return false;
    }

    const previousTheme = state.theme.current;

    if (previousTheme === theme) {
      return true;
    }

    setByPath("theme.current", theme);

    if (Banc360.Storage && typeof Banc360.Storage.set === "function") {
      const themeKey = getStorageKey("theme", "theme");

      Banc360.Storage.set(themeKey, theme);
    }

    return true;
  }

  /*============================================================
      APPLICATION INITIALIZATION STATE
    ============================================================*/

  function setInitialized(isInitialized) {
    return setByPath("app.initialized", Boolean(isInitialized));
  }

  function isInitialized() {
    return state.app.initialized;
  }

  /*============================================================
      APPLICATION ERROR
    ============================================================*/

  function setError(value) {
    return setByPath("app.error", value || null);
  }

  function getError() {
    return state.app.error;
  }

  /*============================================================
      LOADING
    ============================================================*/

  function startLoading() {
    return setByPath("app.loading", true);
  }

  function stopLoading() {
    return setByPath("app.loading", false);
  }

  function isLoading() {
    return state.app.loading;
  }

  /*============================================================
      DASHBOARD REFRESH
    ============================================================*/

  function startDashboardRefresh() {
    return setByPath("dashboard.refreshing", true);
  }

  function refreshDashboard() {
    const timestamp = new Date().toISOString();

    state.dashboard.lastRefresh = timestamp;

    notify("dashboard.lastRefresh", timestamp, null);

    state.dashboard.refreshing = false;

    notify("dashboard.refreshing", false, true);

    return timestamp;
  }

  /*============================================================
      PARTNER SELECTION
    ============================================================*/

  function setSelectedPartner(partner) {
    return setByPath("partners.selectedPartner", partner || null);
  }

  function getSelectedPartner() {
    return state.partners.selectedPartner;
  }

  /*============================================================
      RESET
    ============================================================*/

  function reset() {
    const previousState = state;

    state = createInitialState();

    notify("*", state, previousState);

    return true;
  }

  /*============================================================
      PUBLIC API
    ============================================================*/

  return Object.freeze({
    initialize,

    get,

    set,

    setMany,

    getAll,

    subscribe,

    setRoute,

    getRoute,

    setPageTitle,

    toggleSidebar,

    isSidebarCollapsed,

    setMobileMenu,

    toggleMobileMenu,

    isMobileMenuOpen,

    getTheme,

    setTheme,

    setInitialized,

    isInitialized,

    setError,

    getError,

    startLoading,

    stopLoading,

    isLoading,

    startDashboardRefresh,

    refreshDashboard,

    setSelectedPartner,

    getSelectedPartner,

    reset,
  });
})();

/*==============================================================
INITIALIZATION MESSAGE
==============================================================*/

if (typeof Banc360.log === "function") {
  Banc360.log("State Manager Loaded");
}
