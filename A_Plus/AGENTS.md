# A Plus Health Insurance Microsite — Codex Instructions

## Project Purpose

This project is a guided microsite and quote calculator for A Plus Health Insurance.

It is not a generic health insurance calculator.

The implementation must remain aligned to:

- A Plus Product
- A Plus Prospectus
- A Plus CIS
- A Plus Policy Wordings
- A Plus Premium Charts
- Existing IB Health Care Premier calculator design philosophy

## Technology Constraints

Use only:

- HTML
- CSS
- Vanilla JavaScript

Do not introduce:

- React
- Angular
- Vue
- Node
- Backend services
- Databases
- Build systems unless explicitly requested

Version 1 must remain pure frontend.

## Current Project Structure

Keep the project simple.

Expected structure:

A_Plus/
├── aplus_microsite.html
├── README.md
├── AGENTS.md
├── css/
│ └── style.css
├── js/
│ ├── app.js
│ ├── product-config.js
│ ├── packages.js
│ ├── family-config.js
│ ├── age-config.js
│ ├── zone-config.js
│ ├── plan-config.js
│ └── family-engine.js
└── data/
└── PREMIUM_RATES.md

Do not introduce React-style or enterprise-style folder structures unless explicitly approved.

## Application Philosophy

The customer journey must remain:

Who Are You?
↓
Family Composition
↓
Age Band
↓
Zone
↓
Plan
↓
Sum Insured
↓
Optional Covers
↓
Quote

Do not redesign the journey to start with plan selection.

## Central Application State

All user selections must be stored in the existing centralized `selected` object.

Expected shape:

```js
let selected = {
  profile: null,
  family: null,
  age: null,
  zone: "ZONE1",
  plan: "gold",
  sumInsured: null,
  addons: [],
  deductible: null,
};
```
