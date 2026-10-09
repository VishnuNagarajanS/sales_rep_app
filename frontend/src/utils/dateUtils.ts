/**
 * Formats a scheduled date-time dynamically:
 * - If today: "Today • 11:00 AM"
 * - If tomorrow: "Tomorrow • 11:00 AM"
 * - If yesterday: "Yesterday • 11:00 AM"
 * - If future (> tomorrow): "Oct 11, 2026 • 11:00 AM"
 * - If overdue (< yesterday): "Oct 05, 2026 • 11:00 AM (Overdue)"
 */
export function formatSmartScheduleDate(dateVal?: string | Date | null): string {
  if (!dateVal) return '';

  const d = typeof dateVal === 'string' ? new Date(dateVal) : dateVal;
  if (isNaN(d.getTime())) {
    return String(dateVal);
  }

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const targetDateStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());

  // Difference in calendar days
  const diffDays = Math.round(
    (targetDateStart.getTime() - todayStart.getTime()) / (1000 * 60 * 60 * 24)
  );

  const timeStr = d.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  if (diffDays === 0) {
    return `Today • ${timeStr}`;
  }
  if (diffDays === 1) {
    return `Tomorrow • ${timeStr}`;
  }
  if (diffDays === -1) {
    return `Yesterday • ${timeStr}`;
  }

  const dateStr = d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  if (diffDays < -1) {
    return `${dateStr} • ${timeStr} (Overdue)`;
  }

  return `${dateStr} • ${timeStr}`;
}

export function isDateToday(dateVal?: string | Date | null): boolean {
  if (!dateVal) return false;
  const d = typeof dateVal === 'string' ? new Date(dateVal) : dateVal;
  if (isNaN(d.getTime())) return false;
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

