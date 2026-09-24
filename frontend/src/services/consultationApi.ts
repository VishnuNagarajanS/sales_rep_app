import { ApiResponse, apiClient } from './apiClient';
import { Consultation } from '../types';

interface BackendPage<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

interface BackendConsultation {
  id: number;
  companyId: number;
  investorId: string;
  investorName: string;
  investorPhone: string;
  consultantId: string;
  consultantName: string;
  scheduledAt: string;
  status: Consultation['status'];
  agenda: string;
  outcomeNotes?: string;
  createdAt: string;
  updatedAt?: string;
}

const unwrap = <T>(response: ApiResponse<T>): T => {
  if (!response.success || response.data === undefined) {
    throw new Error(response.message || 'The server returned an invalid response.');
  }
  return response.data;
};

const toConsultation = (item: BackendConsultation): Consultation => ({
  id: String(item.id),
  companyId: String(item.companyId),
  investorId: item.investorId,
  investorName: item.investorName,
  investorPhone: item.investorPhone,
  scheduledAt: item.scheduledAt,
  consultantId: item.consultantId,
  consultantName: item.consultantName,
  status: item.status,
  agenda: item.agenda,
  outcomeNotes: item.outcomeNotes,
});

const toPayload = (consultation: Consultation) => ({
  investorId: consultation.investorId,
  investorName: consultation.investorName,
  investorPhone: consultation.investorPhone,
  consultantId: consultation.consultantId,
  consultantName: consultation.consultantName,
  scheduledAt: consultation.scheduledAt,
  status: consultation.status,
  agenda: consultation.agenda,
  outcomeNotes: consultation.outcomeNotes,
});

export const consultationApi = {
  async getAll(status?: string, search?: string): Promise<Consultation[]> {
    const params = new URLSearchParams({ page: '1', pageSize: '100' });
    if (status && status !== 'All') params.set('status', status);
    if (search) params.set('search', search);
    const page = unwrap(await apiClient.get<ApiResponse<BackendPage<BackendConsultation>>>(`/sales-executive/consultations?${params}`));
    return page.items.map(toConsultation);
  },

  async save(consultation: Consultation): Promise<Consultation> {
    const id = Number(consultation.id);
    const response = Number.isInteger(id) && id > 0
      ? await apiClient.put<ApiResponse<BackendConsultation>>(`/sales-executive/consultations/${id}`, toPayload(consultation))
      : await apiClient.post<ApiResponse<BackendConsultation>>('/sales-executive/consultations', toPayload(consultation));
    return toConsultation(unwrap(response));
  },

  async delete(id: string): Promise<void> {
    unwrap(await apiClient.delete<ApiResponse<boolean>>(`/sales-executive/consultations/${Number(id)}`));
  },
};
