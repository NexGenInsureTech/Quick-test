const ShareHelpers = (() => {

  function buildMessage({
    quote,
    selection: quoteSelection,
    customer
  } = {}) {
    if (
      !quote ||
      !customer ||
      !quoteSelection ||
      !Array.isArray(quoteSelection.members) ||
      !Array.isArray(quoteSelection.addons)
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
        item =>
          item.id === addonSelection.addonId &&
          item.implementationStatus === "READY" &&
          item.allowedPlans.includes(quoteSelection.plan)
      );

      if (!definition || seenAddons.has(key)) {
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
      `Sum Insured: ${PresentationUtils.formatSumInsured(quoteSelection.sumInsured)}`,
      "",
      `Annual Premium: ${PresentationUtils.formatCurrency(quote.finalPremium)}`,
      `Approx. Cost Per Day: ${PresentationUtils.formatCurrency(
        PresentationUtils.calculateDailyCost(quote.finalPremium)
      )}/day`,
      quote.taxLabel,
      "",
      addonLines.length > 0
        ? `Optional Covers:\n${addonLines.join("\n")}`
        : "Optional Covers: None",
      `Aggregate Deductible: ${
        quoteSelection.deductible === null
          ? "None"
          : PresentationUtils.formatCurrency(quoteSelection.deductible)
      }`
    ];

    if (customer.rmName) {
      lines.push("", `RM: ${customer.rmName}`);
    }

    if (customer.branchName) {
      lines.push(
        `Branch: ${customer.branchName}`
      );
    }

    lines.push(
      "",
      "Indicative premium based on selected options.",
      "Coverage, eligibility, underwriting and policy issuance are subject to applicable A Plus policy terms and conditions."
    );

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
