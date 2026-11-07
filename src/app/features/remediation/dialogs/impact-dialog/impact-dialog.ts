import { ChangeDetectionStrategy, Component, computed, input, linkedSignal, output, signal } from '@angular/core';
import { IMPACT_DEFAULT_POSSIBLE_SYMPTOMS, IMPACT_OPTIONS } from '../../core/remediation.constants';
import { Assessment, Finding, ImpactInput } from '../../core/remediation.model';
import { Modal } from '../../shared/modal/modal';

/** Decision 2: could the parked records matter? On GxP critical data a possible or confirmed impact needs a deviation reference. */
@Component({
  selector: 'app-impact-dialog',
  imports: [Modal],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './impact-dialog.html',
})
export class ImpactDialog {
  readonly finding = input.required<Finding>();
  readonly saved = output<ImpactInput>();
  readonly closed = output<void>();

  protected readonly options = IMPACT_OPTIONS;
  protected readonly critical = computed(() => this.finding().tier === 'critical');
  /** On GxP critical data with a missing or orphaned symptom, impact is assumed possible until assessed. */
  protected readonly assessment = linkedSignal<Assessment>(() => (this.critical() && IMPACT_DEFAULT_POSSIBLE_SYMPTOMS.includes(this.finding().symptom) ? 'possible' : 'none'));
  protected readonly note = signal('');
  protected readonly deviation = signal('');
  protected readonly needsDeviation = computed(() => this.critical() && this.assessment() !== 'none');
  protected readonly noteMissing = signal(false);
  protected readonly deviationMissing = signal(false);

  protected save(): void {
    const noteOk = !!this.note().trim();
    const devOk = !this.needsDeviation() || !!this.deviation().trim();
    this.noteMissing.set(!noteOk);
    this.deviationMissing.set(!devOk);
    if (!noteOk || !devOk) return;
    this.saved.emit({ assessment: this.assessment(), note: this.note().trim(), deviationRef: this.needsDeviation() ? this.deviation().trim() : null });
  }
}
