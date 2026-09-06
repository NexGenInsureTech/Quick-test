# BancaTracker Enterprise v8.3

## Sprint 1A — Employee Master v2 Contract

**Status:** Architecture contract
**Baseline:** BancaTracker Enterprise v8.2.0
**Scope:** Employee identity and workforce attributes only; no production implementation

## 1. Objective

Define a durable Employee Master v2 contract that describes who an employee is and the workforce attributes needed for governance and analysis. The contract separates designation from reporting structure, supports authoritative employment dates, derives vintage rather than storing it, and provides a controlled migration path from the v8.2 `ROLE` model.

Employee Master v2 must support direct employee-to-manager hierarchy, including skip-level reporting, without using designation to decide who may report to whom.

## 2. Design principles

1. `EMPLOYEE ID` is the durable employee identity and must not be reused.
2. Employee Master describes the employee; it does not encode the reporting graph or deployment history.
3. `DESIGNATION` is descriptive free text. It never validates or infers a manager relationship.
4. Dates are authoritative source facts. Vintage values are derived for an explicit as-of date and are not persisted as master inputs.
5. Missing information remains missing; it is not fabricated from designation, hierarchy, branch assignment, or the current date.
6. One v2 dataset contains one current canonical record per employee. Dataset versioning preserves snapshots; future attribute-history modelling requires an explicit separate design.
7. Existing v8.2 Employee Master files remain ingestible through a documented compatibility layer during migration.
8. Normalized values support matching, while source values needed for audit remain available.

## 3. Canonical field contract

| CSV header | Canonical property | Requirement | Type / format | Meaning and rules |
|---|---|---:|---|---|
| `EMPLOYEE ID` | `employeeId` | Required | Text/code | Durable primary identity. Trim, normalize case, preserve meaningful internal punctuation and leading zeroes. Never reused for another person. |
| `EMPLOYEE NAME` | `employeeName` | Required | Text | Display name. Trim and collapse repeated whitespace; preserve human-readable case. |
| `DESIGNATION` | `designation` | Conditionally required during migration; required for native v2 | Free-form text | Current descriptive job title. Unknown values are valid. Must not control hierarchy. |
| `GRADE` | `grade` | Optional | Text/code | Employer-defined grade. Normalize for comparison without imposing a global vocabulary. |
| `BAND` | `band` | Optional | Text/code | Employer-defined band. May coexist with Grade; no inferred ordering unless separately governed. |
| `EMPLOYMENT TYPE` | `employmentType` | Optional | Extensible controlled text | Workforce arrangement such as `REGULAR`, `CONTRACT`, `PROBATION`, `INTERN`, `TEMPORARY`, `CONSULTANT`, or `OTHER`. Retain unknown nonblank values with a warning. |
| `FUNCTION` | `functionName` | Optional | Text | Business function. Descriptive; not a reporting relationship. |
| `CHANNEL` | `channelName` | Optional | Text | Workforce channel. Descriptive and independent of branch deployment. |
| `BASE LOCATION` | `baseLocation` | Optional | Text/code | Contractual/home work location. It must not be interpreted as a branch assignment or reporting unit. A durable location identifier can replace this text only when a governed Location Master exists. |
| `DATE OF JOINING` | `dateOfJoining` | Optional but authoritative when supplied | `YYYY-MM-DD` | First company employment date for the durable employee identity. Drives Company Vintage. |
| `CHANNEL JOIN DATE` | `channelJoinDate` | Optional | `YYYY-MM-DD` | Date the employee entered the recorded channel. Drives Channel Vintage. |
| `DESIGNATION EFFECTIVE DATE` | `designationEffectiveDate` | Optional | `YYYY-MM-DD` | Effective date of the current recorded designation. Drives Designation Vintage. It is not a hierarchy-effective date. |
| `EXIT DATE` | `exitDate` | Optional | `YYYY-MM-DD` | Last employment date or effective separation date according to the adopted HR source convention. Required for `EXITED`; for `ACTIVE`, only a future scheduled Exit Date may be supplied. |
| `EMPLOYMENT STATUS` | `employmentStatus` | Conditionally required during migration; required for native v2 | Controlled text | Canonical employment state. Initial vocabulary: `ACTIVE`, `INACTIVE`, `EXITED`, `SUSPENDED`, `LEAVE`. Vocabulary may be extended through governance, not silently. |
| `ACTIVE` | `active` | Legacy/transitional optional | Boolean | v8.2 compatibility input. In native v2 it is a derived compatibility projection, not an independent source of truth. |
| `ROLE` | `legacyRole` | Legacy/deprecated optional | Text | Accepted only for v8.2 compatibility. May seed `DESIGNATION` when the latter is absent. It must not constrain designation or future reporting validity. |

### 3.1 Required-field profiles

Native v2 files require:

```text
EMPLOYEE ID
EMPLOYEE NAME
DESIGNATION
EMPLOYMENT STATUS
```

During the transition, a v8.2 file containing `EMPLOYEE ID`, `EMPLOYEE NAME`, `ROLE`, and `ACTIVE` remains acceptable. The compatibility layer maps the legacy inputs as described in section 9 and emits migration diagnostics rather than rejecting an otherwise valid legacy file.

## 4. Identity and normalization

### 4.1 Employee identity

- Trim leading/trailing whitespace and non-breaking spaces.
- Normalize `EMPLOYEE ID` to uppercase for canonical matching.
- Preserve leading zeroes; the ID is always text, never numeric.
- Do not remove internal punctuation or spaces automatically because they may be meaningful source-system identifiers.
- Blank IDs are invalid.
- IDs differing only by normalization are duplicates.
- An ID must identify the same person across dataset versions. Reuse is a governance error outside the validator's ability to prove and should be audited operationally.

### 4.2 Descriptive text

- Trim leading/trailing whitespace and replace non-breaking spaces.
- Collapse repeated internal whitespace for names and descriptive attributes.
- Blank normalized text becomes `null` for optional fields.
- Preserve display casing for names, designation, function, channel, and base location.
- Comparisons may use separate uppercase normalized keys; display values must not be destructively rewritten.

### 4.3 Designation

- `DESIGNATION` is free-form descriptive text.
- Values such as `USM`, `MT`, `Executive`, and `Coordinator` are valid and must not fail merely because they are absent from the v8.2 role vocabulary.
- Normalization may detect spelling/casing variants for Data Quality reporting but must not translate a designation into a reporting level.
- No manager, hierarchy slot, authority, or branch deployment may be inferred from designation.

### 4.4 Employment type and status

- Controlled values are matched case-insensitively after whitespace normalization.
- Unknown `EMPLOYMENT TYPE` values are retained and warned because the field is intentionally extensible.
- Unknown `EMPLOYMENT STATUS` values are blocking until governed, because status controls employment-state interpretation.

### 4.5 Legacy booleans

For transitional `ACTIVE`, accept the v8.2 forms:

```text
true:  TRUE, YES, Y, 1
false: FALSE, NO, N, 0
```

## 5. Date semantics

All Employee Master v2 dates use the canonical Gregorian calendar form `YYYY-MM-DD`. Parsing must be strict: the text must represent a real calendar date and round-trip to the same canonical value. Locale-dependent forms such as `01/02/2026` are not accepted.

| Date | Semantics | Ordering rule |
|---|---|---|
| `DATE OF JOINING` | Company employment start | Must not be after Channel Join Date, Designation Effective Date, or Exit Date when those dates are supplied. |
| `CHANNEL JOIN DATE` | Start in the recorded channel | Must not precede Date of Joining when both are supplied; must not be after Exit Date. |
| `DESIGNATION EFFECTIVE DATE` | Start of the current recorded designation | Must not precede Date of Joining when both are supplied; must not be after Exit Date. It need not be on or after Channel Join Date because designation and channel changes are independent. |
| `EXIT DATE` | Employment separation boundary | Must not precede any supplied employment-start date. Required for `EXITED`; prohibited for `ACTIVE`. |

Dates in the future relative to the dataset's declared effective/as-of date are not automatically malformed. They indicate future-effective workforce data and should produce a warning unless the import mode explicitly supports future records. Validation must use an explicit dataset/import as-of date, never an implicit wall-clock assumption hidden in the validator.

Reporting-relationship effective dates do not belong in Employee Master. They belong on employee-to-manager records in Hierarchy Master. Branch deployment effective dates belong in Branch Assignment Master.

## 6. Employment state

`EMPLOYMENT STATUS` is the v2 authority. `ACTIVE` remains only as a compatibility input/output during migration.

Recommended compatibility projection:

| Employment status | Derived `active` |
|---|---:|
| `ACTIVE` | `true` |
| `LEAVE` | `true` |
| `INACTIVE` | `false` |
| `EXITED` | `false` |
| `SUSPENDED` | `false` |

The distinction between payroll/HR employment and analytical eligibility must remain explicit. A status such as `LEAVE` may be employed but temporarily unavailable; downstream analytics must not silently reinterpret it as branch assignment or productive activity.

Consistency rules:

- `ACTIVE` status plus an Exit Date on or before the declared dataset as-of date is a blocking contradiction; a future scheduled Exit Date is retained with a future-effective warning.
- `EXITED` without an Exit Date, or with an Exit Date after the declared dataset as-of date, is a blocking contradiction.
- `EXITED` with transitional `ACTIVE = true` is a blocking contradiction.
- `ACTIVE` or `LEAVE` with transitional `ACTIVE = false` is a blocking contradiction.
- If `EMPLOYMENT STATUS` is absent but legacy `ACTIVE` is valid, derive transitional status as `ACTIVE` or `INACTIVE` and emit a migration warning.
- If both are supplied and consistent, `EMPLOYMENT STATUS` remains authoritative.
- `INACTIVE` does not by itself prove exit and therefore does not require an Exit Date.

## 7. Vintage derivation model

Vintage is calculated on demand and is never an uploaded or persisted Employee Master field.

| Measure | Source date | Derivation |
|---|---|---|
| Company Vintage | `DATE OF JOINING` | Duration from Date of Joining to the effective as-of boundary. |
| Channel Vintage | `CHANNEL JOIN DATE` | Duration from Channel Join Date to the effective as-of boundary. |
| Designation Vintage | `DESIGNATION EFFECTIVE DATE` | Duration from Designation Effective Date to the effective as-of boundary. |

### 7.1 As-of boundary

For a requested historical as-of date:

1. use the explicit reporting as-of date;
2. if Exit Date is earlier than that date, cap the duration at Exit Date;
3. if the source date is missing, return `null`/`UNAVAILABLE`, never zero;
4. if the source date is later than the as-of boundary, return `null`/`NOT_YET_EFFECTIVE`, never a negative vintage;
5. use calendar dates rather than milliseconds so time zones and daylight-saving behavior cannot alter day counts.

Presentation may express completed days, completed months, completed years, or a structured years/months duration, but the central derivation authority must define one canonical calculation. Consumers must not independently approximate vintage as `current year - joining year`.

Historical vintage is reliable only when the employee attributes applicable at the requested as-of date are available. A current-snapshot Employee Master cannot reconstruct past designation or channel changes. Future historical attribute support requires governed effective-dated snapshots or a separate Employee Attribute History contract.

## 8. Validation and finding taxonomy

### 8.1 Blocking errors

| Proposed code | Condition |
|---|---|
| `EMPLOYEE_ID_MISSING` | `EMPLOYEE ID` is blank after normalization. |
| `EMPLOYEE_NAME_MISSING` | `EMPLOYEE NAME` is blank after normalization. |
| `EMPLOYEE_DUPLICATE_ID` | More than one row resolves to the same normalized Employee ID in a snapshot. |
| `EMPLOYEE_DUPLICATE_ACTIVE_RECORD` | More than one current/active canonical record exists for the same Employee ID. In the initial snapshot contract this is equivalent to a duplicate ID but remains a useful explicit diagnostic for future temporal imports. |
| `EMPLOYEE_DESIGNATION_MISSING` | Native v2 record has neither Designation nor a permitted transitional Role fallback. |
| `EMPLOYEE_STATUS_MISSING` | Native v2 record has neither Employment Status nor a permitted transitional Active fallback. |
| `EMPLOYEE_STATUS_INVALID` | Employment Status is outside the governed vocabulary. |
| `EMPLOYEE_ACTIVE_INVALID` | Supplied transitional Active value cannot be parsed. |
| `EMPLOYEE_DATE_INVALID` | A supplied authoritative date is malformed or not a real `YYYY-MM-DD` date. |
| `EMPLOYEE_DATE_ORDER_INVALID` | Supplied dates violate the ordering rules in section 5. |
| `EMPLOYEE_STATUS_DATE_CONFLICT` | Status and Exit Date contradict one another. |
| `EMPLOYEE_STATUS_ACTIVE_CONFLICT` | Employment Status contradicts supplied legacy Active. |

Blocking errors prevent activation of the candidate Employee Master dataset. Existing active data remains untouched under the established replacement-safety rule.

### 8.2 Warnings

| Proposed code | Condition |
|---|---|
| `EMPLOYEE_LEGACY_ROLE_USED` | Designation was populated from legacy Role. |
| `EMPLOYEE_LEGACY_ACTIVE_USED` | Employment Status was derived from legacy Active. |
| `EMPLOYEE_ROLE_DESIGNATION_DIFFER` | Both are supplied and materially differ; Designation remains authoritative and neither controls hierarchy. |
| `EMPLOYEE_EMPLOYMENT_TYPE_UNKNOWN` | Nonblank Employment Type is outside the recommended vocabulary; retain the value. |
| `EMPLOYEE_DATE_MISSING` | A date needed for a requested vintage measure is absent. This affects analytical completeness, not dataset identity validity. |
| `EMPLOYEE_DATE_FUTURE_EFFECTIVE` | A supplied date is later than the declared dataset/import as-of date. |
| `EMPLOYEE_OPTIONAL_ATTRIBUTE_MISSING` | A governed completeness policy identifies a missing optional analytical attribute. |

Unknown/free-form Designation is not an error or warning solely because it is unknown. A warning is appropriate only for objective quality conditions such as suspicious whitespace, prohibited control characters, or conflict with another supplied source field.

## 9. Backward compatibility and migration

The v8.2 `ROLE` field currently performs three jobs: input validation, hierarchy-level classification, and result-slot naming. Removing it without a bridge would reject existing files and break current hierarchy validation/resolution.

### 9.1 Decision

Adopt a transitional compatibility layer:

- `DESIGNATION` replaces `ROLE` as the employee-description field.
- `ROLE` remains an accepted deprecated input for v8.2 datasets during a defined migration window.
- When Designation is absent and Role is present, preserve the normalized source Role label as Designation and emit `EMPLOYEE_LEGACY_ROLE_USED`.
- A recognized legacy Role may also populate a separate nullable `legacyHierarchyRole` compatibility projection for unchanged v8.2 consumers.
- Designation must never populate `legacyHierarchyRole` by inference.
- Unrecognized Role text may be retained as Designation in compatibility mode; it must not be rejected merely for falling outside the old five-role vocabulary.
- Native v2 exports should omit Role after downstream hierarchy consumers no longer depend on it.

### 9.2 Migration phases

1. **Dual-read:** accept native v2 headers and v8.2 Role/Active headers; emit migration diagnostics.
2. **Consumer decoupling:** change hierarchy validation and traversal to use direct employee-to-manager relationships and relationship effective dates, not employee designation or legacy role.
3. **Compatibility retirement:** stop generating legacy role projections only after all v8.2 consumers and stored active datasets have an explicit migration path.

No automatic destructive rewrite of active v8.2 Employee Master data is permitted. Dataset version, source headers, transformation version, and migration diagnostics should remain auditable.

## 10. Separation of concerns

| Authority | Owns | Must not own or infer |
|---|---|---|
| Employee Master | Who the employee is; name, designation, grade/band, employment type/status, function/channel, base location, authoritative workforce dates | Manager relationships, reporting levels inferred from designation, branch deployment, branch productivity |
| Hierarchy Master | Who reports to whom; relationship validity interval; direct manager edges; future skip-level-safe graph | Employee designation, employment identity attributes, branch assignment |
| Branch Assignment Master | Where an employee is deployed; branch-to-employee relationship and assignment validity interval | Reporting manager, designation, company/channel vintage |
| Analytics authorities | As-of selection and derived measures such as vintage, manpower, span, attrition, and productivity | Rewriting source masters or inventing missing relationships/dates |

```text
Employee Master (WHO)
        │ employeeId
        ├──────── Hierarchy Master (WHO reports to WHOM, and WHEN)
        │
        └──────── Branch Assignment Master (WHERE deployed, and WHEN)

Authoritative Employee dates ──> derived vintage at explicit AS-OF date
```

Designation is never an edge in this model and must never be used to infer a manager relationship.

## 11. High-value future-proofing

The v2 contract intentionally limits employee attributes to fields with clear value:

- `EMPLOYEE ID`, employment status/type, and dates support manpower and attrition populations.
- Date of Joining, Channel Join Date, and Designation Effective Date support distinct vintage measures.
- Function and Channel support workforce/productivity segmentation without encoding hierarchy.
- Grade/Band supports workforce mix and span-of-control interpretation when governed locally.
- Base Location supports location-based manpower analysis but remains separate from operational branch deployment.
- Direct reporting edges and their effective dates, designed separately in Hierarchy Master v2, support span of control and restructuring.

Fields such as compensation, personal contact details, birth date, government identifiers, performance ratings, and speculative organisational labels are excluded. They add privacy, security, or governance burden without being necessary for the stated v8.3 outcomes.

## 12. Future migration notes

- A later implementation must declare an Employee Master contract/schema version independently from the application release label.
- IndexedDB changes require an explicit migration design and are not authorized by Sprint 1A.
- Existing records using `role`, `active`, `validFrom`, and `validTo` cannot be silently reinterpreted. In particular, v8.2 Employee `VALID FROM/VALID TO` semantics are weakly defined; they must not be assumed to be hierarchy or designation dates.
- Reporting relationship dates must move into the Hierarchy Master v2 design, not be copied from Employee Master.
- Current hierarchy consumers expose fixed `rmId/csmId/asmId/zsmId/nationalHeadId` slots derived from Role. Direct-graph migration must define compatibility projections separately from graph traversal.
- Skip-level reporting must be valid when the direct edge is valid; missing an intermediate designation must not invalidate the relationship.
- Historical analytics must select both employee attributes and relationships using the same explicit as-of policy before joining them.
- Import previews should identify source contract version, applied fallbacks, and counts of native versus compatibility records.

## 13. Explicit Sprint 1A exclusions

Sprint 1A does not implement or change:

- the direct reporting graph;
- hierarchy traversal or skip-level resolution;
- hierarchy effective dating;
- branch assignment history or effective dating;
- manpower, productivity, vintage, span-of-control, attrition, or restructuring analytics;
- UI or CSV import screens;
- IndexedDB schema or storage migration;
- current production validators, authorities, load order, or tests;
- v8.2 production behavior.

## 14. Sprint 1A acceptance criteria

Sprint 1A is complete when this contract:

- defines durable employee identity and normalization;
- separates Designation from hierarchy validity;
- defines a concise canonical v2 field set and native/compatibility requirements;
- defines strict authoritative-date semantics and ordering;
- makes Employment Status authoritative while preserving a safe Active bridge;
- defines Company, Channel, and Designation Vintage as non-persisted as-of derivations;
- assigns hierarchy dates and assignment dates to their proper masters;
- classifies blocking errors and warnings, including duplicate identities and contradictory states;
- accepts free-form designations outside the five legacy roles;
- documents a non-destructive v8.2 migration strategy;
- identifies compatibility risks without implementing them;
- keeps production JavaScript, tests, storage, analytics, and UI unchanged.

## 15. Recommended Sprint 1B implementation scope

Sprint 1B should implement only the Employee Master v2 ingestion and canonicalization boundary after approving the storage/migration approach:

1. add version-aware native-v2 and legacy-v8.2 header recognition;
2. implement strict normalization, date parsing, state consistency, and finding codes from this contract;
3. preserve source/audit values and expose explicit compatibility projections for current consumers;
4. add focused unit tests for native v2, legacy fallback, free-form designations, dates, duplicates, and contradictory employment states;
5. specify and test activation replacement safety;
6. document any required IndexedDB schema migration before changing storage;
7. leave hierarchy graph/effective-date implementation, assignment history, analytics, and UI to separately approved sprints.

Sprint 1B must not make Designation a hierarchy control or silently reinterpret v8.2 `VALID FROM/VALID TO` fields.
