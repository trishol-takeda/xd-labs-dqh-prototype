import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type ChipKind = 'status' | 'tier' | 'badge' | 'over';

/** Small label: a visible status, a GxP tier, a badge such as "Came back", or the red "Past target" badge. */
@Component({
  selector: 'app-chip',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class]': 'classes()' },
  templateUrl: './chip.html',
})
export class Chip {
  readonly kind = input.required<ChipKind>();
  /** Status key (needs_you, in_progress, fixed) or tier key (critical, relevant, business). */
  readonly value = input('');

  protected readonly classes = computed(() => {
    const kind = this.kind();
    if (kind === 'badge') return 'rh-chip rh-badge';
    if (kind === 'over') return 'rh-chip over';
    return `rh-chip ${kind === 'status' ? 'rh-st' : 'rh-tier'} ${this.value()}`;
  });
}
