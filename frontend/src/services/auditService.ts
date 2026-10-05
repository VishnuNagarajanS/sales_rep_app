import { apiClient, ApiResponse, PagedResult } from './apiClient';
import { AuditLog } from '../types';

function sid(val: any): string {
  if (val === undefined || val === null) return '';
  return String(val);
}

function mapApiAuditLog(l: Record<string, any>): AuditLog {
  return {
    id: sid(l.id),
    timestamp: l.timestamp ?? new Date().toISOString(),
    actorName: l.actorName ?? 'System',
    actorEmail: l.actorEmail ?? '',
    action: l.action ?? '',
    entityType: l.entityType ?? '',
    entityId: sid(l.entityId),
    companyId: sid(l.companyId),
    details: l.details ?? '',
    ipAddress: l.ipAddress,
    module: l.module ?? 'System',
    status: l.status ?? 'success',
  };
}

export const auditService = {
  /**
   * Fetches real audit logs directly from PostgreSQL Database API.
   * Does NOT read mock or localStorage data.
   */
  async getCompanyAuditLogs(companyId?: string | number): Promise<AuditLog[]> {
    try {
      const params: Record<string, string> = { pageSize: '200' };
      if (companyId) {
        let numericId = String(companyId).toLowerCase().trim();
        if (numericId === 't-jamin-02' || numericId === 'jamin') numericId = '2';
        if (numericId === 't-ghl-01' || numericId === 'ghl') numericId = '1';
        params.companyId = numericId;
      }
      const qs = new URLSearchParams(params).toString();
      const res: ApiResponse<PagedResult<any>> = await apiClient.get(`/audit-logs?${qs}`);
      
      if (res?.success && res?.data?.items) {
        const items = res.data.items.map(mapApiAuditLog);
        const targetCompanyId = params.companyId;
        if (targetCompanyId) {
          return items.filter(l => String(l.companyId) === String(targetCompanyId));
        }
        return items;
      }
      return [];
    } catch (err) {
      console.error('[auditService] Failed to fetch audit logs from database:', err);
      return [];
    }
  }
};
