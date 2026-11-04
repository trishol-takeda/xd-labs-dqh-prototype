import { ChangeDetectionStrategy, Component, computed, effect, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { REMEDIATION_PREVIEW_MODE } from '../../../core/constants/remediation.constants';
import { ProductView } from '../../../core/models/remediation.model';
import { PrototypeConfig } from '../../../core/state/prototype-config.service';
import { RemediationStore } from '../../../core/state/remediation-store.service';
import { Icon } from '../../../ui/icon/icon';
import { Skeleton } from '../../../ui/skeleton/skeleton';
import { CauseDetail } from '../cause-detail/cause-detail';
import { CauseList } from '../cause-list/cause-list';
import { ProductStrip } from '../product-strip/product-strip';

/** The one destination: product strip, cause list grouped by state, cause detail. Selection lives in the URL. */
@Component({
  selector: 'app-hub-page',
  imports: [Icon, Skeleton, ProductStrip, CauseList, CauseDetail],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './hub-page.html',
  styleUrl: './hub-page.css',
})
export class HubPage {
  /** Query parameters, bound by the router. */
  readonly product = input<string>();
  readonly cause = input<string>();

  protected readonly store = inject(RemediationStore);
  protected readonly config = inject(PrototypeConfig);
  private readonly router = inject(Router);
  protected readonly previewMode = REMEDIATION_PREVIEW_MODE;

  protected readonly selectedProduct = computed<ProductView | undefined>(() => {
    const products = this.store.products();
    return products.find((p) => p.name === this.product()) ?? products[0];
  });
  protected readonly productCauses = computed(() => this.store.causes().filter((c) => c.product === this.selectedProduct()?.name));
  protected readonly selectedCause = computed(() => this.productCauses().find((c) => c.id === this.cause()));
  protected readonly isEmpty = computed(
    () => this.config.demo() === 'empty' || (this.store.status() === 'ready' && !this.store.products().length),
  );

  constructor() {
    // A cause that is not in the selected product (for example an old link) is dropped from the URL.
    effect(() => {
      if (this.store.status() === 'ready' && this.cause() && !this.selectedCause()) {
        void this.router.navigate([], { queryParams: { cause: null }, queryParamsHandling: 'merge', replaceUrl: true });
      }
    });
  }

  protected selectProduct(name: string): void {
    void this.router.navigate([], { queryParams: { product: name, cause: null }, queryParamsHandling: 'merge' });
  }

  protected selectCause(id: string | null): void {
    void this.router.navigate([], { queryParams: { cause: id }, queryParamsHandling: 'merge' });
  }

  protected retry(): void {
    this.config.demo.set('none');
    void this.store.load();
  }
}
