import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { InvestigationInput } from '../../core/remediation.model';
import { Modal } from '../../shared/modal/modal';

/** Decision 3: the root causes actually found, chosen from the controlled list, with a note. */
@Component({
  selector: 'app-investigate-dialog',
  imports: [Modal],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './investigate-dialog.html',
})
export class InvestigateDialog {
  readonly rootCauses = input.required<readonly { key: string; label: string }[]>();
  readonly saved = output<InvestigationInput>();
  readonly closed = output<void>();

  protected readonly selected = signal<readonly string[]>([]);
  protected readonly note = signal('');
  protected readonly otherSites = signal(false);
  protected readonly causeMissing = signal(false);
  protected readonly noteMissing = signal(false);

  protected toggle(key: string, on: boolean): void {
    this.selected.update((list) => (on ? [...list, key] : list.filter((k) => k !== key)));
    this.causeMissing.set(false);
  }

  protected save(): void {
    const causeOk = this.selected().length > 0;
    const noteOk = !!this.note().trim();
    this.causeMissing.set(!causeOk);
    this.noteMissing.set(!noteOk);
    if (!causeOk || !noteOk) return;
    this.saved.emit({ rootCauses: [...this.selected()], note: this.note().trim(), otherSitesChecked: this.otherSites() });
  }
}
