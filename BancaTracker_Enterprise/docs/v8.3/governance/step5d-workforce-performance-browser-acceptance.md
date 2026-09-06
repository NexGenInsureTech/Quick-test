# Sprint 5 Step 5D — Workforce Performance Browser Acceptance & Production Readiness

**Status:** automated acceptance complete; manual browser and representative-data gate pending.

## Scope and fixture package

Step 5D verifies the composed Workforce Performance authority without adding a dashboard, dataset type, persistence store, schema change, or ownership rule.

It reuses the official Step 4G fixture package at `tests/fixtures/business-attribution-v1/`; duplicating those four governed sources would create avoidable drift:

- `employee-master-v2.csv`
- `direct-hierarchy-v2.csv`
- `native-workforce-deployment-v2.csv`
- `pr-transactions.csv`

The existing Step 4G package also supplies the constrained legacy assignment evidence used to prove that native deployment never becomes attribution ownership evidence. Reusable Geography and Branch fixtures remain in `tests/fixtures/workforce-deployment-v2/`.

## Required browser sequence

For a clean run, validate and activate in this order:

1. Geography Master: `tests/fixtures/workforce-deployment-v2/geography-master.csv`
2. Employee Master: `tests/fixtures/business-attribution-v1/employee-master-v2.csv`
3. Branch Master: `tests/fixtures/workforce-deployment-v2/branch-master-v2.csv`
4. Direct Reporting Hierarchy: `tests/fixtures/business-attribution-v1/direct-hierarchy-v2.csv`
5. Legacy Branch Assignment, when testing compatibility: `tests/fixtures/business-attribution-v1/legacy-branch-assignment.csv`
6. Native Workforce Deployment, when testing the compatibility firewall: `tests/fixtures/business-attribution-v1/native-workforce-deployment-v2.csv`
7. PR evidence: `tests/fixtures/business-attribution-v1/pr-transactions.csv`

Employee Master is a strict prerequisite for hierarchy import; Geography is a strict prerequisite for Branch Master. Replacing legacy assignment with native deployment must remove fallback availability rather than projecting `PRIMARY`/`SUPPORT` to ownership.

## Automated acceptance evidence

`tests/step5d-workforce-performance-browser-acceptance.test.js` reuses the Step 4G fixture-backed chain and verifies:

- exact source identity and non-RM designation attribution, signed positive/zero/negative Actual, and first-class unattributed results;
- direct employee reconciliation;
- inclusive team totals, manager own direct business, descendants once, historical manager context, partial hierarchy, root isolation, and non-additive team rows;
- all four deployment alignment classes, including the rule that native deployment cannot create attribution;
- Bank, Branch, Zone, State, Month, FY, LOB, Product and Employee direct slices; manager team slicing; parent-before-child scoping; `__UNMAPPED__` retention in the authority;
- attribution, hierarchy, deployment and temporal diagnostics; deliberate corruption returning `UNRECONCILED`; and
- persistence boundary: IndexedDB schema remains version `2` and no `WORKFORCE_PERFORMANCE` dataset/store exists.

## Manual browser checklist

| # | Check | Expected result |
| --- | --- | --- |
| 1 | Activate Employee, Hierarchy and Deployment masters in the required order. | Contexts are available with no fabricated relationship. |
| 2 | Resolve an exact source employee with a non-RM designation. | Direct business belongs to that exact Employee ID. |
| 3 | Inspect a positive, zero and negative record. | Signed Actual is unchanged. |
| 4 | Inspect BA-name-only/unmapped source evidence. | `UNATTRIBUTED`; no employee owner. |
| 5 | Verify employee direct totals. | Equal attributed signed Actual in scope. |
| 6 | Inspect a manager with own direct business and descendants. | Inclusive team total; own direct is separately visible. |
| 7 | Compare business before/after manager change. | Manager context follows business date. |
| 8 | Inspect partial/no-relationship employee. | Direct owner retained; hierarchy diagnostic visible. |
| 9 | Inspect two roots. | Roots remain separate; no cross-root roll-up. |
| 10 | Confirm team rows are marked non-additive. | No financial grand total formed by summing team rows. |
| 11 | Inspect all four deployment alignment classifications. | Context only; no ownership change. |
| 12 | Activate native deployment in place of legacy assignment. | No fallback/ownership projection from `PRIMARY` or `SUPPORT`. |
| 13 | Slice Bank → Branch → Product. | Parent scope is applied first; no leakage. |
| 14 | Inspect Zone, State, Month/FY, LOB, Product, Employee and Manager slices. | Canonical identities and deterministic ordering. |
| 15 | Inspect missing dimension evidence. | `__UNMAPPED__` is retained, not dropped. |
| 16 | Inspect diagnostics. | Attribution, temporal, hierarchy and deployment gaps remain visible. |
| 17 | Verify direct/scoped signed reconciliation. | `RECONCILED`; deliberate mismatch is `UNRECONCILED`. |
| 18 | Refresh/reopen. | Masters reconstruct; Workforce Performance is recomputed, not persisted. |
| 19 | Visit existing Commercial Performance pages. | No functional/UI regression. |

## Representative real-data production-readiness gate

Record each item as `PASS`, `PASS_WITH_DIAGNOSTICS`, or `BLOCKED`. Do not apply arbitrary productivity thresholds: correctness, reconciliation, and unsupported/corrupt authority states control the disposition.

| Gate | PASS basis | PASS_WITH_DIAGNOSTICS basis | BLOCKED basis |
| --- | --- | --- | --- |
| Employee Master import and identity coverage | Valid active authority and exact IDs. | Valid import with visible unmapped/legacy coverage. | Invalid/unsupported employee authority. |
| Hierarchy coverage, roots and disconnected components | Effective graph and diagnostics reconcile. | Partial/disconnected cases are disclosed. | Invalid/corrupt graph prevents resolution. |
| Deployment coverage | Effective deployment context reconstructs. | Missing/no-deployment classifications are disclosed. | Unsupported/invalid deployment authority. |
| Source-RM attribution coverage | Exact matches and unallocated population reconcile. | Unattributed record and signed-Actual percentages are visible. | Attribution totals disagree with accepted PR Actual. |
| Hierarchy-resolved attributed business | Resolved/partial/no-relationship counts reconcile. | Partial/missing coverage is explicit. | Roll-up changes direct totals. |
| Deployment/business alignment | Distribution is classified without ownership changes. | Context gaps are visible. | Deployment creates/changes attribution. |
| Bank/Branch/Month slicing | Scoped totals reconcile to each parent. | `__UNMAPPED__` is retained. | Child leakage or unreconciled scope. |
| Refresh reconstruction | Masters reopen and recomputation matches. | Non-fatal existing diagnostics persist visibly. | New authority persistence is required or state corrupts. |
| Legacy/native isolation | Compatibility behavior remains deterministic. | Legacy fallback is explicitly labelled. | Native deployment becomes attribution evidence. |
| Regression | Full suite passes. | N/A. | Any relevant regression failure. |

## Closure condition

Sprint 5 is ready for release review only after the manual checklist and the representative-data gate are recorded with no `BLOCKED` correctness/reconciliation condition. This step intentionally does not constitute a dashboard release or a new persisted Workforce Performance authority.
