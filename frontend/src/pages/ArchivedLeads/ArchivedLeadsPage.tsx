import React, { useState, useEffect } from 'react';
import { Users, Search, RefreshCw, Trash2, Calendar as CalendarIcon, User as UserIcon } from 'lucide-react';
import { Lead } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { apiClient } from '../../services/apiClient';
import { DataTable, Column } from '../../components/common/DataTable';
import { StatusChip } from '../../components/common/StatusChip';
import '../Leads/LeadsPage.css';

import { loadAgentDirectory } from '../../services/agentDirectory';

export const ArchivedLeadsPage: React.FC = () => {
  const { tenant } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [agentIdFilter, setAgentIdFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Available agents for filter
  const [agents, setAgents] = useState<{id: string, name: string}[]>([]);

  useEffect(() => {
    const fetchAgents = async () => {
      try {
        const dir = await loadAgentDirectory(tenant?.id?.toString());
        // loadAgentDirectory already only returns Sales Executives
        setAgents(dir.agents.map(a => ({ id: a.id, name: a.name })));
      } catch (e) {
        console.error("Failed to load agents", e);
      }
    };
    fetchAgents();
  }, [tenant?.id]);

  const loadData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (agentIdFilter) params.append('agentId', agentIdFilter);
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
  }, [tenant?.id, agentIdFilter, startDate, endDate]);

  const filteredLeads = leads.filter(lead => {
    if (statusFilter !== 'all' && lead.status !== statusFilter) return false;
    
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        lead.name.toLowerCase().includes(q) ||
        (lead.email && lead.email.toLowerCase().includes(q)) ||
        (lead.phone && lead.phone.includes(q))
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
      header: 'ASSIGNED AGENT',
      key: 'assignedAgentName',
      render: (row: any) => <span className="lead-agent-name">{row.assignedAgentName || 'Unassigned'}</span>
    },
    {
      header: 'STATUS',
      key: 'status',
      render: (row: Lead) => <StatusChip status={row.status} />
    },
    {
      header: 'UPDATED AT',
      key: 'updatedAt',
      render: (row: Lead) => (
        <span className="lead-text-muted">
          {new Date(row.updatedAt).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
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
        
        <div className="filterbar-item">
          <label className="filterbar-label">
            Status:
          </label>
          <select 
            className="filterbar-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All</option>
            <option value="Junk">Junk</option>
            <option value="Not Interested">Not Interested</option>
          </select>
        </div>

        <div className="filterbar-item">
          <label className="filterbar-label">
            <UserIcon size={14} />
            Agent:
          </label>
          <select 
            className="filterbar-select"
            value={agentIdFilter}
            onChange={(e) => setAgentIdFilter(e.target.value)}
          >
            <option value="">All Agents</option>
            {agents.map(a => (
              <option key={a.id} value={a.id.toString()}>{a.name}</option>
            ))}
          </select>
        </div>

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
        <DataTable
          columns={columns}
          data={filteredLeads}
          keyExtractor={(row) => row.id}
          isLoading={loading}
          emptyMessage={
            <div style={{ padding: '64px 24px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ width: 64, height: 64, borderRadius: '50%', backgroundColor: 'rgba(100, 116, 139, 0.1)', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
                <Trash2 size={32} />
              </div>
              <h3 style={{ margin: '0 0 8px', color: 'var(--text-primary)', fontSize: 18, fontWeight: 600 }}>No Archived Leads Found</h3>
              <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 14 }}>Try adjusting your filters or search query.</p>
            </div>
          }
        />
      </div>
    </div>
  );
};
