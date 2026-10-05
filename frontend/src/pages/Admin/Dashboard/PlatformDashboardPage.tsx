import React, { useState, useEffect } from 'react';
import {
  Building2,
  Users,
  PhoneCall,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  FileCheck,
  Shield,
  Server,
  Radio,
  Plus,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { Tenant, User, AuditLog, PlatformMetrics, PlatformCarrierSettings, TenantDidMapping } from '../../../types';
import { superAdminService } from '../../../services/superAdminService';
import './PlatformDashboardPage.css';

interface PlatformDashboardPageProps {
  onNavigate: (route: string, extraState?: any) => void;
}

export const PlatformDashboardPage: React.FC<PlatformDashboardPageProps> = ({ onNavigate }) => {
  const { switchPersona } = useAuth();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [metrics, setMetrics] = useState<PlatformMetrics>(() => superAdminService.getPlatformMetrics());
  const [diagnostics, setDiagnostics] = useState(() => superAdminService.getSystemDiagnostics());
  const [carrierSettings, setCarrierSettings] = useState<PlatformCarrierSettings>(() => superAdminService.getCarrierSettings());
  const [dids, setDids] = useState<TenantDidMapping[]>(() => superAdminService.getDidMappings());

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [allTenants, allUsers, liveLogs, liveDiag, liveMetrics, liveCarrier, liveDids] = await Promise.all([
        superAdminService.fetchTenantsFromApi(),
        superAdminService.fetchUsersFromApi(),
        superAdminService.fetchAuditLogsFromApi(),
        superAdminService.fetchSystemDiagnosticsFromApi(),
        superAdminService.fetchPlatformMetricsFromApi(),
        superAdminService.fetchCarrierSettingsFromApi(),
        superAdminService.fetchDidMappingsFromApi(),
      ]);
      setTenants(allTenants);
      setUsers(allUsers);
      setAuditLogs(liveLogs);
      setDiagnostics(liveDiag);
      setCarrierSettings(liveCarrier);
      setDids(liveDids);
      if (liveMetrics) {
        setMetrics(liveMetrics);
      }
    } catch (err: any) {
      console.error('Failed to load platform dashboard data:', err);
      setLoadError(err?.message || 'Unable to connect to platform API server.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    window.addEventListener('nexus_admin_updated', loadData);
    return () => {
      window.removeEventListener('nexus_admin_updated', loadData);
    };
  }, []);

  // Scoped periodic polling for real-time SYSTEM CALLS TODAY telemetry
  useEffect(() => {
    let isMounted = true;
    const refreshCallMetrics = async () => {
      try {
        const liveCalls = await superAdminService.fetchCallsTodayMetricsFromApi();
        if (liveCalls && isMounted) {
          setMetrics(prev => ({
            ...prev,
            callsToday: liveCalls.callsToday,
            callsConnected: liveCalls.callsConnected,
          }));
        }
      } catch (err) {
        console.warn('Could not refresh real-time call telemetry:', err);
      }
    };

    const intervalId = setInterval(refreshCallMetrics, 10000);
    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, []);

  const formatCurrency = (val: number) => {
    const num = typeof val === 'number' && !isNaN(val) ? val : 0;
    if (num >= 10000000) {
      return `₹${(num / 10000000).toFixed(1)} Cr`;
    }
    if (num >= 100000) {
      return `₹${(num / 100000).toFixed(1)} L`;
    }
    return `₹${num.toLocaleString()}`;
  };

  const getTimeAgo = (dateStr: string) => {
    try {
      if (!dateStr) return 'Recently';
      const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
      if (isNaN(diff) || diff < 0) return 'Just now';
      if (diff < 60) return `${diff}s ago`;
      if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
      if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
      return `${Math.floor(diff / 86400)}d ago`;
    } catch {
      return dateStr || 'Recently';
    }
  };

  // Dynamic calculation for TOTAL LEADS MANAGED comparison vs last month
  const currentMonthLeads = metrics.currentMonthLeads ?? 0;
  const previousMonthLeads = metrics.previousMonthLeads ?? 0;

  let leadGrowthPercentage = 0;
  let isLeadGrowthPositive = true;

  if (previousMonthLeads > 0) {
    leadGrowthPercentage = ((currentMonthLeads - previousMonthLeads) / previousMonthLeads) * 100;
    isLeadGrowthPositive = leadGrowthPercentage >= 0;
  } else if (currentMonthLeads > 0) {
    leadGrowthPercentage = 100;
    isLeadGrowthPositive = true;
  } else {
    leadGrowthPercentage = 0;
    isLeadGrowthPositive = true;
  }

  const formattedLeadGrowth = `${leadGrowthPercentage > 0 ? '+' : ''}${leadGrowthPercentage.toFixed(1)}%`;

  const getTrunkHealthLabel = () => {
    if (!carrierSettings || !carrierSettings.primaryCarrier) {
      return 'Trunks Not Configured';
    }
    if (diagnostics.trunkStatus) {
      return `Trunk: ${diagnostics.trunkStatus}`;
    }
    if (carrierSettings.testStatus === 'Success' && carrierSettings.lastTestedAt) {
      return `Trunk: ${carrierSettings.status || 'Verified'}`;
    }
    if (carrierSettings.status) {
      return `Trunk: ${carrierSettings.status}`;
    }
    return 'Trunks Unmonitored';
  };

  const primaryTrunkHealth = carrierSettings.primaryTrunkHealth || (
    !carrierSettings.primaryCarrier ? 'offline' :
      carrierSettings.status === 'Inactive' ? 'offline' :
        carrierSettings.status === 'Degraded' || carrierSettings.testStatus === 'Degraded' ? 'degraded' :
          'online'
  );

  const failoverTrunkHealth = carrierSettings.failoverTrunkHealth || (
    !carrierSettings.secondaryCarrier ? 'offline' :
      !carrierSettings.emergencyRoutingEnabled ? 'degraded' :
        carrierSettings.status === 'Inactive' ? 'offline' :
          'online'
  );

  const speechToTextHealth = carrierSettings.speechToTextHealth || (
    !carrierSettings.whisperAiModel ? 'offline' : 'online'
  );

  const databasePoolHealth = diagnostics.databaseConnected !== false ? 'online' : 'offline';

  return (


    <div className="platform-dashboard-page">
      {loadError && (
        <div className="alert-banner error" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', marginBottom: '16px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#ef4444' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={18} />
            <span><strong>Live Fleet Data Warning:</strong> {loadError}</span>
          </div>
          <button className="btn btn-secondary btn-xs" onClick={loadData} style={{ borderColor: 'rgba(239, 68, 68, 0.4)', color: '#ef4444' }}>
            Retry Sync
          </button>
        </div>
      )}

      {/* Platform Header & Quick Action Bar */}
      <div className="platform-header-section">
        <div>
          <div className="platform-badge-container">
            <span className="platform-pill-badge">
              <span className="live-pulse-dot" /> {isLoading ? 'SYNCING LIVE TELEMETRY...' : 'PLATFORM OPERATOR CONSOLE'}
            </span>
            <span className="platform-version-tag">NexusSales Cloud v2.4</span>
          </div>
          <h1 className="platform-main-title">Global Fleet Telemetry & Management</h1>
          <p className="platform-main-subtitle">
            Cross-tenant orchestration, telephony SIP gateways, and real-time governance across enterprise organizations.
          </p>
        </div>

        <div className="platform-header-actions">
          <button
            className="btn btn-secondary btn-sm admin-header-btn"
            onClick={() => onNavigate('admin-call-config')}
          >
            <Radio size={14} className="icon-pulse" /> Telephony Gateway
          </button>
          <button
            className="btn btn-secondary btn-sm admin-header-btn"
            onClick={() => onNavigate('admin-users')}
          >
            <Users size={14} /> Directory
          </button>
          <button
            className="btn btn-primary btn-sm admin-primary-header-btn"
            onClick={() => onNavigate('admin-companies', { openWizard: true })}
          >
            <Plus size={14} /> Provision Organization
          </button>
        </div>
      </div>

      {/* Cross-Tenant Telemetry 6-Metric Cards */}
      <div className="platform-telemetry-grid">
        <div className="card platform-telemetry-card" onClick={() => onNavigate('admin-companies')}>
          <div className="telemetry-card-top">
            <span className="platform-telemetry-label">CLIENT ORGANIZATIONS</span>
            <div className="telemetry-icon-box bg-purple-glow">
              <Building2 size={18} color="#c084fc" />
            </div>
          </div>
          <div className="platform-telemetry-val">{metrics.totalTenants}</div>
          <div className="platform-telemetry-sub">
            <span className="status-badge-inline success">
              <CheckCircle2 size={12} /> {metrics.activeTenants} Active
            </span>
            {metrics.onboardingTenants > 0 && (
              <span className="status-badge-inline warning">
                {metrics.onboardingTenants} Onboarding
              </span>
            )}
          </div>
        </div>

        <div className="card platform-telemetry-card" onClick={() => onNavigate('admin-users')}>
          <div className="telemetry-card-top">
            <span className="platform-telemetry-label">REGISTERED USERS</span>
            <div className="telemetry-icon-box bg-blue-glow">
              <Users size={18} color="#38bdf8" />
            </div>
          </div>
          <div className="platform-telemetry-val">{metrics.totalUsers}</div>
          <div className="platform-telemetry-sub" style={{ flexWrap: 'wrap', gap: '4px' }}>
            <span className="status-badge-inline success">
              <CheckCircle2 size={12} /> {metrics.activeUsers} Active
            </span>
            <span className="text-muted-xs">
              {metrics.companyAdminCount ?? users.filter(u => u.role?.id === '2' || u.role?.code === 'company_admin').length} Admins • {metrics.salesExecutiveCount ?? users.filter(u => u.role?.id === '3' || u.role?.code === 'sales_executive').length} Sales • {metrics.irmCount ?? users.filter(u => u.role?.id === '4' || u.role?.code === 'irm').length} IRMs
            </span>
          </div>
        </div>

        <div className="card platform-telemetry-card">
          <div className="telemetry-card-top">
            <span className="platform-telemetry-label">TOTAL LEADS MANAGED</span>
            <div className="telemetry-icon-box bg-emerald-glow">
              <TrendingUp size={18} color="#34d399" />
            </div>
          </div>
          {loadError ? (
            <div className="platform-telemetry-val text-muted" style={{ fontSize: '1.1rem', color: '#ef4444' }}>
              Unavailable
            </div>
          ) : isLoading ? (
            <div className="platform-telemetry-val text-muted" style={{ fontSize: '1.25rem' }}>
              Loading...
            </div>
          ) : (
            <div className="platform-telemetry-val">{(metrics.totalLeads ?? 0).toLocaleString()}</div>
          )}
          <div className="platform-telemetry-sub">
            {loadError ? (
              <span className="text-muted-xs" style={{ color: '#ef4444' }}>Sync failed</span>
            ) : isLoading ? (
              <span className="text-muted-xs">Fetching telemetry...</span>
            ) : (
              <>
                <span className={isLeadGrowthPositive ? 'trend-stat-positive' : 'trend-stat-negative'}>
                  {isLeadGrowthPositive ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />} {formattedLeadGrowth}
                </span>
                <span className="text-muted-xs">vs last month</span>
              </>
            )}
          </div>
        </div>

        <div className="card platform-telemetry-card">
          <div className="telemetry-card-top">
            <span className="platform-telemetry-label">AGGREGATE PIPELINE</span>
            <div className="telemetry-icon-box bg-amber-glow">
              <Layers size={18} color="#fbbf24" />
            </div>
          </div>
          <div className="platform-telemetry-val text-amber">
            {formatCurrency(metrics.totalPipelineValue)}
          </div>
          <div className="platform-telemetry-sub">
            <span className="text-muted-xs">{metrics.totalCustomers} Converted Customers</span>
          </div>
        </div>

        <div className="card platform-telemetry-card" onClick={() => onNavigate('admin-call-config')}>
          <div className="telemetry-card-top">
            <span className="platform-telemetry-label">SYSTEM CALLS TODAY</span>
            <div className="telemetry-icon-box bg-violet-glow">
              <PhoneCall size={18} color="#a78bfa" />
            </div>
          </div>
          <div className="platform-telemetry-val text-violet">{metrics.callsToday}</div>
          <div className="platform-telemetry-sub">
            <span className="status-badge-inline success">
              {metrics.callsToday > 0 ? Math.round((metrics.callsConnected / metrics.callsToday) * 100) : 0}% Connected
            </span>
            <span className="text-muted-xs">{diagnostics.telephonyDropRate}% carrier drops</span>
          </div>
        </div>

        <div className="card platform-telemetry-card" onClick={() => onNavigate('admin-system')}>
          <div className="telemetry-card-top">
            <span className="platform-telemetry-label">FLEET HEALTH</span>
            <div className="telemetry-icon-box bg-green-glow">
              <Server size={18} color="#4ade80" />
            </div>
          </div>
          <div className="platform-telemetry-val text-green">{diagnostics.systemUptimePercentage}%</div>
          <div className="platform-telemetry-sub">
            <span className="status-badge-inline success">
              <Activity size={12} /> {Math.round(diagnostics.apiLatencyMs)}ms Latency
            </span>
            <span className="text-muted-xs">{getTrunkHealthLabel()}</span>
          </div>
        </div>
      </div>

      {/* Telephony Infrastructure Realtime Telemetry Bar */}
      <div className="card carrier-telemetry-bar">
        <div className="carrier-bar-col">
          <div className={`carrier-bar-indicator ${primaryTrunkHealth}`}>●</div>
          <div>
            <div className="carrier-bar-title">Primary SIP Trunk</div>
            <div className="carrier-bar-desc">{carrierSettings.primaryCarrier || 'Not Configured'}</div>
          </div>
        </div>
        <div className="carrier-bar-divider" />
        <div className="carrier-bar-col">
          <div className={`carrier-bar-indicator ${failoverTrunkHealth}`}>●</div>
          <div>
            <div className="carrier-bar-title">Failover Redundancy</div>
            <div className="carrier-bar-desc">{carrierSettings.secondaryCarrier || 'Not Configured'}</div>
          </div>
        </div>
        <div className="carrier-bar-divider" />
        <div className="carrier-bar-col">
          <div className={`carrier-bar-indicator ${speechToTextHealth}`}>●</div>
          <div>
            <div className="carrier-bar-title">Speech-to-Text AI</div>
            <div className="carrier-bar-desc">{carrierSettings.whisperAiModel || 'Not Configured'}</div>
          </div>
        </div>
        <div className="carrier-bar-divider" />
        <div className="carrier-bar-col">
          <div className={`carrier-bar-indicator ${databasePoolHealth}`}>●</div>
          <div>
            <div className="carrier-bar-title">Active Pool</div>
            <div className="carrier-bar-desc">
              {diagnostics.dbPoolActive} / {diagnostics.dbPoolMax} Connections ({Math.round(diagnostics.dbLatencyMs)}ms)
            </div>
          </div>
        </div>
      </div>

      {/* Main Two-Column Layout: Organizations Matrix & Security Feed */}
      <div className="platform-main-split">
        {/* Left Column: Tenant Organizations Telemetry Table */}
        <div className="card platform-matrix-card">
          <div className="platform-matrix-header">
            <div>
              <h3 className="platform-matrix-title">Tenant Organizations Directory</h3>
              <p className="platform-matrix-desc">
                Active enterprise customer tenants provisioned on the platform.
              </p>
            </div>
            <button
              className="btn btn-ghost btn-sm platform-matrix-manage-btn"
              onClick={() => onNavigate('admin-companies')}
            >
              All Organizations ({tenants.length}) &rarr;
            </button>
          </div>

          <div className="table-responsive">
            <table className="platform-matrix-table">
              <thead>
                <tr className="platform-matrix-thead-tr">
                  <th className="platform-matrix-th-name">Organization</th>
                  <th className="platform-matrix-th-tagline">Plan & Industry</th>
                  <th className="platform-matrix-th-center">Users</th>
                  <th className="platform-matrix-th-center">Hotline DID</th>
                  <th className="platform-matrix-th-center">Status</th>
                  <th className="platform-matrix-th-action">Support Action</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && tenants.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '36px', color: '#94a3b8' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                        <span className="live-pulse-dot" /> Loading fleet organizations...
                      </div>
                    </td>
                  </tr>
                ) : tenants.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '36px', color: '#94a3b8' }}>
                      No client organizations provisioned yet.
                    </td>
                  </tr>
                ) : (
                  tenants.map((t: Tenant) => {
                    const tenantUsersCount = users.filter(u => String(u.companyId) === String(t.id) || u.companyName === t.name).length;
                    const isSuspended = t.status === 'Suspended';
                    return (
                      <tr key={t.id} className="platform-matrix-tbody-tr">
                        <td className="platform-matrix-td-name">
                          <div className="tenant-name-row">
                            <span
                              className="tenant-avatar-badge"
                              style={{ backgroundColor: t.brandColor || '#8b5cf6' }}
                            >
                              {t.name.slice(0, 2).toUpperCase()}
                            </span>
                            <div>
                              <div className="platform-matrix-tenant-name">{t.name}</div>
                              <div className="platform-matrix-tenant-id">
                                Slug: <code>{t.slug}</code> • ID: {t.id}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="platform-matrix-td-tagline">
                          <div className="tenant-plan-title">
                            {t.subscriptionPlan || 'Enterprise Suite'}
                          </div>
                          <div className="tenant-industry-sub">{t.industry || 'Commercial Sales'}</div>
                        </td>

                        <td className="platform-matrix-td-center">
                          <span className="user-count-chip">
                            <Users size={12} /> {tenantUsersCount}
                          </span>
                        </td>

                        <td className="platform-matrix-td-center platform-matrix-did">
                          {(() => {
                            const mappedDid = dids.find(d => String(d.tenantId) === String(t.id) || d.tenantSlug === t.slug);
                            return <code>{mappedDid ? mappedDid.phoneNumber : 'Unassigned'}</code>;
                          })()}
                        </td>

                        <td className="platform-matrix-td-center">
                          <span className={`status-pill ${t.status?.toLowerCase() || 'active'}`}>
                            {t.status || 'Active'}
                          </span>
                        </td>

                        <td className="platform-matrix-td-action">
                          <div className="action-button-group">
                            <button
                              className="btn btn-secondary btn-xs action-btn-support"
                              title="Drill in to inspect tenant CRM in read-only support mode"
                              onClick={() => {
                                sessionStorage.setItem('nexus_support_mode_active', 'true');
                                sessionStorage.setItem('nexus_support_company_name', t.name);
                                switchPersona('company_admin', t.slug);
                              }}
                            >
                              <ExternalLink size={12} /> View as Company
                            </button>
                            <button
                              className="btn btn-ghost btn-xs action-btn-manage"
                              onClick={() => onNavigate('admin-companies', { selectedTenantId: t.id })}
                            >
                              Manage
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  }))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column: Platform Security Audit Feed & Quick Tools */}
        <div className="platform-side-stack">
          {/* Audit Stream Card */}
          <div className="card platform-audit-card">
            <div className="platform-audit-header">
              <div>
                <h3 className="platform-audit-title">Security & Audit Stream</h3>
                <p className="platform-audit-sub">Immutable cross-organization log</p>
              </div>
              <button
                className="btn btn-ghost btn-xs text-purple"
                onClick={() => onNavigate('admin-audit')}
              >
                Full Ledger &rarr;
              </button>
            </div>

            <div className="platform-audit-list">
              {isLoading && auditLogs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px', color: '#94a3b8', fontSize: '13px' }}>
                  Loading security audit stream...
                </div>
              ) : auditLogs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px', color: '#94a3b8', fontSize: '13px' }}>
                  No security audit events recorded yet.
                </div>
              ) : (
                auditLogs.slice(0, 5).map((l: AuditLog) => (
                  <div key={l.id} className="platform-audit-item">
                    <div className="audit-icon-col">
                      <div className="audit-dot" />
                    </div>
                    <div className="audit-content-col">
                      <div className="platform-audit-item-header">
                        <span className="platform-audit-company-badge">
                          {l.companyName || 'GLOBAL PLATFORM'}
                        </span>
                        <span className="platform-audit-action">{l.action}</span>
                      </div>
                      <div className="platform-audit-details">{l.details}</div>
                      <div className="platform-audit-meta">
                        <span>By: {l.actorName}</span>
                        <span>•</span>
                        <span>{getTimeAgo(l.timestamp)}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Quick System Tools Card */}
          <div className="card platform-quick-tools-card">
            <h4 className="quick-tools-title">Platform Operator Utilities</h4>
            <div className="quick-tools-grid">
              <button
                className="quick-tool-btn"
                onClick={() => onNavigate('admin-roles')}
              >
                <Shield size={16} color="#c084fc" />
                <span>RBAC Matrix</span>
              </button>
              <button
                className="quick-tool-btn"
                onClick={() => onNavigate('admin-features')}
              >
                <Sparkles size={16} color="#38bdf8" />
                <span>Tier Packages</span>
              </button>
              <button
                className="quick-tool-btn"
                onClick={() => onNavigate('admin-call-config')}
              >
                <Radio size={16} color="#34d399" />
                <span>DID Allocation</span>
              </button>
              <button
                className="quick-tool-btn"
                onClick={() => onNavigate('admin-system')}
              >
                <Server size={16} color="#fbbf24" />
                <span>Maintenance & Config</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
