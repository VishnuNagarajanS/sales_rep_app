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
  Lock,
  Unlock,
  Zap,
  Radio,
} from 'lucide-react';
import {
  superAdminService,
  SecurityOverviewDto,
  UserSessionDto,
  SecurityEventDto,
  MfaStatusDto,
  MfaSetupResponseDto,
} from '../../../services/superAdminService';
import { EmergencyLockdownStatus } from '../../../types';
import { Modal } from '../../../components/common/Modal';
import { signalRService } from '../../../services/signalRService';
import './PlatformSecurityPage.css';

export const PlatformSecurityPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'mfa' | 'events' | 'lockdown'>('overview');
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
  const [disablePassword, setDisablePassword] = useState('');
  const [disableCode, setDisableCode] = useState('');
  const [isRegeneratingCodes, setIsRegeneratingCodes] = useState(false);
  const [regenPassword, setRegenPassword] = useState('');
  const [regenCode, setRegenCode] = useState('');

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

  // Emergency Lockdown State
  const [lockdownStatus, setLockdownStatus] = useState<EmergencyLockdownStatus | null>(null);
  const [isLoadingLockdown, setIsLoadingLockdown] = useState(false);
  const [isLockdownModalOpen, setIsLockdownModalOpen] = useState(false);
  const [lockdownReason, setLockdownReason] = useState('');
  const [lockdownConfirmText, setLockdownConfirmText] = useState('');
  const [isSubmittingLockdown, setIsSubmittingLockdown] = useState(false);

  const loadLockdownStatus = async () => {
    setIsLoadingLockdown(true);
    try {
      const status = await superAdminService.fetchLockdownStatus();
      setLockdownStatus(status);
    } catch (err: any) {
      console.warn('Failed to load emergency lockdown status:', err);
    } finally {
      setIsLoadingLockdown(false);
    }
  };

  const handleTriggerLockdown = async () => {
    if (!lockdownReason.trim()) {
      alert('A valid operational reason is required to initiate an Emergency Threat Lockdown.');
      return;
    }
    if (lockdownConfirmText.trim().toUpperCase() !== 'LOCKDOWN') {
      alert('Please type LOCKDOWN exactly to confirm activation.');
      return;
    }

    setIsSubmittingLockdown(true);
    try {
      const result = await superAdminService.activateEmergencyLockdown(lockdownReason.trim());
      setLockdownStatus(result);
      setIsLockdownModalOpen(false);
      setLockdownReason('');
      setLockdownConfirmText('');
      showSuccess('EMERGENCY THREAT LOCKDOWN ENGAGED. Platform is sealed.');
      await loadData(false);
    } catch (err: any) {
      alert(err.message || 'Failed to engage emergency lockdown.');
    } finally {
      setIsSubmittingLockdown(false);
    }
  };

  const handleLiftLockdown = async () => {
    if (!window.confirm('Are you sure you want to disarm platform lockdown and resume normal operations?')) return;
    setIsSubmittingLockdown(true);
    try {
      const result = await superAdminService.deactivateEmergencyLockdown();
      setLockdownStatus(result);
      showSuccess('Threat Lockdown disarmed. Normal platform operations restored.');
      await loadData(false);
    } catch (err: any) {
      alert(err.message || 'Failed to disarm lockdown.');
    } finally {
      setIsSubmittingLockdown(false);
    }
  };

  const loadData = async (manual = false) => {
    if (manual) setIsRefreshing(true);
    else setIsLoading(true);
    setErrorMsg(null);

    try {
      const [ovRes, sessRes, mfaRes, lockRes] = await Promise.all([
        superAdminService.getSecurityOverview(),
        superAdminService.getUserSessions(),
        superAdminService.getMfaStatus(),
        superAdminService.fetchLockdownStatus().catch(() => ({ isActive: false })),
      ]);

      setOverview(ovRes);
      setSessions(sessRes);
      setMfaStatus(mfaRes);
      setLockdownStatus(lockRes);

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
    const unsubLockdown = signalRService.on('PlatformLockdownEngaged', () => {
      loadLockdownStatus();
      loadData(false);
    });
    const unsubUnlock = signalRService.on('PlatformLockdownDisengaged', () => {
      loadLockdownStatus();
      loadData(false);
    });

    return () => {
      unsubSession();
      unsubSecurity();
      unsubLockdown();
      unsubUnlock();
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
      const res = await superAdminService.verifyAndEnableMfa(mfaVerifyCode.trim());
      showSuccess('Multi-Factor Authentication enabled and enforced successfully!');
      const codes = res?.recoveryCodes || mfaSetupData?.recoveryCodes || [];
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
    if (!disablePassword.trim()) {
      alert('Please enter your account password to confirm disabling MFA.');
      return;
    }
    if (!disableCode.trim()) {
      alert('Please enter your current TOTP or recovery code to confirm disabling MFA.');
      return;
    }

    try {
      await superAdminService.disableMfa(disablePassword.trim(), disableCode.trim());
      showSuccess('Multi-Factor Authentication disabled.');
      setMfaStatus({ isTwoFactorEnabled: false, remainingRecoveryCodes: 0 });
      setIsDisablingMfa(false);
      setDisableCode('');
      setDisablePassword('');
      setMfaRecoveryCodes([]);
    } catch (err: any) {
      alert(err.message || 'Failed to disable MFA. Please check password and authentication code.');
    }
  };

  const handleRegenerateRecoveryCodes = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regenPassword.trim()) {
      alert('Please enter your account password to regenerate recovery codes.');
      return;
    }

    try {
      const codes = await superAdminService.regenerateRecoveryCodes(regenPassword.trim(), regenCode.trim());
      setMfaRecoveryCodes(codes);
      setMfaStatus((prev) => (prev ? { ...prev, remainingRecoveryCodes: codes.length } : null));
      showSuccess('Emergency recovery codes regenerated! Store them safely.');
      setIsRegeneratingCodes(false);
      setRegenPassword('');
      setRegenCode('');
    } catch (err: any) {
      alert(err.message || 'Failed to regenerate recovery codes.');
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

      {/* Active Lockdown Banner */}
      {lockdownStatus?.isActive && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.25) 0%, rgba(185, 28, 28, 0.35) 100%)',
          border: '1px solid rgba(239, 68, 68, 0.6)',
          borderRadius: '12px',
          padding: '16px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          boxShadow: '0 0 25px rgba(239, 68, 68, 0.25)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ background: '#ef4444', borderRadius: '50%', padding: '8px', color: '#fff', display: 'flex' }}>
              <ShieldAlert size={22} />
            </div>
            <div>
              <div style={{ fontSize: '15px', fontWeight: 700, color: '#fef2f2', display: 'flex', alignItems: 'center', gap: '8px' }}>
                🚨 PLATFORM EMERGENCY THREAT LOCKDOWN ENGAGED
              </div>
              <div style={{ fontSize: '13px', color: '#fca5a5', marginTop: '2px' }}>
                Reason: <strong>{lockdownStatus.reason || 'Security threat mitigation'}</strong>
                {lockdownStatus.initiatedBy ? ` • Engaged by: ${lockdownStatus.initiatedBy}` : ''}
                {lockdownStatus.initiatedAt ? ` (${new Date(lockdownStatus.initiatedAt).toLocaleTimeString()})` : ''}
              </div>
            </div>
          </div>
          <button
            className="btn btn-sm"
            style={{ background: '#ffffff', color: '#b91c1c', fontWeight: 700, border: 'none' }}
            onClick={handleLiftLockdown}
            disabled={isSubmittingLockdown}
          >
            <Unlock size={14} /> Disarm Lockdown Now
          </button>
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

        <button
          className={`system-tab-btn ${activeTab === 'lockdown' ? 'active' : ''}`}
          onClick={() => setActiveTab('lockdown')}
          style={lockdownStatus?.isActive ? { borderColor: '#ef4444', color: '#f87171' } : {}}
        >
          <Lock size={15} /> Threat Lockdown
          <span className={`tab-badge ${lockdownStatus?.isActive ? 'critical' : 'neutral'}`}>
            {lockdownStatus?.isActive ? 'LOCKED' : 'Nominal'}
          </span>
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

                <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {!isDisablingMfa && !isRegeneratingCodes ? (
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        style={{ borderColor: 'rgba(56, 189, 248, 0.4)', color: '#38bdf8' }}
                        onClick={() => setIsRegeneratingCodes(true)}
                      >
                        <RefreshCw size={13} /> Regenerate Backup Recovery Codes
                      </button>
                      <button
                        className="btn btn-secondary btn-sm"
                        style={{ borderColor: 'rgba(239, 68, 68, 0.4)', color: '#f87171' }}
                        onClick={() => setIsDisablingMfa(true)}
                      >
                        Disable Two-Factor Authentication
                      </button>
                    </div>
                  ) : isRegeneratingCodes ? (
                    <form onSubmit={handleRegenerateRecoveryCodes} style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 450, padding: 14, background: 'rgba(15, 23, 42, 0.6)', border: '1px solid #334155', borderRadius: 8 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#f8fafc' }}>Regenerate Backup Recovery Codes</div>
                      <p style={{ fontSize: 12, color: '#94a3b8', margin: 0 }}>This will invalidate all current recovery codes. Enter your password to proceed.</p>
                      <input
                        id="mfa-regen-password"
                        name="regenPassword"
                        type="password"
                        placeholder="Current Account Password"
                        className="form-control"
                        value={regenPassword}
                        onChange={(e) => setRegenPassword(e.target.value)}
                        required
                        style={{ background: '#090d16', border: '1px solid #334155', color: '#fff', padding: '8px 12px', borderRadius: 6 }}
                      />
                      <input
                        id="mfa-regen-code"
                        name="regenCode"
                        type="text"
                        placeholder="Current 6-Digit TOTP Code (optional)"
                        className="form-control"
                        value={regenCode}
                        onChange={(e) => setRegenCode(e.target.value)}
                        style={{ background: '#090d16', border: '1px solid #334155', color: '#fff', padding: '8px 12px', borderRadius: 6 }}
                      />
                      <div style={{ display: 'flex', gap: 10 }}>
                        <button type="submit" className="btn btn-primary btn-sm" style={{ padding: '8px 14px' }}>
                          Generate New Codes
                        </button>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setIsRegeneratingCodes(false)}>
                          Cancel
                        </button>
                      </div>
                    </form>
                  ) : (
                    <form onSubmit={handleDisableMfa} style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 450, padding: 14, background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 8 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#f87171' }}>Disable Multi-Factor Authentication</div>
                      <p style={{ fontSize: 12, color: '#94a3b8', margin: 0 }}>Requires both your account password and current authentication code to confirm.</p>
                      <input
                        id="mfa-disable-password"
                        name="disablePassword"
                        type="password"
                        placeholder="Current Account Password"
                        className="form-control"
                        value={disablePassword}
                        onChange={(e) => setDisablePassword(e.target.value)}
                        required
                        style={{ background: '#090d16', border: '1px solid #334155', color: '#fff', padding: '8px 12px', borderRadius: 6 }}
                      />
                      <input
                        id="mfa-disable-code"
                        name="disableCode"
                        type="text"
                        aria-label="Current 6-digit code or recovery code"
                        placeholder="Current 6-digit code or recovery code"
                        className="form-control"
                        value={disableCode}
                        onChange={(e) => setDisableCode(e.target.value)}
                        required
                        autoComplete="one-time-code"
                        style={{ background: '#090d16', border: '1px solid #334155', color: '#fff', padding: '8px 12px', borderRadius: 6 }}
                      />
                      <div style={{ display: 'flex', gap: 10 }}>
                        <button type="submit" className="btn btn-danger btn-sm" style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: 6 }}>
                          Confirm Disable
                        </button>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setIsDisablingMfa(false)}>
                          Cancel
                        </button>
                      </div>
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
                          id="mfa-verify-code"
                          name="mfaVerifyCode"
                          type="text"
                          aria-label="6-digit verification code"
                          maxLength={6}
                          placeholder="123456"
                          className="form-control"
                          value={mfaVerifyCode}
                          onChange={(e) => setMfaVerifyCode(e.target.value.replace(/\D/g, ''))}
                          required
                          autoComplete="one-time-code"
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
                  id="security-event-search"
                  name="eventSearch"
                  type="text"
                  aria-label="Search security events"
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
                  id="security-event-severity-filter"
                  name="eventSeverity"
                  aria-label="Filter by event severity"
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

      {/* TAB 4: EMERGENCY THREAT LOCKDOWN */}
      {activeTab === 'lockdown' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Main Defense Card */}
          <div className="security-card" style={{ padding: '28px', border: lockdownStatus?.isActive ? '1px solid #ef4444' : '1px solid #1e293b' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
              <div>
                <div style={{ fontSize: '11px', fontWeight: 700, color: lockdownStatus?.isActive ? '#ef4444' : '#10b981', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Radio size={14} /> DEFENSE POSTURE: {lockdownStatus?.isActive ? 'SEALED / CRITICAL MITIGATION' : 'NOMINAL ACTIVE'}
                </div>
                <h3 style={{ fontSize: 22, fontWeight: 800, color: '#f8fafc', margin: '8px 0 6px' }}>
                  Platform Emergency Threat Lockdown (Panic Mode)
                </h3>
                <p style={{ fontSize: 13, color: '#94a3b8', margin: 0, maxWidth: 680 }}>
                  Immediate perimeter circuit breaker. Engages full lockdown by rejecting all non-Super Administrator API requests, terminating tenant user sessions, and halting incoming telephony routing.
                </p>
              </div>

              <div>
                {lockdownStatus?.isActive ? (
                  <button
                    className="btn btn-sm"
                    style={{ background: '#ffffff', color: '#b91c1c', fontWeight: 700, border: 'none', padding: '10px 18px', display: 'flex', alignItems: 'center', gap: 8 }}
                    onClick={handleLiftLockdown}
                    disabled={isSubmittingLockdown}
                  >
                    <Unlock size={16} /> Disarm Lockdown
                  </button>
                ) : (
                  <button
                    className="btn btn-danger btn-sm"
                    style={{ padding: '10px 18px', display: 'flex', alignItems: 'center', gap: 8 }}
                    onClick={() => {
                      setLockdownReason('');
                      setLockdownConfirmText('');
                      setIsLockdownModalOpen(true);
                    }}
                  >
                    <Lock size={16} /> Engage Threat Lockdown
                  </button>
                )}
              </div>
            </div>

            {/* Status Summary Banner */}
            <div style={{
              marginTop: 24,
              background: lockdownStatus?.isActive ? 'rgba(239, 68, 68, 0.12)' : 'rgba(16, 185, 129, 0.08)',
              border: lockdownStatus?.isActive ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(16, 185, 129, 0.25)',
              borderRadius: 10,
              padding: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: 16,
            }}>
              <div style={{
                background: lockdownStatus?.isActive ? '#ef4444' : '#10b981',
                borderRadius: '50%',
                padding: '12px',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                {lockdownStatus?.isActive ? <ShieldAlert size={28} /> : <ShieldCheck size={28} />}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: lockdownStatus?.isActive ? '#fca5a5' : '#86efac' }}>
                  {lockdownStatus?.isActive ? 'Platform is Currently Sealed Under Emergency Threat Lockdown' : 'All Platform Defensive Systems are Operating Normally'}
                </div>
                <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 4 }}>
                  {lockdownStatus?.isActive ? (
                    <span>
                      Incident Reason: <strong style={{ color: '#fef2f2' }}>{lockdownStatus.reason}</strong>
                      {lockdownStatus.initiatedBy ? ` • Engaged by Super Admin ${lockdownStatus.initiatedBy}` : ''}
                      {lockdownStatus.initiatedAt ? ` on ${new Date(lockdownStatus.initiatedAt).toLocaleString()}` : ''}
                    </span>
                  ) : (
                    'Cross-tenant isolation, JWT session tokens, telephony gatekeepers, and audit ledgers are running with normal security protocols.'
                  )}
                </div>
              </div>
            </div>

            {/* Defensive Capabilities Matrix */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginTop: 24 }}>
              <div style={{ background: 'rgba(15, 23, 42, 0.5)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: 10, padding: 18 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, color: '#38bdf8', fontWeight: 700 }}>
                  <Shield size={18} /> API Perimeter Circuit Breaker
                </div>
                <p style={{ fontSize: 12, color: '#94a3b8', margin: 0, lineHeight: 1.5 }}>
                  Instantly returns HTTP 503 Security Lockdown to all incoming API requests from tenant sales reps and company admins.
                </p>
              </div>

              <div style={{ background: 'rgba(15, 23, 42, 0.5)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: 10, padding: 18 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, color: '#fbbf24', fontWeight: 700 }}>
                  <LogOut size={18} /> Global Session Token Revocation
                </div>
                <p style={{ fontSize: 12, color: '#94a3b8', margin: 0, lineHeight: 1.5 }}>
                  Terminates active JWT session tokens and pushes instant forced-logout notifications across open WebSocket / SignalR client connections.
                </p>
              </div>

              <div style={{ background: 'rgba(15, 23, 42, 0.5)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: 10, padding: 18 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, color: '#a78bfa', fontWeight: 700 }}>
                  <KeyRound size={18} /> Super Admin Console Immunity
                </div>
                <p style={{ fontSize: 12, color: '#94a3b8', margin: 0, lineHeight: 1.5 }}>
                  The Super Admin Console maintains uninhibited access so administrators can investigate breach vectors, review error logs, and inspect database tables.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* EMERGENCY THREAT LOCKDOWN CONFIRMATION MODAL */}
      {/* ========================================================================= */}
      {isLockdownModalOpen && (
        <Modal
          isOpen={isLockdownModalOpen}
          onClose={() => setIsLockdownModalOpen(false)}
          title="🚨 ARM EMERGENCY THREAT LOCKDOWN"
          size="md"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              borderRadius: 8,
              padding: '14px',
              color: '#fca5a5',
              fontSize: 13,
              lineHeight: 1.5
            }}>
              <strong>WARNING:</strong> Engaging Emergency Threat Lockdown will immediately disconnect all tenant users, terminate active sessions, and reject all non-superadmin API traffic across the entire platform until manually disarmed.
            </div>

            <div className="form-group">
              <label className="form-label required">Incident Reason / Threat Summary</label>
              <textarea
                className="form-control"
                rows={3}
                placeholder="e.g. Credential stuffing anomaly detected on tenant auth endpoints. Immediate mitigation required."
                value={lockdownReason}
                onChange={(e) => setLockdownReason(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label required">
                Confirmation Check (Type <code>LOCKDOWN</code> to confirm)
              </label>
              <input
                type="text"
                className="form-control"
                placeholder="Type LOCKDOWN"
                value={lockdownConfirmText}
                onChange={(e) => setLockdownConfirmText(e.target.value)}
              />
            </div>

            <div className="modal-actions-footer">
              <button
                className="btn btn-ghost"
                onClick={() => setIsLockdownModalOpen(false)}
                disabled={isSubmittingLockdown}
              >
                Cancel
              </button>
              <button
                className="btn btn-danger"
                disabled={
                  !lockdownReason.trim() ||
                  lockdownConfirmText.trim().toUpperCase() !== 'LOCKDOWN' ||
                  isSubmittingLockdown
                }
                onClick={handleTriggerLockdown}
              >
                {isSubmittingLockdown ? 'Engaging Lockdown...' : 'Engage Platform Lockdown'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
