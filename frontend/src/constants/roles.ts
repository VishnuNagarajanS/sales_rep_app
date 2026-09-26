export const ROLE_CODES = {
  SUPER_ADMIN: 'super_admin',
  COMPANY_ADMIN: 'company_admin',
  SALES_MANAGER: 'sales_manager',
  SALES_EXECUTIVE: 'sales_executive',
  IRM: 'irm',
} as const;

export type SystemRoleCode = typeof ROLE_CODES[keyof typeof ROLE_CODES];
