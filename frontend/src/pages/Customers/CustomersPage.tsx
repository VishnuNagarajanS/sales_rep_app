import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { Customer, CallRecord, Followup, Deal, Lead, IrmProfile } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useCall } from '../../context/CallContext';
import { storageService } from '../../services/storageService';
import { StatusChip } from '../../components/common/StatusChip';
import { Timeline, TimelineEvent } from '../../components/common/Timeline';
import { DocumentUploader } from '../../components/common/DocumentUploader';
import { DocumentList } from '../../components/common/DocumentList';
import { Modal } from '../../components/common/Modal';
import { MOCK_IRMS, INITIAL_CUSTOMERS } from '../../mock_data/mockData';
import './CustomersPage.css';

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

  // Role-based scoping: Sales Executives see only their own customers.
  // Managers / Admins / Super Admins see the full company customer list (no filter).
  const roleCode = user?.role?.code;
  const isExec = roleCode === 'sales_executive';

  // Strict Tenant + Role isolation: IRM assignment is available ONLY in GHL India Ventures -> Sales Executive
  const isGhlTenant = tenant?.slug === 'ghl' || tenant?.name === 'GHL India Ventures' || user?.companySlug === 'ghl' || user?.companyName === 'GHL India Ventures';
  const isSalesExecutive = isExec || user?.role?.name === 'Sales Executive';
  const canAssignToIRM = Boolean(isGhlTenant && isSalesExecutive);

  const scopedCustomers = isExec
    ? customers.filter(c =>
      (c.assignedAgentId && c.assignedAgentId === user?.id) ||
      (c.assignedAgentName && c.assignedAgentName === user?.name)
    )
    : customers;
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'calls' | 'followups' | 'timeline' | 'documents'>('overview');
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
  const [newCustomFields, setNewCustomFields] = useState<Record<string, any>>({});
  const [addErrors, setAddErrors] = useState<{ name?: string; phone?: string }>({});

  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [followups, setFollowups] = useState<Followup[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);

  const loadData = () => {
    let custs = storageService.getCustomers(tenant?.id);
    if (custs.length === 0) {
      INITIAL_CUSTOMERS.filter(c => c.companyId === tenant?.id).forEach(c => storageService.saveCustomer(c));
      custs = storageService.getCustomers(tenant?.id);
    } else if (canAssignToIRM) {
      const hasExecCusts = custs.some(c => (c.assignedAgentId && c.assignedAgentId === user?.id) || (c.assignedAgentName && c.assignedAgentName === user?.name));
      if (!hasExecCusts) {
        INITIAL_CUSTOMERS.filter(c => c.companyId === tenant?.id && c.assignedAgentName === 'Ananya Iyer').forEach(c => storageService.saveCustomer(c));
        custs = storageService.getCustomers(tenant?.id);
      }
    }
    setCustomers(custs);
    // Auto-select from the scoped list so an exec doesn't land on a customer
    // that is invisible in their own filtered left-panel list.
    const firstVisible = isExec
      ? custs.filter(c =>
        (c.assignedAgentId && c.assignedAgentId === user?.id) ||
        (c.assignedAgentName && c.assignedAgentName === user?.name)
      )[0]
      : custs[0];
    if (firstVisible && !selectedCustomer) {
      setSelectedCustomer(firstVisible);
    }
    setCalls(storageService.getCalls(tenant?.id));
    setFollowups(storageService.getFollowups(tenant?.id));
    setDeals(storageService.getDeals(tenant?.id));
  };

  useEffect(() => {
    loadData();
    const handleUpdate = () => loadData();
    window.addEventListener('nexus_storage_updated', handleUpdate);
    return () => window.removeEventListener('nexus_storage_updated', handleUpdate);
  }, [tenant?.id]);

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
    MOCK_IRMS.forEach(irm => {
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
      const availableIrms = MOCK_IRMS.filter(i => i.status === 'Available');
      const pool = availableIrms.length > 0 ? availableIrms : MOCK_IRMS;

      let chosenIrm: IrmProfile;
      let reason: string;

      if (tier === 'Premium') {
        const expIrms = pool.filter(i => i.experienceLevel === 'Experienced');
        const candidatePool = expIrms.length > 0 ? expIrms : pool;
        chosenIrm = candidatePool.reduce((min, curr) => liveCountMap[curr.id] < liveCountMap[min.id] ? curr : min, candidatePool[0]);
        reason = 'Premium → Experienced (Capacity Match)';
      } else if (tier === 'Very High') {
        const expIrms = pool.filter(i => i.experienceLevel === 'Experienced');
        const candidatePool = expIrms.length > 0 ? expIrms : pool;
        chosenIrm = candidatePool.reduce((min, curr) => liveCountMap[curr.id] < liveCountMap[min.id] ? curr : min, candidatePool[0]);
        reason = 'Very High → Experienced (High Performance)';
      } else if (tier === 'High') {
        const highIrms = pool.filter(i => i.experienceLevel === 'Experienced' || i.experienceLevel === 'Mid-Level');
        const candidatePool = highIrms.length > 0 ? highIrms : pool;
        chosenIrm = candidatePool.reduce((min, curr) => liveCountMap[curr.id] < liveCountMap[min.id] ? curr : min, candidatePool[0]);
        reason = chosenIrm.experienceLevel === 'Experienced'
          ? 'High-value → Experienced'
          : 'High-value → Mid-Level (Fair Distribution)';
      } else if (tier === 'Medium') {
        const fresherMid = pool.filter(i => i.experienceLevel === 'Fresher' || i.experienceLevel === 'Mid-Level');
        const candidatePool = fresherMid.length > 0 ? fresherMid : pool;
        chosenIrm = candidatePool.reduce((min, curr) => liveCountMap[curr.id] < liveCountMap[min.id] ? curr : min, candidatePool[0]);
        reason = chosenIrm.experienceLevel === 'Fresher'
          ? 'Medium-value → Fresher (Balanced Workload)'
          : 'Medium-value → Mid-Level (Fair Distribution)';
      } else {
        chosenIrm = pool.reduce((min, curr) => liveCountMap[curr.id] < liveCountMap[min.id] ? curr : min, pool[0]);
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

      setSelectedIrmId(MOCK_IRMS[0]?.id || '');
      setIsManualModalOpen(true);
    } else {
      if (eligibleUnassignedCustomers.length === 0) return;
      const recs = runAutoAssignmentAlgorithm(eligibleUnassignedCustomers);
      setAutoRecommendations(recs);
      setIsAutoPreviewModalOpen(true);
    }
  };

  const handleConfirmManualAssignment = () => {
    const selectedIrm = MOCK_IRMS.find(i => i.id === selectedIrmId);
    if (!selectedIrm) return;

    let assignedCount = 0;
    const allLatest = storageService.getCustomers(tenant?.id);

    selectedCustomerIds.forEach(cid => {
      const cust = allLatest.find(c => c.id === cid);
      if (cust && isCustomerEligibleForIrm(cust)) {
        const updated: Customer = {
          ...cust,
          assignedIrmId: selectedIrm.id,
          assignedIrmName: selectedIrm.name,
          assignedIrmAt: new Date().toISOString(),
          notes: `${cust.notes ? cust.notes + '\n\n' : ''}[${new Date().toLocaleDateString()}] Assigned to IRM: ${selectedIrm.name} by ${user?.name || 'Sales Executive'}`,
        };
        storageService.saveCustomer(updated);
        assignedCount++;
      }
    });

    setIsManualModalOpen(false);
    setIsAssignMode(false);
    setSelectedCustomerIds(new Set());
    loadData();
    showToast(`Successfully assigned ${assignedCount} customer(s) to ${selectedIrm.name}!`);
  };

  const handleConfirmAutoAssignment = () => {
    let assignedCount = 0;
    const allLatest = storageService.getCustomers(tenant?.id);

    autoRecommendations.forEach(rec => {
      const cust = allLatest.find(c => c.id === rec.customerId);
      if (cust && isCustomerEligibleForIrm(cust)) {
        const updated: Customer = {
          ...cust,
          assignedIrmId: rec.recommendedIrmId,
          assignedIrmName: rec.recommendedIrmName,
          assignedIrmAt: new Date().toISOString(),
          notes: `${cust.notes ? cust.notes + '\n\n' : ''}[${new Date().toLocaleDateString()}] Auto-assigned to IRM: ${rec.recommendedIrmName} (${rec.matchReason})`,
        };
        storageService.saveCustomer(updated);
        assignedCount++;
      }
    });

    setIsAutoPreviewModalOpen(false);
    setIsAssignMode(false);
    setSelectedCustomerIds(new Set());
    setAutoRecommendations([]);
    loadData();
    showToast(`Successfully confirmed auto-assignment for ${assignedCount} customer(s)!`);
  };

  const handleUpdateSingleRecommendation = (customerId: string, newIrmId: string) => {
    const newIrm = MOCK_IRMS.find(i => i.id === newIrmId);
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

  // Filter linked records for selected customer
  const customerCalls = calls.filter(
    c => selectedCustomer && (c.contactPhone === selectedCustomer.phone || c.contactName === selectedCustomer.name)
  );

  const customerFollowups = followups.filter(
    f => selectedCustomer && (f.contactPhone === selectedCustomer.phone || f.contactName === selectedCustomer.name)
  );

  const customerDeals = deals.filter(
    d => selectedCustomer && (d.customerId === selectedCustomer.id || d.customerName === selectedCustomer.name)
  );

  const resetAddForm = () => {
    setNewName('');
    setNewPhone('');
    setNewEmail('');
    setNewLocation('');
    setNewStatus('Active');
    setNewCustomFields({});
    setAddErrors({});
  };

  const handleAddCustomer = () => {
    const errors: { name?: string; phone?: string } = {};
    if (!newName.trim()) errors.name = 'Name is required.';
    if (!newPhone.trim()) errors.phone = 'Phone is required.';
    if (Object.keys(errors).length > 0) {
      setAddErrors(errors);
      return;
    }
    const newCustomer: import('../../types').Customer = {
      id: `cust-${Date.now()}`,
      companyId: tenant?.id || '',
      name: newName.trim(),
      phone: newPhone.trim(),
      email: newEmail.trim(),
      status: newStatus,
      assignedAgentId: user?.id || '',
      assignedAgentName: user?.name || '',
      location: newLocation.trim(),
      lastContacted: new Date().toISOString().split('T')[0],
      openDealsCount: 0,
      totalValue: 0,
      createdAt: new Date().toISOString().split('T')[0],
      notes: '',
      customFields: newCustomFields,
    };
    storageService.saveCustomer(newCustomer);
    setIsAddModalOpen(false);
    resetAddForm();
    setSelectedCustomer(newCustomer);
  };

  const formatCurrency = (val: number) => {
    if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`;
    if (val >= 100000) return `₹${(val / 100000).toFixed(1)} L`;
    return `₹${val.toLocaleString('en-IN')}`;
  };

  // Build leads lookup map by last 10 digits of phone once per render
  const leadsByPhone = new Map<string, Lead>();
  (storageService.getLeads(tenant?.id) || []).forEach(l => {
    const digits = (l.phone || '').replace(/\D/g, '').slice(-10);
    if (digits && !leadsByPhone.has(digits)) {
      leadsByPhone.set(digits, l);
    }
  });

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

  const getCustomerValueDisplay = (c: Customer): string => {
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
      rawEvents.push({
        id: c.id,
        type: 'call',
        title: `${c.direction === 'outbound' ? 'Outbound' : 'Inbound'} Call — ${c.disposition}`,
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
      return isNaN(parsed) ? Number.MAX_SAFE_INTEGER : parsed;
    };
    return parseTime(b.timestamp) - parseTime(a.timestamp);
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
            Unified contact view across calls, deals, timeline, and documents for {tenant?.name}.
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
              {filteredCustomers.map(c => {
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
                  <span>📞 {selectedCustomer.phone}</span>
                  {selectedCustomer.email && <span>✉️ {selectedCustomer.email}</span>}
                  <span>📍 {selectedCustomer.location}</span>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="customer-cockpit-actions">
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
                { id: 'calls', label: `Calls (${customerCalls.length})` },
                { id: 'followups', label: `Follow-ups (${customerFollowups.length})` },
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
                        <div className="customer-profile-val">{selectedCustomer.assignedAgentName}</div>
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
                        <span className="customer-profile-label">Investment Range:</span>
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

                  {selectedCustomer.customFields && (() => {
                    const activeDefs = storageService
                      .getCustomFieldDefinitions(tenant?.id)
                      .filter(d => d.active !== false && d.module === 'customers')
                      .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));

                    const rows = activeDefs
                      .map(def => {
                        const key = def.fieldKey || def.id;
                        const val = selectedCustomer.customFields?.[key];
                        if (val === undefined || val === null || val === '') return null;
                        return {
                          id: def.id,
                          label: def.label || key.replace(/([A-Z])/g, ' $1'),
                          value: String(val),
                        };
                      })
                      .filter(Boolean);

                    if (rows.length === 0) return null;

                    return (
                      <div className="card customer-custom-card">
                        <h4 className="customer-custom-heading">
                          Tenant Specific Relationship Attributes
                        </h4>
                        <div className="customer-custom-grid">
                          {rows.map(item => (
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
                    customerFollowups.map(f => (
                      <div
                        key={f.id}
                        className="customer-followup-item"
                      >
                        <div>
                          <div className="customer-followup-header">
                            <span className="customer-followup-notes">{f.notes}</span>
                            <StatusChip status={f.priority} size="sm" />
                          </div>
                          <div className="customer-followup-due">
                            ⏰ Due: {f.scheduledAt} • Assignee: {f.assignedAgentName}
                          </div>
                        </div>

                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => {
                            storageService.saveFollowup({ ...f, status: 'Completed' });
                          }}
                        >
                          Mark Done
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}


              {activeTab === 'timeline' && <Timeline events={timelineEvents} />}

              {activeTab === 'documents' && selectedCustomer && (
                <div className="customer-docs-stack">
                  <DocumentUploader
                    entityType="customer"
                    entityId={selectedCustomer.id}
                    allowedCategories={['KYC', 'Agreement', 'Payment Receipt', 'Identity Proof', 'Other']}
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
        subtitle="Create a fresh customer account and assign it to yourself."
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => { setIsAddModalOpen(false); resetAddForm(); }}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleAddCustomer}>
              Create Customer
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
          {/* Tenant-Specific Custom Fields */}
          {(() => {
            const customerDefs = storageService
              .getCustomFieldDefinitions(tenant?.id)
              .filter(d => d.active !== false && d.module === 'customers')
              .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));

            if (customerDefs.length === 0) return null;

            return customerDefs.map(def => {
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
                      onChange={e => setNewCustomFields(prev => ({ ...prev, [key]: e.target.value }))}
                    >
                      {!def.defaultValue && !def.options.includes(val) && (
                        <option value="">Select {def.label}...</option>
                      )}
                      {def.options.map(opt => (
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
                      onChange={e => setNewCustomFields(prev => ({ ...prev, [key]: e.target.value }))}
                    />
                  )}
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
            {MOCK_IRMS.map(irm => {
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
                          {MOCK_IRMS.map(irm => (
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