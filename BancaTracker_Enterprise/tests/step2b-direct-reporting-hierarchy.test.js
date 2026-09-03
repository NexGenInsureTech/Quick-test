/* Sprint 2B: Direct Reporting Hierarchy v2 authority. */
"use strict";
const assert = require("assert"); const path = require("path"); global.window = global;
require(path.join(__dirname, "..", "js/masters/directReportingHierarchy.js"));
const Authority = BancaTrackerDirectReportingHierarchy;
const employee = (employeeId, designation = "Employee", overrides = {}) => ({ employeeId, employeeName: employeeId, designation, employmentStatus: "ACTIVE", dateOfJoining: "2020-01-01", exitDate: null, ...overrides });
const row = (employeeId, managerEmployeeId, validFrom = "2025-01-01", validTo = "") => ({ "EMPLOYEE ID": employeeId, "MANAGER EMPLOYEE ID": managerEmployeeId || "", "VALID FROM": validFrom, "VALID TO": validTo });
const records = (rows, datasetId = "HIERARCHY:2B") => rows.map((item, index) => Authority.normalizeRecord(item, datasetId, index + 2));
const hasCode = (validation, code) => validation.findings.some((finding) => finding.code === code);

let employees = [employee("RM001", "RM"), employee("ASM001", "ASM"), employee("NH001", "National Head")];
let relationships = records([row("RM001", "ASM001"), row("ASM001", "NH001"), row("NH001", null)]);
let validation = Authority.validateDataset(relationships, employees);
assert.strictEqual(validation.valid, true);
let graph = Authority.buildGraph(relationships, employees, "2025-08-31");
let resolved = Authority.resolveEmployee("RM001", graph);
assert.deepStrictEqual({ status: resolved.status, directManagerId: resolved.directManagerId, chain: resolved.reportingChain, depth: resolved.reportingDepth, root: resolved.rootEmployeeId }, { status: "RESOLVED_TO_ROOT", directManagerId: "ASM001", chain: ["ASM001", "NH001"], depth: 2, root: "NH001" });
assert.deepStrictEqual(Authority.resolveEmployee("NH001", graph), { status: "ROOT", employeeId: "NH001", asOfDate: "2025-08-31", directManagerId: null, reportingChain: [], reportingDepth: 0, rootEmployeeId: "NH001", isRoot: true, diagnostics: [] });

relationships = records([row("RM002", "NH001"), row("NH001", null)]);
employees = [employee("RM002", "RM"), employee("NH001", "National Head")];
resolved = Authority.resolveEmployee("RM002", Authority.buildGraph(relationships, employees, "2025-08-31"));
assert.deepStrictEqual(resolved.reportingChain, ["NH001"]); assert.strictEqual(resolved.reportingDepth, 1);

employees = [employee("MT001", "MT"), employee("RM001", "RM"), employee("COORD001", "Coordinator"), employee("ZSM001", "ZSM"), employee("ROOT001", "Executive")];
relationships = records([row("MT001", "RM001"), row("RM001", "ROOT001"), row("COORD001", "ZSM001"), row("ZSM001", "ROOT001"), row("ROOT001", null)]);
validation = Authority.validateDataset(relationships, employees);
assert.strictEqual(validation.valid, true, "Arbitrary designations and skip levels must not invoke role adjacency validation.");
assert.strictEqual(hasCode(validation, "HIERARCHY_ROLE_MISMATCH"), false);

employees = [employee("ROOT1"), employee("ROOT2")]; relationships = records([row("ROOT1", null), row("ROOT2", null)]);
validation = Authority.validateDataset(relationships, employees);
assert.strictEqual(validation.valid, true); assert.ok(hasCode(validation, "HIERARCHY_V2_MULTIPLE_ROOTS"));
graph = Authority.buildGraph(relationships, employees, "2025-06-01"); assert.deepStrictEqual([...graph.roots].sort(), ["ROOT1", "ROOT2"]);
assert.ok(graph.diagnostics.includes("HIERARCHY_V2_DISCONNECTED_COMPONENTS"));

employees = [employee("E1")]; graph = Authority.buildGraph([], employees, "2025-06-01");
resolved = Authority.resolveEmployee("E1", graph); assert.strictEqual(resolved.status, "NO_RELATIONSHIP"); assert.strictEqual(resolved.isRoot, false);
assert.strictEqual(Authority.resolveEmployee("UNKNOWN", graph).status, "EMPLOYEE_NOT_FOUND");

employees = [employee("E1"), employee("M1")];
validation = Authority.validateDataset(records([row("UNKNOWN", "M1")]), employees); assert.ok(hasCode(validation, "HIERARCHY_V2_EMPLOYEE_UNMAPPED"));
validation = Authority.validateDataset(records([row("E1", "UNKNOWN")]), employees); assert.ok(hasCode(validation, "HIERARCHY_V2_MANAGER_UNMAPPED"));
validation = Authority.validateDataset(records([row("E1", "E1")]), employees); assert.ok(hasCode(validation, "HIERARCHY_V2_SELF_REFERENCE"));

validation = Authority.validateDataset(records([row("E1", "M1"), row("E1", "M1")]), employees);
assert.ok(hasCode(validation, "HIERARCHY_V2_RELATIONSHIP_DUPLICATE")); assert.ok(hasCode(validation, "HIERARCHY_V2_RELATIONSHIP_OVERLAP"));
validation = Authority.validateDataset(records([row("E1", "M1", "2025-01-01", "2025-06-30"), row("E1", null, "2025-06-30", "2025-12-31")]), employees);
assert.ok(hasCode(validation, "HIERARCHY_V2_RELATIONSHIP_OVERLAP"), "Inclusive boundaries overlap on the shared day.");
validation = Authority.validateDataset(records([row("E1", "M1", "2025-01-01", ""), row("E1", null, "2026-01-01", "")]), employees);
assert.ok(hasCode(validation, "HIERARCHY_V2_RELATIONSHIP_OVERLAP"), "Open-ended intervals overlap later intervals.");

employees = [employee("RM001"), employee("CSM001"), employee("ZSM002"), employee("ROOT")];
relationships = records([row("RM001", "CSM001", "2025-04-01", "2025-09-30"), row("RM001", "ZSM002", "2025-10-01"), row("CSM001", "ROOT", "2025-01-01"), row("ZSM002", "ROOT", "2025-01-01"), row("ROOT", null, "2025-01-01")]);
assert.strictEqual(Authority.resolveEmployee("RM001", Authority.buildGraph(relationships, employees, "2025-08-31")).directManagerId, "CSM001");
assert.strictEqual(Authority.resolveEmployee("RM001", Authority.buildGraph(relationships, employees, "2026-01-31")).directManagerId, "ZSM002");

employees = [employee("A"), employee("B"), employee("C")];
validation = Authority.validateDataset(records([row("A", "B"), row("B", "A")]), employees); assert.ok(hasCode(validation, "HIERARCHY_V2_CYCLE_DETECTED")); assert.deepStrictEqual([...validation.cycles[0].employeeIds].sort(), ["A", "B"]);
validation = Authority.validateDataset(records([row("A", "B"), row("B", "C"), row("C", "A")]), employees); assert.ok(hasCode(validation, "HIERARCHY_V2_CYCLE_DETECTED")); assert.strictEqual(validation.cycles[0].employeeIds.length, 3);
validation = Authority.validateDataset(records([row("A", "B", "2024-01-01", "2024-12-31"), row("B", "A", "2025-01-01", "2025-12-31")]), employees);
assert.strictEqual(hasCode(validation, "HIERARCHY_V2_CYCLE_DETECTED"), false, "Non-overlapping historical edges must not form a temporal cycle.");

employees = [employee("E1", "Employee", { dateOfJoining: "2024-01-01" }), employee("M1", "Manager", { dateOfJoining: "2020-01-01", employmentStatus: "EXITED", exitDate: "2025-06-30" })];
validation = Authority.validateDataset(records([row("E1", "M1", "2023-12-31", "2025-05-31")]), employees); assert.ok(hasCode(validation, "HIERARCHY_V2_EMPLOYMENT_RANGE_CONFLICT"));
validation = Authority.validateDataset(records([row("E1", "M1", "2025-01-01", "")]), employees); assert.ok(hasCode(validation, "HIERARCHY_V2_EMPLOYMENT_RANGE_CONFLICT"));
employees = [employee("E1", "Employee", { dateOfJoining: null }), employee("M1", "Manager")];
validation = Authority.validateDataset(records([row("E1", "M1", "2025-01-01", "2025-12-31")]), employees); assert.strictEqual(validation.valid, true); assert.ok(hasCode(validation, "HIERARCHY_V2_EMPLOYMENT_BOUNDARY_UNVERIFIED"));

employees = [employee("RM001"), employee("ASM001"), employee("NH001")]; relationships = records([row("RM001", "ASM001"), row("ASM001", "NH001"), row("NH001", null)]);
graph = Authority.buildGraph(relationships, employees, "2025-08-31");
const batch = Authority.resolveEmployees(employees, graph);
assert.deepStrictEqual(batch.diagnostics, { evaluatedEmployeeCount: 3, resolvedEmployeeCount: 3, explicitRootCount: 1, noRelationshipCount: 0, incompleteChainCount: 0, invalidRelationshipCount: 0, cycleAffectedEmployeeCount: 0, disconnectedComponentCount: 1 });
assert.strictEqual(Authority.buildGraph(relationships, employees, "31/08/2025").status, "INVALID_AS_OF_DATE");
assert.strictEqual(Authority.resolveEmployee("RM001", Authority.buildGraph(relationships, employees, "2025-08-31")).reportingDepth, 2, "Resolution must depend only on the explicit as-of date.");

const malformed = records([row("RM001", "ASM001", "2025-02-30")]); assert.ok(hasCode(Authority.validateDataset(malformed, employees), "HIERARCHY_V2_DATE_INVALID"));
const missingFrom = records([row("RM001", "ASM001", "")]); assert.ok(hasCode(Authority.validateDataset(missingFrom, employees), "HIERARCHY_V2_VALID_FROM_MISSING"));
const reversed = records([row("RM001", "ASM001", "2025-02-02", "2025-02-01")]); assert.ok(hasCode(Authority.validateDataset(reversed, employees), "HIERARCHY_V2_DATE_ORDER_INVALID"));
console.log("Sprint 2B direct hierarchy tests passed: temporal graph validation, roots, skip levels, history, cycles, resolution, and batch diagnostics.");
