function generateRecommendation() {
  let rec = {
    core: true,
    paysafe: true,
    trust: false,
    cyberlite: false
  };

  if (document.getElementById("hasStaff").checked) {
    rec.trust = true;
  }

  if (document.getElementById("digitalPayments").checked) {
    rec.cyberlite = true;
  }

  calculatePrice(rec);
}



function runRecommendationEngine() {

  appState.recommendations.paysafe = appState.loan.amount > 500000;

  appState.recommendations.trust =
    appState.business.hasStaff || appState.business.hasCustomers;

  appState.recommendations.cyberlite =
    appState.business.hasDigitalPayments;
}
