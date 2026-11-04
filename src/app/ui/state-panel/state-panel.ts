import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Icon } from '../icon/icon';
import { Skeleton } from '../skeleton/skeleton';

export type PanelKind = 'loading' | 'empty' | 'no-results' | 'error' | 'no-access' | 'not-found' | 'partial';

const ICONS: Record<Exclude<PanelKind, 'loading'>, string> = {
  empty: 'database',
  'no-results': 'search',
  error: 'alert',
  'no-access': 'lock',
  'not-found': 'info',
  partial: 'info',
};

/** One panel for every non-happy state. Actions go in as projected content. */
@Component({
  selector: 'app-state-panel',
  imports: [Icon, Skeleton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './state-panel.html',
  styleUrl: './state-panel.css',
})
export class StatePanel {
  readonly kind = input.required<PanelKind>();
  readonly title = input('');
  readonly message = input('');
  /** Compact variant for use inside cards and tables. */
  readonly compact = input(false);
  protected readonly icon = computed(() => {
    const kind = this.kind();
    return kind === 'loading' ? '' : ICONS[kind];
  });
  protected readonly live = computed(() => (this.kind() === 'error' ? 'alert' : 'status'));
}
