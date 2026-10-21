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
  Play,
  Search,
  Zap,
} from 'lucide-react';
import {
  SystemDiagnostics,
  BroadcastAnnouncement,
  Tenant,
  SystemHealthReport,
  GlobalConfig,
  BackupSnapshot,
  DatabaseRadar,
  ServerLogEntry,
  BackgroundJobStatus,
} from '../../../types';
import { superAdminService } from '../../../services/superAdminService';
import { signalRService } from '../../../services/signalRService';
import { useUnsavedChanges } from '../../../context/NavigationGuardContext';
import { Modal } from '../../../components/common/Modal';
import './PlatformSystemPage.css';

type SystemTab = 'diagnostics' | 'radar' | 'logs' | 'jobs' | 'health' | 'config' | 'announcements' | 'backups';

export const PlatformSystemPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<SystemTab>('diagnostics');
  const [diagnostics, setDiagnostics] = useState<SystemDiagnostics | null>(null);
  const [healthReport, setHealthReport] = useState<SystemHealthReport | null>(null);
  const [globalConfig, setGlobalConfig] = useState<GlobalConfig | null>(null);
  const [configForm, setConfigForm] = useState<Partial<GlobalConfig>>({});
  const [announcements, setAnnouncements] = useState<BroadcastAnnouncement[]>([]);
  const activeGlobalAnnouncement = announcements.find(
    a => a.isActive && (!a.targetTenantId || a.targetTenantId === 'all')
  );
  const hasActiveGlobal = !!activeGlobalAnnouncement;
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
  const [backupStatus, setBackupStatus] = useState<any>(null);

  // Database Backup Vault State
  const [backups, setBackups] = useState<BackupSnapshot[]>([]);
  const [isGeneratingBackup, setIsGeneratingBackup] = useState(false);
  const [backupDesc, setBackupDesc] = useState('');
  const [includeAuditLogsInBackup, setIncludeAuditLogsInBackup] = useState(true);

  // Database Connection Pool Radar State
  const [databaseRadar, setDatabaseRadar] = useState<DatabaseRadar | null>(null);
  const [isLoadingRadar, setIsLoadingRadar] = useState(false);
  const [isTerminatingIdle, setIsTerminatingIdle] = useState(false);

  // Live Server Logs Stream State
  const [serverLogs, setServerLogs] = useState<ServerLogEntry[]>([]);
  const [logSearchQuery, setLogSearchQuery] = useState('');
  const [logLevelFilter, setLogLevelFilter] = useState<'all' | 'ERROR' | 'WARN'>('all');
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [selectedLogForDrawer, setSelectedLogForDrawer] = useState<ServerLogEntry | null>(null);

  // Background Services & Cron Jobs State
  const [backgroundJobs, setBackgroundJobs] = useState<BackgroundJobStatus[]>([]);
  const [isLoadingJobs, setIsLoadingJobs] = useState(false);
  const [triggeringJobId, setTriggeringJobId] = useState<string | null>(null);

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
      const [diag, health, config, anns, allTenants, maint, backup, backupList] = await Promise.all([
        superAdminService.fetchSystemDiagnosticsFromApi(),
        superAdminService.fetchSystemHealthChecksFromApi(),
        superAdminService.fetchGlobalConfigFromApi(),
        superAdminService.fetchAnnouncementsFromApi(),
        superAdminService.fetchTenantsFromApi(),
        superAdminService.fetchMaintenanceModeFromApi(),
        superAdminService.getBackupStatus().catch(() => null),
        superAdminService.fetchDatabaseBackupsApi().catch(() => []),
      ]);

      setDiagnostics(diag);
      setHealthReport(health);
      setGlobalConfig(config);
      setConfigForm(config);
      setAnnouncements(anns || []);
      setTenants(allTenants || []);
      setMaintenance(maint);
      setBackupStatus(backup);
      setBackups(backupList || []);
      if (isManualRefresh) {
        showSuccess('Live telemetry and system health refreshed.');
      }
    } catch (err: any) {
      console.error('Failed to load system data from API:', err);
      setErrorMsg(err.message || 'Failed to connect to server.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();

    const handleUpdate = () => loadData(false);
    window.addEventListener('nexus_admin_updated', handleUpdate);
    window.addEventListener('nexus_signalr_reconnected', handleUpdate);

    const handleAnnouncementEvent = (data: any) => {
      const action = data?.action || (data?.isActive === false ? 'deactivated' : 'activated');
      const ann: BroadcastAnnouncement | undefined = data?.announcement || (data?.title ? data : undefined);
      const annId = String(data?.announcementId || ann?.id || '');

      if (!annId && !ann) return;

      if (action === 'deleted') {
        setAnnouncements(prev => prev.filter(a => String(a.id) !== annId));
        return;
      }

      if (action === 'activated' || action === 'deactivated') {
        const isActive = action === 'activated';
        setAnnouncements(prev => {
          const idx = prev.findIndex(a => String(a.id) === annId);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = { ...next[idx], ...(ann || {}), isActive };
            return next;
          }
          if (ann) {
            return [ann, ...prev];
          }
          return prev;
        });
        return;
      }

      if (action === 'created') {
        if (ann) {
          setAnnouncements(prev => {
            if (prev.some(a => String(a.id) === String(ann.id))) {
              return prev;
            }
            return [ann, ...prev];
          });
        } else {
          loadData(false);
        }
      }
    };

    const unsubCreated = signalRService.on('AnnouncementCreated', handleAnnouncementEvent);
    const unsubActivated = signalRService.on('AnnouncementActivated', handleAnnouncementEvent);
    const unsubDeactivated = signalRService.on('AnnouncementDeactivated', handleAnnouncementEvent);
    const unsubDeleted = signalRService.on('AnnouncementDeleted', handleAnnouncementEvent);
    const unsubBroadcast = signalRService.on('AnnouncementBroadcast', (ann: any) => {
      handleAnnouncementEvent({
        announcementId: ann?.id,
        action: ann?.isActive ? 'activated' : 'deactivated',
        announcement: ann,
      });
    });

    return () => {
      unsubCreated();
      unsubActivated();
      unsubDeactivated();
      unsubDeleted();
      unsubBroadcast();
      window.removeEventListener('nexus_admin_updated', handleUpdate);
      window.removeEventListener('nexus_signalr_reconnected', handleUpdate);
    };
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

  // ── ENTERPRISE RADAR & LOGS HANDLERS ──────────────────────────────────────

  const loadDatabaseRadar = async () => {
    setIsLoadingRadar(true);
    try {
      const data = await superAdminService.fetchDatabaseRadar();
      setDatabaseRadar(data);
    } catch (err: any) {
      console.warn('Could not load database radar:', err);
    } finally {
      setIsLoadingRadar(false);
    }
  };

  const handleTerminateIdleConnections = async () => {
    setIsTerminatingIdle(true);
    try {
      const count = await superAdminService.terminateIdleConnections();
      showSuccess(`Successfully terminated and released ${count} idle connection slots to the pool.`);
      await loadDatabaseRadar();
    } catch (err: any) {
      alert(err.message || 'Failed to terminate idle connections.');
    } finally {
      setIsTerminatingIdle(false);
    }
  };

  const loadServerLogs = async () => {
    setIsLoadingLogs(true);
    try {
      const data = await superAdminService.fetchServerLogs({
        search: logSearchQuery,
        level: logLevelFilter,
        limit: 100,
      });
      setServerLogs(data);
    } catch (err: any) {
      console.warn('Could not load server logs:', err);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  const handleClearServerLogs = async () => {
    if (!window.confirm('Are you sure you want to permanently clear server error logs?')) return;
    try {
      await superAdminService.clearServerLogs();
      setServerLogs([]);
      showSuccess('Server error logs truncated and cleared.');
    } catch (err: any) {
      alert(err.message || 'Failed to clear server logs.');
    }
  };

  const loadBackgroundJobs = async () => {
    setIsLoadingJobs(true);
    try {
      const data = await superAdminService.fetchBackgroundJobs();
      setBackgroundJobs(data);
    } catch (err: any) {
      console.warn('Could not load background jobs:', err);
    } finally {
      setIsLoadingJobs(false);
    }
  };

  const handleTriggerBackgroundJob = async (jobId: string) => {
    setTriggeringJobId(jobId);
    try {
      const msg = await superAdminService.triggerBackgroundJob(jobId);
      showSuccess(msg);
      await loadBackgroundJobs();
    } catch (err: any) {
      alert(err.message || 'Failed to trigger background job.');
    } finally {
      setTriggeringJobId(null);
    }
  };

  useEffect(() => {
    if (activeTab === 'radar') loadDatabaseRadar();
    if (activeTab === 'logs') loadServerLogs();
    if (activeTab === 'jobs') loadBackgroundJobs();
  }, [activeTab]);

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!configForm) return;

    setIsSavingConfig(true);
    try {
      const updated = await superAdminService.updateGlobalConfigApi(configForm);
      setGlobalConfig(updated);
      setConfigForm(updated);
      showSuccess('Global platform configuration saved and persisted.');
    } catch (err: any) {
      alert(err.message || 'Failed to update global configuration');
    } finally {
      setIsSavingConfig(false);
    }
  };

  const handleCreateAnnouncement = async () => {
    if (!annTitle.trim() || !annMessage.trim() || isCreatingAnn) return;
    setIsCreatingAnn(true);

    const isGlobal = !annTenantId || annTenantId === 'all';
    const willBeActive = isGlobal ? !hasActiveGlobal : true;

    try {
      const created = await superAdminService.createAnnouncementApi({
        title: annTitle.trim(),
        message: annMessage.trim(),
        priority: annPriority,
        targetAudience: annAudience,
        targetTenantId: annTenantId === 'all' ? undefined : annTenantId,
        isActive: willBeActive,
      });

      setAnnouncements(prev => [created, ...prev]);
      setIsAnnModalOpen(false);
      setAnnTitle('');
      setAnnMessage('');
      if (willBeActive) {
        showSuccess('Broadcast announcement published and active.');
      } else {
        showSuccess('Broadcast announcement published as inactive (another broadcast is currently active).');
      }
    } catch (err: any) {
      alert(err.message || 'Failed to publish announcement');
      try {
        const fresh = await superAdminService.fetchAnnouncementsFromApi();
        setAnnouncements(fresh || []);
      } catch {
        // ignore secondary error
      }
    } finally {
      setIsCreatingAnn(false);
    }
  };

  const handleToggleAnnouncement = async (id: string, current: boolean) => {
    if (isActionInProgress) return;

    const targetAnn = announcements.find(a => String(a.id) === String(id));
    const isGlobal = !targetAnn?.targetTenantId || targetAnn?.targetTenantId === 'all';

    // Client-side guard: Only one global broadcast can be active at any given time
    if (!current && isGlobal && hasActiveGlobal && String(activeGlobalAnnouncement?.id) !== String(id)) {
      alert("Another broadcast is currently active. Deactivate it before activating this broadcast.");
      return;
    }

    setIsActionInProgress(true);
    try {
      await superAdminService.toggleAnnouncementApi(id, !current);
      setAnnouncements(prev => prev.map(a => (String(a.id) === String(id) ? { ...a, isActive: !current } : a)));
      showSuccess(`Broadcast banner ${!current ? 'ACTIVATED' : 'DEACTIVATED'}.`);
    } catch (err: any) {
      alert(err.message || 'Failed to toggle announcement');
      // If rejection occurred due to stale UI, immediately re-sync table from backend
      try {
        const fresh = await superAdminService.fetchAnnouncementsFromApi();
        setAnnouncements(fresh || []);
      } catch {
        // ignore secondary error
      }
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
        showSuccess('Broadcast announcement deleted.');
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
      showSuccess('Platform backup snapshot exported successfully.');

      // Refresh diagnostics so LastBackupAt reflects this backup immediately
      const freshDiag = await superAdminService.fetchSystemDiagnosticsFromApi();
      setDiagnostics(freshDiag);
    } catch (err: any) {
      alert(err.message || 'Failed to export platform backup');
    } finally {
      setIsExporting(false);
    }
  };

  const handleGenerateBackup = async () => {
    setIsGeneratingBackup(true);
    try {
      const newBackup = await superAdminService.generateDatabaseBackupApi({
        description: backupDesc.trim() || undefined,
        includeAuditLogs: includeAuditLogsInBackup,
      });
      setBackups(prev => [newBackup, ...prev]);
      setBackupDesc('');
      showSuccess(`Database snapshot '${newBackup.filename || newBackup.fileName}' created successfully (${newBackup.formattedSize || (newBackup.fileSizeBytes / (1024 * 1024)).toFixed(2) + ' MB'}).`);
    } catch (err: any) {
      alert(err.message || 'Failed to generate database snapshot');
    } finally {
      setIsGeneratingBackup(false);
    }
  };

  const handleDownloadBackupFile = async (snapshot: BackupSnapshot) => {
    try {
      await superAdminService.downloadDatabaseBackupApi(snapshot.id, snapshot.filename || snapshot.fileName || 'backup.json');
    } catch (err: any) {
      alert(err.message || 'Failed to download snapshot file');
    }
  };

  const handleDeleteBackupSnapshot = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete backup snapshot '${name}'? This cannot be undone.`)) return;
    try {
      await superAdminService.deleteDatabaseBackupApi(id);
      setBackups(prev => prev.filter(b => b.id !== id));
      showSuccess('Backup snapshot removed from registry.');
    } catch (err: any) {
      alert(err.message || 'Failed to delete snapshot');
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
            Live diagnostics, runtime vitals telemetry, external dependency probes, and persistent global platform configurations.
          </p>
        </div>

        <div className="system-header-actions">
          <button
            className="btn btn-secondary btn-sm"
            disabled={isRefreshing || isLoading}
            onClick={() => loadData(true)}
            title="Fetch latest metrics and telemetry directly from server"
          >
            <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
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
          className={`system-tab-btn ${activeTab === 'radar' ? 'active' : ''}`}
          onClick={() => setActiveTab('radar')}
        >
          <Database size={15} /> Database Radar
          {databaseRadar && (
            <span className={`tab-badge ${databaseRadar.status.includes('Critical') ? 'amber' : 'green'}`}>
              {databaseRadar.activeConnections}/{databaseRadar.maxPoolSize} Pool
            </span>
          )}
        </button>

        <button
          className={`system-tab-btn ${activeTab === 'logs' ? 'active' : ''}`}
          onClick={() => setActiveTab('logs')}
        >
          <Terminal size={15} /> Error Log Stream
          {serverLogs.length > 0 && (
            <span className="tab-badge amber">{serverLogs.length}</span>
          )}
        </button>

        <button
          className={`system-tab-btn ${activeTab === 'jobs' ? 'active' : ''}`}
          onClick={() => setActiveTab('jobs')}
        >
          <Clock size={15} /> Background Schedulers
          {backgroundJobs.length > 0 && (
            <span className="tab-badge blue">{backgroundJobs.length}</span>
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

        <button
          className={`system-tab-btn ${activeTab === 'backups' ? 'active' : ''}`}
          onClick={() => setActiveTab('backups')}
        >
          <Database size={15} /> Database Backup Vault
          {backups.length > 0 && (
            <span className="tab-badge green">{backups.length}</span>
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
                    <span className="telemetry-item-label">
                      Database Backup ({backupStatus?.provider || 'PostgreSQL Neon AWS'})
                    </span>
                    <span className="telemetry-item-value" style={{ fontSize: '13px', color: backupStatus?.status === 'Healthy' ? '#34d399' : '#38bdf8' }}>
                      {backupStatus?.lastBackupAt
                        ? `${new Date(backupStatus.lastBackupAt).toLocaleDateString()} (${backupStatus.backupSize})`
                        : diagnostics.lastBackupAt
                          ? new Date(diagnostics.lastBackupAt).toLocaleDateString()
                          : 'Active Automated Snapshots'}
                    </span>
                    <span className="telemetry-item-sub">
                      Status: {backupStatus?.status || 'Active'} • Retention: {backupStatus?.retentionDays || 30} days ({backupStatus?.tablesArchivedCount || 16} tables)
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
                  Edit platform policies, timeouts, storage quotas, and security boundaries. Changes persist directly into the PlatformSettings table and take effect immediately.
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
                      <label htmlFor="config-platform-name" className="form-label required">Platform Display Name</label>
                      <input
                        id="config-platform-name"
                        name="platformName"
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
                      <label htmlFor="config-support-email" className="form-label required">Global Support Email</label>
                      <input
                        id="config-support-email"
                        name="supportEmail"
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
                      <label htmlFor="config-default-timezone" className="form-label required">Default Timezone</label>
                      <select
                        id="config-default-timezone"
                        name="defaultTimezone"
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
                      <label htmlFor="config-session-timeout" className="form-label required">Inactivity Session Timeout (Minutes)</label>
                      <input
                        id="config-session-timeout"
                        name="sessionTimeoutMinutes"
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
                      <label htmlFor="config-max-upload-size" className="form-label required">Max KYC & Media Upload Size (MB)</label>
                      <input
                        id="config-max-upload-size"
                        name="maxUploadSizeMb"
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
                      <label htmlFor="config-token-expiration" className="form-label required">JWT Token Expiration (Minutes)</label>
                      <input
                        id="config-token-expiration"
                        name="tokenExpirationMinutes"
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
                      <label htmlFor="config-password-min-length" className="form-label required">Minimum Password Length</label>
                      <input
                        id="config-password-min-length"
                        name="passwordMinLength"
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
                      <label htmlFor="config-recording-retention" className="form-label required">Call Recording Retention Window (Days)</label>
                      <input
                        id="config-recording-retention"
                        name="recordingRetentionDays"
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
                      Global notification banners stored and displayed persistently across tenant workspaces.
                    </p>
                  </div>
                  <button
                    className="btn btn-primary btn-xs"
                    onClick={() => setIsAnnModalOpen(true)}
                  >
                    <Plus size={12} /> New Broadcast Banner
                  </button>
                </div>

                <div className={`single-active-broadcast-status ${hasActiveGlobal ? 'has-active' : 'idle'}`}>
                  {hasActiveGlobal ? (
                    <>
                      <div className="status-live-dot" />
                      <span>
                        <strong>Currently Active Global Broadcast:</strong> &ldquo;{activeGlobalAnnouncement?.title}&rdquo;.
                        Only 1 global broadcast can be active at a time. Other global broadcasts are locked until this broadcast is deactivated.
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="status-idle-icon">⚡</span>
                      <span>
                        <strong>Global Broadcast Channel Idle:</strong> No global broadcast is currently active. Any announcement can be activated.
                      </span>
                    </>
                  )}
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
                              {(() => {
                                const isGlobal = !ann.targetTenantId || ann.targetTenantId === 'all';
                                const isLocked = !ann.isActive && isGlobal && hasActiveGlobal;
                                const tooltipText = isLocked
                                  ? "Another broadcast is currently active. Deactivate it before activating this broadcast."
                                  : ann.isActive
                                    ? "Click to deactivate this broadcast"
                                    : "Click to activate this broadcast";

                                return (
                                  <div className="ann-switch-cell" title={tooltipText}>
                                    <label
                                      htmlFor={`ann-toggle-${ann.id}`}
                                      className={`switch-control ${isLocked ? 'switch-disabled' : ''}`}
                                      title={tooltipText}
                                    >
                                      <input
                                        id={`ann-toggle-${ann.id}`}
                                        name={`ann-toggle-${ann.id}`}
                                        type="checkbox"
                                        checked={ann.isActive}
                                        disabled={isActionInProgress || isLocked}
                                        onChange={() => handleToggleAnnouncement(ann.id, ann.isActive)}
                                        aria-label={tooltipText}
                                      />
                                      <span className={`switch-slider round ${isLocked ? 'locked' : ''}`} />
                                    </label>
                                    {isLocked && (
                                      <span className="switch-locked-tag" title={tooltipText}>
                                        <Lock size={10} />
                                      </span>
                                    )}
                                  </div>
                                );
                              })()}
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

          {/* TAB 5: DATABASE BACKUP & SNAPSHOT VAULT */}
          {activeTab === 'backups' && (
            <div className="backup-vault-section">
              {/* Snapshot Generator Card */}
              <div className="backup-gen-box">
                <div className="backup-gen-header">
                  <div>
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Database size={18} style={{ color: '#8b5cf6' }} />
                      Platform Instant Database Backup & Snapshot Generator
                    </h3>
                    <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#94a3b8' }}>
                      Captures full platform state across tenants, users, call sessions, pipelines, leads, and audit trails with SHA-256 cryptographic verification.
                    </p>
                  </div>
                  <button
                    className="btn btn-primary"
                    disabled={isGeneratingBackup}
                    onClick={handleGenerateBackup}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px' }}
                  >
                    {isGeneratingBackup ? (
                      <>
                        <RefreshCw size={15} className="animate-spin" />
                        Generating Snapshot...
                      </>
                    ) : (
                      <>
                        <Plus size={15} />
                        Create Database Snapshot
                      </>
                    )}
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginTop: '4px' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '12px' }}>Snapshot Description / Label (Optional)</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. Pre-v2.4 Migration State, Monthly Compliance Snapshot"
                      value={backupDesc}
                      onChange={e => setBackupDesc(e.target.value)}
                      disabled={isGeneratingBackup}
                    />
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingTop: '22px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: '#cbd5e1' }}>
                      <input
                        type="checkbox"
                        checked={includeAuditLogsInBackup}
                        onChange={e => setIncludeAuditLogsInBackup(e.target.checked)}
                        disabled={isGeneratingBackup}
                        style={{ width: '16px', height: '16px', accentColor: '#8b5cf6' }}
                      />
                      Include complete Audit Log event trails in snapshot
                    </label>
                  </div>
                </div>
              </div>

              {/* Snapshot Vault Table */}
              <div className="backup-table-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <HardDrive size={16} style={{ color: '#38bdf8' }} />
                    Snapshot Repository ({backups.length} archived)
                  </h3>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => loadData(true)}
                    disabled={isRefreshing}
                    style={{ fontSize: '12px' }}
                  >
                    <RefreshCw size={13} className={isRefreshing ? 'animate-spin' : ''} />
                    Refresh Vault
                  </button>
                </div>

                <div className="table-responsive">
                  <table className="backup-data-table">
                    <thead>
                      <tr>
                        <th>Snapshot Name & Type</th>
                        <th>Created At</th>
                        <th>Created By</th>
                        <th>Records Captured</th>
                        <th>Size</th>
                        <th>SHA-256 Checksum</th>
                        <th>Status</th>
                        <th style={{ textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {backups.length === 0 ? (
                        <tr>
                          <td colSpan={8} style={{ textAlign: 'center', padding: '36px', color: '#64748b' }}>
                            <Database size={28} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
                            <div>No database snapshots stored yet. Click "Create Database Snapshot" above to generate your first backup.</div>
                          </td>
                        </tr>
                      ) : (
                        backups.map(b => (
                          <tr key={b.id}>
                            <td>
                              <div>
                                <span className="backup-filename">{b.filename || b.fileName}</span>
                                {b.description && (
                                  <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>{b.description}</div>
                                )}
                              </div>
                            </td>
                            <td>
                              <div style={{ fontSize: '12px', color: '#cbd5e1' }}>
                                {new Date(b.createdAt).toLocaleString()}
                              </div>
                            </td>
                            <td>
                              <span style={{ fontSize: '12px', color: '#94a3b8' }}>{b.createdBy}</span>
                            </td>
                            <td>
                              <span style={{ fontWeight: 600, color: '#38bdf8' }}>{(b.totalRecordsCount ?? b.recordCount ?? 0).toLocaleString()}</span>
                            </td>
                            <td>
                              <span style={{ fontSize: '12px', color: '#e2e8f0' }}>
                                {b.formattedSize || `${(b.fileSizeBytes / (1024 * 1024)).toFixed(2)} MB`}
                              </span>
                            </td>
                            <td>
                              <span className="checksum-pill" title={b.checksumSha256 || b.sha256Checksum || ''}>
                                {b.checksumSha256 || b.sha256Checksum || 'SHA256 verified'}
                              </span>
                            </td>
                            <td>
                              <span className={`status-pill ${b.status === 'Completed' ? 'active' : 'warning'}`}>
                                {b.status}
                              </span>
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                                <button
                                  className="btn btn-ghost btn-sm"
                                  onClick={() => handleDownloadBackupFile(b)}
                                  title="Download Snapshot File"
                                  style={{ padding: '4px 8px', color: '#38bdf8' }}
                                >
                                  <Download size={14} />
                                </button>
                                <button
                                  className="btn-delete-ann"
                                  onClick={() => handleDeleteBackupSnapshot(b.id, b.filename || b.fileName || 'Snapshot')}
                                  title="Delete Snapshot"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
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

          {/* TAB: DATABASE RADAR & POOL TELEMETRY */}
          {activeTab === 'radar' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Radar Pool Banner */}
              <div className="system-card" style={{ padding: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
                  <div>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Radio size={14} /> LIVE DATABASE POOL RADAR & CAPACITY
                    </div>
                    <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#f8fafc', margin: '6px 0 4px' }}>
                      {databaseRadar?.databaseEngine || 'PostgreSQL'} Connection Pool & Storage
                    </h2>
                    <p style={{ fontSize: '13px', color: '#94a3b8', margin: 0 }}>
                      Real-time connection pool saturation, idle connection eviction, and storage consumption by table.
                    </p>
                  </div>

                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={loadDatabaseRadar}
                      disabled={isLoadingRadar}
                    >
                      <RefreshCw size={13} className={isLoadingRadar ? 'animate-spin' : ''} />
                      {isLoadingRadar ? 'Refreshing...' : 'Refresh Radar'}
                    </button>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={handleTerminateIdleConnections}
                      disabled={isTerminatingIdle || !databaseRadar || databaseRadar.idleConnections === 0}
                      title="Kill idle backend connections to free up pool capacity"
                    >
                      <Zap size={13} />
                      {isTerminatingIdle ? 'Evicting...' : `Evict Idle Connections (${databaseRadar?.idleConnections ?? 0})`}
                    </button>
                  </div>
                </div>

                {/* Pool Saturation Gauge */}
                <div style={{ marginTop: '20px', background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '10px', padding: '18px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px' }}>
                    <span style={{ color: '#cbd5e1', fontWeight: 600 }}>Connection Pool Saturation</span>
                    <span style={{ color: (databaseRadar?.poolUtilizationPercent ?? 0) > 85 ? '#f87171' : (databaseRadar?.poolUtilizationPercent ?? 0) > 70 ? '#fbbf24' : '#34d399', fontWeight: 700 }}>
                      {databaseRadar?.poolUtilizationPercent ?? 0}% ({databaseRadar?.totalConnections ?? 0} / {databaseRadar?.maxPoolSize ?? 100} connections)
                    </span>
                  </div>
                  <div style={{ height: '10px', borderRadius: '5px', background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                    <div
                      style={{
                        height: '100%',
                        width: `${Math.min(100, databaseRadar?.poolUtilizationPercent ?? 0)}%`,
                        background: (databaseRadar?.poolUtilizationPercent ?? 0) > 85
                          ? 'linear-gradient(90deg, #f97316, #ef4444)'
                          : (databaseRadar?.poolUtilizationPercent ?? 0) > 70
                            ? 'linear-gradient(90deg, #eab308, #f59e0b)'
                            : 'linear-gradient(90deg, #06b6d4, #10b981)',
                        transition: 'width 0.4s ease'
                      }}
                    />
                  </div>
                </div>

                {/* Radar Metrics Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginTop: '20px' }}>
                  <div className="telemetry-item-box">
                    <span className="telemetry-item-label">Active / Executing</span>
                    <span className="telemetry-item-value" style={{ color: '#38bdf8' }}>{databaseRadar?.activeConnections ?? 0}</span>
                    <span className="telemetry-item-sub">Processing active queries</span>
                  </div>
                  <div className="telemetry-item-box">
                    <span className="telemetry-item-label">Idle in Pool</span>
                    <span className="telemetry-item-value" style={{ color: '#94a3b8' }}>{databaseRadar?.idleConnections ?? 0}</span>
                    <span className="telemetry-item-sub">Ready for reuse</span>
                  </div>
                  <div className="telemetry-item-box">
                    <span className="telemetry-item-label">Idle In Transaction</span>
                    <span className="telemetry-item-value" style={{ color: (databaseRadar?.idleInTransaction ?? 0) > 0 ? '#f87171' : '#34d399' }}>
                      {databaseRadar?.idleInTransaction ?? 0}
                    </span>
                    <span className="telemetry-item-sub">Uncommitted open transactions</span>
                  </div>
                  <div className="telemetry-item-box">
                    <span className="telemetry-item-label">Total DB Disk Size</span>
                    <span className="telemetry-item-value" style={{ color: '#a78bfa' }}>{databaseRadar?.totalDatabaseSize ?? 'Calculating...'}</span>
                    <span className="telemetry-item-sub">Tables + Indexes on disk</span>
                  </div>
                </div>
              </div>

              {/* Table Storage Breakdown */}
              <div className="system-card">
                <div className="system-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h3 className="system-card-title">Database Storage & Table Registry</h3>
                    <p className="system-card-desc">Storage size breakdown across all platform relational tables</p>
                  </div>
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                    {databaseRadar?.tableSizes?.length ?? 0} tables indexed
                  </div>
                </div>

                <div className="system-card-body" style={{ padding: 0 }}>
                  <div className="table-responsive">
                    <table className="backup-table">
                      <thead>
                        <tr>
                          <th>Table Name</th>
                          <th>Record Count</th>
                          <th>Formatted Size</th>
                          <th>Bytes</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {!databaseRadar || !databaseRadar.tableSizes || databaseRadar.tableSizes.length === 0 ? (
                          <tr>
                            <td colSpan={5} style={{ textAlign: 'center', padding: '32px', color: '#94a3b8' }}>
                              {isLoadingRadar ? 'Analyzing database tables...' : 'No table metrics found.'}
                            </td>
                          </tr>
                        ) : (
                          databaseRadar.tableSizes.map(table => (
                            <tr key={table.tableName}>
                              <td style={{ fontWeight: 600, color: '#f1f5f9' }}>
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                                  <Database size={14} color="#38bdf8" />
                                  <code>{table.tableName}</code>
                                </span>
                              </td>
                              <td style={{ color: '#cbd5e1' }}>{(table.recordCount ?? table.rowCount ?? 0).toLocaleString()}</td>
                              <td style={{ fontWeight: 600, color: '#38bdf8' }}>{table.sizeFormatted || table.totalSize || '0 KB'}</td>
                              <td style={{ color: '#94a3b8' }}>{table.sizeBytes ? `${(table.sizeBytes / 1024).toFixed(1)} KB` : '—'}</td>
                              <td style={{ color: '#34d399' }}>Indexed</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB: LIVE SERVER LOG STREAM */}
          {activeTab === 'logs' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div className="system-card" style={{ padding: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
                  <div>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#f87171', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Terminal size={14} /> LIVE SERVER ERROR LOG STREAM
                    </div>
                    <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#f8fafc', margin: '6px 0 4px' }}>
                      Backend Exception & Telephony Log Console
                    </h2>
                    <p style={{ fontSize: '13px', color: '#94a3b8', margin: 0 }}>
                      Captured unhandled exceptions, telephony pipeline errors, and HTTP 5xx responses with stack traces.
                    </p>
                  </div>

                  <div style={{ display: 'flex', gap: '10px' }}>
                    <a
                      href={superAdminService.getDownloadServerLogsUrl()}
                      className="btn btn-secondary btn-sm"
                      download="nexus_backend_errors.log"
                    >
                      <Download size={13} /> Download .log File
                    </a>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={loadServerLogs}
                      disabled={isLoadingLogs}
                    >
                      <RefreshCw size={13} className={isLoadingLogs ? 'animate-spin' : ''} />
                      {isLoadingLogs ? 'Loading...' : 'Refresh Logs'}
                    </button>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={handleClearServerLogs}
                      disabled={serverLogs.length === 0}
                    >
                      <Trash2 size={13} /> Clear Error Logs
                    </button>
                  </div>
                </div>

                {/* Filters Row */}
                <div style={{ display: 'flex', gap: '12px', marginTop: '20px', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: '240px', position: 'relative' }}>
                    <Search size={15} style={{ position: 'absolute', left: '12px', top: '10px', color: '#64748b' }} />
                    <input
                      type="text"
                      className="form-control"
                      style={{ paddingLeft: '34px' }}
                      placeholder="Search error messages, routes, exception names..."
                      value={logSearchQuery}
                      onChange={e => setLogSearchQuery(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') loadServerLogs(); }}
                    />
                  </div>
                  <div style={{ width: '160px' }}>
                    <select
                      className="form-control"
                      value={logLevelFilter}
                      onChange={e => {
                        setLogLevelFilter(e.target.value as any);
                        setTimeout(loadServerLogs, 0);
                      }}
                    >
                      <option value="all">All Levels</option>
                      <option value="ERROR">ERROR Only</option>
                      <option value="WARN">WARN Only</option>
                    </select>
                  </div>
                  <button className="btn btn-primary btn-sm" onClick={loadServerLogs}>
                    Filter
                  </button>
                </div>
              </div>

              {/* Logs Table */}
              <div className="system-card">
                <div className="system-card-body" style={{ padding: 0 }}>
                  <div className="table-responsive">
                    <table className="backup-table">
                      <thead>
                        <tr>
                          <th>Timestamp</th>
                          <th>Level</th>
                          <th>Method / Route</th>
                          <th>Exception / Message</th>
                          <th>Client IP</th>
                          <th style={{ textAlign: 'right' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {isLoadingLogs ? (
                          <tr>
                            <td colSpan={6} style={{ textAlign: 'center', padding: '36px', color: '#94a3b8' }}>
                              Loading server error logs...
                            </td>
                          </tr>
                        ) : serverLogs.length === 0 ? (
                          <tr>
                            <td colSpan={6} style={{ textAlign: 'center', padding: '36px', color: '#94a3b8' }}>
                              <CheckCircle2 size={24} color="#34d399" style={{ margin: '0 auto 8px', display: 'block' }} />
                              No error logs recorded. Backend pipeline operating cleanly!
                            </td>
                          </tr>
                        ) : (
                          serverLogs.map(log => (
                            <tr
                              key={log.id}
                              style={{ cursor: 'pointer' }}
                              onClick={() => setSelectedLogForDrawer(log)}
                            >
                              <td style={{ whiteSpace: 'nowrap', fontSize: '12px', color: '#94a3b8' }}>
                                {new Date(log.timestamp).toLocaleString()}
                              </td>
                              <td>
                                <span className={`status-pill ${log.level === 'ERROR' ? 'critical' : 'warning'}`}>
                                  {log.level}
                                </span>
                              </td>
                              <td style={{ fontSize: '13px', fontWeight: 600, color: '#f1f5f9' }}>
                                <code>{log.method} {log.path || log.requestPath || '/'}</code>
                              </td>
                              <td style={{ fontSize: '12px', color: '#fca5a5', maxWidth: '380px' }}>
                                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={log.message}>
                                  {(log.exceptionType || log.source) ? `[${log.exceptionType || log.source}] ` : ''}{log.message}
                                </div>
                              </td>
                              <td style={{ fontSize: '12px', color: '#64748b' }}>
                                {log.ipAddress || log.source || 'internal'}
                              </td>
                              <td style={{ textAlign: 'right' }}>
                                <button
                                  className="btn btn-ghost btn-sm"
                                  onClick={e => {
                                    e.stopPropagation();
                                    setSelectedLogForDrawer(log);
                                  }}
                                  style={{ color: '#38bdf8', fontSize: '12px' }}
                                >
                                  View Trace
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
            </div>
          )}

          {/* TAB: BACKGROUND SERVICES & CRON JOBS */}
          {activeTab === 'jobs' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div className="system-card" style={{ padding: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
                  <div>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#a78bfa', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Clock size={14} /> PLATFORM BACKGROUND SERVICES & CRON DAEMONS
                    </div>
                    <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#f8fafc', margin: '6px 0 4px' }}>
                      Background Workers & Automated Schedulers
                    </h2>
                    <p style={{ fontSize: '13px', color: '#94a3b8', margin: 0 }}>
                      Manage automated reconciliations, daily telephony rollups, handover expirations, and trigger tasks on-demand.
                    </p>
                  </div>

                  <div>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={loadBackgroundJobs}
                      disabled={isLoadingJobs}
                    >
                      <RefreshCw size={13} className={isLoadingJobs ? 'animate-spin' : ''} />
                      {isLoadingJobs ? 'Refreshing...' : 'Refresh Schedulers'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Grid of Background Job Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px' }}>
                {backgroundJobs.map(job => (
                  <div key={job.id} className="system-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div style={{ padding: '20px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                        <div>
                          <h4 style={{ fontSize: '16px', fontWeight: 700, color: '#f8fafc', margin: 0 }}>{job.name}</h4>
                          <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>ID: {job.id}</span>
                        </div>
                        <span className={`status-pill ${job.status === 'Active' ? 'active' : 'info'}`}>
                          {job.status}
                        </span>
                      </div>

                      <p style={{ fontSize: '13px', color: '#94a3b8', lineHeight: 1.5, marginBottom: '16px' }}>
                        {job.description}
                      </p>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px', background: 'rgba(15, 23, 42, 0.4)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: '#64748b' }}>Schedule:</span>
                          <span style={{ color: '#38bdf8', fontWeight: 600 }}><code>{job.schedule}</code></span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: '#64748b' }}>Last Executed:</span>
                          <span style={{ color: '#cbd5e1' }}>{job.lastRunAt ? new Date(job.lastRunAt).toLocaleString() : 'Pending'}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: '#64748b' }}>Next Run:</span>
                          <span style={{ color: '#cbd5e1' }}>{job.nextRunAt ? new Date(job.nextRunAt).toLocaleString() : 'Automated interval'}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: '#64748b' }}>Items Last Processed:</span>
                          <span style={{ color: '#34d399', fontWeight: 600 }}>{(job.processedItemsCount ?? job.itemsProcessedLastRun ?? 0).toLocaleString()} items</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: '#64748b' }}>Execution Duration:</span>
                          <span style={{ color: '#e2e8f0' }}>{job.lastDurationMs ?? job.durationMs ?? 0} ms</span>
                        </div>
                      </div>
                    </div>

                    <div style={{ padding: '14px 20px', borderTop: '1px solid rgba(255,255,255,0.06)', background: 'rgba(15, 23, 42, 0.3)', display: 'flex', justifyContent: 'flex-end' }}>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => handleTriggerBackgroundJob(job.id)}
                        disabled={triggeringJobId === job.id}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                      >
                        <Play size={12} className={triggeringJobId === job.id ? 'animate-spin' : ''} />
                        {triggeringJobId === job.id ? 'Executing...' : 'Trigger Now'}
                      </button>
                    </div>
                  </div>
                ))}
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
              <label htmlFor="ann-title" className="form-label required">Announcement Headline</label>
              <input
                id="ann-title"
                name="annTitle"
                type="text"
                className="form-control"
                placeholder="e.g. Scheduled Infrastructure Maintenance Notice"
                value={annTitle}
                onChange={e => setAnnTitle(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label htmlFor="ann-message" className="form-label required">Broadcast Message Text</label>
              <textarea
                id="ann-message"
                name="annMessage"
                className="form-control"
                rows={3}
                placeholder="Database maintenance scheduled at 11:30 PM IST. Telephony routing will not be interrupted."
                value={annMessage}
                onChange={e => setAnnMessage(e.target.value)}
              />
            </div>

            <div className="form-grid-two">
              <div className="form-group">
                <label htmlFor="ann-priority" className="form-label">Banner Priority Level</label>
                <select
                  id="ann-priority"
                  name="annPriority"
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
                <label htmlFor="ann-audience" className="form-label">Target Audience</label>
                <select
                  id="ann-audience"
                  name="annAudience"
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

            {hasActiveGlobal && (!annTenantId || annTenantId === 'all') && (
              <div className="ann-modal-lock-warning">
                <AlertTriangle size={14} />
                <span>
                  <strong>Notice:</strong> &ldquo;{activeGlobalAnnouncement?.title}&rdquo; is currently active.
                  This broadcast will be created as <strong>inactive</strong>. Deactivate the current broadcast before activating this one.
                </span>
              </div>
            )}

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

      {/* ========================================================================= */}
      {/* SERVER LOG STACK TRACE MODAL */}
      {/* ========================================================================= */}
      {selectedLogForDrawer && (
        <Modal
          isOpen={!!selectedLogForDrawer}
          onClose={() => setSelectedLogForDrawer(null)}
          title={`Server Exception: ${selectedLogForDrawer.exceptionType || selectedLogForDrawer.source || 'Error Details'}`}
          size="lg"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', background: 'rgba(15, 23, 42, 0.6)', padding: '14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div>
                <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase' }}>Timestamp</span>
                <div style={{ fontSize: '13px', color: '#f1f5f9', fontWeight: 500 }}>
                  {new Date(selectedLogForDrawer.timestamp).toLocaleString()}
                </div>
              </div>
              <div>
                <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase' }}>HTTP Route</span>
                <div style={{ fontSize: '13px', color: '#38bdf8', fontWeight: 600 }}>
                  {selectedLogForDrawer.method} {selectedLogForDrawer.path || selectedLogForDrawer.requestPath || '/'}
                </div>
              </div>
              <div>
                <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase' }}>Client / Component</span>
                <div style={{ fontSize: '13px', color: '#f1f5f9' }}>
                  {selectedLogForDrawer.ipAddress || selectedLogForDrawer.source || 'internal'}
                </div>
              </div>
            </div>

            <div>
              <label className="form-label" style={{ color: '#fca5a5' }}>Error Message</label>
              <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '6px', padding: '12px', color: '#fca5a5', fontSize: '13px', fontFamily: 'monospace' }}>
                {selectedLogForDrawer.message}
              </div>
            </div>

            {selectedLogForDrawer.stackTrace && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label className="form-label" style={{ margin: 0 }}>Stack Trace</label>
                  <button
                    className="btn btn-ghost btn-sm"
                    style={{ fontSize: '11px', padding: '2px 8px' }}
                    onClick={() => {
                      navigator.clipboard.writeText(selectedLogForDrawer.stackTrace || '');
                      alert('Stack trace copied to clipboard.');
                    }}
                  >
                    Copy Trace
                  </button>
                </div>
                <pre style={{
                  background: '#090d16',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '6px',
                  padding: '14px',
                  color: '#94a3b8',
                  fontSize: '12px',
                  maxHeight: '320px',
                  overflowY: 'auto',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                }}>
                  {selectedLogForDrawer.stackTrace}
                </pre>
              </div>
            )}

            <div className="modal-actions-footer">
              <button className="btn btn-secondary" onClick={() => setSelectedLogForDrawer(null)}>
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
