import { apiClient, ApiResponse } from './apiClient';
import { getLeads, getFollowups, getCustomers } from './ghlApiService';
import { Lead } from '../types';

import { storageService } from './storageService';
import { getDeals } from './ghlApiService';

export interface IrmAllLeadItem {
  id: number | string;
  companyId?: number;
  name: string;
  phone: string;
  email: string;
  location: string;
  source: string;
  status: string;
  priority: string;
  notes?: string;
  assignedAgentId?: number;
  assignedAgentName?: string;
  assignedById?: number;
  assignedByName?: string;
  assignedAt?: string;
  createdAt: string;
  updatedAt?: string;
  currentStage: 'My Leads' | 'Follow-up' | 'KYC' | 'Opportunities' | 'Archived' | string;
  stageDetails?: string;
  kycStatus?: string;
  nextFollowupDate?: string;
  dealValue?: number;
  dealStage?: string;
  investmentCapacity?: string;
  preferredAssetClass?: string;
}

export interface IrmAllLeadsSummary {
  totalAssignedLeads: number;
  inMyLeads: number;
  inFollowup: number;
  inKyc: number;
  inOpportunities: number;
  converted: number;
  leads: IrmAllLeadItem[];
}

export async function fetchIrmAllLeads(
  currentUserId?: string | number,
  options?: { search?: string; stage?: string; irmId?: number },
  currentUserName?: string,
  tenantId?: string
): Promise<IrmAllLeadsSummary> {
  // 1. Try fetching from the real backend endpoint first
  try {
    const query = new URLSearchParams();
    if (options?.irmId) query.set('irmId', String(options.irmId));
    if (options?.search) query.set('search', options.search);
    if (options?.stage && options.stage !== 'all') query.set('stage', options.stage);

    const queryString = query.toString() ? `?${query.toString()}` : '';
    const res = await apiClient.get<ApiResponse<IrmAllLeadsSummary>>(`/irm/all-leads${queryString}`);

    if (res && res.success && res.data && res.data.leads && res.data.leads.length > 0) {
      return res.data;
    }
  } catch (err) {
    console.warn('[IrmAllLeadsService] Backend endpoint error or offline, computing from store:', err);
  }

  // 2. Comprehensive local + API computation fallback
  const [apiLeads, apiFollowups, apiCustomers, apiDeals] = await Promise.all([
    getLeads(tenantId).catch(() => [] as Lead[]),
    getFollowups(tenantId).catch(() => []),
    getCustomers(tenantId).catch(() => []),
    getDeals(tenantId).catch(() => []),
  ]);

  const localLeads = storageService.getLeads(tenantId) || [];
  const localFollowups = storageService.getFollowups(tenantId) || [];
  const localCustomers = storageService.getCustomers(tenantId) || [];
  const localDeals = storageService.getDeals(tenantId) || [];

  // Merge leads (deduplicated by phone or id)
  const leadsMap = new Map<string, Lead>();
  [...localLeads, ...apiLeads].forEach(l => {
    const key = (l.phone ? l.phone.replace(/\D/g, '').slice(-10) : '') || String(l.id);
    if (!leadsMap.has(key)) {
      leadsMap.set(key, l);
    }
  });
  const allLeads = Array.from(leadsMap.values());

  // Merge followups
  const allFollowups = [...localFollowups, ...(apiFollowups || [])];
  const pendingFollowups = allFollowups.filter(f => f.status === 'Pending');

  // Merge customers
  const allCustomers = [...localCustomers, ...(apiCustomers || [])];

  // Merge deals
  const allDeals = [...localDeals, ...(apiDeals || [])];

  // Strict isolation: only leads assigned to this specific IRM
  const isMine = (l: Lead) => {
    if (!currentUserId && !currentUserName) return false;
    const lAgentId = l.assignedAgentId != null ? String(l.assignedAgentId) : '';
    const lAgentName = (l.assignedAgentName || '').trim().toLowerCase();
    const idMatch = Boolean(currentUserId && lAgentId && lAgentId === String(currentUserId));
    const nameMatch = Boolean(currentUserName && lAgentName && lAgentName === currentUserName.trim().toLowerCase());
    return idMatch || nameMatch;
  };

  const irmLeads = allLeads.filter(isMine);

  const items: IrmAllLeadItem[] = irmLeads.map(l => {
    const cleanPhone = (l.phone || '').replace(/\D/g, '').slice(-10);

    const matchedCustomer = allCustomers.find(c => {
      const cPhone = (c.phone || '').replace(/\D/g, '').slice(-10);
      return (cleanPhone && cPhone === cleanPhone) || (c.name && c.name.toLowerCase() === l.name.toLowerCase());
    });

    const matchedDeal = allDeals.find(d => {
      const dPhone = (d.phone || '').replace(/\D/g, '').slice(-10);
      return (cleanPhone && dPhone === cleanPhone) ||
        (matchedCustomer && String(d.customerId) === String(matchedCustomer.id)) ||
        (d.customerName && d.customerName.toLowerCase() === l.name.toLowerCase());
    });

    const matchedFollowup = pendingFollowups.find(f => {
      const fPhone = (f.contactPhone || '').replace(/\D/g, '').slice(-10);
      return (cleanPhone && fPhone === cleanPhone) || (f.contactId && String(f.contactId) === String(l.id));
    });

    let currentStage: 'My Leads' | 'Follow-up' | 'KYC' | 'Opportunities' | 'Converted' | 'Archived' = 'My Leads';
    let stageDetails = 'Active assigned lead';
    let kycStatus: string | undefined = undefined;

    if (matchedDeal) {
      const dStage = (matchedDeal.stage || '').trim().toLowerCase();
      const dealVal = matchedDeal.value;

      if (dStage === 'qualified_investor' || dStage === 'qualified') {
        currentStage = 'KYC';
        kycStatus = 'Verified';
        stageDetails = "Deal in 'qualified_investor' stage (KYC Verification)";
      } else if (dStage === 'investment_opportunity' || dStage === 'opportunity' || dStage === 'term_sheet' || dStage === 'committed') {
        currentStage = 'Opportunities';
        stageDetails = dealVal ? `Active Opportunity (₹${dealVal.toLocaleString('en-IN')})` : `Deal in '${matchedDeal.stage}' stage`;
      } else if (dStage === 'converted' || dStage === 'won') {
        currentStage = 'Converted';
        stageDetails = dealVal ? `Converted / Closed Won (₹${dealVal.toLocaleString('en-IN')})` : "Deal in 'converted' stage";
      } else if (dStage === 'lost') {
        currentStage = 'Archived';
        stageDetails = 'Deal marked as Lost';
      } else if (dStage === 'followup') {
        currentStage = 'Follow-up';
        stageDetails = matchedFollowup?.scheduledAt
          ? `Follow-up on ${new Date(matchedFollowup.scheduledAt).toLocaleDateString()}`
          : 'Follow-up scheduled';
      } else {
        currentStage = 'My Leads';
        stageDetails = `Deal in '${matchedDeal.stage}' stage`;
      }
    } else if (
      matchedCustomer ||
      (l.notes && (l.notes.toLowerCase().includes('kyc') || l.notes.toLowerCase().includes('pan') || l.notes.toLowerCase().includes('verified')))
    ) {
      currentStage = 'KYC';
      kycStatus = 'Verified';
      stageDetails = 'Investor in KYC verification stage';
    } else if (matchedFollowup || l.status === 'Follow-up Required' || l.status === 'Callback') {
      currentStage = 'Follow-up';
      stageDetails = matchedFollowup?.scheduledAt
        ? `Follow-up on ${new Date(matchedFollowup.scheduledAt).toLocaleDateString()}`
        : 'Follow-up pending';
    } else if (l.status === 'Converted') {
      currentStage = 'Converted';
      stageDetails = 'Lead marked as Converted';
    } else if (l.status === 'Not Interested' || l.status === 'Junk') {
      currentStage = 'Archived';
      stageDetails = `Lead marked as ${l.status}`;
    } else {
      currentStage = 'My Leads';
      stageDetails = 'In initial review / Interested';
    }

    return {
      id: l.id,
      name: l.name,
      phone: l.phone,
      email: l.email,
      location: l.location,
      source: l.source,
      status: l.status,
      priority: l.priority,
      notes: l.notes,
      assignedAgentId: l.assignedAgentId ? Number(l.assignedAgentId) : undefined,
      assignedAgentName: l.assignedAgentName || currentUserName || 'Assigned IRM',
      assignedByName: l.assignedByName || (l.assignedById && String(l.assignedById) !== String(l.assignedAgentId) ? 'Sales Agent' : 'Created by IRM'),
      assignedAt: l.assignedAt || l.createdAt,
      createdAt: l.createdAt,
      updatedAt: (l as any).updatedAt || l.createdAt,
      currentStage,
      stageDetails,
      kycStatus,
      nextFollowupDate: matchedFollowup?.scheduledAt || l.nextFollowupDate,
      dealValue: matchedDeal?.value || (matchedCustomer ? matchedCustomer.totalValue : undefined),
      dealStage: matchedDeal?.stage,
      investmentCapacity: (l as any).investmentCapacity || (l as any).customFields?.investmentCapacity || (l as any).customFields?.budgetRange,
      preferredAssetClass: (l as any).preferredAssetClass || (l as any).customFields?.preferredAssetClass || (l as any).customFields?.assetClass,
    };
  });

  const total = items.length;
  const inMyLeads = items.filter(i => i.currentStage === 'My Leads').length;
  const inFollowup = items.filter(i => i.currentStage === 'Follow-up').length;
  const inKyc = items.filter(i => i.currentStage === 'KYC').length;
  const inOpportunities = items.filter(i => i.currentStage === 'Opportunities').length;
  const converted = items.filter(i => i.currentStage === 'Converted' || i.status === 'Converted').length;

  let filtered = items;
  if (options?.stage && options.stage !== 'all') {
    filtered = filtered.filter(i => i.currentStage.toLowerCase() === options.stage!.toLowerCase());
  }

  if (options?.search) {
    const s = options.search.toLowerCase();
    filtered = filtered.filter(i =>
      i.name.toLowerCase().includes(s) ||
      i.phone.includes(s) ||
      (i.email && i.email.toLowerCase().includes(s)) ||
      (i.location && i.location.toLowerCase().includes(s))
    );
  }

  return {
    totalAssignedLeads: total,
    inMyLeads,
    inFollowup,
    inKyc,
    inOpportunities,
    converted,
    leads: filtered,
  };
}

