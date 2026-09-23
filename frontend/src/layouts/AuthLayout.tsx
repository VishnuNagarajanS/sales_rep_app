import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { ArrowRight, Lock, Mail, AlertCircle, CheckCircle2 } from 'lucide-react';
import './AuthLayout.css';

export const AuthLayout: React.FC = () => {
  const { login, loginError } = useAuth();
  const [email, setEmail] = useState('ananya@ghlindiatrust.com');
  const [password, setPassword] = useState('Password@123');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    await login(email, password);
    setIsLoading(false);
  };

  const handleSelectAccount = (accEmail: string) => {
    setEmail(accEmail);
    setPassword('Password@123');
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
            Enterprise Sales CRM & PostgreSQL Cloud Database
          </p>
        </div>

        {/* Real Database Accounts Helper Chips */}
        <div className="auth-presets-container">
          <div className="auth-presets-label">
            Quick-Select Test Account (Neon PostgreSQL Database)
          </div>
          <div className="auth-presets-grid">
            <button
              type="button"
              className={`btn btn-secondary btn-sm auth-preset-btn ${email === 'ananya@ghlindiatrust.com' ? 'border-primary' : ''}`}
              onClick={() => handleSelectAccount('ananya@ghlindiatrust.com')}
            >
              <div>
                <div className="auth-preset-title">Ananya Iyer</div>
                <div className="auth-preset-subtitle">Sales Executive (GHL)</div>
              </div>
            </button>

            <button
              type="button"
              className={`btn btn-secondary btn-sm auth-preset-btn ${email === 'vikram@ghlindiatrust.com' ? 'border-primary' : ''}`}
              onClick={() => handleSelectAccount('vikram@ghlindiatrust.com')}
            >
              <div>
                <div className="auth-preset-title">Vikram Malhotra</div>
                <div className="auth-preset-subtitle">Company Admin (GHL)</div>
              </div>
            </button>

            <button
              type="button"
              className={`btn btn-secondary btn-sm auth-preset-btn ${email === 'kavita@jaminbazaar.com' ? 'border-primary' : ''}`}
              onClick={() => handleSelectAccount('kavita@jaminbazaar.com')}
            >
              <div>
                <div className="auth-preset-title">Kavita Rao</div>
                <div className="auth-preset-subtitle">Company Admin (Jamin)</div>
              </div>
            </button>

            <button
              type="button"
              className={`btn btn-secondary btn-sm auth-preset-btn ${email === 'alex@nexusplatform.io' ? 'border-primary' : ''}`}
              onClick={() => handleSelectAccount('alex@nexusplatform.io')}
            >
              <div>
                <div className="auth-preset-title">Alex Rivera</div>
                <div className="auth-preset-subtitle">Super Admin</div>
              </div>
            </button>
          </div>
        </div>

        <div className="auth-divider">
          <div className="auth-divider-line" />
          <span>sign in with database credentials</span>
          <div className="auth-divider-line" />
        </div>

        {/* Standard Authenticated Form */}
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
            {isLoading ? 'Signing in...' : 'Sign in'} <ArrowRight size={16} />
          </button>
        </form>
      </div>
    </div>
  );
};
