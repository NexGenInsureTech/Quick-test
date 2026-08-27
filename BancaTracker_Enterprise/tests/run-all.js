/* Dependency-free master regression runner. Benchmarks are intentionally excluded. */
const { spawnSync } = require("child_process"); const path = require("path");
const groups = ["phase5.test.js", "phase6.test.js", "step81a.test.js", "step81b.test.js", "step81c.test.js", "step81d.test.js", "step81e.test.js", "step2j-reconciliation.test.js", "step2k-shadow-enrichment.test.js", "step2l-readiness-diagnostics.test.js", "step3a-master-data-ui.test.js", "step3b-master-data-import.test.js"];
let failed = false;
groups.forEach((file) => {
  const result = spawnSync(process.execPath, [path.join(__dirname, file)], { encoding: "utf8" });
  if (result.status === 0) { console.log(`PASS ${file}`); if (result.stdout.trim()) console.log(result.stdout.trim()); }
  else { failed = true; console.error(`FAIL ${file}`); if (result.stdout.trim()) console.error(result.stdout.trim()); if (result.stderr.trim()) console.error(result.stderr.trim()); }
});
if (failed) { console.error("FAIL master regression suite"); process.exit(1); }
console.log(`PASS master regression suite (${groups.length} groups)`);
