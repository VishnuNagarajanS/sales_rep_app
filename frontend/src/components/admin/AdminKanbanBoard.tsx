import React, { useState, useEffect, useMemo } from 'react';
import {
  Kanban as KanbanIcon,
  Filter,
  User,
  Calendar,
  Clock,
  Phone,
  Mail,
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
  PriorityLevel,
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
  saveDeal as apiSaveDeal,
  saveOpportunity as apiSaveOpportunity,
  saveInvestor as apiSaveInvestor,
  getIrmPipelineBoard,
  moveIrmPipelineCard
} from '../../services/ghlApiService';
import { adminUserService } from '../../services/adminUserService';

interface AdminKanbanBoardProps {
  onOpenQuickCreate?: (type: 'lead' | 'followup' | 'deal' | 'visit' | 'consultation') => void;
  apiLeads?: any[];
  apiFollowups?: any[];
  apiDeals?: any[];
  apiInvestors?: any[];
  apiOpportunities?: any[];
  apiConsultations?: any[];
  onDataChange?: () => void;
}

export const AdminKanbanBoard: React.FC<AdminKanbanBoardProps> = ({ 
  onOpenQuickCreate,
  apiLeads = [],
  apiFollowups = [],
  apiDeals = [],
  apiInvestors = [],
  apiOpportunities = [],
  apiConsultations = [],
  onDataChange
}) => {
  const { tenant, user } = useAuth();

  // ── Global Filter States ────────────────────────────────────────────────
  const [selectedRole, setSelectedRole] = useState<KanbanRole>('sales_executive');
  const [selectedPerson, setSelectedPerson] = useState<string>('All');
  const [dateRangePreset, setDateRangePreset] = useState<DateRangePreset>('all');
  const [customStartDate, setCustomStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(1); // 1st of current month
    return d.toISOString().split('T')[0];
  });
  const [customEndDate, setCustomEndDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });

  const [irmUsers, setIrmUsers] = useState<{ id: string; name: string }[]>([]);
  const [salesUsers, setSalesUsers] = useState<{ id: string; name: string }[]>([]);
  const [irmBoardCards, setIrmBoardCards] = useState<any[]>([]);

  // ── Fetch Real DB Users Only ─────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;
    const fetchUsers = async () => {
      try {
        const fetchedDbUsers = await adminUserService.getUsers(tenant?.id || '1');
        if (!mounted) return;

        const irmMap = new Map<string, { id: string; name: string }>();
        const salesMap = new Map<string, { id: string; name: string }>();

        (fetchedDbUsers || []).forEach(u => {
          const roleCode = (u.role?.code || '').toLowerCase();
          const roleName = (u.role?.name || '').toLowerCase();
          const roleId = String(u.role?.id || '');

          const isIrm = roleCode === 'irm' || roleId === '4' || roleName === 'irm' || roleName.includes('investor');
          const isSales = roleCode === 'sales_executive' || roleId === '3' || roleName.includes('sales');

          if (isIrm && u.name) {
            irmMap.set(u.name.toLowerCase(), { id: String(u.id), name: u.name });
          } else if (isSales && u.name) {
            salesMap.set(u.name.toLowerCase(), { id: String(u.id), name: u.name });
          }
        });

        // Seed fallbacks from the database in case API returns empty
        if (irmMap.size === 0) {
          irmMap.set('dhinakaran', { id: '5', name: 'Dhinakaran' });
          irmMap.set('test_irm', { id: '30', name: 'Test_IRM' });
        }
        if (salesMap.size === 0) {
          salesMap.set('naveen', { id: '3', name: 'Naveen' });
        }

        setIrmUsers(Array.from(irmMap.values()));
        setSalesUsers(Array.from(salesMap.values()));
      } catch (e) {
        console.warn('Could not fetch DB users for Kanban person dropdown:', e);
        if (mounted) {
          setIrmUsers([
            { id: '5', name: 'Dhinakaran' }
          ]);
          setSalesUsers([
            { id: '3', name: 'Naveen' }
          ]);
        }
      }
    };

    fetchUsers();
    return () => { mounted = false; };
  }, [tenant?.id]);

  // ── Fetch Backend IRM Pipeline Cards ────────────────────────────────────
  useEffect(() => {
    let mounted = true;
    getIrmPipelineBoard().then(board => {
      if (!mounted) return;
      if (board && board.stages) {
        const flattened = board.stages.flatMap(s => (s.cards || []).map(c => ({ ...c, serverStageId: s.id })));
        setIrmBoardCards(flattened);
      }
    }).catch(() => {});
    return () => { mounted = false; };
  }, [tenant?.id]);

  // ── Board Dataset & Selected Card for Drawer ────────────────────────────
  const [cards, setCards] = useState<AdminKanbanCard[]>([]);
  const [selectedCard, setSelectedCard] = useState<AdminKanbanCard | null>(null);

  // Load cards by converting API data
  const loadCards = () => {
    const generatedCards: AdminKanbanCard[] = [];
    const nowIso = new Date().toISOString();

    // Helper to resolve assignees strictly to real DB users
    const findIrmPerson = (candidateName?: string, candidateId?: string | number) => {
      if (candidateName) {
        const found = irmUsers.find(u => u.name.toLowerCase() === candidateName.toLowerCase());
        if (found) return found;
      }
      if (candidateId) {
        const found = irmUsers.find(u => String(u.id) === String(candidateId));
        if (found) return found;
      }
      return null;
    };

    const findSalesPerson = (candidateName?: string, candidateId?: string | number) => {
      if (candidateName) {
        const found = salesUsers.find(u => u.name.toLowerCase() === candidateName.toLowerCase());
        if (found) return found;
      }
      if (candidateId) {
        const found = salesUsers.find(u => String(u.id) === String(candidateId));
        if (found) return found;
      }
      return null;
    };

    // Track active deal customer identifiers to avoid duplicating them as leads or followups
    const dealCustomerKeys = new Set<string>();
    apiDeals.forEach(d => {
      if (d.customerName) dealCustomerKeys.add(d.customerName.toLowerCase().trim());
      if (d.title) dealCustomerKeys.add(d.title.toLowerCase().trim());
      if (d.email) dealCustomerKeys.add(d.email.toLowerCase().trim());
      const cleanPhone = (d.phone || '').replace(/\D/g, '');
      if (cleanPhone) dealCustomerKeys.add(cleanPhone);
    });

    // ── 1. Map Deals ────────────────────────────────────────────────────────
    apiDeals.forEach(d => {
      const irmAssignee = findIrmPerson(d.assignedAgentName, d.assignedAgentId);
      const salesAssignee = findSalesPerson(d.assignedAgentName, d.assignedAgentId);
      
      const isIrmStage = d.stage && (
        d.stage.startsWith('irm-') || 
        ['qualified_investor', 'investment_opportunity', 'converted'].includes(d.stage)
      );
      const isIrm = !!irmAssignee || (!salesAssignee && isIrmStage);

      if (isIrm) {
        let stageId = 'irm-qualified-investor';
        if (d.stage === 'leads' || d.stage === 'enquiry') stageId = 'irm-leads';
        else if (d.stage === 'followup' || d.stage === 'consultation') stageId = 'irm-follow-up';
        else if (d.stage === 'qualified_investor') stageId = 'irm-qualified-investor';
        else if (d.stage === 'investment_opportunity') stageId = 'irm-investment-opportunity';
        else if (d.stage === 'converted' || d.stage === 'won') stageId = 'irm-converted';
        else if (d.stage && d.stage.startsWith('irm-')) stageId = d.stage;

        const assignee = irmAssignee || (d.assignedAgentName ? { id: String(d.assignedAgentId || '0'), name: d.assignedAgentName } : (irmUsers[0] || { id: '5', name: 'Dhinakaran' }));

        generatedCards.push({
          id: d.id,
          role: 'irm',
          stageId,
          title: d.customerName || d.title, // customerName matches PipelinePage!
          phone: d.phone || '',
          email: d.email || '',
          assignedPersonId: assignee.id,
          assignedPersonName: assignee.name,
          stageEnteredAt: d.stageEnteredAt || d.createdAt || nowIso,
          createdAt: d.createdAt || nowIso,
          lastActivityDate: d.updatedAt || d.createdAt || nowIso,
          lastActionSnippet: d.notes || '',
          priority: d.priority || 'Medium',
          value: d.value,
          investmentAmount: d.investmentRange || (d.value ? `₹${d.value.toLocaleString('en-IN')}` : undefined),
          location: (d as any).location,
          activityLogs: []
        });
      } else {
        // Sales Executive Deal
        let stageId = 'consultations';
        if (d.stage === 'leads') stageId = 'leads';
        else if (d.stage === 'follow-ups' || d.stage === 'followup') stageId = 'follow-ups';
        else if (d.stage === 'interested') stageId = 'interested';
        else if (d.stage === 'not-interested' || d.stage === 'lost') stageId = 'not-interested';

        const assignee = salesAssignee || (d.assignedAgentName ? { id: String(d.assignedAgentId || '0'), name: d.assignedAgentName } : (salesUsers[0] || { id: '3', name: 'Naveen' }));

        generatedCards.push({
          id: d.id,
          role: 'sales_executive',
          stageId,
          title: d.customerName || d.title,
          phone: d.phone || '',
          email: d.email || '',
          assignedPersonId: assignee.id,
          assignedPersonName: assignee.name,
          stageEnteredAt: d.stageEnteredAt || d.createdAt || nowIso,
          createdAt: d.createdAt || nowIso,
          lastActivityDate: d.updatedAt || d.createdAt || nowIso,
          lastActionSnippet: d.notes || '',
          priority: d.priority || 'Medium',
          value: d.value,
          investmentAmount: d.investmentRange,
          location: (d as any).location,
          activityLogs: []
        });
      }
    });

    // ── 2. Map Leads (Sales Executive Leads & Qualified Handover IRM Leads) ──
    apiLeads.forEach(lead => {
      const irmAssignee = findIrmPerson(lead.assignedAgentName, lead.assignedAgentId);
      const salesAssignee = findSalesPerson(lead.assignedAgentName, lead.assignedAgentId);

      const cleanPhone = (lead.phone || '').replace(/\D/g, '');
      const leadNameLower = (lead.name || '').toLowerCase().trim();
      const leadEmailLower = (lead.email || '').toLowerCase().trim();
      const hasActiveDeal = 
        (leadNameLower && dealCustomerKeys.has(leadNameLower)) ||
        (leadEmailLower && dealCustomerKeys.has(leadEmailLower)) ||
        (cleanPhone && dealCustomerKeys.has(cleanPhone));

      // A) IRM Leads: Only if assigned to an IRM AND status is 'Interested' AND not already in an active deal stage
      if (irmAssignee) {
        if (lead.status === 'Interested' && !hasActiveDeal) {
          generatedCards.push({
            id: `irm-lead-${lead.id}`,
            role: 'irm',
            stageId: 'irm-leads',
            title: lead.name,
            phone: lead.phone || '',
            email: lead.email || '',
            assignedPersonId: irmAssignee.id,
            assignedPersonName: irmAssignee.name,
            stageEnteredAt: lead.createdAt || nowIso,
            createdAt: lead.createdAt || nowIso,
            lastActivityDate: lead.updatedAt || lead.createdAt || nowIso,
            lastActionSnippet: lead.notes || 'Qualified sales handover to Investor Relations',
            priority: lead.priority === 'Urgent' ? 'High' : (lead.priority || 'Medium'),
            investmentAmount: lead.customFields?.investmentCapacity || lead.customFields?.investmentRange || lead.investmentRange,
            location: lead.location,
            activityLogs: []
          });
        }
      }

      // B) Sales Executive Leads: Only if NOT assigned to an IRM
      if (!irmAssignee) {
        const assignee = salesAssignee || (lead.assignedAgentName ? { id: String(lead.assignedAgentId || '0'), name: lead.assignedAgentName } : (salesUsers[0] || { id: '3', name: 'Naveen' }));

        let stageId = 'leads';
        if (lead.status === 'Interested') stageId = 'interested';
        else if (lead.status === 'Not Interested' || lead.status === 'Junk' || lead.status === 'Lost') stageId = 'not-interested';
        else if (lead.status === 'Follow-up Required') stageId = 'follow-ups';

        generatedCards.push({
          id: lead.id,
          role: 'sales_executive',
          stageId,
          title: lead.name,
          phone: lead.phone || '',
          email: lead.email || '',
          assignedPersonId: assignee.id,
          assignedPersonName: assignee.name,
          stageEnteredAt: lead.createdAt || nowIso,
          createdAt: lead.createdAt || nowIso,
          lastActivityDate: lead.updatedAt || lead.createdAt || nowIso,
          lastActionSnippet: lead.notes || '',
          priority: lead.priority === 'Urgent' ? 'High' : (lead.priority || 'Medium'),
          location: lead.location,
          activityLogs: []
        });
      }
    });

    // ── 3. Map Follow-ups ───────────────────────────────────────────────────
    apiFollowups.forEach(f => {
      // In both IRM and Sales Exec pipelines, only pending follow-ups belong in the pipeline stages
      if (f.status && f.status !== 'Pending') return;

      const irmAssignee = findIrmPerson(f.assignedAgentName, f.assignedAgentId);
      const salesAssignee = findSalesPerson(f.assignedAgentName, f.assignedAgentId);

      const cleanPhone = (f.contactPhone || '').replace(/\D/g, '');
      const contactNameLower = (f.contactName || '').toLowerCase().trim();
      const contactEmailLower = (f.email || '').toLowerCase().trim();
      const hasActiveDeal = 
        (contactNameLower && dealCustomerKeys.has(contactNameLower)) ||
        (contactEmailLower && dealCustomerKeys.has(contactEmailLower)) ||
        (cleanPhone && dealCustomerKeys.has(cleanPhone));

      if (irmAssignee) {
        // Only include if contact doesn't already have an active deal in Qualified/Opportunity/Converted
        if (!hasActiveDeal) {
          generatedCards.push({
            id: f.id,
            role: 'irm',
            stageId: 'irm-follow-up',
            title: f.contactName,
            phone: f.contactPhone || '',
            email: f.email || '',
            assignedPersonId: irmAssignee.id,
            assignedPersonName: irmAssignee.name,
            stageEnteredAt: f.scheduledAt || nowIso,
            createdAt: f.createdAt || f.scheduledAt || nowIso,
            lastActivityDate: f.updatedAt || f.scheduledAt || nowIso,
            lastActionSnippet: f.notes || f.agenda || '',
            priority: f.priority || 'Medium',
            activityLogs: []
          });
        }
      } else {
        const assignee = salesAssignee || (f.assignedAgentName ? { id: String(f.assignedAgentId || '0'), name: f.assignedAgentName } : (salesUsers[0] || { id: '3', name: 'Naveen' }));

        generatedCards.push({
          id: f.id,
          role: 'sales_executive',
          stageId: 'follow-ups',
          title: f.contactName,
          phone: f.contactPhone || '',
          email: f.email || '',
          assignedPersonId: assignee.id,
          assignedPersonName: assignee.name,
          stageEnteredAt: f.scheduledAt || nowIso,
          createdAt: f.createdAt || f.scheduledAt || nowIso,
          lastActivityDate: f.updatedAt || f.scheduledAt || nowIso,
          lastActionSnippet: f.notes || f.agenda || '',
          priority: f.priority || 'Medium',
          activityLogs: []
        });
      }
    });

    // ── 4. Map Consultations (Sales Executive Consultations) ────────────────
    apiConsultations.forEach(cns => {
      const salesAssignee = findSalesPerson(cns.consultantName, cns.consultantId);
      const assignee = salesAssignee || (cns.consultantName ? { id: String(cns.consultantId || '0'), name: cns.consultantName } : (salesUsers[0] || { id: '3', name: 'Naveen' }));

      generatedCards.push({
        id: `cns-${cns.id}`,
        role: 'sales_executive',
        stageId: 'consultations',
        title: cns.investorName || cns.clientName || 'Client Consultation',
        phone: cns.investorPhone || cns.clientPhone || '',
        email: '',
        assignedPersonId: assignee.id,
        assignedPersonName: assignee.name,
        stageEnteredAt: cns.scheduledAt || nowIso,
        createdAt: cns.scheduledAt || nowIso,
        lastActivityDate: cns.scheduledAt || nowIso,
        lastActionSnippet: cns.agenda || cns.outcomeNotes || '',
        priority: 'Medium',
        activityLogs: []
      });
    });

    // ── 5. Map Investment Opportunities (if explicitly assigned to an IRM) ──
    apiOpportunities.forEach(opp => {
      const oppTitle = opp.investorName ? `${opp.investorName} - ${opp.title}` : opp.title;
      const alreadyHas = generatedCards.some(
        c => c.role === 'irm' && c.title.toLowerCase() === (opp.investorName || opp.title).toLowerCase()
      );
      if (alreadyHas) return;

      const irmAssignee = findIrmPerson(opp.assignedAgentName, opp.assignedAgentId);
      if (!irmAssignee) return; // Strict: Never assign unknown opportunities to an IRM

      let stageId = 'irm-investment-opportunity';
      if (opp.stage === 'Enquiry' || opp.stage === 'Contacted') stageId = 'irm-leads';
      else if (opp.stage === 'Consultation') stageId = 'irm-follow-up';
      else if (opp.stage === 'Qualified') stageId = 'irm-qualified-investor';
      else if (opp.stage === 'Opportunity') stageId = 'irm-investment-opportunity';
      else if (opp.stage === 'Committed' || opp.stage === 'Closed Won') stageId = 'irm-converted';

      const amt = opp.committedAmount || opp.targetAmount;
      const formattedAmt = amt ? (amt >= 10000000 ? `₹${(amt / 10000000).toFixed(1)} Cr` : `₹${(amt / 100000).toFixed(1)} L`) : undefined;

      generatedCards.push({
        id: `opp-${opp.id}`,
        role: 'irm',
        stageId,
        title: opp.investorName || opp.title,
        phone: '',
        email: '',
        assignedPersonId: irmAssignee.id,
        assignedPersonName: irmAssignee.name,
        stageEnteredAt: opp.expectedCloseDate || nowIso,
        createdAt: opp.expectedCloseDate || nowIso,
        lastActivityDate: opp.expectedCloseDate || nowIso,
        lastActionSnippet: opp.notes || `Target: ${formattedAmt || '₹5 Cr'}`,
        priority: 'High',
        value: amt,
        investmentAmount: formattedAmt,
        activityLogs: []
      });
    });

    setCards(generatedCards);
  };

  useEffect(() => {
    loadCards();
  }, [apiLeads, apiFollowups, apiDeals, apiInvestors, apiOpportunities, apiConsultations, irmUsers, salesUsers]);

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

  // Derive person options based on selected role — ONLY real people from DB
  const personOptions = useMemo(() => {
    const list = selectedRole === 'irm' ? irmUsers : salesUsers;
    const unique = new Map<string, { id: string; name: string }>();

    list.forEach(p => {
      if (p?.name && p.name !== 'Unassigned') {
        unique.set(p.name.toLowerCase(), { id: p.id, name: p.name });
      }
    });

    return Array.from(unique.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [selectedRole, irmUsers, salesUsers]);

  // ── Date Filtering Helper ───────────────────────────────────────────────
  const isDateInFilter = (isoDateStr: string): boolean => {
    if (dateRangePreset === 'all') return true;
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
      const thirtyDaysAgo = now.getTime() - 30 * 24 * 60 * 60 * 1000;
      return target >= Math.min(monthStart, thirtyDaysAgo);
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


  const performStageUpdate = async (card: AdminKanbanCard, targetStageId: string) => {
    try {
      // 1. Backend IrmPipelineCard (id starts with 'irm-pipe-')
      if (card.id.startsWith('irm-pipe-')) {
        const rawId = parseInt(card.id.replace('irm-pipe-', ''), 10);
        let backendStage = 'leads';
        if (targetStageId === 'irm-leads') backendStage = 'leads';
        else if (targetStageId === 'irm-follow-up') backendStage = 'followup';
        else if (targetStageId === 'irm-qualified-investor') backendStage = 'qualified_investor';
        else if (targetStageId === 'irm-investment-opportunity') backendStage = 'investment_opportunity';
        else if (targetStageId === 'irm-converted') backendStage = 'converted';
        await moveIrmPipelineCard(rawId, backendStage);
      }
      // 2. Investment Opportunity
      else if (card.id.startsWith('opp-')) {
        const rawId = card.id.replace('opp-', '');
        const opp = (apiOpportunities || []).find(o => o.id === rawId);
        if (opp) {
          let oppStage = opp.stage;
          if (targetStageId === 'irm-leads') oppStage = 'Enquiry';
          else if (targetStageId === 'irm-follow-up') oppStage = 'Consultation';
          else if (targetStageId === 'irm-qualified-investor') oppStage = 'Qualified';
          else if (targetStageId === 'irm-investment-opportunity') oppStage = 'Opportunity';
          else if (targetStageId === 'irm-converted') oppStage = 'Committed';
          await apiSaveOpportunity({ ...opp, stage: oppStage });
        }
      }
      // 3. Investor
      else if (card.id.startsWith('inv-')) {
        const rawId = card.id.replace('inv-', '');
        const inv = (apiInvestors || []).find(i => i.id === rawId);
        if (inv) {
          let invStatus = inv.status;
          if (targetStageId === 'irm-leads') invStatus = 'Lead';
          else if (targetStageId === 'irm-qualified-investor' || targetStageId === 'irm-converted') invStatus = 'Active Investor';
          await apiSaveInvestor({ ...inv, status: invStatus });
        }
      }
      // 4. Lead (Sales Exec or IRM handover)
      else if (apiLeads.some(l => l.id === card.id || `irm-lead-${l.id}` === card.id)) {
        const leadId = card.id.startsWith('irm-lead-') ? card.id.replace('irm-lead-', '') : card.id;
        const l = apiLeads.find(x => x.id === leadId)!;
        let newStatus = l.status;
        if (targetStageId === 'interested') newStatus = 'Interested';
        else if (targetStageId === 'not-interested') newStatus = 'Not Interested';
        else if (targetStageId === 'follow-ups' || targetStageId === 'irm-follow-up') newStatus = 'Follow-up Required';
        else if (targetStageId === 'leads' || targetStageId === 'irm-leads') newStatus = 'New';
        await apiSaveLead({ ...l, status: newStatus });
      }
      // 5. Followup
      else if (apiFollowups.some(f => f.id === card.id)) {
        const f = apiFollowups.find(x => x.id === card.id)!;
        await apiSaveFollowup({ ...f, status: 'Completed' });
      }
      // 6. Deal
      else if (apiDeals.some(d => d.id === card.id)) {
        const d = apiDeals.find(x => x.id === card.id)!;
        let backendStage = targetStageId;
        if (targetStageId === 'irm-leads') backendStage = 'leads';
        else if (targetStageId === 'irm-follow-up') backendStage = 'followup';
        else if (targetStageId === 'irm-qualified-investor') backendStage = 'qualified_investor';
        else if (targetStageId === 'irm-investment-opportunity') backendStage = 'investment_opportunity';
        else if (targetStageId === 'irm-converted') backendStage = 'converted';
        await apiSaveDeal({ ...d, stage: backendStage, stageEnteredAt: new Date().toISOString() });
      }

      // Optimistically update card in UI
      setCards(prev => prev.map(c => c.id === card.id ? {
        ...c,
        stageId: targetStageId,
        stageEnteredAt: new Date().toISOString(),
        lastActivityDate: new Date().toISOString()
      } : c));

      if (onDataChange) {
        onDataChange();
      }
    } catch (err) {
      console.error('Error updating stage:', err);
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
    if (selectedRole === 'irm') {
      e.preventDefault();
      return;
    }
    e.dataTransfer.setData('text/plain', cardId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (selectedRole === 'irm') return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: React.DragEvent, targetStageId: string) => {
    if (selectedRole === 'irm') return;
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
              <option value="all">All Records</option>
              <option value="this_month">This Month</option>
              <option value="this_week">This Week</option>
              <option value="today">Today</option>
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
                        draggable={selectedRole !== 'irm'}
                        onDragStart={e => handleDragStart(e, card.id)}
                        onClick={() => setSelectedCard(card)}
                      >
                        {/* Card Header */}
                        <div className="admin-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span className="admin-card-name">{card.title}</span>
                          {selectedRole === 'irm' && (
                            <span
                              style={{
                                fontSize: 10,
                                fontWeight: 700,
                                padding: '2px 6px',
                                borderRadius: 4,
                                background: 'rgba(124, 58, 237, 0.1)',
                                color: '#7c3aed',
                              }}
                            >
                              Read-Only
                            </span>
                          )}
                        </div>

                        {/* Contact Row */}
                        {(card.phone || card.email) && (
                          <div className="admin-card-contact">
                            {card.phone && (
                              <span className="admin-card-contact-row">
                                <Phone size={12} color="var(--text-muted)" /> {card.phone}
                              </span>
                            )}
                            {card.email && (
                              <span className="admin-card-contact-row">
                                <Mail size={12} color="var(--text-muted)" /> {card.email}
                              </span>
                            )}
                          </div>
                        )}

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

                        {card.investmentAmount && (
                          <div className="admin-card-footer">
                            <span className="admin-card-amount">
                              {card.investmentAmount}
                            </span>
                          </div>
                        )}
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
