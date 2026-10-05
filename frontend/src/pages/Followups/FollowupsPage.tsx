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
  Clock,
  RotateCcw,
  ArrowUpDown,
  Filter,
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
  saveDeal as apiSaveDeal,
  saveLead as apiSaveLead,
  isTenantMatch,
} from '../../services/ghlApiService';
import { StatusChip } from '../../components/common/StatusChip';
import { Modal } from '../../components/common/Modal';
import { Drawer } from '../../components/common/Drawer';
import { LeadDetailDrawerContent } from '../../components/common/LeadDetailDrawerContent';
// FollowupRoleFilter type (was imported from mock_data — moved inline; mock data is in mock_data/ folder only)
export type FollowupRoleFilter = 'sales_executive' | 'irm';
export type TimeSortOption = 'time_asc' | 'time_desc' | 'priority_desc' | 'default';
export type DateFilterOption =
  | 'all'
  | 'today'
  | 'tomorrow'
  | 'yesterday'
  | 'this_week'
  | 'this_month'
  | 'specific_date'
  | 'custom_range';

export interface ParsedFollowupDateTime {
  timestamp: number;
  timeMinutes: number;
  dateKey: string;
  hasTime: boolean;
  displayTime: string;
}

export function parseFollowupDateTime(f: Followup): ParsedFollowupDateTime {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const formatDateKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  const todayKey = formatDateKey(now);
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  const yesterdayKey = formatDateKey(yesterday);
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const tomorrowKey = formatDateKey(tomorrow);

  let targetDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let dateKey = todayKey;
  let hours = 9;
  let minutes = 0;
  let hasTime = false;
  let displayTime = '';

  const rawSched = (f.scheduledAt || '').trim();
  const lowerSched = rawSched.toLowerCase();

  // 1. Determine date component
  if (lowerSched.includes('today')) {
    targetDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    dateKey = todayKey;
  } else if (lowerSched.includes('yesterday')) {
    targetDate = yesterday;
    dateKey = yesterdayKey;
  } else if (lowerSched.includes('tomorrow')) {
    targetDate = tomorrow;
    dateKey = tomorrowKey;
  } else if (f.scheduledDate && /^\d{4}-\d{2}-\d{2}$/.test(f.scheduledDate.trim())) {
    const parts = f.scheduledDate.trim().split('-');
    targetDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    dateKey = f.scheduledDate.trim();
  } else if (rawSched) {
    const parsedIso = Date.parse(rawSched);
    if (!isNaN(parsedIso)) {
      const d = new Date(parsedIso);
      targetDate = d;
      dateKey = formatDateKey(d);
      hours = d.getHours();
      minutes = d.getMinutes();
      hasTime = true;
    }
  }

  // 2. Extract time component from f.scheduledTime or rawSched
  const timeSource = (f.scheduledTime || rawSched).trim();
  const timeMatch = timeSource.match(/(?:^|[,\s])(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);

  if (timeMatch) {
    let h = parseInt(timeMatch[1], 10);
    const m = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
    const meridiem = timeMatch[3] ? timeMatch[3].toUpperCase() : null;

    if (meridiem) {
      if (meridiem === 'PM' && h < 12) h += 12;
      if (meridiem === 'AM' && h === 12) h = 0;
      hours = h;
      minutes = m;
      hasTime = true;
      const displayH = h % 12 === 0 ? 12 : h % 12;
      displayTime = `${pad(displayH)}:${pad(m)} ${meridiem}`;
    } else if (timeMatch[2] !== undefined && h >= 0 && h <= 23 && m >= 0 && m <= 59) {
      hours = h;
      minutes = m;
      hasTime = true;
      const period = h >= 12 ? 'PM' : 'AM';
      const displayH = h % 12 === 0 ? 12 : h % 12;
      displayTime = `${pad(displayH)}:${pad(m)} ${period}`;
    }
  }

  const timeMinutes = hours * 60 + minutes;
  const fullTimestamp = new Date(
    targetDate.getFullYear(),
    targetDate.getMonth(),
    targetDate.getDate(),
    hours,
    minutes,
    0
  ).getTime();

  return {
    timestamp: fullTimestamp,
    timeMinutes,
    dateKey,
    hasTime,
    displayTime: displayTime || `${pad(hours % 12 || 12)}:${pad(minutes)} ${hours >= 12 ? 'PM' : 'AM'}`,
  };
}

export function isFollowupMatchingDate(
  f: Followup,
  filterType: DateFilterOption,
  specDate: string,
  startD: string,
  endD: string
): boolean {
  if (filterType === 'all') return true;

  const parsed = parseFollowupDateTime(f);
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const todayKey = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

  const yest = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  const yestKey = `${yest.getFullYear()}-${pad(yest.getMonth() + 1)}-${pad(yest.getDate())}`;

  const tom = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const tomKey = `${tom.getFullYear()}-${pad(tom.getMonth() + 1)}-${pad(tom.getDate())}`;

  const raw = (f.scheduledAt || '').toLowerCase();

  if (filterType === 'today') {
    return raw.includes('today') || parsed.dateKey === todayKey;
  }
  if (filterType === 'tomorrow') {
    return raw.includes('tomorrow') || parsed.dateKey === tomKey;
  }
  if (filterType === 'yesterday') {
    return (
      raw.includes('yesterday') ||
      parsed.dateKey === yestKey ||
      parsed.timestamp < new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
    );
  }
  if (filterType === 'this_week') {
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 7);
    endOfWeek.setHours(23, 59, 59, 999);
    return parsed.timestamp >= startOfWeek.getTime() && parsed.timestamp <= endOfWeek.getTime();
  }
  if (filterType === 'this_month') {
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0).getTime();
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).getTime();
    return parsed.timestamp >= startOfMonth && parsed.timestamp <= endOfMonth;
  }
  if (filterType === 'specific_date') {
    if (!specDate) return true;
    if (specDate === todayKey && raw.includes('today')) return true;
    if (specDate === yestKey && raw.includes('yesterday')) return true;
    if (specDate === tomKey && raw.includes('tomorrow')) return true;
    return parsed.dateKey === specDate;
  }
  if (filterType === 'custom_range') {
    if (!startD && !endD) return true;
    const start = startD ? new Date(`${startD}T00:00:00`).getTime() : 0;
    const end = endD ? new Date(`${endD}T23:59:59`).getTime() : Infinity;
    return parsed.timestamp >= start && parsed.timestamp <= end;
  }
  return true;
}

export function sortFollowups(list: Followup[], sortOption: TimeSortOption): Followup[] {
  if (sortOption === 'default') return list;

  return [...list].sort((a, b) => {
    const parsedA = parseFollowupDateTime(a);
    const parsedB = parseFollowupDateTime(b);

    if (sortOption === 'time_asc') {
      // 1. If on the same date, prioritize timeMinutes ascending (10:00 AM before 12:00 PM)
      if (parsedA.dateKey === parsedB.dateKey) {
        if (parsedA.timeMinutes !== parsedB.timeMinutes) {
          return parsedA.timeMinutes - parsedB.timeMinutes;
        }
      } else {
        // Across different dates, earlier date comes first
        if (parsedA.timestamp !== parsedB.timestamp) {
          return parsedA.timestamp - parsedB.timestamp;
        }
      }
      // Secondary: Priority (High before Medium before Low)
      const priorityWeight: Record<string, number> = { High: 3, Medium: 2, Low: 1 };
      const diff = (priorityWeight[b.priority] || 2) - (priorityWeight[a.priority] || 2);
      if (diff !== 0) return diff;
      return a.contactName.localeCompare(b.contactName);
    }

    if (sortOption === 'time_desc') {
      // 1. If on the same date, latest time of day first (12:00 PM before 10:00 AM)
      if (parsedA.dateKey === parsedB.dateKey) {
        if (parsedA.timeMinutes !== parsedB.timeMinutes) {
          return parsedB.timeMinutes - parsedA.timeMinutes;
        }
      } else {
        if (parsedA.timestamp !== parsedB.timestamp) {
          return parsedB.timestamp - parsedA.timestamp;
        }
      }
      return a.contactName.localeCompare(b.contactName);
    }

    if (sortOption === 'priority_desc') {
      const priorityWeight: Record<string, number> = { High: 3, Medium: 2, Low: 1 };
      const diff = (priorityWeight[b.priority] || 2) - (priorityWeight[a.priority] || 2);
      if (diff !== 0) return diff;
      return parsedA.timestamp - parsedB.timestamp;
    }

    return 0;
  });
}
import { DateRangePreset } from '../../types/kanban';
import './FollowupsPage.css';
import '../Leads/LeadsPage.css';

export const FollowupsPage: React.FC = () => {
  const { tenant, user } = useAuth();
  const { initiateCall } = useCall();

  const [followups, setFollowups] = useState<Followup[]>([]);
  const [callsList, setCallsList] = useState<CallRecord[]>([]);
  const [allLeads, setAllLeads] = useState<Lead[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'due' | 'overdue'>('all');
  const [rescheduleItem, setRescheduleItem] = useState<Followup | null>(null);
  const [newDate, setNewDate] = useState('');

  // Profile Drawer state for GHL Sales Exec & Admin
  const [drawerFollowup, setDrawerFollowup] = useState<Followup | null>(null);

  // IRM Custom Preferences state
  const [isEditingPref, setIsEditingPref] = useState<boolean>(false);
  const [prefAssetClass, setPrefAssetClass] = useState<string>('CO-AIF');
  const [prefHorizon, setPrefHorizon] = useState<string>('3-5 Years');
  const [isPrefConfirmed, setIsPrefConfirmed] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // IRM Investment Capacity state
  const [isEditingCapacity, setIsEditingCapacity] = useState<boolean>(false);
  const [capacityValue, setCapacityValue] = useState<string>('');
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
  const isGhlSalesExec = tenant?.slug === 'ghl' && isExec;
  const isIrm = roleCode === 'irm';
  const canOpenDrawer = isGhlSalesExec || isAdmin || isIrm;

  // ── Admin Filter States ──────────────────────────────────────────────────
  const [selectedRole, setSelectedRole] = useState<FollowupRoleFilter>('sales_executive');
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

  // ── Time Priority and Date Filter States ──────────────────────────────────
  const [timeSortOption, setTimeSortOption] = useState<TimeSortOption>('time_asc');
  const [dateFilterOption, setDateFilterOption] = useState<DateFilterOption>('all');
  const [specificDate, setSpecificDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });

  const handleTabClick = (tabId: 'all' | 'due' | 'overdue') => {
    setActiveTab(tabId);
    if (tabId === 'due') {
      setDateFilterOption('today');
    } else if (tabId === 'overdue') {
      setDateFilterOption('yesterday');
    } else {
      setDateFilterOption('all');
    }
  };

  const handleDateFilterChange = (newVal: DateFilterOption) => {
    setDateFilterOption(newVal);
    if (newVal === 'today') {
      setActiveTab('due');
    } else if (newVal === 'yesterday') {
      setActiveTab('overdue');
    } else {
      setActiveTab('all');
    }
  };

  const handleResetFilters = () => {
    setDateFilterOption('all');
    setTimeSortOption('time_asc');
    setActiveTab('all');
    setSpecificDate(new Date().toISOString().split('T')[0]);
  };

  const handleRoleChange = (newRole: FollowupRoleFilter) => {
    setSelectedRole(newRole);
    setSelectedPerson('All');
  };

  const personOptions = useMemo(() => {
    if (selectedRole === 'sales_executive') {
      return storageService.getAgents ? storageService.getAgents(tenant?.id) : [];
    }
  }, [selectedRole, tenant?.id]);

  const loadData = async () => {
    try {
      const [data, calls, leads] = await Promise.all([
        getFollowups(tenant?.id),
        getCalls(tenant?.id),
        getLeads(tenant?.id),
      ]);
      setFollowups(data || []);
      setCallsList(calls || []);
      setAllLeads(leads || []);
    } catch (err) {
      console.error('Failed to load followups data', err);
    }
  };

  useEffect(() => {
    loadData();
    const handleUpdate = () => loadData();
    window.addEventListener('nexus_storage_updated', handleUpdate);
    return () => window.removeEventListener('nexus_storage_updated', handleUpdate);
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
      } catch {}
    }

    const rawAssetClass =
      savedLocal?.preferredAssetClass ||
      (l?.customFields?.irmPreferencesConfirmed ? l?.customFields?.preferredAssetClass : null) ||
      (c?.customFields?.irmPreferencesConfirmed ? c?.customFields?.preferredAssetClass : null) ||
      l?.customFields?.preferredAssetClass ||
      c?.customFields?.preferredAssetClass;

    const existingAssetClass =
      rawAssetClass === 'AIF' || rawAssetClass === 'CO-AIF'
        ? rawAssetClass
        : 'CO-AIF';

    const existingHorizon =
      savedLocal?.horizon ||
      (l?.customFields?.irmPreferencesConfirmed ? (l?.customFields?.horizon || l?.customFields?.investmentHorizon) : null) ||
      (c?.customFields?.irmPreferencesConfirmed ? (c?.customFields?.horizon || c?.customFields?.investmentHorizon) : null) ||
      l?.customFields?.horizon ||
      l?.customFields?.investmentHorizon ||
      c?.customFields?.horizon ||
      c?.customFields?.investmentHorizon ||
      '3-5 Years';

    const isConfirmed =
      savedLocal?.confirmed === true ||
      l?.customFields?.irmPreferencesConfirmed === true ||
      c?.customFields?.irmPreferencesConfirmed === true ||
      false;

    setPrefAssetClass(existingAssetClass);
    setPrefHorizon(existingHorizon);
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
  }, [drawerFollowup?.id, drawerFollowup?.contactPhone, drawerFollowup?.contactId, tenant?.id]);

  const handleTogglePrefCheckbox = (checked: boolean, matchingLead: Lead | null, matchingCustomer: Customer | null) => {
    if (checked) {
      setIsEditingPref(true);
    } else {
      setIsEditingPref(false);
      setIsPrefConfirmed(false);

      if (!drawerFollowup) return;
      const fDigits = (drawerFollowup.contactPhone || '').replace(/\D/g, '').slice(-10);
      const contactKey = drawerFollowup.contactId || fDigits;

      if (matchingLead) {
        storageService.saveLead({
          ...matchingLead,
          customFields: {
            ...(matchingLead.customFields || {}),
            irmPreferencesConfirmed: false,
          },
        });
      }

      if (matchingCustomer) {
        storageService.saveCustomer({
          ...matchingCustomer,
          customFields: {
            ...(matchingCustomer.customFields || {}),
            irmPreferencesConfirmed: false,
          },
        });
      }

      if (contactKey) {
        localStorage.setItem(
          `nexus_irm_pref_${contactKey}`,
          JSON.stringify({
            preferredAssetClass: prefAssetClass,
            horizon: prefHorizon,
            confirmed: false,
          })
        );
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

  const handleSavePreferences = (matchingLead: Lead | null, matchingCustomer: Customer | null) => {
    if (!drawerFollowup) return;
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
      '₹10 Lakh to ₹1 Cr';

    // 1. Create or update deal in stage 'qualified_investor' — save to DB first, fallback to localStorage
    const allDeals = storageService.getDeals(tenant?.id) || [];
    const existingDeal = allDeals.find(d =>
      (d.customerId && d.customerId === resolvedContactId) ||
      (d.phone && fDigits && (d.phone || '').replace(/\D/g, '').slice(-10) === fDigits)
    );

    const kycDeal: Deal = {
      id: existingDeal?.id || `deal-kyc-${Date.now()}`,
      companyId: tenant?.id || 't-ghl-01',
      title: `${drawerFollowup.contactName} - KYC Verification`,
      customerId: resolvedContactId,
      customerName: drawerFollowup.contactName,
      phone: drawerFollowup.contactPhone,
      email: contactEmail && contactEmail !== '—' ? contactEmail : undefined,
      location: contactLocation && contactLocation !== '—' ? contactLocation : undefined,
      stage: 'qualified_investor',
      stageEnteredAt: new Date().toISOString(),
      value: 20000000,
      expectedCloseDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
      assignedAgentId: user?.id || drawerFollowup.assignedAgentId || 'usr-ghl-irm',
      assignedAgentName: user?.name || drawerFollowup.assignedAgentName || 'Rohan Varma',
      notes: `Ready for KYC. Moved from Follow-ups by IRM (${user?.name || 'Rohan Varma'}).`,
      createdAt: new Date().toISOString().slice(0, 10),
      priority: drawerFollowup.priority || 'High',
      preferredAssetClass: prefAssetClass || 'CO-AIF',
      investmentRange: investmentCapacity,
    };

    // Save deal to DB (API) — this persists stage='qualified_investor' in Neon
    try {
      await apiSaveDeal(kycDeal);
    } catch (err) {
      console.warn('[FollowupsPage] API saveDeal failed, saving locally:', err);
      storageService.saveDeal(kycDeal);
    }

    // 2. Mark the follow-up task as completed in DB so it does not show in the followup page
    try {
      await apiSaveFollowup({
        ...drawerFollowup,
        status: 'Completed',
        notes: `${drawerFollowup.notes ? drawerFollowup.notes + ' | ' : ''}Ready for KYC: Moved to KYC Module by IRM`,
      });
    } catch (err) {
      console.warn('[FollowupsPage] API saveFollowup (complete) failed:', err);
      storageService.saveFollowup({
        ...drawerFollowup,
        status: 'Completed',
        notes: `${drawerFollowup.notes ? drawerFollowup.notes + ' | ' : ''}Ready for KYC: Moved to KYC Module by IRM`,
      });
    }

    // 3. If matching lead exists, update lead status to 'Ready for KYC' in DB
    if (matchingLead) {
      const updatedLead = {
        ...matchingLead,
        status: 'Qualified' as Lead['status'],
        customFields: {
          ...(matchingLead.customFields || {}),
          preferredAssetClass: prefAssetClass,
          horizon: prefHorizon,
          investmentHorizon: prefHorizon,
          irmPreferencesConfirmed: true,
          movedToKycAt: new Date().toISOString(),
        },
      };
      try {
        await apiSaveLead(updatedLead);
      } catch (err) {
        console.warn('[FollowupsPage] API saveLead (qualified) failed:', err);
        storageService.saveLead(updatedLead);
      }
    }

    // 4. Audit Log
    storageService.addAuditLog({
      id: `aud-${Date.now()}`,
      timestamp: new Date().toISOString(),
      actorName: user?.name || 'IRM',
      actorEmail: user?.email || 'irm@ghl.com',
      action: 'DEAL_CREATED_KYC',
      entityType: 'Deal',
      entityId: kycDeal.id,
      companyId: tenant?.id || 't-ghl-01',
      companyName: tenant?.name || 'GHL India Ventures',
      details: `Moved ${drawerFollowup.contactName} to KYC verification module`,
    });

    // 5. Update local state & close drawer
    setDrawerFollowup(null);
    loadData();
    window.dispatchEvent(new Event('nexus_storage_updated'));
    showToast(`✓ ${drawerFollowup.contactName} moved to KYC module!`);
  };

  const handleSaveReschedule = () => {
    if (rescheduleItem && newDate) {
      apiSaveFollowup({ ...rescheduleItem, scheduledAt: newDate, status: 'Pending' }).catch(console.error);
      setRescheduleItem(null);
      setNewDate('');
    }
  };

  // Helper to determine the assigned role of any followup
  const getFollowupRole = (f: Followup): 'Sales Executive' | 'IRM' => {
    if (f.assignedRole) {
      if (f.assignedRole.toLowerCase().includes('irm')) return 'IRM';
      return 'Sales Executive';
    }
    const irmsList = storageService.getIrms ? storageService.getIrms(tenant?.id) : [];
    if (
      irmsList.some(
        (u: any) =>
          u.name.toLowerCase() === (f.assignedAgentName || '').toLowerCase() ||
          u.id === f.assignedAgentId
      )
    ) {
      return 'IRM';
    }
    if (f.contactType === 'investor') {
      return 'IRM';
    }
    return 'Sales Executive';
  };

  // Helper to test if a followup date falls within date range filter
  const isFollowupInDateFilter = (f: Followup): boolean => {
    const schedStr = (f.scheduledAt || '').trim();
    const dateStr = (f.scheduledDate || '').trim();
    const now = new Date();

    const isToday = schedStr.toLowerCase().includes('today');
    const isYesterday = schedStr.toLowerCase().includes('yesterday');

    if (dateRangePreset === 'today') {
      if (isToday) return true;
      if (isYesterday) return false;
      const parsedTime = Date.parse(schedStr) || (dateStr ? Date.parse(dateStr) : NaN);
      if (!isNaN(parsedTime)) {
        const d = new Date(parsedTime);
        return (
          d.getDate() === now.getDate() &&
          d.getMonth() === now.getMonth() &&
          d.getFullYear() === now.getFullYear()
        );
      }
      return true;
    }

    if (dateRangePreset === 'this_week') {
      if (isToday || isYesterday) return true;
      const parsedTime = Date.parse(schedStr) || (dateStr ? Date.parse(dateStr) : NaN);
      if (!isNaN(parsedTime)) {
        const sevenDaysAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000;
        return parsedTime >= sevenDaysAgo;
      }
      return true;
    }

    if (dateRangePreset === 'this_month') {
      if (isToday || isYesterday) return true;
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

      if (isToday) {
        const todayMs = now.getTime();
        return todayMs >= start && todayMs <= end;
      }
      if (isYesterday) {
        const yestMs = now.getTime() - 24 * 60 * 60 * 1000;
        return yestMs >= start && yestMs <= end;
      }
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
      // 1. Role match
      const role = getFollowupRole(f);
      const expectedRole = selectedRole === 'irm' ? 'IRM' : 'Sales Executive';
      if (role !== expectedRole) return false;

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
    const directMatches = followups.filter(
      f =>
        (f.assignedAgentId && String(f.assignedAgentId) === String(user?.id)) ||
        (f.assignedAgentName && f.assignedAgentName.toLowerCase() === (user?.name || '').toLowerCase())
    );
    if (directMatches.length > 0) {
      scopedFollowups = directMatches;
    } else {
      // Fallback: Sales Executive follow-ups for this tenant
      const execFollowups = followups.filter(
        f =>
          (!f.assignedRole || f.assignedRole.toLowerCase().includes('sales')) &&
          (!f.companyId || !tenant?.id || isTenantMatch(f.companyId, tenant.id))
      );
      scopedFollowups = execFollowups.length > 0 ? execFollowups : followups;
    }
  } else if (isIrm) {
    // IRM Follow-up Required: show ALL pending followups for this tenant
    // Matches linked lead 'Follow-up Required' status, direct assignment, or tenant match
    const leadMap = new Map<string, Lead>();
    allLeads.forEach(l => leadMap.set(l.id, l));
    scopedFollowups = followups.filter(f => {
      if (f.status !== 'Pending') return false;
      if (f.companyId && tenant?.id && !isTenantMatch(f.companyId, tenant.id)) return false;
      // Directly assigned to IRM agent
      if ((f.assignedAgentId && String(f.assignedAgentId) === String(user?.id)) ||
          (f.assignedAgentName && f.assignedAgentName === user?.name)) {
        return true;
      }
      // Linked lead has Follow-up Required status
      if (f.contactId) {
        const linked = leadMap.get(f.contactId);
        if (linked && linked.status === 'Follow-up Required') return true;
      }
      // Phone match fallback
      const fPhone = (f.contactPhone || '').replace(/\D/g, '').slice(-10);
      if (fPhone) {
        const matched = allLeads.find(l => {
          const lPhone = (l.phone || '').replace(/\D/g, '').slice(-10);
          return lPhone === fPhone && l.status === 'Follow-up Required';
        });
        if (matched) return true;
      }
      return true;
    });
  } else {
    scopedFollowups = followups;
  }

  // Safely deduplicate display rows
  let processedFollowups = scopedFollowups;
  if (isGhlSalesExec || isAdmin) {
    try {
      const seen = new Map<string, Followup>();
      const deduped: Followup[] = [];

      for (const f of scopedFollowups) {
        if (f.status !== 'Pending') {
          deduped.push(f);
          continue;
        }
        const phoneDigits = (f.contactPhone || '').replace(/\D/g, '').slice(-10);
        const key =
          f.contactId && f.contactId !== 'contact-new'
            ? `id:${f.contactId}`
            : phoneDigits
            ? `phone:${phoneDigits}`
            : `raw:${f.id}`;

        if (!seen.has(key)) {
          seen.set(key, f);
          deduped.push(f);
        }
      }
      processedFollowups = deduped;
    } catch (err) {
      console.error('Error deduping followups list:', err);
      processedFollowups = scopedFollowups;
    }
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
          .filter((l: Lead) => l.status === 'Not Interested' || l.status === 'Junk')
          .map((l: Lead) => l.id)
      );
      const niJunkPhones = new Set<string>(
        allLeads
          .filter((l: Lead) => l.status === 'Not Interested' || l.status === 'Junk')
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

  // Count badges
  const activePendingFollowups = processedFollowups.filter(f => f.status === 'Pending');

  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const todayKey = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  const yesterdayKey = `${yesterday.getFullYear()}-${pad(yesterday.getMonth() + 1)}-${pad(yesterday.getDate())}`;
  const todayStartMs = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  const dueCount = activePendingFollowups.filter(f => {
    const raw = (f.scheduledAt || '').toLowerCase();
    if (raw.includes('today')) return true;
    const parsed = parseFollowupDateTime(f);
    return parsed.dateKey === todayKey;
  }).length;

  const overdueCount = activePendingFollowups.filter(f => {
    const raw = (f.scheduledAt || '').toLowerCase();
    if (raw.includes('yesterday')) return true;
    const parsed = parseFollowupDateTime(f);
    return parsed.dateKey === yesterdayKey || parsed.timestamp < todayStartMs;
  }).length;

  const filteredFollowups = processedFollowups.filter(f => {
    if (f.status !== 'Pending') return false;

    // Tab filter
    if (activeTab === 'due') {
      const raw = (f.scheduledAt || '').toLowerCase();
      const parsed = parseFollowupDateTime(f);
      const isDue = raw.includes('today') || parsed.dateKey === todayKey;
      if (!isDue) return false;
    } else if (activeTab === 'overdue') {
      const raw = (f.scheduledAt || '').toLowerCase();
      const parsed = parseFollowupDateTime(f);
      const isOverdue =
        raw.includes('yesterday') ||
        parsed.dateKey === yesterdayKey ||
        parsed.timestamp < todayStartMs;
      if (!isOverdue) return false;
    }

    // Date filter: applied when on 'all' tab or explicit date filter active
    if (activeTab === 'all' && !isFollowupMatchingDate(f, dateFilterOption, specificDate, customStartDate, customEndDate)) {
      return false;
    }

    return true;
  });

  const finalSortedFollowups = useMemo(() => {
    return sortFollowups(filteredFollowups, timeSortOption);
  }, [filteredFollowups, timeSortOption]);

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

      {/* ── Admin Global Filter Bar ─────────────────────────────────────────── */}
      {isAdmin && (
        <div className="admin-followup-filterbar">
          <div className="admin-followup-filter-group">
            {/* 1. Role Filter */}
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
                <option value="sales_executive">Sales Executive</option>
                <option value="irm">IRM (Investor Relations)</option>
              </select>
            </div>

            {/* 2. Person Filter (Dynamic based on Role) */}
            <div className="followup-filter-item">
              <span className="followup-filter-label">
                <User size={14} color="var(--text-muted)" />
                Person:
              </span>
              <select
                className="followup-filter-select"
                value={selectedPerson}
                onChange={e => setSelectedPerson(e.target.value)}
              >
                <option value="All">
                  {selectedRole === 'sales_executive' ? 'All Sales Executives' : 'All IRMs'}
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
              <span className="followup-filter-label">
                <Calendar size={14} color="var(--text-muted)" />
                Date Range:
              </span>
              <select
                className="followup-filter-select"
                value={dateRangePreset}
                onChange={e => setDateRangePreset(e.target.value as DateRangePreset)}
              >
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
                  type="date"
                  className="followup-date-input"
                  value={customStartDate}
                  onChange={e => setCustomStartDate(e.target.value)}
                  title="Start Date"
                />
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>to</span>
                <input
                  type="date"
                  className="followup-date-input"
                  value={customEndDate}
                  onChange={e => setCustomEndDate(e.target.value)}
                  title="End Date"
                />
              </div>
            )}

            {/* 4. Time Priority Filter */}
            <div className="followup-filter-item">
              <span className="followup-filter-label">
                <Clock size={14} color="var(--primary-600)" />
                Time Priority:
              </span>
              <select
                id="admin-filter-time-priority"
                className="followup-filter-select"
                value={timeSortOption}
                onChange={e => setTimeSortOption(e.target.value as TimeSortOption)}
                title="Sort follow-ups by time of day (Earliest first e.g. 10 AM before 12 PM)"
              >
                <option value="time_asc">Earliest First (10 AM → 12 PM)</option>
                <option value="time_desc">Latest First (12 PM → 10 AM)</option>
                <option value="priority_desc">Priority: High to Low</option>
                <option value="default">Default Order</option>
              </select>
            </div>
          </div>

          {/* Right Section: Role Mode Tag & Total Count */}
          <div className="admin-followup-meta-group">
            <span
              className={`followup-role-tag ${
                selectedRole === 'sales_executive' ? 'tag-sales-exec' : 'tag-irm'
              }`}
            >
              {selectedRole === 'sales_executive' ? (
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
              Showing: <strong>{finalSortedFollowups.length}</strong> of {activePendingFollowups.length}
            </span>
          </div>
        </div>
      )}

      {/* ── Unified Single-Row Controls: Tabs + Date Filter + Time Priority ── */}
      <div className="followups-unified-row">
        {/* Left: Quick Scope Tabs (All Tasks, Due Today, Overdue) */}
        <div className="followups-tabs-pill-group">
          {[
            { id: 'all', label: 'All Tasks', count: activePendingFollowups.length },
            { id: 'due', label: 'Due Today', count: dueCount },
            { id: 'overdue', label: 'Overdue', count: overdueCount, danger: true },
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              className={`followup-tab-pill ${
                activeTab === tab.id ? 'active' : ''
              } ${
                tab.danger ? (activeTab === tab.id ? 'danger-active' : 'danger-inactive') : ''
              }`}
              onClick={() => handleTabClick(tab.id as any)}
            >
              {tab.danger && (
                <AlertTriangle size={13} color={activeTab === tab.id ? '#ffffff' : '#dc2626'} />
              )}
              <span>{tab.label}</span>
              <span className={`followup-pill-count ${activeTab === tab.id ? 'count-active' : ''}`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        <div className="followups-row-divider" />

        {/* Center: Filters (Date Filter & Time Priority) */}
        <div className="followups-filters-inline-group">
          {/* 1. Date Filter */}
          <div className="followup-filter-item">
            <span className="followup-filter-label">
              <Calendar size={14} color="var(--primary-600)" />
              Date:
            </span>
            <select
              id="filter-date-select"
              className="followup-filter-select-compact"
              value={dateFilterOption}
              onChange={e => handleDateFilterChange(e.target.value as DateFilterOption)}
              title="Filter tasks by scheduled date"
            >
              <option value="all">All Dates</option>
              <option value="today">Today</option>
              <option value="tomorrow">Tomorrow</option>
              <option value="yesterday">Overdue / Yesterday</option>
              <option value="this_week">This Week</option>
              <option value="this_month">This Month</option>
              <option value="specific_date">Specific Date...</option>
              <option value="custom_range">Custom Range...</option>
            </select>
          </div>

          {/* Specific Date input if selected */}
          {dateFilterOption === 'specific_date' && (
            <div className="followup-filter-item">
              <input
                id="filter-specific-date"
                type="date"
                className="followup-date-input-compact"
                value={specificDate}
                onChange={e => setSpecificDate(e.target.value)}
                title="Choose Specific Date"
              />
            </div>
          )}

          {/* Custom Date Range inputs if selected */}
          {dateFilterOption === 'custom_range' && (
            <div className="followup-date-custom-inputs">
              <input
                id="filter-custom-start-date"
                type="date"
                className="followup-date-input-compact"
                value={customStartDate}
                onChange={e => setCustomStartDate(e.target.value)}
                title="Start Date"
              />
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>to</span>
              <input
                id="filter-custom-end-date"
                type="date"
                className="followup-date-input-compact"
                value={customEndDate}
                onChange={e => setCustomEndDate(e.target.value)}
                title="End Date"
              />
            </div>
          )}

          {/* 2. Time Priority Sort Filter */}
          <div className="followup-filter-item">
            <span className="followup-filter-label">
              <Clock size={14} color="var(--primary-600)" />
              Time Priority:
            </span>
            <select
              id="filter-time-priority"
              className="followup-filter-select-compact"
              value={timeSortOption}
              onChange={e => setTimeSortOption(e.target.value as TimeSortOption)}
              title="Sort follow-ups by time of day (Earliest first e.g. 10 AM before 12 PM)"
            >
              <option value="time_asc">Earliest First (10 AM → 12 PM)</option>
              <option value="time_desc">Latest First (12 PM → 10 AM)</option>
              <option value="priority_desc">Priority: High to Low</option>
              <option value="default">Default Order</option>
            </select>
          </div>

          {/* Reset Filters button if modified */}
          {(dateFilterOption !== 'all' || timeSortOption !== 'time_asc' || activeTab !== 'all') && (
            <button
              type="button"
              className="followup-reset-btn-compact"
              onClick={handleResetFilters}
              title="Reset all filters and sorting to defaults"
            >
              <RotateCcw size={12} /> Reset
            </button>
          )}
        </div>

        {/* Right: Showing Tasks Count */}
        <div className="followups-row-right">
          <span className="followup-total-badge">
            Showing: <strong>{finalSortedFollowups.length}</strong> of {activePendingFollowups.length}
          </span>
        </div>
      </div>

      {/* Follow-ups List Cards */}
      <div className="followups-list">
        {finalSortedFollowups.length === 0 ? (
          <div className="card text-center followups-empty-card">
            {dateFilterOption === 'specific_date'
              ? `No follow-up tasks scheduled for ${specificDate}. You're all caught up!`
              : dateFilterOption === 'tomorrow'
              ? "No follow-up tasks scheduled for tomorrow. You're all caught up!"
              : "No tasks in this category. You're all caught up!"}
          </div>
        ) : (
          finalSortedFollowups.map(f => {
            const isOverdue =
              f.status === 'Pending' && (f.scheduledAt || '').toLowerCase().includes('yesterday');
            const callCount = getCallCountForFollowup(f);
            const fRole = getFollowupRole(f);

            return (
              <div
                key={f.id}
                className={`card card-hover followup-item-card ${isOverdue ? 'overdue' : ''}`}
                onClick={canOpenDrawer ? () => setDrawerFollowup(f) : undefined}
                style={canOpenDrawer ? { cursor: 'pointer' } : undefined}
              >
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
                        ⏰ {f.scheduledAt}
                      </span>
                      <span className="followup-assignee">• Assignee: {f.assignedAgentName}</span>
                      <span
                        className={`badge-role-inline ${
                          fRole === 'IRM' ? 'badge-role-irm' : 'badge-role-sales'
                        }`}
                      >
                        {fRole}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="followup-actions-right">
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={e => {
                      e.stopPropagation();
                      setRescheduleItem(f);
                    }}
                  >
                    Reschedule
                  </button>
                  <button
                    className="btn btn-call btn-sm"
                    onClick={e => {
                      e.stopPropagation();
                      initiateCall(
                        f.contactName,
                        f.contactPhone,
                        f.contactType as any,
                        f.contactId,
                        f.id
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
          <label className="form-label">New Date & Time</label>
          <input
            type="text"
            className="form-input"
            value={newDate}
            onChange={e => setNewDate(e.target.value)}
            placeholder="e.g. Next Monday, 10:00 AM"
          />
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
              ? `Phone: ${drawerFollowup?.contactPhone || '—'} • Assigned to: ${
                  drawerFollowup?.assignedAgentName || 'Unassigned'
                } (${drawerFollowupRole})`
              : drawerFollowup?.contactPhone
              ? `Phone: ${drawerFollowup.contactPhone} • ${tenant?.name || 'GHL India'}`
              : (tenant?.name || '')
          }
          width={720}
          footer={
            drawerFollowup && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: isExec ? 'flex-end' : 'space-between', width: '100%', gap: 10 }}>
                {/* Ready for KYC button (Hidden for Sales Executive, available for IRM / Admins) */}
                {!isExec && (
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
                  <button
                    className="btn btn-secondary"
                    onClick={() => {
                      setRescheduleItem(drawerFollowup);
                      setDrawerFollowup(null);
                    }}
                  >
                    Reschedule
                  </button>
                  <button
                    className="btn btn-call"
                    onClick={() => {
                      initiateCall(
                        drawerFollowup.contactName,
                        drawerFollowup.contactPhone,
                        (drawerFollowup.contactType as any) || 'lead',
                        drawerFollowup.contactId,
                        drawerFollowup.id
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

            const assignedAgent =
              drawerFollowup.assignedAgentName ||
              matchingLead?.assignedAgentName ||
              matchingCustomer?.assignedAgentName ||
              'Unassigned';

            const contactEmail = matchingLead?.email || matchingCustomer?.email || (drawerFollowup as any).email || '—';
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
                            className={`admin-owner-role-tag ${
                              drawerFollowupRole === 'IRM' ? 'tag-irm' : 'tag-sales-exec'
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
                        <span className="cell-val">⏰ {drawerFollowup.scheduledAt}</span>
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
                      Assigned to <strong>{assignedAgent}</strong>
                      {drawerFollowupRole && (
                        <span
                          style={{
                            marginLeft: 8,
                            fontSize: 10,
                            fontWeight: 700,
                            padding: '2px 7px',
                            borderRadius: 4,
                            background: drawerFollowupRole === 'IRM' ? 'rgba(124,58,237,0.1)' : 'rgba(14,165,233,0.1)',
                            color: drawerFollowupRole === 'IRM' ? '#7c3aed' : '#0284c7',
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                          }}
                        >
                          {drawerFollowupRole}
                        </span>
                      )}
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
                        {drawerFollowup.scheduledAt || matchingLead?.nextFollowupDate || 'Not scheduled'}
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
                      <span className="lead-detail-label">Investment Capacity:</span>
                      {isEditingCapacity ? (
                        <div style={{ marginTop: 6 }}>
                          <select
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
                            fontSize: 16,
                            fontWeight: 700,
                            color: '#10b981',
                            letterSpacing: '0.01em',
                          }}
                        >
                          {capacityValue || investmentCapacity || '—'}
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
                      <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer', fontWeight: 600, color: 'var(--text-primary)' }}>
                        <input
                          type="checkbox"
                          checked={isPrefConfirmed || isEditingPref}
                          onChange={e => handleTogglePrefCheckbox(e.target.checked, matchingLead, matchingCustomer)}
                          style={{ width: 16, height: 16, cursor: 'pointer', accentColor: 'var(--primary-600)' }}
                        />
                        <span>Set by IRM</span>
                      </label>
                    </div>

                    {isEditingPref ? (
                      <div>
                        <div className="lead-detail-grid" style={{ gap: 14 }}>
                          <div>
                            <label className="lead-custom-label" style={{ display: 'block', marginBottom: 4, fontWeight: 600 }}>
                              Preferred Asset Class:
                            </label>
                            <select
                              className="form-select"
                              value={prefAssetClass}
                              onChange={e => setPrefAssetClass(e.target.value)}
                              style={{ width: '100%', fontSize: 13, height: 36 }}
                            >
                              <option value="CO-AIF">CO-AIF</option>
                              <option value="AIF">AIF</option>
                            </select>
                          </div>
                          <div>
                            <label className="lead-custom-label" style={{ display: 'block', marginBottom: 4, fontWeight: 600 }}>
                              Investment Horizon:
                            </label>
                            <select
                              className="form-select"
                              value={prefHorizon}
                              onChange={e => setPrefHorizon(e.target.value)}
                              style={{ width: '100%', fontSize: 13, height: 36 }}
                            >
                              <option value="1-2 Years">1-2 Years</option>
                              <option value="3-5 Years">3-5 Years</option>
                              <option value="5-7 Years">5-7 Years</option>
                              <option value="7-10 Years">7-10 Years</option>
                              <option value="10+ Years">10+ Years</option>
                            </select>
                          </div>
                        </div>

                        <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                          {isPrefConfirmed && (
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => setIsEditingPref(false)}
                            >
                              Cancel
                            </button>
                          )}
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
                    ) : isPrefConfirmed ? (
                      <div>
                        <div className="lead-detail-grid">
                          <div>
                            <span className="lead-custom-label">Preferred Asset Class:</span>
                            <div className="lead-custom-value">{prefAssetClass}</div>
                          </div>
                          <div>
                            <span className="lead-custom-label">Investment Horizon:</span>
                            <div className="lead-custom-value">{prefHorizon}</div>
                          </div>
                        </div>
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
                      </div>
                    ) : (
                      <div style={{ padding: '12px 14px', background: 'var(--bg-surface)', borderRadius: 6, fontSize: 12, color: 'var(--text-muted)' }}>
                        Preferred Asset Class and Investment Horizon have not been set by IRM yet. Check <strong>"Set by IRM"</strong> above to configure and confirm them.
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
                  onCall={() =>
                    initiateCall(
                      drawerFollowup.contactName,
                      drawerFollowup.contactPhone,
                      resolvedContactType as any,
                      resolvedContactId,
                      drawerFollowup.id
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

