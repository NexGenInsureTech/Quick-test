# BancaTracker Enterprise v8.3

## Step 3F — Workforce Deployment Browser Acceptance

**Status:** Automated acceptance complete; manual browser checks pending.
**Scope:** Validate the completed native Workforce Deployment v2 lifecycle and its deliberate isolation from legacy RM assignment behavior.

## Prerequisites and fixture order

The acceptance package is self-contained. Use the fixture set in `tests/fixtures/workforce-deployment-v2/` in this order:

1. `geography-master.csv` (activate first; contains the `IN-KA` state required by Branch Master)
2. `employee-master-v2.csv`
3. `branch-master-v2.csv`
4. `acceptance-valid-native-v2.csv`
5. `acceptance-invalid-native-v2.csv` (only after the valid dataset is active)
6. `legacy-branch-assignment.csv` (separate clean/legacy run where practical)

The fixture proves one employee across multiple branches, a primary plus two supports on Branch 001, a support-only Branch 003, a historical primary branch change, and a concurrent-primary invalid replacement.

## Automated evidence

`tests/step3f-workforce-deployment-browser-acceptance.test.js` uses the real CSV import/preflight authority, lifecycle semantics, persisted contract adapter, repository context, resolver, and legacy isolation boundary. It verifies native profile/metadata, stage/activation, canonical persistence shape, August/October temporal results, inclusive endpoints, support-only behavior, raw legacy-read isolation, invalid replacement protection, legacy input, and unchanged IndexedDB version 2.

## Manual browser checklist

| ID | Action and expected result | Status / record |
|---|---|---|
| B1 | Activate `employee-master-v2.csv`; `getActiveEmployeeMasterContext()` returns usable `READY` or supported compatibility status. Record dataset ID/count/status. | PENDING |
| B2 | Activate `branch-master-v2.csv`; active Branch Master is present with three branch records. Record dataset ID/count. | PENDING |
| B3 | Upload valid native deployment CSV. `DEPLOYMENT TYPE` selects `WORKFORCE_DEPLOYMENT_V2`; validation passes; no legacy RM authority is selected. Record row count/profile/staged ID. | PENDING |
| B4 | Activate staged native deployment. Active `BRANCH_ASSIGNMENT` changes normally; metadata profile is `WORKFORCE_DEPLOYMENT_V2`. Record dataset ID/version/profile. | PENDING |
| B5 | Read active native deployment context. Status is `READY`; six canonical records have no RM, premium, or manager fields. | PENDING |
| B6 | Build a 2026-01-31 temporal context. Status is `READY`; record counts and coverage. | PENDING |
| B7 | Resolve `EMP001` at 2025-08-31. Branch 001 is `PRIMARY`; Branch 003 is `SUPPORT`; ordering is deterministic. | PENDING |
| B8 | Resolve Branch 001 at 2025-08-31. `EMP001` is primary; `EMP002` and `EMP003` are support. | PENDING |
| B9 | Resolve Branch 003. Primary is `null`; support is populated; no primary is synthesized. | PENDING |
| B10 | Compare `EMP001` at 2025-08-31 and 2025-10-31. Primary changes from Branch 001 to Branch 002. | PENDING |
| B11 | Resolve Branch 001 at 2025-01-01 and 2025-09-30. Both inclusive boundaries remain effective. | PENDING |
| B12 | Inspect one native result. No attribution fields exist. | PENDING |
| B13 | Inspect one native result. No manager, ancestor, descendant, or fixed hierarchy slots exist. | PENDING |
| B14 | With native data active, legacy Assignment Resolver/Live Assignment context receives no native RM map and returns existing safe absent/unresolved behavior. | PENDING |
| B15 | Preview invalid native replacement. It is invalid; current native active dataset ID remains unchanged. | PENDING |
| B16 | In a separate legacy run, activate `legacy-branch-assignment.csv`; legacy resolver continues returning `LEGACY_RM` for Branch 001. | PENDING |
| B17 | Optional direct corrupted-primary context test: `PRIMARY_CONFLICT`, with no arbitrary selection. | PENDING |

## Browser console commands

Run these sequentially after B4; each identifier is declared before use.

```javascript
const employeeContext = await window.BancaTrackerRepository.getActiveEmployeeMasterContext();
console.log(employeeContext.dataset.datasetId, employeeContext.records.length, employeeContext.status);

const activeBranchDataset = await window.BancaTrackerRepository.getActiveDataset("BRANCH_MASTER");
const activeBranchRecords = await window.BancaTrackerRepository.getActiveMasterRecords("BRANCH_MASTER");
console.log(activeBranchDataset.datasetId, activeBranchRecords.length);
```

```javascript
const deploymentContext = await window.BancaTrackerRepository.getActiveWorkforceDeploymentContext();
console.log(deploymentContext.dataset.datasetId, deploymentContext.status, deploymentContext.contract.sourceProfile, deploymentContext.records);
```

```javascript
const augustDeployment = await window.BancaTrackerRepository.getActiveWorkforceDeploymentResolutionContext("2025-08-31");
const octoberDeployment = await window.BancaTrackerRepository.getActiveWorkforceDeploymentResolutionContext("2025-10-31");
console.log(augustDeployment.status, augustDeployment.coverage, octoberDeployment.status, octoberDeployment.coverage);
```

```javascript
const employeeDeployment = window.BancaTrackerWorkforceDeploymentResolver.resolveEmployee("EMP001", augustDeployment);
const branchDeployment = window.BancaTrackerWorkforceDeploymentResolver.resolveBranch("BANK_A:001", augustDeployment);
const supportOnlyDeployment = window.BancaTrackerWorkforceDeploymentResolver.resolveBranch("BANK_A:003", augustDeployment);
console.log(employeeDeployment, branchDeployment, supportOnlyDeployment);
```

```javascript
console.log(
  window.BancaTrackerWorkforceDeploymentResolver.resolveEmployee("EMP001", augustDeployment),
  window.BancaTrackerWorkforceDeploymentResolver.resolveEmployee("EMP001", octoberDeployment),
  window.BancaTrackerWorkforceDeploymentResolver.resolveBranch("BANK_A:001", await window.BancaTrackerRepository.getActiveWorkforceDeploymentResolutionContext("2025-01-01")),
  window.BancaTrackerWorkforceDeploymentResolver.resolveBranch("BANK_A:001", await window.BancaTrackerRepository.getActiveWorkforceDeploymentResolutionContext("2025-09-30"))
);
```

```javascript
const legacyRawAssignments = await window.BancaTrackerRepository.getActiveMasterRecords("BRANCH_ASSIGNMENT");
console.log(legacyRawAssignments); // Expected: [] while native v2 is active.
```

## Closure criteria

- [x] Automated native lifecycle, temporal resolution, isolation, replacement, and legacy evidence passed.
- [ ] B1–B16 manual browser checks recorded PASS.
- [ ] Optional B17 recorded if executed.
- [ ] Browser refresh/reopen persistence check recorded where practical.
- [ ] No unexpected browser console errors observed.

Sprint 3 remains open until required manual B1–B16 browser checks pass. The architecture intentionally contains no business attribution, premium allocation, manager performance rollup, or native-to-legacy RM projection.
