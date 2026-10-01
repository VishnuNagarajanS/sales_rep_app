import { describe, it, expect } from 'vitest';
import { kycValidators } from './kycValidators';

describe('kycValidators', () => {
  describe('pan', () => {
    it('validates correct PAN formats', () => {
      expect(kycValidators.pan('ABCPE1234F')).toBe(true);
      expect(kycValidators.pan('abcpe1234f')).toBe(true);
    });

    it('rejects invalid PAN formats', () => {
      expect(kycValidators.pan('ABCDE12345')).toBe(false);
      expect(kycValidators.pan('ABCDX1234F')).toBe(false);
      expect(kycValidators.pan('ABCDE123')).toBe(false);
    });
  });

  describe('aadhaar', () => {
    it('validates 12-digit Aadhaar not starting with 0 or 1', () => {
      expect(kycValidators.aadhaar('234567890123')).toBe(true);
      expect(kycValidators.aadhaar('012345678901')).toBe(false);
      expect(kycValidators.aadhaar('123456789012')).toBe(false);
      expect(kycValidators.aadhaar('23456')).toBe(false);
    });
  });

  describe('ifsc', () => {
    it('validates IFSC format', () => {
      expect(kycValidators.ifsc('HDFC0001234')).toBe(true);
      expect(kycValidators.ifsc('SBIN0000123')).toBe(true);
      expect(kycValidators.ifsc('HDFC1001234')).toBe(false);
    });
  });

  describe('pincode', () => {
    it('validates 6 digit pincode', () => {
      expect(kycValidators.pincode('560001')).toBe(true);
      expect(kycValidators.pincode('060001')).toBe(false);
      expect(kycValidators.pincode('56000')).toBe(false);
    });
  });

  describe('nomineeAllocation', () => {
    it('validates allocation sums to 100', () => {
      expect(kycValidators.nomineeAllocation([{ allocationPercentage: 50 }, { allocationPercentage: 50 }])).toBe(true);
      expect(kycValidators.nomineeAllocation([{ allocationPercentage: 100 }])).toBe(true);
      expect(kycValidators.nomineeAllocation([{ allocationPercentage: 40 }, { allocationPercentage: 50 }])).toBe(false);
    });
  });

  describe('requiredText', () => {
    it('passes when string meets minimum length', () => {
      expect(kycValidators.requiredText('John Doe')).toBe(true);
      expect(kycValidators.requiredText('AB')).toBe(true);
    });
    it('fails when string is too short or blank', () => {
      expect(kycValidators.requiredText('')).toBe(false);
      expect(kycValidators.requiredText('  ')).toBe(false);
      expect(kycValidators.requiredText('A')).toBe(false);
    });
    it('respects custom minLen', () => {
      expect(kycValidators.requiredText('Hello', 5)).toBe(true);
      expect(kycValidators.requiredText('Hi', 5)).toBe(false);
    });
  });

  describe('phone', () => {
    it('validates valid Indian mobile numbers', () => {
      expect(kycValidators.phone('9876543210')).toBe(true);
      expect(kycValidators.phone('6543210987')).toBe(true);
      expect(kycValidators.phone('+919876543210')).toBe(true);
      expect(kycValidators.phone('09876543210')).toBe(true);
    });
    it('rejects invalid numbers', () => {
      expect(kycValidators.phone('1234567890')).toBe(false);
      expect(kycValidators.phone('98765432')).toBe(false);
      expect(kycValidators.phone('5555555555')).toBe(false);
    });
  });

  describe('email', () => {
    it('validates well-formed email addresses', () => {
      expect(kycValidators.email('user@example.com')).toBe(true);
      expect(kycValidators.email('investor+kyc@ghl.in')).toBe(true);
    });
    it('rejects malformed email addresses', () => {
      expect(kycValidators.email('notanemail')).toBe(false);
      expect(kycValidators.email('@domain.com')).toBe(false);
      expect(kycValidators.email('user@')).toBe(false);
    });
  });

  describe('dob', () => {
    it('accepts dates where person is >= 18 years old', () => {
      const past = new Date();
      past.setFullYear(past.getFullYear() - 30);
      expect(kycValidators.dob(past.toISOString().slice(0, 10))).toBe(true);
    });
    it('rejects dates where person is < 18 years old', () => {
      const recent = new Date();
      recent.setFullYear(recent.getFullYear() - 10);
      expect(kycValidators.dob(recent.toISOString().slice(0, 10))).toBe(false);
    });
    it('rejects empty or invalid dates', () => {
      expect(kycValidators.dob('')).toBe(false);
      expect(kycValidators.dob('not-a-date')).toBe(false);
    });
  });

  describe('bankAccount', () => {
    it('validates 9-18 digit account numbers', () => {
      expect(kycValidators.bankAccount('123456789')).toBe(true);
      expect(kycValidators.bankAccount('123456789012345678')).toBe(true);
    });
    it('rejects too-short or too-long or non-numeric', () => {
      expect(kycValidators.bankAccount('12345678')).toBe(false);
      expect(kycValidators.bankAccount('1234567890123456789')).toBe(false);
      expect(kycValidators.bankAccount('ABCD12345')).toBe(false);
    });
  });

  describe('dematBoid', () => {
    it('validates exactly 16-digit demat BO ID', () => {
      expect(kycValidators.dematBoid('1234567890123456')).toBe(true);
    });
    it('rejects wrong length or non-numeric', () => {
      expect(kycValidators.dematBoid('123456789012345')).toBe(false);
      expect(kycValidators.dematBoid('12345678901234567')).toBe(false);
      expect(kycValidators.dematBoid('123456789A123456')).toBe(false);
    });
  });

  describe('nomineeDob', () => {
    it('accepts any valid date string', () => {
      expect(kycValidators.nomineeDob('2000-01-01')).toBe(true);
      expect(kycValidators.nomineeDob('2020-06-15')).toBe(true);
    });
    it('rejects empty or invalid dates', () => {
      expect(kycValidators.nomineeDob('')).toBe(false);
      expect(kycValidators.nomineeDob('not-a-date')).toBe(false);
    });
  });
});