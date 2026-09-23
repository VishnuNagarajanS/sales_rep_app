import React, { useState, useEffect } from 'react';
import { Calendar, Plus, CheckCircle2, Phone } from 'lucide-react';
import { SiteVisit } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useCall } from '../../context/CallContext';
import { storageService } from '../../services/storageService';
import { DataTable, Column, RowAction } from '../../components/common/DataTable';
import { StatusChip } from '../../components/common/StatusChip';
import { Modal } from '../../components/common/Modal';
import './SiteVisitsPage.css';

export const SiteVisitsPage: React.FC = () => {
  const { tenant, user } = useAuth();
  const { initiateCall } = useCall();

  const [siteVisits, setSiteVisits] = useState<SiteVisit[]>([]);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);

  // Form state
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('+91 ');
  const [projectName, setProjectName] = useState('Greenfield Meadows Phase 2');
  const [plotNumber, setPlotNumber] = useState('Plot #15');
  const [scheduledAt, setScheduledAt] = useState('This Saturday, 10:30 AM');
  const [notes, setNotes] = useState('');

  const loadData = () => {
    setSiteVisits(storageService.getSiteVisits(tenant?.id));
  };

  useEffect(() => {
    loadData();
    const handleUpdate = () => loadData();
    window.addEventListener('nexus_storage_updated', handleUpdate);
    return () => window.removeEventListener('nexus_storage_updated', handleUpdate);
  }, [tenant?.id]);

  const handleScheduleVisit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName || !customerPhone) return;

    const newVisit: SiteVisit = {
      id: `sv-${Date.now()}`,
      companyId: tenant?.id || 't-jamin-02',
      customerId: `cust-${Date.now()}`,
      customerName,
      customerPhone,
      projectId: 'proj-01',
      projectName,
      plotNumber,
      scheduledAt,
      assignedAgentId: user?.id || 'usr-exec',
      assignedAgentName: user?.name || 'Pooja Hegde',
      status: 'Scheduled',
      outcomeNotes: notes,
    };

    storageService.saveSiteVisit(newVisit);

    // Also notify
    storageService.addAuditLog({
      id: `aud-${Date.now()}`,
      timestamp: 'Just now',
      actorName: user?.name || 'Agent',
      actorEmail: user?.email || 'agent@jamin.com',
      action: 'SITE_VISIT_SCHEDULED',
      entityType: 'SiteVisit',
      entityId: newVisit.id,
      companyId: tenant?.id,
      companyName: tenant?.name,
      details: `Scheduled site visit for ${customerName} at ${projectName} (${plotNumber}).`,
    });

    setIsScheduleModalOpen(false);
    setCustomerName('');
    setNotes('');
  };

  const handleMarkComplete = (visit: SiteVisit) => {
    storageService.saveSiteVisit({ ...visit, status: 'Completed' });
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
          <div className="sitevisit-client-name">{sv.customerName}</div>
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
            <Calendar size={24} color="#059669" /> Site Visits Log & Scheduling
          </h1>
          <p className="page-subtitle">
            Coordinate customer site walkthroughs, cab logistics, and plot inspections for {tenant?.name}.
          </p>
        </div>

        <button className="btn btn-primary" onClick={() => setIsScheduleModalOpen(true)}>
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
        subtitle="Book layout walkthrough and assign sales escort"
      >
        <form onSubmit={handleScheduleVisit} className="sitevisit-form">
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

          <div className="sitevisit-form-grid-2">
            <div className="form-group">
              <label className="form-label">Client Phone *</label>
              <input
                type="text"
                className="form-input"
                required
                value={customerPhone}
                onChange={e => setCustomerPhone(e.target.value)}
                placeholder="+91 98800 00000"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Visit Slot *</label>
              <input
                type="text"
                className="form-input"
                required
                value={scheduledAt}
                onChange={e => setScheduledAt(e.target.value)}
                placeholder="e.g. Saturday, 11:00 AM"
              />
            </div>
          </div>

          <div className="sitevisit-form-grid-2">
            <div className="form-group">
              <label className="form-label">Project</label>
              <select
                className="form-select"
                value={projectName}
                onChange={e => setProjectName(e.target.value)}
              >
                <option value="Greenfield Meadows Phase 2">Greenfield Meadows Phase 2</option>
                <option value="Valley Crest Country Estates">Valley Crest Country Estates</option>
                <option value="Emerald Orchid Enclave">Emerald Orchid Enclave</option>
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
