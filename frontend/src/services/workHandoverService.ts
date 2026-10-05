import { apiClient, ApiResponse } from './apiClient';

// Matches backend WorkHandoverCandidateDto (camelCase from System.Text.Json)
export interface HandoverCandidateUser {
  userId: number;
  name: string;
  email: string;
  roleCode: string;
  roleName: string;
  openItemsCount: number;
  isCovered: boolean;   // backend: IsCovered
  isCovering: boolean;  // backend: IsCovering
  activeHandoverId?: number | null;
}

export interface HandoverPreviewCounts {
  fromUserId: number;
  fromUserName: string;
  toUserId: number;
  toUserName: string;
  roleCode: string;
  leadsCount: number;
  customersCount: number;
  followupsCount: number;
  dealsCount: number;
  investorsCount: number;
  kycsCount: number;
  opportunitiesCount: number;
  consultationsCount: number;
  pipelineCardsCount: number;
  totalCount: number;
}

export interface HandoverItemDto {
  id: number;
  handoverId: number;
  entityType: string;
  entityId: number;
  entityTitle: string;
  origin: string; // 'included_at_start' | 'created_during_coverage'
  returnedAt?: string | null;
  returnOutcome?: string | null; // 'returned' | 'skipped_reassigned' | null
  createdAt: string;
}

export interface WorkHandoverProgressDto {
  callsMadeCount: number;
  followupsCompletedCount: number;
  newRecordsCreatedCount: number;
  statusChangesCount: number;
  recordsConvertedOrClosedCount: number;
  recordsSkippedCount: number;
  highlights: string[];
}

// Matches backend WorkHandoverDto exactly
export interface WorkHandoverDto {
  id: number;
  companyId: number;
  roleCode: string;
  originalUserId: number;
  originalUserName: string;
  originalUserEmail: string;
  coveringUserId: number;
  coveringUserName: string;
  coveringUserEmail: string;
  startedById: number;
  startedByName: string;
  reason: string;
  startedAt: string;
  plannedEndAt?: string | null;
  status: string; // 'active' | 'ended'
  endedAt?: string | null;
  endedById?: number | null;
  endedByName?: string | null;
  progress?: WorkHandoverProgressDto | null;
  totalItemsCount: number;
  activeItemsCount: number;
  items: HandoverItemDto[];
}

export interface MyWorkHandoverStatusDto {
  activeCoverage?: WorkHandoverDto | null;
  activeCovering?: WorkHandoverDto | null;
  recentlyEnded?: WorkHandoverDto | null;
}

export interface StartHandoverRequest {
  fromUserId: number;
  toUserId: number;
  reason: string;
  plannedEndAt?: string | null;
}

export interface ReturnItemsRequest {
  itemIds: number[];
}

export const workHandoverService = {
  async getCandidates(role: string): Promise<HandoverCandidateUser[]> {
    // Backend returns: ApiResponse<List<WorkHandoverCandidateDto>> (flat array in .data)
    const res = await apiClient.get<ApiResponse<HandoverCandidateUser[]>>('/ghl/handover/candidates', { role });
    return res.data || [];
  },

  async getPreview(fromUserId: number, toUserId: number): Promise<HandoverPreviewCounts> {
    // Backend endpoint is POST preview with body { fromUserId, toUserId }
    const res = await apiClient.post<ApiResponse<HandoverPreviewCounts>>('/ghl/handover/preview', { fromUserId, toUserId });
    return res.data;
  },

  async startHandover(data: StartHandoverRequest): Promise<WorkHandoverDto> {
    // Backend expects { fromUserId, toUserId, reason, plannedEndAt? }
    const res = await apiClient.post<ApiResponse<WorkHandoverDto>>('/ghl/handover/start', data);
    return res.data;
  },

  async getActiveHandovers(): Promise<WorkHandoverDto[]> {
    const res = await apiClient.get<ApiResponse<WorkHandoverDto[]>>('/ghl/handover/active');
    return res.data || [];
  },

  async getHandoverHistory(): Promise<WorkHandoverDto[]> {
    const res = await apiClient.get<ApiResponse<WorkHandoverDto[]>>('/ghl/handover/history');
    return res.data || [];
  },

  async getHandoverById(id: number): Promise<WorkHandoverDto> {
    const res = await apiClient.get<ApiResponse<WorkHandoverDto>>(`/ghl/handover/${id}`);
    return res.data;
  },

  async endHandover(handoverId: number): Promise<WorkHandoverDto> {
    const res = await apiClient.post<ApiResponse<WorkHandoverDto>>(`/ghl/handover/${handoverId}/end`, {});
    return res.data;
  },

  async returnSelectedItems(handoverId: number, data: ReturnItemsRequest): Promise<WorkHandoverDto> {
    // Backend expects { itemIds: number[] }
    const res = await apiClient.post<ApiResponse<WorkHandoverDto>>(`/ghl/handover/${handoverId}/return-items`, data);
    return res.data;
  },

  async getMyStatus(): Promise<MyWorkHandoverStatusDto> {
    const res = await apiClient.get<ApiResponse<MyWorkHandoverStatusDto>>('/workhandover/my-status');
    return res.data;
  },
};
