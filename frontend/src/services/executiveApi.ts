import { CallRecord, NotificationItem, Tenant, User } from '../types';
import { ApiResponse, apiClient } from './apiClient';

interface PagedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
}

export interface ExecutiveDashboard {
  activeLeads: { label: string; value: number; weeklyDelta: number };
  pendingFollowups: { label: string; value: number; weeklyDelta: number };
  overdueFollowups: number;
  callsLoggedToday: number;
  connectedCallsToday: number;
  averageTalkTimeSeconds: number;
  recentLeads: Array<{ id: number; name: string; phone: string; status: string; createdAt: string }>;
  upcomingFollowups: Array<{ id: number; leadId?: number; scheduledAt: string; notes?: string }>;
}

export interface ExecutiveReport {
  totalCalls: number;
  inboundCalls: number;
  outboundCalls: number;
  totalDurationSeconds: number;
  averageDurationSeconds: number;
  connectRatePercent: number;
  dispositions: Array<{ disposition: string; count: number }>;
  followupsCompletedOnTime: number;
  followupsOverdue: number;
  followupAdherencePercent: number;
}

export interface ExecutiveProfile {
  userId: number;
  name: string;
  email: string;
  phone: string;
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

interface BackendCallRecord {
  id: number;
  contactName: string;
  contactPhone: string;
  direction: 'inbound' | 'outbound';
  duration: number;
  disposition: CallRecord['disposition'];
  notes?: string;
  leadId?: number;
  customerId?: number;
  startedAt: string;
}

interface BackendNotification {
  id: number;
  title: string;
  message: string;
  type: NotificationItem['type'];
  isRead: boolean;
  createdAt: string;
}

const unwrap = <T>(response: ApiResponse<T>): T => {
  if (!response.success || response.data === undefined) {
    throw new Error(response.message || 'The server returned an invalid response.');
  }
  return response.data;
};

const mapCall = (call: BackendCallRecord, user: User, tenant: Tenant | null): CallRecord => ({
  id: String(call.id),
  companyId: tenant?.id || '',
  contactName: call.contactName,
  contactPhone: call.contactPhone,
  direction: call.direction,
  duration: call.duration,
  agentId: user.id,
  agentName: user.name,
  disposition: call.disposition,
  timestamp: call.startedAt,
  leadId: call.leadId ? String(call.leadId) : undefined,
  customerId: call.customerId ? String(call.customerId) : undefined,
  notes: call.notes,
});

export const executiveApi = {
  async getDashboard(): Promise<ExecutiveDashboard> {
    return unwrap(await apiClient.get<ApiResponse<ExecutiveDashboard>>('/sales-executive/dashboard'));
  },

  async getCalls(user: User, tenant: Tenant | null): Promise<CallRecord[]> {
    const result = unwrap(await apiClient.get<ApiResponse<PagedResult<BackendCallRecord>>>('/sales-executive/calls?page=1&pageSize=100'));
    return result.items.map(call => mapCall(call, user, tenant));
  },

  async logCall(payload: Record<string, unknown>): Promise<void> {
    unwrap(await apiClient.post<ApiResponse<BackendCallRecord>>('/sales-executive/calls', payload));
  },

  async processDisposition(payload: Record<string, unknown>): Promise<void> {
    unwrap(await apiClient.post<ApiResponse<BackendCallRecord>>('/sales-executive/calls/disposition', payload));
  },

  async getNotifications(): Promise<NotificationItem[]> {
    const items = unwrap(await apiClient.get<ApiResponse<BackendNotification[]>>('/sales-executive/notifications'));
    return items.map(item => ({
      id: String(item.id),
      type: item.type,
      title: item.title,
      message: item.message,
      timestamp: item.createdAt,
      read: item.isRead,
    }));
  },

  async markNotificationRead(id: string): Promise<void> {
    unwrap(await apiClient.patch<ApiResponse<object>>(`/sales-executive/notifications/${id}/read`));
  },

  async markAllNotificationsRead(): Promise<void> {
    unwrap(await apiClient.post<ApiResponse<number>>('/sales-executive/notifications/read-all'));
  },

  async getProfile(): Promise<ExecutiveProfile> {
    return unwrap(await apiClient.get<ApiResponse<ExecutiveProfile>>('/sales-executive/profile'));
  },

  async updateProfile(payload: Record<string, unknown>): Promise<ExecutiveProfile> {
    return unwrap(await apiClient.patch<ApiResponse<ExecutiveProfile>>('/sales-executive/profile', payload));
  },

  async getReport(from?: string, to?: string): Promise<ExecutiveReport> {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const query = params.toString();
    return unwrap(await apiClient.get<ApiResponse<ExecutiveReport>>(`/sales-executive/reports${query ? `?${query}` : ''}`));
  },
};
