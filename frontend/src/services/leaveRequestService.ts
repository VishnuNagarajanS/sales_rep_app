import { apiClient, ApiResponse } from './apiClient';

export interface LeaveRequestDto {
  id: number;
  companyId: number;
  userId: number;
  userName: string;
  userRole: string;
  leaveType: string; // 'Casual' | 'Sick' | 'Earned' | 'Unpaid' | 'Other'
  startDate: string; // 'YYYY-MM-DD'
  endDate: string;   // 'YYYY-MM-DD'
  isHalfDay: boolean;
  halfDaySession?: string | null; // 'first' | 'second' | null
  days: number;
  reason: string;
  status: string; // 'Pending' | 'Approved' | 'Rejected' | 'Cancelled'
  handoverState: string; // 'covered' | 'returned' | 'not_needed' | 'not_arranged'
  coveringUserId?: number | null;
  coveringUserName?: string | null;
  workHandoverId?: number | null;
  approvedById?: number | null;
  approvedByName?: string | null;
  decidedById?: number | null;
  decidedByName?: string | null;
  decisionAt?: string | null;
  decisionNote?: string | null;
  cancelledById?: number | null;
  cancelledByName?: string | null;
  cancelledAt?: string | null;
  handoverDecision: string; // 'pending' | 'arranged' | 'not_needed'
  handoverDecisionNote?: string | null;
  createdAt: string;
  updatedAt?: string | null;
}

export interface CreateLeaveRequestDto {
  leaveType: string;
  startDate: string;
  endDate: string;
  isHalfDay?: boolean;
  halfDaySession?: string | null;
  reason: string;
}

export interface UpdateLeaveRequestDto {
  startDate: string;
  endDate: string;
  isHalfDay?: boolean;
  halfDaySession?: string | null;
  reason: string;
}

export interface ApproveLeaveRequestDto {
  note?: string;
  coveringUserId?: number; // Ignored by backend v2 but kept for backward-compatibility
}

export interface RejectLeaveRequestDto {
  reason: string;
}

export interface HandoverNotNeededDto {
  note?: string;
}

export interface LeaveBalanceDto {
  leaveType: string;
  quota: number;
  used: number;
  pending: number;
  remaining: number;
}

export interface LeaveRequestEventDto {
  id: number;
  leaveRequestId: number;
  action: string;
  actorId: number;
  actorName: string;
  actorRole: string;
  note?: string | null;
  at: string;
}

export interface LeaveRequestDetailDto {
  request: LeaveRequestDto;
  events: LeaveRequestEventDto[];
  userBalances: LeaveBalanceDto[];
  activeHandover?: {
    id: number;
    coveringUserId: number;
    coveringUserName: string;
    startedAt: string;
    plannedEndAt?: string | null;
    status: string;
  } | null;
}

export interface TeammateConflictDto {
  userId: number;
  userName: string;
  startDate: string;
  endDate: string;
  status: string;
  leaveType: string;
}

export interface LeaveConflictsDto {
  hasConflict: boolean;
  percentageAway: number;
  isHighAbsenceRate: boolean;
  conflicts: TeammateConflictDto[];
}

export interface WorkforceAvailabilityDto {
  userId: number;
  name: string;
  roleCode: string;
  onLeave: boolean;
  leaveUntil?: string | null;
  leaveRequestId?: number | null;
  isCovered: boolean;
  coveredBy?: string | null;
}

export interface GetLeaveRequestsFilterParams {
  status?: string;
  type?: string;
  userId?: number;
  from?: string;
  to?: string;
  search?: string;
  handoverState?: string;
}

export const leaveRequestService = {
  getMyRequests: async (status?: string): Promise<LeaveRequestDto[]> => {
    const q = status ? `?status=${encodeURIComponent(status)}` : '';
    const res = await apiClient.get<ApiResponse<LeaveRequestDto[]>>(`/LeaveRequests/my-requests${q}`);
    return res.data || [];
  },

  getMyBalance: async (): Promise<LeaveBalanceDto[]> => {
    const res = await apiClient.get<ApiResponse<LeaveBalanceDto[]>>('/LeaveRequests/my-balance');
    return res.data || [];
  },

  createRequest: async (dto: CreateLeaveRequestDto): Promise<LeaveRequestDto> => {
    const res = await apiClient.post<ApiResponse<LeaveRequestDto>>('/LeaveRequests/my-requests', dto);
    return res.data;
  },

  updateRequest: async (id: number, dto: UpdateLeaveRequestDto): Promise<LeaveRequestDto> => {
    const res = await apiClient.put<ApiResponse<LeaveRequestDto>>(`/LeaveRequests/my-requests/${id}`, dto);
    return res.data;
  },

  cancelRequest: async (id: number): Promise<LeaveRequestDto> => {
    const res = await apiClient.post<ApiResponse<LeaveRequestDto>>(`/LeaveRequests/my-requests/${id}/cancel`, {});
    return res.data;
  },

  getAllRequests: async (params?: GetLeaveRequestsFilterParams): Promise<LeaveRequestDto[]> => {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.set('status', params.status);
    if (params?.type) searchParams.set('type', params.type);
    if (params?.userId) searchParams.set('userId', params.userId.toString());
    if (params?.from) searchParams.set('from', params.from);
    if (params?.to) searchParams.set('to', params.to);
    if (params?.search) searchParams.set('search', params.search);
    if (params?.handoverState) searchParams.set('handoverState', params.handoverState);

    const qs = searchParams.toString();
    const url = `/LeaveRequests${qs ? `?${qs}` : ''}`;
    const res = await apiClient.get<ApiResponse<LeaveRequestDto[]>>(url);
    return res.data || [];
  },

  getRequestDetail: async (id: number): Promise<LeaveRequestDetailDto> => {
    const res = await apiClient.get<ApiResponse<any>>(`/LeaveRequests/${id}`);
    const raw = res.data || {};

    // Backend returns a FLAT object (request fields + events + requesterBalances).
    // The UI expects { request, events, userBalances, activeHandover }.
    // Support both shapes so either side can change safely.
    if (raw.request) {
      return {
        request: raw.request,
        events: raw.events || [],
        userBalances: raw.userBalances || raw.requesterBalances || [],
        activeHandover: raw.activeHandover ?? null,
      };
    }

    const { events, requesterBalances, userBalances, activeHandover, ...request } = raw;
    const hasCover = !!request.coveringUserId && request.handoverState === 'covered';

    return {
      request: request as LeaveRequestDto,
      events: events || [],
      userBalances: userBalances || requesterBalances || [],
      activeHandover:
        activeHandover ??
        (hasCover
          ? {
              id: request.workHandoverId ?? 0,
              coveringUserId: request.coveringUserId,
              coveringUserName: request.coveringUserName || '',
              startedAt: request.startDate,
              plannedEndAt: request.endDate,
              status: 'Active',
            }
          : null),
    };
  },

  getConflicts: async (id: number): Promise<LeaveConflictsDto> => {
    const res = await apiClient.get<ApiResponse<LeaveConflictsDto>>(`/LeaveRequests/${id}/conflicts`);
    return res.data;
  },

  approveRequest: async (id: number, dto?: ApproveLeaveRequestDto): Promise<LeaveRequestDto> => {
    const res = await apiClient.post<ApiResponse<LeaveRequestDto>>(`/LeaveRequests/${id}/approve`, dto || {});
    return res.data;
  },

  rejectRequest: async (id: number, dto: RejectLeaveRequestDto): Promise<LeaveRequestDto> => {
    const res = await apiClient.post<ApiResponse<LeaveRequestDto>>(`/LeaveRequests/${id}/reject`, dto);
    return res.data;
  },

  markHandoverNotNeeded: async (id: number, dto?: HandoverNotNeededDto): Promise<LeaveRequestDto> => {
    const res = await apiClient.post<ApiResponse<LeaveRequestDto>>(`/LeaveRequests/${id}/handover-not-needed`, dto || {});
    return res.data;
  },

  getWorkforceAvailability: async (date?: string): Promise<WorkforceAvailabilityDto[]> => {
    const q = date ? `?date=${encodeURIComponent(date)}` : '';
    const res = await apiClient.get<ApiResponse<WorkforceAvailabilityDto[]>>(`/ghl/workforce/availability${q}`);
    return res.data || [];
  }
};
