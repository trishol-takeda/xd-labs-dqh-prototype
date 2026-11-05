import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Cause } from '../../core/remediation.model';
import { STATUS_LABEL } from '../../core/remediation.constants';
import { causeBadge, compact, plural } from '../../core/remediation.util';
import { Chip } from '../chip/chip';

/** One cause as a row. On a table screen it shows the fixer; in a queue it shows the product and table and the status. */
@Component({
  selector: 'app-cause-row',
  imports: [RouterLink, Chip],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './cause-row.html',
})
export class CauseRow {
  readonly cause = input.required<Cause>();
  readonly variant = input<'table' | 'queue'>('table');
  /** Product name shown in the queue variant. */
  readonly productName = input('');

  protected readonly statusLabel = computed(() => STATUS_LABEL[this.cause().visibleStatus]);
  protected readonly badge = computed(() => causeBadge(this.cause()));
  protected readonly checks = computed(() => {
    const n = this.cause().rules.length;
    return `${n} ${plural(n, 'check')}`;
  });
  protected readonly records = computed(() => compact(this.cause().failingNow));
}
