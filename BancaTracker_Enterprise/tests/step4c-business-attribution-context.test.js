/* Step 4C: repository-provided Business Attribution runtime context. */
"use strict";
const assert = require("assert"); const fs = require("fs"); const path = require("path"); const vm = require("vm");
global.window = global;
const load = (file) => vm.runInThisContext(fs.readFileSync(path.join(__dirname, "..", file), "utf8"), { filename: file });
["js/data/schema.js", "js/data/datasetRegistry.js", "js/masters/employeeMaster.js", "js/masters/branchMaster.js", "js/masters/workforceDeployment.js", "js/enrichment/businessAttribution.js"].forEach(load);
const datasets = new Map(); const recordsByDataset = new Map(); const active = new Map();
global.BancaTrackerIndexedDb = {
  async get(store, key) { if (store === BancaTrackerSchema.STORES.APP_METADATA) return active.has(key) ? { key, value: active.get(key) } : null; if (store === BancaTrackerSchema.STORES.DATASETS) return datasets.get(key) || null; return null; },
  async getAllByIndex(store, index, value) { return recordsByDataset.get(value) || []; },
};
load("js/data/repository.js");
const Registry = BancaTrackerDatasetRegistry; const Types = Registry.DATASET_TYPES; const EmployeeContract = Registry.EMPLOYEE_DATA_CONTRACT; const DeploymentContract = Registry.WORKFORCE_DEPLOYMENT_DATA_CONTRACT;
function activate(type, dataset, records) { datasets.set(dataset.datasetId, dataset); recordsByDataset.set(dataset.datasetId, records || []); active.set(`activeDataset:${type}`, dataset.datasetId); }
function reset() { datasets.clear(); recordsByDataset.clear(); active.clear(); }
const employeeRecord = { recordId: "E:EMP001", datasetId: "E", employeeId: "EMP001", employeeName: "Employee", designation: "USM", employmentStatus: "ACTIVE", active: true, dateOfJoining: "2024-01-01", exitDate: null, sourceRowNumber: 2 };
const nativeEmployee = { datasetId: "E", datasetType: Types.EMPLOYEE_MASTER, metadata: { dataContract: { name: EmployeeContract.NAME, version: EmployeeContract.CURRENT_VERSION, sourceProfile: EmployeeContract.PROFILES.NATIVE_V2 } } };
const legacyAssignment = { datasetId: "A", datasetType: Types.BRANCH_ASSIGNMENT, metadata: { dataContract: { name: DeploymentContract.NAME, version: DeploymentContract.LEGACY_VERSION, sourceProfile: DeploymentContract.PROFILES.LEGACY_V1 } } };

(async function () {
  reset(); activate(Types.EMPLOYEE_MASTER, nativeEmployee, [employeeRecord]); activate(Types.BRANCH_ASSIGNMENT, legacyAssignment, [{ recordId: "A:B1", datasetId: "A", branchId: "BANK_A:001", rmId: "EMP001", active: true, validFrom: "2025-01-01" }]);
  let context = await BancaTrackerRepository.getActiveBusinessAttributionContext();
  assert.strictEqual(context.status, "READY"); assert.strictEqual(context.employee.status, "READY"); assert.strictEqual(context.legacyAssignment.status, "READY"); assert.ok(context.employeeLookup.employeeById.has("EMP001")); assert.ok(context.legacyAssignmentLookup.assignmentByBranchId.has("BANK_A:001"));
  assert.strictEqual(BancaTrackerBusinessAttribution.resolveAttribution({ policyIssuedDate: "2025-08-31", premium: 10, branchId: "BANK_A:001", sourceRmId: null }, context).employeeId, "EMP001");
  const first = JSON.stringify({ status: context.status, employee: context.employee.status, legacy: context.legacyAssignment.status, diagnostics: context.diagnostics }); context = await BancaTrackerRepository.getActiveBusinessAttributionContext(); assert.strictEqual(JSON.stringify({ status: context.status, employee: context.employee.status, legacy: context.legacyAssignment.status, diagnostics: context.diagnostics }), first);

  reset(); activate(Types.EMPLOYEE_MASTER, nativeEmployee, [employeeRecord]); activate(Types.BRANCH_ASSIGNMENT, { datasetId: "D", datasetType: Types.BRANCH_ASSIGNMENT, metadata: { dataContract: { name: DeploymentContract.NAME, version: DeploymentContract.CURRENT_VERSION, sourceProfile: DeploymentContract.PROFILES.WORKFORCE_DEPLOYMENT_V2 } } }, [{ recordId: "D:1", datasetId: "D", employeeId: "EMP001", branchId: "BANK_A:001", deploymentType: "PRIMARY", active: true }]);
  context = await BancaTrackerRepository.getActiveBusinessAttributionContext(); assert.strictEqual(context.status, "READY"); assert.strictEqual(context.legacyAssignment.status, "NATIVE_DEPLOYMENT_ACTIVE"); assert.strictEqual(context.legacyAssignmentLookup, null); assert.ok(context.diagnostics.includes("ATTRIBUTION_LEGACY_FALLBACK_UNAVAILABLE_NATIVE_DEPLOYMENT"));

  reset(); context = await BancaTrackerRepository.getActiveBusinessAttributionContext(); assert.strictEqual(context.status, "UNAVAILABLE"); assert.ok(context.diagnostics.includes("ATTRIBUTION_EMPLOYEE_MASTER_ABSENT"));
  reset(); activate(Types.EMPLOYEE_MASTER, { datasetId: "BAD", datasetType: Types.EMPLOYEE_MASTER, metadata: { dataContract: { name: EmployeeContract.NAME, version: 99, sourceProfile: "BAD" } } }, []); context = await BancaTrackerRepository.getActiveBusinessAttributionContext(); assert.strictEqual(context.status, "UNSUPPORTED"); assert.ok(context.diagnostics.includes("ATTRIBUTION_EMPLOYEE_MASTER_UNSUPPORTED"));
  reset(); activate(Types.EMPLOYEE_MASTER, nativeEmployee, [employeeRecord]); context = await BancaTrackerRepository.getActiveBusinessAttributionContext(); assert.strictEqual(context.status, "READY"); assert.strictEqual(context.legacyAssignment.status, "ABSENT"); assert.strictEqual(context.legacyAssignmentLookup, null);
  reset(); activate(Types.EMPLOYEE_MASTER, { datasetId: "LEGACY_EMPLOYEE", datasetType: Types.EMPLOYEE_MASTER }, [{ ...employeeRecord, datasetId: "LEGACY_EMPLOYEE" }]); context = await BancaTrackerRepository.getActiveBusinessAttributionContext(); assert.strictEqual(context.status, "READY"); assert.strictEqual(context.employee.status, "LEGACY_COMPATIBILITY");
  reset(); activate(Types.EMPLOYEE_MASTER, nativeEmployee, [employeeRecord]); activate(Types.BRANCH_ASSIGNMENT, { datasetId: "LEGACY", datasetType: Types.BRANCH_ASSIGNMENT }, [{ recordId: "LEGACY:1", datasetId: "LEGACY", branchId: "BANK_A:001", rmId: "EMP001", active: true }]); context = await BancaTrackerRepository.getActiveBusinessAttributionContext(); assert.strictEqual(context.legacyAssignment.status, "LEGACY_COMPATIBILITY"); assert.ok(context.legacyAssignmentLookup.assignmentByBranchId.has("BANK_A:001"));
  console.log("Step 4C Business Attribution context tests passed: employee contracts, legacy fallback firewall, deterministic context, and no deployment ownership projection.");
})().catch((error) => { console.error(error); process.exit(1); });
