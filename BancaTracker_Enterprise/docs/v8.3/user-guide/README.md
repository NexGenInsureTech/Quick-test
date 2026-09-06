# BancaTracker Enterprise v8.3 user documentation

This set of guides describes the v8.3 application build as it exists in the browser. It is intended for business users, data stewards, and managers preparing governed reference data and interpreting results.

Start here:

1. Read [the user guide](banca-tracker-v8.3-user-guide.md) for the operating sequence and currently visible application pages.
2. Use [the data-preparation guide](data-preparation-guide.md) before creating or replacing a master or PR CSV.
3. Use [the KPI and analytics glossary](kpi-analytics-glossary.md) when reading a metric, diagnostic, or governance status.
4. Use [the management interpretation guide](management-interpretation-guide.md) to turn a result into an investigation, not an automatic decision.

## Availability legend

| Status | Meaning |
| --- | --- |
| **Available current UI** | A page or workflow that a user can operate in the current browser application. |
| **Implemented foundation, no dedicated UI** | Governed import, resolution, attribution, temporal, reconciliation, or workforce capability that is implemented for controlled use and downstream analytics but does not have its own management page. |
| **Future / not implemented** | A capability deliberately not claimed by v8.3. |

The v8.3 workforce, direct-reporting, deployment, attribution, hierarchy-roll-up, and workforce-performance foundations must not be mistaken for dedicated workforce management screens. Master Data import and readiness information are user-visible; several analytical foundation outputs are not independently presented as a page.

## Validation statement

v8.3 has passed automated, browser-based, and deterministic synthetic production-scale validation. Validation against actual company production data remains an in-environment activity subject to company data-governance policy.

This documentation does not claim that a production deployment, company-data certification, or a release promotion has occurred.
