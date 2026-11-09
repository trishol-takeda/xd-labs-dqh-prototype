import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Finding, SegmentKey } from '../../core/remediation.model';
import { full, inScopeKeys } from '../../core/remediation.util';

/** The four population segments of a finding, marked in scope or parked by the scope in force (proposed, then confirmed). */
@Component({
  selector: 'app-segment-tiles',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './segment-tiles.html',
})
export class SegmentTiles {
  readonly finding = input.required<Finding>();
  readonly keys = input.required<readonly SegmentKey[]>();
  protected readonly full = full;

  protected readonly tiles = computed(() => {
    const f = this.finding();
    const inScope = inScopeKeys(f);
    return this.keys().map((key) => {
      const mark = inScope.includes(key) ? 'in' : 'parked';
      return { key, mark, value: f.segments[key], label: f.segments.labels[key], classes: `rh-seg ${key === 'newSinceDetection' ? 'rh-new ' : ''}${mark}` };
    });
  });
}
