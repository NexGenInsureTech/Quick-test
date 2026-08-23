const ShareHelpers = (() => {

  function buildMessage({
    quote,
    decision,
    selection: quoteSelection,
    customer
  } = {}) {
    if (
      !decision ||
      decision.ok !== true ||
      !["STP", "UW_REFERRAL", "ASSISTED_ONLY"].includes(
        decision.decision
      ) ||
      !customer ||
      !quoteSelection ||
      !Array.isArray(quoteSelection.members) ||
      !Array.isArray(quoteSelection.addons)
    ) {
      return null;
    }

    const assistedOnly =
      decision.decision === "ASSISTED_ONLY";

    if (
      !assistedOnly &&
      (
        !quote ||
        quote.ok !== true ||
        quote.status !== "FINAL_READY" ||
        typeof quote.finalPremium !== "number" ||
        !Number.isFinite(quote.finalPremium)
      )
    ) {
      return null;
    }

    const family = familyOptions.find(
      item => item.code === quoteSelection.family
    );
    const plan = plans.find(
      item => item.code === quoteSelection.plan
    );

    if (
      !family ||
      !plan ||
      !sumInsuredOptions.includes(
        quoteSelection.sumInsured
      )
    ) {
      return null;
    }

    const addonLines = [];
    const seenAddons = new Set();

    quoteSelection.addons.forEach(addonSelection => {
      const key =
        `${addonSelection.addonId}:${addonSelection.memberId || "policy"}`;
      const definition = addonDefinitions.find(
        item => item.id === addonSelection.addonId
      );
      const rule = ProductRules.getAddonRule(
        addonSelection.addonId
      );

      if (
        !definition ||
        !rule ||
        (
          rule.pricingStatus !== "READY" &&
          !assistedOnly
        ) ||
        !rule.allowedPlans.includes(quoteSelection.plan) ||
        seenAddons.has(key)
      ) {
        return;
      }

      let line = `• ${definition.title}`;

      if (addonSelection.memberId) {
        const member = quoteSelection.members.find(
          item => item.id === addonSelection.memberId
        );

        if (!member) {
          return;
        }

        line += ` — ${PresentationUtils.getMemberLabel(
          member,
          quoteSelection.members
        )}`;
      }

      seenAddons.add(key);
      addonLines.push(line);
    });

    const lines = [
      "A Plus Health Insurance",
      "",
      `Indicative Quote for: ${customer.customerName}`,
      "",
      `Family: ${family.label}`,
      `Plan: ${plan.title}`,
      `Sum Insured: ${PresentationUtils.formatSumInsured(quoteSelection.sumInsured)}`
    ];

    if (assistedOnly) {
      lines.push(
        "",
        "Assisted quotation required",
        "One or more selected covers require assisted pricing or assessment before a complete premium can be confirmed."
      );
    } else {
      lines.push(
        "",
        `Indicative Premium: ${PresentationUtils.formatCurrency(quote.finalPremium)}`,
        `Approx. Cost Per Day: ${PresentationUtils.formatCurrency(
          PresentationUtils.calculateDailyCost(quote.finalPremium)
        )}/day`,
        quote.taxLabel
      );

      if (decision.decision === "UW_REFERRAL") {
        lines.push(
          "Underwriting review required.",
          "Final acceptance, terms and payable premium are subject to underwriting."
        );
      }
    }

    lines.push(
      "",
      addonLines.length > 0
        ? `Optional Covers:\n${addonLines.join("\n")}`
        : "Optional Covers: None",
      `Aggregate Deductible: ${
        quoteSelection.deductible === null
          ? "None"
          : PresentationUtils.formatCurrency(quoteSelection.deductible)
      }`
    );

    if (customer.rmName) {
      lines.push("", `RM: ${customer.rmName}`);
    }

    if (customer.branchName) {
      lines.push(
        `Branch: ${customer.branchName}`
      );
    }

    if (assistedOnly) {
      lines.push(
        "",
        "Coverage and premium confirmation require assisted review under applicable A Plus policy terms and conditions."
      );
    } else {
      lines.push(
        "",
        "Indicative premium based on selected options.",
        "Coverage, eligibility, underwriting and policy issuance are subject to applicable A Plus policy terms and conditions."
      );
    }

    return lines.join("\n");
  }

  function buildUrl(message) {
    if (typeof message !== "string" || !message) {
      return null;
    }

    return `https://wa.me/?text=${encodeURIComponent(message)}`;
  }

  return Object.freeze({
    buildMessage,
    buildUrl
  });

})();
