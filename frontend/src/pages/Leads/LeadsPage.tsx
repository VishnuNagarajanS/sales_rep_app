import React, { useState, useEffect, useRef } from 'react';
import Papa from 'papaparse';
import {
  Users,
  Phone,
  Plus,
  Upload,
  CheckCircle2,
  Trash2,
  Edit,
  ExternalLink,
} from 'lucide-react';
import { Lead } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useCall } from '../../context/CallContext';
import { leadsApi, LeadDto } from '../../services/crmApi';
import { DataTable, Column, RowAction } from '../../components/common/DataTable';
import { FilterBar } from '../../components/common/FilterBar';
import { StatusChip } from '../../components/common/StatusChip';
import { Drawer } from '../../components/common/Drawer';
import { Modal } from '../../components/common/Modal';
import './LeadsPage.css';

const AIF_CAPACITY_OPTIONS = [
  '₹1 Cr – ₹5 Cr',
  '₹5 Cr – ₹10 Cr',
  '₹10 Cr – ₹25 Cr',
  '₹25 Cr+',
];

const CO_AIF_CAPACITY_OPTIONS = [
  '₹10 Lakh to ₹1 Cr',
];

const mapDtoToLead = (dto: LeadDto): Lead => ({
  id: String(dto.id),
  companyId: String(dto.companyId),
  name: dto.name,
  phone: dto.phone,
  email: dto.email || '',
  location: dto.location || '',
  source: dto.source || 'Website Inbound',
  status: (dto.status as any) || 'New',
  priority: (dto.priority as any) || 'Medium',
  assignedAgentId: String(dto.assignedAgentId),
  assignedAgentName: dto.assignedAgentName || 'Agent',
  nextFollowupDate: dto.nextFollowupDate,
  createdAt: dto.createdAt ? dto.createdAt.split('T')[0] : new Date().toISOString().split('T')[0],
  notes: dto.notes || '',
  customFields: dto.customFields || {},
});

export const LeadsPage: React.FC = () => {
  const { tenant, user } = useAuth();
  const { initiateCall } = useCall();

  const [leads, setLeads] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const MOVED_LEAD_STATUSES = ['Interested', 'Converted', 'Follow-up Required', 'Not Interested', 'Junk'];

  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isDetailDrawerOpen, setIsDetailDrawerOpen] = useState(false);
  const [isEditDrawerOpen, setIsEditDrawerOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isConvertModalOpen, setIsConvertModalOpen] = useState(false);

  // CSV Import State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importError, setImportError] = useState('');
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [columnMap, setColumnMap] = useState<Record<string, string>>({});
  const [importResults, setImportResults] = useState<{ success: number; skipped: number } | null>(null);

  // Filter states
  const [statusFilter, setStatusFilter] = useState('All');

  // Form state
  const [formData, setFormData] = useState<Partial<Lead>>({});
  const [convertDealTitle, setConvertDealTitle] = useState('');
  const [convertDealValue, setConvertDealValue] = useState<number>(5000000);

  const currentAssetClass =
    formData.customFields?.assetClass ||
    formData.customFields?.preferredAssetClass ||
    'AIF';

  const handleAssetClassChange = (newAssetClass: string) => {
    let newCapacity = formData.customFields?.investmentCapacity;
    if (newAssetClass === 'CO-AIF') {
      newCapacity = '₹10 Lakh to ₹1 Cr';
    } else if (newAssetClass === 'AIF') {
      if (!AIF_CAPACITY_OPTIONS.includes(newCapacity)) {
        newCapacity = '₹1 Cr – ₹5 Cr';
      }
    }
    setFormData(prev => ({
      ...prev,
      customFields: {
        ...prev.customFields,
        assetClass: newAssetClass,
        preferredAssetClass: newAssetClass,
        investmentCapacity: newCapacity,
      },
    }));
  };

  const loadData = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await leadsApi.getActiveLeads({
        status: statusFilter !== 'All' ? statusFilter : undefined,
      });
      const mapped = (data.items || []).map(mapDtoToLead);
      setLeads(mapped);
      setSelectedLead(prev => {
        if (!prev) return null;
        const found = mapped.find(l => l.id === prev.id);
        if (!found || MOVED_LEAD_STATUSES.includes(found.status)) {
          setIsDetailDrawerOpen(false);
          setIsEditDrawerOpen(false);
          return null;
        }
        return found;
      });
    } catch (err: any) {
      setLoadError(err.message || 'Failed to load leads from PostgreSQL.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [tenant?.id, statusFilter]);

  const filteredLeads = leads.filter(lead => {
    if (statusFilter !== 'All' && (lead.status as string) !== statusFilter) return false;
    return true;
  });

  const handleOpenCreate = () => {
    setFormData({
      id: '',
      companyId: tenant?.id || '1',
      name: '',
      phone: '+91 ',
      email: '',
      location: '',
      source: 'Website Inbound',
      status: 'New',
      priority: 'Medium',
      assignedAgentId: user?.id || '1',
      assignedAgentName: user?.name || 'Agent',
      createdAt: new Date().toISOString().split('T')[0],
      notes: '',
      customFields: tenant?.slug === 'jamin'
        ? { budgetRange: '₹45L - ₹65L', preferredLocation: 'Devanahalli North', readyToRegister: 'Immediate' }
        : { investmentCapacity: '₹1 Cr – ₹5 Cr', assetClass: 'AIF', preferredAssetClass: 'AIF', horizon: '3-5 Years' },
    });
    setIsEditDrawerOpen(true);
  };

  const handleOpenEdit = (lead: Lead) => {
    setFormData({ ...lead });
    setIsEditDrawerOpen(true);
  };

  const handleSaveLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.phone) return;

    setIsSaving(true);
    try {
      const isExisting = leads.some(l => l.id === formData.id);
      const isNumericId = formData.id && !isNaN(Number(formData.id)) && Number(formData.id) > 0;

      if (isExisting && isNumericId) {
        await leadsApi.updateLead(Number(formData.id), {
          name: formData.name,
          phone: formData.phone,
          email: formData.email,
          location: formData.location,
          source: formData.source,
          status: formData.status,
          priority: formData.priority,
          notes: formData.notes,
          nextFollowupDate: formData.nextFollowupDate,
          investmentCapacity: formData.customFields?.investmentCapacity,
          assetClass: formData.customFields?.assetClass,
          preferredAssetClass: formData.customFields?.preferredAssetClass,
          horizon: formData.customFields?.horizon,
          additionalCustomFields: formData.customFields,
        });
      } else {
        await leadsApi.createLead({
          name: formData.name,
          phone: formData.phone,
          email: formData.email,
          location: formData.location,
          source: formData.source || 'Website Inbound',
          priority: formData.priority || 'Medium',
          notes: formData.notes,
          investmentCapacity: formData.customFields?.investmentCapacity,
          assetClass: formData.customFields?.assetClass,
          preferredAssetClass: formData.customFields?.preferredAssetClass,
          horizon: formData.customFields?.horizon,
          additionalCustomFields: formData.customFields,
        });
      }

      setIsEditDrawerOpen(false);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to save lead to database.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteLead = async (lead: Lead) => {
    if (confirm(`Mark lead ${lead.name} as Junk?`)) {
      try {
        if (!isNaN(Number(lead.id))) {
          await leadsApi.updateLead(Number(lead.id), { status: 'Junk' });
          await loadData();
        }
      } catch (err: any) {
        alert(err.message || 'Failed to update lead.');
      }
    }
  };

  const handleStartConvert = (lead: Lead) => {
    setSelectedLead(lead);
    setConvertDealTitle(
      tenant?.slug === 'jamin'
        ? `${lead.name} - Villa Plot Booking`
        : `${lead.name} - High Yield Asset Investment`
    );
    setIsConvertModalOpen(true);
  };

  const handleConfirmConvert = async () => {
    if (!selectedLead) return;

    setIsConverting(true);
    try {
      if (!isNaN(Number(selectedLead.id))) {
        await leadsApi.convertLead(Number(selectedLead.id), {
          dealTitle: convertDealTitle,
          dealValue: convertDealValue,
          notes: selectedLead.notes,
        });
      }
      setIsConvertModalOpen(false);
      setIsDetailDrawerOpen(false);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to convert lead.');
    } finally {
      setIsConverting(false);
    }
  };

  const handleFileSelect = (file: File) => {
    setImportError('');
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setImportError('Only .csv files are supported right now');
      return;
    }
    setImportFile(file);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const headers = results.meta.fields || [];
        setCsvHeaders(headers);
        setParsedRows(results.data);

        // Auto-map
        const newMap: Record<string, string> = {};
        const targetFields = ['name', 'phone', 'email', 'location', 'source', 'priority'];
        targetFields.forEach(tf => {
          const match = headers.find(h => h.toLowerCase().includes(tf.toLowerCase()));
          if (match) newMap[tf] = match;
        });
        setColumnMap(newMap);
      }
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileSelect(file);
  };

  const handleImportLeads = async () => {
    setIsImporting(true);
    let successCount = 0;
    let skipCount = 0;

    for (const row of parsedRows) {
      const nameVal = row[columnMap['name']];
      const phoneVal = row[columnMap['phone']];
      if (!nameVal || !phoneVal) {
        skipCount++;
        continue;
      }
      try {
        await leadsApi.createLead({
          name: nameVal.trim(),
          phone: phoneVal.trim(),
          email: row[columnMap['email']]?.trim(),
          location: row[columnMap['location']]?.trim(),
          source: row[columnMap['source']]?.trim() || 'CSV Import',
          priority: row[columnMap['priority']] || 'Medium',
        });
        successCount++;
      } catch {
        skipCount++;
      }
    }
    setIsImporting(false);
    setImportResults({ success: successCount, skipped: skipCount });
    await loadData();
  };

  const resetImportState = () => {
    setImportFile(null);
    setImportError('');
    setParsedRows([]);
    setCsvHeaders([]);
    setColumnMap({});
    setImportResults(null);
  };

  // Columns for DataTable (Exactly 7 defined columns + 1 Action column via rowActions = 8 columns)
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
      key: 'location',
      header: 'City',
      sortable: true,
      render: l => <span>{l.location || '—'}</span>,
    },
    {
      key: 'investmentAmount',
      header: 'Investment Amount',
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
        return <StatusChip status={l.status} size="sm" />;
      },
    },
    {
      key: 'source',
      header: 'Source',
      sortable: true,
      render: l => <span className="lead-text-muted">{l.source}</span>,
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
    {
      label: 'Delete Lead',
      icon: <Trash2 size={14} color="#ef4444" className="leads-action-icon" />,
      danger: true,
      onClick: l => handleDeleteLead(l),
    },
  ];

  return (
    <div className="leads-page">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <Users size={24} color="var(--primary-600)" /> Leads Management
          </h1>
          <p className="page-subtitle">
            Capture, qualify, call, and convert inbound prospects for {tenant?.name}.
          </p>
        </div>

        <div className="leads-header-actions">
          <button
            className="btn btn-secondary"
            onClick={() => setIsImportModalOpen(true)}
          >
            <Upload size={15} /> Import CSV
          </button>
          <button className="btn btn-primary" onClick={handleOpenCreate} disabled={!user} title={!user ? 'Loading user...' : undefined}>
            <Plus size={15} /> Add New Lead
          </button>
        </div>
      </div>

      {loadError && (
        <div className="card" style={{ padding: '12px 16px', marginBottom: '16px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', color: '#ef4444', borderRadius: '8px' }}>
          <strong>Error loading leads:</strong> {loadError}
          <button className="btn btn-sm btn-secondary" style={{ marginLeft: '12px' }} onClick={loadData}>Retry</button>
        </div>
      )}

      {isLoading && (
        <div style={{ textAlign: 'center', padding: '16px', color: 'var(--text-secondary)' }}>
          Loading leads from PostgreSQL database...
        </div>
      )}

      {/* Leads Table */}
      <DataTable
        columns={columns}
        data={filteredLeads}
        keyExtractor={l => l.id}
        rowActions={rowActions}
        onRowClick={l => {
          setSelectedLead(l);
          setIsDetailDrawerOpen(true);
        }}
        searchPlaceholder="Search leads by name, phone, or location..."
        emptyTitle="No leads matching criteria"
        emptyDescription="Create a new lead or clear your filters to display inbound leads."
        emptyActionLabel="+ Add First Lead"
        onEmptyAction={handleOpenCreate}
        filtersNode={
          <FilterBar
            filters={[
              {
                key: 'status',
                label: 'Status',
                value: statusFilter,
                onChange: setStatusFilter,
                options: [
                  { value: 'New', label: 'New' },
                  { value: 'Callback', label: 'Callback' },
                  { value: 'No Response', label: 'No Response' },
                ],
              },
            ]}
            onClearAll={() => {
              setStatusFilter('All');
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
                Assigned to <strong>{selectedLead.assignedAgentName}</strong>
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
                  <div className="lead-detail-value">{selectedLead.source}</div>
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
              if (!selectedLead.customFields) return null;
              const rows = Object.entries(selectedLead.customFields)
                .filter(([key, val]) => key !== 'dispositionReason' && val !== undefined && val !== null && val !== '')
                .map(([key, val]) => ({
                  id: key,
                  label: key.replace(/([A-Z])/g, ' $1').toUpperCase(),
                  value: String(val),
                }));

              if (rows.length === 0) return null;

              return (
                <div className="card lead-custom-card">
                  <h4 className="lead-custom-title">
                    {tenant?.name} Custom Attributes
                  </h4>
                  <div className="lead-detail-grid">
                    {rows.map(item => (
                      <div key={item.id}>
                        <span className="lead-custom-label">
                          {item.label}:
                        </span>
                        <div className="lead-custom-value">{item.value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Message from User */}
            <div className="card lead-custom-card">
              <h4 className="lead-custom-title">
                Message from User
              </h4>
              <div className="lead-user-message-box">
                {(selectedLead as any).message ||
                  (selectedLead as any).userMessage ||
                  selectedLead.customFields?.message ||
                  selectedLead.customFields?.userMessage ||
                  selectedLead.notes ? (
                  <div className="lead-user-message-text">
                    {(selectedLead as any).message ||
                      (selectedLead as any).userMessage ||
                      selectedLead.customFields?.message ||
                      selectedLead.customFields?.userMessage ||
                      selectedLead.notes}
                  </div>
                ) : (
                  <div className="lead-user-message-empty">No message available</div>
                )}
              </div>
            </div>
          </>
        )}
      </Drawer>

      {/* Create / Edit Drawer */}
      <Drawer
        isOpen={isEditDrawerOpen}
        onClose={() => setIsEditDrawerOpen(false)}
        title={formData.id && leads.some(l => l.id === formData.id) ? 'Edit Lead Record' : 'Add New Prospect Lead'}
        subtitle={`Organization: ${tenant?.name}`}
        width={560}
      >
        <form onSubmit={handleSaveLead} className="lead-edit-form">
          <div className="form-group">
            <label className="form-label">Full Name *</label>
            <input
              type="text"
              className="form-input"
              required
              autoComplete="off"
              name="fld-fullname-nexus"
              value={formData.name || ''}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. Ramesh Chandra"
            />
          </div>

          <div className="lead-form-grid-2">
            <div className="form-group">
              <label className="form-label">Phone Number *</label>
              <input
                type="text"
                className="form-input"
                required
                autoComplete="off"
                name="fld-phone-nexus"
                value={formData.phone || ''}
                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+91 98800 00000"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input
                type="email"
                className="form-input"
                autoComplete="off"
                name="fld-email-nexus"
                value={formData.email || ''}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
                placeholder="ramesh@example.com"
              />
            </div>
          </div>

          <div className="lead-form-grid-2">
            <div className="form-group">
              <label className="form-label">Location / City</label>
              <input
                type="text"
                className="form-input"
                autoComplete="off"
                name="fld-location-nexus"
                value={formData.location || ''}
                onChange={e => setFormData({ ...formData, location: e.target.value })}
                placeholder="e.g. Bengaluru, Indiranagar"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Source</label>
              <select
                className="form-select"
                value={formData.source || 'Website Inbound'}
                onChange={e => setFormData({ ...formData, source: e.target.value })}
              >
                <option value="Website Inbound">Website Inbound</option>
                <option value="Google Search">Google Search</option>
                <option value="Facebook / Instagram">Facebook / Instagram</option>
                <option value="Referral - HNW">Referral - HNW</option>
                <option value="Walk-in Site Office">Walk-in Site Office</option>
              </select>
            </div>
          </div>

          {/* DYNAMIC TENANT CUSTOM FIELDS (Blueprint Section 7.3) */}
          <div className="lead-custom-schema-box">
            <div className="lead-custom-schema-title">
              {tenant?.slug === 'jamin' ? `${tenant?.name} Custom Form Schema` : 'GHL India Ventures Asset Terms'}
            </div>

            {tenant?.slug === 'jamin' ? (
              <div className="lead-form-grid-2">
                <div className="form-group">
                  <label className="form-label">Plot Budget Range</label>
                  <select
                    className="form-select"
                    value={formData.customFields?.budgetRange || '₹45L - ₹65L'}
                    onChange={e =>
                      setFormData({
                        ...formData,
                        customFields: { ...formData.customFields, budgetRange: e.target.value },
                      })
                    }
                  >
                    <option value="₹25L - ₹45L">₹25L - ₹45L</option>
                    <option value="₹45L - ₹65L">₹45L - ₹65L</option>
                    <option value="₹65L - ₹90L">₹65L - ₹90L</option>
                    <option value="₹90L+">₹90L+</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Preferred Micro-Market</label>
                  <select
                    className="form-select"
                    value={formData.customFields?.preferredLocation || 'Devanahalli North'}
                    onChange={e =>
                      setFormData({
                        ...formData,
                        customFields: { ...formData.customFields, preferredLocation: e.target.value },
                      })
                    }
                  >
                    <option value="Devanahalli North">Devanahalli North (Airport)</option>
                    <option value="Sarjapur East">Sarjapur East</option>
                    <option value="Mysore Highway Corridor">Mysore Highway Corridor</option>
                  </select>
                </div>
              </div>
            ) : (
              <div className="lead-form-grid-2">
                <div className="form-group">
                  <label className="form-label">Asset Class</label>
                  <select
                    className="form-select"
                    value={currentAssetClass}
                    onChange={e => handleAssetClassChange(e.target.value)}
                  >
                    <option value="AIF">AIF</option>
                    <option value="CO-AIF">CO-AIF</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Investment Capacity</label>
                  <select
                    className="form-select"
                    value={
                      formData.customFields?.investmentCapacity ||
                      (currentAssetClass === 'CO-AIF' ? '₹10 Lakh to ₹1 Cr' : '₹1 Cr – ₹5 Cr')
                    }
                    onChange={e =>
                      setFormData(prev => ({
                        ...prev,
                        customFields: { ...prev.customFields, investmentCapacity: e.target.value },
                      }))
                    }
                  >
                    {currentAssetClass === 'CO-AIF'
                      ? CO_AIF_CAPACITY_OPTIONS.map(opt => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))
                      : AIF_CAPACITY_OPTIONS.map(opt => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                  </select>
                </div>
              </div>
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

          <div className="lead-form-footer-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsEditDrawerOpen(false)}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Save Lead Record
            </button>
          </div>
        </form>
      </Drawer>

      {/* Convert to Customer Modal */}
      <Modal
        isOpen={isConvertModalOpen && !!selectedLead}
        onClose={() => setIsConvertModalOpen(false)}
        title="Convert Lead to Customer Record"
        subtitle={`Moving ${selectedLead?.name} into your active Customer 360 database`}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setIsConvertModalOpen(false)}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleConfirmConvert}>
              Confirm Conversion & Create Deal
            </button>
          </>
        }
      >
        <div className="lead-modal-content">
          <p className="lead-modal-desc">
            Converting this lead will automatically establish a permanent <strong>Customer 360</strong>{' '}
            profile and launch an active pipeline opportunity.
          </p>

          <div className="form-group">
            <label className="form-label">Initial Deal Title *</label>
            <input
              type="text"
              className="form-input"
              autoComplete="off"
              name="fld-deal-title-nexus"
              value={convertDealTitle}
              onChange={e => setConvertDealTitle(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Estimated Deal Value (₹)</label>
            <input
              type="number"
              className="form-input"
              autoComplete="off"
              name="fld-deal-value-nexus"
              value={convertDealValue}
              onChange={e => setConvertDealValue(Number(e.target.value))}
            />
          </div>

          <div className="lead-convert-notice">
            ✓ On {tenant?.name}, this also automatically schedules a{' '}
            <strong>{tenant?.slug === 'jamin' ? 'Site Visit' : 'Wealth Consultation'}</strong> step!
          </div>
        </div>
      </Modal>

      {/* CSV Import Modal */}
      <Modal
        isOpen={isImportModalOpen}
        onClose={() => {
          setIsImportModalOpen(false);
          resetImportState();
        }}
        title="Bulk Import Leads (CSV)"
        subtitle="Upload a file and map columns to ingest prospects"
        footer={
          importResults ? (
            <button className="btn btn-primary" onClick={() => {
              setIsImportModalOpen(false);
              resetImportState();
            }}>
              Done
            </button>
          ) : parsedRows.length > 0 ? (
            <div className="lead-import-footer-actions">
              <button className="btn btn-secondary" onClick={resetImportState}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleImportLeads}
                disabled={!columnMap['name'] || !columnMap['phone']}
              >
                Import Leads
              </button>
            </div>
          ) : (
            <button className="btn btn-secondary" onClick={() => setIsImportModalOpen(false)}>
              Close Import
            </button>
          )
        }
      >
        <div className="lead-modal-content">
          {importResults ? (
            <div className="lead-import-success-card">
              <CheckCircle2 size={48} color="var(--primary-600)" className="lead-import-success-icon" />
              <h3 className="lead-import-success-title">Import Complete</h3>
              <p className="lead-import-success-sub">
                {importResults.success} leads imported successfully, {importResults.skipped} skipped — missing name or phone.
              </p>
            </div>
          ) : parsedRows.length > 0 ? (
            <>
              {/* Mapping */}
              <div className="card lead-mapping-card">
                <h4 className="lead-mapping-title">Map Columns</h4>
                {(!columnMap['name'] || !columnMap['phone']) && (
                  <div className="lead-mapping-warning">
                    ⚠️ Name and Phone columns must be mapped to proceed.
                  </div>
                )}
                <div className="lead-form-grid-2">
                  {['name', 'phone', 'email', 'location', 'source', 'priority'].map(tf => (
                    <div key={tf} className="lead-mapping-row">
                      <span className="lead-mapping-label">
                        {tf}{['name', 'phone'].includes(tf) ? ' *' : ''}
                      </span>
                      <select
                        className="form-select lead-mapping-select"
                        value={columnMap[tf] || ''}
                        onChange={e => setColumnMap(prev => ({ ...prev, [tf]: e.target.value }))}
                      >
                        <option value="">— Not Mapped —</option>
                        {csvHeaders.map(h => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              {/* Preview */}
              <div>
                <div className="lead-preview-header">
                  {parsedRows.length} rows found — showing first 10
                </div>
                <div className="lead-preview-container">
                  <table className="lead-preview-table">
                    <thead className="lead-preview-thead">
                      <tr>
                        {csvHeaders.map(h => (
                          <th key={h} className="lead-preview-th">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {parsedRows.slice(0, 10).map((row, i) => (
                        <tr key={i} className="lead-preview-tr">
                          {csvHeaders.map(h => (
                            <td key={h} className="lead-preview-td">{row[h]}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <>
              <input
                type="file"
                accept=".csv"
                style={{ display: 'none' }}
                ref={fileInputRef}
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) handleFileSelect(file);
                }}
              />
              <div
                onDragOver={e => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="lead-dropzone"
              >
                <Upload size={32} color="var(--primary-600)" className="lead-dropzone-icon" />
                <div className="lead-dropzone-title">Drag & drop your CSV file here</div>
                <div className="lead-dropzone-sub">
                  Supports .csv only
                </div>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm lead-dropzone-btn"
                  onClick={e => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                >
                  Browse File
                </button>
              </div>

              {importError && (
                <div className="lead-import-error">
                  {importError}
                </div>
              )}

              <div className="lead-sample-cols">
                <strong>Sample Columns Supported:</strong> Name, Phone, Email, Location, Source, Priority, Custom Fields.
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
};
