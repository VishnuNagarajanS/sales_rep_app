import React, { useState, useEffect } from 'react';
import {
  Building2,
  Phone,
  Plus,
  Play,
  ExternalLink,
  Filter,
} from 'lucide-react';
import { Customer, CallRecord, Followup, Deal } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useCall } from '../../context/CallContext';
import { storageService } from '../../services/storageService';
import { StatusChip } from '../../components/common/StatusChip';
import { Timeline, TimelineEvent } from '../../components/common/Timeline';
import { DocumentUploader } from '../../components/common/DocumentUploader';
import { DocumentList } from '../../components/common/DocumentList';
import { Modal } from '../../components/common/Modal';
import './CustomersPage.css';

export const CustomersPage: React.FC = () => {
  const { tenant, user } = useAuth();
  const { initiateCall } = useCall();

  const [customers, setCustomers] = useState<Customer[]>([]);

  // Role-based scoping: Sales Executives see only their own customers.
  // Managers / Admins / Super Admins see the full company customer list (no filter).
  const roleCode = user?.role?.code;
  const isExec = roleCode === 'sales_executive';
  const scopedCustomers = isExec
    ? customers.filter(c =>
      (c.assignedAgentId && c.assignedAgentId === user?.id) ||
      (c.assignedAgentName && c.assignedAgentName === user?.name)
    )
    : customers;
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'calls' | 'followups' | 'deals' | 'timeline' | 'documents'>('overview');
  const [statusFilter, setStatusFilter] = useState('All');
  const [agentFilter, setAgentFilter] = useState('All');

  // New Customer modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [newStatus, setNewStatus] = useState<'Active' | 'VIP' | 'Inactive'>('Active');
  const [newCustomFields, setNewCustomFields] = useState<Record<string, any>>({});
  const [addErrors, setAddErrors] = useState<{ name?: string; phone?: string }>({});

  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [followups, setFollowups] = useState<Followup[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);

  const loadData = () => {
    const custs = storageService.getCustomers(tenant?.id);
    setCustomers(custs);
    // Auto-select from the scoped list so an exec doesn't land on a customer
    // that is invisible in their own filtered left-panel list.
    const firstVisible = isExec
      ? custs.filter(c =>
        (c.assignedAgentId && c.assignedAgentId === user?.id) ||
        (c.assignedAgentName && c.assignedAgentName === user?.name)
      )[0]
      : custs[0];
    if (firstVisible && !selectedCustomer) {
      setSelectedCustomer(firstVisible);
    }
    setCalls(storageService.getCalls(tenant?.id));
    setFollowups(storageService.getFollowups(tenant?.id));
    setDeals(storageService.getDeals(tenant?.id));
  };

  useEffect(() => {
    loadData();
    const handleUpdate = () => loadData();
    window.addEventListener('nexus_storage_updated', handleUpdate);
    return () => window.removeEventListener('nexus_storage_updated', handleUpdate);
  }, [tenant?.id]);

  const agentOptions = Array.from(new Set(scopedCustomers.map(c => c.assignedAgentName)))
    .filter(Boolean)
    .map(name => ({ value: name, label: name }));

  const filteredCustomers = scopedCustomers.filter(c => {
    if (statusFilter !== 'All' && c.status !== statusFilter) return false;
    if (agentFilter !== 'All' && c.assignedAgentName !== agentFilter) return false;
    return true;
  });

  // Filter linked records for selected customer
  const customerCalls = calls.filter(
    c => selectedCustomer && (c.contactPhone === selectedCustomer.phone || c.contactName === selectedCustomer.name)
  );

  const customerFollowups = followups.filter(
    f => selectedCustomer && (f.contactPhone === selectedCustomer.phone || f.contactName === selectedCustomer.name)
  );

  const customerDeals = deals.filter(
    d => selectedCustomer && (d.customerId === selectedCustomer.id || d.customerName === selectedCustomer.name)
  );

  const resetAddForm = () => {
    setNewName('');
    setNewPhone('');
    setNewEmail('');
    setNewLocation('');
    setNewStatus('Active');
    setNewCustomFields({});
    setAddErrors({});
  };

  const handleAddCustomer = () => {
    const errors: { name?: string; phone?: string } = {};
    if (!newName.trim()) errors.name = 'Name is required.';
    if (!newPhone.trim()) errors.phone = 'Phone is required.';
    if (Object.keys(errors).length > 0) {
      setAddErrors(errors);
      return;
    }
    const newCustomer: import('../../types').Customer = {
      id: `cust-${Date.now()}`,
      companyId: tenant?.id || '',
      name: newName.trim(),
      phone: newPhone.trim(),
      email: newEmail.trim(),
      status: newStatus,
      assignedAgentId: user?.id || '',
      assignedAgentName: user?.name || '',
      location: newLocation.trim(),
      lastContacted: new Date().toISOString().split('T')[0],
      openDealsCount: 0,
      totalValue: 0,
      createdAt: new Date().toISOString().split('T')[0],
      notes: '',
      customFields: newCustomFields,
    };
    storageService.saveCustomer(newCustomer);
    setIsAddModalOpen(false);
    resetAddForm();
    setSelectedCustomer(newCustomer);
  };

  const formatCurrency = (val: number) => {
    if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`;
    if (val >= 100000) return `₹${(val / 100000).toFixed(1)} L`;
    return `₹${val.toLocaleString('en-IN')}`;
  };

  const rawEvents: TimelineEvent[] = [];

  if (selectedCustomer) {
    customerCalls.forEach(c => {
      rawEvents.push({
        id: c.id,
        type: 'call',
        title: `${c.direction === 'outbound' ? 'Outbound' : 'Inbound'} Call — ${c.disposition}`,
        description: c.transcription || undefined,
        timestamp: c.timestamp,
        actorName: c.agentName,
      });
    });

    customerFollowups.forEach(f => {
      rawEvents.push({
        id: f.id,
        type: 'followup',
        title: f.status === 'Completed' ? 'Follow-up Completed' : 'Follow-up Scheduled',
        description: f.notes,
        timestamp: f.scheduledAt,
        actorName: f.assignedAgentName,
      });
    });

    customerDeals.forEach(d => {
      rawEvents.push({
        id: d.id,
        type: 'status_change',
        title: `Deal Created — ${d.title}`,
        description: `Stage: ${d.stage} • Value: ${formatCurrency(d.value)}`,
        timestamp: d.createdAt,
        actorName: d.assignedAgentName,
      });
    });

    rawEvents.push({
      id: `ev-create-${selectedCustomer.id}`,
      type: 'note',
      title: 'Customer Account Created',
      timestamp: selectedCustomer.createdAt,
      actorName: selectedCustomer.assignedAgentName,
    });
  }

  const timelineEvents = rawEvents.sort((a, b) => {
    const parseTime = (ts: string) => {
      const parsed = Date.parse(ts);
      return isNaN(parsed) ? Number.MAX_SAFE_INTEGER : parsed;
    };
    return parseTime(b.timestamp) - parseTime(a.timestamp);
  });

  return (
    <div className="customers-page">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <Building2 size={24} color="var(--primary-600)" /> Customer 360 Profile
          </h1>
          <p className="page-subtitle">
            Unified contact view across calls, deals, timeline, and documents for {tenant?.name}.
          </p>
        </div>
      </div>

      {/* Customer 360 Split View: List on left, Full 360 on right */}
      <div className="customers-split-layout">
        {/* Left: Customer Directory */}
        <div className="customers-sidebar">
          <div className="card customers-sidebar-card">
            <div className="customers-sidebar-header">
              <h3 className="customers-sidebar-title">Customer Accounts</h3>
              <button
                className="btn btn-primary btn-sm customers-btn-new"
                onClick={() => { resetAddForm(); setIsAddModalOpen(true); }}
              >
                <Plus size={13} /> New Customer
              </button>
            </div>

            <div className="customers-filter-row">
              {/* Filters Label */}
              <span className="customers-filter-label">
                <Filter size={13} />
                Filters:
              </span>

              {/* Status Filter */}
              <div className="customers-filter-group">
                <label
                  htmlFor="filter-customer-status"
                  className="customers-filter-tag"
                >
                  Status:
                </label>
                <select
                  id="filter-customer-status"
                  className={`form-select customers-filter-select ${statusFilter !== 'All' && statusFilter !== '' ? 'is-filtered' : ''}`}
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                >
                  <option value="All">All</option>
                  <option value="Active">Active</option>
                  <option value="VIP">VIP</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>

              {/* Agent Filter */}
              {!isExec && (
              <div className="customers-filter-group">
                <label
                  htmlFor="filter-customer-agent"
                  className="customers-filter-tag"
                >
                  Agent:
                </label>
                <select
                  id="filter-customer-agent"
                  className={`form-select customers-filter-select ${agentFilter !== 'All' && agentFilter !== '' ? 'is-filtered' : ''}`}
                  value={agentFilter}
                  onChange={e => setAgentFilter(e.target.value)}
                >
                  <option value="All">All</option>
                  {agentOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              )}
            </div>
            <div className="customers-list">
              {filteredCustomers.map(c => {
                const isSelected = selectedCustomer?.id === c.id;
                return (
                  <div
                    key={c.id}
                    onClick={() => setSelectedCustomer(c)}
                    className={`customer-list-item ${isSelected ? 'is-selected' : ''}`}
                  >
                    <div className="customer-list-item-top">
                      <div className="customer-list-name">
                        {c.name}
                      </div>
                      <StatusChip status={c.status} size="sm" />
                    </div>
                    <div className="customer-list-sub">
                      {c.phone} • {c.location}
                    </div>
                    <div className="customer-list-bottom">
                      <span className="customer-list-val">
                        {formatCurrency(c.totalValue || 0)}
                      </span>
                      <button
                        className="btn btn-call btn-sm btn-icon customer-list-call-btn"
                        onClick={e => {
                          e.stopPropagation();
                          initiateCall(c.name, c.phone, 'customer', c.id);
                        }}
                      >
                        <Phone size={12} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right: Full 360 Cockpit */}
        {selectedCustomer ? (
          <div className="card customer-cockpit-card">
            {/* 360 Header */}
            <div className="customer-cockpit-header">
              <div>
                <div className="customer-cockpit-name-row">
                  <h2 className="customer-cockpit-name">{selectedCustomer.name}</h2>
                  <StatusChip status={selectedCustomer.status} />
                </div>
                <div className="customer-cockpit-meta-row">
                  <span>📞 {selectedCustomer.phone}</span>
                  {selectedCustomer.email && <span>✉️ {selectedCustomer.email}</span>}
                  <span>📍 {selectedCustomer.location}</span>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="customer-cockpit-actions">
                <button
                  className="btn btn-primary customer-call-btn"
                  onClick={() => initiateCall(selectedCustomer.name, selectedCustomer.phone, 'customer', selectedCustomer.id)}
                >
                  <Phone size={15} /> Click to Call
                </button>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="customer-tabs-bar">
              {[
                { id: 'overview', label: 'Overview' },
                { id: 'calls', label: `Calls (${customerCalls.length})` },
                { id: 'followups', label: `Follow-ups (${customerFollowups.length})` },
                { id: 'deals', label: `Deals (${customerDeals.length})` },
                { id: 'timeline', label: 'Activity Timeline' },
                { id: 'documents', label: 'Documents' },
              ].map(tab => (
                <button
                  key={tab.id}
                  className={`customer-tab-btn ${activeTab === tab.id ? 'is-active' : ''}`}
                  onClick={() => setActiveTab(tab.id as any)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab Contents */}
            <div className="customer-tab-content">
              {activeTab === 'overview' && (
                <div className="customer-overview-stack">
                  <div className="card customer-profile-card">
                    <h4 className="customer-section-heading">
                      Account & Commercial Profile
                    </h4>
                    <div className="customer-profile-grid">
                      <div>
                        <span className="customer-profile-label">Assigned Account Manager:</span>
                        <div className="customer-profile-val">{selectedCustomer.assignedAgentName}</div>
                      </div>
                      <div>
                        <span className="customer-profile-label">Total Committed Value:</span>
                        <div className="customer-profile-val-green">
                          {formatCurrency(selectedCustomer.totalValue || 0)}
                        </div>
                      </div>
                      <div>
                        <span className="customer-profile-label">Customer Since:</span>
                        <div className="customer-profile-val">{selectedCustomer.createdAt}</div>
                      </div>
                      <div>
                        <span className="customer-profile-label">Last Contacted:</span>
                        <div className="customer-profile-val-primary">
                          {selectedCustomer.lastContacted}
                        </div>
                      </div>
                    </div>
                  </div>

                  {selectedCustomer.customFields && (() => {
                    const activeDefs = storageService
                      .getCustomFieldDefinitions(tenant?.id)
                      .filter(d => d.active !== false && d.module === 'customers')
                      .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));

                    const rows = activeDefs
                      .map(def => {
                        const key = def.fieldKey || def.id;
                        const val = selectedCustomer.customFields?.[key];
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
                      <div className="card customer-custom-card">
                        <h4 className="customer-custom-heading">
                          Tenant Specific Relationship Attributes
                        </h4>
                        <div className="customer-custom-grid">
                          {rows.map(item => (
                            <div key={item!.id}>
                              <span className="customer-custom-label">
                                {item!.label}:
                              </span>
                              <div className="customer-custom-val">{item!.value}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {activeTab === 'calls' && (
                <div className="customer-calls-stack">
                  {customerCalls.length === 0 ? (
                    <div className="customer-empty-text">
                      No calls logged yet with this customer. Click "Click to Call" to initiate a call.
                    </div>
                  ) : (
                    customerCalls.map(c => (
                      <div
                        key={c.id}
                        className="card customer-call-card"
                      >
                        <div>
                          <div className="customer-call-meta">
                            <StatusChip status={c.direction} size="sm" />
                            <StatusChip status={c.disposition} size="sm" />
                            <span className="customer-call-duration">
                              Duration: {Math.floor(c.duration / 60)}m {c.duration % 60}s • {c.timestamp}
                            </span>
                          </div>
                          {c.transcription && (
                            <p className="customer-call-transcript">
                              "{c.transcription}"
                            </p>
                          )}
                        </div>

                        {c.recordingUrl && (
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => alert(`Simulated Playback: Playing audio for call with ${c.contactName}`)}
                          >
                            <Play size={13} color="var(--primary-600)" /> Play Recording
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeTab === 'followups' && (
                <div className="customer-followups-stack">
                  {customerFollowups.length === 0 ? (
                    <div className="customer-empty-text">
                      No open follow-ups for this customer.
                    </div>
                  ) : (
                    customerFollowups.map(f => (
                      <div
                        key={f.id}
                        className="customer-followup-item"
                      >
                        <div>
                          <div className="customer-followup-header">
                            <span className="customer-followup-notes">{f.notes}</span>
                            <StatusChip status={f.priority} size="sm" />
                          </div>
                          <div className="customer-followup-due">
                            ⏰ Due: {f.scheduledAt} • Assignee: {f.assignedAgentName}
                          </div>
                        </div>

                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => {
                            storageService.saveFollowup({ ...f, status: 'Completed' });
                          }}
                        >
                          Mark Done
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeTab === 'deals' && (
                <div className="customer-deals-stack">
                  {customerDeals.length === 0 ? (
                    <div className="customer-empty-text">
                      No active deals linked yet.
                    </div>
                  ) : (
                    customerDeals.map(d => (
                      <div
                        key={d.id}
                        className="card customer-deal-card"
                      >
                        <div>
                          <div className="customer-deal-title">{d.title}</div>
                          <div className="customer-deal-sub">
                            Stage: <StatusChip status={d.stage} size="sm" /> • Expected Close: {d.expectedCloseDate}
                          </div>
                        </div>
                        <div className="customer-deal-val">
                          {formatCurrency(d.value)}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeTab === 'timeline' && <Timeline events={timelineEvents} />}

              {activeTab === 'documents' && selectedCustomer && (
                <div className="customer-docs-stack">
                  <DocumentUploader
                    entityType="customer"
                    entityId={selectedCustomer.id}
                    allowedCategories={['KYC', 'Agreement', 'Payment Receipt', 'Identity Proof', 'Other']}
                  />
                  <DocumentList
                    entityType="customer"
                    entityId={selectedCustomer.id}
                    canDelete
                  />
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="card customer-empty-placeholder">
            Select a customer from the list to view their 360 profile.
          </div>
        )}
      </div>
      {/* New Customer Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => { setIsAddModalOpen(false); resetAddForm(); }}
        title="New Customer"
        subtitle="Create a fresh customer account and assign it to yourself."
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => { setIsAddModalOpen(false); resetAddForm(); }}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleAddCustomer}>
              Create Customer
            </button>
          </>
        }
      >
        <div className="customer-modal-stack">
          {/* Name */}
          <div className="form-group">
            <label className="form-label">Name *</label>
            <input
              className={`form-input${addErrors.name ? ' is-invalid' : ''}`}
              placeholder="e.g. Priya Sharma"
              value={newName}
              onChange={e => { setNewName(e.target.value); if (addErrors.name) setAddErrors(p => ({ ...p, name: undefined })); }}
            />
            {addErrors.name && <div className="form-error">{addErrors.name}</div>}
          </div>
          {/* Phone */}
          <div className="form-group">
            <label className="form-label">Phone *</label>
            <input
              className={`form-input${addErrors.phone ? ' is-invalid' : ''}`}
              placeholder="e.g. +91 98765 43210"
              value={newPhone}
              onChange={e => { setNewPhone(e.target.value); if (addErrors.phone) setAddErrors(p => ({ ...p, phone: undefined })); }}
            />
            {addErrors.phone && <div className="form-error">{addErrors.phone}</div>}
          </div>
          {/* Email */}
          <div className="form-group">
            <label className="form-label">Email</label>
            <input
              className="form-input"
              type="email"
              placeholder="e.g. priya@example.com"
              value={newEmail}
              onChange={e => setNewEmail(e.target.value)}
            />
          </div>
          {/* Location */}
          <div className="form-group">
            <label className="form-label">Location</label>
            <input
              className="form-input"
              placeholder="e.g. Bengaluru"
              value={newLocation}
              onChange={e => setNewLocation(e.target.value)}
            />
          </div>
          {/* Status */}
          <div className="form-group">
            <label className="form-label">Status</label>
            <select
              className="form-select"
              value={newStatus}
              onChange={e => setNewStatus(e.target.value as 'Active' | 'VIP' | 'Inactive')}
            >
              <option value="Active">Active</option>
              <option value="VIP">VIP</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
          {/* Tenant-Specific Custom Fields */}
          {(() => {
            const customerDefs = storageService
              .getCustomFieldDefinitions(tenant?.id)
              .filter(d => d.active !== false && d.module === 'customers')
              .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));

            if (customerDefs.length === 0) return null;

            return customerDefs.map(def => {
              const key = def.fieldKey || def.id;
              const val = newCustomFields[key] ?? def.defaultValue ?? '';
              return (
                <div key={def.id} className="form-group">
                  <label className="form-label">
                    {def.label || key}
                    {def.required ? ' *' : ''}
                  </label>
                  {def.fieldType === 'select' && def.options && def.options.length > 0 ? (
                    <select
                      className="form-select"
                      required={def.required}
                      value={val}
                      onChange={e => setNewCustomFields(prev => ({ ...prev, [key]: e.target.value }))}
                    >
                      {!def.defaultValue && !def.options.includes(val) && (
                        <option value="">Select {def.label}...</option>
                      )}
                      {def.options.map(opt => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={def.fieldType === 'number' ? 'number' : 'text'}
                      className="form-input"
                      required={def.required}
                      placeholder={`Enter ${def.label}...`}
                      value={val}
                      onChange={e => setNewCustomFields(prev => ({ ...prev, [key]: e.target.value }))}
                    />
                  )}
                </div>
              );
            });
          })()}
        </div>
      </Modal>
    </div>
  );
};