# BancaTracker Enterprise v8 MVP

Status: **Functionally complete offline MVP (Phase 6 — Scale & Hardening).**

BancaTracker is a fully client-side Bancassurance management application. It runs from local HTML/CSS/JavaScript, accepts a PR-data CSV, and provides Performance MIS, Activation Cockpit, Management Scorecard, and Target & Growth views. It has no backend, database, framework, CDN, or external library.

## Architecture

- `js/config.js` — fiscal months, bank aliases, branch universes, thresholds, and CSV schema.
- `js/csvProcessor.js` — shared CSV parsing, normalization, validation, and import summaries.
- `js/csvWorker.js` — native Web Worker entry point for off-main-thread imports.
- `js/core.js` — fact data, central Month/Bank filters, worker fallback, atomic imports, and refresh orchestration.
- `js/analytics.js` — one reusable derived-metrics build per refresh cycle.
- `js/utilities.js` — formatting, escaping, canonical bank/branch, and general helpers.
- `js/performance.js`, `js/activation.js`, `js/scorecard.js`, `js/target.js` — business renderers consuming core context and shared metrics.
- `app.js` — page navigation only.

The normalized fact table is retained once. The current filtered view contains references to those same row objects. Derived aggregates are rebuilt on every filter refresh, avoiding stale caches and repeated module-level scans.

### Performance hotspots addressed

Before Phase 6, each renderer independently scanned the current rows, Performance and Scorecard rebuilt branches separately, Activation made several additional branch scans, Target rescanned the full bank scope for monthly actuals, and high-cardinality tables could create unbounded DOM. CSV parsing and normalization also ran synchronously on the UI thread. Phase 6 consolidates those calculations into the shared refresh object, derives YTD/MTD and bank-month totals during core filtering, moves import work to a worker when available, and limits only the rendered subsets.

## Supported CSV schema

Mandatory headers:

- `USGI NET PREMIUM`
- `Month`
- `INTERMEDIARY`
- `BA NAME`
- `Ba Code`
- `LINE OF BUSINESS`
- `BRANCH NAME`

Optional headers: `Zone`, `STATE`, `SUM IMD CODE`, `Business Type`, `PRODUCT NAME`, `PRODUCT CODE`, and `Day`.

Premium must be numeric. Rows missing Month, Bank, or Branch, rows with invalid premium, and structurally unusable rows are rejected and counted. Missing RM, BA Code, or LOB values are accepted with warnings. Branch identity is canonical `Bank + Branch Name`, so identical branch names at different banks remain distinct.

## Operating instructions

1. Serve or open `index.html` in a modern browser. Serving from a small local static server is recommended because some browsers restrict workers on `file://` pages; the synchronous fallback remains available.
2. Select a `.csv` file from the upload control.
3. Review progress and the import summary before using Month and Bank filters.
4. Configure overall and optional bank targets on Target & Growth. Targets last for the current browser session.

All processing stays within the browser. A failed import does not replace the previous valid dataset.

## Performance and safety notes

- Large CSV parsing and normalization use a native Web Worker when available.
- Progress reports reading, parsing, row processing, analytics building, and completion.
- A single derived layer calculates shared totals, dimension aggregates, canonical branches, activation thresholds, locations, and counts.
- RM, opportunity, zone, state, bank, and LOB displays are capped at 50 or 100 rendered rows with truncation notices; full analytics remain in memory.
- Every CSV-derived string inserted into dynamic HTML is escaped with the shared sanitizer.
- Local synthetic tests cover approximately 10K, 100K, and 500K rows. Actual results depend on browser, hardware, CSV width, and distinct branch cardinality.

## Known limitations

- CSV data and calculated analytics remain memory-resident; very large or unusually wide files require sufficient browser memory.
- Worker startup may be blocked when opening directly with restrictive `file://` browser policies; processing then falls back to the main thread.
- The parser supports quoted commas, escaped quotes, CRLF/LF, and UTF-8 BOM, but is intentionally not a repair tool for severely corrupted CSV files.
- Tables intentionally show only the highest-ranked subset for responsiveness.

## Local tests

Run with an installed Node runtime; Node is used only as a dependency-free test runner and is not required by the application:

```text
node tests/phase5.test.js
node tests/phase6.test.js
node --max-old-space-size=4096 tests/benchmark.js
```
