const QuoteDecisionEngine = (() => {
  const precedence = {
    STP: 1,
    UW_REFERRAL: 2,
    ASSISTED_ONLY: 3
  };

  function failure(code, message) {
    return {
      ok: false,
      error: {
        code,
        message
      }
    };
  }

  function isCompleteQuote(quote) {
    return Boolean(
      quote &&
      quote.ok === true &&
      quote.status === "FINAL_READY" &&
      typeof quote.finalPremium === "number" &&
      Number.isFinite(quote.finalPremium) &&
      quote.finalPremium >= 0
    );
  }

  function evaluate({ quote, selectedAddons } = {}) {
    if (!Array.isArray(selectedAddons)) {
      return failure(
        "INVALID_ADDON_SELECTIONS",
        "Selected add-ons must be supplied as an array."
      );
    }

    const reasons = [];
    const reasonCodes = new Set();
    let decision = "STP";

    for (const selection of selectedAddons) {
      if (
        !selection ||
        typeof selection !== "object" ||
        Array.isArray(selection) ||
        typeof selection.addonId !== "string" ||
        !selection.addonId.trim()
      ) {
        return failure(
          "INVALID_ADDON_SELECTIONS",
          "Each selected add-on must contain a valid add-on ID."
        );
      }

      const rule = ProductRules.getAddonRule(
        selection.addonId
      );

      if (
        !rule ||
        !Object.prototype.hasOwnProperty.call(
          precedence,
          rule.quoteDecision
        ) ||
        typeof rule.underwritingStatus !== "string"
      ) {
        return failure(
          "INVALID_PRODUCT_RULE",
          "A selected add-on does not have a valid product decision rule."
        );
      }

      if (
        precedence[rule.quoteDecision] >
        precedence[decision]
      ) {
        decision = rule.quoteDecision;
      }

      if (
        rule.decisionReasonCode &&
        !reasonCodes.has(rule.decisionReasonCode)
      ) {
        reasonCodes.add(rule.decisionReasonCode);
        reasons.push(Object.freeze({
          code: rule.decisionReasonCode
        }));
      }
    }

    if (decision !== "ASSISTED_ONLY" && !isCompleteQuote(quote)) {
      return failure(
        "INVALID_QUOTE",
        "A complete calculated quote is required for this decision."
      );
    }

    if (
      decision === "ASSISTED_ONLY" &&
      quote !== null &&
      quote !== undefined &&
      !isCompleteQuote(quote)
    ) {
      return failure(
        "INVALID_QUOTE",
        "The supplied calculated quote is malformed."
      );
    }

    return Object.freeze({
      ok: true,
      calculationStatus:
        decision === "ASSISTED_ONLY"
          ? "INCOMPLETE"
          : "COMPLETE",
      decision,
      premiumStatus:
        decision === "ASSISTED_ONLY"
          ? "UNAVAILABLE"
          : "INDICATIVE",
      paymentReady: false,
      reasons: Object.freeze(reasons)
    });
  }

  return Object.freeze({
    evaluate
  });
})();
