import { apiClient } from './apiClient';
import { User } from '../types';

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
}

const mapDtoToUser = (dto: AdminUserDto): User => {
  let statusStr: 'Active' | 'Invited' | 'Disabled' = 'Active';
  if (dto.status === 1) statusStr = 'Invited';
  if (dto.status === 2) statusStr = 'Disabled';

  // Strictly map to the 4 system roles: super_admin, company_admin, irm, sales_executive
  let roleCode: 'super_admin' | 'company_admin' | 'irm' | 'sales_executive' = 'sales_executive';
  let roleName = dto.roleName || 'Sales Executive';
  const rawCode = (dto.roleCode || '').toLowerCase();
  const rawName = (dto.roleName || '').toLowerCase();

  if (rawCode === 'super_admin' || rawName.includes('super admin')) {
    roleCode = 'super_admin';
    roleName = 'Super Admin';
  } else if (rawCode === 'company_admin' || rawName.includes('admin')) {
    roleCode = 'company_admin';
    roleName = 'Company Admin';
  } else if (rawCode === 'irm' || rawName.includes('irm') || rawName.includes('institutional')) {
    roleCode = 'irm';
    roleName = 'IRM';
  } else {
    // Anyone else (including any legacy sales_manager) is strictly Sales Executive
    roleCode = 'sales_executive';
    roleName = 'Sales Executive';
  }

  return {
    id: dto.id.toString(),
    name: dto.name,
    email: dto.email,
    phone: dto.phone || '',
    role: {
      id: (dto.roleId || (roleCode === 'company_admin' ? 2 : roleCode === 'irm' ? 4 : roleCode === 'super_admin' ? 1 : 3)).toString(),
      permissions: [],
      code: roleCode,
      name: roleName
    },
    status: statusStr,
    lastLogin: dto.lastLoginAt,
    avatar: dto.avatarUrl,
  };
};

export const adminUserService = {
  getUsers: async (companyId: string): Promise<User[]> => {
    const res = await apiClient.get<ApiResponse<AdminUserDto[]>>(`/AdminUsers?companyId=${companyId}`);
    if (!res.success) throw new Error(res.message);
    const users = (res.data || []).map(mapDtoToUser);
    try {
      localStorage.setItem('nexus_dev_users', JSON.stringify(users));
      localStorage.setItem('nexus_users', JSON.stringify(users));
      window.dispatchEvent(new Event('nexus_storage_updated'));
    } catch {}
    return users;
  },

  getUserById: async (id: string, companyId: string): Promise<User> => {
    const res = await apiClient.get<ApiResponse<AdminUserDto>>(`/AdminUsers/${id}?companyId=${companyId}`);
    if (!res.success) throw new Error(res.message);
    return mapDtoToUser(res.data);
  },

  createUser: async (userData: any): Promise<User> => {
    let roleId = 3;
    if (userData.role?.code === 'company_admin') roleId = 2;
    else if (userData.role?.code === 'irm') roleId = 4;
    else roleId = 3;

    const companyIdNum = userData.companyId === '2' || userData.companyId === 't-jamin-02' ? 2 : 1;

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
    return mapDtoToUser(res.data);
  },

  updateUser: async (id: string, userData: any): Promise<User> => {
    let roleId = 3;
    if (userData.role?.code === 'company_admin') roleId = 2;
    else if (userData.role?.code === 'irm') roleId = 4;
    else roleId = 3;

    const payload = {
      name: userData.name,
      phone: userData.phone || '',
      roleId,
      status: userData.status === 'Active' ? 0 : (userData.status === 'Disabled' ? 2 : 1)
    };
    const res = await apiClient.put<ApiResponse<AdminUserDto>>(`/AdminUsers/${id}`, payload);
    if (!res.success) throw new Error(res.message);
    return mapDtoToUser(res.data);
  },

  transferRole: async (id: string, newUserId: number, newRoleCode: string): Promise<User> => {
    let roleId = 3;
    if (newRoleCode === 'company_admin') roleId = 2;
    else if (newRoleCode === 'irm') roleId = 4;
    else roleId = 3;

    const res = await apiClient.post<ApiResponse<AdminUserDto>>(`/AdminUsers/${id}/transfer-role`, {
      newUserId,
      newRoleId: roleId
    });
    if (!res.success) throw new Error(res.message);
    return mapDtoToUser(res.data);
  },

  deleteUser: async (id: string, companyId: string): Promise<void> => {
    const res = await apiClient.delete<ApiResponse<boolean>>(`/AdminUsers/${id}?companyId=${companyId}`);
    if (!res.success) throw new Error(res.message);
  }
};
