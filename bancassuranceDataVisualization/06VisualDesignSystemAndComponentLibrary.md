# Phase 0.6 – Banc360 Design System & Component Library

> **Objective**
>
> Build Banc360 like a commercial product rather than an internal dashboard.

---

# Before We Begin

I want to establish one principle.

## Banc360 should not look like insurance software.

It should look closer to

* Bloomberg Terminal
* Microsoft Power BI
* Notion
* Monday.com
* Airtable
* Linear
* GitHub
* Apple Dashboard

Clean.

Minimal.

Information dense.

Fast.

Professional.

---

# Design Philosophy

I want Banc360 to follow

## Calm Technology

Meaning

The UI never competes with the data.

The data is always the hero.

---

# Color Philosophy

Instead of colorful dashboards

Use color only to communicate meaning.

Example

| Meaning     | Color |
| ----------- | ----- |
| Good        | Green |
| Warning     | Amber |
| Critical    | Red   |
| Opportunity | Blue  |
| Information | Gray  |

Everything else remains neutral.

---

# Visual Identity

Imagine opening Banc360.

Not bright.

Not noisy.

Professional.

```text
White

Dark Gray

Blue Accent

Lots of whitespace

Thin borders

Rounded corners

Minimal shadows
```

Think Microsoft Fluent Design rather than flashy BI tools.

---

# Typography

I recommend only **three font sizes** for most of the application.

```text
Page Title

32px

Section

18px

Body

14px
```

Consistency creates perceived quality.

---

# Grid System

Everything aligns to a **12-column responsive grid**.

Cards.

Tables.

Charts.

Filters.

All follow the same rhythm.

---

# Component Library

Now we define reusable building blocks.

---

# Component 1

## KPI Card

Every dashboard begins with KPI cards.

Structure

```text
Gross Premium

₹423 Cr

↑12%

vs Last Month

Excellent

View Details →
```

Notice

No unnecessary decoration.

---

# Component 2

## Insight Card

Not a number.

A conclusion.

Example

```text
Health Business

↑18%

Highest growth

South Region

Driven by

Indian Bank
```

---

# Component 3

## Opportunity Card

Probably the signature component of Banc360.

```text
Opportunity

Recover Dormant Branches

Potential

₹2.4 Cr

Priority

High

Expected Impact

+124 Activated Branches

Take Action →
```

---

# Component 4

## Recommendation Card

Example

```text
Recommendation

Visit

Karnataka Bank

South Zone

Reason

Highest unrealized Health opportunity.

Impact

₹42 Lakhs
```

---

# Component 5

## Alert Card

```text
⚠ Renewal Risk

218 Policies

Expire in

7 Days

Potential Premium

₹1.8 Cr
```

---

# Component 6

## Leaderboard

Top 20

Bottom 20

```text
Rank

Branch

Premium

Growth

Activation

Trend
```

Simple.

---

# Component 7

## Smart Table

This deserves special attention.

I don't want ordinary HTML tables.

I want

Filtering

Search

Column pinning

Sorting

Totals

Grouping

Expand/Collapse

Export

Right-click menu

Everything.

Without feeling heavy.

---

# Component 8

## Drill Path

Example

```text
India

↓

Indian Bank

↓

South Zone

↓

Bangalore Region

↓

Branch

↓

Policy
```

Always visible.

---

# Component 9

## Timeline

Useful for

Renewals

Uploads

History

Tasks

Forecast

---

# Component 10

## Upload Wizard

Not simply

Choose File.

Instead

```text
Upload

↓

Validate

↓

Preview

↓

Issues

↓

Fix

↓

Import

↓

Completed
```

Very user friendly.

---

# Component 11

## Empty State

Instead of

"No Data"

Show

```text
Profitability Dashboard

Requires

Commission Register

Loss Ratio

Upload files

to unlock.
```

This reinforces our graceful degradation principle.

---

# Component 12

## Workspace Switcher

Example

```text
Current Workspace

July Review

▼
```

User can switch

Annual Review

Quarterly Review

Board Review

etc.

---

# Component 13

## Notes Panel

Every dashboard should allow notes.

Example

```text
Observation

Health declined in APGB.

Action

Meeting with Regional Head.

Expected Completion

15 Aug.
```

Imagine returning next month and seeing those notes in context.

---

# Dashboard Layout

Every dashboard should follow one visual rhythm.

```text
--------------------------------------------------

Title

Context

Filters

--------------------------------------------------

KPI Cards

--------------------------------------------------

Insights

--------------------------------------------------

Opportunities

--------------------------------------------------

Charts

--------------------------------------------------

Leaderboards

--------------------------------------------------

Detailed Analysis

--------------------------------------------------

Recommendations

--------------------------------------------------
```

Every screen.

Same rhythm.

Users learn once.

---

# Icons

Keep them simple.

```text
🏠 Home

🏦 Bank

🏢 Branch

👤 RM

📈 Growth

🔄 Renewal

❤️ Health

📦 Products

💰 Profitability

⚙ Settings
```

No decorative icons.

Only meaningful ones.

---

# Theme Support

I think Banc360 should support:

* Light Theme (default for corporate users)
* Dark Theme (optional for long analysis sessions)

All colors should come from CSS variables so themes are easy to maintain.

---

# Accessibility

Even for an internal platform, we'll build with accessibility in mind:

* High contrast ratios.
* Keyboard navigation.
* Visible focus states.
* Scalable fonts.
* Color is never the only indicator of status.

This improves usability for everyone.

---

# A New Concept I'd Like to Introduce: Insight Cards

After thinking through everything we've designed, I believe Banc360 needs a UI element that doesn't exist in most dashboards.

Most dashboards have:

* KPI Cards.
* Charts.
* Tables.

I think Banc360 should introduce **Insight Cards**.

An Insight Card isn't a chart.

It isn't a KPI.

It is a business conclusion generated from the analytics.

For example:

> **Insight**
>
> Health premium grew **18%** this month.
>
> 72% of the increase came from **Indian Bank South Zone**.
>
> The top five contributing branches accounted for **₹1.2 crore** of the growth.

Below that:

> **Suggested Action**
>
> Replicate the campaign in Karnataka Bank's South Zone.
>
> **Estimated Opportunity:** ₹65 lakh.

These cards become the bridge between analytics and action. They will eventually be generated by the Strategy Engine (and later by AI), but the UI can support them from the very first version.

---

# Where We Stand

We have now completed what I would consider the **Product Design Phase**:

* ✅ Product Vision.
* ✅ Enterprise Architecture.
* ✅ Data Model.
* ✅ KPI Framework.
* ✅ UX Architecture.
* ✅ Visual Design System.

At this point, I would normally begin implementation.

However, because Banc360 is intended to be a long-term strategic platform rather than a prototype, I recommend one final planning milestone before writing code:

## Phase 0.7 – Development Blueprint & Implementation Plan

This will answer questions such as:

* What are the exact files we'll create?
* Which modules are built first?
* What does the first runnable version contain?
* How will we test each phase?
* What constitutes "done" for each milestone?
* Which features are deferred?
* How do we manage versioning and future enhancements?

Once that blueprint is complete, we'll move into **Phase 1**, where we start building the actual HTML, CSS, and JavaScript project with confidence that every file has a clear purpose and every line of code supports the architecture we've designed.

---

## One Suggestion That Will Make Our Collaboration Much Easier

At this point, we've created the equivalent of **40–60 pages of architecture** across our conversations.

As the project grows, scrolling through chat history will become impractical.

I recommend that we now create a **living Banc360 Blueprint** (a structured design document) and maintain it as the canonical reference. As we make decisions, we'll update that document rather than relying on earlier chat messages.

From then on:

* The **Blueprint** defines the product.
* The **Codebase** implements the Blueprint.
* Our conversations focus on new decisions and refinements.

I think this will make Banc360 feel like a professionally managed software product rather than a long chat thread, and it will save us a tremendous amount of time as we move into implementation.
