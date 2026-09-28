import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, Tenant, TenantSlug, RoleCode } from '../types';
import { FEATURES } from '../constants/features';
import { storageService } from '../services/storageService';
import { apiClient } from '../services/apiClient';
import { isMockMode } from '../config/environment';

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

export interface MockAuthProvider {
  getRoles: () => Record<string, any>;
  getTenants: () => Record<string, any>;
}

let mockAuthProviderInstance: MockAuthProvider | null = null;

export function registerMockAuthProvider(provider: MockAuthProvider): void {
  mockAuthProviderInstance = provider;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [loginError, setLoginError] = useState<string | null>(null);

  // User session state
  const [user, setUser] = useState<User | null>(() => {
    const saved = sessionStorage.getItem('nexus_current_user');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {}
    }
    return null;
  });

  // Tenant state
  const [tenant, setTenant] = useState<Tenant | null>(() => {
    const saved = sessionStorage.getItem('nexus_current_tenant');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {}
    }
    // In mock mode only, default to GHL demo tenant if available
    if (isMockMode()) {
      const mockTenants = storageService.getTenants();
      return mockTenants.find(t => t.slug === 'ghl') || mockTenants[0] || null;
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
  const enabledFeatures = isSuperAdmin
    ? Object.values(FEATURES)
    : tenant?.enabledFeatures || [];

  // Derive permissions directly from live user role
  const permissions = user?.role?.permissions || [];

  const switchPersona = async (roleCode: RoleCode, tenantSlug?: TenantSlug) => {
    // In dev mode, persona switching is strictly disabled
    if (!isMockMode()) {
      console.warn('[Dev Mode] Persona switching is disabled in real API mode.');
      return;
    }

    // In mock mode, retrieve mock fixtures from registered provider
    const MOCK_ROLES = mockAuthProviderInstance?.getRoles() || {};
    const MOCK_TENANTS = mockAuthProviderInstance?.getTenants() || {};

    if (roleCode === 'super_admin') {
      const superUser: User = {
        id: 'usr-super-01',
        name: 'Alex Rivera (Super Admin)',
        email: 'alex@nexusplatform.io',
        phone: '+91 98800 11000',
        role: MOCK_ROLES.super_admin,
        status: 'Active',
        lastLogin: 'Just now',
      };
      setUser(superUser);
      setTenant(null);
      return;
    }

    const slug = tenantSlug || 'ghl';
    const allTenants = storageService.getTenants();
    const targetTenant =
      allTenants.find(t => t.slug === slug || t.id === slug) ||
      MOCK_TENANTS[slug] ||
      MOCK_TENANTS.ghl;
    setTenant(targetTenant);

    // Check if a real user exists for this tenant and role in mock storage
    const tenantUsers = storageService.getUsers(targetTenant.slug);
    const existingUser = tenantUsers.find(u => u.role.code === roleCode);
    if (existingUser) {
      if (MOCK_ROLES[roleCode]) {
        existingUser.role.permissions = MOCK_ROLES[roleCode].permissions;
      }
      setUser(existingUser);
      return;
    }

    const targetUser: User = {
      id: `usr-${slug}-${roleCode}`,
      name:
        roleCode === 'company_admin'
          ? slug === 'ghl'
            ? 'Vikram Malhotra'
            : slug === 'jamin'
              ? 'Kavita Rao'
              : `${targetTenant.name} Admin`
          : roleCode === 'irm'
            ? 'Rohan Varma'
            : slug === 'ghl'
              ? 'Ananya Iyer'
              : slug === 'jamin'
                ? 'Pooja Hegde'
                : `${targetTenant.name} Agent`,
      email: `${roleCode}@${slug}.com`,
      phone: '+91 98450 00000',
      role: MOCK_ROLES[roleCode] || MOCK_ROLES.company_admin,
      companyId: targetTenant.id,
      companySlug: slug,
      companyName: targetTenant.name,
      status: 'Active',
      lastLogin: 'Just now',
    };

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

    // If running in dev mode, password is required and must hit backend API
    if (!isMockMode()) {
      if (!password || !password.trim()) {
        setLoginError('Password is required in Dev / API mode.');
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
    }

    // ── MOCK MODE LOGIN ────────────────────────────────────────────────────────
    // If password provided in mock mode, attempt backend API, but if it fails or no password, support demo login
    if (password) {
      try {
        const response: any = await apiClient.post('/auth/login', { email, password });
        if (response && response.success && response.data) {
          const { token, user: userData, tenant: tenantData } = response.data;
          if (token) sessionStorage.setItem('nexus_auth_token', token);
          if (userData) setUser(userData);
          if (tenantData) setTenant(tenantData);
          return true;
        }
      } catch {
        // In mock mode, continue to demo authentication fallback
      }
    }

    const MOCK_ROLES = mockAuthProviderInstance?.getRoles() || {};
    const MOCK_TENANTS = mockAuthProviderInstance?.getTenants() || {};

    const allTenants = storageService.getTenants();
    const targetTenant =
      allTenants.find(t => t.slug === tenantSlug || t.id === tenantSlug) ||
      MOCK_TENANTS[tenantSlug] ||
      MOCK_TENANTS.ghl;
    setTenant(targetTenant);

    const authenticatedUser: User = {
      id: `usr-${Date.now()}`,
      name: email.split('@')[0].replace('.', ' '),
      email,
      phone: '+91 98000 00000',
      role: MOCK_ROLES[roleCode] || MOCK_ROLES.company_admin,
      companyId: targetTenant.id,
      companySlug: tenantSlug,
      companyName: targetTenant.name,
      status: 'Active',
      lastLogin: 'Just now',
    };

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
