import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  leaveRequestService,
  LeaveRequestDto,
  LeaveBalanceDto,
  LeaveRequestDetailDto,
  LeaveConflictsDto,
  WorkforceAvailabilityDto
} from '../../services/leaveRequestService';
import {
  CalendarOff,
  Check,
  X,
  Plus,
  Calendar as CalendarIcon,
  Clock,
  AlertCircle,
  AlertTriangle,
  FileText,
  Briefcase,
  Users,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  ArrowRight,
  ShieldAlert,
  ChevronRight,
  HelpCircle,
  ExternalLink,
  History,
  UserCheck,
  RefreshCw,
  Sun,
  Sunset
} from 'lucide-react';
import './LeaveRequestsPage.css';

interface LeaveRequestsPageProps {
  onNavigate?: (route: string, extraState?: any) => void;
}

export const LeaveRequestsPage: React.FC<LeaveRequestsPageProps> = ({ onNavigate }) => {
  const { user, tenant } = useAuth();
  const roleCode = user?.role?.code;
  const isGhlAdmin = (tenant?.slug === 'ghl' || tenant?.id === 't-ghl-01') &&
                     (roleCode === 'company_admin' || roleCode === 'admin' || roleCode === 'super_admin');

  // Main data state
  const [activeTab, setActiveTab] = useState<'Team' | 'Personal'>(isGhlAdmin ? 'Team' : 'Personal');
  const [requests, setRequests] = useState<LeaveRequestDto[]>([]);
  const [myBalances, setMyBalances] = useState<LeaveBalanceDto[]>([]);
  const [workforce, setWorkforce] = useState<WorkforceAvailabilityDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  // Filters (Admin View)
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [typeFilter, setTypeFilter] = useState<string>('All');
  const [roleFilter, setRoleFilter] = useState<string>('All');
  const [handoverFilter, setHandoverFilter] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Toast feedback
  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  // Detail Drawer State
  const [detailDrawerId, setDetailDrawerId] = useState<number | null>(null);
  const [detailData, setDetailData] = useState<LeaveRequestDetailDto | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Request Leave Modal State
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [leaveType, setLeaveType] = useState('Casual');
  const [reqStartDate, setReqStartDate] = useState('');
  const [reqEndDate, setReqEndDate] = useState('');
  const [isHalfDay, setIsHalfDay] = useState(false);
  const [halfDaySession, setHalfDaySession] = useState<'first' | 'second'>('first');
  const [reqReason, setReqReason] = useState('');
  const [submittingRequest, setSubmittingRequest] = useState(false);

  // Approve Modal State
  const [approveModalReq, setApproveModalReq] = useState<LeaveRequestDto | null>(null);
  const [approveNote, setApproveNote] = useState('');
  const [approveConflicts, setApproveConflicts] = useState<LeaveConflictsDto | null>(null);
  const [loadingConflicts, setLoadingConflicts] = useState(false);
  const [approving, setApproving] = useState(false);

  // Reject Modal State
  const [rejectModalReq, setRejectModalReq] = useState<LeaveRequestDto | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejecting, setRejecting] = useState(false);

  // Cancel Confirmation Modal State
  const [cancelModalReq, setCancelModalReq] = useState<LeaveRequestDto | null>(null);
  const [cancelling, setCancelling] = useState(false);

  // Mark Handover Not Needed Modal / Prompt State
  const [notNeededModalReq, setNotNeededModalReq] = useState<LeaveRequestDto | null>(null);
  const [notNeededNote, setNotNeededNote] = useState('');
  const [markingNotNeeded, setMarkingNotNeeded] = useState(false);

  // ── Data Fetching ──────────────────────────────────────────────
  const fetchData = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      setErrorBanner(null);

      if (isGhlAdmin && activeTab === 'Team') {
        const [allReqs, wf] = await Promise.all([
          leaveRequestService.getAllRequests(),
          leaveRequestService.getWorkforceAvailability()
        ]);
        setRequests(allReqs.filter(r => r != null));
        setWorkforce(wf);
      } else {
        const [myReqs, bal] = await Promise.all([
          leaveRequestService.getMyRequests(),
          leaveRequestService.getMyBalance()
        ]);
        setRequests(myReqs.filter(r => r != null));
        setMyBalances(bal);
      }
    } catch (err: any) {
      console.error('Failed to fetch leave data:', err);
      setErrorBanner(err.response?.data?.message || err.message || 'Failed to load leave requests. Please try again.');
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, [isGhlAdmin, activeTab]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Polling every 30s & refetch on window focus
  useEffect(() => {
    const interval = setInterval(() => {
      if (!document.hidden) {
        fetchData(true);
      }
    }, 30000);

    const onFocus = () => fetchData(true);
    window.addEventListener('focus', onFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, [fetchData]);

  // Keyboard navigation: Escape key closes modals and drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (detailDrawerId !== null) setDetailDrawerId(null);
        if (isRequestModalOpen) setIsRequestModalOpen(false);
        if (approveModalReq !== null) setApproveModalReq(null);
        if (rejectModalReq !== null) setRejectModalReq(null);
        if (cancelModalReq !== null) setCancelModalReq(null);
        if (notNeededModalReq !== null) setNotNeededModalReq(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [detailDrawerId, isRequestModalOpen, approveModalReq, rejectModalReq, cancelModalReq, notNeededModalReq]);

  // Fetch drawer detail when drawer is opened
  useEffect(() => {
    if (!detailDrawerId) {
      setDetailData(null);
      return;
    }
    let isMounted = true;
    const fetchDetail = async () => {
      try {
        setLoadingDetail(true);
        const res = await leaveRequestService.getRequestDetail(detailDrawerId);
        if (isMounted) setDetailData(res);
      } catch (err) {
        console.error('Failed to load leave details:', err);
      } finally {
        if (isMounted) setLoadingDetail(false);
      }
    };
    fetchDetail();
    return () => { isMounted = false; };
  }, [detailDrawerId]);

  // Fetch conflict warnings when approve modal opens
  useEffect(() => {
    if (!approveModalReq) {
      setApproveConflicts(null);
      return;
    }
    let isMounted = true;
    const fetchConflicts = async () => {
      try {
        setLoadingConflicts(true);
        const res = await leaveRequestService.getConflicts(approveModalReq.id);
        if (isMounted) setApproveConflicts(res);
      } catch (err) {
        console.error('Failed to load conflict check:', err);
      } finally {
        if (isMounted) setLoadingConflicts(false);
      }
    };
    fetchConflicts();
    return () => { isMounted = false; };
  }, [approveModalReq]);

  // ── Working Days Calculation Helper ────────────────────────────
  const calcWorkingDays = (startStr: string, endStr: string, halfDay: boolean): number => {
    if (!startStr || !endStr) return 0;
    if (halfDay) return 0.5;
    const s = new Date(startStr + 'T00:00:00');
    const e = new Date(endStr + 'T00:00:00');
    if (e < s) return 0;
    let count = 0;
    const cur = new Date(s);
    while (cur <= e) {
      const d = cur.getDay();
      if (d !== 0 && d !== 6) {
        count++;
      }
      cur.setDate(cur.getDate() + 1);
    }
    return count;
  };

  const calculatedDays = useMemo(() => {
    return calcWorkingDays(reqStartDate, reqEndDate, isHalfDay);
  }, [reqStartDate, reqEndDate, isHalfDay]);

  // Balance calculation for the selected type in the request form
  const selectedBalance = useMemo(() => {
    return myBalances.find(b => b.leaveType.toLowerCase() === leaveType.toLowerCase());
  }, [myBalances, leaveType]);

  // ── KPI Metrics for Admin ──────────────────────────────────────
  const kpis = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const nowMonth = new Date().getMonth();
    const nowYear = new Date().getFullYear();

    const pending = requests.filter(r => r.status === 'Pending').length;
    const approvedThisMonth = requests.filter(r => {
      if (r.status !== 'Approved') return false;
      const d = new Date(r.startDate + 'T00:00:00');
      return d.getMonth() === nowMonth && d.getFullYear() === nowYear;
    }).length;

    const onLeaveToday = requests.filter(r => {
      if (r.status !== 'Approved') return false;
      return r.startDate <= today && today <= r.endDate;
    }).length;

    // Needs handover: approved leaves active or starting within 3 days with state 'not_arranged'
    const threeDaysOut = new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0];
    const needsHandover = requests.filter(r => {
      if (r.status !== 'Approved') return false;
      const isNotArranged = r.handoverState === 'not_arranged';
      const isSoonOrActive = r.startDate <= threeDaysOut && today <= r.endDate;
      return isNotArranged && isSoonOrActive;
    }).length;

    return { pending, approvedThisMonth, onLeaveToday, needsHandover };
  }, [requests]);

  // ── Filtering Logic ────────────────────────────────────────────
  const filteredRequests = useMemo(() => {
    return requests.filter(req => {
      if (!req) return false;
      if (statusFilter !== 'All' && (req.status || '').toLowerCase() !== statusFilter.toLowerCase()) {
        return false;
      }
      if (typeFilter !== 'All' && (req.leaveType || '').toLowerCase() !== typeFilter.toLowerCase()) {
        return false;
      }
      if (roleFilter !== 'All') {
        const r = (req.userRole || '').toLowerCase();
        if (roleFilter === 'sales_executive' && !r.includes('sales')) return false;
        if (roleFilter === 'irm' && !r.includes('irm')) return false;
      }
      if (handoverFilter !== 'All') {
        if (handoverFilter === 'needs_handover' && req.handoverState !== 'not_arranged') return false;
        if (handoverFilter === 'covered' && req.handoverState !== 'covered') return false;
        if (handoverFilter === 'returned' && req.handoverState !== 'returned') return false;
        if (handoverFilter === 'not_needed' && req.handoverState !== 'not_needed') return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = (req.userName || '').toLowerCase().includes(q);
        const matchesReason = (req.reason || '').toLowerCase().includes(q);
        if (!matchesName && !matchesReason) return false;
      }
      if (dateFrom && req.endDate < dateFrom) return false;
      if (dateTo && req.startDate > dateTo) return false;

      return true;
    });
  }, [requests, statusFilter, typeFilter, roleFilter, handoverFilter, searchQuery, dateFrom, dateTo]);

  // ── Handlers ───────────────────────────────────────────────────
  const handleSubmitLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reqStartDate || !reqEndDate) {
      showToast('Please select valid start and end dates.', 'error');
      return;
    }
    if (calculatedDays <= 0) {
      showToast('Selected date range contains no working days (Mon-Fri).', 'error');
      return;
    }
    if ((calculatedDays > 3 || leaveType === 'Other') && !reqReason.trim()) {
      showToast('Reason is required for leave exceeding 3 days or type Other.', 'error');
      return;
    }

    try {
      setSubmittingRequest(true);
      await leaveRequestService.createRequest({
        leaveType,
        startDate: reqStartDate,
        endDate: isHalfDay ? reqStartDate : reqEndDate,
        isHalfDay,
        halfDaySession: isHalfDay ? halfDaySession : undefined,
        reason: reqReason.trim()
      });

      showToast('Leave request submitted successfully. Admins have been notified.');
      setIsRequestModalOpen(false);
      setReqStartDate('');
      setReqEndDate('');
      setIsHalfDay(false);
      setReqReason('');
      fetchData();
    } catch (err: any) {
      showToast(err.response?.data?.message || err.message || 'Failed to submit leave request.', 'error');
    } finally {
      setSubmittingRequest(false);
    }
  };

  const handleApproveConfirm = async () => {
    if (!approveModalReq) return;
    try {
      setApproving(true);
      await leaveRequestService.approveRequest(approveModalReq.id, {
        note: approveNote.trim() || undefined
      });
      showToast(`Leave request for ${approveModalReq.userName} approved.`);
      setApproveModalReq(null);
      setApproveNote('');
      fetchData();
      if (detailDrawerId === approveModalReq.id) {
        setDetailDrawerId(approveModalReq.id);
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || err.message || 'Failed to approve request.', 'error');
    } finally {
      setApproving(false);
    }
  };

  const handleRejectConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectModalReq) return;
    if (!rejectReason.trim()) {
      showToast('Rejection reason is mandatory.', 'error');
      return;
    }
    try {
      setRejecting(true);
      await leaveRequestService.rejectRequest(rejectModalReq.id, {
        reason: rejectReason.trim()
      });
      showToast(`Leave request for ${rejectModalReq.userName} rejected.`);
      setRejectModalReq(null);
      setRejectReason('');
      fetchData();
      if (detailDrawerId === rejectModalReq.id) {
        setDetailDrawerId(rejectModalReq.id);
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || err.message || 'Failed to reject request.', 'error');
    } finally {
      setRejecting(false);
    }
  };

  const handleCancelConfirm = async () => {
    if (!cancelModalReq) return;
    try {
      setCancelling(true);
      await leaveRequestService.cancelRequest(cancelModalReq.id);
      showToast('Leave request cancelled.');
      setCancelModalReq(null);
      fetchData();
      if (detailDrawerId === cancelModalReq.id) {
        setDetailDrawerId(cancelModalReq.id);
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || err.message || 'Failed to cancel request.', 'error');
    } finally {
      setCancelling(false);
    }
  };

  const handleMarkNotNeededConfirm = async () => {
    if (!notNeededModalReq) return;
    try {
      setMarkingNotNeeded(true);
      await leaveRequestService.markHandoverNotNeeded(notNeededModalReq.id, {
        note: notNeededNote.trim() || undefined
      });
      showToast('Handover marked as not needed for this leave.');
      setNotNeededModalReq(null);
      setNotNeededNote('');
      fetchData();
      if (detailDrawerId === notNeededModalReq.id) {
        const updated = await leaveRequestService.getRequestDetail(notNeededModalReq.id);
        setDetailData(updated);
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || err.message || 'Failed to mark handover not needed.', 'error');
    } finally {
      setMarkingNotNeeded(false);
    }
  };

  const handleArrangeHandoverShortcut = (req: LeaveRequestDto) => {
    if (!onNavigate) return;
    // Calculate plannedEndAt: endDate + 1 day
    const end = new Date(req.endDate + 'T00:00:00');
    end.setDate(end.getDate() + 1);
    const plannedEndAtStr = end.toISOString().split('T')[0];

    onNavigate('work-handover', {
      fromUserId: req.userId,
      fromUserName: req.userName,
      plannedEndAt: plannedEndAtStr,
      reason: `Leave ${req.startDate} to ${req.endDate} (${req.leaveType})`,
      leaveRequestId: req.id,
      leaveDates: `${req.startDate} to ${req.endDate}`,
      roleCode: req.userRole?.toLowerCase().includes('irm') ? 'irm' : 'sales_executive'
    });
  };

  // ── Render Helpers ─────────────────────────────────────────────
  const renderStatusChip = (status: string, createdAt?: string) => {
    const s = status.toLowerCase();
    let waitingTag = null;
    if (s === 'pending' && createdAt) {
      const waitDays = Math.floor((Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24));
      if (waitDays >= 2) {
        waitingTag = (
          <span className="waiting-tag" title={`Submitted ${waitDays} days ago`}>
            Waiting {waitDays}d
          </span>
        );
      }
    }

    return (
      <div className="status-chip-container">
        <span className={`status-pill ${s}`}>
          {s === 'pending' && <Clock size={12} />}
          {s === 'approved' && <CheckCircle2 size={12} />}
          {s === 'rejected' && <XCircle size={12} />}
          {s === 'cancelled' && <AlertCircle size={12} />}
          {status}
        </span>
        {waitingTag}
      </div>
    );
  };

  const renderHandoverChip = (req: LeaveRequestDto) => {
    if (req.status !== 'Approved') return null;

    switch (req.handoverState) {
      case 'covered':
        return (
          <span className="handover-chip covered" title="Active handover exists">
            <CheckCircle2 size={12} />
            Covered by {req.coveringUserName || 'Peer'}
          </span>
        );
      case 'returned':
        return (
          <span className="handover-chip returned" title="Handover ended and returned">
            <History size={12} />
            Returned
          </span>
        );
      case 'not_needed':
        return (
          <span className="handover-chip not-needed" title="Admin marked handover not needed">
            No handover needed
          </span>
        );
      case 'not_arranged':
      default:
        return (
          <span className="handover-chip not-arranged" title="No handover arranged yet">
            <AlertTriangle size={12} />
            Handover not arranged
          </span>
        );
    }
  };

  return (
    <div className="leave-requests-container">
      {/* Toast Notification */}
      {toast && (
        <div className={`leave-toast ${toast.type}`}>
          {toast.type === 'success' && <CheckCircle2 size={18} />}
          {toast.type === 'error' && <XCircle size={18} />}
          {toast.type === 'info' && <AlertCircle size={18} />}
          <span>{toast.message}</span>
          <button type="button" className="toast-close" onClick={() => setToast(null)}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* Error Banner */}
      {errorBanner && (
        <div className="leave-error-banner">
          <AlertCircle size={18} />
          <span>{errorBanner}</span>
          <button type="button" className="btn btn-secondary btn-xs" onClick={() => fetchData()}>
            <RefreshCw size={12} /> Retry
          </button>
        </div>
      )}

      {/* Page Header */}
      <div className="leave-page-header">
        <div className="header-content">
          <h1>Leave Management</h1>
          <p>Track team absence, availability, and balance quotas effortlessly.</p>
        </div>
        <div className="header-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setIsRequestModalOpen(true)}
          >
            <Plus size={16} />
            Request Leave
          </button>
        </div>
      </div>

      {/* View Tabs (Admin only: Team vs My Requests) */}
      {isGhlAdmin && (
        <div className="main-tabs-row">
          <div className="tabs-group">
            <button
              type="button"
              className={`tab-btn ${activeTab === 'Team' ? 'active' : ''}`}
              onClick={() => setActiveTab('Team')}
            >
              <Users size={16} />
              Team Requests
            </button>
            <button
              type="button"
              className={`tab-btn ${activeTab === 'Personal' ? 'active' : ''}`}
              onClick={() => setActiveTab('Personal')}
            >
              <Briefcase size={16} />
              My Requests
            </button>
          </div>
        </div>
      )}

      {/* ── ADMIN VIEW: TEAM REQUESTS ─────────────────────────────────── */}
      {activeTab === 'Team' && isGhlAdmin && (
        <>
          {/* 4 KPI Cards */}
          <div className="kpi-grid">
            <div
              className={`kpi-card ${statusFilter === 'Pending' ? 'active-filter' : ''}`}
              onClick={() => {
                setStatusFilter(statusFilter === 'Pending' ? 'All' : 'Pending');
                setHandoverFilter('All');
              }}
            >
              <div className="kpi-icon-wrapper pending">
                <Clock size={22} />
              </div>
              <div className="kpi-info">
                <span className="kpi-value">{kpis.pending}</span>
                <span className="kpi-label">Pending Approval</span>
              </div>
            </div>

            <div
              className={`kpi-card ${statusFilter === 'Approved' ? 'active-filter' : ''}`}
              onClick={() => {
                setStatusFilter(statusFilter === 'Approved' ? 'All' : 'Approved');
                setHandoverFilter('All');
              }}
            >
              <div className="kpi-icon-wrapper approved">
                <CheckCircle2 size={22} />
              </div>
              <div className="kpi-info">
                <span className="kpi-value">{kpis.approvedThisMonth}</span>
                <span className="kpi-label">Approved This Month</span>
              </div>
            </div>

            <div
              className="kpi-card"
              onClick={() => {
                const today = new Date().toISOString().split('T')[0];
                setDateFrom(today);
                setDateTo(today);
                setStatusFilter('Approved');
                setHandoverFilter('All');
              }}
            >
              <div className="kpi-icon-wrapper on-leave">
                <CalendarOff size={22} />
              </div>
              <div className="kpi-info">
                <span className="kpi-value">{kpis.onLeaveToday}</span>
                <span className="kpi-label">On Leave Today</span>
              </div>
            </div>

            <div
              className={`kpi-card needs-handover ${handoverFilter === 'needs_handover' ? 'active-filter' : ''}`}
              onClick={() => {
                setHandoverFilter(handoverFilter === 'needs_handover' ? 'All' : 'needs_handover');
                setStatusFilter('Approved');
              }}
            >
              <div className="kpi-icon-wrapper needs-handover">
                <AlertTriangle size={22} />
              </div>
              <div className="kpi-info">
                <span className="kpi-value">{kpis.needsHandover}</span>
                <span className="kpi-label">Needs Handover</span>
              </div>
            </div>
          </div>

          {/* Workforce Availability Strip */}
          {workforce.length > 0 && (
            <div className="workforce-strip-card">
              <div className="strip-title">
                <UserCheck size={16} />
                <span>Workforce Availability Today ({workforce.filter(w => !w.onLeave).length} of {workforce.length} available)</span>
              </div>
              <div className="workforce-avatars-row">
                {workforce.map(w => {
                  const initials = (w.name || 'U').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
                  return (
                    <div
                      key={w.userId}
                      className={`workforce-chip ${w.onLeave ? 'on-leave' : 'available'} ${w.isCovered ? 'covered' : ''}`}
                      title={
                        w.onLeave
                          ? `${w.name} is on leave until ${w.leaveUntil || 'soon'}${w.isCovered ? ` (Covered by ${w.coveredBy})` : ''}`
                          : `${w.name} is available`
                      }
                    >
                      <div className="chip-avatar">{initials}</div>
                      <div className="chip-details">
                        <span className="chip-name">{w.name}</span>
                        <span className="chip-status">
                          {w.onLeave ? `Leave till ${w.leaveUntil || 'soon'}` : 'Available'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Team Filters Toolbar */}
          <div className="controls-bar">
            <div className="filter-pills-row">
              {['All', 'Pending', 'Approved', 'Rejected', 'Cancelled'].map(s => (
                <button
                  key={s}
                  type="button"
                  className={`pill-btn ${statusFilter === s ? 'active' : ''}`}
                  onClick={() => setStatusFilter(s)}
                >
                  {s}
                </button>
              ))}
            </div>

            <div className="filter-dropdowns-row">
              <div className="search-input-wrap">
                <Search size={14} className="search-icon" />
                <input
                  type="text"
                  placeholder="Search employee or reason..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button type="button" className="clear-search" onClick={() => setSearchQuery('')}>
                    <X size={12} />
                  </button>
                )}
              </div>

              <select
                className="select-filter"
                value={typeFilter}
                onChange={e => setTypeFilter(e.target.value)}
              >
                <option value="All">All Types</option>
                <option value="Casual">Casual</option>
                <option value="Sick">Sick</option>
                <option value="Earned">Earned</option>
                <option value="Unpaid">Unpaid</option>
                <option value="Other">Other</option>
              </select>

              <select
                className="select-filter"
                value={roleFilter}
                onChange={e => setRoleFilter(e.target.value)}
              >
                <option value="All">All Roles</option>
                <option value="sales_executive">Sales Executive</option>
                <option value="irm">IRM</option>
              </select>

              <select
                className="select-filter"
                value={handoverFilter}
                onChange={e => setHandoverFilter(e.target.value)}
              >
                <option value="All">All Handover States</option>
                <option value="needs_handover">Needs Handover</option>
                <option value="covered">Covered</option>
                <option value="returned">Returned</option>
                <option value="not_needed">Not Needed</option>
              </select>

              {(statusFilter !== 'All' || typeFilter !== 'All' || roleFilter !== 'All' || handoverFilter !== 'All' || searchQuery || dateFrom || dateTo) && (
                <button
                  type="button"
                  className="btn btn-ghost btn-xs clear-all-filters"
                  onClick={() => {
                    setStatusFilter('All');
                    setTypeFilter('All');
                    setRoleFilter('All');
                    setHandoverFilter('All');
                    setSearchQuery('');
                    setDateFrom('');
                    setDateTo('');
                  }}
                >
                  Reset
                </button>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── EMPLOYEE VIEW: MY REQUESTS ───────────────────────────────── */}
      {activeTab === 'Personal' && (
        <>
          {/* Balance Cards */}
          <div className="balance-grid">
            {myBalances.map(bal => (
              <div key={bal.leaveType} className="balance-card">
                <div className="balance-header">
                  <span className="balance-title">{bal.leaveType} Leave</span>
                  {bal.pending > 0 && (
                    <span className="pending-pill">{bal.pending} pending</span>
                  )}
                </div>
                <div className="balance-numbers">
                  <div className="remaining-number">{bal.remaining}</div>
                  <div className="quota-fraction">of {bal.quota} days left</div>
                </div>
                <div className="balance-progress-track">
                  <div
                    className="balance-progress-fill"
                    style={{
                      width: `${Math.min(100, Math.max(0, (bal.used / (bal.quota || 1)) * 100))}%`
                    }}
                  />
                </div>
                <div className="balance-footer">
                  <span>Used: {bal.used}d</span>
                  <span>Quota: {bal.quota}d</span>
                </div>
              </div>
            ))}
          </div>

          {/* Upcoming Leave Strip for Employee */}
          {requests.some(r => r.status === 'Approved' && r.endDate >= new Date().toISOString().split('T')[0]) && (
            <div className="upcoming-leave-card">
              <div className="upcoming-header">
                <CalendarIcon size={16} />
                <span>Your Upcoming Approved Leaves</span>
              </div>
              <div className="upcoming-items-list">
                {requests
                  .filter(r => r.status === 'Approved' && r.endDate >= new Date().toISOString().split('T')[0])
                  .map(r => (
                    <div key={r.id} className="upcoming-item">
                      <div className="upcoming-badge">{r.leaveType}</div>
                      <div className="upcoming-dates">
                        {r.startDate} to {r.endDate} ({r.days} {r.days === 1 ? 'day' : 'days'})
                      </div>
                      <div className="upcoming-handover">{renderHandoverChip(r)}</div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Status Filter for Personal Requests */}
          <div className="controls-bar">
            <div className="filter-pills-row">
              {['All', 'Pending', 'Approved', 'Rejected', 'Cancelled'].map(s => (
                <button
                  key={s}
                  type="button"
                  className={`pill-btn ${statusFilter === s ? 'active' : ''}`}
                  onClick={() => setStatusFilter(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ── MAIN TABLE ────────────────────────────────────────────────── */}
      <div className="content-area">
        {loading ? (
          <div className="table-skeleton-container">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="skeleton-row" />
            ))}
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="beautiful-empty-state">
            <div className="empty-icon-circle">
              <CalendarOff size={36} />
            </div>
            <h3>No Leave Requests Found</h3>
            <p>
              {statusFilter !== 'All' || typeFilter !== 'All' || searchQuery
                ? 'No records match your active filters. Try adjusting your search criteria.'
                : 'No leave requests have been filed yet. Click "Request Leave" to create one.'}
            </p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="premium-table">
              <thead>
                <tr>
                  {activeTab === 'Team' && <th>Employee</th>}
                  <th>Type</th>
                  <th>Dates & Working Days</th>
                  <th>Reason</th>
                  <th>Status</th>
                  {activeTab === 'Team' && <th>Handover State</th>}
                  <th>Applied On</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRequests.map(req => {
                  const initials = (req.userName || 'U').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
                  const canCancel =
                    req.status === 'Pending' ||
                    (req.status === 'Approved' && req.endDate >= new Date().toISOString().split('T')[0]);

                  return (
                    <tr
                      key={req.id}
                      className="table-row-clickable"
                      onClick={() => setDetailDrawerId(req.id)}
                    >
                      {activeTab === 'Team' && (
                        <td>
                          <div className="user-cell">
                            <div className="avatar-circle">{initials}</div>
                            <div className="user-info">
                              <span className="user-name">{req.userName}</span>
                              <span className="user-role">{req.userRole || 'Team Member'}</span>
                            </div>
                          </div>
                        </td>
                      )}
                      <td>
                        <span className={`leave-type-badge ${req.leaveType.toLowerCase()}`}>
                          {req.leaveType}
                        </span>
                      </td>
                      <td>
                        <div className="date-cell">
                          <span className="date-range">
                            {req.startDate} {req.startDate !== req.endDate ? `to ${req.endDate}` : ''}
                          </span>
                          <span className="duration-tag">
                            {req.days} {req.days === 1 ? 'day' : 'days'}
                            {req.isHalfDay && (
                              <span className="half-day-tag">
                                {req.halfDaySession === 'second' ? '2nd Half' : '1st Half'}
                              </span>
                            )}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div className="reason-cell" title={req.reason}>
                          {req.reason || <span className="empty-val">—</span>}
                        </div>
                      </td>
                      <td>{renderStatusChip(req.status, req.createdAt)}</td>
                      {activeTab === 'Team' && <td>{renderHandoverChip(req)}</td>}
                      <td>
                        <span className="applied-date">
                          {new Date(req.createdAt).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                        <div className="row-actions">
                          {/* Admin Actions */}
                          {isGhlAdmin && activeTab === 'Team' && req.status === 'Pending' && (
                            <>
                              <button
                                type="button"
                                className="icon-btn approve"
                                title="Approve Request"
                                onClick={() => setApproveModalReq(req)}
                              >
                                <Check size={16} />
                              </button>
                              <button
                                type="button"
                                className="icon-btn reject"
                                title="Reject Request"
                                onClick={() => {
                                  setRejectModalReq(req);
                                  setRejectReason('');
                                }}
                              >
                                <X size={16} />
                              </button>
                            </>
                          )}

                          {/* Employee Cancel Action */}
                          {activeTab === 'Personal' && canCancel && (
                            <button
                              type="button"
                              className="btn btn-secondary btn-xs"
                              title="Cancel Request"
                              onClick={() => setCancelModalReq(req)}
                            >
                              Cancel
                            </button>
                          )}

                          <button
                            type="button"
                            className="icon-btn view"
                            title="View Details & Timeline"
                            onClick={() => setDetailDrawerId(req.id)}
                          >
                            <ChevronRight size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── REQUEST LEAVE MODAL ───────────────────────────────────────── */}
      {isRequestModalOpen && (
        <div className="modal-overlay" onClick={() => setIsRequestModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Request Time Off</h2>
              <button
                type="button"
                className="btn btn-ghost btn-icon"
                onClick={() => setIsRequestModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmitLeave}>
              <div className="modal-body">
                {/* Leave Type */}
                <div className="form-group">
                  <label>Leave Type *</label>
                  <select
                    className="form-control"
                    value={leaveType}
                    onChange={e => setLeaveType(e.target.value)}
                    required
                  >
                    <option value="Casual">Casual Leave</option>
                    <option value="Sick">Sick Leave</option>
                    <option value="Earned">Earned / Annual Leave</option>
                    <option value="Unpaid">Unpaid Leave</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                {/* Half Day Toggle */}
                <div className="form-group-checkbox">
                  <label className="checkbox-container">
                    <input
                      type="checkbox"
                      checked={isHalfDay}
                      onChange={e => {
                        const val = e.target.checked;
                        setIsHalfDay(val);
                        if (val && reqStartDate) {
                          setReqEndDate(reqStartDate);
                        }
                      }}
                    />
                    <span>Half-Day Leave (0.5 Working Day)</span>
                  </label>
                </div>

                {/* Half Day Session Picker */}
                {isHalfDay && (
                  <div className="form-group half-day-options">
                    <label>Session *</label>
                    <div className="radio-pill-group">
                      <label className={`radio-pill ${halfDaySession === 'first' ? 'selected' : ''}`}>
                        <input
                          type="radio"
                          name="halfDaySession"
                          value="first"
                          checked={halfDaySession === 'first'}
                          onChange={() => setHalfDaySession('first')}
                        />
                        <Sun size={14} />
                        First Half (Morning)
                      </label>
                      <label className={`radio-pill ${halfDaySession === 'second' ? 'selected' : ''}`}>
                        <input
                          type="radio"
                          name="halfDaySession"
                          value="second"
                          checked={halfDaySession === 'second'}
                          onChange={() => setHalfDaySession('second')}
                        />
                        <Sunset size={14} />
                        Second Half (Afternoon)
                      </label>
                    </div>
                  </div>
                )}

                {/* Date Inputs */}
                <div className="date-inputs-row">
                  <div className="form-group">
                    <label>Start Date *</label>
                    <input
                      type="date"
                      className="form-control"
                      value={reqStartDate}
                      min={new Date().toISOString().split('T')[0]}
                      onChange={e => {
                        setReqStartDate(e.target.value);
                        if (isHalfDay || !reqEndDate || reqEndDate < e.target.value) {
                          setReqEndDate(e.target.value);
                        }
                      }}
                      required
                    />
                  </div>

                  {!isHalfDay && (
                    <div className="form-group">
                      <label>End Date *</label>
                      <input
                        type="date"
                        className="form-control"
                        value={reqEndDate}
                        min={reqStartDate || new Date().toISOString().split('T')[0]}
                        onChange={e => setReqEndDate(e.target.value)}
                        required
                      />
                    </div>
                  )}
                </div>

                {/* Live Working Days & Balance Banner */}
                {reqStartDate && (
                  <div className="live-days-summary">
                    <div className="summary-row">
                      <Clock size={16} color="var(--brand-primary, #6366f1)" />
                      <span>
                        Calculated duration: <strong>{calculatedDays} working {calculatedDays === 1 ? 'day' : 'days'}</strong> (Mon–Fri)
                      </span>
                    </div>

                    {selectedBalance && (
                      <div className="balance-info-note">
                        You have <strong>{selectedBalance.remaining}</strong> {leaveType} days remaining.
                        {calculatedDays > selectedBalance.remaining && (
                          <span className="balance-warn">
                            {' '}(This request uses {calculatedDays} days, exceeding remaining quota by {calculatedDays - selectedBalance.remaining} days)
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Reason */}
                <div className="form-group">
                  <label>
                    Reason {(calculatedDays > 3 || leaveType === 'Other') ? '*' : '(Optional)'}
                  </label>
                  <textarea
                    className="form-control font-inherit"
                    placeholder="Provide context for your manager (e.g. Family function, doctor visit)..."
                    value={reqReason}
                    maxLength={500}
                    onChange={e => setReqReason(e.target.value)}
                    required={calculatedDays > 3 || leaveType === 'Other'}
                  />
                  <div className="char-count">{reqReason.length} / 500</div>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsRequestModalOpen(false)}
                  disabled={submittingRequest}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submittingRequest || calculatedDays <= 0 || ((calculatedDays > 3 || leaveType === 'Other') && !reqReason.trim())}
                >
                  {submittingRequest ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── APPROVE MODAL (NO COVERING USER DROP DOWN!) ─────────────── */}
      {approveModalReq && (
        <div className="modal-overlay" onClick={() => setApproveModalReq(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Approve Leave Request</h2>
              <button
                type="button"
                className="btn btn-ghost btn-icon"
                onClick={() => setApproveModalReq(null)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              <p className="approve-desc">
                Are you sure you want to approve <strong>{approveModalReq.userName}</strong>'s request for{' '}
                <strong>{approveModalReq.days} {approveModalReq.days === 1 ? 'day' : 'days'}</strong> of{' '}
                <strong>{approveModalReq.leaveType} Leave</strong> ({approveModalReq.startDate} to {approveModalReq.endDate})?
              </p>

              {/* Conflict Warnings */}
              {loadingConflicts && (
                <div className="conflict-loading">
                  <RefreshCw size={14} className="spin" /> Checking team absence conflicts...
                </div>
              )}

              {approveConflicts && (approveConflicts.conflicts.length > 0 || approveConflicts.isHighAbsenceRate) && (
                <div className={`conflict-banner ${approveConflicts.isHighAbsenceRate ? 'high-risk' : 'warning'}`}>
                  <AlertTriangle size={18} />
                  <div>
                    <strong>
                      {approveConflicts.isHighAbsenceRate
                        ? `High Absence Risk (${approveConflicts.percentageAway}% of team away)`
                        : 'Overlapping Leave Notice'}
                    </strong>
                    {approveConflicts.conflicts.length > 0 && (
                      <>
                        <p>
                          Teammate(s) of the same role are also away during these dates:
                        </p>
                        <ul className="conflict-list">
                          {approveConflicts.conflicts.map((ol, idx) => (
                            <li key={idx}>
                              {ol.userName}: {ol.startDate} to {ol.endDate} ({ol.status})
                            </li>
                          ))}
                        </ul>
                      </>
                    )}
                  </div>
                </div>
              )}

              <div className="form-group" style={{ marginTop: 16 }}>
                <label>Approval Note (Optional)</label>
                <input
                  type="text"
                  className="form-control font-inherit"
                  placeholder="e.g., Approved, enjoy your break!"
                  value={approveNote}
                  maxLength={500}
                  onChange={e => setApproveNote(e.target.value)}
                />
              </div>

              <div className="approve-notice">
                <AlertCircle size={14} />
                <span>
                  Approving only updates leave status. It does <strong>not</strong> move any records or start a handover.
                </span>
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setApproveModalReq(null)}
                disabled={approving}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleApproveConfirm}
                disabled={approving}
              >
                {approving ? 'Approving...' : 'Confirm Approval'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── REJECT MODAL (MANDATORY REASON) ─────────────────────────── */}
      {rejectModalReq && (
        <div className="modal-overlay" onClick={() => setRejectModalReq(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Reject Leave Request</h2>
              <button
                type="button"
                className="btn btn-ghost btn-icon"
                onClick={() => setRejectModalReq(null)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleRejectConfirm}>
              <div className="modal-body">
                <p className="reject-desc">
                  Rejecting leave request for <strong>{rejectModalReq.userName}</strong> ({rejectModalReq.startDate} to {rejectModalReq.endDate}).
                </p>

                <div className="form-group">
                  <label>Reason for Rejection *</label>
                  <textarea
                    className="form-control font-inherit"
                    placeholder="Explain why this request is being rejected (required)..."
                    value={rejectReason}
                    maxLength={500}
                    onChange={e => setRejectReason(e.target.value)}
                    required
                  />
                  <div className="char-count">{rejectReason.length} / 500</div>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setRejectModalReq(null)}
                  disabled={rejecting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-danger"
                  disabled={rejecting || !rejectReason.trim()}
                >
                  {rejecting ? 'Rejecting...' : 'Reject Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── CANCEL REQUEST CONFIRMATION MODAL ───────────────────────── */}
      {cancelModalReq && (
        <div className="modal-overlay" onClick={() => setCancelModalReq(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Cancel Leave Request</h2>
              <button
                type="button"
                className="btn btn-ghost btn-icon"
                onClick={() => setCancelModalReq(null)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              <p>
                Are you sure you want to cancel this leave request for{' '}
                <strong>{cancelModalReq.startDate} to {cancelModalReq.endDate}</strong>?
              </p>
              {cancelModalReq.status === 'Approved' && (
                <div className="approve-notice" style={{ marginTop: 12 }}>
                  <AlertCircle size={14} />
                  <span>
                    Cancelling an approved leave restores your leave quota. Note that any active work handover is not affected and must be managed from Work Handover.
                  </span>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setCancelModalReq(null)}
                disabled={cancelling}
              >
                Keep Request
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleCancelConfirm}
                disabled={cancelling}
              >
                {cancelling ? 'Cancelling...' : 'Confirm Cancellation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MARK HANDOVER NOT NEEDED MODAL ──────────────────────────── */}
      {notNeededModalReq && (
        <div className="modal-overlay" onClick={() => setNotNeededModalReq(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Mark Handover Not Needed</h2>
              <button
                type="button"
                className="btn btn-ghost btn-icon"
                onClick={() => setNotNeededModalReq(null)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              <p>
                Mark that <strong>{notNeededModalReq.userName}</strong> does not require coverage for this{' '}
                <strong>{notNeededModalReq.days}-day</strong> leave. Handover reminder notifications will stop for this request.
              </p>

              <div className="form-group" style={{ marginTop: 16 }}>
                <label>Note (Optional)</label>
                <input
                  type="text"
                  className="form-control font-inherit"
                  placeholder="e.g., Single-day leave, no urgent leads pending"
                  value={notNeededNote}
                  maxLength={500}
                  onChange={e => setNotNeededNote(e.target.value)}
                />
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setNotNeededModalReq(null)}
                disabled={markingNotNeeded}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleMarkNotNeededConfirm}
                disabled={markingNotNeeded}
              >
                {markingNotNeeded ? 'Saving...' : 'Confirm Not Needed'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── DETAIL DRAWER (RIGHT SIDE SLIDE-OUT) ────────────────────── */}
      {detailDrawerId !== null && (
        <div className="drawer-overlay" onClick={() => setDetailDrawerId(null)}>
          <div className="drawer-container" onClick={e => e.stopPropagation()}>
            <div className="drawer-header">
              <div className="drawer-header-info">
                <h3>Leave Request Details</h3>
                <span className="drawer-sub">ID #{detailDrawerId}</span>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-icon"
                onClick={() => setDetailDrawerId(null)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="drawer-body">
              {loadingDetail || !detailData ? (
                <div className="drawer-loading">
                  <RefreshCw size={20} className="spin" />
                  <span>Loading details...</span>
                </div>
              ) : (
                <>
                  {/* Cancelled leave with active handover banner (Spec §4.6) */}
                  {detailData.request.status === 'Cancelled' && detailData.activeHandover && (
                    <div className="drawer-alert-banner">
                      <AlertTriangle size={18} />
                      <div>
                        <strong>Active Handover Alert</strong>
                        <p>
                          {detailData.request.userName} cancelled their leave, but a work handover is currently active with{' '}
                          {detailData.activeHandover.coveringUserName}. Review it in Work Handover.
                        </p>
                        <button
                          type="button"
                          className="btn btn-secondary btn-xs"
                          onClick={() => {
                            if (onNavigate) onNavigate('work-handover');
                            setDetailDrawerId(null);
                          }}
                        >
                          Open Work Handover <ExternalLink size={12} />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Requester Profile */}
                  <div className="drawer-profile-box">
                    <div className="avatar-large">
                      {(detailData.request.userName || 'U').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <div className="profile-details">
                      <h4>{detailData.request.userName}</h4>
                      <span className="profile-role">{detailData.request.userRole}</span>
                    </div>
                    <div className="profile-status">
                      {renderStatusChip(detailData.request.status)}
                    </div>
                  </div>

                  {/* Details Grid */}
                  <div className="drawer-section">
                    <div className="section-title">Leave Information</div>
                    <div className="details-grid">
                      <div className="detail-item">
                        <span className="label">Leave Type</span>
                        <span className="val">{detailData.request.leaveType}</span>
                      </div>
                      <div className="detail-item">
                        <span className="label">Duration</span>
                        <span className="val">
                          {detailData.request.days} {detailData.request.days === 1 ? 'working day' : 'working days'}
                          {detailData.request.isHalfDay && ' (Half-Day)'}
                        </span>
                      </div>
                      <div className="detail-item">
                        <span className="label">Start Date</span>
                        <span className="val">{detailData.request.startDate}</span>
                      </div>
                      <div className="detail-item">
                        <span className="label">End Date</span>
                        <span className="val">{detailData.request.endDate}</span>
                      </div>
                      <div className="detail-item full-width">
                        <span className="label">Reason</span>
                        <span className="val reason-text">{detailData.request.reason || 'None provided'}</span>
                      </div>
                      {detailData.request.decisionNote && (
                        <div className="detail-item full-width">
                          <span className="label">Decision Note</span>
                          <span className="val note-text">{detailData.request.decisionNote}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Handover Section (Spec §5.1) */}
                  {detailData.request.status === 'Approved' && (
                    <div className="drawer-section">
                      <div className="section-title">Work Handover Status</div>
                      <div className="handover-action-card">
                        {detailData.request.handoverState === 'not_arranged' && (
                          <div className="not-arranged-box">
                            <div className="desc">
                              <AlertTriangle size={16} color="#f59e0b" />
                              <span>No work handover is arranged for this leave period yet.</span>
                            </div>
                            {isGhlAdmin && (
                              <div className="handover-buttons-row">
                                <button
                                  type="button"
                                  className="btn btn-primary btn-sm"
                                  onClick={() => handleArrangeHandoverShortcut(detailData.request)}
                                >
                                  Arrange Handover <ArrowRight size={14} />
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-sm"
                                  onClick={() => setNotNeededModalReq(detailData.request)}
                                >
                                  No Handover Needed
                                </button>
                              </div>
                            )}
                          </div>
                        )}

                        {detailData.request.handoverState === 'covered' && (
                          <div className="covered-box">
                            <CheckCircle2 size={16} color="#10b981" />
                            <span>
                              Covered by <strong>{detailData.request.coveringUserName}</strong>
                              {detailData.activeHandover?.startedAt && (
                                <> since {new Date(detailData.activeHandover.startedAt).toLocaleDateString()}</>
                              )}
                            </span>
                            <button
                              type="button"
                              className="btn btn-ghost btn-xs"
                              onClick={() => {
                                if (onNavigate) onNavigate('work-handover');
                                setDetailDrawerId(null);
                              }}
                            >
                              View Handover <ExternalLink size={12} />
                            </button>
                          </div>
                        )}

                        {detailData.request.handoverState === 'returned' && (
                          <div className="returned-box">
                            <History size={16} color="#64748b" />
                            <span>Coverage completed and all items returned.</span>
                            <button
                              type="button"
                              className="btn btn-ghost btn-xs"
                              onClick={() => {
                                if (onNavigate) onNavigate('work-handover');
                                setDetailDrawerId(null);
                              }}
                            >
                              View Handover <ExternalLink size={12} />
                            </button>
                          </div>
                        )}

                        {detailData.request.handoverState === 'not_needed' && (
                          <div className="not-needed-box">
                            <Check size={16} color="#94a3b8" />
                            <span>Admin marked handover as not needed for this leave.</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Requester Quotas */}
                  {detailData.userBalances && detailData.userBalances.length > 0 && (
                    <div className="drawer-section">
                      <div className="section-title">Leave Quota Balances</div>
                      <div className="drawer-balances-list">
                        {detailData.userBalances.map(b => (
                          <div key={b.leaveType} className="drawer-balance-row">
                            <span className="type">{b.leaveType}</span>
                            <span className="numbers">
                              {b.remaining} days left ({b.used} / {b.quota} used)
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Audit Timeline */}
                  <div className="drawer-section">
                    <div className="section-title">Activity Timeline</div>
                    <div className="timeline-container">
                      {detailData.events.length === 0 ? (
                        <div className="timeline-empty">No events recorded.</div>
                      ) : (
                        detailData.events.map((evt, idx) => (
                          <div key={evt.id || idx} className="timeline-item">
                            <div className={`timeline-dot ${evt.action}`} />
                            <div className="timeline-content">
                              <div className="timeline-action-row">
                                <span className="action-name">{formatEventAction(evt.action)}</span>
                                <span className="action-date">
                                  {new Date(evt.at).toLocaleString('en-IN', {
                                    day: 'numeric',
                                    month: 'short',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </span>
                              </div>
                              <div className="action-actor">
                                By {evt.actorName}{evt.actorRole ? ` (${evt.actorRole})` : ''}
                              </div>
                              {evt.note && <div className="action-note">"{evt.note}"</div>}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Helper for readable event names
function formatEventAction(action: string): string {
  switch (action) {
    case 'submitted': return 'Request Submitted';
    case 'approved': return 'Leave Approved';
    case 'rejected': return 'Leave Rejected';
    case 'cancelled': return 'Leave Cancelled';
    case 'edited': return 'Request Edited';
    case 'handover_linked': return 'Handover Linked';
    case 'handover_not_needed': return 'Handover Marked Not Needed';
    default: return action;
  }
}
