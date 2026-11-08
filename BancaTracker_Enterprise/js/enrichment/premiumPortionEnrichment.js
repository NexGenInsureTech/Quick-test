(function (global) {
  "use strict";

  function dependencies() {
    const authority = global.BancaTrackerPremiumPortion;
    if (!authority || typeof authority.classifyPremiumPortion !== "function") {
      throw new Error("PREMIUM_PORTION_AUTHORITY_UNAVAILABLE");
    }
    const contract = authority.INITIAL_SUFFIX_CONTRACT;
    let probe;
    try {
      probe = authority.classifyPremiumPortion({ endorsementNumber: "BRI-PREFLIGHT-000", suffixContract: contract });
    } catch (error) {
      throw new Error("PREMIUM_PORTION_GOVERNANCE_INVALID");
    }
    if (!probe || probe.status !== "SUCCESS" || probe.classification !== "INITIAL_PORTION" ||
        probe.extractedSuffix !== "000" || probe.advanceSequence !== null || probe.portionOrdinal !== 1 ||
        !Array.isArray(probe.diagnosticCodes) || probe.diagnosticCodes.length) {
      throw new Error("PREMIUM_PORTION_GOVERNANCE_INVALID");
    }
    return { authority, contract };
  }

  function preflight() { dependencies(); return true; }

  function apply(record) {
    const source = record && typeof record === "object" ? record : {};
    const { endorsementNumberSourceValue, ...retained } = source;
    const header = source.endorsementNumberSourceHeader;
    const { authority, contract } = dependencies();
    const classified = header == null
      ? {
        status: "UNKNOWN", classification: "UNKNOWN", extractedSuffix: null,
        advanceSequence: null, portionOrdinal: null, diagnosticCodes: ["ENDORSEMENT_HEADER_MISSING"],
      }
      : authority.classifyPremiumPortion({ endorsementNumber: endorsementNumberSourceValue, suffixContract: contract });
    return {
      ...retained,
      endorsementNumberSourceHeader: header == null ? null : header,
      premiumPortionStatus: classified.status,
      premiumPortionClassification: classified.classification,
      premiumPortionExtractedSuffix: classified.extractedSuffix,
      premiumPortionAdvanceSequence: classified.advanceSequence,
      premiumPortionOrdinal: classified.portionOrdinal,
      premiumPortionDiagnosticCodes: classified.diagnosticCodes.slice(),
      premiumPortionSuffixContractVersion: contract.version,
    };
  }

  function summarize(records) {
    const summary = {
      rowCount: 0,
      rowsWithEndorsementHeader: 0,
      rowsWithEndorsementValue: 0,
      statusCounts: { SUCCESS: 0, UNKNOWN: 0, INVALID: 0 },
      classificationCounts: {},
      diagnosticCounts: {},
      suffixContractVersion: null,
    };
    (Array.isArray(records) ? records : []).forEach((record) => {
      summary.rowCount += 1;
      if (record.endorsementNumberSourceHeader != null) summary.rowsWithEndorsementHeader += 1;
      if (!(record.premiumPortionDiagnosticCodes || []).includes("ENDORSEMENT_NUMBER_MISSING") &&
          !(record.premiumPortionDiagnosticCodes || []).includes("ENDORSEMENT_HEADER_MISSING")) summary.rowsWithEndorsementValue += 1;
      const status = record.premiumPortionStatus || "UNKNOWN";
      summary.statusCounts[status] = (summary.statusCounts[status] || 0) + 1;
      const classification = record.premiumPortionClassification || "UNKNOWN";
      summary.classificationCounts[classification] = (summary.classificationCounts[classification] || 0) + 1;
      (record.premiumPortionDiagnosticCodes || []).forEach((code) => {
        summary.diagnosticCounts[code] = (summary.diagnosticCounts[code] || 0) + 1;
      });
      if (record.premiumPortionSuffixContractVersion) summary.suffixContractVersion = record.premiumPortionSuffixContractVersion;
    });
    return summary;
  }

  global.BancaTrackerPremiumPortionEnrichment = Object.freeze({ apply, summarize, preflight });
})(typeof window !== "undefined" ? window : globalThis);
