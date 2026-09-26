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
} from '../types';

// ── ID type helpers ───────────────────────────────────────────────────────────
// Backend uses int IDs; frontend types use string.
const sid = (n: number | string | undefined | null): string => String(n ?? '');
const nid = (s: string | undefined | null): number => parseInt(s ?? '0', 10) || 0;

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

/** Fetch all pages and return flat array (backend defaults to pageSize=100). */
async function fetchAll<T>(path: string, params: Record<string, string> = {}): Promise<T[]> {
  const qs = new URLSearchParams({ pageSize: '200', ...params }).toString();
  const res: ApiResponse<PagedResult<T>> = await apiClient.get(`${path}?${qs}`);
  if (!res.success || !res.data) return [];
  return res.data.items;
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
  };
}

export async function getDeals(companyId?: string): Promise<Deal[]> {
  const raw = await fetchAll<any>('/ghl/deals');
  return raw.map(mapDeal);
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
    window.dispatchEvent(new Event('nexus_storage_updated'));
    return mapDeal(res.data);
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
    };
    const res: ApiResponse<any> = await apiClient.put(`/ghl/deals/${nid(deal.id)}`, payload);
    if (!res.success || !res.data) throw new Error(res.message);
    window.dispatchEvent(new Event('nexus_storage_updated'));
    return mapDeal(res.data);
  }
}

export async function deleteDeal(dealId: string): Promise<void> {
  await apiClient.delete(`/ghl/deals/${nid(dealId)}`);
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
  if (!res.success || !res.data) return [];
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
    assignedAgentId: sid(l.assignedAgentId),
    assignedAgentName: l.assignedAgentName ?? '',
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

  if (isNew) {
    const payload = {
      name: lead.name,
      phone: lead.phone,
      email: lead.email,
      location: lead.location,
      source: lead.source,
      priority: lead.priority,
      notes: lead.notes,
      investmentCapacity: customFields['Investment Capacity'] ?? customFields['investmentCapacity'],
      assetClass: customFields['Asset Class'] ?? customFields['assetClass'],
      preferredAssetClass: customFields['Preferred Asset Class'] ?? customFields['preferredAssetClass'],
      horizon: customFields['Horizon'] ?? customFields['horizon'],
    };
    const res: ApiResponse<any> = await apiClient.post('/sales-executive/leads', payload);
    if (!res.success || !res.data) throw new Error(res.message);
    window.dispatchEvent(new Event('nexus_storage_updated'));
    return mapLead(res.data);
  } else {
    const payload = {
      name: lead.name,
      phone: lead.phone,
      email: lead.email,
      location: lead.location,
      source: lead.source,
      status: lead.status,
      priority: lead.priority,
      notes: lead.notes,
      nextFollowupDate: lead.nextFollowupDate,
    };
    const res: ApiResponse<any> = await apiClient.put(
      `/sales-executive/leads/${nid(lead.id)}`,
      payload
    );
    if (!res.success || !res.data) throw new Error(res.message);
    window.dispatchEvent(new Event('nexus_storage_updated'));
    return mapLead(res.data);
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
    assignedAgentName: f.assignedAgentName ?? '',
    completedAt: f.completedAt,
  };
}

export async function getFollowups(companyId?: string): Promise<Followup[]> {
  const raw = await fetchAll<any>('/sales-executive/followups');
  return raw.map(mapFollowup);
}

export async function saveFollowup(followup: Followup): Promise<Followup> {
  const isNew =
    !followup.id || followup.id.startsWith('fu-') || followup.id.startsWith('f-');

  if (isNew) {
    const payload = {
      contactId: followup.contactId,
      contactType: followup.contactType,
      contactName: followup.contactName,
      contactPhone: followup.contactPhone,
      scheduledAt: followup.scheduledAt,
      priority: followup.priority,
      notes: followup.notes,
    };
    const res: ApiResponse<any> = await apiClient.post(
      '/sales-executive/followups',
      payload
    );
    if (!res.success || !res.data) throw new Error(res.message);
    window.dispatchEvent(new Event('nexus_storage_updated'));
    return mapFollowup(res.data);
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
    if (!res.success || !res.data) throw new Error(res.message);
    window.dispatchEvent(new Event('nexus_storage_updated'));
    return mapFollowup(res.data);
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

  const payload = {
    name: customer.name,
    phone: customer.phone,
    email: customer.email,
    location: customer.location,
    status: customer.status,
    notes: customer.notes,
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
  return {
    id: sid(c.id),
    companyId: sid(c.companyId),
    contactName: c.contactName ?? '',
    contactPhone: c.contactPhone ?? '',
    direction: c.direction ?? 'outbound',
    duration: c.duration ?? 0,
    agentId: sid(c.agentId),
    agentName: c.agentName ?? '',
    disposition: c.disposition ?? 'No Response',
    timestamp: c.timestamp ?? new Date().toISOString(),
    notes: c.notes,
    leadId: c.leadId ? sid(c.leadId) : undefined,
    customerId: c.customerId ? sid(c.customerId) : undefined,
  };
}

export async function getCalls(companyId?: string): Promise<CallRecord[]> {
  const raw = await fetchAll<any>('/sales-executive/calls');
  return raw.map(mapCallRecord);
}

export async function logCall(call: CallRecord): Promise<CallRecord> {
  const payload = {
    contactName: call.contactName,
    contactPhone: call.contactPhone,
    direction: call.direction,
    duration: call.duration,
    disposition: call.disposition,
    notes: call.notes,
    leadId: call.leadId ? nid(call.leadId) : undefined,
    customerId: call.customerId ? nid(call.customerId) : undefined,
  };
  const res: ApiResponse<any> = await apiClient.post('/sales-executive/calls', payload);
  if (!res.success || !res.data) throw new Error(res.message);
  window.dispatchEvent(new Event('nexus_storage_updated'));
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

