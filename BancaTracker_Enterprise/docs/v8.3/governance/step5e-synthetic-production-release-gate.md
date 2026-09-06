# Sprint 5 Step 5E — Synthetic Production Simulation & Release Gate

**Status:** deterministic synthetic simulation automated acceptance complete; actual-company-data validation pending approved in-environment execution.

## Purpose

This gate validates software correctness at realistic fictional scale without using, accessing, or inferring company data. The seeded generator creates 25,000 canonical PR-like transactions—the lower requested bound—to keep the full local regression suite practical while retaining all authority paths and edge cases.

> Validation against actual company production data was not performed because company policy prevents production data from being accessed outside the approved company environment. This release gate therefore validates software correctness using deterministic synthetic production-scale data. Actual production-data compatibility must be validated in-environment after deployment.

## Deterministic fixture model

Source: `tests/fixtures/workforce-production-simulation/generate-fixtures.js` using seed `8305`.

| Component | Fictional scale / characteristics |
| --- | --- |
| Employees | 500; controlled employment states, joining and exit dates, free-form designations, and designation changes. |
| Organisation | 3 roots, ordinary and skip-level reporting, historical manager change, and deliberate partial/disconnected employee coverage. |
| Geography/network | 3 fictional banks, 10 zones, 24 states, 900 branches. |
| Deployment | Effective-dated PRIMARY/SUPPORT records, multi-branch support, gaps, no-business deployments, and business-without-deployment. |
| Transactions | 25,000 records over 12 months/FY, three LOBs, 12 products, positive/zero/negative Actual. |
| Attribution cases | Exact source IDs, missing IDs, unmapped IDs, before-join, after-exit, unverified dates, and no-hierarchy employees. |

The generator contains no company labels, names, customer information, or production facts.

## Automated correctness criteria

The Step 5E test constructs contexts and results only through existing Employee Master, Direct Reporting Hierarchy, Workforce Deployment resolver, Business Attribution, temporal resolver, reconciliation, hierarchy roll-up, Workforce Performance, and slice authorities.

It requires:

- attributed plus unattributed record counts and signed Actual to reconcile to accepted synthetic Actual;
- unmapped source IDs to remain unattributed despite deployment context;
- positive, zero, and negative values to be retained;
- `EFFECTIVE`, `NOT_EFFECTIVE`, and `UNVERIFIED` temporal outcomes;
- historical manager change, multiple roots, partial hierarchy, unique roll-up nodes, and unchanged direct ownership;
- all four deployment alignment classifications, with no deployment-based ownership;
- governed Bank, Branch, Zone, State, Month, FY, LOB, Product, Employee, and Manager/team coverage;
- parent-first slicing, `__UNMAPPED__` retention, non-additive team output, and scoped reconciliation;
- deliberate signed-Actual corruption to return `UNRECONCILED` with diagnostics;
- deterministic repeated generation and unchanged input arrays; and
- IndexedDB schema version `2` with no Workforce Performance persistent dataset/store.

Runtime measurements are diagnostics only, not pass/fail limits. The baseline test captures generation, master preparation, attribution, reconciliation, hierarchy roll-up, workforce composition, slicing/diagnostics, and total elapsed time.

## Release disposition

| Disposition | Criteria |
| --- | --- |
| `PASS` | All correctness/reconciliation checks pass; no unsupported/corrupt authority, ownership leakage, hierarchy duplication, or persistence/schema regression. |
| `PASS_WITH_DIAGNOSTICS` | Correctness and reconciliation pass while expected partial, unmapped, unattributed, or deployment-gap diagnostics remain explicit. |
| `BLOCKED` | Any unreconciled total, unsupported authority, corrupt input, deployment ownership leakage, hierarchy duplication, or persistence/schema regression. |

Attribution coverage, hierarchy coverage, and deployment alignment are diagnostics. They are never release thresholds or subjective productivity judgments.

## In-environment follow-up gate

After deployment in the approved company environment, record the same correctness—not commercial-performance—checks against an approved dataset:

1. Master imports and active-context reconstruction.
2. Exact Employee ID/source-RM attribution coverage and visible unattributed population.
3. Employee date, hierarchy root/partial/disconnected, and deployment context diagnostics.
4. Signed Actual reconciliation at overall and Bank/Branch/Month parent scopes.
5. Deployment/business alignment without ownership projection.
6. Refresh/reopen reconstruction with no persisted Workforce Performance authority.
7. Full regression result.

Any unsupported/corrupt state or unreconciled total is `BLOCKED`; expected data-quality gaps may be `PASS_WITH_DIAGNOSTICS` when fully visible and reconciled.
