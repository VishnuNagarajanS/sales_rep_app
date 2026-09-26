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
  Role,
} from '../types';
import { isMockMode } from '../mock/runtime/mockConfig';
import { mockStorageAdapter } from '../mock/runtime/mockStorageAdapter';
import { mockBootstrap } from '../mock/runtime/mockBootstrap';

export type PopupPosition = 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';

class StorageService {
  constructor() {
    if (isMockMode()) {
      mockStorageAdapter.runLeadsDedupMigration();
    }
  }

  private getDevKey(key: string): string {
    return `nexus_dev_${key}`;
  }

  private get<T>(key: string, fallback: T): T {
    try {
      const data = localStorage.getItem(this.getDevKey(key));
      return data ? JSON.parse(data) : fallback;
    } catch {
      return fallback;
    }
  }

  private set<T>(key: string, value: T): void {
    try {
      localStorage.setItem(this.getDevKey(key), JSON.stringify(value));
      window.dispatchEvent(new Event('nexus_storage_updated'));
    } catch (e) {
      console.error('Failed to save to localStorage', e);
    }
  }

  // Tenants
  getTenants(): Tenant[] {
    if (isMockMode()) {
      return mockStorageAdapter.getTenants();
    }
    return this.get<Tenant[]>('tenants', []);
  }

  saveTenant(tenant: Tenant): void {
    if (isMockMode()) {
      mockStorageAdapter.saveTenant(tenant);
      return;
    }
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
    if (isMockMode()) {
      return mockStorageAdapter.getUsers(companySlug);
    }
    const users = this.get<User[]>('users', []);
    return companySlug ? users.filter(u => u.companySlug === companySlug) : users;
  }

  saveUser(user: User): void {
    if (isMockMode()) {
      mockStorageAdapter.saveUser(user);
      return;
    }
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
    if (isMockMode()) {
      mockStorageAdapter.deleteUser(id);
      return;
    }
    const users = this.getUsers().filter(u => u.id !== id);
    this.set('users', users);
  }

  // Leads
  getLeads(companyId?: string): Lead[] {
    if (isMockMode()) {
      return mockStorageAdapter.getLeads(companyId);
    }
    const leads = this.get<Lead[]>('leads', []);
    return companyId ? leads.filter(l => l.companyId === companyId) : leads;
  }

  findLeadByPhone(phone: string, companyId?: string): Lead | undefined {
    if (isMockMode()) {
      return mockStorageAdapter.findLeadByPhone(phone, companyId);
    }
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
      mockStorageAdapter.saveLead(lead);
      return;
    }
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
    if (isMockMode()) {
      mockStorageAdapter.deleteLead(id);
      return;
    }
    const leads = this.getLeads().filter(l => l.id !== id);
    this.set('leads', leads);
  }

  cleanupDuplicateLeads(companyId?: string): { removedCount: number } {
    if (isMockMode()) {
      return mockStorageAdapter.cleanupDuplicateLeads(companyId);
    }
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
      console.error('Error during cleanupDuplicateLeads:', e);
      return { removedCount: 0 };
    }
  }

  // Customers
  getCustomers(companyId?: string): Customer[] {
    if (isMockMode()) {
      return mockStorageAdapter.getCustomers(companyId);
    }
    const customers = this.get<Customer[]>('customers', []);
    return companyId ? customers.filter(c => c.companyId === companyId) : customers;
  }

  findCustomerByPhone(phone: string, companyId?: string): Customer | undefined {
    if (isMockMode()) {
      return mockStorageAdapter.findCustomerByPhone(phone, companyId);
    }
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
    if (isMockMode()) {
      mockStorageAdapter.saveCustomer(customer);
      return;
    }
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
    if (isMockMode()) {
      mockStorageAdapter.deleteCustomer(id);
      return;
    }
    const customers = this.getCustomers().filter(c => c.id !== id);
    this.set('customers', customers);
  }

  // Deals
  getDeals(companyId?: string): Deal[] {
    if (isMockMode()) {
      return mockStorageAdapter.getDeals(companyId);
    }
    const deals = this.get<Deal[]>('deals', []);
    return companyId ? deals.filter(d => d.companyId === companyId) : deals;
  }

  saveDeal(deal: Deal): void {
    if (isMockMode()) {
      mockStorageAdapter.saveDeal(deal);
      return;
    }
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
    if (isMockMode()) {
      mockStorageAdapter.deleteDeal(id);
      return;
    }
    const deals = this.getDeals().filter(d => d.id !== id);
    this.set('deals', deals);
  }

  // Calls
  getCalls(companyId?: string): CallRecord[] {
    if (isMockMode()) {
      return mockStorageAdapter.getCalls(companyId);
    }
    const calls = this.get<CallRecord[]>('calls', []);
    return companyId ? calls.filter(c => c.companyId === companyId) : calls;
  }

  addCall(call: CallRecord): void {
    if (isMockMode()) {
      mockStorageAdapter.addCall(call);
      return;
    }
    const calls = this.getCalls();
    calls.unshift(call);
    this.set('calls', calls);
  }

  deleteCall(id: string): void {
    if (isMockMode()) {
      mockStorageAdapter.deleteCall(id);
      return;
    }
    const calls = this.getCalls().filter(c => c.id !== id);
    this.set('calls', calls);
  }

  // Followups
  getFollowups(companyId?: string): Followup[] {
    if (isMockMode()) {
      return mockStorageAdapter.getFollowups(companyId);
    }
    const followups = this.get<Followup[]>('followups', []);
    return companyId ? followups.filter(f => f.companyId === companyId) : followups;
  }

  saveFollowup(followup: Followup): void {
    if (isMockMode()) {
      mockStorageAdapter.saveFollowup(followup);
      return;
    }
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
    if (isMockMode()) {
      mockStorageAdapter.deleteFollowup(id);
      return;
    }
    const followups = this.getFollowups().filter(f => f.id !== id);
    this.set('followups', followups);
  }

  cleanupGhlPendingFollowups(companyId?: string): void {
    if (isMockMode()) {
      mockStorageAdapter.cleanupGhlPendingFollowups(companyId);
      return;
    }
  }

  purgeFollowupsForContact(
    companyId: string,
    contactId?: string | null,
    contactPhone?: string | null
  ): void {
    if (isMockMode()) {
      mockStorageAdapter.purgeFollowupsForContact(companyId, contactId, contactPhone);
      return;
    }
    const allFollowups = this.get<Followup[]>('followups', []) || [];
    const targetPhoneDigits = (contactPhone || '').replace(/\D/g, '').slice(-10);
    const remaining = allFollowups.filter(f => {
      if (f.companyId !== companyId || f.status !== 'Pending') return true;
      if (contactId && contactId !== 'contact-new' && f.contactId === contactId) return false;
      const fPhone = (f.contactPhone || '').replace(/\D/g, '').slice(-10);
      if (fPhone && targetPhoneDigits && fPhone === targetPhoneDigits) return false;
      return true;
    });
    this.set('followups', remaining);
  }

  // Projects
  getProjects(): PropertyProject[] {
    if (isMockMode()) {
      return mockStorageAdapter.getProjects();
    }
    return this.get<PropertyProject[]>('projects', []);
  }

  saveProject(project: PropertyProject): void {
    if (isMockMode()) {
      mockStorageAdapter.saveProject(project);
      return;
    }
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
    if (isMockMode()) {
      return mockStorageAdapter.getPlots(projectId);
    }
    const plots = this.get<Plot[]>('plots', []);
    return projectId ? plots.filter(p => p.projectId === projectId) : plots;
  }

  savePlot(plot: Plot): void {
    if (isMockMode()) {
      mockStorageAdapter.savePlot(plot);
      return;
    }
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
    if (isMockMode()) {
      return mockStorageAdapter.getSiteVisits(companyId);
    }
    const visits = this.get<SiteVisit[]>('site_visits', []);
    return companyId ? visits.filter(v => v.companyId === companyId) : visits;
  }

  saveSiteVisit(siteVisit: SiteVisit): void {
    if (isMockMode()) {
      mockStorageAdapter.saveSiteVisit(siteVisit);
      return;
    }
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
    if (isMockMode()) {
      return mockStorageAdapter.getBookings(companyId);
    }
    const bookings = this.get<Booking[]>('bookings', []);
    return companyId ? bookings.filter(b => b.companyId === companyId) : bookings;
  }

  saveBooking(booking: Booking): void {
    if (isMockMode()) {
      mockStorageAdapter.saveBooking(booking);
      return;
    }
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
    if (isMockMode()) {
      return mockStorageAdapter.getInvestors(companyId);
    }
    const investors = this.get<Investor[]>('investors', []);
    return companyId ? investors.filter(i => i.companyId === companyId) : investors;
  }

  saveInvestor(investor: Investor): void {
    if (isMockMode()) {
      mockStorageAdapter.saveInvestor(investor);
      return;
    }
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
    if (isMockMode()) {
      mockStorageAdapter.deleteInvestor(id);
      return;
    }
    const investors = this.getInvestors().filter(i => i.id !== id);
    this.set('investors', investors);
  }

  // Consultations
  getConsultations(companyId?: string): Consultation[] {
    if (isMockMode()) {
      return mockStorageAdapter.getConsultations(companyId);
    }
    const consultations = this.get<Consultation[]>('consultations', []);
    return companyId ? consultations.filter(c => c.companyId === companyId) : consultations;
  }

  saveConsultation(consultation: Consultation): void {
    if (isMockMode()) {
      mockStorageAdapter.saveConsultation(consultation);
      return;
    }
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
    if (isMockMode()) {
      mockStorageAdapter.deleteConsultation(id);
      return;
    }
    const consultations = this.getConsultations().filter(c => c.id !== id);
    this.set('consultations', consultations);
  }

  // Opportunities
  getOpportunities(companyId?: string): InvestmentOpportunity[] {
    if (isMockMode()) {
      return mockStorageAdapter.getOpportunities(companyId);
    }
    const opps = this.get<InvestmentOpportunity[]>('opportunities', []);
    return companyId ? opps.filter(o => o.companyId === companyId) : opps;
  }

  saveOpportunity(opportunity: InvestmentOpportunity): void {
    if (isMockMode()) {
      mockStorageAdapter.saveOpportunity(opportunity);
      return;
    }
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
    if (isMockMode()) {
      mockStorageAdapter.deleteOpportunity(id);
      return;
    }
    const opps = this.getOpportunities().filter(o => o.id !== id);
    this.set('opportunities', opps);
  }

  // Audit Logs
  getAuditLogs(companyId?: string): AuditLog[] {
    if (isMockMode()) {
      return mockStorageAdapter.getAuditLogs(companyId);
    }
    const logs = this.get<AuditLog[]>('audit_logs', []);
    return companyId ? logs.filter(l => !l.companyId || l.companyId === companyId) : logs;
  }

  addAuditLog(log: AuditLog): void {
    if (isMockMode()) {
      mockStorageAdapter.addAuditLog(log);
      return;
    }
    const logs = this.getAuditLogs();
    logs.unshift(log);
    this.set('audit_logs', logs);
  }

  // Notifications
  getNotifications(): NotificationItem[] {
    if (isMockMode()) {
      return mockStorageAdapter.getNotifications();
    }
    return this.get<NotificationItem[]>('notifications', []);
  }

  addNotification(notification: NotificationItem): void {
    if (isMockMode()) {
      mockStorageAdapter.addNotification(notification);
      return;
    }
    const notifs = this.getNotifications();
    notifs.unshift(notification);
    this.set('notifications', notifs);
  }

  markNotificationRead(id: string): void {
    if (isMockMode()) {
      mockStorageAdapter.markNotificationRead(id);
      return;
    }
    const notifs = this.getNotifications();
    const notif = notifs.find(n => n.id === id);
    if (notif) {
      notif.read = true;
      this.set('notifications', notifs);
    }
  }

  markAllNotificationsRead(): void {
    if (isMockMode()) {
      mockStorageAdapter.markAllNotificationsRead();
      return;
    }
    const notifs = this.getNotifications().map(n => ({ ...n, read: true }));
    this.set('notifications', notifs);
  }

  // Documents
  getDocuments(entityType?: string, entityId?: string): DocumentItem[] {
    if (isMockMode()) {
      return mockStorageAdapter.getDocuments(entityType, entityId);
    }
    const docs = this.get<DocumentItem[]>('documents', []);
    return docs.filter(d => {
      if (entityType && d.entityType !== entityType) return false;
      if (entityId && d.entityId !== entityId) return false;
      return true;
    });
  }

  saveDocument(doc: DocumentItem): void {
    if (isMockMode()) {
      mockStorageAdapter.saveDocument(doc);
      return;
    }
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
    if (isMockMode()) {
      mockStorageAdapter.deleteDocument(id);
      return;
    }
    const docs = this.get<DocumentItem[]>('documents', []).filter(d => d.id !== id);
    this.set('documents', docs);
  }

  // Departments
  getDepartments(companyId?: string): Department[] {
    if (isMockMode()) {
      return mockStorageAdapter.getDepartments(companyId);
    }
    const depts = this.get<Department[]>('departments', []);
    return companyId ? depts.filter(d => d.companyId === companyId) : depts;
  }

  saveDepartment(dept: Department): void {
    if (isMockMode()) {
      mockStorageAdapter.saveDepartment(dept);
      return;
    }
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
    if (isMockMode()) {
      mockStorageAdapter.deleteDepartment(id);
      return;
    }
    const depts = this.getDepartments().filter(d => d.id !== id);
    this.set('departments', depts);
  }

  // Teams
  getTeams(companyId?: string): Team[] {
    if (isMockMode()) {
      return mockStorageAdapter.getTeams(companyId);
    }
    const teams = this.get<Team[]>('teams', []);
    return companyId ? teams.filter(t => t.companyId === companyId) : teams;
  }

  saveTeam(team: Team): void {
    if (isMockMode()) {
      mockStorageAdapter.saveTeam(team);
      return;
    }
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
    if (isMockMode()) {
      mockStorageAdapter.deleteTeam(id);
      return;
    }
    const teams = this.getTeams().filter(t => t.id !== id);
    this.set('teams', teams);
  }

  // Queues
  getQueues(companyId?: string): Queue[] {
    if (isMockMode()) {
      return mockStorageAdapter.getQueues(companyId);
    }
    const queues = this.get<Queue[]>('queues', []);
    return companyId ? queues.filter(q => q.companyId === companyId) : queues;
  }

  saveQueue(queue: Queue): void {
    if (isMockMode()) {
      mockStorageAdapter.saveQueue(queue);
      return;
    }
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
    if (isMockMode()) {
      mockStorageAdapter.deleteQueue(id);
      return;
    }
    const queues = this.getQueues().filter(q => q.id !== id);
    this.set('queues', queues);
  }

  // Routing Rules
  getRoutingRules(companyId?: string): RoutingRule[] {
    if (isMockMode()) {
      return mockStorageAdapter.getRoutingRules(companyId);
    }
    const rules = this.get<RoutingRule[]>('routing_rules', []);
    return companyId ? rules.filter(r => r.companyId === companyId) : rules;
  }

  saveRoutingRule(rule: RoutingRule): void {
    if (isMockMode()) {
      mockStorageAdapter.saveRoutingRule(rule);
      return;
    }
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
    if (isMockMode()) {
      mockStorageAdapter.deleteRoutingRule(id);
      return;
    }
    const rules = this.getRoutingRules().filter(r => r.id !== id);
    this.set('routing_rules', rules);
  }

  // Lead Assignments
  getLeadAssignments(companyId?: string): LeadAssignment[] {
    if (isMockMode()) {
      return mockStorageAdapter.getLeadAssignments(companyId);
    }
    const assignments = this.get<LeadAssignment[]>('lead_assignments', []);
    return companyId ? assignments.filter(a => a.companyId === companyId) : assignments;
  }

  saveLeadAssignment(assignment: LeadAssignment): void {
    if (isMockMode()) {
      mockStorageAdapter.saveLeadAssignment(assignment);
      return;
    }
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
    if (isMockMode()) {
      return mockStorageAdapter.getAgentPresence(companyId);
    }
    const presences = this.get<AgentPresence[]>('agent_presence', []);
    return companyId ? presences.filter(p => p.companyId === companyId) : presences;
  }

  setAgentPresence(presence: AgentPresence): void {
    if (isMockMode()) {
      mockStorageAdapter.setAgentPresence(presence);
      return;
    }
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
    if (isMockMode()) {
      return mockStorageAdapter.getRoutingAttempts(companyId);
    }
    const attempts = this.get<RoutingAttempt[]>('routing_attempts', []);
    return companyId ? attempts.filter(a => a.companyId === companyId) : attempts;
  }

  saveRoutingAttempt(attempt: RoutingAttempt): void {
    if (isMockMode()) {
      mockStorageAdapter.saveRoutingAttempt(attempt);
      return;
    }
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
    if (isMockMode()) {
      return mockStorageAdapter.getCustomFieldDefinitions(companyId);
    }
    const definitions = this.get<CustomFieldDefinition[]>('custom_field_definitions', []);
    if (!companyId) return definitions;
    return definitions.filter(d => d.companyId === companyId);
  }

  saveCustomFieldDefinition(def: CustomFieldDefinition): void {
    if (isMockMode()) {
      mockStorageAdapter.saveCustomFieldDefinition(def);
      return;
    }
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
    if (isMockMode()) {
      return mockStorageAdapter.getProductsServices(companyId);
    }
    const items = this.get<ProductService[]>('products_services', []);
    return companyId ? items.filter(p => p.companyId === companyId) : items;
  }

  saveProductService(productService: ProductService): void {
    if (isMockMode()) {
      mockStorageAdapter.saveProductService(productService);
      return;
    }
    const items = this.getProductsServices();
    const index = items.findIndex(p => p.id === productService.id);
    if (index >= 0) {
      items[index] = productService;
    } else {
      items.unshift(productService);
    }
    this.set('products_services', items);
  }

  // Optional: Explicitly populate demo mock data
  async loadMockDataFromSeparateFolder(): Promise<void> {
    if (isMockMode()) {
      mockBootstrap(true);
    }
  }

  // Incoming Call Popup Position (Device UI Preference)
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

  // Call Preferences (Device UI Preference)
  getCallPreferences(): {
    soundEnabled: boolean;
    desktopNotifEnabled: boolean;
    autoBusyEnabled: boolean;
    defaultFollowupTime: string;
  } {
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
    this.set('call_preferences', { ...existing, ...prefs });
  }

  // IRMs
  getAvailableIrms(): Array<{ name: string; status: string }> {
    if (isMockMode()) {
      return mockStorageAdapter.getAvailableIrms();
    }
    const users = this.getUsers();
    return users
      .filter(u => u.role?.code === 'irm' || u.role?.code === 'sales_executive' || u.role?.code === 'company_admin')
      .map(u => ({ name: u.name, status: 'Available' }));
  }

  // Roles
  getRoles(): Record<string, Role> {
    if (isMockMode()) {
      return mockStorageAdapter.getRoles();
    }
    const rolesList = this.get<Role[]>('roles', []);
    const rolesRecord: Record<string, Role> = {};
    rolesList.forEach(r => {
      rolesRecord[r.code] = r;
    });
    return rolesRecord;
  }

  // Reset Data
  resetData(): void {
    if (isMockMode()) {
      mockStorageAdapter.resetData();
    } else {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('nexus_dev_')) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
      window.dispatchEvent(new Event('nexus_storage_updated'));
    }
  }
}

export const storageService = new StorageService();
