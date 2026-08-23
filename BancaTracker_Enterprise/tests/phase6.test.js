/* Dependency-free parser, validation, security, analytics, and boundary tests. */
const assert = require("assert"); const path = require("path");
class Element { constructor() { this.value = ""; this.innerHTML = ""; this.textContent = ""; this.style = {}; this.classList = { toggle() {} }; } addEventListener() {} add() {} }
const elements = {}; global.window = global; global.document = { getElementById(id) { return elements[id] || (elements[id] = new Element()); } }; global.Option = class {}; global.sessionStorage = { getItem() { return null; }, setItem() {} }; global.performance = require("perf_hooks").performance;
const load = (file) => require(path.join(__dirname, "..", file)); load("js/config.js"); load("js/csvProcessor.js"); load("js/utilities.js"); load("js/analytics.js"); load("js/dataQuality.js"); load("js/productivity.js"); load("js/core.js"); load("js/performance.js"); load("app.js"); load("js/activation.js"); load("js/scorecard.js"); load("js/target.js");
const H = "USGI NET PREMIUM,Month,INTERMEDIARY,BA NAME,Ba Code,LINE OF BUSINESS,BRANCH NAME,Zone,STATE,SUM IMD CODE";
const special = `\uFEFF${H}\n15000,Apr-26,INDIAN BANK,"RM, One",A1,Motor,"Shared ""Branch""",<script>alert(1)</script>,Tamil Nadu,I1\n24999,May-26,KARNATAKA BANK,RM Two,A2,Health,Shared Branch,South,Karnataka,I2\n25000,Jun-26,INDIAN BANK,RM One,A1,Motor,Shared Branch,South,Tamil Nadu,I1`;
const processed = BancaTrackerCsvProcessor.process(special, BancaTrackerConfig);
assert.strictEqual(processed.rows.length, 3); assert.strictEqual(processed.rows[0].rm, "RM, One"); assert.strictEqual(processed.rows[0].branch, 'Shared "Branch"');
const derived = BancaTrackerAnalytics.build(processed.rows); assert.strictEqual(derived.branches.length, 3); assert.strictEqual(derived.nearActiveBranches.length, 2); assert.strictEqual(derived.activeBranches.length, 1);
assert.strictEqual(BancaTrackerUtils.escapeHtml("<script>alert(1)</script>"), "&lt;script&gt;alert(1)&lt;/script&gt;");
assert.throws(() => BancaTrackerCsvProcessor.parseCSV('a,"open'), /not closed/);
assert.throws(() => BancaTrackerCsvProcessor.process("bad,headers\n1,2", BancaTrackerConfig), /missing mandatory/);
assert.throws(() => BancaTrackerCsvProcessor.process(`${H}\nbad,Apr-26,INDIAN BANK,RM,A,Motor,B,Z,S,I`, BancaTrackerConfig), /no usable data rows/);
const invalid = BancaTrackerCsvProcessor.process(`${H}\nabc,Apr-26,INDIAN BANK,RM,A,Motor,B,Z,S,I\n10,,INDIAN BANK,RM,A,Motor,B,Z,S,I\n10,Apr-26,INDIAN BANK,,,Motor,B,Z,S,`, BancaTrackerConfig);
assert.strictEqual(invalid.summary.acceptedRows, 1); assert.strictEqual(invalid.summary.rejectedRows, 2); assert.strictEqual(invalid.summary.warningRows, 1);
BancaTrackerCore.loadCsvText(special); BancaTrackerCore.state.filters.month = "May-26"; BancaTrackerCore.refresh(); const context = BancaTrackerCore.getPerformanceContext(); assert.strictEqual(context.ytdPremium, 39999); assert.strictEqual(context.mtdPremium, 24999);
assert.strictEqual(BancaTrackerScorecard.classifyPriority({ premium: 1, activeBranches: 0, nearActiveBranches: 1, activationPercent: 19 }), "HIGH"); assert.strictEqual(BancaTrackerScorecard.classifyPriority({ premium: 1, activeBranches: 1, nearActiveBranches: 0, activationPercent: 40 }), "LOW");
BancaTrackerCore.state.filters.month = "Apr-26"; BancaTrackerCore.refresh(); BancaTrackerApp.showPage("activationPage"); assert.ok(!elements.zoneActivation.innerHTML.includes("<script>alert(1)</script>")); assert.ok(elements.zoneActivation.innerHTML.includes("&lt;script&gt;"));
console.log("Phase 6 tests passed: parsing, validation, boundaries, YTD/MTD, scorecard, and HTML safety.");
