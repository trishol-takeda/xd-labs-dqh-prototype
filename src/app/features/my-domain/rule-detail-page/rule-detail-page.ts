import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { formatDate, full } from '../../../core/util/format';
import { Badge } from '../../../ui/badge/badge';
import { Breadcrumbs } from '../../../ui/breadcrumbs/breadcrumbs';
import { Crumb } from '../../../ui/breadcrumbs/breadcrumbs.model';
import { Icon } from '../../../ui/icon/icon';
import { OriginTag } from '../../../ui/origin-tag/origin-tag';
import { Sparkline } from '../../../ui/sparkline/sparkline';
import { StatePanel } from '../../../ui/state-panel/state-panel';
import { EXECUTION_STATUS_INFO, REMEDIATION_TICKET, ROOT_CAUSE_INFO, ROOT_CAUSE_UNKNOWN_TEXT } from '../core/my-domain.constants';
import { MyDomainStore } from '../core/my-domain-store.service';

/** Rule details: the repository definition and SQL, then the synthetic latest run and, for a failure, the analysis. */
@Component({
  selector: 'app-rule-detail-page',
  imports: [RouterLink, Badge, Breadcrumbs, Icon, OriginTag, Sparkline, StatePanel],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './rule-detail-page.html',
  styleUrl: './rule-detail-page.css',
})
export class RuleDetailPage {
  private readonly store = inject(MyDomainStore);
  readonly productId = input.required<string>();
  readonly ruleId = input.required<string>();

  protected readonly full = full;
  protected readonly statusInfo = EXECUTION_STATUS_INFO;
  protected readonly causeInfo = ROOT_CAUSE_INFO;
  protected readonly unknownText = ROOT_CAUSE_UNKNOWN_TEXT;
  protected readonly ticket = REMEDIATION_TICKET;
  protected readonly copied = signal<'idle' | 'done' | 'failed'>('idle');

  protected readonly row = computed(() => this.store.rule(this.ruleId()));
  protected readonly product = computed(() => this.store.product(this.row()?.productId ?? this.productId()));
  protected readonly failure = computed(() => this.store.demo()?.failures[this.ruleId()] ?? null);
  protected readonly threshold = computed(() => this.failure()?.threshold ?? this.store.demo()?.threshold ?? null);
  protected readonly issue = computed(() => {
    const id = this.failure()?.issueId;
    return id ? this.store.issue(id) : null;
  });
  protected readonly executedAt = computed(() => {
    const at = this.failure()?.executedAt ?? this.store.demo()?.executedAt;
    return at ? formatDate(at, true) : '';
  });
  protected readonly updatedAt = computed(() => {
    const at = this.row()?.rule.definitionUpdatedAt;
    return at ? formatDate(at, true) : 'Not recorded';
  });
  protected readonly crumbs = computed<Crumb[]>(() => [
    { label: 'My Domain', link: ['/my-domain', 'home'] },
    { label: this.product()?.name ?? 'Data product', link: ['/my-domain', 'products', this.productId()] },
    { label: 'Rules', link: ['/my-domain', 'products', this.productId(), 'rules'] },
    { label: this.ruleId() },
  ]);

  protected percent(): string {
    const pct = this.row()?.failedPct;
    return pct === null || pct === undefined ? '—' : `${pct.toFixed(1)}%`;
  }

  protected async copySql(): Promise<void> {
    const sql = this.row()?.rule.sql;
    if (!sql) return;
    try {
      await navigator.clipboard.writeText(sql);
      this.copied.set('done');
    } catch {
      this.copied.set('failed');
    }
  }
}
