import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { ShieldAlert } from 'lucide-react';
import './Guards.css';

interface RequireFeatureProps {
  feature: string;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export const RequireFeature: React.FC<RequireFeatureProps> = ({ feature, fallback = null, children }) => {
  const { enabledFeatures, isSuperAdmin } = useAuth();
  if (isSuperAdmin || enabledFeatures.includes(feature)) {
    return <>{children}</>;
  }
  return <>{fallback}</>;
};

interface RequirePermissionProps {
  permission: string;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export const RequirePermission: React.FC<RequirePermissionProps> = ({ permission, fallback = null, children }) => {
  const { permissions, isSuperAdmin } = useAuth();
  if (isSuperAdmin || permissions.includes(permission)) {
    return <>{children}</>;
  }
  return <>{fallback}</>;
};

export const useCan = (permission: string): boolean => {
  const { permissions, isSuperAdmin } = useAuth();
  if (isSuperAdmin) return true;
  return permissions.includes(permission);
};

export const useHasFeature = (feature: string): boolean => {
  const { enabledFeatures, isSuperAdmin } = useAuth();
  if (isSuperAdmin) return true;
  return enabledFeatures.includes(feature);
};

interface ProtectedRouteProps {
  feature?: string;
  permission?: string;
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ feature, permission, children }) => {
  const { isAuthenticated, enabledFeatures, permissions, isSuperAdmin } = useAuth();

  if (!isAuthenticated) {
    return (
      <div className="access-denied-container">
        <div className="card text-center" style={{ maxWidth: 440, margin: '60px auto', padding: '32px' }}>
          <ShieldAlert size={48} color="#ef4444" style={{ margin: '0 auto 16px' }} />
          <h3>Authentication Required</h3>
          <p style={{ color: 'var(--text-secondary)', marginTop: 8 }}>
            Please sign in to access this workspace module.
          </p>
        </div>
      </div>
    );
  }

  if (feature && !isSuperAdmin && !enabledFeatures.includes(feature)) {
    return (
      <div className="access-denied-container">
        <div className="card text-center" style={{ maxWidth: 480, margin: '60px auto', padding: '32px' }}>
          <ShieldAlert size={48} color="#f59e0b" style={{ margin: '0 auto 16px' }} />
          <h3>Feature Not Available</h3>
          <p style={{ color: 'var(--text-secondary)', marginTop: 8 }}>
            This capability is not enabled for your organization's subscription package.
          </p>
        </div>
      </div>
    );
  }

  if (permission && !isSuperAdmin && !permissions.includes(permission)) {
    return (
      <div className="access-denied-container">
        <div className="card text-center" style={{ maxWidth: 480, margin: '60px auto', padding: '32px' }}>
          <ShieldAlert size={48} color="#ef4444" style={{ margin: '0 auto 16px' }} />
          <h3>Access Restricted</h3>
          <p style={{ color: 'var(--text-secondary)', marginTop: 8 }}>
            You do not have the required role privileges to access this area.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
