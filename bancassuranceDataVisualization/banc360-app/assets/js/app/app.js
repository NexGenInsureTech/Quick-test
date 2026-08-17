/*==============================================================
Banc360 Enterprise Platform
Version : 0.1.0
File    : app.js
Module  : Application Controller
Purpose : Integrates core services, UI shell and application
          routes.
Author  : OpenAI

RESPONSIBILITIES
----------------
app.js is the application integration layer.

It coordinates:

    Config
       ↓
    State
       ↓
    EventBus
       ↓
    Router
       ↓
    UI Shell
       ↓
    Feature Modules

IMPORTANT
---------
app.js does NOT contain business logic.

Business functionality belongs inside modules.

==============================================================*/

"use strict";

/*==============================================================
NAMESPACE
==============================================================*/

window.Banc360 = window.Banc360 || {};

/*==============================================================
APPLICATION CONTROLLER
==============================================================*/

Banc360.App = (function () {
  /*==========================================================
      PRIVATE STATE
    ==========================================================*/

  let initialized = false;

  let eventUnsubscribers = [];

  /*==========================================================
      DOM REFERENCES
    ==========================================================*/

  const elements = {
    app: null,

    sidebar: null,

    sidebarToggle: null,

    mobileMenuToggle: null,

    mobileOverlay: null,

    view: null,

    themeToggle: null,

    navigation: null,

    pageTitle: null,

    breadcrumb: null,

    loading: null,
  };

  /*==========================================================
      CACHE DOM
    ==========================================================*/

  function cacheDOM() {
    elements.app = document.getElementById("app");

    elements.sidebar = document.getElementById("sidebar");

    elements.sidebarToggle = document.querySelector(
      "[data-action='toggle-sidebar']",
    );

    elements.mobileOverlay = document.querySelector("[data-mobile-overlay]");

    elements.mobileMenuToggle = document.querySelector(
      "[data-action='toggle-mobile-menu']",
    );

    elements.view = document.getElementById("view");

    elements.themeToggle = document.querySelector(
      "[data-action='toggle-theme']",
    );

    elements.navigation = document.querySelector("[data-navigation]");

    elements.pageTitle = document.querySelector("[data-page-title]");

    elements.breadcrumb = document.querySelector("[data-breadcrumb]");

    elements.loading = document.querySelector("[data-loading]");
  }

  /*==========================================================
      REGISTER ROUTES
    ==========================================================*/

  function registerRoutes() {
    /*
        Dashboard

        The actual dashboard view will be supplied by
        dashboard.js when that module is generated.
        */

    Banc360.Router.register(
      "/dashboard",

      {
        title: "Executive Dashboard",

        module: Banc360.Modules.DASHBOARD,

        render: getModuleRenderer("dashboard"),
      },
    );

    /*------------------------------------------------------
          Partners
        ------------------------------------------------------*/

    Banc360.Router.register(
      "/partners",

      {
        title: "Partners",

        module: Banc360.Modules.PARTNERS,

        render: getModuleRenderer("partners"),
      },
    );

    /*------------------------------------------------------
          Reports
        ------------------------------------------------------*/

    Banc360.Router.register(
      "/reports",

      {
        title: "Reports",

        module: Banc360.Modules.REPORTS,

        render: getModuleRenderer("reports"),
      },
    );

    /*------------------------------------------------------
          Analytics
        ------------------------------------------------------*/

    Banc360.Router.register(
      "/analytics",

      {
        title: "Analytics",

        module: Banc360.Modules.ANALYTICS,

        render: getModuleRenderer("analytics"),
      },
    );

    /*------------------------------------------------------
          Settings
        ------------------------------------------------------*/

    Banc360.Router.register(
      "/settings",

      {
        title: "Settings",

        module: Banc360.Modules.SETTINGS,

        render: getModuleRenderer("settings"),
      },
    );
  }

  /*==========================================================
      MODULE RENDERER RESOLVER
    ==========================================================*/

  function getModuleRenderer(moduleName) {
    return async function (context) {
      /*
            Modules are deliberately resolved at render time.

            This prevents app.js from knowing the internal
            implementation of every feature module.
            */

      const module = Banc360.ModulesRegistry?.[moduleName];

      if (module && typeof module.render === "function") {
        return module.render(context);
      }

      /*
            During Sprint 1.1 some modules do not exist yet.

            Returning nothing allows router.js to display its
            "module not implemented" state.
            */

      return null;
    };
  }

  /*==========================================================
      SIDEBAR
    ==========================================================*/

  function initializeSidebar() {
    if (!elements.sidebar) {
      return;
    }

    applySidebarState(Banc360.State.get("ui.sidebarCollapsed"));

    if (elements.sidebarToggle) {
      elements.sidebarToggle.addEventListener("click", handleSidebarToggle);
    }
  }

  /*==========================================================
    SIDEBAR / MOBILE NAVIGATION TOGGLE
==========================================================*/

  function handleSidebarToggle() {
    toggleSidebar();
  }

  /*==========================================================
      TOGGLE SIDEBAR
    ==========================================================*/

  function toggleSidebar() {
    const collapsed = Banc360.State.toggleSidebar();

    applySidebarState(collapsed);

    Banc360.EventBus.emit(
      Banc360.EventNames.SIDEBAR_TOGGLED,

      {
        collapsed,
      },
    );
  }

  /*==========================================================
      APPLY SIDEBAR STATE
    ==========================================================*/

  function applySidebarState(collapsed) {
    if (!elements.app) {
      return;
    }

    elements.app.classList.toggle("sidebar-collapsed", Boolean(collapsed));

    if (elements.sidebar) {
      elements.sidebar.setAttribute(
        "data-collapsed",
        String(Boolean(collapsed)),
      );
    }

    if (elements.sidebarToggle) {
      elements.sidebarToggle.setAttribute("aria-expanded", String(!collapsed));

      elements.sidebarToggle.setAttribute(
        "aria-label",
        collapsed ? "Expand navigation" : "Collapse navigation",
      );

      elements.sidebarToggle.setAttribute(
        "title",
        collapsed ? "Expand navigation" : "Collapse navigation",
      );
    }
  }

  /*==========================================================
      THEME
    ==========================================================*/

  function initializeTheme() {
    const theme = Banc360.State.getTheme();

    applyTheme(theme, false);

    if (elements.themeToggle) {
      elements.themeToggle.addEventListener("click", cycleTheme);
    }
  }

  /*==========================================================
      APPLY THEME
    ==========================================================*/

  function applyTheme(theme, persist = true) {
    const supported = Banc360.Config.theme.supported;

    if (!supported.includes(theme)) {
      theme = Banc360.Config.theme.default;
    }

    document.body.classList.remove("theme-light", "theme-dark", "theme-auto");

    document.body.classList.add(`theme-${theme}`);

    document.documentElement.dataset.theme = theme;

    if (persist) {
      Banc360.State.setTheme(theme);
    }

    updateThemeToggle(theme);
  }

  /*==========================================================
      CYCLE THEME
    ==========================================================*/

  function cycleTheme() {
    const supported = Banc360.Config.theme.supported;

    const current = Banc360.State.getTheme();

    const index = supported.indexOf(current);

    const next = supported[(index + 1) % supported.length];

    applyTheme(next);

    Banc360.EventBus.emit(
      Banc360.EventNames.THEME_CHANGED,

      next,
    );
  }

  /*==========================================================
      THEME TOGGLE UI
    ==========================================================*/

  function updateThemeToggle(theme) {
    if (!elements.themeToggle) {
      return;
    }

    const labels = {
      light: "Switch to dark theme",

      dark: "Switch to automatic theme",

      auto: "Switch to light theme",
    };

    const icons = {
      light: "☀",

      dark: "☾",

      auto: "◐",
    };

    elements.themeToggle.setAttribute("aria-label", labels[theme]);

    elements.themeToggle.setAttribute("title", labels[theme]);

    const icon = elements.themeToggle.querySelector("[data-theme-icon]");

    if (icon) {
      icon.textContent = icons[theme];
    }
  }

  /*==========================================================
      NAVIGATION
    ==========================================================*/

  function initializeNavigation() {
    if (!elements.navigation) {
      return;
    }

    elements.navigation.addEventListener("click", handleNavigationClick);
  }

  /*==========================================================
      NAVIGATION CLICK
    ==========================================================*/

  function handleNavigationClick(event) {
    const link = event.target.closest("[data-route]");

    if (!link || !elements.navigation.contains(link)) {
      return;
    }

    event.preventDefault();

    const route = link.dataset.route;

    if (!route) {
      return;
    }

    Banc360.Router.navigate(route);
  }

  /*==========================================================
      UPDATE NAVIGATION
    ==========================================================*/

  function updateNavigation(route) {
    if (!elements.navigation) {
      return;
    }

    const links = elements.navigation.querySelectorAll("[data-route]");

    links.forEach((link) => {
      const linkRoute = Banc360.Router.normalizePath(link.dataset.route);

      const currentRoute = Banc360.Router.normalizePath(route);

      const active = linkRoute === currentRoute;

      link.classList.toggle("active", active);

      if (active) {
        link.setAttribute("aria-current", "page");
      } else {
        link.removeAttribute("aria-current");
      }
    });
  }

  /*==========================================================
      PAGE TITLE
    ==========================================================*/

  function updatePageTitle(data) {
    if (!elements.pageTitle) {
      return;
    }

    elements.pageTitle.textContent = data.title || "Banc360";
  }

  /*==========================================================
      BREADCRUMB
    ==========================================================*/

  function updateBreadcrumb(data) {
    if (!elements.breadcrumb) {
      return;
    }

    const title = data.title || "Dashboard";

    elements.breadcrumb.innerHTML = `

            <span
                class="breadcrumb-item">

                <a
                    href="#/dashboard"
                    data-route="/dashboard">

                    Banc360

                </a>

            </span>

            <span
                class="breadcrumb-separator"
                aria-hidden="true">

                /

            </span>

            <span
                class="breadcrumb-item">

                ${escapeHtml(title)}

            </span>

        `;
  }

  /*==========================================================
      LOADING STATE
    ==========================================================*/

  function initializeLoading() {
    updateLoading(Banc360.State.get("app.loading"));
  }

  function updateLoading(loading) {
    if (elements.loading) {
      elements.loading.hidden = !loading;

      elements.loading.setAttribute("aria-hidden", String(!loading));
    }

    if (elements.app) {
      elements.app.classList.toggle("is-loading", Boolean(loading));
    }
  }

  /*==========================================================
      EVENT SUBSCRIPTIONS
    ==========================================================*/

  function initializeEvents() {
    /*
        Route changes
        */

    eventUnsubscribers.push(
      Banc360.EventBus.on(
        Banc360.EventNames.ROUTE_CHANGED,

        function (data) {
          updateNavigation(data.current);

          updateBreadcrumb({
            title: Banc360.State.get("ui.pageTitle"),
          });
        },
      ),
    );

    /*
        Page changes
        */

    eventUnsubscribers.push(
      Banc360.EventBus.on(
        Banc360.EventNames.PAGE_CHANGED,

        function (data) {
          updatePageTitle(data);

          updateBreadcrumb(data);
        },
      ),
    );

    /*
        Sidebar
        */

    eventUnsubscribers.push(
      Banc360.EventBus.on(
        Banc360.EventNames.SIDEBAR_TOGGLED,

        function (data) {
          applySidebarState(data.collapsed);
        },
      ),
    );

    /*
        Theme
        */

    eventUnsubscribers.push(
      Banc360.EventBus.on(
        Banc360.EventNames.THEME_CHANGED,

        function (theme) {
          applyTheme(theme, false);
        },
      ),
    );

    /*
        Application state loading.
        */

    eventUnsubscribers.push(
      Banc360.State.subscribe(function (path, value) {
        if (path === "app.loading") {
          updateLoading(value);
        }
      }),
    );
  }

  /*==========================================================
      GLOBAL KEYBOARD HANDLERS
    ==========================================================*/

  function initializeKeyboard() {
    document.addEventListener("keydown", handleKeyboard);
  }

  function handleKeyboard(event) {
    /*
        Escape closes mobile navigation.
        */

    if (event.key === "Escape") {
      closeMobileNavigation();
    }
  }

  /*==========================================================
      MOBILE NAVIGATION
    ==========================================================*/

  function initializeMobileNavigation() {
    /*
      Mobile hamburger is initialized separately through
      data-action="toggle-mobile-menu".
  */

    if (elements.mobileMenuToggle) {
      elements.mobileMenuToggle.addEventListener(
        "click",
        toggleMobileNavigation,
      );
    }

    /*
      Navigation links close the drawer after navigation.
  */

    if (elements.navigation) {
      elements.navigation.addEventListener("click", function (event) {
        const link = event.target.closest("[data-route]");

        if (link) {
          closeMobileNavigation();
        }
      });
    }

    /*
      Clicking the overlay closes the mobile drawer.
  */

    if (elements.mobileOverlay) {
      elements.mobileOverlay.addEventListener("click", closeMobileNavigation);
    }
  }

  function toggleMobileNavigation() {
    if (!elements.app) {
      return;
    }

    const isOpen = elements.app.classList.toggle("mobile-menu-open");

    Banc360.State.set("ui.mobileMenu", isOpen);

    if (elements.mobileOverlay) {
      elements.mobileOverlay.setAttribute("aria-hidden", String(!isOpen));
    }

    if (elements.sidebarToggle) {
      elements.sidebarToggle.setAttribute("aria-expanded", String(isOpen));

      elements.sidebarToggle.setAttribute(
        "aria-label",
        isOpen ? "Close navigation" : "Open navigation",
      );

      elements.sidebarToggle.setAttribute(
        "title",
        isOpen ? "Close navigation" : "Open navigation",
      );
    }

    if (
      Banc360.EventBus &&
      Banc360.EventNames &&
      Banc360.EventNames.MOBILE_MENU_TOGGLED
    ) {
      Banc360.EventBus.emit(Banc360.EventNames.MOBILE_MENU_TOGGLED, {
        open: isOpen,
      });
    }
  }

  function closeMobileNavigation() {
    if (!elements.app) {
      return;
    }

    elements.app.classList.remove("mobile-menu-open");

    Banc360.State.set("ui.mobileMenu", false);

    if (elements.mobileMenuToggle) {
      elements.mobileMenuToggle.setAttribute("aria-expanded", "false");

      elements.mobileMenuToggle.setAttribute("aria-label", "Open navigation");

      elements.mobileMenuToggle.setAttribute("title", "Open navigation");
    }

    if (elements.mobileOverlay) {
      elements.mobileOverlay.setAttribute("aria-hidden", "true");
    }
  }

  /*==========================================================
      ACCESSIBILITY
    ==========================================================*/

  function initializeAccessibility() {
    if (elements.sidebar && !elements.sidebar.hasAttribute("aria-label")) {
      elements.sidebar.setAttribute("aria-label", "Primary navigation");
    }
  }

  /*==========================================================
      REGISTER GLOBAL ROUTE LINKS
    ==========================================================*/

  function initializeRouteLinks() {
    document.addEventListener("click", function (event) {
      const link = event.target.closest("[data-route]");

      if (!link) {
        return;
      }

      const route = link.dataset.route;

      if (!route) {
        return;
      }

      /*
                Navigation containers handle their own clicks.

                Prevent double handling.
                */

      if (elements.navigation && elements.navigation.contains(link)) {
        return;
      }

      event.preventDefault();

      Banc360.Router.navigate(route);
    });
  }

  /*==========================================================
      CLEANUP
    ==========================================================*/

  function destroy() {
    eventUnsubscribers.forEach(function (unsubscribe) {
      if (typeof unsubscribe === "function") {
        unsubscribe();
      }
    });

    eventUnsubscribers = [];

    initialized = false;
  }

  /*==========================================================
      INITIALIZE
    ==========================================================*/

  async function initialize() {
    if (initialized) {
      Banc360.log("Application already initialized.");

      return;
    }

    Banc360.log("Initializing Banc360 Application...");

    /*
        Cache DOM first.
        */

    cacheDOM();

    /*
        Register application routes.

        Routes are registered BEFORE Router.init().
        */

    registerRoutes();

    /*
        Initialize UI.
        */

    initializeSidebar();

    initializeTheme();

    initializeNavigation();

    initializeLoading();

    initializeEvents();

    initializeKeyboard();

    initializeMobileNavigation();

    initializeAccessibility();

    initializeRouteLinks();

    /*
        Mark application as initialized.
        */

    initialized = true;

    Banc360.log("Banc360 Application Initialized.");
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

  /*==============================================================
MOBILE NAVIGATION
==============================================================*/

  /*==========================================================
      PUBLIC API
    ==========================================================*/

  return Object.freeze({
    initialize,

    destroy,

    registerRoutes,

    toggleSidebar,

    applyTheme,

    cycleTheme,

    closeMobileNavigation,
  });
})();

/*==============================================================
MODULE REGISTRY
==============================================================*/

/*
Feature modules register themselves here.

Example:

Banc360.ModulesRegistry.dashboard = {
    render(context) {
        ...
    }
};

This keeps app.js independent of the internal implementation
of each feature.
*/

Banc360.ModulesRegistry = Banc360.ModulesRegistry || {};

/*==============================================================
MODULE LOADED
==============================================================*/

Banc360.log("Application Controller Loaded");
