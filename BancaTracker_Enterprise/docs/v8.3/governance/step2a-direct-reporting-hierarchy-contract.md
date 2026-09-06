# BancaTracker Enterprise v8.3

## Sprint 2A — Direct Reporting Hierarchy v2 Contract

**Status:** Architecture contract  
**Baseline:** v8.2.0 and the closed v8.3 Sprint 1 Employee Workforce Foundation  
**Scope:** Direct employee reporting relationships and their temporal semantics only; no implementation

## 1. Objective

Define a durable Hierarchy Master v2 in which the authoritative relationship is:

```text
EMPLOYEE ID → MANAGER EMPLOYEE ID
```

The hierarchy is an effective-dated directed employee graph. Designation and legacy Role describe or temporarily classify people; neither determines whether an edge is valid. The contract supports skip levels, arbitrary designations, variable depth, multiple roots, historical manager changes, and non-destructive coexistence with v8.2 hierarchy datasets.

## 2. Design principles

1. An edge states who reports directly to whom and when.
2. Employee identity and employment facts remain owned by Employee Master.
3. Reporting validity never depends on designation, grade, band, or legacy role adjacency.
4. Every v2 relationship is explicitly effective-dated and resolved at an explicit as-of date.
5. Root status is explicit; absence of a relationship row does not imply that an employee is a root.
6. Skip-level edges and variable-depth chains are normal graph structures.
7. One employee can have at most one effective manager/root declaration at any instant within one hierarchy dataset.
8. Historical edges are retained; a manager change creates a new interval rather than overwriting an old edge.
9. Legacy fixed-role outputs are compatibility projections only. Missing levels remain missing.
10. Dataset contract version is separate from repository `datasetVersion`.

## 3. Canonical CSV and record contract

| CSV header | Canonical property | v2 requirement | Format | Meaning |
|---|---|---:|---|---|
| `EMPLOYEE ID` | `employeeId` | Required | Text/code | Durable Employee Master identity of the direct report. |
| `MANAGER EMPLOYEE ID` | `managerEmployeeId` | Required except explicit root row | Text/code or blank | Durable Employee Master identity of the direct manager. Blank means this row explicitly declares a root. |
| `VALID FROM` | `validFrom` | Required | Strict `YYYY-MM-DD` | First calendar date on which this relationship/root declaration is effective. |
| `VALID TO` | `validTo` | Optional | Strict `YYYY-MM-DD` or blank | Last calendar date on which it is effective. Blank means open-ended. |

The accepted v2 header is `MANAGER EMPLOYEE ID`. The legacy header `MANAGER ID` belongs to the legacy contract and is not silently treated as native v2 merely because its values look compatible.

Normalization follows Employee Master identity rules: trim, normalize case, preserve meaningful punctuation and leading zeroes, and never coerce IDs to numbers. Dates must be real canonical Gregorian dates.

No designation, role, employee name, hierarchy level, or fixed slot is stored on the relationship row. Display attributes come from Employee Master at runtime.

## 4. Relationship identity

Within a dataset, the durable logical identity is:

```text
EMPLOYEE ID + VALID FROM
```

The persisted key should be derived deterministically as:

```text
datasetId + employeeId + validFrom
```

This supports multiple historical intervals for an employee without relying on row order or manager designation. Two rows with the same normalized `EMPLOYEE ID + VALID FROM` are duplicates and block activation, even if their managers differ. A changed correction is represented through normal dataset replacement/versioning, not by mutating an active record.

## 5. Effective-date semantics

Both boundaries are **inclusive**. A relationship is effective at date `D` when:

```text
VALID FROM <= D
and
(VALID TO is blank or D <= VALID TO)
```

Rules:

- `VALID FROM` is mandatory for native v2.
- Blank `VALID TO` represents an open-ended interval.
- `VALID TO` must be on or after `VALID FROM`; a one-day relationship is valid.
- Intervals for the same employee must not overlap, including at an inclusive boundary.
- Adjacent changes therefore use consecutive dates: one interval ends `2025-09-30`, the next begins `2025-10-01`.
- Gaps are permitted but resolve as no relationship for dates inside the gap.
- Resolution always requires an explicit, valid `asOfDate`; it never uses the browser clock or latest transaction date implicitly.

Example:

| Employee | Manager | Valid from | Valid to |
|---|---|---|---|
| `RM001` | `CSM001` | `2025-04-01` | `2025-09-30` |
| `RM001` | `ZSM002` | `2025-10-01` | blank |

- As of `2025-08-31`: direct manager is `CSM001`.
- As of `2026-01-31`: direct manager is `ZSM002`.

## 6. Roots and organisational components

A root is represented by an explicit effective-dated row with a blank `MANAGER EMPLOYEE ID`. Root designation is irrelevant.

- Multiple roots are valid because the dataset may contain multiple businesses, channels, or organisational components.
- More than one effective root is a warning/informational structural condition, not an error.
- A connected component terminating at an explicit effective root is a valid organisational component.
- A component whose chain terminates at an employee without an effective relationship/root row is partial, not silently promoted to a root.
- An employee with no hierarchy row is unmapped for that as-of date. This can reduce coverage without making every otherwise valid relationship invalid.
- A root row with a nonblank manager is not a root; no designation may override the edge.

The contract does not require exactly one National Head or any employee with that designation.

## 7. Skip-level and variable-depth reporting

All of the following are valid when identities, dates, and graph invariants pass:

```text
RM          → NATIONAL_HEAD
EXECUTIVE   → ZSM
COORDINATOR → ASM
MT          → RM
USM         → CSM
```

The labels above are illustrative Employee Master designations. They are never adjacency rules. Direct reports may connect to any existing manager identity, and reporting depth may differ across employees and dates.

## 8. Graph invariants and validation taxonomy

### 8.1 Blocking errors

| Proposed code | Condition |
|---|---|
| `HIERARCHY_V2_EMPLOYEE_ID_MISSING` | Employee identity is blank. |
| `HIERARCHY_V2_EMPLOYEE_UNMAPPED` | Employee does not exist in the governing Employee Master. |
| `HIERARCHY_V2_MANAGER_UNMAPPED` | Nonblank manager does not exist in Employee Master. |
| `HIERARCHY_V2_SELF_REFERENCE` | Employee and manager identities are equal. |
| `HIERARCHY_V2_VALID_FROM_MISSING` | Native v2 row has no `VALID FROM`. |
| `HIERARCHY_V2_DATE_INVALID` | A relationship date is malformed or not a real `YYYY-MM-DD` date. |
| `HIERARCHY_V2_DATE_ORDER_INVALID` | `VALID TO` precedes `VALID FROM`. |
| `HIERARCHY_V2_RELATIONSHIP_DUPLICATE` | Duplicate normalized `EMPLOYEE ID + VALID FROM`. |
| `HIERARCHY_V2_RELATIONSHIP_OVERLAP` | Two intervals for the same employee overlap. This also prevents two managers or manager/root declarations at one as-of date. |
| `HIERARCHY_V2_CYCLE_DETECTED` | A directed cycle exists during any period in which all involved edges overlap temporally. |
| `HIERARCHY_V2_EMPLOYMENT_RANGE_CONFLICT` | An edge/root interval is definitively before the employee's join date or after the employee's exit date; likewise, a manager assignment extends outside the manager's known employment range. |
| `HIERARCHY_V2_CONTRACT_UNSUPPORTED` | Dataset declares an unsupported hierarchy contract. |

Cycle detection must be temporal. Edges that never coexist must not be reported as a cycle merely because their historical union appears cyclic.

### 8.2 Non-blocking warnings and coverage diagnostics

| Proposed code | Condition |
|---|---|
| `HIERARCHY_V2_MULTIPLE_ROOTS` | More than one explicit root is effective at the evaluated date. |
| `HIERARCHY_V2_EMPLOYEE_RELATIONSHIP_MISSING` | An Employee Master identity has no effective relationship/root declaration at the evaluated date. |
| `HIERARCHY_V2_CHAIN_INCOMPLETE` | Traversal reaches an employee with no effective row instead of an explicit root. |
| `HIERARCHY_V2_DISCONNECTED_COMPONENTS` | More than one rooted component is present; factual and non-blocking unless a later governance policy requires one component. |
| `HIERARCHY_V2_DEEP_CHAIN` | Depth exceeds a separately governed diagnostic threshold. No threshold is hard-coded by this contract. |
| `HIERARCHY_V2_EMPLOYEE_STATE_CAUTION` | Current snapshot status is `INACTIVE`, `SUSPENDED`, or otherwise requires interpretation but dates do not prove an integrity conflict. |
| `HIERARCHY_V2_HISTORICAL_EMPLOYEE_LIMITATION` | Current Employee snapshot cannot prove the employee attributes/status applicable to a historical as-of date. |

Warnings do not fabricate edges or roots.

## 9. Employee Master interaction

Both `EMPLOYEE ID` and a nonblank manager ID must resolve to durable Employee Master identities.

- `EXITED` employees and managers remain valid participants in historical chains when the relationship interval is within their known joining/exit boundaries.
- A relationship definitively effective after an employee or manager Exit Date is a blocking range conflict.
- A relationship definitively effective before a supplied Date of Joining is a blocking range conflict.
- Current `EXITED` status does not invalidate a historically correct edge.
- `INACTIVE` or `SUSPENDED` without an Exit Date does not by itself prove an invalid relationship; surface a temporal/readiness warning.
- Missing optional Employee dates reduce the ability to cross-check ranges but do not invent dates or automatically invalidate an otherwise coherent edge.
- An employee with no effective hierarchy row resolves as `EMPLOYEE_NOT_MAPPED`/partial coverage, not as a root.

Employee snapshot limitations must be explicit: a current Employee Master cannot reconstruct old designations or transient status changes. Hierarchy resolution does not need those attributes to follow valid historical edges.

## 10. Historical resolution and chain derivation

At an explicit `asOfDate`, the resolver should:

1. select at most one effective row per employee;
2. start at the requested employee;
3. follow `managerEmployeeId` edges;
4. stop at an explicit root, missing effective edge, missing identity, or defensive cycle/depth guard;
5. return the traversed identities in order without interpreting designations.

Canonical runtime output:

```javascript
{
  status,
  asOfDate,
  employeeId,
  directManagerId,
  reportingChain: [
    { employeeId, managerEmployeeId, relationshipId, validFrom, validTo }
  ],
  reportingDepth,
  rootEmployeeId,
  stoppedAtEmployeeId,
  diagnostics
}
```

`reportingChain` begins with the requested employee's effective relationship and proceeds upward. `reportingDepth` is the number of manager edges traversed; a root has depth zero. `rootEmployeeId` is populated only when traversal reaches an explicit root. Consumers can derive `managerLevel1`, `managerLevel2`, and so on from array position, but unbounded `reportingChain[]` is authoritative.

## 11. Legacy v8.2 coexistence

Legacy v8.2 Hierarchy Master is role-constrained and uses `EMPLOYEE ID`, `MANAGER ID`, optional weakly defined dates, and fixed result slots. Although legacy rows resemble direct edges, their semantics are not sufficient to assume native v2.

Decision: use metadata-directed dual-read and explicit replacement.

- Metadata absent: `LEGACY_V1_ASSUMED`.
- Explicit legacy declaration: `LEGACY_V1`.
- Native contract: `DIRECT_REPORTING_V2`.
- No mixed hierarchy dataset is authorized initially. Mixing weak legacy dates with strict v2 intervals would make resolution nondeterministic.
- Unknown/future versions are unsupported and must not be interpreted or activated as v2.
- Legacy datasets retain current v8.2 validation and resolution until explicitly replaced.
- Native v2 relationships use direct graph rules only; role adjacency is not applied.
- No legacy dataset is rewritten, copied, or converted on read.

### 11.1 Fixed-slot compatibility projection

Existing consumers may temporarily require `rmId`, `csmId`, `asmId`, `zsmId`, and `nationalHeadId`. These are derived projections, never the v2 graph representation.

For every employee actually present in the resolved v2 chain, a fixed slot may be populated only from that employee's explicit recognized `legacyHierarchyRole` compatibility projection. Designation must not populate a slot. Missing levels remain `null`.

Example: for `RM002 → NH001`, if those two employees carry explicit compatible legacy roles, projection may set `rmId = RM002` and `nationalHeadId = NH001`; `csmId`, `asmId`, and `zsmId` remain `null`. No intermediate employee is invented. If explicit role projections are absent, the authoritative chain still resolves while all legacy slots may remain null.

## 12. Dataset metadata

Recommended metadata under the existing dataset `metadata` property:

```javascript
{
  dataContract: {
    name: "HIERARCHY_MASTER",
    version: 2,
    sourceProfile: "DIRECT_REPORTING_V2",
    normalizerVersion: 2,
    dateBoundary: "INCLUSIVE",
    declaredAt: "ISO-8601 timestamp"
  }
}
```

Supported classifications are `LEGACY_V1_ASSUMED`, `LEGACY_V1`, and `DIRECT_REPORTING_V2`. `datasetVersion` remains only the repository lifecycle sequence and must not identify the hierarchy schema.

## 13. Persistence and migration decision

The existing repository and IndexedDB v2 store can persist this contract without a schema change:

- existing `recordId` key supports a deterministic dataset/employee/valid-from key;
- the existing `datasetId` index is sufficient to load the active relationship set and build an in-memory as-of graph; legacy `managerId` indexing remains untouched, while native `managerEmployeeId` needs no index for this design;
- `validFrom`, `validTo`, `managerEmployeeId`, and contract metadata are additive object properties;
- no date index is required for the initial local dataset sizes because resolution operates over active-dataset records in memory.

Therefore Sprint 2A requires **no IndexedDB version bump, new store, index, or key-path change**. If future scale proves date-indexed queries necessary, that requires a separately reviewed migration.

Migration is explicit and non-destructive:

```text
legacy remains ACTIVE
        ↓ validate explicit v2 source and Employee dependencies
new v2 dataset STAGED with contract metadata
        ↓ save complete relationship history
atomically activate pointer
v2 ACTIVE; legacy SUPERSEDED and retained unchanged
```

Invalid candidates cannot displace the active dataset. No in-place migration or silent date/default fabrication is permitted.

## 14. Readiness taxonomy

| Status | Meaning |
|---|---|
| `HIERARCHY_UNAVAILABLE` | No active hierarchy dataset exists. Employee Master may still be ready. |
| `HIERARCHY_UNSUPPORTED_CONTRACT` | Active metadata declares a version this application cannot interpret. |
| `HIERARCHY_INVALID` | Blocking identity, interval, overlap, cycle, or employment-range errors exist. No authoritative graph is exposed. |
| `HIERARCHY_LEGACY_COMPATIBILITY` | Active dataset uses the v8.2 compatibility authority. |
| `HIERARCHY_READY` | Native v2 graph is valid and all in-scope employees resolve to explicit roots at the as-of date. |
| `HIERARCHY_PARTIAL` | Native graph is valid, but some Employee Master identities have no effective relationship or chains terminate without an explicit root. Valid chains remain usable with coverage disclosed. |

Per-employee resolution distinguishes at least:

- `RESOLVED_TO_ROOT`
- `ROOT`
- `EMPLOYEE_NOT_FOUND`
- `EMPLOYEE_NOT_MAPPED`
- `HISTORICAL_RELATIONSHIP_NOT_FOUND`
- `CHAIN_INCOMPLETE`
- `INVALID_GRAPH`
- `UNSUPPORTED_CONTRACT`

Coverage counts should report Employee Master population, mapped employees, explicit roots, complete chains, incomplete chains, and relationship gaps for the requested as-of date. A valid partial hierarchy is not mislabeled as an invalid graph.

## 15. Separation of concerns

| Authority | Owns | Does not own/infer |
|---|---|---|
| Employee Master | **WHO** the person is; workforce attributes and employment dates | Manager edges or branch deployment |
| Hierarchy Master | **WHO reports to WHOM and WHEN** | Designation, fixed-role adjacency, branch assignment |
| Branch Assignment Master | **WHERE** the employee is deployed and **WHEN** | Reporting manager or employee designation |
| Designation | **WHAT** the employee is called | Hierarchy level or edge validity |
| Hierarchy traversal authority | Runtime as-of graph selection, chains, roots, depth, coverage | Persistence mutation or fabricated relationships |

## 16. Future analytics support

The direct graph plus explicit intervals can later support span of control, reporting depth, organisation trees, manager-level rollups, manager productivity, vintage by manager, manpower reporting, attrition context, and restructuring comparisons. Those consumers must specify an as-of date and aggregate over durable employee identities and resolved edges—not designations or fixed slots.

No analytics formula, UI, depth threshold, or organisation policy is defined in Sprint 2A.

## 17. Key migration risks

1. Legacy `VALID FROM`/`VALID TO` meaning is weak; treating it as strict v2 history would create false precision.
2. Native v2 Employee records without explicit legacy roles cannot populate old fixed slots, even though their direct graph can resolve correctly.
3. Partial Employee date coverage limits employment-range cross-checking.
4. Historical hierarchy can be accurate while historical descriptive Employee attributes remain unavailable from current snapshots.
5. Downstream code that assumes one fixed five-level path must migrate to `reportingChain[]` before compatibility projections can retire.
6. Inclusive end dates require non-overlapping consecutive intervals; same-day handovers would overlap and must be corrected at source.

## 18. Explicit exclusions

Sprint 2A does not implement:

- production JavaScript or tests;
- direct graph construction, traversal, or cycle detection code;
- hierarchy resolver or validation changes;
- persistence or IndexedDB changes;
- automatic legacy migration;
- UI or analytics;
- branch assignment changes;
- release/version changes.

## 19. Sprint 2A acceptance criteria

Sprint 2A is complete when this document:

- makes employee-to-manager identity the sole hierarchy authority;
- defines deterministic relationship identity and inclusive effective dates;
- supports explicit roots, multiple rooted components, skip levels, and variable depth;
- separates blocking graph failures from coverage/readiness warnings;
- defines historical as-of chain outputs without fixed role levels;
- protects legacy behavior through metadata-directed dual-read and non-destructive replacement;
- prohibits designation inference and fabricated legacy slots;
- confirms the current IndexedDB schema is sufficient; and
- records migration risks and explicit implementation exclusions.

## 20. Recommended Sprint 2B implementation scope

Sprint 2B should implement only the Hierarchy Master v2 normalization and validation authority:

1. add hierarchy contract constants and explicit metadata classification;
2. accept the exact v2 headers and strict relationship dates defined here;
3. normalize deterministic relationship identities;
4. validate Employee/manager existence, self-reference, duplicates, overlaps, temporal cycles, and known employment boundaries;
5. preserve the existing v8.2 validator behind an explicit legacy contract path;
6. add focused authority tests for skip levels, roots, dates, overlap, cycles, and designation independence;
7. leave resolver traversal, repository read adaptation, persistence wiring, UI, and analytics to separately approved steps; and
8. make no IndexedDB schema change.
