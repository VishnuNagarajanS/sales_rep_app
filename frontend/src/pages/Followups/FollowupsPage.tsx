import React, { useState, useEffect, useMemo } from 'react';
import {
  CalendarCheck,
  Phone,
  AlertTriangle,
  Briefcase,
  User,
  Calendar,
  Sparkles,
} from 'lucide-react';
import { Followup, CallRecord, Lead } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useCall } from '../../context/CallContext';
import {
  getFollowups,
  saveFollowup as apiSaveFollowup,
  getCalls,
  getLeads,
} from '../../services/ghlApiService';
import { StatusChip } from '../../components/common/StatusChip';
import { Modal } from '../../components/common/Modal';
import { Drawer } from '../../components/common/Drawer';
import { LeadDetailDrawerContent } from '../../components/common/LeadDetailDrawerContent';
import {
  FollowupRoleFilter,
  SALES_EXECUTIVE_USERS,
  IRM_USERS,
} from '../../mock_data/adminFollowupsData';
import { DateRangePreset } from '../../mock_data/adminKanbanData';
import './FollowupsPage.css';

export const FollowupsPage: React.FC = () => {
  const { tenant, user } = useAuth();
  const { initiateCall } = useCall();

  const [followups, setFollowups] = useState<Followup[]>([]);
  const [callsList, setCallsList] = useState<CallRecord[]>([]);
  const [allLeads, setAllLeads] = useState<Lead[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'due' | 'overdue'>('all');
  const [rescheduleItem, setRescheduleItem] = useState<Followup | null>(null);
  const [newDate, setNewDate] = useState('');

  // Profile Drawer state for GHL Sales Exec & Admin
  const [drawerFollowup, setDrawerFollowup] = useState<Followup | null>(null);

  const roleCode = user?.role?.code;
  const isExec = roleCode === 'sales_executive';
  const isGhlAdmin =
    (tenant?.slug === 'ghl' || tenant?.id === 't-ghl-01') &&
    ((roleCode as string) === 'company_admin' || (roleCode as string) === 'admin' || roleCode === 'super_admin');
  const isAdmin =
    isGhlAdmin ||
    (roleCode as string) === 'company_admin' ||
    (roleCode as string) === 'admin' ||
    roleCode === 'super_admin';
  const isGhlSalesExec = tenant?.slug === 'ghl' && isExec;
  const canOpenDrawer = isGhlSalesExec || isAdmin;

  // ── Admin Filter States ──────────────────────────────────────────────────
  const [selectedRole, setSelectedRole] = useState<FollowupRoleFilter>('sales_executive');
  const [selectedPerson, setSelectedPerson] = useState<string>('All');
  const [dateRangePreset, setDateRangePreset] = useState<DateRangePreset>('this_month');
  const [customStartDate, setCustomStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(1); // 1st of current month
    return d.toISOString().split('T')[0];
  });
  const [customEndDate, setCustomEndDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });

  const handleRoleChange = (newRole: FollowupRoleFilter) => {
    setSelectedRole(newRole);
    setSelectedPerson('All');
  };

  const personOptions = useMemo(() => {
    return selectedRole === 'sales_executive' ? SALES_EXECUTIVE_USERS : IRM_USERS;
  }, [selectedRole]);

  const loadData = async () => {
    try {
      const [data, calls, leads] = await Promise.all([
        getFollowups(tenant?.id),
        getCalls(tenant?.id),
        getLeads(tenant?.id),
      ]);
      setFollowups(data || []);
      setCallsList(calls || []);
      setAllLeads(leads || []);
    } catch (err) {
      console.error('Failed to load followups data', err);
    }
  };

  useEffect(() => {
    loadData();
    const handleUpdate = () => loadData();
    window.addEventListener('nexus_storage_updated', handleUpdate);
    return () => window.removeEventListener('nexus_storage_updated', handleUpdate);
  }, [tenant?.id]);

  const handleSaveReschedule = () => {
    if (rescheduleItem && newDate) {
      apiSaveFollowup({ ...rescheduleItem, scheduledAt: newDate, status: 'Pending' }).catch(console.error);
      setRescheduleItem(null);
      setNewDate('');
    }
  };

  // Helper to determine the assigned role of any followup
  const getFollowupRole = (f: Followup): 'Sales Executive' | 'IRM' => {
    if (f.assignedRole) {
      if (f.assignedRole.toLowerCase().includes('irm')) return 'IRM';
      return 'Sales Executive';
    }
    if (
      IRM_USERS.some(
        u =>
          u.name.toLowerCase() === (f.assignedAgentName || '').toLowerCase() ||
          u.id === f.assignedAgentId
      )
    ) {
      return 'IRM';
    }
    if (f.contactType === 'investor') {
      return 'IRM';
    }
    return 'Sales Executive';
  };

  // Helper to test if a followup date falls within date range filter
  const isFollowupInDateFilter = (f: Followup): boolean => {
    const schedStr = (f.scheduledAt || '').trim();
    const dateStr = (f.scheduledDate || '').trim();
    const now = new Date();

    const isToday = schedStr.toLowerCase().includes('today');
    const isYesterday = schedStr.toLowerCase().includes('yesterday');

    if (dateRangePreset === 'today') {
      if (isToday) return true;
      if (isYesterday) return false;
      const parsedTime = Date.parse(schedStr) || (dateStr ? Date.parse(dateStr) : NaN);
      if (!isNaN(parsedTime)) {
        const d = new Date(parsedTime);
        return (
          d.getDate() === now.getDate() &&
          d.getMonth() === now.getMonth() &&
          d.getFullYear() === now.getFullYear()
        );
      }
      return true;
    }

    if (dateRangePreset === 'this_week') {
      if (isToday || isYesterday) return true;
      const parsedTime = Date.parse(schedStr) || (dateStr ? Date.parse(dateStr) : NaN);
      if (!isNaN(parsedTime)) {
        const sevenDaysAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000;
        return parsedTime >= sevenDaysAgo;
      }
      return true;
    }

    if (dateRangePreset === 'this_month') {
      if (isToday || isYesterday) return true;
      const parsedTime = Date.parse(schedStr) || (dateStr ? Date.parse(dateStr) : NaN);
      if (!isNaN(parsedTime)) {
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
        return parsedTime >= monthStart;
      }
      return true;
    }

    if (dateRangePreset === 'custom') {
      if (!customStartDate && !customEndDate) return true;
      const start = customStartDate ? new Date(`${customStartDate}T00:00:00`).getTime() : 0;
      const end = customEndDate ? new Date(`${customEndDate}T23:59:59`).getTime() : Infinity;

      if (isToday) {
        const todayMs = now.getTime();
        return todayMs >= start && todayMs <= end;
      }
      if (isYesterday) {
        const yestMs = now.getTime() - 24 * 60 * 60 * 1000;
        return yestMs >= start && yestMs <= end;
      }
      const parsedTime = Date.parse(schedStr) || (dateStr ? Date.parse(dateStr) : NaN);
      if (!isNaN(parsedTime)) {
        return parsedTime >= start && parsedTime <= end;
      }
      return true;
    }

    return true;
  };

  // Scoped dataset according to role and admin filters
  let scopedFollowups: Followup[];
  if (isAdmin) {
    scopedFollowups = followups.filter(f => {
      // 1. Role match
      const role = getFollowupRole(f);
      const expectedRole = selectedRole === 'irm' ? 'IRM' : 'Sales Executive';
      if (role !== expectedRole) return false;

      // 2. Person match
      if (selectedPerson !== 'All') {
        const matchesName =
          (f.assignedAgentName || '').toLowerCase() === selectedPerson.toLowerCase();
        const matchesId = f.assignedAgentId === selectedPerson;
        if (!matchesName && !matchesId) return false;
      }

      // 3. Date range match
      if (!isFollowupInDateFilter(f)) return false;

      return true;
    });
  } else if (isExec) {
    scopedFollowups = followups.filter(
      f =>
        (f.assignedAgentId && f.assignedAgentId === user?.id) ||
        (f.assignedAgentName && f.assignedAgentName === user?.name)
    );
  } else {
    scopedFollowups = followups;
  }

  // Safely deduplicate display rows
  let processedFollowups = scopedFollowups;
  if (isGhlSalesExec || isAdmin) {
    try {
      const seen = new Map<string, Followup>();
      const deduped: Followup[] = [];

      for (const f of scopedFollowups) {
        if (f.status !== 'Pending') {
          deduped.push(f);
          continue;
        }
        const phoneDigits = (f.contactPhone || '').replace(/\D/g, '').slice(-10);
        const key =
          f.contactId && f.contactId !== 'contact-new'
            ? `id:${f.contactId}`
            : phoneDigits
            ? `phone:${phoneDigits}`
            : `raw:${f.id}`;

        if (!seen.has(key)) {
          seen.set(key, f);
          deduped.push(f);
        }
      }
      processedFollowups = deduped;
    } catch (err) {
      console.error('Error deduping followups list:', err);
      processedFollowups = scopedFollowups;
    }
  }

  const getCallCountForFollowup = (f: Followup): number => {
    const fPhoneDigits = (f.contactPhone || '').replace(/\D/g, '').slice(-10);
    return callsList.filter((c: CallRecord) => {
      if (
        f.contactId &&
        f.contactId !== 'contact-new' &&
        (c.leadId === f.contactId || (c as any).contactId === f.contactId)
      ) {
        return true;
      }
      const cPhoneDigits = (c.contactPhone || '').replace(/\D/g, '').slice(-10);
      return cPhoneDigits && fPhoneDigits && cPhoneDigits === fPhoneDigits;
    }).length;
  };

  // ── GHL cross-reference safety filter ─────────────────────────────────────
  if (isGhlSalesExec || isGhlAdmin) {
    try {
      const niJunkLeadIds = new Set<string>(
        allLeads
          .filter((l: Lead) => l.status === 'Not Interested' || l.status === 'Junk')
          .map((l: Lead) => l.id)
      );
      const niJunkPhones = new Set<string>(
        allLeads
          .filter((l: Lead) => l.status === 'Not Interested' || l.status === 'Junk')
          .map((l: Lead) => (l.phone || '').replace(/\D/g, '').slice(-10))
          .filter(Boolean)
      );

      processedFollowups = processedFollowups.filter(f => {
        if (f.status !== 'Pending') return true;
        if (f.contactId && f.contactId !== 'contact-new' && niJunkLeadIds.has(f.contactId))
          return false;
        const fPhone = (f.contactPhone || '').replace(/\D/g, '').slice(-10);
        if (fPhone && niJunkPhones.has(fPhone)) return false;
        return true;
      });
    } catch (err) {
      console.error('Error in GHL NI/Junk cross-reference filter:', err);
    }
  }

  // Count badges
  const activePendingFollowups = processedFollowups.filter(f => f.status === 'Pending');

  const filteredFollowups = processedFollowups.filter(f => {
    if (activeTab === 'due') {
      return f.status === 'Pending' && (f.scheduledAt || '').toLowerCase().includes('today');
    }
    if (activeTab === 'overdue') {
      return f.status === 'Pending' && (f.scheduledAt || '').toLowerCase().includes('yesterday');
    }
    return f.status === 'Pending';
  });

  const drawerFollowupRole = drawerFollowup ? getFollowupRole(drawerFollowup) : '';

  return (
    <div className="followups-page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <CalendarCheck size={24} color="var(--primary-600)" /> Follow-ups & Reminders
          </h1>
          <p className="page-subtitle">
            Keep commitments, maintain pipeline velocity, and log outcomes seamlessly.
          </p>
        </div>
      </div>

      {/* ── Admin Global Filter Bar ─────────────────────────────────────────── */}
      {isAdmin && (
        <div className="admin-followup-filterbar">
          <div className="admin-followup-filter-group">
            {/* 1. Role Filter */}
            <div className="followup-filter-item">
              <span className="followup-filter-label">
                <Briefcase size={14} color="var(--primary-600)" />
                Role:
              </span>
              <select
                className="followup-filter-select"
                value={selectedRole}
                onChange={e => handleRoleChange(e.target.value as FollowupRoleFilter)}
              >
                <option value="sales_executive">Sales Executive</option>
                <option value="irm">IRM (Investor Relations)</option>
              </select>
            </div>

            {/* 2. Person Filter (Dynamic based on Role) */}
            <div className="followup-filter-item">
              <span className="followup-filter-label">
                <User size={14} color="var(--text-muted)" />
                Person:
              </span>
              <select
                className="followup-filter-select"
                value={selectedPerson}
                onChange={e => setSelectedPerson(e.target.value)}
              >
                <option value="All">
                  {selectedRole === 'sales_executive' ? 'All Sales Executives' : 'All IRMs'}
                </option>
                {personOptions.map(p => (
                  <option key={p.id} value={p.name}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            {/* 3. Date Range Filter */}
            <div className="followup-filter-item">
              <span className="followup-filter-label">
                <Calendar size={14} color="var(--text-muted)" />
                Date Range:
              </span>
              <select
                className="followup-filter-select"
                value={dateRangePreset}
                onChange={e => setDateRangePreset(e.target.value as DateRangePreset)}
              >
                <option value="today">Today</option>
                <option value="this_week">This Week</option>
                <option value="this_month">This Month</option>
                <option value="custom">Custom Date Range</option>
              </select>
            </div>

            {/* Inline Custom Date Inputs */}
            {dateRangePreset === 'custom' && (
              <div className="followup-date-custom-inputs">
                <input
                  type="date"
                  className="followup-date-input"
                  value={customStartDate}
                  onChange={e => setCustomStartDate(e.target.value)}
                  title="Start Date"
                />
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>to</span>
                <input
                  type="date"
                  className="followup-date-input"
                  value={customEndDate}
                  onChange={e => setCustomEndDate(e.target.value)}
                  title="End Date"
                />
              </div>
            )}
          </div>

          {/* Right Section: Role Mode Tag & Total Count */}
          <div className="admin-followup-meta-group">
            <span
              className={`followup-role-tag ${
                selectedRole === 'sales_executive' ? 'tag-sales-exec' : 'tag-irm'
              }`}
            >
              {selectedRole === 'sales_executive' ? (
                <>
                  <Briefcase size={13} /> Sales Executive Follow-ups
                </>
              ) : (
                <>
                  <Sparkles size={13} /> IRM Investor Follow-ups
                </>
              )}
            </span>

            <span className="followup-total-badge">
              Total Tasks: <strong>{activePendingFollowups.length}</strong>
            </span>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="followups-tabs-container">
        {[
          { id: 'all', label: `All Tasks (${activePendingFollowups.length})` },
          {
            id: 'due',
            label: `Due Today (${
              activePendingFollowups.filter(f =>
                (f.scheduledAt || '').toLowerCase().includes('today')
              ).length
            })`,
          },
          {
            id: 'overdue',
            label: `Overdue (${
              activePendingFollowups.filter(f =>
                (f.scheduledAt || '').toLowerCase().includes('yesterday')
              ).length
            })`,
            danger: true,
          },
        ].map(tab => (
          <button
            key={tab.id}
            className={`btn btn-sm ${
              activeTab === tab.id ? 'btn-primary' : 'btn-secondary'
            } ${
              tab.danger && activeTab === tab.id
                ? 'followups-tab-danger-active'
                : tab.danger
                ? 'followups-tab-danger-inactive'
                : ''
            }`}
            onClick={() => setActiveTab(tab.id as any)}
          >
            {tab.danger && (
              <AlertTriangle size={13} color={activeTab === tab.id ? '#ffffff' : '#dc2626'} />
            )}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Follow-ups List Cards */}
      <div className="followups-list">
        {filteredFollowups.length === 0 ? (
          <div className="card text-center followups-empty-card">
            No tasks in this category. You're all caught up!
          </div>
        ) : (
          filteredFollowups.map(f => {
            const isOverdue =
              f.status === 'Pending' && (f.scheduledAt || '').toLowerCase().includes('yesterday');
            const callCount = getCallCountForFollowup(f);
            const fRole = getFollowupRole(f);

            return (
              <div
                key={f.id}
                className={`card card-hover followup-item-card ${isOverdue ? 'overdue' : ''}`}
                onClick={canOpenDrawer ? () => setDrawerFollowup(f) : undefined}
                style={canOpenDrawer ? { cursor: 'pointer' } : undefined}
              >
                <div className="followup-item-left">
                  <div>
                    <div
                      className="followup-contact-header"
                      style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}
                    >
                      <span
                        className="followup-contact-name"
                        style={canOpenDrawer ? { color: 'var(--primary-600)', fontWeight: 700 } : undefined}
                      >
                        {f.contactName}
                      </span>

                      <StatusChip status={f.priority} size="sm" />

                      {callCount > 0 && (
                        <span
                          style={{
                            backgroundColor: '#f1f5f9',
                            color: '#475569',
                            fontSize: 11,
                            fontWeight: 600,
                            padding: '2px 8px',
                            borderRadius: 12,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          📞 {callCount} {callCount === 1 ? 'call' : 'calls'}
                        </span>
                      )}

                      <span className="followup-contact-phone">Phone: {f.contactPhone}</span>
                    </div>

                    <p className="followup-notes">{f.notes}</p>

                    <div className="followup-meta-row">
                      <span className={`followup-schedule-time ${isOverdue ? 'overdue' : ''}`}>
                        ⏰ {f.scheduledAt}
                      </span>
                      <span className="followup-assignee">• Assignee: {f.assignedAgentName}</span>
                      <span
                        className={`badge-role-inline ${
                          fRole === 'IRM' ? 'badge-role-irm' : 'badge-role-sales'
                        }`}
                      >
                        {fRole}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="followup-actions-right">
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={e => {
                      e.stopPropagation();
                      setRescheduleItem(f);
                    }}
                  >
                    Reschedule
                  </button>
                  <button
                    className="btn btn-call btn-sm"
                    onClick={e => {
                      e.stopPropagation();
                      initiateCall(
                        f.contactName,
                        f.contactPhone,
                        f.contactType as any,
                        f.contactId,
                        f.id
                      );
                    }}
                  >
                    <Phone size={13} /> Call
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Reschedule Modal */}
      <Modal
        isOpen={!!rescheduleItem}
        onClose={() => setRescheduleItem(null)}
        title="Reschedule Follow-up"
        subtitle={`Adjust scheduled reminder date for ${rescheduleItem?.contactName}`}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setRescheduleItem(null)}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleSaveReschedule}>
              Save New Slot
            </button>
          </>
        }
      >
        <div className="form-group">
          <label className="form-label">New Date & Time</label>
          <input
            type="text"
            className="form-input"
            value={newDate}
            onChange={e => setNewDate(e.target.value)}
            placeholder="e.g. Next Monday, 10:00 AM"
          />
        </div>
      </Modal>

      {/* Contact Profile & Detailed Attribution Drawer (GHL Sales Exec & Admin) */}
      {canOpenDrawer && (
        <Drawer
          isOpen={!!drawerFollowup}
          onClose={() => setDrawerFollowup(null)}
          title={drawerFollowup?.contactName || 'Contact Profile'}
          subtitle={
            isAdmin
              ? `Phone: ${drawerFollowup?.contactPhone || '—'} • Assigned to: ${
                  drawerFollowup?.assignedAgentName || 'Unassigned'
                } (${drawerFollowupRole})`
              : `Phone: ${drawerFollowup?.contactPhone || '—'} • ${tenant?.name}`
          }
          width={600}
        >
          {drawerFollowup && (
            <div className="followup-drawer-body">
              {/* Prominent Admin Representative Attribution Card */}
              {isAdmin && (
                <div className="admin-detail-owner-banner">
                  <div className="admin-owner-header-row">
                    <div className="admin-owner-avatar-icon">
                      <User size={18} color="var(--primary-600)" />
                    </div>
                    <div className="admin-owner-title-block">
                      <span className="admin-owner-label">Assigned Representative Data</span>
                      <div className="admin-owner-name-row">
                        <strong className="admin-owner-person-name">
                          {drawerFollowup.assignedAgentName || 'Unassigned'}
                        </strong>
                        <span
                          className={`admin-owner-role-tag ${
                            drawerFollowupRole === 'IRM' ? 'tag-irm' : 'tag-sales-exec'
                          }`}
                        >
                          <Briefcase size={12} />
                          {drawerFollowupRole === 'IRM'
                            ? 'IRM (Investor Relations)'
                            : 'Sales Executive'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="admin-owner-meta-grid">
                    <div className="admin-owner-meta-cell">
                      <span className="cell-lbl">Scheduled Slot</span>
                      <span className="cell-val">⏰ {drawerFollowup.scheduledAt}</span>
                    </div>
                    <div className="admin-owner-meta-cell">
                      <span className="cell-lbl">Priority Level</span>
                      <span className="cell-val">{drawerFollowup.priority}</span>
                    </div>
                    <div className="admin-owner-meta-cell">
                      <span className="cell-lbl">Record Type</span>
                      <span className="cell-val">
                        {drawerFollowup.contactType
                          ? drawerFollowup.contactType.toUpperCase()
                          : 'LEAD'}
                      </span>
                    </div>
                    <div className="admin-owner-meta-cell">
                      <span className="cell-lbl">Task Status</span>
                      <span className="cell-val">{drawerFollowup.status}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Standard Lead / Investor Detail Content */}
              <LeadDetailDrawerContent
                contactName={drawerFollowup.contactName}
                contactPhone={drawerFollowup.contactPhone}
                contactId={drawerFollowup.contactId}
                contactType={drawerFollowup.contactType}
                tenantId={tenant?.id}
                tenantName={tenant?.name}
                onCall={() =>
                  initiateCall(
                    drawerFollowup.contactName,
                    drawerFollowup.contactPhone,
                    drawerFollowup.contactType as any,
                    drawerFollowup.contactId,
                    drawerFollowup.id
                  )
                }
                callDispositionFilter={['Follow-up Required', 'Call Back']}
              />
            </div>
          )}
        </Drawer>
      )}
    </div>
  );
};

