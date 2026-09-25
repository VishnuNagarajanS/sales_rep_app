import { NotificationItem } from '../../types';

export const INITIAL_NOTIFICATIONS: NotificationItem[] = [
  {
    id: 'notif-01',
    type: 'call',
    title: 'Incoming Call Record Available',
    message: 'Recording and automated transcript ready for Dr. Rajesh Nambiar (6m 24s).',
    timestamp: '2 hours ago',
    read: false,
    link: '/call-history',
  },
  {
    id: 'notif-02',
    type: 'followup',
    title: 'Follow-up Due in 30 Minutes',
    message: 'Follow-up with Dr. Rajesh Nambiar scheduled at 04:30 PM.',
    timestamp: '35 mins ago',
    read: false,
    link: '/followups',
  },
  {
    id: 'notif-03',
    type: 'lead',
    title: 'New High Priority Lead Assigned',
    message: 'Karthik Somayaji assigned by Vikram Malhotra.',
    timestamp: 'Yesterday',
    read: true,
    link: '/leads',
  },
];
