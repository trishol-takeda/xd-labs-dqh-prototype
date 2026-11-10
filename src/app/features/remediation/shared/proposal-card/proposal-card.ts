import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { CONFIRM_LABEL, CONFIRM_SIGN_LABEL } from '../../core/remediation.constants';
import { Block, Finding, Override, RootCauseSignal, SegmentKey, Strength } from '../../core/remediation.model';
import { acceptOnly, fmtDate, inScopeKeys } from '../../core/remediation.util';

const PERCENT = 100;
const STRENGTH_LABEL: Record<Strength, string> = { strong: 'Strong evidence', moderate: 'Moderate evidence', weak: 'Weak evidence', trustee: 'Trustee judgement' };
const STRENGTH_CHIP: Record<Strength, string> = { strong: 'fixed', moderate: 'in_progress', weak: 'needs_you', trustee: 'in_progress' };

export interface ConfirmRequest {
  comment: string;
  alsoSiteIds: string[];
}

/**
 * The system's proposal in one card: scope, root cause (the signals are the record), action plan with a tick per action,
 * and the Quality pre-assessment. Before confirmation the trustee can untick actions, override a block (with a reason)
 * or confirm; afterwards the card collapses to one line.
 */
@Component({
  selector: 'app-proposal-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './proposal-card.html',
})
export class ProposalCard {
  readonly finding = input.required<Finding>();
  readonly keys = input.required<readonly SegmentKey[]>();
  /** Only the data trustee can tick, override and confirm. */
  readonly canAct = input(false);
  /** Same table and symptom at other sites, still waiting for a proposal to be confirmed. */
  readonly siblings = input<readonly Finding[]>([]);
  readonly overrideBlock = output<Block>();
  readonly includeChange = output<{ index: number; include: boolean }>();
  readonly confirmRequested = output<ConfirmRequest>();

  protected readonly fmtDate = fmtDate;
  protected readonly comment = signal('');
  protected readonly alsoSites = signal<readonly string[]>([]);
  protected readonly open = signal(false);

  protected readonly confirmLabel = computed(() => (this.finding().tier === 'critical' ? CONFIRM_SIGN_LABEL : CONFIRM_LABEL));
  protected readonly signedTier = computed(() => this.finding().tier === 'critical');
  protected readonly held = computed(() => acceptOnly(this.finding()));
  protected readonly confirmed = computed(() => !!this.finding().confirmation);
  protected readonly collapsed = computed(() => this.confirmed() && !this.open());
  protected readonly strength = computed(() => STRENGTH_LABEL[this.finding().proposal.rootCause.strength]);
  protected readonly strengthChip = computed(() => STRENGTH_CHIP[this.finding().proposal.rootCause.strength]);
  protected readonly drafted = computed(() => this.finding().audit[1]?.at ?? this.finding().firstSeen);
  protected readonly inScope = computed(() => inScopeKeys(this.finding()));
  protected readonly overrides = computed(() => this.finding().confirmation?.overrides ?? this.finding().pendingOverrides ?? []);
  protected readonly scopeCount = computed(() => this.inScope().length);
  protected readonly ticked = computed(() => this.finding().proposal.plan.filter((a) => a.include !== false).length);

  protected overridden(block: Block): Override | undefined {
    return this.overrides().find((o) => o.block === block);
  }

  protected value(e: RootCauseSignal): string {
    if (e.unit === 'share') return `${Math.round(Number(e.value) * PERCENT)}%`;
    if (e.unit === 'date') return fmtDate(String(e.value));
    return String(e.value);
  }

  protected toggleSite(id: string, on: boolean): void {
    this.alsoSites.update((list) => (on ? [...list, id] : list.filter((x) => x !== id)));
  }

  protected confirm(): void {
    this.confirmRequested.emit({ comment: this.comment().trim(), alsoSiteIds: [...this.alsoSites()] });
  }
}
