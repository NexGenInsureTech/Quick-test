const addonDefinitions = [
  {
    id: "pedWaiver",
    title: "PED Waiting Period Waiver",
    pricingType: "AGE_SI",
    allowedPlans: ["silver", "gold", "diamond"],
    implementationStatus: "BLOCKED_PRICING_BASIS"
  },
  {
    id: "diabetesDay1",
    title: "Diabetes Day 1",
    pricingType: "AGE_SI",
    allowedPlans: ["diamond"],
    minimumAge: 18,
    implementationStatus: "READY"
  },
  {
    id: "hypertensionDay1",
    title: "Hypertension Day 1",
    pricingType: "AGE_SI",
    allowedPlans: ["diamond"],
    minimumAge: 18,
    implementationStatus: "READY"
  },
  {
    id: "nonMedicalItems",
    title: "Non-Medical Items",
    pricingType: "AGE_SI",
    allowedPlans: ["silver", "gold", "diamond"],
    implementationStatus: "BLOCKED_PRICING_BASIS"
  },
  {
    id: "maternity",
    title: "Maternity",
    pricingType: "AGE_PLAN",
    allowedPlans: ["silver", "gold", "diamond"],
    implementationStatus: "BLOCKED_PRICING_BASIS"
  },
  {
    id: "roomRentModification",
    title: "Room Rent Modification",
    pricingType: "NO_PREMIUM_IMPACT",
    allowedPlans: ["silver", "gold", "diamond"],
    implementationStatus: "READY"
  }
];
