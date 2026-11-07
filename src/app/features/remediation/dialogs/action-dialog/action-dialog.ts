import { ChangeDetectionStrategy, Component, computed, input, linkedSignal, output, signal } from '@angular/core';
import { DEFAULT_REVIEW_BY } from '../../core/remediation.constants';
import { ActionInput, Finding, LeverKey, Registry, SegmentKey, Vocab } from '../../core/remediation.model';
import { channelFor } from '../../core/remediation.util';
import { Modal } from '../../shared/modal/modal';

/** Decision 4: one action. Lever, owner and channel come from the routing table; the trustee adds reference, date, coverage and controls. */
@Component({
  selector: 'app-action-dialog',
  imports: [Modal],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './action-dialog.html',
})
export class ActionDialog {
  readonly finding = input.required<Finding>();
  readonly keys = input.required<readonly SegmentKey[]>();
  readonly vocab = input.required<Vocab>();
  readonly registry = input.required<Registry>();
  readonly saved = output<ActionInput>();
  readonly closed = output<void>();

  protected readonly lever = signal<LeverKey>('stop_bleed');
  protected readonly levers = computed(() => Object.entries(this.vocab().levers).map(([key, v]) => ({ key: key as LeverKey, ...v })));
  protected readonly route = computed(() => {
    const f = this.finding();
    const r = channelFor(this.registry(), f.sourceSystem, this.lever(), f.site);
    return { owner: r.owner, channel: r.channel + (r.notify ? ` · notified via ${r.notify}` : '') };
  });
  /** Acceptance covers the historical records; every other lever covers the rest. Switching lever resets the coverage. */
  protected readonly covers = linkedSignal<readonly SegmentKey[]>(() => this.keys().filter((k) => (this.lever() === 'accept' ? k === 'historical' : k !== 'historical')));
  protected readonly reference = signal('');
  protected readonly effective = signal('');
  protected readonly interim = signal('');
  protected readonly reviewBy = signal(DEFAULT_REVIEW_BY);
  protected readonly approvers = computed(() => (this.finding().tier === 'critical' ? 'Data trustee, Quality approver' : 'Data trustee'));

  protected toggle(key: SegmentKey, on: boolean): void {
    this.covers.update((list) => (on ? [...list, key] : list.filter((k) => k !== key)));
  }

  protected save(): void {
    const lever = this.lever();
    this.saved.emit({
      lever,
      reference: this.reference().trim() || null,
      effectiveDate: this.effective() || null,
      covers: this.keys().filter((k) => this.covers().includes(k)),
      interimControl: lever === 'stop_bleed' ? this.interim().trim() || null : null,
      reviewBy: lever === 'accept' ? this.reviewBy() : null,
    });
  }
}
