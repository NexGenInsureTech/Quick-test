const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const projectRoot = path.resolve(__dirname, "..");
const context = vm.createContext({});
const scripts = [
  "product-config.js",
  "family-config.js",
  "age-config.js",
  "plan-config.js",
  "zone-config.js",
  "sum-insured-config.js",
  "recommendation-config.js",
  "recommendation-engine.js",
  "rates.js",
  "premium-engine.js",
  "addon-config.js",
  "product-rules.js",
  "quote-decision-engine.js",
  "addon-rates.js",
  "addon-engine.js",
  "deductible-config.js",
  "deductible-rates.js",
  "deductible-engine.js",
  "quote-engine.js",
  "presentation-utils.js"
];

scripts.forEach(file => {
  const source = fs.readFileSync(
    path.join(projectRoot, "js", file),
    "utf8"
  );
  vm.runInContext(source, context, { filename: file });
});

const evaluate = source => vm.runInContext(source, context);
const copy = value => JSON.parse(JSON.stringify(value));
let passed = 0;

function test(name, assertion) {
  try {
    assertion();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

context.members = [
  {
    id: "adult-1",
    memberType: "firstAdult",
    ageBand: "41-45"
  },
  {
    id: "adult-2",
    memberType: "secondAdult",
    ageBand: "36-40"
  },
  {
    id: "child-1",
    memberType: "child",
    ageBand: "0-17"
  },
  {
    id: "child-2",
    memberType: "child",
    ageBand: "18-25"
  }
];

test("authoritative Zone mapping", () => {
  assert.deepStrictEqual(
    copy(evaluate("zones")),
    [
      {
        code: "ZONE1",
        title: "Zone 1",
        description: "NCR, Mumbai, Thane, Mumbai Suburban, Navi Mumbai, Surat, Ahmedabad, Vadodara"
      },
      {
        code: "ZONE2",
        title: "Zone 2",
        description: "All other locations"
      }
    ]
  );
});

test("ZONE1 Gold 2A2C Base Premium is 27400", () => {
  const result = evaluate(`PremiumEngine.calculateBasePremium({
    zone: "ZONE1",
    plan: "gold",
    sumInsured: 1000000,
    members
  })`);
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.basePremium, 27400);
  assert.deepStrictEqual(
    copy(result.members.map(member => member.premium)),
    [13290, 5420, 4160, 4530]
  );
});

test("Aggregate Deductible fixtures", () => {
  const result25 = evaluate(`DeductibleEngine.calculate({
    deductible: 25000,
    sumInsured: 1000000,
    basePremium: 27400
  })`);
  const result50 = evaluate(`DeductibleEngine.calculate({
    deductible: 50000,
    sumInsured: 1000000,
    basePremium: 27400
  })`);
  assert.deepStrictEqual(
    [result25.discountRate, result25.discountAmount, result25.adjustedBasePremium],
    [0.15, 4110, 23290]
  );
  assert.deepStrictEqual(
    [result50.discountRate, result50.discountAmount, result50.adjustedBasePremium],
    [0.20, 5480, 21920]
  );
});

test("Diabetes rate and eligibility", () => {
  const eligible = evaluate(`AddonEngine.calculateAddonPremium({
    addonId: "diabetesDay1",
    plan: "diamond",
    sumInsured: 1000000,
    member: members[0]
  })`);
  const wrongPlan = evaluate(`AddonEngine.calculateAddonPremium({
    addonId: "diabetesDay1",
    plan: "gold",
    sumInsured: 1000000,
    member: members[0]
  })`);
  const child = evaluate(`AddonEngine.calculateAddonPremium({
    addonId: "diabetesDay1",
    plan: "diamond",
    sumInsured: 1000000,
    member: members[2]
  })`);
  assert.strictEqual(eligible.premium, 12180);
  assert.strictEqual(wrongPlan.error.code, "PLAN_NOT_ELIGIBLE");
  assert.strictEqual(child.error.code, "AGE_NOT_ELIGIBLE");
});

test("ProductRules overrides 0-17 source rate availability", () => {
  assert.strictEqual(
    evaluate("addonRates.diabetesDay1['0-17'][1000000] > 0"),
    true
  );
  assert.strictEqual(
    evaluate("addonRates.hypertensionDay1['0-17'][1000000] > 0"),
    true
  );
  ["diabetesDay1", "hypertensionDay1"].forEach(addonId => {
    context.addonId = addonId;
    const result = evaluate(`AddonEngine.calculateAddonPremium({
      addonId,
      plan: "diamond",
      sumInsured: 1000000,
      member: members[2]
    })`);
    assert.strictEqual(result.error.code, "AGE_NOT_ELIGIBLE");
  });
});

test("Quote decision states and precedence", () => {
  const quote = evaluate(`QuoteEngine.compose({
    basePremium: 27400,
    addonPremium: 0,
    deductibleDiscount: 0,
    adjustedBasePremium: 27400
  })`);
  context.quote = quote;
  const stp = evaluate(`QuoteDecisionEngine.evaluate({
    quote,
    selectedAddons: []
  })`);
  const referral = evaluate(`QuoteDecisionEngine.evaluate({
    quote,
    selectedAddons: [{ addonId: "diabetesDay1", memberId: "adult-1" }]
  })`);
  const assisted = evaluate(`QuoteDecisionEngine.evaluate({
    quote: null,
    selectedAddons: [{ addonId: "pedWaiver" }]
  })`);
  const precedence = evaluate(`QuoteDecisionEngine.evaluate({
    quote: null,
    selectedAddons: [
      { addonId: "diabetesDay1", memberId: "adult-1" },
      { addonId: "pedWaiver" }
    ]
  })`);
  assert.strictEqual(stp.decision, "STP");
  assert.strictEqual(referral.decision, "UW_REFERRAL");
  assert.strictEqual(assisted.decision, "ASSISTED_ONLY");
  assert.strictEqual(precedence.decision, "ASSISTED_ONLY");
  [stp, referral, assisted, precedence].forEach(result => {
    assert.strictEqual(result.paymentReady, false);
  });
});

test("Deductible discounts Base Premium only", () => {
  const deductible = evaluate(`DeductibleEngine.calculate({
    deductible: 25000,
    sumInsured: 1000000,
    basePremium: 27400
  })`);
  context.deductible = deductible;
  const quote = evaluate(`QuoteEngine.compose({
    basePremium: 27400,
    addonPremium: 12180,
    deductibleDiscount: deductible.discountAmount,
    adjustedBasePremium: deductible.adjustedBasePremium
  })`);
  assert.strictEqual(quote.finalPremium, 23290 + 12180);
});

test("Diamond referral fixture is 39788 and 109 per day", () => {
  const base = evaluate(`PremiumEngine.calculateBasePremium({
    zone: "ZONE1",
    plan: "diamond",
    sumInsured: 1000000,
    members
  })`);
  context.diamondBase = base;
  const deductible = evaluate(`DeductibleEngine.calculate({
    deductible: 25000,
    sumInsured: 1000000,
    basePremium: diamondBase.basePremium
  })`);
  context.diamondDeductible = deductible;
  const quote = evaluate(`QuoteEngine.compose({
    basePremium: diamondBase.basePremium,
    addonPremium: 12180,
    deductibleDiscount: diamondDeductible.discountAmount,
    adjustedBasePremium: diamondDeductible.adjustedBasePremium
  })`);
  context.diamondQuote = quote;
  const decision = evaluate(`QuoteDecisionEngine.evaluate({
    quote: diamondQuote,
    selectedAddons: [{ addonId: "diabetesDay1", memberId: "adult-1" }]
  })`);
  assert.strictEqual(quote.finalPremium, 39788);
  assert.strictEqual(
    evaluate("PresentationUtils.calculateDailyCost(39788)"),
    109
  );
  assert.strictEqual(decision.decision, "UW_REFERRAL");
  assert.strictEqual(decision.paymentReady, false);
});

test("Recommendation fixtures", () => {
  const recommendations = copy(evaluate(`[
    "young",
    "family",
    "senior"
  ].map(profile => RecommendationEngine.recommend({ profile }).recommendation)`));
  assert.deepStrictEqual(recommendations, [
    { plan: "silver", sumInsured: 1000000 },
    { plan: "gold", sumInsured: 1500000 },
    { plan: "gold", sumInsured: 500000 }
  ]);
  ["married", "parent"].forEach(profile => {
    context.profile = profile;
    assert.strictEqual(
      evaluate("RecommendationEngine.recommend({ profile }).error.code"),
      "RECOMMENDATION_NOT_CONFIGURED"
    );
  });
});

console.log(`\n${passed} regression checks passed.`);
