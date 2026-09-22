/* Dependency-free master regression runner. Benchmarks are intentionally excluded. */
const { spawnSync } = require("child_process"); const path = require("path");
const groups = ["step1d-employee-persistence-compatibility.test.js", "step1b-employee-master-v2.test.js", "phase5.test.js", "phase6.test.js", "step81a.test.js", "step81b.test.js", "step81c.test.js", "step81d.test.js", "step81e.test.js", "step2j-reconciliation.test.js", "step2k-shadow-enrichment.test.js", "step2l-readiness-diagnostics.test.js", "step3a-master-data-ui.test.js", "step3b-master-data-import.test.js", "step3c-canonical-data-quality.test.js", "step4a-canonical-date-authority.test.js", "step4b-governed-geography-authority.test.js", "step4c1-pr-identity-contract.test.js", "step4c-durable-branch-authority.test.js", "step4d-assigned-rm-authority.test.js", "step4e-organisation-hierarchy-authority.test.js", "step4f1-branch-universe-contract.test.js", "step4f-branch-universe-authority.test.js", "step4g-branch-budget-potential-authority.test.js", "step4h-commercial-performance-authority.test.js", "step4i-commercial-period-rollups.test.js", "step4j-commercial-performance-ui.test.js", "step4k-commercial-month-comparison.test.js", "step4l-daily-premium-comparison.test.js", "step4m-commercial-comparison-ui.test.js", "step4n-commercial-execution-pacing.test.js", "step4o-commercial-execution-ui.test.js", "step4p-commercial-execution-status.test.js", "step4q-commercial-execution-status-ui.test.js", "step4s-commercial-execution-priority.test.js", "step4t-commercial-execution-priority-ui.test.js", "step4v-commercial-execution-drilldown.test.js", "step4w-commercial-execution-drilldown-ui.test.js", "step4y-commercial-driver-analysis.test.js", "step4z-commercial-driver-analysis-ui.test.js", "step4b-business-attribution.test.js", "step4c-business-attribution-context.test.js", "step4d-temporal-business-attribution.test.js", "step4e-business-attribution-reconciliation.test.js", "step4f-business-attribution-hierarchy-rollup.test.js", "step4g-business-attribution-browser-acceptance.test.js", "step5b-workforce-performance.test.js", "step5c-workforce-performance-slices.test.js", "step5d-workforce-performance-browser-acceptance.test.js"];
groups.unshift("step3f-workforce-deployment-browser-acceptance.test.js", "step3e-legacy-assignment-compatibility.test.js", "step3d-workforce-deployment-resolution.test.js", "step3c-workforce-deployment-persistence.test.js", "step3b-workforce-deployment.test.js", "step2f-direct-hierarchy-browser-acceptance.test.js", "step2e-legacy-hierarchy-projection.test.js", "step2d-temporal-hierarchy-resolution.test.js", "step2c-direct-hierarchy-persistence.test.js", "step2b-direct-reporting-hierarchy.test.js", "step1f-employee-browser-acceptance.test.js", "step1e-employee-vintage.test.js");
groups.push("step5e-synthetic-production-simulation.test.js", "test-equivalent-elapsed-day-comparison.js", "test-branch-maturity-comparison.js", "test-csv-export.js", "test-equivalent-elapsed-day-ui.js", "test-branch-maturity-ui.js", "test-v84-export-ui.js");
groups.push("step-v841-policy-date-header-alias.test.js");
groups.push("step-v841-priority-drilldown-interactions.test.js");
groups.push("test-absolute-rupee-presentation.js");
groups.push("test-data-quality-guidance.js");
groups.push("test-all-channels-elapsed-day-ui.js");
groups.push("test-opportunity-ownership-export.js");
groups.push("test-branch-movement-export-ux.js");
groups.push("test-help-glossary.js");
groups.push("step6b2-effective-dated-branch-eligibility-contract.test.js");
groups.push("step6b5-activation-effective-dated-denominator.test.js");
groups.push("step6e2-csv-formula-prefix-hardening-contract.test.js");
groups.push("step6f2-priority-table-affordance-contract.test.js");
groups.push("step6d5-target-seasonality-persistence-contract.test.js");
groups.push("step6d5d2-target-seasonality-admin-live-cache-contract.test.js");
groups.push("step6d3-target-seasonality-contract.test.js");
groups.push("step6d6-target-seasonality-integration-contract.test.js");
groups.push("step6d7-target-seasonality-ui-contract.test.js");
let failed = false;
groups.forEach((file) => {
  const result = spawnSync(process.execPath, [path.join(__dirname, file)], { encoding: "utf8" });
  if (result.status === 0) { console.log(`PASS ${file}`); if (result.stdout.trim()) console.log(result.stdout.trim()); }
  else { failed = true; console.error(`FAIL ${file}`); if (result.stdout.trim()) console.error(result.stdout.trim()); if (result.stderr.trim()) console.error(result.stderr.trim()); }
});
if (failed) { console.error("FAIL master regression suite"); process.exit(1); }
console.log(`PASS master regression suite (${groups.length} groups)`);
