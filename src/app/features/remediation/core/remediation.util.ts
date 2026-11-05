import { ACCEPT_REVIEW_MONTHS, MS_PER_DAY, PARTLY_FIXED_BELOW, TIER_ORDER, TYPE_PHRASE } from './remediation.constants';
import { Cause, Dataset, Rule, Tier } from './remediation.model';

/** 1,234 → 1k, 2,500,000 → 2.5M. */
export function compact(n: number): string {
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1000) return Math.round(n / 1000) + 'k';
  return String(n);
}

export function full(n: number): string {
  return n.toLocaleString('en-GB');
}

export function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function plural(n: number, one: string, many = one + 's'): string {
  return n === 1 ? one : many;
}

/** ACTIVE_FLAG__v → "Active flag". */
export function humanCol(column: string): string {
  const words = column
    .replace(/__[vc]$/, '')
    .replace(/\.label$/, '')
    .replace(/_/g, ' ')
    .trim()
    .toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function addDays(iso: string, days: number): string {
  return new Date(new Date(iso).getTime() + days * MS_PER_DAY).toISOString().slice(0, 10);
}

/** Default "review by" date for an accepted residual: 6 months for GxP critical, otherwise 12. */
export function defaultReviewBy(tier: Tier, from: Date): string {
  const d = new Date(from);
  d.setMonth(d.getMonth() + (tier === 'critical' ? ACCEPT_REVIEW_MONTHS.critical : ACCEPT_REVIEW_MONTHS.other));
  return d.toISOString().slice(0, 10);
}

export function isOpen(c: Cause): boolean {
  return c.visibleStatus !== 'fixed';
}

export function openCount(causes: readonly Cause[]): number {
  return causes.filter(isOpen).length;
}

/** GxP tier first, then most failing records. */
export function compareCauses(a: Cause, b: Cause): number {
  return TIER_ORDER[a.tier] - TIER_ORDER[b.tier] || b.failingNow - a.failingNow;
}

export function peakFailing(c: Cause): number {
  return Math.max(...c.history.map((h) => h.failing));
}

/** Failures dropped below the share of the peak but the cause is still waiting for the trustee. */
export function isPartlyFixed(c: Cause): boolean {
  return c.visibleStatus === 'needs_you' && c.failingNow > 0 && c.failingNow < peakFailing(c) * PARTLY_FIXED_BELOW && c.state !== 'reopened';
}

/** The badge shown after the status, or '' when there is none. Order decides which wins when several apply. */
export function causeBadge(c: Cause): string {
  if (c.state === 'reopened') return 'Came back';
  if (c.state === 'accepted') return 'Accepted';
  if (c.disputed) return 'Disputed';
  if (c.fixerStatus === 'awaiting_run') return 'Fixer says done';
  if (c.fixerStatus === 'wont_fix') return 'Fixer says won’t fix';
  return '';
}

/** Table checks → failing/passing counts and the number of open causes. */
export function summarise(rules: readonly Rule[], open: number) {
  const failing = rules.filter((r) => r.failingNow > 0).length;
  return { checks: rules.length, passing: rules.length - failing, failing, open };
}

/** Sentence that says why the checks in a cause share one fix (shown after a bold lead-in). */
export function whyOneCause(c: Cause, rules: readonly Rule[]): string {
  const types = [...new Set(rules.map((r) => TYPE_PHRASE[r.ruleType] ?? r.ruleType))];
  const technical = (rules[0]?.columnClass ?? 'business') === 'technical';
  const n = c.rules.length;
  const fields = technical ? 'technical fields the platform fills in during loading' : `fields entered in ${c.sourceSystem}`;
  const lead = `${n === 1 ? 'this check is' : `all ${n} checks are`} “${types.join('” / “')}” check${n === 1 ? '' : 's'} on ${fields} in ${c.tablePlainName}. `;
  return lead + (technical ? `Nothing to correct in ${c.sourceSystem}; one fix to the load clears all of them.` : `The same correction in ${c.sourceSystem} clears all of them.`);
}

/** Deterministic pseudo rows for the "all records" screen: the data only carries ten samples per cause. */
export function syntheticRecordRows(c: Cause, count: number): { key: string; checks: string[]; n: number }[] {
  const sorted = [...c.rules].sort((a, b) => b.failingNow - a.failingNow);
  const rows: { key: string; checks: string[]; n: number }[] = [];
  for (let k = 0; k < count; k++) {
    const h = (parseInt(`${c.id.length}${k}`, 10) * 2654435761) % 4294967296;
    const key = c.sampleRecords[k % c.sampleRecords.length].key.replace(/\d{3}$/, String(100 + (h % 900)));
    const n = 1 + (h % sorted.length);
    rows.push({ key, checks: sorted.slice(0, n).map((r) => r.plainName), n });
  }
  return rows;
}

/* ---------- dataset lookups (pure) ---------- */

export const causesOfTable = (d: Dataset, tableId: string): Cause[] => d.causes.filter((c) => c.table === tableId);
export const causesOfProduct = (d: Dataset, productName: string): Cause[] => d.causes.filter((c) => c.products.includes(productName));
export const rulesOfTable = (d: Dataset, tableId: string): Rule[] => d.rules.filter((r) => r.table === tableId);
