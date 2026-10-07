import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { User, Tenant, TenantSlug, RoleCode } from '../types';
import { DEFAULT_TENANTS } from '../constants/defaultTenants';
import { SYSTEM_ROLES } from '../constants/roles';
import { FEATURES } from '../constants/features';
import { apiClient } from '../services/apiClient';
import { isMockMode } from '../config/environment';
import { clearKycLocalData } from '../utils/kycStorage';

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
  } catch {}
};

export function isJwtExpired(token: string | null | undefined): boolean {
  if (!token) return true;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    const parsed = JSON.parse(jsonPayload);
    if (parsed && typeof parsed.exp === 'number') {
      return parsed.exp * 1000 <= Date.now();
    }
    return false;
  } catch {
    return false;
  }
}

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
  logout: (reason?: string) => void;
  switchPersona: (roleCode: RoleCode, tenantSlug?: TenantSlug) => void;
  setUser: (user: User | null) => void;
  setTenant: (tenant: Tenant | null) => void;
  revalidateSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [loginError, setLoginError] = useState<string | null>(null);

  // User session state
  const [user, setUser] = useState<User | null>(() => {
    // Check if token exists and is expired in dev/API mode
    const token = sessionStorage.getItem('nexus_auth_token') || localStorage.getItem('nexus_auth_token');
    if (!isMockMode() && token && isJwtExpired(token)) {
      sessionStorage.removeItem('nexus_auth_token');
      sessionStorage.removeItem('nexus_current_user');
      localStorage.removeItem('nexus_auth_token');
      localStorage.removeItem('nexus_current_user');
      return null;
    }

    const saved = sessionStorage.getItem('nexus_current_user') || localStorage.getItem('nexus_current_user');
    if (saved) {
      try {
        const rawParsed = JSON.parse(saved);
        const parsed = rawParsed?.user && (rawParsed.user.id || rawParsed.user.email) ? rawParsed.user : rawParsed;
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
    const savedUser = sessionStorage.getItem('nexus_current_user') || localStorage.getItem('nexus_current_user');
    if (savedUser) {
      try {
        const rawUser = JSON.parse(savedUser);
        const parsedUser = rawUser?.user && (rawUser.user.id || rawUser.user.email) ? rawUser.user : rawUser;
        if (parsedUser?.role?.code === 'super_admin') {
          const supportModeTenant = sessionStorage.getItem('nexus_support_mode_tenant');
          if (supportModeTenant) {
            return JSON.parse(supportModeTenant);
          }
          return null;
        }
      } catch {}
    }
    const saved = sessionStorage.getItem('nexus_current_tenant') || localStorage.getItem('nexus_current_tenant');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {}
    }
    return null;
  });

  useEffect(() => {
    if (user) {
      sessionStorage.setItem('nexus_current_user', JSON.stringify(user));
      localStorage.setItem('nexus_current_user', JSON.stringify(user));
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
      localStorage.setItem('nexus_current_tenant', JSON.stringify(tenant));
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

  const switchPersona = async (_roleCode: RoleCode, _tenantSlug?: TenantSlug) => {
    console.warn('Persona switching is disabled in production API mode.');
  };

  const login = async (
    email: string,
    password?: string,
    _roleCode: RoleCode = 'company_admin',
    _tenantSlug: TenantSlug = 'ghl'
  ): Promise<boolean> => {
    setLoginError(null);

    if (!email || !email.trim()) {
      setLoginError('Email is required.');
      return false;
    }

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

  const logout = (reason?: string) => {
    sessionStorage.removeItem('nexus_auth_token');
    sessionStorage.removeItem('nexus_current_user');
    sessionStorage.removeItem('nexus_current_tenant');
    sessionStorage.removeItem('nexus_current_route');
    sessionStorage.removeItem('nexus_has_armed_trap');
    localStorage.removeItem('nexus_auth_token');
    localStorage.removeItem('nexus_current_user');
    localStorage.removeItem('nexus_current_tenant');
    clearKycLocalData();
    setLoginError(reason || null);
    setUser(null);
    setTenant(null);
    try {
      window.history.replaceState({ unauth: true }, '', '/login');
    } catch {}
  };

  const userRef = useRef<User | null>(user);
  userRef.current = user;

  const lastRevalidationRef = useRef<number>(0);
  const isRevalidatingRef = useRef<boolean>(false);

  const revalidateSession = async () => {
    if (!userRef.current || isMockMode() || isRevalidatingRef.current) return;
    const token = sessionStorage.getItem('nexus_auth_token') || localStorage.getItem('nexus_auth_token');
    if (!token || isJwtExpired(token)) {
      logout();
      return;
    }
    isRevalidatingRef.current = true;
    try {
      const res: any = await apiClient.get('/auth/me');
      if (res && res.success && res.data) {
        // Backend returns ApiResponse<LoginResponseDto> which is { user: UserDto, tenant: TenantDto }
        const userData: User | null = res.data.user || (res.data.id ? res.data : null);
        const tenantData: Tenant | null = res.data.tenant || null;

        // Check if user status is suspended/disabled from the response
        if (userData?.status && userData.status.toLowerCase() !== 'active') {
          logout('Your account has been suspended by an administrator.');
          return;
        }

        if (userData) {
          if (userData.role?.code && SYSTEM_ROLES[userData.role.code]) {
            userData.role.permissions = Array.from(
              new Set([...(userData.role.permissions || []), ...(SYSTEM_ROLES[userData.role.code].permissions || [])])
            );
          }
          const prev = userRef.current;
          const changed =
            !prev ||
            prev.id !== userData.id ||
            prev.status !== userData.status ||
            prev.name !== userData.name ||
            prev.email !== userData.email ||
            prev.role?.code !== userData.role?.code ||
            prev.companyId !== userData.companyId;

          if (changed) {
            setUser(userData);
          }
        }

        if (userData?.role?.code === 'super_admin') {
          const supportModeTenant = sessionStorage.getItem('nexus_support_mode_tenant');
          if (supportModeTenant) {
            try {
              setTenant(JSON.parse(supportModeTenant));
            } catch {
              setTenant(null);
            }
          } else {
            setTenant(null);
          }
        } else if (tenantData) {
          setTenant((prevTenant) => {
            if (
              !prevTenant ||
              prevTenant.id !== tenantData.id ||
              prevTenant.status !== tenantData.status ||
              prevTenant.name !== tenantData.name
            ) {
              return tenantData;
            }
            return prevTenant;
          });
        }
      }
    } catch {
      // 401 triggers nexus_auth_unauthorized automatically via apiClient
    } finally {
      isRevalidatingRef.current = false;
    }
  };

  useEffect(() => {
    const checkSuspensionAndLogout = (payload: { userId?: string; email?: string }) => {
      const currentUser = userRef.current;
      if (!currentUser) return;
      const matchId = payload.userId && String(currentUser.id) === String(payload.userId);
      const matchEmail =
        payload.email && currentUser.email && currentUser.email.toLowerCase() === payload.email.toLowerCase();
      if (matchId || matchEmail) {
        logout('Your account has been suspended by an administrator.');
      }
    };

    let bc: BroadcastChannel | null = null;
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        bc = new BroadcastChannel('nexus_auth_channel');
        bc.onmessage = (event) => {
          if (event.data?.type === 'ACCOUNT_SUSPENDED') {
            checkSuspensionAndLogout(event.data);
          }
        };
      }
    } catch {}

    const handleStorageEvent = (e: StorageEvent) => {
      // Multi-tab synchronization
      if (e.key === 'nexus_auth_token') {
        if (!e.newValue) {
          // Another tab logged out -> Log out this tab cleanly
          logout();
        } else if (e.newValue !== sessionStorage.getItem('nexus_auth_token')) {
          // Another tab changed active session
          sessionStorage.setItem('nexus_auth_token', e.newValue);
          const rawUser = localStorage.getItem('nexus_current_user');
          if (rawUser) {
            try {
              const raw = JSON.parse(rawUser);
              const u = raw?.user && (raw.user.id || raw.user.email) ? raw.user : raw;
              if (u) {
                if (u.role?.code && SYSTEM_ROLES[u.role.code]) {
                  u.role.permissions = Array.from(
                    new Set([...(u.role.permissions || []), ...(SYSTEM_ROLES[u.role.code].permissions || [])])
                  );
                }
                setUser(u);
              }
            } catch {}
          }
          const rawTenant = localStorage.getItem('nexus_current_tenant');
          if (rawTenant) {
            try {
              setTenant(JSON.parse(rawTenant));
            } catch {}
          }
        }
      } else if (e.key === 'nexus_account_suspended' && e.newValue) {
        try {
          const payload = JSON.parse(e.newValue);
          checkSuspensionAndLogout(payload);
        } catch {}
      }
    };

    const handleUnauthorized = () => {
      logout('Your account has been suspended by an administrator.');
    };

    const handleRevalidate = () => {
      if (!userRef.current) return;
      const now = Date.now();
      if (now - lastRevalidationRef.current < 5000) return;
      lastRevalidationRef.current = now;
      revalidateSession();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        handleRevalidate();
      }
    };

    window.addEventListener('storage', handleStorageEvent);
    window.addEventListener('nexus_auth_unauthorized', handleUnauthorized);
    window.addEventListener('focus', handleRevalidate);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Initial session revalidation on mount (e.g. for offline sessions)
    if (userRef.current && !isMockMode()) {
      revalidateSession();
    }

    // Background session watchdog heartbeat (SignalR provides instant real-time suspension/revocation push)
    const intervalId = setInterval(() => {
      if (userRef.current && !isMockMode()) {
        revalidateSession();
      }
    }, 60000);

    return () => {
      clearInterval(intervalId);
      try {
        bc?.close();
      } catch {}
      window.removeEventListener('storage', handleStorageEvent);
      window.removeEventListener('nexus_auth_unauthorized', handleUnauthorized);
      window.removeEventListener('focus', handleRevalidate);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

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
        revalidateSession,
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
