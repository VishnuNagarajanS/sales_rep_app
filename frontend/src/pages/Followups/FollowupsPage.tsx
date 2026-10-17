import React, { useState, useEffect, useMemo } from 'react';
import {
  CalendarCheck,
  Phone,
  AlertTriangle,
  Briefcase,
  User,
  Calendar,
  Sparkles,
  ShieldCheck,
  CheckCircle,
  Pencil,
  RotateCcw,
  Plus,
  Trash2,
  X,
  CalendarRange,
} from 'lucide-react';
import { Followup, CallRecord, Deal, Lead, Customer } from '../../types';
import { isMockMode } from '../../config/environment';
import { storageService } from '../../services/storageService';
import { useAuth } from '../../context/AuthContext';
import { useCall } from '../../context/CallContext';
import {
  getFollowups,
  saveFollowup as apiSaveFollowup,
  completeFollowup as apiCompleteFollowup,
  deleteFollowup as apiDeleteFollowup,
  getCalls,
  getLeads,
  getCustomers,
  saveDeal as apiSaveDeal,
  saveLead as apiSaveLead,
  saveCustomer as apiSaveCustomer,
  isTenantMatch,
  transitionFollowupToKyc,
} from '../../services/ghlApiService';
import { jaminApiService } from '../../services/jaminApiService';
import { StatusChip } from '../../components/common/StatusChip';
import { Modal } from '../../components/common/Modal';
import { Drawer } from '../../components/common/Drawer';
import { LeadDetailDrawerContent } from '../../components/common/LeadDetailDrawerContent';

import { DateRangePreset } from '../../types/kanban';
import { adminUserService } from '../../services/adminUserService';
import { fetchIrmAllLeads, IrmAllLeadsSummary } from '../../services/irmAllLeadsService';
import { User as UserModel } from '../../types';
import { getAgentRoleInfo, getAssigningSalesAgentInfo } from '../../utils/agentRoleUtils';
import { formatSmartScheduleDate } from '../../utils/dateUtils';
import './FollowupsPage.css';
type FollowupRoleFilter = 'sales_executive' | 'irm' | 'all';
type FollowupAssignedRole = 'sales_executive' | 'irm';

const isFollowupReturned = (f: Followup, matchingLead?: Lead | null): boolean => {
  if (f.isReturnedFromHandover) return true;
  if (f.returnedFromCoveringUserName) return true;
  const cf = f.customFields;
  if (cf?.returnedFromHandover === 'true' || cf?.returnedFromHandover === true || Boolean(cf?.returnedFromCoveringUserName)) return true;
  if (matchingLead) {
    if (matchingLead.isReturnedFromHandover) return true;
    const lcf = matchingLead.customFields;
    if (lcf?.returnedFromHandover === 'true' || lcf?.returnedFromHandover === true || Boolean(lcf?.returnedFromCoveringUserName)) return true;
  }
  return false;
};

const getFollowupReturnedCoveringName = (f: Followup, matchingLead?: Lead | null): string => {
  return f.returnedFromCoveringUserName || f.customFields?.returnedFromCoveringUserName || matchingLead?.returnedFromCoveringUserName || matchingLead?.customFields?.returnedFromCoveringUserName || 'Covering Agent';
};

const getFollowupReturnedDate = (f: Followup, matchingLead?: Lead | null): string | undefined => {
  return f.returnedAt || f.customFields?.returnedAt || matchingLead?.returnedAt || matchingLead?.customFields?.returnedAt;
};

export const FollowupsPage: React.FC = () => {
  const { tenant, user } = useAuth();
  const normalizedRoleCode = String(user?.role?.code || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  const { initiateCall } = useCall();

  const [followups, setFollowups] = useState<Followup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [callsList, setCallsList] = useState<CallRecord[]>([]);
  const [allLeads, setAllLeads] = useState<Lead[]>([]);
  const [assignableAgents, setAssignableAgents] = useState<Array<{ id: string; name: string; email: string; roleCode: FollowupAssignedRole }>>([]);
  const [users, setUsers] = useState<UserModel[]>([]);
  const [irmSummaryData, setIrmSummaryData] = useState<IrmAllLeadsSummary | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'due' | 'overdue' | 'completed'>('all');
  const [handoverFilter, setHandoverFilter] = useState('Mine');

  // ── IRM Date Range Filter State (Only for IRM) ──
  const [irmStartDate, setIrmStartDate] = useState<string>('');
  const [irmEndDate, setIrmEndDate] = useState<string>('');
  const [irmDatePreset, setIrmDatePreset] = useState<'all' | 'today' | 'tomorrow' | 'this_week' | 'this_month' | 'overdue' | 'custom'>('all');
  const [rescheduleItem, setRescheduleItem] = useState<Followup | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('11:00 AM');
  const [rescheduleType, setRescheduleType] = useState<'call' | 'whatsapp' | 'meeting'>('call');
  const [rescheduleAgentId, setRescheduleAgentId] = useState('');
  const [rescheduleNotes, setRescheduleNotes] = useState('');

  // Complete follow-up state
  const [completeItem, setCompleteItem] = useState<Followup | null>(null);
  const [completionNotes, setCompletionNotes] = useState('');

  const [allCustomers, setAllCustomers] = useState<Customer[]>([]);

  // Schedule New Follow-up state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createContactType, setCreateContactType] = useState<'lead' | 'customer' | 'new'>('lead');
  const [createSelectedLeadId, setCreateSelectedLeadId] = useState('');
  const [createSelectedCustomerId, setCreateSelectedCustomerId] = useState('');
  const [createContactName, setCreateContactName] = useState('');
  const [createContactPhone, setCreateContactPhone] = useState('+91 ');
  const [createDate, setCreateDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  });
  const [createTime, setCreateTime] = useState('11:00 AM');
  const [createType, setCreateType] = useState<'call' | 'whatsapp' | 'meeting'>('call');
  const [createPriority, setCreatePriority] = useState<'Low' | 'Medium' | 'High'>('Medium');
  const [createAgentId, setCreateAgentId] = useState('');
  const [createNotes, setCreateNotes] = useState('');
  const [isSubmittingCreate, setIsSubmittingCreate] = useState(false);

  const handleOpenCreateModal = () => {
    setCreateContactType('lead');
    const firstLead = allLeads[0];
    setCreateSelectedLeadId(firstLead?.id || '');
    setCreateSelectedCustomerId('');
    if (firstLead) {
      setCreateContactName(firstLead.name);
      setCreateContactPhone(firstLead.phone);
    } else {
      setCreateContactName('');
      setCreateContactPhone('+91 ');
    }
    const d = new Date();
    d.setDate(d.getDate() + 1);
    setCreateDate(d.toISOString().split('T')[0]);
    setCreateTime('11:00 AM');
    setCreateType('call');
    setCreatePriority('Medium');
    setCreateAgentId(user?.id ? String(user.id) : (assignableAgents[0]?.id || ''));
    setCreateNotes('');
    setIsCreateModalOpen(true);
  };

  const handleContactTypeChange = (type: 'lead' | 'customer' | 'new') => {
    setCreateContactType(type);
    if (type === 'lead') {
      const first = allLeads[0];
      setCreateSelectedLeadId(first?.id || '');
      setCreateContactName(first?.name || '');
      setCreateContactPhone(first?.phone || '+91 ');
    } else if (type === 'customer') {
      const first = allCustomers[0];
      setCreateSelectedCustomerId(first?.id || '');
      setCreateContactName(first?.name || '');
      setCreateContactPhone(first?.phone || '+91 ');
    } else {
      setCreateSelectedLeadId('');
      setCreateSelectedCustomerId('');
      setCreateContactName('');
      setCreateContactPhone('+91 ');
    }
  };

  const handleLeadSelect = (leadId: string) => {
    setCreateSelectedLeadId(leadId);
    const found = allLeads.find(l => l.id === leadId);
    if (found) {
      setCreateContactName(found.name);
      setCreateContactPhone(found.phone);
    }
  };

  const handleCustomerSelect = (custId: string) => {
    setCreateSelectedCustomerId(custId);
    const found = allCustomers.find(c => c.id === custId);
    if (found) {
      setCreateContactName(found.name);
      setCreateContactPhone(found.phone);
    }
  };

  const handleSaveCreateFollowup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createContactName.trim() || !createContactPhone.trim()) {
      alert('Please provide contact name and phone number.');
      return;
    }
    if ((createContactType === 'lead' && !createSelectedLeadId) ||
        (createContactType === 'customer' && !createSelectedCustomerId)) {
      alert(`Select an existing ${createContactType} so this follow-up can be linked to its database record.`);
      return;
    }
    setIsSubmittingCreate(true);
    try {
      const formattedDateString = new Date(`${createDate}T${(() => { const [time, meridiem] = createTime.split(' '); let [hours, minutes] = time.split(':').map(Number); if (meridiem?.toUpperCase() === 'PM' && hours < 12) hours += 12; if (meridiem?.toUpperCase() === 'AM' && hours === 12) hours = 0; return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`; })()}`).toISOString();
      const agentObj = assignableAgents.find(a => String(a.id) === String(createAgentId));
      const agentName = agentObj?.name || user?.name || 'Agent';
      const cleanContactId = createContactType === 'lead' ? createSelectedLeadId : (createContactType === 'customer' ? createSelectedCustomerId : '');

      const newFollowup: Followup = {
        id: `fu-${Date.now()}`,
        companyId: tenant?.id || 't-jamin-02',
        contactId: cleanContactId,
        contactName: createContactName.trim(),
        contactPhone: createContactPhone.trim(),
        contactType: createContactType,
        scheduledDate: createDate,
        scheduledTime: createTime,
        scheduledAt: formattedDateString,
        priority: createPriority,
        status: 'Pending',
        followupType: createType,
        assignedAgentId: createAgentId || (user?.id ? String(user.id) : '1'),
        assignedAgentName: agentName,
        assignedRole: agentObj?.roleCode || (!isJamin && user?.role?.code === 'irm' ? 'irm' : 'sales_executive'),
        notes: createNotes.trim(),
      };

      const created = await apiSaveFollowup(tenant?.id, newFollowup);
      storageService.saveFollowup(created);

      window.dispatchEvent(new Event('nexus_storage_updated'));
      setIsCreateModalOpen(false);
      showToast(`✓ Follow-up scheduled with ${createContactName}!`);
      await loadData();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'The follow-up could not be saved. Please try again.');
    } finally {
      setIsSubmittingCreate(false);
    }
  };

  useEffect(() => {
    const isJamin = tenant?.slug === 'jamin' || tenant?.id === 't-jamin-02' || tenant?.id === '2';
    if (isJamin) {
      jaminApiService.getAgents().then(data => {
        if (data && data.length > 0) {
          setAssignableAgents(data.map(a => ({
            id: String(a.id),
            name: a.name,
            email: a.email,
            roleCode: 'sales_executive' as FollowupAssignedRole,
          })));
        } else if (user) {
          setAssignableAgents([{ id: String(user.id), name: user.name, email: user.email, roleCode: 'sales_executive' }]);
        }
      }).catch(() => {
        if (user) {
          setAssignableAgents([{ id: String(user.id), name: user.name, email: user.email, roleCode: 'sales_executive' }]);
        }
      });
    } else {
      adminUserService.getUsers(tenant?.id || '1').then(users => {
        if (users && users.length > 0) {
          const salesUsers = users.filter(u => {
            const code = String(u.role?.code || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
            return code === 'sales_executive' || code === 'irm';
          });
          setAssignableAgents(salesUsers
            .filter(u => u.status !== 'Disabled')
            .map(u => ({ id: String(u.id), name: u.name, email: u.email, roleCode: (u.role?.code === 'irm' ? 'irm' : 'sales_executive') as FollowupAssignedRole })));
        } else if (user) {
          const code = String(user.role?.code || '').toLowerCase().replace(/[\s-]+/g, '_');
          setAssignableAgents([{ id: String(user.id), name: user.name, email: user.email, roleCode: code === 'irm' ? 'irm' : 'sales_executive' }]);
        }
      }).catch(() => {
        if (user) {
          const code = String(user.role?.code || '').toLowerCase().replace(/[\s-]+/g, '_');
          setAssignableAgents([{ id: String(user.id), name: user.name, email: user.email, roleCode: code === 'irm' ? 'irm' : 'sales_executive' }]);
        }
      });
    }
  }, [tenant?.slug, tenant?.id, user]);

  const assignableAgentOptions = assignableAgents;

  const handleOpenRescheduleModal = React.useCallback((f: Followup) => {
    setRescheduleItem(f);
    const d = new Date();
    d.setDate(d.getDate() + 1);
    setRescheduleDate(f.scheduledDate || d.toISOString().split('T')[0]);
    setRescheduleTime(f.scheduledTime || '11:00 AM');
    setRescheduleType((f.followupType as any) || 'call');
    setRescheduleAgentId(f.assignedAgentId || user?.id || '');
    setRescheduleNotes(f.notes || '');
  }, [user?.id]);

  // Auto-open target follow-up if redirected from Leads 360 drawer
  useEffect(() => {
    const targetId = sessionStorage.getItem('target_followup_id');
    if (targetId && followups.length > 0) {
      sessionStorage.removeItem('target_followup_id');
      sessionStorage.removeItem('target_followup_contact');
      const found = followups.find(f => f.id === targetId || String(f.id) === String(targetId));
      if (found) {
        handleOpenRescheduleModal(found);
      }
    }
  }, [followups, handleOpenRescheduleModal]);

  // Profile Drawer state for GHL Sales Exec & Admin
  const [drawerFollowup, setDrawerFollowup] = useState<Followup | null>(null);

  // IRM Custom Preferences state
  const [isEditingPref, setIsEditingPref] = useState<boolean>(false);
  const [prefAssetClass, setPrefAssetClass] = useState<string>('');
  const [prefHorizon, setPrefHorizon] = useState<string>('');
  const [isPrefConfirmed, setIsPrefConfirmed] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // IRM Investment Capacity state
  const [isEditingCapacity, setIsEditingCapacity] = useState<boolean>(false);
  const [capacityValue, setCapacityValue] = useState<string>('');
  const [investmentAmountValue, setInvestmentAmountValue] = useState<string>('');
  const [isEditingAmount, setIsEditingAmount] = useState<boolean>(false);
  const INVESTMENT_CAPACITY_OPTIONS = ['₹1 Cr – ₹5 Cr', '₹5 Cr – ₹10 Cr', '₹10 Cr – ₹25 Cr', '₹25 Cr+'];

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const roleCode = normalizedRoleCode;
  const isExec = roleCode === 'sales_executive';
  const isGhlAdmin =
    (tenant?.slug === 'ghl' || tenant?.id === 't-ghl-01') &&
    ((roleCode as string) === 'company_admin' || (roleCode as string) === 'admin' || roleCode === 'super_admin');
  const isJamin = tenant?.slug === 'jamin' || tenant?.id === 't-jamin-02' || tenant?.id === '2';
  const isAdmin =
    isGhlAdmin ||
    (roleCode as string) === 'company_admin' ||
    (roleCode as string) === 'admin' ||
    roleCode === 'super_admin';
const isGhlSalesExec =
    (tenant?.slug === 'ghl' || tenant?.id === 't-ghl-01' || tenant?.id === '1' || tenant?.slug === '1' || tenant?.name?.toLowerCase().includes('ghl') || user?.companySlug === 'ghl') &&
    isExec;
  const isIrm = roleCode === 'irm';
  const canOpenDrawer = isGhlSalesExec || isExec || isAdmin || isIrm;

  // ── Admin Filter States ──────────────────────────────────────────────────
  const [selectedRole, setSelectedRole] = useState<FollowupRoleFilter>('all');
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
  useEffect(() => {
    if (isJamin && selectedRole !== 'all') setSelectedRole('all');
  }, [isJamin, selectedRole]);
  const handleRoleChange = (newRole: FollowupRoleFilter) => {
    setSelectedRole(newRole);
    setSelectedPerson('All');
  };

const personOptions = useMemo(() => {
    if (users && users.length > 0) {
      if (selectedRole === 'sales_executive') {
        const sales = users.filter(u => {
          const code = (u.role?.code || '').toLowerCase();
          const roleId = String(u.role?.id || '');
          const roleName = (u.role?.name || '').toLowerCase();
          return code === 'sales_executive' || roleId === '3' || roleName.includes('sales');
        });
        if (sales.length > 0) return sales;
      } else {
        const irms = users.filter(u => {
          const code = (u.role?.code || '').toLowerCase();
          const roleId = String(u.role?.id || '');
          const roleName = (u.role?.name || '').toLowerCase();
          return code === 'irm' || roleId === '4' || roleName.includes('irm') || roleName.includes('investor');
        });
        if (irms.length > 0) return irms;
      }
    }
    if (selectedRole === 'sales_executive') {
      const storageAgents = storageService.getAgents(tenant?.id);
      if (storageAgents && storageAgents.length > 0) return storageAgents;
      return [{ id: '3', name: 'Naveen' }];
    }
    const storageIrms = storageService.getIrms(tenant?.id);
    if (storageIrms && storageIrms.length > 0) return storageIrms;
    return [{ id: '5', name: 'Dhinakaran' }];
  }, [selectedRole, users, tenant?.id]);

  const loadData = React.useCallback(async () => {
    setIsLoading(true);
    try {
      setLoadError(null);
      const [data, calls, leads, fetchedUsers, irmSummary, customers] = await Promise.all([
        getFollowups(tenant?.id),
        getCalls(tenant?.id),
        getLeads(tenant?.id),
        isAdmin ? adminUserService.getUsers(tenant?.id || '') : Promise.resolve([]),
        isIrm ? fetchIrmAllLeads(user?.id, undefined, user?.name, tenant?.id).catch(() => null) : Promise.resolve(null),
        getCustomers(tenant?.id).catch(() => []),
      ]);
      setAllCustomers(customers && customers.length > 0 ? customers : storageService.getCustomers(tenant?.id) || []);

      const initialFollowups = isMockMode()
        ? ((data && data.length > 0) ? [...data] : (storageService.getFollowups(tenant?.id) || []))
        : (Array.isArray(data) ? [...data] : []);

      let followupsList = [...initialFollowups];

      // Also ensure any lead with status 'Follow-up Required' is represented in followups
      const existingContactIds = new Set(followupsList.map(f => String(f.contactId || f.id)));
      const existingPhones = new Set(followupsList.map(f => (f.contactPhone || '').replace(/\D/g, '').slice(-10)).filter(Boolean));

      (leads || []).forEach(l => {
        // Only synthesize a ghost followup if this lead is actually assigned to the current user.
        // Without this guard, a covering agent would keep seeing a fake followup card even after
        // the handover ends and the lead's assignedAgentId reverts to the original owner.
        if (l.status === 'Follow-up Required' && (!isAdmin && !isIrm ? String(l.assignedAgentId) === String(user?.id) : true)) {
          const lPhone = (l.phone || '').replace(/\D/g, '').slice(-10);
          if (!existingContactIds.has(String(l.id)) && (!lPhone || !existingPhones.has(lPhone))) {
            followupsList.push({
              id: `flw-lead-${l.id}`,
              companyId: l.companyId || tenant?.id || '1',
              contactId: String(l.id),
              contactName: l.name,
              contactPhone: l.phone,
              contactType: 'lead',
              scheduledAt: l.createdAt || new Date().toISOString(),
              priority: l.priority === 'Urgent' ? 'High' : (l.priority as any || 'Medium'),
              status: 'Pending',
              notes: l.notes || 'Lead marked Follow-up Required',
              assignedAgentId: String(l.assignedAgentId || ''),
              assignedAgentName: l.assignedAgentName || '',
              handoverId: l.handoverId,
              handedOverFromName: l.handedOverFromName,
              handoverPlannedEnd: l.handoverPlannedEnd,
              isReturnedFromHandover: l.isReturnedFromHandover,
              returnedFromCoveringUserName: l.returnedFromCoveringUserName,
              returnedAt: l.returnedAt,
              customFields: l.customFields,
            });
          }
        }
      });

      setFollowups(followupsList);
      setCallsList(calls || []);
      setIrmSummaryData(irmSummary);

      let mergedLeads = leads || [];
      if (irmSummary && Array.isArray(irmSummary.leads)) {
        const leadMap = new Map<string, Lead>();
        mergedLeads.forEach(l => {
          const key = (l.phone ? l.phone.replace(/\D/g, '').slice(-10) : '') || String(l.id);
          leadMap.set(key, l);
        });
        irmSummary.leads.forEach(il => {
          const key = (il.phone ? il.phone.replace(/\D/g, '').slice(-10) : '') || String(il.id);
          const existing = leadMap.get(key);
          if (existing) {
            leadMap.set(key, {
              ...existing,
              assignedById: il.assignedById != null ? String(il.assignedById) : existing.assignedById,
              assignedByName: (il.assignedByName && il.assignedByName !== 'Created by IRM') ? il.assignedByName : existing.assignedByName,
            });
          } else {
            leadMap.set(key, {
              id: String(il.id),
              companyId: String(il.companyId || tenant?.id || '1'),
              name: il.name,
              phone: il.phone,
              email: il.email,
              location: il.location,
              source: il.source,
              status: (il.status as any) || 'Interested',
              priority: (il.priority as any) || 'Medium',
              assignedAgentId: String(il.assignedAgentId || user?.id || ''),
              assignedAgentName: il.assignedAgentName || user?.name || '',
              assignedById: il.assignedById != null ? String(il.assignedById) : undefined,
              assignedByName: il.assignedByName || '',
              createdAt: il.createdAt,
              notes: il.notes || '',
              customFields: {
                investmentCapacity: il.investmentCapacity,
                preferredAssetClass: il.preferredAssetClass,
              },
            });
          }
        });
        mergedLeads = Array.from(leadMap.values());
      }

      setAllLeads(mergedLeads);
      if (fetchedUsers && fetchedUsers.length > 0) {
        setUsers(fetchedUsers);
      }
    } catch (err: any) {
      console.error('Failed to load followups data', err);
      if (isMockMode()) {
        setFollowups(storageService.getFollowups(tenant?.id) || []);
      } else {
        setFollowups([]);
        setLoadError(err?.message || 'Failed to load follow-up records from server.');
      }
    }
    setIsLoading(false);
  }, [tenant?.id, user?.id, user?.name, isAdmin, isIrm]);

  useEffect(() => {
    loadData();
    let timer: any = null;
    const handleUpdate = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        loadData();
      }, 350);
    };
    window.addEventListener('nexus_storage_updated', handleUpdate);
    window.addEventListener('nexus_handover_updated', handleUpdate);
    return () => {
      window.removeEventListener('nexus_storage_updated', handleUpdate);
      window.removeEventListener('nexus_handover_updated', handleUpdate);
    };
  }, [loadData]);

  // Sync IRM preference state when drawer opens for a contact
  useEffect(() => {
    if (!drawerFollowup) return;
    const fDigits = (drawerFollowup.contactPhone || '').replace(/\D/g, '').slice(-10);
    const l = drawerFollowup.contactType === 'lead'
      ? allLeads.find(item => String(item.id) === String(drawerFollowup.contactId))
      : undefined;
    const c = drawerFollowup.contactType === 'customer'
      ? allCustomers.find(item => String(item.id) === String(drawerFollowup.contactId))
      : undefined;

    const contactKey = drawerFollowup.contactId;
    let savedLocal: any = null;
    if (contactKey) {
      try {
        const raw = localStorage.getItem(`nexus_irm_pref_${contactKey}`);
        if (raw) savedLocal = JSON.parse(raw);
      } catch { }
    }

    const isLeadOrCustConfirmed =
      l?.customFields?.irmPreferencesConfirmed === true ||
      c?.customFields?.irmPreferencesConfirmed === true;

    // If lead or customer exists and is NOT confirmed, discard and purge any stale local cache
    if ((l || c) && !isLeadOrCustConfirmed && savedLocal?.confirmed) {
      if (contactKey) localStorage.removeItem(`nexus_irm_pref_${contactKey}`);
      if (fDigits) localStorage.removeItem(`nexus_irm_pref_${fDigits}`);
      savedLocal = null;
    }

    const isConfirmed = isLeadOrCustConfirmed || Boolean(!l && !c && savedLocal?.confirmed === true);

    const savedAssetClass = isConfirmed
      ? (l?.customFields?.irmPreferencesConfirmed && l?.customFields?.preferredAssetClass) ||
        (c?.customFields?.irmPreferencesConfirmed && c?.customFields?.preferredAssetClass) ||
        savedLocal?.preferredAssetClass ||
        ''
      : '';

    const savedHorizon = isConfirmed
      ? (l?.customFields?.irmPreferencesConfirmed && (l?.customFields?.horizon || l?.customFields?.investmentHorizon)) ||
        (c?.customFields?.irmPreferencesConfirmed && (c?.customFields?.horizon || c?.customFields?.investmentHorizon)) ||
        savedLocal?.horizon ||
        ''
      : '';

    setPrefAssetClass(savedAssetClass);
    setPrefHorizon(savedHorizon);
    setIsPrefConfirmed(isConfirmed);
    setIsEditingPref(false);

    const existingCapacity =
      l?.customFields?.investmentCapacity ||
      l?.customFields?.capacityRange ||
      l?.customFields?.investmentRange ||
      (l as any)?.investmentRange ||
      c?.customFields?.investmentCapacity ||
      c?.customFields?.totalAUMCommitted ||
      (drawerFollowup as any)?.investmentCapacity ||
      '';
    setCapacityValue(existingCapacity);
    setIsEditingCapacity(false);

    const allDeals = storageService.getDeals(tenant?.id) || [];
    const existingDeal = allDeals.find((d: Deal) =>
      (d.phone && d.phone.replace(/\D/g, '').slice(-10) === fDigits) ||
      (drawerFollowup?.contactId && (d.customerId === drawerFollowup.contactId || d.id === drawerFollowup.contactId))
    );
    const existingAmount =
      l?.customFields?.investmentAmount ||
      c?.customFields?.investmentAmount ||
      (drawerFollowup as any)?.investmentAmount ||
      (existingDeal?.value ? String(existingDeal.value) : '') ||
      '';
    setInvestmentAmountValue(existingAmount ? String(existingAmount) : '');
    setIsEditingAmount(false);
  }, [drawerFollowup, allLeads, allCustomers, tenant?.id]);

  const handleTogglePrefCheckbox = (checked: boolean, matchingLead: Lead | null, matchingCustomer: Customer | null) => {
    if (checked) {
      setIsEditingPref(true);
    } else {
      setIsEditingPref(false);
      setIsPrefConfirmed(false);
      setPrefAssetClass('');
      setPrefHorizon('');

      if (!drawerFollowup) return;
      const fDigits = (drawerFollowup.contactPhone || '').replace(/\D/g, '').slice(-10);
      const contactKey = drawerFollowup.contactId;

      if (matchingLead) {
        storageService.saveLead({
          ...matchingLead,
          customFields: {
            ...(matchingLead.customFields || {}),
            preferredAssetClass: '',
            horizon: '',
            investmentHorizon: '',
            irmPreferencesConfirmed: false,
          },
        });
      }

      if (matchingCustomer) {
        storageService.saveCustomer({
          ...matchingCustomer,
          customFields: {
            ...(matchingCustomer.customFields || {}),
            preferredAssetClass: '',
            horizon: '',
            investmentHorizon: '',
            irmPreferencesConfirmed: false,
          },
        });
      }

      if (contactKey) {
        localStorage.removeItem(`nexus_irm_pref_${contactKey}`);
      }
      if (fDigits) {
        localStorage.removeItem(`nexus_irm_pref_${fDigits}`);
      }

      window.dispatchEvent(new Event('nexus_storage_updated'));
      showToast('Preferences unconfirmed — Hidden from other modules');
    }
  };

  const handleSaveCapacity = (matchingLead: Lead | null, matchingCustomer: Customer | null) => {
    if (!drawerFollowup) return;
    if (matchingLead) {
      storageService.saveLead({
        ...matchingLead,
        customFields: {
          ...(matchingLead.customFields || {}),
          investmentCapacity: capacityValue,
        },
      });
    }
    if (matchingCustomer) {
      storageService.saveCustomer({
        ...matchingCustomer,
        customFields: {
          ...(matchingCustomer.customFields || {}),
          investmentCapacity: capacityValue,
        },
      });
    }
    window.dispatchEvent(new Event('nexus_storage_updated'));
    showToast('Investment Capacity updated');
    setIsEditingCapacity(false);
  };

  const handleSaveInvestmentAmount = async (matchingLead: Lead | null, matchingCustomer: Customer | null) => {
    if (!drawerFollowup) return;
    const num = parseFloat(investmentAmountValue.replace(/,/g, '').trim()) || 0;
    const cleanStr = num > 0 ? String(num) : '';

    const fDigits = (drawerFollowup.contactPhone || '').replace(/\D/g, '').slice(-10);
    const resolvedContactId = drawerFollowup.contactId || matchingLead?.id || matchingCustomer?.id;
    const allDeals = storageService.getDeals(tenant?.id) || [];
    const existingDeal = allDeals.find((deal: Deal) =>
      (resolvedContactId && (deal.customerId === resolvedContactId || deal.id === resolvedContactId)) ||
      (drawerFollowup.contactPhone && deal.phone === drawerFollowup.contactPhone) ||
      (fDigits && deal.phone && deal.phone.replace(/\D/g, '').slice(-10) === fDigits)
    );

    if (!matchingLead && !matchingCustomer && !existingDeal) {
      showToast('Cannot save Investment Amount: No matching lead, customer, or deal record found.');
      return;
    }

    let serverSavesConfirmed = 0;

    if (matchingLead) {
      const updatedLead: Lead = {
        ...matchingLead,
        customFields: {
          ...(matchingLead.customFields || {}),
          investmentAmount: cleanStr,
        },
      };
      try {
        await apiSaveLead(updatedLead);
        serverSavesConfirmed++;
      } catch (err: any) {
        console.error('[FollowupsPage] Server saveLead failed:', err);
        showToast(`Server save failed for lead: ${err?.message || 'Server error'}`);
        return;
      }
    }

    if (matchingCustomer) {
      const updatedCust: Customer = {
        ...matchingCustomer,
        customFields: {
          ...(matchingCustomer.customFields || {}),
          investmentAmount: cleanStr,
        },
      };
      try {
        await apiSaveCustomer(updatedCust);
        serverSavesConfirmed++;
      } catch (err: any) {
        console.error('[FollowupsPage] Server saveCustomer failed:', err);
        showToast(`Server save failed for customer: ${err?.message || 'Server error'}`);
        return;
      }
    }

    if (existingDeal) {
      const updatedDeal: Deal = {
        ...existingDeal,
        value: num,
      };
      try {
        await apiSaveDeal(updatedDeal);
        serverSavesConfirmed++;
      } catch (err: any) {
        console.error('[FollowupsPage] Server saveDeal failed:', err);
        showToast(`Server save failed for deal: ${err?.message || 'Server error'}`);
        return;
      }
    }

    if (serverSavesConfirmed === 0) {
      showToast('No matching record was saved to the server.');
      return;
    }

    setDrawerFollowup(prev => prev ? ({ ...prev, investmentAmount: cleanStr } as any) : null);

    window.dispatchEvent(new Event('nexus_storage_updated'));
    showToast('✓ Investment Amount saved successfully to server');
    setIsEditingAmount(false);
  };

  const handleSavePreferences = (matchingLead: Lead | null, matchingCustomer: Customer | null) => {
    if (!drawerFollowup) return;
    if (!prefAssetClass && !prefHorizon) {
      showToast('Please select Preferred Asset Class or Investment Horizon before confirming');
      return;
    }

    const fDigits = (drawerFollowup.contactPhone || '').replace(/\D/g, '').slice(-10);
    const contactKey = drawerFollowup.contactId || fDigits;

    if (matchingLead) {
      const updatedLead: Lead = {
        ...matchingLead,
        customFields: {
          ...(matchingLead.customFields || {}),
          preferredAssetClass: prefAssetClass,
          horizon: prefHorizon,
          investmentHorizon: prefHorizon,
          irmPreferencesConfirmed: true,
        },
      };
      storageService.saveLead(updatedLead);
    }

    if (matchingCustomer) {
      const updatedCustomer: Customer = {
        ...matchingCustomer,
        customFields: {
          ...(matchingCustomer.customFields || {}),
          preferredAssetClass: prefAssetClass,
          horizon: prefHorizon,
          investmentHorizon: prefHorizon,
          irmPreferencesConfirmed: true,
        },
      };
      storageService.saveCustomer(updatedCustomer);
    }

    if (contactKey) {
      localStorage.setItem(
        `nexus_irm_pref_${contactKey}`,
        JSON.stringify({
          preferredAssetClass: prefAssetClass,
          horizon: prefHorizon,
          confirmed: true,
        })
      );
    }

    setIsPrefConfirmed(true);
    setIsEditingPref(false);
    window.dispatchEvent(new Event('nexus_storage_updated'));
    showToast('✓ Preferences confirmed by IRM and updated across modules!');
  };

  const handleMoveToKyc = async () => {
    if (isJamin || !drawerFollowup) return;

    const matchingLead = drawerFollowup.contactType === 'lead'
      ? allLeads.find(l => String(l.id) === String(drawerFollowup.contactId)) || null
      : null;
    const matchingCustomer = drawerFollowup.contactType === 'customer'
      ? allCustomers.find(c => String(c.id) === String(drawerFollowup.contactId)) || null
      : null;

    const resolvedContactId = drawerFollowup.contactId || matchingLead?.id || matchingCustomer?.id || `contact-${Date.now()}`;
    const contactEmail = matchingLead?.email || matchingCustomer?.email || (drawerFollowup as any).email || '';
    const contactLocation = matchingLead?.location || matchingCustomer?.location || (drawerFollowup as any).location || '';

    const _investmentCapacity =
      matchingLead?.customFields?.investmentCapacity ||
      matchingLead?.customFields?.capacityRange ||
      matchingLead?.customFields?.investmentRange ||
      (matchingLead as any)?.investmentRange ||
      matchingCustomer?.customFields?.investmentCapacity ||
      matchingCustomer?.customFields?.totalAUMCommitted ||
      (drawerFollowup as any)?.investmentCapacity ||
      '';   // No hardcoded default — only use what the contact actually provided

try {
      await transitionFollowupToKyc({
        contactName: drawerFollowup.contactName,
        contactPhone: drawerFollowup.contactPhone,
        contactEmail: contactEmail && contactEmail !== '—' ? contactEmail : undefined,
        contactLocation: contactLocation && contactLocation !== '—' ? contactLocation : undefined,
        contactId: resolvedContactId,
        followupId: drawerFollowup.id,
        followupNotes: drawerFollowup.notes,
        followupPriority: drawerFollowup.priority || 'High',
        investmentAmount: investmentAmountValue,
        preferredAssetClass: isPrefConfirmed ? prefAssetClass : '',
        investmentHorizon: isPrefConfirmed ? prefHorizon : '',
        isPrefConfirmed: Boolean(isPrefConfirmed),
        assignedAgentId: user?.id || drawerFollowup.assignedAgentId || '',
        assignedAgentName: user?.name || drawerFollowup.assignedAgentName || '',
        tenantId: tenant?.id || 't-ghl-01',
        tenantName: tenant?.name || 'GHL India Ventures',
        actorName: user?.name || 'IRM',
        actorEmail: user?.email || 'irm@ghl.com',
      });

      setDrawerFollowup(null);
      loadData();
      showToast(`✓ ${drawerFollowup.contactName} moved to KYC module!`);
    } catch (err: any) {
      console.error('[FollowupsPage] transitionFollowupToKyc failed:', err);
      showToast(`Failed to move to KYC: ${err?.message || 'Error updating deal status'}`);
    }
  };

  const handleSaveReschedule = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!rescheduleItem) return;
    const formattedFollowupString = rescheduleTime ? `${rescheduleDate}T${rescheduleTime}` : rescheduleDate;
    try {
      await apiSaveFollowup({
        ...rescheduleItem,
        scheduledAt: formattedFollowupString,
        scheduledDate: rescheduleDate,
        scheduledTime: rescheduleTime,
        followupType: rescheduleType,
        status: 'Pending',
      });
      showToast('✓ Follow-up rescheduled successfully');
    } catch (err: any) {
      console.error('[FollowupsPage] API reschedule failed:', err);
      showToast(`Failed to reschedule follow-up: ${err?.message || 'Server error'}`);
    }

    // Also update lead record if matching using authoritative state
    const matchingLead = allLeads.find(l =>
      (rescheduleItem.contactId && rescheduleItem.contactId !== 'contact-new' && String(l.id) === String(rescheduleItem.contactId)) ||
      (rescheduleItem.contactPhone && (l.phone || '').replace(/\D/g, '').slice(-10) === (rescheduleItem.contactPhone || '').replace(/\D/g, '').slice(-10))
    );
    if (matchingLead) {
      const isProtected = matchingLead.status === 'Booking In Progress' || matchingLead.status === 'Converted';
      const nextStatus = (!isProtected && (matchingLead.status === 'New' || matchingLead.status === 'Contacted' || matchingLead.status === 'Follow-up Completed'))
        ? 'Follow-up Required'
        : matchingLead.status;
      const updatedLead = {
        ...matchingLead,
        status: nextStatus as any,
        nextFollowupDate: formattedFollowupString,
        nextFollowupType: rescheduleType,
      };
      try {
        await apiSaveLead(updatedLead);
      } catch (err) {
        console.warn('[FollowupsPage] Failed to update lead on reschedule:', err);
      }
    }

    const contactName = rescheduleItem.contactName;
    setRescheduleItem(null);
    await loadData();
    window.dispatchEvent(new Event('nexus_storage_updated'));
    showToast(`✓ Follow-up rescheduled for ${contactName} on ${rescheduleDate}!`);
  };

  const handleReopenFollowup = async (f: Followup) => {
    try {
      await apiSaveFollowup({
        ...f,
        status: 'Pending',
        completedAt: undefined,
      });
      await loadData();
      window.dispatchEvent(new Event('nexus_storage_updated'));
      showToast(`✓ Reopened follow-up for ${f.contactName}`);
    } catch (err: any) {
      console.error('[FollowupsPage] handleReopenFollowup failed:', err);
      showToast(`Failed to reopen follow-up: ${err?.message || 'Server error'}`);
    }
  };

  const handleCompleteFollowup = async (f: Followup | null, notes?: string) => {
    if (!f) return;
    try {
      await apiCompleteFollowup(f.id);
      const updated: Followup = {
        ...f,
        status: 'Completed',
        completedAt: new Date().toISOString(),
        notes: notes ? `${f.notes ? `${f.notes} | ` : ''}${notes}` : f.notes,
      };
      storageService.saveFollowup(updated);
      setFollowups(prev => prev.map(item => (item.id === f.id ? updated : item)));
      setCompleteItem(null);
      setCompletionNotes('');
      window.dispatchEvent(new Event('nexus_storage_updated'));
      showToast('✓ Follow-up marked as completed!');
    } catch (err: any) {
      console.error('Failed to complete follow-up', err);
      showToast('Failed to complete follow-up. Please try again.');
    }
  };

  const handleCancelFollowup = async (f: Followup) => {
    if (!window.confirm(`Are you sure you want to cancel the follow-up for ${f.contactName}?`)) return;
    try {
      const updated: Followup = {
        ...f,
        status: 'Cancelled' as any,
      };
      await apiSaveFollowup(tenant?.id, updated);
      storageService.saveFollowup(updated);
      setFollowups(prev => prev.filter(item => item.id !== f.id));
      window.dispatchEvent(new Event('nexus_storage_updated'));
      showToast(`Follow-up with ${f.contactName} cancelled.`);
    } catch (err: any) {
      console.error('Failed to cancel follow-up', err);
      showToast('Failed to cancel follow-up.');
    }
  };

  const handleDeleteFollowup = async (f: Followup) => {
    if (!window.confirm(`Delete follow-up reminder for ${f.contactName}?`)) return;
    try {
      await apiDeleteFollowup(f.id);
      storageService.deleteFollowup(f.id);
      setFollowups(prev => prev.filter(item => item.id !== f.id));
      window.dispatchEvent(new Event('nexus_storage_updated'));
      showToast(`Follow-up for ${f.contactName} deleted.`);
    } catch (err: any) {
      console.error('Failed to delete follow-up', err);
      showToast('Failed to delete follow-up.');
    }
  };

  const handleApplyIrmPreset = (preset: 'all' | 'today' | 'tomorrow' | 'this_week' | 'this_month' | 'overdue') => {
    setIrmDatePreset(preset);
    const now = new Date();
    if (preset === 'all') {
      setIrmStartDate('');
      setIrmEndDate('');
    } else if (preset === 'today') {
      const todayStr = now.toISOString().split('T')[0];
      setIrmStartDate(todayStr);
      setIrmEndDate(todayStr);
    } else if (preset === 'tomorrow') {
      const tmrw = new Date(now);
      tmrw.setDate(tmrw.getDate() + 1);
      const tmrwStr = tmrw.toISOString().split('T')[0];
      setIrmStartDate(tmrwStr);
      setIrmEndDate(tmrwStr);
    } else if (preset === 'this_week') {
      const day = now.getDay();
      const diffToMonday = day === 0 ? -6 : 1 - day;
      const mon = new Date(now);
      mon.setDate(mon.getDate() + diffToMonday);
      const sun = new Date(mon);
      sun.setDate(sun.getDate() + 6);
      setIrmStartDate(mon.toISOString().split('T')[0]);
      setIrmEndDate(sun.toISOString().split('T')[0]);
    } else if (preset === 'this_month') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      setIrmStartDate(firstDay.toISOString().split('T')[0]);
      setIrmEndDate(lastDay.toISOString().split('T')[0]);
    } else if (preset === 'overdue') {
      setIrmStartDate('');
      setIrmEndDate('');
    }
  };

  const handleIrmDateChange = (type: 'start' | 'end', val: string) => {
    setIrmDatePreset('custom');
    if (type === 'start') setIrmStartDate(val);
    else setIrmEndDate(val);
  };

  const handleClearIrmDateFilter = () => {
    setIrmStartDate('');
    setIrmEndDate('');
    setIrmDatePreset('all');
  };

  const isFollowupToday = (f: Followup): boolean => {
    const schedStr = (f.scheduledAt || '').trim();
    const dateStr = (f.scheduledDate || '').trim();
    const now = new Date();
    const parsedTime = Date.parse(schedStr) || (dateStr ? Date.parse(dateStr) : NaN);
    if (isNaN(parsedTime)) return schedStr.toLowerCase().includes('today');
    const d = new Date(parsedTime);
    return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  };

  const isFollowupOverdue = (f: Followup): boolean => {
    const schedStr = (f.scheduledAt || '').trim();
    const dateStr = (f.scheduledDate || '').trim();
    const now = new Date();
    const parsedTime = Date.parse(schedStr) || (dateStr ? Date.parse(dateStr) : NaN);
    if (isNaN(parsedTime)) return schedStr.toLowerCase().includes('yesterday');
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    return parsedTime < todayStart;
  };

  const isFollowupInIrmDateRange = React.useCallback((f: Followup): boolean => {
    if (irmDatePreset === 'all' && !irmStartDate && !irmEndDate) return true;
    if (irmDatePreset === 'overdue') {
      return isFollowupOverdue(f) && !isFollowupToday(f);
    }
    const schedStr = (f.scheduledAt || f.scheduledDate || '').trim();
    if (!schedStr) return false;
    const parsedTime = Date.parse(schedStr);
    const dateStr = !isNaN(parsedTime)
      ? new Date(parsedTime).toISOString().split('T')[0]
      : (f.scheduledDate || '');
    if (!dateStr) return true;

    if (irmStartDate && dateStr < irmStartDate) return false;
    if (irmEndDate && dateStr > irmEndDate) return false;
    return true;
  }, [irmDatePreset, irmStartDate, irmEndDate]);

  // Helper to determine the assigned role of any followup
  const getFollowupRole = React.useCallback((f: Followup): 'Sales Executive' | 'IRM' => {
    if (f.assignedRole) {
      const lower = f.assignedRole.toLowerCase();
      if (lower.includes('irm') || lower.includes('investor')) return 'IRM';
      if (lower.includes('sales')) return 'Sales Executive';
    }

    const agentName = (f.assignedAgentName || '').toLowerCase().trim();
    const agentId = String(f.assignedAgentId || '').trim();

    // Match against real DB users list
    const foundUser = (users || []).find(u =>
      (agentName && u.name.toLowerCase().trim() === agentName) ||
      (agentId && String(u.id) === agentId)
    );

    if (foundUser) {
      const code = (foundUser.role?.code || '').toLowerCase();
      const roleId = String(foundUser.role?.id || '');
      const roleName = (foundUser.role?.name || '').toLowerCase();
      if (code === 'irm' || roleId === '4' || roleName.includes('irm') || roleName.includes('investor')) {
        return 'IRM';
      }
      return 'Sales Executive';
    }
    // Direct check for known IRMs in db or storage
    if (agentName.includes('dhinakaran') || agentId === '5' || agentName.includes('irm')) {
      return 'IRM';
    }
    const irmsList = storageService.getIrms ? storageService.getIrms(tenant?.id) : [];
    if (
      irmsList.some(
        (u: any) =>
          (u.name && u.name.toLowerCase() === agentName) ||
          String(u.id) === agentId
      )
    ) {
      return 'IRM';
    }

    if (f.contactType === 'investor') {
      return 'IRM';
    }

    return 'Sales Executive';
  }, [users, tenant?.id]);

  // Helper to determine the display agent and role for a followup card or drawer
  const getFollowupDisplayAgent = (f: Followup): { label: string; name: string; role: string; badgeClass: string } => {
    const fPhone = (f.contactPhone || '').replace(/\D/g, '').slice(-10);
    const matchingLead = allLeads.find(l => {
      const idMatch = f.contactId && String(f.contactId) === String(l.id);
      const lPhone = (l.phone || '').replace(/\D/g, '').slice(-10);
      return idMatch || Boolean(fPhone && lPhone && fPhone === lPhone);
    });

    if (isIrm) {
      // When IRM user is viewing follow-ups, display the Sales Agent who assigned/qualified the lead
      const salesInfo = getAssigningSalesAgentInfo(matchingLead, f);
      return {
        label: 'Assigned Agent',
        name: salesInfo.name,
        role: salesInfo.role,
        badgeClass: salesInfo.badgeClass,
      };
    }

    const salesAgentName =
      (f.assignedByName && f.assignedByName !== 'Created by IRM' ? f.assignedByName : null) ||
      (matchingLead?.assignedByName && matchingLead.assignedByName !== 'Created by IRM' ? matchingLead.assignedByName : null) ||
      matchingLead?.customFields?.qualifiedByAgentName ||
      matchingLead?.customFields?.assignedByAgentName ||
      matchingLead?.customFields?.agentName ||
      f.assignedAgentName ||
      matchingLead?.assignedAgentName ||
      (String(matchingLead?.assignedById) === '3' || String(f.assignedById) === '3' ? 'Naveen' : null) ||
      (String(matchingLead?.assignedById) === '2' || String(f.assignedById) === '2' ? 'Vishnu' : null) ||
      (user?.role?.code === 'sales_executive' ? user?.name : 'Naveen') ||
      'Naveen';

    const info = getAgentRoleInfo(salesAgentName, f.assignedById || matchingLead?.assignedById);
    return {
      label: 'Assigned Agent',
      name: info.name,
      role: info.role,
      badgeClass: info.badgeClass,
    };
  };

  // Helper to test if a followup date falls within date range filter
  const isFollowupInDateFilter = React.useCallback((f: Followup): boolean => {
    if (dateRangePreset === 'all') return true;
    const schedStr = (f.scheduledAt || '').trim();
    const dateStr = (f.scheduledDate || '').trim();
    const now = new Date();

    const isToday = () => {
      const parsedTime = Date.parse(schedStr) || (dateStr ? Date.parse(dateStr) : NaN);
      if (isNaN(parsedTime)) return schedStr.toLowerCase().includes('today');
      const d = new Date(parsedTime);
      return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    };

    const isYesterday = () => {
      const parsedTime = Date.parse(schedStr) || (dateStr ? Date.parse(dateStr) : NaN);
      if (isNaN(parsedTime)) return schedStr.toLowerCase().includes('yesterday');
      const d = new Date(parsedTime);
      const yest = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      return d.getDate() === yest.getDate() && d.getMonth() === yest.getMonth() && d.getFullYear() === yest.getFullYear();
    };

    if (dateRangePreset === 'today') {
      return isToday();
    }

    if (dateRangePreset === 'this_week') {
      if (isToday() || isYesterday()) return true;
      const parsedTime = Date.parse(schedStr) || (dateStr ? Date.parse(dateStr) : NaN);
      if (!isNaN(parsedTime)) {
        const sevenDaysAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000;
        return parsedTime >= sevenDaysAgo;
      }
      return true;
    }

    if (dateRangePreset === 'this_month') {
      if (isToday() || isYesterday()) return true;
      const parsedTime = Date.parse(schedStr) || (dateStr ? Date.parse(dateStr) : NaN);
      if (!isNaN(parsedTime)) {
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
        return parsedTime >= monthStart;
      }
      return true;
    }

    if (dateRangePreset === 'custom') {
      if (!customStartDate && !customEndDate) return true;
      const start = customStartDate ? new Date(`${customStartDate}T00:00:00`).getTime() : 0;
      const end = customEndDate ? new Date(`${customEndDate}T23:59:59`).getTime() : Infinity;

      const parsedTime = Date.parse(schedStr) || (dateStr ? Date.parse(dateStr) : NaN);
      if (!isNaN(parsedTime)) {
        return parsedTime >= start && parsedTime <= end;
      }
      return true;
    }

    return true;
  }, [dateRangePreset, customStartDate, customEndDate]);

  // Scoped dataset according to role and admin filters
  const processedFollowups = useMemo(() => {
    let scopedFollowups: Followup[];
  if (isAdmin) {
    scopedFollowups = followups.filter(f => {
      // Admins see all company follow-ups by default and may filter by role.
      const role = getFollowupRole(f);
      if (selectedRole !== 'all') {
        const expectedRole = selectedRole === 'irm' ? 'IRM' : 'Sales Executive';
        if (role !== expectedRole) return false;
      }

      // 2. Person match
      if (selectedPerson !== 'All') {
        const matchesName =
          (f.assignedAgentName || '').toLowerCase() === selectedPerson.toLowerCase();
        const matchesId = f.assignedAgentId === selectedPerson;
        if (!matchesName && !matchesId) return false;
      }

      // 3. Date range match
      if (!isFollowupInDateFilter(f)) return false;

      return true;
    });
  } else if (isExec) {
scopedFollowups = followups.filter(f => {
      if (f.status !== 'Pending') return false;
      const isDirectlyAssigned =
        (f.assignedAgentId && String(f.assignedAgentId) === String(user?.id)) ||
        (f.assignedAgentName && user?.name && f.assignedAgentName.trim().toLowerCase() === user.name.trim().toLowerCase());
      if (isDirectlyAssigned) return true;

      const fPhone = (f.contactPhone || '').replace(/\D/g, '').slice(-10);
      const matchingLead = allLeads.find(l => {
        const idMatch = f.contactId && String(f.contactId) === String(l.id);
        const lPhone = (l.phone || '').replace(/\D/g, '').slice(-10);
        return idMatch || Boolean(fPhone && lPhone && fPhone === lPhone);
      });

      if (matchingLead) {
        return (
          (matchingLead.assignedAgentId && String(matchingLead.assignedAgentId) === String(user?.id)) ||
          (matchingLead.assignedAgentName && user?.name && matchingLead.assignedAgentName.trim().toLowerCase() === user.name.trim().toLowerCase())
        );
      }
      return false;
    });
  } else if (isIrm) {
    // IRM: Show pending follow-ups assigned to THIS authenticated IRM OR associated with a lead assigned to THIS IRM
    // Build sets of contacts that have moved beyond follow-up (KYC, Opportunities, Converted, etc.)
    const advancedContactIds = new Set<string>();
    const advancedContactPhones = new Set<string>();
    const advancedContactNames = new Set<string>();

    if (irmSummaryData && Array.isArray(irmSummaryData.leads)) {
      irmSummaryData.leads.forEach(il => {
        const stage = (il.currentStage || '').toLowerCase();
        const st = (il.status || '').toLowerCase();
        if (
          stage === 'kyc' ||
          stage === 'opportunities' ||
          stage === 'converted' ||
          stage === 'archived' ||
          st === 'qualified' ||
          st === 'converted' ||
          st === 'not interested' ||
          st === 'junk'
        ) {
          if (il.id) advancedContactIds.add(String(il.id));
          const p10 = (il.phone || '').replace(/\D/g, '').slice(-10);
          if (p10) advancedContactPhones.add(p10);
          if (il.name) advancedContactNames.add(il.name.trim().toLowerCase());
        }
      });
    }

    scopedFollowups = followups.filter(f => {
      if (f.status !== 'Pending') return false;
      if (f.companyId && tenant?.id && !isTenantMatch(f.companyId, tenant.id)) return false;

      const fPhone = (f.contactPhone || '').replace(/\D/g, '').slice(-10);
      const fName = (f.contactName || '').trim().toLowerCase();
      const fId = f.contactId ? String(f.contactId) : '';

      // Stage isolation: if this contact has moved to KYC, Opportunities, Converted, etc., NEVER show in Follow-up
      if (fId && advancedContactIds.has(fId)) return false;
      if (fPhone && advancedContactPhones.has(fPhone)) return false;
      if (fName && advancedContactNames.has(fName)) return false;

      const matchingLead = allLeads.find(l => {
        const idMatch = f.contactId && String(f.contactId) === String(l.id);
        const lPhone = (l.phone || '').replace(/\D/g, '').slice(-10);
        return idMatch || Boolean(fPhone && lPhone && fPhone === lPhone);
      });

      if (matchingLead) {
        const mlStatus = (matchingLead.status || '').toLowerCase();
        if (mlStatus === 'qualified' || mlStatus === 'converted' || mlStatus === 'not interested' || mlStatus === 'junk') {
          return false;
        }
      }

      const isDirectlyAssigned =
        (f.assignedAgentId && String(f.assignedAgentId) === String(user?.id)) ||
        (f.assignedAgentName && user?.name && f.assignedAgentName.trim().toLowerCase() === user.name.trim().toLowerCase());
      if (isDirectlyAssigned) return true;

      if (matchingLead) {
        return (
          (matchingLead.assignedAgentId && String(matchingLead.assignedAgentId) === String(user?.id)) ||
          (matchingLead.assignedAgentName && user?.name && matchingLead.assignedAgentName.trim().toLowerCase() === user.name.trim().toLowerCase())
        );
      }

      return false;
    });

    // Also synthesize follow-up tasks for any leads assigned to this IRM that are in Follow-up stage but lack a standalone followup record
    const existingFollowupContactIds = new Set(
      scopedFollowups.map(f => String(f.contactId)).filter(Boolean)
    );
    const existingFollowupPhones = new Set(
      scopedFollowups.map(f => (f.contactPhone || '').replace(/\D/g, '').slice(-10)).filter(Boolean)
    );

    const missingFollowupLeads = allLeads.filter(l => {
      const isAssignedToMe =
        (l.assignedAgentId && String(l.assignedAgentId) === String(user?.id)) ||
        (l.assignedAgentName && user?.name && l.assignedAgentName.trim().toLowerCase() === user.name.trim().toLowerCase());
      if (!isAssignedToMe) return false;
      if (l.companyId && tenant?.id && !isTenantMatch(l.companyId, tenant.id)) return false;

      const lStatus = (l.status || '').toLowerCase();
      // An 'Interested' lead is in initial review in "My Leads" — it must NOT show in Follow-up
      if (lStatus === 'interested') return false;

      // Contacts in KYC, Opportunities, Converted, etc. must NEVER be synthesized into Follow-up
      const cleanPhone = (l.phone || '').replace(/\D/g, '').slice(-10);
      const lName = (l.name || '').trim().toLowerCase();
      const lId = String(l.id);
      if (advancedContactIds.has(lId) || (cleanPhone && advancedContactPhones.has(cleanPhone)) || (lName && advancedContactNames.has(lName))) {
        return false;
      }
      if (lStatus === 'qualified' || lStatus === 'converted' || lStatus === 'not interested' || lStatus === 'junk') {
        return false;
      }

      const isInFollowupStage =
        l.status === 'Follow-up Required' ||
        l.status === 'Callback';
      if (!isInFollowupStage) return false;

      if (existingFollowupContactIds.has(String(l.id))) return false;
      if (cleanPhone && existingFollowupPhones.has(cleanPhone)) return false;

      return true;
    });

    for (const ml of missingFollowupLeads) {
      const salesAgentName =
        (ml.assignedByName && ml.assignedByName !== 'Created by IRM' ? ml.assignedByName : null) ||
        ml.customFields?.qualifiedByAgentName ||
        ml.customFields?.agentName ||
        '';

      scopedFollowups.push({
        id: `lead-flw-${ml.id}`,
        companyId: tenant?.id || 't-ghl-01',
        contactId: String(ml.id),
        contactType: 'lead',
        contactName: ml.name,
        contactPhone: ml.phone,
        contactEmail: ml.email || '',
        scheduledAt: ml.nextFollowupDate || new Date(Date.now() + 86400000).toISOString(),
        priority: (ml.priority === 'Urgent' ? 'High' : (ml.priority || 'High')) as 'Low' | 'Medium' | 'High',
        status: 'Pending',
        notes: ml.notes || 'Scheduled follow-up callback',
        assignedAgentId: String(user?.id || ''),
        assignedAgentName: salesAgentName || user?.name || ml.assignedAgentName || '',
        assignedRole: salesAgentName ? 'Sales Executive' : 'IRM',
      });
    }
  } else {
    scopedFollowups = followups;
  }

  // Deduplicate follow-up tasks by contact so each contact has at most ONE active follow-up task card.
  // If multiple records exist for the same contact (e.g. from repeated calls or fallback synthesis),
  // pick the most actionable/recent one and merge any distinct notes so no contact is duplicated.
  let result: Followup[] = [];
  try {
    const contactMap = new Map<string, Followup>();

    for (const f of scopedFollowups) {
      const cleanContactId = (f.contactId || '').replace(/^lead-flw-/, '').trim();
      const phoneDigits = (f.contactPhone || '').replace(/\D/g, '').slice(-10);

      const contactKey = (cleanContactId && cleanContactId !== 'contact-new')
        ? `id:${cleanContactId}`
        : phoneDigits
          ? `phone:${phoneDigits}`
          : (f.contactName ? `name:${f.contactName.trim().toLowerCase()}` : `item:${f.id}`);

      if (contactMap.has(contactKey)) {
        const existing = contactMap.get(contactKey)!;

        // If one is Pending and the other is not, always keep the Pending one
        if (existing.status !== 'Pending' && f.status === 'Pending') {
          contactMap.set(contactKey, { ...f });
          continue;
        }
        if (existing.status === 'Pending' && f.status !== 'Pending') {
          continue;
        }

        // Both same status: prefer real database record over synthesized lead task ('lead-flw-')
        const existingIsSynthetic = String(existing.id).startsWith('lead-flw-');
        const currentIsSynthetic = String(f.id).startsWith('lead-flw-');

        let winner = existing;
        let secondary = f;

        if (existingIsSynthetic && !currentIsSynthetic) {
          winner = f;
          secondary = existing;
        } else if (!existingIsSynthetic && !currentIsSynthetic) {
          // Both are real records: keep the one with the latest scheduled date or newest ID
          const existingTime = Date.parse(existing.scheduledAt) || 0;
          const currentTime = Date.parse(f.scheduledAt) || 0;
          if (currentTime >= existingTime) {
            winner = f;
            secondary = existing;
          }
        }

        // Merge notes if secondary has distinct information not in winner
        const wNotes = (winner.notes || '').trim();
        const sNotes = (secondary.notes || '').trim();
        if (sNotes && !wNotes.includes(sNotes)) {
          winner = { ...winner, notes: wNotes ? `${wNotes} | ${sNotes}` : sNotes };
        }

        contactMap.set(contactKey, winner);
      } else {
        contactMap.set(contactKey, { ...f });
      }
    }

    result = Array.from(contactMap.values());
  } catch (err) {
    console.error('Error deduping followups list by contact:', err);
    result = scopedFollowups;
  }

  // ── GHL cross-reference safety filter ─────────────────────────────────────
  if (isGhlSalesExec || isGhlAdmin) {
    try {
      const niJunkLeadIds = new Set<string>(
        allLeads
          .filter((l: Lead) => l.status === 'Not Interested' || l.status === 'Junk' || l.status === 'Other')
          .map((l: Lead) => l.id)
      );
      const niJunkPhones = new Set<string>(
        allLeads
          .filter((l: Lead) => l.status === 'Not Interested' || l.status === 'Junk' || l.status === 'Other')
          .map((l: Lead) => (l.phone || '').replace(/\D/g, '').slice(-10))
          .filter(Boolean)
      );

      result = result.filter(f => {
        if (f.status !== 'Pending') return true;
        if (f.contactId && f.contactId !== 'contact-new' && niJunkLeadIds.has(f.contactId))
          return false;
        const fPhone = (f.contactPhone || '').replace(/\D/g, '').slice(-10);
        if (fPhone && niJunkPhones.has(fPhone)) return false;
        return true;
      });
    } catch (err) {
      console.error('Error in GHL NI/Junk cross-reference filter:', err);
    }
  }

  // ── Other status leads leave the Follow-ups page (transferred to Other module) ───
  try {
    const otherLeadIds = new Set<string>(
      allLeads
        .filter((l: Lead) => l.status === 'Other')
        .map((l: Lead) => String(l.id))
    );
    const otherPhones = new Set<string>(
      allLeads
        .filter((l: Lead) => l.status === 'Other')
        .map((l: Lead) => (l.phone || '').replace(/\D/g, '').slice(-10))
        .filter(Boolean)
    );

    result = result.filter(f => {
      if (f.contactId && f.contactId !== 'contact-new' && otherLeadIds.has(String(f.contactId)))
        return false;
      const fPhone = (f.contactPhone || '').replace(/\D/g, '').slice(-10);
      if (fPhone && otherPhones.has(fPhone)) return false;
      return true;
    });
  } catch (err) {
    console.error('Error in Other-lead followup filter:', err);
  }

  // ── Interested leads leave the sales Follow-ups page ───────────────────────
  // Once a lead is 'Interested' it is tracked in Customer 360, so any still-pending SALES follow-up
  // for it is hidden. IRM follow-ups are kept: IRMs work Interested leads.
  if (!isIrm) {
    try {
      const interestedLeads = allLeads.filter((l: Lead) => l.status === 'Interested');
      const interestedLeadIds = new Set<string>(interestedLeads.map((l: Lead) => String(l.id)));
      const interestedPhones = new Set<string>(
        interestedLeads
          .map((l: Lead) => (l.phone || '').replace(/\D/g, '').slice(-10))
          .filter(Boolean)
      );

      result = result.filter(f => {
        if (f.status !== 'Pending') return true;
        if (f.contactType && f.contactType !== 'lead') return true;
        if (getFollowupRole(f) === 'IRM') return true;
        if (f.contactId && f.contactId !== 'contact-new' && interestedLeadIds.has(String(f.contactId)))
          return false;
        const fPhone = (f.contactPhone || '').replace(/\D/g, '').slice(-10);
        if (fPhone && interestedPhones.has(fPhone)) return false;
        return true;
      });
    } catch (err) {
      console.error('Error in Interested-lead followup filter:', err);
    }
  }

  return result;
}, [
  isAdmin,
  isExec,
  isIrm,
  isGhlSalesExec,
  isGhlAdmin,
  followups,
  allLeads,
  selectedRole,
  selectedPerson,
  isFollowupInDateFilter,
  tenant?.id,
  user?.id,
  user?.name,
  irmSummaryData,
  getFollowupRole,
]);

const completedFollowups = useMemo(
  () => processedFollowups.filter(f => f.status === 'Completed'),
  [processedFollowups]
);

const dueTodayFollowups = useMemo(
  () => processedFollowups.filter(f => f.status === 'Pending' && isFollowupToday(f)),
  [processedFollowups]
);

const overdueFollowups = useMemo(
  () => processedFollowups.filter(f => f.status === 'Pending' && isFollowupOverdue(f) && !isFollowupToday(f)),
  [processedFollowups]
);

const getCallCountForFollowup = (f: Followup): number => {
  return callsList.filter((c: CallRecord) => {
    if (f.leadId && c.leadId && String(c.leadId) === String(f.leadId)) return true;
    if (f.customerId && c.customerId && String(c.customerId) === String(f.customerId)) return true;
    if (f.contactId && f.contactId !== 'contact-new' && (String(c.leadId) === String(f.contactId) || (c as any).contactId === String(f.contactId))) return true;

    const fPhoneDigits = (f.contactPhone || '').replace(/\D/g, '').slice(-10);
    const cPhoneDigits = (c.contactPhone || '').replace(/\D/g, '').slice(-10);
    if (fPhoneDigits && cPhoneDigits && fPhoneDigits === cPhoneDigits && !f.leadId && !f.customerId && fPhoneDigits !== '1234567890') {
      return true;
    }
    return false;
  }).length;
};

  const handoverOptions = useMemo(() => {
    const coveringNames = Array.from(new Set(processedFollowups.map(f => f.handedOverFromName).filter((n): n is string => Boolean(n))));
    const returnedFollowups = processedFollowups.filter(f => isFollowupReturned(f));
    const returnedNames = Array.from(new Set(returnedFollowups.map(f => getFollowupReturnedCoveringName(f)).filter(Boolean)));

    if (coveringNames.length === 0 && returnedNames.length === 0) return [];

    return [
      { value: 'All', label: 'All Follow-ups' },
      { value: 'Mine', label: 'Mine (Regular)' },
      ...coveringNames.map(name => ({ value: `Handover_${name}`, label: `Covering for ${name}` })),
      ...(returnedNames.length > 0 ? [{ value: 'Returned', label: 'Returned from Handover' }] : []),
      ...returnedNames.map(name => ({ value: `Returned_${name}`, label: `Returned from ${name}` }))
    ];
  }, [processedFollowups]);

  const activePendingFollowups = processedFollowups.filter(f => {
    if (f.status !== 'Pending') return false;
    if (handoverOptions.length > 0) {
      if (handoverFilter === 'Mine' && (f.handoverId || isFollowupReturned(f))) return false;
      if (handoverFilter === 'Returned') {
        if (!isFollowupReturned(f)) return false;
      } else if (handoverFilter.startsWith('Returned_')) {
        const name = handoverFilter.replace('Returned_', '');
        if (!isFollowupReturned(f) || getFollowupReturnedCoveringName(f) !== name) return false;
      } else if (handoverFilter.startsWith('Handover_')) {
        const name = handoverFilter.replace('Handover_', '');
        if (f.handedOverFromName !== name) return false;
      }
    }
    return true;
  });

  // Base list for current role/date-filtering
  const dateScopedFollowups = useMemo(() => {
    if (!isIrm) return activePendingFollowups;
    return activePendingFollowups.filter(isFollowupInIrmDateRange);
  }, [isIrm, activePendingFollowups, isFollowupInIrmDateRange]);

  const filteredFollowups = dateScopedFollowups.filter(f => {
    if (!isIrm) {
      if (activeTab === 'due') {
        return isFollowupToday(f);
      }
      if (activeTab === 'overdue') {
        return isFollowupOverdue(f) && !isFollowupToday(f);
      }
    }
    return true;
  });

  const drawerFollowupRole = drawerFollowup ? getFollowupRole(drawerFollowup) : '';

  return (
    <div className="followups-page-container">
      {/* Header */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 className="page-title">
            <CalendarCheck size={24} color="var(--primary-600)" /> Follow-ups & Reminders
          </h1>
          <p className="page-subtitle">
            Keep commitments, maintain pipeline velocity, and log outcomes seamlessly.
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={handleOpenCreateModal}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          <Plus size={16} /> Schedule Follow-up
        </button>
      </div>

      {loadError && (
        <div
          className="alert-banner error"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            marginBottom: '16px',
            borderRadius: '8px',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#ef4444',
          }}
        >
          <span>{loadError}</span>
        </div>
      )}

      {/* ── Admin Global Filter Bar ─────────────────────────────────────────── */}
      {isAdmin && (
        <div className="admin-followup-filterbar">
          <div className="admin-followup-filter-group">
{/* 1. Role Filter (Hidden for Jamin because all Jamin agents are Sales Executives) */}
            {!isJamin && (
              <div className="followup-filter-item">
                <span className="followup-filter-label">
                  <Briefcase size={14} color="var(--primary-600)" />
                  Role:
                </span>
                <select
                  className="followup-filter-select"
                  value={selectedRole}
                  onChange={e => handleRoleChange(e.target.value as FollowupRoleFilter)}
                >
                  <option value="all">All Roles</option>
                  <option value="sales_executive">Sales Executive</option>
                  <option value="irm">IRM (Investor Relations)</option>
                </select>
              </div>
            )}

            {/* 2. Person Filter (Dynamic based on Role) */}
            <div className="followup-filter-item">
              <label htmlFor="admin-followup-person" className="followup-filter-label">
                <User size={14} color="var(--text-muted)" />
{isJamin ? 'Sales Executive:' : 'Person:'}
              </label>
              <select
                id="admin-followup-person"
                name="personFilter"
                className="followup-filter-select"
                value={selectedPerson}
                onChange={e => setSelectedPerson(e.target.value)}
              >
                <option value="All">
                  {isJamin
                    ? 'All Sales Executives'
                    : selectedRole === 'all'
                      ? 'All Agents'
                      : selectedRole === 'sales_executive'
                        ? 'All Sales Executives'
                        : 'All IRMs'}
                </option>
                {(personOptions || []).map((p: any) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            {/* 3. Date Range Filter */}
            <div className="followup-filter-item">
              <label htmlFor="admin-followup-date-range" className="followup-filter-label">
                <Calendar size={14} color="var(--text-muted)" />
                Date Range:
              </label>
              <select
                id="admin-followup-date-range"
                name="dateRangePreset"
                className="followup-filter-select"
                value={dateRangePreset}
                onChange={e => setDateRangePreset(e.target.value as DateRangePreset)}
              >
<option value="all">All Time</option>
                <option value="today">Today</option>
                <option value="this_week">This Week</option>
                <option value="this_month">This Month</option>
                <option value="custom">Custom Date Range</option>
              </select>
            </div>

            {/* Inline Custom Date Inputs */}
            {dateRangePreset === 'custom' && (
              <div className="followup-date-custom-inputs">
                <input
                  id="admin-followup-start-date"
                  name="customStartDate"
                  aria-label="Start Date"
                  type="date"
                  className="followup-date-input"
                  value={customStartDate}
                  onChange={e => setCustomStartDate(e.target.value)}
                  title="Start Date"
                />
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>to</span>
                <input
                  id="admin-followup-end-date"
                  name="customEndDate"
                  aria-label="End Date"
                  type="date"
                  className="followup-date-input"
                  value={customEndDate}
                  onChange={e => setCustomEndDate(e.target.value)}
                  title="End Date"
                />
              </div>
            )}
          </div>

          {/* Right Section: Role Mode Tag & Total Count */}
          <div className="admin-followup-meta-group">
            <span
className={`followup-role-tag ${!isJamin && selectedRole === 'irm' ? 'tag-irm' : 'tag-sales-exec'
                }`}
            >
              {!isJamin && selectedRole === 'irm' ? (
                <>
                  <Sparkles size={13} /> IRM Investor Follow-ups
                </>
              ) : (
                <>
                  <Briefcase size={13} /> Sales Executive Follow-ups
                </>
              )}
            </span>

            <span className="followup-total-badge">
              Total Tasks: <strong>{activePendingFollowups.length}</strong>
            </span>
          </div>
        </div>
      )}

{/* ── IRM Date Range Filter Bar (Only for IRM) - Red and Black Theme ── */}
      {isIrm && (
        <div className="irm-followup-filterbar">
          <div className="irm-followup-filter-left">
            <div className="irm-followup-filter-title">
              <CalendarRange size={16} color="#ef4444" />
              <span>Filter by Date:</span>
            </div>

            {/* Quick Presets */}
            <div className="irm-followup-presets">
              <button
                type="button"
                className={`irm-preset-chip ${irmDatePreset === 'all' && !irmStartDate && !irmEndDate ? 'active' : ''}`}
                onClick={() => handleApplyIrmPreset('all')}
              >
                All
              </button>
              <button
                type="button"
                className={`irm-preset-chip ${irmDatePreset === 'today' ? 'active' : ''}`}
                onClick={() => handleApplyIrmPreset('today')}
              >
                Today
              </button>
              <button
                type="button"
                className={`irm-preset-chip ${irmDatePreset === 'tomorrow' ? 'active' : ''}`}
                onClick={() => handleApplyIrmPreset('tomorrow')}
              >
                Tomorrow
              </button>
              <button
                type="button"
                className={`irm-preset-chip ${irmDatePreset === 'this_week' ? 'active' : ''}`}
                onClick={() => handleApplyIrmPreset('this_week')}
              >
                This Week
              </button>
              <button
                type="button"
                className={`irm-preset-chip ${irmDatePreset === 'this_month' ? 'active' : ''}`}
                onClick={() => handleApplyIrmPreset('this_month')}
              >
                This Month
              </button>
              <button
                type="button"
                className={`irm-preset-chip ${irmDatePreset === 'overdue' ? 'active' : ''} ${activePendingFollowups.some(f => isFollowupOverdue(f) && !isFollowupToday(f)) ? 'has-overdue' : ''}`}
                onClick={() => handleApplyIrmPreset('overdue')}
              >
                {activePendingFollowups.some(f => isFollowupOverdue(f) && !isFollowupToday(f)) && (
                  <AlertTriangle size={11} color={irmDatePreset === 'overdue' ? '#ffffff' : '#ef4444'} style={{ marginRight: 3, verticalAlign: 'middle' }} />
                )}
                Overdue ({activePendingFollowups.filter(f => isFollowupOverdue(f) && !isFollowupToday(f)).length})
              </button>
            </div>

            {/* From & To Date Pickers */}
            <div className="irm-date-range-box">
              <div className="irm-date-field">
                <label htmlFor="irm-followup-from-date" className="irm-date-label">From:</label>
                <input
                  id="irm-followup-from-date"
                  type="date"
                  className="irm-date-input"
                  value={irmStartDate}
                  onChange={e => handleIrmDateChange('start', e.target.value)}
                  title="Filter from date"
                />
              </div>

              <span className="irm-date-sep">to</span>

              <div className="irm-date-field">
                <label htmlFor="irm-followup-to-date" className="irm-date-label">To:</label>
                <input
                  id="irm-followup-to-date"
                  type="date"
                  className="irm-date-input"
                  value={irmEndDate}
                  onChange={e => handleIrmDateChange('end', e.target.value)}
                  title="Filter to date"
                />
              </div>

              {(irmStartDate || irmEndDate || irmDatePreset !== 'all') && (
                <button
                  type="button"
                  onClick={handleClearIrmDateFilter}
                  className="irm-filter-clear-btn"
                  title="Reset date filter"
                >
                  <X size={12} /> Clear
                </button>
              )}
            </div>
          </div>

          <div className="irm-followup-filter-right">
            {(irmStartDate || irmEndDate) && (
              <span className="irm-active-range-pill">
                <Calendar size={11} /> {irmStartDate || 'Start'} &rarr; {irmEndDate || 'End'}
              </span>
            )}
            <span className="irm-filter-count-badge">
              Tasks: <strong>{filteredFollowups.length}</strong> of {activePendingFollowups.length}
            </span>

            {handoverOptions.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>View:</span>
                <select
                  className="form-select customers-filter-select"
                  style={{ width: 'auto', padding: '3px 26px 3px 8px', fontSize: 12, height: 32 }}
                  value={handoverFilter}
                  onChange={e => setHandoverFilter(e.target.value)}
                >
                  {handoverOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tabs */}
      {!isIrm && (
        <div className="followups-tabs-container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {[
              { id: 'all', label: `All Tasks (${processedFollowups.length})` },
              {
                id: 'due',
                label: `Due Today (${dueTodayFollowups.length})`,
              },
              {
                id: 'overdue',
                label: `Overdue (${overdueFollowups.length})`,
                danger: true,
              },
              {
                id: 'completed',
                label: `Completed (${completedFollowups.length})`,
                success: true,
              },
            ].map(tab => (
              <button
                key={tab.id}
                className={`btn btn-sm ${activeTab === tab.id
                  ? tab.danger
                    ? 'btn-danger followups-tab-danger-active'
                    : tab.success
                      ? 'btn-success followups-tab-success-active'
                      : 'btn-primary'
                  : 'btn-secondary'
                  } ${tab.danger && activeTab !== tab.id
                    ? 'followups-tab-danger-inactive'
                    : tab.success && activeTab !== tab.id
                      ? 'followups-tab-success-inactive'
                      : ''
                  }`}
                onClick={() => setActiveTab(tab.id as any)}
              >
                {tab.danger && (
                  <AlertTriangle size={13} color={activeTab === tab.id ? '#ffffff' : '#dc2626'} />
                )}
                {tab.success && (
                  <CheckCircle size={13} color={activeTab === tab.id ? '#ffffff' : '#16a34a'} />
                )}
                {tab.label}
              </button>
            ))}
          </div>

          {handoverOptions.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>View:</span>
              <select
                className="form-select customers-filter-select"
                style={{ width: 'auto', padding: '4px 28px 4px 10px', fontSize: 13 }}
                value={handoverFilter}
                onChange={e => setHandoverFilter(e.target.value)}
              >
                {handoverOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      {/* Follow-ups List Cards */}
      <div className="followups-list">
        {isLoading ? (
          <div className="card text-center followups-empty-card" role="status">Loading follow-ups...</div>
        ) : loadError ? (
          <div className="card text-center followups-empty-card" role="alert">
            {loadError}
          </div>
        ) : filteredFollowups.length === 0 ? (
          <div className="card text-center followups-empty-card">
            No tasks in this category. You're all caught up!
          </div>
        ) : (
          filteredFollowups.map(f => {
const schedStr = (f.scheduledAt || '').trim();
            const dateStr = (f.scheduledDate || '').trim();
            const now = new Date();

            const isOverdueFunc = () => {
              const parsedTime = Date.parse(schedStr) || (dateStr ? Date.parse(dateStr) : NaN);
              if (isNaN(parsedTime)) return schedStr.toLowerCase().includes('yesterday');
              return parsedTime < new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
            };

            const isTodayFunc = () => {
              const parsedTime = Date.parse(schedStr) || (dateStr ? Date.parse(dateStr) : NaN);
              if (isNaN(parsedTime)) return schedStr.toLowerCase().includes('today');
              const d = new Date(parsedTime);
              return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
            };

            const isOverdue = f.status === 'Pending' && isOverdueFunc() && !isTodayFunc();
            const callCount = getCallCountForFollowup(f);
            const fRole = getFollowupRole(f);

            return (
              <div
                key={f.id}
                className={`card card-hover followup-item-card ${f.status === 'Completed' ? 'completed' : isOverdue ? 'overdue' : ''}`}
                onClick={canOpenDrawer ? () => setDrawerFollowup(f) : undefined}
                style={canOpenDrawer ? { cursor: 'pointer' } : undefined}
              >
                {f.handedOverFromName ? (
                  <div style={{
                    fontSize: 10,
                    fontWeight: 600,
                    padding: '2px 6px',
                    borderRadius: 4,
                    background: 'rgba(99, 102, 241, 0.15)',
                    color: '#818cf8',
                    border: '1px solid rgba(99, 102, 241, 0.3)',
                    position: 'absolute',
                    top: 12,
                    right: 12
                  }} title={`Handed over from ${f.handedOverFromName}`}>
                    Covering for {f.handedOverFromName}
                  </div>
                ) : isFollowupReturned(f) ? (
                  <div style={{
                    fontSize: 10,
                    fontWeight: 600,
                    padding: '2px 7px',
                    borderRadius: 4,
                    background: 'rgba(16, 185, 129, 0.15)',
                    color: '#34d399',
                    border: '1px solid rgba(16, 185, 129, 0.35)',
                    position: 'absolute',
                    top: 12,
                    right: 12,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 3,
                  }} title={`Returned from coverage by ${getFollowupReturnedCoveringName(f)}${getFollowupReturnedDate(f) ? ` on ${new Date(getFollowupReturnedDate(f)!).toLocaleDateString()}` : ''}`}>
                    ↩ Returned from {getFollowupReturnedCoveringName(f)}
                  </div>
                ) : null}
                <div className="followup-item-left">
                  <button
                    className={`btn btn-icon btn-ghost followup-check-btn ${f.status === 'Completed' ? 'completed' : ''}`}
                    title={f.status === 'Completed' ? 'Completed (Click to Reopen)' : 'Click to complete follow-up'}
                    onClick={e => {
                      e.stopPropagation();
                      if (f.status === 'Completed') {
                        handleReopenFollowup(f);
                      } else {
                        setCompleteItem(f);
                        setCompletionNotes('');
                      }
                    }}
                  >
                    {f.status === 'Completed' ? (
                      <CheckCircle size={18} color="#16a34a" />
                    ) : (
                      <div className="followup-check-empty" />
                    )}
                  </button>

                  <div>
                    <div
                      className="followup-contact-header"
                      style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}
                    >
                      <span
                        className={`followup-contact-name ${f.status === 'Completed' ? 'completed' : ''}`}
                        style={canOpenDrawer ? { color: 'var(--primary-600)', fontWeight: 700 } : undefined}
                      >
                        {f.contactName}
                      </span>

{f.status === 'Completed' ? (
                        <span className="badge-completed-pill">
                          <CheckCircle size={11} /> Completed
                        </span>
                      ) : f.status === 'Rescheduled' ? (
                        <span className="badge-completed-pill" style={{ color: '#7c3aed', background: '#f3e8ff' }}>
                          Rescheduled
                        </span>
                      ) : (
                        <StatusChip status={f.priority} size="sm" />
                      )}
{f.handedOverFromName && (
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 600,
                            padding: '2px 6px',
                            borderRadius: 6,
                            background: 'rgba(99, 102, 241, 0.15)',
                            color: '#818cf8',
                            border: '1px solid rgba(99, 102, 241, 0.3)',
                          }}
                          title={`Handed over from ${f.handedOverFromName}`}
                        >
                          Covering for {f.handedOverFromName}
                        </span>
                      )}

                      {!f.handedOverFromName && isFollowupReturned(f) && (
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 600,
                            padding: '2px 7px',
                            borderRadius: 6,
                            background: 'rgba(16, 185, 129, 0.15)',
                            color: '#34d399',
                            border: '1px solid rgba(16, 185, 129, 0.35)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 3,
                          }}
                          title={`Returned from coverage by ${getFollowupReturnedCoveringName(f)}${getFollowupReturnedDate(f) ? ` on ${new Date(getFollowupReturnedDate(f)!).toLocaleDateString()}` : ''}`}
                        >
                          ↩ Returned from {getFollowupReturnedCoveringName(f)}
                        </span>
                      )}

                      <StatusChip status={f.priority} size="sm" />

                      {callCount > 0 && (
                        <span
                          style={{
                            backgroundColor: '#f1f5f9',
                            color: '#475569',
                            fontSize: 11,
                            fontWeight: 600,
                            padding: '2px 8px',
                            borderRadius: 12,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          📞 {callCount} {callCount === 1 ? 'call' : 'calls'}
                        </span>
                      )}

                      <span className="followup-contact-phone">Phone: {f.contactPhone}</span>
                    </div>

                    <p className="followup-notes">{f.notes}</p>

                    <div className="followup-meta-row">
{f.status === 'Completed' ? (
                        <span style={{ color: '#16a34a', fontWeight: 600 }}>
                          ✓ Completed: {f.completedAt ? new Date(f.completedAt).toLocaleString() : 'Done'}
                        </span>
                      ) : (
                        <span className={`followup-schedule-time ${isOverdue ? 'overdue' : ''}`}>
                          ⏰ {f.scheduledAt}
                        </span>
                      )}
                      <span className="followup-assignee">• Assignee: {f.assignedAgentName}</span>
                      <span
                        className={`badge-role-inline ${fRole === 'IRM' ? 'badge-role-irm' : 'badge-role-sales'
                          }`}
                      >
                        {fRole}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="followup-actions-right">
{f.status === 'Completed' ? (
                    <>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={e => {
                          e.stopPropagation();
                          handleReopenFollowup(f);
                        }}
                        title="Move back to Pending tasks"
                      >
                        <RotateCcw size={12} style={{ marginRight: 4 }} /> Reopen
                      </button>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={e => {
                          e.stopPropagation();
                          handleOpenRescheduleModal(f);
                        }}
                      >
                        Reschedule
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={e => {
                          e.stopPropagation();
                          handleDeleteFollowup(f);
                        }}
                        title="Delete follow-up"
                        style={{ color: 'var(--danger-600, #dc2626)', padding: '4px 8px' }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        className="btn btn-sm btn-complete-followup"
                        onClick={e => {
                          e.stopPropagation();
                          setCompleteItem(f);
                          setCompletionNotes('');
                        }}
                        title="Mark follow-up as completed"
                      >
                        <CheckCircle size={13} /> Complete
                      </button>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={e => {
                          e.stopPropagation();
                          handleOpenRescheduleModal(f);
                        }}
                      >
                        Reschedule
                      </button>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={e => {
                          e.stopPropagation();
                          handleCancelFollowup(f);
                        }}
                        title="Cancel follow-up"
                      >
                        Cancel
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={e => {
                          e.stopPropagation();
                          handleDeleteFollowup(f);
                        }}
                        title="Delete follow-up"
                        style={{ color: 'var(--danger-600, #dc2626)', padding: '4px 8px' }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </>
                  )}
                  <button
                    className="btn btn-call btn-sm"
                    onClick={e => {
                      e.stopPropagation();
                      initiateCall(
                        f.contactName,
                        f.contactPhone,
                        f.contactType as any,
                        f.contactId,
                        f.id,
                        'follow_up'
                      );
                    }}
                  >
                    <Phone size={13} /> Call
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Reschedule Modal */}
      <Modal
        isOpen={!!rescheduleItem}
        onClose={() => setRescheduleItem(null)}
        title={`Reschedule Follow-up: ${rescheduleItem?.contactName || ''}`}
        subtitle={`Select date, time & channel for ${rescheduleItem?.contactPhone || ''}`}
      >
        <form onSubmit={handleSaveReschedule} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>




          {/* Date & Time Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">Follow-up Date *</label>
              <input
                type="date"
                className="form-input"
                required
                value={rescheduleDate}
                min={new Date().toISOString().split('T')[0]}
                onChange={e => setRescheduleDate(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Follow-up Time</label>
              <input
                type="time"
                className="form-input"
                value={rescheduleTime}
                onChange={e => setRescheduleTime(e.target.value)}
              />
            </div>
          </div>

          {/* Activity Type */}
          <div className="form-group">
            <label className="form-label">Activity Type</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {[
                { id: 'call', label: 'Phone Call' },
                { id: 'whatsapp', label: 'WhatsApp' },
                { id: 'meeting', label: 'Meeting' },
              ].map(t => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setRescheduleType(t.id as any)}
                  style={{
                    padding: '8px 4px',
                    fontSize: '12px',
                    borderRadius: '6px',
                    border: rescheduleType === t.id ? '2px solid #dc2626' : '1px solid var(--border-base)',
                    background: rescheduleType === t.id ? '#fef2f2' : 'var(--bg-card)',
                    color: rescheduleType === t.id ? '#dc2626' : 'var(--text-primary)',
                    fontWeight: rescheduleType === t.id ? 600 : 400,
                    cursor: 'pointer',
                    textAlign: 'center',
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Assigned team member */}
          {isAdmin && <div className="form-group">
            <label className="form-label">Assigned Team Member</label>
            <select
              className="form-select"
              value={rescheduleAgentId}
              onChange={e => setRescheduleAgentId(e.target.value)}
            >
              {(assignableAgentOptions || []).map((p: any) => (
                <option key={p.id} value={p.id}>
                  {p.name} {isJamin ? '(Sales Executive)' : `(${p.roleCode === 'irm' ? 'IRM' : 'Sales Executive'})`} {p.email ? `(${p.email})` : ''}
                </option>
              ))}
            </select>
          </div>}

          {/* Notes */}
          <div className="form-group">
            <label className="form-label">Follow-up Notes</label>
            <textarea
              className="form-textarea"
              rows={2}
              value={rescheduleNotes}
              onChange={e => setRescheduleNotes(e.target.value)}
              placeholder="e.g. Call client regarding plot availability..."
            />
          </div>

          {/* Modal Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setRescheduleItem(null)}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              style={{
                background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
                borderColor: '#dc2626',
                color: '#ffffff',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Calendar size={14} /> Confirm Reschedule
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Schedule New Follow-up Modal ── */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Schedule Prospective Follow-up"
        subtitle="Set task date, time, channel & assigned executive"
      >
<form onSubmit={handleSaveCreateFollowup} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Contact Source Type Toggle */}
          <div className="form-group">
            <label className="form-label" style={{ fontWeight: 600, marginBottom: 8, display: 'block' }}>Contact Source</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {[
                { key: 'lead' as const, label: 'Lead' },
                { key: 'customer' as const, label: 'Customer' },
                { key: 'new' as const, label: 'New Contact' },
              ].map(opt => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => handleContactTypeChange(opt.key)}
                  style={{
                    padding: '8px 10px',
                    fontSize: '12px',
                    fontWeight: 600,
                    borderRadius: 6,
                    border: '1px solid',
                    borderColor: createContactType === opt.key ? 'var(--primary-600)' : 'var(--border-base)',
                    backgroundColor: createContactType === opt.key ? 'var(--primary-50, rgba(239, 68, 68, 0.08))' : 'var(--bg-surface)',
                    color: createContactType === opt.key ? 'var(--primary-600)' : 'var(--text-secondary)',
                    cursor: 'pointer',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Contact Picker based on type */}
          {createContactType === 'lead' && (
            <div className="form-group">
              <label className="form-label">Select Lead *</label>
              <select
                className="form-input"
                required
                value={createSelectedLeadId}
                onChange={e => handleLeadSelect(e.target.value)}
              >
                <option value="">-- Choose a lead --</option>
                {allLeads.map(l => (
                  <option key={l.id} value={l.id}>
                    {l.name} ({l.phone})
                  </option>
                ))}
              </select>
            </div>
          )}

          {createContactType === 'customer' && (
            <div className="form-group">
              <label className="form-label">Select Customer *</label>
              <select
                className="form-input"
                required
                value={createSelectedCustomerId}
                onChange={e => handleCustomerSelect(e.target.value)}
              >
                <option value="">-- Choose a customer --</option>
                {allCustomers.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.phone})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Name & Phone */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">Contact Name *</label>
              <input
                type="text"
                className="form-input"
                required
                placeholder="Full name"
                value={createContactName}
                onChange={e => setCreateContactName(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Phone Number *</label>
              <input
                type="text"
                className="form-input"
                required
                placeholder="+91 "
                value={createContactPhone}
                onChange={e => setCreateContactPhone(e.target.value)}
              />
            </div>
          </div>

          {/* Date & Time Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">Follow-up Date *</label>
              <input
                type="date"
                className="form-input"
                required
                value={createDate}
                min={new Date().toISOString().split('T')[0]}
                onChange={e => setCreateDate(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Follow-up Time</label>
              <input
                type="time"
                className="form-input"
                value={createTime}
                onChange={e => setCreateTime(e.target.value)}
              />
            </div>
          </div>

          {/* Follow-up Channel */}
          <div className="form-group">
            <label className="form-label">Channel</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {[
                { type: 'call' as const, label: '📞 Phone Call' },
                { type: 'whatsapp' as const, label: '💬 WhatsApp' },
                { type: 'meeting' as const, label: '🤝 Meeting' },
              ].map(opt => (
                <button
                  key={opt.type}
                  type="button"
                  onClick={() => setCreateType(opt.type)}
                  style={{
                    padding: '8px 10px',
                    fontSize: '12px',
                    fontWeight: 600,
                    borderRadius: 6,
                    border: '1px solid',
                    borderColor: createType === opt.type ? 'var(--primary-600)' : 'var(--border-base)',
                    backgroundColor: createType === opt.type ? 'var(--primary-50, rgba(239, 68, 68, 0.08))' : 'var(--bg-surface)',
                    color: createType === opt.type ? 'var(--primary-600)' : 'var(--text-secondary)',
                    cursor: 'pointer',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Priority & Assigned Agent */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">Priority</label>
              <select
                className="form-input"
                value={createPriority}
                onChange={e => setCreatePriority(e.target.value as any)}
              >
                <option value="High">🔴 High Priority</option>
                <option value="Medium">🟡 Medium</option>
                <option value="Low">🟢 Low</option>
              </select>
            </div>
            {isAdmin && <div className="form-group">
              <label className="form-label">Assigned Team Member</label>
              <select
                className="form-input"
                value={createAgentId}
                onChange={e => setCreateAgentId(e.target.value)}
              >
                {assignableAgents.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.name} {isJamin ? '(Sales Executive)' : `(${a.roleCode === 'irm' ? 'IRM' : 'Sales Executive'})`}
                  </option>
                ))}
              </select>
            </div>}
          </div>

          {/* Notes / Agenda */}
          <div className="form-group">
            <label className="form-label">Notes / Agenda</label>
            <textarea
              className="form-textarea"
              rows={3}
              placeholder="Discussion points, follow-up purpose, or key requests..."
              value={createNotes}
              onChange={e => setCreateNotes(e.target.value)}
            />
          </div>

          {/* Form Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsCreateModalOpen(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmittingCreate}
              style={{
                background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
                borderColor: '#dc2626',
                color: '#ffffff',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Calendar size={14} /> {isSubmittingCreate ? 'Scheduling...' : 'Schedule Follow-up'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Complete Follow-up Modal */}
      <Modal
        isOpen={!!completeItem}
        onClose={() => setCompleteItem(null)}
        title={`Complete Follow-up: ${completeItem?.contactName || ''}`}
        subtitle={`Mark commitment as accomplished for ${completeItem?.contactPhone || ''}`}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Quick Outcome Chips */}
          <div>
            <label className="form-label" style={{ marginBottom: 6 }}>Quick Outcome / Resolution</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {[
                'Connected & Discussed',
                'Requirements Noted',
                'Site Visit Scheduled',
                'Sent Details via WhatsApp',
                'Discussed & Moving Forward',
              ].map(chip => (
                <button
                  key={chip}
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setCompletionNotes(chip)}
                  style={{ fontSize: '12px', padding: '4px 10px' }}
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Outcome Notes / Remarks</label>
            <textarea
              className="form-textarea"
              rows={3}
              placeholder="Enter details on what was discussed or accomplished..."
              value={completionNotes}
              onChange={e => setCompletionNotes(e.target.value)}
              style={{ resize: 'vertical' }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setCompleteItem(null)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-success"
              style={{
                backgroundColor: '#16a34a',
                borderColor: '#16a34a',
                color: '#ffffff',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
              onClick={() => {
                if (completeItem) {
                  handleCompleteFollowup(completeItem, completionNotes.trim());
                }
              }}
            >
              <CheckCircle size={15} /> Confirm Complete
            </button>
          </div>
        </div>
      </Modal>

      {/* Contact Profile & Detailed Attribution Drawer */}
      {canOpenDrawer && (
        <Drawer
          isOpen={!!drawerFollowup}
          onClose={() => setDrawerFollowup(null)}
          title={drawerFollowup?.contactName || 'Contact Profile'}
          subtitle={
            isAdmin
? `Phone: ${drawerFollowup?.contactPhone || '—'} • Assigned to: ${drawerFollowup?.assignedAgentName || 'Unassigned'
              } (${drawerFollowupRole})`
              : drawerFollowup?.contactPhone
                ? `Phone: ${drawerFollowup.contactPhone} • ${tenant?.name || 'GHL India'}`
                : (tenant?.name || '')
          }
          width={720}
          footer={
            drawerFollowup && (
<div style={{ display: 'flex', alignItems: 'center', justifyContent: (isJamin || isExec) ? 'flex-end' : 'space-between', width: '100%', gap: 10 }}>
                {/* Ready for KYC button (Only for GHL IRM / Wealth Admins; NEVER for Jamin Real Estate) */}
                {!isJamin && !isExec && (
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{
                      backgroundColor: '#7c3aed',
                      borderColor: '#7c3aed',
                      color: '#ffffff',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      fontWeight: 600,
                      padding: '8px 16px',
                    }}
                    onClick={handleMoveToKyc}
                    title="Move customer to KYC module and mark follow-up completed"
                  >
                    <ShieldCheck size={16} /> Ready for KYC
                  </button>
                )}

                {/* Right side buttons */}
<div style={{ display: 'flex', gap: 10, marginLeft: isExec ? 'auto' : undefined }}>
                  {!(isGhlAdmin && drawerFollowupRole === 'IRM') && (
                    <button
                      className="btn btn-secondary"
                      onClick={() => {
                        setRescheduleItem(drawerFollowup);
                        setDrawerFollowup(null);
                      }}
                    >
                      Reschedule
                    </button>
                  )}
                  <button
                    className="btn btn-call"
                    onClick={() => {
                      initiateCall(
                        drawerFollowup.contactName,
                        drawerFollowup.contactPhone,
                        (drawerFollowup.contactType as any) || 'lead',
                        drawerFollowup.contactId,
                        drawerFollowup.id,
                        'follow_up'
                      );
                    }}
                  >
                    <Phone size={14} /> Call Contact
                  </button>
                </div>
              </div>
            )
          }
        >
          {drawerFollowup && (() => {
const leads = (allLeads && allLeads.length > 0) ? allLeads : (storageService.getLeads(tenant?.id) || []);
            const customers = storageService.getCustomers(tenant?.id) || [];
            const fDigits = (drawerFollowup.contactPhone || '').replace(/\D/g, '').slice(-10);

            const matchingLead = leads.find(l => {
              if (drawerFollowup.contactId && drawerFollowup.contactId !== 'contact-new' && String(l.id) === String(drawerFollowup.contactId)) return true;
              const lDigits = (l.phone || '').replace(/\D/g, '').slice(-10);
              if (lDigits && fDigits && lDigits === fDigits) return true;
              if (l.name && drawerFollowup.contactName && l.name.trim().toLowerCase() === drawerFollowup.contactName.trim().toLowerCase()) return true;
              return false;
            }) || null;

            const matchingCustomer = customers.find(c => {
              if (drawerFollowup.contactId && c.id === drawerFollowup.contactId) return true;
              const cDigits = (c.phone || '').replace(/\D/g, '').slice(-10);
              if (cDigits && fDigits && cDigits === fDigits) return true;
              if (c.name && drawerFollowup.contactName && c.name.trim().toLowerCase() === drawerFollowup.contactName.trim().toLowerCase()) return true;
              return false;
            }) || null;

            const drawerAgentInfo = drawerFollowup ? getFollowupDisplayAgent(drawerFollowup) : null;
            const assignedAgent =
              drawerAgentInfo?.name ||
              drawerFollowup.assignedAgentName ||
              matchingLead?.assignedAgentName ||
              matchingCustomer?.assignedAgentName ||
              'Unassigned';
            const assignedAgentRole = drawerAgentInfo?.role || drawerFollowupRole;

            const contactEmail = (drawerFollowup as any).contactEmail || (drawerFollowup as any).email || matchingLead?.email || matchingCustomer?.email || '—';
            const contactLocation = matchingLead?.location || matchingCustomer?.location || (drawerFollowup as any).location || '—';
            const contactSource = matchingLead?.source || (drawerFollowup as any).source || 'Follow-up Task';

            const investmentCapacity =
              matchingLead?.customFields?.investmentCapacity ||
              matchingLead?.customFields?.capacityRange ||
              matchingLead?.customFields?.investmentRange ||
              (matchingLead as any)?.investmentRange ||
              matchingCustomer?.customFields?.investmentCapacity ||
              matchingCustomer?.customFields?.totalAUMCommitted ||
              (drawerFollowup as any)?.investmentCapacity ||
              null;

            // Actual inquiry submitted by the prospect/user (NOT internal follow-up audit notes)
            const rawInquiry =
              (matchingLead as any)?.message ||
              (matchingLead as any)?.userMessage ||
              matchingLead?.customFields?.message ||
              matchingLead?.customFields?.userMessage ||
              (matchingLead as any)?.anythingWeShouldKnow ||
              (matchingCustomer as any)?.message ||
              (matchingCustomer as any)?.userMessage ||
              null;

            const userMessage = rawInquiry
              ? rawInquiry
                  .split('\n')
                  .filter((l: string) => !l.includes('Follow-up completed:') && !l.startsWith('[Reassigned to'))
                  .join('\n')
                  .trim() || null
              : null;

            // Follow-up's own notes (scheduled purpose / agent remarks)
            const followupNotes = drawerFollowup.notes?.trim() || null;

            // Internal lead notes (excluding any previous audit trail lines)
            const rawLeadNotes = matchingLead?.notes || matchingCustomer?.notes || null;
            const leadNotes = rawLeadNotes
              ? rawLeadNotes
                  .split('\n')
                  .filter((l: string) => !l.includes('Follow-up completed:') && !l.startsWith('[Reassigned to'))
                  .join('\n')
                  .trim() || null
              : null;

            const isExcludedCustomField = (key: string, label?: string) => {
              const k = (key || '').toLowerCase().replace(/[^a-z]/g, '');
              const l = (label || '').toLowerCase().replace(/[^a-z]/g, '');
              return (
                k.includes('assetclass') || l.includes('assetclass') ||
                k.includes('horizon') || l.includes('horizon') ||
                k.includes('capacity') || l.includes('capacity') ||
                k.includes('investmentrange') || l.includes('investmentrange') ||
                k.includes('irmpreference') || l.includes('irmpreference')
              );
            };

            const activeDefs = storageService
              .getCustomFieldDefinitions(tenant?.id)
              .filter(d => d.active !== false && (d.module === 'leads' || !d.module))
              .filter(d => !isExcludedCustomField(d.fieldKey || d.id, d.label))
              .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
            const customFieldsObj = matchingLead?.customFields || matchingCustomer?.customFields || {};
            const customFieldRows = activeDefs
              .map(def => {
                const key = def.fieldKey || def.id;
                if (isExcludedCustomField(key, def.label)) return null;
                const val = customFieldsObj[key];
                if (val === undefined || val === null || val === '') return null;
                return { id: def.id, label: def.label || key.replace(/([A-Z])/g, ' $1'), value: String(val) };
              })
              .filter(Boolean);

            const resolvedContactId = drawerFollowup.contactId || matchingLead?.id || matchingCustomer?.id;
            const resolvedContactType = drawerFollowup.contactType || (matchingCustomer ? 'customer' : 'lead');

            return (
              <div className="followup-drawer-body">
                {/* Prominent Admin Representative Attribution Card */}
                {isAdmin && (
                  <div className="admin-detail-owner-banner">
                    <div className="admin-owner-header-row">
                      <div className="admin-owner-avatar-icon">
                        <User size={18} color="var(--primary-600)" />
                      </div>
                      <div className="admin-owner-title-block">
                        <span className="admin-owner-label">Assigned Representative Data</span>
                        <div className="admin-owner-name-row">
                          <strong className="admin-owner-person-name">
                            {assignedAgent}
                          </strong>
                          <span
                            className={`admin-owner-role-tag ${drawerFollowupRole === 'IRM' ? 'tag-irm' : 'tag-sales-exec'
                              }`}
                          >
                            <Briefcase size={12} />
                            {drawerFollowupRole === 'IRM'
                              ? 'IRM (Investor Relations)'
                              : 'Sales Executive'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="admin-owner-meta-grid">
                      <div className="admin-owner-meta-cell">
                        <span className="cell-lbl">Scheduled Slot</span>
                        <span className="cell-val">⏰ {formatSmartScheduleDate(drawerFollowup.scheduledAt)}</span>
                      </div>
                      <div className="admin-owner-meta-cell">
                        <span className="cell-lbl">Priority Level</span>
                        <span className="cell-val">{drawerFollowup.priority}</span>
                      </div>
                      <div className="admin-owner-meta-cell">
                        <span className="cell-lbl">Record Type</span>
                        <span className="cell-val">
                          {(drawerFollowup.contactType || 'LEAD').toUpperCase()}
                        </span>
                      </div>
                      <div className="admin-owner-meta-cell">
                        <span className="cell-lbl">Task Status</span>
                        <span className="cell-val">{drawerFollowup.status}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Quick Info Banner (Assigned Agent) ── */}
                {!isAdmin && (
                  <div className="lead-quick-banner">
                    <div className="lead-assigned-note" style={{ fontSize: 13, marginTop: 0 }}>
                      Assigned Agent : <strong>{assignedAgent}</strong>
                      {assignedAgentRole && (
                        <span
                          style={{
                            marginLeft: 8,
                            fontSize: 10,
                            fontWeight: 700,
                            padding: '2px 7px',
                            borderRadius: 4,
                            background: assignedAgentRole === 'IRM' ? 'rgba(124,58,237,0.1)' : 'rgba(14,165,233,0.1)',
                            color: assignedAgentRole === 'IRM' ? '#7c3aed' : '#0284c7',
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                          }}
                        >
                          {assignedAgentRole}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {isFollowupReturned(drawerFollowup, matchingLead) && (
                  <div style={{
                    margin: '10px 0',
                    padding: '10px 14px',
                    borderRadius: 8,
                    background: 'rgba(16, 185, 129, 0.12)',
                    border: '1px solid rgba(16, 185, 129, 0.35)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                  }}>
                    <span style={{ fontSize: 16 }}>↩️</span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#34d399' }}>
                        Returned from Coverage by {getFollowupReturnedCoveringName(drawerFollowup, matchingLead)}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                        This contact was covered while you were away and handed back to you{getFollowupReturnedDate(drawerFollowup, matchingLead) ? ` on ${new Date(getFollowupReturnedDate(drawerFollowup, matchingLead)!).toLocaleDateString()}` : ''}. Review recent call logs and updated notes below.
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Contact & Profile Details ── */}
                <div className="card lead-detail-card">
                  <h4 className="lead-detail-title">Contact &amp; Profile Details</h4>
                  <div className="lead-detail-grid">
                    <div>
                      <span className="lead-detail-label">Email:</span>
                      <div className="lead-detail-value">{contactEmail}</div>
                    </div>
                    <div>
                      <span className="lead-detail-label">Location:</span>
                      <div className="lead-detail-value">{contactLocation}</div>
                    </div>
                    <div>
                      <span className="lead-detail-label">Lead Source:</span>
                      <div className="lead-detail-value">{contactSource}</div>
                    </div>
                    <div>
                      <span className="lead-detail-label">Follow-up:</span>
                      <div className="lead-detail-value lead-followup-text has-date">
                        {formatSmartScheduleDate(drawerFollowup.scheduledAt) || formatSmartScheduleDate(matchingLead?.nextFollowupDate) || 'Not scheduled'}
                      </div>
                    </div>
                  </div>
                </div>

                  {/* ── Jamin: Property & Budget Requirements | GHL: Investment Details & Custom Attributes ── */}
                {isJamin ? (
                  <div className="card lead-custom-card">
                    <h4 className="lead-custom-title" style={{ margin: '0 0 12px 0' }}>Requirements &amp; Project Preferences</h4>
                    <div className="lead-detail-grid">
                      <div>
                        <span className="lead-custom-label">Target Development / Project:</span>
                        <div className="lead-custom-value" style={{ fontWeight: 600, color: 'var(--primary-600)' }}>
                          {matchingLead?.targetDevelopment || (matchingLead?.customFields as any)?.targetDevelopment || '—'}
                        </div>
                      </div>
                      <div>
                        <span className="lead-custom-label">Plot Budget Range:</span>
                        <div className="lead-custom-value" style={{ fontWeight: 700, color: '#059669' }}>
                          {matchingLead?.budgetRange || (matchingLead?.customFields as any)?.budgetRange || '—'}
                        </div>
                      </div>
                      <div>
                        <span className="lead-custom-label">Ready to Register / Timeline:</span>
                        <div className="lead-custom-value">
                          {matchingLead?.readyToRegister || (matchingLead?.customFields as any)?.readyToRegister || '—'}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* ── Investment Capacity ── */}
                <div className="card lead-custom-card">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <h4 className="lead-custom-title" style={{ margin: 0 }}>Investment Details</h4>
                    {isIrm && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm btn-icon"
                        title={isEditingCapacity ? 'Cancel edit' : 'Edit Investment Capacity'}
                        style={{ width: 28, height: 28 }}
                        onClick={() => setIsEditingCapacity(prev => !prev)}
                      >
                        <Pencil size={13} />
                      </button>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div>
                      <label htmlFor="followup-drawer-capacity" className="lead-detail-label">Investment Capacity:</label>
                      {isEditingCapacity ? (
                        <div style={{ marginTop: 6 }}>
                          <select
                            id="followup-drawer-capacity"
                            name="capacityValue"
                            className="form-select"
                            value={capacityValue}
                            onChange={e => setCapacityValue(e.target.value)}
                            style={{ width: '100%', fontSize: 13, height: 36 }}
                          >
                            <option value="">— Select —</option>
                            {capacityValue && !INVESTMENT_CAPACITY_OPTIONS.includes(capacityValue) && (
                              <option value={capacityValue}>{capacityValue}</option>
                            )}
                            {INVESTMENT_CAPACITY_OPTIONS.map(opt => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                          <div style={{ marginTop: 10, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => setIsEditingCapacity(false)}
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                              onClick={() => handleSaveCapacity(matchingLead, matchingCustomer)}
                            >
                              <CheckCircle size={14} /> Save
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div
                          className="lead-detail-value"
                          style={{
                            marginTop: 4,
                            fontSize: (capacityValue || investmentCapacity) && (capacityValue || investmentCapacity) !== '—' ? 16 : 13,
                            fontWeight: 700,
                            color: '#10b981',
                            letterSpacing: '0.01em',
                          }}
                        >
                          {(capacityValue || investmentCapacity) && (capacityValue || investmentCapacity) !== '—' ? (
                            capacityValue || investmentCapacity
                          ) : (
                            <span className="not-specified-badge">Not Specified</span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* ── Investment Amount (Separate from Capacity & Asset Class) ── */}
                    <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border-color)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <label htmlFor="followup-drawer-investment-amount" className="lead-detail-label">Investment Amount:</label>
                        {isIrm && (
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm btn-icon"
                            title={isEditingAmount ? 'Cancel edit' : 'Edit Investment Amount'}
                            style={{ width: 28, height: 28 }}
                            onClick={() => setIsEditingAmount(prev => !prev)}
                          >
                            <Pencil size={13} />
                          </button>
                        )}
                      </div>
                      {isEditingAmount ? (
                        <div style={{ marginTop: 6 }}>
                          <input
                            id="followup-drawer-investment-amount"
                            name="investmentAmount"
                            type="number"
                            className="form-input"
                            placeholder="e.g. 5000000"
                            value={investmentAmountValue}
                            onChange={e => setInvestmentAmountValue(e.target.value)}
                            style={{ width: '100%', fontSize: 13, height: 36 }}
                          />
                          <div style={{ marginTop: 10, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => setIsEditingAmount(false)}
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                              onClick={() => handleSaveInvestmentAmount(matchingLead, matchingCustomer)}
                            >
                              <CheckCircle size={14} /> Save
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div
                          className="lead-detail-value"
                          style={{
                            marginTop: 4,
                            fontSize: 16,
                            fontWeight: 700,
                            color: investmentAmountValue && parseFloat(investmentAmountValue) > 0 ? '#059669' : 'var(--text-muted)',
                            letterSpacing: '0.01em',
                          }}
                        >
                          {investmentAmountValue && parseFloat(investmentAmountValue) > 0
                            ? `₹${parseFloat(investmentAmountValue).toLocaleString('en-IN')}`
                            : '—'}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* ── GHL India Ventures Custom Attributes (with Set by IRM Checkbox) ── */}
                {!isExec && (
                  <div className="card lead-custom-card">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                      <h4 className="lead-custom-title" style={{ margin: 0 }}>
                        {tenant?.name || 'GHL India Ventures'} Custom Attributes
                      </h4>
                      <label htmlFor="followup-drawer-set-by-irm" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: isGhlAdmin ? 'default' : 'pointer', fontWeight: 600, color: 'var(--text-primary)' }}>
                        <input
                          id="followup-drawer-set-by-irm"
                          name="setByIrm"
                          type="checkbox"
                          checked={Boolean(isPrefConfirmed)}
                          disabled={isGhlAdmin}
                          onChange={e => handleTogglePrefCheckbox(e.target.checked, matchingLead, matchingCustomer)}
                          style={{ width: 16, height: 16, cursor: isGhlAdmin ? 'not-allowed' : 'pointer', accentColor: 'var(--primary-600)' }}
                        />
                        <span>Set by IRM {isGhlAdmin && '(Read-only)'}</span>
                      </label>
                    </div>

                    {!isGhlAdmin && isEditingPref ? (
                      <div>
                        <div className="lead-detail-grid" style={{ gap: 14 }}>
                          <div>
                            <label htmlFor="followup-drawer-pref-asset-class" className="lead-custom-label" style={{ display: 'block', marginBottom: 4, fontWeight: 600 }}>
                              Preferred Asset Class:
                            </label>
                            <select
                              id="followup-drawer-pref-asset-class"
                              name="preferredAssetClass"
                              className="form-select"
                              value={prefAssetClass}
                              onChange={e => setPrefAssetClass(e.target.value)}
                              style={{ width: '100%', fontSize: 13, height: 36 }}
                            >
                              <option value="">— Select Asset Class —</option>
                              <option value="CO-AIF">CO-AIF</option>
                              <option value="AIF">AIF</option>
                            </select>
                          </div>
                          <div>
                            <label htmlFor="followup-drawer-pref-horizon" className="lead-custom-label" style={{ display: 'block', marginBottom: 4, fontWeight: 600 }}>
                              Investment Horizon:
                            </label>
                            <select
                              id="followup-drawer-pref-horizon"
                              name="investmentHorizon"
                              className="form-select"
                              value={prefHorizon}
                              onChange={e => setPrefHorizon(e.target.value)}
                              style={{ width: '100%', fontSize: 13, height: 36 }}
                            >
                              <option value="">— Select Horizon —</option>
                              <option value="1-2 Years">1-2 Years</option>
                              <option value="3-5 Years">3-5 Years</option>
                              <option value="5-7 Years">5-7 Years</option>
                              <option value="7-10 Years">7-10 Years</option>
                              <option value="10+ Years">10+ Years</option>
                            </select>
                          </div>
                        </div>

                        <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => {
                              setIsEditingPref(false);
                              if (!isPrefConfirmed) {
                                setPrefAssetClass('');
                                setPrefHorizon('');
                              }
                            }}
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                            onClick={() => handleSavePreferences(matchingLead, matchingCustomer)}
                          >
                            <CheckCircle size={14} /> Confirm Preferences
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="lead-detail-grid">
                          <div>
                            <span className="lead-custom-label">Preferred Asset Class:</span>
                            <div
                              className="lead-custom-value"
                              style={{
                                color: isPrefConfirmed && prefAssetClass ? 'var(--text-primary)' : 'var(--text-muted)',
                              }}
                            >
                              {isPrefConfirmed && prefAssetClass && prefAssetClass !== '—' ? (
                                prefAssetClass
                              ) : (
                                <span className="not-specified-badge">Not Specified</span>
                              )}
                            </div>
                          </div>
                          <div>
                            <span className="lead-custom-label">Investment Horizon:</span>
                            <div
                              className="lead-custom-value"
                              style={{
                                color: isPrefConfirmed && prefHorizon ? 'var(--text-primary)' : 'var(--text-muted)',
                              }}
                            >
                              {isPrefConfirmed && prefHorizon && prefHorizon !== '—' ? (
                                prefHorizon
                              ) : (
                                <span className="not-specified-badge">Not Specified</span>
                              )}
                            </div>
                          </div>
                        </div>

                        {isPrefConfirmed ? (
                          <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ fontSize: 11, color: '#10b981', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
                              <CheckCircle size={13} /> Confirmed by IRM — Visible in other modules
                            </div>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              style={{ fontSize: 11, padding: '3px 8px', height: 'auto' }}
                              onClick={() => setIsEditingPref(true)}
                            >
                              Edit
                            </button>
                          </div>
                        ) : (
                          <div style={{ marginTop: 10, padding: '10px 12px', background: 'var(--bg-surface)', borderRadius: 6, fontSize: 11.5, color: 'var(--text-muted)' }}>
                            Preferred Asset Class and Investment Horizon have not been set by IRM yet. Check <strong>"Set by IRM"</strong> above to configure and confirm them.
                          </div>
                        )}
                      </div>
                    )}

                    {/* Any other custom attributes from intake */}
                    {customFieldRows.length > 0 && (
                      <div className="lead-detail-grid" style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border-base)' }}>
                        {customFieldRows.map(item => (
                          <div key={item!.id}>
                            <span className="lead-custom-label">{item!.label}:</span>
                            <div className="lead-custom-value">{item!.value}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                  </>
                )}

                {/* ── Message from User ── */}
                <div className="card lead-custom-card">
                  <h4 className="lead-custom-title">Message from User</h4>
                  <div className="lead-user-message-box">
                    {userMessage ? (
                      <div className="lead-user-message-text">{userMessage}</div>
                    ) : (
                      <div className="lead-user-message-empty">No message submitted by user</div>
                    )}
                  </div>
                </div>

                {/* ── Internal Agent Remarks ── */}
                {leadNotes && leadNotes !== followupNotes && (
                  <div className="card lead-custom-card">
                    <h4 className="lead-custom-title">Agent Remarks &amp; Internal Notes</h4>
                    <div className="lead-user-message-box">
                      <div className="lead-user-message-text">{leadNotes}</div>
                    </div>
                  </div>
                )}

                {/* ── Call Recordings, Logged Calls & Transcripts (Agent + IRM) ── */}
                <LeadDetailDrawerContent
                  contactName={drawerFollowup.contactName}
                  contactPhone={drawerFollowup.contactPhone}
                  contactId={resolvedContactId}
                  contactType={resolvedContactType}
                  tenantId={tenant?.id}
                  tenantName={tenant?.name}
                  calls={callsList}
                  lead={matchingLead}
                  onCall={() =>
                    initiateCall(
                      drawerFollowup.contactName,
                      drawerFollowup.contactPhone,
                      resolvedContactType as any,
                      resolvedContactId,
                      drawerFollowup.id,
                      'follow_up'
                    )
                  }
                  sectionsOnly={['callRecordings']}
                />
              </div>
            );
          })()}
        </Drawer>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            backgroundColor: '#059669',
            color: '#ffffff',
            padding: '12px 20px',
            borderRadius: 8,
            boxShadow: '0 4px 14px rgba(0,0,0,0.25)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 13,
            fontWeight: 600,
            zIndex: 99999,
          }}
        >
          <CheckCircle size={17} /> {toastMessage}
        </div>
      )}
    </div>
  );
};

