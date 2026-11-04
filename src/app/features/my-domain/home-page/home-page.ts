import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { formatDate } from '../../../core/util/format';
import { Icon } from '../../../ui/icon/icon';
import { OriginTag } from '../../../ui/origin-tag/origin-tag';
import { StatePanel } from '../../../ui/state-panel/state-panel';
import { HOME_RULE_COLUMNS } from '../core/my-domain.constants';
import { MyDomainStore } from '../core/my-domain-store.service';
import { deltaPoints, mean, scoreTone } from '../core/my-domain.util';
import { RulesTable } from '../rules-table/rules-table';

interface ScoreTile {
  score: number | null;
  delta: number | null;
  tone: string;
}

/** My Domain home (Figma "Welcome"): the products in scope, the scores, and the rules under them. */
@Component({
  selector: 'app-home-page',
  imports: [RouterLink, Icon, OriginTag, StatePanel, RulesTable],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './home-page.html',
  styleUrl: './home-page.css',
})
export class HomePage {
  protected readonly store = inject(MyDomainStore);
  protected readonly columns = HOME_RULE_COLUMNS;

  /** Products switched off in the scope bar. Everything on the page follows the products still switched on. */
  private readonly hidden = signal<ReadonlySet<string>>(new Set());

  protected readonly scopeProducts = this.store.scopeProducts;
  protected readonly active = computed(() => this.scopeProducts().filter((p) => !this.hidden().has(p.id)));
  protected readonly activeIds = computed(() => this.active().map((p) => p.id));
  protected readonly rows = computed(() => this.store.rowsOfProducts(this.activeIds()));
  protected readonly withoutData = computed(() => this.active().filter((p) => p.tableIds.length === 0));
  protected readonly updated = computed(() => {
    const at = this.store.demo()?.executedAt;
    return at ? formatDate(at, true) : '';
  });

  protected readonly domainTile = computed<ScoreTile>(() => {
    const ids = this.activeIds();
    const score = this.store.domainScore(ids);
    const previous = mean(ids.map((id) => this.store.productDemo(id)?.previousScore ?? null));
    return { score, delta: deltaPoints(score, previous), tone: `tone-${scoreTone(score)}` };
  });

  protected readonly lowest = computed(() => {
    const scored = this.active()
      .map((product) => ({ product, demo: this.store.productDemo(product.id) }))
      .filter((x) => x.demo?.score != null);
    if (!scored.length) return null;
    const low = scored.reduce((a, b) => (b.demo!.score! < a.demo!.score! ? b : a));
    const score = low.demo!.score;
    return { product: low.product, tile: { score, delta: deltaPoints(score, low.demo!.previousScore), tone: `tone-${scoreTone(score)}` } as ScoreTile };
  });

  protected isOn(id: string): boolean {
    return !this.hidden().has(id);
  }

  protected toggle(id: string): void {
    this.hidden.update((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  protected score(value: number | null): string {
    return value === null ? '—' : `${value.toFixed(1)}%`;
  }

  protected deltaText(delta: number | null, improvedWord: string): string {
    if (delta === null) return 'No previous score';
    if (delta === 0) return 'No change since last visit';
    return `${delta > 0 ? '↑' : '↓'} ${Math.abs(delta).toFixed(1)} pp ${delta > 0 ? improvedWord : 'since last visit'}`;
  }
}
