

import { apiClient } from './apiClient';
import type { Lead, SiteVisit, Followup } from '../types';

export interface JaminAgent {
  id: number;
  name: string;
  email: string;
  phone: string;
  roleName: string;
  avatarUrl?: string;
}

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
  readyToRegister?: string;
  investmentCapacity?: string;
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
  readyToRegister?: string;
  investmentCapacity?: string;
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
  customerId?: string | number;
  projectId?: string | number;
  plotId?: string | number;
  customerName: string;
  customerPhone: string;
  contactType?: 'lead' | 'customer' | string;
  projectName: string;
  plotNumber?: string;
  scheduledAt: string;
  visitorNote?: string;
  assignedAgentId?: number;
  assignedAgentName?: string;
}

export const jaminApiService = {
  // ── 1. LEADS ───────────────────────────────────────────────────────────────
  async getLeads(isAdmin: boolean = false, agentId?: number, status?: string): Promise<Lead[]> {
    try {
      const endpoint = isAdmin ? '/leads' : '/sales-executive/leads';
      const params = new URLSearchParams();
      if (isAdmin) params.append('tenantId', '2');
      else params.append('companyId', '2');
      if (agentId) params.append('agentId', String(agentId));
      if (status && status !== 'All') params.append('status', status);

      const qs = params.toString();
      const res = await apiClient.get<any>(qs ? `${endpoint}?${qs}` : endpoint);
      if (res && res.success && Array.isArray(res.data)) {
        return res.data.map((l: any) => ({
          id: String(l.id),
          companyId: 't-jamin-02',
          name: l.name,
          phone: l.phone,
          email: l.email || '',
          location: l.location || '',
          source: l.source || 'Website',
          status: l.status || 'New',
          priority: l.priority || 'Medium',
          assignedAgentId: l.assignedAgentId ? String(l.assignedAgentId) : undefined,
          assignedAgentName: l.assignedAgentName || (l.assignedAgent?.name) || 'Unassigned',
          nextFollowupDate: l.nextFollowupDate ? new Date(l.nextFollowupDate).toLocaleDateString() : undefined,
          targetDevelopment: l.targetDevelopment,
          preferredVisitDate: l.preferredVisitDate,
          preferredTimeSlot: l.preferredTimeSlot,
          anythingWeShouldKnow: l.anythingWeShouldKnow,
          notes: l.notes || '',
          createdAt: l.createdAt ? new Date(l.createdAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
          customFields: {
            budgetRange: l.budgetRange || l.customFields?.budgetRange || '',
            readyToRegister: l.readyToRegister || l.customFields?.readyToRegister || '',
            investmentCapacity: l.investmentCapacity || l.customFields?.investmentCapacity || '',
          },
        }));
      }
    } catch (err) {
      console.error('Failed to get leads from backend API', err);
    }
    return [];
  },

  async getLeadDetail(id: string | number): Promise<{ lead: Lead; siteVisits: SiteVisit[]; followups: Followup[] } | null> {
    try {
      const res = await apiClient.get<any>(`/leads/${id}`);
      if (res && res.success && res.data) {
        const d = res.data;
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
          assignedAgentId: d.assignedAgentId ? String(d.assignedAgentId) : '',
          assignedAgentName: d.assignedAgentName || (d.assignedAgent?.name) || 'Unassigned',
          nextFollowupDate: d.nextFollowupDate,
          targetDevelopment: d.targetDevelopment,
          preferredVisitDate: d.preferredVisitDate,
          preferredTimeSlot: d.preferredTimeSlot,
          anythingWeShouldKnow: d.anythingWeShouldKnow,
          notes: d.notes || '',
          createdAt: d.createdAt,
          customFields: {
            budgetRange: d.budgetRange || d.customFields?.budgetRange || '',
            readyToRegister: d.readyToRegister || d.customFields?.readyToRegister || '',
            investmentCapacity: d.investmentCapacity || d.customFields?.investmentCapacity || '',
          },
        };
        const siteVisits = await this.getSiteVisits(true);
        const linkedVisits = siteVisits.filter(v => v.leadId === String(id) || v.customerPhone === lead.phone);
        const followups = await this.getFollowups(true);
        const linkedFollowups = followups.filter(f => f.contactId === String(id) || f.contactPhone === lead.phone);
        return { lead, siteVisits: linkedVisits, followups: linkedFollowups };
      }
    } catch (err) {
      console.error(`Failed to get lead detail #${id}`, err);
    }
    return null;
  },

  async createLead(payload: CreateJaminLeadPayload): Promise<Lead | null> {
    try {
      const res = await apiClient.post<any>('/leads', { ...payload, companyId: 2 });
      if (res && res.success && res.data) {
        const l = res.data;
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
          assignedAgentId: l.assignedAgentId ? String(l.assignedAgentId) : '',
          assignedAgentName: l.assignedAgentName || (l.assignedAgent?.name) || 'Unassigned',
          targetDevelopment: l.targetDevelopment,
          notes: l.notes,
          createdAt: l.createdAt,
          customFields: {
            budgetRange: l.budgetRange || '',
            readyToRegister: l.readyToRegister || '',
            investmentCapacity: l.investmentCapacity || '',
          },
        };
      }
    } catch (err) {
      console.error('Failed to create lead on backend', err);
    }
    return null;
  },

  async updateLeadStatus(id: string | number, status: string, notes?: string): Promise<boolean> {
    try {
      const res = await apiClient.put<any>(`/leads/${id}`, { status, notes });
      return res && res.success;
    } catch (err) {
      console.error(`Failed to update lead status #${id}`, err);
      return false;
    }
  },

  async convertLead(id: string | number, dealTitle?: string, dealValue?: number, notes?: string): Promise<{ customerId?: number; leadId?: number; success: boolean }> {
    try {
      const cleanId = String(id).replace('db-', '').replace('lead-', '').trim();
      const res = await apiClient.post<any>(`/leads/${cleanId}/convert`, {
        dealTitle,
        dealValue,
        notes,
      });
      if (res && res.success) {
        return {
          customerId: res.data?.customerId,
          leadId: res.data?.leadId,
          success: true,
        };
      }
    } catch (err) {
      console.error(`Failed to convert lead #${id} on backend`, err);
    }
    return { success: false };
  },

  async deleteLead(id: string | number): Promise<boolean> {
    try {
      const cleanId = String(id).replace('db-', '').trim();
      const res = await apiClient.delete<any>(`/leads/${cleanId}`);
      return Boolean(res && res.success);
    } catch (err) {
      console.error(`Failed to delete lead #${id}`, err);
      return false;
    }
  },

  // ── 2. SITE VISITS ─────────────────────────────────────────────────────────
  async getSiteVisits(isAdmin: boolean = false, agentId?: number, status?: string): Promise<SiteVisit[]> {
    try {
      const params = new URLSearchParams();
      if (agentId) params.append('agentId', String(agentId));
      if (status && status !== 'All') params.append('status', status);

      const res = await apiClient.get<any>(`/jamin/site-visits?${params.toString()}`);
      if (res && res.success && Array.isArray(res.data)) {
        return res.data.map((sv: any) => ({
          id: String(sv.id),
          companyId: 't-jamin-02',
          leadId: sv.leadId ? String(sv.leadId) : undefined,
          customerId: sv.customerId ? String(sv.customerId) : (sv.leadId ? String(sv.leadId) : undefined),
          customerName: sv.customerName,
          customerPhone: sv.customerPhone,
          projectId: sv.projectId ? String(sv.projectId) : undefined,
          plotId: sv.plotId ? String(sv.plotId) : undefined,
          projectName: sv.projectName,
          plotNumber: sv.plotNumber || 'Layout Tour',
          scheduledAt: sv.scheduledAt,
          assignedAgentId: String(sv.assignedAgentId || '1'),
          assignedAgentName: sv.assignedAgentName || 'Agent',
          status: sv.status,
          contactType: sv.contactType || 'lead',
          visitorNote: sv.visitorNote,
          outcomeNotes: sv.outcomeNotes,
        }));
      }
    } catch (err) {
      console.error('Failed to fetch site visits from backend', err);
    }
    return [];
  },

  async scheduleSiteVisit(payload: ScheduleSiteVisitPayload): Promise<SiteVisit | null> {
    try {
      const res = await apiClient.post<any>('/jamin/site-visits', {
        leadId: payload.leadId ? Number(payload.leadId) : undefined,
        customerId: payload.customerId ? Number(payload.customerId) : undefined,
        contactType: payload.contactType || (payload.customerId ? 'customer' : 'lead'),
        projectId: payload.projectId ? Number(payload.projectId) : undefined,
        plotId: payload.plotId ? Number(payload.plotId) : undefined,
        customerName: payload.customerName,
        customerPhone: payload.customerPhone,
        projectName: payload.projectName,
        plotNumber: payload.plotNumber,
        scheduledAt: payload.scheduledAt,
        visitorNote: payload.visitorNote,
        assignedAgentId: payload.assignedAgentId || 1,
        assignedAgentName: payload.assignedAgentName || 'Agent',
      });
      if (res && res.success && res.data) {
        const sv = res.data;
        return {
          id: String(sv.id),
          companyId: 't-jamin-02',
          leadId: sv.leadId ? String(sv.leadId) : undefined,
          customerId: sv.customerId ? String(sv.customerId) : (sv.leadId ? String(sv.leadId) : ''),
          customerName: sv.customerName,
          customerPhone: sv.customerPhone,
          projectId: sv.projectId ? String(sv.projectId) : '',
          plotId: sv.plotId ? String(sv.plotId) : undefined,
          projectName: sv.projectName,
          plotNumber: sv.plotNumber || '',
          scheduledAt: sv.scheduledAt,
          assignedAgentId: String(sv.assignedAgentId || '1'),
          assignedAgentName: sv.assignedAgentName || 'Agent',
          status: sv.status,
          contactType: sv.contactType || 'lead',
          visitorNote: sv.visitorNote,
          outcomeNotes: sv.outcomeNotes,
        };
      }
    } catch (err) {
      console.error('Failed to schedule site visit on backend', err);
    }
    return null;
  },

  async confirmSiteVisit(id: string | number): Promise<boolean> {
    try {
      const res = await apiClient.put<any>(`/jamin/site-visits/${id}/confirm`, {});
      return res && res.success;
    } catch (err) {
      console.error(`Failed to confirm site visit #${id}`, err);
      return false;
    }
  },

  async completeSiteVisit(id: string | number, outcomeNotes: string): Promise<boolean> {
    try {
      const res = await apiClient.put<any>(`/jamin/site-visits/${id}/complete`, { outcomeNotes });
      return res && res.success;
    } catch (err) {
      console.error(`Failed to complete site visit #${id}`, err);
      return false;
    }
  },

  // ── 3. FOLLOW-UPS ──────────────────────────────────────────────────────────
  async getFollowups(isAdmin: boolean = false, agentId?: number, status?: string): Promise<Followup[]> {
    try {
      const params = new URLSearchParams();
      if (agentId) params.append('agentId', String(agentId));
      if (status && status !== 'All') params.append('status', status);

      const res = await apiClient.get<any>(`/sales-executive/followups?${params.toString()}`);
      const items = Array.isArray(res?.data) ? res.data : (res?.data?.items || []);
      if (res && res.success && items.length > 0) {
        return items.map((f: any) => ({
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
          assignedAgentId: String(f.assignedAgentId || '1'),
          assignedAgentName: f.assignedToName || f.assignedAgentName || 'Agent',
          assignedRole: 'sales_executive',
          completedAt: f.completedAt,
        }));
      }
    } catch (err) {
      console.error('Failed to fetch followups from backend', err);
    }
    return [];
  },

  async scheduleFollowup(payload: ScheduleFollowupPayload): Promise<Followup | null> {
    try {
      const res = await apiClient.post<any>('/sales-executive/followups', {
        contactId: payload.contactId,
        contactType: 'lead',
        contactName: payload.contactName,
        contactPhone: payload.contactPhone,
        scheduledAt: payload.scheduledAt,
        priority: payload.priority,
        notes: payload.notes,
        assignedAgentId: payload.assignedAgentId ? parseInt(payload.assignedAgentId, 10) : 1,
      });
      if (res && res.success) {
        return {
          id: String(res.data?.id || res.data),
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
          assignedAgentName: 'Agent',
        };
      }
    } catch (err) {
      console.error('Failed to schedule followup on backend', err);
    }
    return null;
  },

  async completeFollowup(id: string | number): Promise<boolean> {
    try {
      const res = await apiClient.patch<any>(`/sales-executive/followups/${id}/complete`);
      return res && res.success;
    } catch (err) {
      console.error(`Failed to complete followup #${id}`, err);
      return false;
    }
  },

  // ── 4. PROJECTS ────────────────────────────────────────────────────────────
  async getProjects(): Promise<any[]> {
    try {
      const res = await apiClient.get<any>('/jamin/projects');
      if (res && res.success && Array.isArray(res.data)) {
        return res.data;
      }
    } catch (err) {
      console.error('Failed to fetch projects from backend API', err);
    }
    return [];
  },

  async getProjectById(id: number | string): Promise<any | null> {
    try {
      const res = await apiClient.get<any>(`/jamin/projects/${id}`);
      if (res && res.success && res.data) {
        return res.data;
      }
    } catch (err) {
      console.error(`Failed to fetch project #${id}`, err);
    }
    return null;
  },

  async createProject(project: {
    name: string;
    location: string;
    status?: string;
    description?: string;
    totalPlots: number;
    priceRange?: string;
    imageUrl?: string;
  }): Promise<boolean> {
    try {
      const res = await apiClient.post<any>('/jamin/projects', project);
      return res && res.success;
    } catch (err) {
      console.error('Failed to create project on backend', err);
      return false;
    }
  },

  async updateProject(id: number | string, project: Partial<{
    name: string;
    location: string;
    status: string;
    description: string;
    totalPlots: number;
    availablePlots: number;
    bookedPlots: number;
    priceRange: string;
    imageUrl: string;
  }>): Promise<boolean> {
    try {
      const res = await apiClient.put<any>(`/jamin/projects/${id}`, project);
      return res && res.success;
    } catch (err) {
      console.error(`Failed to update project #${id}`, err);
      return false;
    }
  },

  async deleteProject(id: number | string): Promise<boolean> {
    try {
      const res = await apiClient.delete<any>(`/jamin/projects/${id}`);
      return res && res.success;
    } catch (err) {
      console.error(`Failed to delete project #${id}`, err);
      return false;
    }
  },

  // ── 5. PLOTS INVENTORY ─────────────────────────────────────────────────────
  async getPlots(projectId?: string, status?: string): Promise<any[]> {
    try {
      const params = new URLSearchParams();
      if (projectId) params.append('projectId', projectId);
      if (status && status !== 'All') params.append('status', status);
      const res = await apiClient.get<any>(`/jamin/plots?${params.toString()}`);
      if (res && res.success && Array.isArray(res.data)) {
        return res.data;
      }
    } catch (err) {
      console.error('Failed to fetch plots from backend API', err);
    }
    return [];
  },

  async getPlotById(id: number | string): Promise<any | null> {
    try {
      const res = await apiClient.get<any>(`/jamin/plots/${id}`);
      if (res && res.success && res.data) {
        return res.data;
      }
    } catch (err) {
      console.error(`Failed to fetch plot #${id}`, err);
    }
    return null;
  },

  async createPlot(plot: {
    projectId: number;
    plotNumber: string;
    dimensions?: string;
    areaSqFt: number;
    facing?: string;
    price: number;
    pricePerSqft?: number;
    notes?: string;
  }): Promise<boolean> {
    try {
      const res = await apiClient.post<any>('/jamin/plots', plot);
      return res && res.success;
    } catch (err) {
      console.error('Failed to create plot on backend', err);
      return false;
    }
  },

  async updatePlot(id: number | string, plot: Partial<{
    plotNumber: string;
    dimensions: string;
    areaSqFt: number;
    facing: string;
    status: string;
    price: number;
    pricePerSqft: number;
    holdByAgent: string;
    notes: string;
  }>): Promise<boolean> {
    try {
      const res = await apiClient.put<any>(`/jamin/plots/${id}`, plot);
      return res && res.success;
    } catch (err) {
      console.error(`Failed to update plot #${id}`, err);
      return false;
    }
  },

  async deletePlot(id: number | string): Promise<boolean> {
    try {
      const res = await apiClient.delete<any>(`/jamin/plots/${id}`);
      return res && res.success;
    } catch (err) {
      console.error(`Failed to delete plot #${id}`, err);
      return false;
    }
  },

  async holdPlot(plotId: string | number, customerName: string, customerPhone: string, holdDays: number = 7, notes?: string, holdByAgent?: string, heldByCustomerId?: number | string): Promise<boolean> {
    try {
      const res = await apiClient.post<any>(`/jamin/plots/${plotId}/hold`, {
        heldByCustomerId: heldByCustomerId ? Number(heldByCustomerId) : undefined,
        customerName,
        customerPhone,
        holdDays,
        notes,
        holdByAgent,
      });
      return res && res.success;
    } catch (err) {
      console.error(`Failed to place plot #${plotId} on hold`, err);
      return false;
    }
  },

  async releasePlot(plotId: string | number): Promise<boolean> {
    try {
      const res = await apiClient.post<any>(`/jamin/plots/${plotId}/release`, {});
      return res && res.success;
    } catch (err) {
      console.error(`Failed to release plot #${plotId}`, err);
      return false;
    }
  },

  // ── 6. BOOKINGS ────────────────────────────────────────────────────────────
  async getBookings(): Promise<any[]> {
    try {
      const res = await apiClient.get<any>('/jamin/bookings');
      if (res && res.success && Array.isArray(res.data)) {
        return res.data;
      }
    } catch (err) {
      console.error('Failed to fetch bookings from backend API', err);
    }
    return [];
  },

  async getBookingById(id: number | string): Promise<any | null> {
    try {
      const res = await apiClient.get<any>(`/jamin/bookings/${id}`);
      if (res && res.success && res.data) {
        return res.data;
      }
    } catch (err) {
      console.error(`Failed to fetch booking #${id}`, err);
    }
    return null;
  },

  async createBooking(booking: any): Promise<boolean> {
    try {
      const res = await apiClient.post<any>('/jamin/bookings', booking);
      return res && res.success;
    } catch (err) {
      console.error('Failed to create booking on backend', err);
      return false;
    }
  },

  async updateBookingStatus(id: number | string, status: string, notes?: string): Promise<boolean> {
    try {
      const res = await apiClient.put<any>(`/jamin/bookings/${id}/status`, { status, notes });
      return res && res.success;
    } catch (err) {
      console.error(`Failed to update booking #${id} status`, err);
      return false;
    }
  },

  async deleteBooking(id: number | string): Promise<boolean> {
    try {
      const res = await apiClient.delete<any>(`/jamin/bookings/${id}`);
      return res && res.success;
    } catch (err) {
      console.error(`Failed to cancel booking #${id}`, err);
      return false;
    }
  },

  async deleteSiteVisit(id: number | string): Promise<boolean> {
    try {
      const res = await apiClient.delete<any>(`/jamin/site-visits/${id}`);
      return res && res.success;
    } catch (err) {
      console.error(`Failed to delete site visit #${id}`, err);
      return false;
    }
  },

  // ── 6. AGENTS / SALES TEAM ──────────────────────────────────────────────────
  async getAgents(): Promise<JaminAgent[]> {
    try {
      const res = await apiClient.get<any>('/jamin/agents');
      if (res && res.success && Array.isArray(res.data)) {
        return res.data;
      }
    } catch (err) {
      console.error('Failed to fetch Jamin agents from backend', err);
    }
    return [];
  },
};

