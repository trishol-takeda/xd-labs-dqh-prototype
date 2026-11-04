import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { formatDate, full } from '../../../core/util/format';
import { Badge } from '../../../ui/badge/badge';
import { Icon } from '../../../ui/icon/icon';
import { OriginTag } from '../../../ui/origin-tag/origin-tag';
import { StatePanel } from '../../../ui/state-panel/state-panel';
import { MyDomainStore } from '../core/my-domain-store.service';
import { TableView } from '../core/my-domain.model';
import { scoreTone } from '../core/my-domain.util';

type TableSort = 'name' | 'rules' | 'failing' | 'rows' | 'score';
type TableFilter = '' | 'failing' | 'stale';

/** Tables of a data product: real table names and rule counts from the repository, with labelled synthetic row counts and scores. */
@Component({
  selector: 'app-product-tables-page',
  imports: [RouterLink, Badge, Icon, OriginTag, StatePanel],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './product-tables-page.html',
  styleUrl: './product-tables-page.css',
})
export class ProductTablesPage {
  private readonly store = inject(MyDomainStore);
  readonly productId = input.required<string>();

  protected readonly search = signal('');
  protected readonly filter = signal<TableFilter>('');
  protected readonly sort = signal<TableSort>('name');
  protected readonly full = full;

  protected readonly all = computed(() => this.store.tablesOfProduct(this.productId()));
  protected readonly rows = computed(() => {
    const needle = this.search().trim().toLowerCase();
    const filter = this.filter();
    const sort = this.sort();
    const value = (t: TableView): number => {
      switch (sort) {
        case 'rules': return t.table.ruleCount;
        case 'failing': return t.failingRules;
        case 'rows': return t.demo?.rowCount ?? -1;
        default: return t.demo?.score ?? -1;
      }
    };
    return this.all()
      .filter((t) => !needle || t.table.name.includes(needle) || t.table.columns.some((c) => c.name.toLowerCase().includes(needle)))
      .filter((t) => filter === '' || (filter === 'failing' ? t.failingRules > 0 : t.stale))
      .sort((a, b) => (sort === 'name' ? a.table.name.localeCompare(b.table.name) : sort === 'score' ? value(a) - value(b) : value(b) - value(a)));
  });
  protected readonly filtersActive = computed(() => !!(this.search() || this.filter()));

  protected clear(): void {
    this.search.set('');
    this.filter.set('');
  }

  protected tone(score: number | null | undefined): string {
    return `tone-${scoreTone(score ?? null)}`;
  }

  protected scoreText(t: TableView): string {
    const score = t.demo?.score;
    return score === null || score === undefined ? '—' : `${score.toFixed(1)}%`;
  }

  protected refreshed(t: TableView): string {
    return t.demo ? formatDate(t.demo.lastRefreshedAt) : '—';
  }
}
