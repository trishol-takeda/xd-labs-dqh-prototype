import { ChangeDetectionStrategy, Component, computed, effect, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { RemediationStore } from '../core/remediation-store.service';
import { RECORDS_PAGE_SIZE } from '../core/remediation.constants';
import { Crumb } from '../core/remediation.model';
import { full, recordRows } from '../core/remediation.util';
import { Crumbs } from '../shared/crumbs/crumbs';
import { RecordGrid } from '../shared/record-grid/record-grid';

/** Records screen: the first 50 failing records of a finding, each with its segment and the fields that fail. */
@Component({
  selector: 'app-records-page',
  imports: [Crumbs, RecordGrid],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './records-page.html',
})
export class RecordsPage {
  private readonly store = inject(RemediationStore);
  private readonly router = inject(Router);

  readonly findingId = input.required<string>();
  protected readonly full = full;
  protected readonly pageSize = RECORDS_PAGE_SIZE;

  protected readonly finding = computed(() => this.store.finding(this.findingId()));
  protected readonly table = computed(() => this.store.table(this.finding()?.table ?? ''));
  private readonly product = computed(() => this.store.productByName(this.finding()?.products[0]));

  protected readonly crumbs = computed<readonly Crumb[]>(() => {
    const f = this.finding();
    const p = this.product();
    const t = this.table();
    return [
      { label: 'Data products', link: ['/remediation'] },
      { label: p?.name ?? '', link: p ? ['/remediation', 'p', p.id] : undefined },
      { label: t?.plainName ?? '', link: t ? ['/remediation', 't', t.id] : undefined },
      { label: f ? `${f.symptomLabel} · ${f.site}` : '', link: f ? ['/remediation', 'f', f.id] : undefined },
      { label: 'Records' },
    ];
  });

  protected readonly rows = computed(() => {
    const f = this.finding();
    return f?.recordKeyField && f.sampleRecords.length ? recordRows(f, RECORDS_PAGE_SIZE) : [];
  });

  constructor() {
    effect(() => {
      if (this.store.data() && !this.finding()) void this.router.navigateByUrl('/remediation');
    });
  }
}
