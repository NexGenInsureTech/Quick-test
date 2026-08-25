/*==============================================================
BancaTracker Enterprise
Version : 8.2.0-dev
File    : dateResolver.js
Module  : Enrichment Foundation
Purpose : Parse policy-issued dates and derive canonical time fields
==============================================================*/

(function () {
  "use strict";

  /*==============================================================
  CONSTANTS
  ==============================================================*/

  const MONTH_LABELS = Object.freeze([
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ]);

  /*==============================================================
  HELPERS
  ==============================================================*/

  function pad2(value) {
    return String(value).padStart(2, "0");
  }

  function isValidDateParts(year, month, day) {
    if (
      !Number.isInteger(year) ||
      !Number.isInteger(month) ||
      !Number.isInteger(day)
    ) {
      return false;
    }

    if (month < 1 || month > 12) {
      return false;
    }

    if (day < 1 || day > 31) {
      return false;
    }

    const date = new Date(Date.UTC(year, month - 1, day));

    return (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
    );
  }

  function buildCanonicalDate(year, month, day) {
    return `${year}-${pad2(month)}-${pad2(day)}`;
  }

  function buildMonthKey(year, month) {
    return `${year}-${pad2(month)}`;
  }

  function buildMonthLabel(year, month) {
    const shortYear = String(year).slice(-2);

    return `${MONTH_LABELS[month - 1]}-${shortYear}`;
  }

  function deriveFinancialYear(year, month) {
    if (month >= 4) {
      return `FY${year}-${String(year + 1).slice(-2)}`;
    }

    return `FY${year - 1}-${String(year).slice(-2)}`;
  }

  /*==============================================================
  STRING DATE PARSING
  ==============================================================*/

  function parseIsoDate(value) {
    const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);

    if (!match) {
      return null;
    }

    return {
      year: Number(match[1]),
      month: Number(match[2]),
      day: Number(match[3]),
      format: "YYYY-MM-DD",
    };
  }

  function parseIndianDate(value) {
    const match = String(value).match(
      /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/,
    );

    if (!match) {
      return null;
    }

    return {
      day: Number(match[1]),
      month: Number(match[2]),
      year: Number(match[3]),
      format: "DD/MM/YYYY",
    };
  }

  function parseDateString(value) {
    const trimmed = String(value || "").trim();

    if (!trimmed) {
      return null;
    }

    const iso = parseIsoDate(trimmed);

    if (iso) {
      return iso;
    }

    const indian = parseIndianDate(trimmed);

    if (indian) {
      return indian;
    }

    return null;
  }

  /*==============================================================
  DATE OBJECT PARSING
  ==============================================================*/

  function parseDateObject(value) {
    if (!(value instanceof Date)) {
      return null;
    }

    if (Number.isNaN(value.getTime())) {
      return null;
    }

    return {
      year: value.getFullYear(),
      month: value.getMonth() + 1,
      day: value.getDate(),
      format: "DATE_OBJECT",
    };
  }

  /*==============================================================
  MAIN RESOLVER
  ==============================================================*/

  function resolve(value) {
    if (
      value === null ||
      typeof value === "undefined" ||
      String(value).trim() === ""
    ) {
      return {
        success: false,
        error: "DATE_MISSING",
        input: value,
      };
    }

    const parsed = parseDateObject(value) || parseDateString(value);

    if (!parsed) {
      return {
        success: false,
        error: "DATE_FORMAT_UNSUPPORTED",
        input: value,
      };
    }

    const { year, month, day } = parsed;

    if (!isValidDateParts(year, month, day)) {
      return {
        success: false,
        error: "DATE_INVALID",
        input: value,
        parsed,
      };
    }

    return {
      success: true,

      sourceFormat: parsed.format,

      policyIssuedDate: buildCanonicalDate(year, month, day),

      year,
      month,

      monthKey: buildMonthKey(year, month),

      monthLabel: buildMonthLabel(year, month),

      day,

      financialYear: deriveFinancialYear(year, month),
    };
  }

  /*==============================================================
  LEGACY FIELD COMPARISON
  ==============================================================*/

  function compareLegacyMonth(legacyMonth, derivedMonthLabel) {
    if (
      legacyMonth === null ||
      typeof legacyMonth === "undefined" ||
      String(legacyMonth).trim() === ""
    ) {
      return "NOT_SUPPLIED";
    }

    return String(legacyMonth).trim() === derivedMonthLabel
      ? "MATCH"
      : "MISMATCH";
  }

  function compareLegacyDay(legacyDay, derivedDay) {
    if (
      legacyDay === null ||
      typeof legacyDay === "undefined" ||
      String(legacyDay).trim() === ""
    ) {
      return "NOT_SUPPLIED";
    }

    return Number(legacyDay) === Number(derivedDay) ? "MATCH" : "MISMATCH";
  }

  /*==============================================================
  PUBLIC API
  ==============================================================*/

  const BancaTrackerDateResolver = Object.freeze({
    resolve,
    compareLegacyMonth,
    compareLegacyDay,
    deriveFinancialYear,
  });

  window.BancaTrackerDateResolver = BancaTrackerDateResolver;
})();
