import {
  AdminKanbanCard,
  KanbanStageDef,
  ActivityLogItem,
  KanbanRole,
  PriorityLevel,
  DateRangePreset,
} from '../types/kanban';

export type {
  AdminKanbanCard,
  KanbanStageDef,
  ActivityLogItem,
  KanbanRole,
  PriorityLevel,
  DateRangePreset,
};

// ── 5 Stages for Sales Executive ──────────────────────────────────────────
export const SALES_EXECUTIVE_STAGES: KanbanStageDef[] = [
  {
    id: 'leads',
    name: 'Leads',
    description: 'New inbound leads assigned',
    color: '#3b82f6', // blue
  },
  {
    id: 'follow-ups',
    name: 'Follow-ups',
    description: 'Ongoing communications, calls, and WhatsApp messages',
    color: '#f59e0b', // amber
  },
  {
    id: 'consultations',
    name: 'Consultations',
    description: 'Scheduled/Completed meetings and presentations',
    color: '#8b5cf6', // purple
  },
  {
    id: 'interested',
    name: 'Interested',
    description: 'High-intent leads showing strong interest',
    color: '#10b981', // emerald
  },
  {
    id: 'not-interested',
    name: 'Not Interested',
    description: 'Leads disqualified or closed as lost',
    color: '#ef4444', // red
  },
];

// ── 5 Stages for IRM (Investor Relations Manager) ────────────────────────
export const IRM_STAGES: KanbanStageDef[] = [
  {
    id: 'irm-leads',
    name: 'Leads',
    description: 'Qualified handovers from sales or direct high-ticket IRM leads',
    color: '#06b6d4', // cyan
  },
  {
    id: 'irm-follow-up',
    name: 'Follow-up',
    description: 'Nurturing HNIs, family offices, and institutional investors',
    color: '#f97316', // orange
  },
  {
    id: 'irm-qualified-investor',
    name: 'Qualified Investor',
    description: 'SEBI compliance checked, ticket size verified, KYC validated',
    color: '#3b82f6', // blue
  },
  {
    id: 'irm-investment-opportunity',
    name: 'Investment Opportunity',
    description: 'Pitch deck shared, term sheet under review, legal team active',
    color: '#a855f7', // purple
  },
  {
    id: 'irm-converted',
    name: 'Converted',
    description: 'Agreement signed, funds transferred to fund account',
    color: '#10b981', // green
  },
];

const DEV_KANBAN_STORAGE_KEY = 'nexus_dev_kanban_cards_v1';

const formatDateSnippet = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
};

export const adminKanbanService = {
  getCards(): AdminKanbanCard[] {
    try {
      const data = localStorage.getItem(DEV_KANBAN_STORAGE_KEY);
      if (data) {
        return JSON.parse(data);
      }
    } catch (e) {
      console.error('Failed to load dev kanban cards:', e);
    }
    return [];
  },

  saveCards(cards: AdminKanbanCard[]): void {
    try {
      localStorage.setItem(DEV_KANBAN_STORAGE_KEY, JSON.stringify(cards));
      window.dispatchEvent(new Event('nexus_admin_kanban_updated'));
    } catch (e) {
      console.error('Failed to save admin kanban cards:', e);
    }
  },

  updateCardStage(cardId: string, newStageId: string, actorName = 'Admin', actorRole = 'Company Admin'): AdminKanbanCard | null {
    const cards = this.getCards();
    const card = cards.find(c => c.id === cardId);
    if (!card) return null;

    const stages = card.role === 'sales_executive' ? SALES_EXECUTIVE_STAGES : IRM_STAGES;
    const oldStage = stages.find(s => s.id === card.stageId)?.name || card.stageId;
    const newStage = stages.find(s => s.id === newStageId)?.name || newStageId;

    const now = new Date();
    const nowIsoStr = now.toISOString();

    const newActivity: ActivityLogItem = {
      id: `act-${Date.now()}`,
      timestamp: formatDateSnippet(nowIsoStr),
      isoDate: nowIsoStr,
      performedBy: actorName,
      performedByRole: actorRole,
      type: 'stage_change',
      stageTransition: {
        from: oldStage,
        to: newStage,
      },
      details: `Stage updated from "${oldStage}" to "${newStage}".`,
    };

    const updatedCard: AdminKanbanCard = {
      ...card,
      stageId: newStageId,
      stageEnteredAt: nowIsoStr,
      lastActivityDate: nowIsoStr,
      lastActionSnippet: `Stage changed to ${newStage}`,
      activityLogs: [newActivity, ...card.activityLogs],
    };

    const newCards = cards.map(c => c.id === cardId ? updatedCard : c);
    this.saveCards(newCards);
    return updatedCard;
  },

  addActivityLog(cardId: string, activity: Omit<ActivityLogItem, 'id' | 'timestamp' | 'isoDate'>): AdminKanbanCard | null {
    const cards = this.getCards();
    const card = cards.find(c => c.id === cardId);
    if (!card) return null;

    const now = new Date();
    const nowIsoStr = now.toISOString();

    const newActivity: ActivityLogItem = {
      ...activity,
      id: `act-${Date.now()}`,
      timestamp: formatDateSnippet(nowIsoStr),
      isoDate: nowIsoStr,
    };

    const updatedCard: AdminKanbanCard = {
      ...card,
      lastActivityDate: nowIsoStr,
      lastActionSnippet: activity.details,
      activityLogs: [newActivity, ...card.activityLogs],
    };

    const newCards = cards.map(c => c.id === cardId ? updatedCard : c);
    this.saveCards(newCards);
    return updatedCard;
  },
};
