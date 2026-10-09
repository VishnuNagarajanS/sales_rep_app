import React, { useState, useEffect, useMemo } from 'react';
import {
  Building2,
  Phone,
  Plus,
  Play,
  ExternalLink,
  Filter,
  Users,
  UserCheck,
  Send,
  CheckCircle,
  Clock,
  Lock,
  Sparkles,
  Volume2,
  FileText,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  User,
} from 'lucide-react';
import { Customer, CallRecord, Followup, Deal, Lead, IrmProfile, CustomFieldDefinition } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useCall } from '../../context/CallContext';
import { useUnsavedChanges } from '../../context/NavigationGuardContext';
import { storageService } from '../../services/storageService';
import { adminUserService } from '../../services/adminUserService';
import { isMockMode } from '../../config/environment';
import {
  getCustomers,
  saveCustomer as apiSaveCustomer,
  getCalls,
  getFollowups,
  saveFollowup as apiSaveFollowup,
  getDeals,
  getLeads,
  saveLead as apiSaveLead,
} from '../../services/ghlApiService';
import { StatusChip } from '../../components/common/StatusChip';
import { DocumentUploader } from '../../components/common/DocumentUploader';
import { DocumentList } from '../../components/common/DocumentList';
import { Modal } from '../../components/common/Modal';
import { Timeline, TimelineEvent } from '../../components/common/Timeline';
import { formatSmartScheduleDate } from '../../utils/dateUtils';

import './CustomersPage.css';

const getCustomFieldDefinitions = (tenantId?: string): CustomFieldDefinition[] => {
  try {
    const raw = localStorage.getItem('nexus_custom_fields');
    const all: CustomFieldDefinition[] = raw ? JSON.parse(raw) : [];
    return tenantId ? all.filter(d => !d.companyId || d.companyId === tenantId) : all;
  } catch {
    return [];
  }
};
const lastTenDigits = (p?: string): string => (p || '').replace(/\D/g, '').slice(-10);

/** Build a Customer 360 entry from an 'Interested' lead. */
const leadToCustomer = (l: Lead): Customer => {
  const cf = (l.customFields || {}) as Record<string, any>;
  return {
    id: `lead-${l.id}`,
    companyId: l.companyId,
    name: l.name,
    phone: l.phone,
    email: l.email,
    status: 'Interested',
    assignedAgentId: l.assignedAgentId,
    assignedAgentName: l.assignedAgentName,
    location: l.location,
    lastContacted: l.lastContactedAt || '—',
    openDealsCount: 0,
    totalValue: 0,
    createdAt: l.createdAt,
    notes: l.notes,
    customFields: cf,
    assignedIrmId: l.assignedIrmId || cf.assignedIrmId || undefined,
    assignedIrmName: l.assignedIrmName || cf.assignedIrmName || undefined,
    assignedIrmAt: l.assignedIrmAt || cf.assignedIrmAt || undefined,
    handoverId: l.handoverId,
    handedOverFromName: l.handedOverFromName,
    handoverPlannedEnd: l.handoverPlannedEnd,
    isLeadRecord: true,
    sourceLeadId: l.id,
  };
};

interface AutoRecommendation {
  customerId: string;
  customerName: string;
  investmentDisplay: string;
  tier: 'Premium' | 'Very High' | 'High' | 'Medium' | 'Normal';
  recommendedIrmId: string;
  recommendedIrmName: string;
  matchReason: string;
  isEdited?: boolean;
}

export const CustomersPage: React.FC = () => {
  const { tenant, user } = useAuth();
  const { initiateCall } = useCall();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [dbIrms, setDbIrms] = useState<IrmProfile[]>(() => storageService.getIrms(tenant?.id || tenant?.slug));
  const irms = useMemo<IrmProfile[]>(() => {
    if (dbIrms && dbIrms.length > 0) return dbIrms;
    return storageService.getIrms(tenant?.id || tenant?.slug);
  }, [dbIrms, tenant?.id, tenant?.slug]);

  // Role-based scoping: Sales Executives see only their own customers.
  // Managers / Admins / Super Admins see the full company customer list (no filter).
  const roleCode = user?.role?.code;
  const isExec = roleCode === 'sales_executive';

  // Strict Tenant + Role isolation: IRM assignment is available ONLY in GHL India Ventures -> Sales Executive
  const isGhlTenant = tenant?.slug === 'ghl' || tenant?.name === 'GHL India Ventures' || user?.companySlug === 'ghl' || user?.companyName === 'GHL India Ventures';
  const isSalesExecutive = isExec || user?.role?.name === 'Sales Executive';
  const canAssignToIRM = Boolean(isGhlTenant && isSalesExecutive);

  // Leads marked "Interested" are shown in Customer 360 even before they are formally converted.
  // They are virtual entries (id = `lead-<leadId>`) built from the Leads table, de-duplicated against
  // real customers by phone / email. IRM users already see these in "My Leads", so they are skipped.
  const interestedLeadCustomers = useMemo<Customer[]>(() => {
    if (roleCode === 'irm') return [];
    const customerPhones = new Set(customers.map(c => lastTenDigits(c.phone)).filter(Boolean));
    const customerEmails = new Set(
      customers.map(c => (c.email || '').trim().toLowerCase()).filter(Boolean)
    );
    return leads
      .filter(l => l.status === 'Interested')
      .filter(l => {
        const ph = lastTenDigits(l.phone);
        const em = (l.email || '').trim().toLowerCase();
        if (ph && customerPhones.has(ph)) return false;
        if (em && customerEmails.has(em)) return false;
        return true;
      })
      .map(leadToCustomer);
  }, [leads, customers, roleCode]);

  const allCustomers = useMemo<Customer[]>(
    () => [...interestedLeadCustomers, ...customers],
    [interestedLeadCustomers, customers]
  );

  const scopedCustomers = isExec
    ? allCustomers.filter(c => {
        const hasIrm = Boolean(
          c.assignedIrmId ||
          c.assignedIrmName ||
          c.customFields?.assignedIrmId ||
          c.customFields?.assignedIrmName
        );
        if (hasIrm) return false;
        
        return (
          (c.assignedAgentId && c.assignedAgentId === user?.id) ||
          (c.assignedAgentName && c.assignedAgentName === user?.name)
        );
      })
    : allCustomers;
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'calls' | 'followups' | 'timeline' | 'documents'>('overview');
  const [customerDocsTab, setCustomerDocsTab] = useState<'customer' | 'company'>('customer');
  const [callCategoryFilter, setCallCategoryFilter] = useState<'all' | 'agent' | 'irm'>('all');
  const [expandedCallIds, setExpandedCallIds] = useState<Record<string, boolean>>({});
  const [statusFilter, setStatusFilter] = useState('All');
  const [agentFilter, setAgentFilter] = useState('All');
  const [assignmentFilter, setAssignmentFilter] = useState<'All' | 'Assigned' | 'Unassigned'>('All');
  const [handoverFilter, setHandoverFilter] = useState('Mine');

  const handoverOptions = useMemo(() => {
    const names = Array.from(new Set(scopedCustomers.map(c => c.handedOverFromName).filter(Boolean)));
    if (names.length === 0) return [];
    return [
      { value: 'Mine', label: 'Mine' },
      ...names.map(name => ({ value: `Handover_${name}`, label: `Handed over from ${name}` }))
    ];
  }, [scopedCustomers]);

  // Assignment mode state (Sales Executive only)
  const [isAssignMode, setIsAssignMode] = useState(false);
  const [assignSubMode, setAssignSubMode] = useState<'manual' | 'auto'>('manual');
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<Set<string>>(new Set());

  // Manual IRM selection modal state
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [selectedIrmId, setSelectedIrmId] = useState<string>('');

  // Auto assignment preview modal state
  const [isAutoPreviewModalOpen, setIsAutoPreviewModalOpen] = useState(false);
  const [autoRecommendations, setAutoRecommendations] = useState<AutoRecommendation[]>([]);
  const [editingRecommendationCustomerId, setEditingRecommendationCustomerId] = useState<string | null>(null);

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // New Customer modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [newStatus, setNewStatus] = useState<'Active' | 'VIP' | 'Inactive'>('Active');
  const [newCustomFields, setNewCustomFields] = useState<Record<string, any>>({});
  const [addErrors, setAddErrors] = useState<{ name?: string; phone?: string }>({});
  const [isSubmittingCustomer, setIsSubmittingCustomer] = useState(false);
  const [addCustomerError, setAddCustomerError] = useState<string | null>(null);

  // Unsaved changes check
  const isAddCustomerDirty = isAddModalOpen && (newName.trim() !== '' || newPhone.trim() !== '' || newEmail.trim() !== '');
  useUnsavedChanges(
    isAddCustomerDirty,
    'You have unsaved information in the Add Customer form. Are you sure you want to leave?',
    'customers-page'
  );

  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [followups, setFollowups] = useState<Followup[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoadError(null);
      const [custs, cCalls, cFollowups, cDeals, cLeads] = await Promise.all([
        getCustomers(tenant?.id),
        getCalls(tenant?.id),
        getFollowups(tenant?.id),
        getDeals(tenant?.id),
        getLeads(tenant?.id),
      ]);
      setCustomers(custs);
      setCalls(cCalls);
      setFollowups(cFollowups);
      setDeals(cDeals);
      setLeads(cLeads);

      // Load real IRM users from database / adminUserService
      try {
        const fetchedUsers = await adminUserService.getUsers(tenant?.id || tenant?.slug || '1');
        const apiIrms: IrmProfile[] = (fetchedUsers || [])
          .filter(u => !u.isCovered && (u.role?.code === 'irm' || u.role?.name?.toLowerCase().includes('irm') || u.role?.name?.toLowerCase().includes('investor')))
          .map(u => ({
            id: String(u.id),
            name: u.name,
            email: u.email,
            phone: u.phone,
            experience: '5 Years',
            experienceYears: 5,
            experienceLevel: 'Experienced' as const,
            performance: 95,
            status: 'Available' as const,
          }));
        if (apiIrms.length > 0) {
          setDbIrms(apiIrms);
        }
      } catch (userErr) {
        console.warn('Could not load users via adminUserService, using storage IRMs', userErr);
        const fallback = storageService.getIrms(tenant?.id || tenant?.slug);
        if (fallback.length > 0) {
          setDbIrms(fallback);
        }
      }

      const firstVisible = isExec
        ? custs.filter(c =>
          (c.assignedAgentId && c.assignedAgentId === user?.id) ||
          (c.assignedAgentName && c.assignedAgentName === user?.name)
        )[0]
        : custs[0];
      if (firstVisible && !selectedCustomer) {
        setSelectedCustomer(firstVisible);
      }
    } catch (err: any) {
      console.error('Failed to load customers page data', err);
      setCustomers([]);
      setCalls([]);
      setFollowups([]);
      setDeals([]);
      setLeads([]);
      setLoadError(err?.message || 'Failed to load customer records from server.');
    }
  };

  useEffect(() => {
    loadData();
    const handleUpdate = () => {
      loadData();
      const current = storageService.getIrms(tenant?.id || tenant?.slug);
      if (current && current.length > 0) {
        setDbIrms(current);
      }
    };
    window.addEventListener('nexus_storage_updated', handleUpdate);
    window.addEventListener('nexus_handover_updated', handleUpdate);
    return () => {
      window.removeEventListener('nexus_storage_updated', handleUpdate);
      window.removeEventListener('nexus_handover_updated', handleUpdate);
    };
  }, [tenant?.id, tenant?.slug]);

  // If nothing is selected yet (e.g. the user only has Interested leads), select the first visible entry.
  useEffect(() => {
    if (!selectedCustomer && scopedCustomers.length > 0) {
      setSelectedCustomer(scopedCustomers[0]);
    }
  }, [scopedCustomers, selectedCustomer]);

  useEffect(() => {
    if (isManualModalOpen && irms.length > 0 && (!selectedIrmId || !irms.some(i => i.id === selectedIrmId))) {
      setSelectedIrmId(irms[0].id);
    }
  }, [isManualModalOpen, irms, selectedIrmId]);

  const agentOptions = Array.from(new Set(scopedCustomers.map(c => c.assignedAgentName)))
    .filter(Boolean)
    .map(name => ({ value: name, label: name }));

  const filteredCustomers = scopedCustomers.filter(c => {
    if (statusFilter !== 'All' && c.status !== statusFilter) return false;
    if (agentFilter !== 'All' && c.assignedAgentName !== agentFilter) return false;
    if (canAssignToIRM) {
      if (assignmentFilter === 'Assigned' && !(c.assignedIrmName || c.assignedIrmId)) return false;
      if (assignmentFilter === 'Unassigned' && (c.assignedIrmName || c.assignedIrmId)) return false;
    }
    if (handoverOptions.length > 0) {
      if (handoverFilter === 'Mine' && c.handoverId) return false;
      if (handoverFilter !== 'Mine' && handoverFilter !== 'All') {
        const name = handoverFilter.replace('Handover_', '');
        if (c.handedOverFromName !== name) return false;
      }
    }
    return true;
  });

  const isCustomerEligibleForIrm = (c: Customer): boolean => {
    if (!canAssignToIRM) return false;
    if (!c || !c.id || !c.name) return false;
    if (c.status === 'Inactive') return false;
    if (c.assignedIrmName || c.assignedIrmId) return false;
    return true;
  };

  const eligibleUnassignedCustomers = canAssignToIRM
    ? scopedCustomers.filter(isCustomerEligibleForIrm)
    : [];

  const toggleCustomerSelection = (id: string) => {
    setSelectedCustomerIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleCancelAssignMode = () => {
    setIsAssignMode(false);
    setSelectedCustomerIds(new Set());
    setAutoRecommendations([]);
    setIsManualModalOpen(false);
    setIsAutoPreviewModalOpen(false);
  };

  const formatCurrency = (val: number) => {
    if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`;
    if (val >= 100000) return `₹${(val / 100000).toFixed(1)} L`;
    return `₹${val.toLocaleString('en-IN')}`;
  };

  // Build leads lookup map by last 10 digits of phone once per render
  const leadsByPhone = useMemo(() => {
    const map = new Map<string, Lead>();
    (leads || []).forEach(l => {
      const digits = (l.phone || '').replace(/\D/g, '').slice(-10);
      if (digits && !map.has(digits)) {
        map.set(digits, l);
      }
    });
    return map;
  }, [leads]);

  const getInvestmentRange = (c: Customer): string => {
    const checkVal = (v: unknown): string => {
      if (typeof v === 'string' && v.trim()) {
        return v.trim();
      }
      return '';
    };

    // 1. c.customFields?.investmentCapacity
    const c1 = checkVal(c.customFields?.investmentCapacity);
    if (c1) return c1;

    // 2. c.customFields?.budgetRange
    const c2 = checkVal(c.customFields?.budgetRange);
    if (c2) return c2;

    // 3. matching lead from the map (by the last 10 digits of c.phone)
    const digits = (c.phone || '').replace(/\D/g, '').slice(-10);
    const lead = digits ? leadsByPhone.get(digits) : undefined;
    if (lead) {
      const l1 = checkVal(lead.customFields?.investmentCapacity);
      if (l1) return l1;
      const l2 = checkVal(lead.customFields?.budgetRange);
      if (l2) return l2;
    }

    return '';
  };

  const getCustomerCapacityTier = (c: Customer): { tier: 'Premium' | 'Very High' | 'High' | 'Medium' | 'Normal'; label: string } => {
    const raw = getInvestmentRange(c);
    const totalVal = typeof c.totalValue === 'number' ? c.totalValue : 0;

    if (/25\s*Cr|\b250\b/i.test(raw) || totalVal >= 100000000) {
      return { tier: 'Premium', label: raw || '₹10 Cr+ (Premium)' };
    }
    if (/5\s*Cr\s*[-–]\s*10\s*Cr/i.test(raw) || (totalVal >= 50000000 && totalVal < 100000000)) {
      return { tier: 'Very High', label: raw || '₹5–10 Cr (Very High)' };
    }
    if (/3\s*Cr\s*[-–]\s*5\s*Cr/i.test(raw) || (totalVal >= 30000000 && totalVal < 50000000)) {
      return { tier: 'High', label: raw || '₹3–5 Cr (High)' };
    }
    if (/1\s*Cr\s*[-–]\s*3\s*Cr|1\s*Cr\s*[-–]\s*5\s*Cr/i.test(raw) || (totalVal >= 10000000 && totalVal < 30000000)) {
      return { tier: 'Medium', label: raw || '₹1–3 Cr (Medium)' };
    }
    return { tier: 'Normal', label: raw || (totalVal > 0 ? formatCurrency(totalVal) : 'Standard Ticket') };
  };

  const runAutoAssignmentAlgorithm = (custs: Customer[]): AutoRecommendation[] => {
    const liveCountMap: Record<string, number> = {};
    irms.forEach((irm: IrmProfile) => {
      liveCountMap[irm.id] = allCustomers.filter(c => c.assignedIrmName === irm.name || c.assignedIrmId === irm.id).length;
    });

    const tierPriority = { Premium: 5, 'Very High': 4, High: 3, Medium: 2, Normal: 1 };
    const sortedCusts = [...custs].sort((a, b) => {
      const tA = getCustomerCapacityTier(a).tier;
      const tB = getCustomerCapacityTier(b).tier;
      return tierPriority[tB] - tierPriority[tA];
    });

    const recommendations: AutoRecommendation[] = [];

    sortedCusts.forEach(c => {
      const { tier, label } = getCustomerCapacityTier(c);
      const availableIrms = irms.filter((i: IrmProfile) => i.status === 'Available');
      const pool = availableIrms.length > 0 ? availableIrms : irms;

      let chosenIrm: IrmProfile;
      let reason: string;

      if (tier === 'Premium') {
        const expIrms = pool.filter((i: IrmProfile) => i.experienceLevel === 'Experienced');
        const candidatePool = expIrms.length > 0 ? expIrms : pool;
        chosenIrm = candidatePool.reduce((min: IrmProfile, curr: IrmProfile) => liveCountMap[curr.id] < liveCountMap[min.id] ? curr : min, candidatePool[0]);
        reason = 'Premium → Experienced (Capacity Match)';
      } else if (tier === 'Very High') {
        const expIrms = pool.filter((i: IrmProfile) => i.experienceLevel === 'Experienced');
        const candidatePool = expIrms.length > 0 ? expIrms : pool;
        chosenIrm = candidatePool.reduce((min: IrmProfile, curr: IrmProfile) => liveCountMap[curr.id] < liveCountMap[min.id] ? curr : min, candidatePool[0]);
        reason = 'Very High → Experienced (High Performance)';
      } else if (tier === 'High') {
        const highIrms = pool.filter((i: IrmProfile) => i.experienceLevel === 'Experienced' || i.experienceLevel === 'Mid-Level');
        const candidatePool = highIrms.length > 0 ? highIrms : pool;
        chosenIrm = candidatePool.reduce((min: IrmProfile, curr: IrmProfile) => liveCountMap[curr.id] < liveCountMap[min.id] ? curr : min, candidatePool[0]);
        reason = chosenIrm.experienceLevel === 'Experienced'
          ? 'High-value → Experienced'
          : 'High-value → Mid-Level (Fair Distribution)';
      } else if (tier === 'Medium') {
        const fresherMid = pool.filter((i: IrmProfile) => i.experienceLevel === 'Fresher' || i.experienceLevel === 'Mid-Level');
        const candidatePool = fresherMid.length > 0 ? fresherMid : pool;
        chosenIrm = candidatePool.reduce((min: IrmProfile, curr: IrmProfile) => liveCountMap[curr.id] < liveCountMap[min.id] ? curr : min, candidatePool[0]);
        reason = chosenIrm.experienceLevel === 'Fresher'
          ? 'Medium-value → Fresher (Balanced Workload)'
          : 'Medium-value → Mid-Level (Fair Distribution)';
      } else {
        chosenIrm = pool.reduce((min: IrmProfile, curr: IrmProfile) => liveCountMap[curr.id] < liveCountMap[min.id] ? curr : min, pool[0]);
        reason = 'Standard Ticket → Balanced Workload';
      }

      liveCountMap[chosenIrm.id] = (liveCountMap[chosenIrm.id] || 0) + 1;

      recommendations.push({
        customerId: c.id,
        customerName: c.name,
        investmentDisplay: label,
        tier,
        recommendedIrmId: chosenIrm.id,
        recommendedIrmName: chosenIrm.name,
        matchReason: reason,
        isEdited: false,
      });
    });

    return recommendations;
  };

  const handleSendAssignment = () => {
    if (assignSubMode === 'manual') {
      if (selectedCustomerIds.size === 0) return;
      const selectedCusts = scopedCustomers.filter(c => selectedCustomerIds.has(c.id) && isCustomerEligibleForIrm(c));
      if (selectedCusts.length === 0) return;

      const availableIrms = irms.length > 0 ? irms : storageService.getIrms(tenant?.id || tenant?.slug);
      if (availableIrms.length > 0 && (!dbIrms || dbIrms.length === 0)) {
        setDbIrms(availableIrms);
      }
      setSelectedIrmId(selectedIrmId || availableIrms[0]?.id || '');
      setIsManualModalOpen(true);
    } else {
      if (eligibleUnassignedCustomers.length === 0) return;
      const recs = runAutoAssignmentAlgorithm(eligibleUnassignedCustomers);
      setAutoRecommendations(recs);
      setIsAutoPreviewModalOpen(true);
    }
  };

  /**
   * When a Sales Executive assigns a customer to an IRM, the matching lead is handed over too:
   * it stays 'Interested' and becomes assigned to that IRM, so it shows ONLY in that IRM's "My Leads".
   */
  const handoverLeadsToIrm = async (pairs: { customer: Customer; irmId: string; irmName: string }[]) => {
    if (pairs.length === 0) return;
    const digits = (p?: string) => (p || '').replace(/\D/g, '').slice(-10);
    let allLeads: Lead[] = [];
    try {
      allLeads = await getLeads(tenant?.id);
    } catch {
      allLeads = isMockMode() ? (storageService.getLeads(tenant?.id) || []) : [];
    }
    for (const { customer, irmId, irmName } of pairs) {
      const lead = allLeads.find(l =>
        (customer.sourceLeadId && l.id === customer.sourceLeadId) ||
        (digits(l.phone) && digits(l.phone) === digits(customer.phone)) ||
        (!!l.email && !!customer.email && l.email.toLowerCase() === customer.email.toLowerCase())
      );
      if (!lead) continue;
      const previousOwner = lead.assignedAgentName || user?.name || '';
      const handedOver: Lead = {
        ...lead,
        status: 'Interested',
        assignedAgentId: irmId,
        assignedAgentName: irmName,
        customFields: {
          ...(lead.customFields || {}),
          qualifiedByAgentName: (lead.customFields as any)?.qualifiedByAgentName || previousOwner,
          assignedIrmAt: new Date().toISOString(),
        },
      };
      storageService.saveLead(handedOver);
      if (!isMockMode()) {
        await apiSaveLead(handedOver).catch(console.error);
      }
    }
    window.dispatchEvent(new Event('nexus_storage_updated'));
  };

  const handleConfirmManualAssignment = async () => {
    const selectedIrm = irms.find((i: IrmProfile) => i.id === selectedIrmId);
    if (!selectedIrm) return;

    let assignedCount = 0;
    const allLatest = (storageService.getCustomers ? storageService.getCustomers(tenant?.id) : customers) || customers;
    const toUpdate: Customer[] = [];
    const toHandover: { customer: Customer; irmId: string; irmName: string }[] = [];

    selectedCustomerIds.forEach(cid => {
      const cust = allCustomers.find((c: Customer) => c.id === cid) || allLatest.find((c: Customer) => c.id === cid);
      if (cust && isCustomerEligibleForIrm(cust)) {
        const updated: Customer = {
          ...cust,
          assignedIrmId: selectedIrm.id,
          assignedIrmName: selectedIrm.name,
          assignedIrmAt: new Date().toISOString(),
          notes: `${cust.notes ? cust.notes + '\n\n' : ''}[${new Date().toLocaleDateString()}] Assigned to IRM: ${selectedIrm.name} by ${user?.name || 'Sales Executive'}`,
        };
        if (!updated.isLeadRecord) {
          toUpdate.push(updated);
          storageService.saveCustomer?.(updated);
        }
        toHandover.push({ customer: updated, irmId: selectedIrm.id, irmName: selectedIrm.name });
        assignedCount++;
      }
    });

    if (!isMockMode()) {
      for (const u of toUpdate) {
        await apiSaveCustomer(u).catch(console.error);
      }
    }
    await handoverLeadsToIrm(toHandover);

    setIsManualModalOpen(false);
    setIsAssignMode(false);
    setSelectedCustomerIds(new Set());
    loadData();
    showToast(`Successfully assigned ${assignedCount} customer(s) to ${selectedIrm.name}!`);
  };

  const handleConfirmAutoAssignment = async () => {
    let assignedCount = 0;
    const allLatest = (storageService.getCustomers ? storageService.getCustomers(tenant?.id) : customers) || customers;
    const toUpdate: Customer[] = [];
    const toHandover: { customer: Customer; irmId: string; irmName: string }[] = [];

    autoRecommendations.forEach(rec => {
      const cust = allCustomers.find((c: Customer) => c.id === rec.customerId) || allLatest.find((c: Customer) => c.id === rec.customerId);
      if (cust && isCustomerEligibleForIrm(cust)) {
        const updated: Customer = {
          ...cust,
          assignedIrmId: rec.recommendedIrmId,
          assignedIrmName: rec.recommendedIrmName,
          assignedIrmAt: new Date().toISOString(),
          notes: `${cust.notes ? cust.notes + '\n\n' : ''}[${new Date().toLocaleDateString()}] Auto-assigned to IRM: ${rec.recommendedIrmName} (${rec.matchReason})`,
        };
        if (!updated.isLeadRecord) {
          toUpdate.push(updated);
          storageService.saveCustomer?.(updated);
        }
        toHandover.push({ customer: updated, irmId: rec.recommendedIrmId, irmName: rec.recommendedIrmName });
        assignedCount++;
      }
    });

    if (!isMockMode()) {
      for (const u of toUpdate) {
        await apiSaveCustomer(u).catch(console.error);
      }
    }
    await handoverLeadsToIrm(toHandover);

    setIsAutoPreviewModalOpen(false);
    setIsAssignMode(false);
    setSelectedCustomerIds(new Set());
    setAutoRecommendations([]);
    loadData();
    showToast(`Successfully confirmed auto-assignment for ${assignedCount} customer(s)!`);
  };

  const handleUpdateSingleRecommendation = (customerId: string, newIrmId: string) => {
    const newIrm = irms.find((i: IrmProfile) => i.id === newIrmId);
    if (!newIrm) return;
    setAutoRecommendations(prev =>
      prev.map(rec => {
        if (rec.customerId === customerId) {
          return {
            ...rec,
            recommendedIrmId: newIrm.id,
            recommendedIrmName: newIrm.name,
            matchReason: `${rec.tier} → ${newIrm.name} (Manually Adjusted)`,
            isEdited: true,
          };
        }
        return rec;
      })
    );
    setEditingRecommendationCustomerId(null);
  };

  // Call History helpers
  const formatCallDuration = (seconds?: number): string => {
    if (!seconds || seconds <= 0) return '0s';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    if (m === 0) return `${s}s`;
    if (s === 0) return `${m}m`;
    return `${m}m ${s}s`;
  };

  const formatCallTimestamp = (ts?: string): string => {
    if (!ts) return 'Unknown date';
    try {
      const d = new Date(ts);
      if (!isNaN(d.getTime())) {
        return d.toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        });
      }
    } catch {}
    return ts;
  };

  const toggleCallExpand = (callId: string) => {
    setExpandedCallIds(prev => ({
      ...prev,
      [callId]: !prev[callId],
    }));
  };

  const toggleAllCallsExpand = (callsToToggle: CallRecord[]) => {
    const allExpanded = callsToToggle.length > 0 && callsToToggle.every(c => expandedCallIds[c.id]);
    const nextState: Record<string, boolean> = { ...expandedCallIds };
    callsToToggle.forEach(c => {
      nextState[c.id] = !allExpanded;
    });
    setExpandedCallIds(nextState);
  };

  // Filter linked records for selected customer using ID, normalized phone, or exact name
  const customerCalls = useMemo(() => {
    if (!selectedCustomer) return [];
    const custDigits = (selectedCustomer.phone || '').replace(/\D/g, '').slice(-10);
    const custName = (selectedCustomer.name || '').trim().toLowerCase();

    return calls.filter(c => {
      if (c.customerId && (c.customerId === selectedCustomer.id || String(c.customerId) === String(selectedCustomer.id))) {
        return true;
      }
      if (custDigits && custDigits.length >= 7) {
        const cDigits = (c.contactPhone || '').replace(/\D/g, '').slice(-10);
        if (cDigits && cDigits === custDigits) {
          return true;
        }
      }
      if (custName && c.contactName && c.contactName.trim().toLowerCase() === custName) {
        return true;
      }
      return false;
    });
  }, [calls, selectedCustomer]);

  // Respect existing call ownership and role permissions: An IRM user is strictly authorized only to view their own calls
  const isIrmUser = roleCode === 'irm';
  const authorizedCustomerCalls = useMemo(() => {
    return customerCalls.filter(c => {
      if (isIrmUser) {
        const matchesId = c.agentId && (c.agentId === user?.id || String(c.agentId) === String(user?.id));
        const matchesName = c.agentName && (c.agentName.toLowerCase() === (user?.name || '').toLowerCase() || c.agentName === user?.name);
        return matchesId || matchesName;
      }
      return true;
    });
  }, [customerCalls, isIrmUser, user?.id, user?.name]);

  // Keep Agent and IRM calls correctly categorized using the call's stored source
  const agentCustomerCalls = useMemo(() => {
    return authorizedCustomerCalls.filter(c => c.callerType !== 'IRM' && c.connectVia !== 'Connect via IRM' && c.source !== 'irm');
  }, [authorizedCustomerCalls]);

  const irmCustomerCalls = useMemo(() => {
    return authorizedCustomerCalls.filter(c => c.callerType === 'IRM' || c.connectVia === 'Connect via IRM' || c.source === 'irm');
  }, [authorizedCustomerCalls]);

  const displayedCustomerCalls = useMemo(() => {
    if (callCategoryFilter === 'agent') return agentCustomerCalls;
    if (callCategoryFilter === 'irm') return irmCustomerCalls;
    return authorizedCustomerCalls;
  }, [callCategoryFilter, agentCustomerCalls, irmCustomerCalls, authorizedCustomerCalls]);

  const customerFollowups = followups.filter(
    f => selectedCustomer && (f.contactPhone === selectedCustomer.phone || f.contactName === selectedCustomer.name)
  );

  const customerDeals = deals.filter(
    d => selectedCustomer && (d.customerId === selectedCustomer.id || d.customerName === selectedCustomer.name)
  );

  const resetAddForm = () => {
    setNewName('');
    setNewPhone('');
    setNewEmail('');
    setNewLocation('');
    setNewStatus('Active');
    setNewCustomFields({});
    setAddErrors({});
    setAddCustomerError(null);
  };

  const handleAddCustomer = async () => {
    if (isSubmittingCustomer) return;
    const errors: { name?: string; phone?: string } = {};
    if (!newName.trim()) errors.name = 'Name is required.';
    if (!newPhone.trim()) errors.phone = 'Phone is required.';
    if (Object.keys(errors).length > 0) {
      setAddErrors(errors);
      return;
    }

    setAddCustomerError(null);
    setIsSubmittingCustomer(true);
    try {
      const newCustomer: import('../../types').Customer = {
        id: `cust-${Date.now()}`,
        companyId: tenant?.id || '',
        name: newName.trim(),
        phone: newPhone.trim(),
        email: newEmail.trim(),
        status: newStatus,
        assignedAgentId: user?.id || '',
        assignedAgentName: user?.name || '',
        location: newLocation.trim(),
        lastContacted: new Date().toISOString().split('T')[0],
        openDealsCount: 0,
        totalValue: 0,
        createdAt: new Date().toISOString().split('T')[0],
        notes: '',
        customFields: newCustomFields,
      };

      const saved = await apiSaveCustomer(newCustomer);
      setSelectedCustomer(saved);
      await loadData();
      setIsAddModalOpen(false);
      resetAddForm();
      showToast(`✓ Customer "${saved.name}" created successfully.`);
    } catch (err: any) {
      console.error('Failed to create customer:', err);
      setAddCustomerError(err?.message || 'Failed to create customer. Please check your connection and retry.');
    } finally {
      setIsSubmittingCustomer(false);
    }
  };

  const getCustomerValueDisplay = (c: Customer): string => {
    const range = getInvestmentRange(c);
    if (range) return range;
    if (typeof c.totalValue === 'number' && c.totalValue > 0) {
      return formatCurrency(c.totalValue);
    }
    return '—';
  };

  const rawEvents: TimelineEvent[] = [];

  if (selectedCustomer) {
    customerCalls.forEach(c => {
      rawEvents.push({
        id: c.id,
        type: 'call',
        title: `${c.direction === 'outbound' ? 'Outbound' : 'Inbound'} Call — ${c.disposition}`,
        description: c.notes ? `${c.notes}${c.transcription ? `\n\n${c.transcription}` : ''}` : (c.transcription || undefined),
        timestamp: c.timestamp,
        actorName: c.agentName,
      });
    });

    customerFollowups.forEach(f => {
      rawEvents.push({
        id: f.id,
        type: 'followup',
        title: f.status === 'Completed' ? 'Follow-up Completed' : 'Follow-up Scheduled',
        description: f.notes,
        timestamp: f.scheduledAt,
        actorName: f.assignedAgentName,
      });
    });

    customerDeals.forEach(d => {
      rawEvents.push({
        id: d.id,
        type: 'status_change',
        title: `Deal Created — ${d.title}`,
        description: `Stage: ${d.stage} • Value: ${formatCurrency(d.value)}`,
        timestamp: d.createdAt,
        actorName: d.assignedAgentName,
      });
    });

    rawEvents.push({
      id: `ev-create-${selectedCustomer.id}`,
      type: 'note',
      title: selectedCustomer.isLeadRecord ? 'Lead Marked Interested' : 'Customer Account Created',
      timestamp: selectedCustomer.createdAt,
      actorName: selectedCustomer.assignedAgentName,
    });
  }

  const timelineEvents = rawEvents.sort((a, b) => {
    const parseTime = (ts: string) => {
      const parsed = Date.parse(ts);
      return isNaN(parsed) ? Number.MAX_SAFE_INTEGER : parsed;
    };
    return parseTime(b.timestamp) - parseTime(a.timestamp);
  });

  return (
    <div className="customers-page">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <Building2 size={24} color="var(--primary-600)" /> Customer 360 Profile
          </h1>
          <p className="page-subtitle">
            Unified contact view across calls, deals, timeline, and documents for {tenant?.name}.
          </p>
        </div>

        {/* Top Action Area: Assign Leads to IRM (GHL India Ventures Sales Executive only) */}
        {canAssignToIRM && (
          <div className="customer-top-actions">
            {!isAssignMode ? (
              <button
                type="button"
                className="btn btn-primary customers-btn-assign-entry"
                onClick={() => {
                  setIsAssignMode(true);
                  setSelectedCustomerIds(new Set());
                }}
              >
                <Users size={14} /> Assign Leads to IRM
              </button>
            ) : (
              <div className="assign-mode-toolbar">
                <div className="assign-mode-segmented">
                  <button
                    type="button"
                    className={`assign-seg-btn ${assignSubMode === 'manual' ? 'active' : ''}`}
                    onClick={() => setAssignSubMode('manual')}
                  >
                    Manual
                  </button>
                  <button
                    type="button"
                    className={`assign-seg-btn ${assignSubMode === 'auto' ? 'active' : ''}`}
                    onClick={() => setAssignSubMode('auto')}
                  >
                    Auto
                  </button>
                </div>

                <span className="assign-counter-badge">
                  {assignSubMode === 'manual'
                    ? `${selectedCustomerIds.size} customer${selectedCustomerIds.size !== 1 ? 's' : ''} selected`
                    : eligibleUnassignedCustomers.length > 0
                      ? `${eligibleUnassignedCustomers.length} eligible customer${eligibleUnassignedCustomers.length !== 1 ? 's' : ''}`
                      : 'No unassigned customers available for automatic assignment.'}
                </span>

                <button
                  type="button"
                  className="btn btn-primary btn-sm assign-send-btn"
                  disabled={assignSubMode === 'manual' ? selectedCustomerIds.size === 0 : eligibleUnassignedCustomers.length === 0}
                  onClick={handleSendAssignment}
                >
                  <Send size={13} /> Send
                </button>

                <button
                  type="button"
                  className="btn btn-secondary btn-sm assign-cancel-btn"
                  onClick={handleCancelAssignMode}
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {loadError && (
        <div
          className="alert-banner error"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            marginBottom: '16px',
            borderRadius: '8px',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#ef4444',
          }}
        >
          <span>{loadError}</span>
        </div>
      )}

      {/* Customer 360 Split View: List on left, Full 360 on right */}
      <div className="customers-split-layout">
        {/* Left: Customer Directory */}
        <div className="customers-sidebar">
          <div className="card customers-sidebar-card">
            <div className="customers-sidebar-header">
              <h3 className="customers-sidebar-title">Customer Accounts</h3>
              <button
                className="btn btn-primary btn-sm customers-btn-new"
                onClick={() => { resetAddForm(); setIsAddModalOpen(true); }}
              >
                <Plus size={13} /> New Customer
              </button>
            </div>

            <div className="customers-filter-row">
              {/* Filters Label */}
              <span className="customers-filter-label">
                <Filter size={13} />
                Filters:
              </span>

              {/* Handover Filter */}
              {handoverOptions.length > 0 && (
                <div className="customers-filter-group">
                  <label htmlFor="filter-customer-handover" className="customers-filter-tag">
                    View:
                  </label>
                  <select
                    id="filter-customer-handover"
                    className={`form-select customers-filter-select ${handoverFilter !== 'Mine' ? 'is-filtered' : ''}`}
                    value={handoverFilter}
                    onChange={e => setHandoverFilter(e.target.value)}
                  >
                    {handoverOptions.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Status Filter */}
              <div className="customers-filter-group">
                <label
                  htmlFor="filter-customer-status"
                  className="customers-filter-tag"
                >
                  Status:
                </label>
                <select
                  id="filter-customer-status"
                  name="statusFilter"
                  className={`form-select customers-filter-select ${statusFilter !== 'All' && statusFilter !== '' ? 'is-filtered' : ''}`}
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                >
                  <option value="All">All</option>
                  <option value="Active">Active</option>
                  <option value="VIP">VIP</option>
                  <option value="Inactive">Inactive</option>
                  <option value="Interested">Interested</option>
                </select>
              </div>

              {/* Assignment Status Filter (GHL India Ventures Sales Executive only) */}
              {canAssignToIRM && (
                <div className="customers-filter-group">
                  <label
                    htmlFor="filter-customer-assignment"
                    className="customers-filter-tag"
                  >
                    IRM:
                  </label>
                  <select
                    id="filter-customer-assignment"
                    name="assignmentFilter"
                    className={`form-select customers-filter-select ${assignmentFilter !== 'All' ? 'is-filtered' : ''}`}
                    value={assignmentFilter}
                    onChange={e => setAssignmentFilter(e.target.value as any)}
                  >
                    <option value="All">All Customers</option>
                    <option value="Assigned">Assigned Customers</option>
                    <option value="Unassigned">Unassigned Customers</option>
                  </select>
                </div>
              )}

              {/* Agent Filter */}
              {!isExec && (
                <div className="customers-filter-group">
                  <label
                    htmlFor="filter-customer-agent"
                    className="customers-filter-tag"
                  >
                    Agent:
                  </label>
                  <select
                    id="filter-customer-agent"
                    name="agentFilter"
                    className={`form-select customers-filter-select ${agentFilter !== 'All' && agentFilter !== '' ? 'is-filtered' : ''}`}
                    value={agentFilter}
                    onChange={e => setAgentFilter(e.target.value)}
                  >
                    <option value="All">All</option>
                    {agentOptions.map(opt => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <div className="customers-list">
              {filteredCustomers.map(c => {
                const isSelected = selectedCustomer?.id === c.id;
                const isEligible = isCustomerEligibleForIrm(c);

                return (
                  <div
                    key={c.id}
                    onClick={() => setSelectedCustomer(c)}
                    className={`customer-list-item ${isSelected ? 'is-selected' : ''}`}
                  >
                    <div className="customer-list-item-top">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                        {isAssignMode && canAssignToIRM && (
                          assignSubMode === 'manual' ? (
                            isEligible ? (
                              <input
                                id={`customer-select-${c.id}`}
                                name="selectedCustomer"
                                aria-label={`Select ${c.name}`}
                                type="checkbox"
                                className="customer-select-checkbox"
                                checked={selectedCustomerIds.has(c.id)}
                                onChange={e => {
                                  e.stopPropagation();
                                  toggleCustomerSelection(c.id);
                                }}
                                onClick={e => e.stopPropagation()}
                              />
                            ) : (
                              <span className="customer-locked-indicator" title="Already assigned to an IRM">
                                <Lock size={12} color="var(--text-muted)" />
                              </span>
                            )
                          ) : null
                        )}
                        <div className="customer-list-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {c.name}
                        </div>
                        {c.handedOverFromName && (
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 600,
                              padding: '2px 6px',
                              borderRadius: 6,
                              background: 'rgba(99, 102, 241, 0.15)',
                              color: '#818cf8',
                              border: '1px solid rgba(99, 102, 241, 0.3)',
                            }}
                            title={`Handed over from ${c.handedOverFromName}`}
                          >
                            Covering for {c.handedOverFromName}
                          </span>
                        )}
                      </div>
                      <StatusChip status={c.status} size="sm" />
                    </div>
                    <div className="customer-list-sub">
                      {c.phone} • {c.location}
                    </div>

                    {/* Assigned / Unassigned Status Display (GHL India Ventures Sales Executive only) */}
                    {canAssignToIRM && (
                      <div className={`customer-irm-status-pill ${c.assignedIrmName ? 'assigned' : 'unassigned'}`}>
                        {c.assignedIrmName ? (
                          <>
                            <UserCheck size={11} /> Assigned IRM: <strong>{c.assignedIrmName}</strong>
                          </>
                        ) : (
                          <>
                            <Clock size={11} /> Assignment: Unassigned
                          </>
                        )}
                      </div>
                    )}

                    <div className="customer-list-bottom">
                      <span className="customer-list-val">
                        {getCustomerValueDisplay(c)}
                      </span>
                      <button
                        className="btn btn-call btn-sm btn-icon customer-list-call-btn"
                        onClick={e => {
                          e.stopPropagation();
                          if (c.isLeadRecord) initiateCall(c.name, c.phone, 'lead', c.sourceLeadId);
                          else initiateCall(c.name, c.phone, 'customer', c.id);
                        }}
                      >
                        <Phone size={12} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right: Full 360 Cockpit */}
        {selectedCustomer ? (
          <div className="card customer-cockpit-card">
            {/* 360 Header */}
            <div className="customer-cockpit-header">
              <div>
                <div className="customer-cockpit-name-row">
                  <h2 className="customer-cockpit-name">{selectedCustomer.name}</h2>
                  <StatusChip status={selectedCustomer.status} />
                </div>
                <div className="customer-cockpit-meta-row">
                  <span>📞 {selectedCustomer.phone}</span>
                  {selectedCustomer.email && <span>✉️ {selectedCustomer.email}</span>}
                  <span>📍 {selectedCustomer.location}</span>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="customer-cockpit-actions">
                <button
                  className="btn btn-primary customer-call-btn"
                  onClick={() =>
                    selectedCustomer.isLeadRecord
                      ? initiateCall(selectedCustomer.name, selectedCustomer.phone, 'lead', selectedCustomer.sourceLeadId)
                      : initiateCall(selectedCustomer.name, selectedCustomer.phone, 'customer', selectedCustomer.id)
                  }
                >
                  <Phone size={15} /> Click to Call
                </button>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="customer-tabs-bar">
              {[
                { id: 'overview', label: 'Overview' },
                { id: 'calls', label: `Calls (${authorizedCustomerCalls.length})` },
                { id: 'followups', label: `Follow-ups (${customerFollowups.length})` },
                { id: 'timeline', label: 'Activity Timeline' },
                { id: 'documents', label: 'Documents' },
              ].map(tab => (
                <button
                  key={tab.id}
                  className={`customer-tab-btn ${activeTab === tab.id ? 'is-active' : ''}`}
                  onClick={() => setActiveTab(tab.id as any)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab Contents */}
            <div className="customer-tab-content">
              {activeTab === 'overview' && (
                <div className="customer-overview-stack">
                  <div className="card customer-profile-card">
                    <h4 className="customer-section-heading">
                      Account & Commercial Profile
                    </h4>
                    <div className="customer-profile-grid">
                      <div>
                        <span className="customer-profile-label">Assigned Account Manager:</span>
                        <div className="customer-profile-val">{selectedCustomer.assignedAgentName}</div>
                      </div>
                      {canAssignToIRM && (
                        <div>
                          <span className="customer-profile-label">Assigned IRM:</span>
                          <div className={selectedCustomer.assignedIrmName ? 'customer-profile-val-primary' : 'customer-profile-val'}>
                            {selectedCustomer.assignedIrmName || 'Unassigned'}
                          </div>
                        </div>
                      )}
                      <div>
                        <span className="customer-profile-label">Investment Range:</span>
                        <div className="customer-profile-val-green">
                          {getCustomerValueDisplay(selectedCustomer)}
                        </div>
                      </div>
                      <div>
                        <span className="customer-profile-label">
                          {selectedCustomer.isLeadRecord ? 'Interested Lead Since:' : 'Customer Since:'}
                        </span>
                        <div className="customer-profile-val">{selectedCustomer.createdAt}</div>
                      </div>
                      <div>
                        <span className="customer-profile-label">Last Contacted:</span>
                        <div className="customer-profile-val-primary">
                          {selectedCustomer.lastContacted}
                        </div>
                      </div>
                    </div>
                  </div>

                  {selectedCustomer.customFields && (() => {
                    const activeDefs = getCustomFieldDefinitions(tenant?.id)
                      .filter((d: CustomFieldDefinition) => d.active !== false && d.module === 'customers')
                      .sort((a: CustomFieldDefinition, b: CustomFieldDefinition) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));

                    const rows = activeDefs
                      .map((def: CustomFieldDefinition) => {
                        const key = def.fieldKey || def.id;
                        const val = selectedCustomer.customFields?.[key];
                        if (val === undefined || val === null || val === '') return null;
                        return {
                          id: def.id,
                          label: def.label || key.replace(/([A-Z])/g, ' $1'),
                          value: String(val),
                        };
                      })
                      .filter(Boolean);

                    if (rows.length === 0) return null;

                    return (
                      <div className="card customer-custom-card">
                        <h4 className="customer-custom-heading">
                          Tenant Specific Relationship Attributes
                        </h4>
                        <div className="customer-custom-grid">
                          {rows.map((item: any) => (
                            <div key={item!.id}>
                              <span className="customer-custom-label">
                                {item!.label}:
                              </span>
                              <div className="customer-custom-val">{item!.value}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                  {/* Recent Call History Preview in Overview */}
                  <div className="card customer-profile-card" style={{ marginTop: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                      <h4 className="customer-section-heading" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Phone size={15} color="var(--primary-600)" />
                        Call History ({authorizedCustomerCalls.length})
                      </h4>
                      {authorizedCustomerCalls.length > 0 && (
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          style={{ fontSize: 12, color: 'var(--primary-600)', padding: '2px 8px' }}
                          onClick={() => setActiveTab('calls')}
                        >
                          View Full History →
                        </button>
                      )}
                    </div>

                    {authorizedCustomerCalls.length === 0 ? (
                      <div className="customer-empty-text" style={{ padding: '20px 12px' }}>
                        No call records logged yet with this customer.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {authorizedCustomerCalls.slice(0, 2).map(c => {
                          const isExpanded = !!expandedCallIds[c.id];
                          return (
                            <div key={c.id} className="customer-call-card-item">
                              <div className="customer-call-compact-row">
                                <div className="customer-call-meta-left">
                                  <span className={`customer-call-direction-badge ${c.direction === 'inbound' ? 'is-inbound' : 'is-outbound'}`}>
                                    {c.direction === 'inbound' ? '↙ Inbound' : '↗ Outbound'}
                                  </span>
                                  <span className="customer-call-date">{formatCallTimestamp(c.timestamp)}</span>
                                  <span className="customer-call-sep">•</span>
                                  <span className="customer-call-duration">
                                    <Clock size={12} /> {formatCallDuration(c.duration)}
                                  </span>
                                  <StatusChip status={c.disposition} size="sm" />
                                </div>
                                <div className="customer-call-meta-right">
                                  <span className={`customer-call-connect-badge ${c.callerType === 'IRM' || c.connectVia === 'Connect via IRM' ? 'is-irm' : 'is-agent'}`}>
                                    {c.callerType === 'IRM' || c.connectVia === 'Connect via IRM' ? (
                                      <>
                                        <Sparkles size={12} /> Connect via IRM
                                      </>
                                    ) : (
                                      <>
                                        <Phone size={12} /> Connect via Agent
                                      </>
                                    )}
                                  </span>
                                  <span className="customer-call-agent-label">
                                    <User size={12} />
                                    <strong>{c.agentName || 'System'}</strong>
                                    <span className={`customer-call-role-tag ${c.callerType === 'IRM' ? 'role-irm' : 'role-agent'}`}>
                                      {c.callerType === 'IRM' ? 'IRM' : 'Agent'}
                                    </span>
                                  </span>
                                  <button
                                    type="button"
                                    className="btn btn-ghost btn-sm customer-call-expand-btn"
                                    onClick={() => toggleCallExpand(c.id)}
                                  >
                                    {isExpanded ? (
                                      <>
                                        <span>Collapse</span>
                                        <ChevronUp size={14} />
                                      </>
                                    ) : (
                                      <>
                                        <span>Details</span>
                                        <ChevronDown size={14} />
                                      </>
                                    )}
                                  </button>
                                </div>
                              </div>
                              {isExpanded && (
                                <div className="customer-call-expanded-panel">
                                  {c.notes && (
                                    <div className="customer-call-notes-section">
                                      <div className="customer-call-section-label">Discussion Notes</div>
                                      <div className="customer-call-notes-content">{c.notes}</div>
                                    </div>
                                  )}
                                  {c.reason && (
                                    <div className="customer-call-reason-section">
                                      <span className="customer-call-reason-label">
                                        {c.disposition === 'Skipped' ? 'Skip Reason:' : 'Outcome Reason:'}
                                      </span>{' '}
                                      <span>{c.reason}</span>
                                    </div>
                                  )}
                                  <div className="customer-call-media-card">
                                    <div className="customer-call-media-header">
                                      <div className="customer-call-media-title">
                                        <Volume2 size={14} />
                                        <span>Voice Recording</span>
                                      </div>
                                      <span className={`badge badge-sm ${c.recordingUrl ? 'badge-success' : 'badge-neutral'}`}>
                                        {c.recordingUrl ? 'Recording Available' : 'Unavailable'}
                                      </span>
                                    </div>
                                    {c.recordingUrl ? (
                                      <div className="customer-call-audio-wrap">
                                        <audio controls src={c.recordingUrl} className="customer-call-audio-player" />
                                      </div>
                                    ) : (
                                      <div className="customer-call-diagnostic-box">
                                        <AlertCircle size={16} className="customer-call-diag-icon" />
                                        <div className="customer-call-diag-body">
                                          <strong>Audio recording not available for this call.</strong>
                                          <p>
                                            No telephony audio recording is attached to this record. Voice recording requires carrier PBX trunking (e.g., Twilio Voice / Exotel) and secure cloud media bucket storage (AWS S3 or Azure Blob) configured on the backend server.
                                          </p>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                  <div className="customer-call-media-card">
                                    <div className="customer-call-media-header">
                                      <div className="customer-call-media-title">
                                        <FileText size={14} />
                                        <span>Call Transcript</span>
                                      </div>
                                      <span className={`badge badge-sm ${c.transcription ? 'badge-success' : 'badge-neutral'}`}>
                                        {c.transcription ? 'Transcript Available' : 'Transcript unavailable'}
                                      </span>
                                    </div>
                                    {c.transcription ? (
                                      <div className="customer-call-transcript-wrap">
                                        <p className="customer-call-transcript-text">{c.transcription}</p>
                                      </div>
                                    ) : (
                                      <div className="customer-call-diagnostic-box">
                                        <FileText size={16} className="customer-call-diag-icon" />
                                        <div className="customer-call-diag-body">
                                          <strong>Transcript unavailable</strong>
                                          <p>
                                            Speech-to-text transcription service is not currently configured on the server. Automatic transcripts require integrating an AI speech-to-text provider (e.g., OpenAI Whisper API, Deepgram, or AWS Transcribe) into the audio capture pipeline.
                                          </p>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'calls' && (
                <div className="customer-calls-stack">
                  {/* Call History Header Bar */}
                  <div className="customer-calls-header-bar">
                    <div className="customer-calls-header-title">
                      <Phone size={17} color="var(--primary-600)" />
                      <span>Customer Call History ({displayedCustomerCalls.length})</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      {/* Filter pills */}
                      <div className="customer-call-filter-pills">
                        <button
                          type="button"
                          className={`btn btn-sm ${callCategoryFilter === 'all' ? 'btn-primary' : 'btn-ghost'}`}
                          onClick={() => setCallCategoryFilter('all')}
                        >
                          All ({authorizedCustomerCalls.length})
                        </button>
                        <button
                          type="button"
                          className={`btn btn-sm ${callCategoryFilter === 'agent' ? 'btn-primary' : 'btn-ghost'}`}
                          onClick={() => setCallCategoryFilter('agent')}
                        >
                          Connect via Agent ({agentCustomerCalls.length})
                        </button>
                        <button
                          type="button"
                          className={`btn btn-sm ${callCategoryFilter === 'irm' ? 'btn-primary' : 'btn-ghost'}`}
                          onClick={() => setCallCategoryFilter('irm')}
                        >
                          Connect via IRM ({irmCustomerCalls.length})
                        </button>
                      </div>

                      {/* Expand / Collapse All */}
                      {displayedCustomerCalls.length > 0 && (
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          style={{ fontSize: 12 }}
                          onClick={() => toggleAllCallsExpand(displayedCustomerCalls)}
                        >
                          {displayedCustomerCalls.every(c => expandedCallIds[c.id]) ? 'Collapse All' : 'Expand All'}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Call Records List */}
                  {displayedCustomerCalls.length === 0 ? (
                    <div className="customer-empty-text">
                      {callCategoryFilter === 'agent'
                        ? 'No Connect via Agent call records found for this customer.'
                        : callCategoryFilter === 'irm'
                        ? 'No Connect via IRM call records found for this customer.'
                        : 'No call records logged yet with this customer. Click "Click to Call" to initiate a call.'}
                    </div>
                  ) : (
                    displayedCustomerCalls.map(c => {
                      const isExpanded = !!expandedCallIds[c.id];
                      return (
                        <div key={c.id} className="customer-call-card-item">
                          {/* Compact Row */}
                          <div className="customer-call-compact-row">
                            <div className="customer-call-meta-left">
                              <span className={`customer-call-direction-badge ${c.direction === 'inbound' ? 'is-inbound' : 'is-outbound'}`}>
                                {c.direction === 'inbound' ? '↙ Inbound' : '↗ Outbound'}
                              </span>
                              <span className="customer-call-date">{formatCallTimestamp(c.timestamp)}</span>
                              <span className="customer-call-sep">•</span>
                              <span className="customer-call-duration">
                                <Clock size={12} /> {formatCallDuration(c.duration)}
                              </span>
                              <StatusChip status={c.disposition} size="sm" />
                            </div>

                            <div className="customer-call-meta-right">
                              {/* Connect Via Category */}
                              <span className={`customer-call-connect-badge ${c.callerType === 'IRM' || c.connectVia === 'Connect via IRM' ? 'is-irm' : 'is-agent'}`}>
                                {c.callerType === 'IRM' || c.connectVia === 'Connect via IRM' ? (
                                  <>
                                    <Sparkles size={12} /> Connect via IRM
                                  </>
                                ) : (
                                  <>
                                    <Phone size={12} /> Connect via Agent
                                  </>
                                )}
                              </span>

                              {/* Caller Name & Role */}
                              <span className="customer-call-agent-label">
                                <User size={12} />
                                <strong>{c.agentName || 'System'}</strong>
                                <span className={`customer-call-role-tag ${c.callerType === 'IRM' ? 'role-irm' : 'role-agent'}`}>
                                  {c.callerType === 'IRM' ? 'IRM' : 'Agent'}
                                </span>
                              </span>

                              {/* Expand / Collapse Button */}
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm customer-call-expand-btn"
                                onClick={() => toggleCallExpand(c.id)}
                              >
                                {isExpanded ? (
                                  <>
                                    <span>Collapse</span>
                                    <ChevronUp size={14} />
                                  </>
                                ) : (
                                  <>
                                    <span>Details</span>
                                    <ChevronDown size={14} />
                                  </>
                                )}
                              </button>
                            </div>
                          </div>

                          {/* Expanded Details Panel */}
                          {isExpanded && (
                            <div className="customer-call-expanded-panel">
                              {/* Discussion Notes */}
                              {c.notes && (
                                <div className="customer-call-notes-section">
                                  <div className="customer-call-section-label">Discussion Notes</div>
                                  <div className="customer-call-notes-content">{c.notes}</div>
                                </div>
                              )}

                              {/* Outcome Reason */}
                              {c.reason && (
                                <div className="customer-call-reason-section">
                                  <span className="customer-call-reason-label">
                                    {c.disposition === 'Skipped' ? 'Skip Reason:' : 'Outcome Reason:'}
                                  </span>{' '}
                                  <span>{c.reason}</span>
                                </div>
                              )}

                              {/* Voice Recording Area */}
                              <div className="customer-call-media-card">
                                <div className="customer-call-media-header">
                                  <div className="customer-call-media-title">
                                    <Volume2 size={14} />
                                    <span>Voice Recording</span>
                                  </div>
                                  <span className={`badge badge-sm ${c.recordingUrl ? 'badge-success' : 'badge-neutral'}`}>
                                    {c.recordingUrl ? 'Recording Available' : 'Recording Unavailable'}
                                  </span>
                                </div>

                                {c.recordingUrl ? (
                                  <div className="customer-call-audio-wrap">
                                    <audio controls src={c.recordingUrl} className="customer-call-audio-player" />
                                  </div>
                                ) : (
                                  <div className="customer-call-diagnostic-box">
                                    <AlertCircle size={16} className="customer-call-diag-icon" />
                                    <div className="customer-call-diag-body">
                                      <strong>Audio recording not available for this call.</strong>
                                      <p>
                                        No telephony audio recording is attached to this call record. Voice recording requires carrier PBX trunking (e.g., Twilio Voice / Exotel) and secure cloud media bucket storage (AWS S3 or Azure Blob) configured on the backend server.
                                      </p>
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* Call Transcript Area */}
                              <div className="customer-call-media-card">
                                <div className="customer-call-media-header">
                                  <div className="customer-call-media-title">
                                    <FileText size={14} />
                                    <span>Call Transcript</span>
                                  </div>
                                  <span className={`badge badge-sm ${c.transcription ? 'badge-success' : 'badge-neutral'}`}>
                                    {c.transcription ? 'Transcript Available' : 'Transcript unavailable'}
                                  </span>
                                </div>

                                {c.transcription ? (
                                  <div className="customer-call-transcript-wrap">
                                    <p className="customer-call-transcript-text">{c.transcription}</p>
                                  </div>
                                ) : (
                                  <div className="customer-call-diagnostic-box">
                                    <FileText size={16} className="customer-call-diag-icon" />
                                    <div className="customer-call-diag-body">
                                      <strong>Transcript unavailable</strong>
                                      <p>
                                        Speech-to-text transcription service is not currently configured on the server. Automatic transcripts require integrating an AI speech-to-text provider (e.g., OpenAI Whisper API, Deepgram, or AWS Transcribe) into the audio capture pipeline.
                                      </p>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {activeTab === 'followups' && (
                <div className="customer-followups-stack">
                  {customerFollowups.length === 0 ? (
                    <div className="customer-empty-text">
                      No open follow-ups for this customer.
                    </div>
                  ) : (
                    customerFollowups.map(f => (
                      <div
                        key={f.id}
                        className="customer-followup-item"
                      >
                        <div>
                          <div className="customer-followup-header">
                            <span className="customer-followup-notes">{f.notes}</span>
                            <StatusChip status={f.priority} size="sm" />
                          </div>
                          <div className="customer-followup-due">
                            ⏰ Due: {formatSmartScheduleDate(f.scheduledAt)} • Assignee: {f.assignedAgentName}
                          </div>
                        </div>

                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => {
                            apiSaveFollowup({ ...f, status: 'Completed' }).then(loadData).catch(console.error);
                          }}
                        >
                          Mark Done
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}


              {activeTab === 'timeline' && <Timeline events={timelineEvents} />}

              {activeTab === 'documents' && selectedCustomer && (
                <div className="customer-docs-stack">
                  <div className="incall-docs-tabs-bar" style={{ marginBottom: 16 }}>
                    {[
                      { id: 'customer' as const, label: 'Customer Documents' },
                      { id: 'company' as const, label: 'Company Resources' },
                    ].map(tab => (
                      <button
                        key={tab.id}
                        className="btn btn-ghost incall-docs-tab-btn"
                        style={{
                          borderBottom: customerDocsTab === tab.id ? '2px solid var(--primary-600)' : '2px solid transparent',
                          color: customerDocsTab === tab.id ? 'var(--primary-600)' : 'var(--text-secondary)',
                          fontWeight: customerDocsTab === tab.id ? 700 : 500,
                        }}
                        onClick={() => setCustomerDocsTab(tab.id)}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {customerDocsTab === 'customer' && (
                    <>
                      <DocumentUploader
                        entityType={selectedCustomer.isLeadRecord ? 'lead' : 'customer'}
                        entityId={selectedCustomer.isLeadRecord ? (selectedCustomer.sourceLeadId || selectedCustomer.id) : selectedCustomer.id}
                        allowedCategories={['KYC', 'Agreement', 'Payment Receipt', 'Identity Proof', 'Other']}
                      />
                      <DocumentList
                        entityType={selectedCustomer.isLeadRecord ? 'lead' : 'customer'}
                        entityId={selectedCustomer.isLeadRecord ? (selectedCustomer.sourceLeadId || selectedCustomer.id) : selectedCustomer.id}
                        canDelete
                      />
                    </>
                  )}

                  {customerDocsTab === 'company' && (
                    <>
                      <DocumentUploader
                        entityType="company"
                        entityId={tenant?.id || tenant?.slug || '1'}
                        allowedCategories={['Brochure', 'Price List', 'Terms & Conditions', 'Policy Document', 'Other']}
                      />
                      <DocumentList
                        entityType="company"
                        entityId={tenant?.id || tenant?.slug || '1'}
                        canDelete={false}
                      />
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="card customer-empty-placeholder">
            Select a customer from the list to view their 360 profile.
          </div>
        )}
      </div>
      {/* New Customer Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => { setIsAddModalOpen(false); resetAddForm(); }}
        title="New Customer"
        subtitle="Create a fresh customer account and assign it to yourself."
        footer={
          <>
            <button className="btn btn-secondary" disabled={isSubmittingCustomer} onClick={() => { setIsAddModalOpen(false); resetAddForm(); }}>
              Cancel
            </button>
            <button className="btn btn-primary" disabled={isSubmittingCustomer} onClick={handleAddCustomer}>
              {isSubmittingCustomer ? 'Creating Customer...' : 'Create Customer'}
            </button>
          </>
        }
      >
        <div className="customer-modal-stack">
          {addCustomerError && (
            <div className="form-error" style={{ padding: '8px 12px', background: 'rgba(239, 68, 68, 0.15)', borderRadius: 6, border: '1px solid #ef4444' }}>
              ⚠️ {addCustomerError}
            </div>
          )}
          {/* Name */}
          <div className="form-group">
            <label htmlFor="add-customer-name" className="form-label">Name *</label>
            <input
              id="add-customer-name"
              name="name"
              autoComplete="name"
              className={`form-input${addErrors.name ? ' is-invalid' : ''}`}
              placeholder="e.g. Agent Two"
              value={newName}
              onChange={e => { setNewName(e.target.value); if (addErrors.name) setAddErrors(p => ({ ...p, name: undefined })); }}
            />
            {addErrors.name && <div className="form-error">{addErrors.name}</div>}
          </div>
          {/* Phone */}
          <div className="form-group">
            <label htmlFor="add-customer-phone" className="form-label">Phone *</label>
            <input
              id="add-customer-phone"
              name="phone"
              autoComplete="tel"
              className={`form-input${addErrors.phone ? ' is-invalid' : ''}`}
              placeholder="e.g. +91 98765 43210"
              value={newPhone}
              onChange={e => { setNewPhone(e.target.value); if (addErrors.phone) setAddErrors(p => ({ ...p, phone: undefined })); }}
            />
            {addErrors.phone && <div className="form-error">{addErrors.phone}</div>}
          </div>
          {/* Email */}
          <div className="form-group">
            <label htmlFor="add-customer-email" className="form-label">Email</label>
            <input
              id="add-customer-email"
              name="email"
              autoComplete="email"
              className="form-input"
              type="email"
              placeholder="e.g. agent2@example.com"
              value={newEmail}
              onChange={e => setNewEmail(e.target.value)}
            />
          </div>
          {/* Location */}
          <div className="form-group">
            <label htmlFor="add-customer-location" className="form-label">Location</label>
            <input
              id="add-customer-location"
              name="location"
              autoComplete="address-level2"
              className="form-input"
              placeholder="e.g. Bengaluru"
              value={newLocation}
              onChange={e => setNewLocation(e.target.value)}
            />
          </div>
          {/* Status */}
          <div className="form-group">
            <label htmlFor="add-customer-status" className="form-label">Status</label>
            <select
              id="add-customer-status"
              name="status"
              className="form-select"
              value={newStatus}
              onChange={e => setNewStatus(e.target.value as 'Active' | 'VIP' | 'Inactive')}
            >
              <option value="Active">Active</option>
              <option value="VIP">VIP</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
          {/* Tenant-Specific Custom Fields */}
          {(() => {
            const customerDefs = getCustomFieldDefinitions(tenant?.id)
              .filter((d: CustomFieldDefinition) => d.active !== false && d.module === 'customers')
              .sort((a: CustomFieldDefinition, b: CustomFieldDefinition) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));

            if (customerDefs.length === 0) return null;

            return customerDefs.map((def: CustomFieldDefinition) => {
              const key = def.fieldKey || def.id;
              const val = newCustomFields[key] ?? def.defaultValue ?? '';
              return (
                <div key={def.id} className="form-group">
                  <label htmlFor={`add-customer-cf-${def.id}`} className="form-label">
                    {def.label || key}
                    {def.required ? ' *' : ''}
                  </label>
                  {def.fieldType === 'select' && def.options && def.options.length > 0 ? (
                    <select
                      id={`add-customer-cf-${def.id}`}
                      name={`cf_${key}`}
                      className="form-select"
                      required={def.required}
                      value={val}
                      onChange={e => setNewCustomFields(prev => ({ ...prev, [key]: e.target.value }))}
                    >
                      {!def.defaultValue && !def.options.includes(val) && (
                        <option value="">Select {def.label}...</option>
                      )}
                      {def.options.map((opt: string) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      id={`add-customer-cf-${def.id}`}
                      name={`cf_${key}`}
                      type={def.fieldType === 'number' ? 'number' : 'text'}
                      className="form-input"
                      required={def.required}
                      placeholder={`Enter ${def.label}...`}
                      value={val}
                      onChange={e => setNewCustomFields(prev => ({ ...prev, [key]: e.target.value }))}
                    />
                  )}
                </div>
              );
            });
          })()}
        </div>
      </Modal>

      {/* ── Manual IRM Selection Modal (GHL India Ventures Sales Executive only) ── */}
      {canAssignToIRM && (
        <Modal
          isOpen={isManualModalOpen}
          onClose={() => setIsManualModalOpen(false)}
          title="Assign Leads to IRM"
          subtitle={`Select an IRM to assign the ${selectedCustomerIds.size} selected customer(s) to.`}
          maxWidth={900}
          className="irm-assign-modal"
          footer={
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setIsManualModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={!selectedIrmId}
                onClick={handleConfirmManualAssignment}
              >
                Confirm Assignment →
              </button>
            </div>
          }
        >
          <div className="irm-selection-list">
            {irms.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--text-muted)' }}>
                <p style={{ fontSize: 14, marginBottom: 12 }}>No IRM representatives currently found for this company.</p>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    const fallback = storageService.getIrms(tenant?.id || tenant?.slug);
                    if (fallback.length > 0) {
                      setDbIrms(fallback);
                      setSelectedIrmId(fallback[0].id);
                    }
                  }}
                >
                  Reload IRM List
                </button>
              </div>
            ) : (
              irms.map((irm: IrmProfile) => {
              const currentCount = allCustomers.filter(c => c.assignedIrmName === irm.name || c.assignedIrmId === irm.id).length;
              const workload = currentCount <= 2 ? 'Low' : currentCount <= 5 ? 'Medium' : 'High';
              const isSelected = selectedIrmId === irm.id;

              return (
                <div
                  key={irm.id}
                  className={`irm-selection-item ${isSelected ? 'is-selected' : ''}`}
                  onClick={() => setSelectedIrmId(irm.id)}
                >
                  {/* Col 1 – Radio */}
                  <div className="irm-col-radio">
                    <input
                      id={`irm-select-${irm.id}`}
                      type="radio"
                      name="selectedIrm"
                      aria-label={`Select IRM ${irm.name}`}
                      checked={isSelected}
                      onChange={() => setSelectedIrmId(irm.id)}
                      style={{ accentColor: 'var(--primary-600)', width: 16, height: 16 }}
                    />
                  </div>

                  {/* Col 2 – IRM Info */}
                  <div className="irm-col-info">
                    <div className="irm-item-name">{irm.name}</div>
                    <div className="irm-item-meta-row">Experience: <strong>{irm.experience}</strong> ({irm.experienceLevel})</div>
                    <div className="irm-item-meta-row">Performance: <strong>{irm.performance}%</strong></div>
                    <div className="irm-item-meta-row">Customers: <strong>{currentCount}</strong></div>
                  </div>

                  {/* Col 3 – Workload */}
                  <div className="irm-col-pill">
                    <span className={`irm-pill workload-${workload.toLowerCase()}`}>
                      Workload: {workload}
                    </span>
                  </div>

                  {/* Col 4 – Availability */}
                  <div className="irm-col-pill">
                    <span className={`irm-pill ${irm.status.toLowerCase()}`}>
                      {irm.status}
                    </span>
                  </div>
                </div>
              );
            }))}
          </div>
        </Modal>
      )}

      {/* ── Auto Assignment Preview Modal (GHL India Ventures Sales Executive only) ── */}
      {canAssignToIRM && (
        <Modal
          isOpen={isAutoPreviewModalOpen}
          onClose={() => setIsAutoPreviewModalOpen(false)}
          title="Auto Assignment Preview"
          subtitle="Capacity-to-experience smart matching with balanced workload distribution."
          className="irm-assign-modal auto-preview-modal"
          maxWidth={900}
          footer={
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setIsAutoPreviewModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={autoRecommendations.length === 0}
                onClick={handleConfirmAutoAssignment}
              >
                Confirm Assignment ({autoRecommendations.length})
              </button>
            </div>
          }
        >
          <p className="auto-preview-subtext">
            Review the calculated IRM recommendations before final assignment. You can edit any individual IRM assignment if needed.
          </p>

          <div className="auto-preview-table-container">
            <table className="auto-preview-table">
              <colgroup>
                <col style={{ width: '160px' }} />
                <col style={{ width: '130px' }} />
                <col style={{ width: '175px' }} />
                <col />
                <col style={{ width: '65px' }} />
              </colgroup>
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Investment</th>
                  <th>Recommended IRM</th>
                  <th>Match Reason</th>
                  <th style={{ textAlign: 'center' }}>Edit</th>
                </tr>
              </thead>
              <tbody>
                {autoRecommendations.map(rec => (
                  <tr key={rec.customerId}>
                    <td title={rec.customerName}>
                      <div className="auto-cell-customer">{rec.customerName}</div>
                    </td>
                    <td title={rec.investmentDisplay}>
                      <span className="auto-cell-investment">{rec.investmentDisplay}</span>
                    </td>
                    <td>
                      {editingRecommendationCustomerId === rec.customerId ? (
                        <select
                          id={`auto-edit-irm-${rec.customerId}`}
                          name="recommendedIrm"
                          aria-label={`Change IRM recommendation for ${rec.customerName}`}
                          className="auto-edit-select"
                          value={rec.recommendedIrmId}
                          onChange={e => handleUpdateSingleRecommendation(rec.customerId, e.target.value)}
                          autoFocus
                        >
                          {irms.map((irm: IrmProfile) => (
                            <option key={irm.id} value={irm.id}>
                              {irm.name} ({irm.experienceLevel}, {irm.status})
                            </option>
                          ))}
                        </select>
                      ) : (
                        <div className="auto-cell-irm" title={rec.recommendedIrmName}>
                          <span>{rec.recommendedIrmName}</span>
                        </div>
                      )}
                    </td>
                    <td title={rec.matchReason}>
                      <span className={`auto-reason-tag ${rec.isEdited ? 'manual-edit' : ''}`}>
                        {rec.matchReason}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm auto-edit-btn"
                        onClick={() => {
                          if (editingRecommendationCustomerId === rec.customerId) {
                            setEditingRecommendationCustomerId(null);
                          } else {
                            setEditingRecommendationCustomerId(rec.customerId);
                          }
                        }}
                      >
                        {editingRecommendationCustomerId === rec.customerId ? 'Done' : 'Edit'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Modal>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            backgroundColor: '#059669',
            color: '#fff',
            padding: '12px 20px',
            borderRadius: 8,
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          <CheckCircle size={18} /> {toastMessage}
        </div>
      )}
    </div>
  );
};