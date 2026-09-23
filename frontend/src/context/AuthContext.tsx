import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, Tenant, TenantSlug, RoleCode } from '../types';
import { DEFAULT_TENANTS } from '../constants/defaultTenants';
import { SYSTEM_ROLES } from '../constants/roles';
import { FEATURES } from '../constants/features';
import { storageService } from '../services/storageService';

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
  // Use sessionStorage: preserves session during page reload/refresh,
  // but defaults to Login on new app launches / new tabs.
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
      // Also ensure legacy localStorage items don't linger
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
    if (roleCode === 'super_admin') {
      const superUser: User = {
        id: 'usr-super-01',
        name: 'Alex Rivera (Super Admin)',
        email: 'alex@nexusplatform.io',
        phone: '+91 98800 11000',
        role: SYSTEM_ROLES.super_admin,
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
      DEFAULT_TENANTS[slug] ||
      DEFAULT_TENANTS.ghl;
    setTenant(targetTenant);

    // Check if a real user exists for this tenant and role in storage
    const tenantUsers = storageService.getUsers(targetTenant.slug);
    const existingUser = tenantUsers.find(u => u.role.code === roleCode);
    if (existingUser) {
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
      role: SYSTEM_ROLES[roleCode] || SYSTEM_ROLES.company_admin,
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

    // If password provided, call real ASP.NET Core backend
    if (password) {
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
        setLoginError(error.message || 'Unable to connect to server.');
        return false;
      }
    }

    // Fallback: fast-login demo mode without password
    const allTenants = storageService.getTenants();
    const targetTenant =
      allTenants.find(t => t.slug === tenantSlug || t.id === tenantSlug) ||
      DEFAULT_TENANTS[tenantSlug] ||
      DEFAULT_TENANTS.ghl;
    setTenant(targetTenant);

    const authenticatedUser: User = {
      id: `usr-${Date.now()}`,
      name: email.split('@')[0].replace('.', ' '),
      email,
      phone: '+91 98000 00000',
      role: SYSTEM_ROLES[roleCode] || SYSTEM_ROLES.company_admin,
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
