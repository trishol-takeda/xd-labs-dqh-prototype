import { ChangeDetectionStrategy, Component, ElementRef, computed, input, output, signal, viewChild } from '@angular/core';
import { BLOCK_LABEL } from '../../core/remediation.constants';
import { Block, Finding, LeverKey, OverrideInput, SegmentKey, Vocab } from '../../core/remediation.model';
import { Modal } from '../../shared/modal/modal';

/**
 * Override one block of the proposal: scope (segments), root cause (one of the list) or action plan (levers).
 * The proposal stays on record; a reason is required.
 */
@Component({
  selector: 'app-override-dialog',
  imports: [Modal],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './override-dialog.html',
})
export class OverrideDialog {
  readonly finding = input.required<Finding>();
  readonly block = input.required<Block>();
  readonly vocab = input.required<Vocab>();
  readonly keys = input.required<readonly SegmentKey[]>();
  readonly saved = output<OverrideInput>();
  readonly closed = output<void>();

  protected readonly blockLabel = computed(() => BLOCK_LABEL[this.block()]);
  protected readonly levers = computed(() => Object.entries(this.vocab().levers).map(([key, v]) => ({ key: key as LeverKey, label: v.label })));

  protected readonly inScope = signal<readonly SegmentKey[] | null>(null);
  protected readonly cause = signal<string | null>(null);
  protected readonly chosen = signal<readonly LeverKey[] | null>(null);
  protected readonly reason = signal('');
  protected readonly missing = signal(false);
  private readonly field = viewChild.required<ElementRef<HTMLTextAreaElement>>('field');

  /** Current choices, starting from what is proposed. */
  protected readonly scopeNow = computed(() => this.inScope() ?? this.finding().proposal.scope.inScope);
  protected readonly causeNow = computed(() => this.cause() ?? this.finding().proposal.rootCause.key);
  protected readonly leversNow = computed(() => this.chosen() ?? this.finding().proposal.plan.map((a) => a.lever));

  protected toggleSegment(key: SegmentKey, on: boolean): void {
    const list = this.scopeNow();
    this.inScope.set(on ? [...list, key] : list.filter((k) => k !== key));
  }
  protected toggleLever(key: LeverKey, on: boolean): void {
    const list = this.leversNow();
    this.chosen.set(on ? [...list, key] : list.filter((k) => k !== key));
  }

  protected save(): void {
    if (!this.reason().trim()) {
      this.missing.set(true);
      this.field().nativeElement.focus();
      return;
    }
    const reason = this.reason().trim();
    switch (this.block()) {
      case 'scope':
        this.saved.emit({ reason, value: { block: 'scope', inScope: this.keys().filter((k) => this.scopeNow().includes(k)) } });
        break;
      case 'rootCause':
        this.saved.emit({ reason, value: { block: 'rootCause', key: this.causeNow() } });
        break;
      case 'plan':
        this.saved.emit({ reason, value: { block: 'plan', levers: this.levers().map((l) => l.key).filter((k) => this.leversNow().includes(k)) } });
        break;
    }
  }
}
