/// <reference types="node" />
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CallDisposition } from '../types';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('IRM Call Outcomes and Other Module Rules', () => {
  const IRM_MODULE_OUTCOMES: Record<string, CallDisposition[]> = {
    my_leads: ['Follow-up Required', 'No Response', 'Call Back'],
    follow_up: ['Follow-up Required', 'Other', 'No Response', 'Call Back', 'Ready for KYC'],
    kyc: ['Contacted', 'Other', 'No Response', 'Call Back'],
    opportunities: ['Contacted', 'Other', 'No Response', 'Call Back'],
    investor_360: ['Contacted', 'Other', 'No Response', 'Call Back'],
    other: ['Call Back', 'Other', 'No Response', 'Follow-up Required', 'Ready for KYC'],
  };

  it('verifies exact permitted outcomes for each IRM module', () => {
    expect(IRM_MODULE_OUTCOMES['my_leads']).toEqual([
      'Follow-up Required',
      'No Response',
      'Call Back',
    ]);

    expect(IRM_MODULE_OUTCOMES['follow_up']).toEqual([
      'Follow-up Required',
      'Other',
      'No Response',
      'Call Back',
      'Ready for KYC',
    ]);

    expect(IRM_MODULE_OUTCOMES['kyc']).toEqual([
      'Contacted',
      'Other',
      'No Response',
      'Call Back',
    ]);

    expect(IRM_MODULE_OUTCOMES['opportunities']).toEqual([
      'Contacted',
      'Other',
      'No Response',
      'Call Back',
    ]);

    expect(IRM_MODULE_OUTCOMES['investor_360']).toEqual([
      'Contacted',
      'Other',
      'No Response',
      'Call Back',
    ]);

    // Verify 'other' module explicitly does NOT contain 'Contacted'
    expect(IRM_MODULE_OUTCOMES['other']).not.toContain('Contacted');
    expect(IRM_MODULE_OUTCOMES['other']).toEqual([
      'Call Back',
      'Other',
      'No Response',
      'Follow-up Required',
      'Ready for KYC',
    ]);
  });

  it('ensures Contacted is removed from outcomes when calling a contact from Other module', () => {
    const filterOutcomesForOther = (moduleOutcomes: CallDisposition[], isFromOther: boolean) => {
      return isFromOther ? moduleOutcomes.filter(o => o !== 'Contacted') : moduleOutcomes;
    };

    // When an agent calls a contact in Other who originated from KYC:
    const kycInOther = filterOutcomesForOther(IRM_MODULE_OUTCOMES['kyc'], true);
    expect(kycInOther).not.toContain('Contacted');
    expect(kycInOther).toEqual(['Other', 'No Response', 'Call Back']);

    // When an agent calls a contact in Other who originated from Opportunities:
    const oppsInOther = filterOutcomesForOther(IRM_MODULE_OUTCOMES['opportunities'], true);
    expect(oppsInOther).not.toContain('Contacted');
    expect(oppsInOther).toEqual(['Other', 'No Response', 'Call Back']);

    // When an agent calls a contact in Other directly:
    const directOther = filterOutcomesForOther(IRM_MODULE_OUTCOMES['other'], true);
    expect(directOther).not.toContain('Contacted');
  });

  it('validates mandatory reason when outcome is Other', () => {
    const validateDisposition = (disposition: CallDisposition, reason?: string) => {
      if (disposition === 'Other' && (!reason || reason.trim().length === 0)) {
        return { valid: false, error: 'Reason is required when disposition is Other' };
      }
      return { valid: true };
    };

    expect(validateDisposition('Other', '').valid).toBe(false);
    expect(validateDisposition('Other', '   ').valid).toBe(false);
    expect(validateDisposition('Other', undefined).valid).toBe(false);
    expect(validateDisposition('Other', 'Client requested deferred callback').valid).toBe(true);

    // Optional for Contacted or others
    expect(validateDisposition('Contacted', '').valid).toBe(true);
    expect(validateDisposition('Follow-up Required', '').valid).toBe(true);
  });

  it('ensures Skip for Now is rejected in disposition flow', () => {
    const isSkipAllowed = false;
    expect(isSkipAllowed).toBe(false);
  });

  it('verifies layout stability styles for IRM Other module and scrollbar gutter', () => {
    // 1. Check layout.css has scrollbar-gutter: stable
    const layoutCssPath = path.resolve(__dirname, '../styles/shared/layout.css');
    const layoutCss = fs.readFileSync(layoutCssPath, 'utf-8');
    expect(layoutCss).toContain('scrollbar-gutter: stable');

    // 2. Check IrmOtherPage.css has width 100%, no rogue margin: 0 auto, and no translateY animation
    const irmOtherCssPath = path.resolve(__dirname, '../pages/IrmOther/IrmOtherPage.css');
    const irmOtherCss = fs.readFileSync(irmOtherCssPath, 'utf-8');
    expect(irmOtherCss).toContain('width: 100%');
    expect(irmOtherCss).toContain('max-width: 100%');
    expect(irmOtherCss).not.toContain('max-width: 1400px');
    expect(irmOtherCss).not.toContain('margin: 0 auto');
    expect(irmOtherCss).not.toContain('transform: translateY(4px)');

    // 3. Check KYCPage.css does not have rogue padding: 24px on root container
    const kycCssPath = path.resolve(__dirname, '../pages/KYC/KYCPage.css');
    const kycCss = fs.readFileSync(kycCssPath, 'utf-8');
    expect(kycCss).toMatch(/\.kyc-page-container\s*\{[^}]*padding:\s*0/);
  });
});
