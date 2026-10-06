import React, { useState, useEffect, useCallback } from 'react';
import {
  UserCheck,
  Users,
  Calendar,
  Clock,
  ArrowRight,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  FileCheck,
  PhoneCall,
  CalendarCheck,
  PlusCircle,
  RefreshCw,
  FolderSync,
  History,
  Info,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  workHandoverService,
  HandoverCandidateUser,
  HandoverPreviewCounts,
  WorkHandoverDto,
  HandoverItemDto,
  CoverSuggestionDto
} from '../../services/workHandoverService';
import './WorkHandoverPage.css';

export interface WorkHandoverPageProps {
  initialParams?: {
    fromUserId?: number;
    plannedEndAt?: string;
    reason?: string;
    leaveRequestId?: number;
    fromUserName?: string;
    leaveDates?: string;
    roleCode?: string;
  };
  onNavigate?: (route: string) => void;
}

export const WorkHandoverPage: React.FC<WorkHandoverPageProps> = ({ initialParams, onNavigate }) => {
  const [selectedRole, setSelectedRole] = useState<'sales_executive' | 'irm'>(() => {
    if (initialParams?.roleCode === 'irm') return 'irm';
    return 'sales_executive';
  });
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');

  // Leave prefill & banner info
  const [leaveBannerInfo, setLeaveBannerInfo] = useState<{ name: string; dates: string } | null>(() => {
    if (initialParams?.leaveRequestId && initialParams?.fromUserName) {
      return {
        name: initialParams.fromUserName,
        dates: initialParams.leaveDates || ''
      };
    }
    return null;
  });
  const [leaveRequestId, setLeaveRequestId] = useState<number | null>(() => initialParams?.leaveRequestId || null);

  // Candidate users
  const [candidates, setCandidates] = useState<HandoverCandidateUser[]>([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);

  // Form inputs
  const [sourceUserId, setSourceUserId] = useState<number | ''>(() => initialParams?.fromUserId || '');
  const [coveringUserId, setCoveringUserId] = useState<number | ''>(''); // Always empty by default
  const [plannedEndAt, setPlannedEndAt] = useState<string>(() => {
    if (initialParams?.plannedEndAt) {
      return initialParams.plannedEndAt.split('T')[0];
    }
    return '';
  });
  const [notes, setNotes] = useState<string>(() => initialParams?.reason || '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Cover suggestions
  const [coverSuggestions, setCoverSuggestions] = useState<CoverSuggestionDto[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  // Live preview counts
  const [preview, setPreview] = useState<HandoverPreviewCounts | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  // Active handovers & history
  const [activeHandovers, setActiveHandovers] = useState<WorkHandoverDto[]>([]);
  const [historyHandovers, setHistoryHandovers] = useState<WorkHandoverDto[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Modals state
  const [endModalHandover, setEndModalHandover] = useState<WorkHandoverDto | null>(null);
  const [endSummaryNotes, setEndSummaryNotes] = useState('');
  const [endingHandover, setEndingHandover] = useState(false);

  const [returnItemsModalHandover, setReturnItemsModalHandover] = useState<WorkHandoverDto | null>(null);
  const [selectedItemIds, setSelectedItemIds] = useState<number[]>([]);
  const [returnNotes, setReturnNotes] = useState('');
  const [returningItems, setReturningItems] = useState(false);

  // Expandable summary in history
  const [expandedHistoryIds, setExpandedHistoryIds] = useState<Record<number, boolean>>({});

  const showFeedback = (type: 'success' | 'error', text: string) => {
    setFeedbackMsg({ type, text });
    setTimeout(() => setFeedbackMsg(null), 5000);
  };

  // Load Candidates
  const loadCandidates = useCallback(async (role: string) => {
    try {
      setLoadingCandidates(true);
      const res = await workHandoverService.getCandidates(role);
      setCandidates(res || []);
    } catch (err: any) {
      console.error('Failed to load handover candidates:', err);
    } finally {
      setLoadingCandidates(false);
    }
  }, []);

  // Load Active & History lists
  const loadHandovers = useCallback(async (_role: string) => {
    try {
      setLoadingList(true);
      const [active, history] = await Promise.all([
        workHandoverService.getActiveHandovers(),
        workHandoverService.getHandoverHistory()
      ]);
      setActiveHandovers(active);
      setHistoryHandovers(history);
    } catch (err: any) {
      console.error('Failed to load handovers:', err);
    } finally {
      setLoadingList(false);
    }
  }, []);

  // When initialParams changes (e.g. from Arrange Handover shortcut)
  useEffect(() => {
    if (initialParams?.fromUserId) {
      if (initialParams.roleCode) {
        setSelectedRole(initialParams.roleCode === 'irm' ? 'irm' : 'sales_executive');
      }
      setSourceUserId(initialParams.fromUserId);
      if (initialParams.plannedEndAt) {
        setPlannedEndAt(initialParams.plannedEndAt.split('T')[0]);
      }
      if (initialParams.reason) {
        setNotes(initialParams.reason);
      }
      if (initialParams.leaveRequestId) {
        setLeaveRequestId(initialParams.leaveRequestId);
        setLeaveBannerInfo({
          name: initialParams.fromUserName || 'Team Member',
          dates: initialParams.leaveDates || ''
        });
      }
      setCoveringUserId(''); // Covering user ALWAYS stays empty by default
    }
  }, [initialParams]);

  // On role change or initial mount
  const isFirstMount = React.useRef(true);
  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      loadCandidates(selectedRole);
      loadHandovers(selectedRole);
      return;
    }
    setSourceUserId('');
    setCoveringUserId('');
    setPreview(null);
    setCoverSuggestions([]);
    loadCandidates(selectedRole);
    loadHandovers(selectedRole);
  }, [selectedRole, loadCandidates, loadHandovers]);

  // Load cover suggestions when source user changes
  useEffect(() => {
    if (!sourceUserId) {
      setCoverSuggestions([]);
      return;
    }
    let isMounted = true;
    const fetchSuggestions = async () => {
      try {
        setLoadingSuggestions(true);
        const data = await workHandoverService.getCoverSuggestions(Number(sourceUserId));
        if (isMounted) setCoverSuggestions(data);
      } catch (err) {
        console.error('Failed to load cover suggestions:', err);
      } finally {
        if (isMounted) setLoadingSuggestions(false);
      }
    };
    fetchSuggestions();
    return () => { isMounted = false; };
  }, [sourceUserId]);

  // Load preview when source user changes
  useEffect(() => {
    if (!sourceUserId) {
      setPreview(null);
      return;
    }
    let isMounted = true;
    const fetchPreview = async () => {
      try {
        setLoadingPreview(true);
        // Preview needs both from and to user to be meaningful; fetch when both are selected
        if (sourceUserId && coveringUserId) {
          const data = await workHandoverService.getPreview(Number(sourceUserId), Number(coveringUserId));
          if (isMounted) setPreview(data);
        }
      } catch (err) {
        console.error('Failed to fetch preview counts:', err);
      } finally {
        if (isMounted) setLoadingPreview(false);
      }
    };
    fetchPreview();
    return () => { isMounted = false; };
  }, [sourceUserId, coveringUserId]);

  // Handle Start Handover
  const handleStartHandover = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sourceUserId || !coveringUserId) {
      showFeedback('error', 'Please select both source user and covering user.');
      return;
    }
    if (sourceUserId === coveringUserId) {
      showFeedback('error', 'Source and covering user cannot be the same person.');
      return;
    }

    try {
      setIsSubmitting(true);
      await workHandoverService.startHandover({
        fromUserId: Number(sourceUserId),
        toUserId: Number(coveringUserId),
        reason: notes.trim() || `Work handover — ${selectedRole === 'irm' ? 'IRM' : 'Sales Executive'} leave coverage`,
        plannedEndAt: plannedEndAt ? new Date(plannedEndAt).toISOString() : undefined,
        leaveRequestId: leaveRequestId || undefined,
      });

      showFeedback('success', 'Work handover started successfully.');
      setSourceUserId('');
      setCoveringUserId('');
      setPlannedEndAt('');
      setNotes('');
      setLeaveRequestId(null);
      setLeaveBannerInfo(null);
      setPreview(null);
      setCoverSuggestions([]);
      await loadCandidates(selectedRole);
      await loadHandovers(selectedRole);
    } catch (err: any) {
      showFeedback('error', err.message || 'Failed to start handover.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle End Handover
  const handleEndHandover = async () => {
    if (!endModalHandover) return;
    try {
      setEndingHandover(true);
      await workHandoverService.endHandover(endModalHandover.id);
      showFeedback('success', `Handover for ${endModalHandover.originalUserName} ended and all items returned.`);
      setEndModalHandover(null);
      setEndSummaryNotes('');
      await loadCandidates(selectedRole);
      await loadHandovers(selectedRole);
    } catch (err: any) {
      showFeedback('error', err.message || 'Failed to end handover.');
    } finally {
      setEndingHandover(false);
    }
  };

  // Handle Return Selected Items
  const handleReturnSelectedItems = async () => {
    if (!returnItemsModalHandover || selectedItemIds.length === 0) return;
    try {
      setReturningItems(true);
      await workHandoverService.returnSelectedItems(returnItemsModalHandover.id, {
        itemIds: selectedItemIds,
      });
      showFeedback('success', `${selectedItemIds.length} item(s) returned early to source owner.`);
      setReturnItemsModalHandover(null);
      setSelectedItemIds([]);
      setReturnNotes('');
      await loadCandidates(selectedRole);
      await loadHandovers(selectedRole);
    } catch (err: any) {
      showFeedback('error', err.message || 'Failed to return items.');
    } finally {
      setReturningItems(false);
    }
  };

  // Eligible covering users filter
  const eligibleCoveringUsers = candidates.filter(u => {
    if (sourceUserId && u.userId === Number(sourceUserId)) return false;
    if (u.isCovering) return false;
    if (u.isCovered) return false;
    return true;
  });

  const toggleHistoryExpanded = (id: number) => {
    setExpandedHistoryIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const totalActiveCoverages = activeHandovers.length;
  const totalItemsHandedOver = activeHandovers.reduce((sum, h) => sum + (h.totalItemsCount || 0), 0);

  return (
    <div className="work-handover-page">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <div className="page-title">
            <FolderSync size={26} color="var(--brand-primary, #6366f1)" />
            Work Handover Administration
          </div>
          <div className="page-subtitle">
            Manage temporary coverage for team members on leave or vacation with automated record handover and return tracking.
          </div>
        </div>

        {/* Role Selector Pills */}
        <div className="handover-role-selector">
          <button
            type="button"
            className={`role-pill-btn ${selectedRole === 'sales_executive' ? 'active' : ''}`}
            onClick={() => setSelectedRole('sales_executive')}
          >
            <Users size={16} />
            Sales Executives
          </button>
          <button
            type="button"
            className={`role-pill-btn ${selectedRole === 'irm' ? 'active' : ''}`}
            onClick={() => setSelectedRole('irm')}
          >
            <UserCheck size={16} />
            IRMs (Investors)
          </button>
        </div>
      </div>

      {/* Leave Arrangement Banner */}
      {leaveBannerInfo && (
        <div className="handover-leave-banner">
          <div className="handover-leave-banner-content">
            <Info size={18} color="#818cf8" />
            <span>
              Arranging handover for <strong>{leaveBannerInfo.name}</strong>'s leave ({leaveBannerInfo.dates})
            </span>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-xs"
            onClick={() => setLeaveBannerInfo(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Feedback Toast */}
      {feedbackMsg && (
        <div
          style={{
            padding: '12px 18px',
            borderRadius: 'var(--radius-md)',
            background: feedbackMsg.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
            border: `1px solid ${feedbackMsg.type === 'success' ? '#10b981' : '#ef4444'}`,
            color: feedbackMsg.type === 'success' ? '#10b981' : '#ef4444',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          {feedbackMsg.type === 'success' ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
          {feedbackMsg.text}
        </div>
      )}

      {/* Overview KPI Cards */}
      <div className="handover-kpis">
        <div className="handover-kpi-card">
          <div className="handover-kpi-icon" style={{ background: 'rgba(99, 102, 241, 0.12)', color: '#6366f1' }}>
            <FolderSync size={22} />
          </div>
          <div>
            <div className="handover-kpi-val">{totalActiveCoverages}</div>
            <div className="handover-kpi-label">Active {selectedRole === 'irm' ? 'IRM' : 'Sales'} Coverages</div>
          </div>
        </div>

        <div className="handover-kpi-card">
          <div className="handover-kpi-icon" style={{ background: 'rgba(16, 185, 129, 0.12)', color: '#10b981' }}>
            <FileCheck size={22} />
          </div>
          <div>
            <div className="handover-kpi-val">{totalItemsHandedOver}</div>
            <div className="handover-kpi-label">Active Handed-Over Records</div>
          </div>
        </div>

        <div className="handover-kpi-card">
          <div className="handover-kpi-icon" style={{ background: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b' }}>
            <Users size={22} />
          </div>
          <div>
            <div className="handover-kpi-val">{eligibleCoveringUsers.length}</div>
            <div className="handover-kpi-label">Available Covering Peers</div>
          </div>
        </div>

        <div className="handover-kpi-card">
          <div className="handover-kpi-icon" style={{ background: 'rgba(59, 130, 246, 0.12)', color: '#3b82f6' }}>
            <History size={22} />
          </div>
          <div>
            <div className="handover-kpi-val">{historyHandovers.length}</div>
            <div className="handover-kpi-label">Completed Handovers</div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="handover-tabs">
        <button
          type="button"
          className={`handover-tab-btn ${activeTab === 'active' ? 'active' : ''}`}
          onClick={() => setActiveTab('active')}
        >
          <FolderSync size={16} />
          Active Coverages & Start Handover
        </button>
        <button
          type="button"
          className={`handover-tab-btn ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          <History size={16} />
          Coverage History ({historyHandovers.length})
        </button>
      </div>

      {activeTab === 'active' && (
        <>
          {/* Start Handover Section */}
          <div className="start-handover-card">
            <div className="card-title-row">
              <div className="card-title">
                <PlusCircle size={18} color="var(--brand-primary, #6366f1)" />
                Initiate New Work Handover
              </div>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ padding: '6px 12px', fontSize: 12 }}
                onClick={() => {
                  loadCandidates(selectedRole);
                  loadHandovers(selectedRole);
                }}
              >
                <RefreshCw size={14} className={loadingCandidates ? 'spin' : ''} />
                Refresh Candidates
              </button>
            </div>

            <form onSubmit={handleStartHandover}>
              <div className="handover-form-grid">
                {/* Source User Dropdown */}
                <div className="handover-field-group">
                  <label>Team Member Going on Leave (Source User) *</label>
                  <select
                    className="handover-select"
                    value={sourceUserId}
                    onChange={e => setSourceUserId(e.target.value ? Number(e.target.value) : '')}
                    required
                  >
                    <option value="">-- Select Member Going on Leave --</option>
                    {candidates.map(u => {
                      const isUnavailable = u.isCovering || u.isCovered;
                      let labelTag = '';
                      if (u.isCovered) labelTag = ' (Already covered)';
                      else if (u.isCovering) labelTag = ' (Currently covering someone)';

                      return (
                        <option key={u.userId} value={u.userId} disabled={isUnavailable}>
                          {u.name} ({u.openItemsCount} open items){labelTag}
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* Covering User Dropdown */}
                <div className="handover-field-group">
                  <label>Temporary Covering Team Member *</label>
                  <select
                    className="handover-select"
                    value={coveringUserId}
                    onChange={e => setCoveringUserId(e.target.value ? Number(e.target.value) : '')}
                    required
                    disabled={!sourceUserId || loadingSuggestions}
                  >
                    <option value="">-- Select Covering Peer --</option>
                    {coverSuggestions.length > 0 ? (
                      coverSuggestions.map(s => {
                        let extra = '';
                        if (s.recommended) extra += ' — (Recommended)';
                        if (s.currentlyCovering) extra += ' — (Currently covering)';
                        if (s.disabled && s.disabledReason) extra += ` — [${s.disabledReason}]`;
                        return (
                          <option key={s.userId} value={s.userId} disabled={s.disabled}>
                            {s.name} ({s.openItemCount} open items){extra}
                          </option>
                        );
                      })
                    ) : (
                      eligibleCoveringUsers.map(u => (
                        <option key={u.userId} value={u.userId}>
                          {u.name} ({u.email})
                        </option>
                      ))
                    )}
                  </select>
                  {loadingSuggestions && (
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <RefreshCw size={11} className="spin" />
                      Loading cover suggestions...
                    </span>
                  )}
                  {!loadingSuggestions && sourceUserId && coverSuggestions.length > 0 && coverSuggestions.every(s => s.disabled) && (
                    <span style={{ fontSize: 11, color: '#f59e0b', marginTop: 4 }}>
                      <ShieldAlert size={12} style={{ display: 'inline', marginRight: 4 }} />
                      No eligible covering peers available (all are on leave or covered).
                    </span>
                  )}
                  {!loadingSuggestions && sourceUserId && coverSuggestions.length === 0 && eligibleCoveringUsers.length === 0 && (
                    <span style={{ fontSize: 11, color: '#f59e0b', marginTop: 4 }}>
                      <ShieldAlert size={12} style={{ display: 'inline', marginRight: 4 }} />
                      No eligible covering peers available (all are active in existing handovers).
                    </span>
                  )}
                </div>

                {/* Planned Return Date */}
                <div className="handover-field-group">
                  <label>Planned Return Date (Optional)</label>
                  <input
                    type="date"
                    className="handover-input"
                    value={plannedEndAt}
                    onChange={e => setPlannedEndAt(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                  />
                </div>

                {/* Reason / Notes */}
                <div className="handover-field-group">
                  <label>Coverage Notes / Reason (Optional)</label>
                  <input
                    type="text"
                    className="handover-input"
                    placeholder="e.g., Annual leave coverage for 10 days"
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                  />
                </div>
              </div>

              {/* Live Preview Card */}
              {loadingPreview && (
                <div className="handover-preview-box">
                  <div className="preview-title">
                    <RefreshCw size={14} className="spin" />
                    Calculating records to move...
                  </div>
                </div>
              )}

              {preview && !loadingPreview && (
                <div className="handover-preview-box">
                  <div className="preview-title">
                    <Info size={14} />
                    Live Record Transfer Preview for {preview.fromUserName}
                  </div>
                  <div className="preview-chips-grid">
                    {selectedRole === 'sales_executive' ? (
                      <>
                        <div className="preview-chip">
                          <span>Active Leads:</span>
                          <span className="preview-chip-count">{preview.leadsCount}</span>
                        </div>
                        <div className="preview-chip">
                          <span>Active Customers:</span>
                          <span className="preview-chip-count">{preview.customersCount}</span>
                        </div>
                        <div className="preview-chip">
                          <span>Pending Follow-ups:</span>
                          <span className="preview-chip-count">{preview.followupsCount}</span>
                        </div>
                        <div className="preview-chip">
                          <span>Active Deals:</span>
                          <span className="preview-chip-count">{preview.dealsCount}</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="preview-chip">
                          <span>Investors:</span>
                          <span className="preview-chip-count">{preview.investorsCount}</span>
                        </div>
                        <div className="preview-chip">
                          <span>Pending Follow-ups:</span>
                          <span className="preview-chip-count">{preview.followupsCount}</span>
                        </div>
                        <div className="preview-chip">
                          <span>Scheduled Consultations:</span>
                          <span className="preview-chip-count">{preview.consultationsCount}</span>
                        </div>
                        <div className="preview-chip">
                          <span>Pipeline Cards:</span>
                          <span className="preview-chip-count">{preview.pipelineCardsCount}</span>
                        </div>
                      </>
                    )}
                    <div className="preview-chip" style={{ borderColor: 'var(--brand-primary, #6366f1)', fontWeight: 600 }}>
                      <span>Total Open Items to Transfer:</span>
                      <span className="preview-chip-count" style={{ background: 'var(--brand-primary, #6366f1)', color: '#fff' }}>
                        {preview.totalCount}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={!sourceUserId || !coveringUserId || isSubmitting}
                >
                  <ArrowRight size={16} />
                  {isSubmitting ? 'Starting Handover...' : 'Start Work Handover'}
                </button>
              </div>
            </form>
          </div>

          {/* Active Handovers Table */}
          <div className="handover-table-container">
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-base)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                <UserCheck size={18} color="#10b981" />
                Active Team Coverages ({activeHandovers.length})
              </div>
            </div>

            {loadingList ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>
                Loading active handovers...
              </div>
            ) : activeHandovers.length === 0 ? (
              <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-secondary)' }}>
                No active work handovers for {selectedRole === 'irm' ? 'IRMs' : 'Sales Executives'}.
              </div>
            ) : (
              <table className="handover-table">
                <thead>
                  <tr>
                    <th>Covered User (On Leave)</th>
                    <th>Covering Peer</th>
                    <th>Started Date</th>
                    <th>Planned End</th>
                    <th>Live Progress During Coverage</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {activeHandovers.map(h => (
                    <tr key={h.id}>
                      <td>
                        <div className="user-cell">
                          <span className="user-name">{h.originalUserName}</span>
                          <span className="user-email">{h.originalUserEmail}</span>
                          <span style={{ fontSize: 11, color: '#f59e0b', marginTop: 2 }}>
                            {h.totalItemsCount} records handed over
                          </span>
                        </div>
                      </td>
                      <td>
                        <div className="user-cell">
                          <span className="user-name">{h.coveringUserName}</span>
                          <span className="user-email">{h.coveringUserEmail}</span>
                          <span className="badge-active" style={{ width: 'fit-content', marginTop: 4 }}>
                            Covering Active
                          </span>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Calendar size={14} color="var(--text-secondary)" />
                          {new Date(h.startedAt).toLocaleDateString()}
                        </div>
                      </td>
                      <td>
                        {h.plannedEndAt ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Clock size={14} color="var(--text-secondary)" />
                            {new Date(h.plannedEndAt).toLocaleDateString()}
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-secondary)' }}>Open-ended</span>
                        )}
                      </td>
                      <td>
                        <div className="progress-pills">
                          <span className="progress-pill calls" title="Calls made by covering peer">
                            <PhoneCall size={12} /> {h.progress?.callsMadeCount ?? 0} calls
                          </span>
                          <span className="progress-pill followups" title="Follow-ups completed">
                            <CalendarCheck size={12} /> {h.progress?.followupsCompletedCount ?? 0} follow-ups
                          </span>
                          <span className="progress-pill records" title="New records created during coverage">
                            <PlusCircle size={12} /> {h.progress?.newRecordsCreatedCount ?? 0} created
                          </span>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            style={{ padding: '6px 12px', fontSize: 12 }}
                            onClick={() => {
                              setReturnItemsModalHandover(h);
                              setSelectedItemIds([]);
                            }}
                          >
                            View / Return Items
                          </button>
                          <button
                            type="button"
                            className="btn btn-danger"
                            style={{ padding: '6px 12px', fontSize: 12 }}
                            onClick={() => {
                              setEndModalHandover(h);
                              setEndSummaryNotes('');
                            }}
                          >
                            End Coverage
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {activeTab === 'history' && (
        <div className="handover-table-container">
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-base)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
              <History size={18} color="var(--brand-primary, #6366f1)" />
              Coverage History ({historyHandovers.length})
            </div>
          </div>

          {loadingList ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>
              Loading history...
            </div>
          ) : historyHandovers.length === 0 ? (
            <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-secondary)' }}>
              No completed work handovers recorded for {selectedRole === 'irm' ? 'IRMs' : 'Sales Executives'}.
            </div>
          ) : (
            <table className="handover-table">
              <thead>
                <tr>
                  <th>Original User</th>
                  <th>Covered By</th>
                  <th>Duration</th>
                  <th>Status</th>
                  <th>Items Handed Over</th>
                  <th>Return Summary</th>
                </tr>
              </thead>
              <tbody>
                {historyHandovers.map(h => {
                  let returnSummary: any = null;
                  try {
                    if (h.returnSummaryJson) returnSummary = JSON.parse(h.returnSummaryJson);
                  } catch { }

                  const isExpanded = expandedHistoryIds[h.id];

                  return (
                    <React.Fragment key={h.id}>
                      <tr>
                        <td>
                          <div className="user-cell">
                            <span className="user-name">{h.originalUserName}</span>
                            <span className="user-email">{h.originalUserEmail}</span>
                          </div>
                        </td>
                        <td>
                          <div className="user-cell">
                            <span className="user-name">{h.coveringUserName}</span>
                            <span className="user-email">{h.coveringUserEmail}</span>
                          </div>
                        </td>
                        <td>
                          <div style={{ fontSize: 12 }}>
                            <div>Start: {new Date(h.startedAt).toLocaleDateString()}</div>
                            {h.endedAt && <div>End: {new Date(h.endedAt).toLocaleDateString()}</div>}
                          </div>
                        </td>
                        <td>
                          <span className="badge-completed">Completed</span>
                        </td>
                        <td>
                          <span style={{ fontWeight: 600 }}>{h.totalItemsCount} records</span>
                        </td>
                        <td>
                          {returnSummary ? (
                            <button
                              type="button"
                              className="btn btn-secondary"
                              style={{ padding: '4px 10px', fontSize: 11 }}
                              onClick={() => toggleHistoryExpanded(h.id)}
                            >
                              {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                              {isExpanded ? 'Hide Summary' : 'View Summary'}
                            </button>
                          ) : (
                            <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>No summary</span>
                          )}
                        </td>
                      </tr>

                      {/* Expandable Return Summary Row */}
                      {isExpanded && returnSummary && (
                        <tr>
                          <td colSpan={6} style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '16px 24px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--brand-primary, #6366f1)' }}>
                                Final Coverage Return Summary
                              </div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                                <div className="preview-chip">
                                  <span>Calls Made:</span>
                                  <span className="preview-chip-count">{returnSummary.callsMadeCount ?? 0}</span>
                                </div>
                                <div className="preview-chip">
                                  <span>Follow-ups Completed:</span>
                                  <span className="preview-chip-count">{returnSummary.followupsCompletedCount ?? 0}</span>
                                </div>
                                <div className="preview-chip">
                                  <span>New Records Created:</span>
                                  <span className="preview-chip-count">{returnSummary.newRecordsCreatedCount ?? 0}</span>
                                </div>
                                <div className="preview-chip">
                                  <span>Records Skipped (Reassigned):</span>
                                  <span className="preview-chip-count">{returnSummary.recordsSkippedCount ?? 0}</span>
                                </div>
                              </div>
                              {returnSummary.highlights && returnSummary.highlights.length > 0 && (
                                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: 'var(--text-secondary)' }}>
                                  {returnSummary.highlights.map((h: string, i: number) => <li key={i}>{h}</li>)}
                                </ul>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* End Coverage Confirmation Modal */}
      {endModalHandover && (
        <div className="handover-modal-overlay">
          <div className="handover-modal-content">
            <div className="handover-modal-header">
              <div style={{ fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                <ShieldAlert size={20} color="#dc2626" />
                End Coverage & Return All Items
              </div>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ border: 'none', padding: 4 }}
                onClick={() => setEndModalHandover(null)}
              >
                <XCircle size={18} />
              </button>
            </div>

            <div className="handover-modal-body">
              <p style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--text-primary)' }}>
                You are about to end the temporary coverage by <strong>{endModalHandover.coveringUserName}</strong> for{' '}
                <strong>{endModalHandover.originalUserName}</strong>.
              </p>

              <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: 'var(--radius-md)', padding: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#ef4444', marginBottom: 6 }}>
                  Automated Return Protocol:
                </div>
                <ul style={{ fontSize: 12, color: 'var(--text-primary)', margin: 0, paddingLeft: 18, lineHeight: 1.6 }}>
                  <li>All {endModalHandover.totalItemsCount} active records will be reassigned back to <strong>{endModalHandover.originalUserName}</strong>.</li>
                  <li>Any new deals or consultations created by the covering peer will now belong to <strong>{endModalHandover.originalUserName}</strong>.</li>
                  <li>All call logs remain recorded under the actual caller's identity.</li>
                  <li>Coverage status will be set to Completed and return summary stored for audit.</li>
                </ul>
              </div>

              <div className="handover-field-group">
                <label>Closing / Handover Notes (Optional)</label>
                <textarea
                  className="handover-textarea"
                  rows={3}
                  placeholder="e.g., Agent returned from leave, completed handover briefing."
                  value={endSummaryNotes}
                  onChange={e => setEndSummaryNotes(e.target.value)}
                />
              </div>
            </div>

            <div className="handover-modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setEndModalHandover(null)}
                disabled={endingHandover}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleEndHandover}
                disabled={endingHandover}
              >
                {endingHandover ? 'Reverting Records...' : 'Confirm & Return All'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Return Selected Items Modal */}
      {returnItemsModalHandover && (
        <div className="handover-modal-overlay">
          <div className="handover-modal-content" style={{ maxWidth: 700 }}>
            <div className="handover-modal-header">
              <div style={{ fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                <FolderSync size={20} color="var(--brand-primary, #6366f1)" />
                Early Return of Specific Items
              </div>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ border: 'none', padding: 4 }}
                onClick={() => setReturnItemsModalHandover(null)}
              >
                <XCircle size={18} />
              </button>
            </div>

            <div className="handover-modal-body">
              <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                Select items you wish to return early to <strong>{returnItemsModalHandover.originalUserName}</strong> while keeping the rest of the coverage active.
              </p>

              {/* Items List with checkboxes */}
              <div className="items-selection-list">
                {returnItemsModalHandover.items && returnItemsModalHandover.items.length > 0 ? (
                  returnItemsModalHandover.items
                    .filter(item => !item.returnedAt)
                    .map((item: HandoverItemDto) => {
                      const isChecked = selectedItemIds.includes(item.id);
                      return (
                        <div
                          key={item.id}
                          className="item-select-row"
                          onClick={() => {
                            setSelectedItemIds(prev =>
                              isChecked ? prev.filter(id => id !== item.id) : [...prev, item.id]
                            );
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => { }} // handled by row onClick
                            />
                            <div>
                              <div style={{ fontWeight: 600 }}>
                                {item.entityTitle || `${item.entityType} #${item.entityId}`}
                              </div>
                              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                                Type: {item.entityType} | Origin: {item.origin.replace(/_/g, ' ')}
                              </div>
                            </div>
                          </div>
                          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>
                            {item.status || 'Active'}
                          </span>
                        </div>
                      );
                    })
                ) : (
                  <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-secondary)' }}>
                    No items currently under this handover.
                  </div>
                )}
              </div>

              <div className="handover-field-group">
                <label>Early Return Notes (Optional)</label>
                <input
                  type="text"
                  className="handover-input"
                  placeholder="e.g., Client requested original advisor"
                  value={returnNotes}
                  onChange={e => setReturnNotes(e.target.value)}
                />
              </div>
            </div>

            <div className="handover-modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setReturnItemsModalHandover(null)}
                disabled={returningItems}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleReturnSelectedItems}
                disabled={selectedItemIds.length === 0 || returningItems}
              >
                {returningItems ? 'Returning...' : `Return Selected (${selectedItemIds.length})`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
