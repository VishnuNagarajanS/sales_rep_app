import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, Tenant, TenantSlug, RoleCode } from '../types';
import { DEFAULT_TENANTS } from '../constants/defaultTenants';
import { FEATURES } from '../constants/features';
import { apiClient } from '../services/apiClient';

interface AuthContextType {
  user: User | null;
  tenant: Tenant | null;
  enabledFeatures: string[];
  permissions: string[];
  isAuthenticated: boolean;
  isSuperAdmin: boolean;
  loginError: string | null;
  login: (email: string, password?: string, roleCode?: RoleCode, tenantSlug?: TenantSlug) => Promise<boolean>;
  logout: () => void;
  switchPersona: (roleCode: RoleCode, tenantSlug?: TenantSlug) => void;
  setUser: (user: User | null) => void;
  setTenant: (tenant: Tenant | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [loginError, setLoginError] = useState<string | null>(null);

  const [user, setUser] = useState<User | null>(() => {
    const saved = sessionStorage.getItem('nexus_current_user');
    if (saved) {
      try { return JSON.parse(saved); } catch { }
    }
    return null;
  });

  const [tenant, setTenant] = useState<Tenant | null>(() => {
    const saved = sessionStorage.getItem('nexus_current_tenant');
    if (saved) {
      try { return JSON.parse(saved); } catch { }
    }
    return DEFAULT_TENANTS.ghl;
  });

  useEffect(() => {
    if (user) {
      sessionStorage.setItem('nexus_current_user', JSON.stringify(user));
    } else {
      sessionStorage.removeItem('nexus_current_user');
      sessionStorage.removeItem('nexus_auth_token');
      localStorage.removeItem('nexus_current_user');
      localStorage.removeItem('nexus_auth_token');
    }
  }, [user]);

  useEffect(() => {
    if (tenant) {
      sessionStorage.setItem('nexus_current_tenant', JSON.stringify(tenant));
    } else {
      sessionStorage.removeItem('nexus_current_tenant');
      localStorage.removeItem('nexus_current_tenant');
    }
  }, [tenant]);

  // Handle unauthorized event dispatched by apiClient on token expiration
  useEffect(() => {
    const handleUnauthorized = () => {
      logout();
    };
    window.addEventListener('nexus_auth_unauthorized', handleUnauthorized);
    return () => window.removeEventListener('nexus_auth_unauthorized', handleUnauthorized);
  }, []);

  const isSuperAdmin = user?.role?.code === 'super_admin';

  const enabledFeatures = isSuperAdmin
    ? Object.values(FEATURES)
    : tenant?.enabledFeatures || [];

  const permissions = user?.role?.permissions || [];

  // switchPersona is retained as a compatibility stub that alerts user to sign in
  const switchPersona = (_roleCode: RoleCode, _tenantSlug?: TenantSlug) => {
    console.warn('Demo persona fast-switch is disabled. Please sign in with account credentials.');
  };

  const login = async (
    email: string,
    password?: string,
    _roleCode?: RoleCode,
    _tenantSlug?: TenantSlug
  ): Promise<boolean> => {
    setLoginError(null);

    if (!password) {
      setLoginError('Password is required for database authentication.');
      return false;
    }

    try {
      const response: any = await apiClient.post('/auth/login', { email, password });

      if (response && response.success && response.data) {
        const { token, user: userData, tenant: tenantData } = response.data;

        if (token) {
          sessionStorage.setItem('nexus_auth_token', token);
          localStorage.setItem('nexus_auth_token', token);
        }

        if (userData) {
          setUser(userData);
        }

        if (tenantData) {
          setTenant(tenantData);
        }

        return true;
      } else {
        setLoginError(response?.message || 'Login failed. Please check your credentials.');
        return false;
      }
    } catch (error: any) {
      setLoginError(error.message || 'Unable to connect to the authentication server.');
      return false;
    }
  };

  const logout = () => {
    sessionStorage.removeItem('nexus_auth_token');
    sessionStorage.removeItem('nexus_current_user');
    sessionStorage.removeItem('nexus_current_tenant');
    sessionStorage.removeItem('nexus_current_route');
    localStorage.removeItem('nexus_auth_token');
    localStorage.removeItem('nexus_current_user');
    localStorage.removeItem('nexus_current_tenant');
    setLoginError(null);
    setUser(null);
    setTenant(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        tenant,
        enabledFeatures,
        permissions,
        isAuthenticated: !!user,
        isSuperAdmin,
        loginError,
        login,
        logout,
        switchPersona,
        setUser,
        setTenant,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
