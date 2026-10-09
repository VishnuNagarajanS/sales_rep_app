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
} from '../types';
import { DEFAULT_TENANTS } from '../constants/defaultTenants';
import { isMockMode } from '../config/environment';
import { DEFAULT_CUSTOM_FIELD_DEFINITIONS } from '../constants/customFields';

export type PopupPosition = 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';

class StorageService {
  constructor() {
    this.runLeadsDedupMigration();
    this.cleanupFakeRuntimeData();
  }

  isMockMode(): boolean {
    return isMockMode();
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

  private cleanupFakeRuntimeData(): void {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return;
      if (isMockMode()) return;

      // 1. Purge fake follow-ups (only confirmed exact fixture IDs)
      const exactFakeFollowupIds = new Set([
        'flw-se-ps-01', 'flw-se-ps-02', 'flw-se-ps-03',
        'flw-se-rv-01', 'flw-se-rv-02', 'flw-se-rv-03',
        'flw-irm-rv-01', 'flw-irm-rv-02', 'flw-irm-rv-03',
        'flw-irm-mn-01', 'flw-irm-mn-02', 'flw-irm-mn-03',
        'flw-irm-sj-01', 'flw-irm-sj-02', 'flw-irm-sj-03',
      ]);
      const rawFollowups = localStorage.getItem('nexus_followups');
      if (rawFollowups) {
        const parsed = JSON.parse(rawFollowups);
        if (Array.isArray(parsed)) {
          const cleaned = parsed.filter((f: any) => !exactFakeFollowupIds.has(String(f.id || '')));
          if (cleaned.length !== parsed.length) {
            localStorage.setItem('nexus_followups', JSON.stringify(cleaned));
          }
        }
      }

      // 2. Purge fake investors (only confirmed exact fixture IDs)
      const exactFakeInvestorIds = new Set(['inv-01', 'inv-02', 'inv-03', 'inv-04', 'inv-05']);
      const rawInvestors = localStorage.getItem('nexus_investors');
      if (rawInvestors) {
        const parsed = JSON.parse(rawInvestors);
        if (Array.isArray(parsed)) {
          const cleaned = parsed.filter((i: any) => !exactFakeInvestorIds.has(String(i.id || '')));
          if (cleaned.length !== parsed.length) {
            localStorage.setItem('nexus_investors', JSON.stringify(cleaned));
          }
        }
      }

      // 3. Purge fake opportunities (only confirmed exact fixture IDs)
      const exactFakeOppIds = new Set(['opp-01', 'opp-02', 'opp-03', 'opp-04', 'opp-05']);
      const rawOpps = localStorage.getItem('nexus_opportunities');
      if (rawOpps) {
        const parsed = JSON.parse(rawOpps);
        if (Array.isArray(parsed)) {
          const cleaned = parsed.filter((o: any) => !exactFakeOppIds.has(String(o.id || '')));
          if (cleaned.length !== parsed.length) {
            localStorage.setItem('nexus_opportunities', JSON.stringify(cleaned));
          }
        }
      }

      // 4. Purge fake consultations (only confirmed exact fixture IDs)
      const exactFakeConsIds = new Set(['cns-01', 'cns-02', 'cns-03', 'cns-04', 'cns-05']);
      const rawCons = localStorage.getItem('nexus_consultations');
      if (rawCons) {
        const parsed = JSON.parse(rawCons);
        if (Array.isArray(parsed)) {
          const cleaned = parsed.filter((c: any) => !exactFakeConsIds.has(String(c.id || '')));
          if (cleaned.length !== parsed.length) {
            localStorage.setItem('nexus_consultations', JSON.stringify(cleaned));
          }
        }
      }

      // 5. Purge fake calls (only confirmed exact fixture IDs)
      const exactFakeCallIds = new Set([
        'call-01', 'call-02', 'call-03', 'call-04', 'call-05',
        'call-06', 'call-07', 'call-08', 'call-09', 'call-10'
      ]);
      const rawCalls = localStorage.getItem('nexus_calls');
      if (rawCalls) {
        const parsed = JSON.parse(rawCalls);
        if (Array.isArray(parsed)) {
          const cleaned = parsed.filter((c: any) => !exactFakeCallIds.has(String(c.id || '')));
          if (cleaned.length !== parsed.length) {
            localStorage.setItem('nexus_calls', JSON.stringify(cleaned));
          }
        }
      }

      // 6. Purge fake test users (only confirmed exact IDs)
      const exactFakeUserIds = new Set(['28', '29', '30']);
      ['nexus_dev_users', 'nexus_users'].forEach(key => {
        const raw = localStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            const cleaned = parsed.filter((u: any) => !exactFakeUserIds.has(String(u.id || '')));
            if (cleaned.length !== parsed.length) {
              localStorage.setItem(key, JSON.stringify(cleaned));
            }
          }
        }
      });

      // 7. Purge fake admin kanban cards (only confirmed exact fixture IDs)
      const exactFakeKanbanIds = new Set([
        'kanban-se-01', 'kanban-se-02', 'kanban-se-03', 'kanban-se-04', 'kanban-se-05',
        'kanban-se-06', 'kanban-se-07', 'kanban-se-08', 'kanban-se-09', 'kanban-se-10',
        'kanban-irm-01', 'kanban-irm-02', 'kanban-irm-03', 'kanban-irm-04', 'kanban-irm-05',
        'kanban-irm-06', 'kanban-irm-07', 'kanban-irm-08', 'kanban-irm-09', 'kanban-irm-10'
      ]);
      const rawKanban = localStorage.getItem('nexus_admin_kanban_cards_v1');
      if (rawKanban) {
        const parsed = JSON.parse(rawKanban);
        if (Array.isArray(parsed)) {
          const cleaned = parsed.filter((c: any) => !exactFakeKanbanIds.has(String(c.id || '')));
          if (cleaned.length !== parsed.length) {
            localStorage.setItem('nexus_admin_kanban_cards_v1', JSON.stringify(cleaned));
          }
        }
      }
    } catch (e) {
      console.error('Error in cleanupFakeRuntimeData:', e);
    }
  }

  private get<T>(key: string, fallback: T): T {
    try {
      const data = localStorage.getItem(`nexus_${key}`);
      return data ? JSON.parse(data) : fallback;
    } catch {
      return fallback;
    }
  }

  private set<T>(key: string, value: T): void {
    try {
      localStorage.setItem(`nexus_${key}`, JSON.stringify(value));
      window.dispatchEvent(new Event('nexus_storage_updated'));
    } catch (e) {
      console.error('Failed to save to localStorage', e);
    }
  }

  // Tenants
  getTenants(): Tenant[] {
    return this.get<Tenant[]>('tenants', Object.values(DEFAULT_TENANTS));
  }

  saveTenant(tenant: Tenant): void {
    const tenants = this.getTenants();
    const index = tenants.findIndex(t => t.id === tenant.id);
    if (index >= 0) {
      tenants[index] = tenant;
    } else {
      tenants.push(tenant);
    }
    this.set('tenants', tenants);
  }

  // Users
  getUsers(companySlug?: string): User[] {
    let users = this.get<User[]>('users', []);
    if (!users || users.length === 0) {
      try {
        const raw = localStorage.getItem('nexus_dev_users');
        if (raw) users = JSON.parse(raw);
      } catch {}
    }
    // Sanitize: strictly map any legacy sales_manager to sales_executive
    users = (users || []).map(u => {
      if ((u.role?.code as string) === 'sales_manager' || (u.role?.name && u.role.name.toLowerCase().includes('manager') && !u.role.name.toLowerCase().includes('irm') && !u.role.name.toLowerCase().includes('investor'))) {
        return {
          ...u,
          role: {
            ...u.role,
            code: 'sales_executive' as const,
            name: 'Sales Executive'
          }
        };
      }
      return u;
    });
    return companySlug ? users.filter(u => u.companySlug === companySlug || (u as any).companyId === companySlug) : users;
  }

  setUsers(users: User[]): void {
    const sanitized = (users || []).map(u => {
      if ((u.role?.code as string) === 'sales_manager' || (u.role?.name && u.role.name.toLowerCase().includes('manager') && !u.role.name.toLowerCase().includes('irm') && !u.role.name.toLowerCase().includes('investor'))) {
        return {
          ...u,
          role: {
            ...u.role,
            code: 'sales_executive' as const,
            name: 'Sales Executive'
          }
        };
      }
      return u;
    });
    this.set('users', sanitized);
    try {
      localStorage.setItem('nexus_dev_users', JSON.stringify(sanitized));
    } catch {}
    window.dispatchEvent(new Event('nexus_storage_updated'));
  }

  saveUser(user: User): void {
    const users = this.getUsers();
    const index = users.findIndex(u => u.id === user.id);
    if (index >= 0) {
      users[index] = user;
    } else {
      users.push(user);
    }
    this.set('users', users);
    try {
      localStorage.setItem('nexus_dev_users', JSON.stringify(users));
    } catch {}
  }

  deleteUser(id: string): void {
    const users = this.getUsers().filter(u => u.id !== id);
    this.set('users', users);
    try {
      localStorage.setItem('nexus_dev_users', JSON.stringify(users));
    } catch {}
  }

  // Leads (Defaults to empty [] - real-time data only)
  getLeads(companyId?: string): Lead[] {
    const leads = this.get<Lead[]>('leads', []);
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
    const leads = this.getLeads();
    const index = leads.findIndex(l => l.id === lead.id);
    if (index >= 0) {
      leads[index] = lead;
    } else {
      leads.unshift(lead);
    }
    this.set('leads', leads);
  }

  saveLeads(leads: Lead[]): void {
    this.set('leads', leads);
  }

  deleteLead(id: string): void {
    const leads = this.getLeads().filter(l => l.id !== id);
    this.set('leads', leads);
  }

  cleanupDuplicateLeads(companyId?: string): { removedCount: number } {
    try {
      const allLeads = this.get<Lead[]>('leads', []) || [];
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
          if (!groups.has(digits)) {
            groups.set(digits, []);
          }
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

        // Sort by recency descending: most recently updated record first
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
        this.set('leads', finalLeads);
      }

      return { removedCount };
    } catch (e) {
      console.error('Error in cleanupDuplicateLeads:', e);
      return { removedCount: 0 };
    }
  }

  // Customers (Defaults to empty [] - real-time data only)
  getCustomers(companyId?: string): Customer[] {
    const customers = this.get<Customer[]>('customers', []);
    return companyId ? customers.filter(c => c.companyId === companyId) : customers;
  }

  saveCustomer(customer: Customer): void {
    const customers = this.getCustomers();
    const index = customers.findIndex(c => c.id === customer.id);
    if (index >= 0) {
      customers[index] = customer;
    } else {
      customers.unshift(customer);
    }
    this.set('customers', customers);
  }

  // Deals (Defaults to empty [] - real-time data only)
  getDeals(companyId?: string): Deal[] {
    const deals = this.get<Deal[]>('deals', []);
    return companyId ? deals.filter(d => d.companyId === companyId) : deals;
  }

  saveDeal(deal: Deal): void {
    const deals = this.getDeals();
    const index = deals.findIndex(d => d.id === deal.id);
    if (index >= 0) {
      deals[index] = deal;
    } else {
      deals.unshift(deal);
    }
    this.set('deals', deals);
  }

  // Deal Activities
  getDealActivities(dealId: string, companyId?: string): DealActivity[] {
    const activities = this.get<DealActivity[]>('deal_activities', []);
    return activities.filter(a => a.dealId === dealId && (!companyId || a.companyId === companyId));
  }

  addDealActivity(activity: DealActivity): void {
    const activities = this.get<DealActivity[]>('deal_activities', []);
    activities.unshift(activity);
    this.set('deal_activities', activities);
    window.dispatchEvent(new Event('nexus_storage_updated'));
  }

  // Calls
  getCalls(companyId?: string): CallRecord[] {
    const stored = this.get<CallRecord[]>('calls', []);
    return companyId ? stored.filter(c => c.companyId === companyId) : stored;
  }

  addCall(call: CallRecord): void {
    const calls = this.getCalls();
    calls.unshift(call);
    this.set('calls', calls);
  }

  // Follow-ups
  getFollowups(companyId?: string): Followup[] {
    const raw = this.get<Followup[]>('followups', []) || [];
    return companyId ? raw.filter(f => f.companyId === companyId) : raw;
  }

  cleanupGhlPendingFollowups(companyId?: string): void {
    try {
      const allFollowups = this.get<Followup[]>('followups', []) || [];
      if (!allFollowups.length) return;

      const targetCompanyId = companyId || 't-ghl-01';

      // Load leads so we can check which contacts are already in NI/Junk
      const allLeads = this.getLeads(targetCompanyId);
      const niJunkLeadIds = new Set<string>(
        allLeads
          .filter(l => l.status === 'Not Interested' || l.status === 'Junk')
          .map(l => l.id)
      );
      const niJunkPhones = new Set<string>(
        allLeads
          .filter(l => l.status === 'Not Interested' || l.status === 'Junk')
          .map(l => (l.phone || '').replace(/\D/g, '').slice(-10))
          .filter(Boolean)
      );

      const ghlPending = allFollowups.filter(
        f => f.companyId === targetCompanyId && f.status === 'Pending'
      );

      if (!ghlPending.length) return;

      const nonPendingOrOtherCompany = allFollowups.filter(
        f => f.companyId !== targetCompanyId || f.status !== 'Pending'
      );

      const seenContacts = new Map<string, Followup>();
      const keepPending: Followup[] = [];

      for (const item of ghlPending) {
        // Hard-exclude any Pending followup whose lead is now NI or Junk
        if (item.contactId && item.contactId !== 'contact-new' && niJunkLeadIds.has(item.contactId)) {
          continue; // drop — lead is no longer active
        }
        const phoneDigits = (item.contactPhone || '').replace(/\D/g, '').slice(-10);
        if (phoneDigits && niJunkPhones.has(phoneDigits)) {
          continue; // drop — lead is no longer active (phone match)
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

      this.set('followups', [...nonPendingOrOtherCompany, ...keepPending]);
    } catch (e) {
      console.error('Error in cleanupGhlPendingFollowups:', e);
    }
  }

  saveFollowup(followup: Followup): void {
    const followups = this.getFollowups();
    const index = followups.findIndex(f => f.id === followup.id);
    if (index >= 0) {
      followups[index] = followup;
    } else {
      followups.unshift(followup);
    }
    this.set('followups', followups);
  }

  deleteFollowup(id: string): void {
    const followups = this.get<Followup[]>('followups', []).filter(f => f.id !== id);
    this.set('followups', followups);
  }

  /**
   * GHL Sales Exec – atomic purge of ALL Pending followup records for a contact
   * (by id or phone). Used when routing a lead to Not Interested or Junk so the
   * record is completely removed from the Follow-up queue instead of just being
   * marked Completed (which would still appear in "All Tasks").
   * Scoped to a single companyId; has no effect on other tenants.
   */
  purgeFollowupsForContact(
    companyId: string,
    contactId?: string | null,
    contactPhone?: string | null
  ): void {
    try {
      const allFollowups = this.get<Followup[]>('followups', []) || [];
      const targetPhoneDigits = (contactPhone || '').replace(/\D/g, '').slice(-10);

      const remaining = allFollowups.filter(f => {
        // Only touch Pending records for this company
        if (f.companyId !== companyId || f.status !== 'Pending') return true;

        // Match by contactId
        if (contactId && contactId !== 'contact-new' && f.contactId === contactId) {
          return false; // purge
        }
        // Match by phone
        const fPhone = (f.contactPhone || '').replace(/\D/g, '').slice(-10);
        if (fPhone && targetPhoneDigits && fPhone === targetPhoneDigits) {
          return false; // purge
        }
        return true;
      });

      this.set('followups', remaining);
    } catch (e) {
      console.error('Error in purgeFollowupsForContact:', e);
    }
  }

  // Projects & Plots (Defaults to empty [] - real-time data only)
  getProjects(): PropertyProject[] {
    return this.get<PropertyProject[]>('projects', []);
  }

  saveProject(project: PropertyProject): void {
    const projects = this.getProjects();
    const index = projects.findIndex(p => p.id === project.id);
    if (index >= 0) {
      projects[index] = project;
    } else {
      projects.push(project);
    }
    this.set('projects', projects);
  }

  getPlots(projectId?: string): Plot[] {
    const plots = this.get<Plot[]>('plots', []);
    return projectId ? plots.filter(p => p.projectId === projectId) : plots;
  }

  savePlot(plot: Plot): void {
    const plots = this.getPlots();
    const index = plots.findIndex(p => p.id === plot.id);
    if (index >= 0) {
      plots[index] = plot;
    } else {
      plots.push(plot);
    }
    this.set('plots', plots);
  }

  // Site Visits (Defaults to empty [] - real-time data only)
  getSiteVisits(companyId?: string): SiteVisit[] {
    const visits = this.get<SiteVisit[]>('site_visits', []);
    return companyId ? visits.filter(v => v.companyId === companyId) : visits;
  }

  saveSiteVisit(visit: SiteVisit): void {
    const visits = this.getSiteVisits();
    const index = visits.findIndex(v => v.id === visit.id);
    if (index >= 0) {
      visits[index] = visit;
    } else {
      visits.unshift(visit);
    }
    this.set('site_visits', visits);
  }

  // Bookings (Defaults to empty [] - real-time data only)
  getBookings(companyId?: string): Booking[] {
    const bookings = this.get<Booking[]>('bookings', []);
    return companyId ? bookings.filter(b => b.companyId === companyId) : bookings;
  }

  saveBooking(booking: Booking): void {
    const bookings = this.getBookings();
    const index = bookings.findIndex(b => b.id === booking.id);
    if (index >= 0) {
      bookings[index] = booking;
    } else {
      bookings.unshift(booking);
    }
    this.set('bookings', bookings);
  }

  // Investors (Defaults to empty [] - real-time data only)
  getInvestors(companyId?: string): Investor[] {
    const investors = this.get<Investor[]>('investors', []);
    return companyId ? investors.filter(i => i.companyId === companyId) : investors;
  }

  saveInvestor(investor: Investor): void {
    const investors = this.getInvestors();
    const index = investors.findIndex(i => i.id === investor.id);
    if (index >= 0) {
      investors[index] = investor;
    } else {
      investors.unshift(investor);
    }
    this.set('investors', investors);
  }

  deleteInvestor(id: string): void {
    const investors = this.getInvestors().filter(i => i.id !== id);
    this.set('investors', investors);
  }

  // Consultations (Defaults to empty [] - real-time data only)
  getConsultations(companyId?: string): Consultation[] {
    const consultations = this.get<Consultation[]>('consultations', []);
    return companyId ? consultations.filter(c => c.companyId === companyId) : consultations;
  }

  saveConsultation(consultation: Consultation): void {
    const consultations = this.getConsultations();
    const index = consultations.findIndex(c => c.id === consultation.id);
    if (index >= 0) {
      consultations[index] = consultation;
    } else {
      consultations.unshift(consultation);
    }
    this.set('consultations', consultations);
  }

  deleteConsultation(id: string): void {
    const consultations = this.getConsultations().filter(c => c.id !== id);
    this.set('consultations', consultations);
  }

  // Opportunities (Defaults to empty [] - real-time data only)
  getOpportunities(companyId?: string): InvestmentOpportunity[] {
    const opps = this.get<InvestmentOpportunity[]>('opportunities', []);
    return companyId ? opps.filter(o => o.companyId === companyId) : opps;
  }

  saveOpportunity(opportunity: InvestmentOpportunity): void {
    const opps = this.getOpportunities();
    const index = opps.findIndex(o => o.id === opportunity.id);
    if (index >= 0) {
      opps[index] = opportunity;
    } else {
      opps.unshift(opportunity);
    }
    this.set('opportunities', opps);
  }

  deleteOpportunity(id: string): void {
    const opps = this.getOpportunities().filter(o => o.id !== id);
    this.set('opportunities', opps);
  }


  // Audit Logs (Defaults to empty [] - real-time data only)
  getAuditLogs(companyId?: string): AuditLog[] {
    const logs = this.get<AuditLog[]>('audit_logs', []);
    return companyId ? logs.filter(l => !l.companyId || l.companyId === companyId) : logs;
  }

  addAuditLog(log: AuditLog): void {
    const logs = this.getAuditLogs();
    logs.unshift(log);
    this.set('audit_logs', logs);
  }

  // Notifications (Multi-tenant scoped with strict cross-tenant isolation)
  getNotifications(companyId?: string, userId?: string, userRoleCode?: string): NotificationItem[] {
    const raw = this.get<NotificationItem[]>('notifications', []);

    // Auto-migrate any legacy items lacking tenant information (default to GHL)
    let migrated = false;
    const cleanList = raw.map(n => {
      if (!n.companyId && !n.companySlug) {
        migrated = true;
        return {
          ...n,
          companyId: 't-ghl-01',
          companySlug: 'ghl',
          targetUserId: n.targetUserId || 'all',
          priority: n.priority || 'normal',
        };
      }
      return n;
    });

    if (migrated) {
      try {
        localStorage.setItem('nexus_notifications', JSON.stringify(cleanList));
      } catch (e) {
        console.error('Failed to update migrated notifications', e);
      }
    }

    // 1. Strict Tenant Filtering
    if (!companyId) return cleanList;

    const targetCompanyId = companyId.toLowerCase();
    const isGhlTarget = targetCompanyId === 't-ghl-01' || targetCompanyId === 'ghl';
    const isJaminTarget = targetCompanyId === 't-jamin-02' || targetCompanyId === 'jamin';

    const tenantScoped = cleanList.filter(n => {
      const nCompId = (n.companyId || '').toLowerCase();
      const nSlug = (n.companySlug || '').toLowerCase();

      if (isGhlTarget) {
        return nCompId === 't-ghl-01' || nSlug === 'ghl';
      }
      if (isJaminTarget) {
        return nCompId === 't-jamin-02' || nSlug === 'jamin';
      }
      return nCompId === targetCompanyId || nSlug === targetCompanyId;
    });

    // 2. User / Role Targeting within the Tenant
    if (!userId) return tenantScoped;

    return tenantScoped.filter(n => {
      // Broadcast to all users in tenant
      if (!n.targetUserId || n.targetUserId === 'all') {
        // If targeted to a specific role, verify role match or admin
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
      // Targeted directly to this user
      if (n.targetUserId === userId) return true;
      // Sender admin can view what they sent
      if (n.createdById === userId) return true;

      return false;
    });
  }

  createNotification(notification: NotificationItem): void {
    const raw = this.get<NotificationItem[]>('notifications', []);
    const updated = [notification, ...raw];
    this.set('notifications', updated);
  }

  markNotificationRead(id: string): void {
    const raw = this.get<NotificationItem[]>('notifications', []);
    const found = raw.find(n => n.id === id);
    if (found) {
      found.read = true;
      this.set('notifications', raw);
    }
  }

  markAllNotificationsRead(companyId?: string, userId?: string): void {
    const raw = this.get<NotificationItem[]>('notifications', []);
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
    this.set('notifications', updated);
  }

  // Documents — metadata-only (no file bytes stored)
  getDocuments(entityType?: string, entityId?: string): DocumentItem[] {
    const docs = this.get<DocumentItem[]>('documents', []);
    return docs.filter(d => {
      if (entityType && d.entityType !== entityType) return false;
      if (entityId && d.entityId !== entityId) return false;
      return true;
    });
  }

  saveDocument(doc: DocumentItem): void {
    const docs = this.get<DocumentItem[]>('documents', []);
    const index = docs.findIndex(d => d.id === doc.id);
    if (index >= 0) {
      docs[index] = doc;
    } else {
      docs.unshift(doc);
    }
    this.set('documents', docs);
  }

  deleteDocument(id: string): void {
    const docs = this.get<DocumentItem[]>('documents', []).filter(d => d.id !== id);
    this.set('documents', docs);
  }

  // Departments
  getDepartments(companyId?: string): Department[] {
    const departments = this.get<Department[]>('departments', []);
    return companyId ? departments.filter(d => d.companyId === companyId) : departments;
  }

  saveDepartment(department: Department): void {
    const departments = this.getDepartments();
    const index = departments.findIndex(d => d.id === department.id);
    if (index >= 0) {
      departments[index] = department;
    } else {
      departments.unshift(department);
    }
    this.set('departments', departments);
  }

  // Teams
  getTeams(companyId?: string): Team[] {
    const teams = this.get<Team[]>('teams', []);
    return companyId ? teams.filter(t => t.companyId === companyId) : teams;
  }

  saveTeam(team: Team): void {
    const teams = this.getTeams();
    const index = teams.findIndex(t => t.id === team.id);
    if (index >= 0) {
      teams[index] = team;
    } else {
      teams.unshift(team);
    }
    this.set('teams', teams);
  }

  // Queues
  getQueues(companyId?: string): Queue[] {
    const queues = this.get<Queue[]>('queues', []);
    return companyId ? queues.filter(q => q.companyId === companyId) : queues;
  }

  saveQueue(queue: Queue): void {
    const queues = this.getQueues();
    const index = queues.findIndex(q => q.id === queue.id);
    if (index >= 0) {
      queues[index] = queue;
    } else {
      queues.unshift(queue);
    }
    this.set('queues', queues);
  }

  // Routing Rules
  getRoutingRules(companyId?: string): RoutingRule[] {
    const rules = this.get<RoutingRule[]>('routing_rules', []);
    return companyId ? rules.filter(r => r.companyId === companyId) : rules;
  }

  saveRoutingRule(rule: RoutingRule): void {
    const rules = this.getRoutingRules();
    const index = rules.findIndex(r => r.id === rule.id);
    if (index >= 0) {
      rules[index] = rule;
    } else {
      rules.unshift(rule);
    }
    this.set('routing_rules', rules);
  }

  // Lead Assignments
  getLeadAssignments(companyId?: string): LeadAssignment[] {
    const assignments = this.get<LeadAssignment[]>('lead_assignments', []);
    return companyId ? assignments.filter(a => a.companyId === companyId) : assignments;
  }

  saveLeadAssignment(assignment: LeadAssignment): void {
    const assignments = this.getLeadAssignments();
    const index = assignments.findIndex(a => a.id === assignment.id);
    if (index >= 0) {
      assignments[index] = assignment;
    } else {
      assignments.unshift(assignment);
    }
    this.set('lead_assignments', assignments);
  }

  // Agent Presence
  getAgentPresence(companyId?: string): AgentPresence[] {
    const presences = this.get<AgentPresence[]>('agent_presence', []);
    return companyId ? presences.filter(p => p.companyId === companyId) : presences;
  }

  saveAgentPresence(presence: AgentPresence): void {
    const presences = this.getAgentPresence();
    const index = presences.findIndex(
      p => (presence.id && p.id === presence.id) || (presence.userId && p.userId === presence.userId)
    );
    if (index >= 0) {
      presences[index] = presence;
    } else {
      presences.unshift(presence);
    }
    this.set('agent_presence', presences);
  }

  // Routing Attempts
  getRoutingAttempts(companyId?: string): RoutingAttempt[] {
    const attempts = this.get<RoutingAttempt[]>('routing_attempts', []);
    return companyId ? attempts.filter(a => a.companyId === companyId) : attempts;
  }

  saveRoutingAttempt(attempt: RoutingAttempt): void {
    const attempts = this.getRoutingAttempts();
    const index = attempts.findIndex(a => a.id === attempt.id);
    if (index >= 0) {
      attempts[index] = attempt;
    } else {
      attempts.unshift(attempt);
    }
    this.set('routing_attempts', attempts);
  }

  // Custom Field Definitions
  getCustomFieldDefinitions(companyId?: string): CustomFieldDefinition[] {
    const definitions = this.get<CustomFieldDefinition[]>('custom_field_definitions', DEFAULT_CUSTOM_FIELD_DEFINITIONS);
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
    const definitions = this.getCustomFieldDefinitions();
    const index = definitions.findIndex(d => d.id === def.id);
    if (index >= 0) {
      definitions[index] = def;
    } else {
      definitions.unshift(def);
    }
    this.set('custom_field_definitions', definitions);
  }

  // Products / Services
  getProductsServices(companyId?: string): ProductService[] {
    const items = this.get<ProductService[]>('products_services', []);
    return companyId ? items.filter(p => p.companyId === companyId) : items;
  }

  saveProductService(productService: ProductService): void {
    const items = this.getProductsServices();
    const index = items.findIndex(p => p.id === productService.id);
    if (index >= 0) {
      items[index] = productService;
    } else {
      items.unshift(productService);
    }
    this.set('products_services', items);
  }

  getMockAgents() {
    return this.getAgents();
  }

  getMockIrms() {
    return this.getIrms();
  }

  // Used by InCallBar, CustomersPage, FollowupsPage, AdminKanbanBoard.
  getAgents(companyId?: string): Array<{ id: number | string; name: string; email?: string; role?: string }> {
    const users = this.getUsers(companyId);
    const agents = users
      .filter(u => !u.isCovered && (u.role?.code === 'sales_executive' || u.role?.name?.toLowerCase().includes('sales')))
      .map(u => ({ id: u.id, name: u.name, email: u.email, role: u.role?.name || 'Sales Executive' }));
    if (agents.length > 0) return agents;
    return [
      { id: '3', name: 'Naveen', role: 'Sales Executive', email: 'naveen@ghlindiaventures.com' },
    ];
  }

  getIrms(companyId?: string): IrmProfile[] {
    const users = this.getUsers(companyId);
    const irms = users
      .filter(u => !u.isCovered && (u.role?.code === 'irm' || u.role?.name?.toLowerCase().includes('irm') || u.role?.name?.toLowerCase().includes('investor')))
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
    return irms;
  }

  getInitialCustomers(): Customer[] {
    return [];
  }

  // Incoming Call Popup Position
  getPopupPosition(): PopupPosition {
    try {
      const rawPos = localStorage.getItem('nexus_popup_pos');
      if (rawPos && ['top-right', 'top-left', 'bottom-right', 'bottom-left'].includes(rawPos)) {
        return rawPos as PopupPosition;
      }
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
      localStorage.setItem('nexus_popup_pos', pos);
      window.dispatchEvent(new Event('nexus_storage_updated'));
    } catch (e) {
      console.error('Failed to save popup position to localStorage', e);
    }
  }

  // Call Preferences (sound, desktop notifs, auto-busy, default followup time)
  getAdminCallSettings(): { allowSalesDecline: boolean; allowIrmDecline: boolean } {
    try {
      const raw = localStorage.getItem('nexus_admin_call_settings');
      if (raw) return JSON.parse(raw);
    } catch {}
    return this.get('admin_call_settings', {
      allowSalesDecline: true,
      allowIrmDecline: true,
    });
  }

  setAdminCallSettings(settings: Partial<{ allowSalesDecline: boolean; allowIrmDecline: boolean }>): void {
    const existing = this.getAdminCallSettings();
    const updated = { ...existing, ...settings };
    this.set('admin_call_settings', updated);
    localStorage.setItem('nexus_admin_call_settings', JSON.stringify(updated));
    window.dispatchEvent(new Event('nexus_storage_updated'));
  }

  getCallPreferences(): {
    soundEnabled: boolean;
    desktopNotifEnabled: boolean;
    autoBusyEnabled: boolean;
    defaultFollowupTime: string;
  } {
    try {
      const raw = localStorage.getItem('nexus_call_prefs') || localStorage.getItem('nexus_call_preferences');
      if (raw) return JSON.parse(raw);
    } catch {}
    return this.get('call_preferences', {
      soundEnabled: true,
      desktopNotifEnabled: false,
      autoBusyEnabled: true,
      defaultFollowupTime: '11:00',
    });
  }

  setCallPreferences(prefs: Partial<{
    soundEnabled: boolean;
    desktopNotifEnabled: boolean;
    autoBusyEnabled: boolean;
    defaultFollowupTime: string;
  }>): void {
    const existing = this.getCallPreferences();
    const updated = { ...existing, ...prefs };
    this.set('call_preferences', updated);
    localStorage.setItem('nexus_call_prefs', JSON.stringify(updated));
    localStorage.setItem('nexus_call_preferences', JSON.stringify(updated));
    window.dispatchEvent(new Event('nexus_storage_updated'));
  }

  // Reset to clean real-time empty slate
  resetData(): void {
    localStorage.clear();
    window.dispatchEvent(new Event('nexus_storage_updated'));
  }
}

export const storageService = new StorageService();
