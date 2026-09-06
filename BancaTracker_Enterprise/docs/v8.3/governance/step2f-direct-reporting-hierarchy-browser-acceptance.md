# BancaTracker Enterprise v8.3

## Sprint 2F — Direct Reporting Hierarchy Browser Acceptance

**Status:** B1–B8 browser acceptance PASS; automated evidence complete.
**Scope:** Validate the completed Sprint 2 direct-reporting journey without adding hierarchy features.

## Objective

Prove that a governed Employee Master can support a native Direct Reporting v2 hierarchy throughout browser import, staged activation, repository reads, explicit-as-of traversal, legacy-slot compatibility projection, and replacement protection. The dynamic effective-dated graph remains authoritative; fixed legacy slots are runtime-only compatibility output.

## Prerequisites

1. Open the application locally with browser developer tools available.
2. First import and activate the matching `employee-master-v2.csv` Employee Master fixture. It contains every identity used by `valid-native-v2.csv`, including `UNMAPPED001`. `ROLE` is needed only for employees intended to populate legacy slots (`RM001`, `CSM001`, `ASM001`, `ZSM001`, `NH001`, and `RM_SKIP`).
3. Use the four fixtures in `tests/fixtures/direct-hierarchy-v2/`:

   - `employee-master-v2.csv` — required, matching native-v2 Employee Master prerequisite; it must be active before importing the native hierarchy fixture.
   - `valid-native-v2.csv` — native v2 normal/skip-level chains, arbitrary designations, two roots, history, open-ended rows, and one Employee Master identity with no hierarchy row.
   - `invalid-native-v2.csv` — unknown manager, self report, overlap, invalid order, temporal cycle, and duplicate relationship identity.
   - `legacy-v8.2-hierarchy.csv` — legacy `MANAGER ID` import path.

## Automated evidence

`tests/step2f-direct-hierarchy-browser-acceptance.test.js` performs a deterministic browser-facing lifecycle simulation using the actual import, authority, resolver, projection, and persistence-boundary APIs. It verifies native profile detection and metadata, stage/activation, canonical active reads, August/October 2025 manager changes, skip levels, two roots, partial coverage, forward/reverse traversal, runtime-only projections, invalid replacement protection, legacy v1 handling, metadata-less legacy compatibility, and unchanged database version 2.

## Manual browser acceptance checklist

| ID | Action | Expected result | Status |
|---|---|---|---|
| B1 | Upload `valid-native-v2.csv` using Master Data import. | `MANAGER EMPLOYEE ID` selects Direct Reporting v2; rows validate and stage without unexpected errors. | PASS |
| B2 | Activate the staged native hierarchy. | Dataset becomes `ACTIVE`; previous hierarchy is superseded normally; console remains clean. | PASS |
| B3 | Read the active hierarchy context in the console. | `READY`, `DIRECT_REPORTING_V2`, and the active dataset identity are shown. | PASS |
| B4 | Build the August 2025 runtime context. | `READY_PARTIAL` is acceptable because `UNMAPPED001` has no row; roots are deterministic. | PASS |
| B5 | Resolve `EMP001` before and after 2025-10-01. | Manager changes from `MGR001` to `MGR002`. | PASS |
| B6 | Inspect skip-level traversal and NH rollup. | `RM_SKIP` reports directly to `NH001`; ancestry and descendants are dynamic; no fabricated levels appear. | PASS |
| B7 | Project `RM_SKIP` and `EXEC001`. | `RM_SKIP` fills only `rmId` and `nationalHeadId`; `EXEC001` does not become RM from designation. | PASS |
| B8 | Preview/import `invalid-native-v2.csv` after B2. | Validation blocks replacement; the active v2 dataset remains unchanged; diagnostics are useful and console is clean. | PASS |
| B9 | Optionally upload `legacy-v8.2-hierarchy.csv`. | `MANAGER ID` remains on the legacy v8.2 path and is not promoted to v2. | PENDING |

## Console snippets

Run the following sequentially after B2. Each variable is defined before it is used.

```javascript
const hierarchyContext = await window.BancaTrackerRepository.getActiveHierarchyContext();
console.log(hierarchyContext.status, hierarchyContext.contract.sourceProfile, hierarchyContext.dataset.datasetId);
```

```javascript
const augustHierarchy = await window.BancaTrackerRepository.getActiveDirectHierarchyResolutionContext("2025-08-31");
console.log(augustHierarchy.status, augustHierarchy.roots, augustHierarchy.relationshipCount);
```

```javascript
const octoberHierarchy = await window.BancaTrackerRepository.getActiveDirectHierarchyResolutionContext("2025-10-31");
console.log(
  window.BancaTrackerDirectHierarchyResolver.getManager("EMP001", augustHierarchy),
  window.BancaTrackerDirectHierarchyResolver.getManager("EMP001", octoberHierarchy)
);
```

```javascript
console.log(
  window.BancaTrackerDirectHierarchyResolver.getManager("RM_SKIP", augustHierarchy),
  window.BancaTrackerDirectHierarchyResolver.getAncestors("RM_SKIP", augustHierarchy),
  window.BancaTrackerDirectHierarchyResolver.getDescendants("NH001", augustHierarchy),
  window.BancaTrackerDirectHierarchyResolver.getRollupMembers("NH001", augustHierarchy, { includeSelf: true })
);
```

```javascript
const skipProjection = window.BancaTrackerDirectHierarchyLegacyProjection.projectEmployee("RM_SKIP", augustHierarchy);
const executiveProjection = window.BancaTrackerDirectHierarchyLegacyProjection.projectEmployee("EXEC001", augustHierarchy);
console.log(skipProjection, executiveProjection);
```

## Closure checklist

- [x] Native v2 import/metadata, activation lifecycle, persistence shape, graph resolution, reverse traversal, projection, legacy isolation, invalid replacement, and IndexedDB version are automated.
- [x] Full automated regression must pass after the Sprint 2F test is registered.
- [x] B1–B8 manual browser checks completed and recorded as PASS.
- [ ] B9 legacy browser check completed if a browser session is available.
- [ ] No unexpected browser console errors observed.

Sprint 2 browser acceptance is complete: automated evidence and required B1–B8 manual checks passed. B9 remains optional legacy-browser evidence. No hierarchy analytics, UI, graph editing, assignment redesign, budget/premium rollups, persistence migration, or contract/version expansion is authorized by this acceptance step.
