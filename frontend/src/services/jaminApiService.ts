/**
 * jaminApiService.ts
 *
 * Dedicated API service for Jamin Bazaar (Land & Plotted Development Sales).
 * Strictly mirrors the backend controller structure:
 *   - Leads: /api/leads & /api/sales-executive/leads (Common multi-tenant)
 *   - Follow-ups: /api/sales-executive/followups (Common multi-tenant)
 *   - Site Visits: /api/jamin/site-visits (Jamin specific)
 *   - Public Website Intake: /api/leads/website-intake
 *
 * Zero IRM / Private Equity dependencies.
 */

import { apiClient } from './apiClient';
import { storageService } from './storageService';
import type { Lead, SiteVisit, Followup } from '../types';

export interface WalkTheLandBookingPayload {
  name: string;
  phone: string;
  email?: string;
  targetDevelopment: string;
  preferredVisitDate: string;
  preferredTimeSlot: string;
  anythingWeShouldKnow?: string;
}

export interface WebsiteMessageInquiryPayload {
  name: string;
  phone: string;
  email?: string;
  message: string;
  targetDevelopment?: string;
}

export interface CreateJaminLeadPayload {
  name: string;
  phone: string;
  email?: string;
  location?: string;
  source?: string;
  priority?: string;
  targetDevelopment?: string;
  budgetRange?: string;
  notes?: string;
  assignedAgentId?: number;
}

export interface UpdateJaminLeadPayload {
  name?: string;
  phone?: string;
  email?: string;
  location?: string;
  status?: string;
  priority?: string;
  targetDevelopment?: string;
  budgetRange?: string;
  notes?: string;
  assignedAgentId?: number;
}

export interface ScheduleFollowupPayload {
  contactId: string;
  contactName: string;
  contactPhone?: string;
  scheduledAt: string;
  priority?: 'Low' | 'Medium' | 'High';
  notes?: string;
  assignedAgentId?: string;
}

export interface ScheduleSiteVisitPayload {
  leadId?: string | number;
  customerName: string;
  customerPhone: string;
  projectName: string;
  plotNumber?: string;
  scheduledAt: string;
  visitorNote?: string;
  assignedAgentId?: number;
  assignedAgentName?: string;
}

const isMock = () =>
  import.meta.env.VITE_APP_ENV === 'mock' ||
  import.meta.env.VITE_MOCK_AUTH === 'true';

export const jaminApiService = {
  // ── 1. LEADS (COMMON MULTI-TENANT) ──────────────────────────────────────────
  async getLeads(isAdmin: boolean = false, agentId?: number, status?: string): Promise<Lead[]> {
    if (isMock()) {
      const all = storageService.getLeads('t-jamin-02');
      if (isAdmin) return all;
      return all.filter(l => !agentId || l.assignedAgentId === String(agentId) || l.assignedAgentId === 'usr-jamin-exec');
    }
    try {
      const endpoint = isAdmin ? '/api/leads?tenantId=2' : '/api/sales-executive/leads?companyId=2';
      const params = new URLSearchParams();
      if (agentId) params.append('agentId', String(agentId));
      if (status && status !== 'All') params.append('status', status);

      const res = await apiClient.get<any>(`${endpoint}&${params.toString()}`);
      if (res.data?.success && Array.isArray(res.data.data)) {
        return res.data.data.map((l: any) => ({
          id: String(l.id),
          companyId: 't-jamin-02',
          name: l.name,
          phone: l.phone,
          email: l.email || '',
          location: l.location || '',
          source: l.source || 'Website',
          status: l.status || 'New',
          priority: l.priority || 'Medium',
          assignedAgentId: String(l.assignedAgentId || 'usr-jamin-exec'),
          assignedAgentName: l.assignedAgentName || 'Pooja Hegde',
          nextFollowupDate: l.nextFollowupDate ? new Date(l.nextFollowupDate).toLocaleDateString() : undefined,
          targetDevelopment: l.targetDevelopment,
          preferredVisitDate: l.preferredVisitDate,
          preferredTimeSlot: l.preferredTimeSlot,
          anythingWeShouldKnow: l.anythingWeShouldKnow,
          notes: l.notes || '',
          createdAt: l.createdAt ? new Date(l.createdAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
          customFields: {
            budgetRange: l.budgetRange || '',
          },
        }));
      }
    } catch {
      // Fallback
    }
    return storageService.getLeads('t-jamin-02');
  },

  async getLeadDetail(id: string | number): Promise<{ lead: Lead; siteVisits: SiteVisit[]; followups: Followup[] } | null> {
    if (isMock()) {
      const leads = storageService.getLeads('t-jamin-02');
      const lead = leads.find(l => l.id === String(id));
      if (!lead) return null;
      const siteVisits = storageService.getSiteVisits('t-jamin-02').filter(v => v.leadId === String(id) || v.customerId === String(id));
      const followups = storageService.getFollowups('t-jamin-02').filter(f => f.contactId === String(id));
      return { lead, siteVisits, followups };
    }
    try {
      const res = await apiClient.get<any>(`/api/leads/${id}`);
      if (res.data?.success && res.data.data) {
        const d = res.data.data;
        const lead: Lead = {
          id: String(d.id),
          companyId: 't-jamin-02',
          name: d.name,
          phone: d.phone,
          email: d.email || '',
          location: d.location || '',
          source: d.source || 'Website',
          status: d.status || 'New',
          priority: d.priority || 'Medium',
          assignedAgentId: String(d.assignedAgentId || 'usr-jamin-exec'),
          assignedAgentName: d.assignedAgentName || 'Pooja Hegde',
          nextFollowupDate: d.nextFollowupDate,
          targetDevelopment: d.targetDevelopment,
          preferredVisitDate: d.preferredVisitDate,
          preferredTimeSlot: d.preferredTimeSlot,
          anythingWeShouldKnow: d.anythingWeShouldKnow,
          notes: d.notes || '',
          createdAt: d.createdAt,
          customFields: {
            budgetRange: d.budgetRange || '',
          },
        };
        const siteVisits = await this.getSiteVisits(true, undefined, undefined);
        const linkedVisits = siteVisits.filter(v => v.leadId === String(id) || v.customerPhone === lead.phone);
        const followups = await this.getFollowups(true);
        const linkedFollowups = followups.filter(f => f.contactId === String(id) || f.contactPhone === lead.phone);
        return { lead, siteVisits: linkedVisits, followups: linkedFollowups };
      }
    } catch {
      // Fallback
    }
    const leads = storageService.getLeads('t-jamin-02');
    const lead = leads.find(l => l.id === String(id));
    if (!lead) return null;
    const siteVisits = storageService.getSiteVisits('t-jamin-02').filter(v => v.leadId === String(id) || v.customerId === String(id));
    const followups = storageService.getFollowups('t-jamin-02').filter(f => f.contactId === String(id));
    return { lead, siteVisits, followups };
  },

  async createLead(payload: CreateJaminLeadPayload): Promise<Lead> {
    if (isMock()) {
      const newLead: Lead = {
        id: `lead-jam-${Date.now().toString().slice(-4)}`,
        companyId: 't-jamin-02',
        name: payload.name,
        phone: payload.phone,
        email: payload.email || '',
        location: payload.location || payload.targetDevelopment || 'Tamil Nadu',
        source: payload.source || 'Direct Inbound',
        status: 'New',
        priority: (payload.priority as any) || 'Medium',
        assignedAgentId: String(payload.assignedAgentId || 'usr-jamin-exec'),
        assignedAgentName: 'Pooja Hegde',
        createdAt: new Date().toISOString().split('T')[0],
        targetDevelopment: payload.targetDevelopment,
        notes: payload.notes || '',
        customFields: {
          budgetRange: payload.budgetRange || '',
        },
      };
      storageService.addLead(newLead);
      return newLead;
    }
    try {
      const res = await apiClient.post<any>('/api/leads', { ...payload, companyId: 2 });
      if (res.data?.success) {
        const l = res.data.data;
        return {
          id: String(l.id),
          companyId: 't-jamin-02',
          name: l.name,
          phone: l.phone,
          email: l.email,
          location: l.location,
          source: l.source,
          status: l.status,
          priority: l.priority,
          assignedAgentId: String(l.assignedAgentId),
          assignedAgentName: l.assignedAgentName,
          targetDevelopment: l.targetDevelopment,
          notes: l.notes,
          createdAt: l.createdAt,
          customFields: { budgetRange: l.budgetRange },
        };
      }
    } catch {
      // Fallback
    }
    return this.createLead(payload);
  },

  async updateLeadStatus(id: string | number, status: string, notes?: string): Promise<boolean> {
    if (isMock()) {
      const leads = storageService.getLeads('t-jamin-02');
      const lead = leads.find(l => l.id === String(id));
      if (lead) {
        lead.status = status as any;
        if (notes) lead.notes = (lead.notes ? lead.notes + '\n' : '') + notes;
        storageService.saveLead(lead);
        return true;
      }
      return false;
    }
    try {
      const res = await apiClient.put<any>(`/api/leads/${id}`, { status, notes });
      return res.data?.success ?? false;
    } catch {
      return false;
    }
  },

  // ── 2. PUBLIC INTAKE / WEBSITE FORMS ──────────────────────────────────────
  async walkTheLandBooking(payload: WalkTheLandBookingPayload): Promise<{ lead: Lead; siteVisit?: SiteVisit }> {
    if (isMock()) {
      const newLead: Lead = {
        id: `lead-jam-${Date.now().toString().slice(-4)}`,
        companyId: 't-jamin-02',
        name: payload.name,
        phone: payload.phone,
        email: payload.email || '',
        location: payload.targetDevelopment,
        source: 'Website - Site Visit',
        status: 'New',
        priority: 'High',
        assignedAgentId: 'usr-jamin-exec',
        assignedAgentName: 'Pooja Hegde',
        createdAt: new Date().toISOString().split('T')[0],
        targetDevelopment: payload.targetDevelopment,
        preferredVisitDate: payload.preferredVisitDate,
        preferredTimeSlot: payload.preferredTimeSlot,
        anythingWeShouldKnow: payload.anythingWeShouldKnow,
        notes: `Website Intake: Pick a day to walk the land. Target: ${payload.targetDevelopment}. Slot: ${payload.preferredVisitDate} (${payload.preferredTimeSlot}). Note: ${payload.anythingWeShouldKnow || ''}`,
        customFields: {},
      };
      storageService.addLead(newLead);

      const newSiteVisit: SiteVisit = {
        id: `sv-${Date.now().toString().slice(-4)}`,
        companyId: 't-jamin-02',
        leadId: newLead.id,
        customerId: newLead.id,
        customerName: newLead.name,
        customerPhone: newLead.phone,
        projectId: 'proj-02',
        projectName: payload.targetDevelopment,
        plotNumber: 'Layout Tour',
        scheduledAt: `${payload.preferredVisitDate} • ${payload.preferredTimeSlot}`,
        assignedAgentId: 'usr-jamin-exec',
        assignedAgentName: 'Pooja Hegde',
        status: 'Requested',
        contactType: 'lead',
        visitorNote: payload.anythingWeShouldKnow,
        outcomeNotes: 'Walk the Land website booking request received. Call from desk pending to confirm.',
      };
      storageService.addSiteVisit(newSiteVisit);

      return { lead: newLead, siteVisit: newSiteVisit };
    }

    try {
      const res = await apiClient.post<any>('/api/leads/website-intake', {
        tenantId: 2,
        formType: 'site_visit',
        name: payload.name,
        phone: payload.phone,
        email: payload.email,
        targetDevelopment: payload.targetDevelopment,
        preferredVisitDate: payload.preferredVisitDate,
        preferredTimeSlot: payload.preferredTimeSlot,
        anythingWeShouldKnow: payload.anythingWeShouldKnow,
      });
      if (res.data?.success) {
        return this.walkTheLandBooking(payload);
      }
    } catch {
      // Fallback
    }
    return this.walkTheLandBooking(payload);
  },

  async websiteMessageInquiry(payload: WebsiteMessageInquiryPayload): Promise<Lead> {
    if (isMock()) {
      const newLead: Lead = {
        id: `lead-jam-${Date.now().toString().slice(-4)}`,
        companyId: 't-jamin-02',
        name: payload.name,
        phone: payload.phone,
        email: payload.email || '',
        location: payload.targetDevelopment || 'Tamil Nadu',
        source: 'Website - Message',
        status: 'New',
        priority: 'Medium',
        assignedAgentId: 'usr-jamin-exec',
        assignedAgentName: 'Pooja Hegde',
        createdAt: new Date().toISOString().split('T')[0],
        notes: `Website Message Inquiry: ${payload.message}`,
        customFields: {},
      };
      storageService.addLead(newLead);
      return newLead;
    }

    try {
      const res = await apiClient.post<any>('/api/leads/website-intake', {
        tenantId: 2,
        formType: 'callback',
        name: payload.name,
        phone: payload.phone,
        email: payload.email,
        targetDevelopment: payload.targetDevelopment,
        whatAreYouLookingFor: payload.message,
      });
      if (res.data?.success) {
        return this.websiteMessageInquiry(payload);
      }
    } catch {
      // Fallback
    }
    return this.websiteMessageInquiry(payload);
  },

  // ── 3. SITE VISITS (JAMIN DOMAIN) ──────────────────────────────────────────
  async getSiteVisits(isAdmin: boolean = false, agentId?: number, status?: string): Promise<SiteVisit[]> {
    if (isMock()) {
      const visits = storageService.getSiteVisits('t-jamin-02');
      if (isAdmin) return visits;
      return visits.filter(v => !agentId || v.assignedAgentId === String(agentId) || v.assignedAgentId === 'usr-jamin-exec');
    }
    try {
      const params = new URLSearchParams();
      if (agentId) params.append('agentId', String(agentId));
      if (status && status !== 'All') params.append('status', status);

      const res = await apiClient.get<any>(`/api/jamin/site-visits?${params.toString()}`);
      if (res.data?.success && Array.isArray(res.data.data)) {
        return res.data.data.map((sv: any) => ({
          id: String(sv.id),
          companyId: 't-jamin-02',
          leadId: sv.leadId ? String(sv.leadId) : undefined,
          customerId: sv.leadId ? String(sv.leadId) : undefined,
          customerName: sv.customerName,
          customerPhone: sv.customerPhone,
          projectId: sv.projectId ? String(sv.projectId) : 'proj-02',
          projectName: sv.projectName,
          plotNumber: sv.plotNumber || 'Layout Tour',
          scheduledAt: sv.scheduledAt,
          assignedAgentId: String(sv.assignedAgentId || 'usr-jamin-exec'),
          assignedAgentName: sv.assignedAgentName || 'Pooja Hegde',
          status: sv.status,
          contactType: sv.contactType || 'lead',
          visitorNote: sv.visitorNote,
          outcomeNotes: sv.outcomeNotes,
        }));
      }
    } catch {
      // Fallback
    }
    return storageService.getSiteVisits('t-jamin-02');
  },

  async confirmSiteVisit(id: string | number): Promise<boolean> {
    if (isMock()) {
      const visits = storageService.getSiteVisits('t-jamin-02');
      const idx = visits.findIndex(v => v.id === String(id));
      if (idx >= 0) {
        visits[idx].status = 'Scheduled';
        visits[idx].outcomeNotes = 'Site visit confirmed with buyer. Scheduled on calendar.';
        storageService.saveSiteVisits(visits);
        return true;
      }
      return false;
    }
    try {
      const res = await apiClient.put<any>(`/api/jamin/site-visits/${id}/confirm`);
      return res.data?.success ?? false;
    } catch {
      return false;
    }
  },

  async completeSiteVisit(id: string | number, outcomeNotes: string): Promise<boolean> {
    if (isMock()) {
      const visits = storageService.getSiteVisits('t-jamin-02');
      const idx = visits.findIndex(v => v.id === String(id));
      if (idx >= 0) {
        visits[idx].status = 'Completed';
        visits[idx].outcomeNotes = outcomeNotes;
        storageService.saveSiteVisits(visits);
        return true;
      }
      return false;
    }
    try {
      const res = await apiClient.put<any>(`/api/jamin/site-visits/${id}/complete`, { outcomeNotes });
      return res.data?.success ?? false;
    } catch {
      return false;
    }
  },

  // ── 4. FOLLOW-UPS (COMMON MULTI-TENANT) ────────────────────────────────────
  async getFollowups(isAdmin: boolean = false, agentId?: number, status?: string): Promise<Followup[]> {
    if (isMock()) {
      const flws = storageService.getFollowups('t-jamin-02');
      if (isAdmin) return flws;
      return flws.filter(f => !agentId || f.assignedAgentId === String(agentId) || f.assignedAgentId === 'usr-jamin-exec');
    }
    try {
      const params = new URLSearchParams();
      if (agentId) params.append('agentId', String(agentId));
      if (status && status !== 'All') params.append('status', status);

      const res = await apiClient.get<any>(`/api/sales-executive/followups?${params.toString()}`);
      if (res.data?.success && Array.isArray(res.data.data)) {
        return res.data.data.map((f: any) => ({
          id: String(f.id),
          companyId: 't-jamin-02',
          contactId: String(f.contactId),
          contactName: f.contactName,
          contactPhone: f.contactPhone || '',
          contactType: (f.contactType as any) || 'lead',
          scheduledAt: f.scheduledAt ? new Date(f.scheduledAt).toISOString() : new Date().toISOString(),
          priority: (f.priority as any) || 'Medium',
          status: (f.status as any) || 'Pending',
          notes: f.notes || '',
          assignedAgentId: String(f.assignedAgentId || 'usr-jamin-exec'),
          assignedAgentName: f.assignedToName || 'Pooja Hegde',
          assignedRole: 'sales_executive',
        }));
      }
    } catch {
      // Fallback
    }
    return storageService.getFollowups('t-jamin-02');
  },

  async scheduleFollowup(payload: ScheduleFollowupPayload): Promise<Followup> {
    if (isMock()) {
      const newFollowup: Followup = {
        id: `fu-jam-${Date.now().toString().slice(-4)}`,
        companyId: 't-jamin-02',
        contactId: payload.contactId,
        contactName: payload.contactName,
        contactPhone: payload.contactPhone || '',
        contactType: 'lead',
        scheduledAt: payload.scheduledAt,
        priority: payload.priority || 'Medium',
        status: 'Pending',
        notes: payload.notes || 'Follow-up scheduled',
        assignedAgentId: payload.assignedAgentId || 'usr-jamin-exec',
        assignedAgentName: 'Pooja Hegde',
        assignedRole: 'sales_executive',
      };
      storageService.addFollowup(newFollowup);
      return newFollowup;
    }

    try {
      const res = await apiClient.post<any>('/api/sales-executive/followups', {
        contactId: payload.contactId,
        contactType: 'lead',
        contactName: payload.contactName,
        contactPhone: payload.contactPhone,
        scheduledAt: payload.scheduledAt,
        priority: payload.priority,
        notes: payload.notes,
        assignedAgentId: payload.assignedAgentId ? parseInt(payload.assignedAgentId, 10) : 1,
      });
      if (res.data?.success) {
        return {
          id: String(res.data.data?.id || res.data.data),
          companyId: 't-jamin-02',
          contactId: payload.contactId,
          contactName: payload.contactName,
          contactPhone: payload.contactPhone || '',
          contactType: 'lead',
          scheduledAt: payload.scheduledAt,
          priority: payload.priority || 'Medium',
          status: 'Pending',
          notes: payload.notes || '',
          assignedAgentId: payload.assignedAgentId || '1',
          assignedAgentName: 'Pooja Hegde',
        };
      }
    } catch {
      // Fallback
    }
    return this.scheduleFollowup(payload);
  },

  async completeFollowup(id: string | number): Promise<boolean> {
    if (isMock()) {
      const followups = storageService.getFollowups('t-jamin-02');
      const idx = followups.findIndex(f => f.id === String(id));
      if (idx >= 0) {
        followups[idx].status = 'Completed';
        storageService.saveFollowups(followups);
        return true;
      }
      return false;
    }
    try {
      const res = await apiClient.patch<any>(`/api/sales-executive/followups/${id}/complete`);
      return res.data?.success ?? false;
    } catch {
      return false;
    }
  },

  // ── 5. PROJECTS (JAMIN DOMAIN) ─────────────────────────────────────────────
  async getProjects(): Promise<any[]> {
    try {
      const res = await apiClient.get<any>('/api/jamin/projects');
      if (res.data?.success && Array.isArray(res.data.data)) {
        return res.data.data;
      }
    } catch {}
    const raw = localStorage.getItem('nexus_projects');
    return raw ? JSON.parse(raw) : [];
  },

  // ── 6. PLOTS INVENTORY (JAMIN DOMAIN) ──────────────────────────────────────
  async getPlots(projectId?: string, status?: string): Promise<any[]> {
    try {
      const params = new URLSearchParams();
      if (projectId) params.append('projectId', projectId);
      if (status && status !== 'All') params.append('status', status);
      const res = await apiClient.get<any>(`/api/jamin/plots?${params.toString()}`);
      if (res.data?.success && Array.isArray(res.data.data)) {
        return res.data.data;
      }
    } catch {}
    const raw = localStorage.getItem('nexus_plots');
    const all = raw ? JSON.parse(raw) : [];
    return all.filter((p: any) => (!projectId || p.projectId === projectId) && (!status || status === 'All' || p.status === status));
  },

  async holdPlot(plotId: string, customerName: string, customerPhone: string, holdDays: number = 7, notes?: string): Promise<boolean> {
    try {
      const res = await apiClient.post<any>(`/api/jamin/plots/${plotId}/hold`, { customerName, customerPhone, holdDays, notes });
      if (res.data?.success) return true;
    } catch {}
    try {
      const raw = localStorage.getItem('nexus_plots');
      const all = raw ? JSON.parse(raw) : [];
      const idx = all.findIndex((p: any) => p.id === plotId);
      if (idx >= 0) {
        all[idx].status = 'Hold';
        all[idx].heldByCustomerName = customerName;
        all[idx].heldByCustomerPhone = customerPhone;
        localStorage.setItem('nexus_plots', JSON.stringify(all));
        window.dispatchEvent(new Event('nexus_storage_updated'));
        return true;
      }
    } catch {}
    return false;
  },

  async releasePlot(plotId: string): Promise<boolean> {
    try {
      const res = await apiClient.post<any>(`/api/jamin/plots/${plotId}/release`, {});
      if (res.data?.success) return true;
    } catch {}
    try {
      const raw = localStorage.getItem('nexus_plots');
      const all = raw ? JSON.parse(raw) : [];
      const idx = all.findIndex((p: any) => p.id === plotId);
      if (idx >= 0) {
        all[idx].status = 'Available';
        all[idx].heldByCustomerName = null;
        all[idx].heldByCustomerPhone = null;
        localStorage.setItem('nexus_plots', JSON.stringify(all));
        window.dispatchEvent(new Event('nexus_storage_updated'));
        return true;
      }
    } catch {}
    return false;
  },

  // ── 7. BOOKINGS (JAMIN DOMAIN) ─────────────────────────────────────────────
  async getBookings(): Promise<any[]> {
    try {
      const res = await apiClient.get<any>('/api/jamin/bookings');
      if (res.data?.success && Array.isArray(res.data.data)) {
        return res.data.data;
      }
    } catch {}
    const raw = localStorage.getItem('nexus_bookings');
    return raw ? JSON.parse(raw) : [];
  },

  async createBooking(booking: any): Promise<boolean> {
    try {
      const res = await apiClient.post<any>('/api/jamin/bookings', booking);
      if (res.data?.success) return true;
    } catch {}
    try {
      const raw = localStorage.getItem('nexus_bookings');
      const all = raw ? JSON.parse(raw) : [];
      all.unshift(booking);
      localStorage.setItem('nexus_bookings', JSON.stringify(all));
      window.dispatchEvent(new Event('nexus_storage_updated'));
      return true;
    } catch {}
    return false;
  },
};
