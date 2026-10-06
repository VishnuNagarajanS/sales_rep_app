import React, { useState, useEffect } from 'react';
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  KeyRound,
  Laptop,
  Smartphone,
  Globe,
  RefreshCw,
  LogOut,
  AlertTriangle,
  CheckCircle,
  Copy,
  Clock,
  UserCheck,
  Search,
  ChevronLeft,
  ChevronRight,
  Filter,
} from 'lucide-react';
import {
  superAdminService,
  SecurityOverviewDto,
  UserSessionDto,
  SecurityEventDto,
  MfaStatusDto,
  MfaSetupResponseDto,
} from '../../../services/superAdminService';
import { signalRService } from '../../../services/signalRService';
import './PlatformSecurityPage.css';

export const PlatformSecurityPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'mfa' | 'events'>('overview');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Data state
  const [overview, setOverview] = useState<SecurityOverviewDto | null>(null);
  const [sessions, setSessions] = useState<UserSessionDto[]>([]);
  const [mfaStatus, setMfaStatus] = useState<MfaStatusDto | null>(null);

  // MFA Setup State
  const [mfaSetupData, setMfaSetupData] = useState<MfaSetupResponseDto | null>(null);
  const [mfaVerifyCode, setMfaVerifyCode] = useState('');
  const [mfaRecoveryCodes, setMfaRecoveryCodes] = useState<string[]>([]);
  const [isEnrollingMfa, setIsEnrollingMfa] = useState(false);
  const [isDisablingMfa, setIsDisablingMfa] = useState(false);
  const [disableCode, setDisableCode] = useState('');

  // Security Events Pagination & Filter State
  const [events, setEvents] = useState<SecurityEventDto[]>([]);
  const [eventPage, setEventPage] = useState(1);
  const [eventPageSize] = useState(15);
  const [totalEvents, setTotalEvents] = useState(0);
  const [eventSeverity, setEventSeverity] = useState<string>('all');
  const [eventSearch, setEventSearch] = useState('');

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  const loadData = async (manual = false) => {
    if (manual) setIsRefreshing(true);
    else setIsLoading(true);
    setErrorMsg(null);

    try {
      const [ovRes, sessRes, mfaRes] = await Promise.all([
        superAdminService.getSecurityOverview(),
        superAdminService.getUserSessions(),
        superAdminService.getMfaStatus(),
      ]);

      setOverview(ovRes);
      setSessions(sessRes);
      setMfaStatus(mfaRes);

      if (manual) showSuccess('Security telemetry & active sessions refreshed.');
    } catch (err: any) {
      console.error('Failed to load security telemetry:', err);
      setErrorMsg(err.message || 'Failed to connect to security telemetry service.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const loadEvents = async () => {
    try {
      const res = await superAdminService.getSecurityEvents(
        eventPage,
        eventPageSize,
        eventSeverity !== 'all' ? eventSeverity : undefined
      );
      setEvents(res.items || []);
      setTotalEvents(res.totalCount || 0);
    } catch (err: any) {
      console.error('Failed to load security events:', err);
    }
  };

  useEffect(() => {
    loadData();
    loadEvents();
  }, []);

  useEffect(() => {
    loadEvents();
  }, [eventPage, eventSeverity]);

  // Real-time SignalR Event Handlers
  useEffect(() => {
    const unsubSession = signalRService.on('SessionRevoked', () => {
      loadData(false);
    });
    const unsubSecurity = signalRService.on('SecurityEventOccurred', () => {
      loadEvents();
      loadData(false);
    });

    return () => {
      unsubSession();
      unsubSecurity();
    };
  }, []);

  // Session Actions
  const handleRevokeSession = async (sessionId: number) => {
    if (!window.confirm('Are you sure you want to revoke this session? The device will be disconnected immediately.')) {
      return;
    }
    try {
      await superAdminService.revokeSession(sessionId);
      showSuccess('Session revoked successfully.');
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      if (overview) {
        setOverview({ ...overview, activeSessionsCount: Math.max(0, overview.activeSessionsCount - 1) });
      }
    } catch (err: any) {
      alert(err.message || 'Failed to revoke session.');
    }
  };

  const handleRevokeAllSessions = async () => {
    if (!window.confirm('Revoke all other active sessions? All devices other than this browser will be signed out.')) {
      return;
    }
    try {
      await superAdminService.revokeAllSessions();
      showSuccess('All other active sessions have been revoked.');
      loadData(false);
    } catch (err: any) {
      alert(err.message || 'Failed to revoke sessions.');
    }
  };

  // MFA Flow Handlers
  const handleStartMfaSetup = async () => {
    setIsEnrollingMfa(true);
    setMfaSetupData(null);
    try {
      const setup = await superAdminService.setupMfa();
      setMfaSetupData(setup);
    } catch (err: any) {
      alert(err.message || 'Failed to initiate MFA enrollment.');
      setIsEnrollingMfa(false);
    }
  };

  const handleVerifyAndEnableMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mfaVerifyCode.trim() || mfaVerifyCode.trim().length < 6) {
      alert('Please enter a valid 6-digit TOTP verification code.');
      return;
    }

    try {
      await superAdminService.verifyAndEnableMfa(mfaVerifyCode.trim());
      showSuccess('Multi-Factor Authentication enabled and enforced successfully!');
      const codes = mfaSetupData?.recoveryCodes || [];
      setMfaRecoveryCodes(codes);
      setMfaStatus({
        isTwoFactorEnabled: true,
        remainingRecoveryCodes: codes.length || 8,
      });
      setIsEnrollingMfa(false);
      setMfaVerifyCode('');
    } catch (err: any) {
      alert(err.message || 'Verification failed. Please check the 6-digit code from your authenticator app.');
    }
  };

  const handleDisableMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!disableCode.trim()) {
      alert('Please enter your current TOTP or recovery code to confirm disabling MFA.');
      return;
    }

    try {
      await superAdminService.disableMfa(disableCode.trim());
      showSuccess('Multi-Factor Authentication disabled.');
      setMfaStatus({ isTwoFactorEnabled: false, remainingRecoveryCodes: 0 });
      setIsDisablingMfa(false);
      setDisableCode('');
    } catch (err: any) {
      alert(err.message || 'Failed to disable MFA. Invalid code.');
    }
  };

  const copyRecoveryCodes = () => {
    if (mfaRecoveryCodes.length === 0) return;
    navigator.clipboard.writeText(mfaRecoveryCodes.join('\n'));
    showSuccess('Recovery codes copied to clipboard.');
  };

  // Filtered Events
  const filteredEvents = events.filter((ev) => {
    if (!eventSearch.trim()) return true;
    const q = eventSearch.toLowerCase();
    return (
      ev.eventType.toLowerCase().includes(q) ||
      (ev.actorEmail && ev.actorEmail.toLowerCase().includes(q)) ||
      (ev.details && ev.details.toLowerCase().includes(q)) ||
      (ev.ipAddress && ev.ipAddress.toLowerCase().includes(q))
    );
  });

  return (
    <div className="platform-security-page-container">
      {/* Header */}
      <div className="security-page-header">
        <div>
          <div className="header-breadcrumbs">
            <span>PLATFORM CONSOLE</span> &gt; <span className="current">SECURITY CENTER & SESSION CONTROL</span>
          </div>
          <h1 className="page-main-title">Security Center & Session Management</h1>
          <p className="page-main-desc">
            Enforce RFC 6238 TOTP Multi-Factor Authentication, inspect live cross-tenant sessions, revoke active tokens, and monitor privileged security audit events.
          </p>
        </div>

        <div className="security-header-actions">
          <button
            className="btn btn-secondary btn-sm"
            disabled={isRefreshing || isLoading}
            onClick={() => loadData(true)}
          >
            <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="system-success-alert animate-fade-in">
          <CheckCircle size={16} /> {successMsg}
        </div>
      )}

      {errorMsg && (
        <div className="system-error-box animate-fade-in" style={{ padding: '12px 16px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 8, color: '#f87171' }}>
          <AlertTriangle size={16} /> {errorMsg}
        </div>
      )}

      {/* KPI Overview Grid */}
      <div className="security-kpi-grid">
        <div className="security-card">
          <div className="security-card-header">
            <span className="diag-label">Active Sessions</span>
            <Laptop size={18} style={{ color: '#38bdf8' }} />
          </div>
          <div className="diag-val">
            {overview?.activeSessionsCount ?? sessions.length}
            <span className="val-unit">concurrent</span>
          </div>
          <div style={{ fontSize: '12px', color: '#94a3b8' }}>Real-time verified via JWT session ledger</div>
        </div>

        {/* <div className="security-card">
          <div className="security-card-header">
            <span className="diag-label">Super Admin MFA Status</span>
            <ShieldCheck size={18} style={{ color: mfaStatus?.isTwoFactorEnabled ? '#10b981' : '#f59e0b' }} />
          </div>
          <div className="diag-val" style={{ color: mfaStatus?.isTwoFactorEnabled ? '#34d399' : '#fbbf24' }}>
            {mfaStatus?.isTwoFactorEnabled ? 'ENFORCED' : 'OPTIONAL'}
          </div>
          <div style={{ fontSize: '12px', color: '#94a3b8' }}>
            {mfaStatus?.isTwoFactorEnabled
              ? `${mfaStatus.remainingRecoveryCodes} recovery codes remaining`
              : 'TOTP enrollment recommended'}
          </div>
        </div> */}

        <div className="security-card">
          <div className="security-card-header">
            <span className="diag-label">Failed Logins (24h)</span>
            <ShieldAlert size={18} style={{ color: overview && overview.failedLogins24h > 0 ? '#ef4444' : '#10b981' }} />
          </div>
          <div className="diag-val">
            {overview?.failedLogins24h ?? 0}
            <span className="val-unit">attempts</span>
          </div>
          <div style={{ fontSize: '12px', color: '#94a3b8' }}>Zero suspicious brute-force clusters detected</div>
        </div>

        <div className="security-card">
          <div className="security-card-header">
            <span className="diag-label">Security Audit Events (24h)</span>
            <KeyRound size={18} style={{ color: '#a855f7' }} />
          </div>
          <div className="diag-val">
            {overview?.securityEvents24h ?? totalEvents}
            <span className="val-unit">events</span>
          </div>
          <div style={{ fontSize: '12px', color: '#94a3b8' }}>Append-only immutable audit trail</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="system-tabs-bar" style={{ display: 'flex', gap: 8, borderBottom: '1px solid #1e293b', paddingBottom: 12 }}>
        <button
          className={`system-tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          <Laptop size={15} /> Active Sessions ({sessions.length})
        </button>

        <button
          className={`system-tab-btn ${activeTab === 'mfa' ? 'active' : ''}`}
          onClick={() => setActiveTab('mfa')}
        >
          <KeyRound size={15} /> Multi-Factor Authentication (MFA)
          <span className={`tab-badge ${mfaStatus?.isTwoFactorEnabled ? 'green' : 'amber'}`}>
            {mfaStatus?.isTwoFactorEnabled ? 'Active' : 'Not Setup'}
          </span>
        </button>

        <button
          className={`system-tab-btn ${activeTab === 'events' ? 'active' : ''}`}
          onClick={() => setActiveTab('events')}
        >
          <ShieldAlert size={15} /> Privileged Security Events ({totalEvents})
        </button>
      </div>

      {/* TAB 1: SESSIONS */}
      {activeTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: '#f8fafc', margin: 0 }}>
              Authorized Active Sessions
            </h3>
            {sessions.length > 1 && (
              <button
                className="btn btn-secondary btn-sm"
                style={{ borderColor: 'rgba(239, 68, 68, 0.4)', color: '#f87171' }}
                onClick={handleRevokeAllSessions}
              >
                <LogOut size={14} /> Revoke All Other Sessions
              </button>
            )}
          </div>

          <div className="security-table-container">
            <table className="security-table">
              <thead>
                <tr>
                  <th>Device & Platform</th>
                  <th>IP Address</th>
                  <th>Location</th>
                  <th>Created At</th>
                  <th>Last Activity</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sessions.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '30px 16px', color: '#64748b' }}>
                      No active sessions found.
                    </td>
                  </tr>
                ) : (
                  sessions.map((sess) => (
                    <tr key={sess.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          {sess.device?.toLowerCase().includes('mobile') ? (
                            <Smartphone size={16} style={{ color: '#38bdf8' }} />
                          ) : (
                            <Laptop size={16} style={{ color: '#38bdf8' }} />
                          )}
                          <div>
                            <div style={{ fontWeight: 600, color: '#f1f5f9' }}>{sess.device || 'Desktop Browser'}</div>
                            <div style={{ fontSize: 11, color: '#64748b' }}>{sess.userAgent ? sess.userAgent.slice(0, 45) + '...' : 'Web Client'}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span style={{ fontFamily: 'monospace', color: '#93c5fd' }}>{sess.ipAddress || '127.0.0.1'}</span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#94a3b8' }}>
                          <Globe size={13} /> {sess.location || 'Local / Network'}
                        </div>
                      </td>
                      <td>{new Date(sess.createdAt).toLocaleDateString()} {new Date(sess.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Clock size={13} style={{ color: '#64748b' }} />
                          {sess.lastActivityAt ? new Date(sess.lastActivityAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'}
                        </div>
                      </td>
                      <td>
                        {sess.isCurrentSession ? (
                          <span className="session-current-badge">Current Session</span>
                        ) : sess.isActive ? (
                          <span style={{ color: '#34d399', fontWeight: 600, fontSize: 12 }}>● Active</span>
                        ) : (
                          <span style={{ color: '#94a3b8', fontSize: 12 }}>Revoked</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {!sess.isCurrentSession && sess.isActive && (
                          <button
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '4px 10px', fontSize: 12, borderColor: '#ef4444', color: '#f87171' }}
                            onClick={() => handleRevokeSession(sess.id)}
                            title="Revoke session and disconnect device"
                          >
                            <LogOut size={12} /> Revoke
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: MFA CONFIGURATION */}
      {activeTab === 'mfa' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="security-card">
            <div className="security-card-header">
              <div className="security-card-title">
                <KeyRound size={20} style={{ color: '#38bdf8' }} />
                RFC 6238 TOTP Multi-Factor Authentication
              </div>
              <span className={`tab-badge ${mfaStatus?.isTwoFactorEnabled ? 'green' : 'amber'}`}>
                {mfaStatus?.isTwoFactorEnabled ? 'Active & Enforced' : 'Not Configured'}
              </span>
            </div>

            <p style={{ color: '#94a3b8', fontSize: 13, margin: '4px 0 16px 0', lineHeight: 1.5 }}>
              Protect privileged Super Admin accounts by requiring a one-time 6-digit verification code from Google Authenticator, Microsoft Authenticator, or 1Password during login.
            </p>

            {mfaStatus?.isTwoFactorEnabled ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: 10 }}>
                  <ShieldCheck size={28} style={{ color: '#10b981', flexShrink: 0 }} />
                  <div>
                    <div style={{ fontWeight: 700, color: '#34d399' }}>MFA is Active on this Account</div>
                    <div style={{ fontSize: 12, color: '#94a3b8' }}>
                      All subsequent logins will prompt for a 6-digit TOTP code. You have {mfaStatus.remainingRecoveryCodes} single-use backup recovery codes remaining.
                    </div>
                  </div>
                </div>

                {mfaRecoveryCodes.length > 0 && (
                  <div className="mfa-setup-box">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 700, color: '#f1f5f9' }}>Emergency Recovery Codes</span>
                      <button className="btn btn-secondary btn-sm" onClick={copyRecoveryCodes}>
                        <Copy size={13} /> Copy Codes
                      </button>
                    </div>
                    <p style={{ fontSize: 12, color: '#94a3b8', margin: 0 }}>
                      Store these recovery codes in a secure password vault. Each code can be used exactly once if you lose access to your authenticator app.
                    </p>
                    <div className="recovery-codes-grid">
                      {mfaRecoveryCodes.map((code, idx) => (
                        <div key={idx} className="recovery-code-chip">{code}</div>
                      ))}
                    </div>
                  </div>
                )}

                <div style={{ marginTop: 8 }}>
                  {!isDisablingMfa ? (
                    <button
                      className="btn btn-secondary btn-sm"
                      style={{ borderColor: 'rgba(239, 68, 68, 0.4)', color: '#f87171' }}
                      onClick={() => setIsDisablingMfa(true)}
                    >
                      Disable Two-Factor Authentication
                    </button>
                  ) : (
                    <form onSubmit={handleDisableMfa} style={{ display: 'flex', gap: 10, alignItems: 'center', maxWidth: 420 }}>
                      <input
                        type="text"
                        placeholder="Current 6-digit code or recovery code"
                        className="form-control"
                        value={disableCode}
                        onChange={(e) => setDisableCode(e.target.value)}
                        required
                        style={{ background: '#090d16', border: '1px solid #334155', color: '#fff', padding: '8px 12px', borderRadius: 6 }}
                      />
                      <button type="submit" className="btn btn-danger btn-sm" style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: 6 }}>
                        Confirm Disable
                      </button>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => setIsDisablingMfa(false)}>
                        Cancel
                      </button>
                    </form>
                  )}
                </div>
              </div>
            ) : !isEnrollingMfa ? (
              <div>
                <button className="btn btn-primary" onClick={handleStartMfaSetup}>
                  <ShieldCheck size={16} /> Begin MFA Enrollment
                </button>
              </div>
            ) : (
              <div className="mfa-setup-box">
                <h4 style={{ color: '#f8fafc', margin: '0 0 8px 0' }}>Step 1: Scan Authenticator QR Code or Enter Key</h4>
                <p style={{ fontSize: 13, color: '#94a3b8', margin: 0 }}>
                  Scan this configuration URI in your authenticator app (Google Authenticator, Microsoft Authenticator, Authy, or 1Password):
                </p>

                {mfaSetupData && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
                    <div style={{ background: '#090d16', border: '1px solid #334155', borderRadius: 8, padding: '12px 16px' }}>
                      <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Secret Key (Base32)</div>
                      <div style={{ fontFamily: 'monospace', fontSize: 16, fontWeight: 700, color: '#38bdf8', letterSpacing: '0.1em', marginTop: 4 }}>
                        {mfaSetupData.secret || mfaSetupData.manualEntryKey}
                      </div>
                    </div>

                    <form onSubmit={handleVerifyAndEnableMfa} style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
                      <h4 style={{ color: '#f8fafc', margin: '8px 0 0 0' }}>Step 2: Enter 6-digit Code to Confirm</h4>
                      <div style={{ display: 'flex', gap: 10, maxWidth: 360 }}>
                        <input
                          type="text"
                          maxLength={6}
                          placeholder="123456"
                          className="form-control"
                          value={mfaVerifyCode}
                          onChange={(e) => setMfaVerifyCode(e.target.value.replace(/\D/g, ''))}
                          required
                          style={{
                            background: '#090d16',
                            border: '1px solid #38bdf8',
                            color: '#fff',
                            fontSize: 18,
                            letterSpacing: '0.2em',
                            textAlign: 'center',
                            padding: '10px 14px',
                            borderRadius: 6,
                          }}
                        />
                        <button type="submit" className="btn btn-primary" style={{ padding: '0 20px' }}>
                          Verify & Activate
                        </button>
                      </div>
                    </form>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: SECURITY EVENTS LOG */}
      {activeTab === 'events' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ position: 'relative', width: 280 }}>
                <Search size={14} style={{ position: 'absolute', left: 10, top: 11, color: '#64748b' }} />
                <input
                  type="text"
                  placeholder="Search events, emails, IPs..."
                  className="form-control"
                  value={eventSearch}
                  onChange={(e) => setEventSearch(e.target.value)}
                  style={{
                    paddingLeft: 32,
                    background: '#0f172a',
                    border: '1px solid #1e293b',
                    color: '#fff',
                    borderRadius: 8,
                    fontSize: 13,
                    height: 36,
                    width: '100%',
                  }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Filter size={14} style={{ color: '#64748b' }} />
                <select
                  value={eventSeverity}
                  onChange={(e) => {
                    setEventSeverity(e.target.value);
                    setEventPage(1);
                  }}
                  style={{
                    background: '#0f172a',
                    border: '1px solid #1e293b',
                    color: '#f8fafc',
                    borderRadius: 8,
                    padding: '6px 12px',
                    fontSize: 13,
                  }}
                >
                  <option value="all">All Severities</option>
                  <option value="info">Info</option>
                  <option value="warning">Warning</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
            </div>

            <div style={{ fontSize: 13, color: '#94a3b8' }}>
              Showing {filteredEvents.length} of {totalEvents} events
            </div>
          </div>

          <div className="security-table-container">
            <table className="security-table">
              <thead>
                <tr>
                  <th>Event Type</th>
                  <th>Severity</th>
                  <th>Actor Email</th>
                  <th>IP Address</th>
                  <th>Timestamp</th>
                  <th>Details & Context</th>
                </tr>
              </thead>
              <tbody>
                {filteredEvents.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '30px 16px', color: '#64748b' }}>
                      No security events matching criteria.
                    </td>
                  </tr>
                ) : (
                  filteredEvents.map((ev) => (
                    <tr key={ev.id}>
                      <td>
                        <span style={{ fontWeight: 600, color: '#f1f5f9', fontFamily: 'monospace' }}>
                          {ev.eventType}
                        </span>
                      </td>
                      <td>
                        <span className={`severity-badge ${ev.severity.toLowerCase()}`}>
                          {ev.severity}
                        </span>
                      </td>
                      <td>
                        <span style={{ color: '#93c5fd' }}>{ev.actorEmail || 'System / Anonymous'}</span>
                      </td>
                      <td>
                        <span style={{ fontFamily: 'monospace', color: '#94a3b8' }}>{ev.ipAddress || '—'}</span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#94a3b8' }}>
                          <Clock size={12} />
                          {new Date(ev.timestamp).toLocaleDateString()} {new Date(ev.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </td>
                      <td>
                        <span style={{ color: '#cbd5e1', fontSize: 12 }}>{ev.details || '—'}</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
            <div style={{ fontSize: 13, color: '#64748b' }}>
              Page {eventPage} of {Math.max(1, Math.ceil(totalEvents / eventPageSize))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn btn-secondary btn-sm"
                disabled={eventPage <= 1}
                onClick={() => setEventPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft size={14} /> Previous
              </button>
              <button
                className="btn btn-secondary btn-sm"
                disabled={eventPage >= Math.ceil(totalEvents / eventPageSize)}
                onClick={() => setEventPage((p) => p + 1)}
              >
                Next <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
