import { MOCK_TENANT_IDS } from './mockIds';

export function matchesMockTenant(recordCompanyId: string | undefined, targetCompanyIdOrSlug?: string): boolean {
  if (!targetCompanyIdOrSlug) return true;
  if (!recordCompanyId) return true;

  if (recordCompanyId === targetCompanyIdOrSlug) return true;

  if (
    (targetCompanyIdOrSlug === 'ghl' || targetCompanyIdOrSlug === MOCK_TENANT_IDS.GHL) &&
    (recordCompanyId === 'ghl' || recordCompanyId === MOCK_TENANT_IDS.GHL)
  ) {
    return true;
  }

  if (
    (targetCompanyIdOrSlug === 'jamin' || targetCompanyIdOrSlug === MOCK_TENANT_IDS.JAMIN) &&
    (recordCompanyId === 'jamin' || recordCompanyId === MOCK_TENANT_IDS.JAMIN)
  ) {
    return true;
  }

  return false;
}
