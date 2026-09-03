/*==============================================================
BancaTracker Enterprise
Version : 8.2.0
File    : masterDataImport.js
Module  : Master Data Administration
Purpose : Parse, validate, stage, persist and activate master CSV datasets
==============================================================*/

(function (global) {
  "use strict";

  const SCHEMAS = Object.freeze({
    GEOGRAPHY_MASTER: Object.freeze({
      label: "Geography Master",
      required: ["STATE ID", "STATE NAME", "ZONE ID", "ZONE NAME", "ACTIVE"],
      optional: ["STATE CODE"],
      preparer: "BancaTrackerGeographyMaster",
      dependencies: [],
    }),
    BRANCH_MASTER: Object.freeze({
      label: "Branch Master",
      required: ["BANK ID", "BRANCH CODE", "BRANCH NAME", "STATE ID", "ACTIVE"],
      optional: ["ACTIVATION ELIGIBLE", "BANK REGION ID", "BANK REGION NAME", "BANK ZONE ID", "BANK ZONE NAME", "FGM OFFICE ID", "FGM OFFICE NAME", "VALID FROM", "VALID TO"],
      preparer: "BancaTrackerBranchMaster",
      dependencies: ["GEOGRAPHY_MASTER"],
    }),
    EMPLOYEE_MASTER: Object.freeze({
      label: "Employee Master",
      required: ["EMPLOYEE ID", "EMPLOYEE NAME"],
      optional: ["DESIGNATION", "GRADE", "BAND", "EMPLOYMENT TYPE", "FUNCTION", "CHANNEL", "BASE LOCATION", "DATE OF JOINING", "CHANNEL JOIN DATE", "DESIGNATION EFFECTIVE DATE", "EMPLOYMENT STATUS", "EXIT DATE", "ROLE", "ACTIVE", "VALID FROM", "VALID TO"],
      preparer: "BancaTrackerEmployeeMaster",
      dependencies: [],
    }),
    HIERARCHY: Object.freeze({
      label: "Organisation Hierarchy",
      required: ["EMPLOYEE ID"],
      optional: ["MANAGER ID", "MANAGER EMPLOYEE ID", "VALID FROM", "VALID TO"],
      preparer: "BancaTrackerHierarchyMaster",
      dependencies: ["EMPLOYEE_MASTER"],
    }),
    BRANCH_ASSIGNMENT: Object.freeze({
      label: "Branch Assignment",
      required: ["BANK ID", "BRANCH CODE", "RM ID", "ACTIVE"],
      optional: ["VALID FROM", "VALID TO"],
      preparer: "BancaTrackerBranchAssignmentMaster",
      dependencies: ["BRANCH_MASTER", "EMPLOYEE_MASTER"],
    }),
    BRANCH_BUDGET_POTENTIAL: Object.freeze({
      label: "Branch Budget & Potential",
      required: ["BANK ID", "BRANCH CODE", "PERIOD", "BUDGET", "POTENTIAL"],
      optional: ["BRANCH NAME"],
      preparer: "BancaTrackerBranchBudgetPotentialMaster",
      dependencies: ["BRANCH_MASTER"],
    }),
  });

  let currentPreview = null;
  let isCommitting = false;

  function normalizeHeader(value) {
    return String(value == null ? "" : value).replace(/^\uFEFF/, "").trim().toUpperCase();
  }

  function getEmployeeContractMetadata(headers) {
    const contract = global.BancaTrackerDatasetRegistry.EMPLOYEE_DATA_CONTRACT;
    const available = new Set((headers || []).map(normalizeHeader));
    const hasNativeFields = available.has("DESIGNATION") || available.has("EMPLOYMENT STATUS");
    const hasLegacyFields = available.has("ROLE") || available.has("ACTIVE");
    const sourceProfile = hasNativeFields
      ? (hasLegacyFields ? contract.PROFILES.MIXED_TRANSITIONAL : contract.PROFILES.NATIVE_V2)
      : contract.PROFILES.LEGACY_V1;
    return Object.freeze({
      dataContract: Object.freeze({
        name: contract.NAME,
        version: sourceProfile === contract.PROFILES.LEGACY_V1 ? contract.LEGACY_VERSION : contract.CURRENT_VERSION,
        sourceProfile,
        normalizerVersion: contract.CURRENT_VERSION,
      }),
    });
  }

  function getHierarchyImportProfile(headers) {
    const contract = global.BancaTrackerDatasetRegistry.HIERARCHY_DATA_CONTRACT;
    const available = new Set((headers || []).map(normalizeHeader));
    const hasLegacyManager = available.has("MANAGER ID");
    const hasNativeManager = available.has("MANAGER EMPLOYEE ID");
    if (hasLegacyManager && hasNativeManager) return Object.freeze({ mixed: true, sourceProfile: null, required: ["EMPLOYEE ID"] });
    const native = hasNativeManager;
    const sourceProfile = native ? contract.PROFILES.DIRECT_REPORTING_V2 : contract.PROFILES.LEGACY_V1;
    return Object.freeze({
      mixed: false,
      native,
      sourceProfile,
      required: native ? ["EMPLOYEE ID", "MANAGER EMPLOYEE ID", "VALID FROM"] : ["EMPLOYEE ID", "MANAGER ID"],
      metadata: Object.freeze({ dataContract: Object.freeze({ name: contract.NAME, version: native ? contract.CURRENT_VERSION : contract.LEGACY_VERSION, sourceProfile, normalizerVersion: native ? contract.CURRENT_VERSION : contract.LEGACY_VERSION, ...(native ? { dateBoundary: "INCLUSIVE" } : {}) }) }),
    });
  }

  function parseText(text) {
    const parser = global.BancaTrackerCsvProcessor;
    if (!parser || typeof parser.parseCSV !== "function") {
      throw new Error("CSV parser is unavailable.");
    }
    if (!String(text || "").trim()) throw new Error("The selected CSV file is empty.");
    const parsed = parser.parseCSV(text);
    if (!parsed.length) throw new Error("The selected CSV file is empty.");
    const headers = parsed[0].map(normalizeHeader);
    if (!headers.some(Boolean)) throw new Error("The selected CSV has no headers.");
    const rows = parsed.slice(1)
      .filter((row) => row.some((value) => String(value || "").trim()))
      .map((row) => Object.fromEntries(headers.map((header, index) => [header, String(row[index] == null ? "" : row[index]).trim()])));
    return { headers, rows };
  }

  async function parseFile(file) {
    if (!file || !/\.csv$/i.test(file.name || "")) {
      throw new Error("Select a CSV file.");
    }
    if (typeof file.text === "function") return parseText(await file.text());
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        try { resolve(parseText(event.target.result)); } catch (error) { reject(error); }
      };
      reader.onerror = () => reject(new Error("The selected CSV file could not be read."));
      reader.readAsText(file);
    });
  }

  function missingColumnFindings(schema, headers, requiredHeaders = schema.required) {
    const available = new Set(headers.map(normalizeHeader));
    return requiredHeaders
      .filter((header) => !available.has(header))
      .map((header) => ({
        severity: "ERROR",
        code: "MASTER_REQUIRED_COLUMN_MISSING",
        field: header,
        message: `Required column is missing: ${header}`,
      }));
  }

  async function loadDependencyContext(datasetType, repository, hierarchyProfile = null) {
    const schema = SCHEMAS[datasetType];
    const dependencyStatus = {};
    const context = {};
    const findings = [];
    if (!schema.dependencies.length) return { context, dependencyStatus, findings };
    if (datasetType === "HIERARCHY" && hierarchyProfile && hierarchyProfile.native) {
      const employeeContext = typeof repository.getActiveEmployeeMasterContext === "function" ? await repository.getActiveEmployeeMasterContext() : null;
      const available = employeeContext && ["READY", "LEGACY_COMPATIBILITY"].includes(employeeContext.status) && employeeContext.records.length;
      dependencyStatus.EMPLOYEE_MASTER = available ? employeeContext.status : employeeContext && employeeContext.status || "ABSENT";
      context.employeeRecords = available ? employeeContext.records : [];
      context.employeeContext = employeeContext;
      if (!available) findings.push({ severity: "ERROR", code: "HIERARCHY_V2_EMPLOYEE_MASTER_UNAVAILABLE", field: "EMPLOYEE ID", message: "A supported active canonical Employee Master is required for Direct Reporting Hierarchy v2." });
      return { context, dependencyStatus, findings };
    }
    const results = await Promise.all(schema.dependencies.map(async (type) => {
      const records = await repository.getActiveMasterRecords(type);
      return [type, records];
    }));
    results.forEach(([type, records]) => {
      dependencyStatus[type] = records.length ? "ACTIVE" : "ABSENT";
      if (type === "GEOGRAPHY_MASTER") context.geographyRecords = records;
      if (type === "BRANCH_MASTER") context.branchRecords = records;
      if (type === "EMPLOYEE_MASTER") context.employeeRecords = records;
    });
    return { context, dependencyStatus, findings };
  }

  async function prepareImport(datasetType, parsed, options = {}) {
    const schema = SCHEMAS[datasetType];
    if (!schema) throw new Error(`Unsupported master dataset type: ${datasetType}`);
    const repository = options.repository || global.BancaTrackerRepository;
    const source = Array.isArray(parsed) ? { headers: Object.keys(parsed[0] || {}), rows: parsed } : parsed;
    const rawRows = source && Array.isArray(source.rows) ? source.rows : [];
    const headers = source && Array.isArray(source.headers) ? source.headers : [];
    const hierarchyProfile = datasetType === "HIERARCHY" ? getHierarchyImportProfile(headers) : null;
    const requiredHeaders = hierarchyProfile ? hierarchyProfile.required : schema.required;
    const columnFindings = missingColumnFindings(schema, headers, requiredHeaders);
    const profileFindings = hierarchyProfile && hierarchyProfile.mixed ? [{ severity: "ERROR", code: "HIERARCHY_MIXED_CONTRACT_PROHIBITED", field: null, message: "Legacy MANAGER ID and native MANAGER EMPLOYEE ID cannot be mixed in one hierarchy dataset." }] : [];
    const dependencies = await loadDependencyContext(datasetType, repository, hierarchyProfile);
    const preparer = hierarchyProfile && hierarchyProfile.native ? global.BancaTrackerDirectReportingHierarchy : global[schema.preparer];
    const prepared = hierarchyProfile && hierarchyProfile.mixed
      ? { records: [], findings: [], valid: false }
      : hierarchyProfile && hierarchyProfile.native
        ? preparer.prepareDataset(rawRows, `PREVIEW:${datasetType}`, dependencies.context.employeeRecords)
        : preparer.prepareDataset(rawRows, `PREVIEW:${datasetType}`, dependencies.context);
    const findings = [...columnFindings, ...profileFindings, ...dependencies.findings, ...prepared.findings];
    const errorCount = findings.filter((finding) => finding.severity === "ERROR").length;
    const warningCount = findings.filter((finding) => finding.severity === "WARNING").length;
    const preview = Object.freeze({
      datasetType,
      fileName: options.fileName || null,
      rowCount: rawRows.length,
      validRows: errorCount === 0 ? prepared.records.length : null,
      errorCount,
      warningCount,
      valid: errorCount === 0 && prepared.valid,
      records: prepared.records,
      findings,
      dependencyStatus: dependencies.dependencyStatus,
      createdAt: new Date().toISOString(),
      rawRows,
      dependencyContext: dependencies.context,
      universeReadiness: prepared.universeReadiness || null,
      commercialSummary: prepared.commercialSummary || null,
      commercialReadiness: prepared.commercialReadiness || null,
      contractMetadata: datasetType === "EMPLOYEE_MASTER" ? getEmployeeContractMetadata(headers) : hierarchyProfile && !hierarchyProfile.mixed ? hierarchyProfile.metadata : null,
      hierarchyProfile,
    });
    currentPreview = preview;
    return preview;
  }

  async function commitImport(preview = currentPreview, options = {}) {
    if (isCommitting) throw new Error("A master activation is already in progress.");
    if (!preview || !preview.valid || preview.errorCount > 0) {
      throw new Error("Only a valid preview can be activated.");
    }
    const repository = options.repository || global.BancaTrackerRepository;
    const schema = SCHEMAS[preview.datasetType];
    let staged = null;
    isCommitting = true;
    try {
      const dependencies = await loadDependencyContext(
        preview.datasetType,
        repository,
        preview.hierarchyProfile,
      );
      if (dependencies.findings.length) throw new Error("Master dependency validation failed. Validate the file again.");
      const preparer = preview.hierarchyProfile && preview.hierarchyProfile.native ? global.BancaTrackerDirectReportingHierarchy : global[schema.preparer];
      const preflight = preview.hierarchyProfile && preview.hierarchyProfile.native
        ? preparer.prepareDataset(preview.rawRows, `PREVIEW:${preview.datasetType}`, dependencies.context.employeeRecords)
        : preparer.prepareDataset(preview.rawRows, `PREVIEW:${preview.datasetType}`, dependencies.context);
      if (!preflight.valid) {
        throw new Error(
          "Master validation failed against the current active dependencies. Validate the file again.",
        );
      }
      staged = await repository.stageDataset({
        datasetType: preview.datasetType,
        fileName: preview.fileName,
        rowCount: preview.rowCount,
        validRows: preview.validRows,
        warningCount: preview.warningCount,
        errorCount: preview.errorCount,
        metadata: preview.contractMetadata
          ? { ...preview.contractMetadata, dataContract: { ...preview.contractMetadata.dataContract, declaredAt: new Date().toISOString() } }
          : null,
      });
      const prepared = preview.hierarchyProfile && preview.hierarchyProfile.native
        ? preparer.prepareDataset(preview.rawRows, staged.datasetId, dependencies.context.employeeRecords)
        : preparer.prepareDataset(preview.rawRows, staged.datasetId, dependencies.context);
      if (!prepared.valid) throw new Error("Master validation changed before persistence.");
      const recordsToPersist = preview.datasetType === "EMPLOYEE_MASTER"
        ? prepared.records.map((record) => global.BancaTrackerEmployeeMaster.toPersistedRecord(record))
        : preview.hierarchyProfile && preview.hierarchyProfile.native
          ? prepared.records.map((record) => global.BancaTrackerDirectReportingHierarchy.toPersistedRecord(record))
          : prepared.records;
      await repository.saveStagedMasterRecords(staged.datasetId, recordsToPersist);
      const activation = await repository.activateDataset(staged.datasetId);
      currentPreview = null;
      return { success: true, dataset: staged, activation, records: recordsToPersist };
    } catch (error) {
      if (staged && repository.markDatasetFailed) {
        try { await repository.markDatasetFailed(staged.datasetId, { message: error.message }); } catch (markError) { /* Preserve original failure. */ }
      }
      throw error;
    } finally {
      isCommitting = false;
    }
  }

  function cancelImport() { currentPreview = null; return null; }
  function getCurrentPreview() { return currentPreview; }
  function canCommit(preview = currentPreview) { return Boolean(preview && preview.valid && preview.errorCount === 0 && !isCommitting); }

  global.BancaTrackerMasterDataImport = Object.freeze({
    SCHEMAS,
    parseText,
    parseFile,
    prepareImport,
    commitImport,
    cancelImport,
    getCurrentPreview,
    canCommit,
  });
})(window);
