import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { ACTION_COPY } from '../../../core/constants/remediation.constants';
import { CauseView } from '../../../core/models/remediation.model';
import { RemediationStore } from '../../../core/state/remediation-store.service';
import { formatDate } from '../../../core/util/format';
import { Icon } from '../../../ui/icon/icon';

type ActionKey = keyof typeof ACTION_COPY;

/** Confirm, then the three trustee actions. There is deliberately no way to mark a cause as fixed. */
@Component({
  selector: 'app-cause-actions',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './cause-actions.html',
  styleUrl: './cause-actions.css',
})
export class CauseActions {
  readonly cause = input.required<CauseView>();

  private readonly store = inject(RemediationStore);
  protected readonly copy = ACTION_COPY;
  protected readonly keys = Object.keys(ACTION_COPY) as ActionKey[];
  protected readonly formatDate = formatDate;
  protected readonly active = signal<ActionKey | null>(null);
  protected readonly text = signal('');

  protected readonly lastRequest = computed(() => this.cause().audit.find((a) => a.kind === 'sent'));

  protected open(key: ActionKey): void {
    this.active.set(this.active() === key ? null : key);
    this.text.set('');
  }

  protected confirm(): void {
    this.store.confirm(this.cause().id);
  }

  protected submit(): void {
    const key = this.active();
    if (!key) return;
    const id = this.cause().id;
    const run = {
      send: () => this.store.sendForCorrection(id, this.text()),
      challenge: () => this.store.challengeRule(id, this.text()),
      accept: () => this.store.acceptRemaining(id, this.text()),
    };
    if (run[key]().ok) this.open(key);
  }
}
