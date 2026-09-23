import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Shield, Building2, UserCheck, ArrowRight, Lock, Mail, AlertCircle, TrendingUp } from 'lucide-react';
import './AuthLayout.css';

export const AuthLayout: React.FC = () => {
  const { login, switchPersona, loginError } = useAuth();
  const [email, setEmail] = useState('vikram@ghlindiatrust.com');
  const [password, setPassword] = useState('Password@123');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    await login(email, password);
    setIsLoading(false);
  };

  return (
    <div className="auth-page-container">
      <div className="card animate-slide-down auth-card">
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

        {/* Demo Fast Login Presets */}
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
                <div className="auth-preset-subtitle">Plots / Operations</div>
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
                <div className="auth-preset-subtitle">Ananya Iyer</div>
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
                <div className="auth-preset-subtitle">Rohan Varma</div>
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
                <div className="auth-preset-subtitle">Operator Console</div>
              </div>
            </button>
          </div>
        </div>

        <div className="auth-divider">
          <div className="auth-divider-line" />
          <span>or sign in with credentials</span>
          <div className="auth-divider-line" />
        </div>

        {/* Standard Form */}
        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label className="form-label auth-form-label">Work Email</label>
            <div className="auth-input-wrapper">
              <Mail size={15} className="auth-input-icon" />
              <input
                type="email"
                className="form-input auth-input-field"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <div className="auth-password-header">
              <label className="form-label auth-form-label">Password</label>
              <a href="#forgot" className="auth-forgot-link">
                Forgot?
              </a>
            </div>
            <div className="auth-input-wrapper">
              <Lock size={15} className="auth-input-icon" />
              <input
                type="password"
                className="form-input auth-input-field"
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
            {isLoading ? 'Signing in...' : 'Sign In to Organization'} <ArrowRight size={16} />
          </button>
        </form>
      </div>
    </div>
  );
};
