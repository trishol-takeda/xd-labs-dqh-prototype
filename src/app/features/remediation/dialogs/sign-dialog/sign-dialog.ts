import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { QA_ROLE } from '../../core/remediation.constants';
import { FindingAction } from '../../core/remediation.model';
import { Modal } from '../../shared/modal/modal';

/** Electronic signature on an acceptance: re-enter the password, see what the signature means, bind it to the reference. */
@Component({
  selector: 'app-sign-dialog',
  imports: [Modal],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sign-dialog.html',
})
export class SignDialog {
  readonly who = input.required<string>();
  readonly action = input.required<FindingAction>();
  readonly signed = output<void>();
  readonly closed = output<void>();

  protected readonly password = signal('');
  protected readonly missing = signal(false);
  protected readonly meaning = computed(() => (this.who() === QA_ROLE ? 'approved' : 'risk accepted'));
  protected readonly stamp = new Date().toLocaleString('en-GB');

  protected sign(): void {
    if (!this.password()) {
      this.missing.set(true);
      return;
    }
    this.signed.emit();
  }
}
