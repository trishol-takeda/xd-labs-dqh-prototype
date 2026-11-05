import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { RemediationStore } from '../core/remediation-store.service';
import { RECORDS_SAMPLE_SIZE, SAMPLE_VALUE, STATUS_LABEL } from '../core/remediation.constants';
import { Cause, CheckItem, Crumb, DialogKind, DialogResult } from '../core/remediation.model';
import { causeBadge, fmtDate, full, humanCol, isPartlyFixed, peakFailing, rulesOfTable, whyOneCause } from '../core/remediation.util';
import { ActionDialog } from '../shared/action-dialog/action-dialog';
import { CheckList } from '../shared/check-list/check-list';
import { Chip } from '../shared/chip/chip';
import { Crumbs } from '../shared/crumbs/crumbs';
import { Spark } from '../shared/spark/spark';

/** Screen 4: one cause, with the actions the current role can take, the failing checks, ten sample records and its history. */
@Component({
  selector: 'app-cause-page',
  imports: [RouterLink, ActionDialog, CheckList, Chip, Crumbs, Spark],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './cause-page.html',
})
export class CausePage {
  protected readonly store = inject(RemediationStore);
  private readonly router = inject(Router);

  readonly causeId = input.required<string>();
  protected readonly full = full;
  protected readonly fmtDate = fmtDate;
  protected readonly statusLabel = STATUS_LABEL;

  protected readonly dialog = signal<DialogKind | null>(null);
  protected readonly showTrend = signal(false);
  protected readonly showHistory = signal(false);
  private readonly openRecords = signal<ReadonlySet<number>>(new Set());

  protected readonly cause = computed(() => this.store.cause(this.causeId()));
  protected readonly table = computed(() => this.store.table(this.cause()?.table ?? ''));
  protected readonly product = computed(() => this.store.productByName(this.cause()?.products[0]));
  protected readonly trusteeRole = computed(() => this.product()?.trusteeRole ?? 'Data trustee');

  protected readonly crumbs = computed<readonly Crumb[]>(() => {
    const p = this.product();
    const t = this.table();
    return [
      { label: 'Data products', link: ['/remediation'] },
      { label: p?.name ?? '', link: p ? ['/remediation', 'p', p.id] : undefined },
      { label: t?.plainName ?? '', link: t ? ['/remediation', 't', t.id] : undefined },
      { label: this.cause()?.rootCauseLabel ?? '' },
    ];
  });

  protected readonly badge = computed(() => {
    const c = this.cause();
    return c ? causeBadge(c) : '';
  });
  protected readonly partlyFixed = computed(() => {
    const c = this.cause();
    return !!c && isPartlyFixed(c);
  });
  protected readonly fewerThanPeak = computed(() => {
    const c = this.cause();
    return c ? full(peakFailing(c) - c.failingNow) : '';
  });

  /** When it was sent for correction, and when it was fixed or accepted: read from the audit trail, newest entry first. */
  protected readonly sentAt = computed(() => this.auditDate('sent'));
  protected readonly closedAt = computed(() => this.auditDate('closed', 'accepted'));

  private readonly sortedRules = computed(() => [...(this.cause()?.rules ?? [])].sort((a, b) => b.failingNow - a.failingNow));
  protected readonly tableChecks = computed(() => {
    const d = this.store.data();
    const c = this.cause();
    return d && c ? rulesOfTable(d, c.table).length : 0;
  });
  protected readonly why = computed(() => {
    const d = this.store.data();
    const c = this.cause();
    if (!d || !c) return '';
    const rules = c.rules.map((r) => d.rules.find((x) => x.id === r.id)).filter((r) => !!r);
    return whyOneCause(c, rules);
  });

  protected readonly checks = computed<CheckItem[]>(() => {
    const d = this.store.data();
    return this.sortedRules().map((r) => {
      const rule = d?.rules.find((x) => x.id === r.id);
      return {
        id: r.id,
        plainName: r.plainName,
        field: humanCol(r.column),
        failingNow: r.failingNow,
        whatItChecks: rule?.whatItChecks ?? '',
        whatFailureMeans: rule?.whatFailureMeans ?? '',
        history: rule?.history ?? [],
      };
    });
  });

  protected readonly records = computed(() => (this.cause()?.sampleRecords ?? []).slice(0, RECORDS_SAMPLE_SIZE));
  protected readonly trend = computed(() => (this.cause()?.history ?? []).map((h) => h.failing));
  /** Newest first, with a marker where the check was changed (a new rule version) since the run before. */
  protected readonly trendRows = computed(() => {
    const history = this.cause()?.history ?? [];
    return history.map((h, i) => ({ h, changed: i > 0 && history[i - 1].ruleVersion !== h.ruleVersion })).reverse();
  });
  protected readonly auditRows = computed(() => [...(this.cause()?.audit ?? [])].reverse());

  constructor() {
    effect(() => {
      if (this.store.data() && !this.cause()) void this.router.navigateByUrl('/remediation');
    });
    effect(() => this.store.activeCauseId.set(this.causeId()));
    inject(DestroyRef).onDestroy(() => this.store.activeCauseId.set(null));
  }

  protected isRecordOpen(index: number): boolean {
    return this.openRecords().has(index);
  }

  protected toggleRecord(index: number): void {
    this.openRecords.update((set) => {
      const next = new Set(set);
      if (!next.delete(index)) next.add(index);
      return next;
    });
  }

  /** The checks a sample record fails, with how it fails each one. */
  protected failedChecks(checksFailed: number): { name: string; detail: string }[] {
    const d = this.store.data();
    return this.sortedRules()
      .slice(0, checksFailed)
      .map((r) => {
        const ruleType = d?.rules.find((x) => x.id === r.id)?.ruleType ?? '';
        return { name: r.plainName, detail: `${humanCol(r.column)} ${SAMPLE_VALUE[ruleType] ?? 'fails the check'}` };
      });
  }

  protected confirm(kind: DialogKind, result: DialogResult): void {
    const c = this.cause();
    if (!c) return;
    switch (kind) {
      case 'send':
        return this.store.sendForCorrection(c, result.text);
      case 'dispute':
        return this.store.dispute(c, result.text);
      case 'accept':
        return this.store.accept(c, result.text, result.reviewBy ?? '');
      case 'wont':
        return this.store.cannotFix(c, result.text);
      case 'ruleChange':
        return this.store.changeRule(c, result.text);
    }
  }

  private auditDate(...events: string[]): string {
    const entry = [...(this.cause()?.audit ?? [])].reverse().find((a: Cause['audit'][number]) => events.includes(a.event));
    return entry ? fmtDate(entry.at) : '—';
  }
}
