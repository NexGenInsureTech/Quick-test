# BancaTracker Enterprise v8.3 user guide

## What BancaTracker does

BancaTracker is an offline, browser-local Bancassurance reporting application. It accepts PR transaction CSV data and governed master CSV data, evaluates data quality, and provides business, activation, productivity, commercial, target, and management views. It has no server dependency, external CDN, or cloud database.

v8.3 retains the v8.2 business-management experience and adds governed workforce foundations: Employee Master v2, effective-dated direct reporting, effective-dated workforce deployment, controlled business-attribution resolution, attribution reconciliation, and analytical hierarchy roll-up. These additions strengthen identity and interpretation boundaries; they do not create a new dedicated workforce management page.

## Current application navigation

The currently visible toolbar pages are:

| Available current UI | Primary use |
| --- | --- |
| **Performance MIS** | Current-period and filtered business performance. |
| **Activation Cockpit** | Branch activation breadth and opportunity cues. |
| **Management Scorecard** | Comparative partner-management view. |
| **Target & Growth** | Target/growth interpretation where configured data is available. |
| **Productivity & Opportunity** | RM, IMD, and branch productivity views. |
| **Commercial Performance** | Branch commercial performance, comparison, execution, drivers, and available drill-downs. |
| **Data Quality** | Source-data, mapping, and canonical-readiness diagnostics. |
| **Master Data** | Import, preview, activate, replace, and inspect governed master datasets. |

The pages above are the user interface. The following are **implemented foundations, not dedicated user pages**: direct-reporting temporal resolution, workforce deployment resolution, business attribution, attribution reconciliation, hierarchy roll-up, and workforce-performance analysis. Do not expect a separate workforce page, team scorecard, or automatic ownership assignment from these foundations.

## Recommended operating sequence

1. Open **Master Data** and inspect the currently active master status.
2. Load or replace **Geography Master** before Branch Master when branch states are governed.
3. Load Employee Master v2 before direct reporting or native workforce deployment data.
4. Load Branch Master before Branch Budget & Potential and native workforce deployment data.
5. Load the appropriate organisation structure: legacy Organisation Hierarchy where required by legacy flows, or direct-reporting v2 where its governed temporal model is in use. They are not interchangeable definitions.
6. Load either the appropriate legacy Branch Assignment data or native Workforce Deployment v2 for its own governed purpose. PRIMARY/SUPPORT deployment is not a business-owner instruction.
7. Load Branch Budget & Potential after Branch Master.
8. Upload PR transactions, review the import summary and **Data Quality**, then interpret the visible business pages.

Each master replacement should be treated as a controlled data change. Preview first, resolve blocking errors, activate the valid replacement, and recheck downstream readiness. An invalid replacement does not silently become the active master.

## Master Data workflow

Master Data provides the user-facing workflow for governed imports. The current administration labels are Geography Master, Branch Master, Employee Master, Organisation Hierarchy, Branch Assignment, and Branch Budget & Potential. v8.3 also supports direct-reporting and workforce-deployment v2 contracts where their data is supplied through the governed import flow; their analytical use remains a foundation rather than a separate page.

### Geography Master

Use Geography Master for State-to-Zone authority. A Branch Master state must exist in the active Geography Master when the branch validation requires it. Geography makes zone resolution governable; it does not rewrite historical source data without a documented mapping decision.

### Branch Master

Use durable Bank ID plus Branch Code identities. A branch name is descriptive, not a durable substitute for the branch identity. State, activation eligibility, optional regional fields, and effective dates support governed branch interpretation.

### Employee Master v2

Employee Master identifies a person and descriptive workforce attributes. `EMPLOYEE ID` is the durable identity. `DESIGNATION` is free text: values such as USM, MT, Executive, and Coordinator are valid descriptions and do not determine reporting relationships. Employment status is authoritative; ROLE and ACTIVE are transitional compatibility inputs.

### Direct Reporting Hierarchy v2

Direct Reporting Hierarchy states who reports to whom for an effective date range. It must reference Employee Master identities. It supports skip-level structures and does not infer a manager from designation. Relationship dates belong here, not in Employee Master.

### Workforce Deployment and Branch Assignment

Workforce Deployment v2 states where an employee is deployed, with `PRIMARY` or `SUPPORT` deployment and effective dates. It is not business ownership. Legacy Branch Assignment is a separate compatibility model that can be used only where its legacy contract is active and supported. Do not convert deployment roles into RM ownership by assumption.

### Branch Budget & Potential

This optional governed master records period-specific branch Budget and Potential. It introduces achievement and opportunity context; it does not redefine contribution. A valid Branch Master reference is required.

## PR transaction upload

Upload the PR CSV from the main toolbar. Required source columns are `USGI NET PREMIUM`, `Month`, `INTERMEDIARY`, `BA NAME`, `Ba Code`, `LINE OF BUSINESS`, and `BRANCH NAME`. `POLICY ISSUED DATE` is optional but is important where canonical date-based enrichment is available. See the data-preparation guide for the complete current header list.

After upload, first read the import summary and **Data Quality**. A usable file can still have mapping, completeness, duplicate, or source-versus-canonical warnings. Review the affected dimension before relying on a precise drill-down or productivity conclusion.

## Reading the visible analytics

- **Performance MIS** answers how much business was recorded in the selected scope and where contribution sits.
- **Activation Cockpit** distinguishes observed branches from active branches and the configured branch universe.
- **Management Scorecard** keeps configured partners visible, including zero-business situations where applicable.
- **Productivity & Opportunity** must be read with its denominator: RM, IMD, observed branch, active branch, or another stated population.
- **Commercial Performance** adds budget, potential, variance, attainment, opportunity, and driver interpretation where governed commercial data is present. Missing commercial reference data is not zero.
- **Data Quality** identifies whether a result has identity, mapping, completeness, duplicate, or canonical-enrichment limitations.

## Persistence, refresh, and replacement safety

Master datasets are browser-local. Closing and reopening the same browser profile should retain active governed master data; browser storage clearing, a different browser profile, or organisational device policy can remove it. Refresh is appropriate after a normal completed import. Do not refresh or close the page while a file is still being read or an activation result is pending.

Before replacing a master, retain the approved source CSV and verify the preview. Replacing Geography, Branch, Employee, hierarchy, assignment/deployment, or commercial references can change governed interpretation for later analysis. The system protects the active dataset from an invalid replacement; that does not remove the need for a steward review of a valid but materially different replacement.

## Common warnings and safe responses

| Warning or condition | Safe response |
| --- | --- |
| State or branch is unmapped | Check the durable IDs and activate the required master before interpreting the affected slice. |
| Date mismatch or unresolved canonical date | Verify `POLICY ISSUED DATE` and source date conventions; do not assume a source Month is authoritative in every enrichment context. |
| Employee identity unmapped | Check `Ba Code`/source RM identity against Employee Master; do not use BA NAME as a substitute. |
| Unattributed business | Treat it as explicit coverage information, not as zero business or an instruction to use deployment ownership. |
| Incomplete hierarchy | Read direct employee business separately; roll-up context may be partial. |
| Missing budget or potential | Treat commercial attainment/opportunity as unavailable or partial, not as zero. |

## Daily/period operating routine

1. Confirm active masters and reporting period.
2. Upload the PR file and resolve material Data Quality issues.
3. Review Performance MIS and Contribution.
4. Review activation breadth and productivity denominators.
5. Review Commercial Performance only where its branch/period reference coverage is adequate.
6. Use management cues to select investigations; retain source evidence for decisions.
7. Escalate unresolved identity, hierarchy, or reference-data issues to the data steward rather than editing production data ad hoc.

## Intentional v8.3 limits

v8.3 does not provide a dedicated workforce analytics page, a user-facing employee ownership editor, automatic attribution from designation, automatic attribution from deployment, a general team-total summation control, workforce planning/attrition user interface, or a cloud deployment workflow. Direct reporting gives analytical roll-up context; it does not duplicate business as direct manager ownership.

## In-environment validation

Use a controlled browser profile and approved company datasets for local acceptance. Validate imports, master activation, PR canonical readiness, and the visible pages applicable to the company’s approved scope. v8.3 has passed automated, browser-based, and deterministic synthetic production-scale validation. Validation against actual company production data remains an in-environment activity subject to company data-governance policy.
