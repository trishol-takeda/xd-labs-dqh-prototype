import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PROTOTYPE_TODAY } from '../../../core/constants/remediation.constants';
import { formatDate } from '../../../core/util/format';
import { Badge } from '../../../ui/badge/badge';
import { Icon } from '../../../ui/icon/icon';
import { OriginTag } from '../../../ui/origin-tag/origin-tag';
import { STALE_AFTER_DAYS } from '../core/my-domain.constants';
import { MyDomainStore } from '../core/my-domain-store.service';
import { deltaPoints, isStale, scoreTone } from '../core/my-domain.util';

const FAILING_PREVIEW = 5;

/** Data product overview: who owns it, how it scores, and what is inside. */
@Component({
  selector: 'app-product-overview-page',
  imports: [RouterLink, Badge, Icon, OriginTag],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './product-overview-page.html',
  styleUrl: './product-overview-page.css',
})
export class ProductOverviewPage {
  protected readonly store = inject(MyDomainStore);
  readonly productId = input.required<string>();

  protected readonly product = computed(() => this.store.product(this.productId()));
  protected readonly domainName = computed(() => this.store.domain(this.product()?.domainId ?? '')?.name ?? '');
  protected readonly subdomainName = computed(() => (this.product() ? this.store.subdomainName(this.product()!) : ''));
  protected readonly rows = computed(() => this.store.rowsOfProduct(this.productId()));
  protected readonly tables = computed(() => this.store.tablesOfProduct(this.productId()));
  protected readonly dimensions = computed(() => this.store.dimensionsOfProduct(this.productId()));
  protected readonly failing = computed(() => this.rows().filter((r) => r.result.status === 'failed').sort((a, b) => b.result.failed - a.result.failed));
  protected readonly preview = computed(() => this.failing().slice(0, FAILING_PREVIEW));
  protected readonly activeCount = computed(() => this.rows().filter((r) => r.rule.active).length);
  protected readonly demo = computed(() => this.store.productDemo(this.productId()));
  protected readonly score = computed(() => this.demo()?.score ?? null);
  protected readonly delta = computed(() => deltaPoints(this.demo()?.score ?? null, this.demo()?.previousScore ?? null));
  protected readonly tone = computed(() => `tone-${scoreTone(this.demo()?.score ?? null)}`);
  protected readonly staleTables = computed(() => this.tables().filter((t) => t.stale));
  protected readonly refreshed = computed(() => {
    const at = this.demo()?.lastRefreshedAt;
    return at ? formatDate(at, true) : null;
  });
  protected readonly refreshStale = computed(() => {
    const at = this.demo()?.lastRefreshedAt;
    return !!at && isStale(at, PROTOTYPE_TODAY, STALE_AFTER_DAYS);
  });
  protected readonly mapping = computed(() => this.store.catalogue()?.mappingValidation.find((m) => m.product === this.product()?.name) ?? null);
  protected readonly staleAfter = STALE_AFTER_DAYS;
  protected readonly failingQuery = { fail: '1' };

  protected deltaText(): string {
    const d = this.delta();
    if (d === null) return 'No previous score';
    if (d === 0) return 'No change since last visit';
    return `${d > 0 ? '↑' : '↓'} ${Math.abs(d).toFixed(1)} pp since last visit`;
  }
}
