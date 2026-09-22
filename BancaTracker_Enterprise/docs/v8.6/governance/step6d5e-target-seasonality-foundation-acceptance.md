# Step 6D.5E — Target Seasonality Foundation Acceptance

## Closure scope

Steps 6D.2 through 6D.5E deliver the Target Seasonality foundation. It provides a governed Target Seasonality contract, a pure seasonality resolver, the canonical `TARGET_SEASONALITY` dataset, and a persistent IndexedDB master lifecycle. Imports govern one FY at a time; a valid submitted FY replaces that FY completely, preserves other FYs through successor-snapshot construction, and activates atomically.

The foundation also provides Master Data Administration discovery and operational help, a synchronous live runtime cache, post-activation cache refresh, reload hydration, provenance and status lifecycle, and permanent regression coverage.

## Governed grain and inheritance

The governed curve grain is:

- `FY + OVERALL`
- `FY + canonicalBank`

For a Bank request, the resolver applies Bank curve → Overall curve → equal-month fallback. For an Overall request, it applies Overall curve → equal-month fallback. An explicit applicable curve that is invalid fails closed; it does not silently fall through to inheritance or fallback.

## Weight governance

Weights are decimal fractions. Every explicitly submitted curve has exactly 12 unique canonical fiscal-year months. Weights must be finite and within `[0, 1]`; zero is valid. Each curve must total `1` within `1e-9`, without material silent normalization.

`EQUAL_MONTH_FALLBACK` is a runtime resolver outcome only. It is never persisted as Target Seasonality data.

## Persistence semantics

The canonical dataset type is `TARGET_SEASONALITY`, with one active pointer: `activeDataset:TARGET_SEASONALITY`.

Each import contains one FY. A same-FY import is a complete replacement, not a patch: omitted curves for that FY are intentionally removed. Curves belonging to other FYs are retained in the successor snapshot. Invalid imports do not replace the previous active snapshot.

## Runtime lifecycle

The live Target Seasonality cache has these states:

```text
NOT_LOADED | ABSENT | READY | LOAD_FAILED
```

After hydration it exposes persisted records and active-dataset provenance synchronously. It distinguishes a successfully checked absence from a load failure, refreshes after successful Master Data Administration activation, and rehydrates from the active persistent dataset after reload. The cache is a persistence/runtime bridge only: it does not resolve weights or calculate Target values.

## Admin and browser integration

Target Seasonality is a normal Master Data Administration master, with the CSV schema:

```text
FISCAL YEAR, SCOPE, BANK, MONTH, WEIGHT
```

The Admin UI supplies governed operational help for curve completeness, decimal weights, reconciliation, and FY replacement semantics. Browser dependencies load in safe order: pure resolver, persistent master preparer, live cache, then Master Data Administration. No CDN, server, or build dependency was introduced.

## Authority and firewall map

| Authority | Ownership |
| --- | --- |
| `js/targetSeasonality.js` | Curve selection, inheritance, invalid-curve handling, and equal-month fallback semantics. |
| Persistent master/import | Normalized persistence and FY successor-snapshot replacement semantics. |
| Live cache | Synchronous runtime persistence bridge and provenance only. |
| Master Data Administration | Upload, status, help, and activation lifecycle UI only. |

None of these authorities owns Target monetary calculations.

## Explicitly unchanged behavior

As of Step 6D.5E:

- `js/target.js` retains legacy equal `/12` allocation.
- Annual Overall and Bank Target amounts remain session/in-memory state.
- `bancaTrackerV8Targets` remains unchanged.
- RRR and Scorecard Target semantics remain unchanged.
- Signed Actual semantics, Core period authority, Activation, and Productivity remain unchanged.
- Commercial Budget/Potential remains unchanged.
- PR facts and Bank identity semantics remain unchanged.

## Historical reproducibility limitation

The governed seasonality curve is persistent, but annual Overall and Bank Target amounts remain mutable session state. Therefore, persistent seasonality alone does not provide fully reproducible historical monetary Target values.

## Regression evidence

The following contracts are permanently registered:

- Step 6D.3 pure resolver contract.
- Step 6D.5 persistence/import contract.
- Step 6D.5D.2 Admin/live-cache contract.

At closure, the master regression suite passes **81/81 groups**. Relevant Target Seasonality production and contract JavaScript syntax checks pass.

## Closure verdict

**STEP 6D.5 — TARGET SEASONALITY FOUNDATION: CLOSED**

**READY FOR STEP 6D.6 — TARGET CALCULATION INTEGRATION**

This readiness establishes the foundation only; it does not alter Target monetary behavior.
