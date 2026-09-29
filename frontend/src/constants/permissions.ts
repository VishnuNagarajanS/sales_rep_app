export const PERMISSIONS = {
  // Leads
  LEADS_VIEW: 'leads.view',
  LEADS_CREATE: 'leads.create',
  LEADS_UPDATE: 'leads.update',
  LEADS_DELETE: 'leads.delete',
  LEADS_ASSIGN: 'leads.assign',
  LEADS_EXPORT: 'leads.export',
  LEADS_IMPORT: 'leads.import',
  LEADS_CONVERT: 'leads.convert',

  // Customers
  CUSTOMERS_VIEW: 'customers.view',
  CUSTOMERS_CREATE: 'customers.create',
  CUSTOMERS_UPDATE: 'customers.update',
  CUSTOMERS_DELETE: 'customers.delete',

  // Deals
  DEALS_VIEW: 'deals.view',
  DEALS_CREATE: 'deals.create',
  DEALS_UPDATE: 'deals.update',
  DEALS_DELETE: 'deals.delete',

  // Calls
  CALLS_MAKE: 'calls.make',
  CALLS_RECEIVE: 'calls.receive',
  CALLS_VIEW: 'calls.view',
  CALLS_RECORDINGS_PLAY: 'calls.recordings.play',

  // Follow-ups
  FOLLOWUPS_VIEW: 'followups.view',
  FOLLOWUPS_CREATE: 'followups.create',
  FOLLOWUPS_UPDATE: 'followups.update',

  // Properties / Site Visits / Bookings (Jamin)
  PROPERTIES_VIEW: 'properties.view',
  PROPERTIES_UPDATE: 'properties.update',
  SITE_VISITS_VIEW: 'site_visits.view',
  SITE_VISITS_CREATE: 'site_visits.create',
  BOOKINGS_VIEW: 'bookings.view',
  BOOKINGS_CREATE: 'bookings.create',

  // Investors / Consultations (GHL)
  INVESTORS_VIEW: 'investors.view',
  INVESTORS_CREATE: 'investors.create',
  INVESTORS_EDIT: 'investors.edit',
  CONSULTATIONS_VIEW: 'consultations.view',
  CONSULTATIONS_CREATE: 'consultations.create',
  CONSULTATIONS_EDIT: 'consultations.edit',
  OPPORTUNITIES_VIEW: 'opportunities.view',
  OPPORTUNITIES_CREATE: 'opportunities.create',
  OPPORTUNITIES_EDIT: 'opportunities.edit',

  // Calling & Telephony aliases
  CALL_CENTER: 'calls.make',
  CALL_HISTORY: 'calls.view',
  CALL_SETTINGS: 'calls.view',

  // Reports
  REPORTS_VIEW: 'reports.view',
  REPORTS_EXPORT: 'reports.export',

  // Notifications
  NOTIFICATIONS_VIEW: 'notifications.view',

  // Admin & Settings
  USERS_VIEW: 'users.view',
  USERS_MANAGE: 'users.manage',
  ROLES_VIEW: 'roles.view',
  ROLES_MANAGE: 'roles.manage',
  SETTINGS_VIEW: 'settings.view',
  SETTINGS_UPDATE: 'settings.update',
  AUDIT_VIEW: 'audit.view',

  // Platform (Super Admin)
  PLATFORM_MANAGE_COMPANIES: 'platform.companies.manage',
  PLATFORM_MANAGE_PACKAGES: 'platform.packages.manage',
  PLATFORM_CALL_CONFIG: 'platform.call_config.manage',

  // Organizational & Routing Expansion
  DEPARTMENTS_VIEW: 'departments.view',
  DEPARTMENTS_MANAGE: 'departments.manage',
  TEAMS_VIEW: 'teams.view',
  TEAMS_MANAGE: 'teams.manage',
  QUEUES_VIEW: 'queues.view',
  QUEUES_MANAGE: 'queues.manage',
  ROUTING_VIEW: 'routing.view',
  ROUTING_MANAGE: 'routing.manage',
  CUSTOM_FIELDS_VIEW: 'custom_fields.view',
  CUSTOM_FIELDS_MANAGE: 'custom_fields.manage',
  PRODUCTS_VIEW: 'products.view',
  PRODUCTS_MANAGE: 'products.manage',
  PRESENCE_VIEW: 'presence.view',
  PRESENCE_UPDATE: 'presence.update',
  ASSIGNMENT_HISTORY_VIEW: 'assignment_history.view',
  ESCALATIONS_VIEW: 'escalations.view',
  ESCALATIONS_MANAGE: 'escalations.manage',

  // Chat & AI & Profile
  CHAT: 'chat.view',
  CHAT_VIEW: 'chat.view',
  CHAT_SEND: 'chat.send',
  SMARTY_AI: 'smarty_ai.view',
  PROFILE: 'profile.view',
} as const;

export type PermissionKey = typeof PERMISSIONS[keyof typeof PERMISSIONS];
