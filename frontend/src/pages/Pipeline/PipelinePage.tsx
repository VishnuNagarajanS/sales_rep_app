import React, { useState, useEffect } from 'react';
import {
  Kanban as KanbanIcon,
  CheckCircle,
  XCircle,
  Clock,
  ChevronRight,
  ChevronLeft,
  Plus,
  Phone,
  Mail,
  User,
  MapPin,
  TrendingUp,
  Building2,
  Calendar,
  FileText,
  MessageCircle,
} from 'lucide-react';
import { Deal, DealActivity } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useCan } from '../../components/common/Guards';
import { storageService } from '../../services/storageService';
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

  if (isGhlAdmin) {
    return <AdminKanbanBoard onOpenQuickCreate={onOpenQuickCreate} />;
  }

  const canUpdateDeals = useCan('deals.update');
  const [deals, setDeals] = useState<Deal[]>([]);
  const [selectedDealForLoss, setSelectedDealForLoss] = useState<Deal | null>(null);
  const [lossReason, setLossReason] = useState('Competitor Pricing');
  const [agentFilter, setAgentFilter] = useState('All');

  // IRM-specific state
  const [cardIndex, setCardIndex] = useState<Record<string, number>>({});
  const [irmDetailDeal, setIrmDetailDeal] = useState<Deal | null>(null);
  const [activityType, setActivityType] = useState<'note' | 'call' | 'whatsapp' | 'meeting'>('note');
  const [activityText, setActivityText] = useState('');

  // Role-based scoping: Sales Executives see only their own deals.
  // Managers / Admins / Super Admins see every deal in the company (no filter).
  const isExec = roleCode === 'sales_executive';
  const scopedDeals = isExec
    ? deals.filter(d =>
      (d.assignedAgentId && d.assignedAgentId === user?.id) ||
      (d.assignedAgentName && d.assignedAgentName === user?.name)
    )
    : deals;

  // Agent filter options — derived from the already-scoped pool so execs never see this.
  const agentOptions = Array.from(new Set(scopedDeals.map(d => d.assignedAgentName)))
    .filter(Boolean)
    .map(name => ({ value: name, label: name }));

  const loadData = () => {
    const latestDeals = storageService.getDeals(tenant?.id);
    setDeals(latestDeals);
    setIrmDetailDeal(prev => {
      if (!prev) return null;
      return latestDeals.find(d => d.id === prev.id) || prev;
    });
  };

  useEffect(() => {
    loadData();
    const handleUpdate = () => loadData();
    window.addEventListener('nexus_storage_updated', handleUpdate);
    return () => window.removeEventListener('nexus_storage_updated', handleUpdate);
  }, [tenant?.id]);

  // Stages derived dynamically from current tenant slug!
  const isIrm = roleCode === 'irm';

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
    if (newIndex >= 0 && newIndex < stages.length) {
      const updatedDeal: Deal = {
        ...deal,
        stage: stages[newIndex].id,
        stageEnteredAt: new Date().toISOString(),
      };
      storageService.saveDeal(updatedDeal);
    }
  };

  const handleIrmMoveStage = (targetStageId: string) => {
    if (!irmDetailDeal || irmDetailDeal.stage === targetStageId) return;
    const currentStage = stages.find(s => s.id === irmDetailDeal.stage);
    const targetStage = stages.find(s => s.id === targetStageId);
    const fromStageName = currentStage?.name || irmDetailDeal.stage;
    const toStageName = targetStage?.name || targetStageId;

    const updatedDeal: Deal = {
      ...irmDetailDeal,
      stage: targetStageId,
      stageEnteredAt: new Date().toISOString(),
    };
    storageService.saveDeal(updatedDeal);

    const newActivity: DealActivity = {
      id: `act-${Date.now()}`,
      dealId: irmDetailDeal.id,
      companyId: tenant?.id || '',
      type: 'stage_change',
      fromStage: irmDetailDeal.stage,
      toStage: targetStageId,
      text: `${fromStageName} → ${toStageName}`,
      loggedByName: user?.name || 'IRM User',
      loggedByRole: 'IRM',
      timestamp: new Date().toISOString(),
    };
    storageService.addDealActivity(newActivity);

    setIrmDetailDeal(updatedDeal);
    loadData();
  };

  const handleLogActivity = () => {
    if (!irmDetailDeal || !activityText.trim()) return;

    const newActivity: DealActivity = {
      id: `act-${Date.now()}`,
      dealId: irmDetailDeal.id,
      companyId: tenant?.id || '',
      type: activityType,
      text: activityText.trim(),
      loggedByName: user?.name || 'IRM User',
      loggedByRole: 'IRM',
      timestamp: new Date().toISOString(),
    };

    storageService.addDealActivity(newActivity);
    setActivityText('');
    loadData();
  };

  const handleMarkWon = (deal: Deal) => {
    storageService.saveDeal({
      ...deal,
      stage: wonStageId,
      stageEnteredAt: new Date().toISOString(),
    });
  };

  const handleConfirmLost = () => {
    if (selectedDealForLoss) {
      storageService.saveDeal({
        ...selectedDealForLoss,
        stage: 'lost',
        lostReason: lossReason,
        stageEnteredAt: new Date().toISOString(),
      });
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

  const formatActivityTime = (ts: string) => {
    if (!ts) return '';
    const d = new Date(ts);
    if (isNaN(d.getTime())) {
      return ts;
    }
    return d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  const irmDealActivities = irmDetailDeal
    ? storageService.getDealActivities(irmDetailDeal.id, tenant?.id)
    : [];

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

      {/* Kanban Board Horizontal Scrolling Container */}
      <div className="pipeline-board-container">
        {stages.map((stage, sIdx) => {
          const stageDeals = scopedDeals.filter(d =>
            d.stage === stage.id &&
            (agentFilter === 'All' || d.assignedAgentName === agentFilter)
          );
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
                    (() => {
                      const currIdx = Math.min(cardIndex[stage.id] || 0, Math.max(0, stageDeals.length - 1));
                      const deal = stageDeals[currIdx];
                      const daysInStage = getDaysInStage(deal);
                      const activities = storageService.getDealActivities(deal.id, tenant?.id);
                      const lastActivity = activities.length > 0 ? activities[0] : null;

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
                              <span className={`irm-priority-badge ${(deal.priority || 'medium').toLowerCase()}`}>
                                {(deal.priority || 'Medium').toUpperCase()}
                              </span>
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

                          {/* Last Activity */}
                          <div className="irm-last-activity-box">
                            <div className="irm-last-activity-label">LAST ACTIVITY</div>
                            <div className="irm-last-activity-text">
                              {lastActivity ? lastActivity.text : 'No activity logged yet.'}
                            </div>
                          </div>

                          {/* Footer: Investment range + pagination */}
                          <div className="irm-card-footer">
                            <span className="irm-card-investment-range">
                              {deal.investmentRange || formatCurrency(deal.value)}
                            </span>
                            {stageDeals.length > 1 && (
                              <div
                                className="irm-card-pagination"
                                onClick={e => e.stopPropagation()}
                              >
                                <span>{currIdx + 1}/{stageDeals.length}</span>
                                <button
                                  type="button"
                                  className="irm-page-btn"
                                  disabled={currIdx === 0}
                                  onClick={e => {
                                    e.stopPropagation();
                                    setCardIndex(prev => ({
                                      ...prev,
                                      [stage.id]: Math.max(0, currIdx - 1),
                                    }));
                                  }}
                                  title="Previous Deal"
                                >
                                  ‹
                                </button>
                                <button
                                  type="button"
                                  className="irm-page-btn"
                                  disabled={currIdx >= stageDeals.length - 1}
                                  onClick={e => {
                                    e.stopPropagation();
                                    setCardIndex(prev => ({
                                      ...prev,
                                      [stage.id]: Math.min(stageDeals.length - 1, currIdx + 1),
                                    }));
                                  }}
                                  title="Next Deal"
                                >
                                  ›
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })()
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
          <label className="form-label">Reason for Loss *</label>
          <select
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
                <span className={`irm-priority-badge ${(irmDetailDeal.priority || 'medium').toLowerCase()}`}>
                  {(irmDetailDeal.priority || 'Medium').toUpperCase()} PRIORITY
                </span>
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
                    {irmDetailDeal.investmentRange || formatCurrency(irmDetailDeal.value)}
                  </span>
                </div>
                <div className="irm-detail-grid-item">
                  <span className="irm-detail-grid-label">
                    <Building2 size={12} /> Preferred Asset Class
                  </span>
                  <span className="irm-detail-grid-value">
                    {irmDetailDeal.preferredAssetClass || 'Commercial Pre-Leased'}
                    {irmDetailDeal.investorType && (
                      <span
                        style={{
                          marginLeft: 8,
                          fontSize: 10,
                          fontWeight: 800,
                          padding: '2px 6px',
                          borderRadius: 4,
                          background: 'rgba(59, 130, 246, 0.15)',
                          color: '#3b82f6',
                          border: '1px solid rgba(59, 130, 246, 0.3)',
                          verticalAlign: 'middle',
                        }}
                      >
                        {irmDetailDeal.investorType}
                      </span>
                    )}
                  </span>
                </div>
              </div>
            </div>

            {/* Move Stage Row */}
            <div className="irm-stage-switcher">
              <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.5px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                MOVE STAGE:
              </div>
              <div className="irm-stage-pills-row">
                {stages.map(st => {
                  const isCurrent = irmDetailDeal.stage === st.id;
                  return (
                    <button
                      key={st.id}
                      type="button"
                      className={`irm-stage-pill ${isCurrent ? 'active' : ''}`}
                      style={isCurrent ? { backgroundColor: st.color, borderColor: st.color } : {}}
                      onClick={() => handleIrmMoveStage(st.id)}
                    >
                      {st.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Log New Activity / Note */}
            <div className="irm-activity-card">
              <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 700 }}>
                Log New Activity / Note
              </h4>
              <div className="irm-activity-tabs">
                <button
                  type="button"
                  className={`irm-activity-tab-btn ${activityType === 'note' ? 'active' : ''}`}
                  onClick={() => setActivityType('note')}
                >
                  <FileText size={13} /> Note
                </button>
                <button
                  type="button"
                  className={`irm-activity-tab-btn ${activityType === 'call' ? 'active' : ''}`}
                  onClick={() => setActivityType('call')}
                >
                  <Phone size={13} /> Call
                </button>
                <button
                  type="button"
                  className={`irm-activity-tab-btn ${activityType === 'whatsapp' ? 'active' : ''}`}
                  onClick={() => setActivityType('whatsapp')}
                >
                  <MessageCircle size={13} /> WhatsApp
                </button>
                <button
                  type="button"
                  className={`irm-activity-tab-btn ${activityType === 'meeting' ? 'active' : ''}`}
                  onClick={() => setActivityType('meeting')}
                >
                  <Calendar size={13} /> Meeting
                </button>
              </div>
              <textarea
                className="form-control"
                rows={3}
                placeholder="Enter note details, outcome, or notes..."
                value={activityText}
                onChange={e => setActivityText(e.target.value)}
                style={{ width: '100%', resize: 'vertical', fontSize: '13px', padding: '10px 12px' }}
              />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '10px' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Logged as <strong style={{ color: 'var(--text-secondary)' }}>{user?.name || 'IRM'}</strong>
                </span>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={!activityText.trim()}
                  onClick={handleLogActivity}
                >
                  Log Activity
                </button>
              </div>
            </div>

            {/* Activity History & Stage Transitions */}
            <div className="irm-activity-card">
              <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 700 }}>
                Activity History & Stage Transitions
              </h4>
              {irmDealActivities.length === 0 ? (
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', padding: '12px 0', textAlign: 'center' }}>
                  No activity logged yet.
                </div>
              ) : (
                <div className="irm-timeline">
                  {irmDealActivities.map(act => {
                    const isStageChange = act.type === 'stage_change';
                    return (
                      <div key={act.id} className="irm-timeline-node">
                        <div className="irm-timeline-icon">
                          {act.type === 'call' && <Phone size={9} />}
                          {act.type === 'whatsapp' && <MessageCircle size={9} />}
                          {act.type === 'meeting' && <Calendar size={9} />}
                          {act.type === 'stage_change' && <ChevronRight size={9} />}
                          {act.type === 'note' && <FileText size={9} />}
                        </div>
                        <div className="irm-timeline-content">
                          <div className="irm-timeline-header">
                            <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                              {act.loggedByName}
                            </span>
                            <span className="irm-role-badge">{act.loggedByRole || 'IRM'}</span>
                            <span style={{ marginLeft: 'auto', fontSize: '11px', color: 'var(--text-muted)' }}>
                              {formatActivityTime(act.timestamp)}
                            </span>
                          </div>
                          {isStageChange && (
                            <div className="irm-stage-change-pill">
                              {act.text}
                            </div>
                          )}
                          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                            {!isStageChange && act.text}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
