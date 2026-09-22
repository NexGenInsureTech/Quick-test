# Step 6E.4 — CSV Formula-Prefix Hardening Acceptance

## Purpose and baseline

Step 6E closes browser-local CSV formula-prefix hardening on `feature/v8.6-governance-foundation`. The approved production implementation is `js/export/csvExport.js`; the governed executable contract is permanently registered in the master regression suite.

## Risk addressed and architecture

Every current CSV download passes through the centralized `BancaTrackerCsvExport.serializeCsv()` authority. The path is:

```text
source export value → type-aware cell representation → formula-prefix hardening → CSV structural escaping → row framing → browser Blob download
```

This addresses text that spreadsheet software could interpret as a formula when its first meaningful character is `=`, `+`, `-`, or `@`.

## Governed hardening rule

For a formula-risk string, the serializer prepends exactly one apostrophe to the original text. Detection may skip leading whitespace, but the exported source text is never trimmed: `"  =1+1"` becomes `"'  =1+1"`. Existing apostrophe-prefixed text remains stable. The representation change is export-only and does not write to source rows, canonical facts, masters, or persistence.

## Numeric and CSV preservation

JavaScript numeric primitives retain existing raw serialization, including signed, zero, fractional, and scientific values. Numeric-looking strings remain unchanged only when they exactly match:

```regex
^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$
```

Ambiguous signed text remains protected. Existing CSV behavior is preserved after hardening: comma quoting, quote doubling, CR/LF quoting, UTF-8 BOM, CRLF rows, deterministic column order, null/undefined empty cells, booleans, and ISO Dates.

## Export coverage and firewalls

The centralized boundary covers Opportunity Ownership, Equivalent Elapsed-Day Comparison, Branch Maturity Distribution, and Branch Movement. Opportunity full-result rows and raw premium/gap precision remain intact; Branch Movement retains negative, fractional, zero, and null premiums.

No CSV ingestion, analytical authority, Target, Target Seasonality, Activation, Productivity calculation, Scorecard, Commercial/Maturity/Movement calculation, Data Quality, master, enrichment, repository, or persistence behavior changed. No external package, CDN, server, or build dependency was introduced.

## Regression evidence

The registered Step 6E.2 contract verifies formula prefixes, whitespace, numeric primitives, numeric-looking strings, ambiguous strings, headers, structural escaping, integration paths, and non-mutation. Existing CSV utility, Opportunity Ownership, Branch Movement, and v8.4 export UI regressions remain green. The full master suite passes 84 groups, and all tracked JavaScript syntax checks pass.

## Acceptance matrix

| Area | Result |
| --- | --- |
| Central serializer authority | PASS |
| Formula-risk text and headers | PASS |
| Whitespace and apostrophe stability | PASS |
| Numeric precision and signed values | PASS |
| CSV structural escaping and framing | PASS |
| Operational export integration | PASS |
| Non-mutation and authority firewalls | PASS |
| Dependency firewall | PASS |

## Closure verdict

**STEP 6E — CSV FORMULA-PREFIX HARDENING: CLOSED**

**READY FOR NEXT v8.6 BACKLOG ITEM**
