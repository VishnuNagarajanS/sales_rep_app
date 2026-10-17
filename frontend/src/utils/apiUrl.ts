/**
 * Builds a backend URL that honours VITE_API_URL (same base as apiClient).
 * Use for raw fetch() calls that need custom handling (FormData, PATCH with error bodies, etc.):
 *   fetch(apiUrl('/irm/kyc/all'), { headers: getAuthHeaders() })
 */
const API_BASE_URL: string = (import.meta.env.VITE_API_URL as string | undefined) || '/api';

export function apiUrl(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${p}`;
}
