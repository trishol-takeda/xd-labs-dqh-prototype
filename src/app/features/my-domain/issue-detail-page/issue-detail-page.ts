import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { formatDate } from '../../../core/util/format';
import { Badge } from '../../../ui/badge/badge';
import { Breadcrumbs } from '../../../ui/breadcrumbs/breadcrumbs';
import { Crumb } from '../../../ui/breadcrumbs/breadcrumbs.model';
import { Icon } from '../../../ui/icon/icon';
import { OriginTag } from '../../../ui/origin-tag/origin-tag';
import { StatePanel } from '../../../ui/state-panel/state-panel';
import { REMEDIATION_TICKET } from '../core/my-domain.constants';
import { MyDomainStore } from '../core/my-domain-store.service';

/** A mock issue raised from a failed rule. The end of the My Domain journey; remediation itself is a future capability. */
@Component({
  selector: 'app-issue-detail-page',
  imports: [RouterLink, Badge, Breadcrumbs, Icon, OriginTag, StatePanel],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './issue-detail-page.html',
  styleUrl: './issue-detail-page.css',
})
export class IssueDetailPage {
  private readonly store = inject(MyDomainStore);
  readonly issueId = input.required<string>();

  protected readonly ticket = REMEDIATION_TICKET;
  protected readonly issue = computed(() => this.store.issue(this.issueId()));
  protected readonly rule = computed(() => this.store.rule(this.issue()?.ruleId ?? ''));
  protected readonly created = computed(() => (this.issue() ? formatDate(this.issue()!.createdAt) : ''));
  protected readonly crumbs = computed<Crumb[]>(() => {
    const r = this.rule();
    return [
      { label: 'My Domain', link: ['/my-domain', 'home'] },
      ...(r ? [{ label: r.productName, link: ['/my-domain', 'products', r.productId] }, { label: r.rule.id, link: ['/my-domain', 'products', r.productId, 'rules', r.rule.id] }] : []),
      { label: this.issueId() },
    ];
  });
}
