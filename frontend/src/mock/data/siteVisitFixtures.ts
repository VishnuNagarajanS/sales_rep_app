import { SiteVisit } from '../../types';

export const INITIAL_SITE_VISITS: SiteVisit[] = [
  {
    id: 'sv-01',
    companyId: 't-jamin-02',
    customerId: 'lead-jam-02',
    customerName: 'Deepak & Sneha Kulkarni',
    customerPhone: '+91 97312 88990',
    projectId: 'proj-01',
    projectName: 'Greenfield Meadows Phase 2',
    plotNumber: 'Plots #14 & #15',
    scheduledAt: 'This Saturday, 10:30 AM',
    assignedAgentId: 'usr-jamin-exec',
    assignedAgentName: 'Pooja Hegde',
    status: 'Scheduled',
    outcomeNotes: 'Customer requested cab pickup from Electronic City junction.',
  },
  {
    id: 'sv-02',
    companyId: 't-jamin-02',
    customerId: 'cust-jam-01',
    customerName: 'Siddharth Rao',
    customerPhone: '+91 99001 77665',
    projectId: 'proj-01',
    projectName: 'Greenfield Meadows Phase 2',
    plotNumber: 'Plot #22',
    scheduledAt: '2026-02-22, 11:00 AM',
    assignedAgentId: 'usr-jamin-exec',
    assignedAgentName: 'Pooja Hegde',
    status: 'Completed',
    outcomeNotes: 'Client thoroughly impressed by underground electrical lines and 40-foot main boulevard. Selected Plot #22 on the spot.',
  },
];
