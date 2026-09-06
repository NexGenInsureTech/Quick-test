# BancaTracker Enterprise v8.3 KPI and analytics glossary

Each entry states a meaning, an interpretation, and an explicit boundary. Definitions describe the current application and its governed foundations; a foundation is not necessarily a dedicated user-facing metric.

## Core business and scope

### Actual / Premium

**Meaning:** Signed premium in accepted PR transactions within the selected scope. **Interpretation:** Positive, zero, and negative records all remain visible in totals. **Does NOT mean:** policy count, target achievement, or guaranteed profitable business.

### Signed Actual

**Meaning:** Actual retained with its original positive, zero, or negative sign. **Interpretation:** It preserves adjustments and reconciliation. **Does NOT mean:** a value that may be converted to zero because it is negative.

### Contribution %

**Meaning:** Unit premium divided by total premium in the same analytical scope. **Interpretation:** It shows relative share. **Does NOT mean:** achievement against budget, potential, or productivity.

### Current Period

**Meaning:** The reporting period currently selected or resolved for the page. **Interpretation:** It defines time scope for the relevant view. **Does NOT mean:** a universal replacement for every historical/as-of date in governed foundations.

### Filter Scope

**Meaning:** The population remaining after the user’s page filters are applied. **Interpretation:** Numerators and denominators should be read in that scope. **Does NOT mean:** an unfiltered enterprise total.

### Observed Branch

**Meaning:** A distinct branch identity seen in PR transactions. **Interpretation:** It indicates source presence. **Does NOT mean:** configured, eligible, or active branch status.

### Branch Universe

**Meaning:** Configured branch population used as an activation denominator. **Interpretation:** It gives breadth context beyond transaction rows. **Does NOT mean:** only branches observed in the current PR file.

### Active Branch

**Meaning:** A branch satisfying the configured activity condition in scope. **Interpretation:** It measures producing distribution breadth. **Does NOT mean:** every observed branch or a permanent employee assignment.

### Near-Active Branch

**Meaning:** An observed branch below the active threshold but within the configured near-active band. **Interpretation:** It is a short-path operational cue. **Does NOT mean:** an active branch.

### Activation %

**Meaning:** Active Branches divided by Branch Universe. **Interpretation:** It measures breadth of activation. **Does NOT mean:** premium share or productivity.

### Activation Gap

**Meaning:** Branch Universe minus Active Branches. **Interpretation:** It describes remaining breadth opportunity. **Does NOT mean:** equal potential at every inactive branch.

### IMD Count

**Meaning:** Distinct normalized intermediary identities observed in scope. **Interpretation:** It is intermediary breadth. **Does NOT mean:** a configured intermediary universe.

### RM Count

**Meaning:** Distinct RM identities observed or resolved in scope. **Interpretation:** It is sensitive to source and mapping consistency. **Does NOT mean:** proof of direct employee attribution.

### Data Quality Status

**Meaning:** A roll-up of applicable quality and readiness diagnostics. **Interpretation:** It directs caution to affected dimensions. **Does NOT mean:** automatic rejection of all analytics.

### Current vs Canonical

**Meaning:** Source-supplied fields are compared with governed/derived canonical information where available. **Interpretation:** Differences show a source or mapping issue to investigate. **Does NOT mean:** that the source record is silently deleted.

## Commercial intelligence

### Budget

**Meaning:** Governed, period-specific branch commercial reference value. **Interpretation:** It supports achievement/variance context. **Does NOT mean:** Actual, contribution, or an automatic target for an employee.

### Potential

**Meaning:** Governed, period-specific branch opportunity reference value. **Interpretation:** It supports opportunity/penetration context. **Does NOT mean:** budget, guaranteed capacity, or Actual.

### Achievement

**Meaning:** Actual compared with Budget when a valid common branch-period scope exists. **Interpretation:** It shows progress against the supplied reference. **Does NOT mean:** contribution or potential penetration.

### Variance

**Meaning:** Difference between Actual and the applicable reference, usually Budget. **Interpretation:** Its sign and scope require review. **Does NOT mean:** a direct measure of business quality.

### Potential Gap

**Meaning:** Difference between Potential and Actual in a common branch-period scope. **Interpretation:** It is an opportunity diagnostic. **Does NOT mean:** a promise that the gap is attainable.

### Commercial Coverage

**Meaning:** Availability of mapped branch-period Budget/Potential reference records for the selected population. **Interpretation:** It states whether commercial measures are complete or partial. **Does NOT mean:** zero reference values for missing records.

### Commercial Driver

**Meaning:** A ranked contributor to a commercial result or variance. **Interpretation:** It helps direct investigation. **Does NOT mean:** proof of causation.

### Commercial Roll-up

**Meaning:** Aggregation of governed commercial measures over a stated scope. **Interpretation:** It must retain scope and coverage context. **Does NOT mean:** permission to add overlapping hierarchical totals together.

## Identity, attribution, and hierarchy

### Employee ID

**Meaning:** Durable textual identity in Employee Master v2. **Interpretation:** It is the key used for governed employee references. **Does NOT mean:** an automatically numeric identifier or a display name.

### Source RM ID / `sourceRmId`

**Meaning:** Canonical source identity derived from PR `Ba Code`. **Interpretation:** Exact Employee Master ID matching is the primary direct-attribution evidence. **Does NOT mean:** BA NAME or a designation.

### BA NAME

**Meaning:** PR source descriptive BA name. **Interpretation:** It can aid source review. **Does NOT mean:** sufficient evidence to attribute a transaction to an employee.

### Direct Attribution

**Meaning:** Zero-or-one employee result for a canonical PR record from permitted evidence. **Interpretation:** Exact source employee identity has priority. **Does NOT mean:** a hierarchy roll-up or a shared allocation.

### Attribution Subject

**Meaning:** The one employee directly attributed to a record when resolution succeeds. **Interpretation:** Their direct Actual can be summed across distinct records. **Does NOT mean:** every manager or deployed participant.

### Attribution Evidence

**Meaning:** Explicit source identity or permitted constrained legacy fallback evidence used by the resolver. **Interpretation:** Source and confidence diagnostics explain the outcome. **Does NOT mean:** a guess from name, designation, or PRIMARY deployment.

### Attribution Status

**Meaning:** Deterministic resolution state, such as directly attributed, legacy-fallback attributed, source absent, source unmapped, ambiguous, or authority unavailable. **Interpretation:** It exposes evidence quality. **Does NOT mean:** a silent fallback decision.

### UNATTRIBUTED

**Meaning:** First-class result where no employee is directly resolved for a canonical record. **Interpretation:** It measures identity coverage and reconciles with attributed Actual. **Does NOT mean:** zero business or absent underlying transaction.

### Unmapped Source Identity

**Meaning:** `sourceRmId` is present but has no exact Employee Master match. **Interpretation:** The record remains explicitly unattributed. **Does NOT mean:** permission to fall through to branch assignment.

### Legacy Fallback

**Meaning:** Constrained Branch Assignment compatibility evidence used only when source RM identity is genuinely absent and the compatible context is available. **Interpretation:** It is lower-confidence, explicit attribution. **Does NOT mean:** a general fallback from an unmapped source identity or native deployment.

### Reconciliation Invariant

**Meaning:** Attributed signed Actual plus Unattributed signed Actual equals accepted underlying signed Actual for the same population. **Interpretation:** It protects completeness without duplication. **Does NOT mean:** that every record must have an employee.

### Direct Reporting Hierarchy

**Meaning:** Effective-dated employee-to-manager relationships. **Interpretation:** It supplies as-of organisational context and supports skip levels. **Does NOT mean:** an employee’s designation or direct business ownership.

### Hierarchy Effective Date

**Meaning:** Date range in which a direct-reporting relationship is valid. **Interpretation:** Use the business/as-of date for historical context. **Does NOT mean:** the employee joining date or deployment date.

### Root

**Meaning:** Direct-reporting record with no manager employee ID. **Interpretation:** It represents a graph root for the effective slice. **Does NOT mean:** a business owner for all descendants.

### Hierarchy Roll-up

**Meaning:** Analytical inclusion of descendant direct-attribution results under effective manager context. **Interpretation:** It supports management context. **Does NOT mean:** duplicated direct attribution or an additive total across managers.

### Team Actual

**Meaning:** Analytically rolled-up actual for an employee’s effective descendant context. **Interpretation:** It is useful when read at one selected structural level. **Does NOT mean:** a measure that can be summed across managers or added to direct Actual.

### Incomplete Hierarchy

**Meaning:** Missing, unresolved, invalid, or partial graph context for some employee/date scope. **Interpretation:** Roll-up interpretation is limited. **Does NOT mean:** that a manager can be inferred from role, designation, or deployment.

## Workforce and deployment

### Employee Master v2

**Meaning:** Governed employee identity, descriptive workforce attributes, dates, and employment status. **Interpretation:** It is the authority for who an employee is. **Does NOT mean:** a reporting graph or branch ownership model.

### Designation

**Meaning:** Free-form descriptive employee title. **Interpretation:** It can support description and future analysis. **Does NOT mean:** manager adjacency, role hierarchy validity, or business ownership.

### Employment Status

**Meaning:** Authoritative controlled employee state. **Interpretation:** It is evaluated with exit-date consistency. **Does NOT mean:** an arbitrary current-date hierarchy decision.

### ROLE (transitional)

**Meaning:** Legacy compatibility input retained for v8.2 datasets. **Interpretation:** It may populate transitional compatibility behavior. **Does NOT mean:** a restriction on v2 designations or the authority for hierarchy.

### ACTIVE (transitional)

**Meaning:** Legacy boolean compatibility input. **Interpretation:** It can support legacy-status projection when permitted. **Does NOT mean:** an override of authoritative native employment status.

### Company Vintage

**Meaning:** Derived duration from DATE OF JOINING to the requested as-of date. **Interpretation:** It describes company tenure when source date coverage exists. **Does NOT mean:** a manually maintained employee field.

### Channel Vintage

**Meaning:** Derived duration from CHANNEL JOIN DATE to the requested as-of date. **Interpretation:** It describes channel tenure. **Does NOT mean:** company vintage when dates differ.

### Designation Vintage

**Meaning:** Derived duration from DESIGNATION EFFECTIVE DATE to the requested as-of date. **Interpretation:** It describes time in the stated designation context. **Does NOT mean:** reporting-manager tenure.

### Workforce Deployment v2

**Meaning:** Effective-dated employee-to-branch deployment records. **Interpretation:** It states where a person is deployed. **Does NOT mean:** direct transaction ownership.

### PRIMARY Deployment

**Meaning:** Governed primary deployment type for a branch/date. **Interpretation:** It identifies deployment responsibility context. **Does NOT mean:** that the employee owns all branch business.

### SUPPORT Deployment

**Meaning:** Governed support deployment type for a branch/date. **Interpretation:** It gives deployment context. **Does NOT mean:** a premium split or attributable business share.

### Branch Assignment (legacy)

**Meaning:** Legacy branch-to-RM compatibility master. **Interpretation:** It may be used only by permitted legacy compatibility paths. **Does NOT mean:** a native Workforce Deployment v2 record.

### Deployment Alignment

**Meaning:** Diagnostic comparison between business and effective deployment context. **Interpretation:** It can reveal mapping or operating-model questions. **Does NOT mean:** proof of business ownership.

### Deployed Actual

**Meaning:** Actual analysed against an employee’s effective deployment scope. **Interpretation:** It is a contextual diagnostic. **Does NOT mean:** direct attributed Actual or a sum to allocate between PRIMARY/SUPPORT employees.

### Deployment Coverage

**Meaning:** Proportion of relevant business/branch context with resolvable deployment information. **Interpretation:** It qualifies deployment analysis. **Does NOT mean:** attribution coverage.

## Governance and readiness

### Canonical Record

**Meaning:** Accepted PR record enriched/normalised through the governed canonical path. **Interpretation:** It is the unit used by later pure authorities. **Does NOT mean:** a persisted business-attribution dataset.

### Master Readiness

**Meaning:** Status indicating whether an active governed dataset is usable for its intended authority. **Interpretation:** It signals availability, partial coverage, or blocking problems. **Does NOT mean:** that all downstream analytics are complete.

### READY

**Meaning:** Required validation has passed for the applicable master/authority profile. **Interpretation:** The governed records are available for their stated use. **Does NOT mean:** that business coverage is necessarily 100%.

### PARTIAL

**Meaning:** A valid dataset or context has known incomplete optional/reference coverage. **Interpretation:** Results require coverage-aware interpretation. **Does NOT mean:** invalidity or zero values for gaps.

### Legacy Compatibility

**Meaning:** Explicit support for an earlier approved data contract. **Interpretation:** It preserves v8.2/v8.3 transition behavior within its firewall. **Does NOT mean:** native v2 equivalence or permission to mix authorities freely.

### Unsupported Contract

**Meaning:** Dataset metadata/profile cannot be safely interpreted by the active authority. **Interpretation:** The context is unavailable rather than guessed. **Does NOT mean:** that records are silently converted to another model.

### Canonical Readiness

**Meaning:** Degree to which accepted PR records can be governedly derived/resolved for canonical fields. **Interpretation:** It identifies where source data and masters support trusted enrichment. **Does NOT mean:** all legacy source fields are wrong.

### Diagnostic

**Meaning:** Deterministic code/message explaining an availability, mapping, validation, or coverage condition. **Interpretation:** It is evidence for steward investigation. **Does NOT mean:** an automatic management conclusion.

### Blocking Error

**Meaning:** Validation condition that prevents a dataset activation or supported resolution. **Interpretation:** Correct it before relying on that authority. **Does NOT mean:** an instruction to change unrelated production data.

### Warning

**Meaning:** Non-blocking condition retained with the dataset/result. **Interpretation:** It limits or qualifies interpretation. **Does NOT mean:** that it can be ignored.

### As-of Date

**Meaning:** Explicit date used to select effective historical employee, hierarchy, or deployment context. **Interpretation:** It preserves temporal meaning. **Does NOT mean:** the browser’s current date unless explicitly supplied by the calling scope.
