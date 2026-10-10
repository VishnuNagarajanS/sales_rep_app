

import { apiClient } from './apiClient';
import { storageService } from './storageService';
import type { Lead, SiteVisit, Followup, Customer } from '../types';

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
  contactType?: 'lead' | 'customer' | string;
  leadId?: string | number;
  customerId?: string | number;
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
      const rawList = Array.isArray(res?.data)
        ? res.data
        : (Array.isArray(res?.data?.items) ? res.data.items : (Array.isArray(res?.items) ? res.items : []));

      if (rawList.length > 0) {
        return rawList.map((l: any) => ({
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
          budgetRange: l.budgetRange || l.customFields?.budgetRange || l.customFields?.investmentCapacity || '',
          readyToRegister: l.readyToRegister || l.customFields?.readyToRegister || '',
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
    return storageService.getLeads('t-jamin-02') || [];
  },

  // ── 1B. CUSTOMERS (Live backend /sales-executive/customers + converted leads) ──
  async getCustomers(): Promise<Customer[]> {
    const customers: Customer[] = [];
    const seenPhones = new Set<string>();

    try {
      const res = await apiClient.get<any>('/sales-executive/customers?page=1&pageSize=100&tenantId=2');
      const rawList = Array.isArray(res?.data)
        ? res.data
        : (Array.isArray(res?.data?.items) ? res.data.items : (Array.isArray(res?.items) ? res.items : []));

      if (rawList.length > 0) {
        rawList.forEach((c: any) => {
          const phoneKey = (c.phone || '').replace(/\D/g, '').slice(-10);
          if (phoneKey) seenPhones.add(phoneKey);
          customers.push({
            id: String(c.id),
            companyId: 't-jamin-02',
            name: c.name || '',
            phone: c.phone || '',
            email: c.email || '',
            status: c.status || 'Active',
            assignedAgentId: c.assignedAgentId ? String(c.assignedAgentId) : '',
            assignedAgentName: c.assignedAgentName || '',
            location: c.location || '',
            lastContacted: c.lastContactedAt || '',
            openDealsCount: 0,
            totalValue: c.totalValue ?? 0,
            createdAt: c.createdAt || new Date().toISOString(),
            notes: c.notes || '',
            customFields: c.customFields || {},
          });
        });
      }
    } catch (err) {
      console.warn('Failed to fetch customers from /sales-executive/customers:', err);
    }

    // Include converted leads from database since they are fully registered customers
    try {
      const convRes = await apiClient.get<any>('/leads?tenantId=2&status=Converted');
      const convList = Array.isArray(convRes?.data) ? convRes.data : [];
      convList.forEach((l: any) => {
        const phoneKey = (l.phone || '').replace(/\D/g, '').slice(-10);
        if (phoneKey && seenPhones.has(phoneKey)) return;
        if (phoneKey) seenPhones.add(phoneKey);
        customers.push({
          id: String(l.id),
          companyId: 't-jamin-02',
          name: l.name || '',
          phone: l.phone || '',
          email: l.email || '',
          status: 'Active',
          assignedAgentId: l.assignedAgentId ? String(l.assignedAgentId) : '',
          assignedAgentName: l.assignedAgentName || '',
          location: l.location || '',
          lastContacted: l.createdAt || '',
          openDealsCount: 0,
          totalValue: 0,
          createdAt: l.createdAt || new Date().toISOString(),
          notes: l.notes || '',
          customFields: l.customFields || {},
        });
      });
    } catch { }

    if (customers.length > 0) {
      return customers;
    }

    return storageService.getCustomers('t-jamin-02') || [];
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
          budgetRange: d.budgetRange || d.customFields?.budgetRange || d.customFields?.investmentCapacity || '',
          readyToRegister: d.readyToRegister || d.customFields?.readyToRegister || '',
          createdAt: d.createdAt,
          customFields: {
            budgetRange: d.budgetRange || d.customFields?.budgetRange || '',
            readyToRegister: d.readyToRegister || d.customFields?.readyToRegister || '',
            investmentCapacity: d.investmentCapacity || d.customFields?.investmentCapacity || '',
          },
        };
        const siteVisits = await this.getSiteVisits(true);
        const linkedVisits = siteVisits.filter(v => v.leadId === String(id));
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

  async convertLead(id: string | number, dealTitle?: string, dealValue?: number, notes?: string): Promise<{ customerId?: number; leadId?: number; success: boolean; message?: string }> {
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
          message: res.message,
        };
      }
      return { success: false, message: res?.message || 'Conversion failed.' };
    } catch (err: any) {
      console.error(`Failed to convert lead #${id} on backend`, err);
      const msg = err?.response?.data?.message || err?.message || 'Failed to convert lead.';
      return { success: false, message: msg };
    }
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
          customerId: sv.customerId ? String(sv.customerId) : '',
          customerName: sv.customerName,
          customerPhone: sv.customerPhone,
          projectId: sv.projectId ? String(sv.projectId) : undefined,
          plotId: sv.plotId ? String(sv.plotId) : undefined,
          projectName: sv.projectName,
          plotNumber: sv.plotNumber || 'Layout Tour',
          scheduledAt: sv.scheduledAt,
          assignedAgentId: sv.assignedAgentId ? String(sv.assignedAgentId) : '',
          assignedAgentName: sv.assignedAgentName || 'Agent',
          status: sv.status,
          contactType: sv.contactType || 'lead',
          visitorNote: sv.visitorNote,
          outcomeNotes: sv.outcomeNotes,
        }));
      }
    } catch (err) {
      console.error('Failed to fetch site visits from backend', err);
      throw err;
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
        assignedAgentId: payload.assignedAgentId,
        assignedAgentName: payload.assignedAgentName || 'Agent',
      });
      if (res && res.success && res.data) {
        const sv = res.data;
        return {
          id: String(sv.id),
          companyId: 't-jamin-02',
          leadId: sv.leadId ? String(sv.leadId) : undefined,
          customerId: sv.customerId ? String(sv.customerId) : undefined,
          customerName: sv.customerName,
          customerPhone: sv.customerPhone,
          projectId: sv.projectId ? String(sv.projectId) : '',
          plotId: sv.plotId ? String(sv.plotId) : undefined,
          projectName: sv.projectName,
          plotNumber: sv.plotNumber || '',
          scheduledAt: sv.scheduledAt,
          assignedAgentId: sv.assignedAgentId ? String(sv.assignedAgentId) : '',
          assignedAgentName: sv.assignedAgentName || 'Agent',
          status: sv.status,
          contactType: sv.contactType || 'lead',
          visitorNote: sv.visitorNote,
          outcomeNotes: sv.outcomeNotes,
        };
      }
      throw new Error(res?.message || 'Failed to schedule site visit.');
    } catch (err) {
      console.error('Failed to schedule site visit on backend', err);
      throw err;
    }
  },

  async confirmSiteVisit(id: string | number): Promise<boolean> {
    try {
      const cleanId = String(id).replace(/\D/g, '') || String(id);
      const res = await apiClient.put<any>(`/jamin/site-visits/${cleanId}/confirm`, {});
      return Boolean(res && res.success);
    } catch (err) {
      console.error(`Failed to confirm site visit #${id}`, err);
      return false;
    }
  },

  async completeSiteVisit(id: string | number, outcomeNotes: string): Promise<boolean> {
    try {
      const cleanId = String(id).replace(/\D/g, '') || String(id);
      const res = await apiClient.put<any>(`/jamin/site-visits/${cleanId}/complete`, { outcomeNotes });
      return Boolean(res && res.success);
    } catch (err) {
      console.error(`Failed to complete site visit #${id}`, err);
      return false;
    }
  },

  async updateSiteVisit(id: string | number, data: any): Promise<boolean> {
    try {
      const cleanId = String(id).replace(/\D/g, '') || String(id);
      const res = await apiClient.put<any>(`/jamin/site-visits/${cleanId}`, data);
      return Boolean(res && res.success);
    } catch (err) {
      console.error(`Failed to update site visit #${id}`, err);
      return false;
    }
  },

  async cancelSiteVisit(id: string | number, reason?: string): Promise<boolean> {
    try {
      const cleanId = String(id).replace(/\D/g, '') || String(id);
      const res = await apiClient.put<any>(`/jamin/site-visits/${cleanId}`, {
        status: 'Cancelled',
        outcomeNotes: reason || 'Cancelled by user',
      });
      return Boolean(res && res.success);
    } catch (err) {
      console.error(`Failed to cancel site visit #${id}`, err);
      return false;
    }
  },

  // ── 3. FOLLOW-UPS ──────────────────────────────────────────────────────────
  async getFollowups(isAdmin: boolean = false, agentId?: number, status?: string): Promise<Followup[]> {
    try {
      const params = new URLSearchParams();
      params.append('companyId', '2');
      if (agentId) params.append('agentId', String(agentId));
      if (status && status !== 'All') params.append('status', status);

      const res = await apiClient.get<any>(`/sales-executive/followups?${params.toString()}`);
      const items = Array.isArray(res?.data) ? res.data : (res?.data?.items || []);
      if (res && res.success && items.length > 0) {
        const mapped = items.map((f: any) => {
          const schedIso = f.scheduledAt ? new Date(f.scheduledAt).toISOString() : new Date().toISOString();
          const schedDate = schedIso.split('T')[0];
          const schedTime = (() => {
            try {
              return new Date(schedIso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
            } catch {
              return '11:00 AM';
            }
          })();

          return {
            id: String(f.id),
            companyId: 't-jamin-02',
            contactId: String(f.contactId ?? ''),
            contactName: f.contactName ?? '',
            contactPhone: f.contactPhone || '',
            contactType: (f.contactType as any) || 'lead',
            leadId: f.leadId ? String(f.leadId) : undefined,
            customerId: f.customerId ? String(f.customerId) : undefined,
            scheduledAt: schedIso,
            scheduledDate: schedDate,
            scheduledTime: schedTime,
            priority: (f.priority as any) || 'Medium',
            status: (f.status as any) || 'Pending',
            notes: f.notes || '',
            followupType: f.followupType || 'call',
            assignedAgentId: f.assignedAgentId ? String(f.assignedAgentId) : '',
            assignedAgentName: f.assignedAgentName || f.assignedToName || 'Agent',
            assignedRole: f.assignedRole || f.assignedToRole || 'sales_executive',
            completedAt: f.completedAt,
            createdAt: f.createdAt,
            updatedAt: f.updatedAt,
          };
        });
        mapped.forEach((f: Followup) => storageService.saveFollowup(f));
        return mapped;
      }
    } catch (err) {
      console.error('Failed to fetch followups from backend', err);
    }
    return [];
  },

  async scheduleFollowup(payload: ScheduleFollowupPayload): Promise<Followup | null> {
    try {
      let schedIso = new Date().toISOString();
      if (payload.scheduledAt) {
        const pDate = new Date(payload.scheduledAt);
        if (!isNaN(pDate.getTime())) {
          schedIso = pDate.toISOString();
        } else {
          const cleaned = payload.scheduledAt.replace('•', ' ').replace(/\s+/g, ' ').trim();
          const p2 = new Date(cleaned);
          schedIso = !isNaN(p2.getTime()) ? p2.toISOString() : new Date().toISOString();
        }
      }

      const res = await apiClient.post<any>('/sales-executive/followups', {
        companyId: 2,
        contactId: String(payload.contactId || ''),
        contactType: payload.contactType || 'lead',
        leadId: payload.leadId ? Number(String(payload.leadId).replace(/\D/g, '')) : undefined,
        customerId: payload.customerId ? Number(String(payload.customerId).replace(/\D/g, '')) : undefined,
        contactName: payload.contactName,
        contactPhone: payload.contactPhone,
        scheduledAt: schedIso,
        priority: payload.priority || 'Medium',
        notes: payload.notes || '',
        followupType: 'call',
        assignedAgentId: payload.assignedAgentId ? parseInt(String(payload.assignedAgentId).replace(/\D/g, ''), 10) || 1 : 1,
      });

      if (res && res.success && res.data) {
        const d = res.data;
        const savedFollowup: Followup = {
          id: String(d.id || res.data),
          companyId: 't-jamin-02',
          contactId: String(d.contactId || payload.contactId),
          contactName: d.contactName || payload.contactName,
          contactPhone: d.contactPhone || payload.contactPhone || '',
          contactType: (d.contactType as any) || payload.contactType || 'lead',
          leadId: d.leadId ? String(d.leadId) : (payload.leadId ? String(payload.leadId) : undefined),
          customerId: d.customerId ? String(d.customerId) : (payload.customerId ? String(payload.customerId) : undefined),
          scheduledAt: d.scheduledAt ? new Date(d.scheduledAt).toISOString() : schedIso,
          scheduledDate: schedIso.split('T')[0],
          scheduledTime: '11:00 AM',
          priority: (d.priority as any) || payload.priority || 'Medium',
          status: (d.status as any) || 'Pending',
          notes: d.notes || payload.notes || '',
          followupType: d.followupType || 'call',
          assignedAgentId: String(d.assignedAgentId || payload.assignedAgentId || '1'),
          assignedAgentName: d.assignedAgentName || 'Agent',
        };
        storageService.saveFollowup(savedFollowup);
        window.dispatchEvent(new Event('nexus_storage_updated'));
        return savedFollowup;
      }
    } catch (err) {
      console.error('Failed to schedule followup on backend', err);
    }
    return null;
  },

  async completeFollowup(id: string | number): Promise<boolean> {
    try {
      const cleanId = String(id).replace(/\D/g, '') || id;
      const res = await apiClient.patch<any>(`/sales-executive/followups/${cleanId}/complete`);
      window.dispatchEvent(new Event('nexus_storage_updated'));
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
  }): Promise<{ success: boolean; projectId?: number }> {
    try {
      const res = await apiClient.post<any>('/jamin/projects', project);
      return { success: Boolean(res?.success), projectId: res?.data?.id };
    } catch (err) {
      console.error('Failed to create project on backend', err);
      return { success: false };
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
  }>): Promise<{ success: boolean; message?: string }> {
    try {
      const res = await apiClient.put<any>(`/jamin/projects/${id}`, project);
      return { success: Boolean(res?.success), message: res?.message };
    } catch (err) {
      console.error(`Failed to update project #${id}`, err);
      return { success: false, message: err instanceof Error ? err.message : 'Project update failed.' };
    }
  },

  async generateProjectPlots(id: number | string): Promise<{ success: boolean; message?: string }> {
    try {
      const res = await apiClient.post<any>(`/jamin/projects/${id}/generate-plots`, {});
      return { success: Boolean(res?.success), message: res?.message };
    } catch (err) {
      console.error(`Failed to generate plots for project #${id}`, err);
      return { success: false, message: err instanceof Error ? err.message : 'Plot inventory update failed.' };
    }
  },

  async deleteProject(id: number | string): Promise<{ success: boolean; message?: string }> {
    try {
      const res = await apiClient.delete<any>(`/jamin/projects/${id}`);
      return { success: Boolean(res?.success), message: res?.message };
    } catch (err) {
      console.error(`Failed to delete project #${id}`, err);
      return { success: false, message: err instanceof Error ? err.message : 'Project deletion failed.' };
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

  async createBooking(booking: any): Promise<{ success: boolean; data?: any; message?: string }> {
    try {
      const res = await apiClient.post<any>('/jamin/bookings', booking);
      return {
        success: Boolean(res && res.success),
        data: res?.data,
        message: res?.message || (res && res.success ? 'Booking created successfully.' : 'Unable to create booking.')
      };
    } catch (err: any) {
      console.error('Failed to create booking on backend', err);
      const serverMessage = err?.response?.data?.message || err?.message || 'Server connection error during booking creation.';
      return { success: false, message: serverMessage };
    }
  },

  async updateBookingStatus(id: number | string, status: string, notes?: string, details?: { tokenAmountPaid?: number; paymentMode?: string; paymentTerms?: string }): Promise<boolean> {
    try {
      const res = await apiClient.put<any>(`/jamin/bookings/${id}/status`, { status, notes, ...details });
      return res && res.success;
    } catch (err) {
      console.error(`Failed to update booking #${id} status`, err);
      return false;
    }
  },

  async verifyBookingPayment(id: number | string, paymentId?: number, receiptNumber?: string, notes?: string): Promise<{ success: boolean; data?: any; message?: string }> {
    try {
      const res = await apiClient.post<any>(`/jamin/bookings/${id}/verify-payment`, { paymentId, receiptNumber, notes });
      return { success: Boolean(res && res.success), data: res?.data, message: res?.message };
    } catch (err: any) {
      console.error(`Failed to verify payment on booking #${id}`, err);
      return { success: false, message: err?.message || 'Verification failed.' };
    }
  },

  async addBookingPayment(id: number | string, payment: { amount: number; paymentType?: string; paymentMode?: string; transactionReference?: string; receiptNumber?: string; notes?: string }): Promise<boolean> {
    try {
      const res = await apiClient.post<any>(`/jamin/bookings/${id}/payments`, payment);
      return res && res.success;
    } catch (err) {
      console.error(`Failed to add payment to booking #${id}`, err);
      return false;
    }
  },

  async cancelBookingWithAudit(id: number | string, cancellation: { cancellationReason: string; refundAmount?: number; refundPaymentMode?: string; refundTransactionReference?: string; notes?: string }): Promise<boolean> {
    try {
      const res = await apiClient.post<any>(`/jamin/bookings/${id}/cancel`, cancellation);
      return res && res.success;
    } catch (err) {
      console.error(`Failed to cancel booking #${id} with audit`, err);
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

