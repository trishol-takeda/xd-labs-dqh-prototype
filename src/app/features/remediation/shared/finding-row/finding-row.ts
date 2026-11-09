import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PROPOSAL_READY } from '../../core/remediation.constants';
import { Finding } from '../../core/remediation.model';
import { badges, fieldSummary, segWords } from '../../core/remediation.util';
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
  /** What is next for the finding: the proposal waits for the trustee; later stages are named by their stage. */
  protected readonly next = computed(() => {
    const f = this.finding();
    return f.stage === 'proposed' ? PROPOSAL_READY : '';
  });
}
