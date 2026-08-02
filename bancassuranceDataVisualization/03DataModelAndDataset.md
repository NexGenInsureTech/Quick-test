# Phase 0.3 – Enterprise Data Model & Dataset Specification

> **Goal:** Create a future-proof business data model that can support today's Premium Register and tomorrow's Commission, Claims, Branch Master, HR, Targets, and any future dataset.

---

# Our First Architectural Rule

We will **never** build around Excel files.

We will build around **Business Entities**.

Excel files are merely one way to populate those entities.

Instead of thinking:

```text
Premium Register.xlsx
```

We'll think:

```text
Policy
```

Tomorrow another system exports:

```text
PolicyData.csv
```

No problem.

Same entity.

---

# Core Business Entities

I believe Banc360 revolves around **12 Core Entities**.

```text
Policy

Branch

Bank

Sales Hierarchy

Employee

Product

Customer

Claim

Commission

Target

Time

Configuration
```

Everything else connects to one or more of these.

---

# Entity 1 — Policy (The Heart of the Platform)

Almost every insight originates here.

### Purpose

Represents one insurance policy transaction.

### Initially Populated From

* Premium Register

### Typical Fields

* Policy Number
* Cover Note
* Endorsement
* Policy Issue Date
* Start Date
* Expiry Date
* Premium
* Sum Insured
* Product
* Branch
* Bank
* Employee
* Business Type (Fresh / Renewal)

### Relationships

```text
Policy

↓

Branch

↓

Bank

↓

RM

↓

Product

↓

Customer
```

---

# Entity 2 — Branch

One of the most important entities.

Eventually, every branch becomes a strategic business unit.

### Branch Attributes

```text
Branch Code

Branch Name

Bank

Zone

Region

State

District

Category

Latitude

Longitude

Branch Type

Activation Status
```

### Future Metrics

* Productivity
* Activation
* Growth
* Opportunity
* Retention
* Health Mix
* Potential Score

---

# Entity 3 — Bank

Not just a name.

An organizational hierarchy.

```text
Bank

↓

Zone

↓

Region

↓

Cluster

↓

Branch
```

This enables aggregation at every level.

---

# Entity 4 — Sales Hierarchy

Different from HR.

Represents reporting relationships.

```text
National Head

↓

ZSM

↓

ASM

↓

RM

↓

Branch
```

This allows Banc360 to answer:

> "How is ZSM North performing?"

without extra coding.

---

# Entity 5 — Employee

Contains HR-related information.

Examples:

* Employee Code
* Name
* Joining Date
* Cost Center
* Grade
* Designation
* Employment Status

This supports productivity, tenure analysis, and organizational reporting.

---

# Entity 6 — Product

This entity should be richer than what's in the Premium Register.

Beyond Product Name and Code, we'll eventually include:

* Line of Business
* Strategic Category (Focus / Non-Focus)
* Attachment Category
* Renewal Behaviour
* Cross-sell Group
* Default Commission
* Default Thresholds

---

# Entity 7 — Customer

Initially, this may contain only what the Premium Register provides.

Over time it can support:

* Customer Type (Retail / MSME / Corporate)
* GST Status
* State
* Risk Segment
* Multi-policy relationships

---

# Entity 8 — Claim

Optional.

Required only for profitability.

Supports:

* Paid Claims
* Outstanding Claims
* Claim Frequency
* Loss Ratio
* Claim Severity

---

# Entity 9 — Commission

Optional.

Supports:

* Commission %
* Commission Amount
* Net Margin
* Channel Cost
* Bank Share
* RM Incentive

---

# Entity 10 — Target

Supports planning.

Examples:

```text
Annual

Quarterly

Monthly

RM Target

Branch Target

Bank Target

Product Target
```

---

# Entity 11 — Time

This may sound simple, but it's one of the most valuable entities.

We'll derive a comprehensive calendar dimension from policy dates:

* Financial Year
* Quarter
* Month
* Week
* Day
* Year-to-Date
* Month-to-Date
* Quarter-to-Date
* Rolling 12 Months
* Festival Season
* Working Days
* Month-End Flags

This avoids recalculating date logic everywhere.

---

# Entity 12 — Configuration

Stores business rules.

Examples:

* Activation Threshold
* Productivity Bands
* Champion Branch Criteria
* Dashboard Defaults
* Alert Levels
* Scoring Weights

---

# Relationships

```text
                 Bank
                  │
             Branch
                  │
         Sales Hierarchy
                  │
             Employee
                  │
Policy ───── Product
   │            │
   │            │
Customer     Commission
   │
Claim
```

Everything revolves around the **Policy** entity.

---

# Mandatory vs Optional Data

This is one of the biggest architectural decisions we've made.

## Tier 1 (Mandatory)

| Dataset          | Purpose                 |
| ---------------- | ----------------------- |
| Premium Register | Core transactional data |

Nothing else.

---

## Tier 2 (Recommended)

| Dataset         | Purpose                  |
| --------------- | ------------------------ |
| Branch Master   | Organizational structure |
| Sales Hierarchy | RM mapping               |
| Employee Master | Productivity             |
| Target File     | Performance tracking     |

---

## Tier 3 (Optional)

| Dataset             | Purpose              |
| ------------------- | -------------------- |
| Commission Register | Profitability        |
| Claims              | Loss analysis        |
| Loss Ratio          | Portfolio quality    |
| Collections         | Cash flow            |
| Bank Financials     | Opportunity analysis |

The system will automatically adapt based on what's available.

---

# Common Keys (Critical)

One of the biggest risks in analytics projects is inconsistent identifiers.

I propose we establish a **Canonical Key Strategy**.

| Entity     | Primary Key                         |
| ---------- | ----------------------------------- |
| Policy     | Policy Number                       |
| Branch     | Branch Code                         |
| Bank       | Bank Code (or standardized Bank ID) |
| Product    | Product Code                        |
| Employee   | Employee Code                       |
| Customer   | Insured ID                          |
| Claim      | Claim Number                        |
| Commission | Policy Number + Endorsement         |

Whenever uploaded files use different column names, we'll map them to these canonical keys.

---

# Time-Series Strategy

Rather than overwriting data every month, Banc360 will build history.

Each upload becomes a snapshot.

Examples:

* July 2026
* August 2026
* September 2026

This enables:

* Month-on-Month growth
* Year-on-Year growth
* Rolling trends
* Forecasting
* Seasonality analysis

---

# Metadata Layer

Every uploaded dataset should carry metadata:

* File Name
* Upload Date
* Reporting Period
* Row Count
* Validation Score
* Missing Columns
* Duplicate Records
* Version

This will help with governance and troubleshooting.

---

# A New Idea I'd Like to Introduce: The Semantic Business Layer

This is something used in mature BI platforms but rarely implemented in internal tools.

Instead of dashboards referring directly to column names like:

```text
NET PREMIUM
USGI NET PREMIUM
GROSS PREMIUM
```

they refer to **business concepts**:

* Premium
* Written Premium
* Renewal Premium
* Branch Activation
* Productivity
* Health Growth

The semantic layer translates those concepts into the correct calculations and source fields.

The advantages are significant:

* If your Premium Register changes column names next year, you update the mapping once rather than every dashboard.
* New datasets from different systems can map to the same business concepts.
* KPI definitions remain stable even as source files evolve.
* It becomes much easier to build a future AI assistant because it reasons in business language instead of raw column names.

I believe this semantic layer will be one of the most valuable architectural investments we can make.

---

# Phase 0.4 – The Next Milestone (The Most Important Business Phase)

Now that we've defined the enterprise data model, I don't want to move to coding yet.

The next step should be the **Enterprise KPI Dictionary & Business Rules Engine**.

This will define, one by one:

* Every KPI.
* The business purpose.
* Exact calculation formula.
* Required and optional datasets.
* Thresholds.
* Drill-down paths.
* Visualizations.
* Business interpretation.
* Recommended actions.
* Ownership (Executive, Bank, Branch, RM, etc.).

I expect this to become one of the largest and most valuable documents in Banc360 because every dashboard, alert, recommendation, and future AI feature will rely on these standardized KPI definitions. Once this foundation is complete, implementation becomes much more systematic and consistent.
