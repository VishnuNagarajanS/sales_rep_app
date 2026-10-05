import React, { useState, useEffect, useCallback } from 'react';
import { Calendar, Plus, CheckCircle2, Phone, RefreshCw, User, Building2, Lock } from 'lucide-react';
import { SiteVisit, Lead, Customer } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useCall } from '../../context/CallContext';
import { DataTable, Column, RowAction } from '../../components/common/DataTable';
import { StatusChip } from '../../components/common/StatusChip';
import { Modal } from '../../components/common/Modal';
import { jaminApiService } from '../../services/jaminApiService';
import { storageService } from '../../services/storageService';
import { getCustomers } from '../../services/ghlApiService';
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
  const [leads, setLeads] = useState<Lead[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);

  // Form state
  const [visitorType, setVisitorType] = useState<'lead' | 'customer' | 'new'>('lead');
  const [selectedLeadId, setSelectedLeadId] = useState<string>('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
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
      const tenantId = user?.companyId ? String(user.companyId) : 't-jamin-02';
      const [visits, projs, allPlots, agentList, leadList, custList] = await Promise.all([
        jaminApiService.getSiteVisits(true).catch(() => storageService.getSiteVisits(tenantId)),
        jaminApiService.getProjects().catch(() => []),
        jaminApiService.getPlots().catch(() => []),
        jaminApiService.getAgents().catch(() => []),
        jaminApiService.getLeads(true).catch(() => storageService.getLeads(tenantId)),
        getCustomers(tenantId).catch(() => storageService.getCustomers(tenantId)),
      ]);

      const localVisits = storageService.getSiteVisits(tenantId) || [];
      const visitMap = new Map<string, SiteVisit>();
      localVisits.forEach(v => visitMap.set(v.id, v));
      (visits || []).forEach(v => visitMap.set(v.id, v));
      setSiteVisits(Array.from(visitMap.values()));

      setProjects(projs || []);
      setPlots(allPlots || []);
      setAgents(agentList || []);

      const normPhone = (p?: string) => (p || '').replace(/\D/g, '').slice(-10);

      // 1. Deduplicate Customers by phone and name
      const localCustomers = storageService.getCustomers(tenantId) || [];
      const combinedCustomers = [...(custList || []), ...(localCustomers || [])];
      const seenCustomerPhones = new Set<string>();
      const seenCustomerNames = new Set<string>();
      const dedupedCustomers: Customer[] = [];

      for (const c of combinedCustomers) {
        if (!c.name || !c.phone) continue;
        const phoneKey = normPhone(c.phone);
        const nameKey = c.name.trim().toLowerCase();
        if (phoneKey && seenCustomerPhones.has(phoneKey)) continue;
        if (nameKey && seenCustomerNames.has(nameKey)) continue;
        if (phoneKey) seenCustomerPhones.add(phoneKey);
        if (nameKey) seenCustomerNames.add(nameKey);
        dedupedCustomers.push(c);
      }
      setCustomers(dedupedCustomers);

      // 2. Deduplicate Leads, exclude "Converted", and exclude anyone already present in Customers
      const localLeads = storageService.getLeads(tenantId) || [];
      const combinedLeads = [...(leadList || []), ...(localLeads || [])];
      const seenLeadPhones = new Set<string>();
      const seenLeadNames = new Set<string>();
      const dedupedLeads: Lead[] = [];

      for (const l of combinedLeads) {
        if (!l.name || !l.phone) continue;
        // If someone is Converted, they are a customer, not a lead
        if (l.status === 'Converted') continue;

        const phoneKey = normPhone(l.phone);
        const nameKey = l.name.trim().toLowerCase();

        // If this person already exists in Customers, do not show in Leads dropdown
        if (phoneKey && seenCustomerPhones.has(phoneKey)) continue;
        if (nameKey && seenCustomerNames.has(nameKey)) continue;

        // Deduplicate among leads
        if (phoneKey && seenLeadPhones.has(phoneKey)) continue;
        if (nameKey && seenLeadNames.has(nameKey)) continue;

        if (phoneKey) seenLeadPhones.add(phoneKey);
        if (nameKey) seenLeadNames.add(nameKey);

        dedupedLeads.push(l);
      }
      setLeads(dedupedLeads);
    } finally {
      setIsLoading(false);
    }
  }, [user?.companyId]);

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

  // ── Visitor Type & Record Selection ────────────────────────────────────────
  const handleVisitorTypeChange = (type: 'lead' | 'customer' | 'new') => {
    setVisitorType(type);
    setSelectedLeadId('');
    setSelectedCustomerId('');
    setCustomerName('');
    setCustomerPhone(type === 'new' ? '+91 ' : '');
  };

  const handleLeadSelect = (leadId: string) => {
    setSelectedLeadId(leadId);
    const lead = leads.find(l => l.id === leadId);
    if (lead) {
      setCustomerName(lead.name);
      setCustomerPhone(lead.phone);
    } else {
      setCustomerName('');
      setCustomerPhone('');
    }
  };

  const handleCustomerSelect = (custId: string) => {
    setSelectedCustomerId(custId);
    const cust = customers.find(c => c.id === custId);
    if (cust) {
      setCustomerName(cust.name);
      setCustomerPhone(cust.phone);
    } else {
      setCustomerName('');
      setCustomerPhone('');
    }
  };

  // ── Modal open / reset ─────────────────────────────────────────────────────
  const handleOpenScheduleModal = () => {
    setVisitorType('lead');
    setSelectedLeadId('');
    setSelectedCustomerId('');
    setCustomerName('');
    setCustomerPhone('');
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

    if (visitorType === 'lead' && !selectedLeadId) {
      alert('Please select a lead from the dropdown.');
      return;
    }
    if (visitorType === 'customer' && !selectedCustomerId) {
      alert('Please select a customer from the dropdown.');
      return;
    }

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

    const contactType = visitorType === 'customer' ? 'customer' : 'lead';
    const cleanLeadId = visitorType === 'lead' && selectedLeadId ? selectedLeadId : undefined;
    const cleanCustomerId = visitorType === 'customer' && selectedCustomerId ? selectedCustomerId : undefined;
    const tenantId = user?.companyId ? String(user.companyId) : 't-jamin-02';

    setIsSubmitting(true);
    try {
      const payload = {
        leadId: cleanLeadId ? (Number(cleanLeadId.replace(/\D/g, '')) || Number(cleanLeadId) || undefined) : undefined,
        customerId: cleanCustomerId ? (Number(cleanCustomerId.replace(/\D/g, '')) || Number(cleanCustomerId) || undefined) : undefined,
        contactType,
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
      };

      const created = await jaminApiService.scheduleSiteVisit(payload);

      // Save locally to storageService to ensure immediate linkage
      const newVisit: SiteVisit = created || {
        id: `sv-${Date.now()}`,
        companyId: tenantId,
        leadId: cleanLeadId,
        customerId: cleanCustomerId || cleanLeadId || '',
        contactType,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        projectId: selectedProjectId,
        projectName: project?.name ?? '',
        plotId: selectedPlotId,
        plotNumber: plot?.plotNumber ?? 'General Project Tour',
        scheduledAt: dateFormatted,
        assignedAgentId: String(hostAgentId),
        assignedAgentName: hostAgentName,
        status: 'Scheduled',
        visitorNote: notes.trim() || undefined,
      };
      storageService.saveSiteVisit(newVisit);

      // If linked to a lead, log in lead timeline/notes
      if (cleanLeadId) {
        const matchingLead = leads.find(l => l.id === cleanLeadId);
        if (matchingLead) {
          storageService.saveLead({
            ...matchingLead,
            notes: `${matchingLead.notes ? matchingLead.notes + '\n\n' : ''}[${new Date().toLocaleDateString()}] Site Visit Scheduled: ${project?.name || ''} (${plot?.plotNumber || 'Tour'}) on ${dateFormatted}`,
          });
        }
      }

      // If linked to a customer, log in customer notes
      if (cleanCustomerId) {
        const matchingCust = customers.find(c => c.id === cleanCustomerId);
        if (matchingCust) {
          storageService.saveCustomer({
            ...matchingCust,
            notes: `${matchingCust.notes ? matchingCust.notes + '\n\n' : ''}[${new Date().toLocaleDateString()}] Site Visit Scheduled: ${project?.name || ''} (${plot?.plotNumber || 'Tour'}) on ${dateFormatted}`,
          });
        }
      }

      window.dispatchEvent(new Event('nexus_storage_updated'));
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
        subtitle="Book layout walkthrough — linked to Lead or Customer, Project & Plot"
      >
        <form onSubmit={handleScheduleVisit} className="sitevisit-form">

          {/* Visitor Source Selection */}
          <div className="form-group">
            <label className="form-label" style={{ fontWeight: 600, marginBottom: 8, display: 'block' }}>
              Visitor Source *
            </label>
            <div className="visitor-source-toggle">
              <button
                type="button"
                className={`visitor-source-btn ${visitorType === 'lead' ? 'active' : ''}`}
                onClick={() => handleVisitorTypeChange('lead')}
              >
                <User size={14} /> Existing Lead
              </button>
              <button
                type="button"
                className={`visitor-source-btn ${visitorType === 'customer' ? 'active' : ''}`}
                onClick={() => handleVisitorTypeChange('customer')}
              >
                <Building2 size={14} /> Customer
              </button>
              <button
                type="button"
                className={`visitor-source-btn ${visitorType === 'new' ? 'active' : ''}`}
                onClick={() => handleVisitorTypeChange('new')}
              >
                <Plus size={14} /> New Visitor
              </button>
            </div>
          </div>

          {/* If Lead: Display Leads Dropdown */}
          {visitorType === 'lead' && (
            <div className="form-group">
              <label className="form-label">
                Select Lead * <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>({leads.length} available)</span>
              </label>
              <select
                className="form-select"
                required
                value={selectedLeadId}
                onChange={e => handleLeadSelect(e.target.value)}
              >
                <option value="">-- Choose a Lead --</option>
                {leads.map(l => (
                  <option key={l.id} value={l.id}>
                    {l.name} — {l.phone}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* If Customer: Display Customers Dropdown */}
          {visitorType === 'customer' && (
            <div className="form-group">
              <label className="form-label">
                Select Customer * <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>({customers.length} available)</span>
              </label>
              <select
                className="form-select"
                required
                value={selectedCustomerId}
                onChange={e => handleCustomerSelect(e.target.value)}
              >
                <option value="">-- Choose a Customer --</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} — {c.phone}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Client Name & Phone (read-only for Lead/Customer; editable for New) */}
          <div className="sitevisit-form-grid-2">
            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>Client Name *</span>
                {visitorType !== 'new' && customerName && (
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                    <Lock size={10} /> Auto-filled from {visitorType === 'lead' ? 'Lead' : 'Customer'}
                  </span>
                )}
              </label>
              <input
                type="text"
                className={`form-input ${visitorType !== 'new' ? 'sitevisit-locked-input' : ''}`}
                required
                value={customerName}
                onChange={e => setCustomerName(e.target.value)}
                placeholder={visitorType === 'new' ? 'e.g. Sunil Rao' : 'Select above to populate name'}
                readOnly={visitorType !== 'new'}
              />
            </div>
            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>Mobile Number *</span>
                {visitorType !== 'new' && customerPhone && (
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                    <Lock size={10} /> Locked
                  </span>
                )}
              </label>
              <input
                type="tel"
                inputMode="tel"
                className={`form-input ${visitorType !== 'new' ? 'sitevisit-locked-input' : ''}`}
                required
                value={customerPhone}
                onChange={e =>
                  setCustomerPhone(e.target.value.replace(/[a-zA-Z]/g, '').replace(/[^0-9+\s\-*#()]/g, ''))
                }
                placeholder={visitorType === 'new' ? '+91 98800 00000' : 'Select above to populate phone'}
                readOnly={visitorType !== 'new'}
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
