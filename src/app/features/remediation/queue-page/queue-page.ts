import { StatePanel } from '../../../ui/state-panel/state-panel';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RemediationStore } from '../core/remediation-store.service';
import { ROLE_QUEUE_LABEL, ROLE_QUEUE_SUBTITLE } from '../core/remediation.constants';
import { Cause } from '../core/remediation.model';
import { CauseRow } from '../shared/cause-row/cause-row';
import { Crumbs } from '../shared/crumbs/crumbs';

interface QueueGroup {
  name: string;
  causes: Cause[];
}

/** Screen 5: the current role's queue. Trustee and Rules team group by product, the fixer by fixer role. */
@Component({
  selector: 'app-queue-page',
  imports: [StatePanel, CauseRow, Crumbs],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './queue-page.html',
})
export class QueuePage {
  protected readonly store = inject(RemediationStore);

  protected readonly title = computed(() => ROLE_QUEUE_LABEL[this.store.role()]);
  protected readonly subtitle = computed(() => ROLE_QUEUE_SUBTITLE[this.store.role()]);
  protected readonly crumbs = computed(() => [{ label: this.title() }]);

  protected readonly groups = computed<QueueGroup[]>(() => {
    const byFixer = this.store.role() === 'fixer';
    const groups = new Map<string, Cause[]>();
    for (const c of this.store.queue()) {
      const name = byFixer ? c.fixerRole : (c.products[0] ?? '');
      groups.set(name, [...(groups.get(name) ?? []), c]);
    }
    return [...groups].map(([name, causes]) => ({ name, causes }));
  });
}
