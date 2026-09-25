import React, { useState, useEffect } from 'react';
import {
  Briefcase,
  Plus,
  Phone,
  Edit2,
  Trash2,
  ArrowRight,
  Mail,
  MapPin,
  Clock,
  CheckCircle,
  FileText,
} from 'lucide-react';
import { InvestmentOpportunity, Investor, Deal, DealActivity } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useCall } from '../../context/CallContext';
import { storageService } from '../../services/storageService';
import { DataTable, Column, RowAction } from '../../components/common/DataTable';
import { StatusChip } from '../../components/common/StatusChip';
import { FilterBar } from '../../components/common/FilterBar';
import { Modal } from '../../components/common/Modal';
import './OpportunitiesPage.css';

// ─── Stage enum (full ordered list) ─────────────────────────────────────────
const STAGES: InvestmentOpportunity['stage'][] = [
  'Enquiry',
  'Contacted',
  'Consultation',
  'Qualified',
  'Opportunity',
  'Committed',
  'Closed Won',
  'Closed Lost',
];

const stageOptions = STAGES.map(s => ({ value: s, label: s }));

// ─── Form state shape ────────────────────────────────────────────────────────
interface OppForm {
  title: string;
  investorId: string;
  investorName: string;
  stage: InvestmentOpportunity['stage'];
  targetAmount: string;
  committedAmount: string;
  assignedAgentId: string;
  assignedAgentName: string;
  expectedCloseDate: string;
  notes: string;
}

const BLANK_OPP_FORM: OppForm = {
  title: '',
  investorId: '',
  investorName: '',
  stage: 'Enquiry',
  targetAmount: '',
  committedAmount: '',
  assignedAgentId: '',
  assignedAgentName: '',
  expectedCloseDate: '',
  notes: '',
};

// ─── Component ───────────────────────────────────────────────────────────────
export const OpportunitiesPage: React.FC = () => {
  const { tenant, user } = useAuth();
  const { initiateCall } = useCall();

  // ── Role scoping ──────────────────────────────────────────────────────────
  const roleCode = user?.role?.code;
  const isExec = roleCode === 'sales_executive';
  const isIrm = roleCode === 'irm';
  const isGhlIrm = isIrm && tenant?.slug === 'ghl';

  // ── Core data ─────────────────────────────────────────────────────────────
  const [opps, setOpps] = useState<InvestmentOpportunity[]>([]);
  const [investors, setInvestors] = useState<Investor[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // ── Filters ───────────────────────────────────────────────────────────────
  const [stageFilter, setStageFilter] = useState('All');
  const [agentFilter, setAgentFilter] = useState('All');

  // ── Create / Edit modal ───────────────────────────────────────────────────
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingOpp, setEditingOpp] = useState<InvestmentOpportunity | null>(null);
  const [form, setForm] = useState<OppForm>(BLANK_OPP_FORM);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof OppForm, string>>>({});

  // ── Move Stage mini-modal ─────────────────────────────────────────────────
  const [stageModalOpp, setStageModalOpp] = useState<InvestmentOpportunity | null>(null);
  const [newStage, setNewStage] = useState<InvestmentOpportunity['stage']>('Enquiry');

  // ── IRM Customer Detail Modal state ───────────────────────────────────────
  const [detailDeal, setDetailDeal] = useState<Deal | null>(null);
  const [amountInput, setAmountInput] = useState<string>('');
  const [isEditingAmount, setIsEditingAmount] = useState<boolean>(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState<boolean>(false);

  // ── Data loading ──────────────────────────────────────────────────────────
  const loadData = () => {
    setOpps(storageService.getOpportunities(tenant?.id));
    setInvestors(storageService.getInvestors(tenant?.id));
    const latestDeals = storageService.getDeals(tenant?.id);
    setDeals(latestDeals);
    setDetailDeal(prev => {
      if (!prev) return null;
      const fresh = latestDeals.find(d => d.id === prev.id);
      return fresh || prev;
    });
  };

  useEffect(() => {
    loadData();
    const handleUpdate = () => loadData();
    window.addEventListener('nexus_storage_updated', handleUpdate);
    return () => window.removeEventListener('nexus_storage_updated', handleUpdate);
  }, [tenant?.id]);

  // ── Role-based scoping ────────────────────────────────────────────────────
  const scopedOpps = isExec
    ? opps.filter(
      o =>
        (o.assignedAgentId && o.assignedAgentId === user?.id) ||
        (o.assignedAgentName && o.assignedAgentName === user?.name),
    )
    : opps;

  // ── Filter options ────────────────────────────────────────────────────────
  const agentOptions = Array.from(new Set(scopedOpps.map(o => o.assignedAgentName)))
    .filter(Boolean)
    .map(name => ({ value: name, label: name }));

  // ── Filtered list ─────────────────────────────────────────────────────────
  const filteredOpps = scopedOpps.filter(o => {
    if (stageFilter !== 'All' && o.stage !== stageFilter) return false;
    if (agentFilter !== 'All' && o.assignedAgentName !== agentFilter) return false;
    return true;
  });

  // ── Currency formatter ────────────────────────────────────────────────────
  const formatCurrency = (val: number) => {
    if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`;
    if (val >= 100000) return `₹${(val / 100000).toFixed(1)} L`;
    return `₹${val.toLocaleString('en-IN')}`;
  };

  // ── Modal helpers ─────────────────────────────────────────────────────────
  const openNewModal = () => {
    setEditingOpp(null);
    setForm({
      ...BLANK_OPP_FORM,
      assignedAgentId: isExec ? (user?.id ?? '') : '',
      assignedAgentName: isExec ? (user?.name ?? '') : '',
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  const openEditModal = (o: InvestmentOpportunity) => {
    setEditingOpp(o);
    setForm({
      title: o.title,
      investorId: o.investorId,
      investorName: o.investorName,
      stage: o.stage,
      targetAmount: String(o.targetAmount),
      committedAmount: String(o.committedAmount),
      assignedAgentId: o.assignedAgentId,
      assignedAgentName: o.assignedAgentName,
      expectedCloseDate: o.expectedCloseDate,
      notes: o.notes,
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingOpp(null);
    setForm(BLANK_OPP_FORM);
    setFormErrors({});
  };

  const setField = <K extends keyof OppForm>(key: K, value: OppForm[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
    if (formErrors[key]) setFormErrors(prev => ({ ...prev, [key]: undefined }));
  };

  const handleSaveOpp = () => {
    const errors: Partial<Record<keyof OppForm, string>> = {};
    if (!form.title.trim()) errors.title = 'Title is required.';
    if (!form.investorId) errors.investorId = 'Please select an investor.';
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    const now = new Date().toISOString().split('T')[0];
    const opp: InvestmentOpportunity = {
      id: editingOpp ? editingOpp.id : `opp-${Date.now()}`,
      companyId: tenant?.id ?? '',
      title: form.title.trim(),
      investorId: form.investorId,
      investorName: form.investorName,
      stage: form.stage,
      targetAmount: parseFloat(form.targetAmount) || 0,
      committedAmount: parseFloat(form.committedAmount) || 0,
      assignedAgentId: form.assignedAgentId.trim() || (user?.id ?? ''),
      assignedAgentName: form.assignedAgentName.trim() || (user?.name ?? ''),
      expectedCloseDate: form.expectedCloseDate || now,
      notes: form.notes.trim(),
    };

    storageService.saveOpportunity(opp);
    closeModal();
  };

  // ── Delete handler ────────────────────────────────────────────────────────
  const handleDeleteOpp = (o: InvestmentOpportunity) => {
    if (!window.confirm(`Delete opportunity "${o.title}"? This cannot be undone.`)) return;
    storageService.deleteOpportunity(o.id);
  };

  // ── Move Stage handlers ───────────────────────────────────────────────────
  const openStageModal = (o: InvestmentOpportunity) => {
    setStageModalOpp(o);
    setNewStage(o.stage);
  };

  const handleMoveStage = () => {
    if (!stageModalOpp) return;
    storageService.saveOpportunity({ ...stageModalOpp, stage: newStage });
    setStageModalOpp(null);
  };

  // ── Table columns ─────────────────────────────────────────────────────────
  const columns: Column<InvestmentOpportunity>[] = [
    {
      key: 'title',
      header: 'Commercial Asset / Tranche',
      sortable: true,
      render: o => (
        <div>
          <div className="opp-title-primary">{o.title}</div>
          <div className="opp-notes-sub">{o.notes}</div>
        </div>
      ),
    },
    {
      key: 'investorName',
      header: 'Lead Institutional Backer',
      sortable: true,
      render: o => <span className="opp-investor-text">{o.investorName}</span>,
    },
    {
      key: 'targetAmount',
      header: 'Target Tranche',
      sortable: true,
      render: o => <span className="opp-target-text">{formatCurrency(o.targetAmount)}</span>,
    },
    {
      key: 'committedAmount',
      header: 'Committed Capital',
      sortable: true,
      render: o => <span className="opp-committed-text">{formatCurrency(o.committedAmount)}</span>,
    },
    {
      key: 'stage',
      header: 'Syndicate Stage',
      sortable: true,
      render: o => <StatusChip status={o.stage} size="sm" />,
    },
    {
      key: 'assignedAgentName',
      header: 'Wealth Manager',
      render: o => <span style={{ fontSize: 12 }}>{o.assignedAgentName}</span>,
    },
    {
      key: 'expectedCloseDate',
      header: 'Target Execution',
      sortable: true,
    },
  ];

  // ── Row actions ───────────────────────────────────────────────────────────
  const rowActions: RowAction<InvestmentOpportunity>[] = [
    {
      label: 'Call Customer',
      icon: <Phone size={14} color="#059669" style={{ marginRight: 6 }} />,
      onClick: o => {
        const inv = investors.find(i => i.id === o.investorId);
        if (inv) initiateCall(inv.name, inv.phone, 'customer', inv.id);
      },
    },
    {
      label: 'Edit',
      icon: <Edit2 size={14} color="var(--primary-600)" style={{ marginRight: 6 }} />,
      onClick: o => openEditModal(o),
    },
    {
      label: 'Move Stage',
      icon: <ArrowRight size={14} style={{ marginRight: 6 }} />,
      onClick: o => openStageModal(o),
    },
    {
      label: 'Delete',
      icon: <Trash2 size={14} color="#dc2626" style={{ marginRight: 6 }} />,
      onClick: o => handleDeleteOpp(o),
    },
  ];

  // ── IRM Stage & Investor Type Handlers ─────────────────────────────────────
  const irmDeals = deals.filter(d => d.stage === 'investment_opportunity');

  const handleSetInvestorType = (deal: Deal, type: 'AIF' | 'Co-AIF') => {
    const updatedDeal: Deal = {
      ...deal,
      investorType: type,
    };
    storageService.saveDeal(updatedDeal);

    const activity: DealActivity = {
      id: `act-${Date.now()}`,
      dealId: deal.id,
      companyId: tenant?.id || '',
      type: 'note',
      text: `Investor structure set to: ${type}`,
      loggedByName: user?.name || 'IRM User',
      loggedByRole: 'IRM',
      timestamp: new Date().toISOString(),
    };
    storageService.addDealActivity(activity);

    loadData();
    showToast(`Investor structure for "${deal.customerName}" set to ${type}`);
  };

  const handleAdvanceToConverted = (deal: Deal) => {
    const updatedDeal: Deal = {
      ...deal,
      stage: 'converted',
      stageEnteredAt: new Date().toISOString(),
    };
    storageService.saveDeal(updatedDeal);

    const activity: DealActivity = {
      id: `act-${Date.now()}`,
      dealId: deal.id,
      companyId: tenant?.id || '',
      type: 'stage_change',
      fromStage: 'investment_opportunity',
      toStage: 'converted',
      text: 'Investment Opportunity → Converted (Mandate Signed & Capital Transferred)',
      loggedByName: user?.name || 'IRM User',
      loggedByRole: 'IRM',
      timestamp: new Date().toISOString(),
    };
    storageService.addDealActivity(activity);

    loadData();
    showToast(`Deal "${deal.customerName}" converted successfully!`);
  };

  const getDealDaysInStage = (deal: Deal) => {
    const timestamp = deal.stageEnteredAt || deal.createdAt;
    if (!timestamp) return 0;
    const time = new Date(timestamp).getTime();
    if (isNaN(time)) return 0;
    const diffMs = new Date().getTime() - time;
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    return Math.max(0, days);
  };

  // ── IRM Customer Detail & Investment Amount Handlers ───────────────────────
  const handleOpenDetailModal = (deal: Deal) => {
    setDetailDeal(deal);
    setAmountInput(deal.value ? String(deal.value) : '');
    setIsEditingAmount(false);
    setShowConfirmDialog(false);
  };

  const handleCloseDetailModal = () => {
    setDetailDeal(null);
    setIsEditingAmount(false);
    setShowConfirmDialog(false);
  };

  const handleEditAmount = () => {
    if (!detailDeal) return;
    const updatedDeal: Deal = {
      ...detailDeal,
      investmentAmountConfirmed: false,
    };
    storageService.saveDeal(updatedDeal);
    setDetailDeal(updatedDeal);
    setIsEditingAmount(true);
    setAmountInput(detailDeal.value ? String(detailDeal.value) : '');
    loadData();
  };

  const handleConfirmAmount = () => {
    if (!detailDeal) return;
    const numericAmount = parseFloat(amountInput) || 0;
    const updatedDeal: Deal = {
      ...detailDeal,
      value: numericAmount,
      investmentAmountConfirmed: true,
    };
    storageService.saveDeal(updatedDeal);
    setDetailDeal(updatedDeal);
    setIsEditingAmount(false);
    setShowConfirmDialog(false);
    loadData();
    showToast(`Investment amount confirmed for "${detailDeal.customerName}"`);
  };

  const getDealKycStatus = (deal: Deal): 'Pending' | 'Partially Completed' | 'Completed' => {
    const rawStatus = localStorage.getItem(`nexus_kyc_status_${deal.id}`);
    if (rawStatus === 'Completed' || rawStatus === 'Submitted for Review' || rawStatus === 'SEBI KYC Validated') {
      return 'Completed';
    }
    if (rawStatus === 'Partially Completed') {
      return 'Partially Completed';
    }
    if (rawStatus === 'Pending') {
      return 'Pending';
    }

    const savedDataStr = localStorage.getItem(`nexus_kyc_data_${deal.id}`);
    if (savedDataStr) {
      try {
        const data = JSON.parse(savedDataStr);
        if (data && typeof data === 'object') {
          const isAllFilled =
            Boolean(data.investorName?.trim()) &&
            Boolean(data.panNumber?.trim()) &&
            Boolean(data.bankAccountNumber?.trim() || data.accountNumber?.trim()) &&
            Boolean(data.bankIfsc?.trim() || data.ifscCode?.trim()) &&
            (Boolean(data.dematDoc) || data.hasNoDemat) &&
            Boolean(data.nominees && data.nominees.length > 0 && data.nominees[0]?.name?.trim());

          if (isAllFilled) return 'Completed';

          const isPartiallyFilled =
            Boolean(data.panNumber?.trim()) ||
            Boolean(data.aadhaarNumber?.trim()) ||
            Boolean(data.bankAccountNumber?.trim() || data.accountNumber?.trim()) ||
            Boolean(data.aadhaarDoc) ||
            Boolean(data.panDoc);

          if (isPartiallyFilled) return 'Partially Completed';
        }
      } catch { }
    }

    if ((deal as any).kycValidated === true) {
      return 'Completed';
    }

    return 'Pending';
  };

  const getKycFormData = (dealId: string) => {
    const raw = localStorage.getItem(`nexus_kyc_data_${dealId}`);
    if (!raw) return null;
    try {
      const data = JSON.parse(raw);
      if (!data || typeof data !== 'object') return null;
      const hasContent = Object.entries(data).some(([k, val]) => {
        if (k === 'hasNoDemat' && val === true) return true;
        if (Array.isArray(val)) {
          return val.length > 0 && val.some((item: any) => item && (item.name?.trim() || item.relationship));
        }
        if (typeof val === 'object' && val !== null) {
          return Boolean((val as any).name);
        }
        if (typeof val === 'string') {
          return val.trim() !== '' && val.trim() !== '+91';
        }
        return Boolean(val);
      });
      return hasContent ? data : null;
    } catch {
      return null;
    }
  };

  const irmColumns: Column<Deal>[] = [
    {
      key: 'customerName',
      header: 'Name & Contact',
      sortable: true,
      render: deal => (
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
            {deal.customerName}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 4, fontSize: 12, color: 'var(--text-secondary)' }}>
            {deal.phone && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Phone size={12} color="var(--text-muted)" />
                <span>{deal.phone}</span>
              </div>
            )}
            {deal.email && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Mail size={12} color="var(--text-muted)" />
                <span style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {deal.email}
                </span>
              </div>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'investmentRange',
      header: 'Investment Capacity',
      sortable: true,
      render: deal => (
        <span style={{ color: '#10b981', fontWeight: 800, fontSize: 13 }}>
          {deal.investmentRange || '—'}
        </span>
      ),
    },
    {
      key: 'value',
      header: 'Investment Amount',
      sortable: true,
      render: deal => (
        deal.investmentAmountConfirmed ? (
          <span style={{ color: '#10b981', fontWeight: 800, fontSize: 13 }}>
            {formatCurrency(deal.value)}
          </span>
        ) : (
          <span style={{ color: 'var(--text-muted, #94a3b8)', fontWeight: 600, fontSize: 13 }}>
            —
          </span>
        )
      ),
    },
    {
      key: 'preferredAssetClass',
      header: 'Preferred Asset Class',
      render: deal => (
        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
          {deal.preferredAssetClass || 'Commercial Pre-Leased'}
        </span>
      ),
    },
    {
      key: 'assignedAgentName',
      header: 'Assigned IRM',
      render: deal => (
        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
          {deal.assignedAgentName || 'Ananya Iyer'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Action',
      render: deal => {
        const isConfirmed = Boolean(deal.investmentAmountConfirmed);
        return (
          <button
            type="button"
            className="irm-convert-btn"
            title={
              isConfirmed
                ? 'Convert deal (Mandate executed & funds committed)'
                : 'Set the investment amount before converting.'
            }
            disabled={!isConfirmed}
            onClick={e => {
              e.stopPropagation();
              if (isConfirmed) {
                handleAdvanceToConverted(deal);
              }
            }}
            style={{
              opacity: isConfirmed ? 1 : 0.45,
              cursor: isConfirmed ? 'pointer' : 'not-allowed',
            }}
          >
            <CheckCircle size={13} /> Convert
          </button>
        );
      },
    },
  ];

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="opportunities-page">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            backgroundColor: '#059669',
            color: '#fff',
            padding: '12px 20px',
            borderRadius: 8,
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          <CheckCircle size={18} /> {toastMessage}
        </div>
      )}

      <div className="page-header">
        <div>
          <h1 className="page-title">
            <Briefcase size={24} color={isGhlIrm ? '#ec4899' : '#0284c7'} />{' '}
            {isGhlIrm ? 'Investment Opportunities & Term Sheets' : 'Investment Opportunities Syndicate'}
          </h1>
          <p className="page-subtitle">
            {isGhlIrm
              ? 'Pitch deck shared, term sheet under review, legal team active. Classify investor structure (AIF vs Co-AIF).'
              : `Commercial real-estate fractional tranches, warehousing yields, and capital commitments for ${tenant?.name}.`}
          </p>
        </div>

        {!isGhlIrm && (
          <button
            id="opps-new-opportunity"
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}
            onClick={openNewModal}
          >
            <Plus size={15} /> New Opportunity
          </button>
        )}
      </div>

      {/* ── Data table ───────────────────────────────────────────────────── */}
      {isGhlIrm ? (
        <DataTable
          columns={irmColumns}
          data={irmDeals}
          keyExtractor={d => d.id}
          onRowClick={deal => handleOpenDetailModal(deal)}
          searchPlaceholder="Search opportunities by investor, deal, or asset class..."
          emptyTitle="No Investment Opportunities"
          emptyDescription="No deals currently in the Investment Opportunity stage."
        />
      ) : (
        <DataTable
          columns={columns}
          data={filteredOpps}
          keyExtractor={o => o.id}
          rowActions={rowActions}
          onRowClick={o => openEditModal(o)}
          searchPlaceholder="Search opportunities by asset title or investor..."
          filtersNode={
            <FilterBar
              filters={[
                {
                  key: 'stage',
                  label: 'Stage',
                  value: stageFilter,
                  onChange: setStageFilter,
                  options: stageOptions,
                },
                {
                  key: 'agent',
                  label: 'Agent',
                  value: agentFilter,
                  onChange: setAgentFilter,
                  options: agentOptions,
                },
              ]}
              onClearAll={() => {
                setStageFilter('All');
                setAgentFilter('All');
              }}
            />
          }
        />
      )}

      {/* ── Create / Edit Opportunity Modal ──────────────────────────────── */}
      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={editingOpp ? 'Edit Opportunity' : 'New Investment Opportunity'}
        subtitle={
          editingOpp
            ? `Editing "${editingOpp.title}"`
            : 'Create a new capital syndication opportunity linked to a real investor.'
        }
        maxWidth={640}
        footer={
          <>
            <button className="btn btn-secondary" onClick={closeModal}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleSaveOpp}>
              {editingOpp ? 'Update Opportunity' : 'Save Opportunity'}
            </button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Title */}
          <div className="form-group">
            <label className="form-label">Opportunity Title *</label>
            <input
              id="opp-form-title"
              className={`form-input${formErrors.title ? ' is-invalid' : ''}`}
              placeholder="e.g. Warehouse Tranche A — Phase II"
              value={form.title}
              onChange={e => setField('title', e.target.value)}
            />
            {formErrors.title && <div className="form-error">{formErrors.title}</div>}
          </div>

          {/* Row: Investor + Stage */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">Investor *</label>
              <select
                id="opp-form-investor"
                className={`form-select${formErrors.investorId ? ' is-invalid' : ''}`}
                value={form.investorId}
                onChange={e => {
                  const inv = investors.find(i => i.id === e.target.value);
                  setField('investorId', e.target.value);
                  setField('investorName', inv?.name ?? '');
                }}
              >
                <option value="">— Select Investor —</option>
                {investors.map(inv => (
                  <option key={inv.id} value={inv.id}>
                    {inv.name}
                  </option>
                ))}
              </select>
              {formErrors.investorId && (
                <div className="form-error">{formErrors.investorId}</div>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Stage</label>
              <select
                id="opp-form-stage"
                className="form-select"
                value={form.stage}
                onChange={e =>
                  setField('stage', e.target.value as InvestmentOpportunity['stage'])
                }
              >
                {STAGES.map(s => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Row: Target Amount + Committed Amount */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">Target Amount (₹)</label>
              <input
                id="opp-form-target"
                className="form-input"
                placeholder="e.g. 5000000"
                type="number"
                min="0"
                value={form.targetAmount}
                onChange={e => setField('targetAmount', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Committed Amount (₹)</label>
              <input
                id="opp-form-committed"
                className="form-input"
                placeholder="e.g. 2500000"
                type="number"
                min="0"
                value={form.committedAmount}
                onChange={e => setField('committedAmount', e.target.value)}
              />
            </div>
          </div>

          {/* Row: Assigned Agent + Expected Close Date */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">
                Assigned Agent
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
                  id="opp-form-agent"
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

            <div className="form-group">
              <label className="form-label">Expected Close Date</label>
              <input
                id="opp-form-close-date"
                className="form-input"
                type="date"
                value={form.expectedCloseDate}
                onChange={e => setField('expectedCloseDate', e.target.value)}
              />
            </div>
          </div>

          {/* Notes */}
          <div className="form-group">
            <label className="form-label">Notes</label>
            <textarea
              id="opp-form-notes"
              className="form-input"
              rows={3}
              placeholder="Deal highlights, key terms, risk summary…"
              value={form.notes}
              onChange={e => setField('notes', e.target.value)}
              style={{ resize: 'vertical' }}
            />
          </div>
        </div>
      </Modal>

      {/* ── Move Stage Mini-Modal ─────────────────────────────────────────── */}
      <Modal
        isOpen={!!stageModalOpp}
        onClose={() => setStageModalOpp(null)}
        title="Move Stage"
        subtitle={stageModalOpp ? `Update stage for: "${stageModalOpp.title}"` : ''}
        maxWidth={400}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setStageModalOpp(null)}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleMoveStage}>
              Update Stage
            </button>
          </>
        }
      >
        <div className="form-group">
          <label className="form-label">New Stage</label>
          <select
            id="opp-stage-select"
            className="form-select"
            value={newStage}
            onChange={e =>
              setNewStage(e.target.value as InvestmentOpportunity['stage'])
            }
          >
            {STAGES.map(s => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          {stageModalOpp && (
            <div
              style={{
                marginTop: 10,
                fontSize: 12,
                color: 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              Current:{' '}
              <StatusChip status={stageModalOpp.stage} size="sm" />
              {newStage !== stageModalOpp.stage && (
                <>
                  <ArrowRight size={13} />
                  <StatusChip status={newStage} size="sm" />
                </>
              )}
            </div>
          )}
        </div>
      </Modal>

      {/* ── Customer Detail Card Modal (IRM Only) ────────────────────────── */}
      {detailDeal && (
        <Modal
          isOpen={!!detailDeal}
          onClose={handleCloseDetailModal}
          title="Customer Detail Card"
          subtitle={`${detailDeal.customerName} • Deal Details`}
          maxWidth={760}
          footer={
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleCloseDetailModal}
            >
              Close
            </button>
          }
        >
          {(() => {
            const kycStatus = getDealKycStatus(detailDeal);
            const kycBadgeStyles = {
              Completed: { bg: '#ecfdf5', color: '#059669', border: '#a7f3d0' },
              'Partially Completed': { bg: '#fffbeb', color: '#d97706', border: '#fde68a' },
              Pending: { bg: '#f8fafc', color: '#64748b', border: '#cbd5e1' },
            }[kycStatus];
            const kycData = getKycFormData(detailDeal.id);
            const isConfirmed = Boolean(detailDeal.investmentAmountConfirmed) && !isEditingAmount;

            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* Header: Customer Name, Phone, Email */}
                <div
                  style={{
                    padding: '16px 20px',
                    borderRadius: 10,
                    background: 'var(--bg-surface-hover, #f8fafc)',
                    border: '1px solid var(--border-color, #e2e8f0)',
                    display: 'flex',
                    flexWrap: 'wrap',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 16,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
                      {detailDeal.customerName}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 6, fontSize: 13, color: 'var(--text-secondary)' }}>
                      {detailDeal.phone && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Phone size={13} color="var(--text-muted)" />
                          <span>{detailDeal.phone}</span>
                        </div>
                      )}
                      {detailDeal.email && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Mail size={13} color="var(--text-muted)" />
                          <span>{detailDeal.email}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Top Row: KYC Status & Investment Amount */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
                  {/* KYC Status Section */}
                  <div
                    style={{
                      padding: '16px',
                      borderRadius: 10,
                      border: '1px solid var(--border-color, #e2e8f0)',
                      background: 'var(--bg-surface, #ffffff)',
                    }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 10 }}>
                      KYC Status
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          padding: '4px 12px',
                          borderRadius: 9999,
                          fontSize: 12,
                          fontWeight: 700,
                          backgroundColor: kycBadgeStyles.bg,
                          color: kycBadgeStyles.color,
                          border: `1px solid ${kycBadgeStyles.border}`,
                        }}
                      >
                        {kycStatus}
                      </span>
                    </div>
                  </div>

                  {/* Investment Amount Section (Editable) */}
                  <div
                    style={{
                      padding: '16px',
                      borderRadius: 10,
                      border: '1px solid var(--border-color, #e2e8f0)',
                      background: 'var(--bg-surface, #ffffff)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Investment Amount
                      </span>
                      {isConfirmed ? (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: '3px 8px',
                            borderRadius: 9999,
                            fontSize: 11,
                            fontWeight: 700,
                            backgroundColor: '#ecfdf5',
                            color: '#059669',
                            border: '1px solid #a7f3d0',
                          }}
                        >
                          Confirmed
                        </span>
                      ) : (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: '3px 8px',
                            borderRadius: 9999,
                            fontSize: 11,
                            fontWeight: 700,
                            backgroundColor: '#fffbeb',
                            color: '#d97706',
                            border: '1px solid #fde68a',
                          }}
                        >
                          Unconfirmed
                        </span>
                      )}
                    </div>

                    {isConfirmed ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ flex: 1, position: 'relative' }}>
                          <input
                            type="text"
                            readOnly
                            className="form-input"
                            value={formatCurrency(detailDeal.value)}
                            style={{
                              width: '100%',
                              fontSize: 14,
                              fontWeight: 700,
                              color: '#10b981',
                              height: 38,
                              backgroundColor: 'var(--bg-surface-hover, #f8fafc)',
                              cursor: 'default',
                            }}
                          />
                        </div>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={handleEditAmount}
                          style={{ display: 'flex', alignItems: 'center', gap: 6, height: 38, padding: '0 14px' }}
                        >
                          <Edit2 size={13} /> Edit
                        </button>
                      </div>
                    ) : (
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ position: 'relative', flex: 1 }}>
                            <input
                              type="number"
                              min="0"
                              step="100000"
                              className="form-input"
                              placeholder="Enter amount in ₹"
                              value={amountInput}
                              onChange={e => setAmountInput(e.target.value)}
                              style={{ width: '100%', fontSize: 13, height: 38 }}
                            />
                          </div>
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            disabled={!amountInput || parseFloat(amountInput) <= 0}
                            onClick={() => {
                              const val = parseFloat(amountInput);
                              if (val && val > 0) {
                                setShowConfirmDialog(true);
                              }
                            }}
                            style={{ display: 'flex', alignItems: 'center', gap: 6, height: 38, padding: '0 14px' }}
                          >
                            <CheckCircle size={13} /> Confirm
                          </button>
                        </div>
                        <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-secondary)' }}>
                          Display format: <strong style={{ color: '#10b981' }}>{formatCurrency(parseFloat(amountInput) || 0)}</strong>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Form Details Section */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                    Form Details
                  </div>

                  {!kycData ? (
                    <div
                      style={{
                        padding: '24px',
                        borderRadius: 8,
                        background: 'var(--bg-surface-hover, #f8fafc)',
                        border: '1px dashed var(--border-color, #cbd5e1)',
                        color: 'var(--text-muted, #94a3b8)',
                        fontSize: 13,
                        textAlign: 'center',
                      }}
                    >
                      Not filled yet.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                      {/* 1. Basic Details */}
                      <div
                        style={{
                          border: '1px solid var(--border-color, #e2e8f0)',
                          borderRadius: 8,
                          padding: '16px',
                          background: 'var(--bg-surface, #ffffff)',
                        }}
                      >
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 12 }}>
                          1. Basic Details
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px 16px', fontSize: 13 }}>
                          <div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Investor Name</div>
                            <div style={{ color: 'var(--text-primary)', fontWeight: 500, marginTop: 2 }}>{kycData.investorName || detailDeal.customerName || '—'}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Phone</div>
                            <div style={{ color: 'var(--text-primary)', fontWeight: 500, marginTop: 2 }}>{kycData.phone || detailDeal.phone || '—'}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Email</div>
                            <div style={{ color: 'var(--text-primary)', fontWeight: 500, marginTop: 2 }}>{kycData.email || detailDeal.email || '—'}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Gender</div>
                            <div style={{ color: 'var(--text-primary)', fontWeight: 500, marginTop: 2 }}>{kycData.gender || '—'}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Investor Type</div>
                            <div style={{ color: 'var(--text-primary)', fontWeight: 500, marginTop: 2 }}>{kycData.investorType || '—'}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Resident Type</div>
                            <div style={{ color: 'var(--text-primary)', fontWeight: 500, marginTop: 2 }}>{kycData.residentType || '—'}</div>
                          </div>
                          {kycData.occupation && (
                            <div>
                              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Occupation</div>
                              <div style={{ color: 'var(--text-primary)', fontWeight: 500, marginTop: 2 }}>{kycData.occupation}</div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* 2. Identity Details & Address */}
                      <div
                        style={{
                          border: '1px solid var(--border-color, #e2e8f0)',
                          borderRadius: 8,
                          padding: '16px',
                          background: 'var(--bg-surface, #ffffff)',
                        }}
                      >
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 12 }}>
                          2. Identity Details & Address
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px 16px', fontSize: 13 }}>
                          <div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>PAN Number</div>
                            <div style={{ color: 'var(--text-primary)', fontWeight: 600, marginTop: 2, fontFamily: 'monospace' }}>{kycData.panNumber || '—'}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Name as per PAN</div>
                            <div style={{ color: 'var(--text-primary)', fontWeight: 500, marginTop: 2 }}>{kycData.nameAsPerPan || '—'}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Aadhaar Number</div>
                            <div style={{ color: 'var(--text-primary)', fontWeight: 500, marginTop: 2, fontFamily: 'monospace' }}>
                              {kycData.aadhaarNumber ? (kycData.aadhaarNumber.length >= 4 ? `•••• •••• ${kycData.aadhaarNumber.slice(-4)}` : kycData.aadhaarNumber) : '—'}
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Father's Name</div>
                            <div style={{ color: 'var(--text-primary)', fontWeight: 500, marginTop: 2 }}>{kycData.fatherName || '—'}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Date of Birth</div>
                            <div style={{ color: 'var(--text-primary)', fontWeight: 500, marginTop: 2 }}>{kycData.dob || '—'}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>City / State / Pincode</div>
                            <div style={{ color: 'var(--text-primary)', fontWeight: 500, marginTop: 2 }}>
                              {[kycData.city, kycData.state, kycData.pincode].filter(Boolean).join(', ') || '—'}
                            </div>
                          </div>
                          {kycData.address && (
                            <div style={{ gridColumn: '1 / -1' }}>
                              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Address</div>
                              <div style={{ color: 'var(--text-primary)', fontWeight: 500, marginTop: 2 }}>{kycData.address}</div>
                            </div>
                          )}
                          {(kycData.panDoc || kycData.aadhaarDoc) && (
                            <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 4 }}>
                              {kycData.panDoc && (
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, background: 'var(--bg-surface-hover, #f1f5f9)', padding: '4px 10px', borderRadius: 6 }}>
                                  <FileText size={13} color="#0284c7" />
                                  <span>PAN Document: {kycData.panDoc.name || 'Uploaded'}</span>
                                </div>
                              )}
                              {kycData.aadhaarDoc && (
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, background: 'var(--bg-surface-hover, #f1f5f9)', padding: '4px 10px', borderRadius: 6 }}>
                                  <FileText size={13} color="#0284c7" />
                                  <span>Aadhaar Document: {kycData.aadhaarDoc.name || 'Uploaded'}</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* 3. Bank Details */}
                      <div
                        style={{
                          border: '1px solid var(--border-color, #e2e8f0)',
                          borderRadius: 8,
                          padding: '16px',
                          background: 'var(--bg-surface, #ffffff)',
                        }}
                      >
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 12 }}>
                          3. Bank Details
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px 16px', fontSize: 13 }}>
                          <div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Bank Name</div>
                            <div style={{ color: 'var(--text-primary)', fontWeight: 500, marginTop: 2 }}>{kycData.bankName || '—'}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Branch Name</div>
                            <div style={{ color: 'var(--text-primary)', fontWeight: 500, marginTop: 2 }}>{kycData.branchName || '—'}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Account Number</div>
                            <div style={{ color: 'var(--text-primary)', fontWeight: 600, marginTop: 2, fontFamily: 'monospace' }}>
                              {kycData.accountNumber || kycData.bankAccountNumber || '—'}
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>IFSC Code</div>
                            <div style={{ color: 'var(--text-primary)', fontWeight: 600, marginTop: 2, fontFamily: 'monospace' }}>
                              {kycData.ifscCode || kycData.bankIfsc || '—'}
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Account Type</div>
                            <div style={{ color: 'var(--text-primary)', fontWeight: 500, marginTop: 2 }}>{kycData.accountType || 'Savings'}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Account Holder</div>
                            <div style={{ color: 'var(--text-primary)', fontWeight: 500, marginTop: 2 }}>{kycData.accountHolderName || detailDeal.customerName || '—'}</div>
                          </div>
                          {kycData.bankProofDoc && (
                            <div style={{ gridColumn: '1 / -1', marginTop: 4 }}>
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, background: 'var(--bg-surface-hover, #f1f5f9)', padding: '4px 10px', borderRadius: 6 }}>
                                <FileText size={13} color="#0284c7" />
                                <span>Bank Proof: {kycData.bankProofDoc.name || 'Uploaded'}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* 4. Demat Account */}
                      <div
                        style={{
                          border: '1px solid var(--border-color, #e2e8f0)',
                          borderRadius: 8,
                          padding: '16px',
                          background: 'var(--bg-surface, #ffffff)',
                        }}
                      >
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 12 }}>
                          4. Demat Account
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px 16px', fontSize: 13 }}>
                          <div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Demat Status</div>
                            <div style={{ color: 'var(--text-primary)', fontWeight: 500, marginTop: 2 }}>
                              {kycData.hasNoDemat ? 'No Demat Account' : 'Demat Linked'}
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Account / Client ID</div>
                            <div style={{ color: 'var(--text-primary)', fontWeight: 500, marginTop: 2, fontFamily: 'monospace' }}>
                              {kycData.dematAccountNumber || [kycData.dematDpId, kycData.dematClientId].filter(Boolean).join(' / ') || '—'}
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Depository</div>
                            <div style={{ color: 'var(--text-primary)', fontWeight: 500, marginTop: 2 }}>{kycData.dematDepository || '—'}</div>
                          </div>
                          {kycData.dematDoc && (
                            <div style={{ gridColumn: '1 / -1', marginTop: 4 }}>
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, background: 'var(--bg-surface-hover, #f1f5f9)', padding: '4px 10px', borderRadius: 6 }}>
                                <FileText size={13} color="#0284c7" />
                                <span>Demat Document: {kycData.dematDoc.name || 'Uploaded'}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* 5. Nominee Details */}
                      <div
                        style={{
                          border: '1px solid var(--border-color, #e2e8f0)',
                          borderRadius: 8,
                          padding: '16px',
                          background: 'var(--bg-surface, #ffffff)',
                        }}
                      >
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 12 }}>
                          5. Nominee Details
                        </div>
                        {kycData.nominees && kycData.nominees.length > 0 && kycData.nominees.some((n: any) => n.name?.trim()) ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {kycData.nominees.map((nom: any, idx: number) => (
                              <div
                                key={nom.id || idx}
                                style={{
                                  display: 'grid',
                                  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                                  gap: '8px 14px',
                                  fontSize: 13,
                                  padding: '10px 14px',
                                  borderRadius: 6,
                                  background: 'var(--bg-surface-hover, #f8fafc)',
                                }}
                              >
                                <div>
                                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Nominee Name</div>
                                  <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{nom.name || '—'}</div>
                                </div>
                                <div>
                                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Relationship</div>
                                  <div style={{ color: 'var(--text-primary)' }}>{nom.relationship || '—'}</div>
                                </div>
                                <div>
                                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Allocation</div>
                                  <div style={{ color: '#10b981', fontWeight: 600 }}>{nom.allocationPercentage ? `${nom.allocationPercentage}%` : '—'}</div>
                                </div>
                                <div>
                                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Date of Birth</div>
                                  <div style={{ color: 'var(--text-primary)' }}>{nom.dob || '—'}</div>
                                </div>
                                {nom.guardianName && (
                                  <div>
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Guardian</div>
                                    <div style={{ color: 'var(--text-primary)' }}>{nom.guardianName}</div>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>No nominee details recorded.</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </Modal>
      )}

      {/* ── Confirm Investment Amount Dialog ──────────────────────────────── */}
      <Modal
        isOpen={showConfirmDialog}
        onClose={() => setShowConfirmDialog(false)}
        title="Confirm Investment Amount"
        maxWidth={460}
        footer={
          <>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setShowConfirmDialog(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleConfirmAmount}
            >
              Confirm
            </button>
          </>
        }
      >
        <div style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.6 }}>
          Set investment amount to{' '}
          <strong style={{ color: '#10b981' }}>
            {formatCurrency(parseFloat(amountInput) || 0)}
          </strong>{' '}
          for <strong>{detailDeal?.customerName}</strong>? This will be used for conversion.
        </div>
      </Modal>
    </div>
  );
};
