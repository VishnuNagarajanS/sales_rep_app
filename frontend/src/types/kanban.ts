export type KanbanRole = 'sales_executive' | 'irm';

export type PriorityLevel = 'High' | 'Medium' | 'Low';

export type DateRangePreset = 'today' | 'this_week' | 'this_month' | 'custom';

export type FollowupRoleFilter = 'sales_executive' | 'irm';

export interface ActivityLogItem {
  id: string;
  timestamp: string; // e.g., '24 Sep 2026, 02:30 PM'
  isoDate: string; // e.g., '2026-09-24T14:30:00.000Z'
  performedBy: string; // e.g., 'Ananya Iyer'
  performedByRole: string; // e.g., 'Sales Executive'
  type: 'call' | 'note' | 'stage_change' | 'meeting' | 'whatsapp' | 'compliance';
  stageTransition?: {
    from: string;
    to: string;
  };
  details: string; // e.g., 'Call completed. Pitch deck emailed. Client requested follow-up on Friday.'
}

export interface AdminKanbanCard {
  id: string;
  role: KanbanRole;
  stageId: string;
  title: string; // Lead / Investor Name
  phone: string;
  email: string;
  assignedPersonId: string;
  assignedPersonName: string;
  stageEnteredAt: string; // ISO date string
  createdAt: string; // ISO date string
  lastActivityDate: string; // ISO date string
  lastActionSnippet: string; // e.g., 'Call completed. Pitch deck emailed.'
  priority: PriorityLevel;
  value?: number;
  investmentAmount?: string;
  preferredAssetClass?: string;
  location?: string;
  activityLogs: ActivityLogItem[];
}

export interface KanbanStageDef {
  id: string;
  name: string;
  description: string;
  color: string;
}
