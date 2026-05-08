function updateBusinessSnapshot() {
  appState.business.type =
    document.getElementById("businessType").value;

  appState.business.hasStaff =
    document.getElementById("hasStaff").checked;

  appState.business.hasDigitalPayments =
    document.getElementById("digitalPayments").checked;
}
