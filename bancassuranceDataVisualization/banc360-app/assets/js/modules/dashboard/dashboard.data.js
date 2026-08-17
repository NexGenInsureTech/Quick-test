/*==============================================================
Banc360 Enterprise Platform
Version : 0.1.0
File    : dashboard.data.js
Module  : Executive Dashboard
Purpose : Dashboard data provider
==============================================================*/

"use strict";

window.Banc360 = window.Banc360 || {};

Banc360.Dashboard = Banc360.Dashboard || {};

Banc360.Dashboard.Data = (function () {
  /*============================================================
      MOCK DATA
    ============================================================*/

  const mockDashboardData = Object.freeze({
    period: {
      financialYear: "FY 2026-27",
      asOf: "2026-08-15",
    },

    businessPerformance: {
      gwp: 425,
      target: 600,
      previousPeriodGwp: 375,
    },

    partners: [
      {
        id: "indian-bank",
        name: "Indian Bank",
        gwp: 150,
        target: 210,
        previousPeriodGwp: 128,
        totalBranches: 5800,
        activeBranches: 3920,
      },

      {
        id: "indian-overseas-bank",
        name: "Indian Overseas Bank",
        gwp: 105,
        target: 150,
        previousPeriodGwp: 91,
        totalBranches: 3200,
        activeBranches: 2140,
      },

      {
        id: "karnataka-bank",
        name: "Karnataka Bank",
        gwp: 75,
        target: 105,
        previousPeriodGwp: 67,
        totalBranches: 950,
        activeBranches: 610,
      },

      {
        id: "other-partners",
        name: "Other Partners",
        gwp: 95,
        target: 135,
        previousPeriodGwp: 89,
        totalBranches: 3050,
        activeBranches: 1840,
      },
    ],

    distribution: {
      totalBranches: 13000,
      activeBranches: 8510,
      activeRMs: 500,
      previousPeriodActiveBranches: 7600,
      previousPeriodActiveRMs: 470,
    },

    managementSignals: {
      opportunities: [],
      risks: [],
      exceptions: [],
      priorityActions: [],
    },
  });

  /*============================================================
      GET DASHBOARD DATA
    ============================================================*/

  async function getDashboardData() {
    /*
        This is deliberately asynchronous.

        Today it returns local mock data.

        Later this contract can call:
            • API
            • backend service
            • uploaded data adapter
            • another approved data source

        dashboard.js will not need to change merely because
        the underlying data source changes.
    */

    return mockDashboardData;
  }

  /*============================================================
      PUBLIC API
    ============================================================*/

  return Object.freeze({
    getDashboardData,
  });
})();
