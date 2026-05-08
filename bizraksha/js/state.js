// state.js

const appState = {

  // --- Session / Context ---
  session: {
    startedAt: new Date().toISOString(),
    channel: "RM_ASSISTED",
    pricingVersion: null
  },

  // --- Customer & Loan ---
  customer: {
    id: null,
    name: null,
    rmId: null
  },

  loan: {
    loanId: null,
    amount: null,
    slab: null
  },

  // --- Business Snapshot ---
  business: {
    type: null,
    locations: null,
    hasStaff: false,
    hasCustomers: false,
    hasDigitalPayments: false
  },

  // --- Recommendation Output ---
  recommendations: {
    core: true,        // always true
    paysafe: false,
    trust: false,
    cyberlite: false
  },

  // --- Pricing ---
  pricing: {
    monthly: 0,
    annual: 0,
    breakdown: {}
  },

  // --- Consent ---
  consent: {
    given: false,
    timestamp: null
  }
};
