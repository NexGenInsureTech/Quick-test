
# Phase 0.2 – Enterprise Architecture & Solution Blueprint

**Document Version:** 0.2

---

# Our Design Philosophy

We will follow a layered architecture.

One layer **must never directly depend** on another layer's implementation.

```
┌─────────────────────────────────────────────┐
│              Presentation Layer             │
│ Dashboards • Reports • Charts • UI          │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│            Intelligence Layer               │
│ Alerts • Recommendations • Scoring          │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│              Analytics Layer                │
│ KPI Engine • Aggregations • Trends          │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│                Data Layer                   │
│ Upload • Validation • Normalization         │
└─────────────────────────────────────────────┘
```

This separation means:

* New dashboards don't affect uploads.
* New uploads don't affect dashboards.
* KPIs are reusable.
* Performance remains high.

---

# Complete Folder Architecture

I recommend we build Banc360 as if it were a commercial software product.

```text
Banc360/

│
├── index.html
│
├── assets/
│
│   ├── css/
│   │      variables.css
│   │      layout.css
│   │      dashboard.css
│   │      tables.css
│   │      charts.css
│   │      forms.css
│   │      themes.css
│   │
│   ├── js/
│   │
│   │   core/
│   │   config/
│   │   data/
│   │   analytics/
│   │   intelligence/
│   │   dashboards/
│   │   ui/
│   │   reports/
│   │   exports/
│   │   utils/
│   │
│   ├── icons/
│   ├── fonts/
│   ├── images/
│   │
│   └── libraries/
│       (local third-party libraries only)
│
├── config/
│
│   kpis.json
│   thresholds.json
│   products.json
│   permissions.json
│
├── workspace/
│
├── documentation/
│
└── samples/
```

Notice something important.

There is **no `script.js`**.

Everything has its own responsibility.

---

# Module Architecture

Every module must satisfy one rule.

> **It can be removed without breaking the rest of the application.**

Example:

```
Renewal Module

↓

Disabled

↓

Executive Dashboard still works.
```

---

# Core Modules

These never disappear.

```
Application

Navigation

Upload Manager

Settings

Configuration

Analytics Engine

Storage

Authentication
(optional later)
```

---

# Business Modules

```
Executive Dashboard

Branch Dashboard

RM Dashboard

Health Dashboard

Renewal Dashboard

Claims Dashboard

Commission Dashboard

Forecast Dashboard

Opportunity Dashboard
```

Each is independent.

---

# Data Pipeline

This is the heart of Banc360.

```
Upload

↓

Validate

↓

Clean

↓

Normalize

↓

Index

↓

Aggregate

↓

Analytics

↓

Intelligence

↓

Dashboard
```

Each step produces a reusable output.

---

# Upload Manager

The Upload Manager will not merely import files.

It will function like an ETL (Extract, Transform, Load) engine.

### Responsibilities

✔ Read Excel

✔ Read CSV

✔ Detect sheets

✔ Validate columns

✔ Detect duplicates

✔ Detect missing columns

✔ Normalize formats

✔ Create indexes

✔ Register datasets

---

# Dataset Registry

One of the most important components.

Imagine:

```
Premium Register

Loaded

70,284 rows

Healthy

100%
```

```
Commission Register

Not Uploaded
```

```
Branch Master

Loaded

10,542 branches
```

Every module consults this registry before execution.

---

# Analytics Engine

The Analytics Engine should know nothing about dashboards.

It simply produces metrics.

Example

```
calculateBranchActivation()

↓

Result
```

```
{

activated:7423,

inactive:3077,

growth:4.2%

}
```

Every dashboard consumes the same object.

No duplicate calculations.

---

# Intelligence Engine

This is the layer that transforms metrics into decisions.

Example

Analytics says:

```
Health Growth

↓

-8%
```

Intelligence says:

```
Reason

↓

42 high-performing branches sold no Health this month.

Recommendation

↓

Visit these branches.

Expected Opportunity

↓

₹62 Lakhs
```

This distinction is crucial.

---

# Dashboard Framework

Every dashboard should follow the same layout.

```
Header

↓

Filters

↓

Summary Cards

↓

Charts

↓

Leaderboards

↓

Drill-down Tables

↓

Recommendations

↓

Export
```

Users should never have to learn a new interface for each module.

---

# Configuration Framework

One of the biggest mistakes in internal tools is hard-coding business rules.

Instead, Banc360 will store business logic as configuration.

Examples:

```
Activation Threshold

₹25,000
```

```
Health Focus Weight

20%
```

```
Champion Branch

₹5 Lakhs
```

If management changes the target, no code changes are required.

---

# Performance Strategy

With approximately 70,000 policies every month, performance must be built in from day one.

### Rule 1

Never filter raw datasets repeatedly.

### Rule 2

Aggregate once.

Reuse everywhere.

### Rule 3

Create indexes.

Example

```
Branch Index

Product Index

RM Index

Month Index

Policy Index
```

Lookups become almost instantaneous.

---

# Event Architecture

Modules should communicate through events, not direct calls.

```
Upload Completed

↓

Analytics Updated

↓

Dashboards Refresh
```

No module needs to know how another works.

---

# Error Handling Philosophy

Instead of:

```
Error!

Missing Commission Register
```

Show:

```
Commission Dashboard

Unavailable

Reason

Commission Register not uploaded.

Upload to unlock profitability insights.
```

The platform should always remain usable.

---

# Workspace Concept

One feature I think will make Banc360 incredibly useful is the concept of a **Workspace**.

Instead of treating each upload as temporary, users can create a named workspace.

Examples:

```
FY 2026-27

↓

July Review

↓

August Review

↓

Q2 Strategy

↓

Annual Plan
```

Each workspace remembers:

* Uploaded datasets.
* Applied filters.
* Custom thresholds.
* Saved views.
* Notes.

This transforms Banc360 into a persistent strategic planning environment rather than a one-off reporting tool.

---

# One Architectural Enhancement I'd Like to Introduce

After reflecting on your workflow as a Bancassurance Head, I think Banc360 should adopt a **three-engine architecture** instead of just one analytics engine.

### Engine 1 — Data Engine

Responsible for:

* Uploading.
* Validation.
* Cleaning.
* Normalization.
* Dataset registration.

### Engine 2 — Analytics Engine

Responsible for:

* KPI calculations.
* Trends.
* Aggregations.
* Time-series metrics.
* Reusable business calculations.

### Engine 3 — Strategy Engine

Responsible for answering questions such as:

* Where should I focus today?
* Which branches offer the biggest opportunity?
* Which initiatives should be prioritized?
* What is the expected business impact?

This separation is powerful because the Strategy Engine doesn't calculate data—it consumes analytics and applies business rules to recommend actions. Over time, it can evolve into an AI-assisted recommendation engine without changing the Data or Analytics engines.

---

## Phase 0.3 (Our Next Milestone)

With the architecture now defined, the next document should be the **Enterprise Data Model & Dataset Specification**.

This is where we'll define:

* Every business entity (Policy, Branch, RM, Bank, Product, etc.).
* Relationships between entities.
* Mandatory and optional datasets.
* Common keys for joining datasets.
* Time dimensions.
* Naming standards.
* Normalized data structures.
* Rules for handling missing or evolving datasets.

This phase is especially important because it will allow us to plug in future datasets—such as Commission, Loss Ratio, Claims, or Branch Master—without redesigning the platform. Once the data model is stable, implementation becomes much more straightforward because every module speaks the same "data language."
