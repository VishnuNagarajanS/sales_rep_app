import React, { useState, useEffect, useRef } from 'react';
import {
  Kanban as KanbanIcon,
  AlertCircle,
  CheckCircle,
  XCircle,
  Clock,
  ChevronRight,
  ChevronLeft,
  Phone,
  Mail,
  User,
  MapPin,
  TrendingUp,
  Plus,
} from 'lucide-react';
import { Deal, DealActivity, Lead, Followup, Investor, InvestmentOpportunity, Consultation } from '../../types';
import { storageService } from '../../services/storageService';
import { useAuth } from '../../context/AuthContext';
import { useCan } from '../../components/common/Guards';
import {
  getDeals,
  getLeads,
  getFollowups,
  getInvestors,
  getOpportunities,
  getConsultations,
  isTenantMatch,
  saveInvestor as apiSaveInvestor,
  persistDeal,
} from '../../services/ghlApiService';
import { PIPELINE_STAGES } from '../../constants/pipelineStages';
import { Modal } from '../../components/common/Modal';
import { FilterBar } from '../../components/common/FilterBar';
import { AdminKanbanBoard } from '../../components/admin/AdminKanbanBoard';
import './PipelinePage.css';

const IRM_STAGE_SUBTITLES: Record<string, string> = {
  leads: 'Qualified handovers from sales or direct high-ticket IRM leads.',
  followup: 'Nurturing HNIs, family offices, and institutional investors.',
  qualified_investor: 'SEBI compliance checked, ticket size verified, KYC validated.',
  investment_opportunity: 'Pitch deck shared, term sheet under review, legal team active.',
  converted: 'Agreement signed, funds transferred to fund.',
};

interface PipelinePageProps {
  onOpenQuickCreate: (type: 'lead' | 'followup' | 'deal' | 'visit' | 'consultation') => void;
}

export const PipelinePage: React.FC<PipelinePageProps> = ({ onOpenQuickCreate }) => {
  const { tenant, user } = useAuth();
  
  const roleCode = user?.role?.code;
  const isGhlAdmin =
    (tenant?.slug === 'ghl' || tenant?.id === 't-ghl-01') &&
    (roleCode === 'company_admin' || (roleCode as string) === 'admin' || roleCode === 'super_admin');


  const canUpdateDeals = useCan('deals.update');
  const isIrm = roleCode === 'irm';
  const isGhlIrm = isIrm && tenant?.slug === 'ghl';

  const reqId = useRef(0);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const [deals, setDeals] = useState<Deal[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [followups, setFollowups] = useState<Followup[]>([]);
  const [investors, setInvestors] = useState<Investor[]>([]);
  const [opportunities, setOpportunities] = useState<InvestmentOpportunity[]>([]);
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [selectedDealForLoss, setSelectedDealForLoss] = useState<Deal | null>(null);
  const [lossReason, setLossReason] = useState('Competitor Pricing');
  const [agentFilter, setAgentFilter] = useState('All');

  // IRM-specific state
  const [irmDetailDeal, setIrmDetailDeal] = useState<Deal | null>(null);

  // Role-based scoping: Sales Executives and IRMs see only their own deals.
  // Managers / Admins / Super Admins see every deal in the company (no filter).
  const isExec = roleCode === 'sales_executive';
  const isScopedAgent = isExec || isGhlIrm || isIrm;
  const scopedDeals = isScopedAgent
    ? deals.filter(d =>
      (d.assignedAgentId && String(d.assignedAgentId) === String(user?.id)) ||
      (d.assignedAgentName && d.assignedAgentName === user?.name)
    )
    : deals;

  const scopedLeads = isGhlIrm
    ? (() => {
        // Build sets of contact IDs / phones that already have a real pending followup.
        // A lead with an active followup belongs in the Follow-up column only.
        const pendingFuContactIds = new Set<string>(
          followups
            .filter(f => f.status === 'Pending')
            .map(f => String(f.contactId || ''))
            .filter(Boolean)
        );
        const pendingFuPhones = new Set<string>(
          followups
            .filter(f => f.status === 'Pending')
            .map(f => (f.contactPhone || '').replace(/\D/g, '').slice(-10))
            .filter(Boolean)
        );
        const raw = leads
          .filter(l => !l.companyId || isTenantMatch(l.companyId, tenant?.id))
          // Same rule as IRM "My Leads": only 'Interested' leads assigned to THIS IRM
          .filter(l => l.status === 'Interested')
          .filter(l =>
            l.assignedAgentId
              ? String(l.assignedAgentId) === String(user?.id)
              : !!l.assignedAgentName && l.assignedAgentName === user?.name
          )
          // Exclude leads that already have a real pending followup record
          .filter(l => {
            if (pendingFuContactIds.has(String(l.id))) return false;
            const lPhone = (l.phone || '').replace(/\D/g, '').slice(-10);
            if (lPhone && pendingFuPhones.has(lPhone)) return false;
            return true;
          });
        // Deduplicate by phone to match LeadsPage
        const seen = new Set<string>();
        return raw.filter(l => {
          const phone = (l.phone || '').replace(/\D/g, '').slice(-10);
          if (phone) {
            if (seen.has(phone)) return false;
            seen.add(phone);
          }
          return true;
        });
      })()
    : [];

  const scopedFollowups = isGhlIrm
    ? (() => {
        const raw = followups
          .filter(f => !f.companyId || isTenantMatch(f.companyId, tenant?.id))
          .filter(f => f.status === 'Pending')
          .filter(
            f =>
              (f.assignedAgentId && String(f.assignedAgentId) === String(user?.id)) ||
              (f.assignedAgentName && f.assignedAgentName === user?.name)
          );
        const seen = new Set<string>();
        return raw.filter(f => {
          const key = String(f.id);
          if (!seen.has(key)) {
            seen.add(key);
            return true;
          }
          return false;
        });
      })()
    : [];

  const leadToPipelineCard = (lead: Lead): Deal => {
    const isLeadCreatedByIrm =
      lead.assignedByName === 'Created by IRM' ||
      (isIrm && (
        (lead.assignedById && user?.id && String(lead.assignedById) === String(user.id)) ||
        lead.createdBy === user?.name
      ));
    const dealAgentName = isIrm
      ? (isLeadCreatedByIrm ? (user?.name || 'Dhinakaran') : (lead.assignedByName || 'Naveen'))
      : (lead.assignedAgentName || user?.name || 'Naveen');

    return {
      id: lead.id,
      companyId: lead.companyId || tenant?.id || '',
      title: lead.name,
      customerId: lead.id,
      customerName: lead.name,
      phone: lead.phone,
      email: lead.email,
      assignedAgentId: lead.assignedAgentId,
      assignedAgentName: dealAgentName,
      stage: 'leads',
      stageEnteredAt: lead.createdAt,
      createdAt: lead.createdAt,
      expectedCloseDate: '',
      notes: lead.notes || '',
      value: 0,
      priority: lead.priority === 'Urgent' ? 'High' : (lead.priority as 'High' | 'Medium' | 'Low'),
      location: lead.location,
      investmentRange:
        lead.customFields?.investmentCapacity ||
        lead.customFields?.capacityRange ||
        lead.customFields?.investmentRange ||
        (lead as any).investmentRange ||
        undefined,
      investorType: lead.customFields?.investorType || undefined,
      preferredAssetClass: lead.customFields?.preferredAssetClass || undefined,
    };
  };

  const followupToPipelineCard = (followup: Followup): Deal => {
    const isFuCreatedByIrm =
      followup.assignedByName === 'Created by IRM' ||
      (isIrm && (
        (followup.assignedById && user?.id && String(followup.assignedById) === String(user.id)) ||
        followup.createdBy === user?.name
      ));
    const dealAgentName = isIrm
      ? (isFuCreatedByIrm ? (user?.name || 'Dhinakaran') : (followup.assignedByName || 'Naveen'))
      : (followup.assignedAgentName || user?.name || 'Naveen');

    return {
      id: followup.id,
      companyId: followup.companyId || tenant?.id || '',
      title: followup.contactName,
      customerId: followup.contactId,
      customerName: followup.contactName,
      phone: followup.contactPhone,
      email: (followup as any).email || undefined,
      assignedAgentId: followup.assignedAgentId,
      assignedAgentName: dealAgentName,
      stage: 'followup',
      stageEnteredAt: followup.scheduledAt,
      createdAt: followup.scheduledAt || (followup as any).createdAt || '',
      expectedCloseDate: '',
      notes: followup.notes || '',
      value: 0,
      priority: (followup.priority as 'High' | 'Medium' | 'Low') || 'Medium',
      investmentRange:
        (followup as any).investmentCapacity ||
        (followup as any).investmentRange ||
        undefined,
      preferredAssetClass: (followup as any).preferredAssetClass || (followup as any).customFields?.preferredAssetClass || undefined,
    };
  };

  // Agent filter options — derived from the already-scoped pool so execs never see this.
  const agentOptions = Array.from(
    new Set([
      ...scopedDeals.map(d => d.assignedAgentName),
      ...scopedLeads.map(l => l.assignedAgentName),
      ...scopedFollowups.map(f => f.assignedAgentName),
    ])
  )
    .filter(Boolean)
    .map(name => ({ value: name, label: name }));

  const loadData = async () => {
    const my = ++reqId.current;
    setIsLoading(true);
    setLoadError(false);
    try {
      const [apiDeals, apiLeads, apiFollowups, apiInvs, apiOpps, apiCons] = await Promise.all([
        getDeals(tenant?.id),
        getLeads(tenant?.id),
        getFollowups(tenant?.id),
        getInvestors(tenant?.id),
        getOpportunities(tenant?.id),
        getConsultations(tenant?.id),
      ]);
      if (my !== reqId.current) return;
      const dealsList = apiDeals || [];
      setDeals(dealsList);
      setLeads(apiLeads || []);
      setFollowups(apiFollowups || []);
      setInvestors(apiInvs || []);
      setOpportunities(apiOpps || []);
      setConsultations(apiCons || []);
      setIsLoading(false);
      setIrmDetailDeal(prev => {
        if (!prev) return null;
        return dealsList.find(d => d.id === prev.id) || prev;
      });
    } catch (err) {
      if (my !== reqId.current) return;
      console.error('[PipelinePage] Failed to load pipeline data:', err);
      setLoadError(true);
      setIsLoading(false);
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

  // Stages derived dynamically from current tenant slug!
  const stages = tenant?.slug === 'jamin'
    ? PIPELINE_STAGES.jamin
    : tenant?.slug === 'ghl'
      ? (isIrm ? PIPELINE_STAGES.ghl_irm : PIPELINE_STAGES.ghl)
      : PIPELINE_STAGES.default;

  // ID of the won stage for this pipeline
  const wonStageId = stages[stages.length - 1].id;

  const handleMoveStage = (deal: Deal, direction: 'forward' | 'backward') => {
    const currentIndex = stages.findIndex(s => s.id === deal.stage);
    if (currentIndex === -1) return;

    const newIndex = direction === 'forward' ? currentIndex + 1 : currentIndex - 1;

    // Moving into the final (won) stage must run the same conversion logic as "Mark Won"
    // (investor record creation / linking), otherwise the deal ends up Won with no investor.
    if (direction === 'forward' && newIndex === stages.length - 1 && stages[newIndex].id === wonStageId) {
      void handleMarkWon(deal);
      return;
    }

    if (newIndex >= 0 && newIndex < stages.length) {
      const updatedDeal: Deal = {
        ...deal,
        stage: stages[newIndex].id,
        stageEnteredAt: new Date().toISOString(),
      };
      persistDeal(updatedDeal).catch(e => {
        console.error("Error saving deal:", e);
        showToast("Failed to update deal stage");
      });
    }
  };

  const handleMarkWon = async (deal: Deal) => {
    let updated = { ...deal, stage: wonStageId, stageEnteredAt: new Date().toISOString() };
    if (isGhlIrm || isIrm) {
      try {
        let linkedInvestorId = deal.customerId && !deal.customerId.startsWith('lead-') && !deal.customerId.startsWith('cust-') ? deal.customerId : '';
        const fDigits = (deal.phone || '').replace(/\D/g, '').slice(-10);
        const existingInv = investors.find(inv => {
          if (linkedInvestorId && String(inv.id) === String(linkedInvestorId)) return true;
          const invDigits = (inv.phone || '').replace(/\D/g, '').slice(-10);
          if (fDigits && invDigits && invDigits === fDigits) return true;
          if (deal.email && inv.email && inv.email.toLowerCase() === deal.email.toLowerCase()) return true;
          return false;
        });

        const invPayload: Investor = {
          id: existingInv ? existingInv.id : linkedInvestorId,
          companyId: tenant?.id || '',
          name: deal.customerName,
          phone: deal.phone || '',
          email: deal.email || '',
          status: 'Active Investor',
          investmentCapacity: deal.investmentRange || '',
          preferredAssetClass: deal.preferredAssetClass || '',
          assignedAgentId: deal.assignedAgentId || user?.id || '',
          assignedAgentName: deal.assignedAgentName || user?.name || '',
          referralSource: 'IRM Pipeline',
          notes: deal.notes || (deal.value ? `Converted from Pipeline. Investment Amount: ₹${(deal.value || 0).toLocaleString('en-IN')}` : ''),
          committedAUM: deal.value ? String(deal.value) : (deal.investmentRange || ''),
          investmentMandate: deal.investorType || '',
          riskTolerance: undefined,
          createdAt: existingInv?.createdAt || new Date().toISOString(),
        };
        const savedInv = await apiSaveInvestor(invPayload);
        if (savedInv?.id) {
          updated.customerId = String(savedInv.id);
        } else if (existingInv?.id) {
          updated.customerId = String(existingInv.id);
        }
      } catch (err) {
        // Do not mark the deal Won when the investor record could not be created/linked.
        console.warn('[PipelinePage] Error syncing investor on mark won:', err);
        showToast('Could not create the investor record, so the deal was not marked as won. Please try again.');
        return;
      }
    }
    try {
      await persistDeal(updated);
    } catch (e) {
      console.error("Error saving deal:", e);
      showToast("Failed to mark deal as won");
    }
    loadData();
  };

  const handleConfirmLost = async () => {
    if (selectedDealForLoss) {
      try {
        await persistDeal({ ...selectedDealForLoss, stage: 'lost', lostReason: lossReason, stageEnteredAt: new Date().toISOString() });
      } catch (e) {
        console.error("Error saving deal:", e);
        showToast("Failed to mark deal as lost");
      }
      setSelectedDealForLoss(null);
    }
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

  if (isGhlAdmin) {
    return (
      <AdminKanbanBoard 
        onOpenQuickCreate={onOpenQuickCreate} 
        apiLeads={leads} 
        apiFollowups={followups} 
        apiDeals={deals}
        apiInvestors={investors}
        apiOpportunities={opportunities}
        apiConsultations={consultations}
        onDataChange={loadData}
      />
    );
  }

  return (
    <div className="pipeline-page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <KanbanIcon size={24} color="var(--primary-600)" /> {tenant?.name} Sales Pipeline
          </h1>
          <p className="page-subtitle">
            Visual stage-gate workflow tailored specifically for {tenant?.name}'s deal lifecycle.
          </p>
        </div>
        <div className="pipeline-header-controls">
          {!isExec && (
            <FilterBar
              filters={[
                {
                  key: 'agent',
                  label: 'Agent',
                  value: agentFilter,
                  onChange: setAgentFilter,
                  options: agentOptions,
                },
              ]}
              onClearAll={() => setAgentFilter('All')}
            />
          )}
          <button
            className="btn btn-primary pipeline-new-deal-btn"
            onClick={() => onOpenQuickCreate('deal')}
          >
            <Plus size={15} /> New Deal
          </button>
        </div>
      </div>

      {/* Inline Error Banner */}
      {loadError && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          margin: '0 24px 16px 24px',
          borderRadius: 8,
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.25)',
          color: '#ef4444',
          fontSize: 13,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertCircle size={16} />
            <span>Failed to load pipeline data from server. Please check your connection or try again.</span>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => loadData()}
            style={{ borderColor: '#ef4444', color: '#ef4444' }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Kanban Board Horizontal Scrolling Container */}
      {isLoading && scopedDeals.length === 0 && scopedLeads.length === 0 && scopedFollowups.length === 0 ? (
        <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>
          <p>Loading Sales Pipeline...</p>
        </div>
      ) : (
      <div className="pipeline-board-container">
        {stages.map((stage, sIdx) => {
          let stageDeals: Deal[];
          if (isIrm && tenant?.slug === 'ghl' && stage.id === 'leads') {
            stageDeals = scopedLeads
              .filter(l => agentFilter === 'All' || l.assignedAgentName === agentFilter)
              .map(leadToPipelineCard);
          } else if (isIrm && tenant?.slug === 'ghl' && stage.id === 'followup') {
            stageDeals = scopedFollowups
              .filter(f => agentFilter === 'All' || f.assignedAgentName === agentFilter)
              .map(followupToPipelineCard);
          } else {
            stageDeals = scopedDeals.filter(d =>
              d.stage === stage.id &&
              (agentFilter === 'All' || d.assignedAgentName === agentFilter)
            );
          }
          const stageTotal = stageDeals.reduce((sum, d) => sum + d.value, 0);

          return (
            <div key={stage.id} className="pipeline-column">
              {/* Stage Header */}
              <div className="pipeline-column-header">
                <div>
                  <div className="pipeline-column-title-group">
                    <span
                      className="pipeline-stage-dot"
                      style={{ backgroundColor: stage.color }}
                    />
                    <span className="pipeline-stage-title">
                      {stage.name}
                    </span>
                    <span className="pipeline-stage-count">
                      {stageDeals.length}
                    </span>
                  </div>
                  {isIrm && tenant?.slug === 'ghl' && IRM_STAGE_SUBTITLES[stage.id] && (
                    <div className="irm-pipeline-stage-subtitle">
                      {IRM_STAGE_SUBTITLES[stage.id]}
                    </div>
                  )}
                  <div className="pipeline-stage-total">
                    Total: <strong style={{ color: '#059669' }}>{formatCurrency(stageTotal)}</strong>
                  </div>
                </div>
              </div>

              {/* Stage Cards Container */}
              <div className="pipeline-cards-container">
                {isIrm && tenant?.slug === 'ghl' ? (
                  stageDeals.length === 0 ? (
                    <div className="pipeline-empty-column">
                      No deals in this stage
                    </div>
                  ) : (
                    stageDeals.map(deal => {
                      const daysInStage = getDaysInStage(deal);

                      return (
                        <div
                          key={deal.id}
                          className="irm-deal-card"
                          onClick={() => setIrmDetailDeal(deal)}
                        >
                          {/* Top row: Name + Priority */}
                          <div className="irm-card-top-row">
                            <span className="irm-card-customer-name">
                              {deal.customerName}
                            </span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                              {deal.investorType && (
                                <span
                                  style={{
                                    fontSize: 9,
                                    fontWeight: 800,
                                    padding: '2px 5px',
                                    borderRadius: 3,
                                    background: 'rgba(59, 130, 246, 0.15)',
                                    color: '#3b82f6',
                                    border: '1px solid rgba(59, 130, 246, 0.3)',
                                  }}
                                >
                                  {deal.investorType}
                                </span>
                              )}

                            </div>
                          </div>

                          {/* Contact details */}
                          {deal.phone && (
                            <div className="irm-card-contact-row">
                              <Phone size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                              <span>{deal.phone}</span>
                            </div>
                          )}
                          {deal.email && (
                            <div className="irm-card-contact-row">
                              <Mail size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {deal.email}
                              </span>
                            </div>
                          )}

                          {/* Owner + Days in stage */}
                          <div className="irm-card-owner-row">
                            <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                              <User size={12} style={{ color: 'var(--text-muted)' }} />
                              {deal.assignedAgentName || 'Unassigned'}
                            </span>
                            <span className="irm-stage-days-pill">
                              {daysInStage}d in stage
                            </span>
                          </div>

                          {/* Footer: Investment range */}
                          <div className="irm-card-footer">
                            <span className="irm-card-investment-range">
                              {deal.investmentRange || (deal.value > 0 ? formatCurrency(deal.value) : '—')}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )
                ) : (
                  stageDeals.length === 0 ? (
                    <div className="pipeline-empty-column">
                      No deals in this stage
                    </div>
                  ) : (
                    stageDeals.map(deal => {
                      const daysInStage = getDaysInStage(deal);
                      const isStale = daysInStage > 14;
                      const isWon = deal.stage === wonStageId || deal.stage === 'won' || deal.stage === 'converted';
                      const isLost = deal.stage === 'lost';

                      return (
                        <div
                          key={deal.id}
                          className="card card-hover pipeline-deal-card"
                        >
                          <div>
                            <div className="pipeline-deal-title">
                              {deal.title}
                            </div>
                            <div className="pipeline-deal-customer">
                              {deal.customerName}
                            </div>
                          </div>

                          <div className="pipeline-deal-value-row">
                            <span className="pipeline-deal-amount">
                              {formatCurrency(deal.value)}
                            </span>
                            <div className="pipeline-deal-meta-group">
                              <span
                                className={`pipeline-stale-tag ${isStale ? 'stale' : 'normal'}`}
                                title={isStale ? `Stale deal: In stage for ${daysInStage} days (>14 days)` : `In stage for ${daysInStage} days`}
                              >
                                <Clock size={11} color={isStale ? '#d97706' : 'currentColor'} />
                                {daysInStage}d
                              </span>
                              <span className="pipeline-deal-close-date">
                                📅 {deal.expectedCloseDate}
                              </span>
                            </div>
                          </div>

                          <div className="pipeline-deal-footer">
                            <span className="pipeline-deal-agent">
                              👤 {deal.assignedAgentName}
                            </span>

                            {/* Stage Mover and Action Buttons */}
                            <div className="pipeline-deal-actions">
                              {!isWon && !isLost && sIdx > 0 && (
                                <button
                                  className="btn btn-ghost btn-icon btn-sm pipeline-stage-mover-btn"
                                  title="Move to Previous Stage"
                                  onClick={() => handleMoveStage(deal, 'backward')}
                                >
                                  <ChevronLeft size={13} />
                                </button>
                              )}
                              {!isWon && !isLost && sIdx < stages.length - 1 && (
                                <button
                                  className="btn btn-primary btn-icon btn-sm pipeline-stage-mover-btn"
                                  title="Advance to Next Stage"
                                  onClick={() => handleMoveStage(deal, 'forward')}
                                >
                                  <ChevronRight size={13} />
                                </button>
                              )}
                              {canUpdateDeals && (
                                <>
                                  {!isWon && (
                                    <button
                                      className="btn btn-ghost btn-icon btn-sm pipeline-mark-won-btn"
                                      title="Mark Won"
                                      onClick={() => handleMarkWon(deal)}
                                    >
                                      <CheckCircle size={14} />
                                    </button>
                                  )}
                                  {!isLost && !isWon && (
                                    <button
                                      className="btn btn-ghost btn-icon btn-sm pipeline-mark-lost-btn"
                                      title="Mark Lost"
                                      onClick={() => setSelectedDealForLoss(deal)}
                                    >
                                      <XCircle size={14} />
                                    </button>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )
                )}
              </div>
            </div>
          );
        })}
      </div>
      )}

      {/* Lost Reason Modal */}
      <Modal
        isOpen={!!selectedDealForLoss}
        onClose={() => setSelectedDealForLoss(null)}
        title="Mark Deal as Closed Lost"
        subtitle={`Select root cause for deal: ${selectedDealForLoss?.title}`}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setSelectedDealForLoss(null)}>
              Cancel
            </button>
            <button className="btn btn-danger" onClick={handleConfirmLost}>
              Confirm Closed Lost
            </button>
          </>
        }
      >
        <div className="form-group">
          <label htmlFor="pipeline-loss-reason" className="form-label">Reason for Loss *</label>
          <select
            id="pipeline-loss-reason"
            name="lossReason"
            className="form-select"
            value={lossReason}
            onChange={e => setLossReason(e.target.value)}
          >
            <option value="Competitor Pricing">Competitor Pricing</option>
            <option value="Client Budget Constraints">Client Budget Constraints</option>
            <option value="Timeline Postponed">Timeline Postponed</option>
            <option value="Title / Legal Hesitation">Title / Legal Hesitation</option>
            <option value="Location Preference Mismatch">Location Preference Mismatch</option>
          </select>
        </div>
      </Modal>

      {/* IRM Deal Detail Modal */}
      {isIrm && tenant?.slug === 'ghl' && irmDetailDeal && (
        <Modal
          isOpen={!!irmDetailDeal}
          onClose={() => setIrmDetailDeal(null)}
          title={irmDetailDeal.customerName}
          subtitle={`IRM Investor Pipeline • ID: ${irmDetailDeal.id}`}
          maxWidth={680}
          footer={
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                Stage:{' '}
                <strong
                  style={{
                    color: stages.find(s => s.id === irmDetailDeal.stage)?.color || 'var(--primary-600)',
                    fontWeight: 700,
                  }}
                >
                  {stages.find(s => s.id === irmDetailDeal.stage)?.name || irmDetailDeal.stage}
                </strong>
              </div>
              <button className="btn btn-secondary" onClick={() => setIrmDetailDeal(null)}>
                Close
              </button>
            </div>
          }
        >
          <div className="irm-detail-dialog">
            {/* Info Card */}
            <div className="irm-detail-info-card">
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', marginBottom: '12px' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)' }}>
                    {irmDetailDeal.customerName}
                  </h3>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {irmDetailDeal.title}
                  </div>
                </div>

              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                {irmDetailDeal.phone && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Phone size={13} style={{ color: 'var(--text-muted)' }} />
                    <span>{irmDetailDeal.phone}</span>
                  </div>
                )}
                {irmDetailDeal.email && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Mail size={13} style={{ color: 'var(--text-muted)' }} />
                    <span>{irmDetailDeal.email}</span>
                  </div>
                )}
                {irmDetailDeal.location && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <MapPin size={13} style={{ color: 'var(--text-muted)' }} />
                    <span>{irmDetailDeal.location}</span>
                  </div>
                )}
              </div>

              <div className="irm-detail-grid-2x2">
                <div className="irm-detail-grid-item">
                  <span className="irm-detail-grid-label">
                    <User size={12} /> Assigned Owner
                  </span>
                  <span className="irm-detail-grid-value">
                    {irmDetailDeal.assignedAgentName || 'Unassigned'}
                  </span>
                </div>
                <div className="irm-detail-grid-item">
                  <span className="irm-detail-grid-label">
                    <Clock size={12} /> Current Stage Duration
                  </span>
                  <span className="irm-detail-grid-value">
                    {getDaysInStage(irmDetailDeal)} days in this stage
                  </span>
                </div>
                <div className="irm-detail-grid-item">
                  <span className="irm-detail-grid-label">
                    <TrendingUp size={12} /> Investment Capacity / Size
                  </span>
                  <span className="irm-detail-grid-value" style={{ color: '#10b981', fontWeight: 800 }}>
                    {irmDetailDeal.investmentRange || (irmDetailDeal.value > 0 ? formatCurrency(irmDetailDeal.value) : '—')}
                  </span>
                </div>
                <div className="irm-detail-grid-item">
                  <span className="irm-detail-grid-label">
                    Preferred Asset Class
                  </span>
                  <span className="irm-detail-grid-value">
                    {irmDetailDeal.preferredAssetClass || '—'}
                  </span>
                </div>
                {irmDetailDeal.customerId && (
                  <div className="irm-detail-grid-item">
                    <span className="irm-detail-grid-label">
                      Customer ID
                    </span>
                    <span className="irm-detail-grid-value" style={{ fontFamily: 'monospace' }}>
                      #{irmDetailDeal.customerId}
                    </span>
                  </div>
                )}
              </div>
            </div>

          </div>
        </Modal>
      )}

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
    </div>
  );
};
