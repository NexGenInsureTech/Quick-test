/* Sprint 1B: Employee Master v2 normalization and compatibility authority. */
"use strict";

const assert = require("assert");
const path = require("path");
global.window = global;
require(path.join(__dirname, "..", "js/data/schema.js"));
require(path.join(__dirname, "..", "js/data/datasetRegistry.js"));
require(path.join(__dirname, "..", "js/masters/employeeMaster.js"));

const Master = BancaTrackerEmployeeMaster;
const hasCode = (result, code) => result.findings.some((finding) => finding.code === code);
const native = (overrides = {}) => ({
  "EMPLOYEE ID": "  00017 ", "EMPLOYEE NAME": "  Asha   Devi ", DESIGNATION: "USM", GRADE: "G5", BAND: "B",
  "EMPLOYMENT TYPE": "Regular", FUNCTION: "Sales", CHANNEL: "Bancassurance", "BASE LOCATION": "Guwahati",
  "DATE OF JOINING": "2020-01-15", "CHANNEL JOIN DATE": "2021-04-01", "DESIGNATION EFFECTIVE DATE": "2023-06-01", "EMPLOYMENT STATUS": "ACTIVE", ...overrides,
});

const validNative = Master.prepareDataset([native()], "EMPLOYEE_MASTER:1B", { asOfDate: "2026-01-01" });
assert.strictEqual(validNative.valid, true);
assert.deepStrictEqual(validNative.records[0].employeeId, "00017");
assert.deepStrictEqual(validNative.records[0].employeeName, "Asha Devi");
assert.deepStrictEqual(validNative.records[0].designation, "USM");
assert.deepStrictEqual(validNative.records[0].employmentStatus, "ACTIVE");
assert.deepStrictEqual(validNative.records[0].active, true);
assert.strictEqual(validNative.records[0].role, null, "Designation must not infer a legacy hierarchy role.");

const mt = Master.prepareDataset([native({ DESIGNATION: "MT" })], "EMPLOYEE_MASTER:1B");
assert.strictEqual(mt.valid, true, "Free-form MT designation must be accepted.");
assert.strictEqual(mt.records[0].role, null);

const legacy = Master.prepareDataset([{ "EMPLOYEE ID": "RM001", "EMPLOYEE NAME": "RM One", ROLE: "RM", ACTIVE: "TRUE" }], "EMPLOYEE_MASTER:1B");
assert.strictEqual(legacy.valid, true);
assert.strictEqual(legacy.records[0].designation, "RM");
assert.strictEqual(legacy.records[0].employmentStatus, "ACTIVE");
assert.strictEqual(legacy.records[0].role, "RM");
assert.ok(hasCode(legacy, "EMPLOYEE_LEGACY_ROLE_USED"));
assert.ok(hasCode(legacy, "EMPLOYEE_LEGACY_ACTIVE_USED"));

const duplicate = Master.prepareDataset([native(), native({ "EMPLOYEE ID": "00017", "EMPLOYEE NAME": "Duplicate" })], "EMPLOYEE_MASTER:1B");
assert.strictEqual(duplicate.valid, false);
assert.ok(hasCode(duplicate, "EMPLOYEE_DUPLICATE_ID"));
assert.ok(hasCode(duplicate, "EMPLOYEE_DUPLICATE_ACTIVE_RECORD"));

const missingIdentity = Master.prepareDataset([native({ "EMPLOYEE ID": "" })], "EMPLOYEE_MASTER:1B");
assert.strictEqual(missingIdentity.valid, false);
assert.ok(hasCode(missingIdentity, "EMPLOYEE_ID_MISSING"));

const malformedDate = Master.prepareDataset([native({ "DATE OF JOINING": "15/01/2020" })], "EMPLOYEE_MASTER:1B");
assert.strictEqual(malformedDate.valid, false);
assert.ok(hasCode(malformedDate, "EMPLOYEE_DATE_INVALID"));

const invalidOrder = Master.prepareDataset([native({ "CHANNEL JOIN DATE": "2019-12-31" })], "EMPLOYEE_MASTER:1B");
assert.strictEqual(invalidOrder.valid, false);
assert.ok(hasCode(invalidOrder, "EMPLOYEE_DATE_ORDER_INVALID"));

const contradictory = Master.prepareDataset([native({ ACTIVE: "FALSE", "EXIT DATE": "2025-01-01" })], "EMPLOYEE_MASTER:1B", { asOfDate: "2026-01-01" });
assert.strictEqual(contradictory.valid, false);
assert.ok(hasCode(contradictory, "EMPLOYEE_STATUS_ACTIVE_CONFLICT"));
assert.ok(hasCode(contradictory, "EMPLOYEE_STATUS_DATE_CONFLICT"));

const exited = Master.prepareDataset([native({ "EMPLOYEE ID": "00018", "EMPLOYMENT STATUS": "EXITED", "EXIT DATE": "2025-01-01" })], "EMPLOYEE_MASTER:1B", { asOfDate: "2026-01-01" });
assert.strictEqual(exited.valid, true);
assert.strictEqual(exited.records[0].active, false);

console.log("Sprint 1B Employee Master v2 tests passed: native fields, free-form designations, legacy compatibility, identity, dates, employment state, and no hierarchy inference.");
