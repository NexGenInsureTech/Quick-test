const DeductibleEngine = {

  calculate({
    deductible,
    sumInsured,
    basePremium
  } = {}) {

    const failure = (code, message) => ({
      ok: false,
      error: {
        code,
        message,
        input: {
          deductible,
          sumInsured,
          basePremium
        }
      }
    });

    const hasKey = (object, key) =>
      object !== null &&
      typeof object === "object" &&
      Object.prototype.hasOwnProperty.call(
        object,
        key
      );

    if (
      deductible !== null &&
      !deductibleOptions.some(option =>
        option.amount === deductible
      )
    ) {
      return failure(
        "INVALID_DEDUCTIBLE",
        "The selected aggregate deductible is not supported."
      );
    }

    if (
      typeof sumInsured !== "number" ||
      !Number.isFinite(sumInsured) ||
      !sumInsuredOptions.includes(sumInsured)
    ) {
      return failure(
        "INVALID_SUM_INSURED",
        "The selected Sum Insured is not supported."
      );
    }

    if (
      typeof basePremium !== "number" ||
      !Number.isFinite(basePremium) ||
      basePremium < 0
    ) {
      return failure(
        "INVALID_BASE_PREMIUM",
        "A valid numeric Base Cover premium is required."
      );
    }

    if (deductible === null) {
      return {
        ok: true,
        deductible: null,
        sumInsured,
        basePremium,
        discountRate: 0,
        discountAmount: 0,
        adjustedBasePremium: basePremium
      };
    }

    const rateSchedule = deductibleRates[deductible];

    if (!hasKey(rateSchedule, sumInsured)) {
      return failure(
        "DISCOUNT_RATE_NOT_FOUND",
        "No official deductible discount exists for the supplied inputs."
      );
    }

    const discountRate = rateSchedule[sumInsured];

    if (
      typeof discountRate !== "number" ||
      !Number.isFinite(discountRate) ||
      discountRate <= 0
    ) {
      return failure(
        "DISCOUNT_RATE_NOT_FOUND",
        "No official deductible discount exists for the supplied inputs."
      );
    }

    const discountAmount = Math.round(
      basePremium * discountRate
    );

    return {
      ok: true,
      deductible,
      sumInsured,
      basePremium,
      discountRate,
      discountAmount,
      adjustedBasePremium:
        basePremium - discountAmount
    };

  }

};
