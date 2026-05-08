function calculatePrice(selection) {
  const pricing = JSON.parse(localStorage.getItem("bizraksha_pricing"));
  let total = 0;

  if (selection.core) total += pricing.core["50L"];
  if (selection.paysafe) total += pricing.paysafe["50L"];
  if (selection.trust) total += pricing.trust.basic;
  if (selection.cyberlite) total += pricing.cyberlite["5L"];

  document.getElementById("recommendation").innerHTML = `
    <h3>Recommended Protection</h3>
    <p>Monthly Cost: ₹${Math.round(total / 12)}</p>
  `;
}

function captureConsent() {
  const audit = {
    timestamp: new Date().toISOString(),
    selection: selectedModules,
    pricingVersion: "v2026.1"
  };

  console.log("Consent Log:", audit);
}

function calculatePricing(pricingTable) {

  let annual = 0;

  if (appState.recommendations.core)
    annual += pricingTable.core[appState.loan.slab];

  if (appState.recommendations.paysafe)
    annual += pricingTable.paysafe[appState.loan.slab];

  if (appState.recommendations.trust)
    annual += pricingTable.trust.basic;

  if (appState.recommendations.cyberlite)
    annual += pricingTable.cyberlite["5L"];

  appState.pricing.annual = annual;
  appState.pricing.monthly = Math.round(annual / 12);
}
