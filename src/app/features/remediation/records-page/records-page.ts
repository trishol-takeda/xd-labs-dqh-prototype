import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { RemediationStore } from '../core/remediation-store.service';
import { RECORDS_PAGE_SIZE } from '../core/remediation.constants';
import { Crumb } from '../core/remediation.model';
import { full, syntheticRecordRows } from '../core/remediation.util';
import { Crumbs } from '../shared/crumbs/crumbs';

/** Records screen: the first 50 failing records of a cause, each with the checks it fails. */
@Component({
  selector: 'app-records-page',
  imports: [Crumbs],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './records-page.html',
})
export class RecordsPage {
  private readonly store = inject(RemediationStore);
  private readonly router = inject(Router);

  readonly causeId = input.required<string>();
  protected readonly full = full;
  protected readonly pageSize = RECORDS_PAGE_SIZE;

  protected readonly cause = computed(() => this.store.cause(this.causeId()));
  protected readonly table = computed(() => this.store.table(this.cause()?.table ?? ''));
  private readonly product = computed(() => this.store.productByName(this.cause()?.products[0]));

  protected readonly crumbs = computed<readonly Crumb[]>(() => {
    const c = this.cause();
    const p = this.product();
    const t = this.table();
    return [
      { label: 'Data products', link: ['/remediation'] },
      { label: p?.name ?? '', link: p ? ['/remediation', 'p', p.id] : undefined },
      { label: t?.plainName ?? '', link: t ? ['/remediation', 't', t.id] : undefined },
      { label: c?.rootCauseLabel ?? '', link: c ? ['/remediation', 'c', c.id] : undefined },
      { label: 'Records' },
    ];
  });

  protected readonly rows = computed(() => {
    const c = this.cause();
    return c?.recordKeyField && c.sampleRecords.length ? syntheticRecordRows(c, RECORDS_PAGE_SIZE) : [];
  });

  constructor() {
    effect(() => {
      if (this.store.data() && !this.cause()) void this.router.navigateByUrl('/remediation');
    });
    effect(() => this.store.activeCauseId.set(this.causeId()));
    inject(DestroyRef).onDestroy(() => this.store.activeCauseId.set(null));
  }
}
