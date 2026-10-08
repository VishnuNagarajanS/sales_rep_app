import React, { useState, useEffect, useRef, useMemo } from 'react';
import Papa from 'papaparse';
import {
  Users,
  Phone,
  Plus,
  Upload,
  CheckCircle2,
  Trash2,
  Edit,
  ExternalLink,
  CalendarCheck,
  AlertTriangle,
  Clock,
  ArrowRight,
  UserCheck,
} from 'lucide-react';
import { Lead, Customer, Deal, Followup, IrmProfile } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useCall } from '../../context/CallContext';
import { apiClient } from '../../services/apiClient';
import { storageService } from '../../services/storageService';
import {
  AssignableAgent,
  loadAgentDirectory,
  isLeadAssigned,
  persistLeadAssignment,
} from '../../services/agentDirectory';
import {
  getLeads,
  getDeals,
  saveLead as apiSaveLead,
  saveCustomer as apiSaveCustomer,
  saveOpportunity as apiSaveOpportunity,
  getFollowups,
  getCustomers,
  saveFollowup as apiSaveFollowup,
  isTenantMatch,
  getCompanyIrms,
} from '../../services/ghlApiService';
import { DataTable, Column, RowAction } from '../../components/common/DataTable';
import { FilterBar } from '../../components/common/FilterBar';
import { StatusChip } from '../../components/common/StatusChip';
import { Drawer } from '../../components/common/Drawer';
import { Modal } from '../../components/common/Modal';
import { LeadDetailDrawerContent } from '../../components/common/LeadDetailDrawerContent';
import './LeadsPage.css';

export const normalizePhone = (phone?: string): string | null => {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length >= 10) return digits.slice(-10);
  if (digits.length >= 7) return digits;
  return null;
};

export const normalizeEmail = (email?: string): string | null => {
  if (!email) return null;
  const clean = email.trim().toLowerCase();
  return clean.length > 0 ? clean : null;
};

const CAPACITY_OPTIONS = [
  'Contact for Co-Invest Details',
  '₹1 Cr – ₹5 Cr',
  '₹5 Cr – ₹10 Cr',
  '₹10 Cr – ₹25 Cr',
  '₹25 Cr+'
];

const MOCK_AGENTS = storageService.getMockAgents();
export { MOCK_AGENTS };

interface LeadsPageProps {
  onNavigate?: (route: string) => void;
}

export const LeadsPage: React.FC<LeadsPageProps> = ({ onNavigate }) => {
  const handleNavigate = (route: string) => {
    if (onNavigate) {
      onNavigate(route);
    } else {
      sessionStorage.setItem('nexus_current_route', route);
      window.dispatchEvent(new CustomEvent('nexus_navigate', { detail: route }));
    }
  };
  const { tenant, user } = useAuth();
  const { initiateCall } = useCall();

  const [leads, setLeads] = useState<Lead[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [allFollowups, setAllFollowups] = useState<any[]>([]);

  // Duplicate in Follow-up & Customer Resolution States
  interface DuplicateFollowupModalData {
    contactId: string;
    contactType: 'lead' | 'customer';
    contactName: string;
    contactPhone: string;
    contactEmail?: string;
    assignedAgentName: string;
    assignedAgentId?: string;
    existingStatus?: string;
  }
  const [duplicateFollowupModal, setDuplicateFollowupModal] = useState<DuplicateFollowupModalData | null>(null);

  interface DuplicateKycModalData {
    contactId: string;
    contactType: 'lead' | 'customer' | 'kyc';
    contactName: string;
    contactPhone: string;
    contactEmail?: string;
    assignedAgentName: string;
    assignedAgentId?: string;
    kycId?: string;
    dealId?: string;
  }
  const [duplicateKycModal, setDuplicateKycModal] = useState<DuplicateKycModalData | null>(null);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [isSchedulingActivity, setIsSchedulingActivity] = useState<boolean>(false);
  const [followupDate, setFollowupDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(10, 0, 0, 0);
    return d.toISOString().slice(0, 16);
  });
  const [followupPriority, setFollowupPriority] = useState<string>('Medium');
  const [followupNotes, setFollowupNotes] = useState<string>('');
  const [isSavingFollowupActivity, setIsSavingFollowupActivity] = useState<boolean>(false);

  interface DuplicateCustomerModalData {
    contactId: string;
    contactName: string;
    contactPhone: string;
    contactEmail?: string;
    assignedAgentName: string;
  }
  const [duplicateCustomerModal, setDuplicateCustomerModal] = useState<DuplicateCustomerModalData | null>(null);
  const [formErrorMessage, setFormErrorMessage] = useState<string | null>(null);

  const [companyIrms, setCompanyIrms] = useState<IrmProfile[]>([]);
  const [isAssignIrmModalOpen, setIsAssignIrmModalOpen] = useState(false);
  const [leadToAssignIrm, setLeadToAssignIrm] = useState<Lead | null>(null);
  const [selectedIrmForLead, setSelectedIrmForLead] = useState<string>('');

  const agentsList = useMemo(() => storageService.getAgents(tenant?.id), [tenant?.id]);

  const MOVED_LEAD_STATUSES = ['Interested', 'Converted', 'Follow-up Required', 'Not Interested', 'Junk'];

  const pendingFollowupContactIds = useMemo(() => {
    return new Set((allFollowups || []).map((f: any) => String(f.contactId || '')));
  }, [allFollowups]);

  const pendingFollowupPhones = useMemo(() => {
    return new Set(
      (allFollowups || [])
        .map((f: any) => (f.contactPhone || '').replace(/\D/g, '').slice(-10))
        .filter(Boolean)
    );
  }, [allFollowups]);

  const isLeadInFollowupOrMoved = (l: Lead) => {
    if (MOVED_LEAD_STATUSES.includes(l.status)) return true;
    if (pendingFollowupContactIds.has(String(l.id))) return true;
    const phoneDigits = (l.phone || '').replace(/\D/g, '').slice(-10);
    if (phoneDigits && pendingFollowupPhones.has(phoneDigits)) return true;
    return false;
  };

  // Role-based scoping: Sales Executives and IRMs see only their own leads.
  // Managers / Admins / Super Admins see the full company lead list (no filter).
  // Inactive / moved leads (Interested, Follow-up Required, Not Interested, Junk, Converted, and those in follow-up stage) are excluded from active Leads.
  const roleCode = user?.role?.code;
  const isExec = roleCode === 'sales_executive';
  const isLeadScopedUser = roleCode === 'sales_executive' || roleCode === 'irm';
  const isIrm = roleCode === 'irm';
  const currentTenantId = tenant?.id || tenant?.slug;
  const tenantLeads = leads.filter(l => !l.companyId || isTenantMatch(l.companyId, currentTenantId));

  const scopedLeads = useMemo(() => {
    if (isExec) {
      return tenantLeads
        .filter(l => {
          const hasIrm = Boolean(
            l.assignedIrmId ||
            l.assignedIrmName ||
            l.customFields?.assignedIrmId ||
            l.customFields?.assignedIrmName
          );
          if (hasIrm) return false;
          return (
            (l.assignedAgentId && String(l.assignedAgentId) === String(user?.id)) ||
            (l.assignedAgentName && l.assignedAgentName === user?.name)
          );
        })
        .filter(l => !isLeadInFollowupOrMoved(l));
    }

    if (isIrm) {
      const uId = String(user?.id);
      const uName = (user?.name || '').trim().toLowerCase();

      const raw = tenantLeads.filter(l => {
        if (l.status !== 'Interested') return false;
        
        if (l.assignedIrmId && String(l.assignedIrmId) === uId) return true;
        if (l.assignedIrmName && l.assignedIrmName.trim().toLowerCase() === uName) return true;
        if (l.customFields?.assignedIrmId && String(l.customFields.assignedIrmId) === uId) return true;
        if (l.customFields?.assignedIrmName && String(l.customFields.assignedIrmName).trim().toLowerCase() === uName) return true;
        
        // Fallback to legacy assignment
        if (l.assignedAgentId && String(l.assignedAgentId) === uId) return true;
        return !!l.assignedAgentName && l.assignedAgentName.trim().toLowerCase() === uName;
      });

      // Deduplicate by phone to prevent double-entries from different IDs
      const seen = new Set<string>();
      return raw.filter(l => {
        const phone = (l.phone || '').replace(/\D/g, '').slice(-10);
        const key = phone || l.id;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }

    return tenantLeads.filter(l => !isLeadInFollowupOrMoved(l));
  }, [tenantLeads, isExec, isIrm, user?.id, user?.name, pendingFollowupContactIds, pendingFollowupPhones]);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isDetailDrawerOpen, setIsDetailDrawerOpen] = useState(false);
  const [isEditDrawerOpen, setIsEditDrawerOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isConvertModalOpen, setIsConvertModalOpen] = useState(false);

  // CSV Import State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importError, setImportError] = useState('');
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [columnMap, setColumnMap] = useState<Record<string, string>>({});
  const [importResults, setImportResults] = useState<{ success: number; skipped: number } | null>(null);

  // Filter states
  const [statusFilter, setStatusFilter] = useState('All');
  const [capacityFilter, setCapacityFilter] = useState('All');
  const [agentFilter, setAgentFilter] = useState('All');
  const [handoverFilter, setHandoverFilter] = useState('Mine');
  const [datePreset, setDatePreset] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  const handoverOptions = useMemo(() => {
    const names = Array.from(new Set(scopedLeads.map(l => l.handedOverFromName).filter(Boolean)));
    if (names.length === 0) return [];
    return [
      { value: 'Mine', label: 'Mine' },
      ...names.map(name => ({ value: `Handover_${name}`, label: `Handed over from ${name}` }))
    ];
  }, [scopedLeads]);

  const agentOptions = useMemo(() => {
    return Array.from(
      new Set(scopedLeads.map(l => l.assignedAgentName).filter((n): n is string => !!n))
    )
      .sort()
      .map(name => ({ value: name, label: name }));
  }, [scopedLeads]);

  const formatDateYMD = (d: Date): string => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const getPresetDates = (preset: string): { from: string; to: string } => {
    const now = new Date();
    const todayStr = formatDateYMD(now);

    switch (preset) {
      case 'today':
        return { from: todayStr, to: todayStr };
      case 'yesterday': {
        const yest = new Date(now);
        yest.setDate(yest.getDate() - 1);
        const yestStr = formatDateYMD(yest);
        return { from: yestStr, to: yestStr };
      }
      case 'this_week': {
        const d = new Date(now);
        d.setDate(d.getDate() - 6);
        return { from: formatDateYMD(d), to: todayStr };
      }
      case 'this_month': {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        return { from: formatDateYMD(startOfMonth), to: formatDateYMD(endOfMonth) };
      }
      case 'last_30_days': {
        const d = new Date(now);
        d.setDate(d.getDate() - 29);
        return { from: formatDateYMD(d), to: todayStr };
      }
      default:
        return { from: '', to: '' };
    }
  };

  const handleDatePresetChange = (preset: string) => {
    if (preset === 'all') {
      setDatePreset('all');
      setDateFrom('');
      setDateTo('');
    } else if (preset === 'custom') {
      setDatePreset('custom');
    } else {
      const { from, to } = getPresetDates(preset);
      setDatePreset(preset);
      setDateFrom(from);
      setDateTo(to);
    }
  };

  const handleCustomDateChange = (from: string, to: string) => {
    setDatePreset('custom');
    setDateFrom(from);
    setDateTo(to);
  };

  // GHL Admin assign-mode state
  const isGhlAdmin =
    (tenant?.slug === 'ghl' || tenant?.id === 't-ghl-01') &&
    (roleCode === 'company_admin' || (roleCode as string) === 'admin' || roleCode === 'super_admin');
  const [assignMode, setAssignMode] = useState<'manual' | 'auto'>('manual');
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(new Set());
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [assignStep, setAssignStep] = useState<'pick-agent' | 'confirm'>('pick-agent');
  const [assignSelectedAgent, setAssignSelectedAgent] = useState<AssignableAgent | null>(null);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [aiDistribution, setAiDistribution] = useState<Record<string, Lead[]>>({});
  const [isAiEditMode, setIsAiEditMode] = useState(false);
  const [assignedLeadIds, setAssignedLeadIds] = useState<Set<string>>(new Set());
  const [agentAssignments, setAgentAssignments] = useState<
    Array<{ leadId: string; leadName: string; agentId: number; agentName: string; assignedAt: string }>
  >(() => {
    try {
      const saved = sessionStorage.getItem('ghl_mock_agent_assignments');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [toast, setToast] = useState<string | null>(null);

  // Real sales agents (from DB) + admin ids. A lead still owned by an admin = UNASSIGNED.
  const [agents, setAgents] = useState<AssignableAgent[]>([]);
  const [agentsFromApi, setAgentsFromApi] = useState(true);
  const [adminIds, setAdminIds] = useState<Set<string>>(
    new Set(user?.id ? [String(user.id)] : [])
  );

  useEffect(() => {
    if (isLeadScopedUser) return;
    let cancelled = false;
    loadAgentDirectory(tenant?.id, user?.id).then(dir => {
      if (cancelled) return;
      setAgents(dir.agents);
      setAdminIds(dir.adminIds);
      setAgentsFromApi(dir.fromApi);
    });
    return () => { cancelled = true; };
  }, [tenant?.id, user?.id, isLeadScopedUser]);

  // Form state
  const [formData, setFormData] = useState<Partial<Lead>>({});
  const [convertDealTitle, setConvertDealTitle] = useState('');
  const [convertDealValue, setConvertDealValue] = useState<number>(5000000);

  const currentAssetClass =
    formData.customFields?.assetClass ||
    formData.customFields?.preferredAssetClass ||
    '';

  const handleAssetClassChange = (newAssetClass: string) => {
    setFormData(prev => ({
      ...prev,
      customFields: {
        ...prev.customFields,
        assetClass: newAssetClass,
        preferredAssetClass: newAssetClass,
      },
    }));
  };

  const loadData = async () => {
    if (apiClient.isMockMode()) {
      const updated = storageService.getLeads(tenant?.id);
      setLeads(updated);
      const allFus = storageService.getFollowups ? storageService.getFollowups(tenant?.id) : [];
      const pendingFus = (allFus || []).filter((f: any) => f.status === 'Pending');
      setAllFollowups(pendingFus);
      setCustomers(storageService.getCustomers ? storageService.getCustomers(tenant?.id) : []);
      setSelectedLead(prev => {
        if (!prev) return null;
        const found = updated.find(l => l.id === prev.id);
        if (!found || MOVED_LEAD_STATUSES.includes(found.status) || isLeadInFollowupOrMoved(found) || found.status === 'Junk') {
          setIsDetailDrawerOpen(false);
          setIsEditDrawerOpen(false);
          return null;
        }
        return found;
      });
      return;
    }

    try {
      const [updatedFollowups, updatedCustomers, updatedDeals, irmsList] = await Promise.all([
        getFollowups(tenant?.id).catch(() => []),
        getCustomers(tenant?.id).catch(() => []),
        getDeals(tenant?.id).catch(() => []),
        getCompanyIrms(tenant?.id).catch(() => []),
      ]);
      const pendingFus = (updatedFollowups || []).filter((f: any) => f.status === 'Pending');
      setAllFollowups(pendingFus);
      setCustomers(updatedCustomers || []);
      setDeals(updatedDeals || []);
      setCompanyIrms(irmsList || []);

      let loadedLeads: Lead[] = [];
      if (isGhlAdmin) {
        const res = await apiClient.get<any>('/sales-executive/leads?page=1&pageSize=200&assignment=unassigned');
        if (res.success && res.data && res.data.items) {
          loadedLeads = res.data.items.map((item: any) => ({
            ...item,
            id: String(item.id),
            assignedAgentId: item.assignedAgentId ? String(item.assignedAgentId) : undefined,
            customFields: item.customFields || {}
          }));
        }
      } else {
        loadedLeads = await getLeads(tenant?.id);
      }
      setLeads(loadedLeads);
      setSelectedLead(prev => {
        if (!prev) return null;
        const found = loadedLeads.find((l: any) => l.id === prev.id);
        if (!found || MOVED_LEAD_STATUSES.includes(found.status) || isLeadInFollowupOrMoved(found) || found.status === 'Junk') {
          setIsDetailDrawerOpen(false);
          setIsEditDrawerOpen(false);
          return null;
        }
        return found;
      });
    } catch (err) {
      console.error('Failed to load leads from API', err);
    }
  };

  useEffect(() => {
    storageService.cleanupDuplicateLeads(tenant?.id);
    loadData();
    const handleUpdate = () => loadData();
    window.addEventListener('nexus_storage_updated', handleUpdate);
    window.addEventListener('nexus_handover_updated', handleUpdate);
    
    // Polling every 15 seconds while visible
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible' && !apiClient.isMockMode()) {
        loadData();
      }
    }, 15000);
    
    const handleFocus = () => {
      if (!apiClient.isMockMode()) loadData();
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      window.removeEventListener('nexus_storage_updated', handleUpdate);
      window.removeEventListener('nexus_handover_updated', handleUpdate);
      window.removeEventListener('focus', handleFocus);
      clearInterval(interval);
    };
  }, [tenant?.id, isGhlAdmin]);

  const isGhlSalesExec = tenant?.slug === 'ghl' && user?.role?.code === 'sales_executive';
  const ghlPendingFollowups = isGhlSalesExec
    ? (storageService.getFollowups(tenant?.id) || []).filter(f => f.status === 'Pending')
    : [];

  const matchCapacity = (lead: Lead, filterRange: string): boolean => {
    if (!filterRange || filterRange === 'All') return true;
    const rawCap = (
      lead.customFields?.investmentCapacity ||
      lead.customFields?.budgetRange ||
      (lead as any).investmentAmount ||
      ''
    ).trim();

    if (!rawCap) return false;

    const normalize = (s: string) => s.replace(/[–—]/g, '-').replace(/\s+/g, ' ').trim().toLowerCase();
    const nCap = normalize(rawCap);
    const nFilter = normalize(filterRange);

    if (nCap === nFilter) return true;

    // Match range buckets
    if (filterRange === '₹1 Cr – ₹5 Cr') {
      return (
        nCap.includes('1 cr') ||
        nCap.includes('1.5 cr') ||
        nCap.includes('2 cr') ||
        nCap.includes('3 cr') ||
        nCap.includes('4 cr') ||
        nCap.includes('5 cr') ||
        nCap.includes('75l')
      );
    }
    if (filterRange === '₹5 Cr – ₹10 Cr') {
      return (
        nCap.includes('5 cr') ||
        nCap.includes('6 cr') ||
        nCap.includes('7 cr') ||
        nCap.includes('8 cr') ||
        nCap.includes('10 cr')
      );
    }
    if (filterRange === '₹10 Cr – ₹25 Cr') {
      return (
        nCap.includes('10 cr') ||
        nCap.includes('15 cr') ||
        nCap.includes('20 cr') ||
        nCap.includes('25 cr')
      );
    }
    if (filterRange === '₹25 Cr+') {
      return (
        nCap.includes('25 cr') ||
        nCap.includes('25cr') ||
        nCap.includes('30 cr') ||
        nCap.includes('50 cr')
      );
    }
    if (filterRange === 'Contact for Co-Invest Details') {
      return nCap.includes('co-invest') || nCap.includes('contact');
    }

    return false;
  };

  const filteredLeads = scopedLeads.filter(lead => {
    if (assignedLeadIds.has(lead.id)) return false;
    if (isGhlSalesExec && lead.status !== 'Callback') {
      const leadPhoneDigits = (lead.phone || '').replace(/\D/g, '').slice(-10);
      const hasPendingFollowup = ghlPendingFollowups.some(f => {
        if (f.contactId && f.contactId !== 'contact-new' && f.contactId === lead.id) {
          return true;
        }
        const fPhoneDigits = (f.contactPhone || '').replace(/\D/g, '').slice(-10);
        return fPhoneDigits && leadPhoneDigits && fPhoneDigits === leadPhoneDigits;
      });
      if (hasPendingFollowup) return false;
    }
    if (!isGhlAdmin && statusFilter !== 'All' && (lead.status as string) !== statusFilter) return false;
    if (agentFilter !== 'All' && lead.assignedAgentName !== agentFilter) return false;
    if (capacityFilter !== 'All') {
      if (!matchCapacity(lead, capacityFilter)) return false;
    }

    // Date range filter
    if (datePreset !== 'all' || dateFrom || dateTo) {
      const rawDate = lead.createdAt;
      if (!rawDate) return datePreset === 'all';
      const dateStr = /^\d{4}-\d{2}-\d{2}/.test(rawDate)
        ? rawDate.substring(0, 10)
        : formatDateYMD(new Date(rawDate));
      if (dateFrom && dateStr < dateFrom) return false;
      if (dateTo && dateStr > dateTo) return false;
    }

    if (handoverOptions.length > 0) {
      if (handoverFilter === 'Mine' && lead.handoverId) return false;
      if (handoverFilter !== 'Mine' && handoverFilter !== 'All') {
        const name = handoverFilter.replace('Handover_', '');
        if (lead.handedOverFromName !== name) return false;
      }
    }

    return true;
  });

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  // Saves assignments to the backend (real agents) and mirrors them locally.
  const assignLeads = async (pairs: Array<{ lead: Lead; agent: AssignableAgent }>): Promise<number> => {
    const results = await Promise.allSettled(pairs.map(p => persistLeadAssignment(p.lead, p.agent)));
    const failed = results.filter(r => r.status === 'rejected') as PromiseRejectedResult[];
    if (failed.length > 0) {
      console.error('[Lead assignment] failed', failed.map(f => f.reason));
      alert(`${failed.length} lead(s) could not be assigned: ${failed[0].reason?.message || 'Unknown error'}`);
    }
    return results.length - failed.length;
  };

  const handleOpenAssignIrm = (lead: Lead) => {
    setLeadToAssignIrm(lead);
    setSelectedIrmForLead(lead.assignedIrmId || companyIrms[0]?.id || '');
    setIsAssignIrmModalOpen(true);
  };

  const handleConfirmAssignIrm = async () => {
    if (!leadToAssignIrm || !selectedIrmForLead) return;
    const chosenIrm = companyIrms.find(i => String(i.id) === String(selectedIrmForLead));
    if (!chosenIrm) return;

    const nowIso = new Date().toISOString();
    const updatedLead: Lead = {
      ...leadToAssignIrm,
      assignedIrmId: String(chosenIrm.id),
      assignedIrmName: chosenIrm.name,
      assignedIrmAt: nowIso,
      notes: `${leadToAssignIrm.notes ? leadToAssignIrm.notes + '\n\n' : ''}[${new Date().toLocaleDateString()}] Assigned to IRM: ${chosenIrm.name} by ${user?.name || 'Sales Executive'}`,
      customFields: {
        ...leadToAssignIrm.customFields,
        assignedIrmId: String(chosenIrm.id),
        assignedIrmName: chosenIrm.name,
        assignedIrmAt: nowIso,
      }
    };

    try {
      await apiSaveLead(updatedLead);
    } catch (err) {
      console.warn('[LeadsPage] Failed to save IRM assigned lead to API:', err);
      storageService.saveLead(updatedLead);
    }

    setIsAssignIrmModalOpen(false);
    setLeadToAssignIrm(null);
    if (selectedLead?.id === leadToAssignIrm.id) {
      setSelectedLead(updatedLead);
    }
    await loadData();
    
    const toast = document.createElement('div');
    toast.className = 'nexus-toast success';
    toast.textContent = `✓ Lead "${updatedLead.name}" successfully assigned to IRM ${chosenIrm.name}!`;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  };

  const handleManualAssignConfirm = async () => {
    if (!assignSelectedAgent) return;
    const agent = assignSelectedAgent;
    const leadIds = Array.from(selectedLeadIds).map(id => id.replace('db-', ''));
    let realAssigned = 0;

    if (apiClient.isMockMode()) {
      const pairs = leadIds.map(id => leads.find(l => l.id === id)).filter((l): l is Lead => !!l).map(lead => ({ lead, agent }));
      await assignLeads(pairs);
    } else {
      try {
        const res = await apiClient.post<any>('/ghl/leads/assign', {
          leadIds: leadIds.map(id => parseInt(id, 10)),
          agentId: agent.dbId
        });
        realAssigned = res?.data?.assigned ?? 0;
        const skipped = res?.data?.skipped || [];
        if (skipped.length > 0) alert(`${skipped.length} lead(s) skipped: ${skipped[0].reason}`);
      } catch (err: any) {
        console.error('Manual assign failed', err);
        alert(`Manual assign failed: ${err.message || 'Unknown error'}`);
        return;
      }
    }

    const okCount = apiClient.isMockMode() ? leadIds.length : realAssigned;
    setSelectedLeadIds(new Set());
    setIsAssignModalOpen(false);
    setAssignStep('pick-agent');
    setAssignSelectedAgent(null);
    loadData();
    if (okCount > 0) {
      showToast(`✓ ${okCount} lead${okCount !== 1 ? 's' : ''} assigned to ${agent.name}${agentsFromApi ? '' : ' (local only – no real agents found)'}`);
    }
  };

  const handleOpenAiSuggestion = () => {
    if (agents.length === 0) {
      showToast('No sales agents available to assign to.');
      return;
    }
    const pool = filteredLeads;
    const dist: Record<string, Lead[]> = {};
    agents.forEach(a => { dist[a.id] = []; });
    pool.forEach((lead, i) => {
      const agent = agents[i % agents.length];
      dist[agent.id].push(lead);
    });
    setAiDistribution(dist);
    setIsAiEditMode(false);
    setIsAiModalOpen(true);
  };

  const handleAiMoveLead = (leadId: string, fromAgentId: string, direction: 'left' | 'right') => {
    const agentIds = agents.map(a => a.id);
    const fromIdx = agentIds.indexOf(fromAgentId);
    const toIdx = direction === 'left' ? fromIdx - 1 : fromIdx + 1;
    if (toIdx < 0 || toIdx >= agentIds.length) return;
    const toAgentId = agentIds[toIdx];
    setAiDistribution(prev => {
      const fromLeads = [...(prev[fromAgentId] || [])].filter(l => l.id !== leadId);
      const movedLead = (prev[fromAgentId] || []).find(l => l.id === leadId);
      if (!movedLead) return prev;
      const toLeads = [...(prev[toAgentId] || []), movedLead];
      return { ...prev, [fromAgentId]: fromLeads, [toAgentId]: toLeads };
    });
  };

  const handleAiConfirm = async () => {
    let okCount = 0;
    
    if (apiClient.isMockMode()) {
      const pairs: Array<{ lead: Lead; agent: AssignableAgent }> = [];
      Object.entries(aiDistribution).forEach(([agentId, agentLeads]) => {
        const agent = agents.find(a => a.id === agentId);
        if (!agent) return;
        agentLeads.forEach(lead => pairs.push({ lead, agent }));
      });
      okCount = await assignLeads(pairs);
    } else {
      // Send exactly the distribution the admin previewed/edited: one assign call per agent.
      try {
        let skippedCount = 0;
        for (const [agentId, agentLeads] of Object.entries(aiDistribution)) {
          const agent = agents.find(a => a.id === agentId);
          if (!agent?.dbId || agentLeads.length === 0) continue;
          const res = await apiClient.post<any>('/ghl/leads/assign', {
            leadIds: agentLeads.map(l => parseInt(l.id.replace('db-', ''), 10)),
            agentId: agent.dbId
          });
          okCount += res?.data?.assigned ?? 0;
          skippedCount += (res?.data?.skipped || []).length;
        }
        if (skippedCount > 0) alert(`${skippedCount} lead(s) were skipped (already assigned).`);
      } catch (err: any) {
        console.error('Auto assign failed', err);
        alert(`Auto assign failed: ${err.message || 'Unknown error'}`);
        loadData();
        return;
      }
    }

    setIsAiModalOpen(false);
    loadData();
    if (okCount > 0) {
      showToast(`✓ ${okCount} lead${okCount !== 1 ? 's' : ''} assigned via AI Suggestion`);
    }
  };

  const handleOpenCreate = () => {
    if (!user) {
      console.warn('[LeadsPage] Cannot create lead: user session is not yet loaded.');
      return;
    }
    const defaultAgentId = isLeadScopedUser ? user.id : undefined;
    const defaultAgentName = isLeadScopedUser ? user.name : undefined;

    setFormData({
      id: `lead-${Date.now()}`,
      companyId: tenant?.id || 't-ghl-01',
      name: '',
      phone: '+91 ',
      email: '',
      location: '',
      source: 'Website Inbound',
      status: 'New',
      priority: 'Medium',
      assignedAgentId: defaultAgentId,
      assignedAgentName: defaultAgentName,
      createdAt: new Date().toISOString().split('T')[0],
      notes: '',
      customFields: tenant?.slug === 'jamin'
        ? { budgetRange: '₹45L - ₹65L', preferredLocation: 'Devanahalli North', readyToRegister: 'Immediate' }
        : { investmentCapacity: '', assetClass: '', preferredAssetClass: '', horizon: '3-5 Years' },
    });
    setFormErrorMessage(null);
    setIsEditDrawerOpen(true);
  };

  const handleOpenEdit = (lead: Lead) => {
    setFormData({ ...lead });
    setFormErrorMessage(null);
    setIsEditDrawerOpen(true);
  };

  const handleScheduleActivityForExisting = async (
    contactId: string,
    contactType: 'lead' | 'customer',
    contactName: string,
    contactPhone: string
  ) => {
    setIsSavingFollowupActivity(true);
    try {
      await apiSaveFollowup({
        id: `fu-${Date.now()}`,
        companyId: tenant?.id || 't-ghl-01',
        contactId: contactId || 'contact-new',
        contactType,
        contactName,
        contactPhone,
        scheduledAt: followupDate ? new Date(followupDate).toISOString() : new Date(Date.now() + 86400000).toISOString(),
        priority: followupPriority as any,
        notes: followupNotes || `Follow-up activity created for existing ${contactType}.`,
        status: 'Pending',
        assignedAgentId: String(user?.id || 'usr-exec'),
        assignedAgentName: user?.name || 'Agent',
      });
      showToast(`Follow-up activity successfully scheduled for "${contactName}".`);
      setDuplicateKycModal(null);
      setDuplicateFollowupModal(null);
      setDuplicateCustomerModal(null);
      setIsEditDrawerOpen(false);
      await loadData();
    } catch (err: any) {
      console.error('Failed to schedule follow-up activity:', err);
      showToast(`⚠️ Failed to schedule follow-up activity: ${err.message || 'Unknown error'}`);
    } finally {
      setIsSavingFollowupActivity(false);
    }
  };

  const handleSaveLead = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErrorMessage(null);
    if (!formData.name || !formData.phone) {
      const msg = 'Please provide both contact name and phone number.';
      setFormErrorMessage(msg);
      showToast(msg);
      return;
    }

    const cleanPhone = (formData.phone || '').replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      const msg = 'Please enter a valid phone number with at least 10 digits.';
      setFormErrorMessage(msg);
      showToast(msg);
      return;
    }

    // Pull real agent ID and name at save-time to prevent stale/fallback placeholder IDs from leaking
    const resolvedAgentId = (isLeadScopedUser && user?.id)
      ? user.id
      : (formData.assignedAgentId && formData.assignedAgentId !== 'usr-exec' && formData.assignedAgentId !== 'unassigned'
          ? formData.assignedAgentId
          : undefined);
    const resolvedAgentName = (isLeadScopedUser && user?.name)
      ? user.name
      : (formData.assignedAgentName && formData.assignedAgentName !== 'Agent' && formData.assignedAgentName !== 'Unassigned'
          ? formData.assignedAgentName
          : undefined);

    const isExistingById = leads.some(l => l.id === formData.id);
    const targetCompanyId = formData.companyId || tenant?.id || 't-ghl-01';

    let leadToSave: Lead;
    let isUpdated = isExistingById;

    if (!isExistingById) {
      const normNewPhone = normalizePhone(formData.phone);
      const normNewEmail = normalizeEmail(formData.email);

      let matchingPendingFollowup: any = null;
      let existingMatch: Lead | undefined;
      let existingCustomer: Customer | undefined;
      let matchingKycDeal: Deal | undefined;

      if (normNewPhone || normNewEmail) {
        // 1. Search pending follow-ups
        matchingPendingFollowup = (allFollowups || []).find((f: any) => {
          if (normNewPhone) {
            const fDigits = normalizePhone(f.contactPhone);
            if (fDigits && fDigits === normNewPhone) return true;
          }
          return false;
        });

        // 2. Search existing leads
        existingMatch = leads.find(l => {
          if (!targetCompanyId || isTenantMatch(l.companyId, targetCompanyId)) {
            const normLPhone = normalizePhone(l.phone);
            const normLEmail = normalizeEmail(l.email);
            const phoneMatch = normNewPhone && normLPhone && normNewPhone === normLPhone;
            const emailMatch = normNewEmail && normLEmail && normNewEmail === normLEmail;
            return phoneMatch || emailMatch;
          }
          return false;
        });

        // 3. Search existing customers
        existingCustomer = (customers || []).find(c => {
          if (!targetCompanyId || isTenantMatch(c.companyId, targetCompanyId)) {
            const normCPhone = normalizePhone(c.phone);
            const normCEmail = normalizeEmail(c.email);
            const phoneMatch = normNewPhone && normCPhone && normNewPhone === normCPhone;
            const emailMatch = normNewEmail && normCEmail && normNewEmail === normCEmail;
            return phoneMatch || emailMatch;
          }
          return false;
        });

        // 4. Search existing KYC deals
        matchingKycDeal = (deals || []).find(d => {
          if (!targetCompanyId || isTenantMatch(d.companyId, targetCompanyId)) {
            const isKyc = d.stage === 'qualified_investor' || !!d.kycStatus || !!(d as any).kycId;
            if (!isKyc) return false;
            if (existingCustomer && d.customerId && String(d.customerId) === String(existingCustomer.id)) return true;
            if (existingMatch && d.customerId && String(d.customerId) === String(existingMatch.id)) return true;
            const dPhone = normalizePhone(d.phone);
            if (normNewPhone && dPhone && dPhone === normNewPhone) return true;
            const dEmail = normalizeEmail(d.email);
            if (normNewEmail && dEmail && dEmail === normNewEmail) return true;
          }
          return false;
        });
      }

      // 1. Authoritative Stage Detection: Check if contact already exists in KYC
      const isLeadInKyc = existingMatch && (
        existingMatch.status === 'Qualified' ||
        !!(existingMatch.customFields as any)?.movedToKycAt
      );

      const isContactInKyc = !!matchingKycDeal || isLeadInKyc;

      if (isContactInKyc) {
        const cName = matchingKycDeal?.customerName || existingCustomer?.name || existingMatch?.name || formData.name;
        const cAgent = matchingKycDeal?.assignedAgentName || existingCustomer?.assignedAgentName || existingMatch?.assignedAgentName || 'an assigned agent';
        const cType: 'lead' | 'customer' = existingCustomer ? 'customer' : 'lead';
        const cId = existingCustomer?.id || existingMatch?.id || matchingKycDeal?.customerId || '';
        const cPhone = existingCustomer?.phone || existingMatch?.phone || matchingKycDeal?.phone || formData.phone;

        setDuplicateKycModal({
          contactId: String(cId),
          contactType: cType,
          contactName: cName,
          contactPhone: cPhone,
          contactEmail: existingCustomer?.email || existingMatch?.email || matchingKycDeal?.email || formData.email,
          assignedAgentName: cAgent,
          dealId: matchingKycDeal?.id ? String(matchingKycDeal.id) : undefined,
          kycId: (matchingKycDeal as any)?.kycId ? String((matchingKycDeal as any).kycId) : undefined,
        });
        setFollowupNotes(formData.notes ? `Follow-up from lead intake: ${formData.notes}` : `Follow-up with ${cName}`);
        setIsSchedulingActivity(false);
        return; // Prevent creating duplicate lead
      }

      // 2. Authoritative Stage Detection: Check if contact genuinely exists in Follow-up
      const isLeadInFollowup = existingMatch && (
        existingMatch.status === 'Follow-up Required' ||
        (matchingPendingFollowup && (matchingPendingFollowup.contactType === 'lead' || !matchingPendingFollowup.contactType) && matchingPendingFollowup.contactId === existingMatch.id)
      );
      const isCustomerInFollowup = existingCustomer && (
        (matchingPendingFollowup && matchingPendingFollowup.contactType === 'customer' && matchingPendingFollowup.contactId === existingCustomer.id) ||
        (allFollowups || []).some(f => f.contactId === existingCustomer.id && f.status === 'Pending')
      );
      const existsInFollowup = isLeadInFollowup || isCustomerInFollowup || !!matchingPendingFollowup;

      if (existsInFollowup) {
        const cName = existingCustomer?.name || existingMatch?.name || matchingPendingFollowup?.contactName || formData.name;
        const cAgent = existingCustomer?.assignedAgentName || existingMatch?.assignedAgentName || matchingPendingFollowup?.assignedAgentName || 'an assigned agent';
        const cType: 'lead' | 'customer' = existingCustomer ? 'customer' : 'lead';
        const cId = existingCustomer?.id || existingMatch?.id || matchingPendingFollowup?.contactId || '';
        const cPhone = existingCustomer?.phone || existingMatch?.phone || matchingPendingFollowup?.contactPhone || formData.phone;

        setDuplicateFollowupModal({
          contactId: cId,
          contactType: cType,
          contactName: cName,
          contactPhone: cPhone,
          contactEmail: existingCustomer?.email || existingMatch?.email || formData.email,
          assignedAgentName: cAgent,
          existingStatus: existingMatch?.status || (existingCustomer ? 'Active Customer' : 'Follow-up Required'),
        });
        setFollowupNotes(formData.notes ? `Follow-up from lead intake: ${formData.notes}` : `Follow-up with ${cName}`);
        setIsSchedulingActivity(false);
        return; // Prevent creating duplicate lead
      }

      // Check if contact already exists as Customer (not in follow-up)
      if (existingCustomer) {
        setDuplicateCustomerModal({
          contactId: existingCustomer.id,
          contactName: existingCustomer.name,
          contactPhone: existingCustomer.phone,
          contactEmail: existingCustomer.email,
          assignedAgentName: existingCustomer.assignedAgentName || 'Agent',
        });
        setFollowupNotes(formData.notes ? `Follow-up from lead intake: ${formData.notes}` : `Follow-up with ${existingCustomer.name}`);
        return; // Prevent creating duplicate lead for existing customer
      }

      // Check if contact already exists as Lead (not in follow-up)
      if (existingMatch) {
        if (existingMatch.assignedAgentId && String(existingMatch.assignedAgentId) !== String(resolvedAgentId)) {
          showToast(`⚠️ Lead already exists for "${existingMatch.name}" and is currently assigned to ${existingMatch.assignedAgentName || 'another agent'}.`);
          return;
        }
        showToast(`Duplicate found: "${existingMatch.name}" already exists. Updating existing record.`);
        isUpdated = true;
        leadToSave = {
          ...existingMatch,
          ...formData,
          id: existingMatch.id, // Preserve existing ID
          companyId: existingMatch.companyId || targetCompanyId,
          // Preserve existing status if already in an active workflow
          status: (existingMatch.status && existingMatch.status !== 'New')
            ? existingMatch.status
            : (isIrm ? 'Interested' : (formData.status || 'New')),
          assignedAgentId: resolvedAgentId || existingMatch.assignedAgentId,
          assignedAgentName: resolvedAgentName || existingMatch.assignedAgentName,
          customFields: {
            ...(existingMatch.customFields || {}),
            ...(formData.customFields || {}),
          },
        };
      } else {
        leadToSave = {
          ...formData,
          status: isIrm ? 'Interested' : (formData.status || 'New'),
          assignedAgentId: resolvedAgentId,
          assignedAgentName: resolvedAgentName,
          companyId: targetCompanyId,
          createdAt: formData.createdAt || new Date().toISOString().split('T')[0],
        } as Lead;
      }
    } else {
      leadToSave = {
        ...formData,
        status: isIrm ? 'Interested' : (formData.status || 'New'),
        assignedAgentId: resolvedAgentId,
        assignedAgentName: resolvedAgentName,
        companyId: targetCompanyId,
      } as Lead;
    }

    try {
      await apiSaveLead(leadToSave);

      storageService.addAuditLog({
        id: `aud-${Date.now()}`,
        timestamp: 'Just now',
        actorName: user?.name || resolvedAgentName || 'Admin',
        actorEmail: user?.email || 'agent@nexus.io',
        action: isUpdated ? 'LEAD_UPDATED' : 'LEAD_CREATED',
        entityType: 'Lead',
        entityId: leadToSave.id,
        companyId: tenant?.id,
        companyName: tenant?.name,
        details: `Lead record ${leadToSave.name} (${leadToSave.phone}) saved.`,
      });

      await loadData();
      showToast(isUpdated ? 'Lead updated successfully.' : 'New lead created successfully.');
      setFormErrorMessage(null);
      setIsEditDrawerOpen(false);
    } catch (err: any) {
      console.error('[LeadsPage] Failed to save lead:', err);
      const errMsg = err.message || '';
      const errList: string[] = err.errors || [];

      const isDupKyc =
        errList.includes('DUPLICATE_IN_KYC') ||
        errMsg.includes('already exists in KYC');

      const isDupFollowup =
        !isDupKyc && (
          errList.includes('DUPLICATE_IN_FOLLOWUP') ||
          errMsg.includes('already exists in Follow-up')
        );

      if (isDupKyc) {
        const cId = errList.find(e => e.startsWith('CONTACT_ID:'))?.split(':')[1] || '';
        const cType = (errList.find(e => e.startsWith('CONTACT_TYPE:'))?.split(':')[1] as any) || 'lead';
        const cName = errList.find(e => e.startsWith('CONTACT_NAME:'))?.split(':')[1] || formData.name;
        const cAgent = errList.find(e => e.startsWith('ASSIGNED_AGENT:'))?.split(':')[1] || 'Agent';
        const kId = errList.find(e => e.startsWith('KYC_ID:'))?.split(':')[1] || '';
        const dId = errList.find(e => e.startsWith('DEAL_ID:'))?.split(':')[1] || '';

        setDuplicateKycModal({
          contactId: cId,
          contactType: cType,
          contactName: cName,
          contactPhone: formData.phone,
          contactEmail: formData.email,
          assignedAgentName: cAgent,
          kycId: kId,
          dealId: dId,
        });
        setFollowupNotes(formData.notes ? `Follow-up from lead intake: ${formData.notes}` : `Follow-up with ${cName}`);
        setIsSchedulingActivity(false);
      } else if (isDupFollowup) {
        const cId = errList.find(e => e.startsWith('CONTACT_ID:'))?.split(':')[1] || '';
        const cType = (errList.find(e => e.startsWith('CONTACT_TYPE:'))?.split(':')[1] as any) || 'lead';
        const cName = errList.find(e => e.startsWith('CONTACT_NAME:'))?.split(':')[1] || formData.name;
        const cAgent = errList.find(e => e.startsWith('ASSIGNED_AGENT:'))?.split(':')[1] || 'Agent';

        setDuplicateFollowupModal({
          contactId: cId,
          contactType: cType,
          contactName: cName,
          contactPhone: formData.phone,
          contactEmail: formData.email,
          assignedAgentName: cAgent,
        });
        setFollowupNotes(formData.notes ? `Follow-up from lead intake: ${formData.notes}` : `Follow-up with ${cName}`);
        setIsSchedulingActivity(false);
      } else if (errList.includes('DUPLICATE_CUSTOMER') || errMsg.includes('customer already exists')) {
        const cId = errList.find(e => e.startsWith('CONTACT_ID:'))?.split(':')[1] || '';
        const cName = errList.find(e => e.startsWith('CONTACT_NAME:'))?.split(':')[1] || formData.name;
        const cAgent = errList.find(e => e.startsWith('ASSIGNED_AGENT:'))?.split(':')[1] || 'Agent';
        setDuplicateCustomerModal({
          contactId: cId,
          contactName: cName,
          contactPhone: formData.phone,
          contactEmail: formData.email,
          assignedAgentName: cAgent,
        });
      } else {
        const displayErr = errMsg || 'Failed to save lead record. Please check the entered values and try again.';
        setFormErrorMessage(displayErr);
        showToast(`⚠️ ${displayErr}`);
      }
    }
  };

  const handleDeleteLead = async (lead: Lead) => {
    if (confirm(`Delete lead ${lead.name}?`)) {
      try {
        if (lead.id.toString().startsWith('db-')) {
          const dbId = lead.id.toString().replace('db-', '');
          await apiClient.delete(`/sales-executive/leads/${dbId}`);
        } else {
          await apiSaveLead({ ...lead, status: 'Junk' }).catch(() => {});
        }
      } catch (err: any) {
        console.error('Failed to delete lead from DB', err);
      }
      storageService.deleteLead(lead.id);
      setLeads(prev => prev.filter(l => l.id !== lead.id));
      window.dispatchEvent(new CustomEvent('nexus_storage_updated'));
      showToast(`Lead ${lead.name} deleted`);
      loadData();
    }
  };

  const handleStartConvert = (lead: Lead) => {
    setSelectedLead(lead);
    setConvertDealTitle(
      tenant?.slug === 'jamin'
        ? `${lead.name} - Villa Plot Booking`
        : `${lead.name} - High Yield Asset Investment`
    );
    setIsConvertModalOpen(true);
  };

  const handleConfirmConvert = () => {
    if (!selectedLead || !tenant) return;

    // 1. Create Customer
    const newCustomer: Customer = {
      id: `cust-${Date.now()}`,
      companyId: tenant.id,
      name: selectedLead.name,
      phone: selectedLead.phone,
      email: selectedLead.email,
      status: 'Active',
      assignedAgentId: selectedLead.assignedAgentId,
      assignedAgentName: selectedLead.assignedAgentName,
      location: selectedLead.location,
      lastContacted: 'Today',
      openDealsCount: 1,
      totalValue: convertDealValue,
      createdAt: new Date().toISOString().split('T')[0],
      notes: `Converted from lead. Original notes: ${selectedLead.notes}`,
      customFields: selectedLead.customFields,
    };
    storageService.saveCustomer(newCustomer);

    // 2. Create Deal
    const newDeal: Deal = {
      id: `deal-${Date.now()}`,
      companyId: tenant.id,
      title: convertDealTitle,
      customerId: newCustomer.id,
      customerName: newCustomer.name,
      stage: tenant.slug === 'jamin' ? 'site_visit' : 'consultation',
      value: convertDealValue,
      expectedCloseDate: 'Within 30 Days',
      assignedAgentId: selectedLead.assignedAgentId,
      assignedAgentName: selectedLead.assignedAgentName,
      notes: `Deal initiated upon converting lead ${selectedLead.name}.`,
      createdAt: new Date().toISOString().split('T')[0],
    };
    storageService.saveDeal(newDeal);

    // 3. Mark Lead as Converted
    storageService.saveLead({ ...selectedLead, status: 'Converted' });

    setIsConvertModalOpen(false);
    setIsDetailDrawerOpen(false);
  };

  const handleFileSelect = (file: File) => {
    setImportError('');
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setImportError('Only .csv files are supported right now');
      return;
    }
    setImportFile(file);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const headers = results.meta.fields || [];
        setCsvHeaders(headers);
        setParsedRows(results.data);

        // Auto-map
        const newMap: Record<string, string> = {};
        const targetFields = ['name', 'phone', 'email', 'location', 'source', 'priority'];
        targetFields.forEach(tf => {
          const match = headers.find(h => h.toLowerCase().includes(tf.toLowerCase()));
          if (match) newMap[tf] = match;
        });
        setColumnMap(newMap);
      }
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileSelect(file);
  };

  const handleImportLeads = () => {
    let successCount = 0;
    let skipCount = 0;
    let updatedCount = 0;
    const companyId = tenant?.id || 't-ghl-01';

    // Build a dedup set from current leads AND customers so we detect duplicates across both
    const normalizePhone = (ph: string) => (ph || '').replace(/\D/g, '').slice(-10);
    const normalizeEmail = (em: string) => (em || '').trim().toLowerCase();

    const existingPhones = new Set(leads.map(l => normalizePhone(l.phone)).filter(Boolean));
    const existingEmails = new Set(leads.map(l => normalizeEmail(l.email)).filter(Boolean));

    const existingCompanyCustomers = storageService.getCustomers(tenant?.id) || [];
    existingCompanyCustomers.forEach((c: any) => {
      const cPh = normalizePhone(c.phone);
      if (cPh) existingPhones.add(cPh);
      const cEm = normalizeEmail(c.email);
      if (cEm) existingEmails.add(cEm);
    });

    parsedRows.forEach((row, index) => {
      const nameVal = row[columnMap['name']];
      const phoneVal = row[columnMap['phone']];

      if (!nameVal || !phoneVal) {
        skipCount++;
        return;
      }

      const emailVal = row[columnMap['email']] || '';
      const locationVal = row[columnMap['location']] || '';
      const sourceVal = row[columnMap['source']] || 'CSV Import';
      const rawPriority = row[columnMap['priority']];
      let priorityVal = 'Medium';
      if (['Low', 'Medium', 'High', 'Urgent'].includes(String(rawPriority))) {
        priorityVal = rawPriority;
      }

      // Check for existing lead by phone in this company
      const existingMatch = storageService.findLeadByPhone(phoneVal, companyId);
      if (existingMatch) {
        const updatedLead: Lead = {
          ...existingMatch,
          name: nameVal || existingMatch.name,
          email: emailVal || existingMatch.email,
          location: locationVal || existingMatch.location,
          source: sourceVal || existingMatch.source,
          priority: (priorityVal as any) || existingMatch.priority,
        };
        storageService.saveLead(updatedLead);
        updatedCount++;
        successCount++;
        return;
      }

      // ── Duplicate check ──────────────────────────────────────────────────────
      const normPhone = normalizePhone(phoneVal);
      const normEmail = normalizeEmail(emailVal);
      if ((normPhone && existingPhones.has(normPhone)) || (normEmail && existingEmails.has(normEmail))) {
        console.info(`[CSV Import] Skipping duplicate: ${nameVal} — phone ${phoneVal} or email ${emailVal} already exists`);
        skipCount++;
        return;
      }
      // Register the new values so later rows in the same batch don't duplicate each other
      if (normPhone) existingPhones.add(normPhone);
      if (normEmail) existingEmails.add(normEmail);
      // ─────────────────────────────────────────────────────────────────────────

      const newLead: Lead = {
        id: `lead-${Date.now()}-${index}`,
        companyId,
        name: nameVal,
        phone: phoneVal,
        email: emailVal,
        location: locationVal,
        source: sourceVal,
        priority: priorityVal as any,
        status: isIrm ? 'Interested' : 'New',
        assignedAgentId: user?.id || 'usr-exec',
        assignedAgentName: user?.name || 'Agent',
        createdAt: new Date().toISOString().split('T')[0],
        notes: '',
        customFields: {}
      };

      storageService.saveLead(newLead);
      successCount++;
    });

    storageService.addAuditLog({
      id: `aud-${Date.now()}`,
      timestamp: 'Just now',
      actorName: user?.name || 'Agent',
      actorEmail: user?.email || 'agent@nexus.io',
      action: 'LEADS_BULK_IMPORTED',
      entityType: 'Lead',
      entityId: `batch-${Date.now()}`,
      companyId: tenant?.id,
      companyName: tenant?.name,
      details: `Bulk imported ${successCount} leads (${updatedCount} updated, ${successCount - updatedCount} created), skipped ${skipCount}.`,
    });

    setImportResults({ success: successCount, skipped: skipCount });
    loadData();
  };


  const resetImportState = () => {
    setImportFile(null);
    setImportError('');
    setParsedRows([]);
    setCsvHeaders([]);
    setColumnMap({});
    setImportResults(null);
  };

  // Columns for DataTable
  const statusColumn: Column<Lead> = {
    key: 'status',
    header: 'Status',
    sortable: true,
    render: l => {
      if ((l.status as string) === 'Callback') {
        return (
          <span
            className="status-chip status-chip-callback"
            style={{
              backgroundColor: 'rgba(59, 130, 246, 0.12)',
              color: '#2563eb',
              borderColor: 'rgba(59, 130, 246, 0.3)',
              fontSize: '11px',
              padding: '2px 8px',
            }}
          >
            <span className="status-dot" style={{ backgroundColor: '#2563eb' }} />
            Callback
          </span>
        );
      }
      return <StatusChip status={l.status} size="sm" />;
    },
  };

  const sourceColumn: Column<Lead> = {
    key: 'source',
    header: 'Source',
    sortable: true,
    render: l => <span className="lead-text-muted">{l.source}</span>,
  };

  const assignedAgentColumn: Column<Lead> = {
    key: 'assignedAgentName',
    header: 'Assigned Agent',
    sortable: true,
    width: '18%',
    render: l => {
      const agentName = (l.assignedAgentName && l.assignedAgentName !== 'Agent')
        ? l.assignedAgentName
        : (l.assignedAgentId === user?.id && user?.name ? user.name : (l.assignedAgentName || '—'));
      return <span className="lead-text-muted">{agentName}</span>;
    },
  };

  const columns: Column<Lead>[] = [
    ...(isGhlAdmin && assignMode === 'manual' ? [{
      key: 'select',
      header: (
        <input
          type="checkbox"
          className="assign-checkbox"
          checked={filteredLeads.length > 0 && filteredLeads.every(l => selectedLeadIds.has(l.id))}
          onChange={e => {
            if (e.target.checked) setSelectedLeadIds(new Set(filteredLeads.map(l => l.id)));
            else setSelectedLeadIds(new Set());
          }}
        />
      ) as unknown as string,
      align: 'center' as const,
      render: (l: Lead) => (
        <input
          type="checkbox"
          className="assign-checkbox"
          checked={selectedLeadIds.has(l.id)}
          onChange={e => {
            e.stopPropagation();
            setSelectedLeadIds(prev => {
              const next = new Set(prev);
              if (e.target.checked) next.add(l.id); else next.delete(l.id);
              return next;
            });
          }}
          onClick={e => e.stopPropagation()}
        />
      ),
    } as Column<Lead>] : []),
    {
      key: 'name',
      header: 'Lead Name & Contact',
      sortable: true,
      render: l => (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span className="lead-name-primary">{l.name}</span>
            {l.handedOverFromName && (
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
                title={`Handed over from ${l.handedOverFromName}${l.handoverPlannedEnd ? ` until ${new Date(l.handoverPlannedEnd).toLocaleDateString()}` : ''}`}
              >
                Covering for {l.handedOverFromName}
              </span>
            )}
          </div>
          <div className="lead-name-sub">{l.phone}</div>
        </div>
      ),
    },
    {
      key: 'email',
      header: 'Email',
      sortable: true,
      render: l => <span className="lead-text-muted">{l.email || '—'}</span>,
    },
    {
      key: 'location',
      header: 'City',
      sortable: true,
      render: l => <span>{l.location || '—'}</span>,
    },
    {
      key: 'investmentAmount',
      header: 'Investment Amount',
      sortable: true,
      render: l => {
        const amount =
          l.customFields?.investmentCapacity ||
          l.customFields?.budgetRange ||
          (l as any).investmentAmount ||
          '—';
        return <span className="lead-investment-val">{amount}</span>;
      },
    },
    ...(isIrm ? [assignedAgentColumn] : [statusColumn, sourceColumn]),
    {
      key: 'quickCall',
      header: 'Quick Call',
      align: 'center',
      render: l => (
        <div className="lead-quick-call-cell">
          <button
            className="btn btn-call btn-sm btn-icon customer-list-call-btn"
            title={`Call ${l.name}`}
            aria-label={`Call ${l.name}`}
            onClick={e => {
              e.stopPropagation();
              initiateCall(l.name, l.phone, 'lead', l.id);
            }}
          >
            <Phone size={12} color="#ffffff" />
          </button>
        </div>
      ),
    },
  ];

  const rowActions: RowAction<Lead>[] = [
    {
      label: 'View 360 Drawer',
      icon: <ExternalLink size={14} className="leads-action-icon" />,
      onClick: l => {
        setSelectedLead(l);
        setIsDetailDrawerOpen(true);
      },
    },
    {
      label: 'Edit Lead',
      icon: <Edit size={14} className="leads-action-icon" />,
      onClick: l => handleOpenEdit(l),
    },
    ...(isExec ? [{
      label: 'Assign to IRM',
      icon: <UserCheck size={14} className="leads-action-icon" />,
      onClick: (l: Lead) => handleOpenAssignIrm(l),
    }] : []),
    {
      label: 'Delete Lead',
      icon: <Trash2 size={14} color="#ef4444" className="leads-action-icon" />,
      danger: true,
      onClick: l => handleDeleteLead(l),
    },
  ];

  return (
    <div className="leads-page">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <Users size={24} color="var(--primary-600)" /> Leads Management
          </h1>
          <p className="page-subtitle">
            Capture, qualify, call, and convert inbound prospects for {tenant?.name}.
          </p>
        </div>

        <div className="leads-header-actions">
          <button
            className="btn btn-secondary"
            onClick={() => setIsImportModalOpen(true)}
          >
            <Upload size={15} /> Import CSV
          </button>
          <button className="btn btn-primary" onClick={handleOpenCreate} disabled={!user} title={!user ? 'Loading user...' : undefined}>
            <Plus size={15} /> Add New Lead
          </button>
        </div>
      </div>

      {/* Leads Table */}
      <DataTable
        columns={columns}
        data={filteredLeads}
        keyExtractor={l => l.id}
        rowActions={rowActions}
        onRowClick={l => {
          setSelectedLead(l);
          setIsDetailDrawerOpen(true);
        }}
        searchPlaceholder="Search leads by name, phone, or location..."
        emptyTitle="No leads matching criteria"
        emptyDescription="Create a new lead or clear your filters to display inbound leads."
        emptyActionLabel="+ Add First Lead"
        onEmptyAction={handleOpenCreate}
        filtersNode={
          <div className="leads-toolbar">
            <FilterBar
              filters={[
                ...(handoverOptions.length > 0 ? [{
                  key: 'handover',
                  label: 'View',
                  value: handoverFilter,
                  onChange: setHandoverFilter,
                  options: handoverOptions
                }] : []),
                ...(isGhlAdmin ? [] : [{
                  key: 'status',
                  label: 'Status',
                  value: statusFilter,
                  onChange: setStatusFilter,
                  options: [
                    { value: 'New', label: 'New' },
                    { value: 'Callback', label: 'Callback' },
                    { value: 'No Response', label: 'No Response' },
                  ],
                }]),
                ...(!isExec ? [{
                  key: 'agent',
                  label: 'Agent',
                  value: agentFilter,
                  onChange: setAgentFilter,
                  options: agentOptions,
                }] : []),
                ...(isGhlAdmin ? [{
                  key: 'investmentCapacity',
                  label: 'Investment Capacity Range',
                  value: capacityFilter,
                  onChange: setCapacityFilter,
                  placeholder: 'Select a range',
                  options: CAPACITY_OPTIONS.map(o => ({ value: o, label: o })),
                }] : []),
              ]}
              dateRange={{
                preset: datePreset,
                onPresetChange: handleDatePresetChange,
                from: dateFrom,
                to: dateTo,
                onChange: handleCustomDateChange,
              }}
              onClearAll={() => {
                setStatusFilter('All');
                setAgentFilter('All');
                setCapacityFilter('All');
                setHandoverFilter('Mine');
                setDatePreset('all');
                setDateFrom('');
                setDateTo('');
              }}
            />
            {isGhlAdmin && (
              <div className="assign-toggle">
                <span className="assign-toggle-label">Assign:</span>
                <div className="assign-toggle-group">
                  <button
                    className={`assign-toggle-btn${assignMode === 'manual' ? ' active' : ''}`}
                    onClick={() => { setAssignMode('manual'); setSelectedLeadIds(new Set()); }}
                  >Manual</button>
                  <button
                    className={`assign-toggle-btn${assignMode === 'auto' ? ' active' : ''}`}
                    onClick={() => { setAssignMode('auto'); setSelectedLeadIds(new Set()); }}
                  >Auto</button>
                </div>
                {assignMode === 'auto' && (
                  <div className="assign-auto-bar">
                    <button className="btn btn-primary btn-sm" onClick={handleOpenAiSuggestion}>
                      ✦ AI Suggestion
                    </button>
                    <div style={{ position: 'relative', display: 'inline-flex' }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        disabled
                        title="Coming soon"
                        style={{ cursor: 'not-allowed', opacity: 0.6 }}
                      >
                        📊 Based on Performance
                      </button>
                      <span className="coming-soon-badge">Coming soon</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        }
      />

      {/* 360 Detail Drawer */}
      <Drawer
        isOpen={isDetailDrawerOpen && !!selectedLead}
        onClose={() => setIsDetailDrawerOpen(false)}
        title={selectedLead?.name || 'Lead Overview'}
        subtitle={`${selectedLead?.phone} • Created on ${selectedLead?.createdAt}`}
        width={580}
        footer={
          <>
            <button
              className="btn btn-secondary"
              onClick={() => {
                setIsDetailDrawerOpen(false);
                if (selectedLead) handleOpenEdit(selectedLead);
              }}
            >
              <Edit size={14} /> Edit Record
            </button>
            <button
              className="btn btn-call"
              onClick={() => {
                if (selectedLead) initiateCall(selectedLead.name, selectedLead.phone, 'lead', selectedLead.id);
              }}
            >
              <Phone size={14} /> Call Lead
            </button>
          </>
        }
      >
        {selectedLead && (() => {
            const isGhlIrm = isIrm && (tenant?.slug === 'ghl' || tenant?.id === 't-ghl-01');

            /** ── Investment Capacity value ── */
            const investmentCapacity =
              selectedLead.customFields?.investmentCapacity ||
              selectedLead.customFields?.capacityRange ||
              selectedLead.customFields?.investmentRange ||
              (selectedLead as any).investmentRange ||
              null;

            /** ── User-facing message ── */
            const userMessage =
              (selectedLead as any).message ||
              (selectedLead as any).userMessage ||
              selectedLead.customFields?.message ||
              selectedLead.customFields?.userMessage ||
              selectedLead.notes ||
              null;




            return (
              <>
                {/* ── Quick Info Banner (Assigned Agent) ── */}
                <div className="lead-quick-banner">
                  <div className="lead-assigned-note">
                    Assigned : <strong>{selectedLead.assignedAgentName}</strong>
                  </div>
                </div>

                {/* ── Contact & Profile Details ── */}
                <div className="card lead-detail-card">
                  <h4 className="lead-detail-title">Contact &amp; Profile Details</h4>
                  <div className="lead-detail-grid">
                    <div>
                      <span className="lead-detail-label">Email:</span>
                      <div className="lead-detail-value">{selectedLead.email || '—'}</div>
                    </div>
                    <div>
                      <span className="lead-detail-label">Location:</span>
                      <div className="lead-detail-value">{selectedLead.location || '—'}</div>
                    </div>
                    <div>
                      <span className="lead-detail-label">Lead Source:</span>
                      <div className="lead-detail-value">{selectedLead.source}</div>
                    </div>
                    <div>
                      <span className="lead-detail-label">Follow-up:</span>
                      <div className="lead-detail-value lead-followup-text has-date">
                        {selectedLead.nextFollowupDate || 'Not scheduled'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── GHL IRM: Investment Capacity (replaces Preferred Asset Class + Investment Horizon unless confirmed by IRM) ── */}
                {isGhlIrm ? (
                  <div className="card lead-custom-card">
                    <h4 className="lead-custom-title">Investment Details</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <div>
                        <span className="lead-detail-label">Investment Capacity:</span>
                        <div
                          className="lead-detail-value"
                          style={{
                            marginTop: 4,
                            fontSize: 16,
                            fontWeight: 700,
                            color: '#10b981',
                            letterSpacing: '0.01em',
                          }}
                        >
                          {investmentCapacity || '—'}
                        </div>
                      </div>

                      {/* Only show Preferred Asset Class & Horizon if set & confirmed by IRM */}
                      {Boolean(
                        selectedLead.customFields?.irmPreferencesConfirmed ||
                        (() => {
                          try {
                            const raw = localStorage.getItem(`nexus_irm_pref_${selectedLead.id}`) ||
                              localStorage.getItem(`nexus_irm_pref_${(selectedLead.phone || '').replace(/\D/g, '').slice(-10)}`);
                            if (raw) return JSON.parse(raw)?.confirmed === true;
                          } catch {}
                          return false;
                        })()
                      ) && (() => {
                        const localData = (() => {
                          try {
                            const raw = localStorage.getItem(`nexus_irm_pref_${selectedLead.id}`) ||
                              localStorage.getItem(`nexus_irm_pref_${(selectedLead.phone || '').replace(/\D/g, '').slice(-10)}`);
                            if (raw) return JSON.parse(raw);
                          } catch {}
                          return null;
                        })();
                        const assetClass = selectedLead.customFields?.preferredAssetClass || localData?.preferredAssetClass || '—';
                        const horizon = selectedLead.customFields?.horizon || selectedLead.customFields?.investmentHorizon || localData?.horizon || '—';

                        return (
                          <div className="lead-detail-grid" style={{ marginTop: 4, paddingTop: 10, borderTop: '1px solid var(--border-base)' }}>
                            <div>
                              <span className="lead-detail-label">Preferred Asset Class:</span>
                              <div className="lead-detail-value">{assetClass}</div>
                            </div>
                            <div>
                              <span className="lead-detail-label">Investment Horizon:</span>
                              <div className="lead-detail-value">{horizon}</div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                ) : (
                  /* Non-IRM tenants: show the generic custom attributes exactly as before */
                  (() => {
                    const activeDefs = storageService
                      .getCustomFieldDefinitions(tenant?.id)
                      .filter(d => d.active !== false && (d.module === 'leads' || !d.module))
                      .filter(d => !(isExec && (d.fieldKey === 'assetClass' || d.fieldKey === 'preferredAssetClass')))
                      .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
                    const rows = activeDefs
                      .map(def => {
                        const key = def.fieldKey || def.id;
                        const val = selectedLead.customFields?.[key];
                        if (val === undefined || val === null || val === '') return null;
                        return { id: def.id, label: def.label || key.replace(/([A-Z])/g, ' $1'), value: String(val) };
                      })
                      .filter(Boolean);
                    if (rows.length === 0) return null;
                    return (
                      <div className="card lead-custom-card">
                        <h4 className="lead-custom-title">{tenant?.name} Custom Attributes</h4>
                        <div className="lead-detail-grid">
                          {rows.map(item => (
                            <div key={item!.id}>
                              <span className="lead-custom-label">{item!.label}:</span>
                              <div className="lead-custom-value">{item!.value}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()
                )}

                {/* ── Message from User ── */}
                <div className="card lead-custom-card">
                  <h4 className="lead-custom-title">Message from User</h4>
                  <div className="lead-user-message-box">
                    {userMessage ? (
                      <div className="lead-user-message-text">{userMessage}</div>
                    ) : (
                      <div className="lead-user-message-empty">No message available</div>
                    )}
                  </div>
                </div>

                <LeadDetailDrawerContent
                  contactName={selectedLead.name}
                  contactPhone={selectedLead.phone}
                  contactId={selectedLead.id}
                  contactType="lead"
                  tenantId={tenant?.id}
                  tenantName={tenant?.name}
                  onCall={() => initiateCall(selectedLead.name, selectedLead.phone, 'lead', selectedLead.id)}
                  sectionsOnly={['callRecordings']}
                />
              </>
            );
          })()}
      </Drawer>

      {/* Create / Edit Drawer */}
      <Drawer
        isOpen={isEditDrawerOpen}
        onClose={() => setIsEditDrawerOpen(false)}
        title={formData.id && leads.some(l => l.id === formData.id) ? 'Edit Lead Record' : 'Add New Prospect Lead'}
        subtitle={`Organization: ${tenant?.name}`}
        width={560}
      >
        <form onSubmit={handleSaveLead} className="lead-edit-form">
          <div className="form-group">
            <label className="form-label">Full Name *</label>
            <input
              type="text"
              className="form-input"
              required
              autoComplete="off"
              name="fld-fullname-nexus"
              value={formData.name || ''}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. Agent One"
            />
          </div>

          <div className="lead-form-grid-2">
            <div className="form-group">
              <label className="form-label">Phone Number *</label>
              <input
                type="text"
                className="form-input"
                required
                autoComplete="off"
                name="fld-phone-nexus"
                value={formData.phone || ''}
                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+91 98800 00000"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input
                type="email"
                className="form-input"
                autoComplete="off"
                name="fld-email-nexus"
                value={formData.email || ''}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
                placeholder="agent1@example.com"
              />
            </div>
          </div>

          <div className="lead-form-grid-2">
            <div className="form-group">
              <label className="form-label">Location / City</label>
              <input
                type="text"
                className="form-input"
                autoComplete="off"
                name="fld-location-nexus"
                value={formData.location || ''}
                onChange={e => setFormData({ ...formData, location: e.target.value })}
                placeholder="e.g. Bengaluru, Indiranagar"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Source</label>
              <select
                className="form-select"
                value={formData.source || 'Website Inbound'}
                onChange={e => setFormData({ ...formData, source: e.target.value })}
              >
                <option value="Website Inbound">Website Inbound</option>
                <option value="Google Search">Google Search</option>
                <option value="Facebook / Instagram">Facebook / Instagram</option>
                <option value="Referral - HNW">Referral - HNW</option>
                <option value="Walk-in Site Office">Walk-in Site Office</option>
              </select>
            </div>
          </div>

          {!isLeadScopedUser && (
            <div className="form-group">
              <label className="form-label">Assigned Sales Agent</label>
              <select
                className="form-select"
                value={formData.assignedAgentId || ''}
                onChange={e => {
                  const val = e.target.value;
                  const agentObj = agents.find(a => String(a.id) === String(val) || String(a.dbId) === String(val));
                  setFormData(prev => ({
                    ...prev,
                    assignedAgentId: val || undefined,
                    assignedAgentName: agentObj ? agentObj.name : undefined,
                  }));
                }}
              >
                <option value="">Unassigned (Queue for manual / auto distribution)</option>
                {agents.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* DYNAMIC TENANT CUSTOM FIELDS (Blueprint Section 7.3) */}
          <div className="lead-custom-schema-box">
            <div className="lead-custom-schema-title">
              {tenant?.slug === 'jamin' ? `${tenant?.name} Custom Form Schema` : 'GHL India Ventures Asset Terms'}
            </div>

            {tenant?.slug === 'jamin' ? (
              <div className="lead-form-grid-2">
                <div className="form-group">
                  <label className="form-label">Plot Budget Range</label>
                  <select
                    className="form-select"
                    value={formData.customFields?.budgetRange || '₹45L - ₹65L'}
                    onChange={e =>
                      setFormData({
                        ...formData,
                        customFields: { ...formData.customFields, budgetRange: e.target.value },
                      })
                    }
                  >
                    <option value="₹25L - ₹45L">₹25L - ₹45L</option>
                    <option value="₹45L - ₹65L">₹45L - ₹65L</option>
                    <option value="₹65L - ₹90L">₹65L - ₹90L</option>
                    <option value="₹90L+">₹90L+</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Preferred Micro-Market</label>
                  <select
                    className="form-select"
                    value={formData.customFields?.preferredLocation || 'Devanahalli North'}
                    onChange={e =>
                      setFormData({
                        ...formData,
                        customFields: { ...formData.customFields, preferredLocation: e.target.value },
                      })
                    }
                  >
                    <option value="Devanahalli North">Devanahalli North (Airport)</option>
                    <option value="Sarjapur East">Sarjapur East</option>
                    <option value="Mysore Highway Corridor">Mysore Highway Corridor</option>
                  </select>
                </div>
              </div>
            ) : (
              <div className="lead-form-grid-2">
                {!isExec && (
                  <div className="form-group">
                    <label className="form-label">Asset Class</label>
                    <select
                      className="form-select"
                      value={currentAssetClass}
                      onChange={e => handleAssetClassChange(e.target.value)}
                    >
                      <option value="">--</option>
                      <option value="AIF">AIF</option>
                      <option value="CO-AIF">CO-AIF</option>
                    </select>
                  </div>
                )}
                <div className="form-group">
                  <label className="form-label">Investment Capacity</label>
                  <select
                    className="form-select"
                    value={formData.customFields?.investmentCapacity || ''}
                    onChange={e =>
                      setFormData(prev => ({
                        ...prev,
                        customFields: { ...prev.customFields, investmentCapacity: e.target.value },
                      }))
                    }
                  >
                    <option value="" disabled>Select a range</option>
                    {CAPACITY_OPTIONS.map(opt => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">Notes & Requirements</label>
            <textarea
              className="form-textarea"
              rows={3}
              value={formData.notes || ''}
              onChange={e => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Client background, key objections, time horizon..."
            />
          </div>

          {formErrorMessage && (
            <div style={{
              margin: '14px 0',
              padding: '10px 14px',
              borderRadius: 6,
              backgroundColor: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.25)',
              color: '#dc2626',
              fontSize: 13,
              lineHeight: 1.5,
              fontWeight: 500
            }}>
              ⚠️ {formErrorMessage}
            </div>
          )}

          <div className="lead-form-footer-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsEditDrawerOpen(false)}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Save Lead Record
            </button>
          </div>
        </form>
      </Drawer>

      {/* Convert to Customer Modal */}
      <Modal
        isOpen={isConvertModalOpen && !!selectedLead}
        onClose={() => setIsConvertModalOpen(false)}
        title="Convert Lead to Customer Record"
        subtitle={`Moving ${selectedLead?.name} into your active Customer 360 database`}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setIsConvertModalOpen(false)}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleConfirmConvert}>
              Confirm Conversion & Create Deal
            </button>
          </>
        }
      >
        <div className="lead-modal-content">
          <p className="lead-modal-desc">
            Converting this lead will automatically establish a permanent <strong>Customer 360</strong>{' '}
            profile and launch an active pipeline opportunity.
          </p>

          <div className="form-group">
            <label className="form-label">Initial Deal Title *</label>
            <input
              type="text"
              className="form-input"
              autoComplete="off"
              name="fld-deal-title-nexus"
              value={convertDealTitle}
              onChange={e => setConvertDealTitle(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Estimated Deal Value (₹)</label>
            <input
              type="number"
              className="form-input"
              autoComplete="off"
              name="fld-deal-value-nexus"
              value={convertDealValue}
              onChange={e => setConvertDealValue(Number(e.target.value))}
            />
          </div>

          <div className="lead-convert-notice">
            ✓ On {tenant?.name}, this also automatically schedules a{' '}
            <strong>{tenant?.slug === 'jamin' ? 'Site Visit' : 'Wealth Consultation'}</strong> step!
          </div>
        </div>
      </Modal>

      {/* CSV Import Modal */}
      <Modal
        isOpen={isImportModalOpen}
        onClose={() => {
          setIsImportModalOpen(false);
          resetImportState();
        }}
        title="Bulk Import Leads (CSV)"
        subtitle="Upload a file and map columns to ingest prospects"
        footer={
          importResults ? (
            <button className="btn btn-primary" onClick={() => {
              setIsImportModalOpen(false);
              resetImportState();
            }}>
              Done
            </button>
          ) : parsedRows.length > 0 ? (
            <div className="lead-import-footer-actions">
              <button className="btn btn-secondary" onClick={resetImportState}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleImportLeads}
                disabled={!columnMap['name'] || !columnMap['phone']}
              >
                Import Leads
              </button>
            </div>
          ) : (
            <button className="btn btn-secondary" onClick={() => setIsImportModalOpen(false)}>
              Close Import
            </button>
          )
        }
      >
        <div className="lead-modal-content">
          {importResults ? (
            <div className="lead-import-success-card">
              <CheckCircle2 size={48} color="var(--primary-600)" className="lead-import-success-icon" />
              <h3 className="lead-import-success-title">Import Complete</h3>
              <p className="lead-import-success-sub">
                {importResults.success} leads imported successfully, {importResults.skipped} skipped — missing name or phone.
              </p>
            </div>
          ) : parsedRows.length > 0 ? (
            <>
              {/* Mapping */}
              <div className="card lead-mapping-card">
                <h4 className="lead-mapping-title">Map Columns</h4>
                {(!columnMap['name'] || !columnMap['phone']) && (
                  <div className="lead-mapping-warning">
                    ⚠️ Name and Phone columns must be mapped to proceed.
                  </div>
                )}
                <div className="lead-form-grid-2">
                  {['name', 'phone', 'email', 'location', 'source', 'priority'].map(tf => (
                    <div key={tf} className="lead-mapping-row">
                      <span className="lead-mapping-label">
                        {tf}{['name', 'phone'].includes(tf) ? ' *' : ''}
                      </span>
                      <select
                        className="form-select lead-mapping-select"
                        value={columnMap[tf] || ''}
                        onChange={e => setColumnMap(prev => ({ ...prev, [tf]: e.target.value }))}
                      >
                        <option value="">— Not Mapped —</option>
                        {csvHeaders.map(h => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              {/* Preview */}
              <div>
                <div className="lead-preview-header">
                  {parsedRows.length} rows found — showing first 10
                </div>
                <div className="lead-preview-container">
                  <table className="lead-preview-table">
                    <thead className="lead-preview-thead">
                      <tr>
                        {csvHeaders.map(h => (
                          <th key={h} className="lead-preview-th">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {parsedRows.slice(0, 10).map((row, i) => (
                        <tr key={i} className="lead-preview-tr">
                          {csvHeaders.map(h => (
                            <td key={h} className="lead-preview-td">{row[h]}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <>
              <input
                type="file"
                accept=".csv"
                style={{ display: 'none' }}
                ref={fileInputRef}
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) handleFileSelect(file);
                }}
              />
              <div
                onDragOver={e => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="lead-dropzone"
              >
                <Upload size={32} color="var(--primary-600)" className="lead-dropzone-icon" />
                <div className="lead-dropzone-title">Drag & drop your CSV file here</div>
                <div className="lead-dropzone-sub">
                  Supports .csv only
                </div>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm lead-dropzone-btn"
                  onClick={e => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                >
                  Browse File
                </button>
              </div>

              {importError && (
                <div className="lead-import-error">
                  {importError}
                </div>
              )}

              <div className="lead-sample-cols">
                <strong>Sample Columns Supported:</strong> Name, Phone, Email, Location, Source, Priority, Custom Fields.
              </div>
            </>
          )}
        </div>
      </Modal>

      {/* ── GHL Admin: Manual selection action bar ──────────────────────── */}
      {isGhlAdmin && assignMode === 'manual' && selectedLeadIds.size > 0 && (
        <div className="assign-action-bar">
          <span className="assign-action-bar-text">
            {selectedLeadIds.size} lead{selectedLeadIds.size !== 1 ? 's' : ''} selected
          </span>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setSelectedLeadIds(new Set())}
          >
            Clear
          </button>
          <button
            className="btn btn-primary"
            onClick={() => {
              setAssignStep('pick-agent');
              setAssignSelectedAgent(null);
              setIsAssignModalOpen(true);
            }}
          >
            Send {selectedLeadIds.size} Lead{selectedLeadIds.size !== 1 ? 's' : ''} →
          </button>
        </div>
      )}

      {/* ── Assign Agent Modal ───────────────────────────────────────────── */}
      {isAssignModalOpen && (
        <div className="assign-modal-overlay" onClick={() => setIsAssignModalOpen(false)}>
          <div className="assign-modal" onClick={e => e.stopPropagation()}>
            <div className="assign-modal-header">
              <h3 className="assign-modal-title">Assign Leads to Agent</h3>
              <button className="assign-modal-close" onClick={() => setIsAssignModalOpen(false)}>✕</button>
            </div>

            {assignStep === 'pick-agent' ? (
              <>
                <p className="assign-modal-sub">Select an agent to assign the {selectedLeadIds.size} selected lead{selectedLeadIds.size !== 1 ? 's' : ''} to:</p>
                <div className="assign-agent-list">
                  {agents.map(agent => (
                    <label key={agent.id} className={`assign-agent-row${assignSelectedAgent?.id === agent.id ? ' selected' : ''}`}>
                      <input
                        type="radio"
                        name="assignAgent"
                        value={agent.id}
                        checked={assignSelectedAgent?.id === agent.id}
                        onChange={() => setAssignSelectedAgent(agent)}
                      />
                      <div className="assign-agent-avatar">{agent.name[0]}</div>
                      <span className="assign-agent-name">{agent.name}</span>
                    </label>
                  ))}
                </div>
                <div className="assign-modal-footer">
                  <button className="btn btn-secondary" onClick={() => setIsAssignModalOpen(false)}>Cancel</button>
                  <button
                    className="btn btn-primary"
                    disabled={!assignSelectedAgent}
                    onClick={() => setAssignStep('confirm')}
                  >
                    Next →
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="assign-confirm-box">
                  <div className="assign-confirm-label">Are you confirming this agent:</div>
                  <div className="assign-confirm-agent">---- {assignSelectedAgent?.name} ----</div>
                  <div className="assign-confirm-detail">
                    {selectedLeadIds.size} lead{selectedLeadIds.size !== 1 ? 's' : ''} will be assigned and removed from the pool.
                  </div>
                </div>
                <div className="assign-modal-footer">
                  <button className="btn btn-secondary" onClick={() => setIsAssignModalOpen(false)}>Cancel</button>
                  <button className="btn btn-ghost" onClick={() => setAssignStep('pick-agent')}>← Back</button>
                  <button className="btn btn-primary" onClick={handleManualAssignConfirm}>Confirm</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── AI Distribution Modal ────────────────────────────────────────── */}
      {isAiModalOpen && (
        <div className="assign-modal-overlay" onClick={() => setIsAiModalOpen(false)}>
          <div className="ai-dist-modal" onClick={e => e.stopPropagation()}>
            <div className="assign-modal-header">
              <div>
                <h3 className="assign-modal-title">✦ AI Suggestion — Round Robin</h3>
                <p className="assign-modal-sub" style={{ margin: '2px 0 0' }}>
                  {Object.values(aiDistribution).flat().length} leads distributed across {agents.length} agents
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  className={`btn btn-sm ${isAiEditMode ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setIsAiEditMode(e => !e)}
                >
                  {isAiEditMode ? '✓ Done Editing' : '✎ Edit'}
                </button>
                <button className="assign-modal-close" onClick={() => setIsAiModalOpen(false)}>✕</button>
              </div>
            </div>

            <div className="ai-dist-grid">
              {agents.map((agent, agentIdx) => {
                const agentLeads = aiDistribution[agent.id] || [];
                return (
                  <div key={agent.id} className="ai-dist-col">
                    <div className="ai-dist-col-header">
                      <div className="ai-dist-avatar">{agent.name[0]}</div>
                      <span className="ai-dist-agent-name">{agent.name}</span>
                      <span className="ai-dist-count">{agentLeads.length}</span>
                    </div>
                    <div className="ai-dist-col-body">
                      {agentLeads.length === 0 ? (
                        <div className="ai-dist-empty">No leads</div>
                      ) : (
                        agentLeads.map(lead => (
                          <div key={lead.id} className="ai-dist-lead-card">
                            <div className="ai-dist-lead-name">{lead.name}</div>
                            <div className="ai-dist-lead-phone">{lead.phone}</div>
                            {isAiEditMode && (
                              <div className="ai-dist-move-btns">
                                <button
                                  className="ai-move-btn"
                                  disabled={agentIdx === 0}
                                  onClick={() => handleAiMoveLead(lead.id, agent.id, 'left')}
                                  title="Move left"
                                >◀</button>
                                <button
                                  className="ai-move-btn"
                                  disabled={agentIdx === agents.length - 1}
                                  onClick={() => handleAiMoveLead(lead.id, agent.id, 'right')}
                                  title="Move right"
                                >▶</button>
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="assign-modal-footer" style={{ borderTop: '1px solid var(--border-base)', marginTop: 0 }}>
              <button className="btn btn-secondary" onClick={() => setIsAiModalOpen(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleAiConfirm}>
                Confirm Distribution
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Duplicate in KYC Resolution Modal ────────────────────────────── */}
      {duplicateKycModal && (
        <Modal
          isOpen={!!duplicateKycModal}
          onClose={() => {
            setDuplicateKycModal(null);
            setIsSchedulingActivity(false);
          }}
          title="Contact Already in KYC"
          subtitle="Duplicate Contact Prevention"
          maxWidth={540}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{
              display: 'flex',
              gap: 12,
              alignItems: 'flex-start',
              padding: 14,
              borderRadius: 'var(--radius-md)',
              background: 'rgba(16, 185, 129, 0.08)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              color: 'var(--text-primary)',
            }}>
              <CheckCircle2 size={24} style={{ color: '#10b981', flexShrink: 0, marginTop: 2 }} />
              <div style={{ fontSize: 13, lineHeight: 1.5 }}>
                <strong>Customer "{duplicateKycModal.contactName}"</strong> already exists in KYC Onboarding (assigned to <strong>{duplicateKycModal.assignedAgentName}</strong>).
                <div style={{ marginTop: 4, color: 'var(--text-secondary)' }}>
                  A record matching phone <code>{duplicateKycModal.contactPhone}</code> is currently active in the KYC verification pipeline. To prevent duplicate investor profiles, this record was not overwritten.
                </div>
              </div>
            </div>

            {!isSchedulingActivity ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 4 }}>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
                  What would you like to do with this contact?
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ justifyContent: 'flex-start', padding: '12px 16px' }}
                    onClick={() => {
                      setDuplicateKycModal(null);
                      setIsEditDrawerOpen(false);
                      handleNavigate('kyc');
                    }}
                  >
                    <ArrowRight size={16} />
                    <span>Open Contact in KYC</span>
                  </button>

                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ justifyContent: 'flex-start', padding: '12px 16px' }}
                    onClick={() => setIsSchedulingActivity(true)}
                  >
                    <CalendarCheck size={16} style={{ color: 'var(--primary-color)' }} />
                    <span>Schedule Additional Follow-up Task for This Contact</span>
                  </button>

                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ justifyContent: 'center' }}
                    onClick={() => {
                      setDuplicateKycModal(null);
                      setIsSchedulingActivity(false);
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 4 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                  Schedule Follow-up Activity for "{duplicateKycModal.contactName}"
                </div>

                <div className="form-group">
                  <label className="form-label">Follow-up Date & Time *</label>
                  <input
                    type="datetime-local"
                    className="form-input"
                    value={followupDate}
                    onChange={e => setFollowupDate(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Priority</label>
                  <select
                    className="form-select"
                    value={followupPriority}
                    onChange={e => setFollowupPriority(e.target.value)}
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Urgent">Urgent</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Task Notes / Agenda</label>
                  <textarea
                    className="form-textarea"
                    rows={3}
                    value={followupNotes}
                    onChange={e => setFollowupNotes(e.target.value)}
                    placeholder="Enter details for this follow-up activity..."
                  />
                </div>

                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setIsSchedulingActivity(false)}
                    disabled={isSavingFollowupActivity}
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={isSavingFollowupActivity}
                    onClick={() =>
                      handleScheduleActivityForExisting(
                        duplicateKycModal.contactId,
                        duplicateKycModal.contactType === 'customer' ? 'customer' : 'lead',
                        duplicateKycModal.contactName,
                        duplicateKycModal.contactPhone
                      )
                    }
                  >
                    {isSavingFollowupActivity ? 'Scheduling...' : 'Save Follow-up Activity'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* ── Duplicate in Follow-up Resolution Modal ──────────────────────── */}
      {duplicateFollowupModal && (
        <Modal
          isOpen={!!duplicateFollowupModal}
          onClose={() => {
            setDuplicateFollowupModal(null);
            setIsSchedulingActivity(false);
          }}
          title="Contact Already in Follow-up"
          subtitle="Duplicate Lead Prevention"
          maxWidth={540}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{
              display: 'flex',
              gap: 12,
              alignItems: 'flex-start',
              padding: 14,
              borderRadius: 'var(--radius-md)',
              background: 'rgba(245, 158, 11, 0.08)',
              border: '1px solid rgba(245, 158, 11, 0.25)',
              color: 'var(--text-primary)',
            }}>
              <AlertTriangle size={24} style={{ color: '#d97706', flexShrink: 0, marginTop: 2 }} />
              <div style={{ fontSize: 13, lineHeight: 1.5 }}>
                <strong>Customer "{duplicateFollowupModal.contactName}"</strong> already exists in Follow-up (assigned to <strong>{duplicateFollowupModal.assignedAgentName}</strong>).
                <div style={{ marginTop: 4, color: 'var(--text-secondary)' }}>
                  A record matching phone <code>{duplicateFollowupModal.contactPhone}</code> is currently in the active follow-up pipeline. To prevent duplicates, this record was not overwritten.
                </div>
              </div>
            </div>

            {!isSchedulingActivity ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 4 }}>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
                  What would you like to do with this contact?
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ justifyContent: 'flex-start', padding: '12px 16px' }}
                    onClick={() => {
                      setDuplicateFollowupModal(null);
                      setIsEditDrawerOpen(false);
                      handleNavigate('followups');
                    }}
                  >
                    <ArrowRight size={16} />
                    <span>Open Contact in Follow-ups</span>
                  </button>

                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ justifyContent: 'flex-start', padding: '12px 16px' }}
                    onClick={() => setIsSchedulingActivity(true)}
                  >
                    <CalendarCheck size={16} style={{ color: 'var(--primary-color)' }} />
                    <span>Schedule Additional Follow-up Task for This Contact</span>
                  </button>

                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ justifyContent: 'center' }}
                    onClick={() => {
                      setDuplicateFollowupModal(null);
                      setIsSchedulingActivity(false);
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 4 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                  Schedule Follow-up Activity for "{duplicateFollowupModal.contactName}"
                </div>

                <div className="form-group">
                  <label className="form-label">Follow-up Date & Time *</label>
                  <input
                    type="datetime-local"
                    className="form-input"
                    value={followupDate}
                    onChange={e => setFollowupDate(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Priority</label>
                  <select
                    className="form-select"
                    value={followupPriority}
                    onChange={e => setFollowupPriority(e.target.value)}
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Urgent">Urgent</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Task Notes / Agenda</label>
                  <textarea
                    className="form-textarea"
                    rows={3}
                    value={followupNotes}
                    onChange={e => setFollowupNotes(e.target.value)}
                    placeholder="Enter details for this follow-up activity..."
                  />
                </div>

                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setIsSchedulingActivity(false)}
                    disabled={isSavingFollowupActivity}
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={isSavingFollowupActivity}
                    onClick={() =>
                      handleScheduleActivityForExisting(
                        duplicateFollowupModal.contactId,
                        duplicateFollowupModal.contactType,
                        duplicateFollowupModal.contactName,
                        duplicateFollowupModal.contactPhone
                      )
                    }
                  >
                    {isSavingFollowupActivity ? 'Scheduling...' : 'Save Follow-up Activity'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* ── Duplicate Customer Resolution Modal ─────────────────────────── */}
      {duplicateCustomerModal && (
        <Modal
          isOpen={!!duplicateCustomerModal}
          onClose={() => setDuplicateCustomerModal(null)}
          title="Customer Already Exists"
          subtitle="Duplicate Customer Prevention"
          maxWidth={500}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{
              display: 'flex',
              gap: 12,
              alignItems: 'flex-start',
              padding: 14,
              borderRadius: 'var(--radius-md)',
              background: 'rgba(59, 130, 246, 0.08)',
              border: '1px solid rgba(59, 130, 246, 0.25)',
              color: 'var(--text-primary)',
            }}>
              <UserCheck size={24} style={{ color: '#2563eb', flexShrink: 0, marginTop: 2 }} />
              <div style={{ fontSize: 13, lineHeight: 1.5 }}>
                <strong>Customer "{duplicateCustomerModal.contactName}"</strong> already exists in the system (assigned to <strong>{duplicateCustomerModal.assignedAgentName}</strong>).
                <div style={{ marginTop: 4, color: 'var(--text-secondary)' }}>
                  A customer profile already exists for this phone/email. Instead of creating a duplicate lead, you can open their existing profile or schedule a follow-up activity.
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                type="button"
                className="btn btn-primary"
                style={{ justifyContent: 'flex-start', padding: '12px 16px' }}
                onClick={() => {
                  setDuplicateCustomerModal(null);
                  setIsEditDrawerOpen(false);
                  handleNavigate('customers');
                }}
              >
                <ArrowRight size={16} />
                <span>Open in Customer 360</span>
              </button>

              <button
                type="button"
                className="btn btn-secondary"
                style={{ justifyContent: 'flex-start', padding: '12px 16px' }}
                onClick={() => {
                  const cust = duplicateCustomerModal;
                  setDuplicateCustomerModal(null);
                  setDuplicateFollowupModal({
                    contactId: cust.contactId,
                    contactType: 'customer',
                    contactName: cust.contactName,
                    contactPhone: cust.contactPhone,
                    contactEmail: cust.contactEmail,
                    assignedAgentName: cust.assignedAgentName,
                  });
                  setIsSchedulingActivity(true);
                }}
              >
                <CalendarCheck size={16} style={{ color: 'var(--primary-color)' }} />
                <span>Schedule Follow-up Activity for This Customer</span>
              </button>

              <button
                type="button"
                className="btn btn-secondary"
                style={{ justifyContent: 'center' }}
                onClick={() => setDuplicateCustomerModal(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Assign IRM Modal ── */}
      <Modal
        isOpen={isAssignIrmModalOpen && !!leadToAssignIrm}
        onClose={() => setIsAssignIrmModalOpen(false)}
        title="Assign Lead to IRM"
        subtitle={`Assigning ${leadToAssignIrm?.name} to an Investment Relationship Manager`}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setIsAssignIrmModalOpen(false)}>
              Cancel
            </button>
            <button
              className="btn btn-primary"
              disabled={!selectedIrmForLead}
              onClick={handleConfirmAssignIrm}
            >
              Confirm IRM Assignment
            </button>
          </>
        }
      >
        <div className="lead-modal-content">
          <p className="lead-irm-modal-desc">
            Select an active IRM from the company database. Once assigned, this lead will be routed directly to the IRM&apos;s portal and consultations dashboard.
          </p>

          {companyIrms.length === 0 ? (
            <div className="lead-irm-empty" style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
              No active IRMs found for this organization.
            </div>
          ) : (
            <div className="lead-irm-agent-list">
              {companyIrms.map(irm => {
                const isSelected = String(selectedIrmForLead) === String(irm.id);
                return (
                  <div
                    key={irm.id}
                    className={`lead-irm-agent-row ${isSelected ? 'selected' : ''}`}
                    onClick={() => setSelectedIrmForLead(String(irm.id))}
                  >
                    <input
                      type="radio"
                      name="selectedLeadIrm"
                      checked={isSelected}
                      onChange={() => setSelectedIrmForLead(String(irm.id))}
                    />
                    <div className="lead-irm-agent-avatar">
                      {irm.name[0]?.toUpperCase()}
                    </div>
                    <div className="lead-irm-agent-details">
                      <div className="lead-irm-agent-name">{irm.name}</div>
                      <div className="lead-irm-agent-email">{irm.email}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Modal>

      {/* ── Toast notification ───────────────────────────────────────────── */}
      {toast && (
        <div className="assign-toast">
          {toast}
        </div>
      )}
    </div>
  );
};

