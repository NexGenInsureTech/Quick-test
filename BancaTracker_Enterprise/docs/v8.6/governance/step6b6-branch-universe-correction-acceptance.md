# BancaTracker Enterprise v8.6

## Step 6B.6 — Branch Universe Correction Acceptance

**Status:** Priority A accepted and closed.

## Objective

Close the historical Activation denominator gap: active PR production remains the numerator for the resolved analytical month, while the denominator is the Branch Master population eligible for Activation in that same month.

## Original gap

Before Step 6B, Activation used the current Branch Master snapshot (or configured totals). A historical selected month could therefore be measured against today's active/eligible Branch Master state rather than membership as-of that month.

## Final authority model

`BancaTrackerLiveBranchUniverseAuthority.resolveEligibleUniverse({ records, periodKey })` resolves one immutable, period-aware Eligible Branch Universe from cached normalized Branch Master records. Activation consumes this resolver locally; the existing snapshot universe remains the authority for consumers that have not adopted effective dating.

## Effective-date semantics

The resolver accepts only canonical `YYYY-MM` periods and applies inclusive monthly overlap. Explicitly dated records use their validity interval plus `activationEligible`; current `active` does not erase a historically overlapping dated record. A fully undated record can be admitted only under current `active` plus `activationEligible` and is classified as a legacy assumption, not temporal proof. Invalid dates, invalid ranges, missing eligibility, duplicate identity, and unresolved Bank identity prevent a governed result.

The resulting provenance is one of `EFFECTIVE_DATED_GOVERNED`, `GOVERNED_LEGACY_UNDATED`, `GOVERNED_MIXED_TEMPORAL`, `UNAVAILABLE`, or `INVALID_PERIOD`. Diagnostics distinguish explicitly supported membership from legacy-undated admission.

## Activation integration

Core exposes `currentPeriodKey` only when all resolved current-period facts carry one consistent canonical `monthKey`; display labels such as `Aug-26` are never parsed into eligibility periods. Activation resolves eligibility once per refresh from the cached Branch Master records and uses the resolver's by-Bank values. Existing PR aggregation, durable PR branch identity, signed premium semantics, the Active threshold, and active-branch numerator are unchanged.

For a valid governed result, zero eligible branches remains zero. When the period-aware result is unavailable or invalid, Activation uses the existing configured Bank totals as an all-or-nothing fallback; it does not substitute the current Branch Master snapshot.

## ALL semantics

`Month = ALL` remains the application's single latest represented current-period Activation scope. It is not FY, YTD, a multi-month union, or a separately resolved latest period per Bank. Numerator and denominator use that same resolved period.

## Population separation

Eligible Branch Universe remains an Activation denominator/opportunity concept. It does not create observed PR branches, Commercial Performance rows, Maturity rows, Movement rows, Near Active branches, or Opportunity rows. Observed population remains resolved PR production; Commercial population remains resolved PR plus governed Branch Budget & Potential branch-period rows; Maturity remains supplied Commercial branch-period rows. Branch Master-only eligibility is not a Maturity Zero.

## Preserved authorities

Snapshot `buildFromBranchMaster`, `getBankUniverse`, `getDenominator`, and `assessObserved` retain their existing semantics. Management Scorecard, Data Quality/readiness, Productivity, Near Active, Opportunity, Branch Maturity, Historical Maturity Comparison, Branch Movement, Commercial Performance, and Branch Budget & Potential were not migrated. Durable identity remains `BANK_ID:BRANCH_CODE`; no Bank Parent hierarchy, source-channel merge, PMSBY aliasing, or sub-channel consolidation was introduced.

## Synthetic acceptance evidence

The committed Step 6B.2 contract test verifies inclusive boundaries, historical inactive branches, future branches, false/missing eligibility, legacy-undated provenance, invalid ranges, distinct Bank-qualified identities, diagnostics, and immutability. The committed Step 6B.5 integration test verifies Aug/Sep denominator changes with an unchanged numerator, period pairing, ALL behavior, configured fallback, invalid/missing period handling, and governed zero.

Targeted tests passed:

- `step6b2-effective-dated-branch-eligibility-contract.test.js`
- `step6b5-activation-effective-dated-denominator.test.js`
- `step4f1-branch-universe-contract.test.js`
- `step4f-branch-universe-authority.test.js`
- `step81a.test.js`

The master regression suite passed: **78/78 groups**.

## Known limitation

Acceptance uses deterministic synthetic datasets and repository authority tests only. No production/company data was used, so this acceptance does not claim validation of real Sep-26 company populations.

## Closure

Priority A — Historical Branch Universe / Branch Master correctness — is closed for Activation's governed effective-dated denominator integration.

**Next dependency:** Step 6C — Bank Identity / Budget Ownership Contract.
