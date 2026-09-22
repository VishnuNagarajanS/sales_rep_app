import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { Shield, Building2, UserCheck, LogOut } from 'lucide-react';
import './PersonaSwitcher.css';

export const PersonaSwitcher: React.FC = () => {
  const { user, tenant, isSuperAdmin, logout } = useAuth();

  return (
    <div className="persona-switcher-container" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <div
        className={`btn btn-secondary btn-sm persona-trigger-btn ${isSuperAdmin ? 'super-admin' : 'tenant-admin'}`}
        style={{ cursor: 'default', display: 'flex', alignItems: 'center', gap: '6px' }}
      >
        {isSuperAdmin ? (
          <Shield size={14} color="#8b5cf6" />
        ) : (
          <Building2 size={14} color={tenant?.brandColor || '#ef4444'} />
        )}
        <span className="persona-role-prefix">DB USER:</span>
        <span className="persona-role-name">
          {user?.name} ({user?.role?.name})
        </span>
      </div>

      <button
        type="button"
        className="btn btn-ghost btn-sm"
        onClick={logout}
        title="Sign Out of Session"
        style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: '4px' }}
      >
        <LogOut size={14} />
        <span>Sign Out</span>
      </button>
    </div>
  );
};
