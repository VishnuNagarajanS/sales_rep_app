import { describe, it, expect } from 'vitest';
import { canTransition, normalizeLegacyKycStatus } from './kycService';

describe('kycService', () => {
  describe('canTransition', () => {
    it('allows valid forward customer lifecycle transitions', () => {
      expect(canTransition('Pending', 'Link Sent')).toBe(true);
      expect(canTransition('Link Sent', 'In Progress')).toBe(true);
      expect(canTransition('In Progress', 'Submitted')).toBe(true);
    });

    it('blocks backward transitions in customer lifecycle', () => {
      expect(canTransition('Submitted', 'In Progress')).toBe(false);
      expect(canTransition('In Progress', 'Pending')).toBe(false);
      expect(canTransition('Submitted', 'Link Sent')).toBe(false);
    });

    it('blocks same-status transitions', () => {
      expect(canTransition('Pending', 'Pending')).toBe(false);
      expect(canTransition('Verified', 'Verified')).toBe(false);
      expect(canTransition('Submitted', 'Submitted')).toBe(false);
      expect(canTransition('In Progress', 'In Progress')).toBe(false);
    });

    it('blocks customer from transitioning to IRM-only statuses', () => {
      expect(canTransition('Submitted', 'Verified')).toBe(false);
      expect(canTransition('In Progress', 'Verified')).toBe(false);
      expect(canTransition('Pending', 'Verified')).toBe(false);
      expect(canTransition('Submitted', 'Wrong')).toBe(false);
      expect(canTransition('Submitted', 'Needs Correction')).toBe(false);
      expect(canTransition('Submitted', 'Under Verification')).toBe(false);
    });

    it('blocks skipping steps in lifecycle', () => {
      expect(canTransition('Pending', 'Submitted')).toBe(false);
      expect(canTransition('Pending', 'In Progress')).toBe(false);
    });
  });

  describe('normalizeLegacyKycStatus', () => {
    it('normalizes Pending and Partially Completed to Pending', () => {
      expect(normalizeLegacyKycStatus('Pending')).toBe('Pending');
      expect(normalizeLegacyKycStatus('Partially Completed')).toBe('Pending');
      expect(normalizeLegacyKycStatus('pending')).toBe('Pending');
    });

    it('normalizes Completed to Verified ONLY if verifiedBy is recorded', () => {
      expect(normalizeLegacyKycStatus('Completed', 'irm_user@ghl.com')).toBe('Verified');
      expect(normalizeLegacyKycStatus('Completed', 'Vikram Malhotra')).toBe('Verified');
      expect(normalizeLegacyKycStatus('Completed', null)).toBe('Pending');
      expect(normalizeLegacyKycStatus('Completed', undefined)).toBe('Pending');
      expect(normalizeLegacyKycStatus('Completed', '')).toBe('Pending');
      expect(normalizeLegacyKycStatus('Completed', '   ')).toBe('Pending');
    });

    it('preserves Verified and Wrong values set by IRM', () => {
      expect(normalizeLegacyKycStatus('Verified')).toBe('Verified');
      expect(normalizeLegacyKycStatus('Wrong')).toBe('Wrong');
    });

    it('ensures automatic or external statuses never resolve to Verified', () => {
      expect(normalizeLegacyKycStatus('PendingReview')).toBe('Pending');
      expect(normalizeLegacyKycStatus('Approved')).toBe('Pending');
      expect(normalizeLegacyKycStatus('Submitted for Review')).toBe('Pending');
      expect(normalizeLegacyKycStatus('SEBI KYC Validated')).toBe('Pending');
      expect(normalizeLegacyKycStatus('1')).toBe('Pending');
      expect(normalizeLegacyKycStatus('2')).toBe('Pending');
      expect(normalizeLegacyKycStatus(null)).toBe('Pending');
      expect(normalizeLegacyKycStatus(undefined)).toBe('Pending');
      expect(normalizeLegacyKycStatus('unknown_status')).toBe('Pending');
    });
  });
});