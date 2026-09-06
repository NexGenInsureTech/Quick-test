/* Step 4D: detached temporal Business Attribution resolution. */
"use strict";
const assert = require("assert"); const fs = require("fs"); const path = require("path"); const vm = require("vm");
global.window = global;
const load = (file) => vm.runInThisContext(fs.readFileSync(path.join(__dirname, "..", file), "utf8"), { filename: file });
["js/data/schema.js", "js/data/datasetRegistry.js", "js/masters/employeeMaster.js", "js/enrichment/businessAttribution.js", "js/enrichment/temporalBusinessAttributionResolver.js"].forEach(load);
const Resolver = BancaTrackerTemporalBusinessAttributionResolver;
const employee = (employeeId, overrides = {}) => ({ employeeId, employeeName: employeeId, designation: "Executive", employmentStatus: "ACTIVE", active: true, dateOfJoining: "2025-01-01", exitDate: null, ...overrides });
const employees = [employee("EMP001"), employee("EMP002", { dateOfJoining: "2025-09-01" }), employee("EMP003", { employmentStatus: "EXITED", active: false, exitDate: "2025-06-30" }), employee("EMP004", { dateOfJoining: null })];
const assignments = [{ branchId: "BANK_A:001", rmId: "EMP001", active: true, validFrom: "2025-01-01" }];
const context = { employeeRecords: employees, legacyAssignmentRecords: assignments };
const record = (overrides = {}) => ({ recordId: "CANONICAL:1", policyIssuedDate: "2025-08-31", premium: 100, branchId: "BANK_A:002", sourceRmId: "EMP001", ...overrides });

let result = Resolver.resolveRecord(record(), context);
assert.deepStrictEqual([result.canonicalRecordReference, result.attributionStatus, result.employeeId, result.temporalStatus, result.signedActual], ["CANONICAL:1", "ATTRIBUTED_SOURCE_RM_ID", "EMP001", "EFFECTIVE", 100]);
result = Resolver.resolveRecord(record({ sourceRmId: "EMP002" }), context); assert.strictEqual(result.employeeId, null); assert.strictEqual(result.temporalStatus, "NOT_EFFECTIVE");
result = Resolver.resolveRecord(record({ sourceRmId: "EMP003", policyIssuedDate: "2025-08-01" }), context); assert.strictEqual(result.employeeId, null); assert.strictEqual(result.temporalStatus, "NOT_EFFECTIVE");
result = Resolver.resolveRecord(record({ sourceRmId: "EMP001", policyIssuedDate: "2026-08-31" }), context); assert.strictEqual(result.employeeId, "EMP001"); assert.strictEqual(result.temporalStatus, "EFFECTIVE");
result = Resolver.resolveRecord(record({ sourceRmId: "EMP004" }), context); assert.strictEqual(result.employeeId, null); assert.strictEqual(result.temporalStatus, "UNVERIFIED"); assert.ok(result.diagnostics.includes("ATTRIBUTION_EMPLOYEE_EFFECTIVITY_UNVERIFIED"));
result = Resolver.resolveRecord(record({ sourceRmId: "UNKNOWN", branchId: "BANK_A:001" }), context); assert.strictEqual(result.employeeId, null); assert.ok(result.diagnostics.includes("ATTRIBUTION_SOURCE_RM_ID_UNMAPPED"));
result = Resolver.resolveRecord(record({ sourceRmId: null, branchId: "BANK_A:001" }), context); assert.deepStrictEqual([result.attributionStatus, result.employeeId, result.temporalStatus], ["ATTRIBUTED_LEGACY_BRANCH_ASSIGNMENT", "EMP001", "EFFECTIVE"]);
result = Resolver.resolveRecord(record({ sourceRmId: null, branchId: "BANK_A:001" }), { employeeRecords: employees, legacyAssignmentRecords: [{ branchId: "BANK_A:001", rmId: "EMP001", active: true }] }); assert.strictEqual(result.employeeId, null); assert.strictEqual(result.temporalStatus, "UNVERIFIED"); assert.ok(result.diagnostics.includes("ATTRIBUTION_ASSIGNMENT_EFFECTIVITY_UNVERIFIED"));
result = Resolver.resolveRecord(record({ sourceRmId: null, branchId: "BANK_A:001" }), { employeeRecords: employees, legacyAssignmentRecords: [{ employeeId: "EMP001", branchId: "BANK_A:001", deploymentType: "PRIMARY", active: true, validFrom: "2025-01-01" }] }); assert.strictEqual(result.employeeId, null); assert.strictEqual(result.temporalStatus, "UNRESOLVED");
for (const premium of [25, 0, -25]) assert.strictEqual(Resolver.resolveRecord(record({ premium }), context).signedActual, premium);
const records = [record({ recordId: "R2", premium: 25 }), record({ recordId: "R1", sourceRmId: null, premium: 0, branchId: "BANK_A:001" }), record({ recordId: "R3", premium: -25, sourceRmId: "UNKNOWN" })]; const snapshot = JSON.stringify(records);
const batch = Resolver.resolveBatch(records, context); assert.strictEqual(batch.results.length, records.length); assert.deepStrictEqual(batch.results.map((item) => item.canonicalRecordReference), ["R2", "R1", "R3"]); assert.strictEqual(JSON.stringify(records), snapshot); assert.strictEqual(batch.summary.reconciliation.complete, true); assert.deepStrictEqual(batch, Resolver.resolveBatch(records, context));
const source = fs.readFileSync(path.join(__dirname, "..", "js/enrichment/temporalBusinessAttributionResolver.js"), "utf8"); for (const forbidden of ["Repository", "IndexedDB", "WorkforceDeployment", "Hierarchy", "PRIMARY", "SUPPORT", "BA NAME"]) assert.ok(!source.includes(forbidden), forbidden);
console.log("Step 4D Temporal Business Attribution tests passed: detached as-of resolution, temporal gates, signed Actual, order, purity, and isolation.");
