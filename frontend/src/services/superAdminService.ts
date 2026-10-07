import {
  Tenant,
  User,
  Role,
  PermissionGroup,
  PermissionItem,
  AuditLog,
  SubscriptionPackage,
  TenantDidMapping,
  PlatformCarrierSettings,
  SystemDiagnostics,
  BroadcastAnnouncement,
  PlatformMetrics,
  SystemHealthReport,
  GlobalConfig,
} from '../types';
import { DEFAULT_TENANTS } from '../constants/defaultTenants';
import { SYSTEM_ROLES } from '../constants/roles';
import { FEATURES } from '../constants/features';
import { apiClient, ApiResponse, PagedResult } from './apiClient';
import { isMockMode } from '../config/environment';
import { storageService } from './storageService';

// Storage Keys
const STORAGE_KEYS = {
  TENANTS: 'nexus_tenants',
  USERS: 'nexus_users',
  ROLES: 'nexus_system_roles',
  PACKAGES: 'nexus_admin_packages',
  DIDS: 'nexus_admin_dids',
  CARRIER_SETTINGS: 'nexus_admin_carrier_settings',
  AUDIT_LOGS: 'nexus_audit_logs',
  ANNOUNCEMENTS: 'nexus_admin_announcements',
  MAINTENANCE_MODE: 'nexus_admin_maintenance_mode',
  METRICS: 'nexus_platform_metrics',
};

export interface SecurityOverviewDto {
  activeSessionsCount: number;
  failedLogins24h: number;
  securityEvents24h: number;
  mfaEnabledUsersCount: number;
}

export interface UserSessionDto {
  id: number;
  userId: number;
  userName: string;
  userEmail: string;
  roleCode: string;
  tokenId: string;
  ipAddress?: string;
  userAgent?: string;
  device?: string;
  location?: string;
  isActive: boolean;
  isCurrentSession?: boolean;
  isCurrent?: boolean;
  createdAt: string;
  lastActivityAt?: string;
  revokedAt?: string;
  revokedReason?: string;
}

export interface SecurityEventDto {
  id: number;
  eventType: string;
  severity: string;
  description?: string;
  details?: string;
  actorEmail?: string;
  userEmail?: string;
  userId?: number;
  ipAddress?: string;
  timestamp: string;
}

export interface MfaStatusDto {
  isTwoFactorEnabled: boolean;
  remainingRecoveryCodes: number;
  userEmail?: string;
}

export interface MfaSetupResponseDto {
  secret: string;
  qrCodeUri: string;
  manualEntryKey: string;
  recoveryCodes: string[];
}

// Dispatch storage update helper with debounce
let adminUpdateDebounceTimer: any = null;
export const notifyAdminStorageUpdated = () => {
  if (typeof window !== 'undefined') {
    if (adminUpdateDebounceTimer) clearTimeout(adminUpdateDebounceTimer);
    adminUpdateDebounceTimer = setTimeout(() => {
      window.dispatchEvent(new Event('nexus_admin_updated'));
    }, 150);
  }
};

// ============================================================================
// Service Implementation
// ============================================================================

export class SuperAdminService {
  // ── TENANTS / COMPANIES ───────────────────────────────────────────────────

  async fetchTenantsFromApi(): Promise<Tenant[]> {
    const res = await apiClient.get<ApiResponse<Tenant[]>>('/super-admin/tenants');
    if (res && res.data) {
      localStorage.setItem(STORAGE_KEYS.TENANTS, JSON.stringify(res.data));
      return res.data;
    }
    throw new Error(res?.message || 'Failed to fetch organizations from backend database.');
  }

  getTenants(): Tenant[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.TENANTS);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  getTenantById(id: string): Tenant | undefined {
    return this.getTenants().find(t => t.id === id || t.slug === id);
  }

  async createTenantApi(
    tenantData: Partial<Tenant>,
    adminUserData?: { name: string; email: string; phone?: string; password?: string },
    didData?: { phoneNumber?: string; routingStrategy?: string; queueName?: string }
  ): Promise<Tenant> {
    const cleanSlug = (tenantData.slug || tenantData.name || 'tenant')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');

    const payload = {
      name: tenantData.name,
      legalName: tenantData.legalName || tenantData.name,
      slug: cleanSlug,
      industry: tenantData.industry,
      tagline: tenantData.tagline,
      brandColor: tenantData.brandColor,
      timezone: tenantData.timezone,
      currency: tenantData.currency,
      businessHours: tenantData.businessHours,
      subscriptionPlan: tenantData.subscriptionPlan,
      status: tenantData.status || 'Active',
      leadSla: tenantData.leadSla,
      callEnabled: tenantData.callEnabled ?? true,
      recordingEnabled: tenantData.recordingEnabled ?? true,
      transcriptionEnabled: tenantData.transcriptionEnabled ?? true,
      enabledFeatures: tenantData.enabledFeatures,
      adminUser: adminUserData && adminUserData.email ? {
        name: adminUserData.name,
        email: adminUserData.email,
        phone: adminUserData.phone,
        password: adminUserData.password,
      } : undefined,
      did: didData && didData.phoneNumber ? {
        phoneNumber: didData.phoneNumber,
        routingStrategy: didData.routingStrategy,
        queueName: didData.queueName,
      } : undefined,
    };

    const res = await apiClient.post<ApiResponse<Tenant>>('/super-admin/tenants', payload);
    if (!res || !res.data) {
      throw new Error(res?.message || 'Failed to create organization');
    }

    await this.fetchTenantsFromApi();
    notifyAdminStorageUpdated();
    return res.data;
  }

  async updateTenantApi(tenant: Tenant): Promise<Tenant> {
    const payload = {
      name: tenant.name,
      legalName: tenant.legalName,
      slug: tenant.slug,
      industry: tenant.industry,
      tagline: tenant.tagline,
      brandColor: tenant.brandColor,
      timezone: tenant.timezone,
      currency: tenant.currency,
      businessHours: tenant.businessHours,
      subscriptionPlan: tenant.subscriptionPlan,
      status: tenant.status,
      leadSla: tenant.leadSla,
      callEnabled: tenant.callEnabled,
      recordingEnabled: tenant.recordingEnabled,
      transcriptionEnabled: tenant.transcriptionEnabled,
      enabledFeatures: tenant.enabledFeatures,
    };

    const res = await apiClient.put<ApiResponse<Tenant>>(`/super-admin/tenants/${tenant.id}`, payload);
    if (!res || !res.data) {
      throw new Error(res?.message || 'Failed to update organization');
    }

    await this.fetchTenantsFromApi();
    notifyAdminStorageUpdated();
    return res.data;
  }

  async toggleTenantStatusApi(id: string, status: 'Active' | 'Inactive' | 'Suspended'): Promise<Tenant> {
    const res = await apiClient.patch<ApiResponse<Tenant>>(`/super-admin/tenants/${id}/status`, { status });
    if (!res || !res.data) {
      throw new Error(res?.message || 'Failed to update organization status');
    }

    await this.fetchTenantsFromApi();
    notifyAdminStorageUpdated();
    return res.data;
  }

  async deleteTenantApi(id: string): Promise<boolean> {
    const res = await apiClient.delete<ApiResponse<boolean>>(`/super-admin/tenants/${id}`);
    await this.fetchTenantsFromApi();
    notifyAdminStorageUpdated();
    return res?.data ?? true;
  }

  createTenant(
    tenantData: Partial<Tenant>,
    adminUserData?: { name: string; email: string; phone?: string; password?: string },
    didData?: { phoneNumber?: string; routingStrategy?: string }
  ): Tenant {
    this.createTenantApi(tenantData, adminUserData, didData).catch(err => {
      console.error('Async createTenantApi error:', err);
    });

    const tenants = this.getTenants();
    const cleanSlug = (tenantData.slug || tenantData.name || 'tenant')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');

    const newId = String(Date.now());
    const newTenant: Tenant = {
      id: newId,
      name: tenantData.name || 'New Organization',
      slug: cleanSlug || `tenant-${Date.now().toString().slice(-4)}`,
      brandColor: tenantData.brandColor || '#8b5cf6',
      tagline: tenantData.tagline || 'Enterprise Sales Organization',
      enabledFeatures: tenantData.enabledFeatures || [
        FEATURES.LEADS,
        FEATURES.CUSTOMERS,
        FEATURES.DEALS,
        FEATURES.CALLS,
        FEATURES.REPORTS,
      ],
      timezone: tenantData.timezone || 'Asia/Kolkata (IST)',
      currency: tenantData.currency || '₹ INR',
      businessHours: tenantData.businessHours || '09:30 AM - 06:30 PM IST',
      industry: tenantData.industry || 'Commercial Real Estate',
      legalName: tenantData.legalName || tenantData.name,
      status: (tenantData.status as any) || 'Active',
      subscriptionPlan: tenantData.subscriptionPlan || 'Starter CRM Tier',
      callEnabled: true,
      recordingEnabled: true,
      transcriptionEnabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...tenantData,
    };

    tenants.push(newTenant);
    localStorage.setItem(STORAGE_KEYS.TENANTS, JSON.stringify(tenants));
    notifyAdminStorageUpdated();
    return newTenant;
  }

  updateTenant(tenant: Tenant): Tenant {
    this.updateTenantApi(tenant).catch(err => {
      console.error('Async updateTenantApi error:', err);
    });

    const tenants = this.getTenants();
    const idx = tenants.findIndex(t => t.id === tenant.id);
    const updated: Tenant = {
      ...tenant,
      updatedAt: new Date().toISOString(),
    };

    if (idx >= 0) {
      tenants[idx] = updated;
    } else {
      tenants.push(updated);
    }

    localStorage.setItem(STORAGE_KEYS.TENANTS, JSON.stringify(tenants));
    notifyAdminStorageUpdated();
    return updated;
  }

  toggleTenantStatus(id: string, status: 'Active' | 'Inactive' | 'Suspended'): Tenant | undefined {
    this.toggleTenantStatusApi(id, status).catch(err => {
      console.error('Async toggleTenantStatusApi error:', err);
    });

    const tenants = this.getTenants();
    const tenant = tenants.find(t => t.id === id);
    if (!tenant) return undefined;

    tenant.status = status;
    tenant.updatedAt = new Date().toISOString();
    localStorage.setItem(STORAGE_KEYS.TENANTS, JSON.stringify(tenants));
    notifyAdminStorageUpdated();
    return tenant;
  }

  deleteTenant(id: string): boolean {
    this.deleteTenantApi(id).catch(err => {
      console.error('Async deleteTenantApi error:', err);
    });

    const tenants = this.getTenants();
    const target = tenants.find(t => t.id === id);
    if (!target) return false;

    const filtered = tenants.filter(t => t.id !== id);
    localStorage.setItem(STORAGE_KEYS.TENANTS, JSON.stringify(filtered));
    notifyAdminStorageUpdated();
    return true;
  }

  /**
   * Calculates real-time telemetry stats for an organization or company tenant.
   * - usersCount: represents real Active Reps (active users with sales_executive/irm or other rep roles,
   *   strictly excluding admins and inactive accounts).
   * - For an Organization: aggregates active reps across all of its child companies/tenants.
   * - For a Company (or specific companyId): isolates only active reps assigned to that specific company.
   * - Guarantees strict organization and company isolation.
   */
  getTenantStats(target: string | Tenant, specificCompanyId?: string): {
    usersCount: number;
    activeUsersCount: number;
    didsCount: number;
  } {
    // 1. Resolve target tenant entity
    let tenant: Tenant | undefined;
    if (typeof target === 'object' && target !== null) {
      tenant = target as Tenant;
    } else if (typeof target === 'string') {
      const targetStr = target.trim().toLowerCase();
      tenant = this.getTenants().find(t =>
        String(t.id).trim().toLowerCase() === targetStr ||
        (t.slug && t.slug.toLowerCase().trim() === targetStr) ||
        (t.name && t.name.toLowerCase().trim() === targetStr)
      );
      if (!tenant) {
        tenant = { id: target, slug: target, name: target, enabledFeatures: [], brandColor: '#8b5cf6', tagline: '', timezone: '', currency: '', businessHours: '' };
      }
    }

    const tenantIdStr = tenant ? String(tenant.id || '').trim().toLowerCase() : '';
    const tenantSlugStr = tenant?.slug ? tenant.slug.toLowerCase().trim() : '';
    const tenantNameStr = tenant?.name ? tenant.name.toLowerCase().trim() : '';

    // 2. Fetch all users from application storage/cache
    const allUsers = this.getUsers();

    // 3. Helper: check if a user is Active
    const isActive = (u: User): boolean => {
      if (!u) return false;
      const st = (u.status || '').toString().toLowerCase().trim();
      return st === 'active';
    };

    // 4. Helper: check if a user qualifies as an operational Rep
    const isRep = (u: User): boolean => {
      if (!u || !u.role) return false;
      const roleCode = (u.role.code || '').toLowerCase().trim();

      // Strictly exclude Super Admin, Company Admin, and general Admins
      if (
        roleCode === 'super_admin' ||
        roleCode === 'company_admin' ||
        roleCode === 'admin' ||
        roleCode === 'platform_admin'
      ) {
        return false;
      }

      // Operational rep roles: Sales Executive, IRM, or other supported rep designations
      return (
        roleCode === 'sales_executive' ||
        roleCode === 'irm' ||
        roleCode === 'sales_rep' ||
        roleCode === 'agent' ||
        roleCode.includes('rep') ||
        roleCode.includes('executive')
      );
    };

    // 5. Tenant identity helpers for strict isolation
    const isGhlTarget =
      tenantSlugStr === 'ghl' ||
      tenantIdStr === '1' ||
      tenantIdStr === 't-ghl-01' ||
      tenantNameStr.includes('ghl');

    const isJaminTarget =
      tenantSlugStr === 'jamin' ||
      tenantIdStr === '2' ||
      tenantIdStr === 't-jamin-02' ||
      tenantNameStr.includes('jamin');

    const isGhlUser = (u: User): boolean => {
      if (!u) return false;
      const cId = String(u.companyId || '').trim().toLowerCase();
      const cSlug = String(u.companySlug || '').toLowerCase().trim();
      const cName = (u.companyName || '').toLowerCase().trim();

      if (cId === '2' || cId === 't-jamin-02' || cSlug === 'jamin' || cName.includes('jamin')) {
        return false;
      }
      return cId === '1' || cId === 't-ghl-01' || cSlug === 'ghl' || cName.includes('ghl');
    };

    const isJaminUser = (u: User): boolean => {
      if (!u) return false;
      const cId = String(u.companyId || '').trim().toLowerCase();
      const cSlug = String(u.companySlug || '').toLowerCase().trim();
      const cName = (u.companyName || '').toLowerCase().trim();

      if (cId === '1' || cId === 't-ghl-01' || cSlug === 'ghl' || cName.includes('ghl')) {
        return false;
      }
      return cId === '2' || cId === 't-jamin-02' || cSlug === 'jamin' || cName.includes('jamin');
    };

    // 6. Collect child companies if target is an organization
    const allTenants = this.getTenants();
    const rawCompanies = (tenant as any)?.companies;
    const childCompanies: Array<{ id: string; slug?: string; name?: string }> = [];

    if (Array.isArray(rawCompanies)) {
      rawCompanies.forEach((c: any) => {
        if (typeof c === 'string') {
          childCompanies.push({ id: c, slug: c });
        } else if (c && typeof c === 'object') {
          childCompanies.push({
            id: String(c.id || c.slug || ''),
            slug: c.slug,
            name: c.name,
          });
        }
      });
    }

    // Look for tenants in allTenants that have this tenant as parent
    allTenants.forEach(t => {
      const parentId = String(
        t.organizationId ||
        (t as any).parentTenantId ||
        (t as any).parentId ||
        ''
      ).trim().toLowerCase();
      const parentSlug = ((t as any).organizationSlug || '').toLowerCase().trim();

      if (
        (tenantIdStr && parentId === tenantIdStr) ||
        (tenantSlugStr && parentSlug === tenantSlugStr)
      ) {
        if (!childCompanies.some(c => c.id === String(t.id))) {
          childCompanies.push({ id: String(t.id), slug: t.slug, name: t.name });
        }
      }
    });

    const isOrganizationWithChildren = childCompanies.length > 0 || (tenant as any)?.isOrganization === true;

    // Helper: does user match a specific company?
    const userMatchesCompany = (u: User, compIdOrSlug: string): boolean => {
      if (!u || !compIdOrSlug) return false;
      const targetStr = compIdOrSlug.trim().toLowerCase();
      const uCompId = String(u.companyId || '').trim().toLowerCase();
      const uCompSlug = String(u.companySlug || '').toLowerCase().trim();
      const uCompName = (u.companyName || '').toLowerCase().trim();

      // Check GHL / Jamin isolation
      if (targetStr === '1' || targetStr === 't-ghl-01' || targetStr === 'ghl') {
        return isGhlUser(u);
      }
      if (targetStr === '2' || targetStr === 't-jamin-02' || targetStr === 'jamin') {
        return isJaminUser(u);
      }

      return (
        (uCompId !== '' && uCompId === targetStr) ||
        (uCompSlug !== '' && uCompSlug === targetStr) ||
        (uCompName !== '' && uCompName === targetStr)
      );
    };

    // 7. Filter active reps based on organization vs company level
    let activeReps: User[] = [];

    if (specificCompanyId) {
      // COMPANY-LEVEL COUNT (Specific company requested)
      activeReps = allUsers.filter(u => {
        if (!isActive(u) || !isRep(u)) return false;

        // Ensure user belongs to the specified company
        if (!userMatchesCompany(u, specificCompanyId)) return false;

        // Organization isolation: if parent org is known, user must not belong to a different org
        if (tenantIdStr) {
          const userOrgId = String(u.organizationId || '').trim().toLowerCase();
          if (userOrgId && userOrgId !== tenantIdStr && (!tenantSlugStr || userOrgId !== tenantSlugStr)) {
            return false;
          }
        }
        return true;
      });
    } else if (isOrganizationWithChildren) {
      // ORGANIZATION-LEVEL COUNT (Total active reps across all child companies of this organization)
      activeReps = allUsers.filter(u => {
        if (!isActive(u) || !isRep(u)) return false;

        // User belongs to this organization directly...
        const userOrgId = String(u.organizationId || '').trim().toLowerCase();
        const userOrgSlug = ((u as any).organizationSlug || '').toLowerCase().trim();
        const directOrgMatch =
          (tenantIdStr && userOrgId === tenantIdStr) ||
          (tenantSlugStr && userOrgSlug === tenantSlugStr) ||
          (tenantIdStr && String(u.companyId || '').trim().toLowerCase() === tenantIdStr) ||
          (tenantSlugStr && (u.companySlug || '').toLowerCase().trim() === tenantSlugStr);

        // ...or belongs to one of its child companies
        const childCompMatch = childCompanies.some(c =>
          userMatchesCompany(u, c.id) || (c.slug && userMatchesCompany(u, c.slug)) || (c.name && userMatchesCompany(u, c.name))
        );

        if (!directOrgMatch && !childCompMatch) {
          return false;
        }

        // Strict organization isolation: reject if assigned to a different explicit organization
        if (userOrgId && tenantIdStr && userOrgId !== tenantIdStr && (!tenantSlugStr || userOrgId !== tenantSlugStr)) {
          return false;
        }

        return true;
      });
    } else {
      // COMPANY-LEVEL / STANDALONE TENANT COUNT
      activeReps = allUsers.filter(u => {
        if (!isActive(u) || !isRep(u)) return false;

        if (isGhlTarget) {
          return isGhlUser(u);
        }
        if (isJaminTarget) {
          return isJaminUser(u);
        }

        // General standalone company match
        const uCompId = String(u.companyId || '').trim().toLowerCase();
        const uCompSlug = (u.companySlug || '').toLowerCase().trim();
        const uCompName = (u.companyName || '').toLowerCase().trim();

        const matchesThis =
          (tenantIdStr && uCompId === tenantIdStr) ||
          (tenantSlugStr && uCompSlug === tenantSlugStr) ||
          (tenantNameStr && uCompName === tenantNameStr);

        if (!matchesThis) return false;

        // Never combine users from unrelated organizations
        const userOrgId = String(u.organizationId || '').trim().toLowerCase();
        const tenantParentOrg = String(tenant?.organizationId || (tenant as any)?.parentTenantId || '').trim().toLowerCase();
        if (userOrgId && tenantParentOrg && userOrgId !== tenantParentOrg) {
          return false;
        }

        return true;
      });
    }

    // 8. DIDs count (preserve existing functionality)
    const dids = this.getDidMappings().filter(
      d =>
        d.tenantId === String(tenant?.id || '') ||
        d.tenantId === tenant?.slug ||
        (specificCompanyId && (d.tenantId === specificCompanyId || (d as any).companyId === specificCompanyId))
    );

    const count = activeReps.length;

    return {
      usersCount: count,
      activeUsersCount: count,
      didsCount: dids.length,
    };
  }

  // ── USERS ─────────────────────────────────────────────────────────────────

  async fetchUsersPagedFromApi(filters?: {
    companyId?: string;
    roleCode?: string;
    status?: string;
    search?: string;
    page?: number;
    pageSize?: number;
    sortBy?: string;
    sortDir?: string;
  }): Promise<PagedResult<User>> {
    const res = await apiClient.get<ApiResponse<any>>('/super-admin/users', filters);
    if (!res || !res.data) {
      throw new Error(res?.message || 'Failed to fetch users from database.');
    }
    const data = res.data;
    if (Array.isArray(data)) {
      return {
        items: data,
        totalCount: data.length,
        pageNumber: 1,
        pageSize: data.length,
        totalPages: 1,
      };
    }
    return {
      items: data.items || [],
      totalCount: data.totalCount ?? 0,
      pageNumber: data.page ?? data.pageNumber ?? 1,
      pageSize: data.pageSize ?? 25,
      totalPages: data.totalPages ?? 1,
    };
  }

  async fetchUsersFromApi(filters?: { companyId?: string; roleCode?: string; status?: string; search?: string }): Promise<User[]> {
    const paged = await this.fetchUsersPagedFromApi({ ...filters, page: 1, pageSize: 200 });
    if (!filters || Object.keys(filters).length === 0) {
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(paged.items));
    }
    return paged.items;
  }

  async createUserApi(userData: Partial<User>, initialPassword?: string): Promise<User & { temporaryPassword?: string }> {
    const res = await apiClient.post<ApiResponse<User & { temporaryPassword?: string }>>('/super-admin/users', {
      name: userData.name,
      email: userData.email,
      phone: userData.phone,
      password: initialPassword,
      roleCode: userData.role?.code || 'company_admin',
      companyId: userData.companyId,
      designation: userData.designation,
      employeeCode: userData.employeeCode,
      status: userData.status || 'Active',
    });
    if (!res || !res.data) {
      throw new Error(res?.message || 'Failed to provision user in database.');
    }
    notifyAdminStorageUpdated();
    return res.data;
  }

  async updateUserApi(id: string, updates: Partial<User>): Promise<User | undefined> {
    const res = await apiClient.put<ApiResponse<User>>(`/super-admin/users/${id}`, {
      name: updates.name,
      email: updates.email,
      phone: updates.phone,
      roleCode: updates.role?.code,
      companyId: updates.companyId,
      designation: updates.designation,
      status: updates.status,
    });
    if (!res || !res.data) {
      throw new Error(res?.message || 'Failed to update user profile in database.');
    }
    if (updates.status === 'Disabled') {
      const suspensionEvent = { userId: String(id), email: updates.email, timestamp: Date.now() };
      localStorage.setItem('nexus_account_suspended', JSON.stringify(suspensionEvent));
      try {
        if (typeof BroadcastChannel !== 'undefined') {
          const bc = new BroadcastChannel('nexus_auth_channel');
          bc.postMessage({ type: 'ACCOUNT_SUSPENDED', ...suspensionEvent });
          bc.close();
        }
      } catch {}
    }
    notifyAdminStorageUpdated();
    return res.data;
  }

  async toggleUserStatusApi(id: string, status: 'Active' | 'Invited' | 'Disabled'): Promise<User | undefined> {
    return this.updateUserApi(id, { status });
  }

  async deleteUserApi(id: string): Promise<boolean> {
    const res = await apiClient.delete<ApiResponse<boolean>>(`/super-admin/users/${id}`);
    if (!res || !res.data) {
      throw new Error(res?.message || 'Failed to delete user from database.');
    }
    notifyAdminStorageUpdated();
    return true;
  }

  async resetUserPasswordApi(id: string): Promise<{ success: boolean; tempPassword?: string }> {
    const res = await apiClient.post<ApiResponse<{ tempPassword: string }>>(`/super-admin/users/${id}/reset-password`);
    if (!res || !res.data) {
      throw new Error(res?.message || 'Failed to generate temporary credentials.');
    }
    return { success: true, tempPassword: res.data.tempPassword };
  }

  getUsers(filters?: { companyId?: string; roleCode?: string; status?: string; search?: string }): User[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.USERS);
      let users: User[] = raw ? JSON.parse(raw) : [];


      if (!filters) return users;

      return users.filter(u => {
        if (filters.companyId && filters.companyId !== 'all') {
          if (filters.companyId === 'global') {
            if (u.companyId) return false;
          } else {
            const isGhlTarget = filters.companyId === '1' || filters.companyId === 't-ghl-01' || filters.companyId.toLowerCase() === 'ghl';
            const isJaminTarget = filters.companyId === '2' || filters.companyId === 't-jamin-02' || filters.companyId.toLowerCase() === 'jamin';

            const isGhlUser = u.companyId === '1' || u.companyId === 't-ghl-01' || u.companySlug === 'ghl' || (u.companyName && u.companyName.toLowerCase().includes('ghl'));
            const isJaminUser = u.companyId === '2' || u.companyId === 't-jamin-02' || u.companySlug === 'jamin' || (u.companyName && u.companyName.toLowerCase().includes('jamin'));

            if (isGhlTarget) {
              if (!isGhlUser || isJaminUser) return false;
            } else if (isJaminTarget) {
              if (!isJaminUser || isGhlUser) return false;
            } else {
              if (u.companyId !== filters.companyId && u.companySlug !== filters.companyId) return false;
            }
          }
        }
        if (filters.roleCode && filters.roleCode !== 'all' && u.role.code !== filters.roleCode) return false;
        if (filters.status && filters.status !== 'all' && u.status !== filters.status) return false;
        if (filters.search) {
          const s = filters.search.toLowerCase();
          const matchName = u.name.toLowerCase().includes(s);
          const matchEmail = u.email.toLowerCase().includes(s);
          const matchPhone = u.phone.toLowerCase().includes(s);
          const matchCompany = (u.companyName || '').toLowerCase().includes(s);
          if (!matchName && !matchEmail && !matchPhone && !matchCompany) return false;
        }
        return true;
      });
    } catch {
      return [];
    }
  }

  getUserById(id: string): User | undefined {
    return this.getUsers().find(u => u.id === id);
  }

  createUser(userData: Partial<User>, initialPassword?: string): User {
    const users = this.getUsers();
    const newId = `usr-${Date.now().toString().slice(-6)}`;

    // Resolve company name if companyId provided
    let companyName = userData.companyName;
    let companySlug = userData.companySlug;
    if (userData.companyId && !companyName) {
      const tenant = this.getTenantById(userData.companyId);
      if (tenant) {
        companyName = tenant.name;
        companySlug = tenant.slug;
      }
    }

    // Service-level rule: Super Admin can ONLY provision Company Admin for tenant organizations.
    // Operational roles (Sales Executive and IRM) are reserved for Company Admin creation.
    let resolvedRole = userData.role;
    if (userData.companyId) {
      resolvedRole = SYSTEM_ROLES.company_admin;
    } else if (!resolvedRole) {
      resolvedRole = SYSTEM_ROLES.super_admin;
    }

    const newUser: User = {
      id: newId,
      name: userData.name || 'New User',
      email: (userData.email || '').toLowerCase().trim(),
      phone: userData.phone || '+91 98000 00000',
      companyId: userData.companyId,
      companySlug,
      companyName,
      status: (userData.status as any) || 'Active',
      lastLogin: 'Never (Invited)',
      designation: userData.designation || (userData.companyId ? 'Company Administrator' : 'Platform Administrator'),
      employeeCode: userData.employeeCode || `EMP-${Date.now().toString().slice(-4)}`,
      createdAt: new Date().toISOString(),
      ...userData,
      role: resolvedRole,
    };

    users.push(newUser);
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));

    this.addAuditLog({
      action: 'PROVISION_USER',
      entityType: 'User',
      entityId: newUser.id,
      companyId: newUser.companyId,
      companyName: newUser.companyName || 'Platform Console',
      details: `Super Admin provisioned user account: "${newUser.name}" (${newUser.email}) with role [${newUser.role.name}].`,
      module: 'Users',
      status: 'success',
      afterValue: newUser,
    });

    notifyAdminStorageUpdated();
    return newUser;
  }

  updateUser(id: string, updates: Partial<User>): User | undefined {
    const users = this.getUsers();
    const idx = users.findIndex(u => u.id === id);
    if (idx === -1) return undefined;

    const before = { ...users[idx] };
    const updated: User = {
      ...users[idx],
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    users[idx] = updated;
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));

    this.addAuditLog({
      action: 'UPDATE_USER',
      entityType: 'User',
      entityId: id,
      companyId: updated.companyId,
      companyName: updated.companyName,
      details: `Super Admin modified user profile for "${updated.name}" (${updated.email}).`,
      module: 'Users',
      status: 'success',
      beforeValue: before,
      afterValue: updated,
    });

    notifyAdminStorageUpdated();
    return updated;
  }

  toggleUserStatus(id: string, status: 'Active' | 'Invited' | 'Disabled'): User | undefined {
    const users = this.getUsers();
    const user = users.find(u => u.id === id);
    if (!user) return undefined;

    const prev = user.status;
    user.status = status;
    user.updatedAt = new Date().toISOString();

    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));

    this.addAuditLog({
      action: 'STATUS_CHANGE',
      entityType: 'User',
      entityId: id,
      companyId: user.companyId,
      companyName: user.companyName,
      details: `User status for "${user.name}" changed from ${prev} to ${status}.`,
      module: 'Users',
      status: 'success',
      beforeValue: { status: prev },
      afterValue: { status },
    });

    notifyAdminStorageUpdated();
    return user;
  }

  resetUserPassword(id: string, newPassword?: string): { success: boolean; tempPassword?: string } {
    const user = this.getUserById(id);
    if (!user) return { success: false };

    const generatedPassword = newPassword || `Nexus#${Math.floor(100000 + Math.random() * 900000)}`;

    this.addAuditLog({
      action: 'RESET_PASSWORD',
      entityType: 'User',
      entityId: id,
      companyId: user.companyId,
      companyName: user.companyName,
      details: `Super Admin initiated credential reset for user "${user.name}" (${user.email}).`,
      module: 'Users',
      status: 'success',
    });

    notifyAdminStorageUpdated();
    return { success: true, tempPassword: generatedPassword };
  }

  deleteUser(id: string): boolean {
    const users = this.getUsers();
    const target = users.find(u => u.id === id);
    if (!target) return false;

    // Prevent deleting primary super admin
    if (target.email === 'yanosh@ghlindiaventures.com') return false;

    const filtered = users.filter(u => u.id !== id);
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(filtered));

    this.addAuditLog({
      action: 'DELETE_USER',
      entityType: 'User',
      entityId: id,
      companyId: target.companyId,
      companyName: target.companyName,
      details: `Super Admin removed user account: "${target.name}" (${target.email}).`,
      module: 'Users',
      status: 'success',
      beforeValue: target,
    });

    notifyAdminStorageUpdated();
    return true;
  }

  // ── ROLES & PERMISSIONS ───────────────────────────────────────────────────

  async fetchRolesFromApi(): Promise<Record<string, Role>> {
    try {
      const res = await apiClient.get<ApiResponse<Role[]>>('/super-admin/roles');
      if (res && res.data && res.data.length > 0) {
        const rolesMap: Record<string, Role> = {};
        res.data.forEach(r => {
          rolesMap[r.code] = {
            id: r.id,
            name: r.name,
            code: r.code,
            permissions: r.permissions || [],
            description: r.description,
            isSystemRole: r.isSystemRole ?? ['super_admin', 'company_admin', 'sales_executive', 'irm'].includes(r.code),
            isActive: r.isActive ?? true,
            usersCount: r.usersCount ?? 0,
            permissionsCount: r.permissionsCount ?? (r.permissions ? r.permissions.length : 0),
            createdBy: r.createdBy,
            createdAt: r.createdAt,
            updatedAt: r.updatedAt,
          };
        });
        // Ensure all system roles are present in the map
        for (const key of Object.keys(SYSTEM_ROLES)) {
          if (!rolesMap[key]) {
            rolesMap[key] = SYSTEM_ROLES[key];
          }
        }
        localStorage.setItem(STORAGE_KEYS.ROLES, JSON.stringify(rolesMap));
        return rolesMap;
      }
    } catch (err) {
      console.warn('Could not fetch roles from API, falling back to local store:', err);
    }
    return this.getRoles();
  }

  getRoles(): Record<string, Role> {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.ROLES);
      if (!raw) {
        localStorage.setItem(STORAGE_KEYS.ROLES, JSON.stringify(SYSTEM_ROLES));
        return SYSTEM_ROLES;
      }
      const parsed = JSON.parse(raw);
      // Ensure all system roles exist, but PRESERVE all custom roles
      const allRoles: Record<string, Role> = { ...parsed };
      for (const key of Object.keys(SYSTEM_ROLES)) {
        if (!allRoles[key]) {
          allRoles[key] = SYSTEM_ROLES[key];
        }
      }
      localStorage.setItem(STORAGE_KEYS.ROLES, JSON.stringify(allRoles));
      return allRoles;
    } catch {
      return SYSTEM_ROLES;
    }
  }

  getRolesList(): Role[] {
    const roles = this.getRoles();
    const users = this.getUsers();
    return Object.values(roles).map(r => {
      const userCount = r.usersCount !== undefined 
        ? r.usersCount 
        : users.filter(u => u.role?.code === r.code || u.role?.id === r.id).length;
      return {
        ...r,
        usersCount: userCount,
        permissionsCount: r.permissions?.length || 0,
        isSystemRole: r.isSystemRole ?? ['super_admin', 'company_admin', 'sales_executive', 'irm'].includes(r.code),
        isActive: r.isActive ?? true,
      };
    });
  }

  async getAvailablePermissionsApi(): Promise<PermissionGroup[]> {
    try {
      const res = await apiClient.get<ApiResponse<PermissionGroup[]>>('/super-admin/permissions');
      if (res && res.data && res.data.length > 0) {
        return res.data;
      }
    } catch (err) {
      console.warn('Could not fetch permissions from API, using default groups:', err);
    }
    return this.getDefaultPermissionGroups();
  }

  getDefaultPermissionGroups(): PermissionGroup[] {
    return [
      {
        group: 'LEADS',
        items: [
          { key: 'leads.view', label: 'View Leads', description: 'Browse and inspect inbound and converted lead profiles' },
          { key: 'leads.create', label: 'Create Leads', description: 'Manually register prospective contact records' },
          { key: 'leads.edit', label: 'Edit Leads', description: 'Modify contact information, intent tags, and custom fields' },
          { key: 'leads.delete', label: 'Delete Leads', description: 'Permanently remove or archive lead records' },
          { key: 'leads.assign', label: 'Assign Leads', description: 'Re-route or delegate leads to individual sales reps' },
          { key: 'leads.convert', label: 'Convert Leads', description: 'Execute conversion workflow from Lead to Customer' },
          { key: 'leads.export', label: 'Export Leads', description: 'Download CSV/Excel data sheets of lead registries' },
        ],
      },
      {
        group: 'CALLING',
        items: [
          { key: 'calls.view', label: 'View Calls', description: 'Inspect real-time telephony logs and call metadata' },
          { key: 'calls.make', label: 'Make Calls', description: 'Initiate outbound calls via WebRTC / SIP dialer' },
          { key: 'calls.manage', label: 'Manage Calls', description: 'Transfer, bridge, whisper or barge ongoing calls' },
          { key: 'calls.record', label: 'Call Recordings', description: 'Access and replay recorded call audio sessions' },
        ],
      },
      {
        group: 'REPORTS',
        items: [
          { key: 'reports.view', label: 'View Reports', description: 'Access conversion, revenue, and disposition analytics' },
          { key: 'reports.export', label: 'Export Reports', description: 'Generate and download executive PDF / XLSX reports' },
          { key: 'analytics.view', label: 'View Analytics', description: 'Inspect real-time SLA and KPI performance metrics' },
        ],
      },
      {
        group: 'USERS',
        items: [
          { key: 'users.view', label: 'View Users', description: 'Browse organization directory and team profiles' },
          { key: 'users.create', label: 'Create Users', description: 'Provision new employee accounts and assign roles' },
          { key: 'users.edit', label: 'Edit Users', description: 'Modify staff profile credentials and company assignments' },
          { key: 'users.disable', label: 'Disable Users', description: 'Deactivate or suspend user login credentials' },
        ],
      },
      {
        group: 'COMPANIES',
        items: [
          { key: 'companies.view', label: 'View Companies', description: 'Inspect tenant accounts and subscription profiles' },
          { key: 'companies.create', label: 'Create Companies', description: 'Provision new tenant companies and workspaces' },
          { key: 'companies.edit', label: 'Edit Companies', description: 'Update tenant branding, DIDs, and configuration' },
        ],
      },
      {
        group: 'DASHBOARD',
        items: [
          { key: 'dashboard.view', label: 'View Dashboard', description: 'Access executive command dashboard and live telemetry' },
          { key: 'activity.live_feed', label: 'Live Activity Feed', description: 'Monitor incoming calls, bookings, and rep presence' },
        ],
      },
      {
        group: 'GOVERNANCE & RBAC',
        items: [
          { key: 'roles.view', label: 'View Roles', description: 'Inspect system and custom RBAC permissions' },
          { key: 'roles.manage', label: 'Manage Roles', description: 'Create, update, and configure custom role permissions' },
          { key: 'audit.view', label: 'View Audit Logs', description: 'Inspect immutable administrative security logs' },
        ],
      },
    ];
  }

  async createRoleApi(data: {
    name: string;
    code: string;
    description?: string;
    isActive?: boolean;
    permissions: string[];
  }): Promise<Role> {
    const cleanCode = data.code.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_');
    const payload = {
      name: data.name.trim(),
      code: cleanCode,
      description: data.description?.trim() || '',
      isActive: data.isActive ?? true,
      permissions: data.permissions,
    };

    const res = await apiClient.post<ApiResponse<Role>>('/super-admin/roles', payload);
    if (!res || !res.data) {
      throw new Error(res?.message || 'Failed to create role on server');
    }

    const createdRole = res.data;
    const roles = this.getRoles();
    roles[createdRole.code] = createdRole;
    localStorage.setItem(STORAGE_KEYS.ROLES, JSON.stringify(roles));

    notifyAdminStorageUpdated();
    return createdRole;
  }

  async updateRoleApi(
    id: string,
    data: {
      name?: string;
      description?: string;
      isActive?: boolean;
      permissions?: string[];
    }
  ): Promise<Role> {
    const res = await apiClient.put<ApiResponse<Role>>(`/super-admin/roles/${id}`, data);
    if (!res || !res.data) {
      throw new Error(res?.message || 'Failed to update role on server');
    }

    const updatedRole = res.data;
    const roles = this.getRoles();
    const existingKey = Object.keys(roles).find(k => roles[k].id === id || roles[k].code === id);
    if (existingKey) {
      roles[existingKey] = {
        ...roles[existingKey],
        ...updatedRole,
        updatedAt: new Date().toISOString(),
      };
      localStorage.setItem(STORAGE_KEYS.ROLES, JSON.stringify(roles));
      notifyAdminStorageUpdated();
    }

    return updatedRole;
  }

  async toggleRoleStatusApi(id: string, isActive: boolean): Promise<boolean> {
    const res = await apiClient.patch<ApiResponse<Role>>(`/super-admin/roles/${id}/status`, { isActive });
    if (!res || !res.data) {
      throw new Error(res?.message || 'Failed to toggle role status on server');
    }

    const roles = this.getRoles();
    const existingKey = Object.keys(roles).find(k => roles[k].id === id || roles[k].code === id);
    if (existingKey) {
      roles[existingKey].isActive = isActive;
      roles[existingKey].updatedAt = new Date().toISOString();
      localStorage.setItem(STORAGE_KEYS.ROLES, JSON.stringify(roles));
      notifyAdminStorageUpdated();
      return true;
    }
    return true;
  }

  async deleteRoleApi(id: string): Promise<boolean> {
    const res = await apiClient.delete<ApiResponse<boolean>>(`/super-admin/roles/${id}`);
    if (!res || res.data === false) {
      throw new Error(res?.message || 'Failed to delete role from server');
    }

    const roles = this.getRoles();
    const existingKey = Object.keys(roles).find(k => roles[k].id === id || roles[k].code === id);
    if (existingKey) {
      delete roles[existingKey];
      localStorage.setItem(STORAGE_KEYS.ROLES, JSON.stringify(roles));
      notifyAdminStorageUpdated();
    }
    return true;
  }

  updateRolePermissions(roleCode: string, permissions: string[]): boolean {
    const roles = this.getRoles();
    if (!roles[roleCode]) return false;

    const before = [...roles[roleCode].permissions];
    roles[roleCode].permissions = permissions;
    roles[roleCode].updatedAt = new Date().toISOString();
    localStorage.setItem(STORAGE_KEYS.ROLES, JSON.stringify(roles));

    this.addAuditLog({
      action: 'UPDATE_ROLE_PERMISSIONS',
      entityType: 'Role',
      entityId: roleCode,
      details: `Super Admin updated permission matrix for role [${roles[roleCode].name}]: ${permissions.length} privileges assigned.`,
      module: 'Roles',
      status: 'success',
      beforeValue: { permissions: before },
      afterValue: { permissions },
    });

    notifyAdminStorageUpdated();
    return true;
  }

  createCustomRole(name: string, code: string, permissions: string[]): Role {
    const roles = this.getRoles();
    const cleanCode = code.toLowerCase().replace(/[^a-z0-9_]/g, '');

    const newRole: Role = {
      id: `role-${Date.now().toString().slice(-4)}`,
      name,
      code: cleanCode,
      permissions,
      isSystemRole: false,
      isActive: true,
      usersCount: 0,
      permissionsCount: permissions.length,
      createdAt: new Date().toISOString(),
    };

    roles[cleanCode] = newRole;
    localStorage.setItem(STORAGE_KEYS.ROLES, JSON.stringify(roles));

    this.addAuditLog({
      action: 'CREATE_ROLE',
      entityType: 'Role',
      entityId: cleanCode,
      details: `Super Admin created custom system role: "${name}" (${cleanCode}).`,
      module: 'Roles',
      status: 'success',
      afterValue: newRole,
    });

    notifyAdminStorageUpdated();
    return newRole;
  }

  // ── PACKAGES & ENTITLEMENTS ───────────────────────────────────────────────

  async fetchPackagesFromApi(): Promise<SubscriptionPackage[]> {
    const res = await apiClient.get<ApiResponse<SubscriptionPackage[]>>('/super-admin/packages');
    if (res && res.data) {
      localStorage.setItem(STORAGE_KEYS.PACKAGES, JSON.stringify(res.data));
      return res.data;
    }
    throw new Error(res?.message || 'Failed to fetch subscription packages from backend');
  }

  getPackages(): SubscriptionPackage[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.PACKAGES);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  getPackageById(id: string): SubscriptionPackage | undefined {
    return this.getPackages().find(p => p.id === id || p.code === id);
  }

  async createPackageApi(pkgData: Partial<SubscriptionPackage>): Promise<SubscriptionPackage> {
    const payload = {
      name: pkgData.name,
      code: (pkgData.code || pkgData.name || 'custom_plan').toLowerCase().replace(/[^a-z0-9_]/g, '_'),
      description: pkgData.description || '',
      tier: pkgData.tier || 'Growth',
      priceMonthly: pkgData.priceMonthly || 19999,
      currency: pkgData.currency || '₹',
      maxUsers: pkgData.maxUsers || 25,
      maxStorageGb: pkgData.maxStorageGb || 100,
      features: pkgData.features || [FEATURES.LEADS, FEATURES.CUSTOMERS, FEATURES.CALLS],
      isPopular: pkgData.isPopular ?? false,
      isActive: pkgData.isActive ?? true,
    };

    const res = await apiClient.post<ApiResponse<SubscriptionPackage>>('/super-admin/packages', payload);
    if (!res || !res.data) {
      throw new Error(res?.message || 'Failed to create subscription package');
    }

    await this.fetchPackagesFromApi();
    notifyAdminStorageUpdated();
    return res.data;
  }

  async updatePackageApi(pkg: SubscriptionPackage): Promise<SubscriptionPackage> {
    const payload = {
      name: pkg.name,
      description: pkg.description,
      tier: pkg.tier,
      priceMonthly: pkg.priceMonthly,
      currency: pkg.currency,
      maxUsers: pkg.maxUsers,
      maxStorageGb: pkg.maxStorageGb,
      features: pkg.features,
      isPopular: pkg.isPopular,
      isActive: pkg.isActive,
    };

    const res = await apiClient.put<ApiResponse<SubscriptionPackage>>(`/super-admin/packages/${pkg.id}`, payload);
    if (!res || !res.data) {
      throw new Error(res?.message || 'Failed to update subscription package');
    }

    await this.fetchPackagesFromApi();
    notifyAdminStorageUpdated();
    return res.data;
  }

  async togglePackageStatusApi(id: string, isActive: boolean): Promise<boolean> {
    const res = await apiClient.patch<ApiResponse<boolean>>(`/super-admin/packages/${id}/status`, { isActive });
    await this.fetchPackagesFromApi();
    notifyAdminStorageUpdated();
    return res?.data ?? true;
  }

  async deletePackageApi(id: string): Promise<boolean> {
    const res = await apiClient.delete<ApiResponse<boolean>>(`/super-admin/packages/${id}`);
    await this.fetchPackagesFromApi();
    notifyAdminStorageUpdated();
    return res?.data ?? true;
  }

  createPackage(pkgData: Partial<SubscriptionPackage>): SubscriptionPackage {
    this.createPackageApi(pkgData).catch(err => console.error('createPackageApi error:', err));
    const packages = this.getPackages();
    const newPkg: SubscriptionPackage = {
      id: `pkg-${Date.now().toString().slice(-6)}`,
      name: pkgData.name || 'New Plan',
      code: (pkgData.code || pkgData.name || 'custom_plan').toLowerCase().replace(/[^a-z0-9_]/g, ''),
      description: pkgData.description || 'Custom functional package',
      tier: pkgData.tier || 'Growth',
      priceMonthly: pkgData.priceMonthly || 19999,
      currency: '₹',
      maxUsers: pkgData.maxUsers || 25,
      maxStorageGb: pkgData.maxStorageGb || 100,
      features: pkgData.features || [FEATURES.LEADS, FEATURES.CUSTOMERS, FEATURES.CALLS],
      isActive: true,
      enrolledTenantsCount: 0,
      createdAt: new Date().toISOString(),
      ...pkgData,
    };

    packages.push(newPkg);
    localStorage.setItem(STORAGE_KEYS.PACKAGES, JSON.stringify(packages));
    notifyAdminStorageUpdated();
    return newPkg;
  }

  updatePackage(pkg: SubscriptionPackage): SubscriptionPackage {
    this.updatePackageApi(pkg).catch(err => console.error('updatePackageApi error:', err));
    const packages = this.getPackages();
    const idx = packages.findIndex(p => p.id === pkg.id);
    const updated: SubscriptionPackage = {
      ...pkg,
      updatedAt: new Date().toISOString(),
    };

    if (idx >= 0) {
      packages[idx] = updated;
    } else {
      packages.push(updated);
    }

    localStorage.setItem(STORAGE_KEYS.PACKAGES, JSON.stringify(packages));
    notifyAdminStorageUpdated();
    return updated;
  }

  deletePackage(id: string): boolean {
    this.deletePackageApi(id).catch(err => console.error('deletePackageApi error:', err));
    const packages = this.getPackages();
    const target = packages.find(p => p.id === id);
    if (!target) return false;

    const filtered = packages.filter(p => p.id !== id);
    localStorage.setItem(STORAGE_KEYS.PACKAGES, JSON.stringify(filtered));
    notifyAdminStorageUpdated();
    return true;
  }

  // ── TELEPHONY & DID MAPPINGS ──────────────────────────────────────────────

  async fetchDidMappingsFromApi(): Promise<TenantDidMapping[]> {
    const res = await apiClient.get<ApiResponse<TenantDidMapping[]>>('/super-admin/call-config/dids');
    if (res && res.data) {
      localStorage.setItem(STORAGE_KEYS.DIDS, JSON.stringify(res.data));
      return res.data;
    }
    throw new Error(res?.message || 'Failed to fetch DIDs from backend');
  }

  getDidMappings(): TenantDidMapping[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.DIDS);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  async createDidMappingApi(didData: Partial<TenantDidMapping>): Promise<TenantDidMapping> {
    const payload = {
      tenantId: didData.tenantId || null,
      phoneNumber: didData.phoneNumber,
      routingStrategy: didData.routingStrategy || 'Round-Robin',
      queueName: didData.queueName || 'General Queue',
      enableRecording: didData.enableRecording ?? true,
      enableAiWhisper: didData.enableAiWhisper ?? true,
      status: didData.status || (didData.tenantId ? 'Online' : 'Reserved'),
      channelsCount: didData.channelsCount || 8,
      notes: didData.notes || '',
    };

    const res = await apiClient.post<ApiResponse<TenantDidMapping>>('/super-admin/call-config/dids', payload);
    if (!res || !res.data) {
      throw new Error(res?.message || 'Failed to create DID mapping');
    }

    await this.fetchDidMappingsFromApi();
    notifyAdminStorageUpdated();
    return res.data;
  }

  async updateDidMappingApi(id: string, updates: Partial<TenantDidMapping>): Promise<TenantDidMapping> {
    const payload = {
      tenantId: updates.tenantId !== undefined ? updates.tenantId : undefined,
      phoneNumber: updates.phoneNumber,
      routingStrategy: updates.routingStrategy,
      queueName: updates.queueName,
      enableRecording: updates.enableRecording,
      enableAiWhisper: updates.enableAiWhisper,
      status: updates.status,
      channelsCount: updates.channelsCount,
      notes: updates.notes,
    };

    const res = await apiClient.put<ApiResponse<TenantDidMapping>>(`/super-admin/call-config/dids/${id}`, payload);
    if (!res || !res.data) {
      throw new Error(res?.message || 'Failed to update DID mapping');
    }

    await this.fetchDidMappingsFromApi();
    notifyAdminStorageUpdated();
    return res.data;
  }

  async toggleDidStatusApi(id: string, status: 'Online' | 'Offline' | 'Reserved'): Promise<boolean> {
    const res = await apiClient.patch<ApiResponse<boolean>>(`/super-admin/call-config/dids/${id}/status`, { status });
    await this.fetchDidMappingsFromApi();
    notifyAdminStorageUpdated();
    return res?.data ?? true;
  }

  async deleteDidMappingApi(id: string): Promise<boolean> {
    const res = await apiClient.delete<ApiResponse<boolean>>(`/super-admin/call-config/dids/${id}`);
    await this.fetchDidMappingsFromApi();
    notifyAdminStorageUpdated();
    return res?.data ?? true;
  }

  createDidMapping(didData: Partial<TenantDidMapping>): TenantDidMapping {
    this.createDidMappingApi(didData).catch(err => console.error('createDidMappingApi error:', err));
    const dids = this.getDidMappings();
    const newDid: TenantDidMapping = {
      id: `did-${Date.now().toString().slice(-4)}`,
      phoneNumber: didData.phoneNumber || '+91 80 4700 9999',
      tenantId: didData.tenantId || '',
      tenantName: didData.tenantName || 'Unassigned Pool',
      tenantSlug: didData.tenantSlug || '',
      routingStrategy: didData.routingStrategy || 'Round-Robin',
      queueName: didData.queueName || 'General Queue',
      enableRecording: didData.enableRecording ?? true,
      enableAiWhisper: didData.enableAiWhisper ?? true,
      status: (didData.tenantId ? 'Online' : 'Reserved') as any,
      channelsCount: didData.channelsCount || 8,
      allocatedAt: new Date().toISOString(),
      notes: didData.notes || '',
      ...didData,
    };

    dids.push(newDid);
    localStorage.setItem(STORAGE_KEYS.DIDS, JSON.stringify(dids));
    notifyAdminStorageUpdated();
    return newDid;
  }

  updateDidMapping(id: string, updates: Partial<TenantDidMapping>): TenantDidMapping | undefined {
    this.updateDidMappingApi(id, updates).catch(err => console.error('updateDidMappingApi error:', err));
    const dids = this.getDidMappings();
    const idx = dids.findIndex(d => d.id === id);
    if (idx === -1) return undefined;

    const updated: TenantDidMapping = {
      ...dids[idx],
      ...updates,
    };

    dids[idx] = updated;
    localStorage.setItem(STORAGE_KEYS.DIDS, JSON.stringify(dids));
    notifyAdminStorageUpdated();
    return updated;
  }

  deleteDidMapping(id: string): boolean {
    this.deleteDidMappingApi(id).catch(err => console.error('deleteDidMappingApi error:', err));
    const dids = this.getDidMappings();
    const target = dids.find(d => d.id === id);
    if (!target) return false;

    const filtered = dids.filter(d => d.id !== id);
    localStorage.setItem(STORAGE_KEYS.DIDS, JSON.stringify(filtered));
    notifyAdminStorageUpdated();
    return true;
  }

  // ── CARRIER SETTINGS ──────────────────────────────────────────────────────

  async fetchCarrierSettingsFromApi(): Promise<PlatformCarrierSettings> {
    const res = await apiClient.get<ApiResponse<PlatformCarrierSettings>>('/super-admin/call-config/carrier');
    if (res && res.data) {
      localStorage.setItem(STORAGE_KEYS.CARRIER_SETTINGS, JSON.stringify(res.data));
      return res.data;
    }
    throw new Error(res?.message || 'Failed to fetch carrier settings from backend');
  }

  getCarrierSettings(): PlatformCarrierSettings {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.CARRIER_SETTINGS);
      if (raw) return JSON.parse(raw);
    } catch {}
    return {
      primaryCarrier: 'Twilio Elastic SIP Trunking',
      secondaryCarrier: 'Tata Communications SIP',
      sipRealm: 'sip.nexussales.internal',
      webrtcGatewayUrl: 'wss://webrtc.nexussales.internal:8443/ws',
      recordingRetentionDays: 90,
      maxConcurrentChannels: 64,
      emergencyRoutingEnabled: true,
      whisperAiModel: 'Whisper-Large-v3-Turbo',
      lastTestedAt: '',
      testStatus: 'Offline',
      accountSid: '',
      authToken: '',
      primaryGatewayHost: 'sip.nexussales.internal',
      failoverGatewayHost: '',
    };
  }

  async updateCarrierSettingsApi(settings: PlatformCarrierSettings): Promise<PlatformCarrierSettings> {
    const payload = {
      primaryCarrier: settings.primaryCarrier,
      secondaryCarrier: settings.secondaryCarrier,
      sipRealm: settings.sipRealm,
      webrtcGatewayUrl: settings.webrtcGatewayUrl,
      recordingRetentionDays: settings.recordingRetentionDays,
      maxConcurrentChannels: settings.maxConcurrentChannels,
      emergencyRoutingEnabled: settings.emergencyRoutingEnabled,
      whisperAiModel: settings.whisperAiModel,
      accountSid: settings.accountSid,
      authToken: settings.authToken,
      primaryGatewayHost: settings.primaryGatewayHost,
      failoverGatewayHost: settings.failoverGatewayHost,
    };

    const res = await apiClient.put<ApiResponse<PlatformCarrierSettings>>('/super-admin/call-config/carrier', payload);
    if (!res || !res.data) {
      throw new Error(res?.message || 'Failed to update carrier settings');
    }

    await this.fetchCarrierSettingsFromApi();
    notifyAdminStorageUpdated();
    return res.data;
  }

  updateCarrierSettings(settings: PlatformCarrierSettings): PlatformCarrierSettings {
    this.updateCarrierSettingsApi(settings).catch(err => console.error('updateCarrierSettingsApi error:', err));
    localStorage.setItem(STORAGE_KEYS.CARRIER_SETTINGS, JSON.stringify(settings));
    notifyAdminStorageUpdated();
    return settings;
  }

  async testCarrierConnection(): Promise<{ success: boolean; latencyMs: number; message: string }> {
    try {
      const res = await apiClient.post<ApiResponse<{ success: boolean; latencyMs: number; message: string; testedAt: string; status: string }>>(
        '/super-admin/call-config/carrier/test'
      );
      if (res && res.data) {
        const current = this.getCarrierSettings();
        current.lastTestedAt = res.data.testedAt || new Date().toISOString();
        current.testStatus = res.data.status as any || (res.data.success ? 'Success' : 'Offline');
        localStorage.setItem(STORAGE_KEYS.CARRIER_SETTINGS, JSON.stringify(current));
        notifyAdminStorageUpdated();
        return {
          success: res.data.success,
          latencyMs: res.data.latencyMs,
          message: res.data.message,
        };
      }
    } catch (err: any) {
      console.warn('Real carrier test failed:', err);
      return {
        success: false,
        latencyMs: 0,
        message: err.message || 'Carrier test failed to connect to SIP host',
      };
    }
    return {
      success: false,
      latencyMs: 0,
      message: 'Unable to communicate with telephony gateway server.',
    };
  }

  async simulateInboundCall(phoneNumber: string): Promise<{
    success: boolean;
    phoneNumber: string;
    tenantName: string;
    routingStrategy: string;
    queueName: string;
    traceLogs: string[];
    executedAt: string;
  }> {
    const res = await apiClient.post<ApiResponse<{
      success: boolean;
      phoneNumber: string;
      tenantName: string;
      routingStrategy: string;
      queueName: string;
      traceLogs: string[];
      executedAt: string;
    }>>('/super-admin/call-config/simulate-call', { phoneNumber });

    if (res && res.data) {
      return res.data;
    }
    throw new Error(res?.message || 'Failed to execute call simulation on telephony gateway');
  }

  // ── AUDIT LOGS ────────────────────────────────────────────────────────────

  async fetchAuditLogsFromApi(filters?: {
    companyId?: string;
    actor?: string;
    action?: string;
    module?: string;
    search?: string;
    from?: string;
    to?: string;
    pageNumber?: number;
    pageSize?: number;
  }): Promise<AuditLog[]> {
    try {
      const params: Record<string, any> = {
        page: filters?.pageNumber || 1,
        pageSize: filters?.pageSize || 200,
      };

      if (filters?.companyId && filters.companyId !== 'all') {
        params.companyId = filters.companyId;
      }
      if (filters?.action && filters.action !== 'all') {
        params.action = filters.action;
      }
      if (filters?.module && filters.module !== 'all') {
        params.module = filters.module;
      }
      if (filters?.search) {
        params.search = filters.search;
      }
      if (filters?.from) {
        params.from = filters.from;
      }
      if (filters?.to) {
        params.to = filters.to;
      }

      const res = await apiClient.get<any>('/audit-logs', params);
      const rawList = res?.data?.items || res?.items || res?.data || (Array.isArray(res) ? res : []);
      if (Array.isArray(rawList)) {
        const mapped: AuditLog[] = rawList.map((l: any) => {
          let actorName = (l.actorName || l.userName || '').trim();
          let actorEmail = (l.actorEmail || l.userEmail || '').trim();

          // If actorName is in the format "IRM (ID: 5)" or contains "(ID: ...)", clean it up
          if (actorName.includes('(ID:')) {
            actorName = actorEmail ? actorEmail.split('@')[0] : 'System User';
          } else if (actorName.includes('@') && !actorEmail) {
            actorEmail = actorName;
          }

          if (!actorName && actorEmail) {
            actorName = actorEmail.split('@')[0];
          }

          return {
            id: String(l.id),
            timestamp: l.createdAt || l.timestamp || new Date().toISOString(),
            actorName: actorName || 'System User',
            actorEmail: actorEmail,
            action: l.action || 'PLATFORM_OPERATION',
            entityType: l.entityType || 'Platform',
            entityId: String(l.entityId || ''),
            companyId: l.companyId ? String(l.companyId) : undefined,
            companyName: l.companyName || (l.companyId ? `Company #${l.companyId}` : 'PLATFORM CONSOLE'),
            details: l.details || '',
            ipAddress: l.ipAddress || '127.0.0.1',
            userAgent: l.userAgent || 'Nexus Platform Console',
            module: l.module || 'Platform',
            status: (l.status as any) || 'success',
            beforeValue: l.beforeValue ? (typeof l.beforeValue === 'string' ? JSON.parse(l.beforeValue) : l.beforeValue) : undefined,
            afterValue: l.afterValue ? (typeof l.afterValue === 'string' ? JSON.parse(l.afterValue) : l.afterValue) : undefined,
          };
        });

        localStorage.setItem(STORAGE_KEYS.AUDIT_LOGS, JSON.stringify(mapped));
        return mapped;
      }
    } catch (err) {
      console.warn('Could not fetch audit logs from /api/audit-logs:', err);
      throw err;
    }
    return this.getAuditLogs(filters);
  }

  getAuditLogs(filters?: {
    companyId?: string;
    actor?: string;
    action?: string;
    module?: string;
    search?: string;
    from?: string;
    to?: string;
  }): AuditLog[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.AUDIT_LOGS);
      let logs: AuditLog[] = raw ? JSON.parse(raw) : [];

      if (!filters) return logs;

      return logs.filter(l => {
        if (filters.companyId && filters.companyId !== 'all') {
          if (filters.companyId === 'global' && l.companyId) return false;
          if (filters.companyId !== 'global' && l.companyId !== filters.companyId) return false;
        }
        if (filters.action && filters.action !== 'all' && l.action !== filters.action) return false;
        if (filters.module && filters.module !== 'all' && l.module !== filters.module) return false;
        if (filters.actor && !l.actorName.toLowerCase().includes(filters.actor.toLowerCase())) return false;
        if (filters.search) {
          const s = filters.search.toLowerCase();
          const matchActor = (l.actorName || '').toLowerCase().includes(s);
          const matchEmail = (l.actorEmail || '').toLowerCase().includes(s);
          const matchDetails = (l.details || '').toLowerCase().includes(s);
          const matchCompany = (l.companyName || '').toLowerCase().includes(s);
          if (!matchActor && !matchEmail && !matchDetails && !matchCompany) return false;
        }
        if (filters.from && new Date(l.timestamp) < new Date(filters.from)) return false;
        if (filters.to && new Date(l.timestamp) > new Date(filters.to)) return false;
        return true;
      });
    } catch {
      return [];
    }
  }

  addAuditLog(log: Partial<AuditLog>): AuditLog {
    try {
      const logs = this.getAuditLogs();
      const newLog: AuditLog = {
        id: `aud-${Date.now()}-${logs.length + 1}`,
        timestamp: new Date().toISOString(),
        actorName: log.actorName || 'Super Admin',
        actorEmail: log.actorEmail || 'admin@platform.com',
        action: log.action || 'PLATFORM_OPERATION',
        entityType: log.entityType || 'Platform',
        entityId: log.entityId || '0',
        companyId: log.companyId,
        companyName: log.companyName || (log.companyId ? `Company #${log.companyId}` : 'PLATFORM CONSOLE'),
        details: log.details || 'Platform operation executed.',
        ipAddress: '127.0.0.1 (Platform Console)',
        userAgent: 'Nexus Platform Console (Internal)',
        module: log.module || 'Platform',
        status: log.status || 'success',
        beforeValue: log.beforeValue,
        afterValue: log.afterValue,
      };

      logs.unshift(newLog);
      if (logs.length > 1000) logs.pop();
      localStorage.setItem(STORAGE_KEYS.AUDIT_LOGS, JSON.stringify(logs));
      return newLog;
    } catch {
      return log as AuditLog;
    }
  }

  exportAuditLogsCsv(filteredLogs?: AuditLog[]): string {
    const logs = filteredLogs || this.getAuditLogs();
    const headers = ['Timestamp', 'Organization', 'Actor Name', 'Actor Email', 'Action', 'Module', 'Entity Type', 'Entity ID', 'Details', 'Status'];
    const rows = logs.map(l => [
      `"${l.timestamp}"`,
      `"${l.companyName || 'GLOBAL PLATFORM'}"`,
      `"${l.actorName}"`,
      `"${l.actorEmail}"`,
      `"${l.action}"`,
      `"${l.module || ''}"`,
      `"${l.entityType}"`,
      `"${l.entityId}"`,
      `"${l.details.replace(/"/g, '""')}"`,
      `"${l.status || 'success'}"`,
    ]);

    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  }

  // ── SYSTEM DIAGNOSTICS & ANNOUNCEMENTS ─────────────────────────────────────

  async fetchSystemDiagnosticsFromApi(): Promise<SystemDiagnostics> {
    const start = performance.now();
    const res = await apiClient.get<ApiResponse<SystemDiagnostics>>('/super-admin/system/diagnostics');
    const roundtripMs = Math.round(performance.now() - start);
    if (res && res.data) {
      return {
        ...res.data,
        apiLatencyMs: res.data.apiLatencyMs > 0 ? res.data.apiLatencyMs : roundtripMs,
      };
    }
    throw new Error(res?.message || 'Failed to fetch diagnostics from backend');
  }

  getSystemDiagnostics(): SystemDiagnostics {
    try {
      const raw = localStorage.getItem('nexus_system_diagnostics');
      if (raw) return JSON.parse(raw);
    } catch {}

    return {
      apiStatus: 'Healthy',
      apiLatencyMs: 0,
      dbPoolActive: 0,
      dbPoolMax: 100,
      dbLatencyMs: 0,
      memoryUsedMb: 0,
      memoryLimitMb: 0,
      storageUsedGb: 0,
      storageLimitGb: 0,
      activeSessions: 0,
      activeWebSockets: 0,
      telephonyDropRate: 0.0,
      systemUptimePercentage: 100.0,
      lastBackupAt: '',
    };
  }

  // ── DEPENDENCY HEALTH CHECKS ──────────────────────────────────────────────

  async fetchSystemHealthChecksFromApi(): Promise<SystemHealthReport> {
    const res = await apiClient.get<ApiResponse<SystemHealthReport>>('/super-admin/system/health-checks');
    if (res && res.data) {
      return res.data;
    }
    throw new Error(res?.message || 'Failed to fetch dependency health report');
  }

  async probeSystemHealthChecksFromApi(): Promise<SystemHealthReport> {
    const res = await apiClient.post<ApiResponse<SystemHealthReport>>('/super-admin/system/health-checks/probe');
    if (res && res.data) {
      return res.data;
    }
    throw new Error(res?.message || 'Failed to execute dependency health probe');
  }

  async testSmtpDiagnosticApi(): Promise<{ success: boolean; latencyMs: number; status: string; message: string; details: Record<string, any> }> {
    const res = await apiClient.post<ApiResponse<{ success: boolean; latencyMs: number; status: string; message: string; details: Record<string, any> }>>(
      '/super-admin/system/health-checks/smtp/test'
    );
    if (res && res.data) return res.data;
    throw new Error(res?.message || 'SMTP diagnostic probe failed');
  }

  // ── GLOBAL CONFIGURATION ──────────────────────────────────────────────────

  async fetchGlobalConfigFromApi(): Promise<GlobalConfig> {
    const res = await apiClient.get<ApiResponse<GlobalConfig>>('/super-admin/system/config');
    if (res && res.data) {
      return res.data;
    }
    throw new Error(res?.message || 'Failed to fetch global configuration');
  }

  async updateGlobalConfigApi(payload: Partial<GlobalConfig>): Promise<GlobalConfig> {
    const res = await apiClient.put<ApiResponse<GlobalConfig>>('/super-admin/system/config', payload);
    if (res && res.data) {
      notifyAdminStorageUpdated();
      return res.data;
    }
    throw new Error(res?.message || 'Failed to update global configuration');
  }

  async fetchAnnouncementsFromApi(): Promise<BroadcastAnnouncement[]> {
    const res = await apiClient.get<ApiResponse<BroadcastAnnouncement[]>>('/super-admin/system/announcements');
    if (res && res.data) {
      localStorage.setItem(STORAGE_KEYS.ANNOUNCEMENTS, JSON.stringify(res.data));
      return res.data;
    }
    throw new Error(res?.message || 'Failed to fetch announcements from backend');
  }

  async fetchActiveAnnouncementsFromApi(tenantId?: string | number, role?: string): Promise<BroadcastAnnouncement[]> {
    try {
      const params = new URLSearchParams();
      if (tenantId) params.append('tenantId', String(tenantId));
      if (role) params.append('role', role);
      const query = params.toString() ? `?${params.toString()}` : '';
      const res = await apiClient.get<ApiResponse<BroadcastAnnouncement[]>>(`/announcements/active${query}`);
      if (res && res.data) {
        return res.data;
      }
      return [];
    } catch {
      return [];
    }
  }


  getAnnouncements(): BroadcastAnnouncement[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.ANNOUNCEMENTS);
      if (raw) return JSON.parse(raw);
    } catch {}
    return [];
  }

  async createAnnouncementApi(ann: Partial<BroadcastAnnouncement>): Promise<BroadcastAnnouncement> {
    const payload = {
      title: ann.title || 'Platform Notice',
      message: ann.message || '',
      priority: ann.priority || 'info',
      targetAudience: ann.targetAudience || 'all',
      targetTenantId: ann.targetTenantId,
      expiresAt: ann.expiresAt,
      isActive: ann.isActive !== undefined ? ann.isActive : true,
    };

    const res = await apiClient.post<ApiResponse<BroadcastAnnouncement>>('/super-admin/system/announcements', payload);
    if (!res || !res.data) {
      throw new Error(res?.message || 'Failed to create announcement');
    }

    await this.fetchAnnouncementsFromApi();
    notifyAdminStorageUpdated();
    return res.data;
  }

  async toggleAnnouncementApi(id: string, isActive: boolean): Promise<boolean> {
    const res = await apiClient.patch<ApiResponse<boolean>>(`/super-admin/system/announcements/${id}/status`, { isActive });
    await this.fetchAnnouncementsFromApi();
    notifyAdminStorageUpdated();
    return res?.data ?? true;
  }

  async deleteAnnouncementApi(id: string): Promise<boolean> {
    const res = await apiClient.delete<ApiResponse<boolean>>(`/super-admin/system/announcements/${id}`);
    await this.fetchAnnouncementsFromApi();
    notifyAdminStorageUpdated();
    return res?.data ?? true;
  }

  createAnnouncement(ann: Partial<BroadcastAnnouncement>): BroadcastAnnouncement {
    this.createAnnouncementApi(ann).catch(err => console.error('createAnnouncementApi error:', err));
    const list = this.getAnnouncements();
    const newAnn: BroadcastAnnouncement = {
      id: `ann-${Date.now()}`,
      title: ann.title || 'Platform Notice',
      message: ann.message || '',
      priority: ann.priority || 'info',
      targetAudience: ann.targetAudience || 'all',
      targetTenantId: ann.targetTenantId,
      isActive: true,
      createdAt: new Date().toISOString(),
      createdBy: 'Yanosh',
      expiresAt: ann.expiresAt,
      ...ann,
    };

    list.unshift(newAnn);
    localStorage.setItem(STORAGE_KEYS.ANNOUNCEMENTS, JSON.stringify(list));
    notifyAdminStorageUpdated();
    return newAnn;
  }

  toggleAnnouncement(id: string, isActive: boolean): boolean {
    this.toggleAnnouncementApi(id, isActive).catch(err => console.error('toggleAnnouncementApi error:', err));
    const list = this.getAnnouncements();
    const item = list.find(a => a.id === id);
    if (!item) return false;

    item.isActive = isActive;
    localStorage.setItem(STORAGE_KEYS.ANNOUNCEMENTS, JSON.stringify(list));
    notifyAdminStorageUpdated();
    return true;
  }

  deleteAnnouncement(id: string): boolean {
    this.deleteAnnouncementApi(id).catch(err => console.error('deleteAnnouncementApi error:', err));
    const list = this.getAnnouncements();
    const filtered = list.filter(a => a.id !== id);
    localStorage.setItem(STORAGE_KEYS.ANNOUNCEMENTS, JSON.stringify(filtered));
    notifyAdminStorageUpdated();
    return true;
  }

  async fetchMaintenanceModeFromApi(): Promise<{ enabled: boolean; message: string; bypassSecret: string }> {
    const res = await apiClient.get<ApiResponse<{ enabled: boolean; message: string; bypassSecret: string }>>(
      '/super-admin/system/maintenance'
    );
    if (res && res.data) {
      localStorage.setItem(STORAGE_KEYS.MAINTENANCE_MODE, JSON.stringify(res.data));
      return res.data;
    }
    throw new Error(res?.message || 'Failed to fetch maintenance mode from backend');
  }

  getMaintenanceMode(): { enabled: boolean; message: string; bypassSecret: string } {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.MAINTENANCE_MODE);
      return raw ? JSON.parse(raw) : { enabled: false, message: 'Platform under scheduled maintenance.', bypassSecret: '' };
    } catch {
      return { enabled: false, message: 'Platform under scheduled maintenance.', bypassSecret: '' };
    }
  }

  async setMaintenanceModeApi(enabled: boolean, message?: string): Promise<{ enabled: boolean; message: string; bypassSecret: string }> {
    const payload = {
      enabled,
      message: message || 'Platform under scheduled maintenance.',
    };

    const res = await apiClient.put<ApiResponse<{ enabled: boolean; message: string; bypassSecret: string }>>(
      '/super-admin/system/maintenance',
      payload
    );
    if (!res || !res.data) {
      throw new Error(res?.message || 'Failed to update maintenance mode');
    }

    localStorage.setItem(STORAGE_KEYS.MAINTENANCE_MODE, JSON.stringify(res.data));
    notifyAdminStorageUpdated();
    return res.data;
  }

  setMaintenanceMode(enabled: boolean, message?: string) {
    this.setMaintenanceModeApi(enabled, message).catch(err => console.error('setMaintenanceModeApi error:', err));
    const current = this.getMaintenanceMode();
    const updated = {
      ...current,
      enabled,
      message: message || current.message,
    };
    localStorage.setItem(STORAGE_KEYS.MAINTENANCE_MODE, JSON.stringify(updated));
    notifyAdminStorageUpdated();
    return updated;
  }

  // ── PLATFORM TELEMETRY METRICS ────────────────────────────────────────────

  async fetchPlatformMetricsFromApi(): Promise<PlatformMetrics> {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const res = await apiClient.get<ApiResponse<PlatformMetrics>>('/super-admin/metrics', { timeZone: tz });
    if (res && res.data) {
      localStorage.setItem(STORAGE_KEYS.METRICS, JSON.stringify(res.data));
      return res.data;
    }
    throw new Error(res?.message || 'Failed to fetch platform metrics from backend');
  }

  async fetchCallsTodayMetricsFromApi(): Promise<{ callsToday: number; callsConnected: number } | null> {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const res = await apiClient.get<ApiResponse<{ callsToday: number; callsConnected: number }>>(
        '/super-admin/metrics/calls-today',
        { timeZone: tz }
      );
      if (res && res.data) {
        try {
          const cached = localStorage.getItem(STORAGE_KEYS.METRICS);
          if (cached) {
            const parsed = JSON.parse(cached);
            parsed.callsToday = res.data.callsToday;
            parsed.callsConnected = res.data.callsConnected;
            localStorage.setItem(STORAGE_KEYS.METRICS, JSON.stringify(parsed));
          }
        } catch {}
        return res.data;
      }
    } catch (err) {
      console.warn('Could not fetch calls today metrics from API:', err);
    }
    return null;
  }

  getPlatformMetrics(): PlatformMetrics {
    try {
      const cached = localStorage.getItem(STORAGE_KEYS.METRICS);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (typeof parsed.totalTenants === 'number') {
          return parsed;
        }
      }
    } catch {}

    const tenants = this.getTenants();
    const users = this.getUsers();
    const activeTenants = tenants.filter(t => t.status === 'Active' || !t.status);
    const onboardingTenants = tenants.filter(t => t.status === 'Inactive');
    const suspendedTenants = tenants.filter(t => t.status === 'Suspended');

    return {
      totalTenants: tenants.length,
      activeTenants: activeTenants.length,
      onboardingTenants: onboardingTenants.length,
      suspendedTenants: suspendedTenants.length,
      totalUsers: users.length,
      activeUsers: users.filter(u => u.status === 'Active').length,
      superAdminCount: users.filter(u => u.role?.id === '1' || u.role?.code === 'super_admin').length,
      companyAdminCount: users.filter(u => u.role?.id === '2' || u.role?.code === 'company_admin').length,
      salesExecutiveCount: users.filter(u => u.role?.id === '3' || u.role?.code === 'sales_executive').length,
      irmCount: users.filter(u => u.role?.id === '4' || u.role?.code === 'irm').length,
      totalCalls: 0,
      callsToday: 0,
      callsConnected: 0,
      totalLeads: 0,
      currentMonthLeads: 0,
      previousMonthLeads: 0,
      totalPipelineValue: 0,
      totalCustomers: 0,
      systemHealthScore: 100,
    };
  }

  // ── SECURITY & SESSIONS ───────────────────────────────────────────────────

  async getSecurityOverview(): Promise<any> {
    const res = await apiClient.get<ApiResponse<any>>('/super-admin/security/overview');
    if (!res || !res.data) throw new Error(res?.message || 'Failed to load security overview.');
    return res.data;
  }

  async getUserSessions(activeOnly: boolean = true): Promise<any[]> {
    const res = await apiClient.get<ApiResponse<any[]>>('/super-admin/security/sessions', { activeOnly });
    if (!res || !res.data) throw new Error(res?.message || 'Failed to load user sessions.');
    return res.data;
  }

  async revokeSession(id: number | string): Promise<boolean> {
    const res = await apiClient.post<ApiResponse<boolean>>(`/super-admin/security/sessions/${id}/revoke`);
    if (!res || !res.data) throw new Error(res?.message || 'Failed to revoke session.');
    return true;
  }

  async revokeAllSessions(targetUserId?: number): Promise<number> {
    const res = await apiClient.post<ApiResponse<number>>('/super-admin/security/sessions/revoke-all', targetUserId ? { targetUserId } : {});
    if (!res || res.data === undefined) throw new Error(res?.message || 'Failed to revoke all sessions.');
    return res.data;
  }

  async getSecurityEvents(page: number = 1, pageSize: number = 25, severity?: string): Promise<PagedResult<SecurityEventDto>> {
    const params: any = { page, pageSize };
    if (severity && severity !== 'all') params.severity = severity;
    const res = await apiClient.get<ApiResponse<PagedResult<SecurityEventDto>>>('/super-admin/security/events', params);
    if (!res || !res.data) throw new Error(res?.message || 'Failed to load security events.');
    return res.data;
  }

  async getMfaStatus(): Promise<MfaStatusDto> {
    const res = await apiClient.get<ApiResponse<any>>('/super-admin/security/mfa/status');
    if (!res || !res.data) throw new Error(res?.message || 'Failed to load MFA status.');
    return {
      isTwoFactorEnabled: Boolean(res.data.isEnabled ?? res.data.isTwoFactorEnabled),
      remainingRecoveryCodes: Number(res.data.recoveryCodesRemaining ?? res.data.remainingRecoveryCodes ?? 0),
      userEmail: res.data.userEmail,
    };
  }

  async setupMfa(): Promise<MfaSetupResponseDto> {
    const res = await apiClient.post<ApiResponse<MfaSetupResponseDto>>('/super-admin/security/mfa/setup');
    if (!res || !res.data) throw new Error(res?.message || 'Failed to initiate MFA setup.');
    return res.data;
  }

  async verifyAndEnableMfa(code: string): Promise<boolean> {
    const res = await apiClient.post<ApiResponse<boolean>>('/super-admin/security/mfa/verify-and-enable', { code });
    if (!res || !res.data) throw new Error(res?.message || 'Failed to verify MFA code.');
    return true;
  }

  async disableMfa(password: string): Promise<boolean> {
    const res = await apiClient.post<ApiResponse<boolean>>('/super-admin/security/mfa/disable', { password });
    if (!res || !res.data) throw new Error(res?.message || 'Failed to disable MFA.');
    return true;
  }

  async getBackupStatus(): Promise<any> {
    const res = await apiClient.get<ApiResponse<any>>('/super-admin/system/backup/status');
    if (!res || !res.data) throw new Error(res?.message || 'Failed to fetch backup status.');
    return res.data;
  }

  exportPlatformSnapshot(): string {
    const snapshot = {
      exportedAt: new Date().toISOString(),
      platformVersion: 'NexusSales Enterprise v2.4',
      tenants: this.getTenants(),
      users: this.getUsers(),
      roles: this.getRoles(),
      packages: this.getPackages(),
      dids: this.getDidMappings(),
      carrierSettings: this.getCarrierSettings(),
      systemDiagnostics: this.getSystemDiagnostics(),
      announcements: this.getAnnouncements(),
    };
    return JSON.stringify(snapshot, null, 2);
  }

  async exportPlatformSnapshotApi(): Promise<string> {
    const res = await apiClient.get<ApiResponse<any>>('/super-admin/system/backup/export');
    if (res && res.data) {
      return JSON.stringify(res.data, null, 2);
    }
    throw new Error(res?.message || 'Failed to generate database backup from backend server');
  }

  async testDatabaseDiagnostic(): Promise<{ success: boolean; latencyMs: number; status: string; message: string }> {
    const res = await apiClient.post<ApiResponse<{ success: boolean; latencyMs: number; status: string; message: string }>>(
      '/super-admin/system/diagnostics/database'
    );
    if (res && res.data) return res.data;
    throw new Error(res?.message || 'Database diagnostic probe failed');
  }

  async testApiDiagnostic(): Promise<{ success: boolean; latencyMs: number; status: string; message: string }> {
    const res = await apiClient.post<ApiResponse<{ success: boolean; latencyMs: number; status: string; message: string }>>(
      '/super-admin/system/diagnostics/api'
    );
    if (res && res.data) return res.data;
    throw new Error(res?.message || 'API diagnostic probe failed');
  }
}

export const superAdminService = new SuperAdminService();

export function isAnnouncementEligibleForUser(
  ann: BroadcastAnnouncement,
  userRoleCode?: string,
  userCompanyId?: string | number
): boolean {
  if (!ann) return false;
  const role = (userRoleCode || '').toLowerCase();
  if (role === 'super_admin') return true;

  // Tenant check
  if (
    ann.targetTenantId !== undefined &&
    ann.targetTenantId !== null &&
    String(ann.targetTenantId).trim() !== '' &&
    String(ann.targetTenantId).toLowerCase() !== 'all'
  ) {
    const annTenant = String(ann.targetTenantId);
    const userTenant = userCompanyId !== undefined && userCompanyId !== null ? String(userCompanyId) : '';
    if (annTenant !== userTenant) {
      return false;
    }
  }

  // Audience check
  const audience = (ann.targetAudience || 'all').toLowerCase();
  if (audience === 'all') return true;

  if (audience === 'tenant_admins') {
    return role === 'company_admin' || role === 'super_admin';
  }

  if (audience === 'sales_reps') {
    return role === 'sales_executive' || role === 'irm' || role === 'sales_manager' || role === 'super_admin';
  }

  return true;
}
