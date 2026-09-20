# BancaTracker Enterprise v8.6

## Step 6B.1 — Effective-Dated Branch Eligibility Governance Contract

**Status:** Proposed governance contract; no production implementation is introduced by this step.

**Baseline:** `feature/v8.6-governance-foundation` at `736ed87022a61b51705720e8fb46ca3dc867942a`.

**Scope:** Define the future Eligible Branch Universe as-of a canonical analytical month, principally for historical Activation denominators. This document does not change runtime behaviour.

## 1. Objective

The future authority must answer one question:

> Which branches were legitimately eligible to participate in the bancassurance channel during a specified analytical period?

This is a denominator and opportunity authority. It is independent of whether a branch produced premium in that period. Its first intended analytical consumer is Activation; adoption by any other module requires a separate governance decision.

## 2. Current verified behaviour and problem

Branch Master already persists durable branch identity, `active`, `activationEligible`, `validFrom`, and `validTo`. The current Branch Master resolver and live branch-universe authority do not use the validity dates. The current governed Activation denominator is the present active and explicitly activation-eligible Branch Master snapshot; when that universe is not ready, Activation uses `config.TOTAL_BRANCHES`.

The current analytical populations are intentionally not universal:

- Current-period Branch Maturity, Near Active, and Opportunity use PR-observed analytical branches.
- Historical Branch Maturity Comparison consumes Commercial Performance branch-period rows.
- Commercial Performance is the union of resolved PR branch-periods and Branch Budget & Potential branch-periods. A reference-only row has zero Actual and `NO_ACTIVITY`.
- Branch Movement compares identities present in its two supplied maturity distributions. Absence remains distinct from zero and one-sided presence is non-comparable.

Using today's complete Branch Master as if it automatically described every historical month is unsafe. Requiring a PR transaction as proof of historical eligibility is also unsafe. Eligibility must be governed independently of production.

## 3. Governed terminology

| Term | Governed meaning |
| --- | --- |
| **Eligible Branch Universe** | Distinct governed branches eligible for the channel during the requested period. This is a denominator/opportunity concept. |
| **Observed Branch Population** | Distinct branches represented by resolved PR production or activity for the requested period. |
| **Commercial Branch Population** | Distinct branches represented by resolved PR branch-period activity or governed Branch Budget & Potential for that period. |
| **Maturity Population** | Distinct branch-period rows supplied to the applicable maturity authority. Its source depends on that authority. |

These populations are not interchangeable. Membership in the Eligible Branch Universe does not by itself create a PR, Commercial Performance, maturity, movement, Near Active, or Opportunity row.

## 4. Proposed authority and identity

The future authority is a pure period resolver over a supplied governed Branch Master context. It may expose operations equivalent to resolving eligible branches and eligible counts for a period, optionally scoped to a Bank, but this contract does not prescribe function names.

Durable identity remains:

```text
BANK_ID:BRANCH_CODE
```

A branch identity is counted at most once in one period. Branch codes with different Bank IDs remain distinct. `INDIAN BANK` and `INDIAN BANK (PMSBY)` must not be consolidated or aliased by this authority. Bank Parent/Sub-channel governance is deferred to a later v8.6 slice.

Eligibility is independent of premium value, premium sign, transaction count, Budget, Potential, target, and maturity band.

## 5. Period input and resolution

### 5.1 Accepted period

The authority accepts one canonical calendar-month key in strict `YYYY-MM` form. The key must identify a real Gregorian month. Labels such as `Aug-26`, arbitrary dates, `ALL`, fiscal-year keys, and YTD keys are not month identities and must not be silently coerced.

An invalid or missing period returns an explicit invalid-request status with no governed count. It must not fall back to the current month.

### 5.2 Month boundaries

For period `YYYY-MM`, derive:

- `periodStart`: the first calendar day of that month; and
- `periodEnd`: the last calendar day of that month.

Both validity boundaries are inclusive. A dated record overlaps the month when:

```text
(validFrom is absent or validFrom <= periodEnd)
AND
(validTo is absent or validTo >= periodStart)
```

Eligibility therefore means effective for **any portion of the selected month**.

This rule aligns the denominator with monthly management analytics: a branch legitimately eligible on any day of a month may contribute to that month's PR-observed Activation numerator. A month-end-only rule could exclude a branch that legitimately produced earlier in the month; a month-start-only rule could exclude a branch opened during the month.

Examples under the inclusive overlap rule:

- `validTo = 2026-08-31` includes Aug-26 and excludes Sep-26.
- `validFrom = 2026-09-01` excludes Aug-26 and includes Sep-26.
- `validFrom = 2026-09-30` includes Sep-26.
- `validTo = 2026-09-01` includes Sep-26.

## 6. Current ACTIVE versus historical validity

`active` remains the current operational status field. It is not silently redefined as a historical fact.

For a record with at least one valid effective-date boundary, period membership is governed by its validity interval and `activationEligible`; the current value of `active` does not veto a historically overlapping month. Consequently, a branch that is inactive today but was valid through 2026-07-31 can remain eligible for Jun-26 and must be excluded for Sep-26.

For an explicitly dated record, `active = false` with an open-ended or future-ending interval is a diagnostic inconsistency requiring data-owner review, not an implicit rewrite of either field. The future resolver must apply the declared interval deterministically and surface the inconsistency. Import validation may later choose a stronger rule only through a separately approved contract change.

For a record with both dates absent, the legacy rule in section 8 applies and current `active` remains necessary. This preserves existing undated Branch Masters without falsely claiming that their current status is effective-dated history.

## 7. Activation eligibility

Temporal validity and Activation eligibility are separate gates:

- `activationEligible = true`: the record may enter the Activation denominator when its temporal rule also passes.
- `activationEligible = false`: the record is excluded even when temporally valid.
- missing or null `activationEligible`: the record is not silently treated as eligible. The effective-dated governed universe is incomplete for the affected scope, and the authority follows the fallback/status policy in section 10.
- a malformed supplied value is an error and cannot be treated as true.

A historically valid branch can therefore be intentionally excluded from the Activation denominator. This field does not decide membership in Observed, Commercial, or Maturity populations.

## 8. Null dates and backward compatibility

Date semantics are deterministic:

| `validFrom` | `validTo` | Temporal interpretation | Provenance classification |
| --- | --- | --- | --- |
| Present | Present | Inclusive closed interval | `EXPLICIT_DATED` |
| Present | Missing | Effective from `validFrom`, open-ended after it | `EXPLICIT_OPEN_END` |
| Missing | Present | Open beginning through inclusive `validTo` | `EXPLICIT_OPEN_START` |
| Missing | Missing | Legacy undated record | `LEGACY_UNDATED` |

An open boundary is intentional effective dating when the other boundary is present. It is not the same as having no temporal evidence.

For `LEGACY_UNDATED` records, backward-compatible eligibility requires `active = true` and `activationEligible = true`. Such records may supply a denominator under a legacy assumption, but the absence of both dates means the authority cannot prove that the branch existed or was eligible in the requested historical month. The result must therefore be labelled governed legacy/undated rather than effective-dated governed. This permits existing masters to remain usable without representing today's qualifying snapshot as temporal evidence for historical membership.

Mixed datasets may contain explicit and legacy-undated records. If all other readiness conditions pass, eligible identities from both may be returned together only under a mixed/legacy-qualified authority status, never under a fully effective-dated status. Such a denominator is governed, but only some membership is supported by explicit temporal evidence; the remainder is admitted under legacy-undated assumptions. Diagnostics must separately count the two classes and the eligible identities admitted under each provenance.

No destructive migration or immediate replacement import is required. Future replacement files can progressively populate dates and improve authority quality.

## 9. Invalid ranges and malformed records

`validTo < validFrom` is a blocking Branch Master validation error for a future effective-dated contract. It must not be reversed, clipped, defaulted, or otherwise repaired silently. The malformed record is excluded from authority resolution, its finding is retained, and the dataset/scope cannot claim effective-dated readiness.

An invalid date token is likewise an error rather than an open boundary. Missing and invalid are distinct states.

An absent durable branch identity cannot enter the universe. Duplicate rows that resolve to the same branch identity and overlapping periods are ambiguous and must prevent a ready result unless a separately governed deterministic versioning rule resolves them. Non-overlapping historical rows for one durable identity may be valid, but that future row-history capability must be implemented and tested explicitly.

## 10. Authority, fallback, and status model

The result must identify both the chosen denominator and its provenance. Recommended statuses are conceptual; implementation may choose equivalent names with the same distinctions.

| Status | Meaning | Denominator behaviour |
| --- | --- | --- |
| `EFFECTIVE_DATED_GOVERNED` | Ready Branch Master; requested-period membership is supported by explicit closed or open-ended effective-date semantics, and identity, Bank, eligibility, and dates are valid. | Use the period-resolved governed count as explicitly time-supported membership. |
| `GOVERNED_LEGACY_UNDATED` | Ready legacy Branch Master with no effective dates. The denominator is governed and remains usable for backward compatibility, but requested-period historical membership is a legacy assumption and is not temporally proven. | Use current active + eligible identities, explicitly qualified as legacy-undated assumptions rather than effective-dated evidence. |
| `GOVERNED_MIXED_TEMPORAL` | Ready identities include both explicitly effective-dated and legacy-undated membership. The denominator is governed but not fully effective-dated. | Use the resolved dated records plus active + eligible undated records, while separately reporting time-supported and legacy-assumed membership. |
| `LEGACY_CONFIGURED_FALLBACK` | Branch Master is absent, not ready, eligibility is incomplete, a malformed/ambiguous record prevents resolution, Bank scope is unresolved, or the requested period cannot be resolved safely. | Use `config.TOTAL_BRANCHES` only where that legacy configuration has an exact applicable Bank/overall scope. |
| `UNAVAILABLE` | Neither a safe governed universe nor an exact legacy configured denominator exists. | Return no denominator; do not report zero. |
| `INVALID_PERIOD` | Period key is absent or invalid. | Return no denominator and do not fall back. |

Additional rules:

1. Never combine a governed count for some Banks with configured fallback counts for other Banks in one reported denominator.
2. An exact Bank-scoped request counts identities whose governed `bankId` matches that scope. Unknown or unmapped Bank identity prevents a ready Bank reconciliation and is diagnostic; it must not be silently assigned or aliased.
3. A selected period before or after explicit coverage is not automatically an error: records are excluded by their intervals. However, if the dataset has no explicit interval overlapping the requested period and no eligible legacy-undated records, the result must distinguish a valid governed count of zero from inadequate temporal coverage. Dataset-wide minimum/maximum boundary diagnostics must support that distinction. A period entirely outside known bounded coverage must fall back or be unavailable rather than assert a historically complete zero.
4. A legitimate resolved governed count of zero remains zero and is not replaced merely because it is zero.
5. Fallback provenance and reason must be visible to downstream consumers.

## 11. Activation integration boundary

The intended future monthly integration is:

- **Numerator:** unchanged PR-observed branches meeting the existing Active threshold in the selected analytical month and scope.
- **Denominator:** Eligible Branch Universe resolved for that same canonical month and compatible Bank scope.

The selected month must be passed explicitly from the existing analytical period context. The authority must not infer it from the system clock, latest upload, or current filter when an explicit analytical month exists.

`ALL`, FY, YTD, and other multi-period scopes are deferred. They must not be guessed as one month, summed across monthly universes, or deduplicated across periods without a separate definition of the management question. Until governed, those requests must resolve to an explicit unsupported-scope status or use an already approved legacy path outside this new authority.

## 12. Diagnostics

Resolution must be immutable and return diagnostics sufficient to explain the denominator:

- requested period, derived `periodStart`, and `periodEnd`;
- requested Bank scope, if any;
- authority status and fallback reason;
- total Branch Master records considered;
- distinct durable identities considered;
- eligible identity count;
- excluded before `validFrom` count;
- excluded after `validTo` count;
- excluded `activationEligible = false` count;
- missing/null activation eligibility count;
- inactive legacy-undated count;
- explicit closed, open-start, and open-end counts;
- total legacy-undated record count;
- eligible identity count admitted under legacy-undated assumptions;
- eligible identity count supported by explicit effective-date semantics;
- invalid date token and invalid range counts;
- missing/duplicate/ambiguous branch identity counts;
- unknown or unmapped Bank count;
- eligible counts by resolved Bank;
- known effective-coverage bounds and whether the request lies outside them;
- configured fallback total and by-Bank counts when evaluated;
- current-`active`/declared-interval inconsistency count.

Diagnostics must not mutate, repair, activate, or persist source records.

## 13. Reconciliation invariants

1. One durable branch identity is counted at most once per requested period.
2. Eligible counts for resolved Banks reconcile to the total eligible count in the same governed result.
3. Eligibility is independent of PR presence, premium amount, premium sign, and transaction count.
4. No date token or invalid range is silently corrected.
5. A branch whose `validFrom` is after `periodEnd` is excluded.
6. A branch whose `validTo` is before `periodStart` is excluded.
7. A historically overlapping dated branch is not excluded solely because `active` is false today.
8. `activationEligible = false` is excluded from the Activation denominator.
9. Missing, null, false, zero, and a resolved count of zero remain semantically distinct where applicable.
10. An absent PR row does not prove ineligibility, and a present PR row does not override governed ineligibility.
11. Effective-dated resolution must not create or remove rows in Maturity, Historical Maturity Comparison, Branch Movement, Commercial Performance, Near Active, or Opportunity.
12. Absence from a period remains distinct from an analytical zero unless the consuming authority explicitly materializes a zero row under its own contract.
13. Governed and configured fallback counts are not silently blended.
14. Repeated resolution over identical immutable inputs and period returns identical membership, status, and diagnostics.

## 14. Synthetic acceptance scenarios

Use fictional Bank ID `TESTBANK` unless the scenario requires a second Bank. Assume inclusive monthly overlap and valid durable identities.

| Branch | Governed inputs | Aug-26 | Sep-26 | Required assertion |
| --- | --- | ---: | ---: | --- |
| `TESTBANK:B001` | From 2026-04-01; open end; active; eligible; PR in Aug and Sep | Eligible | Eligible | PR presence does not alter eligibility. |
| `TESTBANK:B002` | From 2026-04-01; open end; active; eligible; PR in Aug only | Eligible | Eligible | Sep eligibility survives absent PR. |
| `TESTBANK:B003` | From 2026-04-01; open end; active; eligible; no PR | Eligible | Eligible | No production is required. It is not automatically a maturity Zero row. |
| `TESTBANK:B004` | From 2026-04-01 through 2026-08-31; currently inactive; eligible | Eligible | Excluded | Current inactivity does not erase Aug history; the inclusive end excludes Sep. |
| `TESTBANK:B005` | From 2026-09-01; open end; active; eligible | Excluded | Eligible | Opening-month boundary is inclusive. |
| `TESTBANK:B006` | From 2026-10-01; open end; active; eligible | Excluded | Excluded | A future branch is not pulled backward. |
| `TESTBANK:B007` | From 2026-04-01; open end; active; `activationEligible = false` | Excluded | Excluded | Temporal validity does not override explicit denominator exclusion. |
| `TESTBANK:B008` | Both dates absent; active; eligible | Eligible under legacy-qualified status | Eligible under legacy-qualified status | Backward compatibility remains usable and visibly undated. |
| `TESTBANK:B009` | From 2026-09-01 through 2026-08-31 | Error/excluded | Error/excluded | Invalid range is diagnosed and never reversed. |
| `OTHERBANK:B001` | Same branch code as `TESTBANK:B001`; valid, active, eligible | Eligible as a distinct identity | Eligible as a distinct identity | Bank is part of durable identity; no cross-Bank merge. |

Additional acceptance cases must cover a missing activation-eligibility value, invalid period keys, open-start validity, exact first/last-day overlap, duplicate identity, unknown Bank, configured fallback, unavailable fallback, a legitimate governed zero, by-Bank reconciliation, and input immutability.

## 15. Explicit non-goals

Step 6B.1 does not implement or change:

- Active or Near Active thresholds;
- signed-premium aggregation or precision;
- maturity bands;
- current Branch Maturity population;
- Historical Branch Maturity Comparison population;
- Branch Movement population, absence, or comparability semantics;
- Commercial Performance population;
- Branch Budget & Potential authority;
- Near Active or Opportunity population/logic;
- Target authority;
- Budget authority or seasonality;
- Bank Parent/Sub-channel hierarchy or alias consolidation;
- exports, UI formatting, import schemas, persistence, or runtime behaviour.

This contract does not make the Eligible Branch Universe a universal denominator and does not claim the future authority is implemented.

## 16. Migration and progressive adoption

Existing Branch Masters with blank `VALID FROM` and `VALID TO` remain loadable and usable through `GOVERNED_LEGACY_UNDATED` semantics when their current `active` and `activationEligible` fields are ready. No database rewrite, destructive migration, or synthesized historical date is permitted.

An effective-dated replacement import can progressively improve historical resolution. Open-start or open-end records remain explicitly classified. Operators should be able to compare temporal coverage diagnostics before activating a replacement. Dataset lifecycle and rollback remain owned by the existing repository; this contract does not change them.

Historical outputs must retain authority provenance so a legacy-undated result is never later mistaken for proven effective-dated history.

## 17. Expected future consumers and implementation touchpoints

Likely Step 6B.2 touchpoints, subject to implementation discovery, are limited to:

- `js/enrichment/liveBranchUniverseAuthority.js`: add or delegate period-aware eligible-universe resolution while retaining explicit provenance and fallback.
- `js/masters/branchMaster.js`: validate canonical effective dates, invalid ranges, temporal diagnostics, and any supported non-overlapping history rows.
- the existing Activation analytical integration: pass the canonical selected month and consume the resolved denominator without changing its numerator or threshold.
- existing canonical Data Quality/readiness diagnostics: expose authority status, temporal coverage, exclusions, and fallback reason if approved.
- focused Branch Master, universe-authority, Activation, diagnostic, and regression tests.

No schema, persistence, UI, export, Commercial Performance, maturity, movement, opportunity, target, or budget change is authorized by this document.

## 18. Testing implications for Step 6B.2

Future tests must establish:

- every scenario in section 14 and every invariant in section 13;
- canonical month validation and calendar boundaries, including leap-year February;
- inclusive first-day and last-day overlap;
- current `active` independence for explicitly dated historical membership;
- legacy-undated compatibility and its distinct status;
- explicit/mixed/legacy/fallback/unavailable status selection;
- exact overall and Bank-scoped membership and reconciliation;
- absence of PR dependence and preservation of signed-premium calculations;
- fallback isolation without governed/configured blending;
- no changes to maturity, movement, commercial, opportunity, target, budget, export, or presentation authorities;
- input and diagnostic immutability.

Documentation approval is the gate for Step 6B.2. Passing documentation checks alone must not be represented as production implementation or runtime verification.
