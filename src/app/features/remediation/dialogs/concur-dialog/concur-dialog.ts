import { ChangeDetectionStrategy, Component, ElementRef, input, output, signal, viewChild } from '@angular/core';
import { ConcurInput, Finding } from '../../core/remediation.model';
import { Modal } from '../../shared/modal/modal';

/** Quality concurrence with the confirmed scope and plan; the deviation reference is required when the proposal says so. */
@Component({
  selector: 'app-concur-dialog',
  imports: [Modal],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './concur-dialog.html',
})
export class ConcurDialog {
  readonly finding = input.required<Finding>();
  readonly saved = output<ConcurInput>();
  readonly closed = output<void>();

  protected readonly deviation = signal('');
  protected readonly note = signal('');
  protected readonly missing = signal(false);
  private readonly field = viewChild<ElementRef<HTMLInputElement>>('field');

  protected save(): void {
    const needed = this.finding().proposal.qa.requiresDeviation;
    if (needed && !this.deviation().trim()) {
      this.missing.set(true);
      this.field()?.nativeElement.focus();
      return;
    }
    this.saved.emit({ deviationRef: needed ? this.deviation().trim() : null, note: this.note().trim() });
  }
}
