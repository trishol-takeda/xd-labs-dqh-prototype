import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Badge } from '../../../ui/badge/badge';
import { Breadcrumbs } from '../../../ui/breadcrumbs/breadcrumbs';
import { Crumb } from '../../../ui/breadcrumbs/breadcrumbs.model';
import { Icon } from '../../../ui/icon/icon';
import { StatePanel } from '../../../ui/state-panel/state-panel';
import { LIFECYCLE_TONE, PRODUCT_TABS } from '../core/my-domain.constants';
import { MyDomainStore } from '../core/my-domain-store.service';

/** Header, breadcrumbs and tabs shared by a data product's Overview, Tables, Dimensions and Rules pages. */
@Component({
  selector: 'app-product-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Badge, Breadcrumbs, Icon, StatePanel],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './product-shell.html',
  styleUrl: './product-shell.css',
})
export class ProductShell {
  private readonly store = inject(MyDomainStore);
  readonly productId = input.required<string>();

  protected readonly tabs = PRODUCT_TABS;
  protected readonly lifecycleTone = LIFECYCLE_TONE;
  protected readonly product = computed(() => this.store.product(this.productId()));
  protected readonly hasRules = computed(() => (this.product()?.tableIds.length ?? 0) > 0);
  protected readonly crumbs = computed<Crumb[]>(() => {
    const product = this.product();
    if (!product) return [];
    return [
      { label: 'My Domain', link: ['/my-domain', 'home'] },
      { label: 'Data products', link: ['/my-domain', 'products'] },
      { label: `${this.store.domain(product.domainId)?.name ?? ''} · ${this.store.subdomainName(product)}` },
      { label: product.name },
    ];
  });

  protected tabLink(path: string): string[] {
    return path ? ['/my-domain', 'products', this.productId(), path] : ['/my-domain', 'products', this.productId()];
  }
}
