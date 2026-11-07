import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { JourneyStep } from '../../core/remediation.model';

/** Detected → Scope → Impact → Root cause → Actions → Verifying → Closed, with "You are here" on the current step. */
@Component({
  selector: 'app-journey-strip',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './journey-strip.html',
})
export class JourneyStrip {
  readonly steps = input.required<readonly JourneyStep[]>();
}
