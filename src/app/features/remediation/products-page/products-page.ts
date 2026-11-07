import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { StatePanel } from '../../../ui/state-panel/state-panel';
import { RemediationStore } from '../core/remediation-store.service';
import { NEXT_LABEL } from '../core/remediation.constants';
import { inScopeScore, nextDecision, ofProduct, openOf, plural, segWords } from '../core/remediation.util';
import { ProductCard, ProductGrid } from '../shared/product-grid/product-grid';

/**
 * Role landing. A trustee lands on their own domain with a "Start here" panel and the other products folded away;
 * everyone else (and `/all`) sees every product.
 */
@Component({
  selector: 'app-products-page',
  imports: [RouterLink, StatePanel, ProductGrid],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './products-page.html',
})
export class ProductsPage {
  protected readonly store = inject(RemediationStore);
  /** Route data: `/remediation/all` shows every product even to a trustee. */
  readonly all = input(false);

  protected readonly plural = plural;
  protected readonly segWords = segWords;
  protected readonly showOthers = signal(false);
  protected readonly mine = computed(() => this.store.role() === 'trustee' && !this.all());

  protected readonly cards = computed(() => {
    const d = this.store.data();
    if (!d) return [];
    return d.registry.products.map((product): ProductCard => {
      const open = openOf(ofProduct(d, product));
      return { product, open: open.length, pastTarget: open.filter((f) => f.pastTarget).length, inScopeScore: inScopeScore(d, product) };
    });
  });
  protected readonly mineCards = computed(() => this.cards().filter((c) => c.product.domain === this.store.myDomain()));
  protected readonly otherCards = computed(() => this.cards().filter((c) => c.product.domain !== this.store.myDomain()));
  protected readonly openTotal = computed(() => this.cards().reduce((sum, c) => sum + c.open, 0));
  protected readonly openMine = computed(() => this.mineCards().reduce((sum, c) => sum + c.open, 0));

  /** The single highest-impact finding waiting for this trustee. */
  protected readonly start = computed(() => {
    const first = this.store.queue()[0];
    const key = first ? nextDecision(first) : null;
    return first ? { finding: first, next: key ? NEXT_LABEL[key] : '' } : null;
  });
}
