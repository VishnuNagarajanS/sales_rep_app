import React, { useState, useEffect } from 'react';
import {
  Server,
  Activity,
  HardDrive,
  Cpu,
  Wifi,
  Radio,
  AlertTriangle,
  Megaphone,
  Download,
  Shield,
  CheckCircle2,
  Trash2,
  Plus,
  RefreshCw,
  Bell,
  Clock,
  Database,
  Lock,
} from 'lucide-react';
import { SystemDiagnostics, BroadcastAnnouncement, Tenant } from '../../../types';
import { superAdminService } from '../../../services/superAdminService';
import { Modal } from '../../../components/common/Modal';
import './PlatformSystemPage.css';

export const PlatformSystemPage: React.FC = () => {
  const [diagnostics, setDiagnostics] = useState<SystemDiagnostics>(() =>
    superAdminService.getSystemDiagnostics()
  );
  const [announcements, setAnnouncements] = useState<BroadcastAnnouncement[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [maintenance, setMaintenance] = useState(() => superAdminService.getMaintenanceMode());

  // Announcement Modal
  const [isAnnModalOpen, setIsAnnModalOpen] = useState(false);
  const [annTitle, setAnnTitle] = useState('');
  const [annMessage, setAnnMessage] = useState('');
  const [annPriority, setAnnPriority] = useState<'info' | 'warning' | 'critical'>('info');
  const [annAudience, setAnnAudience] = useState<'all' | 'tenant_admins' | 'sales_reps'>('all');
  const [annTenantId, setAnnTenantId] = useState('all');

  // Success Feedback
  const [successMsg, setSuccessMsg] = useState('');

  const loadData = () => {
    setDiagnostics(superAdminService.getSystemDiagnostics());
    setAnnouncements(superAdminService.getAnnouncements());
    setTenants(superAdminService.getTenants());
    setMaintenance(superAdminService.getMaintenanceMode());
  };

  useEffect(() => {
    loadData();
    window.addEventListener('nexus_admin_updated', loadData);
    return () => window.removeEventListener('nexus_admin_updated', loadData);
  }, []);

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  const handleCreateAnnouncement = () => {
    if (!annTitle.trim() || !annMessage.trim()) return;

    superAdminService.createAnnouncement({
      title: annTitle.trim(),
      message: annMessage.trim(),
      priority: annPriority,
      targetAudience: annAudience,
      targetTenantId: annTenantId === 'all' ? undefined : annTenantId,
    });

    setIsAnnModalOpen(false);
    setAnnTitle('');
    setAnnMessage('');
    showSuccess('Broadcast announcement published across fleet.');
  };

  const handleToggleAnnouncement = (id: string, current: boolean) => {
    superAdminService.toggleAnnouncement(id, !current);
    showSuccess(`Broadcast announcement ${!current ? 'activated' : 'deactivated'}.`);
  };

  const handleDeleteAnnouncement = (id: string) => {
    superAdminService.deleteAnnouncement(id);
    showSuccess('Broadcast announcement removed.');
  };

  const handleToggleMaintenance = () => {
    const nextState = !maintenance.enabled;
    const updated = superAdminService.setMaintenanceMode(nextState);
    setMaintenance(updated);
    showSuccess(`Platform maintenance mode ${nextState ? 'ENABLED' : 'DISABLED'}.`);
  };

  const handleDownloadSnapshot = () => {
    const jsonStr = superAdminService.exportPlatformSnapshot();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute(
      'download',
      `NexusSales_Platform_Backup_Snapshot_${new Date().toISOString().slice(0, 10)}.json`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showSuccess('Platform snapshot backup exported successfully.');
  };

  const memoryPercent = Math.round((diagnostics.memoryUsedMb / diagnostics.memoryLimitMb) * 100);
  const storagePercent = Math.round((diagnostics.storageUsedGb / diagnostics.storageLimitGb) * 100);

  return (
    <div className="platform-system-page-container">
      {/* Header */}
      <div className="system-page-header">
        <div>
          <div className="header-breadcrumbs">
            <span>PLATFORM CONSOLE</span> &gt; <span className="current">SYSTEM HEALTH & MAINTENANCE</span>
          </div>
          <h1 className="page-main-title">System Health, Diagnostics & Global Config</h1>
          <p className="page-main-desc">
            Monitor real-time server vitals, manage global broadcast announcements, and control platform maintenance modes.
          </p>
        </div>

        <div className="system-header-actions">
          <button className="btn btn-secondary btn-sm" onClick={handleDownloadSnapshot}>
            <Download size={14} /> Export Platform Backup (.JSON)
          </button>
          <button
            className="btn btn-primary btn-sm btn-new-announcement"
            onClick={() => setIsAnnModalOpen(true)}
          >
            <Megaphone size={14} /> Publish Broadcast Banner
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="system-success-alert animate-fade-in">
          <CheckCircle2 size={16} /> {successMsg}
        </div>
      )}

      {/* Real-time Diagnostics 4-Card Grid */}
      <div className="diagnostics-grid">
        <div className="card diag-card">
          <div className="diag-card-header">
            <span className="diag-label">API SERVER STATUS</span>
            <Server size={18} color="#4ade80" />
          </div>
          <div className="diag-val text-green">
            <span className="status-dot green" /> {diagnostics.apiStatus}
          </div>
          <div className="diag-sub">
            <span>Latency: {diagnostics.apiLatencyMs}ms</span>
            <span>•</span>
            <span>Uptime: {diagnostics.systemUptimePercentage}%</span>
          </div>
        </div>

        <div className="card diag-card">
          <div className="diag-card-header">
            <span className="diag-label">DATABASE POOL</span>
            <Database size={18} color="#38bdf8" />
          </div>
          <div className="diag-val text-blue">
            {diagnostics.dbPoolActive} / {diagnostics.dbPoolMax}
          </div>
          <div className="diag-sub">
            <span>Active Connections</span>
            <span>•</span>
            <span>Query Ping: {diagnostics.dbLatencyMs}ms</span>
          </div>
        </div>

        <div className="card diag-card">
          <div className="diag-card-header">
            <span className="diag-label">CLUSTER MEMORY (RAM)</span>
            <Cpu size={18} color="#c084fc" />
          </div>
          <div className="diag-val text-purple">
            {diagnostics.memoryUsedMb} MB <span className="val-unit">/ {diagnostics.memoryLimitMb} MB</span>
          </div>
          <div className="progress-bar-bg">
            <div
              className="progress-bar-fill purple"
              style={{ width: `${memoryPercent}%` }}
            />
          </div>
          <div className="diag-sub">
            <span>{memoryPercent}% Allocated</span>
            <span>•</span>
            <span>Node Cluster AP-South</span>
          </div>
        </div>

        <div className="card diag-card">
          <div className="diag-card-header">
            <span className="diag-label">CLOUD MEDIA STORAGE</span>
            <HardDrive size={18} color="#fbbf24" />
          </div>
          <div className="diag-val text-amber">
            {diagnostics.storageUsedGb} GB <span className="val-unit">/ {diagnostics.storageLimitGb} GB</span>
          </div>
          <div className="progress-bar-bg">
            <div
              className="progress-bar-fill amber"
              style={{ width: `${storagePercent}%` }}
            />
          </div>
          <div className="diag-sub">
            <span>{storagePercent}% Quota</span>
            <span>•</span>
            <span>Recordings & KYC Vault</span>
          </div>
        </div>
      </div>

      {/* Maintenance Mode & Global Controls Card */}
      <div className={`card maintenance-banner-card ${maintenance.enabled ? 'active-lock' : ''}`}>
        <div className="maintenance-left">
          <div className={`maintenance-icon-box ${maintenance.enabled ? 'red' : 'gray'}`}>
            <Lock size={22} />
          </div>
          <div>
            <h3 className="maintenance-title">
              Platform Maintenance Mode: {maintenance.enabled ? 'ENABLED (LOCKED)' : 'DISABLED (NORMAL)'}
            </h3>
            <p className="maintenance-desc">
              {maintenance.enabled
                ? `Lock is active. All tenant rep logins are blocked with message: "${maintenance.message}". Super Admin retains console access.`
                : 'Platform is operating normally. All tenant workspaces and sales queues are fully accessible.'}
            </p>
          </div>
        </div>

        <button
          className={`btn ${maintenance.enabled ? 'btn-success' : 'btn-danger'} btn-sm btn-toggle-maint`}
          onClick={handleToggleMaintenance}
        >
          {maintenance.enabled ? 'Disable Maintenance Mode' : 'Enable Maintenance Lock'}
        </button>
      </div>

      {/* Broadcast Announcements Ledger Card */}
      <div className="card announcements-table-card">
        <div className="announcements-header-row">
          <div>
            <h3 className="announcements-title">Fleet Broadcast Announcements</h3>
            <p className="announcements-desc">
              Global notification banners displayed persistently across tenant workspaces and reps' top bars.
            </p>
          </div>
          <button
            className="btn btn-primary btn-xs"
            onClick={() => setIsAnnModalOpen(true)}
          >
            <Plus size={12} /> New Broadcast Banner
          </button>
        </div>

        <div className="table-responsive">
          <table className="announcements-table">
            <thead>
              <tr>
                <th>Priority</th>
                <th>Announcement Title & Message</th>
                <th>Target Audience</th>
                <th>Created By & Time</th>
                <th>Active</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {announcements.length === 0 ? (
                <tr>
                  <td colSpan={6} className="no-ann-cell">
                    No active broadcast announcements.
                  </td>
                </tr>
              ) : (
                announcements.map(ann => (
                  <tr key={ann.id} className="ann-row">
                    <td>
                      <span className={`priority-chip ${ann.priority}`}>
                        {ann.priority.toUpperCase()}
                      </span>
                    </td>

                    <td>
                      <div className="ann-title-cell">
                        <div className="ann-title-text">{ann.title}</div>
                        <div className="ann-message-text">{ann.message}</div>
                      </div>
                    </td>

                    <td>
                      <span className="audience-pill">
                        {ann.targetAudience === 'all'
                          ? 'All Users & Reps'
                          : ann.targetAudience === 'tenant_admins'
                          ? 'Company Admins Only'
                          : 'Frontline Reps'}
                      </span>
                    </td>

                    <td>
                      <div className="ann-meta-cell">
                        <span className="ann-author">{ann.createdBy}</span>
                        <span className="ann-date">{new Date(ann.createdAt).toLocaleDateString()}</span>
                      </div>
                    </td>

                    <td>
                      <label className="switch-control">
                        <input
                          type="checkbox"
                          checked={ann.isActive}
                          onChange={() => handleToggleAnnouncement(ann.id, ann.isActive)}
                        />
                        <span className="switch-slider round" />
                      </label>
                    </td>

                    <td style={{ textAlign: 'right' }}>
                      <button
                        className="btn-delete-ann"
                        title="Delete Announcement"
                        onClick={() => handleDeleteAnnouncement(ann.id)}
                      >
                        <Trash2 size={14} />
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
      {/* PUBLISH BROADCAST BANNER MODAL */}
      {/* ========================================================================= */}
      {isAnnModalOpen && (
        <Modal
          isOpen={isAnnModalOpen}
          onClose={() => setIsAnnModalOpen(false)}
          title="⚡ Publish Global Fleet Announcement"
          size="md"
        >
          <div className="ann-modal-form">
            <div className="form-group">
              <label className="form-label required">Announcement Headline</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. Scheduled Infrastructure Maintenance Notice"
                value={annTitle}
                onChange={e => setAnnTitle(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label required">Broadcast Message Text</label>
              <textarea
                className="form-control"
                rows={3}
                placeholder="Database maintenance scheduled at 11:30 PM IST. Telephony routing will not be interrupted."
                value={annMessage}
                onChange={e => setAnnMessage(e.target.value)}
              />
            </div>

            <div className="form-grid-two">
              <div className="form-group">
                <label className="form-label">Banner Priority Level</label>
                <select
                  className="form-control"
                  value={annPriority}
                  onChange={e => setAnnPriority(e.target.value as any)}
                >
                  <option value="info">Info (Blue Notice)</option>
                  <option value="warning">Warning (Amber Alert)</option>
                  <option value="critical">Critical / Maintenance (Red Emergency)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Target Audience</label>
                <select
                  className="form-control"
                  value={annAudience}
                  onChange={e => setAnnAudience(e.target.value as any)}
                >
                  <option value="all">All Platform Users</option>
                  <option value="tenant_admins">Company Administrators Only</option>
                  <option value="sales_reps">Frontline Sales Representatives</option>
                </select>
              </div>
            </div>

            <div className="modal-actions-footer">
              <button className="btn btn-ghost" onClick={() => setIsAnnModalOpen(false)}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                disabled={!annTitle.trim() || !annMessage.trim()}
                onClick={handleCreateAnnouncement}
              >
                Publish Broadcast Banner
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
