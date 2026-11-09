import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { RemediationStore } from '../core/remediation-store.service';
import { QA_ROLE, STATUS_LABEL } from '../core/remediation.constants';
import { Block, ConcurInput, Crumb, Finding, OverrideInput } from '../core/remediation.model';
import {
  acceptAction,
  acceptanceSigned,
  badges,
  checkChangedOn,
  awaitingConcurrence,
  closedAt,
  fieldItems,
  fmtDate,
  full,
  journey,
  ofTable,
  openCheckChange,
  segWords,
  segmentKeysFor,
  signalState,
  trusteeOf,
  verdict,
} from '../core/remediation.util';
import { ConcurDialog } from '../dialogs/concur-dialog/concur-dialog';
import { OverrideDialog } from '../dialogs/override-dialog/override-dialog';
import { RuleChangeDialog } from '../dialogs/rule-change-dialog/rule-change-dialog';
import { SignDialog } from '../dialogs/sign-dialog/sign-dialog';
import { CheckList } from '../shared/check-list/check-list';
import { Chip } from '../shared/chip/chip';
import { Crumbs } from '../shared/crumbs/crumbs';
import { JourneyStrip } from '../shared/journey-strip/journey-strip';
import { ProposalCard } from '../shared/proposal-card/proposal-card';
import { RecordGrid } from '../shared/record-grid/record-grid';
import { SegmentTiles } from '../shared/segment-tiles/segment-tiles';
import { Spark } from '../shared/spark/spark';

type OpenDialog = 'override' | 'concur' | 'signTrustee' | 'signQa' | 'ruleChange' | null;
const SAMPLE_ROWS = 10;

/** The finding: journey, the system's proposal to confirm, the records by segment, failing fields, actions, both verification signals and history. */
@Component({
  selector: 'app-finding-page',
  imports: [
    RouterLink,
    CheckList,
    Chip,
    ConcurDialog,
    Crumbs,
    JourneyStrip,
    OverrideDialog,
    ProposalCard,
    RecordGrid,
    RuleChangeDialog,
    SegmentTiles,
    SignDialog,
    Spark,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './finding-page.html',
})
export class FindingPage {
  protected readonly store = inject(RemediationStore);
  private readonly router = inject(Router);

  readonly findingId = input.required<string>();
  protected readonly full = full;
  protected readonly fmtDate = fmtDate;
  protected readonly statusLabel = STATUS_LABEL;
  protected readonly dialog = signal<OpenDialog>(null);
  protected readonly overrideOf = signal<Block>('scope');
  protected readonly showHistory = signal(false);

  protected readonly finding = computed(() => this.store.finding(this.findingId()));
  protected readonly table = computed(() => this.store.table(this.finding()?.table ?? ''));
  protected readonly product = computed(() => this.store.productByName(this.finding()?.products[0]));
  protected readonly vocab = computed(() => this.store.data()?.vocab);
  protected readonly registry = computed(() => this.store.data()?.registry);
  protected readonly keys = computed(() => {
    const vocab = this.vocab();
    return vocab ? segmentKeysFor(vocab, this.table()) : [];
  });

  protected readonly crumbs = computed<readonly Crumb[]>(() => {
    const f = this.finding();
    const p = this.product();
    const t = this.table();
    return [
      { label: 'Data products', link: ['/remediation'] },
      { label: p?.name ?? '', link: p ? ['/remediation', 'p', p.id] : undefined },
      { label: t?.plainName ?? '', link: t ? ['/remediation', 't', t.id] : undefined },
      { label: f ? `${f.symptomLabel} · ${f.site}` : '' },
    ];
  });

  protected readonly badges = computed(() => {
    const f = this.finding();
    return f ? badges(f) : [];
  });
  protected readonly steps = computed(() => {
    const f = this.finding();
    const vocab = this.vocab();
    return f && vocab ? journey(f, vocab) : [];
  });
  protected readonly verdict = computed(() => {
    const f = this.finding();
    return f ? verdict(f) : { kind: '' as const, label: '' };
  });
  protected readonly signals = computed(() => {
    const f = this.finding();
    return f ? signalState(f) : { bleedOk: false, backlogOk: false };
  });
  protected readonly fieldItems = computed(() => {
    const f = this.finding();
    return f ? fieldItems(f) : [];
  });
  protected readonly sampleRows = computed(() => (this.finding()?.sampleRecords ?? []).slice(0, SAMPLE_ROWS));
  protected readonly newFailuresTrend = computed(() => (this.finding()?.history ?? []).map((h) => h.newFailing));
  protected readonly failingTrend = computed(() => (this.finding()?.history ?? []).map((h) => h.failing));
  protected readonly changedOn = computed(() => {
    const f = this.finding();
    return f ? checkChangedOn(f) : null;
  });
  protected readonly closedOn = computed(() => {
    const f = this.finding();
    return f ? closedAt(f) : null;
  });
  protected readonly auditRows = computed(() => [...(this.finding()?.audit ?? [])].reverse());
  protected readonly related = computed(() => {
    const d = this.store.data();
    const f = this.finding();
    return d && f ? ofTable(d, f.table).filter((x) => x.id !== f.id && x.symptom === f.symptom) : [];
  });

  protected readonly trustee = computed(() => {
    const d = this.store.data();
    const f = this.finding();
    return d && f ? trusteeOf(d, f) : '';
  });

  protected readonly accept = computed(() => {
    const f = this.finding();
    return f ? acceptAction(f) : undefined;
  });
  protected readonly acceptSigned = computed(() => {
    const f = this.finding();
    const a = this.accept();
    return f && a ? acceptanceSigned(f, a) : { trustee: false, qa: false };
  });
  protected readonly checkChange = computed(() => {
    const f = this.finding();
    return f ? openCheckChange(f) : undefined;
  });
  protected readonly segWords = segWords;

  constructor() {
    effect(() => {
      if (this.store.data() && !this.finding()) void this.router.navigateByUrl('/remediation');
    });
    effect(() => this.store.activeFindingId.set(this.findingId()));
    inject(DestroyRef).onDestroy(() => this.store.activeFindingId.set(null));
  }

  /** Only the data trustee confirms or overrides the proposal. */
  protected readonly canConfirm = computed(() => this.store.role() === 'trustee');
  /** The Quality approver's step: concur once the trustee has confirmed. */
  protected readonly needsConcurrence = computed(() => {
    const f = this.finding();
    return this.store.role() === 'qa' && !!f && awaitingConcurrence(f);
  });

  protected open(kind: Exclude<OpenDialog, null>): void {
    this.dialog.set(kind);
  }

  protected startOverride(block: Block): void {
    this.overrideOf.set(block);
    this.dialog.set('override');
  }

  protected readonly qaRole = QA_ROLE;

  /* ---------- saves: each one records an audit entry in the store and closes the dialog ---------- */

  protected confirm(comment: string): void {
    const f = this.finding();
    if (f) this.store.confirm(f, comment);
  }
  protected saveOverride(input: OverrideInput): void {
    this.run((f) => this.store.override(f, input));
  }
  protected saveConcur(input: ConcurInput): void {
    this.run((f) => this.store.concur(f, input));
  }
  protected sign(who: string): void {
    const a = this.accept();
    if (a) this.run((f) => this.store.sign(f, a, who));
  }
  protected publish(what: string): void {
    this.run((f) => this.store.publishCheckChange(f, what));
  }
  protected stands(): void {
    const f = this.finding();
    if (f) this.store.checkStands(f);
  }

  private run(change: (f: Finding) => void): void {
    const f = this.finding();
    if (f) change(f);
    this.dialog.set(null);
  }
}
