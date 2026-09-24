const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  errors?: string[];
  data?: T;
}

export interface LoginResponse {
  token: string;
  user: import('../types').User;
  tenant?: import('../types').Tenant | null;
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
        localStorage.removeItem('nexus_auth_token');
        localStorage.removeItem('nexus_current_user');
        window.dispatchEvent(new Event('nexus_auth_unauthorized'));
        throw new Error('Session expired. Please sign in again.');
      }
      throw new Error(err.message || 'Invalid email or password.');
    }
    if (res.status === 403) {
      const err = await res.json().catch(() => ({ message: 'You are not authorized to perform this action.' }));
      throw new Error(err.message || 'You are not authorized to perform this action.');
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: res.statusText }));
      const details = Array.isArray(err.errors) ? ` ${err.errors.join(' ')}` : '';
      throw new Error(`${err.message || `HTTP Error ${res.status}`}${details}`);
    }
    return res.json();
  }

  async get<T>(endpoint: string): Promise<T> {
    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
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

  async patch<T>(endpoint: string, body?: unknown): Promise<T> {
    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'PATCH',
      headers: this.getHeaders(),
      body: body === undefined ? undefined : JSON.stringify(body),
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
