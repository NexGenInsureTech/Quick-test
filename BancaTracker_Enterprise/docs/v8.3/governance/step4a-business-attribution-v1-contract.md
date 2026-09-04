# BancaTracker Enterprise v8.3

## Step 4A — Business Attribution v1 Contract

**Status:** Governance contract — no production implementation in this step.  
**Purpose:** Define a deterministic, reconciled basis for attributing accepted PR Actual to an employee without changing the v8.2/v8.3 compatibility boundaries.

## 1. Objective and design principles

Business Attribution answers one deliberately narrow question:

> Which zero-or-one employee, if any, can be directly associated with this accepted business record?

The contract preserves these principles:

- Attribution is record-level before any aggregation or management roll-up.
- No evidence means `UNATTRIBUTED`; it is a valid, visible result, never an error disguised as zero.
- Actual remains signed. Positive, zero, and negative premium are each attributed once or remain unattributed once.
- Employee identity is `EMPLOYEE ID`; names, designations, roles, BA labels, and deployment type are not identity substitutes.
- Attribution and analytical roll-up are separate operations.
- A result is reproducible from the accepted PR record, its canonical enrichment result, and the explicitly versioned/effective authorities used for the relevant business date.

## 2. Actual current evidence

The current accepted PR CSV contract requires `USGI NET PREMIUM`, `Month`, `INTERMEDIARY`, `BA NAME`, `Ba Code`, `LINE OF BUSINESS`, and `BRANCH NAME`. It may contain `SUM IMD CODE` and `POLICY ISSUED DATE`, among other optional descriptive fields.

The import and canonical pipeline currently establish the following evidence:

| Source / canonical field | Current meaning | Attribution use in v1 |
|---|---|---|
| `Ba Code` → `baCode` → canonical `sourceRmId` | The only row-level producer-like identifier. The shadow adapter passes it as `rmId`; canonical enrichment normalizes it into `sourceRmId`. | Primary direct-evidence candidate, only after an exact `EMPLOYEE ID` match is proven. |
| `BA NAME` → `rm` / `sourceRmName` | Source-supplied descriptive name paired with the BA field. | Corroborating display/diagnostic evidence only; never an identity match by name. |
| `SUM IMD CODE` → `branchCode` and `imd` | Current PR branch/IMD code input. It is not an employee identifier. | Resolves branch context only; never employee ownership by itself. |
| `POLICY ISSUED DATE` → canonical `policyIssuedDate` | Canonical date authority when parseable. | Determines the attribution as-of date. |
| Legacy Branch Assignment `RM ID` → `assignedRmId` | Governed branch-to-RM relationship used today as commercial metadata. | Conditional lower-precedence compatibility evidence, subject to the rules below. |
| Direct Reporting Hierarchy v2 | Effective-dated employee-to-manager graph. | Roll-up context after direct attribution only. |
| Workforce Deployment v2 `PRIMARY` / `SUPPORT` | Effective-dated workforce deployment relationship. | Context/coverage only; never ownership evidence. |

No accepted PR field currently supplies a durable transaction-level `EMPLOYEE ID`. In particular, the system must not treat `BA NAME`, branch identity, IMD identity, designation, hierarchy role, or a deployment as an implicit employee ID.

## 3. Canonical attribution unit and output

The attribution unit is one accepted PR row represented by its corresponding canonical enrichment result. It is not a policy-level consolidation (a policy number is not required by the accepted PR contract), branch aggregate, employee aggregate, or deployment record.

A future authority must preserve source-row provenance and return one immutable attribution result per included canonical record:

| Field | Meaning |
|---|---|
| `attributionStatus` | Deterministic status from section 7. |
| `employeeId` | One canonical Employee Master identity, or `null`. |
| `evidenceType` | `SOURCE_RM_ID`, `LEGACY_BRANCH_ASSIGNMENT`, or `NONE`. |
| `businessDate` | Canonical `policyIssuedDate`, or `null` when unavailable. |
| `signedActual` | Exact accepted canonical premium, including negative and zero values. |
| `diagnostics` | Stable, de-duplicated codes explaining non-resolution, conflict, or compatibility conditions. |

The cardinality is zero-or-one employee per unit in v1. A record must never be split between multiple employees, hierarchy members, or primary/support deployment participants.

## 4. Evidence precedence and resolution

Attribution must evaluate evidence in the following order. Lower-precedence evidence is considered only when a higher-precedence candidate is absent, not when it is contradictory or ambiguous.

1. **Canonical source RM identity.** Use canonical `sourceRmId` only when it exactly equals one active/effective Employee Master `employeeId` at the business date. `sourceRmName` can be retained for a name-mismatch diagnostic but cannot create or change the match.
2. **Legacy Branch Assignment compatibility evidence.** Only when `sourceRmId` is absent, use the active legacy `BRANCH_ASSIGNMENT` relationship for the canonical `branchId` when it yields exactly one `assignedRmId`, that ID exactly matches one Employee Master identity, and the relationship is valid for the business date where temporal bounds are available. This is a clearly labelled compatibility attribution, not proof that a Workforce Deployment owner made the sale.
3. **No fallback.** Do not use Workforce Deployment, Direct Reporting Hierarchy, designation, employee name, BA name, IMD, branch name, or fuzzy matching to produce an owner.

If `sourceRmId` is present but does not match a valid employee, is ambiguous, conflicts with a legacy assignment, or the required as-of authority cannot be established, do not fall back to branch assignment. Return `UNATTRIBUTED` with the relevant diagnostic. A source-versus-assignment difference remains observable; it must not silently rewrite the source claim.

Native Workforce Deployment v2 intentionally replaces the Branch Assignment dataset type for deployment information and has no v1 business-owner projection. Its `PRIMARY` designation means primary deployment, not producer ownership. Therefore a native deployment context never satisfies step 2.

## 5. Temporal semantics

The attribution as-of date is the canonical `policyIssuedDate`. The date must be parsed and valid; the current/activation date must never be substituted.

- Employee employment state and date boundaries are evaluated as of the business date.
- Legacy assignment temporal boundaries are evaluated as of the business date if such bounds are supplied and valid.
- Direct Reporting Hierarchy v2 is resolved as of the business date only after an employee has been directly attributed.
- Workforce Deployment v2 may be displayed as contextual deployment information at the business date, but cannot change `employeeId` or `attributionStatus`.
- A record with unavailable/invalid canonical business date cannot obtain temporal attribution. It remains `UNATTRIBUTED` with `ATTRIBUTION_BUSINESS_DATE_UNAVAILABLE` even if it remains present in other legacy/current-period views.

## 6. Direct attribution versus analytical roll-up

Direct attribution assigns signed Actual once to the resolved employee. Analytical hierarchy roll-up may subsequently show that same employee-owned Actual in manager contexts using Direct Reporting Hierarchy v2 as of the same business date.

Manager rows are analytical aggregations, not additional direct-attribution records. They must not be added to the reconciliation numerator and must not cause premium duplication. The hierarchy must not be used to fill an unresolved producer.

Likewise, `PRIMARY` and `SUPPORT` deployments can describe where an employee was deployed, but neither type allocates, shares, or transfers the PR row's signed Actual.

## 7. Statuses, diagnostics, and ambiguity

The future authority shall expose deterministic statuses, at minimum:

| Status | Employee ID | Required diagnostic examples |
|---|---|---|
| `ATTRIBUTED_SOURCE_RM_ID` | resolved | `SOURCE_RM_ID_MATCHED` |
| `ATTRIBUTED_LEGACY_BRANCH_ASSIGNMENT` | resolved | `LEGACY_BRANCH_ASSIGNMENT_MATCHED`, `COMPATIBILITY_ATTRIBUTION` |
| `UNATTRIBUTED` | `null` | `ATTRIBUTION_SOURCE_RM_ID_MISSING`, `ATTRIBUTION_SOURCE_RM_ID_UNMAPPED`, `ATTRIBUTION_SOURCE_RM_ID_AMBIGUOUS`, `ATTRIBUTION_SOURCE_ASSIGNED_RM_CONFLICT`, `ATTRIBUTION_BRANCH_UNRESOLVED`, `ATTRIBUTION_BUSINESS_DATE_UNAVAILABLE`, or `ATTRIBUTION_ASSIGNMENT_UNAVAILABLE`, as applicable |
| `EXCLUDED` | `null` | Existing canonical invalid/exclusion reason; excluded rows are reported separately from accepted Actual reconciliation. |

Diagnostics are additive and deterministic. Ambiguity, malformed identity, unknown employee, conflicting source/assignment evidence, unavailable authority, and an inactive/not-effective employee must produce no employee attribution. No arbitrary first-match selection is permitted.

## 8. Signed-Actual reconciliation invariant

For every defined attribution population of accepted canonical records:

```text
sum(Attributed signed Actual)
+ sum(Unattributed signed Actual)
= sum(Underlying accepted canonical signed Actual)
```

This holds separately for positive, zero, negative, and total signed premium; it also holds at every later analytical slice. Hierarchy roll-ups, deployment context, and display-only manager totals are outside this direct-attribution equation.

Canonical-invalid or commercial-excluded records retain their existing diagnostic treatment and must be disclosed as an adjacent excluded population, never silently absorbed into `UNATTRIBUTED`.

## 9. Compatibility boundaries

- **Legacy PR:** `Ba Code`/`BA NAME` remain accepted and preserve their current normalized fields. This contract does not rename or require a new PR column.
- **Legacy branch assignment:** remains a constrained compatibility fallback only as specified in section 4. Existing commercial `assignedRmId` metadata is not retroactively redefined as transaction-level proof.
- **Native Employee Master v2:** free-form `DESIGNATION` and transitional `ROLE` remain workforce/hierarchy compatibility attributes; neither governs ownership.
- **Direct Reporting Hierarchy v2:** supplies dynamic manager context for a resolved employee and supports skip levels without altering attribution cardinality.
- **Workforce Deployment v2:** remains deployment-only and intentionally isolates native records from legacy RM assignment resolution.
- **IMD / BA / branch fields:** remain business/branch descriptors unless an explicitly governed future contract establishes an employee identity relationship.

## 10. Explicit exclusions for Step 4A

This step does not implement an attribution engine, UI, report, API, test suite, persistence model, IndexedDB migration, PR schema change, commercial-formula change, hierarchy traversal change, deployment change, allocation percentage, multi-owner allocation, commission calculation, target credit, or retroactive data correction.

It does not infer ownership from designation, role, name, `PRIMARY` deployment, support deployment, manager relationship, branch, IMD, or current state.

## 11. Future migration path

If reliable transaction-level ownership cannot be evidenced by `Ba Code` exactly matching Employee Master identity, a later PR contract version may add an optional durable `EMPLOYEE ID`/producer-identity field with source-system lineage. That migration must:

1. preserve current PR acceptance and legacy `Ba Code` behavior;
2. define explicit source precedence and conflict diagnostics between the new field and `Ba Code`;
3. be versioned, documented, and tested for signed reconciliation;
4. retain `UNATTRIBUTED` rather than guessing during partial adoption; and
5. avoid backfilling historical ownership from current deployment or current hierarchy.

## 12. Step 4B implementation gate

Step 4B may implement a narrow authority only if it preserves this contract's one-record/zero-or-one-employee cardinality, status/diagnostic behavior, as-of rules, and signed reconciliation. There is no architectural blocker to a source-identity-first implementation.

The material data-quality gap is that `Ba Code` is not independently proven to be an Employee Master ID in every historical file. Step 4B must therefore measure and expose match, unmapped, conflict, and unattributed coverage rather than assume full attribution.

## 13. Acceptance criteria for Step 4A

- [x] Current PR producer-like fields and their actual canonical mappings are documented.
- [x] No unobserved transaction-level employee source field is invented.
- [x] One-record/zero-or-one-employee attribution and first-class `UNATTRIBUTED` are defined.
- [x] Signed Actual and direct-attribution reconciliation are preserved.
- [x] Direct Reporting Hierarchy and Workforce Deployment are separated from ownership.
- [x] Legacy PR and Branch Assignment compatibility boundaries are explicit.
- [x] Step 4B is constrained by deterministic temporal and diagnostic requirements.
