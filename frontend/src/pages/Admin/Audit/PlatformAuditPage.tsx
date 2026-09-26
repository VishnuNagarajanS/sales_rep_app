import React, { useState, useEffect } from 'react';
import {
  FileCheck,
  Shield,
  Search,
  Filter,
  Download,
  Calendar,
  Eye,
  CheckCircle2,
  XCircle,
  Building2,
  ArrowRight,
  Code,
  Clock,
  User as UserIcon,
} from 'lucide-react';
import { AuditLog, Tenant } from '../../../types';
import { superAdminService } from '../../../services/superAdminService';
import { Modal } from '../../../components/common/Modal';
import { Drawer } from '../../../components/common/Drawer';
import './PlatformAuditPage.css';

export const PlatformAuditPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);

  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCompanyFilter, setSelectedCompanyFilter] = useState('all');
  const [selectedActionFilter, setSelectedActionFilter] = useState('all');
  const [selectedModuleFilter, setSelectedModuleFilter] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Selected Log for Inspection
  const [inspectedLog, setInspectedLog] = useState<AuditLog | null>(null);
  const [isInspectDrawerOpen, setIsInspectDrawerOpen] = useState(false);

  const loadData = () => {
    setTenants(superAdminService.getTenants());
    applyFilters();
  };

  const applyFilters = () => {
    const list = superAdminService.getAuditLogs({
      companyId: selectedCompanyFilter,
      action: selectedActionFilter,
      module: selectedModuleFilter,
      search: searchQuery,
      from: fromDate ? new Date(fromDate).toISOString() : undefined,
      to: toDate ? new Date(toDate + 'T23:59:59').toISOString() : undefined,
    });
    setLogs(list);
  };

  useEffect(() => {
    loadData();
    window.addEventListener('nexus_admin_updated', loadData);
    window.addEventListener('nexus_storage_updated', loadData);
    return () => {
      window.removeEventListener('nexus_admin_updated', loadData);
      window.removeEventListener('nexus_storage_updated', loadData);
    };
  }, []);

  useEffect(() => {
    applyFilters();
  }, [searchQuery, selectedCompanyFilter, selectedActionFilter, selectedModuleFilter, fromDate, toDate]);

  const handleExportCsv = () => {
    const csvContent = superAdminService.exportAuditLogsCsv(logs);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `NexusSales_Platform_Audit_Log_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const openLogInspector = (log: AuditLog) => {
    setInspectedLog(log);
    setIsInspectDrawerOpen(true);
  };

  const formatTimestamp = (ts: string) => {
    try {
      const d = new Date(ts);
      return d.toLocaleString('en-IN', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return ts;
    }
  };

  const actionVerbList = [
    'PROVISION_TENANT',
    'UPDATE_TENANT',
    'STATUS_CHANGE',
    'DELETE_TENANT',
    'PROVISION_USER',
    'UPDATE_USER',
    'RESET_PASSWORD',
    'UPDATE_ROLE_PERMISSIONS',
    'ALLOCATE_DID',
    'RELEASE_DID',
    'UPDATE_CARRIER_SETTINGS',
    'PUBLISH_ANNOUNCEMENT',
    'MAINTENANCE_MODE',
    'CREATE',
    'UPDATE',
    'DELETE',
    'CONVERT',
    'LOGIN',
  ];

  const moduleList = ['Companies', 'Users', 'Roles', 'Features', 'CallConfig', 'Leads', 'Deals', 'System'];

  return (
    <div className="platform-audit-page-container">
      {/* Page Header */}
      <div className="audit-page-header">
        <div>
          <div className="header-breadcrumbs">
            <span>PLATFORM CONSOLE</span> &gt; <span className="current">SECURITY & COMPLIANCE</span>
          </div>
          <h1 className="page-main-title">Cross-Tenant Immutable Audit Trail</h1>
          <p className="page-main-desc">
            Tamper-evident ledger capturing platform operations, tenant provisioning, RBAC updates, and CRM state changes.
          </p>
        </div>

        <button className="btn btn-secondary btn-sm btn-export-audit" onClick={handleExportCsv}>
          <Download size={14} /> Export Audit Ledger (.CSV)
        </button>
      </div>

      {/* Filter Card */}
      <div className="card audit-filter-card">
        <div className="audit-search-box">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            className="audit-search-input"
            placeholder="Search audit trail by actor, email, entity ID, or description..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="audit-dropdown-filters">
          {/* Organization Filter */}
          <select
            className="filter-select"
            value={selectedCompanyFilter}
            onChange={e => setSelectedCompanyFilter(e.target.value)}
          >
            <option value="all">All Organizations ({tenants.length + 1})</option>
            <option value="global">Platform Console (Global)</option>
            {tenants.map(t => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>

          {/* Action Filter */}
          <select
            className="filter-select"
            value={selectedActionFilter}
            onChange={e => setSelectedActionFilter(e.target.value)}
          >
            <option value="all">All Action Verbs</option>
            {actionVerbList.map(a => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>

          {/* Module Filter */}
          <select
            className="filter-select"
            value={selectedModuleFilter}
            onChange={e => setSelectedModuleFilter(e.target.value)}
          >
            <option value="all">All System Modules</option>
            {moduleList.map(m => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>

          {/* Date Range Inputs */}
          <div className="date-filter-group">
            <input
              type="date"
              className="date-input"
              value={fromDate}
              onChange={e => setFromDate(e.target.value)}
              title="From Date"
            />
            <span className="date-sep">&rarr;</span>
            <input
              type="date"
              className="date-input"
              value={toDate}
              onChange={e => setToDate(e.target.value)}
              title="To Date"
            />
          </div>
        </div>
      </div>

      {/* Audit Log Table Card */}
      <div className="card audit-table-card">
        <div className="table-responsive">
          <table className="audit-data-table">
            <thead>
              <tr>
                <th>Timestamp (UTC)</th>
                <th>Tenant Namespace</th>
                <th>Actor Identity</th>
                <th>Action Verb</th>
                <th>Module & Entity</th>
                <th>Event Description</th>
                <th style={{ textAlign: 'right' }}>Payload Diff</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="no-logs-cell">
                    No audit events match the specified filter criteria.
                  </td>
                </tr>
              ) : (
                logs.map(l => (
                  <tr key={l.id} className="audit-log-row">
                    <td>
                      <span className="timestamp-badge font-mono">{formatTimestamp(l.timestamp)}</span>
                    </td>

                    <td>
                      <span className="tenant-namespace-tag">
                        <Building2 size={12} />
                        {l.companyName || (l.companyId ? `Company #${l.companyId}` : 'PLATFORM CONSOLE')}
                      </span>
                    </td>

                    <td>
                      <div className="actor-cell">
                        <div className="actor-name-text">{l.actorName}</div>
                        <div className="actor-email-text">{l.actorEmail}</div>
                      </div>
                    </td>

                    <td>
                      <span className={`action-pill ${l.action.toLowerCase()}`}>{l.action}</span>
                    </td>

                    <td>
                      <div className="entity-cell">
                        <span className="entity-type-tag">{l.entityType}</span>
                        {l.entityId && l.entityId !== '0' && (
                          <code className="entity-id-code">#{l.entityId}</code>
                        )}
                      </div>
                    </td>

                    <td>
                      <div className="audit-details-text">{l.details}</div>
                    </td>

                    <td style={{ textAlign: 'right' }}>
                      <button
                        className="btn btn-secondary btn-xs btn-inspect-diff"
                        onClick={() => openLogInspector(l)}
                      >
                        <Code size={12} /> Inspect
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* AUDIT EVENT PAYLOAD INSPECTION DRAWER */}
      {/* ========================================================================= */}
      {isInspectDrawerOpen && inspectedLog && (
        <Drawer
          isOpen={isInspectDrawerOpen}
          onClose={() => setIsInspectDrawerOpen(false)}
          title={`Audit Event #${inspectedLog.id}`}
          size="lg"
        >
          <div className="log-inspector-container">
            {/* Metadata Summary Card */}
            <div className="log-meta-card">
              <div className="meta-row">
                <span className="meta-key">Action Executed:</span>
                <span className="meta-val">
                  <span className={`action-pill ${inspectedLog.action.toLowerCase()}`}>
                    {inspectedLog.action}
                  </span>
                </span>
              </div>
              <div className="meta-row">
                <span className="meta-key">Timestamp:</span>
                <span className="meta-val font-mono">{inspectedLog.timestamp}</span>
              </div>
              <div className="meta-row">
                <span className="meta-key">Actor Name & Email:</span>
                <span className="meta-val font-bold">
                  {inspectedLog.actorName} &lt;{inspectedLog.actorEmail}&gt;
                </span>
              </div>
              <div className="meta-row">
                <span className="meta-key">Tenant Namespace:</span>
                <span className="meta-val">{inspectedLog.companyName || 'GLOBAL PLATFORM'}</span>
              </div>
              <div className="meta-row">
                <span className="meta-key">Target Entity:</span>
                <span className="meta-val">
                  {inspectedLog.entityType} (ID: {inspectedLog.entityId})
                </span>
              </div>
              <div className="meta-row">
                <span className="meta-key">Client Origin:</span>
                <span className="meta-val font-mono">
                  {inspectedLog.ipAddress || '127.0.0.1'} ({inspectedLog.userAgent || 'Nexus Platform Console'})
                </span>
              </div>
              <div className="meta-row">
                <span className="meta-key">Event Summary:</span>
                <span className="meta-val">{inspectedLog.details}</span>
              </div>
            </div>

            {/* Visual JSON Before / After Diff */}
            <div className="diff-section">
              <h4 className="diff-heading">Payload State Diff (Before vs After)</h4>
              <div className="diff-grid">
                <div className="diff-pane before-pane">
                  <div className="pane-header">STATE BEFORE ACTION</div>
                  <pre className="pane-body font-mono">
                    {inspectedLog.beforeValue
                      ? JSON.stringify(inspectedLog.beforeValue, null, 2)
                      : '// No preceding state recorded (initial creation or read event)'}
                  </pre>
                </div>

                <div className="diff-pane after-pane">
                  <div className="pane-header">STATE AFTER ACTION (COMMITTED)</div>
                  <pre className="pane-body font-mono">
                    {inspectedLog.afterValue
                      ? JSON.stringify(inspectedLog.afterValue, null, 2)
                      : JSON.stringify(
                          {
                            action: inspectedLog.action,
                            entity: inspectedLog.entityType,
                            entityId: inspectedLog.entityId,
                            status: inspectedLog.status || 'success',
                            details: inspectedLog.details,
                          },
                          null,
                          2
                        )}
                  </pre>
                </div>
              </div>
            </div>

            <div className="drawer-footer-actions">
              <button className="btn btn-primary" onClick={() => setIsInspectDrawerOpen(false)}>
                Close Inspector
              </button>
            </div>
          </div>
        </Drawer>
      )}
    </div>
  );
};
