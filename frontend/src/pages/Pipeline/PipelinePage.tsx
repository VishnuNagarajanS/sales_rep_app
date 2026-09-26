import React, { useState, useEffect } from 'react';
import {
  Kanban as KanbanIcon,
  CheckCircle,
  XCircle,
  Clock,
  ChevronRight,
  ChevronLeft,
  Plus,
} from 'lucide-react';
import { Deal } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useCan } from '../../components/common/Guards';
import { storageService } from '../../services/storageService';
import { PIPELINE_STAGES } from '../../constants/pipelineStages';
import { Modal } from '../../components/common/Modal';
import { FilterBar } from '../../components/common/FilterBar';
import './PipelinePage.css';

interface PipelinePageProps {
  onOpenQuickCreate: (type: 'lead' | 'followup' | 'deal' | 'visit' | 'consultation') => void;
}

export const PipelinePage: React.FC<PipelinePageProps> = ({ onOpenQuickCreate }) => {
  const { tenant, user } = useAuth();
  const canUpdateDeals = useCan('deals.update');
  const [deals, setDeals] = useState<Deal[]>([]);
  const [selectedDealForLoss, setSelectedDealForLoss] = useState<Deal | null>(null);
  const [lossReason, setLossReason] = useState('Competitor Pricing');
  const [agentFilter, setAgentFilter] = useState('All');

  // Role-based scoping: Sales Executives see only their own deals.
  // Managers / Admins / Super Admins see every deal in the company (no filter).
  const roleCode = user?.role?.code;
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
    setDeals(storageService.getDeals(tenant?.id));
  };

  useEffect(() => {
    loadData();
    const handleUpdate = () => loadData();
    window.addEventListener('nexus_storage_updated', handleUpdate);
    return () => window.removeEventListener('nexus_storage_updated', handleUpdate);
  }, [tenant?.id]);

  // Stages derived dynamically from current tenant slug!
  const stages = tenant?.slug === 'jamin'
    ? PIPELINE_STAGES.jamin
    : tenant?.slug === 'ghl'
      ? PIPELINE_STAGES.ghl
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
                  <div className="pipeline-stage-total">
                    Total: <strong style={{ color: '#059669' }}>{formatCurrency(stageTotal)}</strong>
                  </div>
                </div>
              </div>

              {/* Stage Cards Container */}
              <div className="pipeline-cards-container">
                {stageDeals.length === 0 ? (
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
    </div>
  );
};
