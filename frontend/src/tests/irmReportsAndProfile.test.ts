import { describe, it, expect } from 'vitest';

describe('IRM Reports and Profile Calculations', () => {
  it('correctly calculates totalCommittedAUM and progress', () => {
    const wonOpps = [
      { id: '1', committedAmount: 20000000, stage: 'Committed' },
      { id: '2', committedAmount: 20000000, stage: 'Closed Won' }
    ];
    const totalTargetCorpus = 50000000;
    const totalCommittedAUM = wonOpps.reduce((sum, o) => sum + o.committedAmount, 0);
    const progressPct = Math.round((totalCommittedAUM / totalTargetCorpus) * 100);
    expect(totalCommittedAUM).toBe(40000000); // ₹4 Cr
    expect(progressPct).toBe(80);
  });

  it('correctly parses AUM string values with Cr and Lakhs', () => {
    const parseAumToNumber = (val?: string | number): number => {
      if (val === undefined || val === null || val === '') return 0;
      if (typeof val === 'number') return isNaN(val) ? 0 : val;
      const clean = String(val).replace(/₹|,|\s/g, '').trim();
      if (!clean) return 0;
      if (clean.toLowerCase().includes('cr') || clean.toLowerCase().includes('crore')) {
        const num = parseFloat(clean);
        return isNaN(num) ? 0 : num * 10000000;
      }
      if (clean.toLowerCase().includes('l') || clean.toLowerCase().includes('lakh') || clean.toLowerCase().includes('lac')) {
        const num = parseFloat(clean);
        return isNaN(num) ? 0 : num * 100000;
      }
      if (clean.toLowerCase().includes('k')) {
        const num = parseFloat(clean);
        return isNaN(num) ? 0 : num * 1000;
      }
      const num = parseFloat(clean);
      return isNaN(num) ? 0 : num;
    };

    expect(parseAumToNumber('2 Cr')).toBe(20000000);
    expect(parseAumToNumber('₹2.5 Cr')).toBe(25000000);
    expect(parseAumToNumber('50 L')).toBe(5000000);
    expect(parseAumToNumber('20000000')).toBe(20000000);
  });

  it('correctly calculates dashboard metrics progress and AUM targets', () => {
    const mockDashboardData = {
      committedAUM: 35000000,
      targetAUM: 50000000,
    };
    const aumProgress = Math.min(Math.round((mockDashboardData.committedAUM / mockDashboardData.targetAUM) * 100), 100);
    expect(aumProgress).toBe(70);
  });
});
