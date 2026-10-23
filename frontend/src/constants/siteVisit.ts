/**
 * Standardized Site Visit Time Slots and Formatting Helpers for Jamin Bazaar.
 * Used consistently across SiteVisitsPage, LeadsPage, CustomersPage, and App Quick Create.
 */

export const SITE_VISIT_TIME_SLOTS = [
  'Morning · 9–11 am',
  'Midday · 11 am–1 pm',
  'Afternoon · 2–4 pm',
  'Evening · 4–6 pm',
] as const;

export type SiteVisitTimeSlot = typeof SITE_VISIT_TIME_SLOTS[number];

/**
 * Standardized date formatter for Site Visit schedule strings.
 * Example output: "Wed, 14 Oct 2026 • Morning · 9–11 am"
 */
export const formatSiteVisitSchedule = (dateStr: string, timeSlot: string): string => {
  if (!dateStr) return timeSlot || '';
  try {
    const [y, m, d] = dateStr.split('-');
    const dateObj = new Date(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10));
    return `${dateObj.toLocaleDateString('en-US', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })} • ${timeSlot}`;
  } catch {
    return `${dateStr} • ${timeSlot}`;
  }
};
