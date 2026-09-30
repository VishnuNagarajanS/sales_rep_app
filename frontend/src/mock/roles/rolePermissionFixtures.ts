import { MOCK_ROLES } from './roleFixtures';

export const MOCK_ROLE_PERMISSIONS = Object.fromEntries(
  Object.entries(MOCK_ROLES).map(([code, role]) => [code, role.permissions])
);
