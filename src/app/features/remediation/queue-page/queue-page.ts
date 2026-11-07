import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { StatePanel } from '../../../ui/state-panel/state-panel';
import { RemediationStore } from '../core/remediation-store.service';
import { QUEUE_LABEL, QUEUE_SUBTITLE } from '../core/remediation.constants';
import { Finding } from '../core/remediation.model';
import { FindingRow } from '../shared/finding-row/finding-row';

interface QueueGroup {
  name: string;
  findings: Finding[];
}

/** The role's queue by impact score, grouped by product, with a free-text filter on product, table, site or field. */
@Component({
  selector: 'app-queue-page',
  imports: [StatePanel, FindingRow],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './queue-page.html',
})
export class QueuePage {
  protected readonly store = inject(RemediationStore);

  protected readonly filter = signal('');
  protected readonly title = computed(() => QUEUE_LABEL[this.store.role()]);
  protected readonly subtitle = computed(() => QUEUE_SUBTITLE[this.store.role()]);

  protected readonly groups = computed<QueueGroup[]>(() => {
    const term = this.filter().trim().toLowerCase();
    const groups = new Map<string, Finding[]>();
    for (const f of this.store.queue()) {
      const haystack = [f.products[0], f.tablePlainName, f.site, f.symptomLabel, ...f.fieldNames].join(' ').toLowerCase();
      if (term && !haystack.includes(term)) continue;
      groups.set(f.products[0], [...(groups.get(f.products[0]) ?? []), f]);
    }
    return [...groups].map(([name, findings]) => ({ name, findings }));
  });
}
