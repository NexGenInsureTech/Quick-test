/* Application shell navigation. Feature rendering is owned by dedicated modules. */
(function () {
  document.getElementById("misTab").addEventListener("click", () => {
    document.getElementById("misPage").style.display = "block";
    document.getElementById("activationPage").style.display = "none";
    document.getElementById("scorecardPage").style.display = "none";
  });
  document.getElementById("actTab").addEventListener("click", () => {
    document.getElementById("misPage").style.display = "none";
    document.getElementById("activationPage").style.display = "block";
    document.getElementById("scorecardPage").style.display = "none";
  });
  document.getElementById("scoreTab").addEventListener("click", () => {
    document.getElementById("misPage").style.display = "none";
    document.getElementById("activationPage").style.display = "none";
    document.getElementById("scorecardPage").style.display = "block";
  });
})();
