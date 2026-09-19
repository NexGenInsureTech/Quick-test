(function (global) {
  "use strict";

  // Governance: a change to a governed KPI, formula, threshold, label, scope,
  // readiness, master, or export contract must update this catalogue and its tests.
  const CATEGORIES = Object.freeze([
    "Core & Premium", "Activation & Opportunity", "Commercial Performance", "Comparison & Movement",
    "Execution & Priority", "Data Quality & Governance", "Data & Master", "Target & Growth"
  ]);
  const SOURCE = Object.freeze({ CORE: "configured-business-contract", COMMERCIAL: "commercial-presentation-contract", DQ: "data-quality-guidance", MASTER: "master-data-contract" });
  const formatThreshold = (value) => `₹${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
  const thresholds = () => (global.BancaTrackerConfig && global.BancaTrackerConfig.THRESHOLDS) || {};
  const activeDefinition = () => `A branch with current-period premium greater than or equal to the configured Active threshold (${formatThreshold(thresholds().ACTIVE_BRANCH)}).`;
  const nearActiveDefinition = () => `A branch with premium greater than or equal to the configured Near Active minimum (${formatThreshold(thresholds().NEAR_ACTIVE_MIN)}) and strictly less than the Active threshold (${formatThreshold(thresholds().ACTIVE_BRANCH)}).`;

  function entry(id, term, category, definition, options) {
    const extra = options || {};
    return Object.freeze({
      id, term, category, definition,
      interpretation: extra.interpretation || `Use ${term} in its stated page and scope context.`,
      caution: extra.caution || "Do not interpret this value outside its stated scope.",
      source: extra.source || SOURCE.CORE,
      pageRefs: Object.freeze(extra.pageRefs || ["Performance MIS"]),
      relatedTerms: Object.freeze(extra.relatedTerms || []),
      confidence: extra.confidence || "governed",
      formula: extra.formula || "", unit: extra.unit || "", scope: extra.scope || "",
      runtimeDefinition: extra.runtimeDefinition || null
    });
  }
  const e = entry;
  const CATALOG = Object.freeze([
    e("premium", "Premium / USGI Net Premium", "Core & Premium", "The signed premium amount supplied by accepted PR business data; positive and negative adjustments remain part of the governed value. Absolute rupee UI values display with ₹, Indian grouping, and zero decimal places, while calculations and CSV exports retain underlying precision.", { unit: "Absolute rupees", pageRefs: ["Performance MIS", "Commercial Performance"], relatedTerms: ["Current Premium", "Absolute Rupee Display"] }),
    e("current-premium", "Current Premium", "Core & Premium", "Premium in the current page's selected reporting period and scope.", { pageRefs: ["Performance MIS", "Activation Cockpit"], relatedTerms: ["Current Period", "Premium"] }),
    e("current-period", "Current Period", "Core & Premium", "The reporting period resolved from the selected Month and Bank; Month = ALL follows configured fiscal-month/current Bank scope semantics.", { pageRefs: ["Performance MIS", "Activation Cockpit", "Management Scorecard", "Target & Growth", "Productivity & Opportunity"] }),
    e("active-branch", "Active Branch", "Activation & Opportunity", "Configured at runtime.", { runtimeDefinition: activeDefinition, pageRefs: ["Activation Cockpit", "Productivity & Opportunity"], relatedTerms: ["Near Active Branch", "Zero Branch"] }),
    e("near-active-branch", "Near Active Branch", "Activation & Opportunity", "Configured at runtime.", { runtimeDefinition: nearActiveDefinition, pageRefs: ["Activation Cockpit", "Productivity & Opportunity"], relatedTerms: ["Active Branch", "Gap to ₹25K"] }),
    e("zero-branch", "Zero Branch", "Activation & Opportunity", "A branch with zero premium in the governed period; it is not a synonym for every inactive branch.", { pageRefs: ["Activation Cockpit"], relatedTerms: ["Active Branch"] }),
    e("activation", "Activation", "Activation & Opportunity", "Branch participation measured against the applicable observed or governed branch universe.", { pageRefs: ["Activation Cockpit", "Management Scorecard"], relatedTerms: ["Branch Universe"] }),
    e("activation-gap", "Activation Gap", "Activation & Opportunity", "A context-qualified shortfall in activation; the unit may be branch count, percentage points, or premium opportunity depending on the surface.", { pageRefs: ["Activation Cockpit", "Productivity & Opportunity"], relatedTerms: ["Opportunity Gap"] }),
    e("opportunity-ownership", "Opportunity Ownership", "Activation & Opportunity", "Governed ownership of eligible branch opportunity. The visible table may show Top-100 rows; CSV exports the complete governed eligible population.", { pageRefs: ["Productivity & Opportunity"], relatedTerms: ["Unassigned"] }),
    e("gap-to-25k", "Gap to ₹25K", "Activation & Opportunity", "The non-negative rupee amount needed for a branch to reach the configured Active threshold, commonly ₹25K.", { formula: "max(0, Active threshold − branch premium)", pageRefs: ["Productivity & Opportunity"], relatedTerms: ["Opportunity Gap"] }),
    e("observed-branch", "Observed Branch", "Activation & Opportunity", "A resolved branch represented by accepted facts in the applicable scope.", { relatedTerms: ["Branch Universe"] }),
    e("branch-universe", "Branch Universe", "Activation & Opportunity", "The applicable configured or governed population used as the denominator for branch coverage measures.", { pageRefs: ["Activation Cockpit", "Productivity & Opportunity"] }),
    e("branch-maturity", "Branch Maturity", "Commercial Performance", "A comparison of branch premium development between independently selected months.", { pageRefs: ["Commercial Performance"], relatedTerms: ["Branch Maturity Band"] }),
    e("branch-maturity-band", "Branch Maturity Band", "Commercial Performance", "A governed premium range used to classify a branch for maturity distribution and transition analysis.", { pageRefs: ["Commercial Performance"], relatedTerms: ["Upgraded", "Downgraded"] }),
    e("all-channels", "All Channels", "Commercial Performance", "The aggregate Bank comparison entity across all facts remaining under the existing comparison scope; it is not a new source channel.", { pageRefs: ["Commercial Performance"] }),
    e("base-month", "Base Month", "Comparison & Movement", "The independently selected reference month in a commercial comparison.", { pageRefs: ["Commercial Performance"], relatedTerms: ["Comparison Month"] }),
    e("comparison-month", "Comparison Month", "Comparison & Movement", "The independently selected month evaluated against the Base Month.", { pageRefs: ["Commercial Performance"], relatedTerms: ["Base Month"] }),
    e("base-month-daily-premium", "Base Month Daily Premium", "Comparison & Movement", "Signed daily premium for the Base Month.", { pageRefs: ["Commercial Performance"] }),
    e("comparison-month-daily-premium", "Comparison Month Daily Premium", "Comparison & Movement", "Signed daily premium for the Comparison Month.", { pageRefs: ["Commercial Performance"] }),
    e("equivalent-elapsed-day-comparison", "Equivalent Elapsed-Day Comparison", "Comparison & Movement", "Compares the Base Month and Comparison Month through the same valid transaction-day horizon.", { pageRefs: ["Commercial Performance"], relatedTerms: ["Through Day"] }),
    e("equivalent-elapsed-day-detail", "Equivalent Elapsed-Day Detail", "Comparison & Movement", "Day-level detail supporting the equivalent elapsed-day comparison.", { pageRefs: ["Commercial Performance"] }),
    e("cumulative-premium", "Cumulative Premium", "Comparison & Movement", "Signed premium accumulated through each valid transaction day.", { pageRefs: ["Commercial Performance"] }),
    e("through-day", "Through Day", "Comparison & Movement", "The common valid transaction-day horizon used by the elapsed-day comparison.", { pageRefs: ["Commercial Performance"] }),
    e("daily-growth", "Daily Growth", "Comparison & Movement", "Daily change divided by Base daily premium when the Base denominator is positive.", { formula: "(Comparison − Base) ÷ Base × 100, when Base > 0", unit: "Percent", pageRefs: ["Commercial Performance"] }),
    e("cumulative-growth", "Cumulative Growth", "Comparison & Movement", "Cumulative change divided by Base cumulative premium when the Base denominator is positive.", { formula: "(Comparison − Base) ÷ Base × 100, when Base > 0", unit: "Percent", pageRefs: ["Commercial Performance"] }),
    e("branch-movement", "Branch Movement", "Comparison & Movement", "Governed branch transition between selected maturity months. The visible table may show Top-100 rows; full CSV exports the complete selected transition.", { pageRefs: ["Commercial Performance"], relatedTerms: ["Movement Filter"] }),
    e("upgraded", "Upgraded", "Comparison & Movement", "A comparable branch that moved to a higher governed maturity band.", { pageRefs: ["Commercial Performance"] }),
    e("downgraded", "Downgraded", "Comparison & Movement", "A comparable branch that moved to a lower governed maturity band.", { pageRefs: ["Commercial Performance"] }),
    e("unchanged", "Unchanged", "Comparison & Movement", "A comparable branch that remained in the same governed maturity band.", { pageRefs: ["Commercial Performance"] }),
    e("not-comparable", "Not Comparable", "Comparison & Movement", "A branch lacking the governed evidence needed for a like-for-like selected-month transition.", { pageRefs: ["Commercial Performance"] }),
    e("zero-to-active", "Zero to Active", "Comparison & Movement", "A branch moving from zero premium in the Base Month to the Active band or above in the Comparison Month.", { pageRefs: ["Commercial Performance"] }),
    e("active-to-zero", "Active to Zero", "Comparison & Movement", "A branch moving from the Active band or above in the Base Month to zero premium in the Comparison Month.", { pageRefs: ["Commercial Performance"] }),
    e("presence-status", "Presence Status", "Comparison & Movement", "Whether a governed branch is represented in both selected periods or only one.", { pageRefs: ["Commercial Performance"], relatedTerms: ["Base Only", "Comparison Only"] }),
    e("base-only", "Base Only", "Comparison & Movement", "A branch present in the Base Month but not represented in the Comparison Month.", { pageRefs: ["Commercial Performance"] }),
    e("comparison-only", "Comparison Only", "Comparison & Movement", "A branch present in the Comparison Month but not represented in the Base Month.", { pageRefs: ["Commercial Performance"] }),
    e("execution-priority", "Execution Priority", "Execution & Priority", "A deterministic operational prioritisation based on current governed inputs; it is not a prediction or AI judgment.", { pageRefs: ["Commercial Performance"], relatedTerms: ["Reference Priority"] }),
    e("reference-priority", "Reference Priority", "Execution & Priority", "A comparison priority used to explain how current execution priority differs from the reference view; it is not a prediction.", { pageRefs: ["Commercial Performance"] }),
    e("required-daily-run-rate", "Required Daily Run Rate", "Execution & Priority", "The average premium needed on each remaining day to close the remaining Budget, when remaining days permit calculation.", { formula: "Remaining Budget ÷ Remaining Days", pageRefs: ["Commercial Performance"] }),
    e("projected-month-end-actual", "Projected Month-end Actual", "Execution & Priority", "A simple linear projection based on observed Average Daily Actual, not a forecast or prediction.", { formula: "Average Daily Actual × Days in Month", pageRefs: ["Commercial Performance"] }),
    e("projected-achievement", "Projected Achievement", "Execution & Priority", "Projected Month-end Actual divided by Budget when Budget is positive; it remains a linear pacing indicator.", { formula: "Projected Month-end Actual ÷ Budget × 100, when Budget > 0", pageRefs: ["Commercial Performance"] }),
    e("as-of-day", "As-of Day", "Execution & Priority", "The selected observation cutoff day for commercial execution pacing.", { pageRefs: ["Commercial Performance"] }),
    e("pace", "Pace", "Execution & Priority", "Progress relative to a stated time-phased reference; pace is not a prediction.", { pageRefs: ["Target & Growth", "Commercial Performance"] }),
    e("average-daily-actual", "Average Daily Actual", "Execution & Priority", "Actual premium to date divided by observed days.", { formula: "Actual to Date ÷ Observed Days", pageRefs: ["Commercial Performance"] }),
    e("data-quality", "Data Quality", "Data Quality & Governance", "Diagnostics over the full accepted-upload context; findings guide investigation and do not automatically mutate source data.", { source: SOURCE.DQ, pageRefs: ["Data Quality"] }),
    e("error", "Error", "Data Quality & Governance", "A condition that prevents reliable acceptance or use of affected data.", { source: SOURCE.DQ, pageRefs: ["Data Quality"] }),
    e("warning", "Warning", "Data Quality & Governance", "A condition requiring attention whose impact depends on evidence and context.", { source: SOURCE.DQ, pageRefs: ["Data Quality"] }),
    e("info", "Info", "Data Quality & Governance", "An informational diagnostic that may describe scope rather than an error.", { source: SOURCE.DQ, pageRefs: ["Data Quality"] }),
    e("correct", "CORRECT", "Data Quality & Governance", "Action mode for a proven invalid source value that should be corrected using authoritative evidence.", { source: SOURCE.DQ, pageRefs: ["Data Quality"] }),
    e("verify", "VERIFY", "Data Quality & Governance", "Action mode requiring comparison with the governing source before any correction.", { source: SOURCE.DQ, pageRefs: ["Data Quality"] }),
    e("review", "REVIEW", "Data Quality & Governance", "Action mode for a signal that may be legitimate and must not trigger automatic deletion or mutation.", { source: SOURCE.DQ, pageRefs: ["Data Quality"] }),
    e("information", "INFORMATION", "Data Quality & Governance", "Action mode describing scope or context where no correction is necessarily required.", { source: SOURCE.DQ, pageRefs: ["Data Quality"] }),
    e("canonical", "Canonical", "Data Quality & Governance", "A value resolved through the governed current authority and readiness process.", { source: SOURCE.DQ, pageRefs: ["Data Quality"] }),
    e("legacy", "Legacy", "Data Quality & Governance", "A compatible earlier field, profile, or result retained for migration and reconciliation context.", { source: SOURCE.DQ, pageRefs: ["Data Quality", "Master Data"] }),
    e("mapped", "Mapped", "Data Quality & Governance", "A source identity resolved uniquely to the applicable governed reference.", { source: SOURCE.DQ, pageRefs: ["Data Quality"] }),
    e("unmapped", "Unmapped", "Data Quality & Governance", "A source identity that could not be resolved to the applicable governed reference.", { source: SOURCE.DQ, pageRefs: ["Data Quality"] }),
    e("ambiguous", "Ambiguous", "Data Quality & Governance", "A source identity matching more than one possible governed record, so no unique choice can be made safely.", { source: SOURCE.DQ, pageRefs: ["Data Quality"] }),
    e("ready", "READY", "Data Quality & Governance", "Readiness state indicating governed requirements for the stated capability are satisfied.", { source: SOURCE.DQ, pageRefs: ["Data Quality"] }),
    e("partial", "PARTIAL", "Data Quality & Governance", "Readiness state indicating only part of the governed coverage or capability is available.", { source: SOURCE.DQ, pageRefs: ["Data Quality"] }),
    e("mapping-conflict", "Mapping Conflict", "Data Quality & Governance", "Conflicting source-to-governed relationships requiring evidence-led investigation.", { source: SOURCE.DQ, pageRefs: ["Data Quality"] }),
    e("reconciliation", "Reconciliation", "Data Quality & Governance", "Evidence comparing governed views or totals so explained and unexplained differences remain visible.", { source: SOURCE.DQ, pageRefs: ["Data Quality", "Commercial Performance"] }),
    e("durable-branch-id", "Durable Branch ID", "Data & Master", "The stable governed branch identity used across name changes and reporting periods.", { source: SOURCE.MASTER, pageRefs: ["Master Data", "Data Quality"] }),
    e("unassigned", "Unassigned", "Data & Master", "A governed result for which no unique applicable owner was resolved; it is not silently attributed.", { source: SOURCE.MASTER, pageRefs: ["Productivity & Opportunity", "Data Quality"] }),
    e("budget", "Budget", "Target & Growth", "A governed commercial benchmark used for achievement and execution pacing; it is distinct from Target and Potential.", { formula: "Expected Budget to Date = Monthly Budget × As-of Day ÷ Days in Month", pageRefs: ["Target & Growth", "Commercial Performance"] }),
    e("target", "Target", "Target & Growth", "A configured goal used by Target & Growth; it is distinct from governed Budget and Potential.", { formula: "Monthly phasing = Annual Target ÷ 12", pageRefs: ["Target & Growth"] }),
    e("potential", "Potential", "Target & Growth", "A governed estimate of addressable branch potential; it is neither Target nor a substitute for missing Budget.", { pageRefs: ["Commercial Performance", "Target & Growth"] }),
    e("achievement", "Achievement", "Target & Growth", "Actual divided by Budget when Budget is positive.", { formula: "Actual ÷ Budget × 100, when Budget > 0", unit: "Percent", pageRefs: ["Commercial Performance", "Target & Growth"] }),
    e("budget-gap", "Budget Gap", "Target & Growth", "The signed or remaining difference between Actual and Budget, as labelled by the surface.", { pageRefs: ["Commercial Performance"] }),
    e("target-gap", "Target Gap", "Target & Growth", "The difference between Actual and configured Target in the applicable Target & Growth scope.", { pageRefs: ["Target & Growth"] }),
    e("shortfall", "Shortfall", "Target & Growth", "A non-negative amount still required to meet the stated benchmark.", { pageRefs: ["Target & Growth", "Commercial Performance"] }),
    e("contribution-percent", "Contribution %", "Target & Growth", "A component's premium divided by the applicable total premium, subject to a valid denominator.", { unit: "Percent", pageRefs: ["Performance MIS", "Commercial Performance"] }),
    e("ytd", "YTD", "Target & Growth", "Fiscal year-to-date scope through the selected or resolved reporting month.", { pageRefs: ["Target & Growth", "Commercial Performance"] }),
    e("fy", "FY", "Target & Growth", "The configured fiscal-year scope. Remaining run rate (RRR) is (Annual Target − YTD Actual) ÷ Remaining Months.", { pageRefs: ["Target & Growth", "Commercial Performance"] })
  ]);

  const maturityBands = Object.freeze(((global.BancaTrackerBranchMaturityComparison || {}).BAND_ORDER || []).slice());
  const modes = Object.freeze(Object.assign({}, (global.BancaTrackerDataQualityGuidance || {}).MODES || {}));
  let rendered = false;
  let termNodes = [];
  const byId = (id) => document.getElementById(id);
  const append = (parent, tag, text, className) => { const node = document.createElement(tag); if (text !== undefined) node.textContent = text; if (className) node.className = className; parent.appendChild(node); return node; };
  function addDetails(container, title, paragraphs) {
    const details = append(container, "details"); append(details, "summary", title);
    paragraphs.forEach((text) => append(details, "p", text)); return details;
  }
  function renderStaticContent() {
    const start = byId("helpGettingStartedContent");
    const steps = ["Prepare and import PR data.", "Review Data Quality findings and action guidance.", "Load or maintain required Master Data; valid active datasets persist in this browser.", "Select global Month and Bank where the page uses them.", "Review operational dashboards.", "Use Commercial Performance's independent analytical controls.", "Configure Target & Growth where required.", "Export full operational results where available."];
    const list = append(start, "ol"); steps.forEach((step) => append(list, "li", step));
    const manual = byId("helpManualContent");
    [
      ["Performance MIS", "Answers how premium is distributed across the current global Month/Bank scope.", "Use Month and Bank; review crore cards and MIS tables. Confirm scope before comparing results. Use available exports for detail."],
      ["Activation Cockpit", "Answers how many branches are Active, Near Active, or Zero in the current global scope.", "Use global Month/Bank controls; review activation and opportunity. Inactive does not always mean Zero."],
      ["Management Scorecard", "Answers how management KPIs compare in the current global scope.", "Use Month and Bank; review scorecards and denominators. A percentage needs its governed denominator."],
      ["Target & Growth", "Answers progress against configured Target in the current global scope.", "Configure annual targets where required. Target is not governed Budget or Potential; ₹ Cr inputs retain their governed precision."],
      ["Productivity & Opportunity", "Answers productivity and branch opportunity ownership in the current-period global Month/Bank scope.", "The Opportunity Ownership table is display-bounded (Top-100 where applicable); CSV contains the complete governed eligible population."],
      ["Commercial Performance", "Answers commercial period, comparison, movement, execution, priority, and driver questions using largely independent controls.", "Select commercial Month/YTD/FY, comparison months, maturity months and execution inputs. Elapsed-day and full-month comparisons differ; bounded movement display does not limit the full transition export."],
      ["Data Quality", "Answers what should be corrected, verified, reviewed, or understood across the full accepted upload.", "Findings do not automatically mutate data. Use each finding's What to do guidance and correction source."],
      ["Master Data", "Answers which browser-local reference datasets are active and how imports are governed.", "Preview, validate, then activate or replace. An invalid replacement does not replace a valid active dataset; use generated schema help for the current import contract."]
    ].forEach(([title, answer, guidance]) => addDetails(manual, title, [answer, guidance]));
    const interpretation = byId("helpInterpretationContent");
    [
      ["High premium with low activation", "Premium is concentrated in fewer branches.", "Check branch universe, identity resolution, and concentration.", "Do not conclude broad participation."],
      ["Strong activation with weak productivity", "Many branches participate but output per observed or active branch is low.", "Check mix, signed adjustments, and denominator.", "Do not infer individual performance without governed ownership evidence."],
      ["Near-active concentration", "Many branches are close to the configured Active threshold.", "Check opportunity ownership and threshold gaps.", "Do not treat this as guaranteed conversion."],
      ["Actual below Budget", "Current actual trails the governed benchmark.", "Check As-of Day, remaining days, and Required Daily Run Rate.", "Do not call a final miss before the period closes."],
      ["Actual above Potential", "Observed actual exceeds recorded potential.", "Check potential currency, period, coverage, and reference freshness.", "Do not automatically cap or change actual."],
      ["Missing Budget/Potential", "A benchmark-dependent output may be unavailable.", "Check master coverage and identity mapping.", "Do not treat missing as zero."],
      ["Negative premium adjustments", "Cancellations, refunds, or adjustments reduce signed totals.", "Check the source transaction and Data Quality guidance.", "Do not remove or reverse the sign automatically."],
      ["Partial commercial coverage", "Only part of the governed commercial population has usable reference coverage.", "Check readiness and missing mappings.", "Do not generalise partial results to the full population."],
      ["Equivalent elapsed-day vs full-month", "Elapsed-day aligns valid transaction-day horizons; full-month compares complete selected months.", "Check Through Day before interpreting change.", "Do not assume the two views answer the same question."],
      ["Branch maturity movement", "Upgrade or downgrade describes governed band movement.", "Check both selected months and signed premium.", "Do not treat movement as causal evidence."],
      ["Base-only/Comparison-only branches", "Presence differs between selected periods.", "Check identity and source coverage.", "Do not force a maturity comparison without comparable evidence."],
      ["Behind linear pace", "Observed progress trails a straight-line budget-to-date reference.", "Check seasonality, As-of Day, and remaining run rate.", "Do not describe linear pace as a forecast."],
      ["Execution vs Reference Priority", "Two deterministic prioritisation views differ because their governed inputs or reference frames differ.", "Check drivers and filters.", "Do not call either an AI prediction."],
      ["Unmapped or ambiguous identities", "Governed attribution is incomplete or not unique.", "Check PR and relevant master identities.", "Do not choose a match without evidence."],
      ["DQ warnings and duplicate signals", "A condition warrants attention or review.", "Use issue-specific What to do guidance.", "Do not automatically delete a repeated row or mutate a warning." ]
    ].forEach(([title, tells, check, caution]) => addDetails(interpretation, title, [`What this tells you: ${tells}`, `What to check: ${check}`, `What not to conclude: ${caution}`]));
    const scope = byId("helpScopeContent");
    addDetails(scope, "Global Month / Bank", ["Applies to Performance MIS, Activation Cockpit, Management Scorecard, Target & Growth, and Productivity & Opportunity.", "With Month = ALL, Current Period follows configured fiscal-month/current Bank scope semantics."]);
    addDetails(scope, "Commercial Performance", ["Uses independent commercial Month/YTD/FY, Base/Comparison months, day-wise and Equivalent Elapsed-Day controls, All Channels, maturity month/dimension/entity and transition controls, and execution Month/As-of Day dimensions and filters.", "Movement Filter is presentation-only and changes the Branch Movement display only; full Movement CSV exports the complete selected transition."]);
    addDetails(scope, "Data Quality", ["Uses the full accepted-upload diagnostic context rather than simply following visible global dashboard filters."]);
    addDetails(scope, "Master Data", ["Describes persisted active browser-local reference datasets, not a Month/Bank analytical slice."]);
    const data = byId("helpDataContent");
    [
      ["PR CSV", "Business facts including policy date, premium, bank and branch identity; analytics begin from accepted rows."],
      ["Geography Master", "Governed State-to-Zone reference supporting geography mapping."],
      ["Branch Master", "Durable branch identity, bank membership, aliases and eligibility used by branch governance."],
      ["Employee Master", "Governed employee identity needed by ownership and hierarchy resolution."],
      ["Organisation Hierarchy", "Effective reporting relationships used for governed management roll-ups."],
      ["Branch Assignment Legacy", "Legacy branch-to-owner assignment profile retained with its own compatibility semantics."],
      ["Workforce Deployment v2", "Current effective-dated workforce deployment profile; separate from Branch Assignment Legacy."],
      ["Branch Budget & Potential", "Governed monthly Budget and Potential by applicable branch identity for commercial comparison and execution."]
    ].forEach(([title, purpose]) => addDetails(data, title, [purpose, "Dependencies and required fields are validated before activation. Data persists browser-locally; preview and validate before activation or replacement. Invalid replacement does not displace valid active data."]));
    const troubleshoot = byId("helpTroubleshootingContent");
    Object.keys(modes).forEach((key) => addDetails(troubleshoot, modes[key], [`Uses the existing Data Quality action authority for ${modes[key]}. Open Data Quality and follow the finding's issue, why it matters, check, action, and correction source.`]));
    [
      ["Why numbers differ between pages", "Confirm period, bank, denominator, signed values, and whether the page uses global or independent commercial scope."],
      ["Why a branch may be unmapped", "Its source identity may not resolve uniquely to active Branch Master and related references."],
      ["Why a value may be N/A", "A required denominator, benchmark, period, or governed mapping may be unavailable; N/A is not zero."],
      ["Why negative premium is visible", "Signed adjustments are preserved. Verify the business event rather than deleting or changing its sign."],
      ["Why display and CSV counts differ", "Some operational tables are bounded for display while their CSV contains the complete governed result."],
      ["Why Commercial may not follow Month/Bank", "Commercial Performance has independent analytical controls."],
      ["Why movement is Not Comparable", "A branch may lack comparable governed presence or evidence across the two selected maturity months."]
    ].forEach(([title, text]) => addDetails(troubleshoot, title, [text]));
  }
  function applyFilters() {
    const query = String(byId("helpGlossarySearch").value || "").trim().toLocaleLowerCase();
    const category = byId("helpGlossaryCategory").value;
    let shown = 0;
    termNodes.forEach(({ node, item }) => {
      const searchable = [item.term, item.definition, item.relatedTerms.join(" "), item.pageRefs.join(" ")].join(" ").toLocaleLowerCase();
      const visible = (!query || searchable.includes(query)) && (!category || item.category === category);
      node.hidden = !visible; if (visible) shown += 1;
    });
    byId("helpGlossaryCount").textContent = `${shown} of ${CATALOG.length} terms shown`;
    byId("helpGlossaryEmpty").hidden = shown !== 0;
    return shown;
  }
  function clearFilters() { byId("helpGlossarySearch").value = ""; byId("helpGlossaryCategory").value = ""; return applyFilters(); }
  function render() {
    if (rendered) return applyFilters();
    renderStaticContent();
    const select = byId("helpGlossaryCategory"); append(select, "option", "All Categories").value = "";
    CATEGORIES.forEach((category) => { const option = append(select, "option", category); option.value = category; });
    const results = byId("helpGlossaryResults");
    termNodes = CATALOG.map((item) => {
      const card = append(results, "article", undefined, "help-term"); card.id = `help-term-${item.id}`;
      append(card, "p", item.category, "help-term-category"); append(card, "h3", item.term);
      append(card, "p", item.runtimeDefinition ? item.runtimeDefinition() : item.definition);
      append(card, "p", `Interpretation: ${item.interpretation}`); append(card, "p", `Caution: ${item.caution}`);
      if (item.formula) append(card, "p", item.formula, "help-formula");
      append(card, "p", `Pages: ${item.pageRefs.join(", ")}`, "scorecard-note");
      return { node: card, item };
    });
    byId("helpGlossarySearch").addEventListener("input", applyFilters);
    select.addEventListener("change", applyFilters); byId("helpGlossaryClear").addEventListener("click", clearFilters);
    rendered = true; return applyFilters();
  }
  global.BancaTrackerHelpGlossary = Object.freeze({ CATALOG, CATEGORIES, render, applyFilters, clearFilters, maturityBands, modes });
  render();
})(window);
