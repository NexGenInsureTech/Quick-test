const currentTaxTreatment = {
  status: "EXEMPT",
  label: "GST Exempt",
  amount: 0
};

const QuoteEngine = {

  compose({
    basePremium,
    addonPremium,
    deductibleDiscount,
    adjustedBasePremium
  } = {}) {

    if (
      typeof basePremium !== "number" ||
      !Number.isFinite(basePremium) ||
      basePremium < 0
    ) {
      return {
        ok: false,
        error: {
          code: "INVALID_BASE_PREMIUM",
          message: "A valid numeric base premium is required.",
          input: {
            basePremium
          }
        }
      };
    }

    if (
      typeof addonPremium !== "number" ||
      !Number.isFinite(addonPremium) ||
      addonPremium < 0
    ) {
      return {
        ok: false,
        error: {
          code: "INVALID_ADDON_PREMIUM",
          message: "A valid numeric add-on premium is required.",
          input: {
            addonPremium
          }
        }
      };
    }

    if (
      typeof deductibleDiscount !== "number" ||
      !Number.isFinite(deductibleDiscount) ||
      deductibleDiscount < 0
    ) {
      return {
        ok: false,
        error: {
          code: "INVALID_DEDUCTIBLE_DISCOUNT",
          message: "A valid numeric deductible discount is required.",
          input: {
            deductibleDiscount
          }
        }
      };
    }

    if (
      typeof adjustedBasePremium !== "number" ||
      !Number.isFinite(adjustedBasePremium) ||
      adjustedBasePremium < 0
    ) {
      return {
        ok: false,
        error: {
          code: "INVALID_ADJUSTED_BASE_PREMIUM",
          message: "A valid adjusted Base Cover premium is required.",
          input: {
            adjustedBasePremium
          }
        }
      };
    }

    if (
      adjustedBasePremium !==
      basePremium - deductibleDiscount
    ) {
      return {
        ok: false,
        error: {
          code: "INVALID_DEDUCTIBLE_COMPOSITION",
          message: "The deductible adjustment does not reconcile with the Base Cover premium.",
          input: {
            basePremium,
            deductibleDiscount,
            adjustedBasePremium
          }
        }
      };
    }

    const finalPremium =
      adjustedBasePremium +
      addonPremium +
      currentTaxTreatment.amount;

    return {
      ok: true,
      status: "FINAL_READY",
      basePremium,
      addonPremium,
      deductibleDiscount,
      adjustedBasePremium,
      taxStatus: currentTaxTreatment.status,
      taxLabel: currentTaxTreatment.label,
      tax: currentTaxTreatment.amount,
      finalPremium
    };

  }

};
