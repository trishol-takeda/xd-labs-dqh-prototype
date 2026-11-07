import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';
import { CheckItem } from '../../core/remediation.model';
import { compact } from '../../core/remediation.util';
import { Chip } from '../chip/chip';

/** Field-first check rows: field, requirement, "n problem" or Passing; expandable to what it checks and what a failure means. */
@Component({
  selector: 'app-check-list',
  imports: [Chip],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './check-list.html',
})
export class CheckList {
  readonly items = input.required<readonly CheckItem[]>();

  protected readonly compact = compact;
  private readonly expanded = signal<ReadonlySet<string>>(new Set());

  protected isOpen(id: string): boolean {
    return this.expanded().has(id);
  }

  protected toggle(id: string): void {
    this.expanded.update((set) => {
      const next = new Set(set);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }
}
