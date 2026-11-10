import { LOAD_DEFECT_SYMPTOM, OWNER_BAR_LIMIT, TOP_SYSTEMS, TREND_COMPARE_WEEKS } from './remediation.constants';
import { Dataset, Finding, Product } from './remediation.model';
import { actionable, compact, ofProduct, openOf, plural } from './remediation.util';

/**
 * Pure selectors behind the Overview. Leadership does not remediate: every figure here is computed from the findings,
 * nothing asks the viewer to do anything, and no person is named.
 */

export interface Bar {
  label: string;
  value: number;
  text: string;
}

export interface Pattern {
  headline: string;
  detail: string;
}

export interface MatrixCell {
  count: number;
  /** Heat band: 0 none, 1 one finding, 2 two or three, 3 four or more. */
  heat: 0 | 1 | 2 | 3;
}

export interface MatrixRow {
  name: string;
  tierLabel: string;
  productId: string;
  cells: MatrixCell[];
  records: number;
  pastTarget: number;
  /** Change in weekly new failures over four weeks: negative is good. */
  trend: number;
}

export interface MatrixDomain {
  name: string;
  counts: number[];
  records: number;
  pastTarget: number;
  products: MatrixRow[];
}

export interface OverviewModel {
  runs: string[];
  trend: number[];
  now: number;
  delta: number;
  pct: number;
  down: boolean;
  openCount: number;
  productCount: number;
  waiting: number;
  withOwners: number;
  records: number;
  pastTarget: number;
  oldestDays: number;
  patterns: Pattern[];
  symptoms: { key: string; label: string }[];
  matrix: MatrixDomain[];
  bySite: Bar[];
  byOwner: Bar[];
}

function groupByDomain(d: Dataset): Map<string, Product[]> {
  const domains = new Map<string, Product[]>();
  for (const p of d.registry.products) domains.set(p.domain, [...(domains.get(p.domain) ?? []), p]);
  return domains;
}

/** Findings of several products, each counted once (a shared table appears under more than one product). */
function uniqueOpen(d: Dataset, products: readonly Product[]): Finding[] {
  return [...new Map(products.flatMap((p) => openOf(ofProduct(d, p))).map((f) => [f.id, f])).values()];
}

const openCountOf = (d: Dataset, p: Product): number => openOf(ofProduct(d, p)).length;
const recordsOf = (list: readonly Finding[]): number => list.reduce((sum, f) => sum + actionable(f), 0);

function tally<T>(list: readonly T[], key: (x: T) => string): [string, number][] {
  const counts = new Map<string, number>();
  for (const x of list) counts.set(key(x), (counts.get(key(x)) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1]);
}

export function weeklyNewFailures(d: Dataset, list: readonly Finding[] = d.findings): number[] {
  return d.vocab.runs.map((_, i) => list.reduce((sum, f) => sum + (f.history[i]?.newFailing ?? 0), 0));
}

/** Change in weekly new failures against four weeks before the latest run. */
export function fourWeekDelta(trend: readonly number[]): number {
  return (trend.at(-1) ?? 0) - (trend[Math.max(0, trend.length - 1 - TREND_COMPARE_WEEKS)] ?? 0);
}

const heatOf = (n: number): MatrixCell['heat'] => {
  if (n === 0) return 0;
  if (n === 1) return 1;
  return n <= 3 ? 2 : 3;
};

/** Four generated sentences: the commonest symptom and its likeliest cause, the load defects, the busiest site, the product furthest past target. */
function patternsOf(d: Dataset, open: readonly Finding[], waiting: number): Pattern[] {
  const patterns: Pattern[] = [];
  const total = open.length;
  const [topSymptom] = tally(open, (f) => f.symptom);
  if (topSymptom) {
    const [key, count] = topSymptom;
    const same = open.filter((f) => f.symptom === key);
    const systems = tally(same, (f) => f.sourceSystem).slice(0, TOP_SYSTEMS).map(([name]) => name);
    const cause = tally(same, (f) => f.proposal.rootCause.label)[0]?.[0] ?? '';
    patterns.push({
      headline: `${d.vocab.symptoms[key]?.label ?? key} is the most common problem: ${count} of ${total} open findings (${Math.round((100 * count) / total)}%), mostly in ${systems.join(' and ')}.`,
      detail: `Most likely root cause proposed: ${cause}.`,
    });
  }
  const load = open.filter((f) => f.symptom === LOAD_DEFECT_SYMPTOM);
  if (load.length) {
    patterns.push({
      headline: `${Math.round((100 * load.length) / total)}% of findings are load defects, not business data entry: ${load.length} findings where the platform does not generate technical fields.`,
      detail: 'These sit with Data engineering; no trustee or site action can fix them.',
    });
  }
  const [topSite] = tally(open, (f) => f.site);
  if (topSite) {
    patterns.push({
      headline: `${topSite[0]} carries the most open findings (${topSite[1]}).`,
      detail: 'Where a symptom is concentrated at one site, the proposed cause is usually the local entry template rather than the system.',
    });
  }
  const [topOver] = tally(open.filter((f) => f.pastTarget), (f) => f.products[0]);
  if (topOver) {
    patterns.push({
      headline: `${topOver[0]} has the most findings past target (${topOver[1]}).`,
      detail: `${waiting} ${plural(waiting, 'finding')} overall ${waiting === 1 ? 'is' : 'are'} still waiting for a trustee to confirm a proposal.`,
    });
  }
  return patterns;
}

export function overviewModel(d: Dataset): OverviewModel {
  const open = openOf(d.findings);
  const waiting = open.filter((f) => f.stage === 'proposed').length;
  const trend = weeklyNewFailures(d);
  const delta = fourWeekDelta(trend);
  const before = trend[Math.max(0, trend.length - 1 - TREND_COMPARE_WEEKS)] ?? 0;

  const symptoms = Object.entries(d.vocab.symptoms)
    .filter(([key]) => open.some((f) => f.symptom === key))
    .map(([key, v]) => ({ key, label: v.label }))
    .sort((a, b) => open.filter((f) => f.symptom === b.key).length - open.filter((f) => f.symptom === a.key).length);

  const matrix = [...groupByDomain(d)].map(([name, products]): MatrixDomain => {
    const list = uniqueOpen(d, products);
    return {
      name,
      counts: symptoms.map((s) => list.filter((f) => f.symptom === s.key).length),
      records: recordsOf(list),
      pastTarget: list.filter((f) => f.pastTarget).length,
      products: [...products]
        .sort((a, b) => openCountOf(d, b) - openCountOf(d, a))
        .map((p): MatrixRow => {
          const l = openOf(ofProduct(d, p));
          return {
            name: p.name,
            tierLabel: p.tierLabel,
            productId: p.id,
            cells: symptoms.map((s) => {
              const count = l.filter((f) => f.symptom === s.key).length;
              return { count, heat: heatOf(count) };
            }),
            records: recordsOf(l),
            pastTarget: l.filter((f) => f.pastTarget).length,
            trend: fourWeekDelta(weeklyNewFailures(d, ofProduct(d, p))),
          };
        }),
    };
  });

  const owners = new Map<string, number>();
  for (const f of open) {
    const planned: { ownerRole: string; status?: string }[] = f.actions.length ? f.actions : f.proposal.plan;
    for (const a of planned.filter((x) => x.status !== 'done')) {
      const group = a.ownerRole.replace(/ · Site .$/, '');
      owners.set(group, (owners.get(group) ?? 0) + 1);
    }
  }

  return {
    runs: d.vocab.runs,
    trend,
    now: trend.at(-1) ?? 0,
    delta,
    pct: before ? Math.round((100 * Math.abs(delta)) / before) : 0,
    down: delta <= 0,
    openCount: open.length,
    productCount: new Set(open.flatMap((f) => f.products)).size,
    waiting,
    withOwners: open.length - waiting,
    records: recordsOf(open),
    pastTarget: open.filter((f) => f.pastTarget).length,
    oldestDays: Math.max(0, ...open.map((f) => f.ageWorkingDays)),
    patterns: patternsOf(d, open, waiting),
    symptoms,
    matrix,
    bySite: tally(open, (f) => f.site).map(([label, value]) => ({ label, value, text: String(value) })),
    byOwner: [...owners]
      .sort((a, b) => b[1] - a[1])
      .slice(0, OWNER_BAR_LIMIT)
      .map(([label, value]) => ({ label, value, text: `${value} ${plural(value, 'action')}` })),
  };
}

export const compactTrend = (n: number): string => compact(Math.abs(n));
