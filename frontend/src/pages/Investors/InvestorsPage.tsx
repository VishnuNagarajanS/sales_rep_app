import React, { useState, useEffect } from 'react';
import { TrendingUp, Phone, ExternalLink, Edit2, Trash2, Download, Plus } from 'lucide-react';
import { Investor, CallRecord, Consultation, InvestmentOpportunity, Followup, Deal } from '../../types';
import Papa from 'papaparse';
import { useAuth } from '../../context/AuthContext';
import { useCall } from '../../context/CallContext';
import { getInvestors, saveInvestor as apiSaveInvestor, deleteInvestor as apiDeleteInvestor, getDeals, getCalls, getConsultations, getOpportunities, getFollowups } from '../../services/ghlApiService';
import { DataTable, Column, RowAction } from '../../components/common/DataTable';
import { StatusChip } from '../../components/common/StatusChip';
import { Drawer } from '../../components/common/Drawer';
import { FilterBar } from '../../components/common/FilterBar';
import { Modal } from '../../components/common/Modal';
import { DocumentUploader } from '../../components/common/DocumentUploader';
import { DocumentList } from '../../components/common/DocumentList';
import './InvestorsPage.css';

// ─── Form state shape ────────────────────────────────────────────────────────
interface InvestorForm {
  name: string;
  phone: string;
  email: string;
  status: 'Lead' | 'Active Investor' | 'HNW Investor' | 'Inactive';
  investmentCapacity: string;
  preferredAssetClass: string;
  assignedAgentId: string;
  assignedAgentName: string;
  referralSource: string;
  notes: string;
  committedAUM: string;
  investmentMandate: string;
  riskTolerance: 'Conservative' | 'Moderate' | 'Aggressive' | '';
}

const BLANK_FORM: InvestorForm = {
  name: '',
  phone: '',
  email: '',
  status: 'Lead',
  investmentCapacity: '',
  preferredAssetClass: '',
  assignedAgentId: '',
  assignedAgentName: '',
  referralSource: '',
  notes: '',
  committedAUM: '',
  investmentMandate: '',
  riskTolerance: '',
};

// ─── Component ───────────────────────────────────────────────────────────────
export const InvestorsPage: React.FC = () => {
  const { tenant, user } = useAuth();
  const { initiateCall } = useCall();

  // ── Role scoping ───────────────────────────────────────────────────────────
  const roleCode = user?.role?.code;
  const isExec = roleCode === 'sales_executive';
  const isIrm = roleCode === 'irm';
  const isGhlIrm = isIrm && tenant?.slug === 'ghl';

  // ── Core data ─────────────────────────────────────────────────────────────
  const [investors, setInvestors] = useState<Investor[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [allCalls, setAllCalls] = useState<CallRecord[]>([]);
  const [allConsultations, setAllConsultations] = useState<Consultation[]>([]);
  const [allOpportunities, setAllOpportunities] = useState<InvestmentOpportunity[]>([]);
  const [allFollowups, setAllFollowups] = useState<Followup[]>([]);

  // ── Drawer / 360 view ─────────────────────────────────────────────────────
  const [selectedInvestor, setSelectedInvestor] = useState<Investor | null>(null);
  const [drawerTab, setDrawerTab] = useState<
    'overview' | 'calls' | 'consultations' | 'opportunities' | 'followups' | 'documents'
  >('overview');

  // ── Filters ───────────────────────────────────────────────────────────────
  const [statusFilter, setStatusFilter] = useState('All');
  const [assetClassFilter, setAssetClassFilter] = useState('All');
  const [consultantFilter, setConsultantFilter] = useState('All');

  // ── Create / Edit modal ───────────────────────────────────────────────────
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingInvestor, setEditingInvestor] = useState<Investor | null>(null);
  const [form, setForm] = useState<InvestorForm>(BLANK_FORM);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof InvestorForm, string>>>({});

  // ── Data loading ──────────────────────────────────────────────────────────
  const loadData = async () => {
    const [invs, dls, cls, cons, opps, fus] = await Promise.all([
      getInvestors(tenant?.id),
      getDeals(tenant?.id),
      getCalls(tenant?.id),
      getConsultations(tenant?.id),
      getOpportunities(tenant?.id),
      getFollowups(tenant?.id),
    ]);
    setInvestors(invs);
    setDeals(dls);
    setAllCalls(cls);
    setAllConsultations(cons);
    setAllOpportunities(opps);
    setAllFollowups(fus);
  };

  useEffect(() => {
    loadData();
    const handleUpdate = () => loadData();
    window.addEventListener('nexus_storage_updated', handleUpdate);
    return () => window.removeEventListener('nexus_storage_updated', handleUpdate);
  }, [tenant?.id]);

  // Reset drawer tab whenever a different investor is selected
  useEffect(() => {
    setDrawerTab('overview');
  }, [selectedInvestor?.id]);

  // ── Role-based scoping ────────────────────────────────────────────────────
  // For IRM on GHL: show ONLY investors who completed the full pipeline with a deal at stage === 'converted'
  // sales_executive sees only their own investors; managers/admins see all
  const convertedDeals = deals.filter(d => d.stage === 'converted');
  const convertedCustomerIds = new Set(convertedDeals.map(d => d.customerId));
  const convertedCustomerNames = new Set(convertedDeals.map(d => d.customerName.toLowerCase()));

  const scopedInvestors = isGhlIrm
    ? [
        ...investors.filter(inv =>
          convertedCustomerIds.has(inv.id) ||
          convertedCustomerNames.has(inv.name.toLowerCase())
        ),
        ...convertedDeals
          .filter(d => !investors.some(inv => inv.id === d.customerId || inv.name.toLowerCase() === d.customerName.toLowerCase()))
          .map((d): Investor => ({
            id: d.customerId || `inv-${d.id}`,
            companyId: d.companyId,
            name: d.customerName,
            phone: d.phone || '',
            email: d.email || '',
            status: 'Active Investor',
            investmentCapacity: d.investmentRange || (d.value >= 10000000 ? `₹${(d.value / 10000000).toFixed(2)} Cr` : `₹${d.value}`),
            preferredAssetClass: d.preferredAssetClass || 'Commercial Pre-Leased',
            assignedAgentId: d.assignedAgentId,
            assignedAgentName: d.assignedAgentName,
            referralSource: 'Pipeline Mandate Converted',
            createdAt: d.createdAt,
            committedAUM: d.investmentRange || (d.value >= 10000000 ? `₹${(d.value / 10000000).toFixed(2)} Cr` : `₹${d.value}`),
            notes: d.notes,
            investmentMandate: '',
            riskTolerance: undefined,
          }))
      ]
    : isExec
      ? investors.filter(
        inv =>
          (inv.assignedAgentId && inv.assignedAgentId === user?.id) ||
          (inv.assignedAgentName && inv.assignedAgentName === user?.name),
      )
      : investors;

  // ── Filter options ────────────────────────────────────────────────────────
  const assetClassOptions = Array.from(new Set(scopedInvestors.map(inv => inv.preferredAssetClass)))
    .filter(Boolean)
    .map(cls => ({ value: cls, label: cls }));

  const consultantOptions = Array.from(new Set(scopedInvestors.map(inv => inv.assignedAgentName)))
    .filter(Boolean)
    .map(name => ({ value: name, label: name }));

  // ── Filtered list ─────────────────────────────────────────────────────────
  const filteredInvestors = scopedInvestors.filter(inv => {
    if (statusFilter !== 'All' && inv.status !== statusFilter) return false;
    if (assetClassFilter !== 'All' && inv.preferredAssetClass !== assetClassFilter) return false;
    if (consultantFilter !== 'All' && inv.assignedAgentName !== consultantFilter) return false;
    return true;
  });

  // ── Linked records for selected investor ──────────────────────────────────
  const investorCalls = allCalls.filter(
    c =>
      selectedInvestor &&
      (c.investorId === selectedInvestor.id || c.contactName === selectedInvestor.name),
  );

  const investorConsultations = allConsultations.filter(
    c =>
      selectedInvestor &&
      (c.investorId === selectedInvestor.id || c.investorName === selectedInvestor.name),
  );

  const investorOpportunities = allOpportunities.filter(
    o =>
      selectedInvestor &&
      (o.investorId === selectedInvestor.id || o.investorName === selectedInvestor.name),
  );

  const investorFollowups = allFollowups.filter(
    f =>
      selectedInvestor &&
      (f.contactId === selectedInvestor.id || f.contactName === selectedInvestor.name),
  );

  // ── Modal helpers ─────────────────────────────────────────────────────────
  const openNewModal = () => {
    setEditingInvestor(null);
    setForm({
      ...BLANK_FORM,
      // Lock exec to themselves
      assignedAgentId: isExec ? (user?.id ?? '') : '',
      assignedAgentName: isExec ? (user?.name ?? '') : '',
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  const openEditModal = (inv: Investor) => {
    setEditingInvestor(inv);
    setForm({
      name: inv.name,
      phone: inv.phone,
      email: inv.email,
      status: inv.status,
      investmentCapacity: inv.investmentCapacity,
      preferredAssetClass: inv.preferredAssetClass,
      assignedAgentId: inv.assignedAgentId,
      assignedAgentName: inv.assignedAgentName,
      referralSource: inv.referralSource ?? '',
      notes: inv.notes,
      committedAUM: inv.committedAUM ?? '',
      investmentMandate: inv.investmentMandate ?? '',
      riskTolerance: inv.riskTolerance ?? '',
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingInvestor(null);
    setForm(BLANK_FORM);
    setFormErrors({});
  };

  const setField = <K extends keyof InvestorForm>(key: K, value: InvestorForm[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
    if (formErrors[key]) setFormErrors(prev => ({ ...prev, [key]: undefined }));
  };

  const handleSaveInvestor = () => {
    const errors: Partial<Record<keyof InvestorForm, string>> = {};
    if (!form.name.trim()) errors.name = 'Name is required.';
    if (!form.phone.trim()) errors.phone = 'Phone is required.';
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    const now = new Date().toISOString().split('T')[0];
    const investor: Investor = {
      id: editingInvestor ? editingInvestor.id : `inv-${Date.now()}`,
      companyId: tenant?.id ?? '',
      name: form.name.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      status: form.status,
      investmentCapacity: form.investmentCapacity.trim(),
      preferredAssetClass: form.preferredAssetClass.trim(),
      assignedAgentId: form.assignedAgentId.trim() || (user?.id ?? ''),
      assignedAgentName: form.assignedAgentName.trim() || (user?.name ?? ''),
      referralSource: form.referralSource.trim() || undefined,
      createdAt: editingInvestor ? editingInvestor.createdAt : now,
      notes: form.notes.trim(),
      ...(form.committedAUM.trim() ? { committedAUM: form.committedAUM.trim() } : {}),
      ...(form.investmentMandate.trim() ? { investmentMandate: form.investmentMandate.trim() } : {}),
      ...(form.riskTolerance ? { riskTolerance: form.riskTolerance as Investor['riskTolerance'] } : {}),
    };

    apiSaveInvestor(investor).catch(console.error);
    closeModal();
    setSelectedInvestor(investor);
  };

  // ── CSV Export ────────────────────────────────────────────────────────────
  const handleExportCSV = () => {
    const rows = filteredInvestors.map(inv => ({
      Name: inv.name,
      Phone: inv.phone,
      Email: inv.email,
      Status: inv.status,
      'Investment Capacity': inv.investmentCapacity,
      'Preferred Asset Class': inv.preferredAssetClass,
      'Committed AUM': inv.committedAUM ?? '',
      'Investment Mandate': inv.investmentMandate ?? '',
      'Risk Tolerance': inv.riskTolerance ?? '',
      'Assigned Consultant': inv.assignedAgentName,
      'Referral Source': inv.referralSource ?? '',
      'Created At': inv.createdAt,
      Notes: inv.notes,
    }));
    const csv = Papa.unparse(rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `investors_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // ── Delete handler ────────────────────────────────────────────────────────
  const handleDeleteInvestor = (inv: Investor) => {
    if (!window.confirm(`Delete investor "${inv.name}"? This cannot be undone.`)) return;
    apiDeleteInvestor(inv.id).catch(console.error);
    if (selectedInvestor?.id === inv.id) setSelectedInvestor(null);
  };

  // ── Table columns ─────────────────────────────────────────────────────────
  const columns: Column<Investor>[] = [
    {
      key: 'name',
      header: 'Investor Profile',
      sortable: true,
      render: inv => (
        <div>
          <div className="investor-name-cell">{inv.name}</div>
          <div className="investor-meta-cell">
            {inv.phone} {inv.email && `• ${inv.email}`}
          </div>
        </div>
      ),
    },
    {
      key: 'investmentCapacity',
      header: 'Capital Capacity',
      sortable: true,
      render: inv => (
        <span className="investor-capacity-badge">{inv.investmentCapacity}</span>
      ),
    },
    ...(isExec ? [] : [{
      key: 'preferredAssetClass',
      header: 'Preferred Asset Class',
      sortable: true,
      render: (inv: Investor) => <span style={{ fontSize: 12 }}>{inv.preferredAssetClass}</span>,
    } as Column<Investor>]),
    ...(isGhlIrm ? [{
      key: 'investorType' as any,
      header: 'Structure',
      render: (inv: Investor) => {
        const matchingDeal = convertedDeals.find(d => d.customerId === inv.id || d.customerName.toLowerCase() === inv.name.toLowerCase());
        const type = matchingDeal?.investorType || 'AIF';
        return (
          <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 4, background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
            {type}
          </span>
        );
      },
    } as Column<Investor>] : []),
    {
      key: 'status',
      header: 'KYC / Investor Status',
      sortable: true,
      render: inv => <StatusChip status={inv.status} size="sm" />,
    },
    {
      key: 'assignedAgentName',
      header: 'Wealth Consultant',
      render: inv => <span style={{ fontSize: 12 }}>{inv.assignedAgentName}</span>,
    },
  ];

  const rowActions: RowAction<Investor>[] = [
    {
      label: 'Call Customer',
      icon: <Phone size={14} color="#059669" style={{ marginRight: 6 }} />,
      onClick: inv => initiateCall(inv.name, inv.phone, 'customer', inv.id),
    },
    {
      label: 'View Investor 360',
      icon: <ExternalLink size={14} style={{ marginRight: 6 }} />,
      onClick: inv => setSelectedInvestor(inv),
    },
    {
      label: 'Edit Investor',
      icon: <Edit2 size={14} color="var(--primary-600)" style={{ marginRight: 6 }} />,
      onClick: inv => openEditModal(inv),
    },
    {
      label: 'Delete Investor',
      icon: <Trash2 size={14} color="#dc2626" style={{ marginRight: 6 }} />,
      onClick: inv => handleDeleteInvestor(inv),
    },
  ];

  // ── Shared tab button style helper ────────────────────────────────────────
  const tabBtnStyle = (active: boolean): React.CSSProperties => ({
    borderRadius: 0,
    borderBottom: active ? '2px solid var(--primary-600)' : '2px solid transparent',
    color: active ? 'var(--primary-600)' : 'var(--text-secondary)',
    fontWeight: active ? 700 : 500,
    padding: '10px 14px',
    fontSize: 13,
    background: 'none',
    border: 'none',
    borderBottomStyle: 'solid',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  });

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="investors-page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <TrendingUp size={24} color={isGhlIrm ? '#10b981' : '#0284c7'} />{' '}
            {isGhlIrm ? 'Converted Investors 360' : 'High Net-Worth Investors 360'}
          </h1>
          <p className="page-subtitle">
            {isGhlIrm
              ? 'HNIs, family offices, and institutional partners who have completed the full pipeline and committed capital.'
              : `Private wealth client directory, institutional capital allocation, and mandate tracking for ${tenant?.name}.`}
          </p>
        </div>

        {/* Header actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            id="investors-export-csv"
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}
            onClick={handleExportCSV}
          >
            <Download size={15} /> Export CSV
          </button>
          <button
            id="investors-new-investor"
            className="btn btn-primary"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 13,
            }}
            onClick={openNewModal}
          >
            <Plus size={15} /> New Investor
          </button>
        </div>
      </div>

      {/* ── Data table ───────────────────────────────────────────────────── */}
      <DataTable
        columns={columns}
        data={filteredInvestors}
        keyExtractor={inv => inv.id}
        rowActions={rowActions}
        onRowClick={inv => setSelectedInvestor(inv)}
        searchPlaceholder="Search investors by name, asset class, or capacity..."
        filtersNode={
          <FilterBar
            filters={[
              {
                key: 'status',
                label: 'Status',
                value: statusFilter,
                onChange: setStatusFilter,
                options: [
                  { value: 'Lead', label: 'Lead' },
                  { value: 'Active Investor', label: 'Active Investor' },
                  { value: 'HNW Investor', label: 'HNW Investor' },
                  { value: 'Inactive', label: 'Inactive' },
                ],
              },
              ...(isExec ? [] : [{
                key: 'assetClass',
                label: 'Asset Class',
                value: assetClassFilter,
                onChange: setAssetClassFilter,
                options: assetClassOptions,
              }]),
              {
                key: 'consultant',
                label: 'Consultant',
                value: consultantFilter,
                onChange: setConsultantFilter,
                options: consultantOptions,
              },
            ]}
            onClearAll={() => {
              setStatusFilter('All');
              setAssetClassFilter('All');
              setConsultantFilter('All');
            }}
          />
        }
      />

      {/* ── Investor 360 Drawer ──────────────────────────────────────────── */}
      <Drawer
        isOpen={!!selectedInvestor}
        onClose={() => setSelectedInvestor(null)}
        title={selectedInvestor?.name || 'Investor Overview'}
        subtitle={isExec ? undefined : `Mandate: ${selectedInvestor?.preferredAssetClass ?? ''}`}
        width={720}
      >
        {selectedInvestor && (
          <div className="investor-drawer-body">
            <div className="investor-quick-card">
              <div>
                <StatusChip status={selectedInvestor.status} />
                <div className="investor-partner-label">
                  Lead Wealth Partner: <strong>{selectedInvestor.assignedAgentName}</strong>
                </div>
              </div>

              <button
                className="btn btn-primary btn-sm investor-call-btn-blue"
                onClick={() => initiateCall(selectedInvestor.name, selectedInvestor.phone, 'customer', selectedInvestor.id)}
              >
                <Phone size={13} /> Call Customer
              </button>
            </div>

            <div className="card investor-info-card">
              <h4 className="investor-info-title">
                Investment Allocation & Capacity
              </h4>
              <div className="investor-details-grid">
                <div>
                  <span style={{ color: 'var(--text-secondary)' }}>Capital Ticket:</span>
                  <div className="investor-ticket-val">
                    {selectedInvestor.investmentCapacity}
                  </div>
                </div>
                {(() => {
                  const matchingDeal = convertedDeals.find(d => d.customerId === selectedInvestor.id || d.customerName.toLowerCase() === selectedInvestor.name.toLowerCase());
                  if (matchingDeal?.investorType) {
                    return (
                      <div>
                        <span style={{ color: 'var(--text-secondary)' }}>Investor Structure:</span>
                        <div style={{ fontWeight: 800, color: 'var(--primary-600)', marginTop: 4 }}>
                          {matchingDeal.investorType}
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>
            </div>

            <div className="card investor-info-card">
              <h4 className="investor-info-title">
                Advisory Portfolio Notes
              </h4>
              <p className="investor-notes-text">
                {selectedInvestor.notes || 'Institutional investor evaluation completed.'}
              </p>
            </div>

            {/* Documents */}
            <div className="card investor-info-card">
              <h4 className="investor-info-title">
                Documents
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <DocumentUploader
                  entityType="investor"
                  entityId={selectedInvestor.id}
                  allowedCategories={[
                    'KYC',
                    'Mandate Agreement',
                    'Term Sheet',
                    'PAN / Aadhar',
                    'Other',
                  ]}
                />
                <DocumentList
                  entityType="investor"
                  entityId={selectedInvestor.id}
                  canDelete
                />
              </div>
            </div>
          </div>
        )}
      </Drawer>

      {/* ── Create / Edit Investor Modal ─────────────────────────────────── */}
      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={editingInvestor ? 'Edit Investor' : 'New Investor'}
        subtitle={
          editingInvestor
            ? `Editing profile for ${editingInvestor.name}.`
            : 'Create a new HNW investor profile for your firm.'
        }
        maxWidth={620}
        footer={
          <>
            <button className="btn btn-secondary" onClick={closeModal}>
              Cancel
            </button>
            <button
              className="btn btn-primary"
              onClick={handleSaveInvestor}
            >
              {editingInvestor ? 'Update Investor' : 'Save Investor'}
            </button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Row: Name + Phone */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">Name *</label>
              <input
                id="inv-form-name"
                className={`form-input${formErrors.name ? ' is-invalid' : ''}`}
                placeholder="e.g. Rajiv Mehta"
                value={form.name}
                onChange={e => setField('name', e.target.value)}
              />
              {formErrors.name && <div className="form-error">{formErrors.name}</div>}
            </div>
            <div className="form-group">
              <label className="form-label">Phone *</label>
              <input
                id="inv-form-phone"
                className={`form-input${formErrors.phone ? ' is-invalid' : ''}`}
                placeholder="e.g. +91 98765 43210"
                value={form.phone}
                onChange={e => setField('phone', e.target.value)}
              />
              {formErrors.phone && <div className="form-error">{formErrors.phone}</div>}
            </div>
          </div>

          {/* Row: Email + Status */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input
                id="inv-form-email"
                className="form-input"
                placeholder="e.g. rajiv@example.com"
                value={form.email}
                onChange={e => setField('email', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Status</label>
              <select
                id="inv-form-status"
                className="form-select"
                value={form.status}
                onChange={e => setField('status', e.target.value as InvestorForm['status'])}
              >
                <option value="Lead">Lead</option>
                <option value="Active Investor">Active Investor</option>
                <option value="HNW Investor">HNW Investor</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
          </div>

          {/* Row: Capital Capacity + Preferred Asset Class */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">Investment Capacity</label>
              <input
                id="inv-form-capacity"
                className="form-input"
                placeholder="e.g. ₹5 Cr"
                value={form.investmentCapacity}
                onChange={e => setField('investmentCapacity', e.target.value)}
              />
            </div>
            {!isExec && (
              <div className="form-group">
                <label className="form-label">Preferred Asset Class</label>
                <input
                  id="inv-form-asset-class"
                  className="form-input"
                  placeholder="e.g. Residential, Commercial"
                  value={form.preferredAssetClass}
                  onChange={e => setField('preferredAssetClass', e.target.value)}
                />
              </div>
            )}
          </div>

          {/* Row: Committed AUM + Risk Tolerance */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">Committed AUM</label>
              <input
                id="inv-form-aum"
                className="form-input"
                placeholder="e.g. ₹2.5 Cr"
                value={form.committedAUM}
                onChange={e => setField('committedAUM', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Risk Tolerance</label>
              <select
                id="inv-form-risk"
                className="form-select"
                value={form.riskTolerance}
                onChange={e =>
                  setField(
                    'riskTolerance',
                    e.target.value as InvestorForm['riskTolerance'],
                  )
                }
              >
                <option value="">— Not specified —</option>
                <option value="Conservative">Conservative</option>
                <option value="Moderate">Moderate</option>
                <option value="Aggressive">Aggressive</option>
              </select>
            </div>
          </div>

          {/* Investment Mandate */}
          <div className="form-group">
            <label className="form-label">Investment Mandate</label>
            <input
              id="inv-form-mandate"
              className="form-input"
              placeholder="e.g. Long-term capital appreciation in Tier-1 commercial assets"
              value={form.investmentMandate}
              onChange={e => setField('investmentMandate', e.target.value)}
            />
          </div>

          {/* Row: Referral Source + Assigned Consultant */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">Referral Source</label>
              <input
                id="inv-form-referral"
                className="form-input"
                placeholder="e.g. Private Network, Bank"
                value={form.referralSource}
                onChange={e => setField('referralSource', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">
                Assigned Consultant
                {isExec && (
                  <span
                    style={{
                      marginLeft: 6,
                      fontSize: 11,
                      color: 'var(--text-muted)',
                      fontWeight: 400,
                    }}
                  >
                    (auto-assigned to you)
                  </span>
                )}
              </label>
              {isExec ? (
                <input
                  className="form-input"
                  value={form.assignedAgentName}
                  readOnly
                  style={{
                    backgroundColor: 'var(--bg-surface-hover)',
                    cursor: 'not-allowed',
                    color: 'var(--text-secondary)',
                  }}
                />
              ) : (
                <input
                  id="inv-form-consultant"
                  className="form-input"
                  placeholder="e.g. Ananya Iyer"
                  value={form.assignedAgentName}
                  onChange={e => {
                    setField('assignedAgentName', e.target.value);
                    setField('assignedAgentId', '');
                  }}
                />
              )}
            </div>
          </div>

          {/* Notes */}
          <div className="form-group">
            <label className="form-label">Notes</label>
            <textarea
              id="inv-form-notes"
              className="form-input"
              rows={3}
              placeholder="Advisory notes, risk profile summary, key investment preferences…"
              value={form.notes}
              onChange={e => setField('notes', e.target.value)}
              style={{ resize: 'vertical' }}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
};
