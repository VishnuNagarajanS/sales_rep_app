import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Layers,
  Phone,
  Mail,
  MapPin,
  Calendar,
  User,
  ArrowRight,
  RefreshCw,
  Clock,
  ShieldCheck,
  TrendingUp,
  UserCheck,
  Briefcase,
  CheckCircle2,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCall } from '../../context/CallContext';
import { DataTable, Column } from '../../components/common/DataTable';
import { fetchIrmAllLeads, IrmAllLeadItem, IrmAllLeadsSummary } from '../../services/irmAllLeadsService';
import './AllLeadsPage.css';

interface AllLeadsPageProps {
  onNavigate?: (route: string) => void;
}

export const AllLeadsPage: React.FC<AllLeadsPageProps> = ({ onNavigate }) => {
  const { user, tenant } = useAuth();
  const { initiateCall } = useCall();

  const [summary, setSummary] = useState<IrmAllLeadsSummary>({
    totalAssignedLeads: 0,
    inMyLeads: 0,
    inFollowup: 0,
    inKyc: 0,
    inOpportunities: 0,
    converted: 0,
    leads: [],
  });
  const [loading, setLoading] = useState(true);
  const [selectedStageTab, setSelectedStageTab] = useState<string>('all');
  const [selectedAgentFilter, setSelectedAgentFilter] = useState<string>('all');

  const loadData = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const data = await fetchIrmAllLeads(user.id, undefined, user.name, tenant?.id);
      setSummary(data);
    } catch (err) {
      console.error('Failed to load IRM all leads:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id, user?.name, tenant?.id]);

  useEffect(() => {
    loadData();

    const handleUpdate = () => loadData();
    window.addEventListener('nexus_storage_updated', handleUpdate);
    window.addEventListener('nexus_call_logged', handleUpdate);
    window.addEventListener('storage', handleUpdate);

    return () => {
      window.removeEventListener('nexus_storage_updated', handleUpdate);
      window.removeEventListener('nexus_call_logged', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, [loadData]);

  // Strict double check: filter to ensure strict IRM isolation
  const scopedLeads = useMemo(() => {
    return (summary.leads || []).filter(l => {
      if (user?.role?.code === 'irm') {
        const idMatch = Boolean(l.assignedAgentId && String(l.assignedAgentId) === String(user.id));
        const nameMatch = Boolean(
          l.assignedAgentName && user.name && l.assignedAgentName.trim().toLowerCase() === user.name.trim().toLowerCase()
        );
        if (!idMatch && !nameMatch) {
          return false;
        }
      }
      return true;
    });
  }, [summary.leads, user]);

  // Unique agent / source options for dropdown
  const agentOptions = useMemo(() => {
    const set = new Set<string>();
    scopedLeads.forEach(l => {
      const isIrm =
        !l.assignedByName ||
        l.assignedByName === 'Created by IRM' ||
        !l.assignedById ||
        l.assignedById === l.assignedAgentId;
      const name = isIrm ? (user?.name || 'Dhinakaran') : (l.assignedByName || 'Sales Agent');
      if (name) {
        set.add(name);
      }
    });
    return Array.from(set).sort((a, b) => {
      const myName = user?.name || 'Dhinakaran';
      if (a === myName) return -1;
      if (b === myName) return 1;
      return a.localeCompare(b);
    });
  }, [scopedLeads, user?.name]);

  // Leads filtered by agent selection
  const agentFilteredLeads = useMemo(() => {
    if (selectedAgentFilter === 'all') return scopedLeads;
    return scopedLeads.filter(l => {
      const isIrm =
        !l.assignedByName ||
        l.assignedByName === 'Created by IRM' ||
        !l.assignedById ||
        l.assignedById === l.assignedAgentId;
      const name = isIrm ? (user?.name || 'Dhinakaran') : (l.assignedByName || 'Sales Agent');
      return name === selectedAgentFilter;
    });
  }, [scopedLeads, selectedAgentFilter, user?.name]);

  // Stage counts dynamically updated based on active agent filter
  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: agentFilteredLeads.length,
      'My Leads': 0,
      'Follow-up': 0,
      'KYC': 0,
      'Opportunities': 0,
      'Converted': 0,
    };
    agentFilteredLeads.forEach(l => {
      const st = l.currentStage;
      if (counts[st] !== undefined) {
        counts[st]++;
      }
    });
    return counts;
  }, [agentFilteredLeads]);

  // Final filtered leads for the table
  const filteredLeads = useMemo(() => {
    if (selectedStageTab === 'all') return agentFilteredLeads;
    return agentFilteredLeads.filter(
      l => l.currentStage.toLowerCase() === selectedStageTab.toLowerCase()
    );
  }, [agentFilteredLeads, selectedStageTab]);

  const handleStageNavigation = (stage: string) => {
    if (!onNavigate) return;
    switch (stage.toLowerCase()) {
      case 'my leads':
        onNavigate('leads');
        break;
      case 'follow-up':
        onNavigate('followups');
        break;
      case 'kyc':
        onNavigate('kyc');
        break;
      case 'opportunities':
        onNavigate('opportunities');
        break;
      case 'converted':
        onNavigate('investors');
        break;
      default:
        break;
    }
  };

  const getStageBadge = (stage: string) => {
    switch (stage) {
      case 'My Leads':
        return (
          <span className="all-leads-badge myleads">
            <span className="all-leads-live-dot" />
            My Leads
          </span>
        );
      case 'Follow-up':
        return (
          <span className="all-leads-badge followup">
            <Clock size={11} />
            Follow-up
          </span>
        );
      case 'KYC':
        return (
          <span className="all-leads-badge kyc">
            <ShieldCheck size={11} />
            KYC Stage
          </span>
        );
      case 'Opportunities':
        return (
          <span className="all-leads-badge opps">
            <TrendingUp size={11} />
            Opportunities
          </span>
        );
      case 'Converted':
        return (
          <span className="all-leads-badge converted">
            <CheckCircle2 size={11} />
            Converted
          </span>
        );
      case 'Archived':
        return (
          <span className="all-leads-badge archived">
            Archived
          </span>
        );
      default:
        return (
          <span className="all-leads-badge archived">
            {stage}
          </span>
        );
    }
  };

  const columns: Column<IrmAllLeadItem>[] = [
    {
      key: 'name',
      header: 'NAME & CONTACT',
      sortable: true,
      render: lead => (
        <div>
          <div className="all-leads-investor-name">{lead.name}</div>
          <div className="all-leads-investor-meta">
            <span className="all-leads-meta-span font-mono">
              <Phone size={11} />
              {lead.phone}
            </span>
            {lead.location && (
              <span className="all-leads-meta-span">
                <MapPin size={11} />
                {lead.location}
              </span>
            )}
            {lead.email && (
              <span className="all-leads-meta-span">
                <Mail size={11} />
                {lead.email}
              </span>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'assigned',
      header: 'ASSIGNED INFO',
      sortable: true,
      render: lead => {
        const isIrm =
          !lead.assignedByName ||
          lead.assignedByName === 'Created by IRM' ||
          !lead.assignedById ||
          lead.assignedById === lead.assignedAgentId;
        const displayName = isIrm ? (user?.name || 'Dhinakaran') : (lead.assignedByName || 'Sales Agent');
        return (
          <div>
            <div className="all-leads-assigned-name" style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <User size={12} color={isIrm ? '#8b5cf6' : '#3b82f6'} />
              <span style={{ fontWeight: 600, color: isIrm ? '#c084fc' : 'var(--text-primary)' }}>
                {displayName}
              </span>
              <span className={`badge-role-inline ${isIrm ? 'badge-role-irm' : 'badge-role-sales'}`}>
                {isIrm ? 'IRM' : 'Sales Executive'}
              </span>
            </div>
            <div className="all-leads-assigned-date">
              <Calendar size={11} />
              <span>{lead.assignedAt ? new Date(lead.assignedAt).toLocaleDateString() : 'Initial'}</span>
            </div>
          </div>
        );
      },
    },
    {
      key: 'stage',
      header: 'CURRENT STAGE',
      sortable: true,
      render: lead => getStageBadge(lead.currentStage),
    },
    {
      key: 'details',
      header: 'STAGE DETAILS & CONTEXT',
      render: lead => (
        <div>
          <div style={{ color: 'var(--text-primary)', fontSize: 13, fontWeight: 500 }}>
            {lead.stageDetails || '—'}
          </div>
          {lead.investmentCapacity && (
            <div style={{ color: 'var(--success)', fontSize: 11, fontWeight: 600, marginTop: 2 }}>
              Capacity: {lead.investmentCapacity}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'ACTIONS',
      align: 'right',
      render: lead => (
        <div className="all-leads-action-group">
          {/* Direct Twilio Call */}
          <button
            onClick={() => initiateCall(lead.name, lead.phone, 'lead', String(lead.id), undefined, 'all_leads')}
            title="Call Investor via Twilio"
            className="all-leads-call-action-btn"
          >
            <Phone size={14} />
          </button>

          {/* Jump to Stage */}
          <button
            onClick={() => handleStageNavigation(lead.currentStage)}
            title={`Open in ${lead.currentStage}`}
            className="all-leads-open-action-btn"
          >
            <span>Open</span>
            <ArrowRight size={12} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="all-leads-page-container">
      {/* Page Header */}
      <div className="all-leads-header-row">
        <div className="all-leads-title-group">
          <div className="all-leads-header-icon">
            <Layers size={24} />
          </div>
          <div className="all-leads-title-text">
            <h1>All Assigned Leads</h1>

          </div>
        </div>

        <div className="all-leads-header-actions">
          <button
            onClick={loadData}
            disabled={loading}
            className="all-leads-refresh-button"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="all-leads-kpi-container">
        {/* Card 1: Total */}
        <div
          onClick={() => setSelectedStageTab('all')}
          className={`all-leads-metric-card ${selectedStageTab === 'all' ? 'is-active' : ''}`}
        >
          <div className="all-leads-metric-header">
            <span className="all-leads-metric-label">Total Assigned</span>
            <div className="all-leads-metric-icon total">
              <Layers size={14} />
            </div>
          </div>
          <div className="all-leads-metric-value">{summary.totalAssignedLeads}</div>
          <div className="all-leads-metric-subtext"></div>
        </div>

        {/* Card 2: My Leads */}
        <div
          onClick={() => setSelectedStageTab('My Leads')}
          className={`all-leads-metric-card ${selectedStageTab === 'My Leads' ? 'is-active' : ''}`}
        >
          <div className="all-leads-metric-header">
            <span className="all-leads-metric-label" style={{ color: '#10b981' }}>In "My Leads"</span>
            <div className="all-leads-metric-icon leads">
              <UserCheck size={14} />
            </div>
          </div>
          <div className="all-leads-metric-value">{summary.inMyLeads}</div>
          <div className="all-leads-metric-subtext">Initial / Interested</div>
        </div>

        {/* Card 3: Follow-up */}
        <div
          onClick={() => setSelectedStageTab('Follow-up')}
          className={`all-leads-metric-card ${selectedStageTab === 'Follow-up' ? 'is-active' : ''}`}
        >
          <div className="all-leads-metric-header">
            <span className="all-leads-metric-label" style={{ color: '#f59e0b' }}>In Follow-up</span>
            <div className="all-leads-metric-icon followup">
              <Clock size={14} />
            </div>
          </div>
          <div className="all-leads-metric-value">{summary.inFollowup}</div>
          <div className="all-leads-metric-subtext">Scheduled calls</div>
        </div>

        {/* Card 4: KYC */}
        <div
          onClick={() => setSelectedStageTab('KYC')}
          className={`all-leads-metric-card ${selectedStageTab === 'KYC' ? 'is-active' : ''}`}
        >
          <div className="all-leads-metric-header">
            <span className="all-leads-metric-label" style={{ color: '#8b5cf6' }}>In KYC Stage</span>
            <div className="all-leads-metric-icon kyc">
              <ShieldCheck size={14} />
            </div>
          </div>
          <div className="all-leads-metric-value">{summary.inKyc}</div>
          <div className="all-leads-metric-subtext">Documents / Verification</div>
        </div>

        {/* Card 5: Opportunities */}
        <div
          onClick={() => setSelectedStageTab('Opportunities')}
          className={`all-leads-metric-card ${selectedStageTab === 'Opportunities' ? 'is-active' : ''}`}
        >
          <div className="all-leads-metric-header">
            <span className="all-leads-metric-label" style={{ color: '#0ea5e9' }}>In Opportunities</span>
            <div className="all-leads-metric-icon opps">
              <Briefcase size={14} />
            </div>
          </div>
          <div className="all-leads-metric-value">{summary.inOpportunities}</div>
          <div className="all-leads-metric-subtext">Deals in pipeline</div>
        </div>

        {/* Card 6: Converted */}
        <div
          onClick={() => setSelectedStageTab('Converted')}
          className={`all-leads-metric-card ${selectedStageTab === 'Converted' ? 'is-active' : ''}`}
        >
          <div className="all-leads-metric-header">
            <span className="all-leads-metric-label" style={{ color: '#10b981' }}>Converted</span>
            <div className="all-leads-metric-icon converted">
              <CheckCircle2 size={14} />
            </div>
          </div>
          <div className="all-leads-metric-value">{summary.converted}</div>
          <div className="all-leads-metric-subtext">Closed Won / Funded</div>
        </div>
      </div>

      {/* Shared DataTable Component with Theme and Search Support */}
      <DataTable
        data={filteredLeads}
        columns={columns}
        keyExtractor={item => String(item.id)}
        searchPlaceholder="Search by investor, phone, city, agent..."
        searchFilter={(lead, q) => {
          const query = q.toLowerCase();
          return Boolean(
            lead.name?.toLowerCase().includes(query) ||
            lead.phone?.includes(query) ||
            lead.email?.toLowerCase().includes(query) ||
            lead.location?.toLowerCase().includes(query) ||
            lead.assignedByName?.toLowerCase().includes(query) ||
            lead.currentStage?.toLowerCase().includes(query)
          );
        }}
        emptyTitle="No leads found in this stage"
        emptyDescription="When agents assign leads to you, they will appear in this ledger."
        pageSize={15}
        filtersNode={
          <div className="all-leads-filters-toolbar">
            <div className="all-leads-stage-filter-bar">
              {[
                { id: 'all', label: 'All Stages', count: stageCounts.all },
                { id: 'My Leads', label: 'My Leads', count: stageCounts['My Leads'] },
                { id: 'Follow-up', label: 'Follow-up', count: stageCounts['Follow-up'] },
                { id: 'KYC', label: 'KYC', count: stageCounts['KYC'] },
                { id: 'Opportunities', label: 'Opportunities', count: stageCounts['Opportunities'] },
                { id: 'Converted', label: 'Converted', count: stageCounts['Converted'] },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setSelectedStageTab(tab.id)}
                  className={`all-leads-filter-pill ${selectedStageTab === tab.id ? 'is-active' : ''}`}
                >
                  <span>{tab.label}</span>
                  <span className="all-leads-filter-count">{tab.count}</span>
                </button>
              ))}
            </div>

            {/* Agent / Source Filter Dropdown */}
            <div className="all-leads-agent-filter-wrapper">
              <select
                value={selectedAgentFilter}
                onChange={e => setSelectedAgentFilter(e.target.value)}
                className="all-leads-agent-select"
                title="Filter by Assigner / Creator"
              >
                <option value="all">All Agents & Sources</option>
                {agentOptions.map(agent => (
                  <option key={agent} value={agent}>
                    {agent}
                  </option>
                ))}
              </select>
            </div>
          </div>
        }
      />
    </div>
  );
};
