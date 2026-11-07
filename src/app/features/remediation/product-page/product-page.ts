import { ChangeDetectionStrategy, Component, computed, effect, inject, input } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { RemediationStore } from '../core/remediation-store.service';
import { Crumb, RegistryTable } from '../core/remediation.model';
import { ofProduct, ofTable, openOf, plural, rulesOfTable, summarise } from '../core/remediation.util';
import { Crumbs } from '../shared/crumbs/crumbs';
import { OpenCount } from '../shared/open-count/open-count';
import { SummaryLine } from '../shared/summary-line/summary-line';
import { TablePage } from '../table-page/table-page';

interface TableRow {
  table: RegistryTable;
  open: number;
  failing: number;
  checks: number;
}

/** Product → its tables, most open findings first. A product with one table goes straight to that table. */
@Component({
  selector: 'app-product-page',
  imports: [RouterLink, Crumbs, OpenCount, SummaryLine, TablePage],
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
      .map((id) => d.registry.tables.find((t) => t.id === id))
      .filter((t): t is RegistryTable => !!t)
      .map((table) => {
        const rules = rulesOfTable(d, table.id);
        return { table, checks: rules.length, failing: rules.filter((r) => r.failingNow > 0).length, open: openOf(ofTable(d, table.id)).length };
      })
      .sort((a, b) => b.open - a.open);
  });

  protected readonly open = computed(() => {
    const d = this.store.data();
    const product = this.product();
    return d && product ? openOf(ofProduct(d, product)).length : 0;
  });

  protected readonly summary = computed(() => {
    const d = this.store.data();
    return summarise(d ? this.rows().flatMap((r) => rulesOfTable(d, r.table.id)) : [], this.open());
  });

  constructor() {
    effect(() => {
      if (this.store.data() && !this.product()) void this.router.navigateByUrl('/remediation');
    });
  }
}
