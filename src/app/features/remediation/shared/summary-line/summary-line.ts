import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TableSummary } from '../../core/remediation.model';
import { plural } from '../../core/remediation.util';

/** "11 checks · 6 passing · 5 failing · grouped into 2 open causes", with room for a trailing control. */
@Component({
  selector: 'app-summary-line',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './summary-line.html',
})
export class SummaryLine {
  readonly summary = input.required<TableSummary>();
  protected readonly plural = plural;
}
