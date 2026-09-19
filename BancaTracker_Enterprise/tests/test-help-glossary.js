const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
class FakeClassList {
  constructor() { this.values = new Set(); }
  toggle(name, force) { if (force) this.values.add(name); else this.values.delete(name); }
  contains(name) { return this.values.has(name); }
}
class FakeElement {
  constructor(tag, id) { this.tagName = String(tag).toUpperCase(); this.id = id || ""; this.children = []; this.listeners = {}; this.hidden = false; this.value = ""; this.textContent = ""; this.className = ""; this.style = {}; this.classList = new FakeClassList(); }
  appendChild(child) { this.children.push(child); return child; }
  addEventListener(type, listener) { (this.listeners[type] ||= []).push(listener); }
  dispatch(type) { (this.listeners[type] || []).forEach((listener) => listener({ target: this })); }
}
const ids = [
  "helpGettingStartedContent", "helpManualContent", "helpGlossaryCategory", "helpGlossaryResults", "helpGlossarySearch", "helpGlossaryClear", "helpGlossaryCount", "helpGlossaryEmpty", "helpInterpretationContent", "helpScopeContent", "helpDataContent", "helpTroubleshootingContent",
  "misTab", "actTab", "scoreTab", "targetTab", "productivityTab", "commercialTab", "qualityTab", "masterDataTab", "helpTab",
  "misPage", "activationPage", "scorecardPage", "targetPage", "productivityPage", "commercialPage", "qualityPage", "masterDataPage", "helpPage"
];
const elements = Object.fromEntries(ids.map((id) => [id, new FakeElement("div", id)]));
elements.helpGlossarySearch.value = ""; elements.helpGlossaryCategory.value = "";
const document = { getElementById: (id) => elements[id] || null, createElement: (tag) => new FakeElement(tag) };
const window = { document, console };
const context = vm.createContext({ window, document, console, Object, Number, String });
function load(file) { vm.runInContext(read(file), context, { filename: file }); }
load("js/config.js"); load("js/dataQualityGuidance.js"); load("js/analytics/branchMaturityComparison.js"); load("js/helpGlossary.js");
const help = window.BancaTrackerHelpGlossary;
const textOf = (node) => [node.textContent, ...node.children.flatMap((child) => textOf(child))].join(" ");
const allHelpText = () => ["helpGettingStartedContent", "helpManualContent", "helpGlossaryResults", "helpInterpretationContent", "helpScopeContent", "helpDataContent", "helpTroubleshootingContent"].map((id) => textOf(elements[id])).join(" ");
const visible = () => elements.helpGlossaryResults.children.filter((node) => !node.hidden);
const filter = (query, category = "") => { elements.helpGlossarySearch.value = query; elements.helpGlossaryCategory.value = category; return help.applyFilters(); };

assert(help && Object.isFrozen(help.CATALOG), "catalogue should be frozen and available offline");
assert(help.CATALOG.length >= 55 && help.CATALOG.length <= 75, `expected approximately 55-70 terms, got ${help.CATALOG.length}`);
assert.strictEqual(new Set(help.CATALOG.map((item) => item.id)).size, help.CATALOG.length, "term IDs must be unique");
assert.deepStrictEqual(Array.from(help.CATEGORIES), ["Core & Premium", "Activation & Opportunity", "Commercial Performance", "Comparison & Movement", "Execution & Priority", "Data Quality & Governance", "Data & Master", "Target & Growth"]);
help.CATALOG.forEach((item) => { assert(item.source && item.confidence); assert(elements.helpGlossaryResults.children.some((node) => node.id === `help-term-${item.id}`)); });

assert(filter("ACTIVE BRANCH") >= 1, "term search should be case-insensitive");
assert(filter("signed premium amount") >= 1, "definition search should work");
assert(filter("opportunity gap") >= 1, "related-term search should work");
assert(filter("management scorecard") >= 1, "page-reference search should work");
assert(filter("branch", "Activation & Opportunity") > 0 && visible().every((node) => node.children[0].textContent === "Activation & Opportunity"), "search and category must combine");
filter("no-such-governed-term"); assert.strictEqual(visible().length, 0); assert.strictEqual(elements.helpGlossaryEmpty.hidden, false);
help.clearFilters(); assert.strictEqual(visible().length, help.CATALOG.length); assert.strictEqual(elements.helpGlossarySearch.value, ""); assert.strictEqual(elements.helpGlossaryCategory.value, ""); assert.strictEqual(elements.helpGlossaryEmpty.hidden, true);
filter("<img src=x onerror=alert(1)>"); assert.strictEqual(elements.helpGlossaryResults.children.length, help.CATALOG.length); assert(!read("js/helpGlossary.js").includes("innerHTML"), "search must never enter HTML rendering");

const active = help.CATALOG.find((item) => item.id === "active-branch");
const near = help.CATALOG.find((item) => item.id === "near-active-branch");
assert(active.runtimeDefinition().includes("₹25,000"));
assert(near.runtimeDefinition().includes("₹15,000") && near.runtimeDefinition().includes("strictly less than") && near.runtimeDefinition().includes("₹25,000"));
assert.deepStrictEqual(Array.from(help.maturityBands), Array.from(window.BancaTrackerBranchMaturityComparison.BAND_ORDER));
assert.deepStrictEqual(Object.assign({}, help.modes), Object.assign({}, window.BancaTrackerDataQualityGuidance.MODES));
const definition = (id) => help.CATALOG.find((item) => item.id === id).definition;
assert.notStrictEqual(definition("target"), definition("budget")); assert(definition("budget").includes("distinct from Target"));
assert(definition("potential").includes("neither Target") && definition("potential").includes("missing Budget"));

const source = read("js/helpGlossary.js"); const html = read("index.html"); const appSource = read("app.js"); const css = read("style.css");
["Equivalent Elapsed-Day Comparison", "Equivalent Elapsed-Day Detail", "Base Month Daily Premium", "Comparison Month Daily Premium", "Cumulative Premium"].forEach((term) => assert(source.includes(term)));
assert(source.includes("zero decimal places") && source.includes("CSV exports retain underlying precision"));
assert(source.includes("aggregate Bank comparison entity across all facts remaining under the existing comparison scope") && source.includes("not a new source channel"));
assert(source.includes("Top-100") && source.includes("complete governed eligible population"));
assert(source.includes("Movement Filter") && source.includes("presentation-only") && source.includes("complete selected transition"));
assert(source.includes("Performance MIS, Activation Cockpit, Management Scorecard, Target & Growth, and Productivity & Opportunity"));
assert(source.includes("does not universally follow global Month/Bank") || source.includes("independent commercial"));
assert(source.includes("Negative premium") && source.includes("Do not remove or reverse the sign automatically"));
assert(source.includes("N/A is not zero") && source.includes("missing as zero"));
assert(source.includes("not a prediction") && source.includes("not a forecast"));
assert(!source.includes("factData"), "Help must not depend on uploaded facts");

const requiredSections = ["Getting Started", "User Manual", "KPI &amp; Field Glossary", "Interpretation Guide", "Understanding Filters &amp; Scope", "Data &amp; Master Reference", "Data Quality &amp; Troubleshooting"];
requiredSections.forEach((heading) => assert(html.includes(heading)));
const navIds = ["misTab", "actTab", "scoreTab", "targetTab", "productivityTab", "commercialTab", "qualityTab", "masterDataTab", "helpTab"];
let last = -1; navIds.forEach((id) => { const next = html.indexOf(`id="${id}"`); assert(next > last, `${id} missing or out of order`); last = next; });
assert(html.includes('id="helpPage"') && html.includes('id="helpTab"'));
assert(css.includes(".help-section-nav") && css.includes("@media(max-width:900px)") && css.includes("overflow-wrap: anywhere"));
assert(allHelpText().includes("Prepare and import PR data") && allHelpText().includes("Workforce Deployment v2"));

window.BancaTrackerCore = { state: { activePage: "misPage" }, setActivePage(pageId) { this.state.activePage = pageId; } };
load("app.js"); window.BancaTrackerApp.showPage("helpPage");
assert.strictEqual(elements.helpPage.style.display, "block");
["misPage", "activationPage", "scorecardPage", "targetPage", "productivityPage", "commercialPage", "qualityPage", "masterDataPage"].forEach((id) => assert.strictEqual(elements[id].style.display, "none"));
assert(elements.helpTab.classList.contains("active-tab"));
assert.deepStrictEqual(Array.from(window.BancaTrackerApp.pages).map((pair) => pair[0]), navIds);
assert(appSource.includes('["helpTab", "helpPage"]'));

console.log(`PASS help, manual and glossary (${help.CATALOG.length} terms)`);
