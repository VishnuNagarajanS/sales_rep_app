import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { ArrowRight, Lock, Mail, AlertCircle } from 'lucide-react';
import './AuthLayout.css';

export const AuthLayout: React.FC = () => {
  const { login, loginError } = useAuth();
  const [email, setEmail] = useState('vishnu@ghlindiaventures.com');
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

        {/* Standard Login Form */}
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
                Forgot Password?
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
            {isLoading ? 'Signing in...' : 'Sign in'} <ArrowRight size={16} />
          </button>
        </form>
      </div>
    </div>
  );
};
