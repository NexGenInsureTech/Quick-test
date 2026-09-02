/*==============================================================
BancaTracker Enterprise
Version : 8.2.0
File    : employeeVintage.js
Module  : Workforce Analytics Foundation
Purpose : Derive Employee Master vintage at an explicit as-of date
==============================================================*/

(function (global) {
  "use strict";

  const DAY_MS = 24 * 60 * 60 * 1000;

  function parseCanonicalDate(value) {
    if (typeof value !== "string") return null;
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) return null;
    const year = Number(match[1]); const month = Number(match[2]); const day = Number(match[3]);
    const utc = new Date(Date.UTC(year, month - 1, day));
    if (utc.getUTCFullYear() !== year || utc.getUTCMonth() !== month - 1 || utc.getUTCDate() !== day) return null;
    return Object.freeze({ value, year, month, day, utc });
  }

  function daysInMonth(year, month) { return new Date(Date.UTC(year, month, 0)).getUTCDate(); }
  function dateAt(year, month, day) { return new Date(Date.UTC(year, month - 1, Math.min(day, daysInMonth(year, month)))); }
  function compareUtc(left, right) { return left.getTime() - right.getTime(); }
  function addCalendarMonths(start, months) {
    const zeroBasedMonth = start.month - 1 + months;
    const year = start.year + Math.floor(zeroBasedMonth / 12);
    const month = ((zeroBasedMonth % 12) + 12) % 12 + 1;
    return dateAt(year, month, start.day);
  }
  function addCalendarYears(start, years) { return dateAt(start.year + years, start.month, start.day); }
  function completedMonths(start, end) {
    let months = (end.year - start.year) * 12 + end.month - start.month;
    if (compareUtc(addCalendarMonths(start, months), end.utc) > 0) months -= 1;
    return months;
  }
  function completedYears(start, end) {
    let years = end.year - start.year;
    if (compareUtc(addCalendarYears(start, years), end.utc) > 0) years -= 1;
    return years;
  }
  function emptyMetric(status, startDate, effectiveEndDate) {
    return Object.freeze({ status, available: false, startDate: startDate || null, effectiveEndDate: effectiveEndDate || null, completedDays: null, completedMonths: null, completedYears: null });
  }
  function deriveMetric(startValue, asOf, exitDate) {
    if (startValue === null || startValue === undefined || startValue === "") return emptyMetric("UNAVAILABLE_SOURCE_DATE", null, null);
    const start = parseCanonicalDate(startValue);
    if (!start) return emptyMetric("INVALID_SOURCE_DATE", String(startValue), null);
    const effectiveEnd = exitDate && compareUtc(exitDate.utc, asOf.utc) < 0 ? exitDate : asOf;
    if (compareUtc(start.utc, effectiveEnd.utc) > 0) return emptyMetric("NOT_YET_EFFECTIVE", start.value, effectiveEnd.value);
    return Object.freeze({ status: "AVAILABLE", available: true, startDate: start.value, effectiveEndDate: effectiveEnd.value, completedDays: Math.round((effectiveEnd.utc.getTime() - start.utc.getTime()) / DAY_MS), completedMonths: completedMonths(start, effectiveEnd), completedYears: completedYears(start, effectiveEnd) });
  }

  function invalidResult(status, employee, asOfDate, code) {
    const metric = emptyMetric(status);
    return Object.freeze({ status, employeeId: employee && employee.employeeId || null, asOfDate: asOfDate || null, companyVintage: metric, channelVintage: metric, designationVintage: metric, employmentTenure: metric, diagnostics: Object.freeze([code]) });
  }
  function evaluateEmployee(employee, asOfDate) {
    const asOf = parseCanonicalDate(asOfDate);
    if (!asOf) return invalidResult("INVALID_AS_OF_DATE", employee, asOfDate, "EMPLOYEE_VINTAGE_AS_OF_INVALID");
    if (!employee || typeof employee !== "object") return invalidResult("INVALID_EMPLOYEE_RECORD", null, asOf.value, "EMPLOYEE_VINTAGE_RECORD_INVALID");
    const exitDate = employee.exitDate ? parseCanonicalDate(employee.exitDate) : null;
    const diagnostics = [];
    if (employee.exitDate && !exitDate) diagnostics.push("EMPLOYEE_VINTAGE_EXIT_DATE_INVALID");
    const companyVintage = deriveMetric(employee.dateOfJoining, asOf, exitDate);
    const channelVintage = deriveMetric(employee.channelJoinDate, asOf, exitDate);
    const designationVintage = deriveMetric(employee.designationEffectiveDate, asOf, exitDate);
    if (companyVintage.status === "INVALID_SOURCE_DATE") diagnostics.push("EMPLOYEE_VINTAGE_JOIN_DATE_INVALID");
    if (channelVintage.status === "INVALID_SOURCE_DATE") diagnostics.push("EMPLOYEE_VINTAGE_CHANNEL_JOIN_DATE_INVALID");
    if (designationVintage.status === "INVALID_SOURCE_DATE") diagnostics.push("EMPLOYEE_VINTAGE_DESIGNATION_DATE_INVALID");
    return Object.freeze({ status: diagnostics.length ? "PARTIAL" : "READY", employeeId: employee.employeeId || null, asOfDate: asOf.value, companyVintage, channelVintage, designationVintage, employmentTenure: Object.freeze({ ...companyVintage }), diagnostics: Object.freeze(diagnostics) });
  }
  function evaluateEmployees(employees, asOfDate) {
    const source = Array.isArray(employees) ? employees : [];
    const results = source.map((employee) => evaluateEmployee(employee, asOfDate));
    const metricCount = (key, status) => results.filter((result) => result[key].status === status).length;
    return Object.freeze({ status: parseCanonicalDate(asOfDate) ? "READY" : "INVALID_AS_OF_DATE", asOfDate: parseCanonicalDate(asOfDate) ? asOfDate : null, results: Object.freeze(results), diagnostics: Object.freeze({ evaluatedCount: results.length, missingCompanyAnchorCount: metricCount("companyVintage", "UNAVAILABLE_SOURCE_DATE"), missingChannelAnchorCount: metricCount("channelVintage", "UNAVAILABLE_SOURCE_DATE"), missingDesignationAnchorCount: metricCount("designationVintage", "UNAVAILABLE_SOURCE_DATE"), invalidRecordCount: results.filter((result) => result.status === "INVALID_EMPLOYEE_RECORD" || result.status === "PARTIAL").length }) });
  }

  global.BancaTrackerEmployeeVintage = Object.freeze({ parseCanonicalDate, evaluateEmployee, evaluateEmployees });
})(window);
