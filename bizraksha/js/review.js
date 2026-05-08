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
