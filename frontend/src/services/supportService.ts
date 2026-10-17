import { apiClient, ApiResponse } from './apiClient';
import { PlatformTicket } from '../types';

export class SupportService {
  async fetchTenantTickets(filters?: {
    status?: string;
    category?: string;
    search?: string;
  }): Promise<PlatformTicket[]> {
    const params: Record<string, any> = {};
    if (filters?.status && filters.status !== 'all') params.status = filters.status;
    if (filters?.category && filters.category !== 'all') params.category = filters.category;
    if (filters?.search) params.search = filters.search;

    const res = await apiClient.get<ApiResponse<PlatformTicket[]>>('/support/tickets', params);
    return res?.data || [];
  }

  async fetchTenantTicketById(id: string): Promise<PlatformTicket> {
    const res = await apiClient.get<ApiResponse<PlatformTicket>>(`/support/tickets/${id}`);
    if (!res || !res.data) throw new Error(res?.message || 'Failed to fetch ticket');
    return res.data;
  }

  async createTenantTicket(ticket: {
    title: string;
    description: string;
    category: string;
    priority: string;
  }): Promise<PlatformTicket> {
    const res = await apiClient.post<ApiResponse<PlatformTicket>>('/support/tickets', ticket);
    if (!res || !res.data) throw new Error(res?.message || 'Failed to submit support ticket');
    return res.data;
  }

  async addTenantTicketNote(id: string, message: string): Promise<PlatformTicket> {
    const res = await apiClient.post<ApiResponse<PlatformTicket>>(`/support/tickets/${id}/notes`, { message });
    if (!res || !res.data) throw new Error(res?.message || 'Failed to append update');
    return res.data;
  }

  async reopenTenantTicket(id: string, message?: string): Promise<PlatformTicket> {
    const res = await apiClient.post<ApiResponse<PlatformTicket>>(`/support/tickets/${id}/reopen`, { message: message || 'Issue reoccurred or requires further assistance' });
    if (!res || !res.data) throw new Error(res?.message || 'Failed to reopen ticket');
    return res.data;
  }
}

export const supportService = new SupportService();
