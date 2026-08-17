/*==============================================================
Banc360 Enterprise Platform
Version : 0.1.0
File    : bootstrap.js
Module  : Application Bootstrap
Purpose : Controlled startup and dependency initialization
Author  : OpenAI

DESCRIPTION
-----------
Bootstrap is responsible for starting Banc360 in a predictable
order.

Startup sequence:

    Browser
       ↓
    DOM Ready
       ↓
    Validate Core
       ↓
    Initialize State
       ↓
    Initialize Application
       ↓
    Register Routes
       ↓
    Initialize Router
       ↓
    Emit APP_READY

IMPORTANT
---------
bootstrap.js does NOT contain page/business logic.

It coordinates startup only.

==============================================================*/

"use strict";

/*==============================================================
NAMESPACE
==============================================================*/

window.Banc360 = window.Banc360 || {};

/*==============================================================
BOOTSTRAP
==============================================================*/

Banc360.Bootstrap = (function () {
  /*==========================================================
      PRIVATE STATE
    ==========================================================*/

  let started = false;

  let startPromise = null;

  /*==========================================================
      REQUIRED CORE MODULES
    ==========================================================*/

  const requiredModules = [
    "Config",

    "Storage",

    "State",

    "EventBus",

    "EventNames",

    "Router",
  ];

  /*==========================================================
      DEPENDENCY VALIDATION
    ==========================================================*/

  function validateDependencies() {
    const missing = [];

    requiredModules.forEach((moduleName) => {
      if (typeof Banc360[moduleName] === "undefined") {
        missing.push(moduleName);
      }
    });

    if (missing.length > 0) {
      throw new Error(
        "Banc360 bootstrap failed. " + "Missing modules: " + missing.join(", "),
      );
    }

    return true;
  }

  /*==========================================================
      DOM VALIDATION
    ==========================================================*/

  function validateDOM() {
    const requiredElements = [
      {
        id: "app",
        description: "Application root",
      },

      {
        id: "view",
        description: "Application view container",
      },

      {
        id: "sidebar",
        description: "Application sidebar",
      },
    ];

    const missing = [];

    requiredElements.forEach((element) => {
      if (!document.getElementById(element.id)) {
        missing.push(`${element.description} (#${element.id})`);
      }
    });

    if (missing.length > 0) {
      throw new Error(
        "Required DOM elements are missing: " + missing.join(", "),
      );
    }

    return true;
  }

  /*==========================================================
      STATE INITIALIZATION
    ==========================================================*/

  function initializeState() {
    /*
        state.js currently initializes itself when loaded.

        This defensive call allows the State module to evolve
        later without requiring changes to Bootstrap.
        */

    if (typeof Banc360.State.initialize === "function") {
      Banc360.State.initialize();
    }
  }

  /*==========================================================
      APPLICATION INITIALIZATION
    ==========================================================*/

  async function initializeApplication() {
    if (typeof Banc360.App === "undefined") {
      throw new Error(
        "Banc360.App is not available. " + "Load app.js before bootstrap.js.",
      );
    }

    if (typeof Banc360.App.initialize !== "function") {
      throw new Error("Banc360.App.initialize() " + "is not available.");
    }

    await Banc360.App.initialize();
  }

  /*==========================================================
      ROUTER INITIALIZATION
    ==========================================================*/

  function initializeRouter() {
    if (!Banc360.Router || typeof Banc360.Router.init !== "function") {
      throw new Error("Banc360.Router.init() is not available.");
    }

    /*
        Router is deliberately initialized LAST.

        By this point app.js should have registered all
        application routes.

        This prevents the router from rendering the default
        route before the real Dashboard view is registered.
        */

    Banc360.Router.init();
  }

  /*==========================================================
      READY EVENT
    ==========================================================*/

  function emitReady() {
    if (Banc360.EventBus && Banc360.EventNames) {
      Banc360.EventBus.emit(
        Banc360.EventNames.APP_READY,

        {
          version: Banc360.Config.app.version,

          environment: Banc360.Config.app.environment,

          timestamp: new Date().toISOString(),
        },
      );
    }
  }

  /*==========================================================
      ERROR HANDLING
    ==========================================================*/

  function handleStartupError(error) {
    Banc360.error("Banc360 startup failed:", error);

    /*
        Notify the rest of the application if the EventBus
        is available.
        */

    if (Banc360.EventBus && Banc360.EventNames) {
      Banc360.EventBus.emit(
        Banc360.EventNames.APP_ERROR,

        {
          type: "bootstrap",

          error,
        },
      );
    }

    renderStartupError(error);

    throw error;
  }

  /*==========================================================
      STARTUP ERROR UI
    ==========================================================*/

  function renderStartupError(error) {
    const view = document.getElementById("view");

    if (!view) {
      return;
    }

    const message =
      error?.message || "An unexpected application error occurred.";

    /*
        Do not expose stack traces or implementation details
        to end users.

        Detailed information remains in the browser console
        for development diagnostics.
        */

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
                    Banc360 Could Not Start
                </h2>

                <p class="empty-state-text">
                    The application encountered a problem
                    while starting. Please refresh the page
                    and try again.
                </p>

                ${
                  Banc360.Config?.features?.debugMode
                    ? `
                            <p
                                class="empty-state-text"
                                style="
                                    margin-top:16px;
                                    font-size:.8rem;
                                ">
                                ${escapeHtml(message)}
                            </p>
                          `
                    : ""
                }

                <button
                    type="button"
                    class="btn btn-primary"
                    id="bootstrapRetryButton">

                    Retry

                </button>

            </section>

        `;

    const retryButton = document.getElementById("bootstrapRetryButton");

    if (retryButton) {
      retryButton.addEventListener("click", () => {
        window.location.reload();
      });
    }
  }

  /*==========================================================
      HTML ESCAPING
    ==========================================================*/

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")

      .replaceAll("<", "&lt;")

      .replaceAll(">", "&gt;")

      .replaceAll('"', "&quot;")

      .replaceAll("'", "&#039;");
  }

  /*==========================================================
      START
    ==========================================================*/

  async function start() {
    /*
        Prevent duplicate initialization.
        */

    if (started) {
      return startPromise;
    }

    started = true;

    startPromise = (async () => {
      try {
        /*----------------------------------------------
                  1. Validate core dependencies
                ----------------------------------------------*/

        validateDependencies();

        Banc360.log("Bootstrap: core dependencies validated.");

        /*----------------------------------------------
                  2. Validate application DOM
                ----------------------------------------------*/

        validateDOM();

        Banc360.log("Bootstrap: application DOM validated.");

        /*----------------------------------------------
                  3. Initialize state
                ----------------------------------------------*/

        initializeState();

        Banc360.log("Bootstrap: state initialized.");

        /*----------------------------------------------
                  4. Initialize application
                ----------------------------------------------*/

        await initializeApplication();

        Banc360.log("Bootstrap: application initialized.");

        /*----------------------------------------------
                  5. Initialize router
                ----------------------------------------------*/

        initializeRouter();

        Banc360.log("Bootstrap: router initialized.");

        /*----------------------------------------------
                  6. Mark application initialized
                ----------------------------------------------*/

        if (Banc360.State && typeof Banc360.State.set === "function") {
          Banc360.State.set("app.initialized", true);
        }

        /*----------------------------------------------
                  7. Notify application
                ----------------------------------------------*/

        if (Banc360.EventBus && Banc360.EventNames) {
          Banc360.EventBus.emit(
            Banc360.EventNames.APP_INITIALIZED,

            {
              timestamp: new Date().toISOString(),
            },
          );
        }

        /*----------------------------------------------
                  8. Emit ready
                ----------------------------------------------*/

        emitReady();

        Banc360.log("Banc360 startup completed successfully.");

        return true;
      } catch (error) {
        started = false;

        handleStartupError(error);

        return false;
      }
    })();

    return startPromise;
  }

  /*==========================================================
      DOM READY
    ==========================================================*/

  function startWhenReady() {
    if (document.readyState === "loading") {
      document.addEventListener(
        "DOMContentLoaded",

        () => {
          start();
        },

        {
          once: true,
        },
      );

      return;
    }

    start();
  }

  /*==========================================================
      PUBLIC API
    ==========================================================*/

  return Object.freeze({
    start,

    startWhenReady,

    validateDependencies,

    validateDOM,
  });
})();

/*==============================================================
BOOTSTRAP START
==============================================================*/

Banc360.Bootstrap.startWhenReady();
