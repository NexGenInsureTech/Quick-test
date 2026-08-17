/*==============================================================
Banc360 Enterprise Platform
Version : 0.1.0
File    : dashboard.config.js
Module  : Executive Dashboard
Purpose : Dashboard configuration and presentation contracts
==============================================================*/

"use strict";

window.Banc360 = window.Banc360 || {};

Banc360.Dashboard = Banc360.Dashboard || {};

Banc360.Dashboard.Config = Object.freeze({
  MODULE_NAME: "dashboard",

  MODULE_TITLE: "Executive Dashboard",

  SECTIONS: Object.freeze({
    BUSINESS_PERFORMANCE: "business-performance",
    PARTNER_PERFORMANCE: "partner-performance",
    DISTRIBUTION_INTELLIGENCE: "distribution-intelligence",
    MANAGEMENT_SIGNALS: "management-signals",
  }),

  KPI_KEYS: Object.freeze({
    GWP: "gwp",
    TARGET: "target",
    ACHIEVEMENT: "achievement",
    GROWTH: "growth",
    TARGET_GAP: "targetGap",
    RUN_RATE: "runRate",
  }),

  FORMATS: Object.freeze({
    CURRENCY_INR_CRORE: "currency-inr-crore",
    PERCENTAGE: "percentage",
    NUMBER: "number",
  }),
});
