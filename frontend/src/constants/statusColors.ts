export type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'primary' | 'purple';

export const STATUS_COLOR_MAP: Record<string, { bg: string; text: string; border: string; variant: BadgeVariant }> = {
  // Common
  Active: { bg: 'rgba(16, 185, 129, 0.12)', text: '#059669', border: 'rgba(16, 185, 129, 0.3)', variant: 'success' },
  Inactive: { bg: 'rgba(100, 116, 139, 0.12)', text: '#475569', border: 'rgba(100, 116, 139, 0.3)', variant: 'neutral' },
  Pending: { bg: 'rgba(245, 158, 11, 0.12)', text: '#d97706', border: 'rgba(245, 158, 11, 0.3)', variant: 'warning' },
  Completed: { bg: 'rgba(16, 185, 129, 0.12)', text: '#059669', border: 'rgba(16, 185, 129, 0.3)', variant: 'success' },
  Cancelled: { bg: 'rgba(239, 68, 68, 0.12)', text: '#dc2626', border: 'rgba(239, 68, 68, 0.3)', variant: 'danger' },

  // Lead Statuses
  New: { bg: 'rgba(59, 130, 246, 0.12)', text: '#2563eb', border: 'rgba(59, 130, 246, 0.3)', variant: 'info' },
  Contacted: { bg: 'rgba(139, 92, 246, 0.12)', text: '#7c3aed', border: 'rgba(139, 92, 246, 0.3)', variant: 'purple' },
  Qualified: { bg: 'rgba(16, 185, 129, 0.12)', text: '#059669', border: 'rgba(16, 185, 129, 0.3)', variant: 'success' },
  Proposal: { bg: 'rgba(245, 158, 11, 0.12)', text: '#d97706', border: 'rgba(245, 158, 11, 0.3)', variant: 'warning' },
  Negotiation: { bg: 'rgba(236, 72, 153, 0.12)', text: '#db2777', border: 'rgba(236, 72, 153, 0.3)', variant: 'primary' },
  Converted: { bg: 'rgba(16, 185, 129, 0.15)', text: '#047857', border: 'rgba(16, 185, 129, 0.4)', variant: 'success' },
  Lost: { bg: 'rgba(239, 68, 68, 0.12)', text: '#dc2626', border: 'rgba(239, 68, 68, 0.3)', variant: 'danger' },

  // Priority
  Low: { bg: 'rgba(100, 116, 139, 0.12)', text: '#475569', border: 'rgba(100, 116, 139, 0.3)', variant: 'neutral' },
  Medium: { bg: 'rgba(59, 130, 246, 0.12)', text: '#2563eb', border: 'rgba(59, 130, 246, 0.3)', variant: 'info' },
  High: { bg: 'rgba(245, 158, 11, 0.12)', text: '#d97706', border: 'rgba(245, 158, 11, 0.3)', variant: 'warning' },
  Urgent: { bg: 'rgba(239, 68, 68, 0.12)', text: '#dc2626', border: 'rgba(239, 68, 68, 0.3)', variant: 'danger' },

  // Call Dispositions
  Interested: { bg: 'rgba(16, 185, 129, 0.12)', text: '#059669', border: 'rgba(16, 185, 129, 0.3)', variant: 'success' },
  'Not Interested': { bg: 'rgba(239, 68, 68, 0.12)', text: '#dc2626', border: 'rgba(239, 68, 68, 0.3)', variant: 'danger' },
  'Follow-up Required': { bg: 'rgba(245, 158, 11, 0.12)', text: '#d97706', border: 'rgba(245, 158, 11, 0.3)', variant: 'warning' },
  'Call Back': { bg: 'rgba(59, 130, 246, 0.12)', text: '#2563eb', border: 'rgba(59, 130, 246, 0.3)', variant: 'info' },
  Callback: { bg: 'rgba(59, 130, 246, 0.12)', text: '#2563eb', border: 'rgba(59, 130, 246, 0.3)', variant: 'info' },
  'Wrong Number': { bg: 'rgba(100, 116, 139, 0.12)', text: '#64748b', border: 'rgba(100, 116, 139, 0.3)', variant: 'neutral' },
  'No Response': { bg: 'rgba(100, 116, 139, 0.12)', text: '#64748b', border: 'rgba(100, 116, 139, 0.3)', variant: 'neutral' },

  // Plot Status
  Available: { bg: 'rgba(16, 185, 129, 0.12)', text: '#059669', border: 'rgba(16, 185, 129, 0.3)', variant: 'success' },
  Hold: { bg: 'rgba(245, 158, 11, 0.15)', text: '#d97706', border: 'rgba(245, 158, 11, 0.4)', variant: 'warning' },
  Sold: { bg: 'rgba(239, 68, 68, 0.12)', text: '#dc2626', border: 'rgba(239, 68, 68, 0.3)', variant: 'danger' },

  // Site Visits & Consultations
  Scheduled: { bg: 'rgba(59, 130, 246, 0.12)', text: '#2563eb', border: 'rgba(59, 130, 246, 0.3)', variant: 'info' },
  Rescheduled: { bg: 'rgba(245, 158, 11, 0.12)', text: '#d97706', border: 'rgba(245, 158, 11, 0.3)', variant: 'warning' },
  'No-show': { bg: 'rgba(239, 68, 68, 0.12)', text: '#dc2626', border: 'rgba(239, 68, 68, 0.3)', variant: 'danger' },

  // Direction
  inbound: { bg: 'rgba(16, 185, 129, 0.12)', text: '#059669', border: 'rgba(16, 185, 129, 0.3)', variant: 'success' },
  outbound: { bg: 'rgba(59, 130, 246, 0.12)', text: '#2563eb', border: 'rgba(59, 130, 246, 0.3)', variant: 'info' },

  // Follow-up States
  Overdue: { bg: 'rgba(239, 68, 68, 0.15)', text: '#b91c1c', border: 'rgba(239, 68, 68, 0.4)', variant: 'danger' },
  'Due Today': { bg: 'rgba(245, 158, 11, 0.15)', text: '#b45309', border: 'rgba(245, 158, 11, 0.4)', variant: 'warning' },
  Upcoming: { bg: 'rgba(59, 130, 246, 0.12)', text: '#2563eb', border: 'rgba(59, 130, 246, 0.3)', variant: 'info' },
};

export const getStatusStyle = (status: string) => {
  return STATUS_COLOR_MAP[status] || {
    bg: 'rgba(148, 163, 184, 0.12)',
    text: '#475569',
    border: 'rgba(148, 163, 184, 0.3)',
    variant: 'neutral' as BadgeVariant,
  };
};
