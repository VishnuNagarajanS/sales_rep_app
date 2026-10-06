import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Shield, Building2, UserCheck, ArrowRight, ArrowLeft, Lock, Mail, AlertCircle, TrendingUp, CheckCircle2, KeyRound } from 'lucide-react';
import { isMockMode } from '../config/environment';
import { authService } from '../services/authService';
import './AuthLayout.css';

export const AuthLayout: React.FC = () => {
  const { login, switchPersona, loginError } = useAuth();
  const [view, setView] = useState<'login' | 'forgot'>('login');

  // Login Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

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
      {/* Background with subtle 6px blur and dark/blue transparent overlay */}
      <div className="auth-bg-layer" />
      <div className="auth-bg-overlay" />

      {/* Centered Liquid Glass Card */}
      <div className="auth-card-container">
        <div className="card animate-slide-down auth-card">
          {view === 'forgot' ? (
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
                <div className="auth-logo-badge">
                  ⚡
                </div>
                <h2 className="auth-title">NexusSales Platform</h2>
                <p className="auth-subtitle">
                  Multi-Tenant Sales CRM & Real-Time Calling Engine
                </p>
              </div>

              {/* Demo Fast Login Presets (Mock Mode Only) */}
              {isMockMode() && (
                <>
                  <div className="auth-presets-container">
                    <div className="auth-presets-label">
                      Quick One-Click Demo Sign-in
                    </div>
                    <div className="auth-presets-grid">
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm auth-preset-btn"
                        onClick={() => switchPersona('company_admin', 'ghl')}
                      >
                        <Building2 size={14} color="#ef4444" />
                        <div>
                          <div className="auth-preset-title">GHL India Admin</div>
                          <div className="auth-preset-subtitle">Wealth / Investors</div>
                        </div>
                      </button>

                      <button
                        type="button"
                        className="btn btn-secondary btn-sm auth-preset-btn"
                        onClick={() => switchPersona('company_admin', 'jamin')}
                      >
                        <Building2 size={14} color="#e10600" />
                        <div>
                          <div className="auth-preset-title">Jamin Bazaar Admin</div>
                          <div className="auth-preset-subtitle">Mani</div>
                        </div>
                      </button>

                      <button
                        type="button"
                        className="btn btn-secondary btn-sm auth-preset-btn"
                        onClick={() => switchPersona('sales_executive', 'ghl')}
                      >
                        <UserCheck size={14} color="#ef4444" />
                        <div>
                          <div className="auth-preset-title">GHL Sales Agent</div>
                          <div className="auth-preset-subtitle">Naveen</div>
                        </div>
                      </button>

                      <button
                        type="button"
                        className="btn btn-secondary btn-sm auth-preset-btn"
                        onClick={() => switchPersona('irm', 'ghl')}
                      >
                        <TrendingUp size={14} color="#ef4444" />
                        <div>
                          <div className="auth-preset-title">GHL IRM</div>
                          <div className="auth-preset-subtitle">Dhinakaran</div>
                        </div>
                      </button>

                      <button
                        type="button"
                        className="btn btn-secondary btn-sm auth-preset-btn"
                        onClick={() => switchPersona('super_admin')}
                      >
                        <Shield size={14} color="#8b5cf6" />
                        <div>
                          <div className="auth-preset-title">Super Admin</div>
                          <div className="auth-preset-subtitle">Yanosh</div>
                        </div>
                      </button>
                    </div>
                  </div>

                  <div className="auth-divider">
                    <div className="auth-divider-line" />
                    <span>or sign in with credentials</span>
                    <div className="auth-divider-line" />
                  </div>
                </>
              )}

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

