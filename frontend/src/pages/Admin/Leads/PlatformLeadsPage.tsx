import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Users,
  Search,
  Filter,
  TrendingUp,
  Building2,
  ChevronDown,
  X,
  RefreshCw,
  Phone,
  Mail,
  MapPin,
  ArrowUpDown,
  CheckCircle2,
  AlertTriangle,
  Flame,
  ArrowUpRight,
  ArrowDownRight,
  ChevronLeft,
  ChevronRight,
  User,
  Tag,
  Calendar,
  BarChart2,
  Activity,
  Inbox,
} from 'lucide-react';
import { superAdminService } from '../../../services/superAdminService';
import { PlatformLead, PlatformLeadSummary, TenantLeadCount } from '../../../types';
import './PlatformLeadsPage.css';

interface PlatformLeadsPageProps {
  onNavigate?: (route: string) => void;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  'New': { label: 'New', color: '#38bdf8', bg: 'rgba(56,189,248,0.12)' },
  'Contacted': { label: 'Contacted', color: '#a78bfa', bg: 'rgba(167,139,250,0.12)' },
  'Callback': { label: 'Callback', color: '#fbbf24', bg: 'rgba(251,191,36,0.12)' },
  'Interested': { label: 'Interested', color: '#34d399', bg: 'rgba(52,211,153,0.12)' },
  'Follow-up Required': { label: 'Follow-up', color: '#fb923c', bg: 'rgba(251,146,60,0.12)' },
  'Not Interested': { label: 'Not Interested', color: '#f87171', bg: 'rgba(248,113,113,0.12)' },
  'Junk': { label: 'Junk', color: '#64748b', bg: 'rgba(100,116,139,0.12)' },
  'Converted': { label: 'Converted', color: '#4ade80', bg: 'rgba(74,222,128,0.12)' },
};

const PRIORITY_CONFIG: Record<string, { color: string }> = {
  'Urgent': { color: '#ef4444' },
  'High': { color: '#f97316' },
  'Medium': { color: '#fbbf24' },
  'Low': { color: '#64748b' },
};

const ALL_STATUSES = ['New', 'Contacted', 'Callback', 'Interested', 'Follow-up Required', 'Not Interested', 'Junk', 'Converted'];
const ALL_PRIORITIES = ['Urgent', 'High', 'Medium', 'Low'];
const PAGE_SIZES = [10, 20, 50, 100];

export const PlatformLeadsPage: React.FC<PlatformLeadsPageProps> = ({ onNavigate }) => {
  const [leads, setLeads] = useState<PlatformLead[]>([]);
  const [summary, setSummary] = useState<PlatformLeadSummary | null>(null);
  const [tenants, setTenants] = useState<TenantLeadCount[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedPriority, setSelectedPriority] = useState('');
  const [selectedTenantId, setSelectedTenantId] = useState<number | undefined>(undefined);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await superAdminService.fetchPlatformLeads({
        page,
        pageSize,
        search: debouncedSearch || undefined,
        status: selectedStatus || undefined,
        priority: selectedPriority || undefined,
        tenantId: selectedTenantId,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        sortBy,
        sortOrder,
      });
      setLeads(res.items);
      setSummary(res.summary);
      setTenants(res.summary.byTenant);
      setTotalCount(res.totalCount);
      setTotalPages(res.totalPages);
    } catch (err: any) {
      setError(err?.message || 'Failed to load leads.');
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, debouncedSearch, selectedStatus, selectedPriority, selectedTenantId, startDate, endDate, sortBy, sortOrder]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => { setPage(1); }, [debouncedSearch, selectedStatus, selectedPriority, selectedTenantId, startDate, endDate]);

  const handleSort = (col: string) => {
    if (sortBy === col) setSortOrder(o => o === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortOrder('desc'); }
    setPage(1);
  };

  const clearFilters = () => {
    setSearch(''); setSelectedStatus(''); setSelectedPriority('');
    setSelectedTenantId(undefined); setStartDate(''); setEndDate('');
  };

  const hasActiveFilters = !!(selectedStatus || selectedPriority || selectedTenantId || startDate || endDate || search);

  const formatDate = (d?: string) => {
    if (!d) return '—';
    try { return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
    catch { return d; }
  };

  const getTimeAgo = (d?: string) => {
    if (!d) return '';
    try {
      const diff = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
      if (diff < 60) return 'Just now';
      if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
      if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
      if (diff < 604800) return Math.floor(diff / 86400) + 'd ago';
      return formatDate(d);
    } catch { return ''; }
  };

  const growthPct = useMemo(() => {
    if (!summary) return { value: 0, positive: true };
    const prev = summary.lastMonthLeads, curr = summary.thisMonthLeads;
    if (prev === 0 && curr === 0) return { value: 0, positive: true };
    if (prev === 0) return { value: 100, positive: true };
    const pct = ((curr - prev) / prev) * 100;
    return { value: Math.abs(pct), positive: pct >= 0 };
  }, [summary]);

  const summaryCards = summary ? [
    { label: 'Total Leads', value: summary.total, color: 'emerald', growth: true },
    { label: 'New', value: summary.newLeads, color: 'blue' },
    { label: 'Interested', value: summary.interestedLeads, color: 'purple' },
    { label: 'Converted', value: summary.convertedLeads, color: 'green' },
    { label: 'Not Interested', value: summary.notInterestedLeads, color: 'red' },
    { label: 'This Month', value: summary.thisMonthLeads, color: 'amber', prevMonth: summary.lastMonthLeads },
  ] : [];

  const TENANT_COLORS = ['#8b5cf6', '#38bdf8', '#34d399', '#fbbf24', '#f97316', '#f43f5e', '#a78bfa', '#4ade80'];

  return (
    <div className="plp-page">
      <div className="plp-header-section">
        <div>
          <div className="plp-badge-row">
            <span className="plp-badge"><span className="plp-live-dot" />CROSS-TENANT LEAD INTELLIGENCE</span>
          </div>
          <h1 className="plp-title">Platform Leads Overview</h1>
          <p className="plp-subtitle">All leads across every tenant organization — aggregated, filterable, and searchable in one view.</p>
        </div>
        <div className="plp-header-actions">
          <button className="btn btn-secondary btn-sm plp-filter-btn" onClick={() => setShowFilters(f => !f)}>
            <Filter size={14} />Filters
            {hasActiveFilters && <span className="plp-filter-badge">{[selectedStatus, selectedPriority, selectedTenantId, startDate, endDate, search].filter(Boolean).length}</span>}
          </button>
          <button className="btn btn-secondary btn-sm" onClick={loadData} disabled={isLoading}>
            <RefreshCw size={14} className={isLoading ? 'plp-spin' : ''} />{isLoading ? 'Syncing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {error && (
        <div className="plp-error-banner"><AlertTriangle size={16} /><span>{error}</span>
          <button onClick={loadData} className="btn btn-secondary btn-xs">Retry</button>
        </div>
      )}

      <div className="plp-summary-grid">
        {summaryCards.map((card: any) => (
          <div key={card.label} className={`plp-stat-card plp-stat-${card.color}`}>
            <div className="plp-stat-label">{card.label.toUpperCase()}</div>
            <div className="plp-stat-value">
              {isLoading ? <span className="plp-stat-skeleton" /> : card.value.toLocaleString()}
            </div>
            {card.growth && summary && (
              <div className="plp-stat-sub">
                <span className={growthPct.positive ? 'plp-trend-positive' : 'plp-trend-negative'}>
                  {growthPct.positive ? '▲' : '▼'} {growthPct.value.toFixed(1)}%
                </span>
                <span className="plp-stat-sub-text">vs last month</span>
              </div>
            )}
            {card.prevMonth !== undefined && (
              <div className="plp-stat-sub">
                <span className="plp-stat-sub-text">prev: {card.prevMonth.toLocaleString()}</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {tenants.length > 0 && (
        <div className="card plp-tenant-dist-card">
          <div className="plp-tenant-dist-header">
            <h3 className="plp-section-title">Leads by Organization</h3>
            <p className="plp-section-sub">Top tenants by total lead volume</p>
          </div>
          <div className="plp-tenant-bars">
            {tenants.slice(0, 8).map((t, i) => {
              const maxCount = tenants[0]?.count || 1;
              const pct = Math.max(2, Math.round((t.count / maxCount) * 100));
              return (
                <div key={t.tenantId} className="plp-tenant-bar-row">
                  <div className="plp-tenant-bar-label">
                    <span className="plp-tenant-avatar" style={{ background: TENANT_COLORS[i % TENANT_COLORS.length] }}>
                      {t.tenantName.slice(0, 2).toUpperCase()}
                    </span>
                    <span className="plp-tenant-name">{t.tenantName}</span>
                  </div>
                  <div className="plp-tenant-bar-track">
                    <div className="plp-tenant-bar-fill" style={{ width: pct + '%', background: TENANT_COLORS[i % TENANT_COLORS.length] }} />
                  </div>
                  <span className="plp-tenant-bar-count">{t.count.toLocaleString()}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {showFilters && (
        <div className="card plp-filter-panel">
          <div className="plp-filter-panel-header">
            <span className="plp-filter-panel-title">Filters</span>
            {hasActiveFilters && <button className="btn btn-ghost btn-xs" onClick={clearFilters}><X size={12} /> Clear all</button>}
          </div>
          <div className="plp-filter-grid">
            <div className="plp-filter-group">
              <label className="plp-filter-label">Search</label>
              <div className="plp-search-wrapper">
                <Search size={14} className="plp-search-icon" />
                <input className="plp-search-input" placeholder="Name, phone, email, location..." value={search} onChange={e => setSearch(e.target.value)} />
                {search && <button className="plp-search-clear" onClick={() => setSearch('')}><X size={12} /></button>}
              </div>
            </div>
            <div className="plp-filter-group">
              <label className="plp-filter-label">Status</label>
              <div className="plp-select-wrapper">
                <ChevronDown size={13} className="plp-select-icon" />
                <select className="plp-select" value={selectedStatus} onChange={e => setSelectedStatus(e.target.value)}>
                  <option value="">All Statuses</option>
                  {ALL_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div className="plp-filter-group">
              <label className="plp-filter-label">Priority</label>
              <div className="plp-select-wrapper">
                <ChevronDown size={13} className="plp-select-icon" />
                <select className="plp-select" value={selectedPriority} onChange={e => setSelectedPriority(e.target.value)}>
                  <option value="">All Priorities</option>
                  {ALL_PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>
            <div className="plp-filter-group">
              <label className="plp-filter-label">Organization</label>
              <div className="plp-select-wrapper">
                <ChevronDown size={13} className="plp-select-icon" />
                <select className="plp-select" value={selectedTenantId ?? ''} onChange={e => setSelectedTenantId(e.target.value ? Number(e.target.value) : undefined)}>
                  <option value="">All Organizations</option>
                  {tenants.map(t => <option key={t.tenantId} value={t.tenantId}>{t.tenantName} ({t.count})</option>)}
                </select>
              </div>
            </div>
            <div className="plp-filter-group">
              <label className="plp-filter-label">From Date</label>
              <input type="date" className="plp-date-input" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div className="plp-filter-group">
              <label className="plp-filter-label">To Date</label>
              <input type="date" className="plp-date-input" value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
          </div>
        </div>
      )}

      <div className="card plp-table-card">
        <div className="plp-table-header">
          <div>
            <h3 className="plp-section-title">All Platform Leads</h3>
            <p className="plp-section-sub">{isLoading ? 'Loading...' : totalCount.toLocaleString() + ' leads across all organizations'}</p>
          </div>
          <div className="plp-table-controls">
            {!showFilters && (
              <div className="plp-search-wrapper plp-inline-search">
                <Search size={14} className="plp-search-icon" />
                <input className="plp-search-input" placeholder="Quick search..." value={search} onChange={e => setSearch(e.target.value)} />
                {search && <button className="plp-search-clear" onClick={() => setSearch('')}><X size={12} /></button>}
              </div>
            )}
            <div className="plp-select-wrapper">
              <ChevronDown size={12} className="plp-select-icon" />
              <select className="plp-select plp-select-sm" value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}>
                {PAGE_SIZES.map(s => <option key={s} value={s}>{s} / page</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="table-responsive">
          <table className="plp-table">
            <thead>
              <tr className="plp-thead-tr">
                <th className="plp-th" style={{ cursor: 'pointer' }} onClick={() => handleSort('name')}>LEAD <ArrowUpDown size={11} className={sortBy === 'name' ? 'plp-sort-active' : ''} /></th>
                <th className="plp-th" style={{ cursor: 'pointer' }} onClick={() => handleSort('tenant')}>ORGANIZATION <ArrowUpDown size={11} className={sortBy === 'tenant' ? 'plp-sort-active' : ''} /></th>
                <th className="plp-th" style={{ cursor: 'pointer' }} onClick={() => handleSort('status')}>STATUS <ArrowUpDown size={11} className={sortBy === 'status' ? 'plp-sort-active' : ''} /></th>
                <th className="plp-th" style={{ cursor: 'pointer' }} onClick={() => handleSort('priority')}>PRIORITY <ArrowUpDown size={11} className={sortBy === 'priority' ? 'plp-sort-active' : ''} /></th>
                <th className="plp-th plp-col-hide-sm">ASSIGNED REP</th>
                <th className="plp-th plp-col-hide-md">SOURCE</th>
                <th className="plp-th plp-col-hide-md">LOCATION</th>
                <th className="plp-th" style={{ cursor: 'pointer' }} onClick={() => handleSort('createdAt')}>CREATED <ArrowUpDown size={11} className={sortBy === 'createdAt' ? 'plp-sort-active' : ''} /></th>
              </tr>
            </thead>
            <tbody>
              {isLoading && leads.length === 0 ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="plp-tbody-tr">
                    {Array.from({ length: 8 }).map((_, j) => (
                      <td key={j} className="plp-td"><div className="plp-skeleton-cell" /></td>
                    ))}
                  </tr>
                ))
              ) : leads.length === 0 ? (
                <tr><td colSpan={8} className="plp-empty-cell">
                  <div className="plp-empty-state">
                    <Users size={40} style={{ color: '#334155', marginBottom: '12px' }} />
                    <div className="plp-empty-title">No leads found</div>
                    <div className="plp-empty-sub">{hasActiveFilters ? 'Try adjusting your filters.' : 'No leads have been created yet across any organization.'}</div>
                    {hasActiveFilters && <button className="btn btn-secondary btn-sm" style={{ marginTop: '12px' }} onClick={clearFilters}>Clear Filters</button>}
                  </div>
                </td></tr>
              ) : (
                leads.map(lead => {
                  const sc = STATUS_CONFIG[lead.status] || { label: lead.status, color: '#94a3b8', bg: 'rgba(148,163,184,0.12)' };
                  const pc = PRIORITY_CONFIG[lead.priority] || { color: '#94a3b8' };
                  return (
                    <tr key={lead.id} className="plp-tbody-tr">
                      <td className="plp-td">
                        <div className="plp-lead-row">
                          <div className="plp-lead-avatar">{lead.name.slice(0, 1).toUpperCase()}</div>
                          <div>
                            <div className="plp-lead-name">{lead.name}</div>
                            <div className="plp-lead-contact">
                              {lead.phone && <span><Phone size={10} /> {lead.phone}</span>}
                              {lead.email && <span><Mail size={10} /> {lead.email}</span>}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="plp-td">
                        <span className="plp-tenant-chip"><Building2 size={11} /><span>{lead.tenantName}</span></span>
                      </td>
                      <td className="plp-td">
                        <span className="plp-status-pill" style={{ color: sc.color, background: sc.bg }}>{sc.label}</span>
                      </td>
                      <td className="plp-td">
                        <span className="plp-priority-pill" style={{ color: pc.color }}>{lead.priority}</span>
                      </td>
                      <td className="plp-td plp-col-hide-sm">
                        {lead.assignedAgentName
                          ? <span className="plp-agent-chip"><User size={11} />{lead.assignedAgentName}</span>
                          : <span className="plp-unassigned">Unassigned</span>}
                      </td>
                      <td className="plp-td plp-col-hide-md">
                        <span className="plp-source-tag"><Tag size={10} />{lead.source || '—'}</span>
                      </td>
                      <td className="plp-td plp-col-hide-md">
                        <span className="plp-location"><MapPin size={10} />{lead.location || '—'}</span>
                      </td>
                      <td className="plp-td">
                        <div className="plp-date-cell">
                          <span className="plp-date-primary">{getTimeAgo(lead.createdAt)}</span>
                          <span className="plp-date-secondary">{formatDate(lead.createdAt)}</span>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="plp-pagination">
            <span className="plp-pagination-info">
              Showing {((page - 1) * pageSize) + 1}–{Math.min(page * pageSize, totalCount)} of {totalCount.toLocaleString()} leads
            </span>
            <div className="plp-pagination-controls">
              <button className="btn btn-secondary btn-xs" disabled={page <= 1 || isLoading} onClick={() => setPage(1)}>«</button>
              <button className="btn btn-secondary btn-xs" disabled={page <= 1 || isLoading} onClick={() => setPage(p => p - 1)}>‹</button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let p: number;
                if (totalPages <= 5) p = i + 1;
                else if (page <= 3) p = i + 1;
                else if (page >= totalPages - 2) p = totalPages - 4 + i;
                else p = page - 2 + i;
                return <button key={p} className={'btn btn-xs ' + (p === page ? 'plp-page-active' : 'btn-secondary')} onClick={() => setPage(p)} disabled={isLoading}>{p}</button>;
              })}
              <button className="btn btn-secondary btn-xs" disabled={page >= totalPages || isLoading} onClick={() => setPage(p => p + 1)}>›</button>
              <button className="btn btn-secondary btn-xs" disabled={page >= totalPages || isLoading} onClick={() => setPage(totalPages)}>»</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
