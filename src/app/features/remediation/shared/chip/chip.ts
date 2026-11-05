import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type ChipKind = 'status' | 'tier' | 'badge';

/** Small label: a visible status (Needs you / Waiting on fixer / Fixed), a GxP tier, or a badge such as "Came back". */
@Component({
  selector: 'app-chip',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class]': 'classes()' },
  templateUrl: './chip.html',
})
export class Chip {
  readonly kind = input.required<ChipKind>();
  /** Status key (needs_you, waiting, fixed) or tier key (critical, relevant, business). */
  readonly value = input('');

  protected readonly classes = computed(() => {
    const kind = this.kind();
    if (kind === 'badge') return 'rh-chip rh-badge';
    return `rh-chip ${kind === 'status' ? 'rh-st' : 'rh-tier'} ${this.value()}`;
  });
}
