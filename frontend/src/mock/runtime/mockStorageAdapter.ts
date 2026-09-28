import { assertMockMode } from './mockModeGuard';
import { MOCK_STORAGE_KEYS } from '../shared/mockStorageKeys';
import { runMockBootstrap } from './mockBootstrap';
import {
  Tenant,
  User,
  Role,
  Lead,
  Customer,
  Deal,
  CallRecord,
  Followup,
  PropertyProject,
  Plot,
  SiteVisit,
  Booking,
  Investor,
  Consultation,
  InvestmentOpportunity,
  AuditLog,
  NotificationItem,
  CustomFieldDefinition,
  IrmProfile,
} from '../../types';
import { AdminKanbanCard } from '../../types/kanban';
import { MOCK_AGENTS } from '../calling/agentFixtures';
import { MOCK_IRMS } from '../calling/irmFixtures';

function getRaw<T>(key: string): T[] {
  assertMockMode(`mockStorageAdapter.getRaw(${key})`);
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      runMockBootstrap();
      const retry = localStorage.getItem(key);
      return retry ? JSON.parse(retry) : [];
    }
    return JSON.parse(raw);
  } catch (e) {
    console.error(`Failed to read mock storage for key ${key}:`, e);
    return [];
  }
}

function setRaw<T>(key: string, data: T[]): void {
  assertMockMode(`mockStorageAdapter.setRaw(${key})`);
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.error(`Failed to save mock storage for key ${key}:`, e);
  }
}

function filterByCompany<T extends { companyId?: string }>(items: T[], companyId?: string): T[] {
  if (!companyId) return items;
  return items.filter(item => {
    if (!item.companyId) return true;
    return (
      item.companyId === companyId ||
      item.companyId.includes(companyId) ||
      companyId.includes(item.companyId)
    );
  });
}

export const mockStorageAdapter = {
  // Tenants
  getTenants(): Tenant[] {
    return getRaw<Tenant>(MOCK_STORAGE_KEYS.TENANTS);
  },
  saveTenants(tenants: Tenant[]): void {
    setRaw(MOCK_STORAGE_KEYS.TENANTS, tenants);
  },

  // Roles
  getRoles(): Role[] {
    return getRaw<Role>(MOCK_STORAGE_KEYS.ROLES);
  },
  saveRoles(roles: Role[]): void {
    setRaw(MOCK_STORAGE_KEYS.ROLES, roles);
  },

  // Users
  getUsers(companyId?: string): User[] {
    const users = getRaw<User>(MOCK_STORAGE_KEYS.USERS);
    if (!companyId) return users;
    return users.filter(u => {
      if (!u.companyId) return true;
      return (
        u.companyId === companyId ||
        u.companyId.includes(companyId) ||
        companyId.includes(u.companyId)
      );
    });
  },
  saveUsers(users: User[]): void {
    setRaw(MOCK_STORAGE_KEYS.USERS, users);
  },

  // Leads
  getLeads(companyId?: string): Lead[] {
    return filterByCompany(getRaw<Lead>(MOCK_STORAGE_KEYS.LEADS), companyId);
  },
  saveLeads(leads: Lead[]): void {
    setRaw(MOCK_STORAGE_KEYS.LEADS, leads);
  },

  // Customers
  getCustomers(companyId?: string): Customer[] {
    return filterByCompany(getRaw<Customer>(MOCK_STORAGE_KEYS.CUSTOMERS), companyId);
  },
  saveCustomers(customers: Customer[]): void {
    setRaw(MOCK_STORAGE_KEYS.CUSTOMERS, customers);
  },

  // Deals
  getDeals(companyId?: string): Deal[] {
    return filterByCompany(getRaw<Deal>(MOCK_STORAGE_KEYS.DEALS), companyId);
  },
  saveDeals(deals: Deal[]): void {
    setRaw(MOCK_STORAGE_KEYS.DEALS, deals);
  },

  // Calls
  getCalls(companyId?: string): CallRecord[] {
    return filterByCompany(getRaw<CallRecord>(MOCK_STORAGE_KEYS.CALLS), companyId);
  },
  saveCalls(calls: CallRecord[]): void {
    setRaw(MOCK_STORAGE_KEYS.CALLS, calls);
  },

  // Followups
  getFollowups(companyId?: string): Followup[] {
    return filterByCompany(getRaw<Followup>(MOCK_STORAGE_KEYS.FOLLOWUPS), companyId);
  },
  saveFollowups(followups: Followup[]): void {
    setRaw(MOCK_STORAGE_KEYS.FOLLOWUPS, followups);
  },

  // Projects
  getProjects(companyId?: string): PropertyProject[] {
    const projects = getRaw<PropertyProject>(MOCK_STORAGE_KEYS.PROJECTS);
    if (!companyId) return projects;
    return projects.filter(p => !companyId || (p as any).companyId === companyId);
  },
  saveProjects(projects: PropertyProject[]): void {
    setRaw(MOCK_STORAGE_KEYS.PROJECTS, projects);
  },

  // Plots
  getPlots(projectId?: string): Plot[] {
    const plots = getRaw<Plot>(MOCK_STORAGE_KEYS.PLOTS);
    return projectId ? plots.filter(p => p.projectId === projectId) : plots;
  },
  savePlots(plots: Plot[]): void {
    setRaw(MOCK_STORAGE_KEYS.PLOTS, plots);
  },

  // Site Visits
  getSiteVisits(companyId?: string): SiteVisit[] {
    return filterByCompany(getRaw<SiteVisit>(MOCK_STORAGE_KEYS.SITE_VISITS), companyId);
  },
  saveSiteVisits(visits: SiteVisit[]): void {
    setRaw(MOCK_STORAGE_KEYS.SITE_VISITS, visits);
  },

  // Bookings
  getBookings(companyId?: string): Booking[] {
    return filterByCompany(getRaw<Booking>(MOCK_STORAGE_KEYS.BOOKINGS), companyId);
  },
  saveBookings(bookings: Booking[]): void {
    setRaw(MOCK_STORAGE_KEYS.BOOKINGS, bookings);
  },

  // Investors
  getInvestors(companyId?: string): Investor[] {
    return filterByCompany(getRaw<Investor>(MOCK_STORAGE_KEYS.INVESTORS), companyId);
  },
  saveInvestors(investors: Investor[]): void {
    setRaw(MOCK_STORAGE_KEYS.INVESTORS, investors);
  },

  // Consultations
  getConsultations(companyId?: string): Consultation[] {
    return filterByCompany(getRaw<Consultation>(MOCK_STORAGE_KEYS.CONSULTATIONS), companyId);
  },
  saveConsultations(consultations: Consultation[]): void {
    setRaw(MOCK_STORAGE_KEYS.CONSULTATIONS, consultations);
  },

  // Opportunities
  getOpportunities(companyId?: string): InvestmentOpportunity[] {
    return filterByCompany(getRaw<InvestmentOpportunity>(MOCK_STORAGE_KEYS.OPPORTUNITIES), companyId);
  },
  saveOpportunities(opps: InvestmentOpportunity[]): void {
    setRaw(MOCK_STORAGE_KEYS.OPPORTUNITIES, opps);
  },

  // Custom Fields
  getCustomFields(companyId?: string): CustomFieldDefinition[] {
    return filterByCompany(getRaw<CustomFieldDefinition>(MOCK_STORAGE_KEYS.CUSTOM_FIELDS), companyId);
  },
  saveCustomFields(fields: CustomFieldDefinition[]): void {
    setRaw(MOCK_STORAGE_KEYS.CUSTOM_FIELDS, fields);
  },

  // Audit Logs
  getAuditLogs(companyId?: string): AuditLog[] {
    return filterByCompany(getRaw<AuditLog>(MOCK_STORAGE_KEYS.AUDIT_LOGS), companyId);
  },
  saveAuditLogs(logs: AuditLog[]): void {
    setRaw(MOCK_STORAGE_KEYS.AUDIT_LOGS, logs);
  },

  // Notifications
  getNotifications(userId?: string): NotificationItem[] {
    const notifs = getRaw<NotificationItem>(MOCK_STORAGE_KEYS.NOTIFICATIONS);
    if (!userId) return notifs;
    return notifs.filter(n => n.targetUserId === userId || !n.targetUserId || n.targetUserId === 'all');
  },
  saveNotifications(notifs: NotificationItem[]): void {
    setRaw(MOCK_STORAGE_KEYS.NOTIFICATIONS, notifs);
  },

  // Kanban Cards
  getKanbanCards(): AdminKanbanCard[] {
    return getRaw<AdminKanbanCard>(MOCK_STORAGE_KEYS.ADMIN_KANBAN_CARDS);
  },
  saveKanbanCards(cards: AdminKanbanCard[]): void {
    setRaw(MOCK_STORAGE_KEYS.ADMIN_KANBAN_CARDS, cards);
  },

  // Mock Agents & IRMs
  getAgents(): Array<{ id: number | string; name: string }> {
    return MOCK_AGENTS;
  },
  getIrms(): IrmProfile[] {
    return MOCK_IRMS;
  },
};
