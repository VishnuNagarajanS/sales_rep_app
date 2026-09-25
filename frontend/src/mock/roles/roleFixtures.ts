import { Role } from '../../types';
import {
  MOCK_SUPER_ADMIN_PERMISSIONS,
  MOCK_COMPANY_ADMIN_PERMISSIONS,
  MOCK_SALES_MANAGER_PERMISSIONS,
  MOCK_SALES_EXECUTIVE_PERMISSIONS,
  MOCK_IRM_PERMISSIONS,
} from './rolePermissionFixtures';

export const MOCK_ROLES: Record<string, Role> = {
  super_admin: {
    id: 'role-super',
    name: 'Super Admin',
    code: 'super_admin',
    permissions: MOCK_SUPER_ADMIN_PERMISSIONS,
  },
  company_admin: {
    id: 'role-cadmin',
    name: 'Company Admin',
    code: 'company_admin',
    permissions: MOCK_COMPANY_ADMIN_PERMISSIONS,
  },
  sales_manager: {
    id: 'role-mgr',
    name: 'Sales Manager',
    code: 'sales_manager',
    permissions: MOCK_SALES_MANAGER_PERMISSIONS,
  },
  sales_executive: {
    id: 'role-exec',
    name: 'Sales Executive',
    code: 'sales_executive',
    permissions: MOCK_SALES_EXECUTIVE_PERMISSIONS,
  },
  irm: {
    id: 'role-irm',
    name: 'IRM',
    code: 'irm',
    permissions: MOCK_IRM_PERMISSIONS,
  },
};
