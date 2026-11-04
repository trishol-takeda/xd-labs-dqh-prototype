import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { ENGINE_OUTCOMES } from '../../../core/constants/remediation.constants';
import { CauseView, EngineOutcome } from '../../../core/models/remediation.model';
import { RemediationStore } from '../../../core/state/remediation-store.service';
import { Icon } from '../../../ui/icon/icon';

/** Preview mode only: stands in for the next rule run. In the real product there is nothing here, and no one can mark a fix. */
@Component({
  selector: 'app-engine-preview',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './engine-preview.html',
  styleUrl: './engine-preview.css',
})
export class EnginePreview {
  readonly cause = input.required<CauseView>();

  private readonly store = inject(RemediationStore);
  protected readonly outcomes = computed(() =>
    (Object.keys(ENGINE_OUTCOMES) as EngineOutcome[])
      .filter((key) => (this.cause().state === 'Closed' ? key === 'again' : key !== 'again'))
      .map((key) => ({ key, ...ENGINE_OUTCOMES[key] })),
  );

  protected run(outcome: EngineOutcome): void {
    this.store.simulateRun(this.cause().id, outcome);
  }
}
