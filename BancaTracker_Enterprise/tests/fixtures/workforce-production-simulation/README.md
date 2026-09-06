# Workforce Production Simulation Fixtures

`generate-fixtures.js` creates fully fictional, deterministic, in-memory fixture data using seed `8305`. It intentionally generates 500 employees, 3 banks, 10 zones, 24 states, 900 branches, 12 reporting months, and 25,000 PR-like canonical transactions. No company or production data is used or inferred.

The lower requested transaction bound keeps the full local regression suite practical while preserving attribution, temporal, hierarchy, deployment, reconciliation, slice, corruption, determinism, and immutability coverage.
