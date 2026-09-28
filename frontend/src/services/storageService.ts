import {
  Lead,
  Customer,
  Deal,
  DealActivity,
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
  User,
  Tenant,
  Role,
  DocumentItem,
  Department,
  Team,
  Queue,
  RoutingRule,
  LeadAssignment,
  AgentPresence,
  RoutingAttempt,
  CustomFieldDefinition,
  ProductService,
  IrmProfile,
  AdminKanbanCard,
} from '../types';
import { isMockMode } from '../config/environment';

export interface MockStorageAdapter {
  getTenants: () => Tenant[];
  saveTenants: (tenants: Tenant[]) => void;
  getRoles: () => Role[];
  saveRoles: (roles: Role[]) => void;
  getUsers: (tenantId?: string) => User[];
  saveUsers: (users: User[]) => void;
  getLeads: (companyId?: string) => Lead[];
  saveLeads: (leads: Lead[]) => void;
  getCustomers: (companyId?: string) => Customer[];
  saveCustomers: (customers: Customer[]) => void;
  getDeals: (companyId?: string) => Deal[];
  saveDeals: (deals: Deal[]) => void;
  getCalls: (companyId?: string) => CallRecord[];
  saveCalls: (calls: CallRecord[]) => void;
  getFollowups: (companyId?: string) => Followup[];
  saveFollowups: (followups: Followup[]) => void;
  getProjects: (companyId?: string) => PropertyProject[];
  saveProjects: (projects: PropertyProject[]) => void;
  getPlots: () => Plot[];
  savePlots: (plots: Plot[]) => void;
  getSiteVisits: (companyId?: string) => SiteVisit[];
  saveSiteVisits: (visits: SiteVisit[]) => void;
  getBookings: (companyId?: string) => Booking[];
  saveBookings: (bookings: Booking[]) => void;
  getInvestors: (companyId?: string) => Investor[];
  saveInvestors: (investors: Investor[]) => void;
  getConsultations: (companyId?: string) => Consultation[];
  saveConsultations: (consultations: Consultation[]) => void;
  getOpportunities: (companyId?: string) => InvestmentOpportunity[];
  saveOpportunities: (opps: InvestmentOpportunity[]) => void;
  getAuditLogs: (companyId?: string) => AuditLog[];
  saveAuditLogs: (logs: AuditLog[]) => void;
  getNotifications: (userId?: string) => NotificationItem[];
  saveNotifications: (notifs: NotificationItem[]) => void;
  getKanbanCards: () => AdminKanbanCard[];
  saveKanbanCards: (cards: AdminKanbanCard[]) => void;
  getAgents: () => Array<{ id: number | string; name: string }>;
  getIrms: () => IrmProfile[];
  getCustomFields: (companyId?: string) => CustomFieldDefinition[];
  saveCustomFields: (definitions: CustomFieldDefinition[]) => void;
}

const defaultMockStorageAdapter: MockStorageAdapter = {
  getTenants: (): Tenant[] => [],
  saveTenants: () => {},
  getRoles: (): Role[] => [],
  saveRoles: () => {},
  getUsers: (): User[] => [],
  saveUsers: () => {},
  getLeads: (): Lead[] => [],
  saveLeads: () => {},
  getCustomers: (): Customer[] => [],
  saveCustomers: () => {},
  getDeals: (): Deal[] => [],
  saveDeals: () => {},
  getCalls: (): CallRecord[] => [],
  saveCalls: () => {},
  getFollowups: (): Followup[] => [],
  saveFollowups: () => {},
  getProjects: (): PropertyProject[] => [],
  saveProjects: () => {},
  getPlots: (): Plot[] => [],
  savePlots: () => {},
  getSiteVisits: (): SiteVisit[] => [],
  saveSiteVisits: () => {},
  getBookings: (): Booking[] => [],
  saveBookings: () => {},
  getInvestors: (): Investor[] => [],
  saveInvestors: () => {},
  getConsultations: (): Consultation[] => [],
  saveConsultations: () => {},
  getOpportunities: (): InvestmentOpportunity[] => [],
  saveOpportunities: () => {},
  getAuditLogs: (): AuditLog[] => [],
  saveAuditLogs: () => {},
  getNotifications: (): NotificationItem[] => [],
  saveNotifications: () => {},
  getKanbanCards: (): AdminKanbanCard[] => [],
  saveKanbanCards: () => {},
  getAgents: (): Array<{ id: number | string; name: string }> => [],
  getIrms: (): IrmProfile[] => [],
  getCustomFields: (): CustomFieldDefinition[] => [],
  saveCustomFields: () => {},
};

let mockStorageAdapter: MockStorageAdapter = defaultMockStorageAdapter;

export function registerMockStorageAdapter(adapter: MockStorageAdapter): void {
  if (adapter) {
    mockStorageAdapter = adapter;
  }
}

let mockBootstrapRunner: ((force?: boolean) => void) | null = null;

export function registerMockBootstrapRunner(runner: (force?: boolean) => void): void {
  mockBootstrapRunner = runner;
}

export type PopupPosition = 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';

class StorageService {
  private devPrefix = 'nexus_dev_';

  constructor() {
    if (isMockMode()) {
      this.runLeadsDedupMigration();
    }
  }

  private runLeadsDedupMigration(): void {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return;
      const MIGRATION_KEY = 'nexus_leads_deduped_v1';
      if (localStorage.getItem(MIGRATION_KEY)) return;
      this.cleanupDuplicateLeads();
      localStorage.setItem(MIGRATION_KEY, 'true');
    } catch (e) {
      console.error('Error in runLeadsDedupMigration:', e);
    }
  }

  private getDev<T>(key: string, fallback: T): T {
    try {
      const data = localStorage.getItem(`${this.devPrefix}${key}`);
      return data ? JSON.parse(data) : fallback;
    } catch {
      return fallback;
    }
  }

  private setDev<T>(key: string, value: T): void {
    try {
      localStorage.setItem(`${this.devPrefix}${key}`, JSON.stringify(value));
      window.dispatchEvent(new Event('nexus_storage_updated'));
    } catch (e) {
      console.error('Failed to save to dev localStorage', e);
    }
  }

  // ── Tenants ─────────────────────────────────────────────────────────────────
  getTenants(): Tenant[] {
    if (isMockMode()) {
      return mockStorageAdapter.getTenants();
    }
    return this.getDev<Tenant[]>('tenants', []);
  }

  saveTenant(tenant: Tenant): void {
    if (isMockMode()) {
      const tenants = mockStorageAdapter.getTenants();
      const index = tenants.findIndex(t => t.id === tenant.id);
      if (index >= 0) tenants[index] = tenant;
      else tenants.push(tenant);
      mockStorageAdapter.saveTenants(tenants);
      window.dispatchEvent(new Event('nexus_storage_updated'));
      return;
    }
    const tenants = this.getTenants();
    const index = tenants.findIndex(t => t.id === tenant.id);
    if (index >= 0) tenants[index] = tenant;
    else tenants.push(tenant);
    this.setDev('tenants', tenants);
  }

  // ── Roles ───────────────────────────────────────────────────────────────────
  getRoles(): Role[] {
    if (isMockMode()) {
      return mockStorageAdapter.getRoles();
    }
    return this.getDev<Role[]>('roles', []);
  }

  saveRoles(roles: Role[]): void {
    if (isMockMode()) {
      mockStorageAdapter.saveRoles(roles);
      window.dispatchEvent(new Event('nexus_storage_updated'));
      return;
    }
    this.setDev('roles', roles);
  }

  // ── Users ───────────────────────────────────────────────────────────────────
  getUsers(companySlug?: string): User[] {
    if (isMockMode()) {
      const users = mockStorageAdapter.getUsers();
      return companySlug ? users.filter(u => u.companySlug === companySlug) : users;
    }
    const users = this.getDev<User[]>('users', []);
    return companySlug ? users.filter(u => u.companySlug === companySlug) : users;
  }

  saveUser(user: User): void {
    if (isMockMode()) {
      const users = mockStorageAdapter.getUsers();
      const index = users.findIndex(u => u.id === user.id);
      if (index >= 0) users[index] = user;
      else users.push(user);
      mockStorageAdapter.saveUsers(users);
      window.dispatchEvent(new Event('nexus_storage_updated'));
      return;
    }
    const users = this.getUsers();
    const index = users.findIndex(u => u.id === user.id);
    if (index >= 0) users[index] = user;
    else users.push(user);
    this.setDev('users', users);
  }

  deleteUser(id: string): void {
    if (isMockMode()) {
      const users = mockStorageAdapter.getUsers().filter(u => u.id !== id);
      mockStorageAdapter.saveUsers(users);
      window.dispatchEvent(new Event('nexus_storage_updated'));
      return;
    }
    const users = this.getUsers().filter(u => u.id !== id);
    this.setDev('users', users);
  }

  // ── Leads ───────────────────────────────────────────────────────────────────
  getLeads(companyId?: string): Lead[] {
    if (isMockMode()) {
      return mockStorageAdapter.getLeads(companyId);
    }
    const leads = this.getDev<Lead[]>('leads', []);
    return companyId ? leads.filter(l => l.companyId === companyId) : leads;
  }

  findLeadByPhone(phone: string, companyId?: string): Lead | undefined {
    if (!phone) return undefined;
    const digits = phone.replace(/\D/g, '').slice(-10);
    if (!digits) return undefined;
    const leads = this.getLeads(companyId);
    return leads.find(l => {
      const lDigits = (l.phone || '').replace(/\D/g, '').slice(-10);
      return Boolean(lDigits && lDigits === digits);
    });
  }

  saveLead(lead: Lead): void {
    if (isMockMode()) {
      const leads = mockStorageAdapter.getLeads();
      const index = leads.findIndex(l => l.id === lead.id);
      if (index >= 0) leads[index] = lead;
      else leads.unshift(lead);
      mockStorageAdapter.saveLeads(leads);
      window.dispatchEvent(new Event('nexus_storage_updated'));
      return;
    }
    const leads = this.getLeads();
    const index = leads.findIndex(l => l.id === lead.id);
    if (index >= 0) leads[index] = lead;
    else leads.unshift(lead);
    this.setDev('leads', leads);
  }

  deleteLead(id: string): void {
    if (isMockMode()) {
      const leads = mockStorageAdapter.getLeads().filter(l => l.id !== id);
      mockStorageAdapter.saveLeads(leads);
      window.dispatchEvent(new Event('nexus_storage_updated'));
      return;
    }
    const leads = this.getLeads().filter(l => l.id !== id);
    this.setDev('leads', leads);
  }

  cleanupDuplicateLeads(companyId?: string): { removedCount: number } {
    try {
      const allLeads = this.getLeads();
      if (!allLeads.length) return { removedCount: 0 };

      const leadsToProcess = companyId
        ? allLeads.filter(l => !l.companyId || l.companyId === companyId)
        : allLeads;
      const otherCompanyLeads = companyId
        ? allLeads.filter(l => l.companyId && l.companyId !== companyId)
        : [];

      const groups = new Map<string, Lead[]>();
      const ungrouped: Lead[] = [];

      for (const lead of leadsToProcess) {
        const digits = (lead.phone || '').replace(/\D/g, '').slice(-10);
        if (digits) {
          if (!groups.has(digits)) groups.set(digits, []);
          groups.get(digits)!.push(lead);
        } else {
          ungrouped.push(lead);
        }
      }

      let removedCount = 0;
      const deduplicated: Lead[] = [];

      groups.forEach(groupLeads => {
        if (groupLeads.length === 1) {
          deduplicated.push(groupLeads[0]);
          return;
        }

        removedCount += groupLeads.length - 1;

        groupLeads.sort((a, b) => {
          const getRecency = (l: Lead) => {
            const tUp = Date.parse((l as { updatedAt?: string }).updatedAt || '') || 0;
            const tCr = Date.parse(l.createdAt || '') || 0;
            const tCall = Date.parse(l.lastCallAt || l.lastContactedAt || '') || 0;
            const match = (l.id || '').match(/(\d{10,})/);
            const idTime = match ? parseInt(match[1], 10) : 0;
            return Math.max(tUp, tCr, tCall, idTime);
          };
          return getRecency(b) - getRecency(a);
        });

        const winner = { ...groupLeads[0] };
        for (let i = 1; i < groupLeads.length; i++) {
          const other = groupLeads[i];
          if (!winner.companyId && other.companyId) winner.companyId = other.companyId;
          if (!winner.email && other.email) winner.email = other.email;
          if (!winner.location && other.location) winner.location = other.location;
          if (other.notes && !winner.notes.includes(other.notes)) {
            winner.notes = winner.notes ? `${winner.notes} | ${other.notes}` : other.notes;
          }
          if (other.customFields) {
            winner.customFields = { ...other.customFields, ...(winner.customFields || {}) };
          }
        }
        deduplicated.push(winner);
      });

      const finalLeads = [...otherCompanyLeads, ...deduplicated, ...ungrouped];
      if (removedCount > 0) {
        if (isMockMode()) {
          mockStorageAdapter.saveLeads(finalLeads);
        } else {
          this.setDev('leads', finalLeads);
        }
      }
      return { removedCount };
    } catch (e) {
      console.error('Error in cleanupDuplicateLeads:', e);
      return { removedCount: 0 };
    }
  }

  // ── Customers ───────────────────────────────────────────────────────────────
  getCustomers(companyId?: string): Customer[] {
    if (isMockMode()) {
      return mockStorageAdapter.getCustomers(companyId);
    }
    const customers = this.getDev<Customer[]>('customers', []);
    return companyId ? customers.filter(c => c.companyId === companyId) : customers;
  }

  saveCustomer(customer: Customer): void {
    if (isMockMode()) {
      const customers = mockStorageAdapter.getCustomers();
      const index = customers.findIndex(c => c.id === customer.id);
      if (index >= 0) customers[index] = customer;
      else customers.unshift(customer);
      mockStorageAdapter.saveCustomers(customers);
      window.dispatchEvent(new Event('nexus_storage_updated'));
      return;
    }
    const customers = this.getCustomers();
    const index = customers.findIndex(c => c.id === customer.id);
    if (index >= 0) customers[index] = customer;
    else customers.unshift(customer);
    this.setDev('customers', customers);
  }

  // ── Deals ───────────────────────────────────────────────────────────────────
  getDeals(companyId?: string): Deal[] {
    if (isMockMode()) {
      return mockStorageAdapter.getDeals(companyId);
    }
    const deals = this.getDev<Deal[]>('deals', []);
    return companyId ? deals.filter(d => d.companyId === companyId) : deals;
  }

  saveDeal(deal: Deal): void {
    if (isMockMode()) {
      const deals = mockStorageAdapter.getDeals();
      const index = deals.findIndex(d => d.id === deal.id);
      if (index >= 0) deals[index] = deal;
      else deals.unshift(deal);
      mockStorageAdapter.saveDeals(deals);
      window.dispatchEvent(new Event('nexus_storage_updated'));
      return;
    }
    const deals = this.getDeals();
    const index = deals.findIndex(d => d.id === deal.id);
    if (index >= 0) deals[index] = deal;
    else deals.unshift(deal);
    this.setDev('deals', deals);
  }

  // ── Deal Activities ─────────────────────────────────────────────────────────
  getDealActivities(dealId: string, companyId?: string): DealActivity[] {
    const key = isMockMode() ? 'nexus_mock_deal_activities' : `${this.devPrefix}deal_activities`;
    try {
      const raw = localStorage.getItem(key);
      const activities: DealActivity[] = raw ? JSON.parse(raw) : [];
      return activities.filter(a => a.dealId === dealId && (!companyId || a.companyId === companyId));
    } catch {
      return [];
    }
  }

  addDealActivity(activity: DealActivity): void {
    const key = isMockMode() ? 'nexus_mock_deal_activities' : `${this.devPrefix}deal_activities`;
    try {
      const raw = localStorage.getItem(key);
      const activities: DealActivity[] = raw ? JSON.parse(raw) : [];
      activities.unshift(activity);
      localStorage.setItem(key, JSON.stringify(activities));
      window.dispatchEvent(new Event('nexus_storage_updated'));
    } catch (e) {
      console.error('Failed to add deal activity:', e);
    }
  }

  // ── Calls ───────────────────────────────────────────────────────────────────
  getCalls(companyId?: string): CallRecord[] {
    if (isMockMode()) {
      return mockStorageAdapter.getCalls(companyId);
    }
    const calls = this.getDev<CallRecord[]>('calls', []);
    return companyId ? calls.filter(c => c.companyId === companyId) : calls;
  }

  addCall(call: CallRecord): void {
    if (isMockMode()) {
      const calls = mockStorageAdapter.getCalls();
      calls.unshift(call);
      mockStorageAdapter.saveCalls(calls);
      window.dispatchEvent(new Event('nexus_storage_updated'));
      return;
    }
    const calls = this.getCalls();
    calls.unshift(call);
    this.setDev('calls', calls);
  }

  // ── Follow-ups ──────────────────────────────────────────────────────────────
  getFollowups(companyId?: string): Followup[] {
    if (isMockMode()) {
      return mockStorageAdapter.getFollowups(companyId);
    }
    const followups = this.getDev<Followup[]>('followups', []);
    return companyId ? followups.filter(f => f.companyId === companyId) : followups;
  }

  cleanupGhlPendingFollowups(companyId?: string): void {
    try {
      const allFollowups = this.getFollowups();
      if (!allFollowups.length) return;

      const targetCompanyId = companyId || 't-ghl-01';
      const allLeads = this.getLeads(targetCompanyId);
      const niJunkLeadIds = new Set<string>(
        allLeads.filter(l => l.status === 'Not Interested' || l.status === 'Junk').map(l => l.id)
      );
      const niJunkPhones = new Set<string>(
        allLeads
          .filter(l => l.status === 'Not Interested' || l.status === 'Junk')
          .map(l => (l.phone || '').replace(/\D/g, '').slice(-10))
          .filter(Boolean)
      );

      const ghlPending = allFollowups.filter(f => f.companyId === targetCompanyId && f.status === 'Pending');
      if (!ghlPending.length) return;

      const nonPendingOrOtherCompany = allFollowups.filter(f => f.companyId !== targetCompanyId || f.status !== 'Pending');
      const seenContacts = new Map<string, Followup>();
      const keepPending: Followup[] = [];

      for (const item of ghlPending) {
        if (item.contactId && item.contactId !== 'contact-new' && niJunkLeadIds.has(item.contactId)) {
          continue;
        }
        const phoneDigits = (item.contactPhone || '').replace(/\D/g, '').slice(-10);
        if (phoneDigits && niJunkPhones.has(phoneDigits)) {
          continue;
        }

        const contactKey = (item.contactId && item.contactId !== 'contact-new')
          ? `id:${item.contactId}`
          : phoneDigits ? `phone:${phoneDigits}` : `raw:${item.id}`;

        if (seenContacts.has(contactKey)) {
          const existing = seenContacts.get(contactKey)!;
          if (item.notes && !existing.notes.includes(item.notes)) {
            existing.notes = `${existing.notes} | ${item.notes}`;
          }
        } else {
          const itemCopy = { ...item };
          seenContacts.set(contactKey, itemCopy);
          keepPending.push(itemCopy);
        }
      }

      const finalFollowups = [...nonPendingOrOtherCompany, ...keepPending];
      if (isMockMode()) {
        mockStorageAdapter.saveFollowups(finalFollowups);
      } else {
        this.setDev('followups', finalFollowups);
      }
    } catch (e) {
      console.error('Error in cleanupGhlPendingFollowups:', e);
    }
  }

  saveFollowup(followup: Followup): void {
    if (isMockMode()) {
      const followups = mockStorageAdapter.getFollowups();
      const index = followups.findIndex(f => f.id === followup.id);
      if (index >= 0) followups[index] = followup;
      else followups.unshift(followup);
      mockStorageAdapter.saveFollowups(followups);
      window.dispatchEvent(new Event('nexus_storage_updated'));
      return;
    }
    const followups = this.getFollowups();
    const index = followups.findIndex(f => f.id === followup.id);
    if (index >= 0) followups[index] = followup;
    else followups.unshift(followup);
    this.setDev('followups', followups);
  }

  deleteFollowup(id: string): void {
    if (isMockMode()) {
      const followups = mockStorageAdapter.getFollowups().filter(f => f.id !== id);
      mockStorageAdapter.saveFollowups(followups);
      window.dispatchEvent(new Event('nexus_storage_updated'));
      return;
    }
    const followups = this.getFollowups().filter(f => f.id !== id);
    this.setDev('followups', followups);
  }

  purgeFollowupsForContact(companyId: string, contactId?: string | null, contactPhone?: string | null): void {
    try {
      const allFollowups = this.getFollowups();
      const targetPhoneDigits = (contactPhone || '').replace(/\D/g, '').slice(-10);

      const remaining = allFollowups.filter(f => {
        if (f.companyId !== companyId || f.status !== 'Pending') return true;
        if (contactId && contactId !== 'contact-new' && f.contactId === contactId) return false;
        const fPhone = (f.contactPhone || '').replace(/\D/g, '').slice(-10);
        if (fPhone && targetPhoneDigits && fPhone === targetPhoneDigits) return false;
        return true;
      });

      if (isMockMode()) {
        mockStorageAdapter.saveFollowups(remaining);
      } else {
        this.setDev('followups', remaining);
      }
    } catch (e) {
      console.error('Error in purgeFollowupsForContact:', e);
    }
  }

  // ── Projects & Plots ────────────────────────────────────────────────────────
  getProjects(companyId?: string): PropertyProject[] {
    if (isMockMode()) {
      return mockStorageAdapter.getProjects(companyId);
    }
    const projects = this.getDev<PropertyProject[]>('projects', []);
    return companyId ? projects.filter(p => !companyId || (p as any).companyId === companyId) : projects;
  }

  saveProject(project: PropertyProject): void {
    if (isMockMode()) {
      const projects = mockStorageAdapter.getProjects();
      const index = projects.findIndex(p => p.id === project.id);
      if (index >= 0) projects[index] = project;
      else projects.push(project);
      mockStorageAdapter.saveProjects(projects);
      window.dispatchEvent(new Event('nexus_storage_updated'));
      return;
    }
    const projects = this.getProjects();
    const index = projects.findIndex(p => p.id === project.id);
    if (index >= 0) projects[index] = project;
    else projects.push(project);
    this.setDev('projects', projects);
  }

  getPlots(projectId?: string): Plot[] {
    if (isMockMode()) {
      const plots = mockStorageAdapter.getPlots();
      return projectId ? plots.filter(p => p.projectId === projectId) : plots;
    }
    const plots = this.getDev<Plot[]>('plots', []);
    return projectId ? plots.filter(p => p.projectId === projectId) : plots;
  }

  savePlot(plot: Plot): void {
    if (isMockMode()) {
      const plots = mockStorageAdapter.getPlots();
      const index = plots.findIndex(p => p.id === plot.id);
      if (index >= 0) plots[index] = plot;
      else plots.push(plot);
      mockStorageAdapter.savePlots(plots);
      window.dispatchEvent(new Event('nexus_storage_updated'));
      return;
    }
    const plots = this.getPlots();
    const index = plots.findIndex(p => p.id === plot.id);
    if (index >= 0) plots[index] = plot;
    else plots.push(plot);
    this.setDev('plots', plots);
  }

  // ── Site Visits ─────────────────────────────────────────────────────────────
  getSiteVisits(companyId?: string): SiteVisit[] {
    if (isMockMode()) {
      return mockStorageAdapter.getSiteVisits(companyId);
    }
    const visits = this.getDev<SiteVisit[]>('site_visits', []);
    return companyId ? visits.filter(v => v.companyId === companyId) : visits;
  }

  saveSiteVisit(visit: SiteVisit): void {
    if (isMockMode()) {
      const visits = mockStorageAdapter.getSiteVisits();
      const index = visits.findIndex(v => v.id === visit.id);
      if (index >= 0) visits[index] = visit;
      else visits.unshift(visit);
      mockStorageAdapter.saveSiteVisits(visits);
      window.dispatchEvent(new Event('nexus_storage_updated'));
      return;
    }
    const visits = this.getSiteVisits();
    const index = visits.findIndex(v => v.id === visit.id);
    if (index >= 0) visits[index] = visit;
    else visits.unshift(visit);
    this.setDev('site_visits', visits);
  }

  // ── Bookings ────────────────────────────────────────────────────────────────
  getBookings(companyId?: string): Booking[] {
    if (isMockMode()) {
      return mockStorageAdapter.getBookings(companyId);
    }
    const bookings = this.getDev<Booking[]>('bookings', []);
    return companyId ? bookings.filter(b => b.companyId === companyId) : bookings;
  }

  saveBooking(booking: Booking): void {
    if (isMockMode()) {
      const bookings = mockStorageAdapter.getBookings();
      const index = bookings.findIndex(b => b.id === booking.id);
      if (index >= 0) bookings[index] = booking;
      else bookings.unshift(booking);
      mockStorageAdapter.saveBookings(bookings);
      window.dispatchEvent(new Event('nexus_storage_updated'));
      return;
    }
    const bookings = this.getBookings();
    const index = bookings.findIndex(b => b.id === booking.id);
    if (index >= 0) bookings[index] = booking;
    else bookings.unshift(booking);
    this.setDev('bookings', bookings);
  }

  // ── Investors ───────────────────────────────────────────────────────────────
  getInvestors(companyId?: string): Investor[] {
    if (isMockMode()) {
      return mockStorageAdapter.getInvestors(companyId);
    }
    const investors = this.getDev<Investor[]>('investors', []);
    return companyId ? investors.filter(i => i.companyId === companyId) : investors;
  }

  saveInvestor(investor: Investor): void {
    if (isMockMode()) {
      const investors = mockStorageAdapter.getInvestors();
      const index = investors.findIndex(i => i.id === investor.id);
      if (index >= 0) investors[index] = investor;
      else investors.unshift(investor);
      mockStorageAdapter.saveInvestors(investors);
      window.dispatchEvent(new Event('nexus_storage_updated'));
      return;
    }
    const investors = this.getInvestors();
    const index = investors.findIndex(i => i.id === investor.id);
    if (index >= 0) investors[index] = investor;
    else investors.unshift(investor);
    this.setDev('investors', investors);
  }

  deleteInvestor(id: string): void {
    if (isMockMode()) {
      const investors = mockStorageAdapter.getInvestors().filter(i => i.id !== id);
      mockStorageAdapter.saveInvestors(investors);
      window.dispatchEvent(new Event('nexus_storage_updated'));
      return;
    }
    const investors = this.getInvestors().filter(i => i.id !== id);
    this.setDev('investors', investors);
  }

  // ── Consultations ───────────────────────────────────────────────────────────
  getConsultations(companyId?: string): Consultation[] {
    if (isMockMode()) {
      return mockStorageAdapter.getConsultations(companyId);
    }
    const consultations = this.getDev<Consultation[]>('consultations', []);
    return companyId ? consultations.filter(c => c.companyId === companyId) : consultations;
  }

  saveConsultation(consultation: Consultation): void {
    if (isMockMode()) {
      const consultations = mockStorageAdapter.getConsultations();
      const index = consultations.findIndex(c => c.id === consultation.id);
      if (index >= 0) consultations[index] = consultation;
      else consultations.unshift(consultation);
      mockStorageAdapter.saveConsultations(consultations);
      window.dispatchEvent(new Event('nexus_storage_updated'));
      return;
    }
    const consultations = this.getConsultations();
    const index = consultations.findIndex(c => c.id === consultation.id);
    if (index >= 0) consultations[index] = consultation;
    else consultations.unshift(consultation);
    this.setDev('consultations', consultations);
  }

  deleteConsultation(id: string): void {
    if (isMockMode()) {
      const consultations = mockStorageAdapter.getConsultations().filter(c => c.id !== id);
      mockStorageAdapter.saveConsultations(consultations);
      window.dispatchEvent(new Event('nexus_storage_updated'));
      return;
    }
    const consultations = this.getConsultations().filter(c => c.id !== id);
    this.setDev('consultations', consultations);
  }

  // ── Opportunities ───────────────────────────────────────────────────────────
  getOpportunities(companyId?: string): InvestmentOpportunity[] {
    if (isMockMode()) {
      return mockStorageAdapter.getOpportunities(companyId);
    }
    const opps = this.getDev<InvestmentOpportunity[]>('opportunities', []);
    return companyId ? opps.filter(o => o.companyId === companyId) : opps;
  }

  saveOpportunity(opportunity: InvestmentOpportunity): void {
    if (isMockMode()) {
      const opps = mockStorageAdapter.getOpportunities();
      const index = opps.findIndex(o => o.id === opportunity.id);
      if (index >= 0) opps[index] = opportunity;
      else opps.unshift(opportunity);
      mockStorageAdapter.saveOpportunities(opps);
      window.dispatchEvent(new Event('nexus_storage_updated'));
      return;
    }
    const opps = this.getOpportunities();
    const index = opps.findIndex(o => o.id === opportunity.id);
    if (index >= 0) opps[index] = opportunity;
    else opps.unshift(opportunity);
    this.setDev('opportunities', opps);
  }

  deleteOpportunity(id: string): void {
    if (isMockMode()) {
      const opps = mockStorageAdapter.getOpportunities().filter(o => o.id !== id);
      mockStorageAdapter.saveOpportunities(opps);
      window.dispatchEvent(new Event('nexus_storage_updated'));
      return;
    }
    const opps = this.getOpportunities().filter(o => o.id !== id);
    this.setDev('opportunities', opps);
  }

  // ── Audit Logs ──────────────────────────────────────────────────────────────
  getAuditLogs(companyId?: string): AuditLog[] {
    if (isMockMode()) {
      return mockStorageAdapter.getAuditLogs(companyId);
    }
    const logs = this.getDev<AuditLog[]>('audit_logs', []);
    return companyId ? logs.filter(l => !l.companyId || l.companyId === companyId) : logs;
  }

  addAuditLog(log: AuditLog): void {
    if (isMockMode()) {
      const logs = mockStorageAdapter.getAuditLogs();
      logs.unshift(log);
      mockStorageAdapter.saveAuditLogs(logs);
      window.dispatchEvent(new Event('nexus_storage_updated'));
      return;
    }
    const logs = this.getAuditLogs();
    logs.unshift(log);
    this.setDev('audit_logs', logs);
  }

  // ── Notifications ───────────────────────────────────────────────────────────
  getNotifications(companyId?: string, userId?: string, userRoleCode?: string): NotificationItem[] {
    const raw: NotificationItem[] = isMockMode()
      ? mockStorageAdapter.getNotifications()
      : this.getDev<NotificationItem[]>('notifications', []);

    if (!companyId) return raw;

    const targetCompanyId = companyId.toLowerCase();
    const isGhlTarget = targetCompanyId === 't-ghl-01' || targetCompanyId === 'ghl';
    const isJaminTarget = targetCompanyId === 't-jamin-02' || targetCompanyId === 'jamin';

    const tenantScoped = raw.filter(n => {
      const nCompId = (n.companyId || '').toLowerCase();
      const nSlug = (n.companySlug || '').toLowerCase();

      if (isGhlTarget) return nCompId === 't-ghl-01' || nSlug === 'ghl';
      if (isJaminTarget) return nCompId === 't-jamin-02' || nSlug === 'jamin';
      return nCompId === targetCompanyId || nSlug === targetCompanyId;
    });

    if (!userId) return tenantScoped;

    return tenantScoped.filter(n => {
      if (!n.targetUserId || n.targetUserId === 'all') {
        if (n.targetRole && n.targetRole !== 'all') {
          return (
            userRoleCode === n.targetRole ||
            userRoleCode === 'company_admin' ||
            (userRoleCode as string) === 'admin' ||
            userRoleCode === 'super_admin'
          );
        }
        return true;
      }
      if (n.targetUserId === userId) return true;
      if (n.createdById === userId) return true;
      return false;
    });
  }

  createNotification(notification: NotificationItem): void {
    if (isMockMode()) {
      const raw = mockStorageAdapter.getNotifications();
      mockStorageAdapter.saveNotifications([notification, ...raw]);
      window.dispatchEvent(new Event('nexus_storage_updated'));
      return;
    }
    const raw = this.getDev<NotificationItem[]>('notifications', []);
    this.setDev('notifications', [notification, ...raw]);
  }

  markNotificationRead(id: string): void {
    if (isMockMode()) {
      const raw = mockStorageAdapter.getNotifications();
      const found = raw.find(n => n.id === id);
      if (found) {
        found.read = true;
        mockStorageAdapter.saveNotifications(raw);
        window.dispatchEvent(new Event('nexus_storage_updated'));
      }
      return;
    }
    const raw = this.getDev<NotificationItem[]>('notifications', []);
    const found = raw.find(n => n.id === id);
    if (found) {
      found.read = true;
      this.setDev('notifications', raw);
    }
  }

  markAllNotificationsRead(companyId?: string, userId?: string): void {
    const raw = isMockMode() ? mockStorageAdapter.getNotifications() : this.getDev<NotificationItem[]>('notifications', []);
    const targetCompanyId = (companyId || '').toLowerCase();
    const isGhlTarget = targetCompanyId === 't-ghl-01' || targetCompanyId === 'ghl';
    const isJaminTarget = targetCompanyId === 't-jamin-02' || targetCompanyId === 'jamin';

    const updated = raw.map(n => {
      if (companyId) {
        const nCompId = (n.companyId || '').toLowerCase();
        const nSlug = (n.companySlug || '').toLowerCase();
        let companyMatches = false;
        if (isGhlTarget) companyMatches = nCompId === 't-ghl-01' || nSlug === 'ghl';
        else if (isJaminTarget) companyMatches = nCompId === 't-jamin-02' || nSlug === 'jamin';
        else companyMatches = nCompId === targetCompanyId || nSlug === targetCompanyId;

        if (!companyMatches) return n;
      }

      if (userId && n.targetUserId && n.targetUserId !== 'all' && n.targetUserId !== userId) {
        return n;
      }

      return { ...n, read: true };
    });

    if (isMockMode()) {
      mockStorageAdapter.saveNotifications(updated);
      window.dispatchEvent(new Event('nexus_storage_updated'));
    } else {
      this.setDev('notifications', updated);
    }
  }

  // ── Documents ───────────────────────────────────────────────────────────────
  getDocuments(entityType?: string, entityId?: string): DocumentItem[] {
    const docs = isMockMode()
      ? (JSON.parse(localStorage.getItem('nexus_mock_documents') || '[]') as DocumentItem[])
      : this.getDev<DocumentItem[]>('documents', []);

    return docs.filter(d => {
      if (entityType && d.entityType !== entityType) return false;
      if (entityId && d.entityId !== entityId) return false;
      return true;
    });
  }

  saveDocument(doc: DocumentItem): void {
    const key = isMockMode() ? 'nexus_mock_documents' : `${this.devPrefix}documents`;
    try {
      const docs: DocumentItem[] = JSON.parse(localStorage.getItem(key) || '[]');
      const index = docs.findIndex(d => d.id === doc.id);
      if (index >= 0) docs[index] = doc;
      else docs.unshift(doc);
      localStorage.setItem(key, JSON.stringify(docs));
      window.dispatchEvent(new Event('nexus_storage_updated'));
    } catch (e) {
      console.error('Failed to save document:', e);
    }
  }

  deleteDocument(id: string): void {
    const key = isMockMode() ? 'nexus_mock_documents' : `${this.devPrefix}documents`;
    try {
      const docs: DocumentItem[] = JSON.parse(localStorage.getItem(key) || '[]');
      const filtered = docs.filter(d => d.id !== id);
      localStorage.setItem(key, JSON.stringify(filtered));
      window.dispatchEvent(new Event('nexus_storage_updated'));
    } catch (e) {
      console.error('Failed to delete document:', e);
    }
  }

  // ── Departments, Teams, Queues, Routing ─────────────────────────────────────
  getDepartments(companyId?: string): Department[] {
    const departments = this.getDev<Department[]>('departments', []);
    return companyId ? departments.filter(d => d.companyId === companyId) : departments;
  }

  saveDepartment(department: Department): void {
    const departments = this.getDepartments();
    const index = departments.findIndex(d => d.id === department.id);
    if (index >= 0) departments[index] = department;
    else departments.unshift(department);
    this.setDev('departments', departments);
  }

  getTeams(companyId?: string): Team[] {
    const teams = this.getDev<Team[]>('teams', []);
    return companyId ? teams.filter(t => t.companyId === companyId) : teams;
  }

  saveTeam(team: Team): void {
    const teams = this.getTeams();
    const index = teams.findIndex(t => t.id === team.id);
    if (index >= 0) teams[index] = team;
    else teams.unshift(team);
    this.setDev('teams', teams);
  }

  getQueues(companyId?: string): Queue[] {
    const queues = this.getDev<Queue[]>('queues', []);
    return companyId ? queues.filter(q => q.companyId === companyId) : queues;
  }

  saveQueue(queue: Queue): void {
    const queues = this.getQueues();
    const index = queues.findIndex(q => q.id === queue.id);
    if (index >= 0) queues[index] = queue;
    else queues.unshift(queue);
    this.setDev('queues', queues);
  }

  getRoutingRules(companyId?: string): RoutingRule[] {
    const rules = this.getDev<RoutingRule[]>('routing_rules', []);
    return companyId ? rules.filter(r => r.companyId === companyId) : rules;
  }

  saveRoutingRule(rule: RoutingRule): void {
    const rules = this.getRoutingRules();
    const index = rules.findIndex(r => r.id === rule.id);
    if (index >= 0) rules[index] = rule;
    else rules.unshift(rule);
    this.setDev('routing_rules', rules);
  }

  getLeadAssignments(companyId?: string): LeadAssignment[] {
    const assignments = this.getDev<LeadAssignment[]>('lead_assignments', []);
    return companyId ? assignments.filter(a => a.companyId === companyId) : assignments;
  }

  saveLeadAssignment(assignment: LeadAssignment): void {
    const assignments = this.getLeadAssignments();
    const index = assignments.findIndex(a => a.id === assignment.id);
    if (index >= 0) assignments[index] = assignment;
    else assignments.unshift(assignment);
    this.setDev('lead_assignments', assignments);
  }

  getAgentPresence(companyId?: string): AgentPresence[] {
    const presences = this.getDev<AgentPresence[]>('agent_presence', []);
    return companyId ? presences.filter(p => p.companyId === companyId) : presences;
  }

  saveAgentPresence(presence: AgentPresence): void {
    const presences = this.getAgentPresence();
    const index = presences.findIndex(
      p => (presence.id && p.id === presence.id) || (presence.userId && p.userId === presence.userId)
    );
    if (index >= 0) presences[index] = presence;
    else presences.unshift(presence);
    this.setDev('agent_presence', presences);
  }

  getRoutingAttempts(companyId?: string): RoutingAttempt[] {
    const attempts = this.getDev<RoutingAttempt[]>('routing_attempts', []);
    return companyId ? attempts.filter(a => a.companyId === companyId) : attempts;
  }

  saveRoutingAttempt(attempt: RoutingAttempt): void {
    const attempts = this.getRoutingAttempts();
    const index = attempts.findIndex(a => a.id === attempt.id);
    if (index >= 0) attempts[index] = attempt;
    else attempts.unshift(attempt);
    this.setDev('routing_attempts', attempts);
  }

  // ── Custom Field Definitions ────────────────────────────────────────────────
  getCustomFieldDefinitions(companyId?: string): CustomFieldDefinition[] {
    if (isMockMode()) {
      return mockStorageAdapter.getCustomFields(companyId);
    }
    const definitions = this.getDev<CustomFieldDefinition[]>('custom_field_definitions', []);
    if (!companyId) return definitions;
    return definitions.filter(d =>
      d.companyId === companyId ||
      (companyId === 'ghl' && d.companyId === 't-ghl-01') ||
      (companyId === 't-ghl-01' && d.companyId === 'ghl') ||
      (companyId === 'jamin' && d.companyId === 't-jamin-02') ||
      (companyId === 't-jamin-02' && d.companyId === 'jamin')
    );
  }

  saveCustomFieldDefinition(def: CustomFieldDefinition): void {
    if (isMockMode()) {
      const definitions = mockStorageAdapter.getCustomFields();
      const index = definitions.findIndex(d => d.id === def.id);
      if (index >= 0) definitions[index] = def;
      else definitions.unshift(def);
      mockStorageAdapter.saveCustomFields(definitions);
      window.dispatchEvent(new Event('nexus_storage_updated'));
      return;
    }
    const definitions = this.getCustomFieldDefinitions();
    const index = definitions.findIndex(d => d.id === def.id);
    if (index >= 0) definitions[index] = def;
    else definitions.unshift(def);
    this.setDev('custom_field_definitions', definitions);
  }

  // ── Products / Services ─────────────────────────────────────────────────────
  getProductsServices(companyId?: string): ProductService[] {
    const items = this.getDev<ProductService[]>('products_services', []);
    return companyId ? items.filter(p => p.companyId === companyId) : items;
  }

  saveProductService(productService: ProductService): void {
    const items = this.getProductsServices();
    const index = items.findIndex(p => p.id === productService.id);
    if (index >= 0) items[index] = productService;
    else items.unshift(productService);
    this.setDev('products_services', items);
  }

  // ── Agents & IRMs ───────────────────────────────────────────────────────────
  getAgents(companyId?: string): Array<{ id: number | string; name: string; email?: string; role?: string }> {
    if (isMockMode()) {
      return mockStorageAdapter.getAgents();
    }
    // Dev mode: return real users with sales_executive role
    return this.getUsers(companyId)
      .filter(u => u.role?.code === 'sales_executive')
      .map(u => ({ id: u.id, name: u.name, email: u.email, role: u.role?.name || 'Sales Executive' }));
  }

  getIrms(companyId?: string): IrmProfile[] {
    if (isMockMode()) {
      return mockStorageAdapter.getIrms();
    }
    // Dev mode: return real users with irm role mapped to IrmProfile contract
    return this.getUsers(companyId)
      .filter(u => u.role?.code === 'irm')
      .map(u => ({
        id: u.id,
        name: u.name,
        email: u.email,
        phone: u.phone,
        experience: '5 Years',
        experienceYears: 5,
        experienceLevel: 'Experienced' as const,
        performance: 95,
        status: 'Available' as const,
      }));
  }

  // ── Bootstrap Loader (Mock Mode Only) ───────────────────────────────────────
  async loadMockDataFromSeparateFolder(): Promise<void> {
    if (isMockMode() && mockBootstrapRunner) {
      mockBootstrapRunner(true);
      window.dispatchEvent(new Event('nexus_storage_updated'));
    }
  }

  // ── Popup Position ──────────────────────────────────────────────────────────
  getPopupPosition(): PopupPosition {
    try {
      const data = localStorage.getItem('nexus_popup_position');
      if (!data) return 'top-right';
      try {
        const parsed = JSON.parse(data);
        if (['top-right', 'top-left', 'bottom-right', 'bottom-left'].includes(parsed)) {
          return parsed as PopupPosition;
        }
      } catch {
        if (['top-right', 'top-left', 'bottom-right', 'bottom-left'].includes(data)) {
          return data as PopupPosition;
        }
      }
      return 'top-right';
    } catch {
      return 'top-right';
    }
  }

  setPopupPosition(pos: PopupPosition): void {
    try {
      localStorage.setItem('nexus_popup_position', JSON.stringify(pos));
      window.dispatchEvent(new Event('nexus_storage_updated'));
    } catch (e) {
      console.error('Failed to save popup position to localStorage', e);
    }
  }

  // ── Call Preferences ────────────────────────────────────────────────────────
  getAdminCallSettings(): { allowSalesDecline: boolean; allowIrmDecline: boolean } {
    const key = isMockMode() ? 'nexus_mock_admin_call_settings' : `${this.devPrefix}admin_call_settings`;
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : { allowSalesDecline: true, allowIrmDecline: true };
    } catch {
      return { allowSalesDecline: true, allowIrmDecline: true };
    }
  }

  setAdminCallSettings(settings: Partial<{ allowSalesDecline: boolean; allowIrmDecline: boolean }>): void {
    const existing = this.getAdminCallSettings();
    const key = isMockMode() ? 'nexus_mock_admin_call_settings' : `${this.devPrefix}admin_call_settings`;
    try {
      localStorage.setItem(key, JSON.stringify({ ...existing, ...settings }));
    } catch (e) {
      console.error('Failed to save admin call settings', e);
    }
  }

  getCallPreferences(): {
    soundEnabled: boolean;
    desktopNotifEnabled: boolean;
    autoBusyEnabled: boolean;
    defaultFollowupTime: string;
  } {
    const key = isMockMode() ? 'nexus_mock_call_preferences' : `${this.devPrefix}call_preferences`;
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : {
        soundEnabled: true,
        desktopNotifEnabled: false,
        autoBusyEnabled: true,
        defaultFollowupTime: '11:00',
      };
    } catch {
      return {
        soundEnabled: true,
        desktopNotifEnabled: false,
        autoBusyEnabled: true,
        defaultFollowupTime: '11:00',
      };
    }
  }

  setCallPreferences(prefs: Partial<{
    soundEnabled: boolean;
    desktopNotifEnabled: boolean;
    autoBusyEnabled: boolean;
    defaultFollowupTime: string;
  }>): void {
    const existing = this.getCallPreferences();
    const key = isMockMode() ? 'nexus_mock_call_preferences' : `${this.devPrefix}call_preferences`;
    try {
      localStorage.setItem(key, JSON.stringify({ ...existing, ...prefs }));
    } catch (e) {
      console.error('Failed to save call preferences', e);
    }
  }

  resetData(): void {
    if (isMockMode()) {
      localStorage.clear();
      mockBootstrapRunner?.(true);
    } else {
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith(this.devPrefix)) {
          localStorage.removeItem(key);
        }
      });
    }
    window.dispatchEvent(new Event('nexus_storage_updated'));
  }
}

export const storageService = new StorageService();
