import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Summary } from '../../core/remediation.model';
import { plural } from '../../core/remediation.util';

/** "11 checks · 6 passing · 5 failing · grouped into 2 open findings", with room for a trailing control. */
@Component({
  selector: 'app-summary-line',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './summary-line.html',
})
export class SummaryLine {
  readonly summary = input.required<Summary>();
  protected readonly plural = plural;
}
