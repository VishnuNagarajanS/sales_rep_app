import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  FolderArchive,
  Phone,
  RefreshCw,
  Search,
  Calendar,
  User,
  Clock,
  AlertCircle,
  Building2,
  Mail,
  ChevronRight,
  TrendingUp,
  FileCheck,
  CalendarCheck,
  Briefcase,
  HelpCircle,
  CheckCircle2,
  Trash2,
  CornerUpLeft,
} from 'lucide-react';
import { IrmOtherRecord } from '../../types';
import { getIrmOtherRecords, moveIrmOtherRecord, filterOtherRecords } from '../../services/ghlApiService';
import { useAuth } from '../../context/AuthContext';
import { useCall } from '../../context/CallContext';
import { DataTable, Column, RowAction } from '../../components/common/DataTable';
import { Drawer } from '../../components/common/Drawer';
import './IrmOtherPage.css';

const MODULE_ROUTES: Record<string, string> = {
  kyc: 'kyc',
  follow_up: 'follow-up',
  my_leads: 'my-leads',
  opportunities: 'opportunities',
  investor_360: 'investors',
};

const MODULE_DISPLAY_CONFIG: Record<
  string,
  { label: string; icon: React.ReactNode; colorClass: string; desc: string }
> = {
  follow_up: {
    label: 'Follow-up',
    icon: <CalendarCheck size={14} />,
    colorClass: 'follow_up',
    desc: 'Follow-up queue',
  },
  kyc: {
    label: 'KYC',
    icon: <FileCheck size={14} />,
    colorClass: 'kyc',
    desc: 'KYC Onboarding',
  },
  my_leads: {
    label: 'My Leads',
    icon: <User size={14} />,
    colorClass: 'my_leads',
    desc: 'Assigned Leads',
  },
  opportunities: {
    label: 'Opportunities',
    icon: <Briefcase size={14} />,
    colorClass: 'opportunities',
    desc: 'Deal pipelines',
  },
  investor_360: {
    label: 'Investor 360',
    icon: <TrendingUp size={14} />,
    colorClass: 'investor_360',
    desc: 'Portfolio & Investor 360',
  },
};

interface IrmOtherPageProps {
  onNavigate?: (route: string) => void;
}

export const IrmOtherPage: React.FC<IrmOtherPageProps> = ({ onNavigate }) => {
  const { user, tenant } = useAuth();
  const { initiateCall } = useCall();

  const [records, setRecords] = useState<IrmOtherRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedModuleTab, setSelectedModuleTab] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedRecord, setSelectedRecord] = useState<IrmOtherRecord | null>(null);

  const fetchRecords = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);
    setLoadError(null);

    try {
      const data = await getIrmOtherRecords();
      setRecords(filterOtherRecords(Array.isArray(data) ? data : []));
    } catch (err: any) {
      console.error('[IrmOtherPage] Error fetching Other records:', err);
      setLoadError(err?.message || 'Failed to load records from server.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchRecords();

    const handleUpdate = () => {
      fetchRecords(true);
    };

    window.addEventListener('nexus_storage_updated', handleUpdate);
    window.addEventListener('nexus_call_logged', handleUpdate);

    return () => {
      window.removeEventListener('nexus_storage_updated', handleUpdate);
      window.removeEventListener('nexus_call_logged', handleUpdate);
    };
  }, [fetchRecords, tenant?.id]);

  // ── Metrics count calculations ─────────────────────────────────────────────
  const stats = useMemo(() => {
    const counts = {
      all: records.length,
      follow_up: 0,
      kyc: 0,
      opportunities: 0,
      investor_360: 0,
    };

    records.forEach(r => {
      const mod = (r.callModule || '').toLowerCase();
      if (mod in counts) {
        (counts as any)[mod] += 1;
      }
    });

    return counts;
  }, [records]);

  // ── Client-side filtering ──────────────────────────────────────────────────
  const filteredRecords = useMemo(() => {
    let result = records;

    if (selectedModuleTab !== 'all') {
      result = result.filter(
        r => (r.callModule || '').toLowerCase() === selectedModuleTab.toLowerCase()
      );
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        r =>
          (r.contactName || '').toLowerCase().includes(q) ||
          (r.contactPhone || '').toLowerCase().includes(q) ||
          (r.contactEmail || '').toLowerCase().includes(q) ||
          (r.reason || '').toLowerCase().includes(q) ||
          (r.agentName || '').toLowerCase().includes(q) ||
          (r.moduleDisplayName || '').toLowerCase().includes(q)
      );
    }

    return result;
  }, [records, selectedModuleTab, searchQuery]);

  // ── Call Handler ───────────────────────────────────────────────────────────
  const handleCallContact = useCallback(
    (record: IrmOtherRecord) => {
      const recordType = record.customerId ? 'customer' : 'lead';
      const recordId = record.customerId
        ? String(record.customerId)
        : record.leadId
        ? String(record.leadId)
        : undefined;

      initiateCall(
        record.contactName,
        record.contactPhone,
        recordType,
        recordId,
        undefined,
        (record.callModule as any) || undefined
      );
    },
    [initiateCall]
  );

  // ── Dismiss / Remove Handler ──────────────────────────────────────────────
  const handleDismissContact = useCallback(
    (record: IrmOtherRecord) => {
      const callKey = record.callId ? String(record.callId) : '';
      const phoneKey = (record.contactPhone || '').trim();
      const phoneDigits = phoneKey.replace(/\D/g, '').slice(-10);

      try {
        const raw = localStorage.getItem('nexus_dismissed_other_records');
        const list: string[] = raw ? JSON.parse(raw) : [];
        if (callKey && !list.includes(callKey)) list.push(callKey);
        if (phoneKey && !list.includes(phoneKey)) list.push(phoneKey);
        if (phoneDigits && !list.includes(phoneDigits)) list.push(phoneDigits);
        if (record.leadId) list.push(`lead_${record.leadId}`);
        if (record.customerId) list.push(`cust_${record.customerId}`);
        localStorage.setItem('nexus_dismissed_other_records', JSON.stringify(list));
      } catch {}

      setRecords(prev =>
        prev.filter(r => {
          if (callKey && String(r.callId) === callKey) return false;
          if (phoneKey && r.contactPhone && r.contactPhone.trim() === phoneKey) return false;
          if (phoneDigits && (r.contactPhone || '').replace(/\D/g, '').slice(-10) === phoneDigits) return false;
          return true;
        })
      );

      setSelectedRecord(prev => {
        if (!prev) return null;
        if (callKey && String(prev.callId) === callKey) return null;
        if (phoneKey && prev.contactPhone === phoneKey) return null;
        return prev;
      });

      window.dispatchEvent(new Event('nexus_storage_updated'));
    },
    []
  );

  // ── Move Contact to Lastly Present (Source) Module ─────────────────────────
  const [movingCallId, setMovingCallId] = useState<number | null>(null);
  const [moveNotice, setMoveNotice] = useState<{
    text: string;
    targetName: string;
    targetRoute: string;
  } | null>(null);

  const handleMoveContact = useCallback(
    async (record: IrmOtherRecord) => {
      if (!record.callId && !record.contactPhone) return;
      if (record.callId) setMovingCallId(record.callId);

      const modKey = (record.callModule || 'kyc').toLowerCase();
      const targetRoute = MODULE_ROUTES[modKey] || 'kyc';
      const targetName = record.moduleDisplayName || MODULE_DISPLAY_CONFIG[modKey]?.label || 'Source Module';

      const callKey = record.callId ? String(record.callId) : '';
      const phoneRaw = (record.contactPhone || '').trim();
      const phoneDigits = phoneRaw.replace(/\D/g, '').slice(-10);

      // 1. Immediately remove from local table state and update counts
      setRecords(prev =>
        prev.filter(r => {
          if (callKey && String(r.callId) === callKey) return false;
          if (phoneRaw && r.contactPhone && r.contactPhone.trim() === phoneRaw) return false;
          if (phoneDigits && (r.contactPhone || '').replace(/\D/g, '').slice(-10) === phoneDigits) return false;
          return true;
        })
      );

      if (selectedRecord?.callId === record.callId || (phoneRaw && selectedRecord?.contactPhone === phoneRaw)) {
        setSelectedRecord(null);
      }

      // Show immediate notice with route action button
      setMoveNotice({
        text: `Successfully moved ${record.contactName} back to ${targetName}.`,
        targetName,
        targetRoute,
      });

      // 2. Perform background move, unblocking backend call and restoring destination entity
      try {
        await moveIrmOtherRecord({
          callId: record.callId || 0,
          targetModule: record.callModule,
          contactName: record.contactName,
          contactPhone: record.contactPhone,
          contactEmail: record.contactEmail,
          leadId: record.leadId,
          customerId: record.customerId,
          assignedAgentId: user?.id,
          assignedAgentName: user?.name,
          actorName: user?.name,
          tenantId: tenant?.id,
          reason: record.reason,
        });
      } catch (err: any) {
        console.error('[IrmOtherPage] Failed to move contact:', err);
      } finally {
        setMovingCallId(null);
      }
    },
    [selectedRecord, user, tenant]
  );

  // ── Table Columns ──────────────────────────────────────────────────────────
  const columns: Column<IrmOtherRecord>[] = useMemo(
    () => [
      {
        key: 'contact',
        header: 'Contact Name',
        sortable: true,
        width: '20%',
        render: record => {
          const initials = (record.contactName || 'U')
            .split(' ')
            .map(n => n[0])
            .join('')
            .substring(0, 2)
            .toUpperCase();

          return (
            <div className="irm-contact-cell">
              <div className="irm-contact-avatar">{initials}</div>
              <div className="irm-contact-info">
                <span className="irm-contact-name">{record.contactName}</span>
                <div className="irm-contact-meta">
                  <span>{record.customerId ? 'Customer' : 'Lead'}</span>
                  {record.customerId && <span>• ID: #{record.customerId}</span>}
                  {!record.customerId && record.leadId && <span>• ID: #{record.leadId}</span>}
                </div>
              </div>
            </div>
          );
        },
      },
      {
        key: 'phone',
        header: 'Phone / Email',
        width: '18%',
        render: record => (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>
              {record.contactPhone}
            </span>
            {record.contactEmail && (
              <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                {record.contactEmail}
              </span>
            )}
          </div>
        ),
      },
      {
        key: 'callModule',
        header: 'Source Module',
        sortable: true,
        width: '14%',
        render: record => {
          const conf = MODULE_DISPLAY_CONFIG[record.callModule] || {
            label: record.moduleDisplayName || record.callModule,
            icon: <HelpCircle size={14} />,
            colorClass: 'follow_up',
            desc: '',
          };

          return (
            <span className={`irm-module-badge ${conf.colorClass}`}>
              {conf.icon}
              <span>{conf.label}</span>
            </span>
          );
        },
      },
      {
        key: 'reason',
        header: 'Mandatory Reason',
        width: '22%',
        render: record => (
          <div className="irm-reason-cell">
            <div className="irm-reason-pill" title={record.reason}>
              <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>{record.reason}</span>
            </div>
          </div>
        ),
      },
      {
        key: 'agentName',
        header: 'Assigned IRM',
        sortable: true,
        width: '12%',
        render: record => (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <User size={13} color="var(--text-muted)" />
            <span style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--text-secondary)' }}>
              {record.agentName || 'Unassigned'}
            </span>
          </div>
        ),
      },
      {
        key: 'lastCallAt',
        header: 'Last Call Date & Time',
        sortable: true,
        width: '12%',
        render: record => {
          const d = new Date(record.lastCallAt);
          const isDateValid = !isNaN(d.getTime());
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--text-primary)' }}>
                {isDateValid ? d.toLocaleDateString() : record.lastCallAt}
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {isDateValid ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
              </span>
            </div>
          );
        },
      },
      {
        key: 'quickActions',
        header: 'Actions',
        align: 'center',
        width: '160px',
        render: record => (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <button
              type="button"
              className="irm-other-call-btn"
              title={`Call ${record.contactName}`}
              aria-label={`Call ${record.contactName}`}
              onClick={e => {
                e.stopPropagation();
                handleCallContact(record);
              }}
            >
              <Phone size={12} style={{ flexShrink: 0 }} />
              <span style={{ whiteSpace: 'nowrap' }}>Call</span>
            </button>
            <button
              type="button"
              className="irm-other-move-btn"
              title={`Move ${record.contactName} back to ${record.moduleDisplayName || 'source page'}`}
              aria-label={`Move ${record.contactName}`}
              disabled={movingCallId === record.callId}
              onClick={e => {
                e.stopPropagation();
                handleMoveContact(record);
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '6px 10px',
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 600,
                color: '#3b82f6',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                cursor: movingCallId === record.callId ? 'not-allowed' : 'pointer',
                opacity: movingCallId === record.callId ? 0.6 : 1,
                transition: 'all 0.15s ease',
              }}
            >
              <CornerUpLeft size={12} />
              <span>{movingCallId === record.callId ? 'Moving...' : 'Move'}</span>
            </button>
          </div>
        ),
      },
    ],
    [handleCallContact, handleMoveContact, movingCallId]
  );

  const rowActions: RowAction<IrmOtherRecord>[] = useMemo(
    () => [
      {
        label: 'Call Contact',
        icon: <Phone size={14} color="#059669" style={{ marginRight: 6 }} />,
        onClick: r => handleCallContact(r),
      },
      {
        label: 'Move to Source Page',
        icon: <CornerUpLeft size={14} color="#2563eb" style={{ marginRight: 6 }} />,
        onClick: r => handleMoveContact(r),
      },
      {
        label: 'View Details',
        icon: <ChevronRight size={14} style={{ marginRight: 6 }} />,
        onClick: r => setSelectedRecord(r),
      },
      {
        label: 'Remove from List',
        icon: <Trash2 size={14} color="#ef4444" style={{ marginRight: 6 }} />,
        onClick: r => handleDismissContact(r),
      },
    ],
    [handleCallContact, handleMoveContact, handleDismissContact]
  );

  return (
    <div className="irm-other-page-container">
      {/* ── Page Header ───────────────────────────────────────────────────────── */}
      <div className="page-header irm-other-header">
        <div className="irm-other-title-group">
          <h1 className="page-title irm-other-title">
            <FolderArchive size={24} color="#d97706" />
            <span>Other Contacts</span>
          </h1>
          <p className="page-subtitle irm-other-subtitle">
            Review and reconnect with contacts marked with the "Other" call outcome across IRM modules. Calling a contact and updating their outcome automatically advances them out of this section.
          </p>
        </div>

        <div className="irm-other-header-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => fetchRecords(true)}
            disabled={refreshing}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <RefreshCw size={14} className={refreshing ? 'spin-anim' : ''} />
            <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* ── Error Banner ─────────────────────────────────────────────────────── */}
      {loadError && (
        <div
          className="alert-banner error"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '12px 16px',
            borderRadius: 'var(--radius-md)',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#ef4444',
          }}
        >
          <AlertCircle size={18} />
          <span>{loadError}</span>
        </div>
      )}

      {/* ── Success Move Banner ──────────────────────────────────────────────── */}
      {moveNotice && (
        <div
          className="alert-banner success irm-move-success-banner"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            padding: '12px 18px',
            marginBottom: '16px',
            borderRadius: 'var(--radius-md)',
            background: 'rgba(16, 185, 129, 0.12)',
            border: '1px solid rgba(16, 185, 129, 0.35)',
            color: '#10b981',
            fontWeight: 500,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <CheckCircle2 size={18} style={{ flexShrink: 0 }} />
            <span style={{ fontSize: 13.5 }}>{moveNotice.text}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => {
                if (onNavigate) {
                  onNavigate(moveNotice.targetRoute);
                } else {
                  window.location.href = `/${moveNotice.targetRoute}`;
                }
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 14px',
                borderRadius: 6,
                backgroundColor: '#10b981',
                color: '#ffffff',
                fontWeight: 600,
                fontSize: 12.5,
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 2px 6px rgba(16, 185, 129, 0.3)',
              }}
            >
              <span>View in {moveNotice.targetName}</span>
              <ChevronRight size={14} />
            </button>
            <button
              type="button"
              onClick={() => setMoveNotice(null)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#10b981',
                cursor: 'pointer',
                padding: 4,
                fontSize: 16,
                lineHeight: 1,
              }}
              title="Dismiss"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* ── Stat Cards Bar ───────────────────────────────────────────────────── */}
      <div className="irm-other-stats-grid">
        <div
          className={`irm-stat-card irm-stat-all ${selectedModuleTab === 'all' ? 'active' : ''}`}
          onClick={() => setSelectedModuleTab('all')}
        >
          <div className="irm-stat-card-icon">
            <FolderArchive size={22} />
          </div>
          <div className="irm-stat-card-content">
            <span className="irm-stat-card-value">{stats.all}</span>
            <span className="irm-stat-card-label">All Modules</span>
          </div>
        </div>

        <div
          className={`irm-stat-card irm-stat-follow_up ${selectedModuleTab === 'follow_up' ? 'active' : ''}`}
          onClick={() => setSelectedModuleTab('follow_up')}
        >
          <div className="irm-stat-card-icon">
            <CalendarCheck size={22} />
          </div>
          <div className="irm-stat-card-content">
            <span className="irm-stat-card-value">{stats.follow_up}</span>
            <span className="irm-stat-card-label">Follow-up</span>
          </div>
        </div>

        <div
          className={`irm-stat-card irm-stat-kyc ${selectedModuleTab === 'kyc' ? 'active' : ''}`}
          onClick={() => setSelectedModuleTab('kyc')}
        >
          <div className="irm-stat-card-icon">
            <FileCheck size={22} />
          </div>
          <div className="irm-stat-card-content">
            <span className="irm-stat-card-value">{stats.kyc}</span>
            <span className="irm-stat-card-label">KYC</span>
          </div>
        </div>

        <div
          className={`irm-stat-card irm-stat-opportunities ${selectedModuleTab === 'opportunities' ? 'active' : ''}`}
          onClick={() => setSelectedModuleTab('opportunities')}
        >
          <div className="irm-stat-card-icon">
            <Briefcase size={22} />
          </div>
          <div className="irm-stat-card-content">
            <span className="irm-stat-card-value">{stats.opportunities}</span>
            <span className="irm-stat-card-label">Opportunities</span>
          </div>
        </div>

        <div
          className={`irm-stat-card irm-stat-investor_360 ${selectedModuleTab === 'investor_360' ? 'active' : ''}`}
          onClick={() => setSelectedModuleTab('investor_360')}
        >
          <div className="irm-stat-card-icon">
            <TrendingUp size={22} />
          </div>
          <div className="irm-stat-card-content">
            <span className="irm-stat-card-value">{stats.investor_360}</span>
            <span className="irm-stat-card-label">Investor 360</span>
          </div>
        </div>
      </div>

      {/* ── Filter Tabs & Search Controls ────────────────────────────────────── */}
      <div className="irm-other-controls-card">
        <div className="irm-other-tabs">
          <button
            type="button"
            className={`irm-other-tab-btn ${selectedModuleTab === 'all' ? 'active' : ''}`}
            onClick={() => setSelectedModuleTab('all')}
          >
            <span>All Modules</span>
            <span className="irm-other-tab-badge">{stats.all}</span>
          </button>

          <button
            type="button"
            className={`irm-other-tab-btn ${selectedModuleTab === 'follow_up' ? 'active' : ''}`}
            onClick={() => setSelectedModuleTab('follow_up')}
          >
            <CalendarCheck size={14} />
            <span>Follow-up</span>
            <span className="irm-other-tab-badge">{stats.follow_up}</span>
          </button>

          <button
            type="button"
            className={`irm-other-tab-btn ${selectedModuleTab === 'kyc' ? 'active' : ''}`}
            onClick={() => setSelectedModuleTab('kyc')}
          >
            <FileCheck size={14} />
            <span>KYC</span>
            <span className="irm-other-tab-badge">{stats.kyc}</span>
          </button>

          <button
            type="button"
            className={`irm-other-tab-btn ${selectedModuleTab === 'opportunities' ? 'active' : ''}`}
            onClick={() => setSelectedModuleTab('opportunities')}
          >
            <Briefcase size={14} />
            <span>Opportunities</span>
            <span className="irm-other-tab-badge">{stats.opportunities}</span>
          </button>

          <button
            type="button"
            className={`irm-other-tab-btn ${selectedModuleTab === 'investor_360' ? 'active' : ''}`}
            onClick={() => setSelectedModuleTab('investor_360')}
          >
            <TrendingUp size={14} />
            <span>Investor 360</span>
            <span className="irm-other-tab-badge">{stats.investor_360}</span>
          </button>
        </div>

        <div className="irm-other-search-wrap">
          <Search size={16} className="irm-other-search-icon" />
          <input
            type="text"
            className="irm-other-search-input"
            placeholder="Search by name, phone, reason..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* ── Table Section ────────────────────────────────────────────────────── */}
      <DataTable
        columns={columns}
        data={filteredRecords}
        keyExtractor={record => `${record.callId}-${record.contactPhone}-${record.callModule}`}
        rowActions={rowActions}
        onRowClick={record => setSelectedRecord(record)}
        emptyTitle="No records in Other module"
        emptyDescription={
          searchQuery
            ? `No records found matching "${searchQuery}". Try adjusting your filters.`
            : selectedModuleTab !== 'all'
            ? `No unresolved "Other" calls found in the ${selectedModuleTab.replace('_', ' ')} module.`
            : 'No contacts are currently in the Other stage. When a call is logged with disposition "Other", it will appear here.'
        }
        pageSize={15}
        hideSearch={true}
      />

      {/* ── Contact Detail Drawer ────────────────────────────────────────────── */}
      {selectedRecord && (
        <Drawer
          isOpen={Boolean(selectedRecord)}
          onClose={() => setSelectedRecord(null)}
          title={selectedRecord.contactName}
          subtitle={`Source: ${selectedRecord.moduleDisplayName || selectedRecord.callModule}`}
          size="md"
          footer={
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, width: '100%' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setSelectedRecord(null)}
              >
                Close
              </button>
              <button
                type="button"
                className="btn btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: 6, backgroundColor: '#059669', borderColor: '#059669' }}
                onClick={() => {
                  handleCallContact(selectedRecord);
                  setSelectedRecord(null);
                }}
              >
                <Phone size={14} />
                <span>Call Now</span>
              </button>
            </div>
          }
        >
          <div className="irm-detail-drawer">
            <div className="irm-detail-header-card">
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#92400e' }}>
                  Awaiting Outcome Update
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: 12.5, color: '#b45309' }}>
                  This contact's last call in this module ended with disposition "Other". Call the contact to update their outcome.
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  style={{ backgroundColor: '#059669', borderColor: '#059669', display: 'flex', alignItems: 'center', gap: 6 }}
                  onClick={() => {
                    handleCallContact(selectedRecord);
                    setSelectedRecord(null);
                  }}
                >
                  <Phone size={13} />
                  <span>Call</span>
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-secondary"
                  style={{ color: '#2563eb', borderColor: 'rgba(37, 99, 235, 0.4)', backgroundColor: 'rgba(37, 99, 235, 0.08)', display: 'flex', alignItems: 'center', gap: 6 }}
                  onClick={() => handleMoveContact(selectedRecord)}
                  disabled={movingCallId === selectedRecord.callId}
                  title={`Move contact back to ${selectedRecord.moduleDisplayName || 'source page'}`}
                >
                  <CornerUpLeft size={13} />
                  <span>Move to {selectedRecord.moduleDisplayName || 'Source'}</span>
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-secondary"
                  style={{ color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.4)', display: 'flex', alignItems: 'center', gap: 6 }}
                  onClick={() => handleDismissContact(selectedRecord)}
                  title="Remove from Other Contacts list"
                >
                  <Trash2 size={13} />
                  <span>Remove</span>
                </button>
              </div>
            </div>

            <div className="irm-detail-reason-box">
              <span className="irm-detail-reason-label">Recorded Reason</span>
              <p className="irm-detail-reason-content">{selectedRecord.reason}</p>
            </div>

            <div className="irm-detail-grid">
              <div className="irm-detail-item">
                <span className="irm-detail-label">Phone Number</span>
                <span className="irm-detail-value">{selectedRecord.contactPhone}</span>
              </div>

              <div className="irm-detail-item">
                <span className="irm-detail-label">Email Address</span>
                <span className="irm-detail-value">{selectedRecord.contactEmail || 'None provided'}</span>
              </div>

              <div className="irm-detail-item">
                <span className="irm-detail-label">Source Module</span>
                <span className="irm-detail-value">
                  {selectedRecord.moduleDisplayName || selectedRecord.callModule}
                </span>
              </div>

              <div className="irm-detail-item">
                <span className="irm-detail-label">Assigned IRM</span>
                <span className="irm-detail-value">{selectedRecord.agentName || 'Unassigned'}</span>
              </div>

              <div className="irm-detail-item">
                <span className="irm-detail-label">Last Call Date</span>
                <span className="irm-detail-value">
                  {new Date(selectedRecord.lastCallAt).toLocaleString()}
                </span>
              </div>

              <div className="irm-detail-item">
                <span className="irm-detail-label">Call Duration</span>
                <span className="irm-detail-value">
                  {selectedRecord.duration ? `${selectedRecord.duration} seconds` : '0 seconds'}
                </span>
              </div>
            </div>
          </div>
        </Drawer>
      )}
    </div>
  );
};
