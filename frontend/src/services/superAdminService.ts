import {
  Tenant,
  User,
  Role,
  AuditLog,
  SubscriptionPackage,
  TenantDidMapping,
  PlatformCarrierSettings,
  SystemDiagnostics,
  BroadcastAnnouncement,
  PlatformMetrics,
} from '../types';
import { DEFAULT_TENANTS } from '../constants/defaultTenants';
import { SYSTEM_ROLES } from '../constants/roles';
import { FEATURES } from '../constants/features';

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
};

// Dispatch storage update helper
export const notifyAdminStorageUpdated = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('nexus_storage_updated'));
    window.dispatchEvent(new Event('nexus_admin_updated'));
  }
};

// ============================================================================
// Initial Seed Data
// ============================================================================

const SEED_PACKAGES: SubscriptionPackage[] = [
  {
    id: 'pkg-standard-crm',
    name: 'Starter CRM Tier',
    code: 'starter_crm',
    description: 'Essential inbound leads, customer directory, softphone calling, and follow-ups.',
    tier: 'Starter',
    priceMonthly: 14999,
    currency: '₹',
    maxUsers: 15,
    maxStorageGb: 50,
    features: [
      FEATURES.LEADS,
      FEATURES.CUSTOMERS,
      FEATURES.FOLLOWUPS,
      FEATURES.CALLS,
      FEATURES.REPORTS,
    ],
    isActive: true,
    enrolledTenantsCount: 0,
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'pkg-real-estate-pro',
    name: 'Plotted Land Operations Pro',
    code: 'jamin_real_estate_pro',
    description: 'Tailored for plotted development builders with interactive plot layouts, site visit logistics, and token bookings.',
    tier: 'Growth',
    priceMonthly: 39999,
    currency: '₹',
    maxUsers: 50,
    maxStorageGb: 250,
    features: [
      FEATURES.LEADS,
      FEATURES.CUSTOMERS,
      FEATURES.DEALS,
      FEATURES.FOLLOWUPS,
      FEATURES.CALLS,
      FEATURES.CALL_RECORDING,
      FEATURES.CALL_TRANSCRIPTION,
      FEATURES.PROPERTIES,
      FEATURES.SITE_VISITS,
      FEATURES.BOOKINGS,
      FEATURES.REPORTS,
    ],
    isPopular: true,
    isActive: true,
    enrolledTenantsCount: 1,
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'pkg-wealth-enterprise',
    name: 'Wealth Advisory Enterprise Suite',
    code: 'ghl_wealth_enterprise',
    description: 'Engineered for institutional capital syndicates, private family offices, and CRE investment opportunities.',
    tier: 'Enterprise',
    priceMonthly: 79999,
    currency: '₹',
    maxUsers: 150,
    maxStorageGb: 1000,
    features: [
      FEATURES.LEADS,
      FEATURES.CUSTOMERS,
      FEATURES.DEALS,
      FEATURES.FOLLOWUPS,
      FEATURES.CALLS,
      FEATURES.CALL_RECORDING,
      FEATURES.CALL_TRANSCRIPTION,
      FEATURES.INVESTORS,
      FEATURES.CONSULTATIONS,
      FEATURES.INVESTMENT_OPPORTUNITIES,
      FEATURES.REPORTS,
    ],
    isActive: true,
    enrolledTenantsCount: 1,
    createdAt: '2026-01-01T00:00:00Z',
  },
];

const SEED_DIDS: TenantDidMapping[] = [
  {
    id: 'did-001',
    phoneNumber: '+91 80 4700 8001',
    tenantId: '1',
    tenantName: 'GHL India Ventures',
    tenantSlug: 'ghl',
    routingStrategy: 'Skill/Priority',
    queueName: 'HNW Wealth Advisory Queue',
    enableRecording: true,
    enableAiWhisper: true,
    status: 'Online',
    channelsCount: 8,
    allocatedAt: '2026-01-10T10:00:00Z',
    notes: 'Primary inbound trunk for HNW wealth consultations',
  },
  {
    id: 'did-002',
    phoneNumber: '+91 80 4700 8002',
    tenantId: '2',
    tenantName: 'Jamin Bazaar',
    tenantSlug: 'jamin',
    routingStrategy: 'Round-Robin',
    queueName: 'Plotted Enclaves Telecallers',
    enableRecording: true,
    enableAiWhisper: true,
    status: 'Online',
    channelsCount: 12,
    allocatedAt: '2026-01-15T14:30:00Z',
    notes: 'Buyer inquiry hotline for gated community layouts',
  },
  {
    id: 'did-003',
    phoneNumber: '+91 80 4700 8003',
    tenantId: '',
    tenantName: 'Unassigned Pool',
    tenantSlug: '',
    routingStrategy: 'Round-Robin',
    queueName: 'Available DID Reserve',
    enableRecording: false,
    enableAiWhisper: false,
    status: 'Reserved',
    channelsCount: 4,
    allocatedAt: '2026-02-01T09:00:00Z',
    notes: 'Spare DID number for next enterprise onboarding',
  },
];

const SEED_CARRIER_SETTINGS: PlatformCarrierSettings = {
  primaryCarrier: 'Twilio Elastic SIP Trunking (Mumbai AP-South)',
  secondaryCarrier: 'Exotel Cloud Gateway (Failover Redundant)',
  sipRealm: 'sip.trunk.nexusplatform.io:5060',
  webrtcGatewayUrl: 'wss://webrtc.nexusplatform.io/gateway',
  recordingRetentionDays: 180,
  maxConcurrentChannels: 100,
  emergencyRoutingEnabled: true,
  whisperAiModel: 'OpenAI Whisper-Large-v3 (Self-Hosted on GPU cluster)',
  lastTestedAt: '2026-09-26T10:00:00Z',
  testStatus: 'Success',
};

const SEED_ANNOUNCEMENTS: BroadcastAnnouncement[] = [
  {
    id: 'ann-001',
    title: 'Platform Infrastructure Upgrade',
    message: 'Scheduled zero-downtime database optimization today at 11:30 PM IST. Telephony routing will not be interrupted.',
    priority: 'info',
    targetAudience: 'all',
    isActive: true,
    createdAt: '2026-09-26T08:00:00Z',
    createdBy: 'Alex Rivera (Super Admin)',
    expiresAt: '2026-09-27T06:00:00Z',
  },
];

// ============================================================================
// Service Implementation
// ============================================================================

class SuperAdminService {
  // ── TENANTS / COMPANIES ───────────────────────────────────────────────────

  getTenants(): Tenant[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.TENANTS);
      if (!raw) {
        const initial = [
          {
            ...DEFAULT_TENANTS.ghl,
            status: 'Active' as const,
            subscriptionPlan: 'Wealth Advisory Enterprise Suite',
            leadSla: 15,
            callEnabled: true,
            recordingEnabled: true,
            transcriptionEnabled: true,
          },
          {
            ...DEFAULT_TENANTS.jamin,
            status: 'Active' as const,
            subscriptionPlan: 'Plotted Land Operations Pro',
            leadSla: 30,
            callEnabled: true,
            recordingEnabled: true,
            transcriptionEnabled: true,
          },
        ];
        localStorage.setItem(STORAGE_KEYS.TENANTS, JSON.stringify(initial));
        return initial;
      }
      return JSON.parse(raw);
    } catch {
      return [DEFAULT_TENANTS.ghl, DEFAULT_TENANTS.jamin];
    }
  }

  getTenantById(id: string): Tenant | undefined {
    return this.getTenants().find(t => t.id === id || t.slug === id);
  }

  createTenant(
    tenantData: Partial<Tenant>,
    adminUserData?: { name: string; email: string; phone?: string; password?: string },
    didData?: { phoneNumber?: string; routingStrategy?: string }
  ): Tenant {
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

    // Provision the initial Company Admin user if details provided
    if (adminUserData && adminUserData.email) {
      const newUser: User = {
        id: `usr-${cleanSlug}-admin-${Date.now().toString().slice(-4)}`,
        name: adminUserData.name || 'Primary Admin',
        email: adminUserData.email.toLowerCase().trim(),
        phone: adminUserData.phone || '+91 98000 00000',
        role: SYSTEM_ROLES.company_admin,
        companyId: newTenant.id,
        companySlug: newTenant.slug,
        companyName: newTenant.name,
        status: 'Active',
        lastLogin: 'Never (Newly Invited)',
        createdAt: new Date().toISOString(),
      };
      this.createUser(newUser);
    }

    // Allocate DID if provided
    if (didData && didData.phoneNumber) {
      this.createDidMapping({
        phoneNumber: didData.phoneNumber,
        tenantId: newTenant.id,
        tenantName: newTenant.name,
        tenantSlug: newTenant.slug,
        routingStrategy: (didData.routingStrategy as any) || 'Round-Robin',
        queueName: `${newTenant.name} Inbound`,
        enableRecording: true,
        enableAiWhisper: true,
        status: 'Online',
        channelsCount: 6,
      });
    }

    // Record audit event
    this.addAuditLog({
      action: 'PROVISION_TENANT',
      entityType: 'Tenant',
      entityId: newTenant.id,
      companyId: newTenant.id,
      companyName: newTenant.name,
      details: `Super Admin provisioned new tenant organization: "${newTenant.name}" (${newTenant.industry}) with ${newTenant.enabledFeatures.length} features.`,
      module: 'Companies',
      status: 'success',
      afterValue: newTenant,
    });

    notifyAdminStorageUpdated();
    return newTenant;
  }

  updateTenant(tenant: Tenant): Tenant {
    const tenants = this.getTenants();
    const idx = tenants.findIndex(t => t.id === tenant.id);
    const before = idx >= 0 ? tenants[idx] : null;

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

    this.addAuditLog({
      action: 'UPDATE_TENANT',
      entityType: 'Tenant',
      entityId: tenant.id,
      companyId: tenant.id,
      companyName: tenant.name,
      details: `Super Admin updated organization settings for "${tenant.name}".`,
      module: 'Companies',
      status: 'success',
      beforeValue: before || undefined,
      afterValue: updated,
    });

    notifyAdminStorageUpdated();
    return updated;
  }

  toggleTenantStatus(id: string, status: 'Active' | 'Inactive' | 'Suspended'): Tenant | undefined {
    const tenants = this.getTenants();
    const tenant = tenants.find(t => t.id === id);
    if (!tenant) return undefined;

    const previousStatus = tenant.status || 'Active';
    tenant.status = status;
    tenant.updatedAt = new Date().toISOString();

    localStorage.setItem(STORAGE_KEYS.TENANTS, JSON.stringify(tenants));

    this.addAuditLog({
      action: 'STATUS_CHANGE',
      entityType: 'Tenant',
      entityId: tenant.id,
      companyId: tenant.id,
      companyName: tenant.name,
      details: `Organization status changed from ${previousStatus} to ${status}.`,
      module: 'Companies',
      status: 'success',
      beforeValue: { status: previousStatus },
      afterValue: { status },
    });

    notifyAdminStorageUpdated();
    return tenant;
  }

  deleteTenant(id: string): boolean {
    const tenants = this.getTenants();
    const target = tenants.find(t => t.id === id);
    if (!target) return false;

    const filtered = tenants.filter(t => t.id !== id);
    localStorage.setItem(STORAGE_KEYS.TENANTS, JSON.stringify(filtered));

    this.addAuditLog({
      action: 'DELETE_TENANT',
      entityType: 'Tenant',
      entityId: id,
      companyName: target.name,
      details: `Super Admin deleted tenant organization: "${target.name}".`,
      module: 'Companies',
      status: 'success',
      beforeValue: target,
    });

    notifyAdminStorageUpdated();
    return true;
  }

  getTenantStats(tenantId: string) {
    const users = this.getUsers({ companyId: tenantId });
    const dids = this.getDidMappings().filter(d => d.tenantId === tenantId);
    return {
      usersCount: users.length,
      activeUsersCount: users.filter(u => u.status === 'Active').length,
      didsCount: dids.length,
    };
  }

  // ── USERS ─────────────────────────────────────────────────────────────────

  getUsers(filters?: { companyId?: string; roleCode?: string; status?: string; search?: string }): User[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.USERS);
      let users: User[] = raw ? JSON.parse(raw) : [];

      // Seed if empty
      if (users.length === 0) {
        users = [
          {
            id: 'usr-super-01',
            name: 'Alex Rivera (Super Admin)',
            email: 'alex@nexusplatform.io',
            phone: '+91 98800 11000',
            role: SYSTEM_ROLES.super_admin,
            status: 'Active',
            lastLogin: 'Just now',
            createdAt: '2026-01-01T00:00:00Z',
          },
          {
            id: 'usr-ghl-admin-01',
            name: 'Vikram Malhotra',
            email: 'vikram@ghlindiatrust.com',
            phone: '+91 98450 11223',
            role: SYSTEM_ROLES.company_admin,
            companyId: '1',
            companySlug: 'ghl',
            companyName: 'GHL India Ventures',
            status: 'Active',
            lastLogin: '10 mins ago',
            designation: 'Chief Investment Officer',
            createdAt: '2026-01-01T00:00:00Z',
          },
          {
            id: 'usr-ghl-exec-01',
            name: 'Ananya Iyer',
            email: 'ananya@ghlindiatrust.com',
            phone: '+91 98450 22334',
            role: SYSTEM_ROLES.sales_executive,
            companyId: '1',
            companySlug: 'ghl',
            companyName: 'GHL India Ventures',
            status: 'Active',
            lastLogin: '1 hour ago',
            designation: 'Senior Wealth Advisory Rep',
            createdAt: '2026-01-02T00:00:00Z',
          },
          {
            id: 'usr-ghl-irm-01',
            name: 'Rohan Varma',
            email: 'rohan.varma@ghlindiatrust.com',
            phone: '+91 98110 77889',
            role: SYSTEM_ROLES.irm,
            companyId: '1',
            companySlug: 'ghl',
            companyName: 'GHL India Ventures',
            status: 'Active',
            lastLogin: 'Yesterday',
            designation: 'Institutional Relationship Manager',
            createdAt: '2026-01-05T00:00:00Z',
          },
          {
            id: 'usr-jamin-admin-01',
            name: 'Kavita Rao',
            email: 'kavita@jaminbazaar.com',
            phone: '+91 98450 33445',
            role: SYSTEM_ROLES.company_admin,
            companyId: '2',
            companySlug: 'jamin',
            companyName: 'Jamin Bazaar',
            status: 'Active',
            lastLogin: '2 hours ago',
            designation: 'Head of Sales & Marketing',
            createdAt: '2026-01-01T00:00:00Z',
          },
          {
            id: 'usr-jamin-exec-01',
            name: 'Rajesh Sharma',
            email: 'rajesh@jaminbazaar.com',
            phone: '+91 98450 44556',
            role: SYSTEM_ROLES.sales_executive,
            companyId: '2',
            companySlug: 'jamin',
            companyName: 'Jamin Bazaar',
            status: 'Active',
            lastLogin: '3 hours ago',
            designation: 'Senior Land Acquisition Consultant',
            createdAt: '2026-01-03T00:00:00Z',
          },
        ];
        localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
      }

      if (!filters) return users;

      return users.filter(u => {
        if (filters.companyId && filters.companyId !== 'all') {
          if (filters.companyId === 'global' && u.companyId) return false;
          if (filters.companyId !== 'global' && u.companyId !== filters.companyId) return false;
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

    const newUser: User = {
      id: newId,
      name: userData.name || 'New User',
      email: (userData.email || '').toLowerCase().trim(),
      phone: userData.phone || '+91 98000 00000',
      role: userData.role || SYSTEM_ROLES.sales_executive,
      companyId: userData.companyId,
      companySlug,
      companyName,
      status: (userData.status as any) || 'Active',
      lastLogin: 'Never (Invited)',
      designation: userData.designation || 'Sales Professional',
      employeeCode: userData.employeeCode || `EMP-${Date.now().toString().slice(-4)}`,
      createdAt: new Date().toISOString(),
      ...userData,
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
    if (target.email === 'alex@nexusplatform.io') return false;

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

  getRoles(): Record<string, Role> {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.ROLES);
      if (!raw) {
        localStorage.setItem(STORAGE_KEYS.ROLES, JSON.stringify(SYSTEM_ROLES));
        return SYSTEM_ROLES;
      }
      return JSON.parse(raw);
    } catch {
      return SYSTEM_ROLES;
    }
  }

  updateRolePermissions(roleCode: string, permissions: string[]): boolean {
    const roles = this.getRoles();
    if (!roles[roleCode]) return false;

    const before = [...roles[roleCode].permissions];
    roles[roleCode].permissions = permissions;
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
      code: cleanCode as any,
      permissions,
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

  getPackages(): SubscriptionPackage[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.PACKAGES);
      if (!raw) {
        localStorage.setItem(STORAGE_KEYS.PACKAGES, JSON.stringify(SEED_PACKAGES));
        return SEED_PACKAGES;
      }
      return JSON.parse(raw);
    } catch {
      return SEED_PACKAGES;
    }
  }

  getPackageById(id: string): SubscriptionPackage | undefined {
    return this.getPackages().find(p => p.id === id || p.code === id);
  }

  createPackage(pkgData: Partial<SubscriptionPackage>): SubscriptionPackage {
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

    this.addAuditLog({
      action: 'CREATE_PACKAGE',
      entityType: 'SubscriptionPackage',
      entityId: newPkg.id,
      details: `Super Admin created subscription package tier: "${newPkg.name}" with ${newPkg.features.length} enabled modules.`,
      module: 'Features',
      status: 'success',
      afterValue: newPkg,
    });

    notifyAdminStorageUpdated();
    return newPkg;
  }

  updatePackage(pkg: SubscriptionPackage): SubscriptionPackage {
    const packages = this.getPackages();
    const idx = packages.findIndex(p => p.id === pkg.id);
    const before = idx >= 0 ? packages[idx] : null;

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

    this.addAuditLog({
      action: 'UPDATE_PACKAGE',
      entityType: 'SubscriptionPackage',
      entityId: pkg.id,
      details: `Super Admin updated package tier "${pkg.name}".`,
      module: 'Features',
      status: 'success',
      beforeValue: before || undefined,
      afterValue: updated,
    });

    notifyAdminStorageUpdated();
    return updated;
  }

  deletePackage(id: string): boolean {
    const packages = this.getPackages();
    const target = packages.find(p => p.id === id);
    if (!target) return false;

    const filtered = packages.filter(p => p.id !== id);
    localStorage.setItem(STORAGE_KEYS.PACKAGES, JSON.stringify(filtered));

    this.addAuditLog({
      action: 'DELETE_PACKAGE',
      entityType: 'SubscriptionPackage',
      entityId: id,
      details: `Super Admin removed package tier: "${target.name}".`,
      module: 'Features',
      status: 'success',
      beforeValue: target,
    });

    notifyAdminStorageUpdated();
    return true;
  }

  // ── TELEPHONY & DID MAPPINGS ──────────────────────────────────────────────

  getDidMappings(): TenantDidMapping[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.DIDS);
      if (!raw) {
        localStorage.setItem(STORAGE_KEYS.DIDS, JSON.stringify(SEED_DIDS));
        return SEED_DIDS;
      }
      return JSON.parse(raw);
    } catch {
      return SEED_DIDS;
    }
  }

  createDidMapping(didData: Partial<TenantDidMapping>): TenantDidMapping {
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

    this.addAuditLog({
      action: 'ALLOCATE_DID',
      entityType: 'TenantDidMapping',
      entityId: newDid.id,
      companyId: newDid.tenantId || undefined,
      companyName: newDid.tenantName,
      details: `Super Admin allocated virtual DID number "${newDid.phoneNumber}" to ${newDid.tenantName || 'Reserve Pool'}.`,
      module: 'CallConfig',
      status: 'success',
      afterValue: newDid,
    });

    notifyAdminStorageUpdated();
    return newDid;
  }

  updateDidMapping(id: string, updates: Partial<TenantDidMapping>): TenantDidMapping | undefined {
    const dids = this.getDidMappings();
    const idx = dids.findIndex(d => d.id === id);
    if (idx === -1) return undefined;

    const before = { ...dids[idx] };
    const updated: TenantDidMapping = {
      ...dids[idx],
      ...updates,
    };

    dids[idx] = updated;
    localStorage.setItem(STORAGE_KEYS.DIDS, JSON.stringify(dids));

    this.addAuditLog({
      action: 'UPDATE_DID',
      entityType: 'TenantDidMapping',
      entityId: id,
      companyId: updated.tenantId || undefined,
      companyName: updated.tenantName,
      details: `Super Admin updated DID configuration for ${updated.phoneNumber}.`,
      module: 'CallConfig',
      status: 'success',
      beforeValue: before,
      afterValue: updated,
    });

    notifyAdminStorageUpdated();
    return updated;
  }

  deleteDidMapping(id: string): boolean {
    const dids = this.getDidMappings();
    const target = dids.find(d => d.id === id);
    if (!target) return false;

    const filtered = dids.filter(d => d.id !== id);
    localStorage.setItem(STORAGE_KEYS.DIDS, JSON.stringify(filtered));

    this.addAuditLog({
      action: 'RELEASE_DID',
      entityType: 'TenantDidMapping',
      entityId: id,
      companyId: target.tenantId || undefined,
      companyName: target.tenantName,
      details: `Super Admin released virtual DID number ${target.phoneNumber}.`,
      module: 'CallConfig',
      status: 'success',
      beforeValue: target,
    });

    notifyAdminStorageUpdated();
    return true;
  }

  getCarrierSettings(): PlatformCarrierSettings {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.CARRIER_SETTINGS);
      if (!raw) {
        localStorage.setItem(STORAGE_KEYS.CARRIER_SETTINGS, JSON.stringify(SEED_CARRIER_SETTINGS));
        return SEED_CARRIER_SETTINGS;
      }
      return JSON.parse(raw);
    } catch {
      return SEED_CARRIER_SETTINGS;
    }
  }

  updateCarrierSettings(settings: PlatformCarrierSettings): PlatformCarrierSettings {
    localStorage.setItem(STORAGE_KEYS.CARRIER_SETTINGS, JSON.stringify(settings));

    this.addAuditLog({
      action: 'UPDATE_CARRIER_SETTINGS',
      entityType: 'CarrierSettings',
      entityId: 'global',
      details: `Super Admin updated platform carrier trunk and SIP credentials (${settings.primaryCarrier}).`,
      module: 'CallConfig',
      status: 'success',
      afterValue: settings,
    });

    notifyAdminStorageUpdated();
    return settings;
  }

  testCarrierConnection(): Promise<{ success: boolean; latencyMs: number; message: string }> {
    return new Promise(resolve => {
      setTimeout(() => {
        const settings = this.getCarrierSettings();
        settings.lastTestedAt = new Date().toISOString();
        settings.testStatus = 'Success';
        localStorage.setItem(STORAGE_KEYS.CARRIER_SETTINGS, JSON.stringify(settings));
        notifyAdminStorageUpdated();
        resolve({
          success: true,
          latencyMs: 24,
          message: 'SIP Gateway handshake verified. Carrier trunk active across Mumbai AP-South with 0.0% packet drop.',
        });
      }, 900);
    });
  }

  // ── AUDIT LOGS ────────────────────────────────────────────────────────────

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
        id: `aud-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        timestamp: new Date().toISOString(),
        actorName: log.actorName || 'Alex Rivera (Super Admin)',
        actorEmail: log.actorEmail || 'alex@nexusplatform.io',
        action: log.action || 'PLATFORM_OPERATION',
        entityType: log.entityType || 'Platform',
        entityId: log.entityId || '0',
        companyId: log.companyId,
        companyName: log.companyName || (log.companyId ? `Company #${log.companyId}` : 'PLATFORM CONSOLE'),
        details: log.details || 'Platform operation executed.',
        ipAddress: '127.0.0.1 (Platform Console)',
        userAgent: 'Nexus Platform Console v2.4 (Internal)',
        module: log.module || 'Platform',
        status: log.status || 'success',
        beforeValue: log.beforeValue,
        afterValue: log.afterValue,
      };

      logs.unshift(newLog);
      // Keep up to 1000 logs in storage
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

  getSystemDiagnostics(): SystemDiagnostics {
    return {
      apiStatus: 'Healthy',
      apiLatencyMs: 18,
      dbPoolActive: 14,
      dbPoolMax: 60,
      dbLatencyMs: 6,
      memoryUsedMb: 428,
      memoryLimitMb: 2048,
      storageUsedGb: 8.4,
      storageLimitGb: 250,
      activeSessions: 38,
      activeWebSockets: 19,
      telephonyDropRate: 0.0,
      systemUptimePercentage: 99.98,
      lastBackupAt: new Date(Date.now() - 3600000 * 4).toISOString(),
    };
  }

  getAnnouncements(): BroadcastAnnouncement[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.ANNOUNCEMENTS);
      if (!raw) {
        localStorage.setItem(STORAGE_KEYS.ANNOUNCEMENTS, JSON.stringify(SEED_ANNOUNCEMENTS));
        return SEED_ANNOUNCEMENTS;
      }
      return JSON.parse(raw);
    } catch {
      return SEED_ANNOUNCEMENTS;
    }
  }

  createAnnouncement(ann: Partial<BroadcastAnnouncement>): BroadcastAnnouncement {
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
      createdBy: 'Alex Rivera (Super Admin)',
      expiresAt: ann.expiresAt,
      ...ann,
    };

    list.unshift(newAnn);
    localStorage.setItem(STORAGE_KEYS.ANNOUNCEMENTS, JSON.stringify(list));

    this.addAuditLog({
      action: 'PUBLISH_ANNOUNCEMENT',
      entityType: 'BroadcastAnnouncement',
      entityId: newAnn.id,
      details: `Super Admin published broadcast banner: "${newAnn.title}" [${newAnn.priority.toUpperCase()}].`,
      module: 'System',
      status: 'success',
      afterValue: newAnn,
    });

    notifyAdminStorageUpdated();
    return newAnn;
  }

  toggleAnnouncement(id: string, isActive: boolean): boolean {
    const list = this.getAnnouncements();
    const item = list.find(a => a.id === id);
    if (!item) return false;

    item.isActive = isActive;
    localStorage.setItem(STORAGE_KEYS.ANNOUNCEMENTS, JSON.stringify(list));
    notifyAdminStorageUpdated();
    return true;
  }

  deleteAnnouncement(id: string): boolean {
    const list = this.getAnnouncements();
    const filtered = list.filter(a => a.id !== id);
    localStorage.setItem(STORAGE_KEYS.ANNOUNCEMENTS, JSON.stringify(filtered));
    notifyAdminStorageUpdated();
    return true;
  }

  getMaintenanceMode(): { enabled: boolean; message: string; bypassSecret: string } {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.MAINTENANCE_MODE);
      return raw ? JSON.parse(raw) : { enabled: false, message: 'Platform under scheduled maintenance.', bypassSecret: 'nexus-admin-2026' };
    } catch {
      return { enabled: false, message: 'Platform under scheduled maintenance.', bypassSecret: 'nexus-admin-2026' };
    }
  }

  setMaintenanceMode(enabled: boolean, message?: string) {
    const current = this.getMaintenanceMode();
    const updated = {
      ...current,
      enabled,
      message: message || current.message,
    };
    localStorage.setItem(STORAGE_KEYS.MAINTENANCE_MODE, JSON.stringify(updated));

    this.addAuditLog({
      action: 'MAINTENANCE_MODE',
      entityType: 'System',
      entityId: 'global',
      details: `Super Admin ${enabled ? 'ENABLED' : 'DISABLED'} platform maintenance mode.`,
      module: 'System',
      status: 'success',
      afterValue: updated,
    });

    notifyAdminStorageUpdated();
    return updated;
  }

  // ── PLATFORM TELEMETRY METRICS ────────────────────────────────────────────

  getPlatformMetrics(): PlatformMetrics {
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
      callsToday: 384,
      callsConnected: 341,
      totalLeads: 2480,
      totalPipelineValue: 485000000, // ₹48.5 Cr
      totalCustomers: 864,
      systemHealthScore: 99.98,
    };
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
}

export const superAdminService = new SuperAdminService();
