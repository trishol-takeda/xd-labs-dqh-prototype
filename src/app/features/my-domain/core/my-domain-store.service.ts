import { Injectable, computed, inject, signal } from '@angular/core';
import { PROTOTYPE_TODAY } from '../../../core/constants/remediation.constants';
import { PrototypeConfig } from '../../../core/state/prototype-config.service';
import { MyDomainApi } from './my-domain-api';
import { SCOPE_STORAGE_KEY, STALE_AFTER_DAYS } from './my-domain.constants';
import {
  ColumnView, DataProduct, DimensionView, Domain, DomainScope, LoadState, MockIssue, MyDomainDataset,
  ProductDemo, RuleRow, TableView,
} from './my-domain.model';
import { isStale, mean, toRuleRow } from './my-domain.util';

const NO_RESULT = { status: 'not-run', checks: 0, failed: 0, score: null } as const;

function readScope(): DomainScope | null {
  try {
    const parsed = JSON.parse(globalThis.localStorage?.getItem(SCOPE_STORAGE_KEY) ?? 'null') as Partial<DomainScope> | null;
    return parsed && typeof parsed.domainId === 'string' && Array.isArray(parsed.productIds)
      ? { domainId: parsed.domainId, productIds: parsed.productIds.filter((x): x is string => typeof x === 'string') }
      : null;
  } catch {
    return null;
  }
}

/**
 * Loads the My Domain data through MyDomainApi, remembers the chosen scope, and answers every question the screens ask
 * (rows for a product, tables, dimensions, columns). Views are computed here so templates stay free of logic.
 */
@Injectable({ providedIn: 'root' })
export class MyDomainStore {
  private readonly api = inject(MyDomainApi);
  private readonly config = inject(PrototypeConfig);

  private readonly loadStatus = signal<LoadState>('loading');
  private readonly data = signal<MyDomainDataset | null>(null);
  readonly scope = signal<DomainScope | null>(readScope());

  /** Load state to show: the demo switch can force loading or error. */
  readonly status = computed<LoadState>(() => {
    const demo = this.config.demo();
    return demo === 'loading' ? 'loading' : demo === 'error' ? 'error' : this.loadStatus();
  });
  /** Demo switch "Empty": the catalogue has no domains for this user. */
  readonly forcedEmpty = computed(() => this.config.demo() === 'empty');

  readonly hasScope = computed(() => {
    const scope = this.scope();
    return !!scope && scope.productIds.length > 0;
  });

  readonly catalogue = computed(() => this.data()?.catalogue ?? null);
  readonly repository = computed(() => this.data()?.repository ?? null);
  readonly demo = computed(() => this.data()?.demo ?? null);
  readonly domains = computed<Domain[]>(() => (this.forcedEmpty() ? [] : (this.catalogue()?.domains ?? [])));
  readonly products = computed<DataProduct[]>(() => this.catalogue()?.products ?? []);
  readonly userName = computed(() => this.catalogue()?.currentUser.name ?? '');

  readonly scopeDomain = computed(() => this.domains().find((d) => d.id === this.scope()?.domainId) ?? null);
  readonly scopeProducts = computed(() => {
    const ids = new Set(this.scope()?.productIds ?? []);
    return this.products().filter((p) => ids.has(p.id));
  });

  private readonly productIdByTable = computed(() => {
    const map = new Map<string, DataProduct>();
    this.products().forEach((p) => p.tableIds.forEach((t) => map.set(t, p)));
    return map;
  });

  /** Every repository rule with its product and its synthetic latest result. */
  readonly ruleRows = computed<RuleRow[]>(() => {
    const repo = this.repository();
    const demo = this.demo();
    if (!repo || !demo) return [];
    const productOf = this.productIdByTable();
    return repo.rules.map((rule) => {
      const product = productOf.get(rule.tableId);
      return toRuleRow(rule, product?.id ?? '', product?.name ?? 'Unassigned', demo.results[rule.id] ?? NO_RESULT);
    });
  });

  private readonly rowsByProduct = computed(() => {
    const map = new Map<string, RuleRow[]>();
    this.ruleRows().forEach((r) => map.set(r.productId, [...(map.get(r.productId) ?? []), r]));
    return map;
  });

  private readonly issuesById = computed(() => new Map((this.demo()?.issues ?? []).map((i) => [i.id, i])));

  constructor() {
    void this.load();
  }

  async load(): Promise<void> {
    this.loadStatus.set('loading');
    try {
      this.data.set(await this.api.load());
      this.loadStatus.set('ready');
    } catch (error) {
      console.error(error);
      this.loadStatus.set('error');
    }
  }

  setScope(scope: DomainScope): void {
    this.scope.set(scope);
    try {
      globalThis.localStorage?.setItem(SCOPE_STORAGE_KEY, JSON.stringify(scope));
    } catch {
      // Storage may be blocked; the scope still holds for this session.
    }
  }

  /** Reset demo data: forget the remembered scope and the demo switch, then reload. */
  async resetDemo(): Promise<void> {
    this.scope.set(null);
    try {
      globalThis.localStorage?.removeItem(SCOPE_STORAGE_KEY);
    } catch {
      // Nothing stored that could be cleared.
    }
    this.config.demo.set('none');
    await this.load();
  }

  product(id: string | null | undefined): DataProduct | null {
    return this.products().find((p) => p.id === id) ?? null;
  }

  domain(id: string): Domain | null {
    return this.catalogue()?.domains.find((d) => d.id === id) ?? null;
  }

  subdomainName(product: DataProduct): string {
    return this.domain(product.domainId)?.subdomains.find((s) => s.id === product.subdomainId)?.name ?? '';
  }

  productsOfDomain(domainId: string): DataProduct[] {
    return this.products().filter((p) => p.domainId === domainId);
  }

  productDemo(productId: string): ProductDemo | null {
    return this.demo()?.products.find((p) => p.productId === productId) ?? null;
  }

  rowsOfProduct(productId: string): RuleRow[] {
    return this.rowsByProduct().get(productId) ?? [];
  }

  rowsOfProducts(productIds: readonly string[]): RuleRow[] {
    return productIds.flatMap((id) => this.rowsOfProduct(id));
  }

  rule(ruleId: string): RuleRow | null {
    return this.ruleRows().find((r) => r.rule.id === ruleId) ?? null;
  }

  issue(issueId: string): MockIssue | null {
    return this.issuesById().get(issueId) ?? null;
  }

  tablesOfProduct(productId: string): TableView[] {
    const product = this.product(productId);
    const repo = this.repository();
    if (!product || !repo) return [];
    const rows = this.rowsOfProduct(productId);
    return product.tableIds.flatMap((id) => {
      const table = repo.tables.find((t) => t.id === id);
      if (!table) return [];
      const demo = this.demo()?.tables.find((t) => t.tableId === id) ?? null;
      return [{
        table,
        demo,
        stale: !!demo && isStale(demo.lastRefreshedAt, PROTOTYPE_TODAY, STALE_AFTER_DAYS),
        failingRules: rows.filter((r) => r.rule.tableId === id && r.result.status === 'failed').length,
      }];
    });
  }

  tableView(productId: string, tableId: string): TableView | null {
    return this.tablesOfProduct(productId).find((t) => t.table.id === tableId) ?? null;
  }

  columnsOfTable(productId: string, tableId: string): ColumnView[] {
    const rows = this.rowsOfProduct(productId).filter((r) => r.rule.tableId === tableId);
    const table = this.repository()?.tables.find((t) => t.id === tableId);
    return (table?.columns ?? []).map((c) => {
      const own = rows.filter((r) => r.rule.column === c.name);
      return {
        name: c.name,
        ruleCount: c.ruleCount,
        failingCount: own.filter((r) => r.result.status === 'failed').length,
        dimensions: [...new Set(own.map((r) => r.rule.dimension).filter((d): d is string => !!d))].sort(),
      };
    });
  }

  dimensionsOfProduct(productId: string): DimensionView[] {
    const rows = this.rowsOfProduct(productId);
    const scores = this.productDemo(productId)?.dimensionScores ?? {};
    const names = [...new Set(rows.map((r) => r.rule.dimension).filter((d): d is string => !!d))].sort();
    return names.map((name) => {
      const own = rows.filter((r) => r.rule.dimension === name);
      return {
        name,
        ruleCount: own.length,
        activeCount: own.filter((r) => r.rule.active).length,
        failingCount: own.filter((r) => r.result.status === 'failed').length,
        tableIds: [...new Set(own.map((r) => r.rule.tableId))],
        score: scores[name] ?? null,
      };
    });
  }

  /** Mean of the product scores that exist. The demo domain score is this mean, labelled synthetic on screen. */
  domainScore(productIds: readonly string[]): number | null {
    return mean(productIds.map((id) => this.productDemo(id)?.score ?? null));
  }
}
