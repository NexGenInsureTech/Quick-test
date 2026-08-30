# BancaTracker Enterprise v8.2

## Step 4X — Commercial Driver Analysis Contract

**Status:** Design contract

**Scope:** Future analytics authority only; no production code or UI in Step 4X

**Proposed module:** `js/analytics/commercialDriverAnalysis.js`

---

## 1. Purpose and canonical management question

This contract governs analytical explanation of a selected commercial entity through transaction-derived business categories.

> For the selected governed execution entity and analytical snapshot, which LOBs or Products contribute to its Actual production, and which drive month-to-month growth or degrowth?

Driver analysis does not create execution policy, targets, priority, or structural relationships.

## 2. Existing capability and collision assessment

The repository currently retains LOB, Product Code, and Product Name on normalized transaction facts. Existing v8.1 analytics use these fields for breadth measures and Product Code/name conflict diagnostics. No governed commercial Product/LOB driver authority currently provides parent-scoped Actual mix, month movement, or reconciliation.

Step 4X is therefore additive. It must not replace productivity breadth, Data Quality conflicts, Step 4K comparison, Step 4V structural drill-down, or Step 4W presentation.

## 3. Driver analysis is not structural drill-down

Structural drill-down asks:

> Which governed child entities contribute to the selected parent?

Driver analysis asks:

> Which analytical business categories explain the selected entity's result?

LOB and Product are classifications of transaction production, not organisational, geographic, or operational descendants. They must not be added to the Step 4V path registry.

## 4. Supported parent and driver dimensions

V1 supports every governed commercial parent dimension already available through the commercial roll-up metadata:

```text
OVERALL
BANK
ZONE
STATE
BANK_REGION
BANK_ZONE
FGM_OFFICE
NATIONAL_HEAD
ZSM
ASM
CSM
ASSIGNED_RM
BRANCH
```

V1 supports two independent driver dimensions:

```text
LOB
PRODUCT
```

There is no `LOB -> PRODUCT` or `PRODUCT -> LOB` hierarchy. A caller selects one driver dimension for one analysis result.

## 5. Analysis modes

### 5.1 `EXECUTION_SNAPSHOT`

Explains Actual-to-Date mix for one selected parent using one exact `periodKey` and `asOfDay`.

For each driver, the mode supplies:

- Actual to Date;
- contribution to parent Actual when the denominator is valid;
- factual transaction/presence counts where useful for diagnostics.

It does not supply Budget, Potential, Achievement, pacing, required run-rate, projection, attention, or priority.

### 5.2 `MONTH_COMPARISON`

Explains full-month Actual movement between explicit `basePeriod` and `comparisonPeriod` values.

For each driver, the mode supplies:

- base Actual;
- comparison Actual;
- absolute change;
- growth percentage where valid;
- direction;
- base/comparison presence.

This mode has no `asOfDay`. It must not silently compare MTD against a complete month. Comparable-day analysis would require a separate future contract.

The two modes remain separate result contracts rather than a shared ambiguous set of optional measures.

## 6. Snapshot semantics

### Execution snapshot

Include only governed facts that:

- belong to the selected parent by durable metadata;
- have the exact selected `periodKey`;
- have a canonical valid day less than or equal to `asOfDay`;
- meet the same commercial Actual inclusion contract used by the supplied parent execution snapshot.

The supplied parent execution result must match the requested parent dimension, period, and cutoff.

### Month comparison

Include complete governed month Actuals for the exact base and comparison periods, consistent with Step 4K's comparison direction and eligibility semantics. No execution cutoff applies.

## 7. Parent identity and validation

A parent selection is:

```javascript
{
  parentDimension,
  parentKey,
  parentLabel
}
```

`parentDimension + parentKey` is authoritative. `parentLabel` is display-only and must never filter, join, or recover a missing parent.

Execution mode validates the parent against a supplied compatible Step 4N parent execution result. Comparison mode validates it against a supplied compatible Step 4K parent comparison result. A missing durable parent returns `PARENT_NOT_FOUND`; it is not treated as an empty success.

## 8. Driver identity

### LOB

The current canonical fact field is normalized transaction text: non-breaking spaces become ordinary spaces, surrounding whitespace is trimmed, and an empty result becomes `null`. V1 identity is:

```text
LOB:<canonical lob text>
```

The label is the canonical LOB text. Case and internal spelling differences remain distinct because the current pipeline has no LOB master or approved alias authority.

### Product

When Product Code is present:

```text
key   = PRODUCT_CODE:<canonical uppercase productCode>
label = canonical productName when present, otherwise productCode
```

Product Code/name conflicts remain Data Quality facts; the driver authority must not select a preferred conflicting name by first occurrence. A deterministic label policy must either use the unique governed name or the code with an explicit conflict diagnostic.

When Product Code is absent but Product Name is present:

```text
key   = PRODUCT_NAME:<canonical productName text>
label = canonical productName
```

This is explicitly a text-derived fallback identity, not a durable master identity. Case and spelling differences remain distinct. No fuzzy matching, case folding, or new aliases are introduced.

### Missing values

Missing LOB, or missing both Product Code and Product Name, maps to:

```text
key   = __UNMAPPED__
label = Unmapped
```

The unmapped bucket remains in all calculations and reconciliation.

## 9. Parent scoping and leakage prevention

The authority must scope row-level governed facts to the selected parent before grouping by LOB or Product.

Parent membership uses the same durable metadata projection as commercial roll-ups, including governed branch, bank, geography, bank-organisation, assignment, and current hierarchy IDs. `OVERALL` admits the complete eligible fact population.

The authority must never:

1. aggregate global LOB/Product totals first;
2. identify the parent by label;
3. filter global driver aggregates using a parent label afterward.

This pre-aggregation scope prevents duplicate labels and categories used across multiple parents from leaking values into the selected result.

Organisation parent scoping uses the current active assignment/hierarchy snapshot. Effective-dated historical attribution is not available.

## 10. Execution driver mathematics

For a driver `d`:

```text
driverActual(d)
=
sum of signed premium for eligible scoped transactions assigned to d
```

The parent Actual is supplied by the compatible Step 4N parent row, not independently reinterpreted.

Contribution is:

```text
contributionPercent(d)
=
driverActual(d) / parentActual * 100
```

only when:

```text
parentActual > 0
```

When parent Actual is zero or negative, every `contributionPercent` is `null`. Negative driver Actual remains negative and can produce a negative contribution when the positive parent denominator is valid. Offsetting signed drivers can make individual percentages unusual; this is factual signed mix, not a bounded share.

## 11. Signed premium treatment

Positive, zero, and negative premium are preserved. Driver Actual, parent Actual, and changes are never clamped, converted to absolute values, or discarded.

Zero-premium facts may contribute to diagnostic counts, but they do not create a fabricated driver universe beyond categories actually present in eligible scoped facts.

## 12. Month-comparison mathematics

The comparison row population is the union of driver keys observed in either governed month. An absent driver side has Actual zero while retaining explicit presence state.

For each driver:

```text
change = comparisonActual - baseActual
```

```text
growthPercent = change / baseActual * 100
```

only when `baseActual > 0`; otherwise it is `null`.

Direction is:

```text
UP   when change > 0
DOWN when change < 0
FLAT when change = 0
```

These rules match Step 4K and must not diverge.

## 13. Change-contribution decision

V1 does not expose `driverChange / parentChange` as a percentage. Signed offsetting changes can produce negative values, values over 100%, or unstable interpretation around a small parent change.

V1 also does not redefine this as share of absolute movement. The result exposes the signed driver change and reconciled parent change, which are sufficient factual context. Any later absolute-movement-share measure requires a separately named and documented metric.

## 14. Ordering and ranking

There is no driver `priorityRank`.

The authority may return a deterministic analytical display order:

- execution mode: signed Actual descending, then stable driver key;
- comparison mode: absolute change magnitude descending, then stable driver key.

This is presentation order, not management priority. The complete driver population is returned; there is no Top-N truncation.

## 15. Driver universe and Day 0

There is no configured Product or LOB universe in v1. Rows are materialized only from eligible scoped facts included by the selected mode.

At execution Day 0, no transactions satisfy `day <= 0`; therefore the result is `EMPTY`, parent Actual is expected to be zero, and no driver rows are fabricated from later-in-month facts. A future Product/LOB master could introduce an explicit zero-activity universe only through a new contract.

## 16. Reference-data boundaries

The current commercial reference master is keyed by branch and period, not Product or LOB. Therefore v1 driver analysis has:

- no Product/LOB Budget;
- no Product/LOB Potential;
- no Product/LOB Achievement;
- no Product/LOB expected Budget to date;
- no Product/LOB required run-rate or projection;
- no Product/LOB execution/reference attention;
- no Product/LOB priority.

Branch Budget and Potential must never be allocated by Actual mix, divided equally, inferred, or copied to drivers.

## 17. Reconciliation

### Execution snapshot

For a complete driver dimension:

```text
driverActualTotal = sum(driver Actual)
difference        = driverActualTotal - parentActual
```

Signed, zero, and `__UNMAPPED__` values participate. No clamping or tolerance policy is invented. A non-zero difference is reported factually and makes the result `PARTIAL` unless the input contract is invalid.

### Month comparison

Reconcile independently:

```text
sum(driver baseActual)       - parent baseActual
sum(driver comparisonActual) - parent comparisonActual
sum(driver change)           - parent change
```

All three differences are supplied. Completeness requires the same eligible fact contract and non-overlapping driver assignment for both months.

Ratios are not reconciled by summation.

## 18. Status contract

| Status | Meaning |
|---|---|
| `READY` | Valid compatible inputs and complete reconciled rows. |
| `PARTIAL` | Valid result with factual coverage, identity conflict, or reconciliation diagnostics. |
| `EMPTY` | Valid parent/snapshot with no eligible scoped driver facts. |
| `INVALID_INPUT` | Structurally invalid or incompatible supplied authority inputs. |
| `INVALID_PARENT` | Unsupported parent dimension or malformed parent identity. |
| `PARENT_NOT_FOUND` | Durable parent key absent from the supplied parent authority. |
| `INVALID_PERIOD` | Invalid, unavailable, or incompatible period selection. |
| `INVALID_AS_OF` | Invalid or incompatible execution cutoff. |
| `UNSUPPORTED_DRIVER` | Driver dimension is not exactly `LOB` or `PRODUCT`. |

Statuses are factual and have no severity or RAG meaning.

## 19. Proposed future API

```javascript
getSupportedDriverDimensions()

buildExecutionDrivers({
  parentSelection,
  parentExecutionResult,
  periodKey,
  asOfDay,
  driverDimension,
  facts,
  authorityContext
})

buildComparisonDrivers({
  parentSelection,
  parentComparisonResult,
  basePeriod,
  comparisonPeriod,
  driverDimension,
  facts,
  authorityContext
})
```

The authority consumes supplied/cached governed data only. It performs no repository or IndexedDB reads and has no UI responsibility.

## 20. Proposed result shapes

### Execution

```javascript
{
  status,
  mode: "EXECUTION_SNAPSHOT",
  periodKey,
  asOfDay,
  parent: {
    dimension,
    key,
    label,
    actual
  },
  driverDimension,
  rows: [{
    key,
    label,
    actual,
    contributionPercent,
    transactionCount
  }],
  reconciliation: {
    parentActual,
    driverActual,
    difference,
    complete
  },
  diagnostics: []
}
```

### Comparison

```javascript
{
  status,
  mode: "MONTH_COMPARISON",
  basePeriod,
  comparisonPeriod,
  parent: {
    dimension,
    key,
    label,
    baseActual,
    comparisonActual,
    change
  },
  driverDimension,
  rows: [{
    key,
    label,
    baseActual,
    comparisonActual,
    change,
    growthPercent,
    direction,
    presenceStatus
  }],
  reconciliation: {
    base: { parent, drivers, difference, complete },
    comparison: { parent, drivers, difference, complete },
    change: { parent, drivers, difference, complete }
  },
  diagnostics: []
}
```

Neither shape contains Budget, Potential, Achievement, run-rate, attention, or priority.

## 21. Diagnostics

Stable diagnostics should cover at least:

- invalid input structure;
- unsupported parent or driver dimension;
- missing or duplicate durable parent key;
- parent not found;
- period, cutoff, dimension, or mode mismatch;
- invalid/missing fact period or day;
- excluded facts under the governed commercial eligibility contract;
- missing LOB or Product identity retained as `__UNMAPPED__`;
- Product Code/name conflicts;
- text-derived Product fallback identities;
- parent-scope metadata unavailable or ambiguous;
- current-hierarchy-snapshot use;
- execution Actual reconciliation difference;
- base, comparison, or change reconciliation difference;
- contribution unavailable because parent Actual is not positive;
- growth unavailable because base Actual is not positive;
- empty scoped driver population.

Diagnostics report facts only; they do not create severity, recommendations, alerts, or priority.

## 22. Current data limitations and future migration

- LOB and Product are transaction-derived dimensions.
- Product Code is normalized uppercase, but there is no governed Product Master.
- Product Name and LOB are trimmed canonical text without approved case folding, aliases, or fuzzy resolution.
- Product Code/name conflicts exist as Data Quality signals and cannot be silently resolved.
- No Product/LOB Budget, Potential, target, or configured universe exists.
- Organisation parent scoping uses the current active hierarchy snapshot; historical effective-dated ownership is unavailable.

A future Product/LOB Master may introduce durable IDs, canonical labels, aliases, active universes, and effective dates. Migration must be explicit and versioned: legacy text/code keys must not silently change identity, historical aggregation, or reconciliation. The authority should retain a documented legacy-key-to-master-ID migration/audit path.

## 23. Future implementation test matrix

Step 4Y tests should cover:

1. exactly `LOB` and `PRODUCT` as independent supported drivers;
2. every supported parent dimension;
3. rejected parents, malformed selections, unsupported drivers, and label-only selection;
4. execution period and exact `asOfDay` validation;
5. month comparison without an execution cutoff;
6. durable parent scoping before driver aggregation;
7. duplicate parent labels and cross-parent leakage prevention;
8. LOB canonical trimmed-text identity without fuzzy/case folding;
9. Product Code identity, Product Name fallback, conflicts, and missing identity;
10. `__UNMAPPED__` retention;
11. positive, zero, and negative signed premium;
12. positive-parent contribution including negative driver contribution;
13. zero/negative parent contribution returning `null`;
14. base/comparison union, presence states, signed change, growth rules, and direction;
15. no change-contribution percentage and no priority rank;
16. deterministic complete ordering without Top-N truncation;
17. execution reconciliation including unmapped and negative rows;
18. base, comparison, and change reconciliation;
19. Day 0 `EMPTY` with no fabricated universe;
20. valid empty, parent-not-found, invalid period, invalid cutoff, and partial states;
21. no Budget/Potential allocation, Achievement, run-rate, attention, or priority fields;
22. no storage reads, no UI, input immutability, and deterministic output;
23. preservation of Steps 4K, 4N, 4V, 4W, and all legacy analytics.

## 24. Recommended next step

Recommended Step 4Y: implement and unit-test the pure `commercialDriverAnalysis.js` authority for both modes, using governed pre-aggregation parent scoping and supplied parent authority snapshots. Do not add UI until the authority passes reconciliation, identity, leakage, and preservation tests.

The main remaining architectural concern is fact-population compatibility: the implementation must use exactly the same eligible commercial Actual population as the supplied Step 4N or Step 4K parent result. If the existing APIs cannot expose that population without duplicating or changing their semantics, Step 4Y must stop and report the blocker rather than approximate reconciliation.
