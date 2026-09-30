import { apiClient, ApiResponse, PagedResult } from './apiClient';

// --- Lead Interfaces ---
export interface LeadDto {
  id: number;
  companyId: number;
  assignedAgentId: number;
  assignedAgentName?: string;
  name: string;
  phone: string;
  email: string;
  location: string;
  source: string;
  status: string;
  priority: string;
  notes: string;
  customFields: Record<string, string>;
  nextFollowupDate?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface CreateLeadPayload {
  name: string;
  phone: string;
  email?: string;
  location?: string;
  source?: string;
  priority?: string;
  notes?: string;
  investmentCapacity?: string;
  assetClass?: string;
  preferredAssetClass?: string;
  horizon?: string;
  additionalCustomFields?: Record<string, string>;
}

export interface UpdateLeadPayload {
  name?: string;
  phone?: string;
  email?: string;
  location?: string;
  source?: string;
  status?: string;
  priority?: string;
  notes?: string;
  nextFollowupDate?: string;
  investmentCapacity?: string;
  assetClass?: string;
  preferredAssetClass?: string;
  horizon?: string;
  dispositionReason?: string;
  additionalCustomFields?: Record<string, string>;
}

export interface ConvertLeadPayload {
  dealTitle?: string;
  dealValue?: number;
  notes?: string;
}

export interface LeadFilterParams {
  search?: string;
  status?: string;
  priority?: string;
  sortBy?: string;
  sortOrder?: string;
  page?: number;
  pageSize?: number;
}

// --- Customer Interfaces ---
export interface CustomerDto {
  id: number;
  companyId: number;
  assignedAgentId: number;
  assignedAgentName?: string;
  name: string;
  phone: string;
  email: string;
  location: string;
  status: string;
  totalValue: number;
  notes: string;
  customFields: Record<string, string>;
  lastContactedAt?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface Customer360CallSummary {
  id: number;
  direction: string;
  duration: number;
  disposition: string;
  notes: string;
  timestamp: string;
}

export interface Customer360Dto {
  customer: CustomerDto;
  calls: Customer360CallSummary[];
  followups: FollowupDto[];
  totalCalls: number;
  pendingFollowupsCount: number;
}

export interface CreateCustomerPayload {
  name: string;
  phone: string;
  email?: string;
  location?: string;
  status?: string;
  totalValue?: number;
  notes?: string;
  customFields?: Record<string, string>;
}

export interface UpdateCustomerPayload {
  name?: string;
  phone?: string;
  email?: string;
  location?: string;
  status?: string;
  totalValue?: number;
  notes?: string;
  customFields?: Record<string, string>;
}

// --- Followup Interfaces ---
export interface FollowupDto {
  id: number;
  companyId: number;
  assignedAgentId: number;
  assignedAgentName?: string;
  contactId: string;
  contactType: string;
  contactName: string;
  contactPhone: string;
  scheduledAt: string;
  priority: string;
  status: string;
  notes: string;
  completedAt?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface CreateFollowupPayload {
  contactId?: string;
  contactType?: string;
  contactName: string;
  contactPhone: string;
  scheduledAt: string;
  priority?: string;
  notes?: string;
}

export interface UpdateFollowupPayload {
  scheduledAt?: string;
  priority?: string;
  status?: string;
  notes?: string;
}

// --- Consultation Interfaces ---
export interface ConsultationDto {
  id: number;
  companyId: number;
  consultantId: number;
  consultantName?: string;
  investorId: string;
  investorName: string;
  investorPhone: string;
  scheduledAt: string;
  status: string;
  agenda: string;
  outcomeNotes: string;
  createdAt: string;
  updatedAt?: string;
}

export interface ScheduleConsultationPayload {
  investorId: string;
  investorName: string;
  investorPhone: string;
  scheduledAt: string;
  agenda?: string;
  notes?: string;
}

export interface UpdateConsultationPayload {
  scheduledAt?: string;
  status?: string;
  agenda?: string;
  outcomeNotes?: string;
}

// --- Call Interfaces ---
export interface CallRecordDto {
  id: number;
  companyId: number;
  agentId: number;
  agentName?: string;
  contactName: string;
  contactPhone: string;
  direction: string;
  duration: number;
  disposition: string;
  notes: string;
  leadId?: number;
  customerId?: number;
  timestamp: string;
  createdAt: string;
}

export interface LogCallPayload {
  contactName: string;
  contactPhone: string;
  direction?: string;
  duration: number;
  disposition: string;
  notes: string;
  leadId?: number | string;
  customerId?: number | string;
}

// ==========================================
// API Services
// ==========================================

export const leadsApi = {
  async getActiveLeads(params?: LeadFilterParams): Promise<PagedResult<LeadDto>> {
    const res = await apiClient.get<ApiResponse<PagedResult<LeadDto>>>('/sales-executive/leads', params);
    return res.data;
  },

  async getLeads(params?: LeadFilterParams): Promise<PagedResult<LeadDto>> {
    return this.getActiveLeads(params);
  },

  async getLeadById(id: number | string): Promise<LeadDto> {
    const res = await apiClient.get<ApiResponse<LeadDto>>(`/sales-executive/leads/${id}`);
    return res.data;
  },

  async createLead(payload: CreateLeadPayload): Promise<LeadDto> {
    const res = await apiClient.post<ApiResponse<LeadDto>>('/sales-executive/leads', payload);
    return res.data;
  },

  async updateLead(id: number | string, payload: UpdateLeadPayload): Promise<LeadDto> {
    const res = await apiClient.put<ApiResponse<LeadDto>>(`/sales-executive/leads/${id}`, payload);
    return res.data;
  },

  async convertLead(id: number | string, payload: ConvertLeadPayload): Promise<any> {
    const res = await apiClient.post<ApiResponse<any>>(`/sales-executive/leads/${id}/convert`, payload);
    return res.data;
  },

  async getNotInterestedLeads(page = 1, pageSize = 20): Promise<PagedResult<LeadDto>> {
    const res = await apiClient.get<ApiResponse<PagedResult<LeadDto>>>('/sales-executive/leads/not-interested', { page, pageSize });
    return res.data;
  },

  async getJunkLeads(page = 1, pageSize = 20): Promise<PagedResult<LeadDto>> {
    const res = await apiClient.get<ApiResponse<PagedResult<LeadDto>>>('/sales-executive/leads/junk', { page, pageSize });
    return res.data;
  },

  async reengageLead(id: number | string): Promise<LeadDto> {
    const res = await apiClient.post<ApiResponse<LeadDto>>(`/sales-executive/leads/${id}/reengage`);
    return res.data;
  },
};

export const customersApi = {
  async getCustomers(params?: { status?: string; search?: string; page?: number; pageSize?: number }): Promise<PagedResult<CustomerDto>> {
    const res = await apiClient.get<ApiResponse<PagedResult<CustomerDto>>>('/sales-executive/customers', params);
    return res.data;
  },

  async getCustomer360(id: number | string): Promise<Customer360Dto> {
    const res = await apiClient.get<ApiResponse<Customer360Dto>>(`/sales-executive/customers/${id}`);
    return res.data;
  },

  async createCustomer(payload: CreateCustomerPayload): Promise<CustomerDto> {
    const res = await apiClient.post<ApiResponse<CustomerDto>>('/sales-executive/customers', payload);
    return res.data;
  },

  async updateCustomer(id: number | string, payload: UpdateCustomerPayload): Promise<CustomerDto> {
    const res = await apiClient.put<ApiResponse<CustomerDto>>(`/sales-executive/customers/${id}`, payload);
    return res.data;
  },
};

export const followupsApi = {
  async getFollowups(params?: { status?: string; scope?: string; page?: number; pageSize?: number }): Promise<PagedResult<FollowupDto>> {
    const res = await apiClient.get<ApiResponse<PagedResult<FollowupDto>>>('/sales-executive/followups', params);
    return res.data;
  },

  async getFollowupById(id: number | string): Promise<FollowupDto> {
    const res = await apiClient.get<ApiResponse<FollowupDto>>(`/sales-executive/followups/${id}`);
    return res.data;
  },

  async createFollowup(payload: CreateFollowupPayload): Promise<FollowupDto> {
    const res = await apiClient.post<ApiResponse<FollowupDto>>('/sales-executive/followups', payload);
    return res.data;
  },

  async updateFollowup(id: number | string, payload: UpdateFollowupPayload): Promise<FollowupDto> {
    const res = await apiClient.put<ApiResponse<FollowupDto>>(`/sales-executive/followups/${id}`, payload);
    return res.data;
  },

  async completeFollowup(id: number | string): Promise<FollowupDto> {
    const res = await apiClient.patch<ApiResponse<FollowupDto>>(`/sales-executive/followups/${id}/complete`);
    return res.data;
  },

  async deleteFollowup(id: number | string): Promise<boolean> {
    const res = await apiClient.delete<ApiResponse<boolean>>(`/sales-executive/followups/${id}`);
    return res.data;
  },
};

export const consultationsApi = {
  async getConsultations(params?: { status?: string; search?: string; page?: number; pageSize?: number }): Promise<PagedResult<ConsultationDto>> {
    const res = await apiClient.get<ApiResponse<PagedResult<ConsultationDto>>>('/sales-executive/consultations', params);
    return res.data;
  },

  async getConsultationById(id: number | string): Promise<ConsultationDto> {
    const res = await apiClient.get<ApiResponse<ConsultationDto>>(`/sales-executive/consultations/${id}`);
    return res.data;
  },

  async scheduleConsultation(payload: ScheduleConsultationPayload): Promise<ConsultationDto> {
    const res = await apiClient.post<ApiResponse<ConsultationDto>>('/sales-executive/consultations', payload);
    return res.data;
  },

  async updateConsultation(id: number | string, payload: UpdateConsultationPayload): Promise<ConsultationDto> {
    const res = await apiClient.put<ApiResponse<ConsultationDto>>(`/sales-executive/consultations/${id}`, payload);
    return res.data;
  },
};

export const callsApi = {
  async getCalls(params?: { search?: string; leadId?: number | string; customerId?: number | string; page?: number; pageSize?: number }): Promise<PagedResult<CallRecordDto>> {
    const res = await apiClient.get<ApiResponse<PagedResult<CallRecordDto>>>('/sales-executive/calls', params);
    return res.data;
  },

  async logCall(payload: LogCallPayload): Promise<CallRecordDto> {
    const formatted = {
      ...payload,
      leadId: payload.leadId ? Number(payload.leadId) : undefined,
      customerId: payload.customerId ? Number(payload.customerId) : undefined,
    };
    const res = await apiClient.post<ApiResponse<CallRecordDto>>('/sales-executive/calls', formatted);
    return res.data;
  },

  async processDisposition(payload: {
    callId?: number;
    contactName: string;
    contactPhone: string;
    direction?: string;
    duration?: number;
    disposition: string;
    notes?: string;
    followupAt?: string;
    leadId?: number;
    customerId?: number;
  }): Promise<CallRecordDto> {
    const res = await apiClient.post<ApiResponse<CallRecordDto>>('/sales-executive/calls/disposition', payload);
    return res.data;
  },
};

export interface ExecutiveDashboardData {
  activeLeads: { label: string; value: number; weeklyDelta: number };
  pendingFollowups: { label: string; value: number; weeklyDelta: number };
  overdueFollowups: number;
  callsLoggedToday: number;
  connectedCallsToday: number;
  averageTalkTimeSeconds: number;
  recentLeads: Array<{ id: number; name: string; phone: string; status: string; createdAt: string }>;
  upcomingFollowups: Array<{ id: number; leadId?: number; scheduledAt: string; notes?: string }>;
}

export interface NotificationItem {
  id: number;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
}

export interface ExecutiveProfileData {
  userId: number;
  name: string;
  email: string;
  phone?: string;
  employeeId?: string;
  designation?: string;
  workingHours?: string;
  maxActiveLeads: number;
  skills: string[];
  languages: string[];
  specializations: string[];
  autoAnswerCalls: boolean;
  callRecordingEnabled: boolean;
}

export interface ExecutiveReportData {
  totalCalls: number;
  inboundCalls: number;
  outboundCalls: number;
  totalDurationSeconds: number;
  averageDurationSeconds: number;
  connectRatePercent: number;
  dispositions: Array<{ disposition: string; count: number; percentage: number }>;
  followupsCompletedOnTime: number;
  followupsOverdue: number;
  followupAdherencePercent: number;
}

export const dashboardApi = {
  async getDashboard(): Promise<ExecutiveDashboardData> {
    const res = await apiClient.get<ApiResponse<ExecutiveDashboardData>>('/sales-executive/dashboard');
    return res.data;
  },
};

export const notificationsApi = {
  async getNotifications(): Promise<NotificationItem[]> {
    const res = await apiClient.get<ApiResponse<NotificationItem[]>>('/sales-executive/notifications');
    return res.data;
  },
  async markAsRead(id: number): Promise<void> {
    await apiClient.patch(`/sales-executive/notifications/${id}/read`);
  },
  async markAllAsRead(): Promise<number> {
    const res = await apiClient.post<ApiResponse<number>>('/sales-executive/notifications/read-all');
    return res.data;
  },
};

export const profileApi = {
  async getProfile(): Promise<ExecutiveProfileData> {
    const res = await apiClient.get<ApiResponse<ExecutiveProfileData>>('/sales-executive/profile');
    return res.data;
  },
  async updateProfile(payload: Partial<ExecutiveProfileData>): Promise<ExecutiveProfileData> {
    const res = await apiClient.patch<ApiResponse<ExecutiveProfileData>>('/sales-executive/profile', payload);
    return res.data;
  },
};

export const reportsApi = {
  async getReports(params?: { from?: string; to?: string }): Promise<ExecutiveReportData> {
    const res = await apiClient.get<ApiResponse<ExecutiveReportData>>('/sales-executive/reports', params);
    return res.data;
  },
};

