import { apiClient, ApiResponse } from './apiClient';

export interface ConvertedCustomer {
  id: number;
  customerCode: string;
  name: string;
  email: string;
  phone: string;
  location: string;
  companyId: number;
  companyName: string;
  companySlug: string;
  assignedAgentId: number;
  assignedAgentName: string;
  assignedAgentRole: string;
  originalLeadSource: string;
  relatedLeadId?: number;
  relatedDealId?: number;
  relatedDealTitle?: string;
  committedAmount: number;
  conversionDate: string;
  status: string;
  notes: string;
  customFields: Record<string, string>;
  lastContactedAt?: string;
  updatedAt?: string;
}

export interface ConvertedCustomerSummary {
  totalConvertedCustomers: number;
  totalCommittedAmount: number;
  averageCommittedValue: number;
  convertedThisMonth: number;
}

export interface ConvertedCustomersResponse {
  summary: ConvertedCustomerSummary;
  items: ConvertedCustomer[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ConvertedCustomersQueryParams {
  search?: string;
  tenantId?: number | string;
  agentId?: number | string;
  status?: string;
  startDate?: string;
  endDate?: string;
  sortBy?: string;
  sortOrder?: string;
  page?: number;
  pageSize?: number;
}

export const convertedCustomerService = {
  async getConvertedCustomers(params: ConvertedCustomersQueryParams = {}): Promise<ConvertedCustomersResponse> {
    const searchParams = new URLSearchParams();

    if (params.search?.trim()) searchParams.append('search', params.search.trim());
    if (params.tenantId && params.tenantId !== 'all') searchParams.append('tenantId', String(params.tenantId));
    if (params.agentId && params.agentId !== 'all') searchParams.append('agentId', String(params.agentId));
    if (params.status && params.status !== 'all') searchParams.append('status', params.status);
    if (params.startDate) searchParams.append('startDate', params.startDate);
    if (params.endDate) searchParams.append('endDate', params.endDate);
    if (params.sortBy) searchParams.append('sortBy', params.sortBy);
    if (params.sortOrder) searchParams.append('sortOrder', params.sortOrder);
    if (params.page) searchParams.append('page', String(params.page));
    if (params.pageSize) searchParams.append('pageSize', String(params.pageSize));

    const queryString = searchParams.toString();
    const url = `/converted-customers${queryString ? `?${queryString}` : ''}`;

    const res: ApiResponse<ConvertedCustomersResponse> = await apiClient.get(url);
    if (!res.success || !res.data) {
      throw new Error(res.message || 'Failed to load converted customers.');
    }

    return res.data;
  },

  async getConvertedCustomerById(id: number): Promise<ConvertedCustomer> {
    const res: ApiResponse<ConvertedCustomer> = await apiClient.get(`/converted-customers/${id}`);
    if (!res.success || !res.data) {
      throw new Error(res.message || `Failed to fetch customer profile #${id}`);
    }
    return res.data;
  },
};
