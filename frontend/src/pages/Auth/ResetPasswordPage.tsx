import React, { useState, useEffect } from 'react';
import { Lock, Eye, EyeOff, ArrowRight, CheckCircle2, AlertCircle, ShieldCheck } from 'lucide-react';
import { authService } from '../../services/authService';
import '../../layouts/AuthLayout.css';
import './ResetPasswordPage.css';

export const ResetPasswordPage: React.FC = () => {
  const [token, setToken] = useState<string>('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isTokenMissing, setIsTokenMissing] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenParam = params.get('token');
    if (!tokenParam || !tokenParam.trim()) {
      setIsTokenMissing(true);
    } else {
      setToken(tokenParam.trim());
    }
  }, []);

  const handleReturnToLogin = () => {
    window.location.href = '/';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!newPassword || newPassword.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match. Please verify and try again.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await authService.resetPassword(token, newPassword);
      if (res && res.success) {
        setIsSuccess(true);
      } else {
        setError(res?.message || 'Failed to reset password. The link may have expired.');
      }
    } catch (err: any) {
      setError(err?.message || 'Invalid or expired password reset link.');
    } finally {
      setIsLoading(false);
    }
  };

  const isMinLength = newPassword.length >= 8;
  const isMatching = Boolean(newPassword && confirmPassword && newPassword === confirmPassword);

  return (
    <div className="auth-page-container">
      <div className="auth-bg-layer" />
      <div className="auth-bg-overlay" />

      <div className="auth-card-container">
        <div className="card animate-slide-down auth-card">
          {/* Header */}
          <div className="auth-header">
            {isSuccess ? (
              <div className="reset-password-badge success">
                <CheckCircle2 size={28} />
              </div>
            ) : isTokenMissing ? (
              <div className="reset-password-badge error">
                <AlertCircle size={28} />
              </div>
            ) : (
              <div className="reset-password-badge">
                <ShieldCheck size={28} />
              </div>
            )}

            <h2 className="auth-title">
              {isSuccess
                ? 'Password Reset Complete'
                : isTokenMissing
                  ? 'Invalid Reset Link'
                  : 'Set New Password'}
            </h2>
            <p className="auth-subtitle">
              {isSuccess
                ? 'Your password has been changed successfully.'
                : isTokenMissing
                  ? 'This password reset link is missing or malformed.'
                  : 'Create a new strong password for your account.'}
            </p>
          </div>

          {/* Success State */}
          {isSuccess && (
            <div className="reset-password-success-box">
              <p className="reset-password-success-text">
                Your password has been updated securely. You can now return to the login screen and sign in with your new credentials.
              </p>
              <button
                type="button"
                className="btn btn-primary auth-submit-btn"
                onClick={handleReturnToLogin}
              >
                Sign In to Platform <ArrowRight size={16} />
              </button>
            </div>
          )}

          {/* Token Missing State */}
          {!isSuccess && isTokenMissing && (
            <div className="reset-password-success-box">
              <p className="reset-password-success-text">
                The password reset token is missing from the URL. Please request a new password reset link from the login page.
              </p>
              <button
                type="button"
                className="btn btn-primary auth-submit-btn"
                onClick={handleReturnToLogin}
              >
                Return to Login <ArrowRight size={16} />
              </button>
            </div>
          )}

          {/* Form State */}
          {!isSuccess && !isTokenMissing && (
            <form onSubmit={handleSubmit} className="auth-form">
              {/* New Password */}
              <div className="form-group">
                <label className="form-label auth-form-label">New Password</label>
                <div className="auth-input-wrapper">
                  <Lock size={15} className="auth-input-icon" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="form-input auth-input-field"
                    placeholder="Enter new password (min. 8 characters)"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    required
                    autoFocus
                  />
                  <button
                    type="button"
                    className="reset-password-toggle-pw"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              {/* Confirm New Password */}
              <div className="form-group">
                <label className="form-label auth-form-label">Confirm New Password</label>
                <div className="auth-input-wrapper">
                  <Lock size={15} className="auth-input-icon" />
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    className="form-input auth-input-field"
                    placeholder="Re-enter new password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="reset-password-toggle-pw"
                    onClick={() => setShowConfirm(!showConfirm)}
                    tabIndex={-1}
                  >
                    {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>

                {/* Password Criteria Feedback */}
                <div className="reset-password-requirements">
                  <div className={`reset-password-requirement-item ${isMinLength ? 'valid' : ''}`}>
                    <span>{isMinLength ? '✓' : '•'}</span>
                    <span>At least 8 characters long</span>
                  </div>
                  {confirmPassword && (
                    <div className={`reset-password-requirement-item ${isMatching ? 'valid' : ''}`}>
                      <span>{isMatching ? '✓' : '•'}</span>
                      <span>Passwords match</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Error Alert */}
              {error && (
                <div className="auth-error-alert">
                  <AlertCircle size={16} />
                  <span>{error}</span>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                className="btn btn-primary auth-submit-btn"
                disabled={isLoading || !isMinLength || !isMatching}
              >
                {isLoading ? 'Resetting Password...' : 'Save New Password'} <ArrowRight size={16} />
              </button>

              <button
                type="button"
                className="btn btn-secondary auth-preset-btn reset-password-back-btn"
                onClick={handleReturnToLogin}
                disabled={isLoading}
              >
                Cancel and Return to Sign In
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
export default ResetPasswordPage;
