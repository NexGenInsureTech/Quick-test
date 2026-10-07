You are a Senior Enterprise UX Architect, Lead Frontend Engineer, Insurance Domain SME, and Bancassurance Solution Architect.

Your task is to design and generate a COMPLETE production-ready frontend prototype for:

PNB × Universal Sompo
Digital Insurance Enrollment Platform

=====================================================
OBJECTIVE
=====================================================

Build a customer onboarding journey for insurance products sold through PNB branches and digital channels.

The application must support:

1. Group Credit Protection (GCP)
2. Group Health Insurance (GHI)
3. Bharat Griha Raksha (BGR)

The customer MUST be able to purchase multiple products in a single journey.

Examples:

✓ GCP only

✓ GCP + GHI

✓ GCP + BGR

✓ GCP + GHI + BGR

The journey should dynamically reveal sections based on selected products.

=====================================================
CRITICAL UI REQUIREMENT
=====================================================

DO NOT redesign the UI.

Maintain a modern banking customer journey.

Visual language:

- White cards
- Soft shadows
- Border radius
- Clean typography
- Mobile-responsive
- Single-page application feel
- Progressive disclosure
- Professional insurance onboarding experience

Theme:

Primary Color:
#005baa

Accent:
#f89b1c

Success:
#16a34a

Background:
#f6f8fb

Cards:
White
12px radius

Font:
Segoe UI

=====================================================
APPLICATION ARCHITECTURE
=====================================================

Generate a complete codebase:

project/

index.html

css/
  styles.css
  components.css
  print.css

js/
  app.js
  products.js
  ckyc.js
  premium.js
  signature.js
  consent.js
  documents.js
  review.js
  storage.js

config/
  api-config.js
  master-policies.js
  premium-rates.js

README.md

=====================================================
STEPPER / PROGRESS TRACKER
=====================================================

Display a professional progress tracker:

1 Customer & KYC

2 Loan Context

3 Products & Coverage

4 Insured Members

5 Nominee

6 Premium & Payment

7 Documents

8 Consent & Signature

9 Review & Submit

=====================================================
SECTION 1
CUSTOMER IDENTIFICATION
=====================================================

Capture:

PNB CIF

PAN Number

AADHAAR Number

Mobile Number

Display button:

FETCH CUSTOMER

=====================================================
CKYC FETCH
=====================================================

Include API placeholder.

API endpoint example:

POST /api/ckyc/search

Request:

{
  pan:"",
  aadhaar:"",
  cif:""
}

Response:

{
  customerName:"",
  mobile:"",
  email:"",
  dob:"",
  ckycNumber:"",
  address:""
}

Populate all customer fields.

Fields must remain editable.

Display:

✓ CKYC Retrieved

=====================================================
SECTION 2
LOAN CONTEXT
=====================================================

Collect:

Loan Type

- Home Loan
- Vehicle Loan
- Personal Loan
- Business Loan
- LAP

Loan Amount

Outstanding Amount

EMI

Loan Tenure

Branch

Account Number

=====================================================
SECTION 3
PRODUCT SELECTION
=====================================================

MUST SUPPORT MULTIPLE PRODUCTS.

Use checkbox cards.

Example:

☑ Group Credit Protection

☑ Group Health Insurance

☐ Bharat Griha Raksha

Selection must dynamically control all further sections.

=====================================================
MASTER POLICY CONFIGURATION
=====================================================

Customer never enters master policy information.

Load automatically from config.

Example:

const MASTER_POLICIES = {

GCP:{
 code:"PNB_GCP",
 masterPolicy:"USGI-GCP-001"
},

GHI:{
 code:"PNB_GHI",
 masterPolicy:"USGI-GHI-001"
},

BGR:{
 code:"PNB_BGR",
 masterPolicy:"USGI-BGR-001"
}

};

=====================================================
SECTION 4
INSURED MEMBERS
=====================================================

Default:

☑ Use Proposer as Primary Insured

Auto-copy proposer information.

Allow:

+ Add Co-Borrower

+ Add Family Member

For each member:

Name

DOB

Relationship

ABHA ID

Contact Number

Sum Insured

Create modern card layout.

=====================================================
SECTION 5
PRODUCT SPECIFIC PANELS
=====================================================

ONLY display selected product panels.

-------------------------------------
GCP PANEL
-------------------------------------

Outstanding Loan

Cover Type

- Reducing
- Fixed

Tenure

-------------------------------------
GHI PANEL
-------------------------------------

Medical Questionnaire

Diabetes

Hypertension

Cardiac

Cancer

Kidney Disease

Hospitalization

Medication

If any answer = Yes

Display:

Provide Medical Details

-------------------------------------
BGR PANEL
-------------------------------------

Property Address

Construction Value

Contents Value

Carpet Area

Optional Covers:

Debris Removal

EMI Protection

Purchase Protection

PA Cover

Garden Cover

Utility Cover

=====================================================
SECTION 6
NOMINEE
=====================================================

Nominee Name

Relationship

DOB

Share %

Address

If nominee age < 18

Display

Appointee Name

Appointee Relationship

=====================================================
SECTION 7
PREMIUM ENGINE
=====================================================

DO NOT ask customer to enter premium.

Create premium calculation area.

Add button:

CALCULATE PREMIUM

Include API placeholder:

POST /api/premium/calculate

Mock values:

GCP Premium
₹6500

GHI Premium
₹4200

BGR Premium
₹2000

GST
₹2286

TOTAL
₹14986

Create attractive Premium Summary card.

=====================================================
SECTION 8
DOCUMENT CENTER
=====================================================

Upload cards for:

PAN

AADHAAR

Photograph

Income Proof

Loan Sanction Letter

Property Photograph

Drag-and-drop support.

Preview uploaded files.

=====================================================
DOCUMENT API PLACEHOLDER
=====================================================

POST /api/documents/upload

Multipart payload

=====================================================
SECTION 9
CONSENT HUB
=====================================================

Create grouped consent cards.

KYC & AML

✓ CKYC Verification

✓ AML Declaration

Communication

✓ SMS

✓ Email

✓ WhatsApp

Policy Delivery

✓ Digital Policy

Declaration

✓ Terms Accepted

=====================================================
SECTION 10
CONSENT METHOD
=====================================================

Radio options:

OTP

Digital Signature

Physical Signature

------------------------------------
OTP
------------------------------------

Mobile

Send OTP

Verify OTP

------------------------------------
Digital Signature
------------------------------------

Canvas Signature Pad

Clear Button

Save Signature

------------------------------------
Physical Signature
------------------------------------

Print Proposal

Upload Signed Document

=====================================================
SECTION 11
SAVE DRAFT
=====================================================

Implement:

localStorage save

localStorage restore

Buttons:

Save Draft

Load Draft

=====================================================
SECTION 12
REVIEW PAGE
=====================================================

Before submit show:

Customer Details

Loan Context

Selected Products

Members

Nominee

Premium

Uploaded Documents

Consent Status

Signature Status

=====================================================
SECTION 13
SUBMISSION
=====================================================

Submit Application

API Placeholder:

POST /api/application/submit

Generate:

Application Number

Example:

APP202600001

=====================================================
PRINT REQUIREMENTS
=====================================================

Create print stylesheet.

Hide buttons.

Show application summary.

Show premium breakdown.

Show declarations.

Show signature area.

A4 optimized.

=====================================================
RESPONSIVE REQUIREMENTS
=====================================================

Desktop

Tablet

Mobile

Fully responsive.

=====================================================
ACCESSIBILITY
=====================================================

Keyboard friendly.

ARIA labels.

High contrast.

Form validation.

=====================================================
DELIVERABLES
=====================================================

Generate:

1. Full codebase
2. Folder structure
3. Complete HTML
4. All CSS
5. All JavaScript
6. API integration placeholders
7. Mock API responses
8. README
9. Run Instructions
10. Future Integration Notes

The UI should feel like a modern banking onboarding application similar to premium fintech and insurance enrollment platforms.



IMPORTANT:

Preserve a premium banking onboarding experience.

Prioritize:
- Simplicity
- Conversion
- Mobile usage
- Bancassurance sales journeys
- PNB branch operations
- Insurance compliance
- Minimal customer data entry

Use progressive disclosure.

Do not overwhelm the customer.

Most information should be auto-populated from CKYC, CIF, and configured master policies whenever possible.
