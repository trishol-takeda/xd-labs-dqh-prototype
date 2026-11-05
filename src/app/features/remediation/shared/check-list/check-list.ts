import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CheckItem } from '../../core/remediation.model';
import { compact } from '../../core/remediation.util';
import { Spark } from '../spark/spark';

/** Checks as expandable rows: field, what it checks, what a failure means, trend, and (on the table screen) the cause it belongs to. */
@Component({
  selector: 'app-check-list',
  imports: [RouterLink, Spark],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './check-list.html',
})
export class CheckList {
  readonly items = input.required<readonly CheckItem[]>();
  /** Word after the failing count: "failing" on the table screen, "records" on the cause screen. */
  readonly unit = input<'failing' | 'records'>('records');

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
