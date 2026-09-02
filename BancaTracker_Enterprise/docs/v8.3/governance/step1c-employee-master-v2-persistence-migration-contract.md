# BancaTracker Enterprise v8.3

## Sprint 1C — Employee Master v2 Persistence & Migration Contract

**Status:** Architecture contract  
**Baseline:** v8.2.0 storage foundation and Sprint 1B Employee Master v2 authority  
**Scope:** Persistence and migration design only; no storage or production-code implementation

## 1. Objective

Define the smallest safe way for Employee Master v1/v8.2 datasets and native Employee Master v2 datasets to coexist in browser-local storage. The design must preserve existing active datasets, maintain the established dataset lifecycle, and avoid breaking current v8.2 hierarchy consumers while direct-reporting hierarchy work remains deferred.

## 2. Current-state findings

### 2.1 Dataset identity and lifecycle

The current repository identifies every persistent master dataset with:

```text
datasetType + monotonically increasing datasetVersion
→ datasetId (for example EMPLOYEE_MASTER:3)
```

`stageDataset()` writes a dataset metadata record in `STAGED` state. The repository then saves only records whose `datasetId` matches that staged ID. `activateDataset()` atomically switches the active-dataset pointer for the dataset type and marks the formerly active dataset `SUPERSEDED`. A post-stage failure may be marked `FAILED`; an active dataset cannot be marked failed. A staged dataset may be discarded with its staged records.

The lifecycle is therefore:

```text
PREVIEW (in memory only)
   ↓ valid commit
STAGED → ACTIVE → SUPERSEDED
   ↓ failure after staging
FAILED
```

`getActiveMasterRecords("EMPLOYEE_MASTER")` loads only records linked to the active pointer. `getDatasetHistory()` returns all dataset metadata for a type, ordered by dataset version. The existing repository does not expose a user-facing rollback command, but a previously superseded dataset and its records remain stored and could be explicitly reactivated by a future, audited rollback operation.

### 2.2 Persisted Employee Master shape

The Employee Master store uses `recordId` as its key and indexes `datasetId`, `employeeId`, legacy `role`, and `active`. Current imports persist the normalized records returned by `BancaTrackerEmployeeMaster.prepareDataset()`; they do not persist raw CSV rows in the master store.

The `datasets` metadata record includes operational metadata such as file name, upload time, counts, lifecycle status, previous dataset ID, and an open `metadata` object. Current Master Import does not populate Employee Master contract/version metadata. The database schema is IndexedDB version 2 and its existing Employee Master indexes already accept additional record properties without a schema change.

### 2.3 Coexistence today

At the storage level, v1 and v2 records can coexist safely because their records are isolated by `datasetId` and only one Employee Master dataset is active. There is no key collision between `EMPLOYEE_MASTER:1` v1 records and `EMPLOYEE_MASTER:2` v2 records when they share an Employee ID.

The present limitation is interpretation, not physical storage: without dataset metadata, a consumer would have to guess the contract from record fields. That is unsafe once compatibility projections make some v1 and v2 shapes overlap.

## 3. Persistence ownership

| Layer | Ownership | Sprint 1C decision |
|---|---|---|
| Employee Master authority | Normalized canonical workforce facts and validation findings | Defines record shape; does not choose storage lifecycle. |
| Master Import | Preview, preflight, staging request, and record persistence | Must attach declared contract metadata in a future implementation. |
| Repository | Dataset versioning, lifecycle, active pointer, history, staged-record safety | Remains generic and unchanged for v2. |
| IndexedDB schema | Object stores and indexes | No change required for v2 fields or metadata. |
| Hierarchy consumers | Temporary use of legacy role projection | Must read compatibility projection only, never infer it from Designation. |

## 4. Schema/version identification strategy

### 4.1 Decision: explicit metadata is required

Employee Master requires an explicit **data contract version** stored on the dataset metadata record. Recommended metadata, nested under the existing `metadata` property:

```javascript
{
  dataContract: {
    name: "EMPLOYEE_MASTER",
    version: 2,
    sourceProfile: "NATIVE_V2" | "LEGACY_V1" | "MIXED_TRANSITIONAL",
    normalizerVersion: 2,
    declaredAt: "ISO-8601 timestamp"
  }
}
```

`datasetVersion` remains the lifecycle/version sequence. It is not a data-contract version and must not be overloaded.

### 4.2 Reading historical datasets without metadata

Existing v8.2 datasets necessarily lack `dataContract` metadata. A consumer must classify an absent contract declaration as:

```text
LEGACY_V1_ASSUMED
```

This is a narrowly scoped legacy rule based on the known pre-v8.3 storage baseline, not general field guessing. It must emit an auditable compatibility diagnostic, for example `EMPLOYEE_DATASET_CONTRACT_UNDECLARED`.

Any future dataset written after the contract-metadata implementation is active must declare a supported version. Field presence may be used only as a validation cross-check against a declared profile, never as the primary contract detector.

### 4.3 Supported declarations

| Contract declaration | Interpretation |
|---|---|
| absent | `LEGACY_V1_ASSUMED`; dual-read as v8.2 normalized record shape |
| version `1` | Explicit legacy v8.2 contract; dual-read |
| version `2`, `NATIVE_V2` | Native v2 workforce contract |
| version `2`, `MIXED_TRANSITIONAL` | Rows may carry compatibility fields; canonical v2 fields remain authoritative where supplied |
| unknown/future version | Do not activate or interpret as a normal Employee Master; surface unsupported-contract state |

## 5. Read strategy

### 5.1 Decision: metadata-directed dual-read with read-time compatibility adaptation

The chosen strategy is a combination of:

1. **metadata-directed dual-read** for active v1 and v2 datasets;
2. **read-time compatibility adaptation** for declared/assumed v1 records; and
3. **explicit user-approved replacement imports** for writing new v2 datasets.

No automatic in-place record migration, no automatic copying of a v1 active dataset, and no database-wide rewrite is permitted.

### 5.2 Opening an existing v8.2 Employee dataset under v8.3

When the active Employee dataset has absent or v1 metadata:

1. load records exactly as stored for its active `datasetId`;
2. preserve their legacy `role` and `active` behavior for v8.2 hierarchy consumers;
3. expose a read-time v2 compatibility view, for example:

```text
legacy ROLE     → legacyRole, legacyHierarchyRole, role
legacy ROLE     → designation only when no native designation exists
legacy ACTIVE   → activeInput and derived employmentStatus (ACTIVE/INACTIVE)
```

4. mark workforce fields and dates absent rather than inventing values;
5. report the record/dataset as compatibility-derived, not native v2;
6. do not persist the adaptation unless the user later imports and activates a valid replacement dataset.

This preserves the previous active dataset and allows v8.2 hierarchy to continue operating without conflating legacy compatibility with a true v2 source record.

### 5.3 Native v2 reads

For a declared v2 dataset, read canonical v2 workforce attributes as persisted. `EMPLOYMENT STATUS` is authoritative. `role` may be present only as a compatibility projection originating from explicit recognized legacy Role input; no reader may synthesize it from Designation.

## 6. Write strategy

### 6.1 New v8.3 imports

A future implementation should persist, for each successfully activated v2 dataset:

| Persist | Reason |
|---|---|
| Dataset contract metadata | Makes contract interpretation deterministic. |
| Canonical normalized v2 fields | The active governed workforce facts. |
| Explicit source compatibility fields: `legacyRole`, `activeInput` | Auditability and temporary legacy-consumer support when supplied. |
| Explicit projections: `legacyHierarchyRole`, `role`, `active` | Required only while v8.2 consumers still use them; their provenance must be clear. |
| Record audit fields already in the model: `datasetId`, `recordId`, `sourceRowNumber` | Dataset isolation and traceability. |

### 6.2 Do not persist

Do not persist:

- calculated Company/Channel/Designation Vintage;
- transient preview state, findings UI state, or in-memory lookup maps;
- inferred manager relationships, hierarchy slots, or branch deployment;
- wall-clock-derived statuses or as-of results;
- a copy of raw CSV rows in the Employee Master store solely to support migration.

If raw-file retention is needed later, it requires a separate data-retention/privacy design. Normalized record values plus dataset file metadata are the current persistence boundary.

### 6.3 Mixed transitional source rows

A v2 dataset may have a declared `MIXED_TRANSITIONAL` source profile only during the migration window. Each row must still pass the Sprint 1B authority:

- native fields take precedence where supplied;
- legacy Role/Active may fill only contract-approved compatibility gaps;
- conflicting native status/legacy Active is blocking;
- Designation never produces a role;
- the dataset metadata records that the dataset is mixed.

## 7. Migration policy

### 7.1 Decision

Existing stored v8.2 datasets remain untouched and are lazily interpreted through the dual-read compatibility adapter. Migration to native v2 occurs only through an explicit valid v2 import and activation.

No silent conversion, rewrite, copy-on-read, or deletion occurs.

### 7.2 Why no IndexedDB version bump is required

Employee Master v2 adds record properties and dataset metadata, both of which IndexedDB object stores can store without changing their key paths or existing indexes. The active-record lookup remains by `datasetId`, and current legacy hierarchy lookup remains by `role`/`active`.

Therefore **no IndexedDB database version bump is required for Sprint 1C's planned v2 persistence behavior**. A future bump is warranted only if a future approved requirement needs new indexes (for example, indexed contract version, designation, employment status, or effective-dated record keys), a new store, or changed key paths.

## 8. Replacement and rollback safety

### 8.1 Valid v2 replacement of v1

```text
Active v1 dataset remains ACTIVE
        ↓
Validate v2 preview and current dependencies
        ↓
Stage v2 metadata + v2 records as a new datasetId
        ↓
Atomically activate v2 pointer
        ↓
v2 becomes ACTIVE; prior v1 becomes SUPERSEDED
```

The v1 records are not modified. The activation transaction updates the active pointer and lifecycle states together.

### 8.2 Invalid v2 import

An invalid preview must not stage records or change the active pointer. The currently active v1 or v2 Employee dataset remains active. A failure after staging must mark only the new staged dataset `FAILED`; the active dataset remains protected.

### 8.3 Rollback

The repository retains superseded datasets and records, but does not currently provide a rollback API. The future rollback design must be an explicit, audited action that:

1. verifies the selected historic dataset exists and has a supported contract;
2. reactivates it through the same atomic active-pointer lifecycle; and
3. records the rollback origin/reason in metadata.

It must never restore by copying records into the current active dataset or by mutating historic record contents. Until that API exists, recovery is operationally a new validated import of the prior source dataset, not an implicit rollback.

## 9. Coexistence with v8.2 Hierarchy Master

### 9.1 Decision

When a v2 Employee Master and a v8.2 Hierarchy Master are both active, v8.2 hierarchy continues to use only explicit recognized legacy role projections:

```text
Hierarchy Master v8.2
  → employee.role / legacyHierarchyRole
  → fixed five-role adjacency validation and fixed result slots
```

The Employee v2 Designation field is never an input to hierarchy validation, traversal, or result-slot inference.

### 9.2 Expected outcomes

| Employee v2 record | Existing v8.2 Hierarchy behavior |
|---|---|
| Has explicit recognized legacy Role projection | May participate in the unchanged v8.2 hierarchy rules. |
| Native free-form Designation with no legacy Role | Has no fabricated five-role classification; v8.2 hierarchy cannot validly classify it. |
| Legacy Role is unknown | Retained as descriptive compatibility data but produces no legacy hierarchy role. |
| Employee absent/inactive in active Employee Master | Existing v8.2 hierarchy mapping/unmapped behavior applies. |

### 9.3 Readiness and degradation

Employee Master v2 can be valid and active even when an existing v8.2 Hierarchy Master cannot classify all v2 employees. This is not an Employee Master validation failure.

Until Hierarchy Master v2/direct reporting is delivered:

- workforce identity/readiness may be `ACTIVE` or v2-valid;
- legacy hierarchy enrichment for an employee without an explicit compatible role must return a factual partial/unmapped/unsupported compatibility state;
- no fallback manager, synthetic CSM/ASM/ZSM/National Head, or designation-based relation may be invented;
- readiness reporting should distinguish `EMPLOYEE_MASTER_ACTIVE` from `LEGACY_HIERARCHY_COMPATIBILITY_PARTIAL`.

Existing v8.2 hierarchy validation currently treats a missing/unknown role as a role mismatch path. A later hierarchy sprint must replace this with direct edge validation; Sprint 1C does not change it.

## 10. Compatibility-field classification

| Field | Classification | Persistence decision | Authority/use |
|---|---|---|---|
| `ROLE` | Legacy source input | Persist only as normalized `legacyRole` when supplied; raw CSV header need not be separately stored | Deprecated compatibility input, not workforce authority. |
| `ACTIVE` | Legacy source input | Persist normalized `activeInput` when supplied | Compatibility input; never overrides Employment Status. |
| `legacyRole` | Compatibility/audit field | Persist during migration window | Source normalized Role text. |
| `legacyHierarchyRole` | Derived compatibility projection | Persist temporarily if needed for existing consumers; provenance is explicit | Recognized mapping of legacyRole only. |
| `role` | Derived compatibility projection | Persist temporarily while v8.2 hierarchy/index consumers require it | Same recognized legacy role; never inferred from Designation. |
| `activeInput` | Compatibility/audit field | Persist during migration window | Parsed legacy boolean. |
| `active` | Derived compatibility projection | Persist while legacy active-index/readers require it | Derived from authoritative Employment Status for v2; from legacy Active only in v1 compatibility adaptation. |
| `employmentStatus` | Authoritative v2 field | Persist | Governs v2 employment state. |
| `designation` | Authoritative v2 field | Persist | Free-form workforce description; never hierarchy authority. |

## 11. Failure and edge-case policy

| Case | Required behavior |
|---|---|
| Legacy dataset missing v2 fields | Leave stored data untouched; classify as `LEGACY_V1_ASSUMED`; adapt at read time and report compatibility diagnostics. |
| Native v2 dataset missing Role | Valid when required v2 identity, designation, and status fields pass; `role` remains null. |
| Mixed legacy/native rows | Permit only in declared `MIXED_TRANSITIONAL` dataset profile and only when every row passes v2 authority and conflict rules. |
| Unknown schema/data-contract version | Do not treat as v1 or activate normally; surface unsupported contract and preserve the prior active dataset. |
| Malformed stored record | Do not rewrite it. Isolate it from consumer maps, record a bounded data-quality diagnostic, and report reduced/partial readiness. |
| Replacement validation failure | Do not stage/activate; preserve current active pointer and records. |
| Failure after staging | Mark only candidate dataset failed; preserve active dataset. |
| Rollback to old dataset | Use future explicit audited reactivation or re-import; never destructive copying. |
| Future Employee Master v3 | Requires a declared version, reader compatibility decision, migration/rollback plan, and tests before activation support. |

## 12. Compatibility retirement path

1. Persist the explicit contract declaration for all newly written datasets.
2. Keep dual-read and compatibility projections while active v8.2 hierarchy consumers depend on them.
3. Implement and activate Hierarchy Master v2/direct edge consumers without designation inference.
4. Measure active/dataset-history use of v1 and transitional projections.
5. Announce a governed deprecation window and offer explicit migration/rollback controls.
6. Stop writing `role`, `legacyHierarchyRole`, `activeInput`, and legacy Active projections only after all supported consumers no longer require them.
7. Keep legacy datasets readable or provide an explicit archival/export policy; never delete them solely because compatibility projections are retired.

## 13. Explicit exclusions

Sprint 1C does not implement:

- storage migration or IndexedDB schema changes;
- a database version bump;
- direct employee-to-manager reporting graph;
- hierarchy redesign, traversal, or hierarchy effective dating;
- branch assignment changes/history;
- vintage calculations;
- analytics or UI;
- production JavaScript or tests;
- automatic rollback tooling.

## 14. Sprint 1C acceptance criteria

Sprint 1C is complete when this document:

- records the current dataset/record lifecycle and persisted shape;
- distinguishes dataset lifecycle version from Employee data-contract version;
- selects metadata-directed dual-read and non-destructive lazy adaptation;
- states exactly what new v2 imports should persist and what remains transient;
- preserves STAGED → ACTIVE → SUPERSEDED/FAILED safety;
- defines rollback as explicit/audited rather than hidden copying;
- explains v2 Employee/v8.2 Hierarchy coexistence and factual degradation;
- classifies all required compatibility fields;
- handles legacy, native, mixed, malformed, unknown-version, replacement, rollback, and future-v3 cases;
- confirms no IndexedDB version bump is required by this contract; and
- leaves production code, tests, storage, analytics, and UI unchanged.

## 15. Recommended next implementation step

**Sprint 1D — Employee Master v2 Dataset Contract Metadata & Dual-Read Adapter** should be the next implementation step. It should:

1. add metadata-only Employee contract declarations to Master Import staging;
2. add a single version-aware Employee dataset reader/adapter at the repository/authority boundary;
3. preserve active v1 datasets unchanged and make adaptation read-only;
4. add focused lifecycle tests for v1 open, v2 replacement, invalid replacement, staged failure, unsupported contract, and future rollback preconditions;
5. avoid an IndexedDB version bump unless an approved index/store/key-path requirement appears; and
6. not alter hierarchy rules, graph traversal, assignment, vintage, UI, or analytics.

