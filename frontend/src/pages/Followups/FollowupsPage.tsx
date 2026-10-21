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
  X,
  CalendarRange,
  Clock,
} from 'lucide-react';
import { Followup, CallRecord, Deal, Lead, Customer } from '../../types';
import { storageService } from '../../services/storageService';
import { isMockMode } from '../../config/environment';
import { useAuth } from '../../context/AuthContext';
import { useCall } from '../../context/CallContext';
import {
  getFollowups,
  saveFollowup as apiSaveFollowup,
  getCalls,
  getLeads,
  getDeals,
  saveDeal as apiSaveDeal,
  saveLead as apiSaveLead,
  saveCustomer as apiSaveCustomer,
  isTenantMatch,
  transitionFollowupToKyc,
} from '../../services/ghlApiService';
import { StatusChip } from '../../components/common/StatusChip';
import { Modal } from '../../components/common/Modal';
import { Drawer } from '../../components/common/Drawer';
import { LeadDetailDrawerContent } from '../../components/common/LeadDetailDrawerContent';
type FollowupRoleFilter = 'all' | 'sales_executive' | 'irm';
import { DateRangePreset } from '../../types/kanban';
import { adminUserService } from '../../services/adminUserService';
import { fetchIrmAllLeads, IrmAllLeadsSummary } from '../../services/irmAllLeadsService';
import { User as UserModel } from '../../types';
import { getAgentRoleInfo, getAssigningSalesAgentInfo } from '../../utils/agentRoleUtils';
import { formatSmartScheduleDate, isDateToday, isDateOverdue } from '../../utils/dateUtils';
import './FollowupsPage.css';
import '../Leads/LeadsPage.css';

export const getFollowupSortTimestamp = (f: Followup): number => {
  const schedStr = (f.scheduledAt || '').trim();
  const dateStr = (f.scheduledDate || '').trim();
  const timeStr = (f.scheduledTime || '').trim();

  // 1. Try direct Date.parse (handles ISO strings like "2026-10-14T10:00:00.000Z")
  if (schedStr) {
    const directParsed = Date.parse(schedStr);
    if (!isNaN(directParsed)) return directParsed;
  }

  // 2. Combined scheduledDate + scheduledTime
  if (dateStr) {
    if (timeStr) {
      let combinedParsed = Date.parse(`${dateStr}T${timeStr}`);
      if (isNaN(combinedParsed)) {
        combinedParsed = Date.parse(`${dateStr} ${timeStr}`);
      }
      if (!isNaN(combinedParsed)) return combinedParsed;
    }
    const dParsed = Date.parse(dateStr);
    if (!isNaN(dParsed)) return dParsed;
  }

  // 3. Smart date strings: "Today • 11:00 AM", "Tomorrow • 10:00 AM", "Yesterday • 4:00 PM"
  if (schedStr) {
    const now = new Date();
    const lower = schedStr.toLowerCase();

    const extractTime = (str: string): { hours: number; minutes: number } => {
      const match = str.match(/(\d{1,2}):(\d{2})(?:\s*(am|pm))?/i);
      if (match) {
        let h = parseInt(match[1], 10);
        const m = parseInt(match[2], 10);
        const ampm = match[3]?.toLowerCase();
        if (ampm === 'pm' && h < 12) h += 12;
        if (ampm === 'am' && h === 12) h = 0;
        return { hours: h, minutes: m };
      }
      return { hours: 10, minutes: 0 };
    };

    if (lower.includes('today')) {
      const { hours, minutes } = extractTime(schedStr);
      return new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes).getTime();
    }
    if (lower.includes('tomorrow')) {
      const { hours, minutes } = extractTime(schedStr);
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      return new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(), hours, minutes).getTime();
    }
    if (lower.includes('yesterday')) {
      const { hours, minutes } = extractTime(schedStr);
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      return new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), hours, minutes).getTime();
    }

    const cleaned = schedStr.replace(/•/g, ' ').replace(/\s+/g, ' ').replace(/\(overdue\)/i, '').trim();
    const cleanedParsed = Date.parse(cleaned);
    if (!isNaN(cleanedParsed)) return cleanedParsed;
  }

  const cf = f.customFields;
  if (cf?.scheduledAt) {
    const cfParsed = Date.parse(cf.scheduledAt);
    if (!isNaN(cfParsed)) return cfParsed;
  }

  return Number.MAX_SAFE_INTEGER;
};

export const isFollowupReturned = (f: Followup, matchingLead?: Lead | null): boolean => {
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

export const getFollowupReturnedCoveringName = (f: Followup, matchingLead?: Lead | null): string => {
  return f.returnedFromCoveringUserName || f.customFields?.returnedFromCoveringUserName || matchingLead?.returnedFromCoveringUserName || matchingLead?.customFields?.returnedFromCoveringUserName || 'Covering Agent';
};

export const getFollowupReturnedDate = (f: Followup, matchingLead?: Lead | null): string | undefined => {
  return f.returnedAt || f.customFields?.returnedAt || matchingLead?.returnedAt || matchingLead?.customFields?.returnedAt;
};

export const FollowupsPage: React.FC = () => {
  const { tenant, user } = useAuth();
  const { initiateCall } = useCall();

  const [followups, setFollowups] = useState<Followup[]>([]);
  const [callsList, setCallsList] = useState<CallRecord[]>([]);
  const [allLeads, setAllLeads] = useState<Lead[]>([]);
  const [users, setUsers] = useState<UserModel[]>([]);
  const [irmSummaryData, setIrmSummaryData] = useState<IrmAllLeadsSummary | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'due' | 'overdue'>('all');
  const [handoverFilter, setHandoverFilter] = useState('Mine');

  // ── IRM Date Range Filter State (Only for IRM) ───────────────────────────
  const [irmStartDate, setIrmStartDate] = useState<string>('');
  const [irmEndDate, setIrmEndDate] = useState<string>('');
  const [irmDatePreset, setIrmDatePreset] = useState<'all' | 'today' | 'tomorrow' | 'this_week' | 'this_month' | 'overdue' | 'custom'>('all');

  const getLocalDateString = (d: Date): string => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const handleApplyIrmPreset = (preset: 'all' | 'today' | 'tomorrow' | 'this_week' | 'this_month' | 'overdue') => {
    setIrmDatePreset(preset);
    const now = new Date();

    if (preset === 'all' || preset === 'overdue') {
      setIrmStartDate('');
      setIrmEndDate('');
      return;
    }

    if (preset === 'today') {
      const todayStr = getLocalDateString(now);
      setIrmStartDate(todayStr);
      setIrmEndDate(todayStr);
      return;
    }

    if (preset === 'tomorrow') {
      const tom = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const tomStr = getLocalDateString(tom);
      setIrmStartDate(tomStr);
      setIrmEndDate(tomStr);
      return;
    }

    if (preset === 'this_week') {
      const startStr = getLocalDateString(now);
      const endOfWeek = new Date(now.getTime() + 6 * 24 * 60 * 60 * 1000);
      const endStr = getLocalDateString(endOfWeek);
      setIrmStartDate(startStr);
      setIrmEndDate(endStr);
      return;
    }

    if (preset === 'this_month') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      setIrmStartDate(getLocalDateString(startOfMonth));
      setIrmEndDate(getLocalDateString(endOfMonth));
      return;
    }
  };

  const handleIrmDateChange = (field: 'start' | 'end', value: string) => {
    setIrmDatePreset('custom');
    if (field === 'start') {
      setIrmStartDate(value);
    } else {
      setIrmEndDate(value);
    }
  };

  const handleClearIrmDateFilter = () => {
    setIrmDatePreset('all');
    setIrmStartDate('');
    setIrmEndDate('');
  };

  const isFollowupInIrmDateRange = (f: Followup): boolean => {
    if (!isIrm) return true;
    if (irmDatePreset === 'all' && !irmStartDate && !irmEndDate) return true;

    if (irmDatePreset === 'overdue') {
      return isDateOverdue(f.scheduledAt || f.scheduledDate) && !isDateToday(f.scheduledAt || f.scheduledDate);
    }

    if (irmDatePreset === 'today') {
      return isDateToday(f.scheduledAt || f.scheduledDate);
    }

    const schedStr = (f.scheduledAt || '').trim();
    const dateStr = (f.scheduledDate || '').trim();
    const parsedTime = Date.parse(schedStr) || (dateStr ? Date.parse(dateStr) : NaN);

    if (irmStartDate || irmEndDate) {
      if (isNaN(parsedTime)) {
        const s = schedStr.toLowerCase();
        if (s.includes('today')) {
          const nowStr = getLocalDateString(new Date());
          if (irmStartDate && nowStr < irmStartDate) return false;
          if (irmEndDate && nowStr > irmEndDate) return false;
          return true;
        }
        return true;
      }
      const start = irmStartDate ? new Date(`${irmStartDate}T00:00:00`).getTime() : 0;
      const end = irmEndDate ? new Date(`${irmEndDate}T23:59:59.999`).getTime() : Infinity;
      return parsedTime >= start && parsedTime <= end;
    }

    return true;
  };

  const handoverOptions = useMemo(() => {
    const coveringNames = Array.from(new Set(followups.map(f => f.handedOverFromName).filter(Boolean)));
    const returnedItems = followups.filter(f => isFollowupReturned(f));
    const returnedNames = Array.from(new Set(returnedItems.map(f => getFollowupReturnedCoveringName(f)).filter(Boolean)));

    if (coveringNames.length === 0 && returnedNames.length === 0) return [];
    return [
      { value: 'All', label: 'All Follow-ups' },
      { value: 'Mine', label: 'Mine (Regular)' },
      ...coveringNames.map(name => ({ value: `Handover_${name}`, label: `Covering for ${name}` })),
      ...(returnedNames.length > 0 ? [{ value: 'Returned', label: 'Returned from Handover' }] : []),
      ...returnedNames.map(name => ({ value: `Returned_${name}`, label: `Returned from ${name}` }))
    ];
  }, [followups]);
  const [rescheduleItem, setRescheduleItem] = useState<Followup | null>(null);
  const [newDate, setNewDate] = useState('');
  const [conflictModalData, setConflictModalData] = useState<{
    conflictTime: string;
    contactName: string;
    agentName?: string;
    suggestedTime?: string;
    suggestedDateIso?: string;
  } | null>(null);

  const openRescheduleModal = (f: Followup) => {
    setRescheduleItem(f);
    try {
      if (f.scheduledAt) {
        const d = new Date(f.scheduledAt);
        if (!isNaN(d.getTime())) {
          const pad = (n: number) => n.toString().padStart(2, '0');
          setNewDate(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`);
          return;
        }
      }
    } catch { }
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(10, 0, 0, 0);
    const pad = (n: number) => n.toString().padStart(2, '0');
    setNewDate(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T10:00`);
  };

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

  const roleCode = user?.role?.code;
  const isExec = roleCode === 'sales_executive';
  const isGhlAdmin =
    (tenant?.slug === 'ghl' || tenant?.id === 't-ghl-01') &&
    ((roleCode as string) === 'company_admin' || (roleCode as string) === 'admin' || roleCode === 'super_admin');
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
      } else if (selectedRole === 'irm') {
        const irms = users.filter(u => {
          const code = (u.role?.code || '').toLowerCase();
          const roleId = String(u.role?.id || '');
          const roleName = (u.role?.name || '').toLowerCase();
          return code === 'irm' || roleId === '4' || roleName.includes('irm') || roleName.includes('investor');
        });
        if (irms.length > 0) return irms;
      } else {
        // 'all': Show both Sales Executives and IRMs
        const team = users.filter(u => {
          const code = (u.role?.code || '').toLowerCase();
          const roleId = String(u.role?.id || '');
          const roleName = (u.role?.name || '').toLowerCase();
          return (
            code === 'sales_executive' || roleId === '3' || roleName.includes('sales') ||
            code === 'irm' || roleId === '4' || roleName.includes('irm') || roleName.includes('investor')
          );
        });
        if (team.length > 0) {
          const seen = new Set<string>();
          return team.filter(u => {
            const key = (u.name || '').trim().toLowerCase();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });
        }
      }
    }
    const storageAgents = storageService.getAgents ? storageService.getAgents(tenant?.id) : [];
    const storageIrms = storageService.getIrms ? storageService.getIrms(tenant?.id) : [];
    if (selectedRole === 'sales_executive') {
      if (storageAgents && storageAgents.length > 0) return storageAgents;
      return [{ id: '3', name: 'Naveen' }];
    } else if (selectedRole === 'irm') {
      if (storageIrms && storageIrms.length > 0) return storageIrms;
      return [{ id: '5', name: 'Dhinakaran' }];
    } else {
      const combined = [...(storageAgents || []), ...(storageIrms || [])];
      if (combined.length > 0) {
        const seen = new Set<string>();
        return combined.filter(u => {
          const key = (u.name || '').trim().toLowerCase();
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      }
      return [{ id: '3', name: 'Naveen' }, { id: '5', name: 'Dhinakaran' }];
    }
  }, [selectedRole, users, tenant?.id]);

  const [loadError, setLoadError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoadError(null);
      const [data, calls, leads, fetchedUsers, irmSummary] = await Promise.all([
        getFollowups(tenant?.id),
        getCalls(tenant?.id),
        getLeads(tenant?.id),
        isAdmin ? adminUserService.getUsers(tenant?.id || '') : Promise.resolve([]),
        isIrm ? fetchIrmAllLeads(user?.id, undefined, user?.name, tenant?.id).catch(() => null) : Promise.resolve(null),
      ]);

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
              assignedRole: (l as any).assignedRole || (l.assignedIrmId ? 'irm' : (isIrm ? 'irm' : undefined)),
              assignedByName: l.assignedByName || (isIrm ? 'Created by IRM' : undefined),
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
              status: (il.status as any) || existing.status,
              nextFollowupDate: il.nextFollowupDate || existing.nextFollowupDate,
              assignedById: il.assignedById != null ? String(il.assignedById) : existing.assignedById,
              assignedByName: il.assignedByName || existing.assignedByName,
              assignedIrmId: String(user?.id || existing.assignedIrmId || ''),
              assignedIrmName: user?.name || existing.assignedIrmName || '',
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
              assignedIrmId: String(user?.id || ''),
              assignedIrmName: user?.name || '',
              createdAt: il.createdAt,
              nextFollowupDate: il.nextFollowupDate,
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
  };

  useEffect(() => {
    loadData();
    const handleUpdate = () => loadData();
    window.addEventListener('nexus_storage_updated', handleUpdate);
    window.addEventListener('nexus_handover_updated', handleUpdate);
    return () => {
      window.removeEventListener('nexus_storage_updated', handleUpdate);
      window.removeEventListener('nexus_handover_updated', handleUpdate);
    };
  }, [tenant?.id]);

  // Sync IRM preference state when drawer opens for a contact
  useEffect(() => {
    if (!drawerFollowup) return;
    const leads = storageService.getLeads(tenant?.id) || [];
    const customers = storageService.getCustomers(tenant?.id) || [];
    const fDigits = (drawerFollowup.contactPhone || '').replace(/\D/g, '').slice(-10);

    const l = leads.find(item => {
      if (drawerFollowup.contactId && drawerFollowup.contactId !== 'contact-new' && item.id === drawerFollowup.contactId) return true;
      const lDigits = (item.phone || '').replace(/\D/g, '').slice(-10);
      return lDigits && fDigits && lDigits === fDigits;
    });
    const c = customers.find(item => {
      if (drawerFollowup.contactId && item.id === drawerFollowup.contactId) return true;
      const cDigits = (item.phone || '').replace(/\D/g, '').slice(-10);
      return cDigits && fDigits && cDigits === fDigits;
    });

    const contactKey = drawerFollowup.contactId || fDigits;
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
  }, [drawerFollowup?.id, drawerFollowup?.contactPhone, drawerFollowup?.contactId, tenant?.id]);

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
      const contactKey = drawerFollowup.contactId || fDigits;

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

    (drawerFollowup as any).investmentAmount = cleanStr;

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
    if (!drawerFollowup) return;

    const leads = storageService.getLeads(tenant?.id) || [];
    const customers = storageService.getCustomers(tenant?.id) || [];
    const fDigits = (drawerFollowup.contactPhone || '').replace(/\D/g, '').slice(-10);

    const matchingLead = leads.find(l => {
      if (drawerFollowup.contactId && drawerFollowup.contactId !== 'contact-new' && l.id === drawerFollowup.contactId) return true;
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

    const resolvedContactId = drawerFollowup.contactId || matchingLead?.id || matchingCustomer?.id || `contact-${Date.now()}`;
    const contactEmail = matchingLead?.email || matchingCustomer?.email || (drawerFollowup as any).email || '';
    const contactLocation = matchingLead?.location || matchingCustomer?.location || (drawerFollowup as any).location || '';

    const investmentCapacity =
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

  // Helper to determine the assigned role of any followup
  const getFollowupRole = (f: Followup): 'Sales Executive' | 'IRM' => {
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
  };

  const handleSaveReschedule = async () => {
    if (rescheduleItem && newDate) {
      const parsedDate = new Date(newDate);
      if (isNaN(parsedDate.getTime())) {
        showToast('Please enter a valid date and time.');
        return;
      }

      // Check for time slot conflict: no two schedules can be booked at the same time for the same representative.
      // Both roles (Sales Executive and IRM) are considered individually.
      const targetMs = parsedDate.getTime();
      const currentAgentId = rescheduleItem.assignedAgentId ? String(rescheduleItem.assignedAgentId) : (user?.id ? String(user.id) : '');
      const rescheduleItemRole = getFollowupRole(rescheduleItem);

      const conflict = followups.find(f => {
        if (f.status !== 'Pending') return false;
        if (String(f.id) === String(rescheduleItem.id)) return false;

        // Must be the same representative: Sales Executive 1 only conflicts with Sales Executive 1; IRM only conflicts with that same IRM!
        const fAgentId = f.assignedAgentId ? String(f.assignedAgentId) : '';
        if (currentAgentId && fAgentId && fAgentId !== currentAgentId) return false;

        const fRole = getFollowupRole(f);
        if (fRole !== rescheduleItemRole) return false;

        const fTime = new Date(f.scheduledAt).getTime();
        if (isNaN(fTime)) return false;

        // Overlapping 20-minute slot window
        return Math.abs(targetMs - fTime) / (60 * 1000) < 20;
      });

      if (conflict) {
        const conflictDateObj = new Date(conflict.scheduledAt);
        const formattedConflictTime = conflictDateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ', ' + conflictDateObj.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
        const suggestedDate = new Date(conflictDateObj.getTime() + 20 * 60 * 1000);
        const pad = (n: number) => n.toString().padStart(2, '0');
        const suggestedDateIso = `${suggestedDate.getFullYear()}-${pad(suggestedDate.getMonth() + 1)}-${pad(suggestedDate.getDate())}T${pad(suggestedDate.getHours())}:${pad(suggestedDate.getMinutes())}`;
        const formattedSuggestedTime = suggestedDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' (' + suggestedDate.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ')';

        setConflictModalData({
          conflictTime: formattedConflictTime,
          contactName: conflict.contactName || 'Another Contact',
          suggestedTime: formattedSuggestedTime,
          suggestedDateIso,
        });
        return;
      }

      try {
        await apiSaveFollowup({ ...rescheduleItem, scheduledAt: parsedDate.toISOString(), status: 'Pending' });
        setRescheduleItem(null);
        setNewDate('');
        loadData();
        showToast('✓ Follow-up rescheduled successfully');
      } catch (err: any) {
        console.error('[FollowupsPage] API reschedule failed:', err);
        const msg = err?.message || '';
        if (msg.includes('already booked') || msg.includes('time slot') || msg.includes('between calls')) {
          const conflictDateObj = parsedDate;
          const formattedConflictTime = conflictDateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ', ' + conflictDateObj.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
          const suggestedDate = new Date(conflictDateObj.getTime() + 20 * 60 * 1000);
          const pad = (n: number) => n.toString().padStart(2, '0');
          const suggestedDateIso = `${suggestedDate.getFullYear()}-${pad(suggestedDate.getMonth() + 1)}-${pad(suggestedDate.getDate())}T${pad(suggestedDate.getHours())}:${pad(suggestedDate.getMinutes())}`;
          const formattedSuggestedTime = suggestedDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' (' + suggestedDate.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ')';

          setConflictModalData({
            conflictTime: formattedConflictTime,
            contactName: 'Existing Appointment',
            suggestedTime: formattedSuggestedTime,
            suggestedDateIso,
          });
        } else {
          showToast(`Failed to reschedule follow-up: ${msg || 'Server error'}`);
        }
      }
    }
  };

  // Helper to determine the display agent and role for a followup card or drawer
  const getFollowupDisplayAgent = (f: Followup): { label: string; name: string; role: string; badgeClass: string } => {
    const fPhone = (f.contactPhone || '').replace(/\D/g, '').slice(-10);
    const cleanContactId = (f.contactId || '').replace(/\D/g, '');
    const matchingLead = allLeads.find(l => {
      const cleanLeadId = String(l.id).replace(/\D/g, '');
      const idMatch = (cleanContactId && cleanLeadId && cleanContactId === cleanLeadId) || (f.contactId && String(f.contactId) === String(l.id));
      const lPhone = (l.phone || '').replace(/\D/g, '').slice(-10);
      return Boolean(idMatch) || Boolean(fPhone && lPhone && fPhone === lPhone);
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
  const isFollowupInDateFilter = (f: Followup): boolean => {
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
  };

  // Scoped dataset according to role and admin filters
  let scopedFollowups: Followup[];
  if (isAdmin) {
    scopedFollowups = followups.filter(f => {
      // 1. Role match (skip when 'all' is selected to show both Sales Exec and IRM followups)
      if (selectedRole !== 'all') {
        const role = getFollowupRole(f);
        const expectedRole = selectedRole === 'irm' ? 'IRM' : 'Sales Executive';
        if (role !== expectedRole) return false;
      }

      // 2. Person match
      if (selectedPerson !== 'All') {
        const pLower = selectedPerson.toLowerCase().trim();
        const matchesName = (f.assignedAgentName || '').toLowerCase().trim() === pLower;
        const matchesId = String(f.assignedAgentId || '').trim() === String(selectedPerson).trim();
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

    // Also synthesize follow-up tasks for any leads assigned to this Sales Executive that are in Follow-up/Callback stage
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
      if (lStatus === 'interested' || lStatus === 'qualified' || lStatus === 'converted' || lStatus === 'not interested' || lStatus === 'junk') {
        return false;
      }

      const isInFollowupStage =
        l.status === 'Follow-up Required' ||
        l.status === 'Callback';
      if (!isInFollowupStage) return false;

      const cleanPhone = (l.phone || '').replace(/\D/g, '').slice(-10);
      if (existingFollowupContactIds.has(String(l.id))) return false;
      if (cleanPhone && existingFollowupPhones.has(cleanPhone)) return false;

      return true;
    });

    for (const ml of missingFollowupLeads) {
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
        assignedAgentName: user?.name || ml.assignedAgentName || '',
        assignedRole: 'Sales Executive',
      });
    }
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
        (f.assignedAgentName && user?.name && f.assignedAgentName.trim().toLowerCase() === user.name.trim().toLowerCase()) ||
        (f.assignedRole === 'irm');
      if (isDirectlyAssigned) return true;

      if (matchingLead) {
        return (
          (matchingLead.assignedAgentId && String(matchingLead.assignedAgentId) === String(user?.id)) ||
          (matchingLead.assignedAgentName && user?.name && matchingLead.assignedAgentName.trim().toLowerCase() === user.name.trim().toLowerCase()) ||
          (matchingLead.assignedIrmId && String(matchingLead.assignedIrmId) === String(user?.id)) ||
          (matchingLead.assignedIrmName && user?.name && matchingLead.assignedIrmName.trim().toLowerCase() === user.name.trim().toLowerCase()) ||
          ((matchingLead.customFields as any)?.assignedIrmId && String((matchingLead.customFields as any).assignedIrmId) === String(user?.id)) ||
          ((matchingLead.customFields as any)?.assignedIrmName && user?.name && String((matchingLead.customFields as any).assignedIrmName).trim().toLowerCase() === user.name.trim().toLowerCase())
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
        (l.assignedAgentName && user?.name && l.assignedAgentName.trim().toLowerCase() === user.name.trim().toLowerCase()) ||
        (l.assignedIrmId && String(l.assignedIrmId) === String(user?.id)) ||
        (l.assignedIrmName && user?.name && l.assignedIrmName.trim().toLowerCase() === user.name.trim().toLowerCase()) ||
        ((l.customFields as any)?.assignedIrmId && String((l.customFields as any).assignedIrmId) === String(user?.id)) ||
        ((l.customFields as any)?.assignedIrmName && user?.name && String((l.customFields as any).assignedIrmName).trim().toLowerCase() === user.name.trim().toLowerCase());
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
        assignedAgentName: user?.name || ml.assignedAgentName || '',
        assignedRole: 'IRM',
      });
    }
  } else {
    scopedFollowups = followups;
  }

  // Deduplicate follow-up tasks by contact so each contact has at most ONE active follow-up task card.
  // If multiple records exist for the same contact (e.g. from repeated calls or fallback synthesis),
  // pick the most actionable/recent one and merge any distinct notes so no contact is duplicated.
  let processedFollowups: Followup[] = [];
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
          winner.notes = wNotes ? `${wNotes} | ${sNotes}` : sNotes;
        }

        contactMap.set(contactKey, winner);
      } else {
        contactMap.set(contactKey, { ...f });
      }
    }

    processedFollowups = Array.from(contactMap.values());
  } catch (err) {
    console.error('Error deduping followups list by contact:', err);
    processedFollowups = scopedFollowups;
  }

  const getCallCountForFollowup = (f: Followup): number => {
    const fPhoneDigits = (f.contactPhone || '').replace(/\D/g, '').slice(-10);
    return callsList.filter((c: CallRecord) => {
      if (
        f.contactId &&
        f.contactId !== 'contact-new' &&
        (c.leadId === f.contactId || (c as any).contactId === f.contactId)
      ) {
        return true;
      }
      const cPhoneDigits = (c.contactPhone || '').replace(/\D/g, '').slice(-10);
      return cPhoneDigits && fPhoneDigits && cPhoneDigits === fPhoneDigits;
    }).length;
  };

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

      processedFollowups = processedFollowups.filter(f => {
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

    processedFollowups = processedFollowups.filter(f => {
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

      processedFollowups = processedFollowups.filter(f => {
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

  // Count badges & filters
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
  }, [isIrm, activePendingFollowups, irmDatePreset, irmStartDate, irmEndDate]);

  const filteredFollowups = useMemo(() => {
    const list = dateScopedFollowups.filter(f => {
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

    return list.sort((a, b) => {
      const timeA = getFollowupSortTimestamp(a);
      const timeB = getFollowupSortTimestamp(b);
      if (timeA !== timeB) return timeA - timeB;

      const priorityOrder: Record<string, number> = { High: 1, Medium: 2, Low: 3 };
      const pA = priorityOrder[a.priority] || 4;
      const pB = priorityOrder[b.priority] || 4;
      if (pA !== pB) return pA - pB;

      return (a.contactName || '').localeCompare(b.contactName || '');
    });
  }, [dateScopedFollowups, isIrm, activeTab]);

  const drawerFollowupRole = drawerFollowup ? getFollowupRole(drawerFollowup) : '';

  return (
    <div className="followups-page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <CalendarCheck size={24} color="var(--primary-600)" /> Follow-ups & Reminders
          </h1>
          <p className="page-subtitle">
            Keep commitments, maintain pipeline velocity, and log outcomes seamlessly.
          </p>
        </div>
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
          <button
            onClick={() => loadData()}
            style={{
              background: '#ef4444',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              padding: '6px 14px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              marginLeft: '12px',
            }}
          >
            Retry
          </button>
        </div>
      )}

      {/* ── Admin Global Filter Bar ─────────────────────────────────────────── */}
      {isAdmin && (
        <div className="admin-followup-filterbar">
          <div className="admin-followup-filter-group">
            {/* 1. Role Filter */}
            <div className="followup-filter-item">
              <label htmlFor="admin-followup-role" className="followup-filter-label">
                <Briefcase size={14} color="var(--primary-600)" />
                Role:
              </label>
              <select
                id="admin-followup-role"
                name="roleFilter"
                className="followup-filter-select"
                value={selectedRole}
                onChange={e => handleRoleChange(e.target.value as FollowupRoleFilter)}
              >
                <option value="all">All</option>
                <option value="sales_executive">Sales Executive</option>
                <option value="irm">IRM (Investor Relations)</option>
              </select>
            </div>

            {/* 2. Person Filter (Dynamic based on Role) */}
            <div className="followup-filter-item">
              <label htmlFor="admin-followup-person" className="followup-filter-label">
                <User size={14} color="var(--text-muted)" />
                Person:
              </label>
              <select
                id="admin-followup-person"
                name="personFilter"
                className="followup-filter-select"
                value={selectedPerson}
                onChange={e => setSelectedPerson(e.target.value)}
              >
                <option value="All">
                  {selectedRole === 'sales_executive'
                    ? 'All Sales Executives'
                    : selectedRole === 'irm'
                    ? 'All IRMs'
                    : 'All Persons'}
                </option>
                {(personOptions || []).map((p: any) => (
                  <option key={p.id} value={p.name}>
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
                <option value="all">All Records</option>
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
              className={`followup-role-tag ${
                selectedRole === 'all'
                  ? 'tag-all'
                  : selectedRole === 'sales_executive'
                  ? 'tag-sales-exec'
                  : 'tag-irm'
              }`}
            >
              {selectedRole === 'all' ? (
                <>
                  <CalendarCheck size={13} /> All Follow-ups (Sales & IRM)
                </>
              ) : selectedRole === 'sales_executive' ? (
                <>
                  <Briefcase size={13} /> Sales Executive Follow-ups
                </>
              ) : (
                <>
                  <Sparkles size={13} /> IRM Investor Follow-ups
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

      {/* Tabs (Only for Non-IRM) */}
      {!isIrm && (
        <div className="followups-tabs-container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 8 }}>
            {[
              { id: 'all', label: `All Tasks (${activePendingFollowups.length})` },
              {
                id: 'due',
                label: `Due Today (${activePendingFollowups.filter(isFollowupToday).length})`,
              },
              {
                id: 'overdue',
                label: `Overdue (${activePendingFollowups.filter(f => isFollowupOverdue(f) && !isFollowupToday(f)).length})`,
                danger: true,
              },
            ].map(tab => (
              <button
                key={tab.id}
                className={`btn btn-sm ${activeTab === tab.id ? 'btn-primary' : 'btn-secondary'
                  } ${tab.danger && activeTab === tab.id
                    ? 'followups-tab-danger-active'
                    : tab.danger
                      ? 'followups-tab-danger-inactive'
                      : ''
                  }`}
                onClick={() => setActiveTab(tab.id as any)}
              >
                {tab.danger && (
                  <AlertTriangle size={13} color={activeTab === tab.id ? '#ffffff' : '#dc2626'} />
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
        {filteredFollowups.length === 0 ? (
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
            const agentInfo = getFollowupDisplayAgent(f);

            return (
              <div
                key={f.id}
                className={`card card-hover followup-item-card ${isOverdue ? 'overdue' : ''}`}
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
                  <div>
                    <div
                      className="followup-contact-header"
                      style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}
                    >
                      <span
                        className="followup-contact-name"
                        style={canOpenDrawer ? { color: 'var(--primary-600)', fontWeight: 700 } : undefined}
                      >
                        {f.contactName}
                      </span>

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
                      <span className={`followup-schedule-time ${isOverdue ? 'overdue' : ''}`}>
                        ⏰ {formatSmartScheduleDate(f.scheduledAt)}
                      </span>
                      <span className="followup-assignee">• {agentInfo.label}: {agentInfo.name}</span>
                      <span className={`badge-role-inline ${agentInfo.badgeClass}`}>
                        {agentInfo.role}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="followup-actions-right">
                  {!(isGhlAdmin && fRole === 'IRM') && (
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={e => {
                        e.stopPropagation();
                        openRescheduleModal(f);
                      }}
                    >
                      Reschedule
                    </button>
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
        title="Reschedule Follow-up"
        subtitle={`Adjust scheduled reminder date for ${rescheduleItem?.contactName}`}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setRescheduleItem(null)}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleSaveReschedule}>
              Save New Slot
            </button>
          </>
        }
      >
        <div className="form-group">
          <label htmlFor="followup-reschedule-datetime" className="form-label" style={{ fontWeight: 600, marginBottom: 8, display: 'block' }}>
            New Date & Time
          </label>
          <input
            id="followup-reschedule-datetime"
            name="newDateTime"
            type="datetime-local"
            className="form-input"
            value={newDate}
            onChange={e => setNewDate(e.target.value)}
            style={{ width: '100%', padding: '10px 12px', fontSize: '0.95rem' }}
          />
          <small style={{ display: 'block', marginTop: 8, color: '#64748b' }}>
            Select an available date and time. No two follow-ups can be booked at the same time.
          </small>
        </div>
      </Modal>

      {/* Time Slot Conflict Alert Popup */}
      <Modal
        isOpen={!!conflictModalData}
        onClose={() => setConflictModalData(null)}
        title="Time Slot Already Booked"
        subtitle="Schedule Spacing & Conflict Warning"
        maxWidth={490}
        footer={
          <div style={{ display: 'flex', gap: 10, width: '100%' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setConflictModalData(null)}
              style={{ flex: 1 }}
            >
              Choose Another Time
            </button>
            {conflictModalData?.suggestedDateIso && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  if (conflictModalData.suggestedDateIso) {
                    setNewDate(conflictModalData.suggestedDateIso.slice(0, 16));
                  }
                  setConflictModalData(null);
                }}
                style={{ flex: 1.2 }}
              >
                Use Suggested (+20m)
              </button>
            )}
          </div>
        }
      >
        <div style={{ textAlign: 'center', padding: '10px 4px' }}>
          <div style={{
            width: 52,
            height: 52,
            borderRadius: '50%',
            background: 'rgba(239, 68, 68, 0.1)',
            color: '#dc2626',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 26,
            margin: '0 auto 14px'
          }}>
            <AlertTriangle size={28} color="#dc2626" />
          </div>
          <h4 style={{ margin: '0 0 8px', fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary, #0f172a)' }}>
            This Time Slot is Already Booked
          </h4>
          <p style={{ margin: '0 0 14px', color: 'var(--text-secondary, #64748b)', fontSize: '0.9rem', lineHeight: 1.5 }}>
            You already have a scheduled follow-up near this time:
          </p>
          <div style={{
            background: 'var(--bg-surface-hover, #f8fafc)',
            border: '1px solid var(--border-base, #e2e8f0)',
            borderRadius: 8,
            padding: '12px 16px',
            marginBottom: 14,
            textAlign: 'left'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary, #64748b)' }}>Contact:</span>
              <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary, #1e293b)' }}>
                {conflictModalData?.contactName}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary, #64748b)' }}>Scheduled Time:</span>
              <span style={{ fontSize: '0.88rem', fontWeight: 600, color: '#ef4444' }}>
                {conflictModalData?.conflictTime}
              </span>
            </div>
          </div>

          {/* Meaningful scheduling advice box */}
          <div style={{
            background: 'rgba(59, 130, 246, 0.08)',
            border: '1px solid rgba(59, 130, 246, 0.25)',
            borderRadius: 8,
            padding: '12px 14px',
            marginBottom: 14,
            textAlign: 'left'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, color: '#2563eb', fontWeight: 600, fontSize: '0.85rem' }}>
              <Clock size={15} />
              Scheduling Buffer Advice
            </div>
            <p style={{ margin: 0, fontSize: '0.83rem', color: 'var(--text-primary, #334155)', lineHeight: 1.5 }}>
              To avoid overlapping appointments and ensure sufficient time for each call, <strong>please schedule your follow-up at least 15–20 minutes after your existing appointment.</strong>
            </p>
          </div>

          {conflictModalData?.suggestedTime && (
            <div style={{
              background: 'rgba(16, 185, 129, 0.08)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              borderRadius: 8,
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 4
            }}>
              <span style={{ fontSize: '0.82rem', color: '#059669', fontWeight: 600 }}>Suggested Next Slot:</span>
              <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#059669' }}>
                {conflictModalData.suggestedTime}
              </span>
            </div>
          )}
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
              ? `Phone: ${drawerFollowup?.contactPhone || '—'} • Assigned : ${drawerFollowup?.assignedAgentName || 'Unassigned'
              } (${drawerFollowupRole})`
              : drawerFollowup?.contactPhone
                ? `Phone: ${drawerFollowup.contactPhone} • ${tenant?.name || 'GHL India'}`
                : (tenant?.name || '')
          }
          width={720}
          footer={
            drawerFollowup && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: isExec ? 'flex-end' : 'space-between', width: '100%', gap: 10 }}>
                {/* Ready for KYC button (Hidden for Sales Executive and GHL Admin, available for IRM) */}
                {!isExec && !isGhlAdmin && (
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
                        openRescheduleModal(drawerFollowup);
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

            const userMessage =
              (matchingLead as any)?.message ||
              (matchingLead as any)?.userMessage ||
              matchingLead?.customFields?.message ||
              matchingLead?.customFields?.userMessage ||
              (matchingCustomer as any)?.message ||
              (matchingCustomer as any)?.userMessage ||
              matchingLead?.notes ||
              matchingCustomer?.notes ||
              drawerFollowup.notes ||
              null;

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

                {/* ── Message from User ── */}
                <div className="card lead-custom-card">
                  <h4 className="lead-custom-title">Message from User</h4>
                  <div className="lead-user-message-box">
                    {userMessage ? (
                      <div className="lead-user-message-text">{userMessage}</div>
                    ) : (
                      <div className="lead-user-message-empty">No message available</div>
                    )}
                  </div>
                </div>

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

