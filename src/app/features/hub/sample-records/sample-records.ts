import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { SAMPLE_SIZE } from '../../../core/constants/remediation.constants';
import { CauseView } from '../../../core/models/remediation.model';
import { RemediationStore } from '../../../core/state/remediation-store.service';
import { full } from '../../../core/util/format';
import { Icon } from '../../../ui/icon/icon';

/** Evidence, not the work surface: a sample of 10, the full set on demand, keyed by what the source system calls the record. */
@Component({
  selector: 'app-sample-records',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sample-records.html',
})
export class SampleRecords {
  readonly cause = input.required<CauseView>();

  private readonly store = inject(RemediationStore);
  protected readonly full = full;
  protected readonly sampleSize = SAMPLE_SIZE;
  protected readonly showAll = signal(false);

  protected readonly records = computed(() => this.store.records(this.cause()));
  protected readonly visible = computed(() => (this.showAll() ? this.records() : this.records().slice(0, SAMPLE_SIZE)));
}
