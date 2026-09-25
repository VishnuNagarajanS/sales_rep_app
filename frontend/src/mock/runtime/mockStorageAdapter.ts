import {
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
} from '../../types';
import { MOCK_STORAGE_KEYS } from '../shared/mockStorageKeys';
import { assertMockMode } from './mockModeGuard';
import { MOCK_TENANTS } from '../tenants/tenantFixtures';
import { INITIAL_CUSTOM_FIELD_DEFINITIONS } from '../features/customFieldFixtures';
import { INITIAL_INVESTORS } from '../data/investorFixtures';
import { INITIAL_CONSULTATIONS } from '../data/consultationFixtures';
import { INITIAL_OPPORTUNITIES } from '../data/opportunityFixtures';
import { matchesMockTenant } from '../shared/mockTenantScope';
import { MOCK_IRMS } from '../calling/irmFixtures';
import { MOCK_ROLES } from '../roles/roleFixtures';
import { Role } from '../../types';

export class MockStorageAdapter {
  constructor() {
    this.runLeadsDedupMigration();
  }

  private getKey(key: string): string {
    return `nexus_mock_${key}`;
  }

  private getLegacyKey(key: string): string {
    return `nexus_${key}`;
  }

  private get<T>(key: string, fallback: T): T {
    assertMockMode(`get(${key})`);
    try {
      const mockKey = this.getKey(key);
      const data = localStorage.getItem(mockKey);
      if (data !== null) {
        return JSON.parse(data);
      }
      // Backwards compatibility check
      const legacyKey = this.getLegacyKey(key);
      const legacyData = localStorage.getItem(legacyKey);
      if (legacyData !== null) {
        try {
          const parsed = JSON.parse(legacyData);
          localStorage.setItem(mockKey, legacyData);
          return parsed;
        } catch {}
      }
      return fallback;
    } catch {
      return fallback;
    }
  }

  private set<T>(key: string, value: T): void {
    assertMockMode(`set(${key})`);
    try {
      localStorage.setItem(this.getKey(key), JSON.stringify(value));
      window.dispatchEvent(new Event('nexus_storage_updated'));
      window.dispatchEvent(new Event('nexus_mock_storage_updated'));
    } catch (e) {
      console.error('Failed to save to mock localStorage', e);
    }
  }

  runLeadsDedupMigration(): void {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return;
      const MIGRATION_KEY = 'nexus_mock_leads_deduped_v1';
      if (localStorage.getItem(MIGRATION_KEY)) return;
      this.cleanupDuplicateLeads();
      localStorage.setItem(MIGRATION_KEY, 'true');
    } catch (e) {
      console.error('Error in runLeadsDedupMigration (mock):', e);
    }
  }

  // Tenants
  getTenants(): Tenant[] {
    return this.get<Tenant[]>('tenants', Object.values(MOCK_TENANTS));
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
    const users = this.get<User[]>('users', []);
    return companySlug ? users.filter(u => u.companySlug === companySlug) : users;
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
  }

  deleteUser(id: string): void {
    const users = this.getUsers().filter(u => u.id !== id);
    this.set('users', users);
  }

  // Leads
  getLeads(companyId?: string): Lead[] {
    const leads = this.get<Lead[]>('leads', []);
    return companyId ? leads.filter(l => matchesMockTenant(l.companyId, companyId)) : leads;
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

  deleteLead(id: string): void {
    const leads = this.getLeads().filter(l => l.id !== id);
    this.set('leads', leads);
  }

  cleanupDuplicateLeads(companyId?: string): { removedCount: number } {
    try {
      const allLeads = this.get<Lead[]>('leads', []) || [];
      if (!allLeads.length) return { removedCount: 0 };

      const leadsToProcess = companyId
        ? allLeads.filter(l => !l.companyId || matchesMockTenant(l.companyId, companyId))
        : allLeads;
      const otherCompanyLeads = companyId
        ? allLeads.filter(l => l.companyId && !matchesMockTenant(l.companyId, companyId))
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
          if (!winner.notes && other.notes) winner.notes = other.notes;
          if ((!winner.customFields || !Object.keys(winner.customFields).length) && other.customFields) {
            winner.customFields = { ...other.customFields };
          }
        }
        deduplicated.push(winner);
      });

      const finalLeads = [...deduplicated, ...ungrouped, ...otherCompanyLeads];
      this.set('leads', finalLeads);
      return { removedCount };
    } catch (e) {
      console.error('Error during cleanupDuplicateLeads (mock):', e);
      return { removedCount: 0 };
    }
  }

  // Customers
  getCustomers(companyId?: string): Customer[] {
    const customers = this.get<Customer[]>('customers', []);
    return companyId ? customers.filter(c => matchesMockTenant(c.companyId, companyId)) : customers;
  }

  findCustomerByPhone(phone: string, companyId?: string): Customer | undefined {
    if (!phone) return undefined;
    const digits = phone.replace(/\D/g, '').slice(-10);
    if (!digits) return undefined;
    const customers = this.getCustomers(companyId);
    return customers.find(c => {
      const cDigits = (c.phone || '').replace(/\D/g, '').slice(-10);
      return Boolean(cDigits && cDigits === digits);
    });
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

  deleteCustomer(id: string): void {
    const customers = this.getCustomers().filter(c => c.id !== id);
    this.set('customers', customers);
  }

  // Deals
  getDeals(companyId?: string): Deal[] {
    const deals = this.get<Deal[]>('deals', []);
    return companyId ? deals.filter(d => matchesMockTenant(d.companyId, companyId)) : deals;
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

  deleteDeal(id: string): void {
    const deals = this.getDeals().filter(d => d.id !== id);
    this.set('deals', deals);
  }

  // Calls
  getCalls(companyId?: string): CallRecord[] {
    const calls = this.get<CallRecord[]>('calls', []);
    return companyId ? calls.filter(c => matchesMockTenant(c.companyId, companyId)) : calls;
  }

  addCall(call: CallRecord): void {
    const calls = this.getCalls();
    calls.unshift(call);
    this.set('calls', calls);
  }

  deleteCall(id: string): void {
    const calls = this.getCalls().filter(c => c.id !== id);
    this.set('calls', calls);
  }

  // Followups
  getFollowups(companyId?: string): Followup[] {
    const followups = this.get<Followup[]>('followups', []);
    return companyId ? followups.filter(f => matchesMockTenant(f.companyId, companyId)) : followups;
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
    const followups = this.getFollowups().filter(f => f.id !== id);
    this.set('followups', followups);
  }

  cleanupGhlPendingFollowups(companyId?: string): void {
    try {
      const allFollowups = this.get<Followup[]>('followups', []) || [];
      if (!allFollowups.length) return;

      const targetCompanyId = companyId || 't-ghl-01';

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
        f => matchesMockTenant(f.companyId, targetCompanyId) && f.status === 'Pending'
      );

      if (!ghlPending.length) return;

      const nonPendingOrOtherCompany = allFollowups.filter(
        f => !matchesMockTenant(f.companyId, targetCompanyId) || f.status !== 'Pending'
      );

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

      this.set('followups', [...nonPendingOrOtherCompany, ...keepPending]);
    } catch (e) {
      console.error('Error in cleanupGhlPendingFollowups:', e);
    }
  }

  purgeFollowupsForContact(
    companyId: string,
    contactId?: string | null,
    contactPhone?: string | null
  ): void {
    try {
      const allFollowups = this.get<Followup[]>('followups', []) || [];
      const targetPhoneDigits = (contactPhone || '').replace(/\D/g, '').slice(-10);

      const remaining = allFollowups.filter(f => {
        if (!matchesMockTenant(f.companyId, companyId) || f.status !== 'Pending') return true;

        if (contactId && contactId !== 'contact-new' && f.contactId === contactId) {
          return false;
        }
        const fPhone = (f.contactPhone || '').replace(/\D/g, '').slice(-10);
        if (fPhone && targetPhoneDigits && fPhone === targetPhoneDigits) {
          return false;
        }
        return true;
      });

      this.set('followups', remaining);
    } catch (e) {
      console.error('Error in purgeFollowupsForContact:', e);
    }
  }

  // Projects
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

  // Plots
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

  // Site Visits
  getSiteVisits(companyId?: string): SiteVisit[] {
    const visits = this.get<SiteVisit[]>('site_visits', []);
    return companyId ? visits.filter(v => matchesMockTenant(v.companyId, companyId)) : visits;
  }

  saveSiteVisit(siteVisit: SiteVisit): void {
    const visits = this.getSiteVisits();
    const index = visits.findIndex(v => v.id === siteVisit.id);
    if (index >= 0) {
      visits[index] = siteVisit;
    } else {
      visits.unshift(siteVisit);
    }
    this.set('site_visits', visits);
  }

  // Bookings
  getBookings(companyId?: string): Booking[] {
    const bookings = this.get<Booking[]>('bookings', []);
    return companyId ? bookings.filter(b => matchesMockTenant(b.companyId, companyId)) : bookings;
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

  // Investors
  getInvestors(companyId?: string): Investor[] {
    let investors = this.get<Investor[]>('investors', INITIAL_INVESTORS);
    if (!investors || investors.length === 0) {
      investors = INITIAL_INVESTORS;
    } else {
      const existingIds = new Set(investors.map(i => i.id));
      const missing = INITIAL_INVESTORS.filter(i => !existingIds.has(i.id));
      if (missing.length > 0) {
        investors = [...investors, ...missing];
        this.set('investors', investors);
      }
    }
    return companyId ? investors.filter(i => matchesMockTenant(i.companyId, companyId)) : investors;
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

  // Consultations
  getConsultations(companyId?: string): Consultation[] {
    let consultations = this.get<Consultation[]>('consultations', INITIAL_CONSULTATIONS);
    if (!consultations || consultations.length === 0) {
      consultations = INITIAL_CONSULTATIONS;
    } else {
      const existingIds = new Set(consultations.map(c => c.id));
      const missing = INITIAL_CONSULTATIONS.filter(c => !existingIds.has(c.id));
      if (missing.length > 0) {
        consultations = [...consultations, ...missing];
        this.set('consultations', consultations);
      }
    }
    return companyId ? consultations.filter(c => matchesMockTenant(c.companyId, companyId)) : consultations;
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

  // Opportunities
  getOpportunities(companyId?: string): InvestmentOpportunity[] {
    let opps = this.get<InvestmentOpportunity[]>('opportunities', INITIAL_OPPORTUNITIES);
    if (!opps || opps.length === 0) {
      opps = INITIAL_OPPORTUNITIES;
    } else {
      const existingIds = new Set(opps.map(o => o.id));
      const missing = INITIAL_OPPORTUNITIES.filter(o => !existingIds.has(o.id));
      if (missing.length > 0) {
        opps = [...opps, ...missing];
        this.set('opportunities', opps);
      }
    }
    return companyId ? opps.filter(o => matchesMockTenant(o.companyId, companyId)) : opps;
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

  // Audit Logs
  getAuditLogs(companyId?: string): AuditLog[] {
    const logs = this.get<AuditLog[]>('audit_logs', []);
    return companyId ? logs.filter(l => !l.companyId || matchesMockTenant(l.companyId, companyId)) : logs;
  }

  addAuditLog(log: AuditLog): void {
    const logs = this.getAuditLogs();
    logs.unshift(log);
    this.set('audit_logs', logs);
  }

  // Notifications
  getNotifications(): NotificationItem[] {
    return this.get<NotificationItem[]>('notifications', []);
  }

  addNotification(notification: NotificationItem): void {
    const notifs = this.getNotifications();
    notifs.unshift(notification);
    this.set('notifications', notifs);
  }

  markNotificationRead(id: string): void {
    const notifs = this.getNotifications();
    const notif = notifs.find(n => n.id === id);
    if (notif) {
      notif.read = true;
      this.set('notifications', notifs);
    }
  }

  markAllNotificationsRead(): void {
    const notifs = this.getNotifications().map(n => ({ ...n, read: true }));
    this.set('notifications', notifs);
  }

  // Documents
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
    const depts = this.get<Department[]>('departments', []);
    return companyId ? depts.filter(d => matchesMockTenant(d.companyId, companyId)) : depts;
  }

  saveDepartment(dept: Department): void {
    const depts = this.getDepartments();
    const index = depts.findIndex(d => d.id === dept.id);
    if (index >= 0) {
      depts[index] = dept;
    } else {
      depts.push(dept);
    }
    this.set('departments', depts);
  }

  deleteDepartment(id: string): void {
    const depts = this.getDepartments().filter(d => d.id !== id);
    this.set('departments', depts);
  }

  // Teams
  getTeams(companyId?: string): Team[] {
    const teams = this.get<Team[]>('teams', []);
    return companyId ? teams.filter(t => matchesMockTenant(t.companyId, companyId)) : teams;
  }

  saveTeam(team: Team): void {
    const teams = this.getTeams();
    const index = teams.findIndex(t => t.id === team.id);
    if (index >= 0) {
      teams[index] = team;
    } else {
      teams.push(team);
    }
    this.set('teams', teams);
  }

  deleteTeam(id: string): void {
    const teams = this.getTeams().filter(t => t.id !== id);
    this.set('teams', teams);
  }

  // Queues
  getQueues(companyId?: string): Queue[] {
    const queues = this.get<Queue[]>('queues', []);
    return companyId ? queues.filter(q => matchesMockTenant(q.companyId, companyId)) : queues;
  }

  saveQueue(queue: Queue): void {
    const queues = this.getQueues();
    const index = queues.findIndex(q => q.id === queue.id);
    if (index >= 0) {
      queues[index] = queue;
    } else {
      queues.push(queue);
    }
    this.set('queues', queues);
  }

  deleteQueue(id: string): void {
    const queues = this.getQueues().filter(q => q.id !== id);
    this.set('queues', queues);
  }

  // Routing Rules
  getRoutingRules(companyId?: string): RoutingRule[] {
    const rules = this.get<RoutingRule[]>('routing_rules', []);
    return companyId ? rules.filter(r => matchesMockTenant(r.companyId, companyId)) : rules;
  }

  saveRoutingRule(rule: RoutingRule): void {
    const rules = this.getRoutingRules();
    const index = rules.findIndex(r => r.id === rule.id);
    if (index >= 0) {
      rules[index] = rule;
    } else {
      rules.push(rule);
    }
    this.set('routing_rules', rules);
  }

  deleteRoutingRule(id: string): void {
    const rules = this.getRoutingRules().filter(r => r.id !== id);
    this.set('routing_rules', rules);
  }

  // Lead Assignments
  getLeadAssignments(companyId?: string): LeadAssignment[] {
    const assignments = this.get<LeadAssignment[]>('lead_assignments', []);
    return companyId ? assignments.filter(a => matchesMockTenant(a.companyId, companyId)) : assignments;
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
    return companyId ? presences.filter(p => matchesMockTenant(p.companyId, companyId)) : presences;
  }

  setAgentPresence(presence: AgentPresence): void {
    const presences = this.getAgentPresence();
    const index = presences.findIndex(
      p => (presence.id && p.id === presence.id) || (presence.userId && p.userId === presence.userId)
    );
    if (index >= 0) {
      presences[index] = presence;
    } else {
      presences.push(presence);
    }
    this.set('agent_presence', presences);
  }

  saveAgentPresence(presence: AgentPresence): void {
    this.setAgentPresence(presence);
  }

  // Routing Attempts
  getRoutingAttempts(companyId?: string): RoutingAttempt[] {
    const attempts = this.get<RoutingAttempt[]>('routing_attempts', []);
    return companyId ? attempts.filter(a => matchesMockTenant(a.companyId, companyId)) : attempts;
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
    const definitions = this.get<CustomFieldDefinition[]>('custom_field_definitions', INITIAL_CUSTOM_FIELD_DEFINITIONS);
    if (!companyId) return definitions;
    return definitions.filter(d => matchesMockTenant(d.companyId, companyId));
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
    return companyId ? items.filter(p => matchesMockTenant(p.companyId, companyId)) : items;
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

  // IRMs
  getAvailableIrms(): Array<{ name: string; status: string }> {
    return MOCK_IRMS;
  }

  // Roles
  getRoles(): Record<string, Role> {
    return MOCK_ROLES;
  }

  // Reset mock data
  resetData(): void {
    assertMockMode('resetData');
    // Clear only keys starting with nexus_mock_ or legacy nexus_
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('nexus_mock_') || key.startsWith('nexus_'))) {
        // Do not clear UI preferences like popup position
        if (!key.includes('popup_position') && !key.includes('call_preferences')) {
          keysToRemove.push(key);
        }
      }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
    window.dispatchEvent(new Event('nexus_storage_updated'));
    window.dispatchEvent(new Event('nexus_mock_storage_updated'));
  }
}

export const mockStorageAdapter = new MockStorageAdapter();
