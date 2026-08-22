const RecommendationEngine = {
  recommend({ profile } = {}) {
    const failure = (code, message) => ({
      ok: false,
      error: {
        code,
        message,
        input: {
          profile
        }
      }
    });

    const profileExists =
      typeof profile === "string" &&
      customerProfiles.some(item => item.id === profile);

    if (!profileExists) {
      return failure(
        "INVALID_PROFILE",
        "The selected customer profile is not supported."
      );
    }

    const rule = recommendationRules[profile];

    if (!rule) {
      return failure(
        "RECOMMENDATION_NOT_CONFIGURED",
        "No guided recommendation is configured for this profile."
      );
    }

    const planExists = plans.some(
      item => item.code === rule.plan
    );

    if (!planExists) {
      return failure(
        "INVALID_RECOMMENDED_PLAN",
        "The configured recommendation references an unsupported Plan."
      );
    }

    if (!sumInsuredOptions.includes(rule.sumInsured)) {
      return failure(
        "INVALID_RECOMMENDED_SUM_INSURED",
        "The configured recommendation references an unsupported Sum Insured."
      );
    }

    return {
      ok: true,
      ruleId: rule.ruleId,
      recommendation: {
        plan: rule.plan,
        sumInsured: rule.sumInsured
      }
    };
  }
};
