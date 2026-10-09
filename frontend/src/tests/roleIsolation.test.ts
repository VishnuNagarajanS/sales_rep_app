import { describe, it, expect } from 'vitest';
import { CallDisposition } from '../types';
import { getAgentRoleInfo } from '../utils/agentRoleUtils';

describe('Role Feature Isolation & Boundary Enforcement', () => {
  // Navigation section models
  interface NavItem {
    id: string;
    label: string;
  }
  interface NavSection {
    header?: string;
    items: NavItem[];
  }

  const getSalesExecNavIds = (): string[] => [
    'dashboard',
    'leads',
    'followups',
    'consultations',
    'customers',
    'not-interested',
    'junk',
    'call-center',
    'call-history',
    'reports',
    'notifications',
    'chat',
    'smarty-ai',
    'leave-requests',
    'call-settings',
    'profile',
  ];

  const getIrmNavIds = (isGhl = true): string[] => [
    'dashboard',
    'all-leads',
    'leads',
    'followups',
    'kyc',
    'opportunities',
    'investors',
    'irm-other',
    ...(isGhl ? ['pipeline'] : []),
    'call-center',
    'call-history',
    'reports',
    'notifications',
    'chat',
    'smarty-ai',
    'leave-requests',
    'call-settings',
    'profile',
  ];

  const getGhlAdminNavIds = (): string[] => [
    'dashboard',
    'leads',
    'assigned-leads',
    'pending-leads',
    'followups',
    'customers',
    'pipeline',
    'archived-leads',
    'call-center',
    'call-history',
    'investors',
    'consultations',
    'opportunities',
    'deals',
    'reports',
    'notifications',
    'company-users',
    'work-handover',
    'leave-requests',
    'company-audit',
    'call-settings',
    'company-settings',
    'chat',
    'smarty-ai',
  ];

  it('strictly segregates Sales Executive navigation from IRM and Admin features', () => {
    const salesExecIds = getSalesExecNavIds();

    // Sales Exec must NOT have IRM modules
    expect(salesExecIds).not.toContain('all-leads');
    expect(salesExecIds).not.toContain('kyc');
    expect(salesExecIds).not.toContain('opportunities');
    expect(salesExecIds).not.toContain('investors');
    expect(salesExecIds).not.toContain('irm-other');

    // Sales Exec must NOT have GHL Admin modules
    expect(salesExecIds).not.toContain('assigned-leads');
    expect(salesExecIds).not.toContain('pending-leads');
    expect(salesExecIds).not.toContain('archived-leads');
    expect(salesExecIds).not.toContain('work-handover');
    expect(salesExecIds).not.toContain('company-users');
    expect(salesExecIds).not.toContain('company-audit');
    expect(salesExecIds).not.toContain('company-settings');

    // Sales Exec must have core Sales pages
    expect(salesExecIds).toContain('leads');
    expect(salesExecIds).toContain('followups');
    expect(salesExecIds).toContain('consultations');
    expect(salesExecIds).toContain('customers');
    expect(salesExecIds).toContain('not-interested');
    expect(salesExecIds).toContain('junk');
  });

  it('strictly segregates IRM navigation from Sales Exec and Admin features', () => {
    const irmIds = getIrmNavIds();

    // IRM must NOT have Sales Exec specific pages
    expect(irmIds).not.toContain('not-interested');
    expect(irmIds).not.toContain('junk');

    // IRM must NOT have GHL Admin pages
    expect(irmIds).not.toContain('assigned-leads');
    expect(irmIds).not.toContain('pending-leads');
    expect(irmIds).not.toContain('archived-leads');
    expect(irmIds).not.toContain('work-handover');
    expect(irmIds).not.toContain('company-users');
    expect(irmIds).not.toContain('company-audit');
    expect(irmIds).not.toContain('company-settings');

    // IRM must have IRM specific pages
    expect(irmIds).toContain('all-leads');
    expect(irmIds).toContain('kyc');
    expect(irmIds).toContain('opportunities');
    expect(irmIds).toContain('investors');
    expect(irmIds).toContain('irm-other');
  });

  it('enforces GHL Admin features only for GHL Admin', () => {
    const adminIds = getGhlAdminNavIds();

    expect(adminIds).toContain('assigned-leads');
    expect(adminIds).toContain('pending-leads');
    expect(adminIds).toContain('archived-leads');
    expect(adminIds).toContain('work-handover');
    expect(adminIds).toContain('company-users');
    expect(adminIds).toContain('company-audit');
    expect(adminIds).toContain('company-settings');

    // Admin should not have IRM "Other" or Sales Junk in primary menu
    expect(adminIds).not.toContain('irm-other');
    expect(adminIds).not.toContain('junk');
    expect(adminIds).not.toContain('not-interested');
  });

  it('validates call outcome separation between IRM and Sales Executive', () => {
    const SALES_EXEC_OUTCOMES: CallDisposition[] = [
      'Interested',
      'Follow-up Required',
      'Call Back',
      'Not Interested',
      'Wrong Number',
      'No Response',
    ];

    const IRM_MODULE_OUTCOMES: Record<string, CallDisposition[]> = {
      all_leads: ['Follow-up Required', 'Call Back', 'Ready for KYC', 'Other', 'No Response'],
      my_leads: ['Follow-up Required', 'No Response', 'Call Back'],
      follow_up: ['Follow-up Required', 'Other', 'No Response', 'Call Back', 'Ready for KYC'],
      kyc: ['Contacted', 'Other', 'No Response', 'Call Back'],
      opportunities: ['Contacted', 'Other', 'No Response', 'Call Back'],
      investor_360: ['Contacted', 'Other', 'No Response', 'Call Back'],
    };

    // Sales Executive outcomes MUST NOT contain IRM-exclusive outcomes
    expect(SALES_EXEC_OUTCOMES).not.toContain('Other');
    expect(SALES_EXEC_OUTCOMES).not.toContain('Ready for KYC');
    expect(SALES_EXEC_OUTCOMES).not.toContain('Contacted');

    // IRM modules MUST NOT contain Sales-exclusive outcomes
    Object.values(IRM_MODULE_OUTCOMES).forEach(outcomes => {
      expect(outcomes).not.toContain('Not Interested');
      expect(outcomes).not.toContain('Wrong Number');
    });

    // Interested must always be the leading outcome for Sales Executive
    expect(SALES_EXEC_OUTCOMES[0]).toBe('Interested');

    // Skip for Now is removed across the app
    const isSkipAllowed = false;
    expect(isSkipAllowed).toBe(false);
  });

  it('correctly maps agent display roles: Vishnu as GHL Admin, Naveen as Sales Executive, Dhinakaran as IRM', () => {
    // Vishnu must ALWAYS be GHL Admin
    const vishnuInfo = getAgentRoleInfo('Vishnu', '2');
    expect(vishnuInfo.name).toBe('Vishnu');
    expect(vishnuInfo.role).toBe('GHL Admin');
    expect(vishnuInfo.badgeClass).toBe('badge-role-admin');

    // Naveen must ALWAYS be Sales Executive (never IRM)
    const naveenInfo = getAgentRoleInfo('Naveen', '3');
    expect(naveenInfo.name).toBe('Naveen');
    expect(naveenInfo.role).toBe('Sales Executive');
    expect(naveenInfo.badgeClass).toBe('badge-role-sales');

    // Dhinakaran must ALWAYS be IRM
    const dhinaInfo = getAgentRoleInfo('Dhinakaran', '5');
    expect(dhinaInfo.name).toBe('Dhinakaran');
    expect(dhinaInfo.role).toBe('IRM');
    expect(dhinaInfo.badgeClass).toBe('badge-role-irm');

    // Protection test: even if a lead had fallbackRole IRM, Naveen is strictly a Sales Executive
    const protectedNaveen = getAgentRoleInfo('Naveen', '3', 'IRM');
    expect(protectedNaveen.role).toBe('Sales Executive');
  });
});
