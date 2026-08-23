# A Plus Health Insurance Microsite

A guided A Plus Health Insurance microsite and frontend quote calculator built with HTML, CSS, and Vanilla JavaScript.

The application runs locally in the browser. Premium lookup, optional-cover pricing, deductible adjustment, quote composition, recommendation presentation, customer validation, and WhatsApp message generation are client-side. There is no backend or database.

## Customer journey

```text
Customer Profile
→ Recommendation
→ Package Exploration
→ Family Composition
→ Member Ages
→ Zone
→ Plan
→ Sum Insured
→ Optional Covers
→ Aggregate Deductible
→ Quote
→ Customer Details
→ WhatsApp Share
```

Customer Profile and Recommendation are optional guidance. A quote can be built manually without choosing a profile. A recommendation changes Plan and Sum Insured only after the customer explicitly selects **Apply Recommendation**.

## Technology and runtime

- HTML, CSS, and Vanilla JavaScript
- Frontend-only, local/client-side calculation
- No framework, build system, backend, or database

Core quote calculation has no external runtime dependency. WhatsApp sharing requires explicit navigation to WhatsApp's web composer.

## Project structure

```text
A_Plus/
├── aplus_microsite.html
├── README.md
├── AGENTS.md
├── css/style.css
├── data/PREMIUM_RATES.md
└── js/
    ├── app.js
    ├── product-config.js
    ├── packages.js
    ├── family-config.js
    ├── family-engine.js
    ├── age-config.js
    ├── zone-config.js
    ├── plan-config.js
    ├── sum-insured-config.js
    ├── recommendation-config.js
    ├── recommendation-engine.js
    ├── rates.js
    ├── premium-engine.js
    ├── addon-config.js
    ├── product-rules.js
    ├── addon-rates.js
    ├── addon-engine.js
    ├── deductible-config.js
    ├── deductible-rates.js
    ├── deductible-engine.js
    ├── quote-engine.js
    ├── presentation-utils.js
    ├── customer-form.js
    └── share.js
```

## JavaScript responsibilities

| File | Responsibility |
|---|---|
| `product-config.js` | Customer Profile definitions |
| `packages.js` | Non-interactive package presentation definitions and stable IDs |
| `family-config.js` | Supported family compositions and member counts |
| `family-engine.js` | Creates individual rating members from a family composition |
| `age-config.js` | Allowed age bands by member type |
| `zone-config.js` | Implemented rating zones and labels |
| `plan-config.js` | Silver, Gold, and Diamond definitions |
| `sum-insured-config.js` | Eleven canonical numeric Sum Insured values |
| `recommendation-config.js` | Approved UX-guided recommendation rules |
| `recommendation-engine.js` | Validates profiles and configured recommendation outputs |
| `rates.js` | Member-based Base Cover premium tables |
| `premium-engine.js` | Exact member-rate lookup and Base Premium aggregation |
| `addon-config.js` | Optional-cover display definitions and pricing types |
| `product-rules.js` | Authoritative optional-cover plan, age, target, and pricing-readiness rules |
| `addon-rates.js` | Optional-cover rate tables derived from the product premium chart |
| `addon-engine.js` | Optional-cover validation, member targeting, and premium aggregation |
| `deductible-config.js` | Supported Aggregate Deductible choices |
| `deductible-rates.js` | Sum-Insured-specific deductible discount schedule |
| `deductible-engine.js` | Calculates the Base Premium discount and adjusted Base Premium |
| `quote-engine.js` | Validates composition, applies current tax treatment, and returns `FINAL_READY` |
| `presentation-utils.js` | Stateless currency, daily-cost, Sum Insured, and member-label presentation helpers |
| `customer-form.js` | Customer validation, mobile normalization, field binding, and validation-message DOM |
| `share.js` | Pure WhatsApp message construction, using `ProductRules` to filter optional covers, and generic composer URL construction |
| `app.js` | Central state, rendering, cross-feature orchestration, quote lifecycle, share readiness, and initialization |

## State model

Three application-level concepts remain separate.

### `selected`

Customer, product, and rating selections:

```js
{
  profile: null,
  family: null,
  age: null,
  members: [],
  zone: null,
  plan: null,
  sumInsured: null,
  addons: [],
  deductible: null
}
```

`members` contains individual rating entities with independent age bands. `age` is a lead-member compatibility field and is not used by `PremiumEngine`.

### `customerDetails`

Customer/RM quote context, kept outside rating state:

```js
{
  customerName: "",
  mobileNumber: "",
  rmName: "",
  branchName: ""
}
```

Customer Name and valid Indian mobile are required for share readiness. RM and Branch are optional. These fields do not affect premium.

### `currentQuote`

The latest successful derived `FINAL_READY` quote, or `null` while pending or unavailable. It is cleared before recalculation to prevent stale sharing.

`currentQuoteDecision` is separate derived runtime output from `QuoteDecisionEngine`. It is also cleared before every recalculation and is never stored in `selected`.

Monetary outputs and share readiness are derived and are not stored in `selected`.

## Premium flow

```text
Family + member ages + Zone + Plan + Sum Insured
→ PremiumEngine
→ Base Premium

Selected online-calculable optional covers
→ AddonEngine
→ Add-on Premium

Base Premium + Sum Insured + Aggregate Deductible
→ DeductibleEngine
→ Deductible Discount
→ Adjusted Base Premium

Premium components + current tax treatment
→ QuoteEngine
→ FINAL_READY quote

Calculated quote + selected optional covers
→ QuoteDecisionEngine
→ STP / UW_REFERRAL / ASSISTED_ONLY
```

```text
Adjusted Base Premium = Base Premium − Deductible Discount
Final Premium = Adjusted Base Premium + Add-on Premium + Tax
```

Current implemented tax treatment is `EXEMPT`, labelled **GST Exempt**, with amount ₹0. Approximate daily cost is presentation-only and uses `Math.round(finalPremium / 365)`.

`QuoteEngine` remains the authority for arithmetic composition. `QuoteDecisionEngine` determines the operational and customer-facing status above that arithmetic:

- `STP` — no underwriting-referral trigger is identified from information currently captured by the microsite. This does not mean insurer acceptance.
- `UW_REFERRAL` — the calculated premium is indicative and underwriting review is required.
- `ASSISTED_ONLY` — online pricing or assessment is incomplete, so a complete premium is unavailable.

Decision precedence is `ASSISTED_ONLY` over `UW_REFERRAL` over `STP`. All current decisions return `paymentReady: false`; the microsite does not collect payment or complete proposal acceptance, underwriting, or policy issuance.

## Rate data

Calculations consume repository rate tables derived from the official A Plus premium chart. Calculation code and rate data remain separate:

- `rates.js` — member-based Base Cover rates
- `addon-rates.js` — optional-cover rate tables
- `deductible-rates.js` — deductible discount schedule
- `data/PREMIUM_RATES.md` — repository premium-chart evidence

Engines use exact Zone, Plan, member type, age band, and numeric Sum Insured lookup. There is no interpolation or nearest-band fallback.

## Optional covers

Online-calculable:

- Diabetes Day 1 — Diamond only, age 18+, selected per insured member; calculable as an indicative premium with underwriting referral
- Hypertension Day 1 — Diamond only, age 18+, selected per insured member; calculable as an indicative premium with underwriting referral

No premium impact:

- Room Rent Modification — Silver, Gold, and Diamond; ₹0 additional premium

Assisted quotation / blocked for online pricing:

- PED Waiting Period Waiver
- Maternity
- Non-Medical Items

These remain represented as product options and produce an `ASSISTED_ONLY` decision when evaluated directly. Online pricing is intentionally unavailable because their required aggregation or rating basis remains unresolved in the implemented model.

Optional-cover eligibility is governed by `ProductRules`. Rate-table availability does not establish product eligibility; rates are read only after the relevant product rule and input validations pass.

The UI presents selections, while calculation engines retain rate lookup and aggregation responsibilities. `ShareHelpers` constructs presentation output and queries `ProductRules` only when filtering optional covers.

## Aggregate Deductible

Supported choices are No Deductible, ₹25,000, and ₹50,000. The SI-specific discount applies to Base Premium only; Add-on Premium is not discounted.

## UX recommendations

| Customer Profile | Suggested Plan | Suggested Sum Insured |
|---|---|---:|
| Young Professional | Silver | ₹10 Lakh |
| Young Family | Gold | ₹15 Lakh |
| Senior Citizen | Gold | ₹5 Lakh |
| Newly Married | No configured recommendation | — |
| Parent Protection | No configured recommendation | — |

These are UX-guided suggestions, not product eligibility, underwriting, or coverage rules. Manual Plan and Sum Insured selection remains available.

## Customer details and WhatsApp

Share readiness requires a `FINAL_READY` quote, an `INDICATIVE` quote decision, Customer Name, and a valid normalized ten-digit Indian mobile number. Both `STP` and `UW_REFERRAL` quotes can be shared; referral messages include underwriting wording.

WhatsApp sharing:

- Is explicitly user-triggered.
- Uses the generic `https://wa.me/?text=...` composer.
- Does not address the message to the captured customer mobile.
- Does not include that mobile number in the message.
- Generates fresh output from current selections, `currentQuote`, and explicit decision metadata.
- Does not recalculate premium.
- Does not submit customer data to a backend.

## Current limitations and open questions

- PED Waiver online premium aggregation remains unresolved.
- Maternity online aggregation and rating-age basis remain unresolved.
- Non-Medical Items online aggregation and rating-age basis remain unresolved.
- Customer-facing terminology for a `firstAdult` in the `0-17` band requires product-owner clarification; current rate/configuration behavior is preserved.
- Exact customer-facing geographic definitions for Zone 1 and Zone 2 require an authoritative product source; current configuration labels are preserved.
- No backend or lead storage.
- No persistence.
- No PDF generation.
- No CRM integration.
- No OTP or mobile verification.

### Deferred assisted / underwriting journey

Senior and other underwriting-sensitive or non-straight-through cases are intentionally deferred from the current MVP. No generic age-over-65 rejection rule has been implemented.

The existing premium-table age bands remain unchanged. The availability of a rating-table age band must not be treated as equivalent to eligibility for a straight-through quotation.

A future Assisted / Underwriting Journey must use authoritative product and underwriting rules to determine:

- Exact-age requirements.
- Straight-through versus underwriting-referral criteria.
- New-business versus renewal treatment, where applicable.
- Medical and underwriting requirements.
- Senior and other non-standard case handling.
- RM, branch, and underwriter hand-off.
- Maximum fresh-entry ages for relevant insured-member relationships.

The unresolved interpretation of `firstAdult / 0-17` remains a separate product question. It is not resolved by this deferred-scope decision.

## Running locally

Open `aplus_microsite.html` in a modern browser. No installation or build command is required. WhatsApp sharing requires access to WhatsApp's external web composer.
