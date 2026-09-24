import React, { useState, useEffect } from 'react';
import { History, Phone, FileText, Download, AlertCircle } from 'lucide-react';
import Papa from 'papaparse';
import { CallRecord } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useCall } from '../../context/CallContext';
import { storageService } from '../../services/storageService';
import { executiveApi } from '../../services/executiveApi';
import { IS_MOCK_ENV } from '../../config/runtime';
import { DataTable, Column, RowAction } from '../../components/common/DataTable';
import { StatusChip } from '../../components/common/StatusChip';
import { Drawer } from '../../components/common/Drawer';
import { FilterBar } from '../../components/common/FilterBar';
import './CallHistoryPage.css';

export const CallHistoryPage: React.FC = () => {
  const { tenant, user } = useAuth();
  const { initiateCall } = useCall();

  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [selectedCall, setSelectedCall] = useState<CallRecord | null>(null);
  const [dispositionFilter, setDispositionFilter] = useState('All');
  const [directionFilter, setDirectionFilter] = useState('All');
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoadError(null);
      if (!IS_MOCK_ENV && user?.role.code === 'sales_executive' && user) {
        setCalls(await executiveApi.getCalls(user, tenant));
      } else {
        setCalls(storageService.getCalls(tenant?.id));
      }
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Unable to load call history.');
    }
  };

  useEffect(() => {
    void loadData();
    const handleUpdate = () => loadData();
    window.addEventListener('nexus_storage_updated', handleUpdate);
    return () => window.removeEventListener('nexus_storage_updated', handleUpdate);
  }, [tenant?.id, user?.id]);

  // ── Task 2: Role-scoping (same pattern as DashboardPage.tsx scopedCalls) ──
  const isExec = user?.role?.code === 'sales_executive';
  const scopedCalls = isExec
    ? calls.filter(c =>
      (c.agentId && c.agentId === user?.id) ||
      (c.agentName && c.agentName === user?.name)
    )
    : calls;

  // ── Filters applied on top of role-scoped calls ───────────────────────────
  const filteredCalls = scopedCalls.filter(c => {
    if (dispositionFilter !== 'All' && c.disposition !== dispositionFilter) return false;
    if (directionFilter !== 'All' && c.direction !== directionFilter) return false;
    return true;
  });

  // ── Formatters ────────────────────────────────────────────────────────────
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  // Parses an ISO timestamp and returns a readable local string.
  // Falls back to the raw value for legacy non-ISO strings (e.g. old "Just now" entries).
  const formatTimestamp = (iso: string): string => {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso; // graceful fallback
    const date = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }); // "16 Sep"
    const time = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }); // "10:23 AM"
    return `${date}, ${time}`;
  };

  // ── Task 3: CSV export ────────────────────────────────────────────────────
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

  // ── Table columns ─────────────────────────────────────────────────────────
  const columns: Column<CallRecord>[] = [
    {
      key: 'timestamp',
      header: 'Date & Time',
      sortable: true,
      render: c => <span style={{ fontSize: 12, fontWeight: 500 }}>{formatTimestamp(c.timestamp)}</span>,
    },
    {
      key: 'contactName',
      header: 'Contact',
      sortable: true,
      render: c => (
        <div>
          <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{c.contactName}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.contactPhone}</div>
        </div>
      ),
    },
    {
      key: 'direction',
      header: 'Direction',
      sortable: true,
      render: c => <StatusChip status={c.direction} size="sm" />,
    },
    {
      key: 'duration',
      header: 'Duration',
      sortable: true,
      render: c => <span style={{ fontSize: 12 }}>{formatDuration(c.duration)}</span>,
    },
    {
      key: 'agentName',
      header: 'Agent',
      sortable: true,
      render: c => <span style={{ fontSize: 12 }}>{c.agentName}</span>,
    },
    {
      key: 'disposition',
      header: 'Outcome / Disposition',
      sortable: true,
      render: c => <StatusChip status={c.disposition} size="sm" />,
    },
    // Task 1: "Listen" / recording column removed — replaced by row-click detail drawer
  ];

  // ── Row actions ───────────────────────────────────────────────────────────
  const rowActions: RowAction<CallRecord>[] = [
    {
      label: 'View Call Log & Transcript',
      icon: <FileText size={14} style={{ marginRight: 6 }} />,
      onClick: c => setSelectedCall(c),
    },
    // Task 4: Call Back quick action
    {
      label: 'Call Back',
      icon: <Phone size={14} style={{ marginRight: 6 }} />,
      onClick: c => initiateCall(c.contactName, c.contactPhone),
    },
  ];

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

        {/* Task 3: Export CSV button — same style as ReportsPage */}
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
                key: 'disposition',
                label: 'Disposition',
                value: dispositionFilter,
                onChange: setDispositionFilter,
                options: [
                  { value: 'Interested', label: 'Interested' },
                  { value: 'Not Interested', label: 'Not Interested' },
                  { value: 'Follow-up Required', label: 'Follow-up Required' },
                  { value: 'Call Back', label: 'Call Back' },
                  { value: 'Wrong Number', label: 'Wrong Number' },
                  { value: 'Converted', label: 'Converted' },
                  { value: 'No Response', label: 'No Response' },
                ],
              },
              {
                key: 'direction',
                label: 'Direction',
                value: directionFilter,
                onChange: setDirectionFilter,
                options: [
                  { value: 'inbound', label: 'Inbound' },
                  { value: 'outbound', label: 'Outbound' },
                ],
              },
            ]}
            onClearAll={() => {
              setDispositionFilter('All');
              setDirectionFilter('All');
            }}
          />
        }
      />
      {loadError && (
        <div className="auth-error-alert">
          <AlertCircle size={16} />
          <span>{loadError}</span>
        </div>
      )}

      {/* Call Detail Drawer */}
      <Drawer
        isOpen={!!selectedCall}
        onClose={() => setSelectedCall(null)}
        title="Call Detail & Transcription"
        subtitle={`${selectedCall?.contactName} (${selectedCall?.contactPhone}) • ${selectedCall ? formatTimestamp(selectedCall.timestamp) : ''}`}
        width={560}
      >
        {selectedCall && (
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
                  <StatusChip status={selectedCall.direction} />
                  <StatusChip status={selectedCall.disposition} />
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
                  Agent: <strong>{selectedCall.agentName}</strong> • Duration:{' '}
                  <strong>{formatDuration(selectedCall.duration)}</strong>
                </div>
              </div>

              {/* Task 4: Quick Call Back from drawer */}
              <button
                className="btn btn-primary btn-sm"
                style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}
                onClick={() => initiateCall(selectedCall.contactName, selectedCall.contactPhone)}
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
                {selectedCall.transcription || 'Transcription processing completed.'}
              </p>
            </div>

            {/* Agent Discussion Notes */}
            <div className="card" style={{ padding: 18 }}>
              <h4 style={{ fontSize: 13, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 10 }}>
                Agent Post-Call Notes
              </h4>
              <p style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.5 }}>
                {selectedCall.notes || 'No custom agent notes entered during disposition.'}
              </p>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
};
