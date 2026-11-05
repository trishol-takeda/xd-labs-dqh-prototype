import { StatePanel } from '../../../ui/state-panel/state-panel';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { RemediationStore } from '../core/remediation-store.service';
import { Crumb } from '../core/remediation.model';
import { causesOfProduct, openCount } from '../core/remediation.util';
import { Chip } from '../shared/chip/chip';
import { Crumbs } from '../shared/crumbs/crumbs';
import { OpenCount } from '../shared/open-count/open-count';

/** Screen 1: every data product as a card, lowest quality score first (the order the data arrives in). */
@Component({
  selector: 'app-products-page',
  imports: [StatePanel, RouterLink, Chip, Crumbs, OpenCount],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './products-page.html',
})
export class ProductsPage {
  protected readonly store = inject(RemediationStore);
  protected readonly crumbs: readonly Crumb[] = [{ label: 'Data products' }];

  protected readonly cards = computed(() => {
    const d = this.store.data();
    if (!d) return [];
    return d.products.map((product) => ({ product, open: openCount(causesOfProduct(d, product.name)) }));
  });
}
