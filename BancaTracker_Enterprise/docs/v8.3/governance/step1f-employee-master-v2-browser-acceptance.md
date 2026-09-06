# BancaTracker Enterprise v8.3

## Sprint 1F — Employee Master v2 Browser Acceptance & Increment Closure

**Status:** Manual browser acceptance pending
**Scope:** Acceptance of Sprint 1 Employee Master v2 only. Direct Reporting Hierarchy remains deferred to Sprint 2.

## Prerequisites

- Run the application from the `feature/v8.3-workforce-hierarchy` branch.
- Preserve any important browser-local data before testing; master activation replaces the active dataset of the same type.
- Use the fixtures in `tests/fixtures/employee-master-v2/`.
- Automated fixture acceptance and regression must be passing before manual execution.

## Fixtures

| Fixture | Purpose | Expected preview |
|---|---|---|
| `valid-native-v2.csv` | Ten native v2 records: National Head, ZSM, ASM, CSM, RM, USM, MT, Executive, Coordinator, and one exited Executive. | 10 rows, 0 errors, 0 warnings, VALID |
| `invalid-native-v2.csv` | Malformed date, impossible ordering, contradictory active/exit state, and duplicate identity. | 5 errors, INVALID |
| `legacy-v8.2.csv` | Two v8.2-style `ROLE`/`ACTIVE` records. | Valid legacy import; it declares explicit legacy metadata when imported through v8.3. |

## Browser acceptance checklist

### B1 — Native v2 import

1. Open the application and navigate to **Master Data Administration**.
2. Select **Employee Master** and choose `valid-native-v2.csv`.
3. Confirm the preview shows **10 rows, 0 errors, 0 warnings, VALID**.
4. Confirm USM, MT, Executive, and Coordinator do not produce legacy-role validation errors.
5. Review and confirm activation.
6. Confirm Employee Master displays **ACTIVE**.

Actual result: `PENDING`
Observed row/error/warning counts: `____________`

### B2 — Persistence

1. With the native dataset ACTIVE, refresh with `Ctrl+R`.
2. Confirm Employee Master remains ACTIVE and still shows the uploaded dataset metadata.
3. Close and reopen the application/browser when practical.
4. Confirm the active Employee dataset remains available.

Actual result: `PENDING`
Observed dataset ID: `____________`

### B3 — Invalid replacement safety

1. Keep the valid native dataset ACTIVE.
2. Select `invalid-native-v2.csv` for Employee Master.
3. Confirm preview is **INVALID** with **5 errors** and activation is unavailable.
4. Confirm the previous native dataset remains ACTIVE.

Actual result: `PENDING`
Observed active dataset ID after rejection: `____________`

### B4 — Legacy compatibility

Use an isolated browser profile or an existing pre-v8.3 Employee dataset with no `metadata.dataContract`; do not replace the accepted native dataset solely for this check.

1. In the browser console, run:

    const context = await BancaTrackerRepository.getActiveEmployeeMasterContext();
    console.log(context.status, context.contract.sourceProfile, context.diagnostics);

2. Confirm a metadata-less legacy dataset reports `LEGACY_COMPATIBILITY`, `LEGACY_V1_ASSUMED`, and `EMPLOYEE_DATASET_CONTRACT_UNDECLARED`.
3. Confirm stored legacy data is not rewritten or migrated automatically.

Actual result: `PENDING`
Observed compatibility result: `____________`

### B5 — Vintage authority

In the browser console, run the following deterministic sample:

    const result = BancaTrackerEmployeeVintage.evaluateEmployee({
      employeeId: "E010",
      dateOfJoining: "2017-02-01",
      channelJoinDate: "2018-01-01",
      designationEffectiveDate: "2020-01-01",
      exitDate: "2024-12-31"
    }, "2025-08-31");
    console.log(result.companyVintage, result.channelVintage, result.designationVintage);

Confirm Company, Channel, and Designation Vintage are available and each has `effectiveEndDate: "2024-12-31"`. For missing optional anchors, confirm the metric returns `UNAVAILABLE_SOURCE_DATE`, not zero.

Actual result: `PENDING`
Observed values: `____________`

### B6 — Reload and recovery

1. Return to `valid-native-v2.csv` if another fixture was activated in a controlled test.
2. Refresh the application.
3. Confirm Employee Master remains ACTIVE, the console has no unexpected errors, and existing v8.2 pages load normally.

Actual result: `PENDING`
Console observations: `____________`

## Compatibility limitation

Legacy hierarchy still uses fixed five-role projections. A native v2 free-form designation does not create a legacy role or a reporting relationship. This is expected until Sprint 2 Direct Reporting Hierarchy replaces the fixed role model.

## Sprint 1 closure criteria

Sprint 1 closes when automated acceptance/regression pass and an operator records PASS for B1–B6 without unexpected browser errors or dataset corruption. This document does not claim those manual steps have been executed.
