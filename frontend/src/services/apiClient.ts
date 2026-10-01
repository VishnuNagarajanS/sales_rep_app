export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data: T;
  errors?: string[];
}

export interface PagedResult<T = any> {
  items: T[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
  totalPages: number;
}

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

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
        localStorage.removeItem('nexus_auth_token');
        localStorage.removeItem('nexus_current_user');
        window.dispatchEvent(new Event('nexus_auth_unauthorized'));
        throw new Error('Session expired. Please sign in again.');
      }
      throw new Error(err.message || 'Invalid email or password.');
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: res.statusText }));
      throw new Error(err.message || `HTTP Error ${res.status}`);
    }
    return res.json();
  }

  private async safeFetch(url: string, options: RequestInit, timeoutMs = 25000): Promise<Response> {
    if (typeof window !== 'undefined' && typeof window.navigator !== 'undefined' && !window.navigator.onLine) {
      throw new Error('Network unavailable: Your browser is currently offline. Please check your internet connection.');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return res;
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        throw new Error('Network timeout: The server took too long to respond. Please try again.');
      }
      if (
        typeof window !== 'undefined' &&
        (!window.navigator.onLine ||
          err.message?.includes('Failed to fetch') ||
          err.message?.includes('NetworkError') ||
          err.message?.includes('Load failed'))
      ) {
        throw new Error('Network unavailable: Unable to reach the server. Please verify your connection.');
      }
      throw err;
    }
  }

  async get<T>(endpoint: string, params?: Record<string, any>): Promise<T> {
    let url = `${API_BASE_URL}${endpoint}`;
    if (params) {
      const query = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') {
          query.append(k, String(v));
        }
      });
      const qs = query.toString();
      if (qs) {
        url += (url.includes('?') ? '&' : '?') + qs;
      }
    }
    const res = await this.safeFetch(url, {
      method: 'GET',
      headers: this.getHeaders(),
    });
    return this.handleResponse<T>(res);
  }

  async post<T>(endpoint: string, body?: any): Promise<T> {
    const res = await this.safeFetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    });
    return this.handleResponse<T>(res);
  }

  async put<T>(endpoint: string, body: any): Promise<T> {
    const res = await this.safeFetch(`${API_BASE_URL}${endpoint}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(body),
    });
    return this.handleResponse<T>(res);
  }

  async delete<T>(endpoint: string): Promise<T> {
    const res = await this.safeFetch(`${API_BASE_URL}${endpoint}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
    return this.handleResponse<T>(res);
  }

  async patch<T>(endpoint: string, body?: any): Promise<T> {
    const res = await this.safeFetch(`${API_BASE_URL}${endpoint}`, {
      method: 'PATCH',
      headers: this.getHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    });
    return this.handleResponse<T>(res);
  }
}

export const apiClient = new ApiClient();
