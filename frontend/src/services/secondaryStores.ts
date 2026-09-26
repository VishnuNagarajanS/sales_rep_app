/**
 * secondaryStores.ts
 * In-memory reactive stores for secondary and operational entities that do not
 * currently have tables in the Neon PostgreSQL database.
 *
 * All primary CRM business data (Leads, Customers, Follow-ups, Consultations,
 * Calls, and Auth) is routed through the real ASP.NET Core backend APIs via crmApi.ts.
 */

import {
  Deal,
  PropertyProject,
  Plot,
  SiteVisit,
  Booking,
  InvestmentOpportunity,
  AuditLog,
  NotificationItem,
  User,
  Tenant,
} from '../types';
import { DEFAULT_TENANTS } from '../constants/defaultTenants';

export type PopupPosition = 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';

export interface CallPreferences {
  soundEnabled: boolean;
  desktopNotifEnabled: boolean;
  autoBusyEnabled: boolean;
  defaultFollowupTime: string;
}

const notifyUpdated = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('nexus_storage_updated'));
  }
};

// ── 1. Deals Store ──────────────────────────────────────────────────────────
let dealsMemory: Deal[] = [];

export const dealStore = {
  getDeals(companyId?: string): Deal[] {
    return companyId ? dealsMemory.filter(d => d.companyId === companyId) : [...dealsMemory];
  },
  saveDeal(deal: Deal): void {
    const idx = dealsMemory.findIndex(d => d.id === deal.id);
    if (idx >= 0) {
      dealsMemory[idx] = deal;
    } else {
      dealsMemory.unshift(deal);
    }
    notifyUpdated();
  },
  deleteDeal(id: string): void {
    dealsMemory = dealsMemory.filter(d => d.id !== id);
    notifyUpdated();
  },
};

// ── 2. Investment Opportunities Store ───────────────────────────────────────
let oppsMemory: InvestmentOpportunity[] = [];

export const opportunityStore = {
  getOpportunities(companyId?: string): InvestmentOpportunity[] {
    return companyId ? oppsMemory.filter(o => o.companyId === companyId) : [...oppsMemory];
  },
  saveOpportunity(opp: InvestmentOpportunity): void {
    const idx = oppsMemory.findIndex(o => o.id === opp.id);
    if (idx >= 0) {
      oppsMemory[idx] = opp;
    } else {
      oppsMemory.unshift(opp);
    }
    notifyUpdated();
  },
  deleteOpportunity(id: string): void {
    oppsMemory = oppsMemory.filter(o => o.id !== id);
    notifyUpdated();
  },
};

// ── 3. Site Visits Store ───────────────────────────────────────────────────
let siteVisitsMemory: SiteVisit[] = [];

export const siteVisitStore = {
  getSiteVisits(companyId?: string): SiteVisit[] {
    return companyId ? siteVisitsMemory.filter(v => v.companyId === companyId) : [...siteVisitsMemory];
  },
  saveSiteVisit(visit: SiteVisit): void {
    const idx = siteVisitsMemory.findIndex(v => v.id === visit.id);
    if (idx >= 0) {
      siteVisitsMemory[idx] = visit;
    } else {
      siteVisitsMemory.unshift(visit);
    }
    notifyUpdated();
  },
  deleteSiteVisit(id: string): void {
    siteVisitsMemory = siteVisitsMemory.filter(v => v.id !== id);
    notifyUpdated();
  },
};

// ── 4. Plots & Projects Store ──────────────────────────────────────────────
let projectsMemory: PropertyProject[] = [];
let plotsMemory: Plot[] = [];

export const plotStore = {
  getProjects(): PropertyProject[] {
    return [...projectsMemory];
  },
  saveProject(project: PropertyProject): void {
    const idx = projectsMemory.findIndex(p => p.id === project.id);
    if (idx >= 0) {
      projectsMemory[idx] = project;
    } else {
      projectsMemory.push(project);
    }
    notifyUpdated();
  },
  getPlots(projectId?: string): Plot[] {
    return projectId ? plotsMemory.filter(p => p.projectId === projectId) : [...plotsMemory];
  },
  savePlot(plot: Plot): void {
    const idx = plotsMemory.findIndex(p => p.id === plot.id);
    if (idx >= 0) {
      plotsMemory[idx] = plot;
    } else {
      plotsMemory.push(plot);
    }
    notifyUpdated();
  },
};

// ── 5. Bookings Store ──────────────────────────────────────────────────────
let bookingsMemory: Booking[] = [];

export const bookingStore = {
  getBookings(companyId?: string): Booking[] {
    return companyId ? bookingsMemory.filter(b => b.companyId === companyId) : [...bookingsMemory];
  },
  saveBooking(booking: Booking): void {
    const idx = bookingsMemory.findIndex(b => b.id === booking.id);
    if (idx >= 0) {
      bookingsMemory[idx] = booking;
    } else {
      bookingsMemory.unshift(booking);
    }
    notifyUpdated();
  },
};

// ── 6. Audit Logs Store ────────────────────────────────────────────────────
let auditLogsMemory: AuditLog[] = [];

export const auditLogStore = {
  getAuditLogs(companyId?: string): AuditLog[] {
    return companyId ? auditLogsMemory.filter(l => !l.companyId || l.companyId === companyId) : [...auditLogsMemory];
  },
  addAuditLog(log: AuditLog): void {
    auditLogsMemory.unshift(log);
    notifyUpdated();
  },
};

// ── 7. Notifications Store ─────────────────────────────────────────────────
let notificationsMemory: NotificationItem[] = [];

export const notificationStore = {
  getNotifications(): NotificationItem[] {
    return [...notificationsMemory];
  },
  markNotificationRead(id: string): void {
    const found = notificationsMemory.find(n => n.id === id);
    if (found) {
      found.read = true;
      notifyUpdated();
    }
  },
  markAllNotificationsRead(): void {
    notificationsMemory = notificationsMemory.map(n => ({ ...n, read: true }));
    notifyUpdated();
  },
};

// ── 8. Users Store ─────────────────────────────────────────────────────────
// Default initial user seed matching active DB accounts
let usersMemory: User[] = [
  {
    id: 'usr-ananya',
    name: 'Ananya Sharma',
    email: 'ananya@ghlindiatrust.com',
    phone: '+91 98765 43210',
    companyId: 't-ghl-01',
    companySlug: 'ghl',
    companyName: 'GHL India Ventures',
    role: { id: 'r-sales-exec', name: 'Sales Executive', code: 'sales_executive', permissions: [] },
    status: 'Active',
    lastLogin: 'Just now',
  },
  {
    id: 'usr-vikram',
    name: 'Vikram Mehta',
    email: 'vikram@ghlindiatrust.com',
    phone: '+91 98765 43211',
    companyId: 't-ghl-01',
    companySlug: 'ghl',
    companyName: 'GHL India Ventures',
    role: { id: 'r-cadmin', name: 'Company Admin', code: 'company_admin', permissions: [] },
    status: 'Active',
    lastLogin: 'Today',
  },
  {
    id: 'usr-kavita',
    name: 'Kavita Iyer',
    email: 'kavita@jaminbazaar.com',
    phone: '+91 98765 43212',
    companyId: 't-jamin-02',
    companySlug: 'jamin',
    companyName: 'Jamin Bazaar',
    role: { id: 'r-sales-exec', name: 'Sales Executive', code: 'sales_executive', permissions: [] },
    status: 'Active',
    lastLogin: 'Just now',
  },
  {
    id: 'usr-alex',
    name: 'Alex Rivera',
    email: 'alex@nexusplatform.io',
    phone: '+91 98765 43213',
    role: { id: 'r-super-admin', name: 'Platform Admin', code: 'super_admin', permissions: [] },
    status: 'Active',
    lastLogin: 'Today',
  },
];

export const userStore = {
  getUsers(companySlug?: string): User[] {
    return companySlug ? usersMemory.filter(u => u.companySlug === companySlug) : [...usersMemory];
  },
  saveUser(user: User): void {
    const idx = usersMemory.findIndex(u => u.id === user.id);
    if (idx >= 0) {
      usersMemory[idx] = user;
    } else {
      usersMemory.push(user);
    }
    notifyUpdated();
  },
  deleteUser(id: string): void {
    usersMemory = usersMemory.filter(u => u.id !== id);
    notifyUpdated();
  },
};

// ── 9. Tenants Store ───────────────────────────────────────────────────────
let tenantsMemory: Tenant[] = Object.values(DEFAULT_TENANTS);

export const tenantStore = {
  getTenants(): Tenant[] {
    return [...tenantsMemory];
  },
  saveTenant(tenant: Tenant): void {
    const idx = tenantsMemory.findIndex(t => t.id === tenant.id);
    if (idx >= 0) {
      tenantsMemory[idx] = tenant;
    } else {
      tenantsMemory.push(tenant);
    }
    notifyUpdated();
  },
};

// ── 10. UI Preferences (Stored in localStorage purely for client appearance) ─
export const preferenceStore = {
  getPopupPosition(): PopupPosition {
    try {
      const data = localStorage.getItem('nexus_popup_position');
      if (data) {
        if (['top-right', 'top-left', 'bottom-right', 'bottom-left'].includes(data)) {
          return data as PopupPosition;
        }
        const parsed = JSON.parse(data);
        if (['top-right', 'top-left', 'bottom-right', 'bottom-left'].includes(parsed)) {
          return parsed as PopupPosition;
        }
      }
    } catch {
      // Fall through
    }
    return 'top-right';
  },
  setPopupPosition(pos: PopupPosition): void {
    try {
      localStorage.setItem('nexus_popup_position', JSON.stringify(pos));
      notifyUpdated();
    } catch (e) {
      console.error('Failed to save popup position', e);
    }
  },
  getCallPreferences(): CallPreferences {
    try {
      const data = localStorage.getItem('nexus_call_preferences');
      if (data) return JSON.parse(data);
    } catch {
      // Fall through
    }
    return {
      soundEnabled: true,
      desktopNotifEnabled: false,
      autoBusyEnabled: true,
      defaultFollowupTime: '11:00',
    };
  },
  setCallPreferences(prefs: Partial<CallPreferences>): void {
    try {
      const existing = preferenceStore.getCallPreferences();
      localStorage.setItem('nexus_call_preferences', JSON.stringify({ ...existing, ...prefs }));
      notifyUpdated();
    } catch (e) {
      console.error('Failed to save call preferences', e);
    }
  },
};
