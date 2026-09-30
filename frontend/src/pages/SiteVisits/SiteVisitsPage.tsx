import React, { useState, useEffect } from 'react';
import { Calendar, Plus, CheckCircle2, Phone, Users, UserCheck } from 'lucide-react';
import { SiteVisit, Lead, Customer } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useCall } from '../../context/CallContext';
import { DataTable, Column, RowAction } from '../../components/common/DataTable';
import { StatusChip } from '../../components/common/StatusChip';
import { Modal } from '../../components/common/Modal';
import './SiteVisitsPage.css';
const getStoredSiteVisits = (tenantId?: string): SiteVisit[] => {
  try {
    const raw = localStorage.getItem('nexus_site_visits');
    const all = raw ? JSON.parse(raw) : [];
    return tenantId ? all.filter((s: SiteVisit) => s.companyId === tenantId) : all;
  } catch {
    return [];
  }
};

const saveStoredSiteVisit = (visit: SiteVisit) => {
  try {
    const raw = localStorage.getItem('nexus_site_visits');
    const all: SiteVisit[] = raw ? JSON.parse(raw) : [];
    const idx = all.findIndex(s => s.id === visit.id);
    if (idx >= 0) all[idx] = visit;
    else all.unshift(visit);
    localStorage.setItem('nexus_site_visits', JSON.stringify(all));
    window.dispatchEvent(new Event('nexus_storage_updated'));
  } catch {}
};

const addStoredAuditLog = (log: any) => {
  try {
    const raw = localStorage.getItem('nexus_audit_logs');
    const all = raw ? JSON.parse(raw) : [];
    all.unshift(log);
    localStorage.setItem('nexus_audit_logs', JSON.stringify(all));
    window.dispatchEvent(new Event('nexus_storage_updated'));
  } catch {}
};

export const SiteVisitsPage: React.FC = () => {
  const { tenant, user } = useAuth();
  const { initiateCall } = useCall();

  const [siteVisits, setSiteVisits] = useState<SiteVisit[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);

  const jaminAgents = [
    { id: 'usr-jamin-exec', name: 'Pooja Hegde', email: 'pooja@jaminbazaar.com' },
    { id: 'usr-jamin-exec-02', name: 'Vikram Malhotra', email: 'vikram@jaminbazaar.com' },
    { id: 'usr-jamin-exec-03', name: 'Suresh Kumar', email: 'suresh@jaminbazaar.com' },
  ];

  // Form state
  const [clientSource, setClientSource] = useState<'lead' | 'customer' | 'custom'>('customer');
  const [selectedEntityId, setSelectedEntityId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('+91 ');
  const [hostAgentId, setHostAgentId] = useState(user?.id || 'usr-jamin-exec');
  const [hostAgentName, setHostAgentName] = useState(user?.name || 'Pooja Hegde');
  const [projectName, setProjectName] = useState('Greenfield Meadows Phase 2');
  const [plotNumber, setPlotNumber] = useState('');
  const getTomorrowDate = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  };

  const [visitDate, setVisitDate] = useState(getTomorrowDate);
  const [visitTimeSlot, setVisitTimeSlot] = useState('11:00 AM');
  const [notes, setNotes] = useState('');

  const loadData = () => {
    setSiteVisits(getStoredSiteVisits(tenant?.id));
  };

  useEffect(() => {
    loadData();
    const handleUpdate = () => loadData();
    window.addEventListener('nexus_storage_updated', handleUpdate);
    return () => window.removeEventListener('nexus_storage_updated', handleUpdate);
  }, [tenant?.id]);

  const handleOpenScheduleModal = () => {
    setClientSource('customer');
    setSelectedEntityId('');
    setCustomerName('');
    setCustomerPhone('+91 ');
    setHostAgentId(user?.id || 'usr-jamin-exec');
    setHostAgentName(user?.name || 'Pooja Hegde');
    setProjectName('Jamin Garden — Varapatty');
    setPlotNumber('Plot #15');
    setVisitDate(getTomorrowDate());
    setVisitTimeSlot('Morning · 9–11 am');
    setNotes('');
    setIsScheduleModalOpen(true);
  };

  const handleScheduleVisit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName || !customerPhone) return;

    const dateFormatted = (() => {
      try {
        const [y, m, d] = visitDate.split('-');
        const dateObj = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
        return `${dateObj.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })} • ${visitTimeSlot}`;
      } catch {
        return `${visitDate} • ${visitTimeSlot}`;
      }
    })();

    const newVisit: SiteVisit = {
      id: `sv-${Date.now()}`,
      companyId: tenant?.id || 't-jamin-02',
      customerId: clientSource === 'customer' ? selectedEntityId : `cust-${Date.now()}`,
      customerName,
      customerPhone,
      contactType: clientSource === 'custom' ? undefined : clientSource,
      leadId: clientSource === 'lead' ? selectedEntityId : undefined,
      projectId: 'proj-01',
      projectName,
      plotNumber,
      scheduledAt: dateFormatted,
      assignedAgentId: hostAgentId || user?.id || 'usr-jamin-exec',
      assignedAgentName: hostAgentName || user?.name || 'Pooja Hegde',
      status: 'Scheduled',
      outcomeNotes: notes,
    };

    saveStoredSiteVisit(newVisit);

    // Also notify
    addStoredAuditLog({
      id: `aud-${Date.now()}`,
      timestamp: 'Just now',
      actorName: user?.name || 'Agent',
      actorEmail: user?.email || 'agent@jamin.com',
      action: 'SITE_VISIT_SCHEDULED',
      entityType: 'SiteVisit',
      entityId: newVisit.id,
      companyId: tenant?.id,
      companyName: tenant?.name,
      details: `Scheduled site visit for ${clientSource.toUpperCase()}: ${customerName} at ${projectName} (${plotNumber}).`,
    });

    setIsScheduleModalOpen(false);
    setCustomerName('');
    setNotes('');
  };

  const handleConfirmVisit = (visit: SiteVisit) => {
    storageService.saveSiteVisit({ ...visit, status: 'Scheduled' });
    loadData();
  };

  const handleMarkComplete = (visit: SiteVisit) => {
    saveStoredSiteVisit({ ...visit, status: 'Completed' });
  };

  const columns: Column<SiteVisit>[] = [
    {
      key: 'scheduledAt',
      header: 'Scheduled Slot',
      sortable: true,
      render: sv => (
        <div>
          <div className="sitevisit-slot-title">{sv.scheduledAt}</div>
          <div className="sitevisit-slot-id">ID: {sv.id}</div>
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
            {sv.plotNumber || 'General Project Tour'}
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

  return (
    <div className="sitevisits-page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <Calendar size={24} color="#dc2626" /> Site Visits Log & Scheduling
          </h1>
          <p className="page-subtitle">
            Coordinate customer site walkthroughs, cab logistics, and plot inspections for {tenant?.name}.
          </p>
        </div>

        <button className="btn btn-primary" onClick={handleOpenScheduleModal}>
          <Plus size={15} /> Schedule Site Visit
        </button>
      </div>

      <DataTable
        columns={columns}
        data={siteVisits}
        keyExtractor={sv => sv.id}
        rowActions={rowActions}
        searchPlaceholder="Search visits by customer, project, or plot..."
      />

      {/* Schedule Visit Modal */}
      <Modal
        isOpen={isScheduleModalOpen}
        onClose={() => setIsScheduleModalOpen(false)}
        title="Schedule Prospective Buyer Site Visit"
        subtitle="Book layout walkthrough and link directly to Lead or Customer"
      >
        <form onSubmit={handleScheduleVisit} className="sitevisit-form">
          {/* Client Type Options: Customer, Lead, or Custom */}
          <div className="form-group" style={{ marginBottom: 16 }}>
            <label className="form-label" style={{ fontWeight: 600, marginBottom: 8, display: 'block' }}>
              Select Client Type
            </label>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 6,
                background: 'var(--bg-card-subtle, #f1f5f9)',
                padding: 4,
                borderRadius: 8,
                border: '1px solid var(--border-base)',
              }}
            >
              {(['customer', 'lead', 'custom'] as const).map(type => {
                const label = type === 'customer' ? 'Customer' : type === 'lead' ? 'Lead' : 'Custom';
                const isSelected = clientSource === type;
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => {
                      setClientSource(type);
                      setSelectedEntityId('');
                      setCustomerName('');
                      setCustomerPhone(type === 'custom' ? '+91 ' : '');
                    }}
                    style={{
                      padding: '9px 12px',
                      borderRadius: 6,
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: 13,
                      fontWeight: isSelected ? 700 : 500,
                      background: isSelected
                        ? 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)'
                        : 'transparent',
                      color: isSelected ? '#ffffff' : 'var(--text-secondary)',
                      boxShadow: isSelected ? '0 2px 6px rgba(220, 38, 38, 0.3)' : 'none',
                      transition: 'all 0.2s ease',
                      textAlign: 'center',
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Downside Dropdown based on chosen Client Type */}
          {clientSource !== 'custom' ? (
            <div className="form-group" style={{ marginBottom: 14 }}>
              <label className="form-label">
                {clientSource === 'customer' ? 'Select Customer *' : 'Select Lead *'}
              </label>
              {clientSource === 'customer' ? (
                <select
                  className="form-select"
                  required
                  value={selectedEntityId}
                  onChange={e => {
                    const id = e.target.value;
                    setSelectedEntityId(id);
                    const c = customers.find(item => item.id === id);
                    if (c) {
                      setCustomerName(c.name);
                      setCustomerPhone(c.phone);
                      if (c.assignedAgentName) {
                        setHostAgentName(c.assignedAgentName);
                        setHostAgentId(c.assignedAgentId || '');
                      }
                    } else {
                      setCustomerName('');
                      setCustomerPhone('');
                    }
                  }}
                >
                  <option value="">-- Choose a Customer --</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.phone}) {c.tier ? `— ${c.tier}` : ''}
                    </option>
                  ))}
                </select>
              ) : (
                <select
                  className="form-select"
                  required
                  value={selectedEntityId}
                  onChange={e => {
                    const id = e.target.value;
                    setSelectedEntityId(id);
                    const l = leads.find(item => item.id === id);
                    if (l) {
                      setCustomerName(l.name);
                      setCustomerPhone(l.phone);
                      if (l.assignedAgentName && l.assignedAgentName !== 'Unassigned') {
                        setHostAgentName(l.assignedAgentName);
                        setHostAgentId(l.assignedAgentId || '');
                      }
                    } else {
                      setCustomerName('');
                      setCustomerPhone('');
                    }
                  }}
                >
                  <option value="">-- Choose a Lead --</option>
                  {leads.map(l => (
                    <option key={l.id} value={l.id}>
                      {l.name} ({l.phone}) {l.projectInterest ? `— ${l.projectInterest}` : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>
          ) : null}

          {/* Standard Separate Text Boxes for Name and Mobile */}
          <div className="sitevisit-form-grid-2">
            <div className="form-group">
              <label className="form-label">Client Name *</label>
              <input
                type="text"
                className="form-input"
                required
                readOnly={clientSource !== 'custom'}
                value={customerName}
                onChange={e => {
                  if (clientSource === 'custom') {
                    setCustomerName(e.target.value);
                  }
                }}
                placeholder={
                  clientSource === 'custom'
                    ? 'e.g. Sunil Rao'
                    : `Pick a ${clientSource} from dropdown above`
                }
                style={
                  clientSource !== 'custom'
                    ? { background: 'var(--bg-card-subtle, #f3f4f6)', cursor: 'not-allowed', color: 'var(--text-secondary)' }
                    : {}
                }
              />
            </div>
            <div className="form-group">
              <label className="form-label">Mobile Number *</label>
              <input
                type="tel"
                inputMode="tel"
                className="form-input"
                required
                readOnly={clientSource !== 'custom'}
                value={customerPhone}
                onChange={e => {
                  if (clientSource === 'custom') {
                    setCustomerPhone(e.target.value.replace(/[a-zA-Z]/g, '').replace(/[^0-9+\s\-*#()]/g, ''));
                  }
                }}
                onKeyDown={e => {
                  if (clientSource === 'custom' && e.key.length === 1 && /[a-zA-Z]/.test(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) {
                    e.preventDefault();
                  }
                }}
                placeholder={
                  clientSource === 'custom'
                    ? '+91 98800 00000'
                    : `Pick a ${clientSource} from dropdown above`
                }
                style={
                  clientSource !== 'custom'
                    ? { background: 'var(--bg-card-subtle, #f3f4f6)', cursor: 'not-allowed', color: 'var(--text-secondary)' }
                    : {}
                }
              />
            </div>
          </div>

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
                <option value="Morning · 9–11 am">Morning · 9–11 am</option>
                <option value="Midday · 11 am–1 pm">Midday · 11 am–1 pm</option>
                <option value="Afternoon · 2–4 pm">Afternoon · 2–4 pm</option>
                <option value="Evening · 4–6 pm">Evening · 4–6 pm</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Host Escort Agent</label>
            <select
              className="form-select"
              value={hostAgentName}
              onChange={e => {
                const ag = jaminAgents.find(a => a.name === e.target.value);
                setHostAgentName(e.target.value);
                setHostAgentId(ag?.id || '');
              }}
            >
              {jaminAgents.map(ag => (
                <option key={ag.id} value={ag.name}>
                  {ag.name} ({ag.email})
                </option>
              ))}
            </select>
          </div>

          <div className="sitevisit-form-grid-2">
            <div className="form-group">
              <label className="form-label">Development Target</label>
              <select
                className="form-select"
                value={projectName}
                onChange={e => setProjectName(e.target.value)}
              >
                <option value="Jamin Garden — Varapatty">Jamin Garden — Varapatty (Coimbatore)</option>
                <option value="Jamin Garden — Edappadi">Jamin Garden — Edappadi (Salem)</option>
                <option value="Jamin Garden — Shastri Nagar">Jamin Garden — Shastri Nagar (Erode)</option>
                <option value="Trichy's Tulip">Trichy's Tulip (Tiruchirappalli)</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Plot Number Target</label>
              <input
                type="text"
                className="form-input"
                value={plotNumber}
                onChange={e => setPlotNumber(e.target.value)}
                placeholder="e.g. Plot #15"
              />
            </div>
          </div>

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
            <button type="button" className="btn btn-secondary" onClick={() => setIsScheduleModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Confirm Schedule
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
