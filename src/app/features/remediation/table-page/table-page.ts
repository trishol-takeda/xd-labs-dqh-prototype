import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { StatePanel } from '../../../ui/state-panel/state-panel';
import { RemediationStore } from '../core/remediation-store.service';
import { STATUS_LABEL, STATUS_MEANING, STATUS_ORDER } from '../core/remediation.constants';
import { Crumb, VisibleStatus } from '../core/remediation.model';
import { byImpact, checkItems, ofTable, openOf, plural, rulesOfTable, summarise } from '../core/remediation.util';
import { CheckList } from '../shared/check-list/check-list';
import { Chip } from '../shared/chip/chip';
import { Crumbs } from '../shared/crumbs/crumbs';
import { FindingRow } from '../shared/finding-row/finding-row';
import { SummaryLine } from '../shared/summary-line/summary-line';

/** One table: every check on it, and its findings in three sections (Needs you, In progress, Fixed), highest impact first. */
@Component({
  selector: 'app-table-page',
  imports: [StatePanel, CheckList, Chip, Crumbs, FindingRow, SummaryLine],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './table-page.html',
})
export class TablePage {
  protected readonly store = inject(RemediationStore);
  private readonly router = inject(Router);

  readonly tableId = input.required<string>();
  /** Set when a single-table product skips its own screen: the page then carries the product's name and crumb. */
  readonly fromProductId = input<string | undefined>(undefined);

  protected readonly plural = plural;
  protected readonly statusLabel = STATUS_LABEL;
  protected readonly statusMeaning = STATUS_MEANING;
  protected readonly showAllChecks = signal(false);
  /** Sections the user flipped; an empty section starts collapsed, a full one expanded. */
  private readonly flipped = signal<ReadonlySet<VisibleStatus>>(new Set());

  protected readonly table = computed(() => this.store.table(this.tableId()));
  protected readonly fromProduct = computed(() => this.store.product(this.fromProductId() ?? ''));
  protected readonly ownerProduct = computed(() => this.store.productByName(this.table()?.products[0]));
  protected readonly title = computed(() => this.fromProduct()?.name ?? this.table()?.plainName ?? '');
  protected readonly alsoUsedBy = computed(() => this.table()?.products.slice(1).join(', ') ?? '');

  protected readonly crumbs = computed<readonly Crumb[]>(() => {
    const from = this.fromProduct();
    if (from) return [{ label: 'Data products', link: ['/remediation'] }, { label: from.name }];
    const p = this.ownerProduct();
    return [
      { label: 'Data products', link: ['/remediation'] },
      { label: p?.name ?? '', link: p ? ['/remediation', 'p', p.id] : undefined },
      { label: this.table()?.plainName ?? '' },
    ];
  });

  private readonly findings = computed(() => {
    const d = this.store.data();
    return d ? ofTable(d, this.tableId()).sort(byImpact) : [];
  });
  protected readonly open = computed(() => openOf(this.findings()).length);
  protected readonly isEmpty = computed(() => this.store.screenState() === 'empty' || this.findings().length === 0);

  private readonly rules = computed(() => {
    const d = this.store.data();
    return d ? rulesOfTable(d, this.tableId()) : [];
  });
  protected readonly summary = computed(() => summarise(this.rules(), this.open()));
  protected readonly checks = computed(() => checkItems(this.rules()));

  protected readonly sections = computed(() =>
    STATUS_ORDER.map((status) => {
      const list = this.findings().filter((f) => f.visibleStatus === status);
      return { status, list, collapsed: (list.length === 0) !== this.flipped().has(status) };
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
