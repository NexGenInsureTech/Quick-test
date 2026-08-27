/*==============================================================
BancaTracker Enterprise
Version : 8.2.0-dev
File    : masterDataAdmin.js
Module  : Master Data Administration
Purpose : Render read-only master metadata and canonical readiness
==============================================================*/

(function (global) {
  "use strict";

  const MASTER_DEFINITIONS = Object.freeze([
    { key: "geography", type: "GEOGRAPHY_MASTER", label: "Geography Master", purpose: "State → Zone" },
    { key: "branch", type: "BRANCH_MASTER", label: "Branch Master", purpose: "Durable branch identity and bank geography" },
    { key: "employee", type: "EMPLOYEE_MASTER", label: "Employee Master", purpose: "Employee identity and role" },
    { key: "hierarchy", type: "HIERARCHY", label: "Organisation Hierarchy", purpose: "RM → CSM → ASM → ZSM → NH" },
    { key: "assignment", type: "BRANCH_ASSIGNMENT", label: "Branch Assignment", purpose: "Branch → assigned RM" },
  ]);

  const COVERAGE_DEFINITIONS = Object.freeze([
    ["dateReadyPct", "Date ready %"],
    ["branchExactPct", "Branch exact %"],
    ["branchResolvedPct", "Branch resolved %"],
    ["geographyResolvedPct", "Geography resolved %"],
    ["assignmentResolvedPct", "Assignment resolved %"],
    ["hierarchyResolvedPct", "Hierarchy resolved %"],
  ]);

  const DIAGNOSTIC_LABELS = Object.freeze({
    SHADOW_FAILED: "Canonical shadow enrichment failed.",
    UNEXPLAINED_RECONCILIATION_DIFFERENCE: "Canonical and legacy results contain an unexplained difference.",
    NO_CANONICAL_ROWS: "No usable canonical rows are available.",
    GEOGRAPHY_MASTER_ABSENT: "Geography Master is not configured.",
    BRANCH_MASTER_ABSENT: "Branch Master is not configured.",
    EMPLOYEE_MASTER_ABSENT: "Employee Master is not configured.",
    HIERARCHY_MASTER_ABSENT: "Organisation Hierarchy is not configured.",
    ASSIGNMENT_MASTER_ABSENT: "Branch Assignment is not configured.",
    BRANCH_UNMAPPED_PRESENT: "Some branches could not be resolved.",
    BRANCH_FALLBACK_PRESENT: "Some branches were resolved using name fallback.",
    GEOGRAPHY_UNMAPPED_PRESENT: "Some geography values could not be resolved.",
    ASSIGNMENT_UNMAPPED_PRESENT: "Some branches have no resolved RM assignment.",
    HIERARCHY_PARTIAL_PRESENT: "Some assigned-RM hierarchies are incomplete.",
    INVALID_ROWS_PRESENT: "Some records could not be canonically enriched.",
    LEGACY_MONTH_MISMATCH_PRESENT: "Some source months differ from canonical dates.",
    LEGACY_DAY_MISMATCH_PRESENT: "Some source days differ from canonical dates.",
    LEGACY_ZONE_MISMATCH_PRESENT: "Some source zones differ from governed geography.",
    SOURCE_ASSIGNED_RM_MISMATCH_PRESENT: "Some source RMs differ from governed assignments.",
  });

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function displayValue(value) {
    return value === null || value === undefined || value === "" ? "—" : escapeHtml(value);
  }

  function displayStatus(value) {
    return String(value || "ABSENT").replace(/_/g, " ");
  }

  function displayTimestamp(value) {
    if (!value) return "—";
    return escapeHtml(String(value).replace("T", " ").replace(/\.\d{3}Z$/, " UTC"));
  }

  async function loadMasterMetadata(repository = global.BancaTrackerRepository) {
    if (!repository || typeof repository.getActiveDataset !== "function") {
      return {};
    }

    const results = await Promise.all(
      MASTER_DEFINITIONS.map(async (definition) => {
        try {
          return [definition.key, await repository.getActiveDataset(definition.type)];
        } catch (error) {
          return [definition.key, null];
        }
      }),
    );
    return Object.fromEntries(results);
  }

  function buildViewModel(readiness, metadata = {}) {
    const model = readiness || {};
    const readinessMasters = model.masters || {};
    return {
      ...model,
      masters: MASTER_DEFINITIONS.map((definition) => {
        const activeDataset = metadata[definition.key] || null;
        const diagnosticMaster = readinessMasters[definition.key] || {};
        return {
          ...definition,
          status: activeDataset ? activeDataset.status || "ACTIVE" : diagnosticMaster.status || "ABSENT",
          datasetId: activeDataset ? activeDataset.datasetId : diagnosticMaster.datasetId,
          recordCount: activeDataset && Number.isFinite(activeDataset.rowCount)
            ? activeDataset.rowCount
            : diagnosticMaster.recordCount,
          fileName: activeDataset ? activeDataset.fileName : null,
          uploadedAt: activeDataset ? activeDataset.uploadedAt : null,
        };
      }),
    };
  }

  function renderSummary(model) {
    const records = model.records || {};
    const status = displayStatus(model.overallStatus || "NOT_RUN");
    document.getElementById("masterReadinessSummary").innerHTML = [
      ["Canonical Readiness", status],
      ["Source Records", records.source || 0],
      ["Canonical Records", records.canonical || 0],
      ["Ready", records.ready || 0],
      ["Ready with Warnings", records.readyWithWarnings || 0],
      ["Invalid", records.invalid || 0],
    ].map(([label, value]) => `<div class="card"><div>${escapeHtml(label)}</div><div class="value">${escapeHtml(value)}</div></div>`).join("");
  }

  function renderMasters(model) {
    document.getElementById("masterStatusRows").innerHTML = model.masters.map((master) => {
      const supporting = [master.fileName, master.uploadedAt ? displayTimestamp(master.uploadedAt) : null]
        .filter(Boolean).join(" · ");
      return `<tr><td>${escapeHtml(master.label)}</td><td><span class="master-status">${escapeHtml(displayStatus(master.status))}</span></td><td>${displayValue(master.datasetId)}${supporting ? `<div class="scorecard-note">${escapeHtml(master.fileName || "")} ${master.uploadedAt ? `· ${displayTimestamp(master.uploadedAt)}` : ""}</div>` : ""}</td><td>${displayValue(master.recordCount)}</td><td>${escapeHtml(master.purpose)}</td></tr>`;
    }).join("");
  }

  function renderCoverage(model) {
    const readiness = model.readiness || {};
    document.getElementById("masterCoverageRows").innerHTML = COVERAGE_DEFINITIONS.map(([key, label]) => {
      const value = readiness[key] || { numerator: 0, denominator: 0, percentage: 0 };
      const percentage = Number.isFinite(value.percentage) ? value.percentage : 0;
      return `<tr><td>${escapeHtml(label)}</td><td>${escapeHtml(percentage.toFixed(1))}%</td><td>${escapeHtml(value.numerator || 0)} / ${escapeHtml(value.denominator || 0)}</td></tr>`;
    }).join("");
  }

  function renderDiagnostics(elementId, items, emptyText) {
    const element = document.getElementById(elementId);
    if (!items || !items.length) {
      element.innerHTML = `<p class="empty-state">${escapeHtml(emptyText)}</p>`;
      return;
    }
    element.innerHTML = `<ul class="master-diagnostic-list">${items.map((item) => {
      const label = DIAGNOSTIC_LABELS[item.code] || item.code;
      const count = Number.isFinite(item.count) ? ` (${item.count})` : "";
      return `<li><strong>${escapeHtml(item.code)}</strong>: ${escapeHtml(label)}${escapeHtml(count)}</li>`;
    }).join("")}</ul>`;
  }

  function renderViewModel(model) {
    renderSummary(model);
    renderMasters(model);
    renderCoverage(model);
    renderDiagnostics("masterBlockers", model.blockers, "No readiness blockers.");
    renderDiagnostics(
      "masterWarnings",
      model.warnings,
      model.overallStatus === "NOT_RUN"
        ? "Canonical readiness will be available after a PR dataset is processed."
        : "No readiness warnings.",
    );
    return model;
  }

  async function render(options = {}) {
    const shadow = options.shadow || global.BancaTrackerShadowEnrichment;
    const diagnostics = options.diagnostics || global.BancaTrackerReadinessDiagnostics;
    const shadowResult = shadow && typeof shadow.getLastResult === "function"
      ? shadow.getLastResult()
      : null;
    const readiness = diagnostics.buildReadiness(shadowResult);
    const metadata = await loadMasterMetadata(options.repository);
    return renderViewModel(buildViewModel(readiness, metadata));
  }

  global.BancaTrackerMasterDataAdmin = Object.freeze({
    render,
    renderViewModel,
    buildViewModel,
    loadMasterMetadata,
  });
})(window);
