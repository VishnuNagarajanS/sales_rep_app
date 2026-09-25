import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, Tenant, TenantSlug, RoleCode } from '../types';
import { FEATURES } from '../constants/features';
import { storageService } from '../services/storageService';
import { apiClient } from '../services/apiClient';
import { isMockMode } from '../mock/runtime/mockConfig';
import { getMockTenant, getMockPersonaUser, createMockLoginUser } from '../mock';

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
    if (isMockMode()) {
      return getMockTenant('ghl');
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

  const isSuperAdmin = user?.role.code === 'super_admin';

  // Derive enabled features from live tenant object
  const enabledFeatures = isSuperAdmin
    ? Object.values(FEATURES)
    : tenant?.enabledFeatures || [];

  // Derive permissions from live user role
  const permissions = user?.role.permissions || [];

  const switchPersona = (roleCode: RoleCode, tenantSlug?: TenantSlug) => {
    if (!isMockMode()) {
      console.warn('[DEV MODE] Persona switching is disabled in dev/API mode.');
      return;
    }

    if (roleCode === 'super_admin') {
      const superUser = getMockPersonaUser('super_admin');
      setUser(superUser);
      setTenant(null);
      return;
    }

    const slug = tenantSlug || 'ghl';
    const allTenants = storageService.getTenants();
    const targetTenant =
      allTenants.find(t => t.slug === slug || t.id === slug) ||
      getMockTenant(slug);
    setTenant(targetTenant);

    // Check if a user exists for this tenant and role in mock storage
    const tenantUsers = storageService.getUsers(targetTenant.slug);
    const existingUser = tenantUsers.find(u => u.role.code === roleCode);
    if (existingUser) {
      setUser(existingUser);
      return;
    }

    const targetUser = getMockPersonaUser(roleCode, slug, targetTenant);
    storageService.saveUser(targetUser);
    setUser(targetUser);
  };

  const login = async (
    email: string,
    password?: string,
    roleCode: RoleCode = 'company_admin',
    tenantSlug: TenantSlug = 'ghl'
  ): Promise<boolean> => {
    setLoginError(null);

    // In dev mode: strictly use backend API authentication
    if (!isMockMode()) {
      if (!password || !password.trim()) {
        setLoginError('Password is required in dev/API mode.');
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
        setLoginError(error.message || 'Unable to connect to backend server.');
        return false;
      }
    }

    // In mock mode:
    if (password) {
      try {
        const response: any = await apiClient.post('/auth/login', { email, password });
        if (response && response.success && response.data) {
          const { token, user: userData, tenant: tenantData } = response.data;
          if (token) {
            sessionStorage.setItem('nexus_auth_token', token);
            localStorage.setItem('nexus_auth_token', token);
          }
          if (userData) setUser(userData);
          if (tenantData) setTenant(tenantData);
          return true;
        }
      } catch {
        // In mock mode, if backend is not running, continue with demo auth
      }
    }

    // Mock mode demo login
    const allTenants = storageService.getTenants();
    const targetTenant =
      allTenants.find(t => t.slug === tenantSlug || t.id === tenantSlug) ||
      getMockTenant(tenantSlug);
    setTenant(targetTenant);

    const authenticatedUser = createMockLoginUser(email, roleCode, tenantSlug, targetTenant);
    storageService.saveUser(authenticatedUser);
    setUser(authenticatedUser);
    return true;
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
