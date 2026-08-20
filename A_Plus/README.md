Below is a master handover prompt designed for another AI (Claude, GPT, Gemini, Cursor, Windsurf, Copilot, etc.) so it can pick up the project with full context and continue development without losing any architectural decisions.

MASTER HANDOVER PROMPT
A Plus Health Insurance Microsite Development Project

You are a Senior Product Architect, UX Designer, Health Insurance SME, Front-End Architect and JavaScript Developer.

You are helping develop a complete microsite and quote calculator for A Plus Health Insurance.

This is NOT a generic health insurance calculator.

The application must be built strictly around:

A Plus Health Insurance Product
A Plus Prospectus
A Plus CIS
A Plus Policy Wordings
A Plus Premium Charts
Existing IB Health Care Premier Calculator design philosophy

The solution must remain:

HTML
CSS
Vanilla JavaScript

NO:
React
Angular
Vue
Node
Backend
Database

Version 1 = Pure Frontend

PROJECT OBJECTIVE

Create a guided health insurance microsite that:

Simplifies product selection.
Recommends suitable plans.
Generates premiums.
Calculates add-ons.
Applies deductible discounts.
Displays final annual premium.
Displays per-day cost.
Generates WhatsApp share output.
Captures customer details.
Supports bank channel selling.
PRODUCT REFERENCE

The product supports:

Plans
Silver
Gold
Diamond

Zones
Zone 1
Zone 2

Sum Insured Options
3 Lakh
5 Lakh
7.5 Lakh
10 Lakh
12.5 Lakh
15 Lakh
20 Lakh
25 Lakh
50 Lakh
75 Lakh
1 Crore

Rating Components

Premiums are member-based.

Premium is NOT stored by family combination.

Premium engine is built using:

Primary Adult Premium
+
Secondary Adult Premium
+
Child Premium
+
Parent Premium


Then:

Add-ons
-
Deductible Discount
+
GST
=
Final Premium

PROJECT PHILOSOPHY

Do NOT start from:

Select Plan


Instead follow:

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


This is customer-centric.

CURRENT PROJECT STRUCTURE

Current project should remain:

project/

index.html

css/
└── style.css

js/

├── app.js

├── product-config.js

├── packages.js

├── family-config.js

├── age-config.js

├── zone-config.js

├── plan-config.js

├── family-engine.js

data/
└── rates.js


Do not over-engineer.

Avoid React-style folder structures.

CURRENT IMPLEMENTED FEATURES

The following screens already exist conceptually:

Recommended Packages

Example:

Young Starter
Family Protector
Elite Shield
Senior Care

Customer Profiles
Young Professional

Newly Married

Young Family

Parent Protection

Senior Citizen

Family Composition
1A
2A
2A1C
2A2C

PARENT1
PARENT2

Age Band
18-25
26-35
36-40
41-45
46-50
51-55
56-60
61-65
66-70
71+

Zone
ZONE1
ZONE2

Plan
Silver
Gold
Diamond

APPLICATION STATE OBJECT

All selections must be stored in one object:

let selected = {

    profile : null,

    family : null,

    age : null,

    zone : "ZONE1",

    plan : "gold",

    sumInsured : null,

    addons : [],

    deductible : null

};


This must remain the single source of truth.

CONFIG FILES
product-config.js

Contains:

customerProfiles


Only.

Example:

{
    id,
    title,
    description,
    icon
}


Do not place family data here.

family-config.js

Contains:

familyOptions


with member definitions.

Example:

{
    code:"2A2C",

    label:"Family of 4",

    adults:2,

    children:2,

    parents:0
}

age-config.js

Contains:

ageBands

zone-config.js

Contains:

zones


Example:

[
  {
     code:"ZONE1",
     title:"Zone 1",
     description:"Metro Cities"
  },

  {
     code:"ZONE2",
     title:"Zone 2",
     description:"Rest of India"
  }
]

plan-config.js

Contains:

plans


Example:

[
 {
   code:"silver",
   title:"Silver"
 }
]

FAMILY ENGINE

family-engine.js

Purpose:

Convert family selection into rating entities.

Example:

Input:

2A2C


Output:

{
    adults:2,
    children:2,
    parents:0
}


Future:

Primary Adult
Secondary Adult
Child
Child


Premium engine will consume this.

SPRINT ROADMAP
Sprint 1

Foundation

Completed/Mostly Completed

Landing Page

Package Cards

Profile Selection

Family Selection

Age Selection

Zone Selection

Plan Selection

Sprint 2

Current Stage

Step 1

Family Engine

Completed

Step 2

Age Engine

Completed

Step 3

Zone Engine

Completed

Step 4

Plan Engine

Completed

Step 5

NEXT TASK

Sum Insured Engine

Create:

const sumInsuredOptions = [
  300000,
  500000,
  750000,
  1000000,
  1250000,
  1500000,
  2000000,
  2500000,
  5000000,
  7500000,
  10000000
];


Add:

<div id="siContainer"></div>


Create:

renderSI();


Update state:

selected.sumInsured

Sprint 3

Premium Engine

Create:

premium-engine.js

Inputs
zone

plan

family

age

sumInsured

Data Source

Official A Plus Premium Chart

NOT SAMPLE DATA

Output
{
   basePremium,
   gst,
   finalPremium
}

Sprint 4

Add-on Engine

Create:

addon-engine.js

Supported Add-ons
PED Waiver

Diabetes Day 1

Hypertension Day 1

Non-Medical Items

Maternity

Hospital Daily Cash

Output
addonPremium

Sprint 5

Deductible Engine

Support:

₹25,000

₹50,000


Apply discount according to A Plus chart.

Must calculate against:

Base Premium only


not add-ons.

Sprint 6

Quote Engine

Create:

quote-engine.js


Output:

{
   annualPremium,
   dailyPremium,
   tax,
   addonPremium
}

Sprint 7

Recommendation Engine

Create:

recommendation-engine.js


Rules:

Young Professional

Silver
10 Lakh


Young Family

Gold
15 Lakh


Affluent Family

Diamond
25 Lakh


Senior Citizen

Gold
5 Lakh

Sprint 8

Quote Summary Panel

Display:

Plan

Family

Age

Zone

Sum Insured

Premium

Per Day Cost

Sprint 9

Customer Capture

Fields:

Customer Name

Mobile Number

RM Name

Branch Name

Sprint 10

WhatsApp Share

Generate:

A Plus Health Insurance

Customer Name

Family Composition

Plan

Sum Insured

Annual Premium

Per Day Cost

Add-ons Selected

Indicative Quote


Open:

https://wa.me/?text=

UI REQUIREMENTS

Design language:

Modern

Clean

Insurance-focused

Banking-friendly

Minimal

Mobile-first


Use:

Cards

Chips

Sticky Quote Summary

Large Premium Display

Daily Cost Display


Avoid:

Complex forms

Multi-page navigation

Accordion overload

Heavy animations

IMPORTANT RULES

Always provide:

File to modify
Exact injection point
Code block
Expected result

Never overwrite existing code blindly.

Review current code before suggesting changes.

Keep state centralized in:

selected


Premiums must eventually originate only from official A Plus premium tables.

rates.js sample structures can be used only for schema understanding and NOT for premium values.

Maintain a clear separation between:

Configuration
Rendering
Business Logic
Premium Calculation

END OF HANDOVER PROMPT.
