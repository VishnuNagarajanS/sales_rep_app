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
} from 'lucide-react';
import { Followup, Deal, Lead, Customer } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useCall } from '../../context/CallContext';
import { storageService } from '../../services/storageService';
import { StatusChip } from '../../components/common/StatusChip';
import { Modal } from '../../components/common/Modal';
import { Drawer } from '../../components/common/Drawer';
import { LeadDetailDrawerContent } from '../../components/common/LeadDetailDrawerContent';
import {
  FollowupRoleFilter,
  SALES_EXECUTIVE_USERS,
  IRM_USERS,
} from '../../mock_data/adminFollowupsData';
import { DateRangePreset } from '../../mock_data/adminKanbanData';
import './FollowupsPage.css';
import '../Leads/LeadsPage.css';

export const FollowupsPage: React.FC = () => {
  const { tenant, user } = useAuth();
  const { initiateCall } = useCall();

  const [followups, setFollowups] = useState<Followup[]>([]);
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

  const handleRoleChange = (newRole: FollowupRoleFilter) => {
    setSelectedRole(newRole);
    setSelectedPerson('All');
  };

  const personOptions = useMemo(() => {
    return selectedRole === 'sales_executive' ? SALES_EXECUTIVE_USERS : IRM_USERS;
  }, [selectedRole]);

  const loadData = () => {
    if (tenant?.slug === 'ghl') {
      storageService.cleanupGhlPendingFollowups(tenant?.id);
    }
    setFollowups(storageService.getFollowups(tenant?.id) || []);
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

  const handleMoveToKyc = () => {
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

    // 1. Create or update deal in stage 'qualified_investor'
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
    storageService.saveDeal(kycDeal);

    // 2. Mark the follow-up task as completed so it does not show in the followup page
    storageService.saveFollowup({
      ...drawerFollowup,
      status: 'Completed',
      notes: `${drawerFollowup.notes ? drawerFollowup.notes + ' | ' : ''}Ready for KYC: Moved to KYC Module by IRM`,
    });

    // 3. If matching lead exists, update lead status to Qualified
    if (matchingLead) {
      storageService.saveLead({
        ...matchingLead,
        status: 'Qualified',
        customFields: {
          ...(matchingLead.customFields || {}),
          preferredAssetClass: prefAssetClass,
          horizon: prefHorizon,
          investmentHorizon: prefHorizon,
          irmPreferencesConfirmed: true,
        },
      });
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
      storageService.saveFollowup({
        ...rescheduleItem,
        scheduledAt: newDate,
        status: 'Pending',
      });
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
    if (
      IRM_USERS.some(
        u =>
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
    scopedFollowups = followups.filter(
      f =>
        (f.assignedAgentId && f.assignedAgentId === user?.id) ||
        (f.assignedAgentName && f.assignedAgentName === user?.name)
    );
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

  const callsList = storageService.getCalls(tenant?.id) || [];

  const getCallCountForFollowup = (f: Followup): number => {
    const fPhoneDigits = (f.contactPhone || '').replace(/\D/g, '').slice(-10);
    return callsList.filter(c => {
      if (
        f.contactId &&
        f.contactId !== 'contact-new' &&
        (c.leadId === f.contactId || c.contactId === f.contactId)
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
      const allLeads = storageService.getLeads(tenant?.id) || [];
      const niJunkLeadIds = new Set<string>(
        allLeads
          .filter(l => l.status === 'Not Interested' || l.status === 'Junk')
          .map(l => l.id)
      );
      const niJunkPhones = new Set<string>(
        allLeads
          .filter(l => l.status === 'Not Interested' || l.status === 'Junk')
          .map(l => (l.phone || '').replace(/\D/g, '').slice(-10))
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

  const filteredFollowups = processedFollowups.filter(f => {
    if (activeTab === 'due') {
      return f.status === 'Pending' && (f.scheduledAt || '').toLowerCase().includes('today');
    }
    if (activeTab === 'overdue') {
      return f.status === 'Pending' && (f.scheduledAt || '').toLowerCase().includes('yesterday');
    }
    return f.status === 'Pending';
  });

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
                {personOptions.map(p => (
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
              Total Tasks: <strong>{activePendingFollowups.length}</strong>
            </span>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="followups-tabs-container">
        {[
          { id: 'all', label: `All Tasks (${activePendingFollowups.length})` },
          {
            id: 'due',
            label: `Due Today (${
              activePendingFollowups.filter(f =>
                (f.scheduledAt || '').toLowerCase().includes('today')
              ).length
            })`,
          },
          {
            id: 'overdue',
            label: `Overdue (${
              activePendingFollowups.filter(f =>
                (f.scheduledAt || '').toLowerCase().includes('yesterday')
              ).length
            })`,
            danger: true,
          },
        ].map(tab => (
          <button
            key={tab.id}
            className={`btn btn-sm ${
              activeTab === tab.id ? 'btn-primary' : 'btn-secondary'
            } ${
              tab.danger && activeTab === tab.id
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

      {/* Follow-ups List Cards */}
      <div className="followups-list">
        {filteredFollowups.length === 0 ? (
          <div className="card text-center followups-empty-card">
            No tasks in this category. You're all caught up!
          </div>
        ) : (
          filteredFollowups.map(f => {
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
            drawerFollowup?.contactPhone
              ? `Phone: ${drawerFollowup.contactPhone} • ${tenant?.name || 'GHL India'}`
              : (tenant?.name || '')
          }
          width={720}
          footer={
            drawerFollowup && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: 10 }}>
                {/* Red marked area on the left: Ready for KYC button */}
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

                {/* Right side buttons */}
                <div style={{ display: 'flex', gap: 10 }}>
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

