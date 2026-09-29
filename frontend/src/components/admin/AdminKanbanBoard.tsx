import React, { useState, useEffect, useMemo } from 'react';
import {
  Kanban as KanbanIcon,
  Filter,
  User,
  Calendar,
  Clock,
  Phone,
  Mail,
  ChevronLeft,
  ChevronRight,
  Plus,
  Briefcase,
  Layers,
  Sparkles,
} from 'lucide-react';
import {
  KanbanRole,
  DateRangePreset,
  AdminKanbanCard,
  KanbanStageDef,
  SALES_EXECUTIVE_STAGES,
  IRM_STAGES,
  adminKanbanService,
} from '../../services/adminKanbanService';
import { storageService } from '../../services/storageService';
import { ActivityLogDrawer } from './ActivityLogDrawer';
import { useAuth } from '../../context/AuthContext';
import './AdminKanbanBoard.css';
import {
  saveLead as apiSaveLead,
  saveFollowup as apiSaveFollowup,
  saveDeal as apiSaveDeal
} from '../../services/ghlApiService';

interface AdminKanbanBoardProps {
  onOpenQuickCreate?: (type: 'lead' | 'followup' | 'deal' | 'visit' | 'consultation') => void;
  apiLeads?: any[];
  apiFollowups?: any[];
  apiDeals?: any[];
  onDataChange?: () => void;
}

export const AdminKanbanBoard: React.FC<AdminKanbanBoardProps> = ({ 
  onOpenQuickCreate,
  apiLeads = [],
  apiFollowups = [],
  apiDeals = [],
  onDataChange
}) => {
  const { tenant, user } = useAuth();

  // ── Global Filter States ────────────────────────────────────────────────
  const [selectedRole, setSelectedRole] = useState<KanbanRole>('sales_executive');
  const [selectedPerson, setSelectedPerson] = useState<string>('All');
  const [dateRangePreset, setDateRangePreset] = useState<DateRangePreset>('this_month');
  const [customStartDate, setCustomStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(1); // 1st of current month
    return d.toISOString().split('T')[0];
  });
  const [customEndDate, setCustomEndDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });

  // ── Board Dataset & Selected Card for Drawer ────────────────────────────
  const [cards, setCards] = useState<AdminKanbanCard[]>([]);
  const [selectedCard, setSelectedCard] = useState<AdminKanbanCard | null>(null);

  // Load cards by converting API data
  const loadCards = () => {
    const generatedCards: AdminKanbanCard[] = [];

    // Map Leads (Sales Executive Role)
    apiLeads.forEach(lead => {
      let stageId = 'leads'; // New/Contacted/etc
      if (lead.status === 'Interested') stageId = 'interested';
      if (lead.status === 'Not Interested' || lead.status === 'Junk' || lead.status === 'Lost') stageId = 'not-interested';
      if (lead.status === 'Follow-up Required') stageId = 'follow-ups';
      
      generatedCards.push({
        id: lead.id,
        role: 'sales_executive',
        stageId,
        title: lead.name,
        phone: lead.phone,
        email: lead.email,
        assignedPersonId: lead.assignedAgentId,
        assignedPersonName: lead.assignedAgentName || 'Unassigned',
        stageEnteredAt: lead.createdAt,
        createdAt: lead.createdAt,
        lastActivityDate: lead.updatedAt || lead.createdAt,
        lastActionSnippet: lead.notes || '',
        priority: lead.priority === 'Urgent' ? 'High' : (lead.priority || 'Medium'),
        location: lead.location,
        activityLogs: []
      });
    });

    // Map Follow-ups (Sales Executive Role)
    apiFollowups.forEach(f => {
      generatedCards.push({
        id: f.id,
        role: 'sales_executive',
        stageId: 'follow-ups',
        title: f.contactName,
        phone: f.contactPhone,
        email: f.email || '',
        assignedPersonId: f.assignedAgentId,
        assignedPersonName: f.assignedAgentName || 'Unassigned',
        stageEnteredAt: f.scheduledAt,
        createdAt: f.createdAt || f.scheduledAt,
        lastActivityDate: f.updatedAt || f.scheduledAt,
        lastActionSnippet: f.notes || '',
        priority: f.priority || 'Medium',
        activityLogs: []
      });
    });

    // Map Deals/Consultations
    apiDeals.forEach(d => {
      const isIrm = d.stage && d.stage.startsWith('irm-');
      generatedCards.push({
        id: d.id,
        role: isIrm ? 'irm' : 'sales_executive',
        stageId: d.stage || 'consultations',
        title: d.title || d.customerName,
        phone: d.phone,
        email: d.email || '',
        assignedPersonId: d.assignedAgentId,
        assignedPersonName: d.assignedAgentName || 'Unassigned',
        stageEnteredAt: d.stageEnteredAt || d.createdAt,
        createdAt: d.createdAt,
        lastActivityDate: d.updatedAt || d.createdAt,
        lastActionSnippet: d.notes || '',
        priority: d.priority || 'Medium',
        value: d.value,
        investmentAmount: d.investmentRange,
        activityLogs: []
      });
    });

    setCards(generatedCards);
  };

  useEffect(() => {
    loadCards();
  }, [apiLeads, apiFollowups, apiDeals]);

  // When role changes, reset person filter to 'All'
  const handleRoleChange = (newRole: KanbanRole) => {
    setSelectedRole(newRole);
    setSelectedPerson('All');
  };

  // Derive dynamic stages based on selected role
  const stages: KanbanStageDef[] = useMemo(() => {
    return selectedRole === 'sales_executive'
      ? SALES_EXECUTIVE_STAGES
      : IRM_STAGES;
  }, [selectedRole]);

  // Derive person options based on selected role
  const personOptions = useMemo(() => {
    const roleCards = cards.filter(c => c.role === selectedRole);
    const uniquePersons = new Map<string, {id: string, name: string}>();
    roleCards.forEach(c => {
      if (c.assignedPersonName && c.assignedPersonName !== 'Unassigned') {
        uniquePersons.set(c.assignedPersonName, { id: c.assignedPersonId || c.assignedPersonName, name: c.assignedPersonName });
      }
    });
    return Array.from(uniquePersons.values());
  }, [cards, selectedRole]);

  // ── Date Filtering Helper ───────────────────────────────────────────────
  const isDateInFilter = (isoDateStr: string): boolean => {
    if (!isoDateStr) return true;
    const target = new Date(isoDateStr).getTime();
    if (isNaN(target)) return true;

    const now = new Date();

    if (dateRangePreset === 'today') {
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      const todayEnd = todayStart + 24 * 60 * 60 * 1000;
      return target >= todayStart && target <= todayEnd;
    }

    if (dateRangePreset === 'this_week') {
      const sevenDaysAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000;
      return target >= sevenDaysAgo;
    }

    if (dateRangePreset === 'this_month') {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
      return target >= monthStart;
    }

    if (dateRangePreset === 'custom') {
      if (!customStartDate && !customEndDate) return true;
      const start = customStartDate ? new Date(`${customStartDate}T00:00:00`).getTime() : 0;
      const end = customEndDate ? new Date(`${customEndDate}T23:59:59`).getTime() : Infinity;
      return target >= start && target <= end;
    }

    return true;
  };

  // Filter cards by role, person, and date range
  const filteredCards = useMemo(() => {
    return cards.filter(card => {
      // 1. Role match
      if (card.role !== selectedRole) return false;

      // 2. Person match
      if (selectedPerson !== 'All') {
        const matchesName = card.assignedPersonName.toLowerCase() === selectedPerson.toLowerCase();
        const matchesId = card.assignedPersonId === selectedPerson;
        if (!matchesName && !matchesId) return false;
      }

      // 3. Date range match (check lastActivityDate or createdAt)
      const dateToCheck = card.lastActivityDate || card.createdAt;
      if (!isDateInFilter(dateToCheck)) return false;

      return true;
    });
  }, [cards, selectedRole, selectedPerson, dateRangePreset, customStartDate, customEndDate]);

  const handleMoveCard = async (card: AdminKanbanCard, direction: 'forward' | 'backward', e: React.MouseEvent) => {
    e.stopPropagation();
    const currentIndex = stages.findIndex(s => s.id === card.stageId);
    if (currentIndex === -1) return;

    const newIndex = direction === 'forward' ? currentIndex + 1 : currentIndex - 1;
    if (newIndex >= 0 && newIndex < stages.length) {
      const newStage = stages[newIndex];
      await performStageUpdate(card, newStage.id);
    }
  };

  const performStageUpdate = async (card: AdminKanbanCard, targetStageId: string) => {
    try {
      // Find original record
      if (apiLeads.some(l => l.id === card.id)) {
        const l = apiLeads.find(x => x.id === card.id)!;
        let newStatus = l.status;
        if (targetStageId === 'interested') newStatus = 'Interested';
        if (targetStageId === 'not-interested') newStatus = 'Not Interested';
        if (targetStageId === 'follow-ups') newStatus = 'Follow-up Required';
        if (targetStageId === 'leads') newStatus = 'New';
        await apiSaveLead({ ...l, status: newStatus });
      } else if (apiFollowups.some(f => f.id === card.id)) {
        const f = apiFollowups.find(x => x.id === card.id)!;
        await apiSaveFollowup({ ...f, status: 'Completed' });
      } else if (apiDeals.some(d => d.id === card.id)) {
        const d = apiDeals.find(x => x.id === card.id)!;
        await apiSaveDeal({ ...d, stage: targetStageId, stageEnteredAt: new Date().toISOString() });
      }
      
      if (onDataChange) {
        onDataChange();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Calculate days in stage
  const getDaysInStage = (card: AdminKanbanCard) => {
    const timestamp = card.stageEnteredAt || card.createdAt;
    if (!timestamp) return 0;
    const time = new Date(timestamp).getTime();
    if (isNaN(time)) return 0;
    const diffMs = Date.now() - time;
    return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
  };

  // Drag and Drop support
  const handleDragStart = (e: React.DragEvent, cardId: string) => {
    e.dataTransfer.setData('text/plain', cardId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: React.DragEvent, targetStageId: string) => {
    e.preventDefault();
    const cardId = e.dataTransfer.getData('text/plain');
    if (!cardId) return;
    
    const card = cards.find(c => c.id === cardId);
    if (card) {
      await performStageUpdate(card, targetStageId);
    }
  };

  return (
    <div className="admin-kanban-wrapper">
      {/* ── Top Global Filter Header ────────────────────────────────────────── */}
      <div className="admin-kanban-filterbar">
        <div className="admin-kanban-filter-group">
          {/* 1. Role Filter */}
          <div className="kanban-filter-item">
            <span className="kanban-filter-label">
              <Briefcase size={14} color="var(--primary-600)" />
              Role:
            </span>
            <select
              className="kanban-filter-select"
              value={selectedRole}
              onChange={e => handleRoleChange(e.target.value as KanbanRole)}
            >
              <option value="sales_executive">Sales Executive</option>
              <option value="irm">IRM (Investor Relations)</option>
            </select>
          </div>

          {/* 2. Person Filter (Dynamic based on Role) */}
          <div className="kanban-filter-item">
            <span className="kanban-filter-label">
              <User size={14} color="var(--text-muted)" />
              Person:
            </span>
            <select
              className="kanban-filter-select"
              value={selectedPerson}
              onChange={e => setSelectedPerson(e.target.value)}
            >
              <option value="All">
                {selectedRole === 'sales_executive' ? 'All Sales Executives' : 'All IRMs'}
              </option>
              {personOptions.map(p => (
                <option key={p.id} value={p.name}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* 3. Date Range Filter */}
          <div className="kanban-filter-item">
            <span className="kanban-filter-label">
              <Calendar size={14} color="var(--text-muted)" />
              Date Range:
            </span>
            <select
              className="kanban-filter-select"
              value={dateRangePreset}
              onChange={e => setDateRangePreset(e.target.value as DateRangePreset)}
            >
              <option value="today">Today</option>
              <option value="this_week">This Week</option>
              <option value="this_month">This Month</option>
              <option value="custom">Custom Date Range</option>
            </select>
          </div>

          {/* Inline Custom Date Inputs when 'custom' is selected */}
          {dateRangePreset === 'custom' && (
            <div className="kanban-date-custom-inputs">
              <input
                type="date"
                className="kanban-date-input"
                value={customStartDate}
                onChange={e => setCustomStartDate(e.target.value)}
                title="Start Date"
              />
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>to</span>
              <input
                type="date"
                className="kanban-date-input"
                value={customEndDate}
                onChange={e => setCustomEndDate(e.target.value)}
                title="End Date"
              />
            </div>
          )}
        </div>

        {/* Right Section: View Indicator Badge & Action */}
        <div className="admin-kanban-meta-group">
          <span
            className={`pipeline-role-tag ${selectedRole === 'sales_executive' ? 'tag-sales-exec' : 'tag-irm'
              }`}
          >
            {selectedRole === 'sales_executive' ? (
              <>
                <Briefcase size={13} /> Sales Executive Pipeline
              </>
            ) : (
              <>
                <Sparkles size={13} /> IRM Investor Pipeline
              </>
            )}
          </span>

          <span className="pipeline-total-badge">
            Total Records: <strong>{filteredCards.length}</strong>
          </span>

          {onOpenQuickCreate && (
            <button
              className="btn btn-primary btn-sm"
              onClick={() => onOpenQuickCreate(selectedRole === 'sales_executive' ? 'lead' : 'deal')}
            >
              <Plus size={14} /> New {selectedRole === 'sales_executive' ? 'Lead' : 'Investor Record'}
            </button>
          )}
        </div>
      </div>

      {/* ── Dynamic 5-Column Kanban Board ─────────────────────────────────── */}
      <div className="admin-kanban-board">
        {stages.map((stage, colIdx) => {
          const stageCards = filteredCards.filter(c => c.stageId === stage.id);

          return (
            <div
              key={stage.id}
              className="admin-kanban-column"
              onDragOver={handleDragOver}
              onDrop={e => handleDrop(e, stage.id)}
            >
              {/* Column Header */}
              <div className="admin-kanban-column-header">
                <div>
                  <div className="column-header-title-group">
                    <span
                      className="column-stage-dot"
                      style={{ backgroundColor: stage.color }}
                    />
                    <span className="column-stage-title">{stage.name}</span>
                    <span className="column-stage-count">{stageCards.length}</span>
                  </div>
                  <div className="column-stage-desc" title={stage.description}>
                    {stage.description}
                  </div>
                </div>
              </div>

              {/* Cards List Container */}
              <div className="admin-kanban-cards-list">
                {stageCards.length === 0 ? (
                  <div className="admin-kanban-empty-column">
                    No records in this stage
                  </div>
                ) : (
                  stageCards.map(card => {
                    const daysInStage = getDaysInStage(card);

                    return (
                      <div
                        key={card.id}
                        className="admin-kanban-card"
                        draggable
                        onDragStart={e => handleDragStart(e, card.id)}
                        onClick={() => setSelectedCard(card)}
                      >
                        {/* Card Header */}
                        <div className="admin-card-header">
                          <span className="admin-card-name">{card.title}</span>
                        </div>

                        {/* Contact Row */}
                        <div className="admin-card-contact">
                          <span className="admin-card-contact-row">
                            <Phone size={12} color="var(--text-muted)" /> {card.phone}
                          </span>
                          <span className="admin-card-contact-row">
                            <Mail size={12} color="var(--text-muted)" /> {card.email}
                          </span>
                        </div>

                        {/* Assigned Tag & Stage Duration */}
                        <div className="admin-card-meta-row">
                          <span className="admin-card-assigned-tag">
                            <User size={12} color="var(--primary-600)" />
                            {card.assignedPersonName}
                          </span>
                          <span className="admin-card-duration-tag">
                            <Clock size={11} />
                            {daysInStage === 0 ? 'Today' : `${daysInStage}d in stage`}
                          </span>
                        </div>

                        {/* Last Action Snippet Removed */}

                        {/* Footer & Stage Transition Controls */}
                        <div className="admin-card-footer">
                          {card.investmentAmount && (
                            <span className="admin-card-amount">
                              {card.investmentAmount}
                            </span>
                          )}

                          <div className="admin-card-stage-movers">
                            {colIdx > 0 && (
                              <button
                                type="button"
                                className="admin-stage-nav-btn"
                                title={`Move backward to ${stages[colIdx - 1].name}`}
                                onClick={e => handleMoveCard(card, 'backward', e)}
                              >
                                <ChevronLeft size={13} />
                              </button>
                            )}
                            {colIdx < stages.length - 1 && (
                              <button
                                type="button"
                                className="admin-stage-nav-btn"
                                title={`Advance forward to ${stages[colIdx + 1].name}`}
                                onClick={e => handleMoveCard(card, 'forward', e)}
                              >
                                <ChevronRight size={13} />
                              </button>
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

      {/* ── Interactive Activity Log Drawer ───────────────────────────────── */}
      <ActivityLogDrawer
        card={selectedCard}
        isOpen={Boolean(selectedCard)}
        onClose={() => setSelectedCard(null)}
        stages={stages}
        onCardUpdated={updatedCard => {
          setSelectedCard(updatedCard);
          setCards(adminKanbanService.getCards());
        }}
      />
    </div>
  );
};
