# BancaTracker Enterprise v8.6

## Step 6C.2 — Bank Identity & Budget Ownership Governance Contract

**Status:** Design contract. No runtime, schema, persistence, test, UI, export, alias, or planning-authority change is introduced by this document.

## 1. Objective and current authority

This contract defines the future identity and ownership rules required before management Bank/sub-channel reporting is implemented. It preserves the present flat Bank model:

```text
PR INTERMEDIARY → BANK_ALIASES → fact.bank
BRANCH MASTER BANK ID → BANK_ID_ALIASES / canonicalBankIdentity → canonicalBank
```

The raw PR intermediary is not separately retained today. `canonicalBank` is one flat analytical dimension, not a hierarchy. `BANK_ALIASES` and `BANK_ID_ALIASES` are normalization mechanisms only.

## 2. Distinct governed concepts

### Source identity

The chosen term is **`sourceBankIdentity`**: the durable atomic business identity supplied by a transaction or governed reference source. It includes a stable identifier and display name. Normalization may standardize representations of the same source identity, but must preserve its auditability.

### Management Bank

**`managementBankId`** is a durable governed identity for the banking relationship used for management consolidation. It is not a display string, alias target, or automatically inferred value.

### Sub-channel

**`subChannelId`** is an optional governed classification under a Management Bank. It may describe regular/core, a scheme, or another approved business channel. It must be explicitly supplied or governed; it must never be inferred from arbitrary source-name text.

### Budget owner

**`budgetOwnerId`** identifies the one durable identity and grain at which a planning value is authoritative. It is independent of display hierarchy and must state whether a value is atomic, an allocation, or a derived roll-up.

## 3. Normalization firewall

Normalization means alternative representations of the same identity, for example a governed `IOB` spelling and `INDIAN OVERSEAS BANK`. Consolidation means distinct atomic source identities intentionally reported under one Management Bank.

`BANK_ALIASES` and `BANK_ID_ALIASES` must not become parent mappings, scheme mappings, management hierarchy, budget ownership rules, or consolidation rules. In particular, mapping a meaningful source/channel identity such as `INDIAN BANK (PMSBY)` to `INDIAN BANK` through an alias is prohibited when it would erase business provenance.

## 4. Future conceptual relationship model

```text
sourceBankIdentity
  ├─ sourceIdentityId
  └─ sourceDisplayName
          │
          ▼
management relationship
  ├─ managementBankId
  ├─ subChannelId?
  ├─ validFrom?
  └─ validTo?
```

One source identity maps to exactly one Management Bank for any one analytical period. A Management Bank may contain many source identities and sub-channels. Simultaneous mappings of one source identity to multiple Management Banks are prohibited; they would duplicate Actual unless a separately governed allocation authority is introduced.

The relationship is effective-dated. Boundaries are inclusive; open-start and open-end relationships are permitted. Invalid ranges, overlapping mappings for the same source and period, missing source identity, unknown Management Bank, or conflicting sub-channel assignments are explicit `INVALID` or `CONFLICT` states and are never repaired silently. Missing mapping is `UNMAPPED`, not evidence of a current or historical self-map.

## 5. Parent-direct and Actual ownership

Each PR transaction contributes signed premium to exactly one atomic `sourceBankIdentity` before management aggregation. Management Actual is derived only:

```text
Management Actual = Σ atomic source Actual mapped to that Management Bank and period
```

Business directly belonging to a Management Bank must itself be represented as one governed atomic source identity (which may have a governed parent-direct sub-channel classification). A stored parent total is not child source Actual and must not be added to child Actual. This prevents parent-direct Actual, already-consolidated parent Actual, and child Actual from being summed together.

Unknown/unmapped source identity retains its raw/source identity and signed Actual, remains reconcilable, and is not silently assigned to a Management Bank.

Required invariants:

```text
Σ atomic source Actual = Σ Management Bank Actual + unmapped Actual
Management Bank Actual = Σ its assigned atomic source Actual
ALL = Σ atomic records once
```

## 6. Budget ownership

Target, Commercial Budget, and Potential remain distinct authorities.

### Legacy Target

The existing Target authority is a session/in-memory FY objective, overall or current canonical-Bank keyed, in ₹ Cr, with equal `annual Target / 12` allocation. It serves Target & Growth and Scorecard semantics.

### Commercial Budget and Potential

Commercial Budget and Potential remain explicit monthly branch-period references at:

```text
branchId + YYYY-MM
```

They remain authoritative for Commercial Performance, roll-ups, execution, and priority. Step 6C does not redesign them as annual management-Bank budgets and introduces no seasonality or `/12` logic into Branch Budget & Potential.

For future hierarchy-aware planning, one planning value has one authoritative ownership grain. If a parent value is authoritative, child values are allocations that reconcile to it, or are excluded from its roll-up. If child values are authoritative, parent values are derived from their sum. Authoritative parent and child Budgets must never be blindly summed.

## 7. Branch, Activation, and Commercial firewalls

Existing durable branch identity remains `BANK_ID:BRANCH_CODE`. Management consolidation alone must not assume equal branch codes under different source identities are one physical outlet. Cross-channel physical-branch deduplication requires a separate governed durable relationship; existing `branchId` is not redefined.

Step 6B effective-dated Activation remains unchanged. Any future management/sub-channel Activation view must separately define whether it measures source-channel activation, management-Bank physical-branch activation, or another governed measure. It must not sum child denominators when physical branches can overlap.

Commercial Performance retains its `branchId + periodKey` Actual/reference union. Future management reporting consumes governed atomic rows and does not duplicate Commercial rows or introduce new Commercial formulas.

## 8. Future filters and exports

A source/sub-channel filter selects atomic business of that governed identity. A Management Bank filter aggregates its atomic sources valid for the selected period. `ALL` aggregates atomic business once; it must never add parent totals to child totals.

Where hierarchy reporting is used, exports must be able to carry source identity, Management Bank, optional sub-channel, durable branch identity, and analytical period. Existing exports and fields are not changed by this contract.

## 9. `canonicalBank` compatibility and provenance

`canonicalBank` retains its current flat-Bank meaning for existing consumers. New source and management identities are additive, and consumers migrate explicitly; there is no global semantic flip.

For datasets without an explicit management relationship, existing flat behavior may operate as a compatibility **`LEGACY_SELF_MAPPED`** relationship only where source identity and current canonical Bank are already the same current flat identity. It is not proof of historical hierarchy. Minimum conceptual provenance states are:

```text
GOVERNED
LEGACY_SELF_MAPPED
UNMAPPED
CONFLICT
INVALID
```

## 10. Non-goals

This contract does not implement a new Bank/source master, hierarchy persistence, alias changes, PR schema changes, Branch Master changes, filters, UI, exports, Commercial Budget migration, Target seasonality, replacement of `/12`, Activation hierarchy, physical-branch redesign, or PMSBY-specific behavior.

## 11. Recommended authority order

1. Define executable synthetic source/management identity and budget-ownership contract tests.
2. Implement a pure source-to-management relationship resolver only if management/sub-channel reporting is approved.
3. Add persistence/import only if the approved resolver requires maintained relationship records.
4. Preserve PR source identity before any hierarchy-based analytical roll-up.
5. Migrate individual analytical consumers explicitly, with reconciliation and export decisions per consumer.
6. Complete management-hierarchy acceptance separately.

## 12. Seasonality dependency verdict

**TARGET SEASONALITY CAN PROCEED ON CURRENT CANONICAL BANK IDENTITY.**

Repository evidence shows the only equal-month allocation is the legacy Target authority, already safely keyed by the current flat canonical Bank/overall scope. Target seasonality can replace or govern that legacy Target allocation without implementing the full Bank parent/sub-channel hierarchy, provided it preserves current Target owner identity and does not alter Commercial Budget/Potential. A later management-Bank Target requirement would require explicit budget-owner and hierarchy governance first.

## 13. Contract conclusion

### A. Current authority preserved

Current aliases, flat `canonicalBank`, Branch Master identity, effective-dated Activation, Commercial branch-period Budget/Potential, and legacy Target behavior remain unchanged.

### B. Future identity model

Future management reporting requires additive atomic source identity, effective-dated Management Bank relationship, optional governed sub-channel, and explicit budget owner.

### C. Double-count prevention rule

Every transaction belongs to one atomic source identity before roll-up; parent totals are derived and never added to their children.

### D. Budget ownership rule

Every planning value has one authoritative grain; parent and child authoritative values are not summed without a governed allocation/reconciliation rule.

### E. Seasonality dependency verdict

Target Seasonality may proceed on the existing current canonical-Bank Target owner identity. Full parent/sub-channel hierarchy is a separate future capability.
