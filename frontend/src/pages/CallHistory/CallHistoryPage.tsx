import React, { useState, useEffect } from 'react';
import { History, Phone, FileText, Download, AlertCircle, Users } from 'lucide-react';
import Papa from 'papaparse';
import { CallRecord, User, Consultation } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useCall } from '../../context/CallContext';
import { storageService } from '../../services/storageService';
import { getCalls, getConsultations } from '../../services/ghlApiService';
import { adminUserService } from '../../services/adminUserService';
import { DataTable, Column, RowAction } from '../../components/common/DataTable';
import { StatusChip } from '../../components/common/StatusChip';
import { Drawer } from '../../components/common/Drawer';
import { FilterBar } from '../../components/common/FilterBar';
import { LeadDetailDrawerContent } from '../../components/common/LeadDetailDrawerContent';
import './CallHistoryPage.css';

export const CallHistoryPage: React.FC = () => {
  const { tenant, user } = useAuth();
  const { initiateCall } = useCall();

  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedCall, setSelectedCall] = useState<CallRecord | null>(null);
  const [transcriptCall, setTranscriptCall] = useState<CallRecord | null>(null);

  const [roleFilter, setRoleFilter] = useState('All');
  const [agentFilter, setAgentFilter] = useState('All');
  const [datePreset, setDatePreset] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  const loadData = async () => {
    try {
      const [callsData, consultationsData, liveUsers] = await Promise.all([
        getCalls(tenant?.id),
        getConsultations(tenant?.id),
        adminUserService.getUsers(tenant?.id || tenant?.slug || '2'),
      ]);
      const localCalls = storageService.getCalls(tenant?.id) || [];
      const callMap = new Map<string, CallRecord>();
      (callsData || []).forEach(c => callMap.set(String(c.id), c));
      localCalls.forEach(c => {
        if (!callMap.has(String(c.id))) callMap.set(String(c.id), c);
      });
      setCalls(Array.from(callMap.values()));
      setConsultations(consultationsData || []);
      setUsers(liveUsers || []);
    } catch (err) {
      console.error('Failed to load call history', err);
      const fallbackCalls = storageService.getCalls(tenant?.id) || [];
      setCalls(fallbackCalls);
    }
  };

  useEffect(() => {
    loadData();
    const handleUpdate = () => loadData();
    window.addEventListener('nexus_storage_updated', handleUpdate);
    return () => window.removeEventListener('nexus_storage_updated', handleUpdate);
  }, [tenant?.id]);

  // ── Date formatting helpers ────────────────────────────────────────────────
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
      case 'today': return { from: todayStr, to: todayStr };
      case 'yesterday': {
        const yest = new Date(now);
        yest.setDate(yest.getDate() - 1);
        return { from: formatDateYMD(yest), to: formatDateYMD(yest) };
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
      default: return { from: '', to: '' };
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

  const parseDateFromTimestamp = (ts: string): string => {
    if (!ts) return '';
    if (ts.startsWith('Today')) return formatDateYMD(new Date());
    if (ts.startsWith('Yesterday')) {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      return formatDateYMD(d);
    }
    const d = new Date(ts);
    if (!isNaN(d.getTime())) return formatDateYMD(d);
    return '';
  };

  // ── Role-scoping ───────────────────────────────────────────────────────────
  const isExec = user?.role?.code === 'sales_executive';
  const scopedCalls = isExec
    ? calls.filter(c =>
      !c.agentId ||
      String(c.agentId) === String(user?.id) ||
      (c.agentName && user?.name && c.agentName.toLowerCase().trim() === user.name.toLowerCase().trim())
    )
    : calls;

  const agentRoleMap = React.useMemo(() => {
    const map = new Map<string, string>();
    users.forEach(u => {
      const roleName = u.role?.name || (u.role?.code === 'sales_manager' ? 'Sales Manager' : u.role?.code === 'company_admin' ? 'Company Admin' : 'Sales Executive');
      if (u.id) map.set(String(u.id), roleName);
      if (u.name) map.set(u.name.toLowerCase().trim(), roleName);
    });
    return map;
  }, [users]);

  // Roles derived dynamically from live tenant users & tenant role scope
  const roleOptions = React.useMemo(() => {
    const isJamin = tenant?.slug === 'jamin' || String(tenant?.id) === '2';
    const roleSet = new Set<string>();

    users.forEach(u => {
      if (u.role?.name && u.role.name !== 'Unknown') {
        if (isJamin && (u.role.name.includes('IRM') || u.role.name.includes('Institutional'))) return;
        roleSet.add(u.role.name);
      }
    });

    if (roleSet.size === 0) {
      roleSet.add('Sales Executive');
      roleSet.add('Sales Manager');
      roleSet.add('Company Admin');
      if (!isJamin) {
        roleSet.add('Institutional Relationship Manager');
      }
    }

    return Array.from(roleSet).map(r => ({ value: r, label: r }));
  }, [users, tenant]);

  // Agents derived directly from live database users of this company
  const agentOptions = React.useMemo(() => {
    const agentMap = new Map<string, string>();

    // Live users from database
    users.forEach(u => {
      if (u.name) {
        agentMap.set(u.name, u.name);
      }
    });

    // Also include any agent names that appear in call records
    scopedCalls.forEach(c => {
      if (c.agentName && !agentMap.has(c.agentName)) {
        agentMap.set(c.agentName, c.agentName);
      }
    });

    return Array.from(agentMap.values()).map(a => ({ value: a, label: a }));
  }, [users, scopedCalls]);

  // ── Filters applied on top of role-scoped calls ───────────────────────────
  const filteredCalls = scopedCalls.filter(c => {
    if (agentFilter !== 'All' && c.agentName !== agentFilter) return false;
    if (roleFilter !== 'All') {
      const agentRole =
        (c.agentId ? agentRoleMap.get(String(c.agentId)) : null) ||
        (c.agentName ? agentRoleMap.get(c.agentName.toLowerCase().trim()) : null) ||
        c.agentRole;
      if (agentRole !== roleFilter) return false;
    }

    if (datePreset !== 'all' && dateFrom && dateTo) {
      const callDate = parseDateFromTimestamp(c.timestamp);
      if (callDate) {
        if (callDate < dateFrom || callDate > dateTo) return false;
      }
    }
    return true;
  });

  // ── Formatters ────────────────────────────────────────────────────────────
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const formatTimestamp = (iso: string): string => {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    const date = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
    const time = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    return `${date}, ${time}`;
  };

  // ── CSV export ────────────────────────────────────────────────────────────
  const handleExportCSV = () => {
    const rows = filteredCalls.map(c => ({
      'Date & Time': formatTimestamp(c.timestamp),
      'Contact Name': c.contactName,
      'Phone': c.contactPhone,
      'Direction': c.direction,
      'Duration (seconds)': c.duration,
      'Agent': c.agentName,
      'Disposition': c.disposition,
      'Notes': c.notes || '',
    }));
    const csv = Papa.unparse(rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `call-history-${tenant?.slug}-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const isIrmConnectedCall = (c: CallRecord | null): boolean =>
    !!(c && (c.notes || '').trim().startsWith('Connected to IRM:'));

  // ── Table columns ─────────────────────────────────────────────────────────
  const columns: Column<CallRecord>[] = [
    {
      key: 'timestamp',
      header: 'Date & Time',
      width: '16%',
      sortable: true,
      render: c => <span style={{ fontSize: 12, fontWeight: 500 }}>{formatTimestamp(c.timestamp)}</span>,
    },
    {
      key: 'contactName',
      header: 'Contact',
      width: '20%',
      sortable: true,
      render: c => {
        const connectedViaIrm = tenant?.slug === 'ghl' && isIrmConnectedCall(c);
        return (
          <div>
            <div style={{ fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
              {c.contactName}
              {connectedViaIrm && (
                <span title="Connected via IRM" style={{ display: 'inline-flex', alignItems: 'center' }}>
                  <Users size={13} color="var(--primary-600)" />
                </span>
              )}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.contactPhone}</div>
          </div>
        );
      },
    },
    {
      key: 'agentName',
      header: 'Called By',
      width: '16%',
      sortable: true,
      render: c => <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{c.agentName || '—'}</span>,
    },
    {
      key: 'direction',
      header: 'Direction',
      width: '16%',
      sortable: true,
      render: c => <StatusChip status={c.direction} size="sm" />,
    },
    {
      key: 'duration',
      header: 'Duration',
      width: '16%',
      sortable: true,
      render: c => <span style={{ fontSize: 12 }}>{formatDuration(c.duration)}</span>,
    },
    {
      key: 'disposition',
      header: 'Outcome / Disposition',
      width: '16%',
      sortable: true,
      render: c => <StatusChip status={c.disposition} size="sm" />,
    },
  ];

  // ── Row actions ───────────────────────────────────────────────────────────
  const rowActions: RowAction<CallRecord>[] = [
    {
      label: 'View Transcript',
      icon: <FileText size={14} style={{ marginRight: 6 }} />,
      onClick: c => setTranscriptCall(c),
    },
    {
      label: 'Call Back',
      icon: <Phone size={14} style={{ marginRight: 6 }} />,
      onClick: c =>
        initiateCall(
          c.contactName,
          c.contactPhone,
          c.customerId ? 'customer' : 'lead',
          c.customerId || c.leadId
        ),
    },
  ];

  // ── Related consultation for contact profile drawer ───────────────────────
  const matchingConsultations = selectedCall
    ? consultations
      .filter((c: Consultation) => {
        const sPhone = (selectedCall.contactPhone || '').replace(/\D/g, '').slice(-10);
        const cPhone = (c.investorPhone || '').replace(/\D/g, '').slice(-10);
        const phoneMatch = !!(sPhone && cPhone && sPhone === cPhone);
        const idMatch = !!(
          (selectedCall.investorId && c.investorId === selectedCall.investorId) ||
          (selectedCall.leadId && c.investorId === selectedCall.leadId)
        );
        return idMatch || phoneMatch;
      })
      .sort((a: Consultation, b: Consultation) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime())
    : [];

  const relatedConsultation =
    matchingConsultations.find((c: Consultation) => c.status === 'Scheduled') || matchingConsultations[0];

  const irmConsultationReason = (() => {
    if (!selectedCall || !isIrmConnectedCall(selectedCall)) return undefined;
    const match = (selectedCall.notes || '').match(/Reason:\s*([\s\S]*)$/i);
    const parsedReason = match && match[1]?.trim();
    if (parsedReason) return parsedReason;
    return relatedConsultation?.agenda;
  })();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <History size={24} color="var(--primary-600)" /> Call Log & History
          </h1>
          <p className="page-subtitle">
            {isExec
              ? `Auditable archive of your calls and automated transcripts for ${tenant?.name}.`
              : `Auditable archive of all agent calls and automated transcripts for ${tenant?.name}.`}
          </p>
        </div>

        <button className="btn btn-secondary" onClick={handleExportCSV}>
          <Download size={15} /> Export CSV
        </button>
      </div>

      <DataTable
        columns={columns}
        data={filteredCalls}
        keyExtractor={c => c.id}
        rowActions={rowActions}
        onRowClick={c => setSelectedCall(c)}
        searchPlaceholder="Search calls by contact name, phone, or agent..."
        filtersNode={
          <FilterBar
            filters={[
              {
                key: 'role',
                label: 'Role',
                value: roleFilter,
                onChange: setRoleFilter,
                options: roleOptions,
              },
              {
                key: 'agent',
                label: 'Agent',
                value: agentFilter,
                onChange: setAgentFilter,
                options: agentOptions,
              },
            ]}
            dateRange={{
              from: dateFrom,
              to: dateTo,
              preset: datePreset,
              onPresetChange: handleDatePresetChange,
              onChange: (from, to) => {
                setDateFrom(from);
                setDateTo(to);
              },
            }}
            onClearAll={() => {
              setRoleFilter('All');
              setAgentFilter('All');
              setDatePreset('all');
              setDateFrom('');
              setDateTo('');
            }}
          />
        }
      />

        {/* Contact Profile Drawer (opened on row click) */}
        <Drawer
          isOpen={!!selectedCall}
          onClose={() => setSelectedCall(null)}
          title={selectedCall?.contactName || 'Contact Profile'}
          subtitle={`Phone: ${selectedCall?.contactPhone || '—'} • ${tenant?.name}`}
          width={600}
        >
          {selectedCall && (
            <LeadDetailDrawerContent
              contactName={selectedCall.contactName}
              contactPhone={selectedCall.contactPhone}
              contactId={selectedCall.leadId || selectedCall.investorId || selectedCall.customerId}
              tenantId={tenant?.id}
              tenantName={tenant?.name}
              consultationReason={irmConsultationReason}
              hideAutoNotes={true}
              onCall={() =>
                initiateCall(
                  selectedCall.contactName,
                  selectedCall.contactPhone,
                  selectedCall.customerId ? 'customer' : 'lead',
                  selectedCall.customerId || selectedCall.leadId
                )
              }
            />
          )}
        </Drawer>

        {/* Single Call Detail & Transcript Drawer (accessible via row action) */}
        <Drawer
          isOpen={!!transcriptCall}
          onClose={() => setTranscriptCall(null)}
          title="Call Detail & Transcription"
          subtitle={`${transcriptCall?.contactName} (${transcriptCall?.contactPhone}) • ${transcriptCall ? formatTimestamp(transcriptCall.timestamp) : ''}`}
          width={560}
        >
          {transcriptCall && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Outcome Overview */}
              <div
                style={{
                  padding: 16,
                  borderRadius: 'var(--radius-lg)',
                  backgroundColor: 'var(--bg-surface-hover)',
                  border: '1px solid var(--border-base)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <StatusChip status={transcriptCall.direction} />
                    <StatusChip status={transcriptCall.disposition} />
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
                    Agent: <strong>{transcriptCall.agentName}</strong> • Duration:{' '}
                    <strong>{formatDuration(transcriptCall.duration)}</strong>
                  </div>
                </div>

                {/* Task 4: Quick Call Back from drawer */}
                <button
                  className="btn btn-primary btn-sm"
                  style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}
                  onClick={() => initiateCall(transcriptCall.contactName, transcriptCall.contactPhone)}
                >
                  <Phone size={13} /> Call Back
                </button>
              </div>

              {/* Task 1: Honest recording state — no fake player */}
              <div className="card" style={{ padding: 18, border: '1px solid var(--border-base)' }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Call Voice Recording</div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '12px 14px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--bg-surface-hover)',
                    border: '1px dashed var(--border-strong)',
                  }}
                >
                  <AlertCircle size={18} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
                    Recording playback isn't available — this call was simulated, no audio was recorded.
                  </p>
                </div>
              </div>

              {/* Transcription Box */}
              <div className="card" style={{ padding: 18 }}>
                <h4 style={{ fontSize: 13, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 10 }}>
                  Automated Call Transcript
                </h4>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, fontStyle: 'italic' }}>
                  {transcriptCall.transcription || 'Transcription processing completed.'}
                </p>
              </div>

              {/* Agent Discussion Notes */}
              <div className="card" style={{ padding: 18 }}>
                <h4 style={{ fontSize: 13, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 10 }}>
                  Agent Post-Call Notes
                </h4>
                <p style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.5 }}>
                  {transcriptCall.notes || 'No custom agent notes entered during disposition.'}
                </p>
              </div>
            </div>
          )}
        </Drawer>
      </div>
    );
};
