function captureConsent() {
  const audit = {
    timestamp: new Date().toISOString(),
    selection: selectedModules,
    pricingVersion: "v2026.1"
  };

  console.log("Consent Log:", audit);
}


function captureConsent() {

  appState.consent.given = true;
  appState.consent.timestamp = new Date().toISOString();

  localStorage.setItem(
    "bizraksha_consent_" + appState.loan.loanId,
    JSON.stringify(appState)
  );
}
