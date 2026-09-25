import { Customer } from '../../types';

export const INITIAL_CUSTOMERS: Customer[] = [
  // GHL Customer
  {
    id: 'cust-ghl-01',
    companyId: 't-ghl-01',
    name: 'Venkatraman Narayanan',
    phone: '+91 98450 99887',
    email: 'v.narayanan@apexholdings.sg',
    status: 'VIP',
    assignedAgentId: 'usr-ghl-admin',
    assignedAgentName: 'Vikram Malhotra',
    location: 'Sadashivanagar, Bengaluru',
    lastContacted: 'Yesterday, 04:15 PM',
    openDealsCount: 1,
    totalValue: 45000000,
    createdAt: '2026-01-15',
    notes: 'Chairman of Singapore-based family office. Invested in Phase 1 warehousing asset.',
    customFields: {
      investorType: 'Family Office / Institutional',
      totalAUMCommitted: '₹4.5 Cr',
      relationshipManager: 'Vikram Malhotra',
    },
  },
  // Jamin Customer
  {
    id: 'cust-jam-01',
    companyId: 't-jamin-02',
    name: 'Siddharth Rao',
    phone: '+91 99001 77665',
    email: 'siddharth.rao@accenture.com',
    status: 'Active',
    assignedAgentId: 'usr-jamin-exec',
    assignedAgentName: 'Pooja Hegde',
    location: 'HSR Layout, Bengaluru',
    lastContacted: '2 days ago',
    openDealsCount: 1,
    totalValue: 7200000,
    createdAt: '2026-02-10',
    notes: 'Completed site visit on Feb 22. Placed booking token for Greenfield Meadows Plot #22.',
    customFields: {
      preferredPaymentBank: 'HDFC Home Loans',
      advocateAssigned: 'M.K. Associates',
    },
  },
];
