/**
 * ghlApiService.ts
 *
 * Drop-in API service for GHL India Ventures data.
 * All methods have the same signatures as storageService so existing
 * page components don't need to change — just swap the import.
 *
 * Backend routes:
 *   /api/ghl/deals                    → GhlDealsController
 *   /api/ghl/deals/{id}/activities    → GhlDealsController (activities sub-route)
 *   /api/ghl/investors                → GhlInvestorsController
 *   /api/ghl/investment-opportunities → GhlOpportunitiesController
 *   /api/audit-logs                   → AuditLogsController
 *   /api/sales-executive/leads        → (already exists) SalesExecutiveLeadsController
 *   /api/sales-executive/followups    → (already exists) SalesExecutiveFollowupsController
 *   /api/sales-executive/customers    → (already exists) SalesExecutiveCustomersController
 *   /api/sales-executive/calls        → (already exists) SalesExecutiveCallsController
 *   /api/sales-executive/consultations→ (already exists) SalesExecutiveConsultationsController
 */

import { apiClient } from './apiClient';
import { storageService } from './storageService';
import { isMockMode } from '../config/environment';
import type {
  Deal,
  DealActivity,
  Investor,
  InvestmentOpportunity,
  Lead,
  Followup,
  Customer,
  CallRecord,
  Consultation,
  AuditLog,
  IrmOtherRecord,
  IrmProfile,
} from '../types';

// ── ID type helpers ───────────────────────────────────────────────────────────
// Backend uses int IDs; frontend types use string.
const sid = (n: number | string | undefined | null): string => String(n ?? '');
const nid = (s: string | number | undefined | null): number => {
  if (s == null) return 0;
  if (typeof s === 'number') return s;
  const cleaned = s.replace(/^[a-zA-Z_-]+/, '');
  const parsed = parseInt(cleaned, 10);
  return isNaN(parsed) ? 0 : parsed;
};

// ── Tenant match helper ───────────────────────────────────────────────────────
export function isTenantMatch(
  itemCompanyId: string | number | undefined | null,
  targetTenant: string | number | undefined | null
): boolean {
  if (!targetTenant) return true;
  const t = String(targetTenant).toLowerCase().trim();
  const c = String(itemCompanyId ?? '').toLowerCase().trim();

  const isJaminTarget = t === '2' || t === 't-jamin-02' || t === 'jamin' || t === 'jaminbazaar';
  const isGhlTarget = t === '1' || t === 't-ghl-01' || t === 'ghl' || t === 'ghlindiatrust';

  const isJaminItem = c === '2' || c === 't-jamin-02' || c === 'jamin' || c === 'jaminbazaar';
  const isGhlItem = c === '1' || c === 't-ghl-01' || c === 'ghl' || c === 'ghlindiatrust';

  if (isJaminTarget) return isJaminItem;
  if (isGhlTarget) return isGhlItem;

  return c === t;
}

// ── Paged response shape returned by backend ──────────────────────────────────
interface PagedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
}

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data?: T;
  errors?: string[];
}

/** Fetch all pages and return flat array (backend defaults to pageSize=100). Throws on API error so callers show error state instead of empty array. */
async function fetchAll<T>(path: string, params: Record<string, string> = {}): Promise<T[]> {
  const qs = new URLSearchParams({ pageSize: '200', ...params }).toString();
  const res: ApiResponse<PagedResult<T>> = await apiClient.get(`${path}?${qs}`);
  if (!res.success || !res.data) {
    throw new Error(res?.message || `Failed to fetch data from ${path}`);
  }
  const items = res.data.items || [];
  const seen = new Set();
  const deduped = items.filter((item: any) => {
    const id = item.id;
    if (id === undefined || id === null) return true;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
  return deduped;
}

// ══════════════════════════════════════════════════════════════════════════════
// DEALS  (GHL pipeline – Sales Exec Kanban + IRM Kanban)
// ══════════════════════════════════════════════════════════════════════════════

/** Map backend GhlDealResponseDto → frontend Deal */
function mapDeal(d: Record<string, any>): Deal {
  return {
    id: sid(d.id),
    companyId: sid(d.companyId),
    title: d.title ?? '',
    customerId: sid(d.customerId),
    customerName: d.customerName ?? '',
    stage: d.stage ?? 'new',
    value: d.value ?? 0,
    expectedCloseDate: d.expectedCloseDate ?? '',
    assignedAgentId: sid(d.assignedAgentId),
    assignedAgentName: d.assignedAgentName ?? '',
    notes: d.notes ?? '',
    lostReason: d.lostReason,
    createdAt: d.createdAt ?? new Date().toISOString(),
    stageEnteredAt: d.stageEnteredAt,
    investorType: d.investorType as any,
    investmentRange: d.investmentRange,
    preferredAssetClass: d.preferredAssetClass,
    priority: (d.priority as any) ?? 'Medium',
    phone: d.phone,
    email: d.email,
    location: d.location,
    investmentAmountConfirmed: Boolean(d.investmentAmountConfirmed),
    kycStatus: d.kycStatus,
  };
}

export async function getDeals(companyId?: string): Promise<Deal[]> {
  try {
    const raw = await fetchAll<any>('/ghl/deals');
    const apiDeals = raw.map(mapDeal);

    // Live database is authoritative for all existing deals
    const localDeals = storageService.getDeals(companyId) || [];
    const serverIds = new Set(apiDeals.map(d => String(d.id)));
    const serverPhones = new Set(
      apiDeals
        .map(d => (d.phone || '').replace(/\D/g, '').slice(-10))
        .filter(Boolean)
    );

    // Only keep truly local/offline-only draft deals that do not exist on the server
    const offlineOnly = localDeals.filter(ld => {
      const isLocalDraft = String(ld.id).startsWith('deal-') || String(ld.id).startsWith('d-');
      const ldPhone = (ld.phone || '').replace(/\D/g, '').slice(-10);
      const matchesServer = serverIds.has(String(ld.id)) || (ldPhone && serverPhones.has(ldPhone));
      return isLocalDraft && !matchesServer;
    });

    const combined = [...apiDeals, ...offlineOnly];

    // Synchronize storageService silently so read operations never trigger an update loop
    storageService.setDeals(combined, true);

    return companyId
      ? combined.filter(d => !d.companyId || isTenantMatch(d.companyId, companyId))
      : combined;
  } catch (err) {
    console.warn('[ghlApiService] Failed to fetch deals from server, using local store fallback:', err);
    return storageService.getDeals(companyId) || [];
  }
}

export async function saveDeal(deal: Deal): Promise<Deal> {
  const isNew = !deal.id || deal.id.startsWith('deal-') || deal.id.startsWith('d-');

  if (isNew) {
    const payload = {
      title: deal.title,
      customerId: nid(deal.customerId),
      customerName: deal.customerName,
      stage: deal.stage,
      value: deal.value,
      expectedCloseDate: deal.expectedCloseDate,
      notes: deal.notes,
      investorType: deal.investorType,
      investmentRange: deal.investmentRange,
      preferredAssetClass: deal.preferredAssetClass,
      priority: deal.priority ?? 'Medium',
    };
    const res: ApiResponse<any> = await apiClient.post('/ghl/deals', payload);
    if (!res.success || !res.data) throw new Error(res.message);
    const saved = mapDeal(res.data);
    storageService.saveDeal(saved);
    window.dispatchEvent(new Event('nexus_storage_updated'));
    return saved;
  } else {
    const payload = {
      title: deal.title,
      stage: deal.stage,
      value: deal.value,
      expectedCloseDate: deal.expectedCloseDate,
      notes: deal.notes,
      lostReason: deal.lostReason,
      investorType: deal.investorType,
      investmentRange: deal.investmentRange,
      preferredAssetClass: deal.preferredAssetClass,
      priority: deal.priority,
      stageEnteredAt: deal.stageEnteredAt,
      investmentAmountConfirmed: deal.investmentAmountConfirmed ?? false,
      kycStatus: (deal as any).kycStatus,
    };
    const res: ApiResponse<any> = await apiClient.put(`/ghl/deals/${nid(deal.id)}`, payload);
    if (!res.success || !res.data) throw new Error(res.message);
    const updated = mapDeal(res.data);
    storageService.saveDeal(updated);
    window.dispatchEvent(new Event('nexus_storage_updated'));
    return updated;
  }
}

export async function persistDeal(deal: Deal): Promise<Deal> {
  return await saveDeal(deal);
}

export async function deleteDeal(dealId: string): Promise<void> {
  await apiClient.delete(`/ghl/deals/${nid(dealId)}`);
  storageService.deleteDeal(dealId);
  window.dispatchEvent(new Event('nexus_storage_updated'));
}

// ── Deal Activities ───────────────────────────────────────────────────────────

function mapActivity(a: Record<string, any>): DealActivity {
  return {
    id: sid(a.id),
    dealId: sid(a.dealId),
    companyId: sid(a.companyId),
    type: a.type ?? 'note',
    text: a.text ?? '',
    fromStage: a.fromStage,
    toStage: a.toStage,
    loggedByName: a.loggedByName ?? '',
    loggedByRole: a.loggedByRole ?? '',
    timestamp: a.timestamp ?? new Date().toISOString(),
  };
}

export async function getDealActivities(dealId: string): Promise<DealActivity[]> {
  const res: ApiResponse<DealActivity[]> = await apiClient.get(
    `/ghl/deals/${nid(dealId)}/activities`
  );
  if (!res.success || !res.data) throw new Error(res?.message || 'Failed to fetch deal activities');
  return res.data.map(mapActivity);
}

export async function addDealActivity(activity: DealActivity): Promise<DealActivity> {
  const payload = {
    type: activity.type,
    text: activity.text,
    fromStage: activity.fromStage,
    toStage: activity.toStage,
    loggedByName: activity.loggedByName,
    loggedByRole: activity.loggedByRole,
  };
  const res: ApiResponse<any> = await apiClient.post(
    `/ghl/deals/${nid(activity.dealId)}/activities`,
    payload
  );
  if (!res.success || !res.data) throw new Error(res.message);
  return mapActivity(res.data);
}

// ══════════════════════════════════════════════════════════════════════════════
// INVESTORS  (GHL HNW investor profiles)
// ══════════════════════════════════════════════════════════════════════════════

function mapInvestor(i: Record<string, any>): Investor {
  return {
    id: sid(i.id),
    companyId: sid(i.companyId),
    name: i.name ?? '',
    phone: i.phone ?? '',
    email: i.email ?? '',
    status: i.status ?? 'Lead',
    investmentCapacity: i.investmentCapacity ?? '',
    preferredAssetClass: i.preferredAssetClass ?? '',
    assignedAgentId: sid(i.assignedAgentId),
    assignedAgentName: i.assignedAgentName ?? '',
    referralSource: i.referralSource,
    createdAt: i.createdAt ?? new Date().toISOString(),
    notes: i.notes ?? '',
    committedAUM: i.committedAUM,
    investmentMandate: i.investmentMandate,
    riskTolerance: i.riskTolerance,
  };
}

export async function getInvestors(companyId?: string): Promise<Investor[]> {
  const raw = await fetchAll<any>('/ghl/investors');
  return raw.map(mapInvestor);
}

export async function saveInvestor(investor: Investor): Promise<Investor> {
  const isNew =
    !investor.id || investor.id.startsWith('inv-') || investor.id.startsWith('i-');

  const payload = {
    name: investor.name,
    phone: investor.phone,
    email: investor.email,
    status: investor.status,
    investmentCapacity: investor.investmentCapacity,
    preferredAssetClass: investor.preferredAssetClass,
    referralSource: investor.referralSource,
    committedAUM: investor.committedAUM,
    investmentMandate: investor.investmentMandate,
    riskTolerance: investor.riskTolerance,
    notes: investor.notes,
  };

  if (isNew) {
    const res: ApiResponse<any> = await apiClient.post('/ghl/investors', payload);
    if (!res.success || !res.data) throw new Error(res.message);
    window.dispatchEvent(new Event('nexus_storage_updated'));
    return mapInvestor(res.data);
  } else {
    const res: ApiResponse<any> = await apiClient.put(
      `/ghl/investors/${nid(investor.id)}`,
      payload
    );
    if (!res.success || !res.data) throw new Error(res.message);
    window.dispatchEvent(new Event('nexus_storage_updated'));
    return mapInvestor(res.data);
  }
}

export async function deleteInvestor(investorId: string): Promise<void> {
  await apiClient.delete(`/ghl/investors/${nid(investorId)}`);
  window.dispatchEvent(new Event('nexus_storage_updated'));
}

// ══════════════════════════════════════════════════════════════════════════════
// INVESTMENT OPPORTUNITIES  (AIF / CO-AIF pipeline)
// ══════════════════════════════════════════════════════════════════════════════

function mapOpportunity(o: Record<string, any>): InvestmentOpportunity {
  return {
    id: sid(o.id),
    companyId: sid(o.companyId),
    title: o.title ?? '',
    investorId: sid(o.investorId),
    investorName: o.investorName ?? '',
    stage: o.stage ?? 'Enquiry',
    targetAmount: o.targetAmount ?? 0,
    committedAmount: o.committedAmount ?? 0,
    assignedAgentId: sid(o.assignedAgentId),
    assignedAgentName: o.assignedAgentName ?? '',
    expectedCloseDate: o.expectedCloseDate ?? '',
    notes: o.notes ?? '',
  };
}

export async function getOpportunities(companyId?: string): Promise<InvestmentOpportunity[]> {
  const raw = await fetchAll<any>('/ghl/investment-opportunities');
  return raw.map(mapOpportunity);
}

export async function saveOpportunity(
  opp: InvestmentOpportunity
): Promise<InvestmentOpportunity> {
  const isNew =
    !opp.id || opp.id.startsWith('opp-') || opp.id.startsWith('o-');

  const payload = {
    title: opp.title,
    investorId: nid(opp.investorId),
    investorName: opp.investorName,
    stage: opp.stage,
    targetAmount: opp.targetAmount,
    committedAmount: opp.committedAmount,
    expectedCloseDate: opp.expectedCloseDate,
    notes: opp.notes,
  };

  if (isNew) {
    const res: ApiResponse<any> = await apiClient.post(
      '/ghl/investment-opportunities',
      payload
    );
    if (!res.success || !res.data) throw new Error(res.message);
    window.dispatchEvent(new Event('nexus_storage_updated'));
    return mapOpportunity(res.data);
  } else {
    const res: ApiResponse<any> = await apiClient.put(
      `/ghl/investment-opportunities/${nid(opp.id)}`,
      payload
    );
    if (!res.success || !res.data) throw new Error(res.message);
    window.dispatchEvent(new Event('nexus_storage_updated'));
    return mapOpportunity(res.data);
  }
}

export async function deleteOpportunity(oppId: string): Promise<void> {
  await apiClient.delete(`/ghl/investment-opportunities/${nid(oppId)}`);
  window.dispatchEvent(new Event('nexus_storage_updated'));
}

// ══════════════════════════════════════════════════════════════════════════════
// AUDIT LOGS  (read-only, GHL admin only)
// ══════════════════════════════════════════════════════════════════════════════

function mapAuditLog(l: Record<string, any>): AuditLog {
  return {
    id: sid(l.id),
    timestamp: l.timestamp ?? new Date().toISOString(),
    actorName: l.actorName ?? '',
    actorEmail: l.actorEmail ?? '',
    action: l.action ?? '',
    entityType: l.entityType ?? '',
    entityId: sid(l.entityId),
    companyId: sid(l.companyId),
    details: l.details ?? '',
    ipAddress: l.ipAddress,
    module: l.module,
    status: l.status ?? 'success',
  };
}

export async function getAuditLogs(
  companyId?: string,
  filters?: { entityType?: string; module?: string; from?: string; to?: string }
): Promise<AuditLog[]> {
  const params: Record<string, string> = { pageSize: '200' };
  if (filters?.entityType) params.entityType = filters.entityType;
  if (filters?.module) params.module = filters.module;
  if (filters?.from) params.from = filters.from;
  if (filters?.to) params.to = filters.to;

  const qs = new URLSearchParams(params).toString();
  const res: ApiResponse<PagedResult<any>> = await apiClient.get(
    `/audit-logs?${qs}`
  );
  if (!res.success || !res.data) return [];
  return res.data.items.map(mapAuditLog);
}

// ══════════════════════════════════════════════════════════════════════════════
// LEADS  (delegates to existing SalesExecutiveLeadsController)
// ══════════════════════════════════════════════════════════════════════════════

function mapLead(l: Record<string, any>): Lead {
  return {
    id: sid(l.id),
    companyId: sid(l.companyId),
    name: l.name ?? '',
    phone: l.phone ?? '',
    email: l.email ?? '',
    location: l.location ?? '',
    source: l.source ?? '',
    status: l.status ?? 'New',
    priority: l.priority ?? 'Medium',
    assignedAgentId: l.assignedAgentId != null && l.assignedAgentId !== '' ? sid(l.assignedAgentId) : '',
    assignedAgentName: l.assignedAgentName ?? '',
    assignedById: l.assignedById != null ? sid(l.assignedById) : undefined,
    assignedByName: l.assignedByName ?? l.customFields?.qualifiedByAgentName ?? '',
    nextFollowupDate: l.nextFollowupDate,
    createdAt: l.createdAt ?? new Date().toISOString(),
    notes: l.notes ?? '',
    customFields: l.customFields ?? {},
  };
}

export async function getLeads(companyId?: string): Promise<Lead[]> {
  const raw = await fetchAll<any>('/sales-executive/leads');
  return raw.map(mapLead);
}

export async function saveLead(lead: Lead): Promise<Lead> {
  const isNew = !lead.id || lead.id.startsWith('lead-') || lead.id.startsWith('l-');
  const customFields = lead.customFields ?? {};

  try {
    if (isNew) {
      const payload: Record<string, any> = {
        name: lead.name,
        phone: lead.phone,
        email: lead.email,
        location: lead.location,
        source: lead.source,
        status: lead.status || 'New',
        priority: lead.priority,
        notes: lead.notes,
        assignedAgentId: nid(lead.assignedAgentId) || undefined,
        companyId: nid(lead.companyId) || 1,
        investmentCapacity: customFields['Investment Capacity'] ?? customFields['investmentCapacity'],
        investmentAmount: (lead as any).investmentAmount ?? customFields['Investment Amount'] ?? customFields['investmentAmount'],
        assetClass: customFields['Asset Class'] ?? customFields['assetClass'],
        preferredAssetClass: customFields['Preferred Asset Class'] ?? customFields['preferredAssetClass'],
        horizon: customFields['Horizon'] ?? customFields['horizon'],
        additionalCustomFields: customFields,
      };
      const res: ApiResponse<any> = await apiClient.post('/sales-executive/leads', payload);
      if (res && res.success && res.data) {
        const saved = mapLead(res.data);
        storageService.saveLead(saved);
        window.dispatchEvent(new Event('nexus_storage_updated'));
        return saved;
      }
      throw new Error(res?.message || 'Failed to create lead');
    } else {
      const payload: Record<string, any> = {
        name: lead.name,
        phone: lead.phone,
        email: lead.email,
        location: lead.location,
        source: lead.source,
        status: lead.status,
        priority: lead.priority,
        notes: lead.notes,
        nextFollowupDate: lead.nextFollowupDate,
        assignedAgentId: nid(lead.assignedAgentId?.toString()) || undefined,
        investmentCapacity: customFields['Investment Capacity'] ?? customFields['investmentCapacity'],
        investmentAmount: (lead as any).investmentAmount ?? customFields['Investment Amount'] ?? customFields['investmentAmount'],
        assetClass: customFields['Asset Class'] ?? customFields['assetClass'],
        preferredAssetClass: customFields['Preferred Asset Class'] ?? customFields['preferredAssetClass'],
        horizon: customFields['Horizon'] ?? customFields['horizon'],
        additionalCustomFields: customFields,
      };
      const res: ApiResponse<any> = await apiClient.put(
        `/sales-executive/leads/${nid(lead.id)}`,
        payload
      );
      if (res && res.success && res.data) {
        const saved = mapLead(res.data);
        storageService.saveLead(saved);
        window.dispatchEvent(new Event('nexus_storage_updated'));
        return saved;
      }
      throw new Error(res?.message || 'Failed to update lead');
    }
  } catch (err: any) {
    console.error('[ghlApiService] API lead save failed:', err);
    throw err;
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// FOLLOWUPS  (delegates to existing SalesExecutiveFollowupsController)
// ══════════════════════════════════════════════════════════════════════════════

function mapFollowup(f: Record<string, any>): Followup {
  return {
    id: sid(f.id),
    companyId: sid(f.companyId),
    contactId: f.contactId ?? '',
    contactName: f.contactName ?? '',
    contactPhone: f.contactPhone ?? '',
    contactType: f.contactType ?? 'lead',
    scheduledAt: f.scheduledAt ?? new Date().toISOString(),
    priority: f.priority ?? 'Medium',
    status: f.status ?? 'Pending',
    notes: f.notes ?? '',
    assignedAgentId: sid(f.assignedAgentId),
    assignedAgentName: f.assignedAgentName ?? f.assignedToName ?? '',
    assignedRole: f.assignedRole ?? f.assignedToRole ?? f.assignedAgentRole ?? undefined,
    assignedById: f.assignedById != null ? sid(f.assignedById) : undefined,
    assignedByName: f.assignedByName ?? undefined,
    completedAt: f.completedAt,
  };
}

export async function getFollowups(companyId?: string): Promise<Followup[]> {
  if (isMockMode()) {
    return storageService.getFollowups(companyId);
  }
  const raw = await fetchAll<any>('/sales-executive/followups');
  return raw.map(mapFollowup);
}

export async function saveFollowup(followup: Followup): Promise<Followup> {
  const isNew =
    !followup.id ||
    followup.id.startsWith('flw-') ||
    followup.id.startsWith('fu-') ||
    followup.id.startsWith('f-') ||
    followup.id.startsWith('lead-flw-');

  try {
    if (isNew) {
      const payload = {
        contactId: followup.contactId,
        contactType: followup.contactType || 'lead',
        contactName: followup.contactName,
        contactPhone: followup.contactPhone,
        contactEmail: (followup as any).contactEmail || (followup as any).email || undefined,
        scheduledAt: followup.scheduledAt,
        priority: followup.priority,
        notes: followup.notes,
        assignedAgentId: followup.assignedAgentId && !isNaN(Number(followup.assignedAgentId)) ? Number(followup.assignedAgentId) : undefined,
        assignedToRole: followup.assignedRole || undefined,
      };
      const res: ApiResponse<any> = await apiClient.post(
        '/sales-executive/followups',
        payload
      );
      if (res && res.success && res.data) {
        const saved = mapFollowup(res.data);
        storageService.saveFollowup(saved);
        window.dispatchEvent(new Event('nexus_storage_updated'));
        return saved;
      }
      throw new Error(res?.message || 'Failed to create follow-up on server');
    } else {
      const payload = {
        scheduledAt: followup.scheduledAt,
        priority: followup.priority,
        notes: followup.notes,
        status: followup.status,
      };
      const res: ApiResponse<any> = await apiClient.put(
        `/sales-executive/followups/${nid(followup.id)}`,
        payload
      );
      if (res && res.success && res.data) {
        const saved = mapFollowup(res.data);
        storageService.saveFollowup(saved);
        window.dispatchEvent(new Event('nexus_storage_updated'));
        return saved;
      }
      throw new Error(res?.message || 'Failed to update follow-up on server');
    }
  } catch (err: any) {
    console.error('[ghlApiService] API saveFollowup failed:', err);
    throw err;
  }
}

export async function completeFollowup(followupId: string): Promise<void> {
  await apiClient.patch(`/sales-executive/followups/${nid(followupId)}/complete`, {});
  window.dispatchEvent(new Event('nexus_storage_updated'));
}

// ══════════════════════════════════════════════════════════════════════════════
// CUSTOMERS  (delegates to existing SalesExecutiveCustomersController)
// ══════════════════════════════════════════════════════════════════════════════

function mapCustomer(c: Record<string, any>): Customer {
  return {
    id: sid(c.id),
    companyId: sid(c.companyId),
    name: c.name ?? '',
    phone: c.phone ?? '',
    email: c.email ?? '',
    status: c.status ?? 'Active',
    assignedAgentId: sid(c.assignedAgentId),
    assignedAgentName: c.assignedAgentName ?? '',
    location: c.location ?? '',
    lastContacted: c.lastContactedAt ?? '',
    openDealsCount: 0,
    totalValue: c.totalValue ?? 0,
    createdAt: c.createdAt ?? new Date().toISOString(),
    notes: c.notes ?? '',
    customFields: c.customFields ?? {},
  };
}

export async function getCustomers(companyId?: string): Promise<Customer[]> {
  const raw = await fetchAll<any>('/sales-executive/customers');
  return raw.map(mapCustomer);
}

export async function saveCustomer(customer: Customer): Promise<Customer> {
  const isNew =
    !customer.id ||
    customer.id.startsWith('cust-') ||
    customer.id.startsWith('c-');

  const payload: Record<string, any> = {
    name: customer.name,
    phone: customer.phone,
    email: customer.email,
    location: customer.location,
    status: customer.status,
    notes: customer.notes,
    totalValue: customer.totalValue,
    customFields: customer.customFields,
  };

  if (isNew) {
    const res: ApiResponse<any> = await apiClient.post(
      '/sales-executive/customers',
      payload
    );
    if (!res.success || !res.data) throw new Error(res.message);
    window.dispatchEvent(new Event('nexus_storage_updated'));
    return mapCustomer(res.data);
  } else {
    const res: ApiResponse<any> = await apiClient.put(
      `/sales-executive/customers/${nid(customer.id)}`,
      payload
    );
    if (!res.success || !res.data) throw new Error(res.message);
    window.dispatchEvent(new Event('nexus_storage_updated'));
    return mapCustomer(res.data);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// CALLS  (delegates to existing SalesExecutiveCallsController)
// ══════════════════════════════════════════════════════════════════════════════

function mapCallRecord(c: Record<string, any>): CallRecord {
  const notes = c.notes;
  let reason = c.reason;
  if (!reason && notes) {
    const match = notes.match(/(?:\[(?:Skip Reason|Reason)\]:\s*|(?:Skip Reason|Reason):\s*)([^\n]+)/i);
    if (match) {
      reason = match[1].trim();
    }
  }

  // Determine categorization from backend attributes or stored source markers
  const roleCode = (c.agentRole || c.callerType || '').toLowerCase();
  const sourceCode = (c.source || '').toLowerCase();
  const notesStr = notes || '';
  const isIrm =
    roleCode === 'irm' ||
    sourceCode === 'irm' ||
    c.connectVia === 'Connect via IRM' ||
    notesStr.includes('Connect via IRM') ||
    notesStr.includes('Connected to IRM') ||
    notesStr.includes('[Source: irm]');

  const callerType: 'Agent' | 'IRM' = isIrm ? 'IRM' : 'Agent';
  const connectVia: 'Connect via Agent' | 'Connect via IRM' = isIrm ? 'Connect via IRM' : 'Connect via Agent';
  const agentRole = isIrm ? 'IRM' : 'Agent';

  // Only assign recordingUrl and transcription if genuine real provider data exists (no mock/sample/placeholder)
  const isMockRecording = !c.recordingUrl ||
    typeof c.recordingUrl !== 'string' ||
    c.recordingUrl.includes('sample.mp3') ||
    c.recordingUrl.includes('nexusplatform.io') ||
    c.recordingUrl.includes('placeholder') ||
    c.recordingUrl.includes('example.com');
  const recordingUrl = !isMockRecording ? c.recordingUrl : undefined;

  const rawTranscript = c.transcript || c.transcription;
  const isMockTranscript = !rawTranscript ||
    typeof rawTranscript !== 'string' ||
    rawTranscript.startsWith('Automated Call Transcript: Agent') ||
    rawTranscript.includes('Agent explained commercial cap rate') ||
    rawTranscript.includes('Customer called inquiring about BDA') ||
    rawTranscript.includes('AIF Category II structured debt product');
  const transcription = !isMockTranscript ? rawTranscript : undefined;

  return {
    id: sid(c.id),
    companyId: sid(c.companyId),
    contactName: c.contactName ?? '',
    contactPhone: c.contactPhone ?? '',
    direction: c.direction ?? 'outbound',
    duration: c.duration ?? 0,
    agentId: sid(c.agentId),
    agentName: c.agentName ?? '',
    agentRole: agentRole,
    callerType: callerType,
    connectVia: connectVia,
    source: isIrm ? 'irm' : (c.source || 'agent'),
    disposition: c.disposition ?? 'No Response',
    timestamp: c.timestamp ?? new Date().toISOString(),
    notes: notes,
    reason: c.reason || reason,
    callModule: c.callModule || c.module || undefined,
    module: c.callModule || c.module || undefined,
    recordingUrl: recordingUrl,
    transcription: transcription,
    twilioCallSid: c.twilioCallSid || undefined,
    leadId: c.leadId ? sid(c.leadId) : undefined,
    customerId: c.customerId ? sid(c.customerId) : undefined,
  };
}

export async function getCalls(companyId?: string): Promise<CallRecord[]> {
  if (isMockMode()) {
    return storageService.getCalls(companyId);
  }
  const raw = await fetchAll<any>('/sales-executive/calls');
  return raw.map(mapCallRecord);
}

export async function logCall(call: CallRecord): Promise<CallRecord> {
  const parsedLeadId = call.leadId ? nid(call.leadId) : undefined;
  const parsedCustomerId = call.customerId ? nid(call.customerId) : undefined;
  const payload = {
    contactName: call.contactName,
    contactPhone: call.contactPhone,
    direction: call.direction,
    duration: call.duration,
    disposition: call.disposition,
    notes: call.notes,
    leadId: parsedLeadId && parsedLeadId > 0 ? parsedLeadId : undefined,
    customerId: parsedCustomerId && parsedCustomerId > 0 ? parsedCustomerId : undefined,
    twilioCallSid: call.twilioCallSid || undefined,
    module: call.callModule || call.module || undefined,
    reason: call.reason || undefined,
  };
  const res: ApiResponse<any> = await apiClient.post('/sales-executive/calls', payload);
  if (!res.success || !res.data) throw new Error(res.message);
  window.dispatchEvent(new Event('nexus_storage_updated'));
  return mapCallRecord(res.data);
}

export function isMockOtherRecord(record: IrmOtherRecord): boolean {
  if (!record) return false;
  const name = (record.contactName || '').trim().toLowerCase();
  const phone = (record.contactPhone || '').replace(/\D/g, '');
  return (
    name.includes('pravin godbole') ||
    name.includes('kishore varma') ||
    phone.includes('9741088223') ||
    phone.includes('9886077112') ||
    name.includes('simulate') ||
    (record.reason === 'n' && name.includes('pravin'))
  );
}

export interface MoveIrmOtherRecordOptions {
  callId: number;
  targetModule?: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  contactLocation?: string;
  leadId?: number;
  customerId?: number;
  assignedAgentId?: string | number;
  assignedAgentName?: string;
  actorName?: string;
  tenantId?: string;
  reason?: string;
}

export function getDismissedOtherKeys(): Set<string> {
  try {
    const set = new Set<string>();
    const raw = typeof window !== 'undefined' ? localStorage.getItem('nexus_dismissed_other_records') : null;
    if (raw) {
      const parsed: string[] = JSON.parse(raw);
      parsed.forEach(k => {
        if (k) set.add(String(k).trim());
      });
    }
    const movedRaw = typeof window !== 'undefined' ? localStorage.getItem('nexus_moved_other_records') : null;
    if (movedRaw) {
      const parsed: string[] = JSON.parse(movedRaw);
      parsed.forEach(k => {
        if (k) set.add(String(k).trim());
      });
    }
    return set;
  } catch {
    return new Set();
  }
}

export function filterOtherRecords(records: IrmOtherRecord[]): IrmOtherRecord[] {
  const dismissed = getDismissedOtherKeys();
  return (Array.isArray(records) ? records : []).filter(r => {
    if (isMockOtherRecord(r)) return false;
    const callKey = r.callId ? String(r.callId) : '';
    const phoneRaw = r.contactPhone ? r.contactPhone.trim() : '';
    const phoneDigits = phoneRaw.replace(/\D/g, '').slice(-10);
    const leadKey = r.leadId ? `lead_${r.leadId}` : '';
    const custKey = r.customerId ? `cust_${r.customerId}` : '';
    if (callKey && dismissed.has(callKey)) return false;
    if (phoneRaw && dismissed.has(phoneRaw)) return false;
    if (phoneDigits && dismissed.has(phoneDigits)) return false;
    if (leadKey && dismissed.has(leadKey)) return false;
    if (custKey && dismissed.has(custKey)) return false;
    return true;
  });
}

export async function getIrmOtherRecords(params?: { module?: string; search?: string }): Promise<IrmOtherRecord[]> {
  try {
    const res: ApiResponse<IrmOtherRecord[]> = await apiClient.get('/irm/other', params);
    if (res.success && res.data) return filterOtherRecords(res.data);
  } catch {
    try {
      const fallbackRes: ApiResponse<IrmOtherRecord[]> = await apiClient.get('/sales-executive/calls/other', params);
      if (fallbackRes.success && fallbackRes.data) return filterOtherRecords(fallbackRes.data);
    } catch {}
  }
  return [];
}

export async function moveIrmOtherRecord(
  recordOrCallId: number | MoveIrmOtherRecordOptions,
  targetModuleParam?: string
): Promise<boolean> {
  const opts: MoveIrmOtherRecordOptions =
    typeof recordOrCallId === 'number'
      ? { callId: recordOrCallId, targetModule: targetModuleParam }
      : recordOrCallId;

  const callId = opts.callId;
  const targetModule = (opts.targetModule || 'kyc').toLowerCase();
  const phoneDigits = (opts.contactPhone || '').replace(/\D/g, '').slice(-10);

  // 1. Immediately persist dismissal & moved state into localStorage
  try {
    const raw = localStorage.getItem('nexus_dismissed_other_records');
    const dismissedList: string[] = raw ? JSON.parse(raw) : [];
    const addKey = (k?: string | number) => {
      if (!k) return;
      const s = String(k).trim();
      if (s && !dismissedList.includes(s)) dismissedList.push(s);
    };
    addKey(callId);
    addKey(opts.contactPhone);
    addKey(phoneDigits);
    if (opts.leadId) addKey(`lead_${opts.leadId}`);
    if (opts.customerId) addKey(`cust_${opts.customerId}`);
    localStorage.setItem('nexus_dismissed_other_records', JSON.stringify(dismissedList));

    const movedRaw = localStorage.getItem('nexus_moved_other_records');
    const movedList: string[] = movedRaw ? JSON.parse(movedRaw) : [];
    const addMovedKey = (k?: string | number) => {
      if (!k) return;
      const s = String(k).trim();
      if (s && !movedList.includes(s)) movedList.push(s);
    };
    addMovedKey(callId);
    addMovedKey(opts.contactPhone);
    addMovedKey(phoneDigits);
    if (opts.leadId) addMovedKey(`lead_${opts.leadId}`);
    if (opts.customerId) addMovedKey(`cust_${opts.customerId}`);
    localStorage.setItem('nexus_moved_other_records', JSON.stringify(movedList));
  } catch {}

  // 2. Advance call record on the backend so backend otherMatcher clears
  if (opts.contactName || opts.contactPhone) {
    try {
      await logCall({
        id: `call-move-${Date.now()}`,
        contactName: opts.contactName || 'Contact',
        contactPhone: opts.contactPhone || '',
        direction: 'Outbound',
        duration: 0,
        disposition: (targetModule === 'my_leads' || targetModule === 'follow_up') ? 'Follow-up Required' : 'Contacted',
        callModule: (targetModule as any) || 'kyc',
        leadId: opts.leadId ? String(opts.leadId) : undefined,
        customerId: opts.customerId ? String(opts.customerId) : undefined,
        notes: `[Moved back to ${targetModule.toUpperCase()} from Other Contacts by ${opts.actorName || 'IRM'}]`,
        timestamp: new Date().toISOString(),
      } as any);
    } catch (err) {
      console.warn('[moveIrmOtherRecord] Failed to advance call cluster on backend:', err);
    }
  }

  // 3. Attempt direct move route on backend (if backend is recompiled)
  try {
    const moveUrl = `/irm/other/${callId}/move${targetModule ? `?targetModule=${encodeURIComponent(targetModule)}` : ''}`;
    await apiClient.post(moveUrl);
  } catch {
    try {
      const fallbackUrl = `/sales-executive/calls/other/${callId}/move${targetModule ? `?targetModule=${encodeURIComponent(targetModule)}` : ''}`;
      await apiClient.post(fallbackUrl);
    } catch {}
  }

  // 4. Restore/create entity in target module
  try {
    if (targetModule === 'kyc') {
      let allDeals: Deal[] = [];
      try {
        allDeals = await getDeals(opts.tenantId);
      } catch {
        allDeals = storageService.getDeals(opts.tenantId) || [];
      }
      const matchDeal = allDeals.find(d =>
        (phoneDigits && d.phone && d.phone.replace(/\D/g, '').slice(-10) === phoneDigits) ||
        (opts.customerId && String(d.customerId) === String(opts.customerId)) ||
        (opts.contactName && d.customerName && d.customerName.toLowerCase().trim() === opts.contactName.toLowerCase().trim())
      );

      const kycDeal: Deal = {
        id: matchDeal?.id || `deal-kyc-${Date.now()}`,
        companyId: opts.tenantId || 't-ghl-01',
        title: matchDeal?.title || `${opts.contactName || 'Investor'} - KYC Verification`,
        customerId: opts.customerId ? String(opts.customerId) : (matchDeal?.customerId || (opts.leadId ? `lead-${opts.leadId}` : `c-${Date.now()}`)),
        customerName: opts.contactName || matchDeal?.customerName || '',
        phone: opts.contactPhone || matchDeal?.phone || '',
        email: opts.contactEmail && opts.contactEmail !== '—' ? opts.contactEmail : matchDeal?.email,
        location: opts.contactLocation && opts.contactLocation !== '—' ? opts.contactLocation : matchDeal?.location,
        stage: 'qualified_investor',
        stageEnteredAt: new Date().toISOString(),
        value: matchDeal?.value ?? 0,
        expectedCloseDate: matchDeal?.expectedCloseDate || new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
        assignedAgentId: String(opts.assignedAgentId || matchDeal?.assignedAgentId || '5'),
        assignedAgentName: opts.assignedAgentName || matchDeal?.assignedAgentName || 'Dhinakaran',
        notes: `Restored to KYC verification from Other Contacts. Reason: ${opts.reason || 'None'}.`,
        priority: matchDeal?.priority || 'High',
        createdAt: matchDeal?.createdAt || new Date().toISOString().slice(0, 10),
      };

      try {
        await saveDeal(kycDeal);
      } catch {
        storageService.saveDeal(kycDeal);
      }
      storageService.saveDeal(kycDeal);

      if (opts.leadId) {
        try {
          const leads = await getLeads(opts.tenantId).catch(() => []);
          const matchLead = leads.find(l => String(l.id) === String(opts.leadId));
          if (matchLead) {
            const updatedLead: Lead = {
              ...matchLead,
              status: 'Contacted',
              assignedIrmId: opts.assignedAgentId ? String(opts.assignedAgentId) : matchLead.assignedIrmId || '5',
              assignedIrmName: opts.assignedAgentName || matchLead.assignedIrmName || 'Dhinakaran',
            };
            await saveLead(updatedLead).catch(() => storageService.saveLead(updatedLead));
            storageService.saveLead(updatedLead);
          }
        } catch {}
      }
    } else if (targetModule === 'follow_up') {
      let allFollowups: Followup[] = [];
      try {
        allFollowups = await getFollowups(opts.tenantId);
      } catch {
        allFollowups = storageService.getFollowups(opts.tenantId) || [];
      }
      const matchFollowup = allFollowups.find(f =>
        (phoneDigits && f.contactPhone && f.contactPhone.replace(/\D/g, '').slice(-10) === phoneDigits) ||
        (opts.contactName && f.contactName && f.contactName.toLowerCase().trim() === opts.contactName.toLowerCase().trim())
      );
      const targetFollowup: Followup = {
        id: matchFollowup?.id || `f-${Date.now()}`,
        companyId: opts.tenantId || 't-ghl-01',
        contactId: opts.leadId ? String(opts.leadId) : (matchFollowup?.contactId || (opts.customerId ? String(opts.customerId) : `c-${Date.now()}`)),
        contactName: opts.contactName || matchFollowup?.contactName || '',
        contactPhone: opts.contactPhone || matchFollowup?.contactPhone || '',
        contactEmail: opts.contactEmail && opts.contactEmail !== '—' ? opts.contactEmail : matchFollowup?.contactEmail,
        contactType: opts.customerId ? 'customer' : 'lead',
        scheduledAt: matchFollowup?.scheduledAt || new Date().toISOString(),
        scheduledDate: matchFollowup?.scheduledDate || new Date().toISOString().slice(0, 10),
        scheduledTime: matchFollowup?.scheduledTime || '11:00',
        status: 'Pending',
        priority: matchFollowup?.priority || 'High',
        notes: `Restored to Follow-up from Other Contacts. Reason: ${opts.reason || 'None'}.`,
        assignedAgentName: opts.assignedAgentName || matchFollowup?.assignedAgentName || 'Dhinakaran',
        assignedAgentId: opts.assignedAgentId ? String(opts.assignedAgentId) : matchFollowup?.assignedAgentId || '5',
      };
      try {
        await saveFollowup(targetFollowup);
      } catch {
        storageService.saveFollowup(targetFollowup);
      }
      storageService.saveFollowup(targetFollowup);
    } else if (targetModule === 'my_leads') {
      if (opts.leadId) {
        try {
          const leads = await getLeads(opts.tenantId).catch(() => []);
          const matchLead = leads.find(l => String(l.id) === String(opts.leadId));
          if (matchLead) {
            const updatedLead: Lead = {
              ...matchLead,
              status: 'Contacted',
              assignedIrmId: opts.assignedAgentId ? String(opts.assignedAgentId) : matchLead.assignedIrmId || '5',
              assignedIrmName: opts.assignedAgentName || matchLead.assignedIrmName || 'Dhinakaran',
            };
            await saveLead(updatedLead).catch(() => storageService.saveLead(updatedLead));
            storageService.saveLead(updatedLead);
          }
        } catch {}
      }
    } else if (targetModule === 'opportunities') {
      let allDeals: Deal[] = [];
      try {
        allDeals = await getDeals(opts.tenantId);
      } catch {
        allDeals = storageService.getDeals(opts.tenantId) || [];
      }
      const matchDeal = allDeals.find(d =>
        (phoneDigits && d.phone && d.phone.replace(/\D/g, '').slice(-10) === phoneDigits) ||
        (opts.contactName && d.customerName && d.customerName.toLowerCase().trim() === opts.contactName.toLowerCase().trim())
      );
      const oppDeal: Deal = {
        id: matchDeal?.id || `deal-opp-${Date.now()}`,
        companyId: opts.tenantId || 't-ghl-01',
        title: matchDeal?.title || `${opts.contactName || 'Lead'} - Investment Opportunity`,
        customerId: opts.customerId ? String(opts.customerId) : (matchDeal?.customerId || (opts.leadId ? `lead-${opts.leadId}` : `c-${Date.now()}`)),
        customerName: opts.contactName || matchDeal?.customerName || '',
        phone: opts.contactPhone || matchDeal?.phone || '',
        email: opts.contactEmail && opts.contactEmail !== '—' ? opts.contactEmail : matchDeal?.email,
        location: opts.contactLocation && opts.contactLocation !== '—' ? opts.contactLocation : matchDeal?.location,
        stage: 'investment_opportunity',
        stageEnteredAt: new Date().toISOString(),
        value: matchDeal?.value ?? 5000000,
        expectedCloseDate: matchDeal?.expectedCloseDate || new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
        assignedAgentId: String(opts.assignedAgentId || matchDeal?.assignedAgentId || '5'),
        assignedAgentName: opts.assignedAgentName || matchDeal?.assignedAgentName || 'Dhinakaran',
        notes: `Restored to Opportunities from Other Contacts. Reason: ${opts.reason || 'None'}.`,
        priority: matchDeal?.priority || 'High',
        createdAt: matchDeal?.createdAt || new Date().toISOString().slice(0, 10),
      };
      try {
        await saveDeal(oppDeal);
      } catch {
        storageService.saveDeal(oppDeal);
      }
      storageService.saveDeal(oppDeal);
    } else if (targetModule === 'investor_360') {
      let allCust: Customer[] = [];
      try {
        allCust = await getCustomers(opts.tenantId);
      } catch {
        allCust = storageService.getCustomers(opts.tenantId) || [];
      }
      const matchCust = allCust.find(c =>
        (phoneDigits && c.phone && c.phone.replace(/\D/g, '').slice(-10) === phoneDigits) ||
        (opts.contactName && c.name && c.name.toLowerCase().trim() === opts.contactName.toLowerCase().trim())
      );
      if (!matchCust && opts.contactName) {
        const newCust: Customer = {
          id: opts.customerId ? String(opts.customerId) : `cust-${Date.now()}`,
          companyId: opts.tenantId || 't-ghl-01',
          name: opts.contactName,
          phone: opts.contactPhone || '',
          email: opts.contactEmail || '',
          status: 'Active',
          assignedAgentId: String(opts.assignedAgentId || '5'),
          assignedAgentName: opts.assignedAgentName || 'Dhinakaran',
          location: opts.contactLocation || 'India',
          lastContacted: new Date().toISOString(),
          openDealsCount: 0,
          totalValue: 0,
          createdAt: new Date().toISOString(),
          notes: '',
          customFields: {},
        };
        try {
          await saveCustomer(newCust);
        } catch {
          storageService.saveCustomer(newCust);
        }
        storageService.saveCustomer(newCust);
      }
    }
  } catch (err) {
    console.error('[moveIrmOtherRecord] Target entity restoration error:', err);
  }

  window.dispatchEvent(new Event('nexus_storage_updated'));
  window.dispatchEvent(new Event('nexus_call_logged'));
  return true;
}

export async function getIrmCallOutcomes(module?: string): Promise<Record<string, string[]>> {
  try {
    const res: ApiResponse<Record<string, string[]>> = await apiClient.get('/irm/call-outcomes', module ? { module } : undefined);
    if (res.success && res.data) return res.data;
  } catch {
    try {
      const fallbackRes: ApiResponse<Record<string, string[]>> = await apiClient.get('/sales-executive/calls/outcomes', module ? { module } : undefined);
      if (fallbackRes.success && fallbackRes.data) return fallbackRes.data;
    } catch {}
  }
  return {
    my_leads: ['Follow-up Required', 'No Response', 'Call Back'],
    follow_up: ['Follow-up Required', 'Other', 'No Response', 'Call Back', 'Ready for KYC'],
    kyc: ['Contacted', 'Other', 'No Response', 'Call Back'],
    opportunities: ['Contacted', 'Other', 'No Response', 'Call Back'],
    investor_360: ['Contacted', 'Other', 'No Response', 'Call Back'],
  };
}

export interface TransitionFollowupToKycOptions {
  contactName: string;
  contactPhone: string;
  contactEmail?: string;
  contactLocation?: string;
  contactId?: string;
  followupId?: string;
  followupNotes?: string;
  followupPriority?: 'Low' | 'Medium' | 'High';
  investmentAmount?: number | string;
  preferredAssetClass?: string;
  investmentHorizon?: string;
  isPrefConfirmed?: boolean;
  assignedAgentId?: string;
  assignedAgentName?: string;
  tenantId?: string;
  tenantName?: string;
  actorName?: string;
  actorEmail?: string;
}

export async function transitionFollowupToKyc(options: TransitionFollowupToKycOptions): Promise<void> {
  const fDigits = (options.contactPhone || '').replace(/\D/g, '').slice(-10);
  const resolvedContactId = options.contactId || (fDigits ? `contact-${fDigits}` : `contact-${Date.now()}`);

  let allDeals: Deal[] = [];
  try {
    allDeals = await getDeals(options.tenantId);
  } catch {
    allDeals = storageService.getDeals(options.tenantId) || [];
  }

  const existingDeal = allDeals.find(d =>
    (d.customerId && d.customerId === resolvedContactId) ||
    (d.phone && fDigits && (d.phone || '').replace(/\D/g, '').slice(-10) === fDigits)
  );

  const numVal = options.investmentAmount
    ? (typeof options.investmentAmount === 'number' ? options.investmentAmount : parseFloat(String(options.investmentAmount).replace(/,/g, '')) || 0)
    : (existingDeal?.value ?? 0);

  const kycDeal: Deal = {
    id: existingDeal?.id || `deal-kyc-${Date.now()}`,
    companyId: options.tenantId || 't-ghl-01',
    title: `${options.contactName} - KYC Verification`,
    customerId: resolvedContactId,
    customerName: options.contactName,
    phone: options.contactPhone,
    email: options.contactEmail && options.contactEmail !== '—' ? options.contactEmail : undefined,
    location: options.contactLocation && options.contactLocation !== '—' ? options.contactLocation : undefined,
    stage: 'qualified_investor',
    stageEnteredAt: new Date().toISOString(),
    value: numVal,
    expectedCloseDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
    assignedAgentId: options.assignedAgentId || '',
    assignedAgentName: options.assignedAgentName || '',
    notes: `Ready for KYC. Moved from Follow-ups by IRM (${options.actorName || ''}).`,
    createdAt: existingDeal?.createdAt || new Date().toISOString().slice(0, 10),
    priority: options.followupPriority || 'High',
    ...(options.preferredAssetClass && options.isPrefConfirmed ? { preferredAssetClass: options.preferredAssetClass } : {}),
    ...(options.investmentAmount ? { investmentRange: String(options.investmentAmount) } : {}),
  };

  await saveDeal(kycDeal);

  if (options.followupId) {
    try {
      const followups = await getFollowups(options.tenantId);
      const match = followups.find(f => f.id === options.followupId);
      if (match) {
        await saveFollowup({
          ...match,
          status: 'Completed',
          notes: `${match.notes ? match.notes + ' | ' : ''}Ready for KYC: Moved to KYC Module by IRM`,
        });
      }
    } catch (err) {
      console.error('[transitionFollowupToKyc] Failed to mark follow-up completed:', err);
    }
  }

  try {
    const leads = await getLeads(options.tenantId).catch(() => []);
    const localLeads = storageService.getLeads(options.tenantId) || [];
    const pool = [...leads, ...localLeads];
    const matchingLead = pool.find(l => {
      if (l.id === options.contactId) return true;
      const lDigits = (l.phone || '').replace(/\D/g, '').slice(-10);
      return Boolean(lDigits && fDigits && lDigits === fDigits);
    });

    const leadToSave: Lead = matchingLead ? {
      ...matchingLead,
      status: 'Qualified',
      customFields: {
        ...(matchingLead.customFields || {}),
        ...(options.preferredAssetClass && options.isPrefConfirmed ? { preferredAssetClass: options.preferredAssetClass } : {}),
        ...(options.investmentHorizon && options.isPrefConfirmed ? { horizon: options.investmentHorizon, investmentHorizon: options.investmentHorizon } : {}),
        ...(numVal > 0 ? { investmentAmount: String(numVal) } : {}),
        irmPreferencesConfirmed: Boolean(options.isPrefConfirmed),
        movedToKycAt: new Date().toISOString(),
      },
    } : {
      id: options.contactId,
      companyId: options.tenantId || '1',
      name: options.contactName,
      phone: options.contactPhone,
      email: options.contactEmail || '',
      location: options.contactLocation || '',
      status: 'Qualified',
      priority: options.followupPriority || 'Medium',
      createdAt: new Date().toISOString(),
      customFields: {
        ...(options.preferredAssetClass && options.isPrefConfirmed ? { preferredAssetClass: options.preferredAssetClass } : {}),
        ...(options.investmentHorizon && options.isPrefConfirmed ? { horizon: options.investmentHorizon, investmentHorizon: options.investmentHorizon } : {}),
        ...(numVal > 0 ? { investmentAmount: String(numVal) } : {}),
        irmPreferencesConfirmed: Boolean(options.isPrefConfirmed),
        movedToKycAt: new Date().toISOString(),
      },
    } as unknown as Lead;

    await saveLead(leadToSave);
  } catch (err) {
    console.error('[transitionFollowupToKyc] Failed to update lead:', err);
  }

  storageService.addAuditLog({
    id: `aud-${Date.now()}`,
    timestamp: new Date().toISOString(),
    actorName: options.actorName || 'IRM',
    actorEmail: options.actorEmail || 'irm@ghl.com',
    action: 'DEAL_CREATED_KYC',
    entityType: 'Deal',
    entityId: kycDeal.id,
    companyId: options.tenantId || 't-ghl-01',
    companyName: options.tenantName || 'GHL India Ventures',
    details: `Moved ${options.contactName} to KYC verification module`,
  });

  window.dispatchEvent(new Event('nexus_storage_updated'));
}

export interface SendCustomerMessagePayload {
  recipientEmail?: string;
  recipientPhone?: string;
  recipientName: string;
  message: string;
  channel?: string;
  leadId?: number;
  customerId?: number;
  dealId?: number;
}

export interface SendCustomerMessageResult {
  success: boolean;
  delivered: boolean;
  channel: string;
  recipient?: string;
  message: string;
  deliveryResult: string;
  sentAt: string;
  sentByName: string;
  sentByRole: string;
}

export async function sendCustomerMessage(
  payload: SendCustomerMessagePayload
): Promise<SendCustomerMessageResult> {
  const res: ApiResponse<SendCustomerMessageResult> = await apiClient.post(
    '/sales-executive/calls/send-customer-message',
    payload
  );
  if (res && res.data) {
    return res.data;
  }
  return {
    success: false,
    delivered: false,
    channel: payload.channel || 'email',
    recipient: payload.recipientEmail || payload.recipientPhone,
    message: payload.message,
    deliveryResult: res?.message || 'Failed to dispatch customer message',
    sentAt: new Date().toISOString(),
    sentByName: '',
    sentByRole: '',
  };
}

export interface MessagingChannelStatus {
  channel: 'email' | 'sms' | 'whatsapp';
  name: string;
  configured: boolean;
  provider: string;
  statusMessage: string;
}

export async function getMessagingChannels(): Promise<MessagingChannelStatus[]> {
  try {
    const res: ApiResponse<MessagingChannelStatus[]> = await apiClient.get(
      '/sales-executive/calls/messaging-channels'
    );
    if (res && res.data) {
      return res.data;
    }
  } catch (err) {
    console.error('Failed to fetch messaging channels from backend', err);
  }
  return [
    { channel: 'email', name: 'Email', configured: true, provider: 'SMTP (smtp.gmail.com)', statusMessage: 'Active and configured via Gmail SMTP.' },
    { channel: 'sms', name: 'SMS', configured: false, provider: 'None', statusMessage: 'No SMS gateway provider (e.g., Twilio / AWS SNS) is configured on the backend server.' },
    { channel: 'whatsapp', name: 'WhatsApp', configured: false, provider: 'None', statusMessage: 'No WhatsApp Business API provider is configured on the backend server.' },
  ];
}

export async function getCallById(id: string | number): Promise<CallRecord> {
  const numericId = typeof id === 'string' ? parseInt(id.replace(/\D/g, ''), 10) : id;
  const res: ApiResponse<any> = await apiClient.get(`/sales-executive/calls/${numericId || id}`);
  if (!res.success || !res.data) throw new Error(res.message || 'Call record not found');
  return mapCallRecord(res.data);
}

// ══════════════════════════════════════════════════════════════════════════════
// CONSULTATIONS  (delegates to existing SalesExecutiveConsultationsController)
// ══════════════════════════════════════════════════════════════════════════════

function mapConsultation(c: Record<string, any>): Consultation {
  return {
    id: sid(c.id),
    companyId: sid(c.companyId),
    investorId: c.investorId ?? '',
    investorName: c.investorName ?? '',
    investorPhone: c.investorPhone ?? '',
    scheduledAt: c.scheduledAt ?? new Date().toISOString(),
    consultantId: sid(c.consultantId),
    consultantName: c.consultantName ?? '',
    status: c.status ?? 'Scheduled',
    agenda: c.agenda ?? '',
    outcomeNotes: c.outcomeNotes,
    referredByAgentName: c.referredByAgentName,
  };
}

export async function getConsultations(companyId?: string): Promise<Consultation[]> {
  const raw = await fetchAll<any>('/sales-executive/consultations');
  return raw.map(mapConsultation);
}

export async function saveConsultation(consultation: Consultation): Promise<Consultation> {
  const isNew =
    !consultation.id ||
    consultation.id.startsWith('cons-') ||
    consultation.id.startsWith('co-');

  const payload = {
    investorId: consultation.investorId,
    investorName: consultation.investorName,
    investorPhone: consultation.investorPhone,
    scheduledAt: consultation.scheduledAt,
    agenda: consultation.agenda,
    outcomeNotes: consultation.outcomeNotes,
    referredByAgentName: consultation.referredByAgentName,
  };

  if (isNew) {
    const res: ApiResponse<any> = await apiClient.post(
      '/sales-executive/consultations',
      payload
    );
    if (!res.success || !res.data) throw new Error(res.message);
    window.dispatchEvent(new Event('nexus_storage_updated'));
    return mapConsultation(res.data);
  } else {
    const updatePayload = {
      scheduledAt: consultation.scheduledAt,
      status: consultation.status,
      agenda: consultation.agenda,
      outcomeNotes: consultation.outcomeNotes,
    };
    const res: ApiResponse<any> = await apiClient.put(
      `/sales-executive/consultations/${nid(consultation.id)}`,
      updatePayload
    );
    if (!res.success || !res.data) throw new Error(res.message);
    window.dispatchEvent(new Event('nexus_storage_updated'));
    return mapConsultation(res.data);
  }
}

export interface IrmPipelineCardData {
  id: number;
  companyId: number;
  investorId: number;
  assignedIrmId: number;
  assignedIrmName: string;
  investorName: string;
  investorPhone: string;
  investorEmail: string;
  stageId: string;
  stageEnteredAt: string;
  lastActionSnippet?: string;
  lastActivityDate?: string;
  priority: string;
  value?: number;
  investmentAmount?: string;
  preferredAssetClass?: string;
  activityLogsJson?: string;
  createdAt: string;
}

export interface IrmPipelineBoardData {
  stages: {
    id: string;
    name: string;
    color: string;
    cards: IrmPipelineCardData[];
  }[];
}

export async function getIrmPipelineBoard(irmId?: number): Promise<IrmPipelineBoardData | null> {
  try {
    const res = await apiClient.get<ApiResponse<IrmPipelineBoardData>>(
      `/irm/pipeline${irmId ? `?irmId=${irmId}` : ''}`
    );
    if (res.success && res.data) {
      return res.data;
    }
  } catch (err) {
    console.warn('[ghlApiService] getIrmPipelineBoard failed:', err);
  }
  return null;
}

export async function moveIrmPipelineCard(cardId: number, targetStageId: string): Promise<boolean> {
  try {
    const res = await apiClient.put<ApiResponse<any>>(`/irm/pipeline/${cardId}/move`, {
      targetStageId,
    });
    return !!res.success;
  } catch (err) {
    console.warn('[ghlApiService] moveIrmPipelineCard failed:', err);
    return false;
  }
}

export async function getCompanyIrms(companyId?: string): Promise<IrmProfile[]> {
  try {
    const res = await apiClient.get<ApiResponse<any[]>>('/sales-executive/consultations/irms');
    if (res && res.success && Array.isArray(res.data) && res.data.length > 0) {
      return res.data.map(u => ({
        id: String(u.id),
        name: u.name,
        email: u.email || '',
        phone: u.phone || '',
        status: (u.status === 'Busy' ? 'Busy' : 'Available') as 'Available' | 'Busy',
        experience: u.specialization || 'Private Wealth & Advisory',
        experienceYears: 5,
        experienceLevel: 'Experienced' as const,
        performance: 95,
      }));
    }
    return [];
  } catch (err) {
    console.warn('[ghlApiService] getCompanyIrms failed:', err);
    return [];
  }
}
