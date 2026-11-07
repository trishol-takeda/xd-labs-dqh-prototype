import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { Finding } from '../../core/remediation.model';
import { plural } from '../../core/remediation.util';
import { Modal } from '../../shared/modal/modal';

/** Rules team: publish a changed check. Counts start again from the next check; earlier checks keep their version. */
@Component({
  selector: 'app-rule-change-dialog',
  imports: [Modal],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './rule-change-dialog.html',
})
export class RuleChangeDialog {
  readonly finding = input.required<Finding>();
  readonly published = output<string>();
  readonly closed = output<void>();

  protected readonly what = signal('');
  protected readonly missing = signal(false);
  protected readonly version = computed(() => (this.finding().history.at(-1)?.ruleVersion ?? 1) + 1);
  protected readonly checks = computed(() => `check${plural(this.finding().fields.length, '', 's')}`);

  protected publish(): void {
    if (!this.what().trim()) {
      this.missing.set(true);
      return;
    }
    this.published.emit(this.what().trim());
  }
}
