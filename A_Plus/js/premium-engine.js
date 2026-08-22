const PremiumEngine = {

  getMemberPremium({
    zone,
    plan,
    memberType,
    ageBand,
    sumInsured
  } = {}) {

    const input = {
      zone,
      plan,
      memberType,
      ageBand,
      sumInsured
    };

    const hasKey = (object, key) =>
      Object.prototype.hasOwnProperty.call(
        object,
        key
      );

    const failure = (code, message) => ({
      ok: false,
      error: {
        code,
        message,
        input
      }
    });

    if (!hasKey(premiumRates, zone)) {
      return failure(
        "INVALID_ZONE",
        "The selected zone is not supported."
      );
    }

    if (!hasKey(premiumRates[zone], plan)) {
      return failure(
        "INVALID_PLAN",
        "The selected plan is not supported."
      );
    }

    if (!hasKey(
      premiumRates[zone][plan],
      memberType
    )) {
      return failure(
        "INVALID_MEMBER_TYPE",
        "The member type is not supported."
      );
    }

    const memberRates =
      premiumRates[zone][plan][memberType];

    if (!hasKey(memberRates, ageBand)) {
      return failure(
        "INVALID_AGE_BAND",
        "The age band is not supported for this member type."
      );
    }

    if (
      typeof sumInsured !== "number" ||
      !Number.isFinite(sumInsured) ||
      !hasKey(memberRates[ageBand], sumInsured)
    ) {
      return failure(
        "INVALID_SUM_INSURED",
        "The Sum Insured is not supported."
      );
    }

    const premium =
      memberRates[ageBand][sumInsured];

    if (
      typeof premium !== "number" ||
      !Number.isFinite(premium) ||
      premium <= 0
    ) {
      return failure(
        "RATE_NOT_FOUND",
        "No official base premium exists for the supplied rating inputs."
      );
    }

    return {
      ok: true,
      premium
    };

  },

  calculateBasePremium({
    zone,
    plan,
    sumInsured,
    members
  } = {}) {

    if (
      !Array.isArray(members) ||
      members.length === 0
    ) {
      return {
        ok: false,
        error: {
          code: "INVALID_MEMBERS",
          message: "At least one covered member is required."
        }
      };
    }

    const memberResults = [];
    let basePremium = 0;

    for (
      let index = 0;
      index < members.length;
      index++
    ) {

      const member = members[index];

      if (
        member &&
        member.ageBand === null
      ) {
        return {
          ok: false,
          error: {
            code: "MISSING_MEMBER_AGE_BAND",
            memberId: member.id,
            message: "Age band is required for every covered member."
          }
        };
      }

      const result = this.getMemberPremium({
        zone,
        plan,
        memberType: member
          ? member.memberType
          : undefined,
        ageBand: member
          ? member.ageBand
          : undefined,
        sumInsured
      });

      if (!result.ok) {
        return {
          ok: false,
          error: Object.assign(
            {},
            result.error,
            {
              memberId: member
                ? member.id
                : undefined
            }
          )
        };
      }

      memberResults.push({
        id: member.id,
        memberType: member.memberType,
        ageBand: member.ageBand,
        premium: result.premium
      });

      basePremium += result.premium;

    }

    return {
      ok: true,
      basePremium,
      members: memberResults
    };

  }

};
