import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Params, Router, RouterLink } from '@angular/router';
import { Badge } from '../../../ui/badge/badge';
import { Icon } from '../../../ui/icon/icon';
import { Pagination } from '../../../ui/pagination/pagination';
import { StatePanel } from '../../../ui/state-panel/state-panel';
import { compact, full } from '../../../core/util/format';
import {
  DEFAULT_PAGE_SIZE, DEFAULT_RULE_QUERY, EXECUTION_STATUS_INFO, PAGE_SIZES, RULE_COLUMNS,
} from '../core/my-domain.constants';
import { ExecutionStatus, RuleColumnDef, RuleQuery, RuleRow, RuleSortKey, SortDirection } from '../core/my-domain.model';
import { clampPage, filterRules, pageSlice, scoreTone, sortRules } from '../core/my-domain.util';

const SORT_KEYS = new Set<string>(RULE_COLUMNS.map((c) => c.sortKey).filter((k): k is RuleSortKey => !!k));

/**
 * The rules listing used on the home page and under a product, table or dimension.
 * Search, filters, sort, page and page size live in the URL, so a view can be shared and back/forward works.
 */
@Component({
  selector: 'app-rules-table',
  imports: [RouterLink, Badge, Icon, Pagination, StatePanel],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './rules-table.html',
  styleUrl: './rules-table.css',
})
export class RulesTable {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly rows = input.required<readonly RuleRow[]>();
  /** Column IDs shown at first; the rest are available through Show/Hide Column. */
  readonly defaultColumns = input.required<readonly string[]>();
  /** Failing rules only until the user turns it off. */
  readonly defaultFailingOnly = input(false);
  readonly noun = input('rules');
  /** Link prefix for a rule: [..., productId, 'rules', ruleId] is appended. */
  readonly ruleLinkBase = input<readonly string[]>(['/my-domain', 'products']);

  protected readonly allColumns = RULE_COLUMNS;
  protected readonly pageSizes = PAGE_SIZES;
  protected readonly statusInfo = EXECUTION_STATUS_INFO;
  protected readonly statuses: readonly ExecutionStatus[] = ['failed', 'passed', 'not-run'];
  protected readonly full = full;
  protected readonly compact = compact;

  private readonly params = toSignal(this.route.queryParamMap, { initialValue: this.route.snapshot.queryParamMap });
  protected readonly visibleIds = linkedSignal(() => new Set(this.defaultColumns()));
  protected readonly visibleColumns = computed(() => RULE_COLUMNS.filter((c) => this.visibleIds().has(c.id)));

  protected readonly query = computed<RuleQuery>(() => {
    const p = this.params();
    const sort = p.get('sort') ?? '';
    const fail = p.get('fail');
    return {
      search: p.get('q') ?? DEFAULT_RULE_QUERY.search,
      dimension: p.get('dim') ?? '',
      table: p.get('tbl') ?? '',
      column: p.get('col') ?? '',
      status: (this.statuses as readonly string[]).includes(p.get('st') ?? '') ? (p.get('st') as ExecutionStatus) : '',
      active: p.get('act') === 'yes' || p.get('act') === 'no' ? (p.get('act') as 'yes' | 'no') : '',
      failingOnly: fail === null ? this.defaultFailingOnly() : fail === '1',
      sort: SORT_KEYS.has(sort) ? (sort as RuleSortKey) : 'default',
      direction: p.get('dir') === 'desc' ? 'desc' : 'asc',
    };
  });
  protected readonly pageSize = computed(() => {
    const size = Number(this.params().get('size'));
    return (PAGE_SIZES as readonly number[]).includes(size) ? size : DEFAULT_PAGE_SIZE;
  });

  protected readonly dimensions = computed(() => this.distinct((r) => r.rule.dimension));
  protected readonly tables = computed(() => this.distinct((r) => r.rule.tableId));
  protected readonly columns = computed(() => this.distinct((r) => r.rule.column));
  protected readonly failingTotal = computed(() => this.rows().filter((r) => r.result.status === 'failed').length);

  protected readonly filtered = computed(() => sortRules(filterRules(this.rows(), this.query()), this.query().sort, this.query().direction));
  protected readonly page = computed(() => clampPage(Number(this.params().get('page')) || 1, this.filtered().length, this.pageSize()));
  protected readonly pageRows = computed(() => pageSlice(this.filtered(), this.page(), this.pageSize()));
  protected readonly filtersActive = computed(() => {
    const q = this.query();
    return !!(q.search || q.dimension || q.table || q.column || q.status || q.active || q.failingOnly !== this.defaultFailingOnly());
  });
  protected readonly summary = computed(() => {
    const noun = this.query().failingOnly ? 'failing rules' : this.noun();
    return `Showing ${full(this.pageRows().length)} of ${full(this.filtered().length)} ${noun}`;
  });
  protected readonly sortNote = computed(() => {
    const q = this.query();
    if (q.sort === 'default') return 'sorted by failing first, then affected records';
    const label = RULE_COLUMNS.find((c) => c.sortKey === q.sort)?.label ?? q.sort;
    return `sorted by ${label.toLowerCase()}, ${q.direction === 'asc' ? 'ascending' : 'descending'}`;
  });

  private distinct(pick: (r: RuleRow) => string | null): string[] {
    return [...new Set(this.rows().map(pick).filter((v): v is string => !!v))].sort((a, b) => a.localeCompare(b));
  }

  /** Typing replaces the history entry so Back is not flooded; every other change (filter, sort, page) is a step Back can undo. */
  private patch(changes: Params, replaceUrl = false): void {
    void this.router.navigate([], { relativeTo: this.route, queryParams: changes, queryParamsHandling: 'merge', replaceUrl });
  }

  protected setText(key: string, value: string): void {
    this.patch({ [key]: value || null, page: null }, key === 'q');
  }

  protected setFailingOnly(on: boolean): void {
    this.patch({ fail: on === this.defaultFailingOnly() ? null : on ? '1' : '0', page: null });
  }

  protected setPage(page: number): void {
    this.patch({ page: page > 1 ? page : null });
  }

  protected setPageSize(size: string): void {
    this.patch({ size: Number(size) === DEFAULT_PAGE_SIZE ? null : size, page: null });
  }

  protected clearFilters(): void {
    this.patch({ q: null, dim: null, tbl: null, col: null, st: null, act: null, fail: this.defaultFailingOnly() ? '0' : null, page: null });
  }

  protected sortBy(column: RuleColumnDef): void {
    const key = column.sortKey;
    if (!key) return;
    const q = this.query();
    const direction: SortDirection = q.sort === key ? (q.direction === 'asc' ? 'desc' : 'asc') : column.numeric ? 'desc' : 'asc';
    this.patch({ sort: key, dir: direction === 'asc' ? null : 'desc', page: null });
  }

  protected ariaSort(column: RuleColumnDef): 'ascending' | 'descending' | 'none' {
    const q = this.query();
    return column.sortKey && q.sort === column.sortKey ? (q.direction === 'asc' ? 'ascending' : 'descending') : 'none';
  }

  protected isSorted(column: RuleColumnDef): boolean {
    return !!column.sortKey && this.query().sort === column.sortKey;
  }

  protected toggleColumn(id: string, shown: boolean): void {
    this.visibleIds.update((set) => {
      const next = new Set(set);
      if (shown) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  protected ruleLink(row: RuleRow): readonly string[] {
    return [...this.ruleLinkBase(), row.productId, 'rules', row.rule.id];
  }

  protected tone(row: RuleRow): string {
    return `tone-${scoreTone(row.result.score)}`;
  }

  protected scoreText(row: RuleRow): string {
    return row.result.score === null ? '—' : `${row.result.score.toFixed(1)}%`;
  }

  protected failText(row: RuleRow): string {
    if (row.result.status === 'not-run') return '—';
    return `${full(row.result.failed)}${row.failedPct !== null && row.result.failed ? ` (${row.failedPct.toFixed(1)}%)` : ''}`;
  }

  protected updatedText(row: RuleRow): string {
    return row.rule.definitionUpdatedAt ? row.rule.definitionUpdatedAt.slice(0, 10) : '—';
  }
}
