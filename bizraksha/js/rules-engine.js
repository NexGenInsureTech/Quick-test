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
