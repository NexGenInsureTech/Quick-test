/* Deterministic presentation guidance for Data Quality diagnostics. */
(function (global) {
  "use strict";

  const MODES = Object.freeze({
    CORRECT: "CORRECT",
    VERIFY: "VERIFY",
    REVIEW: "REVIEW",
    INFORMATION: "INFORMATION",
  });

  const LEGACY_TYPES = Object.freeze({
    HIERARCHY_CONFLICT: "LEGACY_HIERARCHY_CONFLICT",
    BA_TO_RM_CONFLICT: "LEGACY_BA_TO_RM_CONFLICT",
    RM_TO_BA_CONFLICT: "LEGACY_RM_TO_BA_CONFLICT",
    PRODUCT_CONFLICT: "LEGACY_PRODUCT_CONFLICT",
    UNCONFIGURED_MONTH: "LEGACY_UNCONFIGURED_MONTH",
    BLANK_MONTH: "LEGACY_BLANK_MONTH",
    CONFIGURED_MONTH_ABSENT: "LEGACY_CONFIGURED_MONTH_ABSENT",
    UNKNOWN_BANK: "LEGACY_UNKNOWN_BANK",
    CONFIGURED_BANK_ABSENT: "LEGACY_CONFIGURED_BANK_ABSENT",
    NEGATIVE_PREMIUM: "LEGACY_NEGATIVE_PREMIUM",
    DUPLICATE_SIGNAL: "LEGACY_DUPLICATE_SIGNAL",
    BRANCH_UNIVERSE_EXCEEDED: "LEGACY_BRANCH_UNIVERSE_EXCEEDED",
  });

  function guidance(mode, issue, whyItMatters, check, action, correctionSource) {
    return Object.freeze({ mode, issue, whyItMatters, check, action, correctionSource });
  }

  const canonical = Object.freeze({
    DATE_MISSING: guidance(MODES.CORRECT, "Policy-issued date is missing.", "The canonical reporting period and day cannot be established.", "Verify the policy-issued date against the source record.", "Supply the valid policy-issued date.", "PR CSV"),
    DATE_FORMAT_UNSUPPORTED: guidance(MODES.CORRECT, "Policy-issued date uses an unsupported format.", "The canonical reporting period and day cannot be established.", "Verify the date value and supported YYYY-MM-DD or DD/MM/YYYY format.", "Replace it with the correct date in a supported format.", "PR CSV"),
    DATE_INVALID: guidance(MODES.CORRECT, "Policy-issued date is not a valid calendar date.", "The canonical reporting period and day cannot be established.", "Verify the date against the original policy record.", "Replace it with the correct valid date.", "PR CSV"),
    PREMIUM_INVALID: guidance(MODES.CORRECT, "Premium is missing or is not a finite numeric value.", "The row cannot contribute a reliable monetary value.", "Verify the premium and its numeric formatting against the source record.", "Supply the correct finite numeric premium.", "PR CSV"),
    BRANCH_FALLBACK_USED: guidance(MODES.REVIEW, "Branch resolved through a controlled name fallback rather than an exact identity.", "Fallback resolution is less precise and may conceal inconsistent branch identifiers.", "Compare the source bank, branch code, and branch name with Branch Master.", "Retain the match if it is valid; otherwise correct the proven source of the identity difference.", "PR CSV / Branch Master"),
    BRANCH_UNMAPPED: guidance(MODES.VERIFY, "Branch could not be matched to Branch Master.", "Governed branch, geography, and ownership reporting may be incomplete.", "Compare bank ID, branch code, and branch name with the active Branch Master.", "Correct only after establishing whether the PR identity or Branch Master record is authoritative.", "PR CSV / Branch Master"),
    BRANCH_AMBIGUOUS: guidance(MODES.VERIFY, "Branch identity matched more than one Branch Master record.", "A unique governed branch cannot be selected reliably.", "Check duplicate names, aliases, codes, and the specificity of the source identity.", "Remove the proven ambiguity or supply the exact governed identity.", "Branch Master / PR CSV"),
    BRANCH_MASTER_ABSENT: guidance(MODES.VERIFY, "Branch Master lookup context is absent.", "Branch resolution and dependent governed dimensions cannot be fully assessed.", "Confirm whether an active Branch Master is expected for this deployment.", "Import or activate a valid Branch Master only when governance requires it.", "Branch Master"),
    GEOGRAPHY_UNMAPPED: guidance(MODES.VERIFY, "State and Zone could not be resolved from Geography Master.", "Governed geography reporting may be incomplete or grouped as unmapped.", "Compare the source State and resolved branch State with Geography Master.", "Correct the source or governed geography only after confirming the authoritative value.", "PR CSV / Geography Master"),
    GEOGRAPHY_AMBIGUOUS: guidance(MODES.VERIFY, "State identity matched more than one Geography Master record.", "A unique governed geography cannot be selected reliably.", "Check duplicated names, codes, and aliases in Geography Master.", "Resolve the proven reference ambiguity.", "Geography Master"),
    GEOGRAPHY_MASTER_ABSENT: guidance(MODES.VERIFY, "Geography Master lookup context is absent.", "Governed State and Zone resolution cannot be fully assessed.", "Confirm whether an active Geography Master is expected.", "Import or activate a valid Geography Master only when governance requires it.", "Geography Master"),
    ASSIGNMENT_UNMAPPED: guidance(MODES.VERIFY, "No governed RM assignment was resolved for the branch.", "Ownership and hierarchy reporting may be incomplete.", "Check the branch identity, business date, and effective assignment coverage.", "Add or correct an assignment only after confirming the governed owner and effective dates.", "Branch Assignment / Workforce Deployment"),
    ASSIGNMENT_AMBIGUOUS: guidance(MODES.VERIFY, "More than one governed RM assignment is effective for the branch.", "Ownership cannot be attributed uniquely.", "Inspect overlapping assignment or deployment records and effective dates.", "Resolve the proven overlap in the governed assignment source.", "Branch Assignment / Workforce Deployment"),
    ASSIGNMENT_MASTER_ABSENT: guidance(MODES.VERIFY, "Governed assignment lookup context is absent.", "RM ownership resolution cannot be fully assessed.", "Confirm whether active assignment or deployment data is expected.", "Import or activate the appropriate governed assignment source only when required.", "Branch Assignment / Workforce Deployment"),
    EMPLOYEE_MASTER_ABSENT: guidance(MODES.VERIFY, "Employee Master context is absent.", "Employee identities and hierarchy references cannot be fully validated.", "Confirm whether an active Employee Master is expected.", "Import or activate a valid Employee Master only when governance requires it.", "Employee Master"),
    HIERARCHY_MASTER_ABSENT: guidance(MODES.VERIFY, "Organisation hierarchy lookup context is absent.", "Governed reporting chains cannot be fully resolved.", "Confirm whether active hierarchy data is expected.", "Import or activate valid hierarchy data only when governance requires it.", "Organisation Hierarchy"),
    HIERARCHY_PARTIAL: guidance(MODES.VERIFY, "Only part of the assigned RM hierarchy was resolved.", "Higher-level ownership roll-ups may be incomplete.", "Check employee coverage, reporting relationships, roles, and effective dates.", "Correct the proven employee or hierarchy gap.", "Employee Master / Organisation Hierarchy"),
    HIERARCHY_UNRESOLVED: guidance(MODES.VERIFY, "The assigned RM hierarchy could not be resolved.", "Governed management roll-ups cannot be established for the row.", "Check the assigned employee and their complete effective reporting chain.", "Correct the proven employee or hierarchy reference gap.", "Employee Master / Organisation Hierarchy"),
    SOURCE_ASSIGNED_RM_MISMATCH: guidance(MODES.VERIFY, "Source RM differs from the governed assigned RM.", "Ownership differs between two authorities and must not be chosen automatically.", "Compare the source RM, branch, business date, and effective governed assignment.", "Correct only the authority proven wrong; do not automatically prefer PR or governed assignment.", "PR CSV / Branch Assignment / Workforce Deployment"),
    LEGACY_MONTH_MISMATCH: guidance(MODES.VERIFY, "Uploaded Month differs from the policy-issued date-derived month.", "Period reporting can differ between source and canonical views.", "Compare both fields with the original policy record.", "Correct the inconsistent source value only after verification.", "PR CSV"),
    LEGACY_DAY_MISMATCH: guidance(MODES.VERIFY, "Uploaded Day differs from the policy-issued date-derived day.", "Day-wise reporting can differ between source and canonical views.", "Compare both fields with the original policy record.", "Correct the inconsistent source value only after verification.", "PR CSV"),
    LEGACY_ZONE_MISMATCH: guidance(MODES.VERIFY, "Uploaded Zone differs from the governed Geography Master Zone.", "Geographic roll-ups can differ between source and governed views.", "Compare the source Zone, branch State, and Geography Master mapping.", "Correct only the source or master value proven wrong.", "PR CSV / Geography Master"),
    OBSERVED_BRANCHES_EXCEED_GOVERNED_UNIVERSE: guidance(MODES.VERIFY, "Observed branches exceed the governed eligible universe.", "Branch coverage metrics may contain identity duplication or incomplete universe governance.", "Compare resolved branch identities with Branch Master eligibility by bank.", "Correct only the proven source identity or governed eligibility issue.", "PR CSV / Branch Master"),
    ACTIVE_BRANCHES_EXCEED_GOVERNED_UNIVERSE: guidance(MODES.VERIFY, "Active branches exceed the governed eligible universe.", "Activation metrics are inconsistent with the governed maximum.", "Compare active resolved branches with Branch Master eligibility by bank.", "Correct only the proven source identity or governed eligibility issue.", "PR CSV / Branch Master"),
    SHADOW_FAILED: guidance(MODES.VERIFY, "Canonical shadow enrichment did not complete.", "Canonical readiness and comparison diagnostics may be unavailable.", "Review the processing failure before relying on canonical diagnostics.", "Resolve the processing or input condition without changing analytical results to force agreement.", "PR processing / governed master context"),
    UNEXPLAINED_RECONCILIATION_DIFFERENCE: guidance(MODES.VERIFY, "Legacy and canonical results contain an unexplained reconciliation difference.", "The two views cannot yet be treated as reconciled.", "Inspect the reconciliation evidence and the rows contributing to the difference.", "Establish the cause before correcting any source; do not alter analytical results to force agreement.", "PR CSV / governed reference / reconciliation investigation"),
    NO_CANONICAL_ROWS: guidance(MODES.VERIFY, "No canonical-ready rows were produced.", "Canonical reporting cannot proceed from the current result.", "Review invalid rows, input availability, and governed reference coverage.", "Correct only the confirmed source or reference issue.", "PR CSV / governed master context"),
  });

  const legacy = Object.freeze({
    [LEGACY_TYPES.HIERARCHY_CONFLICT]: guidance(MODES.VERIFY, "A branch has multiple Zone, State, or IMD values in the upload.", "Branch-level aggregation and ownership can become ambiguous.", "Compare the conflicting values with the authoritative branch and geography references.", "Correct only the source or governed mapping proven wrong.", "PR CSV / governed reference"),
    [LEGACY_TYPES.BA_TO_RM_CONFLICT]: guidance(MODES.VERIFY, "One BA Code maps to multiple RM Names.", "Source ownership identity may be inconsistent or may reflect legitimate history.", "Verify the BA and RM relationship for the relevant periods.", "Correct only a relationship confirmed to be erroneous.", "PR CSV / Employee or assignment authority"),
    [LEGACY_TYPES.RM_TO_BA_CONFLICT]: guidance(MODES.VERIFY, "One RM Name maps to multiple BA Codes.", "Name collisions or changing identities may affect ownership analysis.", "Verify the employee identities and whether multiple codes are legitimate.", "Correct only a relationship confirmed to be erroneous.", "PR CSV / Employee or assignment authority"),
    [LEGACY_TYPES.PRODUCT_CONFLICT]: guidance(MODES.VERIFY, "One Product Code maps to multiple Product Names.", "Product reporting may be split or mislabeled.", "Compare the code and names with the governed product definition.", "Standardize only the value confirmed to be incorrect.", "PR CSV / product reference"),
    [LEGACY_TYPES.UNCONFIGURED_MONTH]: guidance(MODES.VERIFY, "An uploaded month label is not in the configured fiscal calendar.", "The month is excluded from fiscal YTD and target progression.", "Compare the label with the policy-issued date and fiscal configuration.", "Correct a mistyped label or separately govern a required configuration change.", "PR CSV / configuration"),
    [LEGACY_TYPES.BLANK_MONTH]: guidance(MODES.CORRECT, "Accepted rows have a blank Month.", "Legacy period grouping cannot place those rows reliably.", "Verify the intended month against the policy-issued date and source record.", "Supply the correct Month where the source contract requires it.", "PR CSV"),
    [LEGACY_TYPES.CONFIGURED_MONTH_ABSENT]: guidance(MODES.INFORMATION, "A configured fiscal month is not represented in this upload.", "This may simply describe the intended scope of the file.", "Confirm whether the upload was expected to include that month.", "No correction is required when the upload scope is intentional.", "Upload scope / PR CSV"),
    [LEGACY_TYPES.UNKNOWN_BANK]: guidance(MODES.VERIFY, "An uploaded bank has no configured branch universe.", "Activation and branch-universe metrics cannot be governed for that identity.", "Check the bank spelling or alias and whether the bank should be configured.", "Correct the identity or govern the configuration only after verification.", "PR CSV / configuration"),
    [LEGACY_TYPES.CONFIGURED_BANK_ABSENT]: guidance(MODES.INFORMATION, "A configured bank has no observed rows in this upload.", "This may simply describe the intended scope of the file.", "Confirm whether the upload was expected to include that bank.", "No correction is required when the upload scope is intentional.", "Upload scope / PR CSV"),
    [LEGACY_TYPES.NEGATIVE_PREMIUM]: guidance(MODES.REVIEW, "Negative premium is present.", "It may represent a legitimate cancellation, refund, or adjustment and is preserved.", "Review the transaction against the source business event.", "Retain legitimate entries; never delete or change sign solely because premium is negative.", "PR CSV / source business record"),
    [LEGACY_TYPES.DUPLICATE_SIGNAL]: guidance(MODES.REVIEW, "An exact normalized-row fingerprint occurs more than once.", "The signal is heuristic and repeated rows may still be legitimate transactions.", "Compare the rows with transaction or policy evidence not available to this fingerprint.", "Retain legitimate rows; never delete automatically from this signal alone.", "PR CSV / source transaction record"),
    [LEGACY_TYPES.BRANCH_UNIVERSE_EXCEEDED]: guidance(MODES.VERIFY, "Observed or active branch counts exceed the configured universe.", "Branch coverage metrics may reflect identity duplication or stale configuration.", "Compare source branch identities with the configured or governed universe.", "Correct only the proven source identity or universe-governance issue.", "PR CSV / Branch Master / configuration"),
  });

  const fallback = guidance(MODES.VERIFY, "A Data Quality condition was detected.", "Its operational impact depends on the source and governing reference.", "Review the finding and compare source data with the relevant governed reference.", "Correct only after establishing the authoritative value.", "Source data / relevant governed reference");

  function lookupCanonical(code) {
    return canonical[code] || fallback;
  }

  function lookupLegacy(type) {
    return legacy[type] || fallback;
  }

  function render(item, escapeHtml) {
    const safe = typeof escapeHtml === "function" ? escapeHtml : (value) => String(value == null ? "" : value);
    return `<details class="quality-guidance"><summary>What to do <span class="quality-action quality-action-${safe(item.mode.toLowerCase())}">${safe(item.mode)}</span></summary><dl><dt>Issue</dt><dd>${safe(item.issue)}</dd><dt>Why it matters</dt><dd>${safe(item.whyItMatters)}</dd><dt>Check</dt><dd>${safe(item.check)}</dd><dt>Action</dt><dd>${safe(item.action)}</dd><dt>Fix in</dt><dd>${safe(item.correctionSource)}</dd></dl></details>`;
  }

  global.BancaTrackerDataQualityGuidance = Object.freeze({
    MODES,
    LEGACY_TYPES,
    CANONICAL_CODES: Object.freeze(Object.keys(canonical)),
    LEGACY_TYPE_KEYS: Object.freeze(Object.keys(legacy)),
    lookupCanonical,
    lookupLegacy,
    render,
  });
})(window);
