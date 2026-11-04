import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { OriginTag } from '../../../ui/origin-tag/origin-tag';
import { StatePanel } from '../../../ui/state-panel/state-panel';
import { PRODUCT_RULE_COLUMNS } from '../core/my-domain.constants';
import { MyDomainStore } from '../core/my-domain-store.service';
import { RulesTable } from '../rules-table/rules-table';

/** Every rule of a data product. Filters and sort live in the URL, so links from other pages can arrive pre-filtered. */
@Component({
  selector: 'app-product-rules-page',
  imports: [OriginTag, RulesTable, StatePanel],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './product-rules-page.html',
  styleUrl: './product-rules-page.css',
})
export class ProductRulesPage {
  private readonly store = inject(MyDomainStore);
  readonly productId = input.required<string>();
  protected readonly columns = PRODUCT_RULE_COLUMNS;
  protected readonly rows = computed(() => this.store.rowsOfProduct(this.productId()));
}
