export interface FundRouteDetail {
  id: 'debenture' | 'direct_aif';
  title: string;
  tabLabel: string;
  fundType: string;
  focus: string;
  keyTerms: { label: string; value: string }[];
  investmentStrategy: string[];
  documentsProvided: string[];
  securityStructure: string[];
}

export const FUND_DETAILS_DATA: Record<'debenture' | 'direct_aif', FundRouteDetail> = {
  debenture: {
    id: 'debenture',
    title: 'Alternate route to Invest in AIF via Debenture',
    tabLabel: 'Alternate route to Invest in AIF via Debenture',
    fundType: 'Category II AIF (as per SEBI Alternative Investment Fund Regulations, 2012)',
    focus: 'Stressed and special situation real estate assets',
    keyTerms: [
      { label: 'Investment', value: 'starting from Rs 10,00,000' },
      { label: 'Interest', value: '1% per month (means 12% per annum)' },
      { label: 'Capital Appreciation', value: '12% per annum payable at redemption' },
      { label: 'Total Assured Returns', value: '24% per annum' },
      { label: 'Tenure', value: 'Min 3 years, Max 10 years' },
    ],
    investmentStrategy: [
      'Acquire industrial land, residential layouts, and commercial land at 30-50% below market value through bank auctions, distressed sales, and private deals.',
      'Monetize quickly by selling to industries, developers, or other end-users at less than fair market price.',
      'Short-to-medium term exits (usually 8-12 months) to generate attractive returns.',
    ],
    documentsProvided: [
      'Acknowledgment letter',
      'Debenture Agreement',
      'Debenture allotment letter',
      'Debenture Certificate (physical or demat)',
      'Investor portal access',
    ],
    securityStructure: [
      'Debenture Trustee appointed as per the Companies Act',
      'Mortgage/Charge creation on company assets',
      'CHG-9 Form RBI with Ministry of Corporate Affairs',
    ],
  },
  direct_aif: {
    id: 'direct_aif',
    title: 'Direct AIF Route',
    tabLabel: 'Direct AIF Route',
    fundType: 'Category II AIF - Direct Investment',
    focus: 'SEBI-registered AIF with stressed real estate exposure',
    keyTerms: [
      { label: 'Minimum Investment', value: 'Rs 1 crore (Direct AIF)' },
      { label: 'Target Returns', value: '24% p.a. (performance-linked; AIF cannot guarantee returns under SEBI guidelines)' },
      { label: 'Return Structure', value: '12% distributed annually as income; Balance profit added to capital for long-term wealth creation' },
      { label: 'Taxation', value: 'Dividend / Interest taxable at applicable slab rate (10% TDS). Capital accumulation taxed as capital gains at 12% or 20% (without / with indexation)' },
      { label: 'Tenure', value: 'Minimum - 3 years, Maximum - 10 years' },
      { label: 'Fund Size', value: 'Rs 100 crore' },
    ],
    investmentStrategy: [
      'Direct participation in SEBI-regulated AIF scheme',
      'Diversified portfolio across stressed real estate assets',
      'Professional fund management with quarterly NAV updates',
    ],
    documentsProvided: [
      'PPM (Private Placement Memorandum)',
      'Contribution Agreement',
      'Capital Call Notice',
      'NAV Statement',
    ],
    securityStructure: [
      'SEBI registered Category II AIF',
      'Independent custodian for assets',
      'Quarterly audited NAV',
    ],
  },
};
