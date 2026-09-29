import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, Tenant, TenantSlug, RoleCode } from '../types';
import { DEFAULT_TENANTS } from '../constants/defaultTenants';
import { SYSTEM_ROLES } from '../constants/roles';
import { FEATURES } from '../constants/features';
import { storageService } from '../services/storageService';
import { apiClient } from '../services/apiClient';
import { isMockMode } from '../config/environment';

const getStoredTenants = (): Tenant[] => {
  try {
    const raw = localStorage.getItem('nexus_tenants');
    if (raw) return JSON.parse(raw);
    if (!isMockMode()) return [];
    return [DEFAULT_TENANTS.ghl, DEFAULT_TENANTS.jamin];
  } catch {
    return isMockMode() ? [DEFAULT_TENANTS.ghl, DEFAULT_TENANTS.jamin] : [];
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
  } catch {}
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
        const parsed = JSON.parse(saved);
        if (parsed?.role?.code && SYSTEM_ROLES[parsed.role.code]) {
          parsed.role.permissions = Array.from(
            new Set([...(parsed.role.permissions || []), ...SYSTEM_ROLES[parsed.role.code].permissions])
          );
        }
        return parsed;
      } catch {
        return null;
      }
    }
    return null;
  });

  // Tenant state
  const [tenant, setTenant] = useState<Tenant | null>(() => {
    // If the restored user is a Super Admin, tenant is null unless active in support mode
    const savedUser = sessionStorage.getItem('nexus_current_user');
    if (savedUser) {
      try {
        const parsedUser = JSON.parse(savedUser);
        if (parsedUser?.role?.code === 'super_admin') {
          const supportModeTenant = sessionStorage.getItem('nexus_support_mode_tenant');
          if (supportModeTenant) {
            return JSON.parse(supportModeTenant);
          }
          return null;
        }
      } catch {}
    }
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
  // Fall back to ALL features if enabledFeatures is empty (e.g., existing DB row before seed patch ran)
  const rawFeatures = tenant?.enabledFeatures || [];
  const enabledFeatures: string[] = isSuperAdmin
    ? (Object.values(FEATURES) as string[])
    : rawFeatures.length > 0
      ? rawFeatures
      : (Object.values(FEATURES) as string[]);

  // Derive permissions directly from live user role
  // Fall back to SYSTEM_ROLES permissions if the role has no permissions set (e.g., real DB role)
  const rawPermissions = user?.role?.permissions || [];
  const systemRolePerms = user?.role?.code && SYSTEM_ROLES[user.role.code]?.permissions || [];
  const permissions = rawPermissions.length > 0 ? rawPermissions : systemRolePerms;

  const switchPersona = async (roleCode: RoleCode, tenantSlug?: TenantSlug) => {
    // In dev mode, persona switching is strictly disabled
    if (!isMockMode()) {
      console.warn('[Dev Mode] Persona switching is disabled in real API mode.');
      return;
    }

    // In mock mode, retrieve mock fixtures from registered provider
    const MOCK_ROLES = mockAuthProviderInstance?.getRoles() || SYSTEM_ROLES || {};
    const MOCK_TENANTS = mockAuthProviderInstance?.getTenants() || DEFAULT_TENANTS || {};

    if (roleCode === 'super_admin') {
      const superUser: User = {
        id: 'usr-super-01',
        name: 'Yanosh',
        email: 'yanosh@ghlindiaventures.com',
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
            ? 'Vishnu'
            : slug === 'jamin'
              ? 'Mani'
              : `${targetTenant.name} Admin`
          : roleCode === 'irm'
            ? 'Dhinakaran'
            : slug === 'ghl'
              ? 'Naveen'
              : slug === 'jamin'
                ? 'Pooja Hegde'
                : `${targetTenant.name} Agent`,
      email:
        roleCode === 'company_admin'
          ? slug === 'ghl'
            ? 'vishnu@ghlindiaventures.com'
            : 'mani@ghlindiaventures.com'
          : roleCode === 'irm'
            ? 'dhinakaran@ghlindiaventures.com'
            : slug === 'ghl'
              ? 'naveen@ghlindiaventures.com'
              : `sales@${slug}.com`,
      phone: '+91 98450 00000',
      role: MOCK_ROLES[roleCode] || MOCK_ROLES.company_admin,
      companyId: targetTenant.id,
      companySlug: slug,
      companyName: targetTenant.name,
      status: 'Active',
      lastLogin: 'Just now',
    };

    saveStoredUser(targetUser);
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

    const MOCK_ROLES = mockAuthProviderInstance?.getRoles() || SYSTEM_ROLES || {};
    const MOCK_TENANTS = mockAuthProviderInstance?.getTenants() || DEFAULT_TENANTS || {};

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

    saveStoredUser(authenticatedUser);
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
