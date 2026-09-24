import React, { useState } from 'react';
import {
  Phone,
  Mail,
  MapPin,
  Clock,
  User,
  Shield,
  Send,
  MessageSquare,
  FileText,
  Calendar,
  CheckCircle2,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';
import { Drawer } from '../common/Drawer';
import {
  AdminKanbanCard,
  KanbanStageDef,
  ActivityLogItem,
  adminKanbanService,
} from '../../mock_data/adminKanbanData';
import { useAuth } from '../../context/AuthContext';

interface ActivityLogDrawerProps {
  card: AdminKanbanCard | null;
  isOpen: boolean;
  onClose: () => void;
  stages: KanbanStageDef[];
  onCardUpdated: (updated: AdminKanbanCard) => void;
}

export const ActivityLogDrawer: React.FC<ActivityLogDrawerProps> = ({
  card,
  isOpen,
  onClose,
  stages,
  onCardUpdated,
}) => {
  const { user } = useAuth();
  const [newNote, setNewNote] = useState('');
  const [actionType, setActionType] = useState<ActivityLogItem['type']>('note');

  if (!card) return null;

  const currentStage = stages.find(s => s.id === card.stageId);

  // Compute days in stage
  const getDaysInStage = () => {
    const time = new Date(card.stageEnteredAt || card.createdAt).getTime();
    if (isNaN(time)) return 0;
    const diffMs = Date.now() - time;
    return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
  };

  const daysInStage = getDaysInStage();

  const handleStageChange = (newStageId: string) => {
    if (newStageId === card.stageId) return;
    const updated = adminKanbanService.updateCardStage(
      card.id,
      newStageId,
      user?.name || 'Admin',
      user?.role?.name || 'Company Admin'
    );
    if (updated) {
      onCardUpdated(updated);
    }
  };

  const handleAddActivity = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim()) return;

    const updated = adminKanbanService.addActivityLog(card.id, {
      performedBy: user?.name || 'Admin',
      performedByRole: user?.role?.name || 'Company Admin',
      type: actionType,
      details: newNote.trim(),
    });

    if (updated) {
      onCardUpdated(updated);
      setNewNote('');
    }
  };

  const getActivityIcon = (type: ActivityLogItem['type']) => {
    switch (type) {
      case 'call':
        return <Phone size={14} className="activity-icon-call" />;
      case 'whatsapp':
        return <MessageSquare size={14} className="activity-icon-whatsapp" />;
      case 'meeting':
        return <Calendar size={14} className="activity-icon-meeting" />;
      case 'compliance':
        return <Shield size={14} className="activity-icon-compliance" />;
      case 'stage_change':
        return <ArrowRight size={14} className="activity-icon-stage" />;
      default:
        return <FileText size={14} className="activity-icon-note" />;
    }
  };

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={card.title}
      subtitle={`${card.role === 'sales_executive' ? 'Sales Executive Pipeline' : 'IRM Investor Pipeline'} • ID: ${card.id}`}
      width={620}
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Stage: <strong style={{ color: currentStage?.color }}>{currentStage?.name}</strong>
          </span>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>
            Close
          </button>
        </div>
      }
    >
      <div className="activity-drawer-content">
        {/* Profile Card Summary */}
        <div className="card activity-drawer-summary-card">
          <div className="activity-summary-top">
            <div>
              <h3 className="activity-summary-title">{card.title}</h3>
              <div className="activity-summary-meta">
                <span className="activity-summary-meta-item">
                  <Phone size={13} /> {card.phone}
                </span>
                <span className="activity-summary-meta-item">
                  <Mail size={13} /> {card.email}
                </span>
                {card.location && (
                  <span className="activity-summary-meta-item">
                    <MapPin size={13} /> {card.location}
                  </span>
                )}
              </div>
            </div>
            <span
              className={`activity-priority-badge priority-${card.priority.toLowerCase()}`}
            >
              {card.priority} Priority
            </span>
          </div>

          <div className="activity-summary-grid">
            <div className="activity-summary-stat">
              <span className="stat-label">Assigned Owner</span>
              <span className="stat-val">
                <User size={13} /> {card.assignedPersonName}
              </span>
            </div>

            <div className="activity-summary-stat">
              <span className="stat-label">Current Stage Duration</span>
              <span className="stat-val">
                <Clock size={13} /> {daysInStage === 0 ? 'Entered today' : `${daysInStage} days in this stage`}
              </span>
            </div>

            {card.investmentAmount && (
              <div className="activity-summary-stat">
                <span className="stat-label">Investment Capacity / Size</span>
                <span className="stat-val text-emerald">
                  <TrendingUp size={13} /> {card.investmentAmount}
                </span>
              </div>
            )}

            {card.preferredAssetClass && (
              <div className="activity-summary-stat">
                <span className="stat-label">Preferred Asset Class</span>
                <span className="stat-val">
                  <Shield size={13} /> {card.preferredAssetClass}
                </span>
              </div>
            )}
          </div>

          {/* Quick Stage Switcher */}
          <div className="activity-stage-switcher">
            <span className="switcher-label">Move Stage:</span>
            <div className="switcher-buttons">
              {stages.map((stage) => {
                const isActive = stage.id === card.stageId;
                return (
                  <button
                    key={stage.id}
                    type="button"
                    className={`stage-pill-btn ${isActive ? 'active' : ''}`}
                    style={{
                      borderColor: isActive ? stage.color : undefined,
                      backgroundColor: isActive ? `${stage.color}15` : undefined,
                      color: isActive ? stage.color : undefined,
                    }}
                    onClick={() => handleStageChange(stage.id)}
                  >
                    <span
                      className="stage-pill-dot"
                      style={{ backgroundColor: stage.color }}
                    />
                    {stage.name}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Add Note / Activity Form */}
        <div className="card activity-add-note-card">
          <h4 className="activity-section-heading">Log New Activity / Note</h4>
          <form onSubmit={handleAddActivity}>
            <div className="activity-type-selector">
              <button
                type="button"
                className={`type-btn ${actionType === 'note' ? 'active' : ''}`}
                onClick={() => setActionType('note')}
              >
                <FileText size={13} /> Note
              </button>
              <button
                type="button"
                className={`type-btn ${actionType === 'call' ? 'active' : ''}`}
                onClick={() => setActionType('call')}
              >
                <Phone size={13} /> Call
              </button>
              <button
                type="button"
                className={`type-btn ${actionType === 'whatsapp' ? 'active' : ''}`}
                onClick={() => setActionType('whatsapp')}
              >
                <MessageSquare size={13} /> WhatsApp
              </button>
              <button
                type="button"
                className={`type-btn ${actionType === 'meeting' ? 'active' : ''}`}
                onClick={() => setActionType('meeting')}
              >
                <Calendar size={13} /> Meeting
              </button>
            </div>

            <textarea
              className="form-textarea activity-textarea"
              rows={2}
              placeholder={`Enter ${actionType} details, outcome, or notes...`}
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
            />

            <div className="activity-form-footer">
              <span className="activity-form-hint">
                Logged as <strong>{user?.name || 'Admin'}</strong>
              </span>
              <button
                type="submit"
                disabled={!newNote.trim()}
                className="btn btn-primary btn-sm"
              >
                <Send size={13} /> Log Activity
              </button>
            </div>
          </form>
        </div>

        {/* Chronological Timeline */}
        <div className="activity-timeline-section">
          <div className="activity-timeline-header">
            <h4 className="activity-section-heading">
              Activity History & Stage Transitions
            </h4>
            <span className="activity-count-badge">
              {card.activityLogs.length} events
            </span>
          </div>

          <div className="activity-timeline">
            {card.activityLogs.map((act) => (
              <div key={act.id} className="timeline-item">
                <div className="timeline-marker">
                  <div className={`timeline-icon-box type-${act.type}`}>
                    {getActivityIcon(act.type)}
                  </div>
                  <div className="timeline-line" />
                </div>

                <div className="timeline-content card">
                  <div className="timeline-meta-row">
                    <div className="timeline-actor-group">
                      <span className="timeline-actor-name">
                        {act.performedBy}
                      </span>
                      <span className="timeline-actor-role">
                        {act.performedByRole}
                      </span>
                    </div>
                    <span className="timeline-timestamp">
                      {act.timestamp}
                    </span>
                  </div>

                  {act.stageTransition && (
                    <div className="timeline-transition-badge">
                      <span>{act.stageTransition.from}</span>
                      <ArrowRight size={11} />
                      <span className="transition-to-text">{act.stageTransition.to}</span>
                    </div>
                  )}

                  <p className="timeline-details-text">{act.details}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Drawer>
  );
};
