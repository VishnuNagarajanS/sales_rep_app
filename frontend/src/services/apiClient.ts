const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  errors?: string[];
}

export interface PagedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

class ApiClient {
  private getHeaders(): HeadersInit {
    const token = sessionStorage.getItem('nexus_auth_token') || localStorage.getItem('nexus_auth_token');
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }

  private async handleResponse<T>(res: Response): Promise<T> {
    if (res.status === 401) {
      const err = await res.json().catch(() => ({ message: 'Invalid credentials.' }));
      if (!res.url.includes('/auth/login')) {
        sessionStorage.removeItem('nexus_auth_token');
        sessionStorage.removeItem('nexus_current_user');
        sessionStorage.removeItem('nexus_current_tenant');
        localStorage.removeItem('nexus_auth_token');
        localStorage.removeItem('nexus_current_user');
        localStorage.removeItem('nexus_current_tenant');
        window.dispatchEvent(new Event('nexus_auth_unauthorized'));
        throw new Error('Session expired. Please sign in again.');
      }
      throw new Error(err.message || 'Invalid email or password.');
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: res.statusText }));
      const errorMsg = err.errors && Array.isArray(err.errors) && err.errors.length > 0
        ? err.errors.join(', ')
        : (err.message || `HTTP Error ${res.status}`);
      throw new Error(errorMsg);
    }

    return res.json();
  }

  private buildUrl(endpoint: string, params?: Record<string, any>): string {
    const url = `${API_BASE_URL}${endpoint}`;
    if (!params) return url;

    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        searchParams.append(key, String(value));
      }
    });

    const queryString = searchParams.toString();
    return queryString ? `${url}${url.includes('?') ? '&' : '?'}${queryString}` : url;
  }

  async get<T>(endpoint: string, params?: Record<string, any>): Promise<T> {
    const url = this.buildUrl(endpoint, params);
    const res = await fetch(url, {
      method: 'GET',
      headers: this.getHeaders(),
    });
    return this.handleResponse<T>(res);
  }

  async post<T>(endpoint: string, body?: any): Promise<T> {
    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    });
    return this.handleResponse<T>(res);
  }

  async put<T>(endpoint: string, body: any): Promise<T> {
    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(body),
    });
    return this.handleResponse<T>(res);
  }

  async patch<T>(endpoint: string, body?: any): Promise<T> {
    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'PATCH',
      headers: this.getHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    });
    return this.handleResponse<T>(res);
  }

  async delete<T>(endpoint: string): Promise<T> {
    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
    return this.handleResponse<T>(res);
  }
}

export const apiClient = new ApiClient();
