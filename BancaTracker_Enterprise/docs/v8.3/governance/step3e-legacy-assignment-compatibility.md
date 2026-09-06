# BancaTracker Enterprise v8.3

## Step 3E — Legacy Assignment Compatibility Boundary

**Outcome:** A — No native-to-legacy projection required  
**Scope:** Evidence-based protection of frozen v8.2 RM-centric consumers while native Workforce Deployment v2 is active.

## Consumer inventory

| Consumer | Actual API/data source | Legacy semantic required | Native-v2 behavior | Projection required? |
|---|---|---|---|---|
| `liveAssignmentAuthority.js` | `repository.getActiveMasterRecords("BRANCH_ASSIGNMENT")` → `AssignmentResolver.buildLookupMaps()` | One branch → one `rmId`; exposes assigned RM comparison fields. | Guarded raw read returns `[]`; `assignmentMaps` is null and existing `MASTER_ABSENT` behavior applies. | No. |
| `shadowEnrichment.js` | Same generic active-record read → legacy assignment maps. | Legacy branch → RM enrichment maps. | Guarded raw read returns `[]`; shadow context has no assignment map. | No. |
| `enrichmentPipeline.js` | `AssignmentResolver.resolveAssignment(branch, context.assignmentMaps)` | `rmId` used only after legacy resolution. | Null map returns the existing unresolved/master-absent result; source RM remains separately represented. | No. |
| `commercialRollups.js` | `context.assignmentMaps.assignmentByBranchId` | Optional legacy `assignedRmId` for hierarchy-related commercial context. | No map means no assigned RM/hierarchy derivation. It does not select a deployed employee. | No. |
| `assignmentResolver.js` | Legacy records supplied by callers. | Single exact `branchId → rmId` mapping. | Unchanged; native records cannot reach it through repository raw reads. | No. |

Master Data import remains dual-routed by CSV profile and is not a runtime RM consumer. Master Data Administration displays dataset lifecycle metadata but does not derive `rmId` from native deployment.

## Evidence and boundary

`getActiveMasterRecords("BRANCH_ASSIGNMENT")` classifies the active dataset from persisted metadata. For `WORKFORCE_DEPLOYMENT_V2`, it returns no records to legacy raw consumers. `getActiveWorkforceDeploymentContext()` is the explicit native read path and `getActiveWorkforceDeploymentResolutionContext(asOfDate)` is the explicit temporal native path.

This is intentional isolation, not an implicit projection. Metadata-less or declared legacy datasets remain readable through the existing generic path and continue to use `BancaTrackerBranchAssignmentMaster` and `BancaTrackerAssignmentResolver` unchanged.

## Projection decision

No current consumer is required to operate over a native many-to-many deployment dataset as if it were a single branch-to-RM mapping. A projection would be unsafe because `PRIMARY` is operational coverage, not RM identity or business ownership, and several deployed people can cover one branch.

Therefore Step 3E creates no projection module, no new global API, no script-order change, and no persisted compatibility record.

If a later approved consumer demonstrably requires legacy output, it must call an explicit, as-of-date compatibility authority. Eligibility must require both a single effective `PRIMARY` deployment and explicit canonical `legacyHierarchyRole === "RM"` evidence. `DESIGNATION` alone is never eligible. `SUPPORT` is excluded. Missing eligibility returns `UNPROJECTABLE`; multiple candidates return `AMBIGUOUS`. Such output is runtime-only and remains lossy.

## Attribution firewall

Neither the current isolation boundary nor any future compatibility output may create `premiumOwner`, `businessOwner`, `attributedPremium`, `allocationPercent`, `performanceCredit`, `managerCredit`, or achievement ownership. A legacy `rmId`, if ever approved, would be consumer compatibility data only—not an attribution authority.

## Migration implications

When native v2 is active, frozen RM-centric analytics receive their existing no-assignment outcome rather than fabricated RM information. Native deployment consumers must use the new explicit Workforce Deployment context/resolver. Legacy consumers stay on legacy datasets until a separately approved compatibility consumer and projection contract exist.

## Acceptance

- [x] Real consumers and exact RM-centric shapes inventoried.
- [x] Native v2 cannot leak raw records into the legacy resolver path.
- [x] Legacy active datasets retain existing resolver behavior.
- [x] No designation, support deployment, hierarchy, or attribution inference is introduced.
- [x] No IndexedDB schema change or in-place migration occurs.

Recommended Step 3F: browser acceptance of native import/activation, native temporal resolution, legacy runtime isolation, and unchanged legacy-dataset behavior. No projection implementation is authorized unless new consumer evidence changes this decision.
