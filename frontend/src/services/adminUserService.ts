import { apiClient } from './apiClient';
import { User, Role, RoleCode } from '../types';

interface ApiResponse<T> {
  data: T;
  success: boolean;
  message: string;
}

interface AdminUserDto {
  id: number;
  name: string;
  email: string;
  phone: string;
  roleId: number;
  roleName: string;
  roleCode: string;
  status: number;
  lastLoginAt?: string;
  avatarUrl?: string;
  createdAt: string;
  emailSent?: boolean;
  emailError?: string;
  temporaryPassword?: string;
  isCovered?: boolean;
}

export interface CompanyRoleOption extends Role {
  isAssignable: boolean;
}

const checkIsJaminTenant = (idOrSlug?: any): boolean => {
  if (!idOrSlug) return false;
  const s = String(idOrSlug).toLowerCase().trim();
  return s === 'jamin' || s === 't-jamin-02' || s === '2';
};

const mapDtoToUser = (dto: AdminUserDto, companyIdOrIsJamin?: string | boolean): User => {
  let statusStr: 'Active' | 'Invited' | 'Disabled' = 'Active';
  if (dto.status === 1) statusStr = 'Invited';
  if (dto.status === 2) statusStr = 'Disabled';

  const isJaminTenant = typeof companyIdOrIsJamin === 'boolean' 
    ? companyIdOrIsJamin 
    : checkIsJaminTenant(companyIdOrIsJamin);

  let roleCode: RoleCode = 'sales_executive';
  let roleName = dto.roleName || 'Sales Executive';
  const rawCode = (dto.roleCode || '').toLowerCase();
  const rawName = (dto.roleName || '').toLowerCase();

  if (rawCode === 'super_admin' || rawName.includes('super admin') || dto.roleId === 1) {
    roleCode = 'super_admin';
    roleName = 'Super Admin';
  } else if (rawCode === 'company_admin' || rawName.includes('admin') || dto.roleId === 2) {
    roleCode = 'company_admin';
    roleName = 'Company Admin';
  } else if (!isJaminTenant && (rawCode === 'sales_manager' || rawName.includes('manager') || dto.roleId === 3)) {
    roleCode = 'sales_manager';
    roleName = 'Sales Manager';
  } else if (!isJaminTenant && (rawCode === 'irm' || rawName.includes('irm') || rawName.includes('institutional') || dto.roleId === 5)) {
    roleCode = 'irm';
    roleName = 'Institutional Relationship Manager';
  } else {
    roleCode = 'sales_executive';
    roleName = 'Sales Executive';
  }

  const cId = typeof companyIdOrIsJamin === 'string' ? companyIdOrIsJamin : (isJaminTenant ? '2' : '1');
  const cSlug = (cId === '1' || cId === 't-ghl-01' ? 'ghl' : (cId === '2' || cId === 't-jamin-02' ? 'jamin' : cId)) as any;

  return {
    id: dto.id.toString(),
    name: dto.name,
    email: dto.email,
    phone: dto.phone || '',
    companyId: cId,
    companySlug: cSlug,
    role: {
      id: (dto.roleId ?? (roleCode === 'company_admin' ? 2 : roleCode === 'irm' ? 5 : roleCode === 'super_admin' ? 1 : roleCode === 'sales_manager' ? 3 : 4)).toString(),
      code: roleCode,
      name: roleName,
      permissions: []
    },
    status: statusStr,
    lastLogin: dto.lastLoginAt,
    avatar: dto.avatarUrl,
    emailSent: dto.emailSent,
    emailError: dto.emailError,
    temporaryPassword: dto.temporaryPassword,
    isCovered: dto.isCovered,
  };
};

const resolveRoleId = (code?: string, isJaminTenant: boolean = false): number => {
  if (code === 'super_admin') return 1;
  if (code === 'company_admin') return 2;
  if (code === 'sales_manager') return 3;
  if (!isJaminTenant && code === 'irm') return 5;
  return 4; // sales_executive
};

export const adminUserService = {
  getUsers: async (companyId: string): Promise<User[]> => {
    const res = await apiClient.get<ApiResponse<AdminUserDto[]>>(`/AdminUsers?companyId=${companyId}`);
    if (!res.success) throw new Error(res.message);
    const isJaminTenant = checkIsJaminTenant(companyId);
    const users = (res.data || [])
      .filter(dto => !isJaminTenant || (dto.roleId !== 5 && !dto.roleName?.toLowerCase().includes('irm')))
      .map(dto => mapDtoToUser(dto, companyId));
    try {
      localStorage.setItem('nexus_dev_users', JSON.stringify(users));
      localStorage.setItem('nexus_users', JSON.stringify(users));
    } catch {}
    return users;
  },

  getCompanyRoles: async (companyId: string): Promise<CompanyRoleOption[]> => {
    const res = await apiClient.get<ApiResponse<CompanyRoleOption[]>>(`/AdminUsers/roles?companyId=${encodeURIComponent(companyId)}`);
    if (!res.success) throw new Error(res.message);
    return (res.data || []).map(role => ({ ...role, id: String(role.id), permissions: [] }));
  },

  getUserById: async (id: string, companyId: string): Promise<User> => {
    const res = await apiClient.get<ApiResponse<AdminUserDto>>(`/AdminUsers/${id}?companyId=${companyId}`);
    if (!res.success) throw new Error(res.message);
    const isJaminTenant = checkIsJaminTenant(companyId);
    return mapDtoToUser(res.data, isJaminTenant);
  },

  createUser: async (userData: any): Promise<User> => {
    const isJaminTenant = checkIsJaminTenant(userData.companySlug) || checkIsJaminTenant(userData.companyId);
    const roleId = Number(userData.role?.id) || resolveRoleId(userData.role?.code, isJaminTenant);
    const companyIdNum = isJaminTenant ? 2 : 1;

    const payload = {
      name: userData.name,
      email: userData.email,
      phone: userData.phone || '',
      password: userData.password || 'Password@123',
      roleId,
      companyId: companyIdNum,
      status: userData.status === 'Active' ? 0 : (userData.status === 'Disabled' ? 2 : 1)
    };
    const res = await apiClient.post<ApiResponse<AdminUserDto>>(`/AdminUsers?companyId=${companyIdNum}`, payload);
    if (!res.success) throw new Error(res.message);
    window.dispatchEvent(new Event('nexus_admin_updated'));
    return mapDtoToUser(res.data, isJaminTenant);
  },

  updateUser: async (id: string, userData: any): Promise<User> => {
    const isJaminTenant = checkIsJaminTenant(userData.companySlug) || checkIsJaminTenant(userData.companyId);
    const roleId = Number(userData.role?.id) || resolveRoleId(userData.role?.code, isJaminTenant);
    const payload: any = {
      name: userData.name,
      phone: userData.phone || '',
      roleId,
      status: userData.status === 'Active' ? 0 : (userData.status === 'Disabled' ? 2 : 1)
    };
    if (userData.password) {
      payload.password = userData.password;
    }
    const res = await apiClient.put<ApiResponse<AdminUserDto>>(`/AdminUsers/${id}`, payload);
    if (!res.success) throw new Error(res.message);
    window.dispatchEvent(new Event('nexus_admin_updated'));
    return mapDtoToUser(res.data, isJaminTenant);
  },

  transferRole: async (id: string, newUserId: number, newRoleCode: string): Promise<User> => {
    let roleId = 4;
    if (newRoleCode === 'company_admin') roleId = 2;
    else if (newRoleCode === 'sales_manager') roleId = 3;
    else if (newRoleCode === 'irm') roleId = 5;
    else roleId = 4;

    const res = await apiClient.post<ApiResponse<AdminUserDto>>(`/AdminUsers/${id}/transfer-role`, {
      newUserId,
      newRoleId: roleId
    });
    if (!res.success) throw new Error(res.message);
    window.dispatchEvent(new Event('nexus_admin_updated'));
    return mapDtoToUser(res.data);
  },

  deleteUser: async (id: string, companyId: string): Promise<void> => {
    const res = await apiClient.delete<ApiResponse<boolean>>(`/AdminUsers/${id}?companyId=${companyId}`);
    if (!res.success) throw new Error(res.message);
    window.dispatchEvent(new Event('nexus_admin_updated'));
  }
};
