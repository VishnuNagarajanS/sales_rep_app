import React, { useState, useEffect } from 'react';
import { TrendingUp, Phone, ExternalLink, Edit2, Trash2, Download } from 'lucide-react';
import { Investor, CallRecord, Consultation, InvestmentOpportunity, Followup, Deal } from '../../types';
import Papa from 'papaparse';
import { useAuth } from '../../context/AuthContext';
import { useCall } from '../../context/CallContext';
import { storageService } from '../../services/storageService';
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
  status: 'Active Investor',
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

  const roleCode = user?.role?.code;
  const isExec = roleCode === 'sales_executive';
  const isIrm = roleCode === 'irm';
  const isGhlIrm = isIrm && tenant?.slug === 'ghl';
  const isGhlAdmin =
    (tenant?.slug === 'ghl' || tenant?.id === 't-ghl-01' || tenant?.id === '1') &&
    ['company_admin', 'admin', 'super_admin', 'ghl_admin'].includes(roleCode as string);

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
  const [docsTab, setDocsTab] = useState<'investor' | 'company'>('investor');

  // ── Filters ───────────────────────────────────────────────────────────────
  const [statusFilter, setStatusFilter] = useState('All');
  const [assetClassFilter, setAssetClassFilter] = useState('All');
  const [consultantFilter, setConsultantFilter] = useState('All');

  // ── Create / Edit modal ───────────────────────────────────────────────────
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingInvestor, setEditingInvestor] = useState<Investor | null>(null);
  const [form, setForm] = useState<InvestorForm>(BLANK_FORM);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof InvestorForm, string>>>({});

  const [loadError, setLoadError] = useState<string | null>(null);

  // ── Data loading ──────────────────────────────────────────────────────────
  const loadData = async () => {
    try {
      setLoadError(null);
      const [apiInvestors, apiDeals, apiCalls, apiConsultations, apiOpportunities, apiFollowups] = await Promise.all([
        getInvestors(tenant?.id),
        getDeals(tenant?.id),
        getCalls(tenant?.id),
        getConsultations(tenant?.id),
        getOpportunities(tenant?.id),
        getFollowups(tenant?.id),
      ]);
      setInvestors(apiInvestors || []);
      setDeals(apiDeals || []);
      setAllCalls(apiCalls || []);
      setAllConsultations(apiConsultations || []);
      setAllOpportunities(apiOpportunities || []);
      setAllFollowups(apiFollowups || []);
    } catch (err: any) {
      console.error('Failed to load investor data:', err);
      if (storageService.isMockMode()) {
        setInvestors(storageService.getInvestors(tenant?.id));
        setDeals(storageService.getDeals(tenant?.id));
        setAllCalls(storageService.getCalls(tenant?.id));
        setAllConsultations(storageService.getConsultations(tenant?.id));
        setAllOpportunities(storageService.getOpportunities(tenant?.id));
        setAllFollowups(storageService.getFollowups(tenant?.id));
      } else {
        setInvestors([]);
        setDeals([]);
        setAllCalls([]);
        setAllConsultations([]);
        setAllOpportunities([]);
        setAllFollowups([]);
        setLoadError(err?.message || 'Failed to load investor records from server.');
      }
    }
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
  // sales_executive and IRM see only their own investors; managers/admins see all
  const isScopedUser = isExec || isGhlIrm || isIrm;
  const scopedInvestors = isScopedUser
    ? investors.filter(
        inv =>
          (inv.assignedAgentId && String(inv.assignedAgentId) === String(user?.id)) ||
          (inv.assignedAgentName && inv.assignedAgentName === user?.name)
      )
    : investors;

  // Helper: locate matching deal for an investor record
  const getMatchingDeal = (inv: Investor): Deal | undefined => {
    const fDigits = (inv.phone || '').replace(/\D/g, '').slice(-10);
    return deals.find(d => {
      if (d.customerId && String(d.customerId) === String(inv.id)) return true;
      const dDigits = (d.phone || '').replace(/\D/g, '').slice(-10);
      if (fDigits && dDigits && dDigits === fDigits) return true;
      if (d.email && inv.email && d.email.trim().toLowerCase() === inv.email.trim().toLowerCase()) return true;
      if (d.customerName && inv.name && d.customerName.trim().toLowerCase() === inv.name.trim().toLowerCase()) return true;
      return false;
    });
  };

  // Only converted customers/investors belong in Investor 360
  const isConvertedInvestor = (inv: Investor): boolean => {
    const norm = (inv.status || '').toLowerCase().replace(/[\s_-]/g, '');
    if (norm === 'activeinvestor' || norm === 'hnwinvestor' || norm === 'active' || norm === 'converted') {
      return true;
    }
    const match = getMatchingDeal(inv);
    if (match && (match.stage === 'converted' || match.stage === 'won')) {
      return true;
    }
    return false;
  };

  const convertedInvestors = scopedInvestors.filter(isConvertedInvestor);

  // ── Filter options ────────────────────────────────────────────────────────
  const assetClassOptions = Array.from(new Set(convertedInvestors.map(inv => inv.preferredAssetClass)))
    .filter(Boolean)
    .map(cls => ({ value: cls, label: cls }));

  const consultantOptions = Array.from(new Set(convertedInvestors.map(inv => inv.assignedAgentName)))
    .filter(Boolean)
    .map(name => ({ value: name, label: name }));

  // ── Filtered list ─────────────────────────────────────────────────────────
  const filteredInvestors = convertedInvestors.filter(inv => {
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

  const handleSaveInvestor = async () => {
    if (!editingInvestor) return;

    const errors: Partial<Record<keyof InvestorForm, string>> = {};
    if (!form.name.trim()) errors.name = 'Name is required.';
    if (!form.phone.trim()) errors.phone = 'Phone is required.';
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    const investorPayload: Investor = {
      id: editingInvestor.id,
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
      createdAt: editingInvestor.createdAt,
      notes: form.notes.trim(),
      ...(form.committedAUM.trim() ? { committedAUM: form.committedAUM.trim() } : {}),
      ...(form.investmentMandate.trim() ? { investmentMandate: form.investmentMandate.trim() } : {}),
      ...(form.riskTolerance ? { riskTolerance: form.riskTolerance as Investor['riskTolerance'] } : {}),
    };

    try {
      const saved = await apiSaveInvestor(investorPayload);
      closeModal();
      setSelectedInvestor(saved);
      loadData();
    } catch (err) {
      console.error('[InvestorsPage] Failed to save investor:', err);
    }
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
      render: (inv: Investor) => <span style={{ fontSize: 12 }}>{inv.preferredAssetClass || '—'}</span>,
    } as Column<Investor>]),
    ...(isGhlIrm ? [{
      key: 'investmentAmount' as any,
      header: 'Investment Amount',
      sortable: true,
      render: (inv: Investor) => {
        const matchingDeal = getMatchingDeal(inv);
        const amt = matchingDeal?.value || (inv.committedAUM && !isNaN(Number(inv.committedAUM)) && Number(inv.committedAUM) > 0 ? Number(inv.committedAUM) : null);
        return (
          <span style={{ fontWeight: 700, color: amt ? '#059669' : 'var(--text-muted)', fontSize: 13 }}>
            {amt ? `₹${amt.toLocaleString('en-IN')}` : '—'}
          </span>
        );
      },
    } as Column<Investor>] : []),
    {
      key: 'status',
      header: 'KYC / Investor Status',
      sortable: true,
      render: inv => {
        const match = getMatchingDeal(inv);
        const displayStatus = (match && (match.stage === 'converted' || match.stage === 'won') && inv.status === 'Lead')
          ? 'Active Investor'
          : inv.status;
        return <StatusChip status={displayStatus} size="sm" />;
      },
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
      hidden: () => isGhlAdmin,
    },
    {
      label: 'Delete Investor',
      icon: <Trash2 size={14} color="#dc2626" style={{ marginRight: 6 }} />,
      onClick: inv => handleDeleteInvestor(inv),
      hidden: () => isGhlAdmin,
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
        </div>
      </div>

      {loadError && (
        <div
          className="alert-banner error"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            marginBottom: '16px',
            borderRadius: '8px',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#ef4444',
          }}
        >
          <span>{loadError}</span>
        </div>
      )}

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
        subtitle={isExec ? undefined : (selectedInvestor?.preferredAssetClass ? `Mandate: ${selectedInvestor.preferredAssetClass}` : undefined)}
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
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, fontFamily: 'monospace' }}>
                  ID: #{selectedInvestor.id}
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
                    {selectedInvestor.investmentCapacity || '—'}
                  </div>
                </div>
                <div>
                  <span style={{ color: 'var(--text-secondary)' }}>Preferred Asset Class:</span>
                  <div style={{ fontWeight: 600, marginTop: 4, fontSize: 14 }}>
                    {selectedInvestor.preferredAssetClass || '—'}
                  </div>
                </div>
                <div>
                  <span style={{ color: 'var(--text-secondary)' }}>Investment Mandate:</span>
                  <div style={{ fontWeight: 600, marginTop: 4, fontSize: 14 }}>
                    {selectedInvestor.investmentMandate || '—'}
                  </div>
                </div>
                <div>
                  <span style={{ color: 'var(--text-secondary)' }}>Risk Tolerance:</span>
                  <div style={{ fontWeight: 600, marginTop: 4, fontSize: 14 }}>
                    {selectedInvestor.riskTolerance || '—'}
                  </div>
                </div>
                {(() => {
                  const matchingDeal = deals.find(d => d.customerId === selectedInvestor.id || (d.phone && selectedInvestor.phone && d.phone.replace(/\D/g, '').slice(-10) === selectedInvestor.phone.replace(/\D/g, '').slice(-10)) || d.customerName.toLowerCase() === selectedInvestor.name.toLowerCase());
                  const amt = matchingDeal?.value || (selectedInvestor.committedAUM && !isNaN(Number(selectedInvestor.committedAUM)) && Number(selectedInvestor.committedAUM) > 0 ? Number(selectedInvestor.committedAUM) : null);
                  return (
                    <div>
                      <span style={{ color: 'var(--text-secondary)' }}>Investment Amount:</span>
                      <div style={{ fontWeight: 800, color: amt ? '#059669' : 'var(--text-muted)', marginTop: 4, fontSize: 15 }}>
                        {amt ? `₹${amt.toLocaleString('en-IN')}` : '—'}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>

            <div className="card investor-info-card">
              <h4 className="investor-info-title">
                Advisory Portfolio Notes
              </h4>
              <p className="investor-notes-text">
                {selectedInvestor.notes || '—'}
              </p>
            </div>

            {/* Documents */}
            <div className="card investor-info-card" style={{ padding: 0, overflow: 'hidden' }}>
              <div className="incall-docs-tabs-bar" style={{ borderBottom: '1px solid var(--border-light)' }}>
                {[
                  { id: 'investor' as const, label: 'Investor Documents' },
                  { id: 'company' as const, label: 'Company Resources' },
                ].map(tab => (
                  <button
                    key={tab.id}
                    className="btn btn-ghost incall-docs-tab-btn"
                    style={{
                      borderBottom: docsTab === tab.id ? '2px solid var(--primary-600)' : '2px solid transparent',
                      color: docsTab === tab.id ? 'var(--primary-600)' : 'var(--text-secondary)',
                      fontWeight: docsTab === tab.id ? 700 : 500,
                      borderRadius: 0,
                      padding: '12px 16px',
                    }}
                    onClick={() => setDocsTab(tab.id)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div style={{ padding: 20 }}>
                {docsTab === 'investor' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {!isGhlAdmin && (
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
                    )}
                    <DocumentList
                      entityType="investor"
                      entityId={selectedInvestor.id}
                      canDelete={!isGhlAdmin}
                    />
                  </div>
                )}
                {docsTab === 'company' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {isGhlAdmin && (
                      <DocumentUploader
                        entityType="company"
                        entityId={tenant?.id || tenant?.slug || '1'}
                        allowedCategories={['Brochure', 'Price List', 'Terms & Conditions', 'Policy Document', 'Other']}
                      />
                    )}
                    <DocumentList
                      entityType="company"
                      entityId={tenant?.id || tenant?.slug || '1'}
                      canDelete={isGhlAdmin}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </Drawer>

      {/* ── Edit Investor Modal ─────────────────────────────────────────── */}
      <Modal
        isOpen={isModalOpen && !!editingInvestor && !isGhlAdmin}
        onClose={closeModal}
        title="Edit Investor"
        subtitle={
          editingInvestor
            ? `Editing profile for ${editingInvestor.name}.`
            : ''
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
              Update Investor
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
