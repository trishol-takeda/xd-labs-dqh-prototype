import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { plural } from '../../core/remediation.util';

/** "3 open causes" in red, or "No open causes" in grey. */
@Component({
  selector: 'app-open-count',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './open-count.html',
})
export class OpenCount {
  readonly count = input.required<number>();
  protected readonly plural = plural;
}
