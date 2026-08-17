# Phase 0.4 — Enterprise KPI Dictionary & Business Rules Engine

**Version:** 0.4

---

# Before We Define KPIs...

I'd like to introduce one concept that I think will make Banc360 fundamentally different from almost every BI dashboard I've seen.

## Traditional BI

Traditional BI answers:

> **What happened?**

Example:

| KPI               | Value   |
| ----------------- | ------- |
| Premium           | ₹423 Cr |
| Growth            | 12%     |
| Branch Activation | 6,425   |

That's useful.

But it stops there.

---

## Banc360 BI

Every KPI will have **9 dimensions**.

Instead of

```text
Premium = ₹423 Cr
```

Every KPI becomes an object.

---

# KPI Object

Every KPI will have this structure.

| Attribute           | Purpose             |
| ------------------- | ------------------- |
| KPI Name            | Business name       |
| Description         | Why it exists       |
| Formula             | Calculation         |
| Required Dataset    | Mandatory           |
| Optional Dataset    | Enhancements        |
| Drill Down          | How user explores   |
| Thresholds          | Green / Amber / Red |
| Recommended Actions | Strategy            |
| AI Interpretation   | Future AI           |

This is what makes Banc360 intelligent.

---

# KPI Category Structure

Instead of one giant KPI list, we'll organize them into domains.

---

# Domain 1

## Executive KPIs

Measures overall business.

Examples

* Gross Premium
* Net Premium
* Growth
* Achievement %
* Profitability
* Forecast
* Opportunity
* Productivity Index

---

# Domain 2

## Branch Intelligence

Examples

* Activated Branches
* Zero Branches
* Dormant Branches
* Champion Branches
* Branch Migration
* Branch Potential
* Premium per Branch

---

# Domain 3

## RM Intelligence

Examples

* Premium per RM
* Branch Coverage
* Productivity
* Health Mix
* Renewal Rate
* Focus Product Mix
* Opportunity Score

---

# Domain 4

## Bank Intelligence

Examples

* Premium
* Growth
* Activation
* Penetration
* Productivity
* Product Mix
* Renewal
* Opportunity

---

# Domain 5

## Product Intelligence

Examples

* Product Growth
* Product Mix
* Attachment
* Cross Sell
* Average Premium
* Renewal
* Contribution

---

# Domain 6

## Renewal Intelligence

Examples

* Retention
* Renewal Due
* Renewal Lost
* Renewal Saved
* Renewal Pipeline

---

# Domain 7

## Profitability Intelligence

Optional

* Commission
* LR
* COR
* Margin
* Profit

---

# Domain 8

## Opportunity Intelligence

Probably the most important.

Examples

* Dormant Branch Opportunity
* Health Opportunity
* Fire Opportunity
* Cross Sell Opportunity
* RM Opportunity
* Renewal Opportunity

---

# Domain 9

## Strategy Intelligence

Examples

* Forecast
* Achievement Probability
* Risk Score
* Growth Capacity
* Expansion Opportunity

---

# Let's Define Our First KPI Properly

---

# KPI 001

## Gross Written Premium

### Business Purpose

Measures the total business generated during the selected period.

---

### Business Question

> How much business have we generated?

---

### Formula

Sum of

```text
USGI GROSS PREMIUM
```

---

### Required Dataset

Premium Register

---

### Optional Dataset

None

---

### Frequency

Real-time after upload

---

### Drill Down

```text
Year

↓

Quarter

↓

Month

↓

Week

↓

Day

↓

Bank

↓

Zone

↓

Region

↓

Branch

↓

Product

↓

Policy
```

---

### Threshold

Configurable.

---

### Visualizations

Card

Trend

Heatmap

Leaderboard

Waterfall

Forecast

---

### AI Interpretation

Example

> Premium increased by 12%.

Growth primarily driven by Health in Indian Bank South.

---

### Recommended Actions

Increase Health in APGB.

Recover dormant branches.

Improve renewal retention.

---

# KPI 002

## Branch Activation

---

### Business Purpose

Measures the number of branches contributing business.

---

### Formula

Branch Premium >

Activation Threshold

(Default

₹25,000)

---

### Required Dataset

Premium Register

---

### Optional Dataset

Branch Master

---

### Drill Down

Bank

↓

Region

↓

Branch

---

### Business Questions

Which branches are active?

Which branches became active?

Which branches became dormant?

---

### Recommended Actions

Visit newly dormant branches.

Recognize newly activated branches.

Recover top dormant opportunities.

---

# KPI 003

## Zero Branch %

---

Business Purpose

Identify inactive branches.

---

Formula

```text
Zero Premium

÷

Total Branches
```

---

Required Dataset

Premium Register

Branch Master

---

Questions

Where are zero branches?

Why?

Who owns them?

---

Actions

Assign recovery campaign.

---

# KPI 004

## RM Productivity

Formula

```text
Premium

÷

Headcount
```

Optional Enhancement

Premium

÷

Visits

Premium

÷

Working Days

---

Questions

Who is over-performing?

Who needs coaching?

---

Actions

Redistribute workload.

---

# KPI 005

## Renewal Retention

Formula

Renewed

÷

Renewable

---

Questions

How much business was retained?

What was lost?

---

Actions

Target upcoming expiries.

---

# KPI 006

## Health Mix

Formula

Health Premium

÷

Total Premium

---

Questions

Is Health improving?

Where?

---

Actions

Health Campaign.

---

# KPI 007

## Product Concentration

Formula

Top Product

÷

Total Premium

---

Purpose

Avoid dependency on one product.

---

# KPI 008

## Opportunity Score

One of my favorite KPIs.

Instead of showing

```text
Branch A

₹0
```

We'll compute

Opportunity

Example

```text
Branch

Premium

₹0

Potential

₹12 Lakhs

Priority

High
```

This becomes actionable.

---

# KPI 009

## Strategy Index

Instead of

10 KPIs

Create one score.

Example

```text
Growth

25%

Activation

20%

Renewal

20%

Health

15%

Productivity

10%

Zero Branch

10%
```

Final Score

```text
84/100
```

---

# Business Rules Engine

Now comes the exciting part.

Instead of coding

```javascript
if (premium > 25000)
```

We'll create a Business Rule.

Example

```json
{
  "Rule": "BranchActivation",
  "Threshold": 25000,
  "Editable": true
}
```

Tomorrow

Management changes

₹25,000

to

₹50,000

No coding.

---

# Another Rule

```json
{
 "Rule":"Champion",

 "Premium":500000
}
```

Again

No code.

---

# Every KPI Reads Rules

Example

```text
Branch Activation

↓

Business Rules

↓

Threshold

↓

Dashboard
```

Not

Dashboard

↓

Hardcoded Threshold

---

# I Want to Add Something I Have Never Seen in an Internal Insurance Dashboard

This idea came to me while we were defining the KPIs.

## Every KPI Should Have an "Improvement Playbook"

Most dashboards stop after showing a number.

Banc360 should immediately guide the user on how to improve it.

For example:

### KPI: Branch Activation

Instead of displaying:

* Activated Branches: 6,420

Banc360 would also include:

**Likely Reasons for Low Activation**

* Low RM coverage.
* No recent branch visit.
* Limited Health product sales.
* Low renewal base.

**Suggested Actions**

1. Visit the top 50 dormant branches by opportunity.
2. Launch a Health attachment campaign.
3. Schedule branch manager engagement.
4. Prioritize branches with strong loan growth.

**Expected Impact**

* Estimated additional premium: ₹1.8 crore.
* Expected activation increase: +120 branches.

This transforms every KPI from a static metric into an operational guide. Over time, these playbooks can become increasingly sophisticated and eventually AI-assisted, but we can start with configurable business rules and recommendations.

---

# The Next Phase (Where We Begin Thinking Like Designers)

We've now defined the product vision, architecture, data model, and KPI framework.

The next step is **Phase 0.5 – UX Architecture & Information Design**.

This is not about colors or fonts yet.

It's about defining:

* What the home screen should answer in the first 30 seconds.
* How users navigate between strategic and operational views.
* What dashboards exist and how they connect.
* Drill-down paths.
* Workspace concepts.
* Executive workflows.
* Daily, weekly, monthly review journeys.
* Screen hierarchy.
* Interaction patterns.

I think this phase is critical because a powerful analytics engine is only valuable if the right information is presented in the right order. My goal is for a National Bancassurance Head to open Banc360 each morning and know exactly where to focus within a minute, without searching through menus or reports. From there, every click should naturally lead from high-level strategy to the operational detail needed to take action.
