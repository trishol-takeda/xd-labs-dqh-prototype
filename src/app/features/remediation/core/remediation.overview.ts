import { LARGEST_FINDINGS, TOP_FINDINGS, TREND_COMPARE_WEEKS } from './remediation.constants';
import { Dataset, Finding, Product } from './remediation.model';
import { actionable, byImpact, compact, ofProduct, openOf, plural } from './remediation.util';

/** Pure selectors behind the Overview screen: everything is computed from the findings, nothing is stored. */

export interface DomainTile {
  name: string;
  open: number;
  pastTarget: number;
  /** The domain's product with most open findings: where the tile links to. */
  productId: string;
}

export interface OverviewModel {
  runs: string[];
  trend: number[];
  now: number;
  /** Change in weekly new failures against four weeks ago. */
  delta: number;
  pct: number;
  down: boolean;
  needs: Finding[];
  openCount: number;
  pastTarget: number;
  oldestDays: number;
  top: Finding[];
  domains: DomainTile[];
}

export interface Bar {
  label: string;
  value: number;
  text: string;
  tone: 'red' | 'blue' | '';
}

export interface ProductRow {
  product: Product;
  open: number;
  records: number;
  pastTarget: number;
  oldestDays: number;
}

export interface DomainRow {
  name: string;
  open: number;
  records: number;
  pastTarget: number;
  products: ProductRow[];
}

export interface BreakdownModel {
  open: number;
  records: number;
  pastTarget: number;
  critical: number;
  engineeringPct: number;
  fixedGoingForward: number;
  bySymptom: Bar[];
  bySite: Bar[];
  byOwner: Bar[];
  trendNote: string;
  domainRows: DomainRow[];
  largest: Finding[];
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

export function weeklyNewFailures(d: Dataset): number[] {
  return d.vocab.runs.map((_, i) => d.findings.reduce((sum, f) => sum + (f.history[i]?.newFailing ?? 0), 0));
}

export function overviewModel(d: Dataset): OverviewModel {
  const open = openOf(d.findings);
  const needs = open.filter((f) => f.visibleStatus === 'needs_you');
  const over = open.filter((f) => f.pastTarget);
  const trend = weeklyNewFailures(d);
  const now = trend[trend.length - 1];
  const before = trend[Math.max(0, trend.length - 1 - TREND_COMPARE_WEEKS)];
  const delta = now - before;
  const domains = [...groupByDomain(d)].map(([name, products]) => {
    const list = uniqueOpen(d, products);
    const lead = [...products].sort((a, b) => openCountOf(d, b) - openCountOf(d, a))[0];
    return { name, open: list.length, pastTarget: list.filter((f) => f.pastTarget).length, productId: lead.id };
  });
  return {
    runs: d.vocab.runs,
    trend,
    now,
    delta,
    pct: before ? Math.round((100 * Math.abs(delta)) / before) : 0,
    down: delta <= 0,
    needs,
    openCount: open.length,
    pastTarget: over.length,
    oldestDays: Math.max(0, ...open.map((f) => f.ageWorkingDays)),
    top: [...needs].sort(byImpact).slice(0, TOP_FINDINGS),
    domains,
  };
}

function toBars(entries: { label: string; value: number; text: string; tone?: Bar['tone'] }[]): Bar[] {
  return entries.map((e): Bar => ({ ...e, tone: e.tone ?? '' })).sort((a, b) => b.value - a.value);
}

export function breakdownModel(d: Dataset): BreakdownModel {
  const open = openOf(d.findings);
  const records = open.reduce((sum, f) => sum + actionable(f), 0);
  const trend = weeklyNewFailures(d);
  const delta = trend[trend.length - 1] - trend[Math.max(0, trend.length - 1 - TREND_COMPARE_WEEKS)];

  const bySymptom = toBars(
    Object.entries(d.vocab.symptoms)
      .map(([key, v]) => {
        const list = open.filter((f) => f.symptom === key);
        return { label: v.label, value: list.length, text: `${list.length} · ${compact(list.reduce((sum, f) => sum + actionable(f), 0))} records`, tone: key === 'not_generated' ? ('blue' as const) : ('red' as const) };
      })
      .filter((x) => x.value > 0),
  );

  const sites = new Map<string, number>();
  for (const f of open) sites.set(f.site, (sites.get(f.site) ?? 0) + 1);
  const bySite = toBars([...sites].map(([label, value]) => ({ label, value, text: String(value) })));

  const owners = new Map<string, number>();
  for (const f of open) for (const a of f.actions.filter((x) => x.status !== 'done')) owners.set(a.ownerRole, (owners.get(a.ownerRole) ?? 0) + 1);
  const byOwner = toBars([...owners].map(([label, value]) => ({ label, value, text: `${value} ${plural(value, 'action')}` })));

  const domainRows = [...groupByDomain(d)].map(([name, products]) => {
    const list = uniqueOpen(d, products);
    return {
      name,
      open: list.length,
      records: list.reduce((sum, f) => sum + actionable(f), 0),
      pastTarget: list.filter((f) => f.pastTarget).length,
      products: [...products]
        .sort((a, b) => openCountOf(d, b) - openCountOf(d, a))
        .map((product) => {
          const l = openOf(ofProduct(d, product));
          return {
            product,
            open: l.length,
            records: l.reduce((sum, f) => sum + actionable(f), 0),
            pastTarget: l.filter((f) => f.pastTarget).length,
            oldestDays: l.length ? Math.max(...l.map((f) => f.ageWorkingDays)) : 0,
          };
        }),
    };
  });

  return {
    open: open.length,
    records,
    pastTarget: open.filter((f) => f.pastTarget).length,
    critical: open.filter((f) => f.tier === 'critical').length,
    engineeringPct: Math.round((100 * open.filter((f) => f.symptom === 'not_generated').length) / Math.max(1, open.length)),
    fixedGoingForward: d.findings.filter((f) => f.fixedGoingForward).length,
    bySymptom,
    bySite,
    byOwner,
    trendNote: `${delta <= 0 ? 'down' : 'up'} ${compact(Math.abs(delta))} in four weeks`,
    domainRows,
    largest: [...open].sort(byImpact).slice(0, LARGEST_FINDINGS),
  };
}
