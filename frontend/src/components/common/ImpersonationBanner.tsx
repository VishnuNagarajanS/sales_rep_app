import React, { useState, useEffect } from 'react';
import { ShieldAlert, LogOut } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import './ImpersonationBanner.css';

export const ImpersonationBanner: React.FC = () => {
  const { user, tenant } = useAuth();
  const [backupData, setBackupData] = useState<any | null>(null);

  const checkBackup = () => {
    try {
      const raw = localStorage.getItem('nexus_impersonation_backup');
      if (raw) {
        setBackupData(JSON.parse(raw));
      } else {
        setBackupData(null);
      }
    } catch {
      setBackupData(null);
    }
  };

  useEffect(() => {
    checkBackup();
    const handleStorageChange = () => checkBackup();
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('nexus_impersonation_changed', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('nexus_impersonation_changed', handleStorageChange);
    };
  }, []);

  if (!backupData) {
    return null;
  }

  const handleExitImpersonation = () => {
    try {
      if (backupData.token) {
        sessionStorage.setItem('nexus_auth_token', backupData.token);
        localStorage.setItem('nexus_auth_token', backupData.token);
      }
      if (backupData.user) {
        const userStr = typeof backupData.user === 'string' ? backupData.user : JSON.stringify(backupData.user);
        sessionStorage.setItem('nexus_current_user', userStr);
        localStorage.setItem('nexus_current_user', userStr);
      }

      localStorage.removeItem('nexus_impersonation_backup');
      sessionStorage.removeItem('nexus_current_tenant');
      localStorage.removeItem('nexus_current_tenant');
      sessionStorage.removeItem('nexus_support_mode_active');
      sessionStorage.removeItem('nexus_support_company_name');

      // Dispatch event to sync state immediately
      window.dispatchEvent(new Event('nexus_impersonation_changed'));
      window.dispatchEvent(new Event('nexus_auth_updated'));

      // Redirect back to Super Admin Companies console
      window.location.href = '/companies';
    } catch (err) {
      console.error('Failed to exit impersonation mode cleanly:', err);
      localStorage.removeItem('nexus_impersonation_backup');
      window.location.href = '/dashboard';
    }
  };

  const tenantName = tenant?.name || backupData.tenantName || 'Tenant Organization';
  const targetUserName = user?.name || user?.email || 'Tenant Admin';

  return (
    <div className="nexus-impersonation-banner" role="alert">
      <div className="nexus-impersonation-left">
        <span className="nexus-impersonation-tag">
          <ShieldAlert size={14} /> Impersonation Active
        </span>
        <span className="nexus-impersonation-text">
          Viewing workspace as <strong>{targetUserName}</strong> ({tenantName}). All actions are audited.
        </span>
      </div>
      <button
        type="button"
        className="nexus-impersonation-btn-exit"
        onClick={handleExitImpersonation}
        title="Exit Impersonation and return to Super Admin Platform Console"
      >
        <LogOut size={13} /> Exit Impersonation
      </button>
    </div>
  );
};
