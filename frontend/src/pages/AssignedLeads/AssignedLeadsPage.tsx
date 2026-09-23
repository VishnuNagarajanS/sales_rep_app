import React, { useState, useEffect, useMemo } from 'react';
import {
  UserCheck,
  Phone,
  Edit,
  ExternalLink,
} from 'lucide-react';
import { Lead } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useCall } from '../../context/CallContext';
import { storageService } from '../../services/storageService';
import { DataTable, Column, RowAction } from '../../components/common/DataTable';
import { Drawer } from '../../components/common/Drawer';
import './AssignedLeadsPage.css';

export const AssignedLeadsPage: React.FC = () => {
  const { tenant, user } = useAuth();
  const { initiateCall } = useCall();

  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isDetailDrawerOpen, setIsDetailDrawerOpen] = useState(false);
  const [isEditDrawerOpen, setIsEditDrawerOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<Lead>>({});
  const [agentFilter, setAgentFilter] = useState<string>('');

  const roleCode = user?.role?.code;
  const isGhlAdmin =
    (tenant?.slug === 'ghl' || tenant?.id === 't-ghl-01') &&
    (roleCode === 'company_admin' || (roleCode as string) === 'admin' || roleCode === 'super_admin');

  const loadData = () => {
    const allLeads = storageService.getLeads(tenant?.id);

    // Merge any mock assignments from session storage if present
    let sessionAssignments: Array<{ leadId: string; agentId: number; agentName: string }> = [];
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
  };

  useEffect(() => {
    loadData();
    const handleUpdate = () => loadData();
    window.addEventListener('nexus_storage_updated', handleUpdate);
    return () => window.removeEventListener('nexus_storage_updated', handleUpdate);
  }, [tenant?.id]);

  const handleOpenEdit = (lead: Lead) => {
    setFormData({ ...lead });
    setIsEditDrawerOpen(true);
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

  // Apply agent filter on top of the full leads list
  const filteredLeads = useMemo(() => {
    if (!agentFilter) return leads;
    return leads.filter(l => l.assignedAgentName === agentFilter);
  }, [leads, agentFilter]);

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
          uniqueAgents.length > 0 ? (
            <select
              className="form-select"
              style={{ height: 38, fontSize: 13, width: 'auto', flexShrink: 0 }}
              value={agentFilter}
              onChange={e => setAgentFilter(e.target.value)}
            >
              <option value="">All Agents</option>
              {uniqueAgents.map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          ) : undefined
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
                Assigned to <strong>{selectedLead.assignedAgentName || 'Unassigned'}</strong>
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
            <input
              type="text"
              className="form-input"
              value={formData.assignedAgentName || ''}
              onChange={e => setFormData({ ...formData, assignedAgentName: e.target.value })}
              placeholder="Agent Name"
            />
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
    </div>
  );
};