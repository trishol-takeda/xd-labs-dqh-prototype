import { ChangeDetectionStrategy, Component, computed, effect, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { RemediationStore } from '../core/remediation-store.service';
import { Crumb } from '../core/remediation.model';
import { exportText } from '../core/remediation.util';
import { Crumbs } from '../shared/crumbs/crumbs';

/** The complete record of one finding as plain text, as an inspector would receive it. The build renders it as a signed PDF. */
@Component({
  selector: 'app-export-page',
  imports: [Crumbs],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './export-page.html',
})
export class ExportPage {
  private readonly store = inject(RemediationStore);
  private readonly router = inject(Router);

  readonly findingId = input.required<string>();
  protected readonly finding = computed(() => this.store.finding(this.findingId()));

  protected readonly crumbs = computed<readonly Crumb[]>(() => {
    const f = this.finding();
    return [{ label: f ? `${f.symptomLabel} · ${f.site}` : '', link: f ? ['/remediation', 'f', f.id] : undefined }, { label: 'Inspection export' }];
  });

  protected readonly text = computed(() => {
    const f = this.finding();
    const t = this.store.table(f?.table ?? '');
    return f && t ? exportText(f, t.plainName, new Date().toISOString()) : '';
  });

  constructor() {
    effect(() => {
      if (this.store.data() && !this.finding()) void this.router.navigateByUrl('/remediation');
    });
  }
}
