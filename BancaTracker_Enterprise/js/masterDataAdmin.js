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
    const universe = model.branchUniverse || null;
    document.getElementById("masterReadinessSummary").innerHTML = [
      ["Canonical Readiness", status],
      ["Source Records", records.source || 0],
      ["Canonical Records", records.canonical || 0],
      ["Ready", records.ready || 0],
      ["Ready with Warnings", records.readyWithWarnings || 0],
      ["Invalid", records.invalid || 0],
      ...(universe ? [
        ["Branch Universe Contract", universe.status],
        ["Universe Eligible", universe.explicitlyEligibleRecords],
        ["Universe Excluded", universe.explicitlyIneligibleRecords],
        ["Eligibility Unknown", universe.eligibilityUnknownRecords],
        ["Bank Identity Unresolved", universe.bankIdentityUnresolvedRecords],
      ] : []),
    ].map(([label, value]) => `<div class="card"><div>${escapeHtml(label)}</div><div class="value">${escapeHtml(value)}</div></div>`).join("");
  }

  function renderMasters(model) {
    document.getElementById("masterStatusRows").innerHTML = model.masters.map((master) => {
      const supporting = [master.fileName, master.uploadedAt ? displayTimestamp(master.uploadedAt) : null]
        .filter(Boolean).join(" · ");
      const action = master.status === "ACTIVE" ? "Replace" : "Upload";
      return `<tr><td>${escapeHtml(master.label)}</td><td><span class="master-status">${escapeHtml(displayStatus(master.status))}</span></td><td>${displayValue(master.datasetId)}${supporting ? `<div class="scorecard-note">${escapeHtml(master.fileName || "")} ${master.uploadedAt ? `· ${displayTimestamp(master.uploadedAt)}` : ""}</div>` : ""}</td><td>${displayValue(master.recordCount)}</td><td>${escapeHtml(master.purpose)}</td><td><button type="button" data-master-type="${escapeHtml(master.type)}">${action}</button></td></tr>`;
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

  const FINDING_LIMIT = 100;

  function renderSchemaHelp(datasetType) {
    const schema = global.BancaTrackerMasterDataImport.SCHEMAS[datasetType];
    document.getElementById("masterSchemaHelp").textContent = schema
      ? `Required: ${schema.required.join(", ")}. Optional: ${schema.optional.join(", ") || "None"}.`
      : "";
  }

  function renderImportPreview(preview) {
    document.getElementById("masterImportPreview").hidden = false;
    const universe = preview.universeReadiness;
    document.getElementById("masterImportSummary").innerHTML = [
      ["Master", global.BancaTrackerMasterDataImport.SCHEMAS[preview.datasetType].label],
      ["File", preview.fileName || "—"], ["Rows", preview.rowCount],
      ["Errors", preview.errorCount], ["Warnings", preview.warningCount],
      ["Validation", preview.valid ? "VALID" : "INVALID"],
      ...(universe ? [
        ["Universe Readiness", universe.status],
        ["Eligible", universe.explicitlyEligibleRecords],
        ["Excluded", universe.explicitlyIneligibleRecords],
        ["Eligibility Unknown", universe.eligibilityUnknownRecords],
        ["Bank Identity Unresolved", universe.bankIdentityUnresolvedRecords],
      ] : []),
    ].map(([label, value]) => `<div class="card"><div>${escapeHtml(label)}</div><div class="value">${escapeHtml(value)}</div></div>`).join("");
    const findings = preview.findings.slice(0, FINDING_LIMIT);
    document.getElementById("masterImportFindings").innerHTML = findings.length
      ? findings.map((finding) => `<tr><td>${escapeHtml(finding.severity)}</td><td>${escapeHtml(finding.code)}</td><td>${displayValue(finding.rowNumber || finding.sourceRowNumber)}</td><td>${displayValue(finding.field)}</td><td>${escapeHtml(finding.message)}</td></tr>`).join("")
      : `<tr><td colspan="5" class="empty-state">No validation findings.</td></tr>`;
    document.getElementById("masterFindingLimit").textContent = preview.findings.length > FINDING_LIMIT
      ? `Showing first ${FINDING_LIMIT} of ${preview.findings.length.toLocaleString("en-IN")} findings.`
      : `Showing ${preview.findings.length} finding(s).`;
    document.getElementById("reviewMasterActivation").disabled = !global.BancaTrackerMasterDataImport.canCommit(preview);
    document.getElementById("masterActivationConfirmation").hidden = true;
  }

  function resetImportUi() {
    global.BancaTrackerMasterDataImport.cancelImport();
    document.getElementById("masterImportFile").value = "";
    document.getElementById("masterImportPreview").hidden = true;
    document.getElementById("masterActivationConfirmation").hidden = true;
    document.getElementById("masterImportStatus").textContent = "Select a master type and CSV file to validate.";
  }

  function initializeImportUi() {
    const typeSelect = document.getElementById("masterImportType");
    if (!typeSelect || !typeSelect.dataset || typeSelect.dataset.initialized) return;
    typeSelect.dataset.initialized = "true";
    typeSelect.innerHTML = MASTER_DEFINITIONS.map((item) => `<option value="${item.type}">${escapeHtml(item.label)}</option>`).join("");
    typeSelect.value = MASTER_DEFINITIONS[0].type;
    renderSchemaHelp(typeSelect.value);
    typeSelect.addEventListener("change", () => { resetImportUi(); renderSchemaHelp(typeSelect.value); });
    document.getElementById("masterImportFile").addEventListener("change", async (event) => {
      const status = document.getElementById("masterImportStatus");
      try {
        status.className = "scorecard-note";
        status.textContent = "Parsing and validating CSV…";
        const file = event.target.files[0];
        const parsed = await global.BancaTrackerMasterDataImport.parseFile(file);
        const preview = await global.BancaTrackerMasterDataImport.prepareImport(typeSelect.value, parsed, { fileName: file.name });
        renderImportPreview(preview);
        status.textContent = preview.valid ? "Validation passed. Review activation when ready." : "Validation failed. Correct the errors before activation.";
        if (!preview.valid) status.className = "master-import-error";
      } catch (error) {
        status.className = "master-import-error";
        status.textContent = error.message || "Unable to validate the selected CSV.";
        document.getElementById("masterImportPreview").hidden = true;
      }
    });
    document.getElementById("cancelMasterImport").addEventListener("click", resetImportUi);
    document.getElementById("reviewMasterActivation").addEventListener("click", () => {
      const preview = global.BancaTrackerMasterDataImport.getCurrentPreview();
      if (!global.BancaTrackerMasterDataImport.canCommit(preview)) return;
      document.getElementById("masterActivationPrompt").textContent = `Activate this ${global.BancaTrackerMasterDataImport.SCHEMAS[preview.datasetType].label} and replace the currently active version, if any?`;
      document.getElementById("masterActivationConfirmation").hidden = false;
    });
    document.getElementById("closeMasterActivation").addEventListener("click", () => { document.getElementById("masterActivationConfirmation").hidden = true; });
    document.getElementById("confirmMasterActivation").addEventListener("click", async (event) => {
      const status = document.getElementById("masterImportStatus");
      event.target.disabled = true;
      try {
        status.className = "scorecard-note";
        status.textContent = "Staging, saving and activating master…";
        await global.BancaTrackerMasterDataImport.commitImport();
        if (global.BancaTrackerLiveBranchUniverseAuthority && typeSelect.value === "BRANCH_MASTER") {
          await global.BancaTrackerLiveBranchUniverseAuthority.loadContext();
        }
        status.textContent = "Master activated successfully.";
        document.getElementById("masterImportPreview").hidden = true;
        await render();
        const rows = global.BancaTrackerCore && global.BancaTrackerCore.state.factData;
        if (rows && rows.length && global.BancaTrackerShadowEnrichment) {
          global.BancaTrackerShadowEnrichment.run(rows).then(() => render()).catch(() => null);
        }
      } catch (error) {
        status.className = "master-import-error";
        status.textContent = error.message || "Master activation failed. The previous active version remains unchanged.";
      } finally { event.target.disabled = false; }
    });
    document.getElementById("masterStatusRows").addEventListener("click", (event) => {
      const type = event.target && event.target.dataset && event.target.dataset.masterType;
      if (!type) return;
      typeSelect.value = type;
      resetImportUi();
      renderSchemaHelp(type);
      document.getElementById("masterImportFile").focus();
    });
  }

  initializeImportUi();

  global.BancaTrackerMasterDataAdmin = Object.freeze({
    render,
    renderViewModel,
    buildViewModel,
    loadMasterMetadata,
    renderImportPreview,
    initializeImportUi,
  });
})(window);
