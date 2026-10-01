import React, { useState, useEffect, useCallback } from 'react';
import { Calendar, Plus, CheckCircle2, Phone, RefreshCw } from 'lucide-react';
import { SiteVisit } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useCall } from '../../context/CallContext';
import { DataTable, Column, RowAction } from '../../components/common/DataTable';
import { StatusChip } from '../../components/common/StatusChip';
import { Modal } from '../../components/common/Modal';
import { jaminApiService } from '../../services/jaminApiService';
import './SiteVisitsPage.css';
const TIME_SLOTS = [
  'Morning · 9–11 am',
  'Midday · 11 am–1 pm',
  'Afternoon · 2–4 pm',
  'Evening · 4–6 pm',
];

export const SiteVisitsPage: React.FC = () => {
  const { user } = useAuth();
  const { initiateCall } = useCall();

  const [siteVisits, setSiteVisits] = useState<SiteVisit[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [plots, setPlots] = useState<any[]>([]);
  const [filteredPlots, setFilteredPlots] = useState<any[]>([]);
  const [agents, setAgents] = useState<Array<{ id: number; name: string; email: string }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);

  // Form state
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('+91 ');
  const [hostAgentId, setHostAgentId] = useState<number>(0);
  const [hostAgentName, setHostAgentName] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [selectedPlotId, setSelectedPlotId] = useState<string>('');

  const getTomorrowDate = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  };
  const [visitDate, setVisitDate] = useState(getTomorrowDate);
  const [visitTimeSlot, setVisitTimeSlot] = useState(TIME_SLOTS[0]);
  const [notes, setNotes] = useState('');

  // ── Load all data ──────────────────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    setIsLoading(true);
    try {
      const [visits, projs, allPlots, agentList] = await Promise.all([
        jaminApiService.getSiteVisits(true),
        jaminApiService.getProjects(),
        jaminApiService.getPlots(),
        jaminApiService.getAgents(),
      ]);
      setSiteVisits(visits);
      setProjects(projs);
      setPlots(allPlots);
      setAgents(agentList || []);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // When selectedProjectId changes, filter plots
  useEffect(() => {
    if (selectedProjectId) {
      setFilteredPlots(plots.filter(p => String(p.projectId) === selectedProjectId));
    } else {
      setFilteredPlots([]);
    }
    setSelectedPlotId('');
  }, [selectedProjectId, plots]);

  // ── Modal open / reset ─────────────────────────────────────────────────────
  const handleOpenScheduleModal = () => {
    setCustomerName('');
    setCustomerPhone('+91 ');
    const defaultAgent = agents.length > 0 ? agents[0] : null;
    setHostAgentId(defaultAgent ? defaultAgent.id : Number(user?.id) || 0);
    setHostAgentName(defaultAgent ? defaultAgent.name : (user?.name || 'Agent'));
    setSelectedProjectId(projects.length > 0 ? String(projects[0].id) : '');
    setSelectedPlotId('');
    setVisitDate(getTomorrowDate());
    setVisitTimeSlot(TIME_SLOTS[0]);
    setNotes('');
    setIsScheduleModalOpen(true);
  };

  // ── Schedule submit ────────────────────────────────────────────────────────
  const handleScheduleVisit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim() || !customerPhone.trim()) return;

    const dateFormatted = (() => {
      try {
        const [y, m, d] = visitDate.split('-');
        const dateObj = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
        return `${dateObj.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })} • ${visitTimeSlot}`;
      } catch {
        return `${visitDate} • ${visitTimeSlot}`;
      }
    })();

    const project = projects.find((p: any) => String(p.id) === selectedProjectId);
    const plot = filteredPlots.find((p: any) => String(p.id) === selectedPlotId);

    setIsSubmitting(true);
    try {
      await jaminApiService.scheduleSiteVisit({
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        projectId: selectedProjectId ? Number(selectedProjectId) : undefined,
        plotId: selectedPlotId ? Number(selectedPlotId) : undefined,
        projectName: project?.name ?? '',
        plotNumber: plot?.plotNumber ?? '',
        scheduledAt: dateFormatted,
        visitorNote: notes.trim() || undefined,
        assignedAgentId: hostAgentId,
        assignedAgentName: hostAgentName,
      });
      setIsScheduleModalOpen(false);
      await loadAll();
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Row actions ────────────────────────────────────────────────────────────
  const handleConfirmVisit = async (sv: SiteVisit) => {
    await jaminApiService.confirmSiteVisit(sv.id);
    await loadAll();
  };

  const handleMarkComplete = async (sv: SiteVisit) => {
    await jaminApiService.completeSiteVisit(sv.id, 'Site visit completed.');
    await loadAll();
  };

  // ── Table columns ──────────────────────────────────────────────────────────
  const columns: Column<SiteVisit>[] = [
    {
      key: 'scheduledAt',
      header: 'Scheduled Slot',
      sortable: true,
      render: sv => (
        <div>
          <div className="sitevisit-slot-title">{sv.scheduledAt}</div>
          <div className="sitevisit-slot-id">ID #{sv.id}</div>
        </div>
      ),
    },
    {
      key: 'customerName',
      header: 'Client Details',
      sortable: true,
      render: sv => (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className="sitevisit-client-name">{sv.customerName}</span>
            {sv.contactType && (
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  padding: '2px 7px',
                  borderRadius: '10px',
                  background: sv.contactType === 'lead' ? '#eff6ff' : '#ecfdf5',
                  color: sv.contactType === 'lead' ? '#2563eb' : '#059669',
                  border: `1px solid ${sv.contactType === 'lead' ? '#bfdbfe' : '#a7f3d0'}`,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                {sv.contactType}
              </span>
            )}
          </div>
          <div className="sitevisit-client-phone">{sv.customerPhone}</div>
        </div>
      ),
    },
    {
      key: 'projectName',
      header: 'Project & Plot',
      sortable: true,
      render: sv => (
        <div>
          <div className="sitevisit-project-name">{sv.projectName}</div>
          <div className="sitevisit-plot-target">
            {sv.plotNumber && sv.plotNumber !== 'Layout Tour' ? sv.plotNumber : 'General Project Tour'}
          </div>
        </div>
      ),
    },
    {
      key: 'assignedAgentName',
      header: 'Host Agent',
      render: sv => <span className="sitevisit-agent-name">{sv.assignedAgentName}</span>,
    },
    {
      key: 'status',
      header: 'Visit Status',
      sortable: true,
      render: sv => <StatusChip status={sv.status} size="sm" />,
    },
  ];

  const rowActions: RowAction<SiteVisit>[] = [
    {
      label: 'Call Client',
      icon: <Phone size={14} color="#059669" style={{ marginRight: 6 }} />,
      onClick: sv => initiateCall(sv.customerName, sv.customerPhone),
    },
    {
      label: 'Confirm Visit',
      icon: <CheckCircle2 size={14} color="#d97706" style={{ marginRight: 6 }} />,
      hidden: sv => sv.status !== 'Pending' && sv.status !== 'Requested',
      onClick: sv => handleConfirmVisit(sv),
    },
    {
      label: 'Mark Completed',
      icon: <CheckCircle2 size={14} color="#2563eb" style={{ marginRight: 6 }} />,
      hidden: sv => sv.status === 'Completed',
      onClick: sv => handleMarkComplete(sv),
    },
  ];

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="sitevisits-page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <Calendar size={24} color="#dc2626" /> Site Visits Log & Scheduling
          </h1>
          <p className="page-subtitle">
            Coordinate customer site walkthroughs — linked to real Projects and Plots for live count tracking.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary" onClick={loadAll} title="Refresh">
            <RefreshCw size={15} />
          </button>
          <button className="btn btn-primary" onClick={handleOpenScheduleModal}>
            <Plus size={15} /> Schedule Site Visit
          </button>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={siteVisits}
        keyExtractor={sv => sv.id}
        rowActions={rowActions}
        searchPlaceholder="Search visits by customer, project, or plot..."
      />

      {/* ── Schedule Visit Modal ──────────────────────────────────────────── */}
      <Modal
        isOpen={isScheduleModalOpen}
        onClose={() => setIsScheduleModalOpen(false)}
        title="Schedule Prospective Buyer Site Visit"
        subtitle="Book layout walkthrough — linked to Project & Plot for auto-count tracking"
      >
        <form onSubmit={handleScheduleVisit} className="sitevisit-form">

          {/* Client Name & Phone */}
          <div className="sitevisit-form-grid-2">
            <div className="form-group">
              <label className="form-label">Client Name *</label>
              <input
                type="text"
                className="form-input"
                required
                value={customerName}
                onChange={e => setCustomerName(e.target.value)}
                placeholder="e.g. Sunil Rao"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Mobile Number *</label>
              <input
                type="tel"
                inputMode="tel"
                className="form-input"
                required
                value={customerPhone}
                onChange={e =>
                  setCustomerPhone(e.target.value.replace(/[a-zA-Z]/g, '').replace(/[^0-9+\s\-*#()]/g, ''))
                }
                placeholder="+91 98800 00000"
              />
            </div>
          </div>

          {/* Project → Plot linked dropdowns */}
          <div className="sitevisit-form-grid-2">
            <div className="form-group">
              <label className="form-label">Project *</label>
              <select
                className="form-select"
                required
                value={selectedProjectId}
                onChange={e => setSelectedProjectId(e.target.value)}
              >
                <option value="">-- Select Project --</option>
                {projects.map((p: any) => (
                  <option key={p.id} value={String(p.id)}>
                    {p.name} — {p.location}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">
                Plot{' '}
                <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                  (optional)
                </span>
              </label>
              <select
                className="form-select"
                value={selectedPlotId}
                onChange={e => setSelectedPlotId(e.target.value)}
                disabled={!selectedProjectId || filteredPlots.length === 0}
              >
                <option value="">-- General Project Tour --</option>
                {filteredPlots.map((pl: any) => (
                  <option key={pl.id} value={String(pl.id)}>
                    {pl.plotNumber} · {pl.dimensions} · {pl.status}
                    {pl.price ? ` · ₹${Number(pl.price).toLocaleString('en-IN')}` : ''}
                  </option>
                ))}
              </select>
              {selectedProjectId && filteredPlots.length === 0 && (
                <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
                  No plots added for this project yet.
                </p>
              )}
            </div>
          </div>

          {/* Visit Date & Time */}
          <div className="sitevisit-form-grid-2">
            <div className="form-group">
              <label className="form-label">Visit Date *</label>
              <input
                type="date"
                className="form-input"
                required
                min={new Date().toISOString().split('T')[0]}
                value={visitDate}
                onChange={e => setVisitDate(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Time Slot *</label>
              <select
                className="form-select"
                required
                value={visitTimeSlot}
                onChange={e => setVisitTimeSlot(e.target.value)}
              >
                {TIME_SLOTS.map(slot => (
                  <option key={slot} value={slot}>{slot}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Host Agent */}
          <div className="form-group">
            <label className="form-label">Host Escort Agent</label>
            <select
              className="form-select"
              value={hostAgentId}
              onChange={e => {
                const id = Number(e.target.value);
                setHostAgentId(id);
                const ag = agents.find(a => a.id === id);
                setHostAgentName(ag?.name || '');
              }}
            >
              <option value="0">-- Select Agent --</option>
              {agents.map(ag => (
                <option key={ag.id} value={ag.id}>
                  {ag.name} ({ag.email})
                </option>
              ))}
            </select>
          </div>

          {/* Notes */}
          <div className="form-group">
            <label className="form-label">Logistics / Pickup Notes</label>
            <textarea
              className="form-textarea"
              rows={2}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="e.g. Needs cab pickup from metro station, visiting with spouse..."
            />
          </div>

          <div className="sitevisit-form-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsScheduleModalOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Scheduling...' : 'Confirm Schedule'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
