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
  History,
  User as UserIcon,
  UserPlus,
  Clock,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { Lead, Customer, Deal, Followup, SiteVisit } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useCall } from '../../context/CallContext';
import { apiClient } from '../../services/apiClient';
import { jaminApiService } from '../../services/jaminApiService';
import { getFollowups as apiGetFollowups, saveFollowup as apiSaveFollowup } from '../../services/ghlApiService';
import { adminUserService } from '../../services/adminUserService';
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

interface LeadsPageProps {
  onNavigate?: (route: string) => void;
}

export const LeadsPage: React.FC<LeadsPageProps> = ({ onNavigate }) => {
  const { tenant, user } = useAuth();
  const { initiateCall } = useCall();

  const handleNavigate = (route: string) => {
    if (onNavigate) {
      onNavigate(route);
    } else {
      sessionStorage.setItem('nexus_current_route', route);
      const targetUrl = route === 'dashboard' ? '/' : `/${route}`;
      window.history.pushState({ route }, '', targetUrl);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  };

  const isJamin = tenant?.slug === 'jamin' || tenant?.id === 't-jamin-02' || tenant?.id === '2' || !tenant;
  const isJaminUser = isJamin;
  const [leads, setLeads] = useState<Lead[]>([]);

  // Role-based scoping: Sales Executives and IRMs see their assigned leads.
  // Managers / Admins / Super Admins see the full company lead list.
  const roleCode = user?.role?.code;
  const isAdmin = roleCode === 'company_admin' || roleCode === 'super_admin' || (roleCode as string) === 'admin';
  const isExec = roleCode === 'sales_executive';
  const isLeadScopedUser = roleCode === 'sales_executive' || roleCode === 'irm';
  const isIrm = roleCode === 'irm';
  const scopedLeads = isLeadScopedUser
    ? leads.filter(l =>
      (l.assignedAgentId && (l.assignedAgentId === user?.id || String(l.assignedAgentId) === String(user?.id))) ||
      (l.assignedAgentName && user?.name && l.assignedAgentName.toLowerCase() === user.name.toLowerCase())
    )
    : leads;
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isDetailDrawerOpen, setIsDetailDrawerOpen] = useState(false);
  const [isEditDrawerOpen, setIsEditDrawerOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isConvertModalOpen, setIsConvertModalOpen] = useState(false);
  const [drawerActiveTab, setDrawerActiveTab] = useState<'contact' | 'followups' | 'site_visits' | 'calls' | 'activity'>('contact');

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
  const [sourceFilter, setSourceFilter] = useState('All');
  const [capacityFilter, setCapacityFilter] = useState('All');
  const [agentFilter, setAgentFilter] = useState('All');
  const [datePreset, setDatePreset] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  const [jaminAgents, setJaminAgents] = useState<Array<{ id: string; name: string; email: string }>>([]);
  const [apiAgents, setApiAgents] = useState<Array<{ id: string; name: string; email: string }>>([]);
  const [jaminApiProjects, setJaminApiProjects] = useState<Array<{ id: string; name: string }>>([]);
  const [apiSiteVisits, setApiSiteVisits] = useState<SiteVisit[]>([]);
  const [apiFollowups, setApiFollowups] = useState<Followup[]>([]);

  const agentOptions = useMemo(() => {
    const list = isJamin ? jaminAgents : apiAgents;
    return list
      .filter(a => Boolean(a.name))
      .map(a => ({ value: a.name, label: a.name }));
  }, [isJamin, jaminAgents, apiAgents]);

  const JAMIN_SOURCES = [
    'Website Inbound',
    'Google Search',
    'Facebook / Instagram',
    'Referral - HNW',
    'Walk-in Site Office',
  ];

  const GHL_SOURCES = [
    'Website Inbound',
    'Phone Call',
    'Referral',
    'LinkedIn',
    'Email Campaign',
    'WhatsApp',
    'Walk-in',
    'Webinar',
    'Google Ad',
    'Facebook Ad',
    'Partner Referral',
  ];

  const sourceOptions = useMemo(() => {
    const isJaminTenant = tenant?.slug === 'jamin' || tenant?.id === 't-jamin-02' || String(tenant?.id) === '2';
    const predefined = isJaminTenant ? JAMIN_SOURCES : GHL_SOURCES;
    // Merge predefined list with any sources actually in leads data (case-normalized)
    const seen = new Map<string, string>();
    predefined.forEach(src => seen.set(src.toLowerCase(), src));
    scopedLeads.forEach(l => {
      if (l.source) {
        const key = l.source.trim().toLowerCase();
        if (!seen.has(key)) seen.set(key, l.source.trim());
      }
    });
    return Array.from(seen.values())
      .sort()
      .map(src => ({ value: src, label: src }));
  }, [scopedLeads, tenant?.slug, tenant?.id]);

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
  const canJaminAssign =
    isJamin &&
    (['company_admin', 'admin', 'super_admin', 'sales_manager', 'manager'].includes(String(roleCode)));
  const [jaminAssignMode, setJaminAssignMode] = useState<'none' | 'manual' | 'auto'>('none');
  const [selectedJaminLeadIds, setSelectedJaminLeadIds] = useState<Set<string>>(new Set());
  const [isJaminAssignModalOpen, setIsJaminAssignModalOpen] = useState(false);
  const [jaminSelectedAgent, setJaminSelectedAgent] = useState<{ id: string; name: string; email: string } | null>(null);
  const [isJaminAiModalOpen, setIsJaminAiModalOpen] = useState(false);
  const [jaminAiDistribution, setJaminAiDistribution] = useState<Record<string, Lead[]>>({});
  const [isJaminAiEditMode, setIsJaminAiEditMode] = useState(false);

  useEffect(() => {
    if (isJamin) {
      jaminApiService.getAgents().then(data => {
        if (data && data.length > 0) {
          const valid = data.map(a => ({
            id: String(a.id),
            name: a.name,
            email: a.email,
          }));
          setJaminAgents(valid);
          setApiAgents(valid);
        }
      }).catch(err => console.warn('Failed to load Jamin agents:', err));

      jaminApiService.getProjects().then(data => {
        if (data && data.length > 0) {
          setJaminApiProjects(data.map((p: any) => ({
            id: String(p.id),
            name: p.name,
          })));
        }
      }).catch(err => console.warn('Failed to load Jamin projects:', err));

      const fetchJaminActivities = () => {
        jaminApiService.getSiteVisits(true).then(visits => {
          if (visits && visits.length > 0) {
            setApiSiteVisits(visits);
          }
        }).catch(err => console.warn('Failed to load Jamin site visits in Leads:', err));

        jaminApiService.getFollowups(true).then(fws => {
          if (fws) {
            setApiFollowups(fws);
          }
        }).catch(err => console.warn('Failed to load Jamin followups in Leads:', err));
      };
      fetchJaminActivities();
      window.addEventListener('nexus_storage_updated', fetchJaminActivities);
      return () => {
        window.removeEventListener('nexus_storage_updated', fetchJaminActivities);
      };
    } else {
      const fetchGhlActivities = () => {
        apiGetFollowups(tenant?.id).then(fws => {
          if (fws) {
            setApiFollowups(fws);
          }
        }).catch(err => console.warn('Failed to load GHL followups in Leads:', err));
      };
      fetchGhlActivities();
      window.addEventListener('nexus_storage_updated', fetchGhlActivities);

      adminUserService.getUsers(tenant?.id || '1').then(users => {
        if (users && users.length > 0) {
          const valid = users
            .filter(u => u.role?.code === 'sales_executive' || u.role?.code === 'sales_manager' || u.role?.code === 'irm')
            .map(u => ({
              id: String(u.id),
              name: u.name,
              email: u.email,
            }));
          setApiAgents(valid);
        }
      }).catch(err => console.warn('Failed to load GHL agents:', err));

      return () => {
        window.removeEventListener('nexus_storage_updated', fetchGhlActivities);
      };
    }
  }, [isJamin, tenant?.id]);

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
  const [leadVisitHostAgent, setLeadVisitHostAgent] = useState('');

  // GHL Admin assign-mode state
  const isGhlAdmin =
    (tenant?.slug === 'ghl' || tenant?.id === 't-ghl-01') &&
    (roleCode === 'company_admin' || (roleCode as string) === 'admin' || roleCode === 'super_admin');
  const [assignMode, setAssignMode] = useState<'manual' | 'auto'>('manual');
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(new Set());
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [assignStep, setAssignStep] = useState<'pick-agent' | 'confirm'>('pick-agent');
  const [assignSelectedAgent, setAssignSelectedAgent] = useState<{ id: string | number; name: string; email?: string } | null>(null);
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

  const loadData = async () => {
    let updated: Lead[] = [];
    const isJamin = tenant?.slug === 'jamin' || tenant?.id === 't-jamin-02' || String(tenant?.id) === '2';
    const effectiveCompanyId = isJamin ? 2 : 1;

    try {
      if (isJamin) {
        const liveLeads = await jaminApiService.getLeads(true);
        const convertedLeads = await jaminApiService.getLeads(true, undefined, 'Converted');
        const localLeads = storageService.getLeads(tenant?.id) || [];
        const leadMap = new Map<string, Lead>();
        localLeads.forEach(l => leadMap.set(l.id, l));
        (liveLeads || []).forEach(l => leadMap.set(l.id, l));
        (convertedLeads || []).forEach(l => leadMap.set(l.id, l));
        updated = Array.from(leadMap.values());
      } else {
        const res = await apiClient.get<any>(`/leads?tenantId=${effectiveCompanyId}`);
        if (res && res.success && Array.isArray(res.data)) {
          updated = res.data.map((l: any) => ({
            id: String(l.id),
            companyId: tenant?.id || 't-ghl-01',
            name: l.name,
            phone: l.phone,
            email: l.email || '',
            location: l.location || '',
            source: l.source || 'Website Inbound',
            status: l.status || 'New',
            priority: l.priority || 'Medium',
            assignedAgentId: (l.assignedAgentId && String(l.assignedAgentId) !== '1') ? String(l.assignedAgentId) : '',
            assignedAgentName: (() => { const n = (l.assignedAgentName || '').trim(); return (!n || n.toLowerCase() === 'yanosh' || String(l.assignedAgentId) === '1') ? 'Unassigned' : n; })(),
            nextFollowupDate: l.nextFollowupDate,
            targetDevelopment: l.targetDevelopment,
            budgetRange: l.budgetRange,
            readyToRegister: l.readyToRegister,
            notes: l.notes || '',
            createdAt: l.createdAt ? new Date(l.createdAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
            customFields: {
              budgetRange: l.budgetRange || '',
              readyToRegister: l.readyToRegister || '',
              investmentCapacity: l.investmentCapacity || '',
              assetClass: l.assetClass || '',
              horizon: l.horizon || '',
              investorType: l.investorType || '',
            }
          }));

          const convertedRes = await apiClient.get<any>(`/leads?tenantId=${effectiveCompanyId}&status=Converted`);
          if (convertedRes?.success && Array.isArray(convertedRes.data)) {
            updated = [...updated, ...convertedRes.data.map((l: any) => ({
              id: String(l.id),
              companyId: tenant?.id || 't-ghl-01',
              name: l.name,
              phone: l.phone,
              email: l.email || '',
              location: l.location || '',
              source: l.source || 'Website Inbound',
              status: 'Converted' as const,
              priority: l.priority || 'Medium',
              assignedAgentId: l.assignedAgentId ? String(l.assignedAgentId) : '',
              assignedAgentName: l.assignedAgentName || l.assignedAgent?.name || 'Unassigned',
              notes: l.notes || '',
              createdAt: l.createdAt ? new Date(l.createdAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
              customFields: l.customFields || {},
            }))];
          }
        }
      }
    } catch (err) {
      console.warn('API leads load error, falling back to storage:', err);
    }

    if (updated.length === 0) {
      updated = storageService.getLeads(tenant?.id);
    }

    const sanitizeAgent = (lead: Lead): Lead => {
      const name = (lead.assignedAgentName || '').trim();
      const isYanosh = name.toLowerCase() === 'yanosh' || String(lead.assignedAgentId) === '1';
      const isInvalid = isYanosh || name === 'Agent' || !name;
      return {
        ...lead,
        assignedAgentId: isInvalid ? '' : String(lead.assignedAgentId || ''),
        assignedAgentName: isInvalid ? 'Unassigned' : name,
      };
    };

    const sanitized = updated.map(sanitizeAgent);
    setLeads(sanitized);
    setSelectedLead(prev => {
      if (!prev) return null;
      const found = sanitized.find(l => l.id === prev.id);
      if (!found) {
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
      const hasPendingFollowup = ghlPendingFollowups.some(f => {
        return f.contactType === 'lead' && String(f.contactId) === String(lead.id);
      });
      if (hasPendingFollowup) return false;
    }
    // Hide converted leads by default — only show them when filter is explicitly 'Converted'
    if (statusFilter === 'All' && (lead.status as string) === 'Converted') return false;
    if (!isGhlAdmin && statusFilter !== 'All' && (lead.status as string) !== statusFilter) return false;
    if (sourceFilter !== 'All' && lead.source !== sourceFilter) return false;
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
      timestamp: new Date().toISOString(),
      actorName: user?.name || 'Admin',
      actorEmail: user?.email || (isJaminUser ? 'admin@jaminbazaar.com' : 'admin@ghlindiaventures.com'),
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
      timestamp: new Date().toISOString(),
      actorName: user?.name || 'Admin',
      actorEmail: user?.email || (isJaminUser ? 'admin@jaminbazaar.com' : 'admin@ghlindiaventures.com'),
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
      timestamp: new Date().toISOString(),
      actorName: user?.name || 'Admin',
      actorEmail: user?.email || (isJaminUser ? 'admin@jaminbazaar.com' : 'admin@ghlindiaventures.com'),
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

  const handleSaveJaminSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLead || !scheduleDate) return;

    const timeParts = (scheduleTime || '11:00').split(':').map(n => parseInt(n, 10));
    const dt = new Date(scheduleDate);
    dt.setHours(isNaN(timeParts[0]) ? 11 : timeParts[0], isNaN(timeParts[1]) ? 0 : timeParts[1], 0, 0);
    const isoScheduledAt = dt.toISOString();
    const formattedFollowupString = `${scheduleDate}${scheduleTime ? ' ' + scheduleTime : ''}`;

    // 1. Update lead record
    const updatedLead: Lead = {
      ...selectedLead,
      nextFollowupDate: isoScheduledAt,
      nextFollowupType: scheduleType,
    };
    storageService.saveLead(updatedLead);
    setSelectedLead(updatedLead);
    setLeads(prev => prev.map(l => l.id === updatedLead.id ? updatedLead : l));

    // 2. Check for existing Pending follow-up for this lead to update/reschedule
    const allFollowups = apiFollowups;
    const existingPending = allFollowups.find(
      f =>
        f.status === 'Pending' && f.contactType === 'lead' && String(f.contactId) === String(selectedLead.id)
    );

    const targetAgentId = scheduleAgentId || selectedLead.assignedAgentId || user?.id || '1';
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
      // Mark previous pending follow-up as Rescheduled in DB
      await apiSaveFollowup({
        ...existingPending,
        status: 'Rescheduled',
      });
    }

    const isJamin = tenant?.slug === 'jamin' || tenant?.id === 't-jamin-02' || tenant?.id === '2';

    const newFollowup: Followup = {
      id: `fup-${Date.now()}`,
      companyId: isJamin ? 't-jamin-02' : (tenant?.id || 't-ghl-01'),
      contactId: String(selectedLead.id),
      contactName: selectedLead.name,
      contactPhone: selectedLead.phone,
      contactType: 'lead',
      scheduledAt: isoScheduledAt,
      scheduledDate: scheduleDate,
      scheduledTime: scheduleTime || '11:00 AM',
      priority: 'Medium',
      status: 'Pending',
      followupType: scheduleType as any,
      notes: resolvedNotes,
      assignedAgentId: String(targetAgentId),
      assignedAgentName: targetAgent.name,
      createdBy: user?.name || 'Admin',
    };

    try {
      const created = await apiSaveFollowup(newFollowup);
      setApiFollowups(prev => [created, ...prev.filter(f => f.id !== created.id)]);
    } catch (err) {
      console.warn('[LeadsPage] Error scheduling followup:', err);
      alert(err instanceof Error ? err.message : 'Could not schedule the follow-up. Please retry.');
      return;
    }

    // 3. Add Audit log
    storageService.addAuditLog({
      id: `aud-${Date.now()}`,
      timestamp: new Date().toISOString(),
      actorName: user?.name || 'Agent',
      actorEmail: user?.email || (isJaminUser ? 'agent@jaminbazaar.com' : 'admin@ghlindiaventures.com'),
      action: 'FOLLOWUP_SCHEDULED',
      entityType: 'Lead',
      entityId: selectedLead.id,
      companyId: tenant?.id,
      companyName: tenant?.name,
      details: `Scheduled ${scheduleType} follow-up for ${selectedLead.name} on ${formattedFollowupString}.`,
    });

    window.dispatchEvent(new Event('nexus_storage_updated'));
    setIsJaminScheduleModalOpen(false);
    showToast(`✓ Follow-up scheduled for ${selectedLead.name} on ${scheduleDate}!`);
  };

  const leadSiteVisits = useMemo(() => {
    if (!selectedLead) return [];
    return apiSiteVisits.filter(v => String(v.leadId || '') === String(selectedLead.id));
  }, [selectedLead, apiSiteVisits, isDetailDrawerOpen]);

  const leadFollowups = useMemo(() => {
    if (!selectedLead) return [];
    const followupMap = new Map<string, Followup>();
    (apiFollowups || []).forEach(f => followupMap.set(String(f.id), f));
    if (followupMap.size === 0) {
      const local = storageService.getFollowups(tenant?.id) || [];
      local.forEach(f => followupMap.set(String(f.id), f));
    }
    const all = Array.from(followupMap.values());

    return all.filter(f => {
      if ((f.contactType || 'lead') !== 'lead') return false;
      return String(f.contactId) === String(selectedLead.id);
    });
  }, [selectedLead, tenant?.id, apiFollowups, isDetailDrawerOpen]);

  const leadConsultations = useMemo(() => {
    if (!selectedLead) return [];
    const all = storageService.getConsultations(tenant?.id) || [];
    const cleanPhone = (selectedLead.phone || '').replace(/\D/g, '').slice(-10);
    return all.filter(
      c =>
        c.investorId === selectedLead.id ||
        (c as any).leadId === selectedLead.id ||
        (cleanPhone && (c.investorPhone || (c as any).customerPhone || '').replace(/\D/g, '').slice(-10) === cleanPhone)
    );
  }, [selectedLead, tenant?.id, isDetailDrawerOpen]);

  const availableProjects = useMemo(() => {
    // First priority: API-loaded Jamin projects
    if (jaminApiProjects.length > 0) {
      return jaminApiProjects;
    }
    // Second priority: locally stored projects
    const fromStorage = storageService.getProjects() || [];
    if (fromStorage.length > 0) {
      return fromStorage.map(p => ({ id: p.id, name: p.name }));
    }
    // Fallback defaults (only if no API/storage data)
    return [
      { id: 'proj-01', name: 'Greenfield Meadows Phase 2' },
      { id: 'proj-02', name: 'Greenfield Meadows Phase 1' },
      { id: 'proj-03', name: 'Palm Grove Estates' },
      { id: 'proj-04', name: 'Emerald Orchards' },
    ];
  }, [jaminApiProjects, tenant?.id]);

  const handleUpdateLeadStatus = (leadId: string, newStatus: Lead['status']) => {
    const updated = leads.map(l => l.id === leadId ? { ...l, status: newStatus } : l);
    setLeads(updated);
    const leadObj = updated.find(l => l.id === leadId);
    if (leadObj) {
      storageService.saveLead(leadObj);
      if (selectedLead && selectedLead.id === leadId) {
        setSelectedLead(leadObj);
      }
      showToast(`✓ Lead status updated to "${newStatus}"!`);
    }
  };

  const handleUpdateLeadField = (leadId: string, updates: Partial<Lead>) => {
    const updated = leads.map(l => {
      if (l.id === leadId) {
        const merged: Lead = {
          ...l,
          ...updates,
          customFields: {
            ...(l.customFields || {}),
            ...(updates.customFields || {}),
          },
        };
        return merged;
      }
      return l;
    });
    setLeads(updated);
    const leadObj = updated.find(l => l.id === leadId);
    if (leadObj) {
      storageService.saveLead(leadObj);
      if (selectedLead && selectedLead.id === leadId) {
        setSelectedLead(leadObj);
      }
      showToast(`✓ Updated details for ${leadObj.name}`);
    }
  };

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
        : (user?.name || (jaminAgents[0]?.name || 'Agent'))
    );
    setIsLeadSiteVisitModalOpen(true);
  };

  const handleSaveLeadSiteVisit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLead) return;

    const hostAg = jaminAgents.find(a => a.name === leadVisitHostAgent || a.id === leadVisitHostAgent);

    const dateFormatted = (() => {
      try {
        const [y, m, d] = leadVisitDate.split('-');
        const dateObj = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
        return `${dateObj.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })} • ${leadVisitTimeSlot}`;
      } catch {
        return `${leadVisitDate} • ${leadVisitTimeSlot}`;
      }
    })();

    const trimmedNotes = leadVisitNotes.trim();

    let created: SiteVisit | null = null;
    if (isJamin) {
      created = await jaminApiService.scheduleSiteVisit({
        leadId: Number(selectedLead.id),
        contactType: 'lead',
        customerName: selectedLead.name,
        customerPhone: selectedLead.phone,
        projectName: leadVisitProject,
        plotNumber: leadVisitPlot,
        scheduledAt: dateFormatted,
        assignedAgentId: Number(hostAg?.id || selectedLead.assignedAgentId || user?.id) || undefined,
        assignedAgentName: hostAg?.name || leadVisitHostAgent || user?.name || 'Agent',
        visitorNote: trimmedNotes,
      });
    }
    if (!created) {
      alert('The site visit could not be saved. Check the selected lead and company, then try again.');
      return;
    }
    storageService.saveSiteVisit(created);
    setApiSiteVisits(prev => [created!, ...prev.filter(v => v.id !== created!.id)]);

    storageService.addAuditLog({
      id: `aud-${Date.now()}`,
      timestamp: new Date().toISOString(),
      actorName: user?.name || 'Agent',
      actorEmail: user?.email || (isJaminUser ? 'agent@jaminbazaar.com' : 'admin@ghlindiaventures.com'),
      action: 'SITE_VISIT_SCHEDULED',
      entityType: 'SiteVisit',
      entityId: created.id,
      companyId: tenant?.id,
      companyName: tenant?.name,
      details: `Scheduled site visit for LEAD: ${selectedLead.name} at ${leadVisitProject} (${leadVisitPlot}).`,
    });

    window.dispatchEvent(new Event('nexus_storage_updated'));
    setIsLeadSiteVisitModalOpen(false);
    showToast(`✓ Site visit scheduled for ${selectedLead.name}!`);
  };

  const handleManualAssignConfirm = () => {
    if (!assignSelectedAgent) return;
    const newAssigned = new Set(assignedLeadIds);
    const newRecords: Array<{ leadId: string; leadName: string; agentId: any; agentName: string; assignedAt: string }> = [];
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
      try { sessionStorage.setItem('ghl_agent_assignments', JSON.stringify(updated)); } catch { }
      (window as any).__ghlAssignments = updated;
      return updated;
    });
    const count = selectedLeadIds.size;
    setSelectedLeadIds(new Set());
    setIsAssignModalOpen(false);
    setAssignStep('pick-agent');
    setAssignSelectedAgent(null);
    showToast(`✓ ${count} lead${count !== 1 ? 's' : ''} assigned to ${assignSelectedAgent.name}`);
  };

  const handleOpenAiSuggestion = () => {
    const pool = filteredLeads;
    const dist: Record<string, Lead[]> = {};
    const agentsList = apiAgents && apiAgents.length > 0 ? apiAgents : [];
    agentsList.forEach(a => { dist[String(a.id)] = []; });
    pool.forEach((lead, i) => {
      if (agentsList.length > 0) {
        const agent = agentsList[i % agentsList.length];
        dist[String(agent.id)].push(lead);
      }
    });
    setAiDistribution(dist as any);
    setIsAiEditMode(false);
    setIsAiModalOpen(true);
  };

  const handleAiMoveLead = (leadId: string, fromAgentId: any, direction: 'left' | 'right') => {
    const agentsList = apiAgents && apiAgents.length > 0 ? apiAgents : [];
    const agentIds = agentsList.map(a => String(a.id));
    const fromIdx = agentIds.indexOf(String(fromAgentId));
    const toIdx = direction === 'left' ? fromIdx - 1 : fromIdx + 1;
    if (toIdx < 0 || toIdx >= agentIds.length) return;
    const toAgentId = agentIds[toIdx];
    setAiDistribution((prev: any) => {
      const fromLeads = [...(prev[fromAgentId] || [])].filter((l: any) => l.id !== leadId);
      const movedLead = (prev[fromAgentId] || []).find((l: any) => l.id === leadId);
      if (!movedLead) return prev;
      const toLeads = [...(prev[toAgentId] || []), movedLead];
      return { ...prev, [fromAgentId]: fromLeads, [toAgentId]: toLeads };
    });
  };

  const handleAiConfirm = () => {
    const newAssigned = new Set(assignedLeadIds);
    const newRecords: Array<{ leadId: string; leadName: string; agentId: any; agentName: string; assignedAt: string }> = [];
    let count = 0;
    const agentsList = apiAgents && apiAgents.length > 0 ? apiAgents : [];
    Object.entries(aiDistribution).forEach(([agentIdStr, agentLeads]) => {
      const agent = agentsList.find(a => String(a.id) === String(agentIdStr));
      (agentLeads as Lead[]).forEach(l => {
        newAssigned.add(l.id);
        count++;
        newRecords.push({
          leadId: l.id,
          leadName: l.name,
          agentId: agentIdStr,
          agentName: agent?.name || 'Agent',
          assignedAt: new Date().toISOString(),
        });
      });
    });
    setAssignedLeadIds(newAssigned);
    setAgentAssignments(prev => {
      const updated = [...prev, ...newRecords];
      try { sessionStorage.setItem('ghl_agent_assignments', JSON.stringify(updated)); } catch { }
      (window as any).__ghlAssignments = updated;
      return updated;
    });
    setIsAiModalOpen(false);
    showToast(`✓ ${count} lead${count !== 1 ? 's' : ''} assigned via AI Suggestion`);
  };

  const handleOpenCreate = () => {
    if (!user) {
      console.warn('[LeadsPage] Cannot create lead: user session is not yet loaded.');
      return;
    }
    const isSalesRole = user.role?.code === 'sales_executive' || user.role?.code === 'sales_manager';
    const defaultAgentId = isSalesRole ? String(user.id) : '';
    const defaultAgentName = isSalesRole ? user.name : '';

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

  const handleSaveLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.phone) return;

    // Resolve assigned agent from formData without defaulting to logged in admin user
    const resolvedAgentId = formData.assignedAgentId && formData.assignedAgentId !== 'unassigned'
      ? String(formData.assignedAgentId)
      : '';
    const resolvedAgentName = formData.assignedAgentName && formData.assignedAgentName !== 'Agent' && formData.assignedAgentName !== 'Unassigned'
      ? formData.assignedAgentName
      : (resolvedAgentId ? 'Agent' : 'Unassigned');

    const targetCompanyId = formData.companyId || tenant?.id || 't-ghl-01';
    const existingMatch = leads.find(l => l.id === formData.id) || (formData.phone ? storageService.findLeadByPhone(formData.phone, targetCompanyId) : null);
    const isExistingById = Boolean(existingMatch);

    let leadToSave: Lead;
    let isUpdated = isExistingById;

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

    try {
      const effectiveCompanyId = isJaminUser ? 2 : (typeof targetCompanyId === 'number' ? targetCompanyId : (parseInt(String(targetCompanyId), 10) || 1));
      const parsedAgentId = resolvedAgentId && !isNaN(Number(resolvedAgentId)) ? Number(resolvedAgentId) : undefined;

      if (!isUpdated) {
        // Create in backend
        const res = await apiClient.post<any>('/leads', {
          name: leadToSave.name,
          phone: leadToSave.phone,
          companyId: effectiveCompanyId,
          email: leadToSave.email,
          location: leadToSave.location,
          source: leadToSave.source,
          status: leadToSave.status || 'New',
          priority: leadToSave.priority,
          notes: leadToSave.notes,
          targetDevelopment: leadToSave.targetDevelopment,
          assignedAgentId: parsedAgentId,
          assignedAgentName: resolvedAgentName !== 'Unassigned' ? resolvedAgentName : undefined,
          budgetRange: leadToSave.customFields?.budgetRange || leadToSave.customFields?.investmentCapacity || '',
          readyToRegister: leadToSave.customFields?.readyToRegister || (leadToSave as any).readyToRegister || '',
          investmentCapacity: leadToSave.customFields?.investmentCapacity || ''
        });
        if (res.success && res.data) {
          leadToSave.id = String(res.data.id);
        }
      } else {
        // Update in backend
        const numericId = parseInt(String(leadToSave.id).replace('db-', ''), 10);
        if (!isNaN(numericId)) {
          await apiClient.put<any>(`/leads/${numericId}`, {
            name: leadToSave.name,
            phone: leadToSave.phone,
            companyId: effectiveCompanyId,
            email: leadToSave.email,
            location: leadToSave.location,
            source: leadToSave.source,
            status: leadToSave.status,
            priority: leadToSave.priority,
            notes: leadToSave.notes,
            targetDevelopment: leadToSave.targetDevelopment,
            assignedAgentId: parsedAgentId,
            assignedAgentName: resolvedAgentName !== 'Unassigned' ? resolvedAgentName : undefined,
            budgetRange: leadToSave.customFields?.budgetRange || leadToSave.customFields?.investmentCapacity || '',
            readyToRegister: leadToSave.customFields?.readyToRegister || (leadToSave as any).readyToRegister || '',
            investmentCapacity: leadToSave.customFields?.investmentCapacity || ''
          });
        }
      }
    } catch (err) {
      console.error('Failed to save to backend DB', err);
    }

    storageService.saveLead(leadToSave);

    // ── Immediately sync React state so the 360 view shows the saved values ──
    setLeads(prev => {
      const idx = prev.findIndex(l => l.id === leadToSave.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = leadToSave;
        return next;
      }
      return [leadToSave, ...prev];
    });
    if (selectedLead && selectedLead.id === leadToSave.id) {
      setSelectedLead(leadToSave);
    }

    let auditDetails = '';
    if (!isUpdated) {
      auditDetails = `Created new lead prospect "${leadToSave.name}" (Phone: ${leadToSave.phone}, Status: ${leadToSave.status || 'New'}, Priority: ${leadToSave.priority || 'Medium'}, Source: ${leadToSave.source || 'Website Inbound'}${leadToSave.targetDevelopment ? `, Project: ${leadToSave.targetDevelopment}` : ''}${leadToSave.budgetRange ? `, Budget: ${leadToSave.budgetRange}` : ''}).`;
    } else {
      const changes: string[] = [];
      if (existingMatch) {
        if (existingMatch.status !== leadToSave.status) changes.push(`Status → ${leadToSave.status}`);
        if (existingMatch.priority !== leadToSave.priority) changes.push(`Priority → ${leadToSave.priority}`);
        if (existingMatch.source !== leadToSave.source) changes.push(`Source → ${leadToSave.source}`);
        if (existingMatch.assignedAgentName !== leadToSave.assignedAgentName) changes.push(`Assigned → ${leadToSave.assignedAgentName}`);
        if (existingMatch.targetDevelopment !== leadToSave.targetDevelopment && leadToSave.targetDevelopment) changes.push(`Project → ${leadToSave.targetDevelopment}`);
        if (existingMatch.budgetRange !== leadToSave.budgetRange && leadToSave.budgetRange) changes.push(`Budget → ${leadToSave.budgetRange}`);
        if (existingMatch.readyToRegister !== leadToSave.readyToRegister && leadToSave.readyToRegister) changes.push(`Timeline → ${leadToSave.readyToRegister}`);
        if (existingMatch.location !== leadToSave.location && leadToSave.location) changes.push(`Location → ${leadToSave.location}`);
      }
      auditDetails = changes.length > 0
        ? `Updated ${leadToSave.name}: ${changes.join(', ')}.`
        : `Updated lead record details for ${leadToSave.name}.`;
    }

    storageService.addAuditLog({
      id: `aud-${Date.now()}`,
      timestamp: new Date().toISOString(),
      actorName: user?.name || resolvedAgentName,
      actorEmail: user?.email || (isJaminUser ? 'agent@jaminbazaar.com' : 'agent@ghlindiaventures.com'),
      action: isUpdated ? 'LEAD_UPDATED' : 'LEAD_CREATED',
      entityType: 'Lead',
      entityId: leadToSave.id,
      companyId: tenant?.id,
      companyName: tenant?.name,
      details: auditDetails,
    });

    showToast(`✓ Lead "${leadToSave.name}" saved successfully!`);
    setIsEditDrawerOpen(false);
  };

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
        actorEmail: user?.email || (isJaminUser ? 'admin@jaminbazaar.com' : 'admin@ghlindiaventures.com'),
        action: 'LEAD_DELETED',
        entityType: 'Lead',
        entityId: String(lead.id),
        companyId: tenant?.id,
        companyName: tenant?.name,
        details: `Deleted lead prospect ${lead.name} (Phone: ${lead.phone}).`,
      });
      showToast(`✓ Lead "${lead.name}" deleted successfully.`);
      setSelectedLead(null);
      setIsDetailDrawerOpen(false);
      setIsEditDrawerOpen(false);
      await loadData();
    }
  };

  const handleStartConvert = (lead: Lead) => {
    setSelectedLead(lead);
    setIsConvertModalOpen(true);
  };

  const handleConfirmConvert = async () => {
    if (!selectedLead || !tenant) return;

    const cleanId = String(selectedLead.id).replace('db-', '').replace('lead-', '').trim();
    const isJamin = tenant?.slug === 'jamin' || tenant?.id === 't-jamin-02' || tenant?.id === '2';
    const conversionResult = !isNaN(Number(cleanId))
      ? await jaminApiService.convertLead(cleanId, undefined, undefined, selectedLead.notes)
      : { success: true, customerId: undefined };

    if (!conversionResult.success) {
      showToast('Unable to convert this lead. No records were changed.');
      return;
    }
    if (isJamin && !conversionResult.customerId) {
      showToast('Unable to create the customer record. The lead was not converted.');
      return;
    }

    const updatedLead: Lead = { ...selectedLead, status: 'Converted' };
    storageService.saveLead(updatedLead);
    if (!conversionResult.customerId) {
      storageService.saveCustomer({
        id: `cust-${Date.now()}`,
        companyId: tenant.id,
        name: selectedLead.name,
        phone: selectedLead.phone,
        email: selectedLead.email || '',
        status: 'Active',
        assignedAgentId: selectedLead.assignedAgentId,
        assignedAgentName: selectedLead.assignedAgentName,
        location: selectedLead.location || '',
        lastContacted: new Date().toISOString(),
        openDealsCount: 0,
        totalValue: 0,
        createdAt: new Date().toISOString(),
        notes: selectedLead.notes || '',
        customFields: selectedLead.customFields,
      });
    }

    showToast(`✓ Lead "${selectedLead.name}" converted to Customer successfully.`);
    setIsConvertModalOpen(false);
    setIsDetailDrawerOpen(false);
    await loadData();
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
      timestamp: new Date().toISOString(),
      actorName: user?.name || 'Agent',
      actorEmail: user?.email || (isJaminUser ? 'agent@jaminbazaar.com' : 'agent@ghlindiaventures.com'),
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
      const name = l.assignedAgentName || '';
      const isInvalid = !name || name === 'Agent' || name === 'Unassigned';
      return <span className="lead-text-muted">{isInvalid ? '—' : name}</span>;
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
        setDrawerActiveTab('contact');
        setIsDetailDrawerOpen(true);
      },
    },
    {
      label: 'Convert to Customer',
      icon: <Sparkles size={14} color="#10b981" className="leads-action-icon" />,
      onClick: l => handleStartConvert(l),
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
          setDrawerActiveTab('contact');
          setIsDetailDrawerOpen(true);
        }}
        searchPlaceholder="Search leads by name, phone, or location..."
        emptyTitle="No leads matching criteria"
        emptyDescription="Create a new lead or clear your filters to display inbound leads."
        emptyActionLabel="+ Add  Lead"
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
                  options: isJamin
                    ? [
                      { value: 'New', label: 'New' },
                      { value: 'Contacted', label: 'Contacted' },
                      { value: 'Interested', label: 'Interested' },
                      { value: 'Qualified', label: 'Qualified' },
                      { value: 'Follow-up Required', label: 'Follow-up Required' },
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
                      { value: 'Callback', label: 'Callback' },
                      { value: 'No Response', label: 'No Response' },
                      { value: 'Not Interested', label: 'Not Interested' },
                      { value: 'Junk', label: 'Junk' },
                      { value: 'Lost', label: 'Lost' },
                      { value: 'Converted', label: '✓ Converted' },
                    ],
                }]),
                {
                  key: 'source',
                  label: 'Source',
                  allLabel: isJamin ? 'All Sources' : 'All Sources',
                  value: sourceFilter,
                  onChange: setSourceFilter,
                  options: sourceOptions,
                },
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
                setSourceFilter('All');
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
        subtitle={`${selectedLead?.phone} • Created on ${selectedLead?.createdAt ? new Date(selectedLead.createdAt).toLocaleDateString() : '—'}`}
        width={620}
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
            selectedLead.investmentCapacity ||
            null;

          /** ── User-facing message ── */
          const userMessage =
            (selectedLead as any).message ||
            (selectedLead as any).userMessage ||
            selectedLead.customFields?.message ||
            selectedLead.customFields?.userMessage ||
            selectedLead.customFields?.customerNotes ||
            (selectedLead as any).anythingWeShouldKnow ||
            (selectedLead as any).whatAreYouLookingFor ||
            selectedLead.notes ||
            null;

          // ══════════════════════════════════════════════════════════════════
          //  JAMIN ONLY: Tabbed 360 Layout
          // ══════════════════════════════════════════════════════════════════
          if (isJamin) {
            const jaminTabs = [
              { id: 'contact' as const, label: 'Contact' },
              { id: 'followups' as const, label: `Follow-ups (${leadFollowups.length})` },
              { id: 'site_visits' as const, label: `Site Visits (${leadSiteVisits.length})` },
              { id: 'calls' as const, label: 'Calls' },
              { id: 'activity' as const, label: 'Activity' },
            ];

            return (
              <div style={{ display: 'flex', flexDirection: 'column', margin: '-20px' }}>
                {/* ── Lead banner: Assigned agent + convert button ── */}
                <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-base)', background: 'var(--bg-surface)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-secondary)', fontWeight: 700, letterSpacing: '0.06em' }}>Assigned Sales Executive</div>
                    <div style={{ fontSize: '14px', fontWeight: 700, marginTop: 2, color: (!selectedLead.assignedAgentName || selectedLead.assignedAgentName === 'Unassigned' || selectedLead.assignedAgentName === 'Agent') ? 'var(--text-secondary)' : 'var(--text-primary)' }}>
                      {(!selectedLead.assignedAgentName || selectedLead.assignedAgentName === 'Unassigned' || selectedLead.assignedAgentName === 'Agent') ? 'Not Assigned' : selectedLead.assignedAgentName}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                    <StatusChip status={selectedLead.status} size="sm" />
                    {selectedLead.status !== 'Converted' && selectedLead.assignedAgentName && selectedLead.assignedAgentName !== 'Unassigned' && selectedLead.assignedAgentName !== 'Agent' && (
                      <button type="button" onClick={() => handleStartConvert(selectedLead)} style={{ fontSize: '11px', padding: '4px 10px', display: 'inline-flex', alignItems: 'center', gap: 4, backgroundColor: '#10b981', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer' }}>
                        <Sparkles size={12} /> Convert
                      </button>
                    )}
                  </div>
                </div>

                {/* ── Tab bar ── */}
                <div className="ld360-tab-bar">
                  {jaminTabs.map(tab => (
                    <button
                      key={tab.id}
                      className={`ld360-tab-btn${drawerActiveTab === tab.id ? ' is-active' : ''}`}
                      onClick={() => setDrawerActiveTab(tab.id)}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* ── Tab content ── */}
                <div className="ld360-tab-content">

                  {/* CONTACT TAB */}
                  {drawerActiveTab === 'contact' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                      {/* Contact & Profile */}
                      <div className="card lead-detail-card">
                        <h4 className="lead-detail-title">Contact &amp; Profile</h4>
                        <div className="lead-detail-grid">
                          <div><span className="lead-detail-label">Full Name:</span><div className="lead-detail-value" style={{ fontWeight: 700 }}>{selectedLead.name}</div></div>
                          <div><span className="lead-detail-label">Phone Number:</span><div className="lead-detail-value" style={{ fontWeight: 700, color: 'var(--primary-600)' }}>{selectedLead.phone}</div></div>
                          <div><span className="lead-detail-label">Email:</span><div className="lead-detail-value">{selectedLead.email || '—'}</div></div>
                          <div><span className="lead-detail-label">Location / City:</span><div className="lead-detail-value">{selectedLead.location || '—'}</div></div>
                          <div><span className="lead-detail-label">Lead Source:</span><div className="lead-detail-value">{selectedLead.source || '—'}</div></div>
                          <div><span className="lead-detail-label">Intake Date:</span><div className="lead-detail-value">{selectedLead.createdAt ? new Date(selectedLead.createdAt).toLocaleDateString() : '—'}</div></div>
                          <div><span className="lead-detail-label">Priority:</span><div style={{ marginTop: 4 }}><StatusChip status={selectedLead.priority} size="sm" /></div></div>
                        </div>
                      </div>
                      {/* Requirements */}
                      <div className="card lead-detail-card">
                        <h4 className="lead-detail-title">Requirements &amp; Preferences</h4>
                        <div className="lead-detail-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
                          <div>
                            <span className="lead-detail-label">Target Project:</span>
                            <div className="lead-detail-value" style={{ fontWeight: 700, color: 'var(--primary-600)' }}>
                              {selectedLead.targetDevelopment || selectedLead.customFields?.targetDevelopment || selectedLead.customFields?.project || '—'}
                            </div>
                          </div>
                          <div>
                            <span className="lead-detail-label">Budget Range:</span>
                            <div className="lead-detail-value" style={{ fontWeight: 700, color: '#059669' }}>
                              {selectedLead.customFields?.budgetRange || selectedLead.customFields?.budget || (selectedLead as any).budgetRange || selectedLead.budgetRange || '—'}
                            </div>
                          </div>
                          <div>
                            <span className="lead-detail-label">Ready to Register:</span>
                            <div className="lead-detail-value">{selectedLead.customFields?.readyToRegister || (selectedLead as any).readyToRegister || '—'}</div>
                          </div>
                        </div>
                        {userMessage && (
                          <div style={{ marginTop: 14 }}>
                            <div style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>Message from Lead</div>
                            <div className="lead-user-message-box"><div className="lead-user-message-text">{userMessage}</div></div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* FOLLOW-UPS TAB */}
                  {drawerActiveTab === 'followups' && (
                    <div className="card lead-detail-card">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <h4 className="lead-detail-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Calendar size={15} color="var(--primary-600)" /> Follow-ups ({leadFollowups.length})
                        </h4>
                        <button type="button" className="btn btn-sm btn-secondary" onClick={() => handleOpenJaminSchedule(selectedLead)} style={{ fontSize: '11px', padding: '3px 10px', fontWeight: 600, color: 'var(--primary-600)', borderColor: 'var(--primary-200, #fca5a5)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <Calendar size={12} /> {selectedLead.nextFollowupDate ? 'Reschedule' : '+ Schedule'}
                        </button>
                      </div>
                      {selectedLead.nextFollowupDate && (
                        <div style={{ padding: '10px 14px', borderRadius: 8, backgroundColor: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                          <div>
                            <div style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 700, color: '#dc2626' }}>Next Action</div>
                            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', marginTop: 2 }}>
                              {selectedLead.nextFollowupType && <span style={{ marginRight: 6 }}>{selectedLead.nextFollowupType === 'call' ? '📞' : selectedLead.nextFollowupType === 'whatsapp' ? '💬' : '🤝'} •</span>}
                              {selectedLead.nextFollowupDate}
                            </div>
                          </div>
                          <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: 12, backgroundColor: '#fee2e2', color: '#991b1b', fontWeight: 700 }}>Action Due</span>
                        </div>
                      )}
                      {leadFollowups.length === 0 && !selectedLead.nextFollowupDate ? (
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', padding: '20px', textAlign: 'center', backgroundColor: 'var(--bg-surface)', borderRadius: 8, border: '1px dashed var(--border-base)' }}>
                          No follow-ups scheduled yet. Click "+ Schedule" to set a task.
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {leadFollowups.map(f => (
                            <div
                              key={f.id}
                              onClick={() => {
                                sessionStorage.setItem('target_followup_id', f.id);
                                sessionStorage.setItem('target_followup_contact', selectedLead.name);
                                setIsDetailDrawerOpen(false);
                                handleNavigate('followups');
                              }}
                              className="ld360-clickable-card"
                              title="Click to view and manage in Follow-ups"
                              style={{
                                padding: '12px 14px',
                                borderRadius: 8,
                                background: 'var(--bg-card-subtle, #f9fafb)',
                                border: '1px solid var(--border-base)',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                gap: 10,
                                cursor: 'pointer',
                              }}
                            >
                              <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 600, fontSize: '12px', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                  <span>{f.followupType === 'whatsapp' ? '💬 WhatsApp' : f.followupType === 'meeting' ? '🤝 Meeting' : '📞 Phone Call'}</span>
                                  <span style={{ color: 'var(--text-muted)' }}>•</span>
                                  <span>{f.scheduledAt || `${f.scheduledDate || ''} ${f.scheduledTime || ''}`}</span>
                                </div>
                                {f.notes && <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: 3 }}>{f.notes}</div>}
                                {f.assignedAgentName && <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: 2 }}>Agent: <strong>{f.assignedAgentName}</strong></div>}
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                                <StatusChip status={f.status} size="sm" />
                                <span style={{ fontSize: '11px', color: 'var(--primary-600)', display: 'inline-flex', alignItems: 'center', gap: 2, fontWeight: 600, marginTop: 4 }}>
                                  Open <ExternalLink size={10} />
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* SITE VISITS TAB */}
                  {drawerActiveTab === 'site_visits' && (
                    <div className="card lead-detail-card">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <h4 className="lead-detail-title" style={{ margin: 0 }}>Site Visits ({leadSiteVisits.length})</h4>
                        <button type="button" className="btn btn-sm btn-secondary" onClick={() => handleOpenLeadSiteVisitModal(selectedLead)} style={{ fontSize: '11px', padding: '3px 9px', color: '#dc2626', borderColor: '#fca5a5' }}>
                          + Book Site Visit
                        </button>
                      </div>
                      {leadSiteVisits.length === 0 ? (
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', padding: '20px', textAlign: 'center', backgroundColor: 'var(--bg-surface)', borderRadius: 8, border: '1px dashed var(--border-base)' }}>
                          No site visits booked yet. Click "+ Book Site Visit" to schedule one.
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {leadSiteVisits.map(sv => (
                            <div
                              key={sv.id}
                              onClick={() => {
                                sessionStorage.setItem('target_site_visit_id', sv.id);
                                sessionStorage.setItem('target_site_visit_lead', selectedLead.name);
                                setIsDetailDrawerOpen(false);
                                handleNavigate('site-visits');
                              }}
                              className="ld360-clickable-card"
                              title="Click to view and manage in Site Visits"
                              style={{
                                padding: '12px 14px',
                                borderRadius: 8,
                                background: 'var(--bg-card-subtle, #f9fafb)',
                                border: '1px solid var(--border-base)',
                                cursor: 'pointer',
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div style={{ flex: 1 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                    <span style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text-primary)' }}>
                                      {sv.projectName || 'Jamin Development'}
                                    </span>
                                    <span style={{ color: '#dc2626', fontWeight: 600, fontSize: '12px' }}>
                                      — {sv.plotNumber || 'Layout Tour'}
                                    </span>
                                  </div>
                                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: 4 }}>
                                    📅 <strong>{sv.scheduledAt}</strong>
                                  </div>
                                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: 2 }}>
                                    🧑‍💼 Host: <strong>{sv.assignedAgentName || 'Unassigned'}</strong>
                                  </div>
                                  {(sv.outcomeNotes || sv.visitorNote) && (
                                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: 6, padding: '6px 10px', background: 'var(--bg-surface)', borderRadius: 6, fontStyle: 'italic', borderLeft: '3px solid #dc2626' }}>
                                      "{sv.outcomeNotes || sv.visitorNote}"
                                    </div>
                                  )}
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                                  <StatusChip status={sv.status} size="sm" />
                                  <span style={{ fontSize: '11px', color: '#dc2626', display: 'inline-flex', alignItems: 'center', gap: 3, fontWeight: 600, marginTop: 4 }}>
                                    Open Visit <ExternalLink size={11} />
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* CALLS TAB */}
                  {drawerActiveTab === 'calls' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
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
                      <div style={{ textAlign: 'right', marginTop: 4 }}>
                        <button
                          type="button"
                          className="btn btn-sm btn-secondary"
                          style={{ fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                          onClick={() => {
                            setIsDetailDrawerOpen(false);
                            handleNavigate('call-history');
                          }}
                        >
                          <Phone size={12} /> Open Call History <ExternalLink size={11} />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* ACTIVITY TAB */}
                  {drawerActiveTab === 'activity' && (() => {
                    const allLogs = storageService.getAuditLogs(tenant?.id) || [];
                    const cleanLeadId = String(selectedLead.id || '').replace('lead-', '').replace('db-', '').replace('l-', '').trim();
                    const leadLogs = allLogs.filter(l => {
                      if (!l.entityId) return false;
                      const logId = String(l.entityId).replace('lead-', '').replace('db-', '').replace('l-', '').trim();
                      return logId === cleanLeadId || l.entityId === String(selectedLead.id);
                    });
                    return (
                      <div className="card lead-detail-card">
                        <h4 className="lead-detail-title" style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                          <History size={16} color="var(--primary-600)" /> Activity &amp; Audit Timeline ({leadLogs.length})
                        </h4>
                        {leadLogs.length === 0 ? (
                          <div style={{ fontSize: '12px', color: 'var(--text-muted)', padding: '20px', backgroundColor: 'var(--bg-surface)', borderRadius: 8, textAlign: 'center', border: '1px dashed var(--border-base)' }}>
                            No audit activities recorded for this lead yet.
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', position: 'relative', paddingLeft: 16, borderLeft: '2px solid var(--border-base)', gap: 12, marginLeft: 6 }}>
                            {leadLogs.map((log, idx) => {
                              let formattedTime = log.timestamp || '';
                              if (formattedTime) {
                                const d = new Date(formattedTime);
                                if (!isNaN(d.getTime())) formattedTime = d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });
                              }
                              return (
                                <div key={log.id || idx} style={{ position: 'relative', backgroundColor: 'var(--bg-surface, #ffffff)', border: '1px solid var(--border-base)', borderRadius: 6, padding: '8px 12px' }}>
                                  <div style={{ position: 'absolute', left: -22, top: 12, width: 10, height: 10, borderRadius: '50%', backgroundColor: log.action.includes('DELETE') ? '#ef4444' : log.action.includes('CREATE') ? '#10b981' : 'var(--primary-600)', border: '2px solid #ffffff', boxShadow: '0 0 0 1px var(--border-base)' }} />
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, flexWrap: 'wrap' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                      <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 5px', borderRadius: 4, backgroundColor: log.action.includes('DELETE') ? '#fee2e2' : log.action.includes('CREATE') ? '#dcfce7' : '#e0e7ff', color: log.action.includes('DELETE') ? '#b91c1c' : log.action.includes('CREATE') ? '#15803d' : '#4338ca', textTransform: 'uppercase' }}>
                                        {log.action.replace(/_/g, ' ')}
                                      </span>
                                      <span style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                        <UserIcon size={10} /> <strong>{log.actorName || log.actorEmail || 'System'}</strong>
                                      </span>
                                    </div>
                                    <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>{formattedTime}</span>
                                  </div>
                                  {log.details && <div style={{ fontSize: 12, color: 'var(--text-primary)', marginTop: 4, lineHeight: 1.35 }}>{log.details}</div>}
                                </div>
                              );
                            })}
                          </div>
                        )}
                        {leadLogs.length > 0 && (
                          <div style={{ textAlign: 'right', marginTop: 12 }}>
                            <button
                              type="button"
                              className="btn btn-sm btn-secondary"
                              style={{ fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                              onClick={() => {
                                setIsDetailDrawerOpen(false);
                                handleNavigate(isAdmin ? 'admin-audit' : 'company-audit');
                              }}
                            >
                              <History size={12} /> Open Audit Logs <ExternalLink size={11} />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                </div>
              </div>
            );
          }
          // ══════════════════════════════════════════════════════════════════
          //  END JAMIN TABBED LAYOUT — non-Jamin continues below
          // ══════════════════════════════════════════════════════════════════

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* ── 1. Quick Info Banner (Assigned Agent & Quick Actions) ── */}
              <div className="lead-quick-banner" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                {/* Left: Assigned Sales Executive */}
                <div>
                  <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-secondary)', fontWeight: 700 }}>
                    Assigned Sales Executive
                  </div>
                  <div className="lead-assigned-note" style={{
                    margin: 0, marginTop: 2, fontSize: '14px', fontWeight: 700,
                    color: (!selectedLead.assignedAgentName || selectedLead.assignedAgentName === 'Unassigned' || selectedLead.assignedAgentName === 'Agent')
                      ? 'var(--text-secondary)' : 'var(--text-primary)'
                  }}>
                    {(!selectedLead.assignedAgentName || selectedLead.assignedAgentName === 'Unassigned' || selectedLead.assignedAgentName === 'Agent')
                      ? 'Not Assigned'
                      : selectedLead.assignedAgentName}
                  </div>
                </div>

                {/* Right: Convert to Customer (only when assigned) + other actions */}
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                  {selectedLead.status !== 'Converted' &&
                    selectedLead.assignedAgentName &&
                    selectedLead.assignedAgentName !== 'Unassigned' &&
                    selectedLead.assignedAgentName !== 'Agent' && (
                      <button
                        type="button"
                        className="btn btn-sm"
                        onClick={() => handleStartConvert(selectedLead)}
                        style={{
                          fontSize: '11px',
                          padding: '4px 10px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          backgroundColor: '#10b981',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: 6,
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                        title="Convert this lead into an active Customer record"
                      >
                        <Sparkles size={12} /> Convert to Customer
                      </button>
                    )}
                </div>
              </div>

              {/* ── 2. Contact & Profile Details ── */}
              <div className="card lead-detail-card">
                <h4 className="lead-detail-title">Contact &amp; Profile Details</h4>
                <div className="lead-detail-grid">
                  <div>
                    <span className="lead-detail-label">Full Name:</span>
                    <div className="lead-detail-value" style={{ fontWeight: 700 }}>{selectedLead.name}</div>
                  </div>
                  <div>
                    <span className="lead-detail-label">Phone Number:</span>
                    <div className="lead-detail-value" style={{ fontWeight: 700, color: 'var(--primary-600)' }}>{selectedLead.phone}</div>
                  </div>
                  <div>
                    <span className="lead-detail-label">Email:</span>
                    <div className="lead-detail-value">{selectedLead.email || '—'}</div>
                  </div>
                  <div>
                    <span className="lead-detail-label">Location / City:</span>
                    <div className="lead-detail-value">{selectedLead.location || '—'}</div>
                  </div>
                  <div>
                    <span className="lead-detail-label">Lead Source:</span>
                    <div className="lead-detail-value">{selectedLead.source}</div>
                  </div>
                  <div>
                    <span className="lead-detail-label">Intake Date:</span>
                    <div className="lead-detail-value">
                      {selectedLead.createdAt ? new Date(selectedLead.createdAt).toLocaleDateString() : '—'}
                    </div>
                  </div>
                  <div>
                    <span className="lead-detail-label">Lead Status:</span>
                    <div style={{ marginTop: 4 }}>
                      <StatusChip status={selectedLead.status} size="sm" />
                    </div>
                  </div>
                  <div>
                    <span className="lead-detail-label">Priority:</span>
                    <div style={{ marginTop: 4 }}>
                      <StatusChip status={selectedLead.priority} size="sm" />
                    </div>
                  </div>
                </div>
              </div>

              {/* ── 3. Dedicated Follow-ups & Scheduled Actions Card (Separate Section) ── */}
              <div className="card lead-detail-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <h4 className="lead-detail-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Calendar size={15} color="var(--primary-600)" />
                    Follow-ups &amp; Scheduled Tasks ({leadFollowups.length})
                  </h4>
                  <button
                    type="button"
                    className="btn btn-sm btn-secondary"
                    onClick={() => handleOpenJaminSchedule(selectedLead)}
                    style={{
                      fontSize: '11px',
                      padding: '3px 10px',
                      fontWeight: 600,
                      color: 'var(--primary-600)',
                      borderColor: 'var(--primary-200, #fca5a5)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4
                    }}
                  >
                    <Calendar size={12} /> {selectedLead.nextFollowupDate ? 'Reschedule' : '+ Schedule Follow-up'}
                  </button>
                </div>

                {/* Next Follow-up Banner */}
                {selectedLead.nextFollowupDate ? (
                  <div
                    style={{
                      padding: '10px 14px',
                      borderRadius: 8,
                      backgroundColor: 'rgba(239, 68, 68, 0.06)',
                      border: '1px solid rgba(239, 68, 68, 0.2)',
                      marginBottom: leadFollowups.length > 0 ? 12 : 0,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: 8
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 700, color: '#dc2626' }}>
                        Next Scheduled Action
                      </div>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', marginTop: 2 }}>
                        {selectedLead.nextFollowupType && (
                          <span style={{ marginRight: '6px', textTransform: 'capitalize' }}>
                            {selectedLead.nextFollowupType === 'call' && '📞 Phone Call'}
                            {selectedLead.nextFollowupType === 'whatsapp' && '💬 WhatsApp'}
                            {selectedLead.nextFollowupType === 'meeting' && '🤝 Meeting'}
                            {!['call', 'whatsapp', 'meeting'].includes(selectedLead.nextFollowupType) && selectedLead.nextFollowupType}
                            {' •'}
                          </span>
                        )}
                        {selectedLead.nextFollowupDate}
                      </div>
                    </div>
                    <span
                      style={{
                        fontSize: '11px',
                        padding: '2px 8px',
                        borderRadius: 12,
                        backgroundColor: '#fee2e2',
                        color: '#991b1b',
                        fontWeight: 700
                      }}
                    >
                      Action Due
                    </span>
                  </div>
                ) : null}

                {/* List of Follow-up Records */}
                {leadFollowups.length === 0 && !selectedLead.nextFollowupDate ? (
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', padding: '8px 0', textAlign: 'center' }}>
                    No follow-ups scheduled for this prospect yet. Click "+ Schedule Follow-up" to set a task.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {leadFollowups.map(f => (
                      <div
                        key={f.id}
                        style={{
                          padding: '10px 12px',
                          borderRadius: 6,
                          background: 'var(--bg-card-subtle, #f9fafb)',
                          border: '1px solid var(--border-base)',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: 8
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '12px', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span>
                              {f.followupType === 'whatsapp' ? '💬 WhatsApp' : f.followupType === 'meeting' ? '🤝 Meeting' : '📞 Phone Call'}
                            </span>
                            <span>•</span>
                            <span>{f.scheduledAt || `${f.scheduledDate || ''} ${f.scheduledTime || ''}`}</span>
                          </div>
                          {f.notes && (
                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: 3 }}>
                              {f.notes}
                            </div>
                          )}
                          {f.assignedAgentName && (
                            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: 2 }}>
                              Assigned Agent: <strong>{f.assignedAgentName}</strong>
                            </div>
                          )}
                        </div>
                        <StatusChip status={f.status} size="sm" />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ── 4. Requirements & Project Preferences ── */}
              <div className="card lead-detail-card">
                <h4 className="lead-detail-title">Requirements &amp; Project Preferences</h4>
                <div className="lead-detail-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '14px' }}>
                  <div>
                    <span className="lead-detail-label">Target Development / Project:</span>
                    <div className="lead-detail-value" style={{ fontWeight: 700, color: 'var(--primary-600)' }}>
                      {
                        selectedLead.targetDevelopment ||
                        selectedLead.customFields?.targetDevelopment ||
                        selectedLead.customFields?.project ||
                        selectedLead.customFields?.preferredProject ||
                        '—'
                      }
                    </div>
                  </div>
                  <div>
                    <span className="lead-detail-label">Price / Budget Range:</span>
                    <div className="lead-detail-value" style={{ fontWeight: 700, color: '#059669' }}>
                      {
                        selectedLead.customFields?.budgetRange ||
                        selectedLead.customFields?.budget ||
                        (selectedLead as any).budgetRange ||
                        selectedLead.budgetRange ||
                        '—'
                      }
                    </div>
                  </div>
                  <div>
                    <span className="lead-detail-label">Ready to Register / Timeline:</span>
                    <div className="lead-detail-value">
                      {
                        selectedLead.customFields?.readyToRegister ||
                        (selectedLead as any).readyToRegister ||
                        '—'
                      }
                    </div>
                  </div>
                </div>
              </div>

              {/* ── 5. Investment & Mandate Details (GHL / IRM & HNW Prospects) ── */}
              {(isIrm || isGhlIrm || investmentCapacity || selectedLead.assetClass || selectedLead.customFields?.preferredAssetClass || selectedLead.customFields?.horizon) && (
                <div className="card lead-custom-card">
                  <h4 className="lead-custom-title">Investment &amp; Mandate Details</h4>
                  <div className="lead-detail-grid">
                    <div>
                      <span className="lead-custom-label">Investment Capacity:</span>
                      <div className="lead-custom-value" style={{ color: '#10b981', fontSize: '15px' }}>
                        {investmentCapacity || '—'}
                      </div>
                    </div>
                    <div>
                      <span className="lead-custom-label">Preferred Asset Class:</span>
                      <div className="lead-custom-value">
                        {selectedLead.assetClass ||
                          selectedLead.customFields?.preferredAssetClass ||
                          selectedLead.customFields?.assetClass ||
                          '—'}
                      </div>
                    </div>
                    <div>
                      <span className="lead-custom-label">Investment Horizon:</span>
                      <div className="lead-custom-value">
                        {selectedLead.horizon ||
                          selectedLead.customFields?.horizon ||
                          selectedLead.customFields?.investmentHorizon ||
                          '—'}
                      </div>
                    </div>
                    <div>
                      <span className="lead-custom-label">Investor Structure / Type:</span>
                      <div className="lead-custom-value">
                        {selectedLead.investorType ||
                          selectedLead.customFields?.investorType ||
                          'Direct Prospect'}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── 6. Additional Custom Attributes (Dynamic - Nothing Hidden) ── */}
              {(() => {
                const knownKeys = new Set([
                  'investmentCapacity',
                  'capacityRange',
                  'investmentRange',
                  'preferredAssetClass',
                  'assetClass',
                  'horizon',
                  'investmentHorizon',
                  'investorType',
                  'budgetRange',
                  'budget',
                  'preferredLocation',
                  'readyToRegister',
                  'targetDevelopment',
                  'project',
                  'preferredProject',
                  'preferredVisitDate',
                  'preferredTimeSlot',
                  'preferredLanguage',
                  'preferredContactTime',
                  'leadScore',
                  'message',
                  'userMessage',
                  'customerNotes',
                  'dispositionReason',
                  'irmPreferencesConfirmed',
                ]);

                const activeDefs = storageService
                  .getCustomFieldDefinitions(tenant?.id)
                  .filter(d => d.active !== false && (d.module === 'leads' || !d.module));

                const rows: Array<{ id: string; label: string; value: string }> = [];

                activeDefs.forEach(def => {
                  const key = def.fieldKey || def.id;
                  if (knownKeys.has(key)) return;
                  const rawVal = selectedLead.customFields?.[key] ?? (selectedLead as any)[key];
                  if (rawVal !== undefined && rawVal !== null && rawVal !== '') {
                    rows.push({
                      id: def.id,
                      label: def.label || key.replace(/([A-Z])/g, ' $1'),
                      value: String(rawVal),
                    });
                  }
                });

                if (selectedLead.customFields) {
                  Object.entries(selectedLead.customFields).forEach(([k, v]) => {
                    if (knownKeys.has(k)) return;
                    if (rows.some(r => r.id === k || r.label.toLowerCase() === k.toLowerCase())) return;
                    if (v !== undefined && v !== null && v !== '') {
                      rows.push({
                        id: k,
                        label: k.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()),
                        value: String(v),
                      });
                    }
                  });
                }

                if (rows.length === 0) return null;

                return (
                  <div className="card lead-detail-card">
                    <h4 className="lead-detail-title">Extended Lead Attributes</h4>
                    <div className="lead-detail-grid">
                      {rows.map(item => (
                        <div key={item.id}>
                          <span className="lead-detail-label">{item.label}:</span>
                          <div className="lead-detail-value">{item.value}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* ── 7. Message from Visitor / Lead Notes ── */}
              <div className="card lead-detail-card">
                <h4 className="lead-detail-title">Message &amp; Requirements from Lead</h4>
                <div className="lead-user-message-box">
                  {userMessage ? (
                    <div className="lead-user-message-text">{userMessage}</div>
                  ) : (
                    <div className="lead-user-message-empty">No written note provided by visitor</div>
                  )}
                </div>
                {selectedLead.customFields?.dispositionReason && (
                  <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 6, backgroundColor: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Disposition Reason:</span>
                    <div style={{ fontSize: '12px', marginTop: 2, color: 'var(--text-primary)' }}>
                      {String(selectedLead.customFields.dispositionReason)}
                    </div>
                  </div>
                )}
              </div>

              {/* ── 8. Linked Site Visits (Real Estate / Jamin) ── */}
              {(isJamin || leadSiteVisits.length > 0) && (
                <div className="card lead-detail-card">
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
                            {(sv.outcomeNotes || sv.visitorNote) && (
                              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: 3, fontStyle: 'italic' }}>
                                "{sv.outcomeNotes || sv.visitorNote}"
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

              {/* ── 9. Consultations (Advisory / GHL) ── */}
              {leadConsultations.length > 0 && (
                <div className="card lead-detail-card">
                  <h4 className="lead-detail-title" style={{ marginBottom: 10 }}>
                    Consultations ({leadConsultations.length})
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {leadConsultations.map(c => (
                      <div
                        key={c.id}
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
                            {c.scheduledAt} — <span style={{ color: 'var(--primary-600)' }}>{c.consultantName}</span>
                          </div>
                          {c.agenda && (
                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: 2 }}>
                              Agenda: <strong>{c.agenda}</strong>
                            </div>
                          )}
                          {c.outcomeNotes && (
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: 3, fontStyle: 'italic' }}>
                              "{c.outcomeNotes}"
                            </div>
                          )}
                        </div>
                        <StatusChip status={c.status} size="sm" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── 10. Call Recordings & Transcripts ── */}
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

              {/* ── 11. Activity & Audit History Timeline (Jamin Only) ── */}
              {(isJaminUser || tenant?.slug === 'jamin' || tenant?.id === 't-jamin-02' || tenant?.id === '2' || !tenant) && (() => {
                const allLogs = storageService.getAuditLogs(tenant?.id) || [];
                const targetLeadId = selectedLead.id;
                const phoneDigits = (selectedLead.phone || '').replace(/\D/g, '').slice(-10);
                const targetName = (selectedLead.name || '').toLowerCase();

                const leadLogs = allLogs.filter(l => {
                  if (targetLeadId && (l.entityId === targetLeadId || l.entityId === String(targetLeadId))) return true;
                  if (l.details && phoneDigits && l.details.includes(phoneDigits)) return true;
                  if (l.details && targetName && l.details.toLowerCase().includes(targetName)) return true;
                  return false;
                });

                return (
                  <div className="card lead-detail-card">
                    <h4 className="lead-detail-title" style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <History size={16} color="var(--primary-600)" /> Activity &amp; Audit Timeline ({leadLogs.length})
                    </h4>
                    {leadLogs.length === 0 ? (
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', padding: '12px', backgroundColor: 'var(--bg-card-subtle, #f9fafb)', borderRadius: 6, textAlign: 'center' }}>
                        No audit activities recorded for this lead yet.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', position: 'relative', paddingLeft: 16, borderLeft: '2px solid var(--border-base)', gap: 12, marginLeft: 6 }}>
                        {leadLogs.map((log, idx) => {
                          let formattedTime = log.timestamp || '';
                          if (formattedTime) {
                            const d = new Date(formattedTime);
                            if (!isNaN(d.getTime())) {
                              formattedTime = d.toLocaleString('en-IN', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                                second: '2-digit',
                                hour12: true,
                              });
                            }
                          }

                          return (
                            <div
                              key={log.id || idx}
                              style={{
                                position: 'relative',
                                backgroundColor: 'var(--bg-surface, #ffffff)',
                                border: '1px solid var(--border-base)',
                                borderRadius: 6,
                                padding: '8px 12px',
                              }}
                            >
                              <div
                                style={{
                                  position: 'absolute',
                                  left: -22,
                                  top: 12,
                                  width: 10,
                                  height: 10,
                                  borderRadius: '50%',
                                  backgroundColor: log.action.includes('DELETE') ? '#ef4444' : log.action.includes('CREATE') ? '#10b981' : 'var(--primary-600)',
                                  border: '2px solid #ffffff',
                                  boxShadow: '0 0 0 1px var(--border-base)',
                                }}
                              />
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, flexWrap: 'wrap' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <span
                                    style={{
                                      fontSize: 10,
                                      fontWeight: 700,
                                      padding: '1px 5px',
                                      borderRadius: 4,
                                      backgroundColor: log.action.includes('DELETE') ? '#fee2e2' : log.action.includes('CREATE') ? '#dcfce7' : '#e0e7ff',
                                      color: log.action.includes('DELETE') ? '#b91c1c' : log.action.includes('CREATE') ? '#15803d' : '#4338ca',
                                      textTransform: 'uppercase',
                                    }}
                                  >
                                    {log.action.replace(/_/g, ' ')}
                                  </span>
                                  <span style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                    <UserIcon size={10} /> <strong>{log.actorName || log.actorEmail || 'System'}</strong>
                                  </span>
                                </div>
                                <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>
                                  {formattedTime}
                                </span>
                              </div>
                              {log.details && (
                                <div style={{ fontSize: 12, color: 'var(--text-primary)', marginTop: 4, lineHeight: 1.35 }}>
                                  {log.details}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
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
                type="tel"
                className="form-input"
                required
                autoComplete="off"
                name="fld-phone-nexus"
                value={formData.phone || ''}
                onChange={e => {
                  const numericOnly = e.target.value.replace(/[^0-9+\s\-()]/g, '');
                  setFormData({ ...formData, phone: numericOnly });
                }}
                onKeyDown={e => {
                  if (
                    ['Backspace', 'Delete', 'Tab', 'Escape', 'Enter', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key) ||
                    (e.ctrlKey || e.metaKey)
                  ) {
                    return;
                  }
                  if (!/[0-9+\s\-()]/.test(e.key)) {
                    e.preventDefault();
                  }
                }}
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

          <div className="lead-form-grid-2">
            <div className="form-group">
              <label className="form-label">Lead Status</label>
              <select
                className="form-select"
                value={formData.status || 'New'}
                onChange={e => setFormData({ ...formData, status: e.target.value as any })}
              >
                <option value="New">New</option>
                <option value="Contacted">Contacted</option>
                <option value="Qualified">Qualified</option>
                <option value="Proposal">Proposal</option>
                <option value="Negotiation">Negotiation</option>
                <option value="Interested">Interested</option>
                <option value="Follow-up Required">Follow-up Required</option>
                <option value="Callback">Callback</option>
                <option value="No Response">No Response</option>
                <option value="Not Interested">Not Interested</option>
                <option value="Junk">Junk</option>
                <option value="Lost">Lost</option>
                <option value="Converted">Converted</option>
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Target Development / Project</label>
                  <select
                    className="form-select"
                    value={formData.targetDevelopment || formData.customFields?.targetDevelopment || formData.customFields?.project || ''}
                    onChange={e => {
                      const val = e.target.value;
                      setFormData(prev => ({
                        ...prev,
                        targetDevelopment: val,
                        customFields: {
                          ...prev.customFields,
                          targetDevelopment: val,
                          project: val,
                        },
                      }));
                    }}
                  >
                    <option value="">-- Select Available Project --</option>
                    {availableProjects.map(proj => (
                      <option key={proj.id} value={proj.name}>
                        {proj.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="lead-form-grid-2">
                  <div className="form-group">
                    <label className="form-label">Plot Budget Range</label>
                    <select
                      className="form-select"
                      value={formData.customFields?.budgetRange || ''}
                      onChange={e =>
                        setFormData({
                          ...formData,
                          customFields: { ...formData.customFields, budgetRange: e.target.value },
                        })
                      }
                    >
                      <option value="">-- Not Selected --</option>
                      <option value="₹25L - ₹45L">₹25L - ₹45L</option>
                      <option value="₹45L - ₹65L">₹45L - ₹65L</option>
                      <option value="₹65L - ₹90L">₹65L - ₹90L</option>
                      <option value="₹90L+">₹90L+</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Ready to Register / Timeline</label>
                    <select
                      className="form-select"
                      value={formData.customFields?.readyToRegister || ''}
                      onChange={e =>
                        setFormData({
                          ...formData,
                          customFields: { ...formData.customFields, readyToRegister: e.target.value },
                        })
                      }
                    >
                      <option value="">-- Not Selected --</option>
                      <option value="Immediate">Immediate</option>
                      <option value="Within 15 Days">Within 15 Days</option>
                      <option value="Within 30 Days">Within 30 Days</option>
                      <option value="Within 60 Days">Within 60 Days</option>
                      <option value="Exploring / Flexible">Exploring / Flexible</option>
                    </select>
                  </div>
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
        title="Convert Lead to Customer"
        subtitle={`Promote ${selectedLead?.name || ''} to your Customer 360 database`}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setIsConvertModalOpen(false)}>
              Cancel
            </button>
            <button
              className="btn btn-primary"
              onClick={handleConfirmConvert}
              style={{
                background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
                borderColor: '#16a34a',
                color: '#ffffff',
                fontWeight: 600,
              }}
            >
              ✓ Confirm & Convert to Customer
            </button>
          </>
        }
      >
        <div className="lead-modal-content" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <p className="lead-modal-desc" style={{ fontSize: '13.5px', color: 'var(--text-secondary)' }}>
            Converting this prospect will mark the lead as <strong>Converted</strong> and create a permanent active record in <strong>Customer 360</strong>.
          </p>

          <div style={{
            background: 'var(--bg-card-subtle, #f8fafc)',
            border: '1px solid var(--border-base, #e2e8f0)',
            borderRadius: 8,
            padding: '12px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            fontSize: '13px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Customer Name:</span>
              <strong>{selectedLead?.name}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Phone:</span>
              <strong>{selectedLead?.phone}</strong>
            </div>
            {selectedLead?.email && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Email:</span>
                <span>{selectedLead?.email}</span>
              </div>
            )}
            {selectedLead?.location && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Location / Interest:</span>
                <span>{selectedLead?.location}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Assigned Agent:</span>
              <span>{(() => { const n = selectedLead?.assignedAgentName || ''; return (!n || n === 'Unassigned' || n.toLowerCase() === 'yanosh') ? 'Unassigned' : n; })()}</span>
            </div>
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

      {/* ── Quick Schedule Follow-up Modal ──────────────────────── */}
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
          {jaminAgents.length > 0 && (
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
              placeholder="e.g. Call client regarding requirements..."
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
              <label className="form-label">Visit Notes / Requirements</label>
              <textarea
                className="form-textarea"
                rows={2}
                value={leadVisitNotes}
                onChange={e => setLeadVisitNotes(e.target.value)}
                placeholder="e.g. Metro pickup required, visiting with family, visit reason..."
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
                  {(apiAgents && apiAgents.length > 0 ? apiAgents : []).map((agent: any) => (
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
                  {Object.values(aiDistribution).flat().length} leads distributed across {(apiAgents?.length || 0)} agents
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
              {(apiAgents && apiAgents.length > 0 ? apiAgents : []).map((agent: any, agentIdx: number) => {
                const agentLeads = (aiDistribution as any)[agent.id] || [];
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
                        agentLeads.map((lead: Lead) => (
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
                                  disabled={agentIdx === (apiAgents?.length || 1) - 1}
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

