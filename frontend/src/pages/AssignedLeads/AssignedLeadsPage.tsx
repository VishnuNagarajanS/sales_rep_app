import React, { useState, useEffect, useMemo } from 'react';
import {
  UserCheck,
  Phone,
  Edit,
  ExternalLink,
  Trash2,
  Users,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { Lead, IrmProfile } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useCall } from '../../context/CallContext';
import { storageService } from '../../services/storageService';
import { jaminApiService } from '../../services/jaminApiService';
import { apiClient } from '../../services/apiClient';
import { getCompanyIrms } from '../../services/ghlApiService';
import {
  AssignableAgent,
  loadAgentDirectory,
  isLeadAssigned,
  persistLeadAssignment,
} from '../../services/agentDirectory';
import { DataTable, Column, RowAction } from '../../components/common/DataTable';
import { FilterBar } from '../../components/common/FilterBar';
import { Drawer } from '../../components/common/Drawer';
import { Modal } from '../../components/common/Modal';
import { StatusChip } from '../../components/common/StatusChip';
import { adminUserService } from '../../services/adminUserService';
import { getLeads as getBackendLeads } from '../../services/ghlApiService';
import { auditService } from '../../services/auditService';
import { toast } from '../../context/ToastContext';
import { getAuthHeaders } from '../../utils/authHeaders';
import './AssignedLeadsPage.css';

interface AssignedLeadsPageProps {
  onNavigate?: (route: string) => void;
}

export const AssignedLeadsPage: React.FC<AssignedLeadsPageProps> = ({ onNavigate }) => {
  const { tenant, user } = useAuth();
  const { initiateCall } = useCall();
  const isJamin = tenant?.slug === 'jamin' || tenant?.id === 't-jamin-02' || tenant?.id === '2' || user?.companySlug === 'jamin';
  const roleCode = String(user?.role?.code || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  const canManageAssignments = ['company_admin', 'admin', 'super_admin', 'sales_manager', 'manager'].includes(roleCode);
  const isSalesAgent = ['sales_executive', 'irm'].includes(roleCode);

  const [leads, setLeads] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isDetailDrawerOpen, setIsDetailDrawerOpen] = useState(false);
  const [isEditDrawerOpen, setIsEditDrawerOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<Lead>>({});
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [sourceFilter, setSourceFilter] = useState<string>('All');
  const [agentFilter, setAgentFilter] = useState<string>('All');
  const [irmFilter, setIrmFilter] = useState<string>('All');
  const [datePreset, setDatePreset] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [loadError, setLoadError] = useState<string | null>(null);

  // IRM assignment state
  const [companyIrms, setCompanyIrms] = useState<IrmProfile[]>([]);
  const [isAssignIrmModalOpen, setIsAssignIrmModalOpen] = useState(false);
  const [leadToAssignIrm, setLeadToAssignIrm] = useState<Lead | null>(null);
  const [selectedIrmForLead, setSelectedIrmForLead] = useState<string>('');
  const [isSubmittingIrm, setIsSubmittingIrm] = useState(false);

  // Agent reassignment confirmation state for Edit panel
  const [pendingAgent, setPendingAgent] = useState<AssignableAgent | null>(null);
  const [agents, setAgents] = useState<AssignableAgent[]>([]);
  const [availableProjects, setAvailableProjects] = useState<any[]>([]);
  const [adminIds, setAdminIds] = useState<Set<string>>(
    new Set(user?.id ? [String(user.id)] : [])
  );
  const [isReassignConfirmOpen, setIsReassignConfirmOpen] = useState(false);

  const isGhlAdmin =
    (tenant?.slug === 'ghl' || tenant?.id === 't-ghl-01') &&
    (roleCode === 'company_admin' || (roleCode as string) === 'admin' || roleCode === 'super_admin');

  const isAdmin =
    isGhlAdmin ||
    roleCode === 'company_admin' ||
    (roleCode as string) === 'admin' ||
    roleCode === 'super_admin' ||
    (roleCode as string) === 'sales_manager';

  // IRM Coverage & Reassignment states
  const [activeCoverages, setActiveCoverages] = useState<any[]>([]);
  const [isCoverageModalOpen, setIsCoverageModalOpen] = useState(false);
  const [coverageTab, setCoverageTab] = useState<'assign' | 'active'>('assign');
  const [fromIrmId, setFromIrmId] = useState('');
  const [toIrmId, setToIrmId] = useState('');
  const [coverageReason, setCoverageReason] = useState('');
  const [isSubmittingCoverage, setIsSubmittingCoverage] = useState(false);
  const [coverageMessage, setCoverageMessage] = useState<string | null>(null);
  const [coverageError, setCoverageError] = useState<string | null>(null);

  const loadActiveCoverages = async () => {
    try {
      const res = await fetch('/api/irm/admin/coverage/active', {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const json = await res.json();
        if (json?.data) {
          setActiveCoverages(json.data);
        }
      }
    } catch (e) {
      console.error('Failed to load active coverages', e);
    }
  };

  const handleReassignWork = async () => {
    setCoverageError(null);
    setCoverageMessage(null);
    if (!fromIrmId || !toIrmId) {
      setCoverageError('Please select both the absent IRM and covering IRM.');
      return;
    }
    if (fromIrmId === toIrmId) {
      setCoverageError('Source IRM and Covering IRM cannot be the same person.');
      return;
    }

    setIsSubmittingCoverage(true);
    try {
      const res = await fetch('/api/irm/admin/reassign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          fromIrmId: Number(fromIrmId),
          toIrmId: Number(toIrmId),
          reason: coverageReason.trim() || 'Temporary coverage assignment',
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setCoverageError(json?.message || 'Failed to reassign work.');
      } else {
        setCoverageMessage(
          `Reassigned ${json.data.reassignedLeadsCount} leads, ${json.data.reassignedFollowupsCount} follow-ups, ${json.data.reassignedKycsCount} KYCs, ${json.data.reassignedDealsCount} deals to ${json.data.toIrmName}.`
        );
        setFromIrmId('');
        setToIrmId('');
        setCoverageReason('');
        await loadActiveCoverages();
        await loadData();
      }
    } catch (e: any) {
      setCoverageError(e.message || 'An error occurred during reassignment.');
    } finally {
      setIsSubmittingCoverage(false);
    }
  };

  const handleEndCoverage = async (coverageId: number) => {
    try {
      const res = await fetch('/api/irm/admin/coverage/end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ coverageId }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        await loadActiveCoverages();
        await loadData();
      }
    } catch (e) {
      console.error('Failed to end coverage', e);
    }
  };
  // Date range helpers
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

  const formatDateDisplay = (raw?: string | null): string => {
    if (!raw) return '';
    const d = new Date(raw);
    if (isNaN(d.getTime())) return raw;
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const resolveLeadOwnership = (lead: Lead) => {
    const custom = lead.customFields || {};

    // 1. Sales Executive
    let salesExecutiveName = lead.assignedSalesExecutiveName;
    let salesExecutiveDate = lead.assignedSalesExecutiveAt;

    const isAgentIrm =
      lead.assignedAgentRole === 'irm' ||
      companyIrms.some(i => i.name.toLowerCase() === (lead.assignedAgentName || '').toLowerCase());

    if (!salesExecutiveName) {
      if (lead.assignedAgentName && lead.assignedAgentName !== 'Unassigned' && !isAgentIrm) {
        salesExecutiveName = lead.assignedAgentName;
        salesExecutiveDate = lead.assignedSalesExecutiveAt || lead.assignedAt || lead.createdAt;
      } else if (custom.qualifiedByAgentName && custom.qualifiedByAgentName !== 'Unassigned') {
        salesExecutiveName = custom.qualifiedByAgentName;
        salesExecutiveDate = custom.qualifiedAt || lead.assignedAt || lead.createdAt;
      } else if (custom.assignedSalesExecutiveName && custom.assignedSalesExecutiveName !== 'Unassigned') {
        salesExecutiveName = custom.assignedSalesExecutiveName;
        salesExecutiveDate = custom.assignedSalesExecutiveAt || lead.assignedAt || lead.createdAt;
      }
    }

    if (salesExecutiveName && !salesExecutiveDate) {
      salesExecutiveDate = lead.assignedSalesExecutiveAt || lead.assignedAt || lead.createdAt;
    }

    // Check coverage for sales executive
    let isSalesCovered = false;
    let salesCoveredBy: string | undefined;

    if (lead.isCovered && lead.activeOwnerRole === 'sales_executive' && lead.coveredByName) {
      isSalesCovered = true;
      salesCoveredBy = lead.coveredByName;
    } else if (lead.handoverId && lead.handedOverFromName === salesExecutiveName) {
      isSalesCovered = true;
      salesCoveredBy = (lead as any).handover?.coveringUser?.name || 'Covering Agent';
    } else if (salesExecutiveName) {
      const activeCov = activeCoverages.find(
        c => (c.originalUserName || c.fromIrmName || '').toLowerCase() === salesExecutiveName!.toLowerCase()
      );
      if (activeCov) {
        isSalesCovered = true;
        salesCoveredBy = activeCov.coveringUserName || activeCov.toIrmName;
      }
    }

    // 2. IRM
    let irmName = lead.assignedIrmName || custom.assignedIrmName;
    let irmDate = lead.assignedIrmAt || custom.assignedIrmAt;

    if (!irmName && isAgentIrm && lead.assignedAgentName) {
      irmName = lead.assignedAgentName;
      irmDate = lead.assignedIrmAt || custom.assignedIrmAt || lead.assignedAt || lead.createdAt;
    }

    if (irmName && !irmDate) {
      irmDate = lead.assignedIrmAt || custom.assignedIrmAt || lead.assignedAt || lead.createdAt;
    }

    let transferredBy =
      lead.transferredBySalesExecutiveName ||
      custom.qualifiedByAgentName ||
      custom.transferredBy;

    // Check coverage for IRM
    let isIrmCovered = false;
    let irmCoveredBy: string | undefined;

    if (lead.isCovered && (lead.activeOwnerRole === 'irm' || irmName) && lead.coveredByName) {
      isIrmCovered = true;
      irmCoveredBy = lead.coveredByName;
    } else if (irmName) {
      const activeCov = activeCoverages.find(
        c =>
          (c.fromIrmName || c.originalUserName || '').toLowerCase() === irmName!.toLowerCase() ||
          (lead.assignedIrmId && String(c.fromIrmId || c.originalUserId) === String(lead.assignedIrmId))
      );
      if (activeCov) {
        isIrmCovered = true;
        irmCoveredBy = activeCov.toIrmName || activeCov.coveringUserName;
      }
    }

    // 3. Latest active owner
    let latestActiveOwnerName: string | undefined;
    let latestActiveOwnerRole: string | undefined;

    if (irmName) {
      latestActiveOwnerName = (isIrmCovered && irmCoveredBy) ? irmCoveredBy : irmName;
      latestActiveOwnerRole = 'irm';
    } else if (salesExecutiveName) {
      latestActiveOwnerName = (isSalesCovered && salesCoveredBy) ? salesCoveredBy : salesExecutiveName;
      latestActiveOwnerRole = 'sales_executive';
    }

    return {
      salesExecutiveName,
      salesExecutiveDate,
      isSalesCovered,
      salesCoveredBy,
      irmName,
      irmDate,
      isIrmCovered,
      irmCoveredBy,
      transferredBy,
      latestActiveOwnerName,
      latestActiveOwnerRole,
    };
  };

  const getLeadDateStr = (lead: Lead): string => {
    const info = resolveLeadOwnership(lead);
    const raw = info.salesExecutiveDate || info.irmDate || lead.assignedAt || lead.createdAt;
    if (!raw) return '';
    if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
      return raw.substring(0, 10);
    }
    const d = new Date(raw);
    if (!isNaN(d.getTime())) {
      return formatDateYMD(d);
    }
    return '';
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

  const loadData = async () => {
    setIsLoading(true);
    if (isJamin) {
      try {
        const jaminLeads = await jaminApiService.getLeads(true);
        const assigned = (jaminLeads || []).filter(lead => {
          const agentId = String(lead.assignedAgentId || '').trim();
          const name = (lead.assignedAgentName || '').trim();
          if (!agentId && !name) return false;
          if (name === 'Agent' || name === 'Unassigned') return false;
          return true;
        });
        setLeads(assigned);
        setSelectedLead(prev => {
          if (!prev) return null;
          return assigned.find(l => l.id === prev.id) || null;
        });
      } catch (err) {
        console.warn('Failed to load Jamin assigned leads:', err);
      } finally {
        setIsLoading(false);
      }
      return;
    }

    if (apiClient.isMockMode()) {
      setLoadError(null);
      const allLeads = storageService.getLeads(tenant?.id);
      setLeads(allLeads);
      setSelectedLead(prev => {
        if (!prev) return null;
        return allLeads.find(l => l.id === prev.id) || null;
      });
      setIsLoading(false);
      return;
    }

    try {
      setLoadError(null);
      let rawItems: any[] = [];
      try {
        const directRes = await apiClient.get<any>('/leads');
        const dItems = Array.isArray(directRes?.data) ? directRes.data : (Array.isArray(directRes?.items) ? directRes.items : null);
        if (dItems && dItems.length > 0) {
          rawItems = dItems;
        }
      } catch {}

      if (rawItems.length === 0) {
        const res = await apiClient.get<any>('/sales-executive/leads?page=1&pageSize=1000&status=all&assignment=all');
        if (res.success && res.data && res.data.items) {
          rawItems = res.data.items;
        }
      }

      const apiLeads = rawItems.map((item: any) => ({
          ...item,
          id: String(item.id),
          assignedAgentId: item.assignedAgentId ? String(item.assignedAgentId) : undefined,
          assignedAgentName: item.assignedAgentName || item.assignedAgent?.name || '',
          assignedAgentRole: item.assignedAgentRole || item.assignedAgent?.role?.code || undefined,
          assignedSalesExecutiveId: item.assignedSalesExecutiveId ? String(item.assignedSalesExecutiveId) : undefined,
          assignedSalesExecutiveName: item.assignedSalesExecutiveName || undefined,
          assignedSalesExecutiveAt: item.assignedSalesExecutiveAt || undefined,
          transferredBySalesExecutiveName: item.transferredBySalesExecutiveName || item.customFields?.qualifiedByAgentName || undefined,
          activeOwnerName: item.activeOwnerName || undefined,
          activeOwnerRole: item.activeOwnerRole || undefined,
          isCovered: Boolean(item.isCovered),
          coveredByName: item.coveredByName || undefined,
          assignedIrmId: item.assignedIrmId ? String(item.assignedIrmId) : (item.customFields?.assignedIrmId ? String(item.customFields.assignedIrmId) : undefined),
          assignedIrmName: item.assignedIrmName || item.customFields?.assignedIrmName || '',
          assignedIrmAt: item.assignedIrmAt || item.customFields?.assignedIrmAt || undefined,
          assignedAt: item.assignedAt || item.createdAt || undefined,
          customFields: item.customFields || {}
        }));
      setLeads(apiLeads);
      setSelectedLead(prev => {
        if (!prev) return null;
        return apiLeads.find((l: any) => l.id === prev.id) || null;
      });
    } catch (err: any) {
      console.error('Failed to load leads from API', err);
      setLoadError(err?.message || 'Failed to connect to server. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadActiveCoverages();
    getCompanyIrms(tenant?.id).then(list => setCompanyIrms(list || []));
  }, [tenant?.id]);

  useEffect(() => {
    let cancelled = false;
    loadAgentDirectory(tenant?.id, user?.id).then(dir => {
      if (cancelled) return;
      setAgents(dir.agents);
      setAdminIds(dir.adminIds);
    });
    return () => { cancelled = true; };
  }, [tenant?.id, user?.id]);

  useEffect(() => {
    loadData();
    let timeoutId: any;
    const handleUpdate = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        loadData();
      }, 300);
    };
    window.addEventListener('nexus_storage_updated', handleUpdate);
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
      clearTimeout(timeoutId);
      window.removeEventListener('nexus_storage_updated', handleUpdate);
      window.removeEventListener('focus', handleFocus);
      clearInterval(interval);
    };
  }, [tenant?.id, adminIds]);

  const handleOpenEdit = (lead: Lead) => {
    setFormData({
      ...lead,
      priority: lead.priority || 'Medium',
      targetDevelopment: lead.targetDevelopment || lead.customFields?.targetDevelopment || lead.customFields?.project || '',
      budgetRange: lead.budgetRange || lead.customFields?.budgetRange || '',
      readyToRegister: (lead as any).readyToRegister || lead.customFields?.readyToRegister || 'Immediate',
      customFields: {
        ...(lead.customFields || {}),
        targetDevelopment: lead.targetDevelopment || lead.customFields?.targetDevelopment || lead.customFields?.project || '',
        budgetRange: lead.budgetRange || lead.customFields?.budgetRange || '',
        readyToRegister: (lead as any).readyToRegister || lead.customFields?.readyToRegister || 'Immediate',
      },
    });
    setPendingAgent(null);
    setIsReassignConfirmOpen(false);
    setIsEditDrawerOpen(true);
  };

  const [dynamicAgents, setDynamicAgents] = useState<Array<{ id: string | number; name: string }>>([]);

  useEffect(() => {
    if (isJamin) {
      jaminApiService.getProjects().then(projs => {
        setAvailableProjects(projs || []);
      }).catch(err => console.warn('Failed to load projects in AssignedLeadsPage:', err));

      jaminApiService.getAgents().then(data => {
        if (data && data.length > 0) {
          setDynamicAgents(data.map(a => ({ id: a.id, name: a.name })));
        }
      }).catch(err => console.warn('Failed to load Jamin agents:', err));
    } else {
      adminUserService.getUsers(tenant?.id || '1').then(users => {
        if (users && users.length > 0) {
          setDynamicAgents(
            users
              .filter(u => {
                const code = String(u.role?.code || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
                return u.status !== 'Disabled' && ['sales_executive', 'sales_manager', 'irm'].includes(code);
              })
              .map(u => ({ id: u.id, name: u.name }))
          );
        }
      }).catch(err => console.warn('Failed to load GHL agents:', err));
    }
  }, [tenant?.id, isJamin]);

  // Populate agent options from backend API and local directory
  const agentOptions = useMemo<AssignableAgent[]>(() => {
    const list: AssignableAgent[] = agents.length > 0
      ? [...agents]
      : dynamicAgents.map(d => ({ id: String(d.id), name: d.name, email: '', roleCode: 'sales_executive' } as AssignableAgent));
    if (formData.assignedAgentName && !list.some(a => a.name.toLowerCase() === formData.assignedAgentName?.toLowerCase())) {
      list.unshift({ id: 'current', name: formData.assignedAgentName } as any);
    }
    return list;
  }, [formData.assignedAgentName, agents, dynamicAgents]);

  const handleAgentChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newId = e.target.value;
    const currentId = formData.assignedAgentId || '';

    // If unchanged, do nothing
    if (!newId || newId === currentId) return;

    const chosenAgent = agentOptions.find(a => String(a.id) === String(newId));
    if (!chosenAgent) return;

    // Trigger confirmation modal; do not change form state immediately
    setPendingAgent(chosenAgent);
    setIsReassignConfirmOpen(true);
  };

  const handleConfirmReassign = () => {
    if (pendingAgent) {
      setFormData(prev => ({
        ...prev,
        assignedAgentId: String(pendingAgent.id),
        assignedAgentName: pendingAgent.name,
      }));
    }
    setIsReassignConfirmOpen(false);
    setPendingAgent(null);
  };

  const handleCancelReassign = () => {
    setIsReassignConfirmOpen(false);
    setPendingAgent(null);
  };

  const handleOpenAssignIrm = (lead: Lead) => {
    setLeadToAssignIrm(lead);
    const existingIrm = lead.assignedIrmId || lead.customFields?.assignedIrmId;
    setSelectedIrmForLead(existingIrm ? String(existingIrm) : (companyIrms[0]?.id || ''));
    setIsAssignIrmModalOpen(true);
  };

  const handleConfirmAssignIrm = async () => {
    if (!leadToAssignIrm) return;
    const chosenIrm = companyIrms.find(i => String(i.id) === String(selectedIrmForLead));
    const nowIso = new Date().toISOString();

    const updatedLead: Lead = {
      ...leadToAssignIrm,
      assignedIrmId: chosenIrm ? String(chosenIrm.id) : undefined,
      assignedIrmName: chosenIrm ? chosenIrm.name : undefined,
      assignedIrmAt: chosenIrm ? nowIso : undefined,
      notes: `${leadToAssignIrm.notes ? leadToAssignIrm.notes + '\n\n' : ''}[${new Date().toLocaleDateString()}] Assigned to IRM: ${chosenIrm?.name || 'Unassigned'} by ${user?.name || 'Admin'}`,
      customFields: {
        ...leadToAssignIrm.customFields,
        assignedIrmId: chosenIrm ? String(chosenIrm.id) : undefined,
        assignedIrmName: chosenIrm ? chosenIrm.name : undefined,
        assignedIrmAt: chosenIrm ? nowIso : undefined,
      }
    };

    setIsSubmittingIrm(true);
    try {
      if (apiClient.isMockMode()) {
        storageService.saveLead(updatedLead);
      } else {
        await apiClient.put(`/sales-executive/leads/${leadToAssignIrm.id}`, {
          name: leadToAssignIrm.name,
          phone: leadToAssignIrm.phone,
          companyId: parseInt(String(leadToAssignIrm.companyId), 10) || 1,
          email: leadToAssignIrm.email,
          location: leadToAssignIrm.location,
          source: leadToAssignIrm.source,
          priority: leadToAssignIrm.priority,
          notes: updatedLead.notes,
          investmentCapacity: leadToAssignIrm.customFields?.investmentCapacity || '',
          assignedIrmId: chosenIrm ? parseInt(chosenIrm.id, 10) : 0,
          assignedIrmName: chosenIrm ? chosenIrm.name : '',
          assignedIrmAt: chosenIrm ? nowIso : '',
        });
        storageService.saveLead(updatedLead);
      }
      window.dispatchEvent(new Event('nexus_storage_updated'));
      setIsAssignIrmModalOpen(false);
      setLeadToAssignIrm(null);
      await loadData();
    } catch (e) {
      console.error('Failed to assign IRM', e);
      storageService.saveLead(updatedLead);
    } finally {
      setIsSubmittingIrm(false);
    }
  };
  const handleSaveLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.phone) return;

    setIsSaving(true);
    try {
      const existingLead = leads.find(l => l.id === formData.id);
      const irmChanged = existingLead && (existingLead.assignedIrmName || '') !== (formData.assignedIrmName || '');
      const nowIso = new Date().toISOString();

      const leadToSave: Lead = {
        ...(existingLead || ({} as Lead)),
        ...(formData as Lead),
        id: formData.id || `lead-${Date.now()}`,
        companyId: formData.companyId || (isJamin ? '2' : (tenant?.id || '1')),
        assignedIrmId: formData.assignedIrmId,
        assignedIrmName: formData.assignedIrmName,
        assignedIrmAt: irmChanged ? nowIso : (formData.assignedIrmAt || existingLead?.assignedIrmAt || (formData.assignedIrmName ? nowIso : undefined)),
        customFields: {
          ...(existingLead?.customFields || {}),
          ...(formData.customFields || {}),
          assignedIrmId: formData.assignedIrmId,
          assignedIrmName: formData.assignedIrmName,
          assignedIrmAt: irmChanged ? nowIso : (formData.assignedIrmAt || existingLead?.assignedIrmAt || (formData.assignedIrmName ? nowIso : undefined)),
        }
      };

      const effectiveCompanyId = isJamin ? 2 : 1;
      let parsedAgentId: number | undefined;
      const rawAgentId = leadToSave.assignedAgentId;
      if (typeof rawAgentId === 'number') {
        parsedAgentId = rawAgentId;
      } else if (typeof rawAgentId === 'string' && rawAgentId.trim() !== '') {
        const parsed = parseInt(rawAgentId, 10);
        if (!isNaN(parsed) && parsed > 0) {
          parsedAgentId = parsed;
        }
      }

      if (!parsedAgentId && leadToSave.assignedAgentName && leadToSave.assignedAgentName !== 'Unassigned') {
        const match = agentOptions.find(a => a.name.toLowerCase() === leadToSave.assignedAgentName?.toLowerCase());
        if (match) {
          const parsed = parseInt(String(match.id), 10);
          if (!isNaN(parsed) && parsed > 0) parsedAgentId = parsed;
        }
      }

      const numericId = parseInt(String(leadToSave.id).replace(/\D/g, ''), 10);
      if (!isNaN(numericId) && numericId > 0 && !apiClient.isMockMode()) {
        const payload: any = {
          name: leadToSave.name,
          phone: leadToSave.phone,
          companyId: effectiveCompanyId,
          email: leadToSave.email,
          location: leadToSave.location,
          source: leadToSave.source,
          status: leadToSave.status || 'New',
          priority: leadToSave.priority || 'Medium',
          notes: leadToSave.notes,
          investmentCapacity: leadToSave.customFields?.investmentCapacity || '',
          targetDevelopment: leadToSave.targetDevelopment,
          assignedAgentId: parsedAgentId,
          assignedAgentName: leadToSave.assignedAgentName && leadToSave.assignedAgentName !== 'Unassigned' ? leadToSave.assignedAgentName : undefined,
          assignedIrmId: leadToSave.assignedIrmId ? parseInt(String(leadToSave.assignedIrmId), 10) : 0,
          assignedIrmName: leadToSave.assignedIrmName || '',
          assignedIrmAt: leadToSave.assignedIrmAt || '',
          budgetRange: leadToSave.budgetRange || leadToSave.customFields?.budgetRange || '',
          readyToRegister: leadToSave.readyToRegister || leadToSave.customFields?.readyToRegister || '',
        };

        const res = await apiClient.put<any>(`/leads/${numericId}`, payload).catch(async () => {
          return await apiClient.put<any>(`/sales-executive/leads/${numericId}`, payload);
        });

        if (res && res.success === false) {
          throw new Error(res.message || 'The backend rejected the lead update.');
        }
      }

      storageService.saveLead(leadToSave);

      // If the agent was changed in the edit panel, persist the reassignment
      const agentChanged =
        existingLead && String(existingLead.assignedAgentId || '') !== String(leadToSave.assignedAgentId || '');
      if (agentChanged) {
        const newAgent = agentOptions.find(a => String(a.id) === String(leadToSave.assignedAgentId));
        if (newAgent) {
          if (apiClient.isMockMode()) {
            try {
              await persistLeadAssignment(leadToSave, newAgent);
            } catch (err: any) {
              console.error('Reassign failed', err);
            }
          } else {
            try {
              const res = await apiClient.post<any>('/ghl/leads/reassign', {
                leadIds: [parseInt(leadToSave.id, 10)],
                agentId: (newAgent as any).dbId || (newAgent as any).id
              });
              const skipped = res?.data?.skipped || [];
              if (skipped.length > 0) alert(`Reassign skipped: ${skipped[0].reason}`);
            } catch (err: any) {
              console.error('Reassign failed', err);
            }
          }
        }
      }

      setIsEditDrawerOpen(false);
      window.dispatchEvent(new Event('nexus_storage_updated'));
      await loadData();
    } catch (err: any) {
      console.error('Failed to update lead:', err);
      alert(err?.message || 'Failed to update lead on the server.');
    } finally {
      setIsSaving(false);
    }
  };

  // Table columns: Lead Name & Contact, Email, Investment Amount Range, Assigned Sales Executive, Assigned IRM, Source, Status, Quick Call, Action
  const columns: Column<Lead>[] = [
    {
      key: 'name',
      header: 'Lead Name & Contact',
      sortable: true,
      render: l => (
        <div>
          <div className="lead-name-primary">{l.name}</div>
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
      key: 'investmentAmount',
      header: tenant?.slug === 'jamin' || tenant?.id === 't-jamin-02' ? 'Target Development / Budget' : 'Investment Amount Range',
      sortable: true,
      render: l => {
        const targetDev = l.targetDevelopment || l.customFields?.targetDevelopment || l.customFields?.preferredDevelopment;
        const budget =
          l.budgetRange ||
          l.customFields?.budgetRange ||
          l.customFields?.budget ||
          l.customFields?.targetBudget ||
          l.customFields?.investmentCapacity ||
          (l as any).investmentAmount;

        if (targetDev && budget) {
          return (
            <div>
              <div className="lead-investment-val" style={{ fontWeight: 600 }}>{targetDev}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{budget}</div>
            </div>
          );
        }

        if (targetDev) {
          return <span className="lead-investment-val" style={{ fontWeight: 600 }}>{targetDev}</span>;
        }

        if (budget) {
          return <span className="lead-investment-val">{budget}</span>;
        }

        return <span className="lead-text-muted">—</span>;
      },
    },
    {
      key: 'assignedSalesExecutive',
      header: isJamin ? 'Assigned Agent' : 'Assigned Sales Executive',
      sortable: true,
      render: l => {
        const info = resolveLeadOwnership(l);
        const formattedSalesDate = formatDateDisplay(info.salesExecutiveDate);
        return (
          <div className="lead-person-cell">
            <span className="lead-assigned-agent-val">{info.salesExecutiveName || '—'}</span>
            {info.isSalesCovered && info.salesCoveredBy && (
              <span className="lead-person-coverage-badge" title={`Work covered by ${info.salesCoveredBy}`}>
                Covered by {info.salesCoveredBy}
              </span>
            )}
            <span className="lead-person-date">{formattedSalesDate || '—'}</span>
          </div>
        );
      },
    },
    {
      key: 'assignedIrm',
      header: 'Assigned IRM',
      sortable: true,
      render: l => {
        const info = resolveLeadOwnership(l);
        const formattedIrmDate = formatDateDisplay(info.irmDate);
        return (
          <div className="lead-person-cell">
            <span className={`lead-assigned-irm-val ${info.irmName ? 'assigned' : 'unassigned'}`}>
              {info.irmName || '—'}
            </span>
            {info.isIrmCovered && info.irmCoveredBy && (
              <span className="lead-person-coverage-badge" title={`Work covered by ${info.irmCoveredBy}`}>
                Covered by {info.irmCoveredBy}
              </span>
            )}
            {info.irmName && formattedIrmDate ? (
              <span className="lead-person-date">{formattedIrmDate}</span>
            ) : (
              <span className="lead-person-date lead-text-muted">—</span>
            )}
            {info.irmName && info.transferredBy && (
              <span className="lead-transferred-by" title={`Transferred by ${info.transferredBy}`}>
                Transferred by {info.transferredBy}
              </span>
            )}
          </div>
        );
      },
    },
    {
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
        return <StatusChip status={l.status || 'New'} size="sm" />;
      },
    },
    {
      key: 'source',
      header: 'Source',
      sortable: true,
      render: l => <span className="lead-text-muted">{l.source || '—'}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: l => {
        const rawStatus = l.status || 'New';
        const statusClass = rawStatus.toLowerCase().replace(/\s+/g, '-');
        return (
          <span className={`lead-status-pill status-${statusClass}`}>
            {rawStatus}
          </span>
        );
      },
    },
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

  const handleDeleteLead = async (lead: Lead) => {
    if (confirm(`Delete lead "${lead.name}"?`)) {
      try {
        const cleanId = String(lead.id).replace('db-', '').trim();
        const numericId = parseInt(cleanId, 10);
        if (!isNaN(numericId)) {
          await apiClient.delete(`/leads/${numericId}`).catch(async () => {
            await apiClient.delete(`/sales-executive/leads/${numericId}`);
          });
        }
      } catch (err) {
        console.error('Failed to delete lead from DB', err);
      }
      storageService.deleteLead(lead.id);
      storageService.addAuditLog({
        id: `aud-${Date.now()}`,
        timestamp: new Date().toISOString(),
        actorName: user?.name || 'Admin',
        actorEmail: user?.email || (isJamin ? 'admin@jaminbazaar.com' : 'admin@ghlindiaventures.com'),
        action: 'LEAD_DELETED',
        entityType: 'Lead',
        entityId: String(lead.id),
        companyId: tenant?.id,
        companyName: tenant?.name,
        details: `Deleted lead prospect ${lead.name} (Phone: ${lead.phone}).`,
      });
      setSelectedLead(null);
      setIsDetailDrawerOpen(false);
      setIsEditDrawerOpen(false);
      await loadData();
    }
  };

  const rowActions: RowAction<Lead>[] = [
    {
      label: 'Call Lead',
      icon: <Phone size={14} color="#10b981" className="leads-action-icon" />,
      onClick: l => initiateCall(l.name, l.phone, 'lead', l.id),
    },
    {
      label: 'View 360 Drawer',
      icon: <ExternalLink size={14} className="leads-action-icon" />,
      onClick: l => {
        setSelectedLead(l);
        setIsDetailDrawerOpen(true);
      },
    },
    {
      label: 'Assign / Change IRM',
      icon: <UserCheck size={14} className="leads-action-icon" />,
      onClick: l => handleOpenAssignIrm(l),
    },
    {
      label: 'Edit Lead',
      icon: <Edit size={14} className="leads-action-icon" />,
      onClick: l => handleOpenEdit(l),
    },
    {
      label: 'Delete Lead',
      icon: <Trash2 size={14} color="#ef4444" className="leads-action-icon" />,
      danger: true,
      onClick: l => handleDeleteLead(l),
    },
  ];

  // Unique source options for the filter dropdown
  const uniqueSources = useMemo(() => {
    const sources = leads
      .map(l => l.source)
      .filter((s): s is string => Boolean(s));
    return Array.from(new Set(sources)).sort();
  }, [leads]);

  // Unique agent names for the filter dropdown
  const uniqueAgents = useMemo(() => {
    const names = new Set<string>();
    leads.forEach(l => {
      const info = resolveLeadOwnership(l);
      if (info.salesExecutiveName) names.add(info.salesExecutiveName);
    });
    agents.forEach(a => {
      if (a.name) names.add(a.name);
    });
    return Array.from(names).sort();
  }, [leads, agents]);

  // Unique IRM names for the filter dropdown
  const uniqueIrms = useMemo(() => {
    const names = new Set<string>();
    leads.forEach(l => {
      const info = resolveLeadOwnership(l);
      if (info.irmName) names.add(info.irmName);
    });
    companyIrms.forEach(i => {
      if (i.name) names.add(i.name);
    });
    return Array.from(names).sort();
  }, [leads, companyIrms]);

  // Apply agent, IRM, and date range filter on top of the full leads list
  const filteredLeads = useMemo(() => {
    return leads.filter(l => {
      const info = resolveLeadOwnership(l);

      // Hide converted leads by default unless statusFilter is explicitly 'Converted'
      if (statusFilter === 'All' && (l.status as string) === 'Converted') {
        return false;
      }
      if (statusFilter !== 'All' && (l.status as string) !== statusFilter) {
        return false;
      }

      // Source filter
      if (sourceFilter !== 'All' && l.source !== sourceFilter) {
        return false;
      }

      // 1. Sales Executive filter
      if (agentFilter && agentFilter !== 'All') {
        if (agentFilter === 'Unassigned') {
          if (info.salesExecutiveName) return false;
        } else if (
          info.salesExecutiveName !== agentFilter &&
          info.salesCoveredBy !== agentFilter
        ) {
          return false;
        }
      }

      // 2. IRM filter
      if (irmFilter && irmFilter !== 'All') {
        if (irmFilter === 'Unassigned') {
          if (info.irmName) return false;
        } else if (
          info.irmName !== irmFilter &&
          info.irmCoveredBy !== irmFilter
        ) {
          return false;
        }
      }

      // 3. Date range filter
      if (datePreset === 'all' && !dateFrom && !dateTo) {
        return true;
      }

      const leadDateStr = getLeadDateStr(l);
      if (!leadDateStr) {
        return datePreset === 'all';
      }

      if (dateFrom && leadDateStr < dateFrom) {
        return false;
      }
      if (dateTo && leadDateStr > dateTo) {
        return false;
      }

      return true;
    });
  }, [leads, statusFilter, sourceFilter, agentFilter, irmFilter, datePreset, dateFrom, dateTo, activeCoverages]);

  if (!canManageAssignments && !isGhlAdmin && !isJamin) {
    return (
      <div className="assigned-leads-unauthorized">
        <h3>Access Restricted</h3>
        <p>This module is only accessible to Company Admins and Managers.</p>
      </div>
    );
  }

  return (
    <div className="leads-page assigned-leads-page">
      {/* Header */}
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 className="page-title">
            <UserCheck size={24} color="var(--primary-600)" /> Assigned Leads
          </h1>
          <p className="page-subtitle">
            View all inbound prospects that have been assigned to sales agents for {tenant?.name}.
          </p>
        </div>
        {isAdmin && (
          <div>
            <button
              className="btn btn-secondary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13 }}
              onClick={() => {
                if (onNavigate) {
                  onNavigate('work-handover');
                } else {
                  window.history.pushState({}, '', '/handover');
                  window.dispatchEvent(new PopStateEvent('popstate'));
                }
              }}
            >
              <Users size={15} /> Work Handover (Coverage)
            </button>
          </div>
        )}
      </div>

      {/* Assigned Leads Table */}
      {loadError && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          marginBottom: 16,
          borderRadius: 8,
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.25)',
          color: '#ef4444',
          fontSize: 13,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertCircle size={16} />
            <span>{loadError}</span>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => loadData()}
            style={{ borderColor: '#ef4444', color: '#ef4444' }}
          >
            Retry
          </button>
        </div>
      )}

      <DataTable
        columns={columns}
        data={filteredLeads}
        loading={isLoading}
        keyExtractor={l => l.id}
        rowActions={rowActions}
        onRowClick={l => {
          setSelectedLead(l);
          setIsDetailDrawerOpen(true);
        }}
        searchPlaceholder="Search assigned leads by name, phone, or agent..."
        searchFilter={(lead, query) => {
          const info = resolveLeadOwnership(lead);
          const q = query.toLowerCase();
          return (
            lead.name.toLowerCase().includes(q) ||
            lead.phone.includes(q) ||
            (lead.email || '').toLowerCase().includes(q) ||
            (lead.source || '').toLowerCase().includes(q) ||
            (lead.status || '').toLowerCase().includes(q) ||
            (info.salesExecutiveName || '').toLowerCase().includes(q) ||
            (info.irmName || '').toLowerCase().includes(q) ||
            (info.transferredBy || '').toLowerCase().includes(q)
          );
        }}
        emptyTitle="No assigned leads found"
        emptyDescription="Leads assigned to agents will appear here."
        filtersNode={
          <FilterBar
            showLabel={!isJamin}
            hideItemLabels={isJamin}
            filters={[
              {
                key: 'status',
                label: 'Status',
                allLabel: isJamin ? 'All Statuses' : 'All',
                value: statusFilter,
                onChange: setStatusFilter,
                options: isJamin
                  ? [
                    { value: 'New', label: 'New' },
                    { value: 'Contacted', label: 'Contacted' },
                    { value: 'Interested', label: 'Interested' },
                    { value: 'Qualified', label: 'Qualified' },
                    { value: 'Follow-up Required', label: 'Follow-up Required' },
                    { value: 'Follow-up Completed', label: 'Follow-up Completed' },
                    { value: 'Callback', label: 'Callback' },
                    { value: 'No Response', label: 'No Response' },
                    { value: 'Not Interested', label: 'Not Interested' },
                    { value: 'Junk', label: 'Junk' },
                    { value: 'Lost', label: 'Lost' },
                    { value: 'Converted', label: '✓ Converted' },
                  ]
                  : [
                    { value: 'New', label: 'New' },
                    { value: 'Contacted', label: 'Contacted' },
                    { value: 'Qualified', label: 'Qualified' },
                    { value: 'Proposal', label: 'Proposal' },
                    { value: 'Negotiation', label: 'Negotiation' },
                    { value: 'Interested', label: 'Interested' },
                    { value: 'Follow-up Required', label: 'Follow-up Required' },
                    { value: 'Follow-up Completed', label: 'Follow-up Completed' },
                    { value: 'Callback', label: 'Callback' },
                    { value: 'No Response', label: 'No Response' },
                    { value: 'Not Interested', label: 'Not Interested' },
                    { value: 'Junk', label: 'Junk' },
                    { value: 'Lost', label: 'Lost' },
                    { value: 'Converted', label: '✓ Converted' },
                  ],
              },
              {
                key: 'source',
                label: 'Source',
                allLabel: isJamin ? 'All Sources' : 'All Sources',
                value: sourceFilter,
                onChange: setSourceFilter,
                options: uniqueSources.map(s => ({ value: s, label: s })),
              },
              ...(canManageAssignments ? [
                {
                  key: 'assignedAgent',
                  label: isJamin ? 'Assigned Agent' : 'Assigned Sales Executive',
                  value: agentFilter,
                  onChange: setAgentFilter,
                  placeholder: 'Select an agent',
                  options: uniqueAgents.map(name => ({ value: name, label: name })),
                },
                ...(!isJamin ? [{
                  key: 'assignedIrm',
                  label: 'Assigned IRM',
                  value: irmFilter,
                  onChange: setIrmFilter,
                  placeholder: 'Select an IRM',
                  options: [
                    ...uniqueIrms.map(name => ({ value: name, label: name })),
                    { value: 'Unassigned', label: 'Unassigned' },
                  ],
                }] : []),
              ] : [])
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
              setSourceFilter('All');
              setAgentFilter('All');
              setIrmFilter('All');
              setDatePreset('all');
              setDateFrom('');
              setDateTo('');
            }}
          />
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
        {selectedLead && (
          <>
            {/* Quick Info Banner */}
            {(() => {
              const info = resolveLeadOwnership(selectedLead);
              return (
                <div className="lead-quick-banner" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div className="lead-assigned-note">
                    Sales Executive: <strong>{info.salesExecutiveName || 'Unassigned'}</strong>
                    {info.salesExecutiveDate && (
                      <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 6 }}>
                        ({formatDateDisplay(info.salesExecutiveDate)})
                      </span>
                    )}
                    {info.isSalesCovered && info.salesCoveredBy && (
                      <span className="lead-person-coverage-badge" style={{ marginLeft: 8 }}>
                        Covered by {info.salesCoveredBy}
                      </span>
                    )}
                  </div>
                  <div className="lead-assigned-note" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      Assigned IRM: <strong>{info.irmName || 'Not Assigned'}</strong>
                      {info.irmDate && (
                        <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 6 }}>
                          ({formatDateDisplay(info.irmDate)})
                        </span>
                      )}
                      {info.isIrmCovered && info.irmCoveredBy && (
                        <span className="lead-person-coverage-badge" style={{ marginLeft: 8 }}>
                          Covered by {info.irmCoveredBy}
                        </span>
                      )}
                      {info.transferredBy && (
                        <span className="lead-transferred-by" style={{ marginLeft: 8 }}>
                          Transferred by {info.transferredBy}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: 11, padding: '3px 8px', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                      onClick={() => handleOpenAssignIrm(selectedLead)}
                    >
                      <UserCheck size={12} /> {info.irmName ? 'Change IRM' : 'Assign IRM'}
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* Core Details */}
            <div className="card lead-detail-card">
              <h4 className="lead-detail-title">
                Contact & Profile Details
              </h4>
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
                  <div className="lead-detail-value">{selectedLead.source || '—'}</div>
                </div>
                <div>
                  <span className="lead-detail-label">Follow-up:</span>
                  <div className="lead-detail-value lead-followup-text has-date">
                    {selectedLead.nextFollowupDate || 'Not scheduled'}
                  </div>
                </div>
              </div>
            </div>

            {/* Tenant-Specific Attributes (Jamin Property Requirements vs GHL Custom Attributes) */}
            {isJamin ? (
              <div className="card lead-custom-card">
                <h4 className="lead-custom-title">
                  Requirements &amp; Project Preferences
                </h4>
                <div className="lead-detail-grid">
                  <div>
                    <span className="lead-custom-label">Target Development / Project:</span>
                    <div className="lead-custom-value" style={{ fontWeight: 600, color: 'var(--primary-600)' }}>
                      {selectedLead.targetDevelopment || (selectedLead.customFields as any)?.targetDevelopment || '—'}
                    </div>
                  </div>
                  <div>
                    <span className="lead-custom-label">Plot Budget Range:</span>
                    <div className="lead-custom-value" style={{ fontWeight: 700, color: '#059669' }}>
                      {selectedLead.budgetRange || (selectedLead.customFields as any)?.budgetRange || '—'}
                    </div>
                  </div>
                  <div>
                    <span className="lead-custom-label">Ready to Register / Timeline:</span>
                    <div className="lead-custom-value">
                      {selectedLead.readyToRegister || (selectedLead.customFields as any)?.readyToRegister || '—'}
                    </div>
                  </div>
                </div>
              </div>
            ) : (() => {
              const activeDefs = storageService
                .getCustomFieldDefinitions(tenant?.id)
                .filter(d => d.active !== false && (d.module === 'leads' || !d.module))
                .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));

              const rows = activeDefs
                .map(def => {
                  const key = def.fieldKey || def.id;
                  const val = selectedLead.customFields?.[key];
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
                <div className="card lead-custom-card">
                  <h4 className="lead-custom-title">
                    {tenant?.name} Custom Attributes
                  </h4>
                  <div className="lead-detail-grid">
                    {rows.map(item => (
                      <div key={item!.id}>
                        <span className="lead-custom-label">
                          {item!.label}:
                        </span>
                        <div className="lead-custom-value">{item!.value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Notes */}
            {selectedLead.notes && (
              <div className="card lead-custom-card">
                <h4 className="lead-custom-title">Notes</h4>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>
                  {selectedLead.notes}
                </div>
              </div>
            )}
          </>
        )}
      </Drawer>

      {/* Edit Drawer */}
      <Drawer
        isOpen={isEditDrawerOpen}
        onClose={() => setIsEditDrawerOpen(false)}
        title={formData.id ? 'Edit Assigned Lead' : 'Lead Details'}
        subtitle={formData.name || ''}
        width={500}
        footer={
          <>
            <button
              className="btn btn-secondary"
              onClick={() => setIsEditDrawerOpen(false)}
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              className="btn btn-primary"
              onClick={handleSaveLead}
              disabled={isSaving}
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </>
        }
      >
        <form onSubmit={handleSaveLead} className="lead-form">
          <div className="form-group">
            <label htmlFor="assigned-lead-name" className="form-label">Full Name *</label>
            <input
              id="assigned-lead-name"
              name="name"
              type="text"
              required
              autoComplete="name"
              className="form-input"
              value={formData.name || ''}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. Agent One"
            />
          </div>

          <div className="form-grid-2">
            <div className="form-group">
              <label htmlFor="assigned-lead-phone" className="form-label">Phone *</label>
              <input
                id="assigned-lead-phone"
                name="phone"
                type="tel"
                required
                autoComplete="tel"
                className="form-input"
                value={formData.phone || ''}
                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+91 98450 00000"
              />
            </div>
            <div className="form-group">
              <label htmlFor="assigned-lead-email" className="form-label">Email</label>
              <input
                id="assigned-lead-email"
                name="email"
                type="email"
                autoComplete="email"
                className="form-input"
                value={formData.email || ''}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
                placeholder="agent1@example.com"
              />
            </div>
          </div>

          <div className="form-grid-2">
            <div className="form-group">
              <label htmlFor="assigned-lead-location" className="form-label">Location / City</label>
              <input
                id="assigned-lead-location"
                name="location"
                type="text"
                autoComplete="address-level2"
                className="form-input"
                value={formData.location || ''}
                onChange={e => setFormData({ ...formData, location: e.target.value })}
                placeholder="e.g. Bangalore"
              />
            </div>
            <div className="form-group">
              <label htmlFor="assigned-lead-source" className="form-label">Lead Source</label>
              <select
                id="assigned-lead-source"
                name="source"
                className="form-select"
                value={formData.source || 'Website Inbound'}
                onChange={e => setFormData({ ...formData, source: e.target.value })}
              >
                <option value="Website Inbound">Website Inbound</option>
                <option value="Google Search">Google Search</option>
                <option value="Facebook Ad">Facebook Ad</option>
                <option value="Referral">Referral</option>
                <option value="Event / Expo">Event / Expo</option>
                <option value="Cold Call">Cold Call</option>
              </select>
            </div>
          </div>

          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label">Status</label>
              <select
                className="form-select"
                value={formData.status || 'New'}
                onChange={e => setFormData({ ...formData, status: e.target.value as any })}
              >
                <option value="New">New</option>
                <option value="Contacted">Contacted</option>
                <option value="Callback">Callback</option>
                <option value="Interested">Interested</option>
                <option value="Follow-up Required">Follow-up Required</option>
                <option value="Follow-up Completed">Follow-up Completed</option>
                {isJamin && <option value="Site Visit Scheduled">Site Visit Scheduled</option>}
                {isJamin && <option value="Site Visit Completed">Site Visit Completed</option>}
                {isJamin && <option value="Booking In Progress">Booking In Progress</option>}
                <option value="Converted">Converted</option>
                <option value="Not Interested">Not Interested</option>
                <option value="Junk">Junk</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Priority</label>
              <select
                className="form-select"
                value={formData.priority || 'Medium'}
                onChange={e => setFormData({ ...formData, priority: e.target.value as any })}
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Urgent">Urgent</option>
              </select>
            </div>
          </div>

          {isJamin && (
            <>
              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label">Preferred Project</label>
                  <select
                    className="form-select"
                    value={formData.targetDevelopment || formData.customFields?.targetDevelopment || ''}
                    onChange={e => {
                      const val = e.target.value;
                      const matching = availableProjects.find(
                        p => p.name === val || String(p.id) === val
                      );
                      setFormData(prev => ({
                        ...prev,
                        targetDevelopment: matching ? matching.name : val,
                        budgetRange: matching?.priceRange && !prev.budgetRange ? matching.priceRange : prev.budgetRange,
                        location: !prev.location && matching?.location ? matching.location : prev.location,
                        customFields: {
                          ...(prev.customFields || {}),
                          targetDevelopment: matching ? matching.name : val,
                          preferredLocation: matching?.location || '',
                          project: matching ? matching.name : val,
                        },
                      }));
                    }}
                  >
                    <option value="">
                      {availableProjects.length === 0
                        ? '— Loading available projects... —'
                        : `— Select Preferred Project (${availableProjects.length} available) —`}
                    </option>
                    {availableProjects.map(p => (
                      <option key={p.id} value={p.name}>
                        {p.name} {p.location ? `(${p.location})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Plot Budget Range</label>
                  <select
                    className="form-select"
                    value={formData.budgetRange || formData.customFields?.budgetRange || ''}
                    onChange={e => {
                      const val = e.target.value;
                      setFormData(prev => ({
                        ...prev,
                        budgetRange: val,
                        customFields: { ...prev.customFields, budgetRange: val },
                      }));
                    }}
                  >
                    <option value="">— Select Budget Range —</option>
                    <option value="₹25L - ₹45L">₹25L - ₹45L</option>
                    <option value="₹45L - ₹65L">₹45L - ₹65L</option>
                    <option value="₹65L - ₹90L">₹65L - ₹90L</option>
                    <option value="₹90L+">₹90L+</option>
                  </select>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 12 }}>
                <label className="form-label">Registration Timeline (When will client register?)</label>
                <select
                  className="form-select"
                  value={formData.readyToRegister || formData.customFields?.readyToRegister || 'Immediate'}
                  onChange={e => {
                    const val = e.target.value;
                    setFormData(prev => ({
                      ...prev,
                      readyToRegister: val,
                      customFields: { ...prev.customFields, readyToRegister: val },
                    }));
                  }}
                >
                  <option value="Immediate">Immediate</option>
                  <option value="Within 30 Days">Within 30 Days</option>
                  <option value="Within 60 Days">Within 60 Days</option>
                  <option value="Within 90 Days">Within 90 Days</option>
                  <option value="Exploring">Exploring / Future</option>
                </select>
              </div>
            </>
          )}

          <div className="form-grid-2">
            <div className="form-group">
              <label htmlFor="assigned-lead-agent" className="form-label">{isJamin ? 'Assigned Agent' : 'Assigned Sales Executive'}</label>
              <select
                id="assigned-lead-agent"
                className="form-select"
                value={formData.assignedAgentName || ''}
                onChange={handleAgentChange}
              >
                {!formData.assignedAgentName && <option value="">Select Agent</option>}
                {agentOptions.map(agent => (
                  <option key={agent.id} value={agent.name}>
                    {agent.name}
                  </option>
                ))}
              </select>
            </div>
            {!isJamin && (
              <div className="form-group">
                <label htmlFor="assigned-lead-irm" className="form-label">Assigned IRM</label>
                <select
                  id="assigned-lead-irm"
                  className="form-select"
                  value={formData.assignedIrmName || ''}
                  onChange={e => {
                    const selectedName = e.target.value;
                    if (!selectedName) {
                      setFormData(prev => ({
                        ...prev,
                        assignedIrmId: undefined,
                        assignedIrmName: undefined,
                        assignedIrmAt: undefined,
                      }));
                    } else {
                      const found = companyIrms.find(i => i.name === selectedName);
                      setFormData(prev => ({
                        ...prev,
                        assignedIrmId: found ? String(found.id) : undefined,
                        assignedIrmName: selectedName,
                        assignedIrmAt: new Date().toISOString(),
                      }));
                    }
                  }}
                >
                  <option value="">— Not Assigned —</option>
                  {companyIrms.map(irm => (
                    <option key={irm.id} value={irm.name}>
                      {irm.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="assigned-lead-notes" className="form-label">Notes & Requirements</label>
            <textarea
              id="assigned-lead-notes"
              name="notes"
              className="form-textarea"
              rows={3}
              value={formData.notes || ''}
              onChange={e => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Client background, key objections, time horizon..."
            />
          </div>
        </form>
      </Drawer>

      {/* Reassign Confirmation Modal */}
      <Modal
        isOpen={isReassignConfirmOpen}
        onClose={handleCancelReassign}
        title="Confirm Lead Reassignment"
        maxWidth={460}
        footer={
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', width: '100%' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleCancelReassign}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleConfirmReassign}
            >
              Confirm
            </button>
          </div>
        }
      >
        <p style={{ margin: '16px 0', fontSize: '14px', lineHeight: 1.5, color: 'var(--text-secondary)' }}>
          Reassign this lead to <strong>{pendingAgent?.name}</strong>? This will change the assigned agent from{' '}
          <strong>{formData.assignedAgentName || 'Unassigned'}</strong> to{' '}
          <strong>{pendingAgent?.name}</strong>.
        </p>
      </Modal>

      {/* Assign / Change IRM Modal */}
      <Modal
        isOpen={isAssignIrmModalOpen}
        onClose={() => {
          setIsAssignIrmModalOpen(false);
          setLeadToAssignIrm(null);
        }}
        title={leadToAssignIrm?.assignedIrmName ? "Change Assigned IRM" : "Assign IRM to Lead"}
        maxWidth={480}
        footer={
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', width: '100%' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setIsAssignIrmModalOpen(false);
                setLeadToAssignIrm(null);
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={isSubmittingIrm}
              onClick={handleConfirmAssignIrm}
            >
              {isSubmittingIrm ? 'Saving...' : 'Confirm Assignment'}
            </button>
          </div>
        }
      >
        {leadToAssignIrm && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, margin: '8px 0' }}>
            <div style={{ padding: '10px 14px', borderRadius: 8, background: 'var(--bg-card)', border: '1px solid var(--border-color)', fontSize: 13 }}>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                {leadToAssignIrm.name} <span style={{ fontWeight: 400, color: 'var(--text-secondary)' }}>({leadToAssignIrm.phone})</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                Sales Executive: <strong>{leadToAssignIrm.assignedAgentName || 'Unassigned'}</strong>
                {(leadToAssignIrm.assignedIrmName || leadToAssignIrm.customFields?.assignedIrmName) && (
                  <span style={{ marginLeft: 10 }}>
                    Current IRM: <strong>{leadToAssignIrm.assignedIrmName || leadToAssignIrm.customFields?.assignedIrmName}</strong>
                  </span>
                )}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Select IRM</label>
              <select
                className="form-select"
                value={selectedIrmForLead}
                onChange={e => setSelectedIrmForLead(e.target.value)}
              >
                <option value="">— Unassign / Remove IRM —</option>
                {companyIrms.map(irm => (
                  <option key={irm.id} value={irm.id}>
                    {irm.name} {irm.experience ? `(${irm.experience})` : ''}
                  </option>
                ))}
              </select>
            </div>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>
              Selecting an IRM assigns this prospect to the relationship manager and records today's date as the handover timestamp.
            </p>
          </div>
        )}
      </Modal>

      {/* Admin IRM Coverage & Reassignment Modal */}
      <Modal
        isOpen={isCoverageModalOpen}
        onClose={() => setIsCoverageModalOpen(false)}
        title="Admin IRM Coverage & Work Reassignment"
        subtitle="Temporarily assign an absent IRM's open records to a covering IRM with reversible audit trail."
        maxWidth={700}
      >
        <div style={{ padding: '4px 0' }}>
          {/* Tabs */}
          <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid var(--border-color)', marginBottom: 16 }}>
            <button
              className={`btn btn-sm ${coverageTab === 'assign' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setCoverageTab('assign')}
            >
              Assign Coverage
            </button>
            <button
              className={`btn btn-sm ${coverageTab === 'active' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => {
                setCoverageTab('active');
                loadActiveCoverages();
              }}
            >
              Active Coverages ({activeCoverages.length})
            </button>
          </div>

          {coverageError && (
            <div style={{ padding: '8px 12px', borderRadius: 6, backgroundColor: 'rgba(239,68,68,0.1)', color: '#dc2626', fontSize: 13, marginBottom: 14 }}>
              ⚠️ {coverageError}
            </div>
          )}

          {coverageMessage && (
            <div style={{ padding: '8px 12px', borderRadius: 6, backgroundColor: 'rgba(16,185,129,0.1)', color: '#059669', fontSize: 13, marginBottom: 14 }}>
              ✓ {coverageMessage}
            </div>
          )}

          {coverageTab === 'assign' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Absent IRM (Source) *</label>
                  <select
                    className="form-select"
                    value={fromIrmId}
                    onChange={e => setFromIrmId(e.target.value)}
                  >
                    <option value="">— Select Absent IRM —</option>
                    {agentOptions.filter(a => a.id !== 'current').map(a => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Covering IRM (Destination) *</label>
                  <select
                    className="form-select"
                    value={toIrmId}
                    onChange={e => setToIrmId(e.target.value)}
                  >
                    <option value="">— Select Covering IRM —</option>
                    {agentOptions.filter(a => a.id !== 'current' && String(a.id) !== fromIrmId).map(a => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Reason for Coverage</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Annual leave coverage until Monday"
                  value={coverageReason}
                  onChange={e => setCoverageReason(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsCoverageModalOpen(false)}
                >
                  Close
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={isSubmittingCoverage || !fromIrmId || !toIrmId}
                  onClick={handleReassignWork}
                >
                  {isSubmittingCoverage ? 'Reassigning...' : 'Assign Coverage'}
                </button>
              </div>
            </div>
          ) : (
            <div>
              {activeCoverages.length === 0 ? (
                <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
                  No active coverage assignments for this organization.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {activeCoverages.map((c: any) => (
                    <div
                      key={c.id}
                      style={{
                        padding: '12px 14px',
                        borderRadius: 8,
                        border: '1px solid var(--border-color)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        backgroundColor: 'var(--bg-card)'
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>
                          {c.originalIrmName} ➔ Covering: {c.coveringIrmName}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                          Reason: {c.reason || 'None specified'} • Started: {new Date(c.startedAt).toLocaleDateString()}
                        </div>
                      </div>
                      <button
                        className="btn btn-secondary btn-sm"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                        onClick={() => handleEndCoverage(c.id)}
                      >
                        <RotateCcw size={13} /> End &amp; Revert
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};
