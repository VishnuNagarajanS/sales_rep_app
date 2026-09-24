import { ApiResponse, apiClient } from './apiClient';
import { Followup, Lead } from '../types';

interface BackendLead {
  id: number;
  companyId: number;
  assignedToUserId?: number;
  name: string;
  email: string;
  phone: string;
  status: Lead['status'];
  createdAt: string;
  updatedAt?: string;
}

interface BackendFollowup {
  id: number;
  companyId: number;
  userId: number;
  leadId?: number;
  scheduledAt: string;
  status: Followup['status'];
  notes?: string;
  completedAt?: string;
  createdAt: string;
}

const unwrap = <T>(response: ApiResponse<T>): T => {
  if (!response.success || response.data === undefined) {
    throw new Error(response.message || 'The server returned an invalid response.');
  }
  return response.data;
};

const toInt = (value?: string): number | undefined => {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : undefined;
};

const mapLead = (item: BackendLead): Lead => ({
  id: String(item.id),
  companyId: String(item.companyId),
  name: item.name,
  email: item.email,
  phone: item.phone,
  location: '',
  source: 'Database',
  status: item.status,
  priority: 'Medium',
  assignedAgentId: item.assignedToUserId ? String(item.assignedToUserId) : '',
  assignedAgentName: '',
  createdAt: item.createdAt,
  notes: '',
  customFields: {},
});

const mapFollowup = (item: BackendFollowup): Followup => ({
  id: String(item.id),
  companyId: String(item.companyId),
  contactId: item.leadId ? String(item.leadId) : 'contact-new',
  contactName: '',
  contactPhone: '',
  contactType: 'lead',
  scheduledAt: item.scheduledAt,
  scheduledDate: item.scheduledAt.slice(0, 10),
  scheduledTime: item.scheduledAt.slice(11, 16),
  priority: 'Medium',
  status: item.status,
  notes: item.notes || '',
  assignedAgentId: String(item.userId),
  assignedAgentName: '',
  completedAt: item.completedAt,
});

const leadPayload = (lead: Lead) => ({
  name: lead.name,
  email: lead.email,
  phone: lead.phone,
  status: lead.status,
  assignedToUserId: toInt(lead.assignedAgentId),
});

const followupPayload = (followup: Followup) => ({
  leadId: toInt(followup.contactId),
  scheduledAt: new Date(followup.scheduledAt).toISOString(),
  status: followup.status,
  notes: followup.notes,
});

export const salesApi = {
  async getLeads(): Promise<Lead[]> {
    return (unwrap(await apiClient.get<ApiResponse<BackendLead[]>>('/sales-executive/leads'))).map(mapLead);
  },
  async saveLead(lead: Lead): Promise<Lead> {
    const id = toInt(lead.id);
    const response = id === undefined
      ? await apiClient.post<ApiResponse<BackendLead>>('/sales-executive/leads', leadPayload(lead))
      : await apiClient.put<ApiResponse<BackendLead>>(`/sales-executive/leads/${id}`, leadPayload(lead));
    return mapLead(unwrap(response));
  },
  async deleteLead(id: string): Promise<void> {
    unwrap(await apiClient.delete<ApiResponse<object>>(`/sales-executive/leads/${toInt(id)}`));
  },
  async getFollowups(): Promise<Followup[]> {
    return (unwrap(await apiClient.get<ApiResponse<BackendFollowup[]>>('/sales-executive/followups'))).map(mapFollowup);
  },
  async saveFollowup(followup: Followup): Promise<Followup> {
    const id = toInt(followup.id);
    const response = id === undefined
      ? await apiClient.post<ApiResponse<BackendFollowup>>('/sales-executive/followups', followupPayload(followup))
      : await apiClient.put<ApiResponse<BackendFollowup>>(`/sales-executive/followups/${id}`, followupPayload(followup));
    return mapFollowup(unwrap(response));
  },
  async deleteFollowup(id: string): Promise<void> {
    unwrap(await apiClient.delete<ApiResponse<object>>(`/sales-executive/followups/${toInt(id)}`));
  },
};