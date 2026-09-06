# BancaTracker Enterprise v8.3

## Step 3A — Workforce Deployment / Branch Assignment v2 Contract

**Status:** Architecture contract
**Baseline:** Closed Sprint 1 Employee Workforce Foundation and Sprint 2 Direct Reporting Hierarchy
**Scope:** Define the governed, effective-dated relationship for where employees are deployed. No implementation.

## 1. Objective and ownership

Workforce Deployment answers **WHERE an employee is operationally deployed**. It is a relationship authority, not a person, reporting, branch, or business authority.

| Authority | Owns | Does not own or infer |
|---|---|---|
| Employee Master | Employee identity, employment state, designation and workforce attributes | Branch deployment or manager |
| Direct Reporting Hierarchy | Employee-to-manager relationships and their dates | Deployment, designation adjacency, or business ownership |
| Branch Master | Durable branch identity and branch/geography attributes | Employee deployment or premium ownership |
| Workforce Deployment | Employee-to-branch operational coverage and dates | Reporting hierarchy or premium attribution |
| Future Attribution authority | Deterministic business owner/allocation | Coverage merely because deployment exists |
| Budget/Potential | Branch-period commercial planning values | Deployment or attribution |

`DESIGNATION`, `ROLE`, branch geography, and manager relationship are never deployment identity or deployment-validity rules.

## 2. Native v2 canonical relationship

The logical relationship is:

```text
EMPLOYEE ID + durable BRANCH ID + DEPLOYMENT TYPE + VALID FROM
```

The durable Branch Master identity is `branchId`, built by the existing canonical rule `BANK ID:BRANCH CODE`. Native CSV uses `BANK ID` and `BRANCH CODE` to construct it; it must not substitute display branch name, BA code, or a transaction field.

| CSV header | Canonical property | Requirement | Meaning |
|---|---|---:|---|
| `EMPLOYEE ID` | `employeeId` | Required | Durable Employee Master identity. Text/code, normalized as Employee Master identity; never numeric-coerced. |
| `BANK ID` | `bankId` | Required | Branch Master bank component. |
| `BRANCH CODE` | `branchCode` | Required | Branch Master branch component; leading zeroes preserved. |
| derived | `branchId` | Required after normalization | Durable Branch Master identity. |
| `DEPLOYMENT TYPE` | `deploymentType` | Required | Controlled operational semantic: `PRIMARY` or `SUPPORT`. |
| `VALID FROM` | `validFrom` | Required | First inclusive effective date, strict `YYYY-MM-DD`. |
| `VALID TO` | `validTo` | Optional | Last inclusive effective date, strict `YYYY-MM-DD`; blank is open-ended. |

`recordId` is deterministic: `datasetId:employeeId:branchId:deploymentType:validFrom`. A deployment change is a new dated row; rows are never overwritten in place.

## 3. Eligibility and cardinality

Any valid Employee Master employee may be deployed: RM, USM, Executive, Coordinator, MT, CSM, ASM, ZSM, National Head, or another free-form designation. Deployment never asserts a legacy role or reporting relationship.

Assignments are many-to-many:

```text
one employee → many branches
one branch   → many employees
```

An active Branch Master identity is required for a new assignment. Unknown employees or branches block activation. A currently inactive branch does not erase valid history; it produces an explicit caution. A relationship conclusively outside a known branch effective interval blocks activation. Missing or insufficient Branch Master date information is a warning, never invented history.

`PRIMARY` means the designated operational lead for that branch at that time. `SUPPORT` means operational coverage without lead designation. Multiple concurrent `SUPPORT` assignments are valid. At most one concurrent `PRIMARY` deployment per branch is valid; a second concurrent primary blocks activation. An employee may hold deployments across multiple branches, including multiple primary deployments where operationally intended.

## 4. Temporal semantics

Boundaries are inclusive, aligned with Direct Reporting Hierarchy v2:

```text
VALID FROM <= asOfDate <= VALID TO
```

where blank `VALID TO` is open-ended. Resolution always requires an explicit valid `asOfDate`; it must not use browser time, upload time, or PR period implicitly.

- `VALID TO` before `VALID FROM` is invalid.
- Exact identity duplicates are invalid.
- Intervals for the same employee/branch pair must not overlap, regardless of deployment type; a simultaneous `PRIMARY` and `SUPPORT` row would otherwise describe contradictory coverage for the same person and branch.
- Historical reassignment closes the old interval and creates a non-overlapping new interval. Adjacent rows use consecutive dates.
- An interval conclusively before Employee `DATE OF JOINING` or after `EXIT DATE` is invalid. `INACTIVE`, `SUSPENDED`, or `LEAVE` without definitive dates is a warning, not fabricated temporal evidence.
- An interval conclusively outside available branch dates is invalid. A branch flagged inactive in a current snapshot is a warning because the snapshot cannot prove historical inactivity.

## 5. Validation taxonomy

### Blocking errors

| Proposed code | Condition |
|---|---|
| `DEPLOYMENT_V2_EMPLOYEE_ID_MISSING` | Blank employee identity. |
| `DEPLOYMENT_V2_EMPLOYEE_UNMAPPED` | Employee is absent from the active canonical Employee Master. |
| `DEPLOYMENT_V2_BRANCH_ID_MISSING` | `BANK ID` or `BRANCH CODE` cannot form a branch identity. |
| `DEPLOYMENT_V2_BRANCH_UNMAPPED` | Branch is absent from active Branch Master. |
| `DEPLOYMENT_V2_TYPE_INVALID` | Deployment type is not `PRIMARY` or `SUPPORT`. |
| `DEPLOYMENT_V2_VALID_FROM_MISSING` | Native row lacks `VALID FROM`. |
| `DEPLOYMENT_V2_DATE_INVALID` | Date is not a real `YYYY-MM-DD`. |
| `DEPLOYMENT_V2_DATE_ORDER_INVALID` | `VALID TO` precedes `VALID FROM`. |
| `DEPLOYMENT_V2_RELATIONSHIP_DUPLICATE` | Same employee, branch, type, and valid-from date occurs twice. |
| `DEPLOYMENT_V2_EMPLOYEE_BRANCH_OVERLAP` | Same employee/branch is effective in overlapping rows. |
| `DEPLOYMENT_V2_BRANCH_PRIMARY_OVERLAP` | More than one primary is effective for a branch at a date. |
| `DEPLOYMENT_V2_EMPLOYMENT_RANGE_CONFLICT` | Deployment lies conclusively outside Employee employment boundaries. |
| `DEPLOYMENT_V2_BRANCH_RANGE_CONFLICT` | Deployment lies conclusively outside known Branch Master boundaries. |
| `DEPLOYMENT_V2_CONTRACT_UNSUPPORTED` | Declared contract cannot be interpreted. |

### Warnings and readiness diagnostics

`DEPLOYMENT_V2_BRANCH_INACTIVE_CAUTION`, `DEPLOYMENT_V2_EMPLOYEE_STATE_CAUTION`, `DEPLOYMENT_V2_EMPLOYMENT_BOUNDARY_UNVERIFIED`, and `DEPLOYMENT_V2_BRANCH_BOUNDARY_UNVERIFIED` disclose uncertainty without changing history. `DEPLOYMENT_V2_EMPLOYEE_NO_ACTIVE_DEPLOYMENT` and `DEPLOYMENT_V2_BRANCH_NO_ACTIVE_DEPLOYMENT` are coverage diagnostics, not invalid graph conditions.

## 6. Runtime resolution contract

Step 3B may implement pure, explicit-date APIs such as:

```javascript
resolveEmployeeDeployments(employeeId, context, asOfDate)
resolveBranchDeployments(branchId, context, asOfDate)
```

Each returns a deterministic, sorted set of effective assignments, `PRIMARY`/`SUPPORT` semantic, source contract/status, and diagnostics. Suggested output includes `employeeId`, `branchId`, `deploymentType`, `validFrom`, `validTo`, `asOfDate`, and `status`.

No result may derive reporting managers, `rmId`, hierarchy slots, branch premium, assignment percentages, or rollup totals. Missing rows yield transparent `NO_DEPLOYMENT`/partial-coverage outcomes rather than fabricated deployment.

## 7. Business-attribution boundary

Deployment is **coverage**, not business ownership. When several employees are deployed to a branch, no deployment row authorizes counting that branch's premium once per employee. `PRIMARY` remains operational lead information; it is not a premium owner or allocation instruction.

Future employee-level, hierarchy-level, or deployment-based performance must first use a separately governed attribution rule with a deterministic owner or allocation. Its core reconciliation invariant is:

```text
sum(attributed business across employees) = underlying business total
```

subject only to explicitly documented exclusions. Until that authority exists, branch premium remains branch/transaction business and deployment analytics are non-additive coverage measures only.

## 8. Legacy v8.2 compatibility and metadata

The frozen legacy Branch Assignment shape is `BANK ID`, `BRANCH CODE`, `RM ID`, `ACTIVE`, with optional weak dates. It accepts only a single RM-oriented assignment per branch and its resolver returns one `rmId`. It must continue to use the existing authority/resolver unchanged.

Native v2 profiles are metadata-directed:

| Metadata state | Source profile | Interpretation |
|---|---|---|
| metadata absent | `LEGACY_V1_ASSUMED` | Existing RM-centric records/read behavior. |
| declared legacy | `LEGACY_V1` | Existing RM-centric records/read behavior. |
| declared version 2 | `WORKFORCE_DEPLOYMENT_V2` | Native effective-dated many-to-many deployment authority. |

Recommended metadata is:

```javascript
{
  dataContract: {
    name: "BRANCH_ASSIGNMENT",
    version: 2,
    sourceProfile: "WORKFORCE_DEPLOYMENT_V2",
    normalizerVersion: 2,
    dateBoundary: "INCLUSIVE",
    declaredAt: "ISO-8601 timestamp"
  }
}
```

`datasetVersion` remains repository lifecycle sequencing, not semantic contract version. Native and legacy contracts are never mixed in one dataset and are not silently promoted. Replacement is staged → active → superseded/failed; an invalid candidate cannot displace a valid active dataset. Existing stores and indexes can persist additive properties, so no IndexedDB change is proposed.

Legacy RM consumers remain on the legacy path. A future v2-to-legacy projection is explicitly lossy: it may expose an `rmId` only where a deterministic, contract-approved compatibility condition exists. It must never pick an arbitrary deployed employee, infer RM from designation, or treat `PRIMARY` as automatic legacy RM/premium ownership. Consumers must migrate to native deployment result collections before that projection can retire.

## 9. Explicit exclusions

Step 3A does not implement production code, tests, UI, IndexedDB/schema changes, Employee Master changes, reporting hierarchy changes, business/premium allocation, hierarchy performance rollups, budget/potential allocation, incentive logic, capacity optimization, territory inference, or assignment-history editing.

## 10. Acceptance criteria and next step

Step 3A is complete when this contract defines a durable effective-dated many-to-many deployment identity, supports arbitrary employees, protects Branch Master authority, separates coverage from business attribution, preserves legacy v8.2 reads through metadata-directed dual authority, and defines the validation, lifecycle, and consumer-migration boundaries without runtime change.

Recommended next step: **Step 3B — Workforce Deployment v2 Authority**. It should implement only constants/metadata classification, normalization, strict dates, dependency validation against canonical Employee and Branch contexts, overlap/primary validation, canonical persistence adaptation, and focused tests. It must not implement attribution, dashboards, rollups, UI migration, or a schema migration.
