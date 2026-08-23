/* Application shell navigation with one active page; Core owns analytical state and rendering. */
(function (global) {
  const pages = [
    ["misTab", "misPage"], ["actTab", "activationPage"], ["scoreTab", "scorecardPage"],
    ["targetTab", "targetPage"], ["productivityTab", "productivityPage"], ["qualityTab", "qualityPage"]
  ];
  function showPage(pageId) {
    pages.forEach(([buttonId, id]) => { document.getElementById(id).style.display = id === pageId ? "block" : "none"; document.getElementById(buttonId).classList.toggle("active-tab", id === pageId); });
    global.BancaTrackerCore.setActivePage(pageId);
  }
  pages.forEach(([buttonId, pageId]) => document.getElementById(buttonId).addEventListener("click", () => showPage(pageId)));
  showPage(global.BancaTrackerCore.state.activePage);
  global.BancaTrackerApp = Object.freeze({ showPage, pages });
})(window);
