import { describe, it, expect } from 'vitest';
import {
  validateInvestmentAmount,
  formatIndianCurrencyWords,
  INVESTMENT_ROUTE_LIMITS,
  DEBENTURE_MAX_SANITY_CAP,
} from '../constants/investmentRoutes';

describe('Investment Route Validation & Limits', () => {
  describe('Debenture Route Limits (Min: Rs 10 Lakh, Sanity Cap Max: Rs 100 Crore)', () => {
    it('should reject amounts below minimum (Rs 10,00,000)', () => {
      const result = validateInvestmentAmount(500000, 'debenture');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Minimum investment');
      expect(result.error).toContain('10,00,000');
    });

    it('should reject Rs 9,99,999', () => {
      const result = validateInvestmentAmount(999999, 'debenture');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('10,00,000');
    });

    it('should accept exact minimum amount (Rs 10,00,000)', () => {
      const result = validateInvestmentAmount(1000000, 'debenture');
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should accept valid mid-range amounts', () => {
      const result = validateInvestmentAmount(2500000, 'debenture');
      expect(result.isValid).toBe(true);
    });

    it('should accept exact maximum amount (Rs 100 Crore sanity cap)', () => {
      const result = validateInvestmentAmount(DEBENTURE_MAX_SANITY_CAP, 'debenture');
      expect(result.isValid).toBe(true);
    });

    it('should reject amounts exceeding sanity cap (Rs 100 Crore)', () => {
      const result = validateInvestmentAmount(1000000001, 'debenture');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Maximum investment');
      expect(result.error).toContain('1,00,00,00,000');
    });
  });

  describe('Direct AIF Route Limits (Min: Rs 1 Crore, Max: Rs 100 Crore)', () => {
    it('should reject amounts below minimum (Rs 1,00,00,000)', () => {
      const result = validateInvestmentAmount(5000000, 'direct_aif');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Minimum investment');
      expect(result.error).toContain('1,00,00,000');
    });

    it('should reject Rs 10 Lakh for Direct AIF', () => {
      const result = validateInvestmentAmount(1000000, 'direct_aif');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('1,00,00,000');
    });

    it('should accept exact minimum amount (Rs 1 Crore)', () => {
      const result = validateInvestmentAmount(10000000, 'direct_aif');
      expect(result.isValid).toBe(true);
    });

    it('should accept valid mid-range amounts (e.g. Rs 5 Crore)', () => {
      const result = validateInvestmentAmount(50000000, 'direct_aif');
      expect(result.isValid).toBe(true);
    });

    it('should accept exact maximum fund size (Rs 100 Crore)', () => {
      const result = validateInvestmentAmount(1000000000, 'direct_aif');
      expect(result.isValid).toBe(true);
    });

    it('should reject amounts exceeding Rs 100 Crore', () => {
      const result = validateInvestmentAmount(1000000001, 'direct_aif');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Maximum investment');
      expect(result.error).toContain('1,00,00,00,000');
    });
  });

  describe('Edge Cases & Input Handling', () => {
    it('should reject empty or whitespace input', () => {
      expect(validateInvestmentAmount('', 'debenture').isValid).toBe(false);
      expect(validateInvestmentAmount('   ', 'direct_aif').isValid).toBe(false);
    });

    it('should reject null or undefined amount', () => {
      expect(validateInvestmentAmount(null, 'debenture').isValid).toBe(false);
      expect(validateInvestmentAmount(undefined, 'direct_aif').isValid).toBe(false);
    });

    it('should reject non-numeric input', () => {
      expect(validateInvestmentAmount('abc', 'debenture').isValid).toBe(false);
    });

    it('should reject zero or negative numbers', () => {
      expect(validateInvestmentAmount(0, 'debenture').isValid).toBe(false);
      expect(validateInvestmentAmount(-500000, 'debenture').isValid).toBe(false);
    });

    it('should accept numeric strings', () => {
      expect(validateInvestmentAmount('1000000', 'debenture').isValid).toBe(true);
      expect(validateInvestmentAmount('10000000', 'direct_aif').isValid).toBe(true);
    });

    it('should handle route normalization from human readable string names', () => {
      expect(validateInvestmentAmount(1000000, 'Alternate route to Invest in AIF via Debenture').isValid).toBe(true);
      expect(validateInvestmentAmount(10000000, 'Direct AIF Route').isValid).toBe(true);
    });

    it('should reject when route is not specified', () => {
      const res = validateInvestmentAmount(1000000, '');
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('select an Investment Route');
    });
  });

  describe('Indian Currency Words Formatting', () => {
    it('should format Lakh correctly', () => {
      expect(formatIndianCurrencyWords(1000000)).toBe('Rs 10 Lakh');
      expect(formatIndianCurrencyWords(2500000)).toBe('Rs 25 Lakh');
      expect(formatIndianCurrencyWords(1550000)).toBe('Rs 15.50 Lakh');
    });

    it('should format Crore correctly', () => {
      expect(formatIndianCurrencyWords(10000000)).toBe('Rs 1 Crore');
      expect(formatIndianCurrencyWords(50000000)).toBe('Rs 5 Crore');
      expect(formatIndianCurrencyWords(1000000000)).toBe('Rs 100 Crore');
      expect(formatIndianCurrencyWords(15000000)).toBe('Rs 1.50 Crore');
    });

    it('should format zero or invalid amounts', () => {
      expect(formatIndianCurrencyWords(0)).toBe('Rs 0');
      expect(formatIndianCurrencyWords(-100)).toBe('Rs 0');
    });
  });
});
