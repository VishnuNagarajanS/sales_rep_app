import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { ArrowRight, ArrowLeft, Lock, Mail, AlertCircle, CheckCircle2, KeyRound, ShieldCheck, Key } from 'lucide-react';
import { authService } from '../services/authService';
import './AuthLayout.css';

export const AuthLayout: React.FC = () => {
  const { login, loginError, mfaChallenge, verifyMfaCode, verifyMfaRecovery, cancelMfa } = useAuth();
  const [view, setView] = useState<'login' | 'forgot'>('login');

  // Login Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // MFA Verification Form State
  const [mfaCode, setMfaCode] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);
  const [isMfaSubmitting, setIsMfaSubmitting] = useState(false);

  // Forgot Password Form State
  const [forgotEmail, setForgotEmail] = useState('');
  const [isForgotLoading, setIsForgotLoading] = useState(false);
  const [forgotSuccess, setForgotSuccess] = useState(false);
  const [forgotError, setForgotError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    await login(email, password);
    setIsLoading(false);
  };

  const handleMfaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsMfaSubmitting(true);
    if (isRecoveryMode) {
      await verifyMfaRecovery(recoveryCode.trim());
    } else {
      await verifyMfaCode(mfaCode.trim());
    }
    setIsMfaSubmitting(false);
  };

  const handleCancelMfa = () => {
    cancelMfa();
    setMfaCode('');
    setRecoveryCode('');
    setIsRecoveryMode(false);
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError(null);
    setIsForgotLoading(true);

    try {
      const res = await authService.requestPasswordReset(forgotEmail);
      if (res && res.success) {
        setForgotSuccess(true);
      } else {
        setForgotError(res?.message || 'Failed to submit reset request. Please try again.');
      }
    } catch (err: any) {
      setForgotError(err?.message || 'Unable to connect to the server. Please try again.');
    } finally {
      setIsForgotLoading(false);
    }
  };

  const switchToForgot = () => {
    setView('forgot');
    setForgotEmail(email || '');
    setForgotError(null);
    setForgotSuccess(false);
  };

  const switchToLogin = () => {
    setView('login');
    setForgotError(null);
    setForgotSuccess(false);
  };

  return (
    <div className="auth-page-container">
      {/* Fixed background image */}
      <div className="auth-bg-layer" />
      {/* Subtle dark overlay for contrast */}
      <div className="auth-bg-overlay" />

      {/* Centered Liquid Glass Card */}
      <div className="auth-card-container">
        <div className="card animate-slide-down auth-card">
          {mfaChallenge ? (
            <>
              {/* MFA Verification Screen */}
              <div className="auth-header">
                <div
                  className="auth-logo-badge"
                  style={{
                    background: isRecoveryMode
                      ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
                      : 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                  }}
                >
                  {isRecoveryMode ? <Key size={26} color="#ffffff" /> : <ShieldCheck size={26} color="#ffffff" />}
                </div>
                <h2 className="auth-title">
                  {isRecoveryMode ? 'Emergency Recovery Code' : 'Two-Factor Authentication'}
                </h2>
                <p className="auth-subtitle">
                  {isRecoveryMode
                    ? 'Enter one of your 8 single-use emergency backup recovery codes.'
                    : `Enter the 6-digit verification code from your authenticator app for ${mfaChallenge.email}.`}
                </p>
              </div>

              <form onSubmit={handleMfaSubmit} className="auth-form">
                {!isRecoveryMode ? (
                  <div className="form-group">
                    <label htmlFor="mfa-login-code" className="form-label auth-form-label">
                      6-Digit Authenticator Code
                    </label>
                    <div className="auth-input-wrapper">
                      <KeyRound size={15} className="auth-input-icon" />
                      <input
                        id="mfa-login-code"
                        name="code"
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={6}
                        autoComplete="one-time-code"
                        className="form-input auth-input-field"
                        placeholder="123456"
                        value={mfaCode}
                        onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ''))}
                        required
                        autoFocus
                        style={{
                          letterSpacing: '0.25em',
                          fontFamily: 'monospace',
                          fontSize: '18px',
                          textAlign: 'center',
                          fontWeight: 700,
                        }}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="form-group">
                    <label htmlFor="mfa-recovery-code" className="form-label auth-form-label">
                      Backup Recovery Code
                    </label>
                    <div className="auth-input-wrapper">
                      <Key size={15} className="auth-input-icon" />
                      <input
                        id="mfa-recovery-code"
                        name="recoveryCode"
                        type="text"
                        autoComplete="off"
                        className="form-input auth-input-field"
                        placeholder="XXXX-XXXX"
                        value={recoveryCode}
                        onChange={(e) => setRecoveryCode(e.target.value.toUpperCase())}
                        required
                        autoFocus
                        style={{
                          letterSpacing: '0.15em',
                          fontFamily: 'monospace',
                          fontSize: '16px',
                          textAlign: 'center',
                          fontWeight: 700,
                        }}
                      />
                    </div>
                  </div>
                )}

                {loginError && (
                  <div className="auth-error-alert">
                    <AlertCircle size={16} />
                    <span>{loginError}</span>
                  </div>
                )}

                <button
                  type="submit"
                  className="btn btn-primary auth-submit-btn"
                  disabled={isMfaSubmitting || (!isRecoveryMode ? mfaCode.length < 6 : !recoveryCode.trim())}
                >
                  {isMfaSubmitting ? 'Verifying Code...' : 'Verify and Sign In'} <ArrowRight size={16} />
                </button>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
                  <button
                    type="button"
                    className="btn btn-secondary auth-preset-btn"
                    style={{ justifyContent: 'center', textAlign: 'center', width: '100%', fontSize: 13 }}
                    onClick={() => {
                      setIsRecoveryMode(!isRecoveryMode);
                      setMfaCode('');
                      setRecoveryCode('');
                    }}
                    disabled={isMfaSubmitting}
                  >
                    {isRecoveryMode ? 'Use Authenticator Code instead' : 'Use a backup recovery code instead'}
                  </button>

                  <button
                    type="button"
                    className="btn btn-secondary auth-preset-btn"
                    style={{ justifyContent: 'center', textAlign: 'center', width: '100%', fontSize: 13, borderColor: 'transparent' }}
                    onClick={handleCancelMfa}
                    disabled={isMfaSubmitting}
                  >
                    <ArrowLeft size={14} /> Back to Sign In
                  </button>
                </div>
              </form>
            </>
          ) : view === 'forgot' ? (
            <>
              {/* Forgot Password Header */}
              <div className="auth-header">
                {forgotSuccess ? (
                  <div className="auth-logo-badge" style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}>
                    <CheckCircle2 size={26} color="#ffffff" />
                  </div>
                ) : (
                  <div className="auth-logo-badge" style={{ background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)' }}>
                    <KeyRound size={26} color="#ffffff" />
                  </div>
                )}
                <h2 className="auth-title">
                  {forgotSuccess ? 'Check Your Inbox' : 'Reset Your Password'}
                </h2>
                <p className="auth-subtitle">
                  {forgotSuccess
                    ? `We sent reset instructions to ${forgotEmail}`
                    : "Enter your registered email and we'll send you a secure link to reset your password."}
                </p>
              </div>

              {forgotSuccess ? (
                <div style={{ textAlign: 'center', padding: '10px 0' }}>
                  <p style={{ color: 'rgba(255, 255, 255, 0.85)', fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
                    If an account with that email exists in our system, you will receive password reset instructions shortly. Please check your inbox and spam folder.
                  </p>
                  <button
                    type="button"
                    className="btn btn-primary auth-submit-btn"
                    onClick={switchToLogin}
                  >
                    <ArrowLeft size={16} /> Return to Sign In
                  </button>
                </div>
              ) : (
                <form onSubmit={handleForgotSubmit} className="auth-form">
                  <div className="form-group">
                    <label htmlFor="forgot-email" className="form-label auth-form-label">Registered Work Email</label>
                    <div className="auth-input-wrapper">
                      <Mail size={15} className="auth-input-icon" />
                      <input
                        id="forgot-email"
                        name="email"
                        type="email"
                        autoComplete="email"
                        className="form-input auth-input-field"
                        placeholder="name@company.com"
                        value={forgotEmail}
                        onChange={e => setForgotEmail(e.target.value)}
                        required
                        autoFocus
                      />
                    </div>
                  </div>

                  {forgotError && (
                    <div className="auth-error-alert">
                      <AlertCircle size={16} />
                      <span>{forgotError}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    className="btn btn-primary auth-submit-btn"
                    disabled={isForgotLoading || !forgotEmail.trim()}
                  >
                    {isForgotLoading ? 'Sending Reset Link...' : 'Send Reset Link'} <ArrowRight size={16} />
                  </button>

                  <button
                    type="button"
                    className="btn btn-secondary auth-preset-btn"
                    style={{ justifyContent: 'center', textAlign: 'center', width: '100%' }}
                    onClick={switchToLogin}
                    disabled={isForgotLoading}
                  >
                    <ArrowLeft size={15} /> Back to Sign In
                  </button>
                </form>
              )}
            </>
          ) : (
            <>
              {/* Header */}
              <div className="auth-header">
                <div className="auth-logo-container">
                  <img src="/gml-metallic-logo.png" alt="GML Logo" className="auth-app-logo" />
                </div>
                <h2 className="auth-title">NexusSales Platform</h2>
                <p className="auth-subtitle">
                  Multi-Tenant Sales CRM & Real-Time Calling Engine
                </p>
              </div>

              {/* Standard Form */}
              <form onSubmit={handleSubmit} className="auth-form">
                <div className="form-group">
                  <label htmlFor="login-email" className="form-label auth-form-label">Work Email</label>
                  <div className="auth-input-wrapper">
                    <Mail size={15} className="auth-input-icon" />
                    <input
                      id="login-email"
                      name="email"
                      type="email"
                      autoComplete="username"
                      className="form-input auth-input-field"
                      placeholder="name@company.com"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <div className="auth-password-header">
                    <label htmlFor="login-password" className="form-label auth-form-label">Password</label>
                    <button
                      type="button"
                      className="auth-forgot-link"
                      onClick={switchToForgot}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: 0,
                        fontFamily: 'inherit',
                      }}
                    >
                      Forgot Password?
                    </button>
                  </div>
                  <div className="auth-input-wrapper">
                    <Lock size={15} className="auth-input-icon" />
                    <input
                      id="login-password"
                      name="password"
                      type="password"
                      autoComplete="current-password"
                      className="form-input auth-input-field"
                      placeholder="••••••••••••"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                    />
                  </div>
                </div>

                {loginError && (
                  <div className="auth-error-alert">
                    <AlertCircle size={16} />
                    <span>{loginError}</span>
                  </div>
                )}

                <button
                  type="submit"
                  className="btn btn-primary auth-submit-btn"
                  disabled={isLoading}
                >
                  {isLoading ? 'Signing in...' : 'Sign in'} <ArrowRight size={16} />
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
