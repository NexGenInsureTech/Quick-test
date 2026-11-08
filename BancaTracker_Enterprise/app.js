/* Application shell navigation with one active page; Core owns analytical state and rendering. */
(function (global) {
  const pages = [
    ["misTab", "misPage"], ["actTab", "activationPage"], ["scoreTab", "scorecardPage"],
    ["targetTab", "targetPage"], ["productivityTab", "productivityPage"], ["commercialTab", "commercialPage"], ["premiumCompositionTab", "premiumCompositionPage"], ["qualityTab", "qualityPage"],
    ["masterDataTab", "masterDataPage"], ["helpTab", "helpPage"]
  ];
  function showPage(pageId) {
    pages.forEach(([buttonId, id]) => { const page = document.getElementById(id); const button = document.getElementById(buttonId); if (page) page.style.display = id === pageId ? "block" : "none"; if (button) button.classList.toggle("active-tab", id === pageId); });
    global.BancaTrackerCore.setActivePage(pageId);
    if (pageId === "masterDataPage" && global.BancaTrackerMasterDataAdmin) {
      global.BancaTrackerMasterDataAdmin.render();
    }
    if (pageId === "helpPage" && global.BancaTrackerHelpGlossary) global.BancaTrackerHelpGlossary.render();
  }
  pages.forEach(([buttonId, pageId]) => { const button = document.getElementById(buttonId); if (button) button.addEventListener("click", () => showPage(pageId)); });
  showPage(global.BancaTrackerCore.state.activePage);
  global.BancaTrackerApp = Object.freeze({ showPage, pages });
})(window);
