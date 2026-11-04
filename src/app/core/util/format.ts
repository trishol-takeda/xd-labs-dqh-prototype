const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** 48213 → "48k", 1852759 → "1.9M". */
export function compact(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e4) return `${Math.round(n / 1e3)}k`;
  return n.toLocaleString('en-GB');
}

export function full(n: number): string {
  return n.toLocaleString('en-GB');
}

/** "2026-09-24" or an ISO timestamp → "24 Sep 2026" (with time for timestamps). */
export function formatDate(value: string, withTime = false): string {
  const d = new Date(value.length > 10 ? value : `${value}T00:00:00Z`);
  const date = `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  if (!withTime || value.length <= 10) return date;
  return `${date}, ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')} UTC`;
}

export function daysBetween(from: string, to: string): number {
  return Math.max(0, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 864e5));
}
