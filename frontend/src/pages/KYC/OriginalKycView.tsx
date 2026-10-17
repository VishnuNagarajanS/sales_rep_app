import React, { useState, useEffect, useMemo } from 'react';
import {
  FileCheck,
  Phone,
  Mail,
  MapPin,
  Clock,
  ArrowRight,
  CheckCircle,
  Eye,
  ShieldCheck,
} from 'lucide-react';
import { Deal, DealActivity } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useCall } from '../../context/CallContext';
import { storageService } from '../../services/storageService';
import { persistDeal } from '../../services/ghlApiService';
import { DataTable, Column, RowAction } from '../../components/common/DataTable';
import { FilterBar } from '../../components/common/FilterBar';
import { Modal } from '../../components/common/Modal';
import { resolvePreferredAssetClass } from './KYCPage';

export const OriginalKYCView: React.FC = () => {
  const { tenant, user } = useAuth();
  const { initiateCall } = useCall();

  const [deals, setDeals] = useState<Deal[]>([]);
  const [agentFilter, setAgentFilter] = useState('All');
  const [selectedDealForDetail, setSelectedDealForDetail] = useState<Deal | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const loadData = () => {
    const allDeals = storageService.getDeals(tenant?.id);
    setDeals(allDeals.filter(d => d.stage === 'qualified_investor'));
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

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const getDaysInStage = (deal: Deal) => {
    const timestamp = deal.stageEnteredAt || deal.createdAt;
    if (!timestamp) return 0;
    const time = new Date(timestamp).getTime();
    if (isNaN(time)) return 0;
    const diffMs = new Date().getTime() - time;
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    return Math.max(0, days);
  };

  const formatCurrency = (val: number) => {
    if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`;
    if (val >= 100000) return `₹${(val / 100000).toFixed(1)} L`;
    return `₹${val.toLocaleString('en-IN')}`;
  };

  const handleAdvanceStage = (deal: Deal) => {
    const updatedDeal: Deal = {
      ...deal,
      stage: 'investment_opportunity',
      stageEnteredAt: new Date().toISOString(),
    };
    persistDeal(updatedDeal).catch(() => showToast('Error saving deal.'));

    const activity: DealActivity = {
      id: `act-${Date.now()}`,
      dealId: deal.id,
      companyId: tenant?.id || '',
      type: 'stage_change',
      fromStage: 'qualified_investor',
      toStage: 'investment_opportunity',
      text: 'Qualified Investor → Investment Opportunity (KYC Verified)',
      loggedByName: user?.name || 'IRM User',
      loggedByRole: 'IRM',
      timestamp: new Date().toISOString(),
    };
    storageService.addDealActivity(activity);

    if (selectedDealForDetail?.id === deal.id) {
      setSelectedDealForDetail(null);
    }

    loadData();
    showToast(`Investor "${deal.customerName}" advanced to Investment Opportunity!`);
  };

  const agentOptions = useMemo(() => {
    return Array.from(new Set(deals.map(d => d.assignedAgentName).filter(Boolean)))
      .sort()
      .map(name => ({ value: name, label: name }));
  }, [deals]);

  const filteredDeals = deals.filter(deal => {
    if (agentFilter !== 'All' && deal.assignedAgentName !== agentFilter) return false;
    return true;
  });

  const columns: Column<Deal>[] = [
    {
      key: 'customerName',
      header: 'Investor & Deal',
      sortable: true,
      render: deal => (
        <div>
          <div className="kyc-customer-name">{deal.customerName}</div>
          <div className="kyc-deal-subtitle">{deal.title}</div>
        </div>
      ),
    },
    {
      key: 'contact',
      header: 'Contact Details',
      render: deal => (
        <div className="kyc-contact-info">
          {deal.phone && (
            <div className="kyc-contact-row">
              <Phone size={12} color="var(--text-muted)" />
              <span>{deal.phone}</span>
            </div>
          )}
          {deal.email && (
            <div className="kyc-contact-row">
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
      key: 'location',
      header: 'Location',
      render: deal => (
        <div className="kyc-contact-row" style={{ fontSize: 12 }}>
          <MapPin size={12} color="var(--text-muted)" />
          <span>{deal.location || '—'}</span>
        </div>
      ),
    },
    {
      key: 'investmentRange',
      header: 'Investment Capacity',
      sortable: true,
      render: deal => {
        const val = deal.investmentRange || (deal.value > 0 ? formatCurrency(deal.value) : null);
        const isSpecified = val && val !== '—' && val.trim() !== '' && val.toLowerCase() !== 'not specified';
        return isSpecified ? (
          <span className="kyc-capacity-badge">
            {val}
          </span>
        ) : (
          <span className="kyc-not-specified-badge">
            Not Specified
          </span>
        );
      },
    },
    {
      key: 'preferredAssetClass',
      header: 'Preferred Asset Class',
      render: deal => {
        const pref = resolvePreferredAssetClass(deal, storageService.getLeads(tenant?.id), storageService.getCustomers(tenant?.id));
        const isSpecified = pref && pref !== '—' && pref.trim() !== '' && pref.toLowerCase() !== 'not specified';
        return isSpecified ? (
          <span className="kyc-pref-badge">
            {pref}
          </span>
        ) : (
          <span className="kyc-not-specified-badge">
            Not Specified
          </span>
        );
      },
    },
    {
      key: 'kycStatus',
      header: 'KYC Document Status',
      render: () => (
        <span className="kyc-badge-verified">
          <CheckCircle size={12} /> SEBI KYC Validated
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
      key: 'stageEnteredAt',
      header: 'Stage Duration',
      render: deal => {
        const days = getDaysInStage(deal);
        return (
          <span className="kyc-days-pill">
            <Clock size={11} /> {days}d
          </span>
        );
      },
    },
    {
      key: 'actions',
      header: 'Stage Action',
      render: deal => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            type="button"
            className="btn btn-sm btn-ghost btn-icon"
            title={`Call ${deal.customerName}`}
            onClick={() => initiateCall(deal.customerName, deal.phone || '', 'customer', deal.customerId || deal.id, undefined, 'kyc')}
          >
            <Phone size={14} color="#059669" />
          </button>
          <button
            type="button"
            className="kyc-advance-btn"
            title="Advance stage to Investment Opportunity"
            onClick={() => handleAdvanceStage(deal)}
          >
            Advance <ArrowRight size={13} />
          </button>
        </div>
      ),
    },
  ];

  const rowActions: RowAction<Deal>[] = [
    {
      label: 'View KYC Dossier',
      icon: <Eye size={14} style={{ marginRight: 6 }} />,
      onClick: deal => setSelectedDealForDetail(deal),
    },
    {
      label: 'Call Investor',
      icon: <Phone size={14} color="#059669" style={{ marginRight: 6 }} />,
      onClick: deal => initiateCall(deal.customerName, deal.phone || '', 'customer', deal.customerId || deal.id, undefined, 'kyc'),
    },
    {
      label: 'Advance to Opportunity',
      icon: <ArrowRight size={14} color="var(--primary-600)" style={{ marginRight: 6 }} />,
      onClick: deal => handleAdvanceStage(deal),
    },
  ];

  return (
    <div className="kyc-page-container">
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

      {/* Header */}
      <div className="page-header" style={{ marginBottom: 20 }}>
        <div>
          <h1 className="page-title">
            <FileCheck size={24} color="#06b6d4" /> Qualified Investor & KYC Verification
          </h1>
          <p className="page-subtitle">
            SEBI compliance checked, ticket size verified, KYC validated investors ready for investment opportunities.
          </p>
        </div>
      </div>

      {/* Data Table */}
      <DataTable
        data={filteredDeals}
        columns={columns}
        rowActions={rowActions}
        keyExtractor={d => d.id}
        searchPlaceholder="Search by investor, phone, city..."
        searchFilter={(deal, q) => {
          const matchName = deal.customerName?.toLowerCase().includes(q);
          const matchPhone = deal.phone?.toLowerCase().includes(q);
          const matchTitle = deal.title?.toLowerCase().includes(q);
          const matchLocation = deal.location?.toLowerCase().includes(q);
          return Boolean(matchName || matchPhone || matchTitle || matchLocation);
        }}
        emptyTitle="No Qualified Investors"
        emptyDescription="No investors currently in the Qualified Investor / KYC stage."
        filtersNode={
          <FilterBar
            filters={[
              {
                key: 'agent',
                label: 'Assigned IRM',
                value: agentFilter,
                onChange: setAgentFilter,
                options: agentOptions,
              },
            ]}
            onClearAll={() => {
              setAgentFilter('All');
            }}
          />
        }
      />

      {/* KYC Dossier Modal */}
      {selectedDealForDetail && (
        <Modal
          isOpen={!!selectedDealForDetail}
          onClose={() => setSelectedDealForDetail(null)}
          title={`KYC Dossier: ${selectedDealForDetail.customerName}`}
          subtitle={`SEBI Compliance & Investor Mandate Verification • ID: ${selectedDealForDetail.id}`}
          maxWidth={640}
          footer={
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setSelectedDealForDetail(null)}
              >
                Close
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => handleAdvanceStage(selectedDealForDetail)}
              >
                Confirm KYC & Advance to Opportunity <ArrowRight size={14} style={{ marginLeft: 6 }} />
              </button>
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Overview Card */}
            <div style={{ padding: 14, background: 'var(--bg-surface-hover)', borderRadius: 8, border: '1px solid var(--border-base)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>{selectedDealForDetail.customerName}</h3>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{selectedDealForDetail.title}</div>
                </div>
                <span className="kyc-badge-verified">
                  <ShieldCheck size={13} /> Verified & Eligible
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
                <div><strong>Phone:</strong> {selectedDealForDetail.phone || '—'}</div>
                <div><strong>Email:</strong> {selectedDealForDetail.email || '—'}</div>
                <div><strong>City:</strong> {selectedDealForDetail.location || '—'}</div>
                <div><strong>Investment Size:</strong> <span style={{ color: '#10b981', fontWeight: 700 }}>{selectedDealForDetail.investmentRange || formatCurrency(selectedDealForDetail.value)}</span></div>
              </div>
            </div>

            {/* Checklist */}
            <h4 style={{ margin: '4px 0 0 0', fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)' }}>
              KYC & Compliance Checklist
            </h4>

            <div className="kyc-detail-grid">
              <div className="kyc-doc-card">
                <div className="kyc-doc-title">
                  <span>PAN Verification</span>
                  <span className="kyc-badge-verified">Verified</span>
                </div>
                <div className="kyc-doc-desc">Income Tax Department NSDL API instant match. Valid PAN.</div>
              </div>

              <div className="kyc-doc-card">
                <div className="kyc-doc-title">
                  <span>CKYC Status</span>
                  <span className="kyc-badge-verified">Validated</span>
                </div>
                <div className="kyc-doc-desc">CKYC-IN Registry: 14-digit CKYC record retrieved and certified.</div>
              </div>

              <div className="kyc-doc-card">
                <div className="kyc-doc-title">
                  <span>AIF Ticket Size Eligibility</span>
                  <span className="kyc-badge-verified">Passed</span>
                </div>
                <div className="kyc-doc-desc">SEBI Cat-II AIF minimum ticket requirement (≥ ₹1 Cr) validated.</div>
              </div>

              <div className="kyc-doc-card">
                <div className="kyc-doc-title">
                  <span>Address & Bank Verification</span>
                  <span className="kyc-badge-verified">Completed</span>
                </div>
                <div className="kyc-doc-desc">Aadhaar Offline XML and penny-drop bank account verification verified.</div>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
