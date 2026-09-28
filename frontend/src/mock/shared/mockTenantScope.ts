export function isGhlScope(companyId?: string): boolean {
  return companyId === 'ghl' || companyId === 't-ghl-01';
}

export function isJaminScope(companyId?: string): boolean {
  return companyId === 'jamin' || companyId === 't-jamin-02';
}

export function matchesMockTenant(recordCompanyId?: string, queryCompanyId?: string): boolean {
  if (!queryCompanyId) return true;
  if (!recordCompanyId) return false;
  if (recordCompanyId === queryCompanyId) return true;
  if (isGhlScope(queryCompanyId) && isGhlScope(recordCompanyId)) return true;
  if (isJaminScope(queryCompanyId) && isJaminScope(recordCompanyId)) return true;
  return false;
}
