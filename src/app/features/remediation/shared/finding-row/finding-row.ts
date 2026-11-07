import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NEXT_LABEL } from '../../core/remediation.constants';
import { Finding } from '../../core/remediation.model';
import { badges, fieldSummary, nextDecision, segWords } from '../../core/remediation.util';
import { Chip } from '../chip/chip';

/** One finding as a row: symptom · site, the first fields, segments in words, the next decision, tier and badges. */
@Component({
  selector: 'app-finding-row',
  imports: [RouterLink, Chip],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './finding-row.html',
})
export class FindingRow {
  readonly finding = input.required<Finding>();

  protected readonly fields = computed(() => fieldSummary(this.finding()));
  protected readonly segments = computed(() => segWords(this.finding()));
  protected readonly badges = computed(() => badges(this.finding()));
  protected readonly next = computed(() => {
    const f = this.finding();
    const key = nextDecision(f);
    return key && f.visibleStatus === 'needs_you' ? NEXT_LABEL[key] : '';
  });
}
