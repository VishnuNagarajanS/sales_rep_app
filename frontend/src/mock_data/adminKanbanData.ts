export type KanbanRole = 'sales_executive' | 'irm';

export type PriorityLevel = 'High' | 'Medium' | 'Low';

export type DateRangePreset = 'today' | 'this_week' | 'this_month' | 'custom';

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

export const SALES_EXECUTIVE_USERS = [
  { id: 'usr-ghl-exec', name: 'Ananya Iyer', role: 'Sales Executive' },
  { id: 'usr-ghl-exec-02', name: 'Priya Sharma', role: 'Sales Executive' },
  { id: 'usr-ghl-exec-03', name: 'Rahul Verma', role: 'Sales Executive' },
];

export const IRM_USERS = [
  { id: 'usr-ghl-irm', name: 'Rohan Varma', role: 'IRM' },
  { id: 'usr-ghl-irm-02', name: 'Meera Nair', role: 'IRM' },
  { id: 'usr-ghl-irm-03', name: 'Sameer Joshi', role: 'IRM' },
];

// ── Initial Mock Data for GHL Admin ───────────────────────────────────────
const NOW = new Date();

// Helper to generate dates relative to current date (for today, this week, this month presets)
const daysAgo = (days: number, hours = 0) => {
  const d = new Date(NOW.getTime() - (days * 24 * 60 * 60 * 1000) - (hours * 60 * 60 * 1000));
  return d.toISOString();
};

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

export const INITIAL_ADMIN_KANBAN_CARDS: AdminKanbanCard[] = [
  // ── Sales Executive Cards ────────────────────────────────────────────────
  {
    id: 'kanban-se-01',
    role: 'sales_executive',
    stageId: 'leads',
    title: 'Dr. Rajesh Nambiar',
    phone: '+91 98451 12233',
    email: 'dr.nambiar@cardiohealth.in',
    assignedPersonId: 'usr-ghl-exec',
    assignedPersonName: 'Ananya Iyer',
    stageEnteredAt: daysAgo(1, 4),
    createdAt: daysAgo(1, 4),
    lastActivityDate: daysAgo(1, 4),
    lastActionSnippet: 'Assigned new inbound referral lead from HNW Club network.',
    priority: 'High',
    investmentAmount: '₹3 Cr - ₹5 Cr',
    preferredAssetClass: 'Commercial Grade-A Pre-Leased',
    location: 'Indiranagar, Bengaluru',
    activityLogs: [
      {
        id: 'act-se-101',
        timestamp: formatDateSnippet(daysAgo(1, 4)),
        isoDate: daysAgo(1, 4),
        performedBy: 'System Auto-Assign',
        performedByRole: 'System',
        type: 'stage_change',
        stageTransition: { from: 'Unassigned', to: 'Leads' },
        details: 'Assigned new inbound lead to Ananya Iyer based on Bengaluru HNW round-robin.',
      },
    ],
  },
  {
    id: 'kanban-se-02',
    role: 'sales_executive',
    stageId: 'leads',
    title: 'Karthik Somayaji',
    phone: '+91 94480 77889',
    email: 'karthik.s@somayajient.com',
    assignedPersonId: 'usr-ghl-exec-02',
    assignedPersonName: 'Priya Sharma',
    stageEnteredAt: daysAgo(0, 3), // Today
    createdAt: daysAgo(0, 3),
    lastActivityDate: daysAgo(0, 3),
    lastActionSnippet: 'Web enquiry received regarding commercial yield funds.',
    priority: 'Medium',
    investmentAmount: '₹75L - ₹1.5 Cr',
    preferredAssetClass: 'Commercial Yield Funds',
    location: 'Jayanagar, Bengaluru',
    activityLogs: [
      {
        id: 'act-se-102',
        timestamp: formatDateSnippet(daysAgo(0, 3)),
        isoDate: daysAgo(0, 3),
        performedBy: 'Priya Sharma',
        performedByRole: 'Sales Executive',
        type: 'note',
        details: 'Reviewed initial web inquiry. Investor seeking quarterly dividend payouts.',
      },
    ],
  },
  {
    id: 'kanban-se-03',
    role: 'sales_executive',
    stageId: 'follow-ups',
    title: 'Sunita & Arvind Mehta',
    phone: '+91 99882 33445',
    email: 'arvind.mehta@techscale.io',
    assignedPersonId: 'usr-ghl-exec',
    assignedPersonName: 'Ananya Iyer',
    stageEnteredAt: daysAgo(3),
    createdAt: daysAgo(5),
    lastActivityDate: daysAgo(0, 2), // Today
    lastActionSnippet: 'WhatsApp sent with logistics fund comparison sheet.',
    priority: 'High',
    investmentAmount: '₹1.5 Cr - ₹3 Cr',
    preferredAssetClass: 'Industrial Logistics Park',
    location: 'Koramangala, Bengaluru',
    activityLogs: [
      {
        id: 'act-se-103',
        timestamp: formatDateSnippet(daysAgo(0, 2)),
        isoDate: daysAgo(0, 2),
        performedBy: 'Ananya Iyer',
        performedByRole: 'Sales Executive',
        type: 'whatsapp',
        details: 'Shared comparison deck on WhatsApp. Client confirmed receipt and scheduled phone call.',
      },
      {
        id: 'act-se-104',
        timestamp: formatDateSnippet(daysAgo(3)),
        isoDate: daysAgo(3),
        performedBy: 'Ananya Iyer',
        performedByRole: 'Sales Executive',
        type: 'stage_change',
        stageTransition: { from: 'Leads', to: 'Follow-ups' },
        details: 'Moved to Follow-ups after positive introductory discovery call.',
      },
    ],
  },
  {
    id: 'kanban-se-04',
    role: 'sales_executive',
    stageId: 'follow-ups',
    title: 'Kishore Varma',
    phone: '+91 98860 77112',
    email: 'kishore@varmaholdings.in',
    assignedPersonId: 'usr-ghl-exec-03',
    assignedPersonName: 'Rahul Verma',
    stageEnteredAt: daysAgo(4),
    createdAt: daysAgo(7),
    lastActivityDate: daysAgo(1),
    lastActionSnippet: 'Introductory call completed; brochure sent via email.',
    priority: 'Medium',
    investmentAmount: '₹1 Cr - ₹2 Cr',
    preferredAssetClass: 'Pre-Leased Retail',
    location: 'Lavelle Road, Bengaluru',
    activityLogs: [
      {
        id: 'act-se-105',
        timestamp: formatDateSnippet(daysAgo(1)),
        isoDate: daysAgo(1),
        performedBy: 'Rahul Verma',
        performedByRole: 'Sales Executive',
        type: 'call',
        details: '14-minute discovery call. Client interested in guaranteed rental escalation clauses.',
      },
      {
        id: 'act-se-106',
        timestamp: formatDateSnippet(daysAgo(4)),
        isoDate: daysAgo(4),
        performedBy: 'Rahul Verma',
        performedByRole: 'Sales Executive',
        type: 'stage_change',
        stageTransition: { from: 'Leads', to: 'Follow-ups' },
        details: 'Advanced from Leads to Follow-ups.',
      },
    ],
  },
  {
    id: 'kanban-se-05',
    role: 'sales_executive',
    stageId: 'consultations',
    title: 'Deepak & Sangeeta Chawla',
    phone: '+91 98450 11990',
    email: 'deepak.c@chawlacapital.com',
    assignedPersonId: 'usr-ghl-exec',
    assignedPersonName: 'Ananya Iyer',
    stageEnteredAt: daysAgo(2),
    createdAt: daysAgo(10),
    lastActivityDate: daysAgo(0, 5),
    lastActionSnippet: 'Completed 45-min Zoom consultation with GHL portfolio head.',
    priority: 'High',
    investmentAmount: '₹4 Cr - ₹6 Cr',
    preferredAssetClass: 'AIF Commercial Office Fund',
    location: 'Sadashivanagar, Bengaluru',
    activityLogs: [
      {
        id: 'act-se-107',
        timestamp: formatDateSnippet(daysAgo(0, 5)),
        isoDate: daysAgo(0, 5),
        performedBy: 'Ananya Iyer',
        performedByRole: 'Sales Executive',
        type: 'meeting',
        details: 'Presentation of Horizon Tech Park asset. Investor impressed by 8.9% in-place yield.',
      },
      {
        id: 'act-se-108',
        timestamp: formatDateSnippet(daysAgo(2)),
        isoDate: daysAgo(2),
        performedBy: 'Ananya Iyer',
        performedByRole: 'Sales Executive',
        type: 'stage_change',
        stageTransition: { from: 'Follow-ups', to: 'Consultations' },
        details: 'Scheduled formal presentation meeting with family office principals.',
      },
    ],
  },
  {
    id: 'kanban-se-06',
    role: 'sales_executive',
    stageId: 'interested',
    title: 'Vikramaditya Singhania',
    phone: '+91 99001 88223',
    email: 'v.singhania@apexindustries.co',
    assignedPersonId: 'usr-ghl-exec-02',
    assignedPersonName: 'Priya Sharma',
    stageEnteredAt: daysAgo(1),
    createdAt: daysAgo(14),
    lastActivityDate: daysAgo(0, 1),
    lastActionSnippet: 'Expressed strong interest in ₹5 Cr allocation; requested term sheet.',
    priority: 'High',
    investmentAmount: '₹5 Cr - ₹10 Cr',
    preferredAssetClass: 'Grade-A SEZ IT Park',
    location: 'MG Road, Bengaluru',
    activityLogs: [
      {
        id: 'act-se-109',
        timestamp: formatDateSnippet(daysAgo(0, 1)),
        isoDate: daysAgo(0, 1),
        performedBy: 'Priya Sharma',
        performedByRole: 'Sales Executive',
        type: 'note',
        details: 'Client confirmed intent to invest ₹5 Cr. Preparing formal term sheet handover to IRM.',
      },
      {
        id: 'act-se-110',
        timestamp: formatDateSnippet(daysAgo(1)),
        isoDate: daysAgo(1),
        performedBy: 'Priya Sharma',
        performedByRole: 'Sales Executive',
        type: 'stage_change',
        stageTransition: { from: 'Consultations', to: 'Interested' },
        details: 'Moved to Interested stage following successful in-person presentation.',
      },
    ],
  },
  {
    id: 'kanban-se-07',
    role: 'sales_executive',
    stageId: 'not-interested',
    title: 'Naveen Poddar',
    phone: '+91 97411 33221',
    email: 'npoddar@poddargroup.net',
    assignedPersonId: 'usr-ghl-exec-03',
    assignedPersonName: 'Rahul Verma',
    stageEnteredAt: daysAgo(6),
    createdAt: daysAgo(18),
    lastActivityDate: daysAgo(6),
    lastActionSnippet: 'Closed Lost: Client decided to allocate capital into equity mutual funds.',
    priority: 'Low',
    investmentAmount: '₹50L - ₹1 Cr',
    preferredAssetClass: 'Commercial Retail',
    location: 'Malleshwaram, Bengaluru',
    activityLogs: [
      {
        id: 'act-se-111',
        timestamp: formatDateSnippet(daysAgo(6)),
        isoDate: daysAgo(6),
        performedBy: 'Rahul Verma',
        performedByRole: 'Sales Executive',
        type: 'stage_change',
        stageTransition: { from: 'Follow-ups', to: 'Not Interested' },
        details: 'Marked Not Interested: Client cited equity liquidity preference over real asset lock-in.',
      },
    ],
  },

  // ── IRM (Investor Relations Manager) Cards ──────────────────────────────
  {
    id: 'kanban-irm-01',
    role: 'irm',
    stageId: 'irm-leads',
    title: 'Aditya Birla Family Trust',
    phone: '+91 98200 44550',
    email: 'investments@abfamilyoffice.in',
    assignedPersonId: 'usr-ghl-irm',
    assignedPersonName: 'Rohan Varma',
    stageEnteredAt: daysAgo(1),
    createdAt: daysAgo(2),
    lastActivityDate: daysAgo(0, 4),
    lastActionSnippet: 'Handover from Sales Executive. High ticket inquiry for ₹15 Cr institutional pool.',
    priority: 'High',
    investmentAmount: '₹15 Cr - ₹25 Cr',
    preferredAssetClass: 'Cat II AIF Commercial Real Estate',
    location: 'Mumbai & Bengaluru',
    activityLogs: [
      {
        id: 'act-irm-201',
        timestamp: formatDateSnippet(daysAgo(0, 4)),
        isoDate: daysAgo(0, 4),
        performedBy: 'Rohan Varma',
        performedByRole: 'IRM',
        type: 'note',
        details: 'Received handover dossier from sales team. Verified accredited family office status.',
      },
      {
        id: 'act-irm-202',
        timestamp: formatDateSnippet(daysAgo(1)),
        isoDate: daysAgo(1),
        performedBy: 'Rohan Varma',
        performedByRole: 'IRM',
        type: 'stage_change',
        stageTransition: { from: 'Sales Handover', to: 'Leads' },
        details: 'Created IRM pipeline record for family office CIO.',
      },
    ],
  },
  {
    id: 'kanban-irm-02',
    role: 'irm',
    stageId: 'irm-follow-up',
    title: 'Siddharth Munjal (Apex Wealth)',
    phone: '+91 98100 66778',
    email: 'siddharth@apexwealth.com',
    assignedPersonId: 'usr-ghl-irm-02',
    assignedPersonName: 'Meera Nair',
    stageEnteredAt: daysAgo(3),
    createdAt: daysAgo(8),
    lastActivityDate: daysAgo(1),
    lastActionSnippet: 'Reviewing audited past fund track records and distribution history.',
    priority: 'High',
    investmentAmount: '₹10 Cr',
    preferredAssetClass: 'Pre-Leased Commercial Warehousing',
    location: 'New Delhi & Bengaluru',
    activityLogs: [
      {
        id: 'act-irm-203',
        timestamp: formatDateSnippet(daysAgo(1)),
        isoDate: daysAgo(1),
        performedBy: 'Meera Nair',
        performedByRole: 'IRM',
        type: 'call',
        details: 'Detailed 30-min call with portfolio CIO on historical gross internal rate of return.',
      },
      {
        id: 'act-irm-204',
        timestamp: formatDateSnippet(daysAgo(3)),
        isoDate: daysAgo(3),
        performedBy: 'Meera Nair',
        performedByRole: 'IRM',
        type: 'stage_change',
        stageTransition: { from: 'Leads', to: 'Follow-up' },
        details: 'Commenced relationship nurturing and private placement memorandum review.',
      },
    ],
  },
  {
    id: 'kanban-irm-03',
    role: 'irm',
    stageId: 'irm-qualified-investor',
    title: 'Dr. Alok Nath & Partners',
    phone: '+91 99201 33441',
    email: 'alok.nath@medtechholdings.sg',
    assignedPersonId: 'usr-ghl-irm',
    assignedPersonName: 'Rohan Varma',
    stageEnteredAt: daysAgo(4),
    createdAt: daysAgo(12),
    lastActivityDate: daysAgo(0, 6),
    lastActionSnippet: 'SEBI Accredited Investor verification passed; PAN/KYC docs validated.',
    priority: 'High',
    investmentAmount: '₹5 Cr - ₹8 Cr',
    preferredAssetClass: 'Healthcare & Pharma R&D Campuses',
    location: 'Singapore & Bengaluru',
    activityLogs: [
      {
        id: 'act-irm-205',
        timestamp: formatDateSnippet(daysAgo(0, 6)),
        isoDate: daysAgo(0, 6),
        performedBy: 'Rohan Varma',
        performedByRole: 'IRM',
        type: 'compliance',
        details: 'Compliance green-light received. Net worth certification (>₹25 Cr) and KYC successfully verified.',
      },
      {
        id: 'act-irm-206',
        timestamp: formatDateSnippet(daysAgo(4)),
        isoDate: daysAgo(4),
        performedBy: 'Rohan Varma',
        performedByRole: 'IRM',
        type: 'stage_change',
        stageTransition: { from: 'Follow-up', to: 'Qualified Investor' },
        details: 'Investor achieved Qualified Accredited Investor status under SEBI norms.',
      },
    ],
  },
  {
    id: 'kanban-irm-04',
    role: 'irm',
    stageId: 'irm-investment-opportunity',
    title: 'Harishankar Kothari Ventures',
    phone: '+91 98310 99882',
    email: 'h.kothari@kothariventures.com',
    assignedPersonId: 'usr-ghl-irm-03',
    assignedPersonName: 'Sameer Joshi',
    stageEnteredAt: daysAgo(2),
    createdAt: daysAgo(16),
    lastActivityDate: daysAgo(0, 2),
    lastActionSnippet: 'Formal term sheet shared for Asset Fund IV; legal diligence active.',
    priority: 'High',
    investmentAmount: '₹12 Cr',
    preferredAssetClass: 'GHL India Flagship Yield Fund',
    location: 'Kolkata & Bengaluru',
    activityLogs: [
      {
        id: 'act-irm-207',
        timestamp: formatDateSnippet(daysAgo(0, 2)),
        isoDate: daysAgo(0, 2),
        performedBy: 'Sameer Joshi',
        performedByRole: 'IRM',
        type: 'note',
        details: 'Legal counsel sent revised subscription agreement. Side letter clauses accepted.',
      },
      {
        id: 'act-irm-208',
        timestamp: formatDateSnippet(daysAgo(2)),
        isoDate: daysAgo(2),
        performedBy: 'Sameer Joshi',
        performedByRole: 'IRM',
        type: 'stage_change',
        stageTransition: { from: 'Qualified Investor', to: 'Investment Opportunity' },
        details: 'Term sheet issued with ₹12 Cr commitment earmarked.',
      },
    ],
  },
  {
    id: 'kanban-irm-05',
    role: 'irm',
    stageId: 'irm-converted',
    title: 'Crestline Capital Trust',
    phone: '+91 98450 77001',
    email: 'trustee@crestlinecap.com',
    assignedPersonId: 'usr-ghl-irm',
    assignedPersonName: 'Rohan Varma',
    stageEnteredAt: daysAgo(5),
    createdAt: daysAgo(25),
    lastActivityDate: daysAgo(5),
    lastActionSnippet: 'Contribution agreement signed; ₹20 Cr wired to escrow account.',
    priority: 'High',
    investmentAmount: '₹20 Cr',
    preferredAssetClass: 'Grade-A Commercial Portfolio',
    location: 'Bengaluru',
    activityLogs: [
      {
        id: 'act-irm-209',
        timestamp: formatDateSnippet(daysAgo(5)),
        isoDate: daysAgo(5),
        performedBy: 'Rohan Varma',
        performedByRole: 'IRM',
        type: 'stage_change',
        stageTransition: { from: 'Investment Opportunity', to: 'Converted' },
        details: 'Units allocated. Tranche-1 capital call received in fund escrow. Onboarding completed.',
      },
    ],
  },
];

// ── Storage Service Helpers ───────────────────────────────────────────────
const KANBAN_STORAGE_KEY = 'nexus_admin_kanban_cards_v1';

export const adminKanbanService = {
  getCards(): AdminKanbanCard[] {
    try {
      const data = localStorage.getItem(KANBAN_STORAGE_KEY);
      if (data) {
        return JSON.parse(data);
      }
    } catch (e) {
      console.error('Failed to load admin kanban cards:', e);
    }
    // Seed initial data
    this.saveCards(INITIAL_ADMIN_KANBAN_CARDS);
    return INITIAL_ADMIN_KANBAN_CARDS;
  },

  saveCards(cards: AdminKanbanCard[]): void {
    try {
      localStorage.setItem(KANBAN_STORAGE_KEY, JSON.stringify(cards));
      window.dispatchEvent(new Event('nexus_admin_kanban_updated'));
    } catch (e) {
      console.error('Failed to save admin kanban cards:', e);
    }
  },

  updateCardStage(cardId: string, newStageId: string, actorName = 'Vikram Malhotra', actorRole = 'Company Admin'): AdminKanbanCard | null {
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
