import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Badge } from '../../../ui/badge/badge';
import { Breadcrumbs } from '../../../ui/breadcrumbs/breadcrumbs';
import { Crumb } from '../../../ui/breadcrumbs/breadcrumbs.model';
import { Icon } from '../../../ui/icon/icon';
import { OriginTag } from '../../../ui/origin-tag/origin-tag';
import { StatePanel } from '../../../ui/state-panel/state-panel';
import { LIFECYCLE_TONE, NO_ACCESS_TEXT } from '../core/my-domain.constants';
import { MyDomainStore } from '../core/my-domain-store.service';
import { DataProduct } from '../core/my-domain.model';
import { scoreTone } from '../core/my-domain.util';

type ProductSort = 'name' | 'subdomain' | 'score';

interface ProductRow {
  product: DataProduct;
  subdomain: string;
  score: number | null;
  rules: number;
  failing: number;
  inScope: boolean;
}

/** Data product selection: the products under a domain, with search, filters, sort and a way into each overview. */
@Component({
  selector: 'app-products-page',
  imports: [RouterLink, Badge, Breadcrumbs, Icon, OriginTag, StatePanel],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './products-page.html',
  styleUrl: './products-page.css',
})
export class ProductsPage {
  protected readonly store = inject(MyDomainStore);
  protected readonly lifecycleTone = LIFECYCLE_TONE;
  protected readonly noAccessText = NO_ACCESS_TEXT;

  protected readonly domainId = signal(this.store.scope()?.domainId ?? this.store.catalogue()?.suggestedDomainId ?? '');
  protected readonly search = signal('');
  protected readonly subdomain = signal('');
  protected readonly lifecycle = signal('');
  protected readonly trusteeOnly = signal(false);
  protected readonly sort = signal<ProductSort>('name');

  protected readonly domain = computed(() => this.store.domains().find((d) => d.id === this.domainId()) ?? null);
  protected readonly crumbs = computed<Crumb[]>(() => [{ label: 'My Domain', link: ['/my-domain', 'home'] }, { label: 'Data products' }]);

  protected readonly all = computed<ProductRow[]>(() => {
    const domain = this.domain();
    if (!domain || domain.access === 'none') return [];
    const scoped = new Set(this.store.scope()?.productIds ?? []);
    return this.store.productsOfDomain(domain.id).map((product) => {
      const rows = this.store.rowsOfProduct(product.id);
      return {
        product,
        subdomain: this.store.subdomainName(product),
        score: this.store.productDemo(product.id)?.score ?? null,
        rules: rows.length,
        failing: rows.filter((r) => r.result.status === 'failed').length,
        inScope: scoped.has(product.id),
      };
    });
  });

  protected readonly lifecycles = computed(() => [...new Set(this.all().map((r) => r.product.lifecycleStatus))].sort());
  protected readonly subdomains = computed(() => this.domain()?.subdomains ?? []);

  protected readonly rows = computed(() => {
    const needle = this.search().trim().toLowerCase();
    const sort = this.sort();
    return this.all()
      .filter((r) => !needle || [r.product.name, r.subdomain, r.product.trustee].some((v) => v?.toLowerCase().includes(needle)))
      .filter((r) => !this.subdomain() || r.product.subdomainId === this.subdomain())
      .filter((r) => !this.lifecycle() || r.product.lifecycleStatus === this.lifecycle())
      .filter((r) => !this.trusteeOnly() || r.product.userIsTrustee)
      .sort((a, b) => {
        if (sort === 'score') return (b.score ?? -1) - (a.score ?? -1) || a.product.name.localeCompare(b.product.name);
        if (sort === 'subdomain') return a.subdomain.localeCompare(b.subdomain) || a.product.name.localeCompare(b.product.name);
        return a.product.name.localeCompare(b.product.name);
      });
  });
  protected readonly filtersActive = computed(() => !!(this.search() || this.subdomain() || this.lifecycle() || this.trusteeOnly()));

  protected chooseDomain(id: string): void {
    this.domainId.set(id);
    this.clear();
  }

  protected clear(): void {
    this.search.set('');
    this.subdomain.set('');
    this.lifecycle.set('');
    this.trusteeOnly.set(false);
  }

  protected tone(score: number | null): string {
    return `tone-${scoreTone(score)}`;
  }
}
