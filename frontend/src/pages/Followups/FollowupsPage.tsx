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
} from '../../services/ghlApiService';
import { StatusChip } from '../../components/common/StatusChip';
import { Modal } from '../../components/common/Modal';
import { Drawer } from '../../components/common/Drawer';
import { LeadDetailDrawerContent } from '../../components/common/LeadDetailDrawerContent';
type FollowupRoleFilter = 'sales_executive' | 'irm';
import { DateRangePreset } from '../../types/kanban';
import { adminUserService } from '../../services/adminUserService';
import { User as UserModel } from '../../types';
import './FollowupsPage.css';
import '../Leads/LeadsPage.css';

export const FollowupsPage: React.FC = () => {
  const { tenant, user } = useAuth();
  const { initiateCall } = useCall();

  const [followups, setFollowups] = useState<Followup[]>([]);
  const [callsList, setCallsList] = useState<CallRecord[]>([]);
  const [allLeads, setAllLeads] = useState<Lead[]>([]);
  const [users, setUsers] = useState<UserModel[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'due' | 'overdue'>('all');
  const [rescheduleItem, setRescheduleItem] = useState<Followup | null>(null);
  const [newDate, setNewDate] = useState('');

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
  const isGhlSalesExec = tenant?.slug === 'ghl' && isExec;
  const isIrm = roleCode === 'irm';
  const canOpenDrawer = isGhlSalesExec || isAdmin || isIrm;

  // ── Admin Filter States ──────────────────────────────────────────────────
  const [selectedRole, setSelectedRole] = useState<FollowupRoleFilter>('sales_executive');
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
    }
    // Fallback strictly to real DB users
    if (selectedRole === 'sales_executive') {
      return [
        { id: '3', name: 'Naveen' },
      ];
    }
    return [
      { id: '5', name: 'Dhinakaran' },
    ];
  }, [selectedRole, users]);

  const loadData = async () => {
    try {
      const [data, calls, leads, fetchedUsers] = await Promise.all([
        getFollowups(tenant?.id),
        getCalls(tenant?.id),
        getLeads(tenant?.id),
        isAdmin ? adminUserService.getUsers(tenant?.id || '') : Promise.resolve([])
      ]);

      let followupsList = (data && data.length > 0) ? [...data] : (storageService.getFollowups(tenant?.id) || []);

      // Also ensure any lead with status 'Follow-up Required' is represented in followups
      const existingContactIds = new Set(followupsList.map(f => String(f.contactId || f.id)));
      const existingPhones = new Set(followupsList.map(f => (f.contactPhone || '').replace(/\D/g, '').slice(-10)).filter(Boolean));

      (leads || []).forEach(l => {
        if (l.status === 'Follow-up Required') {
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
            });
          }
        }
      });

      setFollowups(followupsList);
      setCallsList(calls || []);
      setAllLeads(leads || []);
      if (fetchedUsers && fetchedUsers.length > 0) {
        setUsers(fetchedUsers);
      }
    } catch (err) {
      console.error('Failed to load followups data', err);
      setFollowups(storageService.getFollowups(tenant?.id) || []);
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

    const isConfirmed =
      savedLocal?.confirmed === true ||
      l?.customFields?.irmPreferencesConfirmed === true ||
      c?.customFields?.irmPreferencesConfirmed === true ||
      false;

    const savedAssetClass =
      (isConfirmed && savedLocal?.preferredAssetClass) ||
      (l?.customFields?.irmPreferencesConfirmed && l?.customFields?.preferredAssetClass) ||
      (c?.customFields?.irmPreferencesConfirmed && c?.customFields?.preferredAssetClass) ||
      (isConfirmed ? (l?.customFields?.preferredAssetClass || c?.customFields?.preferredAssetClass) : null) ||
      '';

    const savedHorizon =
      (isConfirmed && savedLocal?.horizon) ||
      (l?.customFields?.irmPreferencesConfirmed && (l?.customFields?.horizon || l?.customFields?.investmentHorizon)) ||
      (c?.customFields?.irmPreferencesConfirmed && (c?.customFields?.horizon || c?.customFields?.investmentHorizon)) ||
      (isConfirmed ? (l?.customFields?.horizon || l?.customFields?.investmentHorizon || c?.customFields?.horizon || c?.customFields?.investmentHorizon) : null) ||
      '';

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
        localStorage.setItem(
          `nexus_irm_pref_${contactKey}`,
          JSON.stringify({
            preferredAssetClass: '',
            horizon: '',
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

    // 1. Create or update deal in stage 'qualified_investor' — fetch from API first, fallback to localStorage
    let allDeals: Deal[] = [];
    try {
      allDeals = await getDeals(tenant?.id);
    } catch {
      allDeals = storageService.getDeals(tenant?.id) || [];
    }
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
      value: (investmentAmountValue && parseFloat(investmentAmountValue.replace(/,/g, '')) > 0)
        ? parseFloat(investmentAmountValue.replace(/,/g, ''))
        : (existingDeal?.value ?? 0),
      expectedCloseDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
      assignedAgentId: user?.id || drawerFollowup.assignedAgentId || '',
      assignedAgentName: user?.name || drawerFollowup.assignedAgentName || '',
      notes: `Ready for KYC. Moved from Follow-ups by IRM (${user?.name || ''}).`,
      createdAt: existingDeal?.createdAt || new Date().toISOString().slice(0, 10),
      priority: drawerFollowup.priority || 'High',
      // Only set preferredAssetClass if IRM has confirmed it; do not default to 'CO-AIF'
      ...(prefAssetClass && isPrefConfirmed ? { preferredAssetClass: prefAssetClass } : {}),
      // Only set investmentRange if actually provided; do not default
      ...(investmentCapacity ? { investmentRange: investmentCapacity } : {}),
    };

    // Save deal to DB (API) — this persists stage='qualified_investor' in Neon
    try {
      await apiSaveDeal(kycDeal);
    } catch (err: any) {
      console.error('[FollowupsPage] API saveDeal failed:', err);
      showToast(`Failed to move to KYC: ${err?.message || 'Error updating deal status'}`);
      return;
    }

    // 2. Mark the follow-up task as completed in DB so it does not show in the followup page
    try {
      await apiSaveFollowup({
        ...drawerFollowup,
        status: 'Completed',
        notes: `${drawerFollowup.notes ? drawerFollowup.notes + ' | ' : ''}Ready for KYC: Moved to KYC Module by IRM`,
      });
    } catch (err: any) {
      console.error('[FollowupsPage] API saveFollowup (complete) failed:', err);
      showToast(`Failed to complete follow-up task: ${err?.message || 'Error updating follow-up status'}`);
      return;
    }

    // 3. If matching lead exists, update lead status to 'Ready for KYC' in DB
    if (matchingLead) {
      const updatedLead = {
        ...matchingLead,
        status: 'Qualified' as Lead['status'],
        customFields: {
          ...(matchingLead.customFields || {}),
          ...(prefAssetClass && isPrefConfirmed ? { preferredAssetClass: prefAssetClass } : {}),
          ...(prefHorizon && isPrefConfirmed ? { horizon: prefHorizon, investmentHorizon: prefHorizon } : {}),
          investmentAmount: (investmentAmountValue && parseFloat(investmentAmountValue.replace(/,/g, '')) > 0)
            ? investmentAmountValue.replace(/,/g, '').trim()
            : undefined,
          irmPreferencesConfirmed: Boolean(isPrefConfirmed),
          movedToKycAt: new Date().toISOString(),
        },
      };
      try {
        await apiSaveLead(updatedLead);
      } catch (err: any) {
        console.error('[FollowupsPage] API saveLead (qualified) failed:', err);
        showToast(`Failed to update lead status: ${err?.message || 'Error updating lead'}`);
        return;
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

  const handleSaveReschedule = async () => {
    if (rescheduleItem && newDate) {
      try {
        await apiSaveFollowup({ ...rescheduleItem, scheduledAt: newDate, status: 'Pending' });
        setRescheduleItem(null);
        setNewDate('');
        loadData();
        showToast('✓ Follow-up rescheduled successfully');
      } catch (err: any) {
        console.error('[FollowupsPage] API reschedule failed:', err);
        showToast(`Failed to reschedule follow-up: ${err?.message || 'Server error'}`);
      }
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
    if (agentName.includes('dhinakaran') || agentId === '5' || agentId === '30' || agentName.includes('irm')) {
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
  } else if (isIrm) {
    // IRM: Only show pending follow-ups assigned to THIS authenticated IRM
    scopedFollowups = followups.filter(f => {
      if (f.status !== 'Pending') return false;
      if (f.companyId && tenant?.id && !isTenantMatch(f.companyId, tenant.id)) return false;
      return (
        (f.assignedAgentId && String(f.assignedAgentId) === String(user?.id)) ||
        (f.assignedAgentName && f.assignedAgentName === user?.name)
      );
    });
  } else {
    scopedFollowups = followups;
  }

  // Do NOT collapse legitimate separate tasks merely because they belong to the same customer or have nearby schedules.
  // Deduplicate only by unique ID so distinct tasks are never merged
  let processedFollowups = scopedFollowups;
  try {
    const seen = new Set<string>();
    const deduped: Followup[] = [];

    for (const f of scopedFollowups) {
      const key = String(f.id);
      if (!seen.has(key)) {
        seen.add(key);
        deduped.push(f);
      }
    }
    processedFollowups = deduped;
  } catch (err) {
    console.error('Error deduping followups list:', err);
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

  const filteredFollowups = processedFollowups.filter(f => {
    const schedStr = (f.scheduledAt || '').trim();
    const dateStr = (f.scheduledDate || '').trim();
    const now = new Date();
    
    const isToday = () => {
      const parsedTime = Date.parse(schedStr) || (dateStr ? Date.parse(dateStr) : NaN);
      if (isNaN(parsedTime)) return schedStr.toLowerCase().includes('today');
      const d = new Date(parsedTime);
      return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    };

    const isOverdueFunc = () => {
      const parsedTime = Date.parse(schedStr) || (dateStr ? Date.parse(dateStr) : NaN);
      if (isNaN(parsedTime)) return schedStr.toLowerCase().includes('yesterday');
      return parsedTime < new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    };

    if (activeTab === 'due') {
      return f.status === 'Pending' && isToday();
    }
    if (activeTab === 'overdue') {
      return f.status === 'Pending' && isOverdueFunc() && !isToday();
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
                  {!(isGhlAdmin && fRole === 'IRM') && (
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={e => {
                        e.stopPropagation();
                        setRescheduleItem(f);
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
              ? `Phone: ${drawerFollowup?.contactPhone || '—'} • Assigned : ${
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
                      Assigned : <strong>{assignedAgent}</strong>
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

                    {/* ── Investment Amount (Separate from Capacity & Asset Class) ── */}
                    <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border-color)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span className="lead-detail-label">Investment Amount:</span>
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
                      <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: isGhlAdmin ? 'default' : 'pointer', fontWeight: 600, color: 'var(--text-primary)' }}>
                        <input
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
                            <label className="lead-custom-label" style={{ display: 'block', marginBottom: 4, fontWeight: 600 }}>
                              Preferred Asset Class:
                            </label>
                            <select
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
                            <label className="lead-custom-label" style={{ display: 'block', marginBottom: 4, fontWeight: 600 }}>
                              Investment Horizon:
                            </label>
                            <select
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
                              {isPrefConfirmed && prefAssetClass ? prefAssetClass : '—'}
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
                              {isPrefConfirmed && prefHorizon ? prefHorizon : '—'}
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

