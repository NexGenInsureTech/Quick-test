# BancaTracker Enterprise v8.2

## Step 4U — Commercial Execution Drill-down & Management Context Contract

**Status:** Design contract

**Scope:** Future analytics authority only; no production code or UI in Step 4U

**Proposed module:** `js/analytics/commercialExecutionDrilldown.js`

---

## 1. Purpose and canonical question

This contract governs navigation from a commercial execution or priority row to lower-level management context without introducing new business mathematics.

> For the selected execution entity, which governed child entities contribute to its current Actual, Budget position, pacing, attention, and priority context?

Drill-down composes the existing Step 4N execution, Step 4P attention, and Step 4S priority authorities. It does not recalculate their formulas, invent scores, or infer business policy.

## 2. Existing capability and collision assessment

The application contains navigation and drill-like interactions in existing reporting views, including scorecard paths and selected-entity comparison context. It does not contain a governed authority for commercial execution parent/child navigation with durable-key validation, snapshot validation, child-local status and priority, and additive reconciliation.

Step 4U therefore defines a new contract. It must not replace or reinterpret existing UI navigation. Month comparison and daily comparison remain contextual analytics, not structural descendants.

## 3. Governed dimensions and drill-down domains

The available commercial roll-up dimensions support four distinct domains. They must not be presented as one universal hierarchy.

### 3.1 Organisational hierarchy

The current active organisational snapshot provides these strict paths:

```text
NATIONAL_HEAD -> ZSM -> ASM -> CSM -> ASSIGNED_RM -> BRANCH
```

Approved direct paths are:

| Parent | Allowed child |
|---|---|
| `NATIONAL_HEAD` | `ZSM` |
| `ZSM` | `ASM` |
| `ASM` | `CSM` |
| `CSM` | `ASSIGNED_RM` |
| `ASSIGNED_RM` | `BRANCH` |

Skipping levels is not approved in v1. Organisational relationships reflect the current active hierarchy snapshot; historical transactions are not re-parented through an effective-dated hierarchy because none is yet governed.

### 3.2 Geographic analytical breakdowns

These are alternative analytical breakdowns, not one strict tree:

| Parent | Allowed child dimensions |
|---|---|
| `BANK` | `ZONE`, `STATE`, `BRANCH` |
| `ZONE` | `STATE`, `BRANCH` |
| `STATE` | `BRANCH` |

`ZONE -> ASSIGNED_RM` and `STATE -> ASSIGNED_RM` are excluded from v1. An RM can span geographic parents, so globally aggregated RM rows cannot safely be assigned to one parent without a parent-scoped authority result.

### 3.3 Bank-organisation analytical breakdowns

These are alternative bank structures rather than a universal hierarchy:

| Parent | Allowed child dimensions |
|---|---|
| `BANK` | `BANK_REGION`, `BANK_ZONE`, `FGM_OFFICE`, `BRANCH` |
| `BANK_REGION` | `BRANCH` |
| `BANK_ZONE` | `BRANCH` |
| `FGM_OFFICE` | `BRANCH` |

`BANK_REGION`, `BANK_ZONE`, and `FGM_OFFICE` to `ASSIGNED_RM` are excluded from v1 for the same possible cross-parent aggregation problem.

### 3.4 Operational branch breakdown

`ASSIGNED_RM -> BRANCH` is the approved operational breakdown. `BRANCH` is terminal in v1.

### 3.5 Overall entry point

`OVERALL -> BANK` is the only approved `OVERALL` path. This gives management a stable first breakdown and avoids treating every dimension as a simultaneous child of the total.

## 4. Excluded analytical contexts

- Product is excluded from the v1 structural drill-down contract.
- LOB is excluded from the v1 structural drill-down contract.
- Daily movement is contextual analysis that a selected entity may invoke; it is not a child hierarchy.
- Month comparison is contextual analysis that a selected entity may invoke; it is not a child hierarchy.
- Policy and customer transaction drill-through are excluded.

Product and LOB should be considered later as a separate governed driver-analysis capability.

## 5. Identity and selection contract

A parent selection is:

```javascript
{
  parentDimension,
  parentKey,
  parentLabel
}
```

`parentDimension` and `parentKey` form the identity. `parentLabel` is descriptive only and must never select or join data.

A child row is identified by:

```javascript
{
  childDimension,
  key,
  label
}
```

`childDimension` and `key` form the identity. Duplicate labels across parents are valid and must remain distinct.

## 6. Relationship and filtering contract

Relationships use durable metadata already governed on commercial source/roll-up rows, such as bank, geography, bank-organisation, and hierarchy IDs. Display-label matching is prohibited.

The safest orchestration is:

1. validate the requested parent/child path;
2. locate the parent in its governed execution snapshot by durable key;
3. constrain the governed commercial source rows by the selected parent's durable relationship metadata;
4. build the child-dimension Step 4N -> 4P -> 4S authority chain from that parent-constrained population using the same snapshot;
5. pass those explicitly scoped authority outputs to the drill-down authority for composition and reconciliation.

A global child-dimension aggregate must not merely be filtered after aggregation when a child identity may span multiple parents. That would allow cross-parent values to leak into the selected parent. Every child authority bundle must declare its scope:

```javascript
scope: {
  parentDimension,
  parentKey
}
```

The drill-down authority rejects a missing or mismatched scope. A relationship that is ambiguous or not supported returns a diagnostic; it is never resolved by name.

## 7. Snapshot contract

Parent execution, scoped child execution, child status, and child priority must have exactly the same:

- `periodKey`;
- `asOfDay`;
- expected parent or child dimension;
- declared parent scope for the child bundle.

No child view may silently change month or cutoff. A mismatch is invalid input, not an empty result.

## 8. Child context semantics

Each child row may expose only fields supplied by the relevant governed authority, including Actual to Date, Budget, Expected Budget to Date, Pace Gap, Budget Achievement, Required Daily Run-rate, Projection, Projected Gap, execution attention, reference attention, and priority rank.

- Execution values come from Step 4N at the child dimension.
- Attention values come from Step 4P at the child dimension. Parent attention is not propagated.
- Priority comes from Step 4S at the child dimension and same scoped snapshot. Rank is dimension-local and parent rank is never inherited.
- The drill-down authority joins authority rows by durable child key and reports missing, duplicate, or unmatched rows.

## 9. Missing and sentinel identities

`__UNMAPPED__` and `__UNASSIGNED__` remain visible whenever the existing governed dimension produces them. They are factual management context and must not be dropped to improve reconciliation.

Missing Budget remains `null`. It must not become zero. Reference-attention rows remain visible and retain their governed Step 4P context.

## 10. Reconciliation contract

Reconciliation applies to one selected child dimension at a time.

### 10.1 Actual

Actual is additive and preserves signed premium. Sum child Actual and compare it with parent Actual only when the chosen relationship is complete and non-overlapping.

```javascript
actual: {
  status: "RECONCILED" | "DIFFERENCE" | "NOT_COMPARABLE",
  parent: 0,
  children: 0,
  difference: 0
}
```

`difference = children - parent`. Sentinel children participate. Ambiguous or incomplete relationship coverage produces `NOT_COMPARABLE` with a diagnostic rather than a false zero difference.

### 10.2 Budget

Budget is additive only when parent Budget exists and every required child Budget is governed and present.

```javascript
budget: {
  status: "RECONCILED" | "DIFFERENCE" | "PARTIAL" | "NOT_AVAILABLE",
  parent: null,
  children: null,
  difference: null,
  missingChildCount: 0
}
```

If any required child Budget is missing, the child total and difference remain `null`; present values must not be presented as the complete denominator.

### 10.3 Non-additive values

Ratios, achievements, pacing values, projected ratios, required run-rates, attention booleans, and priority ranks are not summed. Parent and child values remain the outputs of their own governed authority levels.

## 11. Status contract

| Status | Meaning |
|---|---|
| `READY` | Valid path and child rows composed successfully. |
| `PARTIAL` | Valid result with factual authority/relationship gaps recorded. |
| `EMPTY` | Parent and path are valid, but the scoped population has no child rows. |
| `INVALID_DRILLDOWN` | Parent/child path is not approved. |
| `INVALID_INPUT` | Snapshot, dimension, scope, identity, or authority bundle is invalid. |
| `PARENT_NOT_FOUND` | The durable parent key is absent from the parent authority result. |

Examples such as `BRANCH -> ZSM`, `ASSIGNED_RM -> NATIONAL_HEAD`, and `STATE -> NATIONAL_HEAD` return `INVALID_DRILLDOWN`. A missing parent is never fabricated as successful empty context. A valid empty result returns `EMPTY`, `rows: []`, and an explanatory diagnostic.

## 12. Proposed future authority API

```javascript
getAllowedDrilldowns(parentDimension)

validateDrilldown({
  parentDimension,
  childDimension
})

buildDrilldown({
  parentSelection,
  childDimension,
  parentExecutionResult,
  scopedChildExecutionResult,
  scopedChildStatusResult,
  scopedChildPriorityResult,
  relationshipContext
})
```

`relationshipContext` is an in-memory, governed durable-key relationship projection produced by orchestration from cached commercial authority inputs. The module performs no repository or IndexedDB reads.

The authority validates, joins, orders as already governed by child priority where supplied, and reconciles. It contains no execution formulas, attention rules, priority rules, thresholds, scoring, Top-N policy, or UI behavior.

## 13. Proposed result shape

```javascript
{
  status,
  periodKey,
  asOfDay,
  parent: {
    dimension,
    key,
    label
  },
  drilldownDomain,
  childDimension,
  allowedChildDimensions: [],
  scope: {
    parentDimension,
    parentKey
  },
  rows: [
    {
      key,
      label,
      execution: {},
      attention: {},
      priority: {}
    }
  ],
  reconciliation: {
    actual: {},
    budget: {}
  },
  diagnostics: {
    errors: [],
    warnings: [],
    facts: []
  }
}
```

An authority field unavailable for a child is absent or `null` according to its source contract; it is not recomputed or defaulted.

## 14. Diagnostics

The future authority should use stable diagnostic codes for at least:

- invalid input structure or dimension;
- invalid parent/child path;
- parent key not found;
- period or `asOfDay` mismatch;
- parent/child dimension mismatch;
- missing or mismatched parent scope;
- duplicate, blank, or unmatched durable child keys;
- ambiguous relationship or excluded cross-parent child;
- unmatched execution, status, or priority rows;
- incomplete relationship coverage;
- Actual reconciliation difference;
- partial or unavailable Budget reconciliation;
- retained unmapped or unassigned children;
- valid empty child population;
- current-hierarchy-snapshot limitation.

Diagnostics explain observed contract facts. They do not create severity, RAG, alerts, recommendations, or forecast confidence.

## 15. Test matrix for the implementation step

Future tests must cover:

1. every approved path and every domain;
2. representative rejected paths, including reverse and skipped hierarchy paths;
3. `OVERALL -> BANK` and rejection of other `OVERALL` paths;
4. terminal `BRANCH` behavior;
5. durable selection with duplicate labels under different parents;
6. rejection of label-only selection;
7. scoped child results and cross-parent leakage prevention;
8. period, `asOfDay`, dimension, and scope mismatch;
9. parent not found and valid empty children;
10. child-local Step 4P attention and Step 4S priority/rank;
11. signed positive, zero, and negative Actual reconciliation;
12. reconciled, differing, incomplete, and unavailable Budget cases;
13. missing Budget preserved as `null` with reference attention retained;
14. ratios, attention, and ranks never summed;
15. `__UNMAPPED__` and `__UNASSIGNED__` retention;
16. missing, duplicate, and unmatched authority child keys;
17. ambiguous/incomplete relationship coverage;
18. status stability and deterministic diagnostics;
19. no repository access and no formula ownership;
20. regression preservation for Steps 4N through 4T and existing v8.1 behavior.

## 16. Implementation boundary and recommended next step

Step 4U creates only this design contract. It makes no production, storage, styling, or UI changes.

Recommended Step 4V: implement and unit-test the pure `commercialExecutionDrilldown.js` authority, including the allowed-path registry, snapshot/scope validation, durable-key composition, reconciliation, and diagnostics. UI integration should remain a later step after the authority contract passes regression.

The principal remaining concern is availability of explicitly parent-scoped child Step 4N -> 4P -> 4S outputs. Step 4V must establish safe orchestration from governed in-memory inputs; it must not approximate parent membership by filtering globally aggregated rows or matching display labels.
