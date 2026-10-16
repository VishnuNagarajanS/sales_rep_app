import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Ticket,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Search,
  Plus,
  RefreshCw,
  Send,
  X,
  MessageSquare,
  AlertCircle,
  HelpCircle,
  RotateCcw,
} from 'lucide-react';
import { PlatformTicket } from '../../types';
import { supportService } from '../../services/supportService';
import { Modal } from '../../components/common/Modal';
import './TenantSupportPage.css';

type StatusFilter = 'all' | 'open' | 'in_progress' | 'resolved';

export const TenantSupportPage: React.FC = () => {
  const [tickets, setTickets] = useState<PlatformTicket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState('');

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState('all');

  // Selected Ticket for Details Modal
  const [selectedTicket, setSelectedTicket] = useState<PlatformTicket | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [newNoteMessage, setNewNoteMessage] = useState('');
  const [isAddingNote, setIsAddingNote] = useState(false);

  // Raise Ticket Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [formTitle, setFormTitle] = useState('');
  const [formCategory, setFormCategory] = useState('Tenant Operational');
  const [formPriority, setFormPriority] = useState<'low' | 'medium' | 'high' | 'critical'>('high');
  const [formDescription, setFormDescription] = useState('');

  const requestIdRef = useRef(0);

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 4500);
  };

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery.trim());
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  const loadTickets = useCallback(async (isManual = false) => {
    const currentRequestId = ++requestIdRef.current;
    if (isManual) setIsRefreshing(true);
    else setIsLoading(true);
    setErrorMessage(null);

    try {
      const data = await supportService.fetchTenantTickets({
        status: statusFilter !== 'all' ? statusFilter : undefined,
        category: categoryFilter !== 'all' ? categoryFilter : undefined,
        search: debouncedSearch || undefined,
      });

      if (currentRequestId === requestIdRef.current) {
        setTickets(data || []);
        if (isManual) {
          showSuccess('Support tickets refreshed.');
        }
      }
    } catch (err: any) {
      if (currentRequestId === requestIdRef.current) {
        console.error('Failed to load support tickets:', err);
        setErrorMessage(err.message || 'Failed to retrieve support tickets.');
      }
    } finally {
      if (currentRequestId === requestIdRef.current) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  }, [statusFilter, categoryFilter, debouncedSearch]);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  // Derived metrics
  const kpis = {
    total: tickets.length,
    active: tickets.filter(t => t.status === 'open' || t.status === 'in_progress' || t.status === 'escalated').length,
    resolved: tickets.filter(t => t.status === 'resolved' || t.status === 'closed').length,
  };

  const handleOpenDetail = (ticket: PlatformTicket) => {
    setSelectedTicket(ticket);
    setIsDetailModalOpen(true);
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !newNoteMessage.trim()) return;

    setIsAddingNote(true);
    try {
      const updated = await supportService.addTenantTicketNote(selectedTicket.id, newNoteMessage.trim());
      setSelectedTicket(updated);
      setTickets(prev => prev.map(t => (t.id === updated.id ? updated : t)));
      setNewNoteMessage('');
      showSuccess('Follow-up comment submitted to Platform Operations.');
    } catch (err: any) {
      alert(err.message || 'Failed to submit follow-up note');
    } finally {
      setIsAddingNote(false);
    }
  };

  const handleCreateTicketSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formDescription.trim()) return;

    setIsCreating(true);
    try {
      const created = await supportService.createTenantTicket({
        title: formTitle.trim(),
        description: formDescription.trim(),
        category: formCategory,
        priority: formPriority,
      });

      setTickets(prev => [created, ...prev]);
      setIsCreateModalOpen(false);
      setFormTitle('');
      setFormDescription('');
      showSuccess(`Support ticket ${created.ticketNumber} submitted to Platform Operations.`);
    } catch (err: any) {
      alert(err.message || 'Failed to submit ticket');
    } finally {
      setIsCreating(false);
    }
  };

  const hasActiveFilters = statusFilter !== 'all' || categoryFilter !== 'all' || searchQuery.trim().length > 0;

  const handleClearFilters = () => {
    setStatusFilter('all');
    setCategoryFilter('all');
    setSearchQuery('');
  };

  return (
    <div className="tenant-support-container">
      {/* Header */}
      <div className="tenant-support-header">
        <div>
          <div className="support-breadcrumbs">
            <span>WORKSPACE</span> &gt; <span className="current">HELP & SUPPORT DESK</span>
          </div>
          <h1 className="page-main-title">Help & Technical Support</h1>
          <p className="page-main-desc">
            Submit operational issues, report carrier audio degradation, request platform assistance, and track ticket SLA resolution in real-time.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            className="btn btn-ghost"
            onClick={() => loadTickets(true)}
            disabled={isRefreshing || isLoading}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button
            className="btn-raise-ticket"
            onClick={() => setIsCreateModalOpen(true)}
          >
            <Plus size={16} />
            Raise Support Ticket
          </button>
        </div>
      </div>

      {/* Success banner */}
      {successMsg && (
        <div className="system-success-alert">
          <CheckCircle2 size={16} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Error banner */}
      {errorMessage && (
        <div className="ticket-error-alert">
          <div className="error-msg-text">
            <AlertCircle size={18} style={{ color: '#ef4444' }} />
            <span>{errorMessage}</span>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => loadTickets(true)}>
            <RefreshCw size={14} /> Retry
          </button>
        </div>
      )}

      {/* 3-Grid KPI */}
      <div className="support-kpi-grid">
        <div
          className={`support-kpi-card ${statusFilter === 'all' && !hasActiveFilters ? 'active-kpi' : ''}`}
          onClick={() => { setStatusFilter('all'); setCategoryFilter('all'); setSearchQuery(''); }}
        >
          <div className="support-kpi-header">
            <span className="support-kpi-title">TOTAL TICKETS RAISED</span>
            <Ticket size={18} color="#38bdf8" />
          </div>
          <div className="support-kpi-val">{kpis.total}</div>
          <div className="support-kpi-sub">Lifetime tickets for your company</div>
        </div>

        <div
          className={`support-kpi-card ${statusFilter === 'open' || statusFilter === 'in_progress' ? 'active-kpi' : ''}`}
          onClick={() => setStatusFilter(prev => (prev === 'in_progress' ? 'all' : 'in_progress'))}
        >
          <div className="support-kpi-header">
            <span className="support-kpi-title">ACTIVE / IN PROGRESS</span>
            <Clock size={18} color="#f59e0b" />
          </div>
          <div className="support-kpi-val" style={{ color: '#f59e0b' }}>{kpis.active}</div>
          <div className="support-kpi-sub">Currently under engineering review</div>
        </div>

        <div
          className={`support-kpi-card ${statusFilter === 'resolved' ? 'active-kpi' : ''}`}
          onClick={() => setStatusFilter(prev => (prev === 'resolved' ? 'all' : 'resolved'))}
        >
          <div className="support-kpi-header">
            <span className="support-kpi-title">RESOLVED ISSUES</span>
            <CheckCircle2 size={18} color="#10b981" />
          </div>
          <div className="support-kpi-val" style={{ color: '#10b981' }}>{kpis.resolved}</div>
          <div className="support-kpi-sub">Verified and closed with resolution notes</div>
        </div>
      </div>

      {/* Filters bar */}
      <div className="support-filters-card">
        <div className="support-filters-top">
          <div className="support-search-wrap">
            <Search size={15} />
            <input
              type="text"
              className="support-search-input"
              placeholder="Search by ticket #, title, category, keyword..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                <X size={13} />
              </button>
            )}
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
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

            {hasActiveFilters && (
              <button
                type="button"
                className="btn-clear-filters"
                onClick={handleClearFilters}
              >
                <RotateCcw size={12} /> Clear Filters
              </button>
            )}
          </div>
        </div>

        {/* Status Tab Row */}
        <div className="status-tabs-row" style={{ marginTop: '4px' }}>
          {(['all', 'open', 'in_progress', 'resolved'] as StatusFilter[]).map(st => {
            const count =
              st === 'all'
                ? tickets.length
                : tickets.filter(t => t.status === st || (st === 'resolved' && t.status === 'closed')).length;

            return (
              <button
                key={st}
                className={`status-tab-btn ${statusFilter === st ? 'active' : ''}`}
                onClick={() => setStatusFilter(st)}
              >
                <span>{st === 'all' ? 'All Tickets' : st.replace('_', ' ').toUpperCase()}</span>
                <span className="status-count-badge">{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tickets Table */}
      <div className="support-table-card">
        <div className="table-responsive">
          <table className="support-table">
            <thead>
              <tr>
                <th>Ticket #</th>
                <th>Incident Synopsis & Category</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Submitted By</th>
                <th>Last Update</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && tickets.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                    <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 8px', color: '#38bdf8' }} />
                    <div>Loading your support tickets...</div>
                  </td>
                </tr>
              ) : tickets.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '48px', color: '#64748b' }}>
                    <HelpCircle size={36} style={{ margin: '0 auto 10px', opacity: 0.4 }} />
                    <div style={{ fontSize: '15px', fontWeight: 600, color: '#94a3b8', marginBottom: '6px' }}>
                      {hasActiveFilters ? 'No Support Tickets Match Your Filters' : 'No Support Tickets Logged Yet'}
                    </div>
                    <div style={{ fontSize: '13px', color: '#64748b', maxWidth: '380px', margin: '0 auto 14px' }}>
                      {hasActiveFilters
                        ? 'Try clearing the search or category filters.'
                        : 'Have a technical issue or request? Click "Raise Support Ticket" to notify Platform Operations.'}
                    </div>
                    {hasActiveFilters ? (
                      <button className="btn btn-ghost btn-sm" onClick={handleClearFilters}>
                        <RotateCcw size={13} /> Reset Filters
                      </button>
                    ) : (
                      <button className="btn btn-primary btn-sm" onClick={() => setIsCreateModalOpen(true)}>
                        <Plus size={14} /> Raise First Support Ticket
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
                        View Updates
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Ticket Details Modal */}
      {isDetailModalOpen && selectedTicket && (
        <Modal
          isOpen={isDetailModalOpen}
          onClose={() => setIsDetailModalOpen(false)}
          title={`Support Ticket — ${selectedTicket.ticketNumber}`}
          size="lg"
        >
          <div className="ticket-drawer-content">
            <div className="drawer-header-meta">
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#f8fafc' }}>
                  {selectedTicket.title}
                </h3>
                <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '6px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <span>Category: <strong>{selectedTicket.category}</strong></span>
                  <span>•</span>
                  <span>Priority: <strong style={{ textTransform: 'uppercase' }}>{selectedTicket.priority}</strong></span>
                  <span>•</span>
                  <span>Status: <strong style={{ textTransform: 'capitalize' }}>{selectedTicket.status.replace('_', ' ')}</strong></span>
                  <span>•</span>
                  <span>Logged: {new Date(selectedTicket.createdAt).toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Description */}
            <div className="ticket-detail-box">
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>
                Incident Description & Logs Submitted
              </span>
              <p style={{ margin: 0, fontSize: '13px', color: '#cbd5e1', lineHeight: 1.5, whiteSpace: 'pre-line' }}>
                {selectedTicket.description}
              </p>
            </div>

            {/* Resolution Box if resolved */}
            {(selectedTicket.status === 'resolved' || selectedTicket.status === 'closed') && (
              <div style={{ background: 'rgba(52, 211, 153, 0.1)', border: '1px solid rgba(52, 211, 153, 0.3)', borderRadius: '10px', padding: '14px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#34d399', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <CheckCircle2 size={13} /> Official Engineering Resolution Note
                </span>
                <p style={{ margin: '6px 0 0', fontSize: '13px', color: '#e2e8f0' }}>
                  {selectedTicket.resolutionNotes || 'Operational resolution verified by Super Admin Operations.'}
                </p>
                {selectedTicket.resolvedAt && (
                  <div style={{ fontSize: '11px', color: '#6ee7b7', marginTop: '4px' }}>
                    Resolved at: {new Date(selectedTicket.resolvedAt).toLocaleString()}
                  </div>
                )}
                <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ fontSize: '12px', padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                    onClick={async () => {
                      const reason = window.prompt('Please describe why you are reopening this ticket:');
                      if (reason === null) return;
                      try {
                        const updated = await supportService.reopenTenantTicket(selectedTicket.id, reason.trim() || undefined);
                        setSelectedTicket(updated);
                        setTickets(prev => prev.map(t => (t.id === updated.id ? updated : t)));
                        showSuccess(`Ticket ${updated.ticketNumber} reopened and escalated back to Platform Operations.`);
                      } catch (err: any) {
                        alert(err.message || 'Failed to reopen ticket');
                      }
                    }}
                  >
                    <RotateCcw size={13} />
                    Reopen Support Ticket
                  </button>
                </div>
              </div>
            )}

            {/* Investigation Timeline */}
            <div>
              <h4 style={{ margin: '0 0 10px', fontSize: '13px', fontWeight: 700, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <MessageSquare size={14} style={{ color: '#38bdf8' }} />
                Platform Operations & Communication Timeline ({selectedTicket.timeline ? selectedTicket.timeline.length : 0})
              </h4>

              <div className="ticket-timeline-stream">
                {!selectedTicket.timeline || selectedTicket.timeline.length === 0 ? (
                  <div style={{ fontSize: '12px', color: '#64748b', textAlign: 'center', padding: '16px' }}>
                    No updates logged yet. Platform Operations has been dispatched.
                  </div>
                ) : (
                  selectedTicket.timeline.map((ev, idx) => (
                    <div
                      key={ev.id || idx}
                      className={`timeline-event-card ${ev.type === 'status_change' ? 'status-event' : ''}`}
                    >
                      <div className="timeline-author-row">
                        <span style={{ fontWeight: 600, color: '#38bdf8' }}>{ev.authorName || 'Operations'}</span>
                        <span>{new Date(ev.createdAt).toLocaleString()}</span>
                      </div>
                      <div className="timeline-msg">{ev.message}</div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Post Follow-up Message */}
            <form onSubmit={handleAddNote} className="note-input-wrap">
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#cbd5e1' }}>
                Add Additional Details / Diagnostic Comment to Operations
              </label>
              <div style={{ display: 'flex', gap: '10px' }}>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Issue happened again on call SID #CA89291 at 11:20 AM."
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
                  {isAddingNote ? 'Sending...' : 'Post Reply'}
                </button>
              </div>
            </form>
          </div>
        </Modal>
      )}

      {/* Raise Ticket Modal */}
      {isCreateModalOpen && (
        <Modal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          title="🎫 Raise Technical Support Ticket"
          size="md"
        >
          <form onSubmit={handleCreateTicketSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label required">Issue Title / Subject</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. Telephony WebRTC audio one-way on outbound call"
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
                  <option value="Tenant Operational">Tenant Operational</option>
                  <option value="Telephony / Carrier Trunk">Telephony / Carrier Trunk</option>
                  <option value="Speech AI / Transcription">Speech AI / Transcription</option>
                  <option value="Database / Latency">Database / Latency</option>
                  <option value="Security & Auth">Security & Auth</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Urgency / Severity</label>
                <select
                  className="form-control"
                  value={formPriority}
                  onChange={e => setFormPriority(e.target.value as any)}
                >
                  <option value="critical">Critical (Blocking Core Operations / P1)</option>
                  <option value="high">High (Major Feature Degraded / P2)</option>
                  <option value="medium">Medium (Standard Issue / P3)</option>
                  <option value="low">Low (Cosmetic / Question / P4)</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label required">Detailed Problem Description & Error Traces</label>
              <textarea
                className="form-control"
                rows={4}
                placeholder="Describe what occurred, affected client names/numbers, time of incident, and any error message displayed."
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
                {isCreating ? 'Submitting...' : 'Submit Support Ticket'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
export default TenantSupportPage;
