# Phase 0.1 – Banc360 Product Charter

**Version:** 0.1 (Foundation)
**Status:** Approved Draft
**Project Name:** **Banc360**
**Tagline:** *Bancassurance Intelligence & Strategy Platform*

---

# 1. Vision Statement

> **To create the most comprehensive Bancassurance Intelligence Platform that transforms operational insurance data into strategic business decisions through actionable insights, intelligent recommendations, and predictive analytics.**

The emphasis is on **decision support**, not reporting.

---

# 2. Mission

To provide a single platform where a Bancassurance leader can:

* Understand current business performance.
* Identify growth opportunities.
* Detect business risks early.
* Improve branch productivity.
* Increase renewal retention.
* Optimize product mix.
* Improve profitability.
* Drive strategic decisions using data.

---

# 3. Product Philosophy

Banc360 is **not**:

* ❌ an Excel replacement
* ❌ a reporting tool
* ❌ a pivot-table generator

Banc360 **is**:

* ✅ a Decision Support System
* ✅ a Business Intelligence Platform
* ✅ a Strategy Execution Platform
* ✅ an Analytics Engine
* ✅ a Growth Accelerator

---

# 4. Success Definition

A successful Banc360 should enable you to answer questions such as:

### Executive

* Are we on track to achieve ₹800 Cr?
* Where will the next ₹50 Cr come from?
* Which banks are slowing growth?
* What is the projected year-end business?

---

### Business

* Which branches should be activated?
* Which RMs require intervention?
* Which products are losing momentum?
* Which renewals are at risk?
* Where should I spend my next week?

---

### Strategy

* What happens if Health grows by 10%?
* What if Zero Branches reduce by 15%?
* Which initiatives produce the highest ROI?

---

# 5. Guiding Principles

These principles are **non-negotiable**.

## Principle 1

**Offline First**

Runs entirely inside the corporate environment.

No internet dependency.

---

## Principle 2

**Zero External Dependency**

Wherever possible:

* HTML
* CSS
* Vanilla JavaScript

If a library is needed, it will be bundled locally.

---

## Principle 3

**Progressive Intelligence**

Only Premium Register is mandatory.

Every additional dataset enhances the platform but is never required.

---

## Principle 4

**Graceful Degradation**

Missing datasets disable only dependent insights.

Nothing else should fail.

---

## Principle 5

**Configuration over Code**

Business rules belong in configuration files.

Examples:

* Activation Threshold
* Product Categories
* Growth Targets
* KPI Weights
* Alert Levels

Changing these should never require code changes.

---

## Principle 6

**Single Source of Truth**

Every KPI is calculated once.

All dashboards consume the same result.

---

## Principle 7

**Action over Reporting**

Every page must answer:

1. What happened?
2. Why did it happen?
3. What should I do?
4. What is the expected impact?

---

## Principle 8

**Scalable by Design**

The architecture should comfortably handle:

* 70,000+ policies per month.
* Multi-year historical data.
* Additional datasets.
* New dashboards.
* Future AI capabilities.

---

# 6. Product Objectives

## Short Term (Phase 1)

* Upload Premium Register.
* Generate executive dashboards.
* Branch analytics.
* RM analytics.
* Growth analytics.

---

## Medium Term

Support:

* Commission Register.
* Branch Master.
* Headcount.
* Targets.
* Claims.
* Loss Ratio.

---

## Long Term

Become an intelligent planning platform with:

* AI Recommendations.
* Forecasting.
* Scenario Simulation.
* Board Reporting.
* Natural Language Queries.

---

# 7. Product Users

| Persona                | Primary Need                                 |
| ---------------------- | -------------------------------------------- |
| CEO / MD               | Strategic overview, profitability, forecasts |
| National Head          | Growth, productivity, activation, renewals   |
| Zonal Head             | Regional performance, branch opportunities   |
| ASM / Regional Manager | RM coaching, branch execution                |
| RM                     | Daily priorities, target tracking, renewals  |
| Analyst                | Data validation, uploads, custom reports     |
| Admin                  | Configuration, users, master data            |

---

# 8. Core Business Domains

These domains will evolve independently.

### Executive Intelligence

Enterprise KPIs.

---

### Branch Intelligence

Everything branch-related.

---

### RM Intelligence

Sales force productivity.

---

### Bank Intelligence

Partner performance.

---

### Product Intelligence

Health, Motor, Fire, SME, etc.

---

### Renewal Intelligence

Retention.

Pipeline.

Lapse analysis.

---

### Claims & Profitability

Loss Ratio.

Margins.

Commission.

---

### Opportunity Intelligence

Growth opportunities.

Dormant branches.

Cross-sell.

Attachment.

---

### Strategy Intelligence

Forecasts.

Scenario simulations.

Recommendations.

---

### Administration

Configuration.

Masters.

Users.

Uploads.

Settings.

---

# 9. Success Metrics for Banc360

The platform itself should be measured.

Examples:

* Dashboard load time < 3 seconds after preprocessing.
* File validation accuracy > 99%.
* KPI consistency across dashboards.
* Zero duplicated KPI logic.
* New dashboard creation without modifying the analytics core.
* New dataset integration with minimal impact on existing modules.

---

# 10. Our Development Mantra

I propose we adopt these as the project's guiding statements:

> **Build once. Reuse everywhere.**

> **Configuration before customization.**

> **Insights before charts.**

> **Actions before reports.**

> **Modular before monolithic.**

> **Business-first, technology-second.**

---

# I Want to Add One More Layer

This is something I haven't seen in most internal analytics projects, but I believe it will make Banc360 exceptional.

## We will maintain three parallel artifacts throughout development:

### 1. The Blueprint (The "Why")

* Vision
* Architecture
* Business rules
* KPI definitions
* Product decisions

This changes infrequently and serves as the long-term reference.

### 2. The Build Book (The "What")

For every phase, we'll record:

* Features delivered
* Folder structure
* New modules
* Configuration changes
* Known limitations
* Future enhancements

Think of it as the project's engineering journal.

### 3. The Operations Guide (The "How")

Written from the user's perspective:

* How to upload data
* How to interpret dashboards
* How KPIs are calculated
* How to configure thresholds
* Troubleshooting

This ensures that Banc360 is not just well-built but also easy to adopt and maintain.

---

## What Comes Next

With the Product Charter now established, the next logical milestone is **Phase 0.2 – Enterprise Architecture & Solution Blueprint**.

This is where we will define:

* The complete folder structure.
* Module boundaries.
* The plugin architecture.
* The data flow from upload to dashboard.
* The analytics engine.
* The event system.
* The configuration framework.
* The storage strategy.
* Performance considerations for large datasets.
* Coding standards and naming conventions.

This phase will become the architectural backbone of Banc360. Once it's complete, every HTML page, CSS component, JavaScript module, and future enhancement will have a clear place in the overall system. Given the scale we've envisioned, I consider this the most critical technical milestone before any implementation begins.
