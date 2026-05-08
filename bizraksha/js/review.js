function populateReviewScreen(state) {
  document.getElementById("reviewBusinessType").innerText = state.businessType;
  document.getElementById("reviewLocations").innerText = state.locations;
  document.getElementById("reviewLoanAmount").innerText = state.loanAmount;

  const ul = document.getElementById("reviewModules");
  ul.innerHTML = "";

  state.selectedModules.forEach(mod => {
    const li = document.createElement("li");
    li.innerText = mod.displayName;
    ul.appendChild(li);
  });

  document.getElementById("monthlyPrice").innerText = state.pricing.monthly;
  document.getElementById("annualPrice").innerText = state.pricing.annual;
}


document
  .getElementById("consentCheckbox")
  .addEventListener("change", function (e) {
    document.getElementById("activateProtectionBtn").disabled = !e.target.checked;
  });


// app.js

document
  .getElementById("activateProtectionBtn")
  .addEventListener("click", function () {

    captureConsent(
      appState.selectedModules,
      appState.pricing,
      {
        id: appState.customerId,
        loanId: appState.loanId,
        rmId: appState.rmId
      }
    );

    showConfirmationScreen();
});


// app.js

function showConfirmationScreen() {
  document.getElementById("reviewScreen").style.display = "none";
  document.getElementById("confirmationScreen").style.display = "block";
}


function renderReviewScreen() {

  document.getElementById("monthlyPrice").innerText =
    appState.pricing.monthly;

  document.getElementById("reviewModules").innerHTML = "";

  Object.keys(appState.recommendations).forEach(key => {
    if (appState.recommendations[key]) {
      const li = document.createElement("li");
      li.innerText = key.toUpperCase();
      document.getElementById("reviewModules").appendChild(li);
    }
  });
}
