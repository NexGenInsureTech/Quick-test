Recommended Structure 

## Phase 1 implementation status

The current offline browser application uses the following active layers:

- `js/config.js`: branch-universe totals, thresholds, fiscal months, CSV definitions, and bank aliases.
- `js/utilities.js`: shared CSV, formatting, normalization, aggregation, and branch-metric helpers.
- `js/core.js`: in-memory application state, CSV validation/normalization, month and bank filters, and the central refresh pipeline.
- `js/performance.js`: Performance MIS KPI, monthly-business, and contribution-table rendering.
- `app.js`: application shell navigation.
- `js/activation.js`: Activation Intelligence rendering for the current filtered scope.

All CSV processing remains local in the browser. Mandatory upload columns are validated before data is rendered; optional Zone, State, IMD, business type, product, and day fields are retained when supplied. Branch aggregation uses the canonical `BANK + BRANCH NAME` identity.

Phase 2 adds Performance MIS KPIs for YTD/MTD premium, records, partner institutions, active RMs, active branches, and active IMDs. It also adds premium contribution percentages for Bank, RM, and LOB views.

Phase 3 consolidates the Activation Cockpit in `js/activation.js`. It uses shared bank-plus-branch metrics to render maturity bands, observed-branch activation KPIs, near-active opportunities, configured-universe bank activation, and observed zone/state activation for the current filter scope.

Phase 4 adds `js/scorecard.js`, which provides a transparent management scorecard using the same filtered data and canonical branch metrics. It keeps configured branch universe distinct from observed branch records and applies the documented HIGH/MEDIUM/LOW/NO DATA priority rules.

BancaTracker_Enterprise_v8
│
├── index.html
├── style.css
│
├── js
│   ├── core.js
│   ├── performance.js
│   ├── activation.js
│   ├── scorecard.js
│   ├── config.js
│   └── utilities.js
│
└── data

AI PROMPT

The master handover document that can be given to any AI, developer, Copilot, Claude, Gemini, Cursor, Windsurf, VS Code Cline, or software team.

This captures:

Business objective
Architecture
Current state
Future roadmap
PR Data schema
App structure
Branch definitions
Activation definitions
Dashboard requirements
Technical constraints
Development philosophy
BancaTracker Enterprise
Master Product Definition & Development Prompt
1. Product Vision

Build a browser-based offline Bancassurance Management Operating System.

The application should allow:

Head - Bancassurance
National Teams
Zone Heads
State Heads
Relationship Managers


to monitor and drive:

Premium Growth
Branch Activation
RM Productivity
Bank Performance
Zone Performance
State Performance
Business Mobilization


The application should run entirely client-side.

No backend.

No database.

No internet.

Just:

HTML
CSS
Vanilla JavaScript


using uploaded PR Data CSV files.

2. Technical Requirements
Technology
HTML5
CSS3
Vanilla JavaScript


No:

React
Angular
Vue
Node
Backend APIs
External Libraries

Performance

Must support:

200,000+
500,000+


records.

Target:

CSV Upload
↓
In-memory Fact Table
↓
All analytics built from memory

3. Application Structure
Current Folder Structure
BancaTracker Enterprise

index.html

style.css

app.js

js/activation.js

Architectural Principle
app.js

Frozen Core Module

Responsible for:

CSV Upload

Month Filter

KPI Cards

Monthly Business

Bank Dashboard

RM Dashboard

LOB Dashboard

Activation Cockpit v1

js/activation.js

New Features Only

Responsible for:

Opportunity Branches

Zone Activation

State Activation

Advanced Branch Bands

Future Activation Modules


Future development should primarily happen here.

Avoid disturbing app.js.

4. Master Reference Data
Branch Universe

Hardcoded initially.

const TOTAL_BRANCHES = {

    "INDIAN BANK": 6022,

    "INDIAN OVERSEAS BANK": 3561,

    "KARNATAKA BANK": 977,

    "ODISHA GRAMEEN BANK": 1000,

    "TAMIL NADU GRAMA BANK": 674,

    "OTHER": 75
}


Future:

config.json

5. PR Data Schema

The actual CSV cannot leave the organisation.

Use this schema.

Mandatory Columns
USGI NET PREMIUM


Numeric.

Premium amount.

Month


Example:

Apr-26
May-26
Jun-26

INTERMEDIARY


Bank Name.

Examples:

INDIAN BANK

INDIAN OVERSEAS BANK

KARNATAKA BANK

ODISHA GRAMEEN BANK

TAMIL NADU GRAMA BANK

BA NAME


RM Name.

Ba Code


Unique RM code.

Preferred identifier.

LINE OF BUSINESS


Examples:

Motor
Health
Fire
Marine
Misc

BRANCH NAME


Branch Identifier.

Used for:

Branch Activation
Branch Opportunity
Branch Bands

Recommended Additional Fields

Already planned.

Zone

STATE

SUM IMD CODE

Business Type Fresh Renewal

PRODUCT NAME

PRODUCT CODE

Day


For future day-wise activation tracking.

6. Fact Model

Every uploaded row should become:

{
    premium,
    month,
    bank,
    rm,
    baCode,
    lob,
    branch,
    zone,
    state,
    imd,
    businessType
}


Stored in:

factData[]

7. Current Dashboard
Performance MIS

Purpose:

What happened?

Current KPIs

Target KPI Set

YTD Premium

MTD Premium

Policies

Partner Institutions

Active RMs

Active Branches

Active IMDs

Monthly Business

Render as cards.

Example:

Apr-26
4.91 Cr

May-26
2.69 Cr


Horizontal.

Not tables.

Bank Dashboard

Show:

Bank

Premium

Contribution %

RM Dashboard

Show:

RM

Premium


Future:

Branches

Products

Policies

LOB Dashboard

Show:

LOB

Premium

8. Activation Cockpit

Purpose:

What should we do tomorrow?

Active Branch Logic

Definition:

Premium >= 25000


Branch becomes active.

Near Active Logic

Definition:

15000 <= Premium < 25000


Highest-priority opportunity.

Branch Maturity Bands
Zero

1 - 14.9K

15K - 24.9K

25K - 49.9K

50K - 99.9K

1L - 1.99L

2L+

Current Activation Components
Branch Maturity Pyramid

Shows:

Band

Branch Count

Near Active Branches

Shows:

Bank

Near Active Branch Count

Bank Activation %

Shows:

Bank

Active Branches

Total Branches

Activation %

9. Opportunity Branch Dashboard

Status:

Planned / Under Implementation


Definition:

15,000 ≤ Premium < 25,000


Display:

Branch

Bank

Current Premium

Gap To 25K


Sort:

Lowest Gap First


Purpose:

Mobilization Dashboard


Most actionable report.

10. Zone Activation Dashboard

Uses:

Zone


Display:

Zone

Premium

Active Branches

Activation %

11. State Activation Dashboard

Uses:

State


Display:

State

Premium

Active Branches

Activation %

12. Future Roadmap
Version 7.1
Partner Institutions KPI

Active Branch KPI

Active IMDs KPI

Zone field

State field

IMD field

Version 7.2
Opportunity Branches

Zone Activation

State Activation

Advanced Branch Bands

Version 7.3
Bank Scorecard

Near Active Branches

Opportunity Scorecard

Version 7.4
RM Productivity

IMD Productivity

Version 7.5
Zero Reduction Tracker

New Activations

Branch Upgrade Tracker

Version 8
Target vs Actual

Achievement %

Gap

RRR

Target Upload

13. Future High-Value Features
Daily Branch Activation

Using:

Day


Track:

Yesterday Active

Today Active

Net Activation

Zero Reduction

Track:

Yesterday Zero

Today Zero

Reduction

Branch Upgrade Tracker

Track movement:

0

→

1-14.9K

15-24.9K

→

25-49.9K


etc.

Top Movers

Show:

Top New Branch Activations

Top RM Growth

Top State Growth

Top Zone Growth

14. Development Philosophy
Rule 1

Do not break:

app.js


unless fixing bugs.

Rule 2

All new business modules go into:

js/activation.js


or future feature files.

Rule 3

Prefer:

New Modules


over massive refactors.

Rule 4

BancaTracker is not a reporting dashboard.

It is:

A Bancassurance Management Operating System


focused on:

Activation

Mobilization

Productivity

Growth


for National, Zone, State and RM teams.

This document should give any AI or developer enough context to continue development without access to the actual PR Data file.
