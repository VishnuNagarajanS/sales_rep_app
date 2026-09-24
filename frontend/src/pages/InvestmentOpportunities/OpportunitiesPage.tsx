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

  // ── Data loading ──────────────────────────────────────────────────────────
  const loadData = () => {
    setOpps(storageService.getOpportunities(tenant?.id));
    setInvestors(storageService.getInvestors(tenant?.id));
    setDeals(storageService.getDeals(tenant?.id));
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

  const irmColumns: Column<Deal>[] = [
    {
      key: 'customerName',
      header: 'Investor & Opportunity',
      sortable: true,
      render: deal => (
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
            {deal.customerName}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
            {deal.title}
          </div>
        </div>
      ),
    },
    {
      key: 'contact',
      header: 'Contact Details',
      render: deal => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 12, color: 'var(--text-secondary)' }}>
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
      ),
    },
    {
      key: 'investmentRange',
      header: 'Target Capital / Size',
      sortable: true,
      render: deal => (
        <span style={{ color: '#10b981', fontWeight: 800, fontSize: 13 }}>
          {deal.investmentRange || formatCurrency(deal.value)}
        </span>
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
      key: 'investorType',
      header: 'Investor Structure (AIF / Co-AIF)',
      render: deal => {
        const currentType = deal.investorType || 'AIF';
        return (
          <div className="irm-investor-type-toggle" onClick={e => e.stopPropagation()}>
            <button
              type="button"
              className={`irm-type-btn ${currentType === 'AIF' ? 'active' : ''}`}
              title="Classify as Direct AIF Investor"
              onClick={() => handleSetInvestorType(deal, 'AIF')}
            >
              AIF
            </button>
            <button
              type="button"
              className={`irm-type-btn ${currentType === 'Co-AIF' ? 'active' : ''}`}
              title="Classify as Co-Investment AIF Investor"
              onClick={() => handleSetInvestorType(deal, 'Co-AIF')}
            >
              Co-AIF
            </button>
          </div>
        );
      },
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
      key: 'stageEnteredAt',
      header: 'Stage Duration',
      render: deal => (
        <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 10, background: 'var(--bg-surface-hover)', border: '1px solid var(--border-base)', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <Clock size={11} /> {getDealDaysInStage(deal)}d
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Action',
      render: deal => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            type="button"
            className="btn btn-sm btn-ghost btn-icon"
            title={`Call ${deal.customerName}`}
            onClick={() => initiateCall(deal.customerName, deal.phone || '', 'customer', deal.id)}
          >
            <Phone size={14} color="#059669" />
          </button>
          <button
            type="button"
            className="irm-convert-btn"
            title="Convert deal (Mandate executed & funds committed)"
            onClick={() => handleAdvanceToConverted(deal)}
          >
            <CheckCircle size={13} /> Convert
          </button>
        </div>
      ),
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
    </div>
  );
};
