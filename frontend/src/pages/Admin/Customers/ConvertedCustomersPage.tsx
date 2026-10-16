import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Users,
  Search,
  Filter,
  DollarSign,
  TrendingUp,
  Calendar,
  Building2,
  UserCheck,
  Award,
  ChevronDown,
  X,
  ExternalLink,
  RefreshCw,
  Download,
  Phone,
  Mail,
  MapPin,
  Briefcase,
  Layers,
  ArrowUpDown,
  CheckCircle2,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import {
  convertedCustomerService,
  ConvertedCustomer,
  ConvertedCustomerSummary,
  ConvertedCustomersQueryParams,
} from '../../../services/convertedCustomerService';
import './ConvertedCustomersPage.css';

interface ConvertedCustomersPageProps {
  onNavigate?: (route: string) => void;
}

export const ConvertedCustomersPage: React.FC<ConvertedCustomersPageProps> = ({ onNavigate }) => {
  const { isSuperAdmin, tenant, user } = useAuth();

  // State
  const [customers, setCustomers] = useState<ConvertedCustomer[]>([]);
  const [summary, setSummary] = useState<ConvertedCustomerSummary>({
    totalConvertedCustomers: 0,
    totalCommittedAmount: 0,
    averageCommittedValue: 0,
    convertedThisMonth: 0,
  });
  const [totalCount, setTotalCount] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedTenant, setSelectedTenant] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [activePreset, setActivePreset] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('conversionDate');
  const [sortOrder, setSortOrder] = useState<string>('desc');

  // Selected Customer for Details Drawer
  const [selectedCustomer, setSelectedCustomer] = useState<ConvertedCustomer | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);

  // Fetch Converted Customers
  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params: ConvertedCustomersQueryParams = {
        search: searchTerm.trim() || undefined,
        status: selectedStatus !== 'all' ? selectedStatus : undefined,
        sortBy,
        sortOrder,
        page,
        pageSize,
      };

      if (isSuperAdmin) {
        if (selectedTenant !== 'all') {
          params.tenantId = selectedTenant;
        }
      }

      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      const res = await convertedCustomerService.getConvertedCustomers(params);
      setCustomers(res.items || []);
      setSummary(res.summary);
      setTotalCount(res.totalCount);
      setTotalPages(res.totalPages);
    } catch (err: any) {
      console.error('Failed to load converted customers:', err);
      setError(err?.message || 'Failed to retrieve converted customer data.');
    } finally {
      setIsLoading(false);
    }
  }, [searchTerm, selectedTenant, selectedStatus, startDate, endDate, sortBy, sortOrder, page, pageSize, isSuperAdmin]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Quick Date Presets
  const applyDatePreset = (preset: string) => {
    setActivePreset(preset);
    const now = new Date();

    if (preset === 'all') {
      setStartDate('');
      setEndDate('');
    } else if (preset === 'this_month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      setStartDate(start.toISOString().split('T')[0]);
      setEndDate(now.toISOString().split('T')[0]);
    } else if (preset === 'last_30_days') {
      const start = new Date();
      start.setDate(now.getDate() - 30);
      setStartDate(start.toISOString().split('T')[0]);
      setEndDate(now.toISOString().split('T')[0]);
    } else if (preset === 'this_quarter') {
      const quarterMonth = Math.floor(now.getMonth() / 3) * 3;
      const start = new Date(now.getFullYear(), quarterMonth, 1);
      setStartDate(start.toISOString().split('T')[0]);
      setEndDate(now.toISOString().split('T')[0]);
    }
    setPage(1);
  };

  const handleResetFilters = () => {
    setSearchTerm('');
    setSelectedTenant('all');
    setSelectedStatus('all');
    setStartDate('');
    setEndDate('');
    setActivePreset('all');
    setSortBy('conversionDate');
    setSortOrder('desc');
    setPage(1);
  };

  // Currency Formatter
  const formatCurrency = (val: number): string => {
    if (!val || val === 0) return '₹0';
    if (val >= 10000000) {
      const cr = val / 10000000;
      return `₹${cr.toLocaleString('en-IN', { maximumFractionDigits: 2 })} Cr`;
    }
    if (val >= 100000) {
      const l = val / 100000;
      return `₹${l.toLocaleString('en-IN', { maximumFractionDigits: 2 })} L`;
    }
    return `₹${val.toLocaleString('en-IN')}`;
  };

  // Precise Full Currency Formatter for Tooltips/Details
  const formatFullCurrency = (val: number): string => {
    if (!val) return '₹0';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(val);
  };

  // Date Formatter
  const formatDate = (dateStr?: string): string => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const formatDateTime = (dateStr?: string): string => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  // Export to CSV
  const handleExportCsv = () => {
    if (!customers.length) return;
    const headers = [
      'Customer Code',
      'Customer Name',
      'Email',
      'Phone',
      'Location',
      'Tenant / Company',
      'Assigned Rep',
      'Role',
      'Committed Amount (INR)',
      'Lead Source',
      'Status',
      'Conversion Date',
      'Related Deal',
    ];

    const rows = customers.map(c => [
      c.customerCode,
      `"${c.name.replace(/"/g, '""')}"`,
      c.email,
      c.phone,
      `"${c.location.replace(/"/g, '""')}"`,
      `"${c.companyName.replace(/"/g, '""')}"`,
      `"${c.assignedAgentName.replace(/"/g, '""')}"`,
      c.assignedAgentRole,
      c.committedAmount,
      `"${c.originalLeadSource.replace(/"/g, '""')}"`,
      c.status,
      c.conversionDate,
      `"${(c.relatedDealTitle || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `NexusSales_Converted_Customers_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleOpenDrawer = (cust: ConvertedCustomer) => {
    setSelectedCustomer(cust);
    setIsDrawerOpen(true);
  };

  const handleCloseDrawer = () => {
    setIsDrawerOpen(false);
    setSelectedCustomer(null);
  };

  return (
    <div className="converted-customers-container">
      {/* ── Top Header ──────────────────────────────────────────────────────── */}
      <div className="cc-header">
        <div className="cc-header-left">
          <div className="cc-breadcrumbs">
            <span
              className="cc-breadcrumb-item"
              onClick={() => onNavigate && onNavigate(isSuperAdmin ? 'admin-dashboard' : 'dashboard')}
            >
              {isSuperAdmin ? 'Platform Console' : 'Dashboard'}
            </span>
            <span className="cc-breadcrumb-sep">/</span>
            <span className="cc-breadcrumb-active">Converted Customers</span>
          </div>

          <div className="cc-title-row">
            <h1 className="cc-title">Converted Customers</h1>
            <span className="cc-scope-badge">
              <span className="cc-scope-dot" />
              {isSuperAdmin ? 'Cross-Tenant Scope' : tenant?.name || 'Company Scope'}
            </span>
          </div>

          <p className="cc-subtitle">
            Authoritative registry of legitimately converted customer accounts, committed contract values, and lifecycle milestones across NexusSales.
          </p>
        </div>

        <div className="cc-header-actions">
          <button className="cc-btn cc-btn-secondary" onClick={loadData} title="Refresh records from real database">
            <RefreshCw size={15} className={isLoading ? 'spin-icon' : ''} /> Refresh
          </button>
          <button className="cc-btn cc-btn-secondary" onClick={handleExportCsv} disabled={customers.length === 0} title="Export current list to CSV">
            <Download size={15} /> Export CSV
          </button>
          {onNavigate && (
            <button
              className="cc-btn cc-btn-primary"
              onClick={() => onNavigate(isSuperAdmin ? 'admin-users' : 'customers')}
            >
              <ExternalLink size={15} /> Open Customers 360
            </button>
          )}
        </div>
      </div>

      {/* ── Error Banner ────────────────────────────────────────────────────── */}
      {error && (
        <div className="cc-error-banner">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertTriangle size={18} />
            <span>{error}</span>
          </div>
          <button className="cc-btn cc-btn-secondary" style={{ padding: '4px 10px' }} onClick={loadData}>
            Retry
          </button>
        </div>
      )}

      {/* ── Summary KPI Cards ───────────────────────────────────────────────── */}
      <div className="cc-kpi-grid">
        {/* Card 1: Total Converted Customers */}
        <div className="cc-kpi-card cc-kpi-blue">
          <div className="cc-kpi-top">
            <span className="cc-kpi-label">TOTAL CONVERTED CUSTOMERS</span>
            <div className="cc-kpi-icon-box cc-icon-blue">
              <Users size={18} />
            </div>
          </div>
          <div className="cc-kpi-value cc-text-blue">
            {summary.totalConvertedCustomers.toLocaleString()}
          </div>
          <div className="cc-kpi-sub">
            <span className="cc-kpi-pill cc-pill-positive">
              <CheckCircle2 size={12} /> Confirmed Accounts
            </span>
            <span>Real Database Records</span>
          </div>
        </div>

        {/* Card 2: Total Committed Amount */}
        <div className="cc-kpi-card cc-kpi-amber">
          <div className="cc-kpi-top">
            <span className="cc-kpi-label">TOTAL COMMITTED AMOUNT</span>
            <div className="cc-kpi-icon-box cc-icon-amber">
              <Layers size={18} color="#fbbf24" />
            </div>
          </div>
          <div className="cc-kpi-value cc-text-amber" title={formatFullCurrency(summary.totalCommittedAmount)}>
            {formatCurrency(summary.totalCommittedAmount)}
          </div>
          <div className="cc-kpi-sub">
            <span className="cc-kpi-pill cc-pill-positive">
              <Award size={12} /> Active Commitments
            </span>
            <span title="Full amount">{formatFullCurrency(summary.totalCommittedAmount)}</span>
          </div>
        </div>

        {/* Card 3: Average Committed Value */}
        <div className="cc-kpi-card cc-kpi-emerald">
          <div className="cc-kpi-top">
            <span className="cc-kpi-label">AVERAGE COMMITTED VALUE</span>
            <div className="cc-kpi-icon-box cc-icon-emerald">
              <TrendingUp size={18} color="#34d399" />
            </div>
          </div>
          <div className="cc-kpi-value cc-text-emerald" title={formatFullCurrency(summary.averageCommittedValue)}>
            {formatCurrency(summary.averageCommittedValue)}
          </div>
          <div className="cc-kpi-sub">
            <span className="cc-kpi-pill cc-pill-neutral">Per Account Average</span>
            <span>Calculated</span>
          </div>
        </div>

        {/* Card 4: Converted This Month */}
        <div className="cc-kpi-card cc-kpi-violet">
          <div className="cc-kpi-top">
            <span className="cc-kpi-label">CONVERTED THIS MONTH</span>
            <div className="cc-kpi-icon-box cc-icon-violet">
              <Calendar size={18} color="#a78bfa" />
            </div>
          </div>
          <div className="cc-kpi-value cc-text-violet">
            {summary.convertedThisMonth.toLocaleString()}
          </div>
          <div className="cc-kpi-sub">
            <span className="cc-kpi-pill cc-pill-positive">
              <Clock size={12} /> Recent Conversions
            </span>
            <span>Current Calendar Month</span>
          </div>
        </div>
      </div>

      {/* ── Filter Toolbar ──────────────────────────────────────────────────── */}
      <div className="cc-toolbar">
        <div className="cc-toolbar-row-main">
          {/* Search */}
          <div className="cc-search-box">
            <Search size={16} className="cc-search-icon" />
            <input
              type="text"
              className="cc-search-input"
              placeholder="Search by customer name, code (CUST-0001), email, phone..."
              value={searchTerm}
              onChange={e => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
            />
            {searchTerm && (
              <button className="cc-search-clear" onClick={() => setSearchTerm('')} title="Clear search">
                <X size={14} />
              </button>
            )}
          </div>

          <div className="cc-filter-group">
            {/* Tenant Filter (Super Admin only) */}
            {isSuperAdmin && (
              <div className="cc-select-wrapper">
                <select
                  className="cc-select"
                  value={selectedTenant}
                  onChange={e => {
                    setSelectedTenant(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="all">All Tenants / Companies</option>
                  <option value="1">GHL India Ventures</option>
                  <option value="2">Jamin Bazaar</option>
                </select>
                <ChevronDown size={14} className="cc-select-chevron" />
              </div>
            )}

            {/* Status Filter */}
            <div className="cc-select-wrapper">
              <select
                className="cc-select"
                value={selectedStatus}
                onChange={e => {
                  setSelectedStatus(e.target.value);
                  setPage(1);
                }}
              >
                <option value="all">All Statuses</option>
                <option value="Active">Active</option>
                <option value="VIP">VIP</option>
                <option value="Inactive">Inactive</option>
              </select>
              <ChevronDown size={14} className="cc-select-chevron" />
            </div>

            {/* Sort Filter */}
            <div className="cc-select-wrapper">
              <select
                className="cc-select"
                value={`${sortBy}_${sortOrder}`}
                onChange={e => {
                  const [field, order] = e.target.value.split('_');
                  setSortBy(field);
                  setSortOrder(order);
                  setPage(1);
                }}
              >
                <option value="conversionDate_desc">Newest Conversion First</option>
                <option value="conversionDate_asc">Oldest Conversion First</option>
                <option value="committedAmount_desc">Highest Committed Value</option>
                <option value="committedAmount_asc">Lowest Committed Value</option>
                <option value="name_asc">Customer Name (A–Z)</option>
                <option value="name_desc">Customer Name (Z–A)</option>
              </select>
              <ChevronDown size={14} className="cc-select-chevron" />
            </div>

            {/* Page Size */}
            <div className="cc-select-wrapper">
              <select
                className="cc-select"
                value={pageSize}
                onChange={e => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
              >
                <option value={10}>10 / page</option>
                <option value={25}>25 / page</option>
                <option value={50}>50 / page</option>
                <option value={100}>100 / page</option>
              </select>
              <ChevronDown size={14} className="cc-select-chevron" />
            </div>
          </div>
        </div>

        {/* Secondary Toolbar: Date Presets & Custom Range */}
        <div className="cc-toolbar-row-secondary">
          <div className="cc-presets-list">
            <span className="cc-preset-label">Date Presets:</span>
            <button
              className={`cc-preset-chip ${activePreset === 'all' ? 'active' : ''}`}
              onClick={() => applyDatePreset('all')}
            >
              All Time
            </button>
            <button
              className={`cc-preset-chip ${activePreset === 'this_month' ? 'active' : ''}`}
              onClick={() => applyDatePreset('this_month')}
            >
              This Month
            </button>
            <button
              className={`cc-preset-chip ${activePreset === 'last_30_days' ? 'active' : ''}`}
              onClick={() => applyDatePreset('last_30_days')}
            >
              Last 30 Days
            </button>
            <button
              className={`cc-preset-chip ${activePreset === 'this_quarter' ? 'active' : ''}`}
              onClick={() => applyDatePreset('this_quarter')}
            >
              This Quarter
            </button>

            {/* Date Pickers */}
            <input
              type="date"
              className="cc-select"
              style={{ padding: '5px 8px', fontSize: '0.75rem', marginLeft: 8 }}
              value={startDate}
              onChange={e => {
                setStartDate(e.target.value);
                setActivePreset('custom');
                setPage(1);
              }}
              title="Conversion Start Date"
            />
            <span style={{ color: '#64748b', fontSize: '0.75rem' }}>to</span>
            <input
              type="date"
              className="cc-select"
              style={{ padding: '5px 8px', fontSize: '0.75rem' }}
              value={endDate}
              onChange={e => {
                setEndDate(e.target.value);
                setActivePreset('custom');
                setPage(1);
              }}
              title="Conversion End Date"
            />
          </div>

          {(searchTerm || selectedTenant !== 'all' || selectedStatus !== 'all' || startDate || endDate || activePreset !== 'all') && (
            <button className="cc-clear-btn" onClick={handleResetFilters}>
              <X size={14} /> Clear All Filters
            </button>
          )}
        </div>
      </div>

      {/* ── Table Card ──────────────────────────────────────────────────────── */}
      <div className="cc-table-card">
        {isLoading ? (
          <div className="cc-loading-skeleton">
            <div className="cc-skeleton-row" />
            <div className="cc-skeleton-row" />
            <div className="cc-skeleton-row" />
            <div className="cc-skeleton-row" />
          </div>
        ) : customers.length === 0 ? (
          <div className="cc-empty-state">
            <div className="cc-empty-icon">
              <Users size={28} />
            </div>
            <h3 className="cc-empty-title">No Converted Customers Found</h3>
            <p className="cc-empty-desc">
              {searchTerm || selectedTenant !== 'all' || selectedStatus !== 'all' || startDate || endDate
                ? 'No converted customer records matched your selected criteria. Try adjusting or clearing your filters.'
                : 'There are currently no converted customers recorded in the database.'}
            </p>
            {(searchTerm || selectedTenant !== 'all' || selectedStatus !== 'all' || startDate || endDate) && (
              <button className="cc-btn cc-btn-secondary" style={{ marginTop: 8 }} onClick={handleResetFilters}>
                Reset Filters
              </button>
            )}
          </div>
        ) : (
          <div className="cc-table-wrapper">
            <table className="cc-table">
              <thead>
                <tr>
                  <th>Customer ID</th>
                  <th>Customer Name & Contact</th>
                  <th>Tenant / Company</th>
                  <th>Assigned Representative</th>
                  <th>Lead Source</th>
                  <th>Conversion Date</th>
                  <th>Committed Amount</th>
                  <th>Status</th>
                  <th>Related Deal</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {customers.map(cust => (
                  <tr key={cust.id} className="cc-table-row">
                    {/* Customer Code */}
                    <td>
                      <span className="cc-cust-code-badge">{cust.customerCode}</span>
                    </td>

                    {/* Customer Name & Contacts */}
                    <td>
                      <div className="cc-customer-info">
                        <span className="cc-cust-name">{cust.name}</span>
                        <div className="cc-cust-contacts">
                          {cust.phone && (
                            <span className="cc-contact-item" title="Phone">
                              <Phone size={11} /> {cust.phone}
                            </span>
                          )}
                          {cust.email && (
                            <span className="cc-contact-item" title="Email">
                              <Mail size={11} /> {cust.email}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Tenant */}
                    <td>
                      <span className="cc-tenant-pill">
                        <Building2 size={13} color="#94a3b8" />
                        {cust.companyName}
                      </span>
                    </td>

                    {/* Assigned Representative */}
                    <td>
                      <div className="cc-rep-info">
                        <span className="cc-rep-name">{cust.assignedAgentName}</span>
                        <span className="cc-rep-role">{cust.assignedAgentRole}</span>
                      </div>
                    </td>

                    {/* Lead Source */}
                    <td>
                      <span className="cc-source-pill">
                        {cust.originalLeadSource || 'Direct Conversion'}
                      </span>
                    </td>

                    {/* Conversion Date */}
                    <td>
                      <span style={{ color: '#cbd5e1', fontSize: '0.8125rem' }}>
                        {formatDateTime(cust.conversionDate)}
                      </span>
                    </td>

                    {/* Committed Amount */}
                    <td>
                      <div className="cc-amount-cell">
                        <span className="cc-amount-tag" title={formatFullCurrency(cust.committedAmount)}>
                          {formatCurrency(cust.committedAmount)}
                        </span>
                      </div>
                    </td>

                    {/* Status */}
                    <td>
                      <span
                        className={`cc-status-badge ${
                          cust.status.toLowerCase() === 'vip'
                            ? 'cc-status-vip'
                            : cust.status.toLowerCase() === 'inactive'
                            ? 'cc-status-inactive'
                            : 'cc-status-active'
                        }`}
                      >
                        {cust.status}
                      </span>
                    </td>

                    {/* Related Deal */}
                    <td>
                      {cust.relatedDealTitle ? (
                        <span className="cc-deal-link" title={cust.relatedDealTitle}>
                          <Briefcase size={12} /> {cust.relatedDealTitle}
                        </span>
                      ) : (
                        <span style={{ color: '#64748b', fontSize: '0.75rem' }}>—</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td style={{ textAlign: 'right' }}>
                      <button
                        className="cc-action-btn"
                        onClick={() => handleOpenDrawer(cust)}
                        title="View Complete Customer 360"
                      >
                        <UserCheck size={13} /> View 360
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Pagination Bar ────────────────────────────────────────────────── */}
        {!isLoading && customers.length > 0 && (
          <div className="cc-pagination">
            <div className="cc-page-info">
              Showing{' '}
              <strong style={{ color: '#f1f5f9' }}>
                {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, totalCount)}
              </strong>{' '}
              of <strong style={{ color: '#f1f5f9' }}>{totalCount}</strong> converted customers
            </div>

            <div className="cc-page-controls">
              <button
                className="cc-page-btn"
                disabled={page <= 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
              >
                Previous
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                .map((p, idx, arr) => (
                  <React.Fragment key={p}>
                    {idx > 0 && arr[idx - 1] !== p - 1 && (
                      <span style={{ color: '#64748b', padding: '0 4px' }}>…</span>
                    )}
                    <button
                      className={`cc-page-btn ${page === p ? 'active' : ''}`}
                      onClick={() => setPage(p)}
                    >
                      {p}
                    </button>
                  </React.Fragment>
                ))}

              <button
                className="cc-page-btn"
                disabled={page >= totalPages}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Customer Details Drawer ─────────────────────────────────────────── */}
      {isDrawerOpen && selectedCustomer && (
        <div className="cc-drawer-overlay" onClick={handleCloseDrawer}>
          <div className="cc-drawer" onClick={e => e.stopPropagation()}>
            <div className="cc-drawer-header">
              <div className="cc-drawer-title-group">
                <span className="cc-cust-code-badge">{selectedCustomer.customerCode}</span>
                <h2 className="cc-drawer-title">{selectedCustomer.name}</h2>
              </div>
              <button className="cc-drawer-close" onClick={handleCloseDrawer} title="Close drawer">
                <X size={18} />
              </button>
            </div>

            <div className="cc-drawer-body">
              {/* Financial Commitment Summary */}
              <div className="cc-drawer-section">
                <h3 className="cc-drawer-section-title">
                  <DollarSign size={14} color="#fbbf24" /> Commercial Commitment
                </h3>
                <div className="cc-drawer-grid">
                  <div className="cc-drawer-kv">
                    <span className="cc-drawer-k">Total Committed Amount</span>
                    <span className="cc-drawer-v" style={{ color: '#fbbf24', fontSize: '1.125rem', fontWeight: 700 }}>
                      {formatFullCurrency(selectedCustomer.committedAmount)}
                    </span>
                  </div>
                  <div className="cc-drawer-kv">
                    <span className="cc-drawer-k">Account Status</span>
                    <span className="cc-drawer-v">
                      <span
                        className={`cc-status-badge ${
                          selectedCustomer.status.toLowerCase() === 'vip'
                            ? 'cc-status-vip'
                            : selectedCustomer.status.toLowerCase() === 'inactive'
                            ? 'cc-status-inactive'
                            : 'cc-status-active'
                        }`}
                      >
                        {selectedCustomer.status}
                      </span>
                    </span>
                  </div>
                  {selectedCustomer.relatedDealTitle && (
                    <div className="cc-drawer-kv" style={{ gridColumn: 'span 2' }}>
                      <span className="cc-drawer-k">Related Deal / Opportunity</span>
                      <span className="cc-drawer-v" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Briefcase size={14} color="#38bdf8" />
                        {selectedCustomer.relatedDealTitle} (Deal #{selectedCustomer.relatedDealId})
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Contact Information */}
              <div className="cc-drawer-section">
                <h3 className="cc-drawer-section-title">
                  <UserCheck size={14} color="#38bdf8" /> Customer Identity & Contact
                </h3>
                <div className="cc-drawer-grid">
                  <div className="cc-drawer-kv">
                    <span className="cc-drawer-k">Phone</span>
                    <span className="cc-drawer-v">{selectedCustomer.phone || '—'}</span>
                  </div>
                  <div className="cc-drawer-kv">
                    <span className="cc-drawer-k">Email</span>
                    <span className="cc-drawer-v">{selectedCustomer.email || '—'}</span>
                  </div>
                  <div className="cc-drawer-kv">
                    <span className="cc-drawer-k">Location</span>
                    <span className="cc-drawer-v">{selectedCustomer.location || '—'}</span>
                  </div>
                  <div className="cc-drawer-kv">
                    <span className="cc-drawer-k">Tenant / Organization</span>
                    <span className="cc-drawer-v">{selectedCustomer.companyName}</span>
                  </div>
                </div>
              </div>

              {/* Conversion & Relationship */}
              <div className="cc-drawer-section">
                <h3 className="cc-drawer-section-title">
                  <Award size={14} color="#34d399" /> Conversion & Assignment
                </h3>
                <div className="cc-drawer-grid">
                  <div className="cc-drawer-kv">
                    <span className="cc-drawer-k">Conversion Date</span>
                    <span className="cc-drawer-v">{formatDateTime(selectedCustomer.conversionDate)}</span>
                  </div>
                  <div className="cc-drawer-kv">
                    <span className="cc-drawer-k">Original Lead Source</span>
                    <span className="cc-drawer-v">{selectedCustomer.originalLeadSource || 'Direct'}</span>
                  </div>
                  <div className="cc-drawer-kv">
                    <span className="cc-drawer-k">Assigned Representative</span>
                    <span className="cc-drawer-v">{selectedCustomer.assignedAgentName}</span>
                  </div>
                  <div className="cc-drawer-kv">
                    <span className="cc-drawer-k">Representative Role</span>
                    <span className="cc-drawer-v">{selectedCustomer.assignedAgentRole}</span>
                  </div>
                  {selectedCustomer.relatedLeadId && (
                    <div className="cc-drawer-kv">
                      <span className="cc-drawer-k">Original Lead ID</span>
                      <span className="cc-drawer-v">Lead #{selectedCustomer.relatedLeadId}</span>
                    </div>
                  )}
                  {selectedCustomer.lastContactedAt && (
                    <div className="cc-drawer-kv">
                      <span className="cc-drawer-k">Last Contacted</span>
                      <span className="cc-drawer-v">{formatDate(selectedCustomer.lastContactedAt)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Custom Fields */}
              {selectedCustomer.customFields && Object.keys(selectedCustomer.customFields).length > 0 && (
                <div className="cc-drawer-section">
                  <h3 className="cc-drawer-section-title">
                    <Layers size={14} color="#a78bfa" /> Custom Qualification Attributes
                  </h3>
                  <div className="cc-drawer-grid">
                    {Object.entries(selectedCustomer.customFields)
                      .filter(([_, v]) => Boolean(v))
                      .map(([k, v]) => (
                        <div key={k} className="cc-drawer-kv">
                          <span className="cc-drawer-k">{k.replace(/([A-Z])/g, ' $1').trim()}</span>
                          <span className="cc-drawer-v">{String(v)}</span>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Notes */}
              {selectedCustomer.notes && (
                <div className="cc-drawer-section">
                  <h3 className="cc-drawer-section-title">Operational Notes</h3>
                  <div className="cc-drawer-notes">{selectedCustomer.notes}</div>
                </div>
              )}
            </div>

            <div className="cc-drawer-footer">
              <button className="cc-btn cc-btn-secondary" onClick={handleCloseDrawer}>
                Close
              </button>
              {onNavigate && (
                <button
                  className="cc-btn cc-btn-primary"
                  onClick={() => {
                    handleCloseDrawer();
                    onNavigate(isSuperAdmin ? 'admin-users' : 'customers');
                  }}
                >
                  <ExternalLink size={14} /> Open Customer 360
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
