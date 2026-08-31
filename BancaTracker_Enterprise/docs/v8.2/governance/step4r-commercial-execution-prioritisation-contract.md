# BancaTracker Enterprise v8.2 Step 4R

## Commercial Execution Prioritisation Contract and Authority Design

**Document status:** Design contract; production implementation not started

**Scope:** Month execution snapshots supplied by Steps 4N and 4P

**Decision type:** Projection-based review ordering, not severity, prediction, or recommendation

---

## 1. Purpose and governing question

The v1 authority will answer one question:

> Within the selected dimension and execution month, among entities for which Step 4P currently asserts execution attention, which entities represent the greatest projected absolute Budget shortfall under the supplied Step 4N simple linear projection?

This is an enterprise Budget-impact review order. It is not a probability of missing Budget, a confidence assessment, an operational instruction, or a general measure of entity quality.

Execution-reference cleanup is a separate workflow. The future authority must return two independent ordered collections and must never combine them into a common score or ladder.

---

## 2. Authority boundaries

- Step 4N exclusively owns Actual-to-date, Budget pacing, required run-rate, projection, and all execution mathematics.
- Step 4P exclusively owns factual statuses, `executionAttention`, and `referenceAttention`.
- Step 4R may join and order supplied Step 4N and Step 4P rows. It must not recalculate attention, pacing, projection, Budget achievement, or reference validity.
- The future authority is pure, on demand, and repository-independent. It consumes only the current supplied Month/dimension/as-of snapshot.
- Step 4R defines governed `priorityRank`. User-selected table sorting may change display order later, but must never redefine that rank.

Legacy Scorecard priority, Target, Activation, Performance rankings, Data Quality severity, and UI sort order are not inputs to this contract.

---

## 3. Independent eligibility domains

### 3.1 Execution priority

A joined row is eligible only when the supplied Step 4P row has:

```text
executionAttention === true
```

It must also have a compatible Step 4N row, a positive finite Budget, and compatible snapshot metadata. These checks validate the input; they do not recreate Step 4P eligibility.

Rows that are achieved/exceeded, Day 0, missing/invalid/zero Budget, or otherwise have `executionAttention === false` receive `priorityRank: null` and are absent from `executionPriority`.

### 3.2 Reference priority

A Step 4P row is eligible only when:

```text
referenceAttention === true
```

Reference priority is a deterministic cleanup queue. It must not use Actual, contribution, Budget scale, Potential, execution gaps, or execution rank.

### 3.3 Separation invariant

Execution and reference ranks are independently numbered from 1 within their respective collections. They are not comparable and must not be added, merged, or displayed as one urgency ladder.

---

## 4. Materiality alternatives and decision

| Candidate | Strength | Limitation | v1 decision |
|---|---|---|---|
| Absolute projected Budget shortfall | Direct enterprise Budget impact; additive currency meaning | Large entities dominate; depends on a simple projection | Primary key |
| Projected Achievement % | Scale-neutral; exposes deep proportional underperformance | Can prioritize immaterial small entities over major absolute exposure | Context only; excluded from governed order |
| Required Daily Run-rate | Useful recovery workload context | Strongly driven by Budget scale and remaining days; not directly comparable as urgency | Context only; excluded |
| Pace Gap | Factual current position against linear pace | Not the same as projected month-end miss | Secondary tie-break |
| Monthly Budget | Stable scale context | Size is not itself underperformance | Tertiary tie-break |

For example, a ₹1 crore projected shortfall at 90% achievement ranks before a ₹15 lakh projected shortfall at 25% achievement. This deliberately favors enterprise absolute impact. Small entities with severe percentage underperformance may appear lower; future user-selected alternative views may expose that perspective without changing v1 governed rank.

Potential, Actual premium, and contribution do not participate. They answer opportunity, production, and portfolio-concentration questions rather than the chosen v1 question.

`asOfDay` is retained as context but does not weight rank. Day 1 and Day 25 use the same comparator for their respective supplied snapshots. Adding maturity weights would introduce an unapproved policy. Rankings may legitimately change when the user backtests a different cutoff.

---

## 5. Execution ordering contract

For every eligible, compatible row, derive only transparent ordering helpers from supplied gaps:

```text
hasProjectedShortfall =
  projectionStatus === PROJECTED_SHORTFALL
  AND projectedBudgetGap is finite
  AND projectedBudgetGap < 0

projectedShortfallAmount =
  hasProjectedShortfall ? -projectedBudgetGap : null

hasBehindPaceMagnitude =
  paceStatus === BEHIND_LINEAR_PACE
  AND paceGap is finite
  AND paceGap < 0

paceGapMagnitude =
  hasBehindPaceMagnitude ? -paceGap : null
```

Taking the magnitude of a supplied negative gap is permitted because it changes representation for ordering, not the governed Step 4N formula or Step 4P classification. A non-shortfall is not silently represented as a measured zero shortfall; it remains `null` with an explicit availability/group key.

Sort lexicographically using this sequence:

1. genuine measurable projected-shortfall rows first;
2. among them, `projectedShortfallAmount` descending;
3. after genuine shortfalls, rows with a measurable non-shortfall projection, then rows whose projection is unavailable;
4. within the applicable projection group, measurable behind-pace rows before unavailable/non-behind pace rows;
5. `paceGapMagnitude` descending where measurable;
6. positive finite monthly `budget` descending;
7. durable entity `key` ascending using a documented stable string/code-unit comparator.

Consequences:

- A row behind pace but projected to achieve/exceed remains eligible because Step 4P says so, but ranks after every genuine measurable projected shortfall. It is then ordered by behind-pace magnitude, Budget, and key.
- A projected-shortfall row supplied with ahead pace remains in the first group; the UI/authority must preserve both facets.
- A null projection ranks after rows with measurable projection evidence, then uses pace magnitude, Budget, and key.
- A null pace gap is unavailable, never zero, and ranks after measurable behind-pace evidence within the same projection group.
- Negative Actual and negative projection are not clamped. A projected Actual below zero may produce a shortfall greater than Budget and rank accordingly.
- No shortfall cap is applied to large-Budget entities.

Projected Achievement %, required Daily Run-rate, Potential, Actual, contribution, label, and `asOfDay` do not participate in the comparator.

---

## 6. Reference ordering contract

Reference attention has no approved materiality or urgency model. v1 therefore uses a technical deterministic order, not a severity claim:

1. canonical reference reason code ascending;
2. durable entity key ascending.

The current categories are `BUDGET_REFERENCE_INVALID` and `BUDGET_REFERENCE_MISSING`. Their lexical order is only a reproducibility mechanism; it does not assert that one condition is more important. If a row has multiple reference reasons, use the lexically first canonical reference reason as its category and retain the full reasons list.

Reference ranks are independent, contiguous ordinals within the current dimension. Actual-only rows with missing Budget enter this list. Zero-Budget rows do not, because Step 4P does not assert reference attention.

---

## 7. Entity and edge-case contract

- **Day 0:** no execution rank. Planning state is not failure.
- **Budget achieved/exceeded:** no execution rank, even if inconsistent supplied artifacts exist; Step 4P remains authoritative.
- **Missing/invalid Budget:** reference rank only. An `executionAttention` assertion alongside a non-positive/non-finite Budget is malformed and excluded with a diagnostic.
- **Zero Budget:** neither list unless a future Step 4P contract explicitly changes an attention boolean.
- **Actual-only:** reference priority only when Step 4P asserts it.
- **Commercial-only:** Day 0 is excluded; at explicit Day > 0 it ranks normally only when Step 4P asserts execution attention.
- **Unmapped/unassigned:** no penalty or boost. Their durable bucket keys participate only in the final tie-break.
- **Dimension local:** BANK ranks banks, BRANCH ranks branches, and each organisation dimension ranks its own entities. Cross-dimension ranking is prohibited.
- **OVERALL:** classification/context is returned, but `rankingApplicable: false` and `priorityRank: null`; a single aggregate row has no comparative management-review rank.
- **Period:** Month only, inherited from Step 4N. No YTD/FY priority.
- **Hierarchy:** historical execution prioritisation uses the current active hierarchy snapshot.

---

## 8. Compatibility and join contract

Step 4N and Step 4P inputs must represent the same snapshot:

```text
executionResult.selectedPeriod === statusResult.periodKey
executionResult.asOfDay         === statusResult.asOfDay
executionResult.dimension       === statusResult.dimension
```

Rows join by durable `key`, never label. Mandatory checks are:

1. both top-level inputs and row arrays have valid structures;
2. upstream statuses are retained and suitable for interpretation;
3. period, as-of, and dimension match exactly;
4. keys are present and unique independently in both inputs;
5. every joined status row identifies its matching execution row;
6. compatible joined rows agree on key; labels are descriptive only;
7. execution-eligible rows have a positive finite Budget;
8. supplied projection/gap and pace fields preserve finite-vs-null semantics;
9. Step 4P source status and Step 4N status are retained.

A period, dimension, or as-of mismatch is `INVALID_INPUT`; return no priorities. Structurally invalid input or ambiguous duplicate keys is also `INVALID_INPUT` when safe joining is impossible.

For otherwise compatible snapshots with unmatched non-duplicate keys or malformed individual rows, rank valid joined rows, return `PARTIAL`, and report every exclusion. Never fabricate a row, key, gap, Budget, attention state, or rank.

---

## 9. Proposed future authority

Proposed production file:

```text
js/analytics/commercialExecutionPriority.js
```

Proposed API:

```javascript
buildPriority(executionResult, statusResult)
buildExecutionPriority(joinedRows, context)
buildReferencePriority(statusRows, context)
getPriorityExplanation(priorityRow)
```

The public entry point should validate compatibility once, create key maps once, and invoke the two independent builders. No repository access, eager period/dimension/cutoff matrix, or UI dependency is permitted.

Proposed result:

```javascript
{
  status: "READY" | "PARTIAL" | "INVALID_INPUT" | "NO_ROWS",
  periodKey,
  asOfDay,
  dimension,
  rankingApplicable,
  sourceExecutionStatus,
  sourceAttentionStatus,

  executionPriority: [{
    priorityRank,
    key,
    label,
    priorityBasis: {
      projectionEvidence: "SHORTFALL" | "NON_SHORTFALL" | "UNAVAILABLE",
      projectedShortfallAmount,
      paceEvidence: "BEHIND" | "NOT_BEHIND" | "UNAVAILABLE",
      paceGapMagnitude,
      budget,
      stableKey: key
    },
    attentionReasons,
    sourceExecutionRow,
    sourceStatusRow
  }],

  referencePriority: [{
    priorityRank,
    key,
    label,
    referenceReasonCategory,
    attentionReasons,
    sourceStatusRow
  }],

  nonEligible: [{ key, executionPriorityRank: null, referencePriorityRank: null }],
  summary: {
    joinedRowCount,
    executionEligibleCount,
    referenceEligibleCount,
    executionRankedCount,
    referenceRankedCount,
    excludedMalformedCount,
    unmatchedExecutionCount,
    unmatchedStatusCount
  },
  diagnostics: []
}
```

Ranks are contiguous integers starting at 1 only for eligible ranked rows. There is no composite score and no priority band.

---

## 10. Diagnostics contract

Diagnostics should use stable machine-readable codes and include the affected key when available:

- `EXECUTION_INPUT_INVALID`
- `ATTENTION_INPUT_INVALID`
- `PERIOD_MISMATCH`
- `AS_OF_MISMATCH`
- `DIMENSION_MISMATCH`
- `EXECUTION_KEY_MISSING`
- `ATTENTION_KEY_MISSING`
- `EXECUTION_KEY_DUPLICATE`
- `ATTENTION_KEY_DUPLICATE`
- `EXECUTION_ROW_UNMATCHED`
- `ATTENTION_ROW_UNMATCHED`
- `EXECUTION_ATTENTION_WITH_INVALID_BUDGET`
- `PROJECTED_GAP_UNAVAILABLE`
- `PACE_GAP_UNAVAILABLE`
- `SOURCE_EXECUTION_STATUS_INVALID`
- `SOURCE_ATTENTION_STATUS_INVALID`

Unavailable projection or pace is not automatically fatal; it affects the documented availability ordering and is reported for explainability. Metadata mismatch and ambiguous joins prevent ranking.

---

## 11. Explainability and invariants

Every ranked row exposes the exact ordered basis values and source rows. Explanations must be static and factual, for example “Measurable projected Budget shortfall” and “Behind linear pace.” They must not contain recommendations or dynamically invent confidence.

The implementation must preserve these invariants:

1. the same compatible inputs always produce the same order and ranks;
2. execution membership equals supplied `executionAttention === true`, subject only to malformed-input exclusion;
3. reference membership equals supplied `referenceAttention === true`;
4. no row receives a rank in both domains merely through merged logic;
5. no thresholds, weights, normalization, score, band, RAG, severity, recommendation, alert, confidence, randomness, wall clock, or working-day adjustment exists;
6. all eligible rows are ranked—there is no authority-level Top N;
7. inputs and nested rows are not mutated;
8. row identity and final ties use durable keys, never mutable labels;
9. current dimension and cutoff are processed on demand only;
10. source status and null semantics remain visible.

---

## 12. Future implementation test matrix

The coding step must add tests for:

1. projected shortfalls ordered by absolute amount;
2. equal shortfall tied by negative pace-gap magnitude;
3. equal pace tied by monthly Budget;
4. final ties resolved by durable key;
5. behind pace/projected exceed after genuine shortfalls;
6. negative Actual retained;
7. negative projection retained without clamping;
8. missing projection ordered as unavailable;
9. missing pace gap ordered as unavailable;
10. Budget achieved excluded;
11. Budget exceeded excluded;
12. Day 0 excluded;
13. missing Budget excluded from execution priority;
14. missing Budget included in reference priority;
15. zero Budget excluded from both;
16. actual-only reference priority;
17. commercial-only at explicit observed cutoff;
18. unmapped identity ranked without penalty;
19. unassigned identity ranked without penalty;
20. BANK dimension isolation;
21. BRANCH dimension isolation;
22. ASSIGNED_RM isolation;
23. organisation hierarchy dimensions and snapshot limitation;
24. OVERALL returns context with no comparative rank;
25. period mismatch invalidation;
26. dimension mismatch invalidation;
27. as-of mismatch invalidation;
28. missing joined row produces partial result and diagnostic;
29. deterministic repeat;
30. deep immutability;
31. no repository reads;
32. no thresholds;
33. no weights or normalization;
34. no composite score;
35. no RAG;
36. no severity or bands;
37. no recommendations;
38. no alerts;
39. no authority Top-N truncation;
40. current-hierarchy limitation documented;
41. duplicate execution key invalidation;
42. duplicate status key invalidation;
43. malformed execution-attention Budget exclusion;
44. projected-shortfall/ahead-pace facet preservation;
45. nulls are not converted to zero;
46. execution and reference ranks are independently contiguous;
47. labels do not influence tie order;
48. user UI sorting cannot alter governed rank.

---

## 13. Explicit non-goals

This design does not authorize production code, UI ranking, rank badges, Top-N panels, Potential/opportunity priority, product priority, cross-dimension priority, YTD/FY priority, RAG, severity, bands, weighted/composite scoring, risk probability, forecast confidence, recommendations, alerts, notifications, escalation, working-day pacing, predictive forecasting, historical effective hierarchy, or Target migration.

The next implementation step may create the pure authority and its tests only after this policy is approved.
