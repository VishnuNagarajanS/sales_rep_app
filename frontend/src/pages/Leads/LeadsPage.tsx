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
  Calendar,
} from 'lucide-react';
import { Lead, Customer, Deal, Followup, SiteVisit } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useCall } from '../../context/CallContext';
import { storageService } from '../../services/storageService';
import { DataTable, Column, RowAction } from '../../components/common/DataTable';
import { FilterBar } from '../../components/common/FilterBar';
import { StatusChip } from '../../components/common/StatusChip';
import { Drawer } from '../../components/common/Drawer';
import { Modal } from '../../components/common/Modal';
import { LeadDetailDrawerContent } from '../../components/common/LeadDetailDrawerContent';
import './LeadsPage.css';

const CAPACITY_OPTIONS = [
  'Contact for Co-Invest Details',
  '₹1 Cr – ₹5 Cr',
  '₹5 Cr – ₹10 Cr',
  '₹10 Cr – ₹25 Cr',
  '₹25 Cr+',
  'Not sure yet — help me decide'
];

import { MOCK_AGENTS } from '../../mock_data/mockData';
export { MOCK_AGENTS };

export const LeadsPage: React.FC = () => {
  const { tenant, user } = useAuth();
  const { initiateCall } = useCall();

  const [leads, setLeads] = useState<Lead[]>([]);

  const MOVED_LEAD_STATUSES = ['Interested', 'Converted', 'Follow-up Required', 'Not Interested', 'Junk'];

  // Role-based scoping: Sales Executives and IRMs see only their own leads.
  // Managers / Admins / Super Admins see the full company lead list (no filter).
  // Inactive / moved leads (Interested, Follow-up Required, Not Interested, Junk, Converted) are excluded from active Leads.
  const roleCode = user?.role?.code;
  const isExec = roleCode === 'sales_executive';
  const isLeadScopedUser = roleCode === 'sales_executive' || roleCode === 'irm';
  const isIrm = roleCode === 'irm';
  const scopedLeads = (isLeadScopedUser
    ? leads.filter(l =>
      (l.assignedAgentId && l.assignedAgentId === user?.id) ||
      (l.assignedAgentName && l.assignedAgentName === user?.name)
    )
    : leads
  ).filter(l => !MOVED_LEAD_STATUSES.includes(l.status));
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
  const [datePreset, setDatePreset] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

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

  // Tenant flags
  const isJamin = tenant?.slug === 'jamin' || tenant?.id === 't-jamin-02';
  const canJaminAssign =
    isJamin &&
    (roleCode === 'company_admin' || (roleCode as string) === 'admin' || roleCode === 'super_admin' || roleCode === 'sales_manager' || roleCode === 'manager');
  const [jaminAssignMode, setJaminAssignMode] = useState<'none' | 'manual' | 'auto'>('none');
  const [selectedJaminLeadIds, setSelectedJaminLeadIds] = useState<Set<string>>(new Set());
  const [isJaminAssignModalOpen, setIsJaminAssignModalOpen] = useState(false);
  const [jaminSelectedAgent, setJaminSelectedAgent] = useState<{ id: string; name: string; email: string } | null>(null);
  const [isJaminAiModalOpen, setIsJaminAiModalOpen] = useState(false);
  const [jaminAiDistribution, setJaminAiDistribution] = useState<Record<string, Lead[]>>({});
  const [isJaminAiEditMode, setIsJaminAiEditMode] = useState(false);

  const jaminAgents = [
    { id: 'usr-jamin-exec', name: 'Pooja Hegde', email: 'pooja@jaminbazaar.com' },
    { id: 'usr-jamin-exec-02', name: 'Vikram Malhotra', email: 'vikram@jaminbazaar.com' },
    { id: 'usr-jamin-exec-03', name: 'Suresh Kumar', email: 'suresh@jaminbazaar.com' },
  ];

  // Jamin Quick Schedule Follow-up state
  const [isJaminScheduleModalOpen, setIsJaminScheduleModalOpen] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('11:00');
  const [scheduleType, setScheduleType] = useState<'call' | 'meeting' | 'whatsapp'>('call');
  const [scheduleNotes, setScheduleNotes] = useState('');
  const [scheduleAgentId, setScheduleAgentId] = useState('');

  // Jamin Lead Site Visit state
  const [isLeadSiteVisitModalOpen, setIsLeadSiteVisitModalOpen] = useState(false);
  const [leadVisitProject, setLeadVisitProject] = useState('Greenfield Meadows Phase 2');
  const [leadVisitPlot, setLeadVisitPlot] = useState('Plot #15');
  const [leadVisitDate, setLeadVisitDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  });
  const [leadVisitTimeSlot, setLeadVisitTimeSlot] = useState('11:00 AM');
  const [leadVisitNotes, setLeadVisitNotes] = useState('');
  const [leadVisitHostAgent, setLeadVisitHostAgent] = useState('Pooja Hegde');

  // GHL Admin assign-mode state
  const isGhlAdmin =
    (tenant?.slug === 'ghl' || tenant?.id === 't-ghl-01') &&
    (roleCode === 'company_admin' || (roleCode as string) === 'admin' || roleCode === 'super_admin');
  const [assignMode, setAssignMode] = useState<'manual' | 'auto'>('manual');
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(new Set());
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [assignStep, setAssignStep] = useState<'pick-agent' | 'confirm'>('pick-agent');
  const [assignSelectedAgent, setAssignSelectedAgent] = useState<typeof MOCK_AGENTS[0] | null>(null);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [aiDistribution, setAiDistribution] = useState<Record<number, Lead[]>>({});
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

  // Form state
  const [formData, setFormData] = useState<Partial<Lead>>({});
  const [convertDealTitle, setConvertDealTitle] = useState('');
  const [convertDealValue, setConvertDealValue] = useState<number>(5000000);

  const currentAssetClass =
    formData.customFields?.assetClass ||
    formData.customFields?.preferredAssetClass ||
    'AIF';

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

  const loadData = () => {
    const updated = storageService.getLeads(tenant?.id);
    setLeads(updated);
    setSelectedLead(prev => {
      if (!prev) return null;
      const found = updated.find(l => l.id === prev.id);
      if (!found || MOVED_LEAD_STATUSES.includes(found.status)) {
        setIsDetailDrawerOpen(false);
        setIsEditDrawerOpen(false);
        return null;
      }
      return found;
    });
  };

  useEffect(() => {
    storageService.cleanupDuplicateLeads(tenant?.id);
    loadData();
    const handleUpdate = () => loadData();
    window.addEventListener('nexus_storage_updated', handleUpdate);
    return () => window.removeEventListener('nexus_storage_updated', handleUpdate);
  }, [tenant?.id]);

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
    if (filterRange === 'Not sure yet — help me decide') {
      return nCap.includes('not sure') || nCap.includes('help');
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

    return true;
  });

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const handleJaminManualAssignConfirm = () => {
    if (!jaminSelectedAgent) return;
    const count = selectedJaminLeadIds.size;
    const updated = leads.map(l => {
      if (selectedJaminLeadIds.has(l.id)) {
        const u = {
          ...l,
          assignedAgentId: jaminSelectedAgent.id,
          assignedAgentName: jaminSelectedAgent.name,
        };
        storageService.saveLead(u);
        return u;
      }
      return l;
    });

    setLeads(updated);
    storageService.addAuditLog({
      id: `aud-${Date.now()}`,
      timestamp: 'Just now',
      actorName: user?.name || 'Admin',
      actorEmail: user?.email || 'admin@jaminbazaar.com',
      action: 'LEADS_ASSIGNED',
      entityType: 'Lead',
      entityId: Array.from(selectedJaminLeadIds).join(','),
      companyId: tenant?.id,
      companyName: tenant?.name,
      details: `Assigned ${count} lead(s) to ${jaminSelectedAgent.name}.`,
    });

    setIsJaminAssignModalOpen(false);
    setSelectedJaminLeadIds(new Set());
    showToast(`✓ Successfully assigned ${count} lead(s) to ${jaminSelectedAgent.name}`);
  };

  const handleOpenJaminAiSuggestion = () => {
    const pool = selectedJaminLeadIds.size > 0
      ? filteredLeads.filter(l => selectedJaminLeadIds.has(l.id))
      : filteredLeads;

    if (pool.length === 0) {
      alert('No leads available to distribute.');
      return;
    }

    const dist: Record<string, Lead[]> = {};
    jaminAgents.forEach(a => { dist[a.id] = []; });
    pool.forEach((lead, i) => {
      const agent = jaminAgents[i % jaminAgents.length];
      dist[agent.id].push(lead);
    });
    setAiDistribution({});
    setJaminAiDistribution(dist);
    setIsJaminAiEditMode(false);
    setIsJaminAiModalOpen(true);
  };

  const handleJaminAiMoveLead = (leadId: string, fromAgentId: string, direction: 'left' | 'right') => {
    const agentIds = jaminAgents.map(a => a.id);
    const fromIdx = agentIds.indexOf(fromAgentId);
    const toIdx = direction === 'left' ? fromIdx - 1 : fromIdx + 1;
    if (toIdx < 0 || toIdx >= agentIds.length) return;
    const toAgentId = agentIds[toIdx];
    setJaminAiDistribution(prev => {
      const fromLeads = [...(prev[fromAgentId] || [])].filter(l => l.id !== leadId);
      const movedLead = (prev[fromAgentId] || []).find(l => l.id === leadId);
      if (!movedLead) return prev;
      const toLeads = [...(prev[toAgentId] || []), movedLead];
      return { ...prev, [fromAgentId]: fromLeads, [toAgentId]: toLeads };
    });
  };

  const handleJaminAiConfirm = () => {
    let count = 0;
    const updated = leads.map(l => {
      for (const [agentId, agentLeads] of Object.entries(jaminAiDistribution)) {
        const found = agentLeads.find(al => al.id === l.id);
        if (found) {
          const agent = jaminAgents.find(a => a.id === agentId);
          count++;
          const u = {
            ...l,
            assignedAgentId: agentId,
            assignedAgentName: agent?.name || 'Agent',
          };
          storageService.saveLead(u);
          return u;
        }
      }
      return l;
    });

    setLeads(updated);
    storageService.addAuditLog({
      id: `aud-${Date.now()}`,
      timestamp: 'Just now',
      actorName: user?.name || 'Admin',
      actorEmail: user?.email || 'admin@jaminbazaar.com',
      action: 'LEADS_AUTO_ASSIGNED',
      entityType: 'Lead',
      entityId: `bulk-ai-${Date.now()}`,
      companyId: tenant?.id,
      companyName: tenant?.name,
      details: `AI Round-robin distributed ${count} lead(s) across ${jaminAgents.length} sales agents.`,
    });

    setIsJaminAiModalOpen(false);
    setSelectedJaminLeadIds(new Set());
    showToast(`✓ Successfully distributed ${count} lead(s) across ${jaminAgents.length} agents!`);
  };

  const handleJaminAutoRoundRobin = () => {
    const targetLeads = selectedJaminLeadIds.size > 0
      ? filteredLeads.filter(l => selectedJaminLeadIds.has(l.id))
      : filteredLeads;

    if (targetLeads.length === 0) {
      alert('No leads available to auto-assign.');
      return;
    }

    let agentIdx = 0;
    const updated = leads.map(l => {
      const match = targetLeads.find(t => t.id === l.id);
      if (match) {
        const agent = jaminAgents[agentIdx % jaminAgents.length];
        agentIdx++;
        const u = {
          ...l,
          assignedAgentId: agent.id,
          assignedAgentName: agent.name,
        };
        storageService.saveLead(u);
        return u;
      }
      return l;
    });

    setLeads(updated);
    storageService.addAuditLog({
      id: `aud-${Date.now()}`,
      timestamp: 'Just now',
      actorName: user?.name || 'Admin',
      actorEmail: user?.email || 'admin@jaminbazaar.com',
      action: 'LEADS_AUTO_ASSIGNED',
      entityType: 'Lead',
      entityId: `auto-${Date.now()}`,
      companyId: tenant?.id,
      companyName: tenant?.name,
      details: `Round-robin auto assigned ${targetLeads.length} lead(s) across ${jaminAgents.length} sales agents.`,
    });

    setSelectedJaminLeadIds(new Set());
    showToast(`⚡ Auto assigned ${targetLeads.length} lead(s) across ${jaminAgents.length} agents via Round-Robin!`);
  };

  const handleOpenJaminSchedule = (lead: Lead) => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const defDate = formatDateYMD(tomorrow);

    setScheduleDate(defDate);
    setScheduleTime('11:00');
    setScheduleType((lead.nextFollowupType as any) || 'call');
    setScheduleNotes('');
    setScheduleAgentId(lead.assignedAgentId || (jaminAgents[0]?.id || ''));
    setIsJaminScheduleModalOpen(true);
  };

  const setQuickDatePreset = (daysFromNow: number) => {
    const d = new Date();
    d.setDate(d.getDate() + daysFromNow);
    setScheduleDate(formatDateYMD(d));
  };

  const handleSaveJaminSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLead || !scheduleDate) return;

    const formattedFollowupString = `${scheduleDate}${scheduleTime ? ' ' + scheduleTime : ''}`;

    // 1. Update lead record
    const updatedLead: Lead = {
      ...selectedLead,
      nextFollowupDate: formattedFollowupString,
      nextFollowupType: scheduleType,
    };
    storageService.saveLead(updatedLead);
    setSelectedLead(updatedLead);
    setLeads(prev => prev.map(l => l.id === updatedLead.id ? updatedLead : l));

    // 2. Check for existing Pending follow-up for this lead to update/reschedule
    const allFollowups = storageService.getFollowups(tenant?.id || 't-jamin-02');
    const cleanLeadPhone = (selectedLead.phone || '').replace(/\D/g, '').slice(-10);
    const existingPending = allFollowups.find(
      f =>
        f.status === 'Pending' &&
        (f.contactId === selectedLead.id ||
          (cleanLeadPhone && (f.contactPhone || '').replace(/\D/g, '').slice(-10) === cleanLeadPhone))
    );

    const targetAgentId = scheduleAgentId || selectedLead.assignedAgentId || user?.id || 'usr-jamin-exec';
    const targetAgent = jaminAgents.find(a => a.id === targetAgentId) || {
      name:
        selectedLead.assignedAgentName && selectedLead.assignedAgentName !== 'Unassigned'
          ? selectedLead.assignedAgentName
          : (user?.name || 'Agent'),
    };

    const resolvedNotes =
      scheduleNotes ||
      (scheduleType === 'whatsapp'
        ? 'WhatsApp discussion on plot requirements'
        : scheduleType === 'meeting'
          ? 'Discussion meeting on property selection'
          : 'Phone call follow-up on property requirements');

    if (existingPending) {
      // Mark previous pending follow-up as Rescheduled
      storageService.saveFollowup({
        ...existingPending,
        status: 'Rescheduled',
      });
    }

    const newFollowup: Followup = {
      id: `fup-${Date.now()}`,
      companyId: tenant?.id || 't-jamin-02',
      contactId: selectedLead.id,
      contactName: selectedLead.name,
      contactPhone: selectedLead.phone,
      contactType: 'lead',
      scheduledAt: formattedFollowupString,
      scheduledDate: scheduleDate,
      scheduledTime: scheduleTime || '11:00 AM',
      priority: 'Medium',
      status: 'Pending',
      followupType: scheduleType as any,
      notes: resolvedNotes,
      assignedAgentId: targetAgentId,
      assignedAgentName: targetAgent.name,
      createdBy: user?.name || 'Admin',
    };
    storageService.saveFollowup(newFollowup);

    // 3. Add Audit log
    storageService.addAuditLog({
      id: `aud-${Date.now()}`,
      timestamp: 'Just now',
      actorName: user?.name || 'Agent',
      actorEmail: user?.email || 'agent@jaminbazaar.com',
      action: 'FOLLOWUP_SCHEDULED',
      entityType: 'Lead',
      entityId: selectedLead.id,
      companyId: tenant?.id,
      companyName: tenant?.name,
      details: `Scheduled ${scheduleType} follow-up for ${selectedLead.name} on ${formattedFollowupString}.`,
    });

    setIsJaminScheduleModalOpen(false);
    showToast(`✓ Follow-up scheduled for ${selectedLead.name} on ${scheduleDate}!`);
  };

  const leadSiteVisits = useMemo(() => {
    if (!selectedLead || !isJamin) return [];
    const visits = storageService.getSiteVisits(tenant?.id);
    const cleanPhone = (selectedLead.phone || '').replace(/\D/g, '').slice(-10);
    return visits.filter(
      v =>
        v.customerId === selectedLead.id ||
        v.leadId === selectedLead.id ||
        (cleanPhone && (v.customerPhone || '').replace(/\D/g, '').slice(-10) === cleanPhone)
    );
  }, [selectedLead, isJamin, tenant?.id]);

  const handleOpenLeadSiteVisitModal = (lead: Lead) => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    setLeadVisitProject('Greenfield Meadows Phase 2');
    setLeadVisitPlot('Plot #15');
    setLeadVisitDate(d.toISOString().split('T')[0]);
    setLeadVisitTimeSlot('11:00 AM');
    setLeadVisitNotes('');
    setLeadVisitHostAgent(
      lead.assignedAgentName && lead.assignedAgentName !== 'Unassigned'
        ? lead.assignedAgentName
        : (user?.name || 'Pooja Hegde')
    );
    setIsLeadSiteVisitModalOpen(true);
  };

  const handleSaveLeadSiteVisit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLead) return;

    const hostAg = jaminAgents.find(a => a.name === leadVisitHostAgent);

    const dateFormatted = (() => {
      try {
        const [y, m, d] = leadVisitDate.split('-');
        const dateObj = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
        return `${dateObj.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })} • ${leadVisitTimeSlot}`;
      } catch {
        return `${leadVisitDate} • ${leadVisitTimeSlot}`;
      }
    })();

    const newVisit: SiteVisit = {
      id: `sv-${Date.now()}`,
      companyId: tenant?.id || 't-jamin-02',
      customerId: selectedLead.id,
      customerName: selectedLead.name,
      customerPhone: selectedLead.phone,
      contactType: 'lead',
      leadId: selectedLead.id,
      projectId: 'proj-01',
      projectName: leadVisitProject,
      plotNumber: leadVisitPlot,
      scheduledAt: dateFormatted,
      assignedAgentId: hostAg?.id || selectedLead.assignedAgentId || user?.id || 'usr-jamin-exec',
      assignedAgentName: leadVisitHostAgent || 'Pooja Hegde',
      status: 'Scheduled',
      outcomeNotes: leadVisitNotes,
    };

    storageService.saveSiteVisit(newVisit);

    storageService.addAuditLog({
      id: `aud-${Date.now()}`,
      timestamp: 'Just now',
      actorName: user?.name || 'Agent',
      actorEmail: user?.email || 'agent@jamin.com',
      action: 'SITE_VISIT_SCHEDULED',
      entityType: 'SiteVisit',
      entityId: newVisit.id,
      companyId: tenant?.id,
      companyName: tenant?.name,
      details: `Scheduled site visit for LEAD: ${selectedLead.name} at ${leadVisitProject} (${leadVisitPlot}).`,
    });

    setIsLeadSiteVisitModalOpen(false);
    showToast(`✓ Site visit scheduled for ${selectedLead.name}!`);
  };

  const handleManualAssignConfirm = () => {
    if (!assignSelectedAgent) return;
    const newAssigned = new Set(assignedLeadIds);
    const newRecords: Array<{ leadId: string; leadName: string; agentId: number; agentName: string; assignedAt: string }> = [];
    selectedLeadIds.forEach(id => {
      newAssigned.add(id);
      const lead = leads.find(l => l.id === id);
      newRecords.push({
        leadId: id,
        leadName: lead?.name || 'Unknown Lead',
        agentId: assignSelectedAgent.id,
        agentName: assignSelectedAgent.name,
        assignedAt: new Date().toISOString(),
      });
    });
    setAssignedLeadIds(newAssigned);
    setAgentAssignments(prev => {
      const updated = [...prev, ...newRecords];
      try { sessionStorage.setItem('ghl_mock_agent_assignments', JSON.stringify(updated)); } catch { }
      (window as any).__ghlAssignments = updated;
      return updated;
    });
    console.log('[GHL Admin Leads Assignment - Manual]', newRecords);
    const count = selectedLeadIds.size;
    setSelectedLeadIds(new Set());
    setIsAssignModalOpen(false);
    setAssignStep('pick-agent');
    setAssignSelectedAgent(null);
    showToast(`✓ ${count} lead${count !== 1 ? 's' : ''} assigned to ${assignSelectedAgent.name}`);
  };

  const handleOpenAiSuggestion = () => {
    const pool = filteredLeads;
    const dist: Record<number, Lead[]> = {};
    MOCK_AGENTS.forEach(a => { dist[a.id] = []; });
    pool.forEach((lead, i) => {
      const agent = MOCK_AGENTS[i % MOCK_AGENTS.length];
      dist[agent.id].push(lead);
    });
    setAiDistribution(dist);
    setIsAiEditMode(false);
    setIsAiModalOpen(true);
  };

  const handleAiMoveLead = (leadId: string, fromAgentId: number, direction: 'left' | 'right') => {
    const agentIds = MOCK_AGENTS.map(a => a.id);
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

  const handleAiConfirm = () => {
    const newAssigned = new Set(assignedLeadIds);
    const newRecords: Array<{ leadId: string; leadName: string; agentId: number; agentName: string; assignedAt: string }> = [];
    let count = 0;
    Object.entries(aiDistribution).forEach(([agentIdStr, agentLeads]) => {
      const agentId = Number(agentIdStr);
      const agent = MOCK_AGENTS.find(a => a.id === agentId);
      agentLeads.forEach(l => {
        newAssigned.add(l.id);
        count++;
        newRecords.push({
          leadId: l.id,
          leadName: l.name,
          agentId,
          agentName: agent?.name || 'Agent',
          assignedAt: new Date().toISOString(),
        });
      });
    });
    setAssignedLeadIds(newAssigned);
    setAgentAssignments(prev => {
      const updated = [...prev, ...newRecords];
      try { sessionStorage.setItem('ghl_mock_agent_assignments', JSON.stringify(updated)); } catch { }
      (window as any).__ghlAssignments = updated;
      return updated;
    });
    console.log('[GHL Admin Leads Assignment - AI Round Robin]', newRecords);
    setIsAiModalOpen(false);
    showToast(`✓ ${count} lead${count !== 1 ? 's' : ''} assigned via AI Suggestion`);
  };

  const handleOpenCreate = () => {
    if (!user) {
      console.warn('[LeadsPage] Cannot create lead: user session is not yet loaded.');
      return;
    }
    const defaultAgentId = (isJamin && canJaminAssign)
      ? ''
      : (user.id || (tenant?.slug === 'jamin' ? 'usr-jamin-exec' : 'usr-ghl-exec'));
    const defaultAgentName = (isJamin && canJaminAssign)
      ? 'Unassigned'
      : (user.name || (tenant?.slug === 'jamin' ? 'Pooja Hegde' : 'Ananya Iyer'));

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
        ? {}
        : { investmentCapacity: '', assetClass: 'AIF', preferredAssetClass: 'AIF', horizon: '3-5 Years' },
    });
    setIsEditDrawerOpen(true);
  };

  const handleOpenEdit = (lead: Lead) => {
    setFormData({ ...lead });
    setIsEditDrawerOpen(true);
  };

  const handleSaveLead = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.phone) return;

    // Pull real agent ID and name at save-time to prevent stale/fallback placeholder IDs from leaking
    const isJaminUser = tenant?.slug === 'jamin' || tenant?.id === 't-jamin-02';
    const isJaminUnassigned = isJaminUser && (!formData.assignedAgentId || formData.assignedAgentId === 'unassigned');

    const resolvedAgentId = isJaminUnassigned
      ? ''
      : (isLeadScopedUser && user?.id)
        ? user.id
        : (formData.assignedAgentId && formData.assignedAgentId !== 'usr-exec' ? formData.assignedAgentId : (user?.id || 'usr-exec'));
    const resolvedAgentName = isJaminUnassigned
      ? 'Unassigned'
      : (isLeadScopedUser && user?.name)
        ? user.name
        : (formData.assignedAgentName && formData.assignedAgentName !== 'Agent' ? formData.assignedAgentName : (user?.name || 'Agent'));

    const isExistingById = leads.some(l => l.id === formData.id);
    const targetCompanyId = formData.companyId || tenant?.id || 't-ghl-01';

    let leadToSave: Lead;
    let isUpdated = isExistingById;

    if (!isExistingById) {
      const existingMatch = storageService.findLeadByPhone(formData.phone, targetCompanyId);
      if (existingMatch) {
        isUpdated = true;
        leadToSave = {
          ...existingMatch,
          ...formData,
          id: existingMatch.id, // Preserve existing ID
          companyId: existingMatch.companyId || targetCompanyId,
          status: formData.status || existingMatch.status || 'New',
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
          status: formData.status || 'New',
          assignedAgentId: resolvedAgentId,
          assignedAgentName: resolvedAgentName,
          companyId: targetCompanyId,
          createdAt: formData.createdAt || new Date().toISOString().split('T')[0],
        } as Lead;
      }
    } else {
      leadToSave = {
        ...formData,
        status: formData.status || 'New',
        assignedAgentId: resolvedAgentId,
        assignedAgentName: resolvedAgentName,
        companyId: targetCompanyId,
      } as Lead;
    }

    storageService.saveLead(leadToSave);

    storageService.addAuditLog({
      id: `aud-${Date.now()}`,
      timestamp: 'Just now',
      actorName: user?.name || resolvedAgentName,
      actorEmail: user?.email || 'agent@nexus.io',
      action: isUpdated ? 'LEAD_UPDATED' : 'LEAD_CREATED',
      entityType: 'Lead',
      entityId: leadToSave.id,
      companyId: tenant?.id,
      companyName: tenant?.name,
      details: `Lead record ${leadToSave.name} (${leadToSave.phone}) saved.`,
    });

    setIsEditDrawerOpen(false);
  };

  const handleDeleteLead = (lead: Lead) => {
    if (confirm(`Delete lead ${lead.name}?`)) {
      storageService.deleteLead(lead.id);
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

      const newLead: Lead = {
        id: `lead-${Date.now()}-${index}`,
        companyId,
        name: nameVal,
        phone: phoneVal,
        email: emailVal,
        location: locationVal,
        source: sourceVal,
        priority: priorityVal as any,
        status: 'New',
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
      ),
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
    ...(canJaminAssign && jaminAssignMode === 'manual' ? [{
      key: 'jamin-select',
      header: (
        <input
          type="checkbox"
          className="assign-checkbox jamin-checkbox"
          checked={filteredLeads.length > 0 && filteredLeads.every(l => selectedJaminLeadIds.has(l.id))}
          onChange={e => {
            if (e.target.checked) setSelectedJaminLeadIds(new Set(filteredLeads.map(l => l.id)));
            else setSelectedJaminLeadIds(new Set());
          }}
        />
      ),
      width: '40px',
      align: 'center' as const,
      className: 'col-select',
      render: (l: Lead) => (
        <input
          type="checkbox"
          className="assign-checkbox jamin-checkbox"
          checked={selectedJaminLeadIds.has(l.id)}
          onChange={e => {
            e.stopPropagation();
            setSelectedJaminLeadIds(prev => {
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
      header: (
        <div style={{ lineHeight: '1.15', textAlign: 'center', fontSize: '11px', fontWeight: 600 }}>
          <div>Quick</div>
          <div>Call</div>
        </div>
      ),
      width: '56px',
      align: 'center',
      className: 'col-quick-call',
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
              showLabel={!isJamin}
              hideItemLabels={isJamin}
              filters={[
                ...(isGhlAdmin ? [] : [{
                  key: 'status',
                  label: 'Status',
                  allLabel: isJamin ? 'All Statuses' : 'All',
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
                  allLabel: isJamin ? 'All Agents' : 'All',
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
                label: isJamin ? '' : 'Date Range',
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
                setDatePreset('all');
                setDateFrom('');
                setDateTo('');
              }}
            />
            {canJaminAssign && (
              <div className="assign-toggle">
                <span className="assign-toggle-label">Assign:</span>
                <div className="assign-toggle-group">
                  <button
                    type="button"
                    className={`assign-toggle-btn${jaminAssignMode === 'manual' ? ' active' : ''}`}
                    onClick={() => {
                      setJaminAssignMode(prev => prev === 'manual' ? 'none' : 'manual');
                      setSelectedJaminLeadIds(new Set());
                    }}
                    title="Manual lead assignment"
                  >
                    Manual
                  </button>
                  <button
                    type="button"
                    className={`assign-toggle-btn${jaminAssignMode === 'auto' ? ' active' : ''}`}
                    onClick={() => {
                      setJaminAssignMode(prev => prev === 'auto' ? 'none' : 'auto');
                      setSelectedJaminLeadIds(new Set());
                    }}
                    title="Automated round-robin lead assignment"
                  >
                    Auto
                  </button>
                </div>
                {jaminAssignMode === 'auto' && (
                  <div className="assign-auto-bar">
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={handleOpenJaminAiSuggestion}
                    >
                      ✦ AI Suggestion
                    </button>
                    <div style={{ position: 'relative', display: 'inline-flex' }}>
                      <button
                        type="button"
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
                  Assigned to <strong>{selectedLead.assignedAgentName}</strong>
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px', flexWrap: 'wrap' }}>
                      <div className="lead-detail-value lead-followup-text has-date" style={{ margin: 0 }}>
                        {selectedLead.nextFollowupDate ? (
                          <span>
                            {selectedLead.nextFollowupType && (
                              <span style={{ marginRight: '6px', fontWeight: 600 }}>
                                {selectedLead.nextFollowupType === 'call' && 'Phone Call'}
                                {selectedLead.nextFollowupType === 'whatsapp' && 'WhatsApp'}
                                {selectedLead.nextFollowupType === 'meeting' && 'Meeting'}
                                {!['call', 'whatsapp', 'meeting'].includes(selectedLead.nextFollowupType) && selectedLead.nextFollowupType}
                                {' •'}
                              </span>
                            )}
                            {selectedLead.nextFollowupDate}
                          </span>
                        ) : (
                          'Not scheduled'
                        )}
                      </div>
                      {isJamin && (
                        <button
                          type="button"
                          className="btn btn-sm"
                          onClick={() => handleOpenJaminSchedule(selectedLead)}
                          style={{
                            padding: '2px 8px',
                            fontSize: '11px',
                            fontWeight: 600,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            borderRadius: '4px',
                            border: '1px solid #dc2626',
                            background: '#fef2f2',
                            color: '#dc2626',
                            cursor: 'pointer',
                          }}
                        >
                          <Calendar size={12} /> {selectedLead.nextFollowupDate ? 'Reschedule' : 'Schedule'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Jamin Bazaar: Linked Site Visits */}
              {isJamin && (
                <div className="card lead-detail-card" style={{ marginTop: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <h4 className="lead-detail-title" style={{ margin: 0 }}>
                      Site Visits ({leadSiteVisits.length})
                    </h4>
                    <button
                      type="button"
                      className="btn btn-sm btn-secondary"
                      onClick={() => handleOpenLeadSiteVisitModal(selectedLead)}
                      style={{ fontSize: '11px', padding: '3px 9px', color: '#dc2626', borderColor: '#fca5a5' }}
                    >
                      + Book Site Visit
                    </button>
                  </div>
                  {leadSiteVisits.length === 0 ? (
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', padding: '6px 0' }}>
                      No site visits booked for this lead yet.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {leadSiteVisits.map(sv => (
                        <div
                          key={sv.id}
                          style={{
                            padding: '10px 12px',
                            borderRadius: 6,
                            background: 'var(--bg-card-subtle, #f9fafb)',
                            border: '1px solid var(--border-base)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: 600, fontSize: '13px' }}>
                              {sv.projectName} — <span style={{ color: '#dc2626' }}>{sv.plotNumber || 'General Tour'}</span>
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: 2 }}>
                              Slot: <strong>{sv.scheduledAt}</strong> • Host: {sv.assignedAgentName}
                            </div>
                            {sv.outcomeNotes && (
                              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: 3, fontStyle: 'italic' }}>
                                "{sv.outcomeNotes}"
                              </div>
                            )}
                          </div>
                          <StatusChip status={sv.status} size="sm" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

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
                        } catch { }
                        return false;
                      })()
                    ) && (() => {
                      const localData = (() => {
                        try {
                          const raw = localStorage.getItem(`nexus_irm_pref_${selectedLead.id}`) ||
                            localStorage.getItem(`nexus_irm_pref_${(selectedLead.phone || '').replace(/\D/g, '').slice(-10)}`);
                          if (raw) return JSON.parse(raw);
                        } catch { }
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
              placeholder="e.g. Ramesh Chandra"
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
                placeholder="ramesh@example.com"
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

          {/* Jamin Bazaar: Assigned Sales Agent */}
          {isJamin && (
            <div className="form-group">
              <label className="form-label">
                Assigned Sales Agent <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: '12px' }}></span>
              </label>
              {canJaminAssign ? (
                <select
                  className="form-select"
                  value={formData.assignedAgentId || ''}
                  onChange={e => {
                    const val = e.target.value;
                    if (!val) {
                      setFormData(prev => ({
                        ...prev,
                        assignedAgentId: '',
                        assignedAgentName: 'Unassigned',
                      }));
                    } else {
                      const agent = jaminAgents.find(a => a.id === val);
                      setFormData(prev => ({
                        ...prev,
                        assignedAgentId: val,
                        assignedAgentName: agent?.name || 'Agent',
                      }));
                    }
                  }}
                >
                  <option value="">-- Unassigned--</option>
                  {jaminAgents.map(ag => (
                    <option key={ag.id} value={ag.id}>
                      {ag.name} ({ag.email})
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  className="form-input"
                  disabled
                  value={formData.assignedAgentName || (formData.assignedAgentId ? 'Agent' : 'Unassigned')}
                  style={{ background: 'var(--bg-card-subtle, #f9fafb)', cursor: 'not-allowed', color: 'var(--text-muted)' }}
                />
              )}
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

      {/* ── Jamin: Manual selection action bar ──────────────────────────── */}
      {canJaminAssign && jaminAssignMode === 'manual' && selectedJaminLeadIds.size > 0 && (
        <div className="assign-action-bar">
          <span className="assign-action-bar-text">
            {selectedJaminLeadIds.size} lead{selectedJaminLeadIds.size !== 1 ? 's' : ''} selected
          </span>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setSelectedJaminLeadIds(new Set())}
          >
            Clear
          </button>
          <button
            className="btn btn-primary"
            onClick={() => {
              setJaminSelectedAgent(null);
              setIsJaminAssignModalOpen(true);
            }}
          >
            Assign {selectedJaminLeadIds.size} Lead{selectedJaminLeadIds.size !== 1 ? 's' : ''} →
          </button>
        </div>
      )}

      {/* ── Jamin: Assign Agent Modal ────────────────────────────────────── */}
      {isJaminAssignModalOpen && (
        <div className="assign-modal-overlay" onClick={() => setIsJaminAssignModalOpen(false)}>
          <div className="assign-modal" onClick={e => e.stopPropagation()}>
            <div className="assign-modal-header">
              <h3 className="assign-modal-title">Assign Leads to Sales Agent</h3>
              <button className="assign-modal-close" onClick={() => setIsJaminAssignModalOpen(false)}>✕</button>
            </div>
            <p className="assign-modal-sub">
              Select an agent to assign the {selectedJaminLeadIds.size} selected lead{selectedJaminLeadIds.size !== 1 ? 's' : ''} to:
            </p>
            <div className="assign-agent-list">
              {jaminAgents.map(agent => (
                <label
                  key={agent.id}
                  className={`assign-agent-row${jaminSelectedAgent?.id === agent.id ? ' selected' : ''}`}
                >
                  <input
                    type="radio"
                    name="jaminAssignAgent"
                    value={agent.id}
                    checked={jaminSelectedAgent?.id === agent.id}
                    onChange={() => setJaminSelectedAgent(agent)}
                  />
                  <div className="assign-agent-avatar">
                    {agent.name[0]}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span className="assign-agent-name">{agent.name}</span>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{agent.email}</span>
                  </div>
                </label>
              ))}
            </div>
            <div className="assign-modal-footer">
              <button className="btn btn-secondary" onClick={() => setIsJaminAssignModalOpen(false)}>Cancel</button>
              <button
                className="btn btn-primary"
                disabled={!jaminSelectedAgent}
                onClick={handleJaminManualAssignConfirm}
              >
                Confirm Assignment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Jamin: AI Distribution Modal ────────────────────────────────── */}
      {isJaminAiModalOpen && (
        <div className="assign-modal-overlay" onClick={() => setIsJaminAiModalOpen(false)}>
          <div className="ai-dist-modal" onClick={e => e.stopPropagation()}>
            <div className="assign-modal-header">
              <div>
                <h3 className="assign-modal-title">✦ AI Suggestion — Round Robin</h3>
                <p className="assign-modal-sub" style={{ margin: '2px 0 0' }}>
                  {Object.values(jaminAiDistribution).flat().length} leads distributed across {jaminAgents.length} agents
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  className={`btn btn-sm ${isJaminAiEditMode ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setIsJaminAiEditMode(e => !e)}
                >
                  {isAiEditMode || isJaminAiEditMode ? '✓ Done Editing' : '✎ Edit'}
                </button>
                <button className="assign-modal-close" onClick={() => setIsJaminAiModalOpen(false)}>✕</button>
              </div>
            </div>

            <div className="ai-dist-grid">
              {jaminAgents.map((agent, agentIdx) => {
                const agentLeads = jaminAiDistribution[agent.id] || [];
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
                            {isJaminAiEditMode && (
                              <div className="ai-dist-move-btns">
                                <button
                                  className="ai-move-btn"
                                  disabled={agentIdx === 0}
                                  onClick={() => handleJaminAiMoveLead(lead.id, agent.id, 'left')}
                                  title="Move left"
                                >◀</button>
                                <button
                                  className="ai-move-btn"
                                  disabled={agentIdx === jaminAgents.length - 1}
                                  onClick={() => handleJaminAiMoveLead(lead.id, agent.id, 'right')}
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
              <button className="btn btn-secondary" onClick={() => setIsJaminAiModalOpen(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleJaminAiConfirm}>
                Confirm Distribution
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Jamin: Quick Schedule Follow-up Modal ──────────────────────── */}
      {isJamin && (
        <Modal
          isOpen={isJaminScheduleModalOpen && !!selectedLead}
          onClose={() => setIsJaminScheduleModalOpen(false)}
          title={`Schedule Follow-up: ${selectedLead?.name || ''}`}
        >
          <form onSubmit={handleSaveJaminSchedule} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: -6 }}>
              Contact: <strong>{selectedLead?.phone}</strong>
              {selectedLead?.assignedAgentName && selectedLead.assignedAgentName !== 'Unassigned' && (
                <span> • Assigned to <strong>{selectedLead.assignedAgentName}</strong></span>
              )}
            </div>

            {/* Quick Presets */}
            <div>
              <label className="form-label" style={{ marginBottom: 6 }}>Quick Date Presets</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setQuickDatePreset(1)}
                  style={{ fontSize: '12px', padding: '4px 10px' }}
                >
                  Tomorrow
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setQuickDatePreset(2)}
                  style={{ fontSize: '12px', padding: '4px 10px' }}
                >
                  In 2 Days
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setQuickDatePreset(7)}
                  style={{ fontSize: '12px', padding: '4px 10px' }}
                >
                  In 1 Week
                </button>
              </div>
            </div>

            {/* Date & Time Grid */}
            <div className="lead-form-grid-2">
              <div className="form-group">
                <label className="form-label">Follow-up Date *</label>
                <input
                  type="date"
                  className="form-input"
                  required
                  value={scheduleDate}
                  min={formatDateYMD(new Date())}
                  onChange={e => setScheduleDate(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Follow-up Time</label>
                <input
                  type="time"
                  className="form-input"
                  value={scheduleTime}
                  onChange={e => setScheduleTime(e.target.value)}
                />
              </div>
            </div>

            {/* Follow-up Type */}
            <div className="form-group">
              <label className="form-label">Activity Type</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                {[
                  { id: 'call', label: 'Phone Call' },
                  { id: 'whatsapp', label: 'WhatsApp' },
                  { id: 'meeting', label: 'Meeting' },
                ].map(t => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setScheduleType(t.id as any)}
                    style={{
                      padding: '8px 4px',
                      fontSize: '12px',
                      borderRadius: '6px',
                      border: scheduleType === t.id ? '2px solid #dc2626' : '1px solid var(--border-base)',
                      background: scheduleType === t.id ? '#fef2f2' : 'var(--bg-card)',
                      color: scheduleType === t.id ? '#dc2626' : 'var(--text-primary)',
                      fontWeight: scheduleType === t.id ? 600 : 400,
                      cursor: 'pointer',
                      textAlign: 'center',
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Assigned Executive */}
            {canJaminAssign && (
              <div className="form-group">
                <label className="form-label">Assigned Executive</label>
                <select
                  className="form-select"
                  value={scheduleAgentId}
                  onChange={e => setScheduleAgentId(e.target.value)}
                >
                  {jaminAgents.map(ag => (
                    <option key={ag.id} value={ag.id}>
                      {ag.name} ({ag.email})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Notes */}
            <div className="form-group">
              <label className="form-label">Follow-up Notes</label>
              <textarea
                className="form-textarea"
                rows={2}
                value={scheduleNotes}
                onChange={e => setScheduleNotes(e.target.value)}
                placeholder="e.g. Call client regarding plot availability..."
              />
            </div>

            {/* Modal Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setIsJaminScheduleModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                style={{
                  background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
                  borderColor: '#dc2626',
                  color: '#ffffff',
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Calendar size={14} /> Confirm Follow-up
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Jamin: Book Site Visit for Lead Modal ──────────────────────── */}
      {isJamin && (
        <Modal
          isOpen={isLeadSiteVisitModalOpen && !!selectedLead}
          onClose={() => setIsLeadSiteVisitModalOpen(false)}
          title={`Schedule Site Visit: ${selectedLead?.name || ''}`}
          subtitle={`Book layout walkthrough for ${selectedLead?.phone}`}
        >
          <form onSubmit={handleSaveLeadSiteVisit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="sitevisit-form-grid-2">
              <div className="form-group">
                <label className="form-label">Client Name</label>
                <input
                  type="text"
                  className="form-input"
                  disabled
                  value={selectedLead?.name || ''}
                  style={{ background: 'var(--bg-card-subtle, #f9fafb)', cursor: 'not-allowed' }}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Mobile Number</label>
                <input
                  type="text"
                  className="form-input"
                  disabled
                  value={selectedLead?.phone || ''}
                  style={{ background: 'var(--bg-card-subtle, #f9fafb)', cursor: 'not-allowed' }}
                />
              </div>
            </div>

            <div className="sitevisit-form-grid-2">
              <div className="form-group">
                <label className="form-label">Visit Date *</label>
                <input
                  type="date"
                  className="form-input"
                  required
                  min={new Date().toISOString().split('T')[0]}
                  value={leadVisitDate}
                  onChange={e => setLeadVisitDate(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Time Slot *</label>
                <select
                  className="form-select"
                  required
                  value={leadVisitTimeSlot}
                  onChange={e => setLeadVisitTimeSlot(e.target.value)}
                >
                  <option value="09:30 AM">09:30 AM (Morning Tour)</option>
                  <option value="11:00 AM">11:00 AM (Mid-Day Walkthrough)</option>
                  <option value="02:00 PM">02:00 PM (Afternoon Tour)</option>
                  <option value="03:30 PM">03:30 PM (Late Afternoon Slot)</option>
                  <option value="05:00 PM">05:00 PM (Sunset Inspection)</option>
                </select>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Host Escort Agent</label>
              <select
                className="form-select"
                value={leadVisitHostAgent}
                onChange={e => setLeadVisitHostAgent(e.target.value)}
              >
                {jaminAgents.map(ag => (
                  <option key={ag.id} value={ag.name}>
                    {ag.name} ({ag.email})
                  </option>
                ))}
              </select>
            </div>

            <div className="sitevisit-form-grid-2">
              <div className="form-group">
                <label className="form-label">Project</label>
                <select
                  className="form-select"
                  value={leadVisitProject}
                  onChange={e => setLeadVisitProject(e.target.value)}
                >
                  <option value="Greenfield Meadows Phase 2">Greenfield Meadows Phase 2</option>
                  <option value="Valley Crest Country Estates">Valley Crest Country Estates</option>
                  <option value="Emerald Orchid Enclave">Emerald Orchid Enclave</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Plot Number Target</label>
                <input
                  type="text"
                  className="form-input"
                  value={leadVisitPlot}
                  onChange={e => setLeadVisitPlot(e.target.value)}
                  placeholder="e.g. Plot #15"
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Logistics / Pickup Notes</label>
              <textarea
                className="form-textarea"
                rows={2}
                value={leadVisitNotes}
                onChange={e => setLeadVisitNotes(e.target.value)}
                placeholder="e.g. Metro pickup required, visiting with family..."
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setIsLeadSiteVisitModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                style={{
                  background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
                  borderColor: '#dc2626',
                  color: '#ffffff',
                  fontWeight: 600,
                }}
              >
                Confirm Site Visit
              </button>
            </div>
          </form>
        </Modal>
      )}

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
                  {MOCK_AGENTS.map(agent => (
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
                  {Object.values(aiDistribution).flat().length} leads distributed across {MOCK_AGENTS.length} agents
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
              {MOCK_AGENTS.map((agent, agentIdx) => {
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
                                  disabled={agentIdx === MOCK_AGENTS.length - 1}
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

      {/* ── Toast notification ───────────────────────────────────────────── */}
      {toast && (
        <div className="assign-toast">
          {toast}
        </div>
      )}
    </div>
  );
};
