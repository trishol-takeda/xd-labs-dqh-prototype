import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { CONFIRM_LABEL } from '../../core/remediation.constants';
import { Block, Finding, Override, SegmentKey } from '../../core/remediation.model';
import { fmtDate, inScopeKeys } from '../../core/remediation.util';

const PERCENT = 100;

/**
 * The system's proposal in one card: scope, root cause, action plan and the Quality pre-assessment.
 * Before confirmation the trustee can override a block (with a reason) or confirm with one click.
 */
@Component({
  selector: 'app-proposal-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './proposal-card.html',
})
export class ProposalCard {
  readonly finding = input.required<Finding>();
  readonly keys = input.required<readonly SegmentKey[]>();
  /** Only the data trustee can override and confirm. */
  readonly canAct = input(false);
  readonly overrideBlock = output<Block>();
  readonly confirmed = output<string>();

  protected readonly fmtDate = fmtDate;
  protected readonly confirmLabel = CONFIRM_LABEL;
  protected readonly comment = signal('');

  protected readonly percent = computed(() => Math.round(this.finding().proposal.rootCause.confidence * PERCENT));
  protected readonly drafted = computed(() => this.finding().audit[1]?.at ?? this.finding().firstSeen);
  protected readonly inScope = computed(() => inScopeKeys(this.finding()));
  protected readonly overrides = computed(() => this.finding().confirmation?.overrides ?? this.finding().pendingOverrides ?? []);

  protected overridden(block: Block): Override | undefined {
    return this.overrides().find((o) => o.block === block);
  }
}
