function captureConsent() {
  const audit = {
    timestamp: new Date().toISOString(),
    selection: selectedModules,
    pricingVersion: "v2026.1"
  };

  console.log("Consent Log:", audit);
}
