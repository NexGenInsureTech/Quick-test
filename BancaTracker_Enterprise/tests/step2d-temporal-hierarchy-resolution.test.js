/* Sprint 2D: Temporal direct hierarchy resolution and rollup context. */
"use strict";
const assert = require("assert"); const path = require("path"); global.window = global;
const load = (file) => require(path.join(__dirname, "..", file));
["js/data/schema.js", "js/data/datasetRegistry.js", "js/masters/directReportingHierarchy.js", "js/enrichment/directHierarchyResolver.js"].forEach(load);
const Authority = BancaTrackerDirectReportingHierarchy; const Resolver = BancaTrackerDirectHierarchyResolver; const Contract = BancaTrackerDatasetRegistry.HIERARCHY_DATA_CONTRACT;
const employee = (employeeId, designation = "Employee", overrides = {}) => ({ employeeId, employeeName: employeeId, designation, employmentStatus: "ACTIVE", dateOfJoining: "2020-01-01", exitDate: null, ...overrides });
const row = (employeeId, managerEmployeeId, validFrom = "2025-01-01", validTo = "") => ({ "EMPLOYEE ID": employeeId, "MANAGER EMPLOYEE ID": managerEmployeeId || "", "VALID FROM": validFrom, "VALID TO": validTo });
const prepared = (rows, employees) => Authority.prepareDataset(rows, "HIERARCHY:2D", employees).records;
const employeeContext = (records) => ({ status: "READY", records });
const hierarchyContext = (records) => ({ status: "READY", contract: { sourceProfile: Contract.PROFILES.DIRECT_REPORTING_V2 }, records });

let employees = [employee("RM001", "RM"), employee("ASM001", "ASM"), employee("NH001", "National Head")];
let relationships = prepared([row("RM001", "ASM001"), row("ASM001", "NH001"), row("NH001", null)], employees);
let context = Resolver.createContext(employeeContext(employees), hierarchyContext(relationships), "2025-08-31");
let result = Resolver.resolveEmployee("RM001", context);
assert.deepStrictEqual({ status: context.status, direct: result.directManagerId, ancestors: Resolver.getAncestors("RM001", context), depth: result.reportingDepth, root: result.rootEmployeeId }, { status: "READY", direct: "ASM001", ancestors: ["ASM001", "NH001"], depth: 2, root: "NH001" });
assert.deepStrictEqual(Resolver.resolveEmployee("NH001", context), { status: "EXPLICIT_ROOT", employeeId: "NH001", asOfDate: "2025-08-31", directManagerId: null, reportingChain: [], reportingDepth: 0, rootEmployeeId: "NH001", isRoot: true, diagnostics: [] });
const persistedHierarchy = Authority.adaptPersistedDataset({ datasetId: "HIERARCHY:2", metadata: { dataContract: { name: Contract.NAME, version: 2, sourceProfile: Contract.PROFILES.DIRECT_REPORTING_V2 } } }, relationships.map(Authority.toPersistedRecord));
assert.strictEqual(Resolver.getManager("RM001", Resolver.createContext(employeeContext(employees), persistedHierarchy, "2025-08-31")), "ASM001", "Persisted v2 records must rehydrate runtime date validity without mutation.");

employees = [employee("NH001", "National Head"), employee("RM002", "RM"), employee("EXEC001", "Executive"), employee("ASM001", "ASM"), employee("COORD001", "Coordinator")];
relationships = prepared([row("NH001", null), row("RM002", "NH001"), row("EXEC001", "NH001"), row("ASM001", "NH001"), row("COORD001", "ASM001")], employees);
context = Resolver.createContext(employeeContext(employees), hierarchyContext(relationships), "2025-08-31");
assert.deepStrictEqual(context.roots, ["NH001"]); assert.deepStrictEqual(Resolver.getDirectReports("NH001", context), ["ASM001", "EXEC001", "RM002"]);
assert.deepStrictEqual(Resolver.getDescendants("NH001", context), ["ASM001", "EXEC001", "RM002", "COORD001"]);
assert.deepStrictEqual(Resolver.getRollupMembers("NH001", context), ["ASM001", "EXEC001", "RM002", "COORD001"]);
assert.deepStrictEqual(Resolver.getRollupMembers("NH001", context, { includeSelf: true }), ["NH001", "ASM001", "EXEC001", "RM002", "COORD001"]);
assert.strictEqual(Resolver.resolveEmployee("RM002", context).status, "RESOLVED", "Skip-level RM → NH is valid.");
assert.strictEqual(Resolver.resolveEmployee("EXEC001", context).status, "RESOLVED", "Arbitrary designation relationships remain valid.");

employees = [employee("ROOT1"), employee("ROOT2")]; relationships = prepared([row("ROOT1", null), row("ROOT2", null)], employees);
context = Resolver.createContext(employeeContext(employees), hierarchyContext(relationships), "2025-08-31");
assert.strictEqual(context.status, "READY"); assert.deepStrictEqual(context.roots, ["ROOT1", "ROOT2"]); assert.ok(context.diagnostics.includes("HIERARCHY_V2_MULTIPLE_ROOTS")); assert.strictEqual(context.graph.componentCount, 2);

employees = [employee("E1"), employee("E2"), employee("ROOT")]; relationships = prepared([row("E1", "ROOT"), row("ROOT", null)], employees);
context = Resolver.createContext(employeeContext(employees), hierarchyContext(relationships), "2025-08-31");
assert.strictEqual(context.status, "READY_PARTIAL"); assert.strictEqual(Resolver.resolveEmployee("E2", context).status, "NO_RELATIONSHIP"); assert.strictEqual(Resolver.resolveEmployee("E2", context).isRoot, false); assert.strictEqual(context.coverage.noRelationship, 1);

employees = [employee("E1"), employee("M1")]; relationships = prepared([row("E1", "M1")], employees);
context = Resolver.createContext(employeeContext(employees), hierarchyContext(relationships), "2025-08-31");
assert.strictEqual(Resolver.resolveEmployee("E1", context).status, "CHAIN_INCOMPLETE"); assert.strictEqual(Resolver.resolveEmployee("E1", context).rootEmployeeId, null); assert.strictEqual(context.status, "READY_PARTIAL");

employees = [employee("RM001"), employee("CSM001"), employee("ZSM002"), employee("ROOT")];
relationships = prepared([row("RM001", "CSM001", "2025-04-01", "2025-09-30"), row("RM001", "ZSM002", "2025-10-01"), row("CSM001", "ROOT", "2025-01-01"), row("ZSM002", "ROOT", "2025-01-01"), row("ROOT", null, "2025-01-01")], employees);
const august = Resolver.createContext(employeeContext(employees), hierarchyContext(relationships), "2025-08-31");
const january = Resolver.createContext(employeeContext(employees), hierarchyContext(relationships), "2026-01-31");
assert.strictEqual(Resolver.getManager("RM001", august), "CSM001"); assert.strictEqual(Resolver.getManager("RM001", january), "ZSM002");
assert.deepStrictEqual(Resolver.getDirectReports("CSM001", august), ["RM001"]); assert.deepStrictEqual(Resolver.getDirectReports("CSM001", january), []);
assert.deepStrictEqual(Resolver.getDescendants("CSM001", august), ["RM001"]); assert.deepStrictEqual(Resolver.getDescendants("ZSM002", january), ["RM001"]);

const untouched = JSON.stringify(relationships); Resolver.createContext(employeeContext(employees), hierarchyContext(relationships), "2025-08-31"); assert.strictEqual(JSON.stringify(relationships), untouched, "Temporal contexts must not mutate persisted/canonical relationships.");
assert.strictEqual(Resolver.createContext(employeeContext(employees), hierarchyContext(relationships), "").status, "INVALID_AS_OF_DATE");
assert.strictEqual(Resolver.createContext(employeeContext(employees), hierarchyContext(relationships), "31/08/2025").status, "INVALID_AS_OF_DATE");
assert.strictEqual(Resolver.createContext(employeeContext(employees), { status: "ABSENT", records: [] }, "2025-08-31").status, "HIERARCHY_ABSENT");
assert.strictEqual(Resolver.createContext(employeeContext(employees), { status: "LEGACY_COMPATIBILITY", records: [] }, "2025-08-31").status, "LEGACY_COMPATIBILITY");
assert.strictEqual(Resolver.createContext(employeeContext(employees), { status: "UNSUPPORTED_CONTRACT", records: [] }, "2025-08-31").status, "UNSUPPORTED_CONTRACT");

employees = [employee("E1", "Employee", { dateOfJoining: "2025-09-01" }), employee("ROOT")]; relationships = prepared([row("E1", "ROOT", "2025-09-01"), row("ROOT", null, "2025-01-01")], employees);
context = Resolver.createContext(employeeContext(employees), hierarchyContext(relationships), "2025-08-31");
assert.strictEqual(Resolver.resolveEmployee("E1", context).status, "NOT_EFFECTIVE"); assert.strictEqual(context.status, "READY_PARTIAL");
employees = [employee("E1", "Employee", { employmentStatus: "EXITED", exitDate: "2025-06-30" }), employee("ROOT")]; relationships = prepared([row("E1", "ROOT", "2025-01-01", "2025-06-30"), row("ROOT", null)], employees);
assert.strictEqual(Resolver.resolveEmployee("E1", Resolver.createContext(employeeContext(employees), hierarchyContext(relationships), "2025-06-30")).status, "RESOLVED");
assert.strictEqual(Resolver.resolveEmployee("E1", Resolver.createContext(employeeContext(employees), hierarchyContext(relationships), "2025-08-31")).status, "NOT_EFFECTIVE");
console.log("Sprint 2D temporal hierarchy tests passed: as-of contexts, dynamic ancestry, reverse traversal, rollups, history, coverage, and legacy isolation.");
