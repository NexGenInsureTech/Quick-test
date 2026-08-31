/* Full-upload data-quality diagnostics. Findings never mutate or reject normalized fact rows. */
(function (global) {
  const utils = global.BancaTrackerUtils; const configRef = global.BancaTrackerConfig;
  const OPTIONAL_FIELDS = [
    ["Zone", "zone"], ["State", "state"], ["BA Code", "baCode"], ["RM Name", "rm"], ["IMD", "imd"],
    ["Business Type", "businessType"], ["Product Code", "productCode"], ["Product Name", "productName"], ["Day", "day"]
  ];
  const FINGERPRINT_FIELDS = ["premium", "month", "bank", "rm", "baCode", "lob", "branch", "zone", "state", "imd", "businessType", "productName", "productCode", "day"];
  const clean = (value) => String(value == null ? "" : value).trim();
  const addMapping = (map, key, value) => { const left = clean(key); const right = clean(value); if (!left || !right) return; if (!map.has(left)) map.set(left, new Set()); map.get(left).add(right); };
  const samplesFromMap = (map, keyLabel, valueLabel, severity) => [...map.entries()].filter(([, values]) => values.size > 1).map(([key, values]) => ({ severity, keyLabel, key, valueLabel, values: [...values].sort() }));
  function shortHash(text) { let hash = 2166136261; for (let i = 0; i < text.length; i += 1) { hash ^= text.charCodeAt(i); hash = Math.imul(hash, 16777619); } return `DQ-${(hash >>> 0).toString(16).padStart(8, "0")}`; }

  function build(data, config, importSummary) {
    const rows = Array.isArray(data) ? data : [];
    const branchMappings = new Map(); const baToRm = new Map(); const rmToBa = new Map(); const productToName = new Map();
    const banks = new Set(); const months = new Set(); const fingerprintCounts = new Map(); const branchPremium = new Map();
    const completeness = OPTIONAL_FIELDS.map(([label, field]) => ({ label, field, populatedRows: 0, blankRows: 0, completenessPercent: 0 }));
    const premium = { positiveRows: 0, positiveTotal: 0, zeroRows: 0, zeroTotal: 0, negativeRows: 0, negativeTotal: 0 };

    rows.forEach((row) => {
      banks.add(row.bank || "Unknown"); months.add(row.month || "");
      if (row.premium > 0) { premium.positiveRows += 1; premium.positiveTotal += row.premium; }
      else if (row.premium < 0) { premium.negativeRows += 1; premium.negativeTotal += row.premium; }
      else premium.zeroRows += 1;
      completeness.forEach((metric) => { if (clean(row[metric.field])) metric.populatedRows += 1; else metric.blankRows += 1; });

      const branchKey = utils.branchKey(row.bank, row.branch);
      if (!branchMappings.has(branchKey)) branchMappings.set(branchKey, { bank: row.bank || "Unknown", branch: row.branch || "Unknown", zones: new Set(), states: new Set(), imds: new Set() });
      const branch = branchMappings.get(branchKey); if (clean(row.zone)) branch.zones.add(clean(row.zone)); if (clean(row.state)) branch.states.add(clean(row.state)); if (clean(row.imd)) branch.imds.add(clean(row.imd));
      addMapping(baToRm, row.baCode, row.rm); addMapping(rmToBa, row.rm, row.baCode); addMapping(productToName, row.productCode, row.productName);
      branchPremium.set(branchKey, (branchPremium.get(branchKey) || 0) + row.premium);

      const serialized = JSON.stringify(FINGERPRINT_FIELDS.map((field) => row[field] == null ? "" : row[field]));
      if (!fingerprintCounts.has(serialized)) fingerprintCounts.set(serialized, { count: 0, row });
      fingerprintCounts.get(serialized).count += 1;
    });
    completeness.forEach((metric) => { metric.completenessPercent = rows.length ? (metric.populatedRows / rows.length) * 100 : 0; });

    const hierarchyConflicts = [];
    branchMappings.forEach((branch, key) => {
      [["Zone", branch.zones], ["State", branch.states], ["IMD", branch.imds]].forEach(([field, values]) => {
        if (values.size > 1) hierarchyConflicts.push({ severity: "ERROR", branchKey: key, bank: branch.bank, branch: branch.branch, field, values: [...values].sort() });
      });
    });
    const baCodeConflicts = samplesFromMap(baToRm, "BA Code", "RM Names", "WARNING");
    const rmNameConflicts = samplesFromMap(rmToBa, "RM Name", "BA Codes", "WARNING");
    const productConflicts = samplesFromMap(productToName, "Product Code", "Product Names", "WARNING");
    const identityConflicts = [...baCodeConflicts, ...rmNameConflicts, ...productConflicts];

    const configuredMonthsPresent = config.FISCAL_MONTHS.filter((month) => months.has(month));
    const configuredMonthsAbsent = config.FISCAL_MONTHS.filter((month) => !months.has(month));
    const unconfiguredMonths = [...months].filter((month) => month && !config.FISCAL_MONTHS.includes(month)).sort();
    const blankMonthRows = rows.filter((row) => !clean(row.month)).length;
    const configuredBanks = Object.keys(config.TOTAL_BRANCHES); const representedConfiguredBanks = configuredBanks.filter((bank) => banks.has(bank));
    const configuredBanksWithoutRows = configuredBanks.filter((bank) => !banks.has(bank));
    const unknownBanks = [...banks].filter((bank) => bank && !Object.prototype.hasOwnProperty.call(config.TOTAL_BRANCHES, bank)).sort();

    const duplicateGroups = [...fingerprintCounts.entries()].filter(([, item]) => item.count > 1);
    const duplicateSignals = duplicateGroups.reduce((sum, [, item]) => sum + item.count - 1, 0);
    const duplicateGroupCount = duplicateGroups.length;
    const duplicateSamples = duplicateGroups.slice(0, config.RENDER_LIMITS.DATA_QUALITY_DUPLICATES).map(([serialized, item]) => ({ severity: "INFO", fingerprint: shortHash(serialized), occurrences: item.count, bank: item.row.bank, month: item.row.month, branch: item.row.branch, premium: item.row.premium }));

    const bankBranches = new Map();
    branchPremium.forEach((branchTotal, key) => { const bank = branchMappings.get(key).bank; if (!bankBranches.has(bank)) bankBranches.set(bank, { observed: 0, active: 0 }); const metric = bankBranches.get(bank); metric.observed += 1; if (branchTotal >= config.THRESHOLDS.ACTIVE_BRANCH) metric.active += 1; });
    const branchUniverseSanity = configuredBanks.map((bank) => { const observed = (bankBranches.get(bank) || {}).observed || 0; const active = (bankBranches.get(bank) || {}).active || 0; const universe = config.TOTAL_BRANCHES[bank]; const exceeded = observed > universe || active > universe; return { severity: exceeded ? "ERROR" : "INFO", bank, observedBranches: observed, activeBranches: active, configuredUniverse: universe, exceeded }; });

    const findings = [
      ...hierarchyConflicts.map((item) => ({ severity: item.severity, category: "Hierarchy", message: `${item.branchKey} has multiple ${item.field} values.` })),
      ...identityConflicts.map((item) => ({ severity: item.severity, category: "Identity", message: `${item.keyLabel} ${item.key} maps to multiple ${item.valueLabel}.` })),
      ...unconfiguredMonths.map((month) => ({ severity: "WARNING", category: "Month", message: `${month} is not a configured fiscal month.` })),
      ...(blankMonthRows ? [{ severity: "ERROR", category: "Month", message: `${blankMonthRows} accepted row(s) have a blank Month.` }] : []),
      ...configuredMonthsAbsent.map((month) => ({ severity: "INFO", category: "Month", message: `${month} is not represented in this upload.` })),
      ...unknownBanks.map((bank) => ({ severity: "WARNING", category: "Bank", message: `${bank} has no configured branch universe.` })),
      ...configuredBanksWithoutRows.map((bank) => ({ severity: "INFO", category: "Bank", message: `${bank} has no observed rows in this upload.` })),
      ...(premium.negativeRows ? [{ severity: "INFO", category: "Premium", message: `${premium.negativeRows} negative premium row(s) total ${premium.negativeTotal}.` }] : []),
      ...duplicateSamples.map((item) => ({ severity: "INFO", category: "Duplicate", message: `${item.fingerprint} occurs ${item.occurrences} times.` })),
      ...branchUniverseSanity.filter((item) => item.exceeded).map((item) => ({ severity: "ERROR", category: "Branch Universe", message: `${item.bank} exceeds its configured branch universe.` }))
    ];
    const severityCounts = { ERROR: 0, WARNING: 0, INFO: 0 }; findings.forEach((finding) => { severityCounts[finding.severity] += 1; }); severityCounts.INFO += duplicateGroupCount - duplicateSamples.length;
    return Object.freeze({ rowCount: rows.length, importSummary: importSummary || {}, hierarchyConflicts, baCodeConflicts, rmNameConflicts, productConflicts, identityConflicts, monthQuality: { configuredMonthsPresent, configuredMonthsAbsent, unconfiguredMonths, blankMonthRows }, bankQuality: { representedConfiguredBanks, configuredBanksWithoutRows, unknownBanks }, premium, completeness, duplicateSignals, duplicateGroupCount, duplicateSamples, branchUniverseSanity, severityCounts, findings });
  }

  const html = (value) => utils.escapeHtml(value);
  const empty = (message) => `<p class='empty-state'>${html(message)}</p>`;
  const severity = (level) => `<span class='quality-severity quality-${level.toLowerCase()}'>${level}</span>`;
  function conflictTable(items, kind, limit) {
    if (!items.length) return empty(`No ${kind} conflicts detected.`);
    const note = items.length > limit ? `<p class='table-limit-note'>Showing ${limit} of ${utils.formatInr(items.length)} ${html(kind)} conflicts.</p>` : "";
    return `${note}<table><thead><tr><th>Severity</th><th>Identity</th><th>Field</th><th>Conflicting Values</th></tr></thead><tbody>${items.slice(0, limit).map((item) => `<tr><td>${severity(item.severity)}</td><td>${html(item.branchKey || `${item.keyLabel}: ${item.key}`)}</td><td>${html(item.field || item.valueLabel)}</td><td>${item.values.map(html).join(", ")}</td></tr>`).join("")}</tbody></table>`;
  }
  function render(audit) {
    if (!audit) return;
    const summary = audit.importSummary;
    const cards = [["Accepted Rows", summary.acceptedRows || audit.rowCount], ["Rejected Rows", summary.rejectedRows || 0], ["Warning Rows", summary.warningRows || 0], ["Hierarchy Conflicts", audit.hierarchyConflicts.length], ["Identity Conflicts", audit.identityConflicts.length], ["Unconfigured Months", audit.monthQuality.unconfiguredMonths.length], ["Unknown Banks", audit.bankQuality.unknownBanks.length], ["Duplicate Signals", audit.duplicateSignals]];
    document.getElementById("qualitySummary").innerHTML = cards.map(([label, value]) => `<div class='card'><div>${label}</div><div class='value'>${utils.formatInr(value)}</div></div>`).join("");
    document.getElementById("qualityScope").textContent = `Diagnostics use the full accepted upload and are not changed by the Month or Bank filters. Findings: ${audit.severityCounts.ERROR} ERROR, ${audit.severityCounts.WARNING} WARNING, ${audit.severityCounts.INFO} INFO. Signals do not alter imported rows.`;
    document.getElementById("hierarchyConflicts").innerHTML = conflictTable(audit.hierarchyConflicts, "branch hierarchy", configRef.RENDER_LIMITS.DATA_QUALITY_HIERARCHY);
    document.getElementById("identityConflicts").innerHTML = conflictTable(audit.identityConflicts, "identity", configRef.RENDER_LIMITS.DATA_QUALITY_IDENTITY);
    const mq = audit.monthQuality; const bq = audit.bankQuality; const coverageLimit = configRef.RENDER_LIMITS.DATA_QUALITY_COVERAGE;
    const coverage = (items) => !items.length ? "None" : `${html(items.slice(0, coverageLimit).join(", "))}${items.length > coverageLimit ? ` <span class='table-limit-note'>Showing ${coverageLimit} of ${utils.formatInr(items.length)}</span>` : ""}`;
    document.getElementById("monthBankCoverage").innerHTML = `<div class='quality-grid'><div><strong>Fiscal months present</strong><p>${coverage(mq.configuredMonthsPresent)}</p><strong>Fiscal months absent</strong><p>${coverage(mq.configuredMonthsAbsent)}</p><strong>Unconfigured labels ${severity("WARNING")}</strong><p>${coverage(mq.unconfiguredMonths)}</p><strong>Accepted blank Month rows</strong><p>${mq.blankMonthRows}</p></div><div><strong>Configured banks represented</strong><p>${coverage(bq.representedConfiguredBanks)}</p><strong>Configured banks without rows ${severity("INFO")}</strong><p>${coverage(bq.configuredBanksWithoutRows)}</p><strong>Unknown banks ${severity("WARNING")}</strong><p>${coverage(bq.unknownBanks)}</p></div></div>`;
    document.getElementById("premiumQuality").innerHTML = `<table><thead><tr><th>Premium Sign</th><th>Rows</th><th>Aggregate Premium</th></tr></thead><tbody><tr><td>Positive</td><td>${audit.premium.positiveRows}</td><td>${utils.formatInr(audit.premium.positiveTotal)}</td></tr><tr><td>Zero</td><td>${audit.premium.zeroRows}</td><td>0</td></tr><tr><td>Negative ${severity("INFO")}</td><td>${audit.premium.negativeRows}</td><td>${utils.formatInr(audit.premium.negativeTotal)}</td></tr></tbody></table><p class='scorecard-note'>Negative premium is preserved and may represent cancellation, refund, or adjustment; treatment requires a future business rule.</p>`;
    document.getElementById("fieldCompleteness").innerHTML = `<table><thead><tr><th>Optional Field</th><th>Populated Rows</th><th>Blank Rows</th><th>Completeness %</th></tr></thead><tbody>${audit.completeness.map((item) => `<tr><td>${html(item.label)}</td><td>${item.populatedRows}</td><td>${item.blankRows}</td><td>${item.completenessPercent.toFixed(1)}%</td></tr>`).join("")}</tbody></table>`;
    const duplicateNote = audit.duplicateGroupCount > audit.duplicateSamples.length ? ` Showing ${audit.duplicateSamples.length} of ${utils.formatInr(audit.duplicateGroupCount)} duplicate groups.` : "";
    document.getElementById("duplicateSignals").innerHTML = audit.duplicateSamples.length ? `<p class='scorecard-note'>${audit.duplicateSignals} row(s) repeat an earlier exact normalized-row fingerprint. This is heuristic without a transaction/policy identifier.${duplicateNote}</p><table><thead><tr><th>Severity</th><th>Fingerprint</th><th>Occurrences</th><th>Bank</th><th>Month</th><th>Branch</th><th>Premium</th></tr></thead><tbody>${audit.duplicateSamples.map((item) => `<tr><td>${severity(item.severity)}</td><td>${html(item.fingerprint)}</td><td>${item.occurrences}</td><td>${html(item.bank)}</td><td>${html(item.month)}</td><td>${html(item.branch)}</td><td>${utils.formatInr(item.premium)}</td></tr>`).join("")}</tbody></table>` : empty("No exact duplicate normalized rows detected.");
    document.getElementById("branchUniverseSanity").innerHTML = `<p class='scorecard-note'>Active Branches here use full-upload branch premium only for this sanity bound; operational activation remains current-period.</p><table><thead><tr><th>Severity</th><th>Bank</th><th>Observed Branches</th><th>Active Branches</th><th>Configured Universe</th><th>Result</th></tr></thead><tbody>${audit.branchUniverseSanity.map((item) => `<tr><td>${severity(item.severity)}</td><td>${html(item.bank)}</td><td>${item.observedBranches}</td><td>${item.activeBranches}</td><td>${item.configuredUniverse}</td><td>${item.exceeded ? "EXCEEDS UNIVERSE" : "Within configured bound"}</td></tr>`).join("")}</tbody></table>`;
    if (global.BancaTrackerCanonicalDataQuality) global.BancaTrackerCanonicalDataQuality.render();
  }
  global.BancaTrackerDataQuality = Object.freeze({ build, render, OPTIONAL_FIELDS, FINGERPRINT_FIELDS });
  global.renderDataQuality = render;
})(window);
