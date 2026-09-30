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
  status: number;
  lastLoginAt?: string;
  avatarUrl?: string;
  createdAt: string;
}

const mapDtoToUser = (dto: AdminUserDto): User => {
  let statusStr: 'Active' | 'Invited' | 'Disabled' = 'Active';
  if (dto.status === 1) statusStr = 'Invited';
  if (dto.status === 2) statusStr = 'Disabled';

  let roleCode = 'sales_executive';
  if (dto.roleName?.toLowerCase().includes('admin')) {
    roleCode = 'company_admin';
  } else if (dto.roleName?.toLowerCase().includes('manager')) {
    roleCode = 'sales_manager';
  }

  return {
    id: dto.id.toString(),
    name: dto.name,
    email: dto.email,
    phone: dto.phone || '',
    role: {
      code: roleCode,
      name: dto.roleName || 'Unknown Role'
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
    return (res.data || []).map(mapDtoToUser);
  },

  getUserById: async (id: string, companyId: string): Promise<User> => {
    const res = await apiClient.get<ApiResponse<AdminUserDto>>(`/AdminUsers/${id}?companyId=${companyId}`);
    if (!res.success) throw new Error(res.message);
    return mapDtoToUser(res.data);
  },

  createUser: async (userData: any): Promise<User> => {
    const payload = {
      name: userData.name,
      email: userData.email,
      phone: userData.phone || '',
      password: userData.password || 'Password@123',
      roleId: userData.role.code === 'company_admin' ? 2 : (userData.role.code === 'sales_manager' ? 3 : 4),
      status: userData.status === 'Active' ? 0 : (userData.status === 'Disabled' ? 2 : 1)
    };
    const res = await apiClient.post<ApiResponse<AdminUserDto>>('/AdminUsers', payload);
    if (!res.success) throw new Error(res.message);
    return mapDtoToUser(res.data);
  },

  updateUser: async (id: string, userData: any): Promise<User> => {
    const payload = {
      name: userData.name,
      phone: userData.phone || '',
      roleId: userData.role.code === 'company_admin' ? 2 : (userData.role.code === 'sales_manager' ? 3 : 4),
      status: userData.status === 'Active' ? 0 : (userData.status === 'Disabled' ? 2 : 1)
    };
    const res = await apiClient.put<ApiResponse<AdminUserDto>>(`/AdminUsers/${id}`, payload);
    if (!res.success) throw new Error(res.message);
    return mapDtoToUser(res.data);
  },

  deleteUser: async (id: string, companyId: string): Promise<void> => {
    const res = await apiClient.delete<ApiResponse<boolean>>(`/AdminUsers/${id}?companyId=${companyId}`);
    if (!res.success) throw new Error(res.message);
  }
};
