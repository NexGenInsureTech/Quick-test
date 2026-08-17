/*==============================================================
Banc360 Enterprise Platform
Version : 0.1.0
File    : dashboard.js
Module  : Executive Dashboard
Purpose : Dashboard feature module
==============================================================*/

"use strict";

/*==============================================================
NAMESPACE
==============================================================*/

window.Banc360 = window.Banc360 || {};

Banc360.ModulesRegistry = Banc360.ModulesRegistry || {};
Banc360.Dashboard = Banc360.Dashboard || {};

/*==============================================================
DASHBOARD MODULE
==============================================================*/

Banc360.ModulesRegistry.dashboard = (function () {
  /*============================================================
      PRIVATE STATE
    ============================================================*/

  let initialized = false;

  let currentContext = null;

  let currentData = null;

  let currentViewModel = null;

  /*============================================================
      MODULE CONSTANTS
    ============================================================*/

  const MODULE_NAME = "dashboard";

  const MODULE_TITLE = "Executive Dashboard";

  /*============================================================
      DEPENDENCY VALIDATION
    ============================================================*/

  function validateDependencies() {
    if (!Banc360.Dashboard.Config) {
      throw new Error("Dashboard configuration is not available.");
    }

    if (!Banc360.Dashboard.Data) {
      throw new Error("Dashboard data provider is not available.");
    }

    if (typeof Banc360.Dashboard.Data.getDashboardData !== "function") {
      throw new Error(
        "Dashboard data provider does not expose getDashboardData().",
      );
    }

    return true;
  }

  /*============================================================
      CONTEXT VALIDATION
    ============================================================*/

  function validateContext(context) {
    if (!context || typeof context !== "object") {
      throw new Error("Dashboard render context is required.");
    }

    if (!context.view) {
      throw new Error("Dashboard render context requires a view element.");
    }

    return true;
  }

  /*============================================================
      DATA VALIDATION
    ============================================================*/

  function validateDashboardData(data) {
    if (!data || typeof data !== "object") {
      throw new Error("Dashboard data provider returned invalid data.");
    }

    if (!data.period) {
      throw new Error("Dashboard data is missing period information.");
    }

    if (!data.businessPerformance) {
      throw new Error("Dashboard data is missing business performance data.");
    }

    if (!Array.isArray(data.partners)) {
      throw new Error("Dashboard data is missing partner data.");
    }

    if (!data.distribution) {
      throw new Error("Dashboard data is missing distribution data.");
    }

    if (!data.managementSignals) {
      throw new Error("Dashboard data is missing management signal data.");
    }

    return true;
  }

  /*============================================================
      NUMBER HELPERS
    ============================================================*/

  function toNumber(value) {
    const number = Number(value);

    return Number.isFinite(number) ? number : 0;
  }

  /*============================================================
      PERCENTAGE CALCULATION
    ============================================================*/

  function calculatePercentage(numerator, denominator) {
    const base = toNumber(denominator);

    if (base === 0) {
      return 0;
    }

    return (toNumber(numerator) / base) * 100;
  }

  /*============================================================
      GROWTH CALCULATION
    ============================================================*/

  function calculateGrowth(currentValue, previousValue) {
    const previous = toNumber(previousValue);

    if (previous === 0) {
      return 0;
    }

    return ((toNumber(currentValue) - previous) / previous) * 100;
  }

  /*============================================================
      TARGET GAP CALCULATION
    ============================================================*/

  function calculateTargetGap(gwp, target) {
    return Math.max(toNumber(target) - toNumber(gwp), 0);
  }

  /*============================================================
      FINANCIAL YEAR START
    ============================================================*/

  function getFinancialYearStart(asOfDate) {
    const date = new Date(asOfDate);

    if (Number.isNaN(date.getTime())) {
      return null;
    }

    const financialYearStartYear =
      date.getMonth() >= 3 ? date.getFullYear() : date.getFullYear() - 1;

    return new Date(financialYearStartYear, 3, 1);
  }

  /*============================================================
      COMPLETED FINANCIAL YEAR MONTHS
    ============================================================*/

  function getCompletedFinancialYearMonths(asOfDate) {
    const date = new Date(asOfDate);

    const start = getFinancialYearStart(asOfDate);

    if (Number.isNaN(date.getTime()) || !start) {
      return 0;
    }

    const months =
      (date.getFullYear() - start.getFullYear()) * 12 +
      (date.getMonth() - start.getMonth());

    return Math.max(months, 0);
  }

  /*============================================================
      RUN-RATE CALCULATION
    ============================================================*/

  function calculateRunRate(gwp, asOfDate) {
    const completedMonths = getCompletedFinancialYearMonths(asOfDate);

    if (completedMonths === 0) {
      return 0;
    }

    return (toNumber(gwp) / completedMonths) * 12;
  }

  /*============================================================
      BUILD BUSINESS PERFORMANCE VIEW MODEL
    ============================================================*/

  function buildBusinessPerformanceViewModel(businessPerformance, period) {
    const gwp = toNumber(businessPerformance.gwp);

    const target = toNumber(businessPerformance.target);

    const previousPeriodGwp = toNumber(businessPerformance.previousPeriodGwp);

    const achievement = calculatePercentage(gwp, target);

    const growth = calculateGrowth(gwp, previousPeriodGwp);

    const targetGap = calculateTargetGap(gwp, target);

    const runRate = calculateRunRate(gwp, period.asOf);

    const projectedSurplus = runRate - target;

    const runRateVsTarget = calculatePercentage(runRate, target);

    return Object.freeze({
      gwp,

      target,

      previousPeriodGwp,

      achievement,

      growth,

      targetGap,

      runRate,

      projectedSurplus,

      runRateVsTarget,
    });
  }

  /*============================================================
      PARTNER PERFORMANCE VIEW MODEL
    ============================================================*/

  /*============================================================
      PARTNER PERFORMANCE VIEW MODEL
    ============================================================*/

  function buildPartnerPerformanceViewModel(partners, totalGwp) {
    const partnerPerformance = partners.map((partner) => {
      const gwp = toNumber(partner.gwp);

      const target = toNumber(partner.target);

      const previousPeriodGwp = toNumber(partner.previousPeriodGwp);

      const totalBranches = toNumber(partner.totalBranches);

      const activeBranches = toNumber(partner.activeBranches);

      const achievement = calculatePercentage(gwp, target);

      const growth = calculateGrowth(gwp, previousPeriodGwp);

      const contribution = calculatePercentage(gwp, totalGwp);

      const activation = calculatePercentage(activeBranches, totalBranches);

      const targetGap = calculateTargetGap(gwp, target);

      return {
        id: partner.id,

        name: partner.name,

        gwp,

        target,

        previousPeriodGwp,

        achievement,

        growth,

        contribution,

        totalBranches,

        activeBranches,

        activation,

        targetGap,
      };
    });

    /*
        Rank is based on GWP contribution.

        We calculate the rank independently from the
        displayed order so that Step 5C does not introduce
        sorting controls or change the user's current table
        ordering.
    */

    const rankedPartners = [...partnerPerformance].sort(
      (a, b) => b.gwp - a.gwp,
    );

    const rankMap = new Map();

    rankedPartners.forEach((partner, index) => {
      rankMap.set(partner.id, index + 1);
    });

    return partnerPerformance.map((partner) => {
      return Object.freeze({
        ...partner,

        rank: rankMap.get(partner.id),
      });
    });
  }

  /*============================================================
      DISTRIBUTION INTELLIGENCE VIEW MODEL
    ============================================================*/

  function buildDistributionViewModel(distribution, businessPerformance) {
    const totalBranches = toNumber(distribution.totalBranches);

    const activeBranches = toNumber(distribution.activeBranches);

    const gwp = toNumber(businessPerformance.gwp);

    const inactiveBranches = Math.max(totalBranches - activeBranches, 0);

    const activation = calculatePercentage(activeBranches, totalBranches);

    const gwpPerActiveBranch = activeBranches > 0 ? gwp / activeBranches : 0;

    const gwpPerTotalBranch = totalBranches > 0 ? gwp / totalBranches : 0;

    /*
        Simple opportunity indicator:

        We use current GWP per active branch as the
        reference productivity level.

        This does NOT represent a forecast.

        It answers only:

        "What would current average active-branch
         productivity imply if inactive branches
         achieved the same productivity?"

        This is deliberately conservative from an
        architectural standpoint. A future opportunity
        engine can incorporate partner, geography,
        product and productivity variables.
    */

    const inactiveBranchOpportunity = inactiveBranches * gwpPerActiveBranch;

    return Object.freeze({
      totalBranches,

      activeBranches,

      inactiveBranches,

      activation,

      gwp,

      gwpPerActiveBranch,

      gwpPerTotalBranch,

      inactiveBranchOpportunity,
    });
  }

  /*============================================================
      DASHBOARD VIEW MODEL
    ============================================================*/

  function buildViewModel(data) {
    const businessPerformance = buildBusinessPerformanceViewModel(
      data.businessPerformance,
      data.period,
    );

    const partnerPerformance = buildPartnerPerformanceViewModel(
      data.partners,
      businessPerformance.gwp,
    );

    const distribution = buildDistributionViewModel(
      data.distribution,
      businessPerformance,
    );

    return Object.freeze({
      period: data.period,

      businessPerformance,

      partnerPerformance,

      distribution,

      managementSignals: data.managementSignals,
    });
  }
  /*============================================================
      CURRENCY FORMATTER
    ============================================================*/

  function formatCurrencyCrore(value) {
    return `₹${toNumber(value).toLocaleString("en-IN", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    })} Cr`;
  }

  /*============================================================
      PERCENTAGE FORMATTER
    ============================================================*/

  function formatPercentage(value) {
    return `${toNumber(value).toFixed(1)}%`;
  }

  /*============================================================
      GROWTH DIRECTION
    ============================================================*/

  function getGrowthDirection(value) {
    if (value > 0) {
      return "up";
    }

    if (value < 0) {
      return "down";
    }

    return "flat";
  }

  /*============================================================
      KPI DEFINITIONS
    ============================================================*/

  function buildKpis(viewModel) {
    const performance = viewModel.businessPerformance;

    const growthDirection = getGrowthDirection(performance.growth);

    return [
      {
        key: Banc360.Dashboard.Config.KPI_KEYS.GWP,

        label: "GWP",

        value: formatCurrencyCrore(performance.gwp),

        rawValue: performance.gwp,

        format: Banc360.Dashboard.Config.FORMATS.CURRENCY_INR_CRORE,

        context: "Current business",
      },

      {
        key: Banc360.Dashboard.Config.KPI_KEYS.TARGET,

        label: "Target",

        value: formatCurrencyCrore(performance.target),

        rawValue: performance.target,

        format: Banc360.Dashboard.Config.FORMATS.CURRENCY_INR_CRORE,

        context: "Annual target",
      },

      {
        key: Banc360.Dashboard.Config.KPI_KEYS.ACHIEVEMENT,

        label: "Achievement",

        value: formatPercentage(performance.achievement),

        rawValue: performance.achievement,

        format: Banc360.Dashboard.Config.FORMATS.PERCENTAGE,

        context: "Against target",
      },

      {
        key: Banc360.Dashboard.Config.KPI_KEYS.GROWTH,

        label: "Growth",

        value: formatPercentage(performance.growth),

        rawValue: performance.growth,

        format: Banc360.Dashboard.Config.FORMATS.PERCENTAGE,

        context: "Versus previous period",

        trend: growthDirection,
      },

      {
        key: Banc360.Dashboard.Config.KPI_KEYS.TARGET_GAP,

        label: "Target Gap",

        value: formatCurrencyCrore(performance.targetGap),

        rawValue: performance.targetGap,

        format: Banc360.Dashboard.Config.FORMATS.CURRENCY_INR_CRORE,

        context: "Remaining to target",
      },

      {
        key: Banc360.Dashboard.Config.KPI_KEYS.RUN_RATE,

        label: "Annualized Run-rate",

        value: formatCurrencyCrore(performance.runRate),

        rawValue: performance.runRate,

        format: Banc360.Dashboard.Config.FORMATS.CURRENCY_INR_CRORE,

        context: "Based on current FY pace",
      },
    ];
  }

  /*============================================================
      INITIALIZE
    ============================================================*/

  function initialize(context) {
    validateDependencies();

    validateContext(context);

    currentContext = context;

    initialized = true;

    return true;
  }

  /*============================================================
      KPI CARD
    ============================================================*/

  function renderKpiCard(kpi) {
    let trendMarkup = "";

    if (kpi.trend === "up") {
      trendMarkup = `
        <div class="kpi-footer">

          <span class="kpi-trend-up">
            ↑ Positive growth
          </span>

        </div>
      `;
    } else if (kpi.trend === "down") {
      trendMarkup = `
        <div class="kpi-footer">

          <span class="kpi-trend-down">
            ↓ Negative growth
          </span>

        </div>
      `;
    }

    return `
      <article
        class="kpi-card"
        data-kpi="${kpi.key}"
      >

        <div class="card-body">

          <div class="kpi-label">
            ${kpi.label}
          </div>

          <div class="kpi-value">
            ${kpi.value}
          </div>

          <div class="kpi-context">
            ${kpi.context}
          </div>

        </div>

        ${trendMarkup}

      </article>
    `;
  }

  /*============================================================
      KPI RENDERING
    ============================================================*/

  function renderKpis(view, kpis) {
    const container = view.querySelector("[data-dashboard-kpis]");

    if (!container) {
      throw new Error("Dashboard KPI container was not found.");
    }

    container.innerHTML = kpis.map(renderKpiCard).join("");
  }

  /*============================================================
      TARGET PROGRESS
    ============================================================*/

  function renderTargetProgress(viewModel) {
    const performance = viewModel.businessPerformance;

    const progress = Math.min(Math.max(performance.achievement, 0), 100);

    const progressBar =
      viewModel.businessPerformance.achievement >= 100 ? "complete" : "";

    return `
      <section
        class="card target-progress-card"
        aria-labelledby="target-progress-title"
      >

        <div class="card-header">

          <div>

            <h2
              class="card-title"
              id="target-progress-title"
            >
              Target Progress
            </h2>

            <p class="card-subtitle">
              Current GWP against the annual target
            </p>

          </div>

        </div>

        <div class="target-progress">

          <div class="target-row">

            <span class="target-label">
              GWP achieved
            </span>

            <span class="target-value">
              ${formatCurrencyCrore(performance.gwp)}
              /
              ${formatCurrencyCrore(performance.target)}
            </span>

          </div>

          <div
            class="target-progress-bar"
            role="progressbar"
            aria-valuemin="0"
            aria-valuemax="100"
            aria-valuenow="${progress.toFixed(1)}"
            aria-label="Target achievement"
          >

            <div
              class="target-progress-fill ${progressBar}"
              style="width: ${progress.toFixed(1)}%;"
            ></div>

          </div>

          <div class="target-row">

            <span class="target-label">
              Achievement
            </span>

            <span class="target-value">
              ${formatPercentage(performance.achievement)}
            </span>

          </div>

          <div class="target-row">

            <span class="target-label">
              Target gap
            </span>

            <span class="target-value">
              ${formatCurrencyCrore(performance.targetGap)}
            </span>

          </div>

        </div>

      </section>
    `;
  }

  /*============================================================
      RUN-RATE OUTLOOK
    ============================================================*/

  function renderRunRateOutlook(viewModel) {
    const performance = viewModel.businessPerformance;

    const surplus = performance.projectedSurplus;

    const outlookClass = surplus >= 0 ? "kpi-trend-up" : "kpi-trend-down";

    const outlookText =
      surplus >= 0
        ? "Current pace is above annual target"
        : "Current pace is below annual target";

    return `
      <section
        class="card"
        aria-labelledby="run-rate-outlook-title"
      >

        <div class="card-header">

          <div>

            <h2
              class="card-title"
              id="run-rate-outlook-title"
            >
              Run-rate Outlook
            </h2>

            <p class="card-subtitle">
              Annualized view based on current FY pace
            </p>

          </div>

        </div>

        <div class="metric-row">

          <span class="metric-label">
            Annualized run-rate
          </span>

          <span class="metric-value">
            ${formatCurrencyCrore(performance.runRate)}
          </span>

        </div>

        <div class="metric-row">

          <span class="metric-label">
            Annual target
          </span>

          <span class="metric-value">
            ${formatCurrencyCrore(performance.target)}
          </span>

        </div>

        <div class="metric-row">

          <span class="metric-label">
            Run-rate vs target
          </span>

          <span class="metric-value">
            ${formatPercentage(performance.runRateVsTarget)}
          </span>

        </div>

        <div class="metric-row">

          <span class="metric-label">
            Projected surplus / shortfall
          </span>

          <span class="metric-value ${outlookClass}">
            ${surplus >= 0 ? "+" : ""}
            ${formatCurrencyCrore(surplus)}
          </span>

        </div>

        <div class="metric-row">

          <span class="metric-label">
            Outlook
          </span>

          <span class="metric-value ${outlookClass}">
            ${outlookText}
          </span>

        </div>

      </section>
    `;
  }

  /*============================================================
      PERFORMANCE SUMMARY
    ============================================================*/

  function renderPerformanceSummary(viewModel) {
    const performance = viewModel.businessPerformance;

    const growthClass =
      performance.growth >= 0 ? "kpi-trend-up" : "kpi-trend-down";

    return `
      <section
        class="card"
        aria-labelledby="performance-summary-title"
      >

        <div class="card-header">

          <div>

            <h2
              class="card-title"
              id="performance-summary-title"
            >
              Performance Summary
            </h2>

            <p class="card-subtitle">
              Key management indicators
            </p>

          </div>

        </div>

        <div class="metric-row">

          <span class="metric-label">
            Current achievement
          </span>

          <span class="metric-value">
            ${formatPercentage(performance.achievement)}
          </span>

        </div>

        <div class="metric-row">

          <span class="metric-label">
            Growth
          </span>

          <span class="metric-value ${growthClass}">
            ${performance.growth >= 0 ? "+" : ""}
            ${formatPercentage(performance.growth)}
          </span>

        </div>

        <div class="metric-row">

          <span class="metric-label">
            GWP achieved
          </span>

          <span class="metric-value">
            ${formatCurrencyCrore(performance.gwp)}
          </span>

        </div>

        <div class="metric-row">

          <span class="metric-label">
            Remaining target
          </span>

          <span class="metric-value">
            ${formatCurrencyCrore(performance.targetGap)}
          </span>

        </div>

      </section>
    `;
  }

  /*============================================================
      PARTNER PERFORMANCE TABLE
    ============================================================*/

  function renderPartnerPerformance(viewModel) {
    const partners = viewModel.partnerPerformance;

    return `
      <section
        class="card partner-performance-card"
        aria-labelledby="partner-performance-title"
      >

        <div class="card-header">

          <div>

            <h2
              class="card-title"
              id="partner-performance-title"
            >
              Partner Performance
            </h2>

            <p class="card-subtitle">
              Partner contribution and performance
              against target
            </p>

          </div>

        </div>

        <div class="partner-table-wrapper">

          <table class="partner-performance-table">

            <thead>

              <tr>

                <th scope="col">
                  Rank
                </th>

                <th scope="col">
                  Partner
                </th>

                <th scope="col">
                  GWP
                </th>

                <th scope="col">
                  Target
                </th>

                <th scope="col">
                  Achievement
                </th>

                <th scope="col">
                  Growth
                </th>

                <th scope="col">
                  Contribution
                </th>

                <th scope="col">
                  Activation
                </th>

                <th scope="col">
                  Target Gap
                </th>

              </tr>

            </thead>

            <tbody>

              ${partners
                .map((partner) => {
                  const growthClass =
                    partner.growth >= 0 ? "kpi-trend-up" : "kpi-trend-down";

                  return `
                    <tr>

                      <td>
                        <span class="partner-rank">
                          ${partner.rank}
                        </span>
                      </td>

                      <td>
                        <span class="partner-name">
                          ${partner.name}
                        </span>
                      </td>

                      <td>
                        ${formatCurrencyCrore(partner.gwp)}
                      </td>

                      <td>
                        ${formatCurrencyCrore(partner.target)}
                      </td>

                      <td>
                        ${formatPercentage(partner.achievement)}
                      </td>

                      <td>
                        <span class="${growthClass}">
                          ${partner.growth >= 0 ? "+" : ""}
                          ${formatPercentage(partner.growth)}
                        </span>
                      </td>

                      <td>

                        <div class="partner-contribution">

                          <div class="partner-contribution-value">
                            ${formatPercentage(partner.contribution)}
                          </div>

                          <div
                            class="partner-contribution-bar"
                            aria-hidden="true"
                          >

                            <div
                              class="partner-contribution-fill"
                              style="width: ${Math.min(
                                Math.max(partner.contribution, 0),
                                100,
                              ).toFixed(1)}%;"
                            ></div>

                          </div>

                        </div>

                      </td>

                      <td>
                        ${formatPercentage(partner.activation)}
                      </td>

                      <td>
                        ${formatCurrencyCrore(partner.targetGap)}
                      </td>

                    </tr>
                  `;
                })
                .join("")}

            </tbody>

          </table>

        </div>

      </section>
    `;
  }

  /*============================================================
      BUSINESS PERFORMANCE SECTION
    ============================================================*/

  function renderBusinessPerformance(view, viewModel) {
    const existingSection = view.querySelector(
      "[data-dashboard-business-performance]",
    );

    if (!existingSection) {
      throw new Error(
        "Dashboard business performance container was not found.",
      );
    }

    existingSection.innerHTML = `

      <div class="dashboard-grid">

        <div class="dashboard-column">

          ${renderTargetProgress(viewModel)}

          ${renderPerformanceSummary(viewModel)}

        </div>

        <div class="dashboard-column">

          ${renderRunRateOutlook(viewModel)}

        </div>

      </div>
    `;
  }

  /*============================================================
      DISTRIBUTION INTELLIGENCE
    ============================================================*/

  function renderDistributionIntelligence(viewModel) {
    const distribution = viewModel.distribution;

    return `
      <section
        class="card distribution-intelligence-card"
        aria-labelledby="distribution-intelligence-title"
      >

        <div class="card-header">

          <div>

            <h2
              class="card-title"
              id="distribution-intelligence-title"
            >
              Distribution Intelligence
            </h2>

            <p class="card-subtitle">
              Branch network activation and productivity
            </p>

          </div>

        </div>

        <div class="distribution-metrics">

          <div class="distribution-metric">

            <span class="distribution-metric-label">
              Total branches
            </span>

            <span class="distribution-metric-value">
              ${distribution.totalBranches.toLocaleString("en-IN")}
            </span>

            <span class="distribution-metric-context">
              Available distribution network
            </span>

          </div>

          <div class="distribution-metric">

            <span class="distribution-metric-label">
              Active branches
            </span>

            <span class="distribution-metric-value">
              ${distribution.activeBranches.toLocaleString("en-IN")}
            </span>

            <span class="distribution-metric-context">
              ${formatPercentage(distribution.activation)}
              activation
            </span>

          </div>

          <div class="distribution-metric">

            <span class="distribution-metric-label">
              GWP / active branch
            </span>

            <span class="distribution-metric-value">
              ${formatCurrencyCrore(distribution.gwpPerActiveBranch)}
            </span>

            <span class="distribution-metric-context">
              Current active-branch productivity
            </span>

          </div>

          <div class="distribution-metric">

            <span class="distribution-metric-label">
              Inactive branches
            </span>

            <span class="distribution-metric-value">
              ${distribution.inactiveBranches.toLocaleString("en-IN")}
            </span>

            <span class="distribution-metric-context">
              ${formatCurrencyCrore(distribution.inactiveBranchOpportunity)}
              illustrative opportunity
            </span>

          </div>

        </div>

        <div class="distribution-summary">

          <div class="metric-row">

            <span class="metric-label">
              Network activation
            </span>

            <span class="metric-value">
              ${formatPercentage(distribution.activation)}
            </span>

          </div>

          <div class="metric-row">

            <span class="metric-label">
              Inactive network
            </span>

            <span class="metric-value">
              ${distribution.inactiveBranches.toLocaleString("en-IN")}
              branches
            </span>

          </div>

          <div class="metric-row">

            <span class="metric-label">
              Illustrative opportunity
            </span>

            <span class="metric-value">
              ${formatCurrencyCrore(distribution.inactiveBranchOpportunity)}
            </span>

          </div>

        </div>

        <div class="distribution-note">

          Illustrative opportunity assumes inactive branches
          achieve current average active-branch productivity.
          It is not a forecast.

        </div>

      </section>
    `;
  }

  /*============================================================
      DASHBOARD SHELL
    ============================================================*/

  function renderDashboardShell(view, viewModel) {
    const kpis = buildKpis(viewModel);

    view.innerHTML = `
      <section
        class="dashboard-page"
        data-dashboard-root
        aria-labelledby="dashboard-title"
      >

        <header class="dashboard-header">

          <div class="dashboard-title">

            <h1 id="dashboard-title">
              Executive Dashboard
            </h1>

            <p>
              ${viewModel.period.financialYear}
              · Business performance overview
            </p>

          </div>

          <div class="dashboard-actions">

            <span class="text-muted">
              As of ${viewModel.period.asOf}
            </span>

          </div>

        </header>

        <section
          aria-labelledby="business-performance-title"
        >

          <div class="dashboard-title">

            <h2 id="business-performance-title">
              Business Performance
            </h2>

            <p>
              Core Bancassurance business performance
              against the current annual target.
            </p>

          </div>

          <div
            class="dashboard-kpis"
            data-dashboard-kpis
          >
          </div>

        </section>

        <section
          data-dashboard-business-performance
          aria-label="Business performance analysis"
        >
        </section>

        <section
          data-dashboard-distribution-intelligence
          aria-label="Distribution intelligence"
        >
        </section>

                <section
          data-dashboard-partner-performance
          aria-label="Partner performance"
        >
        </section>

      </section>
    `;

    renderKpis(view, kpis);

    renderBusinessPerformance(view, viewModel);

    const partnerContainer = view.querySelector(
      "[data-dashboard-partner-performance]",
    );

    if (!partnerContainer) {
      throw new Error("Dashboard partner performance container was not found.");
    }

    partnerContainer.innerHTML = renderPartnerPerformance(viewModel);

    const distributionContainer = view.querySelector(
      "[data-dashboard-distribution-intelligence]",
    );

    if (!distributionContainer) {
      throw new Error(
        "Dashboard distribution intelligence container was not found.",
      );
    }

    distributionContainer.innerHTML = renderDistributionIntelligence(viewModel);
  }

  /*============================================================
      RENDER
    ============================================================*/

  async function render(context) {
    initialize(context);

    const dashboardData = await Banc360.Dashboard.Data.getDashboardData();

    validateDashboardData(dashboardData);

    currentData = dashboardData;

    currentViewModel = buildViewModel(dashboardData);

    renderDashboardShell(context.view, currentViewModel);

    Banc360.log("Dashboard Business Performance Rendered", {
      period: currentViewModel.period,

      achievement: currentViewModel.businessPerformance.achievement,

      runRate: currentViewModel.businessPerformance.runRate,
    });

    return currentViewModel;
  }

  /*============================================================
      DESTROY
    ============================================================*/

  function destroy() {
    currentContext = null;

    currentData = null;

    currentViewModel = null;

    initialized = false;
  }

  /*============================================================
      CONTEXT ACCESSOR
    ============================================================*/

  function getContext() {
    return currentContext;
  }

  /*============================================================
      VIEW MODEL ACCESSOR
    ============================================================*/

  function getViewModel() {
    return currentViewModel;
  }

  /*============================================================
      PUBLIC API
    ============================================================*/

  return Object.freeze({
    initialize,

    render,

    destroy,

    getContext,

    getViewModel,

    MODULE_NAME,

    MODULE_TITLE,
  });
})();

/*==============================================================
MODULE LOADED
==============================================================*/

Banc360.log("Dashboard Module Loaded");
