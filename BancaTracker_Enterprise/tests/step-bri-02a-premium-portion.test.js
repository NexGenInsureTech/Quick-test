const assert = require("assert");
const path = require("path");

global.window = global;
let networkCalls = 0;
global.fetch = () => { networkCalls += 1; throw new Error("Network access is forbidden in BRI-02A tests."); };
global.XMLHttpRequest = function XMLHttpRequest() { networkCalls += 1; throw new Error("Network access is forbidden in BRI-02A tests."); };
const globalsBeforeLoad = new Set(Object.getOwnPropertyNames(global));
require(path.join(__dirname, "..", "js/analytics/premiumPortion.js"));
const globalsAdded = Object.getOwnPropertyNames(global).filter((name) => !globalsBeforeLoad.has(name));
assert.deepStrictEqual(globalsAdded, ["BancaTrackerPremiumPortion"]);

const Authority = BancaTrackerPremiumPortion;
const initial = Authority.INITIAL_SUFFIX_CONTRACT;
const classify = (endorsementNumber, suffixContract = initial) => Authority.classifyPremiumPortion({ endorsementNumber, suffixContract });
const shape = ["status", "classification", "normalizedEndorsementNumber", "extractedSuffix", "advanceSequence", "portionOrdinal", "diagnosticCodes"];
const expectShape = (actual) => assert.deepStrictEqual(Object.keys(actual), shape);

const governed = [
  ["FICTIONAL-POLICY-000", "INITIAL_PORTION", null, 1, "000"],
  ["ALPHA-A01", "ADVANCE_PORTION", 1, 2, "A01"],
  ["BETA-A02", "ADVANCE_PORTION", 2, 3, "A02"],
  ["000000A03", "ADVANCE_PORTION", 3, 4, "A03"],
];
governed.forEach(([identifier, classification, sequence, ordinal, suffix]) => {
  const actual = classify(identifier);
  expectShape(actual);
  assert.deepStrictEqual(actual, {
    status: "SUCCESS", classification, normalizedEndorsementNumber: identifier, extractedSuffix: suffix,
    advanceSequence: sequence, portionOrdinal: ordinal, diagnosticCodes: [],
  });
});

const extended = {
  version: "TEST-EXTENSION-1",
  mappings: { ...initial.mappings, A09: { classification: "ADVANCE_PORTION", advanceSequence: 9, portionOrdinal: 10 } },
};
assert.deepStrictEqual(classify("FICTION-A09", extended), {
  status: "SUCCESS", classification: "ADVANCE_PORTION", normalizedEndorsementNumber: "FICTION-A09",
  extractedSuffix: "A09", advanceSequence: 9, portionOrdinal: 10, diagnosticCodes: [],
});
for (const suffix of ["A09", "A10", "A00", "A99"]) {
  const actual = classify(`FICTION-${suffix}`);
  assert.strictEqual(actual.status, "UNKNOWN"); assert.strictEqual(actual.classification, "UNKNOWN");
  assert.deepStrictEqual(actual.diagnosticCodes, ["ADVANCE_SUFFIX_NOT_GOVERNED"]);
  assert.strictEqual(actual.advanceSequence, null); assert.strictEqual(actual.portionOrdinal, null);
}

for (const value of [null, undefined, "", "   "]) {
  const actual = classify(value); expectShape(actual);
  assert.deepStrictEqual(actual, {
    status: "UNKNOWN", classification: "UNKNOWN", normalizedEndorsementNumber: null, extractedSuffix: null,
    advanceSequence: null, portionOrdinal: null, diagnosticCodes: ["ENDORSEMENT_NUMBER_MISSING"],
  });
}
for (const value of [123, [], {}, new Date(0), true, new String("FICTION-A01")]) {
  const actual = classify(value); expectShape(actual);
  assert.strictEqual(actual.status, "INVALID"); assert.strictEqual(actual.classification, "INVALID");
  assert.deepStrictEqual(actual.diagnosticCodes, ["ENDORSEMENT_NUMBER_TYPE_UNSUPPORTED"]);
  assert.strictEqual(actual.normalizedEndorsementNumber, null); assert.strictEqual(actual.extractedSuffix, null);
}
let actual = classify("A1");
assert.deepStrictEqual(actual.diagnosticCodes, ["ENDORSEMENT_NUMBER_TOO_SHORT"]); assert.strictEqual(actual.status, "INVALID");
actual = classify("  FICTION-A01  ");
assert.strictEqual(actual.normalizedEndorsementNumber, "FICTION-A01"); assert.strictEqual(actual.classification, "ADVANCE_PORTION");
for (const value of ["FICTION-a01", "FICTION-a02", "FICTION-Ab1", "FICTION-XYZ"]) {
  actual = classify(value); assert.strictEqual(actual.status, "UNKNOWN");
  assert.deepStrictEqual(actual.diagnosticCodes, ["ENDORSEMENT_SUFFIX_UNKNOWN"]);
}
actual = classify("FICTION\u0000A01");
assert.strictEqual(actual.status, "INVALID"); assert.deepStrictEqual(actual.diagnosticCodes, ["ENDORSEMENT_NUMBER_FORMAT_INVALID"]);
actual = classify("000000");
assert.strictEqual(actual.classification, "INITIAL_PORTION"); assert.strictEqual(actual.normalizedEndorsementNumber, "000000");

for (const [contract, diagnostic] of [
  [undefined, "SUFFIX_CONTRACT_MISSING"], [null, "SUFFIX_CONTRACT_MISSING"],
  [{}, "SUFFIX_CONTRACT_VERSION_INVALID"], [{ version: "V1" }, "SUFFIX_CONTRACT_INVALID"],
  [{ version: "V1", mappings: { A01: { classification: "ADVANCE_PORTION", advanceSequence: 1, portionOrdinal: null } } }, "SUFFIX_CONTRACT_INVALID"],
]) {
  actual = Authority.classifyPremiumPortion({ endorsementNumber: "FICTION-A01", suffixContract: contract });
  expectShape(actual); assert.strictEqual(actual.status, "INVALID"); assert.deepStrictEqual(actual.diagnosticCodes, [diagnostic]);
}

const input = { endorsementNumber: "FICTION-A01", suffixContract: extended, premium: -999, businessType: "Renewal", policyIssuedDate: "2026-04-01" };
const inputBefore = JSON.stringify(input); const contractBefore = JSON.stringify(extended);
const first = Authority.classifyPremiumPortion(input); const second = Authority.classifyPremiumPortion(input);
assert.strictEqual(JSON.stringify(first), JSON.stringify(second));
assert.strictEqual(JSON.stringify(input), inputBefore); assert.strictEqual(JSON.stringify(extended), contractBefore);
assert.strictEqual(first.classification, "ADVANCE_PORTION");
for (const forbidden of ["premium", "businessType", "renewal", "renewalEligible", "cashCollected", "financialYear", "policyCount", "policyId", "customerId"]) {
  assert.strictEqual(Object.prototype.hasOwnProperty.call(first, forbidden), false);
}
assert.strictEqual(networkCalls, 0);
assert.ok(Object.isFrozen(Authority)); assert.ok(Object.isFrozen(initial)); assert.ok(Object.isFrozen(initial.mappings));
Object.values(initial.mappings).forEach((mapping) => assert.ok(Object.isFrozen(mapping)));

const expectInvalidContract = (suffixContract) => {
  const result = Authority.classifyPremiumPortion({ endorsementNumber: "SYNTHETIC-A09", suffixContract });
  expectShape(result); assert.strictEqual(result.status, "INVALID"); assert.strictEqual(result.classification, "INVALID");
  assert.deepStrictEqual(result.diagnosticCodes, ["SUFFIX_CONTRACT_INVALID"]);
  return result;
};
const advanceContract = (suffix, advanceSequence, portionOrdinal) => ({
  version: "R1-TEST-1", mappings: { [suffix]: { classification: "ADVANCE_PORTION", advanceSequence, portionOrdinal } },
});
for (const contract of [
  advanceContract("A09", 9, 2), advanceContract("A01", 1, 1), advanceContract("A03", 3, 3),
  advanceContract("A09", 8, 9), advanceContract("A02", 3, 4),
]) expectInvalidContract(contract);

const ownA09 = { A09: { classification: "ADVANCE_PORTION", advanceSequence: 9, portionOrdinal: 10 } };
const inheritedVersion = Object.create({ version: "INHERITED" }); inheritedVersion.mappings = ownA09;
actual = Authority.classifyPremiumPortion({ endorsementNumber: "SYNTHETIC-A09", suffixContract: inheritedVersion });
assert.strictEqual(actual.status, "INVALID"); assert.deepStrictEqual(actual.diagnosticCodes, ["SUFFIX_CONTRACT_VERSION_INVALID"]);
const inheritedMappings = Object.create({ mappings: ownA09 }); inheritedMappings.version = "R1-TEST-2";
expectInvalidContract(inheritedMappings);
const inheritedBoth = Object.create({ version: "INHERITED", mappings: ownA09 });
actual = Authority.classifyPremiumPortion({ endorsementNumber: "SYNTHETIC-A09", suffixContract: inheritedBoth });
assert.strictEqual(actual.status, "INVALID"); assert.deepStrictEqual(actual.diagnosticCodes, ["SUFFIX_CONTRACT_VERSION_INVALID"]);

const mappingWithInheritedField = (field) => {
  const inherited = { classification: "ADVANCE_PORTION", advanceSequence: 9, portionOrdinal: 10 };
  const mapping = Object.create(field === "all" ? inherited : { [field]: inherited[field] });
  if (field !== "classification" && field !== "all") mapping.classification = inherited.classification;
  if (field !== "advanceSequence" && field !== "all") mapping.advanceSequence = inherited.advanceSequence;
  if (field !== "portionOrdinal" && field !== "all") mapping.portionOrdinal = inherited.portionOrdinal;
  return { version: "R1-TEST-3", mappings: { A09: mapping } };
};
for (const field of ["classification", "advanceSequence", "portionOrdinal", "all"]) expectInvalidContract(mappingWithInheritedField(field));

let getterCalls = 0;
const getter = () => { getterCalls += 1; return "MUST_NOT_BE_READ"; };
const accessorVersion = { mappings: ownA09 }; Object.defineProperty(accessorVersion, "version", { enumerable: true, get: getter });
actual = Authority.classifyPremiumPortion({ endorsementNumber: "SYNTHETIC-A09", suffixContract: accessorVersion });
assert.strictEqual(actual.status, "INVALID"); assert.deepStrictEqual(actual.diagnosticCodes, ["SUFFIX_CONTRACT_VERSION_INVALID"]);
const accessorMappings = { version: "R1-TEST-4" }; Object.defineProperty(accessorMappings, "mappings", { enumerable: true, get: getter });
expectInvalidContract(accessorMappings);
for (const field of ["classification", "advanceSequence", "portionOrdinal"]) {
  const mapping = { classification: "ADVANCE_PORTION", advanceSequence: 9, portionOrdinal: 10 };
  Object.defineProperty(mapping, field, { enumerable: true, get: getter });
  expectInvalidContract({ version: "R1-TEST-5", mappings: { A09: mapping } });
}
const accessorEntry = {}; Object.defineProperty(accessorEntry, "A09", { enumerable: true, get: getter });
expectInvalidContract({ version: "R1-TEST-6", mappings: accessorEntry });
assert.strictEqual(getterCalls, 0);

const inheritedSuffixes = Object.create(ownA09);
actual = Authority.classifyPremiumPortion({ endorsementNumber: "SYNTHETIC-A09", suffixContract: { version: "R1-TEST-7", mappings: inheritedSuffixes } });
assert.strictEqual(actual.status, "UNKNOWN"); assert.deepStrictEqual(actual.diagnosticCodes, ["ADVANCE_SUFFIX_NOT_GOVERNED"]);
const nullContract = Object.create(null); const nullMappings = Object.create(null); const nullMapping = Object.create(null);
nullMapping.classification = "ADVANCE_PORTION"; nullMapping.advanceSequence = 9; nullMapping.portionOrdinal = 10;
nullMappings.A09 = nullMapping; nullContract.version = "R1-NULL-1"; nullContract.mappings = nullMappings;
assert.strictEqual(Authority.classifyPremiumPortion({ endorsementNumber: "SYNTHETIC-A09", suffixContract: nullContract }).status, "SUCCESS");
assert.strictEqual(Object.getPrototypeOf(nullContract), null); assert.strictEqual(Object.getPrototypeOf(nullMappings), null); assert.strictEqual(Object.getPrototypeOf(nullMapping), null);

console.log("BRI-02A premium-portion tests passed: governed allowlist, explicit extension, stable diagnostics, formatting boundaries, immutability, determinism, and business separation.");
