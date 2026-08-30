# BancaTracker Enterprise v8.2.0

## Management Focus & Data Trust

Status: **v8.2.0 release identity established; browser acceptance is tracked separately.**

BancaTracker is a fully client-side Bancassurance management application built with HTML, CSS, and vanilla JavaScript. It accepts PR-data CSV files and provides Performance MIS, Activation Intelligence, Management Scorecard and drill-down, Target & Growth, Productivity & Opportunity, and Data Quality views. It has no backend, database, framework, CDN, telemetry, or external library.

v8.2.0 adds a governed persistent master-data foundation, canonical policy-date authority, governed geography, durable branch identity, assigned RM and organisation hierarchy authorities, governed branch universe, branch Budget & Potential, commercial performance and roll-ups, month comparison, daily premium movement, execution pacing/attention/prioritisation, structural management drill-down, independent LOB/Product driver analysis, and canonical/master Data Quality integration.

## Upgrading from v8.1.x to v8.2.0

The browser database upgrades to schema version 2 additively; existing stores are not intentionally cleared and active-dataset metadata persists. Upload and activate the new governed masters where required. Readiness may remain partial until required masters exist. Legacy analytics remain available, and branch Budget/Potential remains separate from legacy `target.js` session targets. No migration behavior beyond these implemented guarantees is promised.

## Architecture

- `js/config.js` — fiscal months, aliases, branch universes, thresholds, schemas, and rendering limits.
- `js/csvProcessor.js` / `js/csvWorker.js` — shared CSV parsing, validation, normalization, and off-main-thread import.
- `js/core.js` — authoritative fact state, Month/Bank filters, central time scopes, derived refresh, and active-page rendering.
- `js/analytics.js` — current-period totals, canonical branches, activation bands, and deterministic hierarchy representation.
- `js/dataQuality.js` — cached full-upload diagnostics; findings never change imported rows.
- `js/productivity.js` — current-period RM, IMD, branch, opportunity, concentration, and reusable bank indexes.
- `js/performance.js`, `js/activation.js`, `js/scorecard.js`, `js/target.js` — business calculation adapters and renderers.
- `js/utilities.js` — shared formatting, bank/branch identity, month ordering, and HTML escaping.
- `app.js` — lightweight tab navigation and active-page selection.

The normalized fact table is retained once. A refresh performs one organisational-scope pass, reuses month buckets for CURRENT PERIOD and YTD, rebuilds shared current-period analytics/productivity, and renders only the active page. Data Quality is recalculated only after a successful import.

## CSV schema

Mandatory headers: `USGI NET PREMIUM`, `Month`, `INTERMEDIARY`, `BA NAME`, `Ba Code`, `LINE OF BUSINESS`, and `BRANCH NAME`.

Optional headers: `Zone`, `STATE`, `SUM IMD CODE`, `Business Type`, `PRODUCT NAME`, `PRODUCT CODE`, and `Day`.

Invalid premium, missing Month/Bank/Branch, and structurally unusable rows are rejected. Missing RM, BA Code, or LOB is accepted with a warning. Negative numeric premium is preserved and reported. Canonical branch identity is currently `Bank + Branch Name`.

## KPI and time-scope contract

- **CURRENT PERIOD:** the selected Month. With Month `ALL`, the latest available **configured** fiscal month within the selected Bank scope.
- **YTD:** configured fiscal months from April through the selected/latest configured progression month.
- **FULL UPLOAD:** all accepted rows within the organisational Bank scope. Data Quality deliberately audits the complete accepted import across banks.
- A specifically selected **unconfigured month** can act as CURRENT PERIOD, but it is excluded from fiscal YTD, elapsed months, and target progression.
- Performance YTD Premium uses YTD. Rankings, activation, productivity, Scorecard, and opportunity metrics use CURRENT PERIOD.
- Active Branch means current-period premium ≥ ₹25,000. Near Active means ≥ ₹15,000 and < ₹25,000.
- Bank Activation % uses configured branch universe. Zone/State Activation % uses observed current-period branches.
- `config.TOTAL_BRANCHES` is the legacy externally maintained activation-universe population. It remains authoritative when the Branch Master universe is absent, `INCOMPLETE`, or `NOT_READY`.
- Branch Master `active` means operationally available for master-data resolution; it does not mean activation-universe eligibility.
- Branch Master `ACTIVATION ELIGIBLE` normalizes separately to `activationEligible: true | false | null`. Missing eligibility keeps an older Branch Master usable for resolution but makes its governed-universe contract incomplete.
- A `READY` Branch Master makes the governed denominator authoritative, counting distinct `branchId` values where `active === true` and `activationEligible === true`. Eligible branches remain in the denominator even with no transactions. Authority is all-or-nothing; governed-versus-legacy differences are reported, not silently reconciled.
- Unknown transaction banks remain visible in premium, contribution, and Data Quality, but receive no fabricated activation denominator.
- Branch Budget means expected or committed premium assigned to a durable branch for an explicit monthly `periodKey` (`YYYY-MM`). Branch Potential means estimated addressable premium opportunity for that branch and period; it is distinct from Budget, actual premium, forecast, and achievement.
- Branch Budget & Potential is governed reference data keyed by `branchId + periodKey`, not a transaction measure. Future aggregation must sum distinct commercial master rows and must never multiply a value by transaction-row count. Blank means `null`, not zero; explicit zero is valid, while negative or invalid numeric values are rejected.
- Commercial Performance first sums signed transaction Actual Premium by `branchId + monthKey`, independently reads Budget/Potential by `branchId + periodKey`, and joins the union of those keys only after both sides share the same grain. Achievement % = Actual Premium ÷ Budget × 100; Budget Gap = Actual Premium − Budget; Budget Remaining = Budget − Actual Premium; Potential Penetration % = Actual Premium ÷ Potential × 100; Potential Gap = Potential − Actual Premium. Group ratios use aggregated raw measures, never averages of branch percentages. Legacy annual Target planning remains separate.
- Commercial period scope is governed by the unioned branch-period performance rows, so reference-only future months remain selectable. `latestAvailablePeriod` is the latest governed commercial period, `latestActualPeriod` is the latest period with transactions, and the default is latest available—not the wall-clock month. MONTH is exact, YTD runs from April through the selected month, and FY runs April through March without fabricating missing months.
- Commercial roll-ups support Overall, Bank, Branch, State, Zone, Bank Region, Bank Zone, FGM Office, Assigned RM, CSM, ASM, ZSM, and National Head. Durable IDs are grouping keys where available; missing geography/organisation metadata remains visible in explicit unmapped/unassigned buckets. Budget and period-scoped Potential sum once per branch-period, and all percentages are recomputed from aggregate raw measures.
- Commercial-only branches recover descriptive dimensions from already-cached branch, geography, assignment, employee, and hierarchy authority. These hierarchy and assignment roll-ups reflect the current active master snapshot; historical effective-dated attribution is not yet available. `activationEligible` does not control commercial inclusion, and no IndexedDB reads occur during roll-up.
- The additive Commercial Performance page consumes the governed Step 4G/H/I authorities and owns formatting only—not formulas. It defaults to MONTH, `latestAvailablePeriod`, and BANK; future Budget-only periods, actual-only rows, zero-activity rows, and explicit unmapped/unassigned buckets remain visible.
- Commercial month comparison is an on-demand analytical authority over two exact Step 4I MONTH roll-ups. It joins the union of durable dimension keys, defines every movement as comparison minus base, calculates Actual growth only for a positive base, and compares Achievement/Penetration in percentage points. An absent side normalizes Actual to zero for movement mathematics while retaining presence flags; missing Budget/Potential remain `null`. Defaults prefer the latest actual month and its previous available period. Organisational comparisons retain the current active assignment/hierarchy snapshot limitation.
- Day-wise commercial comparison directly aggregates signed canonical fact Actual by `monthKey + governed dimension key + day`, then completes every available calendar day and builds cumulative Actual. An available day without activity is zero; a nonexistent calendar day is `null` and not comparable. Full calendar months are represented without an as-of-today cutoff. Commercial-only monthly entities can supply zero-Actual daily series, but Budget/Potential are never allocated daily and no pacing, run-rate, or forecast is inferred. Organisation dimensions use the current active assignment/hierarchy snapshot.
- The Commercial Performance page includes a separate on-demand comparison section. Step 4K supplies OVERALL cards and durable-key dimension rows; Step 4L supplies DAILY/CUMULATIVE calendar tables. Defaults use the latest actual month and previous available period, while reverse and same-month selections remain valid. Presence states, unmapped/unassigned entities, unavailable days, signed values, and null growth are rendered without UI formulas or repository reads.
- Commercial execution pacing is a separate on-demand MONTH authority with an explicit or observation-derived `asOfDay`; it never changes Step 4L’s full-calendar semantics. It uses Step 4I monthly Budget, canonical signed Actual through the common cutoff, and calendar days to derive linear expected Budget pace, average/day, required remaining-day run-rate, and a transparent observed-average month-end projection. Explicit cutoffs support backtesting; no wall clock, working-day calendar, stored daily Budget, alerts, RAG classification, or advanced forecast is used. Organisation results retain the current active hierarchy snapshot limitation.
- The Commercial Execution UI is a third additive Commercial Performance section. It defaults to the latest actual governed month (or latest available), resolves its As-of Day through Step 4N, and supports explicit Day 0–month-end backtesting plus an independent governed dimension. OVERALL cards and entity rows render authority results directly, including null/zero/negative values, commercial-only and actual-only rows, coverage, and observation context; no execution formulas, storage reads, RAG status, or working-day interpretation live in the UI.
- Commercial execution status is a pure, on-demand interpretation authority over supplied Step 4N results. It does not recalculate pacing formulas or read storage. Independent facets describe observation presence, missing/zero/positive/invalid Budget reference, Budget position, linear pace, and the simple Step 4N projection; projected shortfall therefore expresses only that supplied linear projection. Execution attention requires observations plus a positive, unachieved Budget and an exact behind-pace or projected-shortfall state, while reference attention is reserved for missing/invalid Budget. Day 0 is planning rather than execution failure, zero Budget differs from missing Budget, and no arbitrary thresholds, RAG/severity, recommendations, alerts, or UI treatment are introduced. Organisation dimensions inherit Step 4N's current active hierarchy snapshot limitation.
- The Commercial Execution UI presents Step 4P facets, reasons, and supplied summary counts alongside the unchanged Step 4O raw measures. Execution attention and Budget-reference attention remain distinct, and the All/Execution attention/Reference attention/No attention filter only filters cached classified rows without rebuilding Step 4N. Step 4P owns classification and Step 4N owns calendar-day mathematics and its simple linear projection; Day 0 is not execution failure, missing Budget produces reference attention, and zero Budget remains a separate informational state. The UI adds no urgency ranking, RAG/severity, recommendations, alerts, or forecasting changes, and retains the current-hierarchy snapshot limitation.
- Commercial execution prioritisation is a pure, on-demand authority over compatible supplied Step 4N and Step 4P Month snapshots. It validates exact period/as-of/dimension compatibility and durable unique keys, then independently ranks Step 4P execution-attention and reference-attention rows. Execution rank is a contiguous ordinal ordered by measurable projected Budget-shortfall amount, projection availability, behind-pace evidence/magnitude, monthly Budget, and stable key; reference rank uses canonical reference reason and stable key only. OVERALL has no comparative rank. The authority exposes basis fields, source statuses, summaries, and deterministic diagnostics without recalculating execution/attention, reading storage, using percentage achievement/run-rate/Potential/contribution/maturity, or adding scores, bands, thresholds, Top-N truncation, RAG/severity, recommendations, alerts, forecast confidence, or UI integration. Organisation dimensions retain the current active hierarchy snapshot limitation.
- The Commercial Execution priority UI presents cached Step 4S results only. Its default None view can switch independently between the complete governed execution-priority and reference-priority lists without rebuilding Step 4N/4P/4S or changing the Step 4Q Attention Filter. Supplied `priorityRank` and authority order are rendered unchanged; the UI neither ranks, sorts, renumbers, scores, bands, nor truncates the lists. Execution priority is explicitly an enterprise Budget-impact review order under Step 4N's simple linear projection, reference priority remains separate, and OVERALL is not rankable. No RAG/severity, recommendations, alerts, percentage/Potential ranking, or forecast-confidence semantics are added; organisation dimensions retain the current hierarchy snapshot limitation.
- Commercial execution drill-down is a pure parent-scoped orchestration authority over the existing Step 4N, Step 4P, and Step 4S chain. It selects parents and children only by durable dimension keys, constrains governed fact and commercial-reference rows before child aggregation, preserves the parent's exact period and As-of Day, and exposes child-local attention and priority without inheriting parent rank or attention. Approved organisational, geographic, bank-organisation, and operational paths are explicit; invalid paths are rejected, Branch is terminal, and `OVERALL` drills only to Bank. Signed Actual reconciles for one child dimension at a time, while Budget reconciles only with complete reference coverage; missing Budget remains null and ratios, attention flags, and ranks are not summed. The authority reads no storage, adds no formulas or UI, and organisational paths retain the current active hierarchy snapshot limitation.
- The Commercial execution drill-down UI presents supplied Step 4V context only within the existing execution section. A parent is selected by its current dimension and durable key; child options come directly from Step 4V, while parent scoping, child Step 4N execution, Step 4P attention, Step 4S priority, and reconciliation remain authority-owned. Snapshot changes clear or safely rebuild the selection, stale parents are reported factually, missing Budget renders as N/A, and unmapped/unassigned children remain visible. Branch is terminal; Product, LOB, daily movement, and month comparison remain outside the structural drill-down. Organisation paths retain the current active hierarchy snapshot limitation.
- Commercial driver analysis is a pure, parent-scoped authority for independent LOB or Product decomposition; neither is a structural drill-down child. It scopes governed facts before aggregation, preserves signed premium and unmapped driver values, and uses transaction-derived identities until a future Product/LOB Master exists. Execution Snapshot uses an exact period and As-of Day, while Month Comparison uses complete explicit months; both reconcile their driver Actuals to the supplied governed parent. Driver-level Budget, Potential, Achievement, pacing, attention, and priority are intentionally absent. Organisation parent scoping retains the current active hierarchy snapshot limitation.
- The Driver Analysis UI presents Step 4Y only as a separate context below governed structural drill-down. It reuses the selected durable execution parent and preserves independent LOB/Product analysis; execution supplies the compatible Step 4N parent authority and comparison supplies the compatible Step 4K parent authority, without UI-derived parent totals. Unmapped drivers remain visible, while Budget, Potential, Achievement, pacing, attention, and priority remain absent. Driver identities remain transaction-derived until future masters, and organisational parent scope retains the current hierarchy snapshot limitation.
- Conflicting current-period Zone/State mappings are represented as `Multiple mappings`, never by first-row selection.

## Data Quality diagnostics

The cached full-upload audit reports hierarchy and identity conflicts, month/bank coverage, premium signs, optional-field completeness, exact duplicate signals, and branch-universe sanity. Diagnostics are signals only: rows are not corrected, removed, or deduplicated.

Hierarchy and identity tables show at most 100 rows, duplicate samples at most 50 groups, and high-cardinality coverage lists at most 100 values. Every truncated view shows `Showing X of Y`; summary counts retain complete diagnostic totals. Duplicate fingerprints remain heuristic without a transaction/policy identifier.

## Productivity, opportunity, and management drill-down

RM productivity uses `Bank + BA Code`; IMD productivity uses `Bank + IMD Code`. Mapping conflicts remain visible. Aggregate Activation Gap is the sum of `₹25,000 − branch premium` for CURRENT PERIOD Near Active branches.

The Scorecard supports `Partner Bank → RM/IMD → Branch Opportunity` using reusable derived indexes. Unknown uploaded banks appear in `ALL` mode with premium and contribution, `Branch Universe: Not configured`, `Activation %: N/A`, and `UNCONFIGURED` priority unless a material Data Quality ERROR applies. No activation denominator is fabricated.

Configured-bank priorities are deterministic: NO DATA; CRITICAL for bank Data Quality ERROR or activation <10% with Near Active; HIGH below 20% with Near Active; MEDIUM below 40% or with Near Active; LOW at 40%+ with no Near Active. Management cues are rules, not predictions.

## Targets

Overall and bank-specific targets are retained in browser session storage. Monthly phasing is equal 1/12. For partial-year uploads, YTD Target and RRR use only configured elapsed months. `FY Complete` applies only at March. Drill-down displays bank target context when a bank target exists.

## Performance and privacy

- CSV parsing and normalization use a native Web Worker when available; restrictive `file://` environments use the synchronous fallback.
- Only the active page renders after imports or filter changes; switching tabs renders the latest shared state.
- Main analytical tables and diagnostic displays are bounded; full calculations remain in memory.
- Uploaded values are escaped before dynamic HTML rendering.
- No uploaded data or targets are transmitted over a network.
- Synthetic Node benchmarks cover CSV/shared analytics through 500K rows but are not browser certification.

Known v8.2.0 limitations: organisation attribution uses the current hierarchy snapshot rather than historical effective dating; Product/LOB identities remain transaction-derived; Product/LOB Budget/Potential is not allocated; execution projection is simple linear pacing, not a forecast model; legacy targets remain session-based and separate; browser-local storage/capacity constraints apply; negative premium is preserved factually without additional business-policy classification; and 1M-row browser support is not claimed.

## Running tests

```text
node tests/run-all.js
node --max-old-space-size=4096 tests/benchmark.js
```

The master runner excludes benchmarks and runs 38 regression groups covering the v8.1 compatibility baseline and v8.2 authorities/UI. Real-browser production acceptance is completed separately in R2B/R3.
