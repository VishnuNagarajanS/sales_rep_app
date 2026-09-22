import React, { useState, useEffect, useCallback } from 'react';
import {
  Building2,
  Phone,
  Plus,
  Play,
  Filter,
  RefreshCw,
  AlertCircle,
  Clock,
  CheckCircle2,
} from 'lucide-react';
import { Customer, CallRecord, Followup } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useCall } from '../../context/CallContext';
import { customersApi, followupsApi } from '../../services/crmApi';
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customer360Loading, setCustomer360Loading] = useState(false);
  const [customerCalls, setCustomerCalls] = useState<CallRecord[]>([]);
  const [customerFollowups, setCustomerFollowups] = useState<Followup[]>([]);

  const [activeTab, setActiveTab] = useState<'overview' | 'calls' | 'followups' | 'timeline' | 'documents'>('overview');
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
  const [savingCustomer, setSavingCustomer] = useState(false);

  // Role-based scoping
  const roleCode = user?.role?.code;
  const isExec = roleCode === 'sales_executive';

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await customersApi.getCustomers({
        status: statusFilter !== 'All' ? statusFilter : undefined,
      });

      if (res?.items) {
        const rawItems = res.items || [];
        const mapped: Customer[] = rawItems.map((c: any) => ({
          id: String(c.id),
          companyId: String(tenant?.id || ''),
          name: c.name || '',
          phone: c.phone || '',
          email: c.email || '',
          status: (c.status as any) || 'Active',
          assignedAgentId: String(c.assignedAgentId || ''),
          assignedAgentName: c.assignedAgentName || 'Unassigned',
          location: c.location || '',
          lastContacted: c.lastContacted ? new Date(c.lastContacted).toISOString().split('T')[0] : '—',
          openDealsCount: c.openDealsCount || 0,
          totalValue: Number(c.totalValue || 0),
          createdAt: c.createdAt ? new Date(c.createdAt).toISOString().split('T')[0] : '—',
          notes: c.notes || '',
          customFields: c.customFields || {},
        }));

        setCustomers(mapped);

        if (mapped.length > 0) {
          setSelectedCustomer(prev => {
            if (prev) {
              const stillExists = mapped.find(c => c.id === prev.id);
              if (stillExists) return stillExists;
            }
            return mapped[0];
          });
        } else {
          setSelectedCustomer(null);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load customers from backend API');
    } finally {
      setLoading(false);
    }
  }, [tenant?.id, statusFilter]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  // Load 360 data when selected customer changes
  useEffect(() => {
    if (!selectedCustomer) {
      setCustomerCalls([]);
      setCustomerFollowups([]);
      return;
    }

    let isMounted = true;
    const fetch360 = async () => {
      setCustomer360Loading(true);
      try {
        const res = await customersApi.getCustomer360(selectedCustomer.id);
        if (isMounted && res) {
          const raw360 = res;
          // Map calls
          const mappedCalls: CallRecord[] = (raw360.calls || []).map((c: any) => ({
            id: String(c.id),
            companyId: String(tenant?.id || ''),
            tenantId: String(tenant?.id || ''),
            contactName: selectedCustomer.name,
            contactPhone: selectedCustomer.phone,
            leadId: undefined,
            contactType: 'customer',
            agentId: String(user?.id || ''),
            agentName: selectedCustomer.assignedAgentName || 'Agent',
            direction: (c.direction || 'outbound').toLowerCase() as any,
            duration: Number(c.duration || 0),
            disposition: (c.disposition || 'Interested') as any,
            timestamp: c.timestamp ? new Date(c.timestamp).toLocaleString('en-IN') : 'Just now',
            notes: c.notes || '',
          }));
          setCustomerCalls(mappedCalls);

          // Map followups
          const mappedFollowups: Followup[] = (raw360.followups || []).map((f: any) => ({
            id: String(f.id),
            companyId: String(tenant?.id || ''),
            tenantId: String(tenant?.id || ''),
            contactName: selectedCustomer.name,
            contactPhone: selectedCustomer.phone,
            contactType: 'customer',
            contactId: selectedCustomer.id,
            assignedAgentId: String(f.assignedAgentId || ''),
            assignedAgentName: f.assignedAgentName || 'Agent',
            scheduledAt: f.scheduledAt ? new Date(f.scheduledAt).toLocaleString('en-IN') : '—',
            notes: f.notes || '',
            priority: (f.priority || 'Medium') as any,
            status: (f.status || 'Pending') as any,
            completedAt: f.completedAt ? new Date(f.completedAt).toLocaleString('en-IN') : undefined,
          }));
          setCustomerFollowups(mappedFollowups);
        }
      } catch {
        // Keep existing or empty
      } finally {
        if (isMounted) setCustomer360Loading(false);
      }
    };

    fetch360();
    return () => {
      isMounted = false;
    };
  }, [selectedCustomer?.id, tenant?.id, user?.id]);

  const scopedCustomers = isExec
    ? customers.filter(
        c =>
          (c.assignedAgentId && c.assignedAgentId === user?.id) ||
          (c.assignedAgentName && c.assignedAgentName === user?.name)
      )
    : customers;

  const agentOptions = Array.from(new Set(scopedCustomers.map(c => c.assignedAgentName)))
    .filter(Boolean)
    .map(name => ({ value: name, label: name }));

  const filteredCustomers = scopedCustomers.filter(c => {
    if (statusFilter !== 'All' && c.status !== statusFilter) return false;
    if (agentFilter !== 'All' && c.assignedAgentName !== agentFilter) return false;
    return true;
  });

  const resetAddForm = () => {
    setNewName('');
    setNewPhone('');
    setNewEmail('');
    setNewLocation('');
    setNewStatus('Active');
    setNewCustomFields({});
    setAddErrors({});
  };

  const handleAddCustomer = async () => {
    const errors: { name?: string; phone?: string } = {};
    if (!newName.trim()) errors.name = 'Name is required.';
    if (!newPhone.trim()) errors.phone = 'Phone is required.';
    if (Object.keys(errors).length > 0) {
      setAddErrors(errors);
      return;
    }

    setSavingCustomer(true);
    try {
      const res = await customersApi.createCustomer({
        name: newName.trim(),
        phone: newPhone.trim(),
        email: newEmail.trim() || undefined,
        location: newLocation.trim() || undefined,
        status: newStatus,
        totalValue: 0,
        notes: '',
        customFields: newCustomFields,
      });

      setIsAddModalOpen(false);
      resetAddForm();
      await fetchCustomers();

      if (res?.id) {
        const createdId = String(res.id);
        const match = customers.find(c => c.id === createdId);
        if (match) setSelectedCustomer(match);
      }
    } catch (err: any) {
      alert(`Error creating customer: ${err.message || 'Please try again'}`);
    } finally {
      setSavingCustomer(false);
    }
  };

  const handleCompleteFollowup = async (followupId: string) => {
    try {
      await followupsApi.completeFollowup(followupId);
      // Refresh 360 data
      if (selectedCustomer) {
        const res = await customersApi.getCustomer360(selectedCustomer.id);
        if (res?.followups) {
          const mapped: Followup[] = res.followups.map((f: any) => ({
            id: String(f.id),
            companyId: String(tenant?.id || ''),
            tenantId: String(tenant?.id || ''),
            contactName: selectedCustomer.name,
            contactPhone: selectedCustomer.phone,
            contactType: 'customer',
            contactId: selectedCustomer.id,
            assignedAgentId: String(f.assignedAgentId || ''),
            assignedAgentName: f.assignedAgentName || 'Agent',
            scheduledAt: f.scheduledAt ? new Date(f.scheduledAt).toLocaleString('en-IN') : '—',
            notes: f.notes || '',
            priority: (f.priority || 'Medium') as any,
            status: (f.status || 'Pending') as any,
            completedAt: f.completedAt ? new Date(f.completedAt).toLocaleString('en-IN') : undefined,
          }));
          setCustomerFollowups(mapped);
        }
      }
    } catch (err: any) {
      alert(`Failed to complete follow-up: ${err.message}`);
    }
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
        description: c.notes || undefined,
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

    rawEvents.push({
      id: `ev-create-${selectedCustomer.id}`,
      type: 'note',
      title: 'Customer Account Created in Database',
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
            Unified contact view across calls, follow-ups, timeline, and documents for {tenant?.name || 'organization'}.
          </p>
        </div>
        <button
          className="btn btn-secondary btn-sm"
          onClick={fetchCustomers}
          disabled={loading}
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh DB Data
        </button>
      </div>

      {error && (
        <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#dc2626', padding: '10px 14px', borderRadius: 8, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Customer 360 Split View: List on left, Full 360 on right */}
      <div className="customers-split-layout">
        {/* Left: Customer Directory */}
        <div className="customers-sidebar">
          <div className="card customers-sidebar-card">
            <div className="customers-sidebar-header">
              <h3 className="customers-sidebar-title">Customer Accounts ({filteredCustomers.length})</h3>
              <button
                className="btn btn-primary btn-sm customers-btn-new"
                onClick={() => {
                  resetAddForm();
                  setIsAddModalOpen(true);
                }}
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
                <label htmlFor="filter-customer-status" className="customers-filter-tag">
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
              {!isExec && agentOptions.length > 0 && (
                <div className="customers-filter-group">
                  <label htmlFor="filter-customer-agent" className="customers-filter-tag">
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
              {loading && customers.length === 0 ? (
                <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-secondary)' }}>
                  Loading database records...
                </div>
              ) : filteredCustomers.length === 0 ? (
                <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-secondary)' }}>
                  No customer records found in database.
                </div>
              ) : (
                filteredCustomers.map(c => {
                  const isSelected = selectedCustomer?.id === c.id;
                  return (
                    <div
                      key={c.id}
                      onClick={() => setSelectedCustomer(c)}
                      className={`customer-list-item ${isSelected ? 'is-selected' : ''}`}
                    >
                      <div className="customer-list-item-top">
                        <div className="customer-list-name">{c.name}</div>
                        <StatusChip status={c.status} size="sm" />
                      </div>
                      <div className="customer-list-sub">
                        {c.phone} • {c.location || 'Location not set'}
                      </div>
                      <div className="customer-list-bottom">
                        <span className="customer-list-val">
                          {c.totalValue > 0 ? formatCurrency(c.totalValue) : '—'}
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
                })
              )}
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
                  {customer360Loading && (
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                      <RefreshCw size={11} className="spin" style={{ display: 'inline', marginRight: 4 }} />
                      Syncing 360...
                    </span>
                  )}
                </div>
                <div className="customer-cockpit-meta-row">
                  <span>📞 {selectedCustomer.phone}</span>
                  {selectedCustomer.email && <span>✉️ {selectedCustomer.email}</span>}
                  {selectedCustomer.location && <span>📍 {selectedCustomer.location}</span>}
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
                    <h4 className="customer-section-heading">Account & Commercial Profile</h4>
                    <div className="customer-profile-grid">
                      <div>
                        <span className="customer-profile-label">Assigned Account Manager:</span>
                        <div className="customer-profile-val">{selectedCustomer.assignedAgentName}</div>
                      </div>
                      <div>
                        <span className="customer-profile-label">Portfolio / Deal Value:</span>
                        <div className="customer-profile-val-green">
                          {selectedCustomer.totalValue > 0 ? formatCurrency(selectedCustomer.totalValue) : '—'}
                        </div>
                      </div>
                      <div>
                        <span className="customer-profile-label">Customer Since:</span>
                        <div className="customer-profile-val">{selectedCustomer.createdAt}</div>
                      </div>
                      <div>
                        <span className="customer-profile-label">Last Contacted:</span>
                        <div className="customer-profile-val-primary">{selectedCustomer.lastContacted}</div>
                      </div>
                    </div>
                  </div>

                  {selectedCustomer.customFields && Object.keys(selectedCustomer.customFields).length > 0 && (
                    <div className="card customer-custom-card">
                      <h4 className="customer-custom-heading">Attributes & Preferences</h4>
                      <div className="customer-custom-grid">
                        {Object.entries(selectedCustomer.customFields).map(([key, val]) => (
                          <div key={key}>
                            <span className="customer-custom-label">
                              {key.replace(/([A-Z])/g, ' $1').toUpperCase()}:
                            </span>
                            <div className="customer-custom-val">{String(val)}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'calls' && (
                <div className="customer-calls-stack">
                  {customerCalls.length === 0 ? (
                    <div className="customer-empty-text">
                      No calls logged yet with this customer in Neon database. Use "Click to Call" to initiate a call.
                    </div>
                  ) : (
                    customerCalls.map(c => (
                      <div key={c.id} className="card customer-call-card">
                        <div>
                          <div className="customer-call-meta">
                            <StatusChip status={c.direction} size="sm" />
                            <StatusChip status={c.disposition} size="sm" />
                            <span className="customer-call-duration">
                              Duration: {Math.floor(c.duration / 60)}m {c.duration % 60}s • {c.timestamp}
                            </span>
                          </div>
                          {c.notes && <p className="customer-call-transcript">"{c.notes}"</p>}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeTab === 'followups' && (
                <div className="customer-followups-stack">
                  {customerFollowups.length === 0 ? (
                    <div className="customer-empty-text">
                      No follow-ups recorded for this customer in database.
                    </div>
                  ) : (
                    customerFollowups.map(f => (
                      <div key={f.id} className="customer-followup-item">
                        <div>
                          <div className="customer-followup-header">
                            <span className="customer-followup-notes">{f.notes}</span>
                            <StatusChip status={f.priority} size="sm" />
                            <StatusChip status={f.status} size="sm" />
                          </div>
                          <div className="customer-followup-due">
                            ⏰ Scheduled: {f.scheduledAt} • Assignee: {f.assignedAgentName}
                          </div>
                        </div>

                        {f.status === 'Pending' && (
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleCompleteFollowup(f.id)}
                          >
                            Mark Done
                          </button>
                        )}
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
                  <DocumentList entityType="customer" entityId={selectedCustomer.id} canDelete />
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
        onClose={() => {
          setIsAddModalOpen(false);
          resetAddForm();
        }}
        title="New Customer"
        subtitle="Create a fresh customer account in PostgreSQL database."
        footer={
          <>
            <button
              className="btn btn-secondary"
              onClick={() => {
                setIsAddModalOpen(false);
                resetAddForm();
              }}
              disabled={savingCustomer}
            >
              Cancel
            </button>
            <button
              className="btn btn-primary"
              onClick={handleAddCustomer}
              disabled={savingCustomer}
            >
              {savingCustomer ? 'Creating...' : 'Create Customer'}
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
              onChange={e => {
                setNewName(e.target.value);
                if (addErrors.name) setAddErrors(p => ({ ...p, name: undefined }));
              }}
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
              onChange={e => {
                setNewPhone(e.target.value);
                if (addErrors.phone) setAddErrors(p => ({ ...p, phone: undefined }));
              }}
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
        </div>
      </Modal>
    </div>
  );
};