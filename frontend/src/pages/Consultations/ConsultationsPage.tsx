import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar,
  Plus,
  Phone,
  Clock,
  Zap,
  Users,
  CheckCircle2,
  CalendarClock,
  UserCheck,
  ShieldCheck,
  Download,
  XCircle,
} from 'lucide-react';
import { Consultation, Investor, IrmProfile, Lead, Followup } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useCall } from '../../context/CallContext';
import {
  getConsultations,
  saveConsultation as apiSaveConsultation,
  getInvestors,
  getLeads,
  getFollowups,
  getCompanyIrms,
} from '../../services/ghlApiService';
import { loadAgentDirectory, AssignableAgent } from '../../services/agentDirectory';
import { storageService } from '../../services/storageService';
import { DataTable, Column, RowAction } from '../../components/common/DataTable';
import { FilterBar } from '../../components/common/FilterBar';
import { Modal } from '../../components/common/Modal';
import { Drawer } from '../../components/common/Drawer';
import { LeadDetailDrawerContent } from '../../components/common/LeadDetailDrawerContent';
import './ConsultationsPage.css';

// ─── Status Options ──────────────────────────────────────────────────────────
const STATUS_OPTIONS: { value: Consultation['status']; label: string }[] = [
  { value: 'Scheduled', label: 'Scheduled' },
  { value: 'Completed', label: 'Completed' },
  { value: 'Rescheduled', label: 'Rescheduled' },
  { value: 'Cancelled', label: 'Cancelled' },
  { value: 'No-show', label: 'No-show' },
];

export type ConsultationTab = 'all' | 'scheduled' | 'live_transfers';

// ─── Helper to classify Live Call Transfer vs Scheduled Session ──────────────
export const isLiveTransferConsultation = (c: Consultation): boolean => {
  const agenda = (c.agenda || '').toLowerCase();
  const outcome = (c.outcomeNotes || '').toLowerCase();
  return (
    agenda.includes('connected to irm') ||
    agenda.includes('connected to agent') ||
    agenda.includes('live transfer') ||
    agenda.includes('warm handoff') ||
    agenda.includes('call transfer') ||
    outcome.includes('live transfer')
  );
};

// ─── Form State Shape ────────────────────────────────────────────────────────
interface ConsultationForm {
  investorId: string;
  investorName: string;
  investorPhone: string;
  scheduledAt: string;
  consultantId: string;
  consultantName: string;
  status: Consultation['status'];
  agenda: string;
  outcomeNotes: string;
  referredByAgentName: string;
}

const getTomorrowSlot = (): string => {
  const d = new Date(Date.now() + 86400000);
  d.setHours(15, 0, 0, 0);
  return d.toISOString().slice(0, 16);
};

const BLANK_FORM: ConsultationForm = {
  investorId: '',
  investorName: '',
  investorPhone: '',
  scheduledAt: '',
  consultantId: '',
  consultantName: '',
  status: 'Scheduled',
  agenda: '',
  outcomeNotes: '',
  referredByAgentName: '',
};

// ─── Component ───────────────────────────────────────────────────────────────
export const ConsultationsPage: React.FC = () => {
  const { tenant, user } = useAuth();
  const { initiateCall } = useCall();

  // ── Role scoping ──────────────────────────────────────────────────────────
  const roleCode = (user?.role?.code || '').toLowerCase();
  const isExec = roleCode === 'sales_executive';
  const isAdmin =
    roleCode === 'company_admin' ||
    roleCode === 'admin' ||
    roleCode === 'super_admin' ||
    Boolean(user?.role?.name?.toLowerCase().includes('admin'));

  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [investors, setInvestors] = useState<Investor[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [followups, setFollowups] = useState<Followup[]>([]);
  const [availableIrms, setAvailableIrms] = useState<IrmProfile[]>([]);
  const [agents, setAgents] = useState<AssignableAgent[]>([]);
  const [drawerConsultation, setDrawerConsultation] = useState<Consultation | null>(null);

  // ── Tab state (Option 1) ──────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<ConsultationTab>('all');

  // ── Filters ───────────────────────────────────────────────────────────────
  const [consultantFilter, setConsultantFilter] = useState('All');
  const [agentFilter, setAgentFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');

  // ── Create / Edit / Reschedule Modal ──────────────────────────────────────
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingConsultation, setEditingConsultation] = useState<Consultation | null>(null);
  const [isRescheduleMode, setIsRescheduleMode] = useState(false);
  const [form, setForm] = useState<ConsultationForm>(BLANK_FORM);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof ConsultationForm, string>>>({});

  // ── Data loading ──────────────────────────────────────────────────────────
  const loadData = async () => {
    try {
      const [consList, invList, fList, lList, irmsList, agentDir] = await Promise.all([
        getConsultations(tenant?.id),
        getInvestors(tenant?.id),
        getFollowups(tenant?.id),
        getLeads(tenant?.id),
        getCompanyIrms(tenant?.id),
        loadAgentDirectory(tenant?.id, user?.id),
      ]);
      setConsultations(consList || []);
      setInvestors(invList || []);
      setFollowups(fList || []);
      setLeads(lList || []);

      const irms = irmsList && irmsList.length > 0
        ? irmsList
        : (storageService.getIrms ? storageService.getIrms(tenant?.id) : []);
      setAvailableIrms(irms);
      setAgents(agentDir?.agents || []);
    } catch (err) {
      console.error('Failed to load consultations data', err);
    }
  };

  useEffect(() => {
    loadData();
    const handleUpdate = () => loadData();
    window.addEventListener('nexus_storage_updated', handleUpdate);
    return () => window.removeEventListener('nexus_storage_updated', handleUpdate);
  }, [tenant?.id]);

  // ── Helper to parse timestamp for newest-first sorting / deduplication ────
  const getConsultationTimestamp = (c: Consultation): number => {
    const match = (c.id || '').match(/^cns-(\d+)$/);
    if (match) {
      const ts = parseInt(match[1], 10);
      if (!isNaN(ts) && ts > 10000000000) return ts;
    }
    if (c.scheduledAt) {
      const parsed = Date.parse(c.scheduledAt);
      if (!isNaN(parsed)) return parsed;
    }
    if (match) {
      const ts = parseInt(match[1], 10);
      if (!isNaN(ts)) return ts;
    }
    return 0;
  };

  // ── Scoped consultations for current viewer ──────────────────────────────
  // For Sales Exec: ONLY show their own consultation details
  // For Admin: show consultations from all sales exec roles
  const scopedConsultations = useMemo(() => {
    if (!isExec) {
      return consultations;
    }
    const userName = (user?.name || '').toLowerCase();
    const userId = String(user?.id || '');
    return consultations.filter(c => {
      const refName = (c.referredByAgentName || '').toLowerCase();
      const consultantName = (c.consultantName || '').toLowerCase();
      const consultantId = String(c.consultantId || '');
      return refName === userName || consultantName === userName || consultantId === userId;
    });
  }, [consultations, isExec, user?.name, user?.id]);

  // ── Group by investor & derive latestByInvestor (at most ONE row per investor) ──
  const latestByInvestor = useMemo(() => {
    const phoneToInvestorId = new Map<string, string>();
    for (const c of scopedConsultations) {
      if (c.investorId && c.investorId.trim()) {
        const phone = (c.investorPhone || '').replace(/\D/g, '').slice(-10);
        if (phone) phoneToInvestorId.set(phone, c.investorId.trim());
      }
    }

    const getInvestorKey = (c: Consultation): string => {
      if (c.investorId && c.investorId.trim()) {
        return `id:${c.investorId.trim()}`;
      }
      const phone = (c.investorPhone || '').replace(/\D/g, '').slice(-10);
      if (phone && phoneToInvestorId.has(phone)) {
        return `id:${phoneToInvestorId.get(phone)}`;
      }
      if (phone) {
        return `phone:${phone}`;
      }
      return `cns:${c.id}`;
    };

    const map = new Map<string, Consultation>();
    for (const c of scopedConsultations) {
      const key = getInvestorKey(c);
      const existing = map.get(key);
      if (!existing) {
        map.set(key, c);
      } else {
        if (getConsultationTimestamp(c) > getConsultationTimestamp(existing)) {
          map.set(key, c);
        }
      }
    }

    return Array.from(map.values()).sort(
      (a, b) => getConsultationTimestamp(b) - getConsultationTimestamp(a)
    );
  }, [scopedConsultations]);

  // ── Top-level KPI Metrics Computation ────────────────────────────────────
  const stats = useMemo(() => {
    const total = latestByInvestor.length;
    const liveTransfers = latestByInvestor.filter(isLiveTransferConsultation).length;
    const scheduledSessions = total - liveTransfers;
    const completed = latestByInvestor.filter(c => c.status === 'Completed').length;
    return { total, liveTransfers, scheduledSessions, completed };
  }, [latestByInvestor]);

  // ── Filter options (Robust options from both directory and consultation records) ──
  const consultantOptions = useMemo(() => {
    const set = new Set<string>();
    availableIrms.forEach(irm => {
      if (irm.name) set.add(irm.name);
    });
    scopedConsultations.forEach(c => {
      if (c.consultantName) set.add(c.consultantName);
    });
    leads.forEach(l => {
      if (l.assignedIrmName) set.add(l.assignedIrmName);
    });
    return Array.from(set)
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b))
      .map(name => ({ value: name, label: name }));
  }, [availableIrms, scopedConsultations, leads]);

  const agentOptions = useMemo(() => {
    const set = new Set<string>();
    agents.forEach(a => {
      if (a.name) set.add(a.name);
    });
    consultations.forEach(c => {
      if (c.referredByAgentName) set.add(c.referredByAgentName);
    });
    followups.forEach(f => {
      if (f.assignedAgentName) set.add(f.assignedAgentName);
    });
    leads.forEach(l => {
      if (l.assignedAgentName) set.add(l.assignedAgentName);
    });
    return Array.from(set)
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b))
      .map(name => ({ value: name, label: name }));
  }, [agents, consultations, followups, leads]);

  // ── Leads from Follow-ups Page (Scoped by role for consultation booking) ──
  const followupLeads = useMemo(() => {
    const list: Array<{
      id: string;
      name: string;
      phone: string;
      email?: string;
      assignedAgentId?: string;
      assignedAgentName?: string;
      assignedIrmId?: string;
      assignedIrmName?: string;
      investmentAmount?: string;
      notes?: string;
    }> = [];

    const seenIds = new Set<string>();
    const seenPhones = new Set<string>();

    const checkAgentMatch = (agentId?: string | number, agentName?: string) => {
      if (!isExec) return true;
      const uName = (user?.name || '').toLowerCase().trim();
      const uId = String(user?.id || '').trim();
      const aId = String(agentId || '').trim();
      const aName = (agentName || '').toLowerCase().trim();
      return (aId && aId === uId) || (aName && aName === uName);
    };

    // Filter out junk / not interested
    const excludedLeadIds = new Set(
      leads
        .filter(l => {
          const s = (l.status || '').toLowerCase();
          return s === 'not interested' || s === 'junk' || s === 'wrong number';
        })
        .map(l => String(l.id))
    );

    // 1. Followup items
    (followups || []).forEach(f => {
      const contactId = String(f.contactId || f.id);
      if (excludedLeadIds.has(contactId)) return;

      const phoneDigits = (f.contactPhone || '').replace(/\D/g, '').slice(-10);
      const leadMatch = (leads || []).find(
        l =>
          String(l.id) === contactId ||
          (l.phone && (l.phone || '').replace(/\D/g, '').slice(-10) === phoneDigits)
      );

      const agentId = f.assignedAgentId || leadMatch?.assignedAgentId;
      const agentName = f.assignedAgentName || leadMatch?.assignedAgentName;
      if (!checkAgentMatch(agentId, agentName)) return;

      const id = String(leadMatch?.id || f.contactId || f.id);
      if (seenIds.has(id) || (phoneDigits && seenPhones.has(phoneDigits))) return;

      seenIds.add(id);
      if (phoneDigits) seenPhones.add(phoneDigits);

      list.push({
        id,
        name: f.contactName || leadMatch?.name || 'Lead',
        phone: f.contactPhone || leadMatch?.phone || '',
        email: (f as any).contactEmail || leadMatch?.email || '',
        assignedAgentId: String(agentId || ''),
        assignedAgentName: agentName || '',
        assignedIrmId: leadMatch?.assignedIrmId,
        assignedIrmName: leadMatch?.assignedIrmName,
        investmentAmount:
          (leadMatch as any)?.investmentAmount ||
          leadMatch?.customFields?.investmentCapacity ||
          '',
        notes: f.notes || leadMatch?.notes || '',
      });
    });

    // 2. Leads with Follow-up Required status or nextFollowupDate
    (leads || []).forEach(l => {
      if (excludedLeadIds.has(String(l.id))) return;
      const isFollowupStatus =
        (l.status || '').toLowerCase().includes('follow') ||
        Boolean(l.nextFollowupDate);
      if (!isFollowupStatus) return;
      if (!checkAgentMatch(l.assignedAgentId, l.assignedAgentName)) return;

      const id = String(l.id);
      const phoneDigits = (l.phone || '').replace(/\D/g, '').slice(-10);
      if (seenIds.has(id) || (phoneDigits && seenPhones.has(phoneDigits))) return;

      seenIds.add(id);
      if (phoneDigits) seenPhones.add(phoneDigits);

      list.push({
        id,
        name: l.name,
        phone: l.phone,
        email: l.email || '',
        assignedAgentId: String(l.assignedAgentId || ''),
        assignedAgentName: l.assignedAgentName || '',
        assignedIrmId: l.assignedIrmId,
        assignedIrmName: l.assignedIrmName,
        investmentAmount:
          (l as any)?.investmentAmount ||
          l.customFields?.investmentCapacity ||
          '',
        notes: l.notes || '',
      });
    });

    return list;
  }, [followups, leads, isExec, user?.id, user?.name]);

  // ── Filtered list according to active Tab and FilterBar ───────────────────
  const filteredConsultations = useMemo(() => {
    return latestByInvestor.filter(c => {
      const isLive = isLiveTransferConsultation(c);
      if (activeTab === 'scheduled' && isLive) return false;
      if (activeTab === 'live_transfers' && !isLive) return false;

      // Filter by Assigned IRM
      if (consultantFilter !== 'All') {
        const cName = (c.consultantName || '').toLowerCase();
        if (cName !== consultantFilter.toLowerCase()) return false;
      }

      // Filter by Referred By (Sales Exec) - Admin only
      if (!isExec && agentFilter !== 'All') {
        const refName = (c.referredByAgentName || '').toLowerCase();
        if (refName !== agentFilter.toLowerCase()) return false;
      }

      // Filter by Status (Admin advanced filter)
      if (statusFilter !== 'All') {
        if ((c.status || '').toLowerCase() !== statusFilter.toLowerCase()) return false;
      }

      return true;
    });
  }, [latestByInvestor, activeTab, consultantFilter, agentFilter, statusFilter, isExec]);

  // ── Auto-fill Lead Details on Selection ───────────────────────────────────
  const handleSelectLead = (selectedLeadId: string) => {
    const lead = followupLeads.find(l => l.id === selectedLeadId);
    if (!lead) {
      setField('investorId', '');
      setField('investorName', '');
      setField('investorPhone', '');
      return;
    }

    setField('investorId', lead.id);
    setField('investorName', lead.name);
    setField('investorPhone', lead.phone || '');

    // Auto-fill IRM Specialist: use lead's assigned IRM if available, else first available IRM
    if (lead.assignedIrmName) {
      setField('consultantName', lead.assignedIrmName);
      setField('consultantId', lead.assignedIrmId || '');
    } else if (availableIrms.length > 0) {
      setField('consultantName', availableIrms[0].name);
      setField('consultantId', availableIrms[0].id || '');
    }

    // Auto-fill Referred By Sales Exec
    if (isExec) {
      setField('referredByAgentName', user?.name || '');
    } else if (lead.assignedAgentName) {
      setField('referredByAgentName', lead.assignedAgentName);
    }

    // Auto-fill Agenda
    if (lead.notes && lead.notes.trim()) {
      setField(
        'agenda',
        `Follow-up advisory session for ${lead.name}. Context: ${lead.notes.replace(/\n+/g, ' ').slice(0, 100)}`
      );
    } else {
      setField(
        'agenda',
        `Commercial REIT yield analysis & portfolio consultation for ${lead.name}.`
      );
    }
  };

  // ── Admin Export Consultations to CSV ─────────────────────────────────────
  const handleExportCsv = () => {
    if (filteredConsultations.length === 0) {
      alert('No consultations to export.');
      return;
    }
    const headers = [
      'ID',
      'Session Slot',
      'Lead / Investor Name',
      'Phone',
      'Type',
      'Status',
      'Assigned IRM',
      'Referred By (Sales Exec)',
      'Agenda',
      'Outcome Notes',
    ];
    const rows = filteredConsultations.map(c => [
      `"${c.id}"`,
      `"${c.scheduledAt || ''}"`,
      `"${(c.investorName || '').replace(/"/g, '""')}"`,
      `"${(c.investorPhone || '').replace(/"/g, '""')}"`,
      `"${isLiveTransferConsultation(c) ? 'Live Call Transfer' : 'Scheduled Session'}"`,
      `"${c.status || 'Scheduled'}"`,
      `"${(c.consultantName || '').replace(/"/g, '""')}"`,
      `"${(c.referredByAgentName || '').replace(/"/g, '""')}"`,
      `"${(c.agenda || '').replace(/"/g, '""')}"`,
      `"${(c.outcomeNotes || '').replace(/"/g, '""')}"`,
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `consultations_report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ── Admin Cancel Consultation Action ──────────────────────────────────────
  const handleCancelConsultation = async (c: Consultation) => {
    if (!window.confirm(`Are you sure you want to cancel the consultation for ${c.investorName}?`)) {
      return;
    }
    try {
      await apiSaveConsultation({
        ...c,
        status: 'Cancelled',
        outcomeNotes: c.outcomeNotes ? `${c.outcomeNotes} | Cancelled by Admin` : 'Cancelled by Admin',
      });
      await loadData();
    } catch (err) {
      console.error('Failed to cancel consultation', err);
    }
  };

  // ── Modal helpers ─────────────────────────────────────────────────────────
  const openCreateModal = () => {
    setEditingConsultation(null);
    setIsRescheduleMode(false);
    const defaultIrm = availableIrms.length > 0 ? availableIrms[0] : null;

    setForm({
      ...BLANK_FORM,
      scheduledAt: getTomorrowSlot(),
      agenda: 'Commercial REIT yield analysis & portfolio consultation.',
      consultantId: defaultIrm?.id || '',
      consultantName: defaultIrm?.name || (user?.name ?? 'Advisor'),
      referredByAgentName: isExec ? (user?.name ?? '') : '',
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  const openRescheduleModal = (c: Consultation) => {
    setEditingConsultation(c);
    setIsRescheduleMode(true);
    setForm({
      investorId: c.investorId,
      investorName: c.investorName,
      investorPhone: c.investorPhone,
      scheduledAt: c.scheduledAt,
      consultantId: c.consultantId,
      consultantName: c.consultantName,
      status: 'Rescheduled',
      agenda: c.agenda || '',
      outcomeNotes: c.outcomeNotes || '',
      referredByAgentName: c.referredByAgentName || '',
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingConsultation(null);
    setIsRescheduleMode(false);
    setForm(BLANK_FORM);
    setFormErrors({});
  };

  const setField = <K extends keyof ConsultationForm>(key: K, value: ConsultationForm[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
    if (formErrors[key]) setFormErrors(prev => ({ ...prev, [key]: undefined }));
  };

  const handleSaveConsultation = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const errors: Partial<Record<keyof ConsultationForm, string>> = {};
    if (!form.investorId) errors.investorId = 'Please select a lead.';
    if (!form.scheduledAt.trim()) errors.scheduledAt = 'Consultation slot is required.';
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    const isEdit = !!editingConsultation;
    const cons: Consultation = {
      id: editingConsultation ? editingConsultation.id : `cns-${Date.now()}`,
      companyId: tenant?.id || 't-ghl-01',
      investorId: form.investorId,
      investorName: form.investorName,
      investorPhone: form.investorPhone,
      scheduledAt: form.scheduledAt.trim(),
      consultantId: form.consultantId.trim() || (user?.id ?? 'usr-admin'),
      consultantName: form.consultantName.trim() || (user?.name ?? 'Advisor'),
      status: form.status,
      agenda: form.agenda.trim(),
      outcomeNotes: form.outcomeNotes.trim() || undefined,
      referredByAgentName: form.referredByAgentName.trim() || (isExec ? (user?.name ?? undefined) : undefined),
    };

    apiSaveConsultation(cons).then(loadData).catch(console.error);

    try {
      const raw = localStorage.getItem('nexus_audit_logs');
      const logs = raw ? JSON.parse(raw) : [];
      logs.unshift({
        id: `aud-${Date.now()}`,
        timestamp: 'Just now',
        actorName: user?.name || 'Advisor',
        actorEmail: user?.email || 'advisor@ghl.com',
        action: isEdit
          ? isRescheduleMode
            ? 'CONSULTATION_RESCHEDULED'
            : 'CONSULTATION_UPDATED'
          : 'CONSULTATION_SCHEDULED',
        entityType: 'Consultation',
        entityId: cons.id,
        companyId: tenant?.id,
        companyName: tenant?.name,
        details: isEdit
          ? isRescheduleMode
            ? `Rescheduled consultation with ${cons.investorName} to ${cons.scheduledAt}.`
            : `Updated consultation with ${cons.investorName} (Status: ${cons.status}).`
          : `Scheduled wealth advisory consultation with ${cons.investorName}.`,
      });
      localStorage.setItem('nexus_audit_logs', JSON.stringify(logs));
      window.dispatchEvent(new Event('nexus_storage_updated'));
    } catch {}

    closeModal();
  };

  // ── Format Date Helper ────────────────────────────────────────────────────
  const formatSlotDisplay = (slot: string) => {
    try {
      const d = new Date(slot);
      if (!isNaN(d.getTime())) {
        return d.toLocaleString('en-IN', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        });
      }
    } catch {}
    return slot;
  };

  // ── Table columns ─────────────────────────────────────────────────────────
  const columns: Column<Consultation>[] = [
    {
      key: 'scheduledAt',
      header: 'Session Slot',
      sortable: true,
      width: '18%',
      render: c => (
        <div className="consultation-slot-cell">
          <div className="consultation-slot-title">
            <Clock size={13} className="consultation-slot-clock-icon" />
            <span>{formatSlotDisplay(c.scheduledAt)}</span>
          </div>
          <div className="consultation-slot-id">ID: #{c.id}</div>
        </div>
      ),
    },
    {
      key: 'id',
      header: 'Type',
      width: '14%',
      render: c => {
        const isLive = isLiveTransferConsultation(c);
        return isLive ? (
          <span className="consultation-type-badge live-transfer">
            <span className="live-pulse-dot" />
            <Zap size={11} /> Live Call Transfer
          </span>
        ) : (
          <span className="consultation-type-badge scheduled">
            <CalendarClock size={11} /> Scheduled Session
          </span>
        );
      },
    },
    {
      key: 'investorName',
      header: 'Customer Profile',
      sortable: true,
      width: isExec ? '22%' : '18%',
      render: c => (
        <div className="consultation-customer-cell">
          <div className="consultation-client-name">{c.investorName || 'Unknown Investor'}</div>
          <div className="consultation-client-phone">
            <Phone size={11} style={{ marginRight: 4 }} />
            {c.investorPhone || '—'}
          </div>
        </div>
      ),
    },
    ...(!isExec
      ? [
          {
            key: 'referredByAgentName' as const,
            header: 'Referred By (Sales Exec)',
            width: '16%',
            render: (c: Consultation) => (
              <div className="consultation-agent-cell">
                {c.referredByAgentName ? (
                  <span className="consultation-agent-pill">
                    <UserCheck size={12} /> {c.referredByAgentName}
                  </span>
                ) : (
                  <span className="consultation-agent-unassigned">—</span>
                )}
              </div>
            ),
          },
        ]
      : []),
    {
      key: 'consultantName',
      header: 'Assigned IRM',
      width: isExec ? '18%' : '15%',
      render: c => (
        <div className="consultation-irm-cell">
          <span className="consultation-irm-pill">
            <ShieldCheck size={12} /> {c.consultantName || 'Unassigned'}
          </span>
        </div>
      ),
    },
    {
      key: 'agenda',
      header: 'Agenda / Discussion Reason',
      width: isExec ? '25%' : '18%',
      render: c => (
        <div className="consultation-agenda-cell">
          <span className="consultation-agenda-text" title={c.agenda}>{c.agenda || '—'}</span>
          {c.outcomeNotes && (
            <div className="consultation-outcome-preview" title={c.outcomeNotes}>
              <strong>Outcome:</strong> {c.outcomeNotes}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      width: '10%',
      render: c => {
        const statusClass = (c.status || 'Scheduled').toLowerCase().replace(/\s+/g, '-');
        return (
          <span className={`consultation-status-badge status-${statusClass}`}>
            {c.status || 'Scheduled'}
          </span>
        );
      },
    },
  ];

  // ── Row actions ───────────────────────────────────────────────────────────
  const rowActions: RowAction<Consultation>[] = [
    {
      label: 'Call Customer',
      icon: <Phone size={14} color="#10b981" style={{ marginRight: 6 }} />,
      onClick: c => initiateCall(c.investorName, c.investorPhone, 'customer', c.investorId),
    },
    {
      label: 'Reschedule',
      icon: <Clock size={14} color="#f59e0b" style={{ marginRight: 6 }} />,
      hidden: c => c.status === 'Completed' || c.status === 'Cancelled',
      onClick: c => openRescheduleModal(c),
    },
    ...(isAdmin
      ? [
          {
            label: 'Cancel Session',
            icon: <XCircle size={14} color="#ef4444" style={{ marginRight: 6 }} />,
            hidden: (c: Consultation) => c.status === 'Completed' || c.status === 'Cancelled',
            onClick: (c: Consultation) => handleCancelConsultation(c),
          },
        ]
      : []),
  ];

  // ── Empty State Content ───────────────────────────────────────────────────
  const getEmptyStateDetails = () => {
    if (activeTab === 'live_transfers') {
      return {
        title: 'No Live Call Transfers',
        desc: 'No warm handoffs have been transferred yet. When a Sales Executive connects an ongoing call to an IRM in real-time, it will appear here.',
        actionLabel: undefined,
      };
    }
    if (activeTab === 'scheduled') {
      return {
        title: 'No Scheduled Sessions',
        desc: 'There are no pre-booked consultations on record. Click "+ Schedule Consultation" to book an advisory slot.',
        actionLabel: 'Schedule Consultation',
      };
    }
    return {
      title: 'No Consultations Recorded',
      desc: 'There are currently no consultations found. Book a session or initiate a warm call transfer from the Call Center.',
      actionLabel: 'Schedule Consultation',
    };
  };

  const emptyDetails = getEmptyStateDetails();

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="consultations-page-container">
      {/* ── Page Header ──────────────────────────────────────────────────── */}
      <div className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <h1 className="page-title" style={{ margin: 0 }}>
              <Calendar size={24} color="#ef4444" /> Wealth Advisory Consultations
            </h1>
            {isAdmin && (
              <span className="admin-scope-badge">
                <ShieldCheck size={12} /> Company-Wide Directory
              </span>
            )}
          </div>
          <p className="page-subtitle" style={{ marginTop: 4 }}>
            {isAdmin
              ? `Company-wide advisory overview across all Sales Executives & IRM Specialists for ${tenant?.name || 'GHL India Ventures'}.`
              : `Your 1-on-1 private advisory sessions, scheduled appointments, and warm transfers for ${tenant?.name || 'GHL India Ventures'}.`}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {isAdmin && (
            <button
              id="consultations-export-btn"
              className="btn btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}
              onClick={handleExportCsv}
              title="Export all consultation sessions to CSV"
            >
              <Download size={14} /> Export Report
            </button>
          )}
          <button
            id="consultations-schedule-btn"
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}
            onClick={openCreateModal}
          >
            <Plus size={15} /> Schedule Consultation
          </button>
        </div>
      </div>

      {/* ── KPI Metric Cards ─────────────────────────────────────────────── */}
      <div className="consultations-kpi-grid">
        <div
          className={`consultations-kpi-card ${activeTab === 'all' ? 'active-card' : ''}`}
          onClick={() => setActiveTab('all')}
        >
          <div className="consultations-kpi-header">
            <span className="consultations-kpi-title">Total Consultations</span>
            <div className="consultations-kpi-icon-wrap total">
              <Users size={18} />
            </div>
          </div>
          <div className="consultations-kpi-value">{stats.total}</div>
          <div className="consultations-kpi-subtext">All advisory sessions recorded</div>
        </div>

        <div
          className={`consultations-kpi-card ${activeTab === 'live_transfers' ? 'active-card live-card' : ''}`}
          onClick={() => setActiveTab('live_transfers')}
        >
          <div className="consultations-kpi-header">
            <span className="consultations-kpi-title">Live Call Transfers</span>
            <div className="consultations-kpi-icon-wrap live">
              <Zap size={18} />
            </div>
          </div>
          <div className="consultations-kpi-value">{stats.liveTransfers}</div>
          <div className="consultations-kpi-subtext">
            <span className="consultations-kpi-badge live">Real-time Connect</span>
            Warm handoffs from calls
          </div>
        </div>

        <div
          className={`consultations-kpi-card ${activeTab === 'scheduled' ? 'active-card scheduled-card' : ''}`}
          onClick={() => setActiveTab('scheduled')}
        >
          <div className="consultations-kpi-header">
            <span className="consultations-kpi-title">Scheduled Sessions</span>
            <div className="consultations-kpi-icon-wrap scheduled">
              <CalendarClock size={18} />
            </div>
          </div>
          <div className="consultations-kpi-value">{stats.scheduledSessions}</div>
          <div className="consultations-kpi-subtext">
            <span className="consultations-kpi-badge scheduled">Pre-booked</span>
            Calendar appointments
          </div>
        </div>

        <div className="consultations-kpi-card">
          <div className="consultations-kpi-header">
            <span className="consultations-kpi-title">Completed Outcomes</span>
            <div className="consultations-kpi-icon-wrap completed">
              <CheckCircle2 size={18} />
            </div>
          </div>
          <div className="consultations-kpi-value">{stats.completed}</div>
          <div className="consultations-kpi-subtext">Concluded with advisory notes</div>
        </div>
      </div>

      {/* ── Option 1 Tab Navigation Bar ──────────────────────────────────── */}
      <div className="consultations-tabs-bar">
        <button
          type="button"
          className={`consultations-tab-btn ${activeTab === 'all' ? 'active' : ''}`}
          onClick={() => setActiveTab('all')}
        >
          <Users size={15} />
          <span>All Consultations</span>
          <span className="consultations-tab-pill">{stats.total}</span>
        </button>

        <button
          type="button"
          className={`consultations-tab-btn ${activeTab === 'scheduled' ? 'active' : ''}`}
          onClick={() => setActiveTab('scheduled')}
        >
          <CalendarClock size={15} />
          <span>📅 Scheduled Sessions</span>
          <span className="consultations-tab-pill">{stats.scheduledSessions}</span>
        </button>

        <button
          type="button"
          className={`consultations-tab-btn ${activeTab === 'live_transfers' ? 'active' : ''}`}
          onClick={() => setActiveTab('live_transfers')}
        >
          <Zap size={15} />
          <span>⚡ Live Call Transfers</span>
          <span className="consultations-tab-pill live">{stats.liveTransfers}</span>
        </button>
      </div>

      {/* ── Data table ───────────────────────────────────────────────────── */}
      <DataTable
        columns={columns}
        data={filteredConsultations}
        keyExtractor={c => c.id}
        rowActions={rowActions}
        onRowClick={c => setDrawerConsultation(c)}
        searchPlaceholder="Search consultations by investor, agenda, IRM, or agent..."
        searchFilter={(c, query) => {
          const q = query.toLowerCase();
          return (
            (c.investorName || '').toLowerCase().includes(q) ||
            (c.investorPhone || '').toLowerCase().includes(q) ||
            (c.agenda || '').toLowerCase().includes(q) ||
            (c.consultantName || '').toLowerCase().includes(q) ||
            (c.referredByAgentName || '').toLowerCase().includes(q)
          );
        }}
        emptyTitle={emptyDetails.title}
        emptyDescription={emptyDetails.desc}
        emptyActionLabel={emptyDetails.actionLabel}
        onEmptyAction={emptyDetails.actionLabel ? openCreateModal : undefined}
        filtersNode={
          <FilterBar
            filters={[
              {
                key: 'consultant',
                label: 'Assigned IRM',
                value: consultantFilter,
                onChange: setConsultantFilter,
                options: consultantOptions,
              },
              ...(!isExec
                ? [
                    {
                      key: 'agent',
                      label: 'Referred By (Sales Exec)',
                      value: agentFilter,
                      onChange: setAgentFilter,
                      options: agentOptions,
                    },
                    {
                      key: 'status',
                      label: 'Status',
                      value: statusFilter,
                      onChange: setStatusFilter,
                      options: [
                        { value: 'All', label: 'All Statuses' },
                        ...STATUS_OPTIONS,
                      ],
                    },
                  ]
                : []),
            ]}
            onClearAll={() => {
              setConsultantFilter('All');
              setAgentFilter('All');
              setStatusFilter('All');
            }}
          />
        }
      />

      {/* ── Schedule / Reschedule Consultation Modal ────────────────────── */}
      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={
          isRescheduleMode
            ? 'Reschedule Consultation'
            : 'Schedule Wealth Advisory Consultation'
        }
        subtitle={
          isRescheduleMode
            ? `Reschedule advisory slot for ${form.investorName || 'client'}`
            : 'Book a dedicated advisory slot between investor and IRM specialist'
        }
        maxWidth={620}
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={closeModal}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => handleSaveConsultation()}
            >
              {isRescheduleMode ? 'Save Reschedule' : 'Confirm Advisory Slot'}
            </button>
          </>
        }
      >
        <form onSubmit={handleSaveConsultation} className="consultation-form">
          {/* Select Lead Dropdown */}
          <div className="form-group">
            <label className="form-label">Select Lead *</label>
            <select
              id="consultation-form-lead"
              className={`form-select${formErrors.investorId ? ' is-invalid' : ''}`}
              value={form.investorId}
              onChange={e => handleSelectLead(e.target.value)}
            >
              <option value="">— Select Lead —</option>
              {form.investorId && !followupLeads.some(l => l.id === form.investorId) && (
                <option value={form.investorId}>
                  {form.investorName || form.investorId} (Current)
                </option>
              )}
              {followupLeads.map(lead => (
                <option key={lead.id} value={lead.id}>
                  {lead.name} {lead.phone ? `(${lead.phone})` : ''}
                  {!isExec && lead.assignedAgentName ? ` • ${lead.assignedAgentName}` : ''}
                </option>
              ))}
            </select>
            {formErrors.investorId && (
              <div className="form-error">{formErrors.investorId}</div>
            )}
          </div>

          <div className="consultation-form-grid-2">
            <div className="form-group">
              <label className="form-label">Lead Phone</label>
              <input
                id="consultation-form-phone"
                type="text"
                className="form-input"
                placeholder="+91 98800 00000"
                value={form.investorPhone}
                onChange={e => setField('investorPhone', e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Consultation Slot / Date *</label>
              <input
                id="consultation-form-slot"
                type="datetime-local"
                className={`form-input${formErrors.scheduledAt ? ' is-invalid' : ''}`}
                value={form.scheduledAt}
                onChange={e => setField('scheduledAt', e.target.value)}
              />
              {formErrors.scheduledAt && (
                <div className="form-error">{formErrors.scheduledAt}</div>
              )}
            </div>
          </div>

          {/* Row: IRM Consultant & Status */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">
                Assigned IRM Specialist
                {isExec && (
                  <span
                    style={{
                      marginLeft: 6,
                      fontSize: 11,
                      color: 'var(--text-muted)',
                      fontWeight: 400,
                    }}
                  >
                    (auto-assigned)
                  </span>
                )}
              </label>
              {isExec ? (
                <input
                  className="form-input"
                  value={form.consultantName}
                  readOnly
                  style={{
                    backgroundColor: 'var(--bg-surface-hover)',
                    cursor: 'not-allowed',
                    color: 'var(--text-secondary)',
                  }}
                />
              ) : availableIrms.length > 0 ? (
                <select
                  id="consultation-form-consultant-select"
                  className="form-select"
                  value={form.consultantName}
                  onChange={e => {
                    const sel = availableIrms.find(irm => irm.name === e.target.value);
                    setField('consultantName', e.target.value);
                    setField('consultantId', sel?.id || '');
                  }}
                >
                  <option value="">— Select IRM —</option>
                  {availableIrms.map(irm => (
                    <option key={irm.id} value={irm.name}>
                      {irm.name} ({irm.status || 'Available'})
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  id="consultation-form-consultant"
                  className="form-input"
                  placeholder="e.g. Vikram Malhotra"
                  value={form.consultantName}
                  onChange={e => {
                    setField('consultantName', e.target.value);
                    setField('consultantId', '');
                  }}
                />
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Status</label>
              <select
                id="consultation-form-status"
                className="form-select"
                value={form.status}
                onChange={e =>
                  setField('status', e.target.value as Consultation['status'])
                }
              >
                {STATUS_OPTIONS.map(s => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Referred By */}
          <div className="form-group">
            <label className="form-label">
              Referred By (Sales Exec)
              {isExec && (
                <span
                  style={{
                    marginLeft: 6,
                    fontSize: 11,
                    color: 'var(--text-muted)',
                    fontWeight: 400,
                  }}
                >
                  (Your Name)
                </span>
              )}
            </label>
            {isExec ? (
              <input
                id="consultation-form-referredby"
                className="form-input"
                value={form.referredByAgentName || user?.name || ''}
                readOnly
                style={{
                  backgroundColor: 'var(--bg-surface-hover)',
                  cursor: 'not-allowed',
                  color: 'var(--text-secondary)',
                }}
              />
            ) : agentOptions.length > 0 ? (
              <select
                id="consultation-form-referredby-select"
                className="form-select"
                value={form.referredByAgentName}
                onChange={e => setField('referredByAgentName', e.target.value)}
              >
                <option value="">— Select Sales Executive —</option>
                {agentOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                id="consultation-form-referredby"
                className="form-input"
                placeholder="e.g. Suresh Kumar"
                value={form.referredByAgentName || ''}
                onChange={e => setField('referredByAgentName', e.target.value)}
              />
            )}
          </div>

          {/* Discussion Agenda */}
          <div className="form-group">
            <label className="form-label">Discussion Agenda & Objectives</label>
            <textarea
              id="consultation-form-agenda"
              className="form-textarea"
              rows={3}
              placeholder="e.g. Commercial REIT yield analysis & portfolio consultation."
              value={form.agenda}
              onChange={e => setField('agenda', e.target.value)}
              style={{ resize: 'vertical' }}
            />
          </div>

          {/* Outcome Notes */}
          <div className="form-group">
            <label className="form-label">
              Outcome Notes & Recommendations
              <span
                style={{
                  marginLeft: 6,
                  fontSize: 11,
                  color: 'var(--text-muted)',
                  fontWeight: 400,
                }}
              >
                (advisory notes, mandate agreements, next steps)
              </span>
            </label>
            <textarea
              id="consultation-form-outcome"
              className="form-textarea"
              rows={3}
              placeholder="Record key takeaways, investor interest level, follow-up requirements..."
              value={form.outcomeNotes}
              onChange={e => setField('outcomeNotes', e.target.value)}
              style={{ resize: 'vertical' }}
            />
          </div>
        </form>
      </Modal>

      {/* ── Detail Drawer ────────────────────────────────────────────────── */}
      <Drawer
        isOpen={!!drawerConsultation}
        onClose={() => setDrawerConsultation(null)}
        title={drawerConsultation?.investorName || 'Investor Profile'}
        subtitle={`Phone: ${drawerConsultation?.investorPhone || '—'} • ${tenant?.name || 'GHL'}`}
        width={600}
      >
        {drawerConsultation && (() => {
          const dPhone = (drawerConsultation.investorPhone || '').replace(/\D/g, '').slice(-10);
          const matchingConsultations = consultations.filter(c => {
            if (drawerConsultation.investorId && c.investorId === drawerConsultation.investorId) {
              return true;
            }
            const cPhone = (c.investorPhone || '').replace(/\D/g, '').slice(-10);
            return !!(dPhone && cPhone && dPhone === cPhone);
          });

          const sortedConsultations = [...matchingConsultations].sort(
            (a, b) => getConsultationTimestamp(b) - getConsultationTimestamp(a)
          );

          const consultationHistory = sortedConsultations.filter(c => c.id !== drawerConsultation.id);

          return (
            <LeadDetailDrawerContent
              contactName={drawerConsultation.investorName}
              contactPhone={drawerConsultation.investorPhone}
              contactId={drawerConsultation.investorId}
              tenantId={tenant?.id}
              tenantName={tenant?.name}
              consultationReason={drawerConsultation.agenda}
              consultationHistory={consultationHistory}
              onCall={() =>
                initiateCall(
                  drawerConsultation.investorName,
                  drawerConsultation.investorPhone,
                  'customer',
                  drawerConsultation.investorId
                )
              }
            />
          );
        })()}
      </Drawer>
    </div>
  );
};
