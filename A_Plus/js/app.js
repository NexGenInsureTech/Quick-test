let selected = {

  profile: null,

  family: null,

  age: null,

  members: [],

  zone: null,

  plan: null,

  sumInsured: null,

  addons: [],

  deductible: null

};

const customerDetails = {
  customerName: "",
  mobileNumber: "",
  rmName: "",
  branchName: ""
};

let currentQuote = null;
let currentQuoteDecision = null;


const packageContainer =
  document.getElementById("packageContainer");

const profileContainer =
  document.getElementById("profileContainer");

const recommendationSection =
  document.getElementById("recommendationSection");

const recommendationContainer =
  document.getElementById("recommendationContainer");

const recommendedPackageByProfile = {
  young: "youngStarter",
  family: "familyProtector",
  senior: "seniorCare"
};

function isQuoteShareReady(
  quote,
  decision,
  details = customerDetails
) {
  return Boolean(
    quote &&
    quote.status === "FINAL_READY" &&
    decision &&
    decision.ok === true &&
    decision.premiumStatus === "INDICATIVE" &&
    CustomerForm.validate(details).ok
  );
}

function updateShareControls() {
  const button = document.getElementById(
    "whatsappShareButton"
  );
  const status = document.getElementById("shareStatus");
  const detailsValid =
    CustomerForm.validate(customerDetails).ok;
  const ready = isQuoteShareReady(
    currentQuote,
    currentQuoteDecision,
    customerDetails
  );

  button.disabled = !ready;

  if (!currentQuote || !currentQuoteDecision) {
    status.textContent =
      "Complete the quote and customer details to share.";
  } else if (!detailsValid) {
    status.textContent =
      "Enter Customer Name and a valid Mobile Number to share.";
  } else {
    status.textContent = currentQuoteDecision.decision ===
      "UW_REFERRAL"
      ? "Your indicative underwriting-referral quote is ready to share."
      : "Your indicative quote is ready to share.";
  }
}

function shareQuoteOnWhatsApp() {
  const validation = CustomerForm.validate(
    customerDetails
  );
  CustomerForm.renderValidation(validation);

  if (
    !isQuoteShareReady(
      currentQuote,
      currentQuoteDecision,
      customerDetails
    )
  ) {
    updateShareControls();
    return;
  }

  const message = ShareHelpers.buildMessage({
    quote: currentQuote,
    decision: currentQuoteDecision,
    selection: selected,
    customer: {
      customerName:
        validation.details.customerName,
      rmName: validation.details.rmName,
      branchName: validation.details.branchName
    }
  });
  const url = ShareHelpers.buildUrl(message);

  if (!url) {
    return;
  }

  window.open(url, "_blank", "noopener,noreferrer");
}

function initializeCustomerDetailsForm() {
  CustomerForm.bindFields({
    details: customerDetails,
    onChange: updateShareControls
  });

  document.getElementById(
    "whatsappShareButton"
  ).onclick = shareQuoteOnWhatsApp;

  updateShareControls();
}

function isAddonSelected(addonId, memberId) {
  return selected.addons.some(selection =>
    selection.addonId === addonId &&
    selection.memberId === memberId
  );
}

function toggleAddonSelection(addonId, memberId) {
  if (isAddonSelected(addonId, memberId)) {
    selected.addons = selected.addons.filter(
      selection => !(
        selection.addonId === addonId &&
        selection.memberId === memberId
      )
    );
  } else {
    selected.addons.push(
      memberId === undefined
        ? { addonId }
        : { addonId, memberId }
    );
  }

  renderAddons();
  updateBaseQuote();
}

function removeMemberTargetedAddons() {
  selected.addons = selected.addons.filter(
    selection => selection.memberId === undefined
  );
}

function removePlanIneligibleAddons() {
  selected.addons = selected.addons.filter(selection => {
    const rule = ProductRules.getAddonRule(
      selection.addonId
    );

    return rule &&
      rule.allowedPlans.includes(selected.plan);
  });
}

function renderPackages(recommendedPackageId = null) {

  packageContainer.innerHTML = "";

  Object.values(packageDefs).forEach(pkg => {

    const div = document.createElement("div");

    div.className = "card";

    const isRecommended =
      pkg.id === recommendedPackageId;

    if (isRecommended) {
      div.classList.add("package-recommended");
    }

    div.innerHTML = `
      <h3>${pkg.title}</h3>

      ${isRecommended
        ? '<span class="badge">Recommended</span>'
        : ''
      }

      <p>
      ${pkg.plan.toUpperCase()}
      </p>
    `;

    packageContainer.appendChild(div);
  });
}

function renderRecommendation() {
  recommendationContainer.innerHTML = "";

  if (!selected.profile) {
    recommendationSection.hidden = true;
    renderPackages();
    return;
  }

  recommendationSection.hidden = false;

  const result = RecommendationEngine.recommend({
    profile: selected.profile
  });

  if (!result.ok) {
    renderPackages();

    const panel = document.createElement("div");
    panel.className =
      "recommendation-panel recommendation-guidance";

    if (
      result.error.code ===
      "RECOMMENDATION_NOT_CONFIGURED"
    ) {
      panel.textContent =
        "Continue by choosing your Plan and Sum Insured.";
    } else {
      panel.textContent =
        "Recommendation unavailable. You can continue with manual selection.";
      console.warn(result.error);
    }

    recommendationContainer.appendChild(panel);
    return;
  }

  renderPackages(
    recommendedPackageByProfile[selected.profile]
  );

  const plan = plans.find(
    item => item.code === result.recommendation.plan
  );
  const isApplied =
    selected.plan === result.recommendation.plan &&
    selected.sumInsured ===
      result.recommendation.sumInsured;

  const panel = document.createElement("div");
  panel.className = "recommendation-panel";

  const heading = document.createElement("h2");
  heading.textContent = "Recommended for you";
  panel.appendChild(heading);

  const values = document.createElement("div");
  values.className = "recommendation-values";
  values.innerHTML = `
    <strong>${plan.title}</strong>
    <strong>${PresentationUtils.formatSumInsured(
      result.recommendation.sumInsured
    )} Sum Insured</strong>
  `;
  panel.appendChild(values);

  const context = document.createElement("p");
  context.textContent =
    "Based on your selected profile.";
  panel.appendChild(context);

  const button = document.createElement("button");
  button.className = "recommendation-action";
  button.type = "button";
  button.textContent = isApplied
    ? "Recommendation Applied"
    : "Apply Recommendation";
  button.disabled = isApplied;

  if (!isApplied) {
    button.onclick = () => {
      selectPricingInputs({
        plan: result.recommendation.plan,
        sumInsured:
          result.recommendation.sumInsured
      });
    };
  }

  panel.appendChild(button);
  recommendationContainer.appendChild(panel);
}

function renderProfiles() {

  profileContainer.innerHTML = "";

  customerProfiles.forEach(profile => {

    const div = document.createElement("button");

    div.className = "card";
    div.type = "button";
    div.setAttribute(
      "aria-pressed",
      String(selected.profile === profile.id)
    );

    if (
      selected.profile === profile.id
    ) {
      div.classList.add("active");
    }

    div.innerHTML = `
      <span class="card-icon" aria-hidden="true">${profile.icon}</span>

      <span class="card-title">
      ${profile.title}
      </span>

      <span class="card-description">
      ${profile.description}
      </span>
    `;

    div.onclick = () => {

      selected.profile =
        profile.id;

      renderProfiles();

      renderRecommendation();

    };


    profileContainer.appendChild(div);
  });
}

function renderFamilies() {

  const familyContainer =
    document.getElementById(
      "familyContainer"
    );

  familyContainer.innerHTML = "";

  familyOptions.forEach(family => {

    const div =
      document.createElement("button");

    div.className = "card";
    div.type = "button";
    div.setAttribute(
      "aria-pressed",
      String(selected.family === family.code)
    );

    if (
      selected.family === family.code
    ) {
      div.classList.add("active");
    }

    div.innerHTML = `
      <span class="card-title">${family.label}</span>
      <span class="card-description">${family.code}</span>
    `;

    div.onclick = () => {

      selected.family =
        family.code;

      selected.members =
        FamilyEngine.createRatingMembers(
          family.code
        );

      selected.age = null;

      removeMemberTargetedAddons();

      renderFamilies();

      renderAgeBands();

      renderAddons();

      updateBaseQuote();

    };

    familyContainer.appendChild(div);

  });

}

function renderAgeBands() {

  const ageContainer =
    document.getElementById(
      "ageContainer"
    );

  ageContainer.innerHTML = "";

  if (selected.members.length === 0) {
    const guidance = document.createElement("p");
    guidance.className =
      "section-helper age-guidance";
    guidance.textContent =
      "Select your family composition first to choose age bands.";
    ageContainer.appendChild(guidance);
    return;
  }

  selected.members.forEach((member, memberIndex) => {

    const memberGroup =
      document.createElement("div");

    memberGroup.className =
      "member-age-group";

    const heading =
      document.createElement("h3");

    heading.innerHTML =
      PresentationUtils.getMemberLabel(
        member,
        selected.members
      );

    memberGroup.appendChild(heading);

    const ageGrid =
      document.createElement("div");

    ageGrid.className =
      "member-age-grid";

    ageBandsByMemberType[
      member.memberType
    ].forEach(age => {

      const div =
        document.createElement("button");

      div.className = "card";
      div.type = "button";
      div.setAttribute(
        "aria-pressed",
        String(member.ageBand === age)
      );

      if (member.ageBand === age) {
        div.classList.add("active");
      }

      div.innerHTML = `
        <span class="card-title">${age}</span>
      `;

      div.onclick = () => {

        selected.members[
          memberIndex
        ].ageBand = age;

        const leadMember =
          selected.members.find(item =>
            item.memberType === "firstAdult"
          ) || selected.members.find(item =>
            item.memberType === "parent"
          );

        selected.age = leadMember
          ? leadMember.ageBand
          : null;

        selected.addons = selected.addons.filter(
          selection =>
            selection.memberId !== member.id ||
            ProductRules.isAddonEligible({
              addonId: selection.addonId,
              plan: selected.plan,
              member: selected.members[memberIndex]
            }).eligible
        );

        renderAgeBands();

        renderAddons();

        updateBaseQuote();

      };

      ageGrid.appendChild(div);

    });

    memberGroup.appendChild(ageGrid);

    ageContainer.appendChild(
      memberGroup
    );

  });

}

function renderZones() {

  const zoneContainer =
    document.getElementById(
      "zoneContainer"
    );

  zoneContainer.innerHTML = "";

  zones.forEach(zone => {

    const div =
      document.createElement("button");

    div.className = "card";
    div.type = "button";
    div.setAttribute(
      "aria-pressed",
      String(selected.zone === zone.code)
    );

    if (
      selected.zone === zone.code
    ) {

      div.classList.add(
        "active"
      );

    }

    div.innerHTML = `

            <span class="card-title">
                ${zone.title}
            </span>

            <span class="card-description">
                ${zone.description}
            </span>

        `;

    div.onclick = () => {

      selected.zone =
        zone.code;

      renderZones();

      updateBaseQuote();

    };

    zoneContainer.appendChild(
      div
    );

  });

}

function selectPricingInputs({
  plan = selected.plan,
  sumInsured = selected.sumInsured
}) {
  selected.plan = plan;
  selected.sumInsured = sumInsured;

  removePlanIneligibleAddons();

  renderPlans();
  renderSI();
  renderAddons();
  renderRecommendation();
  updateBaseQuote();
}

function renderPlans() {

  const planContainer =
    document.getElementById(
      "planContainer"
    );

  planContainer.innerHTML = "";

  plans.forEach(plan => {

    const div =
      document.createElement("button");

    div.className = "card";
    div.type = "button";
    div.setAttribute(
      "aria-pressed",
      String(selected.plan === plan.code)
    );

    if (
      selected.plan === plan.code
    ) {

      div.classList.add(
        "active"
      );

    }

    div.innerHTML = `

            <span class="card-title">
                ${plan.title}
            </span>

            <span class="card-description">
                ${plan.badge}
            </span>

        `;

    div.onclick = () => {

      selectPricingInputs({
        plan: plan.code
      });

    };

    planContainer.appendChild(
      div
    );

  });

}

function renderSI() {

  const siContainer =
    document.getElementById(
      "siContainer"
    );

  siContainer.innerHTML = "";

  sumInsuredOptions.forEach(si => {

    const div =
      document.createElement("button");

    div.className = "card";
    div.type = "button";
    div.setAttribute(
      "aria-pressed",
      String(selected.sumInsured === si)
    );

    if (
      selected.sumInsured === si
    ) {

      div.classList.add(
        "active"
      );

    }

    const label = PresentationUtils.formatSumInsured(si);

    div.innerHTML = `
      <span class="card-title">${label}</span>
    `;

    div.onclick = () => {

      selectPricingInputs({
        sumInsured: si
      });

    };

    siContainer.appendChild(
      div
    );

  });

}

function renderAddons() {
  const addonContainer =
    document.getElementById("addonContainer");

  addonContainer.innerHTML = "";

  addonDefinitions.forEach(definition => {
    const rule = ProductRules.getAddonRule(
      definition.id
    );
    const card = document.createElement("div");
    card.className = "card addon-card";

    if (selected.addons.some(selection =>
      selection.addonId === definition.id
    )) {
      card.classList.add("active");
    }

    const heading = document.createElement("h3");
    heading.textContent = definition.title;
    card.appendChild(heading);

    const status = document.createElement("p");
    status.className = "addon-status";

    if (
      rule.pricingStatus ===
      "BLOCKED_PRICING_BASIS"
    ) {
      card.classList.add("addon-card-disabled");
      status.textContent =
        "Premium requires assisted quotation";
      card.appendChild(status);
      addonContainer.appendChild(card);
      return;
    }

    if (
      definition.pricingType ===
      "NO_PREMIUM_IMPACT"
    ) {
      const planEligible =
        rule.allowedPlans.includes(selected.plan);
      status.textContent = planEligible
        ? "No additional premium"
        : "Select a Plan to enable optional covers";
      card.appendChild(status);

      const option = document.createElement("label");
      option.className = "addon-member-option";
      const input = document.createElement("input");
      input.type = "checkbox";
      input.disabled = !planEligible;
      input.checked = isAddonSelected(definition.id);
      input.onchange = () =>
        toggleAddonSelection(definition.id);
      const label = document.createElement("span");
      label.textContent = "Add this optional benefit";

      option.appendChild(input);
      option.appendChild(label);
      card.appendChild(option);
      addonContainer.appendChild(card);
      return;
    }

    const planEligible =
      rule.allowedPlans.includes(selected.plan);
    const eligibleMembers = selected.members.filter(
      member => ProductRules.isAddonEligible({
        addonId: definition.id,
        plan: selected.plan,
        member
      }).eligible
    );

    if (selected.plan === null) {
      status.textContent =
        "Select a Plan to check optional-cover availability";
    } else if (!planEligible) {
      status.textContent = "Available with Diamond Plan";
    } else if (eligibleMembers.length === 0) {
      status.textContent =
        "Select an eligible insured member age";
    } else if (selected.sumInsured === null) {
      status.textContent =
        "Select Sum Insured to enable this cover";
    } else {
      status.textContent =
        "Select each insured person to be covered";
    }

    card.appendChild(status);

    eligibleMembers.forEach(member => {
      const option = document.createElement("label");
      option.className = "addon-member-option";
      const input = document.createElement("input");
      input.type = "checkbox";
      input.disabled =
        !planEligible ||
        selected.sumInsured === null;
      input.checked = isAddonSelected(
        definition.id,
        member.id
      );
      input.onchange = () =>
        toggleAddonSelection(
          definition.id,
          member.id
        );
      const label = document.createElement("span");
      label.textContent =
        `${PresentationUtils.getMemberLabel(
          member,
          selected.members
        )} (${member.ageBand})`;

      option.appendChild(input);
      option.appendChild(label);
      card.appendChild(option);
    });

    addonContainer.appendChild(card);
  });
}

function renderDeductibles() {
  const deductibleContainer =
    document.getElementById("deductibleContainer");

  deductibleContainer.innerHTML = "";

  const options = [
    {
      amount: null,
      label: "No Deductible"
    },
    ...deductibleOptions.map(option => ({
      amount: option.amount,
      label: `${option.label} Deductible`
    }))
  ];

  options.forEach(option => {
    const card = document.createElement("button");
    card.className = "card deductible-card";
    card.type = "button";
    card.setAttribute(
      "aria-pressed",
      String(selected.deductible === option.amount)
    );

    if (selected.deductible === option.amount) {
      card.classList.add("active");
    }

    const heading = document.createElement("span");
    heading.className = "deductible-title";
    heading.textContent = option.label;
    card.appendChild(heading);

    card.onclick = () => {
      selected.deductible = option.amount;
      renderDeductibles();
      updateBaseQuote();
    };

    deductibleContainer.appendChild(card);
  });
}

function clearQuoteHero() {
  document.getElementById("quoteHero").hidden = true;
  document.getElementById("finalPremium").textContent = "";
  document.getElementById("dailyCost").textContent = "";
  document.getElementById("heroTax").textContent = "";
  document.getElementById(
    "quoteDecisionStatus"
  ).textContent = "";
}

function clearDeductibleQuote() {
  document.getElementById(
    "quoteDeductible"
  ).textContent = "--";
  document.getElementById(
    "deductibleDiscount"
  ).textContent = "₹ --";
  document.getElementById(
    "adjustedBasePremium"
  ).textContent = "₹ --";
  document.getElementById(
    "deductibleDisclosure"
  ).textContent = "";
  document.getElementById(
    "deductibleStatus"
  ).textContent = "";
}

function updateDeductibleQuote(basePremium) {
  const result = DeductibleEngine.calculate({
    deductible: selected.deductible,
    sumInsured: selected.sumInsured,
    basePremium
  });

  const discountElement =
    document.getElementById("deductibleDiscount");
  const deductibleElement =
    document.getElementById("quoteDeductible");
  const adjustedElement =
    document.getElementById("adjustedBasePremium");
  const disclosureElement =
    document.getElementById("deductibleDisclosure");
  const statusElement =
    document.getElementById("deductibleStatus");

  if (!result.ok) {
    deductibleElement.textContent = "--";
    discountElement.textContent = "₹ --";
    adjustedElement.textContent = "₹ --";
    clearQuoteHero();
    disclosureElement.textContent = "";
    statusElement.textContent =
      "Deductible adjustment unavailable";
    console.warn(result.error);
    return result;
  }

  adjustedElement.textContent =
    PresentationUtils.formatCurrency(
      result.adjustedBasePremium
    );
  statusElement.textContent = "";

  if (result.deductible === null) {
    deductibleElement.textContent = "No Deductible";
    discountElement.textContent = "Not applicable";
    disclosureElement.textContent =
      "No deductible selected";
  } else {
    const option = deductibleOptions.find(
      item => item.amount === result.deductible
    );
    const rate = result.discountRate * 100;
    deductibleElement.textContent =
      `${option.label} Aggregate Deductible`;
    discountElement.textContent =
      `-${PresentationUtils.formatCurrency(
        result.discountAmount
      )}`;
    disclosureElement.textContent =
      `${option.label} Aggregate Deductible · ${rate}% Base Premium discount`;
  }

  return result;
}

function updateAddonQuote() {
  const premiumElement =
    document.getElementById("addonPremium");
  const statusElement =
    document.getElementById("addonStatus");
  const breakdownElement =
    document.getElementById("addonBreakdown");

  const result = AddonEngine.calculateAddons({
    plan: selected.plan,
    sumInsured: selected.sumInsured,
    members: selected.members,
    selections: selected.addons
  });

  if (!result.ok) {
    premiumElement.textContent = "₹ --";
    statusElement.textContent =
      "Optional cover premium unavailable";
    breakdownElement.innerHTML = "";
    console.warn(result.error);
    return result;
  }

  premiumElement.textContent =
    PresentationUtils.formatCurrency(
      result.totalAddonPremium
    );
  statusElement.textContent = "";

  if (result.addons.length === 0) {
    breakdownElement.innerHTML = "";
    return result;
  }

  const rows = result.addons.map(addon => {
    const definition = addonDefinitions.find(
      item => item.id === addon.addonId
    );

    if (addon.memberId) {
      const member = selected.members.find(
        item => item.id === addon.memberId
      );

      return `
        <div class="addon-premium-row">
          <span>
            ${definition.title}<br>
            <small>${PresentationUtils.getMemberLabel(
              member,
              selected.members
            )} (${addon.ageBand})</small>
          </span>
          <strong>${PresentationUtils.formatCurrency(addon.premium)}</strong>
        </div>
      `;
    }

    return `
      <div class="addon-premium-row">
        <span>${definition.title}</span>
        <strong>No additional premium</strong>
      </div>
    `;
  }).join("");

  breakdownElement.innerHTML = `
    <h3>Optional Covers</h3>
    ${rows}
    <div class="addon-premium-row addon-premium-total">
      <span>Add-on Premium</span>
      <strong>${PresentationUtils.formatCurrency(result.totalAddonPremium)}</strong>
    </div>
  `;

  return result;
}

function updateBaseQuote() {

  currentQuote = null;
  currentQuoteDecision = null;
  updateShareControls();

  const addonResult = updateAddonQuote();

  const plan = plans.find(item =>
    item.code === selected.plan
  );

  const family =
    FamilyEngine.getFamilyDefinition(
      selected.family
    );

  const zone = zones.find(item =>
    item.code === selected.zone
  );

  const sumInsuredLabel = selected.sumInsured === null
    ? "--"
    : PresentationUtils.formatSumInsured(
      selected.sumInsured
    );

  document.getElementById(
    "planBadge"
  ).textContent = plan
    ? `${plan.title} Plan`
    : "Select Plan";

  document.getElementById(
    "quotePlan"
  ).textContent = plan
    ? plan.title
    : "--";

  document.getElementById(
    "quoteFamily"
  ).textContent = family
    ? family.label
    : "--";

  document.getElementById(
    "quoteZone"
  ).textContent = zone
    ? zone.title
    : "--";

  document.getElementById(
    "quoteSumInsured"
  ).textContent = sumInsuredLabel;

  const premiumElement =
    document.getElementById("premium");

  const statusElement =
    document.getElementById("quoteStatus");

  const taxDisclosureElement =
    document.getElementById("taxDisclosure");

  const breakdownElement =
    document.getElementById("memberBreakdown");

  const isReady =
    selected.family !== null &&
    selected.zone !== null &&
    selected.plan !== null &&
    selected.sumInsured !== null &&
    selected.members.length > 0 &&
    selected.members.every(member =>
      member.ageBand !== null
    );

  if (!isReady) {
    premiumElement.textContent = "₹ --";
    document.getElementById(
      "addonPremium"
    ).textContent = "₹ --";
    statusElement.textContent =
      "Complete your selections to see premium";
    taxDisclosureElement.textContent = "";
    breakdownElement.innerHTML = "";
    clearDeductibleQuote();
    clearQuoteHero();
    return;
  }

  const result =
    PremiumEngine.calculateBasePremium({
      zone: selected.zone,
      plan: selected.plan,
      sumInsured: selected.sumInsured,
      members: selected.members
    });

  if (!result.ok) {
    premiumElement.textContent = "₹ --";
    document.getElementById(
      "addonPremium"
    ).textContent = "₹ --";
    statusElement.textContent =
      "Premium unavailable for the current selection";
    taxDisclosureElement.textContent = "";
    breakdownElement.innerHTML = "";
    clearDeductibleQuote();
    clearQuoteHero();
    console.warn(result.error);
    return;
  }

  const deductibleResult =
    updateDeductibleQuote(result.basePremium);

  if (!addonResult.ok || !deductibleResult.ok) {
    premiumElement.textContent =
      PresentationUtils.formatCurrency(
        result.basePremium
      );
    statusElement.textContent =
      "Premium composition unavailable";
    taxDisclosureElement.textContent = "";
    breakdownElement.innerHTML = "";
    clearQuoteHero();
    return;
  }

  const quote = QuoteEngine.compose({
    basePremium: result.basePremium,
    addonPremium:
      addonResult.totalAddonPremium,
    deductibleDiscount:
      deductibleResult.discountAmount,
    adjustedBasePremium:
      deductibleResult.adjustedBasePremium
  });

  if (!quote.ok) {
    premiumElement.textContent = "₹ --";
    statusElement.textContent =
      "Premium unavailable for the current selection";
    taxDisclosureElement.textContent = "";
    breakdownElement.innerHTML = "";
    clearQuoteHero();
    console.warn(quote.error);
    return;
  }

  const quoteDecision =
    QuoteDecisionEngine.evaluate({
      quote,
      selectedAddons: selected.addons
    });

  if (!quoteDecision.ok) {
    premiumElement.textContent = "₹ --";
    statusElement.textContent =
      "Quote decision unavailable for the current selection";
    taxDisclosureElement.textContent = "";
    breakdownElement.innerHTML = "";
    clearQuoteHero();
    console.warn(quoteDecision.error);
    return;
  }

  if (quote.status === "FINAL_READY") {
    currentQuote = quote;
    currentQuoteDecision = quoteDecision;
  }

  updateShareControls();

  premiumElement.textContent =
    PresentationUtils.formatCurrency(
      quote.basePremium
    );

  statusElement.textContent = quoteDecision.decision ===
    "UW_REFERRAL"
    ? "Underwriting review required"
    : "Indicative premium ready";

  taxDisclosureElement.textContent =
    quote.taxLabel;

  document.getElementById("quoteHero").hidden = false;
  document.getElementById(
    "finalPremium"
  ).textContent =
    `${PresentationUtils.formatCurrency(
      quote.finalPremium
    )} / year`;
  document.getElementById(
    "dailyCost"
  ).textContent =
    `Approx. ${PresentationUtils.formatCurrency(
      PresentationUtils.calculateDailyCost(
        quote.finalPremium
      )
    )}/day`;
  document.getElementById(
    "heroTax"
  ).textContent = quote.taxLabel;
  document.getElementById(
    "quoteDecisionStatus"
  ).textContent = quoteDecision.decision ===
    "UW_REFERRAL"
    ? "Underwriting review required. The premium shown is indicative. Final acceptance, terms and payable premium will be confirmed after underwriting."
    : "Indicative premium based on the information currently selected. Final acceptance and policy issuance remain subject to applicable proposal and underwriting requirements.";

  breakdownElement.innerHTML =
    result.members.map(member => {
      return `
        <div class="member-premium-row">
          <span>
            ${PresentationUtils.getMemberLabel(
              member,
              result.members
            )} (${member.ageBand})
          </span>
          <strong>${PresentationUtils.formatCurrency(member.premium)}</strong>
        </div>
      `;

    }).join("");

}


renderPackages();
renderProfiles();
renderRecommendation();
renderFamilies();
renderAgeBands();
renderZones();
renderPlans();
renderSI();
renderAddons();
renderDeductibles();
updateBaseQuote();
initializeCustomerDetailsForm();
