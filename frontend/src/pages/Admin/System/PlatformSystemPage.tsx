import React, { useState, useEffect } from 'react';
import {
  Server,
  Activity,
  HardDrive,
  Cpu,
  AlertTriangle,
  Megaphone,
  Download,
  Shield,
  CheckCircle2,
  Trash2,
  Plus,
  RefreshCw,
  Database,
  Lock,
  Sliders,
  Mail,
  Clock,
  Terminal,
  Radio,
  FileText,
  Users,
  PhoneCall,
  Globe,
} from 'lucide-react';
import {
  SystemDiagnostics,
  BroadcastAnnouncement,
  Tenant,
  SystemHealthReport,
  GlobalConfig,
} from '../../../types';
import { superAdminService } from '../../../services/superAdminService';
import { useUnsavedChanges } from '../../../context/NavigationGuardContext';
import { Modal } from '../../../components/common/Modal';
import './PlatformSystemPage.css';

type SystemTab = 'diagnostics' | 'health' | 'config' | 'announcements';

export const PlatformSystemPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<SystemTab>('diagnostics');
  const [diagnostics, setDiagnostics] = useState<SystemDiagnostics | null>(null);
  const [healthReport, setHealthReport] = useState<SystemHealthReport | null>(null);
  const [globalConfig, setGlobalConfig] = useState<GlobalConfig | null>(null);
  const [configForm, setConfigForm] = useState<Partial<GlobalConfig>>({});
  const [announcements, setAnnouncements] = useState<BroadcastAnnouncement[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [maintenance, setMaintenance] = useState<{ enabled: boolean; message: string; bypassSecret: string }>({
    enabled: false,
    message: 'Platform under scheduled maintenance.',
    bypassSecret: '',
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isProbing, setIsProbing] = useState(false);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [isTestingSmtp, setIsTestingSmtp] = useState(false);
  const [smtpTestResult, setSmtpTestResult] = useState<{ success: boolean; latencyMs: number; status: string; message: string } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [isTogglingMaint, setIsTogglingMaint] = useState(false);

  // Announcement Modal
  const [isAnnModalOpen, setIsAnnModalOpen] = useState(false);
  const [annTitle, setAnnTitle] = useState('');
  const [annMessage, setAnnMessage] = useState('');
  const [annPriority, setAnnPriority] = useState<'info' | 'warning' | 'critical'>('info');
  const [annAudience, setAnnAudience] = useState<'all' | 'tenant_admins' | 'sales_reps'>('all');
  const [annTenantId, setAnnTenantId] = useState('all');
  const [isCreatingAnn, setIsCreatingAnn] = useState(false);
  const [isActionInProgress, setIsActionInProgress] = useState(false);

  // Unsaved changes check
  const isConfigDirty = !!globalConfig && !!configForm && (
    configForm.platformName !== globalConfig.platformName ||
    configForm.supportEmail !== globalConfig.supportEmail ||
    configForm.defaultTimezone !== globalConfig.defaultTimezone ||
    configForm.sessionTimeoutMinutes !== globalConfig.sessionTimeoutMinutes ||
    configForm.maxUploadSizeMb !== globalConfig.maxUploadSizeMb ||
    configForm.tokenExpirationMinutes !== globalConfig.tokenExpirationMinutes ||
    configForm.passwordMinLength !== globalConfig.passwordMinLength ||
    configForm.enforceMfa !== globalConfig.enforceMfa ||
    configForm.recordingRetentionDays !== globalConfig.recordingRetentionDays
  );
  const isAnnDirty = isAnnModalOpen && (annTitle.trim() !== '' || annMessage.trim() !== '');

  useUnsavedChanges(
    isConfigDirty || isAnnDirty,
    'You have unsaved changes in system settings or broadcast announcement. Are you sure you want to leave?',
    'platform-system-page'
  );

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  const loadData = async (isManualRefresh = false) => {
    if (isManualRefresh) setIsRefreshing(true);
    else setIsLoading(true);
    setErrorMsg(null);

    try {
      const [diag, health, config, anns, allTenants, maint] = await Promise.all([
        superAdminService.fetchSystemDiagnosticsFromApi(),
        superAdminService.fetchSystemHealthChecksFromApi(),
        superAdminService.fetchGlobalConfigFromApi(),
        superAdminService.fetchAnnouncementsFromApi(),
        superAdminService.fetchTenantsFromApi(),
        superAdminService.fetchMaintenanceModeFromApi(),
      ]);

      setDiagnostics(diag);
      setHealthReport(health);
      setGlobalConfig(config);
      setConfigForm(config);
      setAnnouncements(anns || []);
      setTenants(allTenants || []);
      setMaintenance(maint);
      if (isManualRefresh) {
        showSuccess('Live telemetry and system health refreshed.');
      }
    } catch (err: any) {
      console.error('Failed to load system data from API:', err);
      setErrorMsg(err.message || 'Failed to connect to backend server or database.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
    window.addEventListener('nexus_admin_updated', () => loadData(false));
    return () => window.removeEventListener('nexus_admin_updated', () => loadData(false));
  }, []);

  const handleProbeHealth = async () => {
    setIsProbing(true);
    try {
      const report = await superAdminService.probeSystemHealthChecksFromApi();
      setHealthReport(report);
      showSuccess(`Live dependency probes complete: ${report.overallStatus} (${report.healthyCount}/${report.checks.length} Healthy).`);
    } catch (err: any) {
      alert(err.message || 'Failed to probe external dependencies');
    } finally {
      setIsProbing(false);
    }
  };

  const handleTestSmtp = async () => {
    setIsTestingSmtp(true);
    setSmtpTestResult(null);
    try {
      const res = await superAdminService.testSmtpDiagnosticApi();
      setSmtpTestResult(res);
      if (res.success) {
        showSuccess(`SMTP verification passed: ${res.message}`);
      }
    } catch (err: any) {
      setSmtpTestResult({
        success: false,
        latencyMs: 0,
        status: 'Unhealthy',
        message: err.message || 'SMTP server connection probe failed',
      });
    } finally {
      setIsTestingSmtp(false);
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!configForm) return;

    setIsSavingConfig(true);
    try {
      const updated = await superAdminService.updateGlobalConfigApi(configForm);
      setGlobalConfig(updated);
      setConfigForm(updated);
      showSuccess('Global platform configuration saved and persisted to database.');
    } catch (err: any) {
      alert(err.message || 'Failed to update global configuration');
    } finally {
      setIsSavingConfig(false);
    }
  };

  const handleCreateAnnouncement = async () => {
    if (!annTitle.trim() || !annMessage.trim() || isCreatingAnn) return;
    setIsCreatingAnn(true);

    try {
      const created = await superAdminService.createAnnouncementApi({
        title: annTitle.trim(),
        message: annMessage.trim(),
        priority: annPriority,
        targetAudience: annAudience,
        targetTenantId: annTenantId === 'all' ? undefined : annTenantId,
      });

      setAnnouncements(prev => [created, ...prev]);
      setIsAnnModalOpen(false);
      setAnnTitle('');
      setAnnMessage('');
      showSuccess('Broadcast announcement published to database.');
    } catch (err: any) {
      alert(err.message || 'Failed to publish announcement');
    } finally {
      setIsCreatingAnn(false);
    }
  };

  const handleToggleAnnouncement = async (id: string, current: boolean) => {
    if (isActionInProgress) return;
    setIsActionInProgress(true);
    try {
      await superAdminService.toggleAnnouncementApi(id, !current);
      setAnnouncements(prev => prev.map(a => (a.id === id ? { ...a, isActive: !current } : a)));
      showSuccess(`Broadcast banner ${!current ? 'ACTIVATED' : 'DEACTIVATED'}.`);
    } catch (err: any) {
      alert(err.message || 'Failed to toggle announcement');
    } finally {
      setIsActionInProgress(false);
    }
  };

  const handleDeleteAnnouncement = async (id: string) => {
    if (isActionInProgress) return;
    if (confirm('Are you sure you want to delete this broadcast announcement?')) {
      setIsActionInProgress(true);
      try {
        await superAdminService.deleteAnnouncementApi(id);
        setAnnouncements(prev => prev.filter(a => a.id !== id));
        showSuccess('Broadcast announcement deleted from database.');
      } catch (err: any) {
        alert(err.message || 'Failed to delete announcement');
      } finally {
        setIsActionInProgress(false);
      }
    }
  };

  const handleToggleMaintenance = async () => {
    const nextState = !maintenance.enabled;
    setIsTogglingMaint(true);
    try {
      const updated = await superAdminService.setMaintenanceModeApi(nextState, maintenance.message);
      setMaintenance(updated);
      showSuccess(`Platform maintenance mode ${nextState ? 'ENABLED (LOCKED)' : 'DISABLED (NORMAL)'}.`);
    } catch (err: any) {
      alert(err.message || 'Failed to toggle maintenance mode');
    } finally {
      setIsTogglingMaint(false);
    }
  };

  const handleDownloadSnapshot = async () => {
    setIsExporting(true);
    try {
      const jsonStr = await superAdminService.exportPlatformSnapshotApi();
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
      showSuccess('Platform database backup snapshot exported successfully.');

      // Refresh diagnostics so LastBackupAt reflects this backup immediately
      const freshDiag = await superAdminService.fetchSystemDiagnosticsFromApi();
      setDiagnostics(freshDiag);
    } catch (err: any) {
      alert(err.message || 'Failed to export platform backup from database');
    } finally {
      setIsExporting(false);
    }
  };

  const memoryPercent =
    diagnostics && diagnostics.memoryLimitMb > 0
      ? Math.min(100, Math.round((diagnostics.memoryUsedMb / diagnostics.memoryLimitMb) * 100))
      : 0;

  const storagePercent =
    diagnostics && diagnostics.storageLimitGb > 0
      ? Math.min(100, Math.round((diagnostics.storageUsedGb / diagnostics.storageLimitGb) * 100))
      : 0;

  return (
    <div className="platform-system-page-container">
      {/* Header */}
      <div className="system-page-header">
        <div>
          <div className="header-breadcrumbs">
            <span>PLATFORM CONSOLE</span> &gt; <span className="current">SYSTEM HEALTH, DIAGNOSTICS & GLOBAL CONFIG</span>
          </div>
          <h1 className="page-main-title">System Health, Diagnostics & Global Config</h1>
          <p className="page-main-desc">
            Live database diagnostics, runtime vitals telemetry, external dependency probes, and persistent global platform configurations.
          </p>
        </div>

        <div className="system-header-actions">
          <button
            className="btn btn-secondary btn-sm"
            disabled={isRefreshing || isLoading}
            onClick={() => loadData(true)}
            title="Fetch latest metrics and telemetry directly from server"
          >
            <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} /> {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </button>

          <button
            className="btn btn-secondary btn-sm"
            disabled={isProbing}
            onClick={handleProbeHealth}
            title="Execute live network pings and query checks against all external dependencies"
          >
            <Activity size={14} className={isProbing ? 'animate-spin' : ''} /> {isProbing ? 'Probing...' : 'Probe Dependencies'}
          </button>

          <button
            className="btn btn-secondary btn-sm"
            disabled={isExporting}
            onClick={handleDownloadSnapshot}
          >
            <Download size={14} className={isExporting ? 'animate-spin' : ''} /> {isExporting ? 'Exporting...' : 'Export Platform Backup (.JSON)'}
          </button>

          <button
            className="btn btn-primary btn-sm btn-new-announcement"
            onClick={() => setIsAnnModalOpen(true)}
          >
            <Megaphone size={14} /> Publish Broadcast Banner
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="system-error-box animate-fade-in">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700 }}>
            <AlertTriangle size={18} /> Error Connecting to System Services
          </div>
          <div style={{ fontSize: '13px', color: '#cbd5e1' }}>{errorMsg}</div>
          <button className="btn btn-secondary btn-xs" onClick={() => loadData(true)}>
            <RefreshCw size={12} /> Retry Connection
          </button>
        </div>
      )}

      {successMsg && (
        <div className="system-success-alert animate-fade-in">
          <CheckCircle2 size={16} /> {successMsg}
        </div>
      )}

      {/* Tabs Navigation */}
      <div className="system-tabs-nav">
        <button
          className={`system-tab-btn ${activeTab === 'diagnostics' ? 'active' : ''}`}
          onClick={() => setActiveTab('diagnostics')}
        >
          <Server size={15} /> Live Diagnostics & Vitals
          {diagnostics && (
            <span className={`tab-badge ${diagnostics.apiStatus === 'Healthy' ? 'green' : 'amber'}`}>
              {diagnostics.apiLatencyMs}ms
            </span>
          )}
        </button>

        <button
          className={`system-tab-btn ${activeTab === 'health' ? 'active' : ''}`}
          onClick={() => setActiveTab('health')}
        >
          <Activity size={15} /> Dependency Health Probes
          {healthReport && (
            <span className={`tab-badge ${healthReport.overallStatus === 'Healthy' ? 'green' : 'amber'}`}>
              {healthReport.healthyCount}/{healthReport.checks.length}
            </span>
          )}
        </button>

        <button
          className={`system-tab-btn ${activeTab === 'config' ? 'active' : ''}`}
          onClick={() => setActiveTab('config')}
        >
          <Sliders size={15} /> Global System Configuration
        </button>

        <button
          className={`system-tab-btn ${activeTab === 'announcements' ? 'active' : ''}`}
          onClick={() => setActiveTab('announcements')}
        >
          <Megaphone size={15} /> Fleet Broadcasts & Maintenance
          {announcements.length > 0 && (
            <span className="tab-badge blue">{announcements.length}</span>
          )}
        </button>
      </div>

      {isLoading && !diagnostics ? (
        <div className="system-loading-box">
          <RefreshCw size={28} className="animate-spin" style={{ color: '#38bdf8' }} />
          <div style={{ fontWeight: 600, color: '#f1f5f9' }}>Retrieving live server vitals and database diagnostics...</div>
          <div style={{ fontSize: '12px' }}>Connecting to PostgreSQL cluster and .NET Core telemetry endpoints.</div>
        </div>
      ) : (
        <>
          {/* TAB 1: LIVE DIAGNOSTICS & VITALS */}
          {activeTab === 'diagnostics' && diagnostics && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Real-time Diagnostics 4-Card Grid */}
              <div className="diagnostics-grid">
                <div className="card diag-card">
                  <div className="diag-card-header">
                    <span className="diag-label">API SERVER STATUS</span>
                    <Server size={18} color={diagnostics.apiStatus === 'Healthy' ? '#4ade80' : '#f87171'} />
                  </div>
                  <div className={`diag-val ${diagnostics.apiStatus === 'Healthy' ? 'text-green' : 'text-amber'}`}>
                    <span className={`status-dot ${diagnostics.apiStatus === 'Healthy' ? 'green' : 'red'}`} /> {diagnostics.apiStatus}
                  </div>
                  <div className="diag-sub">
                    <span>Latency: {diagnostics.apiLatencyMs}ms</span>
                    <span>•</span>
                    <span>Uptime: {diagnostics.systemUptimePercentage}%</span>
                  </div>
                </div>

                <div className="card diag-card">
                  <div className="diag-card-header">
                    <span className="diag-label">POSTGRESQL POOL</span>
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
                    {diagnostics.memoryUsedMb} MB{' '}
                    <span className="val-unit">/ {diagnostics.memoryLimitMb > 0 ? `${diagnostics.memoryLimitMb} MB` : 'Dynamic'}</span>
                  </div>
                  <div className="progress-bar-bg">
                    <div className="progress-bar-fill purple" style={{ width: `${memoryPercent}%` }} />
                  </div>
                  <div className="diag-sub">
                    <span>{memoryPercent}% Allocated</span>
                    <span>•</span>
                    <span>Working Set (Kestrel)</span>
                  </div>
                </div>

                <div className="card diag-card">
                  <div className="diag-card-header">
                    <span className="diag-label">DISK STORAGE (VAULT)</span>
                    <HardDrive size={18} color="#fbbf24" />
                  </div>
                  <div className="diag-val text-amber">
                    {diagnostics.storageUsedGb} GB{' '}
                    <span className="val-unit">/ {diagnostics.storageLimitGb > 0 ? `${diagnostics.storageLimitGb} GB` : 'Volume'}</span>
                  </div>
                  <div className="progress-bar-bg">
                    <div className="progress-bar-fill amber" style={{ width: `${storagePercent}%` }} />
                  </div>
                  <div className="diag-sub">
                    <span>{storagePercent}% Used</span>
                    <span>•</span>
                    <span>Free: {diagnostics.storageFreeGb ?? 0} GB</span>
                  </div>
                </div>
              </div>

              {/* Full Server & Runtime Telemetry Card */}
              <div className="telemetry-section-card">
                <div className="telemetry-section-header">
                  <div>
                    <h3 className="telemetry-title">Platform Runtime & Infrastructure Vitals</h3>
                    <p className="telemetry-desc">
                      Real-time metrics sourced from the PostgreSQL database engine, active user sessions, and operating system telemetry.
                    </p>
                  </div>
                  <span className="audience-pill">
                    <Clock size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} />
                    Process Uptime: {diagnostics.processUptime || 'Active'}
                  </span>
                </div>

                <div className="telemetry-grid">
                  <div className="telemetry-item-box">
                    <span className="telemetry-item-label">Host Node Machine</span>
                    <span className="telemetry-item-value">{diagnostics.serverHost || 'Local Runtime'}</span>
                    <span className="telemetry-item-sub">{diagnostics.osDescription || 'Windows Operating System'}</span>
                  </div>

                  <div className="telemetry-item-box">
                    <span className="telemetry-item-label">Runtime Engine</span>
                    <span className="telemetry-item-value">{diagnostics.frameworkDescription || '.NET Core 8.0'}</span>
                    <span className="telemetry-item-sub">Kestrel High-Throughput Server</span>
                  </div>

                  <div className="telemetry-item-box">
                    <span className="telemetry-item-label">Database Connection</span>
                    <span className="telemetry-item-value" style={{ color: diagnostics.databaseConnected ? '#4ade80' : '#f87171' }}>
                      {diagnostics.databaseConnected ? 'PostgreSQL Active' : 'Disconnected'}
                    </span>
                    <span className="telemetry-item-sub">Query Ping: {diagnostics.dbLatencyMs}ms</span>
                  </div>

                  <div className="telemetry-item-box">
                    <span className="telemetry-item-label">Active Users</span>
                    <span className="telemetry-item-value">{diagnostics.activeUsers ?? diagnostics.activeSessions} Users</span>
                    <span className="telemetry-item-sub">Total in DB: {diagnostics.totalUsers ?? 0} registered</span>
                  </div>

                  <div className="telemetry-item-box">
                    <span className="telemetry-item-label">Tenants (Companies)</span>
                    <span className="telemetry-item-value">{diagnostics.totalTenants ?? tenants.length} Companies</span>
                    <span className="telemetry-item-sub">Multi-tenant isolation active</span>
                  </div>

                  <div className="telemetry-item-box">
                    <span className="telemetry-item-label">Telephony Call Records</span>
                    <span className="telemetry-item-value">{diagnostics.totalCalls ?? 0} Calls</span>
                    <span className="telemetry-item-sub">Drop Rate: {diagnostics.telephonyDropRate}% ({diagnostics.failedCalls ?? 0} failed)</span>
                  </div>

                  <div className="telemetry-item-box">
                    <span className="telemetry-item-label">Audit Log Ledger</span>
                    <span className="telemetry-item-value">{diagnostics.totalAuditLogs ?? 0} Events</span>
                    <span className="telemetry-item-sub">Security & compliance events</span>
                  </div>

                  <div className="telemetry-item-box">
                    <span className="telemetry-item-label">Last Database Backup</span>
                    <span className="telemetry-item-value" style={{ fontSize: '13px' }}>
                      {diagnostics.lastBackupAt ? new Date(diagnostics.lastBackupAt).toLocaleDateString() : 'No Backup Stored'}
                    </span>
                    <span className="telemetry-item-sub">
                      {diagnostics.lastBackupAt ? new Date(diagnostics.lastBackupAt).toLocaleTimeString() : 'Export a backup anytime'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: DEPENDENCY HEALTH PROBES */}
          {activeTab === 'health' && healthReport && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Overall Health Summary Banner */}
              <div className="health-summary-banner">
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    DEPENDENCY HEALTH AUDIT
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '6px' }}>
                    <span className={`health-status-badge ${healthReport.overallStatus.toLowerCase()}`}>
                      <Activity size={16} /> {healthReport.overallStatus}
                    </span>
                    <span style={{ fontSize: '13px', color: '#94a3b8' }}>
                      Evaluated at {new Date(healthReport.generatedAt).toLocaleTimeString()}
                    </span>
                  </div>
                </div>

                <div className="health-counts-row">
                  <span className="health-count-chip text-green">
                    <CheckCircle2 size={16} color="#4ade80" /> {healthReport.healthyCount} Healthy
                  </span>
                  {healthReport.degradedCount > 0 && (
                    <span className="health-count-chip text-amber">
                      <AlertTriangle size={16} color="#fbbf24" /> {healthReport.degradedCount} Degraded
                    </span>
                  )}
                  {healthReport.unhealthyCount > 0 && (
                    <span className="health-count-chip text-red">
                      <AlertTriangle size={16} color="#f87171" /> {healthReport.unhealthyCount} Unhealthy
                    </span>
                  )}
                  <button
                    className="btn btn-secondary btn-sm"
                    disabled={isProbing}
                    onClick={handleProbeHealth}
                  >
                    <RefreshCw size={13} className={isProbing ? 'animate-spin' : ''} /> {isProbing ? 'Probing...' : 'Re-probe All'}
                  </button>
                </div>
              </div>

              {/* 6 Dependency Checks Grid */}
              <div className="health-checks-grid">
                {healthReport.checks.map(check => {
                  const statusClass =
                    check.status === 'Healthy'
                      ? 'healthy'
                      : check.status === 'Degraded'
                      ? 'degraded'
                      : check.status === 'Not Configured'
                      ? 'not-configured'
                      : 'unhealthy';

                  return (
                    <div key={check.name} className="health-card">
                      <div className="health-card-top">
                        <div>
                          <h4 className="health-card-name">{check.name}</h4>
                          <span className="health-card-category">{check.component}</span>
                        </div>
                        <span className={`health-chip ${statusClass}`}>{check.status}</span>
                      </div>

                      <div className="health-card-message">{check.message}</div>

                      {check.component === 'Email Notifications' && (
                        <div style={{ marginTop: '4px' }}>
                          <button
                            className="btn btn-secondary btn-xs"
                            disabled={isTestingSmtp}
                            onClick={handleTestSmtp}
                            style={{ width: '100%', justifyContent: 'center' }}
                          >
                            <Mail size={12} className={isTestingSmtp ? 'animate-spin' : ''} />
                            {isTestingSmtp ? 'Connecting to SMTP...' : 'Execute Live Socket Ping'}
                          </button>

                          {smtpTestResult && (
                            <div
                              className={`smtp-probe-result ${smtpTestResult.success ? 'success' : 'failure'}`}
                              style={{ marginTop: '8px' }}
                            >
                              {smtpTestResult.success ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
                              <span>{smtpTestResult.message} ({smtpTestResult.latencyMs}ms)</span>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="health-card-footer">
                        <span>Latency: {check.latencyMs > 0 ? `${check.latencyMs}ms` : 'Instant / Local'}</span>
                        <span>Checked: {new Date(check.checkedAt).toLocaleTimeString()}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: GLOBAL SYSTEM CONFIGURATION */}
          {activeTab === 'config' && (
            <div className="card config-card">
              <div>
                <h3 className="announcements-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Sliders size={18} color="#38bdf8" /> Live Global Platform Configuration
                </h3>
                <p className="announcements-desc">
                  Edit platform policies, timeouts, storage quotas, and security boundaries. Changes persist directly into the database PlatformSettings table and take effect immediately.
                </p>
              </div>

              <form onSubmit={handleSaveConfig} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {/* General Settings */}
                <div>
                  <h4 className="config-section-title">
                    <Globe size={16} /> 1. Platform Identity & Regional Parameters
                  </h4>
                  <div className="config-grid-two">
                    <div className="form-group">
                      <label className="form-label required">Platform Display Name</label>
                      <input
                        type="text"
                        className="form-control"
                        value={configForm.platformName || ''}
                        onChange={e => setConfigForm({ ...configForm, platformName: e.target.value })}
                        placeholder="e.g. NexusSales Enterprise"
                        required
                      />
                      <div className="config-help-text">Displayed on login screens, page headers, and system communications.</div>
                    </div>

                    <div className="form-group">
                      <label className="form-label required">Global Support Email</label>
                      <input
                        type="email"
                        className="form-control"
                        value={configForm.supportEmail || ''}
                        onChange={e => setConfigForm({ ...configForm, supportEmail: e.target.value })}
                        placeholder="e.g. support@ghlindiaventures.com"
                        required
                      />
                      <div className="config-help-text">Contact email provided on maintenance screens and KYC notices.</div>
                    </div>

                    <div className="form-group">
                      <label className="form-label required">Default Timezone</label>
                      <select
                        className="form-control"
                        value={configForm.defaultTimezone || 'Asia/Kolkata (IST)'}
                        onChange={e => setConfigForm({ ...configForm, defaultTimezone: e.target.value })}
                      >
                        <option value="Asia/Kolkata (IST)">Asia/Kolkata (IST) — UTC+05:30</option>
                        <option value="Asia/Dubai (GST)">Asia/Dubai (GST) — UTC+04:00</option>
                        <option value="Asia/Singapore (SGT)">Asia/Singapore (SGT) — UTC+08:00</option>
                        <option value="Europe/London (GMT/BST)">Europe/London (GMT/BST) — UTC+00:00</option>
                        <option value="America/New_York (EST)">America/New_York (EST) — UTC-05:00</option>
                        <option value="UTC">Coordinated Universal Time (UTC)</option>
                      </select>
                      <div className="config-help-text">Standard baseline timezone for followups and reporting aggregation.</div>
                    </div>

                    <div className="form-group">
                      <label className="form-label required">Inactivity Session Timeout (Minutes)</label>
                      <input
                        type="number"
                        min="5"
                        max="1440"
                        className="form-control"
                        value={configForm.sessionTimeoutMinutes ?? 60}
                        onChange={e => setConfigForm({ ...configForm, sessionTimeoutMinutes: parseInt(e.target.value) || 60 })}
                        required
                      />
                      <div className="config-help-text">Client session validity window before requiring re-authentication.</div>
                    </div>
                  </div>
                </div>

                {/* Security Policies */}
                <div>
                  <h4 className="config-section-title">
                    <Shield size={16} /> 2. Security Boundaries & File Storage Quotas
                  </h4>
                  <div className="config-grid-two">
                    <div className="form-group">
                      <label className="form-label required">Max KYC & Media Upload Size (MB)</label>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        className="form-control"
                        value={configForm.maxUploadSizeMb ?? 25}
                        onChange={e => setConfigForm({ ...configForm, maxUploadSizeMb: parseInt(e.target.value) || 25 })}
                        required
                      />
                      <div className="config-help-text">Maximum single file limit for KYC identity proof and deal attachments.</div>
                    </div>

                    <div className="form-group">
                      <label className="form-label required">JWT Token Expiration (Minutes)</label>
                      <input
                        type="number"
                        min="15"
                        max="480"
                        className="form-control"
                        value={configForm.tokenExpirationMinutes ?? 60}
                        onChange={e => setConfigForm({ ...configForm, tokenExpirationMinutes: parseInt(e.target.value) || 60 })}
                        required
                      />
                      <div className="config-help-text">Access token lifespan issued to clients upon successful login.</div>
                    </div>

                    <div className="form-group">
                      <label className="form-label required">Minimum Password Length</label>
                      <input
                        type="number"
                        min="8"
                        max="32"
                        className="form-control"
                        value={configForm.passwordMinLength ?? 8}
                        onChange={e => setConfigForm({ ...configForm, passwordMinLength: parseInt(e.target.value) || 8 })}
                        required
                      />
                      <div className="config-help-text">Enforced during user creation and password reset flows.</div>
                    </div>

                    <div className="form-group">
                      <label className="form-label required">Call Recording Retention Window (Days)</label>
                      <input
                        type="number"
                        min="7"
                        max="365"
                        className="form-control"
                        value={configForm.recordingRetentionDays ?? 90}
                        onChange={e => setConfigForm({ ...configForm, recordingRetentionDays: parseInt(e.target.value) || 90 })}
                        required
                      />
                      <div className="config-help-text">Synchronized with CarrierSettings to govern audio purge lifecycles.</div>
                    </div>
                  </div>
                </div>

                {/* Email / SMTP Infrastructure View */}
                <div>
                  <h4 className="config-section-title">
                    <Mail size={16} /> 3. Outbound Notification & SMTP Gateway
                  </h4>
                  <div className="smtp-probe-box">
                    <div className="config-grid-two">
                      <div>
                        <span className="telemetry-item-label">SMTP Relay Host</span>
                        <div style={{ fontSize: '14px', fontWeight: 600, color: '#ffffff', marginTop: '2px' }}>
                          {globalConfig?.smtpHost || 'smtp.gmail.com'}:{globalConfig?.smtpPort || 587}
                        </div>
                        <div className="config-help-text">SSL / TLS: {globalConfig?.smtpEnableSsl ? 'Enabled (Port 587/465)' : 'Disabled'}</div>
                      </div>

                      <div>
                        <span className="telemetry-item-label">Authorized Sender Identity</span>
                        <div style={{ fontSize: '14px', fontWeight: 600, color: '#ffffff', marginTop: '2px' }}>
                          {globalConfig?.smtpSenderName || 'NexusSales Compliance'} &lt;{globalConfig?.smtpSenderEmail || 'studymail.zero@gmail.com'}&gt;
                        </div>
                        <div className="config-help-text">Credentials are securely managed in backend environment configuration.</div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', marginTop: '6px' }}>
                      <button
                        type="button"
                        className="btn btn-secondary btn-xs"
                        disabled={isTestingSmtp}
                        onClick={handleTestSmtp}
                      >
                        <RefreshCw size={12} className={isTestingSmtp ? 'animate-spin' : ''} />
                        {isTestingSmtp ? 'Connecting to SMTP...' : 'Test SMTP Server Connection'}
                      </button>

                      {smtpTestResult && (
                        <div className={`smtp-probe-result ${smtpTestResult.success ? 'success' : 'failure'}`}>
                          {smtpTestResult.success ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
                          <span>{smtpTestResult.message} ({smtpTestResult.latencyMs}ms)</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="config-actions-bar">
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => setConfigForm(globalConfig || {})}
                    disabled={isSavingConfig}
                  >
                    Reset Changes
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary btn-sm"
                    disabled={isSavingConfig}
                  >
                    <CheckCircle2 size={14} /> {isSavingConfig ? 'Persisting Changes...' : 'Save Global Configuration'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 4: FLEET BROADCAST ANNOUNCEMENTS & MAINTENANCE */}
          {activeTab === 'announcements' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
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
                  disabled={isTogglingMaint}
                  onClick={handleToggleMaintenance}
                >
                  {isTogglingMaint ? 'Updating Mode...' : maintenance.enabled ? 'Disable Maintenance Mode' : 'Enable Maintenance Lock'}
                </button>
              </div>

              {/* Broadcast Announcements Ledger Card */}
              <div className="card announcements-table-card">
                <div className="announcements-header-row">
                  <div>
                    <h3 className="announcements-title">Fleet Broadcast Announcements</h3>
                    <p className="announcements-desc">
                      Global notification banners stored in database and displayed persistently across tenant workspaces.
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
                            No active broadcast announcements found in database.
                          </td>
                        </tr>
                      ) : (
                        announcements.map(ann => (
                          <tr key={ann.id} className="ann-row">
                            <td>
                              <span className={`priority-chip ${ann.priority}`}>{ann.priority.toUpperCase()}</span>
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
                                  disabled={isActionInProgress}
                                  onChange={() => handleToggleAnnouncement(ann.id, ann.isActive)}
                                />
                                <span className="switch-slider round" />
                              </label>
                            </td>

                            <td style={{ textAlign: 'right' }}>
                              <button
                                className="btn-delete-ann"
                                title="Delete Announcement"
                                disabled={isActionInProgress}
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
            </div>
          )}
        </>
      )}

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
              <button className="btn btn-ghost" disabled={isCreatingAnn} onClick={() => setIsAnnModalOpen(false)}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                disabled={!annTitle.trim() || !annMessage.trim() || isCreatingAnn}
                onClick={handleCreateAnnouncement}
              >
                {isCreatingAnn ? 'Publishing...' : 'Publish Broadcast Banner'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
