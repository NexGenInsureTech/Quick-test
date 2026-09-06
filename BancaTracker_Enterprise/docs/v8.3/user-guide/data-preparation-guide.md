# BancaTracker Enterprise v8.3 data preparation guide

Prepare UTF-8 CSV files with a single header row. Header spelling, spaces, and punctuation below are the accepted source names. Codes are normalized as text; never allow spreadsheet software to remove leading zeroes or convert identifiers to scientific notation. Use fictional examples only in test or training files.

## Shared rules

- Boolean values accepted by the governed masters are `TRUE`/`FALSE`, `YES`/`NO`, `Y`/`N`, or `1`/`0` where a boolean is required.
- Effective dates use real calendar dates in `YYYY-MM-DD` format. A blank `VALID TO` means open-ended where that field is supported.
- A blank optional value is not zero. Do not use `0` to mean unknown.
- Resolve blocking errors before activation. Warnings preserve a valid dataset but require interpretation.
- Preserve durable IDs exactly as text. Duplicate canonical identities are blocking errors.

## Geography Master

Required headers: `STATE ID`, `STATE NAME`, `ZONE ID`, `ZONE NAME`, `ACTIVE`.

Optional header: `STATE CODE`.

Example:

```csv
STATE ID,STATE CODE,STATE NAME,ZONE ID,ZONE NAME,ACTIVE
IN-KA,KA,Karnataka,SOUTH,South,TRUE
```

`STATE ID` is the durable key. State codes/names must not conflict with another state identity. Zone ID/name must be consistent for the same zone. Use one active state identity per canonical state.

## Branch Master

Required headers: `BANK ID`, `BRANCH CODE`, `BRANCH NAME`, `STATE ID`, `ACTIVE`.

Optional headers: `BANK REGION ID`, `BANK REGION NAME`, `BANK ZONE ID`, `BANK ZONE NAME`, `FGM OFFICE ID`, `FGM OFFICE NAME`, `ACTIVATION ELIGIBLE` (or supported activation-eligibility alias), `VALID FROM`, `VALID TO`.

Example:

```csv
BANK ID,BRANCH CODE,BRANCH NAME,STATE ID,ACTIVE,ACTIVATION ELIGIBLE,VALID FROM,VALID TO
IB,00123,Example Branch,IN-KA,TRUE,TRUE,2026-04-01,
```

`BANK ID` plus `BRANCH CODE` forms the durable branch identity. `STATE ID` must resolve in Geography Master when geographic validation is active. Activation eligibility is optional but missing it generates a warning. Do not use a branch name as the durable identity.

## Employee Master v2

Required canonical fields: `EMPLOYEE ID`, `EMPLOYEE NAME`, `DESIGNATION`, and `EMPLOYMENT STATUS`. A valid transitional `ROLE` can supply designation compatibility, and `ACTIVE` can supply legacy employment-status compatibility for legacy rows.

Optional fields: `GRADE`, `BAND`, `EMPLOYMENT TYPE`, `FUNCTION`, `CHANNEL`, `BASE LOCATION`, `DATE OF JOINING`, `CHANNEL JOIN DATE`, `DESIGNATION EFFECTIVE DATE`, `EXIT DATE`, `ROLE`, `ACTIVE`, `VALID FROM`, `VALID TO`.

Example:

```csv
EMPLOYEE ID,EMPLOYEE NAME,DESIGNATION,EMPLOYMENT STATUS,DATE OF JOINING,CHANNEL JOIN DATE,ROLE,ACTIVE
E1001,Asha Example,USM,ACTIVE,2020-06-01,2021-04-01,,TRUE
```

Employment status is controlled: `ACTIVE`, `INACTIVE`, `SUSPENDED`, `LEAVE`, or `EXITED`. `EXITED` requires an effective `EXIT DATE`; an active employee cannot have an effective exit date. Channel join, designation effective, and exit dates cannot precede the applicable company joining date. Unknown employment types are retained as warnings, not rejected. Free-form designation is accepted and never validates a manager relationship.

## Direct Reporting Hierarchy v2

Required headers: `EMPLOYEE ID`, `VALID FROM`.

Optional headers: `MANAGER EMPLOYEE ID`, `VALID TO`.

Example:

```csv
EMPLOYEE ID,MANAGER EMPLOYEE ID,VALID FROM,VALID TO
E1001,E0900,2026-04-01,
E0900,,2026-04-01,
```

Both employee and nonblank manager IDs must exist in Employee Master. A blank manager identifies an explicit root. The relationship must be within known employment dates where those dates are verifiable. Self-reference, duplicate identity/date pairs, overlapping relationships for an employee, invalid date order, and temporal cycles block activation. Multiple effective roots are a warning. Designation and legacy ROLE do not define adjacency.

## Workforce Deployment v2

Required headers: `EMPLOYEE ID`, `BANK ID`, `BRANCH CODE`, `DEPLOYMENT TYPE`, `VALID FROM`.

Optional header: `VALID TO`.

Example:

```csv
EMPLOYEE ID,BANK ID,BRANCH CODE,DEPLOYMENT TYPE,VALID FROM,VALID TO
E1001,IB,00123,PRIMARY,2026-04-01,
```

`DEPLOYMENT TYPE` is `PRIMARY` or `SUPPORT`. Employee and Branch Master identities must exist, and dates must sit within known effective/employment bounds when verifiable. Overlapping records for the same employee/branch and overlapping primaries for a branch block activation. Deployment says where a person is deployed; it does not prove business ownership.

## Legacy Branch Assignment

Required headers: `BANK ID`, `BRANCH CODE`, `RM ID`, `ACTIVE`.

Optional headers: `VALID FROM`, `VALID TO`.

Example:

```csv
BANK ID,BRANCH CODE,RM ID,ACTIVE,VALID FROM,VALID TO
IB,00123,E1001,TRUE,2026-04-01,
```

This is a legacy compatibility master. Its RM ID and branch identity must resolve against the relevant governed masters. Use it only where the legacy contract is intended; it is not a projection of native workforce deployment.

## Branch Budget & Potential

Required headers: `BANK ID`, `BRANCH CODE`, `PERIOD`, plus at least one of `BUDGET` or `POTENTIAL`.

Optional header: `BRANCH NAME`.

Example:

```csv
BANK ID,BRANCH CODE,BRANCH NAME,PERIOD,BUDGET,POTENTIAL
IB,00123,Example Branch,2026-04,500000,800000
```

`PERIOD` must be `YYYY-MM`. Budget and potential are non-negative numbers; blank is allowed only if the other value is supplied. A duplicate branch-period or an unmapped branch blocks activation. A commercial reference for an inactive branch is retained with a warning.

## PR transaction CSV

Required headers: `USGI NET PREMIUM`, `Month`, `INTERMEDIARY`, `BA NAME`, `Ba Code`, `LINE OF BUSINESS`, `BRANCH NAME`.

Optional headers: `Zone`, `STATE`, `SUM IMD CODE`, `Business Type`, `PRODUCT NAME`, `PRODUCT CODE`, `Day`, `POLICY ISSUED DATE`.

Example:

```csv
USGI NET PREMIUM,Month,INTERMEDIARY,BA NAME,Ba Code,LINE OF BUSINESS,BRANCH NAME,POLICY ISSUED DATE
12500,Apr-26,Example Bank,Asha Example,E1001,HEALTH,Example Branch,2026-04-15
```

Keep signed premium values as supplied: positive, zero, and negative values have distinct meaning. `Ba Code` is preserved as canonical source RM identity where resolved; `BA NAME` alone is not an employee identity. `POLICY ISSUED DATE` is optional but should use `YYYY-MM-DD` when supplied for canonical temporal enrichment. Month and Day source fields can be compared with internally derived date information; do not manufacture them to suppress a warning.

## Common blocking errors and warnings

| Condition | Typical result | Preparation response |
| --- | --- | --- |
| Missing durable ID | Blocking error | Populate the appropriate ID; do not substitute a display name. |
| Duplicate canonical identity | Blocking error | Retain one authoritative row or make effective ranges non-overlapping where the contract allows history. |
| Invalid boolean/date | Blocking error | Use accepted boolean tokens and real `YYYY-MM-DD` dates. |
| Impossible date range | Blocking error | Correct date ordering or the governing employment/branch relationship. |
| Master foreign key absent | Blocking error | Activate the prerequisite master first. |
| Unknown employment type | Warning | Confirm the source classification; it is retained for extensibility. |
| Missing activation eligibility | Warning | Supply it if activation-universe interpretation requires it. |
| Missing budget or potential coverage | Partial/warning context | Do not interpret an unavailable commercial metric as zero. |
