(function (global) {
  "use strict";
  const DAY_MS = 86400000;
  const END = new Set(["INCLUSIVE", "EXCLUSIVE"]);
  const LEAP = new Set(["FEB_28", "MAR_01"]);
  function result(status, classification, v, diagnosticCodes) {
    return { status, classification, normalizedStartDate: v.normalizedStartDate || null,
      normalizedEndDate: v.normalizedEndDate || null, coverageEndExclusive: v.coverageEndExclusive || null,
      durationDays: Number.isInteger(v.durationDays) ? v.durationDays : null,
      exactCalendarYears: Number.isInteger(v.exactCalendarYears) ? v.exactCalendarYears : null,
      diagnosticCodes: diagnosticCodes.slice() };
  }
  function parse(value) {
    if (value === null || typeof value === "undefined" || (typeof value === "string" && value.trim() === "")) {
      return { success: false, error: "DATE_MISSING" };
    }
    if (typeof value !== "string") return { success: false, error: "DATE_TYPE_UNSUPPORTED" };
    const resolver = global.BancaTrackerDateResolver;
    if (!resolver || typeof resolver.resolve !== "function") return { success: false, error: "DATE_RESOLVER_UNAVAILABLE" };
    const r = resolver.resolve(value);
    return r.success ? { success: true, canonical: r.policyIssuedDate, year: r.year, month: r.month, day: r.day } : r;
  }
  const utc = (p) => Date.UTC(p.year, p.month - 1, p.day);
  const leapDay = (p) => p.month === 2 && p.day === 29;
  function canonical(time) {
    const d = new Date(time);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
  }
  function anniversary(start, years, convention) {
    const year = start.year + years;
    if (!leapDay(start)) return Date.UTC(year, start.month - 1, start.day);
    if (new Date(Date.UTC(year, 1, 29)).getUTCDate() === 29) return Date.UTC(year, 1, 29);
    return convention === "FEB_28" ? Date.UTC(year, 1, 28) : Date.UTC(year, 2, 1);
  }
  function classify(start, coverageEnd, convention) {
    const exact = [null, "ANNUAL", "LONG_TERM_2_YEARS", "LONG_TERM_3_YEARS", "LONG_TERM_4_TO_5_YEARS", "LONG_TERM_4_TO_5_YEARS"];
    const candidateYears = new Date(coverageEnd).getUTCFullYear() - start.year;
    if (candidateYears >= 1 && coverageEnd === anniversary(start, candidateYears, convention)) {
      return { classification: exact[candidateYears] || "LONG_TERM_OVER_5_YEARS", exactCalendarYears: candidateYears };
    }
    if (coverageEnd < anniversary(start, 1, convention)) return { classification: "SHORT_TERM", exactCalendarYears: null };
    if (coverageEnd > anniversary(start, 5, convention)) return { classification: "LONG_TERM_OVER_5_YEARS", exactCalendarYears: null };
    return { classification: "NON_STANDARD_TERM", exactCalendarYears: null };
  }
  function classifyPolicyTenure(input) {
    const source = input && typeof input === "object" ? input : {};
    const start = parse(source.startDate); const end = parse(source.endDate);
    const v = { normalizedStartDate: start.success ? start.canonical : null, normalizedEndDate: end.success ? end.canonical : null };
    const codes = [];
    function addDateDiagnostic(parsed, field) {
      if (parsed.success) return;
      if (parsed.error === "DATE_RESOLVER_UNAVAILABLE") {
        if (!codes.includes("DATE_RESOLVER_UNAVAILABLE")) codes.push("DATE_RESOLVER_UNAVAILABLE");
      } else if (parsed.error === "DATE_MISSING") codes.push(`${field}_DATE_MISSING`);
      else if (parsed.error === "DATE_TYPE_UNSUPPORTED") codes.push(`${field}_DATE_TYPE_UNSUPPORTED`);
      else codes.push(`${field}_DATE_INVALID`);
    }
    addDateDiagnostic(start, "START"); addDateDiagnostic(end, "END");
    if (codes.length) {
      const invalid = codes.some((code) => !code.endsWith("_MISSING"));
      return result(invalid ? "INVALID" : "UNKNOWN", invalid ? "INVALID" : "UNKNOWN", v, codes);
    }
    if (source.endDateConvention == null || String(source.endDateConvention).trim() === "") return result("UNKNOWN", "UNKNOWN", v, ["END_DATE_CONVENTION_MISSING"]);
    const endConvention = String(source.endDateConvention).trim().toUpperCase();
    if (!END.has(endConvention)) return result("INVALID", "INVALID", v, ["END_DATE_CONVENTION_INVALID"]);
    const startTime = utc(start); const endTime = utc(end);
    const coverageEnd = endConvention === "INCLUSIVE" ? endTime + DAY_MS : endTime;
    v.coverageEndExclusive = canonical(coverageEnd); v.durationDays = (coverageEnd - startTime) / DAY_MS;
    if (endTime < startTime) return result("INVALID", "INVALID", v, ["END_DATE_BEFORE_START_DATE"]);
    if (!Number.isInteger(v.durationDays) || v.durationDays <= 0) return result("INVALID", "INVALID", v, ["NON_POSITIVE_COVERAGE_DURATION"]);
    let leapConvention = source.leapDayAnniversaryConvention == null ? "" : String(source.leapDayAnniversaryConvention).trim().toUpperCase();
    if (leapDay(start) && leapConvention && !LEAP.has(leapConvention)) return result("INVALID", "INVALID", v, ["LEAP_DAY_ANNIVERSARY_CONVENTION_INVALID"]);
    if (leapDay(start) && !leapConvention) {
      const a = classify(start, coverageEnd, "FEB_28"); const b = classify(start, coverageEnd, "MAR_01");
      if (a.classification !== b.classification || a.exactCalendarYears !== b.exactCalendarYears) return result("UNKNOWN", "UNKNOWN", v, ["LEAP_DAY_ANNIVERSARY_CONVENTION_REQUIRED"]);
      return result("SUCCESS", a.classification, { ...v, exactCalendarYears: a.exactCalendarYears }, []);
    }
    leapConvention = leapConvention || "MAR_01";
    const governed = classify(start, coverageEnd, leapConvention);
    return result("SUCCESS", governed.classification, { ...v, exactCalendarYears: governed.exactCalendarYears }, []);
  }
  global.BancaTrackerPolicyTenure = Object.freeze({ classifyPolicyTenure });
})(typeof window !== "undefined" ? window : globalThis);
