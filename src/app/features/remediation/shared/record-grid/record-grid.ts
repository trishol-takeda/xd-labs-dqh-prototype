import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { FindingField, RecordRow, Segments } from '../../core/remediation.model';

/** Record × field grid: the key in the source system, the segment of each record, and ✕ where a field fails. */
@Component({
  selector: 'app-record-grid',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './record-grid.html',
})
export class RecordGrid {
  readonly rows = input.required<readonly RecordRow[]>();
  readonly fields = input.required<readonly FindingField[]>();
  readonly labels = input.required<Segments['labels']>();
  readonly sourceSystem = input.required<string>();
}
