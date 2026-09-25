import { User, Tenant, TenantSlug, RoleCode, Role } from '../../types';
import { MOCK_TENANTS } from '../tenants/tenantFixtures';
import { MOCK_ROLES } from '../roles/roleFixtures';
import { MOCK_USERS } from './userFixtures';

export function getMockTenant(slug: TenantSlug): Tenant {
  return MOCK_TENANTS[slug] || MOCK_TENANTS.ghl;
}

export function getMockRole(roleCode: RoleCode): Role {
  return MOCK_ROLES[roleCode] || MOCK_ROLES.company_admin;
}

export function getMockPersonaUser(roleCode: RoleCode, slug: TenantSlug = 'ghl', targetTenant?: Tenant): User {
  if (roleCode === 'super_admin') {
    const superAdmin = MOCK_USERS.find(u => u.role.code === 'super_admin');
    if (superAdmin) return superAdmin;
  }

  const resolvedTenant = targetTenant || getMockTenant(slug);

  const fixtureUser = MOCK_USERS.find(
    u => u.companySlug === slug && u.role.code === roleCode
  );
  if (fixtureUser) {
    return fixtureUser;
  }

  const name =
    roleCode === 'company_admin'
      ? slug === 'ghl'
        ? 'Vikram Malhotra'
        : slug === 'jamin'
          ? 'Kavita Rao'
          : `${resolvedTenant.name} Admin`
      : roleCode === 'irm'
        ? 'Rohan Varma'
        : slug === 'ghl'
          ? 'Ananya Iyer'
          : slug === 'jamin'
            ? 'Pooja Hegde'
            : `${resolvedTenant.name} Agent`;

  return {
    id: `usr-${slug}-${roleCode}`,
    name,
    email: `${roleCode}@${slug}.com`,
    phone: '+91 98450 00000',
    role: getMockRole(roleCode),
    companyId: resolvedTenant.id,
    companySlug: slug,
    companyName: resolvedTenant.name,
    status: 'Active',
    lastLogin: 'Just now',
  };
}

export function createMockLoginUser(
  email: string,
  roleCode: RoleCode,
  tenantSlug: TenantSlug,
  targetTenant: Tenant
): User {
  return {
    id: `usr-${Date.now()}`,
    name: email.split('@')[0].replace('.', ' '),
    email,
    phone: '+91 98000 00000',
    role: getMockRole(roleCode),
    companyId: targetTenant.id,
    companySlug: tenantSlug,
    companyName: targetTenant.name,
    status: 'Active',
    lastLogin: 'Just now',
  };
}
