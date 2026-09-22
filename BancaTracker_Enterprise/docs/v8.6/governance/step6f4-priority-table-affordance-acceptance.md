# Step 6F.4 — Priority-Table Affordance Acceptance

## Purpose and baseline

Step 6F closes the Priority-table drill-down discoverability improvement on `feature/v8.6-governance-foundation`. Before this change, Reference Priority and Execution Priority already used native entity-name buttons, a shared delegated interaction path, and the governed Commercial Execution Drilldown authority. The issue was affordance only; rankings, metrics, scopes, and drill hierarchy were already correct.

## Implemented affordance

Both Priority views now use the same native entity button pattern:

```text
entity label + compact local chevron
```

The button retains `.commercial-drilldown-select` and adds the Priority-specific `.commercial-priority-drilldown-select`. Its decorative chevron is contained within the same button, requires no external asset, and does not create another focus or click target. Priority-specific CSS supplies compact inline alignment, a visible at-rest boundary, pointer cursor, hover feedback, and `:focus-visible` feedback without a new column, row-wide action treatment, or heavy table chrome.

## Accessibility and interaction boundary

Each Priority entity button exposes the explicit action name `Drill down into {entity}` while its chevron is `aria-hidden`. Entity labels continue through the existing escaping path. Native keyboard behavior and delegated `.commercial-drilldown-select` handling remain in place.

The entity control remains the only actionable surface. Priority rows, rank, reasons, Budget, shortfall, pace, projection, attention, and ordinary metric cells remain display-only. Both entity-label and nested-chevron clicks use the same delegated button path.

## Preserved behavior and firewalls

Reference and Execution Priority share the same affordance system. Terminal Branch selection remains valid: it establishes existing terminal context and does not invent recursive children. The main Execution table remains unchanged, retaining its base control, `aria-pressed`, and `.is-selected` semantics without Priority cue markup.

No change was made to Priority ranking or ordering, Commercial Execution Drilldown authority, Budget, Actual, pace, shortfall, projection, attention, scopes, filters, Target, Activation, Productivity, Scorecard, Data Quality, masters, persistence, exports, or any external dependency. The application remains offline HTML/CSS/Vanilla JS.

## Regression evidence and scope

The Step 6F.2 affordance contract is permanently registered. Focused Priority interaction, Priority UI, Drilldown UI, and Execution UI regressions pass; the master suite passes 85 groups and all tracked JavaScript syntax checks pass.

Production scope:

- `js/commercialPerformanceUI.js`
- `style.css`

The strengthened existing interaction coverage is recorded separately:

- `tests/step-v841-priority-drilldown-interactions.test.js`

## Acceptance matrix

| Area | Result |
| --- | --- |
| Native Priority entity buttons | PASS |
| Visible compact cue and explicit action name | PASS |
| Entity-only delegated interaction | PASS |
| Row and metric non-interactivity | PASS |
| Reference/Execution consistency | PASS |
| Terminal Branch preservation | PASS |
| Main Execution and analytical firewalls | PASS |
| Offline/dependency firewall | PASS |

## Closure verdict

**STEP 6F — PRIORITY-TABLE AFFORDANCE IMPROVEMENT: CLOSED**

**READY FOR NEXT v8.6 BACKLOG ITEM**
