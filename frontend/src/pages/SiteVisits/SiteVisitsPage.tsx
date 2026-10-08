import React, { useState, useEffect, useCallback } from 'react';
import { Calendar, Plus, CheckCircle2, Phone, RefreshCw, User, Building2, Lock, Edit } from 'lucide-react';
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
  const { tenant, user } = useAuth();
  const { initiateCall } = useCall();
  const roleCode = String(user?.role?.code || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  const canAssignSiteVisits = ['super_admin', 'company_admin', 'admin'].includes(
    roleCode,
  );

  const [siteVisits, setSiteVisits] = useState<SiteVisit[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [plots, setPlots] = useState<any[]>([]);
  const [filteredPlots, setFilteredPlots] = useState<any[]>([]);
  const [agents, setAgents] = useState<Array<{ id: number; name: string; email: string }>>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);

  // Unified Manage Site Visit modal state (Status change, Reschedule, Complete, Cancel)
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);
  const [managingVisit, setManagingVisit] = useState<SiteVisit | null>(null);
  const [manageStatus, setManageStatus] = useState<string>('');
  const [manageVisitDate, setManageVisitDate] = useState('');
  const [manageVisitTimeSlot, setManageVisitTimeSlot] = useState(TIME_SLOTS[0]);
  const [manageProjectId, setManageProjectId] = useState<string>('');
  const [managePlotId, setManagePlotId] = useState<string>('');
  const [manageFilteredPlots, setManageFilteredPlots] = useState<any[]>([]);
  const [manageHostAgentId, setManageHostAgentId] = useState<number>(0);
  const [manageHostAgentName, setManageHostAgentName] = useState('');
  const [manageNote, setManageNote] = useState('');
  const [isSubmittingManage, setIsSubmittingManage] = useState(false);

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
      const [visitsResult, projs, allPlots, agentList, leadList, custList] = await Promise.all([
        jaminApiService.getSiteVisits(true)
          .then(data => ({ data, error: '' }))
          .catch(() => ({ data: [], error: 'Site visits could not be loaded from the server.' })),
        jaminApiService.getProjects().catch(() => []),
        jaminApiService.getPlots().catch(() => []),
        jaminApiService.getAgents().catch(() => []),
        jaminApiService.getLeads(true).catch(() => storageService.getLeads(tenantId)),
        getCustomers(tenantId).catch(() => []),
      ]);

      // Site visits shown in the table come only from the backend.
      setSiteVisits(visitsResult.data);
      setLoadError(visitsResult.error);

      setProjects(projs || []);
      setPlots(allPlots || []);
      setAgents(agentList || []);

      const normPhone = (p?: string) => (p || '').replace(/\D/g, '').slice(-10);

      // 1. Deduplicate Customers by phone and name strictly from DB API
      const combinedCustomers = (custList || []) as Customer[];
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
    } catch (err) {
      console.error('Failed to load site visit data', err);
      setSiteVisits([]);
      setLoadError('Site visits could not be loaded from the server.');
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
    const defaultAgent = canAssignSiteVisits
      ? agents[0]
      : agents.find(agent => String(agent.id) === String(user?.id));
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
      if (!created) {
        throw new Error('The site visit could not be saved. Please try again.');
      }

      // Save locally to storageService to ensure immediate linkage
      storageService.saveSiteVisit(created);

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

  // ── Unified Manage Site Visit Handlers ─────────────────────────────────────
  const handleOpenManageModal = (sv: SiteVisit) => {
    setManagingVisit(sv);

    let parsedDate = '';
    let parsedSlot = TIME_SLOTS[0];

    if (sv.scheduledAt) {
      const parts = sv.scheduledAt.split(/[·•]/).map(s => s.trim());
      if (parts[0] && /^\d{4}-\d{2}-\d{2}$/.test(parts[0])) {
        parsedDate = parts[0];
      } else if (parts[0]) {
        const d = new Date(parts[0]);
        if (!isNaN(d.getTime())) {
          parsedDate = d.toISOString().split('T')[0];
        }
      }

      const rest = parts.slice(1).join(' ');
      const matched = TIME_SLOTS.find(slot =>
        rest.toLowerCase().includes(slot.toLowerCase().split(/[·•]/)[0].trim().toLowerCase())
      );
      if (matched) {
        parsedSlot = matched;
      }
    }

    if (!parsedDate) {
      parsedDate = new Date().toISOString().split('T')[0];
    }

    setManageVisitDate(parsedDate);
    setManageVisitTimeSlot(parsedSlot);

    const projId = sv.projectId
      ? String(sv.projectId)
      : (projects.find(p => p.name === sv.projectName)?.id
        ? String(projects.find(p => p.name === sv.projectName).id)
        : '');
    setManageProjectId(projId);

    if (projId) {
      const matchedPlots = plots.filter(p => String(p.projectId) === String(projId));
      setManageFilteredPlots(matchedPlots);
      const plt = matchedPlots.find(
        p => String(p.id) === String(sv.plotId) || p.plotNumber === sv.plotNumber
      );
      setManagePlotId(plt ? String(plt.id) : '');
    } else {
      setManageFilteredPlots([]);
      setManagePlotId('');
    }

    const agId =
      Number(sv.assignedAgentId) ||
      (agents.find(a => a.name === sv.assignedAgentName)?.id ?? 0);
    setManageHostAgentId(agId);
    setManageHostAgentName(sv.assignedAgentName || '');

    // Default status: nothing selected initially, forcing user to choose
    setManageStatus('');

    setManageNote(sv.outcomeNotes || sv.visitorNote || '');
    setIsManageModalOpen(true);
  };

  // Auto-open target site visit if redirected from Leads 360 drawer
  useEffect(() => {
    const targetId = sessionStorage.getItem('target_site_visit_id');
    if (targetId && siteVisits.length > 0) {
      sessionStorage.removeItem('target_site_visit_id');
      sessionStorage.removeItem('target_site_visit_lead');
      const found = siteVisits.find(v => v.id === targetId || String(v.id) === String(targetId));
      if (found) {
        handleOpenManageModal(found);
      }
    }
  }, [siteVisits]);

  const handleManageProjectChange = (projId: string) => {
    setManageProjectId(projId);
    setManagePlotId('');
    if (!projId) {
      setManageFilteredPlots([]);
      return;
    }
    const matching = plots.filter(p => String(p.projectId) === String(projId));
    setManageFilteredPlots(matching);
  };

  const handleSaveManageVisit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!managingVisit || !manageStatus) return;
    setIsSubmittingManage(true);

    try {
      const trimmedNote = manageNote.trim();
      const isRescheduled = manageStatus === 'Rescheduled';

      let formattedSlot = managingVisit.scheduledAt;
      if (isRescheduled) {
        try {
          const [y, m, d] = manageVisitDate.split('-');
          const dateObj = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
          formattedSlot = `${dateObj.toLocaleDateString('en-US', {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })} • ${manageVisitTimeSlot}`;
        } catch {
          formattedSlot = `${manageVisitDate} • ${manageVisitTimeSlot}`;
        }
      }

      const project = projects.find(p => String(p.id) === String(manageProjectId));
      const plot = manageFilteredPlots.find(p => String(p.id) === String(managePlotId));

      const payload: any = {
        status: manageStatus,
        visitorNote: trimmedNote,
        outcomeNotes: trimmedNote,
      };

      if (isRescheduled) {
        payload.scheduledAt = formattedSlot;
        if (manageProjectId) payload.projectId = Number(manageProjectId);
        if (project?.name) payload.projectName = project.name;
        if (managePlotId) payload.plotId = Number(managePlotId);
        if (plot?.plotNumber) payload.plotNumber = plot.plotNumber;
        if (canAssignSiteVisits && manageHostAgentId) payload.assignedAgentId = manageHostAgentId;
        if (canAssignSiteVisits && manageHostAgentName) payload.assignedAgentName = manageHostAgentName;
      }

      const updated = await jaminApiService.updateSiteVisit(managingVisit.id, payload);
      if (!updated) {
        throw new Error('The site visit could not be updated. Please try again.');
      }

      const updatedVisit: SiteVisit = {
        ...managingVisit,
        status: manageStatus as any,
        scheduledAt: formattedSlot,
        projectId: isRescheduled ? (manageProjectId || managingVisit.projectId) : managingVisit.projectId,
        projectName: isRescheduled ? (project?.name || managingVisit.projectName) : managingVisit.projectName,
        plotId: isRescheduled ? (managePlotId || managingVisit.plotId) : managingVisit.plotId,
        plotNumber: isRescheduled ? (plot?.plotNumber || (managePlotId ? '' : managingVisit.plotNumber)) : managingVisit.plotNumber,
        assignedAgentId: isRescheduled ? String(manageHostAgentId || managingVisit.assignedAgentId) : managingVisit.assignedAgentId,
        assignedAgentName: isRescheduled ? (manageHostAgentName || managingVisit.assignedAgentName) : managingVisit.assignedAgentName,
        visitorNote: trimmedNote,
        outcomeNotes: trimmedNote,
      };
      storageService.saveSiteVisit(updatedVisit);

      // If linked to a lead, log in lead timeline/notes
      if (managingVisit.leadId) {
        const matchingLead = leads.find(l => l.id === managingVisit.leadId);
        if (matchingLead) {
          const timestamp = new Date().toLocaleDateString();
          storageService.saveLead({
            ...matchingLead,
            notes: `${matchingLead.notes ? matchingLead.notes + '\n\n' : ''}[${timestamp}] Site Visit Status: ${manageStatus}${isRescheduled ? ` (New slot: ${formattedSlot})` : ''} — ${trimmedNote || 'Updated'}`,
          });
        }
      }

      storageService.addAuditLog({
        id: `aud-${Date.now()}`,
        timestamp: new Date().toISOString(),
        actorName: user?.name || 'Agent',
        actorEmail: user?.email || 'agent@jaminbazaar.com',
        action: isRescheduled ? 'SITE_VISIT_RESCHEDULED' : `SITE_VISIT_${manageStatus.toUpperCase()}`,
        entityType: 'SiteVisit',
        entityId: String(managingVisit.id),
        companyId: tenant?.id,
        companyName: tenant?.name,
        details: isRescheduled
          ? `Rescheduled visit for ${managingVisit.customerName} to ${formattedSlot}. Note: ${trimmedNote}`
          : `Updated visit status to ${manageStatus} for ${managingVisit.customerName}. Note: ${trimmedNote}`,
      });

      window.dispatchEvent(new Event('nexus_storage_updated'));
      setIsManageModalOpen(false);
      await loadAll();
    } catch (err) {
      console.error('Failed to update visit:', err);
      alert('Failed to update visit. Please try again.');
    } finally {
      setIsSubmittingManage(false);
    }
  };

  const handleConfirmVisit = async (sv: SiteVisit) => {
    await jaminApiService.confirmSiteVisit(sv.id);
    await loadAll();
  };

  // ── Table columns ──────────────────────────────────────────────────────────
  const columns: Column<SiteVisit>[] = [
    {
      key: 'scheduledAt',
      header: 'Scheduled Slot',
      sortable: true,
      render: sv => (
        <div className="sitevisit-slot-title">{sv.scheduledAt}</div>
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
      header: 'Visit Status & Notes',
      sortable: true,
      render: sv => {
        const note = sv.outcomeNotes || sv.visitorNote || '';
        return (
          <div className="sitevisit-status-cell">
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <StatusChip status={sv.status} size="sm" />
            </div>

            {note ? (
              <div className="sitevisit-note-text" title={note}>
                "{note}"
              </div>
            ) : null}
          </div>
        );
      },
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
      icon: <CheckCircle2 size={14} color="#059669" style={{ marginRight: 6 }} />,
      hidden: sv => sv.status !== 'Pending' && sv.status !== 'Requested',
      onClick: sv => handleConfirmVisit(sv),
    },
    {
      label: 'Update Status / Reschedule',
      icon: <Edit size={14} color="#4f46e5" style={{ marginRight: 6 }} />,
      onClick: sv => handleOpenManageModal(sv),
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

      {loadError && <div className="card text-center" role="alert">{loadError}</div>}

      <DataTable
        columns={columns}
        data={siteVisits}
          loading={isLoading}
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
          {canAssignSiteVisits && <div className="form-group">
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
          </div>}

          {/* Notes */}
          <div className="form-group">
            <label className="form-label">Visit Notes / Requirements</label>
            <textarea
              className="form-textarea"
              rows={2}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="e.g. Needs cab pickup from metro station, visiting with spouse, interested in corner plot..."
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

      {/* ── Unified Manage Site Visit Modal ──────────────────────────────── */}
      <Modal
        isOpen={isManageModalOpen && !!managingVisit}
        onClose={() => setIsManageModalOpen(false)}
        title={
          manageStatus === 'Rescheduled'
            ? `Reschedule Site Visit: ${managingVisit?.customerName || ''}`
            : manageStatus === 'Completed'
              ? `Complete Site Visit: ${managingVisit?.customerName || ''}`
              : manageStatus === 'Cancelled'
                ? `Cancel Site Visit: ${managingVisit?.customerName || ''}`
                : `Update Visit: ${managingVisit?.customerName || ''}`
        }
        subtitle="Update walkthrough status, reschedule timing, or log outcome & reason"
        size="md"
      >
        <form onSubmit={handleSaveManageVisit} className="sitevisit-form">
          {/* Visit Summary Card */}
          <div className="sitevisit-summary-card">
            <div className="sitevisit-summary-row">
              <span className="sitevisit-summary-label">Client:</span>
              <span className="sitevisit-summary-val">
                {managingVisit?.customerName} ({managingVisit?.customerPhone})
              </span>
            </div>
            <div className="sitevisit-summary-row">
              <span className="sitevisit-summary-label">Project / Plot:</span>
              <span className="sitevisit-summary-val">
                {managingVisit?.projectName || 'Project Tour'} {managingVisit?.plotNumber ? `· Plot ${managingVisit.plotNumber}` : ''}
              </span>
            </div>
            <div className="sitevisit-summary-row">
              <span className="sitevisit-summary-label">Current Slot:</span>
              <span className="sitevisit-summary-val" style={{ color: '#2563eb', fontWeight: 700 }}>
                {managingVisit?.scheduledAt}
              </span>
            </div>
            <div className="sitevisit-summary-row">
              <span className="sitevisit-summary-label">Current Status:</span>
              <span className="sitevisit-summary-val">
                <StatusChip status={managingVisit?.status || 'Scheduled'} size="sm" />
              </span>
            </div>
          </div>

          {/* 1. FIRST: Status Dropdown (NO "Scheduled" option!) */}
          <div className="form-group">
            <label className="form-label" style={{ fontWeight: 700, fontSize: '13px' }}>
              Select New Visit Status *
            </label>
            <select
              className="form-select"
              required
              value={manageStatus}
              onChange={e => setManageStatus(e.target.value)}
              style={{ fontWeight: 600, fontSize: '13px', borderColor: 'var(--primary-500)' }}
            >
              <option value="">-- Select Status to Proceed --</option>
              <option value="Rescheduled">Rescheduled</option>
              <option value="Completed">Completed</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>

          {!manageStatus && (
            <div
              style={{
                padding: '16px 20px',
                backgroundColor: 'var(--bg-surface-hover, #f8fafc)',
                borderRadius: '8px',
                border: '1px dashed var(--border-base, #cbd5e1)',
                textAlign: 'center',
                color: 'var(--text-secondary, #64748b)',
                fontSize: '13px',
                margin: '10px 0',
              }}
            >
              Please select a status above to proceed.
            </div>
          )}

          {/* 2. DYNAMIC FORM SECTIONS BASED ON STATUS */}

          {/* ── CASE A: RESCHEDULED ── */}
          {manageStatus === 'Rescheduled' && (
            <>
              <div className="sitevisit-manage-banner rescheduled">
                <span>📅 <strong>Rescheduling Visit:</strong> Choose the new inspection date, time slot, and escort agent below.</span>
              </div>

              {/* Date & Time Slot Grid */}
              <div className="sitevisit-form-grid-2">
                <div className="form-group">
                  <label className="form-label">New Visit Date *</label>
                  <input
                    type="date"
                    className="form-input"
                    required
                    min={new Date().toISOString().split('T')[0]}
                    value={manageVisitDate}
                    onChange={e => setManageVisitDate(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">New Time Slot *</label>
                  <select
                    className="form-select"
                    required
                    value={manageVisitTimeSlot}
                    onChange={e => setManageVisitTimeSlot(e.target.value)}
                  >
                    {TIME_SLOTS.map(slot => (
                      <option key={slot} value={slot}>{slot}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Project & Plot Selection Grid */}
              <div className="sitevisit-form-grid-2">
                <div className="form-group">
                  <label className="form-label">Development Project</label>
                  <select
                    className="form-select"
                    value={manageProjectId}
                    onChange={e => handleManageProjectChange(e.target.value)}
                  >
                    <option value="">-- Keep Existing Project --</option>
                    {projects.map(p => (
                      <option key={p.id} value={String(p.id)}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Target Plot (Optional)</label>
                  <select
                    className="form-select"
                    value={managePlotId}
                    onChange={e => setManagePlotId(e.target.value)}
                    disabled={!manageProjectId || manageFilteredPlots.length === 0}
                  >
                    <option value="">-- General Project Tour --</option>
                    {manageFilteredPlots.map(pl => (
                      <option key={pl.id} value={String(pl.id)}>
                        {pl.plotNumber} {pl.status ? `(${pl.status})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Host Agent */}
              {canAssignSiteVisits && <div className="form-group">
                <label className="form-label">Host Escort Agent</label>
                <select
                  className="form-select"
                  value={manageHostAgentId}
                  onChange={e => {
                    const id = Number(e.target.value);
                    setManageHostAgentId(id);
                    const ag = agents.find(a => a.id === id);
                    setManageHostAgentName(ag?.name || '');
                  }}
                >
                  <option value="0">-- select agent --</option>
                  {agents.map(ag => (
                    <option key={ag.id} value={ag.id}>
                      {ag.name} ({ag.email})
                    </option>
                  ))}
                </select>
              </div>}

              {/* Unified Reschedule Reason & Notes */}
              <div className="form-group">
                <label className="form-label">
                  Reason for Rescheduling / Visit Notes *
                </label>
                <textarea
                  className="form-textarea"
                  rows={3}
                  required
                  value={manageNote}
                  onChange={e => setManageNote(e.target.value)}
                  placeholder="Why is this visit being rescheduled? (e.g. Client requested next Saturday 11 AM due to office work, out of station...)"
                />
              </div>
            </>
          )}

          {/* ── CASE B: COMPLETED ── */}
          {manageStatus === 'Completed' && (
            <>
              <div className="sitevisit-manage-banner completed">
                <span>✓ <strong>Mark as Completed:</strong> Record the client's inspection feedback and discussion outcome.</span>
              </div>

              <div className="form-group">
                <label className="form-label">
                  Client Feedback & Visit Outcome *
                </label>
                <textarea
                  className="form-textarea"
                  rows={4}
                  required
                  value={manageNote}
                  onChange={e => setManageNote(e.target.value)}
                  placeholder="What did the client say? Which plot did they prefer? Are they ready for token booking or follow-up needed?"
                />
              </div>
            </>
          )}

          {/* ── CASE C: CANCELLED ── */}
          {manageStatus === 'Cancelled' && (
            <>
              <div className="sitevisit-manage-banner cancelled">
                <span>✕ <strong>Cancel Site Visit:</strong> Please provide the reason for cancellation for records and tracking.</span>
              </div>

              <div className="form-group">
                <label className="form-label">
                  Reason for Cancellation *
                </label>
                <textarea
                  className="form-textarea"
                  rows={4}
                  required
                  value={manageNote}
                  onChange={e => setManageNote(e.target.value)}
                  placeholder="Why was this visit cancelled? (e.g. Client postponed indefinitely, client did not turn up, budget constraints, not interested...)"
                />
              </div>
            </>
          )}

          {/* Modal Actions */}
          <div className="sitevisit-form-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsManageModalOpen(false)}
              disabled={isSubmittingManage}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmittingManage || !manageStatus}
              style={{
                backgroundColor:
                  manageStatus === 'Completed'
                    ? '#059669'
                    : manageStatus === 'Cancelled'
                      ? '#dc2626'
                      : manageStatus === 'Rescheduled'
                        ? '#4f46e5'
                        : 'var(--primary-600, #4f46e5)',
                borderColor:
                  manageStatus === 'Completed'
                    ? '#059669'
                    : manageStatus === 'Cancelled'
                      ? '#dc2626'
                      : manageStatus === 'Rescheduled'
                        ? '#4f46e5'
                        : 'var(--primary-600, #4f46e5)',
                color: '#ffffff',
                fontWeight: 600,
                opacity: !manageStatus ? 0.6 : 1,
                cursor: !manageStatus ? 'not-allowed' : 'pointer',
              }}
            >
              {isSubmittingManage
                ? 'Saving...'
                : manageStatus === 'Rescheduled'
                  ? 'Confirm Reschedule & Update Slot'
                  : manageStatus === 'Completed'
                    ? 'Save & Mark Completed'
                    : manageStatus === 'Cancelled'
                      ? 'Confirm Cancellation'
                      : 'Select Status to Save'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
