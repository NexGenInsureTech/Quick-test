/*==============================================================
Banc360 Enterprise Platform
Version : 0.1.0
File    : partners.js
Module  : Partner Intelligence
Purpose : Partner portfolio and performance view
Author  : OpenAI

SPRINT
------
Sprint 1.1

RESPONSIBILITIES
----------------
This module owns the Partners application view.

It provides:

    • Partner portfolio overview
    • Partner KPI summary
    • Partner search
    • Partner status filtering
    • Partner performance table
    • Partner selection
    • Partner navigation foundation
    • Empty state handling

IMPORTANT
---------
This module currently uses local demonstration data only.

Production data ingestion will be separated into a data
repository/service layer in a later sprint.

==============================================================*/

"use strict";

/*==============================================================
NAMESPACE
==============================================================*/

window.Banc360 = window.Banc360 || {};

Banc360.ModulesRegistry = Banc360.ModulesRegistry || {};

/*==============================================================
PARTNERS MODULE
==============================================================*/

Banc360.ModulesRegistry.partners = (function () {
  /*==========================================================
      PRIVATE STATE
    ==========================================================*/

  let initialized = false;

  let currentContext = null;

  let filters = {
    search: "",

    status: "all",
  };

  /*==========================================================
      DEMONSTRATION DATA
    ==========================================================*/

  const partnerData = [
    {
      id: "IB",
      name: "Indian Bank",
      type: "Promoter Bank",
      branches: 5900,
      gwp: 1250000000,
      target: 1600000000,
      achievement: 78.1,
      growth: 14.2,
      status: "active",
    },

    {
      id: "IOB",
      name: "Indian Overseas Bank",
      type: "Promoter Bank",
      branches: 3700,
      gwp: 865000000,
      target: 1200000000,
      achievement: 72.4,
      growth: 11.6,
      status: "active",
    },

    {
      id: "KB",
      name: "Karnataka Bank",
      type: "Private Bank",
      branches: 920,
      gwp: 620000000,
      target: 890000000,
      achievement: 69.8,
      growth: 9.4,
      status: "active",
    },

    {
      id: "APGB",
      name: "Andhra Pradesh Grameen Bank",
      type: "RRB",
      branches: 1300,
      gwp: 350000000,
      target: 540000000,
      achievement: 64.5,
      growth: 18.3,
      status: "active",
    },

    {
      id: "TNGB",
      name: "Tamil Nadu Grameen Bank",
      type: "RRB",
      branches: 600,
      gwp: 285000000,
      target: 465000000,
      achievement: 61.2,
      growth: 8.7,
      status: "active",
    },

    {
      id: "OGB",
      name: "Odisha Grameen Bank",
      type: "RRB",
      branches: 750,
      gwp: 190000000,
      target: 340000000,
      achievement: 55.9,
      growth: 6.2,
      status: "watch",
    },
  ];

  /*==========================================================
      FORMATTERS
    ==========================================================*/

  function formatNumber(value) {
    return new Intl.NumberFormat(Banc360.Config.format.locale).format(value);
  }

  function formatCompactCurrency(value) {
    const crore = value / 10000000;

    if (Math.abs(crore) >= 100) {
      return `₹${crore.toFixed(0)} Cr`;
    }

    return `₹${crore.toFixed(1)} Cr`;
  }

  function formatPercentage(value) {
    return `${Number(value).toFixed(1)}%`;
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
      FILTER DATA
    ==========================================================*/

  function getFilteredPartners() {
    const search = filters.search.trim().toLowerCase();

    return partnerData.filter((partner) => {
      const matchesSearch =
        !search ||
        partner.name.toLowerCase().includes(search) ||
        partner.type.toLowerCase().includes(search);

      const matchesStatus =
        filters.status === "all" || partner.status === filters.status;

      return matchesSearch && matchesStatus;
    });
  }

  /*==========================================================
      KPI CALCULATIONS
    ==========================================================*/

  function calculateSummary() {
    const totalGwp = partnerData.reduce((sum, partner) => sum + partner.gwp, 0);

    const totalTarget = partnerData.reduce(
      (sum, partner) => sum + partner.target,
      0,
    );

    const activePartners = partnerData.filter(
      (partner) => partner.status === "active",
    ).length;

    const averageAchievement =
      totalTarget > 0 ? (totalGwp / totalTarget) * 100 : 0;

    const averageGrowth =
      partnerData.length > 0
        ? partnerData.reduce((sum, partner) => sum + partner.growth, 0) /
          partnerData.length
        : 0;

    return {
      totalGwp,

      totalTarget,

      activePartners,

      totalPartners: partnerData.length,

      averageAchievement,

      averageGrowth,
    };
  }

  /*==========================================================
      KPI CARD
    ==========================================================*/

  function renderKpi(label, value, subtitle) {
    return `

            <article class="kpi-card">

                <div class="kpi-card-label">

                    ${escapeHtml(label)}

                </div>

                <div class="kpi-card-value">

                    ${escapeHtml(value)}

                </div>

                <div class="kpi-card-subtitle">

                    ${escapeHtml(subtitle)}

                </div>

            </article>

        `;
  }

  /*==========================================================
      SUMMARY
    ==========================================================*/

  function renderSummary() {
    const summary = calculateSummary();

    return `

            <section
                class="dashboard-kpis"
                aria-label="Partner portfolio summary">

                ${renderKpi(
                  "Partner GWP",
                  formatCompactCurrency(summary.totalGwp),
                  "Portfolio premium",
                )}

                ${renderKpi(
                  "Portfolio Target",
                  formatCompactCurrency(summary.totalTarget),
                  "Partner targets",
                )}

                ${renderKpi(
                  "Active Partners",
                  formatNumber(summary.activePartners),
                  `of ${formatNumber(summary.totalPartners)} partners`,
                )}

                ${renderKpi(
                  "Average Achievement",
                  formatPercentage(summary.averageAchievement),
                  `Avg. growth ${formatPercentage(summary.averageGrowth)}`,
                )}

            </section>

        `;
  }

  /*==========================================================
      PARTNER STATUS
    ==========================================================*/

  function renderStatus(status) {
    const labels = {
      active: "Active",

      watch: "Watch",

      inactive: "Inactive",
    };

    return `

            <span
                class="badge badge-${escapeHtml(
                  status === "active"
                    ? "success"
                    : status === "watch"
                      ? "warning"
                      : "secondary",
                )}">

                ${escapeHtml(labels[status] || status)}

            </span>

        `;
  }

  /*==========================================================
      PARTNER TABLE
    ==========================================================*/

  function renderTable() {
    const partners = getFilteredPartners();

    if (partners.length === 0) {
      return `

                <div class="empty-state">

                    <div
                        class="empty-state-icon"
                        aria-hidden="true">
                        🔍
                    </div>

                    <h3 class="empty-state-title">

                        No Partners Found

                    </h3>

                    <p class="empty-state-text">

                        Try changing your search
                        or status filter.

                    </p>

                </div>

            `;
    }

    return `

            <div class="table-container">

                <table
                    class="data-table"
                    aria-label="Partner performance">

                    <thead>

                        <tr>

                            <th scope="col">
                                Partner
                            </th>

                            <th scope="col">
                                Type
                            </th>

                            <th
                                scope="col"
                                class="text-right">

                                Branches

                            </th>

                            <th
                                scope="col"
                                class="text-right">

                                GWP

                            </th>

                            <th
                                scope="col"
                                class="text-right">

                                Target

                            </th>

                            <th
                                scope="col"
                                class="text-right">

                                Achievement

                            </th>

                            <th
                                scope="col"
                                class="text-right">

                                Growth

                            </th>

                            <th scope="col">
                                Status
                            </th>

                            <th
                                scope="col"
                                aria-label="Actions">

                            </th>

                        </tr>

                    </thead>

                    <tbody>

                        ${partners
                          .map(
                            (partner) => `

                                <tr
                                    data-partner-id="${escapeHtml(partner.id)}">

                                    <td>

                                        <div
                                            class="font-semibold">

                                            ${escapeHtml(partner.name)}

                                        </div>

                                    </td>

                                    <td>

                                        <span class="caption">

                                            ${escapeHtml(partner.type)}

                                        </span>

                                    </td>

                                    <td
                                        class="text-right">

                                        ${formatNumber(partner.branches)}

                                    </td>

                                    <td
                                        class="text-right font-semibold">

                                        ${formatCompactCurrency(partner.gwp)}

                                    </td>

                                    <td
                                        class="text-right">

                                        ${formatCompactCurrency(partner.target)}

                                    </td>

                                    <td
                                        class="text-right">

                                        ${formatPercentage(partner.achievement)}

                                    </td>

                                    <td
                                        class="text-right">

                                        <span
                                            class="${
                                              partner.growth >= 0
                                                ? "text-success"
                                                : "text-danger"
                                            }">

                                            ${partner.growth >= 0 ? "▲" : "▼"}

                                            ${formatPercentage(
                                              Math.abs(partner.growth),
                                            )}

                                        </span>

                                    </td>

                                    <td>

                                        ${renderStatus(partner.status)}

                                    </td>

                                    <td>

                                        <button
                                            type="button"
                                            class="btn btn-sm btn-outline"
                                            data-partner-action="view"
                                            data-partner-id="${escapeHtml(
                                              partner.id,
                                            )}">

                                            View

                                        </button>

                                    </td>

                                </tr>

                            `,
                          )
                          .join("")}

                    </tbody>

                </table>

            </div>

        `;
  }

  /*==========================================================
      PAGE HTML
    ==========================================================*/

  function renderPage() {
    return `

            <div class="dashboard-page partners-page">

                <!--================================================
                HEADER
                =================================================-->

                <header class="dashboard-header">

                    <div class="dashboard-title">

                        <div class="overline">
                            Partner Intelligence
                        </div>

                        <h1>
                            Partners
                        </h1>

                        <p>
                            Monitor partner portfolio,
                            productivity and performance.
                        </p>

                    </div>

                    <div class="dashboard-actions">

                        <button
                            type="button"
                            class="btn btn-outline"
                            data-partner-action="refresh">

                            Refresh

                        </button>

                    </div>

                </header>

                <!--================================================
                SUMMARY
                =================================================-->

                ${renderSummary()}

                <!--================================================
                PARTNER TABLE
                =================================================-->

                <section class="card">

                    <div class="card-header">

                        <div>

                            <h3>
                                Partner Portfolio
                            </h3>

                            <p class="caption">
                                Search and monitor partner
                                performance.
                            </p>

                        </div>

                    </div>

                    <!--============================================
                    FILTERS
                    =============================================-->

                    <div class="form-row">

                        <div class="form-group">

                            <label
                                for="partnerSearch">

                                Search Partner

                            </label>

                            <input
                                id="partnerSearch"
                                type="search"
                                class="form-control"
                                placeholder="Search by partner or type..."
                                value="${escapeHtml(filters.search)}"
                                data-partner-filter="search">

                        </div>

                        <div class="form-group">

                            <label
                                for="partnerStatus">

                                Status

                            </label>

                            <select
                                id="partnerStatus"
                                class="form-control"
                                data-partner-filter="status">

                                <option
                                    value="all"
                                    ${
                                      filters.status === "all" ? "selected" : ""
                                    }>

                                    All Partners

                                </option>

                                <option
                                    value="active"
                                    ${
                                      filters.status === "active"
                                        ? "selected"
                                        : ""
                                    }>

                                    Active

                                </option>

                                <option
                                    value="watch"
                                    ${
                                      filters.status === "watch"
                                        ? "selected"
                                        : ""
                                    }>

                                    Watch

                                </option>

                            </select>

                        </div>

                        <div
                            class="form-group form-group-actions">

                            <button
                                type="button"
                                class="btn btn-outline"
                                data-partner-action="clear-filters">

                                Clear Filters

                            </button>

                        </div>

                    </div>

                    <!--============================================
                    TABLE
                    =============================================-->

                    <div
                        id="partnerTable"
                        class="mt-5">

                        ${renderTable()}

                    </div>

                </section>

            </div>

        `;
  }

  /*==========================================================
      RE-RENDER TABLE
    ==========================================================*/

  function refreshTable() {
    if (!currentContext?.view) {
      return;
    }

    const table = currentContext.view.querySelector("#partnerTable");

    if (!table) {
      return;
    }

    table.innerHTML = renderTable();
  }

  /*==========================================================
      FILTER HANDLER
    ==========================================================*/

  function handleFilterChange(event) {
    const element = event.target.closest("[data-partner-filter]");

    if (!element) {
      return;
    }

    const filter = element.dataset.partnerFilter;

    filters[filter] = element.value;

    refreshTable();
  }

  /*==========================================================
      PARTNER SELECTION
    ==========================================================*/

  function selectPartner(partnerId) {
    const partner = partnerData.find((item) => item.id === partnerId);

    if (!partner) {
      Banc360.warn("Partner not found:", partnerId);

      return;
    }

    Banc360.State.set("partners.selectedPartner", partner);

    Banc360.EventBus.emit(
      Banc360.EventNames.PARTNER_SELECTED,

      partner,
    );

    Banc360.log("Partner selected:", partner.name);
  }

  /*==========================================================
      ACTION HANDLER
    ==========================================================*/

  function handleAction(event) {
    const element = event.target.closest("[data-partner-action]");

    if (!element) {
      return;
    }

    const action = element.dataset.partnerAction;

    switch (action) {
      case "view":
        selectPartner(element.dataset.partnerId);

        /*
                Partner detail routing will be introduced
                after the core Partner Detail module exists.
                */

        break;

      case "refresh":
        refresh();

        break;

      case "clear-filters":
        filters = {
          search: "",

          status: "all",
        };

        rerender();

        break;

      default:
        Banc360.warn("Unknown partner action:", action);
    }
  }

  /*==========================================================
      EVENT BINDING
    ==========================================================*/

  function bindEvents(view) {
    if (!view) {
      return;
    }

    view.addEventListener("input", handleFilterChange);

    view.addEventListener("change", handleFilterChange);

    view.addEventListener("click", handleAction);
  }

  /*==========================================================
      RENDER
    ==========================================================*/

  async function render(context) {
    currentContext = context;

    const view = context?.view;

    if (!view) {
      Banc360.error("Partners render target not found.");

      return;
    }

    view.innerHTML = renderPage();

    bindEvents(view);

    initialized = true;

    return null;
  }

  /*==========================================================
      RERENDER
    ==========================================================*/

  function rerender() {
    if (!currentContext?.view) {
      return;
    }

    currentContext.view.innerHTML = renderPage();

    bindEvents(currentContext.view);
  }

  /*==========================================================
      REFRESH
    ==========================================================*/

  function refresh() {
    Banc360.EventBus.emit(
      Banc360.EventNames.PARTNER_UPDATED,

      {
        type: "refresh",

        timestamp: new Date().toISOString(),
      },
    );

    rerender();

    Banc360.log("Partner portfolio refreshed.");
  }

  /*==========================================================
      RESET
    ==========================================================*/

  function resetFilters() {
    filters = {
      search: "",

      status: "all",
    };

    rerender();
  }

  /*==========================================================
      DESTROY
    ==========================================================*/

  function destroy() {
    initialized = false;

    currentContext = null;
  }

  /*==========================================================
      PUBLIC API
    ==========================================================*/

  return Object.freeze({
    render,

    refresh,

    resetFilters,

    destroy,

    isInitialized: function () {
      return initialized;
    },
  });
})();

/*==============================================================
MODULE LOADED
==============================================================*/

Banc360.log("Partners Module Loaded");
