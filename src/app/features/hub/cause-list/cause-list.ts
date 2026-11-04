import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { BANDS, BAND_MEANING, BAND_TONE, STATE_INFO, STATE_ORDER } from '../../../core/constants/remediation.constants';
import { Band, CauseState, CauseView } from '../../../core/models/remediation.model';
import { compact } from '../../../core/util/format';
import { Badge } from '../../../ui/badge/badge';
import { Icon } from '../../../ui/icon/icon';

/** Zone 2: the product's causes grouped by state, most critical first, then by how many records fail. */
@Component({
  selector: 'app-cause-list',
  imports: [Badge, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './cause-list.html',
  styleUrl: './cause-list.css',
})
export class CauseList {
  readonly causes = input.required<CauseView[]>();
  readonly selectedId = input.required<string>();
  readonly select = output<string>();

  protected readonly bands = BANDS;
  protected readonly bandTone = BAND_TONE;
  protected readonly bandMeaning = BAND_MEANING;
  protected readonly stateInfo = STATE_INFO;
  protected readonly compact = compact;
  protected readonly bandFilter = signal<ReadonlySet<Band>>(new Set());

  protected readonly groups = computed(() => {
    const filter = this.bandFilter();
    const visible = this.causes().filter((c) => !filter.size || filter.has(c.band));
    return STATE_ORDER.map((state: CauseState) => ({ state, causes: visible.filter((c) => c.state === state) }));
  });
  protected readonly shown = computed(() => this.groups().reduce((sum, g) => sum + g.causes.length, 0));

  protected toggleBand(band: Band): void {
    const next = new Set(this.bandFilter());
    if (!next.delete(band)) next.add(band);
    this.bandFilter.set(next);
  }
}
