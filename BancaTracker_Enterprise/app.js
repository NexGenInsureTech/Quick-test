/* Application shell navigation. Feature rendering is owned by dedicated modules. */
(function () {
  const pageIds = ["misPage", "activationPage", "scorecardPage", "targetPage"];
  const showPage = (pageId) => pageIds.forEach((id) => { document.getElementById(id).style.display = id === pageId ? "block" : "none"; });
  document.getElementById("misTab").addEventListener("click", () => {
    showPage("misPage");
  });
  document.getElementById("actTab").addEventListener("click", () => {
    showPage("activationPage");
  });
  document.getElementById("scoreTab").addEventListener("click", () => {
    showPage("scorecardPage");
  });
  document.getElementById("targetTab").addEventListener("click", () => showPage("targetPage"));
})();
