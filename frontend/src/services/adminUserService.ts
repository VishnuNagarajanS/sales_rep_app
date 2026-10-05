import { apiClient } from './apiClient';
import { User, RoleCode } from '../types';

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
  status: number;
  lastLoginAt?: string;
  avatarUrl?: string;
  createdAt: string;
}

const checkIsJaminTenant = (idOrSlug?: any): boolean => {
  if (!idOrSlug) return false;
  const s = String(idOrSlug).toLowerCase().trim();
  return s === 'jamin' || s === 't-jamin-02' || s === '2';
};

const mapDtoToUser = (dto: AdminUserDto, isJaminTenant: boolean = false): User => {
  let statusStr: 'Active' | 'Invited' | 'Disabled' = 'Active';
  if (dto.status === 1) statusStr = 'Invited';
  if (dto.status === 2) statusStr = 'Disabled';

  let roleCode: RoleCode = 'sales_executive';
  let roleName = dto.roleName || 'Sales Executive';

  if (dto.roleName?.toLowerCase().includes('admin') || dto.roleId === 2) {
    roleCode = 'company_admin';
    roleName = 'Company Admin';
  } else if (dto.roleName?.toLowerCase().includes('manager') || dto.roleId === 3) {
    roleCode = 'sales_manager';
    roleName = 'Sales Manager';
  } else if (!isJaminTenant && (dto.roleName?.toLowerCase().includes('irm') || dto.roleId === 5)) {
    roleCode = 'irm';
    roleName = 'Institutional Relationship Manager';
  } else {
    roleCode = 'sales_executive';
    roleName = 'Sales Executive';
  }

  return {
    id: dto.id.toString(),
    name: dto.name,
    email: dto.email,
    phone: dto.phone || '',
    role: {
      id: (dto.roleId ?? 0).toString(),
      code: roleCode,
      name: roleName,
      permissions: []
    },
    status: statusStr,
    lastLogin: dto.lastLoginAt,
    avatar: dto.avatarUrl,
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
    return (res.data || []).map(dto => mapDtoToUser(dto, isJaminTenant));
  },

  getUserById: async (id: string, companyId: string): Promise<User> => {
    const res = await apiClient.get<ApiResponse<AdminUserDto>>(`/AdminUsers/${id}?companyId=${companyId}`);
    if (!res.success) throw new Error(res.message);
    const isJaminTenant = checkIsJaminTenant(companyId);
    return mapDtoToUser(res.data, isJaminTenant);
  },

  createUser: async (userData: any): Promise<User> => {
    const isJaminTenant = checkIsJaminTenant(userData.companySlug) || checkIsJaminTenant(userData.companyId);
    const roleId = resolveRoleId(userData.role?.code, isJaminTenant);
    const payload = {
      name: userData.name,
      email: userData.email,
      phone: userData.phone || '',
      password: userData.password || 'Password@123',
      roleId,
      status: userData.status === 'Active' ? 0 : (userData.status === 'Disabled' ? 2 : 1)
    };
    console.log('[AdminUserService] createUser → roleCode:', userData.role?.code, '→ roleId:', roleId, '| payload:', payload);
    const res = await apiClient.post<ApiResponse<AdminUserDto>>('/AdminUsers', payload);
    console.log('[AdminUserService] createUser ← response:', res);
    if (!res.success) throw new Error(res.message);
    return mapDtoToUser(res.data, isJaminTenant);
  },

  updateUser: async (id: string, userData: any): Promise<User> => {
    const isJaminTenant = checkIsJaminTenant(userData.companySlug) || checkIsJaminTenant(userData.companyId);
    const roleId = resolveRoleId(userData.role?.code, isJaminTenant);
    const payload = {
      name: userData.name,
      phone: userData.phone || '',
      roleId,
      status: userData.status === 'Active' ? 0 : (userData.status === 'Disabled' ? 2 : 1)
    };
    console.log('[AdminUserService] updateUser id:', id, '→ roleCode:', userData.role?.code, '→ roleId:', roleId, '| payload:', payload);
    const res = await apiClient.put<ApiResponse<AdminUserDto>>(`/AdminUsers/${id}`, payload);
    console.log('[AdminUserService] updateUser ← response:', res);
    if (!res.success) throw new Error(res.message);
    return mapDtoToUser(res.data, isJaminTenant);
  },

  deleteUser: async (id: string, companyId: string): Promise<void> => {
    const res = await apiClient.delete<ApiResponse<boolean>>(`/AdminUsers/${id}?companyId=${companyId}`);
    if (!res.success) throw new Error(res.message);
  }
};
