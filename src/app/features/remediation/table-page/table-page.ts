import { StatePanel } from '../../../ui/state-panel/state-panel';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { RemediationStore } from '../core/remediation-store.service';
import { STATUS_LABEL, STATUS_MEANING, STATUS_ORDER } from '../core/remediation.constants';
import { CheckItem, Crumb, VisibleStatus } from '../core/remediation.model';
import { causesOfTable, compareCauses, humanCol, openCount, plural, rulesOfTable, summarise } from '../core/remediation.util';
import { CauseRow } from '../shared/cause-row/cause-row';
import { CheckList } from '../shared/check-list/check-list';
import { Chip } from '../shared/chip/chip';
import { Crumbs } from '../shared/crumbs/crumbs';
import { SummaryLine } from '../shared/summary-line/summary-line';

/** Screen 3: one table, every check on it, and its causes in three sections: Needs you, Waiting on fixer, Fixed. */
@Component({
  selector: 'app-table-page',
  imports: [StatePanel, CauseRow, CheckList, Chip, Crumbs, SummaryLine],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './table-page.html',
})
export class TablePage {
  protected readonly store = inject(RemediationStore);
  private readonly router = inject(Router);

  readonly tableId = input.required<string>();
  protected readonly plural = plural;
  protected readonly statusLabel = STATUS_LABEL;
  protected readonly statusMeaning = STATUS_MEANING;

  protected readonly showAllChecks = signal(false);
  /** Sections the user flipped; an empty section starts collapsed, a full one expanded. */
  private readonly flipped = signal<ReadonlySet<VisibleStatus>>(new Set());

  protected readonly table = computed(() => this.store.table(this.tableId()));
  protected readonly product = computed(() => this.store.productByName(this.table()?.products[0]));
  protected readonly alsoUsedBy = computed(() => this.table()?.products.slice(1).join(', ') ?? '');

  protected readonly crumbs = computed<readonly Crumb[]>(() => {
    const p = this.product();
    return [
      { label: 'Data products', link: ['/remediation'] },
      { label: p?.name ?? '', link: p ? ['/remediation', 'p', p.id] : undefined },
      { label: this.table()?.plainName ?? '' },
    ];
  });

  private readonly causes = computed(() => {
    const d = this.store.data();
    return d ? causesOfTable(d, this.tableId()).sort(compareCauses) : [];
  });
  protected readonly open = computed(() => openCount(this.causes()));
  protected readonly isEmpty = computed(() => this.store.screenState() === 'empty' || this.causes().length === 0);

  protected readonly summary = computed(() => {
    const d = this.store.data();
    return summarise(d ? rulesOfTable(d, this.tableId()) : [], this.open());
  });

  protected readonly checks = computed<CheckItem[]>(() => {
    const d = this.store.data();
    if (!d) return [];
    return rulesOfTable(d, this.tableId())
      .sort((a, b) => b.failingNow - a.failingNow || a.plainName.localeCompare(b.plainName))
      .map((r) => {
        const cause = d.causes.find((k) => k.table === r.table && k.rootCause === r.rootCause && k.rules.some((x) => x.id === r.id));
        return {
          id: r.id,
          plainName: r.plainName,
          field: humanCol(r.column),
          failingNow: r.failingNow,
          whatItChecks: r.whatItChecks,
          whatFailureMeans: r.whatFailureMeans,
          history: r.history,
          cause: cause ? { id: cause.id, label: cause.rootCauseLabel } : undefined,
        };
      });
  });

  protected readonly sections = computed(() =>
    STATUS_ORDER.map((status) => {
      const list = this.causes().filter((c) => c.visibleStatus === status);
      const collapsed = (list.length === 0) !== this.flipped().has(status);
      return { status, list, collapsed };
    }),
  );

  constructor() {
    effect(() => {
      if (this.store.data() && !this.table()) void this.router.navigateByUrl('/remediation');
    });
  }

  protected toggleSection(status: VisibleStatus): void {
    this.flipped.update((set) => {
      const next = new Set(set);
      if (!next.delete(status)) next.add(status);
      return next;
    });
  }
}
