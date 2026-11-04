import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Icon } from '../../../ui/icon/icon';
import { StatePanel } from '../../../ui/state-panel/state-panel';
import { NO_ACCESS_TEXT } from '../core/my-domain.constants';
import { MyDomainStore } from '../core/my-domain-store.service';
import { DataProduct, Domain, Subdomain } from '../core/my-domain.model';
import { sentenceCount } from '../core/my-domain.util';

interface ProductGroup {
  subdomain: Subdomain;
  products: DataProduct[];
  selected: number;
  total: number;
}

/** Set up My Domain: choose a domain, then the data products you own. Saved in the browser. */
@Component({
  selector: 'app-scope-setup-page',
  imports: [Icon, StatePanel],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './scope-setup-page.html',
  styleUrl: './scope-setup-page.css',
})
export class ScopeSetupPage {
  protected readonly store = inject(MyDomainStore);
  private readonly router = inject(Router);

  protected readonly noAccessText = NO_ACCESS_TEXT;
  protected readonly search = signal('');
  protected readonly domainId = signal<string>('');
  protected readonly selected = signal<ReadonlySet<string>>(new Set());
  protected readonly preselectedCount = signal(0);
  protected readonly hadScope = this.store.hasScope();

  protected readonly domain = computed<Domain | null>(() => this.store.domains().find((d) => d.id === this.domainId()) ?? null);
  protected readonly domainProducts = computed(() => (this.domain() ? this.store.productsOfDomain(this.domain()!.id) : []));
  protected readonly canEdit = computed(() => this.domain()?.access === 'granted' && this.domainProducts().length > 0);
  protected readonly suggestedName = computed(() => this.store.domain(this.store.catalogue()?.suggestedDomainId ?? '')?.name ?? '');
  protected readonly selectedProducts = computed(() => this.domainProducts().filter((p) => this.selected().has(p.id)));
  protected readonly allSelected = computed(() => this.domainProducts().length > 0 && this.selectedProducts().length === this.domainProducts().length);

  protected readonly groups = computed<ProductGroup[]>(() => {
    const domain = this.domain();
    if (!domain) return [];
    const needle = this.search().trim().toLowerCase();
    return domain.subdomains
      .map((subdomain) => {
        const all = this.domainProducts().filter((p) => p.subdomainId === subdomain.id);
        return {
          subdomain,
          products: all.filter((p) => !needle || p.name.toLowerCase().includes(needle)),
          selected: all.filter((p) => this.selected().has(p.id)).length,
          total: all.length,
        };
      })
      .filter((g) => g.products.length > 0);
  });

  constructor() {
    const scope = this.store.scope();
    const domains = this.store.domains();
    const start = domains.find((d) => d.id === scope?.domainId) ?? domains.find((d) => d.id === this.store.catalogue()?.suggestedDomainId) ?? domains[0];
    if (!start) return;
    this.domainId.set(start.id);
    if (this.store.hasScope() && scope?.domainId === start.id) {
      this.selected.set(new Set(scope.productIds));
    } else if (start.access === 'granted') {
      // First visit: tick the products the user is named trustee for.
      const trustee = this.store.productsOfDomain(start.id).filter((p) => p.userIsTrustee);
      this.selected.set(new Set(trustee.map((p) => p.id)));
      this.preselectedCount.set(trustee.length);
    }
  }

  protected domainSummary(domain: Domain): string {
    if (domain.access === 'none') return 'No access';
    const products = this.store.productsOfDomain(domain.id).length;
    return `${sentenceCount(products, 'data product')} · ${sentenceCount(domain.subdomains.length, 'subdomain')}`;
  }

  protected chooseDomain(id: string): void {
    if (id === this.domainId()) return;
    this.domainId.set(id);
    this.selected.set(new Set()); // Changing the domain clears the product selection.
    this.preselectedCount.set(0);
    this.search.set('');
  }

  protected toggle(id: string, on: boolean): void {
    this.selected.update((s) => {
      const next = new Set(s);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
    this.preselectedCount.set(0);
  }

  protected toggleAll(on: boolean): void {
    this.selected.set(new Set(on ? this.domainProducts().map((p) => p.id) : []));
    this.preselectedCount.set(0);
  }

  protected save(): void {
    if (!this.canEdit() || this.selected().size === 0) return;
    this.store.setScope({ domainId: this.domainId(), productIds: this.selectedProducts().map((p) => p.id) });
    void this.router.navigate(['/my-domain', 'home']);
  }

  /** Clears the product selection and the search, and returns to the suggested domain. Stays on this page. */
  protected cancel(): void {
    const domains = this.store.domains();
    const start = domains.find((d) => d.id === this.store.catalogue()?.suggestedDomainId) ?? domains[0];
    if (start) this.domainId.set(start.id);
    this.selected.set(new Set());
    this.preselectedCount.set(0);
    this.search.set('');
  }
}
