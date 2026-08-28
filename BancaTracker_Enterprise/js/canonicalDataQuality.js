/*==============================================================
BancaTracker Enterprise
Version : 8.2.0-dev
File    : canonicalDataQuality.js
Module  : Data Quality
Purpose : Render additive canonical and master-data diagnostics
==============================================================*/

(function (global) {
  "use strict";

  const DETAIL_LIMIT = 100;
  const MASTER_LABELS = Object.freeze([
    ["geography", "Geography Master"],
    ["branch", "Branch Master"],
    ["employee", "Employee Master"],
    ["hierarchy", "Organisation Hierarchy"],
    ["assignment", "Branch Assignment"],
  ]);
  const COVERAGE_LABELS = Object.freeze([
    ["dateReadyPct", "Date ready %"],
    ["branchExactPct", "Branch exact %"],
    ["branchResolvedPct", "Branch resolved %"],
    ["geographyResolvedPct", "Geography resolved %"],
    ["assignmentResolvedPct", "Assignment resolved %"],
    ["hierarchyResolvedPct", "Hierarchy resolved %"],
  ]);
  const COMPARISON_LABELS = Object.freeze([
    ["legacyMonthMismatch", "Legacy Month mismatch"],
    ["legacyDayMismatch", "Legacy Day mismatch"],
    ["legacyZoneMismatch", "Legacy Zone mismatch"],
    ["sourceAssignedRmMismatch", "Source / assigned RM mismatch"],
  ]);

  function escapeHtml(value) {
    if (global.BancaTrackerUtils && global.BancaTrackerUtils.escapeHtml) {
      return global.BancaTrackerUtils.escapeHtml(value);
    }
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function aggregateFindings(shadowResult) {
    const groups = new Map();
    const details = [];
    const results = shadowResult && Array.isArray(shadowResult.canonicalResults)
      ? shadowResult.canonicalResults
      : [];
    results.forEach((result, index) => {
      const policyNumber = result.transaction && result.transaction.policyNumber;
      (result.findings || []).forEach((finding) => {
        const severity = finding.severity || "INFO";
        const category = finding.category || "REFERENCE";
        const code = finding.code || "CANONICAL_FINDING";
        const key = `${severity}\u0000${category}\u0000${code}`;
        if (!groups.has(key)) groups.set(key, { severity, category, code, count: 0 });
        groups.get(key).count += 1;
        details.push({
          severity, category, code,
          row: policyNumber || index + 1,
          field: finding.field || null,
          message: finding.message || code,
        });
      });
    });
    return {
      groups: [...groups.values()].sort((left, right) =>
        left.severity.localeCompare(right.severity) ||
        left.category.localeCompare(right.category) ||
        left.code.localeCompare(right.code)),
      details,
      totalCount: details.length,
    };
  }

  function buildModel(shadowResult) {
    const diagnostics = global.BancaTrackerReadinessDiagnostics;
    const readiness = diagnostics.buildReadiness(shadowResult || null);
    return {
      readiness,
      findings: aggregateFindings(shadowResult),
      dateAuthority: shadowResult && shadowResult.dateAuthoritySummary
        ? shadowResult.dateAuthoritySummary
        : { canonical: 0, legacyFallback: 0, invalid: 0, unspecified: 0 },
      branchAuthority: shadowResult && shadowResult.branchAuthoritySummary
        ? shadowResult.branchAuthoritySummary
        : { governedExact: 0, governedFallback: 0, legacyFallback: 0, unmapped: 0, ambiguous: 0, unspecified: 0 },
      assignmentAuthority: shadowResult && shadowResult.assignmentAuthoritySummary
        ? shadowResult.assignmentAuthoritySummary
        : { assigned: 0, masterAbsent: 0, branchUnresolved: 0, unmapped: 0, ambiguous: 0, unspecified: 0, match: 0, mismatch: 0, sourceMissing: 0, assignedMissing: 0, notComparable: 0 },
      hierarchyAuthority: shadowResult && shadowResult.hierarchyAuthoritySummary
        ? shadowResult.hierarchyAuthoritySummary
        : { resolved: 0, partial: 0, masterAbsent: 0, assignmentUnresolved: 0, hierarchyUnmapped: 0, invalidChain: 0, unspecified: 0, missingEmployeeMetadata: 0 },
      branchUniverse: shadowResult && shadowResult.branchUniverseReadiness || null,
      geographyAuthority: shadowResult && shadowResult.geographyAuthoritySummary
        ? shadowResult.geographyAuthoritySummary
        : { governedBranch: 0, governedSourceState: 0, legacyFallback: 0, unmapped: 0, unspecified: 0, branchSourceStateMismatch: 0 },
    };
  }

  function table(headers, rows, emptyMessage) {
    if (!rows.length) return `<p class="empty-state">${escapeHtml(emptyMessage)}</p>`;
    return `<table><thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead><tbody>${rows.join("")}</tbody></table>`;
  }

  function renderModel(model) {
    const readiness = model.readiness;
    const records = readiness.records || {};
    const displayStatus = String(readiness.overallStatus || "NOT_RUN").replace(/_/g, " ");
    document.getElementById("canonicalQualityScope").textContent = readiness.overallStatus === "NOT_RUN"
      ? "Canonical Data Quality becomes available after PR data is processed. Existing v8.1 diagnostics above remain authoritative."
      : "Canonical diagnostics are additive context from shadow enrichment; existing v8.1 diagnostics above remain authoritative.";
    document.getElementById("canonicalQualitySummary").innerHTML = [
      ["Canonical Readiness", displayStatus], ["Source Records", records.source || 0],
      ["Canonical Records", records.canonical || 0], ["Ready", records.ready || 0],
      ["Ready With Warnings", records.readyWithWarnings || 0], ["Invalid", records.invalid || 0],
      ["Canonical Date Authority", model.dateAuthority.canonical || 0],
      ["Legacy Date Fallback", model.dateAuthority.legacyFallback || 0],
      ["Invalid Date Authority", model.dateAuthority.invalid || 0],
      ["Governed Branch: Exact", model.branchAuthority.governedExact || 0],
      ["Governed Branch: Fallback", model.branchAuthority.governedFallback || 0],
      ["Legacy Branch Fallback", model.branchAuthority.legacyFallback || 0],
      ["Unmapped Branch", model.branchAuthority.unmapped || 0],
      ["Ambiguous Branch", model.branchAuthority.ambiguous || 0],
      ["Governed Assignment: Assigned", model.assignmentAuthority.assigned || 0],
      ["Assignment Master Absent", model.assignmentAuthority.masterAbsent || 0],
      ["Branch Unresolved for Assignment", model.assignmentAuthority.branchUnresolved || 0],
      ["Assignment Unmapped", model.assignmentAuthority.unmapped || 0],
      ["Assignment Ambiguous", model.assignmentAuthority.ambiguous || 0],
      ["Source / Assigned RM Match", model.assignmentAuthority.match || 0],
      ["Source / Assigned RM Mismatch", model.assignmentAuthority.mismatch || 0],
      ["Source RM Missing", model.assignmentAuthority.sourceMissing || 0],
      ["Assigned RM Missing", model.assignmentAuthority.assignedMissing || 0],
      ["RM Not Comparable", model.assignmentAuthority.notComparable || 0],
      ["Governed Hierarchy: Resolved", model.hierarchyAuthority.resolved || 0],
      ["Governed Hierarchy: Partial", model.hierarchyAuthority.partial || 0],
      ["Hierarchy Master Absent", model.hierarchyAuthority.masterAbsent || 0],
      ["Hierarchy Blocked by Assignment", model.hierarchyAuthority.assignmentUnresolved || 0],
      ["Hierarchy Unmapped", model.hierarchyAuthority.hierarchyUnmapped || 0],
      ["Invalid Hierarchy Chain", model.hierarchyAuthority.invalidChain || 0],
      ["Missing Hierarchy Employee Metadata", model.hierarchyAuthority.missingEmployeeMetadata || 0],
      ...(model.branchUniverse ? [
        ["Branch Universe Contract", model.branchUniverse.status],
        ["Universe Explicitly Eligible", model.branchUniverse.explicitlyEligibleRecords],
        ["Universe Explicitly Excluded", model.branchUniverse.explicitlyIneligibleRecords],
        ["Universe Eligibility Unknown", model.branchUniverse.eligibilityUnknownRecords],
        ["Universe Bank Identity Unresolved", model.branchUniverse.bankIdentityUnresolvedRecords],
      ] : []),
      ["Governed Geography: Branch", model.geographyAuthority.governedBranch || 0],
      ["Governed Geography: Source State", model.geographyAuthority.governedSourceState || 0],
      ["Legacy Geography Fallback", model.geographyAuthority.legacyFallback || 0],
      ["Unmapped Governed Geography", model.geographyAuthority.unmapped || 0],
      ["Branch / Source State Conflict", model.geographyAuthority.branchSourceStateMismatch || 0],
    ].map(([label, value]) => `<div class="card"><div>${escapeHtml(label)}</div><div class="value">${escapeHtml(value)}</div></div>`).join("");

    document.getElementById("canonicalMasterCoverage").innerHTML = table(
      ["Master", "Status"],
      MASTER_LABELS.map(([key, label]) => {
        const master = readiness.masters && readiness.masters[key];
        const status = master ? master.status : readiness.overallStatus === "NOT_RUN" ? "NOT EVALUATED" : "ABSENT";
        return `<tr><td>${escapeHtml(label)}</td><td><strong>${escapeHtml(String(status).replace(/_/g, " "))}</strong></td></tr>`;
      }),
      "Master coverage is not available.",
    );

    const coverageRows = COVERAGE_LABELS.map(([key, label]) => {
      const metric = readiness.readiness[key];
      return `<tr><td>${escapeHtml(label)}</td><td>${metric.percentage.toFixed(1)}%</td><td>${metric.numerator} / ${metric.denominator}</td></tr>`;
    });
    const resolution = readiness.resolution;
    const countRows = [
      ["Branch fallback", resolution.branch.fallback], ["Branch unmapped", resolution.branch.unmapped],
      ["Branch ambiguous", resolution.branch.ambiguous], ["Geography unmapped", resolution.geography.unmapped],
      ["Assignment unmapped", resolution.assignment.unmapped], ["Hierarchy partial", resolution.hierarchy.partial],
    ].map(([label, count]) => `<tr><td>${escapeHtml(label)}</td><td>${count}</td><td>Count</td></tr>`);
    document.getElementById("canonicalResolutionQuality").innerHTML = table(
      ["Measure", "Value", "Resolved / Eligible"], [...coverageRows, ...countRows], "No resolution data.",
    );

    document.getElementById("canonicalComparisons").innerHTML = table(
      ["Comparison", "Count", "Interpretation"],
      COMPARISON_LABELS.map(([key, label]) => `<tr><td>${escapeHtml(label)}</td><td>${readiness.comparisons[key]}</td><td>Warning / review; not automatically an error</td></tr>`),
      "No comparison data.",
    );

    document.getElementById("canonicalFindingSummary").innerHTML = table(
      ["Severity", "Category", "Code", "Count"],
      model.findings.groups.map((group) => `<tr><td><span class="quality-severity quality-${escapeHtml(group.severity.toLowerCase())}">${escapeHtml(group.severity)}</span></td><td>${escapeHtml(group.category)}</td><td>${escapeHtml(group.code)}</td><td>${group.count}</td></tr>`),
      "No canonical findings.",
    );
    const visibleDetails = model.findings.details.slice(0, DETAIL_LIMIT);
    document.getElementById("canonicalFindingDetails").innerHTML = table(
      ["Severity", "Code", "Category", "Policy / Row", "Field", "Message"],
      visibleDetails.map((finding) => `<tr><td>${escapeHtml(finding.severity)}</td><td>${escapeHtml(finding.code)}</td><td>${escapeHtml(finding.category)}</td><td>${escapeHtml(finding.row)}</td><td>${escapeHtml(finding.field || "—")}</td><td>${escapeHtml(finding.message)}</td></tr>`),
      "No canonical finding details.",
    );
    document.getElementById("canonicalFindingLimit").textContent = model.findings.totalCount > DETAIL_LIMIT
      ? `Showing first ${DETAIL_LIMIT} of ${model.findings.totalCount.toLocaleString("en-IN")} canonical findings.`
      : `Showing ${model.findings.totalCount} canonical finding(s).`;

    const unexplained = readiness.reconciliation.unexplainedDifferences;
    document.getElementById("canonicalReconciliation").innerHTML = `<p><strong>${unexplained === 0 ? "PASS / Reconciled" : "NOT READY / Investigation required"}</strong></p><p>Unexplained Differences: ${unexplained}</p>${readiness.blockers.length ? `<p>${readiness.blockers.map((item) => escapeHtml(item.code)).join(", ")}</p>` : ""}`;
    return model;
  }

  function render(shadowResult) {
    const source = arguments.length
      ? shadowResult
      : global.BancaTrackerShadowEnrichment && global.BancaTrackerShadowEnrichment.getLastResult
        ? global.BancaTrackerShadowEnrichment.getLastResult()
        : null;
    return renderModel(buildModel(source));
  }

  global.BancaTrackerCanonicalDataQuality = Object.freeze({
    DETAIL_LIMIT,
    aggregateFindings,
    buildModel,
    renderModel,
    render,
  });
})(window);
