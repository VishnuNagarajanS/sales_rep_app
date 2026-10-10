import React, { useState, useEffect, useMemo } from 'react';
import {
  UserCheck,
  Phone,
  Edit,
  ExternalLink,
  Users,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { Lead, IrmProfile } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useCall } from '../../context/CallContext';
import { storageService } from '../../services/storageService';
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
import { getAuthHeaders } from '../../utils/authHeaders';
import './AssignedLeadsPage.css';

interface AssignedLeadsPageProps {
  onNavigate?: (route: string) => void;
}

export const AssignedLeadsPage: React.FC<AssignedLeadsPageProps> = ({ onNavigate }) => {
  const { tenant, user } = useAuth();
  const { initiateCall } = useCall();

  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isDetailDrawerOpen, setIsDetailDrawerOpen] = useState(false);
  const [isEditDrawerOpen, setIsEditDrawerOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<Lead>>({});
  const [agentFilter, setAgentFilter] = useState<string>('All');
  const [irmFilter, setIrmFilter] = useState<string>('All');
  const [datePreset, setDatePreset] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  // IRM assignment state
  const [companyIrms, setCompanyIrms] = useState<IrmProfile[]>([]);
  const [isAssignIrmModalOpen, setIsAssignIrmModalOpen] = useState(false);
  const [leadToAssignIrm, setLeadToAssignIrm] = useState<Lead | null>(null);
  const [selectedIrmForLead, setSelectedIrmForLead] = useState<string>('');
  const [isSubmittingIrm, setIsSubmittingIrm] = useState(false);

  // Agent reassignment confirmation state for Edit panel
  const [pendingAgent, setPendingAgent] = useState<AssignableAgent | null>(null);
  const [agents, setAgents] = useState<AssignableAgent[]>([]);
  const [adminIds, setAdminIds] = useState<Set<string>>(
    new Set(user?.id ? [String(user.id)] : [])
  );
  const [isReassignConfirmOpen, setIsReassignConfirmOpen] = useState(false);

  const roleCode = user?.role?.code;
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
      if (lead.assignedAgentName && !isAgentIrm) {
        salesExecutiveName = lead.assignedAgentName;
        salesExecutiveDate = lead.assignedSalesExecutiveAt || lead.assignedAt || lead.createdAt;
      } else if (custom.qualifiedByAgentName) {
        salesExecutiveName = custom.qualifiedByAgentName;
        salesExecutiveDate = custom.qualifiedAt || lead.assignedAt || lead.createdAt;
      } else if (custom.assignedSalesExecutiveName) {
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
    if (apiClient.isMockMode()) {
      const allLeads = storageService.getLeads(tenant?.id);
      setLeads(allLeads);
      setSelectedLead(prev => {
        if (!prev) return null;
        return allLeads.find(l => l.id === prev.id) || null;
      });
      return;
    }

    try {
      const res = await apiClient.get<any>('/sales-executive/leads?page=1&pageSize=1000&status=all&assignment=all');
      if (res.success && res.data && res.data.items) {
        const apiLeads = res.data.items.map((item: any) => ({
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
      }
    } catch (err) {
      console.error('Failed to load leads from API', err);
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
    setFormData({ ...lead });
    setPendingAgent(null);
    setIsReassignConfirmOpen(false);
    setIsEditDrawerOpen(true);
  };

  // Populate agent options from agents (with storageService fallback), ensuring the current assigned agent is included
  const agentOptions = useMemo<AssignableAgent[]>(() => {
    const list: AssignableAgent[] = agents.length > 0 ? [...agents] : (storageService.getAgents(tenant?.id) as any[] || []);
    if (formData.assignedAgentName && !list.some(a => a.name.toLowerCase() === formData.assignedAgentName?.toLowerCase())) {
      list.unshift({ id: 'current', name: formData.assignedAgentName } as any);
    }
    return list;
  }, [formData.assignedAgentName, agents, tenant?.id]);

  const handleAgentChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newName = e.target.value;
    const currentName = formData.assignedAgentName || '';

    // If unchanged, do nothing
    if (!newName || newName === currentName) return;

    const chosenAgent = agentOptions.find(a => a.name === newName);
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

    const existingLead = leads.find(l => l.id === formData.id);
    const irmChanged = existingLead && (existingLead.assignedIrmName || '') !== (formData.assignedIrmName || '');
    const nowIso = new Date().toISOString();

    const leadToSave: Lead = {
      ...(existingLead || ({} as Lead)),
      ...(formData as Lead),
      id: formData.id || `lead-${Date.now()}`,
      companyId: formData.companyId || tenant?.id || 't-ghl-01',
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

    if (apiClient.isMockMode()) {
      storageService.saveLead(leadToSave);
    } else {
      try {
        const leadId = parseInt(leadToSave.id, 10);
        await apiClient.put(`/sales-executive/leads/${leadId}`, {
          name: leadToSave.name,
          phone: leadToSave.phone,
          companyId: parseInt(String(leadToSave.companyId), 10) || 1,
          email: leadToSave.email,
          location: leadToSave.location,
          source: leadToSave.source,
          priority: leadToSave.priority,
          notes: leadToSave.notes,
          investmentCapacity: leadToSave.customFields?.investmentCapacity || '',
          assignedAgentId: leadToSave.assignedAgentId ? parseInt(leadToSave.assignedAgentId, 10) : undefined,
          assignedIrmId: leadToSave.assignedIrmId ? parseInt(leadToSave.assignedIrmId, 10) : 0,
          assignedIrmName: leadToSave.assignedIrmName || '',
          assignedIrmAt: leadToSave.assignedIrmAt || '',
        });
        storageService.saveLead(leadToSave);
      } catch (err) {
        console.error('Failed to update lead', err);
        storageService.saveLead(leadToSave);
      }
    }

    // If the agent was changed in the edit panel, persist the reassignment
    const agentChanged =
      existingLead && String(existingLead.assignedAgentId || '') !== String(leadToSave.assignedAgentId || '');
    if (agentChanged) {
      const newAgent = agentOptions.find(a => a.id === String(leadToSave.assignedAgentId));
      if (newAgent) {
        if (apiClient.isMockMode()) {
          try {
            await persistLeadAssignment(leadToSave, newAgent);
          } catch (err: any) {
            console.error('Reassign failed', err);
            alert(`Failed to reassign lead: ${err.message || 'Unknown error'}`);
          }
        } else {
          try {
            const res = await apiClient.post<any>('/ghl/leads/reassign', {
              leadIds: [parseInt(leadToSave.id, 10)],
              agentId: newAgent.dbId
            });
            const skipped = res?.data?.skipped || [];
            if (skipped.length > 0) alert(`Reassign skipped: ${skipped[0].reason}`);
          } catch (err: any) {
            console.error('Reassign failed', err);
            alert(`Reassign failed: ${err.message || 'Unknown error'}`);
          }
        }
      }
    }

    setIsEditDrawerOpen(false);
    loadData();
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
      header: 'Investment Amount Range',
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
    {
      key: 'assignedSalesExecutive',
      header: 'Assigned Sales Executive',
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
      label: 'Assign / Change IRM',
      icon: <UserCheck size={14} className="leads-action-icon" />,
      onClick: l => handleOpenAssignIrm(l),
    },
    {
      label: 'Edit Lead',
      icon: <Edit size={14} className="leads-action-icon" />,
      onClick: l => handleOpenEdit(l),
    },
  ];

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
  }, [leads, agentFilter, irmFilter, datePreset, dateFrom, dateTo, activeCoverages]);

  if (!isGhlAdmin) {
    return (
      <div className="assigned-leads-unauthorized">
        <h3>Access Restricted</h3>
        <p>This module is only accessible to GHL India Ventures Company Admin.</p>
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
      <DataTable
        columns={columns}
        data={filteredLeads}
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
            filters={[
              {
                key: 'assignedAgent',
                label: 'Assigned Sales Executive',
                value: agentFilter,
                onChange: setAgentFilter,
                placeholder: 'Select a sales executive',
                options: uniqueAgents.map(name => ({ value: name, label: name })),
              },
              {
                key: 'assignedIrm',
                label: 'Assigned IRM',
                value: irmFilter,
                onChange: setIrmFilter,
                placeholder: 'Select an IRM',
                options: [
                  ...uniqueIrms.map(name => ({ value: name, label: name })),
                  { value: 'Unassigned', label: 'Unassigned' },
                ],
              },
            ]}
            dateRange={{
              preset: datePreset,
              onPresetChange: handleDatePresetChange,
              from: dateFrom,
              to: dateTo,
              onChange: handleCustomDateChange,
            }}
            onClearAll={() => {
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

            {/* Tenant-Specific Dynamic Custom Fields */}
            {(() => {
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
            >
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleSaveLead}>
              Save Changes
            </button>
          </>
        }
      >
        <form onSubmit={handleSaveLead} className="lead-form">
          <div className="form-group">
            <label className="form-label">Full Name *</label>
            <input
              type="text"
              required
              className="form-input"
              value={formData.name || ''}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. Agent One"
            />
          </div>

          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label">Phone *</label>
              <input
                type="tel"
                required
                className="form-input"
                value={formData.phone || ''}
                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+91 98450 00000"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input
                type="email"
                className="form-input"
                value={formData.email || ''}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
                placeholder="agent1@example.com"
              />
            </div>
          </div>

          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label">Location / City</label>
              <input
                type="text"
                className="form-input"
                value={formData.location || ''}
                onChange={e => setFormData({ ...formData, location: e.target.value })}
                placeholder="e.g. Bangalore"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Lead Source</label>
              <select
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
              <label className="form-label">Assigned Sales Executive</label>
              <select
                className="form-select"
                value={formData.assignedAgentName || ''}
                onChange={handleAgentChange}
              >
                {!formData.assignedAgentName && <option value="">Select Sales Executive</option>}
                {agentOptions.map(agent => (
                  <option key={agent.id} value={agent.name}>
                    {agent.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Assigned IRM</label>
              <select
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