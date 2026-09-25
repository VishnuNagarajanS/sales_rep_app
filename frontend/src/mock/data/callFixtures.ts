import { CallRecord } from '../../types';

export const INITIAL_CALLS: CallRecord[] = [
  {
    id: 'call-01',
    companyId: 't-ghl-01',
    contactName: 'Dr. Rajesh Nambiar',
    contactPhone: '+91 98451 12233',
    direction: 'outbound',
    duration: 384, // 6m 24s
    agentId: 'usr-ghl-exec',
    agentName: 'Ananya Iyer',
    disposition: 'Interested',
    timestamp: 'Today, 11:20 AM',
    recordingUrl: 'https://cdn.nexusplatform.io/recordings/call-01.mp3',
    transcription: 'Agent explained commercial cap rate (8.8% gross yield) and 3-year rent escalation. Investor confirmed interest in scheduling 1-on-1 wealth consultation.',
    notes: 'Very receptive. Sent advisory memorandum on WhatsApp.',
  },
  {
    id: 'call-02',
    companyId: 't-jamin-02',
    contactName: 'Deepak Kulkarni',
    contactPhone: '+91 97312 88990',
    direction: 'inbound',
    duration: 215, // 3m 35s
    agentId: 'usr-jamin-exec',
    agentName: 'Pooja Hegde',
    disposition: 'Follow-up Required',
    timestamp: 'Today, 10:45 AM',
    recordingUrl: 'https://cdn.nexusplatform.io/recordings/call-02.mp3',
    transcription: 'Customer called inquiring about BDA/BIAAPA approvals for Greenfield Meadows. Agent confirmed clear titles and RERA registration PRM/KA/RERA/1250/303/PR/240101.',
    notes: 'Wants weekend site visit confirmation by Friday evening.',
  },
  {
    id: 'call-03',
    companyId: 't-jamin-02',
    contactName: 'Siddharth Rao',
    contactPhone: '+91 99001 77665',
    direction: 'outbound',
    duration: 142,
    agentId: 'usr-jamin-exec',
    agentName: 'Pooja Hegde',
    disposition: 'Converted',
    timestamp: 'Yesterday, 04:30 PM',
    notes: 'Token confirmation call. Siddharth transferred ₹5,00,000 via RTGS.',
  },
];
