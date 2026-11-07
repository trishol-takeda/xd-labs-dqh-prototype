import { ChangeDetectionStrategy, Component, ElementRef, input, linkedSignal, output, signal, viewChild } from '@angular/core';
import { Finding, ScopeInput, SegmentKey } from '../../core/remediation.model';
import { full } from '../../core/remediation.util';
import { Modal } from '../../shared/modal/modal';

/** Decision 1: which segments are in scope (can be corrected) and which are parked. A reason is required. */
@Component({
  selector: 'app-scope-dialog',
  imports: [Modal],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './scope-dialog.html',
})
export class ScopeDialog {
  readonly finding = input.required<Finding>();
  readonly keys = input.required<readonly SegmentKey[]>();
  readonly saved = output<ScopeInput>();
  readonly closed = output<void>();

  protected readonly full = full;
  /** Everything but the historical records starts in scope. */
  protected readonly inScope = linkedSignal<readonly SegmentKey[]>(() => this.keys().filter((k) => k !== 'historical'));
  protected readonly reason = signal('');
  protected readonly missing = signal(false);
  private readonly field = viewChild.required<ElementRef<HTMLTextAreaElement>>('field');

  protected toggle(key: SegmentKey, on: boolean): void {
    this.inScope.update((list) => (on ? [...list, key] : list.filter((k) => k !== key)));
  }

  protected save(): void {
    if (!this.reason().trim()) {
      this.missing.set(true);
      this.field().nativeElement.focus();
      return;
    }
    this.saved.emit({ inScope: this.keys().filter((k) => this.inScope().includes(k)), reason: this.reason().trim() });
  }
}
