

export const API_CONFIG = {
  // Base configuration
  BASE_URL: import.meta.env.VITE_API_URL || 'http://localhost:5106',


  // All Platform Endpoints
  ENDPOINTS: {
    // 1. Authentication & Users
    AUTH: {
      LOGIN: '/auth/login',
      ME: '/auth/me',
      REFRESH: '/auth/refresh-token',
    },
    ADMIN_USERS: '/AdminUsers',

    // 2. Core CRM (Shared & Sales Executive)
    LEADS: '/leads',
    SALES_EXECUTIVE_LEADS: '/sales-executive/leads',
    SALES_EXECUTIVE_FOLLOWUPS: '/sales-executive/followups',
    SALES_EXECUTIVE_CUSTOMERS: '/sales-executive/customers',
    SALES_EXECUTIVE_CALLS: '/sales-executive/calls',
    SALES_EXECUTIVE_CONSULTATIONS: '/sales-executive/consultations',
    SALES_EXECUTIVE_REPORTS: '/sales-executive/reports',

    // 3. Jamin Bazaar (Land & Plotted Development)
    JAMIN: {
      PROJECTS: '/jamin/projects',
      PLOTS: '/jamin/plots',
      SITE_VISITS: '/jamin/site-visits',
      BOOKINGS: '/jamin/bookings',
      AGENTS: '/jamin/agents',
    },

    // 4. GHL India Ventures (Wealth & Real Estate Investment)
    GHL: {
      DEALS: '/ghl/deals',
      INVESTORS: '/ghl/investors',
      OPPORTUNITIES: '/ghl/investment-opportunities',
    },

    // 5. IRM (Investor Relationship Management)
    IRM: {
      PIPELINE: '/irm/pipeline',
      INVESTORS: '/irm/investors',
      CALLS: '/irm/calls',
      CONSULTATIONS: '/irm/consultations',
      KYC: '/irm/kyc',
    },

    AUDIT_LOGS: '/audit-logs',
  },
} as const;
