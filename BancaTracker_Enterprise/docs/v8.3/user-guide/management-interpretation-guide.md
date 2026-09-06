# BancaTracker Enterprise v8.3 management interpretation guide

Use this guide after Data Quality has been reviewed. Each cue is an investigation prompt, not an automated business decision.

## High Premium but low activation

**What you see:** material premium generated from a small active-branch share.

**What it means:** business may be concentrated rather than broadly distributed.

**What to investigate:** branch universe accuracy, dormant/near-active branches, concentration by bank/branch, and whether the active threshold is appropriate for the period.

**What not to conclude:** that the network is broadly healthy merely because premium is high.

## Strong activation but weak productivity

**What you see:** many active branches with low premium per relevant producing denominator.

**What it means:** breadth exists but value per participating unit may be weak.

**What to investigate:** product mix, case quality, branch potential, period effects, and the exact productivity denominator.

**What not to conclude:** that every active branch is underperforming or that activation was wasted.

## Positive Actual but lower than Budget

**What you see:** signed Actual is positive while achievement against an available budget is below expectation.

**What it means:** the observed output is positive but is below the supplied commercial reference.

**What to investigate:** period alignment, branch/period budget coverage, source adjustments, trend, and controllable execution factors.

**What not to conclude:** that contribution fell, that the business is negative, or that Budget changes the meaning of Actual.

## Actual above Potential

**What you see:** signed Actual exceeds the configured potential.

**What it means:** potential, actual mapping, period alignment, or source scope needs review.

**What to investigate:** branch identity, commercial reference period, potential methodology, and whether adjustments or aggregation scopes differ.

**What not to conclude:** that performance is impossible or that the record should be discarded automatically.

## Missing Budget or Potential

**What you see:** no commercial reference, or only one of Budget/Potential, for a branch-period.

**What it means:** commercial interpretation is absent or partial for that scope.

**What to investigate:** Branch Master mapping, period key, and master coverage.

**What not to conclude:** that Budget/Potential is zero or that Actual is zero.

## High direct employee Actual

**What you see:** a high amount attributed directly to one employee by accepted source evidence.

**What it means:** direct employee Actual is additive across distinct canonical records and preserves signed values.

**What to investigate:** attribution source/status, source RM identity, policy date, source adjustments, and data-quality coverage.

**What not to conclude:** that a manager owns the same amount directly, or that designation explains ownership.

## High hierarchy team Actual

**What you see:** an employee’s hierarchy context includes material descendant business.

**What it means:** it is an analytical roll-up based on the effective direct-reporting graph.

**What to investigate:** as-of date, graph completeness, relationship history, and direct-versus-team scope.

**What not to conclude:** that Team Actual can be summed across managers, or that it is additional business over direct actual.

## High deployed Actual but low direct attributed Actual

**What you see:** deployment-alignment analysis has more business associated with deployed scope than direct attribution for an employee.

**What it means:** deployment is a diagnostic relationship, while direct attribution requires transaction evidence.

**What to investigate:** source RM identity, branch identity, deployment effective dates, and attribution coverage.

**What not to conclude:** that PRIMARY deployment establishes ownership or that SUPPORT deployment creates a premium share.

## High unattributed business

**What you see:** a material signed Actual amount has no resolved direct employee attribution.

**What it means:** identity coverage is incomplete, unavailable, unmapped, absent, or ambiguous according to explicit diagnostics.

**What to investigate:** `Ba Code`/source RM ID, Employee Master identity coverage, permitted legacy assignment context, as-of dates, and unmapped source statuses.

**What not to conclude:** that the business has no owner in the real organisation, that BA NAME may be used to guess one, or that deployment may be substituted.

## Negative Actual / adjustments

**What you see:** negative signed Actual in a selected scope.

**What it means:** the source includes an adjustment, reversal, cancellation, or other negative transaction effect; it remains part of reconciliation.

**What to investigate:** underlying records, policy timing, product/process context, and whether the selected period is appropriate.

**What not to conclude:** that the value is missing, zero, or safe to remove from totals.

## Incomplete hierarchy

**What you see:** a hierarchy diagnostic indicates missing relationships, roots, or partial graph coverage.

**What it means:** direct employee results can remain valid while hierarchy context is limited.

**What to investigate:** active Employee Master identities, temporal relationship rows, valid dates, and graph diagnostics.

**What not to conclude:** that a missing manager can be inferred from designation, ROLE, or deployment.

## Data Quality warning affecting workforce interpretation

**What you see:** a warning affecting employee, branch, assignment, canonical date, or mapping coverage.

**What it means:** the affected workforce or commercial interpretation requires caution; the entire PR dataset is not necessarily unusable.

**What to investigate:** the warning code, affected rows/dimension, master activation state, and source quality.

**What not to conclude:** that every KPI is invalid or that warnings can be ignored because a total is visible.
