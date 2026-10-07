import React from 'react';
import { useAuth } from '../../context/AuthContext';
import './PersonaSwitcher.css';

export const PersonaSwitcher: React.FC = () => {
  const { user, tenant, isSuperAdmin } = useAuth();

  return (
    <div className="persona-switcher-container">
      <div
        className={`btn btn-secondary btn-sm persona-trigger-btn ${isSuperAdmin ? 'super-admin' : 'tenant-admin'}`}
        style={{ cursor: 'default' }}
      >
        <span className="persona-role-prefix">ROLE:</span>
        <span className="persona-role-name">
          {isSuperAdmin ? 'Super Admin' : `${tenant?.name || 'Organization'} (${user?.role?.name || 'User'})`}
        </span>
      </div>
    </div>
  );
};
