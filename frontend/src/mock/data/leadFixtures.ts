import { Lead } from '../../types';
export const INITIAL_LEADS: Lead[] = [
  // GHL Leads
  {
    assignedAgentId: '', assignedAgentName: '', id: 'lead-ghl-01',
    companyId: 't-ghl-01',
    name: 'Dr. Rajesh Nambiar',
    phone: '+91 98451 12233',
    email: 'dr.nambiar@cardiohealth.in',
    location: 'Indiranagar, Bengaluru',
    source: 'Referral - HNW Club',
    status: 'Qualified',
    priority: 'Urgent',
    
    
    nextFollowupDate: 'Today, 04:30 PM',
    createdAt: '2026-03-08',
    notes: 'Interested in commercial Grade-A pre-leased office asset. Liquid capital ready.',
    customFields: {
      investmentCapacity: '₹3 Cr - ₹5 Cr',
      preferredAssetClass: 'Commercial REIT / Pre-Leased',
      horizon: '5-7 Years',
    },
  },
  {
    assignedAgentId: '', assignedAgentName: '', id: 'lead-ghl-02',
    companyId: 't-ghl-01',
    name: 'Sunita & Arvind Mehta',
    phone: '+91 99882 33445',
    email: 'arvind.mehta@techscale.io',
    location: 'Koramangala, Bengaluru',
    source: 'LinkedIn Executive Campaign',
    status: 'Proposal',
    priority: 'High',
    
    
    nextFollowupDate: 'Tomorrow, 11:00 AM',
    createdAt: '2026-03-07',
    notes: 'NRI returning from Singapore. Evaluating fractional warehouse logistics yield.',
    customFields: {
      investmentCapacity: '₹1.5 Cr - ₹3 Cr',
      preferredAssetClass: 'Industrial Logistics Park',
      horizon: '3-5 Years',
    },
  },
  {
    assignedAgentId: '', assignedAgentName: '', id: 'lead-ghl-03',
    companyId: 't-ghl-01',
    name: 'Karthik Somayaji',
    phone: '+91 94480 77889',
    email: 'karthik.s@somayajient.com',
    location: 'Jayanagar, Bengaluru',
    source: 'Website Inbound',
    status: 'New',
    priority: 'Medium',
    
    
    nextFollowupDate: 'Tomorrow, 02:00 PM',
    createdAt: '2026-03-09',
    notes: 'Inquired through web form regarding tax-optimized commercial yield funds.',
    customFields: {
      investmentCapacity: '₹75L - ₹1.5 Cr',
      preferredAssetClass: 'Commercial Yield Funds',
      horizon: '5 Years',
    },
  },

  // Jamin Leads
  {
    assignedAgentId: '', assignedAgentName: '', id: 'lead-jam-01',
    companyId: 't-jamin-02',
    name: 'Manjunath Swamy',
    phone: '+91 98801 44556',
    email: 'manjunath.swamy@infrareach.com',
    location: 'Whitefield, Bengaluru',
    source: 'Facebook Ad - Greenfield Meadows',
    status: 'Contacted',
    priority: 'High',
    
    
    nextFollowupDate: 'Today, 05:00 PM',
    createdAt: '2026-03-09',
    notes: 'Looking for 2400 sqft corner plot facing East for villa construction in next 2 years.',
    customFields: {
      budgetRange: '₹65L - ₹90L',
      preferredLocation: 'Devanahalli North',
      readyToRegister: 'Within 30 Days',
    },
  },
  {
    assignedAgentId: '', assignedAgentName: '', id: 'lead-jam-02',
    companyId: 't-jamin-02',
    name: 'Deepak & Sneha Kulkarni',
    phone: '+91 97312 88990',
    email: 'deepak.kulkarni@wipro.com',
    location: 'Electronic City, Bengaluru',
    source: 'Google Search - Villa Plots',
    status: 'Qualified',
    priority: 'Urgent',
    
    
    nextFollowupDate: 'Saturday, 10:30 AM',
    createdAt: '2026-03-06',
    notes: 'Wants to schedule weekend site visit for Greenfield Meadows Plots #14 and #15.',
    customFields: {
      budgetRange: '₹45L - ₹65L',
      preferredLocation: 'Sarjapur East',
      readyToRegister: 'Immediate',
    },
  },
  {
    assignedAgentId: '', assignedAgentName: '', id: 'lead-jam-03',
    companyId: 't-jamin-02',
    name: 'Brigadier H.S. Rathore (Retd)',
    phone: '+91 94140 11223',
    email: 'hsrathore@defencecolony.org',
    location: 'Hebbal, Bengaluru',
    source: 'Walk-in Site Office',
    status: 'Negotiation',
    priority: 'High',
    
    
    nextFollowupDate: 'Today, 03:00 PM',
    createdAt: '2026-03-04',
    notes: 'Selected Plot #08. Discussing 5% senior citizen concession and payment schedule.',
    customFields: {
      budgetRange: '₹80L - ₹1.1 Cr',
      preferredLocation: 'Airport Corridor North',
      readyToRegister: 'Within 15 Days',
    },
  },
];

