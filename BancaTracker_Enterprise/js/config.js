/* BancaTracker Enterprise v8 MVP - shared configuration */
(function (global) {
  const config = {
    TOTAL_BRANCHES: {
      "INDIAN BANK": 6022,
      "INDIAN OVERSEAS BANK": 3561,
      "KARNATAKA BANK LTD.": 977,
      "ODISHA GRAMEEN BANK": 1000,
      "TAMIL NADU GRAMA BANK": 674,
      OTHER: 75,
    },
    THRESHOLDS: {
      ACTIVE_BRANCH: 25000,
      NEAR_ACTIVE_MIN: 15000,
      NEAR_ACTIVE_MAX: 24999,
    },
    MANAGEMENT: { SMALL_ACTIVATION_GAP: 5000 },
    RENDER_LIMITS: {
      DATA_QUALITY_HIERARCHY: 100,
      DATA_QUALITY_IDENTITY: 100,
      DATA_QUALITY_DUPLICATES: 50,
      DATA_QUALITY_COVERAGE: 100,
      MANAGEMENT_EXCEPTIONS: 100,
    },
    FISCAL_MONTHS: [
      "Apr-26",
      "May-26",
      "Jun-26",
      "Jul-26",
      "Aug-26",
      "Sep-26",
      "Oct-26",
      "Nov-26",
      "Dec-26",
      "Jan-27",
      "Feb-27",
      "Mar-27",
    ],
    CSV_COLUMNS: {
      MANDATORY: [
        "USGI NET PREMIUM",
        "Month",
        "INTERMEDIARY",
        "BA NAME",
        "Ba Code",
        "LINE OF BUSINESS",
        "BRANCH NAME",
      ],
      OPTIONAL: [
        "Zone",
        "STATE",
        "SUM IMD CODE",
        "Business Type",
        "PRODUCT NAME",
        "PRODUCT CODE",
        "Day",
        "POLICY ISSUED DATE",
      ],
    },
    BANK_ALIASES: {
      "INDIAN BANK": "INDIAN BANK",
      "INDIAN OVERSEAS BANK": "INDIAN OVERSEAS BANK",
      IOB: "INDIAN OVERSEAS BANK",

      "KARNATAKA BANK": "KARNATAKA BANK LTD.",
      "KARNATAKA BANK LTD.": "KARNATAKA BANK LTD.",

      "ODISHA GRAMEEN BANK": "ODISHA GRAMEEN BANK",
      "ODISHA GRAMYA BANK": "ODISHA GRAMEEN BANK",

      "TAMIL NADU GRAMA BANK": "TAMIL NADU GRAMA BANK",
      OTHER: "OTHER",
    },
  };

  global.BancaTrackerConfig = Object.freeze(config);
})(window);
