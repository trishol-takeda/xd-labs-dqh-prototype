import { StatePanel } from '../../../ui/state-panel/state-panel';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { RemediationStore } from '../core/remediation-store.service';
import { Crumb, Table } from '../core/remediation.model';
import { causesOfProduct, causesOfTable, openCount, plural, rulesOfTable, summarise } from '../core/remediation.util';
import { Crumbs } from '../shared/crumbs/crumbs';
import { OpenCount } from '../shared/open-count/open-count';
import { SummaryLine } from '../shared/summary-line/summary-line';

interface TableRow {
  table: Table;
  open: number;
  failing: number;
}

/** Screen 2: one product and its tables, most open causes first, then lowest score. */
@Component({
  selector: 'app-product-page',
  imports: [StatePanel, RouterLink, Crumbs, OpenCount, SummaryLine],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './product-page.html',
})
export class ProductPage {
  protected readonly store = inject(RemediationStore);
  private readonly router = inject(Router);

  /** Route parameter, bound by withComponentInputBinding. */
  readonly productId = input.required<string>();
  protected readonly plural = plural;

  protected readonly product = computed(() => this.store.product(this.productId()));
  protected readonly crumbs = computed<readonly Crumb[]>(() => [{ label: 'Data products', link: ['/remediation'] }, { label: this.product()?.name ?? '' }]);

  protected readonly rows = computed<TableRow[]>(() => {
    const d = this.store.data();
    const product = this.product();
    if (!d || !product) return [];
    return product.tables
      .map((id) => d.tables.find((t) => t.id === id))
      .filter((t): t is Table => !!t)
      .map((table) => ({
        table,
        open: openCount(causesOfTable(d, table.id)),
        failing: rulesOfTable(d, table.id).filter((r) => r.failingNow > 0).length,
      }))
      .sort((a, b) => b.open - a.open || (a.table.qualityScore ?? 100) - (b.table.qualityScore ?? 100));
  });

  protected readonly open = computed(() => {
    const d = this.store.data();
    const product = this.product();
    return d && product ? openCount(causesOfProduct(d, product.name)) : 0;
  });

  protected readonly summary = computed(() => {
    const d = this.store.data();
    if (!d) return summarise([], 0);
    return summarise(
      this.rows().flatMap((r) => rulesOfTable(d, r.table.id)),
      this.open(),
    );
  });

  constructor() {
    effect(() => {
      if (this.store.data() && !this.product()) void this.router.navigateByUrl('/remediation');
    });
  }
}
