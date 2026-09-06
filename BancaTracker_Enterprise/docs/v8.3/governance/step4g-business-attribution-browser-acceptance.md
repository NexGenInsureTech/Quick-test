# Sprint 4 Step 4G — Business Attribution Browser Acceptance & Closure

**Status:** automated acceptance evidence complete; manual browser acceptance pending.

## Purpose and boundary

This package verifies the governed, detached business-attribution chain introduced in Sprint 4:

```text
Canonical PR record
  -> temporal business attribution
  -> reconciliation / coverage
  -> analytical direct-reporting roll-up
```

Attribution remains derived at runtime. This step does not persist attribution, modify an accepted PR record, alter IndexedDB, or add a dashboard/UI.

## Fixture package

The official Step 4G fixtures are in `tests/fixtures/business-attribution-v1/`:

- `employee-master-v2.csv` — valid active employees, a future joiner, exited employee, date-unverified employee, legacy fallback RM, managers and roots;
- `direct-hierarchy-v2.csv` — historical manager change, roots, skip-level relationship, and no-relationship case;
- `legacy-branch-assignment.csv` — the constrained legacy fallback for `BANK_A:001`;
- `native-workforce-deployment-v2.csv` — a PRIMARY deployment used only to prove deployment is not ownership evidence;
- `pr-transactions.csv` — direct, name-only, unmapped, legacy fallback, temporal, signed-value, historical-manager, root, and no-relationship cases.

The package reuses these governed master prerequisites:

- `tests/fixtures/workforce-deployment-v2/geography-master.csv`;
- `tests/fixtures/workforce-deployment-v2/branch-master-v2.csv`.

## Required browser upload and activation order

For a clean/replacement-safe browser run, upload, validate, activate, and wait for each step to complete in this order:

1. `tests/fixtures/workforce-deployment-v2/geography-master.csv`
2. `tests/fixtures/business-attribution-v1/employee-master-v2.csv`
3. `tests/fixtures/workforce-deployment-v2/branch-master-v2.csv`
4. `tests/fixtures/business-attribution-v1/direct-hierarchy-v2.csv`
5. `tests/fixtures/business-attribution-v1/legacy-branch-assignment.csv`
6. `tests/fixtures/business-attribution-v1/pr-transactions.csv` as the PR evidence file.

For B10, replace/activate the legacy Branch Assignment fixture with `native-workforce-deployment-v2.csv`. Native PRIMARY/SUPPORT deployment must not become attribution ownership evidence; the legacy fallback must consequently be unavailable.

The matching Employee Master is a strict prerequisite for the direct-reporting hierarchy fixture. Geography is a strict prerequisite for the reusable Branch Master fixture.

## Automated acceptance

`tests/step4g-business-attribution-browser-acceptance.test.js` parses the official fixture set and exercises the real pure/temporal attribution, reconciliation and hierarchy-roll-up authorities. It verifies:

- exact `sourceRmId` → Employee ID attribution, including a free-form `USM` designation;
- BA NAME alone does not attribute; present-but-unmapped source IDs do not fall back;
- constrained legacy Branch Assignment fallback only when source identity is absent;
- native Workforce Deployment PRIMARY does not provide ownership;
- future-join, exited, and date-unverified temporal gates;
- positive, zero, and negative signed Actual preservation without duplication;
- signed reconciliation, gross-absolute coverage, and bank/branch/month/LOB/product slices;
- historical manager change, roots, no-relationship handling, roll-up uniqueness, and direct reconciliation;
- deterministic repeated resolution, canonical input immutability, and IndexedDB schema version `2`.

## Manual browser checklist

| ID | Acceptance observation | Result |
| --- | --- | --- |
| B1 | Geography fixture validates and activates before Branch Master. | PENDING |
| B2 | Employee fixture validates and activates. | PENDING |
| B3 | Branch fixture validates and activates after Geography. | PENDING |
| B4 | Direct hierarchy validates and activates after Employee Master. | PENDING |
| B5 | Legacy Branch Assignment validates and activates. | PENDING |
| B6 | Attribution context reports Employee Master and legacy fallback availability. | PENDING |
| B7 | Direct `EMP_SRC` source identity resolves to `EMP_SRC`. | PENDING |
| B8 | Free-form designation does not block direct source attribution. | PENDING |
| B9 | BA NAME-only and unmapped source identity remain unattributed. | PENDING |
| B10 | Native deployment replacement makes legacy fallback unavailable; PRIMARY is not ownership. | PENDING |
| B11 | Re-activate legacy assignment and confirm permitted fallback for `BANK_A:001`. | PENDING |
| B12 | Negative fallback Actual remains `-20`; zero Actual remains `0`. | PENDING |
| B13 | Future-join source is `NOT_EFFECTIVE`. | PENDING |
| B14 | Exited source is `NOT_EFFECTIVE`. | PENDING |
| B15 | Missing authoritative dates produce `UNVERIFIED`, not a guess. | PENDING |
| B16 | Attributed plus unattributed signed Actual reconciles to the accepted PR Actual. | PENDING |
| B17 | Coverage reports direct, legacy, unmapped, not-effective, and unverified categories. | PENDING |
| B18 | Bank slice reconciles. | PENDING |
| B19 | Branch slice reconciles. | PENDING |
| B20 | Month slice reconciles. | PENDING |
| B21 | LOB and product slices reconcile. | PENDING |
| B22 | August `EMP_SRC` rolls to `MGR_OLD`; October rolls to `MGR_NEW`. | PENDING |
| B23 | Root and skip-level roll-up is analytical context only, with no premium duplication. | PENDING |
| B24 | No-relationship and unattributed rows have no invented hierarchy node. | PENDING |
| B25 | Refresh/reopen retains governed masters but no persisted attribution dataset/output. | PENDING |
| B26 | Console is clean and acceptance results are repeatable. | PENDING |

## Browser console checks

After the required fixtures are active, use the following read-only console checks:

```javascript
const attributionContext = await window.BancaTrackerRepository.getActiveBusinessAttributionContext();
const augustHierarchy = await window.BancaTrackerRepository.getActiveDirectHierarchyResolutionContext("2025-08-31");
const octoberHierarchy = await window.BancaTrackerRepository.getActiveDirectHierarchyResolutionContext("2025-10-31");
console.log({ attributionContext, augustHierarchy, octoberHierarchy });
```

Use controlled canonical equivalents of the PR fixture because Sprint 4 deliberately has no production PR-pipeline mutation hook:

```javascript
const records = [
  { recordId: "R_DIRECT", policyIssuedDate: "2025-08-31", premium: 100,
    sourceRmId: "EMP_SRC", branchId: "BANK_A:002", bankId: "BANK_A",
    monthKey: "2025-08", lob: "Motor", productCode: "P1" }
];
const detached = window.BancaTrackerTemporalBusinessAttributionResolver.resolveBatch(
  records, attributionContext
).results;
const reconciliation = window.BancaTrackerBusinessAttributionReconciliation.reconcile(records, detached);
const rollup = window.BancaTrackerBusinessAttributionHierarchyRollup.buildRollupRecords(
  detached, new Map([["2025-08-31", augustHierarchy], ["2025-10-31", octoberHierarchy]])
);
console.log({ detached, reconciliation, rollup });
```

Expected direct result: `ATTRIBUTED_SOURCE_RM_ID`, employee `EMP_SRC`, signed Actual `100`; expected direct manager: `MGR_OLD`. The full PR fixture is expected to reconcile to signed Actual `295`, with direct-source attributed count `6`, legacy-fallback count `1`, unmapped source count `1`, temporal not-effective count `2`, and temporal unverified count `1`.

## Closure criteria

Step 4G is ready for closure when the automated test and full regression pass, the manual B1–B26 checklist is recorded from a real browser run, and no browser console errors occur. No attribution persistence, schema change, or UI acceptance is implied by this package.
