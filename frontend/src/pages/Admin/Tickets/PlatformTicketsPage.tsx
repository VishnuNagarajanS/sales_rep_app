import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Ticket,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Search,
  Plus,
  RefreshCw,
  Building2,
  User,
  ShieldAlert,
  MessageSquare,
  Send,
  X,
  Trash2,
  AlertCircle,
  RotateCcw,
} from 'lucide-react';
import { PlatformTicket, Tenant } from '../../../types';
import { superAdminService } from '../../../services/superAdminService';
import { Modal } from '../../../components/common/Modal';
import './PlatformTicketsPage.css';

type StatusFilter = 'all' | 'open' | 'in_progress' | 'escalated' | 'resolved' | 'closed';

interface TicketMetrics {
  total: number;
  critical: number;
  inProgress: number;
  resolved: number;
  open: number;
  statusCounts: Record<string, number>;
  priorityCounts: Record<string, number>;
}

export const PlatformTicketsPage: React.FC = () => {
  const [tickets, setTickets] = useState<PlatformTicket[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [metrics, setMetrics] = useState<TicketMetrics>({
    total: 0,
    critical: 0,
    inProgress: 0,
    resolved: 0,
    open: 0,
    statusCounts: { open: 0, in_progress: 0, escalated: 0, resolved: 0, closed: 0 },
    priorityCounts: { critical: 0, high: 0, medium: 0, low: 0 },
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState('');

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [tenantFilter, setTenantFilter] = useState('all');

  // Selected Ticket for Workbench / Drawer Modal
  const [selectedTicket, setSelectedTicket] = useState<PlatformTicket | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [newNoteMessage, setNewNoteMessage] = useState('');
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isUpdatingPriority, setIsUpdatingPriority] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [resolutionInput, setResolutionInput] = useState('');
  const [assigneeInput, setAssigneeInput] = useState('');

  // Log Incident Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [formTitle, setFormTitle] = useState('');
  const [formCategory, setFormCategory] = useState('Telephony / Carrier Trunk');
  const [formPriority, setFormPriority] = useState<'low' | 'medium' | 'high' | 'critical'>('high');
  const [formTenantId, setFormTenantId] = useState<string>('all');
  const [formDescription, setFormDescription] = useState('');
  const [formReporterEmail, setFormReporterEmail] = useState('noc@nexussales.internal');
  const [formAssignedTo, setFormAssignedTo] = useState('Platform Operations');

  const requestIdRef = useRef(0);

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 4500);
  };

  // Debounce search input to avoid spamming the backend
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery.trim());
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Load metrics from real database records
  const loadMetrics = async () => {
    try {
      const data = await superAdminService.fetchPlatformTicketMetricsApi();
      setMetrics({
        total: data.total ?? 0,
        critical: data.critical ?? 0,
        inProgress: data.inProgress ?? 0,
        resolved: data.resolved ?? 0,
        open: data.open ?? 0,
        statusCounts: data.statusCounts ?? {},
        priorityCounts: data.priorityCounts ?? {},
      });
    } catch (err: any) {
      console.error('Failed to load ticket telemetry metrics:', err);
    }
  };

  // Load ticket records from backend with real server-side filters and search
  const loadData = useCallback(async (isManual = false) => {
    const currentRequestId = ++requestIdRef.current;
    if (isManual) setIsRefreshing(true);
    else setIsLoading(true);
    setErrorMessage(null);

    try {
      const [ticketList, tenantList, metricsData] = await Promise.all([
        superAdminService.fetchPlatformTicketsApi({
          status: statusFilter !== 'all' ? statusFilter : undefined,
          priority: priorityFilter !== 'all' ? priorityFilter : undefined,
          category: categoryFilter !== 'all' ? categoryFilter : undefined,
          tenantId: tenantFilter !== 'all' ? tenantFilter : undefined,
          search: debouncedSearch || undefined,
        }),
        superAdminService.fetchTenantsFromApi().catch(() => []),
        superAdminService.fetchPlatformTicketMetricsApi().catch(() => null),
      ]);

      if (currentRequestId === requestIdRef.current) {
        setTickets(ticketList || []);
        if (tenantList && tenantList.length > 0) {
          setTenants(tenantList);
        }
        if (metricsData) {
          setMetrics({
            total: metricsData.total ?? 0,
            critical: metricsData.critical ?? 0,
            inProgress: metricsData.inProgress ?? 0,
            resolved: metricsData.resolved ?? 0,
            open: metricsData.open ?? 0,
            statusCounts: metricsData.statusCounts ?? {},
            priorityCounts: metricsData.priorityCounts ?? {},
          });
        }
        if (isManual) {
          showSuccess('Incident tickets and operational telemetry refreshed from database.');
        }
      }
    } catch (err: any) {
      if (currentRequestId === requestIdRef.current) {
        console.error('Failed to load tickets from backend:', err);
        setErrorMessage(err.message || 'Failed to fetch tickets from server. Check network connection.');
      }
    } finally {
      if (currentRequestId === requestIdRef.current) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  }, [statusFilter, priorityFilter, categoryFilter, tenantFilter, debouncedSearch]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // KPI card click handlers
  const handleKpiCardClick = (type: 'total' | 'critical' | 'inProgress' | 'resolved') => {
    if (type === 'total') {
      setStatusFilter('all');
      setPriorityFilter('all');
      setCategoryFilter('all');
      setTenantFilter('all');
    } else if (type === 'critical') {
      setPriorityFilter(prev => (prev === 'critical_high' ? 'all' : 'critical_high'));
    } else if (type === 'inProgress') {
      setStatusFilter(prev => (prev === 'in_progress' ? 'all' : 'in_progress'));
    } else if (type === 'resolved') {
      setStatusFilter(prev => (prev === 'resolved' ? 'all' : 'resolved'));
    }
  };

  // Check if any filter is active
  const hasActiveFilters =
    statusFilter !== 'all' ||
    priorityFilter !== 'all' ||
    categoryFilter !== 'all' ||
    tenantFilter !== 'all' ||
    searchQuery.trim().length > 0;

  const handleClearFilters = () => {
    setStatusFilter('all');
    setPriorityFilter('all');
    setCategoryFilter('all');
    setTenantFilter('all');
    setSearchQuery('');
  };

  // Workbench Handlers
  const handleOpenDetail = (ticket: PlatformTicket) => {
    setSelectedTicket(ticket);
    setResolutionInput(ticket.resolutionNotes || '');
    setAssigneeInput(ticket.assignedToName || 'Platform Operations');
    setIsDetailModalOpen(true);
  };

  const handleStatusChange = async (nextStatus: 'open' | 'in_progress' | 'escalated' | 'resolved' | 'closed') => {
    if (!selectedTicket) return;
    setIsUpdatingStatus(true);
    try {
      const isReopen = (selectedTicket.status === 'resolved' || selectedTicket.status === 'closed') &&
        (nextStatus === 'open' || nextStatus === 'in_progress');
      const noteMsg = isReopen
        ? 'Reopened by Super Admin Operations Team for re-investigation'
        : `Status transitioned to ${nextStatus.toUpperCase()}`;

      const updated = await superAdminService.updateTicketStatusApi(
        selectedTicket.id,
        nextStatus,
        noteMsg,
        nextStatus === 'resolved' || nextStatus === 'closed'
          ? resolutionInput.trim() || 'Resolved by Super Admin Operations Team'
          : undefined
      );

      setSelectedTicket(updated);
      setTickets(prev => prev.map(t => (t.id === updated.id ? updated : t)));
      loadMetrics();
      showSuccess(`Ticket ${updated.ticketNumber} marked as ${nextStatus.toUpperCase()}.`);
    } catch (err: any) {
      alert(err.message || 'Failed to update ticket status');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handlePriorityChange = async (nextPriority: string) => {
    if (!selectedTicket) return;
    setIsUpdatingPriority(true);
    try {
      const updated = await superAdminService.updateTicketPriorityApi(
        selectedTicket.id,
        nextPriority,
        `Priority adjusted to ${nextPriority.toUpperCase()}`
      );
      setSelectedTicket(updated);
      setTickets(prev => prev.map(t => (t.id === updated.id ? updated : t)));
      loadMetrics();
      showSuccess(`Priority for ${updated.ticketNumber} set to ${nextPriority.toUpperCase()}.`);
    } catch (err: any) {
      alert(err.message || 'Failed to update priority');
    } finally {
      setIsUpdatingPriority(false);
    }
  };

  const handleAssigneeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !assigneeInput.trim()) return;
    setIsAssigning(true);
    try {
      const updated = await superAdminService.assignPlatformTicketApi(
        selectedTicket.id,
        assigneeInput.trim(),
        undefined,
        `Ticket assigned to ${assigneeInput.trim()}`
      );
      setSelectedTicket(updated);
      setTickets(prev => prev.map(t => (t.id === updated.id ? updated : t)));
      showSuccess(`Ticket ${updated.ticketNumber} reassigned to ${updated.assignedToName}.`);
    } catch (err: any) {
      alert(err.message || 'Failed to reassign ticket');
    } finally {
      setIsAssigning(false);
    }
  };

  const handleAddTimelineNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !newNoteMessage.trim()) return;
    setIsAddingNote(true);
    try {
      const updated = await superAdminService.addTicketNoteApi(selectedTicket.id, newNoteMessage.trim());
      setSelectedTicket(updated);
      setTickets(prev => prev.map(t => (t.id === updated.id ? updated : t)));
      setNewNoteMessage('');
      showSuccess('Diagnostic note appended to investigation timeline.');
    } catch (err: any) {
      alert(err.message || 'Failed to append note');
    } finally {
      setIsAddingNote(false);
    }
  };

  const handleDeleteTicket = async () => {
    if (!selectedTicket) return;
    const confirmDelete = window.confirm(
      `Are you sure you want to permanently delete ticket ${selectedTicket.ticketNumber} ("${selectedTicket.title}")? This action will remove all recorded timeline logs from the database.`
    );
    if (!confirmDelete) return;

    setIsDeleting(true);
    try {
      await superAdminService.deletePlatformTicketApi(selectedTicket.id);
      setTickets(prev => prev.filter(t => t.id !== selectedTicket.id));
      setIsDetailModalOpen(false);
      setSelectedTicket(null);
      loadMetrics();
      showSuccess(`Ticket ${selectedTicket.ticketNumber} successfully removed.`);
    } catch (err: any) {
      alert(err.message || 'Failed to delete ticket');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCreateTicketSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formDescription.trim()) return;

    setIsCreating(true);
    try {
      const tenantMatch = formTenantId !== 'all' ? tenants.find(t => String(t.id) === formTenantId) : null;
      const created = await superAdminService.createPlatformTicketApi({
        title: formTitle.trim(),
        description: formDescription.trim(),
        category: formCategory,
        priority: formPriority,
        tenantId: tenantMatch ? Number(tenantMatch.id) : undefined,
        reportedByName: 'NOC Super Admin',
        reportedByEmail: formReporterEmail.trim() || 'superadmin@nexusplatform.io',
        assignedToName: formAssignedTo.trim() || 'Platform Operations',
      });

      setTickets(prev => [created, ...prev]);
      setIsCreateModalOpen(false);
      setFormTitle('');
      setFormDescription('');
      loadMetrics();
      showSuccess(`Incident ticket ${created.ticketNumber} logged and dispatched to engineering queue.`);
    } catch (err: any) {
      alert(err.message || 'Failed to log incident ticket');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="platform-tickets-page-container">
      {/* Header */}
      <div className="tickets-page-header">
        <div>
          <div className="header-breadcrumbs">
            <span>PLATFORM CONSOLE</span> &gt; <span className="current">INCIDENT & TECHNICAL HELPDESK</span>
          </div>
          <h1 className="page-main-title">Platform Incident & Technical Helpdesk</h1>
          <p className="page-main-desc">
            Production incident triaging, SIP carrier trunk outages, Speech AI latency telemetry, and cross-tenant SLA tracking.
          </p>
        </div>

        <div className="tickets-header-actions">
          <button
            className="btn btn-ghost"
            onClick={() => loadData(true)}
            disabled={isRefreshing || isLoading}
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            title="Refresh from database"
          >
            <RefreshCw size={15} className={isRefreshing ? 'animate-spin' : ''} />
          </button>
          <button
            className="btn-new-ticket"
            onClick={() => setIsCreateModalOpen(true)}
          >
            <Plus size={16} />
            Log Incident Ticket
          </button>
        </div>
      </div>

      {/* Success Alert Banner */}
      {successMsg && (
        <div className="system-success-alert">
          <CheckCircle2 size={16} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Error Alert Banner */}
      {errorMessage && (
        <div className="ticket-error-alert">
          <div className="error-msg-text">
            <AlertCircle size={18} style={{ color: '#ef4444' }} />
            <span>{errorMessage}</span>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => loadData(true)}>
            <RefreshCw size={14} /> Retry
          </button>
        </div>
      )}

      {/* KPI 4-Grid: Fully Functional & Interactive */}
      <div className="tickets-kpi-grid">
        <div
          className={`ticket-kpi-card active ${statusFilter === 'all' && priorityFilter === 'all' && !hasActiveFilters ? 'is-active-filter' : ''}`}
          onClick={() => handleKpiCardClick('total')}
          title="Click to reset filters and view all tickets"
        >
          <div className="kpi-header">
            <span className="kpi-title">TOTAL PLATFORM TICKETS</span>
            <Ticket size={18} color="#f59e0b" />
          </div>
          <div className="kpi-val">{metrics.total}</div>
          <div className="kpi-sub">
            <span>Across all active customer tenants</span>
          </div>
        </div>

        <div
          className={`ticket-kpi-card critical ${priorityFilter === 'critical_high' || priorityFilter === 'critical' ? 'is-active-filter' : ''}`}
          onClick={() => handleKpiCardClick('critical')}
          title="Click to filter by Critical & High Priority"
        >
          <div className="kpi-header">
            <span className="kpi-title">CRITICAL & HIGH OUTAGES</span>
            <ShieldAlert size={18} color="#ef4444" />
          </div>
          <div className="kpi-val" style={{ color: '#ef4444' }}>{metrics.critical}</div>
          <div className="kpi-sub">
            <span>Requiring immediate L3 intervention</span>
          </div>
        </div>

        <div
          className={`ticket-kpi-card progress ${statusFilter === 'in_progress' ? 'is-active-filter' : ''}`}
          onClick={() => handleKpiCardClick('inProgress')}
          title="Click to filter by Active Investigations"
        >
          <div className="kpi-header">
            <span className="kpi-title">ACTIVE INVESTIGATIONS</span>
            <Clock size={18} color="#38bdf8" />
          </div>
          <div className="kpi-val" style={{ color: '#38bdf8' }}>{metrics.inProgress}</div>
          <div className="kpi-sub">
            <span>In Progress or Escalated to Carrier</span>
          </div>
        </div>

        <div
          className={`ticket-kpi-card resolved ${statusFilter === 'resolved' ? 'is-active-filter' : ''}`}
          onClick={() => handleKpiCardClick('resolved')}
          title="Click to filter by Resolved & Closed tickets"
        >
          <div className="kpi-header">
            <span className="kpi-title">RESOLVED / ARCHIVED</span>
            <CheckCircle2 size={18} color="#10b981" />
          </div>
          <div className="kpi-val" style={{ color: '#10b981' }}>{metrics.resolved}</div>
          <div className="kpi-sub">
            <span>Successfully closed with verified SLA</span>
          </div>
        </div>
      </div>

      {/* Filters & Status Tabs */}
      <div className="tickets-filters-bar">
        <div className="filter-row-top">
          {/* Real Backend Search Box */}
          <div className="search-box-wrap">
            <Search size={16} />
            <input
              type="text"
              className="tickets-search-input"
              placeholder="Search by ticket #, title, tenant, submitter, assignee..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="filter-dropdowns">
            {/* Impacted Tenant Filter */}
            <select
              className="filter-select"
              value={tenantFilter}
              onChange={e => setTenantFilter(e.target.value)}
            >
              <option value="all">All Tenants / Global</option>
              {tenants.map(t => (
                <option key={t.id} value={String(t.id)}>
                  {t.name}
                </option>
              ))}
            </select>

            {/* Priority Filter */}
            <select
              className="filter-select"
              value={priorityFilter}
              onChange={e => setPriorityFilter(e.target.value)}
            >
              <option value="all">All Priorities</option>
              <option value="critical_high">Critical & High (P1 & P2)</option>
              <option value="critical">Critical (P1)</option>
              <option value="high">High (P2)</option>
              <option value="medium">Medium (P3)</option>
              <option value="low">Low (P4)</option>
            </select>

            {/* Category Filter */}
            <select
              className="filter-select"
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
            >
              <option value="all">All Categories</option>
              <option value="Telephony / Carrier Trunk">Telephony / Carrier Trunk</option>
              <option value="Speech AI / Transcription">Speech AI / Transcription</option>
              <option value="Database / Latency">Database / Latency</option>
              <option value="Security & Auth">Security & Auth</option>
              <option value="Tenant Operational">Tenant Operational</option>
            </select>

            {/* Clear Filters Button */}
            {hasActiveFilters && (
              <button
                type="button"
                className="btn-clear-filters"
                onClick={handleClearFilters}
                title="Reset all filters and search"
              >
                <RotateCcw size={12} /> Clear Filters
              </button>
            )}
          </div>
        </div>

        {/* Dynamic Status Tabs Row */}
        <div className="status-tabs-row">
          {(['all', 'open', 'in_progress', 'escalated', 'resolved', 'closed'] as StatusFilter[]).map(st => {
            const count =
              st === 'all'
                ? metrics.total
                : metrics.statusCounts[st] ?? tickets.filter(t => t.status === st).length;

            return (
              <button
                key={st}
                className={`status-tab-btn ${statusFilter === st ? 'active' : ''}`}
                onClick={() => setStatusFilter(st)}
              >
                <span>{st === 'all' ? 'All Incidents' : st.replace('_', ' ').toUpperCase()}</span>
                <span className="status-count-badge">{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tickets Table */}
      <div className="tickets-table-card">
        <div className="table-responsive">
          <table className="tickets-table">
            <thead>
              <tr>
                <th>Ticket ID</th>
                <th>Incident Title & Category</th>
                <th>Affected Tenant</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Submitter / Channel</th>
                <th>Assignee</th>
                <th>Last Update</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && tickets.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '48px', color: '#94a3b8' }}>
                    <RefreshCw size={26} className="animate-spin" style={{ margin: '0 auto 10px', color: '#38bdf8' }} />
                    <div style={{ fontSize: '14px', fontWeight: 500 }}>Connecting to production telemetry and database...</div>
                  </td>
                </tr>
              ) : tickets.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '52px', color: '#64748b' }}>
                    <Ticket size={36} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
                    <div style={{ fontSize: '15px', fontWeight: 600, color: '#94a3b8', marginBottom: '6px' }}>
                      {hasActiveFilters ? 'No Incident Tickets Match the Filter Criteria' : 'No Incident Tickets Logged in Database'}
                    </div>
                    <div style={{ fontSize: '13px', color: '#64748b', maxWidth: '420px', margin: '0 auto 16px' }}>
                      {hasActiveFilters
                        ? 'Try loosening your search terms or clearing specific status and priority filters.'
                        : 'The support desk is clear. Click "Log Incident Ticket" to submit the first operational issue.'}
                    </div>
                    {hasActiveFilters ? (
                      <button className="btn btn-ghost btn-sm" onClick={handleClearFilters}>
                        <RotateCcw size={13} /> Reset Filters
                      </button>
                    ) : (
                      <button className="btn btn-primary btn-sm" onClick={() => setIsCreateModalOpen(true)}>
                        <Plus size={14} /> Log First Incident Ticket
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                tickets.map(ticket => (
                  <tr key={ticket.id}>
                    <td>
                      <span className="ticket-number-tag">{ticket.ticketNumber}</span>
                    </td>
                    <td>
                      <span
                        className="ticket-title-link"
                        onClick={() => handleOpenDetail(ticket)}
                      >
                        {ticket.title}
                      </span>
                      <div className="ticket-cat-sub">
                        <span>{ticket.category}</span>
                        {ticket.timeline && ticket.timeline.length > 0 && (
                          <>
                            <span>•</span>
                            <span>{ticket.timeline.length} update{ticket.timeline.length > 1 ? 's' : ''}</span>
                          </>
                        )}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Building2 size={13} style={{ color: '#94a3b8' }} />
                        <span style={{ fontSize: '13px', color: '#e2e8f0', fontWeight: 500 }}>
                          {ticket.tenantName || 'Platform-wide / Global'}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className={`priority-pill ${ticket.priority}`}>
                        {ticket.priority === 'critical' && <AlertTriangle size={11} />}
                        {ticket.priority}
                      </span>
                    </td>
                    <td>
                      <span className={`status-badge-ticket ${ticket.status}`}>
                        {ticket.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontSize: '12px', color: '#cbd5e1' }}>{ticket.reportedByName}</div>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>{ticket.reportedByEmail}</div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: '#94a3b8' }}>
                        <User size={12} style={{ color: '#38bdf8' }} />
                        <span>{ticket.assignedToName || 'Platform Operations'}</span>
                      </div>
                    </td>
                    <td>
                      <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                        {new Date(ticket.updatedAt || ticket.createdAt).toLocaleDateString()}
                      </div>
                      <div style={{ fontSize: '10px', color: '#64748b' }}>
                        {new Date(ticket.updatedAt || ticket.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => handleOpenDetail(ticket)}
                        style={{ fontSize: '12px', color: '#38bdf8' }}
                      >
                        Triage & Investigate
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TICKET DETAILS & TRIAGE MODAL */}
      {/* ========================================================================= */}
      {isDetailModalOpen && selectedTicket && (
        <Modal
          isOpen={isDetailModalOpen}
          onClose={() => setIsDetailModalOpen(false)}
          title={`Incident Workbench — ${selectedTicket.ticketNumber}`}
          size="lg"
        >
          <div className="ticket-drawer-content">
            {/* Header Meta Box */}
            <div className="drawer-header-meta">
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#f8fafc' }}>
                  {selectedTicket.title}
                </h3>
                <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span>Tenant: <strong>{selectedTicket.tenantName || 'Global Platform'}</strong></span>
                  <span>•</span>
                  <span>Category: <strong>{selectedTicket.category}</strong></span>
                  <span>•</span>
                  <span>Logged: {new Date(selectedTicket.createdAt).toLocaleString()}</span>
                  <span>•</span>
                  <span>Assignee: <strong>{selectedTicket.assignedToName || 'Platform Operations'}</strong></span>
                </div>
              </div>

              <div className="drawer-controls-bar">
                {/* Priority Selector */}
                <select
                  className="filter-select"
                  value={selectedTicket.priority}
                  onChange={e => handlePriorityChange(e.target.value)}
                  disabled={isUpdatingPriority}
                  title="Change ticket priority"
                >
                  <option value="critical">Critical (P1)</option>
                  <option value="high">High (P2)</option>
                  <option value="medium">Medium (P3)</option>
                  <option value="low">Low (P4)</option>
                </select>

                {/* Status Selector */}
                <select
                  className="filter-select"
                  value={selectedTicket.status}
                  onChange={e => handleStatusChange(e.target.value as any)}
                  disabled={isUpdatingStatus}
                  title="Transition ticket status"
                >
                  <option value="open">Open (Unassigned)</option>
                  <option value="in_progress">In Progress (Active)</option>
                  <option value="escalated">Escalated (Carrier L3)</option>
                  <option value="resolved">Resolved (Completed)</option>
                  <option value="closed">Closed (Archived)</option>
                </select>
              </div>
            </div>

            {/* Description & Technical Findings */}
            <div className="ticket-detail-box">
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>
                Incident Synopsis & Technical Impact
              </span>
              <p style={{ margin: 0, fontSize: '13px', color: '#cbd5e1', lineHeight: 1.5, whiteSpace: 'pre-line' }}>
                {selectedTicket.description}
              </p>
            </div>

            {/* Assignee / Reassignment Bar */}
            <form onSubmit={handleAssigneeSubmit} className="assignee-control-box">
              <User size={14} style={{ color: '#38bdf8' }} />
              <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 600 }}>Assignee:</span>
              <input
                type="text"
                className="assignee-input"
                placeholder="Assignee name or team"
                value={assigneeInput}
                onChange={e => setAssigneeInput(e.target.value)}
                disabled={isAssigning}
              />
              <button
                type="submit"
                className="btn btn-ghost btn-sm"
                disabled={isAssigning || !assigneeInput.trim() || assigneeInput.trim() === selectedTicket.assignedToName}
                style={{ fontSize: '11px', padding: '2px 8px' }}
              >
                {isAssigning ? 'Saving...' : 'Reassign'}
              </button>
            </form>

            {/* Resolution Section if Resolved or In Progress with Notes */}
            {(selectedTicket.status === 'resolved' || selectedTicket.status === 'closed') && (
              <div style={{ background: 'rgba(52, 211, 153, 0.1)', border: '1px solid rgba(52, 211, 153, 0.3)', borderRadius: '10px', padding: '14px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#34d399', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <CheckCircle2 size={13} /> Resolution Notes & Post-Mortem Summary
                </span>
                <p style={{ margin: '6px 0 0', fontSize: '13px', color: '#e2e8f0' }}>
                  {selectedTicket.resolutionNotes || 'Operational resolution verified by Platform Operations.'}
                </p>
                {selectedTicket.resolvedAt && (
                  <div style={{ fontSize: '11px', color: '#6ee7b7', marginTop: '4px' }}>
                    Resolved at: {new Date(selectedTicket.resolvedAt).toLocaleString()}
                  </div>
                )}
              </div>
            )}

            {/* Optional Resolution Notes Input if user wants to change/add it */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#94a3b8' }}>
                Resolution / Post-Mortem Notes (Applied upon resolving)
              </label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. Carrier replaced faulty route table on gateway. Verified pings under 18ms."
                value={resolutionInput}
                onChange={e => setResolutionInput(e.target.value)}
              />
            </div>

            {/* Timeline Events / Updates Feed */}
            <div>
              <h4 style={{ margin: '0 0 10px', fontSize: '13px', fontWeight: 700, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <MessageSquare size={14} style={{ color: '#38bdf8' }} />
                Investigation Activity & Diagnostic Timeline ({selectedTicket.timeline ? selectedTicket.timeline.length : 0})
              </h4>

              <div className="ticket-timeline-stream">
                {!selectedTicket.timeline || selectedTicket.timeline.length === 0 ? (
                  <div style={{ fontSize: '12px', color: '#64748b', textAlign: 'center', padding: '16px' }}>
                    No investigation notes recorded yet. Post an operational diagnostic note below.
                  </div>
                ) : (
                  selectedTicket.timeline.map((ev, idx) => (
                    <div
                      key={ev.id || idx}
                      className={`timeline-event-card ${ev.type === 'status_change'
                          ? 'status-event'
                          : ev.type === 'reopen'
                            ? 'status-event'
                            : ev.type === 'assignment_change'
                              ? 'status-event'
                              : ''
                        }`}
                    >
                      <div className="timeline-author-row">
                        <span style={{ fontWeight: 600, color: '#38bdf8' }}>{ev.authorName || 'Platform Operations'}</span>
                        <span>{new Date(ev.createdAt).toLocaleString()}</span>
                      </div>
                      <div className="timeline-msg">{ev.message}</div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Add Timeline Note Form */}
            <form onSubmit={handleAddTimelineNote} className="note-input-wrap">
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#cbd5e1' }}>
                Post Operational Note / Engineering Diagnostic Update
              </label>
              <div style={{ display: 'flex', gap: '10px' }}>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Tata Teleservices confirmed trunk saturation in Bangalore zone. Failover route activated."
                  value={newNoteMessage}
                  onChange={e => setNewNoteMessage(e.target.value)}
                  disabled={isAddingNote}
                />
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={!newNoteMessage.trim() || isAddingNote}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}
                >
                  <Send size={14} />
                  {isAddingNote ? 'Posting...' : 'Post Note'}
                </button>
              </div>
            </form>

            {/* Drawer Footer Actions */}
            <div className="drawer-action-buttons">
              <button
                type="button"
                className="btn-danger-ghost"
                onClick={handleDeleteTicket}
                disabled={isDeleting}
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Trash2 size={13} />
                {isDeleting ? 'Deleting...' : 'Delete Incident Ticket'}
              </button>

              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setIsDetailModalOpen(false)}
              >
                Close Workbench
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ========================================================================= */}
      {/* LOG NEW INCIDENT MODAL */}
      {/* ========================================================================= */}
      {isCreateModalOpen && (
        <Modal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          title="🚨 Log Platform Incident / Carrier Ticket"
          size="md"
        >
          <form onSubmit={handleCreateTicketSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label required">Incident Title</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. SIP Trunk Handshake Failure on Secondary Carrier Gateway"
                value={formTitle}
                onChange={e => setFormTitle(e.target.value)}
                required
              />
            </div>

            <div className="form-grid-two">
              <div className="form-group">
                <label className="form-label">Category</label>
                <select
                  className="form-control"
                  value={formCategory}
                  onChange={e => setFormCategory(e.target.value)}
                >
                  <option value="Telephony / Carrier Trunk">Telephony / Carrier Trunk</option>
                  <option value="Speech AI / Transcription">Speech AI / Transcription</option>
                  <option value="Database / Latency">Database / Latency</option>
                  <option value="Security & Auth">Security & Auth</option>
                  <option value="Tenant Operational">Tenant Operational</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Priority Level</label>
                <select
                  className="form-control"
                  value={formPriority}
                  onChange={e => setFormPriority(e.target.value as any)}
                >
                  <option value="critical">Critical (Immediate Outage / P1)</option>
                  <option value="high">High (Degraded Performance / P2)</option>
                  <option value="medium">Medium (Standard Issue / P3)</option>
                  <option value="low">Low (Cosmetic / P4)</option>
                </select>
              </div>
            </div>

            <div className="form-grid-two">
              <div className="form-group">
                <label className="form-label">Impacted Tenant (Company)</label>
                <select
                  className="form-control"
                  value={formTenantId}
                  onChange={e => setFormTenantId(e.target.value)}
                >
                  <option value="all">Platform-wide / Global Infrastructure</option>
                  {tenants.map(t => (
                    <option key={t.id} value={String(t.id)}>
                      {t.name} ({t.slug})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Assigned Operations Team</label>
                <input
                  type="text"
                  className="form-control"
                  value={formAssignedTo}
                  onChange={e => setFormAssignedTo(e.target.value)}
                  placeholder="e.g. Platform Operations"
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Reporter Contact Email</label>
              <input
                type="email"
                className="form-control"
                value={formReporterEmail}
                onChange={e => setFormReporterEmail(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label required">Detailed Incident Description & Technical Logs</label>
              <textarea
                className="form-control"
                rows={4}
                placeholder="Include error codes (e.g. SIP 503 Service Unavailable), affected caller DIDs, timestamps, and diagnostic observations."
                value={formDescription}
                onChange={e => setFormDescription(e.target.value)}
                required
              />
            </div>

            <div className="modal-actions-footer">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setIsCreateModalOpen(false)}
                disabled={isCreating}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={!formTitle.trim() || !formDescription.trim() || isCreating}
              >
                {isCreating ? 'Logging Incident...' : 'Submit Incident Ticket'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
export default PlatformTicketsPage;
