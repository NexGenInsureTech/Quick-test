/* v8.6 Step 6F.2: Priority-table drill-down affordance contract. */
"use strict";

const assert = require("assert");
const childProcess = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const source = fs.readFileSync(path.join(root, "js/commercialPerformanceUI.js"), "utf8");
const css = fs.readFileSync(path.join(root, "style.css"), "utf8");
const drilldown = fs.readFileSync(path.join(root, "js/analytics/commercialExecutionDrilldown.js"), "utf8");
const GAP = "CONTRACT GAP: Step 6F.3 must make Priority entity drill-down controls explicitly discoverable.";

const priorityRenderer = source.slice(source.indexOf("function renderExecutionPriority"), source.indexOf("function clearExecutionDrilldown"));
const executionTableRenderer = source.slice(source.indexOf("function renderExecutionTable"), source.indexOf("function renderExecutionPriority"));

// Deliberate initial boundary: both Priority views need the compact visible cue
// inside their existing entity button, rather than a row-wide interaction.
assert.match(priorityRenderer, /commercial-priority-drilldown-cue/, GAP);

// Reference and Execution Priority retain the same native, Priority-specific
// entity-control pattern and expose an explicit action name for assistive tech.
const priorityButtons = priorityRenderer.match(/<button\b[^>]*commercial-priority-drilldown-select[^>]*>/g) || [];
assert.strictEqual(priorityButtons.length, 2, "Reference and Execution Priority each render one Priority-specific native entity button pattern");
priorityButtons.forEach((markup) => {
  assert.match(markup, /type="button"/, "entity control remains a native button");
  assert.match(markup, /commercial-drilldown-select/, "shared delegated selector remains present");
  assert.match(markup, /aria-label="Drill down into \$\{escape\(row\.label\)\}"/, "button has an explicit drill-down action name");
});
assert.strictEqual((priorityRenderer.match(/commercial-priority-drilldown-cue/g) || []).length, 2, "Reference and Execution Priority use the same compact cue class");
assert.match(priorityRenderer, /<button[^>]*commercial-priority-drilldown-select[^>]*>[\s\S]*?<span[^>]*commercial-priority-drilldown-cue[^>]*aria-hidden="true"/, "cue belongs to the entity button and is excluded from its accessible name");
assert.doesNotMatch(executionTableRenderer, /commercial-priority-drilldown-(?:select|cue)/, "Priority-specific affordance does not leak into the main Execution table");

// The cue remains part of the existing delegated path; no cue-specific handler
// or clickable rows/cells are permitted.
assert.match(source, /event\.target\.closest\s*&&\s*event\.target\.closest\("\.commercial-drilldown-select"\)/, "delegated button selection remains authoritative for nested cue clicks");
assert.match(source, /\[element\("executionTable"\), element\("executionPriorityTable"\)\]\.forEach/, "Priority uses the existing delegated container");
assert.doesNotMatch(priorityRenderer, /<tr[^>]*(?:onclick|role="button")|<td[^>]*(?:onclick|role="button")/, "rows and metric cells remain display-only");
assert.doesNotMatch(priorityRenderer, /addEventListener\("click"/, "no Priority-local cue handler is introduced");

// Styling strengthens the existing compact link/button without adding an action
// column or heavy permanent button chrome.
assert.match(css, /\.commercial-priority-drilldown-select\s*\{[^}]*cursor:\s*pointer/, "Priority control has a pointer affordance at rest");
assert.match(css, /\.commercial-priority-drilldown-select:hover[^}]*|\.commercial-priority-drilldown-select:focus-visible/, "Priority control has hover or keyboard-focus feedback");
assert.match(css, /\.commercial-priority-drilldown-select:focus-visible|\.commercial-priority-drilldown-select:hover/, "Priority control defines focus-visible feedback");
assert.match(css, /\.commercial-priority-drilldown-cue\s*\{[^}]*display:\s*inline/, "cue is compact and inline with the label");
assert.doesNotMatch(priorityRenderer, /<th>\s*Drill down\s*<\/th>/i, "no permanent drill-down column is added");

// Terminal Branch selection and the supplied drill authority remain unchanged.
assert.match(source, /Branch is the terminal commercial execution level/, "terminal Branch context remains supported");
assert.match(drilldown, /BRANCH:\s*Object\.freeze\(\[\]\)/, "Branch remains terminal in the authority path map");
assert.strictEqual(childProcess.execFileSync("git", ["diff", "--name-only", "--", "js/analytics/commercialExecutionDrilldown.js"], { cwd: root, encoding: "utf8" }).trim(), "", "drill-down authority remains untouched");

// Priority presentation remains a consumer of supplied authority results only.
assert.doesNotMatch(priorityRenderer, /priorityRank\s*=|priorityRank\+\+|executionPriority\.sort|referencePriority\.sort|projectedShortfallAmount\s*=/, "Priority renderer does not calculate or reorder authority results");
assert.doesNotMatch(source, /Repository|IndexedDB|fetch\(|https?:\/\//, "no persistence, network, or dependency path is introduced for the affordance");

console.log("Step 6F.2 Priority-table affordance contract passed.");
