# Step 6D.8 — Priority B Target Seasonality Acceptance

## Purpose

Close Priority B: governed Target monthly phasing. This acceptance covers Target Seasonality only; it does not establish full historical monetary Target reproducibility or v8.6 release readiness.

## Baseline

- Branch: `feature/v8.6-governance-foundation`
- Acceptance baseline: `b8e19a6` (`test(v8.6): register target seasonality regressions`)
- Registered regression suite: 83 groups

## Evidence chain

| Step | Repository evidence |
| --- | --- |
| 6D.2 governance | `3fd26d4`, `docs/v8.6/governance/step6d2-target-seasonality-contract.md` |
| 6D.3 pure resolver contract | `b200b61`, `tests/step6d3-target-seasonality-contract.test.js` |
| 6D.4 pure resolver | `958199a`, `js/targetSeasonality.js` |
| 6D.5 persistence/import/live cache | `5e04df6`, `8a4f719`, `a4c3c91`, `js/masters/targetSeasonalityMaster.js`, `js/enrichment/liveTargetSeasonalityAuthority.js` |
| 6D.6 monetary integration | `5dea0d5`, `d5347d3`, `tests/step6d6-target-seasonality-integration-contract.test.js`, `js/target.js` |
| 6D.7 UI interpretation | `6cca12f`, `6d3d534`, `tests/step6d7-target-seasonality-ui-contract.test.js`, `js/helpGlossary.js`, `README.md` |
| Registered protection | `b8e19a6`, `tests/run-all.js` |

## Priority B scope and authority model

Three distinct authorities remain separate:

| Concept | Authority | Ownership |
| --- | --- | --- |
| Annual Target | `js/target.js` `targetState` | Mutable Overall FY and Bank FY session state in ₹ Cr. |
| Target Seasonality | `js/targetSeasonality.js` plus the Target Seasonality master | Governed FY + Overall or canonical-Bank monthly allocation weights. |
| Commercial Budget/Potential | Step 4G commercial authority | Governed branch-period commercial reference planning. |

Target is not Commercial Budget and is not Potential. No Target Seasonality change merges these authorities.

## Seasonality grain and resolution

`js/targetSeasonality.js` owns pure resolution. It accepts a valid fiscal year, supports `OVERALL` and canonical `BANK` curves, requires exactly the canonical April–March twelve months, accepts decimal weights including zero, and validates reconciliation to one within `1e-9`.

Resolution is resolver-owned:

1. Overall Target: valid Overall curve, otherwise `EQUAL_MONTH_FALLBACK`.
2. Bank Target: valid Bank curve, then valid Overall inheritance, otherwise `EQUAL_MONTH_FALLBACK`.
3. An explicitly applicable malformed curve returns `INVALID`; it does not fall through to inheritance or fallback.

Fallback weights are resolver-owned `1 / 12` weights. `targetState.monthlyTarget = annual / 12` remains only the documented legacy compatibility field, not Target monetary allocation authority.

Aliases normalize current canonical Bank identity; no parent, source, management, or subchannel Bank hierarchy is introduced.

## Persistence and lifecycle

`TARGET_SEASONALITY` is a persistent governed dataset type in `js/data/schema.js`. `js/masters/targetSeasonalityMaster.js` validates FY, scope, canonical Bank, canonical month, decimal weight, complete curves, and reconciliation. `js/masterDataAdmin.js` provides the existing Master Data Administration import, preview, staging, activation, and FY successor-snapshot replacement route.

`js/enrichment/liveTargetSeasonalityAuthority.js` hydrates a detached synchronous cache for consumers. An absent active dataset is distinct from `NOT_LOADED` and `LOAD_FAILED`. Fallback is resolved from an empty record set only after `ABSENT`; fallback rows are never persisted as fake master records.

## Target monetary integration

`js/target.js` consumes Core's canonical `context.currentPeriodKey`, derives fiscal year through `BancaTrackerDateResolver`, reads the live cache, and calls the pure resolver. It does not read the repository or IndexedDB directly and does not parse display month labels as Target authority.

- Current-month Target = annual Target × resolved current-month weight.
- YTD Target = annual Target × cumulative resolved April-through-current weight.
- The existing monthly table consumes the same resolved monthly Target map.
- No daily Target proration is introduced.
- Signed Actual, Achievement, Gap, annual remaining Target, annual Target ownership, session persistence, and `monthlyTarget` compatibility are preserved.

For Month `ALL`, Target uses the period Core has already resolved; Target adds no separate ALL-period rule.

## RRR firewall

RRR remains `(Annual Target − YTD Actual) ÷ Remaining Months` in `js/target.js`. It does not use future weights, a remaining seasonal plan, or seasonality-weighted RRR.

## Invalid, unavailable, missing, and zero semantics

`INVALID`, resolver `UNAVAILABLE`, cache `NOT_LOADED`, cache `LOAD_FAILED`, and unknown cache states fail closed. Allocation-dependent values are unavailable, not zero; technical cache failure is not presented as absence/fallback.

| Condition | Accepted presentation semantics |
| --- | --- |
| Missing annual Target | Existing `Not set` semantics may apply. |
| Existing annual Target with unavailable allocation | `Not available`; never ₹0, 0%, or `NaN` as a substitute. |
| Explicit annual Target = 0 with valid allocation | Valid zero Target; Achievement remains undefined. |

## UI interpretation and documentation

`js/target.js` presents one contextual allocation explanation, supplied from Target result provenance:

- governed Bank curve;
- direct governed Overall curve;
- Overall curve inherited by a Bank;
- equal twelve-month fallback when no applicable governed curve exists;
- invalid configuration;
- unavailable selected period; and
- neutral technical/cache unavailable state.

The unconditional equal-`1/12` statement is absent from Target UI. Monthly rows distinguish unavailable allocation from a missing annual Target. The glossary and README describe governed seasonality with equal fallback; the Achievement glossary is contextual to Target or Budget. The existing in-app Manual remains valid and unchanged.

## Firewalls

- Scorecard continues to consume `BancaTrackerTarget.calculateTargetForBank(...)`; it has no independent seasonality resolver/cache/repository logic.
- Commercial Budget/Potential, rollups, comparison, execution, status, priority, driver analysis, and Commercial UI are unchanged. The related legacy Commercial test edits only removed obsolete `js/target.js` unchanged-file guards; their substantive Commercial assertions remain.
- Step 6B effective-dated Activation denominator and its numerator remain unchanged. Maturity and Commercial populations remain separate.
- Step 6C.2 flat `canonicalBank` compatibility identity remains unchanged; aliases are normalization, not hierarchy.

## Regression evidence

All passed at acceptance:

- `node tests/step6d3-target-seasonality-contract.test.js`
- `node tests/step6d5-target-seasonality-persistence-contract.test.js`
- `node tests/step6d6-target-seasonality-integration-contract.test.js`
- `node tests/step6d7-target-seasonality-ui-contract.test.js`
- `node tests/test-help-glossary.js`
- `node tests/run-all.js` — 83/83 groups
- `node --check` across 156 tracked JavaScript files
- `git diff --check`

## Deferred limitation

Target Seasonality configuration is governed and persistent, but Overall and Bank annual Targets remain mutable session state. Therefore full historical monetary Target reproducibility is not delivered.

**v8.6 Priority B delivers governed Target monthly phasing, not full historical monetary Target reproducibility.**

## Acceptance matrix

| Acceptance area | Result | Evidence |
| --- | --- | --- |
| Authority separation | PASS | Target state, pure seasonality resolver, and Commercial reference authority remain separate. |
| Grain, validation, inheritance, fallback | PASS | Step 6D.3 contract and `js/targetSeasonality.js`. |
| Persistent import/cache lifecycle | PASS | Step 6D.5 persistence contract and live cache authority. |
| Monetary integration and RRR firewall | PASS | Step 6D.6 contract and `js/target.js`. |
| UI, unavailable semantics, documentation | PASS | Step 6D.7 contract, Target UI, glossary, README. |
| Scorecard, Commercial, Bank, and Branch Universe firewalls | PASS | Registered regression suite and source boundaries. |

## Closure verdict

**STEP 6D / PRIORITY B — GOVERNED TARGET SEASONALITY: CLOSED**

**READY FOR NEXT v8.6 BACKLOG ITEM**
