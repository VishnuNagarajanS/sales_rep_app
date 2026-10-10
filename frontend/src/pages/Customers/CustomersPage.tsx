import React, { useState, useEffect, useMemo } from 'react';
import {
  Building2,
  Phone,
  Plus,
  Play,
  ExternalLink,
  Filter,
  Users,
  UserCheck,
  Send,
  CheckCircle,
  Clock,
  Lock,
  Sparkles,
  Calendar,
  Pencil,
  CreditCard,
  Tag,
  ChevronDown,
  ChevronUp,
  Info,
  FileText,
  AlertCircle,
} from 'lucide-react';
import { Customer, CallRecord, Followup, Deal, Lead, IrmProfile, SiteVisit, CustomFieldDefinition, Booking } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useCall } from '../../context/CallContext';
import { storageService } from '../../services/storageService';
import { apiClient } from '../../services/apiClient';
import {
  getCustomers,
  saveCustomer as apiSaveCustomer,
  getCalls,
  getFollowups,
  saveFollowup as apiSaveFollowup,
  completeFollowup as apiCompleteFollowup,
  getDeals,
  getLeads,
} from '../../services/ghlApiService';
import { StatusChip } from '../../components/common/StatusChip';
import { DocumentUploader } from '../../components/common/DocumentUploader';
import { DocumentList } from '../../components/common/DocumentList';
import { Modal } from '../../components/common/Modal';
import { Timeline, TimelineEvent } from '../../components/common/Timeline';
import { jaminApiService } from '../../services/jaminApiService';
import { customersApi, Customer360Dto } from '../../services/crmApi';
import './CustomersPage.css';

const getCustomFieldDefinitions = (tenantId?: string): CustomFieldDefinition[] => {
  try {
    const raw = localStorage.getItem('nexus_custom_fields');
    const all: CustomFieldDefinition[] = raw ? JSON.parse(raw) : [];
    const normalizeTenant = (value?: string) => {
      const normalized = String(value || '').toLowerCase();
      if (['1', 't-ghl-01', 'ghl'].includes(normalized)) return '1';
      if (['2', 't-jamin-02', 'jamin'].includes(normalized)) return '2';
      return normalized;
    };
    return tenantId
      ? all.filter(d => !d.companyId || normalizeTenant(d.companyId) === normalizeTenant(tenantId))
      : all;
  } catch {
    return [];
  }
};
interface AutoRecommendation {
  customerId: string;
  customerName: string;
  investmentDisplay: string;
  tier: 'Premium' | 'Very High' | 'High' | 'Medium' | 'Normal';
  recommendedIrmId: string;
  recommendedIrmName: string;
  matchReason: string;
  isEdited?: boolean;
}

export const CustomersPage: React.FC = () => {
  const { tenant, user } = useAuth();
  const { initiateCall } = useCall();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [availableAgents, setAvailableAgents] = useState<Array<{ id: string; name: string; roleName?: string }>>([]);
  const irms = useMemo(() => storageService.getIrms(tenant?.id), [tenant?.id]);

  // Role-based scoping: Sales Executives see only their own customers.
  // Role-based scoping: Admin / Managers see the full company customer list.
  // Others (Sales Executives, etc.) see only their assigned customers.
  const roleCode = String(user?.role?.code || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  const isAdmin = roleCode === 'company_admin' || (roleCode as string) === 'admin' || roleCode === 'super_admin' || roleCode === 'sales_manager';
  const isExec = roleCode === 'sales_executive';

  // Consistent multi-tenant detection: verify slug, name, companyId, and tenant ID
  const isJamin = Boolean(
    tenant?.slug?.toLowerCase() === 'jamin' ||
    tenant?.id === 't-jamin-02' ||
    tenant?.id === '2' ||
    user?.companySlug?.toLowerCase() === 'jamin' ||
    (user?.companyName && /jamin/i.test(user.companyName)) ||
    user?.companyId === 2 ||
    (user?.companyId as any) === '2'
  );
  const isGhlTenant = !isJamin && Boolean(
    tenant?.slug?.toLowerCase() === 'ghl' ||
    tenant?.id === 't-ghl-01' ||
    tenant?.id === '1' ||
    user?.companySlug?.toLowerCase() === 'ghl' ||
    (user?.companyName && /ghl/i.test(user.companyName)) ||
    user?.companyId === 1 ||
    (user?.companyId as any) === '1' ||
    true
  );
  const isSalesExecutive = isExec || user?.role?.name === 'Sales Executive';
  const canAssignToIRM = Boolean(!isJamin && isGhlTenant && isSalesExecutive);
  const canManageAgentAssignments = ['company_admin', 'admin', 'super_admin', 'sales_manager', 'manager'].includes(roleCode);

  useEffect(() => {
    let cancelled = false;
    const loadAgents = async () => {
      try {
        if (isJamin && canManageAgentAssignments) {
          const agents = await jaminApiService.getAgents();
          const options = agents.map(a => ({ id: String(a.id), name: a.name, roleName: a.roleName }));
          if (!cancelled) {
            setAvailableAgents(options);
            setNewAgentId(current => options.some(a => a.id === current) ? current : (isAdmin ? options[0]?.id || '' : String(user?.id || '')));
          }
        } else if (!isJamin && canManageAgentAssignments) {
          const response = await apiClient.get<any>('/adminusers');
          const users = Array.isArray(response?.data) ? response.data : [];
          const options = users
            .filter((a: any) => String(a.status).toLowerCase() !== 'disabled' && String(a.status) !== '2')
            .filter((a: any) => /sales|manager/i.test(String(a.roleName || '')))
            .map((a: any) => ({ id: String(a.id), name: a.name, roleName: a.roleName }));
          if (!cancelled) {
            setAvailableAgents(options);
            setNewAgentId(current => options.some((a: { id: string }) => a.id === current) ? current : options[0]?.id || '');
          }
        } else if (!cancelled) {
          setAvailableAgents([]);
        }
      } catch (error) {
        console.error('Failed to load customer assignment options:', error);
        if (!cancelled) setAvailableAgents([]);
      }
    };
    void loadAgents();
    return () => { cancelled = true; };
  }, [canManageAgentAssignments, isJamin, tenant?.id, user?.id]);

  const scopedCustomers = isAdmin
    ? customers
    : customers.filter(c =>
      (c.assignedAgentId && (String(c.assignedAgentId) === String(user?.id) || c.assignedAgentId === user?.id)) ||
      (c.assignedAgentName && user?.name && c.assignedAgentName.toLowerCase() === user.name.toLowerCase()) ||
      (isExec && !c.assignedAgentId)
    );
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customer360Data, setCustomer360Data] = useState<Customer360Dto | null>(null);
  const [isLoading360, setIsLoading360] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'bookings' | 'calls' | 'followups' | 'timeline' | 'documents' | 'site_visits'>('overview');
  const [statusFilter, setStatusFilter] = useState('All');
  const [agentFilter, setAgentFilter] = useState('All');
  const [assignmentFilter, setAssignmentFilter] = useState<'All' | 'Assigned' | 'Unassigned'>('All');

  // Assignment mode state (Sales Executive only)
  const [isAssignMode, setIsAssignMode] = useState(false);
  const [assignSubMode, setAssignSubMode] = useState<'manual' | 'auto'>('manual');
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<Set<string>>(new Set());

  // Manual IRM selection modal state
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [selectedIrmId, setSelectedIrmId] = useState<string>('');

  // Auto assignment preview modal state
  const [isAutoPreviewModalOpen, setIsAutoPreviewModalOpen] = useState(false);
  const [autoRecommendations, setAutoRecommendations] = useState<AutoRecommendation[]>([]);
  const [editingRecommendationCustomerId, setEditingRecommendationCustomerId] = useState<string | null>(null);

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // New Customer modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [newStatus, setNewStatus] = useState<'Active' | 'VIP' | 'Inactive'>('Active');
  const [newAgentId, setNewAgentId] = useState(String(user?.id || ''));
  const [newCustomFields, setNewCustomFields] = useState<Record<string, any>>({});
  const [addErrors, setAddErrors] = useState<Record<string, string | undefined>>({});
  const [isSubmittingAdd, setIsSubmittingAdd] = useState(false);

  // Edit Customer modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editStatus, setEditStatus] = useState<'Active' | 'VIP' | 'Inactive'>('Active');
  const [editAgentId, setEditAgentId] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editTotalValue, setEditTotalValue] = useState<number | string>('');
  const [editCustomFields, setEditCustomFields] = useState<Record<string, any>>({});
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

  const handleOpenEditModal = (c: Customer) => {
    setEditName(c.name || '');
    setEditPhone(c.phone || '');
    setEditEmail(c.email || '');
    setEditLocation(c.location || '');
    setEditStatus(c.status || 'Active');
    setEditAgentId(c.assignedAgentId || '');
    setEditNotes(c.notes || '');
    setEditTotalValue(c.totalValue || '');
    setEditCustomFields(c.customFields || {});
    setIsEditModalOpen(true);
  };

  const handleSaveEditCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) return;
    if (!editName.trim() || !editPhone.trim()) {
      showToast('Name and phone are required.');
      return;
    }
    const missingCustomField = getCustomFieldDefinitions(tenant?.id)
      .filter(def => def.active !== false && def.module === 'customers' && def.required)
      .find(def => {
        const key = def.fieldKey || def.id;
        const value = String(editCustomFields[key] ?? def.defaultValue ?? '').trim();
        return !value || (def.fieldType === 'select' && Boolean(def.options?.length) && !def.options?.includes(value));
      });
    if (missingCustomField) {
      showToast(`${missingCustomField.label || missingCustomField.fieldKey || 'Required field'} is required.`);
      return;
    }
    const savedCustomFields = Object.fromEntries(
      getCustomFieldDefinitions(tenant?.id)
        .filter(def => def.active !== false && def.module === 'customers')
        .map(def => {
          const key = def.fieldKey || def.id;
          return [key, String(editCustomFields[key] ?? def.defaultValue ?? '')];
        })
    );
    setIsSubmittingEdit(true);
    try {
      const updated: Customer = {
        ...selectedCustomer,
        name: editName.trim(),
        phone: editPhone.trim(),
        email: editEmail.trim(),
        location: editLocation.trim(),
        status: editStatus,
        assignedAgentId: editAgentId || '',
        assignedAgentName: availableAgents.find(a => a.id === editAgentId)?.name || '',
        notes: editNotes.trim(),
        totalValue: editTotalValue === '' ? selectedCustomer.totalValue : Number(editTotalValue),
        customFields: savedCustomFields,
      };

      const saved = await apiSaveCustomer(updated);
      setSelectedCustomer(saved);
      setCustomers(prev => prev.map(c => c.id === saved.id ? saved : c));

      setIsEditModalOpen(false);
      showToast(`Customer ${saved.name} updated successfully.`);
      window.dispatchEvent(new Event('nexus_storage_updated'));
    } catch (error) {
      console.error('Failed to update customer:', error);
      showToast(error instanceof Error ? error.message : 'Could not save customer changes.');
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [followups, setFollowups] = useState<Followup[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [apiSiteVisits, setApiSiteVisits] = useState<SiteVisit[]>([]);

  const fetchCustomer360 = async (targetId?: string | number, preserveExistingOnFailure = true) => {
    const rawId = targetId ?? selectedCustomer?.id;
    if (!isJamin || !rawId) return;
    const numericId = parseInt(String(rawId).replace(/\D/g, ''), 10);
    if (isNaN(numericId) || numericId <= 0) return;

    setIsLoading360(true);
    try {
      const data = await customersApi.getCustomer360(numericId);
      if (data && data.customer) {
        setCustomer360Data(data);
      }
    } catch (err) {
      console.warn(`[Customer360] Failed to fetch 360 profile for customer #${numericId}:`, err);
      // Ensure refreshes and failed requests do not silently replace valid data with empty arrays
      if (!preserveExistingOnFailure) {
        setCustomer360Data(null);
      }
    } finally {
      setIsLoading360(false);
    }
  };

  const loadData = async () => {
    setIsLoading(true);
    try {
      if (isJamin) {
        // Jamin Mode: Load scoped customer list without downloading company-wide logs
        const apiCusts = await getCustomers(tenant?.id).catch(err => {
          console.error('Failed to fetch customers from the database:', err);
          return null;
        });

        if (apiCusts !== null) {
          setCustomers(apiCusts);
          const userVisibleCusts = isAdmin
            ? apiCusts
            : apiCusts.filter(c =>
              (c.assignedAgentId && (String(c.assignedAgentId) === String(user?.id) || c.assignedAgentId === user?.id)) ||
              (c.assignedAgentName && user?.name && c.assignedAgentName.toLowerCase() === user.name.toLowerCase())
            );
          const firstVisible = userVisibleCusts[0] || apiCusts[0];
          if (firstVisible) {
            setSelectedCustomer(prev => (prev && apiCusts.some(c => c.id === prev.id)) ? prev : firstVisible);
          }
        }
      } else {
        // GHL India Ventures Mode
        const [apiCusts, cCalls, cFollowups, cDeals, cLeads] = await Promise.all([
          getCustomers(tenant?.id).catch(err => {
            console.error('Failed to fetch customers from the database:', err);
            return null;
          }),
          getCalls(tenant?.id).catch(() => null),
          getFollowups(tenant?.id).catch(() => null),
          getDeals(tenant?.id).catch(() => null),
          getLeads(tenant?.id).catch(() => null),
        ]);

        if (apiCusts !== null) setCustomers(apiCusts);
        if (cCalls !== null) setCalls(cCalls);
        if (cFollowups !== null) setFollowups(cFollowups);
        if (cDeals !== null) setDeals(cDeals);
        if (cLeads !== null) setLeads(cLeads);

        const currentCusts = apiCusts ?? customers;
        const userVisibleCusts = isAdmin
          ? currentCusts
          : currentCusts.filter(c =>
            (c.assignedAgentId && (String(c.assignedAgentId) === String(user?.id) || c.assignedAgentId === user?.id)) ||
            (c.assignedAgentName && user?.name && c.assignedAgentName.toLowerCase() === user.name.toLowerCase())
          );
        const firstVisible = userVisibleCusts[0] || currentCusts[0];
        if (firstVisible) {
          setSelectedCustomer(prev => (prev && currentCusts.some(c => c.id === prev.id)) ? prev : firstVisible);
        }
      }
    } catch (err) {
      console.error('Failed to load customers page data', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Synchronize Customer 360 when selected customer changes in Jamin mode
  useEffect(() => {
    if (isJamin && selectedCustomer?.id) {
      void fetchCustomer360(selectedCustomer.id, false);
    } else if (!isJamin) {
      setCustomer360Data(null);
    }
  }, [isJamin, selectedCustomer?.id]);

  useEffect(() => {
    loadData();
    const handleUpdate = () => {
      loadData();
      if (isJamin && selectedCustomer?.id) {
        void fetchCustomer360(selectedCustomer.id, true);
      }
    };
    window.addEventListener('nexus_storage_updated', handleUpdate);
    return () => window.removeEventListener('nexus_storage_updated', handleUpdate);
  }, [tenant?.id, isJamin, selectedCustomer?.id]);

  const agentOptions = Array.from(new Set(scopedCustomers.map(c => c.assignedAgentName)))
    .filter(Boolean)
    .map(name => ({ value: name, label: name }));

  const filteredCustomers = scopedCustomers.filter(c => {
    if (statusFilter !== 'All' && c.status !== statusFilter) return false;
    if (agentFilter !== 'All' && c.assignedAgentName !== agentFilter) return false;
    if (canAssignToIRM) {
      if (assignmentFilter === 'Assigned' && !(c.assignedIrmName || c.assignedIrmId)) return false;
      if (assignmentFilter === 'Unassigned' && (c.assignedIrmName || c.assignedIrmId)) return false;
    }
    return true;
  });

  const isCustomerEligibleForIrm = (c: Customer): boolean => {
    if (!canAssignToIRM) return false;
    if (!c || !c.id || !c.name) return false;
    if (c.status === 'Inactive') return false;
    if (c.assignedIrmName || c.assignedIrmId) return false;
    return true;
  };

  const eligibleUnassignedCustomers = canAssignToIRM
    ? scopedCustomers.filter(isCustomerEligibleForIrm)
    : [];

  const toggleCustomerSelection = (id: string) => {
    setSelectedCustomerIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleCancelAssignMode = () => {
    setIsAssignMode(false);
    setSelectedCustomerIds(new Set());
    setAutoRecommendations([]);
    setIsManualModalOpen(false);
    setIsAutoPreviewModalOpen(false);
  };

  const formatCurrency = (val: number) => {
    if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`;
    if (val >= 100000) return `₹${(val / 100000).toFixed(1)} L`;
    return `₹${val.toLocaleString('en-IN')}`;
  };

  // Build leads lookup map by last 10 digits of phone once per render
  const leadsByPhone = useMemo(() => {
    const map = new Map<string, Lead>();
    (leads || []).forEach(l => {
      const digits = (l.phone || '').replace(/\D/g, '').slice(-10);
      if (digits && !map.has(digits)) {
        map.set(digits, l);
      }
    });
    return map;
  }, [leads]);

  const getInvestmentRange = (c: Customer): string => {
    const checkVal = (v: unknown): string => {
      if (typeof v === 'string' && v.trim()) {
        return v.trim();
      }
      return '';
    };

    // 1. c.customFields?.investmentCapacity
    const c1 = checkVal(c.customFields?.investmentCapacity);
    if (c1) return c1;

    // 2. c.customFields?.budgetRange
    const c2 = checkVal(c.customFields?.budgetRange);
    if (c2) return c2;

    // 3. matching lead from the map (by the last 10 digits of c.phone)
    const digits = (c.phone || '').replace(/\D/g, '').slice(-10);
    const lead = digits ? leadsByPhone.get(digits) : undefined;
    if (lead) {
      const l1 = checkVal(lead.customFields?.investmentCapacity);
      if (l1) return l1;
      const l2 = checkVal(lead.customFields?.budgetRange);
      if (l2) return l2;
    }

    return '';
  };

  const getCustomerCapacityTier = (c: Customer): { tier: 'Premium' | 'Very High' | 'High' | 'Medium' | 'Normal'; label: string } => {
    const raw = getInvestmentRange(c);
    const totalVal = typeof c.totalValue === 'number' ? c.totalValue : 0;

    if (/25\s*Cr|\b250\b/i.test(raw) || totalVal >= 100000000) {
      return { tier: 'Premium', label: raw || '₹10 Cr+ (Premium)' };
    }
    if (/5\s*Cr\s*[-–]\s*10\s*Cr/i.test(raw) || (totalVal >= 50000000 && totalVal < 100000000)) {
      return { tier: 'Very High', label: raw || '₹5–10 Cr (Very High)' };
    }
    if (/3\s*Cr\s*[-–]\s*5\s*Cr/i.test(raw) || (totalVal >= 30000000 && totalVal < 50000000)) {
      return { tier: 'High', label: raw || '₹3–5 Cr (High)' };
    }
    if (/1\s*Cr\s*[-–]\s*3\s*Cr|1\s*Cr\s*[-–]\s*5\s*Cr/i.test(raw) || (totalVal >= 10000000 && totalVal < 30000000)) {
      return { tier: 'Medium', label: raw || '₹1–3 Cr (Medium)' };
    }
    return { tier: 'Normal', label: raw || (totalVal > 0 ? formatCurrency(totalVal) : 'Standard Ticket') };
  };

  const runAutoAssignmentAlgorithm = (custs: Customer[]): AutoRecommendation[] => {
    const liveCountMap: Record<string, number> = {};
    irms.forEach((irm: IrmProfile) => {
      liveCountMap[irm.id] = customers.filter(c => c.assignedIrmName === irm.name || c.assignedIrmId === irm.id).length;
    });

    const tierPriority = { Premium: 5, 'Very High': 4, High: 3, Medium: 2, Normal: 1 };
    const sortedCusts = [...custs].sort((a, b) => {
      const tA = getCustomerCapacityTier(a).tier;
      const tB = getCustomerCapacityTier(b).tier;
      return tierPriority[tB] - tierPriority[tA];
    });

    const recommendations: AutoRecommendation[] = [];

    sortedCusts.forEach(c => {
      const { tier, label } = getCustomerCapacityTier(c);
      const availableIrms = irms.filter((i: IrmProfile) => i.status === 'Available');
      const pool = availableIrms.length > 0 ? availableIrms : irms;

      let chosenIrm: IrmProfile;
      let reason: string;

      if (tier === 'Premium') {
        const expIrms = pool.filter((i: IrmProfile) => i.experienceLevel === 'Experienced');
        const candidatePool = expIrms.length > 0 ? expIrms : pool;
        chosenIrm = candidatePool.reduce((min: IrmProfile, curr: IrmProfile) => liveCountMap[curr.id] < liveCountMap[min.id] ? curr : min, candidatePool[0]);
        reason = 'Premium → Experienced (Capacity Match)';
      } else if (tier === 'Very High') {
        const expIrms = pool.filter((i: IrmProfile) => i.experienceLevel === 'Experienced');
        const candidatePool = expIrms.length > 0 ? expIrms : pool;
        chosenIrm = candidatePool.reduce((min: IrmProfile, curr: IrmProfile) => liveCountMap[curr.id] < liveCountMap[min.id] ? curr : min, candidatePool[0]);
        reason = 'Very High → Experienced (High Performance)';
      } else if (tier === 'High') {
        const highIrms = pool.filter((i: IrmProfile) => i.experienceLevel === 'Experienced' || i.experienceLevel === 'Mid-Level');
        const candidatePool = highIrms.length > 0 ? highIrms : pool;
        chosenIrm = candidatePool.reduce((min: IrmProfile, curr: IrmProfile) => liveCountMap[curr.id] < liveCountMap[min.id] ? curr : min, candidatePool[0]);
        reason = chosenIrm.experienceLevel === 'Experienced'
          ? 'High-value → Experienced'
          : 'High-value → Mid-Level (Fair Distribution)';
      } else if (tier === 'Medium') {
        const fresherMid = pool.filter((i: IrmProfile) => i.experienceLevel === 'Fresher' || i.experienceLevel === 'Mid-Level');
        const candidatePool = fresherMid.length > 0 ? fresherMid : pool;
        chosenIrm = candidatePool.reduce((min: IrmProfile, curr: IrmProfile) => liveCountMap[curr.id] < liveCountMap[min.id] ? curr : min, candidatePool[0]);
        reason = chosenIrm.experienceLevel === 'Fresher'
          ? 'Medium-value → Fresher (Balanced Workload)'
          : 'Medium-value → Mid-Level (Fair Distribution)';
      } else {
        chosenIrm = pool.reduce((min: IrmProfile, curr: IrmProfile) => liveCountMap[curr.id] < liveCountMap[min.id] ? curr : min, pool[0]);
        reason = 'Standard Ticket → Balanced Workload';
      }

      liveCountMap[chosenIrm.id] = (liveCountMap[chosenIrm.id] || 0) + 1;

      recommendations.push({
        customerId: c.id,
        customerName: c.name,
        investmentDisplay: label,
        tier,
        recommendedIrmId: chosenIrm.id,
        recommendedIrmName: chosenIrm.name,
        matchReason: reason,
        isEdited: false,
      });
    });

    return recommendations;
  };

  const handleSendAssignment = () => {
    if (assignSubMode === 'manual') {
      if (selectedCustomerIds.size === 0) return;
      const selectedCusts = scopedCustomers.filter(c => selectedCustomerIds.has(c.id) && isCustomerEligibleForIrm(c));
      if (selectedCusts.length === 0) return;

      setSelectedIrmId(irms[0]?.id || '');
      setIsManualModalOpen(true);
    } else {
      if (eligibleUnassignedCustomers.length === 0) return;
      const recs = runAutoAssignmentAlgorithm(eligibleUnassignedCustomers);
      setAutoRecommendations(recs);
      setIsAutoPreviewModalOpen(true);
    }
  };

  const handleConfirmManualAssignment = async () => {
    const selectedIrm = irms.find((i: IrmProfile) => i.id === selectedIrmId);
    if (!selectedIrm) return;

    let assignedCount = 0;
    const allLatest = customers;
    const toUpdate: Customer[] = [];

    selectedCustomerIds.forEach(cid => {
      const cust = allLatest.find((c: Customer) => c.id === cid) || customers.find((c: Customer) => c.id === cid);
      if (cust && isCustomerEligibleForIrm(cust)) {
        const updated: Customer = {
          ...cust,
          assignedIrmId: selectedIrm.id,
          assignedIrmName: selectedIrm.name,
          assignedIrmAt: new Date().toISOString(),
          notes: `${cust.notes ? cust.notes + '\n\n' : ''}[${new Date().toLocaleDateString()}] Assigned to IRM: ${selectedIrm.name} by ${user?.name || 'Sales Executive'}`,
        };
        toUpdate.push(updated);
        assignedCount++;
      }
    });

    for (const u of toUpdate) {
      await apiSaveCustomer(u).catch(console.error);
    }

    setIsManualModalOpen(false);
    setIsAssignMode(false);
    setSelectedCustomerIds(new Set());
    loadData();
    showToast(`Successfully assigned ${assignedCount} customer(s) to ${selectedIrm.name}!`);
  };

  const handleConfirmAutoAssignment = async () => {
    let assignedCount = 0;
    const allLatest = customers;
    const toUpdate: Customer[] = [];

    autoRecommendations.forEach(rec => {
      const cust = allLatest.find((c: Customer) => c.id === rec.customerId) || customers.find((c: Customer) => c.id === rec.customerId);
      if (cust && isCustomerEligibleForIrm(cust)) {
        const updated: Customer = {
          ...cust,
          assignedIrmId: rec.recommendedIrmId,
          assignedIrmName: rec.recommendedIrmName,
          assignedIrmAt: new Date().toISOString(),
          notes: `${cust.notes ? cust.notes + '\n\n' : ''}[${new Date().toLocaleDateString()}] Auto-assigned to IRM: ${rec.recommendedIrmName} (${rec.matchReason})`,
        };
        toUpdate.push(updated);
        assignedCount++;
      }
    });

    for (const u of toUpdate) {
      await apiSaveCustomer(u).catch(console.error);
    }

    setIsAutoPreviewModalOpen(false);
    setIsAssignMode(false);
    setSelectedCustomerIds(new Set());
    setAutoRecommendations([]);
    loadData();
    showToast(`Successfully confirmed auto-assignment for ${assignedCount} customer(s)!`);
  };

  const handleUpdateSingleRecommendation = (customerId: string, newIrmId: string) => {
    const newIrm = irms.find((i: IrmProfile) => i.id === newIrmId);
    if (!newIrm) return;
    setAutoRecommendations(prev =>
      prev.map(rec => {
        if (rec.customerId === customerId) {
          return {
            ...rec,
            recommendedIrmId: newIrm.id,
            recommendedIrmName: newIrm.name,
            matchReason: `${rec.tier} → ${newIrm.name} (Manually Adjusted)`,
            isEdited: true,
          };
        }
        return rec;
      })
    );
    setEditingRecommendationCustomerId(null);
  };

  // Filter linked records for selected customer by stable IDs with phone fallback
  const customerCalls = useMemo(() => {
    if (isJamin && customer360Data?.calls) {
      return customer360Data.calls.map(c => ({
        id: String(c.id),
        agentId: c.agentId ? String(c.agentId) : undefined,
        agentName: c.agentName || 'Agent',
        contactName: c.contactName,
        contactPhone: c.contactPhone,
        direction: (c.direction?.toLowerCase() === 'inbound' ? 'inbound' : 'outbound') as 'inbound' | 'outbound',
        duration: c.duration || 0,
        disposition: c.disposition || 'Completed',
        transcription: c.notes || undefined,
        notes: c.notes || '',
        timestamp: c.timestamp ? new Date(c.timestamp).toLocaleString('en-IN') : '',
        status: 'ended' as const,
        leadId: c.leadId ? String(c.leadId) : undefined,
        customerId: c.customerId ? String(c.customerId) : undefined,
      }));
    }
    if (!selectedCustomer) return [];
    const custIdClean = String(selectedCustomer.id || '').replace(/\D/g, '');
    const custPhone10 = (selectedCustomer.phone || '').replace(/\D/g, '').slice(-10);

    return calls.filter(c => {
      // 1. Primary linkage: CustomerId
      if (c.customerId && String(c.customerId).replace(/\D/g, '') === custIdClean) return true;
      // 2. Secondary fallback: Phone
      const callPhone10 = (c.contactPhone || '').replace(/\D/g, '').slice(-10);
      if (custPhone10 && callPhone10 && custPhone10 === callPhone10) return true;
      return false;
    });
  }, [isJamin, customer360Data, calls, selectedCustomer]);

  const customerFollowups = useMemo(() => {
    if (isJamin && customer360Data?.followups) {
      return customer360Data.followups.map(f => ({
        id: String(f.id),
        companyId: String(f.companyId || '2'),
        contactId: String(f.customerId || f.contactId || selectedCustomer?.id || ''),
        contactName: f.contactName || selectedCustomer?.name || '',
        contactPhone: f.contactPhone || selectedCustomer?.phone || '',
        contactType: (f.contactType as any) || 'customer',
        scheduledAt: f.scheduledAt ? new Date(f.scheduledAt).toISOString() : '',
        scheduledDate: f.scheduledAt ? new Date(f.scheduledAt).toISOString().split('T')[0] : '',
        scheduledTime: f.scheduledAt ? new Date(f.scheduledAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '',
        priority: (f.priority as any) || 'Medium',
        status: (f.status as any) || 'Pending',
        followupType: 'call' as const,
        notes: f.notes || '',
        assignedAgentId: String(f.assignedAgentId || ''),
        assignedAgentName: f.assignedAgentName || 'Agent',
        completedAt: f.completedAt ? new Date(f.completedAt).toISOString() : undefined,
      }));
    }
    if (!selectedCustomer) return [];
    const custIdClean = String(selectedCustomer.id || '').replace(/\D/g, '');
    const custPhone10 = (selectedCustomer.phone || '').replace(/\D/g, '').slice(-10);

    return followups.filter(f => {
      // 1. Primary linkage: CustomerId / ContactId
      if (f.contactType === 'customer' && String(f.contactId) === String(selectedCustomer.id)) return true;
      if (f.customerId && String(f.customerId).replace(/\D/g, '') === custIdClean) return true;
      // 2. Secondary fallback: Phone
      const fPhone10 = (f.contactPhone || '').replace(/\D/g, '').slice(-10);
      if (custPhone10 && fPhone10 && custPhone10 === fPhone10) return true;
      return false;
    });
  }, [isJamin, customer360Data, followups, selectedCustomer]);

  const customerDeals = useMemo(() => {
    if (!selectedCustomer) return [];
    const custIdClean = String(selectedCustomer.id || '').replace('cust-', '').replace('db-', '').trim();
    return deals.filter(d => {
      if (!d.customerId) return false;
      const dealCustId = String(d.customerId).replace('cust-', '').replace('db-', '').trim();
      return dealCustId === custIdClean;
    });
  }, [deals, selectedCustomer]);

  const customerBookings = useMemo(() => {
    if (isJamin && customer360Data?.bookings) {
      return customer360Data.bookings;
    }
    if (!selectedCustomer) return [];
    const custIdClean = String(selectedCustomer.id || '').replace(/\D/g, '');
    const custPhone10 = (selectedCustomer.phone || '').replace(/\D/g, '').slice(-10);
    const custName = (selectedCustomer.name || '').trim().toLowerCase();

    return bookings.filter(b => {
      // 1. Primary: Direct or clean customerId match
      if (b.customerId) {
        if (String(b.customerId) === String(selectedCustomer.id)) return true;
        const bCustIdClean = String(b.customerId).replace(/\D/g, '');
        if (custIdClean && bCustIdClean && custIdClean === bCustIdClean) return true;
      }
      // 2. Lead match if customer originated from an associated lead
      if (b.leadId) {
        const bLeadClean = String(b.leadId).replace(/\D/g, '');
        if (custPhone10 && leadsByPhone.has(custPhone10)) {
          const matchedLead = leadsByPhone.get(custPhone10);
          if (matchedLead && String(matchedLead.id).replace(/\D/g, '') === bLeadClean) {
            return true;
          }
        }
      }
      // 3. Fallback: Phone match (last 10 digits)
      const bPhone10 = (b.customerPhone || b.phone || '').replace(/\D/g, '').slice(-10);
      if (custPhone10 && bPhone10 && custPhone10 === bPhone10) return true;

      // 4. Fallback: Exact customer name match
      if (custName && b.customerName && b.customerName.trim().toLowerCase() === custName) {
        if (custPhone10 && bPhone10) {
          return custPhone10 === bPhone10;
        }
        return true;
      }

      return false;
    });
  }, [isJamin, customer360Data, bookings, selectedCustomer, leadsByPhone]);

  const customerSiteVisits = useMemo(() => {
    if (isJamin && customer360Data?.siteVisits) {
      return customer360Data.siteVisits;
    }
    if (!selectedCustomer || !isJamin) return [];
    const custIdClean = String(selectedCustomer.id || '').replace(/\D/g, '');
    const custPhone10 = (selectedCustomer.phone || '').replace(/\D/g, '').slice(-10);

    return apiSiteVisits.filter(v => {
      // 1. Primary: CustomerId
      if (v.customerId && String(v.customerId).replace(/\D/g, '') === custIdClean) return true;
      if (String(v.customerId || '') === String(selectedCustomer.id)) return true;
      // 2. Fallback: phone
      const vPhone10 = (v.customerPhone || '').replace(/\D/g, '').slice(-10);
      if (custPhone10 && vPhone10 && custPhone10 === vPhone10) return true;
      return false;
    });
  }, [isJamin, customer360Data, selectedCustomer, apiSiteVisits]);

  // Authoritative Customer 360 Financial Metrics derived from actual booking and payment records
  // Maintains active contract value, verified receipts, refunds, net received, and outstanding balance distinct
  const selectedCustomerFinancials = useMemo(() => {
    if (isJamin && customer360Data) {
      const activeBookingsCount = (customer360Data.bookings || []).filter(b => b.status !== 'Cancelled' && b.status !== 'Voided').length;
      return {
        contractValue: customer360Data.totalContractValue ?? 0,
        verifiedReceipts: customer360Data.totalVerifiedReceipts ?? 0,
        totalRefunds: customer360Data.totalRefunds ?? 0,
        netCashReceived: customer360Data.totalNetCashReceived ?? 0,
        contractBalance: customer360Data.totalContractBalance ?? 0,
        totalBookings: (customer360Data.bookings || []).length,
        activeBookingsCount,
      };
    }

    const activeBookings = customerBookings.filter(b => b.status !== 'Cancelled' && b.status !== 'Voided');
    const contractValue = activeBookings.reduce((sum, b) => sum + (b.contractValue ?? b.totalPlotPrice ?? b.totalAmount ?? 0), 0);
    const verifiedReceipts = customerBookings.reduce((sum, b) => {
      const v = b.verifiedReceipts ?? ((b.status === 'Token Paid' || b.paymentStatus === 'Verified') ? (b.tokenAmountPaid ?? b.bookingAmount ?? 0) : 0);
      return sum + v;
    }, 0);
    const totalRefunds = customerBookings.reduce((sum, b) => sum + (b.totalRefunds ?? b.refundAmount ?? 0), 0);
    const netCashReceived = Math.max(0, verifiedReceipts - totalRefunds);
    const contractBalance = activeBookings.reduce((sum, b) => {
      const bContract = b.contractValue ?? b.totalPlotPrice ?? b.totalAmount ?? 0;
      const bPaid = b.verifiedReceipts ?? ((b.status === 'Token Paid' || b.paymentStatus === 'Verified') ? (b.tokenAmountPaid ?? b.bookingAmount ?? 0) : 0);
      return sum + Math.max(0, bContract - bPaid);
    }, 0);

    return {
      contractValue,
      verifiedReceipts,
      totalRefunds,
      netCashReceived,
      contractBalance,
      totalBookings: customerBookings.length,
      activeBookingsCount: activeBookings.length,
    };
  }, [isJamin, customer360Data, customerBookings]);

  // Progressive Disclosure: Track expanded booking cards in Customer 360
  const [expandedBookingIds, setExpandedBookingIds] = useState<Record<string | number, boolean>>({});

  const toggleBookingExpand = (id: string | number) => {
    setExpandedBookingIds(prev => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleExpandAllBookings = () => {
    const allExpanded = customerBookings.length > 0 && customerBookings.every(b => expandedBookingIds[b.id]);
    const next: Record<string | number, boolean> = {};
    customerBookings.forEach(b => {
      next[b.id] = !allExpanded;
    });
    setExpandedBookingIds(next);
  };

  const handleOpenBookingDetails = (bookingId: string | number) => {
    setExpandedBookingIds(prev => ({ ...prev, [bookingId]: true }));
    setActiveTab('bookings');
  };

  // Jamin Bazaar: Site Visit scheduling state
  const [isSiteVisitModalOpen, setIsSiteVisitModalOpen] = useState(false);
  const getTomorrowDate = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  };

  const [svProjectId, setSvProjectId] = useState('');
  const [svPlotId, setSvPlotId] = useState('');
  const [svProjectsList, setSvProjectsList] = useState<any[]>([]);
  const [svPlotsList, setSvPlotsList] = useState<any[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);
  const [isLoadingPlots, setIsLoadingPlots] = useState(false);
  const [svDate, setSvDate] = useState(getTomorrowDate);
  const [svTimeSlot, setSvTimeSlot] = useState('11:00 AM');
  const [svHostAgent, setSvHostAgent] = useState('');
  const [svNotes, setSvNotes] = useState('');
  const [svError, setSvError] = useState('');
  const [isSubmittingSiteVisit, setIsSubmittingSiteVisit] = useState(false);
  const [jaminAgents, setJaminAgents] = useState<Array<{ id: string; name: string; email: string }>>([]);

  useEffect(() => {
    if (isJamin) {
      jaminApiService.getAgents().then(data => {
        if (data && data.length > 0) {
          setJaminAgents(data.map(a => ({ id: String(a.id), name: a.name, email: a.email })));
        }
      }).catch(err => console.warn('Failed to load Jamin agents:', err));

      jaminApiService.getProjects().then(projs => {
        setSvProjectsList(projs || []);
      }).catch(err => console.warn('Failed to load Jamin projects:', err));

      const fetchSiteVisits = () => {
        jaminApiService.getSiteVisits(true).then(visits => {
          if (visits && visits.length > 0) {
            setApiSiteVisits(visits);
          }
        }).catch(err => console.warn('Failed to load Jamin site visits in Customers:', err));
      };
      fetchSiteVisits();
      let debounceTimer: any = null;
      const debouncedFetchSiteVisits = () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          fetchSiteVisits();
        }, 350);
      };
      window.addEventListener('nexus_storage_updated', debouncedFetchSiteVisits);
      return () => {
        clearTimeout(debounceTimer);
        window.removeEventListener('nexus_storage_updated', debouncedFetchSiteVisits);
      };
    }
  }, [isJamin]);

  // Display only eligible plots according to live inventory and booking rules
  const svEligiblePlots = useMemo(() => {
    if (!svProjectId || !Array.isArray(svPlotsList)) return [];
    return svPlotsList.filter(p => {
      if (String(p.projectId) !== String(svProjectId)) return false;
      const status = (p.status || '').trim().toLowerCase();
      // Plot is eligible only if Available (not Booked, Sold, Registered, Blocked, or on Hold)
      return status === 'available';
    });
  }, [svProjectId, svPlotsList]);

  const handleOpenScheduleSiteVisit = async () => {
    setSvError('');
    setIsSubmittingSiteVisit(false);
    setSvPlotId('');
    setSvDate(getTomorrowDate());
    setSvTimeSlot('11:00 AM');
    setSvHostAgent(selectedCustomer?.assignedAgentName || user?.name || (jaminAgents[0]?.name || 'Agent'));
    setSvNotes('');

    setIsLoadingProjects(true);
    try {
      const projs = await jaminApiService.getProjects();
      setSvProjectsList(projs || []);
      
      const chosenProjId = svProjectId && projs.some((p: any) => String(p.id) === String(svProjectId))
        ? svProjectId
        : (projs && projs.length > 0 ? String(projs[0].id) : '');
      
      setSvProjectId(chosenProjId);

      if (chosenProjId) {
        setIsLoadingPlots(true);
        const plots = await jaminApiService.getPlots(chosenProjId);
        setSvPlotsList(plots || []);
        setIsLoadingPlots(false);
      } else {
        setSvPlotsList([]);
      }
    } catch (err) {
      console.error('Failed to load live project/plot inventory for site visit modal:', err);
    } finally {
      setIsLoadingProjects(false);
    }

    setIsSiteVisitModalOpen(true);
  };

  const handleSiteVisitProjectChange = async (newProjId: string) => {
    setSvProjectId(newProjId);
    setSvPlotId('');
    setSvError('');
    if (newProjId) {
      setIsLoadingPlots(true);
      try {
        const plots = await jaminApiService.getPlots(newProjId);
        setSvPlotsList(plots || []);
      } catch (err) {
        console.error(`Failed to load plots for project ${newProjId}:`, err);
        setSvPlotsList([]);
      } finally {
        setIsLoadingPlots(false);
      }
    } else {
      setSvPlotsList([]);
    }
  };

  const [isScheduleFollowupModalOpen, setIsScheduleFollowupModalOpen] = useState(false);
  const [custFollowupDate, setCustFollowupDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  });
  const [custFollowupTime, setCustFollowupTime] = useState('11:00 AM');
  const [custFollowupType, setCustFollowupType] = useState<'call' | 'whatsapp' | 'meeting'>('call');
  const [custFollowupPriority, setCustFollowupPriority] = useState<'Low' | 'Medium' | 'High'>('Medium');
  const [custFollowupNotes, setCustFollowupNotes] = useState('');
  const [isSubmittingCustFollowup, setIsSubmittingCustFollowup] = useState(false);

  const handleSaveCustomerFollowup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) return;
    setIsSubmittingCustFollowup(true);
    try {
      const timeParts = custFollowupTime.match(/(\d+):(\d+)\s*(AM|PM)?/i);
      let hours = timeParts ? parseInt(timeParts[1], 10) : 11;
      const mins = timeParts ? parseInt(timeParts[2], 10) : 0;
      const ampm = timeParts && timeParts[3] ? timeParts[3].toUpperCase() : 'AM';
      if (ampm === 'PM' && hours < 12) hours += 12;
      if (ampm === 'AM' && hours === 12) hours = 0;
      const dt = new Date(custFollowupDate);
      dt.setHours(hours, mins, 0, 0);
      const isoScheduledAt = dt.toISOString();

      const newF: Followup = {
        id: `fu-${Date.now()}`,
        companyId: selectedCustomer.companyId || tenant?.id || (isJamin ? 't-jamin-02' : 't-ghl-01'),
        contactId: String(selectedCustomer.id),
        contactName: selectedCustomer.name,
        contactPhone: selectedCustomer.phone,
        contactType: 'customer',
        scheduledAt: isoScheduledAt,
        scheduledDate: custFollowupDate,
        scheduledTime: custFollowupTime,
        priority: custFollowupPriority,
        status: 'Pending',
        followupType: custFollowupType,
        notes: custFollowupNotes.trim() || `Follow-up with customer ${selectedCustomer.name}`,
        assignedAgentId: selectedCustomer.assignedAgentId || (user?.id ? String(user.id) : (isJamin ? '2' : '1')),
        assignedAgentName: selectedCustomer.assignedAgentName || user?.name || (isJamin ? 'Jamin Agent' : 'Agent'),
      };

      await apiSaveFollowup(newF);
      showToast('✓ Follow-up scheduled successfully in database!');
      setIsScheduleFollowupModalOpen(false);
      setCustFollowupNotes('');
      await loadData();
    } catch (err) {
      console.error('Failed to schedule customer followup:', err);
      showToast('Failed to schedule follow-up.');
    } finally {
      setIsSubmittingCustFollowup(false);
    }
  };

  const handleSaveCustomerSiteVisit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) {
      setSvError('Please select a customer first.');
      return;
    }

    if (!selectedCustomer.phone?.trim()) {
      setSvError('Customer must have a valid mobile number to schedule a site visit.');
      return;
    }

    if (!svProjectId) {
      setSvError('Please select a project from the available live inventory.');
      return;
    }

    if (!svDate) {
      setSvError('Please select a valid visit date.');
      return;
    }

    const todayStr = new Date().toISOString().split('T')[0];
    if (svDate < todayStr) {
      setSvError('Visit date cannot be in the past.');
      return;
    }

    const selProj = svProjectsList.find(p => String(p.id) === String(svProjectId));
    if (!selProj) {
      setSvError('Selected project was not found in the live catalog. Please refresh.');
      return;
    }

    const selPlot = svPlotId ? svEligiblePlots.find(p => String(p.id) === String(svPlotId)) : null;
    if (svPlotId && !selPlot) {
      setSvError('Selected plot is no longer available. Please choose another plot or schedule a General Tour.');
      return;
    }

    const hostAg = jaminAgents.find(a => a.name === svHostAgent || a.id === svHostAgent);

    const dateFormatted = (() => {
      try {
        const [y, m, d] = svDate.split('-');
        const dateObj = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
        return `${dateObj.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })} • ${svTimeSlot}`;
      } catch {
        return `${svDate} • ${svTimeSlot}`;
      }
    })();

    const trimmedNotes = svNotes.trim();

    setIsSubmittingSiteVisit(true);
    setSvError('');

    try {
      const created = isJamin ? await jaminApiService.scheduleSiteVisit({
        customerId: Number(selectedCustomer.id),
        contactType: 'customer',
        customerName: selectedCustomer.name.trim(),
        customerPhone: selectedCustomer.phone.trim(),
        projectId: Number(svProjectId),
        plotId: selPlot ? Number(selPlot.id) : undefined,
        projectName: selProj.name,
        plotNumber: selPlot?.plotNumber || undefined,
        scheduledAt: dateFormatted,
        assignedAgentId: Number(hostAg?.id || selectedCustomer.assignedAgentId || user?.id) || undefined,
        assignedAgentName: hostAg?.name || svHostAgent || user?.name || 'Agent',
        visitorNote: trimmedNotes || undefined,
      }) : null;

      if (!created) {
        throw new Error('The site visit could not be saved. Server returned an empty response.');
      }

      // Backend confirmed success: update state and local store
      setApiSiteVisits(prev => [created, ...prev.filter(v => v.id !== created.id)]);

      storageService.addAuditLog({
        id: `aud-${Date.now()}`,
        timestamp: 'Just now',
        actorName: user?.name || 'Agent',
        actorEmail: user?.email || '',
        action: 'SITE_VISIT_SCHEDULED',
        entityType: 'SiteVisit',
        entityId: created.id,
        companyId: tenant?.id || 't-jamin-02',
        companyName: tenant?.name || 'Jamin Bazaar',
        details: `Scheduled site visit for customer ${selectedCustomer.name} at ${selProj.name}${selPlot?.plotNumber ? ` (Plot ${selPlot.plotNumber})` : ' (General Tour)'}.`,
      });

      setIsSiteVisitModalOpen(false);
      loadData();
      window.dispatchEvent(new Event('nexus_storage_updated'));
      showToast(`✓ Site visit scheduled for ${selectedCustomer.name}!`);
    } catch (err: any) {
      console.error('Failed to schedule site visit:', err);
      setSvError(err?.message || 'The site visit could not be saved. Check the selected customer and company, then try again.');
    } finally {
      setIsSubmittingSiteVisit(false);
    }
  };

  const resetAddForm = () => {
    setNewName('');
    setNewPhone('');
    setNewEmail('');
    setNewLocation('');
    setNewStatus('Active');
    setNewAgentId(String(user?.id || ''));
    setNewCustomFields({});
    setAddErrors({});
  };

  const handleAddCustomer = async () => {
    const errors: Record<string, string | undefined> = {};
    if (!newName.trim()) errors.name = 'Name is required.';
    if (!newPhone.trim()) errors.phone = 'Phone is required.';
    const customerFieldDefs = getCustomFieldDefinitions(tenant?.id)
      .filter(def => def.active !== false && def.module === 'customers');
    const requiredCustomFields = customerFieldDefs.filter(def => def.required);
    requiredCustomFields.forEach(def => {
      const key = def.fieldKey || def.id;
      const value = newCustomFields[key] ?? def.defaultValue ?? '';
      const valueText = String(value).trim();
      const invalidOption = def.fieldType === 'select' && Boolean(def.options?.length) && !def.options?.includes(valueText);
      if (!valueText || invalidOption) errors[`custom:${key}`] = `${def.label || key} is required.`;
    });
    if (Object.keys(errors).length > 0) {
      setAddErrors(errors);
      return;
    }
    setIsSubmittingAdd(true);
    const newCustomer: import('../../types').Customer = {
      id: `cust-${Date.now()}`,
      companyId: tenant?.id || '',
      name: newName.trim(),
      phone: newPhone.trim(),
      email: newEmail.trim(),
      status: newStatus,
      assignedAgentId: newAgentId || String(user?.id || ''),
      assignedAgentName: availableAgents.find(a => a.id === newAgentId)?.name || user?.name || '',
      location: newLocation.trim(),
      lastContacted: new Date().toISOString().split('T')[0],
      openDealsCount: 0,
      totalValue: 0,
      createdAt: new Date().toISOString().split('T')[0],
      notes: '',
      customFields: Object.fromEntries(customerFieldDefs.map(def => {
        const key = def.fieldKey || def.id;
        return [key, String(newCustomFields[key] ?? def.defaultValue ?? '')];
      })),
    };
    try {
      const saved = await apiSaveCustomer(newCustomer);
      setSelectedCustomer(saved);
      setIsAddModalOpen(false);
      resetAddForm();
      await loadData();
      showToast(`Customer ${saved.name} created successfully.`);
    } catch (error) {
      console.error('Failed to create customer:', error);
      showToast(error instanceof Error ? error.message : 'Could not create customer.');
    } finally {
      setIsSubmittingAdd(false);
    }
  };

  const getCustomerValueDisplay = (c: Customer): string => {
    if (isJamin) {
      if (selectedCustomer && String(selectedCustomer.id) === String(c.id) && customer360Data) {
        if (customer360Data.totalContractValue !== undefined && customer360Data.totalContractValue > 0) {
          return formatCurrency(customer360Data.totalContractValue);
        }
      }
      const cCleanId = String(c.id).replace(/\D/g, '');
      const cPhone10 = (c.phone || '').replace(/\D/g, '').slice(-10);
      const custBookings = (isJamin && customer360Data && String(selectedCustomer?.id) === String(c.id) && customer360Data.bookings)
        ? customer360Data.bookings
        : bookings.filter(b => {
          if (b.customerId && (String(b.customerId) === String(c.id) || String(b.customerId).replace(/\D/g, '') === cCleanId)) return true;
          const bPhone10 = (b.customerPhone || b.phone || '').replace(/\D/g, '').slice(-10);
          return cPhone10 && bPhone10 && cPhone10 === bPhone10;
        });
      const activeBookings = custBookings.filter((b: any) => b.status !== 'Cancelled' && b.status !== 'Voided');
      if (activeBookings.length > 0) {
        const total = activeBookings.reduce((sum: number, b: any) => sum + (b.contractValue ?? b.totalPlotPrice ?? b.totalAmount ?? 0), 0);
        return formatCurrency(total);
      }
    }
    const range = getInvestmentRange(c);
    if (range) return range;
    if (typeof c.totalValue === 'number' && c.totalValue > 0) {
      return formatCurrency(c.totalValue);
    }
    return '—';
  };

  const rawEvents: TimelineEvent[] = [];

  if (selectedCustomer) {
    customerCalls.forEach(c => {
      const outcomeText = !c.disposition || c.disposition === 'Skipped' ? 'Wrap-up Skipped' : c.disposition;
      rawEvents.push({
        id: c.id,
        type: 'call',
        title: `${c.direction === 'outbound' ? 'Outbound' : 'Inbound'} Call — ${outcomeText}`,
        description: c.transcription || undefined,
        timestamp: c.timestamp,
        actorName: c.agentName,
      });
    });

    customerFollowups.forEach(f => {
      rawEvents.push({
        id: f.id,
        type: 'followup',
        title: f.status === 'Completed' ? 'Follow-up Completed' : 'Follow-up Scheduled',
        description: f.notes,
        timestamp: f.scheduledAt,
        actorName: f.assignedAgentName,
      });
    });

    customerDeals.forEach(d => {
      rawEvents.push({
        id: d.id,
        type: 'status_change',
        title: `Deal Created — ${d.title}`,
        description: `Stage: ${d.stage} • Value: ${formatCurrency(d.value)}`,
        timestamp: d.createdAt,
        actorName: d.assignedAgentName,
      });
    });

    customerBookings.forEach(b => {
      const bDate = b.bookingDate || b.createdAt || selectedCustomer.createdAt;
      const plotTxt = b.plotNumber ? `Plot ${b.plotNumber}` : 'Plot';
      const projTxt = b.projectName || 'Project';
      const totalAmt = b.totalPlotPrice ?? b.totalAmount ?? 0;
      const tokenAmt = b.tokenAmountPaid ?? b.bookingAmount ?? 0;
      const statusTxt = b.status || 'Token Paid';

      rawEvents.push({
        id: `bkg-${b.id}`,
        type: 'status_change',
        title: `Property Booked — ${plotTxt} (${projTxt})`,
        description: `Status: ${statusTxt} • Total Value: ${formatCurrency(totalAmt)} • Token Paid: ${formatCurrency(tokenAmt)}${b.paymentMode ? ` • Mode: ${b.paymentMode}` : ''}`,
        timestamp: bDate,
        actorName: b.assignedAgentName || b.agentName || selectedCustomer.assignedAgentName,
      });
    });

    customerSiteVisits.forEach(sv => {
      rawEvents.push({
        id: `sv-${sv.id}`,
        type: 'status_change',
        title: `Site Visit — ${sv.projectName} (${sv.plotNumber || 'General Tour'})`,
        description: `Status: ${sv.status} • Scheduled: ${sv.scheduledAt}${sv.visitorNote ? ` • Note: ${sv.visitorNote}` : ''}`,
        timestamp: sv.scheduledAt || selectedCustomer.createdAt,
        actorName: sv.assignedAgentName,
      });
    });

    rawEvents.push({
      id: `ev-create-${selectedCustomer.id}`,
      type: 'note',
      title: 'Customer Account Created',
      timestamp: selectedCustomer.createdAt,
      actorName: selectedCustomer.assignedAgentName,
    });
  }

  const timelineEvents = rawEvents.sort((a, b) => {
    const parseTime = (ts: string) => {
      const parsed = Date.parse(ts);
      return isNaN(parsed) ? 0 : parsed;
    };
    return parseTime(a.timestamp) - parseTime(b.timestamp);
  });

  return (
    <div className="customers-page">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <Building2 size={24} color="var(--primary-600)" /> Customer 360 Profile
          </h1>
          <p className="page-subtitle">
            {isJamin
              ? `Unified customer view across plots, bookings, site visits, and timeline for ${tenant?.name || 'Jamin Bazaar'}.`
              : `Unified contact view across calls, deals, timeline, and documents for ${tenant?.name || 'GHL India Ventures'}.`}
          </p>
        </div>

        {/* Top Action Area: Assign Leads to IRM (GHL India Ventures Sales Executive only) */}
        {canAssignToIRM && (
          <div className="customer-top-actions">
            {!isAssignMode ? (
              <button
                type="button"
                className="btn btn-primary customers-btn-assign-entry"
                onClick={() => {
                  setIsAssignMode(true);
                  setSelectedCustomerIds(new Set());
                }}
              >
                <Users size={14} /> Assign Leads to IRM
              </button>
            ) : (
              <div className="assign-mode-toolbar">
                <div className="assign-mode-segmented">
                  <button
                    type="button"
                    className={`assign-seg-btn ${assignSubMode === 'manual' ? 'active' : ''}`}
                    onClick={() => setAssignSubMode('manual')}
                  >
                    Manual
                  </button>
                  <button
                    type="button"
                    className={`assign-seg-btn ${assignSubMode === 'auto' ? 'active' : ''}`}
                    onClick={() => setAssignSubMode('auto')}
                  >
                    Auto
                  </button>
                </div>

                <span className="assign-counter-badge">
                  {assignSubMode === 'manual'
                    ? `${selectedCustomerIds.size} customer${selectedCustomerIds.size !== 1 ? 's' : ''} selected`
                    : eligibleUnassignedCustomers.length > 0
                      ? `${eligibleUnassignedCustomers.length} eligible customer${eligibleUnassignedCustomers.length !== 1 ? 's' : ''}`
                      : 'No unassigned customers available for automatic assignment.'}
                </span>

                <button
                  type="button"
                  className="btn btn-primary btn-sm assign-send-btn"
                  disabled={assignSubMode === 'manual' ? selectedCustomerIds.size === 0 : eligibleUnassignedCustomers.length === 0}
                  onClick={handleSendAssignment}
                >
                  <Send size={13} /> Send
                </button>

                <button
                  type="button"
                  className="btn btn-secondary btn-sm assign-cancel-btn"
                  onClick={handleCancelAssignMode}
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Customer 360 Split View: List on left, Full 360 on right */}
      <div className="customers-split-layout">
        {/* Left: Customer Directory */}
        <div className="customers-sidebar">
          <div className="card customers-sidebar-card">
            <div className="customers-sidebar-header">
              <h3 className="customers-sidebar-title">Customer Accounts</h3>
              <button
                className="btn btn-primary btn-sm customers-btn-new"
                onClick={() => { resetAddForm(); setIsAddModalOpen(true); }}
              >
                <Plus size={13} /> New Customer
              </button>
            </div>

            <div className="customers-filter-row">
              {/* Filters Label */}
              <span className="customers-filter-label">
                <Filter size={13} />
                Filters:
              </span>

              {/* Status Filter */}
              <div className="customers-filter-group">
                <label
                  htmlFor="filter-customer-status"
                  className="customers-filter-tag"
                >
                  Status:
                </label>
                <select
                  id="filter-customer-status"
                  className={`form-select customers-filter-select ${statusFilter !== 'All' && statusFilter !== '' ? 'is-filtered' : ''}`}
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                >
                  <option value="All">All</option>
                  <option value="Active">Active</option>
                  <option value="VIP">VIP</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>

              {/* Assignment Status Filter (GHL India Ventures Sales Executive only) */}
              {canAssignToIRM && (
                <div className="customers-filter-group">
                  <label
                    htmlFor="filter-customer-assignment"
                    className="customers-filter-tag"
                  >
                    IRM:
                  </label>
                  <select
                    id="filter-customer-assignment"
                    className={`form-select customers-filter-select ${assignmentFilter !== 'All' ? 'is-filtered' : ''}`}
                    value={assignmentFilter}
                    onChange={e => setAssignmentFilter(e.target.value as any)}
                  >
                    <option value="All">All Customers</option>
                    <option value="Assigned">Assigned Customers</option>
                    <option value="Unassigned">Unassigned Customers</option>
                  </select>
                </div>
              )}

              {/* Agent Filter */}
              {!isExec && (
                <div className="customers-filter-group">
                  <label
                    htmlFor="filter-customer-agent"
                    className="customers-filter-tag"
                  >
                    Agent:
                  </label>
                  <select
                    id="filter-customer-agent"
                    className={`form-select customers-filter-select ${agentFilter !== 'All' && agentFilter !== '' ? 'is-filtered' : ''}`}
                    value={agentFilter}
                    onChange={e => setAgentFilter(e.target.value)}
                  >
                    <option value="All">All</option>
                    {agentOptions.map(opt => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <div className="customers-list">
              {isLoading && customers.length === 0 ? (
                <div role="status" className="customer-list-item">Loading customers...</div>
              ) : filteredCustomers.length === 0 ? (
                <div className="customer-list-item">No customers found.</div>
              ) : filteredCustomers.map(c => {
                const isSelected = selectedCustomer?.id === c.id;
                const isEligible = isCustomerEligibleForIrm(c);

                return (
                  <div
                    key={c.id}
                    onClick={() => setSelectedCustomer(c)}
                    className={`customer-list-item ${isSelected ? 'is-selected' : ''}`}
                  >
                    <div className="customer-list-item-top">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                        {isAssignMode && canAssignToIRM && (
                          assignSubMode === 'manual' ? (
                            isEligible ? (
                              <input
                                type="checkbox"
                                className="customer-select-checkbox"
                                checked={selectedCustomerIds.has(c.id)}
                                onChange={e => {
                                  e.stopPropagation();
                                  toggleCustomerSelection(c.id);
                                }}
                                onClick={e => e.stopPropagation()}
                              />
                            ) : (
                              <span className="customer-locked-indicator" title="Already assigned to an IRM">
                                <Lock size={12} color="var(--text-muted)" />
                              </span>
                            )
                          ) : null
                        )}
                        <div className="customer-list-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {c.name}
                        </div>
                      </div>
                      <StatusChip status={c.status} size="sm" />
                    </div>
                    <div className="customer-list-sub">
                      {c.phone} • {c.location}
                    </div>

                    {/* Assigned / Unassigned Status Display (GHL India Ventures Sales Executive only) */}
                    {canAssignToIRM && (
                      <div className={`customer-irm-status-pill ${c.assignedIrmName ? 'assigned' : 'unassigned'}`}>
                        {c.assignedIrmName ? (
                          <>
                            <UserCheck size={11} /> Assigned IRM: <strong>{c.assignedIrmName}</strong>
                          </>
                        ) : (
                          <>
                            <Clock size={11} /> Assignment: Unassigned
                          </>
                        )}
                      </div>
                    )}

                    <div className="customer-list-bottom">
                      <span className="customer-list-val">
                        {getCustomerValueDisplay(c)}
                      </span>
                      <button
                        className="btn btn-call btn-sm btn-icon customer-list-call-btn"
                        onClick={e => {
                          e.stopPropagation();
                          initiateCall(c.name, c.phone, 'customer', c.id);
                        }}
                      >
                        <Phone size={12} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right: Full 360 Cockpit */}
        {selectedCustomer ? (
          <div className="card customer-cockpit-card">
            {/* 360 Header */}
            <div className="customer-cockpit-header">
              <div>
                <div className="customer-cockpit-name-row">
                  <h2 className="customer-cockpit-name">{selectedCustomer.name}</h2>
                  <StatusChip status={selectedCustomer.status} />
                </div>
                <div className="customer-cockpit-meta-row">
                  <span>📞 {selectedCustomer.phone || '--'}</span>
                  <span>✉️ {selectedCustomer.email || '--'}</span>
                  <span>📍 {selectedCustomer.location || '--'}</span>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="customer-cockpit-actions" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button
                  className="btn btn-secondary"
                  onClick={() => handleOpenEditModal(selectedCustomer)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px' }}
                >
                  <Pencil size={14} /> Edit Details
                </button>
                <button
                  className="btn btn-primary customer-call-btn"
                  onClick={() => initiateCall(selectedCustomer.name, selectedCustomer.phone, 'customer', selectedCustomer.id)}
                >
                  <Phone size={15} /> Click to Call
                </button>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="customer-tabs-bar">
              {[
                { id: 'overview', label: 'Overview' },
                { id: 'bookings', label: `Bookings (${customerBookings.length})` },
                { id: 'calls', label: `Calls (${customerCalls.length})` },
                { id: 'followups', label: `Follow-ups (${customerFollowups.length})` },
                ...(isJamin ? [{ id: 'site_visits', label: `Site Visits (${customerSiteVisits.length})` }] : []),
                { id: 'timeline', label: 'Activity Timeline' },
                { id: 'documents', label: 'Documents' },
              ].map(tab => (
                <button
                  key={tab.id}
                  className={`customer-tab-btn ${activeTab === tab.id ? 'is-active' : ''}`}
                  onClick={() => setActiveTab(tab.id as any)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab Contents */}
            <div className="customer-tab-content">
              {activeTab === 'overview' && (
                <div className="customer-overview-stack">
                  <div className="card customer-profile-card">
                    <h4 className="customer-section-heading">
                      Account & Commercial Profile
                    </h4>
                    <div className="customer-profile-grid">
                      <div>
                        <span className="customer-profile-label">Assigned Account Manager:</span>
                        <div className="customer-profile-val">{selectedCustomer.assignedAgentName || '--'}</div>
                      </div>
                      {canAssignToIRM && (
                        <div>
                          <span className="customer-profile-label">Assigned IRM:</span>
                          <div className={selectedCustomer.assignedIrmName ? 'customer-profile-val-primary' : 'customer-profile-val'}>
                            {selectedCustomer.assignedIrmName || 'Unassigned'}
                          </div>
                        </div>
                      )}
                      <div>
                        <span className="customer-profile-label">{isJamin ? 'Plot Portfolio Value:' : 'Investment Range:'}</span>
                        <div className="customer-profile-val-green">
                          {getCustomerValueDisplay(selectedCustomer)}
                        </div>
                      </div>
                      <div>
                        <span className="customer-profile-label">Customer Since:</span>
                        <div className="customer-profile-val">{selectedCustomer.createdAt}</div>
                      </div>
                      <div>
                        <span className="customer-profile-label">Last Contacted:</span>
                        <div className="customer-profile-val-primary">
                          {selectedCustomer.lastContacted}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* --- Banking & Legal / Custom Fields Card --- */}
                  {(() => {
                    const cf = selectedCustomer.customFields || {};

                    /* Jamin-specific guaranteed rows */
                    const jaminRows = isJamin
                      ? [
                        {
                          id: 'preferredPaymentBank',
                          label: 'Preferred Payment Bank',
                          value: cf['preferredPaymentBank'] || '—',
                        },
                        {
                          id: 'advocateAssigned',
                          label: 'Advocate Assigned',
                          value: cf['advocateAssigned'] || '—',
                        },
                      ]
                      : [];

                    /* Dynamic tenant custom fields (from localStorage definitions) */
                    const activeDefs = getCustomFieldDefinitions(tenant?.id)
                      .filter((d: CustomFieldDefinition) => d.active !== false && d.module === 'customers')
                      .sort((a: CustomFieldDefinition, b: CustomFieldDefinition) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));

                    const dynamicRows = activeDefs
                      .map((def: CustomFieldDefinition) => {
                        const key = def.fieldKey || def.id;
                        /* Skip if already covered by a Jamin guaranteed row */
                        if (jaminRows.some(j => j.id === key)) return null;
                        const val = cf[key];
                        if (val === undefined || val === null || val === '') return null;
                        return {
                          id: def.id,
                          label: def.label || key.replace(/([A-Z])/g, ' $1'),
                          value: String(val),
                        };
                      })
                      .filter(Boolean);

                    const allRows = [...jaminRows, ...dynamicRows];
                    if (allRows.length === 0) return null;

                    return (
                      <div className="card customer-custom-card">
                        <h4 className="customer-custom-heading">
                          {isJamin ? 'Banking & Legal' : 'Tenant Specific Relationship Attributes'}
                        </h4>
                        <div className="customer-custom-grid">
                          {allRows.map((item: any) => (
                            <div key={item!.id}>
                              <span className="customer-custom-label">
                                {item!.label}:
                              </span>
                              <div className="customer-custom-val">{item!.value}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                  {/* --- Purchased / Booked Properties Overview Widget --- */}
                  {customerBookings.length > 0 && (
                    <div className="card customer-bookings-overview-card" style={{ padding: '16px', background: 'linear-gradient(to right, #f8fafc, #f1f5f9)', border: '1px solid #e2e8f0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Building2 size={18} color="#0284c7" />
                          <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>
                            Purchased / Booked Properties ({customerBookings.length})
                          </h4>
                        </div>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          style={{ fontSize: 12, padding: '4px 10px', display: 'flex', alignItems: 'center', gap: 4 }}
                          onClick={() => setActiveTab('bookings')}
                        >
                          View All Bookings →
                        </button>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
                        {customerBookings.map(b => {
                          const totalAmt = b.contractValue ?? b.totalPlotPrice ?? b.totalAmount ?? 0;
                          const tokenAmt = b.tokenAmountPaid ?? b.bookingAmount ?? 0;
                          const verifiedAmt = b.verifiedReceipts ?? ((b.status === 'Token Paid' || b.paymentStatus === 'Verified') ? tokenAmt : 0);
                          const isCancelled = b.status === 'Cancelled' || b.status === 'Voided';
                          const balanceDue = isCancelled ? 0 : Math.max(0, totalAmt - verifiedAmt);

                          return (
                            <div
                              key={b.id}
                              className="customer-overview-booking-card"
                              onClick={() => handleOpenBookingDetails(b.id)}
                              style={{ cursor: 'pointer' }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                  <div
                                    style={{
                                      width: 34,
                                      height: 34,
                                      borderRadius: 8,
                                      backgroundColor: isCancelled ? '#fee2e2' : '#e0f2fe',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      color: isCancelled ? '#dc2626' : '#0284c7',
                                      fontWeight: 700,
                                      fontSize: 12,
                                      flexShrink: 0,
                                    }}
                                  >
                                    <Building2 size={16} />
                                  </div>
                                  <div>
                                    <div style={{ fontWeight: 700, fontSize: '13px', color: '#0f172a' }}>
                                      {b.plotNumber ? `Plot ${b.plotNumber}` : 'Plot Unit'}
                                    </div>
                                    <div style={{ fontSize: '11px', color: '#64748b' }}>
                                      {b.projectName || 'Jamin Community'}
                                    </div>
                                  </div>
                                </div>
                                <StatusChip status={b.status || 'Token Paid'} size="sm" />
                              </div>

                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: '11px', paddingTop: 8, borderTop: '1px dashed #e2e8f0' }}>
                                <div>
                                  <span style={{ color: '#64748b' }}>Sale Price:</span>
                                  <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '12px' }}>
                                    {formatCurrency(totalAmt)}
                                  </div>
                                </div>
                                <div>
                                  <span style={{ color: '#64748b' }}>Paid Token:</span>
                                  <div style={{ fontWeight: 700, color: '#059669', fontSize: '12px' }}>
                                    {formatCurrency(tokenAmt)}
                                  </div>
                                </div>
                              </div>

                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 4 }}>
                                <span style={{ fontSize: '11px', color: isCancelled ? '#dc2626' : '#64748b' }}>
                                  {isCancelled ? 'Cancelled' : `Balance: ${formatCurrency(balanceDue)}`}
                                </span>
                                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--primary-600)', display: 'flex', alignItems: 'center', gap: 2 }}>
                                  More Info →
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'bookings' && (
                <div className="customer-bookings-stack">
                  {customerBookings.length === 0 ? (
                    <div className="card" style={{ padding: 40, textAlign: 'center' }}>
                      <Building2 size={38} color="#94a3b8" style={{ margin: '0 auto 12px' }} />
                      <h4 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 600 }}>No Bookings on Record</h4>
                      <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 13, maxWidth: 440, marginInline: 'auto' }}>
                        This customer currently has no booked plots or property transactions registered under their profile.
                      </p>
                    </div>
                  ) : (
                    <>
                      {/* Financial & Portfolio Summary Banner */}
                      <div className="customer-portfolio-banner">
                        <div className="customer-portfolio-banner-header">
                          <div>
                            <span className="customer-portfolio-banner-subtitle">
                              Customer Portfolio Financials (Customer 360)
                            </span>
                            <h3 className="customer-portfolio-banner-title">
                              <Building2 size={18} color="#0284c7" />
                              {customerBookings.length} {customerBookings.length === 1 ? 'Property Booking' : 'Property Bookings'}{' '}
                              <span style={{ fontSize: 13, fontWeight: 500, color: '#64748b' }}>
                                ({selectedCustomerFinancials.activeBookingsCount} Active)
                              </span>
                            </h3>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={handleExpandAllBookings}
                              style={{ fontSize: 12, padding: '5px 12px', display: 'inline-flex', alignItems: 'center', gap: 5 }}
                            >
                              {customerBookings.every(b => expandedBookingIds[b.id]) ? (
                                <>
                                  <ChevronUp size={14} /> Collapse All
                                </>
                              ) : (
                                <>
                                  <ChevronDown size={14} /> Expand All
                                </>
                              )}
                            </button>
                          </div>
                        </div>

                        <div className="customer-portfolio-metrics-grid">
                          <div className="portfolio-metric-box">
                            <span className="portfolio-metric-label">Contract Value</span>
                            <span className="portfolio-metric-value">
                              {formatCurrency(selectedCustomerFinancials.contractValue)}
                            </span>
                          </div>

                          <div className="portfolio-metric-box">
                            <span className="portfolio-metric-label" style={{ color: '#059669' }}>Verified Receipts</span>
                            <span className="portfolio-metric-value" style={{ color: '#059669' }}>
                              {formatCurrency(selectedCustomerFinancials.verifiedReceipts)}
                            </span>
                          </div>

                          {selectedCustomerFinancials.totalRefunds > 0 && (
                            <div className="portfolio-metric-box">
                              <span className="portfolio-metric-label" style={{ color: '#dc2626' }}>Total Refunds</span>
                              <span className="portfolio-metric-value" style={{ color: '#dc2626' }}>
                                {formatCurrency(selectedCustomerFinancials.totalRefunds)}
                              </span>
                            </div>
                          )}

                          <div className="portfolio-metric-box">
                            <span className="portfolio-metric-label" style={{ color: '#0284c7' }}>Net Cash Received</span>
                            <span className="portfolio-metric-value" style={{ color: '#0284c7' }}>
                              {formatCurrency(selectedCustomerFinancials.netCashReceived)}
                            </span>
                          </div>

                          <div className="portfolio-metric-box">
                            <span className="portfolio-metric-label" style={{ color: '#d97706' }}>Contract Balance</span>
                            <span className="portfolio-metric-value" style={{ color: '#d97706' }}>
                              {formatCurrency(selectedCustomerFinancials.contractBalance)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* List of Bookings Cards with Progressive Disclosure */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {customerBookings.map(b => {
                          const totalAmt = b.contractValue ?? b.totalPlotPrice ?? b.totalAmount ?? 0;
                          const verifiedAmt = b.verifiedReceipts ?? ((b.status === 'Token Paid' || b.paymentStatus === 'Verified') ? (b.tokenAmountPaid ?? b.bookingAmount ?? 0) : 0);
                          const isCancelled = b.status === 'Cancelled' || b.status === 'Voided';
                          const balanceDue = isCancelled ? 0 : Math.max(0, totalAmt - verifiedAmt);
                          const progressPct = totalAmt > 0 ? Math.min(100, Math.round((verifiedAmt / totalAmt) * 100)) : 0;
                          const bDateFormatted = b.bookingDate
                            ? new Date(b.bookingDate).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
                            : '—';
                          const isExpanded = Boolean(expandedBookingIds[b.id]);

                          return (
                            <div
                              key={b.id}
                              className={`booking-item-card ${isCancelled ? 'is-cancelled' : ''}`}
                            >
                              {/* Little Bit / Preview Header Row */}
                              <div
                                className="booking-compact-row"
                                onClick={() => toggleBookingExpand(b.id)}
                              >
                                <div className="booking-compact-main">
                                  <div className="booking-plot-badge">
                                    <Building2 size={20} />
                                  </div>
                                  <div className="booking-title-info">
                                    <div className="booking-plot-name">
                                      <span>{b.plotNumber ? `Plot ${b.plotNumber}` : 'Plot Unit'}</span>
                                      <StatusChip status={b.status || 'Booking Pending Verification'} size="sm" />
                                      {b.paymentStatus && <StatusChip status={b.paymentStatus} size="sm" />}
                                    </div>
                                    <div className="booking-project-sub">
                                      <span style={{ fontWeight: 600, color: '#334155' }}>
                                        {b.projectName || 'Jamin Community'}
                                      </span>
                                      {b.bookingDate && (
                                        <>
                                          <span>•</span>
                                          <span>Booked: {bDateFormatted}</span>
                                        </>
                                      )}
                                      <span>•</span>
                                      <span style={{ color: '#94a3b8' }}>ID: #{b.id}</span>
                                    </div>
                                  </div>
                                </div>

                                <div className="booking-compact-numbers">
                                  <div className="booking-num-item">
                                    <span className="booking-num-label">Contract Price</span>
                                    <span className="booking-num-val" style={{ color: isCancelled ? '#94a3b8' : '#0f172a' }}>
                                      {formatCurrency(totalAmt)}
                                    </span>
                                  </div>

                                  <div className="booking-num-item">
                                    <span className="booking-num-label">Verified Paid</span>
                                    <span className="booking-num-val" style={{ color: '#059669' }}>
                                      {formatCurrency(verifiedAmt)}
                                    </span>
                                  </div>

                                  {!isCancelled && (
                                    <div className="booking-num-item">
                                      <span className="booking-num-label">Balance Due</span>
                                      <span className="booking-num-val" style={{ color: balanceDue > 0 ? '#d97706' : '#059669' }}>
                                        {balanceDue > 0 ? formatCurrency(balanceDue) : 'Cleared'}
                                      </span>
                                    </div>
                                  )}

                                  <div className="booking-compact-actions">
                                    <button
                                      type="button"
                                      className={`booking-more-btn ${isExpanded ? 'is-active' : ''}`}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        toggleBookingExpand(b.id);
                                      }}
                                    >
                                      {isExpanded ? (
                                        <>
                                          Less Info <ChevronUp size={13} />
                                        </>
                                      ) : (
                                        <>
                                          More Info <ChevronDown size={13} />
                                        </>
                                      )}
                                    </button>
                                  </div>
                                </div>
                              </div>

                              {/* Expanded Detailed Breakdown */}
                              {isExpanded && (
                                <div className="booking-expanded-body">
                                  <div className="booking-expanded-content">
                                    {/* Cancellation banner if cancelled */}
                                    {isCancelled && (
                                      <div className="booking-callout booking-callout-cancelled">
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                                          <div>
                                            <strong>Cancelled:</strong> {b.cancellationReason || 'Booking terminated'}
                                            {b.refundAmount > 0 && <span> • Refund Issued: {formatCurrency(b.refundAmount)}</span>}
                                          </div>
                                          <span style={{ fontSize: '11px', fontWeight: 700, color: '#b91c1c' }}>
                                            Inventory Released
                                          </span>
                                        </div>
                                      </div>
                                    )}

                                    {/* Payment Realization Progress Bar */}
                                    {!isCancelled && (
                                      <div className="booking-progress-card">
                                        <div className="booking-progress-header">
                                          <span style={{ color: '#64748b' }}>
                                            Payment Realization: <strong style={{ color: '#059669' }}>{progressPct}% Verified</strong>
                                          </span>
                                          <span style={{ color: balanceDue > 0 ? '#d97706' : '#059669', fontWeight: 600 }}>
                                            {balanceDue > 0 ? `Outstanding: ${formatCurrency(balanceDue)}` : 'Fully Paid'}
                                          </span>
                                        </div>
                                        <div className="booking-progress-bar-bg">
                                          <div
                                            className="booking-progress-bar-fill"
                                            style={{
                                              width: `${progressPct}%`,
                                              backgroundColor: progressPct >= 100 ? '#059669' : '#0284c7',
                                            }}
                                          />
                                        </div>
                                      </div>
                                    )}

                                    {/* Comprehensive Specifications Grid */}
                                    <div className="booking-details-grid">
                                      <div className="booking-detail-item">
                                        <span className="booking-detail-label">Sale / Contract Value</span>
                                        <span className="booking-detail-val">{formatCurrency(totalAmt)}</span>
                                      </div>

                                      <div className="booking-detail-item">
                                        <span className="booking-detail-label">Token Amount Paid</span>
                                        <span className="booking-detail-val" style={{ color: '#059669' }}>
                                          {formatCurrency(b.tokenAmountPaid ?? b.bookingAmount ?? 0)}
                                        </span>
                                      </div>

                                      <div className="booking-detail-item">
                                        <span className="booking-detail-label">Verified Receipts</span>
                                        <span className="booking-detail-val" style={{ color: '#0284c7' }}>
                                          {formatCurrency(verifiedAmt)}
                                        </span>
                                      </div>

                                      <div className="booking-detail-item">
                                        <span className="booking-detail-label">Payment Mode</span>
                                        <span className="booking-detail-val">{b.paymentMode || 'Bank Transfer / Online'}</span>
                                      </div>

                                      <div className="booking-detail-item">
                                        <span className="booking-detail-label">Assigned Agent</span>
                                        <span className="booking-detail-val">
                                          {b.assignedAgentName || selectedCustomer.assignedAgentName || 'Agent'}
                                        </span>
                                      </div>

                                      <div className="booking-detail-item">
                                        <span className="booking-detail-label">Booking Reference</span>
                                        <span className="booking-detail-val" style={{ color: '#64748b' }}>
                                          {b.receiptNumber || b.transactionReference || `#${b.id}`}
                                        </span>
                                      </div>
                                    </div>

                                    {/* Payment Terms & Milestones */}
                                    {b.paymentTerms && (
                                      <div className="booking-callout booking-callout-terms">
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}>
                                          <FileText size={14} color="#0284c7" />
                                          Payment Terms & Milestones
                                        </div>
                                        <div style={{ marginTop: 2, lineHeight: 1.5 }}>
                                          {b.paymentTerms}
                                        </div>
                                      </div>
                                    )}

                                    {/* Notes / Remarks */}
                                    {b.notes && (
                                      <div className="booking-callout booking-callout-notes">
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}>
                                          <Info size={14} color="#ca8a04" />
                                          Notes & Remarks
                                        </div>
                                        <div style={{ marginTop: 2, lineHeight: 1.5 }}>
                                          "{b.notes}"
                                        </div>
                                      </div>
                                    )}

                                    {/* Payment Ledger Entries */}
                                    {Array.isArray(b.payments) && b.payments.length > 0 && (
                                      <div className="booking-payment-ledger" style={{ marginTop: 12 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 13, color: '#0f172a', marginBottom: 8 }}>
                                          <CreditCard size={15} color="#059669" />
                                          Payment Ledger ({b.payments.length} {b.payments.length === 1 ? 'Entry' : 'Entries'})
                                        </div>
                                        <div style={{ overflowX: 'auto', borderRadius: 6, border: '1px solid #e2e8f0' }}>
                                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, textAlign: 'left' }}>
                                            <thead style={{ background: '#f8fafc', color: '#64748b', borderBottom: '1px solid #e2e8f0' }}>
                                              <tr>
                                                <th style={{ padding: '8px 10px' }}>Type</th>
                                                <th style={{ padding: '8px 10px' }}>Amount</th>
                                                <th style={{ padding: '8px 10px' }}>Mode</th>
                                                <th style={{ padding: '8px 10px' }}>Receipt / Ref</th>
                                                <th style={{ padding: '8px 10px' }}>Status</th>
                                                <th style={{ padding: '8px 10px' }}>Date</th>
                                              </tr>
                                            </thead>
                                            <tbody>
                                              {b.payments.map((p: any) => (
                                                <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                  <td style={{ padding: '8px 10px', fontWeight: 600 }}>{p.paymentType}</td>
                                                  <td style={{ padding: '8px 10px', color: p.paymentType === 'Refund' ? '#dc2626' : '#059669', fontWeight: 700 }}>
                                                    {p.paymentType === 'Refund' ? `-${formatCurrency(p.amount)}` : formatCurrency(p.amount)}
                                                  </td>
                                                  <td style={{ padding: '8px 10px', color: '#475569' }}>{p.paymentMode || 'Online'}</td>
                                                  <td style={{ padding: '8px 10px', color: '#64748b' }}>{p.receiptNumber || p.transactionReference || '—'}</td>
                                                  <td style={{ padding: '8px 10px' }}>
                                                    <StatusChip status={p.status || 'Verified'} size="sm" />
                                                  </td>
                                                  <td style={{ padding: '8px 10px', color: '#64748b' }}>
                                                    {p.verifiedAt ? new Date(p.verifiedAt).toLocaleDateString('en-IN') : (p.createdAt ? new Date(p.createdAt).toLocaleDateString('en-IN') : '—')}
                                                  </td>
                                                </tr>
                                              ))}
                                            </tbody>
                                          </table>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              )}

              {activeTab === 'calls' && (
                <div className="customer-calls-stack">
                  {customerCalls.length === 0 ? (
                    <div className="customer-empty-text">
                      No calls logged yet with this customer. Click "Click to Call" to initiate a call.
                    </div>
                  ) : (
                    customerCalls.map(c => (
                      <div
                        key={c.id}
                        className="card customer-call-card"
                      >
                        <div>
                          <div className="customer-call-meta">
                            <StatusChip status={c.direction} size="sm" />
                            <StatusChip status={c.disposition} size="sm" />
                            <span className="customer-call-duration">
                              Duration: {Math.floor(c.duration / 60)}m {c.duration % 60}s • {c.timestamp}
                            </span>
                          </div>
                          {c.transcription && (
                            <p className="customer-call-transcript">
                              "{c.transcription}"
                            </p>
                          )}
                        </div>

                        {c.recordingUrl && (
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => alert(`Simulated Playback: Playing audio for call with ${c.contactName}`)}
                          >
                            <Play size={13} color="var(--primary-600)" /> Play Recording
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeTab === 'followups' && (
                <div className="customer-followups-stack">
                  {customerFollowups.length === 0 ? (
                    <div className="customer-empty-text">
                      No open follow-ups for this customer.
                    </div>
                  ) : (
                    customerFollowups.map(f => {
                      const cleanDate = (() => {
                        if (!f.scheduledAt) return 'Not scheduled';
                        try {
                          const d = new Date(f.scheduledAt);
                          if (!isNaN(d.getTime())) {
                            return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) +
                              ', ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
                          }
                        } catch { }
                        return f.scheduledAt.replace('T', ' ').replace(/\.\d+Z$/, '');
                      })();

                      const isOverdue = (() => {
                        if (f.status === 'Completed' || f.status === 'Cancelled' || f.status === 'Rescheduled') return false;
                        if (!f.scheduledAt) return false;
                        try {
                          const d = new Date(f.scheduledAt);
                          return !isNaN(d.getTime()) && d.getTime() < Date.now();
                        } catch {
                          return false;
                        }
                      })();

                      const effectiveStatus: string =
                        f.status === 'Completed'
                          ? 'Completed'
                          : f.status === 'Rescheduled'
                            ? 'Rescheduled'
                            : isOverdue
                              ? 'Overdue'
                              : f.status || 'Pending';

                      const displayNote = (() => {
                        if (!f.notes) return 'Follow-up on property inquiry';
                        if (/follow-up\s+whatsapp\s+scheduled/i.test(f.notes)) return 'WhatsApp follow-up on property inquiry';
                        if (/follow-up\s+call\s+scheduled/i.test(f.notes)) return 'Phone call follow-up on property inquiry';
                        if (/follow-up\s+meeting\s+scheduled/i.test(f.notes)) return 'Meeting follow-up on property inquiry';
                        return f.notes.replace(/\s*\(?via Leads\s*360\)?/gi, '').replace(/\s*scheduled via Leads\s*360/gi, '').trim() || 'Follow-up on property inquiry';
                      })();

                      return (
                        <div
                          key={f.id}
                          className="customer-followup-item"
                          style={{ opacity: f.status === 'Completed' ? 0.75 : 1 }}
                        >
                          <div>
                            <div className="customer-followup-header" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                              <span
                                className="customer-followup-notes"
                                style={{ textDecoration: f.status === 'Completed' ? 'line-through' : 'none' }}
                              >
                                {displayNote}
                              </span>
                              <StatusChip status={effectiveStatus} size="sm" />
                              <StatusChip status={f.priority} size="sm" />
                            </div>
                            <div className="customer-followup-due" style={{ color: 'var(--text-secondary)', marginTop: 4 }}>
                              Due: <strong>{cleanDate}</strong> • Assignee: {f.assignedAgentName}
                            </div>
                          </div>

                          {f.status === 'Completed' ? (
                            <span style={{ fontSize: '12px', color: '#059669', fontWeight: 600, padding: '4px 8px' }}>
                              ✓ Done
                            </span>
                          ) : (
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={async () => {
                                try {
                                  await apiCompleteFollowup(f.id);
                                  storageService.saveFollowup({ ...f, status: 'Completed', completedAt: new Date().toISOString() });
                                  await loadData();
                                  showToast('Follow-up marked as completed.');
                                } catch (err) {
                                  alert(err instanceof Error ? err.message : 'Could not complete follow-up. Please retry.');
                                }
                              }}
                            >
                              Mark Done
                            </button>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}


              {activeTab === 'timeline' && <Timeline events={timelineEvents} />}

              {isJamin && activeTab === 'site_visits' && (
                <div className="card" style={{ padding: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <div>
                      <h4 className="customer-section-heading" style={{ margin: 0 }}>
                        Site Visits for {selectedCustomer?.name}
                      </h4>
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                        {customerSiteVisits.length} recorded
                      </span>
                    </div>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={handleOpenScheduleSiteVisit}
                      style={{
                        background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
                        borderColor: '#dc2626',
                        color: '#ffffff',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        fontWeight: 600,
                      }}
                    >
                      <Plus size={14} /> Schedule Site Visit
                    </button>
                  </div>
                  {customerSiteVisits.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-secondary)', fontSize: 13 }}>
                      No site visits recorded for this customer yet.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {customerSiteVisits.map(sv => (
                        <div
                          key={sv.id}
                          style={{
                            border: '1px solid var(--border-base)',
                            borderRadius: 8,
                            padding: '12px 14px',
                            background: 'var(--bg-card-subtle, #f9fafb)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 14 }}>
                              {sv.projectName} — <span style={{ color: '#dc2626' }}>{sv.plotNumber || 'General Layout Tour'}</span>
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                              Slot: <strong>{sv.scheduledAt}</strong> • Host: {sv.assignedAgentName}
                            </div>
                            {(sv.outcomeNotes || sv.visitorNote) && (
                              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, fontStyle: 'italic' }}>
                                "{sv.outcomeNotes || sv.visitorNote}"
                              </div>
                            )}
                          </div>
                          <div>
                            <StatusChip status={sv.status} size="sm" />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'documents' && selectedCustomer && (
                <div className="customer-docs-stack">
                  <DocumentUploader
                    entityType="customer"
                    entityId={selectedCustomer.id}
                    allowedCategories={isJamin ? ['Booking Form', 'Sale Agreement', 'Payment Receipt', 'Identity Proof', 'Other'] : ['KYC', 'Agreement', 'Payment Receipt', 'Identity Proof', 'Other']}
                  />
                  <DocumentList
                    entityType="customer"
                    entityId={selectedCustomer.id}
                    canDelete
                  />
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="card customer-empty-placeholder">
            Select a customer from the list to view their 360 profile.
          </div>
        )}
      </div>
      {/* New Customer Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => { setIsAddModalOpen(false); resetAddForm(); }}
        title="New Customer"
        subtitle={isAdmin ? 'Create a customer account and choose its account executive.' : 'Create a customer account assigned to you.'}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => { setIsAddModalOpen(false); resetAddForm(); }}>
              Cancel
            </button>
            <button className="btn btn-primary" disabled={isSubmittingAdd} onClick={handleAddCustomer}>
              {isSubmittingAdd ? 'Creating...' : 'Create Customer'}
            </button>
          </>
        }
      >
        <div className="customer-modal-stack">
          {/* Name */}
          <div className="form-group">
            <label className="form-label">Name *</label>
            <input
              className={`form-input${addErrors.name ? ' is-invalid' : ''}`}
              placeholder="e.g. Priya Sharma"
              value={newName}
              onChange={e => { setNewName(e.target.value); if (addErrors.name) setAddErrors(p => ({ ...p, name: undefined })); }}
            />
            {addErrors.name && <div className="form-error">{addErrors.name}</div>}
          </div>
          {/* Phone */}
          <div className="form-group">
            <label className="form-label">Phone *</label>
            <input
              className={`form-input${addErrors.phone ? ' is-invalid' : ''}`}
              placeholder="e.g. +91 98765 43210"
              value={newPhone}
              onChange={e => { setNewPhone(e.target.value); if (addErrors.phone) setAddErrors(p => ({ ...p, phone: undefined })); }}
            />
            {addErrors.phone && <div className="form-error">{addErrors.phone}</div>}
          </div>
          {/* Email */}
          <div className="form-group">
            <label className="form-label">Email</label>
            <input
              className="form-input"
              type="email"
              placeholder="e.g. priya@example.com"
              value={newEmail}
              onChange={e => setNewEmail(e.target.value)}
            />
          </div>
          {/* Location */}
          <div className="form-group">
            <label className="form-label">Location</label>
            <input
              className="form-input"
              placeholder="e.g. Bengaluru"
              value={newLocation}
              onChange={e => setNewLocation(e.target.value)}
            />
          </div>
          {/* Status */}
          <div className="form-group">
            <label className="form-label">Status</label>
            <select
              className="form-select"
              value={newStatus}
              onChange={e => setNewStatus(e.target.value as 'Active' | 'VIP' | 'Inactive')}
            >
              <option value="Active">Active</option>
              <option value="VIP">VIP</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
          {canManageAgentAssignments && (
            <div className="form-group">
              <label className="form-label">Assigned Executive</label>
              <select className="form-select" value={newAgentId} onChange={e => setNewAgentId(e.target.value)}>
                <option value="">Unassigned</option>
                {newAgentId && !availableAgents.some(a => a.id === newAgentId) && <option value={newAgentId}>{user?.name || `Agent #${newAgentId}`}</option>}
                {availableAgents.map(agent => <option key={agent.id} value={agent.id}>{agent.name}{agent.roleName ? ` · ${agent.roleName}` : ''}</option>)}
              </select>
            </div>
          )}
          {/* Tenant-Specific Custom Fields */}
          {(() => {
            const customerDefs = getCustomFieldDefinitions(tenant?.id)
              .filter((d: CustomFieldDefinition) => d.active !== false && d.module === 'customers')
              .sort((a: CustomFieldDefinition, b: CustomFieldDefinition) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));

            if (customerDefs.length === 0) return null;

            return customerDefs.map((def: CustomFieldDefinition) => {
              const key = def.fieldKey || def.id;
              const val = newCustomFields[key] ?? def.defaultValue ?? '';
              return (
                <div key={def.id} className="form-group">
                  <label className="form-label">
                    {def.label || key}
                    {def.required ? ' *' : ''}
                  </label>
                  {def.fieldType === 'select' && def.options && def.options.length > 0 ? (
                    <select
                      className="form-select"
                      required={def.required}
                      value={val}
                      onChange={e => {
                        setNewCustomFields(prev => ({ ...prev, [key]: e.target.value }));
                        setAddErrors(prev => ({ ...prev, [`custom:${key}`]: undefined }));
                      }}
                    >
                      {!def.defaultValue && !def.options.includes(val) && (
                        <option value="">Select {def.label}...</option>
                      )}
                      {def.options.map((opt: string) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={def.fieldType === 'number' ? 'number' : 'text'}
                      className="form-input"
                      required={def.required}
                      placeholder={`Enter ${def.label}...`}
                      value={val}
                      onChange={e => {
                        setNewCustomFields(prev => ({ ...prev, [key]: e.target.value }));
                        setAddErrors(prev => ({ ...prev, [`custom:${key}`]: undefined }));
                      }}
                    />
                  )}
                  {addErrors[`custom:${key}`] && <div className="form-error">{addErrors[`custom:${key}`]}</div>}
                </div>
              );
            });
          })()}
        </div>
      </Modal>

      {/* ── Manual IRM Selection Modal (GHL India Ventures Sales Executive only) ── */}
      {canAssignToIRM && (
        <Modal
          isOpen={isManualModalOpen}
          onClose={() => setIsManualModalOpen(false)}
          title="Assign Leads to IRM"
          subtitle={`Select an IRM to assign the ${selectedCustomerIds.size} selected customer(s) to.`}
          maxWidth={900}
          className="irm-assign-modal"
          footer={
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setIsManualModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={!selectedIrmId}
                onClick={handleConfirmManualAssignment}
              >
                Confirm Assignment →
              </button>
            </div>
          }
        >
          <div className="irm-selection-list">
            {irms.map((irm: IrmProfile) => {
              const currentCount = customers.filter(c => c.assignedIrmName === irm.name || c.assignedIrmId === irm.id).length;
              const workload = currentCount <= 2 ? 'Low' : currentCount <= 5 ? 'Medium' : 'High';
              const isSelected = selectedIrmId === irm.id;

              return (
                <div
                  key={irm.id}
                  className={`irm-selection-item ${isSelected ? 'is-selected' : ''}`}
                  onClick={() => setSelectedIrmId(irm.id)}
                >
                  {/* Col 1 – Radio */}
                  <div className="irm-col-radio">
                    <input
                      type="radio"
                      name="selectedIrm"
                      checked={isSelected}
                      onChange={() => setSelectedIrmId(irm.id)}
                      style={{ accentColor: 'var(--primary-600)', width: 16, height: 16 }}
                    />
                  </div>

                  {/* Col 2 – IRM Info */}
                  <div className="irm-col-info">
                    <div className="irm-item-name">{irm.name}</div>
                    <div className="irm-item-meta-row">Experience: <strong>{irm.experience}</strong> ({irm.experienceLevel})</div>
                    <div className="irm-item-meta-row">Performance: <strong>{irm.performance}%</strong></div>
                    <div className="irm-item-meta-row">Customers: <strong>{currentCount}</strong></div>
                  </div>

                  {/* Col 3 – Workload */}
                  <div className="irm-col-pill">
                    <span className={`irm-pill workload-${workload.toLowerCase()}`}>
                      Workload: {workload}
                    </span>
                  </div>

                  {/* Col 4 – Availability */}
                  <div className="irm-col-pill">
                    <span className={`irm-pill ${irm.status.toLowerCase()}`}>
                      {irm.status}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </Modal>
      )}

      {/* ── Auto Assignment Preview Modal (GHL India Ventures Sales Executive only) ── */}
      {canAssignToIRM && (
        <Modal
          isOpen={isAutoPreviewModalOpen}
          onClose={() => setIsAutoPreviewModalOpen(false)}
          title="Auto Assignment Preview"
          subtitle="Capacity-to-experience smart matching with balanced workload distribution."
          className="irm-assign-modal auto-preview-modal"
          maxWidth={900}
          footer={
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setIsAutoPreviewModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={autoRecommendations.length === 0}
                onClick={handleConfirmAutoAssignment}
              >
                Confirm Assignment ({autoRecommendations.length})
              </button>
            </div>
          }
        >
          <p className="auto-preview-subtext">
            Review the calculated IRM recommendations before final assignment. You can edit any individual IRM assignment if needed.
          </p>

          <div className="auto-preview-table-container">
            <table className="auto-preview-table">
              <colgroup>
                <col style={{ width: '160px' }} />
                <col style={{ width: '130px' }} />
                <col style={{ width: '175px' }} />
                <col />
                <col style={{ width: '65px' }} />
              </colgroup>
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Investment</th>
                  <th>Recommended IRM</th>
                  <th>Match Reason</th>
                  <th style={{ textAlign: 'center' }}>Edit</th>
                </tr>
              </thead>
              <tbody>
                {autoRecommendations.map(rec => (
                  <tr key={rec.customerId}>
                    <td title={rec.customerName}>
                      <div className="auto-cell-customer">{rec.customerName}</div>
                    </td>
                    <td title={rec.investmentDisplay}>
                      <span className="auto-cell-investment">{rec.investmentDisplay}</span>
                    </td>
                    <td>
                      {editingRecommendationCustomerId === rec.customerId ? (
                        <select
                          className="auto-edit-select"
                          value={rec.recommendedIrmId}
                          onChange={e => handleUpdateSingleRecommendation(rec.customerId, e.target.value)}
                          autoFocus
                        >
                          {irms.map((irm: IrmProfile) => (
                            <option key={irm.id} value={irm.id}>
                              {irm.name} ({irm.experienceLevel}, {irm.status})
                            </option>
                          ))}
                        </select>
                      ) : (
                        <div className="auto-cell-irm" title={rec.recommendedIrmName}>
                          <span>{rec.recommendedIrmName}</span>
                        </div>
                      )}
                    </td>
                    <td title={rec.matchReason}>
                      <span className={`auto-reason-tag ${rec.isEdited ? 'manual-edit' : ''}`}>
                        {rec.matchReason}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm auto-edit-btn"
                        onClick={() => {
                          if (editingRecommendationCustomerId === rec.customerId) {
                            setEditingRecommendationCustomerId(null);
                          } else {
                            setEditingRecommendationCustomerId(rec.customerId);
                          }
                        }}
                      >
                        {editingRecommendationCustomerId === rec.customerId ? 'Done' : 'Edit'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Modal>
      )}

      {/* ── Jamin: Schedule Site Visit Modal for Customer ── */}
      {isJamin && selectedCustomer && (
        <Modal
          isOpen={isSiteVisitModalOpen}
          onClose={() => {
            if (!isSubmittingSiteVisit) {
              setIsSiteVisitModalOpen(false);
              setSvError('');
            }
          }}
          title={`Schedule Site Visit: ${selectedCustomer.name}`}
          subtitle={`Book layout walkthrough for ${selectedCustomer.phone}`}
        >
          <form onSubmit={handleSaveCustomerSiteVisit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {svError && (
              <div style={{
                padding: '10px 14px',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: 8,
                color: '#ef4444',
                fontSize: 13,
                lineHeight: 1.4,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}>
                <AlertCircle size={16} style={{ flexShrink: 0 }} />
                <span>{svError}</span>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Client Name</label>
                <input
                  type="text"
                  className="form-input"
                  disabled
                  value={selectedCustomer.name}
                  style={{ background: 'var(--bg-card-subtle, #f9fafb)', cursor: 'not-allowed' }}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Mobile Number</label>
                <input
                  type="text"
                  className="form-input"
                  disabled
                  value={selectedCustomer.phone}
                  style={{ background: 'var(--bg-card-subtle, #f9fafb)', cursor: 'not-allowed' }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Visit Date *</label>
                <input
                  type="date"
                  className="form-input"
                  required
                  min={new Date().toISOString().split('T')[0]}
                  value={svDate}
                  onChange={e => {
                    setSvDate(e.target.value);
                    setSvError('');
                  }}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Time Slot *</label>
                <select
                  className="form-select"
                  required
                  value={svTimeSlot}
                  onChange={e => setSvTimeSlot(e.target.value)}
                >
                  <option value="09:30 AM">09:30 AM (Morning Tour)</option>
                  <option value="11:00 AM">11:00 AM (Mid-Day Walkthrough)</option>
                  <option value="02:00 PM">02:00 PM (Afternoon Tour)</option>
                  <option value="03:30 PM">03:30 PM (Late Afternoon Slot)</option>
                  <option value="05:00 PM">05:00 PM (Sunset Inspection)</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Host Escort Agent</label>
                <select
                  className="form-select"
                  value={svHostAgent}
                  onChange={e => setSvHostAgent(e.target.value)}
                >
                  {jaminAgents.map(ag => (
                    <option key={ag.id} value={ag.name}>
                      {ag.name} ({ag.email})
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">
                  Project * {isLoadingProjects && <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>(Loading...)</span>}
                </label>
                <select
                  className="form-select"
                  value={svProjectId}
                  onChange={e => handleSiteVisitProjectChange(e.target.value)}
                  required
                  disabled={isLoadingProjects || svProjectsList.length === 0}
                >
                  {svProjectsList.length === 0 && <option value="">No projects available</option>}
                  {svProjectsList.map(proj => (
                    <option key={proj.id} value={String(proj.id)}>
                      {proj.name} ({proj.location || 'Active'})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">
                Specific Plot
                <span style={{ fontSize: 11, color: 'var(--text-secondary)', marginLeft: 4 }}>
                  (optional)
                </span>
                {isLoadingPlots && (
                  <span style={{ fontSize: 11, color: '#3b82f6', marginLeft: 6 }}>
                    · Loading live inventory...
                  </span>
                )}
              </label>
              <select
                className="form-select"
                value={svPlotId}
                onChange={e => {
                  setSvPlotId(e.target.value);
                  setSvError('');
                }}
                disabled={!svProjectId || isLoadingPlots || svEligiblePlots.length === 0}
              >
                <option value="">-- General Project Tour (No Specific Plot) --</option>
                {svEligiblePlots.map((pl: any) => (
                  <option key={pl.id} value={String(pl.id)}>
                    Plot {pl.plotNumber} {pl.dimensions ? `· ${pl.dimensions}` : pl.areaSqFt ? `· ${pl.areaSqFt} sq.ft` : ''} · Available {pl.price ? `· ₹${Number(pl.price).toLocaleString('en-IN')}` : ''}
                  </option>
                ))}
              </select>
              {svProjectId && !isLoadingPlots && svEligiblePlots.length === 0 && (
                <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
                  No available plots in this project right now. You can still schedule a General Project Tour.
                </p>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Visit Notes / Requirements</label>
              <textarea
                className="form-textarea"
                rows={2}
                value={svNotes}
                onChange={e => setSvNotes(e.target.value)}
                placeholder="e.g. Needs cab pickup from metro station, visiting with family, visit reason..."
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={isSubmittingSiteVisit}
                onClick={() => {
                  setIsSiteVisitModalOpen(false);
                  setSvError('');
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isSubmittingSiteVisit || !svProjectId}
                style={{
                  background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
                  borderColor: '#dc2626',
                  color: '#ffffff',
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  opacity: isSubmittingSiteVisit ? 0.7 : 1,
                  cursor: isSubmittingSiteVisit ? 'not-allowed' : 'pointer',
                }}
              >
                <Calendar size={14} /> {isSubmittingSiteVisit ? 'Scheduling...' : 'Confirm Schedule'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Edit Customer Modal */}
      {isEditModalOpen && (
        <Modal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          title="Edit Customer Profile"
        >
          <form onSubmit={handleSaveEditCustomer} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Customer Name *</label>
                <input
                  type="text"
                  className="form-input"
                  required
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Phone Number *</label>
                <input
                  type="text"
                  className="form-input"
                  required
                  value={editPhone}
                  onChange={e => setEditPhone(e.target.value)}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Email Address</label>
                <input
                  type="email"
                  className="form-input"
                  value={editEmail}
                  onChange={e => setEditEmail(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Location / City</label>
                <input
                  type="text"
                  className="form-input"
                  value={editLocation}
                  onChange={e => setEditLocation(e.target.value)}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Account Status</label>
                <select
                  className="form-select"
                  value={editStatus}
                  onChange={e => setEditStatus(e.target.value as any)}
                >
                  <option value="Active">Active</option>
                  <option value="VIP">VIP</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Assigned Executive</label>
                {canManageAgentAssignments ? (
                  <select className="form-select" value={editAgentId} onChange={e => setEditAgentId(e.target.value)}>
                    <option value="">Unassigned</option>
                    {editAgentId && !availableAgents.some(a => a.id === editAgentId) && (
                      <option value={editAgentId}>{selectedCustomer?.assignedAgentName || `Agent #${editAgentId}`}</option>
                    )}
                    {availableAgents.map(agent => <option key={agent.id} value={agent.id}>{agent.name}{agent.roleName ? ` · ${agent.roleName}` : ''}</option>)}
                  </select>
                ) : (
                  <input type="text" className="form-input" value={selectedCustomer?.assignedAgentName || 'Unassigned'} readOnly />
                )}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Customer Notes / Overview</label>
              <textarea
                className="form-textarea"
                rows={3}
                value={editNotes}
                onChange={e => setEditNotes(e.target.value)}
                placeholder="Important client history, preferences, or negotiation notes..."
              />
            </div>

            <div className="form-group">
              <label className="form-label">Total Customer Value</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className="form-input"
                value={editTotalValue}
                onChange={e => setEditTotalValue(e.target.value)}
              />
            </div>

            {getCustomFieldDefinitions(tenant?.id)
              .filter((def: CustomFieldDefinition) => def.active !== false && def.module === 'customers')
              .sort((a: CustomFieldDefinition, b: CustomFieldDefinition) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0))
              .map((def: CustomFieldDefinition) => {
                const key = def.fieldKey || def.id;
                const value = editCustomFields[key] ?? def.defaultValue ?? '';
                return (
                  <div key={def.id} className="form-group">
                    <label className="form-label">{def.label || key}{def.required ? ' *' : ''}</label>
                    {def.fieldType === 'select' && def.options?.length ? (
                      <select
                        className="form-select"
                        value={value}
                        onChange={e => setEditCustomFields(prev => ({ ...prev, [key]: e.target.value }))}
                      >
                        <option value="">Select {def.label || key}...</option>
                        {def.options.map(option => <option key={option} value={option}>{option}</option>)}
                      </select>
                    ) : (
                      <input
                        className="form-input"
                        type={def.fieldType === 'number' ? 'number' : 'text'}
                        value={value}
                        onChange={e => setEditCustomFields(prev => ({ ...prev, [key]: e.target.value }))}
                      />
                    )}
                  </div>
                );
              })}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setIsEditModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isSubmittingEdit}
                style={{
                  background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                  borderColor: '#059669',
                  color: '#ffffff',
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <CheckCircle size={15} /> {isSubmittingEdit ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            backgroundColor: '#059669',
            color: '#fff',
            padding: '12px 20px',
            borderRadius: 8,
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          <CheckCircle size={18} /> {toastMessage}
        </div>
      )}
    </div>
  );
};
