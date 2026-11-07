import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** One of the trustee's four decisions: done (summary), next (with its button) or later (greyed). */
@Component({
  selector: 'app-decision-row',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class]': 'classes()' },
  templateUrl: './decision-row.html',
})
export class DecisionRow {
  readonly number = input.required<number>();
  readonly label = input.required<string>();
  readonly state = input.required<'done' | 'next' | 'later'>();

  protected readonly classes = computed(() => `rh-dec ${this.state()}`);
}
