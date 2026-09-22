/*==============================================================
BancaTracker Enterprise
Version : 8.4.0
File    : csvExport.js
Module  : Export
Purpose : Deterministic browser-local CSV serialization and download
==============================================================*/

(function (global) {
  "use strict";

  const MIME_TYPE = "text/csv;charset=utf-8";
  const DEFAULT_FILENAME = "bancatracker-export.csv";
  const NUMERIC_SCALAR = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;

  function assertRows(rows) {
    if (!Array.isArray(rows)) throw new TypeError("CSV rows must be an array.");
  }

  function assertColumns(columns) {
    if (!Array.isArray(columns) || !columns.length) throw new TypeError("CSV columns must be a non-empty array.");
    columns.forEach((column) => {
      if (!column || typeof column.label !== "string" || (!Object.prototype.hasOwnProperty.call(column, "key") && typeof column.value !== "function") || column.value !== undefined && typeof column.value !== "function") throw new TypeError("Each CSV column requires a label and key or value accessor.");
    });
  }

  function hardenSpreadsheetText(value) {
    if (typeof value !== "string" || NUMERIC_SCALAR.test(value) || value.startsWith("'")) return value;
    return /^\s*[=+\-@]/.test(value) ? `'${value}` : value;
  }

  function cellValue(value) {
    if (value === null || value === undefined) return "";
    if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? "" : value.toISOString();
    return typeof value === "string" ? hardenSpreadsheetText(value) : String(value);
  }

  function escapeCell(value) {
    const text = cellValue(value);
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }

  function serializeCsv(options = {}) {
    const rows = options.rows;
    const columns = options.columns;
    const includeBom = options.includeBom !== false;
    const lineEnding = options.lineEnding === undefined ? "\r\n" : options.lineEnding;
    assertRows(rows);
    assertColumns(columns);
    if (typeof lineEnding !== "string") throw new TypeError("CSV lineEnding must be a string.");
    const lines = [columns.map((column) => escapeCell(column.label)).join(",")];
    rows.forEach((row) => lines.push(columns.map((column) => escapeCell(typeof column.value === "function" ? column.value(row) : row == null ? undefined : row[column.key])).join(",")));
    return `${includeBom ? "\uFEFF" : ""}${lines.join(lineEnding)}${lineEnding}`;
  }

  function slug(value) {
    return String(value == null ? "" : value).trim().toLowerCase()
      .replace(/\.csv$/i, "")
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function fallbackFilename(value) {
    const name = slug(value || DEFAULT_FILENAME) || "bancatracker-export";
    return `${name}.csv`;
  }

  function buildFilename(options = {}) {
    const periods = Array.isArray(options.periods) ? options.periods.map(slug).filter(Boolean) : options.periods == null ? [] : [slug(options.periods)].filter(Boolean);
    const components = [slug(options.datasetId), periods.join("-vs-"), slug(options.scopeLabel)].filter(Boolean);
    return components.length ? `${components.join("_")}.csv` : fallbackFilename(options.fallback);
  }

  function downloadCsv(options = {}) {
    if (typeof options.csv !== "string") throw new TypeError("CSV download content must be a string.");
    if (!global.document || !global.URL || typeof global.URL.createObjectURL !== "function" || typeof global.URL.revokeObjectURL !== "function" || typeof global.Blob !== "function") throw new Error("CSV download requires browser Blob, URL, and document support.");
    const filename = buildFilename({ fallback: options.filename || DEFAULT_FILENAME });
    const blob = new global.Blob([options.csv], { type: MIME_TYPE });
    const url = global.URL.createObjectURL(blob);
    const anchor = global.document.createElement("a");
    try {
      anchor.href = url;
      anchor.download = filename;
      if (global.document.body && typeof global.document.body.appendChild === "function") global.document.body.appendChild(anchor);
      anchor.click();
    } finally {
      if (typeof anchor.remove === "function") anchor.remove();
      else if (anchor.parentNode && typeof anchor.parentNode.removeChild === "function") anchor.parentNode.removeChild(anchor);
      global.URL.revokeObjectURL(url);
    }
    return { filename, mimeType: MIME_TYPE };
  }

  global.BancaTrackerCsvExport = Object.freeze({ serializeCsv, downloadCsv, buildFilename });
})(window);
