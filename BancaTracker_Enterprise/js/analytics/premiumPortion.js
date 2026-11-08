(function (global) {
  "use strict";

  const INITIAL_SUFFIX_CONTRACT = Object.freeze({
    version: "BRI-02A-1",
    mappings: Object.freeze({
      "000": Object.freeze({ classification: "INITIAL_PORTION", advanceSequence: null, portionOrdinal: 1 }),
      A01: Object.freeze({ classification: "ADVANCE_PORTION", advanceSequence: 1, portionOrdinal: 2 }),
      A02: Object.freeze({ classification: "ADVANCE_PORTION", advanceSequence: 2, portionOrdinal: 3 }),
      A03: Object.freeze({ classification: "ADVANCE_PORTION", advanceSequence: 3, portionOrdinal: 4 }),
    }),
  });

  function result(status, classification, values, diagnosticCodes) {
    return {
      status,
      classification,
      normalizedEndorsementNumber: values.normalizedEndorsementNumber || null,
      extractedSuffix: values.extractedSuffix || null,
      advanceSequence: Number.isInteger(values.advanceSequence) ? values.advanceSequence : null,
      portionOrdinal: Number.isInteger(values.portionOrdinal) ? values.portionOrdinal : null,
      diagnosticCodes: [...new Set(diagnosticCodes)],
    };
  }

  function ownDataDescriptor(object, field) {
    if (!object || (typeof object !== "object" && typeof object !== "function")) return null;
    const descriptor = Object.getOwnPropertyDescriptor(object, field);
    return descriptor && Object.prototype.hasOwnProperty.call(descriptor, "value") ? descriptor : null;
  }

  function validateContract(contract) {
    if (contract === null || typeof contract === "undefined") return "SUFFIX_CONTRACT_MISSING";
    if (!contract || typeof contract !== "object" || Array.isArray(contract)) return "SUFFIX_CONTRACT_INVALID";
    const versionDescriptor = ownDataDescriptor(contract, "version");
    if (!versionDescriptor || typeof versionDescriptor.value !== "string" || !versionDescriptor.value.trim()) return "SUFFIX_CONTRACT_VERSION_INVALID";
    const mappingsDescriptor = ownDataDescriptor(contract, "mappings");
    const mappings = mappingsDescriptor && mappingsDescriptor.value;
    if (!mappings || typeof mappings !== "object" || Array.isArray(mappings)) return "SUFFIX_CONTRACT_INVALID";
    for (const suffix of Reflect.ownKeys(mappings)) {
      if (typeof suffix !== "string" || suffix.length !== 3) return "SUFFIX_CONTRACT_INVALID";
      const mappingDescriptor = ownDataDescriptor(mappings, suffix);
      const mapping = mappingDescriptor && mappingDescriptor.value;
      if (!mapping || typeof mapping !== "object" || Array.isArray(mapping)) return "SUFFIX_CONTRACT_INVALID";
      const classificationDescriptor = ownDataDescriptor(mapping, "classification");
      const sequenceDescriptor = ownDataDescriptor(mapping, "advanceSequence");
      const ordinalDescriptor = ownDataDescriptor(mapping, "portionOrdinal");
      if (!classificationDescriptor || !sequenceDescriptor || !ordinalDescriptor) return "SUFFIX_CONTRACT_INVALID";
      const classification = classificationDescriptor.value;
      const advanceSequence = sequenceDescriptor.value;
      const portionOrdinal = ordinalDescriptor.value;
      if (classification === "INITIAL_PORTION") {
        if (suffix !== "000" || advanceSequence !== null || portionOrdinal !== 1) return "SUFFIX_CONTRACT_INVALID";
      } else if (classification === "ADVANCE_PORTION") {
        if (!/^A\d{2}$/.test(suffix) || !Number.isInteger(advanceSequence) || advanceSequence < 1 ||
            advanceSequence !== Number(suffix.slice(1)) || portionOrdinal !== advanceSequence + 1) return "SUFFIX_CONTRACT_INVALID";
      } else return "SUFFIX_CONTRACT_INVALID";
    }
    return null;
  }

  function classifyPremiumPortion(input) {
    const source = input && typeof input === "object" ? input : {};
    const endorsementNumber = source.endorsementNumber;
    const empty = {};
    if (endorsementNumber === null || typeof endorsementNumber === "undefined" ||
        (typeof endorsementNumber === "string" && endorsementNumber.trim() === "")) {
      return result("UNKNOWN", "UNKNOWN", empty, ["ENDORSEMENT_NUMBER_MISSING"]);
    }
    if (typeof endorsementNumber !== "string") {
      return result("INVALID", "INVALID", empty, ["ENDORSEMENT_NUMBER_TYPE_UNSUPPORTED"]);
    }

    const normalized = endorsementNumber.trim();
    if (normalized.length < 3) {
      return result("INVALID", "INVALID", { normalizedEndorsementNumber: normalized }, ["ENDORSEMENT_NUMBER_TOO_SHORT"]);
    }
    if (/[\u0000-\u001f\u007f]/.test(normalized)) {
      return result("INVALID", "INVALID", empty, ["ENDORSEMENT_NUMBER_FORMAT_INVALID"]);
    }

    const suffix = normalized.slice(-3);
    const values = { normalizedEndorsementNumber: normalized, extractedSuffix: suffix };
    const contractError = validateContract(source.suffixContract);
    if (contractError) return result("INVALID", "INVALID", values, [contractError]);

    const mappings = Object.getOwnPropertyDescriptor(source.suffixContract, "mappings").value;
    const mappingDescriptor = ownDataDescriptor(mappings, suffix);
    const mapping = mappingDescriptor ? mappingDescriptor.value : null;
    if (!mapping) {
      const diagnostic = /^A\d{2}$/.test(suffix) ? "ADVANCE_SUFFIX_NOT_GOVERNED" : "ENDORSEMENT_SUFFIX_UNKNOWN";
      return result("UNKNOWN", "UNKNOWN", values, [diagnostic]);
    }
    return result("SUCCESS", mapping.classification, {
      ...values,
      advanceSequence: mapping.advanceSequence,
      portionOrdinal: mapping.portionOrdinal,
    }, []);
  }

  global.BancaTrackerPremiumPortion = Object.freeze({ INITIAL_SUFFIX_CONTRACT, classifyPremiumPortion });
})(typeof window !== "undefined" ? window : globalThis);
