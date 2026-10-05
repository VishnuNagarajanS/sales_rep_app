import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, Tenant, TenantSlug, RoleCode } from '../types';
import { DEFAULT_TENANTS } from '../constants/defaultTenants';
import { SYSTEM_ROLES } from '../constants/roles';
import { FEATURES } from '../constants/features';
import { storageService } from '../services/storageService';
import { apiClient } from '../services/apiClient';

const getStoredTenants = (): Tenant[] => {
  try {
    const raw = localStorage.getItem('nexus_tenants');
    return raw ? JSON.parse(raw) : [DEFAULT_TENANTS.ghl, DEFAULT_TENANTS.jamin];
  } catch {
    return [DEFAULT_TENANTS.ghl, DEFAULT_TENANTS.jamin];
  }
};

const getStoredUsers = (tenantSlug?: string): User[] => {
  try {
    const raw = localStorage.getItem('nexus_users');
    const users: User[] = raw ? JSON.parse(raw) : [];
    return tenantSlug ? users.filter((u: User) => u.companySlug === tenantSlug) : users;
  } catch {
    return [];
  }
};

const saveStoredUser = (targetUser: User) => {
  try {
    const raw = localStorage.getItem('nexus_users');
    const users: User[] = raw ? JSON.parse(raw) : [];
    const idx = users.findIndex(u => u.id === targetUser.id);
    if (idx >= 0) {
      users[idx] = targetUser;
    } else {
      users.push(targetUser);
    }
    localStorage.setItem('nexus_users', JSON.stringify(users));
  } catch { }
};

export { getStoredTenants, getStoredUsers, saveStoredUser };

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
    const sessionUser = sessionStorage.getItem('nexus_current_user');
    if (sessionUser) {
      try {
        return JSON.parse(sessionUser);
      } catch { }
    }
    const localUser = localStorage.getItem('nexus_current_user');
    if (localUser) {
      try {
        return JSON.parse(localUser);
      } catch { }
    }
    return null;
  });

  const [tenant, setTenant] = useState<Tenant | null>(() => {
    const local = localStorage.getItem('nexus_current_tenant');
    if (local) {
      try {
        return JSON.parse(local);
      } catch { }
    }
    const saved = sessionStorage.getItem('nexus_current_tenant');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch { }
    }
    return null;
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

  const isSuperAdmin = user?.role?.code === 'super_admin';

  // Derive enabled features from live tenant object
  const enabledFeatures: string[] = isSuperAdmin
    ? (Object.values(FEATURES) as string[])
    : tenant?.enabledFeatures || [];

  // Derive permissions directly from live user role
  const permissions = user?.role?.permissions || [];

  const switchPersona = async (_roleCode: RoleCode, _tenantSlug?: TenantSlug) => {
    console.warn('[Real API Mode] Persona switching is disabled. Please login with real account credentials.');
  };

  const login = async (
    email: string,
    password?: string,
    _roleCode: RoleCode = 'company_admin',
    _tenantSlug: TenantSlug = 'ghl'
  ): Promise<boolean> => {
    setLoginError(null);

    if (!password || !password.trim()) {
      setLoginError('Password is required.');
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
        setLoginError(response?.message || 'Login failed. Please check credentials.');
        return false;
      }
    } catch (error: any) {
      setLoginError(error.message || 'Unable to connect to backend API server.');
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
