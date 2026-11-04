import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { formatDate, full } from '../../../core/util/format';
import { Breadcrumbs } from '../../../ui/breadcrumbs/breadcrumbs';
import { Crumb } from '../../../ui/breadcrumbs/breadcrumbs.model';
import { Icon } from '../../../ui/icon/icon';
import { OriginTag } from '../../../ui/origin-tag/origin-tag';
import { StatePanel } from '../../../ui/state-panel/state-panel';
import { TABLE_RULE_COLUMNS } from '../core/my-domain.constants';
import { MyDomainStore } from '../core/my-domain-store.service';
import { scoreTone } from '../core/my-domain.util';
import { RulesTable } from '../rules-table/rules-table';

/** One table: its columns with rule counts, and the rules that check it. Picking a column filters the rules below. */
@Component({
  selector: 'app-table-detail-page',
  imports: [RouterLink, Breadcrumbs, Icon, OriginTag, RulesTable, StatePanel],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './table-detail-page.html',
  styleUrl: './table-detail-page.css',
})
export class TableDetailPage {
  private readonly store = inject(MyDomainStore);
  readonly productId = input.required<string>();
  readonly tableId = input.required<string>();

  protected readonly ruleColumns = TABLE_RULE_COLUMNS;
  protected readonly full = full;
  protected readonly product = computed(() => this.store.product(this.productId()));
  protected readonly view = computed(() => this.store.tableView(this.productId(), this.tableId()));
  protected readonly columns = computed(() => this.store.columnsOfTable(this.productId(), this.tableId()));
  protected readonly rows = computed(() => this.store.rowsOfProduct(this.productId()).filter((r) => r.rule.tableId === this.tableId()));
  protected readonly tone = computed(() => `tone-${scoreTone(this.view()?.demo?.score ?? null)}`);
  protected readonly scoreText = computed(() => {
    const score = this.view()?.demo?.score;
    return score === null || score === undefined ? '—' : `${score.toFixed(1)}%`;
  });
  protected readonly refreshed = computed(() => {
    const at = this.view()?.demo?.lastRefreshedAt;
    return at ? formatDate(at, true) : 'Not available';
  });
  protected readonly crumbs = computed<Crumb[]>(() => [
    { label: 'My Domain', link: ['/my-domain', 'home'] },
    { label: this.product()?.name ?? 'Data product', link: ['/my-domain', 'products', this.productId()] },
    { label: 'Tables', link: ['/my-domain', 'products', this.productId(), 'tables'] },
    { label: this.tableId() },
  ]);
}
