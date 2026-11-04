import { Tone } from '../../../core/constants/remediation.constants';
import { SCORE_GOOD, SCORE_WARN } from './my-domain.constants';
import { RepoRule, RuleQuery, RuleResult, RuleRow, RuleSortKey, SortDirection } from './my-domain.model';

/** The name the workbook gives the rule, else its description, else its ID. The fallback is flagged, never invented. */
export function ruleDisplayName(rule: RepoRule): { text: string; isFallback: boolean } {
  if (rule.name) return { text: rule.name, isFallback: false };
  if (rule.description) return { text: rule.description, isFallback: true };
  return { text: rule.id, isFallback: true };
}

export function failedPercent(result: RuleResult): number | null {
  return result.status === 'not-run' || result.checks === 0 ? null : (result.failed / result.checks) * 100;
}

export function toRuleRow(rule: RepoRule, productId: string, productName: string, result: RuleResult): RuleRow {
  const name = ruleDisplayName(rule);
  return { rule, productId, productName, displayName: name.text, nameIsFallback: name.isFallback, result, failedPct: failedPercent(result) };
}

export function scoreTone(score: number | null): Tone {
  if (score === null) return 'neutral';
  if (score >= SCORE_GOOD) return 'success';
  if (score >= SCORE_WARN) return 'warning';
  return 'danger';
}

export function mean(values: (number | null)[]): number | null {
  const v = values.filter((x): x is number => x !== null);
  return v.length ? Math.round((v.reduce((s, x) => s + x, 0) / v.length) * 10) / 10 : null;
}

/** Percentage-point change, one decimal. */
export function deltaPoints(current: number | null, previous: number | null): number | null {
  return current === null || previous === null ? null : Math.round((current - previous) * 10) / 10;
}

export function isStale(refreshedAt: string, today: string, maxDays: number): boolean {
  return (new Date(today).getTime() - new Date(refreshedAt).getTime()) / 864e5 > maxDays;
}

export function filterRules(rows: readonly RuleRow[], q: Pick<RuleQuery, 'search' | 'dimension' | 'table' | 'column' | 'status' | 'active' | 'failingOnly'>): RuleRow[] {
  const needle = q.search.trim().toLowerCase();
  return rows.filter((row) => {
    const { rule, result } = row;
    if (q.dimension && rule.dimension !== q.dimension) return false;
    if (q.table && rule.tableId !== q.table) return false;
    if (q.column && rule.column !== q.column) return false;
    if (q.status && result.status !== q.status) return false;
    if (q.active && rule.active !== (q.active === 'yes')) return false;
    if (q.failingOnly && result.status !== 'failed') return false;
    if (!needle) return true;
    return [rule.id, rule.name, rule.description, rule.column, rule.tableId, rule.dimension, row.productName]
      .some((v) => v?.toLowerCase().includes(needle));
  });
}

const STATUS_ORDER = { failed: 0, passed: 1, 'not-run': 2 } as const;

function compareText(a: string | null, b: string | null): number {
  if (a === b) return 0;
  if (a === null) return 1; // missing values sort last in both directions
  if (b === null) return -1;
  return a.localeCompare(b, 'en', { numeric: true, sensitivity: 'base' });
}

function sortValue(row: RuleRow, key: RuleSortKey): string | number | null {
  const { rule, result } = row;
  switch (key) {
    case 'id': return rule.id;
    case 'name': return row.displayName;
    case 'description': return rule.description;
    case 'score': return result.score;
    case 'checks': return result.status === 'not-run' ? null : result.checks;
    case 'failed': return result.status === 'not-run' ? null : result.failed;
    case 'status': return STATUS_ORDER[result.status];
    case 'dimension': return rule.dimension;
    case 'table': return rule.tableId;
    case 'column': return rule.column;
    case 'priority': return rule.priority;
    case 'active': return rule.active ? 0 : 1;
    case 'updated': return rule.definitionUpdatedAt;
    case 'product': return row.productName;
    default: return null;
  }
}

/** Default order: failing rules first, most failed records first, then by ID. Priority is not used as severity. */
function compareDefault(a: RuleRow, b: RuleRow): number {
  return STATUS_ORDER[a.result.status] - STATUS_ORDER[b.result.status] || b.result.failed - a.result.failed || compareText(a.rule.id, b.rule.id);
}

export function sortRules(rows: readonly RuleRow[], key: RuleSortKey, direction: SortDirection): RuleRow[] {
  const sorted = [...rows];
  if (key === 'default') return sorted.sort(compareDefault);
  const sign = direction === 'asc' ? 1 : -1;
  return sorted.sort((a, b) => {
    const x = sortValue(a, key);
    const y = sortValue(b, key);
    if (x === null || y === null) return x === y ? compareDefault(a, b) : x === null ? 1 : -1;
    const cmp = typeof x === 'number' && typeof y === 'number' ? x - y : compareText(String(x), String(y));
    return cmp * sign || compareDefault(a, b);
  });
}

export function pageSlice<T>(items: readonly T[], page: number, size: number): T[] {
  return items.slice((page - 1) * size, page * size);
}

export function clampPage(page: number, total: number, size: number): number {
  return Math.min(Math.max(1, page), Math.max(1, Math.ceil(total / size)));
}

export function sentenceCount(n: number, one: string, many = `${one}s`): string {
  return `${n.toLocaleString('en-GB')} ${n === 1 ? one : many}`;
}
