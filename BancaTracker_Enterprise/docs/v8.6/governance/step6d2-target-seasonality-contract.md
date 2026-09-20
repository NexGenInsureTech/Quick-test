# BancaTracker Enterprise v8.6

## Step 6D.2 — Target Seasonality Governance Contract

**Status:** Proposed governance contract. This document authorizes no runtime, schema, persistence, UI, test, or Commercial change.

**Baseline:** `feature/v8.6-governance-foundation` at `1c519848ee9a5f8afb659635e7c810ff1f88b831`.

**Scope:** Replace the legacy equal-month allocation of the legacy FY Target authority with a governed monthly allocation authority. This contract governs legacy FY Target allocation only.

## 1. Objective and Commercial firewall

The current implicit rule is:

```text
every fiscal month = 1 / 12
```

The future authority must make that allocation explicit while retaining equal allocation as a backward-compatible, visibly qualified fallback. It must support FY-owned Overall and explicitly configured Bank curves, deterministic resolution, reconciliation, provenance, persistent configuration, calculation precision, historical interpretation, and continued Target/Scorecard consumption.

> **Target Seasonality governs legacy FY Target allocation only.**

It MUST NOT change Branch Budget & Potential, Commercial Budget, Commercial Potential, Commercial Performance, Commercial achievement, Commercial execution, Commercial pacing, Commercial shortfall, or Commercial priority. Commercial Budget remains an explicit planning authority at:

```text
branchId + YYYY-MM
```

No `/12` migration belongs in Commercial authority.

## 2. Current authority preserved until adoption

Current Target state is:

```text
{
  fiscalYearTarget,
  monthlyTarget,
  bankTargets
}
```

Amounts are ₹ Cr. Current authority derives `monthlyTarget = annualTarget / 12`; YTD Target is `(annualTarget / 12) × elapsed fiscal months`; monthly rows also use `annualTarget / 12`; and RRR is remaining annual Target divided by remaining fiscal months. Target is stored in browser `sessionStorage`.

The current state has no fiscal-year ownership, dataset ownership, version, effective dates, or audit history. Changing a current Target therefore affects historical selected-month calculations immediately. This contract does not alter that current behavior.

## 3. Fiscal-year and month identity

Every governed seasonality curve is owned by an explicit fiscal-year identity, conceptually `FY2026-27`. A curve for one FY MUST NOT govern another FY.

A curve contains exactly twelve canonical calendar-month keys (`YYYY-MM`) belonging to that FY. The implementation must map the configured `FISCAL_MONTHS` Apr–Mar display sequence to those canonical keys; display labels such as `Apr-26` are not authority keys. The existing configured Apr–Mar order remains the fiscal progression authority until separately changed.

For the currently configured sequence, the conceptual mapping is:

```text
FY2026-27 → 2026-04, 2026-05, …, 2027-03
```

Target Seasonality consumes Core's resolved analytical period. It must not introduce wall-clock month logic or a competing latest-month rule.

## 4. Annual-Target ownership boundary

v8.6 adopts **Option A — seasonality-only governance**.

Seasonality is persistently FY-owned and governed. The existing Overall and Bank annual Targets remain the current mutable session-state inputs. This is the smallest change that prevents a curve from silently crossing FY boundaries without expanding into a full Target-management redesign.

Consequences:

- A selected historical month resolves its FY-specific curve under the active configuration rule in section 12.
- Its monetary result remains dependent on the currently entered annual Target.
- v8.6 therefore makes seasonal allocation historically interpretable, but does **not** make complete historical monetary Target results reproducible.
- A future FY-owned annual Target master may close that remaining gap; it is out of scope here.

## 5. Supported grains and canonical Bank scope

Two curve grains are supported conceptually:

| Grain | Identity |
| --- | --- |
| Overall | `fiscalYear + OVERALL` |
| Bank | `fiscalYear + canonicalBank` |

`canonicalBank` retains the existing flat compatibility meaning governed by Step 6C.2. This contract does not introduce source Bank, Management Bank, sub-channel, parent Bank, hierarchy, or PMSBY-specific treatment.

## 6. Resolution and inheritance

For a selected Bank with an annual Bank Target, resolve one complete curve in this order:

1. valid governed Bank curve for the requested FY and canonical Bank;
2. valid governed Overall curve for the requested FY;
3. equal-month compatibility fallback.

For `ALL` / Overall:

1. valid governed Overall curve for the requested FY;
2. equal-month compatibility fallback.

The resolver MUST NOT average Bank curves to construct Overall seasonality, infer one Bank's curve from another Bank, or inherit an Overall annual Target as a missing Bank annual Target.

## 7. Weight representation and validation

The canonical calculation representation is a decimal fraction. For example, `0.075` means 7.5% and `0.0825` means 8.25%.

- Stored calculation values retain supplied numeric precision; display precision is not calculation authority.
- Each weight must be finite and in the inclusive range `[0, 1]`.
- Negative weights are invalid.
- A zero-weight month is valid when explicitly configured.
- A governed curve must contain exactly one record for each of its FY's twelve canonical months.

Missing, duplicate, unknown, out-of-FY, or wrong-sequence months make the whole curve invalid. A resolver must never combine some configured weights with `1/12` fallback month-by-month.

Weights must sum to `1` within an absolute tolerance of `0.000000001` (one billionth). This tolerance exists only for binary floating-point representation. Materially non-reconciling curves must not be silently normalized. If implementation uses a final-month residual adjustment to preserve exact monetary total at calculation precision, it may do so only after validation within that tolerance, must retain the original governed weights, and must expose the adjustment diagnostically. Display rounding must never govern this reconciliation.

## 8. Monetary formulas and period semantics

For annual Target `A` in ₹ Cr and resolved month weight `Wm`:

```text
Monthly Target(m) = A × Wm
```

Under equal fallback, every `Wm = 1 / 12`.

For a resolved Core analytical month, YTD Target is:

```text
YTD Target = Σ Monthly Target(m)
             for fiscal months Apr through the resolved analytical month
           = A × Σ applicable weights
```

Rules:

- A selected historical configured month includes all fiscal months through that month.
- `Month = ALL` includes all fiscal months through Core's latest represented fiscal month.
- An unconfigured or missing canonical analytical period returns unavailable Target progression; it must not select another period.
- Future monthly-table rows remain visible and may show their governed monthly Target with zero Actual; they do not enter earlier YTD.
- Once a fiscal month is included in progression, its full monthly weight is included. No daily or partial-month Target proration is introduced.

All twelve rows must consume resolved authority results; UI code must not independently calculate annual Target divided by twelve.

## 9. Achievement, gap, and RRR

Seasonality changes only the applicable Target.

```text
Achievement = Actual / applicable Target
Gap         = applicable Target − Actual
```

Existing null and zero safeguards, signed Actual semantics, and precision remain unchanged.

RRR remains the existing backward-compatible **equal required average across remaining months**:

```text
RRR = remaining annual Target / number of remaining fiscal months
```

It is not a remaining seasonal-plan measure. Consumers may later display remaining planned seasonal allocation separately only under another approved contract.

## 10. Zero and missing annual Targets

Annual Target zero remains valid and distinct from missing:

```text
monthly targets = 0
YTD target      = 0
achievement     = unavailable / undefined under existing safeguards
```

If an annual Target is absent, a curve may still resolve and report its provenance, but no monetary monthly Target, YTD Target, achievement, gap, or RRR is fabricated. A Bank curve never supplies a missing Bank annual Target.

## 11. Provenance and invalid configuration

Every resolution must carry one of these conceptual statuses:

| Status | Meaning |
| --- | --- |
| `GOVERNED_BANK` | A valid FY + canonicalBank curve supplied the allocation. |
| `GOVERNED_OVERALL` | A valid FY + OVERALL curve supplied the allocation, including Bank inheritance. |
| `EQUAL_MONTH_FALLBACK` | No applicable governed curve exists; twelve equal weights supplied compatibility behavior. |
| `INVALID` | An explicitly applicable governed curve exists but is malformed or non-reconciling. Monetary allocation is unavailable. |
| `UNAVAILABLE` | FY/period cannot be resolved or no allocation can be safely supplied. |

Invalid is fail-closed: an explicit applicable malformed curve must not silently become an equal-month fallback. The result must include diagnostics identifying the invalid curve and validation reason. Absence of a curve remains distinct from an invalid curve.

## 12. Persistent configuration, administration, and history

Seasonality is management planning governance, not temporary experimentation. It therefore uses a **persistent governed master**, using repository-consistent IndexedDB master/dataset lifecycle rather than session state.

The conceptual authoritative administration route is Master Data Administration CSV import. A wide CSV is suitable for twelve fixed fiscal months:

```text
FISCAL YEAR, SCOPE TYPE, CANONICAL BANK, APR, MAY, …, MAR
```

The import must validate canonical month mapping and all section 7 rules before activation. A dedicated Target configuration UI may be added later as a secondary administration surface only if it writes through the same authoritative master path.

Replacement semantics are **atomic active-configuration replacement per FY**: a fully valid imported configuration replaces the active curve set for its FY as one unit; invalid imports do not partially activate. The repository may retain dataset/version metadata and prior records for audit/rollback, but v8.6 resolution uses the latest active configuration for that FY.

Historical rule: if Aug-26 is viewed after its FY's active curve changes, Aug-26 uses that FY's latest active curve. This makes the currently governed allocation transparent, but not versioned-as-of historical reproduction. Together with mutable session annual Targets, full historical monetary reproducibility remains explicitly out of scope for v8.6.

## 13. Overall and Bank independence

Overall curve governs Overall Target allocation. A Bank curve governs that Bank Target allocation. Bank monthly Targets do not need to sum to Overall monthly Target, because current Bank annual Targets do not reconcile to Overall annual Target. This contract introduces no implicit Overall/Bank reconciliation requirement.

When a Bank annual Target exists with no Bank curve, the section 6 chain applies: valid Overall curve, then equal fallback. When a Bank curve exists with no Bank annual Target, its allocation may resolve, but monetary Bank Target outputs remain unavailable.

## 14. Consumer and state firewalls

Scorecard must continue to consume Target authority results:

```text
Scorecard → Target authority → resolved annual / monthly / YTD Target
```

Scorecard must not implement `/12`, weight lookup, inheritance, or fallback independently. Core remains the analytical-period authority. Future Target UI displays authority results and must not independently calculate weights, monthly Targets, YTD Target, inheritance, or fallback.

Existing state compatibility is:

- `fiscalYearTarget` remains the session Overall annual Target.
- `bankTargets` remains the session Bank annual Target mapping.
- `monthlyTarget` becomes a compatibility-derived legacy field only; it must not compete with resolved seasonality as an authority. It may be deprecated and removed only through a separately approved migration.

## 15. Synthetic acceptance scenarios

Later executable contract tests must cover at least:

| ID | Scenario | Required result |
| --- | --- | --- |
| S01 | Annual 120 Cr, no curve | Twelve 10 Cr months; `EQUAL_MONTH_FALLBACK`. |
| S02 | Valid unequal Overall curve | Monthly targets follow weights and sum to annual Target. |
| S03 | Valid Bank override | Bank curve overrides Overall curve. |
| S04 | Bank Target without Bank curve | Inherits valid Overall curve. |
| S05 | Neither Bank nor Overall curve | Equal-month fallback. |
| S06 | Explicit zero-weight month | Valid; that monthly Target is zero. |
| S07 | Negative weight | `INVALID`. |
| S08 | Missing month | `INVALID`. |
| S09 | Duplicate month | `INVALID`. |
| S10/S11 | Sum below/above tolerance | `INVALID`. |
| S12 | Tiny floating-point variance | Accepted only within documented tolerance. |
| S13 | Annual Target zero | Monthly/YTD monetary Targets are zero. |
| S14 | Annual Target absent | Curve provenance may resolve; monetary Target outputs unavailable. |
| S15 | Historical selected month | YTD is Apr through selected-month cumulative weights. |
| S16 | Month = ALL | YTD is through Core's latest represented fiscal month. |
| S17 | Future month | Visible monthly governed Target; excluded from earlier YTD. |
| S18 | Negative Actual | Target unchanged; signed achievement/gap semantics preserved. |
| S19 | Bank curve without Bank annual Target | No fabricated monetary Bank Target. |
| S20 | Applicable invalid curve | Fail closed, diagnostics visible, no silent fallback. |
| S21 | Commercial firewall | Commercial Budget/Performance results unchanged. |
| S22 | Scorecard | Consumes Target authority without an independent formula. |
| S23 | Overall/Bank independence | No automatic reconciliation introduced. |
| S24 | FY isolation | One FY's curve cannot govern another FY. |
| S25 | Active-curve replacement | Historical view uses the current active curve for that FY and labels provenance. |

## 16. Non-goals

This contract excludes Commercial Budget seasonality, Branch Budget & Potential changes, Bank hierarchy implementation, source/management Bank implementation, Activation changes, daily Target proration, Commercial pacing changes, workforce planning, automatic Overall/Bank Target reconciliation, external/server persistence, and a full FY-owned annual Target master.

## 17. Recommended implementation sequence

```text
6D.3 executable seasonality contract tests
    ↓
6D.4 pure Target Seasonality authority
    ↓
6D.5 persistent master/import authority
    ↓
6D.6 Target integration
    ↓
6D.7 Scorecard/UI integration
    ↓
6D.8 acceptance
```

Each stage must be independently testable. Commercial modules remain outside every stage.

## 18. Required future authority verdicts

Any implementation must preserve these contract decisions:

1. Overall and Bank seasonality grains.
2. Bank → Overall → equal fallback inheritance.
3. Decimal-fraction weights.
4. Complete-curve validation and `0.000000001` tolerance.
5. Equal fallback only when no governed curve exists.
6. Fail-closed behavior for an applicable invalid curve.
7. Explicit FY ownership.
8. Session-owned annual Target boundary.
9. Persistent governed seasonality master.
10. Latest-active-curve historical rule and its reproducibility limitation.
11. Unchanged RRR meaning.
12. No Overall/Bank reconciliation requirement.
13. Compatibility-only status of `monthlyTarget`.
14. Commercial firewall.
15. Scorecard consumption of Target authority only.
