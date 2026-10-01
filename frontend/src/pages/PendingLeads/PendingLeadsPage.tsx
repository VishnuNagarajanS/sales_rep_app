import React, { useState, useEffect, useMemo } from 'react';
import {
  Clock,
  Users,
  Phone,
  ExternalLink,
  Edit,
  AlertTriangle,
  UserCheck,
  CheckCircle2,
  Search,
  Filter,
  RefreshCw,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import { Lead, User } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useCall } from '../../context/CallContext';
import { storageService } from '../../services/storageService';
import { apiClient } from '../../services/apiClient';
import { adminUserService } from '../../services/adminUserService';
import { loadAgentDirectory, AssignableAgent, persistLeadAssignment } from '../../services/agentDirectory';
import { DataTable, Column, RowAction } from '../../components/common/DataTable';
import { StatusChip } from '../../components/common/StatusChip';
import { Drawer } from '../../components/common/Drawer';
import { Modal } from '../../components/common/Modal';
import { LeadDetailDrawerContent } from '../../components/common/LeadDetailDrawerContent';
import './PendingLeadsPage.css';

// Statuses that represent leads that have moved to the next step / module
const MOVED_LEAD_STATUSES = ['Interested', 'Converted', 'Follow-up Required', 'Not Interested', 'Junk'];

export const PendingLeadsPage: React.FC = () => {
  const { tenant, user } = useAuth();
  const { initiateCall } = useCall();

  const [leads, setLeads] = useState<Lead[]>([]);
  const [usersList, setUsersList] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [roleFilter, setRoleFilter] = useState<'all' | 'sales_executive' | 'irm'>('all');
  const [personFilter, setPersonFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Drawers & Modals
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isDetailDrawerOpen, setIsDetailDrawerOpen] = useState(false);

  // Reassignment Modal State
  const [isReassignModalOpen, setIsReassignModalOpen] = useState(false);
  const [leadToReassign, setLeadToReassign] = useState<Lead | null>(null);
  const [selectedNewAgentId, setSelectedNewAgentId] = useState<string>('');
  const [reassignSuccessMsg, setReassignSuccessMsg] = useState<string>('');

  // Load leads and users
  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Users to get real roles
      let fetchedUsers: User[] = [];
      try {
        fetchedUsers = await adminUserService.getUsers(tenant?.id || '');
      } catch (err) {
        console.warn('Failed to load users from adminUserService, using storage fallback', err);
      }
      setUsersList(fetchedUsers);

      // 2. Fetch Leads
      if (apiClient.isMockMode()) {
        const allLeads = storageService.getLeads(tenant?.id) || [];
        setLeads(allLeads);
      } else {
        try {
          const res = await apiClient.get<any>('/sales-executive/leads?page=1&pageSize=300');
          if (res.success && res.data && res.data.items) {
            const apiLeads = res.data.items.map((item: any) => ({
              ...item,
              id: String(item.id),
              assignedAgentId: item.assignedAgentId ? String(item.assignedAgentId) : undefined,
              customFields: item.customFields || {},
            }));
            setLeads(apiLeads);
          } else {
            const local = storageService.getLeads(tenant?.id) || [];
            setLeads(local);
          }
        } catch (e) {
          const local = storageService.getLeads(tenant?.id) || [];
          setLeads(local);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const handleUpdate = () => loadData();
    window.addEventListener('nexus_storage_updated', handleUpdate);
    return () => window.removeEventListener('nexus_storage_updated', handleUpdate);
  }, [tenant?.id]);

  // Map of agent ID / Name to Role
  const agentRoleMap = useMemo(() => {
    const map = new Map<string, 'sales_executive' | 'irm'>();
    usersList.forEach(u => {
      const code = u.role?.code;
      if (code === 'sales_executive' || code === 'irm') {
        map.set(String(u.id), code);
        map.set(u.name.toLowerCase().trim(), code);
      }
    });
    return map;
  }, [usersList]);

  // 1. Filter ALL assigned leads that are still in initial leads stage (haven't moved to next module)
  const allPendingLeads = useMemo(() => {
    return leads.filter(l => {
      const isAssigned = l.assignedAgentId && l.assignedAgentId !== '0' && l.assignmentStatus !== 'unassigned';
      if (!isAssigned) return false;
      // Stalled in leads stage (not moved to Follow-up, Interested, Converted, Not Interested, Junk)
      return !MOVED_LEAD_STATUSES.includes(l.status);
    });
  }, [leads]);

  // Determine an agent's role
  const getAgentRole = (lead: Lead): 'sales_executive' | 'irm' => {
    const idKey = String(lead.assignedAgentId || '');
    const nameKey = (lead.assignedAgentName || '').toLowerCase().trim();
    if (agentRoleMap.has(idKey)) return agentRoleMap.get(idKey)!;
    if (agentRoleMap.has(nameKey)) return agentRoleMap.get(nameKey)!;
    return 'sales_executive'; // default fallback
  };

  // Available Person Options filtered by selected Role
  const availablePersons = useMemo(() => {
    // Collect all unique agents present in the pending leads
    const agentMap = new Map<string, { id: string; name: string; role: 'sales_executive' | 'irm'; count: number }>();

    allPendingLeads.forEach(l => {
      const name = l.assignedAgentName || 'Unknown Agent';
      const id = String(l.assignedAgentId || name);
      const role = getAgentRole(l);

      if (!agentMap.has(name)) {
        agentMap.set(name, { id, name, role, count: 0 });
      }
      agentMap.get(name)!.count += 1;
    });

    // Also include any DB user matching the role even if 0 pending
    usersList.forEach(u => {
      const role = u.role?.code;
      if ((role === 'sales_executive' || role === 'irm') && !agentMap.has(u.name)) {
        agentMap.set(u.name, { id: String(u.id), name: u.name, role, count: 0 });
      }
    });

    let list = Array.from(agentMap.values());
    if (roleFilter !== 'all') {
      list = list.filter(a => a.role === roleFilter);
    }

    return list.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [allPendingLeads, usersList, roleFilter, agentRoleMap]);

  // Filtered Leads based on all active filter controls
  const filteredLeads = useMemo(() => {
    return allPendingLeads.filter(lead => {
      const agentRole = getAgentRole(lead);

      // Role filter
      if (roleFilter !== 'all' && agentRole !== roleFilter) {
        return false;
      }

      // Person filter
      if (personFilter !== 'all') {
        const matchesName = (lead.assignedAgentName || '').toLowerCase() === personFilter.toLowerCase();
        const matchesId = String(lead.assignedAgentId || '') === personFilter;
        if (!matchesName && !matchesId) return false;
      }

      // Status filter
      if (statusFilter !== 'all' && lead.status !== statusFilter) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const name = (lead.name || '').toLowerCase();
        const phone = (lead.phone || '').toLowerCase();
        const email = (lead.email || '').toLowerCase();
        const location = (lead.location || '').toLowerCase();
        const agentName = (lead.assignedAgentName || '').toLowerCase();
        if (!name.includes(q) && !phone.includes(q) && !email.includes(q) && !location.includes(q) && !agentName.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [allPendingLeads, roleFilter, personFilter, statusFilter, searchQuery, agentRoleMap]);

  // KPI Calculations
  const stats = useMemo(() => {
    const total = allPendingLeads.length;
    const salesExecTotal = allPendingLeads.filter(l => getAgentRole(l) === 'sales_executive').length;
    const irmTotal = allPendingLeads.filter(l => getAgentRole(l) === 'irm').length;
    const freshNewCount = allPendingLeads.filter(l => l.status === 'New').length;
    return { total, salesExecTotal, irmTotal, freshNewCount };
  }, [allPendingLeads, agentRoleMap]);

  // Calculate days in stage
  const getDaysInStage = (lead: Lead): number => {
    const dateStr = lead.assignedAt || lead.createdAt;
    if (!dateStr) return 0;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 0;
    const diffMs = Date.now() - d.getTime();
    return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
  };

  // Reassign Lead Action
  const handleOpenReassign = (lead: Lead) => {
    setLeadToReassign(lead);
    setSelectedNewAgentId('');
    setReassignSuccessMsg('');
    setIsReassignModalOpen(true);
  };

  const handleConfirmReassignment = async () => {
    if (!leadToReassign || !selectedNewAgentId) return;

    const chosenUser = usersList.find(u => String(u.id) === selectedNewAgentId) ||
      availablePersons.find(a => a.id === selectedNewAgentId);

    const newAgentName = chosenUser?.name || 'Assigned Agent';

    const updatedLead: Lead = {
      ...leadToReassign,
      assignedAgentId: selectedNewAgentId,
      assignedAgentName: newAgentName,
      assignedAt: new Date().toISOString(),
      assignmentStatus: 'assigned',
    };

    if (apiClient.isMockMode()) {
      storageService.saveLead(updatedLead);
    } else {
      try {
        const leadId = parseInt(leadToReassign.id, 10);
        const numericAgentId = parseInt(selectedNewAgentId, 10);
        if (!isNaN(leadId) && !isNaN(numericAgentId)) {
          await apiClient.put(`/sales-executive/leads/${leadId}`, {
            assignedAgentId: numericAgentId,
          });
        }
      } catch (err) {
        console.warn('API reassignment update error:', err);
      }
      storageService.saveLead(updatedLead);
    }

    setReassignSuccessMsg(`Lead successfully reassigned to ${newAgentName}!`);
    setTimeout(() => {
      setIsReassignModalOpen(false);
      setLeadToReassign(null);
      loadData();
    }, 1000);
  };

  // Table Columns
  const columns: Column<Lead>[] = [
    {
      key: 'name',
      header: 'Lead Details',
      sortable: true,
      render: l => (
        <div className="pending-lead-name-cell">
          <span className="pending-lead-name">{l.name}</span>
          <span className="pending-lead-contact">
            {l.phone} {l.location ? `• ${l.location}` : ''}
          </span>
        </div>
      ),
    },
    {
      key: 'assignedAgent',
      header: 'Assigned Person & Role',
      sortable: true,
      render: l => {
        const role = getAgentRole(l);
        return (
          <div className="pending-lead-agent-cell">
            <span className="pending-lead-agent-name">{l.assignedAgentName || '—'}</span>
            <span className={`pending-lead-role-badge ${role}`}>
              {role === 'sales_executive' ? 'Sales Exec' : 'IRM'}
            </span>
          </div>
        );
      },
    },
    {
      key: 'status',
      header: 'Current Status',
      sortable: true,
      render: l => <StatusChip status={l.status} />,
    },
    {
      key: 'daysInStage',
      header: 'Age in Leads Stage',
      sortable: true,
      render: l => {
        const days = getDaysInStage(l);
        let ageClass = 'fresh';
        if (days >= 3) ageClass = 'warning';
        if (days >= 7) ageClass = 'stalled';
        return (
          <span className={`pending-lead-stage-age ${ageClass}`}>
            <Clock size={12} /> {days === 0 ? 'Today' : `${days} days pending`}
          </span>
        );
      },
    },
    {
      key: 'priority',
      header: 'Priority',
      sortable: true,
      render: l => <StatusChip status={l.priority} />,
    },
    {
      key: 'investmentCapacity',
      header: 'Capacity / Amount',
      sortable: true,
      render: l => {
        const cap = l.customFields?.investmentCapacity || l.customFields?.budgetRange || '—';
        return <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{cap}</span>;
      },
    },
    {
      key: 'quickCall',
      header: 'Quick Call',
      align: 'center',
      render: l => (
        <div className="pending-lead-quick-call-cell">
          <button
            className="btn btn-call btn-sm btn-icon"
            title={`Call ${l.name}`}
            aria-label={`Call ${l.name}`}
            onClick={e => {
              e.stopPropagation();
              initiateCall(l.name, l.phone, 'lead', l.id);
            }}
          >
            <Phone size={12} color="#ffffff" />
          </button>
        </div>
      ),
    },
  ];

  const rowActions: RowAction<Lead>[] = [
    {
      label: 'View 360 Drawer',
      icon: <ExternalLink size={14} />,
      onClick: l => {
        setSelectedLead(l);
        setIsDetailDrawerOpen(true);
      },
    },
    {
      label: 'Reassign to Another Agent',
      icon: <UserCheck size={14} />,
      onClick: l => handleOpenReassign(l),
    },
  ];

  return (
    <div className="pending-leads-page">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Clock size={24} color="#f59e0b" /> Pending Leads
          </h1>
          <p className="page-subtitle">
            Leads assigned to Sales Executives and IRMs that are still in initial stages and have not yet moved to follow-ups, calls, or consultations.
          </p>
        </div>

        <button
          className="btn btn-secondary btn-sm"
          onClick={loadData}
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Top Metric Cards */}
      <div className="pending-leads-kpi-grid">
        <div className="pending-leads-kpi-card">
          <div className="pending-leads-kpi-icon-box" style={{ backgroundColor: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b' }}>
            <Clock size={22} />
          </div>
          <div className="pending-leads-kpi-info">
            <span className="pending-leads-kpi-label">Total Pending in Leads</span>
            <span className="pending-leads-kpi-value">{stats.total}</span>
            <span className="pending-leads-kpi-subtext">Awaiting first action</span>
          </div>
        </div>

        <div className="pending-leads-kpi-card">
          <div className="pending-leads-kpi-icon-box" style={{ backgroundColor: 'rgba(37, 99, 235, 0.12)', color: '#2563eb' }}>
            <Users size={22} />
          </div>
          <div className="pending-leads-kpi-info">
            <span className="pending-leads-kpi-label">Sales Exec Leads</span>
            <span className="pending-leads-kpi-value">{stats.salesExecTotal}</span>
            <span className="pending-leads-kpi-subtext">Assigned to Sales Execs</span>
          </div>
        </div>

        <div className="pending-leads-kpi-card">
          <div className="pending-leads-kpi-icon-box" style={{ backgroundColor: 'rgba(16, 185, 129, 0.12)', color: '#059669' }}>
            <ShieldCheck size={22} />
          </div>
          <div className="pending-leads-kpi-info">
            <span className="pending-leads-kpi-label">IRM Leads</span>
            <span className="pending-leads-kpi-value">{stats.irmTotal}</span>
            <span className="pending-leads-kpi-subtext">Assigned to IRMs</span>
          </div>
        </div>

        <div className="pending-leads-kpi-card">
          <div className="pending-leads-kpi-icon-box" style={{ backgroundColor: 'rgba(99, 102, 241, 0.12)', color: '#6366f1' }}>
            <AlertTriangle size={22} />
          </div>
          <div className="pending-leads-kpi-info">
            <span className="pending-leads-kpi-label">Uncontacted (New)</span>
            <span className="pending-leads-kpi-value">{stats.freshNewCount}</span>
            <span className="pending-leads-kpi-subtext">Never been contacted</span>
          </div>
        </div>
      </div>

      {/* Filter Controls Bar */}
      <div className="pending-leads-filter-container">
        {/* Search */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 200 }}>
          <Search size={16} color="var(--text-muted)" />
          <input
            type="text"
            className="pending-leads-search-input"
            placeholder="Search by lead name, phone, email, or agent..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Role Filter */}
        <div className="pending-leads-filter-group">
          <label className="pending-leads-filter-label">Role:</label>
          <select
            className="pending-leads-select"
            value={roleFilter}
            onChange={e => {
              setRoleFilter(e.target.value as any);
              setPersonFilter('all'); // Reset person filter when role changes
            }}
          >
            <option value="all">All Roles</option>
            <option value="sales_executive">Sales Executive</option>
            <option value="irm">Investor Relationship Manager (IRM)</option>
          </select>
        </div>

        {/* Person / Agent Filter */}
        <div className="pending-leads-filter-group">
          <label className="pending-leads-filter-label">Assigned Person:</label>
          <select
            className="pending-leads-select"
            value={personFilter}
            onChange={e => setPersonFilter(e.target.value)}
          >
            <option value="all">
              {roleFilter === 'all'
                ? 'All Team Members'
                : roleFilter === 'sales_executive'
                ? 'All Sales Executives'
                : 'All IRMs'}
            </option>
            {availablePersons.map(person => (
              <option key={person.id || person.name} value={person.name}>
                {person.name} ({person.count} pending)
              </option>
            ))}
          </select>
        </div>

        {/* Status Filter */}
        <div className="pending-leads-filter-group">
          <label className="pending-leads-filter-label">Status:</label>
          <select
            className="pending-leads-select"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
          >
            <option value="all">All Pending Statuses</option>
            <option value="New">New (Fresh)</option>
            <option value="Contacted">Contacted</option>
          </select>
        </div>

        {/* Reset button if active filters */}
        {(roleFilter !== 'all' || personFilter !== 'all' || statusFilter !== 'all' || searchQuery) && (
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => {
              setRoleFilter('all');
              setPersonFilter('all');
              setStatusFilter('all');
              setSearchQuery('');
            }}
            style={{ fontSize: 12 }}
          >
            Reset Filters
          </button>
        )}
      </div>

      {/* Data Table */}
      <DataTable<Lead>
        data={filteredLeads}
        columns={columns}
        rowActions={rowActions}
        keyExtractor={l => l.id}
        emptyTitle="No Pending Leads Found"
        emptyDescription={
          personFilter !== 'all'
            ? `${personFilter} has no leads stalled in the initial leads stage. All leads have moved forward!`
            : 'All assigned leads across your team have progressed to follow-ups, calls, or consultations.'
        }
      />

      {/* 360 Detail Drawer */}
      <Drawer
        isOpen={isDetailDrawerOpen}
        onClose={() => setIsDetailDrawerOpen(false)}
        title={selectedLead?.name || 'Lead Details'}
        width={560}
      >
        {selectedLead && (
          <LeadDetailDrawerContent
            contactName={selectedLead.name}
            contactPhone={selectedLead.phone}
            contactId={selectedLead.id}
            contactType="lead"
            tenantId={tenant?.id}
            tenantName={tenant?.name}
            onCall={() => initiateCall(selectedLead.name, selectedLead.phone, 'lead', selectedLead.id)}
          />
        )}
      </Drawer>

      {/* Reassign Modal */}
      <Modal
        isOpen={isReassignModalOpen}
        onClose={() => {
          setIsReassignModalOpen(false);
          setLeadToReassign(null);
        }}
        title="Reassign Pending Lead"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '8px 0' }}>
          {reassignSuccessMsg ? (
            <div style={{ padding: 14, backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#059669', borderRadius: 8, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
              <CheckCircle2 size={18} /> {reassignSuccessMsg}
            </div>
          ) : (
            <>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
                This lead is currently with <strong>{leadToReassign?.assignedAgentName || 'an agent'}</strong> and has not progressed. Select a new person to reassign this lead to:
              </p>

              <div>
                <label className="form-label" style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, display: 'block' }}>
                  Select New Agent:
                </label>
                <select
                  className="pending-leads-select"
                  style={{ width: '100%' }}
                  value={selectedNewAgentId}
                  onChange={e => setSelectedNewAgentId(e.target.value)}
                >
                  <option value="">-- Choose Agent --</option>
                  {usersList
                    .filter(u => u.role?.code === 'sales_executive' || u.role?.code === 'irm')
                    .map(u => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.role?.name || u.role?.code})
                      </option>
                    ))}
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
                <button
                  className="btn btn-secondary"
                  onClick={() => setIsReassignModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-primary"
                  disabled={!selectedNewAgentId}
                  onClick={handleConfirmReassignment}
                >
                  Confirm Reassignment
                </button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
};
