# BancaTracker Enterprise v8.3

## Step 5A — Workforce Performance Analytics Contract

**Status:** Governance contract — no implementation in this step.  
**Purpose:** Define the smallest analytical contract that combines governed workforce context with detached, reconciled business attribution.

## 1. Authorities consumed

Sprint 5 consumes, but does not replace, these authorities:

| Authority | Responsibility in Sprint 5 |
| --- | --- |
| Employee Master v2 | Durable `employeeId` and workforce/effectivity attributes. |
| Direct Reporting Hierarchy v2 | As-of employee-to-manager membership and analytical ancestry. |
| Workforce Deployment v2 | As-of operational deployment context only. |
| Temporal Business Attribution | One direct employee owner or `UNATTRIBUTED` per canonical accepted PR record. |
| Attribution Reconciliation | Signed-Actual reconciliation, coverage and slice diagnostics. |
| Attribution Hierarchy Roll-up | Manager/root analytical context for already-attributed records. |

No authority is allowed to infer an employee from a name, designation, role, hierarchy position, or deployment.

## 2. Non-negotiable boundaries

- Employee identity is exact `employeeId`.
- Direct attribution is the only source of employee-owned Actual.
- A manager’s roll-up is an analytical view of subordinate direct Actual; it is not a second ownership claim.
- Deployment (`PRIMARY` or `SUPPORT`) describes coverage, never premium ownership or allocation.
- Actual stays signed, including zero and negative values. `UNATTRIBUTED` is a visible population.
- Historical hierarchy and deployment are resolved at the canonical business date, never today’s date.
- Overlapping hierarchy nodes are not independent financial buckets and must never be summed together.
- The authority is pure: it receives governed records/contexts; it does not read persistence.

## 3. Analytical grains

| Output | Grain | Financial interpretation |
| --- | --- | --- |
| Direct employee performance | employee + selected canonical slice | Sum of only directly attributed records. |
| Team performance | manager/root node + selected canonical slice + as-of hierarchy membership | Analytical roll-up only; overlaps with ancestor/descendant nodes. |
| Deployment-business alignment | employee + branch + business/as-of date, then selected period/slice | Coverage classification, not ownership or allocation. |
| Coverage/reconciliation | selected canonical PR population | Must reconcile to accepted signed Actual. |

All identity-dependent filtering occurs on canonical record identities and detached attribution results before aggregation. Labels are presentation data only.

## 4. Direct employee performance

For each employee in the selected scope, derive only from detached attribution results whose `employeeId` exactly matches:

| Field | Definition |
| --- | --- |
| `employeeId` | Canonical Employee Master identity. |
| `directAttributedRecordCount` | Count of direct attribution results for that employee. |
| `directSignedActual` | Sum of those results’ `signedActual`. |
| `directContributionPercent` | `directSignedActual / selected attributed signed Actual * 100`; `null` when the denominator is zero. |
| `attributionCoverage` | Scoped attribution/reconciliation coverage and status; it is not silently assumed to be 100%. |
| `reportingPeriod` / `asOf` | The selected canonical period and the per-record `businessDate` evidence used by attribution. |

`directContributionPercent` is a contribution to the selected **attributed** population, not an achievement, target, or whole-PR claim. The accompanying coverage makes the excluded/unattributed gap explicit.

## 5. Team performance

### Membership and convention

Team membership is the Direct Reporting Hierarchy v2 roll-up node set resolved separately for each record’s business date. A manager/root’s team **includes the manager’s own directly attributed business**, plus directly attributed business of all effective descendants. This inclusive convention is deterministic and matches the existing roll-up context; outputs must expose the convention as `teamMembership: "INCLUSIVE_SELF_AND_DESCENDANTS"`.

| Field | Definition |
| --- | --- |
| `managerEmployeeId` | Exact hierarchy roll-up node identity; may be a root. |
| `teamAttributedRecordCount` | Count of direct attribution records in that node’s inclusive team. |
| `teamSignedActual` | Signed Actual of those records. |
| `managerDirectSignedActual` | Direct employee Actual for the same manager, separately exposed. |
| `teamStatus` | `READY`, `PARTIAL_HIERARCHY`, `NO_RELATIONSHIP`, `UNAVAILABLE`, or a more specific existing authority status. |
| `hierarchyCoverage` | Counts/diagnostics for attributed records with and without usable roll-up context. |

Root nodes are valid team nodes. A no-relationship record remains in direct attribution/reconciliation but does not acquire an invented team. Partial hierarchy may publish the resolved portion only when its status and omitted coverage are explicit. Team node totals are never summed across nodes as a financial total; the direct-attribution population remains the only financial reconciliation basis.

## 6. Deployment × business alignment

Alignment joins an employee’s direct-attributed business with Workforce Deployment v2 at the same canonical business date. It is evaluated at employee–branch–business-date grain before period aggregation.

| Classification | Condition |
| --- | --- |
| `DEPLOYED_WITH_ATTRIBUTED_BUSINESS` | Employee has an effective deployment and direct attributed business in the scoped deployment/business population. |
| `DEPLOYED_WITHOUT_ATTRIBUTED_BUSINESS` | Employee has an effective deployment but no direct attributed business in that scoped population. |
| `ATTRIBUTED_BUSINESS_WITHOUT_DEPLOYMENT` | Direct-attributed employee business has no effective deployment context for the employee/date. |
| `NO_DEPLOYMENT_NO_ATTRIBUTED_BUSINESS` | Only meaningful for an explicitly governed employee population; neither condition is present. |
| `DEPLOYMENT_CONTEXT_UNAVAILABLE` | Deployment authority/date is absent, unsupported, invalid, or otherwise not resolvable. |

The contract does **not** require the attributed record branch to equal a deployment branch to establish ownership. A future implementation may expose same-branch versus different-branch as a diagnostic only if the deployed and business branch identities are both canonical; it must not change direct attribution, Actual, or any classification above without a later contract.

## 7. Governed slices and temporal semantics

Safe dimensions are Bank, Branch, already-governed Geography, Month/FY/reporting period, LOB, Product, Employee, and Manager/reporting hierarchy. Bank/Branch/Geography must use existing canonical/governed identities; Month/FY derives from the accepted canonical period/date authority. Employee slices use `employeeId`; manager slices use resolved hierarchy node IDs.

For every record, attribution, hierarchy and deployment evaluation uses its canonical `policyIssuedDate`. A period report aggregates those independently resolved record results. A missing/invalid business date must remain observable in diagnostics and cannot borrow a current hierarchy or deployment relationship.

## 8. Coverage, diagnostics, and reconciliation

The authority must return, for every selected scope:

- attributed and unattributed record counts and signed Actual;
- attribution record coverage percent;
- optional gross-absolute-Actual coverage diagnostic;
- direct-source and legacy-fallback attribution counts;
- unmapped source identity, temporal-not-effective, temporal-unverified, and unavailable-authority diagnostics;
- hierarchy resolved/partial/no-relationship/unavailable coverage;
- deployment resolved/no-deployment/unavailable coverage; and
- an explicit reconciliation status.

Required invariants:

```text
Attributed signed Actual + Unattributed signed Actual
  = accepted PR signed Actual

sum(employee directSignedActual)
  = attributed signed Actual
```

Team results must not change either equation. Deployment alignment must not change attribution totals. Each governed slice reconciles to its correctly scoped canonical parent population. Any mismatch returns a diagnostic/status; no silent repair, allocation, or dropped row is allowed.

## 9. Edge cases

- Negative and zero Actual are retained in direct, team, and coverage results.
- `UNATTRIBUTED`, excluded canonical records, no hierarchy relationship, and unavailable deployment are distinct states.
- A record may be directly attributed yet lack hierarchy and/or deployment context.
- An employee may have deployment without attributed business, and attributed business without deployment.
- Legacy Branch Assignment compatibility evidence remains visible through attribution evidence/status; native Workforce Deployment never substitutes for it.
- A manager with no direct business may still have team business; a producing employee may have no manager context.

## 10. Proposed Step 5B API

One pure authority is sufficient:

```javascript
BancaTrackerWorkforcePerformanceAnalytics.build({
  canonicalRecords,
  detachedAttributionResults,
  reconciliationResult,
  hierarchyContextsByBusinessDate,
  workforceDeploymentContextsByBusinessDate,
  slice
});
```

It should return an immutable result with this minimum shape:

```javascript
{
  status,
  directEmployeeRows,
  teamRows,
  deploymentAlignmentRows,
  coverage,
  reconciliation,
  diagnostics,
  slice,
  metadata: { teamMembership: "INCLUSIVE_SELF_AND_DESCENDANTS" }
}
```

It composes existing detached outputs, performs no storage access, and must not mutate any input. Step 5C may add governed slice helpers and diagnostic summaries without changing this ownership model.

## 11. Explicit exclusions

Sprint 5 does not add UI, dashboards, budgets, targets, incentives, rankings, scorecards, forecasting, pacing, recommendations, manpower optimisation, new masters, persistence/schema stores, premium allocation from deployment, fuzzy matching, designation attribution, or changes to Sprint 1–4 authorities.

## 12. Acceptance criteria and implementation sequence

Step 5A is complete when this contract preserves current authorities and defines grains, inclusive team semantics, deployment-context classifications, slices, temporal handling, diagnostics and reconciliation without adding ownership logic.

Recommended sequence:

1. **5B:** implement the single pure composition authority with direct/team/alignment rows and invariants.
2. **5C:** add governed slice helpers, coverage and diagnostic tests.
3. **5D:** add fixture-based browser acceptance and a production-readiness gate; do not add a UI unless separately approved.

There is no architectural blocker for Step 5B. The material data-quality limitation remains source-RM-ID coverage: it must remain measured and visible rather than assumed complete.
