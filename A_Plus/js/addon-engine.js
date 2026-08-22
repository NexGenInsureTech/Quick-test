const AddonEngine = {

  calculateAddonPremium({
    addonId,
    plan,
    sumInsured,
    member
  } = {}) {

    const hasKey = (object, key) =>
      object !== null &&
      typeof object === "object" &&
      Object.prototype.hasOwnProperty.call(
        object,
        key
      );

    const failure = (code, message) => ({
      ok: false,
      error: {
        code,
        addonId,
        message
      }
    });

    const definition = addonDefinitions.find(
      item => item.id === addonId
    );

    if (!definition) {
      return failure(
        "INVALID_ADDON",
        "The selected add-on is not supported."
      );
    }

    if (
      definition.implementationStatus ===
      "BLOCKED_PRICING_BASIS"
    ) {
      return failure(
        "BLOCKED_PRICING_BASIS",
        "Pricing basis requires authoritative clarification."
      );
    }

    const validPlans = new Set(
      addonDefinitions.flatMap(item =>
        item.allowedPlans
      )
    );

    if (
      typeof plan !== "string" ||
      !validPlans.has(plan)
    ) {
      return failure(
        "INVALID_PLAN",
        "The selected plan is not supported."
      );
    }

    if (!definition.allowedPlans.includes(plan)) {
      return failure(
        "PLAN_NOT_ELIGIBLE",
        "The add-on is not available for the selected plan."
      );
    }

    if (
      definition.pricingType ===
      "NO_PREMIUM_IMPACT"
    ) {
      return {
        ok: true,
        addonId: definition.id,
        pricingType: definition.pricingType,
        plan,
        premium: 0
      };
    }

    if (
      member === null ||
      typeof member !== "object" ||
      Array.isArray(member) ||
      typeof member.id !== "string" ||
      member.id.trim() === "" ||
      typeof member.memberType !== "string" ||
      member.memberType.trim() === ""
    ) {
      return failure(
        "INVALID_MEMBER",
        "An explicitly targeted insured member is required."
      );
    }

    if (
      typeof member.ageBand !== "string" ||
      member.ageBand.trim() === ""
    ) {
      return failure(
        "MISSING_MEMBER_AGE_BAND",
        "The targeted member's age band is required."
      );
    }

    if (
      definition.minimumAge === 18 &&
      member.ageBand === "0-17"
    ) {
      return failure(
        "AGE_NOT_ELIGIBLE",
        "The targeted member must be aged 18 years or above."
      );
    }

    const rateTable = addonRates[definition.id];

    if (!hasKey(rateTable, member.ageBand)) {
      return failure(
        "INVALID_AGE_BAND",
        "The targeted member's age band is not supported."
      );
    }

    if (
      typeof sumInsured !== "number" ||
      !Number.isFinite(sumInsured) ||
      !hasKey(rateTable[member.ageBand], sumInsured)
    ) {
      return failure(
        "INVALID_SUM_INSURED",
        "The selected Sum Insured is not supported."
      );
    }

    const premium =
      rateTable[member.ageBand][sumInsured];

    if (
      typeof premium !== "number" ||
      !Number.isFinite(premium) ||
      premium <= 0
    ) {
      return failure(
        "RATE_NOT_FOUND",
        "No official add-on premium exists for the supplied inputs."
      );
    }

    return {
      ok: true,
      addonId: definition.id,
      pricingType: definition.pricingType,
      plan,
      sumInsured,
      member: {
        id: member.id,
        memberType: member.memberType,
        ageBand: member.ageBand
      },
      premium
    };

  },

  calculateAddons({
    plan,
    sumInsured,
    members,
    selections
  } = {}) {

    const failure = (
      code,
      message,
      addonId
    ) => ({
      ok: false,
      error: {
        code,
        addonId,
        message
      }
    });

    if (!Array.isArray(selections)) {
      return failure(
        "INVALID_ADDON_SELECTIONS",
        "Add-on selections must be supplied as an array."
      );
    }

    if (selections.length === 0) {
      return {
        ok: true,
        totalAddonPremium: 0,
        addons: []
      };
    }

    const breakdown = [];
    const selectionKeys = new Set();
    let totalAddonPremium = 0;

    for (const selection of selections) {

      if (
        selection === null ||
        typeof selection !== "object" ||
        Array.isArray(selection) ||
        typeof selection.addonId !== "string" ||
        selection.addonId.trim() === ""
      ) {
        return failure(
          "INVALID_ADDON_SELECTION",
          "Each add-on selection must contain a valid add-on ID."
        );
      }

      const definition = addonDefinitions.find(
        item => item.id === selection.addonId
      );

      if (!definition) {
        return this.calculateAddonPremium({
          addonId: selection.addonId,
          plan,
          sumInsured
        });
      }

      if (
        definition.implementationStatus ===
        "BLOCKED_PRICING_BASIS"
      ) {
        return this.calculateAddonPremium({
          addonId: definition.id,
          plan,
          sumInsured
        });
      }

      const requiresMember =
        definition.pricingType === "AGE_SI";

      let member;
      let selectionKey = definition.id;

      if (requiresMember) {

        if (
          typeof selection.memberId !== "string" ||
          selection.memberId.trim() === ""
        ) {
          return failure(
            "MEMBER_TARGET_REQUIRED",
            "This add-on requires an explicit insured member target.",
            definition.id
          );
        }

        if (!Array.isArray(members)) {
          return failure(
            "INVALID_MEMBERS",
            "Covered members must be supplied as an array.",
            definition.id
          );
        }

        member = members.find(item =>
          item && item.id === selection.memberId
        );

        if (!member) {
          return failure(
            "MEMBER_NOT_FOUND",
            "The targeted insured member was not found.",
            definition.id
          );
        }

        selectionKey += `::${selection.memberId}`;

      }

      if (selectionKeys.has(selectionKey)) {
        return failure(
          "DUPLICATE_ADDON_SELECTION",
          "The same add-on target cannot be selected more than once.",
          definition.id
        );
      }

      selectionKeys.add(selectionKey);

      const result = this.calculateAddonPremium({
        addonId: definition.id,
        plan,
        sumInsured,
        member
      });

      if (!result.ok) {
        return result;
      }

      if (requiresMember) {
        breakdown.push({
          addonId: result.addonId,
          memberId: result.member.id,
          memberType: result.member.memberType,
          ageBand: result.member.ageBand,
          premium: result.premium
        });
      } else {
        breakdown.push({
          addonId: result.addonId,
          premium: result.premium
        });
      }

      totalAddonPremium += result.premium;

    }

    return {
      ok: true,
      totalAddonPremium,
      addons: breakdown
    };

  }

};
