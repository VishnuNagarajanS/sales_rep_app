import React, { useState, useEffect, useMemo } from 'react';
import {
  UserCheck,
  Phone,
  Edit,
  ExternalLink,
  Users,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { Lead, CustomFieldDefinition } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useCall } from '../../context/CallContext';
import { storageService } from '../../services/storageService';
import { getLeads, saveLead as apiSaveLead } from '../../services/ghlApiService';
import { isMockMode } from '../../config/environment';
import { DataTable, Column, RowAction } from '../../components/common/DataTable';
import { FilterBar } from '../../components/common/FilterBar';
import { Drawer } from '../../components/common/Drawer';
import { Modal } from '../../components/common/Modal';
import { getAuthHeaders } from '../../utils/authHeaders';

import './AssignedLeadsPage.css';

const getCustomFieldDefinitions = (tenantId?: string): CustomFieldDefinition[] => {
  try {
    const raw = localStorage.getItem('nexus_custom_fields');
    const all: CustomFieldDefinition[] = raw ? JSON.parse(raw) : [];
    return tenantId ? all.filter(d => !d.companyId || d.companyId === tenantId) : all;
  } catch {
    return [];
  }
};
export const AssignedLeadsPage: React.FC = () => {
  const { tenant, user } = useAuth();
  const { initiateCall } = useCall();

  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isDetailDrawerOpen, setIsDetailDrawerOpen] = useState(false);
  const [isEditDrawerOpen, setIsEditDrawerOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<Lead>>({});
  const [agentFilter, setAgentFilter] = useState<string>('All');
  const [datePreset, setDatePreset] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  // Agent reassignment confirmation state for Edit panel
  const [pendingAgent, setPendingAgent] = useState<{ id: string | number; name: string } | null>(null);
  const [isReassignConfirmOpen, setIsReassignConfirmOpen] = useState(false);

  const roleCode = user?.role?.code;
  const isGhlAdmin =
    (tenant?.slug === 'ghl' || tenant?.id === 't-ghl-01') &&
    (roleCode === 'company_admin' || (roleCode as string) === 'admin' || roleCode === 'super_admin');

  const isAdmin =
    isGhlAdmin ||
    roleCode === 'company_admin' ||
    (roleCode as string) === 'admin' ||
    roleCode === 'super_admin' ||
    (roleCode as string) === 'sales_manager';

  // IRM Coverage & Reassignment states
  const [activeCoverages, setActiveCoverages] = useState<any[]>([]);
  const [isCoverageModalOpen, setIsCoverageModalOpen] = useState(false);
  const [coverageTab, setCoverageTab] = useState<'assign' | 'active'>('assign');
  const [fromIrmId, setFromIrmId] = useState('');
  const [toIrmId, setToIrmId] = useState('');
  const [coverageReason, setCoverageReason] = useState('');
  const [isSubmittingCoverage, setIsSubmittingCoverage] = useState(false);
  const [coverageMessage, setCoverageMessage] = useState<string | null>(null);
  const [coverageError, setCoverageError] = useState<string | null>(null);

  const loadActiveCoverages = async () => {
    try {
      const res = await fetch('/api/irm/admin/coverage/active', {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const json = await res.json();
        if (json?.data) {
          setActiveCoverages(json.data);
        }
      }
    } catch (e) {
      console.error('Failed to load active coverages', e);
    }
  };

  const handleReassignWork = async () => {
    setCoverageError(null);
    setCoverageMessage(null);
    if (!fromIrmId || !toIrmId) {
      setCoverageError('Please select both the absent IRM and covering IRM.');
      return;
    }
    if (fromIrmId === toIrmId) {
      setCoverageError('Source IRM and Covering IRM cannot be the same person.');
      return;
    }

    setIsSubmittingCoverage(true);
    try {
      const res = await fetch('/api/irm/admin/reassign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          fromIrmId: Number(fromIrmId),
          toIrmId: Number(toIrmId),
          reason: coverageReason.trim() || 'Temporary coverage assignment',
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setCoverageError(json?.message || 'Failed to reassign work.');
      } else {
        setCoverageMessage(
          `Reassigned ${json.data.reassignedLeadsCount} leads, ${json.data.reassignedFollowupsCount} follow-ups, ${json.data.reassignedKycsCount} KYCs, ${json.data.reassignedDealsCount} deals to ${json.data.toIrmName}.`
        );
        setFromIrmId('');
        setToIrmId('');
        setCoverageReason('');
        await loadActiveCoverages();
        await loadData();
      }
    } catch (e: any) {
      setCoverageError(e.message || 'An error occurred during reassignment.');
    } finally {
      setIsSubmittingCoverage(false);
    }
  };

  const handleEndCoverage = async (coverageId: number) => {
    try {
      const res = await fetch('/api/irm/admin/coverage/end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ coverageId }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        await loadActiveCoverages();
        await loadData();
      }
    } catch (e) {
      console.error('Failed to end coverage', e);
    }
  };

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
    try {
      let allLeads: Lead[] = [];
      if (isMockMode()) {
        allLeads = storageService.getLeads(tenant?.id);
      } else {
        try {
          allLeads = await getLeads(tenant?.id);
        } catch {
          allLeads = [];
        }
      }

      // Merge any mock assignments from session storage if present
      let sessionAssignments: Array<{ leadId: string; agentId: number | string; agentName: string }> = [];
      try {
        const raw = sessionStorage.getItem('ghl_mock_agent_assignments');
        if (raw) sessionAssignments = JSON.parse(raw);
      } catch { }

      const assigned = allLeads
        .map(lead => {
          const sessionAssigned = sessionAssignments.find(a => a.leadId === lead.id);
          if (sessionAssigned) {
            return {
              ...lead,
              assignedAgentId: String(sessionAssigned.agentId),
              assignedAgentName: sessionAssigned.agentName,
            };
          }
          return lead;
        })
        .filter(lead => (lead as any).assignmentStatus === 'assigned' || Boolean(lead.assignedAgentId));

      setLeads(assigned);
      setSelectedLead(prev => {
        if (!prev) return null;
        return assigned.find(l => l.id === prev.id) || null;
      });
    } catch (err) {
      console.error('Failed to load assigned leads', err);
    }
  };

  useEffect(() => {
    loadData();
    let timeoutId: any;
    const handleUpdate = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        loadData();
      }, 300);
    };
    window.addEventListener('nexus_storage_updated', handleUpdate);
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('nexus_storage_updated', handleUpdate);
    };
  }, [tenant?.id]);

  const handleOpenEdit = (lead: Lead) => {
    setFormData({ ...lead });
    setPendingAgent(null);
    setIsReassignConfirmOpen(false);
    setIsEditDrawerOpen(true);
  };

  // Populate agent options from storageService, ensuring the current assigned agent is included
  const agentOptions = useMemo<Array<{ id: string | number; name: string }>>(() => {
    const list: Array<{ id: string | number; name: string }> = [...storageService.getAgents(tenant?.id)];
    if (formData.assignedAgentName && !list.some(a => a.name.toLowerCase() === formData.assignedAgentName?.toLowerCase())) {
      list.unshift({ id: 'current', name: formData.assignedAgentName });
    }
    return list;
  }, [formData.assignedAgentName]);

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

    if (isMockMode()) {
      storageService.saveLead(leadToSave);
      loadData();
    } else {
      apiSaveLead(leadToSave)
        .then(() => {
          storageService.saveLead(leadToSave);
          loadData();
        })
        .catch(() => {
          storageService.saveLead(leadToSave);
          loadData();
        });
    }

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
    } catch {}

    setIsEditDrawerOpen(false);
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
      header: 'Investment Amount Range',
      sortable: true,
      render: l => {
        const amount =
          l.customFields?.investmentCapacity ||
          l.customFields?.budgetRange ||
          (l as any).investmentAmount ||
          '—';
        return <span className="lead-investment-val">{amount}</span>;
      },
    },
    {
      key: 'assignedAgent',
      header: 'Assigned Agent',
      sortable: true,
      render: l => (
        <span className="lead-assigned-agent-val">{l.assignedAgentName || '—'}</span>
      ),
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
      key: 'source',
      header: 'Source',
      sortable: true,
      render: l => <span className="lead-text-muted">{l.source || '—'}</span>,
    },
    {
      key: 'quickCall',
      header: 'Quick Call',
      align: 'center',
      render: l => (
        <div className="lead-quick-call-cell">
          <button
            className="btn btn-call btn-sm btn-icon customer-list-call-btn"
            title={`Call ${l.name}`}
            aria-label={`Call ${l.name}`}
            onClick={e => {
              e.stopPropagation();
              initiateCall(l.name, l.phone, 'lead', l.id);
            }}
          >
            <Phone size={12} color="#ffffff" />
          </button>
        </div>
      ),
    },
  ];

  const rowActions: RowAction<Lead>[] = [
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
  ];

  // Unique agent names for the filter dropdown
  const uniqueAgents = useMemo(() => {
    const names = leads
      .map(l => l.assignedAgentName)
      .filter((n): n is string => Boolean(n));
    return Array.from(new Set(names)).sort();
  }, [leads]);

  // Apply agent and date range filter on top of the full leads list
  const filteredLeads = useMemo(() => {
    return leads.filter(l => {
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
  }, [leads, agentFilter, datePreset, dateFrom, dateTo]);

  if (!isGhlAdmin) {
    return (
      <div className="assigned-leads-unauthorized">
        <h3>Access Restricted</h3>
        <p>This module is only accessible to GHL India Ventures Company Admin.</p>
      </div>
    );
  }

  return (
    <div className="leads-page assigned-leads-page">
      {/* Header */}
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 className="page-title">
            <UserCheck size={24} color="var(--primary-600)" /> Assigned Leads
          </h1>
          <p className="page-subtitle">
            View all inbound prospects that have been assigned to sales agents for {tenant?.name}.
          </p>
        </div>
        {isAdmin && (
          <div>
            <button
              className="btn btn-secondary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13 }}
              onClick={() => {
                setIsCoverageModalOpen(true);
                loadActiveCoverages();
              }}
            >
              <Users size={15} /> IRM Coverage &amp; Reassignment
            </button>
          </div>
        )}
      </div>

      {/* Assigned Leads Table */}
      <DataTable
        columns={columns}
        data={filteredLeads}
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
            filters={[
              {
                key: 'assignedAgent',
                label: 'Assigned Agent',
                value: agentFilter,
                onChange: setAgentFilter,
                placeholder: 'Select an agent',
                options: uniqueAgents.map(name => ({ value: name, label: name })),
              },
            ]}
            dateRange={{
              preset: datePreset,
              onPresetChange: handleDatePresetChange,
              from: dateFrom,
              to: dateTo,
              onChange: handleCustomDateChange,
            }}
            onClearAll={() => {
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
            <div className="lead-quick-banner">
              <div className="lead-assigned-note">
                Assigned : <strong>{selectedLead.assignedAgentName || 'Unassigned'}</strong>
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

            {/* Tenant-Specific Dynamic Custom Fields */}
            {(() => {
              const activeDefs = (storageService.getCustomFieldDefinitions
                ? storageService.getCustomFieldDefinitions(tenant?.id)
                : getCustomFieldDefinitions(tenant?.id)
              )
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
            <select
              className="form-select"
              value={formData.assignedAgentName || ''}
              onChange={handleAgentChange}
            >
              {!formData.assignedAgentName && <option value="">Select Agent</option>}
              {agentOptions.map(agent => (
                <option key={agent.id} value={agent.name}>
                  {agent.name}
                </option>
              ))}
            </select>
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

      {/* Admin IRM Coverage & Reassignment Modal */}
      <Modal
        isOpen={isCoverageModalOpen}
        onClose={() => setIsCoverageModalOpen(false)}
        title="Admin IRM Coverage & Work Reassignment"
        subtitle="Temporarily assign an absent IRM's open records to a covering IRM with reversible audit trail."
        maxWidth={700}
      >
        <div style={{ padding: '4px 0' }}>
          {/* Tabs */}
          <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid var(--border-color)', marginBottom: 16 }}>
            <button
              className={`btn btn-sm ${coverageTab === 'assign' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setCoverageTab('assign')}
            >
              Assign Coverage
            </button>
            <button
              className={`btn btn-sm ${coverageTab === 'active' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => {
                setCoverageTab('active');
                loadActiveCoverages();
              }}
            >
              Active Coverages ({activeCoverages.length})
            </button>
          </div>

          {coverageError && (
            <div style={{ padding: '8px 12px', borderRadius: 6, backgroundColor: 'rgba(239,68,68,0.1)', color: '#dc2626', fontSize: 13, marginBottom: 14 }}>
              ⚠️ {coverageError}
            </div>
          )}

          {coverageMessage && (
            <div style={{ padding: '8px 12px', borderRadius: 6, backgroundColor: 'rgba(16,185,129,0.1)', color: '#059669', fontSize: 13, marginBottom: 14 }}>
              ✓ {coverageMessage}
            </div>
          )}

          {coverageTab === 'assign' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Absent IRM (Source) *</label>
                  <select
                    className="form-select"
                    value={fromIrmId}
                    onChange={e => setFromIrmId(e.target.value)}
                  >
                    <option value="">— Select Absent IRM —</option>
                    {agentOptions.filter(a => a.id !== 'current').map(a => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Covering IRM (Destination) *</label>
                  <select
                    className="form-select"
                    value={toIrmId}
                    onChange={e => setToIrmId(e.target.value)}
                  >
                    <option value="">— Select Covering IRM —</option>
                    {agentOptions.filter(a => a.id !== 'current' && String(a.id) !== fromIrmId).map(a => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Reason for Coverage</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Annual leave coverage until Monday"
                  value={coverageReason}
                  onChange={e => setCoverageReason(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsCoverageModalOpen(false)}
                >
                  Close
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={isSubmittingCoverage || !fromIrmId || !toIrmId}
                  onClick={handleReassignWork}
                >
                  {isSubmittingCoverage ? 'Reassigning...' : 'Assign Coverage'}
                </button>
              </div>
            </div>
          ) : (
            <div>
              {activeCoverages.length === 0 ? (
                <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
                  No active coverage assignments for this organization.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {activeCoverages.map((c: any) => (
                    <div
                      key={c.id}
                      style={{
                        padding: '12px 14px',
                        borderRadius: 8,
                        border: '1px solid var(--border-color)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        backgroundColor: 'var(--bg-card)'
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>
                          {c.originalIrmName} ➔ Covering: {c.coveringIrmName}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                          Reason: {c.reason || 'None specified'} • Started: {new Date(c.startedAt).toLocaleDateString()}
                        </div>
                      </div>
                      <button
                        className="btn btn-secondary btn-sm"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                        onClick={() => handleEndCoverage(c.id)}
                      >
                        <RotateCcw size={13} /> End &amp; Revert
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};