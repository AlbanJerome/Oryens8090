/**
 * Format a Date as YYYY-MM-DD in the local timezone.
 * Use instead of date.toISOString().slice(0, 10) to avoid day shifts when the
 * server or UTC conversion would move the date across midnight.
 */
export function toLocalDateString(date: Date): string {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const mm = m < 10 ? `0${m}` : String(m);
  const dd = d < 10 ? `0${d}` : String(d);
  return `${y}-${mm}-${dd}`;
}
