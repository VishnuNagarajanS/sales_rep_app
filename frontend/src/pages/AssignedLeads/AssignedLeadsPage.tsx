import React, { useState, useEffect, useMemo } from 'react';
import {
  UserCheck,
  Phone,
  Edit,
  ExternalLink,
  Trash2,
} from 'lucide-react';
import { Lead } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useCall } from '../../context/CallContext';
import { storageService } from '../../services/storageService';
import { jaminApiService } from '../../services/jaminApiService';
import { DataTable, Column, RowAction } from '../../components/common/DataTable';
import { FilterBar } from '../../components/common/FilterBar';
import { Drawer } from '../../components/common/Drawer';
import { Modal } from '../../components/common/Modal';
import { StatusChip } from '../../components/common/StatusChip';
import { apiClient } from '../../services/apiClient';
import { adminUserService } from '../../services/adminUserService';
import { getLeads as getBackendLeads } from '../../services/ghlApiService';
import './AssignedLeadsPage.css';

export const AssignedLeadsPage: React.FC = () => {
  const { tenant, user } = useAuth();
  const { initiateCall } = useCall();
  const isJamin = tenant?.slug === 'jamin' || tenant?.id === 't-jamin-02' || tenant?.id === '2' || user?.companySlug === 'jamin';
  const roleCode = String(user?.role?.code || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  const canManageAssignments = ['company_admin', 'admin', 'super_admin', 'sales_manager', 'manager'].includes(roleCode);
  const isSalesAgent = ['sales_executive', 'irm'].includes(roleCode);

  const [leads, setLeads] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isDetailDrawerOpen, setIsDetailDrawerOpen] = useState(false);
  const [isEditDrawerOpen, setIsEditDrawerOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<Lead>>({});
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [sourceFilter, setSourceFilter] = useState<string>('All');
  const [agentFilter, setAgentFilter] = useState<string>('All');
  const [datePreset, setDatePreset] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  // Agent reassignment confirmation state for Edit panel
  const [pendingAgent, setPendingAgent] = useState<{ id: string | number; name: string } | null>(null);
  const [isReassignConfirmOpen, setIsReassignConfirmOpen] = useState(false);

  // Date range helpers
  const formatDateYMD = (d: Date): string => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const getPresetDates = (preset: string): { from: string; to: string } => {
    const now = new Date();
    const todayStr = formatDateYMD(now);

    switch (preset) {
      case 'today':
        return { from: todayStr, to: todayStr };
      case 'yesterday': {
        const yest = new Date(now);
        yest.setDate(yest.getDate() - 1);
        const yestStr = formatDateYMD(yest);
        return { from: yestStr, to: yestStr };
      }
      case 'this_week': {
        const d = new Date(now);
        d.setDate(d.getDate() - 6);
        return { from: formatDateYMD(d), to: todayStr };
      }
      case 'this_month': {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        return { from: formatDateYMD(startOfMonth), to: formatDateYMD(endOfMonth) };
      }
      case 'last_30_days': {
        const d = new Date(now);
        d.setDate(d.getDate() - 29);
        return { from: formatDateYMD(d), to: todayStr };
      }
      default:
        return { from: '', to: '' };
    }
  };

  const getLeadDateStr = (lead: Lead): string => {
    const raw = lead.assignedAt || lead.createdAt;
    if (!raw) return '';
    if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
      return raw.substring(0, 10);
    }
    const d = new Date(raw);
    if (!isNaN(d.getTime())) {
      return formatDateYMD(d);
    }
    return '';
  };

  const handleDatePresetChange = (preset: string) => {
    if (preset === 'all') {
      setDatePreset('all');
      setDateFrom('');
      setDateTo('');
    } else if (preset === 'custom') {
      setDatePreset('custom');
    } else {
      const { from, to } = getPresetDates(preset);
      setDatePreset(preset);
      setDateFrom(from);
      setDateTo(to);
    }
  };

  const handleCustomDateChange = (from: string, to: string) => {
    setDatePreset('custom');
    setDateFrom(from);
    setDateTo(to);
  };

  const loadData = async () => {
    setIsLoading(true);
    let allLeads: Lead[] = [];
    try {
      if (tenant?.slug === 'jamin' || tenant?.id === 't-jamin-02' || String(tenant?.id) === '2') {
        allLeads = await jaminApiService.getLeads(true);
      } else {
        allLeads = await getBackendLeads(tenant?.id);
      }
    } catch {
      allLeads = [];
    }

    const assigned = allLeads
      .filter(lead => {
        const agentId = String(lead.assignedAgentId || '').trim();
        const name = (lead.assignedAgentName || '').trim();

        // Must have some agent info
        if (!agentId && !name) return false;
        // Exclude placeholder names
        if (name === 'Agent' || name === 'Unassigned') return false;

        if (isSalesAgent && String(lead.assignedAgentId || '') !== String(user?.id || '')) return false;

        return true;
      });

    setLeads(assigned);
    setSelectedLead(prev => {
      if (!prev) return null;
      return assigned.find(l => l.id === prev.id) || null;
    });
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
    const handleUpdate = () => loadData();
    window.addEventListener('nexus_storage_updated', handleUpdate);
    return () => window.removeEventListener('nexus_storage_updated', handleUpdate);
  }, [tenant?.id, tenant?.slug, user?.id, isSalesAgent]);

  const handleOpenEdit = (lead: Lead) => {
    setFormData({ ...lead });
    setPendingAgent(null);
    setIsReassignConfirmOpen(false);
    setIsEditDrawerOpen(true);
  };

  const [dynamicAgents, setDynamicAgents] = useState<Array<{ id: string | number; name: string }>>([]);

  useEffect(() => {
    if (tenant?.slug === 'jamin' || tenant?.id === 't-jamin-02' || String(tenant?.id) === '2') {
      jaminApiService.getAgents().then(data => {
        if (data && data.length > 0) {
          setDynamicAgents(data.map(a => ({ id: a.id, name: a.name })));
        }
      }).catch(err => console.warn('Failed to load Jamin agents:', err));
    } else {
      adminUserService.getUsers(tenant?.id || '1').then(users => {
        if (users && users.length > 0) {
          setDynamicAgents(
            users
              .filter(u => {
                const code = String(u.role?.code || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
                return u.status !== 'Disabled' && ['sales_executive', 'sales_manager', 'irm'].includes(code);
              })
              .map(u => ({ id: u.id, name: u.name }))
          );
        }
      }).catch(err => console.warn('Failed to load GHL agents:', err));
    }
  }, [tenant?.id]);

  // Populate agent options from backend API, ensuring current assigned agent is included if valid
  const agentOptions = useMemo<Array<{ id: string | number; name: string }>>(() => {
    const list: Array<{ id: string | number; name: string }> = [...dynamicAgents];
    if (
      formData.assignedAgentName &&
      formData.assignedAgentName !== 'Unassigned' &&
      !list.some(a => a.name.toLowerCase() === formData.assignedAgentName?.toLowerCase())
    ) {
      list.unshift({ id: 'current', name: formData.assignedAgentName });
    }
    return list;
  }, [formData.assignedAgentName, dynamicAgents]);

  const handleAgentChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newName = e.target.value;
    const currentName = formData.assignedAgentName || '';

    // If unchanged, do nothing
    if (!newName || newName === currentName) return;

    const chosenAgent = agentOptions.find(a => a.name === newName);
    if (!chosenAgent) return;

    // Trigger confirmation modal; do not change form state immediately
    setPendingAgent(chosenAgent);
    setIsReassignConfirmOpen(true);
  };

  const handleConfirmReassign = () => {
    if (pendingAgent) {
      setFormData(prev => ({
        ...prev,
        assignedAgentId: String(pendingAgent.id),
        assignedAgentName: pendingAgent.name,
      }));
    }
    setIsReassignConfirmOpen(false);
    setPendingAgent(null);
  };

  const handleCancelReassign = () => {
    setIsReassignConfirmOpen(false);
    setPendingAgent(null);
  };

  const handleSaveLead = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.phone) return;

    const existingLead = leads.find(l => l.id === formData.id);
    const leadToSave: Lead = {
      ...(existingLead || ({} as Lead)),
      ...(formData as Lead),
      id: formData.id || `lead-${Date.now()}`,
      companyId: formData.companyId || tenant?.id || 't-ghl-01',
    };

    storageService.saveLead(leadToSave);

    // Keep session mock assignments in sync if tracked
    try {
      const raw = sessionStorage.getItem('ghl_mock_agent_assignments');
      if (raw) {
        const assignments: Array<{ leadId: string; agentId: number | string; agentName: string }> = JSON.parse(raw);
        const idx = assignments.findIndex(a => a.leadId === leadToSave.id);
        if (idx >= 0) {
          assignments[idx] = {
            ...assignments[idx],
            agentId: leadToSave.assignedAgentId || '',
            agentName: leadToSave.assignedAgentName || '',
          };
          sessionStorage.setItem('ghl_mock_agent_assignments', JSON.stringify(assignments));
        }
      }
    } catch { }

    setIsEditDrawerOpen(false);
    loadData();
  };

  // Table columns exactly matching the requested specification
  const columns: Column<Lead>[] = [
    {
      key: 'name',
      header: 'Lead Name & Contact',
      sortable: true,
      render: l => (
        <div>
          <div className="lead-name-primary">{l.name}</div>
          <div className="lead-name-sub">{l.phone}</div>
        </div>
      ),
    },
    {
      key: 'email',
      header: 'Email',
      sortable: true,
      render: l => <span className="lead-text-muted">{l.email || '—'}</span>,
    },
    {
      key: 'investmentAmount',
      header: tenant?.slug === 'jamin' || tenant?.id === 't-jamin-02' ? 'Target Development / Budget' : 'Investment Amount Range',
      sortable: true,
      render: l => {
        const targetDev = l.targetDevelopment || l.customFields?.targetDevelopment || l.customFields?.preferredDevelopment;
        const budget =
          l.budgetRange ||
          l.customFields?.budgetRange ||
          l.customFields?.budget ||
          l.customFields?.targetBudget ||
          l.customFields?.investmentCapacity ||
          (l as any).investmentAmount;

        if (targetDev && budget) {
          return (
            <div>
              <div className="lead-investment-val" style={{ fontWeight: 600 }}>{targetDev}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{budget}</div>
            </div>
          );
        }

        if (targetDev) {
          return <span className="lead-investment-val" style={{ fontWeight: 600 }}>{targetDev}</span>;
        }

        if (budget) {
          return <span className="lead-investment-val">{budget}</span>;
        }

        return <span className="lead-text-muted">—</span>;
      },
    },
    {
      key: 'assignedAgent',
      header: 'Assigned Agent',
      sortable: true,
      render: l => {
        const name = l.assignedAgentName || '';
        const isInvalid = !name || name === 'Agent' || name === 'Unassigned';
        return <span className="lead-assigned-agent-val">{isInvalid ? '—' : name}</span>;
      },
    },
    {
      key: 'assignedAt',
      header: 'Assigned Date',
      sortable: true,
      render: l => {
        const raw = l.assignedAt || l.createdAt;
        if (!raw) return <span className="lead-text-muted">—</span>;
        const d = new Date(raw);
        const formatted = isNaN(d.getTime())
          ? raw
          : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
        return (
          <div className="lead-date-cell">
            <span className="lead-date-primary">{formatted}</span>
            {l.assignedAt && l.createdAt && l.assignedAt.slice(0, 10) !== l.createdAt.slice(0, 10) && (
              <span className="lead-date-sub">Created {l.createdAt.slice(0, 10)}</span>
            )}
          </div>
        );
      },
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: l => {
        if ((l.status as string) === 'Callback') {
          return (
            <span
              className="status-chip status-chip-callback"
              style={{
                backgroundColor: 'rgba(59, 130, 246, 0.12)',
                color: '#2563eb',
                borderColor: 'rgba(59, 130, 246, 0.3)',
                fontSize: '11px',
                padding: '2px 8px',
              }}
            >
              <span className="status-dot" style={{ backgroundColor: '#2563eb' }} />
              Callback
            </span>
          );
        }
        return <StatusChip status={l.status || 'New'} size="sm" />;
      },
    },
    {
      key: 'source',
      header: 'Source',
      sortable: true,
      render: l => <span className="lead-text-muted">{l.source || '—'}</span>,
    },
  ];

  const handleDeleteLead = async (lead: Lead) => {
    if (confirm(`Delete lead "${lead.name}"?`)) {
      try {
        const cleanId = String(lead.id).replace('db-', '').trim();
        const numericId = parseInt(cleanId, 10);
        if (!isNaN(numericId)) {
          await apiClient.delete(`/leads/${numericId}`).catch(async () => {
            await apiClient.delete(`/sales-executive/leads/${numericId}`);
          });
        }
      } catch (err) {
        console.error('Failed to delete lead from DB', err);
      }
      storageService.deleteLead(lead.id);
      storageService.addAuditLog({
        id: `aud-${Date.now()}`,
        timestamp: new Date().toISOString(),
        actorName: user?.name || 'Admin',
        actorEmail: user?.email || (isJamin ? 'admin@jaminbazaar.com' : 'admin@ghlindiaventures.com'),
        action: 'LEAD_DELETED',
        entityType: 'Lead',
        entityId: String(lead.id),
        companyId: tenant?.id,
        companyName: tenant?.name,
        details: `Deleted lead prospect ${lead.name} (Phone: ${lead.phone}).`,
      });
      setSelectedLead(null);
      setIsDetailDrawerOpen(false);
      setIsEditDrawerOpen(false);
      await loadData();
    }
  };

  const rowActions: RowAction<Lead>[] = [
    {
      label: 'Call Lead',
      icon: <Phone size={14} color="#10b981" className="leads-action-icon" />,
      onClick: l => initiateCall(l.name, l.phone, 'lead', l.id),
    },
    {
      label: 'View 360 Drawer',
      icon: <ExternalLink size={14} className="leads-action-icon" />,
      onClick: l => {
        setSelectedLead(l);
        setIsDetailDrawerOpen(true);
      },
    },
    {
      label: 'Edit Lead',
      icon: <Edit size={14} className="leads-action-icon" />,
      onClick: l => handleOpenEdit(l),
    },
    {
      label: 'Delete Lead',
      icon: <Trash2 size={14} color="#ef4444" className="leads-action-icon" />,
      danger: true,
      onClick: l => handleDeleteLead(l),
    },
  ];

  // Unique source options for the filter dropdown
  const uniqueSources = useMemo(() => {
    const sources = leads
      .map(l => l.source)
      .filter((s): s is string => Boolean(s));
    return Array.from(new Set(sources)).sort();
  }, [leads]);

  // Apply agent, status, source and date range filter on top of the full leads list
  const filteredLeads = useMemo(() => {
    return leads.filter(l => {
      // Hide converted leads by default — only show when status filter is explicitly 'Converted'
      if (statusFilter === 'All' && (l.status as string) === 'Converted') {
        return false;
      }
      if (statusFilter !== 'All' && (l.status as string) !== statusFilter) {
        return false;
      }

      // Source filter
      if (sourceFilter !== 'All' && l.source !== sourceFilter) {
        return false;
      }

      // 1. Agent filter
      if (agentFilter && agentFilter !== 'All' && l.assignedAgentName !== agentFilter) {
        return false;
      }

      // 2. Date range filter
      if (datePreset === 'all' && !dateFrom && !dateTo) {
        return true;
      }

      const leadDateStr = getLeadDateStr(l);
      if (!leadDateStr) {
        return datePreset === 'all';
      }

      if (dateFrom && leadDateStr < dateFrom) {
        return false;
      }
      if (dateTo && leadDateStr > dateTo) {
        return false;
      }

      return true;
    });
  }, [leads, statusFilter, sourceFilter, agentFilter, datePreset, dateFrom, dateTo]);

  return (
    <div className="leads-page assigned-leads-page">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <UserCheck size={24} color="var(--primary-600)" /> Assigned Leads
          </h1>
          <p className="page-subtitle">
            View all inbound prospects that have been assigned to sales agents for {tenant?.name}.
          </p>
        </div>
      </div>

      {/* Assigned Leads Table */}
      <DataTable
        columns={columns}
        data={filteredLeads}
        loading={isLoading}
        keyExtractor={l => l.id}
        rowActions={rowActions}
        onRowClick={l => {
          setSelectedLead(l);
          setIsDetailDrawerOpen(true);
        }}
        searchPlaceholder="Search assigned leads by name, phone, or agent..."
        searchFilter={(lead, query) =>
          lead.name.toLowerCase().includes(query) ||
          lead.phone.includes(query) ||
          (lead.assignedAgentName || '').toLowerCase().includes(query) ||
          (lead.email || '').toLowerCase().includes(query)
        }
        emptyTitle="No assigned leads found"
        emptyDescription="Leads assigned to agents will appear here."
        filtersNode={
          <FilterBar
            showLabel={!isJamin}
            hideItemLabels={isJamin}
            filters={[
              {
                key: 'status',
                label: 'Status',
                allLabel: isJamin ? 'All Statuses' : 'All',
                value: statusFilter,
                onChange: setStatusFilter,
                options: isJamin
                  ? [
                    { value: 'New', label: 'New' },
                    { value: 'Contacted', label: 'Contacted' },
                    { value: 'Interested', label: 'Interested' },
                    { value: 'Qualified', label: 'Qualified' },
                    { value: 'Follow-up Required', label: 'Follow-up Required' },
                    { value: 'Callback', label: 'Callback' },
                    { value: 'No Response', label: 'No Response' },
                    { value: 'Not Interested', label: 'Not Interested' },
                    { value: 'Junk', label: 'Junk' },
                    { value: 'Lost', label: 'Lost' },
                    { value: 'Converted', label: '✓ Converted' },
                  ]
                  : [
                    { value: 'New', label: 'New' },
                    { value: 'Contacted', label: 'Contacted' },
                    { value: 'Qualified', label: 'Qualified' },
                    { value: 'Proposal', label: 'Proposal' },
                    { value: 'Negotiation', label: 'Negotiation' },
                    { value: 'Interested', label: 'Interested' },
                    { value: 'Follow-up Required', label: 'Follow-up Required' },
                    { value: 'Callback', label: 'Callback' },
                    { value: 'No Response', label: 'No Response' },
                    { value: 'Not Interested', label: 'Not Interested' },
                    { value: 'Junk', label: 'Junk' },
                    { value: 'Lost', label: 'Lost' },
                    { value: 'Converted', label: '✓ Converted' },
                  ],
              },
              {
                key: 'source',
                label: 'Source',
                allLabel: isJamin ? 'All Sources' : 'All Sources',
                value: sourceFilter,
                onChange: setSourceFilter,
                options: uniqueSources.map(s => ({ value: s, label: s })),
              },
              ...(canManageAssignments ? [{
                key: 'assignedAgent',
                label: 'Assigned Agent',
                allLabel: isJamin ? 'All Agents' : 'All',
                value: agentFilter,
                onChange: setAgentFilter,
                placeholder: 'Select an agent',
                options: dynamicAgents.map(agent => ({ value: agent.name, label: agent.name })),
              }] : []),
            ]}
            dateRange={{
              preset: datePreset,
              onPresetChange: handleDatePresetChange,
              from: dateFrom,
              to: dateTo,
              onChange: handleCustomDateChange,
            }}
            onClearAll={() => {
              setStatusFilter('All');
              setSourceFilter('All');
              setAgentFilter('All');
              setDatePreset('all');
              setDateFrom('');
              setDateTo('');
            }}
          />
        }
      />

      {/* 360 Detail Drawer */}
      <Drawer
        isOpen={isDetailDrawerOpen && !!selectedLead}
        onClose={() => setIsDetailDrawerOpen(false)}
        title={selectedLead?.name || 'Lead Overview'}
        subtitle={`${selectedLead?.phone} • Created on ${selectedLead?.createdAt}`}
        width={580}
        footer={
          <>
            <button
              className="btn btn-secondary"
              onClick={() => {
                setIsDetailDrawerOpen(false);
                if (selectedLead) handleOpenEdit(selectedLead);
              }}
            >
              <Edit size={14} /> Edit Record
            </button>
            <button
              className="btn btn-call"
              onClick={() => {
                if (selectedLead) initiateCall(selectedLead.name, selectedLead.phone, 'lead', selectedLead.id);
              }}
            >
              <Phone size={14} /> Call Lead
            </button>
          </>
        }
      >
        {selectedLead && (
          <>
            {/* Quick Info Banner */}
            <div className="lead-quick-banner" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="lead-assigned-note">
                Assigned to <strong>{(!selectedLead.assignedAgentName || selectedLead.assignedAgentName === 'Unassigned' || selectedLead.assignedAgentName === 'Agent') ? 'Unassigned' : selectedLead.assignedAgentName}</strong>
              </div>
              <div>
                <StatusChip status={selectedLead.status || 'New'} size="sm" />
              </div>
            </div>

            {/* Core Details */}
            <div className="card lead-detail-card">
              <h4 className="lead-detail-title">
                Contact & Profile Details
              </h4>
              <div className="lead-detail-grid">
                <div>
                  <span className="lead-detail-label">Email:</span>
                  <div className="lead-detail-value">{selectedLead.email || '—'}</div>
                </div>
                <div>
                  <span className="lead-detail-label">Location:</span>
                  <div className="lead-detail-value">{selectedLead.location || '—'}</div>
                </div>
                <div>
                  <span className="lead-detail-label">Lead Source:</span>
                  <div className="lead-detail-value">{selectedLead.source || '—'}</div>
                </div>
                <div>
                  <span className="lead-detail-label">Follow-up:</span>
                  <div className="lead-detail-value lead-followup-text has-date">
                    {selectedLead.nextFollowupDate || 'Not scheduled'}
                  </div>
                </div>
              </div>
            </div>

            {/* Tenant-Specific Attributes (Jamin Property Requirements vs GHL Custom Attributes) */}
            {isJamin ? (
              <div className="card lead-custom-card">
                <h4 className="lead-custom-title">
                  Requirements &amp; Project Preferences
                </h4>
                <div className="lead-detail-grid">
                  <div>
                    <span className="lead-custom-label">Target Development / Project:</span>
                    <div className="lead-custom-value" style={{ fontWeight: 600, color: 'var(--primary-600)' }}>
                      {selectedLead.targetDevelopment || (selectedLead.customFields as any)?.targetDevelopment || '—'}
                    </div>
                  </div>
                  <div>
                    <span className="lead-custom-label">Plot Budget Range:</span>
                    <div className="lead-custom-value" style={{ fontWeight: 700, color: '#059669' }}>
                      {selectedLead.budgetRange || (selectedLead.customFields as any)?.budgetRange || '—'}
                    </div>
                  </div>
                  <div>
                    <span className="lead-custom-label">Ready to Register / Timeline:</span>
                    <div className="lead-custom-value">
                      {selectedLead.readyToRegister || (selectedLead.customFields as any)?.readyToRegister || '—'}
                    </div>
                  </div>
                </div>
              </div>
            ) : (() => {
              const activeDefs = storageService
                .getCustomFieldDefinitions(tenant?.id)
                .filter(d => d.active !== false && (d.module === 'leads' || !d.module))
                .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));

              const rows = activeDefs
                .map(def => {
                  const key = def.fieldKey || def.id;
                  const val = selectedLead.customFields?.[key];
                  if (val === undefined || val === null || val === '') return null;
                  return {
                    id: def.id,
                    label: def.label || key.replace(/([A-Z])/g, ' $1'),
                    value: String(val),
                  };
                })
                .filter(Boolean);

              if (rows.length === 0) return null;

              return (
                <div className="card lead-custom-card">
                  <h4 className="lead-custom-title">
                    {tenant?.name} Custom Attributes
                  </h4>
                  <div className="lead-detail-grid">
                    {rows.map(item => (
                      <div key={item!.id}>
                        <span className="lead-custom-label">
                          {item!.label}:
                        </span>
                        <div className="lead-custom-value">{item!.value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Notes */}
            {selectedLead.notes && (
              <div className="card lead-custom-card">
                <h4 className="lead-custom-title">Notes</h4>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>
                  {selectedLead.notes}
                </div>
              </div>
            )}
          </>
        )}
      </Drawer>

      {/* Edit Drawer */}
      <Drawer
        isOpen={isEditDrawerOpen}
        onClose={() => setIsEditDrawerOpen(false)}
        title={formData.id ? 'Edit Assigned Lead' : 'Lead Details'}
        subtitle={formData.name || ''}
        width={500}
        footer={
          <>
            <button
              className="btn btn-secondary"
              onClick={() => setIsEditDrawerOpen(false)}
            >
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleSaveLead}>
              Save Changes
            </button>
          </>
        }
      >
        <form onSubmit={handleSaveLead} className="lead-form">
          <div className="form-group">
            <label className="form-label">Full Name *</label>
            <input
              type="text"
              required
              className="form-input"
              value={formData.name || ''}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. Ramesh Kumar"
            />
          </div>

          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label">Phone *</label>
              <input
                type="tel"
                required
                className="form-input"
                value={formData.phone || ''}
                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+91 98450 00000"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input
                type="email"
                className="form-input"
                value={formData.email || ''}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
                placeholder="ramesh@gmail.com"
              />
            </div>
          </div>

          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label">Location / City</label>
              <input
                type="text"
                className="form-input"
                value={formData.location || ''}
                onChange={e => setFormData({ ...formData, location: e.target.value })}
                placeholder="e.g. Bangalore"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Lead Source</label>
              <select
                className="form-select"
                value={formData.source || 'Website Inbound'}
                onChange={e => setFormData({ ...formData, source: e.target.value })}
              >
                <option value="Website Inbound">Website Inbound</option>
                <option value="Google Search">Google Search</option>
                <option value="Facebook Ad">Facebook Ad</option>
                <option value="Referral">Referral</option>
                <option value="Event / Expo">Event / Expo</option>
                <option value="Cold Call">Cold Call</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Assigned Agent</label>
            {canManageAssignments ? (
              <select
                className="form-select"
                value={formData.assignedAgentName || ''}
                onChange={handleAgentChange}
              >
                {!formData.assignedAgentName && <option value="">Select Agent</option>}
                {agentOptions.map(agent => (
                  <option key={agent.id} value={agent.name}>{agent.name}</option>
                ))}
              </select>
            ) : (
              <input className="form-input" value={formData.assignedAgentName || user?.name || ''} disabled />
            )}
          </div>

          <div className="form-group">
            <label className="form-label">Notes & Requirements</label>
            <textarea
              className="form-textarea"
              rows={3}
              value={formData.notes || ''}
              onChange={e => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Client background, key objections, time horizon..."
            />
          </div>
        </form>
      </Drawer>

      {/* Reassign Confirmation Modal */}
      <Modal
        isOpen={isReassignConfirmOpen}
        onClose={handleCancelReassign}
        title="Confirm Lead Reassignment"
        maxWidth={460}
        footer={
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', width: '100%' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleCancelReassign}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleConfirmReassign}
            >
              Confirm
            </button>
          </div>
        }
      >
        <p style={{ margin: '16px 0', fontSize: '14px', lineHeight: 1.5, color: 'var(--text-secondary)' }}>
          Reassign this lead to <strong>{pendingAgent?.name}</strong>? This will change the assigned agent from{' '}
          <strong>{formData.assignedAgentName || 'Unassigned'}</strong> to{' '}
          <strong>{pendingAgent?.name}</strong>.
        </p>
      </Modal>
    </div>
  );
};
