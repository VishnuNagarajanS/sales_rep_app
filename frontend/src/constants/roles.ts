import { Role } from '../types';

export const SYSTEM_ROLES: Record<string, Role> = {
  super_admin: {
    id: '1',
    name: 'Super Admin',
    code: 'super_admin',
    permissions: [
      'leads.view', 'leads.create', 'leads.update', 'leads.delete', 'leads.assign', 'leads.export', 'leads.import', 'leads.convert',
      'customers.view', 'customers.create', 'customers.update', 'customers.delete',
      'deals.view', 'deals.create', 'deals.update', 'deals.delete',
      'calls.make', 'calls.receive', 'calls.view', 'calls.recordings.play',
      'followups.view', 'followups.create', 'followups.update',
      'properties.view', 'properties.update', 'site_visits.view', 'site_visits.create', 'bookings.view', 'bookings.create',
      'investors.view', 'investors.create', 'investors.edit', 'consultations.view', 'consultations.create', 'consultations.edit', 'opportunities.view', 'opportunities.create', 'opportunities.edit',
      'reports.view', 'reports.export',
      'users.view', 'users.manage', 'roles.view', 'roles.manage', 'settings.view', 'settings.update', 'audit.view',
      'platform.companies.manage', 'platform.packages.manage', 'platform.call_config.manage'
    ]
  },
  company_admin: {
    id: '2',
    name: 'Company Admin',
    code: 'company_admin',
    permissions: [
      'leads.view', 'leads.create', 'leads.update', 'leads.delete', 'leads.assign', 'leads.export', 'leads.import', 'leads.convert',
      'customers.view', 'customers.create', 'customers.update', 'customers.delete',
      'deals.view', 'deals.create', 'deals.update', 'deals.delete',
      'calls.make', 'calls.receive', 'calls.view', 'calls.recordings.play',
      'followups.view', 'followups.create', 'followups.update',
      'properties.view', 'properties.update', 'site_visits.view', 'site_visits.create', 'bookings.view', 'bookings.create',
      'investors.view', 'investors.create', 'investors.edit', 'consultations.view', 'consultations.create', 'consultations.edit', 'opportunities.view', 'opportunities.create', 'opportunities.edit',
      'reports.view', 'reports.export',
      'users.view', 'users.manage', 'roles.view', 'settings.view', 'settings.update', 'audit.view'
    ]
  },
  sales_manager: {
    id: '3',
    name: 'Sales Manager',
    code: 'sales_manager',
    permissions: [
      'leads.view', 'leads.create', 'leads.update', 'leads.assign', 'leads.export', 'leads.convert',
      'customers.view', 'customers.create', 'customers.update',
      'deals.view', 'deals.create', 'deals.update',
      'calls.make', 'calls.receive', 'calls.view', 'calls.recordings.play',
      'followups.view', 'followups.create', 'followups.update',
      'properties.view', 'properties.update', 'site_visits.view', 'site_visits.create', 'bookings.view', 'bookings.create',
      'investors.view', 'investors.create', 'investors.edit', 'consultations.view', 'consultations.create', 'consultations.edit', 'opportunities.view', 'opportunities.create', 'opportunities.edit',
      'reports.view', 'reports.export', 'users.view'
    ]
  },
  sales_executive: {
    id: '4',
    name: 'Sales Executive',
    code: 'sales_executive',
    permissions: [
      'leads.view', 'leads.create', 'leads.update', 'leads.convert',
      'customers.view', 'customers.create', 'customers.update',
      'deals.view', 'deals.create', 'deals.update',
      'calls.make', 'calls.receive', 'calls.view',
      'followups.view', 'followups.create', 'followups.update',
      'properties.view', 'site_visits.view', 'site_visits.create', 'bookings.view', 'bookings.create',
      'investors.view', 'investors.create', 'consultations.view', 'consultations.create', 'opportunities.view', 'opportunities.create',
      'reports.view'
    ]
  },
  irm: {
    id: '5',
    name: 'IRM',
    code: 'irm',
    permissions: [
      'leads.view', 'leads.create', 'followups.view', 'followups.create', 'followups.update',
      'deals.view', 'deals.create', 'deals.update',
      'investors.view', 'investors.create', 'investors.edit', 'investors.update',
      'consultations.view', 'consultations.create', 'consultations.edit', 'consultations.update',
      'opportunities.view', 'opportunities.create', 'opportunities.edit', 'opportunities.update',
      'calls.make', 'calls.receive', 'calls.view'
    ]
  }
};
