/*==============================================================
Banca360 Enterprise Platform
Version : 0.1.0
File    : router.js
Module  : Core Router
Purpose : Hash-based client-side application routing
Author  : OpenAI

DESCRIPTION
-----------
Provides the central routing mechanism for Banc360.

Responsibilities:

    • Route registration
    • Hash-based navigation
    • Route resolution
    • View rendering
    • Route parameters
    • Query parameters
    • Fallback / 404 handling
    • Navigation events
    • Page title management
    • Route guards
    • Route lifecycle hooks
    • Navigation state coordination

The Router deliberately contains no business logic.

Business functionality belongs inside feature modules.

==============================================================*/

"use strict";

/*==============================================================
NAMESPACE
==============================================================*/

window.Banc360 = window.Banc360 || {};

/*==============================================================
ROUTER
==============================================================*/

Banc360.Router = (function () {
  /*============================================================
      PRIVATE STATE
    ============================================================*/

  const routes = new Map();

  let currentRoute = null;

  let previousRoute = null;

  let initialized = false;

  /*
      Incremented for every route rendering attempt.

      This prevents a slower asynchronous render from an older
      navigation from overwriting a newer route.
  */

  let navigationSequence = 0;

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
    } else if (
      typeof console !== "undefined" &&
      typeof console.warn === "function"
    ) {
      console.warn(message, ...args);
    }
  }

  function reportError(message, ...args) {
    if (typeof Banc360.error === "function") {
      Banc360.error(message, ...args);
    } else if (
      typeof console !== "undefined" &&
      typeof console.error === "function"
    ) {
      console.error(message, ...args);
    }
  }

  /*============================================================
      ROUTE NORMALIZATION
    ============================================================*/

  function normalizePath(path) {
    if (!path) {
      return "/dashboard";
    }

    let normalized = String(path).trim();

    /*
        Accept:

            /dashboard
            #/dashboard
            dashboard
            #dashboard
        */

    if (normalized.startsWith("#")) {
      normalized = normalized.substring(1);
    }

    if (!normalized.startsWith("/")) {
      normalized = `/${normalized}`;
    }

    /*
        Remove trailing slash except root.
        */

    if (normalized.length > 1 && normalized.endsWith("/")) {
      normalized = normalized.slice(0, -1);
    }

    return normalized;
  }

  /*============================================================
      HASH CREATION
    ============================================================*/

  function createHash(path) {
    return `#${normalizePath(path)}`;
  }

  /*============================================================
      CURRENT HASH
    ============================================================*/

  function getHash() {
    return window.location.hash || "";
  }

  /*============================================================
      CURRENT PATH
    ============================================================*/

  function getPath() {
    const hash = getHash();

    if (!hash) {
      return normalizePath(Banc360.Config?.routes?.default || "/dashboard");
    }

    return normalizePath(hash);
  }

  /*============================================================
      QUERY STRING PARSING
    ============================================================*/

  function parseQuery(queryString) {
    const params = {};

    if (!queryString) {
      return params;
    }

    const query = queryString.startsWith("?")
      ? queryString.substring(1)
      : queryString;

    const searchParams = new URLSearchParams(query);

    searchParams.forEach(function (value, key) {
      params[key] = value;
    });

    return params;
  }

  /*============================================================
      PATH PARSING
    ============================================================*/

  function parsePath(path) {
    const normalized = normalizePath(path);

    const queryIndex = normalized.indexOf("?");

    const pathname =
      queryIndex === -1 ? normalized : normalized.substring(0, queryIndex);

    const queryString =
      queryIndex === -1 ? "" : normalized.substring(queryIndex);

    const segments = pathname.split("/").filter(Boolean);

    return {
      path: pathname,

      queryString,

      query: parseQuery(queryString),

      segments,
    };
  }

  /*============================================================
      ROUTE MATCHING
    ============================================================*/

  function matchRoute(path) {
    const parsed = parsePath(path);

    /*
        First attempt exact match.
        */

    if (routes.has(parsed.path)) {
      return {
        definition: routes.get(parsed.path),

        params: {},

        path: parsed.path,

        query: parsed.query,
      };
    }

    /*
        Second attempt dynamic route matching.

        Example:

            /partners/:id

        matches:

            /partners/123
        */

    const pathSegments = parsed.path.split("/").filter(Boolean);

    for (const [pattern, definition] of routes.entries()) {
      const patternSegments = pattern.split("/").filter(Boolean);

      if (patternSegments.length !== pathSegments.length) {
        continue;
      }

      const params = {};

      let matched = true;

      for (let index = 0; index < patternSegments.length; index++) {
        const patternSegment = patternSegments[index];

        const pathSegment = pathSegments[index];

        if (patternSegment.startsWith(":")) {
          const parameterName = patternSegment.substring(1);

          try {
            params[parameterName] = decodeURIComponent(pathSegment);
          } catch (error) {
            reportError("Unable to decode route parameter:", error);

            matched = false;

            break;
          }

          continue;
        }

        if (patternSegment !== pathSegment) {
          matched = false;

          break;
        }
      }

      if (matched) {
        return {
          definition,

          params,

          path: parsed.path,

          query: parsed.query,
        };
      }
    }

    return null;
  }

  /*============================================================
      REGISTER ROUTE
    ============================================================*/

  function register(path, definition) {
    const normalized = normalizePath(path);

    if (typeof definition === "function") {
      definition = {
        render: definition,
      };
    }

    if (!definition || typeof definition !== "object") {
      reportError("Invalid route definition:", path);

      return false;
    }

    routes.set(normalized, {
      path: normalized,

      title: definition.title || "Banc360",

      module: definition.module || null,

      permission: definition.permission || null,

      guard: definition.guard || null,

      render: definition.render || null,

      onEnter: definition.onEnter || null,

      onLeave: definition.onLeave || null,
    });

    return true;
  }

  /*============================================================
      REGISTER MULTIPLE ROUTES
    ============================================================*/

  function registerMany(routeDefinitions) {
    if (!routeDefinitions || typeof routeDefinitions !== "object") {
      return false;
    }

    Object.entries(routeDefinitions).forEach(function ([path, definition]) {
      register(path, definition);
    });

    return true;
  }

  /*============================================================
      UNREGISTER
    ============================================================*/

  function unregister(path) {
    return routes.delete(normalizePath(path));
  }

  /*============================================================
      CHECK ROUTE
    ============================================================*/

  function hasRoute(path) {
    return routes.has(normalizePath(path));
  }

  /*============================================================
      GET ROUTE
    ============================================================*/

  function getRoute(path) {
    return routes.get(normalizePath(path)) || null;
  }

  /*============================================================
      LIST ROUTES
    ============================================================*/

  function listRoutes() {
    return [...routes.values()];
  }

  /*============================================================
      CURRENT ROUTE
    ============================================================*/

  function getCurrentRoute() {
    return currentRoute;
  }

  /*============================================================
      PREVIOUS ROUTE
    ============================================================*/

  function getPreviousRoute() {
    return previousRoute;
  }

  /*============================================================
      NAVIGATE
    ============================================================*/

  function navigate(path, options = {}) {
    const normalized = normalizePath(path);

    const hash = createHash(normalized);

    /*
        Avoid unnecessary navigation.

        Force navigation is available when a route needs to
        re-render even though the hash has not changed.
        */

    if (window.location.hash === hash && !options.force) {
      return handleRouteChange();
    }

    /*
        Replace the current browser history state.
        */

    if (options.replace) {
      const url =
        `${window.location.pathname}` + `${window.location.search}` + hash;

      window.history.replaceState(null, "", url);

      return handleRouteChange();
    }

    /*
        Normal hash navigation.

        The browser's hashchange event will invoke the route
        handler.
        */

    window.location.hash = normalized;

    return true;
  }

  /*============================================================
      ROUTE GUARD
    ============================================================*/

  async function canNavigate(route) {
    if (!route) {
      return false;
    }

    if (typeof route.guard !== "function") {
      return true;
    }

    try {
      return Boolean(await route.guard());
    } catch (error) {
      reportError("Route guard failed:", error);

      return false;
    }
  }

  /*============================================================
      ROUTE ERROR EVENT
    ============================================================*/

  function emitRouteError(matchedRoute, error) {
    if (
      Banc360.EventBus &&
      Banc360.EventNames &&
      Banc360.EventNames.APP_ERROR
    ) {
      Banc360.EventBus.emit(Banc360.EventNames.APP_ERROR, {
        type: "route-render",

        route: matchedRoute?.path || null,

        error,
      });
    }
  }

  /*============================================================
      RENDER ROUTE
    ============================================================*/

  async function renderRoute(matchedRoute) {
    const view = document.getElementById("view");

    if (!view) {
      reportError('Router could not find "#view".');

      return false;
    }

    const definition = matchedRoute.definition;

    /*
        Each rendering attempt gets a unique sequence.

        If another navigation starts while this route is
        rendering, this render becomes stale.
        */

    const renderSequence = ++navigationSequence;

    /*
        Execute route guard.
        */

    const allowed = await canNavigate(definition);

    /*
        A newer navigation may have started while the guard
        was executing.
        */

    if (renderSequence !== navigationSequence) {
      return false;
    }

    if (!allowed) {
      const defaultRoute = Banc360.Config?.routes?.default || "/dashboard";

      if (normalizePath(defaultRoute) !== matchedRoute.path) {
        navigate(defaultRoute, {
          replace: true,
        });
      }

      return false;
    }

    /*
        Execute previous route cleanup.
        */

    if (
      currentRoute &&
      currentRoute.definition &&
      typeof currentRoute.definition.onLeave === "function"
    ) {
      try {
        await currentRoute.definition.onLeave();
      } catch (error) {
        reportError("Route onLeave error:", error);
      }
    }

    /*
        A newer navigation may have started while onLeave
        was executing.
        */

    if (renderSequence !== navigationSequence) {
      return false;
    }

    /*
        Update route references.
        */

    previousRoute = currentRoute;

    currentRoute = matchedRoute;

    /*
        Synchronize application state.
        */

    if (Banc360.State && typeof Banc360.State.setRoute === "function") {
      Banc360.State.setRoute(matchedRoute.path);
    }

    /*
        Update page title.
        */

    const title = definition.title || "Banc360";

    if (Banc360.State && typeof Banc360.State.setPageTitle === "function") {
      Banc360.State.setPageTitle(title);
    } else {
      document.title = `${title} | Banc360`;
    }

    /*
        Start loading state.
        */

    if (Banc360.State && typeof Banc360.State.startLoading === "function") {
      Banc360.State.startLoading();
    }

    /*
        Render the page.
        */

    try {
      view.innerHTML = "";

      if (typeof definition.render === "function") {
        const result = await definition.render({
          path: matchedRoute.path,

          params: matchedRoute.params,

          query: matchedRoute.query,

          view,

          router: Banc360.Router,
        });

        /*
            If a newer route has started rendering while this
            module was resolving, do not overwrite the newer
            view.
            */

        if (renderSequence !== navigationSequence) {
          return false;
        }

        /*
            Allow render functions to return HTML.

            If the render function returns a string and has
            not already populated the view, inject it.
            */

        if (typeof result === "string" && view.innerHTML.trim() === "") {
          view.innerHTML = result;
        }
      } else {
        renderNotImplemented(view, definition);
      }
    } catch (error) {
      /*
          Ignore stale route errors.

          A newer route is already responsible for the view.
          */

      if (renderSequence !== navigationSequence) {
        return false;
      }

      reportError("Route rendering failed:", error);

      renderError(view, error);

      emitRouteError(matchedRoute, error);
    } finally {
      /*
          Only the active route may stop the global loading
          indicator.
          */

      if (renderSequence === navigationSequence) {
        if (Banc360.State && typeof Banc360.State.stopLoading === "function") {
          Banc360.State.stopLoading();
        }
      }
    }

    /*
        A newer navigation may have started while rendering.
        */

    if (renderSequence !== navigationSequence) {
      return false;
    }

    /*
        Execute route entry hook.
        */

    if (typeof definition.onEnter === "function") {
      try {
        await definition.onEnter(matchedRoute);
      } catch (error) {
        reportError("Route onEnter error:", error);
      }
    }

    /*
        Publish navigation events.
        */

    if (Banc360.EventBus && Banc360.EventNames) {
      Banc360.EventBus.emit(Banc360.EventNames.ROUTE_CHANGED, {
        current: matchedRoute.path,

        previous: previousRoute?.path || null,

        params: matchedRoute.params,

        query: matchedRoute.query,
      });

      Banc360.EventBus.emit(Banc360.EventNames.PAGE_CHANGED, {
        path: matchedRoute.path,

        title,
      });
    }

    return true;
  }

  /*============================================================
      ROUTE CHANGE HANDLER
    ============================================================*/

  async function handleRouteChange() {
    const path = getPath();

    const matched = matchRoute(path);

    if (!matched) {
      renderNotFound();

      return false;
    }

    try {
      return await renderRoute(matched);
    } catch (error) {
      reportError("Unhandled route change error:", error);

      emitRouteError(matched, error);

      return false;
    }
  }

  /*============================================================
      404 PAGE
    ============================================================*/

  function renderNotFound() {
    const view = document.getElementById("view");

    if (!view) {
      return;
    }

    view.innerHTML = `
      <section class="empty-state">

        <div
          class="empty-state-icon"
          aria-hidden="true">
          🔍
        </div>

        <h2 class="empty-state-title">
          Page Not Found
        </h2>

        <p class="empty-state-text">
          The page you are looking for
          does not exist or is no longer
          available.
        </p>

        <button
          type="button"
          class="btn btn-primary"
          data-route="/dashboard">
          Return to Dashboard
        </button>

      </section>
    `;

    const button = view.querySelector("[data-route]");

    if (button) {
      button.addEventListener("click", function () {
        navigate(button.dataset.route);
      });
    }

    document.title = "Page Not Found | Banc360";
  }

  /*============================================================
      NOT IMPLEMENTED PAGE
    ============================================================*/

  function renderNotImplemented(view, definition) {
    view.innerHTML = `
      <section class="empty-state">

        <div
          class="empty-state-icon"
          aria-hidden="true">
          🚧
        </div>

        <h2 class="empty-state-title">
          ${escapeHtml(definition.title || "Module")}
        </h2>

        <p class="empty-state-text">
          This module has been registered
          but its view has not yet been
          implemented.
        </p>

      </section>
    `;
  }

  /*============================================================
      ERROR PAGE
    ============================================================*/

  function renderError(view, error) {
    const message = error?.message || "An unexpected error occurred.";

    view.innerHTML = `
      <section
        class="empty-state"
        role="alert">

        <div
          class="empty-state-icon"
          aria-hidden="true">
          ⚠️
        </div>

        <h2 class="empty-state-title">
          Something Went Wrong
        </h2>

        <p class="empty-state-text">
          ${escapeHtml(message)}
        </p>

        <button
          type="button"
          class="btn btn-primary"
          data-route="/dashboard">
          Return to Dashboard
        </button>

      </section>
    `;

    const button = view.querySelector("[data-route]");

    if (button) {
      button.addEventListener("click", function () {
        navigate(button.dataset.route);
      });
    }
  }

  /*============================================================
      HTML ESCAPING
    ============================================================*/

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  /*============================================================
      INITIALIZATION
    ============================================================*/

  function init() {
    if (initialized) {
      return;
    }

    window.addEventListener("hashchange", handleRouteChange);

    /*
        Register the default fallback route if it hasn't
        already been registered by app.js.
        */

    if (!hasRoute("/dashboard")) {
      register("/dashboard", {
        title: "Executive Dashboard",

        module: "dashboard",
      });
    }

    initialized = true;

    /*
        Resolve the initial URL.
        */

    if (!window.location.hash) {
      navigate(Banc360.Config?.routes?.default || "/dashboard", {
        replace: true,
      });
    } else {
      handleRouteChange();
    }

    log("Router Initialized");
  }

  /*============================================================
      DESTROY
    ============================================================*/

  function destroy() {
    /*
        Invalidate any currently running render.
        */

    navigationSequence++;

    window.removeEventListener("hashchange", handleRouteChange);

    currentRoute = null;

    previousRoute = null;

    initialized = false;
  }

  /*============================================================
      PUBLIC API
    ============================================================*/

  return Object.freeze({
    init,

    destroy,

    register,

    registerMany,

    unregister,

    hasRoute,

    getRoute,

    listRoutes,

    getCurrentRoute,

    getPreviousRoute,

    navigate,

    getPath,

    getHash,

    normalizePath,

    parsePath,

    matchRoute,

    handleRouteChange,
  });
})();

/*==============================================================
INITIALIZATION NOTICE
==============================================================*/

if (typeof Banc360.log === "function") {
  Banc360.log("Router Module Loaded");
}
