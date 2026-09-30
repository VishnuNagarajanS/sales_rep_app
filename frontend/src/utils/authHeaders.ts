export function getAuthHeaders(): Record<string, string> {
  const token =
    sessionStorage.getItem('nexus_auth_token') ||
    localStorage.getItem('nexus_auth_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}
