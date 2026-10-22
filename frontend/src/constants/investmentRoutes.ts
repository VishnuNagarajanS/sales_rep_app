export type InvestmentRouteKey = 'debenture' | 'direct_aif';

export interface RouteLimitConfig {
  key: InvestmentRouteKey;
  label: string;
  shortLabel: string;
  minAmount: number; // in INR
  maxAmount: number; // in INR
  minLabel: string;
  maxLabel: string;
}

/**
 * Clearly named sanity cap for the Debenture route.
 * No maximum was explicitly specified; defaulted to Rs 100 crore (matching Direct AIF fund size sanity cap).
 */
export const DEBENTURE_MAX_SANITY_CAP = 1000000000; // Rs 100 crore

export const INVESTMENT_ROUTE_LIMITS: Record<InvestmentRouteKey, RouteLimitConfig> = {
  debenture: {
    key: 'debenture',
    label: 'Alternate route to Invest in AIF via Debenture',
    shortLabel: 'Debenture',
    minAmount: 1000000, // Rs 10,00,000 (10 Lakh)
    maxAmount: DEBENTURE_MAX_SANITY_CAP,
    minLabel: 'Rs 10,00,000 (Rs 10 Lakh)',
    maxLabel: 'Rs 100 Crore',
  },
  direct_aif: {
    key: 'direct_aif',
    label: 'Direct AIF Route',
    shortLabel: 'Direct AIF',
    minAmount: 10000000, // Rs 1,00,00,000 (1 Crore)
    maxAmount: 1000000000, // Rs 100 Crore
    minLabel: 'Rs 1,00,00,000 (Rs 1 Crore)',
    maxLabel: 'Rs 100 Crore',
  },
};

/**
 * Format an amount in Indian numerical words (Lakh / Crore).
 */
export function formatIndianCurrencyWords(amount: number): string {
  if (!amount || isNaN(amount) || amount <= 0) return 'Rs 0';
  if (amount >= 10000000) {
    const cr = amount / 10000000;
    const formatted = cr % 1 === 0 ? cr.toFixed(0) : cr.toFixed(2);
    return `Rs ${formatted} Crore`;
  }
  if (amount >= 100000) {
    const lakh = amount / 100000;
    const formatted = lakh % 1 === 0 ? lakh.toFixed(0) : lakh.toFixed(2);
    return `Rs ${formatted} Lakh`;
  }
  return `Rs ${amount.toLocaleString('en-IN')}`;
}

export interface AmountValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Validates investment amount for a given route.
 */
export function validateInvestmentAmount(
  amount: number | string | undefined | null,
  routeKey: InvestmentRouteKey | string | undefined | null
): AmountValidationResult {
  if (!routeKey) {
    return {
      isValid: false,
      error: 'Please select an Investment Route first before entering amount.',
    };
  }

  const normalizedKey = String(routeKey).toLowerCase().includes('debenture')
    ? 'debenture'
    : String(routeKey).toLowerCase().includes('direct')
    ? 'direct_aif'
    : (routeKey as InvestmentRouteKey);

  const route = INVESTMENT_ROUTE_LIMITS[normalizedKey as InvestmentRouteKey];
  if (!route) {
    return {
      isValid: false,
      error: 'Invalid investment route selected.',
    };
  }

  if (amount === undefined || amount === null || String(amount).trim() === '') {
    return {
      isValid: false,
      error: 'Please enter an investment amount.',
    };
  }

  const num = typeof amount === 'number' ? amount : Number(amount);
  if (isNaN(num) || !isFinite(num) || num <= 0) {
    return {
      isValid: false,
      error: 'Amount must be a positive number.',
    };
  }

  if (num < route.minAmount) {
    return {
      isValid: false,
      error: `Minimum investment for ${route.label} is Rs ${route.minAmount.toLocaleString('en-IN')}`,
    };
  }

  if (num > route.maxAmount) {
    return {
      isValid: false,
      error: `Maximum investment for ${route.label} is Rs ${route.maxAmount.toLocaleString('en-IN')}`,
    };
  }

  return { isValid: true };
}
