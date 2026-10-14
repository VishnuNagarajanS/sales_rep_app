import React, { useState, useEffect, useMemo } from 'react';
import { Users, Search, RefreshCw, Trash2, Calendar as CalendarIcon, User as UserIcon, Briefcase } from 'lucide-react';
import { Lead, User, IrmProfile } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { apiClient } from '../../services/apiClient';
import { DataTable, Column } from '../../components/common/DataTable';
import { StatusChip } from '../../components/common/StatusChip';
import { adminUserService } from '../../services/adminUserService';
import { getCompanyIrms } from '../../services/ghlApiService';
import { storageService } from '../../services/storageService';
import '../Leads/LeadsPage.css';

export const ArchivedLeadsPage: React.FC = () => {
  const { tenant } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [roleFilter, setRoleFilter] = useState<'all' | 'sales_executive' | 'irm'>('all');
  const [personFilter, setPersonFilter] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Available users and IRMs
  const [usersList, setUsersList] = useState<User[]>([]);
  const [companyIrms, setCompanyIrms] = useState<IrmProfile[]>([]);

  useEffect(() => {
    const fetchTeam = async () => {
      try {
        const fetchedUsers = await adminUserService.getUsers(tenant?.id || tenant?.slug || '1');
        setUsersList(fetchedUsers || []);
      } catch (e) {
        console.warn('Failed to load users from adminUserService, using storage fallback', e);
      }

      try {
        const irms = await getCompanyIrms(tenant?.id);
        if (irms && irms.length > 0) {
          setCompanyIrms(irms);
        } else {
          setCompanyIrms(storageService.getIrms(tenant?.id) || []);
        }
      } catch (e) {
        setCompanyIrms(storageService.getIrms(tenant?.id) || []);
      }
    };
    fetchTeam();
  }, [tenant?.id, tenant?.slug]);

  const loadData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const res: any = await apiClient.get(`/ghl/archived-leads?${params.toString()}`);
      
      if (res.success) {
        setLeads(res.data);
      }
    } catch (err) {
      console.error('Failed to load archived leads', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [tenant?.id, startDate, endDate]);

  // Determine an agent/owner's role and display name for a lead
  const getLeadRoleAndPerson = (lead: Lead) => {
    const irmName = (lead.assignedIrmName || lead.customFields?.assignedIrmName || '').toString().trim();
    const agentName = (lead.assignedAgentName || '').trim();
    const agentRole = (lead as any).assignedAgentRole || (lead as any).assignedRole;

    if (agentRole === 'irm') {
      return { role: 'irm' as const, personName: agentName || irmName || '—', personId: String(lead.assignedAgentId || '') };
    }

    if (irmName) {
      return { role: 'irm' as const, personName: irmName, personId: String(lead.assignedIrmId || lead.customFields?.assignedIrmId || '') };
    }

    // Match with known users
    const matchUser = usersList.find(u =>
      (lead.assignedAgentId && String(u.id) === String(lead.assignedAgentId)) ||
      (agentName && u.name.toLowerCase().trim() === agentName.toLowerCase())
    );
    if (matchUser) {
      const code = (matchUser.role?.code || '').toLowerCase();
      const isIrm = code === 'irm' || (matchUser.role?.name || '').toLowerCase().includes('irm') || (matchUser.role?.name || '').toLowerCase().includes('investor');
      return {
        role: (isIrm ? 'irm' : 'sales_executive') as 'sales_executive' | 'irm',
        personName: matchUser.name,
        personId: String(matchUser.id)
      };
    }

    // Match with company IRMs
    const matchIrm = companyIrms.find(i =>
      (lead.assignedAgentId && String(i.id) === String(lead.assignedAgentId)) ||
      (agentName && i.name.toLowerCase().trim() === agentName.toLowerCase())
    );
    if (matchIrm) {
      return { role: 'irm' as const, personName: matchIrm.name, personId: String(matchIrm.id) };
    }

    return {
      role: 'sales_executive' as const,
      personName: agentName || '—',
      personId: String(lead.assignedAgentId || '')
    };
  };

  // Available persons filtered by selected role
  const availablePersons = useMemo(() => {
    const personMap = new Map<string, { id: string; name: string; role: 'sales_executive' | 'irm' }>();

    // 1. Users from adminUserService
    usersList.forEach(u => {
      const code = (u.role?.code || '').toLowerCase();
      const roleName = (u.role?.name || '').toLowerCase();
      const isSales = code === 'sales_executive' || roleName.includes('sales');
      const isIrm = code === 'irm' || roleName.includes('irm') || roleName.includes('investor');

      if (isSales) {
        personMap.set(u.name.toLowerCase().trim(), { id: String(u.id), name: u.name, role: 'sales_executive' });
      } else if (isIrm) {
        personMap.set(u.name.toLowerCase().trim(), { id: String(u.id), name: u.name, role: 'irm' });
      }
    });

    // 2. Company IRMs
    companyIrms.forEach(i => {
      const key = i.name.toLowerCase().trim();
      if (!personMap.has(key)) {
        personMap.set(key, { id: String(i.id), name: i.name, role: 'irm' });
      }
    });

    // 3. Storage fallbacks
    const storageAgents = storageService.getAgents(tenant?.id);
    (storageAgents || []).forEach(a => {
      const key = a.name.toLowerCase().trim();
      if (!personMap.has(key)) {
        personMap.set(key, { id: String(a.id), name: a.name, role: 'sales_executive' });
      }
    });

    // 4. Persons present on leads
    leads.forEach(l => {
      const agentName = (l.assignedAgentName || '').trim();
      const irmName = (l.assignedIrmName || l.customFields?.assignedIrmName || '').toString().trim();
      const agentRole = (l as any).assignedAgentRole || (l as any).assignedRole;

      if (agentName && !personMap.has(agentName.toLowerCase())) {
        personMap.set(agentName.toLowerCase(), {
          id: String(l.assignedAgentId || agentName),
          name: agentName,
          role: agentRole === 'irm' ? 'irm' : 'sales_executive'
        });
      }
      if (irmName && !personMap.has(irmName.toLowerCase())) {
        personMap.set(irmName.toLowerCase(), {
          id: String(l.assignedIrmId || l.customFields?.assignedIrmId || irmName),
          name: irmName,
          role: 'irm'
        });
      }
    });

    let list = Array.from(personMap.values());
    if (roleFilter !== 'all') {
      list = list.filter(p => p.role === roleFilter);
    }
    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [usersList, companyIrms, leads, roleFilter, tenant?.id]);

  const filteredLeads = leads.filter(lead => {
    // 1. Status Filter
    if (statusFilter !== 'all') {
      if (statusFilter === 'Not Interested') {
        if (lead.status !== 'Not Interested') return false;
      } else if (statusFilter === 'Junk') {
        if (lead.status !== 'Junk' && lead.status !== 'Wrong Number') return false;
      } else if (lead.status !== statusFilter) {
        return false;
      }
    }

    // 2. Role and Person Filter
    const { role, personName, personId } = getLeadRoleAndPerson(lead);
    if (roleFilter !== 'all' && role !== roleFilter) {
      return false;
    }

    if (personFilter !== 'all' && personFilter !== '') {
      const target = personFilter.trim().toLowerCase();
      const matchesName = (personName || '').trim().toLowerCase() === target;
      const matchesAgent = (lead.assignedAgentName || '').trim().toLowerCase() === target;
      const matchesIrm = (lead.assignedIrmName || lead.customFields?.assignedIrmName || '').toString().trim().toLowerCase() === target;
      const matchesId = personId === target;

      if (!matchesName && !matchesAgent && !matchesIrm && !matchesId) {
        return false;
      }
    }

    // 3. Search Query
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const reason = ((lead as any).reason || lead.customFields?.dispositionReason || lead.notes || '').toLowerCase();
      return (
        lead.name.toLowerCase().includes(q) ||
        (lead.email && lead.email.toLowerCase().includes(q)) ||
        (lead.phone && lead.phone.includes(q)) ||
        (lead.status && lead.status.toLowerCase().includes(q)) ||
        reason.includes(q)
      );
    }
    return true;
  });

  const columns: Column<Lead>[] = [
    {
      header: 'LEAD NAME & CONTACT',
      key: 'name',
      render: (row: Lead) => (
        <div className="lead-name-cell">
          <div className="lead-name-primary">{row.name}</div>
          <div className="lead-text-muted">{row.phone}</div>
        </div>
      ),
    },
    {
      header: 'EMAIL',
      key: 'email',
      render: (row: Lead) => <span className="lead-text-muted">{row.email || '—'}</span>
    },
    {
      header: 'ASSIGNED PERSON',
      key: 'assignedAgentName',
      render: (row: any) => {
        const { role, personName } = getLeadRoleAndPerson(row);
        const displayName = personName && personName !== '—' ? personName : (row.assignedAgentName || 'Unassigned');
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className="lead-agent-name">{displayName}</span>
            {displayName !== 'Unassigned' && (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  padding: '1px 5px',
                  borderRadius: 4,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  background: role === 'irm' ? 'rgba(168, 85, 247, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                  color: role === 'irm' ? '#c084fc' : '#60a5fa',
                  border: `1px solid ${role === 'irm' ? 'rgba(168, 85, 247, 0.3)' : 'rgba(59, 130, 246, 0.3)'}`
                }}
              >
                {role === 'irm' ? 'IRM' : 'Sales Exec'}
              </span>
            )}
          </div>
        );
      }
    },
    {
      header: 'STATUS',
      key: 'status',
      render: (row: Lead) => <StatusChip status={row.status} />
    },
    {
      header: 'REASON / NOTES',
      key: 'reason' as any,
      render: (row: any) => {
        const reasonText = row.reason || row.customFields?.dispositionReason || row.notes || '';
        if (!reasonText) return <span style={{ color: 'var(--text-muted)', fontSize: 12, fontStyle: 'italic' }}>—</span>;
        const firstLine = reasonText.split('\n')[0];
        const isTruncated = firstLine.length < reasonText.length || firstLine.length > 50;
        const displayText = firstLine.length > 50 ? firstLine.slice(0, 50) + '…' : firstLine;
        return (
          <span
            title={reasonText}
            style={{
              fontSize: 12,
              color: 'var(--text-secondary)',
              maxWidth: 220,
              display: 'block',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              cursor: isTruncated ? 'help' : 'default',
            }}
          >
            {displayText}
          </span>
        );
      }
    },
    {
      header: 'UPDATED AT',
      key: 'updatedAt',
      render: (row: Lead) => (
        <span className="lead-text-muted">
          {row.updatedAt ? new Date(row.updatedAt).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
        </span>
      )
    },
  ];

  return (
    <div className="leads-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <Trash2 size={24} className="text-primary" />
            Archived Leads
          </h1>
          <p className="page-subtitle">View Junk and Not Interested leads for your organization.</p>
        </div>
        <div className="leads-header-actions">
          <button className="btn btn-secondary btn-icon" onClick={loadData} disabled={loading} title="Refresh">
            <RefreshCw size={18} className={loading ? 'spin' : ''} />
          </button>
        </div>
      </div>

      <div className="filterbar-container card" style={{ padding: '12px 16px' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: 11, color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="form-input"
            style={{ paddingLeft: 36 }}
            placeholder="Search archived leads..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        
        {/* Status Filter */}
        <div className="filterbar-item">
          <label className="filterbar-label">
            Status:
          </label>
          <select 
            className="filterbar-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Archived</option>
            <option value="Not Interested">Not Interested</option>
            <option value="Junk">Junk</option>
          </select>
        </div>

        {/* Role Filter */}
        <div className="filterbar-item">
          <label className="filterbar-label">
            <Briefcase size={14} />
            Role:
          </label>
          <select 
            className="filterbar-select"
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value as any);
              setPersonFilter('all');
            }}
          >
            <option value="all">All Roles</option>
            <option value="sales_executive">Sales Executive</option>
            <option value="irm">IRM</option>
          </select>
        </div>

        {/* Person Filter */}
        <div className="filterbar-item">
          <label className="filterbar-label">
            <UserIcon size={14} />
            Person:
          </label>
          <select 
            className="filterbar-select"
            value={personFilter}
            onChange={(e) => setPersonFilter(e.target.value)}
          >
            <option value="all">
              {roleFilter === 'all'
                ? 'All Team Members'
                : roleFilter === 'sales_executive'
                ? 'All Sales Executives'
                : 'All IRMs'}
            </option>
            {availablePersons.map(p => (
              <option key={p.id || p.name} value={p.name}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        {/* Date Range Filter */}
        <div className="filterbar-item">
          <label className="filterbar-label">
            <CalendarIcon size={14} />
            Date:
          </label>
          <input 
            type="date" 
            className="form-input" 
            style={{ width: 130 }}
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
          <span style={{ color: 'var(--text-muted)' }}>to</span>
          <input 
            type="date" 
            className="form-input" 
            style={{ width: 130 }}
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
      </div>

      <div className="data-table-container card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '64px', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading archived leads...</div>
        ) : (
          <DataTable
            columns={columns}
            data={filteredLeads}
            keyExtractor={(row) => row.id}
            emptyTitle="No Archived Leads Found"
            emptyDescription="Try adjusting your filters or search query."
          />
        )}
      </div>
    </div>
  );
};
