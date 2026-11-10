import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { Modal } from '../../shared/modal/modal';

/** GxP critical data: confirming the proposal is a signed decision, so the trustee re-enters the password. */
@Component({
  selector: 'app-confirm-sign-dialog',
  imports: [Modal],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './confirm-sign-dialog.html',
})
export class ConfirmSignDialog {
  readonly who = input.required<string>();
  readonly signed = output<void>();
  readonly closed = output<void>();

  protected readonly password = signal('');
  protected readonly missing = signal(false);
  protected readonly stamp = new Date().toLocaleString('en-GB');

  protected sign(): void {
    if (!this.password()) {
      this.missing.set(true);
      return;
    }
    this.signed.emit();
  }
}
