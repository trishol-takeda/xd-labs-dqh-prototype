import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Breadcrumbs } from '../../../ui/breadcrumbs/breadcrumbs';
import { Crumb } from '../../../ui/breadcrumbs/breadcrumbs.model';
import { OriginTag } from '../../../ui/origin-tag/origin-tag';
import { StatePanel } from '../../../ui/state-panel/state-panel';
import { DIMENSION_RULE_COLUMNS } from '../core/my-domain.constants';
import { MyDomainStore } from '../core/my-domain-store.service';
import { scoreTone } from '../core/my-domain.util';
import { RulesTable } from '../rules-table/rules-table';

/** One data quality dimension within a data product: its tables and its rules. */
@Component({
  selector: 'app-dimension-detail-page',
  imports: [RouterLink, Breadcrumbs, OriginTag, RulesTable, StatePanel],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dimension-detail-page.html',
  styleUrl: './dimension-detail-page.css',
})
export class DimensionDetailPage {
  private readonly store = inject(MyDomainStore);
  readonly productId = input.required<string>();
  readonly dimension = input.required<string>();

  protected readonly ruleColumns = DIMENSION_RULE_COLUMNS;
  protected readonly product = computed(() => this.store.product(this.productId()));
  protected readonly view = computed(() => this.store.dimensionsOfProduct(this.productId()).find((d) => d.name === this.dimension()) ?? null);
  protected readonly rows = computed(() => this.store.rowsOfProduct(this.productId()).filter((r) => r.rule.dimension === this.dimension()));
  protected readonly tone = computed(() => `tone-${scoreTone(this.view()?.score ?? null)}`);
  protected readonly crumbs = computed<Crumb[]>(() => [
    { label: 'My Domain', link: ['/my-domain', 'home'] },
    { label: this.product()?.name ?? 'Data product', link: ['/my-domain', 'products', this.productId()] },
    { label: 'Dimensions', link: ['/my-domain', 'products', this.productId(), 'dimensions'] },
    { label: this.dimension() },
  ]);
}
