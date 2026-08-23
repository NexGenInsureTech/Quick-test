const ProductRules = (() => {
  const addonRules = {
    // PED, Maternity, and Non-Medical Items are available outside Basic,
    // but their online pricing basis is not authoritatively resolved.
    pedWaiver: {
      addonId: "pedWaiver",
      allowedPlans: ["silver", "gold", "diamond"],
      target: "UNRESOLVED",
      pricingStatus: "BLOCKED_PRICING_BASIS",
      underwritingStatus: "REQUIRED",
      quoteDecision: "ASSISTED_ONLY",
      decisionReasonCode: "ASSISTED_PED_WAIVER",
      waitingPeriodFromMonths: 36,
      waitingPeriodToMonths: 12
    },
    // Diabetes and Hypertension are Diamond-only benefits for insured
    // members aged 18+. Source rate rows do not override this eligibility.
    diabetesDay1: {
      addonId: "diabetesDay1",
      allowedPlans: ["diamond"],
      minimumAge: 18,
      target: "MEMBER",
      pricingStatus: "READY",
      underwritingStatus: "REQUIRED",
      quoteDecision: "UW_REFERRAL",
      decisionReasonCode: "UW_DIABETES_DAY1"
    },
    hypertensionDay1: {
      addonId: "hypertensionDay1",
      allowedPlans: ["diamond"],
      minimumAge: 18,
      target: "MEMBER",
      pricingStatus: "READY",
      underwritingStatus: "REQUIRED",
      quoteDecision: "UW_REFERRAL",
      decisionReasonCode: "UW_HYPERTENSION_DAY1"
    },
    nonMedicalItems: {
      addonId: "nonMedicalItems",
      allowedPlans: ["silver", "gold", "diamond"],
      target: "UNRESOLVED",
      pricingStatus: "BLOCKED_PRICING_BASIS",
      underwritingStatus: "NOT_MODELED",
      quoteDecision: "ASSISTED_ONLY",
      decisionReasonCode: "ASSISTED_NON_MEDICAL_ITEMS"
    },
    maternity: {
      addonId: "maternity",
      allowedPlans: ["silver", "gold", "diamond"],
      target: "UNRESOLVED",
      pricingStatus: "BLOCKED_PRICING_BASIS",
      underwritingStatus: "NOT_MODELED",
      quoteDecision: "ASSISTED_ONLY",
      decisionReasonCode: "ASSISTED_MATERNITY"
    },
    // Room Rent Modification is a policy-level option with no premium
    // impact under each currently supported plan.
    roomRentModification: {
      addonId: "roomRentModification",
      allowedPlans: ["silver", "gold", "diamond"],
      target: "POLICY",
      pricingStatus: "READY",
      underwritingStatus: "NONE_IDENTIFIED",
      quoteDecision: "STP",
      pricingType: "NO_PREMIUM_IMPACT",
      additionalPremium: 0
    }
  };

  function cloneRule(rule) {
    if (!rule) return null;

    return Object.freeze({
      ...rule,
      allowedPlans: Object.freeze([...rule.allowedPlans])
    });
  }

  function getAddonRule(addonId) {
    return cloneRule(addonRules[addonId]);
  }

  function isAddonEligible({ addonId, plan, member } = {}) {
    const rule = addonRules[addonId];

    if (!rule) {
      return { eligible: false, reason: "INVALID_ADDON" };
    }

    if (!rule.allowedPlans.includes(plan)) {
      return { eligible: false, reason: "PLAN_NOT_ELIGIBLE" };
    }

    if (rule.pricingStatus !== "READY") {
      return { eligible: false, reason: rule.pricingStatus };
    }

    if (
      rule.target === "MEMBER" &&
      (!member || typeof member.ageBand !== "string" || !member.ageBand)
    ) {
      return { eligible: false, reason: "MEMBER_AGE_REQUIRED" };
    }

    if (
      rule.target === "MEMBER" &&
      rule.minimumAge === 18 &&
      member.ageBand === "0-17"
    ) {
      return { eligible: false, reason: "AGE_NOT_ELIGIBLE" };
    }

    return { eligible: true, reason: null };
  }

  return Object.freeze({
    getAddonRule,
    isAddonEligible
  });
})();
